import { randomUUID } from 'node:crypto';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MODEL_ROUTER, type ModelRouter, type ProcessingPath } from '../model-router/model-router.types';
import { ConversationRepository } from './conversation.repository';
import type { ConversationTurn, OrchestratedTurnResult } from './conversation.types';

const DEEP_INPUT_LENGTH = 1000;

@Injectable()
export class ConversationOrchestratorService {
  constructor(
    private readonly repository: ConversationRepository,
    @Inject(MODEL_ROUTER) private readonly router: ModelRouter,
  ) {}

  async orchestrate(accessToken: string, userId: string, userTurn: ConversationTurn): Promise<OrchestratedTurnResult> {
    if (userTurn.status === 'COMPLETED') return this.currentResult(accessToken, userId, userTurn);

    const selection = this.selectPath(userTurn.content);
    const claimed = await this.repository.claimTurn(accessToken, userTurn.session_id, userId, userTurn.id, selection);
    if (!claimed) return this.currentResult(accessToken, userId, userTurn);

    try {
      const candidate = await this.router.generate({
        task: 'CONVERSATIONAL_RESPONSE', path: selection.path,
        complexity: selection.path === 'DEEP' ? 'HIGH' : 'LOW',
        context: [{ role: 'USER', content: userTurn.content }], locale: 'und', modality: 'TEXT',
        latencyBudgetMs: selection.path === 'DEEP' ? 10000 : 3000,
        costBudget: 'LOW', safetyLevel: 'STANDARD',
      });
      const finalized = await this.repository.finalizeTurn(accessToken, {
        sessionId: userTurn.session_id, userId, sourceTurnId: userTurn.id,
        assistantTurnId: randomUUID(), content: candidate.content,
      });
      if (!finalized) return this.currentResult(accessToken, userId, claimed);
      return { userTurn: finalized.userTurn, assistantTurn: finalized.assistantTurn };
    } catch {
      await this.repository.failTurn(accessToken, userTurn.session_id, userId, userTurn.id);
      throw new ServiceUnavailableException('Conversation generation failed.');
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
