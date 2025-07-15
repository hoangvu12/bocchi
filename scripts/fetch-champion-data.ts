import axios from 'axios'
import * as fs from 'fs/promises'
import * as path from 'path'
import pLimit from 'p-limit'
import * as cheerio from 'cheerio'
import {
  fetchAllLolSkinsData,
  findBestSkinMatch,
  findChampionFolder,
  initializeLolSkinsData
} from '../src/main/utils/skinNameMatcher'

// This file contains the hardcoded directory structure of lol-skins repository
// Update this periodically to keep skin names in sync

const LOL_SKINS_DIRECTORY_PATH = path.join(process.cwd(), 'scripts', 'lol_skins_directory.txt')
const LOL_SKINS_DIRECTORY = await fs.readFile(LOL_SKINS_DIRECTORY_PATH, 'utf-8')

const SUPPORTED_LANGUAGES = ['en_US', 'vi_VN', 'es_AR', 'ja_JP', 'ko_KR', 'zh_CN', 'ru_RU']
const DDRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com'
const CDRAGON_BASE_URL =
  'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1'

// Optimized settings
const CONCURRENT_REQUESTS = 10 // Increased from sequential to 10 concurrent
const RETRY_ATTEMPTS = 3
const RETRY_DELAY = 1000
const OPGG_CONCURRENT_REQUESTS = 3 // Be respectful to OP.GG
const OPGG_REQUEST_DELAY = 1000 // Delay between OP.GG requests

interface Chroma {
  id: number
  name: string
  chromaPath: string
  colors: string[]
}

interface SkinVariant {
  id: string
  name: string
  displayName?: string
  githubUrl: string
  downloadUrl?: string
  imageUrl?: string
}

