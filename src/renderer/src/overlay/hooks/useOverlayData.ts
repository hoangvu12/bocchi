import { useState, useEffect } from 'react'

interface OverlayData {
  championId: number
  championKey: string
  championName: string
  skins: any[]
  autoRandomEnabled: boolean
  autoSelectedSkin?: any
  theme?: any
}

export function useOverlayData() {
  const [overlayData, setOverlayData] = useState<OverlayData | null>(null)
  const [theme, setTheme] = useState<any>(null)

  useEffect(() => {
    // Listen for overlay data
    const unsubscribeData = window.overlayApi.onData((data: OverlayData) => {
      setOverlayData(data)
      if (data.theme) {
        setTheme(data.theme)
      }
    })

    // Listen for theme updates
    const unsubscribeTheme = window.overlayApi.onThemeUpdate((newTheme: any) => {
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
