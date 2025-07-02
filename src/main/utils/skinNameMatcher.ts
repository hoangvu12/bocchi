interface LolSkinInfo {
  championName: string
  skinName: string
  fileName: string
}

// Levenshtein distance algorithm for string similarity
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}

// Calculate similarity score (0-1, where 1 is identical)
function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 1
  const distance = levenshteinDistance(str1, str2)
  return 1 - distance / maxLen
}

// Normalize skin names for comparison
function normalizeSkinName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '') // Remove apostrophes
    .replace(/\s+/g, '') // Remove spaces
    .replace(/\./g, '') // Remove dots
    .replace(/-/g, '') // Remove hyphens
    .replace(/[()]/g, '') // Remove parentheses
    .replace(/:/g, '') // Remove colons
}

// Parse directory structure text into a Map
function parseDirectoryStructure(directoryText: string): Map<string, LolSkinInfo[]> {
  const skinsMap = new Map<string, LolSkinInfo[]>()
  const lines = directoryText.split('\n')

  let currentChampion = ''

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue

    // More flexible pattern - look for any line with indentation followed by text
    // Check if this is a champion folder (ends with /)
    const championMatch = line.match(/^\s*[│├└─\s]*([^/│├└─]+)\/\s*$/)
    if (championMatch) {
      currentChampion = championMatch[1].trim()
      skinsMap.set(currentChampion, [])
      continue
    }

    // Check if this is a skin file (ends with .zip)
    const skinMatch = line.match(/^\s*[│├└─\s]*(.+\.zip)\s*$/)
    if (skinMatch && currentChampion) {
      const fileName = skinMatch[1].trim()
      const skinName = fileName.slice(0, -4) // Remove .zip extension

      const skins = skinsMap.get(currentChampion) || []
      skins.push({
        championName: currentChampion,
        skinName: skinName,
        fileName: fileName
      })
      skinsMap.set(currentChampion, skins)
    }
  }

  return skinsMap
}

// Cache for lol-skins data
let cachedLolSkinsData: Map<string, LolSkinInfo[]> | null = null

// Initialize with hardcoded directory structure
export function initializeLolSkinsData(directoryStructure: string): void {
  console.log('Parsing directory structure...')
  console.log('First 200 chars:', directoryStructure.substring(0, 200))
  cachedLolSkinsData = parseDirectoryStructure(directoryStructure)
  console.log(`Initialized lol-skins data with ${cachedLolSkinsData.size} champions`)

  // Debug: Show first champion if any
  if (cachedLolSkinsData.size > 0) {
    const firstEntry = Array.from(cachedLolSkinsData.entries())[0]
    console.log(`First champion: ${firstEntry[0]} with ${firstEntry[1].length} skins`)
  }
}

// Get all lol-skins data
export function fetchAllLolSkinsData(): Map<string, LolSkinInfo[]> {
  if (!cachedLolSkinsData) {
    console.warn('Lol-skins data not initialized. Please call initializeLolSkinsData() first.')
    return new Map()
  }
  return cachedLolSkinsData
}

// Find best matching skin name from lol-skins
export function findBestSkinMatch(
  ddragonSkinName: string,
  lolSkinsList: LolSkinInfo[]
): { skinInfo: LolSkinInfo; similarity: number } | null {
  const normalizedDDragon = normalizeSkinName(ddragonSkinName)
  let bestMatch: { skinInfo: LolSkinInfo; similarity: number } | null = null

  for (const skinInfo of lolSkinsList) {
    const normalizedLolSkin = normalizeSkinName(skinInfo.skinName)
    const similarity = calculateSimilarity(normalizedDDragon, normalizedLolSkin)

    // Also check if one contains the other
    const containsSimilarity =
      normalizedDDragon.includes(normalizedLolSkin) || normalizedLolSkin.includes(normalizedDDragon)
        ? 0.8
        : 0

    const finalSimilarity = Math.max(similarity, containsSimilarity)

    if (!bestMatch || finalSimilarity > bestMatch.similarity) {
      bestMatch = { skinInfo, similarity: finalSimilarity }
    }
  }

  // Only return if similarity is above threshold
  return bestMatch && bestMatch.similarity > 0.7 ? bestMatch : null
}

// Find matching champion folder name (case-insensitive)
export function findChampionFolder(championName: string, folderNames: string[]): string | null {
  // First try exact match (case-insensitive)
  const exactMatch = folderNames.find(
    (folder) => folder.toLowerCase() === championName.toLowerCase()
  )
  if (exactMatch) return exactMatch

  // Then try normalized match
  const normalizedChampion = normalizeSkinName(championName)
  for (const folder of folderNames) {
    const normalizedFolder = normalizeSkinName(folder)
    if (normalizedChampion === normalizedFolder) {
      return folder
    }
  }

  // Finally try similarity match
  let bestMatch = { folder: '', similarity: 0 }
  for (const folder of folderNames) {
    const similarity = calculateSimilarity(
      normalizeSkinName(championName),
      normalizeSkinName(folder)
    )
    if (similarity > bestMatch.similarity) {
      bestMatch = { folder, similarity }
    }
  }

  return bestMatch.similarity > 0.8 ? bestMatch.folder : null
}
