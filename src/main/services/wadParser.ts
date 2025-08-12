import { Buffer } from 'buffer'
import * as zlib from 'zlib'
import { XXHash64 } from 'xxhash-addon'
import * as fzstd from 'fzstd'

export enum WADCompressionType {
  Raw = 0,
  Gzip = 1,
  Satellite = 2,
  Zstd = 3,
  ZstdChunked = 4
}

export interface WADChunk {
  id: number
  hash: string
  offset: number
  compressedSize: number
  decompressedSize: number
  compressionType: WADCompressionType
  duplicated: boolean
  subchunkStart: number
  subchunkCount: number
  checksum: bigint
  data?: Buffer
  extension?: string
}

export interface WADHeader {
  signature: string
  versionMajor: number
  versionMinor: number
  checksum: bigint
  chunkCount: number
}

export class WADParser {
  private buffer: Buffer
  private position: number = 0

  constructor(buffer: Buffer) {
    this.buffer = buffer
  }

  private readBytes(length: number): Buffer {
    const bytes = this.buffer.subarray(this.position, this.position + length)
    this.position += length
    return bytes
  }

  private readString(length: number): string {
    return this.readBytes(length).toString('ascii')
  }

  private readUInt8(): number {
    const value = this.buffer.readUInt8(this.position)
    this.position += 1
    return value
  }

  private readUInt16LE(): number {
    const value = this.buffer.readUInt16LE(this.position)
    this.position += 2
    return value
  }

  private readUInt32LE(): number {
    const value = this.buffer.readUInt32LE(this.position)
    this.position += 4
    return value
  }

  private readUInt64LE(): bigint {
    const value = this.buffer.readBigUInt64LE(this.position)
    this.position += 8
    return value
  }

  parseHeader(): WADHeader {
    this.position = 0

    const signature = this.readString(2)
    if (signature !== 'RW') {
      throw new Error('Invalid WAD signature')
    }

    const versionMajor = this.readUInt8()
    const versionMinor = this.readUInt8()

    // Skip padding (256 bytes for v3, 83 bytes for v2)
    const paddingSize = versionMajor >= 3 ? 256 : 83
    this.position += paddingSize

    // Skip file checksum if v2+
    let checksum = 0n
    if (versionMajor >= 2) {
      checksum = this.readUInt64LE()
    }

    const chunkCount = this.readUInt32LE()

    return {
      signature,
      versionMajor,
      versionMinor,
      checksum,
      chunkCount
    }
  }

  parseChunks(header: WADHeader): WADChunk[] {
    const chunks: WADChunk[] = []

    for (let i = 0; i < header.chunkCount; i++) {
      const hash = this.readUInt64LE().toString(16).padStart(16, '0')
      const offset = this.readUInt32LE()
      const compressedSize = this.readUInt32LE()
      const decompressedSize = this.readUInt32LE()

      const compressionTypeByte = this.readUInt8()
      const compressionType = compressionTypeByte & 0x0f
      const subchunkCount = compressionTypeByte >> 4

      const duplicated = this.readUInt8() !== 0
      const subchunkStart = this.readUInt16LE()

      let checksum = 0n
      if (header.versionMajor >= 2) {
        checksum = this.readUInt64LE()
      }

      chunks.push({
        id: i,
        hash,
        offset,
        compressedSize,
        decompressedSize,
        compressionType,
        duplicated,
        subchunkStart,
        subchunkCount,
        checksum
      })
    }

    return chunks
  }

  extractChunk(chunk: WADChunk): Buffer {
    const rawData = this.buffer.subarray(chunk.offset, chunk.offset + chunk.compressedSize)
    return this.decompressChunk(rawData, chunk.compressionType)
  }

  private decompressChunk(data: Buffer, compressionType: WADCompressionType): Buffer {
    switch (compressionType) {
      case WADCompressionType.Raw:
        return data

      case WADCompressionType.Gzip:
        return Buffer.from(zlib.gunzipSync(data))

      case WADCompressionType.Zstd:
      case WADCompressionType.ZstdChunked:
        try {
          // Use fzstd to decompress
          const decompressed = fzstd.decompress(new Uint8Array(data))
          return Buffer.from(decompressed)
        } catch (error) {
          console.warn('Zstd decompression failed:', error)
          return data
        }

      case WADCompressionType.Satellite:
        throw new Error('Satellite compression is not supported')

      default:
        throw new Error(`Unknown compression type: ${compressionType}`)
    }
  }

  findTextureFiles(chunks: WADChunk[]): WADChunk[] {
    const textureChunks: WADChunk[] = []

    for (const chunk of chunks) {
      // Extract chunk data to check for TEX signature
      try {
        const data = this.extractChunk(chunk)

        // Check for TEX file signature (0x00584554 or "TEX\0")
        if (data.length >= 4) {
          const signature = data.readUInt32LE(0)
          if (signature === 0x00584554 || data.subarray(0, 3).toString('ascii') === 'TEX') {
            chunk.extension = 'tex'
            chunk.data = data
            textureChunks.push(chunk)
          }
        }
      } catch (error) {
        console.warn('Failed to extract chunk:', error)
        continue
      }
    }

    return textureChunks
  }

  static hashPath(path: string): string {
    const hasher = new XXHash64(Buffer.alloc(8))
    hasher.update(Buffer.from(path.toLowerCase()))
    const hash = hasher.digest()
    return hash.toString('hex').padStart(16, '0')
  }
}
