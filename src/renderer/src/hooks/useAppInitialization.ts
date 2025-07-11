import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { appVersionAtom, showUpdateDialogAtom } from '../store/atoms/game.atoms'
import { championSearchQueryAtom, skinSearchQueryAtom } from '../store/atoms'
import {
  leagueClientEnabledAtom,
  championDetectionEnabledAtom,
  smartApplyEnabledAtom,
  autoApplyEnabledAtom
} from '../store/atoms/settings.atoms'
import {
  autoViewSkinsEnabledAtom,
  autoRandomRaritySkinEnabledAtom,
  autoAcceptEnabledAtom
} from '../store/atoms/lcu.atoms'

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
  const setSmartApplyEnabled = useSetAtom(smartApplyEnabledAtom)
  const setAutoApplyEnabled = useSetAtom(autoApplyEnabledAtom)
  const setAutoAcceptEnabled = useSetAtom(autoAcceptEnabledAtom)

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
      window.api.getSettings('smartApplyEnabled'),
      window.api.getSettings('autoApplyEnabled'),
      window.api.getSettings('autoAcceptEnabled')
    ]).then(
      ([
        leagueClient,
        championDetection,
        autoViewSkins,
        autoRandomRaritySkin,
        smartApply,
        autoApply,
        autoAccept
      ]) => {
        setLeagueClientEnabled(leagueClient !== false)
        setChampionDetectionEnabled(championDetection !== false)
        setAutoViewSkinsEnabled(autoViewSkins === true)
        setAutoRandomRaritySkinEnabled(autoRandomRaritySkin === true)
        setSmartApplyEnabled(smartApply !== false) // Default to true
        setAutoApplyEnabled(autoApply !== false) // Default to true
        setAutoAcceptEnabled(autoAccept === true)
      }
    )
  }, [
    setLeagueClientEnabled,
    setChampionDetectionEnabled,
    setAutoViewSkinsEnabled,
    setAutoRandomRaritySkinEnabled,
    setSmartApplyEnabled,
    setAutoApplyEnabled,
    setAutoAcceptEnabled
  ])
}
