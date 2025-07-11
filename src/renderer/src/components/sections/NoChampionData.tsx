import { useTranslation } from 'react-i18next'

interface NoChampionDataProps {
  loading: boolean
}

export function NoChampionData({ loading }: NoChampionDataProps) {
  const { t } = useTranslation()

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 bg-cream-300 dark:bg-charcoal-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-charcoal-600 dark:text-charcoal-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <p className="text-lg text-text-secondary mb-6">{t('champion.noData')}</p>
        <button
          className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-all duration-200 shadow-soft hover:shadow-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          onClick={() => window.api.fetchChampionData('en_US')}
          disabled={loading}
        >
          {t('champion.downloadData')}
        </button>
      </div>
    </div>
  )
}
