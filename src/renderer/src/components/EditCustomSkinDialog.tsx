import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Loader2, Wrench, FileCode } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { toast } from 'sonner'
import type { Champion } from '../App'
import { getChampionDisplayName } from '../utils/championUtils'

interface EditCustomSkinDialogProps {
  isOpen: boolean
  currentName: string
  currentChampion?: string
  modPath?: string
  champions?: Champion[]
  onClose: () => void
  onSave: (newName: string, newChampion?: string, newImagePath?: string) => void
  onFixComplete?: () => void
}

export const EditCustomSkinDialog: React.FC<EditCustomSkinDialogProps> = ({
  isOpen,
  currentName,
  currentChampion,
  modPath,
  champions,
  onClose,
  onSave,
  onFixComplete
}) => {
  const { t } = useTranslation()
  const [newName, setNewName] = useState(currentName)
  const [selectedChampion, setSelectedChampion] = useState<string>(currentChampion || '__none__')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedImageName, setSelectedImageName] = useState<string>('')
  const [isFixing, setIsFixing] = useState(false)
  const [fixProgress, setFixProgress] = useState<string>('')
  const [isSwappingFile, setIsSwappingFile] = useState(false)
  const [swapProgress, setSwapProgress] = useState<string>('')

  useEffect(() => {
    setNewName(currentName)
    setSelectedChampion(currentChampion || '__none__')
    setSelectedImage(null)
    setSelectedImageName('')
  }, [currentName, currentChampion])

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
      // Convert __none__ back to empty string for the backend
      const championToSave = selectedChampion === '__none__' ? '' : selectedChampion
      onSave(newName.trim(), championToSave, selectedImage || undefined)
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

  const handleSwapModFile = async () => {
    if (!modPath) return

    // Browse for new mod file
    const browseResult = await window.api.browseSkinFiles()
    if (!browseResult.success || !browseResult.filePaths || browseResult.filePaths.length === 0) {
      return
    }

    const newModFilePath = browseResult.filePaths[0]

    setIsSwappingFile(true)
    setSwapProgress(t('editCustomSkin.swappingFile'))

    try {
      const result = await window.api.swapCustomModFile(modPath, newModFilePath)

      if (result.success) {
        setSwapProgress(t('editCustomSkin.swapCompleted'))
        toast.success(t('editCustomSkin.modFileSwapped'))

        // Wait a bit before resetting
        setTimeout(() => {
          setIsSwappingFile(false)
          setSwapProgress('')
          onFixComplete?.() // Refresh the skin list
        }, 1500)
      } else {
        setSwapProgress(t('editCustomSkin.swapFailed', { error: result.error }))
        toast.error(result.error || t('editCustomSkin.swapError'))
        setTimeout(() => {
          setIsSwappingFile(false)
          setSwapProgress('')
        }, 3000)
      }
    } catch {
      setSwapProgress(t('editCustomSkin.swapError'))
      toast.error(t('editCustomSkin.swapError'))
      setTimeout(() => {
        setIsSwappingFile(false)
        setSwapProgress('')
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
            <Label htmlFor="champion-select">{t('editCustomSkin.champion')}</Label>
            <Select value={selectedChampion} onValueChange={setSelectedChampion}>
              <SelectTrigger id="champion-select">
                <SelectValue placeholder={t('editCustomSkin.selectChampion')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-charcoal-500 dark:text-charcoal-500">
                    {t('editCustomSkin.noSpecificChampion')}
                  </span>
                </SelectItem>
                {champions?.map((champion) => (
                  <SelectItem key={champion.key} value={champion.key}>
                    {getChampionDisplayName(champion)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <div className="space-y-4">
              <div>
                <Label>{t('editCustomSkin.modMaintenance')}</Label>
                <Button
                  variant="secondary"
                  onClick={handleFixModIssues}
                  disabled={isFixing || isSwappingFile}
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

              <div>
                <Label>{t('editCustomSkin.replaceModFile')}</Label>
                <Button
                  variant="secondary"
                  onClick={handleSwapModFile}
                  disabled={isSwappingFile || isFixing}
                  className="w-full mt-2"
                >
                  {isSwappingFile ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('editCustomSkin.swapping')}
                    </>
                  ) : (
                    <>
                      <FileCode className="w-4 h-4 mr-2" />
                      {t('editCustomSkin.swapModFile')}
                    </>
                  )}
                </Button>
                {swapProgress && (
                  <p className="text-xs mt-2 text-charcoal-500 dark:text-charcoal-400">
                    {swapProgress}
                  </p>
                )}
                <p className="text-xs text-charcoal-500 dark:text-charcoal-500 mt-1">
                  {t('editCustomSkin.swapDescription')}
                </p>
              </div>
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
