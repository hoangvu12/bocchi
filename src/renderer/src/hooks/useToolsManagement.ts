import { useCallback, useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import {
  toolsExistAtom,
  downloadingToolsAtom,
  toolsDownloadProgressAtom,
  statusMessageAtom
} from '../store/atoms/game.atoms'

export function useToolsManagement() {
  const { t } = useTranslation()
  const [toolsExist, setToolsExist] = useAtom(toolsExistAtom)
  const [downloadingTools, setDownloadingTools] = useAtom(downloadingToolsAtom)
  const [toolsDownloadProgress, setToolsDownloadProgress] = useAtom(toolsDownloadProgressAtom)
  const setStatusMessage = useSetAtom(statusMessageAtom)

  const checkToolsExist = useCallback(async () => {
    const exist = await window.api.checkToolsExist()
    setToolsExist(exist)
  }, [setToolsExist])

  const downloadTools = useCallback(async () => {
    setDownloadingTools(true)
    setStatusMessage(t('status.downloadingTools'))

    const result = await window.api.downloadTools()
    if (result.success) {
      setToolsExist(true)
      setStatusMessage(t('status.toolsDownloaded'))
    } else {
      setStatusMessage(`Failed to download tools: ${result.error}`)
    }

    setDownloadingTools(false)
    setToolsDownloadProgress(0)
  }, [t, setDownloadingTools, setToolsExist, setStatusMessage, setToolsDownloadProgress])

  // Set up tools download progress listener
  useEffect(() => {
    const unsubscribe = window.api.onToolsDownloadProgress((progress) => {
      setToolsDownloadProgress(progress)
    })

    return () => {
      unsubscribe()
    }
  }, [setToolsDownloadProgress])

  // Check tools on mount
  useEffect(() => {
    checkToolsExist()
  }, [checkToolsExist])

  return {
    toolsExist,
    downloadingTools,
    toolsDownloadProgress,
    checkToolsExist,
    downloadTools
  }
}
