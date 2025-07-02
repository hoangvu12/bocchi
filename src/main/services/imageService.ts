import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'

export class ImageService {
  private modsDir: string

  constructor() {
    // Service for loading custom skin images
    this.modsDir = path.join(app.getPath('userData'), 'mods')
  }

  async getCustomSkinImage(modPath: string): Promise<string | null> {
    try {
      const stat = await fs.stat(modPath)
      let imageDir: string

      if (stat.isFile()) {
        // New structure: look for metadata folder
        const fileName = path.basename(modPath, path.extname(modPath))
        const metadataPath = path.join(this.modsDir, fileName)
        imageDir = path.join(metadataPath, 'IMAGE')
      } else if (stat.isDirectory()) {
        // Legacy structure: use the folder directly
        imageDir = path.join(modPath, 'IMAGE')
      } else {
        return null
      }

      // Check for various image formats
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp']

      for (const ext of imageExtensions) {
        const imagePath = path.join(imageDir, `preview${ext}`)
        try {
          await fs.access(imagePath)
          // Convert to base64 data URL
          const imageBuffer = await fs.readFile(imagePath)
          const base64 = imageBuffer.toString('base64')
          const mimeType =
            ext === '.jpg' || ext === '.jpeg'
              ? 'image/jpeg'
              : ext === '.png'
                ? 'image/png'
                : 'image/webp'
          return `data:${mimeType};base64,${base64}`
        } catch {
          // Continue to next extension
        }
      }

      return null
    } catch {
      return null
    }
  }
}
