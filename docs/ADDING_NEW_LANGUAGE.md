# Adding a New Language to Bocchi

This guide explains how to add a new language to the Bocchi application, covering both UI translations and champion data localization.

## Overview

Bocchi uses [i18next](https://www.i18next.com/) for internationalization and supports multiple languages for:

- **UI translations**: All interface text, buttons, messages, etc.
- **Champion data**: Champion names, skin names, and descriptions from League of Legends

Currently supported languages:

- English (US) - `en_US`
- Vietnamese - `vi_VN`
- Spanish (Argentina) - `es_AR`

## Language Code Format

Use the format `language_COUNTRY` (e.g., `en_US`, `pt_BR`, `zh_CN`) following the locale standard with underscore separator.

## Steps to Add a New Language

### 1. Create Translation Files

Create a new directory for your language in the renderer locales folder:

```
src/renderer/src/locales/[language_code]/translation.json
```

For example, to add Brazilian Portuguese:

```
src/renderer/src/locales/pt_BR/translation.json
```

Copy the English translation file as a template:

```bash
cp src/renderer/src/locales/en_US/translation.json src/renderer/src/locales/pt_BR/translation.json
```

### 2. Translate the UI Strings

Edit the new `translation.json` file and translate all values (keep the keys in English):

```json
{
  "app": {
    "title": "CSLOL Skin Launcher",
    "loading": "Carregando...",
    "ready": "Pronto"
  },
  "actions": {
    "browse": "Navegar",
    "download": "Baixar",
    "update": "Atualizar",
    "apply": "Aplicar",
    "stop": "Parar"
    // ... translate all entries
  }
}
```

### 3. Update i18n Configuration

Edit `src/renderer/src/i18n/index.ts`:

1. Import the new translation file:

```typescript
import ptBR from '../locales/pt_BR/translation.json'
```

2. Add the language to `supportedLanguages` array:

```typescript
export const supportedLanguages = [
  { code: 'en_US', name: 'English', flag: '🇺🇸' },
  { code: 'vi_VN', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'es_AR', name: 'Español (Argentina)', flag: '🇦🇷' },
  { code: 'pt_BR', name: 'Português (Brasil)', flag: '🇧🇷' } // Add this
] as const
```

3. Add the translation resources:

```typescript
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
  pt_BR: {
    // Add this
    translation: ptBR
  }
}
```

### 4. Update Champion Data Service

Edit `src/main/services/championDataService.ts` to add your language to the supported languages array:

```typescript
private supportedLanguages = ['en_US', 'vi_VN', 'es_AR', 'pt_BR']  // Add your language
```

### 5. Update Data Fetching Script

Edit `scripts/fetch-champion-data.ts` to include your language:

```typescript
const SUPPORTED_LANGUAGES = ['en_US', 'vi_VN', 'es_AR', 'pt_BR'] // Add your language
```

## Translation File Structure

The translation file follows a nested JSON structure organized by feature areas:

```json
{
  "app": {
    // General application strings
  },
  "actions": {
    // Common action buttons and verbs
  },
  "nav": {
    // Navigation menu items
  },
  "champion": {
    // Champion-related UI text
  },
  "skin": {
    // Skin-related UI text
  },
  "settings": {
    // Settings page text
  },
  "status": {
    // Status messages
  },
  "errors": {
    // Error messages
  },
  "dialogs": {
    // Dialog titles and content
  },
  "tooltips": {
    // Tooltip text
  },
  "updateDialog": {
    // Auto-update dialog text
  },
  "toolsDownload": {
    // Tools download dialog text
  },
  "p2pSync": {
    // P2P synchronization text
  }
}
```

## Champion Data Localization

Champion data (names, skin names) is fetched from Riot's Data Dragon API, which supports multiple languages. When a user selects a language:

1. The app fetches champion data in that language from Data Dragon
2. English names are preserved as `nameEn` for skin downloading purposes
3. The data is cached locally for offline use

The champion data includes:

- Champion names and titles
- Skin names
- Champion tags/roles

## Language Selection Behavior

1. **First Launch**: The app attempts to detect the system language and match it to a supported language
2. **User Selection**: When a user changes the language via the language switcher, it's saved to settings
3. **Persistence**: The selected language persists across app restarts
4. **Data Refresh**: Changing language triggers a refresh of champion data in the new language

## Testing Your Translation

1. **Build and run the app**:

   ```bash
   pnpm install
   pnpm run dev
   ```

2. **Test language switching**:
   - Click the language switcher in the top-right corner
   - Select your new language
   - Verify all UI elements are translated

3. **Test champion data**:
   - Check that champion and skin names appear in your language
   - Verify the data download works for your language

4. **Test persistence**:
   - Restart the app
   - Confirm the language selection is maintained

## Translation Guidelines

1. **Consistency**: Use consistent terminology throughout the translation
2. **Context**: Consider the UI context - button text should be concise
3. **Technical Terms**: Some gaming/technical terms may not need translation
4. **Placeholders**: Preserve any placeholders like `{{name}}` or `{{count}}`
5. **Special Characters**: Ensure proper encoding for special characters in your language

## Common Issues

### Champion Data Not Loading

- Verify your language code is added to `supportedLanguages` in the champion data service
- Check if Riot's Data Dragon supports your language (not all languages are available)
- Ensure the language code format matches exactly (case-sensitive)

### UI Not Updating

- Clear the app cache and restart
- Verify the translation file is valid JSON
- Check browser console for i18n errors

### Flag Emoji Not Displaying

- Use the correct country flag emoji for your locale
- Some systems may not support all flag emojis

## Contributing Your Translation

1. Fork the repository
2. Create a branch: `add-[language_code]-translation`
3. Follow all steps above
4. Test thoroughly
5. Submit a pull request with:
   - Description of the language added
   - Screenshots showing the UI in the new language
   - Confirmation that all features work correctly

## For LLM Assistance

When helping contributors add a new language, key files to modify:

1. **Create translation file**: `src/renderer/src/locales/[language_code]/translation.json`
2. **Update i18n config**: `src/renderer/src/i18n/index.ts`
3. **Update services**: `src/main/services/championDataService.ts`
4. **Update scripts**: `scripts/fetch-champion-data.ts`

The language code must be consistent across all files and follow the `language_COUNTRY` format.

## Maintenance

When new features are added to the app:

1. Add new translation keys to all language files
2. Use English as fallback for missing translations
3. Notify translators of new strings needed

## Resources

- [i18next Documentation](https://www.i18next.com/)
- [League of Legends Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon)
- [Locale Codes Reference](https://www.science.co.il/language/Locale-codes.php)
