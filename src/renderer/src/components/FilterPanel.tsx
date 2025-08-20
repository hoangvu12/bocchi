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
  resultsCount: number
  onClearFilters: () => void
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
  availableTags,
  downloadedCount,
  totalCount,
  resultsCount,
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
  const [tagSearch, setTagSearch] = useState('')
  const [showAllTags, setShowAllTags] = useState(false)

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

  // Build active filter chips
  const activeFilterChips: Array<{ key: string; label: string; remove: () => void }> = []

  if (filters.downloadStatus !== 'all') {
    activeFilterChips.push({
      key: 'downloadStatus',
      label:
        filters.downloadStatus === 'downloaded'
          ? t('filters.downloaded')
          : t('filters.notDownloaded'),
      remove: () => updateFilter('downloadStatus', 'all')
    })
  }

  if (filters.chromaStatus !== 'all') {
    activeFilterChips.push({
      key: 'chromaStatus',
      label:
        filters.chromaStatus === 'has-chromas' ? t('filters.hasChromas') : t('filters.noChromas'),
      remove: () => updateFilter('chromaStatus', 'all')
    })
  }

  if (filters.rarity !== 'all') {
    activeFilterChips.push({
      key: 'rarity',
      label: t(`filters.rarities.${filters.rarity.replace('k', '').toLowerCase()}`),
      remove: () => updateFilter('rarity', 'all')
    })
  }

  filters.championTags.forEach((tag) =>
    activeFilterChips.push({
      key: `tag_${tag}`,
      label: tag,
      remove: () => toggleTag(tag)
    })
  )

  // Filter & slice tags for display
  const filteredTags = availableTags.filter((tag) =>
    tag.toLowerCase().includes(tagSearch.toLowerCase())
  )
  const TAG_INITIAL_LIMIT = 18
  const visibleTags =
    showAllTags || tagSearch ? filteredTags : filteredTags.slice(0, TAG_INITIAL_LIMIT)

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

          <div className="flex items-center gap-4 text-sm text-text-secondary flex-wrap">
            <span className="whitespace-nowrap">
              {downloadedCount} / {totalCount} {t('skin.downloaded').toLowerCase()}
            </span>
            <span className="whitespace-nowrap">
              {resultsCount === 1
                ? t('skin.showing_one', { count: resultsCount })
                : t('skin.showing_other', { count: resultsCount })}
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

        {/* Active filter chips summary (always visible when any filters active) */}
        {hasActiveFilters && activeFilterChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                onClick={chip.remove}
                className="group inline-flex items-center gap-1 rounded-sm bg-secondary-100/70 dark:bg-secondary-800/60 border border-border/60 hover:bg-secondary-200 dark:hover:bg-secondary-700 hover:border-border/80 px-2 py-[3px] text-[11px] font-medium text-text-tertiary hover:text-text-secondary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-border/70"
                title="Remove filter"
              >
                <span className="truncate max-w-[9rem]">{chip.label}</span>
                <svg
                  className="w-3 h-3 opacity-55 group-hover:opacity-80 transition-opacity"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                <span className="sr-only">Remove {chip.label}</span>
              </button>
            ))}
            <button
              onClick={onClearFilters}
              className="inline-flex items-center rounded-sm px-2 py-[3px] text-[11px] font-medium text-text-muted hover:text-text-secondary hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-border/60"
            >
              {t('actions.clearFilters')}
            </button>
          </div>
        )}

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
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder="Search tags..."
                        className="w-full sm:w-64 px-3 py-1.5 text-xs rounded-md border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      {!showAllTags && filteredTags.length > TAG_INITIAL_LIMIT && !tagSearch && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAllTags(true)}
                          className="text-xs"
                        >
                          + {filteredTags.length - TAG_INITIAL_LIMIT} more
                        </Button>
                      )}
                      {showAllTags && filteredTags.length > TAG_INITIAL_LIMIT && !tagSearch && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAllTags(false)}
                          className="text-xs"
                        >
                          Collapse
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {visibleTags.map((tag) => (
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
                      {visibleTags.length === 0 && (
                        <span className="text-xs text-text-muted italic px-1.5 py-0.5">
                          No tags
                        </span>
                      )}
                    </div>
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
