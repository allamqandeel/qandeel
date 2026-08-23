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
import { MemoryWriteService } from '../memory/memory-write.service';
import { HimTurnContextSelectionService } from '../human-model/him-turn-context-selection.service';
import { HimIntelligenceSnapshotService } from '../human-model/him-intelligence-snapshot.service';
import { HimReasoningConsumptionService } from '../human-model/him-reasoning-consumption.service';

const DEEP_INPUT_LENGTH = 1000;

@Injectable()
export class ConversationOrchestratorService {
  constructor(
    private readonly repository: ConversationRepository,
    @Inject(CONTEXT_BUILDER) private readonly contextBuilder: ContextBuilder,
    @Inject(SAFETY_RESPONSE_GATE) private readonly safetyGate: SafetyResponseGate,
    @Inject(BEHAVIORAL_RESPONSE_POLICY) private readonly behavioralPolicy: BehavioralResponsePolicy,
    private readonly memoryRetriever: MemoryRetrieverService,
    private readonly memoryWriter: MemoryWriteService,
    private readonly himContextSelector: HimTurnContextSelectionService,
    private readonly himSnapshot: HimIntelligenceSnapshotService,
    private readonly himReasoningConsumption: HimReasoningConsumptionService,
    @Inject(MODEL_ROUTER) private readonly router: ModelRouter,
  ) {}

  async orchestrate(accessToken: string, userId: string, userTurn: ConversationTurn): Promise<OrchestratedTurnResult> {
    if (userTurn.status === 'COMPLETED') return this.currentResult(accessToken, userId, userTurn);

    const selection = this.selectPath(userTurn.content);
    const claimed = await this.repository.claimTurn(accessToken, userTurn.session_id, userId, userTurn.id, selection);
    if (!claimed) return this.currentResult(accessToken, userId, userTurn);

    try {
      const context = await this.contextBuilder.build(accessToken, userId, userTurn);
      const safety = this.safetyGate.evaluate(userTurn.content, context);
      if (safety.disposition === 'BLOCK') {
        const finalized = await this.repository.finalizeTurn(accessToken, {
          sessionId: userTurn.session_id, userId, sourceTurnId: userTurn.id,
          assistantTurnId: randomUUID(), content: safety.deterministicResponse!,
        });
        if (!finalized) return this.currentResult(accessToken, userId, claimed);
        return { userTurn: finalized.userTurn, assistantTurn: finalized.assistantTurn };
      }
      const himSelection = this.himContextSelector.select(claimed);
      const himSnapshot = await this.himSnapshot.getSnapshot(
        accessToken,
        himSelection.contextKind,
        himSelection.contextId,
      );
      const himContext = this.himReasoningConsumption.transform(himSnapshot);
      const memoryContext = await this.memoryRetriever.retrieve(userId, accessToken, userTurn.content);
      const assembledContext = this.contextBuilder.assemble(context, memoryContext);
      const behavioralGuidance = this.behavioralPolicy.buildTextGuidance();
      const candidate = await this.router.generate({
        task: 'CONVERSATIONAL_RESPONSE', path: selection.path,
        complexity: selection.path === 'DEEP' ? 'HIGH' : 'LOW',
        behavioralGuidance, ...(safety.safetyGuidance ? { safetyGuidance: safety.safetyGuidance } : {}),
        context: assembledContext.messages,
        ...(assembledContext.memoryContext ? { memoryContext: assembledContext.memoryContext } : {}),
        himContext,
        locale: 'und', modality: 'TEXT',
        latencyBudgetMs: selection.path === 'DEEP' ? 10000 : 3000,
        costBudget: 'LOW', safetyLevel: 'STANDARD',
      });
      const finalized = await this.repository.finalizeTurn(accessToken, {
        sessionId: userTurn.session_id, userId, sourceTurnId: userTurn.id,
        assistantTurnId: randomUUID(), content: candidate.content,
      });
      if (!finalized) return this.currentResult(accessToken, userId, claimed);
      await this.writeMemoryFailSoft(userId, accessToken, userTurn.content, safety.disposition);
      return { userTurn: finalized.userTurn, assistantTurn: finalized.assistantTurn };
    } catch {
      await this.repository.failTurn(accessToken, userTurn.session_id, userId, userTurn.id);
      throw new ServiceUnavailableException('Conversation generation failed.');
    }
  }

  private async writeMemoryFailSoft(
    userId: string,
    accessToken: string,
    content: string,
    safetyDisposition: 'ALLOW' | 'GUIDED' | 'BLOCK',
  ): Promise<void> {
    if (safetyDisposition !== 'ALLOW') return;
    try {
      await this.memoryWriter.evaluateAndWrite(userId, accessToken, content);
    } catch {
      // Memory is a non-authoritative side capability. Finalized conversation output remains authoritative.
    }
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
