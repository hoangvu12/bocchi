/**
 * Utility functions for generating and managing custom mod IDs
 */

/**
 * Simple hash function that generates a deterministic hash from a string
 * @param str - The string to hash
 * @returns A positive integer hash
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Generates a deterministic custom mod ID based on champion, skin name, and optional mod path
 * @param championKey - The champion key (e.g., "Aatrox", "Ahri")
 * @param skinName - The name of the skin
 * @param modPath - Optional path to the mod file
 * @returns A stable, URL-safe ID string
 */
export function generateCustomModId(
  championKey: string,
  skinName: string,
  modPath?: string
): string {
  // Normalize inputs to ensure consistency
  const normalizedChampion = championKey.trim().toLowerCase()
  const normalizedSkin = skinName.trim().toLowerCase()
  const normalizedPath = modPath?.trim().toLowerCase() || ''

  // Create a composite string from all inputs
  const composite = `${normalizedChampion}:${normalizedSkin}:${normalizedPath}`

  // Generate hash
  const hash = simpleHash(composite)

  // Create a URL-safe ID with a prefix to distinguish custom mods
  // Use base36 for a compact representation
  const hashStr = hash.toString(36)

  // Include first few chars of champion and skin for readability
  const champPrefix = normalizedChampion.slice(0, 3)
  const skinPrefix = normalizedSkin.replace(/[^a-z0-9]/g, '').slice(0, 4)

  return `custom_${champPrefix}_${skinPrefix}_${hashStr}`
}

/**
 * Checks if a mod ID is in the old numeric format
 * @param id - The mod ID to check
 * @returns True if the ID is in old format (custom_0, custom_Aatrox_0, etc.)
 */
export function isOldFormatCustomId(id: string): boolean {
  // Check for patterns like "custom_0", "custom_123"
  if (/^custom_\d+$/.test(id)) {
    return true
  }

  // Check for patterns like "custom_Aatrox_0", "custom_Ahri_123"
  if (/^custom_[A-Za-z]+_\d+$/.test(id)) {
    return true
  }

  return false
}

/**
 * Type guard to check if a string is a custom mod ID
 * @param id - The ID to check
 * @returns True if the ID starts with "custom_"
 */
export function isCustomModId(id: string): boolean {
  return id.startsWith('custom_')
}

/**
 * Extracts champion key from an old format custom ID
 * @param id - The old format ID (e.g., "custom_Aatrox_0")
 * @returns The champion key or null if not found
 */
export function extractChampionFromOldId(id: string): string | null {
  const match = id.match(/^custom_([A-Za-z]+)_\d+$/)
  return match ? match[1] : null
}
