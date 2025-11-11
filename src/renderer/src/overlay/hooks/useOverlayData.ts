import { useState, useEffect } from 'react'

interface OverlaySkinData {
  id: string | number
  name: string
  num: number
  image?: string
  rarity?: string
}

interface OverlayTheme {
  mode: 'light' | 'dark'
  colors?: {
    primary?: string
    secondary?: string
    background?: string
    surface?: string
    text?: string
  }
}

interface OverlayData {
  championId: number
  championKey: string
  championName: string
  championImage: string
  skins: OverlaySkinData[]
  autoRandomEnabled: boolean
  autoSelectedSkin?: {
    id: string | number
    name: string
  }
  theme?: OverlayTheme
}

export function useOverlayData() {
  const [overlayData, setOverlayData] = useState<OverlayData | null>(null)
  const [theme, setTheme] = useState<OverlayTheme | null>(null)

  useEffect(() => {
    // Listen for overlay data
    const unsubscribeData = window.overlayApi.onData((data: OverlayData) => {
      setOverlayData(data)
      if (data.theme) {
        setTheme(data.theme)
      }
    })

    // Listen for theme updates
    const unsubscribeTheme = window.overlayApi.onThemeUpdate((newTheme: OverlayTheme) => {
      setTheme(newTheme)
    })

    // Notify that overlay is ready
    window.overlayApi.ready()

    return () => {
      unsubscribeData()
      unsubscribeTheme()
    }
  }, [])

  return { overlayData, theme }
}
