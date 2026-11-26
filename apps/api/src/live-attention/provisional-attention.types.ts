// INTEL-LIVE-01 CP1 — continuous in-speech understanding: the provisional attention lane's types and its configuration.
//
// Contract stack (binding in this order): CP0 v1.0 -> v1.1 (C1-C7) -> A1 v1.2 (semantic-driven) -> A2 (final execution
// conditions); the Product Owner's "INTEL-LIVE-01 — Final PO Execution Authorization" (2026-11-25).
//
// DeepSeek is the semantic authority: it alone decides whether new evidence is a meaningful development. The tracker owns
// evidence COVERAGE and ORDER, never meaning. Nothing here thresholds by time, word count or keyword: the configuration
// below is backpressure only (serialisation, timeout, backoff, permit retry) and the context bound (A2 §3), and none of it
// decides WHETHER understanding happens.

/** The call's two tracks: the person's speech, and QANDEEL's speech once the phone confirmed it was heard. */
export type AttentionTrack = 'USER' | 'QANDEEL';

/**
 * One evidence unit: one FINAL segment as the recognizer emitted it (USER), or one whole reply piece once heard
 * (QANDEEL). Never a word, never an INTERIM (D-1). Its identity is (call, track, clock range) on the call's capture
 * clock (A2 §4); `seq` is a local order only and is never stored.
 */
export interface EvidenceUnit {
  readonly seq: number;
  readonly track: AttentionTrack;
  readonly text: string;
  readonly clockStartMs: number;
  readonly clockEndMs: number;
  /** The capture position the server had ingested when the evidence arrived (v1.1's evidence instant). */
  readonly arrivedClockMs: number;
}

export const ATTENTION_KINDS = ['TOPIC', 'PERSON', 'PLACE', 'EXPERIENCE', 'CONCERN', 'PLAN'] as const;
export type AttentionKind = typeof ATTENTION_KINDS[number];
export const ATTENTION_CONFIDENCES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type AttentionConfidence = typeof ATTENTION_CONFIDENCES[number];

/** A subject of attention still open (its latest event is a SET). */
export interface OpenSubject {
  readonly subjectKey: string;
  readonly label: string;
  readonly kind: AttentionKind;
  readonly confidence: AttentionConfidence;
  readonly threadRef: string | null;
}

/** One development the evaluator emitted, bound to the evidence unit it depends on. */
export interface AttentionDevelopment {
  readonly op: 'SET' | 'WITHDRAW';
  readonly subjectKey: string;
  readonly label: string;
  readonly kind: AttentionKind;
  readonly confidence: AttentionConfidence;
  readonly threadRef: string | null;
  readonly dependsOnSeq: number;
}

/** One of the person's own durable Threads of the session, under the name COSMOS shows (0198 D-3). */
export interface AttentionThread {
  readonly id: string;
  readonly name: string;
}

/**
 * What one admission sends, in the prompt's prefix-stable order (A1 §2.3): the evaluated text of the turn so far
 * (append-only, the last MAX_TURN_TEXT_WORDS), the evaluator's own carried context, the open subjects (the oldest beyond
 * the fold threshold are folded, never dropped: A2 §3), the Threads, and the new evidence — the span, whole.
 */
export interface AttentionEvaluationInput {
  readonly track: AttentionTrack;
  readonly priorText: string;
  /** True when the evaluated text no longer fits the window: older words have left it, or will at the next admission. */
  readonly carryRequired: boolean;
  readonly contextCarry: string | null;
  readonly openSubjects: readonly OpenSubject[];
  readonly foldedSubjects: readonly OpenSubject[];
  readonly threads: readonly AttentionThread[];
  readonly newEvidence: readonly { readonly seq: number; readonly text: string }[];
}

export interface AttentionUsage {
  readonly promptTokens: number;
  readonly cacheHitTokens: number;
  readonly completionTokens: number;
}

export type AttentionEvaluationResult =
  | {
    readonly kind: 'DEVELOPMENTS' | 'NONE';
    readonly developments: readonly AttentionDevelopment[];
    /** Null: keep the carried context as it is. */
    readonly contextCarry: string | null;
    readonly usage: AttentionUsage | null;
    readonly providerMs: number;
  }
  | {
    readonly kind: 'TIMEOUT' | 'REFUSED' | 'PROVIDER_FAILED';
    readonly usage: AttentionUsage | null;
    readonly providerMs: number;
    /** PROVIDER_FAILED only: the provider refused for its own capacity (HTTP 429 / 5xx), as opposed to a malformed call. */
    readonly overloaded?: boolean;
  };

/** The semantic authority, behind its port (provider-replaceable; the production binding is DeepSeek Flash). */
export interface AttentionEvaluator {
  evaluate(input: AttentionEvaluationInput, signal: AbortSignal): Promise<AttentionEvaluationResult>;
}

/** The coverage outcomes the tracker records (0204 `call_attention_evaluations.outcome`, the writer's input domain). */
export type RecordedOutcome =
  | 'DEVELOPMENTS' | 'NONE' | 'TIMEOUT' | 'REFUSED' | 'PROVIDER_FAILED' | 'DEFERRED_PERMIT' | 'MISSED_HANDOVER' | 'DEGRADED_SUSPENDED';