interface Skin {
  id: string
  num: number
  name: string
  nameEn?: string
  lolSkinsName?: string
  chromas: boolean
  chromaList?: Chroma[]
  variants?: {
    type: string // "exalted", "form", etc.
    items: SkinVariant[]
  }
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

interface Champion {
  id: number
  key: string
  name: string
  nameEn?: string
  title: string
  image: string
  tags: string[]
  skins: Skin[]
}

interface ChampionData {
  version: string
  lastUpdated: string
  champions: Champion[]
}

interface ChromaData {
  version: string
  lastUpdated: string
  chromaMap: Record<string, Chroma[]>
}

interface ProgressTracker {
  total: number
  completed: number
  startTime: number
  currentPhase: string
}

interface SkinWinRate {
  skinName: string
  winRate: number
  pickRate: number
  totalGames: number
}

interface SkinWinRateMapping {
  championKey: string
  championId: number
  skinId: string // e.g., "266_1"
  skinNum: number
  opggName: string
  matchedName: string
  winRate: number
  pickRate: number
  totalGames: number
  confidence: number // 0-1, how confident we are in the match
}

// CDragon response types
interface CDragonSkin {
  id: number
  contentId: string
  isBase: boolean
  name: string
  skinClassification: string
  splashPath: string
  uncenteredSplashPath: string
  tilePath: string
  loadScreenPath: string
  skinType: string
  rarity: string
  isLegacy: boolean
  splashVideoPath: any
  previewVideoUrl: any
  collectionSplashVideoPath: any
  collectionCardHoverVideoPath: any
  featuresText: any
  chromaPath?: string
  emblems: any
  regionRarityId: number
  rarityGemPath: any
  skinLines?: Array<{ id: number }>
  description?: string
  chromas?: Array<{
    id: number
    name: string
    contentId: string
    skinClassification: string
    chromaPath: string
    tilePath: string
    colors: string[]
    descriptions: Array<{
      region: string
      description: string
    }>
    description: string
    rarities: Array<{
      region: string
      rarity: number
    }>
  }>
  loadScreenVintagePath?: string
  questSkinInfo?: QuestSkinInfo
}

interface QuestSkinInfo {
  name: string
  productType: string
  collectionDescription: string
  descriptionInfo: Array<any>
  splashPath: string
  uncenteredSplashPath: string
  tilePath: string
  collectionCardPath: string
  tiers?: Tier[]
}

interface Tier {
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
  skinAugments?: {
    borders?: {
      [key: string]: Array<{
        contentId: string
        layer: number
        priority: number
        borderPath: string
      }>
    }
    augments?: Array<{
      contentId: string
      overlays: Array<{
        centeredLCOverlayPath: string
        uncenteredLCOverlayPath: string
        socialCardLCOverlayPath: string
        tileLCOverlayPath: string
      }>
    }>
  }
}

interface CDragonChampion {
  id: number
  name: string
  alias: string
  title: string
  shortBio: string
  tacticalInfo: {
    style: number
    difficulty: number
    damageType: string
    attackType: string
  }
  playstyleInfo: {
    damage: number
    durability: number
    crowdControl: number
    mobility: number
    utility: number
  }
  championTagInfo: {
    championTagPrimary: string
    championTagSecondary: string
  }
  squarePortraitPath: string
  stingerSfxPath: string
  chooseVoPath: string
  banVoPath: string
  roles: string[]
  recommendedItemDefaults: any[]
  skins: CDragonSkin[]
  passive: {
    name: string
    abilityIconPath: string
    abilityVideoPath: string
    abilityVideoImagePath: string
    description: string
  }
  spells: Array<{
    spellKey: string
    name: string
    abilityIconPath: string
    abilityVideoPath: string
    abilityVideoImagePath: string
    cost: string
    cooldown: string
    description: string
    dynamicDescription: string
    range: number[]
    costCoefficients: number[]
    cooldownCoefficients: number[]
    coefficients: {
      coefficient1: number
      coefficient2: number
    }
    effectAmounts: {
      [key: string]: number[]
    }
    ammo: {
      ammoRechargeTime: number[]
      maxAmmo: number[]
    }
    maxLevel: number
  }>
}

const progress: ProgressTracker = {
  total: 0,
  completed: 0,
  startTime: Date.now(),
  currentPhase: 'Initializing'
}

// Manual mapping for special skin variants that exist in subdirectories
const SPECIAL_SKIN_VARIANTS: Record<
  string,
  Record<string, { type: string; items: SkinVariant[] }>
> = {
  Jinx: {
    'Arcane Fractured Jinx': {
      type: 'exalted',
      items: [
        {
          id: 'arcane_fractured_hero',
          name: 'Hero',
          displayName: 'Arcane Fractured Jinx — Hero',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Jinx/Exalted/Arcane%20Fractured%20Jinx%20%E2%80%94%20Hero.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Jinx/Exalted/Arcane%20Fractured%20Jinx%20%E2%80%94%20Hero.zip'
        },
        {
          id: 'arcane_fractured_menace',
          name: 'Menace',
          displayName: 'Arcane Fractured Jinx — Menace',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Jinx/Exalted/Arcane%20Fractured%20Jinx%20%E2%80%94%20Menace.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Jinx/Exalted/Arcane%20Fractured%20Jinx%20%E2%80%94%20Menace.zip'
        },
        {
          id: 'arcane_fractured_powder',
          name: 'Powder',
          displayName: 'Arcane Fractured Jinx — Powder',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Jinx/Exalted/Arcane%20Fractured%20Jinx%20%E2%80%94%20Powder.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Jinx/Exalted/Arcane%20Fractured%20Jinx%20%E2%80%94%20Powder.zip'
        }
      ]
    }
  },
  Lux: {
    'Elementalist Lux': {
      type: 'form',
      items: [
        {
          id: 'elementalist_air',
          name: 'Air',
          displayName: 'Lux Elementalist Air',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Air.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Air.zip'
        },
        {
          id: 'elementalist_dark',
          name: 'Dark',
          displayName: 'Lux Elementalist Dark',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Dark.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Dark.zip'
        },
        {
          id: 'elementalist_fire',
          name: 'Fire',
          displayName: 'Lux Elementalist Fire',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Fire.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Fire.zip'
        },
        {
          id: 'elementalist_ice',
          name: 'Ice',
          displayName: 'Lux Elementalist Ice',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Ice.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Ice.zip'
        },
        {
          id: 'elementalist_magma',
          name: 'Magma',
          displayName: 'Lux Elementalist Magma',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Magma.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Magma.zip'
        },
        {
          id: 'elementalist_mystic',
          name: 'Mystic',
          displayName: 'Lux Elementalist Mystic',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Mystic.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Mystic.zip'
        },
        {
          id: 'elementalist_nature',
          name: 'Nature',
          displayName: 'Lux Elementalist Nature',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Nature.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Nature.zip'
        },
        {
          id: 'elementalist_storm',
          name: 'Storm',
          displayName: 'Lux Elementalist Storm',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Storm.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Storm.zip'
        },
        {
          id: 'elementalist_water',
          name: 'Water',
          displayName: 'Lux Elementalist Water',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Water.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Lux/forms/Elementalist%20Lux/Lux%20Elementalist%20Water.zip'
        }
      ]
    }
  },
  MissFortune: {
    'Gun Goddess Miss Fortune': {
      type: 'form',
      items: [
        {
          id: 'gun_goddess_form2',
          name: 'Form 2',
          displayName: 'GunGoddess MF form 2',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/GunGoddess%20MF%20form%202.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/GunGoddess%20MF%20form%202.zip',
          imageUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/Model%20Image/form_2.png'
        },
        {
          id: 'gun_goddess_form3',
          name: 'Form 3',
          displayName: 'GunGoddess MF form 3',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/GunGoddess%20MF%20form%203.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/GunGoddess%20MF%20form%203.zip',
          imageUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/Model%20Image/form_3.png'
        },
        {
          id: 'gun_goddess_form4',
          name: 'Form 4',
          displayName: 'GunGoddess MF form 4',
          githubUrl:
            'https://github.com/darkseal-org/lol-skins/blob/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/GunGoddess%20MF%20form%204.zip',
          downloadUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/GunGoddess%20MF%20form%204.zip',
          imageUrl:
            'https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/Miss%20Fortune/Gun%20Goddess%20Miss%20Fortune%20forms/Model%20Image/form_4.png'
        }
      ]
    }
  }
}

function updateProgress(phase: string, completed?: number, total?: number) {
  progress.currentPhase = phase
  if (completed !== undefined) progress.completed = completed
  if (total !== undefined) progress.total = total

  const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0
  const elapsed = (Date.now() - progress.startTime) / 1000
  const rate = progress.completed / elapsed
  const eta = progress.total > progress.completed ? (progress.total - progress.completed) / rate : 0

  console.log(
    `[${phase}] Progress: ${progress.completed}/${progress.total} (${percentage.toFixed(1)}%) - ` +
      `ETA: ${eta.toFixed(0)}s - Rate: ${rate.toFixed(1)}/s`
  )
}

function getRarityGemPath(rarity: string): string | null {
  const rarityMap: Record<string, string> = {
    kEpic: 'epic',
    kLegendary: 'legendary',
    kUltimate: 'ultimate',
    kMythic: 'mythic'
  }

  const rarityKey = rarityMap[rarity]
  if (!rarityKey) {
    return null
  }

  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/rarity-gem-icons/${rarityKey}.png`
}

function normalizeLocale(language: string): string {
  // en_US uses default in CDragon
  if (language === 'en_US') {
    return 'default'
  }
  // Convert other locales to lowercase with underscore (e.g., vi_VN -> vi_vn)
  return language.toLowerCase()
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function retryRequest<T>(
  fn: () => Promise<T>,
  retries = RETRY_ATTEMPTS,
  delayMs = RETRY_DELAY
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries > 0) {
      await delay(delayMs)
      return retryRequest(fn, retries - 1, delayMs * 2)
    }
    throw error
  }
}

// Cache for version to avoid multiple calls
let cachedVersion: string | null = null
let versionCacheTime: number = 0
const VERSION_CACHE_DURATION = 3600000 // 1 hour

async function getLatestVersion(): Promise<string> {
  const now = Date.now()
  if (cachedVersion && now - versionCacheTime < VERSION_CACHE_DURATION) {
    return cachedVersion
  }

  const response = await retryRequest(() => axios.get(`${DDRAGON_BASE_URL}/api/versions.json`))
  cachedVersion = response.data[0]
  versionCacheTime = now
  return cachedVersion as string
}

// Pre-build champion name lookup map
function buildChampionNameLookup(championFolders: string[]): Map<string, string> {
  const lookup = new Map<string, string>()

  championFolders.forEach((folder) => {
    // Original name
    lookup.set(folder.toLowerCase(), folder)

    // Without spaces
    const noSpaces = folder.replace(/\s+/g, '')
    lookup.set(noSpaces.toLowerCase(), folder)

    // With underscores
    const underscores = folder.replace(/\s+/g, '_')
    lookup.set(underscores.toLowerCase(), folder)

    // Common variations
    if (folder === "Kai'Sa") {
      lookup.set('kaisa', folder)
      lookup.set('kai sa', folder)
    }
    if (folder === "Cho'Gath") {
      lookup.set('chogath', folder)
      lookup.set('cho gath', folder)
    }
    // Add more special cases as needed
  })

  return lookup
}

// Utility functions for skin name matching
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}

function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 1
  const distance = levenshteinDistance(str1, str2)
  return 1 - distance / maxLen
}

function normalizeSkinName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '') // Remove apostrophes
    .replace(/\s+/g, '') // Remove spaces
    .replace(/\./g, '') // Remove dots
    .replace(/-/g, '') // Remove hyphens
    .replace(/[()]/g, '') // Remove parentheses
    .replace(/:/g, '') // Remove colons
}

function processTieredSkin(skin: CDragonSkin, championId: number, lolSkinsList: any[]): Skin[] {
  const tiers = skin.questSkinInfo?.tiers
  if (!tiers || tiers.length === 0) {
    // If no tiers, return empty array to skip this skin
    return []
  }

  // Process each tier as a separate skin
  return tiers.map((tier) => {
    const skinNum = Math.floor(tier.id / 1000) === championId ? tier.id % 1000 : 0
    const skinId = `${championId}_${skinNum}`

    // Don't try to match base skins (num: 0) with lol-skins
    const match = skinNum === 0 ? null : findBestSkinMatch(tier.name, lolSkinsList)

    // Note: Tiers typically don't have their own chromas, but we preserve the structure
    return {
      id: skinId,
      num: skinNum,
      name: tier.name,
      lolSkinsName:
        match && match.skinInfo.skinName !== tier.name ? match.skinInfo.skinName : undefined,
      chromas: false, // Tiers usually don't have chromas
      chromaList: undefined,
      rarity: skin.rarity || 'kNoRarity',
      rarityGemPath: getRarityGemPath(skin.rarity || 'kNoRarity'),
      isLegacy: skin.isLegacy || false,
      skinType: skin.skinType || '',
      skinLines: skin.skinLines,
      description: tier.description
    }
  })
}

async function fetchChampionDetail(
  key: string,
  championBasic: any,
  version: string,
  language: string,
  lolSkinsData: Map<string, any[]>,
  championNameLookup: Map<string, string>,
  englishSkinNames?: Map<string, string> // Map of skinId to English name
): Promise<{ champion: Champion; chromaData: Record<string, Chroma[]> }> {
  const championId = parseInt(championBasic.key)
  const locale = normalizeLocale(language)
  const detailUrl = `${CDRAGON_BASE_URL.replace('/default/', `/${locale}/`)}/champions/${championId}.json`

  try {
    const detailResponse = await retryRequest(() => axios.get<CDragonChampion>(detailUrl))
    const detailData = detailResponse.data

    // Use lookup map for faster champion folder finding
    const normalizedName = detailData.name.toLowerCase()
    let championFolder = championNameLookup.get(normalizedName)

    if (!championFolder) {
      // Fallback to original method if not in lookup
      championFolder =
        findChampionFolder(detailData.name, Array.from(lolSkinsData.keys())) || undefined
    }

    const lolSkinsList = championFolder ? lolSkinsData.get(championFolder) || [] : []

    // Extract chroma data from CDragon response
    const chromaData: Record<string, Chroma[]> = {}

    // Get tags from roles or championTagInfo
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
        // Process tiered skin
        return processTieredSkin(skin, championId, lolSkinsList)
      }

      // Process regular skin
      const skinNum = Math.floor(skin.id / 1000) === championId ? skin.id % 1000 : 0
      const skinId = `${championId}_${skinNum}`
      const skinName = skin.isBase ? detailData.name : skin.name

      // Don't try to match base skins (num: 0) with lol-skins
      const match = skinNum === 0 ? null : findBestSkinMatch(skinName, lolSkinsList)

      // Process chromas
      let chromaList: Chroma[] | undefined
      if (skin.chromas && skin.chromas.length > 0) {
        chromaList = skin.chromas.map((chroma) => ({
          id: chroma.id,
          name: chroma.name,
          chromaPath: chroma.chromaPath
            ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default${chroma.chromaPath.replace('/lol-game-data/assets/', '/')}`
            : '',
          colors: chroma.colors || []
        }))
        // Also add to chromaData for backward compatibility
        chromaData[skinId] = chromaList
      }

      // Check for special skin variants
      const championKey = detailData.alias
      // For non-English languages, use English name if available
      const englishName = englishSkinNames?.get(skinId)
      const variantLookupName = englishName || skinName
      const variants = SPECIAL_SKIN_VARIANTS[championKey]?.[variantLookupName]

      return {
        id: skinId,
        num: skinNum,
        name: skinName,
        lolSkinsName:
          match && match.skinInfo.skinName !== skinName ? match.skinInfo.skinName : undefined,
        chromas: !!(skin.chromas && skin.chromas.length > 0),
        chromaList: chromaList,
        variants: variants,
        rarity: skin.rarity || 'kNoRarity',
        rarityGemPath: getRarityGemPath(skin.rarity || 'kNoRarity'),
        isLegacy: skin.isLegacy || false,
        skinType: skin.skinType || '',
        skinLines: skin.skinLines,
        description: skin.description
      }
    })

    const champion: Champion = {
      id: championId,
      key: detailData.alias, // CDragon uses 'alias' for what DDragon calls 'id'
      name: detailData.name,
      title: detailData.title,
      image: `${DDRAGON_BASE_URL}/cdn/${version}/img/champion/${detailData.alias}.png`,
      tags: tags,
      skins: skins
    }

    return { champion, chromaData }
  } catch (error) {
    console.error(error)

    // Fallback to default locale if locale-specific request fails
    if (locale !== 'default' && error.response?.status === 404) {
      console.warn(`Failed to fetch ${locale} data for ${key}, falling back to default`)
      const fallbackUrl = `${CDRAGON_BASE_URL}/champions/${championId}.json`

      const detailResponse = await retryRequest(() => axios.get<CDragonChampion>(fallbackUrl))
      const detailData = detailResponse.data

      // Use lookup map for faster champion folder finding
      const normalizedName = detailData.name.toLowerCase()
      let championFolder = championNameLookup.get(normalizedName)

      if (!championFolder) {
        // Fallback to original method if not in lookup
        championFolder =
          findChampionFolder(detailData.name, Array.from(lolSkinsData.keys())) || undefined
      }

      const lolSkinsList = championFolder ? lolSkinsData.get(championFolder) || [] : []

      // Extract chroma data from CDragon response
      const chromaData: Record<string, Chroma[]> = {}

      // Get tags from roles or championTagInfo
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
          // Process tiered skin
          return processTieredSkin(skin, championId, lolSkinsList)
        }

        // Process regular skin
        const skinNum = Math.floor(skin.id / 1000) === championId ? skin.id % 1000 : 0
        const skinId = `${championId}_${skinNum}`
        const skinName = skin.isBase ? detailData.name : skin.name

        // Don't try to match base skins (num: 0) with lol-skins
        const match = skinNum === 0 ? null : findBestSkinMatch(skinName, lolSkinsList)

        // Process chromas
        let chromaList: Chroma[] | undefined
        if (skin.chromas && skin.chromas.length > 0) {
          chromaList = skin.chromas.map((chroma) => ({
            id: chroma.id,
            name: chroma.name,
            chromaPath: chroma.chromaPath
              ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default${chroma.chromaPath.replace('/lol-game-data/assets/', '/')}`
              : '',
            colors: chroma.colors || []
          }))
          // Also add to chromaData for backward compatibility
          chromaData[skinId] = chromaList
        }

        // Check for special skin variants
        const championKey = detailData.alias
        // For non-English languages, use English name if available
        const englishName = englishSkinNames?.get(skinId)
        const variantLookupName = englishName || skinName
        const variants = SPECIAL_SKIN_VARIANTS[championKey]?.[variantLookupName]

        return {
          id: skinId,
          num: skinNum,
          name: skinName,
          lolSkinsName:
            match && match.skinInfo.skinName !== skinName ? match.skinInfo.skinName : undefined,
          chromas: !!(skin.chromas && skin.chromas.length > 0),
          chromaList: chromaList,
          variants: variants,
          rarity: skin.rarity || 'kNoRarity',
          rarityGemPath: getRarityGemPath(skin.rarity || 'kNoRarity'),
          isLegacy: skin.isLegacy || false,
          skinType: skin.skinType || '',
          skinLines: skin.skinLines,
          description: skin.description
        }
      })

      const champion: Champion = {
        id: championId,
        key: detailData.alias, // CDragon uses 'alias' for what DDragon calls 'id'
        name: detailData.name,
        title: detailData.title,
        image: `${DDRAGON_BASE_URL}/cdn/${version}/img/champion/${detailData.alias}.png`,
        tags: tags,
        skins: skins
      }

      return { champion, chromaData }
    }

    throw error
  }
}

async function fetchAllChampionData(
  version: string,
  language: string,
  lolSkinsData: Map<string, any[]>,
  championFolders: string[],
  englishSkinNames?: Map<string, string>
): Promise<{ champions: Champion[]; allChromaData: Record<string, Chroma[]> }> {
  console.log(`Fetching champion data for ${language}...`)

  // Fetch basic champion list
  const listUrl = `${DDRAGON_BASE_URL}/cdn/${version}/data/${language}/champion.json`
  const listResponse = await retryRequest(() => axios.get(listUrl))
  const championList = listResponse.data.data

  const champions: Champion[] = []
  const allChromaData: Record<string, Chroma[]> = {}
  const championKeys = Object.keys(championList)

  // Build champion name lookup map
  const championNameLookup = buildChampionNameLookup(championFolders)

  // Create a limit function for concurrent requests
  const limit = pLimit(CONCURRENT_REQUESTS)

  updateProgress('Fetching Champions', 0, championKeys.length)

  // Process champions in parallel batches
  const results = await Promise.all(
    championKeys.map((key, index) =>
      limit(async () => {
        try {
          const result = await fetchChampionDetail(
            key,
            championList[key],
            version,
            language,
            lolSkinsData,
            championNameLookup,
            englishSkinNames
          )

          updateProgress('Fetching Champions', index + 1, championKeys.length)

          return result
        } catch (error) {
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

async function loadExistingData(
  dataDir: string,
  version: string
): Promise<Record<string, ChampionData>> {
  const existingData: Record<string, ChampionData> = {}

  // Load all data into memory at once
  const loadPromises: Promise<void>[] = []

  // Load champion data
  for (const language of SUPPORTED_LANGUAGES) {
    loadPromises.push(
      (async () => {
        const filePath = path.join(dataDir, `champion-data-${language}.json`)
        try {
          const data = await fs.readFile(filePath, 'utf-8')
          const parsed = JSON.parse(data)
          if (parsed.version === version) {
            existingData[language] = parsed
            console.log(`Loaded existing data for ${language} (version ${version})`)
          }
        } catch {
          // File doesn't exist or can't be read
        }
      })()
    )
  }

  await Promise.all(loadPromises)

  return existingData
}

async function scrapeChampionSkinStats(championKey: string): Promise<SkinWinRate[]> {
  try {
    // Convert champion key to lowercase for OP.GG URL
    const urlChampion = championKey.toLowerCase()
    const url = `https://op.gg/lol/skins/statistics/${urlChampion}`

    // Add delay to be respectful
    await delay(OPGG_REQUEST_DELAY)

    // Fetch the HTML
    const response = await retryRequest(() =>
      axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000
      })
    )

    // Load HTML into Cheerio
    const $ = cheerio.load(response.data)

    // Find the skin statistics table
    const skinStats: SkinWinRate[] = []

    // Parse all rows
    $('tbody tr').each((index, element) => {
      const $row = $(element)
      const cells = $row
        .find('td')
        .map((_, el) => $(el).text().trim())
        .get()

      if (cells.length >= 6) {
        const skinName = cells[1]
        const gamesPlayed = cells[3].replace(/,/g, '')
        const winRateText = cells[4]
        const pickRateText = cells[5]

        // Skip header row
        if (skinName === 'Champion') return

        // Parse percentages and numbers
        const winRate = parseFloat(winRateText.replace('%', ''))
        const pickRate = parseFloat(pickRateText.replace('%', ''))
        const totalGames = parseInt(gamesPlayed)

        if (skinName && !isNaN(winRate)) {
          skinStats.push({
            skinName,
            winRate,
            pickRate: isNaN(pickRate) ? 0 : pickRate,
            totalGames: isNaN(totalGames) ? 0 : totalGames
          })
        }
      }
    })

    return skinStats
  } catch (error) {
    console.error(`Failed to scrape skin stats for ${championKey}:`, error.message)
    // Return empty array on error to continue with other champions
    return []
  }
}

function findBestOPGGSkinMatch(
  opggSkinName: string,
  championSkins: Array<{ id: string; num: number; name: string; nameEn?: string }>
): { skin: { id: string; num: number; name: string; nameEn?: string }; confidence: number } | null {
  const normalizedOpggName = normalizeSkinName(opggSkinName)
  let bestMatch: {
    skin: { id: string; num: number; name: string; nameEn?: string }
    confidence: number
  } | null = null
  let bestScore = 0

  for (const skin of championSkins) {
    // Skip base skin (num: 0) unless OP.GG name is just the champion name
    if (skin.num === 0 && !opggSkinName.match(/^[A-Z][a-z]+$/)) continue

    // Try matching with English name first, then regular name
    const namesToTry = [skin.nameEn, skin.name].filter(Boolean)

    for (const name of namesToTry) {
      const normalizedName = normalizeSkinName(name!)
      const score = calculateSimilarity(normalizedOpggName, normalizedName)

      if (score > bestScore) {
        bestScore = score
        bestMatch = { skin, confidence: score }
      }

      // If we found an exact match, no need to continue
      if (score === 1) break
    }
  }

  // Only return matches with reasonable confidence (> 0.7)
  return bestMatch && bestMatch.confidence > 0.7 ? bestMatch : null
}

async function fetchAllSkinWinRates(
  champions: Champion[]
): Promise<Map<string, SkinWinRateMapping>> {
  console.log('\nFetching skin win rates from OP.GG...')

  // Create limit function for concurrent requests
  const limit = pLimit(OPGG_CONCURRENT_REQUESTS)

  // Store all mappings
  const allMappings: SkinWinRateMapping[] = []
  let processedChampions = 0

  updateProgress('Fetching Win Rates', 0, champions.length)

  // Process champions
  await Promise.all(
    champions.map((champion) =>
      limit(async () => {
        const winRates = await scrapeChampionSkinStats(champion.key)
        processedChampions++
        updateProgress('Fetching Win Rates', processedChampions, champions.length)

        if (winRates.length === 0) {
          return
        }

        // Match OP.GG skins to our skin data
        for (const opggSkin of winRates) {
          const match = findBestOPGGSkinMatch(opggSkin.skinName, champion.skins)

          if (match) {
            allMappings.push({
              championKey: champion.key,
              championId: champion.id,
              skinId: match.skin.id,
              skinNum: match.skin.num,
              opggName: opggSkin.skinName,
              matchedName: match.skin.nameEn || match.skin.name,
              winRate: opggSkin.winRate,
              pickRate: opggSkin.pickRate,
              totalGames: opggSkin.totalGames,
              confidence: match.confidence
            })
          }
        }
      })
    )
  )

  console.log(`Fetched win rate data for ${allMappings.length} skins`)

  // Create a map for quick lookup
  return new Map(allMappings.map((m) => [m.skinId, m]))
}

async function saveAllData(
  dataDir: string,
  allData: Record<string, ChampionData>,
  chromaData: ChromaData | null
) {
  const savePromises: Promise<void>[] = []

  // Save champion data
  for (const [language, data] of Object.entries(allData)) {
    const filePath = path.join(dataDir, `champion-data-${language}.json`)
    savePromises.push(
      fs
        .writeFile(filePath, JSON.stringify(data, null, 2))
        .then(() => console.log(`Saved ${filePath}`))
    )
  }

  // Save chroma data
  if (chromaData) {
    const chromaDataPath = path.join(dataDir, 'chroma-data.json')
    savePromises.push(
      fs
        .writeFile(chromaDataPath, JSON.stringify(chromaData, null, 2))
        .then(() => console.log(`Saved ${chromaDataPath}`))
    )
  }

  // Save mapping data
  if (allData['en_US']) {
    const mappingData = {
      version: allData['en_US'].version,
      lastUpdated: new Date().toISOString(),
      skinMappings: [] as any[]
    }

    allData['en_US'].champions.forEach((champion) => {
      champion.skins.forEach((skin) => {
        if (skin.num !== 0 && skin.lolSkinsName) {
          mappingData.skinMappings.push({
            championKey: champion.key,
            championName: champion.name,
            skinNum: skin.num,
            ddragonName: skin.name,
            lolSkinsName: skin.lolSkinsName
          })
        }
      })
    })

    const mappingPath = path.join(dataDir, 'skin-name-mappings.json')
    savePromises.push(
      fs
        .writeFile(mappingPath, JSON.stringify(mappingData, null, 2))
        .then(() =>
          console.log(`Saved ${mappingPath} (${mappingData.skinMappings.length} mappings)`)
        )
    )
  }

  await Promise.all(savePromises)
}

async function main() {
  try {
    progress.startTime = Date.now()

    // Parse command line arguments
    const forceRefresh = process.argv.includes('--force')
    const skipWinRates = process.argv.includes('--skip-winrates')
    if (forceRefresh) {
      console.log('Force refresh enabled - will fetch all data regardless of version')
    }
    if (skipWinRates) {
      console.log('Skipping win rate fetching')
    }

    // Create data directory
    const dataDir = path.join(process.cwd(), 'data')
    await fs.mkdir(dataDir, { recursive: true })

    // Get latest version (cached)
    updateProgress('Fetching version')
    const version = await getLatestVersion()
    console.log(`Latest version: ${version}`)

    // Initialize lol-skins data with hardcoded directory structure
    updateProgress('Initializing lol-skins data')
    initializeLolSkinsData(LOL_SKINS_DIRECTORY)

    // Fetch all lol-skins data
    const lolSkinsData = fetchAllLolSkinsData()
    const championFolders = Array.from(lolSkinsData.keys())
    console.log(`Found ${championFolders.length} champions in lol-skins`)

    // Load existing data
    updateProgress('Loading existing data')
    const existingData = await loadExistingData(dataDir, forceRefresh ? 'force-refresh' : version)

    // Check if we need to fetch new data
    const needsFetch = forceRefresh || Object.keys(existingData).length < SUPPORTED_LANGUAGES.length

    if (!needsFetch) {
      console.log('All data is up to date!')

      // Just apply skin name mappings to existing data
      updateProgress('Applying skin mappings')
      let totalMatches = 0
      let totalSkins = 0

      for (const data of Object.values(existingData)) {
        data.champions.forEach((champion) => {
          champion.skins.forEach((skin) => {
            if (skin.num !== 0) {
              totalSkins++
              if (skin.lolSkinsName) totalMatches++
            }
          })
        })
      }

      console.log(
        `Total skins: ${totalSkins}, Mapped: ${totalMatches} (${((totalMatches / totalSkins) * 100).toFixed(1)}%)`
      )
    } else {
      // Fetch new data
      const allData: Record<string, ChampionData> = { ...existingData }
      const allChromaData: Record<string, Chroma[]> = {}

      // Build English skin names map for variant matching
      let englishSkinNames: Map<string, string> | undefined

      // Ensure English is fetched first
      if (!allData['en_US']) {
        updateProgress(`Fetching en_US data`)
        const { champions, allChromaData: chromaData } = await fetchAllChampionData(
          version,
          'en_US',
          lolSkinsData,
          championFolders
        )

        // Build English skin names map
        englishSkinNames = new Map()
        champions.forEach((champion) => {
          champion.skins.forEach((skin) => {
            englishSkinNames!.set(skin.id, skin.name)
          })
        })

        Object.assign(allChromaData, chromaData)
        allData['en_US'] = {
          version,
          lastUpdated: new Date().toISOString(),
          champions
        }
      } else {
        // If English data already exists, build the map from it
        englishSkinNames = new Map()
        allData['en_US'].champions.forEach((champion) => {
          champion.skins.forEach((skin) => {
            englishSkinNames!.set(skin.id, skin.name)
          })
        })
      }

      // Fetch other languages
      for (const language of SUPPORTED_LANGUAGES) {
        if (allData[language]) continue // Skip if already loaded

        updateProgress(`Fetching ${language} data`)
        const { champions, allChromaData: chromaData } = await fetchAllChampionData(
          version,
          language,
          lolSkinsData,
          championFolders,
          englishSkinNames
        )

        // Merge chroma data
        Object.assign(allChromaData, chromaData)

        // If non-English, add English names
        if (language !== 'en_US' && allData['en_US']) {
          const englishChampions = allData['en_US'].champions
          champions.forEach((champion) => {
            const englishChampion = englishChampions.find((c) => c.key === champion.key)
            if (englishChampion) {
              // Add English champion name
              champion.nameEn = englishChampion.name

              // Add English skin names
              champion.skins.forEach((skin, index) => {
                const englishSkin = englishChampion.skins[index]
                if (englishSkin) {
                  skin.nameEn = englishSkin.name
                }
              })
            }
          })
        }

        allData[language] = {
          version,
          lastUpdated: new Date().toISOString(),
          champions
        }
      }

      // Fetch win rates from OP.GG using English champion data
      if (!skipWinRates) {
        updateProgress('Fetching win rate data')
        const winRateMap = await fetchAllSkinWinRates(allData['en_US'].champions)

        // Merge win rates into all language data
        for (const languageData of Object.values(allData)) {
          languageData.champions.forEach((champion) => {
            champion.skins.forEach((skin) => {
              const winRateInfo = winRateMap.get(skin.id)
              if (winRateInfo) {
                skin.winRate = winRateInfo.winRate
                skin.pickRate = winRateInfo.pickRate
                skin.totalGames = winRateInfo.totalGames
              }
            })
          })
        }
      }

      // Save all data
      updateProgress('Saving data')
      const chromaData: ChromaData = {
        version,
        lastUpdated: new Date().toISOString(),
        chromaMap: allChromaData
      }
      await saveAllData(dataDir, allData, chromaData)
    }

    const totalTime = ((Date.now() - progress.startTime) / 1000).toFixed(1)
    console.log(`\nAll champion data fetched successfully in ${totalTime}s!`)

    // Performance metrics
    console.log('\n=== Performance Metrics ===')
    console.log(`Total execution time: ${totalTime}s`)
    console.log(
      `Average request rate: ${(progress.completed / parseFloat(totalTime)).toFixed(1)} requests/s`
    )

    if (needsFetch) {
      const totalRequests = championFolders.length * SUPPORTED_LANGUAGES.length
      console.log(`Total API requests made: ~${totalRequests}`)
      console.log(`Concurrency level: ${CONCURRENT_REQUESTS}`)
      console.log(`Cache hit rate: ${cachedVersion ? '100%' : '0%'} (version)`)
    } else {
      console.log('No API requests needed - all data was up to date')
    }
    console.log('===========================\n')
  } catch (error) {
    console.error('Error fetching champion data:', error)
    process.exit(1)
  }
}

main()
