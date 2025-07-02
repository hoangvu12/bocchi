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

  constructor() {
    const toolsDownloader = new ToolsDownloader()
    const toolsPath = toolsDownloader.getToolsPath()
    this.modToolsPath = path.join(toolsPath, 'mod-tools.exe')

    const userData = app.getPath('userData')
    this.profilesPath = path.join(userData, 'profiles')
    this.installedPath = path.join(userData, 'cslol_installed')
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
    timeout: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args)
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        process.kill()
        reject(new Error(`Process timed out after ${timeout}ms`))
      }, timeout)
      process.stdout.on('data', (data) => (stdout += data.toString()))
      process.stderr.on('data', (data) => (stderr += data.toString()))
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
      await this.forceKillModTools()

      if (
        this.pathContainsOneDrive(this.installedPath) ||
        this.pathContainsOneDrive(this.profilesPath)
      ) {
        console.warn(
          '[ModToolsWrapper] OneDrive detected in path - this may cause file access issues'
        )
      }

      console.debug('[ModToolsWrapper] Cleaning directories before injection')
      await this.ensureCleanDirectoryWithRetry(this.installedPath)
      await this.ensureCleanDirectoryWithRetry(this.profilesPath)

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

      const importedModNames: string[] = []
      const failedMods: string[] = []

      const importPromises = validSkinMods.map(async (modPath, index): Promise<string | null> => {
        try {
          // Use a unique name for each mod to avoid conflicts
          const modName = `mod_${index}_${path.basename(modPath, path.extname(modPath))}`
          const modInstallPath = path.join(this.installedPath, modName)

          await fs.mkdir(modInstallPath, { recursive: true })
          console.info(
            `[ModToolsWrapper] Importing skin mod ${index + 1} of ${validSkinMods.length} into ${modInstallPath}`
          )

          let importSuccess = false
          let lastError: Error | null = null

          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              if (attempt > 1) {
                console.info(
                  `[ModToolsWrapper] Retrying import, attempt ${attempt}/3 for mod ${index + 1}`
                )
                await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
              }

              await this.execToolWithTimeout(
                this.modToolsPath,
                [
                  'import',
                  path.normalize(modPath),
                  path.normalize(modInstallPath),
                  `--game:${path.normalize(preset.gamePath)}`
                ],
                60000
              )

              importSuccess = true
              break
            } catch (error) {
              lastError = error as Error
              console.warn(
                `[ModToolsWrapper] Import attempt ${attempt} failed for mod ${index + 1}: ${error instanceof Error ? error.message : String(error)}`
              )
              await this.forceKillModTools()
            }
          }

          if (importSuccess) {
            console.info(`[ModToolsWrapper] Successfully imported skin mod ${index + 1}`)
            return modName
          } else {
            console.error(
              `[ModToolsWrapper] All import attempts failed for skin mod ${index + 1}`,
              {
                lastError
              }
            )
            failedMods.push(`mod_${index + 1}`)
            return null
          }
        } catch (error) {
          console.error(`[ModToolsWrapper] Error processing skin mod ${index + 1}:`, { error })
          failedMods.push(`mod_${index + 1}`)
          return null
        }
      })

      const results = await Promise.all(importPromises)
      results.forEach((modName) => {
        if (modName) importedModNames.push(modName)
      })

      if (importedModNames.length === 0) {
        throw new Error(
          `No mods could be successfully prepared for injection. Failed mods: ${failedMods.length}`
        )
      }

      if (failedMods.length > 0) {
        console.warn(`[ModToolsWrapper] Some mods failed to import: ${failedMods.length} failed`)
      }

      const profileName = `preset_${preset.id}`
      const profilePath = path.join(this.profilesPath, profileName)
      const profileConfigPath = `${profilePath}.config`

      await fs.writeFile(`${profilePath}.profile`, importedModNames.join('\n'))

      const modsParameter = importedModNames.join('/')

      console.info('[ModToolsWrapper] Creating overlay...')
      let overlaySuccess = false
      let mkOverlayError: Error | null = null

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (attempt > 1) {
            console.info(`[ModToolsWrapper] Retrying overlay creation, attempt ${attempt}/3`)
            await this.forceKillModTools()
            await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
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

          await this.execToolWithTimeout(this.modToolsPath, mkoverlayArgs, 60000)

          overlaySuccess = true
          console.info('[ModToolsWrapper] Overlay created successfully')
          break
        } catch (error) {
          mkOverlayError = error as Error
          console.error(
            `[ModToolsWrapper] Overlay creation attempt ${attempt} failed:`,
            error as Error
          )
          await this.forceKillModTools()
        }
      }

      if (!overlaySuccess) {
        await this.forceKillModTools()
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
        const output = data.toString().trim()
        console.log(`[MOD-TOOLS]: ${output}`)
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('patcher-status', output)
        }
      })

      this.runningProcess.stderr?.on('data', (data) => {
        const error = data.toString().trim()
        console.error(`[MOD-TOOLS ERROR]: ${error}`)
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('patcher-error', error)
        }
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
}
