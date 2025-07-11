import { GameDetector } from './gameDetector'
import { SettingsService } from './settingsService'
import * as path from 'path'
import * as fs from 'fs'

export class GamePathService {
  private static instance: GamePathService
  private gameDetector: GameDetector
  private settingsService: SettingsService
  private cachedGamePath: string | null = null
  private lastDetectionTime: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  private constructor() {
    this.gameDetector = new GameDetector()
    this.settingsService = new SettingsService()
  }

  static getInstance(): GamePathService {
    if (!GamePathService.instance) {
      GamePathService.instance = new GamePathService()
    }
    return GamePathService.instance
  }

  /**
   * Get the game path (points to the "Game" folder)
   * First tries cached value, then settings, then detection
   */
  async getGamePath(): Promise<string | null> {
    // Check if we have a valid cached path
    if (this.cachedGamePath && this.isCacheValid()) {
      if (await this.isValidGamePath(this.cachedGamePath)) {
        return this.cachedGamePath
      }
    }

    // Try to get from settings
    const savedPath = this.settingsService.get('gamePath')
    if (savedPath && typeof savedPath === 'string') {
      if (await this.isValidGamePath(savedPath)) {
        this.cachedGamePath = savedPath
        this.lastDetectionTime = Date.now()
        return savedPath
      }
    }

    // Detect game path
    const detectedPath = await this.gameDetector.detectGamePath()
    if (detectedPath) {
      // Save to settings and cache
      this.settingsService.set('gamePath', detectedPath)
      this.cachedGamePath = detectedPath
      this.lastDetectionTime = Date.now()
      return detectedPath
    }

    return null
  }

  /**
   * Get the League of Legends root path (parent of "Game" folder)
   * This is where the lockfile is located
   */
  async getLeagueRootPath(): Promise<string | null> {
    const gamePath = await this.getGamePath()
    if (gamePath) {
      return path.dirname(gamePath)
    }
    return null
  }

  /**
   * Get the lockfile path
   */
  async getLockfilePath(): Promise<string | null> {
    const rootPath = await this.getLeagueRootPath()
    if (rootPath) {
      return path.join(rootPath, 'lockfile')
    }
    return null
  }

  /**
   * Force a new detection, bypassing cache
   */
  async forceDetect(): Promise<string | null> {
    this.cachedGamePath = null
    this.lastDetectionTime = 0
    return this.getGamePath()
  }

  /**
   * Set game path manually (from file browser)
   */
  async setGamePath(gamePath: string): Promise<boolean> {
    if (await this.isValidGamePath(gamePath)) {
      this.settingsService.set('gamePath', gamePath)
      this.cachedGamePath = gamePath
      this.lastDetectionTime = Date.now()
      return true
    }
    return false
  }

  /**
   * Clear the saved game path
   */
  clearGamePath(): void {
    this.settingsService.delete('gamePath')
    this.cachedGamePath = null
    this.lastDetectionTime = 0
  }

  private isCacheValid(): boolean {
    return Date.now() - this.lastDetectionTime < this.CACHE_DURATION
  }

  private async isValidGamePath(gamePath: string): Promise<boolean> {
    try {
      const exePath = path.join(gamePath, 'League of Legends.exe')
      await fs.promises.access(exePath)
      return true
    } catch {
      return false
    }
  }
}
