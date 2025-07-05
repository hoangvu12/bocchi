import React from 'react'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { filterPanelExpandedAtom } from '../store/atoms'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

export type SortOption = 'name-asc' | 'name-desc' | 'skin-asc' | 'skin-desc' | 'champion'
export type DownloadFilter = 'all' | 'downloaded' | 'not-downloaded'
export type ChromaFilter = 'all' | 'has-chromas' | 'no-chromas'

export interface FilterOptions {
  downloadStatus: DownloadFilter
  chromaStatus: ChromaFilter
  championTags: string[]
  sortBy: SortOption
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

  const updateFilter = <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const toggleTag = (tag: string) => {
    const newTags = filters.championTags.includes(tag)
      ? filters.championTags.filter((t) => t !== tag)
      : [...filters.championTags, tag]
    updateFilter('championTags', newTags)
  }

  const hasActiveFilters =
    filters.downloadStatus !== 'all' ||
    filters.chromaStatus !== 'all' ||
    filters.championTags.length > 0 ||
    filters.sortBy !== 'name-asc'

  return (
    <div className="bg-surface border-b-2 border-border transition-all duration-300">
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
          <div className="mt-6 space-y-6 animate-slide-down">
            {/* Download Status */}
            <div>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                {t('filters.downloadStatus')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {(['all', 'downloaded', 'not-downloaded'] as DownloadFilter[]).map((status) => (
                  <Button
                    key={status}
                    variant={filters.downloadStatus === status ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => updateFilter('downloadStatus', status)}
                    className={
                      filters.downloadStatus === status ? 'bg-primary-500 hover:bg-primary-600' : ''
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
            </div>

            {/* Chroma Status */}
            <div>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                {t('filters.chromas')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {(['all', 'has-chromas', 'no-chromas'] as ChromaFilter[]).map((status) => (
                  <Button
                    key={status}
                    variant={filters.chromaStatus === status ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => updateFilter('chromaStatus', status)}
                    className={
                      filters.chromaStatus === status ? 'bg-primary-500 hover:bg-primary-600' : ''
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
            </div>

            {/* Champion Tags */}
            <div>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                {t('filters.championType')}
              </h3>
              <div className="flex flex-wrap gap-2">
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
            </div>

            {/* Sort Options */}
            <div>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                {t('filters.sortBy')}
              </h3>
              <div className="flex flex-wrap gap-2">
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
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
