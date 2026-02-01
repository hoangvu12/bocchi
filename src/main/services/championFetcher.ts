import axios from 'axios'

// --- Types ---

interface CDragonChroma {
  id: number
  name: string
  chromaPath: string
  colors: string[]
}

interface CDragonTier {
  id: number
  name: string
  stage: number
  description: string
  splashPath: string
  uncenteredSplashPath: string
  tilePath: string
  loadScreenPath: string
  shortName: string
  splashVideoPath: string | null
  previewVideoUrl: string | null
  collectionSplashVideoPath: string | null
  collectionCardHoverVideoPath: string | null
}

interface CDragonSkin {
  id: number
  isBase: boolean
  name: string
  skinType: string
  rarity: string
  isLegacy: boolean
  skinLines?: Array<{ id: number }>
  description?: string
  chromas?: CDragonChroma[]
  questSkinInfo?: {
    productType: string
    tiers?: CDragonTier[]
  }
}

interface CDragonChampion {
  id: number
  name: string
  alias: string
  title: string
  championTagInfo: {
    championTagPrimary: string
    championTagSecondary: string
  }
  skins: CDragonSkin[]
}

export interface Chroma {
  id: number
  name: string
  chromaPath: string
  colors: string[]
}

export interface Skin {
  id: string
  num: number
  name: string
  nameEn?: string
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

export interface Champion {
  id: number
  key: string
  name: string
  nameEn?: string
  title: string
  image: string
  skins: Skin[]
  tags: string[]
}

// --- Constants ---

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com'
const CDRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global'

const RARITY_MAP: Record<string, string> = {
  kEpic: 'epic',
  kLegendary: 'legendary',
  kUltimate: 'ultimate',
  kMythic: 'mythic'
}

function getRarityGemPath(rarity: string): string | null {
  const key = RARITY_MAP[rarity]
  if (!key) return null
  return `${CDRAGON_BASE}/default/v1/rarity-gem-icons/${key}.png`
}

function normalizeLocale(language: string): string {
  if (language === 'en_US') return 'default'
  return language.toLowerCase()
}

// --- Simple concurrency limiter ---

function pLimit(concurrency: number) {
  let active = 0
  const queue: Array<() => void> = []

  function next() {
    if (queue.length > 0 && active < concurrency) {
      active++
      const run = queue.shift()!
      run()
    }
  }

  return function <T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            active--
            next()
          })
      })
      next()
    })
  }
}

// --- Skin processing ---

function processChromas(skin: CDragonSkin): Chroma[] | undefined {
  if (!skin.chromas || skin.chromas.length === 0) return undefined
  return skin.chromas.map((c) => ({
    id: c.id,
    name: c.name,
    chromaPath: c.chromaPath
      ? `${CDRAGON_BASE}/default${c.chromaPath.replace('/lol-game-data/assets/', '/')}`
      : '',
    colors: c.colors || []
  }))
}

function processTieredSkin(
  skin: CDragonSkin,
  championId: number,
  englishSkinNames?: Map<string, string>
): Skin[] {
  const tiers = skin.questSkinInfo?.tiers
  if (!tiers || tiers.length === 0) return []

  return tiers.map((tier) => {
    const skinNum = Math.floor(tier.id / 1000) === championId ? tier.id % 1000 : 0
    const skinId = `${championId}_${skinNum}`
    const nameEn = englishSkinNames?.get(skinId)

    return {
      id: skinId,
      num: skinNum,
      name: tier.name,
      nameEn: nameEn && nameEn !== tier.name ? nameEn : undefined,
      chromas: false,
      rarity: skin.rarity || 'kNoRarity',
      rarityGemPath: getRarityGemPath(skin.rarity || 'kNoRarity'),
      isLegacy: skin.isLegacy || false,
      skinType: skin.skinType || '',
      skinLines: skin.skinLines,
      description: tier.description
    }
  })
}

function processRegularSkin(
  skin: CDragonSkin,
  championId: number,
  championName: string,
  englishSkinNames?: Map<string, string>
): Skin {
  const skinNum = Math.floor(skin.id / 1000) === championId ? skin.id % 1000 : 0
  const skinId = `${championId}_${skinNum}`
  const skinName = skin.isBase ? championName : skin.name
  const nameEn = englishSkinNames?.get(skinId)
  const chromaList = processChromas(skin)

  return {
    id: skinId,
    num: skinNum,
    name: skinName,
    nameEn: nameEn && nameEn !== skinName ? nameEn : undefined,
    chromas: !!(skin.chromas && skin.chromas.length > 0),
    chromaList,
    rarity: skin.rarity || 'kNoRarity',
    rarityGemPath: getRarityGemPath(skin.rarity || 'kNoRarity'),
    isLegacy: skin.isLegacy || false,
    skinType: skin.skinType || '',
    skinLines: skin.skinLines,
    description: skin.description
  }
}

// --- Main fetcher ---

export async function fetchLatestVersion(): Promise<string> {
  const resp = await axios.get<string[]>(`${DDRAGON_BASE}/api/versions.json`)
  return resp.data[0]
}

