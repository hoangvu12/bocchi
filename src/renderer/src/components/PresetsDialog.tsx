import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtom } from 'jotai'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { PresetCard } from './PresetCard'
import { presetService } from '../services/presetService'
import { toast } from 'sonner'
import {
  presetsAtom,
  presetDialogOpenAtom,
  selectedPresetIdAtom,
  presetsLoadingAtom
} from '../store/atoms/presets'
import { selectedSkinsAtom } from '../store/atoms'
import type { Preset } from '../../../shared/types/preset'
import { Search, Download } from 'lucide-react'

interface PresetsDialogProps {
  onApplyPreset?: (preset: Preset) => void
}

export const PresetsDialog: React.FC<PresetsDialogProps> = ({ onApplyPreset }) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useAtom(presetDialogOpenAtom)
  const [presets, setPresets] = useAtom(presetsAtom)
  const [loading, setLoading] = useAtom(presetsLoadingAtom)
  const [selectedPresetId, setSelectedPresetId] = useAtom(selectedPresetIdAtom)
  const [, setSelectedSkins] = useAtom(selectedSkinsAtom)

  const [searchQuery, setSearchQuery] = useState('')

  const loadPresets = useCallback(async () => {
    setLoading(true)
    try {
      const loadedPresets = await presetService.listPresets()
      setPresets(loadedPresets)
    } catch (error) {
      console.error('Failed to load presets:', error)
      toast.error(t('presets.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [setLoading, setPresets, t])

  // Load presets when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadPresets()
    }
  }, [isOpen, loadPresets])

  const handleApplyPreset = async (preset: Preset) => {
    try {
      // Convert preset skins to selected skins format
      const skins = presetService.convertToSelectedSkins(preset.skins)
      setSelectedSkins(skins)
      setSelectedPresetId(preset.id)

      toast.success(t('presets.loadSuccess', { name: preset.name }))

      // Call the parent's apply function if provided
      if (onApplyPreset) {
        onApplyPreset(preset)
      }

      setIsOpen(false)
    } catch (error) {
      console.error('Failed to apply preset:', error)
      toast.error(t('presets.errors.loadFailed'))
    }
  }

  const handleDeletePreset = async (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return

    // Show confirmation
    const confirmed = window.confirm(t('presets.deleteConfirm', { name: preset.name }))
    if (!confirmed) return

    try {
      await presetService.deletePreset(presetId)
      setPresets((prev) => prev.filter((p) => p.id !== presetId))

      // Clear selection if deleted preset was selected
      if (selectedPresetId === presetId) {
        setSelectedPresetId(null)
      }

      toast.success(t('presets.deleteSuccess'))
    } catch (error) {
      console.error('Failed to delete preset:', error)
      toast.error(t('presets.errors.deleteFailed'))
    }
  }

  const handleDuplicatePreset = async (preset: Preset) => {
    try {
      const newName = `${preset.name} (Copy)`
      const duplicated = await presetService.duplicatePreset(preset.id, newName)
      setPresets((prev) => [...prev, duplicated])
      toast.success(t('presets.duplicateSuccess', { name: duplicated.name }))
    } catch (error) {
      console.error('Failed to duplicate preset:', error)
      toast.error(t('presets.errors.duplicateFailed'))
    }
  }

  const handleExportPreset = async (preset: Preset) => {
    try {
      await presetService.exportPreset(preset.id)
      toast.success(t('presets.exportSuccess'))
    } catch (error) {
      console.error('Failed to export preset:', error)
      toast.error(t('presets.errors.exportFailed'))
    }
  }

  const handleImportPreset = async () => {
    try {
      const imported = await presetService.importPreset()
      setPresets((prev) => [...prev, imported])
      toast.success(t('presets.importSuccess'))
    } catch (error) {
      console.error('Failed to import preset:', error)
      if (error instanceof Error && error.message.includes('canceled')) {
        // User canceled, don't show error
        return
      }
      toast.error(t('presets.errors.importFailed'))
    }
  }

  const handleEditPreset = () => {
    // TODO: Implement edit functionality
    toast.info('Edit functionality coming soon!')
  }

  const filteredPresets = presets.filter(
    (preset) =>
      preset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      preset.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t('presets.title')}</DialogTitle>
          <DialogDescription>{t('presets.managePresets')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Search and Actions Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                placeholder={t('actions.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="default" onClick={handleImportPreset}>
              <Download className="h-4 w-4" />
              {t('presets.importPreset')}
            </Button>
          </div>

          {/* Presets List */}
          <div className="h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-text-secondary">{t('app.loading')}</div>
              </div>
            ) : filteredPresets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <div className="text-text-secondary mb-2">
                  {searchQuery ? t('presets.noResults') : t('presets.noPresets')}
                </div>
                {!searchQuery && (
                  <div className="text-text-muted text-sm">{t('presets.createFirst')}</div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
                {filteredPresets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    onApply={() => handleApplyPreset(preset)}
                    onEdit={() => handleEditPreset()}
                    onDelete={() => handleDeletePreset(preset.id)}
                    onDuplicate={() => handleDuplicatePreset(preset)}
                    onExport={() => handleExportPreset(preset)}
                    isActive={selectedPresetId === preset.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
