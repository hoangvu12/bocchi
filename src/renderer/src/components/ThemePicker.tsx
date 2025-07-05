import { useState } from 'react'
import { Palette, Check, Monitor, Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { ThemeMode } from '../themes/types'
import { lightThemes, darkThemes } from '../themes/themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from './ui/dropdown-menu'
import { Button } from './ui/button'

export function ThemePicker() {
  const { theme, themeConfig, setTheme, setMode } = useTheme()
  const [open, setOpen] = useState(false)

  // Extract base theme name for comparison
  const currentBaseTheme = theme.id.replace(/-light|-dark/, '')

  const modeIcons = {
    light: <Sun className="w-4 h-4" />,
    dark: <Moon className="w-4 h-4" />,
    system: <Monitor className="w-4 h-4" />
  }

  const getModeLabel = (mode: ThemeMode) => {
    switch (mode) {
      case 'light':
        return 'Light'
      case 'dark':
        return 'Dark'
      case 'system':
        return 'System'
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative w-10 h-10 rounded-lg"
          aria-label="Theme picker"
        >
          <Palette className="w-5 h-5 text-secondary-600 dark:text-secondary-300 group-hover:text-secondary-800 dark:group-hover:text-secondary-100 transition-colors" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Mode Selection */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2">
            {modeIcons[themeConfig.mode]}
            <span>{getModeLabel(themeConfig.mode)} Mode</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={themeConfig.mode}
              onValueChange={(value) => setMode(value as ThemeMode)}
            >
              <DropdownMenuRadioItem value="light" className="flex items-center gap-2">
                <Sun className="w-4 h-4" />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" className="flex items-center gap-2">
                <Moon className="w-4 h-4" />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system" className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Theme Selection */}
        <DropdownMenuLabel className="text-xs text-text-muted">Color Scheme</DropdownMenuLabel>

        {/* Show appropriate themes based on current mode */}
        {(theme.isDark ? darkThemes : lightThemes).map((themeOption) => {
          const baseThemeName = themeOption.id.replace(/-light|-dark/, '')
          const isSelected = currentBaseTheme === baseThemeName

          return (
            <DropdownMenuItem
              key={themeOption.id}
              onClick={() => setTheme(baseThemeName)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: themeOption.colors.primary[500] }}
                  />
                  <div
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: themeOption.colors.secondary[500] }}
                  />
                </div>
                <div>
                  <div className="font-medium">{themeOption.name.replace(/ Light| Dark/, '')}</div>
                  {themeOption.description && (
                    <div className="text-xs text-text-muted">{themeOption.description}</div>
                  )}
                </div>
              </div>
              {isSelected && <Check className="w-4 h-4 text-primary-500" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
