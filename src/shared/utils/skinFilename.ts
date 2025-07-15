export interface SkinNameInfo {
  lolSkinsName?: string
  nameEn?: string
  name: string
  chromaId?: string
  variantId?: string
}

/**
 * Generates a consistent filename for a skin or chroma
 * This function ensures the same filename is generated whether downloading or checking status
 */
export function generateSkinFilename(skin: SkinNameInfo): string {
  // Use the same priority order as the download logic
  const baseName = (skin.lolSkinsName || skin.nameEn || skin.name).replace(/:/g, '')

  if (skin.chromaId) {
    return `${baseName} ${skin.chromaId}.zip`
  }

  if (skin.variantId) {
    return `${baseName} (${skin.variantId}).zip`
  }

  return `${baseName}.zip`
}

/**
 * Extracts the base skin name without file extension or chroma ID
 */
export function extractBaseSkinName(filename: string): string {
  // Remove .zip extension
  let baseName = filename.replace(/\.zip$/i, '')

  // Remove chroma ID (numbers at the end after a space)
  baseName = baseName.replace(/\s+\d+$/, '')

  // Remove variant ID (text in parentheses at the end)
  baseName = baseName.replace(/\s+\([^)]+\)$/, '')

  return baseName
}

/**
 * Checks if two filenames represent the same skin (ignoring chroma variations)
 */
export function isSameSkin(filename1: string, filename2: string): boolean {
  return extractBaseSkinName(filename1) === extractBaseSkinName(filename2)
}

/**
 * Normalizes a skin name for comparison (removes special chars, lowercases)
 */
export function normalizeSkinName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}
