import { useEffect, useState, useRef, useCallback } from 'react'
import { useAtom } from 'jotai'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { selectedSkinsAtom, autoSyncedSkinsAtom } from '../store/atoms'
import {
  leagueClientEnabledAtom,
  smartApplyEnabledAtom,
  autoApplyEnabledAtom
} from '../store/atoms/settings.atoms'
import { currentQueueIdAtom } from '../store/atoms/lcu.atoms'
import { PRESELECT_CHAMPION_QUEUE_IDS } from '../constants/queues'

interface TeamComposition {
  championIds: number[]
  allLocked: boolean
  inFinalization: boolean
  updateKey?: number
}

interface SmartApplySummary {
  totalSelected: number
  willApply: number
  teamChampions: string[]
  customModCount: number
}

interface UseSmartSkinApplyProps {
  enabled?: boolean
  gamePath?: string
  onApplyStart?: () => void
  onApplyComplete?: (success: boolean) => void
}

export function useSmartSkinApply({
  enabled = true,
  gamePath,
  onApplyStart,
  onApplyComplete,
  parentApplyFunction
}: UseSmartSkinApplyProps & { parentApplyFunction?: (championIds?: number[]) => void } = {}) {
  const { t } = useTranslation()
  const [selectedSkins] = useAtom(selectedSkinsAtom)
  const [autoSyncedSkinsMap] = useAtom(autoSyncedSkinsAtom)
  const [teamComposition, setTeamComposition] = useState<TeamComposition | null>(null)
  const [leagueClientEnabled] = useAtom(leagueClientEnabledAtom)
  const [smartApplyEnabled] = useAtom(smartApplyEnabledAtom)
  const [autoApplyEnabled] = useAtom(autoApplyEnabledAtom)
  const [currentQueueId] = useAtom(currentQueueIdAtom)
  const [isApplying, setIsApplying] = useState(false)
  const lastAppliedTeamKey = useRef<string>('')

  // Get all auto-synced skins as a flat array
  const autoSyncedSkins = Array.from(autoSyncedSkinsMap.values()).flat()

  // Handle team composition updates
  useEffect(() => {
    if (!enabled || !leagueClientEnabled) return

    // Listen for phase changes to reset when entering new champion select
    const unsubscribePhase = window.api.onLcuPhaseChanged((data) => {
      // Reset when entering champion select from a different phase
      // This handles the case where user finished a game and starts a new one
      if (data.phase === 'ChampSelect' && data.previousPhase !== 'ChampSelect') {
        lastAppliedTeamKey.current = ''

        // Only stop patcher if auto-apply is enabled AND we're confident it's not a preselect queue
        if (autoApplyEnabled) {
          const isPreselectQueue =
            currentQueueId !== null && PRESELECT_CHAMPION_QUEUE_IDS.includes(currentQueueId)

          // Queue ID should be available immediately now thanks to lobby monitoring
          // Only stop patcher if it's NOT a preselect queue
          if (!isPreselectQueue) {
            window.api.isPatcherRunning().then((isRunning) => {
              if (isRunning) {
                window.api.stopPatcher()
              }
            })
          }
        }
      }
    })

    // Also reset on LCU reconnection (could be a new game session)
    const unsubscribeLcuConnected = window.api.onLcuConnected(() => {
      lastAppliedTeamKey.current = ''
    })

    const unsubscribeComposition = window.api.onTeamCompositionUpdated(
      (composition: TeamComposition) => {
        setTeamComposition(composition)
      }
    )

    const unsubscribeReady = window.api.onReadyForSmartApply(
      async (composition: TeamComposition) => {
        // Check if patcher is already running
        const isPatcherRunning = await window.api.isPatcherRunning()
        if (isPatcherRunning) {
          return
        }

        if (!autoApplyEnabled || !gamePath || isApplying) return

        // Create a unique key for this team composition
        const teamKey = composition.championIds.sort().join('-')

        // Don't apply if we already applied for this exact team
        if (teamKey === lastAppliedTeamKey.current) {
          return
        }

        // Check if we have any skins selected at all
        if (selectedSkins.length === 0) {
          return
        }

        // If smart apply is enabled, get summary to filter skins
        if (smartApplyEnabled) {
          const result = await window.api.getSmartApplySummary(
            selectedSkins,
            composition.championIds,
            autoSyncedSkins
          )

          if (result.success && result.summary) {
            const summary = result.summary as SmartApplySummary

            if (summary.willApply === 0) {
              // Don't show toast for no skins - this is expected behavior
              return
            }
          }
        }

        // Apply the skins using parent function
        // The parent function (from App.tsx) handles all the loading states and error handling properly

        parentApplyFunction?.()
        lastAppliedTeamKey.current = teamKey
      }
    )

    const unsubscribeReset = window.api.onTeamReset((newPhase) => {
      setTeamComposition(null)
      // Reset the applied state when leaving champion select
      lastAppliedTeamKey.current = ''

      // Stop patcher when:
      // 1. Dodging/leaving to None/Lobby (but only if auto-apply is enabled)
      // 2. The main App.tsx will handle stopping when transitioning to post-game phases

      // Only handle the dodge case here
      const gameAndPostGamePhases = [
        'GameStart',
        'InProgress',
        'WaitingForStats',
        'PreEndOfGame',
        'EndOfGame',
        'ReadyCheck',
        'Matchmaking'
      ]
      if (newPhase && !gameAndPostGamePhases.includes(newPhase)) {
        // Only stop patcher if auto-apply is enabled AND it's not a preselect queue
        if (autoApplyEnabled) {
          const isPreselectQueue =
            currentQueueId !== null && PRESELECT_CHAMPION_QUEUE_IDS.includes(currentQueueId)

          // Queue ID should be available thanks to lobby monitoring
          if (!isPreselectQueue) {
            window.api.isPatcherRunning().then((isRunning) => {
              if (isRunning) {
                window.api.stopPatcher()
              }
            })
          }
        }
      }
    })

    // Listen for preselect mode events
    const unsubscribePreselectReady = window.api.onPreselectReadyForApply(async (snapshot) => {
      // Check if patcher is already running
      const isPatcherRunning = await window.api.isPatcherRunning()
      if (isPatcherRunning) return

      if (!autoApplyEnabled || !gamePath || isApplying) return

      const championIds = snapshot.champions
        .map((champ: any) => champ.championId)
        .filter((id: number) => id > 0)

      // Create a unique key for this team composition from snapshot
      const teamKey = championIds.sort().join('-')

      // Don't apply if we already applied for this exact team
      if (teamKey === lastAppliedTeamKey.current) return

      // Check if we have any skins selected at all
      if (selectedSkins.length === 0) return

      console.log('[useSmartSkinApply] Triggering Swiftplay auto-apply:', championIds)
      toast.success(
        t('smartApply.preselect.applying', { default: 'Applying skins for Swiftplay...' })
      )

      // Apply the skins using parent function with champion IDs for smart filtering
      parentApplyFunction?.(championIds)
      lastAppliedTeamKey.current = teamKey
    })

    const unsubscribePreselectModeDetected = window.api.onPreselectModeDetected((data) => {
      console.log('[useSmartSkinApply] Preselect mode detected:', data)
      toast.info(
        t('smartApply.preselect.detected', {
          default: `${data.queueId === 480 ? 'Swiftplay' : 'Preselect'} mode detected - Smart Apply ready!`
        })
      )
    })

    const unsubscribePreselectChampionsChanged = window.api.onPreselectChampionsChanged(
      (champions) => {
        console.log(
          '[useSmartSkinApply] Preselect champions changed:',
          champions.map((c: any) => c.championId)
        )

        // Update team composition with preselect champions
        const championIds = champions
          .map((champ: any) => champ.championId)
          .filter((id: number) => id > 0)

        if (championIds.length > 0) {
          setTeamComposition({
            championIds,
            allLocked: false, // Not locked until queue starts
            inFinalization: false,
            updateKey: Date.now() // Force new object identity for React effects
          })
        }
      }
    )

    const unsubscribePreselectSnapshot = window.api.onPreselectSnapshotTaken((snapshot) => {
      console.log('[useSmartSkinApply] Preselect snapshot taken:', snapshot)
      toast.info(
        t('smartApply.preselect.snapshot', { default: 'Champions locked for matchmaking' })
      )
    })

    const unsubscribePreselectQueueCancelled = window.api.onPreselectQueueCancelled(() => {
      console.log('[useSmartSkinApply] Preselect queue cancelled')
      // Reset applied state so user can requeue and apply again
      lastAppliedTeamKey.current = ''
    })

    const unsubscribePreselectCancelApply = window.api.onPreselectCancelApply(async () => {
      console.log('[useSmartSkinApply] Swiftplay queue cancelled - stopping patcher')
      try {
        await window.api.stopPatcher()
        lastAppliedTeamKey.current = ''
      } catch (error) {
        console.error('[useSmartSkinApply] Error stopping patcher:', error)
      }
    })

    return () => {
      unsubscribePhase()
      unsubscribeLcuConnected()
      unsubscribeComposition()
      unsubscribeReady()
      unsubscribeReset()
      unsubscribePreselectReady()
      unsubscribePreselectModeDetected()
      unsubscribePreselectChampionsChanged()
      unsubscribePreselectSnapshot()
      unsubscribePreselectQueueCancelled()
      unsubscribePreselectCancelApply()
    }
  }, [
    enabled,
    leagueClientEnabled,
    autoApplyEnabled,
    smartApplyEnabled,
    gamePath,
    selectedSkins,
    isApplying,
    t,
    parentApplyFunction,
    autoSyncedSkins,
    currentQueueId
  ])

  const applySkins = useCallback(
    async (teamChampionIds?: number[]) => {
      if (!gamePath || isApplying) return

      setIsApplying(true)
      onApplyStart?.()

      try {
        const championIds = teamChampionIds || teamComposition?.championIds || []

        if (leagueClientEnabled && smartApplyEnabled && championIds.length > 0) {
          // Use smart apply
          const result = await window.api.smartApplySkins(
            gamePath,
            selectedSkins,
            championIds,
            autoSyncedSkins
          )

          if (result.success) {
            onApplyComplete?.(true)
          } else {
            onApplyComplete?.(false)
          }
        } else {
          // Fallback to regular apply
          const skinKeys = selectedSkins.map((skin) => {
            // Handle custom mods without champion (old format)
            if (skin.championKey === 'Custom') {
              return `Custom/[User] ${skin.skinName}`
            }

            // Handle custom mods with champion assigned (new format)
            // These have skinId starting with "custom_[User] "
            if (skin.skinId.startsWith('custom_[User] ')) {
              // Extract the filename from skinId after "custom_"
              const modFileName = skin.skinId.replace('custom_', '')
              return `${skin.championKey}/${modFileName}`
            }

            // Regular skins from repository
            // Use proper name priority for downloading from repository: lolSkinsName -> nameEn -> name
            const skinNameToUse = (skin.lolSkinsName || skin.skinNameEn || skin.skinName).replace(
              /:/g,
              ''
            )
            const skinNameWithChroma = skin.chromaId
              ? `${skinNameToUse} ${skin.chromaId}.zip`
              : `${skinNameToUse}.zip`
            return `${skin.championKey}/${skinNameWithChroma}`
          })

          const result = await window.api.runPatcher(gamePath, skinKeys)

          if (result.success) {
            onApplyComplete?.(true)
          } else {
            toast.error(result.message || t('errors.generic'))
            onApplyComplete?.(false)
          }
        }
      } catch {
        toast.error(t('errors.generic'))
        onApplyComplete?.(false)
      } finally {
        setIsApplying(false)
      }
    },
    [
      gamePath,
      isApplying,
      teamComposition,
      leagueClientEnabled,
      smartApplyEnabled,
      selectedSkins,
      onApplyStart,
      onApplyComplete,
      t,
      autoSyncedSkins
    ]
  )

  const getSmartApplySummary = useCallback(async () => {
    if (!teamComposition || teamComposition.championIds.length === 0) {
      return null
    }

    const result = await window.api.getSmartApplySummary(
      selectedSkins,
      teamComposition.championIds,
      autoSyncedSkins
    )
    return result.success ? (result.summary as SmartApplySummary) : null
  }, [teamComposition, selectedSkins, autoSyncedSkins])

  return {
    teamComposition,
    leagueClientEnabled,
    smartApplyEnabled,
    autoApplyEnabled,
    isApplying,
    isReadyForSmartApply:
      leagueClientEnabled && teamComposition?.allLocked && teamComposition?.inFinalization,
    applySkins,
    getSmartApplySummary
  }
}
