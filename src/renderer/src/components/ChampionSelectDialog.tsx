import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import { Button } from './ui/button'
import type { Champion, Skin } from '../App'

interface ChampionSelectDialogProps {
  champion: Champion | null
  isLocked: boolean
  onViewSkins: () => void
  onClose: () => void
  championData?: {
    champions: Champion[]
  }
  onAddSkin?: (champion: Champion, skin: Skin, chromaId?: string) => void
}

export function ChampionSelectDialog({
  champion,
  isLocked,
  onViewSkins,
  onClose,
  championData,
  onAddSkin
}: ChampionSelectDialogProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setIsOpen(!!champion)
  }, [champion])

  const handleViewSkins = () => {
    onViewSkins()
    setIsOpen(false)
    onClose()
  }

  const handleClose = () => {
    setIsOpen(false)
    onClose()
  }

  const handleRandomSkin = () => {
    if (!champion || !onAddSkin) return

    // Get all available skins (excluding base skin with num 0)
    const availableSkins = champion.skins.filter((skin) => skin.num !== 0)

    if (availableSkins.length === 0) return

    // Select a random skin
    const randomIndex = Math.floor(Math.random() * availableSkins.length)
    const randomSkin = availableSkins[randomIndex]

    // Add the skin
    onAddSkin(champion, randomSkin)

    // Close the dialog
    handleClose()
  }

  const handleRandomRaritySkin = () => {
    if (!champion || !onAddSkin) return

    // Get all skins with rarity (excluding base skin and skins without rarity)
    const raritySkins = champion.skins.filter(
      (skin) => skin.num !== 0 && skin.rarity && skin.rarity !== 'kNoRarity'
    )

    if (raritySkins.length === 0) return

    // Select a random rarity skin
    const randomIndex = Math.floor(Math.random() * raritySkins.length)
    const randomSkin = raritySkins[randomIndex]

    // Add the skin
    onAddSkin(champion, randomSkin)

    // Close the dialog
    handleClose()
  }

  if (!champion) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isLocked ? t('lcu.championLocked') : t('lcu.championHovered')}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-4 pt-4">
              <div className="flex items-center gap-4">
                <img src={champion.image} alt={champion.name} className="w-20 h-20 rounded-lg" />
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">{champion.name}</h3>
                  <p className="text-sm text-text-secondary">{champion.title}</p>
                </div>
              </div>
              <p className="text-sm text-text-secondary">
                {isLocked
                  ? t('lcu.championLockedDescription', { champion: champion.name })
                  : t('lcu.championHoveredDescription', { champion: champion.name })}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button variant="secondary" onClick={handleClose}>
            {t('actions.cancel')}
          </Button>
          {onAddSkin && championData && (
            <>
              <Button variant="outline" onClick={handleRandomSkin}>
                {t('lcu.randomSkin')}
              </Button>
              <Button variant="outline" onClick={handleRandomRaritySkin}>
                {t('lcu.randomRaritySkin')}
              </Button>
            </>
          )}
          <Button onClick={handleViewSkins}>{t('lcu.viewSkins')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
