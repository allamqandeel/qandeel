/**
 * W3-MEGA-S (E2E-D-11) — the Language row's one act: send the reader to the SYSTEM's language setting (W3-PDG-01 §5).
 * QANDEEL keeps no language of its own: there is no in-app switch and nothing is stored. When the reader returns, the
 * app is in the language the platform now gives it, read by the one locale authority (`device-locale.ts`) exactly as at
 * any launch.
 *
 *   - iOS 13+: the app's own page in Settings, which carries "Language" because the app declares its two
 *     localizations (app.json `CFBundleLocalizations`). iOS relaunches the app after a per-app language change.
 *   - Android: the device's own language setting. Android 13+ could offer a per-app language only if the app declared
 *     a locale configuration resource, which on this project needs a generated native resource — a Level-4 CNG change
 *     under the T-01 hierarchy that requires Engineering Architecture review first. Until then the closest honest place
 *     is the device language, which QANDEEL follows.
 *
 * `false` when the platform refused to open anything; the row then simply stays where it is.
 */
import { Linking, Platform } from 'react-native';

export async function openLanguageSettings(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Linking.sendIntent('android.settings.LOCALE_SETTINGS');
      return true;
    }
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}
