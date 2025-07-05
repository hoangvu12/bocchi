export interface ColorScale {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950: string
}

export interface ThemeColors {
  primary: ColorScale
  secondary: ColorScale
  background: {
    base: string
    surface: string
    elevated: string
  }
  text: {
    primary: string
    secondary: string
    muted: string
    inverse: string
  }
  border: {
    default: string
    strong: string
    subtle: string
  }
  state: {
    success: string
    warning: string
    error: string
    info: string
  }
}

export interface Theme {
  id: string
  name: string
  description?: string
  isDark: boolean
  colors: ThemeColors
}

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeConfig {
  themeId: string
  mode: ThemeMode
}
