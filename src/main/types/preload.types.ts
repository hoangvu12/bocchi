// Shared types for preload bridge between main and renderer

export interface SelectedSkin {
  championKey: string
  championName: string
  championId?: number // Numeric champion ID for ID-based repositories
  skinId: string
  skinName: string
  skinNameEn?: string
  lolSkinsName?: string
  isInLolSkins?: boolean
  skinNum: number
  chromaId?: string
  variantId?: string
  isDownloaded?: boolean
  isAutoSelected?: boolean
  downloadedFilename?: string
}

export interface AutoSyncedSkin extends SelectedSkin {
  fromPeerId: string
  fromPeerName: string
  isAutoSynced: true
  tempFilePath?: string
}

export interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
  releaseName?: string
  releaseNotesUrl?: string
}

export interface UpdateProgress {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

export interface DownloadProgress {
  current: number
  total: number
  championName?: string
  skinName?: string
  stage?: string
  error?: string
}

export interface ImportProgress {
  stage: 'scanning' | 'importing' | 'complete'
  current?: number
  total?: number
  currentFile?: string
  imported?: number
  skipped?: number
  failed?: number
}

export interface ImportOptions {
  overwrite?: boolean
  skipExisting?: boolean
  preserveStructure?: boolean
  championName?: string
  skinName?: string
  author?: string
  imagePath?: string
}

export interface ChampSelectSession {
  myTeam: Array<{
    cellId: number
    championId: number
    championPickIntent: number
    assignedPosition: string
  }>
  actions: Array<
    Array<{
      id: number
      championId: number
      completed: boolean
      type: 'ban' | 'pick'
    }>
  >
  localPlayerCellId: number
  timer: {
    phase: string
    adjustedTimeLeftInPhase: number
  }
}

export interface LCUChampion {
  id: number
  name: string
  squarePortraitPath?: string
  alias?: string
}

export interface LobbySession {
  gameConfig: {
    gameMode: string
    queueId: number
  }
  localMember: {
    summonerId: number
  }
  members: Array<{
    summonerId: number
    puuid: string
  }>
}

export interface PreselectModeData {
  queueId: number
  champions: PreselectChampion[]
}

export interface PreselectChampion {
  championId: number
  isLocked: boolean
}

export interface PreselectSnapshot {
  champions: PreselectChampion[]
  queueId: number
  timestamp: number
  hasMatch?: boolean
}

export interface PresetUpdate {
  name?: string
  description?: string
  selectedMods?: string[]
  selectedSkins?: string[]
}

export interface ApplySummary {
  success: boolean
  appliedCount: number
  failedCount: number
  skippedCount: number
  errors?: string[]
  totalSelected: number
  willApply: number
  teamChampions: string[]
  customModCount: number
}

export interface ThemeColors {
  primary: string
  secondary: string
  background: string
  surface: string
  text: string
}
