import { Injectable } from '@nestjs/common';
import type { ModelRouterContextMessage } from '../model-router/model-router.types';
import type { ContextBuilder } from './context-builder.types';
import { ConversationRepository } from './conversation.repository';
import type { ConversationTurn } from './conversation.types';

// Server-owned TEXT v1 policy. This is a turn count, not a client or provider option.
export const RECENT_CONTEXT_HISTORY_LIMIT = 8;

@Injectable()
export class ContextBuilderService implements ContextBuilder {
  constructor(private readonly repository: ConversationRepository) {}

  async build(
    accessToken: string,
    userId: string,
    sourceTurn: ConversationTurn,
  ): Promise<ReadonlyArray<ModelRouterContextMessage>> {
    const recentTurns = await this.repository.findRecentAuthoritativeTurns(
      accessToken,
      sourceTurn.session_id,
      userId,
      sourceTurn.id,
      RECENT_CONTEXT_HISTORY_LIMIT,
    );

    const authoritativeHistory = recentTurns
      .filter((turn) =>
        turn.id !== sourceTurn.id &&
        turn.session_id === sourceTurn.session_id &&
        turn.status === 'COMPLETED' &&
        (turn.role === 'USER' || (turn.role === 'ASSISTANT' && turn.source_turn_id !== null)),
      )
      .sort((left, right) =>
        left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id),
      )
      .slice(-RECENT_CONTEXT_HISTORY_LIMIT);

    return [
      ...authoritativeHistory.map(({ role, content }) => ({ role, content })),
      { role: 'USER' as const, content: sourceTurn.content },
    ];
  }
}
