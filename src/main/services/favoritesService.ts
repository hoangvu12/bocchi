import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

export interface FavoriteItem {
  championKey: string
  skinId: string
  skinName: string
  chromaId?: string
  chromaName?: string
  addedAt: Date
}

export class FavoritesService {
  private favoritesPath: string
  private favorites: Map<string, FavoriteItem> = new Map()

  constructor() {
    const userData = app.getPath('userData')
    this.favoritesPath = path.join(userData, 'favorites.json')
  }

  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.favoritesPath, 'utf-8')
      const favoritesArray = JSON.parse(data) as FavoriteItem[]
      this.favorites.clear()

      // Migrate old favorites to new format if needed
      let needsMigration = false

      favoritesArray.forEach((fav) => {
        // Check if this is an old format favorite (no chromaId means it's a base skin favorite)
        if (!fav.chromaId && !fav.chromaName) {
          needsMigration = true
        }

        const key = this.getKey(fav.championKey, fav.skinId, fav.chromaId)
        this.favorites.set(key, {
          ...fav,
          addedAt: new Date(fav.addedAt)
        })
      })

      // Save if migration was needed to persist the updated format
      if (needsMigration) {
        await this.save()
      }
    } catch (e) {
      const error = e as NodeJS.ErrnoException
      if (error.code === 'ENOENT') {
        // File doesn't exist, create it with an empty array.
        await this.save()
      } else {
        console.error('Error initializing favorites:', error)
      }
      // In any error case, start with an empty favorites list.
      this.favorites.clear()
    }
  }

  private getKey(championKey: string, skinId: string, chromaId?: string): string {
    if (chromaId) {
      return `${championKey}_${skinId}_${chromaId}`
    }
    // For base skins, use 'base' as the chromaId for consistency
    return `${championKey}_${skinId}_base`
  }

  async addFavorite(
    championKey: string,
    skinId: string,
    skinName: string,
    chromaId?: string,
    chromaName?: string
  ): Promise<void> {
    const key = this.getKey(championKey, skinId, chromaId)
    this.favorites.set(key, {
      championKey,
      skinId,
      skinName,
      chromaId,
      chromaName,
      addedAt: new Date()
    })
    await this.save()
  }

  async removeFavorite(championKey: string, skinId: string, chromaId?: string): Promise<void> {
    const key = this.getKey(championKey, skinId, chromaId)
    this.favorites.delete(key)
    await this.save()
  }

  isFavorite(championKey: string, skinId: string, chromaId?: string): boolean {
    const key = this.getKey(championKey, skinId, chromaId)
    return this.favorites.has(key)
  }

  getFavorites(): FavoriteItem[] {
    return Array.from(this.favorites.values()).sort(
      (a, b) => b.addedAt.getTime() - a.addedAt.getTime()
    )
  }

  getFavoritesByChampion(championKey: string): FavoriteItem[] {
    return Array.from(this.favorites.values())
      .filter((fav) => fav.championKey === championKey)
      .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
  }

  private async save(): Promise<void> {
    const favoritesArray = Array.from(this.favorites.values())
    await fs.writeFile(this.favoritesPath, JSON.stringify(favoritesArray, null, 2))
  }
}
