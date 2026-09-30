// W3-MEGA-M (E2E-D-13) — which canonical Memory the user's words name.
//
// Pure and deterministic. The candidates are the caller's own canonical Memory rows (owner-token reads, bounded), so
// no other reader's row can ever be named, and no provider takes part. The rule is deliberately conservative:
//
//   * the user's DISTINCTIVE words (pronouns, particles and "the topic / the information" removed, light Arabic
//     prefix / suffix stemming) must ALL appear in exactly ONE candidate → that one is RESOLVED;
//   * several candidates contain all of them, or some contain only part of them → AMBIGUOUS, and QANDEEL asks —
//     it never picks the "best" one of several, and never acts on a partial match;
//   * nothing matches → NONE; no distinctive word at all ("that information", «المعلومة دي») → UNSPECIFIED.
//
// RESOLVED only proposes a target: the database re-checks it under a row lock before anything changes.
import type { MemoryRecord } from './memory.types';
import { MAX_CLARIFICATION_OPTIONS } from './memory-control.types';

export type MemoryTargetResolution =
  | { state: 'RESOLVED'; memory: MemoryRecord }
  | { state: 'AMBIGUOUS'; options: ReadonlyArray<MemoryRecord> }
  | { state: 'NONE' }
  | { state: 'UNSPECIFIED' };

const STOP_WORDS = new Set([
  // Arabic (normalized: ا for أإآ, ي for ى, ه for ة)
  'انا', 'انت', 'انتي', 'احنا', 'عني', 'عن', 'في', 'فى', 'من', 'على', 'علي', 'عليها', 'عليه', 'عليهم', 'عليا', 'الي', 'لي',
  'ان', 'اني', 'انه', 'انها', 'انك', 'ده', 'دي', 'دا', 'دول', 'كده', 'كدا', 'اللي', 'الذي', 'التي', 'هو', 'هي', 'هم',
  'بس', 'لكن', 'و', 'يا', 'مش', 'ما', 'لا', 'معايا', 'معاك', 'معانا', 'تاني', 'خالص', 'بقي', 'بقيت', 'بقت', 'دلوقتي',
  'حاليا', 'خلاص', 'موضوع', 'الموضوع', 'حكايه', 'الحكايه', 'قصه', 'القصه', 'معلومه', 'المعلومه', 'حاجه', 'الحاجه',
  'قنديل', 'كان', 'كنت', 'بعد', 'قبل', 'كمان', 'برضه', 'ذاكرتك', 'دماغك', 'كلامنا', 'كلامك', 'بتاع', 'بتاعه', 'بتاعت',
  'مكان', 'المكان',
  // English
  'i', "i'm", 'im', 'me', 'my', 'mine', 'you', 'your', 'the', 'a', 'an', 'that', 'this', 'it', 'is', 'am', 'are', 'was',
  'be', 'to', 'of', 'in', 'on', 'at', 'about', 'and', 'but', 'or', 'anymore', 'any', 'more', 'now', 'fact', 'info',
  'information', 'thing', 'stuff', 'topic', 'memory', 'please', 'qandeel', 'with', 'when', 'talking', 'so', 'just',
  'not', "don't", 'dont', 'no', 'longer', 'part', 'bit', 'from', 'there',
]);

const ARABIC_PREFIX = /^(?:وال|بال|فال|كال|لل|ال|و|ب|ف)(?=[؀-ۿ]{3,})/u;
const ARABIC_SUFFIX = /(?:هم|كم|نا|ها|ي|ك|ه)$/u;

export function normalizeMemoryWords(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('und')
    .replace(/[ـً-ٰٟ]/gu, '')
    .replace(/[أإآ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/ة/gu, 'ه')
    .replace(/[’']/gu, "'");
}

function stem(token: string): string {
  if (/^[؀-ۿ]+$/u.test(token)) {
    let word = token.replace(ARABIC_PREFIX, '');
    if (word.length >= 4) word = word.replace(ARABIC_SUFFIX, '');
    return word;
  }
  return token.length > 3 && token.endsWith('s') && !token.endsWith('ss') ? token.slice(0, -1) : token;
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
    const matched = [...query].filter((word) => remembered.has(word)).length;
    return { memory, order, coverage: matched / query.size };
  });
  const full = scored.filter(({ coverage }) => coverage === 1);
  if (full.length === 1) return { state: 'RESOLVED', memory: full[0].memory };
  if (full.length > 1) return { state: 'AMBIGUOUS', options: full.slice(0, MAX_CLARIFICATION_OPTIONS).map(({ memory }) => memory) };
  const partial = scored.filter(({ coverage }) => coverage >= 0.5)
    .sort((left, right) => right.coverage - left.coverage || left.order - right.order);
  if (partial.length > 0) return { state: 'AMBIGUOUS', options: partial.slice(0, MAX_CLARIFICATION_OPTIONS).map(({ memory }) => memory) };
  return { state: 'NONE' };
}
