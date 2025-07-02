import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

export interface FavoriteItem {
  championKey: string
  skinId: string
  skinName: string
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
      favoritesArray.forEach((fav) => {
        const key = this.getKey(fav.championKey, fav.skinId)
        this.favorites.set(key, {
          ...fav,
          addedAt: new Date(fav.addedAt)
        })
      })
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

  private getKey(championKey: string, skinId: string): string {
    return `${championKey}_${skinId}`
  }

  async addFavorite(championKey: string, skinId: string, skinName: string): Promise<void> {
    const key = this.getKey(championKey, skinId)
    this.favorites.set(key, {
      championKey,
      skinId,
      skinName,
      addedAt: new Date()
    })
    await this.save()
  }

  async removeFavorite(championKey: string, skinId: string): Promise<void> {
    const key = this.getKey(championKey, skinId)
    this.favorites.delete(key)
    await this.save()
  }

  isFavorite(championKey: string, skinId: string): boolean {
    const key = this.getKey(championKey, skinId)
    return this.favorites.has(key)
  }

  getFavorites(): FavoriteItem[] {
    return Array.from(this.favorites.values()).sort(
      (a, b) => b.addedAt.getTime() - a.addedAt.getTime()
    )
  }

  private async save(): Promise<void> {
    const favoritesArray = Array.from(this.favorites.values())
    await fs.writeFile(this.favoritesPath, JSON.stringify(favoritesArray, null, 2))
  }
}
