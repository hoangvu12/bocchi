import { Skin, Chroma } from '../types/champion.types'
import { CDragonSkin } from '../types/cdragon.types'
import { getRarityGemPath } from '../utils/rarity.utils'
import { findBestSkinMatch } from '../../src/main/utils/skinNameMatcher'

export class SkinProcessor {
  static processChromas(skin: CDragonSkin): Chroma[] | undefined {
    if (!skin.chromas || skin.chromas.length === 0) {
      return undefined
    }

    return skin.chromas.map((chroma) => ({
      id: chroma.id,
      name: chroma.name,
      chromaPath: chroma.chromaPath
        ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default${chroma.chromaPath.replace('/lol-game-data/assets/', '/')}`
        : '',
      colors: chroma.colors || []
    }))
  }

  static processTieredSkin(
    skin: CDragonSkin,
    championId: number,
    lolSkinsList: any[],
    englishSkinNames?: Map<string, string>
  ): Skin[] {
    const tiers = skin.questSkinInfo?.tiers
    if (!tiers || tiers.length === 0) {
      return []
    }

    return tiers.map((tier) => {
      const skinNum = Math.floor(tier.id / 1000) === championId ? tier.id % 1000 : 0
      const skinId = `${championId}_${skinNum}`

      const nameForMatching = englishSkinNames?.get(skinId) || tier.name
      const match = skinNum === 0 ? null : findBestSkinMatch(nameForMatching, lolSkinsList)
      const isBaseSkin = skinNum === 0
      const hasMatch = match !== null

      return {
        id: skinId,
        num: skinNum,
        name: tier.name,
        lolSkinsName:
          match && match.skinInfo.skinName !== tier.name ? match.skinInfo.skinName : undefined,
        isInLolSkins: isBaseSkin || hasMatch,
        chromas: false,
        chromaList: undefined,
        rarity: skin.rarity || 'kNoRarity',
        rarityGemPath: getRarityGemPath(skin.rarity || 'kNoRarity'),
        isLegacy: skin.isLegacy || false,
        skinType: skin.skinType || '',
        skinLines: skin.skinLines,
        description: tier.description
      }
    })
  }

  static processRegularSkin(
    skin: CDragonSkin,
    championId: number,
    championName: string,
    championKey: string,
    lolSkinsList: any[],
    specialVariants: Record<string, any>,
    englishSkinNames?: Map<string, string>
  ): Skin {
    const skinNum = Math.floor(skin.id / 1000) === championId ? skin.id % 1000 : 0
    const skinId = `${championId}_${skinNum}`
    const skinName = skin.isBase ? championName : skin.name

    const nameForMatching = englishSkinNames?.get(skinId) || skinName
    const match = skinNum === 0 ? null : findBestSkinMatch(nameForMatching, lolSkinsList)
    const isBaseSkin = skinNum === 0
    const hasMatch = match !== null

    const chromaList = this.processChromas(skin)

    const englishName = englishSkinNames?.get(skinId)
    const variantLookupName = englishName || skinName
    const variants = specialVariants[championKey]?.[variantLookupName]
    const hasVariants = variants !== undefined && variants.items.length > 0

    return {
      id: skinId,
      num: skinNum,
      name: skinName,
      lolSkinsName:
        match && match.skinInfo.skinName !== skinName ? match.skinInfo.skinName : undefined,
      isInLolSkins: isBaseSkin || hasMatch || hasVariants,
      chromas: !!(skin.chromas && skin.chromas.length > 0),
      chromaList: chromaList,
      variants: variants,
      rarity: skin.rarity || 'kNoRarity',
      rarityGemPath: getRarityGemPath(skin.rarity || 'kNoRarity'),
      isLegacy: skin.isLegacy || false,
      skinType: skin.skinType || '',
      skinLines: skin.skinLines,
      description: skin.description
    }
  }
}
