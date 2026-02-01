export interface PresetSkin {
  championKey: string
  championName: string
  skinId: string
  skinName: string
  skinNameEn?: string
  skinNum: number
  chromaId?: string
  chromaName?: string
  variantId?: string
  variantName?: string
  downloadedFilename?: string
}

export interface Preset {
  id: string
  name: string
  description?: string
  skins: PresetSkin[]
  createdAt: Date
  updatedAt: Date
  thumbnailChampions?: string[] // First 3-4 champion keys for preview
  skinCount: number
  tags?: string[] // For future categorization
}

export interface PresetExport {
  version: number
  preset: Preset
  exportedAt: Date
  appVersion?: string
}

export interface PresetValidationResult {
  valid: PresetSkin[]
  missing: PresetSkin[]
  totalSkins: number
  validCount: number
  missingCount: number
}
