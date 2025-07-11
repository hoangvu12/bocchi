import { atom } from 'jotai'

// Settings atoms
export const leagueClientEnabledAtom = atom<boolean>(true)
export const championDetectionEnabledAtom = atom<boolean>(true)
export const smartApplyEnabledAtom = atom<boolean>(true)
export const autoApplyEnabledAtom = atom<boolean>(true)
export const autoApplyTriggerTimeAtom = atom<number>(15)
export const p2pAutoSyncEnabledAtom = atom<boolean>(true)
