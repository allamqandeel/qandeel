import { normalizeArabicComparison } from '../../memory/arabic-text';

/**
 * S8B-03 (CP1, contract §4.5 step 4) — the CLOSED list of high-impact words. A word in any class heard below T_HIGH makes
 * the whole note LOW. The list is code, shown in the implementation record, and changing it is a governed change.
 * Every entry is compared after the shared Arabic comparison normalizer (memory/arabic-text.ts), so «أ»/«إ»/«آ», «ى»,
 * «ة», tatweel and harakat do not matter, and English is case-folded.
 */
const K1_NEGATION = [
  'مش', 'مو', 'ما', 'لا', 'لأ', 'مفيش', 'مافيش', 'ليس', 'لم', 'لن', 'غير', 'بدون', 'ولا',
  'not', 'no', 'never', "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "won't", "can't", 'cannot', 'nothing', 'nobody',
];
const K2_CHANGE_AND_TIME = [
  'كنت', 'كان', 'كانت', 'بقيت', 'بقى', 'بقت', 'لسه', 'خلاص', 'دلوقتي', 'حاليا', 'زمان', 'سابقا', 'قبل', 'بعد', 'اتغير', 'اتغيرت',
  'used', 'anymore', 'now', 'before', 'after', 'longer', 'changed',
];
const K3_MEMORY_VERBS = [
  'افتكر', 'فاكر', 'احفظ', 'انسى', 'انس', 'امسح', 'احذف', 'شيل', 'صحح', 'عدل', 'غلط',
  'remember', 'forget', 'delete', 'erase', 'correct', 'wrong',
];
const K4_NUMBER_WORDS = [
  'واحد', 'واحدة', 'اثنين', 'اتنين', 'اثنان', 'ثلاثة', 'تلاتة', 'ثلاث', 'تلات', 'أربعة', 'أربع', 'خمسة', 'خمس', 'ستة', 'ست',
  'سبعة', 'سبع', 'ثمانية', 'تمانية', 'ثماني', 'تمان', 'تسعة', 'تسع', 'عشرة', 'عشر',
  'عشرين', 'ثلاثين', 'تلاتين', 'أربعين', 'خمسين', 'ستين', 'سبعين', 'ثمانين', 'تمانين', 'تسعين',
  'مية', 'مائة', 'ميت', 'ألف', 'آلاف', 'مليون',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred', 'thousand',
];
const K4_MONTHS_AND_DAYS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ابريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  'السبت', 'الأحد', 'الاثنين', 'الإثنين', 'الثلاثاء', 'التلات', 'الأربعاء', 'الأربع', 'الخميس', 'الجمعة',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
];

const normalized = (words: readonly string[]) => new Set(words.map((word) => normalizeArabicComparison(word)));

export const HIGH_IMPACT_CLASSES = Object.freeze({
  K1_NEGATION: normalized(K1_NEGATION),
  K2_CHANGE_AND_TIME: normalized(K2_CHANGE_AND_TIME),
  K3_MEMORY_VERBS: normalized(K3_MEMORY_VERBS),
  K4_NUMBERS_AND_DATES: normalized([...K4_NUMBER_WORDS, ...K4_MONTHS_AND_DAYS]),
});

const DIGIT = /[0-9\u{0660}-\u{0669}\u{06F0}-\u{06F9}]/u;
const ARABIC_LETTER = /[\u{0621}-\u{064A}\u{0671}-\u{06D3}]/u;
const LATIN_LETTER = /[A-Za-z]/u;
/** The Egyptian negation pattern: «م…ش», four letters or more (e.g. «مبحبش»). */
const EGYPTIAN_NEGATION = /^م[\u{0621}-\u{064A}]{2,}ش$/u;

/** Whether one recognized word is high-impact; `arabicMajority` says which language the note is mostly in (K5). */
export function isHighImpactWord(raw: string, arabicMajority: boolean): boolean {
  if (DIGIT.test(raw)) return true;
  const word = normalizeArabicComparison(raw);
  if (word === '') return false;
  if (Object.values(HIGH_IMPACT_CLASSES).some((set) => set.has(word))) return true;
  if (EGYPTIAN_NEGATION.test(word)) return true;
  // K5: the other language inside a note mostly in one language.
  return arabicMajority ? LATIN_LETTER.test(word) : ARABIC_LETTER.test(word);
}
