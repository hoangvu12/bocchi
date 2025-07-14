import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Game detection
  detectGame: () => ipcRenderer.invoke('detect-game'),
  browseGameFolder: () => ipcRenderer.invoke('browse-game-folder'),

  // Skin management
  downloadSkin: (url: string) => ipcRenderer.invoke('download-skin', url),
  listDownloadedSkins: () => ipcRenderer.invoke('list-downloaded-skins'),
  deleteSkin: (championName: string, skinName: string) =>
    ipcRenderer.invoke('delete-skin', championName, skinName),

  // File import
  importSkinFile: (
    filePath: string,
    options?: { championName?: string; skinName?: string; imagePath?: string }
  ) => ipcRenderer.invoke('import-skin-file', filePath, options),
  importSkinFilesBatch: (filePaths: string[]) =>
    ipcRenderer.invoke('import-skin-files-batch', filePaths),
  validateSkinFile: (filePath: string) => ipcRenderer.invoke('validate-skin-file', filePath),
  browseSkinFile: () => ipcRenderer.invoke('browse-skin-file'),
  browseSkinFiles: () => ipcRenderer.invoke('browse-skin-files'),
  browseImageFile: () => ipcRenderer.invoke('browse-image-file'),

  // File path helper
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  // Patcher controls
  runPatcher: (gamePath: string, selectedSkins: string[]) =>
    ipcRenderer.invoke('run-patcher', gamePath, selectedSkins),
  stopPatcher: () => ipcRenderer.invoke('stop-patcher'),
  isPatcherRunning: () => ipcRenderer.invoke('is-patcher-running'),
  smartApplySkins: (
    gamePath: string,
    selectedSkins: any[],
    teamChampionIds: number[],
    autoSyncedSkins?: any[]
  ) =>
    ipcRenderer.invoke(
      'smart-apply-skins',
      gamePath,
      selectedSkins,
      teamChampionIds,
      autoSyncedSkins
    ),

  // Champion data
  fetchChampionData: (language?: string) => ipcRenderer.invoke('fetch-champion-data', language),
  loadChampionData: (language?: string) => ipcRenderer.invoke('load-champion-data', language),
  checkChampionUpdates: (language?: string) =>
    ipcRenderer.invoke('check-champion-updates', language),
  getChromasForSkin: (skinId: string) => ipcRenderer.invoke('get-chromas-for-skin', skinId),

  // Favorites
  addFavorite: (
    championKey: string,
    skinId: string,
    skinName: string,
    chromaId?: string,
    chromaName?: string
  ) => ipcRenderer.invoke('add-favorite', championKey, skinId, skinName, chromaId, chromaName),
  removeFavorite: (championKey: string, skinId: string, chromaId?: string) =>
    ipcRenderer.invoke('remove-favorite', championKey, skinId, chromaId),
  isFavorite: (championKey: string, skinId: string, chromaId?: string) =>
    ipcRenderer.invoke('is-favorite', championKey, skinId, chromaId),
  getFavorites: () => ipcRenderer.invoke('get-favorites'),
  getFavoritesByChampion: (championKey: string) =>
    ipcRenderer.invoke('get-favorites-by-champion', championKey),

  // Tools management
  checkToolsExist: () => ipcRenderer.invoke('check-tools-exist'),
  downloadTools: () => ipcRenderer.invoke('download-tools'),
  getToolsInfo: () => ipcRenderer.invoke('get-tools-info'),
  onToolsDownloadProgress: (callback: (progress: number) => void) => {
    const handler = (_: any, progress: number) => callback(progress)
    ipcRenderer.on('tools-download-progress', handler)
    return () => ipcRenderer.removeListener('tools-download-progress', handler)
  },

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Settings
  getSettings: (key?: string) => ipcRenderer.invoke('get-settings', key),
  setSettings: (key: string, value: any) => ipcRenderer.invoke('set-settings', key, value),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  cancelUpdate: () => ipcRenderer.invoke('cancel-update'),
  getUpdateChangelog: () => ipcRenderer.invoke('get-update-changelog'),
  getUpdateInfo: () => ipcRenderer.invoke('get-update-info'),
  onUpdateChecking: (callback: () => void) => {
    ipcRenderer.on('update-checking', callback)
    return () => ipcRenderer.removeListener('update-checking', callback)
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    const handler = (_: any, info: any) => callback(info)
    ipcRenderer.on('update-available', handler)
    return () => ipcRenderer.removeListener('update-available', handler)
  },
  onUpdateNotAvailable: (callback: () => void) => {
    ipcRenderer.on('update-not-available', callback)
    return () => ipcRenderer.removeListener('update-not-available', callback)
  },
  onUpdateError: (callback: (error: string) => void) => {
    const handler = (_: any, error: string) => callback(error)
    ipcRenderer.on('update-error', handler)
    return () => ipcRenderer.removeListener('update-error', handler)
  },
  onUpdateDownloadProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, progress: any) => callback(progress)
    ipcRenderer.on('update-download-progress', handler)
    return () => ipcRenderer.removeListener('update-download-progress', handler)
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', callback)
    return () => ipcRenderer.removeListener('update-downloaded', callback)
  },

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // External links
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // Custom skin images
  getCustomSkinImage: (modPath: string) => ipcRenderer.invoke('get-custom-skin-image', modPath),
  editCustomSkin: (modPath: string, newName: string, newImagePath?: string) =>
    ipcRenderer.invoke('edit-custom-skin', modPath, newName, newImagePath),
  deleteCustomSkin: (modPath: string) => ipcRenderer.invoke('delete-custom-skin', modPath),

  // Patcher events
  onPatcherStatus: (callback: (status: string) => void) => {
    const handler = (_: any, status: string) => {
      callback(status)
    }
    ipcRenderer.on('patcher-status', handler)
    return () => ipcRenderer.removeListener('patcher-status', handler)
  },
  onPatcherMessage: (callback: (message: string) => void) => {
    const handler = (_: any, message: string) => {
      callback(message)
    }
    ipcRenderer.on('patcher-message', handler)
    return () => ipcRenderer.removeListener('patcher-message', handler)
  },
  onPatcherError: (callback: (error: string) => void) => {
    const handler = (_: any, error: string) => {
      callback(error)
    }
    ipcRenderer.on('patcher-error', handler)
    return () => ipcRenderer.removeListener('patcher-error', handler)
  },

  // P2P File Transfer APIs
  getModFileInfo: (filePath: string) => ipcRenderer.invoke('get-mod-file-info', filePath),
  readFileChunk: (filePath: string, offset: number, length: number) =>
    ipcRenderer.invoke('read-file-chunk', filePath, offset, length),
  prepareTempFile: (fileName: string) => ipcRenderer.invoke('prepare-temp-file', fileName),
  writeFileFromChunks: (filePath: string, chunks: ArrayBuffer[], expectedHash: string) =>
    ipcRenderer.invoke('write-file-from-chunks', filePath, chunks, expectedHash),
  importFile: (filePath: string, options?: any) =>
    ipcRenderer.invoke('import-file', filePath, options),

  // LCU Connection APIs
  lcuConnect: () => ipcRenderer.invoke('lcu:connect'),
  lcuDisconnect: () => ipcRenderer.invoke('lcu:disconnect'),
  lcuGetStatus: () => ipcRenderer.invoke('lcu:get-status'),
  lcuGetCurrentPhase: () => ipcRenderer.invoke('lcu:get-current-phase'),
  lcuGetChampSelectSession: () => ipcRenderer.invoke('lcu:get-champ-select-session'),
  lcuGetOwnedChampions: () => ipcRenderer.invoke('lcu:get-owned-champions'),
  lcuGetAllChampions: () => ipcRenderer.invoke('lcu:get-all-champions'),

  // Auto Ban/Pick APIs
  setAutoPickChampions: (championIds: number[]) =>
    ipcRenderer.invoke('set-auto-pick-champions', championIds),
  setAutoBanChampions: (championIds: number[]) =>
    ipcRenderer.invoke('set-auto-ban-champions', championIds),

  // LCU Events
  onLcuConnected: (callback: () => void) => {
    ipcRenderer.on('lcu:connected', callback)
    return () => ipcRenderer.removeListener('lcu:connected', callback)
  },
  onLcuDisconnected: (callback: () => void) => {
    ipcRenderer.on('lcu:disconnected', callback)
    return () => ipcRenderer.removeListener('lcu:disconnected', callback)
  },
  onLcuPhaseChanged: (callback: (data: { phase: string; previousPhase: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('lcu:phase-changed', handler)
    return () => ipcRenderer.removeListener('lcu:phase-changed', handler)
  },
  onLcuChampionSelected: (
    callback: (data: { championId: number; isLocked: boolean; isHover: boolean }) => void
  ) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('lcu:champion-selected', handler)
    return () => ipcRenderer.removeListener('lcu:champion-selected', handler)
  },
  onLcuReadyCheckAccepted: (callback: () => void) => {
    ipcRenderer.on('lcu:ready-check-accepted', callback)
    return () => ipcRenderer.removeListener('lcu:ready-check-accepted', callback)
  },

  // Team Composition APIs
  getTeamComposition: () => ipcRenderer.invoke('team:get-composition'),
  isReadyForSmartApply: () => ipcRenderer.invoke('team:is-ready-for-smart-apply'),
  getSmartApplySummary: (
    selectedSkins: any[],
    teamChampionIds: number[],
    autoSyncedSkins?: any[]
  ) =>
    ipcRenderer.invoke(
      'team:get-smart-apply-summary',
      selectedSkins,
      teamChampionIds,
      autoSyncedSkins
    ),

  // Team Composition Events
  onTeamCompositionUpdated: (
    callback: (composition: {
      championIds: number[]
      allLocked: boolean
      inFinalization: boolean
    }) => void
  ) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('team:composition-updated', handler)
    return () => ipcRenderer.removeListener('team:composition-updated', handler)
  },
  onReadyForSmartApply: (
    callback: (composition: {
      championIds: number[]
      allLocked: boolean
      inFinalization: boolean
    }) => void
  ) => {
    const handler = (_: any, data: any) => {
      callback(data)
    }
    ipcRenderer.on('team:ready-for-smart-apply', handler)
    return () => ipcRenderer.removeListener('team:ready-for-smart-apply', handler)
  },
  onTeamReset: (callback: (newPhase?: string) => void) => {
    const handler = (_: any, newPhase?: string) => callback(newPhase)
    ipcRenderer.on('team:reset', handler)
    return () => ipcRenderer.removeListener('team:reset', handler)
  },

  // Overlay management
  createOverlay: () => ipcRenderer.invoke('create-overlay'),
  destroyOverlay: () => ipcRenderer.invoke('destroy-overlay'),
  setOverlayAutoSelectedSkin: (skinData: {
    championKey: string
    championName: string
    skinId: string | number
    skinName: string
    skinNum: number
    rarity?: string
  }) => ipcRenderer.invoke('set-overlay-auto-selected-skin', skinData),

  // MultiRitoFixes API
  checkMultiRitoFixTool: () => ipcRenderer.invoke('check-multiritofix-tool'),
  downloadMultiRitoFixTool: () => ipcRenderer.invoke('download-multiritofix-tool'),
  fixModIssues: (modPath: string) => ipcRenderer.invoke('fix-mod-issues', modPath),
  onMultiRitoFixDownloadProgress: (callback: (progress: number) => void) => {
    const handler = (_: any, progress: number) => callback(progress)
    ipcRenderer.on('multiritofix-download-progress', handler)
    return () => ipcRenderer.removeListener('multiritofix-download-progress', handler)
  },
  onFixModProgress: (callback: (message: string) => void) => {
    const handler = (_: any, message: string) => callback(message)
    ipcRenderer.on('fix-mod-progress', handler)
    return () => ipcRenderer.removeListener('fix-mod-progress', handler)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
