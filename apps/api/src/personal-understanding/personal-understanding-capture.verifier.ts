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
import { memoryIndexTerms, memoryRetrievalTerms } from '../memory/memory-retrieval-terms';
import { containsObviousSecret, MEMORY_IMPORTANCE, normalizeMemoryContent, screenMemoryCapture } from '../memory/memory-write-evaluator.service';
import type { MemoryRecord, MemoryType } from '../memory/memory.types';
import {
  MAX_UNDERSTANDING_FACTS,
  MAX_UNDERSTANDING_KEY_LENGTH,
  MAX_UNDERSTANDING_KEYS,
  MAX_UNDERSTANDING_SPAN_CHARS,
  UNDERSTANDING_CONTEXT_STATUSES,
  UNDERSTANDING_FACT_TYPES,
  UNDERSTANDING_MODALITIES,
  UNDERSTANDING_POLARITIES,
  UNDERSTANDING_SLOTS,
  UNDERSTANDING_SUBJECTS,
  UNDERSTANDING_TEMPORALS,
  type UnderstandingContextProposal,
  type UnderstandingContextStatus,
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
// S8A-03 Living Personal Memory - the user's own family, named in the first person («مراتي», «ابني», "my wife"): the ONLY
// someone-else statements the capture keeps (as OTHER, never the user's own fact), and the family rows of the knowledge
// picture. Closed and explicit: friends, colleagues and anyone not named as the user's family are never included.
const FAMILY_KIN = wordList([
  'مراتي', 'زوجتي', 'جوزي', 'زوجي', 'خطيبي', 'خطيبتي', 'ابني', 'بنتي', 'ابنتي', 'ولادي', 'اولادي', 'عيالي', 'اطفالي', 'ابنائي',
  'بناتي', 'امي', 'ماما', 'والدتي', 'ابويا', 'ابوي', 'بابا', 'والدي', 'ابي', 'اخويا', 'اخوي', 'اخي', 'اختي', 'اخواتي', 'اخوتي',
  'my wife', 'my husband', 'my fiance', 'my fiancee', 'my son', 'my daughter', 'my kids', 'my children', 'my mother', 'my mom',
  'my father', 'my dad', 'my parents', 'my brother', 'my sister',
]);
// An explicit, completed ending of something the user did or had («بطلت», «سبت», «اتنقلت», «مبقتش», "quit", "no longer").
// A plan to stop («هبطل», «ناوي أسيب») is never one: only these completed forms are.
const ENDED_WORD = wordList([
  'بطلت', 'بطلنا', 'سبت', 'سيبت', 'استقلت', 'اتنقلت', 'نقلت', 'انتقلت', 'عزلت', 'اتخرجت', 'تخرجت', 'اتطلقت', 'طلقت', 'انفصلت',
  'لغيت', 'الغيت', 'تركت', 'توقفت', 'مبقتش', 'مابقتش', 'ما بقيتش', 'معدتش', 'ماعدتش', 'لم اعد', 'لا اعد',
  'quit', 'stopped', 'left', 'moved', 'graduated', 'divorced', 'resigned', 'cancelled', 'canceled', 'no longer', 'not anymore', 'anymore',
]);
const ENDED_WORDS = new RegExp(ENDED_WORD.source, 'gu');
// A pause is not an ending, and neither is one day: «بطلت مؤقتًا», «سبت الشغل بدري النهارده», "for now", "a break".
const PAUSE = wordList([
  'مؤقتا', 'موقتا', 'مؤقت', 'موقت', 'فتره', 'شويه', 'كام يوم', 'يومين', 'اجازه', 'بريك', 'لحد ما', 'لغايه ما', 'هرجع', 'هرجعله',
  'هرجعلها', 'هكمل', 'بدري', 'النهارده', 'انهارده', 'اليوم', 'بكره', 'بكرا', 'غدا', 'الليله',
  'temporarily', 'temporary', 'for now', 'for a while', 'for a bit', 'break', 'pause', 'paused', 'until', 'today', 'tonight', 'tomorrow',
]);
/** NEGATION without the cessation words: an ending is read from ENDED_WORD, and only another negation reverses it. */
const PLAIN_NEGATION = wordList([
  'مش', 'مو', 'مب', 'ما', 'لا', 'ليس', 'لست', 'لم', 'لن', 'مفيش', 'محدش', 'ولا', 'never', 'not', 'no', 'dont', 'doesnt',
  'didnt', 'isnt', 'arent', 'wasnt', 'havent', 'cannot', 'cant', 'wont',
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

/** S8A-03 Living Personal Memory: whether a text names one of the user's own family in the first person (closed list). */
export function namesFamilyMember(text: string): boolean {
  return hasWord(FAMILY_KIN, text);
}

/** S8A-03 Living Personal Memory: whether a text is said in the past («كنت», «زمان», "used to") - the same closed marker. */
export function statesPast(text: string): boolean {
  return hasWord(PAST_MARKER, text);
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
  if (p.subject === 'OTHER') return verifyFamilyProposal(p as UnderstandingFactProposal, message);
  if (p.subject !== 'SELF') return { rejected: 'NOT_SELF' };
  if (p.modality !== 'STATED') return { rejected: 'NOT_A_STATEMENT' };

  const located = locateStatement(p.span, message, 2);
  if ('rejected' in located) return located;
  const { span, words, clauseText, leadIn, sentenceLeadIn } = located;

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
      subject: 'SELF',
      terms: memoryIndexTerms(content, keys),
    },
  };
}

type LocatedStatement = {
  readonly text: string; readonly span: string; readonly words: readonly string[]; readonly start: number; readonly end: number;
  readonly clauseText: string; readonly leadIn: string; readonly sentenceLeadIn: string;
};

/**
 * The checks every kept statement shares, in this order: the span is verbatim (at least `minWords` words, within the
 * bound) and carries no secret, and its clause is stated - not asked, supposed, reported, quoted or hedged.
 */
function locateStatement(rawSpan: string, message: string, minWords: number): LocatedStatement | { readonly rejected: UnderstandingRejection } {
  const text = clean(message);
  const span = clean(rawSpan).replace(/[.!؟?،,;:]+$/gu, '').trim();
  const words = span.split(' ').filter(Boolean);
  if (words.length < minWords || [...span].length > MAX_UNDERSTANDING_SPAN_CHARS) return { rejected: 'TOO_SHORT_OR_LONG' };
  const start = text.indexOf(span);
  if (start < 0) return { rejected: 'NOT_VERBATIM' };
  const end = start + span.length;
  if (containsObviousSecret(span)) return { rejected: 'SENSITIVE_DATA' };

  const clause = region(text, start, end, CLAUSE_BREAK);
  const sentence = region(text, start, end, SENTENCE_BREAK);
  const clauseText = text.slice(clause.from, clause.to);

  if (clause.terminator === '?' || clause.terminator === '؟' || QUESTION_START.test(fold(clauseText).split(' ')[0] ?? '')) {
    return { rejected: 'QUESTION' };
  }
  const sentenceLeadIn = text.slice(sentence.from, end);
  if (hasWord(HYPOTHETICAL, sentenceLeadIn)) return { rejected: 'HYPOTHETICAL' };
  if (hasWord(REPORTED, text.slice(sentence.from, start)) ||
      (QUOTE_MARK.test(text.slice(sentence.from, start)) && QUOTE_MARK.test(text.slice(end, sentence.to + 1)))) {
    return { rejected: 'QUOTED_OR_REPORTED' };
  }
  if (hasWord(SPECULATIVE, clauseText)) return { rejected: 'SPECULATIVE' };
  return { text, span, words, start, end, clauseText, leadIn: text.slice(clause.from, end), sentenceLeadIn };
}

/**
 * S8A-03 Living Personal Memory: a statement of who one of the user's own family is («مراتي اسمها سارة», «ابني يوسف عنده
 * سبع سنين»). Kept ONLY as someone else's fact (OTHER), in the user's verbatim words, as a RELATIONSHIP_CONTEXT with no
 * slot - never as the user's own fact, so nothing about that person is ever attributed to the user. The span must name
 * the family member in the first person within its first three words, and be a plain, affirmed, present statement.
 * Any other someone-else proposal is refused exactly as before (NOT_SELF).
 */
function verifyFamilyProposal(p: UnderstandingFactProposal, message: string): FactVerdict {
  if (p.modality !== 'STATED') return { rejected: 'NOT_A_STATEMENT' };
  if (p.type !== 'RELATIONSHIP_CONTEXT' || p.slot !== null || p.temporal !== 'CURRENT' || p.polarity !== 'AFFIRMED') {
    return { rejected: 'NOT_SELF' };
  }
  const located = locateStatement(p.span, message, 2);
  if ('rejected' in located) return located;
  const { span, words, clauseText } = located;
  if (!hasWord(FAMILY_KIN, words.slice(0, 3).join(' '))) return { rejected: 'NOT_SELF' };
  if (hasWord(NEGATION, clauseText) || NEGATED_VERB.test(fold(clauseText))) return { rejected: 'NEGATION_MISMATCH' };
  if (hasWord(PAST_MARKER, clauseText)) return { rejected: 'TEMPORAL_MISMATCH' };
  const content = asSaid(span);
  return {
    kept: {
      memoryId: randomUUID(),
      type: 'RELATIONSHIP_CONTEXT',
      content,
      importance: MEMORY_IMPORTANCE.RELATIONSHIP_CONTEXT,
      expiresAt: null,
      slot: null,
      temporal: 'CURRENT',
      subject: 'OTHER',
      terms: memoryIndexTerms(content, boundedKeys(p.keys) ?? []),
    },
  };
}

/** One of the user's current-state Memories the capture may find restated or ended (0172 background read). */
export interface UnderstandingCurrentItem {
  readonly handle: string;
  readonly memoryId: string;
  readonly type: MemoryType;
  readonly content: string;
  /** The item's index terms (its own words and semantic keys): what the statement must share to be about it. */
  readonly terms: readonly string[];
}

/**
 * S8A-03 Living Personal Memory: the verified REAFFIRMED / ENDED statements about the user's current items. The model
 * proposes; a statement is kept only when the user's own words agree:
 *   * the span is verbatim, stated (not asked, supposed, reported, quoted or hedged) and the user's own (first person,
 *     no one else named in the clause unless the span says «أنا» / "I") - the same checks as a fact;
 *   * it is about THAT item: the span shares a content word with the item's own words;
 *   * REAFFIRMED: nothing in the clause negates, ends or puts it in the past;
 *   * ENDED: the span says a completed ending from a closed list, no other negation reverses it, and the clause names
 *     no pause and no single day - a break, «مؤقتًا», «النهارده» or simply not mentioning it never ends anything.
 * A handle proposed twice is dropped. Unknown handles are ignored.
 */
export function verifyContextProposals(
  proposals: readonly UnderstandingContextProposal[],
  message: string,
  current: readonly UnderstandingCurrentItem[],
): { readonly reaffirmed: readonly string[]; readonly ended: readonly string[]; readonly rejected: readonly UnderstandingRejection[] } {
  const byHandle = new Map(current.map((item) => [item.handle, item]));
  const counts = new Map<string, number>();
  for (const proposal of proposals) {
    const handle = (proposal as { handle?: unknown })?.handle;
    if (typeof handle === 'string') counts.set(handle, (counts.get(handle) ?? 0) + 1);
  }
  const reaffirmed: string[] = [];
  const ended: string[] = [];
  const rejected: UnderstandingRejection[] = [];
  for (const proposal of proposals) {
    const p = proposal as Partial<Record<keyof UnderstandingContextProposal, unknown>>;
    const item = typeof p.handle === 'string' ? byHandle.get(p.handle) : undefined;
    if (!item || counts.get(p.handle as string) !== 1 || typeof p.span !== 'string' || !enumValue(p.status, UNDERSTANDING_CONTEXT_STATUSES)) {
      rejected.push('MALFORMED');
      continue;
    }
    const verdict = verifyContextProposal(p.status, p.span, message, item);
    if (verdict) { rejected.push(verdict); continue; }
    (p.status === 'ENDED' ? ended : reaffirmed).push(item.memoryId);
  }
  return { reaffirmed, ended, rejected };
}

function verifyContextProposal(status: UnderstandingContextStatus, rawSpan: string, message: string, item: UnderstandingCurrentItem): UnderstandingRejection | undefined {
  const located = locateStatement(rawSpan, message, 1);
  if ('rejected' in located) return located.rejected;
  const { text, span, words, clauseText, leadIn, sentenceLeadIn } = located;
  if (status === 'ENDED' && !hasWord(ENDED_WORD, span)) return 'NOT_AN_ENDING';
  if (hasWord(THIRD_PARTY, leadIn) && !hasWord(EXPLICIT_SELF, span)) return 'THIRD_PARTY';
  // Egyptian Arabic often leaves the subject implied: «لسه ساكن في المعادي», or a completed ending that is itself first
  // person («سبت», «مبقتش», «بطلت»). Read as the user's only when no one else is named anywhere in the message.
  const implied = !hasWord(THIRD_PARTY, text) && !/[a-z]/iu.test(span);
  if (!implied && !carriesFirstPersonSignal(leadIn) &&
      !(carriesFirstPersonSignal(sentenceLeadIn) && !hasWord(THIRD_PARTY, sentenceLeadIn))) return 'NO_FIRST_PERSON';
  if (/^بي[\p{L}]{2,}$/u.test(fold(words[0])) && !NOT_A_VERB.has(fold(words[0]))) return 'THIRD_PARTY';
  const own = new Set([...memoryRetrievalTerms(item.content), ...item.terms]);
  const topic = memoryRetrievalTerms(fold(span).replace(ENDED_WORDS, ' ')).some((term) => own.has(term));
  if (!topic) return 'NOT_ABOUT_ITEM';
  if (status === 'REAFFIRMED') {
    if (hasWord(NEGATION, clauseText) || NEGATED_VERB.test(fold(clauseText)) || hasWord(ENDED_WORD, clauseText) ||
        hasWord(PAST_MARKER, clauseText)) return 'NEGATION_MISMATCH';
    return undefined;
  }
  const rest = fold(clauseText).replace(ENDED_WORDS, ' ');
  if (PLAIN_NEGATION.test(rest) || NEGATED_VERB.test(rest)) return 'NEGATION_MISMATCH';
  if (hasWord(PAUSE, clauseText)) return 'NOT_AN_ENDING';
  return undefined;
}

/**
 * Verifies every fact proposal of one answer: at most three kept, none a duplicate of another kept one or of a current
 * Memory of the same type (01A), and no «بطلت …» that may reverse a current Memory (01A: only a correction may).
 * S8A-03 Living Personal Memory: a SELF fact the user states again in the same words is not a new Memory but a
 * restatement of that one (`restated`, the existing SELF Memory's id) - the user saying it again is real evidence.
 */
export function verifyFactProposals(
  proposals: readonly UnderstandingFactProposal[],
  message: string,
  current: ReadonlyArray<Pick<MemoryRecord, 'type' | 'content'> & Partial<Pick<MemoryRecord, 'id' | 'subject'>>>,
  now: Date,
): { readonly kept: readonly VerifiedUnderstandingItem[]; readonly rejected: readonly UnderstandingRejection[]; readonly restated: readonly string[] } {
  const kept: VerifiedUnderstandingItem[] = [];
  const rejected: UnderstandingRejection[] = [];
  const restated: string[] = [];
  const seen = new Set<string>();
  for (const proposal of proposals) {
    const verdict = verifyFactProposal(proposal, message, now);
    if ('rejected' in verdict) { rejected.push(verdict.rejected); continue; }
    const key = normalizeMemoryContent(verdict.kept.content);
    if (seen.has(key)) { rejected.push('DUPLICATE'); continue; }
    const screen = screenMemoryCapture(verdict.kept, current);
    if (screen === 'EXACT_NORMALIZED_DUPLICATE' && verdict.kept.subject === 'SELF') {
      const same = current.find((memory) => memory.subject === 'SELF' && typeof memory.id === 'string' &&
        screenMemoryCapture(verdict.kept, [memory]) === 'EXACT_NORMALIZED_DUPLICATE');
      if (same?.id && !restated.includes(same.id)) restated.push(same.id);
    }
    if (screen) { rejected.push(screen === 'EXACT_NORMALIZED_DUPLICATE' ? 'DUPLICATE' : 'REVERSAL_NEEDS_CORRECTION'); continue; }
    if (kept.length >= MAX_UNDERSTANDING_FACTS) { rejected.push('MALFORMED'); continue; }
    seen.add(key);
    kept.push(verdict.kept);
  }
  return { kept, rejected, restated };
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
