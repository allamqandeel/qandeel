import { Injectable } from '@nestjs/common';
import {
  composeServerGuidance,
  type ModelRouterContextMessage,
  type ModelRouterMemoryContext,
  type ModelRouterRequest,
  type ProcessingPath,
} from '../model-router/model-router.types';
import type { HumanIntelligenceProviderSemantics } from '../model-router/human-intelligence-provider-semantics.types';
import type { HypothesisReasoningContext } from '../hypothesis/hypothesis-reasoning-context.types';
import type { RecommendationGroundingContext } from '../recommendation/recommendation-grounding.types';
import { TelemetryService } from '../observability/telemetry.service';
import {
  GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES,
  HISTORY_BUDGET_BYTES,
  HUMAN_INTELLIGENCE_BUDGET_BYTES,
  HYPOTHESIS_RECOMMENDATION_BUDGET_BYTES,
  IntegratedContextBudgetInvariantError,
  MANDATORY_CORE_BUDGET_BYTES,
  MEMORY_BUDGET_BYTES,
  type IntegratedContextAssemblyInput,
  type IntegratedContextAssemblyResult,
  type IntegratedContextBudgetOutcome,
  type IntegratedContextSourceDecision,
} from './integrated-context-budget-contract';

// The ONE measurement unit. UTF-8 BYTES, never JavaScript `.length` UTF-16 code
// units: an Arabic letter costs 2 bytes, a non-BMP emoji costs 4 bytes and 2
// code units, and both must be charged for what they actually cost.
function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

// The guidance-bearing projection of a request. `composeServerGuidance` renders
// the Mandatory Core baseline first and then appends one independent block per
// optional source, so the rendering is exactly ADDITIVE and every optional
// source can be measured by its own incremental contribution.
type GuidanceProjection = Pick<
  ModelRouterRequest,
  'behavioralGuidance' | 'safetyGuidance' | 'memoryContext' | 'humanIntelligence' | 'hypothesisContext' | 'recommendationContext'
>;

// Every byte count QIR-004 computes must be a non-negative safe integer.
// Anything else is impossible accounting and fails the turn closed rather than
// silently degrading a budget decision.
function provenByteCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new IntegratedContextBudgetInvariantError();
  return value;
}

/**
 * The canonical conversation-shape boundary, proven POSITIVELY over runtime
 * `unknown` values before any budgeting happens. TypeScript erasure is never
 * trusted here: the Orchestrator's canonical current user content and
 * `ContextBuilderService.build(...)`'s message list must agree structurally, or
 * the turn fails closed before provider generation.
 *
 * Any mismatch - an empty list, a non-object message, an unknown role, a
 * non-string content, a final message that is not USER, a final content that is
 * not exactly the canonical current user content, an odd historical prefix, or
 * a historical prefix that is not ordered complete USER/ASSISTANT pairs - is a
 * QIR-004 hard invariant failure. None of them is repaired, reordered, padded,
 * or dropped.
 */
function validateCanonicalConversation(
  messages: unknown,
  currentUserContent: unknown,
): ReadonlyArray<ModelRouterContextMessage> {
  if (typeof currentUserContent !== 'string') throw new IntegratedContextBudgetInvariantError();
  if (!Array.isArray(messages) || messages.length === 0) throw new IntegratedContextBudgetInvariantError();
  for (const message of messages) {
    if (message === null || typeof message !== 'object' || Array.isArray(message)) throw new IntegratedContextBudgetInvariantError();
    const record = message as Record<string, unknown>;
    if (record.role !== 'USER' && record.role !== 'ASSISTANT') throw new IntegratedContextBudgetInvariantError();
    if (typeof record.content !== 'string') throw new IntegratedContextBudgetInvariantError();
  }
  const canonical = messages as ReadonlyArray<ModelRouterContextMessage>;
  const currentUserMessage = canonical[canonical.length - 1];
  if (currentUserMessage.role !== 'USER') throw new IntegratedContextBudgetInvariantError();
  if (currentUserMessage.content !== currentUserContent) throw new IntegratedContextBudgetInvariantError();
  const historicalPrefix = canonical.slice(0, -1);
  if (historicalPrefix.length % 2 !== 0) throw new IntegratedContextBudgetInvariantError();
  for (let index = 0; index < historicalPrefix.length; index += 2) {
    if (historicalPrefix[index].role !== 'USER') throw new IntegratedContextBudgetInvariantError();
    if (historicalPrefix[index + 1].role !== 'ASSISTANT') throw new IntegratedContextBudgetInvariantError();
  }
  return canonical;
}

