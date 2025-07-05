import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Theme, ThemeMode, ThemeConfig } from '../themes/types'
import {
  themes,
  getThemeById,
  getThemeForMode,
  defaultLightTheme,
  defaultDarkTheme
} from '../themes/themes'
import { applyTheme, getSystemThemePreference } from '../themes/utils'

interface ThemeContextType {
  theme: Theme
  themeConfig: ThemeConfig
  availableThemes: Theme[]
  setTheme: (themeId: string) => void
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'bocchi-theme-config'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Load initial theme config from localStorage or use defaults
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        // Invalid stored data
      }
    }

    // Check for legacy dark mode setting
    const legacyDarkMode = localStorage.getItem('darkMode')
    if (legacyDarkMode === 'true') {
      return { themeId: 'default', mode: 'dark' }
    } else if (legacyDarkMode === 'false') {
      return { themeId: 'default', mode: 'light' }
    }

    // Default to system preference
    return { themeId: 'default', mode: 'system' }
  })

  // Determine the actual theme based on config and system preference
  const [theme, setCurrentTheme] = useState<Theme>(() => {
    const isDark =
      themeConfig.mode === 'dark' || (themeConfig.mode === 'system' && getSystemThemePreference())
    const themeId = `${themeConfig.themeId}-${isDark ? 'dark' : 'light'}`
    return getThemeById(themeId) || (isDark ? defaultDarkTheme : defaultLightTheme)
  })

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Save theme config to localStorage
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeConfig))

    // Also update legacy darkMode for compatibility
    const isDark = theme.isDark
    localStorage.setItem('darkMode', isDark ? 'true' : 'false')
  }, [themeConfig, theme])

  // Update theme when config or system preference changes
  useEffect(() => {
    const updateTheme = () => {
      const isDark =
        themeConfig.mode === 'dark' || (themeConfig.mode === 'system' && getSystemThemePreference())
      const newTheme = getThemeForMode(themeConfig.themeId, isDark)
      if (newTheme && newTheme.id !== theme.id) {
        setCurrentTheme(newTheme)
      }
    }

    updateTheme()

    // Listen for system theme changes
    if (themeConfig.mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => updateTheme()
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }

    return undefined
  }, [themeConfig, theme.id])

  const setTheme = useCallback((themeId: string) => {
    // Extract base theme name (remove -light/-dark suffix if present)
    const baseThemeId = themeId.replace(/-light|-dark/, '')
    setThemeConfig((prev) => ({ ...prev, themeId: baseThemeId }))
  }, [])

  const setMode = useCallback((mode: ThemeMode) => {
    setThemeConfig((prev) => ({ ...prev, mode }))
  }, [])

  const toggleMode = useCallback(() => {
    setThemeConfig((prev) => {
      if (prev.mode === 'light') return { ...prev, mode: 'dark' }
      if (prev.mode === 'dark') return { ...prev, mode: 'light' }
      // If system, switch to the opposite of current
      return { ...prev, mode: theme.isDark ? 'light' : 'dark' }
    })
  }, [theme.isDark])

  const value: ThemeContextType = {
    theme,
    themeConfig,
    availableThemes: themes,
    setTheme,
    setMode,
    toggleMode
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
