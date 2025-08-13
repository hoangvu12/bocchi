import { atom } from 'jotai'

export interface DownloadedSkin {
  championName: string
  skinName: string
  url: string
  localPath?: string
  author?: string // Author for custom/user mods
}

// Downloaded skins atom
export const downloadedSkinsAtom = atom<DownloadedSkin[]>([])

// Favorites atom
export const favoritesAtom = atom<Set<string>>(new Set<string>())
