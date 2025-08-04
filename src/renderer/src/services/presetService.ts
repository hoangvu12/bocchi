import type { Preset, PresetSkin, PresetValidationResult } from '../../../shared/types/preset'
import type { SelectedSkin } from '../store/atoms'

export class PresetServiceClient {
  async createPreset(
    name: string,
    description: string | undefined,
    selectedSkins: SelectedSkin[]
  ): Promise<Preset> {
    // Convert SelectedSkin to PresetSkin format
    const presetSkins: PresetSkin[] = selectedSkins.map((skin) => ({
      championKey: skin.championKey,
      championName: skin.championName,
      skinId: skin.skinId,
      skinName: skin.skinName,
      skinNameEn: skin.skinNameEn,
      skinNum: skin.skinNum,
      chromaId: skin.chromaId,
      chromaName: skin.chromaId ? `Chroma ${skin.chromaId}` : undefined,
      variantId: skin.variantId,
      lolSkinsName: skin.lolSkinsName,
      downloadedFilename: skin.downloadedFilename
    }))

    const result = await window.api.createPreset(name, description, presetSkins)
    if (!result.success) {
      throw new Error(result.error || 'Failed to create preset')
    }

    return result.data
  }

  async listPresets(): Promise<Preset[]> {
    const result = await window.api.listPresets()
    if (!result.success) {
      throw new Error(result.error || 'Failed to list presets')
    }

    // Parse dates from JSON
    return (result.data || []).map((preset: any) => ({
      ...preset,
      createdAt: new Date(preset.createdAt),
      updatedAt: new Date(preset.updatedAt)
    }))
  }

  async getPreset(id: string): Promise<Preset | null> {
    const result = await window.api.getPreset(id)
    if (!result.success) {
      throw new Error(result.error || 'Failed to get preset')
    }

    if (!result.data) return null

    return {
      ...result.data,
      createdAt: new Date(result.data.createdAt),
      updatedAt: new Date(result.data.updatedAt)
    }
  }

  async updatePreset(id: string, updates: Partial<Preset>): Promise<Preset> {
    const result = await window.api.updatePreset(id, updates)
    if (!result.success) {
      throw new Error(result.error || 'Failed to update preset')
    }

    return {
      ...result.data,
      createdAt: new Date(result.data.createdAt),
      updatedAt: new Date(result.data.updatedAt)
    }
  }

  async deletePreset(id: string): Promise<void> {
    const result = await window.api.deletePreset(id)
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete preset')
    }
  }

  async duplicatePreset(id: string, newName: string): Promise<Preset> {
    const result = await window.api.duplicatePreset(id, newName)
    if (!result.success) {
      throw new Error(result.error || 'Failed to duplicate preset')
    }

    return {
      ...result.data,
      createdAt: new Date(result.data.createdAt),
      updatedAt: new Date(result.data.updatedAt)
    }
  }

  async validatePreset(id: string): Promise<PresetValidationResult> {
    const result = await window.api.validatePreset(id)
    if (!result.success) {
      throw new Error(result.error || 'Failed to validate preset')
    }

    return result.data
  }

  async exportPreset(id: string): Promise<string> {
    const result = await window.api.exportPreset(id)
    if (!result.success) {
      throw new Error(result.error || 'Failed to export preset')
    }

    return result.filePath!
  }

  async importPreset(): Promise<Preset> {
    const result = await window.api.importPreset()
    if (!result.success) {
      throw new Error(result.error || 'Failed to import preset')
    }

    return {
      ...result.data,
      createdAt: new Date(result.data.createdAt),
      updatedAt: new Date(result.data.updatedAt)
    }
  }

  // Convert preset skins back to SelectedSkin format for applying
  convertToSelectedSkins(presetSkins: PresetSkin[]): SelectedSkin[] {
    return presetSkins.map((skin) => ({
      championKey: skin.championKey,
      championName: skin.championName,
      skinId: skin.skinId,
      skinName: skin.skinName,
      skinNameEn: skin.skinNameEn,
      lolSkinsName: skin.lolSkinsName,
      skinNum: skin.skinNum,
      chromaId: skin.chromaId,
      variantId: skin.variantId,
      isDownloaded: true, // Assume downloaded if in preset
      downloadedFilename: skin.downloadedFilename
    }))
  }
}

export const presetService = new PresetServiceClient()
