import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export class GameDetector {
  async detectGamePath(): Promise<string | null> {
    if (process.platform === 'win32') {
      return this.detectWindows()
    }
    return null
  }

  private async detectWindows(): Promise<string | null> {
    // Try common installation paths - need to check Game subfolder
    const commonPaths = [
      'C:\\Riot Games\\League of Legends\\Game',
      'D:\\Riot Games\\League of Legends\\Game',
      'C:\\Program Files\\Riot Games\\League of Legends\\Game',
      'C:\\Program Files (x86)\\Riot Games\\League of Legends\\Game',
      'E:\\Riot Games\\League of Legends\\Game',
      'F:\\Riot Games\\League of Legends\\Game'
    ]

    for (const gamePath of commonPaths) {
      if (await this.isValidGamePath(gamePath)) {
        return gamePath
      }
    }

    // Try RiotClientInstalls.json
    const riotInstallsPath = await this.detectFromRiotClientInstalls()
    if (riotInstallsPath) {
      return riotInstallsPath
    }

    // Try multiple methods to find running process
    // Method 1: Try LeagueClientUx.exe (more reliable)
    try {
      const { stdout } = await execAsync(
        'wmic process where "name=\'LeagueClientUx.exe\'" get ExecutablePath /value'
      )
      const match = stdout.match(/ExecutablePath=(.+)/)
      if (match && match[1]) {
        const clientPath = match[1].trim().replace(/\r/g, '')
        const rootPath = path.dirname(clientPath)
        const gamePath = path.join(rootPath, 'Game')
        if (await this.isValidGamePath(gamePath)) {
          return gamePath
        }
      }
    } catch (error) {
      console.error('Failed to detect via LeagueClientUx.exe:', error)
    }

    // Method 1b: Try LeagueClient.exe as fallback
    try {
      const { stdout } = await execAsync(
        'wmic process where "name=\'LeagueClient.exe\'" get ExecutablePath /value'
      )
      const match = stdout.match(/ExecutablePath=(.+)/)
      if (match && match[1]) {
        const clientPath = match[1].trim().replace(/\r/g, '')
        const rootPath = path.dirname(clientPath)
        const gamePath = path.join(rootPath, 'Game')
        if (await this.isValidGamePath(gamePath)) {
          return gamePath
        }
      }
    } catch (error) {
      console.error('Failed to detect via LeagueClient.exe:', error)
    }

    // Method 2: Try with findstr
    try {
      const { stdout } = await execAsync(
        'wmic process get Name,ExecutablePath | findstr /i "LeagueClient"'
      )
      const lines = stdout.split('\n')
      for (const line of lines) {
        if (line.includes('LeagueClient.exe') && line.includes('\\')) {
          // Extract path from the line
          const pathMatch = line.match(/([A-Z]:\\[^\s]+LeagueClient\.exe)/i)
          if (pathMatch) {
            const rootPath = path.dirname(pathMatch[1])
            const gamePath = path.join(rootPath, 'Game')
            if (await this.isValidGamePath(gamePath)) {
              return gamePath
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to detect via findstr method:', error)
    }

    // Method 3: Check for League of Legends.exe directly
    try {
      const { stdout } = await execAsync(
        'wmic process where "name=\'League of Legends.exe\'" get ExecutablePath /value'
      )
      const match = stdout.match(/ExecutablePath=(.+)/)
      if (match && match[1]) {
        const exePath = match[1].trim().replace(/\r/g, '')
        const gamePath = path.dirname(exePath)
        if (await this.isValidGamePath(gamePath)) {
          return gamePath
        }
      }
    } catch (error) {
      console.error('Failed to detect League of Legends.exe:', error)
    }

    // Method 4: Try PowerShell as fallback
    try {
      const { stdout } = await execAsync(
        'powershell -Command "Get-Process LeagueClient -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path"'
      )
      if (stdout.trim()) {
        const rootPath = path.dirname(stdout.trim())
        const gamePath = path.join(rootPath, 'Game')
        if (await this.isValidGamePath(gamePath)) {
          return gamePath
        }
      }
    } catch (error) {
      console.error('Failed to detect via PowerShell:', error)
    }

    // Method 5: Check Windows Registry
    try {
      const { stdout } = await execAsync(
        'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Riot Games, Inc\\League of Legends" /v "Location" 2>nul'
      )
      const match = stdout.match(/Location\s+REG_SZ\s+(.+)/)
      if (match && match[1]) {
        const rootPath = match[1].trim()
        const gamePath = path.join(rootPath, 'Game')
        if (await this.isValidGamePath(gamePath)) {
          return gamePath
        }
      }
    } catch (error) {
      console.error('Failed to detect via Registry:', error)
      // Registry key might not exist
    }

    return null
  }

  private async detectFromRiotClientInstalls(): Promise<string | null> {
    try {
      const riotInstallsPath = 'C:\\ProgramData\\Riot Games\\RiotClientInstalls.json'

      // Check if file exists
      try {
        await fs.access(riotInstallsPath)
      } catch {
        // File doesn't exist, return null
        return null
      }

      // Read and parse the JSON file
      const fileContent = await fs.readFile(riotInstallsPath, 'utf-8')
      const data = JSON.parse(fileContent)

      // Check if associated_client exists
      if (!data.associated_client || typeof data.associated_client !== 'object') {
        return null
      }

      // Look for League of Legends path in associated_client
      for (const [installPath] of Object.entries(data.associated_client)) {
        // Check if this is a League of Legends installation
        if (installPath.toLowerCase().includes('league of legends')) {
          // Normalize the path (convert forward slashes to backslashes)
          let normalizedPath = installPath.replace(/\//g, '\\')

          // Remove trailing slash if present
          if (normalizedPath.endsWith('\\')) {
            normalizedPath = normalizedPath.slice(0, -1)
          }

          // Append Game folder
          const gamePath = path.join(normalizedPath, 'Game')

          // Validate the path
          if (await this.isValidGamePath(gamePath)) {
            return gamePath
          }
        }
      }

      return null
    } catch (error) {
      console.error('Failed to detect from RiotClientInstalls.json:', error)
      return null
    }
  }

  private async isValidGamePath(gamePath: string): Promise<boolean> {
    try {
      // Check for League of Legends.exe or LeagueofLegends.app
      const exePath = path.join(gamePath, 'League of Legends.exe')
      const appPath = path.join(gamePath, 'LeagueofLegends.app')

      const [exeExists, appExists] = await Promise.all([
        fs
          .access(exePath)
          .then(() => true)
          .catch(() => false),
        fs
          .access(appPath)
          .then(() => true)
          .catch(() => false)
      ])

      return exeExists || appExists
    } catch (error) {
      console.error('Error validating game path:', error)
      return false
    }
  }
}
