import { Injectable } from '@nestjs/common';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';
import { isValidRuntimeEventEnvelope } from '../runtime-events/runtime-event.types';
import { BACKGROUND_INTELLIGENCE_AUTHORITY } from './background-intelligence.types';

const EVENT_CONTEXT_ISSUER = Symbol('BACKGROUND_INTELLIGENCE_EVENT_CONTEXT_ISSUER');
const EXECUTION_CONTEXT_ISSUER = Symbol('BACKGROUND_INTELLIGENCE_EXECUTION_CONTEXT_ISSUER');
const issuedEventContexts = new WeakSet<object>();
const issuedExecutionContexts = new WeakSet<object>();

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

export class BackgroundIntelligenceExecutionContext implements BackgroundIntelligenceIdentifiers {
  readonly authority = BACKGROUND_INTELLIGENCE_AUTHORITY;
  readonly eventId: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly sourceTurnId: string;

  constructor(context: BackgroundIntelligenceEventContext, issuer: symbol) {
    if (issuer !== EXECUTION_CONTEXT_ISSUER || !isBackgroundIntelligenceEventContext(context)) throw new Error('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');
    this.eventId = context.eventId;
    this.userId = context.userId;
    this.sessionId = context.sessionId;
    this.sourceTurnId = context.sourceTurnId;
    issuedExecutionContexts.add(this);
    Object.freeze(this);
  }
}

export function isBackgroundIntelligenceEventContext(value: unknown): value is BackgroundIntelligenceEventContext {
  return typeof value === 'object' && value !== null && issuedEventContexts.has(value);
}

export function isBackgroundIntelligenceExecutionContext(value: unknown): value is BackgroundIntelligenceExecutionContext {
  return typeof value === 'object' && value !== null && issuedExecutionContexts.has(value);
}

@Injectable()
export class BackgroundIntelligenceContextFactory {
  create(event: RuntimeEventEnvelope): BackgroundIntelligenceEventContext | undefined {
    if (!isValidRuntimeEventEnvelope(event) || event.event_type !== 'ConversationTurnCompleted' || event.payload.terminal_status !== 'COMPLETED') return undefined;
    return new BackgroundIntelligenceEventContext(event.event_id, event.subject_user_id, event.subject_session_id, event.subject_turn_id, EVENT_CONTEXT_ISSUER);
  }

  issueExecutionContext(context: BackgroundIntelligenceEventContext): BackgroundIntelligenceExecutionContext {
    return new BackgroundIntelligenceExecutionContext(context, EXECUTION_CONTEXT_ISSUER);
  }
}
