export function buildChampionNameLookup(championFolders: string[]): Map<string, string> {
  const lookup = new Map<string, string>()

  championFolders.forEach((folder) => {
    // Original name
    lookup.set(folder.toLowerCase(), folder)

    // Without spaces
    const noSpaces = folder.replace(/\s+/g, '')
    lookup.set(noSpaces.toLowerCase(), folder)

    // With underscores
    const underscores = folder.replace(/\s+/g, '_')
    lookup.set(underscores.toLowerCase(), folder)

    // Common variations
    if (folder === "Kai'Sa") {
      lookup.set('kaisa', folder)
      lookup.set('kai sa', folder)
    }
    if (folder === "Cho'Gath") {
      lookup.set('chogath', folder)
      lookup.set('cho gath', folder)
    }
    if (folder === 'Wukong') {
      lookup.set('monkeyking', folder) // CDragon uses MonkeyKing as alias
    }
    // Add more special cases as needed
  })

  return lookup
}
