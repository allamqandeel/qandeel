import { Injectable } from '@nestjs/common';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';
import { BackgroundIntelligenceContextFactory } from './background-intelligence-context.factory';
import { BackgroundIntelligenceDataApiService } from './background-intelligence-data-api.service';
import type { BackgroundIntelligenceAuthorizationResult } from './background-intelligence.types';

@Injectable()
export class BackgroundIntelligenceAuthorityService {
  constructor(
    private readonly contexts: BackgroundIntelligenceContextFactory,
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
    return { outcome: 'AUTHORIZED', context: this.contexts.issueExecutionContext(ownership) };
  }
}
