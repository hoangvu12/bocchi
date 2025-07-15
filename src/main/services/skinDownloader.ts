import axios from 'axios'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { app } from 'electron'
import { SkinInfo } from '../types'

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

            skins.push({
              championName,
              skinName,
              url: reconstructedUrl,
              localPath: skinPath,
              source: 'repository'
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
}
