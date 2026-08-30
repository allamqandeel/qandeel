import type {
  ModelRouterContextMessage,
  ModelRouterMemoryContext,
  ModelRouterRequest,
  ProcessingPath,
} from '../model-router/model-router.types';
import type { HumanIntelligenceProviderSemantics } from '../model-router/human-intelligence-provider-semantics.types';
import type { HypothesisReasoningContext } from '../hypothesis/hypothesis-reasoning-context.types';
import type { RecommendationGroundingContext } from '../recommendation/recommendation-grounding.types';

// QIR-004 Integrated Context Budget & Conflict Resolution v1.
//
// The ONE QANDEEL-owned, provider-neutral structural ceiling on normalized
// model-input TEXT for a provider-generating turn.
//
// It is NOT a provider context-window claim, NOT an OpenAI/Anthropic/Gemini/
// Kimi tokenizer limit, NOT a token budget, NOT an output-token budget, NOT a
// Provider SLA, NOT a final provider-selection decision, and NOT a claim that
// the serialized API wire body is itself <= 131072 bytes. Provider capability /
// token-window fit remains a separate future layer after provider evaluation
// and selection, which stays explicitly deferred.
//
// The unit is UTF-8 bytes of text-bearing model input BEFORE adapter
// serialization, measured exactly as
//
//   UTF8(composeServerGuidance(request)) + SUM(UTF8(request.context[i].content))
//
// with UTF8(x) = Buffer.byteLength(x, 'utf8'). JavaScript `.length` (UTF-16 code
// units) is never the budget unit: one Arabic letter is 2 bytes and most emoji
// are 4 bytes, and both must be charged for what they actually cost.
export const GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES = 131072;

// The exact v1 partition. These are RESOURCE ISOLATION boundaries, never a
// truth ranking and never a shared first-come pool:
//
//   64 + 16 + 8 + 8 + 24 + 8 = 128 KiB
//
// There is NO borrowing in v1. History cannot borrow unused Memory bytes,
// Memory cannot borrow unused History bytes, Human Intelligence cannot borrow
// unused Hypothesis bytes, the Hypothesis/Recommendation package cannot borrow
// unused Mandatory Core space, no optional source may borrow the future
// reserve, and an ABSENT source donates its slice to nobody. This is what stops
// raw source SIZE from silently becoming source AUTHORITY.
export const MANDATORY_CORE_BUDGET_BYTES = 65536;
export const HISTORY_BUDGET_BYTES = 16384;
export const MEMORY_BUDGET_BYTES = 8192;
export const HUMAN_INTELLIGENCE_BUDGET_BYTES = 8192;
export const HYPOTHESIS_RECOMMENDATION_BUDGET_BYTES = 24576;

// Deliberately UNUSABLE in QIR-004 v1. v1 allocates only 56 KiB of the 64 KiB
// optional half, so a normally assembled request cannot intentionally consume
// more than 120 KiB. The 128 KiB ceiling stays the hard whole-request
// invariant, and this reserve may be assigned only by a separately reviewed,
// versioned contract - it is not frozen as permanently unusable beyond v1.
export const FUTURE_RESERVED_BUDGET_BYTES = 8192;

export const INTEGRATED_CONTEXT_BUDGET_POLICY_VERSION = '1';

// The finite QIR-004 telemetry vocabularies. Numeric byte values are metric
// VALUES, never labels.
export type IntegratedContextBudgetSource =
  | 'HISTORY'
  | 'MEMORY'
  | 'HUMAN_INTELLIGENCE'
  | 'HYPOTHESIS_RECOMMENDATION';

