import { Theme } from './types'

// Default theme - based on current Bocchi colors
export const defaultLightTheme: Theme = {
  id: 'default-light',
  name: 'Default Light',
  description: 'Classic Bocchi theme with warm terracotta accents',
  isDark: false,
  colors: {
    primary: {
      50: '#fef7f5',
      100: '#fee9e5',
      200: '#fcc7bc',
      300: '#f9a08c',
      400: '#f47560',
      500: '#d4654e',
      600: '#c24b35',
      700: '#a13829',
      800: '#842f24',
      900: '#6f2922',
      950: '#3c130f'
    },
    secondary: {
      50: '#fefefe',
      100: '#fcfbfa',
      200: '#f8f6f3',
      300: '#f0ebe5',
      400: '#e5ddd2',
      500: '#d3c5b6',
      600: '#b8a593',
      700: '#9a8470',
      800: '#7d6856',
      900: '#665447',
      950: '#3a2f29'
    },
    background: {
      base: '#f5f2ed',
      surface: '#ffffff',
      elevated: '#fcfbfa'
    },
    text: {
      primary: '#0a0a0a',
      secondary: '#2d2d2d',
      muted: '#4a4a4a',
      inverse: '#ffffff'
    },
    border: {
      default: '#e7e7e7',
      strong: '#d1d1d1',
      subtle: '#f0f0f0'
    },
    state: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6'
    }
  }
}

export const defaultDarkTheme: Theme = {
  id: 'default-dark',
  name: 'Default Dark',
  description: 'Classic Bocchi dark theme',
  isDark: true,
  colors: {
    primary: {
      50: '#fef7f5',
      100: '#fee9e5',
      200: '#fcc7bc',
      300: '#f9a08c',
      400: '#f47560',
      500: '#d4654e',
      600: '#c24b35',
      700: '#a13829',
      800: '#842f24',
      900: '#6f2922',
      950: '#3c130f'
    },
    secondary: {
      50: '#f6f6f6',
      100: '#e7e7e7',
      200: '#d1d1d1',
      300: '#b0b0b0',
      400: '#888888',
      500: '#6d6d6d',
      600: '#5d5d5d',
      700: '#4f4f4f',
      800: '#3d3d3d',
      900: '#2d2d2d',
      950: '#1a1a1a'
    },
    background: {
      base: '#1a1a1a',
      surface: '#2d2d2d',
      elevated: '#3d3d3d'
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
      muted: '#888888',
      inverse: '#0a0a0a'
    },
    border: {
      default: '#3d3d3d',
      strong: '#4f4f4f',
      subtle: '#2d2d2d'
    },
    state: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6'
    }
  }
}

// Ocean theme
export const oceanLightTheme: Theme = {
  id: 'ocean-light',
  name: 'Ocean Light',
  description: 'Cool blues and teals inspired by the sea',
  isDark: false,
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93bbfd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554'
    },
    secondary: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
      950: '#042f2e'
    },
    background: {
      base: '#f0f9ff',
      surface: '#ffffff',
      elevated: '#e0f2fe'
    },
    text: {
      primary: '#0c4a6e',
      secondary: '#075985',
      muted: '#0284c7',
      inverse: '#ffffff'
    },
    border: {
      default: '#bae6fd',
      strong: '#7dd3fc',
      subtle: '#e0f2fe'
    },
    state: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6'
    }
  }
}

export const oceanDarkTheme: Theme = {
  id: 'ocean-dark',
  name: 'Ocean Dark',
  description: 'Deep ocean blues for night mode',
  isDark: true,
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93bbfd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554'
    },
    secondary: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
      950: '#042f2e'
    },
    background: {
      base: '#0f172a',
      surface: '#1e293b',
      elevated: '#334155'
    },
    text: {
      primary: '#f0f9ff',
      secondary: '#bae6fd',
      muted: '#7dd3fc',
      inverse: '#0c4a6e'
    },
    border: {
      default: '#334155',
      strong: '#475569',
      subtle: '#1e293b'
    },
    state: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#60a5fa'
    }
  }
}

// Bikkuri theme - inspired by warm, lively colors
export const bikkuriLightTheme: Theme = {
  id: 'bikkuri-light',
  name: 'Bikkuri Light',
  description: 'Warm and lively with pink accents',
  isDark: false,
  colors: {
    primary: {
      50: '#fdf2f8',
      100: '#fce7f3',
      200: '#fbcfe8',
      300: '#f9a8d4',
      400: '#f472b6',
      500: '#ec4899',
      600: '#db2777',
      700: '#be185d',
      800: '#9d174d',
      900: '#831843',
      950: '#500724'
    },
    secondary: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
      950: '#422006'
    },
    background: {
      base: '#fef3f2',
      surface: '#ffffff',
      elevated: '#fff5f5'
    },
    text: {
      primary: '#500724',
      secondary: '#831843',
      muted: '#9d174d',
      inverse: '#ffffff'
    },
    border: {
      default: '#fbcfe8',
      strong: '#f9a8d4',
      subtle: '#fce7f3'
    },
    state: {
      success: '#84cc16',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#06b6d4'
    }
  }
}

