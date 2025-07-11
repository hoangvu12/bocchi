import { atom } from 'jotai'
import { selectAtom } from 'jotai/utils'
import {
  championSearchQueryAtom,
  filtersAtom,
  selectedChampionKeyAtom,
  showFavoritesOnlyAtom,
  skinSearchQueryAtom
} from '../atoms'
import { selectedChampionAtom, championDataAtom } from './champion.atoms'
import { favoritesAtom, downloadedSkinsAtom } from './skin.atoms'
import type { Champion, Skin } from '../../App'
import { getChampionDisplayName } from '../../utils/championUtils'

interface DisplaySkin {
  champion: Champion
  skin: Skin
}

// Filtered champions based on search
export const filteredChampionsAtom = atom((get) => {
  const championData = get(championDataAtom)
  const searchQuery = get(championSearchQueryAtom)

  if (!championData?.champions) return []

  if (!searchQuery.trim()) return championData.champions

  const searchLower = searchQuery.toLowerCase()
  return championData.champions.filter((champ) => {
    const displayName = getChampionDisplayName(champ)
    return displayName.toLowerCase().includes(searchLower)
  })
})

// All unique champion tags
export const allChampionTagsAtom = atom((get) => {
  const championData = get(championDataAtom)
  if (!championData?.champions) return []

  const tagSet = new Set<string>()
  championData.champions.forEach((champ) => {
    champ.tags.forEach((tag) => tagSet.add(tag))
  })
  return Array.from(tagSet).sort()
})

// Apply filters and sort to skins
const applyFiltersAndSort = (
  skins: DisplaySkin[],
  filters: any,
  downloadedSkins: any[]
): DisplaySkin[] => {
  let filtered = [...skins]

  // Apply download status filter
  if (filters.downloadStatus !== 'all') {
    filtered = filtered.filter(({ champion, skin }) => {
      const skinFileName = `${skin.nameEn || skin.name}.zip`.replace(/:/g, '')
      const isDownloaded = downloadedSkins.some(
        (ds) => ds.championName === champion.key && ds.skinName === skinFileName
      )

      if (filters.downloadStatus === 'downloaded') {
        return isDownloaded
      } else {
        return !isDownloaded
      }
    })
  }

  // Apply chroma status filter
  if (filters.chromaStatus !== 'all') {
    filtered = filtered.filter(({ skin }) => {
      const hasChromas = skin.chromas && skin.chromaList && skin.chromaList.length > 0

      if (filters.chromaStatus === 'has-chromas') {
        return hasChromas
      } else {
        return !hasChromas
      }
    })
  }

  // Apply rarity filter
  if (filters.rarity !== 'all') {
    filtered = filtered.filter(({ skin }) => {
      return skin.rarity === filters.rarity
    })
  }

  // Apply champion tag filter
  if (filters.championTags.length > 0) {
    filtered = filtered.filter(({ champion }) => {
      return filters.championTags.some((tag: string) => champion.tags.includes(tag))
    })
  }

  // Apply sorting
  filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case 'name-asc':
        return (a.skin.nameEn || a.skin.name).localeCompare(b.skin.nameEn || b.skin.name)
      case 'name-desc':
        return (b.skin.nameEn || b.skin.name).localeCompare(a.skin.nameEn || a.skin.name)
      case 'skin-asc':
        return a.skin.num - b.skin.num
      case 'skin-desc':
        return b.skin.num - a.skin.num
      case 'champion':
        return (a.champion.nameEn || a.champion.name).localeCompare(
          b.champion.nameEn || b.champion.name
        )
      default:
        return 0
    }
  })

  return filtered
}

