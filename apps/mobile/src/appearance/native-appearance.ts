/**
 * W3-01 — the platform edges of the ONE appearance authority. The only module that names a platform API.
 *
 * ## The operating system's appearance (`SYSTEM`)
 *
 * React Native's `Appearance` reports the appearance the app's own configuration is in. While the reader's
 * preference is `SYSTEM` the app declares no override, so that IS the operating system's appearance, and its
 * change event is how `SYSTEM` follows the device live. While an explicit Dark or Light override is declared
 * the reading is the override — and the authority ignores the system source then, by P1 §12.
 *
 * ## The app's own native appearance
 *
 *   - `Appearance.setColorScheme` — React Native's supported API: `'dark'` / `'light'` override the app's
 *     appearance, `'unspecified'` returns it to the device (RN 0.86 `Appearance.js`). On iOS it sets the
 *     window's interface style, so system-drawn UI after takeover follows the choice; the iOS Launch Screen is
 *     drawn before the app runs and keeps following the device, exactly as W2-02 froze it. On Android it is
 *     `AppCompatDelegate.setDefaultNightMode`, which is app-local and NOT persisted.
 *   - Android 12+ (API 31) additionally persists the app's night mode through `UiModeManager
 *     .setApplicationNightMode`, which the system reads for the NEXT cold launch's splash. The platform service
 *     maps the app-level modes as YES → night, NO → not night, and AUTO → `UI_MODE_NIGHT_UNDEFINED`, i.e. no
 *     per-app override, so the app follows the system (AOSP `UiModeManagerService.setApplicationNightMode`).
 *     That call lives in the local Expo module `modules/qandeel-app-appearance`; this file only hands it the
 *     preference word, so no Product code ever names a native constant.
 *
 * Nothing here logs.
 */
import { requireOptionalNativeModule } from 'expo';
import { Appearance, Platform } from 'react-native';

import type { AppearancePreference, EffectiveAppearance, NativeAppearanceSink, SystemAppearanceSource } from './appearance-authority';

/** The local Android module's JS surface: one function, taking the preference word. */
interface QandeelAppAppearanceModule {
  setApplicationNightMode(preference: AppearancePreference): boolean;
}

/** `null` off Android, under Jest, and on any host where the module is not linked. */
const androidAppAppearance =
  Platform.OS === 'android' ? requireOptionalNativeModule<QandeelAppAppearanceModule>('QandeelAppAppearance') : null;

const toEffective = (scheme: string | null | undefined): EffectiveAppearance => (scheme === 'light' ? 'LIGHT' : 'DARK');

/**
 * The operating system's appearance. An unknown reading is DARK: P1's default is the safe side of a
 * platform that cannot say.
 */
export function createSystemAppearanceSource(): SystemAppearanceSource {
  return {
    current: () => toEffective(Appearance.getColorScheme()),
    subscribe(listener) {
      const subscription = Appearance.addChangeListener(({ colorScheme }) => listener(toEffective(colorScheme)));
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        subscription.remove();
      };
    },
  };
}

const COLOR_SCHEME: Readonly<Record<AppearancePreference, 'dark' | 'light' | 'unspecified'>> = Object.freeze({
  DARK: 'dark',
  LIGHT: 'light',
  SYSTEM: 'unspecified',
});

/** Declares the app's native appearance for the preference, on every platform that supports it. */
export function createNativeAppearanceSink(): NativeAppearanceSink {
  return {
    apply(preference) {
      Appearance.setColorScheme(COLOR_SCHEME[preference]);
      androidAppAppearance?.setApplicationNightMode(preference);
    },
  };
}
