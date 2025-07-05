import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'

interface DownloadedSkinsDialogProps {
  isOpen: boolean
  onClose: () => void
  downloadedSkins: Array<{ championName: string; skinName: string; localPath?: string }>
  championData?: {
    champions: Array<{ key: string; name: string }>
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
      const championDisplayName =
        championData?.champions.find((c) => c.key === skin.championName)?.name || skin.championName
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('skins.downloadedCount', { count: totalSkins })}</DialogTitle>
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
                  const nameA = championData?.champions.find((c) => c.key === a)?.name || a
                  const nameB = championData?.champions.find((c) => c.key === b)?.name || b
                  return nameA.localeCompare(nameB)
                })
                .map(([championKey, skins]) => {
                  const championName =
                    championData?.champions.find((c) => c.key === championKey)?.name || championKey

                  return (
                    <div
                      key={championKey}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      <div className="bg-secondary-100 dark:bg-secondary-900 px-4 py-2">
                        <h3 className="font-semibold text-text-primary">
                          {championName} ({skins.length})
                        </h3>
                      </div>
                      <div className="divide-y divide-border">
                        {skins.map((skin) => {
                          const key = `${championKey}_${skin.skinName}`
                          const isDeleting = deletingSkins.has(key)
                          const displayName = skin.skinName
                            .replace(/\[User\]\s*/, '')
                            .replace(/\.(zip|wad|fantome)$/, '')

                          return (
                            <div
                              key={skin.skinName}
                              className="px-4 py-3 flex items-center justify-between hover:bg-secondary-100 dark:hover:bg-secondary-800/50 transition-colors"
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
                              </div>
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
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        <DialogFooter className="justify-between">
          <div className="text-sm text-text-muted">{t('skins.total', { count: totalSkins })}</div>
          <Button variant="secondary" onClick={onClose}>
            {t('actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