// Display skins with all filters applied
export const displaySkinsAtom = atom((get) => {
  const championData = get(championDataAtom)
  const selectedChampion = get(selectedChampionAtom)
  const selectedChampionKey = get(selectedChampionKeyAtom)
  const skinSearchQuery = get(skinSearchQueryAtom)
  const showFavoritesOnly = get(showFavoritesOnlyAtom)
  const favorites = get(favoritesAtom)
  const downloadedSkins = get(downloadedSkinsAtom)
  const filters = get(filtersAtom)

  if (!championData) return []

  const allSkins: DisplaySkin[] = []
  const isSearchingGlobally = skinSearchQuery.trim().length > 0

  if (isSearchingGlobally) {
    // Global search across all champions
    const searchLower = skinSearchQuery.toLowerCase()
    championData.champions.forEach((champion) => {
      champion.skins.forEach((skin) => {
        if (skin.num !== 0 && skin.name.toLowerCase().includes(searchLower)) {
          allSkins.push({ champion, skin })
        }
      })
    })
  } else if (selectedChampion) {
    // Show skins for selected champion
    selectedChampion.skins.forEach((skin) => {
      if (skin.num !== 0) {
        if (!showFavoritesOnly || favorites.has(`${selectedChampion.key}_${skin.id}`)) {
          allSkins.push({ champion: selectedChampion, skin })
        }
      }
    })
  } else if (selectedChampionKey === 'all') {
    // Show all skins
    championData.champions.forEach((champion) => {
      champion.skins.forEach((skin) => {
        if (skin.num !== 0) {
          if (!showFavoritesOnly || favorites.has(`${champion.key}_${skin.id}`)) {
            allSkins.push({ champion, skin })
          }
        }
      })
    })
  } else if (selectedChampionKey === 'custom') {
    // Show custom mods
    downloadedSkins.forEach((downloadedSkin) => {
      // Check if this is a custom mod (user-imported)
      if (downloadedSkin.skinName.includes('[User]')) {
        // Find the champion for this custom mod
        let champion: Champion | undefined

        // First try to match the actual champion
        if (downloadedSkin.championName && downloadedSkin.championName !== 'Custom') {
          champion = championData.champions.find(
            (c) => c.key.toLowerCase() === downloadedSkin.championName.toLowerCase()
          )
        }

        // If no champion found or championName is 'Custom', create a custom champion
        if (!champion) {
          champion = {
            id: -1,
            key: 'Custom',
            name: 'Custom',
            nameEn: 'Custom',
            title: 'Imported Mods',
            image: '',
            skins: [],
            tags: []
          }
        }

        // Create a custom skin object
        const customSkin: Skin = {
          id: `custom_${downloadedSkin.skinName}`,
          num: -1, // Custom skins don't have a number
          name: downloadedSkin.skinName.replace('[User] ', ''),
          nameEn: downloadedSkin.skinName.replace('[User] ', ''),
          chromas: false,
          rarity: 'kNoRarity',
          rarityGemPath: null,
          isLegacy: false,
          skinType: 'custom',
          description: 'Custom imported mod'
        }

        allSkins.push({ champion, skin: customSkin })
      }
    })
  }

  return applyFiltersAndSort(allSkins, filters, downloadedSkins)
})

// Skin statistics
export const skinStatsAtom = atom((get) => {
  const championData = get(championDataAtom)
  const downloadedSkins = get(downloadedSkinsAtom)

  let total = 0
  let downloaded = 0

  if (championData) {
    championData.champions.forEach((champion) => {
      champion.skins.forEach((skin) => {
        if (skin.num !== 0) {
          total++
          const skinFileName = `${skin.nameEn || skin.name}.zip`.replace(/:/g, '')
          if (
            downloadedSkins.some(
              (ds) => ds.championName === champion.key && ds.skinName === skinFileName
            )
          ) {
            downloaded++
          }
        }
      })
    })
  }

  return { total, downloaded }
})

// Create selector for specific stats
export const downloadedCountAtom = selectAtom(skinStatsAtom, (stats) => stats.downloaded)
export const totalCountAtom = selectAtom(skinStatsAtom, (stats) => stats.total)
