import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { Preset, PresetSkin, PresetExport, PresetValidationResult } from '../types/preset'
import type { SkinInfo } from '../types'

export class PresetService {
  private presetsPath: string
  private presets: Map<string, Preset> = new Map()

  constructor() {
    const userData = app.getPath('userData')
    this.presetsPath = path.join(userData, 'presets.json')
  }

  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.presetsPath, 'utf-8')
      const presetsArray = JSON.parse(data) as Preset[]
      this.presets.clear()

      presetsArray.forEach((preset) => {
        this.presets.set(preset.id, {
          ...preset,
          createdAt: new Date(preset.createdAt),
          updatedAt: new Date(preset.updatedAt)
        })
      })
    } catch (e) {
      const error = e as NodeJS.ErrnoException
      if (error.code === 'ENOENT') {
        // File doesn't exist, create it with an empty array
        await this.save()
      } else {
        console.error('Error initializing presets:', error)
      }
      // In any error case, start with an empty presets map
      this.presets.clear()
    }
  }

  async createPreset(
    name: string,
    description: string | undefined,
    skins: PresetSkin[]
  ): Promise<Preset> {
    const id = uuidv4()
    const now = new Date()

    // Extract first 4 unique champion keys for thumbnails
    const thumbnailChampions = [...new Set(skins.map((s) => s.championKey))].slice(0, 4)

    const preset: Preset = {
      id,
      name,
      description,
      skins,
      createdAt: now,
      updatedAt: now,
      thumbnailChampions,
      skinCount: skins.length,
      tags: []
    }

    this.presets.set(id, preset)
    await this.save()
    return preset
  }

  async updatePreset(id: string, updates: Partial<Preset>): Promise<Preset> {
    const preset = this.presets.get(id)
    if (!preset) {
      throw new Error('Preset not found')
    }

    const updatedPreset: Preset = {
      ...preset,
      ...updates,
      id: preset.id, // Ensure ID cannot be changed
      createdAt: preset.createdAt, // Ensure creation date cannot be changed
      updatedAt: new Date()
    }

    // Update thumbnail champions if skins were updated
    if (updates.skins) {
      updatedPreset.thumbnailChampions = [
        ...new Set(updates.skins.map((s) => s.championKey))
      ].slice(0, 4)
      updatedPreset.skinCount = updates.skins.length
    }

    this.presets.set(id, updatedPreset)
    await this.save()
    return updatedPreset
  }

  async deletePreset(id: string): Promise<void> {
    const deleted = this.presets.delete(id)
    if (!deleted) {
      throw new Error('Preset not found')
    }
    await this.save()
  }

  async getPreset(id: string): Promise<Preset | null> {
    return this.presets.get(id) || null
  }

  async listPresets(): Promise<Preset[]> {
    return Array.from(this.presets.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    )
  }

  async duplicatePreset(id: string, newName: string): Promise<Preset> {
    const original = this.presets.get(id)
    if (!original) {
      throw new Error('Preset not found')
    }

    const duplicate = await this.createPreset(
      newName,
      original.description ? `Copy of ${original.description}` : `Copy of ${original.name}`,
      [...original.skins] // Deep copy the skins array
    )

    return duplicate
  }

  async exportPreset(id: string): Promise<PresetExport> {
    const preset = this.presets.get(id)
    if (!preset) {
      throw new Error('Preset not found')
    }

    const exportData: PresetExport = {
      version: 1,
      preset: { ...preset },
      exportedAt: new Date(),
      appVersion: app.getVersion()
    }

    return exportData
  }

  async importPreset(data: PresetExport): Promise<Preset> {
    // Validate version compatibility
    if (data.version > 1) {
      throw new Error('Preset version not supported. Please update the application.')
    }

    // Create new preset with a new ID to avoid conflicts
    const imported = await this.createPreset(
      data.preset.name,
      data.preset.description,
      data.preset.skins
    )

    return imported
  }

  async validatePresetSkins(
    preset: Preset,
    downloadedSkins: SkinInfo[]
  ): Promise<PresetValidationResult> {
    const valid: PresetSkin[] = []
    const missing: PresetSkin[] = []

    // Create a map for faster lookup
    const downloadedMap = new Map<string, SkinInfo>()
    downloadedSkins.forEach((skin) => {
      // Create keys for different matching strategies
      const baseKey = `${skin.championName}_${skin.skinName}`
      downloadedMap.set(baseKey, skin)

      // Also store without file extension for more flexible matching
      const nameWithoutExt = skin.skinName.replace(/\.(zip|wad|fantome)$/i, '')
      downloadedMap.set(`${skin.championName}_${nameWithoutExt}`, skin)
    })

    for (const presetSkin of preset.skins) {
      let found = false

      // Try different matching strategies
      const keysToTry = [
        `${presetSkin.championName}_${presetSkin.downloadedFilename}`,
        `${presetSkin.championKey}_${presetSkin.downloadedFilename}`,
        `${presetSkin.championName}_${presetSkin.lolSkinsName}`,
        `${presetSkin.championKey}_${presetSkin.lolSkinsName}`,
        // Try without extension
        `${presetSkin.championName}_${presetSkin.downloadedFilename?.replace(/\.(zip|wad|fantome)$/i, '')}`,
        `${presetSkin.championKey}_${presetSkin.downloadedFilename?.replace(/\.(zip|wad|fantome)$/i, '')}`
      ]

      for (const key of keysToTry) {
        if (key && downloadedMap.has(key)) {
          found = true
          valid.push(presetSkin)
          break
        }
      }

      if (!found) {
        missing.push(presetSkin)
      }
    }

    return {
      valid,
      missing,
      totalSkins: preset.skins.length,
      validCount: valid.length,
      missingCount: missing.length
    }
  }

  private async save(): Promise<void> {
    const presetsArray = Array.from(this.presets.values())
    await fs.writeFile(this.presetsPath, JSON.stringify(presetsArray, null, 2))
  }
}
