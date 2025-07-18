import fs from 'fs/promises'
import { existsSync } from 'fs'
import { SkinMetadata } from '../types'

export class SkinMetadataService {
  private static readonly METADATA_EXTENSION = '.meta.json'
  private static readonly METADATA_VERSION = 1

  async getMetadata(skinPath: string): Promise<SkinMetadata | null> {
    try {
      const metadataPath = this.getMetadataPath(skinPath)

      if (!existsSync(metadataPath)) {
        return null
      }

      const data = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(data)

      // Validate metadata structure
      if (!this.isValidMetadata(metadata)) {
        console.warn(`[SkinMetadata] Invalid metadata structure for ${skinPath}`)
        return null
      }

      // Convert date strings back to Date objects
      if (metadata.downloadedAt) {
        metadata.downloadedAt = new Date(metadata.downloadedAt)
      }
      if (metadata.lastUpdateCheck) {
        metadata.lastUpdateCheck = new Date(metadata.lastUpdateCheck)
      }

      return metadata
    } catch (error) {
      console.warn(`[SkinMetadata] Failed to read metadata for ${skinPath}:`, error)
      return null
    }
  }

  async saveMetadata(skinPath: string, metadata: SkinMetadata): Promise<void> {
    try {
      const metadataPath = this.getMetadataPath(skinPath)
      console.log(`[SkinMetadata] Metadata path: ${metadataPath}`)

      const metadataWithVersion = {
        ...metadata,
        version: SkinMetadataService.METADATA_VERSION
      }

      console.log(`[SkinMetadata] Writing metadata:`, metadataWithVersion)
      await fs.writeFile(metadataPath, JSON.stringify(metadataWithVersion, null, 2), 'utf-8')

      console.log(`[SkinMetadata] Successfully saved metadata for ${skinPath}`)
    } catch (error) {
      console.error(`[SkinMetadata] Failed to save metadata for ${skinPath}:`, error)
      // Don't throw - skin should still work without metadata
    }
  }

  async deleteMetadata(skinPath: string): Promise<void> {
    try {
      const metadataPath = this.getMetadataPath(skinPath)

      if (existsSync(metadataPath)) {
        await fs.unlink(metadataPath)
        console.log(`[SkinMetadata] Deleted metadata for ${skinPath}`)
      }
    } catch (error) {
      console.warn(`[SkinMetadata] Failed to delete metadata for ${skinPath}:`, error)
    }
  }

  async getAllMetadata(): Promise<Map<string, SkinMetadata>> {
    const metadataMap = new Map<string, SkinMetadata>()

    try {
      // This would require scanning all skin directories
      // For now, we'll load metadata on-demand in listDownloadedSkins
      console.log('[SkinMetadata] getAllMetadata called - metadata loaded on-demand')
    } catch (error) {
      console.warn('[SkinMetadata] Failed to load all metadata:', error)
    }

    return metadataMap
  }

  async updateLastCheckTime(skinPath: string): Promise<void> {
    const metadata = await this.getMetadata(skinPath)
    if (metadata) {
      metadata.lastUpdateCheck = new Date()
      await this.saveMetadata(skinPath, metadata)
    }
  }

  async generateMetadataForExistingSkin(
    skinPath: string,
    url: string,
    commitSha: string
  ): Promise<void> {
    try {
      // Don't overwrite existing metadata
      const existingMetadata = await this.getMetadata(skinPath)
      if (existingMetadata) {
        return
      }

      // Get file stats
      const stats = await fs.stat(skinPath)
      const githubPath = this.extractGitHubPath(url)

      const metadata: SkinMetadata = {
        commitSha,
        downloadedAt: stats.mtime, // Use file modification time as download time
        githubPath,
        fileSize: stats.size,
        version: SkinMetadataService.METADATA_VERSION
      }

      await this.saveMetadata(skinPath, metadata)
      console.log(`[SkinMetadata] Generated metadata for existing skin: ${skinPath}`)
    } catch (error) {
      console.warn(`[SkinMetadata] Failed to generate metadata for ${skinPath}:`, error)
    }
  }

  private getMetadataPath(skinPath: string): string {
    return skinPath + SkinMetadataService.METADATA_EXTENSION
  }

  private isValidMetadata(metadata: any): metadata is SkinMetadata {
    return (
      typeof metadata === 'object' &&
      metadata !== null &&
      typeof metadata.commitSha === 'string' &&
      metadata.commitSha.length > 0 &&
      (metadata.downloadedAt instanceof Date || typeof metadata.downloadedAt === 'string')
    )
  }

  private extractGitHubPath(url: string): string {
    // Convert GitHub URL to file path for API
    // Example: https://github.com/darkseal-org/lol-skins/blob/main/skins/Aatrox/Blood%20Moon%20Aatrox.zip
    // Result: skins/Aatrox/Blood Moon Aatrox.zip

    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/')

      // Find the index of 'main' or 'master' branch
      const branchIndex = pathParts.findIndex((part) => part === 'main' || part === 'master')
      if (branchIndex === -1) {
        throw new Error('Invalid GitHub URL: no main/master branch found')
      }

      // Get everything after the branch
      const filePath = pathParts.slice(branchIndex + 1).join('/')

      // Decode URL encoding
      return decodeURIComponent(filePath)
    } catch (error) {
      console.error(`[SkinMetadata] Failed to parse GitHub path from URL: ${url}`, error)
      return ''
    }
  }
}

// Export singleton instance
export const skinMetadataService = new SkinMetadataService()
