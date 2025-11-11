import axios from 'axios'
import {
  SkinRepository,
  RepositorySettings,
  DEFAULT_REPOSITORY,
  DEFAULT_REPOSITORY_STRUCTURE,
  RepositoryDetectionResult
} from '../types/repository.types'
import { settingsService } from './settingsService'
import { championDataService } from './championDataService'
import { repositoryDetector } from './repositoryDetector'

export class RepositoryService {
  private static instance: RepositoryService
  private repositories: SkinRepository[] = []
  private activeRepositoryId: string = DEFAULT_REPOSITORY.id

  private constructor() {
    this.loadRepositories()
  }

  static getInstance(): RepositoryService {
    if (!RepositoryService.instance) {
      RepositoryService.instance = new RepositoryService()
    }
    return RepositoryService.instance
  }

  private loadRepositories(): void {
    try {
      const settings = settingsService.get('repositorySettings') as RepositorySettings
      if (settings) {
        this.repositories = settings.repositories || [DEFAULT_REPOSITORY]
        this.activeRepositoryId = settings.activeRepositoryId || DEFAULT_REPOSITORY.id

        // Ensure default repository exists
        if (!this.repositories.find((r) => r.id === DEFAULT_REPOSITORY.id)) {
          this.repositories.unshift(DEFAULT_REPOSITORY)
        }

        // Migrate repositories without structure field
        this.migrateRepositories()
      } else {
        // Initialize with default repository
        this.repositories = [DEFAULT_REPOSITORY]
        this.activeRepositoryId = DEFAULT_REPOSITORY.id
        this.saveRepositories()
      }
    } catch (error) {
      console.error('Failed to load repositories:', error)
      this.repositories = [DEFAULT_REPOSITORY]
      this.activeRepositoryId = DEFAULT_REPOSITORY.id
    }
  }

  /**
   * Migrates repositories from old format to new format with structure field
   */
  private migrateRepositories(): void {
    let migrated = false

    this.repositories = this.repositories.map((repo) => {
      // If repository doesn't have structure field, add default structure
      if (!repo.structure || !repo.structure.type) {
        migrated = true
        return {
          ...repo,
          structure: {
            type: 'name-based' as const,
            skinsPath: repo.structure?.skinsPath || 'skins',
            chromaPattern: repo.structure?.chromaPattern,
            autoDetected: false
          }
        }
      }
      return repo
    })

    // Save if any migration happened
    if (migrated) {
      console.log('Migrated repositories to new format with structure types')
      this.saveRepositories()
    }

    // Auto-detect repositories that weren't auto-detected yet (async in background)
    this.autoDetectUndetectedRepositories()
  }

  /**
   * Auto-detects structure for repositories that have autoDetected: false
   * Runs in background without blocking app startup
   */
  private async autoDetectUndetectedRepositories(): Promise<void> {
    const undetectedRepos = this.repositories.filter(
      (repo) => repo.structure && !repo.structure.autoDetected && !repo.isDefault
    )

    if (undetectedRepos.length === 0) {
      return
    }

    console.log(
      `Auto-detecting structure for ${undetectedRepos.length} repositories in background...`
    )

    for (const repo of undetectedRepos) {
      try {
        console.log(`Auto-detecting ${repo.owner}/${repo.repo}...`)
        const detection = await repositoryDetector.detectRepositoryStructure(
          repo.owner,
          repo.repo,
          repo.branch,
          repo.structure?.skinsPath
        )

        // Update the repository structure
        this.updateRepository(repo.id, {
          structure: {
            type: detection.type,
            skinsPath: detection.skinsPath,
            autoDetected: true
          }
        })

        console.log(
          `✓ Detected ${repo.owner}/${repo.repo} as ${detection.type} (${detection.confidence}% confidence)`
        )
      } catch (error) {
        console.error(`Failed to auto-detect ${repo.owner}/${repo.repo}:`, error)
        // Keep existing structure, just mark as detected to avoid re-trying
        this.updateRepository(repo.id, {
          structure: {
            ...(repo.structure || { type: 'name-based', skinsPath: 'skins' }),
            autoDetected: true // Mark as detected even if failed
          }
        })
      }
    }
  }

