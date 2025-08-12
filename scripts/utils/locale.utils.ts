export function normalizeLocale(language: string): string {
  // en_US uses default in CDragon
  if (language === 'en_US') {
    return 'default'
  }
  // Convert other locales to lowercase with underscore (e.g., vi_VN -> vi_vn)
  return language.toLowerCase()
}
