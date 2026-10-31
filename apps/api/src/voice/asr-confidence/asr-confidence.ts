import { normalizeArabicComparison } from '../../memory/arabic-text';
import type { RecognizedWord } from '../batch-transcription-jobs.port';
import { isHighImpactWord } from './high-impact-words';

/**
 * S8B-03 (CP1, contract §4.5) — the ONE confidence band of a voice note, conservative and with stated limits. Pure and
 * CPU-only. The provider reports a confidence per word; it is not a probability that the meaning is right and no
 * calibration is claimed. The thresholds are governed starting values, not a measured accuracy.
 *
 *   1. the words are the provider's recognized words (first alternative; punctuation is never a word here);
 *   2. fail safe: no word → NO_SPEECH; any word without a numeric confidence in [0, 1] → LOW;
 *   3. the duration-weighted mean: ≥ T_HIGH → HIGH, ≥ T_MEDIUM → MEDIUM, otherwise LOW;
 *   4. any high-impact word (negation, change / time, Memory verbs, numbers / dates, the other language) heard below
 *      T_HIGH makes the whole note LOW, whatever the mean;
 *   5. matching runs on the shared Arabic comparison normalizer (memory/arabic-text.ts);
 *   6. every word below T_HIGH is kept normalized and unique (at most 64) as an uncertain token (E11).
 *
 * What no band can reveal, and is never claimed: a word the provider dropped entirely (a missing «مش» has no confidence),
 * and person names as a class (no reliable source tells them apart). The other protections cover those two limits.
 */
export type VoiceNoteBand = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AsrBandThresholds {
  readonly high: number;
  readonly medium: number;
}

/** OD-8: the approved starting values. */
export const DEFAULT_ASR_BAND_THRESHOLDS: AsrBandThresholds = Object.freeze({ high: 0.85, medium: 0.65 });
/** The governed bounds: the server refuses to start outside them (the P-1 pattern). */
export const ASR_BAND_THRESHOLD_BOUNDS = Object.freeze({ highMin: 0.7, highMax: 0.99, mediumMin: 0.4 });
export const MAX_UNCERTAIN_TOKENS = 64;
export const MAX_TRANSCRIPT_CHARACTERS = 20_000;

export type VoiceNoteClassification =
  | { readonly kind: 'NO_SPEECH' }
  | { readonly kind: 'TOO_LONG' }
  | { readonly kind: 'TRANSCRIBED'; readonly text: string; readonly band: VoiceNoteBand; readonly uncertainTokens: readonly string[] };

/**
 * Validates governed thresholds; throws (startup refusal) outside T_HIGH ∈ [0.70, 0.99] and T_MEDIUM ∈ [0.40, T_HIGH).
 * Unset values take the approved defaults.
 */
export function asrBandThresholds(high?: string, medium?: string): AsrBandThresholds {
  const parse = (value: string | undefined, fallback: number, name: string) => {
    if (value === undefined || value.trim() === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
    return parsed;
  };
  const t = { high: parse(high, DEFAULT_ASR_BAND_THRESHOLDS.high, 'VOICE_ASR_BAND_HIGH'), medium: parse(medium, DEFAULT_ASR_BAND_THRESHOLDS.medium, 'VOICE_ASR_BAND_MEDIUM') };
  if (t.high < ASR_BAND_THRESHOLD_BOUNDS.highMin || t.high > ASR_BAND_THRESHOLD_BOUNDS.highMax) {
    throw new Error('VOICE_ASR_BAND_HIGH must be within [0.70, 0.99]');
  }
  if (t.medium < ASR_BAND_THRESHOLD_BOUNDS.mediumMin || !(t.medium < t.high)) {
    throw new Error('VOICE_ASR_BAND_MEDIUM must be within [0.40, VOICE_ASR_BAND_HIGH)');
  }
  return Object.freeze(t);
}

const hasConfidence = (word: RecognizedWord): word is RecognizedWord & { confidence: number } =>
  typeof word.confidence === 'number' && Number.isFinite(word.confidence) && word.confidence >= 0 && word.confidence <= 1;

/** Classifies one note's recognized words. */
export function classifyVoiceNote(words: readonly RecognizedWord[], thresholds: AsrBandThresholds = DEFAULT_ASR_BAND_THRESHOLDS): VoiceNoteClassification {
  const heard = words.filter((word) => word.text.trim() !== '');
  if (heard.length === 0) return { kind: 'NO_SPEECH' };
  const text = heard.map((word) => word.text.trim()).join(' ');
  if (text.length > MAX_TRANSCRIPT_CHARACTERS) return { kind: 'TOO_LONG' };

  const uncertain: string[] = [];
  for (const word of heard) {
    if (hasConfidence(word) && word.confidence >= thresholds.high) continue;
    const token = normalizeArabicComparison(word.text);
    if (token !== '' && !uncertain.includes(token) && uncertain.length < MAX_UNCERTAIN_TOKENS) uncertain.push(token);
  }
  const result = (band: VoiceNoteBand): VoiceNoteClassification => ({ kind: 'TRANSCRIBED', text, band, uncertainTokens: Object.freeze(uncertain) });

  if (!heard.every(hasConfidence)) return result('LOW');
  const scored = heard as readonly (RecognizedWord & { confidence: number })[];

  const arabicMajority = scored.filter((w) => ARABIC_LETTER.test(w.text)).length >= scored.filter((w) => LATIN_LETTER.test(w.text)).length;
  if (scored.some((w) => w.confidence < thresholds.high && isHighImpactWord(w.text, arabicMajority))) return result('LOW');

  // A word's weight is its heard duration; a zero-length word still counts once (never a division by zero).
  let weighted = 0;
  let total = 0;
  for (const w of scored) {
    const weight = Math.max(1, w.endMs - w.startMs);
    weighted += w.confidence * weight;
    total += weight;
  }
  const mean = weighted / total;
  return result(mean >= thresholds.high ? 'HIGH' : mean >= thresholds.medium ? 'MEDIUM' : 'LOW');
}

const ARABIC_LETTER = /[\u{0621}-\u{064A}\u{0671}-\u{06D3}]/u;
const LATIN_LETTER = /[A-Za-z]/u;
