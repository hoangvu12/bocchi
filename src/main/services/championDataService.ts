import axios from 'axios'

interface Champion {
  id: number
  key: string
  name: string
  nameEn?: string
  title: string
  image: string
  skins: Skin[]
  tags: string[]
}

interface Chroma {
  id: number
  name: string
  chromaPath: string
  colors: string[]
}

interface Skin {
  id: string
  num: number
  name: string
  nameEn?: string // English name for download purposes
  lolSkinsName?: string // Name used in lol-skins repository if different
  chromas: boolean
  chromaList?: Chroma[]
  rarity: string
  rarityGemPath: string | null
  isLegacy: boolean
  skinType: string
  skinLines?: Array<{ id: number }>
  description?: string
  winRate?: number
  pickRate?: number
  totalGames?: number
}

interface SkinMapping {
  championKey: string
  championName: string
  skinNum: number
  ddragonName: string
  lolSkinsName: string
}

interface SkinMappingsData {
  version: string
  lastUpdated: string
  skinMappings: SkinMapping[]
}

export class ChampionDataService {
  private supportedLanguages = [
    'en_US',
    'en_AU',
    'en_GB',
    'en_PH',
    'en_SG',
    'vi_VN',
    'es_AR',
    'es_ES',
    'es_MX',
    'ja_JP',
    'ko_KR',
    'zh_CN',
    'ru_RU',
    'ar_AE',
    'pt_BR',
    'id_ID',
    'th_TH',
    'zh_MY',
    'zh_TW',
    'cs_CZ',
    'de_DE',
    'el_GR',
    'fr_FR',
    'hu_HU',
    'it_IT',
    'pl_PL',
    'ro_RO',
    'tr_TR'
  ]
  private githubDataUrl =
    'https://raw.githubusercontent.com/hoangvu12/bocchi/refs/heads/champion-data/data'
  private cachedData: Map<string, { version: string; champions: Champion[] }> = new Map()
  private skinMappings: Map<string, string> = new Map() // key: "championKey_skinNum", value: lolSkinsName
  constructor() {
    this.loadSkinMappings()
  }

  private async loadSkinMappings(): Promise<void> {
    try {
      const mappingsUrl = `${this.githubDataUrl}/skin-name-mappings.json`
      const response = await axios.get<SkinMappingsData>(mappingsUrl)
      const data = response.data

      // Build mapping lookup table
      data.skinMappings.forEach((mapping) => {
        const key = `${mapping.championKey}_${mapping.skinNum}`
        this.skinMappings.set(key, mapping.lolSkinsName)
      })

      console.log(`Loaded ${data.skinMappings.length} skin name mappings`)
    } catch (error) {
      console.error('Failed to load skin name mappings:', error)
    }
  }

  public async fetchAndSaveChampionData(
    language: string = 'en_US'
  ): Promise<{ success: boolean; message: string; championCount?: number }> {
    try {
      // Clear cached data to ensure fresh data is loaded
      this.cachedData.delete(language)

      // Try to fetch from GitHub first
      const githubUrl = `${this.githubDataUrl}/champion-data-${language}.json`

      try {
        const response = await axios.get(githubUrl)
        const data = response.data

        // Log sample data to verify stats are present
        if (data.champions && data.champions.length > 0) {
          const firstChampion = data.champions[0]
          const firstSkinWithStats = firstChampion.skins.find((s: Skin) => s.winRate !== undefined)
          if (firstSkinWithStats) {
            console.log(`[ChampionData] Loaded data with OP.GG stats for ${language}:`, {
              champion: firstChampion.name,
              skin: firstSkinWithStats.name,
              winRate: firstSkinWithStats.winRate,
              pickRate: firstSkinWithStats.pickRate,
              totalGames: firstSkinWithStats.totalGames
            })
          } else {
            console.log(
              `[ChampionData] WARNING: No OP.GG stats found in loaded data for ${language}`
            )
          }
        }

        // Add lol-skins skin names from pre-generated mappings
        data.champions.forEach((champion: Champion) => {
          champion.skins.forEach((skin: Skin) => {
            if (!skin.lolSkinsName && skin.num > 0) {
              // Skip default skins
              const mappingKey = `${champion.key}_${skin.num}`
              const lolSkinsName = this.skinMappings.get(mappingKey)
              if (lolSkinsName) {
                skin.lolSkinsName = lolSkinsName
              }
            }
          })
        })

        // If non-English, also fetch English data to add English skin names
        if (language !== 'en_US') {
          try {
            const englishUrl = `${this.githubDataUrl}/champion-data-en_US.json`
            const englishResponse = await axios.get(englishUrl)
            const englishData = englishResponse.data

            // Create maps for English champion and skin names
            const englishChampionNames: Record<string, string> = {}
            const englishSkinNames: Record<string, string> = {}

            englishData.champions.forEach((champion: Champion) => {
              englishChampionNames[champion.key] = champion.name
              champion.skins.forEach((skin: Skin) => {
                englishSkinNames[skin.id] = skin.name
              })
            })

            // Add English names to non-English champions and skins
            data.champions.forEach((champion: Champion) => {
              // Add English champion name
              const englishChampionName = englishChampionNames[champion.key]
              if (englishChampionName) {
                champion.nameEn = englishChampionName
              }

              // Add English skin names
              champion.skins.forEach((skin: Skin) => {
                const englishName = englishSkinNames[skin.id]
                if (englishName) {
                  skin.nameEn = englishName
                }
              })
            })
          } catch (error) {
            console.error('Failed to fetch English skin names from CDN:', error)
          }
        }

        // Cache the data in memory
        this.cachedData.set(language, data)

        return {
          success: true,
          message: `Successfully fetched data for ${data.champions.length} champions from GitHub`,
          championCount: data.champions.length
        }
      } catch (githubError) {
        console.error('Failed to fetch from GitHub:', githubError)
        return {
          success: false,
          message: `Failed to fetch champion data from GitHub: ${githubError instanceof Error ? githubError.message : 'Unknown error'}`
        }
      }
    } catch (error) {
      console.error('Error fetching champion data:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch champion data'
      }
    }
  }

