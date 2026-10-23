// S8A-03 CP2 — the deterministic server verifier of Personal Understanding proposals.
//
// DeepSeek proposes; this file decides what may be kept. A fact proposal is kept only when the user's own words agree
// with every reading the model claims, so a model mistake can drop a fact but cannot invent one:
//   * the span is a verbatim part of the current message, and the kept Memory is exactly those words (no paraphrase,
//     no inference, no re-gendering) - so the model can never put words in the user's mouth;
//   * whose fact: the model must say SELF, the words must carry a first-person signal (in the clause, or earlier in a
//     sentence that names no one else), and a third-party subject or second-person address in the clause is refused
//     unless the span itself says «أنا» / "I";
//   * stated, not asked, supposed, wished, reported or quoted: a question clause, a conditional before the span, a
//     reporting verb or quotation before it, or a hedge in the clause is refused;
//   * negation: an AFFIRMED reading is refused when the clause negates, and a NEGATED reading is kept only when the
//     negation is inside the kept words, so «أنا مش بدخن» can never be stored as «بدخن»;
//   * time: a past marker in the clause requires PAST, a TEMPORARY reading requires an explicit near time («بكرة»,
//     «الأسبوع ده») and gets the evaluator's expiry, and a passing emotion is never kept;
//   * the existing secret screen, length bounds, and the 01A duplicate / reversal screen against current Memories.
// Everything here is lexical and closed: no network, no model, no randomness except the new Memory identity.
import { randomUUID } from 'node:crypto';
import { normalizeArabicComparison } from '../memory/arabic-text';
import { memoryIndexTerms } from '../memory/memory-retrieval-terms';
import { containsObviousSecret, MEMORY_IMPORTANCE, normalizeMemoryContent, screenMemoryCapture } from '../memory/memory-write-evaluator.service';
import type { MemoryRecord, MemoryType } from '../memory/memory.types';
import {
  MAX_UNDERSTANDING_FACTS,
  MAX_UNDERSTANDING_KEY_LENGTH,
  MAX_UNDERSTANDING_KEYS,
  MAX_UNDERSTANDING_SPAN_CHARS,
  UNDERSTANDING_FACT_TYPES,
  UNDERSTANDING_MODALITIES,
  UNDERSTANDING_POLARITIES,
  UNDERSTANDING_SLOTS,
  UNDERSTANDING_SUBJECTS,
  UNDERSTANDING_TEMPORALS,
  type UnderstandingFactProposal,
  type UnderstandingMemoryProposal,
  type UnderstandingRejection,
  type UnderstandingSlot,
  type UnderstandingTemporal,
  type VerifiedUnderstandingIndex,
  type VerifiedUnderstandingItem,
} from './personal-understanding.types';

const L = '\\p{L}\\p{N}_';
/** A whole folded word (or phrase) from a closed list, optionally after the clitic و / ف. */
function wordList(words: readonly string[]): RegExp {
  return new RegExp(`(?<![${L}])(?:[وف])?(?:${words.join('|')})(?![${L}])`, 'u');
}

