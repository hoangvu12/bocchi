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

  constructor() {
    const userData = app.getPath('userData')
    this.cacheDir = path.join(userData, 'downloaded-skins')
    this.modsDir = path.join(userData, 'mods')
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true })
    await fs.mkdir(this.modsDir, { recursive: true })
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
    // Example: https://github.com/darkseal-org/lol-skins/blob/main/skins/Aatrox/DRX%20Aatrox.zip
    const urlPattern =
      /github\.com\/darkseal-org\/lol-skins\/blob\/main\/skins\/([^\\/]+)\/([^\\/]+)$/
    const match = url.match(urlPattern)

    if (!match) {
      throw new Error(
        'Invalid GitHub URL format. Expected format: https://github.com/darkseal-org/lol-skins/blob/main/skins/[Champion]/[SkinName].zip'
      )
    }

    const championName = match[1]
    const skinName = decodeURIComponent(match[2])

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
            skins.push({
              championName,
              skinName,
              url: `https://github.com/darkseal-org/lol-skins/blob/main/skins/${championName}/${encodeURIComponent(
                skinName
              )}`,
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
