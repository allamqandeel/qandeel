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
 *
 * W3-MEGA-A adds the Name, Login ID and Email rows to Account & Identity and the Security & Sign-in group. Its words
 * are COMPOSED from already-approved sources, never re-typed:
 *
 *   - «الأمان وتسجيل الدخول» / Security & Sign-in — the group name (P4-C4 §4 `gSecurity`);
 *   - Current / New / Confirm change — `pidCurrent`, `pidNew`, `pidConfirm` (P4-C4 §5), reused for every change here;
 *   - Name, Login ID, its persistent help, Email, Password, the empty / malformed / unavailable Login ID and empty
 *     Name sentences, the invalid-Email sentence, the verification code, instruction, action, resend and the
 *     incomplete-code sentence — W1B-01's own (`accountEntryCopy`);
 *   - Change password, New password, Confirm new password, the mismatch, the password-rules sentence,
 *     "Password changed." and the rejected-code sentence (N7) — W2-01's own (`accountAccessCopy`);
 *   - T-14's network sentence, as above.
 *
 * FOUR pairs are new, and the Product Owner approved them in the W3-MEGA-A R1 Copy Gate (record §7.6): the Email status
 * «تم التحقق» / Verified,
 * the action «تسجيل الخروج من الأجهزة الأخرى» / Sign out from other devices (the English is the Product Owner's own
 * row name, W3-PDG-01 §3), its result «تم تسجيل الخروج من الأجهزة الأخرى.» / Signed out from other devices., and the
 * re-entered password's refusal «كلمة المرور غير صحيحة.» / The password is incorrect.
 *
 * W3-MEGA-S adds the Language row and the Privacy & Data group. Their own pairs are `APPROVED_W3_MEGA_S` below; the
 * Product Owner approved every one in the W3-MEGA-S Copy Gate (W3-MEGA-S-CLOSE-01; record §9).
 */
import type { ChromeLanguage } from '../orientation-chrome';
import type { AppearancePreference } from '../appearance';
import { accountAccessCopy, accountEntryCopy } from '../account';

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

/** W3-MEGA-A — the words of the Name, Login ID and Email rows and their changes. */
export interface AccountIdentityCopy {
  readonly nameTerm: string;
  readonly loginIdTerm: string;
  readonly loginIdHelp: string;
  readonly emailTerm: string;
  readonly emailVerified: string;
  readonly current: string;
  readonly next: string;
  readonly confirm: string;
  readonly password: string;
  readonly emptyName: string;
  readonly emptyLoginId: string;
  readonly malformedLoginId: string;
  readonly loginIdUnavailable: string;
  readonly passwordIncorrect: string;
  readonly invalidEmail: string;
  readonly codeLabel: string;
  readonly codeInstruction: (email: string) => string;
  readonly verifyAction: string;
  readonly resendAction: string;
  readonly codeIncomplete: string;
  readonly codeRejected: string;
  readonly network: string;
}

/** W3-MEGA-A — the words of the Security & Sign-in group. */
export interface SecurityCopy {
  readonly group: string;
  readonly changePassword: string;
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
  readonly mismatch: string;
  readonly policy: string;
  readonly passwordChanged: string;
  readonly signOutOthers: string;
  readonly signedOutOthers: string;
}

/** W3-MEGA-S — the Language row (W3-PDG-01 §5): its term and the name of each Product language, in that language. */
export interface LanguageCopy {
  readonly term: string;
  readonly names: Readonly<Record<ChromeLanguage, string>>;
}

