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
import { MemoryRetrieverService } from '../memory/memory-retriever.service';
import { HimTurnContextSelectionService } from '../human-model/him-turn-context-selection.service';
import { HimIntelligenceSnapshotService } from '../human-model/him-intelligence-snapshot.service';
import { HimReasoningConsumptionService } from '../human-model/him-reasoning-consumption.service';
import { HimFastDeepConsumptionService } from '../human-model/him-fast-deep-consumption.service';
import { HimInteractionAdaptationService } from '../human-model/him-interaction-adaptation.service';
import { HimContextualCurrentIntelligenceService } from '../human-model/him-contextual-current-intelligence.service';
import { HimSessionReflectionConsumptionService } from '../human-model/him-session-reflection-consumption.service';
import type { HimSessionReflectionGuidance } from '../human-model/him-session-reflection-consumption.types';
import { HimCrossContextForegroundAggregationService } from '../human-model/him-cross-context-foreground-aggregation.service';
import type { HimCrossContextForegroundGuidance } from '../human-model/him-cross-context-foreground.types';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import { HypothesisReasoningContextService } from '../hypothesis/hypothesis-reasoning-context.service';
import { HypothesisReasoningInvariantError } from '../hypothesis/hypothesis-reasoning-context.types';
import { RecommendationGroundingService } from '../recommendation/recommendation-grounding.service';

const DEEP_INPUT_LENGTH = 1000;
// QHIA-005 amendment (PR #164): the maximum foreground orchestration time
// spent waiting for the OPTIONAL Session Reflection enrichment. This is not a
// database/provider SLA and does not change the shared Data API transport
// timeout - it only stops a slow-but-not-failed Reflection read from holding
// the foreground turn hostage. On expiry the foreground treats Reflection as
// UNAVAILABLE and proceeds without guidance.
const SESSION_REFLECTION_FOREGROUND_WAIT_BUDGET_MS = 300;

