import { useTranslation } from 'react-i18next'
import { useToolsManagement } from '../../hooks/useToolsManagement'
import { useStyles, useClassNames } from '../../hooks/useOptimizedState'

export function ToolsDownloadModal() {
  const { t } = useTranslation()
  const { toolsExist, downloadingTools, toolsDownloadProgress, downloadTools } =
    useToolsManagement()
  const styles = useStyles()
  const { getProgressBarFillStyle } = useClassNames()

  if (toolsExist !== false) return null

  return (
    <div className={styles.toolsModalOverlay.className}>
      <div className={styles.toolsModalContent.className}>
        <h3 className="text-xl font-bold mb-3 text-text-primary">{t('tools.required')}</h3>
        <p className="text-text-secondary mb-6 leading-relaxed">{t('tools.description')}</p>
        {downloadingTools ? (
          <div>
            <p className="text-sm text-text-secondary mb-3">
              {t('tools.downloading', { progress: toolsDownloadProgress })}
            </p>
            <div className={styles.progressBar.className}>
              <div
                className="bg-primary-500 h-full transition-all duration-300 relative overflow-hidden"
                style={getProgressBarFillStyle(toolsDownloadProgress)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-progress"></div>
              </div>
            </div>
          </div>
        ) : (
          <button className={styles.downloadButton.className} onClick={downloadTools}>
            {t('tools.downloadTools')}
          </button>
        )}
      </div>
    </div>
  )
}