export async function fetchChampionData(
  language: string,
  version?: string
): Promise<{ version: string; champions: Champion[] }> {
  if (!version) {
    version = await fetchLatestVersion()
  }

  // Fetch champion list from Ddragon
  const listUrl = `${DDRAGON_BASE}/cdn/${version}/data/${language}/champion.json`
  const listResp = await axios.get<{ data: Record<string, { key: string }> }>(listUrl)
  const championList = listResp.data.data

  // For non-English: also fetch English data to get English skin names
  let englishSkinNames: Map<string, string> | undefined
  let englishChampionNames: Map<number, string> | undefined

  if (language !== 'en_US') {
    try {
      const enResult = await fetchChampionDataInternal('en_US', version)
      englishSkinNames = new Map<string, string>()
      englishChampionNames = new Map<number, string>()
      for (const champ of enResult.champions) {
        englishChampionNames.set(champ.id, champ.name)
        for (const skin of champ.skins) {
          englishSkinNames.set(skin.id, skin.name)
        }
      }
    } catch (err) {
      console.error('Failed to fetch English data for name mapping:', err)
    }
  }

  const limit = pLimit(50)
  const locale = normalizeLocale(language)
  const championKeys = Object.keys(championList)

  const results = await Promise.all(
    championKeys.map((key) =>
      limit(async () => {
        const championId = parseInt(championList[key].key)
        try {
          const detailUrl = `${CDRAGON_BASE}/${locale}/v1/champions/${championId}.json`
          let detailData: CDragonChampion
          try {
            const resp = await axios.get<CDragonChampion>(detailUrl)
            detailData = resp.data
          } catch (err: any) {
            if (locale !== 'default' && err?.response?.status === 404) {
              const fallbackUrl = `${CDRAGON_BASE}/default/v1/champions/${championId}.json`
              const resp = await axios.get<CDragonChampion>(fallbackUrl)
              detailData = resp.data
            } else {
              throw err
            }
          }

          const tags: string[] = []
          if (detailData.championTagInfo.championTagPrimary) {
            tags.push(detailData.championTagInfo.championTagPrimary)
          }
          if (detailData.championTagInfo.championTagSecondary) {
            tags.push(detailData.championTagInfo.championTagSecondary)
          }

          const skins: Skin[] = detailData.skins.flatMap((skin) => {
            if (skin.questSkinInfo?.productType === 'kTieredSkin' && skin.questSkinInfo.tiers) {
              return processTieredSkin(skin, championId, englishSkinNames)
            }
            return processRegularSkin(skin, championId, detailData.name, englishSkinNames)
          })

          const champion: Champion = {
            id: championId,
            key: detailData.alias,
            name: detailData.name,
            nameEn: englishChampionNames?.get(championId),
            title: detailData.title,
            image: `${DDRAGON_BASE}/cdn/${version}/img/champion/${detailData.alias}.png`,
            tags,
            skins
          }

          return champion
        } catch (error: any) {
          console.error(`Failed to fetch champion ${key} (${championId}):`, error.message)
          return null
        }
      })
    )
  )

  const champions = results.filter((c): c is Champion => c !== null)
  champions.sort((a, b) => a.name.localeCompare(b.name))

  return { version, champions }
}

// Internal helper to fetch English data without recursion issue
async function fetchChampionDataInternal(
  language: string,
  version: string
): Promise<{ version: string; champions: Champion[] }> {
  const listUrl = `${DDRAGON_BASE}/cdn/${version}/data/${language}/champion.json`
  const listResp = await axios.get<{ data: Record<string, { key: string }> }>(listUrl)
  const championList = listResp.data.data

  const limit = pLimit(50)
  const locale = normalizeLocale(language)
  const championKeys = Object.keys(championList)

  const results = await Promise.all(
    championKeys.map((key) =>
      limit(async () => {
        const championId = parseInt(championList[key].key)
        try {
          const detailUrl = `${CDRAGON_BASE}/${locale}/v1/champions/${championId}.json`
          const resp = await axios.get<CDragonChampion>(detailUrl)
          const detailData = resp.data

          const tags: string[] = []
          if (detailData.championTagInfo.championTagPrimary) {
            tags.push(detailData.championTagInfo.championTagPrimary)
          }
          if (detailData.championTagInfo.championTagSecondary) {
            tags.push(detailData.championTagInfo.championTagSecondary)
          }

          const skins: Skin[] = detailData.skins.flatMap((skin) => {
            if (skin.questSkinInfo?.productType === 'kTieredSkin' && skin.questSkinInfo.tiers) {
              return processTieredSkin(skin, championId)
            }
            return processRegularSkin(skin, championId, detailData.name)
          })

          return {
            id: championId,
            key: detailData.alias,
            name: detailData.name,
            title: detailData.title,
            image: `${DDRAGON_BASE}/cdn/${version}/img/champion/${detailData.alias}.png`,
            tags,
            skins
          } as Champion
        } catch (error: any) {
          console.error(`Failed to fetch champion ${key}:`, error.message)
          return null
        }
      })
    )
  )

  const champions = results.filter((c): c is Champion => c !== null)
  champions.sort((a, b) => a.name.localeCompare(b.name))

  return { version, champions }
}
