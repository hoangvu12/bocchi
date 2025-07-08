import { atom } from 'jotai'
import type { Champion } from '../../App'

export interface ChampionData {
  version: string
  lastUpdated: string
  champions: Champion[]
}

// Champion data atom
export const championDataAtom = atom<ChampionData | null>(null)

// Selected champion atom
export const selectedChampionAtom = atom<Champion | null>(null)

// Show champion data update dialog
export const showChampionDataUpdateAtom = atom<boolean>(false)