  private saveRepositories(): void {
    try {
      const settings: RepositorySettings = {
        repositories: this.repositories,
        activeRepositoryId: this.activeRepositoryId,
        allowMultipleActive: false
      }
      settingsService.set('repositorySettings', settings)
    } catch (error) {
      console.error('Failed to save repositories:', error)
    }
  }

  getRepositories(): SkinRepository[] {
    return [...this.repositories]
  }

  getActiveRepository(): SkinRepository {
    const active = this.repositories.find((r) => r.id === this.activeRepositoryId)
    return active || DEFAULT_REPOSITORY
  }

  getRepositoryById(id: string): SkinRepository | undefined {
    return this.repositories.find((r) => r.id === id)
  }

  setActiveRepository(id: string): boolean {
    const repo = this.repositories.find((r) => r.id === id)
    if (repo) {
      this.activeRepositoryId = id
      this.saveRepositories()
      return true
    }
    return false
  }

  async addRepository(repository: Omit<SkinRepository, 'id' | 'status'>): Promise<SkinRepository> {
    // Generate unique ID
    const id = `${repository.owner}-${repository.repo}-${Date.now()}`

    const newRepo: SkinRepository = {
      ...repository,
      id,
      status: 'unchecked',
      isCustom: true,
      isDefault: false
    }

    // Validate before adding
    const isValid = await this.validateRepository(newRepo)
    if (!isValid) {
      throw new Error('Invalid repository structure')
    }

    this.repositories.push(newRepo)
    this.saveRepositories()
    return newRepo
  }

  /**
   * Adds a repository with automatic structure detection
   */
  async addRepositoryWithDetection(
    owner: string,
    repo: string,
    branch: string = 'main',
    name?: string
  ): Promise<{ repository: SkinRepository; detection: RepositoryDetectionResult }> {
    // Run detection
    const detection = await repositoryDetector.detectRepositoryStructure(owner, repo, branch)

    // Create repository with detected structure
    const repository: Omit<SkinRepository, 'id' | 'status'> = {
      name: name || `${owner}/${repo}`,
      owner,
      repo,
      branch,
      isDefault: false,
      isCustom: true,
      structure: {
        type: detection.type,
        skinsPath: detection.skinsPath,
        autoDetected: true
      }
    }

    const newRepo = await this.addRepository(repository)
    return { repository: newRepo, detection }
  }

  /**
   * Re-detects the structure of an existing repository
   */
  async redetectRepositoryStructure(id: string): Promise<RepositoryDetectionResult> {
    const repo = this.getRepositoryById(id)
    if (!repo) {
      throw new Error('Repository not found')
    }

    // Run detection
    const detection = await repositoryDetector.detectRepositoryStructure(
      repo.owner,
      repo.repo,
      repo.branch,
      repo.structure?.skinsPath
    )

    // Update repository structure
    this.updateRepository(id, {
      structure: {
        type: detection.type,
        skinsPath: detection.skinsPath,
        autoDetected: true
      }
    })

    return detection
  }

  removeRepository(id: string): boolean {
    // Cannot remove default repository
    const repo = this.repositories.find((r) => r.id === id)
    if (!repo || repo.isDefault) {
      return false
    }

    // Cannot remove the active repository
    if (this.activeRepositoryId === id) {
      return false
    }

    this.repositories = this.repositories.filter((r) => r.id !== id)
    this.saveRepositories()
    return true
  }

  updateRepository(id: string, updates: Partial<SkinRepository>): boolean {
    const index = this.repositories.findIndex((r) => r.id === id)
    if (index === -1) {
      return false
    }

    // Don't allow changing certain fields
    delete updates.id
    delete updates.isDefault

    this.repositories[index] = {
      ...this.repositories[index],
      ...updates
    }

    this.saveRepositories()
    return true
  }

