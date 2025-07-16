import React, { useState } from 'react'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { filterPanelExpandedAtom } from '../store/atoms'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

export type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'skin-asc'
  | 'skin-desc'
  | 'champion'
  | 'rarity-asc'
  | 'rarity-desc'
  | 'winrate-asc'
  | 'winrate-desc'
  | 'pickrate-asc'
  | 'pickrate-desc'
  | 'totalgames-asc'
  | 'totalgames-desc'
export type DownloadFilter = 'all' | 'downloaded' | 'not-downloaded'
export type ChromaFilter = 'all' | 'has-chromas' | 'no-chromas'
export type RarityFilter =
  | 'all'
  | 'kEpic'
  | 'kLegendary'
  | 'kUltimate'
  | 'kMythic'
  | 'kTranscendent'
  | 'kExalted'

export interface FilterOptions {
  downloadStatus: DownloadFilter
  chromaStatus: ChromaFilter
  championTags: string[]
  sortBy: SortOption
  rarity: RarityFilter
}

interface FilterPanelProps {
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  availableTags: string[]
  downloadedCount: number
  totalCount: number
  onClearFilters: () => void
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
  availableTags,
  downloadedCount,
  totalCount,
  onClearFilters
}) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useAtom(filterPanelExpandedAtom)
  const [expandedSections, setExpandedSections] = useState({
    downloadStatus: true,
    chromaStatus: true,
    rarity: true,
    championTags: true,
    sortBy: true
  })

  const updateFilter = <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const toggleTag = (tag: string) => {
    const newTags = filters.championTags.includes(tag)
      ? filters.championTags.filter((t) => t !== tag)
      : [...filters.championTags, tag]
    updateFilter('championTags', newTags)
  }

  const toggleSection = (sectionKey: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }))
  }

  const SectionHeader: React.FC<{ title: string; isExpanded: boolean; onToggle: () => void }> = ({
    title,
    isExpanded,
    onToggle
  }) => (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full text-left focus:outline-none group"
    >
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
        {title}
      </h3>
      <svg
        className={`w-3 h-3 text-text-secondary transition-transform group-hover:text-text-primary ${
          isExpanded ? 'rotate-180' : ''
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )

  const hasActiveFilters =
    filters.downloadStatus !== 'all' ||
    filters.chromaStatus !== 'all' ||
    filters.championTags.length > 0 ||
    filters.sortBy !== 'name-asc' ||
    filters.rarity !== 'all'

  return (
    <div className="relative bg-surface border-b-2 border-border transition-all duration-300">
      <div className="px-8 py-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-medium bg-surface border border-border rounded-lg px-4 py-2.5 hover:bg-secondary-100 dark:hover:bg-secondary-800"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
            <span>{t('filters.title')}</span>
            {hasActiveFilters && (
              <Badge variant="default" className="bg-primary-500 hover:bg-primary-600 text-white">
                {t('filters.active')}
              </Badge>
            )}
          </Button>

          <div className="flex items-center gap-4 text-sm text-text-secondary">
            <span>
              {downloadedCount} / {totalCount} {t('skin.downloaded').toLowerCase()}
            </span>
            {hasActiveFilters && (
              <Button
                variant="link"
                onClick={onClearFilters}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium h-auto p-0"
              >
                {t('actions.clearFilters')}
              </Button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="absolute top-full left-0 right-0 z-10 bg-surface border-b-2 border-border shadow-lg max-h-[60vh] sm:max-h-[70vh] lg:max-h-[75vh] overflow-y-auto">
            <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-slide-down">
              {/* Download Status */}
              <div>
                <div className="mb-2 sm:mb-3">
                  <SectionHeader
                    title={t('filters.downloadStatus')}
                    isExpanded={expandedSections.downloadStatus}
                    onToggle={() => toggleSection('downloadStatus')}
                  />
                </div>
                {expandedSections.downloadStatus && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {(['all', 'downloaded', 'not-downloaded'] as DownloadFilter[]).map((status) => (
                      <Button
                        key={status}
                        variant={filters.downloadStatus === status ? 'default' : 'secondary'}
                        size="sm"
                        onClick={() => updateFilter('downloadStatus', status)}
                        className={
                          filters.downloadStatus === status
                            ? 'bg-primary-500 hover:bg-primary-600'
                            : ''
                        }
                      >
                        {status === 'all'
                          ? t('filters.all')
                          : status === 'downloaded'
                            ? t('filters.downloaded')
                            : t('filters.notDownloaded')}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Chroma Status */}
              <div>
                <div className="mb-2 sm:mb-3">
                  <SectionHeader
                    title={t('filters.chromas')}
                    isExpanded={expandedSections.chromaStatus}
                    onToggle={() => toggleSection('chromaStatus')}
                  />
                </div>
                {expandedSections.chromaStatus && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {(['all', 'has-chromas', 'no-chromas'] as ChromaFilter[]).map((status) => (
                      <Button
                        key={status}
                        variant={filters.chromaStatus === status ? 'default' : 'secondary'}
                        size="sm"
                        onClick={() => updateFilter('chromaStatus', status)}
                        className={
                          filters.chromaStatus === status
                            ? 'bg-primary-500 hover:bg-primary-600'
                            : ''
                        }
                      >
                        {status === 'all'
                          ? t('filters.all')
                          : status === 'has-chromas'
                            ? t('filters.hasChromas')
                            : t('filters.noChromas')}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Rarity Filter */}
              <div>
                <div className="mb-2 sm:mb-3">
                  <SectionHeader
                    title={t('filters.rarity')}
                    isExpanded={expandedSections.rarity}
                    onToggle={() => toggleSection('rarity')}
                  />
                </div>
                {expandedSections.rarity && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {(
                      [
                        'all',
                        'kEpic',
                        'kLegendary',
                        'kUltimate',
                        'kMythic',
                        'kTranscendent',
                        'kExalted'
                      ] as RarityFilter[]
                    ).map((rarity) => (
                      <Button
                        key={rarity}
                        variant={filters.rarity === rarity ? 'default' : 'secondary'}
                        size="sm"
                        onClick={() => updateFilter('rarity', rarity)}
                        className={
                          filters.rarity === rarity ? 'bg-primary-500 hover:bg-primary-600' : ''
                        }
                      >
                        {rarity === 'all'
                          ? t('filters.all')
                          : t(`filters.rarities.${rarity.replace('k', '').toLowerCase()}`)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Champion Tags */}
              <div>
                <div className="mb-2 sm:mb-3">
                  <SectionHeader
                    title={t('filters.championType')}
                    isExpanded={expandedSections.championTags}
                    onToggle={() => toggleSection('championTags')}
                  />
                </div>
                {expandedSections.championTags && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {availableTags.map((tag) => (
                      <Button
                        key={tag}
                        variant={filters.championTags.includes(tag) ? 'default' : 'secondary'}
                        size="sm"
                        onClick={() => toggleTag(tag)}
                        className={
                          filters.championTags.includes(tag)
                            ? 'bg-primary-500 hover:bg-primary-600'
                            : ''
                        }
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sort Options */}
              <div>
                <div className="mb-2 sm:mb-3">
                  <SectionHeader
                    title={t('filters.sortBy')}
                    isExpanded={expandedSections.sortBy}
                    onToggle={() => toggleSection('sortBy')}
                  />
                </div>
                {expandedSections.sortBy && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <Select
                      value={filters.sortBy}
                      onValueChange={(value) => updateFilter('sortBy', value as SortOption)}
                    >
                      <SelectTrigger className="w-[200px] bg-surface border-border text-text-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-surface border-border">
                        <SelectItem
                          value="name-asc"
                          className="text-text-primary focus:bg-secondary-100 dark:focus:bg-secondary-800"
                        >
                          {t('filters.nameAsc')}
                        </SelectItem>
                        <SelectItem
                          value="name-desc"
                          className="text-text-primary focus:bg-secondary-100 dark:focus:bg-secondary-800"
                        >
                          {t('filters.nameDesc')}
                        </SelectItem>
                        <SelectItem
                          value="skin-asc"
                          className="text-text-primary focus:bg-secondary-100 dark:focus:bg-secondary-800"
                        >
                          {t('filters.skinNumAsc')}
                        </SelectItem>
                        <SelectItem
                          value="skin-desc"
                          className="text-text-primary focus:bg-secondary-100 dark:focus:bg-secondary-800"
                        >
                          {t('filters.skinNumDesc')}
                        </SelectItem>
                        <SelectItem
                          value="champion"
                          className="text-text-primary focus:bg-secondary-100 dark:focus:bg-secondary-800"
                        >
                          {t('filters.championName')}
                        </SelectItem>
                        <SelectItem
                          value="rarity-asc"
                          className="text-text-primary focus:bg-secondary-100 dark:focus:bg-secondary-800"
                        >
                          {t('filters.rarityAsc')}
                        </SelectItem>
                        <SelectItem
                          value="rarity-desc"
                          className="text-text-primary focus:bg-secondary-100 dark:focus:bg-secondary-800"
                        >
                          {t('filters.rarityDesc')}
                        </SelectItem>
                        <SelectItem
                          value="winrate-desc"
                          className="text-text-primary focus:bg-secondary-100 dark:focus:bg-secondary-800"
                        >
                          {t('filters.winRateDesc')}
                        </SelectItem>
                        <SelectItem
                          value="winrate-asc"
                          className="text-text-primary focus:bg-secondary-100 dark:focus:bg-secondary-800"
                        >
                          {t('filters.winRateAsc')}
                        </SelectItem>
                        <SelectItem
                          value="pickrate-desc"
                          className="text-text-primary focus:bg-secondary-100 dark:focus:bg-secondary-800"
                        >
                          {t('filters.pickRateDesc')}
                        </SelectItem>
                        <SelectItem
                          value="pickrate-asc"
                          className="text-text-primary focus:bg-secondary-100 dark:focus:bg-secondary-800"
                        >
                          {t('filters.pickRateAsc')}
                        </SelectItem>
                        <SelectItem
                          value="totalgames-desc"
                          className="text-text-primary focus:bg-secondary-100 dark:focus:bg-secondary-800"
                        >
                          {t('filters.totalGamesDesc')}
                        </SelectItem>
                        <SelectItem
                          value="totalgames-asc"
                          className="text-text-primary focus:bg-secondary-100 dark:focus:bg-secondary-800"
                        >
                          {t('filters.totalGamesAsc')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
