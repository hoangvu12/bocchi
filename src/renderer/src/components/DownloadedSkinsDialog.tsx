import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { getChampionDisplayName } from '../utils/championUtils'

interface DownloadedSkinsDialogProps {
  isOpen: boolean
  onClose: () => void
  downloadedSkins: Array<{
    championName: string
    skinName: string
    localPath?: string
    source?: 'repository' | 'user' | 'p2p'
    metadata?: {
      commitSha: string
      downloadedAt: Date
      lastUpdateCheck?: Date
      fileSize?: number
      githubPath?: string
      version?: number
    }
    url?: string
  }>
  championData?: {
    champions: Array<{ key: string; name: string; nameEn?: string; [key: string]: any }>
  }
  onDeleteSkin: (championName: string, skinName: string) => Promise<void>
  onDeleteCustomSkin?: (skinPath: string, skinName: string) => Promise<void>
  onRefresh: () => Promise<void>
}

export const DownloadedSkinsDialog: React.FC<DownloadedSkinsDialogProps> = ({
  isOpen,
  onClose,
  downloadedSkins,
  championData,
  onDeleteSkin,
  onDeleteCustomSkin,
  onRefresh
}) => {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingSkins, setDeletingSkins] = useState<Set<string>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'repo' | 'custom'>('all')
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const [deletingChampions, setDeletingChampions] = useState<Set<string>>(new Set())
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const [skinUpdates, setSkinUpdates] = useState<Record<string, any>>({})
  const [updatingSkins, setUpdatingSkins] = useState<Set<string>>(new Set())
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false)
  const [isUpdatingAll, setIsUpdatingAll] = useState(false)

  // Group skins by champion
  const groupedSkins = useMemo(() => {
    const groups: Record<
      string,
      Array<{ skinName: string; localPath?: string; isCustom: boolean }>
    > = {}

    downloadedSkins.forEach((skin) => {
      if (!groups[skin.championName]) {
        groups[skin.championName] = []
      }

      const isCustom = skin.championName === 'Custom' || skin.skinName.includes('[User]')

      // Filter by category
      if (selectedCategory === 'repo' && isCustom) return
      if (selectedCategory === 'custom' && !isCustom) return

      // Filter by search query
      const champion = championData?.champions.find((c) => c.key === skin.championName)
      const championDisplayName = champion ? getChampionDisplayName(champion) : skin.championName
      if (
        searchQuery &&
        !skin.skinName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !championDisplayName.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return
      }

      groups[skin.championName].push({
        skinName: skin.skinName,
        localPath: skin.localPath,
        isCustom
      })
    })

    // Remove empty groups
    Object.keys(groups).forEach((key) => {
      if (groups[key].length === 0) {
        delete groups[key]
      }
    })

    return groups
  }, [downloadedSkins, championData, searchQuery, selectedCategory])

  const totalSkins = useMemo(() => {
    return Object.values(groupedSkins).reduce((acc, skins) => acc + skins.length, 0)
  }, [groupedSkins])

  const skinsWithUpdates = useMemo(() => {
    return downloadedSkins.filter((skin) => {
      const key = `${skin.championName}_${skin.skinName}`
      return skinUpdates[key]?.hasUpdate && skin.url // Only include skins with URLs
    })
  }, [downloadedSkins, skinUpdates])

  const handleDeleteSkin = async (
    championName: string,
    skinName: string,
    localPath?: string,
    isCustom?: boolean
  ) => {
    const key = `${championName}_${skinName}`
    setDeletingSkins((prev) => new Set(prev).add(key))

    try {
      // Use custom skin delete for user imported skins
      if (isCustom && localPath && onDeleteCustomSkin) {
        await onDeleteCustomSkin(localPath, skinName)
      } else {
        await onDeleteSkin(championName, skinName)
      }
      await onRefresh()
    } finally {
      setDeletingSkins((prev) => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    }
  }

  const handleDeleteAllSkins = async () => {
    if (!confirm(t('confirmations.confirmDeleteAll'))) return

    setIsDeletingAll(true)
    try {
      // Get all skins to delete based on current filter
      const skinsToDelete: Array<{
        championName: string
        skinName: string
        localPath?: string
        isCustom: boolean
      }> = []

      Object.entries(groupedSkins).forEach(([championKey, skins]) => {
        skins.forEach((skin) => {
          skinsToDelete.push({
            championName: championKey,
            skinName: skin.skinName,
            localPath: skin.localPath,
            isCustom: skin.isCustom
          })
        })
      })

      // Delete all skins
      for (const skin of skinsToDelete) {
        if (skin.isCustom && skin.localPath && onDeleteCustomSkin) {
          await onDeleteCustomSkin(skin.localPath, skin.skinName)
        } else {
          await onDeleteSkin(skin.championName, skin.skinName)
        }
      }

      await onRefresh()
    } finally {
      setIsDeletingAll(false)
    }
  }

  const handleDeleteChampionSkins = async (
    championKey: string,
    skins: Array<{
      skinName: string
      localPath?: string
      isCustom: boolean
    }>
  ) => {
    const champion = championData?.champions.find((c) => c.key === championKey)
    const championName = champion ? getChampionDisplayName(champion) : championKey

    if (!confirm(t('confirmations.confirmDeleteChampion', { champion: championName }))) return

    setDeletingChampions((prev) => new Set(prev).add(championKey))
    try {
      // Delete all skins for this champion
      for (const skin of skins) {
        if (skin.isCustom && skin.localPath && onDeleteCustomSkin) {
          await onDeleteCustomSkin(skin.localPath, skin.skinName)
        } else {
          await onDeleteSkin(championKey, skin.skinName)
        }
      }

      await onRefresh()
    } finally {
      setDeletingChampions((prev) => {
        const newSet = new Set(prev)
        newSet.delete(championKey)
        return newSet
      })
    }
  }

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdates(true)
    try {
      const result = await window.api.checkSkinUpdates()
      if (result.success) {
        setSkinUpdates(result.data || {})

        // Show helpful message about skins without metadata
        const repositorySkins = downloadedSkins.filter((skin) => skin.source === 'repository')
        const skinsWithoutMetadata = repositorySkins.filter((skin) => !skin.metadata)

        if (skinsWithoutMetadata.length > 0) {
          console.log(`${skinsWithoutMetadata.length} skins downloaded before update tracking`)
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
    } finally {
      setIsCheckingUpdates(false)
    }
  }

  const handleUpdateSkin = async (skin: any) => {
    const key = `${skin.championName}_${skin.skinName}`
    setUpdatingSkins((prev) => new Set(prev).add(key))

    try {
      const result = await window.api.updateSkin(skin)
      if (result.success) {
        await onRefresh()
        // Remove from updates map
        setSkinUpdates((prev) => {
          const newUpdates = { ...prev }
          delete newUpdates[key]
          return newUpdates
        })
      }
    } catch (error) {
      console.error('Failed to update skin:', error)
    } finally {
      setUpdatingSkins((prev) => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    }
  }

  const handleGenerateMetadata = async () => {
    setIsGeneratingMetadata(true)
    try {
      const result = await window.api.generateMetadataForExistingSkins()
      if (result.success) {
        await onRefresh()
        console.log('Metadata generated successfully for existing skins')
      }
    } catch (error) {
      console.error('Failed to generate metadata:', error)
    } finally {
      setIsGeneratingMetadata(false)
    }
  }

  const handleUpdateAll = async () => {
    if (skinsWithUpdates.length === 0) return

    setIsUpdatingAll(true)
    try {
      const result = await window.api.bulkUpdateSkins(skinsWithUpdates as any[])
      if (result.success && result.data) {
        await onRefresh()

        // Clear updates for successfully updated skins
        if (result.data.updated) {
          setSkinUpdates((prev) => {
            const newUpdates = { ...prev }
            result.data!.updated.forEach((skin) => {
              const key = `${skin.championName}_${skin.skinName}`
              delete newUpdates[key]
            })
            return newUpdates
          })
        }

        // Show results
        const { updated, failed } = result.data
        console.log(`Updated ${updated.length} skins, ${failed.length} failed`)

        if (failed.length > 0) {
          console.warn(
            'Failed to update some skins:',
            failed.map((f) => f.skin.skinName)
          )
        }
      }
    } catch (error) {
      console.error('Failed to update all skins:', error)
    } finally {
      setIsUpdatingAll(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{t('skins.downloadedCount', { count: totalSkins })}</span>
            <div className="flex gap-2">
              {totalSkins > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGenerateMetadata}
                  disabled={isGeneratingMetadata}
                >
                  {isGeneratingMetadata ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    'Generate Metadata'
                  )}
                </Button>
              )}
              {totalSkins > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCheckForUpdates}
                  disabled={isCheckingUpdates}
                >
                  {isCheckingUpdates ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Checking...
                    </>
                  ) : (
                    'Check for Updates'
                  )}
                </Button>
              )}
              {skinsWithUpdates.length > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleUpdateAll}
                  disabled={isUpdatingAll}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isUpdatingAll ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Updating {skinsWithUpdates.length}...
                    </>
                  ) : (
                    `Update All (${skinsWithUpdates.length})`
                  )}
                </Button>
              )}
              {totalSkins > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAllSkins}
                  disabled={isDeletingAll}
                >
                  {isDeletingAll ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      {t('skins.deleting')}
                    </>
                  ) : (
                    t('actions.deleteAll')
                  )}
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category Filter */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'secondary'}
              onClick={() => setSelectedCategory('all')}
              className={selectedCategory === 'all' ? 'bg-primary-500 hover:bg-primary-600' : ''}
            >
              {t('skins.allSkins')}
            </Button>
            <Button
              variant={selectedCategory === 'repo' ? 'default' : 'secondary'}
              onClick={() => setSelectedCategory('repo')}
              className={selectedCategory === 'repo' ? 'bg-primary-500 hover:bg-primary-600' : ''}
            >
              {t('skins.repository')}
            </Button>
            <Button
              variant={selectedCategory === 'custom' ? 'default' : 'secondary'}
              onClick={() => setSelectedCategory('custom')}
              className={selectedCategory === 'custom' ? 'bg-primary-500 hover:bg-primary-600' : ''}
            >
              {t('skins.customImports')}
            </Button>
          </div>

          {/* Search */}
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('skins.searchPlaceholder')}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {Object.keys(groupedSkins).length === 0 ? (
            <div className="text-center py-8 text-text-muted">{t('skins.noSkinsFound')}</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedSkins)
                .sort(([a], [b]) => {
                  // Put Custom at the end
                  if (a === 'Custom') return 1
                  if (b === 'Custom') return -1

                  // Sort by champion display name
                  const championA = championData?.champions.find((c) => c.key === a)
                  const championB = championData?.champions.find((c) => c.key === b)
                  const nameA = championA ? getChampionDisplayName(championA) : a
                  const nameB = championB ? getChampionDisplayName(championB) : b
                  return nameA.localeCompare(nameB)
                })
                .map(([championKey, skins]) => {
                  const champion = championData?.champions.find((c) => c.key === championKey)
                  const championName = champion ? champion.name : championKey

                  return (
                    <div
                      key={championKey}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      <div className="bg-secondary-100 dark:bg-secondary-900 px-4 py-2 flex items-center justify-between">
                        <h3 className="font-semibold text-text-primary">
                          {championName} ({skins.length})
                        </h3>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteChampionSkins(championKey, skins)}
                          disabled={deletingChampions.has(championKey)}
                        >
                          {deletingChampions.has(championKey) ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              {t('skins.deleting')}
                            </>
                          ) : (
                            t('actions.deleteAllForChampion', { champion: championName })
                          )}
                        </Button>
                      </div>
                      <div className="divide-y divide-border">
                        {skins.map((skin) => {
                          const key = `${championKey}_${skin.skinName}`
                          const isDeleting = deletingSkins.has(key)
                          const isUpdating = updatingSkins.has(key)
                          const updateInfo = skinUpdates[key]
                          const displayName = skin.skinName
                            .replace(/\[User\]\s*/, '')
                            .replace(/\.(zip|wad|fantome)$/, '')

                          return (
                            <div
                              key={skin.skinName}
                              className="px-4 py-3 flex items-center justify-between hover:bg-secondary-200/50 dark:hover:bg-secondary-800/30 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-text-secondary">{displayName}</span>
                                {skin.isCustom && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-state-info/20 text-state-info hover:bg-state-info/30"
                                  >
                                    {championKey === 'Custom'
                                      ? t('skins.custom')
                                      : t('skins.userImport')}
                                  </Badge>
                                )}
                                {updateInfo?.hasUpdate && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300"
                                  >
                                    Update Available
                                  </Badge>
                                )}
                                {!skin.isCustom && !updateInfo?.canCheck && (
                                  <span
                                    className="text-xs text-gray-400"
                                    title="Downloaded before update tracking"
                                  >
                                    ⓘ
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {updateInfo?.hasUpdate && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      // Find the original skin data to get the URL
                                      const originalSkin = downloadedSkins.find(
                                        (s) =>
                                          s.championName === championKey &&
                                          s.skinName === skin.skinName
                                      )
                                      handleUpdateSkin({
                                        championName: championKey,
                                        skinName: skin.skinName,
                                        url: originalSkin?.url || '',
                                        localPath: skin.localPath,
                                        source: 'repository'
                                      })
                                    }}
                                    disabled={isUpdating}
                                  >
                                    {isUpdating ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                                        Updating...
                                      </>
                                    ) : (
                                      'Update'
                                    )}
                                  </Button>
                                )}
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() =>
                                    handleDeleteSkin(
                                      championKey,
                                      skin.skinName,
                                      skin.localPath,
                                      skin.isCustom
                                    )
                                  }
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                      {t('skins.deleting')}
                                    </>
                                  ) : (
                                    <>
                                      <svg
                                        className="w-4 h-4 mr-1"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                      {t('actions.delete')}
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col items-center justify-center gap-2">
          <div className="text-sm text-text-muted">{t('skins.total', { count: totalSkins })}</div>
          <Button variant="secondary" onClick={onClose}>
            {t('actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
