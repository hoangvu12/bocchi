import { useCallback, useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { useLocale } from '../contexts/useLocale'
import {
  championDataAtom,
  selectedChampionAtom,
  showChampionDataUpdateAtom
} from '../store/atoms/champion.atoms'
import {
  statusMessageAtom,
  loadingStatesAtom,
  activeOperationAtom
} from '../store/atoms/game.atoms'
import { selectedChampionKeyAtom } from '../store/atoms'

export function useChampionData() {
  const { t } = useTranslation()
  const { currentLanguage } = useLocale()
  const [championData, setChampionData] = useAtom(championDataAtom)
  const [selectedChampion, setSelectedChampion] = useAtom(selectedChampionAtom)
  const [selectedChampionKey] = useAtom(selectedChampionKeyAtom)
  const setShowChampionDataUpdate = useSetAtom(showChampionDataUpdateAtom)
  const setStatusMessage = useSetAtom(statusMessageAtom)
  const [loadingStates, setLoadingStates] = useAtom(loadingStatesAtom)
  const [activeOperation, setActiveOperation] = useAtom(activeOperationAtom)

  const loadChampionData = useCallback(
    async (preserveSelection = false) => {
      const result = await window.api.loadChampionData(currentLanguage)
      if (result.success && result.data) {
        setChampionData(result.data)

        // Try to restore selected champion from persisted key
        if (selectedChampionKey && selectedChampionKey !== 'all') {
          const champion = result.data.champions.find((c) => c.key === selectedChampionKey)
          if (champion) {
            setSelectedChampion(champion)
          }
        } else if (selectedChampionKey === 'all') {
          setSelectedChampion(null)
        }

        // Handle preserve selection
        if (preserveSelection && selectedChampion) {
          const sameChampion = result.data.champions.find((c) => c.key === selectedChampion.key)
          if (sameChampion) {
            setSelectedChampion(sameChampion)
          }
        }

        return result.data
      }
      return null
    },
    [currentLanguage, selectedChampionKey, selectedChampion, setChampionData, setSelectedChampion]
  )

  const fetchChampionData = useCallback(async () => {
    // Prevent concurrent fetches
    if (activeOperation === 'fetchChampionData') {
      return
    }

    setActiveOperation('fetchChampionData')
    setLoadingStates((prev) => ({ ...prev, isLoadingChampionData: true }))
    setStatusMessage(t('status.fetchingData'))

    try {
      const result = await window.api.fetchChampionData(currentLanguage)
      if (result.success) {
        setStatusMessage(t('status.dataFetched', { count: result.championCount }))
        await loadChampionData()
      } else {
        setStatusMessage(`${t('errors.generic')}: ${result.message}`)
      }
    } catch (error) {
      setStatusMessage(
        `${t('errors.generic')}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setLoadingStates((prev) => ({ ...prev, isLoadingChampionData: false }))
      setActiveOperation(null)
    }
  }, [
    activeOperation,
    currentLanguage,
    t,
    loadChampionData,
    setActiveOperation,
    setLoadingStates,
    setStatusMessage
  ])

  const updateChampionData = useCallback(async () => {
    setLoadingStates((prev) => ({ ...prev, isUpdatingChampionData: true }))
    try {
      await fetchChampionData()
      setShowChampionDataUpdate(false)
      await loadChampionData(true)
    } catch (error) {
      console.error('Failed to update champion data:', error)
    } finally {
      setLoadingStates((prev) => ({ ...prev, isUpdatingChampionData: false }))
    }
  }, [fetchChampionData, loadChampionData, setLoadingStates, setShowChampionDataUpdate])

  // Load data on mount and when language changes
  useEffect(() => {
    loadChampionData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLanguage])

  return {
    championData,
    selectedChampion,
    loadChampionData,
    fetchChampionData,
    updateChampionData,
    isLoadingChampionData: loadingStates.isLoadingChampionData,
    isUpdatingChampionData: loadingStates.isUpdatingChampionData
  }
}
