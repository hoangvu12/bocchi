import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

interface LCUStatusIndicatorProps {
  connected: boolean
  inChampSelect: boolean
  enabled: boolean
}

export function LCUStatusIndicator({ connected, inChampSelect, enabled }: LCUStatusIndicatorProps) {
  const { t } = useTranslation()

  const getTooltipText = () => {
    if (!enabled) {
      return t('lcu.tooltipDisabled')
    }
    if (connected) {
      return inChampSelect ? t('lcu.tooltipInChampSelect') : t('lcu.tooltipConnected')
    }
    return t('lcu.tooltipNotConnected')
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 bg-surface rounded-lg border border-border cursor-help transition-all duration-200 ${
              enabled
                ? 'hover:bg-secondary-100 dark:hover:bg-secondary-800 hover:border-border-strong'
                : 'opacity-40 cursor-not-allowed'
            }`}
          >
            {/* League icon */}
            <svg
              className={`w-3.5 h-3.5 ${enabled ? 'text-text-secondary' : 'text-text-muted'}`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 3.9L18 9v8c0 3.9-2.7 7.6-6 8.9-3.3-1.3-6-5-6-8.9V9l6-3.1z" />
            </svg>

            <div className="relative">
              <div
                className={`w-2 h-2 rounded-full ${
                  !enabled
                    ? 'bg-secondary-400 dark:bg-secondary-600'
                    : connected
                      ? 'bg-success'
                      : 'bg-error'
                }`}
              />
              {enabled && connected && inChampSelect && (
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-success animate-ping" />
              )}
            </div>

            <span className={`text-xs ${enabled ? 'text-text-secondary' : 'text-text-muted'}`}>
              {!enabled
                ? t('lcu.disabled')
                : connected
                  ? inChampSelect
                    ? t('lcu.inChampSelect')
                    : 'League Connected'
                  : 'League Client'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
