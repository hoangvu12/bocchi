import React from 'react'
import { useAtom } from 'jotai'
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
    <div className="bg-white dark:bg-charcoal-900 border-b-2 border-charcoal-200 dark:border-charcoal-800 transition-all duration-300">
      <div className="px-8 py-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-medium"
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
            <span>Filters & Sort</span>
            {hasActiveFilters && (
              <Badge
                variant="default"
                className="bg-terracotta-500 hover:bg-terracotta-600 text-white"
              >
                Active
              </Badge>
            )}
          </Button>

          <div className="flex items-center gap-4 text-sm text-charcoal-600 dark:text-charcoal-400">
            <span>
              {downloadedCount} / {totalCount} downloaded
            </span>
            {hasActiveFilters && (
              <Button
                variant="link"
                onClick={onClearFilters}
                className="text-terracotta-600 dark:text-terracotta-400 hover:text-terracotta-700 dark:hover:text-terracotta-300 font-medium h-auto p-0"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-6 space-y-6 animate-slide-down">
            {/* Download Status */}
            <div>
              <h3 className="text-xs font-semibold text-charcoal-700 dark:text-charcoal-300 uppercase tracking-wider mb-3">
                Download Status
              </h3>
              <div className="flex flex-wrap gap-2">
                {(['all', 'downloaded', 'not-downloaded'] as DownloadFilter[]).map((status) => (
                  <Button
                    key={status}
                    variant={filters.downloadStatus === status ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => updateFilter('downloadStatus', status)}
                    className={
                      filters.downloadStatus === status
                        ? 'bg-terracotta-500 hover:bg-terracotta-600'
                        : ''
                    }
                  >
                    {status === 'all'
                      ? 'All'
                      : status === 'downloaded'
                        ? 'Downloaded'
                        : 'Not Downloaded'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Chroma Status */}
            <div>
              <h3 className="text-xs font-semibold text-charcoal-700 dark:text-charcoal-300 uppercase tracking-wider mb-3">
                Chromas
              </h3>
              <div className="flex flex-wrap gap-2">
                {(['all', 'has-chromas', 'no-chromas'] as ChromaFilter[]).map((status) => (
                  <Button
                    key={status}
                    variant={filters.chromaStatus === status ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => updateFilter('chromaStatus', status)}
                    className={
                      filters.chromaStatus === status
                        ? 'bg-terracotta-500 hover:bg-terracotta-600'
                        : ''
                    }
                  >
                    {status === 'all'
                      ? 'All'
                      : status === 'has-chromas'
                        ? 'Has Chromas'
                        : 'No Chromas'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Champion Tags */}
            <div>
              <h3 className="text-xs font-semibold text-charcoal-700 dark:text-charcoal-300 uppercase tracking-wider mb-3">
                Champion Type
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
                        ? 'bg-terracotta-500 hover:bg-terracotta-600'
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
              <h3 className="text-xs font-semibold text-charcoal-700 dark:text-charcoal-300 uppercase tracking-wider mb-3">
                Sort By
              </h3>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => updateFilter('sortBy', value as SortOption)}
                >
                  <SelectTrigger className="w-[200px] bg-cream-100 dark:bg-charcoal-800 border-charcoal-200 dark:border-charcoal-700 text-charcoal-700 dark:text-charcoal-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-charcoal-800 border-charcoal-200 dark:border-charcoal-700">
                    <SelectItem
                      value="name-asc"
                      className="text-charcoal-700 dark:text-charcoal-200 focus:bg-cream-100 dark:focus:bg-charcoal-700"
                    >
                      Name (A-Z)
                    </SelectItem>
                    <SelectItem
                      value="name-desc"
                      className="text-charcoal-700 dark:text-charcoal-200 focus:bg-cream-100 dark:focus:bg-charcoal-700"
                    >
                      Name (Z-A)
                    </SelectItem>
                    <SelectItem
                      value="skin-asc"
                      className="text-charcoal-700 dark:text-charcoal-200 focus:bg-cream-100 dark:focus:bg-charcoal-700"
                    >
                      Skin # (Low to High)
                    </SelectItem>
                    <SelectItem
                      value="skin-desc"
                      className="text-charcoal-700 dark:text-charcoal-200 focus:bg-cream-100 dark:focus:bg-charcoal-700"
                    >
                      Skin # (High to Low)
                    </SelectItem>
                    <SelectItem
                      value="champion"
                      className="text-charcoal-700 dark:text-charcoal-200 focus:bg-cream-100 dark:focus:bg-charcoal-700"
                    >
                      Champion Name
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
