import React from 'react'
import { useTranslation } from 'react-i18next'
import { Champion, Skin } from '../App'
import { type SelectedSkin } from '../store/atoms'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'

interface VariantSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  champion: Champion
  skin: Skin
  selectedSkins: SelectedSkin[]
  downloadedSkins: Array<{ championName: string; skinName: string; localPath?: string }>
  onVariantSelect: (champion: Champion, skin: Skin, variantId: string) => void
  favorites: Set<string>
  onToggleVariantFavorite?: (
    champion: Champion,
    skin: Skin,
    variantId: string,
    variantName: string
  ) => void
}

export const VariantSelectionDialog: React.FC<VariantSelectionDialogProps> = ({
  open,
  onOpenChange,
  champion,
  skin,
  selectedSkins,
  downloadedSkins,
  onVariantSelect,
  favorites,
  onToggleVariantFavorite
}) => {
  const { t } = useTranslation()

  if (!skin.variants) return null

  const isVariantSelected = (variantId: string) => {
    return selectedSkins.some(
      (s) => s.championKey === champion.key && s.skinId === skin.id && s.variantId === variantId
    )
  }

  const isVariantDownloaded = (variant: { githubUrl: string; downloadUrl?: string }) => {
    // Extract filename from variant URL (use downloadUrl if available, otherwise githubUrl)
    const urlToCheck = variant.downloadUrl || variant.githubUrl
    const urlParts = urlToCheck.split('/')
    const variantFileName = decodeURIComponent(urlParts[urlParts.length - 1])

    return downloadedSkins.some(
      (ds) => ds.championName === champion.key && ds.skinName === variantFileName
    )
  }

  const isVariantFavorite = (variantId: string) => {
    return favorites.has(`${champion.key}_${skin.id}_${variantId}`)
  }

  // Get the base skin image URL
  const baseSkinImageUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champion.key}_${skin.num}.jpg`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('skins.selectVariant', { skinName: skin.name })}</DialogTitle>
          <DialogDescription>
            {t('skins.chooseVariant', {
              count: skin.variants.items.length,
              type:
                skin.variants.type === 'exalted'
                  ? t('skins.exaltedVariant')
                  : t('skins.formVariant')
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-2 p-1">
            {skin.variants.items.map((variant) => {
              const isSelected = isVariantSelected(variant.id)
              const isDownloaded = isVariantDownloaded(variant)

              return (
                <div
                  key={variant.id}
                  className={`relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-500'
                      : 'bg-surface border-2 border-border hover:border-primary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800'
                  }`}
                  onClick={() => {
                    onVariantSelect(champion, skin, variant.id)
                    onOpenChange(false)
                  }}
                >
                  <img
                    src={variant.imageUrl || baseSkinImageUrl}
                    alt={variant.displayName || variant.name}
                    className="w-16 h-16 rounded-lg object-cover"
                    loading="lazy"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">
                      {variant.displayName || variant.name}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {skin.variants?.type === 'exalted' ? 'Exalted' : 'Form'}
                    </p>
                  </div>
                  {onToggleVariantFavorite && skin.variants && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 mr-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleVariantFavorite(champion, skin, variant.id, variant.name)
                      }}
                      title={
                        isVariantFavorite(variant.id) ? 'Remove from favorites' : 'Add to favorites'
                      }
                    >
                      {isVariantFavorite(variant.id) ? '❤️' : '🤍'}
                    </Button>
                  )}
                  {isSelected && (
                    <svg
                      className="w-5 h-5 text-primary-600"
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
                  )}
                  {isDownloaded && !isSelected && (
                    <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                      <span className="text-white text-xs">↓</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
