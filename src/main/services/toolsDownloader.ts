import { app } from 'electron'
import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import AdmZip from 'adm-zip'

export class ToolsDownloader {
  private toolsPath: string
  private multiRitoFixesPath: string
  private multiRitoFixesVersionPath: string

  constructor() {
    // Store tools in user data directory so they persist across app updates
    this.toolsPath = path.join(app.getPath('userData'), 'cslol-tools')
    this.multiRitoFixesPath = path.join(app.getPath('userData'), 'MultiRitoFixes.exe')
    this.multiRitoFixesVersionPath = path.join(app.getPath('userData'), 'multiritofix-version.txt')

    // Migrate tools from old location if they exist
    this.migrateToolsFromOldLocation()
  }

  async checkToolsExist(): Promise<boolean> {
    try {
      const modToolsPath = path.join(this.toolsPath, 'mod-tools.exe')
      await fs.promises.access(modToolsPath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  async getLatestReleaseInfo(): Promise<{ downloadUrl: string; version: string }> {
    try {
      const response = await axios.get(
        'https://api.github.com/repos/LeagueToolkit/cslol-manager/releases/latest',
        {
          headers: {
            Accept: 'application/vnd.github.v3+json'
          }
        }
      )

      const release = response.data
      const asset = release.assets.find((a: any) => a.name === 'cslol-manager.zip')

      if (!asset) {
        throw new Error('Could not find cslol-manager.zip in latest release')
      }

      return {
        downloadUrl: asset.browser_download_url,
        version: release.tag_name
      }
    } catch (error) {
      throw new Error(
        `Failed to get latest release info: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async downloadAndExtractTools(onProgress?: (progress: number) => void): Promise<void> {
    try {
      const { downloadUrl } = await this.getLatestReleaseInfo()

      // Create temp directory
      const tempDir = path.join(app.getPath('temp'), 'cslol-download')
      await fs.promises.mkdir(tempDir, { recursive: true })

      const zipPath = path.join(tempDir, 'cslol-manager.zip')

      // Download the file
      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100)
            onProgress(progress)
          }
        }
      })

      // Save to file
      const writer = fs.createWriteStream(zipPath)
      response.data.pipe(writer)

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve())
        writer.on('error', reject)
      })

      // Extract the zip
      const zip = new AdmZip(zipPath)
      const extractPath = path.join(tempDir, 'extracted')
      zip.extractAllTo(extractPath, true)

      // Find the cslol-tools folder
      const cslolManagerPath = path.join(extractPath, 'cslol-manager')
      const cslolToolsSource = path.join(cslolManagerPath, 'cslol-tools')

      // Check if source exists
      const sourceExists = await fs.promises
        .access(cslolToolsSource)
        .then(() => true)
        .catch(() => false)

      if (!sourceExists) {
        throw new Error('Could not find cslol-tools folder in the extracted archive')
      }

      // Create parent directory if needed
      const parentDir = path.dirname(this.toolsPath)
      await fs.promises.mkdir(parentDir, { recursive: true })

      // Remove existing tools directory if it exists
      try {
        await fs.promises.rm(this.toolsPath, { recursive: true, force: true })
      } catch {
        // Ignore if doesn't exist
      }

      // Move the cslol-tools folder to the correct location
      await this.copyDirectory(cslolToolsSource, this.toolsPath)

      // Clean up temp files
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      throw new Error(
        `Failed to download and extract tools: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.promises.mkdir(dest, { recursive: true })
    const entries = await fs.promises.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await fs.promises.copyFile(srcPath, destPath)
      }
    }
  }

  getToolsPath(): string {
    return this.toolsPath
  }

  async checkMultiRitoFixesExist(): Promise<boolean> {
    try {
      await fs.promises.access(this.multiRitoFixesPath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  async getMultiRitoFixesLatestVersion(): Promise<{
    downloadUrl: string
    version: string
    fileName: string
  }> {
    try {
      const response = await axios.get(
        'https://api.github.com/repos/TheMartynasXS/MultiRitoFixes/releases/latest',
        {
          headers: {
            Accept: 'application/vnd.github.v3+json'
          }
        }
      )

      const release = response.data
      // Find the executable asset (e.g., MultiRitoFixes-v25.13.exe)
      const asset = release.assets.find(
        (a: any) => a.name.startsWith('MultiRitoFixes-v') && a.name.endsWith('.exe')
      )

      if (!asset) {
        throw new Error('Could not find MultiRitoFixes executable in latest release')
      }

      return {
        downloadUrl: asset.browser_download_url,
        version: release.tag_name,
        fileName: asset.name
      }
    } catch (error) {
      throw new Error(
        `Failed to get MultiRitoFixes release info: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async downloadMultiRitoFixes(onProgress?: (progress: number) => void): Promise<void> {
    try {
      const { downloadUrl, version } = await this.getMultiRitoFixesLatestVersion()

      // Download the file
      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100)
            onProgress(progress)
          }
        }
      })

      // Save to file
      const writer = fs.createWriteStream(this.multiRitoFixesPath)
      response.data.pipe(writer)

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve())
        writer.on('error', reject)
      })

      // Save version info
      await fs.promises.writeFile(this.multiRitoFixesVersionPath, version)
    } catch (error) {
      throw new Error(
        `Failed to download MultiRitoFixes: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async getMultiRitoFixesVersion(): Promise<string | null> {
    try {
      const version = await fs.promises.readFile(this.multiRitoFixesVersionPath, 'utf-8')
      return version.trim()
    } catch {
      return null
    }
  }

  async checkMultiRitoFixesUpdate(): Promise<boolean> {
    try {
      const currentVersion = await this.getMultiRitoFixesVersion()
      if (!currentVersion) return true // No version file means we should download

      const { version: latestVersion } = await this.getMultiRitoFixesLatestVersion()
      return currentVersion !== latestVersion
    } catch {
      return false // If we can't check, assume no update needed
    }
  }

  getMultiRitoFixesPath(): string {
    return this.multiRitoFixesPath
  }

  private async migrateToolsFromOldLocation(): Promise<void> {
    try {
      // Determine old location based on environment
      let oldToolsPath: string
      if (process.env.NODE_ENV === 'development') {
        const appPath = app.getAppPath()
        oldToolsPath = path.join(path.dirname(appPath), '..', 'cslol-tools')
      } else {
        oldToolsPath = path.join(path.dirname(app.getPath('exe')), 'cslol-tools')
      }

      // Check if old location exists and new location doesn't
      const oldExists = await fs.promises
        .access(oldToolsPath)
        .then(() => true)
        .catch(() => false)
      const newExists = await fs.promises
        .access(this.toolsPath)
        .then(() => true)
        .catch(() => false)

      if (oldExists && !newExists) {
        console.log(`Migrating CS:LOL tools from ${oldToolsPath} to ${this.toolsPath}`)

        // Create parent directory if needed
        const parentDir = path.dirname(this.toolsPath)
        await fs.promises.mkdir(parentDir, { recursive: true })

        // Move the tools to new location
        await this.copyDirectory(oldToolsPath, this.toolsPath)

        // Remove old location after successful copy
        await fs.promises.rm(oldToolsPath, { recursive: true, force: true })

        console.log('CS:LOL tools migration completed successfully')
      }
    } catch (error) {
      console.error('Error during tools migration:', error)
      // Don't throw - migration failure shouldn't break the app
    }
  }
}
