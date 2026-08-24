import { BackgroundIntelligenceDataApiService } from './background-intelligence-data-api.service';
import { BackgroundIntelligenceContextFactory, type BackgroundIntelligenceExecutionContext } from './background-intelligence-context.factory';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';

const context = new BackgroundIntelligenceContextFactory().create({ event_id: '10000000-0000-4000-8000-000000000001', event_type: 'ConversationTurnCompleted', event_version: '1.0', occurred_at: '2026-01-01T00:00:00Z', producer: 'conversation-service', subject_user_id: '10000000-0000-4000-8000-000000000002', subject_session_id: '10000000-0000-4000-8000-000000000003', subject_turn_id: '10000000-0000-4000-8000-000000000004', correlation_id: null, causation_id: null, classification: 'SENSITIVE', schema_ref: 'qandeel.runtime.conversation-turn-completed.v1', payload: { user_id: '10000000-0000-4000-8000-000000000002', session_id: '10000000-0000-4000-8000-000000000003', source_turn_id: '10000000-0000-4000-8000-000000000004', terminal_status: 'COMPLETED', processing_path: 'FAST', routing_reason: 'FAST_DEFAULT', orchestration_id: null }, contains_content: false, retention_class: 'OPERATIONAL_EVENT_V1' } as RuntimeEventEnvelope) as BackgroundIntelligenceExecutionContext;

describe('BackgroundIntelligenceDataApiService', () => {
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  beforeEach(() => { process.env.SUPABASE_URL = 'https://database.invalid'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'SENTINEL_SERVICE_ROLE'; jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response); });
  afterEach(() => { jest.restoreAllMocks(); if (saved.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved.url; if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key; });
  it('adds explicit owner, session, and source predicates to canonical reads', async () => {
    const service = new BackgroundIntelligenceDataApiService();
    await service.findSession(context); await service.findSourceTurn(context); await service.findCompletedAssistant(context);
    for (const [url] of (fetch as jest.Mock).mock.calls) expect(new URL(url).searchParams.get('user_id')).toBe(`eq.${context.userId}`);
    expect(new URL((fetch as jest.Mock).mock.calls[1][0]).searchParams).toMatchObject(expect.any(URLSearchParams));
    expect(new URL((fetch as jest.Mock).mock.calls[1][0]).searchParams.get('session_id')).toBe(`eq.${context.sessionId}`);
    expect(new URL((fetch as jest.Mock).mock.calls[1][0]).searchParams.get('id')).toBe(`eq.${context.sourceTurnId}`);
    expect(new URL((fetch as jest.Mock).mock.calls[2][0]).searchParams.get('source_turn_id')).toBe(`eq.${context.sourceTurnId}`);
  });
  it('forces the context owner on the representative Memory write', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 'memory-a' }] } as Response);
    const service = new BackgroundIntelligenceDataApiService();
    await service.createMemory(context, { id: 'memory-a', type: 'GOAL', content: 'private', source: 'USER_STATED', confidence: 1, importance: 1, status: 'ACTIVE', user_id: 'user-b' } as never);
    const init = (fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toMatchObject({ id: 'memory-a', user_id: context.userId, scope: 'USER' });
    expect(JSON.parse(init.body as string).user_id).not.toBe('user-b');
  });
  it('encapsulates the service-role credential and emits bounded failures', async () => {
    const service = new BackgroundIntelligenceDataApiService();
    expect(service.findSession.length).toBe(1);
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('raw secret'));
    await expect(service.findSession(context)).rejects.toThrow('BACKGROUND_INTELLIGENCE_DATABASE_UNAVAILABLE');
    expect(JSON.stringify(context)).not.toContain('SENTINEL_SERVICE_ROLE');
  });
  it('rejects a structurally similar context that did not pass the factory', async () => {
    const service = new BackgroundIntelligenceDataApiService();
    await expect(service.findSession({ ...context } as BackgroundIntelligenceExecutionContext)).rejects.toThrow('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');
    expect(fetch).not.toHaveBeenCalled();
  });
});
