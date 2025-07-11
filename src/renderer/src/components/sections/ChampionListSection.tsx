import { useCallback } from 'react'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import AutoSizer from 'react-virtualized-auto-sizer'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { VirtualizedChampionList } from '../VirtualizedChampionList'
import {
  championSearchQueryAtom,
  championColumnCollapsedAtom,
  selectedChampionKeyAtom
} from '../../store/atoms'
import { selectedChampionAtom } from '../../store/atoms/champion.atoms'
import { useFilteredChampions, useStyles, useClassNames } from '../../hooks/useOptimizedState'
import { useChampionData } from '../../hooks/useChampionData'
import type { Champion } from '../../App'

export function ChampionListSection() {
  const { t } = useTranslation()
  const { championData } = useChampionData()
  const [championSearchQuery, setChampionSearchQuery] = useAtom(championSearchQueryAtom)
  const [championColumnCollapsed, setChampionColumnCollapsed] = useAtom(championColumnCollapsedAtom)
  const [selectedChampion, setSelectedChampion] = useAtom(selectedChampionAtom)
  const [selectedChampionKey, setSelectedChampionKey] = useAtom(selectedChampionKeyAtom)

  const filteredChampions = useFilteredChampions()
  const styles = useStyles()
  const { getChampionColumnClass, getChampionHeaderClass } = useClassNames()

  const handleChampionSelect = useCallback(
    (champion: Champion | null, key: string) => {
      setSelectedChampion(champion)
      setSelectedChampionKey(key)
    },
    [setSelectedChampion, setSelectedChampionKey]
  )

  if (!championData) return null

  return (
    <div className={getChampionColumnClass(championColumnCollapsed)}>
      <div className={getChampionHeaderClass(championColumnCollapsed)}>
        {!championColumnCollapsed && (
          <input
            type="text"
            placeholder={t('champion.searchPlaceholder')}
            value={championSearchQuery}
            onChange={(e) => setChampionSearchQuery(e.target.value)}
            className={styles.searchInput.className}
          />
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
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <AutoSizer>
          {({ width, height }) => (
            <VirtualizedChampionList
              key={championColumnCollapsed ? 'collapsed' : 'expanded'}
              champions={filteredChampions}
              selectedChampion={selectedChampion}
              selectedChampionKey={selectedChampionKey}
              onChampionSelect={handleChampionSelect}
              height={height}
              width={width}
              isCollapsed={championColumnCollapsed}
            />
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