/** W3-MEGA-S — the words of the Privacy & Data group (W3-PDG-01 §7, §8). */
export interface PrivacyDataCopy {
  readonly exportAction: string;
  readonly exportExplain: string;
  readonly exportConfirm: string;
  readonly exportPreparing: string;
  readonly exportReady: (until: string) => string;
  readonly exportDownload: string;
  readonly exportSaved: string;
  readonly exportSaveFailed: string;
  readonly exportExpired: string;
  readonly exportFailed: string;
  readonly deleteAction: string;
  readonly deleteExplain: string;
  readonly deleteConfirm: string;
  readonly deleteScheduled: (on: string) => string;
  readonly deleteCancel: string;
  readonly deleteCancelled: string;
  readonly deleteFinalizing: string;
  readonly deleteNotCancellable: string;
  readonly deleteBlocked: string;
  readonly enterPassword: string;
  readonly password: string;
  readonly passwordIncorrect: string;
  readonly network: string;
}

export interface SettingsCopy {
  readonly title: string;
  readonly backName: string;
  readonly accountGroup: string;
  readonly publicId: PublicIdCopy;
  readonly identity: AccountIdentityCopy;
  readonly security: SecurityCopy;
  readonly qandeelGroup: string;
  readonly language: LanguageCopy;
  readonly appearanceGroup: string;
  readonly privacyGroup: string;
  readonly privacy: PrivacyDataCopy;
  readonly supportGroup: string;
  readonly appearance: Readonly<Record<AppearancePreference, string>>;
  readonly signOut: string;
}

/** W3-MEGA-A — the four pairs the Product Owner approved (R1 Copy Gate), and nothing else of its own. */
const APPROVED = Object.freeze({
  ar: Object.freeze({
    emailVerified: 'تم التحقق',
    signOutOthers: 'تسجيل الخروج من الأجهزة الأخرى',
    signedOutOthers: 'تم تسجيل الخروج من الأجهزة الأخرى.',
    passwordIncorrect: 'كلمة المرور غير صحيحة.',
  }),
  en: Object.freeze({
    emailVerified: 'Verified',
    signOutOthers: 'Sign out from other devices',
    signedOutOthers: 'Signed out from other devices.',
    passwordIncorrect: 'The password is incorrect.',
  }),
});

/** Composed from the approved W1B-01, W2-01 and P4-C4 words; only the APPROVED pairs are this module's own. */
function identityCopy(language: ChromeLanguage, publicId: PublicIdCopy, network: string): AccountIdentityCopy {
  const entry = accountEntryCopy(language);
  const access = accountAccessCopy(language);
  const approved = APPROVED[language === 'ar' ? 'ar' : 'en'];
  return Object.freeze({
    nameTerm: entry.nameLabel,
    loginIdTerm: entry.loginIdLabel,
    loginIdHelp: entry.loginIdHelp,
    emailTerm: entry.emailLabel,
    emailVerified: approved.emailVerified,
    current: publicId.current,
    next: publicId.next,
    confirm: publicId.confirm,
    password: entry.passwordLabel,
    emptyName: entry.emptyName,
    emptyLoginId: entry.emptyLoginId,
    malformedLoginId: entry.malformedLoginId,
    loginIdUnavailable: entry.loginIdUnavailable,
    passwordIncorrect: approved.passwordIncorrect,
    invalidEmail: entry.invalidEmail,
    codeLabel: entry.codeLabel,
    codeInstruction: entry.verifyInstruction,
    verifyAction: entry.verifyAction,
    resendAction: entry.resendAction,
    codeIncomplete: entry.codeIncorrect,
    // W2-01's N7: a rejected code (wrong, expired or never sent) — and the way on is a new one.
    codeRejected: access.codeRejected,
    network,
  });
}

function securityCopy(language: ChromeLanguage, group: string): SecurityCopy {
  const access = accountAccessCopy(language);
  const entry = accountEntryCopy(language);
  const approved = APPROVED[language === 'ar' ? 'ar' : 'en'];
  return Object.freeze({
    group,
    changePassword: access.changePassword,
    currentPassword: entry.passwordLabel,
    newPassword: access.newPasswordLabel,
    confirmPassword: access.confirmPasswordLabel,
    mismatch: access.passwordMismatch,
    policy: access.passwordRejected,
    passwordChanged: access.passwordChanged,
    signOutOthers: approved.signOutOthers,
    signedOutOthers: approved.signedOutOthers,
  });
}