export const bikkuriDarkTheme: Theme = {
  id: 'bikkuri-dark',
  name: 'Bikkuri Dark',
  description: 'Dark brown with vibrant pink highlights',
  isDark: true,
  colors: {
    primary: {
      50: '#fdf2f8',
      100: '#fce7f3',
      200: '#fbcfe8',
      300: '#f9a8d4',
      400: '#f472b6',
      500: '#ec4899',
      600: '#db2777',
      700: '#be185d',
      800: '#9d174d',
      900: '#831843',
      950: '#500724'
    },
    secondary: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
      950: '#422006'
    },
    background: {
      base: '#1a0f0a',
      surface: '#2d1810',
      elevated: '#3d251a'
    },
    text: {
      primary: '#fce7f3',
      secondary: '#fbcfe8',
      muted: '#f9a8d4',
      inverse: '#1a0f0a'
    },
    border: {
      default: '#3d251a',
      strong: '#4a3020',
      subtle: '#2d1810'
    },
    state: {
      success: '#86efac',
      warning: '#fde047',
      error: '#fca5a5',
      info: '#7dd3fc'
    }
  }
}

// Cyberpunk theme - inspired by SynthWave
export const cyberpunkLightTheme: Theme = {
  id: 'cyberpunk-light',
  name: 'Cyberpunk Light',
  description: 'Neon colors on light background',
  isDark: false,
  colors: {
    primary: {
      50: '#fdf4ff',
      100: '#fae8ff',
      200: '#f5d0fe',
      300: '#f0abfc',
      400: '#e879f9',
      500: '#d946ef',
      600: '#c026d3',
      700: '#a21caf',
      800: '#86198f',
      900: '#701a75',
      950: '#4a044e'
    },
    secondary: {
      50: '#ecfeff',
      100: '#cffafe',
      200: '#a5f3fc',
      300: '#67e8f9',
      400: '#22d3ee',
      500: '#06b6d4',
      600: '#0891b2',
      700: '#0e7490',
      800: '#155e75',
      900: '#164e63',
      950: '#083344'
    },
    background: {
      base: '#faf5ff',
      surface: '#ffffff',
      elevated: '#f3e8ff'
    },
    text: {
      primary: '#4a044e',
      secondary: '#701a75',
      muted: '#86198f',
      inverse: '#ffffff'
    },
    border: {
      default: '#f0abfc',
      strong: '#e879f9',
      subtle: '#f5d0fe'
    },
    state: {
      success: '#22c55e',
      warning: '#eab308',
      error: '#ef4444',
      info: '#06b6d4'
    }
  }
}

export const cyberpunkDarkTheme: Theme = {
  id: 'cyberpunk-dark',
  name: 'Cyberpunk Dark',
  description: 'Neon pink and cyan in the dark',
  isDark: true,
  colors: {
    primary: {
      50: '#fdf4ff',
      100: '#fae8ff',
      200: '#f5d0fe',
      300: '#f0abfc',
      400: '#e879f9',
      500: '#d946ef',
      600: '#c026d3',
      700: '#a21caf',
      800: '#86198f',
      900: '#701a75',
      950: '#4a044e'
    },
    secondary: {
      50: '#ecfeff',
      100: '#cffafe',
      200: '#a5f3fc',
      300: '#67e8f9',
      400: '#22d3ee',
      500: '#06b6d4',
      600: '#0891b2',
      700: '#0e7490',
      800: '#155e75',
      900: '#164e63',
      950: '#083344'
    },
    background: {
      base: '#2d1b47',
      surface: '#3d2857',
      elevated: '#4d3567'
    },
    text: {
      primary: '#f0abfc',
      secondary: '#e879f9',
      muted: '#d946ef',
      inverse: '#2d1b47'
    },
    border: {
      default: '#4d3567',
      strong: '#5d4277',
      subtle: '#3d2857'
    },
    state: {
      success: '#4ade80',
      warning: '#facc15',
      error: '#f87171',
      info: '#22d3ee'
    }
  }
}

