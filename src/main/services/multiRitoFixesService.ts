import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import { ToolsDownloader } from './toolsDownloader'

export interface FixResult {
  success: boolean
  error?: string
  output?: string
}

export class MultiRitoFixesService {
  private toolsDownloader: ToolsDownloader

  constructor() {
    this.toolsDownloader = new ToolsDownloader()
  }

  async ensureToolExists(): Promise<void> {
    const exists = await this.toolsDownloader.checkMultiRitoFixesExist()
    if (!exists) {
      throw new Error('MultiRitoFixes tool not found. Please download it first.')
    }
  }

  async fixMod(modPath: string, onProgress?: (message: string) => void): Promise<FixResult> {
    try {
      // Ensure the tool exists
      await this.ensureToolExists()

      // Verify the mod file exists
      try {
        await fs.access(modPath)
      } catch {
        return { success: false, error: 'Mod file not found' }
      }

      const toolPath = this.toolsDownloader.getMultiRitoFixesPath()

      return new Promise<FixResult>((resolve) => {
        const process = spawn(toolPath, [modPath], {
          windowsHide: true
        })

        let stdout = ''
        let stderr = ''

        process.stdout.on('data', (data) => {
          const output = data.toString()
          stdout += output
          // Parse progress messages
          if (onProgress) {
            const lines = output.split('\n').filter((line) => line.trim())
            for (const line of lines) {
              if (
                line.includes('Processing') ||
                line.includes('Fixing') ||
                line.includes('Converting')
              ) {
                onProgress(line.trim())
              }
            }
          }
        })

        process.stderr.on('data', (data) => {
          stderr += data.toString()
        })

        process.on('error', (error) => {
          resolve({
            success: false,
            error: `Failed to run MultiRitoFixes: ${error.message}`
          })
        })

        process.on('close', (code) => {
          if (code === 0) {
            resolve({
              success: true,
              output: stdout
            })
          } else {
            // Parse error messages from output
            let errorMessage = 'Fix process failed'
            if (stderr) {
              errorMessage = stderr.trim()
            } else if (
              stdout.includes('error') ||
              stdout.includes('Error') ||
              stdout.includes('failed')
            ) {
              // Extract error message from stdout
              const lines = stdout.split('\n')
              const errorLine = lines.find(
                (line) =>
                  line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')
              )
              if (errorLine) {
                errorMessage = errorLine.trim()
              }
            }

            resolve({
              success: false,
              error: errorMessage,
              output: stdout
            })
          }
        })

        // Set a timeout of 60 seconds
        setTimeout(() => {
          if (!process.killed) {
            process.kill()
            resolve({
              success: false,
              error: 'Fix process timed out after 60 seconds'
            })
          }
        }, 60000)
      })
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async fixModWithDownload(
    modPath: string,
    onProgress?: (message: string) => void,
    onDownloadProgress?: (progress: number) => void
  ): Promise<FixResult> {
    try {
      // Check if tool exists
      const exists = await this.toolsDownloader.checkMultiRitoFixesExist()

      if (!exists) {
        // Download the tool
        onProgress?.('Downloading MultiRitoFixes tool...')
        await this.toolsDownloader.downloadMultiRitoFixes(onDownloadProgress)
      } else {
        // Check for updates
        const needsUpdate = await this.toolsDownloader.checkMultiRitoFixesUpdate()
        if (needsUpdate) {
          onProgress?.('Updating MultiRitoFixes tool...')
          await this.toolsDownloader.downloadMultiRitoFixes(onDownloadProgress)
        }
      }

      // Run the fix
      onProgress?.('Fixing mod issues...')
      return await this.fixMod(modPath, onProgress)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  isValidModFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    const fileName = path.basename(filePath).toLowerCase()

    // Check for supported file types
    if (fileName.endsWith('.wad.client')) return true
    if (ext === '.wad') return true
    if (ext === '.zip') return true
    if (ext === '.fantome') return true

    return false
  }
}

export const multiRitoFixesService = new MultiRitoFixesService()
