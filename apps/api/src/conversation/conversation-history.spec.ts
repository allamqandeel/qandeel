import { BadRequestException, NotFoundException, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ConversationController } from './conversation.controller';
import { ConversationRepository } from './conversation.repository';
import { ConversationService } from './conversation.service';
import type { ConversationSession, ConversationTurn } from './conversation.types';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { ConversationSemanticEstablishmentService } from '../live-focus/conversation-semantic-establishment.service';
import { CorrelationService } from '../observability/correlation.service';
import { SupabaseDataApiService } from './supabase-data-api.service';
import { SupabaseServiceRoleApiService } from './supabase-service-role-api.service';

// W1A-01 (E2E-B-04) — GET /conversation/sessions/:sessionId/turns.
//
// The authoritative conversation-so-far is RAW Conversation history: committed user turns and their
// QANDEEL replies, owner-scoped, ordered, paged. It is a pure read — it can never admit, claim,
// regenerate or terminalize a turn — and it keeps a committed user turn whose reply failed.

const SESSION_ID = '4f1c9a52-7c1e-4d4b-9a51-8c2d1e3f4a50';
const USER_ID = 'owner-a';
const TOKEN = 'caller-token';

const session: ConversationSession = {
  id: SESSION_ID, status: 'ACTIVE', channel: 'TEXT', created_at: 'now', updated_at: 'now', last_activity_at: 'now', closed_at: null,
};

let sequence = 0;
function turn(overrides: Partial<ConversationTurn>): ConversationTurn {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    session_id: SESSION_ID, role: 'USER', status: 'COMPLETED', content: `words ${sequence}`,
    processing_path: 'FAST', routing_reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT', source_turn_id: null,
    idempotency_key: `key-${sequence}`, created_at: `2026-09-28T10:00:${String(sequence).padStart(2, '0')}.000Z`,
    updated_at: 'now', completed_at: 'now', ...overrides,
  };
}

