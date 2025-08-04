import React from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { MoreVertical, Upload, Copy, Trash2, Play, Edit } from 'lucide-react'
import type { Preset } from '../../../shared/types/preset'

interface PresetCardProps {
  preset: Preset
  onApply: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onExport: () => void
  isActive?: boolean
}

export const PresetCard: React.FC<PresetCardProps> = ({
  preset,
  onApply,
  onEdit,
  onDelete,
  onDuplicate,
  onExport,
  isActive
}) => {
  const { t } = useTranslation()

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getChampionThumbnails = () => {
    // For now, return placeholder champion icons
    // In a real implementation, you'd use actual champion images
    return preset.thumbnailChampions?.slice(0, 4) || []
  }

  return (
    <Card
      className={`group relative transition-all duration-200 hover:shadow-lg ${
        isActive
          ? 'ring-2 ring-primary-500 dark:ring-primary-400'
          : 'hover:shadow-medium dark:hover:shadow-dark-medium'
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-text-primary">{preset.name}</CardTitle>
            {preset.description && (
              <CardDescription className="mt-1 text-sm text-text-secondary line-clamp-2">
                {preset.description}
              </CardDescription>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                {t('presets.actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                {t('presets.actions.duplicate')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExport}>
                <Upload className="mr-2 h-4 w-4" />
                {t('presets.actions.export')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                {t('presets.actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Champion Thumbnails */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {getChampionThumbnails().map((champion, index) => (
                <div
                  key={champion}
                  className="w-8 h-8 rounded-full bg-surface-secondary border-2 border-background flex items-center justify-center text-xs font-medium"
                  style={{ zIndex: 4 - index }}
                >
                  {champion.slice(0, 2).toUpperCase()}
                </div>
              ))}
              {preset.thumbnailChampions && preset.thumbnailChampions.length > 4 && (
                <div className="w-8 h-8 rounded-full bg-surface-secondary border-2 border-background flex items-center justify-center text-xs font-medium">
                  +{preset.thumbnailChampions.length - 4}
                </div>
              )}
            </div>
            <span className="text-sm text-text-secondary">
              {t('presets.skinCount', { count: preset.skinCount })}
            </span>
          </div>

          {/* Last Updated */}
          <div className="text-xs text-text-muted">
            {t('presets.lastUpdated', { date: formatDate(preset.updatedAt) })}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="default" size="sm" className="flex-1" onClick={onApply}>
              <Play className="h-4 w-4" />
              {t('presets.actions.apply')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
