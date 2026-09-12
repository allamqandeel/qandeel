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

/** Every phrase this surface can produce, in one language. Both packs implement it. */
export interface ProductSignInCopy {
  readonly title: string;
  readonly emailLabel: string;
  readonly passwordLabel: string;
  readonly submit: string;
  /** What the live region says while the one request is in flight. */
  readonly submitting: string;
  readonly missingEmail: string;
  readonly missingPassword: string;
  readonly invalidCredentials: string;
  readonly network: string;
  readonly unexpected: string;
}

const ARABIC: ProductSignInCopy = Object.freeze({
  title: 'تسجيل الدخول',
  emailLabel: 'البريد الإلكتروني',
  passwordLabel: 'كلمة المرور',
  submit: 'دخول',
  submitting: 'جارٍ تسجيل الدخول',
  missingEmail: 'أدخل البريد الإلكتروني.',
  missingPassword: 'أدخل كلمة المرور.',
  invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  network: 'تعذّر الاتصال. حاول مرة أخرى.',
  unexpected: 'تعذّر تسجيل الدخول الآن. حاول مرة أخرى.',
});

const ENGLISH: ProductSignInCopy = Object.freeze({
  title: 'Sign in',
  emailLabel: 'Email',
  passwordLabel: 'Password',
  submit: 'Sign in',
  submitting: 'Signing in',
  missingEmail: 'Enter your email.',
  missingPassword: 'Enter your password.',
  invalidCredentials: 'Email or password is incorrect.',
  network: 'Couldn’t connect. Try again.',
  unexpected: 'Couldn’t sign in right now. Try again.',
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
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}
