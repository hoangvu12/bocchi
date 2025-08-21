import Peer, { DataConnection } from 'peerjs'
import type { P2PRoom, P2PRoomMember } from '../../../main/types'
import type { SelectedSkin } from '../store/atoms'
import { p2pFileTransferService } from './p2pFileTransferService'
import { iceServerManager } from './iceServerManager'

export class P2PService {
  private peer: Peer | null = null
  private room: P2PRoom | null = null
  private connections: Map<string, DataConnection> = new Map()
  private isHost: boolean = false
  private eventCallbacks: Map<string, ((data: any) => void)[]> = new Map()
  private connectionAttempts: number = 0
  private maxRetries: number = 3
  private retryTimeout: NodeJS.Timeout | null = null
  private connectionStartTime: number = 0
  private connectionType: 'direct' | 'relay' | 'unknown' = 'unknown'

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

      // Initialize peer with room ID as peer ID and ICE servers configuration
      const iceConfig = iceServerManager.getICEServers()
      this.peer = new Peer(roomId, {
        config: iceConfig,
        debug: 2 // Enable debug logging to help diagnose connection issues
      })
      this.connectionStartTime = Date.now()

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

        this.peer!.on('error', async (err) => {
          console.error('[P2P] Error creating room:', err)
          // Try retry logic for recoverable errors
          if (this.connectionAttempts < this.maxRetries) {
            await this.retryConnection(roomId, displayName, true)
            resolve()
          } else {
            reject(err)
          }
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

      // Initialize peer with ICE servers configuration
      const iceConfig = iceServerManager.getICEServers()
      this.peer = new Peer(peerId, {
        config: iceConfig,
        debug: 2 // Enable debug logging to help diagnose connection issues
      })
      this.connectionStartTime = Date.now()

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

          conn.on('open', async () => {
            console.log(`[P2P] Connected to room: ${roomId}`)
            this.connections.set(roomId, conn)

            // Detect connection type
            this.connectionType = await this.detectConnectionType(conn)

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

          conn.on('error', async (err) => {
            console.error('[P2P] Connection error:', err)
            // Try retry logic for recoverable errors
            if (this.connectionAttempts < this.maxRetries) {
              await this.retryConnection(roomId, displayName, false)
              resolve()
            } else {
              reject(err)
            }
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

    conn.on('open', async () => {
      // Detect connection type (direct or relay)
      this.connectionType = await this.detectConnectionType(conn)
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

      case 'champion-selected':
        // Peer selected a champion
        // eslint-disable-next-line no-case-declarations
        const championData = message.data as {
          id: number
          key: string
          name: string
          isLocked: boolean
        }

        if (this.room) {
          if (this.isHost) {
            // Host updates member champion selection
            const memberIndex = this.room.members.findIndex((m) => m.id === peerId)
            if (memberIndex !== -1) {
              this.room = {
                ...this.room,
                members: this.room.members.map((m, i) =>
                  i === memberIndex ? { ...m, selectedChampion: championData } : m
                )
              }
              this.broadcastRoomUpdate()
              this.emit('room-updated', this.room)
            }
          } else {
            // Non-host updates their view
            if (this.room.host.id === peerId) {
              // Host selected a champion
              this.room = {
                ...this.room,
                host: { ...this.room.host, selectedChampion: championData }
              }
            } else {
              // Another member selected a champion
              const memberIndex = this.room.members.findIndex((m) => m.id === peerId)
              if (memberIndex !== -1) {
                this.room = {
                  ...this.room,
                  members: this.room.members.map((m, i) =>
                    i === memberIndex ? { ...m, selectedChampion: championData } : m
                  )
                }
              }
            }
            this.emit('room-updated', this.room)
          }

          this.emit('peer-champion-selected', { peerId, championData })
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

  async broadcastChampionSelection(champion: {
    id: number
    key: string
    name: string
    isLocked: boolean
  }) {
    if (!this.peer || !this.room) return

    const message = {
      type: 'champion-selected',
      data: champion
    }

    // Update own champion selection in room
    if (this.isHost) {
      // Create new room object for React state update
      this.room = {
        ...this.room,
        host: { ...this.room.host, selectedChampion: champion }
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

    console.log(`[P2P] Broadcasting champion selection:`, champion)
  }

  async leaveRoom() {
    this.cleanup()
    this.emit('room-updated', null)
    this.emit('connection-status', 'disconnected')
  }

  private cleanup() {
    // Clear any pending retry timeouts
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
      this.retryTimeout = null
    }

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
    this.connectionAttempts = 0
    this.connectionType = 'unknown'
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

  /**
   * Retry connection with exponential backoff
   */
  private async retryConnection(roomId: string, displayName: string, isCreating: boolean) {
    if (this.connectionAttempts >= this.maxRetries) {
      this.emit('connection-failed', {
        reason: 'max_retries_exceeded',
        attempts: this.connectionAttempts,
        message:
          'Unable to establish connection after multiple attempts. Please check your network settings.'
      })
      return
    }

    this.connectionAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts - 1), 10000)

    console.log(
      `[P2P] Retrying connection (attempt ${this.connectionAttempts}/${this.maxRetries}) in ${delay}ms`
    )
    this.emit('connection-status', 'retrying')

    this.retryTimeout = setTimeout(async () => {
      try {
        if (isCreating) {
          await this.createRoom(displayName)
        } else {
          await this.joinRoom(roomId, displayName)
        }
      } catch (error) {
        console.error('[P2P] Retry failed:', error)
        await this.retryConnection(roomId, displayName, isCreating)
      }
    }, delay)
  }

  /**
   * Detect connection type (direct or relay)
   * This helps users understand their connection quality
   */
  async detectConnectionType(conn: DataConnection): Promise<'direct' | 'relay'> {
    try {
      // Access the underlying RTCPeerConnection
      const pc = (conn as any).peerConnection as RTCPeerConnection

      if (!pc) {
        return 'relay'
      }

      const stats = await pc.getStats()
      let connectionType: 'direct' | 'relay' = 'direct'

      stats.forEach((report: any) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const localCandidate = stats.get(report.localCandidateId)
          const remoteCandidate = stats.get(report.remoteCandidateId)

          // Check if either candidate is a relay candidate
          if (
            (localCandidate as any)?.candidateType === 'relay' ||
            (remoteCandidate as any)?.candidateType === 'relay'
          ) {
            connectionType = 'relay'
          }
        }
      })

      const connectionTime = Date.now() - this.connectionStartTime
      console.log(`[P2P] Connection established via ${connectionType} in ${connectionTime}ms`)

      // Report metrics to ICE server manager
      const iceServers = iceServerManager.getICEServers().iceServers
      if ((connectionType as string) === 'relay' && iceServers.length > 0) {
        const turnServer = iceServers.find((s) => s.urls.toString().includes('turn:'))
        if (turnServer) {
          const url = Array.isArray(turnServer.urls) ? turnServer.urls[0] : turnServer.urls
          iceServerManager.reportConnectionResult(url, true, connectionTime)
        }
      }

      return connectionType
    } catch (error) {
      console.error('[P2P] Failed to detect connection type:', error)
      return 'relay'
    }
  }

  /**
   * Get connection quality metrics
   */
  async getConnectionQuality(peerId?: string): Promise<{
    type: 'direct' | 'relay' | 'unknown'
    latency: number
    packetLoss: number
    bandwidth: number
  } | null> {
    try {
      let conn: DataConnection | null = null

      if (peerId) {
        conn = this.connections.get(peerId) || null
      } else if (this.connections.size > 0) {
        conn = this.connections.values().next().value || null
      }

      if (!conn) {
        return null
      }

      const pc = (conn as any).peerConnection as RTCPeerConnection
      if (!pc) {
        return null
      }

      const stats = await pc.getStats()
      const quality = {
        type: this.connectionType,
        latency: 0,
        packetLoss: 0,
        bandwidth: 0
      }

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          quality.latency = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0

          if (report.availableOutgoingBitrate) {
            quality.bandwidth = report.availableOutgoingBitrate / 1000000 // Convert to Mbps
          }
        }

        if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
          const packetsLost = report.packetsLost || 0
          const packetsReceived = report.packetsReceived || 0
          if (packetsReceived > 0) {
            quality.packetLoss = (packetsLost / (packetsLost + packetsReceived)) * 100
          }
        }
      })

      return quality
    } catch (error) {
      console.error('[P2P] Failed to get connection quality:', error)
      return null
    }
  }

  /**
   * Test NAT type to help diagnose connection issues
   */
  async detectNATType(): Promise<string> {
    try {
      // Create a temporary peer connection for NAT detection
      const pc = new RTCPeerConnection({
        iceServers: iceServerManager.getICEServers().iceServers
      })

      const candidates: RTCIceCandidate[] = []

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          pc.close()
          resolve(this.analyzeNATType(candidates))
        }, 5000)

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            candidates.push(event.candidate)
          } else {
            clearTimeout(timeout)
            pc.close()
            resolve(this.analyzeNATType(candidates))
          }
        }

        // Create a data channel to trigger ICE gathering
        pc.createDataChannel('natDetection')
        pc.createOffer().then((offer) => pc.setLocalDescription(offer))
      })
    } catch (error) {
      console.error('[P2P] NAT detection failed:', error)
      return 'Unknown'
    }
  }

  /**
   * Analyze gathered ICE candidates to determine NAT type
   */
  private analyzeNATType(candidates: RTCIceCandidate[]): string {
    const srflxCandidates = candidates.filter((c) => c.type === 'srflx')
    const relayCandidates = candidates.filter((c) => c.type === 'relay')

    if (srflxCandidates.length === 0 && relayCandidates.length > 0) {
      return 'Symmetric NAT (Most Restrictive - TURN Required)'
    } else if (srflxCandidates.length > 0) {
      // Check if all srflx candidates have the same port
      const ports = new Set(srflxCandidates.map((c) => c.port))
      if (ports.size === 1) {
        return 'Full Cone NAT (Least Restrictive)'
      } else if (ports.size === srflxCandidates.length) {
        return 'Symmetric NAT (Most Restrictive - TURN Required)'
      } else {
        return 'Restricted/Port Restricted NAT (Moderate)'
      }
    }

    return 'Unknown NAT Type'
  }

  /**
   * Get connection statistics for monitoring
   */
  getConnectionStats() {
    return {
      isConnected: this.isConnected(),
      connectionType: this.connectionType,
      activeConnections: this.connections.size,
      connectionAttempts: this.connectionAttempts,
      isHost: this.isHost,
      roomId: this.room?.id || null
    }
  }
}

// Create singleton instance
export const p2pService = new P2PService()
