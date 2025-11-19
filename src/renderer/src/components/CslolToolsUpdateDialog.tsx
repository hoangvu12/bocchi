import { useState, useEffect } from 'react'
import { Download, RefreshCw, AlertTriangle } from 'lucide-react'
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

interface CslolToolsUpdateDialogProps {
  isOpen: boolean
  onClose: () => void
  currentVersion: string | null
  latestVersion: string | null
}

export function CslolToolsUpdateDialog({
  isOpen,
  onClose,
  currentVersion,
  latestVersion
}: CslolToolsUpdateDialogProps) {
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Reset state when dialog opens
      setDownloadProgress(0)
      setIsDownloading(false)
      setError(null)
    }
  }, [isOpen])

  useEffect(() => {
    // Set up event listeners for download progress
    const unsubscribeProgress = window.api.onToolsDownloadProgress((progress) => {
      setDownloadProgress(progress)
    })

    return () => {
      unsubscribeProgress()
    }
  }, [])

  const handleDownload = async () => {
    setIsDownloading(true)
    setError(null)
    try {
      const result = await window.api.downloadTools()
      if (result.success) {
        setIsDownloading(false)
        onClose()
        // Show success message via toast
        const { toast } = await import('sonner')
        toast.success('cslol-tools updated successfully! Restart to apply changes.')
      } else {
        setError(result.error || 'Failed to download update')
        setIsDownloading(false)
      }
    } catch {
      setError('Failed to download update')
      setIsDownloading(false)
    }
  }

  const handleCancel = () => {
    if (!isDownloading) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-info" />
            cslol-tools Update Available
          </DialogTitle>
          <DialogDescription>
            A new version of cslol-tools is available for download.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Version info */}
          <div className="bg-surface rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary mb-1">Current Version</p>
                <p className="text-lg font-semibold text-text-primary">
                  {currentVersion || (
                    <span className="flex items-center gap-2 text-warning">
                      <AlertTriangle className="w-4 h-4" />
                      Old version (no tracking)
                    </span>
                  )}
                </p>
              </div>
              <div className="text-text-muted mx-4">→</div>
              <div>
                <p className="text-sm text-text-secondary mb-1">Latest Version</p>
                <p className="text-lg font-semibold text-info">{latestVersion}</p>
              </div>
            </div>
          </div>

          {/* Important note for old versions */}
          {!currentVersion && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-warning mb-1">
                    Outdated Installation Detected
                  </p>
                  <p className="text-xs text-text-secondary">
                    Your cslol-tools installation is missing version tracking. This likely means
                    you&apos;re using an older version. Updating is strongly recommended to ensure
                    compatibility and access to the latest features.
                  </p>
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
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-text-muted">Downloading...</span>
                <span className="text-text-primary font-medium">{downloadProgress}%</span>
              </div>
              <Progress value={downloadProgress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleCancel} disabled={isDownloading}>
            Later
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="bg-info hover:bg-info/90 disabled:bg-info/50"
          >
            <Download className="w-4 h-4 mr-2" />
            {isDownloading ? 'Downloading...' : 'Download and Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
