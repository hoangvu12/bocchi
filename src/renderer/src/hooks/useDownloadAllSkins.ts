import { useState, useCallback, useEffect, useMemo } from 'react'
import { useChampionData } from './useChampionData'

interface DownloadProgress {
  totalSkins: number
  completedSkins: number
  currentSkin: string | null
  currentProgress: number
  downloadSpeed: number
  timeRemaining: number
  failedSkins: string[]
  isRunning: boolean
  isPaused: boolean
}

interface DownloadOptions {
  excludeChromas: boolean
  excludeVariants: boolean
  excludeLegacy: boolean
  excludeEsports: boolean
  onlyFavorites: boolean
  concurrency: number
  overwriteExisting?: boolean
}

export function useDownloadAllSkins() {
  const { championData } = useChampionData()
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false)
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false)
  const [progress, setProgress] = useState<DownloadProgress>({
    totalSkins: 0,
    completedSkins: 0,
    currentSkin: null,
    currentProgress: 0,
    downloadSpeed: 0,
    timeRemaining: 0,
    failedSkins: [],
    isRunning: false,
    isPaused: false
  })
  // Set up progress listener for bulk download
  useEffect(() => {
    const unsubscribe = window.api.onDownloadAllSkinsBulkProgress((progressData) => {
      // Convert bulk progress to old format for UI compatibility
      const convertedProgress: DownloadProgress = {
        totalSkins: progressData.totalFiles || 0,
        completedSkins: progressData.processedFiles || 0,
        currentSkin: progressData.currentFile || null,
        currentProgress:
          progressData.phase === 'downloading'
            ? Math.round(((progressData.downloadedSize || 0) / (progressData.totalSize || 1)) * 100)
            : progressData.phase === 'processing'
              ? 100
              : 0,
        downloadSpeed: progressData.downloadSpeed || 0,
        timeRemaining: progressData.timeRemaining || 0,
        failedSkins: progressData.failedFiles || [],
        isRunning: progressData.phase !== 'completed',
        isPaused: false,
        // Additional fields for UI
        phase: progressData.phase,
        overallProgress: progressData.overallProgress,
        skippedFiles: progressData.skippedFiles
      } as DownloadProgress & { phase?: string; overallProgress?: number; skippedFiles?: number }

      setProgress(convertedProgress)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const getAllSkinUrls = useCallback(
    (
      options: DownloadOptions = {
        excludeChromas: false,
        excludeVariants: false,
        excludeLegacy: false,
        excludeEsports: false,
        onlyFavorites: false,
        concurrency: 3
      }
    ): string[] => {
      if (!championData) return []

      const urls: string[] = []

      for (const champion of championData.champions) {
        for (const skin of champion.skins) {
          // Skip base skins (usually skin ID 0)
          if (skin.num === 0) continue

          // Filter by skin type
          if (options.excludeLegacy && skin.isLegacy) continue
          if (
            options.excludeEsports &&
            (skin.skinLines?.some((line) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(line.id)) || // Popular esports line IDs
              skin.name.toLowerCase().includes('championship') ||
              skin.name.toLowerCase().includes('worlds') ||
              skin.name.toLowerCase().includes('msi') ||
              skin.name.toLowerCase().includes('lcs') ||
              skin.name.toLowerCase().includes('lec') ||
              skin.name.toLowerCase().includes('lck') ||
              skin.name.toLowerCase().includes('lpl'))
          )
            continue

          // Filter variants (skins with slashes or special naming patterns)
          if (
            options.excludeVariants &&
            (skin.name.includes('/') ||
              skin.name.includes('Prestige') ||
              skin.name.includes('Chroma') ||
              skin.name.includes('Border') ||
              skin.name.includes('Variant'))
          )
            continue

          // Use the English name or fallback to localized name for identification
          const championKey = champion.key
          const skinName = skin.nameEn || skin.name

          // Store a pseudo identifier so we can count skins without relying on a specific repository
          const identifier = `${championKey}/${skinName}.zip`
          urls.push(identifier)

          // Add chromas if they exist and not excluded
          if (!options.excludeChromas && skin.chromas && skin.chromaList) {
            for (const chroma of skin.chromaList) {
              const chromaName = `${skinName} ${chroma.id}.zip`
              const chromaIdentifier = `${championKey}/${chromaName}`
              urls.push(chromaIdentifier)
            }
          }
        }
      }

      return urls
    },
    [championData]
  )

  // Calculate total skin counts and estimated size
  const skinStats = useMemo(() => {
    if (!championData) return { totalCount: 0, estimatedSize: '0 MB' }

    const allUrls = getAllSkinUrls()
    const totalCount = allUrls.length
    const estimatedSize = `${Math.round(totalCount * 0.02)} MB` // Rough estimate of 150KB per skin

    return { totalCount, estimatedSize }
  }, [championData, getAllSkinUrls])

  const showOptionsDialog = useCallback(() => {
    setIsOptionsDialogOpen(true)
  }, [])

  const closeOptionsDialog = useCallback(() => {
    setIsOptionsDialogOpen(false)
  }, [])

  const startDownloadWithOptions = useCallback(async (options: DownloadOptions) => {
    setIsProgressDialogOpen(true)

    try {
      const result = await window.api.downloadAllSkinsBulk({
        excludeChromas: options.excludeChromas,
        excludeVariants: options.excludeVariants,
        excludeLegacy: options.excludeLegacy,
        excludeEsports: options.excludeEsports,
        onlyFavorites: options.onlyFavorites,
        overwriteExisting: options.overwriteExisting || false,
        concurrency: options.concurrency
      })

      if (!result.success) {
        console.error('Failed to start bulk download:', result.error)
        // TODO: Show error toast
      }
    } catch (error) {
      console.error('Error starting download:', error)
      // TODO: Show error toast
    }
  }, [])

  const pauseDownload = useCallback(async () => {
    try {
      await window.api.pauseBatchDownload()
    } catch (error) {
      console.error('Error pausing download:', error)
    }
  }, [])

  const resumeDownload = useCallback(async () => {
    try {
      await window.api.resumeBatchDownload()
    } catch (error) {
      console.error('Error resuming download:', error)
    }
  }, [])

  const cancelDownload = useCallback(async () => {
    try {
      await window.api.cancelBatchDownload()
      setIsProgressDialogOpen(false)
    } catch (error) {
      console.error('Error cancelling download:', error)
    }
  }, [])

  const retryFailedDownloads = useCallback(async () => {
    try {
      const result = await window.api.retryFailedDownloads()
      if (!result.success) {
        console.error('Failed to retry downloads:', result.error)
        // TODO: Show error toast
      }
    } catch (error) {
      console.error('Error retrying downloads:', error)
      // TODO: Show error toast
    }
  }, [])

  const closeProgressDialog = useCallback(() => {
    setIsProgressDialogOpen(false)
  }, [])

  // Auto-close progress dialog when download completes
  useEffect(() => {
    if (
      progress.totalSkins > 0 &&
      progress.completedSkins === progress.totalSkins &&
      !progress.isRunning
    ) {
      // Keep dialog open for a moment to show completion
      const timer = setTimeout(() => {
        setIsProgressDialogOpen(false)
      }, 3000)

      return () => clearTimeout(timer)
    }
    return undefined
  }, [progress])

  return {
    // Options dialog
    isOptionsDialogOpen,
    showOptionsDialog,
    closeOptionsDialog,

    // Progress dialog
    isProgressDialogOpen,
    progress,
    closeProgressDialog,

    // Download actions
    startDownloadWithOptions,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryFailedDownloads,

    // Utility
    getAllSkinUrls,
    skinStats
  }
}
