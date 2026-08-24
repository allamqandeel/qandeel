import { Injectable } from '@nestjs/common';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';
import { isValidRuntimeEventEnvelope } from '../runtime-events/runtime-event.types';

const EVENT_CONTEXT_ISSUER = Symbol('BACKGROUND_INTELLIGENCE_EVENT_CONTEXT_ISSUER');
const issuedEventContexts = new WeakSet<object>();

interface BackgroundIntelligenceIdentifiers {
  readonly eventId: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly sourceTurnId: string;
}

export class BackgroundIntelligenceEventContext implements BackgroundIntelligenceIdentifiers {
  readonly stage = 'VALIDATED_RUNTIME_EVENT_V1' as const;

  constructor(
    readonly eventId: string,
    readonly userId: string,
    readonly sessionId: string,
    readonly sourceTurnId: string,
    issuer: symbol,
  ) {
    if (issuer !== EVENT_CONTEXT_ISSUER) throw new Error('BACKGROUND_INTELLIGENCE_EVENT_CONTEXT_REQUIRED');
    issuedEventContexts.add(this);
    Object.freeze(this);
  }
}

export function isBackgroundIntelligenceEventContext(value: unknown): value is BackgroundIntelligenceEventContext {
  return typeof value === 'object' && value !== null && issuedEventContexts.has(value);
}

@Injectable()
export class BackgroundIntelligenceContextFactory {
  create(event: RuntimeEventEnvelope): BackgroundIntelligenceEventContext | undefined {
    if (!isValidRuntimeEventEnvelope(event) || event.event_type !== 'ConversationTurnCompleted' || event.payload.terminal_status !== 'COMPLETED') return undefined;
    return new BackgroundIntelligenceEventContext(event.event_id, event.subject_user_id, event.subject_session_id, event.subject_turn_id, EVENT_CONTEXT_ISSUER);
  }
}
