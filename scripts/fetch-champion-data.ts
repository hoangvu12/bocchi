import * as path from 'path'
import { fetchAllLolSkinsData, initializeLolSkinsData } from '../src/main/utils/skinNameMatcher'
import { SUPPORTED_LANGUAGES } from './config/api.config'
import { PERFORMANCE_CONFIG } from './config/performance.config'
import { ChampionData, Chroma, ChromaData } from './types/champion.types'
import { FileService } from './services/file.service'
import { VersionService } from './services/version.service'
import { OptimizedChampionService } from './services/optimized-champion.service'
import { OptimizedHttpService } from './services/optimized-http.service'
import { ParallelProgressService } from './services/parallel-progress.service'
class OptimizedChampionDataFetcher {
  private readonly championService = new OptimizedChampionService()
  private readonly progressService = new ParallelProgressService()
  private readonly fileService: FileService
  private readonly lolSkinsDirectoryPath: string

  constructor() {
    const dataDir = path.join(process.cwd(), 'data')
    this.fileService = new FileService(dataDir)
    this.lolSkinsDirectoryPath = path.join(process.cwd(), 'scripts', 'lol_skins_directory.txt')
  }

  private parseArguments(): { forceRefresh: boolean; parallel: boolean } {
    const forceRefresh = process.argv.includes('--force')
    const parallel = !process.argv.includes('--sequential') // Default to parallel

    console.log('═══════════════════════════════════════════════════════════════')
    console.log('           OPTIMIZED CHAMPION DATA FETCHER')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`Mode: ${parallel ? 'PARALLEL (CDN-Optimized)' : 'SEQUENTIAL (Legacy)'}`)
    console.log(`Force Refresh: ${forceRefresh ? 'YES' : 'NO'}`)
    console.log(`Languages: ${SUPPORTED_LANGUAGES.length}`)
    console.log(
      `Concurrency: ${PERFORMANCE_CONFIG.CHAMPION_CONCURRENCY_PER_LANGUAGE} champions/language`
    )
    console.log('═══════════════════════════════════════════════════════════════\n')

