import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAtom } from 'jotai'
import { selectedChampionKeyAtom } from '../store/atoms'
import type { Champion } from '../App'

interface ChampionSelectData {
  championId: number
  isLocked: boolean
  isHover: boolean
}

interface UseChampionSelectHandlerProps {
  champions?: Champion[]
  onNavigateToChampion?: (champion: Champion) => void
  enabled?: boolean
}

export function useChampionSelectHandler({
  champions,
  onNavigateToChampion,
  enabled = true
}: UseChampionSelectHandlerProps) {
  const { t } = useTranslation()
  const [lcuConnected, setLcuConnected] = useState(false)
  const [gameflowPhase, setGameflowPhase] = useState<string>('None')
  const [leagueClientEnabled, setLeagueClientEnabled] = useState(true)
  const [settingEnabled, setSettingEnabled] = useState(true)
  const lastSelectedChampionIdRef = useRef<number | null>(null)
  const [, setSelectedChampionKey] = useAtom(selectedChampionKeyAtom)

  // State for champion selection dialog
  const [selectedChampionData, setSelectedChampionData] = useState<{
    champion: Champion | null
    isLocked: boolean
  }>({ champion: null, isLocked: false })

  // Check if champion detection is enabled in settings
  useEffect(() => {
    Promise.all([
      window.api.getSettings('leagueClientEnabled'),
      window.api.getSettings('championDetection')
    ]).then(([leagueClient, championDetection]) => {
      // Default to true if not set
      setLeagueClientEnabled(leagueClient !== false)
      setSettingEnabled(championDetection !== false)
    })
  }, [])

  // Initialize LCU connection status
  useEffect(() => {
    if (!enabled || !leagueClientEnabled || !settingEnabled) return

    // Check initial status
    window.api.lcuGetStatus().then((status) => {
      setLcuConnected(status.connected)
      setGameflowPhase(status.gameflowPhase)
    })

    // Set up event listeners
    const unsubscribeConnected = window.api.onLcuConnected(() => {
      setLcuConnected(true)
      toast.success(t('lcu.connected'), {
        duration: 3000
      })
    })

    const unsubscribeDisconnected = window.api.onLcuDisconnected(() => {
      setLcuConnected(false)
      setGameflowPhase('None')
      toast.error(t('lcu.disconnected'), {
        duration: 3000
      })
    })

    const unsubscribePhaseChanged = window.api.onLcuPhaseChanged((data) => {
      setGameflowPhase(data.phase)

      // Reset last selected champion when leaving champion select
      if (data.previousPhase === 'ChampSelect' && data.phase !== 'ChampSelect') {
        lastSelectedChampionIdRef.current = null
      }
    })

    return () => {
      unsubscribeConnected()
      unsubscribeDisconnected()
      unsubscribePhaseChanged()
    }
  }, [enabled, leagueClientEnabled, settingEnabled, t])

  const handleChampionSelection = useCallback(
    (data: ChampionSelectData) => {
      if (!enabled || !leagueClientEnabled || !settingEnabled) {
        return
      }

      if (!champions || champions.length === 0) {
        // Store the event data to retry when champions are loaded
        setTimeout(() => {
          if (champions && champions.length > 0) {
            handleChampionSelection(data)
          }
        }, 1000)
        return
      }

      // Avoid duplicate notifications
      if (lastSelectedChampionIdRef.current === data.championId) {
        return
      }

      lastSelectedChampionIdRef.current = data.championId

      // Find the champion by ID
      const champion = champions.find((c) => c.id === data.championId)
      if (!champion) {
        console.warn(`Champion with ID ${data.championId} not found`)
        return
      }

      // Set the selected champion data for the dialog
      setSelectedChampionData({
        champion,
        isLocked: data.isLocked
      })
    },
    [champions, enabled, leagueClientEnabled, settingEnabled]
  )

  // Set up champion selected event listener separately
  useEffect(() => {
    if (!enabled || !leagueClientEnabled || !settingEnabled) return

    const unsubscribeChampionSelected = window.api.onLcuChampionSelected(
      (data: ChampionSelectData) => {
        handleChampionSelection(data)
      }
    )

    return () => {
      unsubscribeChampionSelected()
    }
  }, [enabled, leagueClientEnabled, settingEnabled, champions, handleChampionSelection])

  const handleChampionNavigate = useCallback(() => {
    if (selectedChampionData.champion) {
      if (onNavigateToChampion) {
        onNavigateToChampion(selectedChampionData.champion)
      } else {
        setSelectedChampionKey(selectedChampionData.champion.key)
      }
    }
  }, [selectedChampionData.champion, onNavigateToChampion, setSelectedChampionKey])

  const clearSelectedChampion = useCallback(() => {
    setSelectedChampionData({ champion: null, isLocked: false })
  }, [])

  return {
    lcuConnected: settingEnabled ? lcuConnected : false,
    gameflowPhase: settingEnabled ? gameflowPhase : 'None',
    isInChampSelect: settingEnabled && gameflowPhase === 'ChampSelect',
    selectedChampion: selectedChampionData.champion,
    isChampionLocked: selectedChampionData.isLocked,
    onChampionNavigate: handleChampionNavigate,
    clearSelectedChampion
  }
}