interface RetentionDecision<TRetained> {
  readonly outcome: IntegratedContextBudgetOutcome;
  readonly retained: TRetained | undefined;
  readonly offeredBytes: number;
  readonly retainedBytes: number;
}

/**
 * History: the newest CONTIGUOUS COMPLETE exchanges that fit 16 KiB of
 * canonical historical message `content` bytes.
 *
 * Whole USER/ASSISTANT pairs are accumulated backwards from the newest, and the
 * walk STOPS at the first older pair that would exceed the slice. It never
 * retains half an exchange, never truncates a message, never reorders history,
 * never summarizes it, never calls a provider to compress it, and never skips
 * an oversized newer exchange in order to fit an older smaller one. If the
 * newest historical exchange alone does not fit, zero history is retained and
 * the turn carries the current user turn only.
 *
 * The current user turn is NOT part of this slice: it belongs to Mandatory Core.
 */
function retainNewestCompleteExchanges(
  historicalPrefix: ReadonlyArray<ModelRouterContextMessage>,
): RetentionDecision<ReadonlyArray<ModelRouterContextMessage>> {
  const pairs: Array<{ messages: ReadonlyArray<ModelRouterContextMessage>; bytes: number }> = [];
  for (let index = 0; index < historicalPrefix.length; index += 2) {
    const userMessage = historicalPrefix[index];
    const assistantMessage = historicalPrefix[index + 1];
    pairs.push({
      messages: [userMessage, assistantMessage],
      bytes: provenByteCount(utf8Bytes(userMessage.content) + utf8Bytes(assistantMessage.content)),
    });
  }
  const offeredBytes = provenByteCount(pairs.reduce((total, pair) => total + pair.bytes, 0));
  if (pairs.length === 0) return { outcome: 'NOT_PRESENT', retained: [], offeredBytes: 0, retainedBytes: 0 };
  let retainedBytes = 0;
  let oldestRetainedIndex = pairs.length;
  for (let index = pairs.length - 1; index >= 0; index -= 1) {
    const candidateBytes = retainedBytes + pairs[index].bytes;
    if (candidateBytes > HISTORY_BUDGET_BYTES) break;
    retainedBytes = candidateBytes;
    oldestRetainedIndex = index;
  }
  const retained = pairs.slice(oldestRetainedIndex).flatMap((pair) => [...pair.messages]);
  const outcome: IntegratedContextBudgetOutcome = oldestRetainedIndex === 0
    ? 'INCLUDED_FULL'
    : oldestRetainedIndex === pairs.length ? 'OMITTED_BUDGET' : 'PARTIALLY_RETAINED';
  return { outcome, retained, offeredBytes, retainedBytes: provenByteCount(retainedBytes) };
}

/**
 * QIR-004 Integrated Context Budget & Conflict Resolution v1.
 *
 * The ONE server-owned, provider-neutral final normalized `ModelRouterRequest`
 * assembly boundary between QIR-003 gathered foreground intelligence plus
 * deterministic Recommendation grounding and `ModelRouter.generate(...)`.
 *
 * It owns exactly five things: structural validation of the final conversation
 * boundary, deterministic per-source structural budgeting, global normalized
 * UTF-8 text-byte accounting, final normalized request assembly, and bounded
 * fail-soft budget telemetry.
 *
 * It owns NONE of: retrieval, Safety classification, FAST/DEEP routing, Human
 * Intelligence generation, Hypothesis selection, Recommendation derivation,
 * Question selection, provider/model selection, background scheduling, or
 * provider tokenization. It is NOT a whole-brain runtime planner.
 *
 * Conflict resolution has exactly two layers and no third. The STRUCTURAL layer
 * is enforced here: Mandatory Core and the current user turn are never crowded
 * out, source slices are isolated with no borrowing, an omitted source changes
 * presence only and never surviving authority, and Recommendation can never
 * survive a budget omission of its owning Hypothesis. The SEMANTIC layer -
 * arbitrary natural-language factual contradiction - is reasoned about by the
 * ONE conversational provider under the always-present server authority
 * charter. QANDEEL adds no contradiction detector, no keyword heuristic, no
 * embedding classifier, no source vote, no agreement amplification, and no
 * second LLM or provider reconciliation call.
 *
 * The whole assembly is pure synchronous CPU work: no await, no timer, no
 * Promise, no network, no database, no provider call, and nothing persisted.
 */
@Injectable()
export class IntegratedContextBudgetAssemblerService {
  constructor(private readonly telemetry: TelemetryService) {}

