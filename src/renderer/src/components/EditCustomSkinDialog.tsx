import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Loader2, Wrench } from 'lucide-react'

interface EditCustomSkinDialogProps {
  isOpen: boolean
  currentName: string
  modPath?: string
  onClose: () => void
  onSave: (newName: string, newImagePath?: string) => void
  onFixComplete?: () => void
}

export const EditCustomSkinDialog: React.FC<EditCustomSkinDialogProps> = ({
  isOpen,
  currentName,
  modPath,
  onClose,
  onSave,
  onFixComplete
}) => {
  const { t } = useTranslation()
  const [newName, setNewName] = useState(currentName)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedImageName, setSelectedImageName] = useState<string>('')
  const [isFixing, setIsFixing] = useState(false)
  const [fixProgress, setFixProgress] = useState<string>('')

  useEffect(() => {
    setNewName(currentName)
    setSelectedImage(null)
    setSelectedImageName('')
  }, [currentName])

  const handleSelectImage = async () => {
    const result = await window.api.browseImageFile()
    if (result.success && result.filePath) {
      setSelectedImage(result.filePath)
      const fileName = result.filePath.split(/[\\/]/).pop() || ''
      setSelectedImageName(fileName)
    }
  }

  const handleSave = () => {
    if (newName.trim()) {
      onSave(newName.trim(), selectedImage || undefined)
    }
  }

  const handleFixModIssues = async () => {
    if (!modPath) return

    setIsFixing(true)
    setFixProgress(t('editCustomSkin.startingFix'))

    try {
      // Set up progress listener
      const unsubscribeProgress = window.api.onFixModProgress((message) => {
        setFixProgress(message)
      })

      // Run the fix
      const result = await window.api.fixModIssues(modPath)

      // Clean up listener
      unsubscribeProgress()

      if (result.success) {
        setFixProgress(t('editCustomSkin.fixCompleted'))
        // Wait a bit before closing
        setTimeout(() => {
          setIsFixing(false)
          setFixProgress('')
          onFixComplete?.()
        }, 1500)
      } else {
        setFixProgress(t('editCustomSkin.fixFailed', { error: result.error }))
        setTimeout(() => {
          setIsFixing(false)
          setFixProgress('')
        }, 3000)
      }
    } catch {
      setFixProgress(t('editCustomSkin.fixError'))
      setTimeout(() => {
        setIsFixing(false)
        setFixProgress('')
      }, 3000)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editCustomSkin.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="mod-name">{t('editCustomSkin.modName')}</Label>
            <Input
              id="mod-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('editCustomSkin.modNamePlaceholder')}
            />
          </div>

          <div>
            <Label>{t('editCustomSkin.previewImage')}</Label>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleSelectImage}>
                {t('editCustomSkin.selectImage')}
              </Button>
              {selectedImageName && (
                <span className="text-sm text-charcoal-600 dark:text-charcoal-400 truncate">
                  {selectedImageName}
                </span>
              )}
            </div>
            {selectedImage && (
              <p className="text-xs text-charcoal-500 dark:text-charcoal-500 mt-1">
                {t('editCustomSkin.newImageSelected')}
              </p>
            )}
          </div>

          {modPath && (
            <div>
              <Label>{t('editCustomSkin.modMaintenance')}</Label>
              <Button
                variant="secondary"
                onClick={handleFixModIssues}
                disabled={isFixing}
                className="w-full mt-2"
              >
                {isFixing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('editCustomSkin.fixing')}
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4 mr-2" />
                    {t('editCustomSkin.fixModIssues')}
                  </>
                )}
              </Button>
              {fixProgress && (
                <p className="text-xs mt-2 text-charcoal-500 dark:text-charcoal-400">
                  {fixProgress}
                </p>
              )}
              <p className="text-xs text-charcoal-500 dark:text-charcoal-500 mt-1">
                {t('editCustomSkin.fixDescription')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!newName.trim()}
            className="bg-terracotta-500 hover:bg-terracotta-600"
          >
            {t('editCustomSkin.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
