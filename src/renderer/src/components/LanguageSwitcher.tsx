import React, { useState, useMemo } from 'react'
import { useLocale } from '../contexts/useLocale'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from './ui/dropdown-menu'
import { Search, Globe, ChevronDown } from 'lucide-react'

export const LanguageSwitcher: React.FC = () => {
  const { currentLanguage, setLanguage, languages } = useLocale()
  const [searchQuery, setSearchQuery] = useState('')

  const currentLang = languages.find((lang) => lang.code === currentLanguage)

  const handleLanguageChange = async (langCode: (typeof languages)[number]['code']) => {
    await setLanguage(langCode)
    setSearchQuery('') // Clear search after selection
  }

  // Group languages by category
  const groupedLanguages = useMemo(() => {
    const filtered = languages.filter(
      (lang) =>
        lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.code.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const groups = {
      english: filtered.filter((lang) => lang.code.startsWith('en_')),
      spanish: filtered.filter((lang) => lang.code.startsWith('es_')),
      chinese: filtered.filter((lang) => lang.code.startsWith('zh_')),
      european: filtered.filter((lang) =>
        [
          'de_DE',
          'fr_FR',
          'it_IT',
          'pl_PL',
          'cs_CZ',
          'hu_HU',
          'ro_RO',
          'el_GR',
          'tr_TR',
          'pt_BR'
        ].includes(lang.code)
      ),
      asian: filtered.filter((lang) =>
        ['ja_JP', 'ko_KR', 'vi_VN', 'th_TH', 'id_ID'].includes(lang.code)
      ),
      arabic: filtered.filter((lang) => lang.code === 'ar_AE'),
      russian: filtered.filter((lang) => lang.code === 'ru_RU')
    }

    // Remove empty groups and languages already in groups
    const categorized = new Set()
    Object.values(groups).forEach((group) => group.forEach((lang) => categorized.add(lang.code)))

    const other = filtered.filter((lang) => !categorized.has(lang.code))

    return { ...groups, other }
  }, [languages, searchQuery])

  const renderLanguageGroup = (
    title: string,
    langs: (typeof languages)[number][],
    showSeparator = true
  ) => {
    if (langs.length === 0) return null

    return (
      <React.Fragment key={title}>
        {showSeparator && <DropdownMenuSeparator />}
        <DropdownMenuLabel className="text-xs font-medium text-text-secondary px-2 py-1">
          {title}
        </DropdownMenuLabel>
        {langs.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            className={`relative flex items-center gap-2 cursor-pointer px-2 py-1.5 ${
              lang.code === currentLanguage
                ? 'bg-primary-500 text-white focus:bg-primary-600 focus:text-white'
                : 'text-text-primary hover:bg-secondary-100 dark:hover:bg-secondary-800'
            }`}
            onClick={() => handleLanguageChange(lang.code)}
          >
            <span className="text-sm w-4 flex-shrink-0">{lang.flag}</span>
            <div className="min-w-0 flex-1 overflow-hidden mr-2">
              <span className="text-sm truncate block">{lang.name}</span>
            </div>
            {lang.code === currentLanguage && (
              <div className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 absolute right-2" />
            )}
          </DropdownMenuItem>
        ))}
      </React.Fragment>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 px-3 py-2 h-auto max-w-[160px] justify-between"
          aria-label="Select language"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 flex-shrink-0" />
            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs font-medium leading-none truncate max-w-[100px]">
                {currentLang?.name || 'Language'}
              </span>
              <span className="text-xs opacity-60 leading-none">
                {currentLang?.flag} {currentLang?.code.split('_')[0].toUpperCase()}
              </span>
            </div>
          </div>
          <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-surface border-border max-h-96 overflow-x-hidden overflow-y-auto"
        sideOffset={4}
      >
        {/* Search Input */}
        <div className="relative px-2 py-2 border-b border-border overflow-hidden">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 text-sm bg-transparent border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Language Groups */}
        <div className="max-h-80 overflow-y-auto overflow-x-hidden">
          {searchQuery ? (
            // Show filtered results without grouping when searching
            <>
              {Object.values(groupedLanguages).flat().length === 0 ? (
                <div className="px-3 py-4 text-sm text-text-secondary text-center">
                  No languages found
                </div>
              ) : (
                Object.values(groupedLanguages)
                  .flat()
                  .map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      className={`relative flex items-center gap-2 cursor-pointer px-2 py-1.5 ${
                        lang.code === currentLanguage
                          ? 'bg-primary-500 text-white focus:bg-primary-600 focus:text-white'
                          : 'text-text-primary hover:bg-secondary-100 dark:hover:bg-secondary-800'
                      }`}
                      onClick={() => handleLanguageChange(lang.code)}
                    >
                      <span className="text-sm w-4 flex-shrink-0">{lang.flag}</span>
                      <div className="min-w-0 flex-1 overflow-hidden mr-2">
                        <span className="text-sm truncate block">{lang.name}</span>
                      </div>
                      {lang.code === currentLanguage && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 absolute right-2" />
                      )}
                    </DropdownMenuItem>
                  ))
              )}
            </>
          ) : (
            // Show grouped languages when not searching
            <>
              {renderLanguageGroup('English Variants', groupedLanguages.english, false)}
              {renderLanguageGroup('Spanish Variants', groupedLanguages.spanish)}
              {renderLanguageGroup('Chinese Variants', groupedLanguages.chinese)}
              {renderLanguageGroup('European Languages', groupedLanguages.european)}
              {renderLanguageGroup('Asian Languages', groupedLanguages.asian)}
              {renderLanguageGroup('Arabic', groupedLanguages.arabic)}
              {renderLanguageGroup('Russian', groupedLanguages.russian)}
              {renderLanguageGroup('Other', groupedLanguages.other)}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
