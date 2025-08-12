export interface Chroma {
  id: number
  name: string
  chromaPath: string
  colors: string[]
}

export interface SkinVariant {
  id: string
  name: string
  displayName?: string
  githubUrl: string
  downloadUrl?: string
  imageUrl?: string
}

export interface Skin {
  id: string
  num: number
  name: string
  nameEn?: string
  lolSkinsName?: string
  isInLolSkins?: boolean
  chromas: boolean
  chromaList?: Chroma[]
  variants?: {
    type: string
    items: SkinVariant[]
  }
  rarity: string
  rarityGemPath: string | null
  isLegacy: boolean
  skinType: string
  skinLines?: Array<{ id: number }>
  description?: string
}

export interface Champion {
  id: number
  key: string
  name: string
  nameEn?: string
  title: string
  image: string
  tags: string[]
  skins: Skin[]
}

export interface ChampionData {
  version: string
  lastUpdated: string
  champions: Champion[]
}

export interface ChromaData {
  version: string
  lastUpdated: string
  chromaMap: Record<string, Chroma[]>
}

export interface ProgressTracker {
  total: number
  completed: number
  startTime: number
  currentPhase: string
}
