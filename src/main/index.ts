import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { SkinDownloader } from './services/skinDownloader'
import { ModToolsWrapper } from './services/modToolsWrapper'
import { championDataService } from './services/championDataService'
import { FavoritesService } from './services/favoritesService'
import { ToolsDownloader } from './services/toolsDownloader'
import { settingsService } from './services/settingsService'
import { UpdaterService } from './services/updaterService'
import { FileImportService } from './services/fileImportService'
import { ImageService } from './services/imageService'
import { lcuConnector } from './services/lcuConnector'
import { gameflowMonitor } from './services/gameflowMonitor'
import { teamCompositionMonitor } from './services/teamCompositionMonitor'
import { skinApplyService } from './services/skinApplyService'
import { overlayWindowManager } from './services/overlayWindowManager'
import { autoBanPickService } from './services/autoBanPickService'
// Import SelectedSkin type from renderer atoms
interface SelectedSkin {
  championKey: string
  championName: string
  skinId: string
  skinName: string
  skinNameEn?: string
  lolSkinsName?: string
  skinNum: number
  chromaId?: string
  isDownloaded?: boolean
}

// Initialize services
const skinDownloader = new SkinDownloader()
const modToolsWrapper = new ModToolsWrapper()
const favoritesService = new FavoritesService()
const toolsDownloader = new ToolsDownloader()
const updaterService = new UpdaterService()
const fileImportService = new FileImportService()
const imageService = new ImageService()

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
    updaterService.setMainWindow(mainWindow)
    modToolsWrapper.setMainWindow(mainWindow)

    // Check for updates after window is ready
    // Only in production mode
    if (!is.dev) {
      setTimeout(() => {
        updaterService.checkForUpdates()
      }, 3000) // Delay 3 seconds to let the app fully load
    }
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
  await fileImportService.initialize()

  // Set up IPC handlers
  setupIpcHandlers()

  createWindow()

  // Create overlay if enabled in settings
  const inGameOverlayEnabled = settingsService.get('inGameOverlayEnabled')
  const autoRandomSkinEnabled = settingsService.get('autoRandomSkinEnabled')
  const autoRandomRaritySkinEnabled = settingsService.get('autoRandomRaritySkinEnabled')
  const autoRandomFavoriteSkinEnabled = settingsService.get('autoRandomFavoriteSkinEnabled')
  const championDetectionEnabled = settingsService.get('championDetectionEnabled')
  const leagueClientEnabled = settingsService.get('leagueClientEnabled')

  const anyAutoRandomEnabled =
    autoRandomSkinEnabled || autoRandomRaritySkinEnabled || autoRandomFavoriteSkinEnabled

  if (
    inGameOverlayEnabled &&
    anyAutoRandomEnabled &&
    championDetectionEnabled &&
    leagueClientEnabled
  ) {
    try {
      await overlayWindowManager.create()
      console.log('[Main] Overlay created on startup')
    } catch (error) {
      console.error('[Main] Failed to create overlay on startup:', error)
    }
  }

  // Initialize LCU connection
  setupLCUConnection()

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

// Cleanup temp transfers on exit
app.on('before-quit', async () => {
  // Stop LCU auto-connect
  lcuConnector.stopAutoConnect()
  lcuConnector.disconnect()

  const tempTransfersDir = path.join(app.getPath('userData'), 'temp-transfers')
  try {
    await fs.promises.rm(tempTransfersDir, { recursive: true, force: true })
  } catch {
    // Ignore errors during cleanup
  }
})

