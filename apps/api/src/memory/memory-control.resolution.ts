// W3-MEGA-M (E2E-D-13) — which canonical Memory the user's words name.
//
// Pure and deterministic. The candidates are the caller's own canonical Memory rows (owner-token reads, bounded), so
// no other reader's row can ever be named, and no provider takes part. The rule is deliberately conservative:
//
//   * the user's DISTINCTIVE words (pronouns, particles and "the topic / the information" removed, light Arabic
//     prefix / suffix stemming) must ALL appear in exactly ONE candidate → that one is RESOLVED;
//   * several candidates contain all of them → AMBIGUOUS, and QANDEEL asks — it never picks the "best" one;
//   * some contain only part of them → PARTIAL: never acted on; the caller either asks (the request is anchored to
//     Memory) or treats the words as ordinary conversation;
//   * words that only name a predicate («بحب», "like", «ساكن») cannot identify a Memory by themselves: at best PARTIAL;
//   * nothing matches → NONE; no distinctive word at all ("that information", «المعلومة دي») → UNSPECIFIED.
//
// RESOLVED only proposes a target: the database re-checks it under a row lock before anything changes.
//
// MEM-AR-01A: the normalization and the light stem are the shared, pure `arabic-text` helpers (one comparison
// normalizer for duplicates, retrieval and resolution). The rules above are unchanged.
//
// MEM-AR-01B: `resolveReversalTarget` finds the one fact a natural reversal reverses, under the same rule: a unique
// match only, several ask, none is ordinary conversation (see the function).
import type { MemoryRecord, MemoryType } from './memory.types';
import { MAX_CLARIFICATION_OPTIONS, type NaturalReversal } from './memory-control.types';
import { lightArabicStem as stem, normalizeArabicComparison } from './arabic-text';

export type MemoryTargetResolution =
  | { state: 'RESOLVED'; memory: MemoryRecord }
  | { state: 'AMBIGUOUS'; options: ReadonlyArray<MemoryRecord> }
  | { state: 'PARTIAL'; options: ReadonlyArray<MemoryRecord> }
  | { state: 'NONE' }
  | { state: 'UNSPECIFIED' };

const STOP_WORDS = new Set([
  // Arabic (normalized: ا for أإآ, ي for ى, ه for ة)
  'انا', 'انت', 'انتي', 'احنا', 'عني', 'عن', 'في', 'فى', 'من', 'على', 'علي', 'عليها', 'عليه', 'عليهم', 'عليا', 'الي', 'لي',
  'ان', 'اني', 'انه', 'انها', 'انك', 'ده', 'دي', 'دا', 'دول', 'كده', 'كدا', 'اللي', 'الذي', 'التي', 'هو', 'هي', 'هم',
  'بس', 'لكن', 'و', 'يا', 'مش', 'ما', 'لا', 'معايا', 'معاك', 'معانا', 'تاني', 'خالص', 'بقي', 'بقيت', 'بقت', 'دلوقتي',
  'حاليا', 'خلاص', 'موضوع', 'الموضوع', 'حكايه', 'الحكايه', 'قصه', 'القصه', 'معلومه', 'المعلومه', 'حاجه', 'الحاجه',
  'قنديل', 'كان', 'كنت', 'بعد', 'قبل', 'كمان', 'برضه', 'ذاكرتك', 'دماغك', 'كلامنا', 'كلامك', 'بتاع', 'بتاعه', 'بتاعت',
  // English
  'i', "i'm", 'im', 'me', 'my', 'mine', 'you', 'your', 'the', 'a', 'an', 'that', 'this', 'it', 'is', 'am', 'are', 'was',
  'be', 'to', 'of', 'in', 'on', 'at', 'about', 'and', 'but', 'or', 'anymore', 'any', 'more', 'now', 'fact', 'info',
  'information', 'thing', 'stuff', 'topic', 'memory', 'please', 'qandeel', 'with', 'when', 'talking', 'so', 'just',
  'not', "don't", 'dont', 'no', 'longer', 'part', 'bit', 'from', 'there',
]);

