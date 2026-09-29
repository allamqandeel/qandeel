/**
 * W2-01 — the ONE place the account-access words are written: password recovery and the
 * unable-to-verify-session state.
 *
 * Every string is exactly as the Product Owner approved it for W2-01, and
 * `docs/e2e/QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md` §2 records each approval verbatim. Three kinds of
 * string live here, and the record names the source of each:
 *   - approved in the W2-01 task (the recovery entry, the generic recovery result, "Password changed.",
 *     the unable-to-verify sentence and "Try again");
 *   - approved in the W2-01 copy gate (the recovery title, actions, labels and messages — with the
 *     Product Owner's two edits: the local code-shape sentence and the update-failure sentence);
 *   - already approved elsewhere and REUSED verbatim (T-14's network sentence; W1B-01's Email label,
 *     invalid-Email sentence, password-policy sentence, resend action and "Back to sign in").
 *
 * W2-01 R1 adds ONE Product-Owner-approved sentence: the Verify Email instruction for a reader who signed
 * in by Login ID, which names no address because the device never learns that Email (P1 §3). Every
 * other Verify Email word stays W1B-01's own, in `../copy`.
 *
 * No sentence here says whether an account exists. After a resend the entry repeats the generic result,
 * never "a new code was sent". No other module of the account layer writes a Product word.
 */
import type { ChromeLanguage } from '../../orientation-chrome';

export interface AccountAccessCopy {
  // ------------------------------------------------------------------------------ password recovery
  /** The entry below the password field on Sign in. */
  readonly forgotPassword: string;
  /** Title of every recovery step: the Email request, the code, the new password. */
  readonly recoveryTitle: string;
  readonly emailLabel: string;
  readonly sendCode: string;
  readonly invalidEmail: string;
  /** The ONE result of asking for a code — account or not. Also the code step's instruction. */
  readonly recoveryRequested: string;
  readonly codeLabel: string;
  readonly continueAction: string;
  /** Fewer than six digits: all the entry can prove. Never "incorrect". */
  readonly codeShape: string;
  /** The provider rejected the code — wrong or expired, which it does not distinguish. */
  readonly codeRejected: string;
  readonly resendAction: string;
  readonly newPasswordLabel: string;
  readonly confirmPasswordLabel: string;
  readonly passwordMismatch: string;
  readonly changePassword: string;
  /** The provider's own password rules refused it (reused W1B-01 sentence). */
  readonly passwordRejected: string;
  readonly updateFailed: string;
  readonly passwordChanged: string;
  readonly backToSignIn: string;
  /** T-14's frozen network sentence, reused. */
  readonly network: string;
  // ----------------------------------------------------------------------- unable to verify session
  readonly sessionUnverified: string;
  readonly tryAgain: string;
  // ------------------------------------------------------------ W2-01 R1 — Login-ID-origin Verify Email
  /** The Verify Email instruction when the reader signed in by Login ID. It names no Email, masked or not. */
  readonly verifyLinkedEmailInstruction: string;
}

const ACCESS_AR: AccountAccessCopy = Object.freeze({
  forgotPassword: 'نسيت كلمة المرور؟',
  recoveryTitle: 'إعادة تعيين كلمة المرور',
  emailLabel: 'البريد الإلكتروني',
  sendCode: 'إرسال الرمز',
  invalidEmail: 'أدخل بريدًا إلكترونيًا صحيحًا.',
  recoveryRequested: 'إذا كان هذا البريد مرتبطًا بحساب قنديل، أرسلنا لك رمزًا لإعادة تعيين كلمة المرور.',
  codeLabel: 'رمز إعادة التعيين',
  continueAction: 'متابعة',
  codeShape: 'أدخل رمز إعادة التعيين المكوّن من 6 أرقام.',
  codeRejected: 'تعذّر التحقق من الرمز. تأكد منه أو أرسل رمزًا جديدًا.',
  resendAction: 'لم يصلك الرمز؟ إعادة الإرسال',
  newPasswordLabel: 'كلمة المرور الجديدة',
  confirmPasswordLabel: 'تأكيد كلمة المرور الجديدة',
  passwordMismatch: 'كلمتا المرور غير متطابقتين.',
  changePassword: 'تغيير كلمة المرور',
  passwordRejected: 'كلمة المرور لا تستوفي المتطلبات.',
  updateFailed: 'تعذّر تغيير كلمة المرور الآن. حاول مرة أخرى.',
  passwordChanged: 'تم تغيير كلمة المرور.',
  backToSignIn: 'العودة لتسجيل الدخول',
  network: 'تعذّر الاتصال. حاول مرة أخرى.',
  sessionUnverified: 'تعذّر التحقق من جلستك الآن. تحقق من اتصالك وحاول مرة أخرى.',
  tryAgain: 'إعادة المحاولة',
  verifyLinkedEmailInstruction: 'أدخل رمز التأكيد الذي أُرسل إلى البريد الإلكتروني المرتبط بحسابك.',
});

const ACCESS_EN: AccountAccessCopy = Object.freeze({
  forgotPassword: 'Forgot password?',
  recoveryTitle: 'Reset password',
  emailLabel: 'Email',
  sendCode: 'Send code',
  invalidEmail: 'Enter a valid email address.',
  recoveryRequested: 'If this email is linked to a QANDEEL account, we sent a password reset code.',
  codeLabel: 'Reset code',
  continueAction: 'Continue',
  codeShape: 'Enter the 6-digit reset code.',
  codeRejected: "We couldn't verify this code. Check it or send a new one.",
  resendAction: "Didn't get the code? Send again",
  newPasswordLabel: 'New password',
  confirmPasswordLabel: 'Confirm new password',
  passwordMismatch: "The passwords don't match.",
  changePassword: 'Change password',
  passwordRejected: "The password doesn't meet the requirements.",
  updateFailed: 'We couldn’t change your password right now. Try again.',
  passwordChanged: 'Password changed.',
  backToSignIn: 'Back to sign in',
  network: 'Couldn’t connect. Try again.',
  sessionUnverified: 'We couldn’t verify your session right now. Check your connection and try again.',
  tryAgain: 'Try again',
  verifyLinkedEmailInstruction: 'Enter the verification code sent to the email linked to your account.',
});

/** There is no default language, exactly as W1B-01 refuses one. */
export function accountAccessCopy(language: ChromeLanguage): AccountAccessCopy {
  return language === 'ar' ? ACCESS_AR : ACCESS_EN;
}
