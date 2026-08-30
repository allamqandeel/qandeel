import { randomUUID } from 'node:crypto';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MODEL_ROUTER, type ModelRouter, type ProcessingPath } from '../model-router/model-router.types';
import { ConversationRepository } from './conversation.repository';
import type { ConversationTurn, OrchestratedTurnResult } from './conversation.types';
import { CONTEXT_BUILDER, type ContextBuilder } from './context-builder.types';
import {
  BEHAVIORAL_RESPONSE_POLICY,
  type BehavioralResponsePolicy,
} from './behavioral-response-policy.types';
import { SAFETY_RESPONSE_GATE, type SafetyResponseGate } from './safety-response-gate.types';
import { HimTurnContextSelectionService } from '../human-model/him-turn-context-selection.service';
import { HimIntelligenceSnapshotService } from '../human-model/him-intelligence-snapshot.service';
import type { HimIntelligenceSnapshot } from '../human-model/him-intelligence-snapshot.types';
import { HimReasoningConsumptionService } from '../human-model/him-reasoning-consumption.service';
import { HimFastDeepConsumptionService } from '../human-model/him-fast-deep-consumption.service';
import type { HimModelContext } from '../human-model/him-fast-deep-consumption.types';
import { HimInteractionAdaptationService } from '../human-model/him-interaction-adaptation.service';
import type { HimInteractionAdaptation } from '../human-model/him-interaction-adaptation.types';
import { HimContextualCurrentIntelligenceService } from '../human-model/him-contextual-current-intelligence.service';
import { HimSessionReflectionConsumptionService } from '../human-model/him-session-reflection-consumption.service';
import type { HimSessionReflectionGuidance } from '../human-model/him-session-reflection-consumption.types';
import { HimCrossContextForegroundAggregationService } from '../human-model/him-cross-context-foreground-aggregation.service';
import type { HimCrossContextForegroundGuidance } from '../human-model/him-cross-context-foreground.types';
import { HimBrainContextService } from '../human-model/him-brain-context.service';
import type { HimBrainContext } from '../human-model/him-brain-context.types';
import { buildHumanIntelligenceProviderSemantics } from '../model-router/human-intelligence-provider-semantics';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import type { HypothesisReasoningContextResult } from '../hypothesis/hypothesis-reasoning-context.types';
import { RecommendationGroundingService } from '../recommendation/recommendation-grounding.service';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { BoundedForegroundIntelligenceGathererService } from '../intelligence-runtime/bounded-foreground-intelligence-gatherer.service';

// QHIA-005 amendment (PR #164), generalized by QHIA-014A: the ONE shared
// maximum foreground orchestration time spent waiting for OPTIONAL Human
// Intelligence enrichment. This is not a database/provider SLA and does not
// change the shared 5000 ms Data API transport timeout - it only stops a
// slow-but-not-failed Human Intelligence read from holding the foreground turn
// hostage. On expiry the foreground treats that channel as UNAVAILABLE and
// proceeds without it.
//
// QHIA-014A: the HSE Snapshot budget and the QHIA-005 Session Reflection budget
// are the SAME constant, deliberately. Both bounded reads are launched in the
// same synchronous HIM launch step and joined by the same single barrier, so
// the awaited Human Intelligence hold is
//
//   max(snapshot bounded hold, reflection bounded hold) <= 300 ms
//
// and never their 600 ms sum. There is no second stage, no serial Snapshot-then
// -Reflection wait, and no 5-second fallback.
const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;

// QHIA-014A: the Snapshot foreground outcome is a bounded two-state answer.
//
// UNAVAILABLE is OMISSION, never a measurement answer: it is not an EMPTY
// snapshot, not UNKNOWN metrics, not zero/moderate metrics, not a placeholder
// ordinal category, not a fabricated generatedAt, and never a stale or older
// snapshot from any previous turn. There is no cross-turn cache on this path.
type HimSnapshotForegroundRead =
  | { state: 'AVAILABLE'; value: HimIntelligenceSnapshot }
  | { state: 'UNAVAILABLE' };

