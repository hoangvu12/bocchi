import { memo } from 'react'
import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAtom, useAtomValue } from 'jotai'
import { gamePathAtom, toolsExistAtom } from '../../store/atoms/game.atoms'
import { championDataAtom } from '../../store/atoms/champion.atoms'
import { showFavoritesOnlyAtom } from '../../store/atoms'
import { showSettingsDialogAtom } from '../../store/atoms/ui.atoms'
import {
  leagueClientEnabledAtom,
  championDetectionEnabledAtom
} from '../../store/atoms/settings.atoms'
import { lcuConnectedAtom, isInChampSelectAtom } from '../../store/atoms/lcu.atoms'
import { useGameDetection } from '../../hooks/useGameDetection'
import { useChampionData } from '../../hooks/useChampionData'
import { LCUStatusIndicator } from '../LCUStatusIndicator'
import { RoomPanel } from '../RoomPanel'

export const AppHeader = memo(() => {
  const { t } = useTranslation()
  const gamePath = useAtomValue(gamePathAtom)
  const toolsExist = useAtomValue(toolsExistAtom)
  const championData = useAtomValue(championDataAtom)
  const [showFavoritesOnly, setShowFavoritesOnly] = useAtom(showFavoritesOnlyAtom)
  const [, setShowSettingsDialog] = useAtom(showSettingsDialogAtom)
  const leagueClientEnabled = useAtomValue(leagueClientEnabledAtom)
  const championDetectionEnabled = useAtomValue(championDetectionEnabledAtom)
  const lcuConnected = useAtomValue(lcuConnectedAtom)
  const isInChampSelect = useAtomValue(isInChampSelectAtom)

  const { browseForGame } = useGameDetection()
  const { fetchChampionData, isLoadingChampionData } = useChampionData()

  const loading = isLoadingChampionData || !toolsExist

  return (
    <div className="flex items-center justify-between px-8 py-5 bg-surface border-b-2 border-border shadow-sm dark:shadow-none">
      <div className="flex items-center gap-3 flex-1">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            value={gamePath}
            placeholder="Game path not set"
            readOnly
            className="flex-1 px-4 py-2.5 text-sm bg-elevated border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          />
          <button
            className="px-4 py-2.5 text-sm bg-surface hover:bg-secondary-100 dark:hover:bg-secondary-800 text-text-primary font-medium rounded-lg transition-all duration-200 border border-border hover:border-border-strong shadow-sm hover:shadow-md dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={browseForGame}
            disabled={loading}
          >
            {t('actions.browse')}
          </button>
        </div>
        <button
          className={`px-4 py-2.5 text-sm rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium
            ${
              showFavoritesOnly
                ? 'bg-error/10 text-error hover:bg-error/20 border-2 border-error/30'
                : 'bg-surface text-text-primary hover:bg-secondary-100 dark:hover:bg-secondary-800 border border-border shadow-sm hover:shadow-md dark:shadow-none'
            }`}
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          disabled={loading}
          aria-pressed={showFavoritesOnly}
          aria-label={t('nav.favorites')}
        >
          <Heart
            className={`w-4 h-4 ${
              showFavoritesOnly ? 'text-error fill-error' : 'text-text-secondary'
            } transition-colors`}
            aria-hidden="true"
            strokeWidth={showFavoritesOnly ? 2.5 : 2}
            fill={showFavoritesOnly ? 'currentColor' : 'none'}
          />
          {t('nav.favorites')}
        </button>
        {!championData && (
          <button
            className="px-5 py-2.5 text-sm bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-all duration-200 shadow-soft hover:shadow-medium dark:shadow-dark-soft disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            onClick={fetchChampionData}
            disabled={loading}
          >
            {t('champion.downloadData')}
          </button>
        )}
        <LCUStatusIndicator
          connected={lcuConnected}
          inChampSelect={isInChampSelect}
          enabled={leagueClientEnabled && championDetectionEnabled}
        />
        <button
          className="px-3 py-2.5 text-sm bg-surface hover:bg-secondary-100 dark:hover:bg-secondary-800 text-text-primary font-medium rounded-lg transition-all duration-200 border border-border hover:border-border-strong shadow-sm hover:shadow-md dark:shadow-none flex items-center gap-2"
          onClick={() => setShowSettingsDialog(true)}
          title={t('settings.title')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
        <RoomPanel />
      </div>
    </div>
  )
})

AppHeader.displayName = 'AppHeader'
