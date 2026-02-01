import { useEffect, useRef, useCallback } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { Toaster, toast } from 'sonner'

// Components
import { TitleBar } from './components/TitleBar'
import { SelectedSkinsDrawer } from './components/SelectedSkinsDrawerWithP2P'
import { AppHeader } from './components/layout/AppHeader'

// Section Components
import { ToolsDownloadModal } from './components/sections/ToolsDownloadModal'
import { DragDropOverlay } from './components/sections/DragDropOverlay'
import { ChampionListSection } from './components/sections/ChampionListSection'
import { SkinBrowserSection } from './components/sections/SkinBrowserSection'
import { DialogsContainer } from './components/sections/DialogsContainer'
import { MainLayout } from './components/sections/MainLayout'
import { NoChampionData } from './components/sections/NoChampionData'

// Contexts
import { useLocale } from './contexts/useLocale'
import { LocaleProvider } from './contexts/LocaleContextProvider'
import { ThemeProvider } from './contexts/ThemeContext'
import { P2PProvider } from './contexts/P2PContext'

// Utils
import { getChampionDisplayName } from './utils/championUtils'
import { generateSkinFilename } from '../../shared/utils/skinFilename'

// Hooks
import { useGameDetection } from './hooks/useGameDetection'
import { useChampionData } from './hooks/useChampionData'
import { useSkinManagement } from './hooks/useSkinManagement'
import { usePatcherControl } from './hooks/usePatcherControl'
import { useAppInitialization } from './hooks/useAppInitialization'
import { useChampionSelectHandler } from './hooks/useChampionSelectHandler'
import { useP2PSkinSync } from './hooks/useP2PSkinSync'
import { useP2PChampionSync } from './hooks/useP2PChampionSync'
import { useStyles } from './hooks/useOptimizedState'

// Atoms
import { statusMessageAtom } from './store/atoms/game.atoms'
import { preDownloadedAutoSkinAtom } from './store/atoms'
import { selectedChampionAtom } from './store/atoms/champion.atoms'
import { editingCustomSkinAtom, showEditDialogAtom } from './store/atoms/ui.atoms'
import { appStateSelector, lcuStateSelector } from './store/atoms/selectors.atoms'
import { championDetectionEnabledAtom } from './store/atoms/settings.atoms'
import { selectedChampionKeyAtom, showFavoritesOnlyAtom, skinSearchQueryAtom } from './store/atoms'

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
  isInLolSkins?: boolean
  chromas: boolean
  chromaList?: Array<{
    id: number
    name: string
    chromaPath: string
    colors: string[]
  }>
  variants?: {
    type: string // "exalted", "form", etc.
    items: Array<{
      id: string
      name: string
      displayName?: string
      githubUrl: string
      downloadUrl?: string
      imageUrl?: string
    }>
  }
  rarity: string
  rarityGemPath: string | null
  isLegacy: boolean
  skinType: string
  skinLines?: Array<{ id: number }>
  description?: string
  winRate?: number
  pickRate?: number
  totalGames?: number
  author?: string // Author for custom/user mods
}

