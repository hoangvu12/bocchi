import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSetAtom } from 'jotai'
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
import {
  leagueClientEnabledAtom,
  championDetectionEnabledAtom,
  smartApplyEnabledAtom,
  autoApplyEnabledAtom
} from '../store/atoms/settings.atoms'
import { autoViewSkinsEnabledAtom, autoRandomRaritySkinEnabledAtom } from '../store/atoms/lcu.atoms'

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
  const [autoViewSkinsEnabled, setAutoViewSkinsEnabled] = useState(false)
  const [smartApplyEnabled, setSmartApplyEnabled] = useState(true)
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(true)
  const [autoRandomSkinEnabled, setAutoRandomSkinEnabled] = useState(false)
  const [autoRandomRaritySkinEnabled, setAutoRandomRaritySkinEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  // Atom setters for immediate updates
  const setLeagueClientEnabledAtom = useSetAtom(leagueClientEnabledAtom)
  const setChampionDetectionEnabledAtom = useSetAtom(championDetectionEnabledAtom)
  const setAutoViewSkinsEnabledAtom = useSetAtom(autoViewSkinsEnabledAtom)
  const setAutoRandomRaritySkinEnabledAtom = useSetAtom(autoRandomRaritySkinEnabledAtom)
  const setSmartApplyEnabledAtom = useSetAtom(smartApplyEnabledAtom)
  const setAutoApplyEnabledAtom = useSetAtom(autoApplyEnabledAtom)

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  const loadSettings = async () => {
    try {
      const settings = await window.api.getSettings()
      // Default to true if not set (except autoViewSkins which defaults to false)
      setLeagueClientEnabled(settings.leagueClientEnabled !== false)
      setChampionDetection(settings.championDetection !== false)
      setAutoViewSkinsEnabled(settings.autoViewSkinsEnabled === true)
      setSmartApplyEnabled(settings.smartApplyEnabled !== false)
      setAutoApplyEnabled(settings.autoApplyEnabled !== false)
      setAutoRandomSkinEnabled(settings.autoRandomSkinEnabled === true)
      setAutoRandomRaritySkinEnabled(settings.autoRandomRaritySkinEnabled === true)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLeagueClientChange = async (checked: boolean) => {
    setLeagueClientEnabled(checked)
    setLeagueClientEnabledAtom(checked) // Update atom immediately
    try {
      await window.api.setSettings('leagueClientEnabled', checked)

      // If disabling League Client, disable all sub-features
      if (!checked) {
        setChampionDetection(false)
        setAutoViewSkinsEnabled(false)
        setSmartApplyEnabled(false)
        setAutoApplyEnabled(false)
        setAutoRandomSkinEnabled(false)
        setAutoRandomRaritySkinEnabled(false)

        // Update atoms immediately
        setChampionDetectionEnabledAtom(false)
        setAutoViewSkinsEnabledAtom(false)
        setAutoRandomRaritySkinEnabledAtom(false)

        await window.api.setSettings('championDetection', false)
        await window.api.setSettings('autoViewSkinsEnabled', false)
        await window.api.setSettings('smartApplyEnabled', false)
        await window.api.setSettings('autoApplyEnabled', false)
        await window.api.setSettings('autoRandomSkinEnabled', false)
        await window.api.setSettings('autoRandomRaritySkinEnabled', false)

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
    setChampionDetectionEnabledAtom(checked) // Update atom immediately
    try {
      await window.api.setSettings('championDetection', checked)

      // If disabling champion detection, also disable dependent features
      if (!checked) {
        setAutoViewSkinsEnabled(false)
        setAutoRandomSkinEnabled(false)
        setAutoRandomRaritySkinEnabled(false)

        // Update atoms immediately
        setAutoViewSkinsEnabledAtom(false)
        setAutoRandomRaritySkinEnabledAtom(false)
        await window.api.setSettings('autoViewSkinsEnabled', false)
        await window.api.setSettings('autoRandomSkinEnabled', false)
        await window.api.setSettings('autoRandomRaritySkinEnabled', false)
      }

      // Notify the parent component
      onChampionDetectionChange?.(checked)
    } catch (error) {
      console.error('Failed to save champion detection setting:', error)
    }
  }

  const handleAutoViewSkinsChange = async (checked: boolean) => {
    setAutoViewSkinsEnabled(checked)
    setAutoViewSkinsEnabledAtom(checked) // Update atom immediately
    try {
      await window.api.setSettings('autoViewSkinsEnabled', checked)
    } catch (error) {
      console.error('Failed to save auto view skins setting:', error)
    }
  }

  const handleSmartApplyChange = async (checked: boolean) => {
    setSmartApplyEnabled(checked)
    setSmartApplyEnabledAtom(checked) // Update atom immediately
    try {
      await window.api.setSettings('smartApplyEnabled', checked)

      // If disabling smart apply, also disable auto apply
      if (!checked && autoApplyEnabled) {
        setAutoApplyEnabled(false)
        setAutoApplyEnabledAtom(false)
        await window.api.setSettings('autoApplyEnabled', false)
      }
    } catch (error) {
      console.error('Failed to save smart apply setting:', error)
    }
  }

  const handleAutoApplyChange = async (checked: boolean) => {
    setAutoApplyEnabled(checked)
    setAutoApplyEnabledAtom(checked) // Update atom immediately
    try {
      await window.api.setSettings('autoApplyEnabled', checked)
    } catch (error) {
      console.error('Failed to save auto apply setting:', error)
    }
  }

  const handleAutoRandomSkinChange = async (checked: boolean) => {
    setAutoRandomSkinEnabled(checked)
    try {
      await window.api.setSettings('autoRandomSkinEnabled', checked)

      // If enabling this, disable the rarity option
      if (checked) {
        setAutoRandomRaritySkinEnabled(false)
        await window.api.setSettings('autoRandomRaritySkinEnabled', false)
      }
    } catch (error) {
      console.error('Failed to save auto random skin setting:', error)
    }
  }

  const handleAutoRandomRaritySkinChange = async (checked: boolean) => {
    setAutoRandomRaritySkinEnabled(checked)
    setAutoRandomRaritySkinEnabledAtom(checked) // Update atom immediately
    try {
      await window.api.setSettings('autoRandomRaritySkinEnabled', checked)

      // If enabling this, disable the regular random option
      if (checked) {
        setAutoRandomSkinEnabled(false)
        await window.api.setSettings('autoRandomSkinEnabled', false)
      }
    } catch (error) {
      console.error('Failed to save auto random rarity skin setting:', error)
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
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-start gap-3">
              <div className="flex items-start mt-1">
                <div className="w-4 h-4 border-l-2 border-b-2 border-text-secondary/30"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-text-primary">
                  {t('settings.championDetection.title')}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.championDetection.description')}
                </p>
              </div>
            </div>
            <Switch
              checked={championDetection}
              onCheckedChange={handleChampionDetectionChange}
              disabled={loading || !leagueClientEnabled}
            />
          </div>

          {/* Auto View Skins Setting */}
          <div className="flex items-center justify-between space-x-4 pl-6">
            <div className="flex items-start gap-3">
              <div className="flex items-start mt-1">
                <div className="w-4 h-4 border-l-2 border-b-2 border-text-secondary/30"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-text-primary">
                  {t('settings.autoViewSkins.title')}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.autoViewSkins.description')}
                </p>
              </div>
            </div>
            <Switch
              checked={autoViewSkinsEnabled}
              onCheckedChange={handleAutoViewSkinsChange}
              disabled={loading || !leagueClientEnabled || !championDetection}
            />
          </div>

          {/* Auto Random Skin Setting */}
          <div className="flex items-center justify-between space-x-4 pl-12">
            <div className="flex items-start gap-3">
              <div className="flex items-start mt-1">
                <div className="w-4 h-4 border-l-2 border-b-2 border-text-secondary/30"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-text-primary">
                  {t('settings.autoRandomSkin.title')}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.autoRandomSkin.description')}
                </p>
              </div>
            </div>
            <Switch
              checked={autoRandomSkinEnabled}
              onCheckedChange={handleAutoRandomSkinChange}
              disabled={loading || !leagueClientEnabled || !championDetection}
            />
          </div>

          {/* Auto Random Rarity Skin Setting */}
          <div className="flex items-center justify-between space-x-4 pl-12">
            <div className="flex items-start gap-3">
              <div className="flex items-start mt-1">
                <div className="w-4 h-4 border-l-2 border-b-2 border-text-secondary/30"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-text-primary">
                  {t('settings.autoRandomRaritySkin.title')}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.autoRandomRaritySkin.description')}
                </p>
              </div>
            </div>
            <Switch
              checked={autoRandomRaritySkinEnabled}
              onCheckedChange={handleAutoRandomRaritySkinChange}
              disabled={loading || !leagueClientEnabled || !championDetection}
            />
          </div>

          {/* Smart Apply Setting */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-start gap-3">
              <div className="flex items-start mt-1">
                <div className="w-4 h-4 border-l-2 border-b-2 border-text-secondary/30"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-text-primary">
                  {t('settings.smartApply.title')}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.smartApply.description')}
                </p>
              </div>
            </div>
            <Switch
              checked={smartApplyEnabled}
              onCheckedChange={handleSmartApplyChange}
              disabled={loading || !leagueClientEnabled}
            />
          </div>

          {/* Auto Apply Setting */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-start gap-3">
              <div className="flex items-start mt-1">
                <div className="w-4 h-4 border-l-2 border-b-2 border-text-secondary/30"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-text-primary">
                  {t('settings.autoApply.title')}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.autoApply.description')}
                </p>
              </div>
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
