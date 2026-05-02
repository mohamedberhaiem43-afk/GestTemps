import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import frTranslation from './locales/fr/translation.json';
import arTranslation from './locales/ar/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      fr: { translation: frTranslation },
      ar: { translation: arTranslation }
    },
    // Français par défaut au premier chargement : on ignore la langue du navigateur
    // et on ne consulte que localStorage. Sans choix mémorisé → fallback sur 'fr'.
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en', 'ar'],
    nonExplicitSupportedLngs: false,
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage']
    },
    debug: false,
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
