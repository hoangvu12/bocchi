export interface Preset {
  id: string
  name: string
  description: string
  selectedMods?: string[]
  selectedSkins?: string[]
  gamePath: string
  noTFT?: boolean
  ignoreConflict?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ModInfo {
  id: string
  name: string
  version: string
  author: string
  description: string
  installed: boolean
}

export interface SkinMetadata {
  commitSha: string
  downloadedAt: Date
  lastUpdateCheck?: Date
  fileSize?: number
  githubPath?: string
  version?: number
  championId?: number // For ID-based repositories
  skinId?: string // For ID-based repositories
  chromaId?: string // For ID-based repository chromas
}

export interface SkinUpdateInfo {
  hasUpdate: boolean
  currentCommitSha?: string
  latestCommitSha?: string
  latestCommitDate?: Date
  updateMessage?: string
  canCheck: boolean
}

export interface SkinInfo {
  championName: string
  skinName: string
  url: string
  localPath?: string
  source?: 'repository' | 'user' | 'p2p'
  sharedBy?: string
  metadata?: SkinMetadata
  updateInfo?: SkinUpdateInfo
  author?: string // Author for custom/user mods
}

export interface P2PRoom {
  id: string
  createdAt: Date
  host: P2PRoomMember
  members: P2PRoomMember[]
}

export interface P2PRoomMember {
  id: string
  name: string
  activeSkins: any[] // Using any to avoid circular dependency, actual type is SelectedSkin from renderer
  isHost: boolean
  connected: boolean
  selectedChampion?: {
    id: number
    key: string
    name: string
    isLocked: boolean
  }
}

export interface P2PSettings {
  displayName: string
  autoSync: boolean
}
