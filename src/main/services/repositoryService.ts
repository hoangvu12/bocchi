import axios from 'axios'
import { app } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { LEAGUESKINS_REPO } from '../types/repository.types'
import { championDataService } from './championDataService'

export class RepositoryService {
  private static instance: RepositoryService

  // skin_ids.json: maps skin/chroma ID → repo name
  private skinIdsMap: Map<string, string> = new Map()
  private skinIdsReverseMap: Map<string, string> = new Map()
  private skinIdsFetchPromise: Promise<void> | null = null

  private constructor() {
    // Fetch skin IDs in background
    this.fetchSkinIds()
  }

  /**
   * Fetches skin_ids.json from the LeagueSkins repo and caches it
   */
  async fetchSkinIds(): Promise<void> {
    // Deduplicate concurrent calls
    if (this.skinIdsFetchPromise) return this.skinIdsFetchPromise

    this.skinIdsFetchPromise = this.fetchSkinIdsInternal()
    try {
      await this.skinIdsFetchPromise
    } finally {
      this.skinIdsFetchPromise = null
    }
  }

  private async fetchSkinIdsInternal(): Promise<void> {
    const cacheDir = path.join(app.getPath('userData'), 'champion-data')
    const cachePath = path.join(cacheDir, 'skin-ids.json')

    // Try loading from disk cache first
    try {
      if (existsSync(cachePath)) {
        const raw = await fs.readFile(cachePath, 'utf-8')
        const data = JSON.parse(raw) as Record<string, string>
        this.buildSkinIdsMaps(data)
        console.log(`[SkinIds] Loaded ${this.skinIdsMap.size} entries from disk cache`)
      }
    } catch {
      // Cache read failed, will fetch from network
    }

    // Fetch fresh data from GitHub
    try {
      const url =
        'https://raw.githubusercontent.com/Alban1911/LeagueSkins/refs/heads/main/resources/en/skin_ids.json'
      const response = await axios.get<Record<string, string>>(url, { timeout: 15000 })
      const data = response.data
      this.buildSkinIdsMaps(data)

      // Save to disk
      try {
        if (!existsSync(cacheDir)) {
          await fs.mkdir(cacheDir, { recursive: true })
        }
        await fs.writeFile(cachePath, JSON.stringify(data), 'utf-8')
      } catch (err) {
        console.error('[SkinIds] Failed to save to disk:', err)
      }

      console.log(`[SkinIds] Fetched ${this.skinIdsMap.size} entries from GitHub`)
    } catch (err) {
      if (this.skinIdsMap.size > 0) {
        console.warn('[SkinIds] Network fetch failed, using disk cache')
      } else {
        console.error('[SkinIds] Failed to fetch skin_ids.json:', err)
      }
    }
  }

  private buildSkinIdsMaps(data: Record<string, string>): void {
    this.skinIdsMap.clear()
    this.skinIdsReverseMap.clear()
    for (const [id, name] of Object.entries(data)) {
      this.skinIdsMap.set(id, name)
      this.skinIdsReverseMap.set(name, id)
    }
  }

  /**
   * Look up a skin/chroma name by its Riot ID from skin_ids.json
   */
  getSkinNameById(id: string): string | null {
    return this.skinIdsMap.get(id) || null
  }

  /**
   * Reverse lookup: get the Riot ID for a skin/chroma name from skin_ids.json
   */
  getSkinIdByName(name: string): string | null {
    return this.skinIdsReverseMap.get(name) || null
  }

  /**
   * Ensures skin IDs are loaded before using them
   */
  async ensureSkinIds(): Promise<void> {
    if (this.skinIdsMap.size === 0) {
      await this.fetchSkinIds()
    }
  }

  static getInstance(): RepositoryService {
    if (!RepositoryService.instance) {
      RepositoryService.instance = new RepositoryService()
    }
    return RepositoryService.instance
  }

  constructGitHubUrl(
    championName: string,
    skinFile: string,
    _isChroma?: boolean,
    _chromaBase?: string,
    championId?: number
  ): string {
    const { owner, repo, branch, skinsPath } = LEAGUESKINS_REPO
    const baseUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${skinsPath}`

    // Check if this is a chroma (has 4-6 digit numeric ID at end of filename)
    const chromaMatch = skinFile.match(/^(.+?)\s+(\d{4,6})\.zip$/i)
    if (chromaMatch) {
      const chromaId = chromaMatch[2]
      const baseSkinName = chromaMatch[1]

      // Look up chroma name from skin_ids.json
      const chromaName = this.getSkinNameById(chromaId)
      if (chromaName) {
        return `${baseUrl}/${encodeURIComponent(championName)}/${encodeURIComponent(baseSkinName)}/${encodeURIComponent(chromaName)}/${encodeURIComponent(chromaName)}.zip`
      }

      // Fallback: try constructing from champion data
      if (championId) {
        const champion = championDataService.getChampionByIdSync(championId)
        if (champion) {
          for (const skin of champion.skins) {
            if (skin.chromas && skin.chromaList) {
              const chroma = skin.chromaList.find((c) => c.id.toString() === chromaId)
              if (chroma) {
                const fullChromaName = `${skin.nameEn || skin.name} (${chroma.name})`
                return `${baseUrl}/${encodeURIComponent(championName)}/${encodeURIComponent(skin.nameEn || skin.name)}/${encodeURIComponent(fullChromaName)}/${encodeURIComponent(fullChromaName)}.zip`
              }
            }
          }
        }
      }

      console.warn(
        `[LeagueSkins URL] Chroma ${chromaId} not found in skin_ids.json or champion data`
      )
    }

    // Regular skin - nested: skins/{champion}/{skinName}/{skinName}.zip
    const skinName = skinFile.replace(/\.zip$/i, '')
    return `${baseUrl}/${encodeURIComponent(championName)}/${encodeURIComponent(skinName)}/${encodeURIComponent(skinFile)}`
  }

  constructRawUrl(url: string): string {
    return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
  }

  parseGitHubUrl(
    url: string
  ): { owner: string; repo: string; branch: string; path: string } | null {
    const patterns = [
      /github\.com\/([^/]+)\/([^/]+)\/(blob|raw)\/([^/]+)\/(.+)$/,
      /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        if (url.includes('raw.githubusercontent.com')) {
          return {
            owner: match[1],
            repo: match[2],
            branch: match[3],
            path: match[4]
          }
        } else {
          return {
            owner: match[1],
            repo: match[2],
            branch: match[4],
            path: match[5]
          }
        }
      }
    }

    return null
  }
}

// Export singleton instance
export const repositoryService = RepositoryService.getInstance()
