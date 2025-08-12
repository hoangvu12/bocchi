import * as fs from 'fs/promises'
import * as path from 'path'
import { ChampionData, ChromaData } from '../types/champion.types'
import { SUPPORTED_LANGUAGES } from '../config/api.config'

export class FileService {
  constructor(private readonly dataDir: string) {}

  async ensureDataDirectory(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true })
  }

  async loadExistingData(
    version: string,
    forceRefresh: boolean
  ): Promise<Record<string, ChampionData>> {
    const existingData: Record<string, ChampionData> = {}
    const targetVersion = forceRefresh ? 'force-refresh' : version

    const loadPromises = SUPPORTED_LANGUAGES.map(async (language) => {
      const filePath = path.join(this.dataDir, `champion-data-${language}.json`)
      try {
        const data = await fs.readFile(filePath, 'utf-8')
        const parsed = JSON.parse(data)
        if (parsed.version === targetVersion) {
          existingData[language] = parsed
          console.log(`Loaded existing data for ${language} (version ${targetVersion})`)
        }
      } catch {
        // File doesn't exist or can't be read
      }
    })

    await Promise.all(loadPromises)
    return existingData
  }

  async saveChampionData(language: string, data: ChampionData): Promise<void> {
    const filePath = path.join(this.dataDir, `champion-data-${language}.json`)
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    console.log(`Saved ${filePath}`)
  }

  async saveChromaData(data: ChromaData): Promise<void> {
    const filePath = path.join(this.dataDir, 'chroma-data.json')
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    console.log(`Saved ${filePath}`)
  }

  async saveSkinMappings(data: ChampionData): Promise<void> {
    const mappingData = {
      version: data.version,
      lastUpdated: new Date().toISOString(),
      skinMappings: [] as any[]
    }

    data.champions.forEach((champion) => {
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

    const filePath = path.join(this.dataDir, 'skin-name-mappings.json')
    await fs.writeFile(filePath, JSON.stringify(mappingData, null, 2))
    console.log(`Saved ${filePath} (${mappingData.skinMappings.length} mappings)`)
  }

  async saveAllData(
    allData: Record<string, ChampionData>,
    chromaData: ChromaData | null
  ): Promise<void> {
    const savePromises: Promise<void>[] = []

    // Save champion data for each language
    for (const [language, data] of Object.entries(allData)) {
      savePromises.push(this.saveChampionData(language, data))
    }

    // Save chroma data
    if (chromaData) {
      savePromises.push(this.saveChromaData(chromaData))
    }

    // Save mapping data
    if (allData['en_US']) {
      savePromises.push(this.saveSkinMappings(allData['en_US']))
    }

    await Promise.all(savePromises)
  }

  async readLolSkinsDirectory(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8')
  }
}
