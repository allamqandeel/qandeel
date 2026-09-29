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
 *
 * W3-02 (E2E-D-09) adds the Account & Identity group and its ONE function, the Public ID:
 *
 *   - «الحساب والهوية» / Account & Identity — the group name (P4-C4 §4 `gAccount`);
 *   - the Public ID words — `pidTerm`, `pidAvailable`, `pidUsed`, `pidTitle`, `pidCurrent`, `pidNew`,
 *     `pidConfirm`, `pidKeep` (P4-C4 §5) and `pidBody` (P4-C3R approval), byte-for-byte as the pinned P4-C3
 *     registry carries them;
 *   - the invalid and unavailable sentences — approved by the Product Owner in the W3-02 Product Copy Gate;
 *   - T-14's frozen network sentence, reused verbatim (as W1B-01 and W2-01 reuse it) for a change that did
 *     not commit, or whose outcome is still unknown after the canonical state was read again.
 *
 * Nothing else is written: no progress words, no success sentence, no "used" error — the row itself shows
 * the canonical Public ID and `pidUsed` when the change is over.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import type { AppearancePreference } from '../appearance';

export interface PublicIdCopy {
  readonly term: string;
  readonly available: string;
  readonly used: string;
  readonly title: string;
  readonly body: string;
  readonly current: string;
  readonly next: string;
  readonly confirm: string;
  readonly keep: string;
  readonly invalid: string;
  readonly unavailable: string;
  readonly network: string;
}

export interface SettingsCopy {
  readonly title: string;
  readonly backName: string;
  readonly accountGroup: string;
  readonly publicId: PublicIdCopy;
  readonly appearanceGroup: string;
  readonly supportGroup: string;
  readonly appearance: Readonly<Record<AppearancePreference, string>>;
  readonly signOut: string;
}

const AR: SettingsCopy = Object.freeze({
  title: 'الإعدادات',
  backName: 'رجوع',
  accountGroup: 'الحساب والهوية',
  publicId: Object.freeze({
    term: 'المعرّف العام',
    available: 'متاح تغيير يدوي واحد',
    used: 'استُخدم التغيير اليدوي الوحيد',
    title: 'يمكن تغيير المعرّف العام مرة واحدة فقط',
    body: 'هذا هو التغيير اليدوي الوحيد المتاح لمعرّفك العام طوال عمر الحساب. بعد التأكيد يصبح المعرّف الجديد دائمًا، ولا يمكن تغييره مرة أخرى.',
    current: 'الحالي',
    next: 'الجديد',
    confirm: 'تأكيد التغيير',
    keep: 'الإبقاء على المعرّف الحالي',
    invalid: 'أدخل معرّفًا عامًا صالحًا.',
    unavailable: 'المعرّف العام هذا غير متاح. اختر معرّفًا آخر.',
    network: 'تعذّر الاتصال. حاول مرة أخرى.',
  }),
  appearanceGroup: 'المظهر وتسهيلات الاستخدام',
  supportGroup: 'الدعم ومعلومات التطبيق',
  appearance: Object.freeze({ DARK: 'داكن', LIGHT: 'فاتح', SYSTEM: 'حسب الجهاز' }),
  signOut: 'تسجيل الخروج',
});

const EN: SettingsCopy = Object.freeze({
  title: 'Settings',
  backName: 'Back',
  accountGroup: 'Account & Identity',
  publicId: Object.freeze({
    term: 'Public ID',
    available: 'One manual change available',
    used: 'Your one manual change has been used',
    title: 'You can change your Public ID only once',
    body: 'This is the only time you can manually change your Public ID. After you confirm, the new ID is permanent and can’t be changed again.',
    current: 'Current',
    next: 'New',
    confirm: 'Confirm change',
    keep: 'Keep current ID',
    invalid: 'Enter a valid Public ID.',
    unavailable: "This Public ID isn't available. Choose another one.",
    network: 'Couldn’t connect. Try again.',
  }),
  appearanceGroup: 'Appearance & Accessibility',
  supportGroup: 'Support & About',
  appearance: Object.freeze({ DARK: 'Dark', LIGHT: 'Light', SYSTEM: 'System' }),
  signOut: 'Sign out',
});

/** The copy for one Product language. There is no default language. */
export function settingsCopy(language: ChromeLanguage): SettingsCopy {
  return language === 'ar' ? AR : EN;
}
