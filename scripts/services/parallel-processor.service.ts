import pLimit from 'p-limit'
import { PERFORMANCE_CONFIG } from '../config/performance.config'
import { SUPPORTED_LANGUAGES } from '../config/api.config'

interface BatchResult<T> {
  language: string
  success: boolean
  data?: T
  error?: Error
}

export class ParallelProcessorService {
  private languageProgress: Map<string, { completed: number; total: number }> = new Map()
  private startTime = Date.now()

  async processLanguagesInParallel<T>(
    processFn: (language: string) => Promise<T>,
    onProgress?: (status: string) => void
  ): Promise<BatchResult<T>[]> {
    const languages = SUPPORTED_LANGUAGES
    const results: BatchResult<T>[] = []

    // Reset progress tracking
    this.languageProgress.clear()
    languages.forEach((lang) => {
      this.languageProgress.set(lang, { completed: 0, total: 0 })
    })

    // Determine concurrency level
    const concurrency = PERFORMANCE_CONFIG.LANGUAGE_CONCURRENCY || languages.length
    const limit = pLimit(concurrency)

    if (onProgress) {
      onProgress(
        `Starting parallel processing of ${languages.length} languages with concurrency: ${concurrency}`
      )
    }

    // Process all languages in parallel
    const promises = languages.map((language) =>
      limit(async () => {
        try {
          const startTime = Date.now()
          const data = await processFn(language)
          const elapsed = Date.now() - startTime

          results.push({
            language,
            success: true,
            data
          })

          if (onProgress) {
            onProgress(`✓ ${language} completed in ${(elapsed / 1000).toFixed(1)}s`)
          }

          return { language, success: true, data }
        } catch (error) {
          results.push({
            language,
            success: false,
            error: error as Error
          })

          if (onProgress) {
            onProgress(`✗ ${language} failed: ${(error as Error).message}`)
          }

          return { language, success: false, error }
        }
      })
    )

    await Promise.all(promises)
    return results
  }

  updateLanguageProgress(language: string, completed: number, total: number) {
    const progress = this.languageProgress.get(language)
    if (progress) {
      progress.completed = completed
      progress.total = total
    }
  }

  getOverallProgress(): { completed: number; total: number; percentage: number } {
    let totalCompleted = 0
    let totalItems = 0

    this.languageProgress.forEach((progress) => {
      totalCompleted += progress.completed
      totalItems += progress.total
    })

    const percentage = totalItems > 0 ? (totalCompleted / totalItems) * 100 : 0
    return { completed: totalCompleted, total: totalItems, percentage }
  }

  getElapsedTime(): number {
    return (Date.now() - this.startTime) / 1000
  }

  getEstimatedTimeRemaining(): number {
    const progress = this.getOverallProgress()
    if (progress.completed === 0) return 0

    const elapsed = this.getElapsedTime()
    const rate = progress.completed / elapsed
    const remaining = progress.total - progress.completed
    return remaining / rate
  }

  getLanguageStatuses(): Map<string, string> {
    const statuses = new Map<string, string>()

    this.languageProgress.forEach((progress, language) => {
      if (progress.total === 0) {
        statuses.set(language, 'pending')
      } else if (progress.completed === progress.total) {
        statuses.set(language, 'completed')
      } else {
        const percentage = (progress.completed / progress.total) * 100
        statuses.set(language, `${percentage.toFixed(0)}%`)
      }
    })

    return statuses
  }
}
