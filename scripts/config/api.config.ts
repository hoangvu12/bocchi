export const API_CONFIG = {
  DDRAGON_BASE_URL: 'https://ddragon.leagueoflegends.com',
  CDRAGON_BASE_URL:
    'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1',
  CONCURRENT_REQUESTS: 10,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  VERSION_CACHE_DURATION: 3600000 // 1 hour
} as const

export const SUPPORTED_LANGUAGES = [
  'en_US',
  'en_AU',
  'en_GB',
  'en_PH',
  'en_SG',
  'vi_VN',
  'es_AR',
  'es_ES',
  'es_MX',
  'ja_JP',
  'ko_KR',
  'zh_CN',
  'ru_RU',
  'ar_AE',
  'pt_BR',
  'id_ID',
  'th_TH',
  'zh_MY',
  'zh_TW',
  'cs_CZ',
  'de_DE',
  'el_GR',
  'fr_FR',
  'hu_HU',
  'it_IT',
  'pl_PL',
  'ro_RO',
  'tr_TR'
] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]
