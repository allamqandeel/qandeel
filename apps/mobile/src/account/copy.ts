/**
 * W1B-01 — the ONE place the account entry, the first-use Welcome and the Conversation openers are
 * written.
 *
 * Every string is exactly as the Product Owner approved it for W1B-01, and
 * `docs/e2e/QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md` §2 records each approval verbatim. Nothing is
 * paraphrased, re-punctuated or translated on the fly, and no other module of this layer writes a
 * Product word. The network sentence is T-14's frozen one, reused rather than rewritten; the Welcome
 * and the First Conversation Opening are the Product Owner's controlled amendment to I-08A4 §14–§15
 * (`docs/canonical-authority/final-product-experience/w1b/`); the normal opener is G1.1 §1 / P4-C4,
 * unchanged.
 *
 * `{display_name}` and `{email}` are substituted as ISOLATED runs (first-strong isolate … pop), so a
 * Latin name or address inside Arabic, or an Arabic name inside English, can never reorder the
 * sentence around it (I-08A4 §16). The isolate characters are invisible and are not copy.
 */
import type { ChromeLanguage } from '../orientation-chrome';

/** U+2068 FIRST STRONG ISOLATE and U+2069 POP DIRECTIONAL ISOLATE, written as code points so no invisible character hides in the source. */
const FSI = String.fromCodePoint(0x2068);
const PDI = String.fromCodePoint(0x2069);
const isolate = (value: string): string => `${FSI}${value}${PDI}`;

export interface AccountEntryCopy {
  // ------------------------------------------------------------------------------ create account
  readonly createAccountTitle: string;
  readonly nameLabel: string;
  readonly loginIdLabel: string;
  readonly loginIdHelp: string;
  readonly emailLabel: string;
  readonly passwordLabel: string;
  readonly createAccountAction: string;
  readonly emptyName: string;
  readonly emptyLoginId: string;
  readonly malformedLoginId: string;
  readonly invalidEmail: string;
  readonly passwordRejected: string;
  readonly loginIdUnavailable: string;
  readonly accountRefused: string;
  /** T-14's frozen network sentence, reused. */
  readonly network: string;
  readonly returnFromCreateAccount: string;
  // -------------------------------------------------------------------------------- verify email
  readonly verifyTitle: string;
  readonly verifyInstruction: (email: string) => string;
  readonly codeLabel: string;
  readonly verifyAction: string;
  readonly resendAction: string;
  readonly resendSucceeded: string;
  readonly codeIncorrect: string;
  /**
   * Approved, and deliberately NOT displayed: the provider answers a wrong and an expired code alike, so
   * nothing can yet prove expiry. Kept for a future provider state that can.
   */
  readonly codeExpired: string;
  readonly resendFailed: string;
  readonly verifyFailed: string;
  readonly returnFromVerify: string;
}

export interface FirstUseCopy {
  /** The concise first-use Welcome: three lines, the last of which is the start act. */
  readonly welcome: (displayName: string) => readonly [greeting: string, definition: string, start: string];
  /** The First Conversation Opening: two lines. */
  readonly firstOpening: (displayName: string) => readonly [presence: string, invitation: string];
  /** The normal new-conversation opener: one line. */
  readonly normalOpener: (displayName: string) => string;
}

const ENTRY_AR: AccountEntryCopy = Object.freeze({
  createAccountTitle: 'إنشاء حساب',
  nameLabel: 'الاسم',
  loginIdLabel: 'معرّف الدخول',
  loginIdHelp: 'معرّف خاص تستخدمه لتسجيل الدخول إلى قنديل. احتفظ به؛ لن يظهر للآخرين.',
  emailLabel: 'البريد الإلكتروني',
  passwordLabel: 'كلمة المرور',
  createAccountAction: 'إنشاء الحساب',
  emptyName: 'أدخل الاسم.',
  emptyLoginId: 'أدخل معرّف الدخول.',
  malformedLoginId: 'استخدم من 3 إلى 30 حرفًا أو رقمًا بالإنجليزية. ويمكن استخدام . أو - أو _ بين الحروف والأرقام.',
  invalidEmail: 'أدخل بريدًا إلكترونيًا صحيحًا.',
  passwordRejected: 'كلمة المرور لا تستوفي المتطلبات.',
  loginIdUnavailable: 'معرّف الدخول هذا غير متاح. اختر معرّفًا آخر.',
  accountRefused: 'تعذّر إنشاء الحساب بهذه البيانات.',
  network: 'تعذّر الاتصال. حاول مرة أخرى.',
  returnFromCreateAccount: 'لديك حساب بالفعل؟ تسجيل الدخول',
  verifyTitle: 'تأكيد البريد الإلكتروني',
  verifyInstruction: (email: string) => `أرسلنا رمزًا إلى ${isolate(email)}. أدخل الرمز لتأكيد بريدك.`,
  codeLabel: 'رمز التأكيد',
  verifyAction: 'تأكيد البريد',
  resendAction: 'لم يصلك الرمز؟ إعادة الإرسال',
  resendSucceeded: 'تم إرسال رمز جديد.',
  codeIncorrect: 'رمز التأكيد غير صحيح.',
  codeExpired: 'انتهت صلاحية رمز التأكيد. أرسل رمزًا جديدًا.',
  resendFailed: 'تعذّر إرسال رمز التأكيد. حاول مرة أخرى.',
  verifyFailed: 'تعذّر تأكيد البريد الإلكتروني الآن. حاول مرة أخرى.',
  returnFromVerify: 'العودة لتسجيل الدخول',
});

