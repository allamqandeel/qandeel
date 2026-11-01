import { arabicWords, canonicalDiacritized, hasDiacritics, SENTENCE_END, stripDiacritics } from './arabic-text';
import { PRONUNCIATION_LEXICON } from './pronunciation-lexicon';
import type { SpeechHintCandidate } from './speech-markup';

/**
 * S8B-04 (CP1, contract v1.2 §6.3 B / C, §6.10 SR-D1) — the deterministic validator of the model's own pronunciation hints
 * (`[[say:WORD]]`, TM-03), and the two filtering policies P-1 measures.
 *
 * A hint is kept only when EVERY condition holds; otherwise the hint alone is dropped (counted by reason) and the reply
 * text is untouched:
 *   - each part is Arabic letters and diacritics only, with at least one diacritic (no Latin, no explanation);
 *   - its letters equal exactly ONE word of the sentence it follows (a word written twice in that sentence is ambiguous);
 *   - that word carries no diacritic already;
 *   - that word is not a name on the protected list (TM-03 forbids names; this list is the deterministic backstop, the
 *     names P-1 and L-0 test. It never guesses that a word is a name, so it can only REMOVE a hint, never add one);
 *   - at most 2 hints in a sentence and 4 in the reply (`PROPOSED`, §6.3 B), in order.
 *
 * Policy (the hint channel's production state is a reviewed code constant, never a runtime switch):
 *   - OFF: TM-03 is not sent and no hint is used. The CP1 production state until P-1 (§6.5 point 3);
 *   - B_ALL: every valid hint is applied;
 *   - B_FILTERED: a valid hint whose reading is a recorded DEFAULT reading of its word is dropped (A2's default readings
 *     and the readings Gemini got right without diacritics in L-0).
 */

export type SpeechHintPolicy = 'OFF' | 'B_ALL' | 'B_FILTERED';

/** CP1 production state: the hint channel is built and tested, and OFF until P-1 measures it (Product Owner, CP1 brief B). */
export const SPEECH_HINT_POLICY: SpeechHintPolicy = 'OFF';

export const MAX_HINTS_PER_SENTENCE = 2;
export const MAX_HINTS_PER_REPLY = 4;

/** Names the hint channel never vocalizes (L-0 N01–N08 and the P-1 abstention items). Removal only. */
export const PROTECTED_NAMES: ReadonlySet<string> = new Set([
  'هدير', 'يوسف', 'أسوان', 'إسراء', 'ضحى', 'عبدالعزيز', 'نورة', 'الرياض', 'جورج', 'رامي', 'حلب', 'جان', 'بيير', 'باريس',
  'نور', 'عميرة',
]);

/**
 * The recorded DEFAULT readings (B_FILTERED): the lexicon's default readings, plus every reading Gemini read correctly
 * WITHOUT diacritics in L-0 (BASELINE verdict CORRECT on a homograph case). Diacritizing these made the voice less
 * natural in 12 / 31 (§6.2a), so a hint for them is dropped under B_FILTERED.
 */
export const DEFAULT_READINGS: ReadonlySet<string> = new Set([
  ...PRONUNCIATION_LEXICON.map((e) => e.defaultReading).filter((r): r is string => r !== null),
  'العَلَم', 'العِلْم', 'عَلِمَ', 'كُتُب', 'كَتَبَ', 'المَلِك', 'الحُبّ', 'الحَبّ', 'القَدَر', 'العَقْد', 'شَعْرُها',
  'الشِّعْر', 'شَعَرَ', 'دَيْن', 'دِين', 'البَرّ', 'بِرّ', 'حَمَلَ', 'الحَمْل', 'الذَّهَب', 'ذَهَبَ', 'قَبِلَ', 'قَبْل', 'جِدّي',
  'جَدّ', 'عُمَر',
].map(canonicalDiacritized));

export type SpeechHintDropReason =
  | 'FORMAT' | 'NO_MATCH' | 'AMBIGUOUS' | 'ALREADY_DIACRITIZED' | 'NAME' | 'SENTENCE_LIMIT' | 'REPLY_LIMIT' | 'DEFAULT_READING';

/** A validated hint: the exact span of the word in the visible text and the vocalized form to speak there. */
export interface ValidatedSpeechHint {
  readonly start: number;
  readonly end: number;
  readonly spoken: string;
}