@Injectable()
export class ConversationOrchestratorService {
  constructor(
    private readonly repository: ConversationRepository,
    @Inject(CONTEXT_BUILDER) private readonly contextBuilder: ContextBuilder,
    @Inject(SAFETY_RESPONSE_GATE) private readonly safetyGate: SafetyResponseGate,
    @Inject(BEHAVIORAL_RESPONSE_POLICY) private readonly behavioralPolicy: BehavioralResponsePolicy,
    private readonly memoryRetriever: MemoryRetrieverService,
    private readonly himContextSelector: HimTurnContextSelectionService,
    private readonly himSnapshot: HimIntelligenceSnapshotService,
    private readonly himReasoningConsumption: HimReasoningConsumptionService,
    private readonly himFastDeepConsumption: HimFastDeepConsumptionService,
    private readonly himInteractionAdaptation: HimInteractionAdaptationService,
    private readonly himContextualCurrentIntelligence: HimContextualCurrentIntelligenceService,
    private readonly himSessionReflectionConsumption: HimSessionReflectionConsumptionService,
    private readonly himCrossContextForeground: HimCrossContextForegroundAggregationService,
    private readonly hypothesisReasoningContext: HypothesisReasoningContextService,
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

    const selection = this.selectPath(userTurn.content);
    const claimed = await this.repository.claimTurn(userTurn.session_id, userId, userTurn.id, selection);
    if (!claimed) {
      // Claim lost: another request/process won RECEIVED -> GENERATING (or the
      // turn is already terminal). The loser applies the same bounded recovery
      // check on a canonical GENERATING reread and never starts provider work.
      const current = await this.repository.findTurn(accessToken, userTurn.session_id, userId, userTurn.id);
      if (current?.status === 'GENERATING') {
        const recovered = await this.repository.recoverExpiredGeneratingTurn(current.session_id, userId, current.id);
        return this.currentResult(accessToken, userId, recovered ?? current);
      }
      return this.currentResult(accessToken, userId, current ?? userTurn);
    }

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
      const {himContext,himInteractionAdaptation,himSessionReflectionGuidance,himSituationStressGuidance,himDecisionAttentionGuidance,himGoalMotivationGuidance,himRelationshipCommunicationGuidance}=await this.engine('him_context',selection.path,async()=>{const himSelection = this.himContextSelector.select(claimed);
      // QHIA-005: the HSE Intelligence Snapshot read and the one-metric
      // hbs.reflection selective read (QHIA-004 boundary, exactly one batch
      // request) are LAUNCHED CONCURRENTLY for the same authoritative session
      // selection - Reflection is never a serial network stage after the
      // Snapshot, and never a second full contextual read.
      const himSnapshotPromise = this.himSnapshot.getSnapshot(
        accessToken,
        himSelection.contextKind,
        himSelection.contextId,
      );
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
      const [himSnapshot, reflectionRead] = await Promise.all([himSnapshotPromise, reflectionReadPromise]);
      // The existing foreground barrier - and the ONLY one. Reading the
      // recorded value here adds no await of any kind: an already-settled
      // aggregate yields all four existing guidance contracts, and a
      // still-pending or rejected one is simply absent for this turn.
      crossContextForegroundBarrierClosed = true;
      const situationStressGuidance = crossContextForegroundSettled?.situationStress;
      const decisionAttentionGuidance = crossContextForegroundSettled?.decisionAttention;
      const goalMotivationGuidance = crossContextForegroundSettled?.goalMotivation;
      const relationshipCommunicationGuidance = crossContextForegroundSettled?.relationshipCommunication;
      const himReasoningContext = this.himReasoningConsumption.transform(himSnapshot);
      // The adaptation derives from the reasoning context BEFORE the FAST/DEEP
      // density projection: it is path-independent and never selects the path.
      const adaptation = this.himInteractionAdaptation.derive(himReasoningContext);
      // The pure Reflection consumption boundary fails closed on a malformed
      // selection; on this optional enrichment path that failure also degrades
      // to omitted guidance and never alters the HSE adaptation or the turn.
      let reflectionGuidance: HimSessionReflectionGuidance | undefined;
      if (reflectionRead.state === 'AVAILABLE') {
        try { reflectionGuidance = this.himSessionReflectionConsumption.consume(reflectionRead.value); } catch { reflectionGuidance = undefined; }
      }
      return {himContext:this.himFastDeepConsumption.project(selection.path, himReasoningContext),himInteractionAdaptation:adaptation,himSessionReflectionGuidance:reflectionGuidance,himSituationStressGuidance:situationStressGuidance,himDecisionAttentionGuidance:decisionAttentionGuidance,himGoalMotivationGuidance:goalMotivationGuidance,himRelationshipCommunicationGuidance:relationshipCommunicationGuidance};});
      const memoryContext = await this.engine('memory_retrieval',selection.path,()=>this.memoryRetriever.retrieve(userId, accessToken, userTurn.content));
      let hypothesisResult;
      try {
        hypothesisResult = await this.engine('hypothesis_context',selection.path,()=>this.hypothesisReasoningContext.build(userId, accessToken));
      } catch (error) {
        this.telemetry.recordHypothesisContext(error instanceof HypothesisReasoningInvariantError ? 'rejected' : 'failed', selection.path);
        throw error;
      }
      if (hypothesisResult.coverageState === 'EMPTY') this.telemetry.recordHypothesisContext('empty', selection.path);
      else this.telemetry.recordHypothesisContext('available', selection.path, hypothesisResult.context.contractVersion, hypothesisResult.context.candidateHypothesisCount, hypothesisResult.context.includedHypothesisCount);
      const recommendationGrounding = this.recommendationGrounding.ground(hypothesisResult);
      const assembledContext = this.contextBuilder.assemble(context, memoryContext);
      const behavioralGuidance = this.behavioralPolicy.buildTextGuidance();
      const candidate = await this.engine('model_router',selection.path,()=>this.router.generate({
        task: 'CONVERSATIONAL_RESPONSE', path: selection.path,
        complexity: selection.path === 'DEEP' ? 'HIGH' : 'LOW',
        behavioralGuidance, ...(safety.safetyGuidance ? { safetyGuidance: safety.safetyGuidance } : {}),
        context: assembledContext.messages,
        ...(assembledContext.memoryContext ? { memoryContext: assembledContext.memoryContext } : {}),
        himContext,
        ...(himInteractionAdaptation.adaptationState === 'ACTIVE' ? { himInteractionAdaptation } : {}),
        ...(himSessionReflectionGuidance?.guidanceState === 'ACTIVE' ? { himSessionReflectionGuidance } : {}),
        ...(himSituationStressGuidance?.guidanceState === 'ACTIVE' ? { himSituationStressGuidance } : {}),
        ...(himDecisionAttentionGuidance?.guidanceState === 'ACTIVE' ? { himDecisionAttentionGuidance } : {}),
        ...(himGoalMotivationGuidance?.guidanceState === 'ACTIVE' ? { himGoalMotivationGuidance } : {}),
        ...(himRelationshipCommunicationGuidance?.guidanceState === 'ACTIVE' ? { himRelationshipCommunicationGuidance } : {}),
        ...(hypothesisResult.coverageState === 'AVAILABLE' ? { hypothesisContext: hypothesisResult.context } : {}),
        ...(recommendationGrounding.coverageState === 'AVAILABLE' ? { recommendationContext: recommendationGrounding.context } : {}),
        locale: 'und', modality: 'TEXT',
        latencyBudgetMs: selection.path === 'DEEP' ? 10000 : 3000,
        costBudget: 'LOW', safetyLevel: 'STANDARD',
      }));
      if (hypothesisResult.coverageState === 'AVAILABLE') this.telemetry.recordHypothesisContext('consumed', selection.path, hypothesisResult.context.contractVersion, hypothesisResult.context.candidateHypothesisCount, hypothesisResult.context.includedHypothesisCount);
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
  private withSessionReflectionForegroundBudget<T>(read: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('SESSION_REFLECTION_FOREGROUND_WAIT_BUDGET_EXCEEDED')),
        SESSION_REFLECTION_FOREGROUND_WAIT_BUDGET_MS,
      );
      Promise.resolve().then(read).then(
        (value) => { clearTimeout(timer); resolve(value); },
        (error) => { clearTimeout(timer); reject(error); },
      );
    });
  }

  private async currentResult(accessToken: string, userId: string, turn: ConversationTurn): Promise<OrchestratedTurnResult> {
    const userTurn = await this.repository.findTurn(accessToken, turn.session_id, userId, turn.id) ?? turn;
    const assistantTurn = await this.repository.findAssistantForSource(accessToken, turn.session_id, userId, turn.id);
    return { userTurn, ...(assistantTurn ? { assistantTurn } : {}) };
  }

  private selectPath(content: string): { path: ProcessingPath; reason: string } {
    return content.length >= DEEP_INPUT_LENGTH
      ? { path: 'DEEP', reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT' }
      : { path: 'FAST', reason: 'FAST_DEFAULT' };
  }
}
