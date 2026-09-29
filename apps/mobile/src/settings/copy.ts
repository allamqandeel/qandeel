/**
 * W3-01 — the ONE place the General Settings surface's words are written.
 *
 * Every string is frozen or Product-Owner approved, exactly as written, and nothing else is shown:
 *
 *   - «الإعدادات» / Settings — the destination (P4-C3 registry `settings`, CANON; I-08A4 §8 / §9);
 *   - «رجوع» / Back — the back control's accessible name (P4-C4 `p3.back`);
 *   - «المظهر وتسهيلات الاستخدام» / Appearance & Accessibility and «الدعم ومعلومات التطبيق» / Support & About —
 *     the two group names W3-01 exposes (P4-C4 §4 `gAppearance`, `gSupport`);
 *   - «داكن» / Dark, «فاتح» / Light, «حسب الجهاز» / System and «تسجيل الخروج» / Sign out — approved by the
 *     Product Owner in the W3-01 Product Copy Gate.
 *
 * The same gate approved what is deliberately NOT here: no appearance helper text, no sign-out progress
 * words and no sign-out failure words. The selected appearance is told by the selected treatment and the
 * accessibility state, never by an extra sentence.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import type { AppearancePreference } from '../appearance';

export interface SettingsCopy {
  readonly title: string;
  readonly backName: string;
  readonly appearanceGroup: string;
  readonly supportGroup: string;
  readonly appearance: Readonly<Record<AppearancePreference, string>>;
  readonly signOut: string;
}

const AR: SettingsCopy = Object.freeze({
  title: 'الإعدادات',
  backName: 'رجوع',
  appearanceGroup: 'المظهر وتسهيلات الاستخدام',
  supportGroup: 'الدعم ومعلومات التطبيق',
  appearance: Object.freeze({ DARK: 'داكن', LIGHT: 'فاتح', SYSTEM: 'حسب الجهاز' }),
  signOut: 'تسجيل الخروج',
});

const EN: SettingsCopy = Object.freeze({
  title: 'Settings',
  backName: 'Back',
  appearanceGroup: 'Appearance & Accessibility',
  supportGroup: 'Support & About',
  appearance: Object.freeze({ DARK: 'Dark', LIGHT: 'Light', SYSTEM: 'System' }),
  signOut: 'Sign out',
});

/** The copy for one Product language. There is no default language. */
export function settingsCopy(language: ChromeLanguage): SettingsCopy {
  return language === 'ar' ? AR : EN;
}
