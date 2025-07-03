import { useAtom } from 'jotai'
import { useCallback } from 'react'
import { chromaDataAtom, chromaDataLoadingAtom, type Chroma } from '../store/atoms'

export const useChromaData = () => {
  const [chromaData, setChromaData] = useAtom(chromaDataAtom)
  const [loadingSkinIds, setLoadingSkinIds] = useAtom(chromaDataLoadingAtom)

  const fetchChromasForSkin = useCallback(
    async (skinId: string): Promise<Chroma[]> => {
      // Return cached data if available
      if (chromaData[skinId]) {
        return chromaData[skinId]
      }

      // Check if already loading
      if (loadingSkinIds.has(skinId)) {
        // Wait for the loading to complete
        return new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (!loadingSkinIds.has(skinId)) {
              clearInterval(checkInterval)
              resolve(chromaData[skinId] || [])
            }
          }, 100)
        })
      }

      // Mark as loading
      setLoadingSkinIds((prev) => new Set(prev).add(skinId))

      try {
        const result = await window.api.getChromasForSkin(skinId)
        if (result.success && result.chromas) {
          setChromaData((prev) => ({ ...prev, [skinId]: result.chromas as Chroma[] }))
          return result.chromas as Chroma[]
        }
      } catch (error) {
        console.error('Failed to fetch chromas for skin:', skinId, error)
      } finally {
        // Remove from loading set
        setLoadingSkinIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(skinId)
          return newSet
        })
      }

      // Cache empty array to prevent repeated failed requests
      setChromaData((prev) => ({ ...prev, [skinId]: [] }))
      return []
    },
    [chromaData, loadingSkinIds, setChromaData, setLoadingSkinIds]
  )

  const getChromasForSkin = useCallback(
    (skinId: string): Chroma[] => {
      return chromaData[skinId] || []
    },
    [chromaData]
  )

  const prefetchChromas = useCallback(
    async (skinIds: string[]) => {
      const uniqueSkinIds = [...new Set(skinIds)]
      const promises = uniqueSkinIds
        .filter((skinId) => !chromaData[skinId])
        .map((skinId) => fetchChromasForSkin(skinId))

      await Promise.all(promises)
    },
    [chromaData, fetchChromasForSkin]
  )

  return {
    chromaData,
    fetchChromasForSkin,
    getChromasForSkin,
    prefetchChromas,
    isLoading: (skinId: string) => loadingSkinIds.has(skinId)
  }
}