function AppContent(): React.JSX.Element {
  const { t } = useTranslation()

  // Initialize app
  useAppInitialization()

  // Use selector atoms for batched reads
  const appState = useAtomValue(appStateSelector)
  const { appVersion, errorMessage, statusMessage, isLoading: loading } = appState
  const lcuState = useAtomValue(lcuStateSelector)
  const { lcuSelectedChampion, autoViewSkinsEnabled } = lcuState

  // Only the atoms we need in this component
  const [, setSelectedChampion] = useAtom(selectedChampionAtom)
  const [, setEditingCustomSkin] = useAtom(editingCustomSkinAtom)
  const [, setShowEditDialog] = useAtom(showEditDialogAtom)
  const [, setSelectedChampionKey] = useAtom(selectedChampionKeyAtom)
  const [, setSkinSearchQuery] = useAtom(skinSearchQueryAtom)
  const [showFavoritesOnly, setShowFavoritesOnly] = useAtom(showFavoritesOnlyAtom)
  const championDetectionEnabled = useAtomValue(championDetectionEnabledAtom)
  const setStatusMessage = useSetAtom(statusMessageAtom)
  const [preDownloadedAutoSkin, setPreDownloadedAutoSkin] = useAtom(preDownloadedAutoSkinAtom)

  // Hooks
  const { currentLanguage } = useLocale()
  const { gamePath } = useGameDetection()
  const { championData, loadChampionData } = useChampionData()
  const {
    downloadedSkins,
    selectedSkins,
    setSelectedSkins,
    loadDownloadedSkins,
    applySelectedSkins
  } = useSkinManagement()
  const { isPatcherRunning, stopPatcher, cancelApply, isCancellingApply } = usePatcherControl()

  // Initialize P2P skin sync
  useP2PSkinSync(downloadedSkins)
  const { autoSyncedSkins } = useP2PChampionSync({ downloadedSkins })

  // Load champion data once on mount and when language changes
  useEffect(() => {
    loadChampionData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLanguage])

  // Refs
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
      const autoRandomHighestWinRateSkinEnabled = await window.api.getSettings(
        'autoRandomHighestWinRateSkinEnabled'
      )
      const autoRandomHighestPickRateSkinEnabled = await window.api.getSettings(
        'autoRandomHighestPickRateSkinEnabled'
      )
      const autoRandomMostPlayedSkinEnabled = await window.api.getSettings(
        'autoRandomMostPlayedSkinEnabled'
      )

      let availableSkins = champion.skins.filter((skin) => skin.num !== 0)

      // Fetch custom skins for this champion (only for modes that support them)
      let customSkins: any[] = []
      const isStatBasedMode =
        autoRandomRaritySkinEnabled ||
        autoRandomHighestWinRateSkinEnabled ||
        autoRandomHighestPickRateSkinEnabled ||
        autoRandomMostPlayedSkinEnabled

      if (!isStatBasedMode) {
        try {
          const downloadedSkinsResult = await window.api.listDownloadedSkins()
          if (downloadedSkinsResult.success && downloadedSkinsResult.skins) {
            // Filter for custom skins (source: 'user') that match this champion
            customSkins = downloadedSkinsResult.skins.filter((skin: any) => {
              // Check if it's a user-imported skin
              if (skin.source !== 'user') return false

              // Match champion name (case-insensitive)
              // Custom skins use championName, official skins use champion.name
              const skinChampionName = skin.championName?.toLowerCase()
              const currentChampionName = champion.name?.toLowerCase()
              const currentChampionKey = champion.key?.toLowerCase()

              return (
                skinChampionName === currentChampionName || skinChampionName === currentChampionKey
              )
            })

            console.log(
              `[AutoSelect] Found ${customSkins.length} custom skins for ${champion.name}`,
              customSkins.map((s) => ({ championName: s.championName, skinName: s.skinName }))
            )
          }
        } catch (error) {
          console.error('[AutoSelect] Failed to fetch custom skins:', error)
        }
      }

      const favoriteChromaOptions: Array<{
        skin?: Skin
        customSkin?: any
        chromaId?: string
        chromaName?: string
      }> = []

      if (autoRandomFavoriteSkinEnabled) {
        // Get favorites for this champion
        const favoritesResult = await window.api.getFavoritesByChampion(champion.key)
        console.log(`[AutoFavorite] Champion ${champion.key} favorites:`, favoritesResult.favorites)

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

        // Build list of favorited options (base skins and specific chromas)
        favoritesResult.favorites.forEach((fav) => {
          // Check if it's a custom skin favorite (skinId starts with 'custom_')
          if (fav.skinId.startsWith('custom_')) {
            // Find the custom skin in our list
            const customSkin = customSkins.find((cs: any) => {
              // The custom skin ID format is: custom_[User] skinName or custom_skinName
              // We need to match the skinName part from the favorite
              const favSkinName = fav.skinId.replace('custom_', '')
              console.log(
                `[AutoFavorite] Matching custom skin - favorite: "${favSkinName}" vs skin: "${cs.skinName}"`
              )
              return cs.skinName === favSkinName
            })
            if (customSkin) {
              console.log(`[AutoFavorite] Found matching custom skin for favorite:`, customSkin)
              favoriteChromaOptions.push({ customSkin })
            } else {
              console.log(
                `[AutoFavorite] No matching custom skin found for favorite: ${fav.skinId}`
              )
            }
          } else {
            // It's a regular skin favorite
            const skin = champion.skins.find((s) => String(s.id) === fav.skinId)
            if (skin && skin.num !== 0) {
              if (fav.chromaId) {
                // This is a specific chroma favorite
                favoriteChromaOptions.push({
                  skin,
                  chromaId: fav.chromaId,
                  chromaName: fav.chromaName
                })
              } else {
                // This is a base skin favorite
                favoriteChromaOptions.push({ skin })
              }
            }
          }
        })

        if (favoriteChromaOptions.length === 0) {
          console.log(`[AutoFavorite] No valid favorite skins found`)
          return
        }

        // For compatibility with existing code, we still need availableSkins
        availableSkins = [
          ...new Set(
            favoriteChromaOptions
              .filter((opt) => opt.skin !== undefined)
              .map((opt) => opt.skin as Skin)
          )
        ]

        console.log(
          `[AutoFavorite] Found ${favoriteChromaOptions.length} favorite options (including chromas)`,
          favoriteChromaOptions.map((opt) => ({
            name: opt.skin?.name || opt.customSkin?.skinName,
            chromaId: opt.chromaId
          }))
        )
      } else if (autoRandomRaritySkinEnabled) {
        // Filter to only rarity skins
        availableSkins = availableSkins.filter((skin) => skin.rarity && skin.rarity !== 'kNoRarity')
      } else if (autoRandomHighestWinRateSkinEnabled) {
        // Filter to skins with win rate data and sort by highest win rate
        console.log(
          `[AutoSelect] Checking skins for win rate selection:`,
          availableSkins.map((s) => ({ name: s.name, winRate: s.winRate }))
        )
        const skinsWithWinRate = availableSkins.filter((skin) => skin.winRate && skin.winRate > 0)
        console.log(`[AutoSelect] Found ${skinsWithWinRate.length} skins with win rate data`)
        if (skinsWithWinRate.length > 0) {
          // Sort by win rate descending and take top 3
          skinsWithWinRate.sort((a, b) => (b.winRate || 0) - (a.winRate || 0))
          availableSkins = skinsWithWinRate.slice(0, 3)
          console.log(
            `[AutoSelect] Top 3 by win rate:`,
            availableSkins.map((s) => ({ name: s.name, winRate: s.winRate }))
          )
        }
      } else if (autoRandomHighestPickRateSkinEnabled) {
        // Filter to skins with pick rate data and sort by highest pick rate
        console.log(
          `[AutoSelect] Checking skins for pick rate selection:`,
          availableSkins.map((s) => ({ name: s.name, pickRate: s.pickRate }))
        )
        const skinsWithPickRate = availableSkins.filter(
          (skin) => skin.pickRate && skin.pickRate > 0
        )
        console.log(`[AutoSelect] Found ${skinsWithPickRate.length} skins with pick rate data`)
        if (skinsWithPickRate.length > 0) {
          // Sort by pick rate descending and take top 3
          skinsWithPickRate.sort((a, b) => (b.pickRate || 0) - (a.pickRate || 0))
          availableSkins = skinsWithPickRate.slice(0, 3)
          console.log(
            `[AutoSelect] Top 3 by pick rate:`,
            availableSkins.map((s) => ({ name: s.name, pickRate: s.pickRate }))
          )
        }
      } else if (autoRandomMostPlayedSkinEnabled) {
        // Filter to skins with total games data and sort by most played
        console.log(
          `[AutoSelect] Checking skins for most played selection:`,
          availableSkins.map((s) => ({ name: s.name, totalGames: s.totalGames }))
        )
        const skinsWithGames = availableSkins.filter(
          (skin) => skin.totalGames && skin.totalGames > 0
        )
        console.log(`[AutoSelect] Found ${skinsWithGames.length} skins with total games data`)
        if (skinsWithGames.length > 0) {
          // Sort by total games descending and take top 3
          skinsWithGames.sort((a, b) => (b.totalGames || 0) - (a.totalGames || 0))
          availableSkins = skinsWithGames.slice(0, 3)
          console.log(
            `[AutoSelect] Top 3 by total games:`,
            availableSkins.map((s) => ({ name: s.name, totalGames: s.totalGames }))
          )
        }
      }

      // For basic random mode (no specific mode enabled), include custom skins
      let allAvailableOptions: Array<{
        type: 'official' | 'custom'
        skin?: Skin
        customSkin?: any
      }> = []

      if (!isStatBasedMode && !autoRandomFavoriteSkinEnabled) {
        // Basic random mode - include both official and custom skins
        allAvailableOptions = [
          ...availableSkins.map((skin) => ({ type: 'official' as const, skin })),
          ...customSkins.map((customSkin) => ({ type: 'custom' as const, customSkin }))
        ]
        console.log(
          `[AutoSelect] Basic random mode: ${availableSkins.length} official skins + ${customSkins.length} custom skins`
        )
      } else if (!autoRandomFavoriteSkinEnabled) {
        // Stat-based modes - only official skins
        allAvailableOptions = availableSkins.map((skin) => ({ type: 'official' as const, skin }))
      }

      if (availableSkins.length === 0 && customSkins.length === 0) {
        console.log(`[AutoFavorite] No available skins found, returning early`)
        return
      }

      // Select a random skin or chroma
      let randomSkin: Skin | undefined
      let randomCustomSkin: any | undefined
      let selectedChromaId: string | undefined
      let isCustomSkinSelected = false

      if (autoRandomFavoriteSkinEnabled && favoriteChromaOptions.length > 0) {
        // Select from favorite options (which may include specific chromas or custom skins)
        const randomOption =
          favoriteChromaOptions[Math.floor(Math.random() * favoriteChromaOptions.length)]

        if (randomOption.customSkin) {
          // Selected a custom skin from favorites
          randomCustomSkin = randomOption.customSkin
          isCustomSkinSelected = true
          console.log(`[AutoFavorite] Selected random favorite custom skin:`, {
            championName: randomCustomSkin.championName,
            skinName: randomCustomSkin.skinName
          })
        } else if (randomOption.skin) {
          // Selected a regular skin from favorites
          randomSkin = randomOption.skin
          selectedChromaId = randomOption.chromaId
          console.log(`[AutoFavorite] Selected random favorite:`, {
            name: randomSkin.name,
            id: randomSkin.id,
            chromaId: selectedChromaId
          })
        }
      } else if (allAvailableOptions.length > 0) {
        // Select from all available options (basic random mode or stat-based modes)
        const randomOption =
          allAvailableOptions[Math.floor(Math.random() * allAvailableOptions.length)]

        if (randomOption.type === 'custom') {
          randomCustomSkin = randomOption.customSkin
          isCustomSkinSelected = true
          console.log(`[AutoSelect] Selected random custom skin:`, {
            championName: randomCustomSkin.championName,
            skinName: randomCustomSkin.skinName
          })
        } else {
          randomSkin = randomOption.skin
          console.log(`[AutoSelect] Selected random skin:`, {
            name: randomSkin?.name,
            id: randomSkin?.id
          })
        }
      } else if (availableSkins.length > 0) {
        // Fallback for stat-based modes
        const randomIndex = Math.floor(Math.random() * availableSkins.length)
        randomSkin = availableSkins[randomIndex]
        console.log(`[AutoSelect] Selected random skin:`, {
          name: randomSkin.name,
          id: randomSkin.id
        })
      }

      // Add the auto-selected skin
      let newSelectedSkin: any

      if (isCustomSkinSelected && randomCustomSkin) {
        // Create a selected skin object for custom skin
        newSelectedSkin = {
          championKey: champion.key,
          championName: champion.name,
          championId: champion.id, // Store numeric ID for ID-based repositories
          skinId: `custom_${randomCustomSkin.skinName}`, // Format: custom_[User] skinName
          skinName: randomCustomSkin.skinName,
          skinNameEn: randomCustomSkin.skinName, // Custom skins don't have separate EN names
          skinNum: -1, // Custom skins don't have a num
          isDownloaded: true, // Custom skins are already downloaded
          isAutoSelected: true,
          isCustom: true,
          localPath: randomCustomSkin.localPath
        }
        console.log(`[AutoSelect] Created custom skin selection:`, newSelectedSkin)
      } else if (randomSkin) {
        // Create a selected skin object for official skin
        newSelectedSkin = {
          championKey: champion.key,
          championName: champion.name,
          championId: champion.id, // Store numeric ID for ID-based repositories
          skinId: randomSkin.id,
          skinName: randomSkin.name,
          skinNameEn: randomSkin.nameEn,
          skinNum: randomSkin.num,
          chromaId: selectedChromaId,
          isDownloaded: false,
          isAutoSelected: true
        }
        console.log(`[AutoFavorite] Created newSelectedSkin:`, newSelectedSkin)
      } else {
        console.log('[AutoSelect] No skin selected, returning')
        return
      }

      // Send the auto-selected skin to main process for overlay display
      try {
        if (isCustomSkinSelected && randomCustomSkin) {
          console.log(`[AutoSelect] Sending custom skin to overlay:`, {
            championKey: champion.key,
            skinName: randomCustomSkin.skinName
          })
          await window.api.setOverlayAutoSelectedSkin({
            championKey: champion.key,
            championName: champion.name,
            skinId: newSelectedSkin.skinId,
            skinName: randomCustomSkin.skinName,
            skinNum: -1, // Custom skins don't have a num
            rarity: undefined
          })
        } else if (randomSkin) {
          console.log(`[AutoSelect] Sending skin to overlay:`, {
            championKey: champion.key,
            skinName: randomSkin.name,
            skinNum: randomSkin.num
          })
          await window.api.setOverlayAutoSelectedSkin({
            championKey: champion.key,
            championName: champion.name,
            skinId: randomSkin.id,
            skinName: randomSkin.name,
            skinNum: randomSkin.num,
            rarity: randomSkin.rarity
          })
        }
        console.log(`[AutoSelect] Successfully sent skin to overlay`)
      } catch (error) {
        console.error('[AutoSelect] Failed to send auto-selected skin to main process:', error)
      }

      // Clean up previous auto-selected skin if it exists
      if (preDownloadedAutoSkin) {
        try {
          // Delete the previously downloaded auto-selected skin from disk
          await window.api.deleteSkin(
            preDownloadedAutoSkin.championName,
            preDownloadedAutoSkin.skinFileName
          )
          console.log(
            `Deleted previous auto-selected skin: ${preDownloadedAutoSkin.championName}/${preDownloadedAutoSkin.skinFileName}`
          )
        } catch (error) {
          console.error('Failed to delete previous auto-selected skin:', error)
        }
      }

      // Remove previous auto-selected skins and add the new one
      setSelectedSkins((prev) => {
        // Filter out any existing auto-selected skins
        const filteredSkins = prev.filter((skin) => !skin.isAutoSelected)
        console.log(`[AutoFavorite] Previous selected skins (filtered):`, filteredSkins)
        // Add the new auto-selected skin
        const newSkins = [...filteredSkins, newSelectedSkin]
        console.log(`[AutoFavorite] New selected skins list:`, newSkins)
        return newSkins
      })

      // Pre-download the auto-selected skin in the background (only for official skins)
      if (!isCustomSkinSelected && randomSkin) {
        const skinFileName = generateSkinFilename(randomSkin)
        const championNameForUrl = getChampionDisplayName(champion)

        // Construct URL using repository service
        const urlResult = await window.api.repositoryConstructUrl(
          championNameForUrl,
          skinFileName,
          false,
          undefined, // chromaBase
          champion.id // Pass championId for ID-based repositories
        )
        if (!urlResult.success || !urlResult.url) {
          console.error('Failed to construct download URL for auto-selected skin')
          return
        }
        const githubUrl = urlResult.url

        // Update tracking for the new auto-selected skin
        setPreDownloadedAutoSkin({
          championKey: champion.key,
          championName: champion.key, // Use key for file system operations
          skinFileName,
          downloadUrl: githubUrl
        })

        // Check if already downloaded
        const downloadedSkinsResult = await window.api.listDownloadedSkins()
        if (downloadedSkinsResult.success) {
          const isAlreadyDownloaded = downloadedSkinsResult.skins?.some(
            (ds) => ds.championName === champion.key && ds.skinName === skinFileName
          )

          if (!isAlreadyDownloaded) {
            // Download in the background
            console.log(`Pre-downloading auto-selected skin: ${champion.name} - ${randomSkin.name}`)
            window.api.downloadSkin(githubUrl).then((result) => {
              if (result.success) {
                console.log(`Successfully pre-downloaded: ${randomSkin.name}`)
                // Update the skin's download status
                setSelectedSkins((prev) =>
                  prev.map((skin) =>
                    skin.skinId === randomSkin.id && skin.isAutoSelected
                      ? { ...skin, isDownloaded: true }
                      : skin
                  )
                )
                // Reload downloaded skins list
                loadDownloadedSkins()
              } else {
                console.error(`Failed to pre-download skin: ${result.error}`)
              }
            })
          } else {
            // Skin is already downloaded, update the status
            setSelectedSkins((prev) =>
              prev.map((skin) =>
                skin.skinId === randomSkin.id && skin.isAutoSelected
                  ? { ...skin, isDownloaded: true }
                  : skin
              )
            )
          }
        }
      } else if (isCustomSkinSelected) {
        // Custom skin is already downloaded, no pre-download needed
        console.log(
          `[AutoSelect] Custom skin already available locally: ${randomCustomSkin.skinName}`
        )
      }
    }
  })

  // Handle auto-navigation when champion is selected
  useEffect(() => {
    if (lcuSelectedChampion && autoViewSkinsEnabled) {
      onChampionNavigate()
      clearSelectedChampion()
    }
  }, [lcuSelectedChampion, autoViewSkinsEnabled, onChampionNavigate, clearSelectedChampion])

  // Handle overlay skin selection
  useEffect(() => {
    const handleOverlaySkinSelected = (_event: any, skin: any) => {
      // Check if skin is already selected
      const existingIndex = selectedSkins.findIndex(
        (s) =>
          s.championKey === skin.championKey &&
          s.skinId === skin.skinId &&
          s.chromaId === skin.chromaId
      )

      if (existingIndex === -1) {
        // Add to selected skins
        setSelectedSkins((prev) => [...prev, skin])
        setStatusMessage(t('status.skinAddedFromOverlay', { name: skin.skinName }))
      }
    }

    // Listen for overlay skin selection
    window.electron.ipcRenderer.on('overlay:skin-selected', handleOverlaySkinSelected)

    return () => {
      window.electron.ipcRenderer.removeListener('overlay:skin-selected', handleOverlaySkinSelected)
    }
  }, [selectedSkins, setSelectedSkins, setStatusMessage, t])

  // Handle file association imports
  useEffect(() => {
    // Notify main process that renderer is ready
    window.api.notifyRendererReady()

    // Function to check and process pending files with retry
    const checkPendingFiles = async (retryCount = 0) => {
      const files = await window.api.getPendingFiles()

      if (files.length > 0) {
        if (fileUploadRef.current) {
          // Ref is ready, process files
          fileUploadRef.current.handleDroppedFiles(files)
          // Clear pending files after successful processing
          window.api.clearPendingFiles()
        } else if (retryCount < 10) {
          // Ref not ready yet, retry after a short delay
          setTimeout(() => checkPendingFiles(retryCount + 1), 100)
        }
      }
    }

    // Check for pending files after a short delay to ensure components are mounted
    setTimeout(() => checkPendingFiles(), 500)

    // Listen for files opened while app is running
    const unsubscribe = window.api.onFilesToImport((filePaths) => {
      if (fileUploadRef.current) {
        fileUploadRef.current.handleDroppedFiles(filePaths)
      } else {
        // If ref not ready, retry a few times
        let retries = 0
        const retryInterval = setInterval(() => {
          if (fileUploadRef.current || retries >= 10) {
            if (fileUploadRef.current) {
              fileUploadRef.current.handleDroppedFiles(filePaths)
            }
            clearInterval(retryInterval)
          }
          retries++
        }, 100)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Clean up auto-selected skins when leaving champion select or disabling auto-selection
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      // Note: We don't delete the downloaded file here since the user might want to use it later
    }
  }, [])

  // Listen for auto-accept events
  useEffect(() => {
    const unsubscribe = window.api.onLcuReadyCheckAccepted(() => {
      toast.success(t('status.autoAcceptedMatch'), {
        duration: 3000,
        position: 'top-center'
      })
    })

    return () => {
      unsubscribe()
    }
  }, [t])

  // Handle skin click
  const handleSkinClick = useCallback(
    (champion: Champion, skin: Skin, chromaId?: string, variantId?: string) => {
      if (!gamePath) {
        setStatusMessage(t('status.pleaseSetGamePath'))
        return
      }

      // Check for existing selection
      const existingIndex = selectedSkins.findIndex((s) => {
        return (
          s.championKey === champion.key &&
          s.skinId === skin.id &&
          s.chromaId === (chromaId || undefined) &&
          s.variantId === (variantId || undefined)
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
          championId: champion.id, // Store numeric ID for ID-based repositories
          skinId: skin.id,
          skinName: skin.name,
          skinNameEn: skin.nameEn,
          isInLolSkins: skin.isInLolSkins,
          skinNum: skin.num,
          chromaId: chromaId,
          variantId: variantId,
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
      // Extract champion from path
      const fileName = skinPath.split(/[\\/]/).pop() || ''
      const championMatch = fileName.match(/^([^_]+)_/)
      const currentChampion = championMatch?.[1] === 'Custom' ? '' : championMatch?.[1]

      setEditingCustomSkin({
        path: skinPath,
        name: currentName,
        champion: currentChampion // Keep empty string here, will be converted to __none__ in the dialog
      })
      setShowEditDialog(true)
    },
    [setEditingCustomSkin, setShowEditDialog]
  )

  // Get styles
  const styles = useStyles()

  return (
    <>
      <TitleBar appVersion={appVersion} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'sonner-toast',
          duration: 5000,
          style: styles.toastStyle
        }}
      />
      <MainLayout fileUploadRef={fileUploadRef}>
        <ToolsDownloadModal />
        <AppHeader />

        {championData ? (
          <div className="flex flex-1 overflow-hidden">
            <ChampionListSection />
            <SkinBrowserSection
              loading={loading}
              onEditCustomSkin={handleEditCustomSkin}
              onSkinClick={handleSkinClick}
              selectedSkins={selectedSkins}
              fileUploadRef={fileUploadRef}
            />
          </div>
        ) : (
          <NoChampionData loading={loading} />
        )}

        <SelectedSkinsDrawer
          onApplySkins={applySelectedSkins}
          onStopPatcher={stopPatcher}
          onCancelApply={cancelApply}
          loading={loading}
          isPatcherRunning={isPatcherRunning}
          isCancellingApply={isCancellingApply}
          downloadedSkins={downloadedSkins}
          championData={championData || undefined}
          statusMessage={statusMessage}
          errorMessage={errorMessage}
          gamePath={gamePath}
          autoSyncedSkins={autoSyncedSkins}
        />

        <DragDropOverlay />
      </MainLayout>

      <DialogsContainer />
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
