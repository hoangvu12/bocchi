import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { GameDetector } from './services/gameDetector'
import { SkinDownloader } from './services/skinDownloader'
import { ModToolsWrapper } from './services/modToolsWrapper'
import { ChampionDataService } from './services/championDataService'
import { FavoritesService } from './services/favoritesService'
import { ToolsDownloader } from './services/toolsDownloader'
import { SettingsService } from './services/settingsService'

// Initialize services
const gameDetector = new GameDetector()
const skinDownloader = new SkinDownloader()
const modToolsWrapper = new ModToolsWrapper()
const championDataService = new ChampionDataService()
const favoritesService = new FavoritesService()
const toolsDownloader = new ToolsDownloader()
const settingsService = new SettingsService()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize services
  await skinDownloader.initialize()
  await favoritesService.initialize()

  // Set up IPC handlers
  setupIpcHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Set up IPC handlers for communication with renderer
function setupIpcHandlers(): void {
  // Game detection
  ipcMain.handle('detect-game', async () => {
    try {
      const gamePath = await gameDetector.detectGamePath()
      return { success: true, gamePath }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Browse for game folder
  ipcMain.handle('browse-game-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select League of Legends Game folder'
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, gamePath: result.filePaths[0] }
    }
    return { success: false }
  })

  // Skin management
  ipcMain.handle('download-skin', async (_, url: string) => {
    try {
      const skinInfo = await skinDownloader.downloadSkin(url)
      return { success: true, skinInfo }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('list-downloaded-skins', async () => {
    try {
      const skins = await skinDownloader.listDownloadedSkins()
      return { success: true, skins }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('delete-skin', async (_, championName: string, skinName: string) => {
    try {
      await skinDownloader.deleteSkin(championName, skinName)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Patcher controls
  ipcMain.handle('run-patcher', async (_, gamePath: string, selectedSkins: string[]) => {
    try {
      const preset = {
        id: 'temp_' + Date.now(),
        name: 'Temporary',
        description: 'Temporary preset for patcher',
        selectedSkins,
        gamePath,
        noTFT: true,
        ignoreConflict: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await modToolsWrapper.applyPreset(preset)
      return result
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('stop-patcher', async () => {
    try {
      await modToolsWrapper.stopOverlay()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('is-patcher-running', async () => {
    return modToolsWrapper.isRunning()
  })

  // Champion data management
  ipcMain.handle('fetch-champion-data', async (_, language?: string) => {
    try {
      // If no language specified, fetch for all supported languages
      if (!language) {
        const result = await championDataService.fetchAllLanguages()
        return result
      } else {
        const result = await championDataService.fetchAndSaveChampionData(language)
        return result
      }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('load-champion-data', async (_, language?: string) => {
    try {
      const currentLang = language || (await settingsService.get('language')) || 'en_US'
      const data = await championDataService.loadChampionData(currentLang)
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('check-champion-updates', async (_, language?: string) => {
    try {
      const currentLang = language || (await settingsService.get('language')) || 'en_US'
      const needsUpdate = await championDataService.checkForUpdates(currentLang)
      return { success: true, needsUpdate }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Favorites management
  ipcMain.handle(
    'add-favorite',
    async (_, championKey: string, skinId: string, skinName: string) => {
      try {
        await favoritesService.addFavorite(championKey, skinId, skinName)
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  )

  ipcMain.handle('remove-favorite', async (_, championKey: string, skinId: string) => {
    try {
      await favoritesService.removeFavorite(championKey, skinId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('is-favorite', async (_, championKey: string, skinId: string) => {
    return favoritesService.isFavorite(championKey, skinId)
  })

  ipcMain.handle('get-favorites', async () => {
    try {
      const favorites = favoritesService.getFavorites()
      return { success: true, favorites }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Tools management
  ipcMain.handle('check-tools-exist', async () => {
    return await toolsDownloader.checkToolsExist()
  })

  ipcMain.handle('download-tools', async (event) => {
    try {
      await toolsDownloader.downloadAndExtractTools((progress) => {
        event.sender.send('tools-download-progress', progress)
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('get-tools-info', async () => {
    try {
      const info = await toolsDownloader.getLatestReleaseInfo()
      return { success: true, ...info }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Window controls
  ipcMain.on('window-minimize', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) window.minimize()
  })

  ipcMain.on('window-maximize', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
  })

  ipcMain.on('window-close', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) window.close()
  })

  ipcMain.handle('window-is-maximized', () => {
    const window = BrowserWindow.getFocusedWindow()
    return window ? window.isMaximized() : false
  })

  // Settings management
  ipcMain.handle('get-settings', async (_, key?: string) => {
    return settingsService.get(key)
  })

  ipcMain.handle('set-settings', async (_, key: string, value: any) => {
    settingsService.set(key, value)
  })
}
