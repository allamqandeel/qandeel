import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { languageDir, type AppLanguage } from '../i18n';
import { nativeRtlMatches, type Dir } from '../i18n/direction';
import { layoutDirection, type LayoutDirection } from './layoutDirection';
import { readReviewParams } from './reviewParams';

interface DirectionValue {
  language: AppLanguage;
  dir: Dir;
  isRTL: boolean;
  /** Direction-relative style values, already reconciled with the native layout flag. */
  layout: LayoutDirection;
  /** Whether `I18nManager` currently agrees with the selected language. */
  nativeMatches: boolean;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
}

const DirectionContext = createContext<DirectionValue | null>(null);

/**
 * Layout direction is carried in React state, not read from `I18nManager` at render time.
 *
 * `I18nManager.forceRTL` only takes effect after a full native restart, so a toggle built
 * on it would appear to do nothing until the app is killed — useless for a spike whose
 * whole point is comparing the two directions side by side. Native RTL is still set once
 * at boot from the device locale (see `i18n/direction.ts`), and `nativeMatches` reports
 * honestly when the two disagree instead of hiding it.
 */
export function DirectionProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<AppLanguage>(
    readReviewParams().language ?? (i18n.language === 'en' ? 'en' : 'ar')
  );

  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [i18n, language]);

  const value = useMemo<DirectionValue>(() => {
    const dir = languageDir(language);
    const setLanguage = (next: AppLanguage) => {
      setLanguageState(next);
      void i18n.changeLanguage(next);
    };
    return {
      language,
      dir,
      isRTL: dir === 'rtl',
      layout: layoutDirection(dir === 'rtl'),
      nativeMatches: nativeRtlMatches(dir),
      setLanguage,
      toggleLanguage: () => setLanguage(language === 'ar' ? 'en' : 'ar'),
    };
  }, [language, i18n]);

  return <DirectionContext.Provider value={value}>{children}</DirectionContext.Provider>;
}

export function useDirection(): DirectionValue {
  const value = useContext(DirectionContext);
  if (!value) throw new Error('useDirection must be used inside <DirectionProvider>');
  return value;
}
