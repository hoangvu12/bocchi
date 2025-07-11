import { useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAtom, useSetAtom } from 'jotai'
import { selectedChampionKeyAtom } from '../store/atoms'
import {
  lcuConnectedAtom,
  isInChampSelectAtom,
  lcuSelectedChampionAtom,
  isChampionLockedAtom,
  autoViewSkinsEnabledAtom,
  autoRandomRaritySkinEnabledAtom,
  autoRandomFavoriteSkinEnabledAtom
} from '../store/atoms/lcu.atoms'
import {
  leagueClientEnabledAtom,
  championDetectionEnabledAtom
} from '../store/atoms/settings.atoms'
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
  onAutoSelectSkin?: (champion: Champion) => void
}

export function useChampionSelectHandler({
  champions,
  onNavigateToChampion,
  enabled = true,
  onAutoSelectSkin
}: UseChampionSelectHandlerProps) {
  const { t } = useTranslation()

  // Use atoms instead of local state
  const [lcuConnected, setLcuConnected] = useAtom(lcuConnectedAtom)
  const [isInChampSelect, setIsInChampSelect] = useAtom(isInChampSelectAtom)
  const [lcuSelectedChampion, setLcuSelectedChampion] = useAtom(lcuSelectedChampionAtom)
  const [isChampionLocked, setIsChampionLocked] = useAtom(isChampionLockedAtom)
  const [autoViewSkinsEnabled] = useAtom(autoViewSkinsEnabledAtom)
  const [autoRandomRaritySkinEnabled] = useAtom(autoRandomRaritySkinEnabledAtom)
  const [autoRandomFavoriteSkinEnabled] = useAtom(autoRandomFavoriteSkinEnabledAtom)
  const [leagueClientEnabled] = useAtom(leagueClientEnabledAtom)
  const [championDetectionEnabled] = useAtom(championDetectionEnabledAtom)
  const setSelectedChampionKey = useSetAtom(selectedChampionKeyAtom)

  const lastSelectedChampionIdRef = useRef<number | null>(null)
  const gameflowPhaseRef = useRef<string>('None')

  // Settings are now loaded in useAppInitialization hook

  // Initialize LCU connection status
  useEffect(() => {
    if (!enabled || !leagueClientEnabled || !championDetectionEnabled) return

    // Check initial status
    window.api.lcuGetStatus().then((status) => {
      setLcuConnected(status.connected)
      gameflowPhaseRef.current = status.gameflowPhase
      setIsInChampSelect(status.gameflowPhase === 'ChampSelect')
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
      gameflowPhaseRef.current = 'None'
      setIsInChampSelect(false)
      setLcuSelectedChampion(null)
      setIsChampionLocked(false)
      toast.error(t('lcu.disconnected'), {
        duration: 3000
      })
    })

    const unsubscribePhaseChanged = window.api.onLcuPhaseChanged((data) => {
      gameflowPhaseRef.current = data.phase
      setIsInChampSelect(data.phase === 'ChampSelect')

      // Reset last selected champion when leaving champion select
      if (data.previousPhase === 'ChampSelect' && data.phase !== 'ChampSelect') {
        lastSelectedChampionIdRef.current = null
        setLcuSelectedChampion(null)
        setIsChampionLocked(false)
      }
    })

    return () => {
      unsubscribeConnected()
      unsubscribeDisconnected()
      unsubscribePhaseChanged()
    }
  }, [
    enabled,
    leagueClientEnabled,
    championDetectionEnabled,
    t,
    setLcuConnected,
    setIsInChampSelect,
    setLcuSelectedChampion,
    setIsChampionLocked
  ])

  const handleChampionSelection = useCallback(
    (data: ChampionSelectData) => {
      if (!enabled || !leagueClientEnabled || !championDetectionEnabled) {
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
        console.warn(`[ChampionSelectHandler] Champion with ID ${data.championId} not found`)
        return
      }

      // Set the selected champion data in atoms
      setLcuSelectedChampion(champion)
      setIsChampionLocked(data.isLocked)

      // Handle auto random skin selection
      if (onAutoSelectSkin && (autoRandomRaritySkinEnabled || autoRandomFavoriteSkinEnabled)) {
        onAutoSelectSkin(champion)
      }
    },
    [
      champions,
      enabled,
      leagueClientEnabled,
      championDetectionEnabled,
      autoRandomRaritySkinEnabled,
      autoRandomFavoriteSkinEnabled,
      onAutoSelectSkin,
      setLcuSelectedChampion,
      setIsChampionLocked
    ]
  )

  // Set up champion selected event listener separately
  useEffect(() => {
    if (!enabled || !leagueClientEnabled || !championDetectionEnabled) return

    const unsubscribeChampionSelected = window.api.onLcuChampionSelected(
      (data: ChampionSelectData) => {
        handleChampionSelection(data)
      }
    )

    return () => {
      unsubscribeChampionSelected()
    }
  }, [enabled, leagueClientEnabled, championDetectionEnabled, champions, handleChampionSelection])

  const handleChampionNavigate = useCallback(() => {
    if (lcuSelectedChampion) {
      if (onNavigateToChampion) {
        onNavigateToChampion(lcuSelectedChampion)
      } else {
        setSelectedChampionKey(lcuSelectedChampion.key)
      }
    }
  }, [lcuSelectedChampion, onNavigateToChampion, setSelectedChampionKey])

  const clearSelectedChampion = useCallback(() => {
    setLcuSelectedChampion(null)
    setIsChampionLocked(false)
  }, [setLcuSelectedChampion, setIsChampionLocked])

  return {
    lcuConnected: championDetectionEnabled ? lcuConnected : false,
    gameflowPhase: championDetectionEnabled ? gameflowPhaseRef.current : 'None',
    isInChampSelect: championDetectionEnabled && isInChampSelect,
    selectedChampion: lcuSelectedChampion,
    isChampionLocked,
    autoViewSkinsEnabled,
    autoRandomSkinEnabled: false, // Not used anymore, kept for compatibility
    autoRandomRaritySkinEnabled,
    onChampionNavigate: handleChampionNavigate,
    clearSelectedChampion
  }
}
