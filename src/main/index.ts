import { app, shell, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../build/icon.png?asset'
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
import { multiRitoFixesService } from './services/multiRitoFixesService'
import { skinMigrationService } from './services/skinMigrationService'
import {
  translationService,
  supportedLanguages,
  type LanguageCode
} from './services/translationService'
import { SkinInfo } from './types'
import { PresetService } from './services/presetService'
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
  downloadedFilename?: string
}

// Initialize services
const skinDownloader = new SkinDownloader()
const modToolsWrapper = new ModToolsWrapper()
const favoritesService = new FavoritesService()
const toolsDownloader = new ToolsDownloader()
const updaterService = new UpdaterService()
const fileImportService = new FileImportService()
const imageService = new ImageService()
const presetService = new PresetService()

// Store auto-selected skin data from renderer for overlay display
let rendererAutoSelectedSkin: {
  championKey: string
  championName: string
  skinId: string | number
  skinName: string
  skinNum: number
  splashPath?: string
  rarity?: string
} | null = null

// Store the current champion ID for overlay display
let currentChampionId: number | null = null

// Global references to prevent garbage collection
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// Request single instance lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // Another instance is already running, quit this one
  app.quit()
} else {
  // Handle second instance attempt
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      if (!mainWindow.isVisible()) {
        mainWindow.show()
      }
      mainWindow.focus()
    }
  })
}

function createWindow(): void {
  // Get saved window bounds from settings
  const savedBounds = settingsService.get('windowBounds')
  const defaultBounds = {
    width: 1200,
    height: 800,
    x: undefined,
    y: undefined
  }

  // Use saved bounds if available, otherwise use defaults
  const windowBounds = savedBounds || defaultBounds

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    x: windowBounds.x,
    y: windowBounds.y,
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
    mainWindow?.show()
    if (mainWindow) {
      updaterService.setMainWindow(mainWindow)
      modToolsWrapper.setMainWindow(mainWindow)

      // Set mod tools timeout from settings
      const modToolsTimeout = settingsService.get('modToolsTimeout') || 300 // Default 300 seconds
      modToolsWrapper.setToolsTimeout(modToolsTimeout)
    }

    // Check for updates after window is ready
    // Only in production mode
    if (!is.dev) {
      setTimeout(() => {
        updaterService.checkForUpdates()
      }, 3000) // Delay 3 seconds to let the app fully load
    }
  })

  // Save window bounds when moved or resized
  let saveWindowBoundsTimeout: NodeJS.Timeout | null = null

  const saveWindowBounds = () => {
    if (!mainWindow) return

    // Clear existing timeout
    if (saveWindowBoundsTimeout) {
      clearTimeout(saveWindowBoundsTimeout)
    }

    // Debounce saves to avoid excessive writes
    saveWindowBoundsTimeout = setTimeout(() => {
      if (mainWindow && !mainWindow.isMinimized() && !mainWindow.isFullScreen()) {
        const bounds = mainWindow.getBounds()
        settingsService.set('windowBounds', bounds)
      }
    }, 500)
  }

  mainWindow.on('resize', saveWindowBounds)
  mainWindow.on('move', saveWindowBounds)

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

