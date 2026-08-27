import { ConversationRepository } from './conversation.repository';
import { SupabaseDataApiService } from './supabase-data-api.service';
import { SupabaseServiceRoleApiService } from './supabase-service-role-api.service';
import type { ConversationTurn } from './conversation.types';
import { CorrelationService } from '../observability/correlation.service';

const serviceApiMock = () => ({ rpc: jest.fn().mockResolvedValue([]) }) as unknown as jest.Mocked<SupabaseServiceRoleApiService>;

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
    const repository = new ConversationRepository(dataApi, serviceApiMock(), new CorrelationService());
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
    const repository = new ConversationRepository(dataApi, serviceApiMock(), new CorrelationService());
    await expect(repository.findRecentAuthoritativeExchanges('token', 'session-a', 'owner-a', 'current-a', 4)).resolves.toEqual([]);
  });
});

describe('ConversationRepository write authority', () => {
  it('creates a session through the narrow authenticated command, sending only the generated UUID', async () => {
    const session = {
      id: 'session-1', status: 'ACTIVE', channel: 'TEXT', created_at: 'now', updated_at: 'now',
      last_activity_at: 'now', closed_at: null,
    };
    const dataApi = { request: jest.fn().mockResolvedValue([session]) } as unknown as jest.Mocked<SupabaseDataApiService>;
    const repository = new ConversationRepository(dataApi, serviceApiMock(), new CorrelationService());

    await expect(repository.createSession('user-token', 'session-1')).resolves.toEqual(session);

    expect(dataApi.request).toHaveBeenCalledTimes(1);
    const [token, path, init] = dataApi.request.mock.calls[0];
    expect(token).toBe('user-token');
    // Never a direct table POST: session creation is the migration-0030 RPC.
    expect(path).toBe('rpc/create_conversation_session_v1');
    const body = JSON.parse((init as RequestInit).body as string);
    // The body carries exactly the server-generated UUID and nothing else — no
    // owner, lifecycle state, channel, or timestamp can be chosen by a client.
    expect(body).toEqual({ p_id: 'session-1' });
    expect(Object.keys(body)).toEqual(['p_id']);
  });

  it('creates a user turn through the narrow authenticated command and never supplies server-owned columns', async () => {
    const created: ConversationTurn = {
      id: 'turn-1', session_id: 'session-1', role: 'USER', status: 'RECEIVED', content: 'hello',
      processing_path: null, routing_reason: null, source_turn_id: null, idempotency_key: 'key-1',
      created_at: 'now', updated_at: 'now', completed_at: null,
    };
    const dataApi = { request: jest.fn().mockResolvedValue([created]) } as unknown as jest.Mocked<SupabaseDataApiService>;
    const repository = new ConversationRepository(dataApi, serviceApiMock(), new CorrelationService());

    await expect(repository.createTurn('user-token', { id: 'turn-1', sessionId: 'session-1', userId: 'user-1', content: 'hello', idempotencyKey: 'key-1' })).resolves.toEqual(created);

    expect(dataApi.request).toHaveBeenCalledTimes(1);
    const [token, path, init] = dataApi.request.mock.calls[0];
    expect(token).toBe('user-token');
    expect(path).toBe('rpc/create_user_conversation_turn');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ p_id: 'turn-1', p_session_id: 'session-1', p_content: 'hello', p_idempotency_key: 'key-1' });
    // The client can never supply role, status, user identity, or any server-owned column.
    expect(Object.keys(body)).not.toEqual(expect.arrayContaining(['role', 'status', 'user_id', 'p_user_id', 'processing_path', 'routing_reason', 'source_turn_id', 'completed_at']));
  });

  it('claims a turn through the server authority channel with no user token and validated routing', async () => {
    const dataApi = { request: jest.fn() } as unknown as jest.Mocked<SupabaseDataApiService>;
    const serviceApi = serviceApiMock();
    const repository = new ConversationRepository(dataApi, serviceApi, new CorrelationService());

    await repository.claimTurn('session', 'user', 'turn', { path: 'DEEP', reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT' });

    expect(dataApi.request).not.toHaveBeenCalled();
    expect(serviceApi.rpc).toHaveBeenCalledWith('claim_conversation_turn', {
      p_session_id: 'session', p_user_id: 'user', p_source_turn_id: 'turn',
      p_processing_path: 'DEEP', p_routing_reason: 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT',
    });
  });

  it('finalizes through the server authority channel carrying safety disposition and canonical metadata only', async () => {
    const dataApi = { request: jest.fn() } as unknown as jest.Mocked<SupabaseDataApiService>;
    const serviceApi = serviceApiMock();
    const correlation = new CorrelationService();
    const repository = new ConversationRepository(dataApi, serviceApi, correlation);

    await correlation.runRequest(() => correlation.withOrchestration(() => repository.finalizeTurn({
      sessionId: 'session', userId: 'user', sourceTurnId: 'turn', assistantTurnId: 'assistant', content: 'reply', safetyDisposition: 'ALLOW',
    })));

    expect(dataApi.request).not.toHaveBeenCalled();
    const [name, body] = serviceApi.rpc.mock.calls[0];
    expect(name).toBe('finalize_conversation_turn');
    expect(body).toMatchObject({
      p_session_id: 'session', p_user_id: 'user', p_source_turn_id: 'turn', p_assistant_turn_id: 'assistant',
      p_content: 'reply', p_safety_disposition: 'ALLOW',
      p_event_id: expect.stringMatching(/^[0-9a-f-]{36}$/), p_correlation_id: expect.stringMatching(/^[0-9a-f-]{36}$/), p_orchestration_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(JSON.stringify(body)).not.toMatch(/token|idempotency/);
  });

  it('fails a turn through the server authority channel with a fresh event id and no content or token', async () => {
    const dataApi = { request: jest.fn() } as unknown as jest.Mocked<SupabaseDataApiService>;
    const serviceApi = serviceApiMock();
    const correlation = new CorrelationService();
    const repository = new ConversationRepository(dataApi, serviceApi, correlation);

    await correlation.runRequest(() => correlation.withOrchestration(() => repository.failTurn('session', 'user', 'turn')));

    expect(dataApi.request).not.toHaveBeenCalled();
    const [name, body] = serviceApi.rpc.mock.calls[0];
    expect(name).toBe('fail_conversation_turn');
    expect(body).toMatchObject({
      p_session_id: 'session', p_user_id: 'user', p_source_turn_id: 'turn',
      p_event_id: expect.stringMatching(/^[0-9a-f-]{36}$/), p_correlation_id: expect.stringMatching(/^[0-9a-f-]{36}$/), p_orchestration_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(JSON.stringify(body)).not.toMatch(/content|idempotency|token/);
  });

  it('recovers an expired GENERATING turn through the server authority channel with canonical metadata and no user token or duration', async () => {
    const dataApi = { request: jest.fn() } as unknown as jest.Mocked<SupabaseDataApiService>;
    const serviceApi = serviceApiMock();
    const correlation = new CorrelationService();
    const repository = new ConversationRepository(dataApi, serviceApi, correlation);

    await correlation.runRequest(() => correlation.withOrchestration(() => repository.recoverExpiredGeneratingTurn('session', 'user', 'turn')));

    expect(dataApi.request).not.toHaveBeenCalled();
    const [name, body] = serviceApi.rpc.mock.calls[0];
    expect(name).toBe('recover_expired_generating_conversation_turn_v1');
    expect(body).toMatchObject({
      p_session_id: 'session', p_user_id: 'user', p_source_turn_id: 'turn',
      p_event_id: expect.stringMatching(/^[0-9a-f-]{36}$/), p_correlation_id: expect.stringMatching(/^[0-9a-f-]{36}$/), p_orchestration_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    // The application never chooses the lease policy and never forwards
    // content, tokens, or idempotency data to the recovery command.
    expect(JSON.stringify(body)).not.toMatch(/lease|duration|seconds|content|idempotency|token/);
  });

  it('returns undefined when recovery was a no-op on a live lease or terminal turn', async () => {
    const dataApi = { request: jest.fn() } as unknown as jest.Mocked<SupabaseDataApiService>;
    const repository = new ConversationRepository(dataApi, serviceApiMock(), new CorrelationService());
    await expect(repository.recoverExpiredGeneratingTurn('session', 'user', 'turn')).resolves.toBeUndefined();
  });

  it('cancels through the caller-authenticated channel, not the server authority channel', async () => {
    const cancelled: ConversationTurn = {
      id: 'turn', session_id: 'session', role: 'USER', status: 'CANCELLED', content: 'hi',
      processing_path: null, routing_reason: null, source_turn_id: null, idempotency_key: null,
      created_at: 'now', updated_at: 'now', completed_at: null,
    };
    const dataApi = { request: jest.fn().mockResolvedValue([cancelled]) } as unknown as jest.Mocked<SupabaseDataApiService>;
    const serviceApi = serviceApiMock();
    const repository = new ConversationRepository(dataApi, serviceApi, new CorrelationService());

    await expect(repository.cancelTurn('user-token', 'session', 'turn', 'user')).resolves.toEqual(cancelled);
    expect(serviceApi.rpc).not.toHaveBeenCalled();
    const [token, path] = dataApi.request.mock.calls[0];
    expect(token).toBe('user-token');
    expect(path).toBe('rpc/cancel_conversation_turn');
  });
});
