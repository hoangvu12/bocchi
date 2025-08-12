import { API_CONFIG } from '../config/api.config'
import { HttpService } from './http.service'

export class VersionService {
  private static cachedVersion: string | null = null
  private static versionCacheTime: number = 0

  static async getLatestVersion(): Promise<string> {
    const now = Date.now()

    if (this.cachedVersion && now - this.versionCacheTime < API_CONFIG.VERSION_CACHE_DURATION) {
      return this.cachedVersion
    }

    const versions = await HttpService.get<string[]>(
      `${API_CONFIG.DDRAGON_BASE_URL}/api/versions.json`
    )

    this.cachedVersion = versions[0]
    this.versionCacheTime = now

    return this.cachedVersion
  }
}
