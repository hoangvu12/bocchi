import Peer, { DataConnection } from 'peerjs'
import type { P2PRoom, P2PRoomMember, SelectedSkin } from '../../../main/types'
import { p2pFileTransferService } from './p2pFileTransferService'

export class P2PService {
  private peer: Peer | null = null
  private room: P2PRoom | null = null
  private connections: Map<string, DataConnection> = new Map()
  private isHost: boolean = false
  private eventCallbacks: Map<string, ((data: any) => void)[]> = new Map()

  private generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  private emit(event: string, data: any) {
    const callbacks = this.eventCallbacks.get(event) || []
    callbacks.forEach((cb) => cb(data))
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, [])
    }
    this.eventCallbacks.get(event)!.push(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.eventCallbacks.get(event)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    }
  }

  async createRoom(displayName: string): Promise<string> {
    try {
      this.isHost = true
      const roomId = this.generateRoomId()

      // Initialize peer with room ID as peer ID
      this.peer = new Peer(roomId)

      await new Promise<void>((resolve, reject) => {
        this.peer!.on('open', (id) => {
          console.log(`[P2P] Room created with ID: ${id}`)

          // Create room object
          this.room = {
            id,
            createdAt: new Date(),
            host: {
              id,
              name: displayName,
              activeSkins: [],
              isHost: true,
              connected: true
            },
            members: []
          }

          this.emit('room-updated', this.room)
          this.emit('connection-status', 'connected')
          resolve()
        })

        this.peer!.on('error', (err) => {
          console.error('[P2P] Error creating room:', err)
          reject(err)
        })
      })

      // Set up connection handler for incoming peers
      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn)
      })

      return roomId
    } catch (error) {
      this.cleanup()
      throw error
    }
  }

  async joinRoom(roomId: string, displayName: string): Promise<void> {
    try {
      this.isHost = false

      // Generate unique peer ID
      const peerId = `${roomId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      this.peer = new Peer(peerId)

      await new Promise<void>((resolve, reject) => {
        this.peer!.on('open', (id) => {
          console.log(`[P2P] Connected with peer ID: ${id}`)

          // Connect to room host
          const conn = this.peer!.connect(roomId, {
            reliable: true,
            metadata: {
              displayName,
              type: 'join'
            }
          })

          conn.on('open', () => {
            console.log(`[P2P] Connected to room: ${roomId}`)
            this.connections.set(roomId, conn)

            // Send initial handshake
            conn.send({
              type: 'member-info',
              data: {
                id: peerId,
                name: displayName,
                activeSkins: []
              }
            })

            this.emit('connection-status', 'connected')
            resolve()
          })

          conn.on('data', (data: any) => {
            this.handlePeerMessage(roomId, data)
          })

          conn.on('close', () => {
            console.log(`[P2P] Disconnected from room`)
            this.connections.delete(roomId)
            this.emit('connection-status', 'disconnected')
          })

          conn.on('error', (err) => {
            console.error('[P2P] Connection error:', err)
            reject(err)
          })
        })

        this.peer!.on('error', (err) => {
          console.error('[P2P] Error joining room:', err)
          reject(err)
        })
      })

      // Also listen for connections from other peers
      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn)
      })
    } catch (error) {
      this.cleanup()
      throw error
    }
  }

  private handleIncomingConnection(conn: DataConnection) {
    console.log(`[P2P] Incoming connection from: ${conn.peer}`)

    conn.on('open', () => {
      const metadata = conn.metadata

      if (this.isHost && metadata?.type === 'join') {
        // New member joining
        const newMember: P2PRoomMember = {
          id: conn.peer,
          name: metadata.displayName || 'Unknown',
          activeSkins: [],
          isHost: false,
          connected: true
        }

        if (this.room) {
          // Create new room object for React state update
          this.room = {
            ...this.room,
            members: [...this.room.members, newMember]
          }
          this.connections.set(conn.peer, conn)

          // Send room info to new member
          conn.send({
            type: 'room-info',
            data: this.room
          })

          // Broadcast updated room to all members
          this.broadcastRoomUpdate()

          // Update host's own UI
          this.emit('room-updated', this.room)

          // Notify renderer
          this.emit('member-joined', newMember)
        }
      } else {
        // Peer-to-peer connection between members
        this.connections.set(conn.peer, conn)
      }
    })

    conn.on('data', (data: any) => {
      this.handlePeerMessage(conn.peer, data)
    })

    conn.on('close', () => {
      this.handlePeerDisconnect(conn.peer)
    })
  }

  private handlePeerMessage(peerId: string, message: any) {
    console.log(`[P2P] Message from ${peerId}:`, message.type)

    // Handle file transfer messages
    if (message.type && message.type.startsWith('file-')) {
      const conn = this.connections.get(peerId)
      if (conn) {
        if (message.type === 'file-offer') {
          p2pFileTransferService.handleFileTransferRequest(conn, message)
        } else {
          // Let file transfer service handle other file messages
          conn.emit('data', message)
        }
      }
      return
    }

    switch (message.type) {
      case 'member-info':
        // Initial member info
        if (this.isHost) {
          const member = this.room?.members.find((m) => m.id === peerId)
          if (member) {
            Object.assign(member, message.data)
            this.broadcastRoomUpdate()
          }
        }
        break

      case 'room-info':
        // Received room info (when joining)
        this.room = message.data
        this.emit('room-updated', this.room)
        break

      case 'room-update':
        // Room state update from host
        this.room = message.data
        this.emit('room-updated', this.room)
        break

      case 'skins-update':
        // Peer updated their active skins
        // eslint-disable-next-line no-case-declarations
        const skins = message.data as SelectedSkin[]

        if (this.room) {
          if (this.isHost) {
            // Host updates member skins
            const memberIndex = this.room.members.findIndex((m) => m.id === peerId)
            if (memberIndex !== -1) {
              // Create new room object for React state update
              this.room = {
                ...this.room,
                members: this.room.members.map((m, i) =>
                  i === memberIndex ? { ...m, activeSkins: skins } : m
                )
              }
              this.broadcastRoomUpdate()
              this.emit('room-updated', this.room)
            }
          } else {
            // Non-host updates their view of other members
            if (this.room.host.id === peerId) {
              // Host updated their skins
              this.room = {
                ...this.room,
                host: { ...this.room.host, activeSkins: skins }
              }
            } else {
              // Another member updated their skins
              const memberIndex = this.room.members.findIndex((m) => m.id === peerId)
              if (memberIndex !== -1) {
                this.room = {
                  ...this.room,
                  members: this.room.members.map((m, i) =>
                    i === memberIndex ? { ...m, activeSkins: skins } : m
                  )
                }
              }
            }
            this.emit('room-updated', this.room)
          }

          this.emit('peer-skins-updated', { peerId, skins })
        }
        break
    }
  }

  private handlePeerDisconnect(peerId: string) {
    console.log(`[P2P] Peer disconnected: ${peerId}`)
    this.connections.delete(peerId)

    // Cancel any active transfers with this peer
    p2pFileTransferService.getActiveTransfers().forEach((transfer) => {
      if (transfer.connection.peer === peerId) {
        p2pFileTransferService.cancelTransfer(transfer.id)
      }
    })

    if (this.room && this.isHost) {
      const memberIndex = this.room.members.findIndex((m) => m.id === peerId)
      if (memberIndex !== -1) {
        // Create new room object and remove the disconnected member
        this.room = {
          ...this.room,
          members: this.room.members.filter((m) => m.id !== peerId)
        }
        this.broadcastRoomUpdate()
        this.emit('room-updated', this.room)
        this.emit('member-left', peerId)
      }
    }
  }

  private broadcastRoomUpdate() {
    if (!this.isHost || !this.room) return

    const message = {
      type: 'room-update',
      data: this.room
    }

    // Send to all connected members
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(message)
      }
    })
  }

  async broadcastActiveSkins(
    skins: SelectedSkin[],
    downloadedSkins: Array<{ championName: string; skinName: string; localPath?: string }>
  ) {
    if (!this.peer || !this.room) return

    // Prepare skins with transfer capability metadata
    const preparedSkins = await Promise.all(
      skins.map(async (skin) => {
        if (skin.championKey === 'Custom') {
          // Find the local path for this custom skin
          const modInfo = downloadedSkins.find(
            (ds) => ds.championName === 'Custom' && ds.skinName.includes(skin.skinName)
          )

          if (modInfo?.localPath) {
            // Get file info for custom mod
            const fileInfo = await window.api.getModFileInfo(modInfo.localPath)
            if (fileInfo.success && fileInfo.data) {
              return {
                ...skin,
                customModInfo: {
                  localPath: modInfo.localPath,
                  fileSize: fileInfo.data.size,
                  fileHash: fileInfo.data.hash,
                  fileName: fileInfo.data.fileName,
                  supportsTransfer: true
                }
              }
            }
          }
        }
        return skin
      })
    )

    const message = {
      type: 'skins-update',
      data: preparedSkins
    }

    // Update own skins in room
    if (this.isHost) {
      // Create new room object for React state update
      this.room = {
        ...this.room,
        host: { ...this.room.host, activeSkins: preparedSkins }
      }
      this.emit('room-updated', this.room)
      this.broadcastRoomUpdate()
    } else {
      // Send to host and other peers
      this.connections.forEach((conn) => {
        if (conn.open) {
          conn.send(message)
        }
      })
    }

    console.log(
      `[P2P] Broadcasting ${preparedSkins.length} active skins (filtered from ${skins.length})`
    )
  }

  async leaveRoom() {
    this.cleanup()
    this.emit('room-updated', null)
    this.emit('connection-status', 'disconnected')
  }

  private cleanup() {
    // Close all connections
    this.connections.forEach((conn) => conn.close())
    this.connections.clear()

    // Destroy peer
    if (this.peer) {
      this.peer.destroy()
      this.peer = null
    }

    this.room = null
    this.isHost = false
  }

  getRoom(): P2PRoom | null {
    return this.room
  }

  isConnected(): boolean {
    return this.peer !== null && !this.peer.destroyed
  }

  getCurrentPeerId(): string | null {
    return this.peer?.id || null
  }

  isCurrentUserHost(): boolean {
    return this.isHost
  }

  getConnectionToPeer(peerId: string): DataConnection | null {
    return this.connections.get(peerId) || null
  }
}

// Create singleton instance
export const p2pService = new P2PService()
