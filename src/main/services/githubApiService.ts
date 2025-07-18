import axios from 'axios'

export interface GitHubCommit {
  sha: string
  date: Date
  message: string
}

export class GitHubApiService {
  private static readonly API_BASE = 'https://api.github.com'
  private static readonly REPO = 'darkseal-org/lol-skins'
  private static readonly RATE_LIMIT_DELAY = 1000 // 1 second between requests

  private lastRequestTime = 0

  async getLatestCommitForSkin(skinPath: string): Promise<GitHubCommit | null> {
    try {
      // Rate limiting
      await this.enforceRateLimit()

      const url = `${GitHubApiService.API_BASE}/repos/${GitHubApiService.REPO}/commits`
      const params = {
        path: skinPath,
        page: 1,
        per_page: 1
      }

      console.log(`[GitHubAPI] Fetching commit for: ${skinPath}`)

      const response = await axios.get(url, {
        params,
        timeout: 10000, // 10 second timeout
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Bocchi-LoL-Skin-Manager'
        }
      })

      if (response.status === 200 && response.data.length > 0) {
        const commit = response.data[0]
        return {
          sha: commit.sha,
          date: new Date(commit.commit.author.date),
          message: commit.commit.message
        }
      }

      console.warn(`[GitHubAPI] No commits found for: ${skinPath}`)
      return null
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          console.warn(`[GitHubAPI] Skin not found: ${skinPath}`)
          return null
        } else if (error.response?.status === 403) {
          console.warn('[GitHubAPI] Rate limit exceeded, will retry later')
          throw new Error('GitHub API rate limit exceeded')
        } else if (error.response?.status && error.response.status >= 500) {
          console.warn('[GitHubAPI] GitHub server error')
          throw new Error('GitHub server error')
        }
      }

      console.error(`[GitHubAPI] Error fetching commit for ${skinPath}:`, error)
      throw error
    }
  }

  parseGitHubPathFromUrl(url: string): string {
    // Convert GitHub URL to file path for API
    // Example: https://github.com/darkseal-org/lol-skins/blob/main/skins/Aatrox/Blood%20Moon%20Aatrox.zip
    // Result: skins/Aatrox/Blood Moon Aatrox.zip

    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/')

      // Find the index of 'main' or 'master' branch
      const branchIndex = pathParts.findIndex((part) => part === 'main' || part === 'master')
      if (branchIndex === -1) {
        throw new Error('Invalid GitHub URL: no main/master branch found')
      }

      // Get everything after the branch
      const filePath = pathParts.slice(branchIndex + 1).join('/')

      // Decode URL encoding
      return decodeURIComponent(filePath)
    } catch (error) {
      console.error(`[GitHubAPI] Failed to parse GitHub path from URL: ${url}`, error)
      throw new Error(`Invalid GitHub URL: ${url}`)
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < GitHubApiService.RATE_LIMIT_DELAY) {
      const waitTime = GitHubApiService.RATE_LIMIT_DELAY - timeSinceLastRequest
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    this.lastRequestTime = Date.now()
  }
}

// Export singleton instance
export const githubApiService = new GitHubApiService()
