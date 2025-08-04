import axios from 'axios'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { app } from 'electron'
import * as tar from 'tar'
import { SkinInfo, SkinMetadata, SkinUpdateInfo } from '../types'
import { githubApiService } from './githubApiService'
import { skinMetadataService } from './skinMetadataService'
import { skinMigrationService } from './skinMigrationService'

interface BulkDownloadProgress {
  phase: 'downloading' | 'extracting' | 'processing' | 'completed'
  totalSize?: number
  downloadedSize?: number
  totalFiles?: number
  processedFiles?: number
  currentFile?: string
  skippedFiles?: number
  failedFiles?: string[]
  downloadSpeed?: number
  timeRemaining?: number
  overallProgress: number
}

interface BulkDownloadOptions {
  excludeChromas: boolean
  excludeVariants: boolean
  excludeLegacy: boolean
  excludeEsports: boolean
  onlyFavorites: boolean
  overwriteExisting: boolean
  concurrency?: number
}

type BulkProgressCallback = (progress: BulkDownloadProgress) => void

export class SkinDownloader {
  private cacheDir: string
  private modsDir: string
  private modFilesDir: string

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
            // Skip meta.json and .meta.json files
            if (skinFile === 'meta.json' || skinFile.endsWith('.meta.json')) continue

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
      // Filter out meta.json files when checking if directory is empty
      const nonMetaFiles = files.filter((f) => f !== 'meta.json' && !f.endsWith('.meta.json'))
      if (nonMetaFiles.length === 0) {
        // Delete any remaining metadata files before removing directory
        for (const file of files) {
          if (file === 'meta.json' || file.endsWith('.meta.json')) {
            await fs.unlink(path.join(championDir, file)).catch(() => {})
          }
        }
        await fs.rmdir(championDir)
      }
    } catch (error) {
      console.error(`Failed to delete skin ${zipPath}:`, error)
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

  async downloadAllSkinsFromRepository(
    options: BulkDownloadOptions,
    onProgress?: BulkProgressCallback
  ): Promise<void> {
    const tempDir = path.join(app.getPath('temp'), 'bocchi-bulk-download')
    const archivePath = path.join(tempDir, 'lol-skins.tar.gz')
    const extractPath = path.join(tempDir, 'extracted')

    try {
      // Ensure temp directories exist
      await fs.mkdir(tempDir, { recursive: true })
      await fs.mkdir(extractPath, { recursive: true })

      // Phase 1: Download archive
      console.log('[SkinDownloader] Starting bulk download from repository')
      await this.downloadRepositoryArchive(archivePath, (downloaded, total) => {
        onProgress?.({
          phase: 'downloading',
          downloadedSize: downloaded,
          totalSize: total,
          downloadSpeed: this.calculateDownloadSpeed(downloaded),
          overallProgress: Math.round((downloaded / total) * 30) // 0-30%
        })
      })

      // Phase 2: Extract archive
      console.log('[SkinDownloader] Extracting archive')
      await this.extractArchive(archivePath, extractPath, () => {
        onProgress?.({
          phase: 'extracting',
          overallProgress: 35 // 30-40%
        })
      })

      // Phase 3: Process and copy files
      console.log('[SkinDownloader] Processing skins')
      const skinsPath = path.join(extractPath, 'lol-skins-main', 'skins')
      await this.processSkins(skinsPath, options, (processed, total, current, skipped, failed) => {
        const progressPercent = 40 + Math.round((processed / total) * 60) // 40-100%
        onProgress?.({
          phase: 'processing',
          processedFiles: processed,
          totalFiles: total,
          currentFile: current,
          skippedFiles: skipped,
          failedFiles: failed,
          overallProgress: progressPercent
        })
      })

      // Phase 4: Cleanup
      console.log('[SkinDownloader] Cleaning up temporary files')
      await fs.rm(tempDir, { recursive: true, force: true })

      onProgress?.({
        phase: 'completed',
        overallProgress: 100
      })
    } catch (error) {
      // Cleanup on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
      throw error
    }
  }

  private async downloadRepositoryArchive(
    archivePath: string,
    onProgress?: (downloaded: number, total: number) => void
  ): Promise<void> {
    const url = 'https://github.com/darkseal-org/lol-skins/archive/refs/heads/main.tar.gz'

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          onProgress?.(progressEvent.loaded, progressEvent.total)
        }
      }
    })

    const writer = createWriteStream(archivePath)
    await pipeline(response.data, writer)
  }

  private async extractArchive(
    archivePath: string,
    extractPath: string,
    onProgress?: () => void
  ): Promise<void> {
    onProgress?.()

    await tar.x({
      file: archivePath,
      cwd: extractPath
    })
  }

  private async processSkins(
    skinsPath: string,
    options: BulkDownloadOptions,
    onProgress?: (
      processed: number,
      total: number,
      current: string,
      skipped: number,
      failed: string[]
    ) => void
  ): Promise<void> {
    const championDirs = await fs.readdir(skinsPath)
    const files: Array<{
      source: string
      destination: string
      championName: string
      skinName: string
    }> = []

    // Collect all files to process
    for (const championDir of championDirs) {
      const championPath = path.join(skinsPath, championDir)
      const stat = await fs.stat(championPath)

      if (!stat.isDirectory()) continue

      const skinFiles = await fs.readdir(championPath)

      for (const skinFile of skinFiles) {
        const skinPath = path.join(championPath, skinFile)
        const skinStat = await fs.stat(skinPath)

        if (skinStat.isDirectory()) {
          // Handle chromas directory
          if (skinFile === 'chromas' && !options.excludeChromas) {
            const chromaDirs = await fs.readdir(skinPath)
            for (const chromaDir of chromaDirs) {
              const chromaPath = path.join(skinPath, chromaDir)
              const chromaStat = await fs.stat(chromaPath)
              if (chromaStat.isDirectory()) {
                const chromaFiles = await fs.readdir(chromaPath)
                for (const chromaFile of chromaFiles) {
                  if (chromaFile.endsWith('.zip')) {
                    files.push({
                      source: path.join(chromaPath, chromaFile),
                      destination: path.join(this.cacheDir, championDir, chromaFile),
                      championName: championDir,
                      skinName: chromaFile
                    })
                  }
                }
              }
            }
          }
        } else if (skinFile.endsWith('.zip')) {
          // Regular skin file
          files.push({
            source: skinPath,
            destination: path.join(this.cacheDir, championDir, skinFile),
            championName: championDir,
            skinName: skinFile
          })
        }
      }
    }

    // Apply filters
    let filteredFiles = files

    if (options.excludeVariants) {
      filteredFiles = filteredFiles.filter(
        (f) =>
          !f.skinName.includes('/') &&
          !f.skinName.includes('Prestige') &&
          !f.skinName.includes('Variant')
      )
    }

    if (options.excludeLegacy) {
      filteredFiles = filteredFiles.filter((f) => !f.skinName.toLowerCase().includes('legacy'))
    }

    if (options.excludeEsports) {
      filteredFiles = filteredFiles.filter(
        (f) =>
          !f.skinName.toLowerCase().includes('championship') &&
          !f.skinName.toLowerCase().includes('worlds') &&
          !f.skinName.toLowerCase().includes('msi') &&
          !f.skinName.toLowerCase().includes('lcs') &&
          !f.skinName.toLowerCase().includes('lec') &&
          !f.skinName.toLowerCase().includes('lck') &&
          !f.skinName.toLowerCase().includes('lpl')
      )
    }

    // Process files
    let processed = 0
    let skipped = 0
    const failed: string[] = []

    for (const file of filteredFiles) {
      try {
        // Check if file already exists
        if (!options.overwriteExisting && existsSync(file.destination)) {
          skipped++
          processed++
          onProgress?.(processed, filteredFiles.length, file.skinName, skipped, failed)
          continue
        }

        // Ensure champion directory exists
        await fs.mkdir(path.dirname(file.destination), { recursive: true })

        // Copy file
        await fs.copyFile(file.source, file.destination)

        processed++
        onProgress?.(processed, filteredFiles.length, file.skinName, skipped, failed)
      } catch (error) {
        console.error(`Failed to copy ${file.skinName}:`, error)
        failed.push(`${file.championName} - ${file.skinName}`)
        processed++
        onProgress?.(processed, filteredFiles.length, file.skinName, skipped, failed)
      }
    }
  }

  private downloadSpeedStartTime = Date.now()

  private calculateDownloadSpeed(downloaded: number): number {
    const elapsed = (Date.now() - this.downloadSpeedStartTime) / 1000
    return elapsed > 0 ? downloaded / elapsed : 0
  }
}