  public async getChampionById(
    championId: string,
    language: string = 'en_US'
  ): Promise<Champion | null> {
    // Ensure we have data loaded
    const data = await this.loadChampionData(language)
    if (!data) {
      return null
    }

    // Find champion by ID (as string or number)
    const champion = data.champions.find(
      (c) => c.id.toString() === championId || c.key === championId
    )

    if (champion) {
      // Log if this champion has skins with stats
      const skinsWithStats = champion.skins.filter((s) => s.winRate !== undefined).length
      console.log(
        `[ChampionData] Retrieved champion ${champion.name} (${championId}) with ${skinsWithStats}/${champion.skins.length} skins having OP.GG stats`
      )

      // Log a sample skin with stats if available
      const sampleSkin = champion.skins.find((s) => s.winRate !== undefined)
      if (sampleSkin) {
        console.log(`[ChampionData] Sample skin with stats:`, {
          name: sampleSkin.name,
          winRate: sampleSkin.winRate,
          pickRate: sampleSkin.pickRate,
          totalGames: sampleSkin.totalGames
        })
      }
    }

    return champion || null
  }

  public async getChampionByKey(
    championKey: string,
    language: string = 'en_US'
  ): Promise<Champion | null> {
    // For backward compatibility, this method can handle both ID and key
    return this.getChampionById(championKey, language)
  }

  public async loadChampionData(
    language: string = 'en_US'
  ): Promise<{ version: string; champions: Champion[] } | null> {
    // Check if we have cached data
    const cached = this.cachedData.get(language)
    if (cached) {
      return cached
    }

    // If no cached data, fetch it
    const result = await this.fetchAndSaveChampionData(language)
    if (result.success) {
      return this.cachedData.get(language) || null
    }

    return null
  }

  public async checkForUpdates(language: string = 'en_US'): Promise<boolean> {
    try {
      const currentData = this.cachedData.get(language)
      if (!currentData) return true // No data, needs update

      // Check GitHub version
      const githubUrl = `${this.githubDataUrl}/champion-data-${language}.json`
      const response = await axios.get(githubUrl, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const githubData = response.data
      return currentData.version !== githubData.version
    } catch (error) {
      console.error('Error checking for updates:', error)
      return true // On error, assume update needed
    }
  }

  public async fetchAllLanguages(): Promise<{ success: boolean; message: string }> {
    try {
      for (const lang of this.supportedLanguages) {
        console.log(`Fetching champion data for ${lang}`)
        await this.fetchAndSaveChampionData(lang)
      }
      return {
        success: true,
        message: 'Successfully fetched data for all languages'
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch data'
      }
    }
  }

  // Get the lol-skins name for a skin, useful when downloading skins
  public getSkinLolSkinsName(skin: Skin): string {
    // Priority: lolSkinsName > nameEn > name
    return skin.lolSkinsName || skin.nameEn || skin.name
  }

  // Reload skin mappings (useful if the mappings file is updated)
  public async reloadSkinMappings(): Promise<void> {
    this.skinMappings.clear()
    await this.loadSkinMappings()
  }
}

// Singleton instance
export const championDataService = new ChampionDataService()
