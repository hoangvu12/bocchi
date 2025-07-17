import { useRef } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import AutoSizer from 'react-virtualized-auto-sizer'
import { VirtualizedSkinGrid } from '../VirtualizedSkinGrid'
import { FilterPanel } from '../FilterPanel'
import { GridViewToggle } from '../GridViewToggle'
import { FileUploadButton } from '../FileUploadButton'
import { DownloadAllSkinsDialog } from '../DownloadAllSkinsDialog'
import { DownloadAllSkinsOptionsDialog } from '../DownloadAllSkinsOptionsDialog'
import { filtersAtom, skinSearchQueryAtom, viewModeAtom } from '../../store/atoms'
import { showDownloadedSkinsDialogAtom } from '../../store/atoms/ui.atoms'
import {
  useDisplaySkins,
  useAllChampionTags,
  useDownloadedCount,
  useTotalCount,
  useStyles,
  DEFAULT_FILTERS
} from '../../hooks/useOptimizedState'
import { useChampionData } from '../../hooks/useChampionData'
import { useSkinManagement } from '../../hooks/useSkinManagement'
import { useDownloadAllSkins } from '../../hooks/useDownloadAllSkins'
import type { Champion, Skin } from '../../App'

interface SkinBrowserSectionProps {
  loading: boolean
  onEditCustomSkin: (skinPath: string, currentName: string) => Promise<void>
  onSkinClick: (champion: Champion, skin: Skin, chromaId?: string) => void
  selectedSkins: any[]
}

export function SkinBrowserSection({
  loading,
  onEditCustomSkin,
  onSkinClick,
  selectedSkins
}: SkinBrowserSectionProps) {
  const { t } = useTranslation()
  const { championData } = useChampionData()
  const fileUploadRef = useRef<any>(null)

  const [filters, setFilters] = useAtom(filtersAtom)
  const [skinSearchQuery, setSkinSearchQuery] = useAtom(skinSearchQueryAtom)
  const [viewMode, setViewMode] = useAtom(viewModeAtom)
  const setShowDownloadedSkinsDialog = useSetAtom(showDownloadedSkinsDialogAtom)

  const displaySkins = useDisplaySkins()
  const allChampionTags = useAllChampionTags()
  const downloadedCount = useDownloadedCount()
  const totalCount = useTotalCount()
  const styles = useStyles()

  const {
    downloadedSkins,
    favorites,
    loadDownloadedSkins,
    toggleFavorite,
    toggleChromaFavorite,
    deleteCustomSkin
  } = useSkinManagement()

  const {
    // Options dialog
    isOptionsDialogOpen,
    showOptionsDialog,
    closeOptionsDialog,

    // Progress dialog
    isProgressDialogOpen,
    progress,
    closeProgressDialog,

    // Download actions
    startDownloadWithOptions,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryFailedDownloads,

    // Utility
    skinStats
  } = useDownloadAllSkins()

  if (!championData) return null

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        availableTags={allChampionTags}
        downloadedCount={downloadedCount}
        totalCount={totalCount}
        onClearFilters={() => setFilters(DEFAULT_FILTERS)}
      />
      <div className="px-8 pt-6 pb-4 flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder={t('skin.searchPlaceholder')}
          value={skinSearchQuery}
          onChange={(e) => setSkinSearchQuery(e.target.value)}
          className={styles.skinSearchInput.className}
        />
        <div className="flex items-center gap-2">
          <FileUploadButton
            ref={fileUploadRef}
            champions={championData.champions}
            onSkinImported={loadDownloadedSkins}
          />
          <button
            onClick={showOptionsDialog}
            className={styles.manageButton.className}
            title={t('downloadAll.title')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
              />
            </svg>
            {t('downloadAll.button')}
          </button>
          <button
            onClick={() => setShowDownloadedSkinsDialog(true)}
            className={styles.manageButton.className}
            title={t('skins.manageDownloaded')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
            {t('skins.manage')}
          </button>
          <GridViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      </div>

      {/* Skin grid content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {displaySkins.length > 0 ? (
          <>
            <div className="px-8 pb-4 text-sm text-text-secondary">
              {t('skin.showing', { count: displaySkins.length })}
            </div>
            <div className="flex-1 relative" style={{ minHeight: 0 }}>
              <AutoSizer>
                {({ width, height }) => (
                  <VirtualizedSkinGrid
                    skins={displaySkins}
                    viewMode={viewMode}
                    downloadedSkins={downloadedSkins}
                    selectedSkins={selectedSkins}
                    favorites={favorites}
                    loading={loading}
                    onSkinClick={onSkinClick}
                    onToggleFavorite={toggleFavorite}
                    onToggleChromaFavorite={toggleChromaFavorite}
                    onDeleteCustomSkin={deleteCustomSkin}
                    onEditCustomSkin={onEditCustomSkin}
                    containerWidth={width}
                    containerHeight={height}
                  />
                )}
              </AutoSizer>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-secondary-200 dark:bg-secondary-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-text-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-text-secondary mb-2">No skins match your filters</p>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Download All Skins Options Dialog */}
      <DownloadAllSkinsOptionsDialog
        isOpen={isOptionsDialogOpen}
        onClose={closeOptionsDialog}
        onStartDownload={startDownloadWithOptions}
        totalSkinsCount={skinStats.totalCount}
        estimatedSize={skinStats.estimatedSize}
      />

      {/* Download All Skins Progress Dialog */}
      <DownloadAllSkinsDialog
        isOpen={isProgressDialogOpen}
        progress={progress}
        onPause={pauseDownload}
        onResume={resumeDownload}
        onCancel={cancelDownload}
        onRetry={retryFailedDownloads}
        onClose={closeProgressDialog}
      />
    </div>
  )
}
