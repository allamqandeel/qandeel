// MEM-AR-01A — the ONE Arabic comparison normalizer shared by the Memory duplicate key, Memory retrieval tokens and
// Memory-control resolution.
//
// It is for COMPARISON only: no stored sentence is ever rewritten by it (a Memory keeps the user's own words, PD-4).
// The frozen 0028 Evidence key (`normalizeExact`) and its golden parity fixtures are a different function and stay
// byte-unchanged.
//
// Every operation is enumerated by code point, in a fixed order, so that it can be mirrored one-to-one in SQL (01C's
// `memory_equivalence_key_v1`: normalize(NFKC) → translate → regexp_replace). Nothing here depends on the runtime
// locale:
//   1. Unicode NFKC.
//   2. Remove tatweel U+0640 and the harakat U+064B–U+065F and U+0670.
//   3. Fold U+0622 U+0623 U+0625 (آ أ إ) → U+0627 (ا), U+0649 (ى) → U+064A (ي), U+0629 (ة) → U+0647 (ه).
//   4. Arabic-Indic digits U+0660–U+0669 → ASCII 0–9.
//   5. ASCII case fold A–Z → a–z (only ASCII: the SQL mirror must not depend on a collation).
//   6. Each of the 25 Unicode White_Space code points → U+0020; runs collapse to one space; trim.
//   7. Remove a terminal run of . ! ? U+061F U+060C , ; U+061B : and trim again.
// Pure and CPU-only: no import, no I/O. Code points are written as escapes so the source carries no invisible character.

const MARKS = /[\u{0640}\u{064B}-\u{065F}\u{0670}]/gu;
const ALEF_FORMS = /[\u{0622}\u{0623}\u{0625}]/gu;
const ALEF_MAKSURA = /\u{0649}/gu;
const TA_MARBUTA = /\u{0629}/gu;
const ARABIC_INDIC_DIGITS = /[\u{0660}-\u{0669}]/gu;
const ASCII_UPPER = /[A-Z]/gu;
/** The 25 code points with the Unicode White_Space property. */
const WHITE_SPACE = /[\u{0009}-\u{000D}\u{0020}\u{0085}\u{00A0}\u{1680}\u{2000}-\u{200A}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}]+/gu;
const TERMINAL_PUNCTUATION = /[.!?\u{061F}\u{060C},;\u{061B}:]+$/u;
/** Only U+0020 at either end (String.prototype.trim would also remove U+FEFF, which SQL's btrim(' ') keeps). */
const EDGE_SPACES = /^ +| +$/gu;

export function normalizeArabicComparison(value: string): string {
  return value.normalize('NFKC')
    .replace(MARKS, '')
    .replace(ALEF_FORMS, String.fromCodePoint(0x0627)).replace(ALEF_MAKSURA, String.fromCodePoint(0x064A)).replace(TA_MARBUTA, String.fromCodePoint(0x0647))
    .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.codePointAt(0)! - 0x0660))
    .replace(ASCII_UPPER, (letter) => letter.toLowerCase())
    .replace(WHITE_SPACE, ' ').replace(EDGE_SPACES, '')
    .replace(TERMINAL_PUNCTUATION, '').replace(EDGE_SPACES, '');
}

// The established light stem (moved unchanged from memory-control.resolution.ts, W3-MEGA-M): one Arabic clitic prefix
// before at least three more Arabic letters, then, on a word of four or more letters, one pronoun suffix. An English
// token loses a plural "s" (not "ss"). It expects a token already passed through the normalizer.
const ARABIC_PREFIX = /^(?:وال|بال|فال|كال|لل|ال|و|ب|ف)(?=[؀-ۿ]{3,})/u;
const ARABIC_SUFFIX = /(?:هم|كم|نا|ها|ي|ك|ه)$/u;

export function lightArabicStem(token: string): string {
  if (/^[؀-ۿ]+$/u.test(token)) {
    let word = token.replace(ARABIC_PREFIX, '');
    if (word.length >= 4) word = word.replace(ARABIC_SUFFIX, '');
    return word;
  }
  return token.length > 3 && token.endsWith('s') && !token.endsWith('ss') ? token.slice(0, -1) : token;
}
