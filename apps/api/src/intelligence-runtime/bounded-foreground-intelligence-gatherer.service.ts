import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ModelRouterMemoryContext, ProcessingPath } from '../model-router/model-router.types';
import { MemoryRetrieverService } from '../memory/memory-retriever.service';
import { MemoryDataApiError } from '../memory/memory-data-api.service';
import { HypothesisReasoningContextService } from '../hypothesis/hypothesis-reasoning-context.service';
import { HYPOTHESIS_REASONING_CONTEXT_CONTRACT_VERSION, HypothesisReasoningInvariantError, MAX_MODEL_HYPOTHESES, type HypothesisReasoningContext, type HypothesisReasoningContextResult } from '../hypothesis/hypothesis-reasoning-context.types';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import {
  QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS,
  type BoundedForegroundIntelligenceGatherInput,
  type BoundedForegroundIntelligenceGatherResult,
  type HypothesisForegroundOutcome,
  type MemoryForegroundOutcome,
} from './bounded-foreground-intelligence-gatherer.types';

// QIR-003: the module-private, structurally typed malformed-result identity.
//
// A source result that is not one of the canonical shapes is classified by
// CONSTRUCTOR IDENTITY at the one place it is created, never by substring
// matching, and it always FAILS CLOSED: it is never exported, never converted
// into a degraded outcome, and never replaced with a fabricated empty answer.
class BoundedForegroundIntelligenceMalformedResultError extends Error {
  constructor() { super('QIR_FOREGROUND_INTELLIGENCE_MALFORMED_RESULT'); }
}

// The two degraded outcomes are frozen singletons carrying no value: an
// unavailable or expired source is OMISSION, never an empty-memory assertion,
// never a fabricated EMPTY coverage result, and never a stale answer.
const OPTIONAL_AVAILABILITY_FAILURE_OUTCOME = Object.freeze({ state: 'OPTIONAL_AVAILABILITY_FAILURE' as const });
const FOREGROUND_BUDGET_EXPIRY_OUTCOME = Object.freeze({ state: 'FOREGROUND_BUDGET_EXPIRY' as const });

// QIR-003 exact optional-availability classifier. ONLY these two shapes may
// degrade to OPTIONAL_AVAILABILITY_FAILURE:
//
//   1. a Nest ServiceUnavailableException from the canonical read
//      transport/configuration boundary (missing Data API configuration or a
//      fetch/network/AbortSignal transport failure is already sanitized into
//      exactly this identity by MemoryDataApiService);
//   2. a MemoryDataApiError whose HTTP status is 408, 429, or 500..599.
//
// Everything else - HypothesisReasoningInvariantError, MemoryDataApiError with
// any other 4xx status including 401 and 403, malformed results, and every
// unexpected error type - stays a HARD failure: the classifier rethrows and
// the turn fails closed before any provider generation. Classification is by
// constructor identity and numeric status only: no error-message substring is
// ever consulted, and the QHIA-011A opaque upstream database identity is never
// read here.
function isApprovedTransportAvailabilityStatus(status: number): boolean {
  return status === 408 || status === 429 || (Number.isInteger(status) && status >= 500 && status <= 599);
}
function classifyForegroundSourceFailure(error: unknown): typeof OPTIONAL_AVAILABILITY_FAILURE_OUTCOME {
  if (error instanceof ServiceUnavailableException) return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME;
  if (error instanceof MemoryDataApiError && isApprovedTransportAvailabilityStatus(error.status)) return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME;
  throw error;
}

