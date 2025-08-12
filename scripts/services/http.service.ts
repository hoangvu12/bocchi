import axios from 'axios'
import { API_CONFIG } from '../config/api.config'

export class HttpService {
  private static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  static async retryRequest<T>(
    fn: () => Promise<T>,
    retries: number = API_CONFIG.RETRY_ATTEMPTS,
    delayMs: number = API_CONFIG.RETRY_DELAY
  ): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      if (retries > 0) {
        await this.delay(delayMs)
        return this.retryRequest(fn, retries - 1, delayMs * 2)
      }
      throw error
    }
  }

  static async get<T>(url: string): Promise<T> {
    return this.retryRequest(async () => {
      const response = await axios.get<T>(url)
      return response.data
    })
  }
}
