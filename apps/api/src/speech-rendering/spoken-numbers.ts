/**
 * S8B-04 (CP1, contract v1.2 §6.3 A1 / §6.10 SR-N1) — numbers, dates, times, percentages and counted amounts spoken as
 * words in an Arabic reply. Proven by the Product Owner's L-0 listening (2026-11-01): 4 / 4 numeric misreadings corrected,
 * 0 harmed, 0 less natural.
 *
 * Scope (deliberately narrow, "transform only where a misreading is proven"):
 *   - D/M/YYYY dates, H:MM times, percentages, decimals with a known unit and integers with a known counted noun;
 *   - a bare integer with no known noun is left as written (L-0 found no misreading of one), and so is any number
 *     touching a letter (a model name, "mp3", "COVID-19");
 *   - Modern Standard Arabic wording, in the spoken (oblique) case, in every Arabic reply: whether that reads naturally
 *     inside a dialect sentence is P-1's question (§6.7 c), never guessed here;
 *   - English replies are not transformed (no misreading is on record).
 * Pure and deterministic; the counted-noun table is the reviewed list below, nothing is inferred.
 */

type Gender = 'm' | 'f';

interface CountedNoun {
  readonly singular: string;
  readonly dual: string;
  readonly plural: string;
  readonly gender: Gender;
}

/** The reviewed counted nouns (§11.6 discipline: an entry is added with a test, never inferred). */
const NOUNS: readonly CountedNoun[] = [
  { singular: 'يوم', dual: 'يومين', plural: 'أيام', gender: 'm' },
  { singular: 'أسبوع', dual: 'أسبوعين', plural: 'أسابيع', gender: 'm' },
  { singular: 'شهر', dual: 'شهرين', plural: 'أشهر', gender: 'm' },
  { singular: 'سنة', dual: 'سنتين', plural: 'سنوات', gender: 'f' },
  { singular: 'عام', dual: 'عامين', plural: 'أعوام', gender: 'm' },
  { singular: 'ساعة', dual: 'ساعتين', plural: 'ساعات', gender: 'f' },
  { singular: 'دقيقة', dual: 'دقيقتين', plural: 'دقائق', gender: 'f' },
  { singular: 'ثانية', dual: 'ثانيتين', plural: 'ثوان', gender: 'f' },
  { singular: 'مرة', dual: 'مرتين', plural: 'مرات', gender: 'f' },
  { singular: 'متر', dual: 'مترين', plural: 'أمتار', gender: 'm' },
  { singular: 'كيلومتر', dual: 'كيلومترين', plural: 'كيلومترات', gender: 'm' },
  { singular: 'كيلوغرام', dual: 'كيلوغرامين', plural: 'كيلوغرامات', gender: 'm' },
  { singular: 'لتر', dual: 'لترين', plural: 'لترات', gender: 'm' },
  { singular: 'جنيه', dual: 'جنيهين', plural: 'جنيهات', gender: 'm' },
  { singular: 'دولار', dual: 'دولارين', plural: 'دولارات', gender: 'm' },
  { singular: 'ريال', dual: 'ريالين', plural: 'ريالات', gender: 'm' },
  { singular: 'درهم', dual: 'درهمين', plural: 'دراهم', gender: 'm' },
  { singular: 'دينار', dual: 'دينارين', plural: 'دنانير', gender: 'm' },
  { singular: 'ليرة', dual: 'ليرتين', plural: 'ليرات', gender: 'f' },
];
const NOUN_BY_FORM = new Map<string, CountedNoun>(NOUNS.flatMap((n) => [[n.singular, n], [n.dual, n], [n.plural, n]] as const));

const UNITS: Record<Gender, readonly string[]> = {
  // The counted noun is masculine: 3 - 10 take the feminine form (polarity).
  m: ['صفر', 'واحد', 'اثنين', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'],
  f: ['صفر', 'واحدة', 'اثنتين', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثماني', 'تسع', 'عشر'],
};
const TEENS: Record<Gender, readonly string[]> = {
  m: ['أحد عشر', 'اثني عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'],
  f: ['إحدى عشرة', 'اثنتي عشرة', 'ثلاث عشرة', 'أربع عشرة', 'خمس عشرة', 'ست عشرة', 'سبع عشرة', 'ثماني عشرة', 'تسع عشرة'],
};
const TENS = ['', '', 'عشرين', 'ثلاثين', 'أربعين', 'خمسين', 'ستين', 'سبعين', 'ثمانين', 'تسعين'];
const HUNDREDS = ['', 'مئة', 'مئتين', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];

function below100(n: number, gender: Gender): string {
  if (n <= 10) return UNITS[gender][n];
  if (n < 20) return TEENS[gender][n - 11];
  const unit = n % 10;
  const tens = TENS[Math.floor(n / 10)];
  if (unit === 0) return tens;
  const unitWord = unit === 1 ? (gender === 'f' ? 'إحدى' : 'واحد') : UNITS[gender][unit];
  return `${unitWord} و${tens}`;
}

function below1000(n: number, gender: Gender): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h === 0) return below100(rest, gender);
  return rest === 0 ? HUNDREDS[h] : `${HUNDREDS[h]} و${below100(rest, gender)}`;
}