/** Predicate words: many Memories share them, so they alone never name one. Compared after stemming. */
const PREDICATE_WORDS_RAW = [
  'بحب', 'بحبه', 'بحبها', 'بكره', 'بفضل', 'ساكن', 'ساكنه', 'عايش', 'عايشه', 'بشتغل', 'شغال', 'شغاله', 'عندي', 'نفسي',
  // English verbs that are not also everyday nouns: "work" and "live" are left out ("the work stuff" names a topic).
  'like', 'love', 'prefer', 'hate', 'have', 'want', 'enjoy',
];

export function normalizeMemoryWords(value: string): string {
  return normalizeArabicComparison(value).replace(/[’']/gu, "'");
}

const PREDICATE_WORDS = new Set(PREDICATE_WORDS_RAW.map((word) => stem(normalizeMemoryWords(word))));

/** MEM-AR-01A: whether a distinctive word only names a predicate («بحب», "like", «ساكن»). */
export function isPredicateWord(word: string): boolean {
  return PREDICATE_WORDS.has(word);
}

/** The words that can identify one Memory. */
export function distinctiveWords(value: string): Set<string> {
  const tokens = normalizeMemoryWords(value).match(/[\p{L}\p{N}']+/gu) ?? [];
  return new Set(tokens.filter((token) => token.length > 1 && !STOP_WORDS.has(token)).map(stem).filter((token) => token.length > 1));
}

/**
 * `candidates` must be the caller's own rows, already filtered to the statuses the command may act on, in canonical
 * recency order (updated_at DESC, id DESC) — that order is also the order the options are offered in.
 */
export function resolveMemoryTarget(
  words: string, candidates: ReadonlyArray<MemoryRecord>, shared: ReadonlySet<string> = new Set(),
): MemoryTargetResolution {
  // `shared`: words the old and the new statement have in common (a correction's predicate, «ساكن» / "live"). They
  // cannot tell the remembered fact apart from its replacement, so only the rest of the words name the target —
  // unless nothing else is left.
  const all = distinctiveWords(words);
  const own = new Set([...all].filter((word) => !shared.has(word)));
  const query = own.size > 0 ? own : all;
  if (query.size === 0) return { state: 'UNSPECIFIED' };
  const scored = candidates.map((memory, order) => {
    const remembered = distinctiveWords(memory.content);
    const matched = [...query].filter((word) => remembered.has(word));
    // A partial match must share something that is not a mere predicate: «بحب» alone points at every preference.
    const telling = matched.some((word) => !PREDICATE_WORDS.has(word));
    return { memory, order, coverage: matched.length / query.size, telling };
  });
  const predicateOnly = [...query].every((word) => PREDICATE_WORDS.has(word));
  const full = predicateOnly ? [] : scored.filter(({ coverage }) => coverage === 1);
  if (full.length === 1) return { state: 'RESOLVED', memory: full[0].memory };
  if (full.length > 1) return { state: 'AMBIGUOUS', options: full.slice(0, MAX_CLARIFICATION_OPTIONS).map(({ memory }) => memory) };
  const partial = scored.filter(({ coverage, telling }) => (predicateOnly ? coverage === 1 : coverage >= 0.5 && telling))
    .sort((left, right) => right.coverage - left.coverage || left.order - right.order);
  if (partial.length > 0) return { state: 'PARTIAL', options: partial.slice(0, MAX_CLARIFICATION_OPTIONS).map(({ memory }) => memory) };
  return { state: 'NONE' };
}

// ---- MEM-AR-01B (PD-2) — the remembered fact a natural reversal reverses.
//
//   * BECAME «بقيت Y» replaces a value only in a SINGLE-VALUED frame: residence («أنا ساكن / ساكنة / عايش / عايشة في …»,
//     the evaluator's location frame). The target is a first-person statement of the same type in the same frame with
//     another value. Every other frame is treated as multi-valued: «بقيت بحب الشاي» never replaces «أنا بحب القهوة».
//   * NO_LONGER «مبقتش X» / STOPPED «بطلت X» negate the SAME object. Every distinctive word of X, its predicate included,
//     must be in the target; at least one of them must be more than a predicate («مبقتش بحب حاجة» names nothing); the
//     type must match when X is a typed statement; and a Memory that already negates or stops something is never the
//     fact being reversed. One morphological bridge, no semantics: after «بطلت» the first verb is the bare first-person
//     form («أشرب»), which a remembered habit says as «بشرب».
//   * exactly one target → RESOLVED; two or more → AMBIGUOUS (at most three, in the given recency order); none → NONE.
//     Nothing partial is ever offered: a reversal is not a request about Memory unless it names a remembered fact.
const RESIDENCE = /^انا (?:ساكن|ساكنه|عايش|عايشه) (?:في )?(.+)$/u;
const NEGATING_WORDS = new Set(['مش', 'مبقتش', 'بقتش', 'مابقتش', 'مبقيتش', 'بقيتش', 'مابقيتش', 'ماعدتش', 'معدتش', 'لست']);

function residenceValue(value: string): string | undefined {
  return normalizeMemoryWords(value).match(RESIDENCE)?.[1];
}

function negatesOrStops(content: string): boolean {
  const normalized = normalizeMemoryWords(content);
  return (normalized.match(/[\p{L}\p{N}']+/gu) ?? []).some((word) => NEGATING_WORDS.has(word) || word.includes('بطل')) || /(?:^| )لم اعد(?: |$)/u.test(normalized);
}

/** The words X must share with the target, each as its accepted forms. */
function negatedObjectSlots(clause: string, stopped: boolean): Array<ReadonlySet<string>> {
  const tokens = (normalizeMemoryWords(clause).match(/[\p{L}\p{N}']+/gu) ?? []).filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  return tokens.map((token, index) => {
    const forms = new Set([stem(token)]);
    if (stopped && index === 0 && /^ا(?!ل)[؀-ۿ]{2,}$/u.test(token)) forms.add(stem(`ب${token.slice(1)}`));
    return new Set([...forms].filter((form) => form.length > 1));
  }).filter((forms) => forms.size > 0);
}

/**
 * `words`: the new statement for BECAME, the negated clause X for NO_LONGER / STOPPED. `type`: the type of that
 * statement when the closed grammar gives it one. `candidates` as for `resolveMemoryTarget`.
 */
export function resolveReversalTarget(
  natural: NaturalReversal, words: string, type: MemoryType | undefined, candidates: ReadonlyArray<MemoryRecord>,
): MemoryTargetResolution {
  let targets: MemoryRecord[];
  if (natural === 'BECAME') {
    const value = residenceValue(words);
    if (value === undefined || type === undefined) return { state: 'NONE' };
    targets = candidates.filter((memory) => {
      const remembered = residenceValue(memory.content);
      return memory.type === type && remembered !== undefined && remembered !== value;
    });
  } else {
    const slots = negatedObjectSlots(words, natural === 'STOPPED');
    if (!slots.some((forms) => [...forms].some((word) => !PREDICATE_WORDS.has(word)))) return { state: 'NONE' };
    targets = candidates.filter((memory) => {
      if ((type !== undefined && memory.type !== type) || negatesOrStops(memory.content)) return false;
      const remembered = distinctiveWords(memory.content);
      return slots.every((forms) => [...forms].some((word) => remembered.has(word)));
    });
  }
  if (targets.length === 1) return { state: 'RESOLVED', memory: targets[0] };
  if (targets.length > 1) return { state: 'AMBIGUOUS', options: targets.slice(0, MAX_CLARIFICATION_OPTIONS) };
  return { state: 'NONE' };
}
