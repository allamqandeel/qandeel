// W3-MEGA-M (E2E-D-13) — deterministic interpretation of a conversational Memory command.
//
// Pure and CPU-only: no database, no provider, no model. It reads the user's own words for an EXPLICIT Memory request
// (P1 §9) and says which kind it is and which words name the target. It never names a Memory: turning words into a
// canonical Memory is the owner-scoped resolution step (memory-control.resolution.ts), and every change is re-checked
// by the database under a row lock. Anything it does not recognise is an ordinary conversation turn.
//
// It only recognises commands addressed to QANDEEL about its Memory — "what do you remember about me", "remember
// that…", "I don't … anymore, I …" (a correction, which is only a command when it names something remembered),
// "forget…", "don't rely on…". Idioms that merely look similar are left alone: a bare «انسى» / «انساها» / "forget it"
// means "never mind", "don't rely on me" is about the user, and a verb reported in someone else's speech is not a cue.
//
// MEM-AR-01B (PD-2): a NATURAL reversal («غيرت رأيي، بقيت ساكن في طنطا», «أنا مبقتش بحب القهوة», «أنا بطلت أشرب قهوة») is
// read by `interpretNaturalReversal`, apart from the explicit requests above. It is only a possible correction: it
// changes Memory only when the resolution step finds the one fact it reverses; otherwise the turn stays ordinary
// conversation, and background inference still reads it through its own unchanged grammar.
import type { NaturalReversal } from './memory-control.types';
import { normalizeArabicComparison } from './arabic-text';

export type MemoryControlIntent =
  | { kind: 'INSPECT' }
  | { kind: 'REMEMBER'; statement: string }
  /**
   * `copula`: "I'm not X, I'm Y" — the restated predicate is the copula itself.
   * `asSaid` (MEM-AR-01C): the replacement exactly as said, present only when the user named no subject anywhere in
   * the correction («لا، مش ساكن في أكتوبر، ساكن في طنطا») and the «أنا» of `replacement` is this reader's; the subject
   * screen reads it, so such a correction keeps its target's subject instead of claiming the user's.
   * `natural` (MEM-AR-01B): a natural reversal. For NO_LONGER / STOPPED, `previous` is the negated clause X and
   * `replacement` the user's own negated statement; for BECAME, `previous` is empty (the old value is not said).
   */
  | { kind: 'CORRECT'; previous: string; replacement: string; copula: boolean; natural?: NaturalReversal; asSaid?: string }
  /**
   * EXPLICIT: the words are anchored to Memory («إن / إني …», "that …", «ذاكرتك», «متفتكرش», "memory", …). SOFT: they are
   * not («امسح الشغل», "forget the work stuff"), so only a full match counts and anything less is ordinary conversation.
   */
  | { kind: 'FORGET'; target: string; strength: 'EXPLICIT' | 'SOFT' }
  /** `alternateTarget`: the clause the user kept ("keep X, but don't rely on it"), used when `target` is only a pronoun. */
  | { kind: 'DISABLE'; target: string; alternateTarget?: string };

export type ClarificationAnswer =
  | { type: 'OPTION'; index: number }
  | { type: 'YES' }
  | { type: 'NO' }
  | { type: 'ALL' }
  | { type: 'WORDS'; text: string };

const ARABIC = /[؀-ۿ]/u;
const LATIN = /[A-Za-z]/u;

export function memoryControlLanguage(...texts: ReadonlyArray<string | undefined>): 'ar' | 'en' {
  for (const text of texts) {
    if (!text) continue;
    if (ARABIC.test(text)) return 'ar';
    if (LATIN.test(text)) return 'en';
  }
  return 'ar';
}

/** NFKC, no tatweel or harakat, one space, trimmed. The user's words are otherwise kept as written. */
export function cleanUtterance(value: string): string {
  return value.normalize('NFKC').replace(/[ـً-ٰٟ]/gu, '').replace(/\s+/gu, ' ').trim();
}

const PREAMBLE = /^(?:(?:يا\s+)?قنديل|qandeel|(?:من\s+فضلك|لو\s+سمحت|please)|(?:hey|ok|okay|تمام|طيب)(?=[،,\s]))[،,:]?\s*/iu;
const TRAILING = /[\s.!؟?،,؛;…]+$/u;

