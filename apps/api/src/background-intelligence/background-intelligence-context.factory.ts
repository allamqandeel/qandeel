import { Injectable } from '@nestjs/common';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';
import { isValidRuntimeEventEnvelope } from '../runtime-events/runtime-event.types';
import {
  BACKGROUND_INTELLIGENCE_AUTHORITY,
} from './background-intelligence.types';

export class BackgroundIntelligenceExecutionContext {
  private constructor(
    readonly eventId: string,
    readonly userId: string,
    readonly sessionId: string,
    readonly sourceTurnId: string,
  ) { Object.freeze(this); }

  readonly authority = BACKGROUND_INTELLIGENCE_AUTHORITY;

  static fromValidatedEvent(event: RuntimeEventEnvelope): BackgroundIntelligenceExecutionContext | undefined {
    if (!isValidRuntimeEventEnvelope(event) || event.event_type !== 'ConversationTurnCompleted' || event.payload.terminal_status !== 'COMPLETED') return undefined;
    return new BackgroundIntelligenceExecutionContext(event.event_id, event.subject_user_id, event.subject_session_id, event.subject_turn_id);
  }
}

@Injectable()
export class BackgroundIntelligenceContextFactory {
  create(event: RuntimeEventEnvelope): BackgroundIntelligenceExecutionContext | undefined {
    return BackgroundIntelligenceExecutionContext.fromValidatedEvent(event);
  }
}
