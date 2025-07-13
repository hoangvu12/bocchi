import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'

export class SkinMigrationService {
  private migrationsDir: string
  private migrationFile: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.migrationsDir = path.join(userDataPath, 'migrations')
    this.migrationFile = path.join(this.migrationsDir, 'skin-filenames.json')
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.migrationsDir, { recursive: true })
  }

  /**
   * Load the skin filename mapping from disk
   */
  async loadMapping(): Promise<Record<string, string>> {
    try {
      const data = await fs.readFile(this.migrationFile, 'utf-8')
      return JSON.parse(data)
    } catch {
      // If file doesn't exist or is invalid, return empty mapping
      return {}
    }
  }

  /**
   * Save the skin filename mapping to disk
   */
  async saveMapping(mapping: Record<string, string>): Promise<void> {
    await fs.writeFile(this.migrationFile, JSON.stringify(mapping, null, 2))
  }

  /**
   * Get a unique key for a skin
   */
  getSkinKey(championKey: string, skinId: string, chromaId?: string): string {
    return chromaId ? `${championKey}_${skinId}_${chromaId}` : `${championKey}_${skinId}`
  }

  /**
   * Add a mapping for a downloaded skin
   */
  async addSkinMapping(
    championKey: string,
    skinId: string,
    filename: string,
    chromaId?: string
  ): Promise<void> {
    const mapping = await this.loadMapping()
    const key = this.getSkinKey(championKey, skinId, chromaId)
    mapping[key] = filename
    await this.saveMapping(mapping)
  }

  /**
   * Get the filename for a skin
   */
  async getSkinFilename(
    championKey: string,
    skinId: string,
    chromaId?: string
  ): Promise<string | undefined> {
    const mapping = await this.loadMapping()
    const key = this.getSkinKey(championKey, skinId, chromaId)
    return mapping[key]
  }

  /**
   * Scan existing downloaded skins and build mapping
   * Note: This is a placeholder for future implementation
   * Currently, we can't automatically map filenames to skin IDs without champion data
   */
  async scanAndBuildMapping(downloadedSkinsPath: string): Promise<void> {
    try {
      const champions = await fs.readdir(downloadedSkinsPath)

      for (const championDir of champions) {
        const championPath = path.join(downloadedSkinsPath, championDir)
        const stat = await fs.stat(championPath)

        if (stat.isDirectory()) {
          const skinFiles = await fs.readdir(championPath)

          for (const skinFile of skinFiles) {
            if (skinFile.endsWith('.zip') && !skinFile.startsWith('[User]')) {
              // Log found skins for debugging
              console.log(`[Migration] Found existing skin: ${championDir}/${skinFile}`)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error scanning downloaded skins:', error)
    }
  }
}

export const skinMigrationService = new SkinMigrationService()
