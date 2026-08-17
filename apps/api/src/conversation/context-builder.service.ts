import { Injectable } from '@nestjs/common';
import type { ModelRouterContextMessage } from '../model-router/model-router.types';
import type { ContextBuilder } from './context-builder.types';
import { ConversationRepository } from './conversation.repository';
import type { ConversationTurn } from './conversation.types';

// Server-owned TEXT v1 policy. Complete exchanges are bounded, never individual rows.
export const RECENT_CONTEXT_EXCHANGE_LIMIT = 4;

@Injectable()
export class ContextBuilderService implements ContextBuilder {
  constructor(private readonly repository: ConversationRepository) {}

  async build(
    accessToken: string,
    userId: string,
    sourceTurn: ConversationTurn,
  ): Promise<ReadonlyArray<ModelRouterContextMessage>> {
    const recentExchanges = await this.repository.findRecentAuthoritativeExchanges(
      accessToken,
      sourceTurn.session_id,
      userId,
      sourceTurn.id,
      RECENT_CONTEXT_EXCHANGE_LIMIT,
    );

    const authoritativeExchanges = recentExchanges
      .filter(({ userTurn, assistantTurn }) =>
        userTurn.id !== sourceTurn.id &&
        userTurn.session_id === sourceTurn.session_id &&
        assistantTurn.session_id === sourceTurn.session_id &&
        userTurn.role === 'USER' &&
        assistantTurn.role === 'ASSISTANT' &&
        userTurn.status === 'COMPLETED' &&
        assistantTurn.status === 'COMPLETED' &&
        assistantTurn.source_turn_id === userTurn.id,
      )
      .sort((left, right) =>
        left.userTurn.created_at.localeCompare(right.userTurn.created_at) ||
        left.userTurn.id.localeCompare(right.userTurn.id),
      )
      .slice(-RECENT_CONTEXT_EXCHANGE_LIMIT);

    return [
      ...authoritativeExchanges.flatMap(({ userTurn, assistantTurn }) => [
        { role: 'USER' as const, content: userTurn.content },
        { role: 'ASSISTANT' as const, content: assistantTurn.content },
      ]),
      { role: 'USER' as const, content: sourceTurn.content },
    ];
  }
}
