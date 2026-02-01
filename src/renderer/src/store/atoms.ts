import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { ViewMode } from '../components/GridViewToggle'
import type { FilterOptions } from '../components/FilterPanel'
import type { P2PRoom, P2PSettings } from '../../../main/types'

// View mode atom with localStorage persistence
export const viewModeAtom = atomWithStorage<ViewMode>('cslol-view-mode', 'comfortable')

// Filters atom with localStorage persistence
export const filtersAtom = atomWithStorage<FilterOptions>('cslol-filters', {
  downloadStatus: 'all',
  chromaStatus: 'all',
  championTags: [],
  sortBy: 'name-asc',
  rarity: 'all'
})

// Show favorites only atom
export const showFavoritesOnlyAtom = atomWithStorage<boolean>('cslol-show-favorites', false)

// Search queries (not persisted as they should reset on refresh)
export const championSearchQueryAtom = atom<string>('')
export const skinSearchQueryAtom = atom<string>('')

// Selected skins for batch processing
export interface SelectedSkin {
  championKey: string
  championName: string
  championId?: number // Numeric champion ID for ID-based repositories
  skinId: string
  skinName: string
  skinNameEn?: string
  isInLolSkins?: boolean
  skinNum: number
  chromaId?: string
  variantId?: string
  isDownloaded?: boolean
  isAutoSelected?: boolean
  downloadedFilename?: string // Stores the actual filename used when downloading
}

// Auto-synced skin from P2P room member
export interface AutoSyncedSkin extends SelectedSkin {
  fromPeerId: string
  fromPeerName: string
  isAutoSynced: true
  championId?: number // The champion ID this skin is for
  tempFilePath?: string // For downloaded custom mods
}

export const selectedSkinsAtom = atomWithStorage<SelectedSkin[]>('cslol-selected-skins', [])

// Track pre-downloaded auto-selected skins for cleanup
export interface PreDownloadedAutoSkin {
  championKey: string
  championName: string // For file system operations
  skinFileName: string // The actual file name on disk
  downloadUrl: string
}

export const preDownloadedAutoSkinAtom = atom<PreDownloadedAutoSkin | null>(null)

// Temporary auto-synced skins from room members (not persisted)
// Key: peerId, Value: their auto-synced skins
export const autoSyncedSkinsAtom = atom<Map<string, AutoSyncedSkin[]>>(new Map())

// UI state atoms
export const selectedChampionKeyAtom = atomWithStorage<string | null>(
  'cslol-selected-champion',
  null
)
export const filterPanelExpandedAtom = atomWithStorage<boolean>(
  'cslol-filter-panel-expanded',
  false
)
export const selectedSkinsDrawerExpandedAtom = atomWithStorage<boolean>(
  'cslol-selected-skins-drawer-expanded',
  false
)
export const championColumnCollapsedAtom = atomWithStorage<boolean>(
  'cslol-champion-column-collapsed',
  false
)

// Generate random player name
export const generateRandomPlayerName = () => {
  const adjectives = [
    'Swift',
    'Brave',
    'Clever',
    'Noble',
    'Fierce',
    'Bold',
    'Mighty',
    'Silent',
    'Shadow',
    'Storm'
  ]
  const nouns = [
    'Dragon',
    'Phoenix',
    'Wolf',
    'Eagle',
    'Tiger',
    'Lion',
    'Hawk',
    'Fox',
    'Bear',
    'Raven'
  ]
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(Math.random() * 999) + 1
  return `${adj}${noun}${num}`
}

// P2P state atoms
export const p2pRoomAtom = atom<P2PRoom | null>(null)
export const p2pSettingsAtom = atomWithStorage<P2PSettings>('p2p-settings', {
  displayName: 'Player',
  autoSync: false
})
export const p2pConnectionStatusAtom = atom<'disconnected' | 'connecting' | 'connected'>(
  'disconnected'
)

// Chroma data types
export interface Chroma {
  id: number
  name: string
  chromaPath: string
  colors: string[]
}

// Create immutable LRU cache helper
class LRUCache<K, V> {
  private items: Array<[K, V]> = []
  private maxSize: number

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    const index = this.items.findIndex(([k]) => k === key)
    if (index === -1) return undefined

    const [, value] = this.items[index]
    // Move to end (most recently used)
    this.items.splice(index, 1)
    this.items.push([key, value])
    return value
  }

  set(key: K, value: V): LRUCache<K, V> {
    // Return NEW cache instance (immutable)
    const newCache = new LRUCache<K, V>(this.maxSize)

    // Copy existing items (excluding the key if it exists)
    newCache.items = this.items.filter(([k]) => k !== key)

    // Add new item
    newCache.items.push([key, value])

    // Trim if exceeds max
    if (newCache.items.length > this.maxSize) {
      newCache.items.shift() // Remove oldest
    }

    return newCache
  }

  toMap(): Map<K, V> {
    return new Map(this.items)
  }
}

// Global chroma data cache with LRU
export const chromaDataCacheAtom = atom<LRUCache<string, Chroma[]>>(
  new LRUCache<string, Chroma[]>(50)
)

// Derived atom for reading
export const chromaDataAtom = atom(
  (get) => {
    const cache = get(chromaDataCacheAtom)
    return cache.toMap()
  },
  (get, set, update: { key: string; data: Chroma[] }) => {
    const currentCache = get(chromaDataCacheAtom)
    const newCache = currentCache.set(update.key, update.data)
    set(chromaDataCacheAtom, newCache) // Set NEW cache instance
  }
)

export const chromaDataLoadingAtom = atom<Set<string>>(new Set<string>())

// Team composition for smart apply
export const teamCompositionAtom = atom<{
  championIds: number[]
  allLocked: boolean
  inFinalization: boolean
} | null>(null)

// Smart apply settings
export const smartApplyEnabledAtom = atomWithStorage<boolean>('smartApplyEnabled', true)
export const autoApplyEnabledAtom = atomWithStorage<boolean>('autoApplyEnabled', true)
