import { I18nManager, Platform } from 'react-native';

export type Dir = 'rtl' | 'ltr';

export const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

export function dirForLanguage(languageTag: string): Dir {
  const base = languageTag.split('-')[0]?.toLowerCase() ?? '';
  return RTL_LANGUAGES.has(base) ? 'rtl' : 'ltr';
}

/**
 * Native-side RTL. `forceRTL` only takes effect after a full app restart, so the
 * spike never relies on it for the in-app language toggle — it is set once at boot
 * from the device locale, and `nativeRtlMatches()` lets the UI tell the truth about
 * whether the native layout direction currently agrees with the selected language.
 */
export function initNativeDirection(bootDir: Dir): void {
  I18nManager.allowRTL(true);
  const wantRTL = bootDir === 'rtl';
  if (I18nManager.isRTL !== wantRTL) {
    I18nManager.forceRTL(wantRTL);
  }
}

/**
 * Whether the native side's own direction still disagrees with the selected language.
 * The rendered layout is correct either way — it is mirrored in JS — but platform-owned
 * details (text input caret, system dialogs) keep following the native flag until the app
 * is restarted, and the UI says so rather than pretending otherwise. Meaningless on web,
 * where nothing reads the flag.
 */
export function nativeRtlMatches(dir: Dir): boolean {
  if (Platform.OS === 'web') return true;
  return I18nManager.isRTL === (dir === 'rtl');
}
