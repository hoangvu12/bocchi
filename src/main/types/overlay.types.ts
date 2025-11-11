// Types for overlay window communication

export interface OverlaySkinData {
  id: string | number
  name: string
  num: number
  image?: string
  rarity?: string
}

export interface OverlayChampionData {
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

export interface OverlayTheme {
  mode: 'light' | 'dark'
  colors?: {
    primary?: string
    secondary?: string
    background?: string
    surface?: string
    text?: string
  }
}

export interface OverlaySkinSelection {
  championKey: string
  championName: string
  skinId: string | number
  skinName: string
  skinNum: number
  rarity?: string
}
