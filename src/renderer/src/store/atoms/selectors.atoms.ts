import { atom } from 'jotai'
import {
  appVersionAtom,
  errorMessageAtom,
  statusMessageAtom,
  isLoadingAtom,
  showUpdateDialogAtom
} from './game.atoms'
import { showChampionDataUpdateAtom } from './champion.atoms'
import {
  isDraggingAtom,
  showEditDialogAtom,
  editingCustomSkinAtom,
  showDownloadedSkinsDialogAtom,
  showSettingsDialogAtom
} from './ui.atoms'
import {
  lcuSelectedChampionAtom,
  isChampionLockedAtom,
  autoViewSkinsEnabledAtom
} from './lcu.atoms'

// Batch app state reads
export const appStateSelector = atom((get) => ({
  appVersion: get(appVersionAtom),
  errorMessage: get(errorMessageAtom),
  statusMessage: get(statusMessageAtom),
  isLoading: get(isLoadingAtom),
  showUpdateDialog: get(showUpdateDialogAtom),
  showChampionDataUpdate: get(showChampionDataUpdateAtom)
}))

// Batch UI state reads
export const uiStateSelector = atom((get) => ({
  isDragging: get(isDraggingAtom),
  showEditDialog: get(showEditDialogAtom),
  editingCustomSkin: get(editingCustomSkinAtom),
  showDownloadedSkinsDialog: get(showDownloadedSkinsDialogAtom),
  showSettingsDialog: get(showSettingsDialogAtom)
}))

// Batch LCU state reads
export const lcuStateSelector = atom((get) => ({
  lcuSelectedChampion: get(lcuSelectedChampionAtom),
  isChampionLocked: get(isChampionLockedAtom),
  autoViewSkinsEnabled: get(autoViewSkinsEnabledAtom)
}))