/**
 * Backpressure and the context bound (A1 D-6 as withdrawn to backpressure only; A2 §1 / §3). No field here is a time,
 * word or keyword threshold on WHETHER understanding happens (asserted by the static contract).
 */
export interface ProvisionalAttentionConfig {
  /** The evaluator's own timeout (A1 D-6: 4 000 ms). */
  readonly evaluatorTimeoutMs: number;
  /** After this many consecutive TIMEOUT / REFUSED / PROVIDER_FAILED results the next admission waits backoffMs. */
  readonly failuresBeforeBackoff: number;
  readonly backoffMs: number;
  /** A deferred admission (no permit) is asked again after this. */
  readonly permitRetryMs: number;
  /** The context bound: the evaluated text sent is the last this many words; unevaluated evidence is never cut (A2 §3). */
  readonly maxTurnTextWords: number;
  /** The fold threshold of the open-subject state (A2 §3: a fold, never a drop). */
  readonly maxOpenSubjects: number;
  /** The most Threads offered to the evaluator (the reader's own bound is 64). */
  readonly maxThreads: number;
  /** A2 §1: the emergency per-call spend guard in USD, disabled (null) by default. Reached = DEGRADED, a product failure. */
  readonly emergencyCallSpendUsd: number | null;
  /**
   * A2 §1: "sustained 429/5xx beyond the backoff" — this many CONSECUTIVE capacity refusals of the provider (each past
   * its backoff) put the lane in DEGRADED for the rest of the call. Provider health, never meaning.
   */
  readonly overloadedFailuresBeforeDegraded: number;
}

export const DEFAULT_PROVISIONAL_ATTENTION_CONFIG: ProvisionalAttentionConfig = Object.freeze({
  evaluatorTimeoutMs: 4_000,
  failuresBeforeBackoff: 2,
  backoffMs: 5_000,
  permitRetryMs: 1_000,
  maxTurnTextWords: 600,
  maxOpenSubjects: 24,
  maxThreads: 32,
  emergencyCallSpendUsd: null,
  overloadedFailuresBeforeDegraded: 6,
});

/**
 * DeepSeek Flash list prices per 1M tokens at PEAK (the higher rate: off-peak is half), as checked on 2026-11-25 for the
 * CP0 contract (v1.1 §5). The emergency guard prices usage at these rates; the cost ledger itself (AI-COST-01) leaves
 * DeepSeek UNPRICED until an operator registers a reviewed Price Card, so this is never a billing figure.
 */
export const DEEPSEEK_FLASH_PEAK_USD_PER_MTOK = Object.freeze({ cacheHit: 0.006, cacheMiss: 0.30, output: 1.20 });

export function estimatedSpendUsd(usage: AttentionUsage): number {
  const miss = Math.max(0, usage.promptTokens - usage.cacheHitTokens);
  return (usage.cacheHitTokens * DEEPSEEK_FLASH_PEAK_USD_PER_MTOK.cacheHit
    + miss * DEEPSEEK_FLASH_PEAK_USD_PER_MTOK.cacheMiss
    + usage.completionTokens * DEEPSEEK_FLASH_PEAK_USD_PER_MTOK.output) / 1_000_000;
}

/** What a proof or a test may observe of the lane: instants, counts and outcomes only, never a word. */
export type AttentionObservation =
  | {
    readonly kind: 'ATTENTION_ADMITTED'; readonly track: AttentionTrack; readonly evalOrdinal: number;
    readonly fromClockMs: number; readonly toClockMs: number; readonly units: number; readonly words: number;
    readonly subSpan: boolean; readonly folded: number; readonly carryRequired: boolean; readonly admittedClockMs: number;
    readonly at: number;
  }
  | {
    readonly kind: 'ATTENTION_RESOLVED'; readonly track: AttentionTrack; readonly evalOrdinal: number;
    readonly outcome: RecordedOutcome; readonly written: string; readonly developments: number;
    readonly fromClockMs: number; readonly toClockMs: number; readonly producedClockMs: number | null;
    readonly providerMs: number | null; readonly usage: AttentionUsage | null; readonly at: number;
    /** The written events' numbers (0204 event_seq), for the proofs' ordering checks. */
    readonly firstEventSeq: number | null; readonly lastEventSeq: number | null;
  }
  | { readonly kind: 'ATTENTION_DEFERRED'; readonly track: AttentionTrack; readonly reason: 'PERMIT' | 'BACKOFF' | 'WRITE_FAILED'; readonly at: number }
  | { readonly kind: 'ATTENTION_DEGRADED'; readonly reason: 'EMERGENCY_SPEND' | 'PROVIDER_OVERLOADED'; readonly at: number }
  | { readonly kind: 'ATTENTION_STOPPED'; readonly reason: 'FENCED' | 'NOT_FOUND' | 'CALL_ENDED' | 'CLOSED' | 'HANDOVER'; readonly at: number }
  | { readonly kind: 'ATTENTION_EVIDENCE'; readonly track: AttentionTrack; readonly clockStartMs: number; readonly clockEndMs: number; readonly at: number };
