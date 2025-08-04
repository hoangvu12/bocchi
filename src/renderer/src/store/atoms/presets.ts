import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { Preset } from '../../../../main/types/preset'

// List of all presets
export const presetsAtom = atom<Preset[]>([])

// Currently selected/active preset ID
export const selectedPresetIdAtom = atomWithStorage<string | null>('selected-preset-id', null)

// UI state atoms
export const presetDialogOpenAtom = atom(false)
export const presetSaveDialogOpenAtom = atom(false)
export const presetEditDialogOpenAtom = atom(false)
export const editingPresetIdAtom = atom<string | null>(null)

// Derived atoms
export const selectedPresetAtom = atom((get) => {
  const presets = get(presetsAtom)
  const selectedId = get(selectedPresetIdAtom)
  return presets.find((p) => p.id === selectedId) || null
})

export const presetCountAtom = atom((get) => get(presetsAtom).length)

// Loading states
export const presetsLoadingAtom = atom(false)
export const presetActionLoadingAtom = atom(false)
