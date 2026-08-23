import { ConversationRepository } from './conversation.repository';
import { SupabaseDataApiService } from './supabase-data-api.service';
import type { ConversationTurn } from './conversation.types';
import { CorrelationService } from '../observability/correlation.service';

describe('ConversationRepository context history', () => {
  const row = (overrides: Partial<ConversationTurn>): ConversationTurn => ({
    id: 'assistant-a', session_id: 'session-a', role: 'ASSISTANT', status: 'COMPLETED', content: 'response',
    processing_path: 'FAST', routing_reason: 'FAST_DEFAULT', source_turn_id: 'user-a', idempotency_key: null,
    created_at: '2026-01-02T00:00:00.000Z', updated_at: 'now', completed_at: 'now', ...overrides,
  });

  it('bounds authoritative assistants then loads their source users under the same scope', async () => {
    const assistant = row({});
    const user = row({ id: 'user-a', role: 'USER', content: 'input', source_turn_id: null, created_at: '2026-01-01T00:00:00.000Z' });
    const dataApi = { request: jest.fn().mockResolvedValueOnce([assistant]).mockResolvedValueOnce([user]) } as unknown as jest.Mocked<SupabaseDataApiService>;
    const repository = new ConversationRepository(dataApi,new CorrelationService());
    await expect(repository.findRecentAuthoritativeExchanges('caller-token', 'session-a', 'owner-a', 'current-a', 4))
      .resolves.toEqual([{ userTurn: user, assistantTurn: assistant }]);

    expect(dataApi.request).toHaveBeenCalledTimes(2);
    for (const [token, path] of dataApi.request.mock.calls) {
      expect(token).toBe('caller-token');
      const query = new URL(`https://local/${path}`).searchParams;
      expect(query.get('session_id')).toBe('eq.session-a');
      expect(query.get('user_id')).toBe('eq.owner-a');
      expect(query.get('status')).toBe('eq.COMPLETED');
    }
    const assistantQuery = new URL(`https://local/${dataApi.request.mock.calls[0][1]}`).searchParams;
    expect(assistantQuery.get('source_turn_id')).toBe('not.eq.current-a');
    expect(assistantQuery.get('role')).toBe('eq.ASSISTANT');
    expect(assistantQuery.get('order')).toBe('created_at.desc,id.desc');
    expect(assistantQuery.get('limit')).toBe('4');
    const userQuery = new URL(`https://local/${dataApi.request.mock.calls[1][1]}`).searchParams;
    expect(userQuery.get('id')).toBe('in.(user-a)');
    expect(userQuery.get('role')).toBe('eq.USER');
  });

  it('drops an assistant when its authoritative source USER is unavailable', async () => {
    const dataApi = { request: jest.fn().mockResolvedValueOnce([row({})]).mockResolvedValueOnce([]) } as unknown as jest.Mocked<SupabaseDataApiService>;
    const repository = new ConversationRepository(dataApi,new CorrelationService());
    await expect(repository.findRecentAuthoritativeExchanges('token', 'session-a', 'owner-a', 'current-a', 4)).resolves.toEqual([]);
  });

  it('passes a fresh event ID and only canonical request/orchestration correlation to terminal RPCs',async()=>{const dataApi={request:jest.fn().mockResolvedValue([])}as unknown as jest.Mocked<SupabaseDataApiService>,correlation=new CorrelationService(),repository=new ConversationRepository(dataApi,correlation);await correlation.runRequest(()=>correlation.withOrchestration(()=>repository.failTurn('token','session','user','turn')));const body=JSON.parse((dataApi.request.mock.calls[0][2] as RequestInit).body as string);expect(dataApi.request.mock.calls[0][1]).toBe('rpc/fail_conversation_turn');expect(body).toMatchObject({p_session_id:'session',p_user_id:'user',p_source_turn_id:'turn',p_event_id:expect.stringMatching(/^[0-9a-f-]{36}$/),p_correlation_id:expect.stringMatching(/^[0-9a-f-]{36}$/),p_orchestration_id:expect.stringMatching(/^[0-9a-f-]{36}$/)});expect(JSON.stringify(body)).not.toMatch(/content|idempotency|token/);});
});
