import axios from 'axios'
import fs from 'fs/promises'
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

    // Create champion folders
    const championCacheDir = path.join(this.cacheDir, skinInfo.championName)
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

    // Convert blob URL to raw URL for direct download
    const rawUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')

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
      throw new Error(
        `Failed to download skin: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private parseGitHubUrl(url: string): SkinInfo {
    // Example regular skin: https://github.com/darkseal-org/lol-skins/blob/main/skins/Aatrox/DRX%20Aatrox.zip
    // Example chroma: https://github.com/darkseal-org/lol-skins/blob/main/skins/Aatrox/chromas/DRX%20Aatrox/DRX%20Aatrox%20266032.zip

    // First try to match chroma URL pattern
    const chromaPattern =
      /github\.com\/darkseal-org\/lol-skins\/blob\/main\/skins\/([^\\/]+)\/chromas\/([^\\/]+)\/([^\\/]+)$/
    const chromaMatch = url.match(chromaPattern)

    if (chromaMatch) {
      const championName = chromaMatch[1]
      // const skinName = decodeURIComponent(chromaMatch[2]) // Not needed, we use the full chroma filename
      const chromaFileName = decodeURIComponent(chromaMatch[3])

      return {
        championName,
        skinName: chromaFileName, // Use the full chroma filename (e.g., "DRX Aatrox 266032.zip")
        url,
        source: 'repository' as const
      }
    }

    // Otherwise try regular skin pattern
    const skinPattern =
      /github\.com\/darkseal-org\/lol-skins\/blob\/main\/skins\/([^\\/]+)\/([^\\/]+)$/
    const skinMatch = url.match(skinPattern)

    if (!skinMatch) {
      throw new Error(
        'Invalid GitHub URL format. Expected format: https://github.com/darkseal-org/lol-skins/blob/main/skins/[Champion]/[SkinName].zip or .../chromas/[SkinName]/[ChromaFile].zip'
      )
    }

    const championName = skinMatch[1]
    const skinName = decodeURIComponent(skinMatch[2])

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
        const championPath = path.join(this.cacheDir, championFolder)
        const stat = await fs.stat(championPath)
        if (stat.isDirectory()) {
          const skinFiles = await fs.readdir(championPath)
          for (const skinFile of skinFiles) {
            const skinPath = path.join(championPath, skinFile)
            if (seenPaths.has(skinPath)) continue
            seenPaths.add(skinPath)

            const skinName = path.basename(skinFile)
            const championName = path.basename(championFolder)
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