// QIR-003 Fix 01: successful source results are classified by TOTAL runtime
// validation over `unknown` - TypeScript erasure is never trusted at this
// boundary. AVAILABLE is returned only after the value is POSITIVELY proven
// to be the canonical runtime shape; anything else - a non-array Memory
// result, a Memory item that is not an object or carries a wrong-typed
// field, or a Hypothesis envelope whose canonical identity or cross-field
// count/truncation/list invariants do not hold - is malformed and FAILS
// CLOSED through the typed identity above, exactly like an unexpected error.
//
// Scope: this is structural/integrity validation of the canonical shapes
// only. It invents no Memory ranking, relevance, authority, enum, freshness
// or context-budget semantics, and it does not move Hypothesis item
// semantics or Recommendation grounding authority into the gatherer: the
// deeper per-item rules remain owned by the canonical
// HypothesisReasoningContextService builder and the Recommendation grounding
// validator, both unchanged. The envelope invariants proven here reuse the
// canonical Hypothesis-owned contract constants.
//
// Memory: a deterministic cue-gated no-retrieval and a successful
// zero-memory selection are BOTH the same legitimate empty answer (the
// retriever returns an empty array for both); a valid non-empty selection is
// AVAILABLE.
function isCanonicalMemoryContextItem(item: unknown): item is ModelRouterMemoryContext {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
  const record = item as Record<string, unknown>;
  return typeof record.type === 'string'
    && typeof record.content === 'string'
    && (record.source === undefined || typeof record.source === 'string');
}
function isCanonicalMemoryContextList(value: unknown): value is ReadonlyArray<ModelRouterMemoryContext> {
  return Array.isArray(value) && value.every((item) => isCanonicalMemoryContextItem(item));
}
function classifyMemoryResult(value: unknown): MemoryForegroundOutcome {
  if (!isCanonicalMemoryContextList(value)) throw new BoundedForegroundIntelligenceMalformedResultError();
  if (value.length === 0) return { state: 'LEGITIMATE_EMPTY' };
  return { state: 'AVAILABLE', value };
}
// Hypothesis: exactly the two canonical coverage shapes are accepted, and the
// AVAILABLE envelope must satisfy the canonical cross-field invariants the
// builder guarantees - the exact contract/source/coverage identity, a
// non-empty bounded hypotheses list of objects, includedHypothesisCount
// equal to the list length, a candidate count that is a safe integer no
// smaller than the included count, and a truncation flag consistent with
// those counts. An envelope that fails any of these is never AVAILABLE and
// never a fabricated EMPTY: it fails closed here, before any AVAILABLE
// telemetry or provider-envelope assembly could observe it.
function isCanonicalAvailableHypothesisContext(context: unknown): context is HypothesisReasoningContext {
  if (context === null || typeof context !== 'object' || Array.isArray(context)) return false;
  const record = context as Record<string, unknown>;
  const hypotheses = record.hypotheses;
  if (!Array.isArray(hypotheses) || hypotheses.length === 0 || hypotheses.length > MAX_MODEL_HYPOTHESES) return false;
  if (!hypotheses.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))) return false;
  const candidateCount = record.candidateHypothesisCount;
  return record.contractVersion === HYPOTHESIS_REASONING_CONTEXT_CONTRACT_VERSION
    && record.source === 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT'
    && record.coverageState === 'AVAILABLE'
    && typeof record.truncated === 'boolean'
    && record.includedHypothesisCount === hypotheses.length
    && typeof candidateCount === 'number' && Number.isSafeInteger(candidateCount)
    && candidateCount >= hypotheses.length
    && record.truncated === (hypotheses.length < candidateCount);
}
function isCanonicalAvailableHypothesisResult(value: unknown): value is Extract<HypothesisReasoningContextResult, { coverageState: 'AVAILABLE' }> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.coverageState === 'AVAILABLE' && isCanonicalAvailableHypothesisContext(record.context);
}
function isCanonicalEmptyHypothesisResult(value: unknown): value is Extract<HypothesisReasoningContextResult, { coverageState: 'EMPTY' }> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.coverageState === 'EMPTY' && record.candidateHypothesisCount === 0;
}
function classifyHypothesisResult(value: unknown): HypothesisForegroundOutcome {
  if (isCanonicalAvailableHypothesisResult(value)) return { state: 'AVAILABLE', value };
  if (isCanonicalEmptyHypothesisResult(value)) return { state: 'LEGITIMATE_EMPTY', value };
  throw new BoundedForegroundIntelligenceMalformedResultError();
}

/**
 * QIR-003 Bounded Foreground Intelligence Gatherer v1.
 *
 * The narrow production abstraction that owns Memory + Hypothesis FOREGROUND
 * acquisition and their typed outcomes for one provider-generating turn. It is
 * NOT a whole-brain runtime planner, not a context budget manager (QIR-004),
 * not a background scheduler (QIR-005), not a Question engine (QIR-006), and
 * not a provider router: it launches exactly the two existing reads, bounds
 * them under ONE shared absolute deadline, and reports typed outcomes.
 *
 * Topology: `gather` is fully synchronous up to its returned promise - it
 * launches BOTH source reads before anything is awaited, so Memory never waits
 * behind Hypothesis, Hypothesis never waits behind Memory, and neither waits
 * behind the frozen Human Intelligence lane the Conversation Orchestrator
 * launches in the same post-Safety stage. The body contains no `await` at all:
 * the join is one Promise.all over the two bounded outcomes, and the whole
 * gather settles at the slower of the two sources, never at their sum, and
 * never later than the one shared 5000 ms ceiling.
 *
 * Late settlement: when the shared deadline expires first, the source's
 * outcome is FOREGROUND_BUDGET_EXPIRY and the still-running read keeps its
 * handlers attached - a late fulfillment is discarded for this turn and a late
 * rejection settles into the already-settled race as a no-op, so it can never
 * become an unhandled rejection, never mutates the provider request, never
 * triggers a second provider call, is never cached into another turn, and
 * never triggers a backup read. No transport cancellation, no fan-out, and no
 * broad cancellation architecture is introduced.
 *
 * Failure: hard authority/integrity/malformed/unexpected failures reject the
 * gather with the ORIGINAL error (fail closed); only the exact approved
 * availability failures degrade, per the classifier above.
 *
 * Telemetry is bounded and fail-soft: exactly one
 * `qandeel.foreground.intelligence.source` outcome per source per gather,
 * emitted when that source's outcome is determined, over finite dimensions
 * only. The pre-existing `memory_retrieval` and `hypothesis_context` engine
 * spans are preserved unchanged, as is the hypothesis-context outcome metric's
 * rejected/failed classification on a hard Hypothesis failure. Telemetry can
 * never alter an outcome.
 */
