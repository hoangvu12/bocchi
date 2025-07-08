import { useCallback, useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import {
  isPatcherRunningAtom,
  statusMessageAtom,
  loadingStatesAtom
} from '../store/atoms/game.atoms'

export function usePatcherControl() {
  const { t } = useTranslation()
  const [isPatcherRunning, setIsPatcherRunning] = useAtom(isPatcherRunningAtom)
  const setStatusMessage = useSetAtom(statusMessageAtom)
  const [loadingStates, setLoadingStates] = useAtom(loadingStatesAtom)

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
      console.log('[Patcher] Phase changed:', data)

      // Post-game phases where we should stop the patcher
      const postGamePhases = ['WaitingForStats', 'PreEndOfGame', 'EndOfGame', 'Lobby']

      if (postGamePhases.includes(data.phase)) {
        const autoApplyEnabled = await window.api.getSettings('autoApplyEnabled')

        if (autoApplyEnabled !== false) {
          const isRunning = await window.api.isPatcherRunning()
          if (isRunning) {
            console.log('[Patcher] Game ended with auto-apply enabled, stopping patcher')
            await stopPatcher()
          }
        }
      }
    })

    return () => {
      unsubscribePhase()
    }
  }, [stopPatcher])

  return {
    isPatcherRunning,
    checkPatcherStatus,
    stopPatcher,
    isStoppingPatcher: loadingStates.isStoppingPatcher
  }
}
