import { useCallback, useMemo } from 'react'
import { useAtomValue } from 'jotai'
import {
  displaySkinsAtom,
  filteredChampionsAtom,
  allChampionTagsAtom,
  skinStatsAtom,
  downloadedCountAtom,
  totalCountAtom
} from '../store/atoms/computed.atoms'

export const useDisplaySkins = () => {
  return useAtomValue(displaySkinsAtom)
}

export const useFilteredChampions = () => {
  return useAtomValue(filteredChampionsAtom)
}

export const useAllChampionTags = () => {
  return useAtomValue(allChampionTagsAtom)
}

export const useSkinStats = () => {
  return useAtomValue(skinStatsAtom)
}

export const useDownloadedCount = () => {
  return useAtomValue(downloadedCountAtom)
}

export const useTotalCount = () => {
  return useAtomValue(totalCountAtom)
}

// Memoized style objects
export const useStyles = () => {
  return useMemo(
    () => ({
      toastStyle: {
        background: 'var(--color-surface)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border)'
      },
      dropOverlay: {
        className:
          'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 pointer-events-none'
      },
      mainContainer: {
        className:
          'flex flex-col h-screen pt-10 bg-background text-text-primary overflow-hidden transition-colors duration-200'
      },
      toolsModalOverlay: {
        className:
          'fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in'
      },
      toolsModalContent: {
        className:
          'bg-surface rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl dark:shadow-dark-xl animate-slide-down'
      },
      progressBar: {
        className: 'w-full bg-secondary-100 dark:bg-secondary-700 rounded-full h-3 overflow-hidden'
      },
      downloadButton: {
        className:
          'w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-all duration-200 shadow-soft hover:shadow-medium active:scale-[0.98]'
      },
      searchInput: {
        className:
          'flex-1 px-4 py-2.5 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200'
      },
      skinSearchInput: {
        className:
          'flex-1 px-5 py-3 bg-surface border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 shadow-soft dark:shadow-none'
      },
      manageButton: {
        className:
          'px-4 py-2.5 text-sm bg-surface hover:bg-secondary-100 dark:hover:bg-secondary-800 text-text-primary font-medium rounded-lg transition-all duration-200 border border-border hover:border-border-strong shadow-sm hover:shadow-md dark:shadow-none flex items-center gap-2'
      },
      collapseButton: {
        className:
          'px-2 py-2.5 text-sm bg-surface hover:bg-secondary-100 dark:hover:bg-secondary-800 text-text-primary rounded-lg transition-all duration-200 border border-border hover:border-border-strong'
      }
    }),
    []
  )
}

// Memoized className generators
export const useClassNames = () => {
  const getChampionColumnClass = useCallback((collapsed: boolean) => {
    return `${collapsed ? 'w-24' : 'w-80'} bg-elevated border-r-2 border-border flex flex-col shadow-md dark:shadow-none transition-all duration-300 ease-in-out`
  }, [])

  const getChampionHeaderClass = useCallback((collapsed: boolean) => {
    return `${collapsed ? 'p-3' : 'p-6'} flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`
  }, [])

  const getProgressBarFillStyle = useCallback(
    (progress: number) => ({
      width: `${progress}%`
    }),
    []
  )

  return {
    getChampionColumnClass,
    getChampionHeaderClass,
    getProgressBarFillStyle
  }
}

// Stable filter reset object
export const DEFAULT_FILTERS = {
  downloadStatus: 'all' as const,
  chromaStatus: 'all' as const,
  championTags: [] as string[],
  sortBy: 'name-asc' as const,
  rarity: 'all' as const
}
