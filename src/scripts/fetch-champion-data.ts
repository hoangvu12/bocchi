import axios from 'axios'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  fetchAllLolSkinsData,
  findBestSkinMatch,
  findChampionFolder,
  initializeLolSkinsData
} from '../main/utils/skinNameMatcher'
import { LOL_SKINS_DIRECTORY } from '../main/data/lolSkinsDirectory'

const SUPPORTED_LANGUAGES = ['en_US', 'vi_VN']
const DDRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com'
const DELAY_BETWEEN_REQUESTS = 50

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

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getLatestVersion(): Promise<string> {
  const response = await axios.get(`${DDRAGON_BASE_URL}/api/versions.json`)
  return response.data[0]
}

async function fetchChampionData(
  version: string,
  language: string,
  lolSkinsData: Map<string, any[]>,
  championFolders: string[]
): Promise<Champion[]> {
  console.log(`Fetching champion data for ${language}...`)

  // Fetch basic champion list
  const listUrl = `${DDRAGON_BASE_URL}/cdn/${version}/data/${language}/champion.json`
  const listResponse = await axios.get(listUrl)
  const championList = listResponse.data.data

  const champions: Champion[] = []
  const championKeys = Object.keys(championList)

  // Fetch detailed data for each champion
  for (let i = 0; i < championKeys.length; i++) {
    const key = championKeys[i]
    const champion = championList[key]

    console.log(`  Fetching ${champion.name} (${i + 1}/${championKeys.length})...`)

    const detailUrl = `${DDRAGON_BASE_URL}/cdn/${version}/data/${language}/champion/${key}.json`
    const detailResponse = await axios.get(detailUrl)
    const detailData = detailResponse.data.data[key]

    // Find the matching champion folder in lol-skins
    const championFolder = findChampionFolder(detailData.name, championFolders)
    const lolSkinsList = championFolder ? lolSkinsData.get(championFolder) || [] : []

    const championData: Champion = {
      id: parseInt(detailData.key),
      key: detailData.id,
      name: detailData.name,
      title: detailData.title,
      image: `${DDRAGON_BASE_URL}/cdn/${version}/img/champion/${detailData.image.full}`,
      tags: detailData.tags,
      skins: detailData.skins.map((skin: any) => {
        const skinName = skin.name === 'default' ? detailData.name : skin.name
        const match = findBestSkinMatch(skinName, lolSkinsList)

        return {
          id: `${detailData.key}_${skin.num}`,
          num: skin.num,
          name: skinName,
          lolSkinsName:
            match && match.skinInfo.skinName !== skinName ? match.skinInfo.skinName : undefined,
          chromas: skin.chromas || false
        }
      })
    }

    champions.push(championData)

    // Add delay between requests
    if (i < championKeys.length - 1) {
      await delay(DELAY_BETWEEN_REQUESTS)
    }
  }

  // Sort champions by name
  champions.sort((a, b) => a.name.localeCompare(b.name))

  return champions
}