  assemble(input: IntegratedContextAssemblyInput): IntegratedContextAssemblyResult {
    const canonicalMessages = validateCanonicalConversation(input.messages, input.currentUserContent);
    const currentUserMessage = canonicalMessages[canonicalMessages.length - 1];

    // MANDATORY CORE: hard Behavioral Guidance, Safety Guidance when present,
    // the always-present integration authority charter, and the canonical
    // CURRENT USER turn. It is measured BEFORE any optional allocation and is
    // never truncated, summarized, shortened, dropped, or rewritten to make
    // room for optional intelligence. Over budget is contract drift, so the
    // turn fails CLOSED here - before provider generation - rather than
    // silently degrading hard authority.
    const guidanceBase: GuidanceProjection = {
      behavioralGuidance: input.behavioralGuidance,
      ...(input.safetyGuidance !== undefined ? { safetyGuidance: input.safetyGuidance } : {}),
    };
    const baseGuidanceBytes = provenByteCount(utf8Bytes(composeServerGuidance(guidanceBase)));
    const currentUserBytes = provenByteCount(utf8Bytes(currentUserMessage.content));
    const mandatoryCoreBytes = provenByteCount(baseGuidanceBytes + currentUserBytes);
    if (mandatoryCoreBytes > MANDATORY_CORE_BUDGET_BYTES) throw new IntegratedContextBudgetInvariantError();

    // ISOLATED OPTIONAL SLICES. Each source is measured against its OWN
    // constant and nothing else: no source ever consults another source's
    // remaining room, unused Mandatory Core capacity never enlarges an optional
    // slice, an absent source donates its slice to nobody, and no optional
    // source may reach the future reserve.
    const history = retainNewestCompleteExchanges(canonicalMessages.slice(0, -1));
    const memory = this.retainLongestRankedMemoryPrefix(guidanceBase, baseGuidanceBytes, input.memoryContext);
    const humanIntelligence = this.retainAtomicHumanIntelligence(guidanceBase, baseGuidanceBytes, input.humanIntelligence);
    const hypothesisRecommendation = this.retainAtomicHypothesisRecommendationPackage(
      guidanceBase, baseGuidanceBytes, input.hypothesisContext, input.recommendationContext,
    );

    // The ONE normalized provider request. Execution semantics decided
    // elsewhere - task, FAST/DEEP path, complexity mapping, provider latency
    // budget, LOW cost budget, STANDARD safety level, locale and modality - are
    // carried through unchanged; QIR-004 owns none of them.
    const request: ModelRouterRequest = {
      task: input.task,
      path: input.path,
      complexity: input.complexity,
      behavioralGuidance: input.behavioralGuidance,
      ...(input.safetyGuidance !== undefined ? { safetyGuidance: input.safetyGuidance } : {}),
      // The current user turn is retained EXACTLY, by identity, and stays last.
      context: [...(history.retained ?? []), currentUserMessage],
      ...(memory.retained ? { memoryContext: memory.retained } : {}),
      ...(humanIntelligence.retained ? { humanIntelligence: humanIntelligence.retained } : {}),
      ...(hypothesisRecommendation.retained?.hypothesisContext
        ? { hypothesisContext: hypothesisRecommendation.retained.hypothesisContext } : {}),
      ...(hypothesisRecommendation.retained?.recommendationContext
        ? { recommendationContext: hypothesisRecommendation.retained.recommendationContext } : {}),
      locale: input.locale,
      modality: input.modality,
      latencyBudgetMs: input.latencyBudgetMs,
      costBudget: input.costBudget,
      safetyLevel: input.safetyLevel,
    };

    // EXACT GLOBAL ACCOUNTING, measured on the real final request through the
    // canonical renderer - never on a model of it.
    const finalTextBytes = provenByteCount(
      utf8Bytes(composeServerGuidance(request))
      + request.context.reduce((total, message) => total + utf8Bytes(message.content), 0),
    );
    if (history.retainedBytes > HISTORY_BUDGET_BYTES) throw new IntegratedContextBudgetInvariantError();
    if (memory.retainedBytes > MEMORY_BUDGET_BYTES) throw new IntegratedContextBudgetInvariantError();
    if (humanIntelligence.retainedBytes > HUMAN_INTELLIGENCE_BUDGET_BYTES) throw new IntegratedContextBudgetInvariantError();
    if (hypothesisRecommendation.retainedBytes > HYPOTHESIS_RECOMMENDATION_BUDGET_BYTES) throw new IntegratedContextBudgetInvariantError();
    // The ACCOUNTING IDENTITY. Per-source contribution accounting must
    // reconcile EXACTLY to the final normalized rendered request. If guidance
    // rendering ever becomes cross-source or non-additive, this guard fails and
    // forces an explicit QIR contract review instead of silently drifting.
    const accountedBytes = mandatoryCoreBytes
      + history.retainedBytes + memory.retainedBytes
      + humanIntelligence.retainedBytes + hypothesisRecommendation.retainedBytes;
    if (finalTextBytes !== accountedBytes) throw new IntegratedContextBudgetInvariantError();
    // An impossible final overflow is NEVER repaired by trimming Mandatory Core
    // and never triggers a second assembly pass: it fails the turn closed.
    if (finalTextBytes > GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES) throw new IntegratedContextBudgetInvariantError();

    const decisions: ReadonlyArray<IntegratedContextSourceDecision> = [
      { source: 'HISTORY', outcome: history.outcome, offeredBytes: history.offeredBytes, retainedBytes: history.retainedBytes },
      { source: 'MEMORY', outcome: memory.outcome, offeredBytes: memory.offeredBytes, retainedBytes: memory.retainedBytes },
      { source: 'HUMAN_INTELLIGENCE', outcome: humanIntelligence.outcome, offeredBytes: humanIntelligence.offeredBytes, retainedBytes: humanIntelligence.retainedBytes },
      { source: 'HYPOTHESIS_RECOMMENDATION', outcome: hypothesisRecommendation.outcome, offeredBytes: hypothesisRecommendation.offeredBytes, retainedBytes: hypothesisRecommendation.retainedBytes },
    ];
    this.recordBudgetTelemetry(input.path, mandatoryCoreBytes, finalTextBytes, decisions);
    return { request, mandatoryCoreBytes, finalTextBytes, decisions };
  }

