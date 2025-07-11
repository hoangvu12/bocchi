import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtom } from 'jotai'
import { Switch } from './ui/switch'
import { ChampionSelector } from './ChampionSelector'
import {
  autoPickEnabledAtom,
  autoPickForceAtom,
  autoPickChampionsAtom,
  autoBanEnabledAtom,
  autoBanForceAtom,
  autoBanChampionsAtom
} from '../store/atoms/lcu.atoms'

interface AutoBanPickSettingsProps {
  disabled?: boolean
}

export function AutoBanPickSettings({ disabled = false }: AutoBanPickSettingsProps) {
  const { t } = useTranslation()

  // Auto Pick atoms
  const [autoPickEnabled, setAutoPickEnabled] = useAtom(autoPickEnabledAtom)
  const [autoPickForce, setAutoPickForce] = useAtom(autoPickForceAtom)
  const [autoPickChampions, setAutoPickChampions] = useAtom(autoPickChampionsAtom)

  // Auto Ban atoms
  const [autoBanEnabled, setAutoBanEnabled] = useAtom(autoBanEnabledAtom)
  const [autoBanForce, setAutoBanForce] = useAtom(autoBanForceAtom)
  const [autoBanChampions, setAutoBanChampions] = useAtom(autoBanChampionsAtom)

  // Champion lists
  const [ownedChampions, setOwnedChampions] = useState<any[]>([])
  const [allChampions, setAllChampions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChampions()
  }, [])

  const loadChampions = async () => {
    try {
      // Load owned champions for pick selection
      const ownedResult = await window.api.lcuGetOwnedChampions()
      if (ownedResult.success && ownedResult.champions) {
        setOwnedChampions(
          ownedResult.champions.sort((a: any, b: any) => a.name.localeCompare(b.name))
        )
      }

      // Load all champions for ban selection
      const allResult = await window.api.lcuGetAllChampions()
      if (allResult.success && allResult.champions) {
        setAllChampions(allResult.champions.sort((a: any, b: any) => a.name.localeCompare(b.name)))
      }
    } catch (error) {
      console.error('Failed to load champions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAutoPickEnabledChange = async (checked: boolean) => {
    setAutoPickEnabled(checked)
    try {
      await window.api.setSettings('autoPickEnabled', checked)

      // If disabling, also disable force mode
      if (!checked) {
        setAutoPickForce(false)
        await window.api.setSettings('autoPickForce', false)
      }
    } catch (error) {
      console.error('Failed to save auto pick setting:', error)
    }
  }

  const handleAutoPickForceChange = async (checked: boolean) => {
    setAutoPickForce(checked)
    try {
      await window.api.setSettings('autoPickForce', checked)
    } catch (error) {
      console.error('Failed to save auto pick force setting:', error)
    }
  }

  const handleAutoPickChampionsChange = async (championIds: number[]) => {
    setAutoPickChampions(championIds)
    try {
      await window.api.setSettings('autoPickChampions', championIds)
      await window.api.setAutoPickChampions(championIds)
    } catch (error) {
      console.error('Failed to save auto pick champions:', error)
    }
  }

  const handleAutoBanEnabledChange = async (checked: boolean) => {
    setAutoBanEnabled(checked)
    try {
      await window.api.setSettings('autoBanEnabled', checked)

      // If disabling, also disable force mode
      if (!checked) {
        setAutoBanForce(false)
        await window.api.setSettings('autoBanForce', false)
      }
    } catch (error) {
      console.error('Failed to save auto ban setting:', error)
    }
  }

  const handleAutoBanForceChange = async (checked: boolean) => {
    setAutoBanForce(checked)
    try {
      await window.api.setSettings('autoBanForce', checked)
    } catch (error) {
      console.error('Failed to save auto ban force setting:', error)
    }
  }

  const handleAutoBanChampionsChange = async (championIds: number[]) => {
    setAutoBanChampions(championIds)
    try {
      await window.api.setSettings('autoBanChampions', championIds)
      await window.api.setAutoBanChampions(championIds)
    } catch (error) {
      console.error('Failed to save auto ban champions:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Auto Pick Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-text-primary">
              {t('settings.autoPick.title')}
            </h3>
            <p className="text-xs text-text-secondary mt-1">{t('settings.autoPick.description')}</p>
          </div>
          <Switch
            checked={autoPickEnabled}
            onCheckedChange={handleAutoPickEnabledChange}
            disabled={disabled || loading}
          />
        </div>

        {autoPickEnabled && (
          <div className="ml-6 space-y-4">
            {/* Force Pick Option */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text-primary">
                  {t('settings.autoPick.force')}
                </h4>
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.autoPick.forceDescription')}
                </p>
              </div>
              <Switch
                checked={autoPickForce}
                onCheckedChange={handleAutoPickForceChange}
                disabled={disabled || loading}
              />
            </div>

            {/* Pick Champion Selection */}
            <ChampionSelector
              champions={ownedChampions}
              selectedChampionIds={autoPickChampions}
              onChampionsChange={handleAutoPickChampionsChange}
              label={t('settings.autoPick.championPriority')}
              maxChampions={5}
            />
          </div>
        )}
      </div>

      {/* Auto Ban Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-text-primary">{t('settings.autoBan.title')}</h3>
            <p className="text-xs text-text-secondary mt-1">{t('settings.autoBan.description')}</p>
          </div>
          <Switch
            checked={autoBanEnabled}
            onCheckedChange={handleAutoBanEnabledChange}
            disabled={disabled || loading}
          />
        </div>

        {autoBanEnabled && (
          <div className="ml-6 space-y-4">
            {/* Force Ban Option */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text-primary">
                  {t('settings.autoBan.force')}
                </h4>
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.autoBan.forceDescription')}
                </p>
              </div>
              <Switch
                checked={autoBanForce}
                onCheckedChange={handleAutoBanForceChange}
                disabled={disabled || loading}
              />
            </div>

            {/* Ban Champion Selection */}
            <ChampionSelector
              champions={allChampions}
              selectedChampionIds={autoBanChampions}
              onChampionsChange={handleAutoBanChampionsChange}
              label={t('settings.autoBan.championPriority')}
              maxChampions={5}
            />
          </div>
        )}
      </div>
    </div>
  )
}
