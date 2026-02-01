import { useAtom, useSetAtom } from 'jotai'
import { ChevronDown, Gamepad2, Package, Settings, Monitor, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { showUpdateDialogAtom, appVersionAtom } from '../store/atoms/game.atoms'
import { isCheckingForUpdatesAtom } from '../store/atoms/ui.atoms'
import { Button } from './ui/button'
import {
  autoAcceptEnabledAtom,
  autoRandomFavoriteSkinEnabledAtom,
  autoRandomRaritySkinEnabledAtom,
  autoRandomHighestWinRateSkinEnabledAtom,
  autoRandomHighestPickRateSkinEnabledAtom,
  autoRandomMostPlayedSkinEnabledAtom,
  autoViewSkinsEnabledAtom
} from '../store/atoms/lcu.atoms'
import {
  autoApplyEnabledAtom,
  autoApplyTriggerTimeAtom,
  championDetectionEnabledAtom,
  leagueClientEnabledAtom,
  smartApplyEnabledAtom
} from '../store/atoms/settings.atoms'
import { AutoBanPickSettings } from './AutoBanPickSettings'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import { Label } from './ui/label'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

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
  const appVersion = useAtom(appVersionAtom)[0]
  const setShowUpdateDialog = useSetAtom(showUpdateDialogAtom)
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useAtom(isCheckingForUpdatesAtom)
  const [leagueClientEnabled, setLeagueClientEnabled] = useState(true)
  const [championDetection, setChampionDetection] = useState(true)
  const [autoViewSkinsEnabled, setAutoViewSkinsEnabled] = useState(false)
  const [smartApplyEnabled, setSmartApplyEnabled] = useState(true)
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(true)
  const [autoApplyTriggerTime, setAutoApplyTriggerTime] = useState(15)
  const [autoRandomSkinEnabled, setAutoRandomSkinEnabled] = useState(false)
  const [autoRandomRaritySkinEnabled, setAutoRandomRaritySkinEnabled] = useState(false)
  const [autoRandomFavoriteSkinEnabled, setAutoRandomFavoriteSkinEnabled] = useState(false)
  const [autoRandomHighestWinRateSkinEnabled, setAutoRandomHighestWinRateSkinEnabled] =
    useState(false)
  const [autoRandomHighestPickRateSkinEnabled, setAutoRandomHighestPickRateSkinEnabled] =
    useState(false)
  const [autoRandomMostPlayedSkinEnabled, setAutoRandomMostPlayedSkinEnabled] = useState(false)
  const [allowMultipleSkinsPerChampion, setAllowMultipleSkinsPerChampion] = useState(false)
  const [inGameOverlayEnabled, setInGameOverlayEnabled] = useState(false)
  const [autoAcceptEnabled, setAutoAcceptEnabled] = useState(false)
  const [autoFixModIssues, setAutoFixModIssues] = useState(false)
  const [minimizeToTray, setMinimizeToTray] = useState(false)
  const [autoExtractImages, setAutoExtractImages] = useState(false)
  const [modToolsTimeout, setModToolsTimeout] = useState(300) // Default 300 seconds
  const [loading, setLoading] = useState(true)
  const [cacheInfo, setCacheInfo] = useState<{
    exists: boolean
    modCount: number
    sizeInMB: number
  } | null>(null)
  const [isClearingCache, setIsClearingCache] = useState(false)

  // Atom setters for immediate updates
  const setLeagueClientEnabledAtom = useSetAtom(leagueClientEnabledAtom)
  const setChampionDetectionEnabledAtom = useSetAtom(championDetectionEnabledAtom)
  const setAutoViewSkinsEnabledAtom = useSetAtom(autoViewSkinsEnabledAtom)
  const setAutoRandomRaritySkinEnabledAtom = useSetAtom(autoRandomRaritySkinEnabledAtom)
  const setAutoRandomFavoriteSkinEnabledAtom = useSetAtom(autoRandomFavoriteSkinEnabledAtom)
  const setAutoRandomHighestWinRateSkinEnabledAtom = useSetAtom(
    autoRandomHighestWinRateSkinEnabledAtom
  )
  const setAutoRandomHighestPickRateSkinEnabledAtom = useSetAtom(
    autoRandomHighestPickRateSkinEnabledAtom
  )
  const setAutoRandomMostPlayedSkinEnabledAtom = useSetAtom(autoRandomMostPlayedSkinEnabledAtom)
  const setSmartApplyEnabledAtom = useSetAtom(smartApplyEnabledAtom)
  const setAutoApplyEnabledAtom = useSetAtom(autoApplyEnabledAtom)
  const setAutoApplyTriggerTimeAtom = useSetAtom(autoApplyTriggerTimeAtom)
  const setAutoAcceptEnabledAtom = useSetAtom(autoAcceptEnabledAtom)

  useEffect(() => {
    if (isOpen) {
      loadSettings()
      loadCacheInfo()
    }
  }, [isOpen])

  // Listen for settings changes from tray menu
  useEffect(() => {
    const handleSettingsChanged = (key: string, value: any) => {
      switch (key) {
        case 'leagueClientEnabled':
          setLeagueClientEnabled(value)
          setLeagueClientEnabledAtom(value)
          onLeagueClientChange?.(value)
          break
        case 'autoAcceptEnabled':
          setAutoAcceptEnabled(value)
          setAutoAcceptEnabledAtom(value)
          break
        case 'championDetection':
          setChampionDetection(value)
          setChampionDetectionEnabledAtom(value)
          onChampionDetectionChange?.(value)
          break
        case 'autoViewSkinsEnabled':
          setAutoViewSkinsEnabled(value)
          setAutoViewSkinsEnabledAtom(value)
          break
        case 'smartApplyEnabled':
          setSmartApplyEnabled(value)
          setSmartApplyEnabledAtom(value)
          break
        case 'autoApplyEnabled':
          setAutoApplyEnabled(value)
          setAutoApplyEnabledAtom(value)
          break
        case 'minimizeToTray':
          setMinimizeToTray(value)
          break
        case 'autoExtractImages':
          setAutoExtractImages(value)
          break
      }
    }

    const unsubscribe = window.api.onSettingsChanged(handleSettingsChanged)
    return () => unsubscribe()
  }, [
    setLeagueClientEnabledAtom,
    setChampionDetectionEnabledAtom,
    setAutoViewSkinsEnabledAtom,
    setAutoAcceptEnabledAtom,
    setSmartApplyEnabledAtom,
    setAutoApplyEnabledAtom,
    onLeagueClientChange,
    onChampionDetectionChange
  ])

  const loadSettings = async () => {
    try {
      const settingsData = await window.api.getSettings()
      // Cast to record type for safe property access
      const settings = settingsData as Record<string, unknown>
      // Default to true if not set (except autoViewSkins which defaults to false)
      setLeagueClientEnabled((settings.leagueClientEnabled as boolean | undefined) !== false)
      setChampionDetection((settings.championDetection as boolean | undefined) !== false)
      setAutoViewSkinsEnabled((settings.autoViewSkinsEnabled as boolean | undefined) === true)
      setSmartApplyEnabled((settings.smartApplyEnabled as boolean | undefined) !== false)
      setAutoApplyEnabled((settings.autoApplyEnabled as boolean | undefined) !== false)
      setAutoApplyTriggerTime((settings.autoApplyTriggerTime as number | undefined) || 15)
      setAutoRandomSkinEnabled((settings.autoRandomSkinEnabled as boolean | undefined) === true)
      setAutoRandomRaritySkinEnabled(
        (settings.autoRandomRaritySkinEnabled as boolean | undefined) === true
      )
      setAutoRandomFavoriteSkinEnabled(
        (settings.autoRandomFavoriteSkinEnabled as boolean | undefined) === true
      )
      setAutoRandomHighestWinRateSkinEnabled(
        (settings.autoRandomHighestWinRateSkinEnabled as boolean | undefined) === true
      )
      setAutoRandomHighestPickRateSkinEnabled(
        (settings.autoRandomHighestPickRateSkinEnabled as boolean | undefined) === true
      )
      setAutoRandomMostPlayedSkinEnabled(
        (settings.autoRandomMostPlayedSkinEnabled as boolean | undefined) === true
      )
      setAllowMultipleSkinsPerChampion(
        (settings.allowMultipleSkinsPerChampion as boolean | undefined) === true
      )
      setInGameOverlayEnabled((settings.inGameOverlayEnabled as boolean | undefined) === true)
      setAutoAcceptEnabled((settings.autoAcceptEnabled as boolean | undefined) === true)
      setAutoFixModIssues((settings.autoFixModIssues as boolean | undefined) === true)
      setMinimizeToTray((settings.minimizeToTray as boolean | undefined) === true)
      setAutoExtractImages((settings.autoExtractImages as boolean | undefined) === true)
      setModToolsTimeout((settings.modToolsTimeout as number | undefined) || 300) // Default 300 seconds
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
        setAutoRandomFavoriteSkinEnabled(false)
        setAutoRandomHighestWinRateSkinEnabled(false)
        setAutoRandomHighestPickRateSkinEnabled(false)
        setAutoRandomMostPlayedSkinEnabled(false)
        setInGameOverlayEnabled(false)
        setAutoAcceptEnabled(false)

        // Update atoms immediately
        setChampionDetectionEnabledAtom(false)
        setAutoViewSkinsEnabledAtom(false)
        setAutoRandomRaritySkinEnabledAtom(false)
        setAutoRandomFavoriteSkinEnabledAtom(false)
        setAutoRandomHighestWinRateSkinEnabledAtom(false)
        setAutoRandomHighestPickRateSkinEnabledAtom(false)
        setAutoRandomMostPlayedSkinEnabledAtom(false)
        setAutoAcceptEnabledAtom(false)

        await window.api.setSettings('championDetection', false)
        await window.api.setSettings('autoViewSkinsEnabled', false)
        await window.api.setSettings('smartApplyEnabled', false)
        await window.api.setSettings('autoApplyEnabled', false)
        await window.api.setSettings('autoRandomSkinEnabled', false)
        await window.api.setSettings('autoRandomRaritySkinEnabled', false)
        await window.api.setSettings('autoRandomFavoriteSkinEnabled', false)
        await window.api.setSettings('autoRandomHighestWinRateSkinEnabled', false)
        await window.api.setSettings('autoRandomHighestPickRateSkinEnabled', false)
        await window.api.setSettings('autoRandomMostPlayedSkinEnabled', false)
        await window.api.setSettings('inGameOverlayEnabled', false)
        await window.api.setSettings('autoAcceptEnabled', false)

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
        setAutoRandomFavoriteSkinEnabled(false)
        setInGameOverlayEnabled(false)

        // Update atoms immediately
        setAutoViewSkinsEnabledAtom(false)
        setAutoRandomRaritySkinEnabledAtom(false)
        setAutoRandomFavoriteSkinEnabledAtom(false)
        await window.api.setSettings('autoViewSkinsEnabled', false)
        await window.api.setSettings('autoRandomSkinEnabled', false)
        await window.api.setSettings('autoRandomRaritySkinEnabled', false)
        await window.api.setSettings('autoRandomFavoriteSkinEnabled', false)
        await window.api.setSettings('inGameOverlayEnabled', false)

        // Destroy overlay if it exists
        await window.api.destroyOverlay()
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

  const handleAutoApplyTriggerTimeChange = async (value: number[]) => {
    const time = value[0]
    setAutoApplyTriggerTime(time)
    setAutoApplyTriggerTimeAtom(time)
    try {
      await window.api.setSettings('autoApplyTriggerTime', time)
    } catch (error) {
      console.error('Failed to save auto apply trigger time setting:', error)
    }
  }

  const handleAllowMultipleSkinsPerChampionChange = async (checked: boolean) => {
    setAllowMultipleSkinsPerChampion(checked)
    try {
      await window.api.setSettings('allowMultipleSkinsPerChampion', checked)
    } catch (error) {
      console.error('Failed to save allow multiple skins per champion setting:', error)
    }
  }

  const handleInGameOverlayChange = async (checked: boolean) => {
    setInGameOverlayEnabled(checked)
    try {
      await window.api.setSettings('inGameOverlayEnabled', checked)

      // If enabling, create and attach overlay immediately
      if (checked) {
        await window.api.createOverlay()
      } else {
        // If disabling, destroy overlay
        await window.api.destroyOverlay()
      }
    } catch (error) {
      console.error('Failed to save in-game overlay setting:', error)
    }
  }

  const handleAutoAcceptChange = async (checked: boolean) => {
    setAutoAcceptEnabled(checked)
    setAutoAcceptEnabledAtom(checked) // Update atom immediately
    try {
      await window.api.setSettings('autoAcceptEnabled', checked)
    } catch (error) {
      console.error('Failed to save auto accept setting:', error)
    }
  }

  // Determine which random skin option is selected
  const getRandomSkinValue = () => {
    if (autoRandomFavoriteSkinEnabled) return 'favorite'
    if (autoRandomRaritySkinEnabled) return 'rarity'
    if (autoRandomHighestWinRateSkinEnabled) return 'winrate'
    if (autoRandomHighestPickRateSkinEnabled) return 'pickrate'
    if (autoRandomMostPlayedSkinEnabled) return 'mostplayed'
    if (autoRandomSkinEnabled) return 'random'
    return 'none'
  }

  const handleRandomSkinChange = async (value: string) => {
    // First, disable all options
    setAutoRandomSkinEnabled(false)
    setAutoRandomRaritySkinEnabled(false)
    setAutoRandomFavoriteSkinEnabled(false)
    setAutoRandomHighestWinRateSkinEnabled(false)
    setAutoRandomHighestPickRateSkinEnabled(false)
    setAutoRandomMostPlayedSkinEnabled(false)
    setAutoRandomRaritySkinEnabledAtom(false)
    setAutoRandomFavoriteSkinEnabledAtom(false)
    setAutoRandomHighestWinRateSkinEnabledAtom(false)
    setAutoRandomHighestPickRateSkinEnabledAtom(false)
    setAutoRandomMostPlayedSkinEnabledAtom(false)

    await window.api.setSettings('autoRandomSkinEnabled', false)
    await window.api.setSettings('autoRandomRaritySkinEnabled', false)
    await window.api.setSettings('autoRandomFavoriteSkinEnabled', false)
    await window.api.setSettings('autoRandomHighestWinRateSkinEnabled', false)
    await window.api.setSettings('autoRandomHighestPickRateSkinEnabled', false)
    await window.api.setSettings('autoRandomMostPlayedSkinEnabled', false)

    // Then enable the selected option
    switch (value) {
      case 'random':
        setAutoRandomSkinEnabled(true)
        await window.api.setSettings('autoRandomSkinEnabled', true)
        break
      case 'rarity':
        setAutoRandomRaritySkinEnabled(true)
        setAutoRandomRaritySkinEnabledAtom(true)
        await window.api.setSettings('autoRandomRaritySkinEnabled', true)
        break
      case 'favorite':
        setAutoRandomFavoriteSkinEnabled(true)
        setAutoRandomFavoriteSkinEnabledAtom(true)
        await window.api.setSettings('autoRandomFavoriteSkinEnabled', true)
        break
      case 'winrate':
        setAutoRandomHighestWinRateSkinEnabled(true)
        setAutoRandomHighestWinRateSkinEnabledAtom(true)
        await window.api.setSettings('autoRandomHighestWinRateSkinEnabled', true)
        break
      case 'pickrate':
        setAutoRandomHighestPickRateSkinEnabled(true)
        setAutoRandomHighestPickRateSkinEnabledAtom(true)
        await window.api.setSettings('autoRandomHighestPickRateSkinEnabled', true)
        break
      case 'mostplayed':
        setAutoRandomMostPlayedSkinEnabled(true)
        setAutoRandomMostPlayedSkinEnabledAtom(true)
        await window.api.setSettings('autoRandomMostPlayedSkinEnabled', true)
        break
      case 'none':
        // Check if we should disable the overlay
        setInGameOverlayEnabled(false)
        await window.api.setSettings('inGameOverlayEnabled', false)
        await window.api.destroyOverlay()
        break
    }
  }

  const handleAutoFixModIssuesChange = async (checked: boolean) => {
    setAutoFixModIssues(checked)
    try {
      await window.api.setSettings('autoFixModIssues', checked)
    } catch (error) {
      console.error('Failed to save auto fix mod issues setting:', error)
    }
  }

  const handleMinimizeToTrayChange = async (checked: boolean) => {
    setMinimizeToTray(checked)
    try {
      await window.api.setSettings('minimizeToTray', checked)
    } catch (error) {
      console.error('Failed to save minimize to tray setting:', error)
    }
  }

  const handleAutoExtractImagesChange = async (checked: boolean) => {
    setAutoExtractImages(checked)
    try {
      await window.api.setSettings('autoExtractImages', checked)
    } catch (error) {
      console.error('Failed to save auto extract images setting:', error)
    }
  }

  const handleCheckForUpdates = useCallback(async () => {
    setIsCheckingForUpdates(true)
    try {
      const result = await window.api.checkForUpdates()
      if (result.success && result.updateInfo) {
        // Update is available, dialog will be shown automatically by the event listener
        setShowUpdateDialog(true)
        onClose() // Close settings dialog to show update dialog
      } else {
        // No update available
        toast.success(t('update.noUpdates', `You're on the latest version (v${appVersion})!`))
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
      toast.error(t('update.error', 'Failed to check for updates'))
    } finally {
      setIsCheckingForUpdates(false)
    }
  }, [appVersion, t, setIsCheckingForUpdates, setShowUpdateDialog, onClose])

  const handleModToolsTimeoutChange = async (value: number[]) => {
    const timeout = value[0]
    setModToolsTimeout(timeout)
    try {
      await window.api.setSettings('modToolsTimeout', timeout)
    } catch (error) {
      console.error('Failed to save mod tools timeout setting:', error)
    }
  }

  const loadCacheInfo = async () => {
    try {
      const result = await window.api.getCacheInfo()
      if (result.success && result.data) {
        setCacheInfo(result.data)
      }
    } catch (error) {
      console.error('Failed to load cache info:', error)
    }
  }

  const handleClearCache = async () => {
    if (!confirm(t('settings.cacheManagement.confirmClear'))) {
      return
    }

    setIsClearingCache(true)
    try {
      const result = await window.api.clearAllSkinsCache()
      if (result.success) {
        toast.success(t('settings.cacheManagement.clearSuccess'))
        // Reload cache info
        await loadCacheInfo()
      } else {
        toast.error(t('settings.cacheManagement.clearError'))
      }
    } catch (error) {
      console.error('Failed to clear cache:', error)
      toast.error(t('settings.cacheManagement.clearError'))
    } finally {
      setIsClearingCache(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {t('settings.title')}
          </DialogTitle>
          <DialogDescription>{t('settings.description')}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              {t('settings.tabs.general')}
            </TabsTrigger>
            <TabsTrigger value="league-client" className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4" />
              {t('settings.tabs.leagueClient')}
            </TabsTrigger>
            <TabsTrigger value="skin-management" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              {t('settings.tabs.skinManagement')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-6">
            {/* Application Update */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-text-primary">
                  {t('settings.applicationUpdate.title', 'Application Updates')}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.applicationUpdate.description', { version: `v${appVersion}` })}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCheckForUpdates}
                disabled={isCheckingForUpdates || loading}
                className="flex items-center gap-2"
              >
                {isCheckingForUpdates ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {t('update.checkForUpdates')}
              </Button>
            </div>

            {/* Minimize to Tray Setting */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-text-primary">
                  {t('settings.minimizeToTray.title')}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.minimizeToTray.description')}
                </p>
              </div>
              <Switch
                checked={minimizeToTray}
                onCheckedChange={handleMinimizeToTrayChange}
                disabled={loading}
              />
            </div>
          </TabsContent>

          <TabsContent value="league-client" className="space-y-6 mt-6">
            {/* League Client Master Toggle */}
            <div className="flex items-center justify-between space-x-4 p-4 rounded-lg bg-surface/50 border border-border">
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

            {leagueClientEnabled && (
              <>
                {/* Auto Ban/Pick Settings */}
                <AutoBanPickSettings disabled={loading} />

                {/* Auto Accept Setting */}
                <div className="flex items-center justify-between space-x-4">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-text-primary">
                      {t('settings.autoAccept.title')}
                    </h3>
                    <p className="text-xs text-text-secondary mt-1">
                      {t('settings.autoAccept.description')}
                    </p>
                  </div>
                  <Switch
                    checked={autoAcceptEnabled}
                    onCheckedChange={handleAutoAcceptChange}
                    disabled={loading}
                  />
                </div>

                {/* Champion Selection Accordion */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="champion-selection" className="border-0">
                    <AccordionTrigger className="hover:no-underline py-0 px-0 [&>svg]:hidden group">
                      <div className="flex items-center justify-between w-full">
                        <div className="text-left">
                          <h3 className="text-sm font-medium text-text-primary">
                            {t('settings.championDetection.title')}
                          </h3>
                          <p className="text-xs text-text-secondary mt-1">
                            {t('settings.championDetection.description')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          <Switch
                            checked={championDetection}
                            onCheckedChange={handleChampionDetectionChange}
                            disabled={loading}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4">
                      <div className="space-y-4 p-4 rounded-lg border border-border bg-surface/30">
                        {/* Auto View Skins Setting */}
                        <div className="flex items-center justify-between space-x-4">
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-text-primary">
                              {t('settings.autoViewSkins.title')}
                            </h3>
                            <p className="text-xs text-text-secondary mt-1">
                              {t('settings.autoViewSkins.description')}
                            </p>
                          </div>
                          <Switch
                            checked={autoViewSkinsEnabled}
                            onCheckedChange={handleAutoViewSkinsChange}
                            disabled={loading || !championDetection}
                          />
                        </div>

                        {/* Random Skin Selection */}
                        <div className="space-y-3">
                          <h3 className="text-sm font-medium text-text-primary">
                            {t('settings.randomSkinSelection.title')}
                          </h3>
                          <RadioGroup
                            value={getRandomSkinValue()}
                            onValueChange={handleRandomSkinChange}
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="none"
                                id="none"
                                disabled={loading || !championDetection}
                              />
                              <Label htmlFor="none" className="text-sm font-normal cursor-pointer">
                                {t('settings.randomSkinSelection.none')}
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="random"
                                id="random"
                                disabled={loading || !championDetection}
                              />
                              <Label
                                htmlFor="random"
                                className="text-sm font-normal cursor-pointer"
                              >
                                <div>
                                  <div>{t('settings.autoRandomSkin.title')}</div>
                                  <div className="text-xs text-text-secondary">
                                    {t('settings.autoRandomSkin.description')}
                                  </div>
                                </div>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="rarity"
                                id="rarity"
                                disabled={loading || !championDetection}
                              />
                              <Label
                                htmlFor="rarity"
                                className="text-sm font-normal cursor-pointer"
                              >
                                <div>
                                  <div>{t('settings.autoRandomRaritySkin.title')}</div>
                                  <div className="text-xs text-text-secondary">
                                    {t('settings.autoRandomRaritySkin.description')}
                                  </div>
                                </div>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="favorite"
                                id="favorite"
                                disabled={loading || !championDetection}
                              />
                              <Label
                                htmlFor="favorite"
                                className="text-sm font-normal cursor-pointer"
                              >
                                <div>
                                  <div>{t('settings.autoRandomFavoriteSkin.title')}</div>
                                  <div className="text-xs text-text-secondary">
                                    {t('settings.autoRandomFavoriteSkin.description')}
                                  </div>
                                </div>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2 opacity-50">
                              <RadioGroupItem value="winrate" id="winrate" disabled={true} />
                              <Label
                                htmlFor="winrate"
                                className="text-sm font-normal cursor-pointer"
                              >
                                <div>
                                  <div>{t('settings.autoRandomHighestWinRateSkin.title')}</div>
                                  <div className="text-xs text-text-secondary">
                                    {t('settings.autoRandomHighestWinRateSkin.description')}{' '}
                                    (Currently unavailable)
                                  </div>
                                </div>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2 opacity-50">
                              <RadioGroupItem value="pickrate" id="pickrate" disabled={true} />
                              <Label
                                htmlFor="pickrate"
                                className="text-sm font-normal cursor-pointer"
                              >
                                <div>
                                  <div>{t('settings.autoRandomHighestPickRateSkin.title')}</div>
                                  <div className="text-xs text-text-secondary">
                                    {t('settings.autoRandomHighestPickRateSkin.description')}{' '}
                                    (Currently unavailable)
                                  </div>
                                </div>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2 opacity-50">
                              <RadioGroupItem value="mostplayed" id="mostplayed" disabled={true} />
                              <Label
                                htmlFor="mostplayed"
                                className="text-sm font-normal cursor-pointer"
                              >
                                <div>
                                  <div>{t('settings.autoRandomMostPlayedSkin.title')}</div>
                                  <div className="text-xs text-text-secondary">
                                    {t('settings.autoRandomMostPlayedSkin.description')} (Currently
                                    unavailable)
                                  </div>
                                </div>
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        {/* In-Game Overlay Setting */}
                        {getRandomSkinValue() !== 'none' && (
                          <div className="flex items-center justify-between space-x-4">
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-text-primary">
                                {t('settings.inGameOverlay.title')}
                              </h3>
                              <p className="text-xs text-text-secondary mt-1">
                                {t('settings.inGameOverlay.description')}
                              </p>
                            </div>
                            <Switch
                              checked={inGameOverlayEnabled}
                              onCheckedChange={handleInGameOverlayChange}
                              disabled={loading}
                            />
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Smart Apply Setting */}
                <div className="flex items-center justify-between space-x-4">
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
                    disabled={loading}
                  />
                </div>

                {/* Auto Apply Setting */}
                <div className="flex items-center justify-between space-x-4">
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
                    disabled={loading || !smartApplyEnabled}
                  />
                </div>

                {/* Auto Apply Trigger Time Setting */}
                {autoApplyEnabled && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-text-primary">
                          {t('settings.autoApplyTriggerTime.title')}
                        </h3>
                        <p className="text-xs text-text-secondary mt-1">
                          {t('settings.autoApplyTriggerTime.description')}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-text-primary min-w-[3rem] text-right">
                        {autoApplyTriggerTime}s
                      </span>
                    </div>
                    <Slider
                      value={[autoApplyTriggerTime]}
                      onValueChange={handleAutoApplyTriggerTimeChange}
                      min={5}
                      max={30}
                      step={1}
                      disabled={loading || !smartApplyEnabled || !autoApplyEnabled}
                      className="w-full"
                    />
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="skin-management" className="space-y-6 mt-6">
            {/* Auto Extract Images Setting */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-text-primary">
                  {t('settings.autoExtractImages.title')}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.autoExtractImages.description')}
                </p>
              </div>
              <Switch
                checked={autoExtractImages}
                onCheckedChange={handleAutoExtractImagesChange}
                disabled={loading}
              />
            </div>

            {/* Allow Multiple Skins Per Champion Setting */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-text-primary">
                  {t('settings.allowMultipleSkinsPerChampion.title')}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.allowMultipleSkinsPerChampion.description')}
                </p>
              </div>
              <Switch
                checked={allowMultipleSkinsPerChampion}
                onCheckedChange={handleAllowMultipleSkinsPerChampionChange}
                disabled={loading}
              />
            </div>

            {/* Auto Fix Mod Issues Setting */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-text-primary">
                  {t('settings.autoFixModIssues.title')}
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.autoFixModIssues.description')}
                </p>
              </div>
              <Switch
                checked={autoFixModIssues}
                onCheckedChange={handleAutoFixModIssuesChange}
                disabled={loading}
              />
            </div>

            {/* Mod Tools Timeout Setting */}
            <div className="space-y-4">
              <div className="flex items-center justify-between space-x-4">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-text-primary">
                    {t('settings.modToolsTimeout.title')}
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">
                    {t('settings.modToolsTimeout.description')}
                  </p>
                </div>
                <span className="text-sm font-medium text-text-primary min-w-[3rem] text-right">
                  {modToolsTimeout}s
                </span>
              </div>
              <Slider
                value={[modToolsTimeout]}
                onValueChange={handleModToolsTimeoutChange}
                min={30}
                max={600}
                step={10}
                disabled={loading}
                className="w-full"
              />
              <p className="text-xs text-text-secondary">{t('settings.modToolsTimeout.hint')}</p>
            </div>

            {/* Cache Management */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between space-x-4">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-text-primary">
                    {t('settings.cacheManagement.title')}
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">
                    {t('settings.cacheManagement.description')}
                  </p>
                  {cacheInfo && cacheInfo.exists && (
                    <p className="text-xs text-text-muted mt-2">
                      {t('settings.cacheManagement.info', {
                        count: cacheInfo.modCount,
                        size: cacheInfo.sizeInMB
                      })}
                    </p>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearCache}
                  disabled={isClearingCache || loading || !cacheInfo?.exists}
                  className="flex items-center gap-2"
                >
                  {isClearingCache ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {t('settings.cacheManagement.clearing')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('settings.cacheManagement.clearCache')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <button
            className="px-4 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            onClick={onClose}
          >
            {t('actions.close')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