  /**
   * Memory: the longest highest-ranked PREFIX whose ACTUAL rendered
   * provider-guidance contribution fits 8 KiB.
   *
   * The measurement is the real incremental rendered contribution - Memory
   * preamble, structured-data delimiters, JSON serialization and the canonical
   * `<`, `>`, `&` escaping included - never raw `content.length`.
   *
   * Memory arrives already ranked and ordered by the Memory Runtime. QIR-004
   * never reranks it, never reorders it, never splits an item, and never
   * rewrites item content. At the first next item that would exceed the slice
   * it STOPS: that item is never skipped in order to admit a lower-ranked later
   * one.
   */
  private retainLongestRankedMemoryPrefix(
    guidanceBase: GuidanceProjection,
    baseGuidanceBytes: number,
    memoryContext: ReadonlyArray<ModelRouterMemoryContext> | undefined,
  ): RetentionDecision<ReadonlyArray<ModelRouterMemoryContext>> {
    if (!memoryContext || memoryContext.length === 0) return { outcome: 'NOT_PRESENT', retained: undefined, offeredBytes: 0, retainedBytes: 0 };
    const offeredBytes = this.contributionBytes(guidanceBase, baseGuidanceBytes, { memoryContext });
    if (offeredBytes <= MEMORY_BUDGET_BYTES) return { outcome: 'INCLUDED_FULL', retained: memoryContext, offeredBytes, retainedBytes: offeredBytes };
    let retainedCount = 0;
    let retainedBytes = 0;
    for (let count = 1; count < memoryContext.length; count += 1) {
      const candidateBytes = this.contributionBytes(guidanceBase, baseGuidanceBytes, { memoryContext: memoryContext.slice(0, count) });
      if (candidateBytes > MEMORY_BUDGET_BYTES) break;
      retainedCount = count;
      retainedBytes = candidateBytes;
    }
    if (retainedCount === 0) return { outcome: 'OMITTED_BUDGET', retained: undefined, offeredBytes, retainedBytes: 0 };
    return { outcome: 'PARTIALLY_RETAINED', retained: memoryContext.slice(0, retainedCount), offeredBytes, retainedBytes };
  }

  /**
   * Human Intelligence is ATOMIC in QIR-004 v1: its full actual incremental
   * rendered contribution either fits 8 KiB and the whole envelope is included,
   * or the ENTIRE provider field is omitted for this turn.
   *
   * No behavioral instruction, session reasoning metric, Brain Context signal,
   * or frozen QHIA authority sentence is ever partially removed, and no
   * QIR-004-specific QHIA truncation algorithm exists. Omission never mutates
   * the original envelope. The canonical all-active QHIA-013 fixture fits: its
   * frozen incremental footprint is 6427 UTF-8 bytes.
   */
  private retainAtomicHumanIntelligence(
    guidanceBase: GuidanceProjection,
    baseGuidanceBytes: number,
    humanIntelligence: HumanIntelligenceProviderSemantics | undefined,
  ): RetentionDecision<HumanIntelligenceProviderSemantics> {
    if (!humanIntelligence) return { outcome: 'NOT_PRESENT', retained: undefined, offeredBytes: 0, retainedBytes: 0 };
    const offeredBytes = this.contributionBytes(guidanceBase, baseGuidanceBytes, { humanIntelligence });
    if (offeredBytes > HUMAN_INTELLIGENCE_BUDGET_BYTES) return { outcome: 'OMITTED_BUDGET', retained: undefined, offeredBytes, retainedBytes: 0 };
    return { outcome: 'INCLUDED_FULL', retained: humanIntelligence, offeredBytes, retainedBytes: offeredBytes };
  }

