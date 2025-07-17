import React from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Progress } from './ui/progress'
import { Pause, Play, X, AlertCircle, CheckCircle2 } from 'lucide-react'

interface DownloadProgress {
  totalSkins: number
  completedSkins: number
  currentSkin: string | null
  currentProgress: number
  downloadSpeed: number
  timeRemaining: number
  failedSkins: string[]
  isRunning: boolean
  isPaused: boolean
}

interface DownloadAllSkinsDialogProps {
  isOpen: boolean
  progress: DownloadProgress
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onClose: () => void
  onRetry?: () => void
}

export const DownloadAllSkinsDialog: React.FC<DownloadAllSkinsDialogProps> = ({
  isOpen,
  progress,
  onPause,
  onResume,
  onCancel,
  onClose,
  onRetry
}) => {
  const { t } = useTranslation()

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
  }

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const overallProgress =
    progress.totalSkins > 0 ? (progress.completedSkins / progress.totalSkins) * 100 : 0

  const isCompleted = progress.completedSkins === progress.totalSkins && progress.totalSkins > 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCompleted ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                {t('downloadAll.completed')}
              </>
            ) : (
              <>
                {progress.isPaused ? (
                  <Pause className="h-5 w-5 text-yellow-500" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
                )}
                {t('downloadAll.title')}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Overall Progress */}
          <div>
            <div className="flex justify-between text-sm text-text-secondary mb-2">
              <span>
                {t('downloadAll.progress', {
                  completed: progress.completedSkins,
                  total: progress.totalSkins
                })}
              </span>
              <span>{overallProgress.toFixed(1)}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>

          {/* Current Download */}
          {progress.currentSkin && !isCompleted && (
            <div>
              <div className="flex justify-between text-sm text-text-secondary mb-2">
                <span className="truncate">{progress.currentSkin}</span>
                <span>{progress.currentProgress}%</span>
              </div>
              <Progress value={progress.currentProgress} className="h-1" />
            </div>
          )}

          {/* Stats */}
          {progress.isRunning && !isCompleted && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-secondary">{t('downloadAll.speed')}: </span>
                <span className="text-text-primary">{formatSpeed(progress.downloadSpeed)}</span>
              </div>
              <div>
                <span className="text-text-secondary">{t('downloadAll.timeRemaining')}: </span>
                <span className="text-text-primary">{formatTime(progress.timeRemaining)}</span>
              </div>
            </div>
          )}

          {/* Failed Downloads */}
          {progress.failedSkins.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t('downloadAll.failedDownloads', { count: progress.failedSkins.length })}
                </span>
              </div>
              <div className="max-h-20 overflow-y-auto">
                {progress.failedSkins.map((skin, index) => (
                  <div key={index} className="text-xs text-red-600 dark:text-red-400 truncate">
                    {skin}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {isCompleted ? (
              <>
                {progress.failedSkins.length > 0 && onRetry && (
                  <Button onClick={onRetry} variant="default" className="flex-1">
                    <svg
                      className="h-4 w-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Retry Failed
                  </Button>
                )}
                <Button
                  onClick={onClose}
                  className={progress.failedSkins.length > 0 ? '' : 'flex-1'}
                >
                  {t('common.close')}
                </Button>
              </>
            ) : (
              <>
                {progress.isPaused ? (
                  <Button onClick={onResume} variant="default" className="flex-1">
                    <Play className="h-4 w-4 mr-2" />
                    {t('downloadAll.resume')}
                  </Button>
                ) : (
                  <Button onClick={onPause} variant="secondary" className="flex-1">
                    <Pause className="h-4 w-4 mr-2" />
                    {t('downloadAll.pause')}
                  </Button>
                )}
                <Button onClick={onCancel} variant="destructive">
                  <X className="h-4 w-4 mr-2" />
                  {t('downloadAll.cancel')}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