describe('ConversationService.listTurns — the authoritative conversation-so-far', () => {
  let repository: jest.Mocked<ConversationRepository>;
  let orchestrator: jest.Mocked<ConversationOrchestratorService>;
  let service: ConversationService;

  beforeEach(() => {
    sequence = 0;
    repository = {
      findSession: jest.fn().mockResolvedValue(session),
      findTurn: jest.fn(),
      findUserTurnsPage: jest.fn().mockResolvedValue([]),
      findCompletedAssistantsForSources: jest.fn().mockResolvedValue([]),
      createTurn: jest.fn(), claimTurn: jest.fn(), finalizeTurn: jest.fn(), failTurn: jest.fn(),
      recoverExpiredGeneratingTurn: jest.fn(), cancelTurn: jest.fn(), findTurnByIdempotencyKey: jest.fn(),
    } as unknown as jest.Mocked<ConversationRepository>;
    orchestrator = { orchestrate: jest.fn() } as unknown as jest.Mocked<ConversationOrchestratorService>;
    const semantic = { establish: jest.fn() } as unknown as jest.Mocked<ConversationSemanticEstablishmentService>;
    service = new ConversationService(repository, orchestrator, new CorrelationService(), semantic);
  });

  it('returns completed exchanges, a committed turn whose reply FAILED, and a PENDING turn — oldest to newest', async () => {
    const first = turn({ content: 'السلام عليكم' });
    const failed = turn({ status: 'FAILED', content: 'second words', completed_at: null });
    const pending = turn({ status: 'GENERATING', content: 'third words', completed_at: null });
    const reply = turn({ role: 'ASSISTANT', source_turn_id: first.id, content: 'وعليكم السلام', idempotency_key: null });
    // The repository answers newest first, exactly as the index orders it.
    repository.findUserTurnsPage.mockResolvedValue([pending, failed, first]);
    repository.findCompletedAssistantsForSources.mockResolvedValue([reply]);

    const page = await service.listTurns(USER_ID, TOKEN, SESSION_ID, {});

    expect(page.hasOlder).toBe(false);
    expect(page.exchanges.map((exchange) => [exchange.userTurn.id, exchange.replyState])).toEqual([
      [first.id, 'COMPLETED'],
      [failed.id, 'FAILED'],
      [pending.id, 'PENDING'],
    ]);
    expect(page.exchanges[0].assistantTurn).toEqual({ id: reply.id, content: 'وعليكم السلام', createdAt: reply.created_at });
    // The failed turn keeps the user's committed words and carries no invented reply.
    expect(page.exchanges[1].userTurn.content).toBe('second words');
    expect(page.exchanges[1].assistantTurn).toBeNull();
    // The caller's own submission identity is returned, so an ambiguous send can be reconciled by reading.
    expect(page.exchanges[1].userTurn.idempotencyKey).toBe(failed.idempotency_key);
  });

  it('exposes only the fields the Conversation needs — never routing, lifecycle or server-owned internals', async () => {
    const first = turn({});
    repository.findUserTurnsPage.mockResolvedValue([first]);
    repository.findCompletedAssistantsForSources.mockResolvedValue([turn({ role: 'ASSISTANT', source_turn_id: first.id })]);
    const page = await service.listTurns(USER_ID, TOKEN, SESSION_ID, {});
    expect(Object.keys(page)).toEqual(['exchanges', 'hasOlder']);
    expect(Object.keys(page.exchanges[0])).toEqual(['userTurn', 'replyState', 'assistantTurn']);
    expect(Object.keys(page.exchanges[0].userTurn)).toEqual(['id', 'content', 'idempotencyKey', 'createdAt']);
    expect(Object.keys(page.exchanges[0].assistantTurn!)).toEqual(['id', 'content', 'createdAt']);
    const serialized = JSON.stringify(page);
    for (const internal of ['processing_path', 'routing_reason', 'session_id', 'status', 'updated_at', 'completed_at', 'user_id']) {
      expect(serialized).not.toContain(internal);
    }
  });

  it('is a pure read: it never reaches the orchestrator or any write, claim, fail or recovery command', async () => {
    repository.findUserTurnsPage.mockResolvedValue([turn({ status: 'GENERATING' }), turn({ status: 'FAILED' })]);
    await service.listTurns(USER_ID, TOKEN, SESSION_ID, {});
    expect(orchestrator.orchestrate).not.toHaveBeenCalled();
    for (const write of ['createTurn', 'claimTurn', 'finalizeTurn', 'failTurn', 'recoverExpiredGeneratingTurn', 'cancelTurn'] as const) {
      expect(repository[write]).not.toHaveBeenCalled();
    }
  });

  it('is owner-scoped: a Session the caller does not own is 404 and nothing is read', async () => {
    repository.findSession.mockResolvedValue(undefined);
    await expect(service.listTurns('someone-else', TOKEN, SESSION_ID, {})).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findSession).toHaveBeenCalledWith(TOKEN, SESSION_ID, 'someone-else');
    expect(repository.findUserTurnsPage).not.toHaveBeenCalled();
    expect(repository.findCompletedAssistantsForSources).not.toHaveBeenCalled();
  });

  it('every read carries the caller token and the caller identity, never a service-role channel', async () => {
    const first = turn({});
    repository.findUserTurnsPage.mockResolvedValue([first]);
    await service.listTurns(USER_ID, TOKEN, SESSION_ID, {});
    expect(repository.findUserTurnsPage).toHaveBeenCalledWith(TOKEN, SESSION_ID, USER_ID, 51, undefined);
    expect(repository.findCompletedAssistantsForSources).toHaveBeenCalledWith(TOKEN, SESSION_ID, USER_ID, [first.id]);
  });

  it('pages backwards: one extra row decides hasOlder, and the cursor is the anchor turn’s own (created_at, id)', async () => {
    const turns = [turn({}), turn({}), turn({})];
    repository.findUserTurnsPage.mockResolvedValue([...turns].reverse());
    const page = await service.listTurns(USER_ID, TOKEN, SESSION_ID, { limit: '2' });
    expect(page.hasOlder).toBe(true);
    // The two NEWEST, oldest first; the third row only proved that older turns exist.
    expect(page.exchanges.map((exchange) => exchange.userTurn.id)).toEqual([turns[1].id, turns[2].id]);

    const anchor = turns[1];
    repository.findTurn.mockResolvedValue(anchor);
    repository.findUserTurnsPage.mockResolvedValue([turns[0]]);
    const older = await service.listTurns(USER_ID, TOKEN, SESSION_ID, { limit: '2', before: anchor.id });
    expect(repository.findTurn).toHaveBeenCalledWith(TOKEN, SESSION_ID, USER_ID, anchor.id);
    expect(repository.findUserTurnsPage).toHaveBeenLastCalledWith(TOKEN, SESSION_ID, USER_ID, 3, { createdAt: anchor.created_at, id: anchor.id });
    expect(older.hasOlder).toBe(false);
    expect(older.exchanges.map((exchange) => exchange.userTurn.id)).toEqual([turns[0].id]);
  });

  it('refuses a cursor that is not a user turn of this Session', async () => {
    const assistant = turn({ role: 'ASSISTANT' });
    repository.findTurn.mockResolvedValue(assistant);
    await expect(service.listTurns(USER_ID, TOKEN, SESSION_ID, { before: assistant.id })).rejects.toBeInstanceOf(BadRequestException);
    repository.findTurn.mockResolvedValue(undefined);
    await expect(service.listTurns(USER_ID, TOKEN, SESSION_ID, { before: assistant.id })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findUserTurnsPage).not.toHaveBeenCalled();
  });

  it.each([
    [{ limit: '0' }], [{ limit: '101' }], [{ limit: '1.5' }], [{ limit: '-1' }], [{ limit: 'ten' }], [{ limit: ['1', '2'] }],
    [{ before: 'not-a-uuid' }], [{ before: ['a'] }], [{ order: 'asc' }], [{ userId: 'someone' }],
  ])('rejects the malformed or unsupported query %j before any read', async (query) => {
    await expect(service.listTurns(USER_ID, TOKEN, SESSION_ID, query)).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findSession).not.toHaveBeenCalled();
    expect(repository.findUserTurnsPage).not.toHaveBeenCalled();
  });

  it('an empty Session is an empty history, not an error and not an invented opener', async () => {
    await expect(service.listTurns(USER_ID, TOKEN, SESSION_ID, {})).resolves.toEqual({ exchanges: [], hasOlder: false });
    expect(repository.findCompletedAssistantsForSources).toHaveBeenCalledWith(TOKEN, SESSION_ID, USER_ID, []);
  });

  it('a retried send never duplicates: one committed turn per idempotency key is one exchange', async () => {
    // Replaying the SAME key finds the SAME turn, so history holds it exactly once whatever happened on the wire.
    const committed = turn({ idempotency_key: 'w1a-key' });
    repository.findUserTurnsPage.mockResolvedValue([committed]);
    const page = await service.listTurns(USER_ID, TOKEN, SESSION_ID, {});
    expect(page.exchanges.filter((exchange) => exchange.userTurn.idempotencyKey === 'w1a-key')).toHaveLength(1);
  });
});

