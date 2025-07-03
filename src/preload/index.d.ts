import { ElectronAPI } from '@electron-toolkit/preload'
import { SkinInfo } from '../main/types'

export interface IApi {
  detectGame: () => Promise<{ success: boolean; gamePath?: string | null; error?: string }>
  browseGameFolder: () => Promise<{ success: boolean; gamePath?: string }>
  downloadSkin: (url: string) => Promise<{ success: boolean; skinInfo?: SkinInfo; error?: string }>
  listDownloadedSkins: () => Promise<{ success: boolean; skins?: SkinInfo[]; error?: string }>
  deleteSkin: (
    championName: string,
    skinName: string
  ) => Promise<{ success: boolean; error?: string }>

  // File import
  importSkinFile: (
    filePath: string,
    options?: { championName?: string; skinName?: string; imagePath?: string }
  ) => Promise<{ success: boolean; skinInfo?: SkinInfo; error?: string }>
  validateSkinFile: (filePath: string) => Promise<{ valid: boolean; error?: string }>
  browseSkinFile: () => Promise<{ success: boolean; filePath?: string }>
  browseImageFile: () => Promise<{ success: boolean; filePath?: string }>

  runPatcher: (
    gamePath: string,
    selectedSkins: string[]
  ) => Promise<{ success: boolean; message?: string }>
  stopPatcher: () => Promise<{ success: boolean; error?: string }>
  isPatcherRunning: () => Promise<boolean>
  fetchChampionData: (
    language?: string
  ) => Promise<{ success: boolean; message: string; championCount?: number }>
  loadChampionData: (language?: string) => Promise<{ success: boolean; data?: any; error?: string }>
  checkChampionUpdates: (
    language?: string
  ) => Promise<{ success: boolean; needsUpdate?: boolean; error?: string }>
  getChromasForSkin: (
    skinId: string
  ) => Promise<{ success: boolean; chromas?: any[]; error?: string }>

  // Favorites
  addFavorite: (
    championKey: string,
    skinId: string,
    skinName: string
  ) => Promise<{ success: boolean; error?: string }>
  removeFavorite: (
    championKey: string,
    skinId: string
  ) => Promise<{ success: boolean; error?: string }>
  isFavorite: (championKey: string, skinId: string) => Promise<boolean>
  getFavorites: () => Promise<{ success: boolean; favorites?: any[]; error?: string }>

  // Tools management
  checkToolsExist: () => Promise<boolean>
  downloadTools: () => Promise<{ success: boolean; error?: string }>
  getToolsInfo: () => Promise<{
    success: boolean
    downloadUrl?: string
    version?: string
    error?: string
  }>
  onToolsDownloadProgress: (callback: (progress: number) => void) => () => void

  // Window controls
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  isWindowMaximized: () => Promise<boolean>

  // Settings
  getSettings: (key?: string) => Promise<any>
  setSettings: (key: string, value: any) => Promise<void>

  // Auto-updater
  checkForUpdates: () => Promise<{ success: boolean; updateInfo?: any; error?: string }>
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>
  quitAndInstall: () => void
  cancelUpdate: () => Promise<{ success: boolean }>
  getUpdateChangelog: () => Promise<{ success: boolean; changelog?: string | null; error?: string }>
  getUpdateInfo: () => Promise<any>
  onUpdateChecking: (callback: () => void) => () => void
  onUpdateAvailable: (callback: (info: any) => void) => () => void
  onUpdateNotAvailable: (callback: () => void) => () => void
  onUpdateError: (callback: (error: string) => void) => () => void
  onUpdateDownloadProgress: (callback: (progress: any) => void) => () => void
  onUpdateDownloaded: (callback: () => void) => () => void

  // App info
  getAppVersion: () => Promise<string>

  // Custom skin images
  getCustomSkinImage: (
    modPath: string
  ) => Promise<{ success: boolean; imageUrl?: string | null; error?: string }>
  editCustomSkin: (
    modPath: string,
    newName: string,
    newImagePath?: string
  ) => Promise<{ success: boolean; error?: string }>
  deleteCustomSkin: (modPath: string) => Promise<{ success: boolean; error?: string }>

  // Patcher events
  onPatcherStatus: (callback: (status: string) => void) => () => void
  onPatcherMessage: (callback: (message: string) => void) => () => void
  onPatcherError: (callback: (error: string) => void) => () => void

  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>

  // P2P File Transfer APIs
  getModFileInfo: (filePath: string) => Promise<{
    success: boolean
    data?: {
      fileName: string
      size: number
      hash: string
      mimeType: string
    }
    error?: string
  }>
  readFileChunk: (
    filePath: string,
    offset: number,
    length: number
  ) => Promise<{ success: boolean; data?: ArrayBuffer; error?: string }>
  prepareTempFile: (
    fileName: string
  ) => Promise<{ success: boolean; path?: string; error?: string }>
  writeFileFromChunks: (
    filePath: string,
    chunks: ArrayBuffer[],
    expectedHash: string
  ) => Promise<{ success: boolean; error?: string }>
  importFile: (
    filePath: string,
    options?: any
  ) => Promise<{ success: boolean; skinInfo?: SkinInfo; error?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: IApi
  }
}
