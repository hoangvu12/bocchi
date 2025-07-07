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
import type { Champion } from '../App'

interface ChampionSelectDialogProps {
  champion: Champion | null
  isLocked: boolean
  onViewSkins: () => void
  onClose: () => void
}

export function ChampionSelectDialog({
  champion,
  isLocked,
  onViewSkins,
  onClose
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
        <DialogFooter>
          <Button variant="secondary" onClick={handleClose}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleViewSkins}>{t('lcu.viewSkins')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
