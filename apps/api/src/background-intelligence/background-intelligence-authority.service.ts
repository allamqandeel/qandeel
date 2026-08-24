import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';
import { BackgroundIntelligenceContextFactory, type BackgroundIntelligenceEventContext, isBackgroundIntelligenceEventContext } from './background-intelligence-context.factory';
import type { BackgroundIntelligenceDataApiService } from './background-intelligence-data-api.service';
import { BACKGROUND_INTELLIGENCE_AUTHORITY, BACKGROUND_INTELLIGENCE_DATA_API, type BackgroundIntelligenceAuthorizationResult } from './background-intelligence.types';

const EXECUTION_CONTEXT_ISSUER = Symbol('BACKGROUND_INTELLIGENCE_EXECUTION_CONTEXT_ISSUER');
const issuedExecutionContexts = new WeakSet<object>();

export class BackgroundIntelligenceExecutionContext {
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

export function isBackgroundIntelligenceExecutionContext(value: unknown): value is BackgroundIntelligenceExecutionContext {
  return typeof value === 'object' && value !== null && issuedExecutionContexts.has(value);
}

function issueExecutionContext(context: BackgroundIntelligenceEventContext): BackgroundIntelligenceExecutionContext {
  return new BackgroundIntelligenceExecutionContext(context, EXECUTION_CONTEXT_ISSUER);
}

@Injectable()
export class BackgroundIntelligenceAuthorityService {
  constructor(
    private readonly contexts: BackgroundIntelligenceContextFactory,
    @Inject(BACKGROUND_INTELLIGENCE_DATA_API)
    private readonly dataApi: BackgroundIntelligenceDataApiService,
  ) {}

  async authorize(event: RuntimeEventEnvelope): Promise<BackgroundIntelligenceAuthorizationResult> {
    const ownership = this.contexts.create(event);
    if (!ownership) return { outcome: 'NOT_AUTHORIZED_INVALID_EVENT' };
    const session = await this.dataApi.findSession(ownership);
    if (!session) return { outcome: 'NOT_AUTHORIZED_OWNER_MISMATCH' };
    if ((session.status !== 'ACTIVE' && session.status !== 'IDLE') || session.channel !== 'TEXT') return { outcome: 'NOT_AUTHORIZED_NONCANONICAL_TURN' };
    const source = await this.dataApi.findSourceTurn(ownership);
    if (!source) return { outcome: 'NOT_AUTHORIZED_OWNER_MISMATCH' };
    if (source.role !== 'USER' || source.status !== 'COMPLETED' || source.session_id !== ownership.sessionId) return { outcome: 'NOT_AUTHORIZED_NONCANONICAL_TURN' };
    const assistant = await this.dataApi.findCompletedAssistant(ownership);
    if (!assistant) return { outcome: 'NOT_AUTHORIZED_NONCANONICAL_TURN' };
    if (assistant.role !== 'ASSISTANT' || assistant.status !== 'COMPLETED' || assistant.session_id !== ownership.sessionId || assistant.source_turn_id !== ownership.sourceTurnId) return { outcome: 'NOT_AUTHORIZED_NONCANONICAL_TURN' };
    return { outcome: 'AUTHORIZED', context: issueExecutionContext(ownership) };
  }
}
