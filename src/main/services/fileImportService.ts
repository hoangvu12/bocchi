import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import AdmZip from 'adm-zip'
import { SkinInfo } from '../types'

export interface ImportResult {
  success: boolean
  skinInfo?: SkinInfo
  error?: string
}

export interface BatchImportResult {
  success: boolean
  totalFiles: number
  successCount: number
  failedCount: number
  results: Array<{
    filePath: string
    success: boolean
    skinInfo?: SkinInfo
    error?: string
  }>
}

export interface FileImportOptions {
  championName?: string
  skinName?: string
  imagePath?: string
}

export class FileImportService {
  private modsDir: string
  private tempDir: string
  private modFilesDir: string

  constructor() {
    const userData = app.getPath('userData')
    this.modsDir = path.join(userData, 'mods')
    this.tempDir = path.join(userData, 'temp-imports')
    this.modFilesDir = path.join(userData, 'mod-files')
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.modsDir, { recursive: true })
    await fs.mkdir(this.tempDir, { recursive: true })
    await fs.mkdir(this.modFilesDir, { recursive: true })

    // Clean up existing mods with trailing spaces
    await this.cleanupTrailingSpaces()
  }

  async importFile(filePath: string, options: FileImportOptions = {}): Promise<ImportResult> {
    try {
      const fileType = await this.detectFileType(filePath)

      switch (fileType) {
        case 'wad':
          return await this.importWadFile(filePath, options)
        case 'zip':
        case 'fantome':
          return await this.importZipFile(filePath, options)
        default:
          return { success: false, error: 'Unsupported file type' }
      }
    } catch (error) {
      console.error('Import error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown import error'
      }
    }
  }

  async importFiles(filePaths: string[]): Promise<BatchImportResult> {
    const results: BatchImportResult['results'] = []
    let successCount = 0
    let failedCount = 0

    for (const filePath of filePaths) {
      try {
        // Validate file first
        const validation = await this.validateFile(filePath)
        if (!validation.valid) {
          results.push({
            filePath,
            success: false,
            error: validation.error || 'Invalid file format'
          })
          failedCount++
          continue
        }

        // Import with auto-detected options
        const result = await this.importFile(filePath, {})

        results.push({
          filePath,
          success: result.success,
          skinInfo: result.skinInfo,
          error: result.error
        })

        if (result.success) {
          successCount++
        } else {
          failedCount++
        }
      } catch (error) {
        results.push({
          filePath,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        failedCount++
      }
    }

    return {
      success: failedCount === 0,
      totalFiles: filePaths.length,
      successCount,
      failedCount,
      results
    }
  }

  private async detectFileType(filePath: string): Promise<string> {
    const stat = await fs.stat(filePath)

    if (stat.isDirectory()) {
      return 'invalid'
    }

    const ext = path.extname(filePath).toLowerCase()
    const fileName = path.basename(filePath).toLowerCase()

    // Check for .wad.client files
    if (fileName.endsWith('.wad.client')) return 'wad'

    if (ext === '.wad') return 'wad'
    if (ext === '.zip') return 'zip'
    if (ext === '.fantome') return 'fantome'

    return 'unknown'
  }

  private async importWadFile(wadPath: string, options: FileImportOptions): Promise<ImportResult> {
    // Use provided championName, even if empty string
    const championName = options.championName !== undefined ? options.championName : ''
    // Handle both .wad and .wad.client extensions
    const fileName = path.basename(wadPath)
    const baseName = fileName.endsWith('.wad.client')
      ? fileName.slice(0, -11) // Remove .wad.client
      : path.basename(wadPath, '.wad')
    // Remove trailing spaces from skin name
    const skinName = (options.skinName || baseName).trim()

    const tempExtractPath = path.join(this.tempDir, `${Date.now()}_${skinName}`)

    try {
      await fs.mkdir(tempExtractPath, { recursive: true })

      const metaDir = path.join(tempExtractPath, 'META')
      await fs.mkdir(metaDir, { recursive: true })

      const infoJson = {
        Author: 'User Import',
        Description: `Imported from ${path.basename(wadPath)}`,
        Name: skinName.trim(), // Ensure no trailing spaces in metadata
        Version: '1.0.0'
      }

      await fs.writeFile(path.join(metaDir, 'info.json'), JSON.stringify(infoJson, null, 2))

      const wadDir = path.join(tempExtractPath, 'WAD')
      await fs.mkdir(wadDir, { recursive: true })
      await fs.copyFile(wadPath, path.join(wadDir, path.basename(wadPath)))

      // Handle custom image if provided
      if (options.imagePath) {
        const imageDir = path.join(tempExtractPath, 'IMAGE')
        await fs.mkdir(imageDir, { recursive: true })
        const imageExt = path.extname(options.imagePath)
        await fs.copyFile(options.imagePath, path.join(imageDir, `preview${imageExt}`))
      }

      const modFolderName = championName ? `${championName}_${skinName}` : `Custom_${skinName}`
      const finalPath = path.join(this.modsDir, modFolderName)

      if (await this.fileExists(finalPath)) {
        await fs.rm(finalPath, { recursive: true, force: true })
      }

      await fs.rename(tempExtractPath, finalPath)

      // Copy the original .wad file to mod-files directory
      const modFileName = `${modFolderName}.wad`
      const modFilePath = path.join(this.modFilesDir, modFileName)
      await fs.copyFile(wadPath, modFilePath)

      const skinInfo: SkinInfo = {
        championName: championName || 'Custom',
        skinName: '[User] ' + skinName.trim(), // Don't include extension in display name
        url: `file://${wadPath}`,
        localPath: modFilePath, // Use the original file path
        source: 'user'
      }

      return { success: true, skinInfo }
    } catch (error) {
      await this.cleanupTemp(tempExtractPath)
      throw error
    }
  }

  private async importZipFile(zipPath: string, options: FileImportOptions): Promise<ImportResult> {
    const fileName = path.basename(zipPath, path.extname(zipPath))
    const tempExtractPath = path.join(this.tempDir, `${Date.now()}_${fileName}`)

    try {
      await fs.mkdir(tempExtractPath, { recursive: true })

      const zip = new AdmZip(zipPath)
      zip.extractAllTo(tempExtractPath, true)

      const metaInfoPath = path.join(tempExtractPath, 'META', 'info.json')
      if (!(await this.fileExists(metaInfoPath))) {
        throw new Error('Invalid mod structure: META/info.json not found')
      }

      // Handle custom image if provided
      if (options.imagePath) {
        const imageDir = path.join(tempExtractPath, 'IMAGE')
        await fs.mkdir(imageDir, { recursive: true })
        const imageExt = path.extname(options.imagePath)
        await fs.copyFile(options.imagePath, path.join(imageDir, `preview${imageExt}`))
      }

      const infoContent = await fs.readFile(metaInfoPath, 'utf-8')
      const info = JSON.parse(infoContent)

      // If championName is provided (even as empty string), use it. Otherwise try to detect.
      let championName = options.championName
      if (championName === undefined) {
        // No option provided at all, try to detect
        const detected = this.extractChampionFromMod(info, fileName)
        championName = detected !== 'Unknown' ? detected : ''
      }
      // If empty string (user selected "No specific champion"), keep it empty
      // Remove trailing spaces from skin name
      const skinName = (options.skinName || info.Name || fileName).trim()

      const modFolderName = championName ? `${championName}_${skinName}` : `Custom_${skinName}`
      const finalPath = path.join(this.modsDir, modFolderName)

      if (await this.fileExists(finalPath)) {
        await fs.rm(finalPath, { recursive: true, force: true })
      }

      await fs.rename(tempExtractPath, finalPath)

      // Copy the original mod file to mod-files directory
      const ext = path.extname(zipPath)
      const modFileName = `${modFolderName}${ext}`
      const modFilePath = path.join(this.modFilesDir, modFileName)
      await fs.copyFile(zipPath, modFilePath)

      const skinInfo: SkinInfo = {
        championName: championName || 'Custom',
        skinName: '[User] ' + skinName.trim(), // Don't include extension in display name
        url: `file://${zipPath}`,
        localPath: modFilePath, // Use the original file path
        source: 'user'
      }

      return { success: true, skinInfo }
    } catch (error) {
      await this.cleanupTemp(tempExtractPath)
      throw error
    }
  }

  private extractChampionFromMod(info: any, fileName: string): string {
    if (info.Champion) return info.Champion

    const match = fileName.match(/^([A-Za-z]+)[-_\s]/i)
    if (match) return match[1]

    return 'Unknown'
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private async cleanupTemp(tempPath: string): Promise<void> {
    try {
      await fs.rm(tempPath, { recursive: true, force: true })
    } catch (error) {
      console.error('Failed to cleanup temp directory:', error)
    }
  }

  async validateFile(filePath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const fileType = await this.detectFileType(filePath)

      if (fileType === 'unknown' || fileType === 'invalid') {
        return {
          valid: false,
          error: 'Unsupported file type. Supported: .wad.client, .wad, .zip, .fantome'
        }
      }

      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation error'
      }
    }
  }

  async editCustomSkin(
    modPath: string,
    newName: string,
    newChampionKey?: string,
    newImagePath?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const stat = await fs.stat(modPath)

      if (stat.isFile()) {
        // New structure: handle mod file
        const ext = path.extname(modPath)
        const oldFileName = path.basename(modPath, ext)
        const parts = oldFileName.split('_')
        if (parts.length < 2) {
          throw new Error('Invalid mod file name structure')
        }

        // Extract current champion, use new one if provided
        const currentChampion = parts[0]
        const championName =
          newChampionKey !== undefined ? newChampionKey || 'Custom' : currentChampion

        const newFileName = `${championName}_${newName}${ext}`
        const newModPath = path.join(path.dirname(modPath), newFileName)

        // Rename the mod file if name changed
        if (modPath !== newModPath) {
          await fs.rename(modPath, newModPath)
        }

        // Update metadata folder
        const oldMetadataPath = path.join(this.modsDir, oldFileName)
        const newMetadataPath = path.join(this.modsDir, newFileName.replace(ext, ''))

        if (await this.fileExists(oldMetadataPath)) {
          if (oldMetadataPath !== newMetadataPath) {
            await fs.rename(oldMetadataPath, newMetadataPath)
          }

          // Update image in metadata folder if provided
          if (newImagePath) {
            const imageDir = path.join(newMetadataPath, 'IMAGE')
            await fs.mkdir(imageDir, { recursive: true })

            // Remove old preview images
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp']
            for (const ext of imageExtensions) {
              try {
                await fs.unlink(path.join(imageDir, `preview${ext}`))
              } catch {
                // Continue to next extension
              }
            }

            // Copy new image
            const imgExt = path.extname(newImagePath).toLowerCase()
            const destPath = path.join(imageDir, `preview${imgExt}`)
            await fs.copyFile(newImagePath, destPath)
          }
        }
      } else if (stat.isDirectory()) {
        // Legacy structure: handle folder
        const folderName = path.basename(modPath)
        const parts = folderName.split('_')
        if (parts.length < 2) {
          throw new Error('Invalid mod folder structure')
        }

        // Extract current champion, use new one if provided
        const currentChampion = parts[0]
        const championName =
          newChampionKey !== undefined ? newChampionKey || 'Custom' : currentChampion

        const newFolderName = `${championName}_${newName}`
        const newModPath = path.join(path.dirname(modPath), newFolderName)

        // Rename the folder if name changed
        if (modPath !== newModPath) {
          await fs.rename(modPath, newModPath)
        }

        // Update the image if provided
        if (newImagePath) {
          const imageDir = path.join(newModPath, 'IMAGE')
          await fs.mkdir(imageDir, { recursive: true })

          // Remove old preview images
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp']
          for (const ext of imageExtensions) {
            try {
              await fs.unlink(path.join(imageDir, `preview${ext}`))
            } catch {
              // Continue to next extension
            }
          }

          // Copy new image
          const ext = path.extname(newImagePath).toLowerCase()
          const destPath = path.join(imageDir, `preview${ext}`)
          await fs.copyFile(newImagePath, destPath)
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async deleteCustomSkin(modPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stat = await fs.stat(modPath)

      if (stat.isFile()) {
        // New structure: delete the mod file
        await fs.unlink(modPath)

        // Also delete the corresponding metadata folder if it exists
        const fileName = path.basename(modPath, path.extname(modPath))
        const metadataPath = path.join(this.modsDir, fileName)
        try {
          await fs.rm(metadataPath, { recursive: true, force: true })
        } catch {
          // Continue to next extension
        }
      } else if (stat.isDirectory()) {
        // Legacy structure: delete the mod folder
        await fs.rm(modPath, { recursive: true, force: true })
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async cleanupTrailingSpaces(): Promise<void> {
    try {
      const modDirs = await fs.readdir(this.modsDir)

      for (const dir of modDirs) {
        const modPath = path.join(this.modsDir, dir)
        const stat = await fs.stat(modPath)

        if (stat.isDirectory()) {
          const infoPath = path.join(modPath, 'META', 'info.json')

          try {
            const infoContent = await fs.readFile(infoPath, 'utf-8')
            const info = JSON.parse(infoContent)

            // Check if Name has trailing spaces
            if (info.Name && info.Name !== info.Name.trim()) {
              console.log(`[FileImportService] Cleaning trailing spaces from: ${info.Name}`)
              info.Name = info.Name.trim()

              // Update other fields that might have trailing spaces
              if (info.Author) info.Author = info.Author.trim()
              if (info.Description) info.Description = info.Description.trim()
              if (info.Version) info.Version = info.Version.trim()

              await fs.writeFile(infoPath, JSON.stringify(info, null, 2))
            }
          } catch {
            // Skip if info.json doesn't exist or is invalid
          }
        }
      }
    } catch (error) {
      console.error('[FileImportService] Error cleaning up trailing spaces:', error)
    }
  }
}
