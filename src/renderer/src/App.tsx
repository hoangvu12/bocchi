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
  const { gamePath } = useGameDetection()
  const { championData } = useChampionData()
  const {
    downloadedSkins,
    selectedSkins,
    setSelectedSkins,
    loadDownloadedSkins,
    applySelectedSkins
  } = useSkinManagement()
  const { isPatcherRunning, stopPatcher } = usePatcherControl()

  // Initialize P2P skin sync
  useP2PSkinSync(downloadedSkins)
  const { autoSyncedSkins } = useP2PChampionSync({ downloadedSkins })

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

      let availableSkins = champion.skins.filter((skin) => skin.num !== 0)

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

        // Filter skins to only those that are favorited
        // Convert both skinId (string) and skin.id (number) to strings for comparison
        availableSkins = champion.skins.filter((skin) => {
          const found = favoritesResult.favorites?.some((fav) => fav.skinId === String(skin.id))
          console.log(
            `[AutoFavorite] Checking skin ${skin.name} (id: ${skin.id}, type: ${typeof skin.id}) against favorites - found: ${found}`
          )
          return found || false
        })
        console.log(
          `[AutoFavorite] Filtered available skins:`,
          availableSkins.map((s) => ({ name: s.name, id: s.id }))
        )
      } else if (autoRandomRaritySkinEnabled) {
        // Filter to only rarity skins
        availableSkins = availableSkins.filter((skin) => skin.rarity && skin.rarity !== 'kNoRarity')
      }

      if (availableSkins.length === 0) {
        console.log(`[AutoFavorite] No available skins found, returning early`)
        return
      }

      // Select a random skin
      const randomIndex = Math.floor(Math.random() * availableSkins.length)
      const randomSkin = availableSkins[randomIndex]
      console.log(`[AutoFavorite] Selected random skin:`, {
        name: randomSkin.name,
        id: randomSkin.id
      })

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
      console.log(`[AutoFavorite] Created newSelectedSkin:`, newSelectedSkin)

      // Send the auto-selected skin to main process for overlay display
      try {
        await window.api.setOverlayAutoSelectedSkin({
          championKey: champion.key,
          championName: champion.name,
          skinId: randomSkin.id,
          skinName: randomSkin.name,
          skinNum: randomSkin.num,
          rarity: randomSkin.rarity
        })
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

      // Pre-download the auto-selected skin in the background
      const skinFileName = generateSkinFilename(randomSkin)
      const championNameForUrl = getChampionDisplayName(champion)
      const githubUrl = `https://github.com/darkseal-org/lol-skins/blob/main/skins/${championNameForUrl}/${encodeURIComponent(
        skinFileName
      )}`

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
            />
          </div>
        ) : (
          <NoChampionData loading={loading} />
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

        <DragDropOverlay />
      </MainLayout>

      <DialogsContainer
        onChampionNavigate={onChampionNavigate}
        clearSelectedChampion={clearSelectedChampion}
        handleSkinClick={handleSkinClick}
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