// QHIA-014A: the module-private, structurally typed Snapshot budget expiry.
//
// Budget expiry is classified by CONSTRUCTOR IDENTITY, never by substring
// matching against an arbitrary upstream error message, so no upstream failure
// can ever impersonate it and no expiry can ever be mistaken for an authority
// answer. It is never exported, never thrown across a service boundary, and
// never reaches the caller: the wrapper converts it into UNAVAILABLE at the one
// place it is created.
class HimSnapshotForegroundWaitBudgetExceededError extends Error {
  constructor() { super('HIM_SNAPSHOT_FOREGROUND_WAIT_BUDGET_EXCEEDED'); }
}

@Injectable()
export class ConversationOrchestratorService {
  constructor(
    private readonly repository: ConversationRepository,
    @Inject(CONTEXT_BUILDER) private readonly contextBuilder: ContextBuilder,
    @Inject(SAFETY_RESPONSE_GATE) private readonly safetyGate: SafetyResponseGate,
    @Inject(BEHAVIORAL_RESPONSE_POLICY) private readonly behavioralPolicy: BehavioralResponsePolicy,
    private readonly himContextSelector: HimTurnContextSelectionService,
    private readonly himSnapshot: HimIntelligenceSnapshotService,
    private readonly himReasoningConsumption: HimReasoningConsumptionService,
    private readonly himFastDeepConsumption: HimFastDeepConsumptionService,
    private readonly himInteractionAdaptation: HimInteractionAdaptationService,
    private readonly himContextualCurrentIntelligence: HimContextualCurrentIntelligenceService,
    private readonly himSessionReflectionConsumption: HimSessionReflectionConsumptionService,
    private readonly himCrossContextForeground: HimCrossContextForegroundAggregationService,
    private readonly himBrainContext: HimBrainContextService,
    private readonly foregroundIntelligenceGatherer: BoundedForegroundIntelligenceGathererService,
    private readonly recommendationGrounding: RecommendationGroundingService,
    @Inject(MODEL_ROUTER) private readonly router: ModelRouter,
    private readonly correlation:CorrelationService,
    private readonly telemetry:TelemetryService,
  ) {}

