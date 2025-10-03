interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class LCURequestManager {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private inFlightRequests: Map<string, Promise<any>> = new Map()
  private defaultTTL = 500
  private requestCounts: Map<string, number> = new Map()
  private cacheHits = 0
  private cacheMisses = 0

  async request<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    // Check cache
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      this.cacheHits++
      return cached.data
    }

    // Deduplicate in-flight requests
    const inFlight = this.inFlightRequests.get(key)
    if (inFlight) {
      return inFlight
    }

    // Make request
    this.cacheMisses++
    const promise = requestFn()
    this.inFlightRequests.set(key, promise)

    try {
      const data = await promise
      this.cache.set(key, { data, timestamp: Date.now(), ttl })
      this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1)
      return data
    } finally {
      this.inFlightRequests.delete(key)
    }
  }

  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
    } else {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) this.cache.delete(key)
      }
    }
  }

  getMetrics() {
    return {
      totalRequests: Array.from(this.requestCounts.values()).reduce((a, b) => a + b, 0),
      cacheHitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      requestsByEndpoint: Object.fromEntries(this.requestCounts),
      cacheSize: this.cache.size
    }
  }
}

export const lcuRequestManager = new LCURequestManager()
