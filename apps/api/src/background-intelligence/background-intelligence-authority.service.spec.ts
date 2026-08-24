import { BackgroundIntelligenceAuthorityService } from './background-intelligence-authority.service';
import type { BackgroundIntelligenceContextFactory } from './background-intelligence-context.factory';
import type { BackgroundIntelligenceDataApiService } from './background-intelligence-data-api.service';
import { BackgroundIntelligenceExecutionContext } from './background-intelligence-context.factory';
import type { BackgroundConversationSessionState, BackgroundConversationTurnState } from './background-intelligence-data-api.service';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';

const context = Object.create(BackgroundIntelligenceExecutionContext.prototype) as BackgroundIntelligenceExecutionContext;
Object.assign(context, { authority: 'BACKGROUND_INTELLIGENCE_V1', eventId: 'event', userId: 'user-a', sessionId: 'session-a', sourceTurnId: 'turn-a' });
const session: BackgroundConversationSessionState = { id: 'session-a', status: 'ACTIVE', channel: 'TEXT' };
const turn = (overrides: Partial<BackgroundConversationTurnState> = {}): BackgroundConversationTurnState => ({ id: 'turn-a', session_id: 'session-a', role: 'USER', status: 'COMPLETED', source_turn_id: null, ...overrides });
const assistant = turn({ id: 'assistant-a', role: 'ASSISTANT', source_turn_id: 'turn-a' });

describe('BackgroundIntelligenceAuthorityService', () => {
  const setup = () => {
    const contexts = { create: jest.fn().mockReturnValue(context) } as unknown as jest.Mocked<BackgroundIntelligenceContextFactory>;
    const dataApi = { findSession: jest.fn().mockResolvedValue(session), findSourceTurn: jest.fn().mockResolvedValue(turn()), findCompletedAssistant: jest.fn().mockResolvedValue(assistant) } as unknown as jest.Mocked<BackgroundIntelligenceDataApiService>;
    return { service: new BackgroundIntelligenceAuthorityService(contexts, dataApi), contexts, dataApi };
  };
  const event = {} as RuntimeEventEnvelope;
  it('authorizes only the canonical completed exchange', async () => expect((await setup().service.authorize(event))).toEqual({ outcome: 'AUTHORIZED', context }));
  it('rejects an invalid event before persistence', async () => { const s = setup(); s.contexts.create.mockReturnValue(undefined); await expect(s.service.authorize(event)).resolves.toEqual({ outcome: 'NOT_AUTHORIZED_INVALID_EVENT' }); expect(s.dataApi.findSession).not.toHaveBeenCalled(); });
  it.each([
    ['missing session', 'session', undefined, 'NOT_AUTHORIZED_OWNER_MISMATCH'],
    ['closed session', 'session', { ...session, status: 'CLOSED' }, 'NOT_AUTHORIZED_NONCANONICAL_TURN'],
    ['cross-user source id', 'source', undefined, 'NOT_AUTHORIZED_OWNER_MISMATCH'],
    ['wrong source role', 'source', turn({ role: 'ASSISTANT' }), 'NOT_AUTHORIZED_NONCANONICAL_TURN'],
    ['non-completed source', 'source', turn({ status: 'FAILED' }), 'NOT_AUTHORIZED_NONCANONICAL_TURN'],
    ['wrong source session', 'source', turn({ session_id: 'session-b' }), 'NOT_AUTHORIZED_NONCANONICAL_TURN'],
    ['missing assistant', 'assistant', undefined, 'NOT_AUTHORIZED_NONCANONICAL_TURN'],
    ['noncanonical assistant', 'assistant', { ...assistant, source_turn_id: 'turn-b' }, 'NOT_AUTHORIZED_NONCANONICAL_TURN'],
  ])('rejects %s', async (_name, target, value, outcome) => { const s = setup(); if (target === 'session') s.dataApi.findSession.mockResolvedValue(value as BackgroundConversationSessionState | undefined); if (target === 'source') s.dataApi.findSourceTurn.mockResolvedValue(value as BackgroundConversationTurnState | undefined); if (target === 'assistant') s.dataApi.findCompletedAssistant.mockResolvedValue(value as BackgroundConversationTurnState | undefined); await expect(s.service.authorize(event)).resolves.toEqual({ outcome }); });
});
