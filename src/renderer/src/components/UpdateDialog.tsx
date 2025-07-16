import { useState, useEffect } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from './ui/button'
import { Progress } from './ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'

interface UpdateDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function UpdateDialog({ isOpen, onClose }: UpdateDialogProps) {
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [changelog, setChangelog] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadUpdateInfo()
    }
  }, [isOpen])

  useEffect(() => {
    // Set up event listeners for updater events
    const unsubscribeProgress = window.api.onUpdateDownloadProgress((progress) => {
      setDownloadProgress(progress.percent)
    })

    const unsubscribeDownloaded = window.api.onUpdateDownloaded(() => {
      setIsDownloading(false)
      // Update will auto-install, just close the dialog
      onClose()
    })

    const unsubscribeError = window.api.onUpdateError((error) => {
      setError(error)
      setIsDownloading(false)
    })

    // Cleanup listeners on unmount
    return () => {
      unsubscribeProgress()
      unsubscribeDownloaded()
      unsubscribeError()
    }
  }, [onClose])

  const loadUpdateInfo = async () => {
    try {
      const info = await window.api.getUpdateInfo()
      setUpdateInfo(info)

      // Load changelog
      const changelogResult = await window.api.getUpdateChangelog()
      if (changelogResult.success && changelogResult.changelog) {
        setChangelog(changelogResult.changelog)
      }
    } catch (error) {
      console.error('Failed to load update info:', error)
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    setError(null)
    try {
      await window.api.downloadUpdate()
    } catch {
      setError('Failed to download update')
      setIsDownloading(false)
    }
  }

  const handleCancel = async () => {
    if (isDownloading) {
      await window.api.cancelUpdate()
      setIsDownloading(false)
    }
    onClose()
  }

  if (!updateInfo) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Update Available</DialogTitle>
          <DialogDescription>A new version of Bocchi is available for download.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-info" />
            <span className="text-lg font-medium text-text-primary">
              Version {updateInfo.version}
            </span>
          </div>

          {changelog && (
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-3">What&apos;s New</h3>
              <div className="bg-surface rounded p-4 max-h-96 overflow-y-auto">
                <div
                  className="prose prose-sm max-w-none
                  prose-headings:text-text-primary
                  prose-h1:text-2xl prose-h1:mb-4
                  prose-h2:text-xl prose-h2:mb-3 prose-h2:mt-6
                  prose-h3:text-lg prose-h3:mb-2 prose-h3:mt-4
                  prose-h4:text-base prose-h4:mb-2 prose-h4:mt-3
                  prose-p:text-text-secondary
                  prose-p:mb-3 prose-p:leading-relaxed
                  prose-ul:my-3 prose-ul:space-y-2
                  prose-ol:my-3 prose-ol:space-y-2
                  prose-li:text-text-secondary
                  prose-li:marker:text-primary-500
                  prose-strong:text-text-primary
                  prose-strong:font-semibold
                  prose-em:text-text-secondary
                  prose-code:text-primary-600
                  prose-code:bg-elevated
                  prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                  prose-code:before:content-[''] prose-code:after:content-['']
                  prose-pre:bg-background
                  prose-pre:text-text-primary
                  prose-a:text-primary-600
                  prose-a:no-underline hover:prose-a:underline
                  prose-blockquote:text-text-secondary
                  prose-blockquote:border-l-primary-500
                  prose-hr:border-border
                  prose-table:text-text-secondary
                  prose-thead:border-border-strong
                  prose-tbody:border-border"
                >
                  <ReactMarkdown>{changelog}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {isDownloading && (
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-text-muted">Downloading...</span>
                <span className="text-text-primary font-medium">
                  {downloadProgress.toFixed(0)}%
                </span>
              </div>
              <Progress value={downloadProgress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleCancel}>
            {isDownloading ? 'Cancel' : 'Later'}
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="bg-info hover:bg-info/90 disabled:bg-info/50"
          >
            <Download className="w-4 h-4 mr-2" />
            {isDownloading ? 'Downloading...' : 'Download and Install'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
