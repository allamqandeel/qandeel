import { createHash } from 'node:crypto';
import type { ConfidenceMissingInformationCode } from '../hypothesis/confidence.types';
import type { HypothesisStatus } from '../hypothesis/hypothesis.types';
import {
  MAX_DETAIL_ALTERNATIVES, MAX_DETAIL_CONTEXT_ITEMS, MAX_DETAIL_EVOLUTION, UNDERSTANDING_CONFIDENCE_STATES,
  UNDERSTANDING_EVOLUTION_KINDS, UNDERSTANDING_LIST_MAX_LIMIT, UNDERSTANDING_THEMES, UnderstandingProjectionInvariantError,
  type UnderstandingConfidenceState,
} from './understanding.types';

/**
 * The structural facts the qualitative Product confidence is projected from. Every one is a canonical fact the
 * runtime already holds; none is a score. There is deliberately no field for a numeric score, a band, an Evidence
 * weight or Memory extraction confidence: the Confidence Runtime is UNCALIBRATED (numeric_score = null,
 * confidence_band = null) and this projection must not invent the calibration it lacks.
 */
export interface UnderstandingConfidenceFacts {
  readonly status: HypothesisStatus;
  /** Linked supporting Evidence that is CURRENTLY eligible (historical links are not counted). */
  readonly eligibleSupporting: number;
  /** Linked contradicting Evidence that is CURRENTLY eligible. */
  readonly eligibleContradicting: number;
  /**
   * The Confidence Runtime's structural record for the EXACT current version, or null when there is none. An older
   * version's record is never substituted: that is `null` here, exactly like NOT_EVALUATED_FOR_CURRENT_VERSION.
   */
  readonly exactVersionMissingInformation: readonly ConfidenceMissingInformationCode[] | null;
  /** An unresolved explicit disagreement by the reader (W3-MEGA-U U3, PG-01). */
  readonly contested: boolean;
}

/**
 * The ONE Product confidence projection. Deterministic, ordered, conservative:
 *
 * 1. an unresolved explicit disagreement                                    → MIXED
 * 2. the canonical lifecycle state MIXED                                    → MIXED
 * 3. currently eligible supporting AND contradicting context both present   → MIXED
 * 4. no Confidence record for the exact current version                     → NEEDS_MORE
 * 5. the canonical lifecycle state WEAK                                     → NEEDS_MORE
 * 6. no currently eligible supporting context (incl. NO_ELIGIBLE_EVIDENCE)  → NEEDS_MORE
 * 7. SUPPORTED, nothing contradicting, and the exact-version record names no structural gap other than the
 *    always-present CONFIDENCE_MODEL_UNCALIBRATED (no unverified assumption, no unassessed alternative)   → CLEAR
 * 8. ACTIVE or SUPPORTED with some support                                  → TAKING_SHAPE
 * 9. anything else                                                          → NEEDS_MORE
 *
 * CLEAR is the ONLY state that needs positive grounds, and they are all canonical structure: SUPPORTED is an explicit
 * lifecycle state that no automatic rule sets (migration 0036), and the rest are the absence of every structural gap
 * the Confidence Runtime can name. CLEAR claims no probability, no truth and no calibration — only that nothing the
 * runtime can see stands against it. When in doubt the answer is the more conservative state.
 */
export function projectUnderstandingConfidence(facts: UnderstandingConfidenceFacts): UnderstandingConfidenceState {
  if (facts.contested) return 'MIXED';
  if (facts.status === 'MIXED') return 'MIXED';
  if (facts.eligibleSupporting > 0 && facts.eligibleContradicting > 0) return 'MIXED';
  const record = facts.exactVersionMissingInformation;
  if (record === null) return 'NEEDS_MORE';
  if (facts.status === 'WEAK') return 'NEEDS_MORE';
  if (facts.eligibleSupporting === 0 || record.includes('NO_ELIGIBLE_EVIDENCE')) return 'NEEDS_MORE';
  if (facts.status === 'SUPPORTED' && facts.eligibleContradicting === 0 &&
    record.length > 0 && record.every((code) => code === 'CONFIDENCE_MODEL_UNCALIBRATED')) return 'CLEAR';
  if (facts.status === 'ACTIVE' || facts.status === 'SUPPORTED') return 'TAKING_SHAPE';
  return 'NEEDS_MORE';
}

