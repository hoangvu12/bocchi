import React from 'react'
import { useLocale } from '../contexts/useLocale'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu'

export const LanguageSwitcher: React.FC = () => {
  const { currentLanguage, setLanguage, languages } = useLocale()

  const currentLang = languages.find((lang) => lang.code === currentLanguage)

  const handleLanguageChange = async (langCode: (typeof languages)[number]['code']) => {
    await setLanguage(langCode)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5 px-3 py-1.5 h-auto"
          aria-label="Select language"
        >
          <span className="text-base">{currentLang?.flag}</span>
          <span className="text-xs font-medium uppercase">{currentLang?.code.split('_')[0]}</span>
          <svg
            className="w-2.5 h-2.5 transition-transform"
            width="10"
            height="6"
            viewBox="0 0 10 6"
          >
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 bg-white dark:bg-charcoal-800 border-charcoal-200 dark:border-charcoal-700"
      >
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            className={`flex items-center gap-3 cursor-pointer ${
              lang.code === currentLanguage
                ? 'bg-terracotta-500 text-white font-medium focus:bg-terracotta-600 focus:text-white'
                : 'text-charcoal-700 dark:text-charcoal-200 hover:bg-cream-100 dark:hover:bg-charcoal-700'
            }`}
            onClick={() => handleLanguageChange(lang.code)}
          >
            <span className="text-base">{lang.flag}</span>
            <span className={lang.code === currentLanguage ? 'font-medium' : ''}>{lang.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
