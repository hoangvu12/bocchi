import { championDataService } from './championDataService'
// Import SelectedSkin type inline to avoid circular dependency
interface SelectedSkin {
  championKey: string
  championName: string
  championId?: number // Numeric champion ID for ID-based repositories
  skinId: string
  skinName: string
  skinNameEn?: string
  lolSkinsName?: string
  skinNum: number
  chromaId?: string
  isDownloaded?: boolean
  isAutoSynced?: boolean
}

interface FilteredSkins {
  teamSkins: SelectedSkin[]
  customMods: SelectedSkin[]
  filteredOut: SelectedSkin[]
}

export class SkinApplyService {
  /**
   * Filter selected skins based on team composition
   * Always includes custom mods regardless of team
   * For auto-synced skins, prioritizes based on who owns the champion
   */
  async filterSkinsByTeamComposition(
    selectedSkins: SelectedSkin[],
    teamChampionIds: number[]
  ): Promise<FilteredSkins> {
    const teamSkins: SelectedSkin[] = []
    const customMods: SelectedSkin[] = []
    const filteredOut: SelectedSkin[] = []

    // Get champion key mapping
    const championKeyMap = await this.getChampionKeyMap()

    // Convert team champion IDs to keys
    const teamChampionKeys = new Set(
      teamChampionIds.map((id) => championKeyMap[id]).filter((key) => key !== undefined)
    )

    // Track which champions already have skins to prevent duplicates
    const championSkinMap = new Map<string, SelectedSkin>()

    // Filter skins with priority handling
    for (const skin of selectedSkins) {
      if (skin.championKey === 'Custom') {
        // Always include custom mods
        customMods.push(skin)
      } else if (teamChampionKeys.has(skin.championKey)) {
        // Check if we already have a skin for this champion
        const existingSkin = championSkinMap.get(skin.championKey)

        if (!existingSkin) {
          // First skin for this champion, add it
          teamSkins.push(skin)
          championSkinMap.set(skin.championKey, skin)
        } else {
          // We already have a skin for this champion
          // If priority map is provided and this is an auto-synced skin, check priority
          const isAutoSynced = 'isAutoSynced' in skin && skin.isAutoSynced
          const existingIsAutoSynced = 'isAutoSynced' in existingSkin && existingSkin.isAutoSynced

          // User's manual selections always take priority over auto-synced
          if (!isAutoSynced && existingIsAutoSynced) {
            // Replace auto-synced with manual selection
            const index = teamSkins.indexOf(existingSkin)
            if (index !== -1) {
              teamSkins[index] = skin
              championSkinMap.set(skin.championKey, skin)
            }
          } else if (isAutoSynced && !existingIsAutoSynced) {
            // Keep the manual selection, skip auto-synced
            filteredOut.push(skin)
          } else {
            // Both are same type (both manual or both auto), keep first one

            filteredOut.push(skin)
          }
        }
      } else {
        // Track what was filtered out
        filteredOut.push(skin)
      }
    }

    return {
      teamSkins,
      customMods,
      filteredOut
    }
  }

  /**
   * Get all skins that should be applied for smart loading
   */
  async getSmartApplySkins(
    selectedSkins: SelectedSkin[],
    teamChampionIds: number[]
  ): Promise<SelectedSkin[]> {
    const filtered = await this.filterSkinsByTeamComposition(selectedSkins, teamChampionIds)
    // Combine team skins and custom mods
    return [...filtered.teamSkins, ...filtered.customMods]
  }

  /**
   * Create a map of champion ID to champion key
   */
  private async getChampionKeyMap(): Promise<Record<number, string>> {
    const map: Record<number, string> = {}
    const championData = await championDataService.loadChampionData()

    if (championData?.champions) {
      for (const champion of championData.champions) {
        // Champion ID is stored as a string in the data
        if (champion.id) {
          const id = parseInt(champion.id.toString(), 10)
          if (!isNaN(id)) {
            map[id] = champion.key
          }
        }
      }
    }

    return map
  }

  /**
   * Get champion name by ID
   */
  async getChampionNameById(championId: number): Promise<string | null> {
    const championData = await championDataService.loadChampionData()

    if (championData?.champions) {
      const champion = championData.champions.find(
        (c) => parseInt(c.id.toString(), 10) === championId
      )
      return champion ? champion.name : null
    }

    return null
  }

  /**
   * Get summary of what will be applied
   */
  async getSmartApplySummary(
    selectedSkins: SelectedSkin[],
    teamChampionIds: number[]
  ): Promise<{
    totalSelected: number
    willApply: number
    teamChampions: string[]
    customModCount: number
  }> {
    const filtered = await this.filterSkinsByTeamComposition(selectedSkins, teamChampionIds)
    const teamChampionPromises = teamChampionIds.map((id) => this.getChampionNameById(id))
    const teamChampionNames = await Promise.all(teamChampionPromises)
    const teamChampions = teamChampionNames.filter((name): name is string => name !== null)

    return {
      totalSelected: selectedSkins.length,
      willApply: filtered.teamSkins.length + filtered.customMods.length,
      teamChampions,
      customModCount: filtered.customMods.length
    }
  }
}

// Singleton instance
export const skinApplyService = new SkinApplyService()
