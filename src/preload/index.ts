import { contextBridge, ipcRenderer } from 'electron'
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
  validateSkinFile: (filePath: string) => ipcRenderer.invoke('validate-skin-file', filePath),
  browseSkinFile: () => ipcRenderer.invoke('browse-skin-file'),
  browseImageFile: () => ipcRenderer.invoke('browse-image-file'),

  // Patcher controls
  runPatcher: (gamePath: string, selectedSkins: string[]) =>
    ipcRenderer.invoke('run-patcher', gamePath, selectedSkins),
  stopPatcher: () => ipcRenderer.invoke('stop-patcher'),
  isPatcherRunning: () => ipcRenderer.invoke('is-patcher-running'),

  // Champion data
  fetchChampionData: (language?: string) => ipcRenderer.invoke('fetch-champion-data', language),
  loadChampionData: (language?: string) => ipcRenderer.invoke('load-champion-data', language),
  checkChampionUpdates: (language?: string) =>
    ipcRenderer.invoke('check-champion-updates', language),
  getChromasForSkin: (skinId: string) => ipcRenderer.invoke('get-chromas-for-skin', skinId),

  // Favorites
  addFavorite: (championKey: string, skinId: string, skinName: string) =>
    ipcRenderer.invoke('add-favorite', championKey, skinId, skinName),
  removeFavorite: (championKey: string, skinId: string) =>
    ipcRenderer.invoke('remove-favorite', championKey, skinId),
  isFavorite: (championKey: string, skinId: string) =>
    ipcRenderer.invoke('is-favorite', championKey, skinId),
  getFavorites: () => ipcRenderer.invoke('get-favorites'),

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
    ipcRenderer.invoke('import-file', filePath, options)
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
