import React, { useState, useEffect, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageCode, supportedLanguages } from '../i18n'
import { LocaleContext } from './LocaleContext'

interface LocaleProviderProps {
  children: ReactNode
}

export const LocaleProvider: React.FC<LocaleProviderProps> = ({ children }) => {
  const { i18n } = useTranslation()
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en_US')

  // Load saved language on mount
  useEffect(() => {
    const loadSavedLanguage = async () => {
      const savedLang = await window.api.getSettings?.('language')
      if (savedLang && supportedLanguages.some((lang) => lang.code === savedLang)) {
        setCurrentLanguage(savedLang as LanguageCode)
        await i18n.changeLanguage(savedLang)
      } else {
        // Try to detect system language
        const systemLang = navigator.language.replace('-', '_')
        const matchedLang = supportedLanguages.find((lang) =>
          lang.code.startsWith(systemLang.split('_')[0])
        )
        if (matchedLang) {
          setCurrentLanguage(matchedLang.code)
          await i18n.changeLanguage(matchedLang.code)
        }
      }
    }

    loadSavedLanguage()
  }, [i18n])

  // Listen for language changes from tray
  useEffect(() => {
    const unsubscribe = window.api.onLanguageChanged?.((language: string) => {
      if (supportedLanguages.some((lang) => lang.code === language)) {
        setCurrentLanguage(language as LanguageCode)
        i18n.changeLanguage(language)
      }
    })

    return () => {
      unsubscribe?.()
    }
  }, [i18n])

  const setLanguage = async (lang: LanguageCode) => {
    setCurrentLanguage(lang)
    await i18n.changeLanguage(lang)
    await window.api.setSettings?.('language', lang)
  }

  return (
    <LocaleContext.Provider
      value={{
        currentLanguage,
        setLanguage,
        languages: supportedLanguages
      }}
    >
      {children}
    </LocaleContext.Provider>
  )
}
