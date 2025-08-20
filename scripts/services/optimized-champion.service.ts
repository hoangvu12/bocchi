import pLimit from 'p-limit'
import { API_CONFIG } from '../config/api.config'
import { PERFORMANCE_CONFIG } from '../config/performance.config'
import { Champion, Chroma, Skin } from '../types/champion.types'
import { CDragonChampion } from '../types/cdragon.types'
import { OptimizedHttpService } from './optimized-http.service'
import { normalizeLocale } from '../utils/locale.utils'
import { buildChampionNameLookup } from '../utils/champion-lookup.utils'
import { SkinProcessor } from '../processors/skin.processor'
import { SPECIAL_SKIN_VARIANTS } from '../data/skin-variants.data'
import { findChampionFolder } from '../../src/main/utils/skinNameMatcher'

export class OptimizedChampionService {
  // Aggressive concurrency for CDN
  private readonly limit = pLimit(PERFORMANCE_CONFIG.CHAMPION_CONCURRENCY_PER_LANGUAGE)

  // Cache for champion list (same across all languages)
  private static championListCache: Record<string, any> | null = null
  private static championListVersion: string | null = null

  async fetchChampionList(version: string, language: string): Promise<Record<string, any>> {
    // Use cached champion list if available and version matches
    if (
      PERFORMANCE_CONFIG.USE_CHAMPION_LIST_CACHE &&
      OptimizedChampionService.championListCache &&
      OptimizedChampionService.championListVersion === version
    ) {
      console.log(`Using cached champion list for ${language}`)
      return OptimizedChampionService.championListCache
    }

    const listUrl = `${API_CONFIG.DDRAGON_BASE_URL}/cdn/${version}/data/${language}/champion.json`
    const response = await OptimizedHttpService.get<any>(listUrl)

    // Cache the champion list
    if (PERFORMANCE_CONFIG.USE_CHAMPION_LIST_CACHE) {
      OptimizedChampionService.championListCache = response.data
      OptimizedChampionService.championListVersion = version
    }

    return response.data
  }

  async fetchChampionDetail(
    championBasic: any,
    version: string,
    language: string,
    lolSkinsData: Map<string, any[]>,
    championNameLookup: Map<string, string>,
    englishSkinNames?: Map<string, string>,
    englishChampionName?: string
  ): Promise<{ champion: Champion; chromaData: Record<string, Chroma[]> }> {
    const championId = parseInt(championBasic.key)
    const locale = normalizeLocale(language)
    const detailUrl = `${API_CONFIG.CDRAGON_BASE_URL.replace('/default/', `/${locale}/`)}/champions/${championId}.json`

    try {
      const detailData = await OptimizedHttpService.get<CDragonChampion>(detailUrl)
      return this.processChampionData(
        detailData,
        championId,
        version,
        language,
        lolSkinsData,
        championNameLookup,
        englishSkinNames,
        englishChampionName
      )
    } catch (error: any) {
      // Fallback to default locale if locale-specific request fails
      if (locale !== 'default' && error.message?.includes('404')) {
        const fallbackUrl = `${API_CONFIG.CDRAGON_BASE_URL}/champions/${championId}.json`
        const detailData = await OptimizedHttpService.get<CDragonChampion>(fallbackUrl)

        return this.processChampionData(
          detailData,
          championId,
          version,
          language,
          lolSkinsData,
          championNameLookup,
          englishSkinNames
        )
      }
      throw error
    }
  }

  private processChampionData(
    detailData: CDragonChampion,
    championId: number,
    version: string,
    language: string,
    lolSkinsData: Map<string, any[]>,
    championNameLookup: Map<string, string>,
    englishSkinNames?: Map<string, string>,
    englishChampionName?: string
  ): { champion: Champion; chromaData: Record<string, Chroma[]> } {
    // Find champion folder - always use English name for matching if available
    const nameForLookup =
      englishChampionName || (language !== 'en_US' ? detailData.alias : detailData.name)
    const normalizedName = nameForLookup.toLowerCase()
    let championFolder = championNameLookup.get(normalizedName)

    if (!championFolder) {
      championFolder =
        findChampionFolder(nameForLookup, Array.from(lolSkinsData.keys())) || undefined
    }

    const lolSkinsList = championFolder ? lolSkinsData.get(championFolder) || [] : []
    const chromaData: Record<string, Chroma[]> = {}

    // Extract tags
    const tags: string[] = []
    if (detailData.championTagInfo.championTagPrimary) {
      tags.push(detailData.championTagInfo.championTagPrimary)
    }
    if (detailData.championTagInfo.championTagSecondary) {
      tags.push(detailData.championTagInfo.championTagSecondary)
    }

    // Process skins
    const skins: Skin[] = detailData.skins.flatMap((skin) => {
      // Check if this is a tiered skin
      if (skin.questSkinInfo?.productType === 'kTieredSkin' && skin.questSkinInfo.tiers) {
        return SkinProcessor.processTieredSkin(skin, championId, lolSkinsList, englishSkinNames)
      }

      // Process regular skin
      const processedSkin = SkinProcessor.processRegularSkin(
        skin,
        championId,
        detailData.name,
        detailData.alias,
        lolSkinsList,
        SPECIAL_SKIN_VARIANTS,
        englishSkinNames
      )

      // Add to chromaData if has chromas
      if (processedSkin.chromaList) {
        chromaData[processedSkin.id] = processedSkin.chromaList
      }

      return processedSkin
    })

    const champion: Champion = {
      id: championId,
      key: detailData.alias,
      name: detailData.name,
      title: detailData.title,
      image: `${API_CONFIG.DDRAGON_BASE_URL}/cdn/${version}/img/champion/${detailData.alias}.png`,
      tags: tags,
      skins: skins
    }

    return { champion, chromaData }
  }

  async fetchAllChampions(
    version: string,
    language: string,
    lolSkinsData: Map<string, any[]>,
    championFolders: string[],
    englishSkinNames?: Map<string, string>,
    onProgress?: (completed: number, total: number) => void,
    englishChampionNames?: Map<number, string>
  ): Promise<{ champions: Champion[]; allChromaData: Record<string, Chroma[]> }> {
    const championList = await this.fetchChampionList(version, language)
    const champions: Champion[] = []
    const allChromaData: Record<string, Chroma[]> = {}
    const championKeys = Object.keys(championList)
    const championNameLookup = buildChampionNameLookup(championFolders)

    // Update total count for progress tracking
    if (onProgress) {
      onProgress(0, championKeys.length)
    }

    let completed = 0

    // Process champions with aggressive parallelization for CDN
    const results = await Promise.all(
      championKeys.map((key) =>
        this.limit(async () => {
          try {
            const championId = parseInt(championList[key].key)
            const englishChampionName = englishChampionNames?.get(championId)
            const result = await this.fetchChampionDetail(
              championList[key],
              version,
              language,
              lolSkinsData,
              championNameLookup,
              englishSkinNames,
              englishChampionName
            )

            completed++
            if (onProgress) {
              onProgress(completed, championKeys.length)
            }

            return result
          } catch (error: any) {
            console.error(`Failed to fetch champion ${key} for ${language}:`, error.message)
            return null
          }
        })
      )
    )

    // Process results
    results.forEach((result) => {
      if (result) {
        champions.push(result.champion)
        Object.assign(allChromaData, result.chromaData)
      }
    })

    // Sort champions by name
    champions.sort((a, b) => a.name.localeCompare(b.name))

    return { champions, allChromaData }
  }

  static clearCache() {
    this.championListCache = null
    this.championListVersion = null
  }
}
