// Utility function to get the display name for a champion
// Always returns English name if available, otherwise falls back to localized name
export function getChampionDisplayName(champion: { name: string; nameEn?: string }): string {
  return champion.nameEn || champion.name
}
