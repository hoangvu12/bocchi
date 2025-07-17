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
        // Try to detect Windows system language first
        try {
          const systemLocaleResult = await window.api.getSystemLocale?.()
          if (systemLocaleResult?.success && systemLocaleResult.locale) {
            // Convert locale format (e.g., 'en-US' to 'en_US', 'ar-AE' to 'ar_AE')
            const normalizedLocale = systemLocaleResult.locale.replace('-', '_')

            // First try exact match
            let matchedLang = supportedLanguages.find((lang) => lang.code === normalizedLocale)

            // If no exact match, try language family match (e.g., 'en' matches 'en_US')
            if (!matchedLang) {
              const languageCode = normalizedLocale.split('_')[0]
              matchedLang = supportedLanguages.find((lang) => lang.code.startsWith(languageCode))
            }

            if (matchedLang) {
              console.log(
                `Detected Windows system language: ${systemLocaleResult.locale} -> ${matchedLang.code}`
              )
              setCurrentLanguage(matchedLang.code)
              await i18n.changeLanguage(matchedLang.code)
              return
            }
          }
        } catch (error) {
          console.warn('Failed to detect Windows system language:', error)
        }

        // Fallback to browser language detection
        const systemLang = navigator.language.replace('-', '_')
        const matchedLang = supportedLanguages.find((lang) =>
          lang.code.startsWith(systemLang.split('_')[0])
        )
        if (matchedLang) {
          console.log(`Detected browser language: ${navigator.language} -> ${matchedLang.code}`)
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
