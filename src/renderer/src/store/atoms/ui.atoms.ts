import { atom } from 'jotai'

// Dialog visibility atoms
export const showUpdateDialogAtom = atom<boolean>(false)
export const showEditDialogAtom = atom<boolean>(false)
export const showDownloadedSkinsDialogAtom = atom<boolean>(false)
export const showSettingsDialogAtom = atom<boolean>(false)

// Edit dialog state
export const editingCustomSkinAtom = atom<{ path: string; name: string; champion?: string } | null>(
  null
)

// Drag and drop atoms
export const isDraggingAtom = atom<boolean>(false)
