import type { DataConnection } from 'peerjs'
import type { SelectedSkin } from '../store/atoms'

interface FileTransferMetadata {
  fileName: string
  fileSize: number
  fileHash: string
  mimeType: string
  modInfo: {
    championName: string
    skinName: string
  }
}

interface FileTransferRequest {
  id: string
  type: 'file-offer'
  metadata: FileTransferMetadata
  skinInfo: SelectedSkin
}

interface FileTransferResponse {
  id: string
  type: 'file-accept' | 'file-reject'
  reason?: string
}

interface FileChunk {
  id: string
  type: 'file-chunk'
  sequence: number
  totalChunks: number
  data: ArrayBuffer
}

interface FileTransferComplete {
  id: string
  type: 'file-complete'
}

interface FileTransferError {
  id: string
  type: 'file-error'
  error: string
}

// File transfer message types are used individually

interface ActiveTransfer {
  id: string
  metadata: FileTransferMetadata
  connection: DataConnection
  direction: 'send' | 'receive'
  progress: number
  chunks: Map<number, ArrayBuffer>
  totalChunks: number
  startTime: number
  skinInfo?: SelectedSkin
}

export class P2PFileTransferService {
  private activeTransfers: Map<string, ActiveTransfer> = new Map()
  private CHUNK_SIZE = 64 * 1024 // 64KB chunks
  private MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
  private TRANSFER_TIMEOUT = 5 * 60 * 1000 // 5 minutes
  private eventListeners: Map<string, Array<(data: any) => void>> = new Map()

  // Event emitter methods
  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  removeListener(event: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }

