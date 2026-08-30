import type { ModelRouterMemoryContext, ProcessingPath } from '../model-router/model-router.types';
import type { HypothesisReasoningContextResult } from '../hypothesis/hypothesis-reasoning-context.types';

// QIR-003: the ONE shared absolute foreground ceiling for the non-Human-
// Intelligence foreground sources (Memory retrieval + Hypothesis reasoning).
//
// The deadline starts ONCE, at gather launch, and both sources share it. There
// is no per-source deadline, no second window after either source settles, and
// no additive 5s + 5s wait: the maximum QIR-003 non-HI foreground hold after
// launch is one 5000 ms ceiling.
//
// 5000 ms is a structural safety ceiling derived from the canonical
// authenticated Data API transport boundary (its shared AbortSignal timeout is
// 5000 ms per request, and a multi-stage Hypothesis read can span more than one
// transport window). It is NOT the QHIA 300 ms Human Intelligence budget, NOT
// a whole-turn budget, NOT a Provider SLA, and NOT a final product latency
// target. It never applies to any Human Intelligence read.
export const QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS = 5000;

// Typed foreground outcomes. The four states are semantically distinct and
// must never be collapsed into each other:
//
//   AVAILABLE                     - the source answered with real content.
//   LEGITIMATE_EMPTY              - the source answered authoritatively that
//                                   there is nothing (deterministic cue-gate
//                                   no-retrieval, a successful zero-memory
//                                   selection, or canonical EMPTY Hypothesis
//                                   coverage).
//   OPTIONAL_AVAILABILITY_FAILURE - an APPROVED transport availability failure;
//                                   the source could not answer, which is
//                                   OMISSION, never an empty assertion.
//   FOREGROUND_BUDGET_EXPIRY      - the shared deadline passed before the
//                                   source settled; also OMISSION.
//
// Hard authority/integrity/malformed/unexpected failures have NO outcome state:
// they fail the gather closed (the gather promise rejects with the original
// error) and the turn fails before any provider generation.
export type MemoryForegroundOutcome =
  | { readonly state: 'AVAILABLE'; readonly value: ReadonlyArray<ModelRouterMemoryContext> }
  | { readonly state: 'LEGITIMATE_EMPTY' }
  | { readonly state: 'OPTIONAL_AVAILABILITY_FAILURE' }
  | { readonly state: 'FOREGROUND_BUDGET_EXPIRY' };

export type HypothesisForegroundOutcome =
  | { readonly state: 'AVAILABLE'; readonly value: Extract<HypothesisReasoningContextResult, { coverageState: 'AVAILABLE' }> }
  | { readonly state: 'LEGITIMATE_EMPTY'; readonly value: Extract<HypothesisReasoningContextResult, { coverageState: 'EMPTY' }> }
  | { readonly state: 'OPTIONAL_AVAILABILITY_FAILURE' }
  | { readonly state: 'FOREGROUND_BUDGET_EXPIRY' };

export interface BoundedForegroundIntelligenceGatherInput {
  readonly userId: string;
  readonly accessToken: string;
  readonly content: string;
  readonly path: ProcessingPath;
}

export interface BoundedForegroundIntelligenceGatherResult {
  readonly memory: MemoryForegroundOutcome;
  readonly hypothesis: HypothesisForegroundOutcome;
}
