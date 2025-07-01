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
  onToolsDownloadProgress: (callback: (progress: number) => void) => void

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
  onUpdateChecking: (callback: () => void) => void
  onUpdateAvailable: (callback: (info: any) => void) => void
  onUpdateNotAvailable: (callback: () => void) => void
  onUpdateError: (callback: (error: string) => void) => void
  onUpdateDownloadProgress: (callback: (progress: any) => void) => void
  onUpdateDownloaded: (callback: () => void) => void

  // App info
  getAppVersion: () => Promise<string>

  // Patcher events
  onPatcherStatus: (callback: (status: string) => void) => void
  onPatcherMessage: (callback: (message: string) => void) => void
  onPatcherError: (callback: (error: string) => void) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: IApi
  }
}