const ENTRY_EN: AccountEntryCopy = Object.freeze({
  createAccountTitle: 'Create account',
  nameLabel: 'Name',
  loginIdLabel: 'Login ID',
  loginIdHelp: "A private ID you can use to sign in to QANDEEL. Keep it safe; it won't be shown to others.",
  emailLabel: 'Email',
  passwordLabel: 'Password',
  createAccountAction: 'Create account',
  emptyName: 'Enter your name.',
  emptyLoginId: 'Enter your Login ID.',
  malformedLoginId: 'Use 3–30 English letters or numbers. You can use . - or _ between letters and numbers.',
  invalidEmail: 'Enter a valid email address.',
  passwordRejected: "The password doesn't meet the requirements.",
  loginIdUnavailable: "This Login ID isn't available. Choose another one.",
  accountRefused: "The account couldn't be created with these details.",
  network: 'Couldn’t connect. Try again.',
  returnFromCreateAccount: 'Already have an account? Sign in',
  verifyTitle: 'Verify your email',
  verifyInstruction: (email: string) => `We sent a code to ${isolate(email)}. Enter it to verify your email.`,
  codeLabel: 'Verification code',
  verifyAction: 'Verify email',
  resendAction: "Didn't get the code? Send again",
  resendSucceeded: 'A new code was sent.',
  codeIncorrect: 'The verification code is incorrect.',
  codeExpired: 'This verification code has expired. Send a new one.',
  resendFailed: "The verification code couldn't be sent. Try again.",
  verifyFailed: "We couldn't verify your email right now. Try again.",
  returnFromVerify: 'Back to sign in',
});

const FIRST_USE_AR: FirstUseCopy = Object.freeze({
  welcome: (displayName: string) =>
    [
      `أهلًا يا ${isolate(displayName)}.`,
      'أنا قنديل. كل ما نتكلم أكثر، أفهمك أكثر وأتذكر ما يهمك، علشان أساعدك تشوف نفسك وحياتك بشكل أوضح.',
      'ابدأ بما يشغلك الآن.',
    ] as const,
  firstOpening: (displayName: string) =>
    [`أنا معك يا ${isolate(displayName)}.`, 'ابدأ بما يشغلك الآن… حتى لو كان شيئًا لا تعرف كيف تصفه بعد. ونبدأ من هناك.'] as const,
  normalOpener: (displayName: string) => `اهلا يا ${isolate(displayName)} ... انا في انتظارك ... يلا نبدأ`,
});

const FIRST_USE_EN: FirstUseCopy = Object.freeze({
  welcome: (displayName: string) =>
    [
      `Welcome, ${isolate(displayName)}.`,
      "I'm QANDEEL. The more we talk, the better I understand you and remember what matters to you, so I can help you see yourself and your life more clearly.",
      "Start with what's on your mind.",
    ] as const,
  firstOpening: (displayName: string) =>
    [`I'm with you, ${isolate(displayName)}.`, "Start with what's on your mind… even if it's something you don't quite know how to describe yet. We'll begin there."] as const,
  normalOpener: (displayName: string) => `Hi ${isolate(displayName)} ... I'm here, ready when you are ... let's begin`,
});

/** There is no default language, exactly as T-08 and W1A-01 refuse one. */
export function accountEntryCopy(language: ChromeLanguage): AccountEntryCopy {
  return language === 'ar' ? ENTRY_AR : ENTRY_EN;
}

export function firstUseCopy(language: ChromeLanguage): FirstUseCopy {
  return language === 'ar' ? FIRST_USE_AR : FIRST_USE_EN;
}
