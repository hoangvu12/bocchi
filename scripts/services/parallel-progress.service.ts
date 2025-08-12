import { PERFORMANCE_CONFIG } from '../config/performance.config'

interface LanguageProgress {
  language: string
  completed: number
  total: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  startTime?: number
  endTime?: number
  error?: string
}

export class ParallelProgressService {
  private languageProgress = new Map<string, LanguageProgress>()
  private startTime = Date.now()
  private lastUpdateTime = Date.now()
  private totalRequests = 0
  private completedRequests = 0

  initializeLanguages(languages: string[]) {
    languages.forEach((lang) => {
      this.languageProgress.set(lang, {
        language: lang,
        completed: 0,
        total: 0,
        status: 'pending'
      })
    })
  }

  startLanguage(language: string, total: number) {
    const progress = this.languageProgress.get(language)
    if (progress) {
      progress.status = 'in_progress'
      progress.total = total
      progress.startTime = Date.now()
      this.totalRequests += total
    }
  }

  updateLanguage(language: string, completed: number) {
    const progress = this.languageProgress.get(language)
    if (progress) {
      const previousCompleted = progress.completed
      progress.completed = completed
      this.completedRequests += completed - previousCompleted

      if (completed === progress.total) {
        progress.status = 'completed'
        progress.endTime = Date.now()
      }
    }
  }

  failLanguage(language: string, error: string) {
    const progress = this.languageProgress.get(language)
    if (progress) {
      progress.status = 'failed'
      progress.error = error
      progress.endTime = Date.now()
    }
  }

  shouldPrintUpdate(): boolean {
    const now = Date.now()
    if (now - this.lastUpdateTime >= PERFORMANCE_CONFIG.PROGRESS_UPDATE_INTERVAL) {
      this.lastUpdateTime = now
      return true
    }
    return false
  }

  getFormattedProgress(): string {
    const elapsed = (Date.now() - this.startTime) / 1000
    const rate = this.completedRequests / elapsed
    const percentage =
      this.totalRequests > 0 ? (this.completedRequests / this.totalRequests) * 100 : 0

    // Count language statuses
    let completed = 0
    let inProgress = 0
    let failed = 0

    this.languageProgress.forEach((progress) => {
      if (progress.status === 'completed') completed++
      else if (progress.status === 'in_progress') inProgress++
      else if (progress.status === 'failed') failed++
    })

    const eta =
      this.totalRequests > this.completedRequests
        ? (this.totalRequests - this.completedRequests) / rate
        : 0

    const lines = [
      `═══════════════════════════════════════════════════════════════`,
      `Overall: ${this.completedRequests}/${this.totalRequests} requests (${percentage.toFixed(1)}%)`,
      `Languages: ${completed} completed, ${inProgress} in progress, ${failed} failed`,
      `Rate: ${rate.toFixed(1)} req/s | Elapsed: ${elapsed.toFixed(1)}s | ETA: ${eta.toFixed(1)}s`,
      `═══════════════════════════════════════════════════════════════`
    ]

    // Add active language details
    const activeLanguages = Array.from(this.languageProgress.values())
      .filter((p) => p.status === 'in_progress')
      .slice(0, 5) // Show max 5 active languages

    if (activeLanguages.length > 0) {
      lines.push('Active:')
      activeLanguages.forEach((lang) => {
        const langPercentage = lang.total > 0 ? (lang.completed / lang.total) * 100 : 0
        const langElapsed = lang.startTime
          ? ((Date.now() - lang.startTime) / 1000).toFixed(1)
          : '0.0'
        lines.push(
          `  ${lang.language}: ${lang.completed}/${lang.total} (${langPercentage.toFixed(0)}%) - ${langElapsed}s`
        )
      })
    }

    return lines.join('\n')
  }

  printSummary() {
    const elapsed = (Date.now() - this.startTime) / 1000
    const rate = this.completedRequests / elapsed

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('                    FETCH COMPLETE SUMMARY')
    console.log('═══════════════════════════════════════════════════════════════')

    // Language summary
    const languages = Array.from(this.languageProgress.values())
    const completed = languages.filter((l) => l.status === 'completed')
    const failed = languages.filter((l) => l.status === 'failed')

    console.log(`Languages: ${completed.length}/${languages.length} successful`)

    if (failed.length > 0) {
      console.log(`Failed languages: ${failed.map((l) => l.language).join(', ')}`)
    }

    // Performance metrics
    console.log(`\nPerformance Metrics:`)
    console.log(`  Total Requests: ${this.completedRequests}`)
    console.log(`  Total Time: ${elapsed.toFixed(1)}s`)
    console.log(`  Average Rate: ${rate.toFixed(1)} req/s`)
    console.log(
      `  Peak Concurrency: ~${PERFORMANCE_CONFIG.CHAMPION_CONCURRENCY_PER_LANGUAGE * languages.length} requests`
    )

    // Top performers
    const fastestLanguages = languages
      .filter((l) => l.endTime && l.startTime)
      .sort((a, b) => a.endTime! - a.startTime! - (b.endTime! - b.startTime!))
      .slice(0, 3)

    if (fastestLanguages.length > 0) {
      console.log(`\nFastest Languages:`)
      fastestLanguages.forEach((lang, i) => {
        const time = ((lang.endTime! - lang.startTime!) / 1000).toFixed(1)
        console.log(`  ${i + 1}. ${lang.language}: ${time}s`)
      })
    }

    console.log('═══════════════════════════════════════════════════════════════\n')
  }

  getMetrics() {
    const elapsed = (Date.now() - this.startTime) / 1000
    return {
      totalTime: elapsed,
      requestRate: this.completedRequests / elapsed,
      totalRequests: this.totalRequests,
      completedRequests: this.completedRequests,
      languages: {
        total: this.languageProgress.size,
        completed: Array.from(this.languageProgress.values()).filter(
          (l) => l.status === 'completed'
        ).length,
        failed: Array.from(this.languageProgress.values()).filter((l) => l.status === 'failed')
          .length
      }
    }
  }
}
