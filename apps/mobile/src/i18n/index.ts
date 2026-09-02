import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { dirForLanguage, initNativeDirection, type Dir } from './direction';
import { ar } from './locales/ar';
import { en, type LocaleShape } from './locales/en';

export type AppLanguage = 'ar' | 'en';

export const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ['ar', 'en'];

function deviceLanguage(): AppLanguage {
  const tag = getLocales()[0]?.languageTag ?? 'ar';
  return tag.toLowerCase().startsWith('en') ? 'en' : 'ar';
}

const boot = deviceLanguage();

// Native RTL is decided once, from the device locale. The in-app toggle deliberately
// does NOT touch it — see `direction.ts` for why.
initNativeDirection(dirForLanguage(boot));

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: boot,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function languageDir(language: AppLanguage): Dir {
  return dirForLanguage(language);
}

export type { LocaleShape };
export default i18n;
