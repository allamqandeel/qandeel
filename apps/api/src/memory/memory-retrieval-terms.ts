// S8A-03 CP2 — the ONE tokenizer of Memory retrieval terms (migration 0171).
//
// Both sides of the semantic index use it: the background, when it indexes a Memory's own words and its semantic keys,
// and the foreground, when it turns the current message into query terms. PostgreSQL only compares the resulting terms
// for equality, so a term can never match unless both sides normalized it the same way. Lexical and deterministic: the
// MEM-AR-01A comparison normalizer and light stem, then the closed stop lists below. No meaning is guessed here.
import { lightArabicStem, normalizeArabicComparison } from './arabic-text';

/** MEM-AR-01A's lexical stop words, unchanged (the recent-Memory ranking reads exactly these). */
export const MEMORY_STOP_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'is', 'are', 'what', 'did', 'i', 'you', 'about', 'my', 'to', 'we', 'it',
  'فاكر', 'تفتكر', 'لما', 'قلتلك', 'قبل', 'كده', 'عن', 'في', 'من', 'على', 'انا', 'إيه', 'ايه',
  // MEM-AR-01A: «إني», «إنه», «إنها» (post-normalization forms) are particles, never what a Memory is about.
  'اني', 'انه', 'انها',
]);

// S8A-03 CP2: the index is consulted on EVERY turn, not only after a recall cue, so the everyday Egyptian / MSA /
// English function words and question words never select a Memory on their own. Post-normalization forms (أ إ آ → ا,
// ة → ه, ى → ي). Content words - what a Memory is about - are never listed here.
const RETRIEVAL_ONLY_STOP_WORDS = [
  'هو', 'هي', 'هما', 'هم', 'ده', 'دي', 'دا', 'دول', 'اللي', 'الي', 'الذي', 'التي', 'يعني', 'بس', 'كمان', 'برضه', 'برده',
  'عشان', 'علشان', 'لان', 'بقي', 'طب', 'طيب', 'اه', 'ايوه', 'لا', 'مش', 'مع', 'او', 'ولا', 'ان', 'كان', 'كانت', 'زي',
  'اوي', 'قوي', 'خالص', 'حاجه', 'حاجات', 'كدا', 'دلوقتي', 'انت', 'انتي', 'احنا', 'انتو', 'فين', 'امتي', 'ليه', 'ازاي',
  'مين', 'هل', 'ماذا', 'لماذا', 'كيف', 'متي', 'اين', 'عارف', 'تعرف', 'فاكره', 'قولي', 'قلي', 'قل', 'ممكن', 'لو', 'اذا',
  'و', 'ف', 'ب', 'ل', 'يا', 'ما', 'لي', 'ليا', 'عندي', 'كل', 'اي', 'حد', 'هنا', 'هناك', 'كنت', 'بقيت',
  'and', 'or', 'of', 'in', 'on', 'at', 'for', 'with', 'that', 'this', 'was', 'were', 'be', 'have', 'has', 'do', 'does',
  'your', 'me', 'know', 'tell', 'where', 'when', 'who', 'how', 'why', 'which', 'am', 'im', 'its', 'there', 'some', 'any',
];
export const MEMORY_RETRIEVAL_STOP_WORDS: ReadonlySet<string> = new Set([...MEMORY_STOP_WORDS, ...RETRIEVAL_ONLY_STOP_WORDS]);

/** The longest term the index accepts (0171 CHECK); a longer token is not a word anyone asks with. */
export const MAX_RETRIEVAL_TERM_LENGTH = 48;
/** The most terms one Memory is indexed under (0171), its own words first. */
export const MAX_RETRIEVAL_TERMS_PER_MEMORY = 64;
/** The most query terms one message sends to the index. */
export const MAX_RETRIEVAL_QUERY_TERMS = 32;

/** MEM-AR-01A lexical tokens (the recent-Memory ranking): normalized, stop words removed, light-stemmed. */
export function lexicalMemoryTokens(value: string): Set<string> {
  return stemmedTokens(value, MEMORY_STOP_WORDS);
}

/** The retrieval terms of a text, in first-seen order: the shared normalizer, the retrieval stop list, the light stem. */
export function memoryRetrievalTerms(value: string): string[] {
  return [...stemmedTokens(value, MEMORY_RETRIEVAL_STOP_WORDS)].filter((term) => term.length <= MAX_RETRIEVAL_TERM_LENGTH);
}

/** The bounded index terms of one Memory: its own words first, then its semantic keys; duplicates removed. */
export function memoryIndexTerms(content: string, keys: ReadonlyArray<string>): string[] {
  const terms = new Set(memoryRetrievalTerms(content));
  for (const key of keys) for (const term of memoryRetrievalTerms(key)) terms.add(term);
  return [...terms].slice(0, MAX_RETRIEVAL_TERMS_PER_MEMORY);
}

function stemmedTokens(value: string, stopWords: ReadonlySet<string>): Set<string> {
  return new Set(normalizeArabicComparison(value).match(/[\p{L}\p{N}]+/gu)
    ?.filter((token) => token.length > 1 && !stopWords.has(token)).map(lightArabicStem).filter((token) => token.length > 1) ?? []);
}