function scaled(count: number, one: string, two: string, few: string): string {
  if (count === 1) return one;
  if (count === 2) return two;
  if (count >= 3 && count <= 10) return `${UNITS.m[count]} ${few}`;
  return `${below1000(count, 'm')} ${one}`;
}

/** An integer 0 … 999,999,999 in words; `gender` is the counted noun's (the last part agrees with it). */
export function arabicCardinal(n: number, gender: Gender = 'm'): string {
  if (!Number.isSafeInteger(n) || n < 0 || n > 999_999_999) throw new RangeError('arabicCardinal: out of range');
  if (n === 0) return UNITS.m[0];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(scaled(millions, 'مليون', 'مليونين', 'ملايين'));
  if (thousands) parts.push(scaled(thousands, 'ألف', 'ألفين', 'آلاف'));
  if (rest) parts.push(below1000(rest, gender));
  return parts.join(' و');
}

/** The number with its counted noun, agreeing in gender and form (Modern Standard Arabic, spoken oblique case). */
export function arabicCount(n: number, noun: CountedNoun): string {
  if (n === 1) return `${noun.singular} ${noun.gender === 'f' ? 'واحدة' : 'واحد'}`;
  if (n === 2) return noun.dual;
  const lastTwo = n % 100;
  const form = lastTwo >= 3 && lastTwo <= 10 ? noun.plural : noun.singular;
  return `${arabicCardinal(n, noun.gender)} ${form}`;
}

