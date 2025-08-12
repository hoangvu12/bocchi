import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import * as StreamZip from 'node-stream-zip'
import { SkinInfo } from '../types'
import { WADParser, WADChunk } from './wadParser'
import { TextureExtractor } from './textureExtractor'
import { ImageConverter } from './imageConverter'
import { SettingsService } from './settingsService'

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
  private settingsService: SettingsService

  constructor() {
    const userData = app.getPath('userData')
    this.modsDir = path.join(userData, 'mods')
    this.tempDir = path.join(app.getPath('temp'), 'bocchi-temp')
    this.modFilesDir = path.join(userData, 'mod-files')
    this.settingsService = SettingsService.getInstance()
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

    // If no extension or unknown extension, try to detect by file signature
    try {
      const fileHandle = await fs.open(filePath, 'r')
      const buffer = Buffer.alloc(4)
      await fileHandle.read(buffer, 0, 4, 0)
      await fileHandle.close()

      // Check for ZIP signature (PK\x03\x04 or PK\x05\x06)
      if (buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05)) {
        console.log(`Detected ZIP file by signature: ${filePath}`)
        return 'zip'
      }

      // Check for WAD signature (RW)
      if (buffer[0] === 0x52 && buffer[1] === 0x57) {
        console.log(`Detected WAD file by signature: ${filePath}`)
        return 'wad'
      }
    } catch (error) {
      console.error('Error detecting file type by signature:', error)
    }

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
      } else {
        // Try to extract image from WAD file if no custom image provided
        // Check if automatic extraction is enabled
        const autoExtract = this.settingsService.get('autoExtractImages')
        if (autoExtract) {
          const extractedImage = await this.extractImageFromWAD(tempExtractPath)
          if (extractedImage) {
            const imageDir = path.join(tempExtractPath, 'IMAGE')
            await fs.mkdir(imageDir, { recursive: true })
            const destPath = path.join(imageDir, 'preview.png')
            await fs.copyFile(extractedImage, destPath)

            // Clean up the temp directory containing the extracted PNG
            const tempDirToClean = path.dirname(extractedImage)
            if (tempDirToClean.includes('bocchi-temp')) {
              await fs.rm(tempDirToClean, { recursive: true, force: true }).catch(() => {})
            }
          }
        }
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

      // Use StreamZip for extraction to handle large files
      const zip = new StreamZip.async({ file: zipPath })
      try {
        await zip.extract(null, tempExtractPath)
      } finally {
        await zip.close()
      }

      const metaInfoPath = path.join(tempExtractPath, 'META', 'info.json')
      if (!(await this.fileExists(metaInfoPath))) {
        throw new Error('Invalid mod structure: META/info.json not found')
      }

      const infoContent = await fs.readFile(metaInfoPath, 'utf-8')
      const info = JSON.parse(infoContent)

      // Handle custom image if provided
      if (options.imagePath) {
        const imageDir = path.join(tempExtractPath, 'IMAGE')
        await fs.mkdir(imageDir, { recursive: true })
        const imageExt = path.extname(options.imagePath)
        await fs.copyFile(options.imagePath, path.join(imageDir, `preview${imageExt}`))
      } else {
        // Try to extract image from WAD files if no custom image provided
        // Check if automatic extraction is enabled
        const autoExtract = this.settingsService.get('autoExtractImages')
        if (autoExtract) {
          const extractedImage = await this.extractImageFromWAD(tempExtractPath)
          if (extractedImage) {
            const imageDir = path.join(tempExtractPath, 'IMAGE')
            await fs.mkdir(imageDir, { recursive: true })
            const destPath = path.join(imageDir, 'preview.png')
            await fs.copyFile(extractedImage, destPath)

            // Clean up the temp directory containing the extracted PNG
            const tempDirToClean = path.dirname(extractedImage)
            if (tempDirToClean.includes('bocchi-temp')) {
              await fs.rm(tempDirToClean, { recursive: true, force: true }).catch(() => {})
            }
          }
        }
      }
      // Note: Images are already extracted to tempExtractPath by zip.extract()

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

  async extractModInfo(filePath: string): Promise<{
    success: boolean
    info?: {
      name?: string
      author?: string
      description?: string
      version?: string
      champion?: string
      hasImage?: boolean
    }
    error?: string
  }> {
    try {
      const fileType = await this.detectFileType(filePath)

      if (fileType === 'wad') {
        // WAD files don't have info.json, return basic info
        const fileName = path.basename(filePath)
        const baseName = fileName.endsWith('.wad.client')
          ? fileName.slice(0, -11)
          : path.basename(filePath, '.wad')

        return {
          success: true,
          info: {
            name: baseName,
            description: `Imported from ${fileName}`,
            hasImage: false
          }
        }
      } else if (fileType === 'zip' || fileType === 'fantome') {
        // Extract info.json from zip/fantome files using StreamZip
        const zip = new StreamZip.async({ file: filePath })
        try {
          const entries = await zip.entries()
          const infoEntry = entries['META/info.json']

          // Check for preview image
          const imageExtensions = ['png', 'jpg', 'jpeg', 'webp']
          let hasImage = false
          for (const ext of imageExtensions) {
            if (entries[`META/image.${ext}`] || entries[`META/preview.${ext}`]) {
              hasImage = true
              break
            }
          }

          if (!infoEntry) {
            // No info.json found, return basic info
            const fileName = path.basename(filePath, path.extname(filePath))
            return {
              success: true,
              info: {
                name: fileName,
                hasImage
              }
            }
          }

          const infoData = await zip.entryData('META/info.json')
          const infoContent = infoData.toString('utf8')
          const info = JSON.parse(infoContent)

          return {
            success: true,
            info: {
              name: info.Name || info.name,
              author: info.Author || info.author,
              description: info.Description || info.description,
              version: info.Version || info.version,
              champion: info.Champion || info.champion,
              hasImage
            }
          }
        } finally {
          await zip.close()
        }
      }

      return {
        success: false,
        error: 'Unsupported file type'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract mod info'
      }
    }
  }

  private async extractImageFromWAD(modPath: string): Promise<string | null> {
    try {
      // Try to extract champion name from the mod path or metadata
      let championName: string | undefined

      // Try from folder name (e.g., "Ahri_SkinName" or "Custom_SkinName")
      const folderName = path.basename(modPath)
      const folderParts = folderName.split('_')
      if (folderParts.length > 0 && folderParts[0] !== 'Custom') {
        championName = folderParts[0]
      }

      // Try from META/info.json if available
      const metaInfoPath = path.join(modPath, 'META', 'info.json')
      if (await this.fileExists(metaInfoPath)) {
        try {
          const infoContent = await fs.readFile(metaInfoPath, 'utf-8')
          const info = JSON.parse(infoContent)
          if (info.Champion) {
            championName = info.Champion
          }
        } catch {
          // Ignore JSON parsing errors
        }
      }

      console.log(`Extracting image for champion: ${championName || 'unknown'}`)

      // Find WAD files in the mod directory
      const wadDir = path.join(modPath, 'WAD')
      if (!(await this.fileExists(wadDir))) {
        return null
      }

      const wadFiles = await fs.readdir(wadDir)
      const wadFile = wadFiles.find(
        (f) => f.endsWith('.wad') || f.endsWith('.wad.client') || f.endsWith('.fantome')
      )

      if (!wadFile) {
        return null
      }

      const wadPath = path.join(wadDir, wadFile)
      const fileBuffer = await fs.readFile(wadPath)

      // Parse WAD file
      const wadParser = new WADParser(fileBuffer)
      const header = wadParser.parseHeader()
      const chunks = wadParser.parseChunks(header)

      // Create texture extractor - pass the buffer, not the parser
      const textureExtractor = new TextureExtractor(fileBuffer, chunks)

      // Try to find loading screen textures with champion name hint
      let textureChunk: WADChunk | null = null
      const loadingScreenTextures = textureExtractor.findLoadingScreenTextures(championName)
      if (loadingScreenTextures.length > 0) {
        textureChunk = loadingScreenTextures[0]
      }

      if (!textureChunk) {
        console.log('No loading screen texture (308x560) found in WAD')
        return null
      }

      // Extract TEX file to temp location
      const tempDir = path.join(this.tempDir, `extract_${Date.now()}`)
      await fs.mkdir(tempDir, { recursive: true })
      const texPath = await textureExtractor.extractTexFile(textureChunk, tempDir)

      // Convert to PNG
      const imageConverter = new ImageConverter()

      // Ensure tools are available (will download if needed)
      try {
        await imageConverter.ensureToolsAvailable((message) => {
          console.log('Tool download:', message)
        })
      } catch (error) {
        console.error('Failed to download conversion tools:', error)
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
        return null
      }

      const pngPath = await imageConverter.convertTexToPNG(texPath)

      // Don't clean up temp directory here, as the PNG is still in it
      // The caller will handle cleanup after copying the file

      return pngPath
    } catch (error) {
      console.error('Failed to extract image from WAD:', error)
      return null
    }
  }

  async extractImageForCustomSkin(modPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stat = await fs.stat(modPath)

      // Determine the metadata folder based on file/directory structure
      let metadataPath: string
      if (stat.isFile()) {
        // New structure: mod file
        const fileName = path.basename(modPath, path.extname(modPath))
        metadataPath = path.join(this.modsDir, fileName)
      } else if (stat.isDirectory()) {
        // Legacy structure: mod folder
        metadataPath = modPath
      } else {
        return { success: false, error: 'Invalid mod path' }
      }

      // Check if metadata folder exists
      if (!(await this.fileExists(metadataPath))) {
        return { success: false, error: 'Mod metadata not found' }
      }

      // Extract image from WAD
      const extractedImage = await this.extractImageFromWAD(metadataPath)
      if (!extractedImage) {
        return { success: false, error: 'No loading screen texture (308x560) found in WAD files' }
      }

      // Move extracted image to IMAGE folder
      const imageDir = path.join(metadataPath, 'IMAGE')
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

      // Copy the extracted image (rename doesn't work across drives)
      const destPath = path.join(imageDir, 'preview.png')
      await fs.copyFile(extractedImage, destPath)

      // Clean up the entire temp directory (the PNG is in a temp folder)
      const tempDirToClean = path.dirname(extractedImage)
      if (tempDirToClean.includes('bocchi-temp')) {
        await fs.rm(tempDirToClean, { recursive: true, force: true }).catch(() => {})
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract image'
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
