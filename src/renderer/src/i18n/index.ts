import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enUS from '../locales/en_US/translation.json'
import viVN from '../locales/vi_VN/translation.json'
import esAR from '../locales/es_AR/translation.json'
import jaJP from '../locales/ja_JP/translation.json'
import koKR from '../locales/ko_KR/translation.json'
import zhCN from '../locales/zh_CN/translation.json'
import ruRU from '../locales/ru_RU/translation.json'

export const supportedLanguages = [
  { code: 'en_US', name: 'English', flag: '🇺🇸' },
  { code: 'vi_VN', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'es_AR', name: 'Español (Argentina)', flag: '🇦🇷' },
  { code: 'ja_JP', name: '日本語', flag: '🇯🇵' },
  { code: 'ko_KR', name: '한국어', flag: '🇰🇷' },
  { code: 'zh_CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'ru_RU', name: 'Русский', flag: '🇷🇺' }
] as const

export type LanguageCode = (typeof supportedLanguages)[number]['code']

const resources = {
  en_US: {
    translation: enUS
  },
  vi_VN: {
    translation: viVN
  },
  es_AR: {
    translation: esAR
  },
  ja_JP: {
    translation: jaJP
  },
  ko_KR: {
    translation: koKR
  },
  zh_CN: {
    translation: zhCN
  },
  ru_RU: {
    translation: ruRU
  }
}

// Initialize i18n
i18n.use(initReactI18next).init({
  resources,
  lng: 'en_US',
  fallbackLng: 'en_US',
  debug: false,

  interpolation: {
    escapeValue: false
  },

  react: {
    useSuspense: false
  }
})

export default i18n
