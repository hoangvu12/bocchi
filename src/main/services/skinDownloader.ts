import axios from 'axios'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { app } from 'electron'
import { SkinInfo, SkinMetadata, SkinUpdateInfo } from '../types'
import { githubApiService } from './githubApiService'
import { skinMetadataService } from './skinMetadataService'
import { skinMigrationService } from './skinMigrationService'

interface BatchDownloadState {
  isRunning: boolean
  isPaused: boolean
  isCancelled: boolean
  totalSkins: number
  completedSkins: number
  failedSkins: string[]
  currentSkin: string | null
  currentProgress: number
  startTime: number
  downloadedBytes: number
  controller?: AbortController
  skinSizes: Map<string, number>
}

interface BatchDownloadProgress {
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

type ProgressCallback = (progress: BatchDownloadProgress) => void

export class SkinDownloader {
  private cacheDir: string
  private modsDir: string
  private modFilesDir: string
  private batchDownloadState: BatchDownloadState | null = null

  constructor() {
    const userData = app.getPath('userData')
    this.cacheDir = path.join(userData, 'downloaded-skins')
    this.modsDir = path.join(userData, 'mods')
    this.modFilesDir = path.join(userData, 'mod-files')
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true })
    await fs.mkdir(this.modsDir, { recursive: true })
    await fs.mkdir(this.modFilesDir, { recursive: true })
  }

  async downloadSkin(url: string): Promise<SkinInfo> {
    // Parse GitHub URL to extract champion and skin name
    const skinInfo = this.parseGitHubUrl(url)

    // Create champion folders (ensure champion name is properly decoded)
    const decodedChampionName = decodeURIComponent(skinInfo.championName)
    const championCacheDir = path.join(this.cacheDir, decodedChampionName)
    await fs.mkdir(championCacheDir, { recursive: true })

    // Define paths
    const zipPath = path.join(championCacheDir, skinInfo.skinName)
    skinInfo.localPath = zipPath

    // Check if already downloaded
    try {
      await fs.access(zipPath)
      console.log(`Skin already downloaded: ${zipPath}`)
      return skinInfo
    } catch {
      // Skin not downloaded, proceed
    }

    // Convert blob URL to raw URL for direct download, unless it's already a raw URL
    const rawUrl = url.includes('raw.githubusercontent.com')
      ? url
      : url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')

    console.log(`Downloading skin from: ${rawUrl}`)

    try {
      // Download the ZIP file
      const response = await axios({
        method: 'GET',
        url: rawUrl,
        responseType: 'stream'
      })

      const writer = createWriteStream(zipPath)
      await pipeline(response.data, writer)

      console.log(`Downloaded ZIP: ${skinInfo.skinName} to ${zipPath}`)

      // Try to fetch and store commit info (non-blocking)
      try {
        console.log(`[SkinDownloader] Attempting to fetch commit info for: ${url}`)
        const githubPath = githubApiService.parseGitHubPathFromUrl(url)
        console.log(`[SkinDownloader] GitHub path: ${githubPath}`)

        const commitInfo = await githubApiService.getLatestCommitForSkin(githubPath)
        console.log(`[SkinDownloader] Commit info received:`, commitInfo)

        if (commitInfo && skinInfo.localPath) {
          const stats = await fs.stat(skinInfo.localPath)
          const metadata: SkinMetadata = {
            commitSha: commitInfo.sha,
            downloadedAt: new Date(),
            githubPath,
            fileSize: stats.size,
            version: 1
          }
          console.log(`[SkinDownloader] Saving metadata to: ${skinInfo.localPath}`)
          await skinMetadataService.saveMetadata(skinInfo.localPath, metadata)
          console.log(
            `[SkinDownloader] Successfully stored commit info for ${skinInfo.skinName}: ${commitInfo.sha}`
          )
        } else {
          console.warn(
            `[SkinDownloader] Missing commit info or local path for ${skinInfo.skinName}`
          )
        }
      } catch (error) {
        // Log but don't fail the download
        console.error(
          `[SkinDownloader] Failed to store commit info for ${skinInfo.skinName}:`,
          error
        )
      }

      return skinInfo
    } catch (error) {
      console.error(`Failed to download skin: ${error}`)

      // Check if it's a 404 error
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error('errors.skinNotAvailable')
      }

      throw new Error(
        `Failed to download skin: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private parseGitHubUrl(url: string): SkinInfo {
    // Example regular skin: https://github.com/darkseal-org/lol-skins/blob/main/skins/Aatrox/DRX%20Aatrox.zip
    // Example chroma: https://github.com/darkseal-org/lol-skins/blob/main/skins/Aatrox/chromas/DRX%20Aatrox/DRX%20Aatrox%20266032.zip
    // Example variant: https://github.com/darkseal-org/lol-skins/blob/main/skins/Jinx/Exalted/Arcane%20Fractured%20Jinx%20%E2%80%94%20Hero.zip
    // Raw URLs: https://raw.githubusercontent.com/darkseal-org/lol-skins/main/skins/...

    // Check if it's already a raw URL
    const isRawUrl = url.includes('raw.githubusercontent.com')

    // For raw URLs, convert the pattern to match
    let urlToMatch = url
    if (isRawUrl) {
      // Convert raw URL pattern to match our existing patterns
      urlToMatch = url
        .replace('raw.githubusercontent.com', 'github.com')
        .replace('/main/', '/raw/main/')
    }

    // First try to match chroma URL pattern (supports both blob and raw)
    const chromaPattern =
      /github\.com\/darkseal-org\/lol-skins\/(blob|raw)\/main\/skins\/([^\\/]+)\/chromas\/([^\\/]+)\/([^\\/]+)$/
    const chromaMatch = urlToMatch.match(chromaPattern)

    if (chromaMatch) {
      const championName = decodeURIComponent(chromaMatch[2]) // Skip the blob/raw group and decode
      // const skinName = decodeURIComponent(chromaMatch[3]) // Not needed, we use the full chroma filename
      const chromaFileName = decodeURIComponent(chromaMatch[4])

      return {
        championName,
        skinName: chromaFileName, // Use the full chroma filename (e.g., "DRX Aatrox 266032.zip")
        url,
        source: 'repository' as const
      }
    }

    // Try to match variant patterns with nested subdirectories (like forms/SkinName/FileName.zip)
    const nestedVariantPattern =
      /github\.com\/darkseal-org\/lol-skins\/(blob|raw)\/main\/skins\/([^\\/]+)\/([^\\/]+)\/([^\\/]+)\/([^\\/]+)$/
    const nestedVariantMatch = urlToMatch.match(nestedVariantPattern)

    if (nestedVariantMatch) {
      const championName = decodeURIComponent(nestedVariantMatch[2]) // Skip the blob/raw group and decode
      const variantDir = decodeURIComponent(nestedVariantMatch[3]) // e.g., "forms"
      const skinSubDir = decodeURIComponent(nestedVariantMatch[4]) // e.g., "Elementalist Lux"
      const variantFileName = decodeURIComponent(nestedVariantMatch[5])

      // If the last part has an extension, it's a nested variant
      const hasFileExtension = /\.(zip|wad|fantome)$/i.test(variantFileName)

      if (hasFileExtension) {
        console.log(
          `Detected nested variant URL: champion=${championName}, dir=${variantDir}, subdir=${skinSubDir}, file=${variantFileName}`
        )
        return {
          championName,
          skinName: variantFileName, // Use the variant filename directly
          url,
          source: 'repository' as const
        }
      }
    }

    // Try to match variant patterns (subdirectories like Exalted, forms, etc.)
    const variantPattern =
      /github\.com\/darkseal-org\/lol-skins\/(blob|raw)\/main\/skins\/([^\\/]+)\/([^\\/]+)\/([^\\/]+)$/
    const variantMatch = urlToMatch.match(variantPattern)

    if (variantMatch) {
      const championName = decodeURIComponent(variantMatch[2]) // Skip the blob/raw group and decode
      const variantDir = decodeURIComponent(variantMatch[3])
      const variantFileName = decodeURIComponent(variantMatch[4])

      // For variant URLs, the middle part is a subdirectory, not the skin file
      // If the last part has an extension, it's likely a variant in a subdirectory
      const hasFileExtension = /\.(zip|wad|fantome)$/i.test(variantFileName)

      if (hasFileExtension) {
        console.log(
          `Detected variant URL: champion=${championName}, dir=${variantDir}, file=${variantFileName}`
        )
        return {
          championName,
          skinName: variantFileName, // Use the variant filename directly
          url,
          source: 'repository' as const
        }
      }
    }

    // Otherwise try regular skin pattern
    const skinPattern =
      /github\.com\/darkseal-org\/lol-skins\/(blob|raw)\/main\/skins\/([^\\/]+)\/([^\\/]+)$/
    const skinMatch = urlToMatch.match(skinPattern)

    if (!skinMatch) {
      // Log the URL that failed to match for debugging
      console.error(`Failed to parse GitHub URL: ${url}`)
      throw new Error(
        'Invalid GitHub URL format. Expected formats:\n' +
          '- Regular skin: https://github.com/darkseal-org/lol-skins/(blob|raw)/main/skins/[Champion]/[SkinName].zip\n' +
          '- Chroma: .../skins/[Champion]/chromas/[SkinName]/[ChromaFile].zip\n' +
          '- Variant: .../skins/[Champion]/[VariantDir]/[VariantFile].zip\n' +
          '- Nested Variant: .../skins/[Champion]/[VariantDir]/[SkinName]/[VariantFile].zip'
      )
    }

    const championName = decodeURIComponent(skinMatch[2]) // Skip the blob/raw group and decode
    const skinName = decodeURIComponent(skinMatch[3])

    return {
      championName,
      skinName,
      url,
      source: 'repository' as const
    }
  }

  async listDownloadedSkins(): Promise<SkinInfo[]> {
    const skins: SkinInfo[] = []
    const seenPaths = new Set<string>()

    // 1. List downloaded skins from cache
    try {
      const championFolders = await fs.readdir(this.cacheDir)
      for (const championFolder of championFolders) {
        // Check if champion folder name needs decoding and migration
        const decodedChampionName = decodeURIComponent(championFolder)
        const championPath = path.join(this.cacheDir, championFolder)
        const stat = await fs.stat(championPath)
        if (stat.isDirectory()) {
          // If the folder name is URL-encoded, rename it to decoded version
          if (championFolder !== decodedChampionName) {
            const decodedChampionPath = path.join(this.cacheDir, decodedChampionName)
            try {
              // Check if decoded folder already exists
              const decodedExists = existsSync(decodedChampionPath)
              if (!decodedExists) {
                await fs.rename(championPath, decodedChampionPath)
                console.log(`Migrated folder: ${championFolder} -> ${decodedChampionName}`)
              } else {
                console.warn(
                  `Cannot migrate ${championFolder}: ${decodedChampionName} already exists`
                )
              }
            } catch (error) {
              console.error(`Failed to migrate folder ${championFolder}:`, error)
            }
          }
          const skinFiles = await fs.readdir(championPath)
          for (const skinFile of skinFiles) {
            const skinPath = path.join(championPath, skinFile)
            if (seenPaths.has(skinPath)) continue
            seenPaths.add(skinPath)

            const skinName = path.basename(skinFile)
            const championName = decodedChampionName // Use decoded champion name
            // Check if this is a chroma file (contains a number ID at the end)
            const chromaMatch = skinName.match(/^(.+)\s+(\d{6})\.zip$/)
            let reconstructedUrl: string

            if (chromaMatch) {
              // This is a chroma file
              const baseSkinName = chromaMatch[1]
              reconstructedUrl = `https://github.com/darkseal-org/lol-skins/blob/main/skins/${championName}/chromas/${encodeURIComponent(
                baseSkinName
              )}/${encodeURIComponent(skinName)}`
            } else {
              // Regular skin file
              reconstructedUrl = `https://github.com/darkseal-org/lol-skins/blob/main/skins/${championName}/${encodeURIComponent(
                skinName
              )}`
            }

            // Try to load metadata (non-blocking)
            let metadata: SkinMetadata | undefined
            try {
              metadata = (await skinMetadataService.getMetadata(skinPath)) || undefined
            } catch (error) {
              console.warn(`Failed to load metadata for ${skinPath}:`, error)
            }

            skins.push({
              championName,
              skinName,
              url: reconstructedUrl,
              localPath: skinPath,
              source: 'repository',
              metadata
            })
          }
        }
      }
    } catch (error) {
      console.error('Error listing downloaded skins from cache:', error)
    }

    // 2. List user-imported mods
    try {
      // First try to list from mod-files directory (new structure)
      const modFiles = await fs.readdir(this.modFilesDir).catch(() => [])
      for (const modFile of modFiles) {
        const modFilePath = path.join(this.modFilesDir, modFile)
        if (seenPaths.has(modFilePath)) continue
        const stat = await fs.stat(modFilePath)
        if (stat.isFile()) {
          const nameWithoutExt = path.basename(modFile, path.extname(modFile))
          const parts = nameWithoutExt.split('_')
          if (parts.length >= 2) {
            const championName = parts[0]
            const skinName = parts.slice(1).join('_')
            const ext = path.extname(modFile)
            skins.push({
              championName,
              skinName: `[User] ${skinName}${ext}`,
              url: `file://${modFilePath}`,
              localPath: modFilePath,
              source: 'user'
            })
            seenPaths.add(modFilePath)
          }
        }
      }

      // Also check legacy mods directory for backward compatibility
      const modFolders = await fs.readdir(this.modsDir)
      for (const modFolder of modFolders) {
        const modPath = path.join(this.modsDir, modFolder)
        if (seenPaths.has(modPath)) continue
        const stat = await fs.stat(modPath)
        if (stat.isDirectory()) {
          const parts = modFolder.split('_')
          if (parts.length >= 2) {
            const championName = parts[0]
            const skinName = parts.slice(1).join('_')
            // Check if there's a corresponding mod file
            let hasModFile = false
            for (const ext of ['.wad', '.zip', '.fantome']) {
              const modFilePath = path.join(this.modFilesDir, `${modFolder}${ext}`)
              try {
                await fs.access(modFilePath)
                hasModFile = true
                break
              } catch {
                // Continue to next extension
              }
            }
            // Only add if no corresponding mod file exists (legacy mod)
            if (!hasModFile) {
              skins.push({
                championName,
                skinName: `[User] ${skinName}`,
                url: `file://${modPath}`,
                localPath: modPath,
                source: 'user'
              })
              seenPaths.add(modPath)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error listing user-imported skins:', error)
    }

    return skins
  }

  async deleteSkin(championName: string, skinName: string): Promise<void> {
    const zipPath = path.join(this.cacheDir, championName, skinName)
    try {
      await fs.unlink(zipPath)

      // Also delete metadata file if it exists
      try {
        await skinMetadataService.deleteMetadata(zipPath)
      } catch (error) {
        console.warn(`Failed to delete metadata for ${zipPath}:`, error)
      }

      // Clean up empty champion directory
      const championDir = path.join(this.cacheDir, championName)
      const files = await fs.readdir(championDir)
      if (files.length === 0) {
        await fs.rmdir(championDir)
      }
    } catch (error) {
      console.error(`Failed to delete skin ${zipPath}:`, error)
    }
  }

  async downloadAllSkins(
    skinUrls: string[],
    onProgress?: ProgressCallback,
    options?: {
      excludeChromas?: boolean
      concurrency?: number
    }
  ): Promise<void> {
    if (this.batchDownloadState?.isRunning) {
      throw new Error('Batch download already in progress')
    }

    // Filter out chromas if requested
    let filteredUrls = skinUrls
    if (options?.excludeChromas) {
      filteredUrls = skinUrls.filter((url) => !url.includes('/chromas/'))
    }

    // Remove already downloaded skins
    const downloadedSkins = await this.listDownloadedSkins()
    const downloadedUrls = new Set(downloadedSkins.map((skin) => skin.url))
    filteredUrls = filteredUrls.filter((url) => !downloadedUrls.has(url))

    this.batchDownloadState = {
      isRunning: true,
      isPaused: false,
      isCancelled: false,
      totalSkins: filteredUrls.length,
      completedSkins: 0,
      failedSkins: [],
      currentSkin: null,
      currentProgress: 0,
      startTime: Date.now(),
      downloadedBytes: 0,
      controller: new AbortController(),
      skinSizes: new Map()
    }

    try {
      const concurrency = options?.concurrency || 3 // Download 3 skins at once
      await this.downloadWithConcurrency(filteredUrls, concurrency, onProgress)
    } finally {
      this.batchDownloadState = null
    }
  }

  private async downloadWithConcurrency(
    urls: string[],
    concurrency: number,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const running: Promise<void>[] = []
    let index = 0

    const downloadNext = async (): Promise<void> => {
      if (!this.batchDownloadState || this.batchDownloadState.isCancelled) {
        return
      }

      // Wait if paused
      while (this.batchDownloadState?.isPaused && !this.batchDownloadState.isCancelled) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      if (index >= urls.length || this.batchDownloadState.isCancelled) {
        return
      }

      const url = urls[index++]
      const skinInfo = this.parseGitHubUrl(url)
      this.batchDownloadState.currentSkin = `${skinInfo.championName} - ${skinInfo.skinName}`
      this.batchDownloadState.currentProgress = 0

      this.emitProgress(onProgress)

      // Retry logic for failed downloads
      let retryCount = 0
      const maxRetries = 3

      while (retryCount <= maxRetries) {
        try {
          await this.downloadSkinWithProgress(url, (progress) => {
            if (this.batchDownloadState) {
              this.batchDownloadState.currentProgress = progress
              this.emitProgress(onProgress)
            }
          })

          if (this.batchDownloadState) {
            this.batchDownloadState.completedSkins++
            this.emitProgress(onProgress)
          }
          break // Success, exit retry loop
        } catch (error) {
          retryCount++

          if (retryCount <= maxRetries) {
            console.log(`Retrying download for ${url} (attempt ${retryCount}/${maxRetries})`)
            // Wait with exponential backoff before retry
            await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)))
          } else {
            console.error(`Failed to download ${url} after ${maxRetries} retries:`, error)
            if (this.batchDownloadState) {
              const errorMessage = this.getDownloadErrorMessage(error)
              this.batchDownloadState.failedSkins.push(
                `${this.batchDownloadState.currentSkin || url}: ${errorMessage}`
              )
            }
          }
        }
      }

      // Download next skin
      if (this.batchDownloadState && !this.batchDownloadState.isCancelled) {
        await downloadNext()
      }
    }

    // Start concurrent downloads
    for (let i = 0; i < concurrency; i++) {
      running.push(downloadNext())
    }

    await Promise.all(running)
  }

  private async downloadSkinWithProgress(
    url: string,
    onProgress?: (progress: number) => void
  ): Promise<SkinInfo> {
    const skinInfo = this.parseGitHubUrl(url)
    const decodedChampionName = decodeURIComponent(skinInfo.championName)
    const championCacheDir = path.join(this.cacheDir, decodedChampionName)
    await fs.mkdir(championCacheDir, { recursive: true })

    const zipPath = path.join(championCacheDir, skinInfo.skinName)
    skinInfo.localPath = zipPath

    // Check if already downloaded
    try {
      await fs.access(zipPath)
      onProgress?.(100)
      return skinInfo
    } catch {
      // Skin not downloaded, proceed
    }

    const rawUrl = url.includes('raw.githubusercontent.com')
      ? url
      : url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')

    let downloadedSkinBytes = 0

    try {
      const response = await axios({
        method: 'GET',
        url: rawUrl,
        responseType: 'stream',
        signal: this.batchDownloadState?.controller?.signal,
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100)
            onProgress(progress)

            // Track total bytes downloaded for speed calculation
            if (this.batchDownloadState) {
              const newBytes = progressEvent.loaded - downloadedSkinBytes
              downloadedSkinBytes = progressEvent.loaded
              this.batchDownloadState.downloadedBytes += newBytes
              this.batchDownloadState.skinSizes.set(url, progressEvent.total)
            }
          }
        }
      })

      const writer = createWriteStream(zipPath)
      await pipeline(response.data, writer)

      onProgress?.(100)
      return skinInfo
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error('Skin not available')
      }
      throw error
    }
  }

  private emitProgress(onProgress?: ProgressCallback): void {
    if (!this.batchDownloadState || !onProgress) return

    const elapsed = (Date.now() - this.batchDownloadState.startTime) / 1000
    const downloadSpeed = elapsed > 0 ? this.batchDownloadState.downloadedBytes / elapsed : 0

    // Better time estimation based on average skin download time
    const completedSkins = this.batchDownloadState.completedSkins
    const remaining = this.batchDownloadState.totalSkins - completedSkins

    let timeRemaining = 0
    if (completedSkins > 0 && remaining > 0) {
      const averageTimePerSkin = elapsed / completedSkins
      timeRemaining = remaining * averageTimePerSkin
    }

    onProgress({
      totalSkins: this.batchDownloadState.totalSkins,
      completedSkins: this.batchDownloadState.completedSkins,
      currentSkin: this.batchDownloadState.currentSkin,
      currentProgress: this.batchDownloadState.currentProgress,
      downloadSpeed,
      timeRemaining: Math.round(timeRemaining),
      failedSkins: [...this.batchDownloadState.failedSkins],
      isRunning: this.batchDownloadState.isRunning,
      isPaused: this.batchDownloadState.isPaused
    })
  }

  pauseBatchDownload(): void {
    if (this.batchDownloadState) {
      this.batchDownloadState.isPaused = true
    }
  }

  resumeBatchDownload(): void {
    if (this.batchDownloadState) {
      this.batchDownloadState.isPaused = false
    }
  }

  cancelBatchDownload(): void {
    if (this.batchDownloadState) {
      this.batchDownloadState.isCancelled = true
      this.batchDownloadState.isRunning = false
      this.batchDownloadState.controller?.abort()
    }
  }

  getBatchDownloadState(): BatchDownloadProgress | null {
    if (!this.batchDownloadState) return null

    const elapsed = (Date.now() - this.batchDownloadState.startTime) / 1000
    const downloadSpeed = elapsed > 0 ? this.batchDownloadState.downloadedBytes / elapsed : 0
    const remaining = this.batchDownloadState.totalSkins - this.batchDownloadState.completedSkins
    const averageTimePerSkin = elapsed / Math.max(this.batchDownloadState.completedSkins, 1)
    const timeRemaining = remaining * averageTimePerSkin

    return {
      totalSkins: this.batchDownloadState.totalSkins,
      completedSkins: this.batchDownloadState.completedSkins,
      currentSkin: this.batchDownloadState.currentSkin,
      currentProgress: this.batchDownloadState.currentProgress,
      downloadSpeed,
      timeRemaining: Math.round(timeRemaining),
      failedSkins: [...this.batchDownloadState.failedSkins],
      isRunning: this.batchDownloadState.isRunning,
      isPaused: this.batchDownloadState.isPaused
    }
  }

  private getDownloadErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      if (status === 404) {
        return 'File not found'
      } else if (status === 403) {
        return 'Access denied'
      } else if (status && status >= 500) {
        return 'Server error'
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return 'Network error'
      } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        return 'Connection timeout'
      }
    }

    if (error.name === 'AbortError') {
      return 'Download cancelled'
    }

    return error.message || 'Unknown error'
  }

  async retryFailedDownloads(onProgress?: ProgressCallback): Promise<void> {
    if (!this.batchDownloadState || this.batchDownloadState.failedSkins.length === 0) {
      return
    }

    // Extract URLs from failed skins (remove error messages)
    const failedUrls = this.batchDownloadState.failedSkins
      .map((failedSkin) => {
        const colonIndex = failedSkin.lastIndexOf(':')
        return colonIndex > 0 ? failedSkin.substring(0, colonIndex) : failedSkin
      })
      .filter((url) => url.startsWith('http'))

    // Reset state for retry
    this.batchDownloadState.failedSkins = []
    this.batchDownloadState.totalSkins = failedUrls.length
    this.batchDownloadState.completedSkins = 0
    this.batchDownloadState.isRunning = true
    this.batchDownloadState.isPaused = false
    this.batchDownloadState.startTime = Date.now()
    this.batchDownloadState.downloadedBytes = 0
    this.batchDownloadState.skinSizes.clear()

    try {
      await this.downloadWithConcurrency(failedUrls, 3, onProgress)
    } finally {
      this.batchDownloadState.isRunning = false
    }
  }

  async checkForSkinUpdates(skinInfos?: SkinInfo[]): Promise<Map<string, SkinUpdateInfo>> {
    const updates = new Map<string, SkinUpdateInfo>()
    const skinsToCheck = skinInfos || (await this.listDownloadedSkins())

    for (const skin of skinsToCheck) {
      const key = `${skin.championName}_${skin.skinName}`

      // Can only check updates for repository skins with metadata
      if (skin.source !== 'repository' || !skin.metadata?.commitSha) {
        updates.set(key, {
          hasUpdate: false,
          canCheck: false,
          updateMessage:
            skin.source === 'repository'
              ? 'No update info available (downloaded before update tracking)'
              : 'Updates not available for user-imported skins'
        })
        continue
      }

      try {
        const githubPath = skin.metadata.githubPath
        if (!githubPath) {
          updates.set(key, {
            hasUpdate: false,
            canCheck: false,
            updateMessage: 'Missing GitHub path information'
          })
          continue
        }

        const latestCommit = await githubApiService.getLatestCommitForSkin(githubPath)
        if (!latestCommit) {
          updates.set(key, {
            hasUpdate: false,
            canCheck: false,
            updateMessage: 'Unable to fetch latest commit information'
          })
          continue
        }

        const hasUpdate = latestCommit.sha !== skin.metadata.commitSha
        updates.set(key, {
          hasUpdate,
          canCheck: true,
          currentCommitSha: skin.metadata.commitSha,
          latestCommitSha: latestCommit.sha,
          latestCommitDate: latestCommit.date,
          updateMessage: hasUpdate ? 'Update available' : 'Up to date'
        })

        // Update the last check time
        if (skin.localPath) {
          await skinMetadataService.updateLastCheckTime(skin.localPath)
        }
      } catch (error) {
        console.warn(`Failed to check updates for ${key}:`, error)
        updates.set(key, {
          hasUpdate: false,
          canCheck: false,
          updateMessage: 'Failed to check for updates'
        })
      }
    }

    return updates
  }

  async updateSkin(skinInfo: SkinInfo): Promise<SkinInfo> {
    if (!skinInfo.localPath) {
      throw new Error('Cannot update skin without local path')
    }

    try {
      // Delete the old skin file (but keep metadata for comparison)
      await fs.unlink(skinInfo.localPath)

      // Re-download the skin
      const updatedSkin = await this.downloadSkin(skinInfo.url)

      console.log(`Successfully updated skin: ${skinInfo.skinName}`)
      return updatedSkin
    } catch (error) {
      console.error(`Failed to update skin ${skinInfo.skinName}:`, error)
      throw error
    }
  }

  async bulkUpdateSkins(skinInfos: SkinInfo[]): Promise<{
    updated: SkinInfo[]
    failed: Array<{ skin: SkinInfo; error: string }>
  }> {
    const updated: SkinInfo[] = []
    const failed: Array<{ skin: SkinInfo; error: string }> = []

    for (const skin of skinInfos) {
      try {
        const updatedSkin = await this.updateSkin(skin)
        updated.push(updatedSkin)

        // Add small delay between updates to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        failed.push({
          skin,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return { updated, failed }
  }

  async generateMetadataForExistingSkins(): Promise<void> {
    try {
      const skins = await this.listDownloadedSkins()
      const result = await skinMigrationService.generateMetadataForExistingSkins(skins)

      console.log(
        `[SkinDownloader] Metadata generation completed: ${result.successful} successful, ${result.failed} failed`
      )

      if (result.errors.length > 0) {
        console.warn('[SkinDownloader] Metadata generation errors:', result.errors)
      }
    } catch (error) {
      console.error('[SkinDownloader] Failed to generate metadata for existing skins:', error)
      throw error
    }
  }
}
