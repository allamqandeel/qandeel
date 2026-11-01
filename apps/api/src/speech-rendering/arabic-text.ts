/**
 * S8B-04 (CP1, contract v1.2 §6) — the Arabic text primitives Speech Rendering is built on. Pure: no I/O, no state.
 *
 * A "word" here is a maximal run of Arabic letters, Arabic diacritics and the tatweel; anything else (digits, Latin,
 * punctuation, spaces) separates words. Positions are UTF-16 offsets into the text they were read from, so a span
 * recorded on the visible reply can be copied back exactly (SPOKEN-ALIGN, §6.10).
 */

/** The Arabic diacritics Speech Rendering may add or recognise: tanween, the short vowels, shadda, sukun, dagger alef. */
export const ARABIC_DIACRITICS = /[ً-ْٰ]/u;
const ARABIC_DIACRITICS_GLOBAL = /[ً-ْٰ]/gu;
/** One Arabic word: letters (U+0621–U+064A, U+0671–U+06D3), diacritics and the tatweel. */
export const ARABIC_WORD = /[ء-يً-ْٰٱ-ۓـ]+/gu;
const ARABIC_LETTER = /[ء-يٱ-ۓ]/u;
const LATIN_LETTER = /[A-Za-z]/u;

export interface WordToken {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/** The text without its Arabic diacritics (and without the tatweel). */
export function stripDiacritics(text: string): string {
  return text.replace(ARABIC_DIACRITICS_GLOBAL, '').replace(/ـ/gu, '');
}

export function hasDiacritics(text: string): boolean {
  return ARABIC_DIACRITICS.test(text);
}

/** Every Arabic word of the text with its offsets, in order. */
export function arabicWords(text: string): WordToken[] {
  return [...text.matchAll(ARABIC_WORD)].map((m) => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
}

/**
 * The reply's language for the spoken transforms: Arabic when its Arabic letters are at least as many as its Latin
 * letters, otherwise English. The transforms never guess a dialect: Arabic numbers are spoken in Modern Standard Arabic
 * (§6.3 A1; whether that reads naturally inside a dialect sentence is P-1's question, §6.7 c).
 */
export function replyLanguage(text: string): 'ar' | 'en' {
  let arabic = 0;
  let latin = 0;
  for (const ch of text) {
    if (ARABIC_LETTER.test(ch)) arabic += 1;
    else if (LATIN_LETTER.test(ch)) latin += 1;
  }
  return arabic >= latin ? 'ar' : 'en';
}

/**
 * A canonical form of a diacritized word, so two spellings that differ only in the order of combining marks compare
 * equal: NFC, then a shadda moved before the vowel it carries.
 */
export function canonicalDiacritized(word: string): string {
  return word.normalize('NFC').replace(/([ً-ِْ])ّ/gu, 'ّ$1');
}

/** Sentence-final punctuation (Arabic and Latin) and the line break: what ends a sentence for the hint channel. */
export const SENTENCE_END = /[.!?؟…\n]/u;
