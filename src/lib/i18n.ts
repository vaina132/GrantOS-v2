import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from '@/locales/en.json'
import de from '@/locales/de.json'
import fr from '@/locales/fr.json'
import es from '@/locales/es.json'
import pt from '@/locales/pt.json'
import tr from '@/locales/tr.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

// Track keys we've already warned about so the console doesn't get
// flooded — one warning per missing (lng, key) pair is enough.
const _warnedMissingKeys = new Set<string>()

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
      fr: { translation: fr },
      es: { translation: es },
      pt: { translation: pt },
      tr: { translation: tr },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'de', 'fr', 'es', 'pt', 'tr'],
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'gl_language',
      caches: ['localStorage'],
    },
    returnNull: false,
    returnEmptyString: false,
    // Dev-only: log a warning the first time a key has to fall back from
    // the active locale to en. Helps spot translation gaps live, instead
    // of waiting for QA to catch a screen with mixed languages. Runs in
    // dev only; production stays silent so users never see noise.
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (lngs, _ns, key) => {
      if (!import.meta.env.DEV) return
      const lng = Array.isArray(lngs) ? lngs[0] : lngs
      if (!lng || lng === 'en') return // canonical, nothing to warn about
      const tag = `${lng}:${key}`
      if (_warnedMissingKeys.has(tag)) return
      _warnedMissingKeys.add(tag)
      console.warn(
        `[i18n] missing "${key}" in ${lng}.json — falling back to en. Run \`npm run check:i18n\` for the full gap report.`,
      )
    },
  })

export default i18n