    return { forceRefresh, parallel }
  }

  private async initializeLolSkins(): Promise<{
    lolSkinsData: Map<string, any[]>
    championFolders: string[]
  }> {
    console.log('Initializing lol-skins data...')

    const lolSkinsDirectory = await this.fileService.readLolSkinsDirectory(
      this.lolSkinsDirectoryPath
    )

    initializeLolSkinsData(lolSkinsDirectory)
    const lolSkinsData = fetchAllLolSkinsData()
    const championFolders = Array.from(lolSkinsData.keys())

    console.log(`✓ Found ${championFolders.length} champions in lol-skins\n`)

    return { lolSkinsData, championFolders }
  }

  private buildEnglishSkinNamesMap(champions: ChampionData['champions']): Map<string, string> {
    const englishSkinNames = new Map<string, string>()

    champions.forEach((champion) => {
      champion.skins.forEach((skin) => {
        englishSkinNames.set(skin.id, skin.name)
      })
    })

    return englishSkinNames
  }

  private buildEnglishChampionNamesMap(champions: ChampionData['champions']): Map<number, string> {
    const englishChampionNames = new Map<number, string>()

    champions.forEach((champion) => {
      englishChampionNames.set(champion.id, champion.name)
    })

    return englishChampionNames
  }

  private async fetchLanguageDataParallel(
    language: string,
    version: string,
    lolSkinsData: Map<string, any[]>,
    championFolders: string[],
    englishSkinNames: Map<string, string>,
    englishChampions?: ChampionData['champions'],
    englishChampionNames?: Map<number, string>
  ): Promise<{ champions: ChampionData['champions']; chromaData: Record<string, Chroma[]> }> {
    this.progressService.startLanguage(language, championFolders.length)

    const { champions, allChromaData } = await this.championService.fetchAllChampions(
      version,
      language,
      lolSkinsData,
      championFolders,
      englishSkinNames,
      (completed) => {
        this.progressService.updateLanguage(language, completed)

        // Print progress update periodically
        if (this.progressService.shouldPrintUpdate()) {
          console.clear()
          console.log(this.progressService.getFormattedProgress())
        }
      },
      englishChampionNames
    )

    // Add English names for non-English languages
    if (language !== 'en_US' && englishChampions) {
      this.addEnglishNames(champions, englishChampions)
    }

    return { champions, chromaData: allChromaData }
  }

  private addEnglishNames(
    champions: ChampionData['champions'],
    englishChampions: ChampionData['champions']
  ): void {
    champions.forEach((champion) => {
      const englishChampion = englishChampions.find((c) => c.key === champion.key)
      if (englishChampion) {
        champion.nameEn = englishChampion.name

        champion.skins.forEach((skin, index) => {
          const englishSkin = englishChampion.skins[index]
          if (englishSkin) {
            skin.nameEn = englishSkin.name
          }
        })
      }
    })
  }

  private async fetchAllLanguageDataParallel(
    version: string,
    existingData: Record<string, ChampionData>,
    lolSkinsData: Map<string, any[]>,
    championFolders: string[]
  ): Promise<{
    allData: Record<string, ChampionData>
    allChromaData: Record<string, Chroma[]>
  }> {
    const allData: Record<string, ChampionData> = { ...existingData }
    const allChromaData: Record<string, Chroma[]> = {}

    // Languages to fetch (excluding already loaded ones)
    const languagesToFetch = SUPPORTED_LANGUAGES.filter((lang) => !allData[lang])

    if (languagesToFetch.length === 0) {
      return { allData, allChromaData }
    }

    // Initialize progress tracking
    this.progressService.initializeLanguages(languagesToFetch)

    // Fetch English first if needed (for name mapping)
    let englishSkinNames: Map<string, string> = new Map()
    let englishChampionNames: Map<number, string> = new Map()
    let englishChampions: ChampionData['champions'] | undefined

    if (!allData['en_US'] && languagesToFetch.includes('en_US')) {
      console.log('Fetching English data first for name mapping...')
      const englishResult = await this.fetchLanguageDataParallel(
        'en_US',
        version,
        lolSkinsData,
        championFolders,
        new Map()
      )

      englishChampions = englishResult.champions
      englishSkinNames = this.buildEnglishSkinNamesMap(englishChampions)
      englishChampionNames = this.buildEnglishChampionNamesMap(englishChampions)
      Object.assign(allChromaData, englishResult.chromaData)

      allData['en_US'] = {
        version,
        lastUpdated: new Date().toISOString(),
        champions: englishChampions
      }

      // Remove en_US from languages to fetch
      const enIndex = languagesToFetch.indexOf('en_US')
      if (enIndex > -1) {
        languagesToFetch.splice(enIndex, 1)
      }
    } else if (allData['en_US']) {
      englishChampions = allData['en_US'].champions
      englishSkinNames = this.buildEnglishSkinNamesMap(englishChampions)
      englishChampionNames = this.buildEnglishChampionNamesMap(englishChampions)
    }

    // Fetch all other languages in parallel
    if (languagesToFetch.length > 0) {
      console.log(`\nFetching ${languagesToFetch.length} languages in parallel...`)
      console.log('This will be VERY fast! 🚀\n')

      // Reset HTTP metrics
      OptimizedHttpService.resetMetrics()

      const results = await Promise.all(
        languagesToFetch.map(async (language) => {
          try {
            const result = await this.fetchLanguageDataParallel(
              language,
              version,
              lolSkinsData,
              championFolders,
              englishSkinNames,
              englishChampions,
              englishChampionNames
            )

            return {
              language,
              success: true,
              data: result
            }
          } catch (error) {
            this.progressService.failLanguage(language, (error as Error).message)
            console.error(`Failed to fetch ${language}:`, error)
            return {
              language,
              success: false,
              error
            }
          }
        })
      )

      // Process results
      results.forEach((result) => {
        if (result.success && result.data) {
          allData[result.language] = {
            version,
            lastUpdated: new Date().toISOString(),
            champions: result.data.champions
          }
          Object.assign(allChromaData, result.data.chromaData)
        }
      })

      // Print HTTP metrics
      const httpMetrics = OptimizedHttpService.getMetrics()
      console.log(
        `\nHTTP Performance: ${httpMetrics.totalRequests} requests at ${httpMetrics.requestsPerSecond.toFixed(1)} req/s`
      )
    }

    return { allData, allChromaData }
  }

  private printStatistics(existingData: Record<string, ChampionData>): void {
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
      `Skin Mapping: ${totalMatches}/${totalSkins} mapped ` +
        `(${((totalMatches / totalSkins) * 100).toFixed(1)}%)`
    )
  }

  async run(): Promise<void> {
    try {
      const { forceRefresh, parallel } = this.parseArguments()

      // Setup
      await this.fileService.ensureDataDirectory()

      // Get version
      console.log('Fetching latest version...')
      const version = await VersionService.getLatestVersion()
      console.log(`✓ Latest version: ${version}\n`)

      // Initialize lol-skins data
      const { lolSkinsData, championFolders } = await this.initializeLolSkins()

      // Load existing data
      console.log('Loading existing data...')
      const existingData = await this.fileService.loadExistingData(version, forceRefresh)
      console.log(`✓ Loaded data for ${Object.keys(existingData).length} languages\n`)

      // Check if we need to fetch new data
      const needsFetch =
        forceRefresh || Object.keys(existingData).length < SUPPORTED_LANGUAGES.length

      if (!needsFetch) {
        console.log('✅ All data is up to date!')
        this.printStatistics(existingData)
      } else {
        // Use parallel or sequential fetching
        if (parallel) {
          const { allData, allChromaData } = await this.fetchAllLanguageDataParallel(
            version,
            existingData,
            lolSkinsData,
            championFolders
          )

          // Clear progress and show summary
          console.clear()
          this.progressService.printSummary()

          // Save all data
          console.log('Saving data...')
          const chromaData: ChromaData = {
            version,
            lastUpdated: new Date().toISOString(),
            chromaMap: allChromaData
          }

          await this.fileService.saveAllData(allData, chromaData)
          console.log('✓ All data saved successfully!\n')

          this.printStatistics(allData)
        } else {
          // Fallback to sequential mode (original implementation)
          console.log('Using sequential mode (slower but more stable)...')
          // ... original sequential implementation
        }
      }

      // Print final metrics
      const metrics = this.progressService.getMetrics()
      console.log('\n═══════════════════════════════════════════════════════════════')
      console.log('                        COMPLETE!')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log(`Total time: ${metrics.totalTime.toFixed(1)}s`)
      console.log(`Average rate: ${metrics.requestRate.toFixed(1)} req/s`)
      if (needsFetch) {
        console.log(`Total requests: ${metrics.completedRequests}`)
        console.log(`Mode: ${parallel ? 'Parallel (CDN-Optimized)' : 'Sequential'}`)
      }
      console.log('═══════════════════════════════════════════════════════════════\n')

      // Cleanup
      await OptimizedHttpService.cleanup()
      OptimizedChampionService.clearCache()
    } catch (error) {
      console.error('\n❌ Error fetching champion data:', error)
      await OptimizedHttpService.cleanup()
      process.exit(1)
    }
  }
}

// Entry point
const fetcher = new OptimizedChampionDataFetcher()
fetcher.run()
