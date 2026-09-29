/**
 * T-14 §6 — the ONE place any word the signed-out reader can see or hear is written, in both Product
 * languages.
 *
 * Every string is frozen by the T-14 contract. That is deliberate and it is not laziness: a Product
 * entry surface is exactly where an implementation task drifts into a copywriting exercise, and the
 * three sentences that matter most here — the three failures — are the ones a well-meaning author is
 * most likely to make more "helpful" and, in doing so, more revealing.
 *
 * ## What may never be said
 *
 * The port's `detail` is a technical description for a log and a typed model. It is never a Product
 * sentence and it never reaches this file: the mapping below takes only the failure KIND, so there is
 * no expression anywhere in this layer that could interpolate a provider's own words into a surface.
 *
 * There is ONE sentence for a rejected credential, not two. Telling a reader that the address is
 * unknown, separately from telling them the password is wrong, is an account-enumeration oracle: it
 * answers "does this person have an account here" to anyone who asks. The frozen copy therefore
 * states only that the pair was not accepted, in both languages.
 *
 * Nothing here greets, personalizes, or claims the reader has a conversation. Before authentication
 * the Product knows nothing about them at all, and a "welcome back" would be the first false note —
 * the same class of lie as a Product surface over a technical phase.
 *
 * ## Register
 *
 * These strings are **T1 · Chrome** under the frozen VI-01 register law: labels, a control, and
 * system-level failure statements. Neutral contemporary Arabic, no displayed case endings, and
 * gender-neutral — the two imperatives («أدخل») are the one form VI-01 §3.6 permits for a control,
 * and every failure is stated object-first so no addressee is inflected at all.
 *
 * VI-01 froze no sign-in vocabulary, so nothing here overrides a frozen term; what it does is apply
 * the register law to words the language system left to ordinary microcopy.
 *
 * ## Numerals and type
 *
 * No string here contains a digit, so the v1 numeral policy is not engaged and no formatter is
 * needed. No bidi control character is embedded in any string. As everywhere else in this app the
 * FONT FAMILY is not set here: which families the app loads is an asset decision, and this module
 * states the assumption rather than silently relying on it.
 */

import type { AuthPortFailure } from '../../runtime-entry';
import type { ChromeLanguage } from '../../orientation-chrome';

/**
 * The failure vocabulary, taken from the frozen port rather than re-declared.
 *
 * This is what makes the mapping below total in the compiler's eyes: if the auth owner ever gained a
 * fourth kind, the exhaustive switch would stop compiling instead of quietly rendering nothing.
 */
export type SignInFailureKind = AuthPortFailure['kind'];

/**
 * Every phrase this surface can produce, in one language. Both packs implement it.
 *
 * W2-01 — the FINAL sign-in (P1 §3, E2E-A-06 / A-07 / A-08 / A-12). The Product Owner approved the
 * identifier label, its persistent help, the generic credential failure and the session-ended notice in
 * the W2-01 task, and the empty-identifier sentence in its copy gate
 * (`docs/e2e/QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md` §2). They replace T-14's Email-only label,
 * empty-Email sentence and "Email or password is incorrect." — P1 §15.3 made that wording historical.
 * Everything else here is T-14's frozen copy, unchanged, including the network sentence.
 */
export interface ProductSignInCopy {
  readonly title: string;
  readonly identifierLabel: string;
  /** Persistent help under the identifier (P1 §2.1 style: never a placeholder). Not a journey. */
  readonly identifierHelp: string;
  readonly passwordLabel: string;
  readonly submit: string;
  /** What the live region says while the one request is in flight. */
  readonly submitting: string;
  readonly missingIdentifier: string;
  readonly missingPassword: string;
  /** ONE sentence for a Login ID and an Email alike: it names neither, and neither's existence. */
  readonly invalidCredentials: string;
  readonly network: string;
  readonly unexpected: string;
  /** Shown only with reliable evidence that an existing authenticated session ended (W2-01 §9.1). */
  readonly sessionEnded: string;
}

