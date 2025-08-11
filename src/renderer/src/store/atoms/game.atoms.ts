import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

// Game path atom with persistence
export const gamePathAtom = atomWithStorage<string>('gamePath', '')

// Tools management atoms
export const toolsExistAtom = atom<boolean | null>(null)
export const downloadingToolsAtom = atom<boolean>(false)
export const toolsDownloadProgressAtom = atom<number>(0)
export const toolsErrorAtom = atom<{
  type: 'network' | 'github' | 'filesystem' | 'extraction' | 'validation' | 'unknown'
  message: string
  details?: string
  canRetry: boolean
} | null>(null)
export const downloadAttemptsAtom = atom<number>(0)
export const downloadSpeedAtom = atom<number>(0)
export const downloadSizeAtom = atom<{ loaded: number; total: number }>({ loaded: 0, total: 0 })

// Patcher status atoms
export const isPatcherRunningAtom = atom<boolean>(false)

// Status message atoms
export const statusMessageAtom = atom<string>('')
export const errorMessageAtom = atom<string>('')

// Loading states atoms
export const loadingStatesAtom = atom({
  isLoadingChampionData: false,
  isApplyingSkins: false,
  isDeletingSkin: false,
  isStoppingPatcher: false,
  isUpdatingChampionData: false,
  isCancellingApply: false
})

// Derived atom for overall loading state
export const isLoadingAtom = atom((get) => {
  const states = get(loadingStatesAtom)
  return Object.values(states).some((state) => state)
})

// Active operation tracking
export const activeOperationAtom = atom<string | null>(null)

// App version atom
export const appVersionAtom = atom<string>('')

// Update dialog atom
export const showUpdateDialogAtom = atom<boolean>(false)