const DAY_ORDINALS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
const DAY_TENS = ['', '', 'العشرين', 'الثلاثين'];
function dayOrdinal(d: number): string {
  if (d <= 10) return DAY_ORDINALS[d];
  if (d === 11) return 'الحادي عشر';
  if (d < 20) return `${DAY_ORDINALS[d - 10]} عشر`;
  const unit = d % 10;
  const tens = DAY_TENS[Math.floor(d / 10)];
  if (unit === 0) return tens;
  return `${unit === 1 ? 'الحادي' : DAY_ORDINALS[unit]} و${tens}`;
}
const MONTHS = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const HOURS = ['الثانية عشرة', 'الواحدة', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة',
  'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];
const hourWord = (h: number): string => HOURS[h % 12 === 0 ? 0 : h % 12];
const MINUTE_NOUN = NOUN_BY_FORM.get('دقيقة') as CountedNoun;

function timeWords(h: number, m: number): string {
  if (m === 0) return hourWord(h);
  if (m === 15) return `${hourWord(h)} والربع`;
  if (m === 20) return `${hourWord(h)} والثلث`;
  if (m === 30) return `${hourWord(h)} والنصف`;
  if (m === 40) return `${hourWord(h + 1)} إلا ثلثًا`;
  if (m === 45) return `${hourWord(h + 1)} إلا ربعًا`;
  return `${hourWord(h)} و${arabicCount(m, MINUTE_NOUN)}`;
}

function fractionWords(intPart: number, digits: string, gender: Gender): string | null {
  if (digits === '5') return `${arabicCardinal(intPart, gender)} ونصف`;
  if (digits === '25') return `${arabicCardinal(intPart, gender)} وربع`;
  if (!/^\d{1,3}$/u.test(digits) || digits.startsWith('0')) return null;
  return `${arabicCardinal(intPart, gender)} فاصلة ${arabicCardinal(Number(digits), 'm')}`;
}

export interface NumberSpan {
  readonly start: number;
  readonly end: number;
  readonly spoken: string;
}

const toLatinDigits = (s: string): string => s.replace(/[٠-٩]/gu, (d) => String(d.charCodeAt(0) - 0x0660));
const D = '[0-9٠-٩]';
// Each pattern is tried at a position not preceded by a letter, digit or digit separator, and must not run into one.
const DATE = new RegExp(`^(${D}{1,2})[/-](${D}{1,2})[/-](${D}{4})`, 'u');
const TIME = new RegExp(`^(${D}{1,2}):(${D}{2})`, 'u');
const PERCENT = new RegExp(`^(${D}{1,3}(?:[.,٫]${D}{1,3})?)\\s?[%٪]`, 'u');
const DECIMAL = new RegExp(`^(${D}{1,6})[.٫](${D}{1,3})`, 'u');
const INTEGER = new RegExp(`^(${D}{1,9})`, 'u');
const FOLLOWING_WORD = /^([  ])([ء-ي]+)/u;
const BOUNDARY_BEFORE = /[\p{L}\p{N}_.,:/٫٬-]/u;
const BOUNDARY_AFTER = /^[\p{L}\p{N}_]/u;
const CONTINUES_NUMBER = /^[.,:/٫٬-][0-9٠-٩]/u;

/**
 * The SR-N1 spans of an Arabic reply: each replaces exactly its source characters with the spoken words. A span never
 * overlaps another. A number this module does not cover produces no span (its digits are left to the provider).
 */
export function arabicNumberSpans(text: string): NumberSpan[] {
  const spans: NumberSpan[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (!/[0-9٠-٩]/u.test(text[i])) continue;
    if (i > 0 && BOUNDARY_BEFORE.test(text[i - 1])) {
      while (i < text.length && /[0-9٠-٩]/u.test(text[i + 1] ?? '')) i += 1;
      continue;
    }
    const rest = text.slice(i);
    const span = matchAt(rest);
    const consumed = span?.length ?? (INTEGER.exec(rest)?.[0].length ?? 1);
    if (span && span.spoken !== null) spans.push({ start: i, end: i + span.length, spoken: span.spoken });
    i += consumed - 1;
  }
  return spans;
}

function ends(rest: string, length: number): boolean {
  const after = rest.slice(length);
  return !BOUNDARY_AFTER.test(after) && !CONTINUES_NUMBER.test(after);
}

function matchAt(rest: string): { length: number; spoken: string | null } | null {
  const date = DATE.exec(rest);
  if (date && ends(rest, date[0].length)) {
    const [d, m, y] = [date[1], date[2], date[3]].map((x) => Number(toLatinDigits(x)));
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1000 && y <= 2999) {
      return { length: date[0].length, spoken: `${dayOrdinal(d)} من ${MONTHS[m]} عام ${arabicCardinal(y)}` };
    }
    return { length: date[0].length, spoken: null };
  }
  const time = TIME.exec(rest);
  if (time && ends(rest, time[0].length)) {
    const h = Number(toLatinDigits(time[1]));
    const m = Number(toLatinDigits(time[2]));
    return { length: time[0].length, spoken: h <= 23 && m <= 59 ? timeWords(h, m) : null };
  }
  const percent = PERCENT.exec(rest);
  if (percent && ends(rest, percent[0].length)) {
    const [intPart, frac] = toLatinDigits(percent[1]).split(/[.,٫]/u);
    const words = frac === undefined ? arabicCardinal(Number(intPart)) : fractionWords(Number(intPart), frac, 'm');
    return { length: percent[0].length, spoken: words === null ? null : `${words} في المئة` };
  }
  const decimal = DECIMAL.exec(rest);
  if (decimal && !CONTINUES_NUMBER.test(rest.slice(decimal[0].length)) && !BOUNDARY_AFTER.test(rest.slice(decimal[0].length))) {
    const noun = countedNounAfter(rest, decimal[0].length);
    if (!noun) return { length: decimal[0].length, spoken: null };
    const intPart = Number(toLatinDigits(decimal[1]));
    const frac = toLatinDigits(decimal[2]);
    if (frac !== '5' || intPart < 1) return { length: decimal[0].length, spoken: null };
    // "3.5 كيلومتر" → "ثلاثة كيلومترات ونصف" (the noun follows its whole count, then the half).
    return { length: noun.end, spoken: `${arabicCount(intPart, noun.noun)} ونصف` };
  }
  const integer = INTEGER.exec(rest);
  if (integer && ends(rest, integer[0].length)) {
    const noun = countedNounAfter(rest, integer[0].length);
    const n = Number(toLatinDigits(integer[1]));
    if (!noun || n < 1) return { length: integer[0].length, spoken: null };
    return { length: noun.end, spoken: arabicCount(n, noun.noun) };
  }
  return null;
}

function countedNounAfter(rest: string, at: number): { noun: CountedNoun; end: number } | null {
  const word = FOLLOWING_WORD.exec(rest.slice(at));
  if (!word) return null;
  const noun = NOUN_BY_FORM.get(word[2]);
  if (!noun) return null;
  const end = at + word[0].length;
  if (BOUNDARY_AFTER.test(rest.slice(end)) || /^[ً-ْ]/u.test(rest.slice(end))) return null;
  return { noun, end };
}
