import { PERFORMANCE_CONFIG } from '../config/performance.config'

export class OptimizedHttpService {
  private static requestCount = 0
  private static startTime = Date.now()
  private static activeRequests = 0
  private static maxConcurrentRequests = 0

  static async get<T>(url: string): Promise<T> {
    this.requestCount++
    this.activeRequests++
    this.maxConcurrentRequests = Math.max(this.maxConcurrentRequests, this.activeRequests)

    try {
      for (let attempt = 0; attempt <= PERFORMANCE_CONFIG.RETRY_ATTEMPTS; attempt++) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), PERFORMANCE_CONFIG.HTTP_TIMEOUT)

          const response = await fetch(url, {
            signal: controller.signal,
            // keepalive helps with connection reuse
            keepalive: true
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const data = (await response.json()) as T
          return data
        } catch (error: any) {
          if (attempt === PERFORMANCE_CONFIG.RETRY_ATTEMPTS) {
            throw error
          }
          // Minimal delay for CDN retries
          await this.delay(
            PERFORMANCE_CONFIG.RETRY_DELAY * Math.pow(PERFORMANCE_CONFIG.RETRY_MULTIPLIER, attempt)
          )
        }
      }

      throw new Error('Max retries exceeded')
    } finally {
      this.activeRequests--
    }
  }

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  static getMetrics() {
    const elapsed = (Date.now() - this.startTime) / 1000
    return {
      totalRequests: this.requestCount,
      requestsPerSecond: this.requestCount / elapsed,
      elapsedTime: elapsed,
      maxConcurrentRequests: this.maxConcurrentRequests,
      currentActiveRequests: this.activeRequests
    }
  }

  static async cleanup() {
    // Wait for all active requests to complete
    while (this.activeRequests > 0) {
      await this.delay(100)
    }
  }

  static resetMetrics() {
    this.requestCount = 0
    this.startTime = Date.now()
  }
}
