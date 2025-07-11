import { useSetAtom } from 'jotai'
import { ChevronDown, Gamepad2, Package, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  autoAcceptEnabledAtom,
  autoRandomFavoriteSkinEnabledAtom,
  autoRandomRaritySkinEnabledAtom,
  autoViewSkinsEnabledAtom
} from '../store/atoms/lcu.atoms'
import {
  autoApplyEnabledAtom,
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
  const [leagueClientEnabled, setLeagueClientEnabled] = useState(true)
  const [championDetection, setChampionDetection] = useState(true)
  const [autoViewSkinsEnabled, setAutoViewSkinsEnabled] = useState(false)
  const [smartApplyEnabled, setSmartApplyEnabled] = useState(true)
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(true)
  const [autoRandomSkinEnabled, setAutoRandomSkinEnabled] = useState(false)
  const [autoRandomRaritySkinEnabled, setAutoRandomRaritySkinEnabled] = useState(false)
  const [autoRandomFavoriteSkinEnabled, setAutoRandomFavoriteSkinEnabled] = useState(false)
  const [allowMultipleSkinsPerChampion, setAllowMultipleSkinsPerChampion] = useState(false)
  const [inGameOverlayEnabled, setInGameOverlayEnabled] = useState(false)
  const [autoAcceptEnabled, setAutoAcceptEnabled] = useState(false)
  const [autoFixModIssues, setAutoFixModIssues] = useState(false)
  const [loading, setLoading] = useState(true)

  // Atom setters for immediate updates
  const setLeagueClientEnabledAtom = useSetAtom(leagueClientEnabledAtom)
  const setChampionDetectionEnabledAtom = useSetAtom(championDetectionEnabledAtom)
  const setAutoViewSkinsEnabledAtom = useSetAtom(autoViewSkinsEnabledAtom)
  const setAutoRandomRaritySkinEnabledAtom = useSetAtom(autoRandomRaritySkinEnabledAtom)
  const setAutoRandomFavoriteSkinEnabledAtom = useSetAtom(autoRandomFavoriteSkinEnabledAtom)
  const setSmartApplyEnabledAtom = useSetAtom(smartApplyEnabledAtom)
  const setAutoApplyEnabledAtom = useSetAtom(autoApplyEnabledAtom)
  const setAutoAcceptEnabledAtom = useSetAtom(autoAcceptEnabledAtom)

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
      setAutoRandomFavoriteSkinEnabled(settings.autoRandomFavoriteSkinEnabled === true)
      setAllowMultipleSkinsPerChampion(settings.allowMultipleSkinsPerChampion === true)
      setInGameOverlayEnabled(settings.inGameOverlayEnabled === true)
      setAutoAcceptEnabled(settings.autoAcceptEnabled === true)
      setAutoFixModIssues(settings.autoFixModIssues === true)
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
        setInGameOverlayEnabled(false)
        setAutoAcceptEnabled(false)

        // Update atoms immediately
        setChampionDetectionEnabledAtom(false)
        setAutoViewSkinsEnabledAtom(false)
        setAutoRandomRaritySkinEnabledAtom(false)
        setAutoRandomFavoriteSkinEnabledAtom(false)
        setAutoAcceptEnabledAtom(false)

        await window.api.setSettings('championDetection', false)
        await window.api.setSettings('autoViewSkinsEnabled', false)
        await window.api.setSettings('smartApplyEnabled', false)
        await window.api.setSettings('autoApplyEnabled', false)
        await window.api.setSettings('autoRandomSkinEnabled', false)
        await window.api.setSettings('autoRandomRaritySkinEnabled', false)
        await window.api.setSettings('autoRandomFavoriteSkinEnabled', false)
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
    if (autoRandomSkinEnabled) return 'random'
    return 'none'
  }

  const handleRandomSkinChange = async (value: string) => {
    // First, disable all options
    setAutoRandomSkinEnabled(false)
    setAutoRandomRaritySkinEnabled(false)
    setAutoRandomFavoriteSkinEnabled(false)
    setAutoRandomRaritySkinEnabledAtom(false)
    setAutoRandomFavoriteSkinEnabledAtom(false)

    await window.api.setSettings('autoRandomSkinEnabled', false)
    await window.api.setSettings('autoRandomRaritySkinEnabled', false)
    await window.api.setSettings('autoRandomFavoriteSkinEnabled', false)

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

        <Tabs defaultValue="league-client" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="league-client" className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4" />
              {t('settings.tabs.leagueClient')}
            </TabsTrigger>
            <TabsTrigger value="skin-management" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              {t('settings.tabs.skinManagement')}
            </TabsTrigger>
          </TabsList>

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
                    <AccordionContent className="space-y-4 pt-4">
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
                            <Label htmlFor="random" className="text-sm font-normal cursor-pointer">
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
                            <Label htmlFor="rarity" className="text-sm font-normal cursor-pointer">
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
              </>
            )}
          </TabsContent>

          <TabsContent value="skin-management" className="space-y-6 mt-6">
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