function core(content: string): string {
  let text = cleanUtterance(content);
  for (let guard = 0; guard < 3 && PREAMBLE.test(text); guard += 1) text = text.replace(PREAMBLE, '');
  return text.replace(/\s+(?:please|من\s+فضلك|لو\s+سمحت)$/iu, '').replace(TRAILING, '');
}

function payload(value: string | undefined): string {
  return (value ?? '').replace(TRAILING, '').replace(/^[\s:،,]+/u, '').trim();
}

// ---- INSPECT: the whole utterance is the question.
const INSPECT = [
  /^(?:(?:[اإأ]ن?ت|[اإأ]نتي)\s+)?(?:فاكر|فاكره|فاكرة|متذكر|تتذكر|تفتكر)\s+(?:(?:[اإ]يه|ماذا)\s+)?عني(?:\s+(?:[اإ]يه|بالظبط))*$/u,
  /^(?:[اإ]يه|ماذا|ما)\s+(?:اللي|الذي|الحاجات\s+اللي|المعلومات\s+اللي)\s+(?:(?:[اإأ]ن?ت)\s+)?(?:فاكره|فاكرها|فاكرهم|تفتكره|تفتكرها|تتذكره|تتذكرها|متذكره|متذكرها)\s+عني$/u,
  /^(?:[اإ]يه|ماذا)\s+(?:(?:[اإأ]ن?ت)\s+)?(?:فاكر|تفتكر|تتذكر|متذكر)\s+عني$/u,
  /^(?:قولي|قول\s+لي|وريني)\s+(?:(?:[اإأ]ن?ت)\s+)?(?:فاكر|تفتكر)\s+(?:[اإ]يه\s+)?عني(?:\s+[اإ]يه)?$/u,
  /^(?:so\s+|and\s+)?what\s+(?:else\s+)?(?:do|did|can)\s+you\s+(?:remember|recall)\s+(?:about|of)\s+me$/iu,
  /^what\s+(?:have\s+you\s+(?:remembered|kept|saved)|are\s+you\s+remembering)\s+about\s+me$/iu,
  /^what(?:'s|\s+is|\s+do\s+you\s+have)\s+in\s+your\s+memory(?:\s+about\s+me)?$/iu,
  /^(?:can\s+you\s+)?(?:tell|show)\s+me\s+what\s+you\s+(?:remember|recall)\s+about\s+me$/iu,
  /^do\s+you\s+remember\s+anything\s+about\s+me$/iu,
];

// ---- What ties a forget / do-not-rely request to Memory rather than to ordinary talk («انسى الموضوع ده» is "drop it";
// "stop relying on coffee" is a habit). A Memory word anywhere in the request, or a target phrased as a proposition.
const MEMORY_ANCHOR = /ذاكرت|فاكر|تفتكر|تنساش|معلوم|معايا|في\s+كلامنا|في\s+كلامك|(?<![\p{L}])تاني(?![\p{L}])|\bmemor(?:y|ies)\b|\bremember|\binformation\b|\binfo\b|\bthe\s+fact\b|\bwith\s+me\b|\bwhen\s+we\s+talk\b|\bany\s?more\b|\bagain\b/iu;
const PROPOSITION = /^(?:[اإأ]نّ?|[اإأ]ني|انى|that)\s/iu;
const isAnchored = (text: string, target: string): boolean => MEMORY_ANCHOR.test(text) || PROPOSITION.test(target);

// ---- DISABLE: the cue opens the utterance or a clause of it, and the request must be anchored to Memory.
const DISABLE_AR = /(?:^|[،,؛;.]\s*|\s(?:بس|لكن)\s+|\sو\s*)(?:(?:مت|ما\s?ت)(?:عتمد|بني)ش|لا\s+تعتمد|بلاش\s+تعتمد)\s*(عليهم|عليها|عليه|عليّا|عليا|على|علي)?\s*(.*)$/u;
const DISABLE_EN = /(?:^|[,;.]\s*|\bbut\s+|\band\s+)(?:please\s+)?(?:don'?t|do\s+not|stop|no\s+longer)\s+(?:rely(?:ing)?|depend(?:ing)?)\s+on\s*(.*)$/iu;
const KEEP_CLAUSE = /^(?:(?:مت|ما\s?ت)نساش|خليك\s+فاكر|[اإ]فتكر|[اإ]حفظ|keep|remember|don'?t\s+forget|you\s+can\s+keep)\s*(?:(?:[اإأ]ن|that)\s+)?/iu;

// ---- FORGET.
const FORGET_AR = [
  /^(?:[اإ]نسى|[اإ]نسي)\s+(.+)$/u,
  /^(?:مت|ما\s?ت)فتكرش\s+(.+)$/u,
  /^(?:مش\s+(?:عايزك|عاوزك)|بلاش)\s+(?:تفتكر|تحتفظ\s+ب|تخزن)\s*(.+)$/u,
  /^(?:[اإ]مسح|شيل)\s+من\s+(?:ذاكرتك|دماغك)\s+(.+)$/u,
  /^(?:[اإ]مسح|شيل)\s+(.+)$/u,
];
const FORGET_EN = [
  /^forget\s+(?:about\s+)?(.+)$/iu,
  /^(?:don'?t|do\s+not|stop)\s+remember(?:ing)?\s+(.+)$/iu,
  /^(?:delete|erase|remove)\s+(.+)$/iu,
];
/** "forget it" / «انساها» are "never mind", never a Memory command. */
const NEVER_MIND = /^(?:it|about\s+it|that|this|it\s+all|everything|all\s+of\s+it|الموضوع(?:\s+ده)?|خالص|كل\s+حاجة)(?:\s*[,،].*)?$/iu;

// ---- REMEMBER.
// Arabic cues need «إن / إني» ("that …"): «افتكر تجيب العيش» and «متنساش تكلمني» are reminders, not Memory; «خلي بالك إن …»
// is "watch out", not "remember".
const REMEMBER_AR = /^(?:[اإ]فتكر|خليك\s+فاكر|[اإ]حفظ(?:\s+عندك)?|سجل\s+عندك|(?:مت|ما\s?ت)نساش)\s+((?:[اإأ]نّ?|[اإأ]ني)\s+.+)$/u;
const REMEMBER_EN = [
  /^(?:remember|keep\s+in\s+mind|note|don'?t\s+forget)\s*(?:that\s+|:\s*)(.+)$/iu,
  /^remember\s+(?=(?:i|i'm|i've|my)\b)(.+)$/iu,
];
/** "Remember that movie I told you about" points back at the conversation; it states nothing to keep. */
const CONVERSATION_REFERENCE = /\b(?:i\s+told\s+you|i\s+said|we\s+talked|we\s+discussed|you\s+said|i\s+mentioned)\b|قلتلك|قولتلك|قلت\s+لك|اتكلمنا|حكيتلك|قولتهولك/iu;

// ---- CORRECT: a negated first-person clause, then the replacement clause. MEM-AR-01B: «غيرت رأيي» may open it.
const CORRECT_AR = /^(?:(?:لا|لأ|على\s+فكرة|غيرت\s+(?:رأيي|رايي|رأيى|رايى))[،,]?\s+)?(?:(?:أنا|انا)\s+)?(?:مش|مبقتش|ما\s?بقتش|مابقيتش|ماعدتش|معدتش|لم\s+[اأ]عد|لست)\s+(.+?)\s*(?:[،,؛;.]|\s(?:بل|لكن|بس))\s*(?:(?:بل|لكن|بس)\s+)?(?:(?:أنا|انا)\s+)?(?:(?:دلوقتي|حاليا|حاليًا|بقيت|بقت|بقى)\s+)*(.+)$/u;
const CORRECT_EN_DO = /^(?:(?:no|actually)[,.]?\s+)?i\s+(?:don'?t|do\s+not|no\s+longer|didn'?t)\s+(.+?)(?:\s+any\s?more)?\s*(?:[,;.]|\s+but|\s+—|\s+-)\s*(?:(?:now|actually|but)[,]?\s+)?i\s+(.+)$/iu;
const CORRECT_EN_BE = /^(?:(?:no|actually)[,.]?\s+)?i(?:'m|\s+am)\s+(?:not|no\s+longer)\s+(.+?)(?:\s+any\s?more)?\s*(?:[,;.]|\s+but)\s*(?:(?:now|actually)[,]?\s+)?i(?:'m|\s+am)\s+(.+)$/iu;

/** Nothing QANDEEL should keep as "remembered" is phrased as a question, and no question answers a clarification. */
const QUESTION = /[؟?]/u;

export function interpretMemoryControl(content: string): MemoryControlIntent | null {
  if (typeof content !== 'string' || content.length > 1000) return null;
  const raw = cleanUtterance(content);
  const text = core(content);
  if (text.length === 0) return null;

  if (INSPECT.some((pattern) => pattern.test(text))) return { kind: 'INSPECT' };

  const disable = disableIntent(text);
  if (disable !== undefined) return disable;

  for (const pattern of [...FORGET_AR, ...FORGET_EN]) {
    const match = text.match(pattern);
    if (match) return forgetIntent(text, match[1]);
  }

  const remember = text.match(REMEMBER_AR) ?? REMEMBER_EN.map((pattern) => text.match(pattern)).find(Boolean);
  if (remember) {
    const statement = payload(remember[1]).replace(/^[اإأ]نّ?\s+/u, '');
    if (QUESTION.test(raw) || CONVERSATION_REFERENCE.test(statement) || statement.split(' ').length < 2) return null;
    return { kind: 'REMEMBER', statement };
  }

  const arabicCorrection = text.match(CORRECT_AR);
  if (arabicCorrection) {
    const replacement = payload(arabicCorrection[2]);
    if (!QUESTION.test(raw) && payload(arabicCorrection[1]) && replacement) {
      const lead = text.slice(0, text.length - arabicCorrection[2].length);
      const subjectSaid = /(?:^|[\s،,])(?:أنا|انا|بقيت|مبقتش|ما\s?بقتش|مابقيتش|مبقيتش)\s/u.test(lead) || /^(?:أنا|انا)\s/u.test(replacement);
      return {
        kind: 'CORRECT', previous: payload(arabicCorrection[1]),
        replacement: /^(?:أنا|انا)\s/u.test(replacement) ? replacement : `أنا ${replacement}`, copula: false,
        ...(subjectSaid ? {} : { asSaid: replacement }),
      };
    }
  }
  const englishCorrection = text.match(CORRECT_EN_BE) ?? text.match(CORRECT_EN_DO);
  if (englishCorrection && !QUESTION.test(raw) && payload(englishCorrection[1]) && payload(englishCorrection[2])) {
    const copula = CORRECT_EN_BE.test(text);
    return { kind: 'CORRECT', previous: payload(englishCorrection[1]), replacement: `${copula ? "I'm" : 'I'} ${payload(englishCorrection[2])}`, copula };
  }
  return null;
}

// ---- MEM-AR-01B (PD-2): a natural reversal. The cue opens the utterance, after an optional «غيرت رأيي» and an optional
// «أنا». Anything else in front of it («هو بطل …», «قالي إنه …», «مراتي بقت …») is someone else's change, not the
// user's, and quoted words are never the user's own statement.
const REVERSAL_PREAMBLE = /^غيرت\s+(?:رأيي|رايي|رأيى|رايى)(?:\s*[،,:]\s*|\s+)(?:و(?=(?:أنا|انا|مبقتش|ما\s?بقتش|مابقيتش|مبقيتش|بطلت|بقيت)\s))?/u;
const NO_LONGER = /^(?:(?:أنا|انا)\s+)?(?:مبقتش|ما\s?بقتش|مابقيتش|مبقيتش)\s+(.+)$/u;
// «بطلت» before a «ت… / ي… / ن…» verb is another person's act («بطلت تكلمني»), as in the 01A capture grammar.
const STOPPED = /^(?:(?:أنا|انا)\s+)?بطلت\s+(?![تين])(.+)$/u;
const BECAME = /^(?:(?:أنا|انا)\s+)?بقيت\s+(?:(?:أنا|انا)\s+)?(.+)$/u;
/** One clause only. Two clauses are the explicit correction above («مبقتش X، أنا Y»), or ordinary talk. */
const SECOND_CLAUSE = /[،,؛;.:]|\s(?:بس|لكن|بل)\s/u;
const QUOTED = /[«»"“”]/u;
const NATURAL_CUES: ReadonlyArray<readonly [NaturalReversal, RegExp]> = [['NO_LONGER', NO_LONGER], ['STOPPED', STOPPED], ['BECAME', BECAME]];

/**
 * MEM-AR-01B: a natural first-person reversal, or `null`. It names no Memory and decides nothing: the caller acts on
 * it only when the resolution step finds the one fact it reverses.
 */
export function interpretNaturalReversal(content: string): MemoryControlIntent | null {
  if (typeof content !== 'string' || content.length > 1000) return null;
  const raw = cleanUtterance(content);
  if (QUESTION.test(raw) || QUOTED.test(raw)) return null;
  const text = core(content).replace(REVERSAL_PREAMBLE, '');
  for (const [natural, pattern] of NATURAL_CUES) {
    const match = text.match(pattern);
    if (!match) continue;
    const clause = payload(match[1]);
    if (!clause || SECOND_CLAUSE.test(clause)) return null;
    // The successor keeps the user's words; only the subject «أنا» is written out when it was left implicit.
    if (natural === 'BECAME') return { kind: 'CORRECT', previous: '', replacement: `أنا ${clause}`, copula: false, natural };
    return { kind: 'CORRECT', previous: clause, replacement: `أنا ${text.replace(/^(?:أنا|انا)\s+/u, '')}`, copula: false, natural };
  }
  return null;
}

function forgetIntent(text: string, value: string): MemoryControlIntent | null {
  const target = payload(value).replace(/\s+(?:تاني|خالص|بعد\s+كده|again|anymore|any\s+more)$/iu, '');
  if (target.length === 0 || NEVER_MIND.test(target) || QUESTION.test(value)) return null;
  return { kind: 'FORGET', target, strength: isAnchored(text, target) ? 'EXPLICIT' : 'SOFT' };
}

/** `undefined`: no do-not-rely cue. `null`: a cue, but not a Memory request (and therefore nothing else either). */
function disableIntent(text: string): MemoryControlIntent | null | undefined {
  const arabic = text.match(DISABLE_AR);
  const english = arabic ? null : text.match(DISABLE_EN);
  const match = arabic ?? english;
  if (!match || match.index === undefined) return undefined;
  const said = payload(arabic ? arabic[2] : english![1]);
  const target = said.replace(/^(?:[اإأ]ن|[اإ]ني|the\s+fact\s+that|that)\s+/iu, '');
  // "don't rely on me" / «متعتمدش عليا» is about the user, not a Memory.
  if ((arabic && /^علي(?:ّ)?ا$/u.test(arabic[1] ?? '') && target.length === 0) || /^me$/iu.test(target)) return null;
  const before = text.slice(0, match.index).replace(/[\s،,؛;.]+$/u, '').replace(/\s+(?:بس|لكن|و|but|and)$/iu, '');
  const kept = before.replace(KEEP_CLAUSE, '').trim();
  // "I like tea, but don't rely on it": a bare pronoun pointing at the reader's own preceding clause is anchored too.
  const pointsBack = /^(?:it|that|this)?$/iu.test(said) && kept.length > 0;
  if (!pointsBack && !isAnchored(text, said)) return null;
  return { kind: 'DISABLE', target, ...(kept ? { alternateTarget: kept } : {}) };
}

// ---- A reply to "which one do you mean?".
const ORDINALS: ReadonlyArray<ReadonlyArray<string>> = [
  ['1', '١', 'اول', 'الاول', 'اولي', 'الاولي', 'اولاني', 'الاولاني', 'اوله', 'first', '1st'],
  ['2', '٢', 'تاني', 'التاني', 'تانيه', 'التانيه', 'ثاني', 'الثاني', 'ثانيه', 'الثانيه', 'second', 'two', '2nd'],
  ['3', '٣', 'تالت', 'التالت', 'تالته', 'التالته', 'ثالث', 'الثالث', 'ثالثه', 'الثالثه', 'third', 'three', '3rd'],
];
const YES = new Set(['ايوه', 'ايوا', 'اه', 'نعم', 'صح', 'بالظبط', 'اكيد', 'طبعا', 'yes', 'yeah', 'yep', 'yup', 'correct', 'right', 'exactly', 'sure']);
const NO = new Set(['لا', 'لأ', 'لاء', 'مش', 'no', 'nope', 'none', 'neither', 'ولا', 'حاجه', 'واحده']);
const ALL = new Set(['الاتنين', 'الاثنين', 'كلهم', 'التلاته', 'both', 'all']);
const FILLER = new Set(['رقم', 'number', 'the', 'one', 'option', 'item', 'اللي', 'هي', 'هو', 'دي', 'ده', 'واحده', 'واحد', 'منهم', 'يا', 'قنديل', 'please', 'of', 'them', 'فيهم', 'بس', 'just', 'it', 'is', 'that', 'this', "it's", "that's"]);
/** A verb that only repeats the request: «انسى التانية», "forget the second one", "I mean the first". */
const ANSWER_VERBS = new Set(['انسي', 'امسح', 'شيل', 'forget', 'delete', 'remove', 'i', 'mean', 'اقصد', 'قصدي', 'يعني', 'pick', 'choose']);
/** Pointing at the option shown: "that one", «هي دي». With several options it is asked again. */
const POINTING = /^(?:(?:it(?:'s|\s+is)\s+)?(?:that|this|the)\s+one|that's\s+it|thats\s+it|هي\s+دي|هو\s+ده|دي\s+هي|ده\s+هو|هي|هو|دي|ده)$/u;

function normalizeAnswer(value: string): string[] {
  return cleanUtterance(value).toLocaleLowerCase('und')
    .replace(/[أإآ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/ة/gu, 'ه')
    .replace(/[.!،,؛;:«»"“”()]/gu, ' ').split(/\s+/u).filter(Boolean);
}

/** Reads a short reply to a clarification. Longer text, a question, or text that is not an answer, is ordinary conversation. */
export function readClarificationAnswer(content: string): ClarificationAnswer | null {
  if (typeof content !== 'string' || QUESTION.test(content)) return null;
  const words = normalizeAnswer(content);
  if (words.length === 0 || words.length > 8) return null;
  const meaningful = words.filter((word) => !FILLER.has(word) && !ANSWER_VERBS.has(word));
  const ordinal = (word: string): number | undefined => {
    const index = ORDINALS.findIndex((names) => names.includes(word) || names.includes(word.replace(/^ال/u, '')));
    return index < 0 ? undefined : index;
  };
  // Any bare number picks an option — one that is out of range is answered by asking again.
  const numeral = meaningful.length === 1 ? meaningful[0].replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 0x0660)) : '';
  if (/^[1-9][0-9]?$/u.test(numeral)) return { type: 'OPTION', index: Number(numeral) - 1 };
  const picked = new Set(meaningful.map(ordinal));
  if (meaningful.length > 0 && picked.size === 1 && !picked.has(undefined)) return { type: 'OPTION', index: [...picked][0]! };
  if (words.some((word) => ALL.has(word)) && words.length <= 3) return { type: 'ALL' };
  if (words.length <= 3 && words.every((word) => NO.has(word) || FILLER.has(word)) && words.some((word) => NO.has(word) && !FILLER.has(word))) return { type: 'NO' };
  if (POINTING.test(words.join(' '))) return { type: 'YES' };
  if (words.length <= 3 && words.every((word) => YES.has(word) || FILLER.has(word)) && words.some((word) => YES.has(word))) return { type: 'YES' };
  if (words.length <= 6) return { type: 'WORDS', text: cleanUtterance(content) };
  return null;
}

// ---- MEM-AR-01C (PD-1): whom a remember request (or a correction's new value) is about.
//
// Deterministic and closed (WP0R §3.2, A1 C3.3). The caller has already applied step 1 - the background's closed
// first-person grammar recognising the statement means SELF - and the sensitive-data screen before it. This reads the
// rest, on the comparison-normalized words, in order:
//   2. the clause's subject is another person - a possessive person noun from the closed list or a third-person
//      pronoun - so it is OTHER («أختي بتحب الكشري», «أمي عايزاني أتجوز قريب», "my sister hates kids");
//   3. the subject is the user - «أنا / إني», "I", or one of the tested first-person verbs - and no clause about another
//      person is embedded in it, so it is SELF («أنا بتخانق مع أختي», «عندي أخت»);
//   4. anything else is AMBIGUOUS and is asked about, never guessed: a bare participle («ساكنة في طنطا»), a name as the
//      subject («أحمد بيحب …»), or a mixed frame («أنا عارف إن أختي …»).
export type MemorySubjectScreen = 'SELF' | 'OTHER' | 'AMBIGUOUS';
export type SubjectAnswer = 'SELF' | 'OTHER' | 'DECLINE';

// Closed lists, in comparison-normalized form (أ/إ/آ → ا, ة → ه, ى → ي, no harakat).
const KIN_AR = new Set(['اختي', 'اخويا', 'امي', 'ماما', 'ابويا', 'بابا', 'مراتي', 'جوزي', 'ابني', 'بنتي', 'صاحبي', 'صاحبتي', 'خطيبي', 'خطيبتي', 'مديري', 'زميلي', 'جاري']);
const KIN_EN = 'sister|brother|mother|mom|mum|father|dad|wife|husband|son|daughter|friend|fiance|fiancee|boss|manager|colleague|coworker|neighbor|neighbour';
const THIRD_PERSON_AR = new Set(['هو', 'هي', 'هما']);
const FIRST_PERSON_AR = new Set(['انا', 'اني']);
const FIRST_PERSON_VERBS_AR = new Set(['بحب', 'بفضل', 'بكره', 'بقيت', 'بطلت', 'مبقتش', 'عندي', 'ليا']);
const COMPLEMENTIZERS_AR = new Set(['ان', 'انه', 'انها', 'انهم']);
const COGNITION_EN = 'know|knew|think|thought|believe|feel|felt|guess|heard|noticed|said|told|realized|realised|hope|wish|worry';
const OTHER_SUBJECT_EN = new RegExp(`^(?:my (?:${KIN_EN})\\b|(?:he|she|they)\\b)`, 'u');
const FIRST_PERSON_EN = /^i(?:'m|'ve|'d|'ll)?\b/u;
const EMBEDDED_OTHER_EN = new RegExp(`\\b(?:${COGNITION_EN}) (?:that (?!i\\b)|my (?:${KIN_EN})\\b|(?:he|she|they)\\b)`, 'u');

function subjectWords(statement: string): string[] {
  return normalizeArabicComparison(statement).replace(/[.!؟?،,؛;:«»"“”()]/gu, ' ').split(/\s+/u).filter(Boolean);
}

/** Steps 2-4 of the subject screen (step 1, the closed first-person grammar, is the caller's). */
export function screenMemorySubject(statement: string): MemorySubjectScreen {
  const words = subjectWords(statement);
  if (words.length === 0) return 'AMBIGUOUS';
  const text = words.join(' ');
  const subject = words[0];
  if (KIN_AR.has(subject) || THIRD_PERSON_AR.has(subject) || OTHER_SUBJECT_EN.test(text)) return 'OTHER';
  if (!FIRST_PERSON_AR.has(subject) && !FIRST_PERSON_VERBS_AR.has(subject) && !FIRST_PERSON_EN.test(text)) return 'AMBIGUOUS';
  // A first-person frame that embeds a clause about somebody else («أنا عارف إن أختي …», "I think my sister …") is mixed:
  // the fact to keep may be the other person's.
  const embeddedArabic = words.some((word, index) => index > 0 && COMPLEMENTIZERS_AR.has(word)
    && (word !== 'ان' || !FIRST_PERSON_AR.has(words[index + 1] ?? '')));
  if (embeddedArabic || EMBEDDED_OTHER_EN.test(text)) return 'AMBIGUOUS';
  return 'SELF';
}

// A1 C3.3: the whole reply, against a closed list. OTHER is read first, then SELF, then DECLINE, so «لا مش عني» is OTHER.
const SUBJECT_OTHER = new Set(['مش عني', 'لا مش عني', 'عن حد تاني', 'حد تاني', 'someone else', 'not me']);
const SUBJECT_SELF = new Set(['عني', 'انا', 'ليا', 'عن نفسي', 'بتاعي', 'me', 'about me', 'myself']);
const SUBJECT_DECLINE = new Set(['لا', 'خلاص', 'مش مهم', 'بلاش', 'no', 'never mind']);
const ABOUT_MY_KIN_EN = new RegExp(`^about my (?:${KIN_EN})$`, 'u');

/** The answer to «المعلومة دي عنك إنت، ولا عن حد تاني؟». Anything that is not one of these is not an answer. */
export function readSubjectAnswer(content: string): SubjectAnswer | null {
  if (typeof content !== 'string' || content.length > 80 || QUESTION.test(content)) return null;
  const words = subjectWords(content);
  const text = words.join(' ');
  if (!text) return null;
  if (SUBJECT_OTHER.has(text) || ABOUT_MY_KIN_EN.test(text) || (words.length === 2 && words[0] === 'عن' && KIN_AR.has(words[1]))) return 'OTHER';
  if (SUBJECT_SELF.has(text)) return 'SELF';
  if (SUBJECT_DECLINE.has(text)) return 'DECLINE';
  return null;
}
