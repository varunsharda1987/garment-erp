/**
 * i18n Configuration
 *
 * Internationalization setup using i18next and react-i18next.
 * Supports multiple languages with automatic browser detection.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from './locales/en/common.json';
import enNavigation from './locales/en/navigation.json';
import enForms from './locales/en/forms.json';
import enMessages from './locales/en/messages.json';

// Define available languages
export const supportedLanguages = ['en'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

// Resources structure
const resources = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    forms: enForms,
    messages: enMessages,
  },
};

// Default namespace
export const defaultNS = 'common';

// All namespaces
export const namespaces = ['common', 'navigation', 'forms', 'messages'] as const;

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS,
    ns: namespaces,

    // Detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },

    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes by default
    },

    // React options
    react: {
      useSuspense: true,
    },
  });

export default i18n;

// Helper to change language
export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
}

// Helper to get current language
export function getCurrentLanguage(): string {
  return i18n.language;
}
