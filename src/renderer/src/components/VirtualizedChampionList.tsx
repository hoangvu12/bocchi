import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { VariableSizeList as List } from 'react-window'
import type { Champion } from '../App'

interface VirtualizedChampionListProps {
  champions: Champion[]
  selectedChampion: Champion | null
  selectedChampionKey: string | null
  onChampionSelect: (champion: Champion | null, key: string) => void
  height: number
  width: number
}

const VirtualizedChampionListComponent: React.FC<VirtualizedChampionListProps> = ({
  champions,
  selectedChampion,
  selectedChampionKey,
  onChampionSelect,
  height,
  width
}) => {
  const { t } = useTranslation()
  // Group champions by first letter
  const groupedChampions = React.useMemo(() => {
    const items: Array<{ type: 'all' | 'custom' | 'divider' | 'letter' | 'champion'; data?: any }> =
      []

    // Add "All Champions" option
    items.push({ type: 'all' })
    items.push({ type: 'custom' })
    items.push({ type: 'divider' })

    let lastLetter = ''
    champions.forEach((champion) => {
      const firstLetter = champion.name[0].toUpperCase()
      if (firstLetter !== lastLetter) {
        items.push({ type: 'letter', data: firstLetter })
        lastLetter = firstLetter
      }
      items.push({ type: 'champion', data: champion })
    })

    return items
  }, [champions])

  const getItemHeight = (index: number) => {
    const item = groupedChampions[index]
    switch (item.type) {
      case 'all':
      case 'custom':
        return 64 // Height for "All Champions" and "Custom Mods" buttons
      case 'divider':
        return 17 // Height for divider
      case 'letter':
        return 36 // Height for letter header
      case 'champion':
        return 64 // Height for champion item
      default:
        return 0
    }
  }

  const Row = useCallback(
    ({ index, style }) => {
      const item = groupedChampions[index]

      switch (item.type) {
        case 'all':
          return (
            <div style={style}>
              <div
                className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-all duration-200 mx-3 my-1 rounded-lg border-2
                ${
                  selectedChampion === null && selectedChampionKey === 'all'
                    ? 'bg-terracotta-500 text-white shadow-md dark:shadow-dark-soft border-terracotta-600 scale-[1.02]'
                    : 'hover:bg-cream-100 dark:hover:bg-charcoal-800 text-charcoal-800 dark:text-charcoal-200 border-transparent hover:border-charcoal-200 dark:hover:border-charcoal-700'
                }`}
                onClick={() => onChampionSelect(null, 'all')}
              >
                <div className="w-10 h-10 rounded-lg bg-charcoal-200 dark:bg-charcoal-700 flex items-center justify-center">
                  <span className="text-lg font-bold">A</span>
                </div>
                <span className="text-sm font-medium">{t('champion.allChampions')}</span>
              </div>
            </div>
          )

        case 'custom':
          return (
            <div style={style}>
              <div
                className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-all duration-200 mx-3 my-1 rounded-lg border-2
                ${
                  selectedChampion === null && selectedChampionKey === 'custom'
                    ? 'bg-terracotta-500 text-white shadow-md dark:shadow-dark-soft border-terracotta-600 scale-[1.02]'
                    : 'hover:bg-cream-100 dark:hover:bg-charcoal-800 text-charcoal-800 dark:text-charcoal-200 border-transparent hover:border-charcoal-200 dark:hover:border-charcoal-700'
                }`}
                onClick={() => onChampionSelect(null, 'custom')}
              >
                <div className="w-10 h-10 rounded-lg bg-charcoal-200 dark:bg-charcoal-700 flex items-center justify-center">
                  <span className="text-lg font-bold">C</span>
                </div>
                <span className="text-sm font-medium">{t('champion.customMods')}</span>
              </div>
            </div>
          )

        case 'divider':
          return (
            <div style={style}>
              <div className="mx-6 my-2 border-b border-charcoal-200 dark:border-charcoal-700"></div>
            </div>
          )

        case 'letter':
          return (
            <div style={style}>
              <div className="px-6 py-3 text-xs font-bold text-charcoal-700 dark:text-charcoal-400 uppercase tracking-wider">
                {item.data}
              </div>
            </div>
          )

        case 'champion': {
          const champion = item.data as Champion
          return (
            <div style={style}>
              <div
                className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-all duration-200 mx-3 my-1 rounded-lg border-2
                ${
                  selectedChampion?.key === champion.key
                    ? 'bg-terracotta-500 text-white shadow-md dark:shadow-dark-soft border-terracotta-600 scale-[1.02]'
                    : 'hover:bg-cream-100 dark:hover:bg-charcoal-800 text-charcoal-800 dark:text-charcoal-200 border-transparent hover:border-charcoal-200 dark:hover:border-charcoal-700'
                }`}
                onClick={() => onChampionSelect(champion, champion.key)}
              >
                <img
                  src={champion.image}
                  alt={champion.name}
                  className="w-10 h-10 rounded-lg"
                  loading="lazy"
                />
                <span className="text-sm font-medium">{champion.name}</span>
              </div>
            </div>
          )
        }

        default:
          return null
      }
    },
    [groupedChampions, selectedChampion, selectedChampionKey, t, onChampionSelect]
  )

  // Calculate total height based on dynamic item heights
  const totalHeight = groupedChampions.reduce((sum, _, index) => sum + getItemHeight(index), 0)

  return (
    <List
      height={Math.min(height, totalHeight)}
      itemCount={groupedChampions.length}
      itemSize={getItemHeight}
      width={width}
      className="scrollbar-thin scrollbar-thumb-charcoal-300 dark:scrollbar-thumb-charcoal-700 scrollbar-track-transparent"
      style={{ overflow: 'auto' }}
    >
      {Row}
    </List>
  )
}

// Add display name for debugging
VirtualizedChampionListComponent.displayName = 'VirtualizedChampionList'

// Export memoized component
export const VirtualizedChampionList = React.memo(VirtualizedChampionListComponent)
