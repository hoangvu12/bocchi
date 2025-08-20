import React from 'react'
import { cn } from '../lib/utils'

interface AlphabetNavigationProps {
  availableLetters: Set<string>
  currentLetter?: string
  onLetterClick: (letter: string) => void
  className?: string
}

export const AlphabetNavigation: React.FC<AlphabetNavigationProps> = ({
  availableLetters,
  currentLetter,
  onLetterClick,
  className
}) => {
  // Use standard A-Z alphabet for consistent navigation across all languages
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 bg-surface/80 backdrop-blur-sm rounded-lg p-1',
        className
      )}
    >
      {alphabet.map((letter) => {
        const isAvailable = availableLetters.has(letter)
        const isCurrent = currentLetter === letter

        return (
          <button
            key={letter}
            onClick={() => isAvailable && onLetterClick(letter)}
            disabled={!isAvailable}
            className={cn(
              'w-6 h-5 text-xs font-medium rounded transition-all duration-150',
              'flex items-center justify-center',
              isAvailable
                ? 'text-text-primary hover:bg-secondary-200 dark:hover:bg-secondary-700 cursor-pointer'
                : 'text-text-disabled cursor-not-allowed opacity-40',
              isCurrent && isAvailable && 'bg-primary-500 text-white hover:bg-primary-600'
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
