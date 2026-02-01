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
import { generateSkinFilename } from '../../../shared/utils/skinFilename'
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
      const favoriteKeys = new Set(
        result.favorites.map((f) => {
          // Handle both old format (no chromaId) and new format
          if (f.chromaId) {
            return `${f.championKey}_${f.skinId}_${f.chromaId}`
          }
          // Old format favorites are treated as base skin favorites
          return `${f.championKey}_${f.skinId}_base`
        })
      )
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
      // For base skin favorites, we use 'base' as the chromaId
      const key = `${champion.key}_${skin.id}_base`
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

  const toggleChromaFavorite = useCallback(
    async (champion: Champion, skin: Skin, chromaId: string, chromaName: string) => {
      const key = `${champion.key}_${skin.id}_${chromaId}`
      const isFav = favorites.has(key)

      if (isFav) {
        await window.api.removeFavorite(champion.key, skin.id, chromaId)
        setFavorites((prev) => {
          const newSet = new Set(prev)
          newSet.delete(key)
          return newSet
        })
      } else {
        await window.api.addFavorite(champion.key, skin.id, skin.name, chromaId, chromaName)
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

  const applySelectedSkins = useCallback(
    async (overrideChampionIds?: number[]) => {
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

        // Filter skins based on auto-selected priority
        // If a champion has both manual and auto-selected skins, only use the auto-selected one
        const allowMultipleSkinsPerChampion = await window.api.getSettings(
          'allowMultipleSkinsPerChampion'
        )
        let prioritizedSkins = selectedSkins

        if (!allowMultipleSkinsPerChampion) {
          const skinsByChampion = new Map<string, typeof selectedSkins>()

          for (const skin of selectedSkins) {
            const existing = skinsByChampion.get(skin.championKey) || []
            skinsByChampion.set(skin.championKey, [...existing, skin])
          }

          // Apply priority filtering
          for (const [championKey, skins] of skinsByChampion) {
            if (skins.length > 1) {
              const autoSelectedSkin = skins.find((s) => s.isAutoSelected)
              if (autoSelectedSkin) {
                // Remove all skins for this champion except the auto-selected one
                prioritizedSkins = prioritizedSkins.filter(
                  (s) => s.championKey !== championKey || s === autoSelectedSkin
                )
              }
            }
          }
        }

        // Determine which skins to apply based on smart apply settings
        let skinsToApply = prioritizedSkins
        let isUsingSmartApply = false
        let championIdsToUse: number[] = []

        // Check if we should filter skins for smart apply
        const leagueClientEnabled = await window.api.getSettings('leagueClientEnabled')
        const smartApplyEnabled = await window.api.getSettings('smartApplyEnabled')

        // Priority: overrideChampionIds (Swiftplay) -> getTeamComposition (regular) -> apply all skins
        if (overrideChampionIds && overrideChampionIds.length > 0) {
          // Swiftplay mode: use passed champion IDs directly and always apply smart filtering
          championIdsToUse = overrideChampionIds
          isUsingSmartApply = true // Always filter for Swiftplay regardless of settings
        } else if (leagueClientEnabled && smartApplyEnabled) {
          // Regular mode: query team composition from champion select
          const teamCompositionResult = await window.api.getTeamComposition()
          if (
            teamCompositionResult.success &&
            teamCompositionResult.composition &&
            teamCompositionResult.composition.championIds &&
            teamCompositionResult.composition.championIds.length > 0
          ) {
            championIdsToUse = teamCompositionResult.composition.championIds
            isUsingSmartApply = true
          }
        }

        // Apply smart filtering if we have champion IDs and smart apply is enabled
        if (isUsingSmartApply && championIdsToUse.length > 0) {
          console.log(
            '[useSkinManagement] Applying smart filtering for champion IDs:',
            championIdsToUse
          )
          const summaryResult = await window.api.getSmartApplySummary(
            selectedSkins,
            championIdsToUse
          )

          console.log('[useSkinManagement] Smart apply summary:', summaryResult)

          if (summaryResult.success && summaryResult.summary) {
            const teamChampionKeys = new Set(summaryResult.summary.teamChampions)
            console.log('[useSkinManagement] Team champion keys:', Array.from(teamChampionKeys))

            const beforeCount = selectedSkins.length
            skinsToApply = selectedSkins.filter(
              (skin) => skin.championKey === 'Custom' || teamChampionKeys.has(skin.championKey)
            )

            console.log(
              `[useSkinManagement] Smart filtering: ${beforeCount} → ${skinsToApply.length} skins`
            )
            console.log(
              '[useSkinManagement] Filtered skins:',
              skinsToApply.map((s) => `${s.championKey}/${s.skinName}`)
            )

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

        console.log('[useSkinManagement] Processing skins to apply:', skinsToApply)

        // Download any skins that aren't downloaded yet
        for (const selectedSkin of skinsToApply) {
          // Handle custom mods (both old and new format)
          if (
            selectedSkin.championKey === 'Custom' ||
            selectedSkin.skinId.startsWith('custom_[User] ')
          ) {
            if (selectedSkin.championKey === 'Custom') {
              // Old format: Custom champion
              const userMod = downloadedSkins.find(
                (ds) =>
                  ds.skinName.includes('[User]') && ds.skinName.includes(selectedSkin.skinName)
              )
              if (userMod) {
                skinKeys.push(`${userMod.championName}/${userMod.skinName}`)
              }
            } else {
              // New format: Custom mod with champion assigned
              // Extract the filename from skinId after "custom_"
              const modFileName = selectedSkin.skinId.replace('custom_', '')
              console.log(
                `[useSkinManagement] Adding custom mod: ${selectedSkin.championKey}/${modFileName}`
              )
              skinKeys.push(`${selectedSkin.championKey}/${modFileName}`)
            }
            continue
          }

          const champion = championData?.champions.find((c) => c.key === selectedSkin.championKey)
          if (!champion) continue

          const skin = champion.skins.find((s) => s.id === selectedSkin.skinId)
          if (!skin) continue

          let skinFileName: string
          let githubUrl: string | undefined

          // Check if this is a variant selection
          if (selectedSkin.variantId && skin.variants) {
            const variant = skin.variants.items.find((v) => v.id === selectedSkin.variantId)
            if (!variant) continue

            // Use the variant's download URL if available, otherwise use GitHub URL
            githubUrl = variant.downloadUrl || variant.githubUrl
            // Extract filename from the URL for consistency
            const urlParts = githubUrl.split('/')
            skinFileName = decodeURIComponent(urlParts[urlParts.length - 1])

            console.log(`[Download] Using variant ${variant.name}:`)
            console.log(`  variantId: ${selectedSkin.variantId}`)
            console.log(`  githubUrl: ${variant.githubUrl}`)
            console.log(`  downloadUrl: ${variant.downloadUrl}`)
            console.log(`  using URL: ${githubUrl}`)
            console.log(`  filename: ${skinFileName}`)
          } else {
            // Use centralized filename generation for regular skins and chromas
            skinFileName = generateSkinFilename({
              ...skin,
              chromaId: selectedSkin.chromaId
            })

            console.log(`[Download] Generating filename for ${skin.name}:`)
            console.log(`  nameEn: ${skin.nameEn}`)
            console.log(`  name: ${skin.name}`)
            console.log(`  chromaId: ${selectedSkin.chromaId}`)
            console.log(`  Generated filename: ${skinFileName}`)
          }

          // Check if skin is already downloaded
          const isSkinDownloaded = downloadedSkins.some(
            (ds) => ds.championName === champion.key && ds.skinName === skinFileName
          )

          if (!isSkinDownloaded) {
            // Only generate GitHub URL if we haven't already (variants have it pre-set)
            if (!githubUrl) {
              const championNameForUrl = getChampionDisplayName(champion)

              if (selectedSkin.chromaId) {
                const downloadName = skinFileName.replace(/\.zip$/i, '').replace(/\s+\d+$/, '')
                const urlResult = await window.api.repositoryConstructUrl(
                  championNameForUrl,
                  skinFileName,
                  true,
                  downloadName,
                  champion.id // Pass championId for ID-based repositories
                )
                if (!urlResult.success || !urlResult.url) {
                  throw new Error('Failed to construct download URL')
                }
                githubUrl = urlResult.url

                const displayMessage = isUsingSmartApply
                  ? t('status.downloading', { name: `${skin.name} (Chroma) for your team` })
                  : t('status.downloading', { name: `${skin.name} (Chroma)` })
                setStatusMessage(displayMessage)
              } else {
                const urlResult = await window.api.repositoryConstructUrl(
                  championNameForUrl,
                  skinFileName,
                  false,
                  undefined, // chromaBase
                  champion.id // Pass championId for ID-based repositories
                )
                if (!urlResult.success || !urlResult.url) {
                  throw new Error('Failed to construct download URL')
                }
                githubUrl = urlResult.url

                const displayMessage = isUsingSmartApply
                  ? t('status.downloading', { name: `${skin.name} for your team` })
                  : t('status.downloading', { name: skin.name })
                setStatusMessage(displayMessage)
              }
            } else {
              // For variants, use a more specific message
              const variantName = selectedSkin.variantId
                ? skin.variants?.items.find((v) => v.id === selectedSkin.variantId)?.displayName ||
                  skin.name
                : skin.name
              const displayMessage = isUsingSmartApply
                ? t('status.downloading', { name: `${variantName} for your team` })
                : t('status.downloading', { name: variantName })
              setStatusMessage(displayMessage)
            }

            const downloadResult = await window.api.downloadSkin(githubUrl)
            if (!downloadResult.success) {
              throw new Error(downloadResult.error || 'Failed to download skin')
            }
          }

          const championNameForPatcher = getChampionDisplayName(champion)
          skinKeys.push(`${championNameForPatcher}/${skinFileName}`)
        }

        console.log('[useSkinManagement] Final skinKeys array:', skinKeys)

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
        // Pass both skinKeys (for backward compat) and full skin objects (for championId)
        const patcherResult = await window.api.runPatcher(gamePath, skinsToApply)
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
    },
    [
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
    ]
  )

  return {
    downloadedSkins,
    favorites,
    selectedSkins,
    setSelectedSkins,
    loadDownloadedSkins,
    loadFavorites,
    toggleFavorite,
    toggleChromaFavorite,
    deleteCustomSkin,
    deleteDownloadedSkin,
    applySelectedSkins,
    isApplyingSkins: loadingStates.isApplyingSkins
  }
}
