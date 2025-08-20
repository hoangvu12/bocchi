// Utility function to get the display name for a champion
// Always returns English name if available, otherwise falls back to localized name
export function getChampionDisplayName(champion: { name: string; nameEn?: string }): string {
  return champion.nameEn || champion.name
}

// Utility function to get the localized display name for a champion
// Returns the localized name (for UI display based on current language)
export function getLocalizedChampionName(champion: { name: string; nameEn?: string }): string {
  return champion.name
}

// Utility function to get the romanized first letter for alphabet navigation
// For CJK languages, uses the English name to determine the letter
// This provides consistent A-Z navigation across all languages
export function getRomanizedFirstLetter(champion: { name: string; nameEn?: string }): string {
  // Always use English name for alphabet grouping to ensure A-Z navigation
  const nameForGrouping = champion.nameEn || champion.name

  // Get the first character and uppercase it
  const firstChar = nameForGrouping[0].toUpperCase()

  // Ensure it's a valid letter A-Z, otherwise return '#' for special characters
  if (firstChar >= 'A' && firstChar <= 'Z') {
    return firstChar
  }
  return '#'
}

// Detects champion key from text (mod name or description)
// Returns the champion key if found, otherwise returns empty string
export function detectChampionFromText(
  text: string,
  champions: Array<{ key: string; name: string; nameEn?: string }>
): string {
  if (!text || !champions || champions.length === 0) {
    return ''
  }

  // Convert text to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase()

  // Sort champions by name length (descending) to match longer names first
  // This prevents "Miss Fortune" from matching as "Fortune"
  const sortedChampions = [...champions].sort((a, b) => {
    const nameA = getChampionDisplayName(a)
    const nameB = getChampionDisplayName(b)
    return nameB.length - nameA.length
  })

  for (const champion of sortedChampions) {
    const championName = getChampionDisplayName(champion)
    const championKey = champion.key

    // Check various formats:
    // 1. Direct champion name match (case-insensitive)
    if (lowerText.includes(championName.toLowerCase())) {
      return championKey
    }

    // 2. Champion key match (case-insensitive)
    if (lowerText.includes(championKey.toLowerCase())) {
      return championKey
    }

    // 3. Check localized name if different from English
    if (champion.name !== championName && lowerText.includes(champion.name.toLowerCase())) {
      return championKey
    }

    // 4. Special cases for common variations
    const variations = getChampionVariations(championKey)
    for (const variation of variations) {
      if (lowerText.includes(variation.toLowerCase())) {
        return championKey
      }
    }
  }

  // If no champion found in the text, try to extract from common patterns
  // e.g., "Ahri_StarGuardian.zip" -> "Ahri"
  const patterns = [
    /^([A-Za-z]+)[-_\s]/i, // Starts with champion name followed by separator
    /\b([A-Za-z]+)[-_\s](?:skin|theme|chroma)/i // Champion name before skin/theme/chroma
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const potentialChampion = match[1]
      // Check if this matches any champion
      const found = champions.find(
        (c) =>
          c.key.toLowerCase() === potentialChampion.toLowerCase() ||
          getChampionDisplayName(c).toLowerCase() === potentialChampion.toLowerCase()
      )
      if (found) {
        return found.key
      }
    }
  }

  return ''
}

// Get common variations of champion names for better matching
function getChampionVariations(championKey: string): string[] {
  const variations: Record<string, string[]> = {
    AurelionSol: ['Aurelion Sol', 'ASol', 'Aurelion'],
    Belveth: ["Bel'Veth", 'BelVeth', 'Bel Veth'],
    Chogath: ["Cho'Gath", 'ChoGath', 'Cho Gath'],
    DrMundo: ['Dr. Mundo', 'Dr Mundo', 'Mundo', 'DrMundo'],
    JarvanIV: ['Jarvan IV', 'Jarvan 4', 'J4', 'Jarvan'],
    Kaisa: ["Kai'Sa", 'KaiSa', 'Kai Sa'],
    Khazix: ["Kha'Zix", 'KhaZix', 'Kha Zix'],
    KogMaw: ["Kog'Maw", 'KogMaw', 'Kog Maw'],
    KSante: ["K'Sante", 'KSante', 'K Sante'],
    LeeSin: ['Lee Sin', 'LeeSin', 'Lee'],
    MasterYi: ['Master Yi', 'MasterYi', 'Yi'],
    MissFortune: ['Miss Fortune', 'MissFortune', 'MF'],
    MonkeyKing: ['Wukong', 'Monkey King', 'MonkeyKing'],
    Nunu: ['Nunu & Willump', 'Nunu and Willump', 'Nunu'],
    RekSai: ["Rek'Sai", 'RekSai', 'Rek Sai'],
    Renata: ['Renata Glasc', 'Renata'],
    TahmKench: ['Tahm Kench', 'TahmKench', 'Tahm'],
    TwistedFate: ['Twisted Fate', 'TwistedFate', 'TF'],
    Velkoz: ["Vel'Koz", 'VelKoz', 'Vel Koz'],
    XinZhao: ['Xin Zhao', 'XinZhao', 'Xin']
  }

  return variations[championKey] || []
}
