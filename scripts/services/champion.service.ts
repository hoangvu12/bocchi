import pLimit from 'p-limit'
import { API_CONFIG } from '../config/api.config'
import { Champion, Chroma, Skin } from '../types/champion.types'
import { CDragonChampion } from '../types/cdragon.types'
import { HttpService } from './http.service'
import { normalizeLocale } from '../utils/locale.utils'
import { buildChampionNameLookup } from '../utils/champion-lookup.utils'
import { SkinProcessor } from '../processors/skin.processor'
import { SPECIAL_SKIN_VARIANTS } from '../data/skin-variants.data'
import { findChampionFolder } from '../../src/main/utils/skinNameMatcher'

export class ChampionService {
  private readonly limit = pLimit(API_CONFIG.CONCURRENT_REQUESTS)

  async fetchChampionList(version: string, language: string): Promise<Record<string, any>> {
    const listUrl = `${API_CONFIG.DDRAGON_BASE_URL}/cdn/${version}/data/${language}/champion.json`
    const response = await HttpService.get<any>(listUrl)
    return response.data
  }

  async fetchChampionDetail(
    championBasic: any,
    version: string,
    language: string,
    lolSkinsData: Map<string, any[]>,
    championNameLookup: Map<string, string>,
    englishSkinNames?: Map<string, string>
  ): Promise<{ champion: Champion; chromaData: Record<string, Chroma[]> }> {
    const championId = parseInt(championBasic.key)
    const locale = normalizeLocale(language)
    const detailUrl = `${API_CONFIG.CDRAGON_BASE_URL.replace('/default/', `/${locale}/`)}/champions/${championId}.json`

    try {
      const detailData = await HttpService.get<CDragonChampion>(detailUrl)
      return this.processChampionData(
        detailData,
        championId,
        version,
        language,
        lolSkinsData,
        championNameLookup,
        englishSkinNames
      )
    } catch (error: any) {
      // Fallback to default locale if locale-specific request fails
      if (locale !== 'default' && error.response?.status === 404) {
        console.warn(
          `Failed to fetch ${locale} data for ${championBasic.id}, falling back to default`
        )
        const fallbackUrl = `${API_CONFIG.CDRAGON_BASE_URL}/champions/${championId}.json`
        const detailData = await HttpService.get<CDragonChampion>(fallbackUrl)

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
    englishSkinNames?: Map<string, string>
  ): { champion: Champion; chromaData: Record<string, Chroma[]> } {
    // Find champion folder
    const nameForLookup = language !== 'en_US' ? detailData.alias : detailData.name
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
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ champions: Champion[]; allChromaData: Record<string, Chroma[]> }> {
    console.log(`Fetching champion data for ${language}...`)

    const championList = await this.fetchChampionList(version, language)
    const champions: Champion[] = []
    const allChromaData: Record<string, Chroma[]> = {}
    const championKeys = Object.keys(championList)
    const championNameLookup = buildChampionNameLookup(championFolders)

    // Process champions in parallel batches
    const results = await Promise.all(
      championKeys.map((key, index) =>
        this.limit(async () => {
          try {
            const result = await this.fetchChampionDetail(
              championList[key],
              version,
              language,
              lolSkinsData,
              championNameLookup,
              englishSkinNames
            )

            if (onProgress) {
              onProgress(index + 1, championKeys.length)
            }

            return result
          } catch (error: any) {
            console.error(`Failed to fetch champion ${key}:`, error.message)
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
}
