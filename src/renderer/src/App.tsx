import { useAtom } from 'jotai'
import { useCallback, useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import AutoSizer from 'react-virtualized-auto-sizer'
import { Upload } from 'lucide-react'
import { Toaster } from 'sonner'
import { FilterPanel } from './components/FilterPanel'
import { getChampionDisplayName } from './utils/championUtils'
import { generateCustomModId, isOldFormatCustomId } from './utils/customModId'
import { GridViewToggle } from './components/GridViewToggle'
import { TitleBar } from './components/TitleBar'
import { UpdateDialog } from './components/UpdateDialog'
import { ChampionDataUpdateDialog } from './components/ChampionDataUpdateDialog'
import { SelectedSkinsDrawer } from './components/SelectedSkinsDrawerWithP2P'
import { RoomPanel } from './components/RoomPanel'
import { useP2PSkinSync } from './hooks/useP2PSkinSync'
import { P2PProvider } from './contexts/P2PContext'
import { VirtualizedSkinGrid } from './components/VirtualizedSkinGrid'
import { VirtualizedChampionList } from './components/VirtualizedChampionList'
import { LocaleProvider } from './contexts/LocaleContextProvider'
import { useLocale } from './contexts/useLocale'
import { ThemeProvider } from './contexts/ThemeContext'
import { FileUploadButton } from './components/FileUploadButton'
import { EditCustomSkinDialog } from './components/EditCustomSkinDialog'
import { DownloadedSkinsDialog } from './components/DownloadedSkinsDialog'
import { FileTransferDialog } from './components/FileTransferDialog'
import { LCUStatusIndicator } from './components/LCUStatusIndicator'
import { SettingsDialog } from './components/SettingsDialog'
import { ChampionSelectDialog } from './components/ChampionSelectDialog'
import { useChampionSelectHandler } from './hooks/useChampionSelectHandler'
import {
  championSearchQueryAtom,
  filtersAtom,
  selectedChampionKeyAtom,
  showFavoritesOnlyAtom,
  skinSearchQueryAtom,
  viewModeAtom,
  selectedSkinsAtom,
  type SelectedSkin
} from './store/atoms'

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
}

interface ChampionData {
  version: string
  lastUpdated: string
  champions: Champion[]
}

interface DownloadedSkin {
  championName: string
  skinName: string
  url: string
  localPath?: string
}

