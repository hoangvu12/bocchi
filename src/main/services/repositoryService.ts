import axios from 'axios'
import { SkinRepository, RepositorySettings, DEFAULT_REPOSITORY } from '../types/repository.types'
import { settingsService } from './settingsService'

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
    const skinsPath = repo.structure?.skinsPath || 'skins'

    if (isChroma && chromaBase) {
      return `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${skinsPath}/${championName}/chromas/${encodeURIComponent(chromaBase)}/${encodeURIComponent(skinFile)}`
    }

    return `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${skinsPath}/${championName}/${encodeURIComponent(skinFile)}`
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