  async requestFile(
    connection: DataConnection,
    skinInfo: SelectedSkin,
    localModPath: string
  ): Promise<string> {
    const transferId = this.generateTransferId()

    // Check if this is the sender's mod path
    const isSender = await this.isLocalModPath(localModPath)

    if (isSender) {
      // We are the sender, get file info from our local path
      const fileInfo = await window.api.getModFileInfo(localModPath)
      if (!fileInfo.success || !fileInfo.data) {
        throw new Error('Failed to get mod file info')
      }

      const request: FileTransferRequest = {
        id: transferId,
        type: 'file-offer',
        metadata: {
          fileName: fileInfo.data.fileName,
          fileSize: fileInfo.data.size,
          fileHash: fileInfo.data.hash,
          mimeType: fileInfo.data.mimeType,
          modInfo: {
            championName: skinInfo.championKey,
            skinName: skinInfo.skinName
          }
        },
        skinInfo
      }

      // Send transfer request
      connection.send(request)
    } else {
      // We are requesting a file from peer, use the metadata from the skin
      const customModInfo = (skinInfo as any).customModInfo
      if (!customModInfo) {
        throw new Error('No mod info available for transfer')
      }

      const request: FileTransferRequest = {
        id: transferId,
        type: 'file-offer',
        metadata: {
          fileName: customModInfo.fileName,
          fileSize: customModInfo.fileSize,
          fileHash: customModInfo.fileHash,
          mimeType: 'application/octet-stream',
          modInfo: {
            championName: skinInfo.championKey,
            skinName: skinInfo.skinName
          }
        },
        skinInfo
      }

      // Store this as a receiver transfer
      const transfer: ActiveTransfer = {
        id: transferId,
        metadata: request.metadata,
        connection,
        direction: 'receive',
        progress: 0,
        chunks: new Map(),
        totalChunks: Math.ceil(request.metadata.fileSize / this.CHUNK_SIZE),
        startTime: Date.now(),
        skinInfo
      }
      this.activeTransfers.set(transferId, transfer)

      // Send transfer request to peer who has the file
      connection.send(request)
    }

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cancelTransfer(transferId)
        reject(new Error('Transfer request timed out'))
      }, 30000) // 30 second timeout for initial response

      const handleResponse = (data: any) => {
        if (
          data.id === transferId &&
          (data.type === 'file-accept' || data.type === 'file-reject')
        ) {
          clearTimeout(timeout)

          if (data.type === 'file-accept') {
            resolve(transferId)
          } else {
            reject(new Error(data.reason || 'Transfer rejected'))
          }
        }
      }

      // Store handler temporarily
      connection.once('data', handleResponse)
    })
  }

  async sendFile(
    connection: DataConnection,
    transferId: string,
    filePath: string,
    metadata: FileTransferMetadata
  ): Promise<void> {
    const transfer: ActiveTransfer = {
      id: transferId,
      metadata,
      connection,
      direction: 'send',
      progress: 0,
      chunks: new Map(),
      totalChunks: Math.ceil(metadata.fileSize / this.CHUNK_SIZE),
      startTime: Date.now()
    }

    this.activeTransfers.set(transferId, transfer)

    try {
      // Read file in chunks from main process
      for (let i = 0; i < transfer.totalChunks; i++) {
        if (!this.activeTransfers.has(transferId)) {
          throw new Error('Transfer cancelled')
        }

        const chunkData = await window.api.readFileChunk(
          filePath,
          i * this.CHUNK_SIZE,
          this.CHUNK_SIZE
        )
        if (!chunkData.success || !chunkData.data) {
          throw new Error('Failed to read file chunk')
        }

        const chunk: FileChunk = {
          id: transferId,
          type: 'file-chunk',
          sequence: i,
          totalChunks: transfer.totalChunks,
          data: chunkData.data
        }

        connection.send(chunk)

        // Update progress
        transfer.progress = ((i + 1) / transfer.totalChunks) * 100
        this.emit('transfer-progress', {
          id: transferId,
          progress: transfer.progress,
          bytesTransferred: (i + 1) * this.CHUNK_SIZE,
          totalBytes: metadata.fileSize
        })

        // Small delay to avoid overwhelming the connection
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Send completion message
      const complete: FileTransferComplete = {
        id: transferId,
        type: 'file-complete'
      }
      connection.send(complete)

      this.emit('transfer-complete', { id: transferId, direction: 'send' })
    } catch (error) {
      const errorMsg: FileTransferError = {
        id: transferId,
        type: 'file-error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      connection.send(errorMsg)

      this.emit('transfer-error', { id: transferId, error })
      throw error
    } finally {
      this.activeTransfers.delete(transferId)
    }
  }

  async receiveFile(
    connection: DataConnection,
    transferId: string,
    metadata: FileTransferMetadata,
    skinInfo: SelectedSkin
  ): Promise<string> {
    const transfer: ActiveTransfer = {
      id: transferId,
      metadata,
      connection,
      direction: 'receive',
      progress: 0,
      chunks: new Map(),
      totalChunks: Math.ceil(metadata.fileSize / this.CHUNK_SIZE),
      startTime: Date.now(),
      skinInfo
    }

    this.activeTransfers.set(transferId, transfer)

    // Prepare temporary file path
    const tempPath = await window.api.prepareTempFile(metadata.fileName)
    if (!tempPath.success || !tempPath.path) {
      throw new Error('Failed to prepare temporary file')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cancelTransfer(transferId)
        reject(new Error('Transfer timed out'))
      }, this.TRANSFER_TIMEOUT)

      const cleanup = () => {
        clearTimeout(timeout)
        this.activeTransfers.delete(transferId)
      }

      // Handle incoming chunks
      const handleData = async (data: any) => {
        if (data.id !== transferId) return

        try {
          switch (data.type) {
            case 'file-chunk': {
              const chunk = data as FileChunk
              transfer.chunks.set(chunk.sequence, chunk.data)

              // Update progress
              transfer.progress = (transfer.chunks.size / transfer.totalChunks) * 100
              this.emit('transfer-progress', {
                id: transferId,
                progress: transfer.progress,
                bytesTransferred: transfer.chunks.size * this.CHUNK_SIZE,
                totalBytes: metadata.fileSize
              })

              // Check if all chunks received
              if (transfer.chunks.size === transfer.totalChunks) {
                // Assemble file
                const chunks: ArrayBuffer[] = []
                for (let i = 0; i < transfer.totalChunks; i++) {
                  const chunkData = transfer.chunks.get(i)
                  if (!chunkData) {
                    throw new Error(`Missing chunk ${i}`)
                  }
                  chunks.push(chunkData)
                }

                // Write assembled file
                const writeResult = await window.api.writeFileFromChunks(
                  tempPath.path!,
                  chunks,
                  metadata.fileHash
                )

                if (!writeResult.success) {
                  throw new Error(writeResult.error || 'Failed to write file')
                }

                // Import the mod
                const importResult = await window.api.importFile(tempPath.path!, {
                  championName: metadata.modInfo.championName,
                  skinName: metadata.modInfo.skinName
                })

                if (!importResult.success) {
                  throw new Error(importResult.error || 'Failed to import mod')
                }

                cleanup()
                this.emit('transfer-complete', {
                  id: transferId,
                  direction: 'receive',
                  localPath: importResult.skinInfo?.localPath
                })
                resolve(importResult.skinInfo?.localPath || '')
              }
              break
            }

            case 'file-error': {
              const error = data as FileTransferError
              cleanup()
              reject(new Error(error.error))
              break
            }

            case 'file-complete':
              // Sender thinks it's complete, verify on our end
              if (transfer.chunks.size !== transfer.totalChunks) {
                throw new Error('Incomplete transfer')
              }
              break
          }
        } catch (error) {
          cleanup()
          reject(error)
        }
      }

      connection.on('data', handleData)
    })
  }

  async handleFileTransferRequest(
    connection: DataConnection,
    request: FileTransferRequest
  ): Promise<void> {
    // Validate file size
    if (request.metadata.fileSize > this.MAX_FILE_SIZE) {
      const response: FileTransferResponse = {
        id: request.id,
        type: 'file-reject',
        reason: 'File too large (max 500MB)'
      }
      connection.send(response)
      return
    }

    // Check if we have this mod locally (we are the sender)
    const downloadedSkins = await window.api.listDownloadedSkins()
    const localMod = downloadedSkins.skins?.find(
      (ds) =>
        ds.championName === request.metadata.modInfo.championName &&
        ds.skinName.includes(request.metadata.modInfo.skinName)
    )

    if (localMod?.localPath) {
      // We have the file, auto-accept and send it
      const response: FileTransferResponse = {
        id: request.id,
        type: 'file-accept'
      }
      connection.send(response)

      // Start sending file
      try {
        await this.sendFile(connection, request.id, localMod.localPath, request.metadata)
      } catch (error) {
        console.error('Failed to send file:', error)
      }
    } else {
      // We don't have the file, this might be a request to us to download
      // Emit event for UI to handle consent
      this.emit('transfer-request', {
        id: request.id,
        peerId: connection.peer,
        metadata: request.metadata,
        skinInfo: request.skinInfo,
        accept: async () => {
          const response: FileTransferResponse = {
            id: request.id,
            type: 'file-accept'
          }
          connection.send(response)

          // Start receiving file
          try {
            await this.receiveFile(connection, request.id, request.metadata, request.skinInfo)
          } catch (error) {
            console.error('Failed to receive file:', error)
          }
        },
        reject: (reason?: string) => {
          const response: FileTransferResponse = {
            id: request.id,
            type: 'file-reject',
            reason
          }
          connection.send(response)
        }
      })
    }
  }

  cancelTransfer(transferId: string): void {
    const transfer = this.activeTransfers.get(transferId)
    if (transfer) {
      const error: FileTransferError = {
        id: transferId,
        type: 'file-error',
        error: 'Transfer cancelled'
      }
      transfer.connection.send(error)

      this.activeTransfers.delete(transferId)
      this.emit('transfer-cancelled', { id: transferId })
    }
  }

  getActiveTransfers(): ActiveTransfer[] {
    return Array.from(this.activeTransfers.values())
  }

  private generateTransferId(): string {
    return `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async isLocalModPath(path: string): Promise<boolean> {
    // Check if the path exists locally
    try {
      await window.api.getModFileInfo(path)
      return true
    } catch {
      return false
    }
  }
}

// Singleton instance
export const p2pFileTransferService = new P2PFileTransferService()
