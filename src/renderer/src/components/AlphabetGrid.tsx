import React, { useEffect, useRef } from 'react'
import { cn } from '../lib/utils'

interface AlphabetGridProps {
  availableLetters: Set<string>
  onLetterClick: (letter: string) => void
  onClose: () => void
  className?: string
}

export const AlphabetGrid: React.FC<AlphabetGridProps> = ({
  availableLetters,
  onLetterClick,
  onClose,
  className
}) => {
  const gridRef = useRef<HTMLDivElement>(null)
  // Use standard A-Z alphabet for consistent navigation across all languages
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (gridRef.current && !gridRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div
      ref={gridRef}
      className={cn(
        'bg-surface border-2 border-border rounded-xl shadow-xl dark:shadow-dark-large p-4',
        'grid grid-cols-6 gap-2',
        'min-w-[280px]',
        className
      )}
    >
      {alphabet.map((letter) => {
        const isAvailable = availableLetters.has(letter)
        return (
          <button
            key={letter}
            onClick={() => {
              if (isAvailable) {
                onLetterClick(letter)
                onClose()
              }
            }}
            disabled={!isAvailable}
            className={cn(
              'w-10 h-10 text-sm font-semibold rounded-lg transition-all duration-150',
              'flex items-center justify-center',
              isAvailable
                ? 'bg-secondary-100 dark:bg-secondary-800 text-text-primary hover:bg-primary-500 hover:text-white cursor-pointer transform hover:scale-110'
                : 'bg-secondary-50 dark:bg-secondary-900 text-text-disabled cursor-not-allowed opacity-50'
            )}
            title={isAvailable ? `Jump to ${letter}` : `No champions starting with ${letter}`}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}
