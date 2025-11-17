export type RepositoryStructureType = 'name-based' | 'id-based'

export interface RepositoryStructure {
  type: RepositoryStructureType
  skinsPath: string
  chromaPattern?: string
  autoDetected: boolean
}

export interface SkinRepository {
  id: string
  name: string
  owner: string
  repo: string
  branch: string
  isDefault: boolean
  isCustom: boolean
  structure?: RepositoryStructure
  lastChecked?: Date
  status?: 'active' | 'error' | 'checking' | 'unchecked'
}

export interface RepositorySettings {
  repositories: SkinRepository[]
  activeRepositoryId: string
  allowMultipleActive: boolean
}

export interface RepositoryDetectionResult {
  type: RepositoryStructureType
  confidence: number
  skinsPath: string
  sampledPaths: string[]
  error?: string
}

export const DEFAULT_REPOSITORY_STRUCTURE: RepositoryStructure = {
  type: 'name-based',
  skinsPath: 'skins',
  autoDetected: false
}

export const DEFAULT_REPOSITORY: SkinRepository = {
  id: 'leagueskins-default',
  name: 'LeagueSkins Official',
  owner: 'Alban1911',
  repo: 'LeagueSkins',
  branch: 'main',
  isDefault: true,
  isCustom: false,
  structure: {
    type: 'id-based',
    skinsPath: 'skins',
    autoDetected: true
  },
  status: 'unchecked'
}
