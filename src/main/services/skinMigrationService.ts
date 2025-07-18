import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { SkinInfo, SkinMetadata } from '../types'
import { githubApiService } from './githubApiService'
import { skinMetadataService } from './skinMetadataService'

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

  /**
   * Generate metadata for existing skins that don't have it
   */
  async generateMetadataForExistingSkins(skins: SkinInfo[]): Promise<{
    processed: number
    successful: number
    failed: number
    errors: string[]
  }> {
    const errors: string[] = []
    let processed = 0
    let successful = 0
    let failed = 0

    const skinsWithoutMetadata = skins.filter(
      (skin) => skin.source === 'repository' && !skin.metadata && skin.localPath
    )

    if (skinsWithoutMetadata.length === 0) {
      console.log('[SkinMigration] No skins need metadata generation')
      return { processed: 0, successful: 0, failed: 0, errors: [] }
    }

    console.log(
      `[SkinMigration] Generating metadata for ${skinsWithoutMetadata.length} existing skins`
    )

    // Process in small batches to avoid API rate limits
    const BATCH_SIZE = 5
    for (let i = 0; i < skinsWithoutMetadata.length; i += BATCH_SIZE) {
      const batch = skinsWithoutMetadata.slice(i, i + BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(async (skin) => {
          processed++
          return this.generateMetadataForSkin(skin)
        })
      )

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful++
        } else {
          failed++
          const skin = batch[index]
          const error = `${skin.skinName}: ${result.reason?.message || 'Unknown error'}`
          errors.push(error)
          console.warn(
            `[SkinMigration] Failed to generate metadata for ${skin.skinName}:`,
            result.reason
          )
        }
      })

      // Rate limiting delay
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    console.log(
      `[SkinMigration] Metadata generation completed: ${successful} successful, ${failed} failed`
    )
    return { processed, successful, failed, errors }
  }

  /**
   * Generate metadata for a single skin
   */
  private async generateMetadataForSkin(skin: SkinInfo): Promise<void> {
    if (!skin.localPath) {
      throw new Error('Missing local path')
    }

    // Don't overwrite existing metadata
    const existingMetadata = await skinMetadataService.getMetadata(skin.localPath)
    if (existingMetadata) {
      console.log(`[SkinMigration] Skipping ${skin.skinName} - metadata already exists`)
      return
    }

    try {
      const githubPath = githubApiService.parseGitHubPathFromUrl(skin.url)
      const commitInfo = await githubApiService.getLatestCommitForSkin(githubPath)

      if (!commitInfo) {
        throw new Error('No commit information found')
      }

      // Get file stats
      const stats = await fs.stat(skin.localPath)

      const metadata: SkinMetadata = {
        commitSha: commitInfo.sha,
        downloadedAt: stats.mtime, // Use file modification time as download time
        githubPath,
        fileSize: stats.size,
        version: 1
      }

      await skinMetadataService.saveMetadata(skin.localPath, metadata)
      console.log(`[SkinMigration] Generated metadata for ${skin.skinName}: ${commitInfo.sha}`)
    } catch (error) {
      throw new Error(
        `Failed to generate metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Migrate metadata to new format (future use)
   */
  async migrateToNewMetadataFormat(): Promise<void> {
    console.log('[SkinMigration] No metadata format migration needed')
  }
}

export const skinMigrationService = new SkinMigrationService()
