import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { appVersionAtom, showUpdateDialogAtom } from '../store/atoms/game.atoms'
import { championSearchQueryAtom, skinSearchQueryAtom } from '../store/atoms'
import {
  leagueClientEnabledAtom,
  championDetectionEnabledAtom,
  smartApplyEnabledAtom,
  autoApplyEnabledAtom,
  autoApplyTriggerTimeAtom
} from '../store/atoms/settings.atoms'
import {
  autoViewSkinsEnabledAtom,
  autoRandomRaritySkinEnabledAtom,
  autoRandomFavoriteSkinEnabledAtom,
  autoRandomHighestWinRateSkinEnabledAtom,
  autoRandomHighestPickRateSkinEnabledAtom,
  autoRandomMostPlayedSkinEnabledAtom,
  autoAcceptEnabledAtom,
  autoPickEnabledAtom,
  autoPickForceAtom,
  autoPickChampionsAtom,
  autoBanEnabledAtom,
  autoBanForceAtom,
  autoBanChampionsAtom
} from '../store/atoms/lcu.atoms'
import { showSettingsDialogAtom } from '../store/atoms/ui.atoms'

// This hook initializes all app settings and state on mount
export function useAppInitialization() {
  const setAppVersion = useSetAtom(appVersionAtom)
  const setShowUpdateDialog = useSetAtom(showUpdateDialogAtom)
  const setChampionSearchQuery = useSetAtom(championSearchQueryAtom)
  const setSkinSearchQuery = useSetAtom(skinSearchQueryAtom)
  const setLeagueClientEnabled = useSetAtom(leagueClientEnabledAtom)
  const setChampionDetectionEnabled = useSetAtom(championDetectionEnabledAtom)
  const setAutoViewSkinsEnabled = useSetAtom(autoViewSkinsEnabledAtom)
  const setAutoRandomRaritySkinEnabled = useSetAtom(autoRandomRaritySkinEnabledAtom)
  const setAutoRandomFavoriteSkinEnabled = useSetAtom(autoRandomFavoriteSkinEnabledAtom)
  const setAutoRandomHighestWinRateSkinEnabled = useSetAtom(autoRandomHighestWinRateSkinEnabledAtom)
  const setAutoRandomHighestPickRateSkinEnabled = useSetAtom(
    autoRandomHighestPickRateSkinEnabledAtom
  )
  const setAutoRandomMostPlayedSkinEnabled = useSetAtom(autoRandomMostPlayedSkinEnabledAtom)
  const setSmartApplyEnabled = useSetAtom(smartApplyEnabledAtom)
  const setAutoApplyEnabled = useSetAtom(autoApplyEnabledAtom)
  const setAutoApplyTriggerTime = useSetAtom(autoApplyTriggerTimeAtom)
  const setAutoAcceptEnabled = useSetAtom(autoAcceptEnabledAtom)
  const setAutoPickEnabled = useSetAtom(autoPickEnabledAtom)
  const setAutoPickForce = useSetAtom(autoPickForceAtom)
  const setAutoPickChampions = useSetAtom(autoPickChampionsAtom)
  const setAutoBanEnabled = useSetAtom(autoBanEnabledAtom)
  const setAutoBanForce = useSetAtom(autoBanForceAtom)
  const setAutoBanChampions = useSetAtom(autoBanChampionsAtom)
  const setShowSettingsDialog = useSetAtom(showSettingsDialogAtom)

  // Load app version
  useEffect(() => {
    const loadAppVersion = async () => {
      try {
        const version = await window.api.getAppVersion()
        setAppVersion(version)
      } catch (error) {
        console.error('Failed to load app version:', error)
      }
    }

    loadAppVersion()
  }, [setAppVersion])

  // Set up update event listeners
  useEffect(() => {
    const unsubscribe = window.api.onUpdateAvailable((info) => {
      console.log('Update available:', info)
      setShowUpdateDialog(true)
    })

    return () => {
      unsubscribe()
    }
  }, [setShowUpdateDialog])

  // Set up open settings event listener for tray menu
  useEffect(() => {
    const unsubscribe = window.api.onOpenSettings(() => {
      setShowSettingsDialog(true)
    })

    return () => {
      unsubscribe()
    }
  }, [setShowSettingsDialog])

  // Clear search queries on mount
  useEffect(() => {
    setChampionSearchQuery('')
    setSkinSearchQuery('')
  }, [setChampionSearchQuery, setSkinSearchQuery])

  // Load settings
  useEffect(() => {
    Promise.all([
      window.api.getSettings('leagueClientEnabled'),
      window.api.getSettings('championDetection'),
      window.api.getSettings('autoViewSkinsEnabled'),
      window.api.getSettings('autoRandomRaritySkinEnabled'),
      window.api.getSettings('autoRandomFavoriteSkinEnabled'),
      window.api.getSettings('autoRandomHighestWinRateSkinEnabled'),
      window.api.getSettings('autoRandomHighestPickRateSkinEnabled'),
      window.api.getSettings('autoRandomMostPlayedSkinEnabled'),
      window.api.getSettings('smartApplyEnabled'),
      window.api.getSettings('autoApplyEnabled'),
      window.api.getSettings('autoApplyTriggerTime'),
      window.api.getSettings('autoAcceptEnabled'),
      window.api.getSettings('autoPickEnabled'),
      window.api.getSettings('autoPickForce'),
      window.api.getSettings('autoPickChampions'),
      window.api.getSettings('autoBanEnabled'),
      window.api.getSettings('autoBanForce'),
      window.api.getSettings('autoBanChampions')
    ]).then(
      ([
        leagueClient,
        championDetection,
        autoViewSkins,
        autoRandomRaritySkin,
        autoRandomFavoriteSkin,
        autoRandomHighestWinRateSkin,
        autoRandomHighestPickRateSkin,
        autoRandomMostPlayedSkin,
        smartApply,
        autoApply,
        autoApplyTriggerTime,
        autoAccept,
        autoPickEnabled,
        autoPickForce,
        autoPickChampions,
        autoBanEnabled,
        autoBanForce,
        autoBanChampions
      ]) => {
        setLeagueClientEnabled(leagueClient !== false)
        setChampionDetectionEnabled(championDetection !== false)
        setAutoViewSkinsEnabled(autoViewSkins === true)
        setAutoRandomRaritySkinEnabled(autoRandomRaritySkin === true)
        setAutoRandomFavoriteSkinEnabled(autoRandomFavoriteSkin === true)
        setAutoRandomHighestWinRateSkinEnabled(autoRandomHighestWinRateSkin === true)
        setAutoRandomHighestPickRateSkinEnabled(autoRandomHighestPickRateSkin === true)
        setAutoRandomMostPlayedSkinEnabled(autoRandomMostPlayedSkin === true)
        setSmartApplyEnabled(smartApply !== false) // Default to true
        setAutoApplyEnabled(autoApply !== false) // Default to true
        setAutoApplyTriggerTime(autoApplyTriggerTime || 15) // Default to 15 seconds
        setAutoAcceptEnabled(autoAccept === true)
        setAutoPickEnabled(autoPickEnabled === true)
        setAutoPickForce(autoPickForce === true)
        setAutoPickChampions(autoPickChampions || [])
        setAutoBanEnabled(autoBanEnabled === true)
        setAutoBanForce(autoBanForce === true)
        setAutoBanChampions(autoBanChampions || [])
      }
    )
  }, [
    setLeagueClientEnabled,
    setChampionDetectionEnabled,
    setAutoViewSkinsEnabled,
    setAutoRandomRaritySkinEnabled,
    setAutoRandomFavoriteSkinEnabled,
    setAutoRandomHighestWinRateSkinEnabled,
    setAutoRandomHighestPickRateSkinEnabled,
    setAutoRandomMostPlayedSkinEnabled,
    setSmartApplyEnabled,
    setAutoApplyEnabled,
    setAutoApplyTriggerTime,
    setAutoAcceptEnabled,
    setAutoPickEnabled,
    setAutoPickForce,
    setAutoPickChampions,
    setAutoBanEnabled,
    setAutoBanForce,
    setAutoBanChampions
  ])
}