const TOKEN = /^[A-Za-z0-9_-]{22}$/u;

function opaque(kind: 'item' | 'revision', parts: readonly (string | number)[]): string {
  // Domain-separated SHA-256 over the reader, the item and (for a revision) its exact version. Hypothesis ids are
  // random UUIDs, so a token is neither reversible nor guessable, and it is bound to its reader: another account can
  // compute nothing that resolves, because resolution only ever searches the caller's own items.
  return createHash('sha256').update(`qandeel.understanding.${kind}.v1\n${parts.join('\n')}`).digest('base64url').slice(0, 22);
}

export function understandingItemRef(userId: string, hypothesisId: string): string {
  return opaque('item', [userId, hypothesisId]);
}

export function understandingRevision(userId: string, hypothesisId: string, version: number): string {
  return opaque('revision', [userId, hypothesisId, version]);
}

export function isUnderstandingToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN.test(value);
}

// ---------------------------------------------------------------------------------------------------------------
// The outbound audit. Every response is checked against the exact Product shape BEFORE it leaves the server, so a
// widened upstream object, a numeric field, an internal identifier or an added reasoning field fails closed instead
// of reaching the client.

const SUMMARY_KEYS = ['confidence', 'ref', 'revision', 'summary', 'theme', 'underReview'];
const DETAIL_KEYS = [...SUMMARY_KEYS, 'alternatives', 'contradictions', 'evidence', 'evolution', 'unresolved'].sort();
const MAX_TEXT = 2000;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

function reject(): never { throw new UnderstandingProjectionInvariantError(); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(value).sort();
  return own.length === keys.length && own.every((key, index) => key === [...keys].sort()[index]);
}
function text(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0 && [...value].length <= MAX_TEXT;
}
function textList(value: unknown, max: number): boolean {
  return Array.isArray(value) && value.length <= max && value.every(text);
}

function auditSummaryFields(value: Record<string, unknown>): void {
  if (!isUnderstandingToken(value.ref) || !isUnderstandingToken(value.revision) ||
    !(UNDERSTANDING_THEMES as readonly unknown[]).includes(value.theme) ||
    !(UNDERSTANDING_CONFIDENCE_STATES as readonly unknown[]).includes(value.confidence) || !text(value.summary) ||
    typeof value.underReview !== 'boolean') reject();
  // An item under review is never presented as anything but Mixed (P1 §11.4; P4-C3R `confMixed`).
  if (value.underReview === true && value.confidence !== 'MIXED') reject();
}

export function auditUnderstandingList(value: unknown): void {
  if (!isRecord(value) || !exactKeys(value, ['items']) || !Array.isArray(value.items) ||
    value.items.length > UNDERSTANDING_LIST_MAX_LIMIT) reject();
  const refs = new Set<string>();
  for (const item of value.items as unknown[]) {
    if (!isRecord(item) || !exactKeys(item, SUMMARY_KEYS)) reject();
    auditSummaryFields(item);
    if (refs.has(item.ref as string)) reject();
    refs.add(item.ref as string);
  }
}

export function auditUnderstandingDetail(value: unknown): void {
  if (!isRecord(value) || !exactKeys(value, DETAIL_KEYS)) reject();
  auditSummaryFields(value);
  if (!textList(value.evidence, MAX_DETAIL_CONTEXT_ITEMS) || !textList(value.contradictions, MAX_DETAIL_CONTEXT_ITEMS) ||
    !textList(value.alternatives, MAX_DETAIL_ALTERNATIVES) || !textList(value.unresolved, MAX_DETAIL_CONTEXT_ITEMS) ||
    !Array.isArray(value.evolution) || value.evolution.length > MAX_DETAIL_EVOLUTION) reject();
  for (const entry of value.evolution as unknown[]) {
    if (!isRecord(entry) || !exactKeys(entry, ['at', 'kind']) ||
      !(UNDERSTANDING_EVOLUTION_KINDS as readonly unknown[]).includes(entry.kind) ||
      typeof entry.at !== 'string' || !ISO.test(entry.at)) reject();
  }
}
