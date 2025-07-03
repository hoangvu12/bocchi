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
  sortBy: 'name-asc'
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
  skinId: string
  skinName: string
  skinNameEn?: string
  skinNum: number
  chromaId?: string
  isDownloaded?: boolean
}

export const selectedSkinsAtom = atomWithStorage<SelectedSkin[]>('cslol-selected-skins', [])

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

// Global chroma data cache
export const chromaDataAtom = atom<Record<string, Chroma[]>>({})
export const chromaDataLoadingAtom = atom<Set<string>>(new Set<string>())
