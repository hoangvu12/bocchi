import { app } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import {
  fetchLatestVersion,
  fetchChampionData as fetchFromApis,
  type Champion,
  type Skin
} from './championFetcher'

export type { Champion, Skin }

interface CachedFile {
  version: string
  champions: Champion[]
}

export class ChampionDataService {
  private cachedData: Map<string, { version: string; champions: Champion[] }> = new Map()
  private championIdCache: Map<string, Map<number, Champion>> = new Map()
  private championNameCache: Map<string, Map<string, Champion>> = new Map()
  private pendingLoads: Map<string, Promise<{ version: string; champions: Champion[] } | null>> =
    new Map()

  private getCacheDir(): string {
    return path.join(app.getPath('userData'), 'champion-data')
  }

  private getCacheFilePath(language: string): string {
    return path.join(this.getCacheDir(), `champion-data-${language}.json`)
  }

  private async ensureCacheDir(): Promise<void> {
    const dir = this.getCacheDir()
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true })
    }
  }

  private async loadFromDisk(language: string): Promise<CachedFile | null> {
    try {
      const filePath = this.getCacheFilePath(language)
      if (!existsSync(filePath)) return null
      const raw = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(raw) as CachedFile
    } catch {
      return null
    }
  }

  private async saveToDisk(language: string, data: CachedFile): Promise<void> {
    try {
      await this.ensureCacheDir()
      const filePath = this.getCacheFilePath(language)
      await fs.writeFile(filePath, JSON.stringify(data), 'utf-8')
    } catch (err) {
      console.error('Failed to save champion data to disk:', err)
    }
  }

  public async fetchAndSaveChampionData(
    language: string = 'en_US'
  ): Promise<{ success: boolean; message: string; championCount?: number }> {
    try {
      // Clear caches
      this.cachedData.delete(language)
      this.championIdCache.delete(language)
      this.championNameCache.delete(language)

      console.log(`[ChampionData] Fetching data for ${language} from APIs...`)

      const data = await fetchFromApis(language)

      // Cache in memory
      this.cachedData.set(language, data)

      // Save to disk
      await this.saveToDisk(language, data)

      console.log(
        `[ChampionData] Fetched ${data.champions.length} champions (v${data.version}) for ${language}`
      )

      return {
        success: true,
        message: `Successfully fetched data for ${data.champions.length} champions`,
        championCount: data.champions.length
      }
    } catch (error) {
      console.error('Error fetching champion data:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch champion data'
      }
    }
  }

  public async loadChampionData(
    language: string = 'en_US'
  ): Promise<{ version: string; champions: Champion[] } | null> {
    // Check memory cache
    const cached = this.cachedData.get(language)
    if (cached) return cached

    // Deduplicate concurrent loads for the same language
    const pending = this.pendingLoads.get(language)
    if (pending) return pending

    const loadPromise = this.loadChampionDataInternal(language)
    this.pendingLoads.set(language, loadPromise)

    try {
      return await loadPromise
    } finally {
      this.pendingLoads.delete(language)
    }
  }

  private async loadChampionDataInternal(
    language: string
  ): Promise<{ version: string; champions: Champion[] } | null> {
    // Check disk cache
    const diskData = await this.loadFromDisk(language)
    if (diskData) {
      // Check if version is still current
      try {
        const latestVersion = await fetchLatestVersion()
        if (diskData.version === latestVersion) {
          this.cachedData.set(language, diskData)
          console.log(`[ChampionData] Loaded ${language} from disk cache (v${diskData.version})`)
          return diskData
        }
        console.log(
          `[ChampionData] Disk cache outdated (${diskData.version} vs ${latestVersion}), refetching...`
        )
      } catch {
        // If version check fails, use disk cache anyway
        this.cachedData.set(language, diskData)
        console.log(`[ChampionData] Version check failed, using disk cache for ${language}`)
        return diskData
      }
    }

    // Fetch fresh data
    const result = await this.fetchAndSaveChampionData(language)
    if (result.success) {
      return this.cachedData.get(language) || null
    }

    return null
  }

  public async getChampionById(
    championId: string,
    language: string = 'en_US'
  ): Promise<Champion | null> {
    const data = await this.loadChampionData(language)
    if (!data) return null
    return (
      data.champions.find((c) => c.id.toString() === championId || c.key === championId) || null
    )
  }

  public async getChampionByKey(
    championKey: string,
    language: string = 'en_US'
  ): Promise<Champion | null> {
    return this.getChampionById(championKey, language)
  }

  public async checkForUpdates(language: string = 'en_US'): Promise<boolean> {
    try {
      const currentData = this.cachedData.get(language)
      if (!currentData) return true
      const latestVersion = await fetchLatestVersion()
      return currentData.version !== latestVersion
    } catch {
      return true
    }
  }

  public async fetchAllLanguages(): Promise<{ success: boolean; message: string }> {
    // This is no longer needed since we only fetch the user's current language
    // Keep for backward compat but just return success
    return { success: true, message: 'Use fetchAndSaveChampionData with a specific language' }
  }

  private buildChampionIdCache(language: string, champions: Champion[]): void {
    const idCache = new Map<number, Champion>()
    const nameCache = new Map<string, Champion>()

    champions.forEach((champion) => {
      idCache.set(champion.id, champion)
      nameCache.set(champion.name.toLowerCase(), champion)
      nameCache.set(champion.key.toLowerCase(), champion)
      if (champion.nameEn) {
        nameCache.set(champion.nameEn.toLowerCase(), champion)
      }
    })

    this.championIdCache.set(language, idCache)
    this.championNameCache.set(language, nameCache)
  }

  public async getChampionByNumericId(
    championId: number,
    language: string = 'en_US'
  ): Promise<Champion | null> {
    const data = await this.loadChampionData(language)
    if (!data) return null

    if (!this.championIdCache.has(language)) {
      this.buildChampionIdCache(language, data.champions)
    }

    return this.championIdCache.get(language)?.get(championId) || null
  }

  public async getSkinByIds(
    championId: number,
    skinId: string,
    language: string = 'en_US'
  ): Promise<Skin | null> {
    const champion = await this.getChampionByNumericId(championId, language)
    if (!champion) return null
    return champion.skins.find((s) => s.id === skinId || s.num.toString() === skinId) || null
  }

  public async getChampionNameById(
    championId: number,
    language: string = 'en_US'
  ): Promise<string | null> {
    const champion = await this.getChampionByNumericId(championId, language)
    return champion ? champion.name : null
  }

  public clearIdCache(): void {
    this.championIdCache.clear()
    this.championNameCache.clear()
  }

  public getChampionByNameSync(championName: string, language: string = 'en_US'): Champion | null {
    const data = this.cachedData.get(language)
    if (!data) return null

    if (!this.championNameCache.has(language)) {
      this.buildChampionIdCache(language, data.champions)
    }

    return this.championNameCache.get(language)?.get(championName.toLowerCase()) || null
  }

  public getChampionByIdSync(championId: number, language: string = 'en_US'): Champion | null {
    const data = this.cachedData.get(language)
    if (!data) {
      console.warn(
        `[ChampionData] getChampionByIdSync: No data loaded for language ${language}. Champion ID: ${championId}`
      )
      return null
    }

    if (!this.championIdCache.has(language)) {
      this.buildChampionIdCache(language, data.champions)
    }

    const champion = this.championIdCache.get(language)?.get(championId) || null
    if (!champion) {
      console.warn(
        `[ChampionData] getChampionByIdSync: Champion not found for ID ${championId}, language ${language}`
      )
    }

    return champion
  }
}

// Singleton instance
export const championDataService = new ChampionDataService()
