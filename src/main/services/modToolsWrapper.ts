import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import { app, BrowserWindow } from 'electron'
import { ToolsDownloader } from './toolsDownloader'

export class ModToolsWrapper {
  private modToolsPath: string
  private profilesPath: string
  private installedPath: string
  private runningProcess: ChildProcess | null = null
  private mainWindow: BrowserWindow | null = null
  private activeProcesses: ChildProcess[] = []
  private timeout: number = 300000 // Default 5 minutes in milliseconds

  constructor() {
    const toolsDownloader = new ToolsDownloader()
    const toolsPath = toolsDownloader.getToolsPath()
    this.modToolsPath = path.join(toolsPath, 'mod-tools.exe')

    const userData = app.getPath('userData')
    this.profilesPath = path.join(userData, 'profiles')
    this.installedPath = path.join(userData, 'cslol_installed')
  }

  setToolsTimeout(seconds: number): void {
    this.timeout = seconds * 1000 // Convert seconds to milliseconds
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  async checkModToolsExist(): Promise<boolean> {
    try {
      await fs.access(this.modToolsPath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  private pathContainsOneDrive(filePath: string): boolean {
    return filePath.toLowerCase().includes('onedrive')
  }

  private async forceKillModTools(): Promise<void> {
    return new Promise((resolve) => {
      const process = spawn('taskkill', ['/F', '/IM', 'mod-tools.exe'])
      process.on('close', () => {
        console.log(`[ModToolsWrapper] Attempted to kill all mod-tools.exe processes.`)
        resolve()
      })
    })
  }

  private async ensureCleanDirectoryWithRetry(dirPath: string, retries = 3): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await fs.rm(dirPath, { recursive: true, force: true }).catch(() => {})
        await fs.mkdir(dirPath, { recursive: true })
        return
      } catch (error) {
        console.warn(`[ModToolsWrapper] Clean directory attempt ${i + 1} failed for ${dirPath}`)
        if (i === retries - 1) throw error
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  private async execToolWithTimeout(
    command: string,
    args: string[],
    timeout: number,
    sendProgress: boolean = false
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args)
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        process.kill()
        const timeoutSeconds = Math.round(timeout / 1000)
        reject(new Error(`Process timed out after ${timeoutSeconds} seconds`))
      }, timeout)

      process.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output

        // Send progress to renderer if requested
        if (sendProgress && this.mainWindow && !this.mainWindow.isDestroyed()) {
          const lines = output.split('\n').filter((line) => line.trim())
          lines.forEach((line) => {
            const trimmedLine = line.trim()
            console.log(`[MOD-TOOLS]: ${trimmedLine}`)
            this.mainWindow!.webContents.send('patcher-status', trimmedLine)
          })
        }
      })

      process.stderr.on('data', (data) => {
        const output = data.toString()
        stderr += output

        // Also send stderr to renderer if it contains status info
        if (sendProgress && this.mainWindow && !this.mainWindow.isDestroyed()) {
          const lines = output.split('\n').filter((line) => line.trim())
          lines.forEach((line) => {
            const trimmedLine = line.trim()
            if (trimmedLine.includes('[INFO]') || trimmedLine.includes('[WARN]')) {
              console.log(`[MOD-TOOLS]: ${trimmedLine}`)
              this.mainWindow!.webContents.send('patcher-status', trimmedLine)
            }
          })
        }
      })