export interface SpeechHintValidation {
  readonly hints: readonly ValidatedSpeechHint[];
  readonly dropped: Readonly<Partial<Record<SpeechHintDropReason, number>>>;
}

const HINT_PART = /^[ء-يً-ْٰ]{1,30}$/u;

function sentenceRangeBefore(text: string, at: number): [number, number] {
  let end = Math.min(at, text.length);
  while (end > 0 && /[\s.!?؟…]/u.test(text[end - 1])) end -= 1;
  let start = end;
  while (start > 0 && !SENTENCE_END.test(text[start - 1])) start -= 1;
  return [start, end];
}

/**
 * Validates the parser's hint candidates against the VISIBLE text. Pure. The policy OFF yields no hint at all; storage
 * and rendering both read this result, so a hint is never used that this function did not keep.
 */
export function validateSpeechHints(
  text: string,
  candidates: readonly SpeechHintCandidate[],
  policy: SpeechHintPolicy,
): SpeechHintValidation {
  const dropped: Partial<Record<SpeechHintDropReason, number>> = {};
  const drop = (reason: SpeechHintDropReason): void => {
    dropped[reason] = (dropped[reason] ?? 0) + 1;
  };
  if (policy === 'OFF') return { hints: [], dropped };

  const hints: ValidatedSpeechHint[] = [];
  const perSentence = new Map<number, number>();
  const used = new Set<number>();
  for (const candidate of candidates) {
    const parts = candidate.word.split('|');
    if (parts.length > MAX_HINTS_PER_SENTENCE) {
      drop('FORMAT');
      continue;
    }
    for (const part of parts) {
      if (!HINT_PART.test(part) || !hasDiacritics(part)) {
        drop('FORMAT');
        continue;
      }
      const [sStart, sEnd] = sentenceRangeBefore(text, candidate.at);
      const letters = stripDiacritics(part);
      const matches = arabicWords(text.slice(sStart, sEnd)).filter((w) => stripDiacritics(w.text) === letters);
      if (matches.length === 0) { drop('NO_MATCH'); continue; }
      if (matches.length > 1) { drop('AMBIGUOUS'); continue; }
      const word = matches[0];
      const start = sStart + word.start;
      if (hasDiacritics(word.text)) { drop('ALREADY_DIACRITIZED'); continue; }
      if (PROTECTED_NAMES.has(word.text)) { drop('NAME'); continue; }
      if (used.has(start)) { drop('AMBIGUOUS'); continue; }
      if (policy === 'B_FILTERED' && DEFAULT_READINGS.has(canonicalDiacritized(part))) { drop('DEFAULT_READING'); continue; }
      if ((perSentence.get(sStart) ?? 0) >= MAX_HINTS_PER_SENTENCE) { drop('SENTENCE_LIMIT'); continue; }
      if (hints.length >= MAX_HINTS_PER_REPLY) { drop('REPLY_LIMIT'); continue; }
      perSentence.set(sStart, (perSentence.get(sStart) ?? 0) + 1);
      used.add(start);
      hints.push({ start, end: start + word.text.length, spoken: part });
    }
  }
  hints.sort((a, b) => a.start - b.start);
  return { hints, dropped };
}

/** The stored form of the validated hints (§6.10 NO-PERSIST: the vocalized word and its offset, never the spoken text). */
export interface StoredSpeechHint {
  readonly offset: number;
  readonly word: string;
}

export function toStoredHints(hints: readonly ValidatedSpeechHint[]): StoredSpeechHint[] {
  return hints.map((h) => ({ offset: h.start, word: h.spoken }));
}

/**
 * Re-validates stored hints against the visible text they were stored for: a stored hint is used only if its offset still
 * names an undiacritized word whose letters are exactly the hint's. Anything else is dropped (defence in depth).
 */
export function fromStoredHints(text: string, stored: readonly StoredSpeechHint[]): ValidatedSpeechHint[] {
  const words = new Map(arabicWords(text).map((w) => [w.start, w] as const));
  return stored.flatMap((s) => {
    const word = words.get(s.offset);
    if (!word || hasDiacritics(word.text) || PROTECTED_NAMES.has(word.text)) return [];
    if (!HINT_PART.test(s.word) || !hasDiacritics(s.word) || stripDiacritics(s.word) !== word.text) return [];
    return [{ start: word.start, end: word.end, spoken: s.word }];
  }).slice(0, MAX_HINTS_PER_REPLY);
}
