import { championDataService } from './championDataService'
import type { SelectedSkin } from '../types/index'

interface FilteredSkins {
  teamSkins: SelectedSkin[]
  customMods: SelectedSkin[]
  filteredOut: SelectedSkin[]
}

export class SkinApplyService {
  /**
   * Filter selected skins based on team composition
   * Always includes custom mods regardless of team
   */
  async filterSkinsByTeamComposition(
    selectedSkins: SelectedSkin[],
    teamChampionIds: number[]
  ): Promise<FilteredSkins> {
    console.log('[SkinApplyService] Filtering skins for team champion IDs:', teamChampionIds)
    console.log(
      '[SkinApplyService] Selected skins to filter:',
      selectedSkins.map((s) => ({
        championKey: s.championKey,
        skinName: s.skinName
      }))
    )

    const teamSkins: SelectedSkin[] = []
    const customMods: SelectedSkin[] = []
    const filteredOut: SelectedSkin[] = []

    // Get champion key mapping
    const championKeyMap = await this.getChampionKeyMap()
    console.log(
      '[SkinApplyService] Champion key map sample:',
      Object.entries(championKeyMap).slice(0, 5)
    )

    // Convert team champion IDs to keys
    const teamChampionKeys = new Set(
      teamChampionIds.map((id) => championKeyMap[id]).filter((key) => key !== undefined)
    )
    console.log('[SkinApplyService] Team champion keys:', Array.from(teamChampionKeys))

    // Filter skins
    for (const skin of selectedSkins) {
      if (skin.championKey === 'Custom') {
        // Always include custom mods
        console.log('[SkinApplyService] Including custom mod:', skin.skinName)
        customMods.push(skin)
      } else if (teamChampionKeys.has(skin.championKey)) {
        // Include if champion is in team
        console.log('[SkinApplyService] Including team skin:', skin.championKey, skin.skinName)
        teamSkins.push(skin)
      } else {
        // Track what was filtered out
        console.log('[SkinApplyService] Filtering out:', skin.championKey, skin.skinName)
        filteredOut.push(skin)
      }
    }

    console.log('[SkinApplyService] Filter results:', {
      teamSkins: teamSkins.length,
      customMods: customMods.length,
      filteredOut: filteredOut.length
    })

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
