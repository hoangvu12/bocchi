import React, { useEffect, useState } from 'react'
import { useAtom } from 'jotai'
import { selectedSkinsAtom, selectedSkinsDrawerExpandedAtom, p2pRoomAtom } from '../store/atoms'
import type { SelectedSkin } from '../store/atoms'
import type { P2PRoomMember } from '../../../main/types'
import { p2pService } from '../services/p2pService'
import { Badge } from './ui/badge'

interface SelectedSkinsDrawerProps {
  onApplySkins: () => void
  onStopPatcher: () => void
  loading: boolean
  isPatcherRunning: boolean
  downloadedSkins: Array<{ championName: string; skinName: string; localPath?: string }>
  championData?: {
    champions: Array<{
      key: string
      skins: Array<{ id: string; nameEn?: string; name: string; lolSkinsName?: string }>
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
  const [selectedSkins, setSelectedSkins] = useAtom(selectedSkinsAtom)
  const [isExpanded, setIsExpanded] = useAtom(selectedSkinsDrawerExpandedAtom)
  const [patcherStatus, setPatcherStatus] = useState<string>('')
  const [patcherMessages, setPatcherMessages] = useState<string[]>([])
  const [customImages, setCustomImages] = useState<Record<string, string>>({})
  const [p2pRoom] = useAtom(p2pRoomAtom)
  const [activeTab, setActiveTab] = useState<'my-skins' | 'room-skins'>('my-skins')

  // Switch to my-skins tab when leaving room
  useEffect(() => {
    if (!p2pRoom && activeTab === 'room-skins') {
      setActiveTab('my-skins')
    }
  }, [p2pRoom, activeTab])

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

  const applySkinFromPeer = (skin: SelectedSkin) => {
    // Check if skin is already selected
    const isAlreadySelected = selectedSkins.some(
      (s) =>
        s.championKey === skin.championKey &&
        s.skinId === skin.skinId &&
        s.chromaId === skin.chromaId
    )

    if (!isAlreadySelected) {
      setSelectedSkins((prev) => [...prev, skin])
    }
  }

  const applyAllPeerSkins = (member: P2PRoomMember) => {
    const newSkins = member.activeSkins.filter(
      (peerSkin) =>
        !selectedSkins.some(
          (s) =>
            s.championKey === peerSkin.championKey &&
            s.skinId === peerSkin.skinId &&
            s.chromaId === peerSkin.chromaId
        )
    )

    if (newSkins.length > 0) {
      setSelectedSkins((prev) => [...prev, ...newSkins])
    }
  }

  const downloadedCount = selectedSkins.filter((skin) => isSkinDownloaded(skin)).length
  const needsDownload = downloadedCount < selectedSkins.length

  // Get all room members (host + other members), excluding self
  const currentPeerId = p2pService.getCurrentPeerId()
  const isHost = p2pService.isCurrentUserHost()
  const allMembers: P2PRoomMember[] = p2pRoom
    ? [p2pRoom.host, ...p2pRoom.members]
        .filter((m) => m.activeSkins && m.activeSkins.length > 0)
        .filter((m) => {
          // Filter out self
          if (isHost && m.isHost) return false
          if (!isHost && m.id === currentPeerId) return false
          return true
        })
    : []

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
                  {selectedSkins.length} {selectedSkins.length === 1 ? 'skin' : 'skins'} selected
                </span>
                {needsDownload && (
                  <span className="text-sm text-charcoal-600 dark:text-charcoal-400">
                    ({selectedSkins.length - downloadedCount} to download)
                  </span>
                )}
              </>
            )}
            {p2pRoom && (
              <Badge
                variant="secondary"
                className="bg-terracotta-100 dark:bg-terracotta-900/30 text-terracotta-700 dark:text-terracotta-400 hover:bg-terracotta-200 dark:hover:bg-terracotta-900/40"
              >
                Room: {p2pRoom.id}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button
            className="px-4 py-2 text-sm text-charcoal-600 dark:text-charcoal-400 hover:text-charcoal-800 dark:hover:text-charcoal-200 font-medium transition-colors"
            onClick={clearAll}
            disabled={loading}
          >
            Clear All
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
                ? 'Stopping...'
                : 'Applying...'
              : isPatcherRunning
                ? 'Stop Patcher'
                : `Apply ${selectedSkins.length} ${selectedSkins.length === 1 ? 'Skin' : 'Skins'}`}
          </button>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="animate-slide-up">
          {/* Tabs */}
          {p2pRoom && (
            <div className="flex border-b border-charcoal-200 dark:border-charcoal-800">
              <button
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'my-skins'
                    ? 'text-terracotta-600 dark:text-terracotta-400 border-b-2 border-terracotta-500'
                    : 'text-charcoal-600 dark:text-charcoal-400 hover:text-charcoal-900 dark:hover:text-charcoal-100'
                }`}
                onClick={() => setActiveTab('my-skins')}
              >
                My Skins ({selectedSkins.length})
              </button>
              <button
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'room-skins'
                    ? 'text-terracotta-600 dark:text-terracotta-400 border-b-2 border-terracotta-500'
                    : 'text-charcoal-600 dark:text-charcoal-400 hover:text-charcoal-900 dark:hover:text-charcoal-100'
                }`}
                onClick={() => setActiveTab('room-skins')}
              >
                Room Skins
              </button>
            </div>
          )}

          <div className="p-4 max-h-[28rem] overflow-y-auto">
            {/* My Skins Tab */}
            {activeTab === 'my-skins' && (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3">
                  {selectedSkins.map((skin) => {
                    const isDownloaded = isSkinDownloaded(skin)
                    return (
                      <div
                        key={`${skin.championKey}_${skin.skinId}_${skin.chromaId || ''}`}
                        className="relative group"
                      >
                        <div className="relative aspect-[0.67] overflow-hidden bg-charcoal-100 dark:bg-charcoal-800 rounded border border-charcoal-200 dark:border-charcoal-700">
                          <img
                            src={getSkinImageUrl(skin)}
                            alt={skin.skinName}
                            className="w-full h-full object-cover"
                          />
                          {!isDownloaded && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <div className="text-[10px] text-white bg-black/75 px-1.5 py-0.5 rounded text-center">
                                Not
                                <br />
                                Downloaded
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
                          <p className="text-xs leading-tight font-medium text-charcoal-900 dark:text-charcoal-100 truncate">
                            {skin.skinName}
                            {skin.chromaId && ' (C)'}
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
                      Patcher Messages:
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
              </>
            )}

            {/* Room Skins Tab */}
            {activeTab === 'room-skins' && p2pRoom && (
              <div className="space-y-6">
                {allMembers.map((member) => {
                  if (member.activeSkins.length === 0) return null

                  return (
                    <div key={member.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm text-charcoal-900 dark:text-charcoal-100">
                          {member.isHost ? '👑 ' : ''}
                          {member.name}&apos;s Skins ({member.activeSkins.length})
                        </h3>
                        {member.activeSkins.length > 0 && (
                          <button
                            onClick={() => applyAllPeerSkins(member)}
                            className="px-3 py-1 text-xs bg-terracotta-500 hover:bg-terracotta-600 text-white rounded transition-colors"
                          >
                            Add to my skins
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3">
                        {member.activeSkins.map((skin) => {
                          const isSelected = selectedSkins.some(
                            (s) =>
                              s.championKey === skin.championKey &&
                              s.skinId === skin.skinId &&
                              s.chromaId === skin.chromaId
                          )
                          return (
                            <div
                              key={`${member.id}_${skin.championKey}_${skin.skinId}_${skin.chromaId || ''}`}
                              className="relative group"
                            >
                              <div className="relative aspect-[0.67] overflow-hidden bg-charcoal-100 dark:bg-charcoal-800 rounded border border-charcoal-200 dark:border-charcoal-700">
                                <img
                                  src={getSkinImageUrl(skin)}
                                  alt={skin.skinName}
                                  className="w-full h-full object-cover"
                                />
                                {isSelected && (
                                  <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                    <svg
                                      className="w-8 h-8 text-green-500"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  </div>
                                )}
                                {!isSelected && (
                                  <button
                                    className="absolute inset-0 bg-black/0 hover:bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-all"
                                    onClick={() => applySkinFromPeer(skin)}
                                  >
                                    <Badge
                                      variant="default"
                                      className="bg-terracotta-500 hover:bg-terracotta-600 text-white"
                                    >
                                      Apply
                                    </Badge>
                                  </button>
                                )}
                              </div>
                              <div className="mt-1">
                                <p className="text-xs leading-tight font-medium text-charcoal-900 dark:text-charcoal-100 truncate">
                                  {skin.skinName}
                                  {skin.chromaId && ' (C)'}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {allMembers.every((m) => m.activeSkins.length === 0) && (
                  <div className="text-center py-8 text-charcoal-500 dark:text-charcoal-400">
                    No one in the room has selected any skins yet
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
