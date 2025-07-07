import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  onLeagueClientChange?: (enabled: boolean) => void
  onChampionDetectionChange?: (enabled: boolean) => void
}

export function SettingsDialog({
  isOpen,
  onClose,
  onLeagueClientChange,
  onChampionDetectionChange
}: SettingsDialogProps) {
  const { t } = useTranslation()
  const [leagueClientEnabled, setLeagueClientEnabled] = useState(true)
  const [championDetection, setChampionDetection] = useState(true)
  const [smartApplyEnabled, setSmartApplyEnabled] = useState(true)
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  const loadSettings = async () => {
    try {
      const settings = await window.api.getSettings()
      // Default to true if not set
      setLeagueClientEnabled(settings.leagueClientEnabled !== false)
      setChampionDetection(settings.championDetection !== false)
      setSmartApplyEnabled(settings.smartApplyEnabled !== false)
      setAutoApplyEnabled(settings.autoApplyEnabled !== false)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLeagueClientChange = async (checked: boolean) => {
    setLeagueClientEnabled(checked)
    try {
      await window.api.setSettings('leagueClientEnabled', checked)

      // If disabling League Client, disable all sub-features
      if (!checked) {
        setChampionDetection(false)
        setSmartApplyEnabled(false)
        setAutoApplyEnabled(false)
        await window.api.setSettings('championDetection', false)
        await window.api.setSettings('smartApplyEnabled', false)
        await window.api.setSettings('autoApplyEnabled', false)

        // Disconnect LCU
        await window.api.lcuDisconnect()

        // Notify parent about changes
        onLeagueClientChange?.(false)
        onChampionDetectionChange?.(false)
      } else {
        // Reconnect LCU
        await window.api.lcuConnect()

        // Notify parent about change
        onLeagueClientChange?.(true)
      }
    } catch (error) {
      console.error('Failed to save League Client setting:', error)
    }
  }

  const handleChampionDetectionChange = async (checked: boolean) => {
    setChampionDetection(checked)
    try {
      await window.api.setSettings('championDetection', checked)

      // Notify the parent component
      onChampionDetectionChange?.(checked)
    } catch (error) {
      console.error('Failed to save champion detection setting:', error)
    }
  }

  const handleSmartApplyChange = async (checked: boolean) => {
    setSmartApplyEnabled(checked)
    try {
      await window.api.setSettings('smartApplyEnabled', checked)
    } catch (error) {
      console.error('Failed to save smart apply setting:', error)
    }
  }

  const handleAutoApplyChange = async (checked: boolean) => {
    setAutoApplyEnabled(checked)
    try {
      await window.api.setSettings('autoApplyEnabled', checked)
    } catch (error) {
      console.error('Failed to save auto apply setting:', error)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {t('settings.title')}
          </DialogTitle>
          <DialogDescription>{t('settings.description')}</DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* League Client Master Toggle */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-text-primary">
                {t('settings.leagueClient.title')}
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                {t('settings.leagueClient.description')}
              </p>
            </div>
            <Switch
              checked={leagueClientEnabled}
              onCheckedChange={handleLeagueClientChange}
              disabled={loading}
            />
          </div>

          {/* Champion Detection Setting */}
          <div className="flex items-center justify-between space-x-4 pl-6">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-text-primary">
                {t('settings.championDetection.title')}
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                {t('settings.championDetection.description')}
              </p>
            </div>
            <Switch
              checked={championDetection}
              onCheckedChange={handleChampionDetectionChange}
              disabled={loading || !leagueClientEnabled}
            />
          </div>

          {/* Smart Apply Setting */}
          <div className="flex items-center justify-between space-x-4 pl-6">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-text-primary">
                {t('settings.smartApply.title')}
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                {t('settings.smartApply.description')}
              </p>
            </div>
            <Switch
              checked={smartApplyEnabled}
              onCheckedChange={handleSmartApplyChange}
              disabled={loading || !leagueClientEnabled}
            />
          </div>

          {/* Auto Apply Setting */}
          <div className="flex items-center justify-between space-x-4 pl-6">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-text-primary">
                {t('settings.autoApply.title')}
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                {t('settings.autoApply.description')}
              </p>
            </div>
            <Switch
              checked={autoApplyEnabled}
              onCheckedChange={handleAutoApplyChange}
              disabled={loading || !leagueClientEnabled}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
