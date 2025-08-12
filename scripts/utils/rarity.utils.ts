const RARITY_MAP: Record<string, string> = {
  kEpic: 'epic',
  kLegendary: 'legendary',
  kUltimate: 'ultimate',
  kMythic: 'mythic'
}

export function getRarityGemPath(rarity: string): string | null {
  const rarityKey = RARITY_MAP[rarity]

  if (!rarityKey) {
    return null
  }

  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/rarity-gem-icons/${rarityKey}.png`
}