  async orchestrate(accessToken: string, userId: string, userTurn: ConversationTurn): Promise<OrchestratedTurnResult> {
    if (userTurn.status === 'COMPLETED') {
      return this.currentResult(accessToken, userId, userTurn);
    }

    // A GENERATING replay is a liveness check, never new work: the bounded
    // server-side recovery runs exactly once, and whether the lease is live
    // (no-op) or expired (canonical FAILED), the caller gets current canonical
    // state with zero downstream engine or provider calls and no re-claim.
    if (userTurn.status === 'GENERATING') {
      const recovered = await this.repository.recoverExpiredGeneratingTurn(userTurn.session_id, userId, userTurn.id);
      return this.currentResult(accessToken, userId, recovered ?? userTurn);
    }

    // QIR-002: the FAST/DEEP decision is taken EXACTLY ONCE here, by the pure
    // deterministic v2 policy, on the eligible RECEIVED path and BEFORE the
    // canonical claim. It is CPU-only: no database, network, provider, model
    // registry, Memory, HIM, Hypothesis, Confidence, Recommendation, Question or
    // Safety read participates in choosing the path, so routing adds zero
    // intelligence-read latency and zero LLM calls. The claim boundary carries
    // only the durable route PAIR; the signals and score stay in process as
    // explanatory execution metadata and never reach persistence, the provider,
    // or any semantic subsystem.
    const selection = decideFastDeepRoute(userTurn.content);
    const claimed = await this.repository.claimTurn(userTurn.session_id, userId, userTurn.id,
      { path: selection.path, reason: selection.reason });
    if (!claimed) {
      // Claim lost: another request/process won RECEIVED -> GENERATING (or the
      // turn is already terminal). The loser applies the same bounded recovery
      // check on a canonical GENERATING reread and never starts provider work.
      // It also records NO canonical routing decision: the winner alone owns
      // the durable route, so the loser's identical computation stays local and
      // never becomes a competing canonical route or a duplicate metric.
      const current = await this.repository.findTurn(accessToken, userTurn.session_id, userId, userTurn.id);
      if (current?.status === 'GENERATING') {
        const recovered = await this.repository.recoverExpiredGeneratingTurn(current.session_id, userId, current.id);
        return this.currentResult(accessToken, userId, recovered ?? current);
      }
      return this.currentResult(accessToken, userId, current ?? userTurn);
    }
    // Only the canonical claim WINNER records the routing decision, and the
    // metric is fail-soft: telemetry can never alter routing or the outcome.
    this.telemetry.recordRoutingDecision(selection);

    const execute=async()=>{try {
      const context = await this.engine('context_builder',selection.path,()=>this.contextBuilder.build(accessToken, userId, userTurn));
      const safety = await this.engine('safety_gate',selection.path,()=>this.safetyGate.evaluate(userTurn.content, context));
      if (safety.disposition === 'BLOCK') {
        const finalized = await this.repository.finalizeTurn({
          sessionId: userTurn.session_id, userId, sourceTurnId: userTurn.id,
          assistantTurnId: randomUUID(), content: safety.deterministicResponse!, safetyDisposition: safety.disposition,
        });
        if (!finalized) return this.currentResult(accessToken, userId, claimed);
        this.telemetry.recordTurnOutcome('blocked',selection.path);
        return { userTurn: finalized.userTurn, assistantTurn: finalized.assistantTurn };
      }
      // QIR-003: the frozen Human Intelligence foreground lane is LAUNCHED
      // HERE - byte-identical inside - and is no longer awaited inline. Its
      // ONE barrier, its shared 300 ms wait class, its zero-required-wait
      // optional channels, its relevance/non-inference/privacy rules and its
      // fail-closed integrity behavior are exactly as QHIA froze them; the
      // join below simply awaits this already-running lane.
      const himForegroundLanePromise = this.engine('him_context',selection.path,async()=>{const himSelection = this.himContextSelector.select(claimed);
      // QHIA-005: the HSE Intelligence Snapshot read and the one-metric
      // hbs.reflection selective read (QHIA-004 boundary, exactly one batch
      // request) are LAUNCHED CONCURRENTLY for the same authoritative session
      // selection - Reflection is never a serial network stage after the
      // Snapshot, and never a second full contextual read.
      //
      // QHIA-014A: the Snapshot read is STARTED here, synchronously and exactly
      // once, and is then handed to its own foreground budget boundary. The
      // foreground never awaits the raw read again: a slow, hung, or
      // transport-unavailable Snapshot can no longer inherit the shared 5000 ms
      // Data API timeout, hold the turn past the shared 300 ms Human
      // Intelligence budget, or fail the turn on a transport that simply could
      // not answer.
      const snapshotReadPromise = this.withSnapshotForegroundBudget(this.himSnapshot.getSnapshot(
        accessToken,
        himSelection.contextKind,
        himSelection.contextId,
      ));
      // Reflection is optional enrichment: a failed read, or a read still
      // pending when the foreground wait budget expires, stays visible as a
      // rejection through its nested engine span but degrades to no guidance
      // instead of failing the turn - fail-closed consumption, never invented
      // fallback data.
      const reflectionReadPromise = this.engine('him_reflection_context',selection.path,()=>this.withSessionReflectionForegroundBudget(()=>this.himContextualCurrentIntelligence.getCurrentSelection(
        userId,
        accessToken,
        'CONVERSATION_SESSION',
        himSelection.contextId,
        ['hbs.reflection'],
      ))).then(
        (value) => ({ state: 'AVAILABLE' as const, value }),
        () => ({ state: 'UNAVAILABLE' as const }),
      );
      // QHIA-009: the ONE cross-context foreground read is LAUNCHED HERE, in
      // the same synchronous step as the Snapshot and Reflection reads, so it
      // begins concurrently with them and never after either one finishes.
      //
      // It replaces the two independent QHIA-007 and QHIA-008 launches that
      // preceded it. It is exactly ONE external Data API request against the
      // migration-0060 aggregate-v3 RPC, which WRAPS the unchanged
      // migration-0059 aggregate v2 - itself wrapping the unchanged
      // migration-0058 aggregate v1 and the unchanged migration-0059
      // Goal-motivation authority - plus the unchanged migration-0060
      // Relationship-communication authority: the orchestrator calls no
      // direct read, issues no backup request, keeps no aggregate-v1 or
      // aggregate-v2 fallback, and never races one transport against another.
      // QHIA-011 therefore adds ZERO external foreground requests and ZERO
      // incremental foreground wait. All four channels share one external
      // settlement - intentional - so a still-pending aggregate means no
      // channel is used for this turn rather than a fallback fan-out.
      //
      // It carries ZERO INCREMENTAL FOREGROUND WAIT: no new timeout is
      // introduced, the existing 300 ms QHIA-005 Reflection budget is neither
      // reused nor extended, and the foreground never awaits this promise.
      // The settlement handler below is attached IMMEDIATELY (so a rejection
      // is always handled and can never become an unhandled rejection) and
      // simply records the decoded guidance if - and only if - the read
      // settles successfully BEFORE the existing foreground barrier closes.
      // Anything that settles later is discarded for good: it cannot delay
      // dispatch, mutate an in-flight provider request, be consumed by this
      // turn, or be carried into any other turn or session, and no cross-turn
      // cache exists anywhere on this path.
      let crossContextForegroundSettled: HimCrossContextForegroundGuidance | undefined;
      let crossContextForegroundBarrierClosed = false;
      const crossContextForegroundReadPromise = this.engine('him_cross_context_foreground',selection.path,()=>this.himCrossContextForeground.read(
        userId,
        accessToken,
        himSelection.contextId,
      ));
      crossContextForegroundReadPromise.then(
        (value) => { if (!crossContextForegroundBarrierClosed) crossContextForegroundSettled = value; },
        () => undefined,
      );
      // QHIA-012: the ONE optional Brain Context read is LAUNCHED HERE, in the
      // same synchronous step as the Snapshot, Reflection and aggregate-v3
      // reads, so it begins concurrently with them and never after any of them
      // finishes.
      //
      // It is exactly ONE external Data API request against the migration-0061
      // authenticated RPC, which resolves the immediately preceding canonical
      // USER turn, that turn's durable typed Brain Context materialization, and
      // the CURRENT QHIA-006 binding revalidation server-side, in one round
      // trip. The heavy Human Intelligence work happened in the PREVIOUS turn's
      // post-response background path; this turn only collects it.
      //
      // It carries ZERO INCREMENTAL FOREGROUND WAIT. No new timeout is
      // introduced, the existing 300 ms QHIA-005 Reflection budget is neither
      // reused nor extended, no sleep is added, no new barrier is created, and
      // the foreground NEVER awaits this promise. The settlement handler below
      // is attached IMMEDIATELY (so a rejection is always handled and can never
      // become an unhandled rejection) and simply records the decoded context if
      // - and only if - the read settles successfully BEFORE the existing
      // foreground barrier closes. Anything that settles later is discarded for
      // good: it cannot delay dispatch, mutate an in-flight provider request,
      // trigger a second provider call, be consumed by this turn, or be carried
      // into any other turn or session, and no cross-turn cache exists anywhere
      // on this path.
      let brainContextSettled: HimBrainContext | undefined;
      let brainContextBarrierClosed = false;
      const brainContextReadPromise = this.engine('him_brain_context',selection.path,()=>this.himBrainContext.read(
        userId,
        accessToken,
        himSelection.contextId,
        claimed.id,
      ));
      brainContextReadPromise.then(
        (value) => { if (!brainContextBarrierClosed) brainContextSettled = value; },
        () => undefined,
      );
      const [snapshotRead, reflectionRead] = await Promise.all([snapshotReadPromise, reflectionReadPromise]);
      // The existing foreground barrier - and the ONLY one. Reading the
      // recorded values here adds no await of any kind: an already-settled
      // aggregate yields all four existing guidance contracts, an
      // already-settled Brain Context read yields this turn's advisory Brain
      // Context, and a still-pending or rejected one of either is simply absent
      // for this turn.
      crossContextForegroundBarrierClosed = true;
      brainContextBarrierClosed = true;
      const situationStressGuidance = crossContextForegroundSettled?.situationStress;
      const decisionAttentionGuidance = crossContextForegroundSettled?.decisionAttention;
      const goalMotivationGuidance = crossContextForegroundSettled?.goalMotivation;
      const relationshipCommunicationGuidance = crossContextForegroundSettled?.relationshipCommunication;
      // QHIA-014A: the ENTIRE Snapshot-derived lane runs only on a real
      // canonical Snapshot. When the Snapshot is UNAVAILABLE nothing here is
      // called on a fabricated input: no reasoning transform, no QHIA-001
      // adaptation, no FAST/DEEP projection. The lane is simply absent for this
      // turn, and the next turn performs its own read.
      //
      // The chain itself is unchanged: transform -> derive -> project, with the
      // adaptation derived from the reasoning context BEFORE the FAST/DEEP
      // density projection, so it stays path-independent and never selects the
      // path. Every integrity failure inside it still propagates and fails the
      // turn closed before provider generation.
      let snapshotModelContext: HimModelContext | undefined;
      let adaptation: HimInteractionAdaptation | undefined;
      if (snapshotRead.state === 'AVAILABLE') {
        const himReasoningContext = this.himReasoningConsumption.transform(snapshotRead.value);
        adaptation = this.himInteractionAdaptation.derive(himReasoningContext);
        snapshotModelContext = this.himFastDeepConsumption.project(selection.path, himReasoningContext);
      }
      // The pure Reflection consumption boundary fails closed on a malformed
      // selection; on this optional enrichment path that failure also degrades
      // to omitted guidance and never alters the HSE adaptation or the turn.
      let reflectionGuidance: HimSessionReflectionGuidance | undefined;
      if (reflectionRead.state === 'AVAILABLE') {
        try { reflectionGuidance = this.himSessionReflectionConsumption.consume(reflectionRead.value); } catch { reflectionGuidance = undefined; }
      }
      return {himContext:snapshotModelContext,himInteractionAdaptation:adaptation,himSessionReflectionGuidance:reflectionGuidance,himSituationStressGuidance:situationStressGuidance,himDecisionAttentionGuidance:decisionAttentionGuidance,himGoalMotivationGuidance:goalMotivationGuidance,himRelationshipCommunicationGuidance:relationshipCommunicationGuidance,himBrainContext:brainContextSettled};});
      // QIR-003: the bounded Memory + Hypothesis foreground gather is LAUNCHED
      // HERE, in the SAME synchronous post-Safety stage as the frozen Human
      // Intelligence lane above and BEFORE either lane is awaited. Memory and
      // Hypothesis do not depend on Human Intelligence or on each other, so
      // all three independent foreground lanes start together: Memory is never
      // a serial stage after the Human Intelligence barrier, and Hypothesis is
      // never a serial stage after Memory. Inside the gatherer both sources
      // share ONE absolute 5000 ms non-HI foreground ceiling that starts at
      // this launch - a structural safety ceiling derived from the canonical
      // Data API transport boundary, NOT the QHIA 300 ms Human Intelligence
      // budget (untouched, and never applied to these sources), NOT a
      // whole-turn budget, and NOT a provider latency budget. Safety has
      // already authorized this turn: the BLOCK short-circuit returns above
      // before any of these launches, so a blocked turn performs zero Memory,
      // Hypothesis, Recommendation and provider work.
      const foregroundGatherPromise = this.foregroundIntelligenceGatherer.gather({
        userId, accessToken, content: userTurn.content, path: selection.path,
      });
      // The swallow handler is attached IMMEDIATELY so a hard gather failure
      // that settles while the Human Intelligence lane is still being awaited
      // can never become an unhandled rejection. It changes nothing else: the
      // ORIGINAL rejection still propagates through the gather join below and
      // fails the turn closed through the existing outer failure path before
      // any provider generation.
      foregroundGatherPromise.catch(() => undefined);
      // The join: both lanes are ALREADY RUNNING, so awaiting them in sequence
      // waits for the slower of the frozen Human Intelligence lane and the
      // shared Memory/Hypothesis gather deadline - never their serial sum -
      // and introduces no new barrier construct and no new timer into this
      // orchestrator.
      const {himContext,himInteractionAdaptation,himSessionReflectionGuidance,himSituationStressGuidance,himDecisionAttentionGuidance,himGoalMotivationGuidance,himRelationshipCommunicationGuidance,himBrainContext}=await himForegroundLanePromise;
      // QHIA-013: the ONE Human Intelligence provider boundary conversion.
      //
      // Every value above already exists in memory at this point - this is pure
      // synchronous CPU-only object normalization that runs ONCE per
      // provider-generating turn. It issues no network request, no database
      // request, no provider call and no LLM call; it awaits nothing, creates no
      // Promise, no timer, no sleep, no retry, no barrier and no engine span;
      // and it reads no metric, no binding and no numeric value to derive
      // behavior. The zero-wait topology above - the Snapshot read, the 300 ms
      // Reflection budget, the aggregate-v3 read, the Brain Context read, the
      // one Promise.all and the single barrier-close point - is untouched.
      //
      // QHIA-014A: `humanIntelligence` is NOT all-or-nothing around the
      // Snapshot. When the Snapshot lane is absent, the compiler simply
      // receives no session reasoning and no QHIA-001 adaptation, and the
      // independent Reflection, aggregate-v3 and Brain Context channels still
      // compile into the same one envelope exactly as they always did. Only if
      // every channel is absent does the compiler return undefined and the
      // envelope stay off the request entirely.
      const humanIntelligence = buildHumanIntelligenceProviderSemantics({
        ...(himContext ? { himContext } : {}),
        ...(himInteractionAdaptation?.adaptationState === 'ACTIVE' ? { himInteractionAdaptation } : {}),
        ...(himSessionReflectionGuidance ? { himSessionReflectionGuidance } : {}),
        ...(himSituationStressGuidance ? { himSituationStressGuidance } : {}),
        ...(himDecisionAttentionGuidance ? { himDecisionAttentionGuidance } : {}),
        ...(himGoalMotivationGuidance ? { himGoalMotivationGuidance } : {}),
        ...(himRelationshipCommunicationGuidance ? { himRelationshipCommunicationGuidance } : {}),
        ...(himBrainContext ? { himBrainContext } : {}),
      });
      // QIR-003 gather join: a hard Memory or Hypothesis failure rejects here
      // with its ORIGINAL error and fails the turn closed through the existing
      // outer failure path; every approved degradation arrives as a typed
      // outcome instead. The gatherer has already emitted the bounded
      // per-source outcome telemetry and, for a hard Hypothesis failure, the
      // pre-existing hypothesis-context rejected/failed outcome metric.
      const { memory: memoryForeground, hypothesis: hypothesisForeground } = await foregroundGatherPromise;
      // Provider-envelope Memory semantics: AVAILABLE carries the actual
      // retrieved Memory context; LEGITIMATE_EMPTY, OPTIONAL_AVAILABILITY_FAILURE
      // and FOREGROUND_BUDGET_EXPIRY all OMIT the Memory field (assemble drops
      // an empty array) while remaining fully distinguished internally and in
      // telemetry. Unavailable or expired Memory is OMISSION: never an
      // empty-memory assertion, never a remembered older answer, and never
      // fabricated content.
      const memoryContext = memoryForeground.state === 'AVAILABLE' ? memoryForeground.value : [];
      // Hypothesis is consumed ONLY from a legitimate typed outcome. An
      // unavailable or expired Hypothesis is never converted into a fabricated
      // canonical EMPTY result: it simply yields no Hypothesis field and no
      // Recommendation for this turn.
      let hypothesisResult: HypothesisReasoningContextResult | undefined;
      if (hypothesisForeground.state === 'AVAILABLE' || hypothesisForeground.state === 'LEGITIMATE_EMPTY') hypothesisResult = hypothesisForeground.value;
      if (hypothesisResult?.coverageState === 'EMPTY') this.telemetry.recordHypothesisContext('empty', selection.path);
      else if (hypothesisResult) this.telemetry.recordHypothesisContext('available', selection.path, hypothesisResult.context.contractVersion, hypothesisResult.context.candidateHypothesisCount, hypothesisResult.context.includedHypothesisCount);
      // Recommendation grounding stays deterministic, read-only and
      // Hypothesis-owned: it runs on an AVAILABLE result, may run on the
      // canonical legitimate EMPTY result, and is NEVER called for an
      // unavailable or expired Hypothesis. There is no Recommendation
      // fallback and no provider-generated replacement; a grounding invariant
      // failure still fails the turn closed before any provider generation.
      const recommendationGrounding = hypothesisResult ? this.recommendationGrounding.ground(hypothesisResult) : undefined;
      const assembledContext = this.contextBuilder.assemble(context, memoryContext);
      const behavioralGuidance = this.behavioralPolicy.buildTextGuidance();
      const candidate = await this.engine('model_router',selection.path,()=>this.router.generate({
        task: 'CONVERSATIONAL_RESPONSE', path: selection.path,
        complexity: selection.path === 'DEEP' ? 'HIGH' : 'LOW',
        behavioralGuidance, ...(safety.safetyGuidance ? { safetyGuidance: safety.safetyGuidance } : {}),
        context: assembledContext.messages,
        ...(assembledContext.memoryContext ? { memoryContext: assembledContext.memoryContext } : {}),
        // QHIA-013: exactly ONE Human Intelligence provider field. The eight
        // legacy Human Intelligence request fields are gone - not aliased, not
        // duplicated, not kept for compatibility. Brain Context still travels as
        // its own separate data lane INSIDE this envelope, never merged into the
        // session reasoning lane, and is still present only when its read
        // settled successfully before the existing barrier AND carried at least
        // one surviving signal.
        ...(humanIntelligence ? { humanIntelligence } : {}),
        ...(hypothesisResult?.coverageState === 'AVAILABLE' ? { hypothesisContext: hypothesisResult.context } : {}),
        ...(recommendationGrounding?.coverageState === 'AVAILABLE' ? { recommendationContext: recommendationGrounding.context } : {}),
        locale: 'und', modality: 'TEXT',
        latencyBudgetMs: selection.path === 'DEEP' ? 10000 : 3000,
        costBudget: 'LOW', safetyLevel: 'STANDARD',
      }));
      if (hypothesisResult?.coverageState === 'AVAILABLE') this.telemetry.recordHypothesisContext('consumed', selection.path, hypothesisResult.context.contractVersion, hypothesisResult.context.candidateHypothesisCount, hypothesisResult.context.includedHypothesisCount);
      const finalized = await this.repository.finalizeTurn({
        sessionId: userTurn.session_id, userId, sourceTurnId: userTurn.id,
        assistantTurnId: randomUUID(), content: candidate.content, safetyDisposition: safety.disposition,
      });
      if (!finalized) return this.currentResult(accessToken, userId, claimed);
      this.telemetry.recordTurnOutcome('completed',selection.path);
      return { userTurn: finalized.userTurn, assistantTurn: finalized.assistantTurn };
    } catch {
      this.telemetry.recordTurnOutcome('failed',selection.path);
      await this.repository.failTurn(userTurn.session_id, userId, userTurn.id);
      throw new ServiceUnavailableException('Conversation generation failed.');
    }};
    if(!this.correlation.current())return execute();this.correlation.bindCanonical(claimed.session_id,claimed.id);return this.correlation.withOrchestration(execute);
  }

