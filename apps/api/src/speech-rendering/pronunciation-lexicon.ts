import { arabicWords, SENTENCE_END, stripDiacritics, type WordToken } from './arabic-text';

/**
 * S8B-04 (CP1, contract v1.2 §6.3 A2 / A3 / A4 / A5, §11.6) — the selective pronunciation lexicon (SR-L1).
 *
 * Every entry is a NON-default reading that the Product Owner's L-0 listening (2026-11-01) proved Gemini misreads without
 * diacritics and reads correctly with them; the common reading of the same letters is read correctly and is never
 * vocalized. No names, no foreign words, no common reading (A4). An entry fires only on its exact undiacritized spelling
 * with its context cue (A3), so a word that already carries a diacritic is never touched.
 *
 * All four are built and tested in CP1 and stay `enabled: false` — not used in production — until P-1 verifies each on
 * NEW sentences (§6.5, §6.7 a). Enabling one is a reviewed code change with its P-1 evidence, never a runtime switch.
 * `MINIMAL` is A5's untested hypothesis (one vowel that decides the reading); it exists to be measured in P-1 and is not
 * selected by any production profile.
 */

export const PRONUNCIATION_LEXICON_VERSION = 'S8B-04-A2-v1';

export interface LexiconContext {
  /** The Arabic word right before (only spaces between, same sentence) is one of these. */
  readonly previousAny?: readonly string[];
  /** The Arabic word right after (only spaces between, same sentence) is one of these. */
  readonly nextAny?: readonly string[];
  /** Some other word of the same sentence is one of these. */
  readonly sentenceAny?: readonly string[];
  /** A word follows in the same sentence ("ملك + اسم أو ضمير"). */
  readonly requireNextWord?: boolean;
  /** A number follows: digits, or a number word (MSA or Egyptian). */
  readonly nextIsNumber?: boolean;
}

export interface LexiconRule {
  readonly written: string;
  readonly spoken: string;
  readonly minimal: string;
  readonly context: LexiconContext;
}

export interface LexiconEntry {
  readonly id: string;
  /** The common reading Gemini already gets right, which this entry must never produce or touch (null: none recorded). */
  readonly defaultReading: string | null;
  /** The L-0 samples behind the entry. */
  readonly evidence: Readonly<Record<string, string>>;
  readonly enabled: boolean;
  readonly rules: readonly LexiconRule[];
}

export const PRONUNCIATION_LEXICON: readonly LexiconEntry[] = Object.freeze<LexiconEntry[]>([
  {
    id: 'A2-01',
    defaultReading: 'المَلِك',
    evidence: { case: 'H07', baseline: 'C0305', rendered: 'C0327', defaultCase: 'H06', defaultSample: 'C0257' },
    enabled: false,
    rules: [{
      written: 'ملك', spoken: 'مِلْك', minimal: 'مِلك',
      context: {
        previousAny: ['بيت', 'البيت', 'أرض', 'الأرض', 'شقة', 'الشقة', 'سيارة', 'السيارة', 'منزل', 'المنزل', 'العقار', 'المحل', 'الدار'],
        requireNextWord: true,
      },
    }],
  },
  {
    id: 'A2-02',
    defaultReading: 'القَدَر',
    evidence: { case: 'H10', baseline: 'C0377', rendered: 'C0385', defaultCase: 'H11', defaultSample: 'C0393' },
    enabled: false,
    rules: [{
      written: 'القدر', spoken: 'القِدْر', minimal: 'القِدر',
      context: {
        previousAny: ['في', 'على'],
        sentenceAny: ['طبخ', 'طبخت', 'أطبخ', 'يطبخ', 'تطبخ', 'نطبخ', 'الطبخ', 'الأرز', 'الرز', 'النار', 'الطعام', 'الأكل', 'الشوربة', 'اللحم', 'الخضار', 'يغلي', 'غلى'],
      },
    }],
  },
  {
    id: 'A2-03',
    defaultReading: 'العَقْد',
    evidence: { case: 'H13', baseline: 'C0425', rendered: 'C0433', defaultCase: 'H12', defaultSample: 'C0409' },
    enabled: false,
    rules: [
      {
        written: 'العقد', spoken: 'العِقْد', minimal: 'العِقد',
        context: { previousAny: ['لبس', 'لبست', 'ارتدت', 'ارتدى', 'تلبس', 'يلبس'] },
      },
      {
        written: 'عقد', spoken: 'عِقْد', minimal: 'عِقد',
        context: { nextAny: ['ذهب', 'الذهب', 'ذهبي', 'لؤلؤ', 'اللؤلؤ', 'ألماس', 'الألماس', 'الماس'] },
      },
    ],
  },
  {
    id: 'A2-04',
    defaultReading: null,
    evidence: { case: 'H29', baseline: 'C0577', rendered: 'C0583', dialect: 'EGYPTIAN' },
    enabled: false,
    rules: [{ written: 'عمري', spoken: 'عُمْري', minimal: 'عُمري', context: { nextIsNumber: true } }],
  },
]);

