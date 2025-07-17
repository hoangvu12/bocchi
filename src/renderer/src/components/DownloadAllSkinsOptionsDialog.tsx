import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { Separator } from './ui/separator'
import { Download, Info } from 'lucide-react'

interface DownloadOptions {
  excludeChromas: boolean
  excludeVariants: boolean
  excludeLegacy: boolean
  excludeEsports: boolean
  onlyFavorites: boolean
  concurrency: number
}

interface DownloadAllSkinsOptionsDialogProps {
  isOpen: boolean
  onClose: () => void
  onStartDownload: (options: DownloadOptions) => void
  totalSkinsCount: number
  estimatedSize: string
}

export const DownloadAllSkinsOptionsDialog: React.FC<DownloadAllSkinsOptionsDialogProps> = ({
  isOpen,
  onClose,
  onStartDownload,
  totalSkinsCount,
  estimatedSize
}) => {
  const { t } = useTranslation()

  const [options, setOptions] = useState<DownloadOptions>({
    excludeChromas: false,
    excludeVariants: false,
    excludeLegacy: false,
    excludeEsports: false,
    onlyFavorites: false,
    concurrency: 3
  })

  const updateOption = (key: keyof DownloadOptions, value: boolean | number) => {
    setOptions((prev) => ({ ...prev, [key]: value }))
  }

  const handleStartDownload = () => {
    onStartDownload(options)
    onClose()
  }

  const getFilteredCount = () => {
    let count = totalSkinsCount
    if (options.excludeChromas) count = Math.floor(count * 0.7) // Rough estimate
    if (options.excludeVariants) count = Math.floor(count * 0.9)
    if (options.excludeLegacy) count = Math.floor(count * 0.85)
    if (options.excludeEsports) count = Math.floor(count * 0.9)
    return count
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary-500" />
            {t('downloadAll.optionsTitle')}
          </DialogTitle>
          <DialogDescription>{t('downloadAll.optionsDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Alert */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {t('downloadAll.infoTitle')}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {t('downloadAll.infoDescription', {
                    count: getFilteredCount(),
                    size: estimatedSize
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Download Options */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-text-primary">
              {t('downloadAll.filterOptions')}
            </h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="exclude-chromas" className="text-sm font-medium">
                    {t('downloadAll.excludeChromas')}
                  </Label>
                  <p className="text-xs text-text-secondary">
                    {t('downloadAll.excludeChromasDesc')}
                  </p>
                </div>
                <Switch
                  id="exclude-chromas"
                  checked={options.excludeChromas}
                  onCheckedChange={(checked) => updateOption('excludeChromas', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="exclude-variants" className="text-sm font-medium">
                    {t('downloadAll.excludeVariants')}
                  </Label>
                  <p className="text-xs text-text-secondary">
                    {t('downloadAll.excludeVariantsDesc')}
                  </p>
                </div>
                <Switch
                  id="exclude-variants"
                  checked={options.excludeVariants}
                  onCheckedChange={(checked) => updateOption('excludeVariants', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="exclude-legacy" className="text-sm font-medium">
                    {t('downloadAll.excludeLegacy')}
                  </Label>
                  <p className="text-xs text-text-secondary">
                    {t('downloadAll.excludeLegacyDesc')}
                  </p>
                </div>
                <Switch
                  id="exclude-legacy"
                  checked={options.excludeLegacy}
                  onCheckedChange={(checked) => updateOption('excludeLegacy', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="exclude-esports" className="text-sm font-medium">
                    {t('downloadAll.excludeEsports')}
                  </Label>
                  <p className="text-xs text-text-secondary">
                    {t('downloadAll.excludeEsportsDesc')}
                  </p>
                </div>
                <Switch
                  id="exclude-esports"
                  checked={options.excludeEsports}
                  onCheckedChange={(checked) => updateOption('excludeEsports', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="only-favorites" className="text-sm font-medium">
                    {t('downloadAll.onlyFavorites')}
                  </Label>
                  <p className="text-xs text-text-secondary">
                    {t('downloadAll.onlyFavoritesDesc')}
                  </p>
                </div>
                <Switch
                  id="only-favorites"
                  checked={options.onlyFavorites}
                  onCheckedChange={(checked) => updateOption('onlyFavorites', checked)}
                />
              </div>
            </div>
          </div>

          {/* Performance Options */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-text-primary">
              {t('downloadAll.performanceOptions')}
            </h4>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('downloadAll.concurrency')}: {options.concurrency}
              </Label>
              <div className="flex gap-2">
                {[1, 2, 3, 5, 8].map((num) => (
                  <button
                    key={num}
                    onClick={() => updateOption('concurrency', num)}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      options.concurrency === num
                        ? 'bg-primary-500 text-white'
                        : 'bg-secondary-100 dark:bg-secondary-800 text-text-secondary hover:bg-secondary-200 dark:hover:bg-secondary-700'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-secondary">{t('downloadAll.concurrencyDesc')}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button onClick={onClose} variant="outline" className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleStartDownload} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              {t('downloadAll.startDownload')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
