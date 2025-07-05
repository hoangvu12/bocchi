import React, { useState, useRef, useEffect } from 'react'
import { Champion, Skin } from '../App'
import { SelectedSkin, type Chroma } from '../store/atoms'
import { Button } from './ui/button'

interface ChromaDropdownProps {
  champion: Champion
  skin: Skin
  chromas: Chroma[]
  selectedSkins: SelectedSkin[]
  onChromaSelect: (champion: Champion, skin: Skin, chromaId: string) => void
  isDownloaded: (chromaId: string) => boolean
}

export const ChromaDropdown: React.FC<ChromaDropdownProps> = ({
  champion,
  skin,
  chromas,
  selectedSkins,
  onChromaSelect,
  isDownloaded
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isChromaSelected = (chromaId: number) => {
    return selectedSkins.some(
      (s) =>
        s.championKey === champion.key && s.skinId === skin.id && s.chromaId === chromaId.toString()
    )
  }

  const selectedChromaCount = chromas.filter((chroma) => isChromaSelected(chroma.id)).length

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="secondary"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className={`gap-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/40 transition-all duration-200 ${
          isOpen ? 'ring-2 ring-purple-500 dark:ring-purple-400' : ''
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
        <span className="text-sm font-medium">Chromas</span>
        {selectedChromaCount > 0 && (
          <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-semibold">
            {selectedChromaCount}
          </span>
        )}
        <svg
          className={`w-4 h-4 transition-transform ml-auto ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-96 bg-surface rounded-xl shadow-2xl dark:shadow-dark-2xl border border-border z-50 overflow-hidden">
          <div className="p-4 border-b border-border">
            <h4 className="text-base font-semibold text-text-primary">Select Chromas</h4>
            <p className="text-sm text-text-secondary mt-1">
              {chromas.length} chroma{chromas.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-border dark:scrollbar-thumb-border">
            {chromas.map((chroma) => {
              const isSelected = isChromaSelected(chroma.id)
              const downloaded = isDownloaded(chroma.id.toString())

              return (
                <div
                  key={chroma.id}
                  className={`flex items-center gap-4 p-4 hover:bg-secondary-100 dark:hover:bg-secondary-800 cursor-pointer transition-all duration-200 ${
                    isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChromaSelect(champion, skin, chroma.id.toString())
                  }}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={chroma.chromaPath}
                      alt={chroma.name}
                      className="w-16 h-16 rounded-lg object-cover shadow-sm"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback to a colored div if image fails to load
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const colorDiv = target.nextElementSibling as HTMLDivElement
                        if (colorDiv) colorDiv.style.display = 'flex'
                      }}
                    />
                    <div
                      className="w-16 h-16 rounded-lg hidden items-center justify-center text-sm font-bold text-white shadow-sm"
                      style={{
                        backgroundColor: chroma.colors?.[0] || '#666',
                        display: 'none'
                      }}
                    >
                      {chroma.id}
                    </div>
                    {isSelected && (
                      <div className="absolute inset-0 bg-purple-600 bg-opacity-50 rounded-lg flex items-center justify-center">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                          <svg
                            className="w-5 h-5 text-purple-600"
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
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{chroma.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">ID: {chroma.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {downloaded && (
                      <span
                        className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center"
                        title="Downloaded"
                      >
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                    )}
                    {!isSelected && (
                      <button
                        className="w-7 h-7 rounded-full border-2 border-border hover:border-purple-500 dark:hover:border-purple-400 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          onChromaSelect(champion, skin, chroma.id.toString())
                        }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="p-3 border-t border-border">
            <button
              className="w-full py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800"
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(false)
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
