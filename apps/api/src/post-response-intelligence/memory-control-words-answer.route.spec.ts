// MEM-AR-01B (S-2a, PD-7) → MEM-AR-01C (S-2b) — R2 at route level: a clarification answered in words.
//
// INTEL-TM-01 left R2 open, and 01B CONFIRMED it with this spec and CI-01 U1: when "which one do you mean?" (a FORGET
// clarification) is answered in the user's own words («أنا بحب الكشري»), the Memory command forgets the chosen Memory,
// and the SAME words then reached background capture as an ordinary completed turn, which wrote the forgotten statement
// again. MEM-AR-01C installs the guard (migration 0152, background_record_memory_v1 → SKIPPED_COMMAND_TURN): a turn a
// Memory command already answered is the foreground's, decided from the committed command row bound to that source
// turn, never from its words. The assertions that recorded the defect are inverted here.
//
//   ConversationService.createTurn → the real ConversationOrchestrator → the real Memory-control boundary → the atomic
//   command (an in-memory mirror of migration 0152's `server_finalize_memory_control_turn_v2`, which finalizes the
//   turn and writes its ConversationTurnCompleted v2 outbox event in the same step) → the outbox event → the real
//   PostResponseIntelligenceDispatcher → the real BackgroundIntelligenceEnrichment (the real evaluator and the 01A
//   capture screen) → the background writer (an in-memory mirror of `background_record_memory_v1`).
//
// Only data ports are doubles: the canonical store (Data API and service role), the execution ledger, the Association
// preparation (no Hypothesis exists, so it is EMPTY) and the provider-backed lanes, which throw if touched. The database
// effect is measured on real PostgreSQL 17 by database/verify-migration-0152.mjs and CI-01 scenario U1.
import { ConversationService } from '../conversation/conversation.service';
import { ConversationOrchestratorService } from '../conversation/conversation-orchestrator.service';
import { ConversationRepository } from '../conversation/conversation.repository';
import { ContextBuilderService } from '../conversation/context-builder.service';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import { DataApiError, type SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import type { ConversationTurn } from '../conversation/conversation.types';
import { CorrelationService } from '../observability/correlation.service';
import { MemoryControlRepository } from '../memory/memory-control.repository';
import { MemoryControlService } from '../memory/memory-control.service';
import { MemoryWriteEvaluatorService } from '../memory/memory-write-evaluator.service';
import type { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { MemoryRecord, MemorySubject, MemoryType } from '../memory/memory.types';
import type { MemoryWriteResult } from '../memory/memory.types';
import { normalizeArabicComparison } from '../memory/arabic-text';
import { selectMemories } from '../memory/memory-retriever.service';
import { BackgroundIntelligenceAuthorityService } from '../background-intelligence/background-intelligence-authority.service';
import { BackgroundIntelligenceContextFactory } from '../background-intelligence/background-intelligence-context.factory';
import type { BackgroundIntelligenceDataApiService, BackgroundMemoryCreateInput } from '../background-intelligence/background-intelligence-data-api.service';
import type { BackgroundIntelligenceExecutionContext } from '../background-intelligence/background-intelligence-authority.service';
import { BackgroundIntelligenceEnrichmentService } from '../background-intelligence/background-intelligence-enrichment.service';
import { HypothesisGenerationTriggerClassificationService } from '../hypothesis/hypothesis-generation-trigger-classification.service';
import { HimReasoningConsumptionService } from '../human-model/him-reasoning-consumption.service';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';
import { PostResponseIntelligenceDispatcherService } from './post-response-intelligence-dispatcher.service';
import { PostResponseProviderBudgetService } from './post-response-provider-budget.service';
import type { PostResponseIntelligenceRepository } from './post-response-intelligence.repository';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
type Row = Record<string, unknown>;
type Turn = ConversationTurn & { user_id: string };
interface Command { id: string; user_id: string; session_id: string; source_turn_id: string; kind: string; outcome: string; target_memory_id: string | null; candidate_memory_ids: string[]; answers_command_id: string | null }
interface Effect { effect_key: string; state: 'CLAIMED' | 'COMPLETED'; result_code: string | null; result_reference: string | null; result_payload: unknown }

/** The canonical rows of one reader, behind the same Data API / service-role surfaces the production code calls. */
class CanonicalStore {
  sessions: Row[] = [];
  turns: Turn[] = [];
  memories: MemoryRecord[] = [];
  commands: Command[] = [];
  outbox: RuntimeEventEnvelope[] = [];
  /** Every capture that reached the background writer, and what the writer answered. */
  backgroundRecords: Array<{ sourceTurnId: string; input: BackgroundMemoryCreateInput; outcome: string }> = [];
  attributions = new Map<string, { subject: MemorySubject; basis: string }>();
  private tick = 0;
  private ids = 0;

  now(): string { this.tick += 1; return new Date(Date.UTC(2026, 9, 11, 10, 0, 0, this.tick)).toISOString(); }
  id(prefix: string): string { this.ids += 1; return `${prefix}-0000-4000-8000-${String(this.ids).padStart(12, '0')}`; }

  session(userId: string): string {
    const id = this.id('5e55a000'); const at = this.now();
    this.sessions.push({ id, user_id: userId, status: 'ACTIVE', channel: 'TEXT', created_at: at, updated_at: at, last_activity_at: at, closed_at: null });
    return id;
  }

  remember(userId: string, content: string, type: MemoryType, subject: MemorySubject = 'SELF'): MemoryRecord {
    const at = this.now();
    const memory: MemoryRecord = {
      id: this.id('3e3e3e3e'), user_id: userId, scope: 'USER', type, content, source: 'USER_STATED', confidence: 0.95,
      importance: 0.75, status: 'ACTIVE', version: 1, created_at: at, updated_at: at, expires_at: null, supersedes_memory_id: null,
    };
    this.memories.push(memory);
    this.attributions.set(memory.id, { subject, basis: 'LEGACY_FIRST_PERSON_CAPTURE' });
    return memory;
  }

  /** An ordinary exchange that completed through the provider path, with its completed-turn event (not a command). */
  ordinaryExchange(userId: string, sessionId: string, content: string): string {
    const userTurn = this.turn(userId, sessionId, 'USER', content, 'COMPLETED', null, this.id('7e7e7e7e'));
    this.turn(userId, sessionId, 'ASSISTANT', 'جميل.', 'COMPLETED', userTurn.id, this.id('7e7e7e7e'));
    this.outbox.push(completedEvent(this.id('e0e0e0e0'), userId, userTurn));
    return userTurn.id;
  }

  private subjectOf(memoryId: string): MemorySubject | null { return this.attributions.get(memoryId)?.subject ?? null; }

  private turn(userId: string, sessionId: string, role: 'USER' | 'ASSISTANT', content: string, status: ConversationTurn['status'], source: string | null, id: string): Turn {
    const at = this.now();
    const turn = {
      id, session_id: sessionId, user_id: userId, role, status, content, processing_path: null, routing_reason: null,
      source_turn_id: source, idempotency_key: null, created_at: at, updated_at: at, completed_at: status === 'COMPLETED' ? at : null,
    } as unknown as Turn;
    this.turns.push(turn);
    return turn;
  }

  private previousUserTurn(current: Turn): Turn | undefined {
    return this.turns.filter((t) => t.session_id === current.session_id && t.role === 'USER' && t.id !== current.id && t.created_at < current.created_at)
      .sort((l, r) => r.created_at.localeCompare(l.created_at))[0];
  }

  // ---- the caller-token Data API (RLS: only the token owner's rows)
  async request(token: string, path: string, init: RequestInit = {}): Promise<unknown> {
    const owner = token.replace(/^token:/u, '');
    const [resource, search = ''] = path.split('?');
    const body = init.body ? JSON.parse(String(init.body)) as Row : {};
    if (resource === 'rpc/create_user_conversation_turn') {
      const session = this.sessions.find((s) => s.id === body.p_session_id && s.user_id === owner);
      if (!session) throw new DataApiError(403);
      return [this.turn(owner, String(session.id), 'USER', String(body.p_content), 'RECEIVED', null, String(body.p_id))];
    }
    if (resource === 'rpc/pending_memory_subject_clarification_v1') {
      const current = this.turns.find((t) => t.id === body.p_source_turn_id && t.user_id === owner);
      const previous = current && this.previousUserTurn(current);
      const command = previous && this.commands.find((c) => c.user_id === owner && c.source_turn_id === previous.id && c.kind === 'REMEMBER'
        && c.outcome === 'SUBJECT_CLARIFICATION_REQUIRED' && !this.commands.some((a) => a.answers_command_id === c.id));
      return command ? [{ command_id: command.id, clarified_turn_content: previous!.content }] : [];
    }
    // L-11: no correction asks the subject question on this path.
    if (resource === 'rpc/pending_memory_correction_subject_clarification_v1') return [];
    if (resource === 'rpc/pending_memory_clarification_v1') {
      const current = this.turns.find((t) => t.id === body.p_source_turn_id && t.user_id === owner);
      const previous = current && this.previousUserTurn(current);
      const command = previous && this.commands.find((c) => c.user_id === owner && c.source_turn_id === previous.id && c.outcome === 'CLARIFICATION_REQUIRED'
        && !this.commands.some((a) => a.answers_command_id === c.id));
      if (!command) return [];
      const asked = this.turns.find((t) => t.id === command.source_turn_id)!;
      return [{ command_id: command.id, kind: command.kind, candidate_memory_ids: command.candidate_memory_ids, clarified_turn_content: asked.content }];
    }
    const table = resource === 'conversation_sessions' ? this.sessions : resource === 'conversation_turns' ? this.turns as unknown as Row[] : resource === 'memories' ? this.memories as unknown as Row[] : undefined;
    if (!table) throw new Error(`unexpected Data API path ${path}`);
    return postgrest(table.filter((row) => row.user_id === owner), new URLSearchParams(search)).map((row) => resource === 'memories'
      ? { ...row, memory_subject_attributions: this.subjectOf(String(row.id)) ? { subject: this.subjectOf(String(row.id)) } : null }
      : { ...row });
  }

  // ---- the server-authority channel (service role)
  async rpc(name: string, body: Row): Promise<unknown> {
    const source = () => this.turns.find((t) => t.id === body.p_source_turn_id && t.user_id === body.p_user_id && t.role === 'USER');
    switch (name) {
      case 'claim_conversation_turn': {
        const turn = source();
        if (!turn || turn.status !== 'RECEIVED') return [];
        Object.assign(turn, { status: 'GENERATING', processing_path: body.p_processing_path, routing_reason: body.p_routing_reason, updated_at: this.now() });
        return [{ ...turn }];
      }
      case 'fail_conversation_turn': return [];
      case 'recover_expired_generating_conversation_turn_v1': return [];
      case 'server_finalize_memory_control_turn_v2': return this.memoryControlCommand(body);
      default: throw new Error(`unexpected server command ${name}`);
    }
  }

  /** Mirrors 0152's v2 for the outcomes this path uses, and 0063's finalize, which writes the completed-turn outbox event. */
  private memoryControlCommand(body: Row): unknown {
    const user = String(body.p_user_id);
    const turn = this.turns.find((t) => t.id === body.p_source_turn_id && t.user_id === user && t.role === 'USER' && t.status === 'GENERATING');
    if (!turn) return [];
    const own = (id: unknown) => this.memories.find((m) => m.id === id && m.user_id === user);
    const candidates = (body.p_candidate_memory_ids as string[]) ?? [];
    if (candidates.some((id) => !own(id))) throw new DataApiError(403);
    if (body.p_answers_command_id) {
      const asked = body.p_kind === 'REMEMBER' ? 'SUBJECT_CLARIFICATION_REQUIRED' : 'CLARIFICATION_REQUIRED';
      const pending = this.commands.find((c) => c.id === body.p_answers_command_id && c.user_id === user && c.outcome === asked && c.kind === body.p_kind);
      if (!pending || pending.source_turn_id !== this.previousUserTurn(turn)?.id || this.commands.some((a) => a.answers_command_id === pending.id)) throw new DataApiError(403);
    }
    let outcome = String(body.p_outcome);
    let result: string | null = null;
    const target = own(body.p_target_memory_id);
    if (outcome === 'FORGOTTEN') {
      if (target?.status === 'ACTIVE' || target?.status === 'DISABLED') Object.assign(target, { status: 'DELETED', updated_at: this.now() });
      else if (target?.status !== 'DELETED') outcome = 'TARGET_CHANGED';
    } else if (outcome === 'REMEMBERED') {
      const at = this.now();
      this.memories.push({
        id: String(body.p_new_memory_id), user_id: user, scope: 'USER', type: body.p_type as MemoryType, content: String(body.p_content),
        source: 'USER_STATED', confidence: Number(body.p_confidence), importance: Number(body.p_importance), status: 'ACTIVE', version: 1,
        created_at: at, updated_at: at, expires_at: null, supersedes_memory_id: null,
      });
      this.attributions.set(String(body.p_new_memory_id), { subject: body.p_subject as MemorySubject, basis: body.p_answers_command_id ? 'USER_CLARIFIED' : 'EXPLICIT_STATEMENT' });
      result = String(body.p_new_memory_id);
    } else if (!['CLARIFICATION_REQUIRED', 'CLARIFICATION_DECLINED', 'SUBJECT_CLARIFICATION_REQUIRED'].includes(outcome)) {
      throw new Error(`outcome ${outcome} is outside this route spec`);
    }
    this.commands.push({
      id: this.id('c0c0c0c0'), user_id: user, session_id: turn.session_id, source_turn_id: turn.id, kind: String(body.p_kind), outcome,
      target_memory_id: ['FORGOTTEN', 'TARGET_CHANGED'].includes(outcome) ? String(body.p_target_memory_id) : null,
      candidate_memory_ids: [...candidates], answers_command_id: (body.p_answers_command_id as string | null) ?? null,
    });
    void result;
    const reply = outcome === 'TARGET_CHANGED' ? String(body.p_reply_if_changed) : String(body.p_reply);
    const assistant = this.turn(user, turn.session_id, 'ASSISTANT', reply, 'COMPLETED', turn.id, String(body.p_assistant_turn_id));
    Object.assign(turn, { status: 'COMPLETED', completed_at: this.now(), updated_at: this.now() });
    // finalize_conversation_turn_v2 (0063) with safety 'ALLOW': the content-free completed-turn event, same transaction.
    this.outbox.push(completedEvent(String(body.p_event_id), user, turn));
    return [{ outcome, user_turn: { ...turn }, assistant_turn: { ...assistant } }];
  }

  // ---- the background service-role data port, bound to the execution's owner
  backgroundData(): BackgroundIntelligenceDataApiService {
    const turnState = (t: Turn | undefined) => t && { id: t.id, session_id: t.session_id, role: t.role, status: t.status, source_turn_id: t.source_turn_id };
    const port: Partial<Record<keyof BackgroundIntelligenceDataApiService, unknown>> = {
      findSession: async (c: BackgroundIntelligenceExecutionContext) => {
        const s = this.sessions.find((row) => row.id === c.sessionId && row.user_id === c.userId);
        return s && { id: s.id, status: s.status, channel: s.channel };
      },
      findSourceTurn: async (c: BackgroundIntelligenceExecutionContext) => turnState(this.turns.find((t) => t.id === c.sourceTurnId && t.user_id === c.userId)),
      findCompletedAssistant: async (c: BackgroundIntelligenceExecutionContext) => turnState(this.turns.find((t) => t.source_turn_id === c.sourceTurnId && t.user_id === c.userId && t.role === 'ASSISTANT' && t.status === 'COMPLETED')),
      readCanonicalSourceTurn: async (c: BackgroundIntelligenceExecutionContext) => {
        const t = this.turns.find((row) => row.id === c.sourceTurnId && row.user_id === c.userId);
        return t && { ...turnState(t), content: t.content, processing_path: t.processing_path, routing_reason: t.routing_reason };
      },
      readHimBrainContextSource: async () => [],
      reevaluateWithdrawnHypothesisEvidence: async () => 0,
      listActiveHypotheses: async () => [],
      readHypothesisEvidenceReliance: async () => [],
      listActiveMemories: async (c: BackgroundIntelligenceExecutionContext, limit: number) => this.memories
        .filter((m) => m.user_id === c.userId && m.status === 'ACTIVE').sort((l, r) => r.updated_at.localeCompare(l.updated_at)).slice(0, limit)
        .map((m) => ({ ...m, subject: this.subjectOf(m.id) })),
      // Mirrors background_record_memory_v1 (migration 0152) for this path: the command-turn guard reads the committed
      // command rows bound to the source turn - never the words - then the stale-capture and equivalence rules.
      recordMemory: async (c: BackgroundIntelligenceExecutionContext, input: BackgroundMemoryCreateInput) => {
        const answer = (outcome: string, memoryId?: string) => { this.backgroundRecords.push({ sourceTurnId: c.sourceTurnId, input, outcome }); return memoryId ? { outcome, memoryId } : { outcome }; };
        if (this.commands.some((command) => command.source_turn_id === c.sourceTurnId && command.user_id === c.userId)) return answer('SKIPPED_COMMAND_TURN');
        const key = normalizeArabicComparison(input.content);
        const source = this.turns.find((t) => t.id === c.sourceTurnId)!;
        if (this.commands.some((command) => command.user_id === c.userId && ['FORGOTTEN', 'DISABLED', 'CORRECTED', 'CORRECTED_TO_EXISTING'].includes(command.outcome)
          && this.memories.some((m) => m.id === command.target_memory_id && m.type === input.type && normalizeArabicComparison(m.content) === key)
          && this.turns.find((t) => t.id === command.source_turn_id)!.created_at > source.created_at)) return answer('SUPERSEDED_BY_LATER_COMMAND');
        if (this.memories.some((m) => m.user_id === c.userId && m.status === 'ACTIVE' && m.type === input.type && normalizeArabicComparison(m.content) === key
          && this.subjectOf(m.id) !== 'OTHER')) return answer('EQUIVALENT_EXISTS');
        const at = this.now();
        this.memories.push({
          id: input.id, user_id: c.userId, scope: 'USER', type: input.type, content: input.content, source: 'USER_STATED', confidence: input.confidence,
          importance: input.importance, status: 'ACTIVE', version: 1, created_at: at, updated_at: at, expires_at: input.expiresAt ?? null, supersedes_memory_id: null,
        });
        this.attributions.set(input.id, { subject: 'SELF', basis: 'FIRST_PERSON_CAPTURE' });
        return answer('CREATED', input.id);
      },
    };
    return new Proxy(port, { get: (target, property) => {
      const method = (target as Record<string | symbol, unknown>)[property];
      if (method === undefined && property !== 'then') throw new Error(`R2 characterization: unexpected background data call ${String(property)}`);
      return method;
    } }) as unknown as BackgroundIntelligenceDataApiService;
  }
}

/** finalize_conversation_turn_v2's content-free completed-turn event. */
function completedEvent(eventId: string, user: string, turn: Turn): RuntimeEventEnvelope {
  return {
    event_id: eventId, event_type: 'ConversationTurnCompleted', event_version: '2.0', occurred_at: turn.updated_at,
    producer: 'conversation-service', subject_user_id: user, subject_session_id: turn.session_id, subject_turn_id: turn.id,
    correlation_id: null, causation_id: null, classification: 'SENSITIVE',
    schema_ref: 'qandeel.runtime.conversation-turn-completed.v2',
    payload: {
      user_id: user, session_id: turn.session_id, source_turn_id: turn.id, terminal_status: 'COMPLETED', processing_path: turn.processing_path,
      routing_reason: turn.routing_reason, orchestration_id: null, safety_disposition: 'ALLOW',
    },
    contains_content: false, retention_class: 'OPERATIONAL_EVENT_V1',
  } as unknown as RuntimeEventEnvelope;
}

/** The PostgREST filter subset the production repositories use on this path. */
function postgrest(rows: Row[], query: URLSearchParams): Row[] {
  let result = [...rows];
  for (const [key, value] of query) {
    if (['select', 'order', 'limit'].includes(key)) continue;
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

/** The durable execution ledger: one execution per event, its effects, and how it ended. */
class Ledger {
  executions = new Map<string, { id: string; source_turn_id: string; effects: Effect[]; memoryResult?: MemoryWriteResult; finished?: string }>();
  repository(): PostResponseIntelligenceRepository {
    const effect = (executionId: string, key: string) => this.executions.get(executionId)!.effects.find((e) => e.effect_key === key);
    return {
      acquire: async (input: { id: string; eventId: string; userId: string; sessionId: string; sourceTurnId: string; eventVersion: string; processingPath: string | null; safetyDisposition: string | null }) => {
        const execution = { id: input.id, source_turn_id: input.sourceTurnId, effects: [] as Effect[] };
        this.executions.set(input.id, execution);
        return { id: input.id, event_id: input.eventId, user_id: input.userId, session_id: input.sessionId, source_turn_id: input.sourceTurnId, event_version: input.eventVersion,
          processing_path: input.processingPath, safety_disposition: input.safetyDisposition, state: 'RUNNING', attempt_count: 1 };
      },
      effects: async (executionId: string) => this.executions.get(executionId)!.effects.map((e) => ({ ...e })),
      claim: async (executionId: string, key: string) => { this.executions.get(executionId)!.effects.push({ effect_key: key, state: 'CLAIMED', result_code: null, result_reference: null, result_payload: null }); return true; },
      completeMemory: async (executionId: string, result: MemoryWriteResult) => {
        this.executions.get(executionId)!.memoryResult = result;
        Object.assign(effect(executionId, 'MEMORY_WRITE')!, result.decision === 'WRITE'
          ? { state: 'COMPLETED', result_code: 'FRESH_EVIDENCE_CREATED', result_reference: result.evidenceId }
          : { state: 'COMPLETED', result_code: 'NO_FRESH_EVIDENCE', result_reference: null });
        return true;
      },
      completeHimBrainContextMaterialization: async (executionId: string) => {
        this.executions.get(executionId)!.effects.push({ effect_key: 'HIM_BRAIN_CONTEXT_MATERIALIZATION', state: 'COMPLETED', result_code: 'NO_HIM_BRAIN_CONTEXT', result_reference: null, result_payload: null });
        return 'COMPLETED';
      },
      finish: async (executionId: string, state: string, outcome: string, stage: string) => { this.executions.get(executionId)!.finished = `${state}/${outcome}/${stage}`; return true; },
    } as unknown as PostResponseIntelligenceRepository;
  }
  forTurn(turnId: string) { return [...this.executions.values()].find((e) => e.source_turn_id === turnId); }
}

const touched: string[] = [];
function untouchable(name: string): never {
  return new Proxy({}, { get: (_target, property) => property === 'then' ? undefined : () => {
    touched.push(name);
    const failed = Promise.reject(new Error(`R2_ROUTE_TOUCHED_${name}.${String(property)}`));
    failed.catch(() => undefined);
    return failed;
  } }) as never;
}

describe('MEM-AR-01B S-2a / MEM-AR-01C S-2b — R2: a clarification answered in words, through the background', () => {
  let store: CanonicalStore;
  let ledger: Ledger;
  let conversations: ConversationService;
  let dispatcher: PostResponseIntelligenceDispatcherService;
  let session: string;
  let keys = 0;
  let delivered: RuntimeEventEnvelope[] = [];

  /** Every committed outbox event delivered to the real dispatcher. */
  const deliver = async (events: RuntimeEventEnvelope[]) => {
    const acknowledged: boolean[] = [];
    for (const event of events) acknowledged.push(await dispatcher.dispatch(JSON.stringify(event)));
    return acknowledged;
  };
  /** One user turn: the foreground route, then every outbox event it committed delivered to the real dispatcher. */
  const say = async (content: string) => {
    const result = await conversations.createTurn(A, `token:${A}`, session, { content, idempotencyKey: `key-${++keys}` });
    const events = store.outbox.splice(0);
    delivered.push(...events);
    const acknowledged: boolean[] = [];
    for (const event of events) acknowledged.push(await dispatcher.dispatch(JSON.stringify(event)));
    const execution = ledger.forTurn(result.userTurn.id);
    return {
      reply: result.assistantTurn?.content ?? '', turnId: result.userTurn.id, events: events.length, acknowledged,
      memoryWrite: execution?.memoryResult, memoryEffect: execution?.effects.find((e) => e.effect_key === 'MEMORY_WRITE'), finished: execution?.finished,
    };
  };

  beforeEach(() => {
    touched.length = 0;
    delivered = [];
    store = new CanonicalStore();
    ledger = new Ledger();
    const dataApi = { request: (token: string, path: string, init?: RequestInit) => store.request(token, path, init) };
    const serviceApi = { rpc: (name: string, body: Row) => store.rpc(name, body) };
    const correlation = new CorrelationService();
    const repository = new ConversationRepository(dataApi as unknown as SupabaseDataApiService, serviceApi as unknown as SupabaseServiceRoleApiService, correlation);
    const evaluator = new MemoryWriteEvaluatorService();
    const memoryControl = new MemoryControlService(new MemoryControlRepository(dataApi as unknown as MemoryDataApiService), evaluator);
    const telemetry = { recordRoutingDecision: jest.fn(), recordTurnOutcome: jest.fn(), recordHypothesisContext: jest.fn(), withEngine: jest.fn() };
    const orchestrator = new ConversationOrchestratorService(
      repository, new ContextBuilderService(repository), new SafetyResponseGateService(), untouchable('BEHAVIORAL_POLICY'),
      untouchable('HIM_SELECTION'), untouchable('HIM_SNAPSHOT'), untouchable('HIM_REASONING'), untouchable('HIM_FAST_DEEP'),
      untouchable('HIM_ADAPTATION'), untouchable('HIM_CONTEXTUAL'), untouchable('HIM_REFLECTION'), untouchable('HIM_CROSS_CONTEXT'),
      untouchable('HIM_BRAIN_CONTEXT'), untouchable('FOREGROUND_GATHER'), untouchable('QUESTION_SELECTION'),
      untouchable('CONTEXT_BUDGET'), untouchable('RECOMMENDATION'), untouchable('MODEL_ROUTER'), correlation, telemetry as never, memoryControl,
      // IP-IMP-01: a Memory command never reads or writes the Interaction Preferences record.
      untouchable('INTERACTION_PREFERENCES'),
    );
    const semantic = { establish: (_user: string, result: unknown) => Promise.resolve(result) };
    conversations = new ConversationService(repository, orchestrator, correlation, semantic as never, { begin: jest.fn().mockResolvedValue({ outcome: 'GRANTED', leaseId: 'lease-r2' }), end: jest.fn().mockResolvedValue(undefined) } as never);

    const data = store.backgroundData();
    const enrichment = new BackgroundIntelligenceEnrichmentService(data, evaluator, new HypothesisGenerationTriggerClassificationService(), new HimReasoningConsumptionService());
    const association = { prepare: jest.fn().mockResolvedValue({ status: 'EMPTY', reason: 'NO_SAME_SESSION_HYPOTHESES' }), proposeAndAuthorize: untouchable('ASSOCIATION_PROVIDER') };
    dispatcher = new PostResponseIntelligenceDispatcherService(
      ledger.repository(), new BackgroundIntelligenceAuthorityService(new BackgroundIntelligenceContextFactory(), data), enrichment,
      untouchable('INTENT_PROVIDER'), untouchable('ASSEMBLER'), untouchable('CANDIDATE_PROVIDER') as never, association as never,
      new PostResponseProviderBudgetService(),
    );
    session = store.session(A);
  });

  afterEach(() => {
    // Nothing on this path reaches a provider, Human Intelligence or the ordinary provider route.
    expect(touched).toEqual([]);
  });

  it('R2 FIXED (01C): the words answer forgets the chosen Memory, and background capture writes nothing - on delivery and on replay', async () => {
    const kushari = store.remember(A, 'أنا بحب الكشري.', 'STABLE_PREFERENCE');
    const ful = store.remember(A, 'أنا بحب الفول.', 'STABLE_PREFERENCE');

    // 1. The FORGET request names only a predicate, so QANDEEL asks. Nothing changes; the background writes nothing.
    const ask = await say('انسى إني بحب');
    expect(ask.reply).toBe('تقصد أنهي واحدة؟\n1. «أنا بحب الفول.»\n2. «أنا بحب الكشري.»\nرقمها يكفي.');
    expect(store.commands.map((c) => [c.kind, c.outcome, c.candidate_memory_ids])).toEqual([['FORGET', 'CLARIFICATION_REQUIRED', [ful.id, kushari.id]]]);
    expect(ask.memoryWrite).toEqual({ decision: 'SKIP', reason: 'NO_SUPPORTED_EXPLICIT_PATTERN' });

    // 2. The answer in words resolves to one option: the foreground forgets exactly that Memory.
    const answer = await say('أنا بحب الكشري');
    expect(answer.reply).toBe('تمام، نسيت «أنا بحب الكشري.» ومش هرجع له تاني.');
    expect(store.commands[1]).toEqual(expect.objectContaining({ kind: 'FORGET', outcome: 'FORGOTTEN', answers_command_id: store.commands[0].id }));
    expect(store.memories.find((m) => m.id === kushari.id)!.status).toBe('DELETED');
    expect(store.memories.find((m) => m.id === ful.id)!.status).toBe('ACTIVE');

    // 3. The same words still reach background capture as a completed turn, and the evaluator still reads them as a
    // first-person preference - but the writer finds the committed FORGET bound to this source turn and writes nothing.
    expect(answer.events).toBe(1);
    expect(answer.memoryWrite).toEqual({ decision: 'SKIP', reason: 'SKIPPED_COMMAND_TURN', type: 'STABLE_PREFERENCE' });
    expect(answer.memoryEffect).toEqual(expect.objectContaining({ state: 'COMPLETED', result_code: 'NO_FRESH_EVIDENCE', result_reference: null }));
    expect(store.backgroundRecords).toEqual([expect.objectContaining({ sourceTurnId: answer.turnId, outcome: 'SKIPPED_COMMAND_TURN' })]);
    expect(store.memories.filter((m) => m.content === 'أنا بحب الكشري.').map((m) => m.status)).toEqual(['DELETED']);
    expect(answer.finished).toBe('SKIPPED/NOT_ELIGIBLE/ELIGIBILITY');

    // 4. A replay of the same completed-turn event (a redelivery, a recovered execution) writes nothing either.
    await deliver(delivered.filter((event) => event.subject_turn_id === answer.turnId));
    expect(store.backgroundRecords.map((r) => r.outcome)).toEqual(['SKIPPED_COMMAND_TURN', 'SKIPPED_COMMAND_TURN']);
    expect(store.memories.filter((m) => m.status === 'ACTIVE').map((m) => m.content)).toEqual(['أنا بحب الفول.']);

    // 5. Later recall cannot serve the forgotten statement: it is in no ACTIVE Memory the retriever reads.
    const active = store.memories.filter((m) => m.user_id === A && m.status === 'ACTIVE');
    expect(selectMemories('إنت فاكر إني بحب الكشري؟', active).map((m) => m.content)).not.toContain('أنا بحب الكشري.');

    // 6. An unrelated ordinary statement afterwards is still captured as usual.
    const ordinary = store.ordinaryExchange(A, session, 'أنا بحب البطاطس');
    await deliver(store.outbox.splice(0));
    expect(ledger.forTurn(ordinary)?.memoryResult).toEqual(expect.objectContaining({ decision: 'WRITE', type: 'STABLE_PREFERENCE' }));
    expect(store.memories.filter((m) => m.status === 'ACTIVE').map((m) => m.content).sort()).toEqual(['أنا بحب البطاطس.', 'أنا بحب الفول.']);
  });

  it('S-2b (01C): the subject answer «عن أختي» is the command\'s, never the user\'s own relationship fact', async () => {
    // The evaluator alone reads «عن أختي» as a relationship of the user («X أختي»): without the guard it would be kept.
    expect(new MemoryWriteEvaluatorService().evaluate('عن أختي')).toEqual(expect.objectContaining({ decision: 'WRITE' }));
    const ask = await say('افتكر إن ساكنة في طنطا');
    expect(ask.reply).toBe('المعلومة دي عنك إنت، ولا عن حد تاني؟');
    expect(ask.memoryWrite).toEqual(expect.objectContaining({ decision: 'SKIP' }));
    const answer = await say('عن أختي');
    expect(answer.reply).toBe('تمام، هفتكر ده: «ساكنة في طنطا.»');
    expect(store.commands.map((c) => [c.kind, c.outcome])).toEqual([['REMEMBER', 'SUBJECT_CLARIFICATION_REQUIRED'], ['REMEMBER', 'REMEMBERED']]);
    expect(answer.memoryWrite).toEqual({ decision: 'SKIP', reason: 'SKIPPED_COMMAND_TURN', type: 'RELATIONSHIP_CONTEXT' });
    expect(store.memories.map((m) => m.content)).toEqual(['ساكنة في طنطا.']);
    // Generation is not reached either: an answer carries no problem trigger.
    expect(answer.finished).toBe('SKIPPED/NOT_ELIGIBLE/ELIGIBILITY');
  });

  it('control: the same choice answered by number writes nothing in the background (the evaluator never reaches the writer)', async () => {
    const kushari = store.remember(A, 'أنا بحب الكشري.', 'STABLE_PREFERENCE');
    store.remember(A, 'أنا بحب الفول.', 'STABLE_PREFERENCE');
    await say('انسى إني بحب');
    const answer = await say('2');
    expect(answer.reply).toBe('تمام، نسيت «أنا بحب الكشري.» ومش هرجع له تاني.');
    expect(store.memories.find((m) => m.id === kushari.id)!.status).toBe('DELETED');
    expect(answer.memoryWrite).toEqual({ decision: 'SKIP', reason: 'NO_SUPPORTED_EXPLICIT_PATTERN' });
    expect(answer.memoryEffect).toEqual(expect.objectContaining({ result_code: 'NO_FRESH_EVIDENCE' }));
    expect(store.backgroundRecords).toEqual([]);
  });
});
