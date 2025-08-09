import axios from 'axios'
import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'

interface DownloadResult {
  success: boolean
  filePath?: string
  error?: string
}

export class UrlDownloadService {
  private tempDir: string

  constructor() {
    this.tempDir = path.join(app.getPath('temp'), 'bocchi-url-imports')
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.tempDir, { recursive: true })
  }

  async downloadFromUrl(url: string): Promise<DownloadResult> {
    try {
      // Validate URL
      new URL(url) // This will throw if invalid URL

      // Check if it's a direct download URL
      if (this.isDirectDownloadUrl(url)) {
        return await this.downloadDirectUrl(url)
      }

      return {
        success: false,
        error:
          'Invalid URL. Please provide a direct download link to a mod file (.zip, .fantome, .wad)'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download from URL'
      }
    }
  }

  private async downloadDirectUrl(url: string): Promise<DownloadResult> {
    try {
      // First, make a HEAD request to get the actual filename from headers
      let filename = 'download.zip'
      try {
        const headResponse = await axios.head(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          maxRedirects: 5
        })

        // Try to get filename from Content-Disposition header
        const contentDisposition = headResponse.headers['content-disposition']
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].replace(/['"]/g, '')
          }
        }

        // If no filename in headers, try to extract from URL
        if (filename === 'download.zip') {
          const urlPath = new URL(url).pathname
          const baseName = path.basename(urlPath)
          // Only use basename if it has a valid extension
          if (baseName && /\.(zip|fantome|wad|client)$/i.test(baseName)) {
            filename = baseName
          }
        }
      } catch {
        // If HEAD request fails, continue with default filename
      }

      // Ensure the filename has a proper extension for mod files
      if (!filename.match(/\.(zip|fantome|wad|client)$/i)) {
        // Default to .zip if no valid extension
        filename = filename.includes('.') ? filename : `${filename}.zip`
      }

      const timestamp = Date.now()
      const tempFileName = `${timestamp}-${filename}`
      const tempFilePath = path.join(this.tempDir, tempFileName)

      // Download the file
      const response = await axios({
        method: 'GET',
        url,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        maxRedirects: 5,
        timeout: 60000 // 60 second timeout
      })

      // Save to temp file
      const writer = createWriteStream(tempFilePath)
      await pipeline(response.data, writer)

      console.log(`Downloaded file to: ${tempFilePath}`)
      console.log(`File name: ${tempFileName}`)

      return {
        success: true,
        filePath: tempFilePath
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return { success: false, error: 'File not found (404)' }
        }
        if (error.code === 'ECONNABORTED') {
          return { success: false, error: 'Download timeout - file may be too large' }
        }
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download file'
      }
    }
  }

  private isDirectDownloadUrl(url: string): boolean {
    const supportedExtensions = ['.zip', '.fantome', '.wad', '.wad.client']
    const lowercaseUrl = url.toLowerCase()
    return supportedExtensions.some((ext) => lowercaseUrl.includes(ext))
  }

  async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir)
      const now = Date.now()
      const maxAge = 24 * 60 * 60 * 1000 // 24 hours

      for (const file of files) {
        const filePath = path.join(this.tempDir, file)
        const stats = await fs.stat(filePath)
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath)
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error)
    }
  }
}

export const urlDownloadService = new UrlDownloadService()
