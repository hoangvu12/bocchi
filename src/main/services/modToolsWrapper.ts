import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import { app, BrowserWindow } from 'electron'
import { settingsService } from './settingsService'

export class ModToolsWrapper {
  private profilesPath: string
  private installedPath: string
  private runningProcess: ChildProcess | null = null
  private mainWindow: BrowserWindow | null = null
  private activeProcesses: ChildProcess[] = []
  private timeout: number = 300000 // Default 5 minutes in milliseconds
  private isCancelled: boolean = false
  private currentOperation: ChildProcess | null = null
  private applyInProgress: boolean = false
  private importedMods: string[] = [] // Track successfully imported mods for cleanup

  constructor() {
    const userData = app.getPath('userData')
    this.profilesPath = path.join(userData, 'profiles')
    this.installedPath = path.join(userData, 'cslol_installed')
  }

  private getModToolsExePath(): string | null {
    const toolsPath = settingsService.getModToolsPath()
    if (!toolsPath) return null
    return path.join(toolsPath, 'mod-tools.exe')
  }

  setToolsTimeout(seconds: number): void {
    this.timeout = seconds * 1000 // Convert seconds to milliseconds
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  async checkModToolsExist(): Promise<boolean> {
    try {
      const modToolsPath = this.getModToolsExePath()
      if (!modToolsPath) return false

      await fs.access(modToolsPath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  private pathContainsOneDrive(filePath: string): boolean {
    return filePath.toLowerCase().includes('onedrive')
  }

  private async moveFile(source: string, destination: string): Promise<void> {
    try {
      // First try rename (works if same device)
      await fs.rename(source, destination)
    } catch (error: any) {
      if (error.code === 'EXDEV') {
        // Cross-device, so copy then delete
        // For directories, use recursive copy
        const stat = await fs.stat(source)
        if (stat.isDirectory()) {
          await fs.cp(source, destination, { recursive: true })
          await fs.rm(source, { recursive: true, force: true })
        } else {
          await fs.copyFile(source, destination)
          await fs.unlink(source)
        }
      } else {
        throw error
      }
    }
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
      // Check if cancelled before starting
      if (this.isCancelled) {
        reject(new Error('Operation cancelled by user'))
        return
      }

      const process = spawn(command, args)
      this.currentOperation = process
      this.activeProcesses.push(process)

      let stdout = ''
      let stderr = ''
      let cancelled = false

      const timer = setTimeout(() => {
        if (!cancelled) {
          process.kill()
          this.cleanupProcess(process)
          this.currentOperation = null
          const timeoutSeconds = Math.round(timeout / 1000)
          reject(new Error(`Process timed out after ${timeoutSeconds} seconds`))
        }
      }, timeout)

      // Check for cancellation periodically
      const cancellationChecker = setInterval(() => {
        if (this.isCancelled && !cancelled) {
          cancelled = true
          clearInterval(cancellationChecker)
          clearTimeout(timer)
          process.kill()
          this.cleanupProcess(process)
          this.currentOperation = null
          reject(new Error('Operation cancelled by user'))
        }
      }, 100) // Check every 100ms

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
        clearInterval(cancellationChecker)
        this.cleanupProcess(process)
        this.currentOperation = null

        if (cancelled) {
          reject(new Error('Operation cancelled by user'))
        } else if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`))
        }
      })

      process.on('error', (err) => {
        clearTimeout(timer)
        clearInterval(cancellationChecker)
        this.cleanupProcess(process)
        this.currentOperation = null
        reject(err)
      })
    })
  }

  async applyPreset(preset: any): Promise<{ success: boolean; message: string }> {
    this.isCancelled = false
    this.applyInProgress = true
    this.importedMods = []

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

      // Map existing mods by their base name (without mod_X_ prefix)
      // Track ALL occurrences to handle duplicates
      const existingModsMap = new Map<string, string[]>() // baseName -> [folderNames]
      const foldersToDelete = new Set<string>()

      try {
        const installedDirs = await fs.readdir(this.installedPath)
        for (const dir of installedDirs) {
          const metaPath = path.join(this.installedPath, dir, 'META', 'info.json')
          try {
            await fs.access(metaPath)
            // Extract base name from folder (remove mod_X_ prefix)
            const match = dir.match(/^mod_\d+_(.+)$/)
            if (match) {
              const baseName = match[1]
              const existing = existingModsMap.get(baseName) || []
              existing.push(dir)
              existingModsMap.set(baseName, existing)
              console.debug(`[ModToolsWrapper] Found existing mod: ${dir} (${baseName})`)
            } else if (dir.startsWith('temp_')) {
              // Clean up any leftover temp folders from previous failed operations
              console.warn(`[ModToolsWrapper] Cleaning up temp folder: ${dir}`)
              await fs
                .rm(path.join(this.installedPath, dir), { recursive: true, force: true })
                .catch(() => {})
            }
          } catch {
            // Not a valid mod directory, skip
          }
        }
      } catch {
        // Installed directory doesn't exist yet
      }

      // Handle duplicates: keep only one instance of each mod (prefer lowest index)
      for (const [baseName, folders] of existingModsMap.entries()) {
        if (folders.length > 1) {
          console.warn(
            `[ModToolsWrapper] Found ${folders.length} duplicates for ${baseName}: ${folders.join(', ')}`
          )

          // Sort by index (mod_0 comes before mod_1, etc.)
          folders.sort((a, b) => {
            const indexA = parseInt(a.match(/^mod_(\d+)_/)?.[1] || '999')
            const indexB = parseInt(b.match(/^mod_(\d+)_/)?.[1] || '999')
            return indexA - indexB
          })

          // Keep the first one, mark others for deletion
          const toKeep = folders[0]
          for (let i = 1; i < folders.length; i++) {
            foldersToDelete.add(folders[i])
            console.info(
              `[ModToolsWrapper] Will delete duplicate: ${folders[i]} (keeping ${toKeep})`
            )
          }

          // Update map to only keep the one we're keeping
          existingModsMap.set(baseName, [toKeep])
        }
      }

      // Delete duplicate folders
      if (foldersToDelete.size > 0) {
        console.info(`[ModToolsWrapper] Deleting ${foldersToDelete.size} duplicate mod folders`)
        for (const folderName of foldersToDelete) {
          try {
            await fs.rm(path.join(this.installedPath, folderName), { recursive: true, force: true })
            console.debug(`[ModToolsWrapper] Deleted duplicate: ${folderName}`)
          } catch (error) {
            console.error(
              `[ModToolsWrapper] Failed to delete duplicate folder ${folderName}:`,
              error
            )
          }
        }
      }

      console.info(`[ModToolsWrapper] Found ${existingModsMap.size} already imported mods`)
      console.info(`[ModToolsWrapper] Processing ${validSkinMods.length} skins`)

      // Plan operations: determine what needs to be renamed vs imported
      const renameOperations: Array<{ from: string; to: string; tempName: string }> = []
      const importOperations: Array<{ modPath: string; targetName: string; index: number }> = []
      const finalModNames: string[] = []

      for (let index = 0; index < validSkinMods.length; index++) {
        const modPath = validSkinMods[index]
        const baseName = path.basename(modPath, path.extname(modPath)).trim()
        const targetModName = `mod_${index}_${baseName}`

        // Check if this mod already exists (after duplicate cleanup, should only have one)
        const existingFolders = existingModsMap.get(baseName)
        if (existingFolders && existingFolders.length > 0) {
          const currentModName = existingFolders[0] // After cleanup, should only have one
          if (currentModName !== targetModName) {
            // Need to rename
            const tempName = `temp_${Date.now()}_${index}_${baseName}`
            renameOperations.push({
              from: currentModName,
              to: targetModName,
              tempName: tempName
            })
            console.info(`[ModToolsWrapper] Will rename: ${currentModName} -> ${targetModName}`)
          } else {
            console.info(`[ModToolsWrapper] Mod already in correct position: ${targetModName}`)
          }
          finalModNames.push(targetModName)
        } else {
          // Need to import
          importOperations.push({
            modPath: modPath,
            targetName: targetModName,
            index: index
          })
          finalModNames.push(targetModName)
          console.info(`[ModToolsWrapper] Will import: ${baseName} as ${targetModName}`)
        }
      }

      // Check for cancellation before rename operations
      if (this.isCancelled) {
        throw new Error('Operation cancelled by user')
      }

      // Execute rename operations using temp names to avoid conflicts
      if (renameOperations.length > 0) {
        console.info(`[ModToolsWrapper] Executing ${renameOperations.length} rename operations`)

        // Phase 1: Rename to temp names
        for (const op of renameOperations) {
          try {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('import-progress', {
                current: 0,
                total: validSkinMods.length,
                name: op.from,
                phase: 'renaming'
              })
            }

            const fromPath = path.join(this.installedPath, op.from)
            const tempPath = path.join(this.installedPath, op.tempName)
            await this.moveFile(fromPath, tempPath)
            console.debug(`[ModToolsWrapper] Renamed to temp: ${op.from} -> ${op.tempName}`)
          } catch (error) {
            console.error(`[ModToolsWrapper] Failed to rename to temp: ${op.from}`, error)
            throw error
          }
        }

        // Phase 2: Rename from temp names to final names
        for (const op of renameOperations) {
          try {
            const tempPath = path.join(this.installedPath, op.tempName)
            const toPath = path.join(this.installedPath, op.to)
            await this.moveFile(tempPath, toPath)
            console.debug(`[ModToolsWrapper] Renamed to final: ${op.tempName} -> ${op.to}`)
          } catch (error) {
            console.error(`[ModToolsWrapper] Failed to rename from temp: ${op.tempName}`, error)
            throw error
          }
        }
      }

      // Execute import operations for new skins
      for (const op of importOperations) {
        // Check for cancellation before each import
        if (this.isCancelled) {
          throw new Error('Operation cancelled by user')
        }
        // Report progress
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('import-progress', {
            current: op.index + 1,
            total: validSkinMods.length,
            name: path.basename(op.modPath, path.extname(op.modPath)),
            phase: 'importing'
          })
        }

        try {
          console.info(
            `[ModToolsWrapper] Importing ${op.index + 1}/${validSkinMods.length}: ${op.targetName}`
          )

          const modToolsPath = this.getModToolsExePath()
          if (!modToolsPath) {
            throw new Error('Mod tools path not found')
          }

          await this.execToolWithTimeout(
            modToolsPath,
            [
              'import',
              path.normalize(op.modPath),
              path.normalize(path.join(this.installedPath, op.targetName)),
              `--game:${gamePath}`,
              preset.noTFT ? '--noTFT' : ''
            ].filter(Boolean),
            this.timeout,
            true
          )

          console.info(`[ModToolsWrapper] Successfully imported: ${op.targetName}`)
          this.importedMods.push(op.targetName)
        } catch (error) {
          console.error(`[ModToolsWrapper] Failed to import skin ${op.index + 1}:`, error)
          // Continue with other skins even if one fails
          // Remove from final list if import failed
          const failedIndex = finalModNames.indexOf(op.targetName)
          if (failedIndex !== -1) {
            finalModNames.splice(failedIndex, 1)
          }
        }
      }

      const importedModNames = finalModNames

      if (importedModNames.length === 0) {
        throw new Error('Failed to import any skins')
      }

      console.info(
        `[ModToolsWrapper] Operations complete. Renamed: ${renameOperations.length}, Imported: ${importOperations.length}, Total: ${importedModNames.length}`
      )

      const profileName = `preset_${preset.id}`
      const profilePath = path.join(this.profilesPath, profileName)
      const profileConfigPath = `${profilePath}.config`
      const modsParameter = importedModNames.join('/')

      // Check for cancellation before creating overlay
      if (this.isCancelled) {
        throw new Error('Operation cancelled by user')
      }

      console.info('[ModToolsWrapper] Creating overlay...')
      let overlaySuccess = false
      let mkOverlayError: Error | null = null

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (attempt > 1) {
            console.info(`[ModToolsWrapper] Retrying overlay creation, attempt ${attempt}/3`)
            await new Promise((resolve) => setTimeout(resolve, 500))
          }

          const modToolsPath = this.getModToolsExePath()
          if (!modToolsPath) {
            throw new Error('Mod tools path not found')
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

          await this.execToolWithTimeout(modToolsPath, mkoverlayArgs, this.timeout, true)

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

      // Check for cancellation before starting runoverlay
      if (this.isCancelled) {
        throw new Error('Operation cancelled by user')
      }

      const modToolsPath = this.getModToolsExePath()
      if (!modToolsPath) {
        throw new Error('Mod tools path not found')
      }

      console.info('[ModToolsWrapper] Starting runoverlay process...')
      this.runningProcess = spawn(
        modToolsPath,
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

      this.applyInProgress = false
      return { success: true, message: 'Preset applied successfully' }
    } catch (error) {
      console.error('Failed to apply preset:', error)
      this.applyInProgress = false

      // Send cancellation status to renderer if cancelled
      if (this.isCancelled && this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('apply-cancelled')
      }

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

  async clearSkinCache(skinName: string): Promise<void> {
    try {
      console.info(`[ModToolsWrapper] Clearing cache for skin: ${skinName}`)

      // Remove file extension if present
      const baseName = path.basename(skinName, path.extname(skinName)).trim()

      // Read all directories in the installed path
      const installedDirs = await fs.readdir(this.installedPath).catch(() => [])

      // Find and remove any cached versions of this skin
      let clearedCount = 0
      for (const dir of installedDirs) {
        // Check if this directory is for the skin we want to clear
        // It could be named like "mod_0_skinname" or just contain the skin name
        if (dir.includes(baseName)) {
          const dirPath = path.join(this.installedPath, dir)
          try {
            await fs.rm(dirPath, { recursive: true, force: true })
            console.info(`[ModToolsWrapper] Cleared cached mod: ${dir}`)
            clearedCount++
          } catch (error) {
            console.warn(`[ModToolsWrapper] Failed to clear ${dir}:`, error)
          }
        }
      }

      if (clearedCount > 0) {
        console.info(
          `[ModToolsWrapper] Successfully cleared ${clearedCount} cached version(s) of ${skinName}`
        )
      } else {
        console.info(`[ModToolsWrapper] No cached versions found for ${skinName}`)
      }
    } catch (error) {
      console.error(`[ModToolsWrapper] Failed to clear cache for ${skinName}:`, error)
      // Don't throw - this is a non-critical operation
    }
  }

  async getCacheInfo(): Promise<{ exists: boolean; modCount: number; sizeInMB: number }> {
    try {
      await fs.access(this.installedPath)

      const dirs = await fs.readdir(this.installedPath)
      let totalSize = 0
      let modCount = 0

      for (const dir of dirs) {
        const dirPath = path.join(this.installedPath, dir)
        const stats = await fs.stat(dirPath)

        if (stats.isDirectory()) {
          modCount++
          // Estimate directory size (simplified - just counts direct files)
          const files = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => [])
          for (const file of files) {
            if (file.isFile()) {
              const filePath = path.join(dirPath, file.name)
              const fileStats = await fs.stat(filePath).catch(() => null)
              if (fileStats) {
                totalSize += fileStats.size
              }
            }
          }
        }
      }

      return {
        exists: true,
        modCount,
        sizeInMB: Math.round((totalSize / (1024 * 1024)) * 10) / 10 // Round to 1 decimal
      }
    } catch {
      return { exists: false, modCount: 0, sizeInMB: 0 }
    }
  }

  async cancelApply(): Promise<{ success: boolean; message: string }> {
    if (!this.applyInProgress) {
      return { success: false, message: 'No apply operation in progress' }
    }

    console.info('[ModToolsWrapper] Cancelling apply operation...')
    this.isCancelled = true

    // Kill current operation if running
    if (this.currentOperation) {
      console.info('[ModToolsWrapper] Killing current operation')
      this.currentOperation.kill()
      this.currentOperation = null
    }

    // Kill all active processes
    for (const process of this.activeProcesses) {
      if (!process.killed) {
        process.kill()
      }
    }
    this.activeProcesses = []

    // Force kill all mod-tools processes
    await this.forceKillModTools()

    // Optionally cleanup partially imported mods
    if (this.importedMods.length > 0) {
      console.info(
        `[ModToolsWrapper] Cleaning up ${this.importedMods.length} partially imported mods`
      )
      for (const modName of this.importedMods) {
        try {
          const modPath = path.join(this.installedPath, modName)
          await fs.rm(modPath, { recursive: true, force: true }).catch(() => {})
        } catch (error) {
          console.warn(`[ModToolsWrapper] Failed to cleanup ${modName}:`, error)
        }
      }
    }

    // Reset state
    this.applyInProgress = false
    this.importedMods = []

    // Notify renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('patcher-status', 'Apply operation cancelled')
    }

    return { success: true, message: 'Apply operation cancelled successfully' }
  }

  isApplying(): boolean {
    return this.applyInProgress
  }
}