// Set up IPC handlers for communication with renderer
function setupIpcHandlers(): void {
  // Game detection
  ipcMain.handle('detect-game', async () => {
    try {
      const { GamePathService } = await import('./services/gamePathService')
      const gamePathService = GamePathService.getInstance()
      const gamePath = await gamePathService.forceDetect()
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
      const { GamePathService } = await import('./services/gamePathService')
      const gamePathService = GamePathService.getInstance()
      const success = await gamePathService.setGamePath(result.filePaths[0])

      if (success) {
        return { success: true, gamePath: result.filePaths[0] }
      } else {
        return { success: false, error: 'Invalid game path selected' }
      }
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

  // Open external links
  ipcMain.handle('open-external', async (_, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // File import handlers
  ipcMain.handle('import-skin-file', async (_, filePath: string, options?: any) => {
    try {
      const result = await fileImportService.importFile(filePath, options)
      return result
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('import-skin-files-batch', async (_, filePaths: string[]) => {
    try {
      const result = await fileImportService.importFiles(filePaths)
      return result
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('validate-skin-file', async (_, filePath: string) => {
    try {
      const result = await fileImportService.validateFile(filePath)
      return result
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('browse-skin-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Select skin file',
      buttonLabel: 'Select',
      filters: [
        { name: 'Skin Files', extensions: ['wad.client', 'wad', 'zip', 'fantome'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] }
    }
    return { success: false }
  })

  ipcMain.handle('browse-skin-files', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Select skin files',
      buttonLabel: 'Select',
      filters: [
        { name: 'Skin Files', extensions: ['wad.client', 'wad', 'zip', 'fantome'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePaths: result.filePaths }
    }
    return { success: false }
  })

  ipcMain.handle('browse-image-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Select preview image (optional)',
      buttonLabel: 'Select',
      filters: [
        { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] }
    }
    return { success: false }
  })

  // Patcher controls
  ipcMain.handle('run-patcher', async (_, gamePath: string, selectedSkins: string[]) => {
    try {
      // 0. Filter out base skins when their chromas are selected
      const filteredSkins = selectedSkins.filter((skinKey) => {
        const [champion, skinFile] = skinKey.split('/')

        // Check if this is a base skin
        const baseSkinName = skinFile.replace('.zip', '')

        // Check if any chroma of this skin is also selected
        const hasChromaSelected = selectedSkins.some((otherKey) => {
          if (otherKey === skinKey) return false
          const [otherChampion, otherFile] = otherKey.split('/')
          if (champion !== otherChampion) return false

          // Check if otherFile is a chroma of this base skin
          // Chromas have format "SkinName ChromaId.zip" where ChromaId is numeric
          const chromaPattern = new RegExp(
            `^${baseSkinName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\d+\\.zip$`
          )
          return chromaPattern.test(otherFile)
        })

        // If this is a base skin and its chroma is selected, filter it out
        if (hasChromaSelected && !skinFile.match(/ \d+\.zip$/)) {
          console.log(`Filtering out base skin ${skinKey} because its chroma is selected`)
          return false
        }

        return true
      })

      // Validate for single skin per champion (after filtering)
      const allowMultipleSkinsPerChampion = settingsService.get('allowMultipleSkinsPerChampion')
      if (!allowMultipleSkinsPerChampion) {
        const championCounts = new Map<string, number>()
        for (const skinKey of filteredSkins) {
          const champion = skinKey.split('/')[0]
          championCounts.set(champion, (championCounts.get(champion) || 0) + 1)
        }

        for (const [champion, count] of championCounts.entries()) {
          if (count > 1 && champion !== 'Custom') {
            return {
              success: false,
              message: `Conflict: Only one skin per champion can be injected. You have selected ${count} skins for ${champion}.`
            }
          }
        }
      }

      // 1. Download skins that are not local and get all local paths
      const skinInfosToProcess = await Promise.all(
        filteredSkins.map(async (skinKey) => {
          const [champion, skinFile] = skinKey.split('/')

          // Handle user-imported skins
          if (skinFile.includes('[User]')) {
            const skinNameWithExt = skinFile.replace('[User] ', '')
            const skinName = skinNameWithExt.replace(/\.(wad\.client|wad|zip|fantome)$/i, '')

            // First try to find the mod file in mod-files directory
            const modFilesDir = path.join(app.getPath('userData'), 'mod-files')
            const possibleExtensions = ['.wad.client', '.wad', '.zip', '.fantome']
            let modFilePath: string | null = null

            for (const ext of possibleExtensions) {
              const testPath = path.join(modFilesDir, `${champion}_${skinName}${ext}`)
              try {
                await fs.promises.access(testPath)
                modFilePath = testPath
                break
              } catch {
                // Continue to next extension
              }
            }

            // If not found in mod-files, check legacy mods directory
            if (!modFilePath) {
              modFilePath = path.join(app.getPath('userData'), 'mods', `${champion}_${skinName}`)
            }

            return { localPath: modFilePath }
          }

          // Handle remote skins
          const url = `https://github.com/darkseal-org/lol-skins/blob/main/skins/${champion}/${encodeURIComponent(
            skinFile
          )}`
          return skinDownloader.downloadSkin(url)
        })
      )

      // 2. Prepare preset for patcher
      const preset = {
        id: 'temp_' + Date.now(),
        name: 'Temporary',
        description: 'Temporary preset for patcher',
        selectedSkins: skinInfosToProcess.map((s) => s.localPath),
        gamePath,
        noTFT: true,
        ignoreConflict: allowMultipleSkinsPerChampion || false,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // 3. Apply the preset
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

  // Smart apply handler - applies only team-relevant skins
  ipcMain.handle(
    'smart-apply-skins',
    async (
      _,
      gamePath: string,
      selectedSkins: SelectedSkin[],
      teamChampionIds: number[],
      autoSyncedSkins?: SelectedSkin[]
    ) => {
      try {
        // Combine selected skins and auto-synced skins
        const allSkins = [...selectedSkins, ...(autoSyncedSkins || [])]

        // Filter skins based on team composition
        const filteredSkins = await skinApplyService.getSmartApplySkins(allSkins, teamChampionIds)

        // Convert to the format expected by run-patcher
        const skinKeys = filteredSkins.map((skin) => {
          if (skin.championKey === 'Custom') {
            return `Custom/[User] ${skin.skinName}`
          }
          // For chromas, append the chroma ID
          // Use proper name priority for downloading from repository: lolSkinsName -> nameEn -> name
          const skinNameToUse = (skin.lolSkinsName || skin.skinNameEn || skin.skinName).replace(
            /:/g,
            ''
          )
          const skinNameWithChroma = skin.chromaId
            ? `${skinNameToUse} ${skin.chromaId}.zip`
            : `${skinNameToUse}.zip`
          return `${skin.championKey}/${skinNameWithChroma}`
        })

        // Reuse the run-patcher logic directly
        // First validate for single skin per champion
        const championCounts = new Map<string, number>()
        for (const skinKey of skinKeys) {
          const champion = skinKey.split('/')[0]
          championCounts.set(champion, (championCounts.get(champion) || 0) + 1)
        }

        for (const [champion, count] of championCounts.entries()) {
          if (count > 1 && champion !== 'Custom') {
            return {
              success: false,
              message: `Conflict: Only one skin per champion can be injected. You have selected ${count} skins for ${champion}.`
            }
          }
        }

        // Download skins and apply
        const skinInfosToProcess = await Promise.all(
          skinKeys.map(async (skinKey) => {
            const [champion, skinFile] = skinKey.split('/')

            if (skinFile.includes('[User]')) {
              const skinNameWithExt = skinFile.replace('[User] ', '')
              const skinName = skinNameWithExt.replace(/\.(wad\.client|wad|zip|fantome)$/i, '')

              const modFilesDir = path.join(app.getPath('userData'), 'mod-files')
              const possibleExtensions = ['.wad.client', '.wad', '.zip', '.fantome']
              let modFilePath: string | null = null

              for (const ext of possibleExtensions) {
                const testPath = path.join(modFilesDir, `${champion}_${skinName}${ext}`)
                try {
                  await fs.promises.access(testPath)
                  modFilePath = testPath
                  break
                } catch {
                  // Continue
                }
              }

              if (!modFilePath) {
                modFilePath = path.join(app.getPath('userData'), 'mods', `${champion}_${skinName}`)
              }

              return { localPath: modFilePath }
            }

            const url = `https://github.com/darkseal-org/lol-skins/blob/main/skins/${champion}/${encodeURIComponent(skinFile)}`
            return skinDownloader.downloadSkin(url)
          })
        )

        const preset = {
          id: 'temp_' + Date.now(),
          name: 'Temporary',
          description: 'Smart apply preset',
          selectedSkins: skinInfosToProcess.map((s) => s.localPath),
          gamePath,
          noTFT: true,
          ignoreConflict: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        const result = await modToolsWrapper.applyPreset(preset)

        // Add summary info to response
        const summary = await skinApplyService.getSmartApplySummary(selectedSkins, teamChampionIds)

        return {
          ...result,
          summary
        }
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  )

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

  ipcMain.handle('get-favorites-by-champion', async (_, championKey: string) => {
    try {
      const favorites = favoritesService.getFavoritesByChampion(championKey)
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

    // If game path is being set, update the GamePathService cache
    if (key === 'gamePath' && typeof value === 'string') {
      const { GamePathService } = await import('./services/gamePathService')
      const gamePathService = GamePathService.getInstance()
      await gamePathService.setGamePath(value)
    }
  })

  // Auto-updater handlers
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await updaterService.checkForUpdates()
      return { success: true, updateInfo: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('download-update', async () => {
    try {
      await updaterService.downloadUpdate()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('quit-and-install', () => {
    updaterService.quitAndInstall()
  })

  ipcMain.handle('cancel-update', () => {
    updaterService.cancelUpdate()
    return { success: true }
  })

  ipcMain.handle('get-update-changelog', async () => {
    try {
      const changelog = await updaterService.getChangelog()
      return { success: true, changelog }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('get-update-info', () => {
    return updaterService.getUpdateInfo()
  })

  // App info
  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  // Custom skin images
  ipcMain.handle('get-custom-skin-image', async (_, modPath: string) => {
    try {
      const imageUrl = await imageService.getCustomSkinImage(modPath)
      return { success: true, imageUrl }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Edit custom skin
  ipcMain.handle(
    'edit-custom-skin',
    async (_, modPath: string, newName: string, newImagePath?: string) => {
      try {
        const result = await fileImportService.editCustomSkin(modPath, newName, newImagePath)
        return result
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  )

  // Delete custom skin
  ipcMain.handle('delete-custom-skin', async (_, modPath: string) => {
    try {
      const result = await fileImportService.deleteCustomSkin(modPath)
      return result
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // P2P File Transfer handlers
  ipcMain.handle('get-mod-file-info', async (_, filePath: string) => {
    try {
      const stat = await fs.promises.stat(filePath)
      const fileBuffer = await fs.promises.readFile(filePath)
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')

      const mimeType =
        filePath.endsWith('.wad.client') || filePath.endsWith('.wad')
          ? 'application/x-wad'
          : filePath.endsWith('.zip')
            ? 'application/zip'
            : filePath.endsWith('.fantome')
              ? 'application/x-fantome'
              : 'application/octet-stream'

      return {
        success: true,
        data: {
          fileName: path.basename(filePath),
          size: stat.size,
          hash,
          mimeType
        }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('read-file-chunk', async (_, filePath: string, offset: number, length: number) => {
    try {
      const fileHandle = await fs.promises.open(filePath, 'r')
      const buffer = Buffer.alloc(length)
      const { bytesRead } = await fileHandle.read(buffer, 0, length, offset)
      await fileHandle.close()

      // Convert to ArrayBuffer for transfer
      const arrayBuffer = buffer.subarray(0, bytesRead).buffer

      return {
        success: true,
        data: arrayBuffer
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('prepare-temp-file', async (_, fileName: string) => {
    try {
      const tempDir = path.join(app.getPath('userData'), 'temp-transfers')
      await fs.promises.mkdir(tempDir, { recursive: true })

      const tempPath = path.join(tempDir, `${Date.now()}_${fileName}`)
      return { success: true, path: tempPath }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle(
    'write-file-from-chunks',
    async (_, filePath: string, chunks: ArrayBuffer[], expectedHash: string) => {
      try {
        // Combine chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
        const combined = new Uint8Array(totalLength)
        let offset = 0

        for (const chunk of chunks) {
          combined.set(new Uint8Array(chunk), offset)
          offset += chunk.byteLength
        }

        // Write to file
        await fs.promises.writeFile(filePath, combined)

        // Verify hash
        const fileBuffer = await fs.promises.readFile(filePath)
        const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex')

        if (actualHash !== expectedHash) {
          await fs.promises.unlink(filePath) // Delete corrupted file
          return { success: false, error: 'File hash mismatch' }
        }

        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  )

  // Import file (alias for import-skin-file used by file transfer)
  ipcMain.handle('import-file', async (_, filePath: string, options?: any) => {
    try {
      const result = await fileImportService.importFile(filePath, options)
      return result
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // LCU Connection handlers
  ipcMain.handle('lcu:connect', async () => {
    try {
      // Start auto-connect when manually enabled
      lcuConnector.startAutoConnect(5000)
      const connected = await lcuConnector.connect()
      if (connected) {
        await gameflowMonitor.start()
        await teamCompositionMonitor.start()
      }
      return { success: connected }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('lcu:disconnect', () => {
    gameflowMonitor.stop()
    teamCompositionMonitor.stop()
    lcuConnector.stopAutoConnect()
    lcuConnector.disconnect()
    return { success: true }
  })

  ipcMain.handle('lcu:get-status', () => {
    return {
      connected: lcuConnector.isConnected(),
      gameflowPhase: gameflowMonitor.getCurrentPhase()
    }
  })

  ipcMain.handle('lcu:get-current-phase', async () => {
    try {
      const phase = await lcuConnector.getGameflowPhase()
      return { success: true, phase }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('lcu:get-champ-select-session', async () => {
    try {
      const session = await lcuConnector.getChampSelectSession()
      return { success: true, session }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Auto Ban/Pick handlers
  ipcMain.handle('lcu:get-owned-champions', async () => {
    try {
      const champions = await lcuConnector.getOwnedChampions()
      return { success: true, champions }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('lcu:get-all-champions', async () => {
    try {
      const champions = await lcuConnector.getAllChampions()
      return { success: true, champions }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('set-auto-pick-champions', async (_, championIds: number[]) => {
    try {
      await autoBanPickService.setPickChampions(championIds)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('set-auto-ban-champions', async (_, championIds: number[]) => {
    try {
      await autoBanPickService.setBanChampions(championIds)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Team composition handlers
  ipcMain.handle('team:get-composition', () => {
    const composition = teamCompositionMonitor.getCurrentTeamComposition()
    return { success: true, composition }
  })

  ipcMain.handle('team:is-ready-for-smart-apply', () => {
    const ready = teamCompositionMonitor.isReadyForSmartApply()
    return { success: true, ready }
  })

  ipcMain.handle(
    'team:get-smart-apply-summary',
    async (
      _,
      selectedSkins: SelectedSkin[],
      teamChampionIds: number[],
      autoSyncedSkins?: SelectedSkin[]
    ) => {
      // Combine selected skins and auto-synced skins
      const allSkins = [...selectedSkins, ...(autoSyncedSkins || [])]
      const summary = await skinApplyService.getSmartApplySummary(allSkins, teamChampionIds)
      return { success: true, summary }
    }
  )

  // Overlay skin selection handler
  overlayWindowManager.on('skin-selected', (skin: SelectedSkin) => {
    // Send the selected skin to the main window
    const mainWindow = BrowserWindow.getAllWindows().find(
      (w) => !w.webContents.getURL().includes('overlay.html')
    )
    if (mainWindow) {
      mainWindow.webContents.send('overlay:skin-selected', skin)
    }
  })

  // Create overlay handler
  ipcMain.handle('create-overlay', async () => {
    try {
      await overlayWindowManager.create()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Destroy overlay handler
  ipcMain.handle('destroy-overlay', async () => {
    try {
      overlayWindowManager.destroy()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
}

// Setup LCU connection and event forwarding
function setupLCUConnection(): void {
  // Forward LCU events to renderer
  lcuConnector.on('connected', () => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('lcu:connected')
    })
  })

  lcuConnector.on('disconnected', () => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('lcu:disconnected')
    })
  })

  lcuConnector.on('error', (error) => {
    console.error('LCU Connection error:', error)
  })

  // Forward gameflow events
  gameflowMonitor.on('phase-changed', (phase, previousPhase) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('lcu:phase-changed', { phase, previousPhase })
    })

    // Handle auto ban/pick based on phase
    if (phase === 'ChampSelect') {
      const autoPickEnabled = settingsService.get('autoPickEnabled')
      const autoBanEnabled = settingsService.get('autoBanEnabled')
      if (autoPickEnabled || autoBanEnabled) {
        autoBanPickService.start()
      }
    } else if (phase !== 'ChampSelect' && previousPhase === 'ChampSelect') {
      autoBanPickService.stop()
    }
  })

  gameflowMonitor.on('champion-selected', async (data) => {
    // Forward to all windows
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('lcu:champion-selected', data)
    })

    // Also handle overlay display in the same event
    // Handle overlay display
    if (data.isLocked) {
      try {
        // Get current language from settings
        const currentLanguage = settingsService.get('language') || 'en_US'

        // Get champion data
        const champData = await championDataService.getChampionByKey(
          data.championId.toString(),
          currentLanguage
        )
        if (!champData) {
          console.error('[Overlay] Champion data not found for ID:', data.championId)
          return
        }

        // Get user settings
        const autoRandomSkinEnabled = settingsService.get('autoRandomSkinEnabled') || false
        const autoRandomRaritySkinEnabled =
          settingsService.get('autoRandomRaritySkinEnabled') || false
        const autoRandomFavoriteSkinEnabled =
          settingsService.get('autoRandomFavoriteSkinEnabled') || false
        const championDetectionEnabled = settingsService.get('championDetectionEnabled') !== false

        // Check if any auto-random feature is enabled
        const autoRandomEnabled =
          autoRandomSkinEnabled || autoRandomRaritySkinEnabled || autoRandomFavoriteSkinEnabled

        if (!championDetectionEnabled) {
          return
        }

        // Theme will be handled by the overlay renderer

        // Prepare overlay data
        const overlayData: any = {
          championId: data.championId,
          championKey: champData.key,
          championName: champData.name,
          skins: (champData.skins || []).map((skin: any) => ({
            ...skin,
            splashPath: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champData.key}_${skin.num}.jpg`,
            tilePath: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champData.key}_${skin.num}.jpg`
          })),
          autoRandomEnabled,
          theme: null // Will be set by renderer based on current theme
        }

        // If auto-random is enabled, select a random skin
        if (autoRandomEnabled && overlayData.skins && overlayData.skins.length > 1) {
          let selectableSkins = overlayData.skins.filter((s: any) => s.num > 0)
          let selectedSkin = null

          if (selectableSkins.length > 0) {
            // Get favorites for potential use
            const favorites = favoritesService.getFavoritesByChampion(champData.key)

            if (autoRandomFavoriteSkinEnabled && favorites.length > 0) {
              // Only select from favorites
              selectableSkins = selectableSkins.filter((skin: any) =>
                favorites.some((f: any) => f.skinId === skin.id)
              )
              if (selectableSkins.length > 0) {
                selectedSkin = selectableSkins[Math.floor(Math.random() * selectableSkins.length)]
              }
            } else if (autoRandomRaritySkinEnabled) {
              // Only select from skins with rarity
              selectableSkins = selectableSkins.filter(
                (skin: any) => skin.rarity && skin.rarity !== 'kNoRarity'
              )
              if (selectableSkins.length > 0) {
                // Weight by rarity
                const weightedSkins = selectableSkins.map((skin: any) => {
                  let weight = 1
                  if (skin.rarity === 'kEpic') weight = 2
                  if (skin.rarity === 'kLegendary') weight = 3
                  if (skin.rarity === 'kUltimate') weight = 4
                  if (skin.rarity === 'kMythic') weight = 5
                  return { skin, weight }
                })

                const totalWeight = weightedSkins.reduce(
                  (sum: number, item: any) => sum + item.weight,
                  0
                )
                let random = Math.random() * totalWeight

                for (const item of weightedSkins) {
                  random -= item.weight
                  if (random <= 0) {
                    selectedSkin = item.skin
                    break
                  }
                }
              }
            } else if (autoRandomSkinEnabled) {
              // Pure random from all skins
              selectedSkin = selectableSkins[Math.floor(Math.random() * selectableSkins.length)]
            }

            if (selectedSkin) {
              overlayData.autoSelectedSkin = {
                championKey: champData.key,
                championName: champData.name,
                skinId: (selectedSkin as any).id,
                skinName: (selectedSkin as any).name,
                skinNum: (selectedSkin as any).num,
                splashPath: (selectedSkin as any).splashPath,
                rarity: (selectedSkin as any).rarity
              }
            }
          }
        }

        // Show overlay
        await overlayWindowManager.show(overlayData)
      } catch (error) {
        console.error('[Overlay] Error handling champion lock:', error)
      }
    }
  })

  gameflowMonitor.on('ready-check-accepted', () => {
    // Forward to all windows
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('lcu:ready-check-accepted')
    })
  })

  // Forward team composition events
  teamCompositionMonitor.on('team-composition-updated', (composition) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('team:composition-updated', composition)
    })
  })

  teamCompositionMonitor.on('ready-for-smart-apply', (composition) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('team:ready-for-smart-apply', composition)
    })
  })

  teamCompositionMonitor.on('team-reset', (newPhase: string) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('team:reset', newPhase)
    })
  })

  // Check if League Client integration is enabled in settings
  const leagueClientEnabled = settingsService.get('leagueClientEnabled')
  // Default to true if not set
  if (leagueClientEnabled !== false) {
    // Start auto-connect which will keep trying to connect to League client
    // This ensures we connect even if League is started after the app
    lcuConnector.startAutoConnect(5000) // Check every 5 seconds
  }

  // When connected, start gameflow monitoring
  lcuConnector.on('connected', () => {
    gameflowMonitor.start()
    teamCompositionMonitor.start()

    // Start auto ban/pick if enabled
    const autoPickEnabled = settingsService.get('autoPickEnabled')
    const autoBanEnabled = settingsService.get('autoBanEnabled')
    if (autoPickEnabled || autoBanEnabled) {
      autoBanPickService.start()
    }
  })
}

// Cleanup function for graceful shutdown
function cleanup(): void {
  console.log('Cleaning up LCU connections...')

  // Stop monitoring services
  gameflowMonitor.stop()
  teamCompositionMonitor.stop()
  autoBanPickService.stop()

  // Stop auto-connect and disconnect from LCU
  lcuConnector.stopAutoConnect()
  lcuConnector.disconnect()

  // Clean up overlay window
  overlayWindowManager.destroy()

  // Remove all listeners to prevent memory leaks
  lcuConnector.removeAllListeners()
  gameflowMonitor.removeAllListeners()
  teamCompositionMonitor.removeAllListeners()
  overlayWindowManager.removeAllListeners()
  autoBanPickService.removeAllListeners()
}

// Handle app quit events
app.on('before-quit', () => {
  cleanup()
})

app.on('window-all-closed', () => {
  cleanup()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', (event) => {
  // Prevent quit until cleanup is done
  event.preventDefault()
  cleanup()
  // Allow quit after cleanup
  setTimeout(() => {
    app.exit(0)
  }, 100)
})