  /**
   * Hypothesis and Recommendation share ONE 24 KiB package slice, and the
   * package is ATOMIC in v1. This is a BUDGET package, never a merger of
   * semantic ownership.
   *
   * Recommendation is deterministically derived from Hypothesis, so a
   * Recommendation context must never survive a budget decision that omitted
   * the Hypothesis context it depends on: an oversized package omits BOTH.
   * Recommendation present while Hypothesis is absent is a hard ownership
   * invariant failure. Hypothesis WITHOUT Recommendation stays legal and
   * forward-safe; QIR-004 never derives Recommendation itself.
   *
   * Nothing inside the package is mutated: not the hypotheses list, not
   * includedHypothesisCount, not candidateHypothesisCount, not truncated, not
   * assumptions or disconfirming conditions, not Confidence semantics, and not
   * any Recommendation field. No LLM ever summarizes the package.
   */
  private retainAtomicHypothesisRecommendationPackage(
    guidanceBase: GuidanceProjection,
    baseGuidanceBytes: number,
    hypothesisContext: HypothesisReasoningContext | undefined,
    recommendationContext: RecommendationGroundingContext | undefined,
  ): RetentionDecision<{ hypothesisContext?: HypothesisReasoningContext; recommendationContext?: RecommendationGroundingContext }> {
    if (recommendationContext && !hypothesisContext) throw new IntegratedContextBudgetInvariantError();
    if (!hypothesisContext && !recommendationContext) return { outcome: 'NOT_PRESENT', retained: undefined, offeredBytes: 0, retainedBytes: 0 };
    const offered: GuidanceProjection = {
      ...guidanceBase,
      ...(hypothesisContext ? { hypothesisContext } : {}),
      ...(recommendationContext ? { recommendationContext } : {}),
    };
    const offeredBytes = provenByteCount(utf8Bytes(composeServerGuidance(offered)) - baseGuidanceBytes);
    if (offeredBytes > HYPOTHESIS_RECOMMENDATION_BUDGET_BYTES) return { outcome: 'OMITTED_BUDGET', retained: undefined, offeredBytes, retainedBytes: 0 };
    return {
      outcome: 'INCLUDED_FULL',
      retained: {
        ...(hypothesisContext ? { hypothesisContext } : {}),
        ...(recommendationContext ? { recommendationContext } : {}),
      },
      offeredBytes,
      retainedBytes: offeredBytes,
    };
  }

  // The ONE incremental contribution measurement: what this source ACTUALLY
  // adds to the canonical rendered provider guidance, in UTF-8 bytes.
  private contributionBytes(guidanceBase: GuidanceProjection, baseGuidanceBytes: number, source: Partial<GuidanceProjection>): number {
    return provenByteCount(utf8Bytes(composeServerGuidance({ ...guidanceBase, ...source })) - baseGuidanceBytes);
  }

  // Bounded, fail-soft QIR-004 telemetry over finite label registries. Numeric
  // byte counts are metric VALUES, never labels. No content, identifier,
  // exception text, provider/model identity, raw source data or free-text label
  // can ever be emitted, and a throwing telemetry double can never alter the
  // assembly or the turn.
  private recordBudgetTelemetry(
    path: ProcessingPath,
    mandatoryCoreBytes: number,
    finalTextBytes: number,
    decisions: ReadonlyArray<IntegratedContextSourceDecision>,
  ): void {
    try {
      this.telemetry.recordContextBudgetBytes('MANDATORY_CORE', 'RETAINED', path, mandatoryCoreBytes);
      for (const decision of decisions) {
        this.telemetry.recordContextBudgetSourceDecision(decision.source, decision.outcome, path);
        this.telemetry.recordContextBudgetBytes(decision.source, 'OFFERED', path, decision.offeredBytes);
        this.telemetry.recordContextBudgetBytes(decision.source, 'RETAINED', path, decision.retainedBytes);
      }
      this.telemetry.recordContextBudgetBytes('FINAL_TOTAL', 'FINAL', path, finalTextBytes);
    } catch { /* fail-soft: telemetry can never change assembly or the turn */ }
  }
}
