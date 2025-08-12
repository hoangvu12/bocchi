import { app } from 'electron'
import axios, { AxiosError } from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import * as StreamZip from 'node-stream-zip'

export interface DownloadProgress {
  loaded: number
  total: number
  speed: number // bytes per second
}

export interface ToolsError {
  type: 'network' | 'github' | 'filesystem' | 'extraction' | 'validation' | 'unknown'
  message: string
  details?: string
  canRetry: boolean
  statusCode?: number
}

export class ToolsDownloader {
  private toolsPath: string
  private multiRitoFixesPath: string
  private multiRitoFixesVersionPath: string
  private ritoddstexPath: string
  private ritoddstexVersionPath: string
  private imageMagickPath: string
  private imageMagickVersionPath: string

  constructor() {
    // Store tools in user data directory so they persist across app updates
    this.toolsPath = path.join(app.getPath('userData'), 'cslol-tools')
    this.multiRitoFixesPath = path.join(app.getPath('userData'), 'MultiRitoFixes.exe')
    this.multiRitoFixesVersionPath = path.join(app.getPath('userData'), 'multiritofix-version.txt')
    this.ritoddstexPath = path.join(app.getPath('userData'), 'tools', 'ritoddstex', 'tex2dds.exe')
    this.ritoddstexVersionPath = path.join(
      app.getPath('userData'),
      'tools',
      'ritoddstex-version.txt'
    )
    this.imageMagickPath = path.join(app.getPath('userData'), 'tools', 'magick', 'magick.exe')
    this.imageMagickVersionPath = path.join(
      app.getPath('userData'),
      'tools',
      'imagemagick-version.txt'
    )

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

  async getLatestReleaseInfo(): Promise<{ downloadUrl: string; version: string; size: number }> {
    try {
      const response = await axios.get(
        'https://api.github.com/repos/LeagueToolkit/cslol-manager/releases/latest',
        {
          headers: {
            Accept: 'application/vnd.github.v3+json'
          },
          timeout: 10000 // 10 second timeout
        }
      )

      const release = response.data
      const asset = release.assets.find((a: any) => a.name === 'cslol-manager.zip')

      if (!asset) {
        throw this.createError(
          'validation',
          'Could not find cslol-manager.zip in latest release',
          'The release format may have changed',
          false
        )
      }

      return {
        downloadUrl: asset.browser_download_url,
        version: release.tag_name,
        size: asset.size
      }
    } catch (error) {
      if (error instanceof Error && 'type' in error) {
        throw error
      }
      throw this.classifyError(error)
    }
  }

  async downloadAndExtractTools(
    onProgress?: (progress: number, details?: DownloadProgress) => void
  ): Promise<void> {
    let tempDir: string | undefined
    try {
      const { downloadUrl, size } = await this.getLatestReleaseInfo()

      // Create temp directory
      tempDir = path.join(app.getPath('temp'), 'cslol-download')
      await fs.promises.mkdir(tempDir, { recursive: true })

      const zipPath = path.join(tempDir, 'cslol-manager.zip')

      // Download the file with progress tracking
      const startTime = Date.now()

      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        timeout: 60000, // 60 second timeout
        onDownloadProgress: (progressEvent) => {
          const loaded = progressEvent.loaded
          const total = progressEvent.total || size

          if (onProgress) {
            const now = Date.now()
            const duration = (now - startTime) / 1000
            const speed = duration > 0 ? loaded / duration : 0

            const progress = Math.round((loaded / total) * 100)
            onProgress(progress, {
              loaded,
              total,
              speed
            })
          }
        },
        maxContentLength: 500 * 1024 * 1024, // 500MB max
        maxBodyLength: 500 * 1024 * 1024
      })

      // Save to file with error handling
      const writer = fs.createWriteStream(zipPath)
      response.data.pipe(writer)

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve())
        writer.on('error', (error) => {
          reject(this.createError('filesystem', 'Failed to save download', error.message, true))
        })
        response.data.on('error', (error: Error) => {
          reject(this.createError('network', 'Download stream interrupted', error.message, true))
        })
      })

      // Verify download size
      const stats = await fs.promises.stat(zipPath)
      if (stats.size === 0) {
        throw this.createError(
          'validation',
          'Downloaded file is empty',
          'The download may have been blocked by antivirus or firewall',
          true
        )
      }

      // Extract the zip with validation
      const extractPath = path.join(tempDir, 'extracted')
      const zip = new StreamZip.async({ file: zipPath })

      try {
        // Test zip integrity
        const entries = await zip.entries()
        const entryCount = Object.keys(entries).length
        if (entryCount === 0) {
          throw new Error('ZIP archive is empty')
        }

        // Extract all files
        await zip.extract(null, extractPath)
      } catch (error) {
        throw this.createError(
          'extraction',
          error instanceof Error && error.message.includes('empty')
            ? 'ZIP archive is empty'
            : 'Failed to extract ZIP file',
          error instanceof Error ? error.message : 'Extraction failed',
          true
        )
      } finally {
        await zip.close()
      }

      // Find the cslol-tools folder
      const cslolManagerPath = path.join(extractPath, 'cslol-manager')
      const cslolToolsSource = path.join(cslolManagerPath, 'cslol-tools')

      // Check if source exists
      const sourceExists = await fs.promises
        .access(cslolToolsSource)
        .then(() => true)
        .catch(() => false)

      if (!sourceExists) {
        throw this.createError(
          'validation',
          'Invalid archive structure',
          'Could not find cslol-tools folder in the extracted archive',
          false
        )
      }

      // Verify mod-tools.exe exists in source
      const modToolsPath = path.join(cslolToolsSource, 'mod-tools.exe')
      const modToolsExists = await fs.promises
        .access(modToolsPath)
        .then(() => true)
        .catch(() => false)

      if (!modToolsExists) {
        throw this.createError(
          'validation',
          'Missing required files',
          'mod-tools.exe not found in archive',
          true
        )
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
      try {
        await this.copyDirectory(cslolToolsSource, this.toolsPath)
      } catch (error) {
        throw this.createError(
          'filesystem',
          'Failed to install tools',
          error instanceof Error ? error.message : 'Copy operation failed',
          true
        )
      }

      // Final verification
      const installedModTools = path.join(this.toolsPath, 'mod-tools.exe')
      const verifyInstall = await fs.promises
        .access(installedModTools, fs.constants.F_OK | fs.constants.X_OK)
        .then(() => true)
        .catch(() => false)

      if (!verifyInstall) {
        throw this.createError(
          'validation',
          'Installation verification failed',
          'mod-tools.exe is not accessible after installation',
          true
        )
      }

      // Clean up temp files
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Clean up on error
      if (tempDir) {
        try {
          await fs.promises.rm(tempDir, { recursive: true, force: true })
        } catch {
          // Ignore cleanup errors
        }
      }

      if (error instanceof Error && 'type' in error) {
        throw error
      }
      throw this.classifyError(error)
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

  // Ritoddstex methods
  async checkRitoddstexExist(): Promise<boolean> {
    try {
      await fs.promises.access(this.ritoddstexPath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  async getRitoddstexLatestVersion(): Promise<{
    downloadUrl: string
    version: string
  }> {
    try {
      const response = await axios.get(
        'https://api.github.com/repos/Morilli/Ritoddstex/releases/latest',
        {
          headers: {
            Accept: 'application/vnd.github.v3+json'
          }
        }
      )

      const release = response.data
      // Find the tex2dds.exe asset
      const asset = release.assets.find((a: any) => a.name === 'tex2dds.exe')

      if (!asset) {
        throw new Error('Could not find tex2dds.exe in Ritoddstex release')
      }

      return {
        downloadUrl: asset.browser_download_url,
        version: release.tag_name
      }
    } catch (error) {
      throw new Error(
        `Failed to get Ritoddstex release info: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async downloadRitoddstex(onProgress?: (progress: number) => void): Promise<void> {
    try {
      const { downloadUrl, version } = await this.getRitoddstexLatestVersion()

      // Create ritoddstex directory if it doesn't exist
      const toolsDir = path.dirname(this.ritoddstexPath)
      await fs.promises.mkdir(toolsDir, { recursive: true })

      // Download the file (tex2dds.exe is downloaded directly, no extraction needed)
      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100)
            onProgress(progress)
          }
        }
      })

      // Save to file (as tex2dds.exe in the ritoddstex folder)
      const writer = fs.createWriteStream(this.ritoddstexPath)
      response.data.pipe(writer)

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve())
        writer.on('error', reject)
      })

      // Save version info
      await fs.promises.writeFile(this.ritoddstexVersionPath, version)
    } catch (error) {
      throw new Error(
        `Failed to download Ritoddstex: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async getRitoddstexVersion(): Promise<string | null> {
    try {
      const version = await fs.promises.readFile(this.ritoddstexVersionPath, 'utf-8')
      return version.trim()
    } catch {
      return null
    }
  }

  async checkRitoddstexUpdate(): Promise<boolean> {
    try {
      const currentVersion = await this.getRitoddstexVersion()
      if (!currentVersion) return true // No version file means we should download

      const { version: latestVersion } = await this.getRitoddstexLatestVersion()
      return currentVersion !== latestVersion
    } catch {
      return false // If we can't check, assume no update needed
    }
  }

  getRitoddstexPath(): string {
    return this.ritoddstexPath
  }

  // ImageMagick methods
  async checkImageMagickExist(): Promise<boolean> {
    try {
      await fs.promises.access(this.imageMagickPath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  async downloadImageMagick(onProgress?: (progress: number) => void): Promise<void> {
    try {
      // ImageMagick portable version URL (direct download)
      // Using the latest Q16 64-bit portable version
      const downloadUrl =
        'https://imagemagick.org/archive/binaries/ImageMagick-7.1.2-1-portable-Q16-x64.zip'
      const version = '7.1.2-1'

      // Create tools directory if it doesn't exist
      const toolsDir = path.dirname(this.imageMagickPath)
      await fs.promises.mkdir(toolsDir, { recursive: true })

      // Download the zip file
      const tempZipPath = path.join(toolsDir, 'imagemagick-temp.zip')

      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100)
            onProgress(progress)
          }
        }
      })

      // Save to temp file
      const writer = fs.createWriteStream(tempZipPath)
      response.data.pipe(writer)

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve())
        writer.on('error', reject)
      })

      // Extract the zip
      const zip = new StreamZip.async({ file: tempZipPath })
      try {
        // Extract to a temp directory first
        const tempExtractDir = path.join(toolsDir, 'temp-extract')
        await fs.promises.mkdir(tempExtractDir, { recursive: true })
        await zip.extract(null, tempExtractDir)

        // Find the ImageMagick folder (it should be something like ImageMagick-7.1.2-1-portable-Q16-x64)
        const extractedFolders = await fs.promises.readdir(tempExtractDir)
        const imageMagickFolder = extractedFolders.find(
          (folder) => folder.startsWith('ImageMagick-') && folder.includes('portable')
        )

        if (!imageMagickFolder) {
          throw new Error('ImageMagick folder not found in extracted archive')
        }

        // Move all files from the ImageMagick subfolder to the magick directory
        const sourcePath = path.join(tempExtractDir, imageMagickFolder)
        const magickDir = path.dirname(this.imageMagickPath)

        // Create the magick directory if it doesn't exist
        await fs.promises.mkdir(magickDir, { recursive: true })

        // Copy all files from source to destination
        const files = await fs.promises.readdir(sourcePath)
        for (const file of files) {
          const srcFile = path.join(sourcePath, file)
          const destFile = path.join(magickDir, file)
          const stat = await fs.promises.stat(srcFile)

          if (stat.isDirectory()) {
            await this.copyDirectory(srcFile, destFile)
          } else {
            await fs.promises.copyFile(srcFile, destFile)
          }
        }

        // Clean up temp extract directory
        await fs.promises.rm(tempExtractDir, { recursive: true, force: true })

        // Verify magick.exe exists after extraction
        const magickExists = await fs.promises
          .access(this.imageMagickPath)
          .then(() => true)
          .catch(() => false)

        if (!magickExists) {
          throw new Error('magick.exe not found after extraction')
        }
      } finally {
        await zip.close()
      }

      // Clean up temp file
      await fs.promises.unlink(tempZipPath)

      // Save version info
      await fs.promises.writeFile(this.imageMagickVersionPath, version)
    } catch (error) {
      throw new Error(
        `Failed to download ImageMagick: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async getImageMagickVersion(): Promise<string | null> {
    try {
      const version = await fs.promises.readFile(this.imageMagickVersionPath, 'utf-8')
      return version.trim()
    } catch {
      return null
    }
  }

  getImageMagickPath(): string {
    return this.imageMagickPath
  }

  private createError(
    type: ToolsError['type'],
    message: string,
    details?: string,
    canRetry: boolean = true
  ): ToolsError {
    const error = new Error(message) as Error & ToolsError
    ;(error as any).type = type
    ;(error as any).message = message
    ;(error as any).details = details
    ;(error as any).canRetry = canRetry
    return error as ToolsError
  }

  private classifyError(error: unknown): ToolsError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError

      // Network errors
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        return this.createError(
          'network',
          'Connection timed out',
          'The download is taking too long. Check your internet connection.',
          true
        )
      }

      if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'EAI_AGAIN') {
        return this.createError(
          'network',
          'Cannot reach GitHub',
          'Check your internet connection or DNS settings.',
          true
        )
      }

      // GitHub API errors
      if (axiosError.response) {
        const status = axiosError.response.status

        if (status === 403) {
          const rateLimitReset = axiosError.response.headers['x-ratelimit-reset']
          const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000) : null
          return this.createError(
            'github',
            'GitHub API rate limit exceeded',
            resetTime
              ? `Try again after ${resetTime.toLocaleTimeString()}`
              : 'Try again in an hour',
            true
          )
        }

        if (status === 404) {
          return this.createError(
            'github',
            'Release not found',
            'The tools may have been moved or renamed',
            false
          )
        }

        if (status >= 500) {
          return this.createError(
            'github',
            'GitHub server error',
            `Server returned status ${status}. Try again later.`,
            true
          )
        }
      }

      // Generic network error
      return this.createError('network', 'Network error', axiosError.message, true)
    }

    // File system errors
    if (error instanceof Error) {
      if (error.message.includes('ENOSPC')) {
        return this.createError(
          'filesystem',
          'Not enough disk space',
          'Free up some space and try again',
          true
        )
      }

      if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
        return this.createError(
          'filesystem',
          'Permission denied',
          'Try running as administrator or check folder permissions',
          true
        )
      }

      if (error.message.includes('EMFILE')) {
        return this.createError(
          'filesystem',
          'Too many open files',
          'Close some applications and try again',
          true
        )
      }
    }

    // Unknown error
    return this.createError(
      'unknown',
      'Unexpected error',
      error instanceof Error ? error.message : String(error),
      true
    )
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
