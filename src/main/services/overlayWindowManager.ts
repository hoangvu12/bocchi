import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { OverlayController, OVERLAY_WINDOW_OPTS } from 'electron-overlay-window'
import { EventEmitter } from 'events'

interface SelectedSkin {
  championKey: string
  championName: string
  skinId: string
  skinName: string
  skinNum: number
}

interface OverlayData {
  championId: number
  championKey: string
  championName: string
  skins: any[]
  autoRandomEnabled: boolean
  autoSelectedSkin?: SelectedSkin
  theme?: any
}

export class OverlayWindowManager extends EventEmitter {
  private overlayWindow: BrowserWindow | null = null
  private isAttached: boolean = false
  private targetProcessName: string = 'League of Legends'
  private checkInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.setupIpcHandlers()
  }

  private setupIpcHandlers(): void {
    // Handle skin selection from overlay
    ipcMain.on('overlay:skin-selected', (_event, skin: SelectedSkin) => {
      this.emit('skin-selected', skin)
      this.hide()
    })

    // Handle overlay close request
    ipcMain.on('overlay:close', () => {
      this.hide()
    })

    // Handle overlay ready event
    ipcMain.on('overlay:ready', () => {})
  }

  async create(): Promise<void> {
    if (this.overlayWindow) {
      return
    }

    this.overlayWindow = new BrowserWindow({
      width: 550,
      height: 550,
      x: 0, // Will be positioned after attachment
      y: 0,
      webPreferences: {
        preload: join(__dirname, '../preload/overlay.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      },
      frame: false,
      transparent: true,
      resizable: false,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      ...OVERLAY_WINDOW_OPTS
    })

    // Load overlay HTML
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      await this.overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`)
    } else {
      await this.overlayWindow.loadFile(join(__dirname, '../renderer/overlay.html'))
    }

    // Set up overlay window events
    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null
      this.isAttached = false
      this.stopAttachmentCheck()
    })

    // Prevent window from being hidden when it loses focus
    this.overlayWindow.on('blur', () => {
      if (this.overlayWindow && this.isAttached) {
        this.overlayWindow.setAlwaysOnTop(true)
      }
    })

    // Start checking for League client
    this.startAttachmentCheck()
  }

  private startAttachmentCheck(): void {
    if (this.checkInterval) {
      return
    }

    // Try to attach immediately
    this.tryAttach()

    // Check periodically
    this.checkInterval = setInterval(() => {
      if (!this.isAttached) {
        this.tryAttach()
      }
    }, 5000) // Check every 5 seconds
  }

  private stopAttachmentCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  private tryAttach(): void {
    if (!this.overlayWindow || this.isAttached) {
      return
    }

    try {
      // Attach to League of Legends window
      OverlayController.attachByTitle(this.overlayWindow, this.targetProcessName)
      this.isAttached = true

      // Position overlay in top right
      this.positionOverlay()

      this.emit('attached')
    } catch {
      // League client not found, will retry
    }
  }

  private positionOverlay(): void {
    if (!this.overlayWindow) return

    // Get the primary display's work area (excludes taskbar)
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width } = primaryDisplay.workAreaSize

    // Position in top right with some padding
    const overlayWidth = 550
    const overlayHeight = 550
    const padding = 20

    this.overlayWindow.setBounds({
      x: width - overlayWidth - padding,
      y: padding,
      width: overlayWidth,
      height: overlayHeight
    })
  }

  async show(data: OverlayData): Promise<void> {
    if (!this.overlayWindow) {
      await this.create()
    }

    if (!this.overlayWindow) {
      console.error('[OverlayWindowManager] Failed to create overlay window')
      return
    }

    // Send data to overlay
    this.overlayWindow.webContents.send('overlay:data', data)

    // Show window
    if (!this.overlayWindow.isVisible()) {
      this.overlayWindow.show()
    }

    // Always make click-through since we only show auto-selected skins
    this.overlayWindow.setIgnoreMouseEvents(true)
  }

  hide(): void {
    if (this.overlayWindow && this.overlayWindow.isVisible()) {
      this.overlayWindow.hide()
      OverlayController.focusTarget()
    }
  }

  destroy(): void {
    this.stopAttachmentCheck()
    if (this.overlayWindow) {
      this.overlayWindow.destroy()
      this.overlayWindow = null
      this.isAttached = false
    }
  }

  isVisible(): boolean {
    return this.overlayWindow ? this.overlayWindow.isVisible() : false
  }

  setClickThrough(clickThrough: boolean): void {
    if (this.overlayWindow) {
      this.overlayWindow.setIgnoreMouseEvents(clickThrough)
    }
  }

  sendTheme(theme: any): void {
    if (this.overlayWindow) {
      this.overlayWindow.webContents.send('overlay:theme-update', theme)
    }
  }
}

// Singleton instance
export const overlayWindowManager = new OverlayWindowManager()
