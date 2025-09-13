export interface SkinRepository {
  id: string
  name: string
  owner: string
  repo: string
  branch: string
  isDefault: boolean
  isCustom: boolean
  structure?: {
    skinsPath?: string
    chromaPattern?: string
  }
  lastChecked?: Date
  status?: 'active' | 'error' | 'checking' | 'unchecked'
}

export interface RepositorySettings {
  repositories: SkinRepository[]
  activeRepositoryId: string
  allowMultipleActive: boolean
}

export const DEFAULT_REPOSITORY: SkinRepository = {
  id: 'darkseal-default',
  name: 'DarkSeal Official',
  owner: 'darkseal-org',
  repo: 'lol-skins',
  branch: 'main',
  isDefault: true,
  isCustom: false,
  status: 'unchecked'
}
