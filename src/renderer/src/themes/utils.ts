import { Theme, ColorScale } from './types'

export function generateCSSVariables(theme: Theme): string {
  const variables: string[] = []

  // Convert color scale to CSS variables
  const addColorScale = (name: string, scale: ColorScale) => {
    Object.entries(scale).forEach(([key, value]) => {
      variables.push(`--color-${name}-${key}: ${value};`)
    })
  }

  // Primary and secondary color scales
  addColorScale('primary', theme.colors.primary)
  addColorScale('secondary', theme.colors.secondary)

  // Background colors
  variables.push(`--color-background: ${theme.colors.background.base};`)
  variables.push(`--color-surface: ${theme.colors.background.surface};`)
  variables.push(`--color-elevated: ${theme.colors.background.elevated};`)

  // Text colors
  variables.push(`--color-text-primary: ${theme.colors.text.primary};`)
  variables.push(`--color-text-secondary: ${theme.colors.text.secondary};`)
  variables.push(`--color-text-muted: ${theme.colors.text.muted};`)
  variables.push(`--color-text-inverse: ${theme.colors.text.inverse};`)

  // Border colors
  variables.push(`--color-border: ${theme.colors.border.default};`)
  variables.push(`--color-border-strong: ${theme.colors.border.strong};`)
  variables.push(`--color-border-subtle: ${theme.colors.border.subtle};`)

  // State colors
  variables.push(`--color-success: ${theme.colors.state.success};`)
  variables.push(`--color-warning: ${theme.colors.state.warning};`)
  variables.push(`--color-error: ${theme.colors.state.error};`)
  variables.push(`--color-info: ${theme.colors.state.info};`)

  return variables.join('\n  ')
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  const cssVariables = generateCSSVariables(theme)

  // Create or update style element
  let styleElement = document.getElementById('theme-variables')
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = 'theme-variables'
    document.head.appendChild(styleElement)
  }

  styleElement.textContent = `:root {\n  ${cssVariables}\n}`

  // Update data attributes for theme identification
  root.setAttribute('data-theme', theme.id)
  root.setAttribute('data-theme-mode', theme.isDark ? 'dark' : 'light')

  // Keep the dark class in sync
  if (theme.isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function getSystemThemePreference(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
