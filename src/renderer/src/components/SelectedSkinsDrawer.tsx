import React, { useEffect, useState } from 'react'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { selectedSkinsAtom, selectedSkinsDrawerExpandedAtom } from '../store/atoms'
import type { SelectedSkin } from '../store/atoms'

interface SelectedSkinsDrawerProps {
  onApplySkins: () => void
  onStopPatcher: () => void
  loading: boolean
  isPatcherRunning: boolean
  downloadedSkins: Array<{ championName: string; skinName: string; localPath?: string }>
  championData?: {
    champions: Array<{
      key: string
      skins: Array<{
        id: string
        nameEn?: string
        name: string
        lolSkinsName?: string
        chromaList?: Array<{
          id: number
          name: string
          chromaPath: string
          colors: string[]
        }>
      }>
    }>
  }
  statusMessage?: string
  errorMessage?: string
}

export const SelectedSkinsDrawer: React.FC<SelectedSkinsDrawerProps> = ({
  onApplySkins,
  onStopPatcher,
  loading,
  isPatcherRunning,
  downloadedSkins,
  championData,
  statusMessage,
  errorMessage
}) => {
  const { t } = useTranslation()
  const [selectedSkins, setSelectedSkins] = useAtom(selectedSkinsAtom)
  const [isExpanded, setIsExpanded] = useAtom(selectedSkinsDrawerExpandedAtom)
  const [patcherStatus, setPatcherStatus] = useState<string>('')
  const [patcherMessages, setPatcherMessages] = useState<string[]>([])
  const [customImages, setCustomImages] = useState<Record<string, string>>({})

  useEffect(() => {
    // Listen for patcher status updates
    const unsubscribeStatus = window.api.onPatcherStatus((status: string) => {
      setPatcherStatus(status)
    })

    // Listen for patcher messages
    const unsubscribeMessage = window.api.onPatcherMessage((message: string) => {
      setPatcherMessages((prev) => [...prev.slice(-4), message]) // Keep last 5 messages
    })

    // Listen for patcher errors
    const unsubscribeError = window.api.onPatcherError((error: string) => {
      setPatcherMessages((prev) => [...prev.slice(-4), `Error: ${error}`])
    })

    return () => {
      unsubscribeStatus()
      unsubscribeMessage()
      unsubscribeError()
    }
  }, [])

  // Load custom images for selected custom skins
  useEffect(() => {
    const loadCustomImages = async () => {
      const customSkins = selectedSkins.filter((s) => s.championKey === 'Custom')

      for (const skin of customSkins) {
        const modPath = downloadedSkins.find(
          (ds) => ds.championName === 'Custom' && ds.skinName.includes(skin.skinName)
        )?.localPath

        if (modPath && !customImages[modPath]) {
          const result = await window.api.getCustomSkinImage(modPath)
          if (result.success && result.imageUrl) {
            setCustomImages((prev) => ({ ...prev, [modPath]: result.imageUrl! }))
          }
        }
      }
    }

    loadCustomImages()
  }, [selectedSkins, downloadedSkins, customImages])

  const handleApplySkins = () => {
    // Clear previous patcher messages when starting a new session
    setPatcherMessages([])
    onApplySkins()
  }

  const removeSkin = (skinToRemove: SelectedSkin) => {
    setSelectedSkins((prev) =>
      prev.filter(
        (skin) =>
          !(
            skin.championKey === skinToRemove.championKey &&
            skin.skinId === skinToRemove.skinId &&
            skin.chromaId === skinToRemove.chromaId
          )
      )
    )
  }

  const clearAll = () => {
    setSelectedSkins([])
  }

  const getSkinImageUrl = (skin: SelectedSkin) => {
    if (skin.championKey === 'Custom') {
      // Find the mod path for this custom skin
      const modPath = downloadedSkins.find(
        (ds) => ds.championName === 'Custom' && ds.skinName.includes(skin.skinName)
      )?.localPath

      if (modPath && customImages[modPath]) {
        return customImages[modPath]
      }

      // Return a placeholder image for custom mods
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzA4IiBoZWlnaHQ9IjU2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzA4IiBoZWlnaHQ9IjU2MCIgZmlsbD0iIzM3NDE1MSIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNDgiIGZpbGw9IiNhMGE0YWIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPkN1c3RvbTwvdGV4dD4KPC9zdmc+'
    }
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${skin.championKey}_${skin.skinNum}.jpg`
  }

  const getSkinDisplayName = (skin: SelectedSkin) => {
    if (skin.chromaId && championData) {
      // Try to find the chroma name from champion data
      const champion = championData.champions.find((c) => c.key === skin.championKey)
      if (champion) {
        const skinData = champion.skins.find((s) => s.id === skin.skinId)
        if (skinData?.chromaList) {
          const chroma = skinData.chromaList.find((c) => c.id.toString() === skin.chromaId)
          if (chroma) {
            return chroma.name
          }
        }
      }
      // Fallback to skin name + chroma ID
      return `${skin.skinName} (Chroma ${skin.chromaId})`
    }
    return skin.skinName
  }

  const isSkinDownloaded = (skin: SelectedSkin) => {
    // Custom skins are always "downloaded" since they're user imports
    if (skin.championKey === 'Custom') {
      return true
    }

    // Look up the actual skin data to get the correct name (lolSkinsName > nameEn > name)
    let actualName = skin.skinName
    if (championData) {
      const champion = championData.champions.find((c) => c.key === skin.championKey)
      if (champion) {
        const actualSkin = champion.skins.find((s) => s.id === skin.skinId)
        if (actualSkin) {
          actualName = actualSkin.lolSkinsName || actualSkin.nameEn || actualSkin.name
        }
      }
    }

    // Use the actual name for file checking
    const baseName = actualName.replace(/:/g, '')

    if (skin.chromaId) {
      const chromaFileName = `${baseName} ${skin.chromaId}.zip`
      return downloadedSkins.some(
        (ds) => ds.championName === skin.championKey && ds.skinName === chromaFileName
      )
    } else {
      const skinFileName = `${baseName}.zip`
      return downloadedSkins.some(
        (ds) => ds.championName === skin.championKey && ds.skinName === skinFileName
      )
    }
  }

  const downloadedCount = selectedSkins.filter((skin) => isSkinDownloaded(skin)).length
  const needsDownload = downloadedCount < selectedSkins.length

  return (
    <div className="bg-white dark:bg-charcoal-900 border-t-2 border-charcoal-200 dark:border-charcoal-800 transition-all duration-300">
      {/* Collapsed View */}
      <div
        className={`px-8 py-4 flex items-center justify-between cursor-pointer transition-all duration-200 hover:bg-cream-50 dark:hover:bg-charcoal-800 ${
          isExpanded ? 'border-b border-charcoal-200 dark:border-charcoal-800' : ''
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <svg
            className={`w-4 h-4 transition-transform text-charcoal-600 dark:text-charcoal-400 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          <div className="flex items-center gap-3">
            {errorMessage ? (
              <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                {errorMessage}
              </span>
            ) : (loading || patcherStatus) && (statusMessage || patcherStatus) ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 bg-terracotta-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-terracotta-500 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-terracotta-500 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  ></div>
                </div>
                <span className="text-sm text-charcoal-700 dark:text-charcoal-300">
                  {patcherStatus || statusMessage}
                </span>
              </div>
            ) : (
              <>
                <span className="font-medium text-charcoal-900 dark:text-charcoal-100">
                  {t('skins.selected', { count: selectedSkins.length })}
                </span>
                {needsDownload && (
                  <span className="text-sm text-charcoal-600 dark:text-charcoal-400">
                    {t('skins.toDownload', { count: selectedSkins.length - downloadedCount })}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button
            className="px-4 py-2 text-sm text-charcoal-600 dark:text-charcoal-400 hover:text-charcoal-800 dark:hover:text-charcoal-200 font-medium transition-colors"
            onClick={clearAll}
            disabled={loading}
          >
            {t('actions.clearAll')}
          </button>
          <button
            className={`px-6 py-2 font-medium rounded-lg transition-all duration-200 shadow-soft hover:shadow-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${
              isPatcherRunning
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-terracotta-500 hover:bg-terracotta-600 text-white'
            }`}
            onClick={isPatcherRunning ? onStopPatcher : handleApplySkins}
            disabled={loading}
          >
            {loading
              ? isPatcherRunning
                ? t('patcher.stopping')
                : t('patcher.applying')
              : isPatcherRunning
                ? t('patcher.stopPatcher')
                : t('patcher.apply', { count: selectedSkins.length })}
          </button>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="p-4 max-h-[28rem] overflow-y-auto animate-slide-up">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3">
            {selectedSkins.map((skin) => {
              const isDownloaded = isSkinDownloaded(skin)
              let selectedChroma:
                | { id: number; name: string; chromaPath: string; colors: string[] }
                | undefined
              if (skin.chromaId && championData) {
                const champion = championData.champions.find((c) => c.key === skin.championKey)
                if (champion) {
                  const skinData = champion.skins.find((s) => s.id === skin.skinId)
                  if (skinData?.chromaList) {
                    selectedChroma = skinData.chromaList.find(
                      (c) => c.id.toString() === skin.chromaId
                    )
                  }
                }
              }

              return (
                <div
                  key={`${skin.championKey}_${skin.skinId}_${skin.chromaId || ''}`}
                  className="relative group"
                >
                  <div className="relative aspect-[0.67] overflow-hidden bg-charcoal-100 dark:bg-charcoal-800 rounded border border-charcoal-200 dark:border-charcoal-700">
                    <img
                      src={selectedChroma ? selectedChroma.chromaPath : getSkinImageUrl(skin)}
                      alt={getSkinDisplayName(skin)}
                      className="w-full h-full object-cover"
                    />
                    {!isDownloaded && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="text-[10px] text-white bg-black/75 px-1.5 py-0.5 rounded text-center">
                          {t('skins.notDownloaded').split(' ')[0]}
                          <br />
                          {t('skins.notDownloaded').split(' ')[1]}
                        </div>
                      </div>
                    )}
                    <button
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeSkin(skin)}
                      disabled={loading}
                    >
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-1">
                    <p
                      className="text-xs leading-tight font-medium text-charcoal-900 dark:text-charcoal-100 truncate"
                      title={getSkinDisplayName(skin)}
                    >
                      {getSkinDisplayName(skin)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Patcher Messages */}
          {patcherMessages.length > 0 && (
            <div className="mt-4 p-3 bg-charcoal-100 dark:bg-charcoal-800 rounded-lg">
              <h4 className="text-xs font-medium text-charcoal-700 dark:text-charcoal-300 mb-2">
                {t('patcher.messages')}
              </h4>
              <div className="space-y-1">
                {patcherMessages.map((message, index) => (
                  <p
                    key={index}
                    className={`text-[10px] leading-tight ${
                      message.startsWith('Error:')
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-charcoal-600 dark:text-charcoal-400'
                    }`}
                  >
                    {message}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
