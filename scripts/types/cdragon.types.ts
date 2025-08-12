export interface CDragonChroma {
  id: number
  name: string
  contentId: string
  skinClassification: string
  chromaPath: string
  tilePath: string
  colors: string[]
  descriptions: Array<{
    region: string
    description: string
  }>
  description: string
  rarities: Array<{
    region: string
    rarity: number
  }>
}

export interface QuestSkinInfo {
  name: string
  productType: string
  collectionDescription: string
  descriptionInfo: Array<any>
  splashPath: string
  uncenteredSplashPath: string
  tilePath: string
  collectionCardPath: string
  tiers?: Tier[]
}

export interface Tier {
  id: number
  name: string
  stage: number
  description: string
  splashPath: string
  uncenteredSplashPath: string
  tilePath: string
  loadScreenPath: string
  shortName: string
  splashVideoPath: string | null
  previewVideoUrl: string | null
  collectionSplashVideoPath: string | null
  collectionCardHoverVideoPath: string | null
  skinAugments?: {
    borders?: {
      [key: string]: Array<{
        contentId: string
        layer: number
        priority: number
        borderPath: string
      }>
    }
    augments?: Array<{
      contentId: string
      overlays: Array<{
        centeredLCOverlayPath: string
        uncenteredLCOverlayPath: string
        socialCardLCOverlayPath: string
        tileLCOverlayPath: string
      }>
    }>
  }
}

export interface CDragonSkin {
  id: number
  contentId: string
  isBase: boolean
  name: string
  skinClassification: string
  splashPath: string
  uncenteredSplashPath: string
  tilePath: string
  loadScreenPath: string
  skinType: string
  rarity: string
  isLegacy: boolean
  splashVideoPath: any
  previewVideoUrl: any
  collectionSplashVideoPath: any
  collectionCardHoverVideoPath: any
  featuresText: any
  chromaPath?: string
  emblems: any
  regionRarityId: number
  rarityGemPath: any
  skinLines?: Array<{ id: number }>
  description?: string
  chromas?: CDragonChroma[]
  loadScreenVintagePath?: string
  questSkinInfo?: QuestSkinInfo
}

export interface CDragonChampion {
  id: number
  name: string
  alias: string
  title: string
  shortBio: string
  tacticalInfo: {
    style: number
    difficulty: number
    damageType: string
    attackType: string
  }
  playstyleInfo: {
    damage: number
    durability: number
    crowdControl: number
    mobility: number
    utility: number
  }
  championTagInfo: {
    championTagPrimary: string
    championTagSecondary: string
  }
  squarePortraitPath: string
  stingerSfxPath: string
  chooseVoPath: string
  banVoPath: string
  roles: string[]
  recommendedItemDefaults: any[]
  skins: CDragonSkin[]
  passive: {
    name: string
    abilityIconPath: string
    abilityVideoPath: string
    abilityVideoImagePath: string
    description: string
  }
  spells: Array<{
    spellKey: string
    name: string
    abilityIconPath: string
    abilityVideoPath: string
    abilityVideoImagePath: string
    cost: string
    cooldown: string
    description: string
    dynamicDescription: string
    range: number[]
    costCoefficients: number[]
    cooldownCoefficients: number[]
    coefficients: {
      coefficient1: number
      coefficient2: number
    }
    effectAmounts: {
      [key: string]: number[]
    }
    ammo: {
      ammoRechargeTime: number[]
      maxAmmo: number[]
    }
    maxLevel: number
  }>
}
