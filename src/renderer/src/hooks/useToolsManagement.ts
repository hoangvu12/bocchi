import { useCallback, useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import {
  toolsExistAtom,
  downloadingToolsAtom,
  toolsDownloadProgressAtom,
  statusMessageAtom,
  toolsErrorAtom,
  downloadAttemptsAtom,
  downloadSpeedAtom,
  downloadSizeAtom
} from '../store/atoms/game.atoms'

export function useToolsManagement() {
  const { t } = useTranslation()
  const [toolsExist, setToolsExist] = useAtom(toolsExistAtom)
  const [downloadingTools, setDownloadingTools] = useAtom(downloadingToolsAtom)
  const [toolsDownloadProgress, setToolsDownloadProgress] = useAtom(toolsDownloadProgressAtom)
  const [toolsError, setToolsError] = useAtom(toolsErrorAtom)
  const [downloadAttempts, setDownloadAttempts] = useAtom(downloadAttemptsAtom)
  const [downloadSpeed, setDownloadSpeed] = useAtom(downloadSpeedAtom)
  const [downloadSize, setDownloadSize] = useAtom(downloadSizeAtom)
  const setStatusMessage = useSetAtom(statusMessageAtom)

  const checkToolsExist = useCallback(async () => {
    const exist = await window.api.checkToolsExist()
    setToolsExist(exist)
  }, [setToolsExist])

  const downloadTools = useCallback(
    async (isRetry = false) => {
      setDownloadingTools(true)
      setToolsError(null)
      setStatusMessage(t('status.downloadingTools'))

      const currentAttempt = isRetry ? downloadAttempts + 1 : 1
      setDownloadAttempts(currentAttempt)

      const result = await window.api.downloadTools(currentAttempt)
      if (result.success) {
        setToolsExist(true)
        setStatusMessage(t('status.toolsDownloaded'))
        setToolsError(null)
        setDownloadAttempts(0)
      } else {
        setToolsError({
          type: result.errorType || 'unknown',
          message: result.error || 'Unknown error',
          details: result.errorDetails,
          canRetry: result.canRetry !== false
        })
        setStatusMessage(`Failed to download tools: ${result.error}`)
      }

      setDownloadingTools(false)
      setToolsDownloadProgress(0)
      setDownloadSpeed(0)
      setDownloadSize({ loaded: 0, total: 0 })
    },
    [
      t,
      setDownloadingTools,
      setToolsExist,
      setStatusMessage,
      setToolsDownloadProgress,
      setToolsError,
      downloadAttempts,
      setDownloadAttempts,
      setDownloadSpeed,
      setDownloadSize
    ]
  )

  // Set up tools download progress listener
  useEffect(() => {
    const unsubscribeProgress = window.api.onToolsDownloadProgress((progress) => {
      setToolsDownloadProgress(progress)
    })

    const unsubscribeDetails = window.api.onToolsDownloadDetails((details) => {
      setDownloadSpeed(details.speed)
      setDownloadSize({ loaded: details.loaded, total: details.total })
    })

    return () => {
      unsubscribeProgress()
      unsubscribeDetails()
    }
  }, [setToolsDownloadProgress, setDownloadSpeed, setDownloadSize])

  // Check tools on mount
  useEffect(() => {
    checkToolsExist()
  }, [checkToolsExist])

  return {
    toolsExist,
    downloadingTools,
    toolsDownloadProgress,
    toolsError,
    downloadAttempts,
    downloadSpeed,
    downloadSize,
    checkToolsExist,
    downloadTools
  }
}
