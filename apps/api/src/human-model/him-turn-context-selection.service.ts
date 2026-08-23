import { Injectable } from '@nestjs/common';
import type { ConversationTurn, TurnStatus } from '../conversation/conversation.types';
import type { HimTurnContextSelection } from './him-turn-context-selection.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TURN_STATUSES = new Set<TurnStatus>([
  'RECEIVED', 'VALIDATED', 'CONTEXT_BUILDING', 'PROCESSING', 'GENERATING',
  'STREAMING', 'COMPLETED', 'CANCELLED', 'FAILED', 'SUPERSEDED',
]);

@Injectable()
export class HimTurnContextSelectionService {
  select(turn: ConversationTurn): HimTurnContextSelection {
    if (!turn || typeof turn !== 'object' || turn.role !== 'USER' || !TURN_STATUSES.has(turn.status))
      throw new Error('INTEGRITY_FAILURE');
    if (!UUID.test(turn.id) || !UUID.test(turn.session_id)) throw new Error('INTEGRITY_FAILURE');

    return {
      contractVersion: 1,
      selectionState: 'SELECTED',
      source: 'AUTHORITATIVE_CONVERSATION_TURN',
      sourceTurnId: turn.id,
      contextKind: 'CONVERSATION_SESSION',
      contextId: turn.session_id,
      selectionReason: 'AUTHORITATIVE_SESSION_BINDING',
    };
  }
}