  private engine<T>(name:string,path:ProcessingPath|undefined,work:()=>Promise<T>|T):Promise<T>{return this.correlation.current()?this.telemetry.withEngine(name,path,work):Promise.resolve().then(work);}

  // QHIA-005 amendment: bounded foreground wait for the optional Reflection
  // enrichment. Rejects INSIDE the him_reflection_context engine work when the
  // budget expires, so telemetry records a failed enrichment rather than a
  // false success. The timer is always cleared on the read's own settlement
  // (no timer leak on a fast read), and the underlying Data API request keeps
  // its handlers attached, so a late fulfillment or rejection after the budget
  // settles into this already-settled promise as a no-op: no unhandled
  // rejection, no late consumption, no second provider call, and no mutation
  // of the completed turn. No transport cancellation is introduced here.
  //
  // QHIA-014A changes exactly one thing here: the numeric budget now comes from
  // the ONE shared Human Intelligence constant. The exact budget-expiry error
  // string, the engine placement, the degradation handler and every other
  // Reflection semantic are unchanged.
  private withSessionReflectionForegroundBudget<T>(read: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('SESSION_REFLECTION_FOREGROUND_WAIT_BUDGET_EXCEEDED')),
        HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS,
      );
      Promise.resolve().then(read).then(
        (value) => { clearTimeout(timer); resolve(value); },
        (error) => { clearTimeout(timer); reject(error); },
      );
    });
  }

  // QHIA-014A: the bounded foreground boundary for the HSE Intelligence
  // Snapshot, structurally mirroring the QHIA-005 Reflection budget above.
  //
  // The read is ALREADY RUNNING when it arrives here - it is started in the
  // same synchronous HIM launch step as Reflection, aggregate-v3 and Brain
  // Context - and this wrapper only bounds how long the foreground is willing
  // to wait for it. Exactly ONE Snapshot request exists per turn: there is no
  // retry, no fallback Snapshot, no per-metric read, no second call on expiry,
  // and no transport cancellation.
  //
  // It resolves rather than rejects for exactly two classified outcomes, and
  // rethrows everything else:
  //
  //   UNAVAILABLE  <- the shared 300 ms budget expired (typed, module-private
  //                   identity - never a substring match);
  //   UNAVAILABLE  <- the Snapshot service classified the failure as transport
  //                   unavailable and sanitized it into ServiceUnavailableException
  //                   (missing Data API configuration, fetch/network failure,
  //                   AbortSignal transport timeout, or an explicitly frozen
  //                   transient 408/429/502/503/504 infrastructure status);
  //   RETHROW      <- everything else, unchanged: UNSUPPORTED_CONTEXT,
  //                   INVALID_OR_UNOWNED_CONTEXT, INTEGRITY_FAILURE, an
  //                   unrecognized upstream database error, and any ordinary
  //                   unexpected Error. Unknown stays fail-closed and still
  //                   fails the turn through the existing outer failure path
  //                   before any provider generation.
  //
  // The timer is always cleared on the read's own settlement, and the
  // underlying read keeps its handlers attached, so a LATE fulfillment or
  // rejection after the budget settles into this already-settled promise as a
  // no-op: no unhandled rejection, no late consumption, no mutation of the
  // dispatched provider request, no second provider call, no second
  // finalization, and nothing stored for any later turn.
  private withSnapshotForegroundBudget(read: Promise<HimIntelligenceSnapshot>): Promise<HimSnapshotForegroundRead> {
    return new Promise<HimSnapshotForegroundRead>((resolve, reject) => {
      const settle = (error: unknown): void => {
        if (error instanceof HimSnapshotForegroundWaitBudgetExceededError || error instanceof ServiceUnavailableException) resolve({ state: 'UNAVAILABLE' });
        else reject(error);
      };
      const timer = setTimeout(
        () => settle(new HimSnapshotForegroundWaitBudgetExceededError()),
        HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS,
      );
      read.then(
        (value) => { clearTimeout(timer); resolve({ state: 'AVAILABLE', value }); },
        (error) => { clearTimeout(timer); settle(error); },
      );
    });
  }

  private async currentResult(accessToken: string, userId: string, turn: ConversationTurn): Promise<OrchestratedTurnResult> {
    const userTurn = await this.repository.findTurn(accessToken, turn.session_id, userId, turn.id) ?? turn;
    const assistantTurn = await this.repository.findAssistantForSource(accessToken, turn.session_id, userId, turn.id);
    return { userTurn, ...(assistantTurn ? { assistantTurn } : {}) };
  }

}