/**
 * W3-MEGA-S — the pairs of the Language row and the Privacy & Data group. APPROVED — PRODUCT OWNER (W3-MEGA-S-CLOSE-01):
 * every pair as written in the W3-MEGA-S record §9, with ONE Arabic correction, `exportExplain`; its English is
 * unchanged. The approval is of the words only: it changes no export or deletion behaviour. The rows marked ★ in §9
 * state a deletion consequence, the grace behaviour, the export promise or its expiry, or irreversibility, and nothing
 * here may reword them without a new Copy Gate. MSA, verb-first, beside their approved siblings («تم تغيير كلمة
 * المرور.»); the language names are each language's own name for itself.
 */
const APPROVED_W3_MEGA_S = Object.freeze({
  ar: Object.freeze({
    languageTerm: 'اللغة',
    exportAction: 'تصدير بياناتي',
    // ★ the export promise and its limited availability — the Product Owner's corrected wording.
    exportExplain: 'سنجهّز نسخة من بياناتك. وعندما تصبح جاهزة، يمكنك تنزيلها من هنا لمدة محدودة.',
    exportConfirm: 'طلب نسخة',
    exportPreparing: 'جارٍ تجهيز نسخة من بياناتك',
    // ★ expiry.
    exportReady: 'النسخة جاهزة للتنزيل حتى {date}',
    exportDownload: 'تنزيل',
    exportSaved: 'تم حفظ الملف.',
    exportSaveFailed: 'تعذّر حفظ الملف.',
    // ★ expiry.
    exportExpired: 'انتهت مدة التنزيل. يمكنك طلب نسخة جديدة.',
    exportFailed: 'تعذّر تجهيز النسخة. يمكنك طلبها مرة أخرى.',
    deleteAction: 'حذف الحساب',
    // ★ the deletion consequence, the grace period and irreversibility.
    deleteExplain: 'سيُحذف حسابك وبياناتك الشخصية نهائيًا، ومنها محادثاتك وما يحتفظ به قنديل عنك، بعد مهلة قصيرة يمكنك الإلغاء خلالها. وبعد انقضائها لا يمكن التراجع عن الحذف.',
    deleteConfirm: 'حذف الحساب',
    // ★ the grace behaviour.
    deleteScheduled: 'سيُحذف حسابك في {date}',
    deleteCancel: 'إلغاء الحذف',
    deleteCancelled: 'تم إلغاء الحذف.',
    // ★ never "deleted" before the final deletion.
    deleteFinalizing: 'يجري حذف حسابك الآن.',
    // ★ irreversibility.
    deleteNotCancellable: 'لم يعد إلغاء الحذف ممكنًا.',
    // ★ the Connected Worlds hard stop, told without naming the mechanism.
    deleteBlocked: 'يتعذّر إتمام الحذف حاليًا، ويبقى حسابك كما هو.',
    enterPassword: 'أدخل كلمة المرور.',
  }),
  en: Object.freeze({
    languageTerm: 'Language',
    exportAction: 'Export my data',
    exportExplain: "We'll prepare a copy of your data. When it's ready, you can download it here for a limited time.",
    exportConfirm: 'Request a copy',
    exportPreparing: 'Preparing a copy of your data',
    exportReady: 'Ready to download until {date}',
    exportDownload: 'Download',
    exportSaved: 'File saved.',
    exportSaveFailed: "The file couldn't be saved.",
    exportExpired: 'The download period has ended. You can request a new copy.',
    exportFailed: "The copy couldn't be prepared. You can request it again.",
    deleteAction: 'Delete account',
    deleteExplain: 'Your account and your personal data, including your conversations and what QANDEEL keeps about you, will be deleted permanently after a short waiting period. You can cancel during it. After it ends, the deletion can’t be undone.',
    deleteConfirm: 'Delete account',
    deleteScheduled: 'Your account will be deleted on {date}',
    deleteCancel: 'Cancel deletion',
    deleteCancelled: 'Deletion cancelled.',
    deleteFinalizing: 'Your account is being deleted now.',
    deleteNotCancellable: 'The deletion can no longer be cancelled.',
    deleteBlocked: "The deletion can't be completed right now. Your account stays as it is.",
    enterPassword: 'Enter your password.',
  }),
});

