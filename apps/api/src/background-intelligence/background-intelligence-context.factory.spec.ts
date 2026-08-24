import { isBackgroundIntelligenceExecutionContext } from './background-intelligence-authority.service';
import { BackgroundIntelligenceContextFactory } from './background-intelligence-context.factory';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';

const IDS = {
  event: '10000000-0000-4000-8000-000000000001', user: '10000000-0000-4000-8000-000000000002',
  session: '10000000-0000-4000-8000-000000000003', turn: '10000000-0000-4000-8000-000000000004',
};
const completedEvent = (overrides: Partial<RuntimeEventEnvelope> = {}): RuntimeEventEnvelope => ({
  event_id: IDS.event, event_type: 'ConversationTurnCompleted', event_version: '1.0', occurred_at: '2026-01-01T00:00:00Z',
  producer: 'conversation-service', subject_user_id: IDS.user, subject_session_id: IDS.session, subject_turn_id: IDS.turn,
  correlation_id: null, causation_id: null, classification: 'SENSITIVE', schema_ref: 'qandeel.runtime.conversation-turn-completed.v1',
  payload: { user_id: IDS.user, session_id: IDS.session, source_turn_id: IDS.turn, terminal_status: 'COMPLETED', processing_path: 'FAST', routing_reason: 'FAST_DEFAULT', orchestration_id: null },
  contains_content: false, retention_class: 'OPERATIONAL_EVENT_V1', ...overrides,
});

describe('BackgroundIntelligenceContextFactory', () => {
  const factory = new BackgroundIntelligenceContextFactory();
  it('exposes no execution-authority issuance method', () => {
    expect((factory as unknown as Record<string, unknown>).issueExecutionContext).toBeUndefined();
  });
  it('creates only the frozen pre-authorization identity from a valid completed event', () => {
    const context = factory.create(completedEvent());
    expect(context).toEqual({ stage: 'VALIDATED_RUNTIME_EVENT_V1', eventId: IDS.event, userId: IDS.user, sessionId: IDS.session, sourceTurnId: IDS.turn });
    expect(isBackgroundIntelligenceExecutionContext(context)).toBe(false);
    expect(Object.isFrozen(context)).toBe(true);
    expect(JSON.stringify(context)).not.toMatch(/jwt|token|key|content|credential/i);
  });
  it.each([
    ['wrong type', completedEvent({ event_type: 'ConversationTurnFailed', schema_ref: 'qandeel.runtime.conversation-turn-failed.v1', payload: { ...completedEvent().payload, terminal_status: 'FAILED' } })],
    ['cancelled type', completedEvent({ event_type: 'ConversationTurnCancelled', schema_ref: 'qandeel.runtime.conversation-turn-cancelled.v1', payload: { ...completedEvent().payload, terminal_status: 'CANCELLED' } })],
    ['wrong version', completedEvent({ event_version: '2.0' as '1.0' })],
    ['wrong schema', completedEvent({ schema_ref: 'wrong' })],
    ['non-completed', completedEvent({ payload: { ...completedEvent().payload, terminal_status: 'FAILED' } })],
    ['user mismatch', completedEvent({ subject_user_id: '20000000-0000-4000-8000-000000000002' })],
    ['session mismatch', completedEvent({ subject_session_id: '20000000-0000-4000-8000-000000000003' })],
    ['subject mismatch', completedEvent({ subject_turn_id: '20000000-0000-4000-8000-000000000004' })],
    ['content-bearing object', { ...completedEvent(), contains_content: true, content: 'forbidden' } as unknown as RuntimeEventEnvelope],
  ])('rejects %s', (_name, event) => expect(factory.create(event)).toBeUndefined());
});