async function main() {
  try {
    // Create data directory
    const dataDir = path.join(process.cwd(), 'data')
    await fs.mkdir(dataDir, { recursive: true })

    // Get latest version
    console.log('Fetching latest version...')
    const version = await getLatestVersion()
    console.log(`Latest version: ${version}`)

    // Initialize lol-skins data with hardcoded directory structure
    console.log('Initializing lol-skins data...')
    initializeLolSkinsData(LOL_SKINS_DIRECTORY)

    // Fetch all lol-skins data
    const lolSkinsData = fetchAllLolSkinsData()
    const championFolders = Array.from(lolSkinsData.keys())
    console.log(`Found ${championFolders.length} champions in lol-skins`)

    // Debug: Show first few champions
    if (championFolders.length > 0) {
      console.log('Sample champion folders:', championFolders.slice(0, 5))
      const firstChampion = championFolders[0]
      const firstChampionSkins = lolSkinsData.get(firstChampion) || []
      console.log(
        `Sample skins for ${firstChampion}:`,
        firstChampionSkins.slice(0, 3).map((s) => s.skinName)
      )
    } else {
      console.log('WARNING: No champion folders found in lol-skins data!')
      console.log('First 500 chars of LOL_SKINS_DIRECTORY:', LOL_SKINS_DIRECTORY.substring(0, 500))
    }

    // Store all fetched data
    const allData: Record<string, ChampionData> = {}

    // Check if data already exists
    for (const language of SUPPORTED_LANGUAGES) {
      const filePath = path.join(dataDir, `champion-data-${language}.json`)
      try {
        const existingData = await fs.readFile(filePath, 'utf-8')
        const parsedData = JSON.parse(existingData)

        // If data exists and version matches, skip fetching
        if (parsedData.version === version) {
          console.log(
            `Data for ${language} already exists with latest version ${version}, skipping...`
          )
          allData[language] = parsedData
          continue
        }
      } catch {
        // File doesn't exist or can't be read, continue with fetching
      }
    }

    // Apply skin name mapping to existing data
    if (Object.keys(allData).length > 0) {
      console.log('Applying skin name mapping to existing data...')
      let totalMatches = 0
      let totalSkins = 0
      let identicalSkins = 0
      let noMatchSkins = 0
      let chromasSkipped = 0
      const missingChampions: string[] = []
      const noMatchData: any[] = []

      for (const language of Object.keys(allData)) {
        const data = allData[language]
        console.log(`Processing ${data.champions.length} champions for ${language}...`)
        data.champions.forEach((champion) => {
          // Try multiple variations of the champion name
          let championFolder = champion.name
          let lolSkinsList = lolSkinsData.get(championFolder) || []

          // Try without spaces (e.g., "Xin Zhao" -> "XinZhao")
          if (lolSkinsList.length === 0) {
            championFolder = champion.name.replace(/\s+/g, '')
            lolSkinsList = lolSkinsData.get(championFolder) || []
          }

          // Try with underscores (e.g., "Xin Zhao" -> "Xin_Zhao")
          if (lolSkinsList.length === 0) {
            championFolder = champion.name.replace(/\s+/g, '_')
            lolSkinsList = lolSkinsData.get(championFolder) || []
          }

          // If still not found, try with findChampionFolder
          if (lolSkinsList.length === 0) {
            const foundFolder = findChampionFolder(champion.name, championFolders)
            if (foundFolder) {
              championFolder = foundFolder
              lolSkinsList = lolSkinsData.get(championFolder) || []
            }
          }

          if (lolSkinsList.length > 0) {
            // Match skin names
            champion.skins.forEach((skin) => {
              // Skip chromas
              if (skin.chromas) {
                chromasSkipped++
                return
              }

              // Skip default skins (base champion skin)
              if (skin.num === 0) {
                totalSkins++
                identicalSkins++ // Count as identical since it's the base skin
                return
              }

              totalSkins++
              if (!skin.lolSkinsName) {
                const match = findBestSkinMatch(skin.name, lolSkinsList)
                if (match && match.skinInfo) {
                  const lolSkinsName = match.skinInfo.skinName
                  if (lolSkinsName !== skin.name) {
                    skin.lolSkinsName = lolSkinsName
                    totalMatches++

                    // Show matches with low similarity scores
                    if (match.similarity < 0.7) {
                      console.log(
                        `  [${champion.name}] LOW: "${skin.name}" -> "${lolSkinsName}" (${match.similarity.toFixed(2)})`
                      )
                    } else if (totalMatches <= 10 || match.similarity > 0.9) {
                      console.log(
                        `  [${champion.name}] Matched "${skin.name}" -> "${lolSkinsName}" (${match.similarity.toFixed(2)})`
                      )
                    }
                  } else {
                    identicalSkins++
                    // Show some examples of identical skins
                    if (identicalSkins <= 5) {
                      console.log(`  [${champion.name}] Identical: "${skin.name}"`)
                    }
                  }
                } else {
                  noMatchSkins++
                  // Log all no-match data
                  noMatchData.push({
                    championName: champion.name,
                    championKey: champion.key,
                    skinName: skin.name,
                    skinNum: skin.num,
                    availableInLolSkins: lolSkinsList.map((s) => s.skinName)
                  })

                  // Show some examples of no matches
                  if (noMatchSkins <= 5) {
                    console.log(`  [${champion.name}] No match found: "${skin.name}"`)
                    if (lolSkinsList.length > 0) {
                      console.log(
                        `    Available: ${lolSkinsList
                          .slice(0, 3)
                          .map((s) => s.skinName)
                          .join(', ')}...`
                      )
                    }
                  }
                }
              }
            })
          } else {
            // Count all skins for this champion as no match
            champion.skins.forEach((skin) => {
              // Skip chromas
              if (skin.chromas) {
                chromasSkipped++
                return
              }

              // Skip default skins (base champion skin)
              if (skin.num === 0) {
                totalSkins++
                identicalSkins++ // Count as identical since it's the base skin
                return
              }

              totalSkins++
              noMatchSkins++
              // Log all skins for missing champions
              noMatchData.push({
                championName: champion.name,
                championKey: champion.key,
                skinName: skin.name,
                skinNum: skin.num,
                availableInLolSkins: [],
                reason: 'Champion not found in lol-skins'
              })
            })
            missingChampions.push(champion.name)
            if (missingChampions.length <= 5) {
              console.log(
                `  Warning: No skins found for champion "${champion.name}" (${champion.skins.length} skins)`
              )
            }
          }
        })
      }
      console.log(`\n=== Skin Matching Summary ===`)
      console.log(`Total skins processed: ${totalSkins} (excluding ${chromasSkipped} chromas)`)
      console.log(
        `Different names (mapped): ${totalMatches} (${((totalMatches / totalSkins) * 100).toFixed(1)}%)`
      )
      console.log(
        `Identical names: ${identicalSkins} (${((identicalSkins / totalSkins) * 100).toFixed(1)}%)`
      )
      console.log(
        `No match found: ${noMatchSkins} (${((noMatchSkins / totalSkins) * 100).toFixed(1)}%)`
      )

      if (missingChampions.length > 0) {
        console.log(`\nMissing champions in lol-skins (${missingChampions.length} total):`)
        console.log(
          missingChampions.slice(0, 10).join(', ') + (missingChampions.length > 10 ? '...' : '')
        )
      }
      console.log(`===========================\n`)

      // Save no-match data to file
      if (noMatchData.length > 0) {
        const noMatchPath = path.join(dataDir, 'no-match-skins.json')
        const noMatchReport = {
          generatedAt: new Date().toISOString(),
          totalNoMatch: noMatchData.length,
          byChampion: {} as Record<string, any>,
          details: noMatchData
        }

        // Group by champion for easier analysis
        noMatchData.forEach((item) => {
          if (!noMatchReport.byChampion[item.championName]) {
            noMatchReport.byChampion[item.championName] = {
              championKey: item.championKey,
              noMatchSkins: [],
              availableInLolSkins: item.availableInLolSkins
            }
          }
          noMatchReport.byChampion[item.championName].noMatchSkins.push({
            name: item.skinName,
            num: item.skinNum,
            reason: item.reason
          })
        })

        await fs.writeFile(noMatchPath, JSON.stringify(noMatchReport, null, 2))
        console.log(`Saved no-match skins report to ${noMatchPath}`)
      }
    }

    // Fetch data for each language
    for (const language of SUPPORTED_LANGUAGES) {
      // Skip if already loaded
      if (allData[language]) continue

      const champions = await fetchChampionData(version, language, lolSkinsData, championFolders)

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

      // Save to file
      const data: ChampionData = {
        version,
        lastUpdated: new Date().toISOString(),
        champions
      }

      allData[language] = data

      const filePath = path.join(dataDir, `champion-data-${language}.json`)
      await fs.writeFile(filePath, JSON.stringify(data, null, 2))
      console.log(`Saved ${filePath}`)
    }

    // Save updated data for languages that were loaded from existing files
    for (const language of SUPPORTED_LANGUAGES) {
      if (allData[language] && !allData[language].lastUpdated) {
        // This means it was loaded from existing file, update it with new mappings
        allData[language].lastUpdated = new Date().toISOString()
        const filePath = path.join(dataDir, `champion-data-${language}.json`)
        await fs.writeFile(filePath, JSON.stringify(allData[language], null, 2))
        console.log(`Updated ${filePath} with skin mappings`)
      }
    }

    // Create a mapping file for lol-skins skin names
    const mappingData = {
      version,
      lastUpdated: new Date().toISOString(),
      skinMappings: [] as any[]
    }

    // Collect mappings from English data
    if (allData['en_US']) {
      allData['en_US'].champions.forEach((champion) => {
        champion.skins.forEach((skin) => {
          // Skip chromas
          if (skin.chromas) {
            return
          }

          // Skip default skins (base champion skin)
          if (skin.num === 0) {
            return
          }

          if (skin.lolSkinsName) {
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
    }

    const mappingPath = path.join(dataDir, 'skin-name-mappings.json')
    await fs.writeFile(mappingPath, JSON.stringify(mappingData, null, 2))
    console.log(`Saved skin name mappings to ${mappingPath}`)
    console.log(`Total skin mappings: ${mappingData.skinMappings.length}`)

    console.log('All champion data fetched successfully!')
  } catch (error) {
    console.error('Error fetching champion data:', error)
    process.exit(1)
  }
}

main()

// const lolSkinsData = await fetchAllLolSkinsData()
// const championFolders = Array.from(lolSkinsData.keys())

// console.log(championFolders)
