import { spawn } from 'child_process'
import * as fs from 'fs/promises'
import { ToolsDownloader } from './toolsDownloader'

export class ImageConverter {
  private toolsDownloader: ToolsDownloader
  private ritoddstexPath: string
  private magickPath: string

  constructor() {
    this.toolsDownloader = new ToolsDownloader()

    // Use tools from AppData directory
    this.ritoddstexPath = this.toolsDownloader.getRitoddstexPath()
    this.magickPath = this.toolsDownloader.getImageMagickPath()
  }

  /**
   * Check if required tools are available
   */
  async checkToolsAvailable(): Promise<{ ritoddstex: boolean; magick: boolean }> {
    const results = {
      ritoddstex: await this.toolsDownloader.checkRitoddstexExist(),
      magick: await this.toolsDownloader.checkImageMagickExist()
    }

    if (!results.ritoddstex) {
      console.warn('Ritoddstex.exe not found at:', this.ritoddstexPath)
    }
    if (!results.magick) {
      console.warn('ImageMagick not found at:', this.magickPath)
    }

    return results
  }

  /**
   * Ensure required tools are downloaded and available
   */
  async ensureToolsAvailable(onProgress?: (message: string) => void): Promise<void> {
    const tools = await this.checkToolsAvailable()

    if (!tools.ritoddstex) {
      onProgress?.('Downloading Ritoddstex (TEX to DDS converter)...')
      await this.toolsDownloader.downloadRitoddstex((progress) => {
        onProgress?.(`Downloading Ritoddstex: ${progress}%`)
      })
      onProgress?.('Ritoddstex downloaded successfully')
    }

    if (!tools.magick) {
      onProgress?.('Downloading ImageMagick (image converter, ~30MB)...')
      await this.toolsDownloader.downloadImageMagick((progress) => {
        onProgress?.(`Downloading ImageMagick: ${progress}%`)
      })
      onProgress?.('ImageMagick downloaded successfully')
    }
  }

  /**
   * Convert TEX file to DDS format using Ritoddstex
   */
  async convertTexToDDS(texPath: string): Promise<string> {
    const ddsPath = texPath.replace('.tex', '.dds')

    // Check if Ritoddstex exists
    const exists = await this.toolsDownloader.checkRitoddstexExist()
    if (!exists) {
      throw new Error('Ritoddstex.exe not found. Run ensureToolsAvailable() to download it.')
    }

    return new Promise((resolve, reject) => {
      const process = spawn(this.ritoddstexPath, [texPath, ddsPath], {
        windowsHide: true
      })

      let stderr = ''

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          resolve(ddsPath)
        } else {
          reject(new Error(`Ritoddstex failed with code ${code}: ${stderr}`))
        }
      })

      process.on('error', (error) => {
        reject(new Error(`Failed to run Ritoddstex: ${error.message}`))
      })
    })
  }

  /**
   * Convert DDS file to PNG format using ImageMagick
   */
  async convertDDSToPNG(ddsPath: string): Promise<string> {
    const pngPath = ddsPath.replace('.dds', '.png')

    // Check if ImageMagick exists
    const exists = await this.toolsDownloader.checkImageMagickExist()
    if (!exists) {
      throw new Error('ImageMagick not found. Run ensureToolsAvailable() to download it.')
    }

    return new Promise((resolve, reject) => {
      // Use just 'magick' command without 'convert' for newer versions
      const process = spawn(this.magickPath, [ddsPath, pngPath], {
        windowsHide: true
      })

      let stderr = ''

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          resolve(pngPath)
        } else {
          reject(new Error(`ImageMagick failed with code ${code}: ${stderr}`))
        }
      })

      process.on('error', (error) => {
        reject(new Error(`Failed to run ImageMagick: ${error.message}`))
      })
    })
  }

  /**
   * Full conversion pipeline: TEX -> DDS -> PNG
   */
  async convertTexToPNG(texPath: string): Promise<string> {
    try {
      // Step 1: TEX to DDS
      const ddsPath = await this.convertTexToDDS(texPath)

      // Step 2: DDS to PNG
      const pngPath = await this.convertDDSToPNG(ddsPath)

      // Clean up intermediate DDS file
      try {
        await fs.unlink(ddsPath)
      } catch (error) {
        console.warn('Failed to cleanup DDS file:', error)
        // Ignore cleanup errors
      }

      return pngPath
    } catch (error) {
      throw new Error(
        `Image conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Try alternative conversion using only ImageMagick (fallback)
   */
  async convertDirectToPNG(inputPath: string): Promise<string> {
    const pngPath = inputPath.replace(/\.[^.]+$/, '.png')

    const exists = await this.toolsDownloader.checkImageMagickExist()
    if (!exists) {
      throw new Error('ImageMagick not found for fallback conversion')
    }

    return new Promise((resolve, reject) => {
      const process = spawn(this.magickPath, [inputPath, pngPath], {
        windowsHide: true
      })

      let stderr = ''

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          resolve(pngPath)
        } else {
          reject(new Error(`Direct conversion failed: ${stderr}`))
        }
      })

      process.on('error', (error) => {
        reject(new Error(`Failed to run ImageMagick: ${error.message}`))
      })
    })
  }
}