/** OFF: no entry. ENABLED_ONLY: production (only entries P-1 enabled). ALL_CANDIDATES: tests and P-1 only. */
export type LexiconMode = 'OFF' | 'ENABLED_ONLY' | 'ALL_CANDIDATES';
/** FULL: the reviewed full vocalization. MINIMAL: A5's hypothesis, for P-1 only. */
export type DiacriticsForm = 'FULL' | 'MINIMAL';

export interface LexiconSpan {
  readonly start: number;
  readonly end: number;
  readonly spoken: string;
  readonly entryId: string;
}

const NUMBER_WORDS = new Set([
  'واحد', 'واحدة', 'اثنين', 'اثنتين', 'اتنين', 'ثلاث', 'ثلاثة', 'تلات', 'تلاتة', 'أربع', 'أربعة', 'اربع', 'اربعة', 'خمس',
  'خمسة', 'ست', 'ستة', 'سبع', 'سبعة', 'ثماني', 'ثمانية', 'تمن', 'تمانية', 'تسع', 'تسعة', 'عشر', 'عشرة', 'عشرين', 'ثلاثين',
  'تلاتين', 'أربعين', 'اربعين', 'خمسين', 'ستين', 'سبعين', 'ثمانين', 'تمانين', 'تسعين', 'مئة', 'مية', 'ميت',
]);

/** Only spaces (no punctuation, no line break) between two offsets. */
const onlySpaces = (text: string, from: number, to: number): boolean => /^[ \t ]*$/u.test(text.slice(from, to));

function sentenceRange(text: string, at: number): [number, number] {
  let start = at;
  while (start > 0 && !SENTENCE_END.test(text[start - 1])) start -= 1;
  let end = at;
  while (end < text.length && !SENTENCE_END.test(text[end])) end += 1;
  return [start, end];
}

function contextHolds(text: string, words: readonly WordToken[], i: number, context: LexiconContext): boolean {
  const word = words[i];
  const [sStart, sEnd] = sentenceRange(text, word.start);
  const prev = i > 0 && words[i - 1].start >= sStart && onlySpaces(text, words[i - 1].end, word.start) ? words[i - 1] : null;
  const next = i + 1 < words.length && words[i + 1].end <= sEnd && onlySpaces(text, word.end, words[i + 1].start) ? words[i + 1] : null;
  if (context.previousAny && !(prev && context.previousAny.includes(prev.text))) return false;
  if (context.nextAny && !(next && context.nextAny.includes(next.text))) return false;
  if (context.requireNextWord && !next) return false;
  if (context.sentenceAny) {
    const others = words.filter((w, j) => j !== i && w.start >= sStart && w.end <= sEnd).map((w) => stripDiacritics(w.text));
    if (!others.some((w) => context.sentenceAny!.includes(w))) return false;
  }
  if (context.nextIsNumber) {
    const after = /^[ \t ]+([0-9٠-٩]+|[ء-ي]+)/u.exec(text.slice(word.end, sEnd));
    if (!after || !(/^[0-9٠-٩]/u.test(after[1]) || NUMBER_WORDS.has(after[1]))) return false;
  }
  return true;
}

/**
 * The SR-L1 spans of a text. An entry fires only on a word EXACTLY equal to its undiacritized spelling (so a word with any
 * diacritic, or a different word sharing the letters, never fires) and only when its context cue holds.
 */
export function lexiconSpans(
  text: string,
  options: { readonly mode: LexiconMode; readonly form?: DiacriticsForm },
  lexicon: readonly LexiconEntry[] = PRONUNCIATION_LEXICON,
): LexiconSpan[] {
  if (options.mode === 'OFF') return [];
  const entries = lexicon.filter((e) => options.mode === 'ALL_CANDIDATES' || e.enabled);
  if (entries.length === 0) return [];
  const words = arabicWords(text);
  const spans: LexiconSpan[] = [];
  words.forEach((word, i) => {
    for (const entry of entries) {
      const rule = entry.rules.find((r) => r.written === word.text && contextHolds(text, words, i, r.context));
      if (rule) {
        spans.push({ start: word.start, end: word.end, spoken: options.form === 'MINIMAL' ? rule.minimal : rule.spoken, entryId: entry.id });
        return;
      }
    }
  });
  return spans;
}

/** Every reading this lexicon would produce, written → spoken (for the B_FILTERED registry and the SR-L1 check). */
export function lexiconReadings(lexicon: readonly LexiconEntry[] = PRONUNCIATION_LEXICON): ReadonlyArray<{ written: string; spoken: readonly string[]; defaultReading: string | null }> {
  return lexicon.flatMap((e) => e.rules.map((r) => ({ written: r.written, spoken: [r.spoken, r.minimal], defaultReading: e.defaultReading })));
}
