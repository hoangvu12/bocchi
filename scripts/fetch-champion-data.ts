import axios from 'axios'
import * as fs from 'fs/promises'
import * as path from 'path'
import pLimit from 'p-limit'
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

const SUPPORTED_LANGUAGES = ['en_US', 'vi_VN']
const DDRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com'
const CDRAGON_BASE_URL =
  'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1'

// Optimized settings
const CONCURRENT_REQUESTS = 10 // Increased from sequential to 10 concurrent
const RETRY_ATTEMPTS = 3
const RETRY_DELAY = 1000

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
  nameEn?: string
  lolSkinsName?: string
  chromas: boolean
}

interface Champion {
  id: number
  key: string
  name: string
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
  // Map from skinId (e.g., "266002") to array of chromas
  chromaMap: Record<string, Chroma[]>
}

interface ProgressTracker {
  total: number
  completed: number
  startTime: number
  currentPhase: string
}

const progress: ProgressTracker = {
  total: 0,
  completed: 0,
  startTime: Date.now(),
  currentPhase: 'Initializing'
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

async function fetchChromaDataForChampion(championId: number): Promise<Record<string, Chroma[]>> {
  try {
    const url = `${CDRAGON_BASE_URL}/champions/${championId}.json`
    const response = await retryRequest(() => axios.get(url))
    const data = response.data

    const chromaMap: Record<string, Chroma[]> = {}

    if (data.skins) {
      for (const skin of data.skins) {
        if (skin.chromas && skin.chromas.length > 0) {
          const chromas: Chroma[] = skin.chromas.map((chroma: any) => ({
            id: chroma.id,
            name: chroma.name,
            chromaPath: chroma.chromaPath
              ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default${chroma.chromaPath.replace('/lol-game-data/assets/', '/')}`
              : '',
            colors: chroma.colors || []
          }))
          // Create skinId in format "championId_skinNum" (e.g., "266_2")
          const skinNum = Math.floor(skin.id / 1000) === championId ? skin.id % 1000 : 0
          const skinId = `${championId}_${skinNum}`
          chromaMap[skinId] = chromas
        }
      }
    }

    return chromaMap
  } catch (error) {
    console.warn(`Failed to fetch chroma data for champion ${championId}:`, error.message)
    return {}
  }
}

async function fetchChampionDetailAndChroma(
  key: string,
  championBasic: any,
  version: string,
  language: string,
  lolSkinsData: Map<string, any[]>,
  championNameLookup: Map<string, string>
): Promise<{ champion: Champion; chromaData: Record<string, Chroma[]> }> {
  const detailUrl = `${DDRAGON_BASE_URL}/cdn/${version}/data/${language}/champion/${key}.json`

  // Fetch champion detail and chroma data in parallel
  const [detailResponse, chromaData] = await Promise.all([
    retryRequest(() => axios.get(detailUrl)),
    fetchChromaDataForChampion(parseInt(championBasic.key))
  ])

  const detailData = detailResponse.data.data[key]

  // Use lookup map for faster champion folder finding
  const normalizedName = detailData.name.toLowerCase()
  let championFolder = championNameLookup.get(normalizedName)

  if (!championFolder) {
    // Fallback to original method if not in lookup
    championFolder =
      findChampionFolder(detailData.name, Array.from(lolSkinsData.keys())) || undefined
  }

  const lolSkinsList = championFolder ? lolSkinsData.get(championFolder) || [] : []
  const championId = parseInt(detailData.key)

  const champion: Champion = {
    id: championId,
    key: detailData.id,
    name: detailData.name,
    title: detailData.title,
    image: `${DDRAGON_BASE_URL}/cdn/${version}/img/champion/${detailData.image.full}`,
    tags: detailData.tags,
    skins: detailData.skins.map((skin: any) => {
      const skinName = skin.name === 'default' ? detailData.name : skin.name

      // Don't try to match base skins (num: 0) with lol-skins
      const match = skin.num === 0 ? null : findBestSkinMatch(skinName, lolSkinsList)

      // Check if this skin has chromas based on the provided chroma data
      const skinId = `${championId}_${skin.num}`
      const hasChromas = chromaData[skinId] && chromaData[skinId].length > 0

      return {
        id: skinId,
        num: skin.num,
        name: skinName,
        lolSkinsName:
          match && match.skinInfo.skinName !== skinName ? match.skinInfo.skinName : undefined,
        chromas: hasChromas
      }
    })
  }

  return { champion, chromaData }
}

async function fetchAllChampionData(
  version: string,
  language: string,
  lolSkinsData: Map<string, any[]>,
  championFolders: string[]
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
          const result = await fetchChampionDetailAndChroma(
            key,
            championList[key],
            version,
            language,
            lolSkinsData,
            championNameLookup
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
): Promise<{
  existingData: Record<string, ChampionData>
  existingChromaData: ChromaData | null
}> {
  const existingData: Record<string, ChampionData> = {}
  let existingChromaData: ChromaData | null = null

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

  // Load chroma data
  loadPromises.push(
    (async () => {
      const chromaDataPath = path.join(dataDir, 'chroma-data.json')
      try {
        const data = await fs.readFile(chromaDataPath, 'utf-8')
        const parsed = JSON.parse(data)
        if (parsed.version === version) {
          existingChromaData = parsed
          console.log(`Loaded existing chroma data (version ${version})`)
        }
      } catch {
        // File doesn't exist
      }
    })()
  )

  await Promise.all(loadPromises)

  return { existingData, existingChromaData }
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
    if (forceRefresh) {
      console.log('Force refresh enabled - will fetch all data regardless of version')
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
    const { existingData, existingChromaData } = await loadExistingData(
      dataDir,
      forceRefresh ? 'force-refresh' : version
    )

    // Check if we need to fetch new data
    const needsFetch =
      forceRefresh ||
      Object.keys(existingData).length < SUPPORTED_LANGUAGES.length ||
      !existingChromaData

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
      const allChromaData: Record<string, Chroma[]> = existingChromaData?.chromaMap ?? {}

      for (const language of SUPPORTED_LANGUAGES) {
        if (allData[language]) continue // Skip if already loaded

        updateProgress(`Fetching ${language} data`)
        const { champions, allChromaData: chromaData } = await fetchAllChampionData(
          version,
          language,
          lolSkinsData,
          championFolders
        )

        // Merge chroma data
        Object.assign(allChromaData, chromaData)

        // If non-English, add English names
        if (language !== 'en_US' && allData['en_US']) {
          const englishChampions = allData['en_US'].champions
          champions.forEach((champion) => {
            const englishChampion = englishChampions.find((c) => c.key === champion.key)
            if (englishChampion) {
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
