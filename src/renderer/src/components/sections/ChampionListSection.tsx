import { useCallback, useRef, useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import AutoSizer from 'react-virtualized-auto-sizer'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  VirtualizedChampionList,
  type VirtualizedChampionListRef
} from '../VirtualizedChampionList'
import { AlphabetGrid } from '../AlphabetGrid'
import {
  championSearchQueryAtom,
  championColumnCollapsedAtom,
  selectedChampionKeyAtom
} from '../../store/atoms'
import { selectedChampionAtom } from '../../store/atoms/champion.atoms'
import { useFilteredChampions, useStyles, useClassNames } from '../../hooks/useOptimizedState'
import { useChampionData } from '../../hooks/useChampionData'
import { cn } from '../../lib/utils'
import type { Champion } from '../../App'

export function ChampionListSection() {
  const { t } = useTranslation()
  const { championData } = useChampionData()
  const [championSearchQuery, setChampionSearchQuery] = useAtom(championSearchQueryAtom)
  const [championColumnCollapsed, setChampionColumnCollapsed] = useAtom(championColumnCollapsedAtom)
  const [selectedChampion, setSelectedChampion] = useAtom(selectedChampionAtom)
  const [selectedChampionKey, setSelectedChampionKey] = useAtom(selectedChampionKeyAtom)
  const [availableLetters, setAvailableLetters] = useState<Set<string>>(new Set())
  const [showAlphabetGrid, setShowAlphabetGrid] = useState(false)

  const filteredChampions = useFilteredChampions()
  const styles = useStyles()
  const { getChampionColumnClass, getChampionHeaderClass } = useClassNames()
  const listRef = useRef<VirtualizedChampionListRef>(null)

  const handleChampionSelect = useCallback(
    (champion: Champion | null, key: string) => {
      setSelectedChampion(champion)
      setSelectedChampionKey(key)
    },
    [setSelectedChampion, setSelectedChampionKey]
  )

  const handleLetterClick = useCallback((letter: string) => {
    listRef.current?.scrollToLetter(letter)
  }, [])

  // Update available letters when champions change
  useEffect(() => {
    if (listRef.current) {
      setAvailableLetters(listRef.current.getAvailableLetters())
    }
  }, [filteredChampions])

  if (!championData) return null

  return (
    <div className={getChampionColumnClass(championColumnCollapsed)}>
      <div className={getChampionHeaderClass(championColumnCollapsed)}>
        {!championColumnCollapsed && (
          <>
            <input
              type="text"
              placeholder={t('champion.searchPlaceholder')}
              value={championSearchQuery}
              onChange={(e) => setChampionSearchQuery(e.target.value)}
              className={styles.searchInput.className}
            />
            <button
              onClick={() => setShowAlphabetGrid(!showAlphabetGrid)}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all flex-shrink-0',
                'bg-secondary-100 dark:bg-secondary-800',
                'hover:bg-secondary-200 dark:hover:bg-secondary-700',
                'text-xs font-bold text-text-primary',
                showAlphabetGrid && 'bg-primary-500 text-white hover:bg-primary-600'
              )}
              title="Jump to letter (A-Z)"
            >
              A-Z
            </button>
          </>
        )}
        <button
          onClick={() => setChampionColumnCollapsed(!championColumnCollapsed)}
          className={styles.collapseButton.className}
          title={championColumnCollapsed ? 'Expand champion list' : 'Collapse champion list'}
        >
          {championColumnCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
      <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
        <AutoSizer>
          {({ width, height }) => (
            <>
              <VirtualizedChampionList
                ref={listRef}
                key={championColumnCollapsed ? 'collapsed' : 'expanded'}
                champions={filteredChampions}
                selectedChampion={selectedChampion}
                selectedChampionKey={selectedChampionKey}
                onChampionSelect={handleChampionSelect}
                height={height}
                width={width}
                isCollapsed={championColumnCollapsed}
              />
              {!championColumnCollapsed && showAlphabetGrid && (
                <AlphabetGrid
                  availableLetters={availableLetters}
                  onLetterClick={handleLetterClick}
                  onClose={() => setShowAlphabetGrid(false)}
                  className="absolute left-1/2 top-4 -translate-x-1/2 z-20"
                />
              )}
            </>
          )}
        </AutoSizer>
      </div>
      {championData && !championColumnCollapsed && (
        <div className="px-6 py-4 text-xs text-text-muted border-t-2 border-border bg-surface">
          <div>Champion data: v{championData.version}</div>
        </div>
      )}
    </div>
  )
}
