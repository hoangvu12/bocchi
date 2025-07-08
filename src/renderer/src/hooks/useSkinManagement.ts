import { useCallback, useEffect } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { downloadedSkinsAtom, favoritesAtom } from '../store/atoms/skin.atoms'
import { championDataAtom } from '../store/atoms/champion.atoms'
import {
  gamePathAtom,
  statusMessageAtom,
  errorMessageAtom,
  loadingStatesAtom,
  activeOperationAtom,
  isPatcherRunningAtom
} from '../store/atoms/game.atoms'
import { selectedSkinsAtom } from '../store/atoms'
import { getChampionDisplayName } from '../utils/championUtils'
import type { Champion, Skin } from '../App'

export function useSkinManagement() {
  const { t } = useTranslation()
  const [downloadedSkins, setDownloadedSkins] = useAtom(downloadedSkinsAtom)
  const [favorites, setFavorites] = useAtom(favoritesAtom)
  const [selectedSkins, setSelectedSkins] = useAtom(selectedSkinsAtom)
  const gamePath = useAtomValue(gamePathAtom)
  const championData = useAtomValue(championDataAtom)
  const isPatcherRunning = useAtomValue(isPatcherRunningAtom)
  const setStatusMessage = useSetAtom(statusMessageAtom)
  const setErrorMessage = useSetAtom(errorMessageAtom)
  const setIsPatcherRunning = useSetAtom(isPatcherRunningAtom)
  const [loadingStates, setLoadingStates] = useAtom(loadingStatesAtom)
  const [activeOperation, setActiveOperation] = useAtom(activeOperationAtom)

  const loadDownloadedSkins = useCallback(async () => {
    const result = await window.api.listDownloadedSkins()
    if (result.success && result.skins) {
      setDownloadedSkins(result.skins)
    }
  }, [setDownloadedSkins])

  const loadFavorites = useCallback(async () => {
    const result = await window.api.getFavorites()
    if (result.success && result.favorites) {
      const favoriteKeys = new Set(result.favorites.map((f) => `${f.championKey}_${f.skinId}`))
      setFavorites(favoriteKeys)
    }
  }, [setFavorites])

  // Load downloaded skins and favorites on mount
  useEffect(() => {
    loadDownloadedSkins()
    loadFavorites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependency array for mount only

  const toggleFavorite = useCallback(
    async (champion: Champion, skin: Skin) => {
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
    },
    [favorites, setFavorites]
  )

  const deleteCustomSkin = useCallback(
    async (skinPath: string, skinName: string) => {
      const cleanedName = skinName.replace(/\[User\]\s*/, '').replace(/\.(wad|zip|fantome)$/, '')
      const result = await window.api.deleteCustomSkin(skinPath)

      if (result.success) {
        await loadDownloadedSkins()
        setStatusMessage(t('status.deletedCustomMod', { name: cleanedName }))
      } else {
        setStatusMessage(t('status.failedToDeleteMod', { error: result.error }))
      }
    },
    [loadDownloadedSkins, setStatusMessage, t]
  )

  const deleteDownloadedSkin = useCallback(
    async (championName: string, skinName: string) => {
      const result = await window.api.deleteSkin(championName, skinName)

      if (result.success) {
        await loadDownloadedSkins()
        const cleanedName = skinName.replace(/\[User\]\s*/, '').replace(/\.(wad|zip|fantome)$/, '')
        setStatusMessage(t('status.deletedSkin', { name: cleanedName }))
      } else {
        setStatusMessage(t('status.failedToDeleteSkin', { error: result.error }))
      }
    },
    [loadDownloadedSkins, setStatusMessage, t]
  )

  const applySelectedSkins = useCallback(async () => {
    if (!gamePath || selectedSkins.length === 0) {
      return
    }

    // Prevent concurrent skin applications
    if (activeOperation === 'applySelectedSkins') {
      return
    }

    setActiveOperation('applySelectedSkins')
    setLoadingStates((prev) => ({ ...prev, isApplyingSkins: true }))

    try {
      // Stop patcher if running
      if (isPatcherRunning) {
        setStatusMessage(t('status.stoppingCurrentPatcher'))
        await window.api.stopPatcher()
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      // Determine which skins to apply based on smart apply settings
      let skinsToApply = selectedSkins
      let isUsingSmartApply = false

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
        const summaryResult = await window.api.getSmartApplySummary(
          selectedSkins,
          teamCompositionResult.composition.championIds
        )

        if (summaryResult.success && summaryResult.summary) {
          const teamChampionKeys = new Set(summaryResult.summary.teamChampions)

          skinsToApply = selectedSkins.filter(
            (skin) => skin.championKey === 'Custom' || teamChampionKeys.has(skin.championKey)
          )

          isUsingSmartApply = true

          if (skinsToApply.length === 0) {
            setStatusMessage(t('smartApply.noSkinsForTeam'))
            setLoadingStates((prev) => ({ ...prev, isApplyingSkins: false }))
            setActiveOperation(null)
            return
          }
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
        const downloadName = (skin.lolSkinsName || skin.nameEn || skin.name).replace(/:/g, '')

        if (selectedSkin.chromaId) {
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

        const championNameForPatcher = getChampionDisplayName(champion)
        skinKeys.push(`${championNameForPatcher}/${skinFileName}`)
      }

      // Reload downloaded skins list
      await loadDownloadedSkins()

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
      setLoadingStates((prev) => ({ ...prev, isApplyingSkins: false }))
      setActiveOperation(null)
    }
  }, [
    gamePath,
    selectedSkins,
    activeOperation,
    isPatcherRunning,
    championData,
    downloadedSkins,
    t,
    loadDownloadedSkins,
    setActiveOperation,
    setLoadingStates,
    setStatusMessage,
    setErrorMessage,
    setIsPatcherRunning
  ])

  return {
    downloadedSkins,
    favorites,
    selectedSkins,
    setSelectedSkins,
    loadDownloadedSkins,
    loadFavorites,
    toggleFavorite,
    deleteCustomSkin,
    deleteDownloadedSkin,
    applySelectedSkins,
    isApplyingSkins: loadingStates.isApplyingSkins
  }
}
