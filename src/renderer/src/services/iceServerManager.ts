/**
 * ICE Server Manager for P2P connections
 * Manages STUN/TURN servers with fallback strategies using only free options
 */

export interface ICEServer {
  urls: string | string[]
  username?: string
  credential?: string
}

export interface ICEServerConfig {
  iceServers: ICEServer[]
  iceTransportPolicy?: 'all' | 'relay'
}

interface ServerHealth {
  url: string
  lastSuccess?: Date
  lastFailure?: Date
  successCount: number
  failureCount: number
  averageResponseTime: number
}

class ICEServerManager {
  private static instance: ICEServerManager
  private serverHealth: Map<string, ServerHealth> = new Map()
  private customServers: ICEServer[] = []

  private constructor() {
    this.loadServerHealth()
    this.loadCustomServers()
  }

  static getInstance(): ICEServerManager {
    if (!ICEServerManager.instance) {
      ICEServerManager.instance = new ICEServerManager()
    }
    return ICEServerManager.instance
  }

  /**
   * Get ICE server configuration with fallback options
   * Uses a tiered approach: Custom servers > Free TURN > STUN only
   */
  getICEServers(): ICEServerConfig {
    const servers: ICEServer[] = []

    // 1. Add custom servers if configured (for users who self-host)
    if (this.customServers.length > 0) {
      servers.push(...this.customServers)
    }

    // 2. Add free TURN servers
    servers.push(...this.getFreeTURNServers())

    // 3. Always add STUN servers (these are always free)
    servers.push(...this.getFreeSTUNServers())

    return {
      iceServers: this.prioritizeServers(servers),
      iceTransportPolicy: 'all' // Use both direct and relay connections
    }
  }

  /**
   * Get free TURN servers
   * These are community-provided and may have limitations
   */
  private getFreeTURNServers(): ICEServer[] {
    const turnServers: ICEServer[] = []

    // OpenRelay Project (Metered) - Free public TURN server
    // Note: This is best-effort and may have rate limits
    turnServers.push({
      urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    })

    // Add TCP protocol as fallback for restrictive firewalls
    turnServers.push({
      urls: 'turn:openrelay.metered.ca:80?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    })

    turnServers.push({
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    })

    // Note: We could add Metered's free tier here if the user provides their own API key
    // This would give them 50GB/month of reliable TURN service
    const meteredApiKey = this.getMeteredApiKey()
    if (meteredApiKey) {
      turnServers.push({
        urls: 'turn:a.relay.metered.ca:80',
        username: meteredApiKey,
        credential: meteredApiKey
      })
      turnServers.push({
        urls: 'turn:a.relay.metered.ca:80?transport=tcp',
        username: meteredApiKey,
        credential: meteredApiKey
      })
      turnServers.push({
        urls: 'turn:a.relay.metered.ca:443',
        username: meteredApiKey,
        credential: meteredApiKey
      })
    }

    return turnServers
  }

  /**
   * Get free STUN servers
   * These are widely available and help with NAT discovery
   */
  private getFreeSTUNServers(): ICEServer[] {
    return [
      // Google's public STUN servers (most reliable, always available)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },

      // OpenRelay STUN (from Metered.ca)
      { urls: 'stun:openrelay.metered.ca:80' },

      // Cloudflare STUN (very reliable)
      { urls: 'stun:stun.cloudflare.com:3478' },

      // Additional working public STUN servers
      { urls: 'stun:stun.stunprotocol.org:3478' }
    ]
  }

  /**
   * Prioritize servers based on health metrics
   * Healthy servers that worked recently are prioritized
   */
  private prioritizeServers(servers: ICEServer[]): ICEServer[] {
    return servers.sort((a, b) => {
      const urlA = Array.isArray(a.urls) ? a.urls[0] : a.urls
      const urlB = Array.isArray(b.urls) ? b.urls[0] : b.urls

      const healthA = this.serverHealth.get(urlA)
      const healthB = this.serverHealth.get(urlB)

      if (!healthA && !healthB) return 0
      if (!healthA) return 1
      if (!healthB) return -1

      // Prioritize servers with recent success
      if (healthA.lastSuccess && healthB.lastSuccess) {
        return healthB.lastSuccess.getTime() - healthA.lastSuccess.getTime()
      }

      // Then by success rate
      const successRateA = healthA.successCount / (healthA.successCount + healthA.failureCount)
      const successRateB = healthB.successCount / (healthB.successCount + healthB.failureCount)

      return successRateB - successRateA
    })
  }

  /**
   * Report connection result to update server health metrics
   */
  reportConnectionResult(serverUrl: string, success: boolean, responseTime?: number) {
    const health = this.serverHealth.get(serverUrl) || {
      url: serverUrl,
      successCount: 0,
      failureCount: 0,
      averageResponseTime: 0
    }

    if (success) {
      health.lastSuccess = new Date()
      health.successCount++
      if (responseTime) {
        health.averageResponseTime =
          (health.averageResponseTime * (health.successCount - 1) + responseTime) /
          health.successCount
      }
    } else {
      health.lastFailure = new Date()
      health.failureCount++
    }

    this.serverHealth.set(serverUrl, health)
    this.saveServerHealth()
  }

  /**
   * Add custom TURN/STUN servers (for users who self-host)
   */
  setCustomServers(servers: ICEServer[]) {
    this.customServers = servers
    this.saveCustomServers()
  }

  /**
   * Get Metered API key if user has configured one
   * This gives them 50GB/month of reliable TURN service
   */
  private getMeteredApiKey(): string | null {
    // This would be retrieved from user settings
    // Users can sign up for free at metered.ca
    return localStorage.getItem('metered_api_key')
  }

  /**
   * Set Metered API key for reliable TURN service
   */
  setMeteredApiKey(apiKey: string) {
    localStorage.setItem('metered_api_key', apiKey)
  }

  /**
   * Load server health metrics from storage
   */
  private loadServerHealth() {
    try {
      const saved = localStorage.getItem('ice_server_health')
      if (saved) {
        const data = JSON.parse(saved)
        this.serverHealth = new Map(
          data.map((item: any) => [
            item.url,
            {
              ...item,
              lastSuccess: item.lastSuccess ? new Date(item.lastSuccess) : undefined,
              lastFailure: item.lastFailure ? new Date(item.lastFailure) : undefined
            }
          ])
        )
      }
    } catch (error) {
      console.error('Failed to load server health:', error)
    }
  }

  /**
   * Save server health metrics to storage
   */
  private saveServerHealth() {
    try {
      const data = Array.from(this.serverHealth.values())
      localStorage.setItem('ice_server_health', JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save server health:', error)
    }
  }

  /**
   * Load custom servers from storage
   */
  private loadCustomServers() {
    try {
      const saved = localStorage.getItem('custom_ice_servers')
      if (saved) {
        this.customServers = JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load custom servers:', error)
    }
  }

  /**
   * Save custom servers to storage
   */
  private saveCustomServers() {
    try {
      localStorage.setItem('custom_ice_servers', JSON.stringify(this.customServers))
    } catch (error) {
      console.error('Failed to save custom servers:', error)
    }
  }
}

export const iceServerManager = ICEServerManager.getInstance()
