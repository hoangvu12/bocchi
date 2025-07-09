import { useEffect, useRef, useCallback } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import AutoSizer from 'react-virtualized-auto-sizer'
import { Upload, ChevronLeft, ChevronRight } from 'lucide-react'
import { Toaster } from 'sonner'

// Components
import { TitleBar } from './components/TitleBar'
import { UpdateDialog } from './components/UpdateDialog'
import { ChampionDataUpdateDialog } from './components/ChampionDataUpdateDialog'
import { SelectedSkinsDrawer } from './components/SelectedSkinsDrawerWithP2P'
import { FilterPanel } from './components/FilterPanel'
import { GridViewToggle } from './components/GridViewToggle'
import { VirtualizedSkinGrid } from './components/VirtualizedSkinGrid'
import { VirtualizedChampionList } from './components/VirtualizedChampionList'
import { FileUploadButton } from './components/FileUploadButton'
import { EditCustomSkinDialog } from './components/EditCustomSkinDialog'
import { DownloadedSkinsDialog } from './components/DownloadedSkinsDialog'
import { FileTransferDialog } from './components/FileTransferDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { ChampionSelectDialog } from './components/ChampionSelectDialog'
import { AppHeader } from './components/layout/AppHeader'

// Contexts
import { LocaleProvider } from './contexts/LocaleContextProvider'
import { ThemeProvider } from './contexts/ThemeContext'
import { P2PProvider } from './contexts/P2PContext'

// Hooks
import { useGameDetection } from './hooks/useGameDetection'
import { useChampionData } from './hooks/useChampionData'
import { useSkinManagement } from './hooks/useSkinManagement'
import { usePatcherControl } from './hooks/usePatcherControl'
import { useToolsManagement } from './hooks/useToolsManagement'
import { useAppInitialization } from './hooks/useAppInitialization'
import { useChampionSelectHandler } from './hooks/useChampionSelectHandler'
import { useP2PSkinSync } from './hooks/useP2PSkinSync'
import { useP2PChampionSync } from './hooks/useP2PChampionSync'

// Atoms
import {
  appVersionAtom,
  errorMessageAtom,
  statusMessageAtom,
  isLoadingAtom,
  showUpdateDialogAtom
} from './store/atoms/game.atoms'
import { showChampionDataUpdateAtom, selectedChampionAtom } from './store/atoms/champion.atoms'
import {
  isDraggingAtom,
  showEditDialogAtom,
  editingCustomSkinAtom,
  showDownloadedSkinsDialogAtom,
  showSettingsDialogAtom
} from './store/atoms/ui.atoms'
import {
  lcuSelectedChampionAtom,
  isChampionLockedAtom,
  autoViewSkinsEnabledAtom
} from './store/atoms/lcu.atoms'
import { leagueClientEnabledAtom, championDetectionEnabledAtom } from './store/atoms/settings.atoms'
import {
  championSearchQueryAtom,
  filtersAtom,
  selectedChampionKeyAtom,
  showFavoritesOnlyAtom,
  skinSearchQueryAtom,
  viewModeAtom,
  championColumnCollapsedAtom
} from './store/atoms'

// Utils
import { getChampionDisplayName } from './utils/championUtils'

// Types
export interface Champion {
  id: number
  key: string
  name: string
  nameEn?: string
  title: string
  image: string
  skins: Skin[]
  tags: string[]
}

export interface Skin {
  id: string
  num: number
  name: string
  nameEn?: string
  lolSkinsName?: string
  chromas: boolean
  chromaList?: Array<{
    id: number
    name: string
    chromaPath: string
    colors: string[]
  }>
  rarity: string
  rarityGemPath: string | null
  isLegacy: boolean
  skinType: string
  skinLines?: Array<{ id: number }>
  description?: string
}