// Night theme - very dark with bright accents
export const nightLightTheme: Theme = {
  id: 'night-light',
  name: 'Night Light',
  description: 'Cool blues for a calm coding experience',
  isDark: false,
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93bbfd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554'
    },
    secondary: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617'
    },
    background: {
      base: '#f8fafc',
      surface: '#ffffff',
      elevated: '#f1f5f9'
    },
    text: {
      primary: '#0f172a',
      secondary: '#1e293b',
      muted: '#334155',
      inverse: '#ffffff'
    },
    border: {
      default: '#e2e8f0',
      strong: '#cbd5e1',
      subtle: '#f1f5f9'
    },
    state: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6'
    }
  }
}

export const nightDarkTheme: Theme = {
  id: 'night-dark',
  name: 'Night Dark',
  description: 'Deep navy blue for late night coding',
  isDark: true,
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93bbfd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554'
    },
    secondary: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617'
    },
    background: {
      base: '#0a0e1a',
      surface: '#111827',
      elevated: '#1f2937'
    },
    text: {
      primary: '#f3f4f6',
      secondary: '#d1d5db',
      muted: '#9ca3af',
      inverse: '#111827'
    },
    border: {
      default: '#1f2937',
      strong: '#374151',
      subtle: '#111827'
    },
    state: {
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#60a5fa'
    }
  }
}

// After Dark theme - pure black with vibrant colors
export const afterDarkLightTheme: Theme = {
  id: 'afterdark-light',
  name: 'After Dark Light',
  description: 'Clean and minimal with colorful accents',
  isDark: false,
  colors: {
    primary: {
      50: '#fef3c7',
      100: '#fde68a',
      200: '#fcd34d',
      300: '#fbbf24',
      400: '#f59e0b',
      500: '#d97706',
      600: '#b45309',
      700: '#92400e',
      800: '#78350f',
      900: '#451a03',
      950: '#321a05'
    },
    secondary: {
      50: '#ddd6fe',
      100: '#c4b5fd',
      200: '#a78bfa',
      300: '#8b5cf6',
      400: '#7c3aed',
      500: '#6d28d9',
      600: '#5b21b6',
      700: '#4c1d95',
      800: '#381a75',
      900: '#2e1065',
      950: '#1e0e41'
    },
    background: {
      base: '#fafafa',
      surface: '#ffffff',
      elevated: '#f5f5f5'
    },
    text: {
      primary: '#171717',
      secondary: '#404040',
      muted: '#737373',
      inverse: '#ffffff'
    },
    border: {
      default: '#e5e5e5',
      strong: '#d4d4d4',
      subtle: '#f5f5f5'
    },
    state: {
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6'
    }
  }
}

export const afterDarkDarkTheme: Theme = {
  id: 'afterdark-dark',
  name: 'After Dark Dark',
  description: 'Pure black background with vibrant syntax',
  isDark: true,
  colors: {
    primary: {
      50: '#fef3c7',
      100: '#fde68a',
      200: '#fcd34d',
      300: '#fbbf24',
      400: '#f59e0b',
      500: '#d97706',
      600: '#b45309',
      700: '#92400e',
      800: '#78350f',
      900: '#451a03',
      950: '#321a05'
    },
    secondary: {
      50: '#ddd6fe',
      100: '#c4b5fd',
      200: '#a78bfa',
      300: '#8b5cf6',
      400: '#7c3aed',
      500: '#6d28d9',
      600: '#5b21b6',
      700: '#4c1d95',
      800: '#381a75',
      900: '#2e1065',
      950: '#1e0e41'
    },
    background: {
      base: '#000000',
      surface: '#0a0a0a',
      elevated: '#171717'
    },
    text: {
      primary: '#fafafa',
      secondary: '#e5e5e5',
      muted: '#a3a3a3',
      inverse: '#000000'
    },
    border: {
      default: '#262626',
      strong: '#404040',
      subtle: '#171717'
    },
    state: {
      success: '#4ade80',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#60a5fa'
    }
  }
}

// Collect all themes
export const themes: Theme[] = [
  defaultLightTheme,
  defaultDarkTheme,
  oceanLightTheme,
  oceanDarkTheme,
  bikkuriLightTheme,
  bikkuriDarkTheme,
  cyberpunkLightTheme,
  cyberpunkDarkTheme,
  nightLightTheme,
  nightDarkTheme,
  afterDarkLightTheme,
  afterDarkDarkTheme
]

export const lightThemes = themes.filter((t) => !t.isDark)
export const darkThemes = themes.filter((t) => t.isDark)

export function getThemeById(id: string): Theme | undefined {
  return themes.find((t) => t.id === id)
}

export function getThemeForMode(themeId: string, isDark: boolean): Theme | undefined {
  // Extract base theme name (e.g., "default" from "default-light")
  const baseThemeName = themeId.replace(/-light|-dark/, '')
  const suffix = isDark ? '-dark' : '-light'
  return getThemeById(`${baseThemeName}${suffix}`)
}
