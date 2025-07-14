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
export const autoRandomHighestWinRateSkinEnabledAtom = atom<boolean>(false)
export const autoRandomHighestPickRateSkinEnabledAtom = atom<boolean>(false)
export const autoRandomMostPlayedSkinEnabledAtom = atom<boolean>(false)
export const autoAcceptEnabledAtom = atom<boolean>(false)

// Auto Ban/Pick atoms
export const autoPickEnabledAtom = atom<boolean>(false)
export const autoPickForceAtom = atom<boolean>(false)
export const autoPickChampionsAtom = atom<number[]>([])

export const autoBanEnabledAtom = atom<boolean>(false)
export const autoBanForceAtom = atom<boolean>(false)
export const autoBanChampionsAtom = atom<number[]>([])

// Current game queue ID - persists from champ select through the game
export const currentQueueIdAtom = atom<number | null>(null)