// Every list is matched against folded text (the MEM-AR-01A comparison normalizer: أ إ آ → ا, ة → ه, ى → ي, ASCII
// lower case), so each entry is written in that folded form.
const FIRST_PERSON = wordList([
  'انا', 'اني', 'انني', 'عندي', 'ليا', 'معايا', 'بتاعي', 'بتاعتي', 'عليا', 'لوحدي', 'كنت',
  'شغلي', 'وظيفتي', 'شغلانتي', 'مهنتي', 'بيتي', 'شقتي', 'سكني', 'دراستي', 'كليتي', 'جامعتي', 'مدرستي', 'تخصصي',
  'حياتي', 'هدفي', 'حلمي', 'اسمي', 'سني', 'عمري', 'صحتي', 'هوايتي', 'هواياتي', 'شركتي', 'عيلتي', 'اسرتي', 'مرتبي',
  'راتبي', 'عربيتي', 'اكلي', 'نومي', 'وزني', 'رياضتي', 'خطتي', 'مشروعي',
  // S8A-03 CP3 D-1: Modern Standard Arabic «لديّ» («I have»); «لديه» / «لديك» are other people and never match.
  'لدي',
  'i', "i'm", 'im', "i've", 'ive', 'my', 'me', 'myself', 'mine',
]);
/** Egyptian first-person verb forms: «بـ» / «هـ» + a stem that is not «ي / ت / ن» (he / you / we), or a past «…ت». */
const IMPERFECT_FIRST_PERSON = /^[به][^يتن\s][\p{L}]{2,}$/u;
const PAST_FIRST_PERSON = /^[\p{L}]{3,}ت$/u;
const NOT_A_VERB = new Set([
  'بس', 'بعد', 'بعدين', 'بكره', 'بكرا', 'بلد', 'بيت', 'برا', 'بره', 'باب', 'بنك', 'بالظبط', 'برده', 'برضه', 'برضو', 'بقي', 'بين', 'بدل',
  'بسبب', 'بالنسبه', 'بتاع', 'بشكل', 'بطريقه', 'بلاش', 'بحر', 'بنزين', 'بطاطس', 'هنا', 'هناك', 'هدف', 'هديه', 'هوا', 'هوايه',
  'بنت', 'وقت', 'تحت', 'صوت', 'زيت', 'موت', 'سبت', 'كانت', 'قالت', 'راحت', 'جت', 'انترنت', 'بيروت', 'كويت', 'الكويت',
]);
const THIRD_PARTY = wordList([
  'اخويا', 'اخوي', 'اختي', 'ابويا', 'ابوي', 'بابا', 'ماما', 'امي', 'والدي', 'والدتي', 'ابني', 'بنتي', 'مراتي', 'جوزي',
  'خطيبي', 'خطيبتي', 'صاحبي', 'صاحبتي', 'صحبتي', 'عمي', 'عمتي', 'خالي', 'خالتي', 'جدي', 'جدتي', 'جاري', 'جارتي',
  'زميلي', 'زميلتي', 'مديري', 'مديرتي', 'ولادي', 'عيالي', 'اهلي', 'اصحابي', 'حماتي', 'حمايا',
  // S8A-03 CP3 D-1: the Modern Standard Arabic kin, so a first-person MSA clause never carries the user over to theirs
  // («أسكن في القاهرة، وزوجي يعمل مهندسًا»).
  'اخي', 'ابي', 'زوجي', 'زوجتي', 'ابنتي', 'صديقي', 'صديقتي', 'اولادي', 'اطفالي', 'ابنائي', 'بناتي', 'اصدقائي', 'زملائي',
  'هو', 'هي', 'هما', 'هم', 'انت', 'انتي', 'انتو', 'انتم',
  'he', 'she', 'they', 'you', 'his', 'her', 'their', 'your',
  'brother', 'sister', 'mother', 'father', 'mom', 'dad', 'son', 'daughter', 'wife', 'husband', 'fiance', 'fiancee',
  'boyfriend', 'girlfriend', 'partner', 'friend', 'boss', 'manager', 'colleague', 'neighbor', 'neighbour', 'uncle', 'aunt',
  'cousin', 'parents', 'kids', 'children',
]);
const EXPLICIT_SELF = wordList(['انا', 'اني', 'i', "i'm", 'im']);
const QUESTION_START = wordList([
  'هل', 'ليه', 'ازاي', 'امتي', 'فين', 'مين', 'ايه', 'ماذا', 'لماذا', 'كيف', 'متي', 'اين',
  'why', 'what', 'when', 'where', 'who', 'how', 'do', 'does', 'did', 'is', 'are', 'can', 'could', 'should',
]);
const HYPOTHETICAL = wordList([
  'لو', 'اذا', 'افرض', 'افترض', 'فرضا', 'تخيل', 'لنفترض', 'ياريت', 'يا ريت', 'if', 'unless', 'suppose', 'imagine', 'would', 'wish',
]);
const REPORTED = wordList([
  'قال', 'قالت', 'قالوا', 'قالي', 'قاللي', 'قالتلي', 'قالولي', 'بيقول', 'بتقول', 'بيقولوا', 'بيقولو', 'يقول', 'تقول', 'سمعت',
  'حسب كلام', 'said', 'says', 'told', 'heard', 'according',
]);
const QUOTE_MARK = /["“”«»]/u;
const SPECULATIVE = wordList([
  'يمكن', 'ممكن', 'غالبا', 'اظن', 'اعتقد', 'احتمال', 'مش متاكد', 'maybe', 'perhaps', 'probably', 'guess', 'think', 'might',
]);
const NEGATION = wordList([
  'مش', 'مو', 'مب', 'ما', 'لا', 'ليس', 'لست', 'لم', 'لن', 'مفيش', 'محدش', 'ولا', 'never', 'not', 'no', 'dont', 'doesnt',
  'didnt', 'isnt', 'arent', 'wasnt', 'havent', 'cannot', 'cant', 'wont',
  // Cessation negates the present: «بطلت أدخن» says the user no longer smokes (the prompt: "does not, or no longer").
  'بطلت', 'بطلنا', 'quit', 'stopped',
]);
const NEGATED_VERB = /(?<![\p{L}\p{N}_])م[\p{L}]{2,}ش(?![\p{L}\p{N}_])|n't(?![\p{L}])/u;
const PAST_MARKER = wordList(['كنت', 'كنا', 'زمان', 'سابقا', 'قبل كده', 'قبل كدا', 'used to', 'formerly', 'previously']);
const NEAR_TIME = wordList([
  'النهارده', 'انهارده', 'اليوم', 'بكره', 'بكرا', 'غدا', 'بعد بكره', 'الليله دي', 'الاسبوع ده', 'الاسبوع الجاي',
  'الاسبوع اللي جاي', 'الشهر ده', 'الشهر الجاي', 'اليومين دول', 'اليومين الجايين', 'الايام دي',
  'today', 'tomorrow', 'tonight', 'this week', 'next week', 'this month', 'these days',
]);
const LONGER_NEAR_TIME = wordList(['الاسبوع ده', 'الاسبوع الجاي', 'الاسبوع اللي جاي', 'الشهر ده', 'الشهر الجاي', 'اليومين الجايين', 'الايام دي', 'this week', 'next week', 'this month', 'these days']);
const TRANSIENT_EMOTION = wordList([
  'متضايق', 'متضايقه', 'زعلان', 'زعلانه', 'غضبان', 'غضبانه', 'مبسوط', 'مبسوطه', 'فرحان', 'فرحانه', 'تعبان', 'تعبانه',
  'زهقان', 'زهقانه', 'قلقان', 'قلقانه', 'مخنوق', 'مخنوقه', 'upset', 'sad', 'angry', 'happy', 'tired', 'bored', 'anxious',
]);
const CLAUSE_BREAK = /[،,;؛.!?؟\n]/u;
const SENTENCE_BREAK = /[.!?؟\n]/u;

function clean(value: string): string { return value.normalize('NFKC').trim().replace(/\s+/gu, ' '); }
function fold(value: string): string { return normalizeArabicComparison(value.replace(/[’`]/gu, "'")); }
function hasWord(pattern: RegExp, text: string): boolean { return pattern.test(fold(text)); }

/** The bounds of the region around [start, end) delimited by `breaks` (the delimiter that ends it is returned too). */
function region(text: string, start: number, end: number, breaks: RegExp): { from: number; to: number; terminator: string } {
  let from = start;
  while (from > 0 && !breaks.test(text[from - 1])) from -= 1;
  let to = end;
  while (to < text.length && !breaks.test(text[to])) to += 1;
  return { from, to, terminator: text[to] ?? '' };
}

function verbForms(text: string): boolean {
  // The clitic «و» / «ف» is not part of the verb: «وبشتغل» is «بشتغل».
  return (fold(text).match(/[\p{L}']+/gu) ?? []).map((token) => token.replace(/^[وف](?=[به])/u, '')).some((token) =>
    !NOT_A_VERB.has(token) && !token.startsWith('بال') && !token.endsWith('ات') &&
    (IMPERFECT_FIRST_PERSON.test(token) || PAST_FIRST_PERSON.test(token)));
}

// S8A-03 CP3 D-1: the Modern Standard Arabic first-person imperfect («أعمل حاليًا ممرضة», «أسكن في الإسكندرية», «لا أدخن»).
// Its «أ» prefix is read only as written, with the hamza (folding erases it, and a bare «ا» opens the article and most
// nouns), only at the head of a clause (after «و» / «ف», a closed adverb or a negation), and never in a closed list of
// words of that shape that are not a first-person verb: kin («أختي»), pronouns («أنت», «أنها»), adverbs («أيضًا»), the
// comparative at a clause head («أحسن», «أكثر»), names and months. «يـ» / «تـ» / «نـ» (he, she or you, we) never match.
const MSA_IMPERFECT_FIRST_PERSON = /^أ[\p{L}]{3,5}$/u;
const MSA_CLAUSE_LEAD = new Set(['حاليا', 'الآن', 'الان', 'أيضا', 'ايضا', 'كذلك', 'لكن', 'ولكن', 'بل', 'ثم', 'كما', 'لا', 'لم', 'لن']);
const NOT_AN_MSA_VERB = new Set([
  'أنت', 'أنتي', 'أنتم', 'أنتما', 'أنتن', 'أنتو', 'أنها', 'أنهم', 'أنهما', 'أنكم', 'أنكن', 'أننا', 'أنني',
  'أيضا', 'أحيانا', 'أخيرا', 'أولا', 'أصلا', 'أساسا', 'أبدا', 'أكيد', 'أمام', 'أثناء', 'أسفل', 'أخرى', 'أخري', 'أمبارح',
  'أكثر', 'أقل', 'أكبر', 'أصغر', 'أحسن', 'أفضل', 'أسوأ', 'أجمل', 'أحلى', 'أطول', 'أقصر', 'أقرب', 'أبعد', 'أهم', 'أغلى',
  'أرخص', 'أسرع', 'أصعب', 'أسهل', 'أعلى', 'أولى',
  'أختي', 'أخويا', 'أخوي', 'أبويا', 'أبوي', 'أهلي', 'أولاد', 'أولادي', 'أطفال', 'أطفالي', 'أبنائي', 'أصحاب', 'أصحابي',
  'أصدقاء', 'أصدقائي', 'أقارب', 'أقاربي', 'أخواتي', 'أسرة', 'أسرتي', 'أستاذ', 'أستاذة', 'أسبوع', 'أسابيع', 'أيام', 'أشهر',
  'أحمد', 'أشرف', 'أسامة', 'أيمن', 'أسماء', 'أميرة', 'أنور', 'أكرم', 'أمين', 'أمينة', 'أحلام', 'أمجد', 'أدهم',
  'أكتوبر', 'أبريل', 'أغسطس', 'أمريكا', 'أوروبا', 'ألمانيا', 'أسيوط', 'أسوان',
]);
function msaFirstPerson(text: string): boolean {
  const raw = text.normalize('NFKC').replace(/[ـً-ٰٟ]/gu, '');
  return raw.split(CLAUSE_BREAK).some((clause) => {
    for (const token of clause.match(/[\p{L}]+/gu) ?? []) {
      const word = token.replace(/^[وف](?=أ)/u, '');
      if (MSA_IMPERFECT_FIRST_PERSON.test(word) && !NOT_AN_MSA_VERB.has(word)) return true;
      if (!MSA_CLAUSE_LEAD.has(word)) return false;
    }
    return false;
  });
}

/** Whether a message carries any first-person signal at all: the pre-screen that decides if it is worth a proposal. */
export function carriesFirstPersonSignal(message: string): boolean {
  return hasWord(FIRST_PERSON, message) || verbForms(message) || msaFirstPerson(message);
}

function enumValue<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function boundedKeys(keys: unknown): string[] | undefined {
  if (!Array.isArray(keys) || keys.length > MAX_UNDERSTANDING_KEYS) return undefined;
  if (keys.some((key) => typeof key !== 'string' || key.trim().length === 0 || [...key].length > MAX_UNDERSTANDING_KEY_LENGTH)) return undefined;
  return keys as string[];
}

/** The kept words: the span as said - terminal punctuation trimmed, «انا» → «أنا», one full stop - nothing else. */
function asSaid(span: string): string {
  return `${span.trim().replace(/[.!؟?،,;:]+$/gu, '').trim().replace(/^انا(?=\s)/u, 'أنا')}.`;
}

export type FactVerdict = { readonly kept: VerifiedUnderstandingItem } | { readonly rejected: UnderstandingRejection };

/** Verifies ONE fact proposal against the current message. Pure apart from the new Memory identity. */
export function verifyFactProposal(proposal: UnderstandingFactProposal, message: string, now: Date): FactVerdict {
  const p = proposal as Partial<Record<keyof UnderstandingFactProposal, unknown>>;
  const keys = boundedKeys(p.keys);
  if (typeof p.span !== 'string' || !enumValue(p.subject, UNDERSTANDING_SUBJECTS) || !enumValue(p.polarity, UNDERSTANDING_POLARITIES) ||
      !enumValue(p.modality, UNDERSTANDING_MODALITIES) || !enumValue(p.temporal, UNDERSTANDING_TEMPORALS) ||
      !enumValue(p.type, UNDERSTANDING_FACT_TYPES) || !(p.slot === null || enumValue(p.slot, UNDERSTANDING_SLOTS)) || !keys) {
    return { rejected: 'MALFORMED' };
  }
  if (p.subject !== 'SELF') return { rejected: 'NOT_SELF' };
  if (p.modality !== 'STATED') return { rejected: 'NOT_A_STATEMENT' };

  const text = clean(message);
  const span = clean(p.span).replace(/[.!؟?،,;:]+$/gu, '').trim();
  const words = span.split(' ').filter(Boolean);
  if (words.length < 2 || [...span].length > MAX_UNDERSTANDING_SPAN_CHARS) return { rejected: 'TOO_SHORT_OR_LONG' };
  const start = text.indexOf(span);
  if (start < 0) return { rejected: 'NOT_VERBATIM' };
  const end = start + span.length;
  if (containsObviousSecret(span)) return { rejected: 'SENSITIVE_DATA' };

  const clause = region(text, start, end, CLAUSE_BREAK);
  const sentence = region(text, start, end, SENTENCE_BREAK);
  const clauseText = text.slice(clause.from, clause.to);
  const leadIn = text.slice(clause.from, end);
  const sentenceLeadIn = text.slice(sentence.from, end);

  if (clause.terminator === '?' || clause.terminator === '؟' || QUESTION_START.test(fold(clauseText).split(' ')[0] ?? '')) {
    return { rejected: 'QUESTION' };
  }
  if (hasWord(HYPOTHETICAL, sentenceLeadIn)) return { rejected: 'HYPOTHETICAL' };
  if (hasWord(REPORTED, text.slice(sentence.from, start)) ||
      (QUOTE_MARK.test(text.slice(sentence.from, start)) && QUOTE_MARK.test(text.slice(end, sentence.to + 1)))) {
    return { rejected: 'QUOTED_OR_REPORTED' };
  }
  if (hasWord(SPECULATIVE, clauseText)) return { rejected: 'SPECULATIVE' };

  const negatedSpan = hasWord(NEGATION, span) || NEGATED_VERB.test(fold(span));
  const negatedClause = hasWord(NEGATION, clauseText) || NEGATED_VERB.test(fold(clauseText));
  if (p.polarity === 'AFFIRMED' ? negatedClause : !negatedSpan) return { rejected: 'NEGATION_MISMATCH' };

  if (hasWord(THIRD_PARTY, leadIn) && !hasWord(EXPLICIT_SELF, span)) return { rejected: 'THIRD_PARTY' };
  // The subject of an Arabic clause carries over from earlier in the same sentence («أنا ساكن في المعادي، ومتجوز من
  // سنتين»), but only when nothing in that sentence names or addresses anyone else («أخويا ساكن …، ومتجوز» is his).
  if (!carriesFirstPersonSignal(leadIn) &&
      !(carriesFirstPersonSignal(sentenceLeadIn) && !hasWord(THIRD_PARTY, sentenceLeadIn))) return { rejected: 'NO_FIRST_PERSON' };
  // A span that opens with a «بيـ» verb («بيشتغل», «بيحب») is about him, never the user. («بتـ» / «بنـ» are left to the
  // checks above: «بتجوز», «بنام» are also first person in Egyptian Arabic.)
  if (/^بي[\p{L}]{2,}$/u.test(fold(words[0])) && !NOT_A_VERB.has(fold(words[0]))) return { rejected: 'THIRD_PARTY' };

  if (hasWord(PAST_MARKER, clauseText) && p.temporal !== 'PAST') return { rejected: 'TEMPORAL_MISMATCH' };
  const temporary = p.temporal === 'TEMPORARY';
  if (temporary !== (p.type === 'TEMPORARY_STATE')) return { rejected: 'TEMPORAL_MISMATCH' };
  if (temporary && !hasWord(NEAR_TIME, clauseText)) return { rejected: 'TEMPORAL_MISMATCH' };
  if (temporary && hasWord(TRANSIENT_EMOTION, span)) return { rejected: 'TRANSIENT_EMOTION' };

  const content = asSaid(span);
  const days = temporary && hasWord(LONGER_NEAR_TIME, clauseText) ? 14 : 2;
  return {
    kept: {
      memoryId: randomUUID(),
      type: p.type,
      content,
      importance: MEMORY_IMPORTANCE[p.type],
      expiresAt: temporary ? new Date(now.getTime() + days * 86_400_000).toISOString() : null,
      slot: p.temporal === 'PLANNED' ? null : p.slot,
      temporal: p.temporal,
      terms: memoryIndexTerms(content, keys),
    },
  };
}

/**
 * Verifies every fact proposal of one answer: at most three kept, none a duplicate of another kept one or of a current
 * Memory of the same type (01A), and no «بطلت …» that may reverse a current Memory (01A: only a correction may).
 */
export function verifyFactProposals(
  proposals: readonly UnderstandingFactProposal[],
  message: string,
  current: ReadonlyArray<Pick<MemoryRecord, 'type' | 'content'>>,
  now: Date,
): { readonly kept: readonly VerifiedUnderstandingItem[]; readonly rejected: readonly UnderstandingRejection[] } {
  const kept: VerifiedUnderstandingItem[] = [];
  const rejected: UnderstandingRejection[] = [];
  const seen = new Set<string>();
  for (const proposal of proposals) {
    const verdict = verifyFactProposal(proposal, message, now);
    if ('rejected' in verdict) { rejected.push(verdict.rejected); continue; }
    const key = normalizeMemoryContent(verdict.kept.content);
    if (seen.has(key)) { rejected.push('DUPLICATE'); continue; }
    const screen = screenMemoryCapture(verdict.kept, current);
    if (screen) { rejected.push(screen === 'EXACT_NORMALIZED_DUPLICATE' ? 'DUPLICATE' : 'REVERSAL_NEEDS_CORRECTION'); continue; }
    if (kept.length >= MAX_UNDERSTANDING_FACTS) { rejected.push('MALFORMED'); continue; }
    seen.add(key);
    kept.push(verdict.kept);
  }
  return { kept, rejected };
}

/**
 * The backfill index rows. Every supplied Memory is indexed under its own words; a valid proposal for its handle adds
 * its keys, slot and time standing. A slot is kept only when the Memory's own words do not contradict it (a past
 * marker without PAST drops the slot), and a TEMPORARY_STATE Memory is always TEMPORARY. Unknown handles are ignored.
 */
export function verifyMemoryProposals(
  proposals: readonly UnderstandingMemoryProposal[],
  memories: ReadonlyArray<{ readonly handle: string; readonly memoryId: string; readonly type: MemoryType; readonly content: string }>,
): VerifiedUnderstandingIndex[] {
  const byHandle = new Map<string, UnderstandingMemoryProposal>();
  for (const proposal of proposals) {
    const p = proposal as Partial<Record<keyof UnderstandingMemoryProposal, unknown>>;
    if (typeof p.handle !== 'string' || byHandle.has(p.handle) || !boundedKeys(p.keys) || !enumValue(p.temporal, UNDERSTANDING_TEMPORALS) ||
        !(p.slot === null || enumValue(p.slot, UNDERSTANDING_SLOTS))) continue;
    byHandle.set(p.handle, proposal);
  }
  return memories.map((memory) => {
    const proposal = byHandle.get(memory.handle);
    let temporal: UnderstandingTemporal = memory.type === 'TEMPORARY_STATE' ? 'TEMPORARY' : proposal?.temporal ?? 'CURRENT';
    if (memory.type !== 'TEMPORARY_STATE' && temporal === 'TEMPORARY') temporal = 'CURRENT';
    let slot: UnderstandingSlot | null = proposal?.slot ?? null;
    if (hasWord(PAST_MARKER, memory.content) && temporal !== 'PAST') slot = null;
    if (temporal === 'PLANNED' || temporal === 'TEMPORARY') slot = null;
    return { memoryId: memory.memoryId, slot, temporal, terms: memoryIndexTerms(memory.content, proposal?.keys ?? []) };
  });
}