  async validateRepository(repository: SkinRepository): Promise<boolean> {
    try {
      // Update status
      repository.status = 'checking'
      this.saveRepositories()

      // Check if repository exists on GitHub
      const repoUrl = `https://api.github.com/repos/${repository.owner}/${repository.repo}`
      const repoResponse = await axios.get(repoUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Bocchi-LoL-Skin-Manager'
        },
        timeout: 10000
      })

      if (repoResponse.status !== 200) {
        repository.status = 'error'
        this.saveRepositories()
        return false
      }

      // Check if skins folder exists
      const skinsPath = repository.structure?.skinsPath || 'skins'
      const contentsUrl = `https://api.github.com/repos/${repository.owner}/${repository.repo}/contents/${skinsPath}?ref=${repository.branch}`

      try {
        const contentsResponse = await axios.get(contentsUrl, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Bocchi-LoL-Skin-Manager'
          },
          timeout: 10000
        })

        if (contentsResponse.status === 200 && Array.isArray(contentsResponse.data)) {
          repository.status = 'active'
          repository.lastChecked = new Date()
          this.saveRepositories()
          return true
        }
      } catch {
        // Skins folder doesn't exist
        console.error(`Skins folder not found in repository ${repository.owner}/${repository.repo}`)
      }

      repository.status = 'error'
      this.saveRepositories()
      return false
    } catch (error) {
      console.error(`Failed to validate repository ${repository.owner}/${repository.repo}:`, error)
      repository.status = 'error'
      this.saveRepositories()
      return false
    }
  }

  async validateAllRepositories(): Promise<void> {
    for (const repo of this.repositories) {
      await this.validateRepository(repo)
    }
  }

  constructGitHubUrl(
    championName: string,
    skinFile: string,
    isChroma: boolean = false,
    chromaBase?: string
  ): string {
    const repo = this.getActiveRepository()
    const structure = repo.structure || DEFAULT_REPOSITORY_STRUCTURE
    const skinsPath = structure.skinsPath

    // If ID-based repository, convert names to IDs
    if (structure.type === 'id-based') {
      return this.constructIdBasedUrl(championName, skinFile, repo, skinsPath)
    }

    // Name-based repository (default)
    if (isChroma && chromaBase) {
      return `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${skinsPath}/${championName}/chromas/${encodeURIComponent(chromaBase)}/${encodeURIComponent(skinFile)}`
    }

    return `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${skinsPath}/${championName}/${encodeURIComponent(skinFile)}`
  }

  /**
   * Constructs URL for ID-based repositories (synchronous)
   */
  private constructIdBasedUrl(
    championName: string,
    skinFile: string,
    repo: SkinRepository,
    skinsPath: string
  ): string {
    // Look up champion by name (sync)
    const champion = championDataService.getChampionByNameSync(championName)
    if (!champion) {
      console.error(`Champion not found in cache: ${championName}`)
      // Fallback to name-based URL to avoid breaking
      return `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${skinsPath}/${championName}/${encodeURIComponent(skinFile)}`
    }

    const championId = champion.id

    // Check if this is a chroma (has 6-digit ID in filename)
    const chromaMatch = skinFile.match(/(\d{6})\.zip$/i)
    if (chromaMatch) {
      const chromaId = chromaMatch[1]

      // Find the skin that has this chroma
      let skinId = ''
      for (const skin of champion.skins) {
        if (skin.chromas && skin.chromaList) {
          const hasChroma = skin.chromaList.some((c) => c.id.toString() === chromaId)
          if (hasChroma) {
            // Construct skin ID from champion ID + skin num
            skinId = championId.toString() + skin.num.toString().padStart(3, '0')
            break
          }
        }
      }

      if (skinId) {
        return `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${skinsPath}/${championId}/${skinId}/${chromaId}/${chromaId}.zip`
      }
    }

    // Regular skin (not a chroma)
    const baseName = skinFile.replace('.zip', '')
    const matchingSkin = champion.skins.find((s) => {
      const skinName = s.lolSkinsName || s.nameEn || s.name
      return skinName === baseName
    })

    if (!matchingSkin) {
      console.error(`Skin not found in champion data: ${baseName}`)
      // Fallback
      return `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${skinsPath}/${championName}/${encodeURIComponent(skinFile)}`
    }

    const skinId = championId.toString() + matchingSkin.num.toString().padStart(3, '0')
    return `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${skinsPath}/${championId}/${skinId}/${skinId}.zip`
  }

  /**
   * Constructs a GitHub URL for ID-based repositories
   */
  async constructGitHubUrlFromIds(
    championId: number,
    skinId: string,
    repositoryId?: string,
    chromaId?: string
  ): Promise<string> {
    const repo = repositoryId ? this.getRepositoryById(repositoryId) : this.getActiveRepository()
    if (!repo) {
      throw new Error('Repository not found')
    }

    const skinsPath = repo.structure?.skinsPath || 'skins'

    // If chromaId is provided, construct chroma URL
    if (chromaId) {
      const fileName = `${chromaId}.zip`
      return `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${skinsPath}/${championId}/${skinId}/${chromaId}/${fileName}`
    }

    // Otherwise, construct regular skin URL
    const fileName = `${skinId}.zip`
    return `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${skinsPath}/${championId}/${skinId}/${fileName}`
  }

  /**
   * Constructs a GitHub URL that works for both name-based and ID-based repositories
   * Automatically detects the repository type and constructs the appropriate URL
   */
  async constructGitHubUrlAuto(
    championKeyOrId: string | number,
    skinFileOrId: string,
    repositoryId?: string
  ): Promise<string> {
    const repo = repositoryId ? this.getRepositoryById(repositoryId) : this.getActiveRepository()
    if (!repo) {
      throw new Error('Repository not found')
    }

    const structure = repo.structure || DEFAULT_REPOSITORY_STRUCTURE
    const skinsPath = structure.skinsPath

    // If repository is ID-based, construct ID-based URL
    if (structure.type === 'id-based') {
      let championId: number

      if (typeof championKeyOrId === 'number') {
        championId = championKeyOrId
      } else {
        // Resolve champion key to ID
        const champion = await championDataService.getChampionByKey(championKeyOrId)
        if (!champion) {
          throw new Error(`Champion not found: ${championKeyOrId}`)
        }
        championId = champion.id
      }

      return this.constructGitHubUrlFromIds(championId, skinFileOrId, repositoryId)
    }

    // Otherwise, construct name-based URL (default behavior)
    let championName: string

    if (typeof championKeyOrId === 'number') {
      // Resolve ID to name
      const name = await championDataService.getChampionNameById(championKeyOrId)
      if (!name) {
        throw new Error(`Champion not found: ${championKeyOrId}`)
      }
      championName = name
    } else {
      // Try to get champion name from key
      const champion = await championDataService.getChampionByKey(championKeyOrId)
      championName = champion ? champion.name : championKeyOrId
    }

    return `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${skinsPath}/${championName}/${encodeURIComponent(skinFileOrId)}`
  }

  constructRawUrl(url: string): string {
    // Convert GitHub URL to raw URL for any repository
    return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
  }

  parseGitHubUrl(
    url: string
  ): { owner: string; repo: string; branch: string; path: string } | null {
    // Parse any GitHub URL to extract repository info
    const patterns = [
      /github\.com\/([^/]+)\/([^/]+)\/(blob|raw)\/([^/]+)\/(.+)$/,
      /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        if (url.includes('raw.githubusercontent.com')) {
          return {
            owner: match[1],
            repo: match[2],
            branch: match[3],
            path: match[4]
          }
        } else {
          return {
            owner: match[1],
            repo: match[2],
            branch: match[4],
            path: match[5]
          }
        }
      }
    }

    return null
  }

  getRepositoryFromUrl(url: string): SkinRepository | undefined {
    const parsed = this.parseGitHubUrl(url)
    if (!parsed) return undefined

    return this.repositories.find((r) => r.owner === parsed.owner && r.repo === parsed.repo)
  }
}

// Export singleton instance
export const repositoryService = RepositoryService.getInstance()
