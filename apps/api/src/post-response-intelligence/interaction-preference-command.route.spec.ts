// IP-IMP-01 (WP2) — the durable interaction-preference command at route level, through the background.
//
// The contract's three proofs, on the same production path the MEM-AR-01 R2 route spec uses:
//   1. a TEMPORARY request («كلمني بالمصري», «المرة دي اشرح بالتفصيل») is not stored: no preference, no Memory - it stays
//      an ordinary turn of the conversation history;
//   2. a PERMANENT request writes ONLY the canonical Interaction Preferences record (migration 0153) - atomically with its
//      reply - and nothing else;
//   3. no second Memory or parallel authority appears: no Memory, no Memory command row, no provider call, and background
//      capture writes nothing for the command turn, on delivery and on replay.
// Plus the command semantics: idempotent repeat (UNCHANGED), stale refusal (no success acknowledgement, the newer value
// kept), explicit reset, a failed command acknowledged nowhere, and Memory commands untouched.
//
//   ConversationService.createTurn → the real ConversationOrchestrator → the real deterministic interpreter → the real
//   InteractionPreferencesService (owner-token read) → the atomic command (an in-memory mirror of 0153's
//   `server_finalize_interaction_preference_turn_v1`, which finalizes the turn and writes its ConversationTurnCompleted v2
//   outbox event in the same step) → the outbox event → the real PostResponseIntelligenceDispatcher → the real
//   BackgroundIntelligenceEnrichment (the real evaluator) → the background writer mirror.
//
// Only data ports are doubles. The database semantics (CAS, idempotency, isolation, erasure, export) are measured on real
// PostgreSQL 17 by database/verify-migration-0153.mjs.
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
import { InteractionPreferencesRepository } from '../interaction-preferences/interaction-preferences.repository';
import { InteractionPreferencesService } from '../interaction-preferences/interaction-preferences.service';
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
  /** IP-IMP-01: the canonical Interaction Preferences record (0153), one row per owner. No row = all DEFAULT, version 0. */
  preferences = new Map<string, { reply_length: string; reply_language: string; humour: string; explanation_style: string; version: number }>();
  /** Runs inside the command transaction, after the plan was read and before the compare-and-set (a concurrent write). */
  beforePreferenceCommand?: () => void;
  /** Makes the command transaction fail: nothing it would write survives. */
  failPreferenceCommand = false;
  preferenceCommands = 0;
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
      const created = this.turn(owner, String(session.id), 'USER', String(body.p_content), 'RECEIVED', null, String(body.p_id));
      Object.assign(created, { idempotency_key: body.p_idempotency_key ?? null });
      return [{ ...created }];
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
    if (resource === 'interaction_preferences') {
      const row = this.preferences.get(owner);
      return row && new URLSearchParams(search).get('user_id') === `eq.${owner}` ? [{ ...row }] : [];
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
      case 'fail_conversation_turn': { const turn = source(); if (turn && turn.status === 'GENERATING') Object.assign(turn, { status: 'FAILED', updated_at: this.now() }); return []; }
      case 'server_finalize_interaction_preference_turn_v1': return this.preferenceCommand(body);
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

  /** Mirrors 0153's server_finalize_interaction_preference_turn_v1 + apply_v1, and 0063's finalize. One transaction. */
  private preferenceCommand(body: Row): unknown {
    const user = String(body.p_user_id);
    const turn = this.turns.find((t) => t.id === body.p_source_turn_id && t.user_id === user && t.role === 'USER' && t.status === 'GENERATING');
    if (!turn) return [];
    this.preferenceCommands += 1;
    this.beforePreferenceCommand?.();
    if (this.failPreferenceCommand) throw new DataApiError(500);
    const column = ({ REPLY_LENGTH: 'reply_length', REPLY_LANGUAGE: 'reply_language', HUMOUR: 'humour', EXPLANATION_STYLE: 'explanation_style' } as const)[String(body.p_field) as 'HUMOUR'];
    const current = this.preferences.get(user) ?? { reply_length: 'DEFAULT', reply_language: 'DEFAULT', humour: 'DEFAULT', explanation_style: 'DEFAULT', version: 0 };
    let outcome: string;
    if (current[column] === body.p_value) outcome = 'UNCHANGED';
    else if (current.version !== body.p_expected_version) outcome = 'STALE';
    else { outcome = 'SAVED'; this.preferences.set(user, { ...current, [column]: String(body.p_value), version: current.version + 1 }); }
    const reply = String(outcome === 'SAVED' ? body.p_reply_if_saved : outcome === 'UNCHANGED' ? body.p_reply_if_unchanged : body.p_reply_if_stale);
    const assistant = this.turn(user, turn.session_id, 'ASSISTANT', reply, 'COMPLETED', turn.id, String(body.p_assistant_turn_id));
    Object.assign(turn, { status: 'COMPLETED', completed_at: this.now(), updated_at: this.now() });
    this.outbox.push(completedEvent(String(body.p_event_id), user, turn));
    return [{ outcome, version: this.preferences.get(user)?.version ?? 0, user_turn: { ...turn }, assistant_turn: { ...assistant } }];
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
      if (method === undefined && property !== 'then') throw new Error(`IP-IMP-01 route: unexpected background data call ${String(property)}`);
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
    const failed = Promise.reject(new Error(`IP_ROUTE_TOUCHED_${name}.${String(property)}`));
    failed.catch(() => undefined);
    return failed;
  } }) as never;
}
describe('IP-IMP-01 WP2 — durable interaction-preference commands through the route and the background', () => {
  let store: CanonicalStore;
  let ledger: Ledger;
  let conversations: ConversationService;
  let dispatcher: PostResponseIntelligenceDispatcherService;
  let session: string;
  let keys = 0;
  let delivered: RuntimeEventEnvelope[] = [];

  const deliver = async (events: RuntimeEventEnvelope[]) => {
    for (const event of events) await dispatcher.dispatch(JSON.stringify(event));
  };
  const say = async (content: string, idempotencyKey = `key-${++keys}`) => {
    const result = await conversations.createTurn(A, `token:${A}`, session, { content, idempotencyKey });
    const events = store.outbox.splice(0);
    delivered.push(...events);
    await deliver(events);
    const execution = ledger.forTurn(result.userTurn.id);
    return { reply: result.assistantTurn?.content ?? '', turnId: result.userTurn.id, events: events.length, memoryWrite: execution?.memoryResult };
  };
  const record = () => store.preferences.get(A);

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
    const preferences = new InteractionPreferencesService(new InteractionPreferencesRepository(dataApi as unknown as SupabaseDataApiService));
    const telemetry = { recordRoutingDecision: jest.fn(), recordTurnOutcome: jest.fn(), recordHypothesisContext: jest.fn(), withEngine: jest.fn() };
    const orchestrator = new ConversationOrchestratorService(
      repository, new ContextBuilderService(repository), new SafetyResponseGateService(), untouchable('BEHAVIORAL_POLICY'),
      untouchable('HIM_SELECTION'), untouchable('HIM_SNAPSHOT'), untouchable('HIM_REASONING'), untouchable('HIM_FAST_DEEP'),
      untouchable('HIM_ADAPTATION'), untouchable('HIM_CONTEXTUAL'), untouchable('HIM_REFLECTION'), untouchable('HIM_CROSS_CONTEXT'),
      untouchable('HIM_BRAIN_CONTEXT'), untouchable('FOREGROUND_GATHER'), untouchable('QUESTION_SELECTION'),
      untouchable('CONTEXT_BUDGET'), untouchable('RECOMMENDATION'), untouchable('MODEL_ROUTER'), correlation, telemetry as never, memoryControl,
      preferences,
    );
    const semantic = { establish: (_user: string, result: unknown) => Promise.resolve(result) };
    conversations = new ConversationService(repository, orchestrator, correlation, semantic as never, { begin: jest.fn().mockResolvedValue({ outcome: 'GRANTED', leaseId: 'lease-ip' }), end: jest.fn().mockResolvedValue(undefined) } as never);

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
    // A command never reaches a provider, Human Intelligence, the Behavioral Runtime or the ordinary provider route.
    expect(touched).toEqual([]);
  });

  it('PROOF 2 + 3: a permanent request writes ONLY the canonical record, atomically with its reply; nothing else, on delivery and on replay', async () => {
    const said = await say('كلمني دايمًا بالمصري');
    expect(said.reply).toBe('تم حفظ التفضيل. اللغة واللهجة: مصري.');
    expect(record()).toEqual({ reply_length: 'DEFAULT', reply_language: 'EGYPTIAN_ARABIC', humour: 'DEFAULT', explanation_style: 'DEFAULT', version: 1 });
    // No second authority: no Memory, no Memory command, and the background captures nothing for the command turn.
    expect(store.memories).toEqual([]);
    expect(store.commands).toEqual([]);
    expect(said.events).toBe(1);
    expect(said.memoryWrite).toEqual(expect.objectContaining({ decision: 'SKIP' }));
    expect(store.backgroundRecords).toEqual([]);
    // A redelivered completed-turn event writes nothing either.
    await deliver(delivered.filter((event) => event.subject_turn_id === said.turnId));
    expect(store.memories).toEqual([]);
    expect(store.backgroundRecords).toEqual([]);
    // The turn itself stays an ordinary part of the conversation history.
    expect(store.turns.filter((t) => t.role === 'USER').map((t) => [t.content, t.status])).toEqual([['كلمني دايمًا بالمصري', 'COMPLETED']]);
  });

  it.each([
    ['From now on, keep your replies short.', 'Preference saved. Reply Length: Always brief.', 'reply_length', 'ALWAYS_BRIEF'],
    ['من هنا ورايح متهزرش معايا', 'تم حفظ التفضيل. الفكاهة: بدون فكاهة.', 'humour', 'DECLINED'],
    ['always explain things simply', 'Preference saved. Explanation Style: Simpler.', 'explanation_style', 'SIMPLER'],
    ['دايما رد عليا بالإنجليزي', 'تم حفظ التفضيل. اللغة واللهجة: إنجليزي.', 'reply_language', 'ENGLISH'],
  ])('a durable command in either language writes its one field: %s', async (content, reply, column, value) => {
    const said = await say(content);
    expect(said.reply).toBe(reply);
    expect(record()).toEqual(expect.objectContaining({ [column]: value, version: 1 }));
    expect(store.memories).toEqual([]);
    expect(store.backgroundRecords).toEqual([]);
  });

  it('PROOF 1: a temporary request is not stored - no preference, no Memory - and stays ordinary history', async () => {
    // A temporary request is no command: it takes the ordinary provider route (completed here as an ordinary exchange)
    // and the background capture keeps nothing from it.
    for (const content of ['كلمني بالمصري', 'المرة دي اشرح بالتفصيل', 'answer in English', 'Speak to me in Egyptian Arabic.', 'رد عليا بالفصحى']) {
      const turnId = store.ordinaryExchange(A, session, content);
      await deliver(store.outbox.splice(0));
      expect(ledger.forTurn(turnId)?.memoryResult).toEqual({ decision: 'SKIP', reason: 'NO_SUPPORTED_EXPLICIT_PATTERN' });
    }
    expect(store.preferences.size).toBe(0);
    expect(store.memories).toEqual([]);
    expect(store.backgroundRecords).toEqual([]);
    expect(store.turns.filter((t) => t.role === 'USER').map((t) => t.content)).toEqual([
      'كلمني بالمصري', 'المرة دي اشرح بالتفصيل', 'answer in English', 'Speak to me in Egyptian Arabic.', 'رد عليا بالفصحى',
    ]);
  });

  it('repeating a held preference is idempotent (UNCHANGED): the same truthful reply, no version change', async () => {
    await say('كلمني دايمًا بالمصري');
    const again = await say('من هنا ورايح كلمني بالمصري');
    expect(again.reply).toBe('تم حفظ التفضيل. اللغة واللهجة: مصري.');
    expect(record()?.version).toBe(1);
  });

  it('a replayed request (same idempotency key) is answered from canonical state and applies nothing again', async () => {
    const first = await say('دايما اختصر', 'replayed-key');
    const replay = await say('دايما اختصر', 'replayed-key');
    expect(replay.turnId).toBe(first.turnId);
    expect(store.preferenceCommands).toBe(1);
    expect(record()?.version).toBe(1);
  });

  it('a stale command never overwrites a newer value and is never acknowledged as saved', async () => {
    store.beforePreferenceCommand = () => {
      // A Settings change commits between the command's read and its compare-and-set.
      store.preferences.set(A, { reply_length: 'DEFAULT', reply_language: 'ENGLISH', humour: 'DEFAULT', explanation_style: 'DEFAULT', version: 1 });
    };
    const said = await say('كلمني دايمًا بالمصري');
    expect(said.reply).toBe('لم يُحفظ التغيير. يمكنك المحاولة مرة أخرى.');
    expect(record()).toEqual(expect.objectContaining({ reply_language: 'ENGLISH', version: 1 }));
    expect(store.memories).toEqual([]);
  });

  it('an explicit reset returns the field to Automatic', async () => {
    await say('كلمني دايمًا بالمصري');
    const reset = await say('رجّع اللغة واللهجة للتلقائي');
    expect(reset.reply).toBe('تمت إعادة التفضيل إلى تلقائي. اللغة واللهجة: تلقائي.');
    expect(record()).toEqual(expect.objectContaining({ reply_language: 'DEFAULT', version: 2 }));
    const english = await say('reset my humour');
    expect(english.reply).toBe('Preference reset to Automatic. Humour: Automatic.');
  });

  it('a failed command commits nothing and is acknowledged nowhere: the turn fails closed', async () => {
    store.failPreferenceCommand = true;
    await expect(conversations.createTurn(A, `token:${A}`, session, { content: 'كلمني دايمًا بالمصري', idempotencyKey: 'failing' })).rejects.toThrow();
    expect(store.preferences.size).toBe(0);
    expect(store.turns.filter((t) => t.role === 'ASSISTANT')).toEqual([]);
    expect(store.turns.find((t) => t.role === 'USER')?.status).toBe('FAILED');
    expect(store.outbox).toEqual([]);
  });

  it('a Memory command is unchanged and never touches the Interaction Preferences record', async () => {
    const said = await say('افتكر إني بحب القهوة');
    expect(said.reply).toBe('حسنًا، سأتذكّر هذا: «أنا بحب القهوة.»');
    expect(store.commands.map((c) => [c.kind, c.outcome])).toEqual([['REMEMBER', 'REMEMBERED']]);
    expect(store.preferences.size).toBe(0);
    expect(store.preferenceCommands).toBe(0);
  });
});
