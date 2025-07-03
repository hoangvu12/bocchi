import React from 'react'
import { Button } from './ui/button'

export type ViewMode = 'compact' | 'comfortable' | 'spacious' | 'list'

interface GridViewToggleProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export const GridViewToggle: React.FC<GridViewToggleProps> = ({ viewMode, onViewModeChange }) => {
  const viewModes: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    {
      mode: 'compact',
      label: 'Compact',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="4" height="4" />
          <rect x="6" y="1" width="4" height="4" />
          <rect x="11" y="1" width="4" height="4" />
          <rect x="1" y="6" width="4" height="4" />
          <rect x="6" y="6" width="4" height="4" />
          <rect x="11" y="6" width="4" height="4" />
          <rect x="1" y="11" width="4" height="4" />
          <rect x="6" y="11" width="4" height="4" />
          <rect x="11" y="11" width="4" height="4" />
        </svg>
      )
    },
    {
      mode: 'comfortable',
      label: 'Comfortable',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" />
          <rect x="9" y="1" width="6" height="6" />
          <rect x="1" y="9" width="6" height="6" />
          <rect x="9" y="9" width="6" height="6" />
        </svg>
      )
    },
    {
      mode: 'spacious',
      label: 'Spacious',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="12" height="12" />
        </svg>
      )
    },
    {
      mode: 'list',
      label: 'List',
      icon: (
        <svg
          className="w-4 h-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <line x1="2" y1="4" x2="14" y2="4" />
          <line x1="2" y1="8" x2="14" y2="8" />
          <line x1="2" y1="12" x2="14" y2="12" />
        </svg>
      )
    }
  ]

  return (
    <div className="flex items-center gap-1 p-1 bg-cream-100 dark:bg-charcoal-800 rounded-lg">
      {viewModes.map(({ mode, icon, label }) => (
        <Button
          key={mode}
          variant={viewMode === mode ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => onViewModeChange(mode)}
          className={`p-2 rounded-md ${
            viewMode === mode
              ? 'bg-white dark:bg-charcoal-700 text-terracotta-600 dark:text-terracotta-400 shadow-sm'
              : 'text-charcoal-600 dark:text-charcoal-400'
          }`}
          title={label}
        >
          {icon}
        </Button>
      ))}
    </div>
  )
}
