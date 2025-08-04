import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import type { SelectedSkin } from '../store/atoms'

interface SavePresetDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedSkins: SelectedSkin[]
  onSave: (name: string, description?: string) => Promise<void>
}

export const SavePresetDialog: React.FC<SavePresetDialogProps> = ({
  isOpen,
  onClose,
  selectedSkins,
  onSave
}) => {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('presets.errors.nameRequired'))
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(name.trim(), description.trim() || undefined)
      // Reset form on success
      setName('')
      setDescription('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('presets.errors.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (!isSaving) {
      setName('')
      setDescription('')
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('presets.saveDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('presets.saveDialog.description', { count: selectedSkins.length })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="preset-name">{t('presets.saveDialog.nameLabel')}</Label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('presets.saveDialog.namePlaceholder')}
              disabled={isSaving}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="preset-description">{t('presets.saveDialog.descriptionLabel')}</Label>
            <Textarea
              id="preset-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('presets.saveDialog.descriptionPlaceholder')}
              disabled={isSaving}
              rows={3}
            />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button onClick={handleClose} variant="outline" disabled={isSaving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