const ARABIC: ProductSignInCopy = Object.freeze({
  title: 'تسجيل الدخول',
  identifierLabel: 'معرّف الدخول أو البريد الإلكتروني',
  identifierHelp: 'نسيت معرّف الدخول؟ يمكنك استخدام بريدك الإلكتروني بدلًا منه.',
  passwordLabel: 'كلمة المرور',
  submit: 'دخول',
  submitting: 'جارٍ تسجيل الدخول',
  missingIdentifier: 'أدخل معرّف الدخول أو البريد الإلكتروني.',
  missingPassword: 'أدخل كلمة المرور.',
  invalidCredentials: 'تعذّر تسجيل الدخول بهذه البيانات. تأكد منها وحاول مرة أخرى.',
  network: 'تعذّر الاتصال. حاول مرة أخرى.',
  unexpected: 'تعذّر تسجيل الدخول الآن. حاول مرة أخرى.',
  sessionEnded: 'انتهت جلستك. سجّل الدخول للمتابعة.',
});

const ENGLISH: ProductSignInCopy = Object.freeze({
  title: 'Sign in',
  identifierLabel: 'Login ID or email',
  identifierHelp: 'Forgot your Login ID? You can use your email instead.',
  passwordLabel: 'Password',
  submit: 'Sign in',
  submitting: 'Signing in',
  missingIdentifier: 'Enter your Login ID or email.',
  missingPassword: 'Enter your password.',
  invalidCredentials: 'We couldn’t sign you in with these details. Check them and try again.',
  network: 'Couldn’t connect. Try again.',
  unexpected: 'Couldn’t sign in right now. Try again.',
  sessionEnded: 'Your session has ended. Sign in to continue.',
});

const PACKS: Readonly<Record<ChromeLanguage, ProductSignInCopy>> = Object.freeze({ ar: ARABIC, en: ENGLISH });

/**
 * The reader's pack.
 *
 * The language is an INPUT here and nowhere above here: nothing in this surface decides anything
 * from it, so the two languages cannot disagree about what happened — the failure kind is already
 * settled by the auth owner when the wording is picked.
 */
export function productSignInCopy(language: ChromeLanguage): ProductSignInCopy {
  return PACKS[language];
}

/** One typed failure, as one frozen Product sentence. The `detail` is deliberately not a parameter. */
export function signInFailureMessage(copy: ProductSignInCopy, kind: SignInFailureKind): string {
  switch (kind) {
    case 'INVALID_CREDENTIALS':
      return copy.invalidCredentials;
    case 'NETWORK':
      return copy.network;
    case 'UNEXPECTED':
      return copy.unexpected;
    // W1B-01: the Auth Gateway routes this kind to Email verification before any sentence is chosen.
    // Only a gateway given no route reaches here, and then it has not signed the reader in — true.
    case 'EMAIL_NOT_CONFIRMED':
      return copy.unexpected;
    // W2-01: produced only by a restore, never by a sign-in. Were it ever to reach here, the reader has
    // not been signed in — true — and nothing more is claimed.
    case 'SESSION_ENDED':
      return copy.unexpected;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/**
 * Whether the password field is emptied after this failure (§8).
 *
 * A rejected or unexplained credential is cleared, because the reader is about to type a different
 * one and leaving the old value in a masked field is how a second attempt silently repeats the
 * first. A transport failure is not evidence about the credential at all, so it is kept: asking
 * someone to retype a password because the network dropped is a cost with nothing bought by it.
 */
export function clearsPasswordAfter(kind: SignInFailureKind): boolean {
  switch (kind) {
    case 'INVALID_CREDENTIALS':
      return true;
    case 'NETWORK':
      return false;
    case 'UNEXPECTED':
      return true;
    // W1B-01: the provider accepted the password before reporting the Email unverified.
    case 'EMAIL_NOT_CONFIRMED':
      return false;
    case 'SESSION_ENDED':
      return true;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}
