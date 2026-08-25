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
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import { HypothesisReasoningContextService } from '../hypothesis/hypothesis-reasoning-context.service';
import { HypothesisReasoningInvariantError } from '../hypothesis/hypothesis-reasoning-context.types';

const DEEP_INPUT_LENGTH = 1000;

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
    private readonly hypothesisReasoningContext: HypothesisReasoningContextService,
    @Inject(MODEL_ROUTER) private readonly router: ModelRouter,
    private readonly correlation:CorrelationService,
    private readonly telemetry:TelemetryService,
  ) {}

  async orchestrate(accessToken: string, userId: string, userTurn: ConversationTurn): Promise<OrchestratedTurnResult> {
    if (userTurn.status === 'COMPLETED') {
      return this.currentResult(accessToken, userId, userTurn);
    }

    const selection = this.selectPath(userTurn.content);
    const claimed = await this.repository.claimTurn(userTurn.session_id, userId, userTurn.id, selection);
    if (!claimed) {
      return this.currentResult(accessToken, userId, userTurn);
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
      const himContext=await this.engine('him_context',selection.path,async()=>{const himSelection = this.himContextSelector.select(claimed);
      const himSnapshot = await this.himSnapshot.getSnapshot(
        accessToken,
        himSelection.contextKind,
        himSelection.contextId,
      );
      const himReasoningContext = this.himReasoningConsumption.transform(himSnapshot);
      return this.himFastDeepConsumption.project(selection.path, himReasoningContext);});
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
      const assembledContext = this.contextBuilder.assemble(context, memoryContext);
      const behavioralGuidance = this.behavioralPolicy.buildTextGuidance();
      const candidate = await this.engine('model_router',selection.path,()=>this.router.generate({
        task: 'CONVERSATIONAL_RESPONSE', path: selection.path,
        complexity: selection.path === 'DEEP' ? 'HIGH' : 'LOW',
        behavioralGuidance, ...(safety.safetyGuidance ? { safetyGuidance: safety.safetyGuidance } : {}),
        context: assembledContext.messages,
        ...(assembledContext.memoryContext ? { memoryContext: assembledContext.memoryContext } : {}),
        himContext,
        ...(hypothesisResult.coverageState === 'AVAILABLE' ? { hypothesisContext: hypothesisResult.context } : {}),
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