function privacyCopy(language: ChromeLanguage, network: string): PrivacyDataCopy {
  const entry = accountEntryCopy(language);
  const approved = APPROVED[language === 'ar' ? 'ar' : 'en'];
  const pairs = APPROVED_W3_MEGA_S[language === 'ar' ? 'ar' : 'en'];
  return Object.freeze({
    exportAction: pairs.exportAction,
    exportExplain: pairs.exportExplain,
    exportConfirm: pairs.exportConfirm,
    exportPreparing: pairs.exportPreparing,
    exportReady: (until: string) => pairs.exportReady.replace('{date}', until),
    exportDownload: pairs.exportDownload,
    exportSaved: pairs.exportSaved,
    exportSaveFailed: pairs.exportSaveFailed,
    exportExpired: pairs.exportExpired,
    exportFailed: pairs.exportFailed,
    deleteAction: pairs.deleteAction,
    deleteExplain: pairs.deleteExplain,
    deleteConfirm: pairs.deleteConfirm,
    deleteScheduled: (on: string) => pairs.deleteScheduled.replace('{date}', on),
    deleteCancel: pairs.deleteCancel,
    deleteCancelled: pairs.deleteCancelled,
    deleteFinalizing: pairs.deleteFinalizing,
    deleteNotCancellable: pairs.deleteNotCancellable,
    deleteBlocked: pairs.deleteBlocked,
    enterPassword: pairs.enterPassword,
    // Reused, not new: W1B-01's password label, W3-MEGA-A's approved C4 and T-14's network sentence.
    password: entry.passwordLabel,
    passwordIncorrect: approved.passwordIncorrect,
    network,
  });
}

const AR_BASE = Object.freeze({
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

const EN_BASE = Object.freeze({
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

/** Each Product language by its own name (implementation-owned: a language is named in itself, never translated). */
const LANGUAGE_NAMES = Object.freeze({ ar: 'العربية', en: 'English' });

const AR: SettingsCopy = Object.freeze({
  ...AR_BASE,
  identity: identityCopy('ar', AR_BASE.publicId, AR_BASE.publicId.network),
  security: securityCopy('ar', 'الأمان وتسجيل الدخول'),
  // P4-C4 §4 `gQandeel` and `gPrivacy`, verbatim.
  qandeelGroup: 'قنديل والمحادثة',
  language: Object.freeze({ term: APPROVED_W3_MEGA_S.ar.languageTerm, names: LANGUAGE_NAMES }),
  privacyGroup: 'الخصوصية والبيانات',
  privacy: privacyCopy('ar', AR_BASE.publicId.network),
});

const EN: SettingsCopy = Object.freeze({
  ...EN_BASE,
  identity: identityCopy('en', EN_BASE.publicId, EN_BASE.publicId.network),
  security: securityCopy('en', 'Security & Sign-in'),
  qandeelGroup: 'QANDEEL & Conversation',
  language: Object.freeze({ term: APPROVED_W3_MEGA_S.en.languageTerm, names: LANGUAGE_NAMES }),
  privacyGroup: 'Privacy & Data',
  privacy: privacyCopy('en', EN_BASE.publicId.network),
});

/** The copy for one Product language. There is no default language. */
export function settingsCopy(language: ChromeLanguage): SettingsCopy {
  return language === 'ar' ? AR : EN;
}
