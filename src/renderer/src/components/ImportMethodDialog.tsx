import React, { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Link, Loader2, AlertCircle, Check, FileDown, ClipboardPaste } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { toast } from 'sonner'
import { useSetAtom } from 'jotai'
import { isDraggingAtom } from '../store/atoms/ui.atoms'

interface ImportMethodDialogProps {
  open: boolean
  onClose: () => void
  onFileSelected: (filePath: string) => void
  onMultipleFilesSelected: (filePaths: string[]) => void
}

export const ImportMethodDialog: React.FC<ImportMethodDialogProps> = ({
  open,
  onClose,
  onFileSelected,
  onMultipleFilesSelected
}) => {
  const { t } = useTranslation()
  const setGlobalIsDragging = useSetAtom(isDraggingAtom)
  const [activeTab, setActiveTab] = useState('file')
  const [urlInput, setUrlInput] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  // Reset global drag state when dialog closes
  useEffect(() => {
    if (!open) {
      setGlobalIsDragging(false)
    }
  }, [open, setGlobalIsDragging])

  // Validate URL - only allow direct download links
  const isValidUrl = useCallback((url: string): boolean => {
    try {
      const urlObj = new URL(url)
      // Check if it's a direct download link with supported extensions
      const isDirectDownload = ['.zip', '.fantome', '.wad', '.client'].some((ext) =>
        urlObj.pathname.toLowerCase().includes(ext)
      )
      return isDirectDownload
    } catch {
      return false
    }
  }, [])

  // Handle URL download
  const handleUrlImport = useCallback(async () => {
    if (!urlInput.trim()) {
      setDownloadError(t('importMethod.enterUrl'))
      return
    }

    if (!isValidUrl(urlInput)) {
      setDownloadError(t('importMethod.invalidUrl'))
      return
    }

    setIsDownloading(true)
    setDownloadError('')

    try {
      const result = await window.api.downloadFromUrl(urlInput)
      if (result.success && result.filePath) {
        onFileSelected(result.filePath)
        // Reset and close dialog
        setUrlInput('')
        setActiveTab('file')
        onClose()
      } else {
        setDownloadError(result.error || t('importMethod.downloadFailed'))
      }
    } catch {
      setDownloadError(t('importMethod.downloadFailed'))
    } finally {
      setIsDownloading(false)
    }
  }, [urlInput, isValidUrl, onFileSelected, onClose, t])

  // Handle file browse
  const handleBrowseFiles = useCallback(async () => {
    const result = await window.api.browseSkinFiles()
    if (result.success && result.filePaths) {
      if (result.filePaths.length === 1) {
        onFileSelected(result.filePaths[0])
      } else if (result.filePaths.length > 1) {
        onMultipleFilesSelected(result.filePaths)
      }
      onClose()
    }
  }, [onFileSelected, onMultipleFilesSelected, onClose])

  // Handle paste from clipboard
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setUrlInput(text.trim())
        setDownloadError('')
      }
    } catch {
      toast.error(t('importMethod.clipboardError'))
    }
  }, [t])

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set dragging if we're over the drop zone itself
    if (e.currentTarget === e.target || e.currentTarget.contains(e.target as Node)) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only unset dragging if we're leaving the drop zone entirely
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      const skinFiles = files.filter((file) => {
        const ext = file.name.toLowerCase()
        return (
          ext.endsWith('.wad.client') ||
          ext.endsWith('.wad') ||
          ext.endsWith('.zip') ||
          ext.endsWith('.fantome')
        )
      })

      if (skinFiles.length > 0) {
        const filePaths: string[] = []
        for (const file of skinFiles) {
          try {
            const filePath = window.api.getPathForFile(file)
            if (filePath) {
              filePaths.push(filePath)
            }
          } catch (err) {
            console.error('Error getting file path:', err)
          }
        }

        if (filePaths.length === 1) {
          onFileSelected(filePaths[0])
          onClose()
        } else if (filePaths.length > 1) {
          onMultipleFilesSelected(filePaths)
          onClose()
        }
      }
    },
    [onFileSelected, onMultipleFilesSelected, onClose]
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('importMethod.title')}</DialogTitle>
          <DialogDescription>{t('importMethod.description')}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {t('importMethod.fileTab')}
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              {t('importMethod.urlTab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-border hover:border-border-strong'
              }`}
              onDrop={handleDrop}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <FileDown className="h-12 w-12 mx-auto mb-4 text-text-muted" />
              <p className="text-text-primary font-medium mb-2">{t('importMethod.dropFiles')}</p>
              <p className="text-text-secondary text-sm mb-4">{t('importMethod.or')}</p>
              <Button onClick={handleBrowseFiles} variant="default">
                <Upload className="h-4 w-4 mr-2" />
                {t('importMethod.browseFiles')}
              </Button>
              <p className="text-text-muted text-xs mt-4">{t('importMethod.supportedFormats')}</p>
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">
                  {t('importMethod.enterDirectUrl')}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder={t('importMethod.directUrlPlaceholder')}
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value)
                      setDownloadError('')
                    }}
                    disabled={isDownloading}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handlePasteFromClipboard}
                    disabled={isDownloading}
                  >
                    <ClipboardPaste className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {downloadError && (
                <div className="flex items-start gap-2 text-state-error text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <span>{downloadError}</span>
                </div>
              )}

              <div className="bg-secondary-100 dark:bg-secondary-900 rounded-lg p-3">
                <p className="text-sm text-text-secondary mb-2">
                  {t('importMethod.supportedFormats')}
                </p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2 text-sm text-text-primary">
                    <Check className="h-3 w-3 text-state-success" />
                    .zip files
                  </li>
                  <li className="flex items-center gap-2 text-sm text-text-primary">
                    <Check className="h-3 w-3 text-state-success" />
                    .fantome files
                  </li>
                  <li className="flex items-center gap-2 text-sm text-text-primary">
                    <Check className="h-3 w-3 text-state-success" />
                    .wad / .wad.client files
                  </li>
                </ul>
                <p className="text-xs text-text-muted mt-2">
                  {t('importMethod.directDownloadNote')}
                </p>
              </div>

              <Button
                onClick={handleUrlImport}
                disabled={isDownloading || !urlInput.trim()}
                className="w-full"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('importMethod.downloading')}
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4 mr-2" />
                    {t('importMethod.download')}
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
