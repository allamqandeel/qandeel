// W3-MEGA-M (E2E-D-13) — conversational Memory control through the REAL production turn route.
//
// POST /conversation/sessions/:sessionId/turns is ConversationService.createTurn: the real service, the real
// orchestrator, the real Context Builder and Safety gate, the real Memory-control boundary and the real Conversation
// and Memory-control repositories. Only the transport is replaced — by an in-memory canonical store that applies
// row-level security by token and mirrors the SQL commands' semantics (migration 0128's atomic command included; the
// SQL itself is proven against real PostgreSQL by database/verify-migration-0128.mjs). Every orchestrator lane that
// is not on the Memory path is a proxy that throws when touched, so these turns provably reach no Human Intelligence,
// Memory retrieval, Hypothesis, Question or provider work.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { ConversationRepository } from './conversation.repository';
import { ContextBuilderService } from './context-builder.service';
import { SafetyResponseGateService } from './safety-response-gate.service';
import { DataApiError, type SupabaseDataApiService } from './supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from './supabase-service-role-api.service';
import type { ConversationTurn } from './conversation.types';
import { CorrelationService } from '../observability/correlation.service';
import { MemoryControlRepository } from '../memory/memory-control.repository';
import { MemoryControlService } from '../memory/memory-control.service';
import { MemoryWriteEvaluatorService } from '../memory/memory-write-evaluator.service';
import type { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { MemoryRecord, MemoryStatus, MemoryType } from '../memory/memory.types';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const INTERNAL_VOCABULARY = /\b(?:ACTIVE|DISABLED|DELETED|SUPERSEDED|PERSONAL_FACT|USER_STATED|confidence|importance|status)\b/u;

const MIGRATION = readFileSync(join(__dirname, '../../../../database/migrations/0128_conversational_memory_control_v1.sql'), 'utf8');
function sqlParameters(name: string): string[] {
  const match = MIGRATION.match(new RegExp(`CREATE FUNCTION public\\.${name}\\(([\\s\\S]*?)\\)\\s*RETURNS`, 'u'));
  if (!match) throw new Error(`no ${name} in migration 0128`);
  return match[1].split(',').map((parameter) => parameter.trim().split(/\s+/u)[0]).sort();
}

interface CommandRow {
  id: string; user_id: string; session_id: string; source_turn_id: string; kind: string; outcome: string;
  target_memory_id: string | null; result_memory_id: string | null; candidate_memory_ids: string[]; answers_command_id: string | null;
}
type Row = Record<string, unknown>;

class CanonicalStore {
  sessions: Array<{ id: string; user_id: string; status: string; channel: string; created_at: string; updated_at: string; last_activity_at: string; closed_at: null }> = [];
  turns: ConversationTurn[] & Array<ConversationTurn & { user_id: string }> = [];
  memories: MemoryRecord[] = [];
  commands: CommandRow[] = [];
  serviceCalls: string[] = [];
  private tick = 0;
  private ids = 0;
  /** Runs inside the atomic command, before it reads anything: a competing transaction that committed first. */
  beforeMemoryControlCommand?: () => void;
  /** The command commits, then the answer never reaches the API. */
  loseMemoryControlAnswer = false;

  now(): string { this.tick += 1; return new Date(Date.UTC(2026, 8, 30, 10, 0, 0, this.tick)).toISOString(); }
  id(prefix = 'cccccccc'): string { this.ids += 1; return `${prefix}-0000-4000-8000-${String(this.ids).padStart(12, '0')}`; }

  session(userId: string): string {
    const id = this.id('5e55a000'); const at = this.now();
    this.sessions.push({ id, user_id: userId, status: 'ACTIVE', channel: 'TEXT', created_at: at, updated_at: at, last_activity_at: at, closed_at: null });
    return id;
  }

  remember(userId: string, content: string, type: MemoryType = 'PERSONAL_FACT', status: MemoryStatus = 'ACTIVE'): MemoryRecord {
    const at = this.now();
    const memory: MemoryRecord = {
      id: this.id('3e3e3e3e'), user_id: userId, scope: 'USER', type, content, source: 'USER_STATED', confidence: 0.95,
      importance: 0.65, status, version: 1, created_at: at, updated_at: at, expires_at: null, supersedes_memory_id: null,
    };
    this.memories.push(memory);
    return memory;
  }

  /** A completed earlier exchange of the Session (history, not a command). */
  exchange(userId: string, sessionId: string, userContent: string, assistantContent: string): void {
    const userTurn = this.turn(userId, sessionId, 'USER', userContent, 'COMPLETED', null, null);
    this.turn(userId, sessionId, 'ASSISTANT', assistantContent, 'COMPLETED', userTurn.id, null);
  }

  private turn(userId: string, sessionId: string, role: 'USER' | 'ASSISTANT', content: string, status: ConversationTurn['status'], source: string | null, key: string | null, id = this.id('7e7e7e7e')): ConversationTurn {
    const at = this.now();
    const turn = {
      id, session_id: sessionId, user_id: userId, role, status, content, processing_path: null, routing_reason: null,
      source_turn_id: source, idempotency_key: key, created_at: at, updated_at: at, completed_at: status === 'COMPLETED' ? at : null,
    } as ConversationTurn & { user_id: string };
    this.turns.push(turn);
    return turn;
  }

  ownerOf(token: string): string { return token.replace(/^token:/u, ''); }

  // ---- the caller-token Data API (RLS: only the token owner's rows are visible)
  async request(token: string, path: string, init: RequestInit = {}): Promise<unknown> {
    const owner = this.ownerOf(token);
    const [resource, search = ''] = path.split('?');
    const body = init.body ? JSON.parse(String(init.body)) as Row : {};
    if (resource === 'rpc/create_user_conversation_turn') {
      const session = this.sessions.find((s) => s.id === body.p_session_id && s.user_id === owner && s.status === 'ACTIVE');
      if (!session) throw new DataApiError(403);
      if (body.p_idempotency_key && this.turns.some((t) => t.session_id === session.id && t.idempotency_key === body.p_idempotency_key)) throw new DataApiError(409);
      return [this.turn(owner, session.id, 'USER', String(body.p_content), 'RECEIVED', null, (body.p_idempotency_key as string | null) ?? null, String(body.p_id))];
    }
    if (resource === 'rpc/pending_memory_clarification_v1') {
      expect(Object.keys(body).sort()).toEqual(sqlParameters('pending_memory_clarification_v1'));
      const current = this.turns.find((t) => t.id === body.p_source_turn_id && t.session_id === body.p_session_id && t.role === 'USER' && owns(t, owner));
      if (!current) return [];
      const previous = this.previousUserTurn(current);
      const command = previous && this.commands.find((c) => c.user_id === owner && c.source_turn_id === previous.id && c.session_id === body.p_session_id
        && c.outcome === 'CLARIFICATION_REQUIRED' && !this.commands.some((a) => a.answers_command_id === c.id));
      if (!command) return [];
      // A question asked again keeps the words of the request that first asked.
      let origin = command;
      while (origin.answers_command_id) origin = this.commands.find((c) => c.id === origin.answers_command_id)!;
      const asked = this.turns.find((t) => t.id === origin.source_turn_id)!;
      return [{ command_id: command.id, kind: command.kind, candidate_memory_ids: command.candidate_memory_ids, clarified_turn_content: asked.content }];
    }
    const query = new URLSearchParams(search);
    const table: Row[] = resource === 'conversation_sessions' ? this.sessions : resource === 'conversation_turns' ? this.turns as unknown as Row[] : resource === 'memories' ? this.memories as unknown as Row[] : [];
    if (table.length === 0 && !['conversation_sessions', 'conversation_turns', 'memories'].includes(resource)) throw new Error(`unexpected Data API path ${path}`);
    return postgrest(table.filter((row) => row.user_id === owner), query).map((row) => ({ ...row }));
  }

  private previousUserTurn(current: ConversationTurn): ConversationTurn | undefined {
    return this.turns
      .filter((t) => t.session_id === current.session_id && t.role === 'USER' && t.status !== 'CANCELLED' && t.id !== current.id
        && (t.created_at < current.created_at || (t.created_at === current.created_at && t.id < current.id)))
      .sort((l, r) => r.created_at.localeCompare(l.created_at) || r.id.localeCompare(l.id))[0];
  }

  // ---- the server-authority channel (service role)
  async rpc(name: string, body: Row): Promise<unknown> {
    this.serviceCalls.push(name);
    const source = () => this.turns.find((t) => t.id === body.p_source_turn_id && t.session_id === body.p_session_id && owns(t, String(body.p_user_id)) && t.role === 'USER');
    switch (name) {
      case 'claim_conversation_turn': {
        const turn = source();
        if (!turn || turn.status !== 'RECEIVED') return [];
        Object.assign(turn, { status: 'GENERATING', processing_path: body.p_processing_path, routing_reason: body.p_routing_reason, updated_at: this.now() });
        return [{ ...turn }];
      }
      case 'fail_conversation_turn': {
        const turn = source();
        if (turn?.status === 'GENERATING') Object.assign(turn, { status: 'FAILED', updated_at: this.now() });
        return [];
      }
      case 'recover_expired_generating_conversation_turn_v1': return [];
      case 'server_finalize_memory_control_turn_v1': return this.memoryControlCommand(body);
      default: throw new Error(`unexpected server command ${name}`);
    }
  }

  private finalize(turn: ConversationTurn & { user_id?: string }, content: string, assistantId: string): Row {
    const assistant = this.turn(String((turn as { user_id: string }).user_id), turn.session_id, 'ASSISTANT', content, 'COMPLETED', turn.id, null, assistantId);
    Object.assign(turn, { status: 'COMPLETED', completed_at: this.now(), updated_at: this.now() });
    return { user_turn: { ...turn }, assistant_turn: { ...assistant } };
  }

  /** Mirrors public.server_finalize_memory_control_turn_v1 (migration 0128). */
  private memoryControlCommand(body: Row): unknown {
    expect(Object.keys(body).sort()).toEqual(sqlParameters('server_finalize_memory_control_turn_v1'));
    const user = String(body.p_user_id);
    const turn = this.turns.find((t) => t.id === body.p_source_turn_id && t.session_id === body.p_session_id && owns(t, user) && t.role === 'USER' && t.status === 'GENERATING');
    if (!turn) return [];
    this.beforeMemoryControlCommand?.();
    this.beforeMemoryControlCommand = undefined;
    const own = (id: unknown) => this.memories.find((m) => m.id === id && m.user_id === user);
    const candidates = (body.p_candidate_memory_ids as string[]) ?? [];
    if (candidates.some((id) => !own(id)) || new Set(candidates).size !== candidates.length || candidates.length > 3) throw new DataApiError(403);
    if (body.p_answers_command_id) {
      const pending = this.commands.find((c) => c.id === body.p_answers_command_id && c.user_id === user && c.session_id === body.p_session_id && c.outcome === 'CLARIFICATION_REQUIRED' && c.kind === body.p_kind);
      if (!pending || pending.source_turn_id !== this.previousUserTurn(turn)?.id || (body.p_target_memory_id && !pending.candidate_memory_ids.includes(String(body.p_target_memory_id)))) throw new DataApiError(403);
    }
    if (body.p_target_memory_id && !own(body.p_target_memory_id)) throw new DataApiError(403);
    let outcome = String(body.p_outcome);
    let result: string | null = null;
    const target = own(body.p_target_memory_id);
    const current = (m?: MemoryRecord) => m?.status === 'ACTIVE' && (m.expires_at === null || m.expires_at > new Date().toISOString());
    const newMemory = (): MemoryRecord => ({
      id: String(body.p_new_memory_id), user_id: user, scope: 'USER', type: body.p_type as MemoryType, content: String(body.p_content).trim(),
      source: 'USER_STATED', confidence: Number(body.p_confidence), importance: Number(body.p_importance), status: 'ACTIVE', version: 1,
      created_at: this.now(), updated_at: this.now(), expires_at: (body.p_expires_at as string | null) ?? null, supersedes_memory_id: null,
    });
    if (outcome === 'REMEMBERED') {
      const created = newMemory(); this.memories.push(created); result = created.id;
    } else if (outcome === 'CORRECTED') {
      if (current(target) && !this.memories.some((m) => m.supersedes_memory_id === target!.id)) {
        const successor = { ...newMemory(), version: target!.version + 1, supersedes_memory_id: target!.id };
        this.memories.push(successor); Object.assign(target!, { status: 'SUPERSEDED', updated_at: this.now() }); result = successor.id;
      } else outcome = 'TARGET_CHANGED';
    } else if (outcome === 'FORGOTTEN') {
      if (target?.status === 'ACTIVE' || target?.status === 'DISABLED') Object.assign(target, { status: 'DELETED', updated_at: this.now() });
      else if (target?.status !== 'DELETED') outcome = 'TARGET_CHANGED';
    } else if (outcome === 'DISABLED') {
      if (current(target)) Object.assign(target!, { status: 'DISABLED', updated_at: this.now() });
      else if (target?.status !== 'DISABLED') outcome = 'TARGET_CHANGED';
    }
    if (this.commands.some((c) => c.source_turn_id === turn.id)) throw new DataApiError(409);
    this.commands.push({
      id: this.id('c0c0c0c0'), user_id: user, session_id: turn.session_id, source_turn_id: turn.id, kind: String(body.p_kind), outcome,
      target_memory_id: ['CORRECTED', 'FORGOTTEN', 'DISABLED', 'TARGET_CHANGED'].includes(outcome) ? String(body.p_target_memory_id) : null,
      result_memory_id: result, candidate_memory_ids: [...candidates], answers_command_id: (body.p_answers_command_id as string | null) ?? null,
    });
    const reply = outcome === 'TARGET_CHANGED' ? String(body.p_reply_if_changed) : String(body.p_reply);
    const finalized = this.finalize(turn, reply, String(body.p_assistant_turn_id));
    if (this.loseMemoryControlAnswer) { this.loseMemoryControlAnswer = false; throw new ServiceUnavailableException('Server conversation authority is unavailable.'); }
    return [{ outcome, ...finalized }];
  }
}

function owns(turn: ConversationTurn, user: string): boolean { return (turn as ConversationTurn & { user_id: string }).user_id === user; }

/** The PostgREST filter subset the production repositories use on this path. */
function postgrest(rows: Row[], query: URLSearchParams): Row[] {
  let result = [...rows];
  for (const [key, value] of query) {
    if (['select', 'order', 'limit'].includes(key)) continue;
    if (key === 'or') throw new Error('this path uses no or-filter');
    if (value.startsWith('eq.')) result = result.filter((row) => String(row[key]) === value.slice(3));
    else if (value.startsWith('not.eq.')) result = result.filter((row) => String(row[key]) !== value.slice(7));
    else if (value.startsWith('in.(')) { const set = new Set(value.slice(4, -1).split(',')); result = result.filter((row) => set.has(String(row[key]))); }
    else throw new Error(`unsupported filter ${key}=${value}`);
  }
  const order = query.get('order');
  if (order) {
    const keys = order.split(',').map((part) => part.split('.') as [string, string]);
    result.sort((l, r) => { for (const [key, direction] of keys) { const c = String(l[key]).localeCompare(String(r[key])); if (c !== 0) return direction === 'desc' ? -c : c; } return 0; });
  }
  const limit = query.get('limit');
  return limit ? result.slice(0, Number(limit)) : result;
}

/** Every lane that is not on the Memory path. Touching one is recorded, then throws. */
const touched: string[] = [];
function untouchable(name: string): never {
  // Like a real failing read: the call is recorded and answers a rejected promise, so the ordinary path fails closed
  // through its own failure handling rather than through a synchronous throw the lanes were never built for.
  return new Proxy({}, { get: (_target, property) => property === 'then' ? undefined : () => {
    touched.push(name);
    const failed = Promise.reject(new Error(`W3_MEGA_M_ROUTE_TOUCHED_${name}.${String(property)}`));
    failed.catch(() => undefined);
    return failed;
  } }) as never;
}

describe('W3-MEGA-M conversational Memory control through the production turn route', () => {
  let store: CanonicalStore;
  let conversations: ConversationService;
  let sessionA: string;
  let keys = 0;

  const say = async (content: string, session = sessionA, user = A, idempotencyKey = `key-${++keys}`) => {
    const result = await conversations.createTurn(user, `token:${user}`, session, { content, idempotencyKey });
    return { ...result, reply: result.assistantTurn?.content ?? '', idempotencyKey };
  };
  const memoryOf = (id: string) => store.memories.find((m) => m.id === id)!;
  const activeContents = (user = A) => store.memories.filter((m) => m.user_id === user && m.status === 'ACTIVE').map((m) => m.content).sort();
  afterEach(() => {
    // A Memory command never reaches Human Intelligence, retrieval, Hypothesis, Question or the provider.
    const name = expect.getState().currentTestName ?? '';
    if (!name.includes('ordinary') && !name.includes('only counts right after')) expect(touched).toEqual([]);
  });
  const expectCleanReply = (reply: string) => {
    expect(reply).not.toMatch(UUID_ANYWHERE);
    expect(reply).not.toMatch(INTERNAL_VOCABULARY);
  };

  beforeEach(() => {
    touched.length = 0;
    store = new CanonicalStore();
    const dataApi = { request: (token: string, path: string, init?: RequestInit) => store.request(token, path, init) };
    const serviceApi = { rpc: (name: string, body: Row) => store.rpc(name, body) };
    const correlation = new CorrelationService();
    const repository = new ConversationRepository(dataApi as unknown as SupabaseDataApiService, serviceApi as unknown as SupabaseServiceRoleApiService, correlation);
    const memoryControl = new MemoryControlService(new MemoryControlRepository(dataApi as unknown as MemoryDataApiService), new MemoryWriteEvaluatorService());
    const telemetry = { recordRoutingDecision: jest.fn(), recordTurnOutcome: jest.fn(), recordHypothesisContext: jest.fn(), withEngine: jest.fn() };
    const orchestrator = new ConversationOrchestratorService(
      repository, new ContextBuilderService(repository), new SafetyResponseGateService(), untouchable('BEHAVIORAL_POLICY'),
      untouchable('HIM_SELECTION'), untouchable('HIM_SNAPSHOT'), untouchable('HIM_REASONING'), untouchable('HIM_FAST_DEEP'),
      untouchable('HIM_ADAPTATION'), untouchable('HIM_CONTEXTUAL'), untouchable('HIM_REFLECTION'), untouchable('HIM_CROSS_CONTEXT'),
      untouchable('HIM_BRAIN_CONTEXT'), untouchable('FOREGROUND_GATHER'), untouchable('QUESTION_SELECTION'),
      untouchable('CONTEXT_BUDGET'), untouchable('RECOMMENDATION'), untouchable('MODEL_ROUTER'), correlation, telemetry as never, memoryControl,
    );
    const semantic = { establish: (_user: string, result: unknown) => Promise.resolve(result) };
    conversations = new ConversationService(repository, orchestrator, correlation, semantic as never, { begin: jest.fn().mockResolvedValue({ outcome: 'GRANTED', leaseId: 'lease-route' }), end: jest.fn().mockResolvedValue(undefined) } as never);
    sessionA = store.session(A);
  });

  describe('Arabic', () => {
    it('M-01 «إنت فاكر عني إيه؟» answers from the reader\'s own canonical Memory only', async () => {
      store.remember(A, 'أنا ساكن في أكتوبر.');
      store.remember(A, 'أنا بحب كافيه النيل.', 'STABLE_PREFERENCE');
      store.remember(A, 'قديم ومحذوف.', 'PERSONAL_FACT', 'DELETED');
      store.remember(B, 'سر يخص قارئًا آخر.');
      const before = JSON.stringify(store.memories);

      const { reply, assistantTurn } = await say('إنت فاكر عني إيه؟');

      expect(assistantTurn?.status).toBe('COMPLETED');
      expect(reply).toContain('«أنا ساكن في أكتوبر.»');
      expect(reply).toContain('«أنا بحب كافيه النيل.»');
      expect(reply).not.toContain('قديم ومحذوف');
      expect(reply).not.toContain('قارئًا آخر');
      expectCleanReply(reply);
      expect(JSON.stringify(store.memories)).toBe(before);
      expect(store.commands).toEqual([expect.objectContaining({ kind: 'INSPECT', outcome: 'INSPECTED', target_memory_id: null, result_memory_id: null })]);
    });

    it('M-01 with nothing remembered says so honestly — and a failed Memory read is a failed turn, never "nothing"', async () => {
      expect((await say('إيه اللي فاكره عني؟')).reply).toBe('لسه مش فاكر عنك حاجة محددة.');
      const request = store.request.bind(store);
      jest.spyOn(store, 'request').mockImplementation((token, path, init) => path.startsWith('memories?') ? Promise.reject(new ServiceUnavailableException('Memory persistence is unavailable.')) : request(token, path, init));
      await expect(say('إنت فاكر عني إيه؟')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(store.turns.filter((t) => t.role === 'USER').map((t) => t.status)).toEqual(['COMPLETED', 'FAILED']);
      expect(store.commands).toHaveLength(1);
    });

    it('M-02 «افتكر إن أحمد عنده امتحان الخميس.» creates ONE canonical Memory, and a replay under the same key creates nothing', async () => {
      const first = await say('افتكر إن أحمد عنده امتحان الخميس.');
      expect(first.reply).toBe('تمام، هفتكر ده: «أحمد عنده امتحان الخميس.»');
      expect(store.memories).toEqual([expect.objectContaining({
        user_id: A, content: 'أحمد عنده امتحان الخميس.', status: 'ACTIVE', source: 'USER_STATED', version: 1, supersedes_memory_id: null,
      })]);

      const replay = await say('افتكر إن أحمد عنده امتحان الخميس.', sessionA, A, first.idempotencyKey);
      expect(replay.assistantTurn?.id).toBe(first.assistantTurn?.id);
      expect(store.memories).toHaveLength(1);
      expect(store.commands).toHaveLength(1);

      const again = await say('افتكر إن أحمد عنده امتحان الخميس');
      expect(again.reply).toBe('فاكر ده أصلًا: «أحمد عنده امتحان الخميس.»');
      expect(store.memories).toHaveLength(1);
    });

    it('M-02 refuses a secret, whatever the explicit request', async () => {
      const { reply } = await say('افتكر إن كلمة السر بتاعتي هي 123456');
      expect(reply).toContain('حساسة');
      expect(store.memories).toHaveLength(0);
      expect(store.commands[0]).toEqual(expect.objectContaining({ kind: 'REMEMBER', outcome: 'DECLINED_SENSITIVE' }));
    });

    it('M-03 October → Tanta is a supersession: the predecessor is kept, the successor is its next version', async () => {
      const october = { ...store.remember(A, 'أنا ساكن في أكتوبر.') };
      const othersOctober = store.remember(B, 'أنا ساكن في أكتوبر.');

      const { reply } = await say('أنا مش ساكن في أكتوبر دلوقتي، أنا ساكن في طنطا.');

      expect(reply).toBe('تمام، صحّحتها. بقيت فاكر «أنا ساكن في طنطا.» بدل «أنا ساكن في أكتوبر.».');
      expect(memoryOf(october.id)).toEqual({ ...october, status: 'SUPERSEDED', updated_at: expect.any(String) });
      const successor = store.memories.find((m) => m.supersedes_memory_id === october.id)!;
      expect(successor).toEqual(expect.objectContaining({ user_id: A, content: 'أنا ساكن في طنطا.', version: 2, status: 'ACTIVE', type: 'PERSONAL_FACT' }));
      expect(memoryOf(othersOctober.id).status).toBe('ACTIVE');
      expect(store.commands[0]).toEqual(expect.objectContaining({ kind: 'CORRECT', outcome: 'CORRECTED', target_memory_id: october.id, result_memory_id: successor.id }));
    });

    it('M-03 a correction that lost the race to a competing correction changes nothing and says so', async () => {
      const october = store.remember(A, 'أنا ساكن في أكتوبر.');
      store.beforeMemoryControlCommand = () => {
        // Another turn's correction committed after this turn resolved its target.
        Object.assign(memoryOf(october.id), { status: 'SUPERSEDED' });
        store.memories.push({ ...october, id: store.id('3e3e3e3e'), content: 'أنا ساكن في الجيزة.', version: 2, supersedes_memory_id: october.id, status: 'ACTIVE' });
      };
      const { reply } = await say('أنا مش ساكن في أكتوبر دلوقتي، أنا ساكن في طنطا.');
      expect(reply).toBe('المعلومة دي اتغيّرت قبل ما أعدّلها، فماغيّرتش حاجة.');
      expect(store.memories.filter((m) => m.supersedes_memory_id === october.id)).toHaveLength(1);
      expect(activeContents()).toEqual(['أنا ساكن في الجيزة.']);
      expect(store.commands[0]).toEqual(expect.objectContaining({ outcome: 'TARGET_CHANGED', target_memory_id: october.id, result_memory_id: null }));
    });

    it('M-04 «انسى إني بحب كافيه النيل.» marks exactly that Memory DELETED (never removed), and a repeat changes nothing', async () => {
      const cafe = { ...store.remember(A, 'أنا بحب كافيه النيل.', 'STABLE_PREFERENCE') };
      const tea = store.remember(A, 'أنا بحب الشاي بالنعناع.', 'STABLE_PREFERENCE');
      const othersCafe = store.remember(B, 'أنا بحب كافيه النيل.', 'STABLE_PREFERENCE');

      expect((await say('انسى إني بحب كافيه النيل.')).reply).toBe('تمام، نسيت «أنا بحب كافيه النيل.» ومش هرجع له تاني.');
      expect(memoryOf(cafe.id)).toEqual({ ...cafe, status: 'DELETED', updated_at: expect.any(String) });
      expect(memoryOf(tea.id).status).toBe('ACTIVE');
      expect(memoryOf(othersCafe.id).status).toBe('ACTIVE');

      expect((await say('انسى إني بحب كافيه النيل.')).reply).toBe('مش لاقي حاجة زي كده في اللي فاكره.');
      expect(store.memories.map((m) => m.status)).toEqual(['DELETED', 'ACTIVE', 'ACTIVE']);
    });

    it('M-05 «متعتمدش على …» is DISABLED, not DELETED: kept, listed as not relied on, and out of the current set', async () => {
      const tea = { ...store.remember(A, 'أنا بحب الشاي بالنعناع.', 'STABLE_PREFERENCE') };

      expect((await say('متعتمدش على إني بحب الشاي بالنعناع')).reply).toBe('تمام، مش هعتمد على «أنا بحب الشاي بالنعناع.» في كلامنا، بس هفضل فاكرها.');
      expect(memoryOf(tea.id)).toEqual({ ...tea, status: 'DISABLED', updated_at: expect.any(String) });
      expect(activeContents()).toEqual([]);

      const inspect = await say('إنت فاكر عني إيه؟');
      expect(inspect.reply).toBe('فيه حاجات لسه فاكرها، بس مش بعتمد عليها بناءً على طلبك:\n• «أنا بحب الشاي بالنعناع.»');

      expect((await say('متعتمدش على إني بحب الشاي بالنعناع')).reply).toContain('مش هعتمد على');
      expect(memoryOf(tea.id).status).toBe('DISABLED');
    });

    it('M-05 «متنساش المعلومة، بس متعتمدش عليها معايا.» points at the previous words, so QANDEEL confirms before changing anything', async () => {
      const tea = store.remember(A, 'أنا بحب الشاي بالنعناع.', 'STABLE_PREFERENCE');
      store.exchange(A, sessionA, 'أنا بحب الشاي بالنعناع', 'جميل.');

      const ask = await say('متنساش المعلومة، بس متعتمدش عليها معايا.');
      expect(ask.reply).toBe('تقصد «أنا بحب الشاي بالنعناع.»؟');
      expect(memoryOf(tea.id).status).toBe('ACTIVE');

      expect((await say('أيوه')).reply).toContain('مش هعتمد على');
      expect(memoryOf(tea.id).status).toBe('DISABLED');
      expect(store.commands.map((c) => [c.kind, c.outcome])).toEqual([['DISABLE', 'CLARIFICATION_REQUIRED'], ['DISABLE', 'DISABLED']]);
      expect(store.commands[1].answers_command_id).toBe(store.commands[0].id);
    });

    it('M-06 «امسح موضوع الشغل.» with two candidates asks, mutates nothing, then applies only the chosen one', async () => {
      const bank = store.remember(A, 'شغلي الجديد في البنك.');
      const boss = store.remember(A, 'مديري في الشغل صعب.', 'RELATIONSHIP_CONTEXT');
      store.remember(A, 'أنا بحب القهوة.', 'STABLE_PREFERENCE');
      const before = JSON.stringify(store.memories);

      const ask = await say('امسح موضوع الشغل.');
      expect(ask.reply).toBe('تقصد أنهي واحدة؟\n1. «مديري في الشغل صعب.»\n2. «شغلي الجديد في البنك.»\nرقمها يكفي.');
      expectCleanReply(ask.reply);
      expect(JSON.stringify(store.memories)).toBe(before);
      expect(store.commands[0]).toEqual(expect.objectContaining({ kind: 'FORGET', outcome: 'CLARIFICATION_REQUIRED', candidate_memory_ids: [boss.id, bank.id] }));

      expect((await say('2')).reply).toBe('تمام، نسيت «شغلي الجديد في البنك.» ومش هرجع له تاني.');
      expect(memoryOf(bank.id).status).toBe('DELETED');
      expect(memoryOf(boss.id).status).toBe('ACTIVE');
    });

    it('M-06 an answer only counts right after the question; "no" changes nothing; an answer outside the options asks again', async () => {
      store.remember(A, 'شغلي الجديد في البنك.');
      store.remember(A, 'مديري في الشغل صعب.');
      const before = () => JSON.stringify(store.memories.map((m) => m.status));
      const statuses = before();

      await say('امسح موضوع الشغل.');
      expect((await say('5')).reply).toContain('تقصد أنهي واحدة؟');
      expect((await say('لا')).reply).toBe('تمام، ماغيّرتش حاجة.');
      expect(before()).toBe(statuses);
      // The clarification was answered, so a later "1" is ordinary conversation (and reaches the provider path).
      await expect(say('1')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(touched.length).toBeGreaterThan(0);
      expect(before()).toBe(statuses);
    });
  });

  describe('English', () => {
    it('inspect, remember, correct, forget and do-not-rely, each from canonical truth', async () => {
      const october = store.remember(A, 'I live in October.');
      const tea = store.remember(A, 'I like tea.', 'STABLE_PREFERENCE');
      const job = store.remember(A, 'My old job was at the bank.');

      const inspect = await say('What do you remember about me?');
      expect(inspect.reply).toBe("Here's what I remember from our conversations:\n• “My old job was at the bank.”\n• “I like tea.”\n• “I live in October.”");

      expect((await say('Remember that my sister Mona lives in Alexandria.')).reply).toBe("Got it, I'll remember: “my sister Mona lives in Alexandria.”");
      expect((await say("I don't live in October anymore, I live in Tanta.")).reply)
        .toBe("Got it, I've corrected it. I now remember “I live in Tanta.” instead of “I live in October.”.");
      expect(memoryOf(october.id).status).toBe('SUPERSEDED');
      expect((await say('Forget that my old job was at the bank')).reply).toBe("Done, I've forgotten “My old job was at the bank.” and won't bring it up again.");
      expect(memoryOf(job.id).status).toBe('DELETED');
      expect((await say("Keep it, but don't rely on the fact that I like tea")).reply).toBe("Done, I won't rely on “I like tea.” when we talk, but I'll keep it.");
      expect(memoryOf(tea.id).status).toBe('DISABLED');
      expect(activeContents()).toEqual(['I live in Tanta.', 'my sister Mona lives in Alexandria.']);
    });

    it('an ambiguous forget asks with the remembered words only, and "the first one" applies that one', async () => {
      const a = store.remember(A, 'I work at the bank.');
      const b = store.remember(A, 'My work hours are long.');
      const ask = await say('Forget the work stuff');
      expect(ask.reply).toBe('Which one do you mean?\n1. “My work hours are long.”\n2. “I work at the bank.”\nThe number is enough.');
      expectCleanReply(ask.reply);
      expect((await say('the first one')).reply).toContain('forgotten “My work hours are long.”');
      expect(memoryOf(b.id).status).toBe('DELETED');
      expect(memoryOf(a.id).status).toBe('ACTIVE');
    });
  });

  describe('lost response, ownership and non-commands', () => {
    it('the command committed and its answer was lost: the retry under the SAME key recovers it, nothing is applied twice', async () => {
      store.loseMemoryControlAnswer = true;
      const key = 'lost-answer-key';
      await expect(say('افتكر إن أحمد عنده امتحان الخميس.', sessionA, A, key)).rejects.toBeInstanceOf(ServiceUnavailableException);
      // The Memory and the reply that reports it committed together.
      expect(store.memories).toHaveLength(1);
      expect(store.turns.filter((t) => t.role === 'ASSISTANT')).toHaveLength(1);

      const retry = await say('افتكر إن أحمد عنده امتحان الخميس.', sessionA, A, key);
      expect(retry.reply).toBe('تمام، هفتكر ده: «أحمد عنده امتحان الخميس.»');
      expect(store.memories).toHaveLength(1);
      expect(store.commands).toHaveLength(1);
      expect(store.turns.filter((t) => t.role === 'ASSISTANT')).toHaveLength(1);
      expect(store.serviceCalls.filter((name) => name === 'server_finalize_memory_control_turn_v1')).toHaveLength(1);
    });

    it('a lost correction answer never produces a second successor', async () => {
      const october = store.remember(A, 'أنا ساكن في أكتوبر.');
      store.loseMemoryControlAnswer = true;
      await expect(say('أنا مش ساكن في أكتوبر دلوقتي، أنا ساكن في طنطا.', sessionA, A, 'k-correct')).rejects.toBeInstanceOf(ServiceUnavailableException);
      await say('أنا مش ساكن في أكتوبر دلوقتي، أنا ساكن في طنطا.', sessionA, A, 'k-correct');
      // The reader re-sends it as a NEW message: QANDEEL already has it that way.
      expect((await say('أنا مش ساكن في أكتوبر دلوقتي، أنا ساكن في طنطا.')).reply).toBe('فاكرها كده أصلًا: «أنا ساكن في طنطا.»');
      expect(store.memories.filter((m) => m.supersedes_memory_id === october.id)).toHaveLength(1);
      expect(store.memories).toHaveLength(2);
    });

    it('one reader can never reach another reader\'s Memory', async () => {
      const mine = store.remember(A, 'أنا بحب كافيه النيل.');
      const sessionB = store.session(B);
      expect((await say('انسى إني بحب كافيه النيل.', sessionB, B)).reply).toBe('مش لاقي حاجة زي كده في اللي فاكره.');
      expect((await say('What do you remember about me?', sessionB, B)).reply).toBe("I don't have anything specific remembered about you yet.");
      expect(memoryOf(mine.id).status).toBe('ACTIVE');
    });

    it('review regressions: look-alike sentences stay ordinary conversation and change nothing', async () => {
      store.remember(A, 'I like my job at Google.');
      store.remember(A, 'أنا بحب الشغل بتاعي في فودافون.');
      store.remember(A, 'I love coffee.', 'STABLE_PREFERENCE');
      store.remember(A, 'أحمد عنده امتحان الخميس.');
      const before = JSON.stringify(store.memories);
      for (const content of [
        "I don't like my job but I need the money",
        'أنا مش بحب الشغل ده، بس لازم أروح',
        'I want to sleep better and stop relying on coffee',
        'امسح رقم أحمد',
        'Forget about work, let us talk about movies',
        'خلي بالك إن الطريق زحمة النهارده',
      ]) {
        touched.length = 0;
        await expect(say(content)).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(touched).toContain('FOREGROUND_GATHER');
      }
      expect(JSON.stringify(store.memories)).toBe(before);
      expect(store.commands).toHaveLength(0);
    });

    it('an unanchored request that matches one Memory («امسح موضوع البنك») is confirmed before anything changes', async () => {
      const bank = store.remember(A, 'شغلي الجديد في البنك.');
      expect((await say('امسح موضوع البنك')).reply).toBe('تقصد «شغلي الجديد في البنك.»؟');
      expect(memoryOf(bank.id).status).toBe('ACTIVE');
      expect((await say('أيوه')).reply).toBe('تمام، نسيت «شغلي الجديد في البنك.» ومش هرجع له تاني.');
      expect(memoryOf(bank.id).status).toBe('DELETED');
    });
    it('«انسى إني بحب المكان ده» never forgets a different preference that merely shares «بحب»', async () => {
      const kushari = store.remember(A, 'أنا بحب الكشري.', 'STABLE_PREFERENCE');
      expect((await say('انسى إني بحب المكان ده.')).reply).toBe('مش لاقي حاجة زي كده في اللي فاكره.');
      expect(memoryOf(kushari.id).status).toBe('ACTIVE');
    });

    it('pointing («هي دي») with several options asks again; «انسى التانية» answers', async () => {
      const bank = store.remember(A, 'شغلي الجديد في البنك.');
      const boss = store.remember(A, 'مديري في الشغل صعب.');
      await say('امسح موضوع الشغل.');
      expect((await say('هي دي')).reply).toContain('1. «مديري في الشغل صعب.»');
      expect(store.memories.map((m) => m.status)).toEqual(['ACTIVE', 'ACTIVE']);
      expect((await say('انسى التانية')).reply).toBe('تمام، نسيت «شغلي الجديد في البنك.» ومش هرجع له تاني.');
      expect([memoryOf(bank.id).status, memoryOf(boss.id).status]).toEqual(['DELETED', 'ACTIVE']);
    });

    it('a question asked again keeps the original request and its language', async () => {
      const mine = store.remember(A, 'I live in October.');
      const sams = store.remember(A, 'My friend Sam lives in October.');
      const ask = await say("I don't live in October anymore, I live in Tanta.");
      expect(ask.reply).toBe('Which one do you mean?\n1. “My friend Sam lives in October.”\n2. “I live in October.”\nThe number is enough.');
      expect((await say('5')).reply).toContain('Which one do you mean?');
      expect((await say('the second one')).reply).toBe("Got it, I've corrected it. I now remember “I live in Tanta.” instead of “I live in October.”.");
      expect([memoryOf(mine.id).status, memoryOf(sams.id).status]).toEqual(['SUPERSEDED', 'ACTIVE']);
      expect(store.commands.map((c) => c.outcome)).toEqual(['CLARIFICATION_REQUIRED', 'CLARIFICATION_REQUIRED', 'CORRECTED']);
    });
    it('ordinary conversation — and a correction that names nothing remembered — continues on the ordinary path', async () => {
      store.remember(A, 'أنا ساكن في طنطا.');
      await expect(say('أنا بحب القهوة')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(touched).toContain('FOREGROUND_GATHER');
      touched.length = 0;
      await expect(say('أنا مش متأكد، بس ممكن نتكلم عن الشغل')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(touched).toContain('FOREGROUND_GATHER');
      expect(store.commands).toHaveLength(0);
    });
  });
});