      process.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`))
        }
      })
      process.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  async applyPreset(preset: any): Promise<{ success: boolean; message: string }> {
    try {
      const toolsExist = await this.checkModToolsExist()
      if (!toolsExist) {
        return { success: false, message: 'CS:LOL tools not found. Please download them first.' }
      }

      await this.stopOverlay()

      if (
        this.pathContainsOneDrive(this.installedPath) ||
        this.pathContainsOneDrive(this.profilesPath)
      ) {
        console.warn(
          '[ModToolsWrapper] OneDrive detected in path - this may cause file access issues'
        )
      }

      console.debug('[ModToolsWrapper] Preparing directories')
      await this.ensureCleanDirectoryWithRetry(this.profilesPath)

      // Create installed directory if it doesn't exist (don't clean it to preserve imported mods)
      await fs.mkdir(this.installedPath, { recursive: true }).catch(() => {})

      const gamePath = path.normalize(preset.gamePath)
      try {
        await fs.access(gamePath)
      } catch {
        throw new Error(`Game directory not found`)
      }

      const validSkinMods = preset.selectedSkins || []
      if (!Array.isArray(validSkinMods) || validSkinMods.length === 0) {
        return { success: false, message: 'No skins selected' }
      }

      // Get list of already imported mods
      const existingMods = new Set<string>()
      try {
        const installedDirs = await fs.readdir(this.installedPath)
        for (const dir of installedDirs) {
          const metaPath = path.join(this.installedPath, dir, 'META', 'info.json')
          try {
            await fs.access(metaPath)
            existingMods.add(dir)
          } catch {
            // Not a valid mod directory, skip
          }
        }
      } catch {
        // Installed directory doesn't exist yet
      }

      console.info(`[ModToolsWrapper] Found ${existingMods.size} already imported mods`)
      console.info(`[ModToolsWrapper] Processing ${validSkinMods.length} skins`)

      // Import skins sequentially, skipping already imported ones
      const importedModNames: string[] = []
      let skippedCount = 0

      for (let index = 0; index < validSkinMods.length; index++) {
        const modPath = validSkinMods[index]
        const baseName = path.basename(modPath, path.extname(modPath)).trim()
        const modName = `mod_${index}_${baseName}`

        // Report progress
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('import-progress', {
            current: index + 1,
            total: validSkinMods.length,
            name: baseName,
            phase: 'importing'
          })
        }

        // Check if this mod is already imported
        if (existingMods.has(modName)) {
          console.info(
            `[ModToolsWrapper] Skipping already imported mod ${index + 1}/${validSkinMods.length}: ${baseName}`
          )
          importedModNames.push(modName)
          skippedCount++
          continue
        }

        try {
          console.info(
            `[ModToolsWrapper] Importing ${index + 1}/${validSkinMods.length}: ${baseName}`
          )

          await this.execToolWithTimeout(
            this.modToolsPath,
            [
              'import',
              path.normalize(modPath),
              path.normalize(path.join(this.installedPath, modName)),
              `--game:${gamePath}`,
              preset.noTFT ? '--noTFT' : ''
            ].filter(Boolean),
            this.timeout,
            true
          )

          importedModNames.push(modName)
          console.info(`[ModToolsWrapper] Successfully imported: ${baseName}`)
        } catch (error) {
          console.error(`[ModToolsWrapper] Failed to import skin ${index + 1}:`, error)
          // Continue with other skins even if one fails
        }
      }

      if (importedModNames.length === 0) {
        throw new Error('Failed to import any skins')
      }

      console.info(
        `[ModToolsWrapper] Import complete. Imported: ${importedModNames.length - skippedCount}, Skipped: ${skippedCount}`
      )

      const profileName = `preset_${preset.id}`
      const profilePath = path.join(this.profilesPath, profileName)
      const profileConfigPath = `${profilePath}.config`
      const modsParameter = importedModNames.join('/')

      console.info('[ModToolsWrapper] Creating overlay...')
      let overlaySuccess = false
      let mkOverlayError: Error | null = null

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (attempt > 1) {
            console.info(`[ModToolsWrapper] Retrying overlay creation, attempt ${attempt}/3`)
            await new Promise((resolve) => setTimeout(resolve, 500))
          }

          const mkoverlayArgs = [
            'mkoverlay',
            path.normalize(this.installedPath),
            path.normalize(profilePath),
            `--game:${path.normalize(preset.gamePath)}`,
            `--mods:${modsParameter}`,
            preset.noTFT ? '--noTFT' : '',
            preset.ignoreConflict ? '--ignoreConflict' : ''
          ].filter(Boolean)
          console.debug(
            `[ModToolsWrapper] Executing mkoverlay (Attempt ${attempt}): ${mkoverlayArgs.join(' ')}`
          )

          await this.execToolWithTimeout(this.modToolsPath, mkoverlayArgs, this.timeout, true)

          overlaySuccess = true
          console.info('[ModToolsWrapper] Overlay created successfully')
          break
        } catch (error) {
          mkOverlayError = error as Error
          console.error(
            `[ModToolsWrapper] Overlay creation attempt ${attempt} failed:`,
            error as Error
          )
        }
      }

      if (!overlaySuccess) {
        throw new Error(
          `Failed to create overlay after 3 attempts: ${mkOverlayError?.message || 'Unknown mkoverlay error'}`
        )
      }

      await new Promise((resolve) => setTimeout(resolve, 200))

      console.info('[ModToolsWrapper] Starting runoverlay process...')
      this.runningProcess = spawn(
        this.modToolsPath,
        [
          'runoverlay',
          path.normalize(profilePath),
          path.normalize(profileConfigPath),
          `--game:${path.normalize(preset.gamePath)}`,
          '--opts:none'
        ],
        { detached: false, stdio: ['pipe', 'pipe', 'pipe'] }
      )
      this.activeProcesses.push(this.runningProcess)

      this.runningProcess.stdout?.on('data', (data) => {
        const output = data.toString()
        const lines = output.split('\n').filter((line) => line.trim())

        lines.forEach((line) => {
          const trimmedLine = line.trim()
          console.log(`[MOD-TOOLS]: ${trimmedLine}`)

          // Only send to renderer if it's not a DLL log
          if (
            this.mainWindow &&
            !this.mainWindow.isDestroyed() &&
            !trimmedLine.startsWith('[DLL]')
          ) {
            this.mainWindow.webContents.send('patcher-status', trimmedLine)
          }
        })
      })

      this.runningProcess.stderr?.on('data', (data) => {
        const output = data.toString()
        const lines = output.split('\n').filter((line) => line.trim())

        lines.forEach((line) => {
          const trimmedLine = line.trim()
          console.error(`[MOD-TOOLS ERROR]: ${trimmedLine}`)

          // Only send to renderer if it's not a DLL log
          if (
            this.mainWindow &&
            !this.mainWindow.isDestroyed() &&
            !trimmedLine.startsWith('[DLL]')
          ) {
            this.mainWindow.webContents.send('patcher-error', trimmedLine)
          }
        })
      })

      this.runningProcess.on('exit', (code) => {
        console.log(`Mod tools process exited with code ${code}`)
        this.cleanupProcess(this.runningProcess)
        this.runningProcess = null
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('patcher-status', '')
        }
      })

      return { success: true, message: 'Preset applied successfully' }
    } catch (error) {
      console.error('Failed to apply preset:', error)
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  private cleanupProcess(process: ChildProcess | null) {
    if (!process) return
    const index = this.activeProcesses.indexOf(process)
    if (index > -1) {
      this.activeProcesses.splice(index, 1)
    }
  }

  async stopOverlay(): Promise<void> {
    if (this.runningProcess) {
      this.runningProcess.stdin?.write('\n')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      if (this.runningProcess && !this.runningProcess.killed) {
        this.runningProcess.kill()
      }
      this.runningProcess = null
    }
    await this.forceKillModTools()
  }

  isRunning(): boolean {
    return this.runningProcess !== null && !this.runningProcess.killed
  }

  async clearImportedModsCache(): Promise<void> {
    try {
      console.info('[ModToolsWrapper] Clearing imported mods cache')
      await fs.rm(this.installedPath, { recursive: true, force: true })
      console.info('[ModToolsWrapper] Imported mods cache cleared successfully')
    } catch (error) {
      console.error('[ModToolsWrapper] Failed to clear imported mods cache:', error)
      throw error
    }
  }
}
