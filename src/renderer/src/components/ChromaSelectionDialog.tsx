import React from 'react'
import { Champion, Skin } from '../App'
import { type Chroma, type SelectedSkin } from '../store/atoms'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'

interface ChromaSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  champion: Champion
  skin: Skin
  chromas: Chroma[]
  selectedSkins: SelectedSkin[]
  downloadedSkins: Array<{ championName: string; skinName: string; localPath?: string }>
  onChromaSelect: (champion: Champion, skin: Skin, chromaId: string) => void
}

export const ChromaSelectionDialog: React.FC<ChromaSelectionDialogProps> = ({
  open,
  onOpenChange,
  champion,
  skin,
  chromas,
  selectedSkins,
  downloadedSkins,
  onChromaSelect
}) => {
  const isChromaSelected = (chromaId: number) => {
    return selectedSkins.some(
      (s) =>
        s.championKey === champion.key && s.skinId === skin.id && s.chromaId === chromaId.toString()
    )
  }

  const isChromaDownloaded = (chromaId: string) => {
    const chromaFileName =
      `${skin.lolSkinsName || skin.nameEn || skin.name} ${chromaId}.zip`.replace(/:/g, '')
    return downloadedSkins.some(
      (ds) => ds.championName === champion.key && ds.skinName === chromaFileName
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Chroma for {skin.name}</DialogTitle>
          <DialogDescription>
            Choose from {chromas.length} available chroma{chromas.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-2 p-1">
            {chromas.map((chroma) => {
              const isSelected = isChromaSelected(chroma.id)
              const isDownloaded = isChromaDownloaded(chroma.id.toString())

              return (
                <div
                  key={chroma.id}
                  className={`relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all overflow-hidden ${
                    isSelected
                      ? 'bg-terracotta-50 dark:bg-terracotta-900/20 border-2 border-terracotta-500'
                      : 'bg-white dark:bg-charcoal-800 border-2 border-charcoal-200 dark:border-charcoal-700 hover:border-terracotta-400 hover:bg-charcoal-50 dark:hover:bg-charcoal-700'
                  }`}
                  onClick={() => {
                    onChromaSelect(champion, skin, chroma.id.toString())
                    onOpenChange(false)
                  }}
                >
                  {chroma.colors && chroma.colors.length > 0 && (
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ backgroundColor: chroma.colors[0] }}
                      title={`Color: ${chroma.colors[0]}`}
                    />
                  )}
                  <img
                    src={chroma.chromaPath}
                    alt={chroma.name}
                    className="w-16 h-16 rounded-lg object-cover ml-2"
                    loading="lazy"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-charcoal-900 dark:text-charcoal-100">
                      {chroma.name}
                    </p>
                    <p className="text-xs text-charcoal-500 dark:text-charcoal-400 mt-1">
                      ID: {chroma.id}
                    </p>
                  </div>
                  {isSelected && (
                    <svg
                      className="w-5 h-5 text-terracotta-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  {isDownloaded && !isSelected && (
                    <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                      <span className="text-white text-xs">↓</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
