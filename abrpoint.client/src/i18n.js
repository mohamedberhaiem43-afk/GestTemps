import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import frTranslation from './locales/fr/translation.json';
// 2026-05-27 — Traduction arabe MASQUÉE : couverture ~3% (140/4500 clés), fallback
// vers le français généralisé qui produisait une UI moitié-arabe moitié-français,
// pire que ne pas proposer la langue du tout. À réactiver quand AR sera ≥95%
// complète (cf. locales/ar/translation.json). Le ressource bundle reste chargé
// pour ne pas perdre les clés déjà traduites — seul le LanguageSwitcher masque
// l'option côté UI.
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
    // 'ar' retiré de supportedLngs (2026-05-27) : si un utilisateur a 'ar' en
    // localStorage hérité d'un ancien choix, i18next fall-back sur 'fr' à l'init.
    supportedLngs: ['fr', 'en'],
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
