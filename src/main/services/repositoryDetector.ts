import type { RepositoryStructureType, RepositoryDetectionResult } from '../types/repository.types'

interface GitHubTreeItem {
  path: string
  mode: string
  type: string
  sha: string
  size?: number
  url: string
}

interface GitHubTreeResponse {
  sha: string
  url: string
  tree: GitHubTreeItem[]
  truncated: boolean
}

const CHAMPION_NAME_PATTERN = /^[A-Z][a-zA-Z\s']+$/
const NUMERIC_ID_PATTERN = /^\d+$/
const DETECTION_SAMPLE_SIZE = 5
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

interface DetectionCache {
  result: RepositoryDetectionResult
  timestamp: number
}

class RepositoryDetector {
  private cache: Map<string, DetectionCache> = new Map()

  /**
   * Detects the structure type of a repository (name-based or ID-based)
   */
  async detectRepositoryStructure(
    owner: string,
    repo: string,
    branch: string = 'main',
    skinsPath: string = 'skins'
  ): Promise<RepositoryDetectionResult> {
    const cacheKey = `${owner}/${repo}/${branch}/${skinsPath}`

    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      return cached.result
    }

    try {
      // Fetch repository tree
      const tree = await this.fetchRepositoryTree(owner, repo, branch)

      // Find the skins directory in the tree
      const skinsTree = this.findSkinsDirectory(tree, skinsPath)
      if (!skinsTree || skinsTree.length === 0) {
        const result: RepositoryDetectionResult = {
          type: 'name-based',
          confidence: 0,
          skinsPath,
          sampledPaths: [],
          error: 'Skins directory not found or empty'
        }
        return result
      }

      // Sample and analyze directory names
      const samples = skinsTree.slice(0, DETECTION_SAMPLE_SIZE)
      const analysis = this.analyzeDirectoryNames(samples.map((item) => item.path))

      // Determine structure type based on analysis
      const result: RepositoryDetectionResult = {
        type: analysis.type,
        confidence: analysis.confidence,
        skinsPath,
        sampledPaths: samples.map((item) => item.path)
      }

      // If confidence is low, try deep validation
      if (analysis.confidence < 100 && samples.length > 0) {
        const deepResult = await this.deepValidation(owner, repo, branch, samples[0].path)
        if (deepResult) {
          result.type = deepResult.type
          result.confidence = deepResult.confidence
        }
      }

      // Cache the result
      this.cache.set(cacheKey, { result, timestamp: Date.now() })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        type: 'name-based',
        confidence: 0,
        skinsPath,
        sampledPaths: [],
        error: `Detection failed: ${errorMessage}`
      }
    }
  }

  /**
   * Fetches the repository tree from GitHub API
   */
  private async fetchRepositoryTree(
    owner: string,
    repo: string,
    branch: string
  ): Promise<GitHubTreeItem[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json'
      }
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    const data: GitHubTreeResponse = await response.json()
    return data.tree
  }

  /**
   * Finds all directories in the skins path
   */
  private findSkinsDirectory(tree: GitHubTreeItem[], skinsPath: string): GitHubTreeItem[] {
    const normalizedPath = skinsPath.endsWith('/') ? skinsPath : `${skinsPath}/`

    return tree.filter((item) => {
      if (item.type !== 'tree') return false
      if (!item.path.startsWith(normalizedPath)) return false

      // Only get first-level directories under skins/
      const relativePath = item.path.slice(normalizedPath.length)
      const depth = relativePath.split('/').filter((p) => p).length

      return depth === 1
    })
  }

  /**
   * Analyzes directory names to determine structure type
   */
  private analyzeDirectoryNames(paths: string[]): {
    type: RepositoryStructureType
    confidence: number
  } {
    if (paths.length === 0) {
      return { type: 'name-based', confidence: 0 }
    }

    // Extract just the directory name (last part of path)
    const dirNames = paths.map((path) => {
      const parts = path.split('/')
      return parts[parts.length - 1]
    })

    let numericCount = 0
    let nameBasedCount = 0

    for (const name of dirNames) {
      if (NUMERIC_ID_PATTERN.test(name)) {
        numericCount++
      } else if (CHAMPION_NAME_PATTERN.test(name)) {
        nameBasedCount++
      }
    }

    const total = dirNames.length
    const numericPercent = (numericCount / total) * 100
    const nameBasedPercent = (nameBasedCount / total) * 100

    // Determine type and confidence
    if (numericCount === total) {
      return { type: 'id-based', confidence: 100 }
    } else if (nameBasedCount === total) {
      return { type: 'name-based', confidence: 100 }
    } else if (numericPercent >= 80) {
      return { type: 'id-based', confidence: 80 }
    } else if (nameBasedPercent >= 80) {
      return { type: 'name-based', confidence: 80 }
    } else {
      // Mixed or unclear - default to name-based
      return { type: 'name-based', confidence: 50 }
    }
  }

  /**
   * Performs deep validation by checking the structure of a sample directory
   */
  private async deepValidation(
    owner: string,
    repo: string,
    branch: string,
    samplePath: string
  ): Promise<{ type: RepositoryStructureType; confidence: number } | null> {
    try {
      const tree = await this.fetchRepositoryTree(owner, repo, branch)

      // Get the directory name (champion ID or name)
      const pathParts = samplePath.split('/')
      const dirName = pathParts[pathParts.length - 1]

      // If it's numeric, validate ID-based structure
      if (NUMERIC_ID_PATTERN.test(dirName)) {
        // Check for second-level numeric directories (skin IDs)
        const secondLevel = tree.filter((item) => {
          if (item.type !== 'tree') return false
          if (!item.path.startsWith(`${samplePath}/`)) return false

          const relativePath = item.path.slice(`${samplePath}/`.length)
          const depth = relativePath.split('/').filter((p) => p).length

          return depth === 1
        })

        if (secondLevel.length === 0) return null

        // Check if second-level directories are numeric
        const secondLevelNames = secondLevel.map((item) => {
          const parts = item.path.split('/')
          return parts[parts.length - 1]
        })

        const allNumeric = secondLevelNames.every((name) => NUMERIC_ID_PATTERN.test(name))

        if (allNumeric) {
          // Check for .zip files in one of the second-level directories
          const sampleSecondLevel = secondLevel[0].path
          const zipFiles = tree.filter(
            (item) =>
              item.type === 'blob' &&
              item.path.startsWith(`${sampleSecondLevel}/`) &&
              item.path.endsWith('.zip')
          )

          if (zipFiles.length > 0) {
            return { type: 'id-based', confidence: 100 }
          }
        }
      }

      return null
    } catch {
      return null
    }
  }

  /**
   * Clears the detection cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Invalidates cache for a specific repository
   */
  invalidateCache(owner: string, repo: string, branch?: string): void {
    if (branch) {
      const prefix = `${owner}/${repo}/${branch}/`
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key)
        }
      }
    } else {
      const prefix = `${owner}/${repo}/`
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key)
        }
      }
    }
  }
}

// Export singleton instance
export const repositoryDetector = new RepositoryDetector()
