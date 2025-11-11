export const gameService = {
  async detectGame(): Promise<string | null> {
    const result = await window.api.detectGame()
    if (result.success && result.gamePath) {
      return result.gamePath
    }
    return null
  },

  async browseGameFolder(): Promise<string | null> {
    const result = await window.api.browseGameFolder()
    if (result.success && result.gamePath) {
      return result.gamePath
    }
    return null
  },

  async getAppVersion(): Promise<string> {
    return window.api.getAppVersion()
  },

  async getSettings<T = unknown>(key: string): Promise<T> {
    return window.api.getSettings(key) as Promise<T>
  },

  async setSetting(key: string, value: any): Promise<void> {
    await window.api.setSettings(key, value)
  }
}