@Injectable()
export class BoundedForegroundIntelligenceGathererService {
  constructor(
    private readonly memoryRetriever: MemoryRetrieverService,
    private readonly hypothesisReasoningContext: HypothesisReasoningContextService,
    private readonly correlation: CorrelationService,
    private readonly telemetry: TelemetryService,
  ) {}

  gather(input: BoundedForegroundIntelligenceGatherInput): Promise<BoundedForegroundIntelligenceGatherResult> {
    // Both source reads are LAUNCHED HERE, synchronously and exactly once per
    // gather - Memory and Hypothesis are independent of each other and of
    // Human Intelligence, so neither is ever a serial stage after the other.
    const memoryRead = this.engine('memory_retrieval', input.path, () =>
      this.memoryRetriever.retrieve(input.userId, input.accessToken, input.content));
    const hypothesisRead = this.engine('hypothesis_context', input.path, () =>
      this.hypothesisReasoningContext.build(input.userId, input.accessToken));
    // The ONE shared absolute deadline, started at launch. Both sources race
    // against this same promise: one timer, one window, no per-source
    // deadline, and no fresh window after either source settles.
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const sharedDeadline = new Promise<void>((resolve) => {
      deadlineTimer = setTimeout(resolve, QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS);
    });
    const memoryOutcome = this.boundedSourceOutcome<MemoryForegroundOutcome>(
      'MEMORY', input.path, sharedDeadline, FOREGROUND_BUDGET_EXPIRY_OUTCOME,
      memoryRead.then((value) => classifyMemoryResult(value), (error) => classifyForegroundSourceFailure(error)));
    const hypothesisOutcome = this.boundedSourceOutcome<HypothesisForegroundOutcome>(
      'HYPOTHESIS', input.path, sharedDeadline, FOREGROUND_BUDGET_EXPIRY_OUTCOME,
      hypothesisRead.then((value) => classifyHypothesisResult(value), (error) => classifyForegroundSourceFailure(error)),
      (error) => this.telemetry.recordHypothesisContext(error instanceof HypothesisReasoningInvariantError ? 'rejected' : 'failed', input.path));
    // The timer is cleared as soon as both outcomes are determined (fulfilled
    // or hard-failed), so a fast gather leaks no timer; allSettled attaches
    // handlers to both outcomes, so a hard failure of one source can never
    // strand the other as an unhandled rejection.
    void Promise.allSettled([memoryOutcome, hypothesisOutcome]).then(() => clearTimeout(deadlineTimer));
    return Promise.all([memoryOutcome, hypothesisOutcome]).then(([memory, hypothesis]) => ({ memory, hypothesis }));
  }

  // One bounded outcome per source: the classified settlement races the shared
  // deadline, the outcome metric is emitted exactly once at determination time
  // (a post-deadline settlement therefore emits nothing and is discarded), and
  // a hard failure records HARD_FAILURE and rethrows the ORIGINAL error.
  private boundedSourceOutcome<TOutcome extends { readonly state: string }>(
    source: 'MEMORY' | 'HYPOTHESIS',
    path: ProcessingPath,
    sharedDeadline: Promise<void>,
    expired: TOutcome,
    classified: Promise<TOutcome>,
    onHardFailure?: (error: unknown) => void,
  ): Promise<TOutcome> {
    return Promise.race([classified, sharedDeadline.then(() => expired)]).then(
      (outcome) => { this.recordSourceOutcome(source, outcome.state, path); return outcome; },
      (error) => {
        try { this.recordSourceOutcome(source, 'HARD_FAILURE', path); onHardFailure?.(error); } catch { /* fail-soft */ }
        throw error;
      },
    );
  }

  // Bounded fail-soft source-outcome telemetry. Finite dimensions only; a
  // throwing telemetry double can never alter a gather outcome.
  private recordSourceOutcome(source: 'MEMORY' | 'HYPOTHESIS', outcome: string, path: ProcessingPath): void {
    try { this.telemetry.recordForegroundIntelligenceSource(source, outcome, path); } catch { /* fail-soft */ }
  }

  // The same engine-span idiom the Conversation Orchestrator uses, so the
  // pre-existing memory_retrieval and hypothesis_context engine telemetry is
  // preserved unchanged under the same correlation scope.
  private engine<T>(name: string, path: ProcessingPath, work: () => Promise<T> | T): Promise<T> {
    return this.correlation.current() ? this.telemetry.withEngine(name, path, work) : Promise.resolve().then(work);
  }
}