function AppContent(): React.JSX.Element {
  const { t } = useTranslation()
  const { currentLanguage } = useLocale()
  const [gamePath, setGamePath] = useState<string>('')

  // Removed - will use it after downloadedSkins is loaded
  // Granular loading states
  const [isLoadingChampionData, setIsLoadingChampionData] = useState<boolean>(false)
  const [isApplyingSkins, setIsApplyingSkins] = useState<boolean>(false)
  const [isDeletingSkin, setIsDeletingSkin] = useState<boolean>(false)
  const [isStoppingPatcher, setIsStoppingPatcher] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Computed loading state for UI
  const loading = isLoadingChampionData || isApplyingSkins || isDeletingSkin || isStoppingPatcher
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [isPatcherRunning, setIsPatcherRunning] = useState<boolean>(false)

  // Race condition prevention
  const activeOperationRef = useRef<string | null>(null)

  // Champion browser states
  const [championData, setChampionData] = useState<ChampionData | null>(null)
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null)
  const [downloadedSkins, setDownloadedSkins] = useState<DownloadedSkin[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [toolsExist, setToolsExist] = useState<boolean | null>(null)
  const [downloadingTools, setDownloadingTools] = useState<boolean>(false)
  const [toolsDownloadProgress, setToolsDownloadProgress] = useState<number>(0)
  const [showUpdateDialog, setShowUpdateDialog] = useState<boolean>(false)
  const [appVersion, setAppVersion] = useState<string>('')
  const [showChampionDataUpdate, setShowChampionDataUpdate] = useState<boolean>(false)
  const [isUpdatingChampionData, setIsUpdatingChampionData] = useState<boolean>(false)

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)
  const fileUploadRef = useRef<any>(null)

  // Add dragover listener to document on mount
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

  // Jotai atoms for persisted state
  const [championSearchQuery, setChampionSearchQuery] = useAtom(championSearchQueryAtom)
  const [skinSearchQuery, setSkinSearchQuery] = useAtom(skinSearchQueryAtom)
  const [showFavoritesOnly, setShowFavoritesOnly] = useAtom(showFavoritesOnlyAtom)
  const [viewMode, setViewMode] = useAtom(viewModeAtom)
  const [filters, setFilters] = useAtom(filtersAtom)
  const [selectedChampionKey, setSelectedChampionKey] = useAtom(selectedChampionKeyAtom)
  const [selectedSkins, setSelectedSkins] = useAtom(selectedSkinsAtom)

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState<boolean>(false)
  const [editingCustomSkin, setEditingCustomSkin] = useState<{ path: string; name: string } | null>(
    null
  )
  // Downloaded skins dialog state
  const [showDownloadedSkinsDialog, setShowDownloadedSkinsDialog] = useState<boolean>(false)
  // Settings dialog state
  const [showSettingsDialog, setShowSettingsDialog] = useState<boolean>(false)

  // Initialize P2P skin sync with downloadedSkins
  useP2PSkinSync(downloadedSkins)

  // Handle champion navigation
  const navigateToChampion = useCallback(
    (champion: Champion) => {
      setSelectedChampion(champion)
      setSelectedChampionKey(champion.key)
      // Clear skin search to show all skins for the champion
      setSkinSearchQuery('')
      // Optionally clear favorites filter
      if (showFavoritesOnly) {
        setShowFavoritesOnly(false)
      }
    },
    [setSelectedChampionKey, setSkinSearchQuery, showFavoritesOnly, setShowFavoritesOnly]
  )

  // Initialize champion select handler
  const [leagueClientEnabled, setLeagueClientEnabled] = useState(true)
  const [championDetectionEnabled, setChampionDetectionEnabled] = useState(true)
  const {
    lcuConnected,
    isInChampSelect,
    selectedChampion: lcuSelectedChampion,
    isChampionLocked,
    onChampionNavigate,
    clearSelectedChampion
  } = useChampionSelectHandler({
    champions: championData?.champions,
    onNavigateToChampion: navigateToChampion,
    enabled: championDetectionEnabled
  })

  // Load champion detection setting
  useEffect(() => {
    Promise.all([
      window.api.getSettings('leagueClientEnabled'),
      window.api.getSettings('championDetection')
    ]).then(([leagueClient, championDetection]) => {
      setLeagueClientEnabled(leagueClient !== false)
      setChampionDetectionEnabled(championDetection !== false)
    })
  }, [])

  const loadChampionData = useCallback(
    async (preserveSelection = false) => {
      const result = await window.api.loadChampionData(currentLanguage)
      if (result.success && result.data) {
        setChampionData(result.data)

        // Use functional state updates to avoid dependency on current state values
        setSelectedChampionKey((currentKey) => {
          // Try to restore selected champion from persisted key
          if (currentKey && currentKey !== 'all') {
            const champion = result.data.champions.find((c) => c.key === currentKey)
            if (champion) {
              setSelectedChampion(champion)
              return currentKey
            }
          } else if (currentKey === 'all') {
            setSelectedChampion(null)
            return currentKey
          }

          // Default to "all" if nothing is selected
          if (!currentKey) {
            setSelectedChampion(null)
            return 'all'
          }

          return currentKey
        })

        // Handle preserve selection separately to avoid dependencies
        if (preserveSelection) {
          setSelectedChampion((currentChampion) => {
            if (currentChampion) {
              const sameChampion = result.data.champions.find((c) => c.key === currentChampion.key)
              if (sameChampion) {
                return sameChampion
              }
            }
            return currentChampion
          })
        }

        return result.data
      }
      return null
    },
    [currentLanguage, setSelectedChampionKey, setSelectedChampion]
  )

  const checkChampionDataUpdates = useCallback(async () => {
    try {
      const result = await window.api.checkChampionUpdates(currentLanguage)
      if (result.success && result.needsUpdate) {
        setShowChampionDataUpdate(true)
      }
    } catch (error) {
      console.error('Failed to check champion data updates:', error)
    }
  }, [currentLanguage])

  const detectGamePath = useCallback(async () => {
    const result = await window.api.detectGame()
    if (result.success && result.gamePath) {
      setGamePath(result.gamePath)
      setStatusMessage(t('status.gameDetected'))
    } else {
      setStatusMessage(t('status.gameNotFound'))
    }
  }, [t])

  // Load data on component mount
  useEffect(() => {
    const initializeApp = async () => {
      checkPatcherStatus()
      const data = await loadChampionData()
      detectGamePath()
      loadDownloadedSkins()
      loadFavorites()
      checkToolsExist()
      loadAppVersion()

      // Check for champion data updates after initial load
      if (data) {
        checkChampionDataUpdates()
      }
    }

    initializeApp()
  }, [detectGamePath, loadChampionData, checkChampionDataUpdates])

  // Update checking is now handled in the main process on app startup

  // Clear search queries on mount
  useEffect(() => {
    setChampionSearchQuery('')
    setSkinSearchQuery('')
  }, [setChampionSearchQuery, setSkinSearchQuery])

  // Monitor LCU phase changes to update patcher status
  useEffect(() => {
    const unsubscribePhase = window.api.onLcuPhaseChanged(async (data) => {
      console.log('[App] Phase changed:', data)

      // Post-game phases where we should stop the patcher
      const postGamePhases = ['WaitingForStats', 'PreEndOfGame', 'EndOfGame', 'Lobby']

      // If transitioning to any post-game phase, check if we should stop the patcher
      if (postGamePhases.includes(data.phase)) {
        // Only stop patcher if auto-apply is enabled (meaning it was started automatically)
        const autoApplyEnabled = await window.api.getSettings('autoApplyEnabled')

        if (autoApplyEnabled !== false) {
          window.api.isPatcherRunning().then((isRunning) => {
            if (isRunning) {
              console.log(
                '[App] Game ended with auto-apply enabled, stopping patcher. Phase:',
                data.phase
              )
              window.api.stopPatcher().then(() => {
                // Update UI to reflect patcher stopped
                setIsPatcherRunning(false)
                setStatusMessage(t('status.stopped'))
              })
            }
          })
        } else {
          console.log(
            '[App] Game ended but auto-apply is disabled, keeping patcher running if active'
          )
        }
      }
    })

    return () => {
      unsubscribePhase()
    }
  }, [t])

  // Set up tools download progress listener
  useEffect(() => {
    const unsubscribe = window.api.onToolsDownloadProgress((progress) => {
      setToolsDownloadProgress(progress)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Set up update event listeners
  useEffect(() => {
    const unsubscribe = window.api.onUpdateAvailable((info) => {
      console.log('Update available:', info)
      setShowUpdateDialog(true)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Reload champion data when language changes
  useEffect(() => {
    if (championData) {
      loadChampionData(true) // preserve selection
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLanguage])

  // Add timeout mechanism to prevent stuck loading states
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        setIsLoadingChampionData(false)
        setIsApplyingSkins(false)
        setIsDeletingSkin(false)
        setIsStoppingPatcher(false)
        setStatusMessage(t('errors.operationTimeout'))
      }, 30000) // 30 second timeout

      return () => {
        clearTimeout(timeout)
      }
    }

    return () => {
      console.log('[Loading Timeout] Clearing timeout')
    }
  }, [loading, t])

  // Migrate old custom mod IDs to new stable format
  useEffect(() => {
    if (downloadedSkins.length > 0 && selectedSkins.length > 0) {
      const needsMigration = selectedSkins.some(
        (skin) => skin.skinId.startsWith('custom_') && isOldFormatCustomId(skin.skinId)
      )

      if (needsMigration) {
        const migratedSkins = selectedSkins.map((skin) => {
          // Check if it's an old format custom skin ID
          if (skin.skinId.startsWith('custom_') && isOldFormatCustomId(skin.skinId)) {
            // Find the matching custom mod by name
            const customMod = downloadedSkins.find(
              (ds) =>
                ds.skinName.includes('[User]') &&
                ds.skinName.includes(skin.skinName) &&
                (skin.championKey === 'Custom' || ds.championName === skin.championKey)
            )

            if (customMod) {
              // Generate new stable ID
              const cleanSkinName = customMod.skinName
                .replace('[User] ', '')
                .replace(/\.(wad|zip|fantome)$/, '')
              const newId =
                skin.championKey === 'Custom'
                  ? `custom_${generateCustomModId('Custom', cleanSkinName, customMod.localPath)}`
                  : `custom_${skin.championKey}_${generateCustomModId(skin.championKey, cleanSkinName, customMod.localPath)}`

              return { ...skin, skinId: newId }
            }
          }
          return skin
        })

        // Only update if there were actual changes
        if (JSON.stringify(migratedSkins) !== JSON.stringify(selectedSkins)) {
          setSelectedSkins(migratedSkins)
        }
      }
    }
  }, [downloadedSkins, selectedSkins, setSelectedSkins])

  const checkPatcherStatus = async () => {
    const isRunning = await window.api.isPatcherRunning()
    setIsPatcherRunning(isRunning)
  }

  const checkToolsExist = async () => {
    const exist = await window.api.checkToolsExist()
    setToolsExist(exist)
  }

  const loadAppVersion = async () => {
    try {
      const version = await window.api.getAppVersion()
      setAppVersion(version)
    } catch (error) {
      console.error('Failed to load app version:', error)
    }
  }

  const handleChampionDataUpdate = async () => {
    setIsUpdatingChampionData(true)
    try {
      await fetchChampionData()
      setShowChampionDataUpdate(false)
      // Reload the data after update
      await loadChampionData(true) // preserve selection
    } catch (error) {
      console.error('Failed to update champion data:', error)
    } finally {
      setIsUpdatingChampionData(false)
    }
  }

  const downloadTools = async () => {
    setDownloadingTools(true)
    setStatusMessage(t('status.downloadingTools'))

    const result = await window.api.downloadTools()
    if (result.success) {
      setToolsExist(true)
      setStatusMessage(t('status.toolsDownloaded'))
    } else {
      setStatusMessage(`Failed to download tools: ${result.error}`)
    }

    setDownloadingTools(false)
    setToolsDownloadProgress(0)
  }

  const loadDownloadedSkins = async () => {
    const result = await window.api.listDownloadedSkins()
    if (result.success && result.skins) {
      setDownloadedSkins(result.skins)
    }
  }

  const loadFavorites = async () => {
    const result = await window.api.getFavorites()
    if (result.success && result.favorites) {
      const favoriteKeys = new Set(result.favorites.map((f) => `${f.championKey}_${f.skinId}`))
      setFavorites(favoriteKeys)
    }
  }

  const toggleFavorite = async (champion: Champion, skin: Skin) => {
    const key = `${champion.key}_${skin.id}`
    const isFav = favorites.has(key)

    if (isFav) {
      await window.api.removeFavorite(champion.key, skin.id)
      setFavorites((prev) => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    } else {
      await window.api.addFavorite(champion.key, skin.id, skin.name)
      setFavorites((prev) => new Set(prev).add(key))
    }
  }

  const fetchChampionData = async () => {
    // Prevent concurrent fetches
    if (activeOperationRef.current === 'fetchChampionData') {
      return
    }

    activeOperationRef.current = 'fetchChampionData'
    setIsLoadingChampionData(true)
    setStatusMessage(t('status.fetchingData'))

    try {
      const result = await window.api.fetchChampionData(currentLanguage)
      if (result.success) {
        setStatusMessage(t('status.dataFetched', { count: result.championCount }))
        await loadChampionData()
      } else {
        setStatusMessage(`${t('errors.generic')}: ${result.message}`)
      }
    } catch (error) {
      setStatusMessage(
        `${t('errors.generic')}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setIsLoadingChampionData(false)
      activeOperationRef.current = null
    }
  }

  const browseForGame = async () => {
    const result = await window.api.browseGameFolder()
    if (result.success && result.gamePath) {
      setGamePath(result.gamePath)
      setStatusMessage(t('status.gamePathSet'))
    }
  }

  const handleSkinClick = (champion: Champion, skin: Skin, chromaId?: string) => {
    if (!gamePath) {
      setStatusMessage(t('status.pleaseSetGamePath'))
      return
    }

    // Check for existing selection (including old format for backward compatibility)
    const existingIndex = selectedSkins.findIndex((s) => {
      // Direct match
      if (
        s.championKey === champion.key &&
        s.skinId === skin.id &&
        s.chromaId === (chromaId || undefined)
      ) {
        return true
      }

      // Backward compatibility: match old format custom IDs by name
      if (
        skin.id.startsWith('custom_') &&
        s.skinId.startsWith('custom_') &&
        isOldFormatCustomId(s.skinId) &&
        s.championKey === champion.key &&
        s.skinName === skin.name &&
        s.chromaId === (chromaId || undefined)
      ) {
        return true
      }

      return false
    })

    if (existingIndex >= 0) {
      // Remove from selection
      setSelectedSkins((prev) => prev.filter((_, index) => index !== existingIndex))
    } else {
      // Add to selection
      const newSelectedSkin: SelectedSkin = {
        championKey: champion.key,
        championName: champion.name,
        skinId: skin.id,
        skinName: skin.name,
        skinNameEn: skin.nameEn,
        lolSkinsName: skin.lolSkinsName,
        skinNum: skin.num,
        chromaId: chromaId,
        isDownloaded: false // Will be checked when applying
      }
      setSelectedSkins((prev) => [...prev, newSelectedSkin])
    }
  }

  const handleDeleteCustomSkin = async (skinPath: string, skinName: string) => {
    const cleanedName = skinName.replace(/\[User\]\s*/, '').replace(/\.(wad|zip|fantome)$/, '')
    const result = await window.api.deleteCustomSkin(skinPath)

    if (result.success) {
      await loadDownloadedSkins()
      setStatusMessage(t('status.deletedCustomMod', { name: cleanedName }))
    } else {
      setStatusMessage(t('status.failedToDeleteMod', { error: result.error }))
    }
  }

  const handleEditCustomSkin = async (skinPath: string, currentName: string) => {
    setEditingCustomSkin({ path: skinPath, name: currentName })
    setShowEditDialog(true)
  }

  const handleDeleteDownloadedSkin = async (championName: string, skinName: string) => {
    const result = await window.api.deleteSkin(championName, skinName)

    if (result.success) {
      await loadDownloadedSkins()
      const cleanedName = skinName.replace(/\[User\]\s*/, '').replace(/\.(wad|zip|fantome)$/, '')
      setStatusMessage(t('status.deletedSkin', { name: cleanedName }))
    } else {
      setStatusMessage(t('status.failedToDeleteSkin', { error: result.error }))
    }
  }

  const applySelectedSkins = async () => {
    if (!gamePath || selectedSkins.length === 0) {
      return
    }

    // Prevent concurrent skin applications
    if (activeOperationRef.current === 'applySelectedSkins') {
      return
    }

    activeOperationRef.current = 'applySelectedSkins'
    setIsApplyingSkins(true)

    try {
      // Stop patcher if running
      if (isPatcherRunning) {
        setStatusMessage(t('status.stoppingCurrentPatcher'))
        await window.api.stopPatcher()
        await new Promise((resolve) => setTimeout(resolve, 500)) // Small delay
      }

      // Determine which skins to apply based on smart apply settings
      let skinsToApply = selectedSkins
      let isUsingSmartApply = false
      let smartApplySummary: any = null

      // Check if we should filter skins for smart apply
      const leagueClientEnabled = await window.api.getSettings('leagueClientEnabled')
      const smartApplyEnabled = await window.api.getSettings('smartApplyEnabled')
      const teamCompositionResult = await window.api.getTeamComposition()

      if (
        leagueClientEnabled &&
        smartApplyEnabled &&
        teamCompositionResult.success &&
        teamCompositionResult.composition &&
        teamCompositionResult.composition.championIds &&
        teamCompositionResult.composition.championIds.length > 0
      ) {
        console.log(
          '[App] Smart apply enabled, filtering skins for team:',
          teamCompositionResult.composition.championIds
        )

        // Get smart apply summary to know which skins to filter
        const summaryResult = await window.api.getSmartApplySummary(
          selectedSkins,
          teamCompositionResult.composition.championIds
        )

        if (summaryResult.success && summaryResult.summary) {
          smartApplySummary = summaryResult.summary
          const teamChampionKeys = new Set(smartApplySummary.teamChampions)

          // Filter skins to only include team champions and custom mods
          skinsToApply = selectedSkins.filter(
            (skin) => skin.championKey === 'Custom' || teamChampionKeys.has(skin.championKey)
          )

          isUsingSmartApply = true

          // Check if we have any skins to apply after filtering
          if (skinsToApply.length === 0) {
            setStatusMessage(t('smartApply.noSkinsForTeam'))
            setIsApplyingSkins(false)
            activeOperationRef.current = null
            return
          }

          console.log(
            `[App] Filtered ${selectedSkins.length} skins to ${skinsToApply.length} for smart apply`
          )
        }
      }

      const skinKeys: string[] = []

      // Show appropriate status message
      if (isUsingSmartApply) {
        setStatusMessage(
          t('smartApply.applying', {
            count: skinsToApply.length,
            champions: 'your team'
          })
        )
      }

      // Download any skins that aren't downloaded yet
      for (const selectedSkin of skinsToApply) {
        if (selectedSkin.championKey === 'Custom') {
          // Find the custom mod in downloadedSkins
          const userMod = downloadedSkins.find(
            (ds) => ds.skinName.includes('[User]') && ds.skinName.includes(selectedSkin.skinName)
          )
          if (userMod) {
            skinKeys.push(`${userMod.championName}/${userMod.skinName}`)
          }
          continue
        }

        const champion = championData?.champions.find((c) => c.key === selectedSkin.championKey)
        if (!champion) continue

        const skin = champion.skins.find((s) => s.id === selectedSkin.skinId)
        if (!skin) continue

        let skinFileName: string
        let githubUrl: string
        // Use proper name priority for downloading: lolSkinsName -> nameEn -> name
        const downloadName = (skin.lolSkinsName || skin.nameEn || skin.name).replace(/:/g, '')

        if (selectedSkin.chromaId) {
          // Handle chroma
          skinFileName = `${downloadName} ${selectedSkin.chromaId}.zip`
          const isChromaDownloaded = downloadedSkins.some(
            (ds) => ds.championName === champion.key && ds.skinName === skinFileName
          )

          if (!isChromaDownloaded) {
            const championNameForUrl = getChampionDisplayName(champion)
            githubUrl = `https://github.com/darkseal-org/lol-skins/blob/main/skins/${championNameForUrl}/chromas/${encodeURIComponent(downloadName)}/${encodeURIComponent(skinFileName)}`

            const displayMessage = isUsingSmartApply
              ? t('status.downloading', { name: `${skin.name} (Chroma) for your team` })
              : t('status.downloading', { name: `${skin.name} (Chroma)` })
            setStatusMessage(displayMessage)

            const downloadResult = await window.api.downloadSkin(githubUrl)
            if (!downloadResult.success) {
              throw new Error(downloadResult.error || 'Failed to download chroma')
            }
          }
        } else {
          // Handle regular skin
          skinFileName = `${downloadName}.zip`
          const isSkinDownloaded = downloadedSkins.some(
            (ds) => ds.championName === champion.key && ds.skinName === skinFileName
          )

          if (!isSkinDownloaded) {
            const championNameForUrl = getChampionDisplayName(champion)
            githubUrl = `https://github.com/darkseal-org/lol-skins/blob/main/skins/${championNameForUrl}/${encodeURIComponent(skinFileName)}`

            const displayMessage = isUsingSmartApply
              ? t('status.downloading', { name: `${skin.name} for your team` })
              : t('status.downloading', { name: skin.name })
            setStatusMessage(displayMessage)

            const downloadResult = await window.api.downloadSkin(githubUrl)
            if (!downloadResult.success) {
              throw new Error(downloadResult.error || 'Failed to download skin')
            }
          }
        }

        // Add skin key for the patcher (must use English name)
        const championNameForPatcher = getChampionDisplayName(champion)
        skinKeys.push(`${championNameForPatcher}/${skinFileName}`)
      }

      // Reload downloaded skins list
      await loadDownloadedSkins()

      console.log('skinKeys', skinKeys)

      // Update status message based on mode
      if (isUsingSmartApply) {
        setStatusMessage(
          t('smartApply.applying', {
            count: skinsToApply.length,
            champions: 'your team'
          })
        )
      } else {
        setStatusMessage(t('status.applying', { name: `${skinsToApply.length} skins` }))
      }

      // Run patcher with filtered skins
      const patcherResult = await window.api.runPatcher(gamePath, skinKeys)
      if (patcherResult.success) {
        if (isUsingSmartApply) {
          setStatusMessage(
            t('smartApply.success', {
              applied: skinsToApply.length,
              total: selectedSkins.length
            })
          )
        } else {
          setStatusMessage(t('status.applied', { name: `${skinsToApply.length} skins` }))
        }
        setIsPatcherRunning(true)

        // Start checking patcher status
        const intervalId = setInterval(async () => {
          const running = await window.api.isPatcherRunning()
          setIsPatcherRunning(running)
          if (!running) {
            clearInterval(intervalId)
            setStatusMessage(t('status.stopped'))
          }
        }, 1000)
      } else {
        throw new Error(patcherResult.message || 'Failed to apply skins')
      }
    } catch (error) {
      let errorMsg = error instanceof Error ? error.message : 'Unknown error'

      // Check if the error message is a translation key
      if (errorMsg.startsWith('errors.')) {
        errorMsg = t(errorMsg)
      }

      setErrorMessage(errorMsg)
      setStatusMessage(errorMsg)
      // Clear error after 10 seconds
      setTimeout(() => {
        setErrorMessage('')
        setStatusMessage('')
      }, 10000)
    } finally {
      setIsApplyingSkins(false)
      activeOperationRef.current = null
    }
  }

  const stopPatcher = async () => {
    setIsStoppingPatcher(true)
    setStatusMessage(t('status.stopping'))

    try {
      const result = await window.api.stopPatcher()
      if (result.success) {
        setStatusMessage(t('status.stopped'))
        setIsPatcherRunning(false)
      } else {
        setStatusMessage(
          t('status.failedToStopPatcher', { error: result.error || 'Unknown error' })
        )
      }
    } catch (error) {
      setStatusMessage(
        `Error stopping patcher: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setIsStoppingPatcher(false)
    }
  }

  // Filter champions based on search
  const filteredChampions =
    championData?.champions.filter((champ) => {
      const displayName = getChampionDisplayName(champ)
      return displayName.toLowerCase().includes(championSearchQuery.toLowerCase())
    }) || []

  const isSearchingGlobally = skinSearchQuery.trim().length > 0

  // Get all unique champion tags
  const getAllChampionTags = () => {
    const tagSet = new Set<string>()
    championData?.champions.forEach((champ) => {
      champ.tags.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }

  // Apply filters and sorting
  const applyFiltersAndSort = (skins: Array<{ champion: Champion; skin: Skin }>) => {
    let filtered = [...skins]

    // Apply download status filter
    if (filters.downloadStatus !== 'all') {
      filtered = filtered.filter(({ champion, skin }) => {
        const skinFileName = `${skin.nameEn || skin.name}.zip`.replace(/:/g, '')
        const isDownloaded = downloadedSkins.some(
          (ds) => ds.championName === champion.key && ds.skinName === skinFileName
        )
        return filters.downloadStatus === 'downloaded' ? isDownloaded : !isDownloaded
      })
    }

    // Apply chroma filter
    if (filters.chromaStatus !== 'all') {
      filtered = filtered.filter(({ skin }) => {
        return filters.chromaStatus === 'has-chromas' ? skin.chromas : !skin.chromas
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
          return a.skin.name.localeCompare(b.skin.name)
        case 'name-desc':
          return b.skin.name.localeCompare(a.skin.name)
        case 'skin-asc':
          return a.skin.num - b.skin.num
        case 'skin-desc':
          return b.skin.num - a.skin.num
        case 'champion': {
          const nameA = getChampionDisplayName(a.champion)
          const nameB = getChampionDisplayName(b.champion)
          return nameA.localeCompare(nameB) || a.skin.name.localeCompare(b.skin.name)
        }
        default:
          return 0
      }
    })

    return filtered
  }

  // Get filtered skins for display
  const getDisplaySkins = () => {
    if (!championData) return []

    const allSkins: Array<{ champion: Champion; skin: Skin }> = []

    if (isSearchingGlobally) {
      // Global search
      const searchLower = skinSearchQuery.toLowerCase()
      championData.champions.forEach((champion) => {
        champion.skins.forEach((skin) => {
          if (skin.num !== 0 && skin.name.toLowerCase().includes(searchLower)) {
            allSkins.push({ champion, skin })
          }
        })
      })
    } else if (selectedChampion) {
      // Selected champion skins
      selectedChampion.skins.forEach((skin) => {
        if (skin.num !== 0) {
          if (!showFavoritesOnly || favorites.has(`${selectedChampion.key}_${skin.id}`)) {
            allSkins.push({ champion: selectedChampion, skin })
          }
        }
      })

      // Add imported custom skins for this champion
      const customSkinsForChampion = downloadedSkins.filter(
        (ds) => ds.skinName.startsWith('[User]') && ds.championName === selectedChampion.key
      )
      customSkinsForChampion.forEach((mod, index) => {
        const skinName = mod.skinName.replace('[User] ', '').replace(/\.(wad|zip|fantome)$/, '')
        const customSkin: Skin = {
          id: `custom_${selectedChampion.key}_${generateCustomModId(selectedChampion.key, skinName, mod.localPath)}`,
          num: 9000 + index, // High number to appear at the end
          name: skinName,
          chromas: false
        }
        if (!showFavoritesOnly || favorites.has(`${selectedChampion.key}_${customSkin.id}`)) {
          allSkins.push({ champion: selectedChampion, skin: customSkin })
        }
      })
    } else if (selectedChampionKey === 'all') {
      // All champions skins
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
      // Custom mods - create fake skins from downloaded custom mods
      // Show all imported skins with [User] prefix
      const customMods = downloadedSkins.filter((ds) => ds.skinName.startsWith('[User]'))
      customMods.forEach((mod, index) => {
        // Create a fake champion and skin object for custom mods
        const customChampion: Champion = {
          id: -1,
          key: 'Custom',
          name: 'Custom Mods',
          title: 'User Imported',
          image: '',
          skins: [],
          tags: []
        }
        const skinName = mod.skinName.replace('[User] ', '').replace(/\.(wad|zip|fantome)$/, '')
        const customSkin: Skin = {
          id: `custom_${generateCustomModId('Custom', skinName, mod.localPath)}`,
          num: index + 1,
          name: skinName,
          chromas: false
        }
        allSkins.push({ champion: customChampion, skin: customSkin })
      })
    }

    return applyFiltersAndSort(allSkins)
  }

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      downloadStatus: 'all',
      chromaStatus: 'all',
      championTags: [],
      sortBy: 'name-asc'
    })
  }

  // Memoized champion select handler to prevent unnecessary re-renders
  const handleChampionSelect = useCallback(
    (champion: Champion | null, key: string) => {
      setSelectedChampion(champion)
      setSelectedChampionKey(key)
    },
    [setSelectedChampionKey]
  )

  // Calculate stats for filter panel
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

  // Global drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    console.log('Drag enter, counter:', dragCounter.current)
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

    console.log('Drop event triggered')
    console.log('DataTransfer files:', e.dataTransfer.files)
    console.log('Number of files:', e.dataTransfer.files.length)

    const files = Array.from(e.dataTransfer.files)
    console.log('Files array:', files)

    const skinFiles = files.filter((file) => {
      const ext = file.name.toLowerCase()
      const isSkinFile = ext.endsWith('.wad') || ext.endsWith('.zip') || ext.endsWith('.fantome')
      console.log(`File ${file.name} is skin file:`, isSkinFile)
      return isSkinFile
    })

    console.log('Skin files found:', skinFiles.length)
    console.log('fileUploadRef.current:', fileUploadRef.current)

    if (skinFiles.length > 0 && fileUploadRef.current) {
      // Use the webUtils.getPathForFile() exposed through preload
      const filePaths: string[] = []

      for (const file of skinFiles) {
        try {
          const filePath = window.api.getPathForFile(file)
          console.log('File path from webUtils:', filePath)
          if (filePath) {
            filePaths.push(filePath)
          }
        } catch (err) {
          console.error('Error getting file path:', err)
        }
      }

      console.log('File paths extracted:', filePaths)

      if (filePaths.length > 0) {
        fileUploadRef.current.handleDroppedFiles(filePaths)
      } else {
        // If we can't get paths, show an error
        console.error('Could not extract file paths from dropped files')
        alert('Unable to get file paths. Please use the browse button instead.')
      }
    }
  }

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
        onUpdate={handleChampionDataUpdate}
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
        <div className="flex items-center justify-between px-8 py-5 bg-surface border-b-2 border-border shadow-sm dark:shadow-none">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <input
                type="text"
                value={gamePath}
                placeholder="Game path not set"
                readOnly
                className="flex-1 px-4 py-2.5 text-sm bg-elevated border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              />
              <button
                className="px-4 py-2.5 text-sm bg-surface hover:bg-secondary-100 dark:hover:bg-secondary-800 text-text-primary font-medium rounded-lg transition-all duration-200 border border-border hover:border-border-strong shadow-sm hover:shadow-md dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={browseForGame}
                disabled={loading}
              >
                {t('actions.browse')}
              </button>
            </div>
            <button
              className={`px-4 py-2.5 text-sm rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium
                ${
                  showFavoritesOnly
                    ? 'bg-error/10 text-error hover:bg-error/20 border-2 border-error/30'
                    : 'bg-surface text-text-primary hover:bg-secondary-100 dark:hover:bg-secondary-800 border border-border shadow-sm hover:shadow-md dark:shadow-none'
                }`}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              disabled={loading}
            >
              <span className={showFavoritesOnly ? 'text-red-500' : ''}>❤️</span>{' '}
              {t('nav.favorites')}
            </button>
            {!championData && (
              <button
                className="px-5 py-2.5 text-sm bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-all duration-200 shadow-soft hover:shadow-medium dark:shadow-dark-soft disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                onClick={fetchChampionData}
                disabled={loading}
              >
                {t('champion.downloadData')}
              </button>
            )}
            <LCUStatusIndicator
              connected={lcuConnected}
              inChampSelect={isInChampSelect}
              enabled={leagueClientEnabled && championDetectionEnabled}
            />
            <button
              className="px-3 py-2.5 text-sm bg-surface hover:bg-secondary-100 dark:hover:bg-secondary-800 text-text-primary font-medium rounded-lg transition-all duration-200 border border-border hover:border-border-strong shadow-sm hover:shadow-md dark:shadow-none flex items-center gap-2"
              onClick={() => setShowSettingsDialog(true)}
              title={t('settings.title')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            <RoomPanel />
          </div>
        </div>

        {championData ? (
          <div className="flex flex-1 overflow-hidden">
            <div className="w-80 bg-elevated border-r-2 border-border flex flex-col shadow-md dark:shadow-none">
              <div className="p-6">
                <input
                  type="text"
                  placeholder={t('champion.searchPlaceholder')}
                  value={championSearchQuery}
                  onChange={(e) => setChampionSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                <AutoSizer>
                  {({ width, height }) => (
                    <VirtualizedChampionList
                      champions={filteredChampions}
                      selectedChampion={selectedChampion}
                      selectedChampionKey={selectedChampionKey}
                      onChampionSelect={handleChampionSelect}
                      height={height}
                      width={width}
                    />
                  )}
                </AutoSizer>
              </div>
              {championData && (
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
                onClearFilters={clearFilters}
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
              {(selectedChampion ||
                isSearchingGlobally ||
                selectedChampionKey === 'all' ||
                selectedChampionKey === 'custom') && (
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
                              onDeleteCustomSkin={handleDeleteCustomSkin}
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
                          onClick={clearFilters}
                          className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                        >
                          Clear all filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                onClick={fetchChampionData}
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
        onDeleteSkin={handleDeleteDownloadedSkin}
        onDeleteCustomSkin={handleDeleteCustomSkin}
        onRefresh={loadDownloadedSkins}
      />

      <FileTransferDialog championData={championData || undefined} />

      <SettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        onLeagueClientChange={(enabled) => setLeagueClientEnabled(enabled)}
        onChampionDetectionChange={(enabled) => setChampionDetectionEnabled(enabled)}
      />

      <ChampionSelectDialog
        champion={lcuSelectedChampion}
        isLocked={isChampionLocked}
        onViewSkins={onChampionNavigate}
        onClose={clearSelectedChampion}
      />
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