describe('ConversationRepository — the history reads', () => {
  it('reads one page of committed USER turns, newest first, under the caller token and owner filter', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<SupabaseDataApiService>;
    const serviceApi = { rpc: jest.fn() } as unknown as jest.Mocked<SupabaseServiceRoleApiService>;
    const repository = new ConversationRepository(dataApi, serviceApi, new CorrelationService());

    await repository.findUserTurnsPage(TOKEN, SESSION_ID, USER_ID, 51);
    const [token, path] = dataApi.request.mock.calls[0];
    expect(token).toBe(TOKEN);
    const query = new URL(`https://local/${path}`).searchParams;
    expect(new URL(`https://local/${path}`).pathname).toBe('/conversation_turns');
    expect(query.get('session_id')).toBe(`eq.${SESSION_ID}`);
    expect(query.get('user_id')).toBe(`eq.${USER_ID}`);
    expect(query.get('role')).toBe('eq.USER');
    expect(query.get('status')).toBe('in.(RECEIVED,GENERATING,COMPLETED,FAILED)');
    expect(query.get('order')).toBe('created_at.desc,id.desc');
    expect(query.get('limit')).toBe('51');
    expect(query.get('or')).toBeNull();
    expect(query.get('select')).toContain('idempotency_key');
    expect(serviceApi.rpc).not.toHaveBeenCalled();
  });

  it('applies the exclusive (created_at, id) cursor with the timestamp quoted', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<SupabaseDataApiService>;
    const repository = new ConversationRepository(dataApi, { rpc: jest.fn() } as never, new CorrelationService());
    await repository.findUserTurnsPage(TOKEN, SESSION_ID, USER_ID, 3, { createdAt: '2026-09-28T10:00:02.123456+00:00', id: 'turn-b' });
    const query = new URL(`https://local/${dataApi.request.mock.calls[0][1]}`).searchParams;
    expect(query.get('or')).toBe('(created_at.lt."2026-09-28T10:00:02.123456+00:00",and(created_at.eq."2026-09-28T10:00:02.123456+00:00",id.lt.turn-b))');
  });

  it('reads only COMPLETED replies of the named source turns, and nothing at all for none', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<SupabaseDataApiService>;
    const repository = new ConversationRepository(dataApi, { rpc: jest.fn() } as never, new CorrelationService());
    await expect(repository.findCompletedAssistantsForSources(TOKEN, SESSION_ID, USER_ID, [])).resolves.toEqual([]);
    expect(dataApi.request).not.toHaveBeenCalled();
    await repository.findCompletedAssistantsForSources(TOKEN, SESSION_ID, USER_ID, ['a', 'b']);
    const query = new URL(`https://local/${dataApi.request.mock.calls[0][1]}`).searchParams;
    expect(query.get('role')).toBe('eq.ASSISTANT');
    expect(query.get('status')).toBe('eq.COMPLETED');
    expect(query.get('source_turn_id')).toBe('in.(a,b)');
    expect(query.get('user_id')).toBe(`eq.${USER_ID}`);
  });
});

describe('ConversationController — the history route', () => {
  it('is a GET on sessions/:sessionId/turns, under the controller-wide Supabase guard', () => {
    const handler = ConversationController.prototype.listTurns;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('sessions/:sessionId/turns');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, ConversationController)).toBe('conversation');
    expect(Reflect.getMetadata(GUARDS_METADATA, ConversationController)).toContain(SupabaseAuthGuard);
  });

  it('delegates with the authenticated identity only — a query cannot choose whose history is read', async () => {
    const conversations = { listTurns: jest.fn().mockResolvedValue({ exchanges: [], hasOlder: false }) } as unknown as jest.Mocked<ConversationService>;
    const controller = new ConversationController(conversations);
    const request = { authenticatedUser: { userId: USER_ID, accessToken: TOKEN } } as never;
    await controller.listTurns(request, SESSION_ID, { limit: '5' });
    expect(conversations.listTurns).toHaveBeenCalledWith(USER_ID, TOKEN, SESSION_ID, { limit: '5' });
  });
});
