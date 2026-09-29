/**
 * W3-02 — the Public ID grammar, mirrored from migration 0125 (implementation detail, not Product authority).
 *
 * The DATABASE decides every change; this mirror only lets the reader be told at once that a value can
 * never be a Public ID, and binds one command identity to one requested value. It must say exactly what
 * the database says, and the W3-02 root contract holds the two side by side.
 *
 *   stored     without the `@` the Product shows in front of it;
 *   shape      3–24 lowercase English letters and digits, starting with a letter, `.` or `_` only between
 *              letters and digits;
 *   normalized trimmed, one leading `@` dropped, Arabic-Indic and Extended Arabic-Indic digits → 0–9,
 *              lowercased.
 */
export const PUBLIC_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$/u;
export const PUBLIC_ID_MIN_LENGTH = 3;
export const PUBLIC_ID_MAX_LENGTH = 24;

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

export function normalizePublicId(value: string): string {
  const trimmed = value.trim().replace(/^@/u, '');
  let latin = '';
  for (const character of trimmed) {
    const arabic = ARABIC_INDIC.indexOf(character);
    const extended = EXTENDED_ARABIC_INDIC.indexOf(character);
    latin += arabic >= 0 ? String(arabic) : extended >= 0 ? String(extended) : character;
  }
  return latin.toLowerCase();
}

export function isWellFormedPublicId(normalized: string): boolean {
  return normalized.length >= PUBLIC_ID_MIN_LENGTH && normalized.length <= PUBLIC_ID_MAX_LENGTH && PUBLIC_ID_PATTERN.test(normalized);
}

/** How a Public ID is shown: a handle. The value itself is always shown as isolated left-to-right text. */
export function publicIdHandle(publicId: string): string {
  return `@${publicId}`;
}