function AppContent(): React.JSX.Element {
  const { t } = useTranslation()

  // Initialize app
  useAppInitialization()

  // Atoms
  const appVersion = useAtomValue(appVersionAtom)
  const errorMessage = useAtomValue(errorMessageAtom)
  const statusMessage = useAtomValue(statusMessageAtom)
  const loading = useAtomValue(isLoadingAtom)
  const [showUpdateDialog, setShowUpdateDialog] = useAtom(showUpdateDialogAtom)
  const [showChampionDataUpdate, setShowChampionDataUpdate] = useAtom(showChampionDataUpdateAtom)
  const [selectedChampion, setSelectedChampion] = useAtom(selectedChampionAtom)
  const [isDragging, setIsDragging] = useAtom(isDraggingAtom)
  const [showEditDialog, setShowEditDialog] = useAtom(showEditDialogAtom)
  const [editingCustomSkin, setEditingCustomSkin] = useAtom(editingCustomSkinAtom)
  const [showDownloadedSkinsDialog, setShowDownloadedSkinsDialog] = useAtom(
    showDownloadedSkinsDialogAtom
  )
  const [showSettingsDialog, setShowSettingsDialog] = useAtom(showSettingsDialogAtom)
  const lcuSelectedChampion = useAtomValue(lcuSelectedChampionAtom)
  const isChampionLocked = useAtomValue(isChampionLockedAtom)
  const autoViewSkinsEnabled = useAtomValue(autoViewSkinsEnabledAtom)
  const [, setLeagueClientEnabled] = useAtom(leagueClientEnabledAtom)
  const [championDetectionEnabled, setChampionDetectionEnabled] = useAtom(
    championDetectionEnabledAtom
  )
  const [championSearchQuery, setChampionSearchQuery] = useAtom(championSearchQueryAtom)
  const [skinSearchQuery, setSkinSearchQuery] = useAtom(skinSearchQueryAtom)
  const [showFavoritesOnly, setShowFavoritesOnly] = useAtom(showFavoritesOnlyAtom)
  const [viewMode, setViewMode] = useAtom(viewModeAtom)
  const [filters, setFilters] = useAtom(filtersAtom)
  const [selectedChampionKey, setSelectedChampionKey] = useAtom(selectedChampionKeyAtom)
  const [championColumnCollapsed, setChampionColumnCollapsed] = useAtom(championColumnCollapsedAtom)
  const setStatusMessage = useSetAtom(statusMessageAtom)

  // Hooks
  const { gamePath } = useGameDetection()
  const { championData, updateChampionData, isUpdatingChampionData } = useChampionData()
  const {
    downloadedSkins,
    favorites,
    selectedSkins,
    setSelectedSkins,
    loadDownloadedSkins,
    toggleFavorite,
    deleteCustomSkin,
    deleteDownloadedSkin,
    applySelectedSkins
  } = useSkinManagement()
  const { isPatcherRunning, stopPatcher } = usePatcherControl()
  const { toolsExist, downloadingTools, toolsDownloadProgress, downloadTools } =
    useToolsManagement()

  // Initialize P2P skin sync
  useP2PSkinSync(downloadedSkins)
  const { autoSyncedSkins } = useP2PChampionSync({ downloadedSkins })

  // Refs
  const dragCounter = useRef(0)
  const fileUploadRef = useRef<any>(null)

  // Handle champion navigation
  const navigateToChampion = useCallback(
    (champion: Champion) => {
      setSelectedChampion(champion)
      setSelectedChampionKey(champion.key)
      setSkinSearchQuery('')
      if (showFavoritesOnly) {
        setShowFavoritesOnly(false)
      }
    },
    [
      setSelectedChampion,
      setSelectedChampionKey,
      setSkinSearchQuery,
      showFavoritesOnly,
      setShowFavoritesOnly
    ]
  )

  // Initialize champion select handler
  const { onChampionNavigate, clearSelectedChampion } = useChampionSelectHandler({
    champions: championData?.champions,
    onNavigateToChampion: navigateToChampion,
    enabled: championDetectionEnabled,
    onAutoSelectSkin: async (champion) => {
      if (!championData) return

      // Check which auto mode is enabled
      const autoRandomFavoriteSkinEnabled = await window.api.getSettings(
        'autoRandomFavoriteSkinEnabled'
      )
      const autoRandomRaritySkinEnabled = await window.api.getSettings(
        'autoRandomRaritySkinEnabled'
      )

      let availableSkins = champion.skins.filter((skin) => skin.num !== 0)

      if (autoRandomFavoriteSkinEnabled) {
        // Get favorites for this champion
        const favoritesResult = await window.api.getFavoritesByChampion(champion.key)
        if (
          !favoritesResult.success ||
          !favoritesResult.favorites ||
          favoritesResult.favorites.length === 0
        ) {
          // No favorites for this champion, skip auto-selection
          console.log(
            `No favorite skins found for champion ${champion.key}, skipping auto-selection`
          )
          return
        }

        // Filter skins to only those that are favorited
        availableSkins = champion.skins.filter(
          (skin) => favoritesResult.favorites?.some((fav) => fav.skinId === skin.id) || false
        )
      } else if (autoRandomRaritySkinEnabled) {
        // Filter to only rarity skins
        availableSkins = availableSkins.filter((skin) => skin.rarity && skin.rarity !== 'kNoRarity')
      }

      if (availableSkins.length === 0) return

      // Select a random skin
      const randomIndex = Math.floor(Math.random() * availableSkins.length)
      const randomSkin = availableSkins[randomIndex]

      // Add the auto-selected skin
      const newSelectedSkin = {
        championKey: champion.key,
        championName: champion.name,
        skinId: randomSkin.id,
        skinName: randomSkin.name,
        skinNameEn: randomSkin.nameEn,
        lolSkinsName: randomSkin.lolSkinsName,
        skinNum: randomSkin.num,
        chromaId: undefined,
        isDownloaded: false,
        isAutoSelected: true
      }
      setSelectedSkins((prev) => [...prev, newSelectedSkin])
    }
  })

  // Handle auto-navigation when champion is selected
  useEffect(() => {
    if (lcuSelectedChampion && autoViewSkinsEnabled) {
      onChampionNavigate()
      clearSelectedChampion()
    }
  }, [lcuSelectedChampion, autoViewSkinsEnabled, onChampionNavigate, clearSelectedChampion])

  // Drag and drop handlers
  useEffect(() => {
    const handleDocumentDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    document.addEventListener('dragover', handleDocumentDragOver)
    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver)
    }
  }, [])

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounter.current = 0

    const files = Array.from(e.dataTransfer.files)
    const skinFiles = files.filter((file) => {
      const ext = file.name.toLowerCase()
      return ext.endsWith('.wad') || ext.endsWith('.zip') || ext.endsWith('.fantome')
    })

    if (skinFiles.length > 0 && fileUploadRef.current) {
      const filePaths: string[] = []
      for (const file of skinFiles) {
        try {
          const filePath = window.api.getPathForFile(file)
          if (filePath) {
            filePaths.push(filePath)
          }
        } catch (err) {
          console.error('Error getting file path:', err)
        }
      }

      if (filePaths.length > 0) {
        fileUploadRef.current.handleDroppedFiles(filePaths)
      }
    }
  }

  // Handle skin click
  const handleSkinClick = useCallback(
    (champion: Champion, skin: Skin, chromaId?: string) => {
      if (!gamePath) {
        setStatusMessage(t('status.pleaseSetGamePath'))
        return
      }

      // Check for existing selection
      const existingIndex = selectedSkins.findIndex((s) => {
        return (
          s.championKey === champion.key &&
          s.skinId === skin.id &&
          s.chromaId === (chromaId || undefined)
        )
      })

      if (existingIndex >= 0) {
        // Remove from selection
        setSelectedSkins((prev) => prev.filter((_, index) => index !== existingIndex))
      } else {
        // Add to selection
        const newSelectedSkin = {
          championKey: champion.key,
          championName: champion.name,
          skinId: skin.id,
          skinName: skin.name,
          skinNameEn: skin.nameEn,
          lolSkinsName: skin.lolSkinsName,
          skinNum: skin.num,
          chromaId: chromaId,
          isDownloaded: false,
          isAutoSelected: false
        }
        setSelectedSkins((prev) => [...prev, newSelectedSkin])
      }
    },
    [gamePath, setStatusMessage, t, selectedSkins, setSelectedSkins]
  )

  // Handle edit custom skin
  const handleEditCustomSkin = useCallback(
    async (skinPath: string, currentName: string) => {
      setEditingCustomSkin({ path: skinPath, name: currentName })
      setShowEditDialog(true)
    },
    [setEditingCustomSkin, setShowEditDialog]
  )

  // Filter champions
  const filteredChampions =
    championData?.champions.filter((champ) => {
      const displayName = getChampionDisplayName(champ)
      return displayName.toLowerCase().includes(championSearchQuery.toLowerCase())
    }) || []

  // Get all champion tags
  const getAllChampionTags = () => {
    const tagSet = new Set<string>()
    championData?.champions.forEach((champ) => {
      champ.tags.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }

  // Apply filters and sort
  const applyFiltersAndSort = (skins: Array<{ champion: Champion; skin: Skin }>) => {
    let filtered = [...skins]

    // Apply download status filter
    if (filters.downloadStatus !== 'all') {
      filtered = filtered.filter(({ champion, skin }) => {
        const skinFileName = `${skin.nameEn || skin.name}.zip`.replace(/:/g, '')
        const isDownloaded = downloadedSkins.some(
          (ds) => ds.championName === champion.key && ds.skinName === skinFileName
        )

        if (filters.downloadStatus === 'downloaded') {
          return isDownloaded
        } else {
          return !isDownloaded
        }
      })
    }

    // Apply chroma status filter
    if (filters.chromaStatus !== 'all') {
      filtered = filtered.filter(({ skin }) => {
        const hasChromas = skin.chromas && skin.chromaList && skin.chromaList.length > 0

        if (filters.chromaStatus === 'has-chromas') {
          return hasChromas
        } else {
          return !hasChromas
        }
      })
    }

    // Apply rarity filter
    if (filters.rarity !== 'all') {
      filtered = filtered.filter(({ skin }) => {
        return skin.rarity === filters.rarity
      })
    }

    // Apply champion tag filter
    if (filters.championTags.length > 0) {
      filtered = filtered.filter(({ champion }) => {
        return filters.championTags.some((tag) => champion.tags.includes(tag))
      })
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'name-asc':
          return (a.skin.nameEn || a.skin.name).localeCompare(b.skin.nameEn || b.skin.name)
        case 'name-desc':
          return (b.skin.nameEn || b.skin.name).localeCompare(a.skin.nameEn || a.skin.name)
        case 'skin-asc':
          return a.skin.num - b.skin.num
        case 'skin-desc':
          return b.skin.num - a.skin.num
        case 'champion':
          return (a.champion.nameEn || a.champion.name).localeCompare(
            b.champion.nameEn || b.champion.name
          )
        default:
          return 0
      }
    })

    return filtered
  }

  // Get display skins
  const getDisplaySkins = () => {
    if (!championData) return []

    const allSkins: Array<{ champion: Champion; skin: Skin }> = []
    const isSearchingGlobally = skinSearchQuery.trim().length > 0

    if (isSearchingGlobally) {
      // Global search across all champions
      const searchLower = skinSearchQuery.toLowerCase()
      championData.champions.forEach((champion) => {
        champion.skins.forEach((skin) => {
          if (skin.num !== 0 && skin.name.toLowerCase().includes(searchLower)) {
            allSkins.push({ champion, skin })
          }
        })
      })
    } else if (selectedChampion) {
      // Show skins for selected champion
      selectedChampion.skins.forEach((skin) => {
        if (skin.num !== 0) {
          if (!showFavoritesOnly || favorites.has(`${selectedChampion.key}_${skin.id}`)) {
            allSkins.push({ champion: selectedChampion, skin })
          }
        }
      })
    } else if (selectedChampionKey === 'all') {
      // Show all skins
      championData.champions.forEach((champion) => {
        champion.skins.forEach((skin) => {
          if (skin.num !== 0) {
            if (!showFavoritesOnly || favorites.has(`${champion.key}_${skin.id}`)) {
              allSkins.push({ champion, skin })
            }
          }
        })
      })
    } else if (selectedChampionKey === 'custom') {
      // Show custom mods
      downloadedSkins.forEach((downloadedSkin) => {
        // Check if this is a custom mod (user-imported)
        if (downloadedSkin.skinName.includes('[User]')) {
          // Find the champion for this custom mod
          let champion: Champion | undefined

          // First try to match the actual champion
          if (downloadedSkin.championName && downloadedSkin.championName !== 'Custom') {
            champion = championData.champions.find(
              (c) => c.key.toLowerCase() === downloadedSkin.championName.toLowerCase()
            )
          }

          // If no champion found or championName is 'Custom', create a custom champion
          if (!champion) {
            champion = {
              id: -1,
              key: 'Custom',
              name: 'Custom',
              nameEn: 'Custom',
              title: 'Imported Mods',
              image: '',
              skins: [],
              tags: []
            }
          }

          // Create a custom skin object
          const customSkin: Skin = {
            id: `custom_${downloadedSkin.skinName}`,
            num: -1, // Custom skins don't have a number
            name: downloadedSkin.skinName.replace('[User] ', ''),
            nameEn: downloadedSkin.skinName.replace('[User] ', ''),
            chromas: false,
            rarity: 'kNoRarity',
            rarityGemPath: null,
            isLegacy: false,
            skinType: 'custom',
            description: 'Custom imported mod'
          }

          allSkins.push({ champion, skin: customSkin })
        }
      })
    }

    return applyFiltersAndSort(allSkins)
  }

  // Calculate stats
  const calculateStats = () => {
    let total = 0
    let downloaded = 0

    if (championData) {
      championData.champions.forEach((champion) => {
        champion.skins.forEach((skin) => {
          if (skin.num !== 0) {
            total++
            const skinFileName = `${skin.nameEn || skin.name}.zip`.replace(/:/g, '')
            if (
              downloadedSkins.some(
                (ds) => ds.championName === champion.key && ds.skinName === skinFileName
              )
            ) {
              downloaded++
            }
          }
        })
      })
    }

    return { total, downloaded }
  }

  // Champion select handler
  const handleChampionSelect = useCallback(
    (champion: Champion | null, key: string) => {
      setSelectedChampion(champion)
      setSelectedChampionKey(key)
    },
    [setSelectedChampion, setSelectedChampionKey]
  )

  return (
    <>
      <TitleBar appVersion={appVersion} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'sonner-toast',
          duration: 5000,
          style: {
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)'
          }
        }}
      />
      <UpdateDialog isOpen={showUpdateDialog} onClose={() => setShowUpdateDialog(false)} />
      <ChampionDataUpdateDialog
        isOpen={showChampionDataUpdate}
        onUpdate={updateChampionData}
        onSkip={() => setShowChampionDataUpdate(false)}
        currentVersion={championData?.version}
        isUpdating={isUpdatingChampionData}
      />
      <div
        className="flex flex-col h-screen pt-10 bg-background text-text-primary overflow-hidden transition-colors duration-200"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {toolsExist === false && (
          <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-surface rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl dark:shadow-dark-xl animate-slide-down">
              <h3 className="text-xl font-bold mb-3 text-text-primary">{t('tools.required')}</h3>
              <p className="text-text-secondary mb-6 leading-relaxed">{t('tools.description')}</p>
              {downloadingTools ? (
                <div>
                  <p className="text-sm text-text-secondary mb-3">
                    {t('tools.downloading', { progress: toolsDownloadProgress })}
                  </p>
                  <div className="w-full bg-secondary-100 dark:bg-secondary-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-primary-500 h-full transition-all duration-300 relative overflow-hidden"
                      style={{ width: `${toolsDownloadProgress}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-progress"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-all duration-200 shadow-soft hover:shadow-medium active:scale-[0.98]"
                  onClick={downloadTools}
                >
                  {t('tools.downloadTools')}
                </button>
              )}
            </div>
          </div>
        )}

        <AppHeader />

        {championData ? (
          <div className="flex flex-1 overflow-hidden">
            <div
              className={`${championColumnCollapsed ? 'w-24' : 'w-80'} bg-elevated border-r-2 border-border flex flex-col shadow-md dark:shadow-none transition-all duration-300 ease-in-out`}
            >
              <div
                className={`${championColumnCollapsed ? 'p-3' : 'p-6'} flex items-center ${championColumnCollapsed ? 'justify-center' : 'gap-2'}`}
              >
                {!championColumnCollapsed && (
                  <input
                    type="text"
                    placeholder={t('champion.searchPlaceholder')}
                    value={championSearchQuery}
                    onChange={(e) => setChampionSearchQuery(e.target.value)}
                    className="flex-1 px-4 py-2.5 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  />
                )}
                <button
                  onClick={() => setChampionColumnCollapsed(!championColumnCollapsed)}
                  className="px-2 py-2.5 text-sm bg-surface hover:bg-secondary-100 dark:hover:bg-secondary-800 text-text-primary rounded-lg transition-all duration-200 border border-border hover:border-border-strong"
                  title={
                    championColumnCollapsed ? 'Expand champion list' : 'Collapse champion list'
                  }
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

            <div className="flex-1 flex flex-col bg-background overflow-hidden">
              <FilterPanel
                filters={filters}
                onFiltersChange={setFilters}
                availableTags={getAllChampionTags()}
                downloadedCount={calculateStats().downloaded}
                totalCount={calculateStats().total}
                onClearFilters={() =>
                  setFilters({
                    downloadStatus: 'all',
                    chromaStatus: 'all',
                    championTags: [],
                    sortBy: 'name-asc',
                    rarity: 'all'
                  })
                }
              />
              <div className="px-8 pt-6 pb-4 flex items-center justify-between gap-4">
                <input
                  type="text"
                  placeholder={t('skin.searchPlaceholder')}
                  value={skinSearchQuery}
                  onChange={(e) => setSkinSearchQuery(e.target.value)}
                  className="flex-1 px-5 py-3 bg-surface border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 shadow-soft dark:shadow-none"
                />
                <div className="flex items-center gap-2">
                  <FileUploadButton
                    ref={fileUploadRef}
                    champions={championData.champions}
                    onSkinImported={loadDownloadedSkins}
                  />
                  <button
                    onClick={() => setShowDownloadedSkinsDialog(true)}
                    className="px-4 py-2.5 text-sm bg-surface hover:bg-secondary-100 dark:hover:bg-secondary-800 text-text-primary font-medium rounded-lg transition-all duration-200 border border-border hover:border-border-strong shadow-sm hover:shadow-md dark:shadow-none flex items-center gap-2"
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
                {getDisplaySkins().length > 0 ? (
                  <>
                    <div className="px-8 pb-4 text-sm text-text-secondary">
                      {t('skin.showing', { count: getDisplaySkins().length })}
                    </div>
                    <div className="flex-1 relative" style={{ minHeight: 0 }}>
                      <AutoSizer>
                        {({ width, height }) => (
                          <VirtualizedSkinGrid
                            skins={getDisplaySkins()}
                            viewMode={viewMode}
                            downloadedSkins={downloadedSkins}
                            selectedSkins={selectedSkins}
                            favorites={favorites}
                            loading={loading}
                            onSkinClick={handleSkinClick}
                            onToggleFavorite={toggleFavorite}
                            onDeleteCustomSkin={deleteCustomSkin}
                            onEditCustomSkin={handleEditCustomSkin}
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
                        onClick={() =>
                          setFilters({
                            downloadStatus: 'all',
                            chromaStatus: 'all',
                            championTags: [],
                            sortBy: 'name-asc',
                            rarity: 'all'
                          })
                        }
                        className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                      >
                        Clear all filters
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="w-16 h-16 bg-cream-300 dark:bg-charcoal-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-8 h-8 text-charcoal-600 dark:text-charcoal-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <p className="text-lg text-text-secondary mb-6">{t('champion.noData')}</p>
              <button
                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-all duration-200 shadow-soft hover:shadow-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                onClick={() => window.api.fetchChampionData('en_US')}
                disabled={loading}
              >
                {t('champion.downloadData')}
              </button>
            </div>
          </div>
        )}

        <SelectedSkinsDrawer
          onApplySkins={applySelectedSkins}
          onStopPatcher={stopPatcher}
          loading={loading}
          isPatcherRunning={isPatcherRunning}
          downloadedSkins={downloadedSkins}
          championData={championData || undefined}
          statusMessage={statusMessage}
          errorMessage={errorMessage}
          gamePath={gamePath}
          autoSyncedSkins={autoSyncedSkins}
        />

        {/* Drop overlay */}
        {isDragging && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-surface rounded-2xl p-12 shadow-2xl flex flex-col items-center gap-4">
              <Upload className="w-16 h-16 text-primary-500" />
              <p className="text-2xl font-bold text-text-primary">Drop skin files here</p>
              <p className="text-sm text-text-secondary">Supports .wad, .zip, and .fantome files</p>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {editingCustomSkin && (
        <EditCustomSkinDialog
          isOpen={showEditDialog}
          currentName={editingCustomSkin.name}
          onClose={() => {
            setShowEditDialog(false)
            setEditingCustomSkin(null)
          }}
          onSave={async (newName, newImagePath) => {
            const result = await window.api.editCustomSkin(
              editingCustomSkin.path,
              newName,
              newImagePath
            )

            if (result.success) {
              await loadDownloadedSkins()
              setStatusMessage(`Updated custom mod: ${newName}`)
            } else {
              setStatusMessage(`Failed to update mod: ${result.error}`)
            }

            setShowEditDialog(false)
            setEditingCustomSkin(null)
          }}
        />
      )}

      <DownloadedSkinsDialog
        isOpen={showDownloadedSkinsDialog}
        onClose={() => setShowDownloadedSkinsDialog(false)}
        downloadedSkins={downloadedSkins}
        championData={championData || undefined}
        onDeleteSkin={deleteDownloadedSkin}
        onDeleteCustomSkin={deleteCustomSkin}
        onRefresh={loadDownloadedSkins}
      />

      <FileTransferDialog championData={championData || undefined} />

      <SettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        onLeagueClientChange={(enabled) => setLeagueClientEnabled(enabled)}
        onChampionDetectionChange={(enabled) => setChampionDetectionEnabled(enabled)}
      />

      {!autoViewSkinsEnabled && (
        <ChampionSelectDialog
          champion={lcuSelectedChampion}
          isLocked={isChampionLocked}
          onViewSkins={onChampionNavigate}
          onClose={clearSelectedChampion}
          championData={championData || undefined}
          onAddSkin={handleSkinClick}
        />
      )}
    </>
  )
}

function App(): React.JSX.Element {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <P2PProvider>
          <AppContent />
        </P2PProvider>
      </ThemeProvider>
    </LocaleProvider>
  )
}

export default App
