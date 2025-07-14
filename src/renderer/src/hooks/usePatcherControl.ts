import { useCallback, useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import {
  isPatcherRunningAtom,
  statusMessageAtom,
  loadingStatesAtom
} from '../store/atoms/game.atoms'
import { selectedSkinsAtom } from '../store/atoms'
import { downloadedSkinsAtom } from '../store/atoms/skin.atoms'

export function usePatcherControl() {
  const { t } = useTranslation()
  const [isPatcherRunning, setIsPatcherRunning] = useAtom(isPatcherRunningAtom)
  const setStatusMessage = useSetAtom(statusMessageAtom)
  const [loadingStates, setLoadingStates] = useAtom(loadingStatesAtom)
  const [selectedSkins, setSelectedSkins] = useAtom(selectedSkinsAtom)
  const [downloadedSkins, setDownloadedSkins] = useAtom(downloadedSkinsAtom)

  const checkPatcherStatus = useCallback(async () => {
    const isRunning = await window.api.isPatcherRunning()
    setIsPatcherRunning(isRunning)
  }, [setIsPatcherRunning])

  const stopPatcher = useCallback(async () => {
    setLoadingStates((prev) => ({ ...prev, isStoppingPatcher: true }))
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
      setLoadingStates((prev) => ({ ...prev, isStoppingPatcher: false }))
    }
  }, [t, setIsPatcherRunning, setStatusMessage, setLoadingStates])

  // Check patcher status on mount
  useEffect(() => {
    checkPatcherStatus()
  }, [checkPatcherStatus])

  // Monitor LCU phase changes to update patcher status
  useEffect(() => {
    const unsubscribePhase = window.api.onLcuPhaseChanged(async (data) => {
      // Post-game phases where we should stop the patcher
      const postGamePhases = ['WaitingForStats', 'PreEndOfGame', 'EndOfGame']

      // Check if we're actually coming from a game to lobby (post-game)
      const isPostGameLobby =
        data.phase === 'Lobby' &&
        ['WaitingForStats', 'PreEndOfGame', 'EndOfGame'].includes(data.previousPhase)

      // Check if we're leaving champion select without entering game (dodge)
      const leavingChampSelect =
        data.previousPhase === 'ChampSelect' &&
        !['InGame', 'GameStart', 'InProgress'].includes(data.phase)

      if (postGamePhases.includes(data.phase) || isPostGameLobby || leavingChampSelect) {
        const autoApplyEnabled = await window.api.getSettings('autoApplyEnabled')

        if (autoApplyEnabled !== false) {
          const isRunning = await window.api.isPatcherRunning()
          if (isRunning) {
            await stopPatcher()
          }
        }

        // Clean up auto-selected skins after game ends or when leaving champ select
        const autoRandomRaritySkinEnabled = await window.api.getSettings(
          'autoRandomRaritySkinEnabled'
        )
        if (
          autoRandomRaritySkinEnabled &&
          (postGamePhases.includes(data.phase) || isPostGameLobby || leavingChampSelect)
        ) {
          const autoSelectedSkins = selectedSkins.filter((skin) => skin.isAutoSelected)

          if (autoSelectedSkins.length > 0) {
            // Remove auto-selected skins from the selection
            setSelectedSkins((prev) => prev.filter((skin) => !skin.isAutoSelected))

            // Delete downloaded files for auto-selected skins
            for (const skin of autoSelectedSkins) {
              if (skin.championKey !== 'Custom') {
                // Find the downloaded skin file
                const downloadedSkin = downloadedSkins.find(
                  (ds) =>
                    ds.championName === skin.championKey &&
                    (ds.skinName.includes(skin.skinNameEn || skin.skinName) ||
                      ds.skinName.includes(skin.lolSkinsName || skin.skinName))
                )

                if (downloadedSkin) {
                  await window.api.deleteSkin(downloadedSkin.championName, downloadedSkin.skinName)
                }
              }
            }

            // Reload downloaded skins list
            const result = await window.api.listDownloadedSkins()
            if (result.success && result.skins) {
              setDownloadedSkins(result.skins)
            }

            setStatusMessage(
              t('status.autoSelectedSkinsCleanedUp', { count: autoSelectedSkins.length })
            )
          }
        }
      }
    })

    return () => {
      unsubscribePhase()
    }
  }, [
    stopPatcher,
    selectedSkins,
    setSelectedSkins,
    downloadedSkins,
    setDownloadedSkins,
    setStatusMessage,
    t
  ])

  return {
    isPatcherRunning,
    checkPatcherStatus,
    stopPatcher,
    isStoppingPatcher: loadingStates.isStoppingPatcher
  }
}
