import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
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
      <DialogContent className="sm:max-w-[500px] bg-surface border-border">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-semibold">{t('lcu.championLocked')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center gap-4">
            <img
              src={champion.image}
              alt={champion.name}
              className="w-20 h-20 rounded-full border-2 border-border"
            />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-text-primary">{champion.name}</h3>
              <p className="text-sm text-text-secondary">{champion.title}</p>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            {t('lcu.championLockedDescription', { champion: champion.name })}
          </p>
        </div>
        <DialogFooter className="flex flex-row gap-3 pt-4">
          <Button variant="ghost" onClick={handleClose} className="flex-1">
            {t('actions.cancel')}
          </Button>
          {onAddSkin && championData && (
            <>
              <Button variant="secondary" onClick={handleRandomSkin} className="flex-1">
                {t('lcu.randomSkin')}
              </Button>
              <Button variant="secondary" onClick={handleRandomRaritySkin} className="flex-1">
                {t('lcu.randomRaritySkin')}
              </Button>
            </>
          )}
          <Button
            variant="default"
            onClick={handleViewSkins}
            className="flex-1 bg-primary-500 hover:bg-primary-600"
          >
            {t('lcu.viewSkins')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
