import { useCallback, useEffect } from 'react'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { gamePathAtom, statusMessageAtom } from '../store/atoms/game.atoms'

export function useGameDetection() {
  const { t } = useTranslation()
  const [gamePath, setGamePath] = useAtom(gamePathAtom)
  const [, setStatusMessage] = useAtom(statusMessageAtom)

  const detectGamePath = useCallback(async () => {
    const result = await window.api.detectGame()
    if (result.success && result.gamePath) {
      setGamePath(result.gamePath)
      setStatusMessage(t('status.gameDetected'))
    } else {
      setStatusMessage(t('status.gameNotFound'))
    }
  }, [t, setGamePath, setStatusMessage])

  const browseForGame = useCallback(async () => {
    const result = await window.api.browseGameFolder()
    if (result.success && result.gamePath) {
      setGamePath(result.gamePath)
      setStatusMessage(t('status.gamePathSet'))
    }
  }, [setGamePath, setStatusMessage, t])

  useEffect(() => {
    detectGamePath()
  }, [detectGamePath])

  return {
    gamePath,
    detectGamePath,
    browseForGame
  }
}
