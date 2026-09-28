/**
 * W1B-01 — the account entry's local rules, as pure functions.
 *
 * None of them is an authority over what the identity provider or the database accept. They exist so
 * a reader is told, in approved words and before a round trip, about a field that CANNOT succeed; the
 * provider and the database still decide everything else (migration 0123 enforces the same Login ID
 * grammar and the Name shape against a modified client).
 */

/**
 * The Login ID grammar (P1 §2.1 leaves the regex to implementation), identical to migration 0123 and
 * the API: 3–30 characters of English letters and digits, with `.` `-` `_` allowed only BETWEEN letters
 * and digits. Case-insensitive: the canonical form is lowercase.
 */
export const LOGIN_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
export const LOGIN_ID_MIN_LENGTH = 3;
export const LOGIN_ID_MAX_LENGTH = 30;
/** The account Name's engineering ceiling, enforced by the field itself and by migration 0123. */
export const NAME_MAX_LENGTH = 80;
/** The approved Email verification code is exactly six digits. */
export const EMAIL_CODE_LENGTH = 6;

export type LoginIdVerdict =
  | { readonly kind: 'EMPTY' }
  | { readonly kind: 'MALFORMED' }
  | { readonly kind: 'WELL_FORMED'; readonly canonical: string };

export function judgeLoginId(raw: string): LoginIdVerdict {
  const typed = raw.trim();
  if (typed === '') return { kind: 'EMPTY' };
  const canonical = typed.toLowerCase();
  if (canonical.length < LOGIN_ID_MIN_LENGTH || canonical.length > LOGIN_ID_MAX_LENGTH || !LOGIN_ID_PATTERN.test(canonical)) {
    return { kind: 'MALFORMED' };
  }
  return { kind: 'WELL_FORMED', canonical };
}

/** The Name exactly as it is stored: trimmed. An empty result is the approved "Enter your name." */
export const canonicalName = (raw: string): string => raw.trim();

/**
 * Whether an Email address can possibly be one: something, one `@`, something with a dot. Deliberately
 * permissive — the provider decides the rest, and a stricter local rule would refuse real addresses.
 */
export function isPlausibleEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(raw.trim());
}

/**
 * The code field keeps digits only, at most six. Arabic-Indic (٠–٩) and Extended Arabic-Indic (۰–۹)
 * digits typed on an Arabic keyboard are read as the same digits.
 */
export function normalizeEmailCode(raw: string): string {
  let digits = '';
  for (const char of raw) {
    const point = char.codePointAt(0) ?? 0;
    if (point >= 0x30 && point <= 0x39) digits += char;
    else if (point >= 0x0660 && point <= 0x0669) digits += String(point - 0x0660);
    else if (point >= 0x06f0 && point <= 0x06f9) digits += String(point - 0x06f0);
    if (digits.length === EMAIL_CODE_LENGTH) break;
  }
  return digits;
}