function updateTrayMenu(): void {
  if (!tray) return

  // Get current settings
  const minimizeToTray = settingsService.get('minimizeToTray') || false
  const leagueClientEnabled = settingsService.get('leagueClientEnabled') !== false
  const autoAcceptEnabled = settingsService.get('autoAcceptEnabled') || false
  const championDetection = settingsService.get('championDetection') !== false
  const autoViewSkinsEnabled = settingsService.get('autoViewSkinsEnabled') || false
  const smartApplyEnabled = settingsService.get('smartApplyEnabled') !== false
  const autoApplyEnabled = settingsService.get('autoApplyEnabled') !== false

  const t = translationService.t.bind(translationService)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: mainWindow?.isVisible()
        ? t('tray.hide', 'Hide Bocchi')
        : t('tray.show', 'Show Bocchi'),
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide()
          } else {
            mainWindow.show()
            mainWindow.focus()
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: t('tray.language', 'Language'),
      submenu: supportedLanguages.map((lang) => ({
        label: `${lang.flag} ${lang.name}`,
        type: 'radio' as const,
        checked: translationService.getCurrentLanguage() === lang.code,
        click: () => {
          translationService.setLanguage(lang.code)
          settingsService.set('language', lang.code)
          updateTrayMenu()
          // Notify renderer
          mainWindow?.webContents.send('language-changed', lang.code)
        }
      }))
    },
    { type: 'separator' },
    {
      label: t('nav.settings', 'Settings'),
      submenu: [
        {
          label: t('settings.minimizeToTray.title', 'Minimize to Tray'),
          type: 'checkbox',
          checked: minimizeToTray,
          click: () => {
            settingsService.set('minimizeToTray', !minimizeToTray)
            updateTrayMenu()
          }
        },
        { type: 'separator' },
        {
          label: t('settings.leagueClient.title', 'League Client Integration'),
          type: 'checkbox',
          checked: leagueClientEnabled,
          click: async () => {
            const newValue = !leagueClientEnabled
            settingsService.set('leagueClientEnabled', newValue)
            if (newValue) {
              await lcuConnector.connect()
            } else {
              await lcuConnector.disconnect()
            }
            updateTrayMenu()
            // Notify renderer
            mainWindow?.webContents.send('settings-changed', 'leagueClientEnabled', newValue)
          }
        },
        {
          label: t('settings.autoAccept.title', 'Auto Accept Match'),
          type: 'checkbox',
          checked: autoAcceptEnabled,
          enabled: leagueClientEnabled,
          click: () => {
            settingsService.set('autoAcceptEnabled', !autoAcceptEnabled)
            updateTrayMenu()
            // Notify renderer
            mainWindow?.webContents.send(
              'settings-changed',
              'autoAcceptEnabled',
              !autoAcceptEnabled
            )
          }
        },
        {
          label: t('settings.championDetection.title', 'Champion Detection'),
          type: 'checkbox',
          checked: championDetection,
          enabled: leagueClientEnabled,
          click: () => {
            settingsService.set('championDetection', !championDetection)
            updateTrayMenu()
            // Notify renderer
            mainWindow?.webContents.send(
              'settings-changed',
              'championDetection',
              !championDetection
            )
          }
        },
        {
          label: t('settings.autoViewSkins.title', 'Auto View Skins'),
          type: 'checkbox',
          checked: autoViewSkinsEnabled,
          enabled: leagueClientEnabled && championDetection,
          click: () => {
            settingsService.set('autoViewSkinsEnabled', !autoViewSkinsEnabled)
            updateTrayMenu()
            // Notify renderer
            mainWindow?.webContents.send(
              'settings-changed',
              'autoViewSkinsEnabled',
              !autoViewSkinsEnabled
            )
          }
        },
        { type: 'separator' },
        {
          label: t('settings.smartApply.title', 'Smart Apply'),
          type: 'checkbox',
          checked: smartApplyEnabled,
          enabled: leagueClientEnabled,
          click: () => {
            settingsService.set('smartApplyEnabled', !smartApplyEnabled)
            updateTrayMenu()
            // Notify renderer
            mainWindow?.webContents.send(
              'settings-changed',
              'smartApplyEnabled',
              !smartApplyEnabled
            )
          }
        },
        {
          label: t('settings.autoApply.title', 'Auto Apply'),
          type: 'checkbox',
          checked: autoApplyEnabled,
          enabled: leagueClientEnabled && smartApplyEnabled,
          click: () => {
            settingsService.set('autoApplyEnabled', !autoApplyEnabled)
            updateTrayMenu()
            // Notify renderer
            mainWindow?.webContents.send('settings-changed', 'autoApplyEnabled', !autoApplyEnabled)
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: t('tray.checkForUpdates', 'Check for Updates'),
      click: async () => {
        try {
          if (mainWindow) {
            mainWindow.show()
          }
          await updaterService.checkForUpdates()
        } catch (error) {
          console.error('Failed to check for updates:', error)
        }
      }
    },
    {
      label: t('tray.openSettings', 'Open Settings'),
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
          // Send event to open settings dialog
          mainWindow.webContents.send('open-settings')
        }
      }
    },
    { type: 'separator' },
    {
      label: t('tray.quit', 'Quit Bocchi'),
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

function createTray(): void {
  const trayIcon = nativeImage.createFromPath(icon)
  tray = new Tray(trayIcon)
  tray.setToolTip('Bocchi')

  // Initial menu
  updateTrayMenu()

  // Double click to show window
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })

  // Update menu when window visibility changes
  mainWindow?.on('show', () => updateTrayMenu())
  mainWindow?.on('hide', () => updateTrayMenu())
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
if (gotTheLock) {
  app.whenReady().then(async () => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Initialize migration service
    await skinMigrationService.initialize()

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
    await presetService.initialize()

    // Initialize translation service with saved language
    const savedLanguage = settingsService.get('language') || 'en_US'
    translationService.setLanguage(savedLanguage as LanguageCode)

    // Set up IPC handlers
    setupIpcHandlers()

    createWindow()
    createTray()

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
}

// Only set up these handlers for the primary instance
if (gotTheLock) {
  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    const minimizeToTray = settingsService.get('minimizeToTray')
    if (!minimizeToTray && process.platform !== 'darwin') {
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
}

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

  // Bulk download from repository
  ipcMain.handle('download-all-skins-bulk', async (event, options) => {
    try {
      await skinDownloader.downloadAllSkinsFromRepository(options, (progress) => {
        event.sender.send('download-all-skins-bulk-progress', progress)
      })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
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
      console.log(selectedSkins)

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
      const skinProcessingErrors: string[] = []
      const skinInfosToProcess = await Promise.allSettled(
        filteredSkins.map(async (skinKey) => {
          const [champion, skinFile] = skinKey.split('/')

          // Handle user-imported skins
          if (skinFile.includes('[User]')) {
            const skinNameWithExt = skinFile.replace('[User] ', '')
            // Extract the actual filename without extension more carefully
            const extMatch = skinNameWithExt.match(/\.(wad\.client|wad|zip|fantome)$/i)
            const skinName = extMatch
              ? skinNameWithExt.slice(0, -extMatch[0].length)
              : skinNameWithExt
            const fileExt = extMatch ? extMatch[0] : ''

            console.log(
              `[Patcher] Processing custom mod: champion=${champion}, skinFile=${skinFile}, skinName=${skinName}, fileExt=${fileExt}`
            )

            // First try to find the mod file in mod-files directory
            const modFilesDir = path.join(app.getPath('userData'), 'mod-files')
            const possibleExtensions = ['.wad.client', '.wad', '.zip', '.fantome']
            let modFilePath: string | null = null

            // Try champion-specific paths first
            // If we already know the extension, try that first
            const extensionsToTry = fileExt
              ? [fileExt, ...possibleExtensions.filter((e) => e !== fileExt)]
              : possibleExtensions

            for (const ext of extensionsToTry) {
              const testPath = path.join(modFilesDir, `${champion}_${skinName}${ext}`)
              console.log(`[Patcher] Trying path: ${testPath}`)
              try {
                await fs.promises.access(testPath)
                modFilePath = testPath
                console.log(`[Patcher] Found mod at champion-specific path: ${testPath}`)
                break
              } catch (error) {
                console.log(`[Patcher] Path not found: ${testPath}, error:`, error)
                // Continue to next extension
              }
            }

            // If not found, try Custom_ paths (for mods imported without champion selection)
            if (!modFilePath) {
              for (const ext of possibleExtensions) {
                const customPath = path.join(modFilesDir, `Custom_${skinName}${ext}`)
                try {
                  await fs.promises.access(customPath)
                  modFilePath = customPath
                  console.log(`[Patcher] Found mod at custom path: ${customPath}`)
                  break
                } catch {
                  // Continue to next extension
                }
              }
            }

            // If not found in mod-files, check legacy mods directory
            if (!modFilePath) {
              // Try champion-specific legacy path
              const legacyPath = path.join(
                app.getPath('userData'),
                'mods',
                `${champion}_${skinName}`
              )
              try {
                await fs.promises.access(legacyPath)
                modFilePath = legacyPath
                console.log(`[Patcher] Found mod at legacy champion path: ${legacyPath}`)
              } catch {
                // Try Custom_ legacy path
                const customLegacyPath = path.join(
                  app.getPath('userData'),
                  'mods',
                  `Custom_${skinName}`
                )
                try {
                  await fs.promises.access(customLegacyPath)
                  modFilePath = customLegacyPath
                  console.log(`[Patcher] Found mod at legacy custom path: ${customLegacyPath}`)
                } catch {
                  // Not found anywhere
                  console.error(`[Patcher] Mod file not found for ${champion}/${skinName}`)
                  modFilePath = null
                }
              }
            }

            if (!modFilePath) {
              throw new Error(`Custom mod file not found: ${champion}/${skinName}`)
            }

            return { localPath: modFilePath }
          }

          // Handle remote skins
          // First check if the skin is already downloaded
          const downloadedSkins = await skinDownloader.listDownloadedSkins()
          // Try both the original champion name and URL-decoded version (for champions with spaces)
          const existingSkin = downloadedSkins.find(
            (ds) =>
              (ds.championName === champion || decodeURIComponent(ds.championName) === champion) &&
              ds.skinName === skinFile
          )

          if (existingSkin && existingSkin.localPath) {
            console.log(`[Patcher] Skin already downloaded: ${champion}/${skinFile}`)
            return { localPath: existingSkin.localPath }
          }

          // If not downloaded, check if this might be a variant (has special naming patterns)
          const isLikelyVariant =
            skinFile.includes('Arcane Fractured') ||
            skinFile.includes('Elementalist') ||
            skinFile.includes('GunGoddess') ||
            skinFile.includes('Gun Goddess') ||
            skinFile.includes('form') ||
            skinFile.includes('Hero') ||
            skinFile.includes('Exalted')

          if (isLikelyVariant) {
            throw new Error(
              `Variant skin not found in downloads: ${champion}/${skinFile}. Variants must be downloaded through the UI first.`
            )
          }

          // For regular skins, try to download
          const url = `https://github.com/darkseal-org/lol-skins/blob/main/skins/${champion}/${encodeURIComponent(
            skinFile
          )}`
          console.log(`[Patcher] Downloading skin: ${url}`)
          return skinDownloader.downloadSkin(url)
        })
      )

      // Process Promise.allSettled results
      const successfulSkins = skinInfosToProcess
        .filter(
          (result): result is PromiseFulfilledResult<{ localPath: string }> =>
            result.status === 'fulfilled'
        )
        .map((result) => result.value)

      const failedSkins = skinInfosToProcess
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result, index) => ({
          skin: filteredSkins[index],
          error: result.reason?.message || result.reason
        }))

      if (failedSkins.length > 0) {
        failedSkins.forEach(({ skin, error }) => {
          console.error(`[Patcher] Failed to process ${skin}: ${error}`)
          skinProcessingErrors.push(`${skin}: ${error}`)
        })
      }

      // 2. Prepare preset for patcher
      console.log('[Patcher] Successfully processed skins:', successfulSkins)
      const validPaths = successfulSkins.map((s) => s.localPath).filter((path) => path != null)

      if (validPaths.length === 0) {
        console.error('[Patcher] No valid skin paths found!')
        const errorMessage =
          skinProcessingErrors.length > 0
            ? `Failed to find skin files:\n${skinProcessingErrors.join('\n')}`
            : 'Failed to resolve skin file paths'
        return { success: false, message: errorMessage }
      }

      const preset = {
        id: 'temp_' + Date.now(),
        name: 'Temporary',
        description: 'Temporary preset for patcher',
        selectedSkins: validPaths,
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
          // Handle custom mods without champion (old format)
          if (skin.championKey === 'Custom') {
            return `Custom/[User] ${skin.skinName}`
          }

          // Handle custom mods with champion assigned (new format)
          // These have skinId starting with "custom_[User] "
          if (skin.skinId.startsWith('custom_[User] ')) {
            // Extract the filename from skinId after "custom_"
            const modFileName = skin.skinId.replace('custom_', '')
            return `${skin.championKey}/${modFileName}`
          }

          // Regular skins from repository
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
        const skinProcessingErrors: string[] = []
        const skinInfosToProcess = await Promise.allSettled(
          skinKeys.map(async (skinKey) => {
            const [champion, skinFile] = skinKey.split('/')

            if (skinFile.includes('[User]')) {
              const skinNameWithExt = skinFile.replace('[User] ', '')
              // Extract the actual filename without extension more carefully
              const extMatch = skinNameWithExt.match(/\.(wad\.client|wad|zip|fantome)$/i)
              const skinName = extMatch
                ? skinNameWithExt.slice(0, -extMatch[0].length)
                : skinNameWithExt
              const fileExt = extMatch ? extMatch[0] : ''

              console.log(
                `[SmartApply] Processing custom mod: champion=${champion}, skinFile=${skinFile}, skinName=${skinName}, fileExt=${fileExt}`
              )

              const modFilesDir = path.join(app.getPath('userData'), 'mod-files')
              const possibleExtensions = ['.wad.client', '.wad', '.zip', '.fantome']
              let modFilePath: string | null = null

              // Try champion-specific paths first
              // If we already know the extension, try that first
              const extensionsToTry = fileExt
                ? [fileExt, ...possibleExtensions.filter((e) => e !== fileExt)]
                : possibleExtensions

              for (const ext of extensionsToTry) {
                const testPath = path.join(modFilesDir, `${champion}_${skinName}${ext}`)
                console.log(`[SmartApply] Trying path: ${testPath}`)
                try {
                  await fs.promises.access(testPath)
                  modFilePath = testPath
                  console.log(`[SmartApply] Found mod at champion-specific path: ${testPath}`)
                  break
                } catch (error) {
                  console.log(`[SmartApply] Path not found: ${testPath}, error:`, error)
                  // Continue
                }
              }

              // If not found, try Custom_ paths (for mods imported without champion selection)
              if (!modFilePath) {
                for (const ext of possibleExtensions) {
                  const customPath = path.join(modFilesDir, `Custom_${skinName}${ext}`)
                  try {
                    await fs.promises.access(customPath)
                    modFilePath = customPath
                    console.log(`[SmartApply] Found mod at custom path: ${customPath}`)
                    break
                  } catch {
                    // Continue
                  }
                }
              }

              // If not found in mod-files, check legacy mods directory
              if (!modFilePath) {
                // Try champion-specific legacy path
                const legacyPath = path.join(
                  app.getPath('userData'),
                  'mods',
                  `${champion}_${skinName}`
                )
                try {
                  await fs.promises.access(legacyPath)
                  modFilePath = legacyPath
                  console.log(`[SmartApply] Found mod at legacy champion path: ${legacyPath}`)
                } catch {
                  // Try Custom_ legacy path
                  const customLegacyPath = path.join(
                    app.getPath('userData'),
                    'mods',
                    `Custom_${skinName}`
                  )
                  try {
                    await fs.promises.access(customLegacyPath)
                    modFilePath = customLegacyPath
                    console.log(`[SmartApply] Found mod at legacy custom path: ${customLegacyPath}`)
                  } catch {
                    // Not found anywhere
                    console.error(`[SmartApply] Mod file not found for ${champion}/${skinName}`)
                    modFilePath = null
                  }
                }
              }

              if (!modFilePath) {
                throw new Error(`Custom mod file not found: ${champion}/${skinName}`)
              }

              return { localPath: modFilePath }
            }

            // First check if the skin is already downloaded
            const downloadedSkins = await skinDownloader.listDownloadedSkins()
            // Try both the original champion name and URL-decoded version (for champions with spaces)
            const existingSkin = downloadedSkins.find(
              (ds) =>
                (ds.championName === champion ||
                  decodeURIComponent(ds.championName) === champion) &&
                ds.skinName === skinFile
            )

            if (existingSkin && existingSkin.localPath) {
              console.log(`[SmartApply] Skin already downloaded: ${champion}/${skinFile}`)
              return { localPath: existingSkin.localPath }
            }

            // If not downloaded, check if this might be a variant (has special naming patterns)
            const isLikelyVariant =
              skinFile.includes('Arcane Fractured') ||
              skinFile.includes('Elementalist') ||
              skinFile.includes('GunGoddess') ||
              skinFile.includes('Gun Goddess') ||
              skinFile.includes('form') ||
              skinFile.includes('Hero') ||
              skinFile.includes('Exalted')

            if (isLikelyVariant) {
              throw new Error(
                `Variant skin not found in downloads: ${champion}/${skinFile}. Variants must be downloaded through the UI first.`
              )
            }

            // For regular skins, try to download
            const url = `https://github.com/darkseal-org/lol-skins/blob/main/skins/${champion}/${encodeURIComponent(skinFile)}`
            console.log(`[SmartApply] Downloading skin: ${url}`)
            return skinDownloader.downloadSkin(url)
          })
        )

        // Process Promise.allSettled results
        const successfulSkins = skinInfosToProcess
          .filter(
            (result): result is PromiseFulfilledResult<{ localPath: string }> =>
              result.status === 'fulfilled'
          )
          .map((result) => result.value)

        const failedSkins = skinInfosToProcess
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
          .map((result, index) => ({
            skin: skinKeys[index],
            error: result.reason?.message || result.reason
          }))

        if (failedSkins.length > 0) {
          failedSkins.forEach(({ skin, error }) => {
            console.error(`[SmartApply] Failed to process ${skin}: ${error}`)
            skinProcessingErrors.push(`${skin}: ${error}`)
          })
        }

        console.log('[SmartApply] Successfully processed skins:', successfulSkins)
        const validPaths = successfulSkins.map((s) => s.localPath).filter((path) => path != null)

        if (validPaths.length === 0) {
          console.error('[SmartApply] No valid skin paths found!')
          const errorMessage =
            skinProcessingErrors.length > 0
              ? `Failed to find skin files:\n${skinProcessingErrors.join('\n')}`
              : 'Failed to resolve skin file paths'
          return { success: false, message: errorMessage }
        }

        const preset = {
          id: 'temp_' + Date.now(),
          name: 'Temporary',
          description: 'Smart apply preset',
          selectedSkins: validPaths,
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
    async (
      _,
      championKey: string,
      skinId: string,
      skinName: string,
      chromaId?: string,
      chromaName?: string
    ) => {
      try {
        await favoritesService.addFavorite(championKey, skinId, skinName, chromaId, chromaName)
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  )

  ipcMain.handle(
    'remove-favorite',
    async (_, championKey: string, skinId: string, chromaId?: string) => {
      try {
        await favoritesService.removeFavorite(championKey, skinId, chromaId)
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  )

  ipcMain.handle(
    'is-favorite',
    async (_, championKey: string, skinId: string, chromaId?: string) => {
      return favoritesService.isFavorite(championKey, skinId, chromaId)
    }
  )

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

  // Preset management
  ipcMain.handle(
    'preset:create',
    async (_, name: string, description: string | undefined, skins: any[]) => {
      try {
        const preset = await presetService.createPreset(name, description, skins)
        return { success: true, data: preset }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  )

  ipcMain.handle('preset:list', async () => {
    try {
      const presets = await presetService.listPresets()
      return { success: true, data: presets }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('preset:get', async (_, id: string) => {
    try {
      const preset = await presetService.getPreset(id)
      return { success: true, data: preset }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('preset:update', async (_, id: string, updates: any) => {
    try {
      const preset = await presetService.updatePreset(id, updates)
      return { success: true, data: preset }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('preset:delete', async (_, id: string) => {
    try {
      await presetService.deletePreset(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('preset:duplicate', async (_, id: string, newName: string) => {
    try {
      const preset = await presetService.duplicatePreset(id, newName)
      return { success: true, data: preset }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('preset:validate', async (_, id: string) => {
    try {
      const preset = await presetService.getPreset(id)
      if (!preset) {
        return { success: false, error: 'Preset not found' }
      }
      const downloadedSkins = await skinDownloader.listDownloadedSkins()
      const validationResult = await presetService.validatePresetSkins(preset, downloadedSkins)
      return { success: true, data: validationResult }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('preset:export', async (_, id: string) => {
    try {
      const exportData = await presetService.exportPreset(id)
      // Show save dialog
      const result = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: `${exportData.preset.name.replace(/[^a-z0-9]/gi, '_')}_preset.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (!result.canceled && result.filePath) {
        await fs.promises.writeFile(result.filePath, JSON.stringify(exportData, null, 2))
        return { success: true, filePath: result.filePath }
      }

      return { success: false, error: 'Export canceled' }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('preset:import', async () => {
    try {
      // Show open dialog
      const result = await dialog.showOpenDialog(mainWindow!, {
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        const fileContent = await fs.promises.readFile(filePath, 'utf-8')
        const exportData = JSON.parse(fileContent)

        const preset = await presetService.importPreset(exportData)
        return { success: true, data: preset }
      }

      return { success: false, error: 'Import canceled' }
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
      await toolsDownloader.downloadAndExtractTools((progress, details) => {
        event.sender.send('tools-download-progress', progress)
        if (details) {
          event.sender.send('tools-download-details', details)
        }
      })
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
        errorType: error.type || 'unknown',
        errorDetails: error.details,
        canRetry: error.canRetry !== false
      }
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
    if (window) {
      const minimizeToTray = settingsService.get('minimizeToTray')
      if (minimizeToTray && window === mainWindow) {
        window.hide()
      } else {
        window.close()
      }
    }
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

    // If mod tools timeout is being set, update the wrapper
    if (key === 'modToolsTimeout' && typeof value === 'number') {
      modToolsWrapper.setToolsTimeout(value)
    }

    // If game path is being set, update the GamePathService cache
    if (key === 'gamePath' && typeof value === 'string') {
      const { GamePathService } = await import('./services/gamePathService')
      const gamePathService = GamePathService.getInstance()
      await gamePathService.setGamePath(value)
    }

    // Update tray menu when relevant settings change
    const trayRelevantSettings = [
      'minimizeToTray',
      'leagueClientEnabled',
      'autoAcceptEnabled',
      'championDetection',
      'autoViewSkinsEnabled',
      'smartApplyEnabled',
      'autoApplyEnabled',
      'language'
    ]
    if (trayRelevantSettings.includes(key)) {
      // Update translation service if language changed
      if (key === 'language') {
        translationService.setLanguage(value as LanguageCode)
      }
      updateTrayMenu()
    }
  })

  // System locale detection
  ipcMain.handle('get-system-locale', async () => {
    try {
      // Get Windows system locale
      const systemLocale = app.getLocale()
      return { success: true, locale: systemLocale }
    } catch (error) {
      console.error('Failed to get system locale:', error)
      return { success: false, locale: 'en-US' }
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
    async (_, modPath: string, newName: string, newChampionKey?: string, newImagePath?: string) => {
      try {
        const result = await fileImportService.editCustomSkin(
          modPath,
          newName,
          newChampionKey,
          newImagePath
        )
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

  // Skin update handlers
  ipcMain.handle('check-skin-updates', async (_, skinPaths?: string[]) => {
    try {
      let skinInfos: SkinInfo[] | undefined

      if (skinPaths) {
        // Check updates for specific skins
        const allSkins = await skinDownloader.listDownloadedSkins()
        skinInfos = allSkins.filter((skin) => skin.localPath && skinPaths.includes(skin.localPath))
      }

      const updates = await skinDownloader.checkForSkinUpdates(skinInfos)

      // Convert Map to object for JSON serialization
      const updatesObj = Object.fromEntries(updates.entries())

      return { success: true, data: updatesObj }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('update-skin', async (_, skinInfo: SkinInfo) => {
    try {
      const updatedSkin = await skinDownloader.updateSkin(skinInfo)
      return { success: true, data: updatedSkin }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('bulk-update-skins', async (_, skinInfos: SkinInfo[]) => {
    try {
      const result = await skinDownloader.bulkUpdateSkins(skinInfos)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('generate-metadata-for-existing-skins', async () => {
    try {
      await skinDownloader.generateMetadataForExistingSkins()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // MultiRitoFixes handlers
  ipcMain.handle('check-multiritofix-tool', async () => {
    try {
      const exists = await toolsDownloader.checkMultiRitoFixesExist()
      return { success: true, exists }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('download-multiritofix-tool', async (event) => {
    try {
      await toolsDownloader.downloadMultiRitoFixes((progress) => {
        event.sender.send('multiritofix-download-progress', progress)
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('fix-mod-issues', async (event, modPath: string) => {
    try {
      // Check if it's a valid mod file
      if (!multiRitoFixesService.isValidModFile(modPath)) {
        return { success: false, error: 'Invalid mod file type' }
      }

      const result = await multiRitoFixesService.fixModWithDownload(
        modPath,
        (message) => {
          event.sender.send('fix-mod-progress', message)
        },
        (progress) => {
          event.sender.send('multiritofix-download-progress', progress)
        }
      )

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

  // Handler for renderer to communicate auto-selected skin to main process
  ipcMain.handle(
    'set-overlay-auto-selected-skin',
    async (
      _,
      skinData: {
        championKey: string
        championName: string
        skinId: string | number
        skinName: string
        skinNum: number
        rarity?: string
      }
    ) => {
      try {
        // Store the skin data with splash path for overlay
        rendererAutoSelectedSkin = {
          ...skinData,
          splashPath: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${skinData.championKey}_${skinData.skinNum}.jpg`
        }

        // Now show the overlay with the auto-selected skin
        await showOverlayWithAutoSelectedSkin(skinData.championKey)

        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  )
}

// Show overlay with auto-selected skin data
async function showOverlayWithAutoSelectedSkin(championKey: string): Promise<void> {
  try {
    if (!rendererAutoSelectedSkin || rendererAutoSelectedSkin.championKey !== championKey) {
      return
    }

    // Get current language from settings
    const currentLanguage = settingsService.get('language') || 'en_US'

    // Get champion data
    const champData = await championDataService.getChampionByKey(championKey, currentLanguage)
    if (!champData) {
      console.error('[Overlay] Champion data not found for key:', championKey)
      return
    }

    // Get user settings
    const autoRandomSkinEnabled = settingsService.get('autoRandomSkinEnabled') || false
    const autoRandomRaritySkinEnabled = settingsService.get('autoRandomRaritySkinEnabled') || false
    const autoRandomFavoriteSkinEnabled =
      settingsService.get('autoRandomFavoriteSkinEnabled') || false
    const autoRandomHighestWinRateSkinEnabled =
      settingsService.get('autoRandomHighestWinRateSkinEnabled') || false
    const autoRandomHighestPickRateSkinEnabled =
      settingsService.get('autoRandomHighestPickRateSkinEnabled') || false
    const autoRandomMostPlayedSkinEnabled =
      settingsService.get('autoRandomMostPlayedSkinEnabled') || false
    const championDetectionEnabled = settingsService.get('championDetectionEnabled') !== false
    const inGameOverlayEnabled = settingsService.get('inGameOverlayEnabled') || false

    // Check if any auto-random feature is enabled
    const autoRandomEnabled =
      autoRandomSkinEnabled ||
      autoRandomRaritySkinEnabled ||
      autoRandomFavoriteSkinEnabled ||
      autoRandomHighestWinRateSkinEnabled ||
      autoRandomHighestPickRateSkinEnabled ||
      autoRandomMostPlayedSkinEnabled

    console.log('[Overlay] Settings check:', {
      championDetectionEnabled,
      inGameOverlayEnabled,
      autoRandomEnabled,
      autoRandomHighestWinRateSkinEnabled,
      autoRandomHighestPickRateSkinEnabled,
      autoRandomMostPlayedSkinEnabled
    })

    if (!championDetectionEnabled || !autoRandomEnabled || !inGameOverlayEnabled) {
      console.log('[Overlay] Not showing overlay - missing required settings')
      return
    }

    // Prepare overlay data
    const overlayData: any = {
      championId: currentChampionId || parseInt(championKey), // Use stored ID or fallback
      championKey: champData.key,
      championName: champData.name,
      skins: (champData.skins || []).map((skin: any) => ({
        ...skin,
        splashPath: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champData.key}_${skin.num}.jpg`,
        tilePath: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champData.key}_${skin.num}.jpg`
      })),
      autoRandomEnabled,
      autoSelectedSkin: rendererAutoSelectedSkin,
      theme: null // Will be set by renderer based on current theme
    }

    // Ensure we only show overlay when we have valid auto-selected skin data
    if (overlayData.autoSelectedSkin) {
      // Hide any existing overlay first to ensure clean state
      overlayWindowManager.hide()

      // Small delay to ensure clean state before showing new data
      await new Promise((resolve) => setTimeout(resolve, 100))

      await overlayWindowManager.show(overlayData)
    } else {
      console.warn('[Overlay] No auto-selected skin data, not showing overlay')
    }
  } catch (error) {
    console.error('[Overlay] Error showing overlay with auto-selected skin:', error)
  }
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

    // Store the current champion ID for overlay display
    currentChampionId = data.championId

    // Clear previous auto-selected skin data when a new champion is selected
    if (
      rendererAutoSelectedSkin &&
      rendererAutoSelectedSkin.championKey !== data.championId.toString()
    ) {
      rendererAutoSelectedSkin = null
    }

    // Note: Overlay display is now handled when renderer sends auto-selected skin data
  })

  gameflowMonitor.on('queue-id-detected', (data) => {
    // Forward early queue ID detection to all windows
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('lcu:queue-id-detected', data)
    })
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

  // Clean up tray
  if (tray) {
    tray.destroy()
    tray = null
  }
}

// Handle app quit events - only for primary instance
if (gotTheLock) {
  app.on('before-quit', () => {
    cleanup()
  })

  app.on('window-all-closed', () => {
    const minimizeToTray = settingsService.get('minimizeToTray')
    if (!minimizeToTray) {
      cleanup()
      if (process.platform !== 'darwin') {
        app.quit()
      }
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
}