// NOT_PRESENT is presence bookkeeping ONLY. QIR-004 never reinterprets it as
// "legitimately empty", "unavailable", or "expired": those distinctions belong
// to QIR-003's typed source outcomes and stay separately observable through
// QIR-003 telemetry.
//
// PARTIALLY_RETAINED is valid only for HISTORY and MEMORY in v1: Human
// Intelligence and the Hypothesis/Recommendation package are ATOMIC.
export type IntegratedContextBudgetOutcome =
  | 'NOT_PRESENT'
  | 'INCLUDED_FULL'
  | 'PARTIALLY_RETAINED'
  | 'OMITTED_BUDGET';

export type IntegratedContextBudgetComponent =
  | 'MANDATORY_CORE'
  | 'HISTORY'
  | 'MEMORY'
  | 'HUMAN_INTELLIGENCE'
  | 'HYPOTHESIS_RECOMMENDATION'
  | 'FINAL_TOTAL';

export type IntegratedContextBudgetMeasurement = 'OFFERED' | 'RETAINED' | 'FINAL';

/**
 * The ONE sanitized QIR-004 structural/integrity failure identity.
 *
 * It carries NO user content, NO Memory content, NO Hypothesis text, NO
 * Recommendation data, NO Human Intelligence values, NO identifier, and NO byte
 * count: the message is a fixed code. It is raised for malformed canonical
 * conversation shape, a missing or mismatched current user turn, Mandatory Core
 * over budget, Recommendation present without its owning Hypothesis, impossible
 * or non-additive byte accounting, and a final normalized input that still
 * exceeds the global ceiling after compliant source allocation.
 *
 * It always fails the turn CLOSED before provider generation through the
 * existing Conversation Orchestrator outer failure path. It is never repaired
 * by trimming Mandatory Core and never softened into a degraded turn.
 */
export class IntegratedContextBudgetInvariantError extends Error {
  constructor() {
    super('INTEGRATED_CONTEXT_BUDGET_INVARIANT');
    this.name = 'IntegratedContextBudgetInvariantError';
  }
}

/**
 * The QIR-004 assembly input.
 *
 * It carries the canonical conversation messages produced by
 * `ContextBuilderService.build(...)`, the canonical current user content the
 * Orchestrator holds independently, and the already-decided execution semantics
 * QIR-004 only carries through: task, FAST/DEEP path, complexity mapping,
 * provider latency budget, cost budget, safety level, locale, and modality.
 * QIR-004 owns none of those decisions.
 */
export interface IntegratedContextAssemblyInput {
  readonly task: 'CONVERSATIONAL_RESPONSE';
  readonly path: ProcessingPath;
  readonly complexity: 'LOW' | 'HIGH';
  readonly behavioralGuidance: string;
  readonly safetyGuidance?: string;
  readonly messages: ReadonlyArray<ModelRouterContextMessage>;
  readonly currentUserContent: string;
  readonly memoryContext?: ReadonlyArray<ModelRouterMemoryContext>;
  readonly humanIntelligence?: HumanIntelligenceProviderSemantics;
  readonly hypothesisContext?: HypothesisReasoningContext;
  readonly recommendationContext?: RecommendationGroundingContext;
  readonly locale: 'ar' | 'en' | 'und';
  readonly modality: 'TEXT';
  readonly latencyBudgetMs: number;
  readonly costBudget: 'LOW';
  readonly safetyLevel: 'STANDARD';
}

/** Per-source budget decision. Presence/coverage only - never authority. */
export interface IntegratedContextSourceDecision {
  readonly source: IntegratedContextBudgetSource;
  readonly outcome: IntegratedContextBudgetOutcome;
  readonly offeredBytes: number;
  readonly retainedBytes: number;
}

/**
 * The QIR-004 assembly result: the ONE normalized provider request plus the
 * bounded structural accounting that proves it. The accounting is per-turn
 * ephemeral - it is never persisted, and QIR-004 adds no database migration.
 */
export interface IntegratedContextAssemblyResult {
  readonly request: ModelRouterRequest;
  readonly mandatoryCoreBytes: number;
  readonly finalTextBytes: number;
  readonly decisions: ReadonlyArray<IntegratedContextSourceDecision>;
}
