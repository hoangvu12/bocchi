import { atom } from 'jotai'
import type { Champion } from '../../App'

// League Client connection state
export const lcuConnectedAtom = atom<boolean>(false)
export const isInChampSelectAtom = atom<boolean>(false)
export const lcuSelectedChampionAtom = atom<Champion | null>(null)
export const isChampionLockedAtom = atom<boolean>(false)

// Auto-features atoms
export const autoViewSkinsEnabledAtom = atom<boolean>(false)
export const autoRandomRaritySkinEnabledAtom = atom<boolean>(false)
export const autoRandomFavoriteSkinEnabledAtom = atom<boolean>(false)
export const autoAcceptEnabledAtom = atom<boolean>(false)
