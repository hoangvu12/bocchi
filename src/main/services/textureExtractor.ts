import * as path from 'path'
import * as fs from 'fs/promises'
import { XXHash64 } from 'xxhash-addon'
import { WADParser, WADChunk } from './wadParser'

export class TextureExtractor {
  private wadParser: WADParser
  private chunks: WADChunk[]

  constructor(wadBuffer: Buffer, chunks: WADChunk[]) {
    this.wadParser = new WADParser(wadBuffer)
    this.chunks = chunks
  }

  /**
   * Calculate XXH64 hash for a given path (lowercase)
   */
  private calculatePathHash(filePath: string): string {
    // WAD files use lowercase paths
    const lowercasePath = filePath.toLowerCase()
    // Create XXHash64 instance with zero seed (8 bytes)
    const hasher = new XXHash64(Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]))
    hasher.update(Buffer.from(lowercasePath))
    const hashBuffer = hasher.digest()
    // Convert to hex string
    return hashBuffer.toString('hex')
  }

  /**
   * Find loading screen textures in WAD chunks
   */
  findLoadingScreenTextures(championName?: string): WADChunk[] {
    const textureChunks: WADChunk[] = []
    const allTextures: Array<{ chunk: WADChunk; header: any; possiblePath?: string }> = []

    // If we have a champion name, try to find by specific path pattern first
    if (championName) {
      // Common loading screen path patterns in League of Legends
      const possiblePaths = [
        `assets/characters/${championName}/skins/base/${championName}loadscreen.tex`,
        `assets/characters/${championName}/skins/base/${championName}loadscreen.dds`,
        `assets/characters/${championName}/skins/skin01/${championName}loadscreen.tex`,
        `assets/characters/${championName}/skins/skin01/${championName}loadscreen.dds`,
        // Some champions might have different casing
        `assets/characters/${championName.toLowerCase()}/skins/base/${championName.toLowerCase()}loadscreen.tex`,
        `assets/characters/${championName.toLowerCase()}/skins/base/${championName.toLowerCase()}loadscreen.dds`
      ]

      for (const possiblePath of possiblePaths) {
        const pathHash = this.calculatePathHash(possiblePath)
        const matchingChunk = this.chunks.find((chunk) => chunk.hash === pathHash)

        if (matchingChunk) {
          console.log(`Found loading screen by path hash! Path: ${possiblePath}, Hash: ${pathHash}`)
          try {
            const data = this.wadParser.extractChunk(matchingChunk)
            matchingChunk.data = data
            matchingChunk.extension = 'tex'
            return [matchingChunk]
          } catch (error) {
            console.warn(`Failed to extract chunk for path ${possiblePath}:`, error)
          }
        }
      }
    }

    // Fallback: look for 308x560 textures
    for (const chunk of this.chunks) {
      try {
        const data = this.wadParser.extractChunk(chunk)

        // Check for TEX file signature
        if (this.isTexFile(data)) {
          const texHeader = this.parseTexHeader(data)
          if (texHeader) {
            console.log(
              `Found TEX file - Hash: ${chunk.hash}, Size: ${texHeader.width}x${texHeader.height}, Format: ${texHeader.format}`
            )
            allTextures.push({ chunk, header: texHeader })

            // Check if it's a 308x560 loading screen
            if (this.isLikelyLoadingScreen(texHeader)) {
              chunk.data = data
              chunk.extension = 'tex'
              textureChunks.push(chunk)
            }
          }
        }
      } catch (error) {
        console.warn('Failed to process chunk:', error)
        // Skip chunks that can't be extracted
        continue
      }
    }

    console.log(`Total TEX files found: ${allTextures.length}`)
    console.log(
      'All texture sizes:',
      allTextures.map((t) => `${t.header.width}x${t.header.height}`).join(', ')
    )

    if (textureChunks.length > 0) {
      // Return the first 308x560 texture found
      return [textureChunks[0]]
    }

    return textureChunks
  }

  /**
   * Check if data is a TEX file
   */
  private isTexFile(data: Buffer): boolean {
    if (data.length < 4) return false

    // Check for TEX signature (0x00584554 or "TEX\0")
    const signature = data.readUInt32LE(0)
    if (signature === 0x00584554) return true

    // Also check ASCII "TEX"
    const asciiSig = data.subarray(0, 3).toString('ascii')
    return asciiSig === 'TEX'
  }

  /**
   * Parse TEX header to get image dimensions
   */
  private parseTexHeader(data: Buffer): { width: number; height: number; format: number } | null {
    if (!this.isTexFile(data)) return null

    try {
      // TEX header structure (from Ritoddstex source)
      // magic: 4 bytes
      // width: 2 bytes (uint16)
      // height: 2 bytes (uint16)
      // unk1: 1 byte
      // format: 1 byte
      // unk2: 1 byte
      // hasMipmaps: 1 byte

      const width = data.readUInt16LE(4)
      const height = data.readUInt16LE(6)
      const format = data.readUInt8(9)

      return { width, height, format }
    } catch (error) {
      console.warn('Failed to parse TEX header:', error)
      return null
    }
  }

  /**
   * Check if texture dimensions suggest it's a loading screen
   */
  private isLikelyLoadingScreen(header: { width: number; height: number }): boolean {
    // Loading screens in League of Legends are typically 308x560
    // This is the champion loading screen portrait size
    return header.width === 308 && header.height === 560
  }

  /**
   * Extract a TEX file from chunk to a temporary location
   */
  async extractTexFile(chunk: WADChunk, outputPath: string): Promise<string> {
    if (!chunk.data) {
      chunk.data = this.wadParser.extractChunk(chunk)
    }

    const texPath = path.join(outputPath, `texture_${chunk.hash}.tex`)
    await fs.writeFile(texPath, chunk.data)

    return texPath
  }

  /**
   * Try to find any texture file (fallback if no loading screen found)
   */
  findAnyTextureFile(): WADChunk | null {
    // This method is no longer used as a fallback
    // We only want to extract 308x560 loading screen textures
    return null
  }
}
