import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      pt: { translation: pt },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'pt'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      // Auto-detect: localStorage > navigator language > default
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'sarego_lang',
    },
  });

export default i18n;
