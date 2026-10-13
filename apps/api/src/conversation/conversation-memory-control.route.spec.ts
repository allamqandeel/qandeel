// W3-MEGA-M (E2E-D-13) — conversational Memory control through the REAL production turn route.
//
// POST /conversation/sessions/:sessionId/turns is ConversationService.createTurn: the real service, the real
// orchestrator, the real Context Builder and Safety gate, the real Memory-control boundary and the real Conversation
// and Memory-control repositories. Only the transport is replaced — by an in-memory canonical store that applies
// row-level security by token and mirrors the SQL commands' semantics (MEM-AR-01C: migration 0152's atomic command v2,
// the subject attributions and the equivalence dispositions included; the SQL itself is proven against real PostgreSQL
// by database/verify-migration-0152.mjs). Every orchestrator lane that
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
import type { MemoryRecord, MemoryStatus, MemorySubject, MemoryType } from '../memory/memory.types';
import { normalizeArabicComparison } from '../memory/arabic-text';
import { clarificationReply } from '../memory/memory-control.copy';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const INTERNAL_VOCABULARY = /\b(?:ACTIVE|DISABLED|DELETED|SUPERSEDED|PERSONAL_FACT|USER_STATED|confidence|importance|status)\b/u;

const MIGRATIONS = ['0128_conversational_memory_control_v1.sql', '0152_memory_subject_identity_atomicity_v1.sql']
  .map((file) => readFileSync(join(__dirname, '../../../../database/migrations', file), 'utf8')).join('\n');
function sqlParameters(name: string): string[] {
  const match = MIGRATIONS.match(new RegExp(`CREATE FUNCTION public\\.${name}\\(([\\s\\S]*?)\\)\\s*RETURNS`, 'u'));
  if (!match) throw new Error(`no ${name} in migrations 0128 / 0152`);
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
  /** MEM-AR-01C: memory_subject_attributions (absent = UNATTRIBUTED) and memory_equivalence_dispositions. */
  attributions = new Map<string, { subject: MemorySubject; basis: string; command_id: string | null }>();
  dispositions: Array<{ memory_id: string; command_id: string; primary_memory_id: string; disposition: string }> = [];
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

  /** A Memory written before this test; `subject` attributes it (absent = UNATTRIBUTED, like a legacy explicit row). */
  remember(userId: string, content: string, type: MemoryType = 'PERSONAL_FACT', status: MemoryStatus = 'ACTIVE', subject?: MemorySubject): MemoryRecord {
    const at = this.now();
    const memory: MemoryRecord = {
      id: this.id('3e3e3e3e'), user_id: userId, scope: 'USER', type, content, source: 'USER_STATED', confidence: 0.95,
      importance: 0.65, status, version: 1, created_at: at, updated_at: at, expires_at: null, supersedes_memory_id: null,
    };
    this.memories.push(memory);
    if (subject) this.attributions.set(memory.id, { subject, basis: 'LEGACY_FIRST_PERSON_CAPTURE', command_id: null });
    return memory;
  }

  subjectOf(memoryId: string): MemorySubject | null { return this.attributions.get(memoryId)?.subject ?? null; }

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
    if (resource === 'rpc/pending_memory_subject_clarification_v1') {
      expect(Object.keys(body).sort()).toEqual(sqlParameters('pending_memory_subject_clarification_v1'));
      const current = this.turns.find((t) => t.id === body.p_source_turn_id && t.session_id === body.p_session_id && t.role === 'USER' && owns(t, owner));
      const previous = current && this.previousUserTurn(current);
      const command = previous && this.commands.find((c) => c.user_id === owner && c.source_turn_id === previous.id && c.session_id === body.p_session_id
        && c.kind === 'REMEMBER' && c.outcome === 'SUBJECT_CLARIFICATION_REQUIRED' && !this.commands.some((a) => a.answers_command_id === c.id));
      return command ? [{ command_id: command.id, clarified_turn_content: previous!.content }] : [];
    }
    if (resource === 'rpc/pending_memory_correction_subject_clarification_v1') {
      // L-11: the subject question a correction asked, with its fact and the words of the request that first asked.
      expect(Object.keys(body).sort()).toEqual(sqlParameters('pending_memory_correction_subject_clarification_v1'));
      const current = this.turns.find((t) => t.id === body.p_source_turn_id && t.session_id === body.p_session_id && t.role === 'USER' && owns(t, owner));
      const previous = current && this.previousUserTurn(current);
      const command = previous && this.commands.find((c) => c.user_id === owner && c.source_turn_id === previous.id && c.session_id === body.p_session_id
        && c.kind === 'CORRECT' && c.outcome === 'SUBJECT_CLARIFICATION_REQUIRED' && !this.commands.some((a) => a.answers_command_id === c.id));
      if (!command) return [];
      let origin = command;
      while (origin.answers_command_id) origin = this.commands.find((c) => c.id === origin.answers_command_id)!;
      const asked = this.turns.find((t) => t.id === origin.source_turn_id)!;
      return [{ command_id: command.id, target_memory_id: command.target_memory_id, clarified_turn_content: asked.content }];
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
    // MEM-AR-01C: a Memory read embeds its attribution (memory_subject_attributions(subject)).
    if (resource === 'memories') expect(query.get('select')).toMatch(/,memory_subject_attributions\(subject\)$/u);
    return postgrest(table.filter((row) => row.user_id === owner), query).map((row) => resource === 'memories'
      ? { ...row, memory_subject_attributions: this.attributions.has(String(row.id)) ? { subject: this.subjectOf(String(row.id)) } : null }
      : { ...row });
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
      case 'server_finalize_memory_control_turn_v2': return this.memoryControlCommand(body);
      default: throw new Error(`unexpected server command ${name}`);
    }
  }

  private finalize(turn: ConversationTurn & { user_id?: string }, content: string, assistantId: string): Row {
    const assistant = this.turn(String((turn as { user_id: string }).user_id), turn.session_id, 'ASSISTANT', content, 'COMPLETED', turn.id, null, assistantId);
    Object.assign(turn, { status: 'COMPLETED', completed_at: this.now(), updated_at: this.now() });
    return { user_turn: { ...turn }, assistant_turn: { ...assistant } };
  }

  /** Mirrors public.server_finalize_memory_control_turn_v2 (migration 0152). */
  private memoryControlCommand(body: Row): unknown {
    expect(Object.keys(body).sort()).toEqual(sqlParameters('server_finalize_memory_control_turn_v2'));
    const user = String(body.p_user_id);
    const turn = this.turns.find((t) => t.id === body.p_source_turn_id && t.session_id === body.p_session_id && owns(t, user) && t.role === 'USER' && t.status === 'GENERATING');
    if (!turn) return [];
    this.beforeMemoryControlCommand?.();
    this.beforeMemoryControlCommand = undefined;
    const kind = String(body.p_kind);
    const own = (id: unknown) => this.memories.find((m) => m.id === id && m.user_id === user);
    const candidates = (body.p_candidate_memory_ids as string[]) ?? [];
    if (candidates.some((id) => !own(id)) || new Set(candidates).size !== candidates.length || candidates.length > 3) throw new DataApiError(403);
    let pending: CommandRow | undefined;
    if (body.p_answers_command_id) {
      const asked = kind === 'REMEMBER' ? 'SUBJECT_CLARIFICATION_REQUIRED' : 'CLARIFICATION_REQUIRED';
      pending = this.commands.find((c) => c.id === body.p_answers_command_id && c.user_id === user && c.session_id === body.p_session_id && c.kind === kind
        && (c.outcome === asked || (kind === 'CORRECT' && c.outcome === 'SUBJECT_CLARIFICATION_REQUIRED')));
      if (!pending || pending.source_turn_id !== this.previousUserTurn(turn)?.id || this.commands.some((a) => a.answers_command_id === pending!.id)
        || (pending.outcome === 'CLARIFICATION_REQUIRED' && body.p_target_memory_id && !pending.candidate_memory_ids.includes(String(body.p_target_memory_id)))
        // L-11: a correction's subject question is answered only by CORRECTED of exactly its fact with a confirmed subject, or declined.
        || (kind === 'CORRECT' && pending.outcome === 'SUBJECT_CLARIFICATION_REQUIRED' && !(body.p_outcome === 'CLARIFICATION_DECLINED'
          || (body.p_outcome === 'CORRECTED' && body.p_subject && body.p_target_memory_id === pending.target_memory_id)))) throw new DataApiError(403);
    }
    if (body.p_target_memory_id && !own(body.p_target_memory_id)) throw new DataApiError(403);
    if (body.p_equivalent_memory_id && !own(body.p_equivalent_memory_id)) throw new DataApiError(403);
    if (kind === 'CORRECT' && body.p_outcome === 'SUBJECT_CLARIFICATION_REQUIRED' && (!body.p_target_memory_id || this.subjectOf(String(body.p_target_memory_id)))) throw new DataApiError(400);
    let outcome = String(body.p_outcome);
    let result: string | null = null;
    let recordedTarget: string | null = null;
    const commandId = this.id('c0c0c0c0');
    const target = own(body.p_target_memory_id);
    const current = (m?: MemoryRecord) => m?.status === 'ACTIVE' && (m.expires_at === null || m.expires_at > new Date().toISOString());
    const key = (content: string) => normalizeArabicComparison(content.trim());
    const byId = (l: MemoryRecord, r: MemoryRecord) => l.id.localeCompare(r.id);
    const newMemory = (): MemoryRecord => ({
      id: String(body.p_new_memory_id), user_id: user, scope: 'USER', type: body.p_type as MemoryType, content: String(body.p_content).trim(),
      source: 'USER_STATED', confidence: Number(body.p_confidence), importance: Number(body.p_importance), status: 'ACTIVE', version: 1,
      created_at: this.now(), updated_at: this.now(), expires_at: (body.p_expires_at as string | null) ?? null, supersedes_memory_id: null,
    });
    const supersede = (old: MemoryRecord): MemoryRecord => {
      const successor = { ...newMemory(), version: old.version + 1, supersedes_memory_id: old.id };
      this.memories.push(successor); Object.assign(old, { status: 'SUPERSEDED', updated_at: this.now() });
      return successor;
    };
    const attribute = (memory: MemoryRecord, subject: MemorySubject | null, basis: string) => {
      if (subject) this.attributions.set(memory.id, { subject, basis, command_id: commandId });
    };
    const dispose = (copy: MemoryRecord, primary: string, disposition: string) => {
      const next = disposition === 'FORGOTTEN' ? 'DELETED' : disposition === 'DISABLED' ? 'DISABLED' : 'SUPERSEDED';
      Object.assign(copy, { status: next, updated_at: this.now() });
      this.dispositions.push({ memory_id: copy.id, command_id: commandId, primary_memory_id: primary, disposition });
    };
    const compatible = (m: MemoryRecord, subject: MemorySubject | null) => subject === null || (this.subjectOf(m.id) ?? subject) === subject;
    if (outcome === 'REMEMBERED') {
      const subject = body.p_subject as MemorySubject;
      const equivalents = this.memories.filter((m) => m.user_id === user && current(m) && m.type === body.p_type
        && (key(m.content) === key(String(body.p_content)) || m.id === body.p_equivalent_memory_id) && compatible(m, subject)).sort(byId);
      const retained = equivalents.find((m) => this.subjectOf(m.id) === subject);
      if (retained) {
        outcome = 'ALREADY_REMEMBERED';
        for (const copy of equivalents.filter((m) => this.subjectOf(m.id) === null)) dispose(copy, retained.id, 'RECONFIRMED');
      } else {
        const reconfirmed = equivalents.find((m) => this.subjectOf(m.id) === null);
        const created = reconfirmed ? supersede(reconfirmed) : newMemory();
        if (!reconfirmed) this.memories.push(created);
        if (reconfirmed) { outcome = 'RECONFIRMED'; recordedTarget = reconfirmed.id; }
        attribute(created, subject, body.p_answers_command_id ? 'USER_CLARIFIED' : 'EXPLICIT_STATEMENT');
        result = created.id;
        for (const copy of equivalents.filter((m) => m !== reconfirmed && this.subjectOf(m.id) === null)) dispose(copy, created.id, 'RECONFIRMED');
      }
    } else if (outcome === 'CORRECTED') {
      const targetSubject = target ? this.subjectOf(target.id) : null;
      // G-C2 (A): an UNATTRIBUTED fact whose words are also remembered with an established subject is not corrected.
      const establishedCopy = (m: MemoryRecord) => m.user_id === user && m.id !== target!.id && m.type === target!.type && current(m)
        && key(m.content) === key(target!.content) && this.subjectOf(m.id) !== null;
      if (current(target) && !this.memories.some((m) => m.supersedes_memory_id === target!.id)
        && !(targetSubject === null && this.memories.some(establishedCopy))) {
        recordedTarget = target!.id;
        const subject = (body.p_subject as MemorySubject | null) ?? targetSubject;
        const equivalents = this.memories.filter((m) => m.user_id === user && m.id !== target!.id && current(m) && m.type === body.p_type
          && (key(m.content) === key(String(body.p_content)) || m.id === body.p_equivalent_memory_id) && compatible(m, subject)).sort(byId);
        const retained = equivalents.find((m) => subject === null || this.subjectOf(m.id) === subject);
        if (subject === null && equivalents.some((m) => this.subjectOf(m.id))) {
          outcome = 'TARGET_CHANGED'; // L-11: never resolved into an established subject by inference
        } else {
          if (retained) {
            Object.assign(target!, { status: 'SUPERSEDED', updated_at: this.now() });
            outcome = 'CORRECTED_TO_EXISTING'; result = retained.id;
          } else {
            const successor = supersede(target!);
            attribute(successor, subject, !body.p_subject ? 'CORRECTION_INHERITED' : pending?.outcome === 'SUBJECT_CLARIFICATION_REQUIRED' ? 'USER_CLARIFIED' : 'EXPLICIT_STATEMENT');
            result = successor.id;
          }
          for (const copy of equivalents.filter((m) => m.id !== result && this.subjectOf(m.id) === null)) dispose(copy, result!, 'RECONFIRMED');
          for (const copy of this.memories.filter((m) => m.user_id === user && m.id !== target!.id && m.id !== result && m.type === target!.type
            && m.status === 'ACTIVE' && key(m.content) === key(target!.content) && (this.subjectOf(m.id) ?? targetSubject) === targetSubject).sort(byId)) {
            dispose(copy, target!.id, 'CORRECTED');
          }
        }
      } else outcome = 'TARGET_CHANGED';
    } else if (outcome === 'FORGOTTEN') {
      if (target?.status === 'ACTIVE' || target?.status === 'DISABLED') Object.assign(target, { status: 'DELETED', updated_at: this.now() });
      else if (target?.status !== 'DELETED') outcome = 'TARGET_CHANGED';
      if (outcome === 'FORGOTTEN') {
        recordedTarget = target!.id;
        for (const copy of this.memories.filter((m) => m.user_id === user && m.id !== target!.id && m.type === target!.type
          && (m.status === 'ACTIVE' || m.status === 'DISABLED') && key(m.content) === key(target!.content)
          && compatible(m, this.subjectOf(target!.id))).sort(byId)) dispose(copy, target!.id, 'FORGOTTEN');
      }
    } else if (outcome === 'DISABLED') {
      if (current(target)) Object.assign(target!, { status: 'DISABLED', updated_at: this.now() });
      else if (target?.status !== 'DISABLED') outcome = 'TARGET_CHANGED';
      if (outcome === 'DISABLED') {
        recordedTarget = target!.id;
        for (const copy of this.memories.filter((m) => m.user_id === user && m.id !== target!.id && m.type === target!.type && current(m)
          && key(m.content) === key(target!.content) && compatible(m, this.subjectOf(target!.id))).sort(byId)) dispose(copy, target!.id, 'DISABLED');
      }
    }
    if (outcome === 'TARGET_CHANGED') recordedTarget = String(body.p_target_memory_id);
    if (this.commands.some((c) => c.source_turn_id === turn.id)) throw new DataApiError(409);
    this.commands.push({
      id: commandId, user_id: user, session_id: turn.session_id, source_turn_id: turn.id, kind, outcome,
      target_memory_id: ['CORRECTED', 'CORRECTED_TO_EXISTING', 'FORGOTTEN', 'DISABLED', 'TARGET_CHANGED', 'RECONFIRMED'].includes(outcome) ? recordedTarget
        : kind === 'CORRECT' && outcome === 'SUBJECT_CLARIFICATION_REQUIRED' ? String(body.p_target_memory_id) : null,
      result_memory_id: result, candidate_memory_ids: [...candidates], answers_command_id: (body.p_answers_command_id as string | null) ?? null,
    });
    const reply = outcome === 'TARGET_CHANGED' ? String(body.p_reply_if_changed)
      : outcome === 'ALREADY_REMEMBERED' || outcome === 'CORRECTED_TO_EXISTING' ? String(body.p_reply_if_existing) : String(body.p_reply);
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
      // IP-IMP-01: a Memory command never reads or writes the Interaction Preferences record.
      untouchable('INTERACTION_PREFERENCES'),
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
      expect((await say('إيه اللي فاكره عني؟')).reply).toBe('لا أتذكّر عنك شيئًا محددًا حتى الآن.');
      const request = store.request.bind(store);
      jest.spyOn(store, 'request').mockImplementation((token, path, init) => path.startsWith('memories?') ? Promise.reject(new ServiceUnavailableException('Memory persistence is unavailable.')) : request(token, path, init));
      await expect(say('إنت فاكر عني إيه؟')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(store.turns.filter((t) => t.role === 'USER').map((t) => t.status)).toEqual(['COMPLETED', 'FAILED']);
      expect(store.commands).toHaveLength(1);
    });

    it('M-02 «افتكر إن أحمد عنده امتحان الخميس.» creates ONE canonical Memory, and a replay under the same key creates nothing', async () => {
      // MEM-AR-01C (PD-1): a name as the subject does not say whom the fact is about, so QANDEEL asks first - the locked
      // question - and keeps nothing until the answer.
      const asked = await say('افتكر إن أحمد عنده امتحان الخميس.');
      expect(asked.reply).toBe('أهذه المعلومة عنك أنت، أم عن شخص آخر؟');
      expect(store.memories).toHaveLength(0);
      const first = await say('عن حد تاني');
      expect(first.reply).toBe('حسنًا، سأتذكّر هذا: «أحمد عنده امتحان الخميس.»');
      expect(store.memories).toEqual([expect.objectContaining({
        user_id: A, content: 'أحمد عنده امتحان الخميس.', status: 'ACTIVE', source: 'USER_STATED', version: 1, supersedes_memory_id: null,
      })]);
      expect(store.attributions.get(store.memories[0].id)).toEqual(expect.objectContaining({ subject: 'OTHER', basis: 'USER_CLARIFIED' }));

      const replay = await say('عن حد تاني', sessionA, A, first.idempotencyKey);
      expect(replay.assistantTurn?.id).toBe(first.assistantTurn?.id);
      expect(store.memories).toHaveLength(1);
      expect(store.commands).toHaveLength(2);

      // Asked again, the same fact about the same person is already remembered.
      await say('افتكر إن أحمد عنده امتحان الخميس');
      expect((await say('عن حد تاني')).reply).toBe('أتذكّر هذا بالفعل: «أحمد عنده امتحان الخميس.»');
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

      expect(reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا ساكن في طنطا.» بدلًا من «أنا ساكن في أكتوبر.».');
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
      expect(reply).toBe('تغيّرت هذه المعلومة قبل أن أعدّلها، لذلك لم أغيّر شيئًا.');
      expect(store.memories.filter((m) => m.supersedes_memory_id === october.id)).toHaveLength(1);
      expect(activeContents()).toEqual(['أنا ساكن في الجيزة.']);
      expect(store.commands[0]).toEqual(expect.objectContaining({ outcome: 'TARGET_CHANGED', target_memory_id: october.id, result_memory_id: null }));
    });

    it('M-04 «انسى إني بحب كافيه النيل.» marks exactly that Memory DELETED (never removed), and a repeat changes nothing', async () => {
      const cafe = { ...store.remember(A, 'أنا بحب كافيه النيل.', 'STABLE_PREFERENCE') };
      const tea = store.remember(A, 'أنا بحب الشاي بالنعناع.', 'STABLE_PREFERENCE');
      const othersCafe = store.remember(B, 'أنا بحب كافيه النيل.', 'STABLE_PREFERENCE');

      expect((await say('انسى إني بحب كافيه النيل.')).reply).toBe('حسنًا، نسيت «أنا بحب كافيه النيل.» ولن أعود إليه مرة أخرى.');
      expect(memoryOf(cafe.id)).toEqual({ ...cafe, status: 'DELETED', updated_at: expect.any(String) });
      expect(memoryOf(tea.id).status).toBe('ACTIVE');
      expect(memoryOf(othersCafe.id).status).toBe('ACTIVE');

      expect((await say('انسى إني بحب كافيه النيل.')).reply).toBe('لا أجد شيئًا كهذا فيما أتذكّره.');
      expect(store.memories.map((m) => m.status)).toEqual(['DELETED', 'ACTIVE', 'ACTIVE']);
    });

    it('M-05 «متعتمدش على …» is DISABLED, not DELETED: kept, listed as not relied on, and out of the current set', async () => {
      const tea = { ...store.remember(A, 'أنا بحب الشاي بالنعناع.', 'STABLE_PREFERENCE') };

      expect((await say('متعتمدش على إني بحب الشاي بالنعناع')).reply).toBe('حسنًا، لن أعتمد على «أنا بحب الشاي بالنعناع.» في محادثاتنا، لكنني سأظل أتذكّرها.');
      expect(memoryOf(tea.id)).toEqual({ ...tea, status: 'DISABLED', updated_at: expect.any(String) });
      expect(activeContents()).toEqual([]);

      const inspect = await say('إنت فاكر عني إيه؟');
      expect(inspect.reply).toBe('هناك أشياء ما زلت أتذكّرها، لكنني لا أعتمد عليها بناءً على طلبك:\n• «أنا بحب الشاي بالنعناع.»');

      expect((await say('متعتمدش على إني بحب الشاي بالنعناع')).reply).toContain('لن أعتمد على');
      expect(memoryOf(tea.id).status).toBe('DISABLED');
    });

    it('M-05 «متنساش المعلومة، بس متعتمدش عليها معايا.» points at the previous words, so QANDEEL confirms before changing anything', async () => {
      const tea = store.remember(A, 'أنا بحب الشاي بالنعناع.', 'STABLE_PREFERENCE');
      store.exchange(A, sessionA, 'أنا بحب الشاي بالنعناع', 'جميل.');

      const ask = await say('متنساش المعلومة، بس متعتمدش عليها معايا.');
      expect(ask.reply).toBe('هل المقصود «أنا بحب الشاي بالنعناع.»؟');
      expect(memoryOf(tea.id).status).toBe('ACTIVE');

      expect((await say('أيوه')).reply).toContain('لن أعتمد على');
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
      expect(ask.reply).toBe('أيّ هذه المعلومات هي المقصودة؟\n1. «مديري في الشغل صعب.»\n2. «شغلي الجديد في البنك.»\nرقمها يكفي.');
      expectCleanReply(ask.reply);
      expect(JSON.stringify(store.memories)).toBe(before);
      expect(store.commands[0]).toEqual(expect.objectContaining({ kind: 'FORGET', outcome: 'CLARIFICATION_REQUIRED', candidate_memory_ids: [boss.id, bank.id] }));

      expect((await say('2')).reply).toBe('حسنًا، نسيت «شغلي الجديد في البنك.» ولن أعود إليه مرة أخرى.');
      expect(memoryOf(bank.id).status).toBe('DELETED');
      expect(memoryOf(boss.id).status).toBe('ACTIVE');
    });

    it('M-06 an answer only counts right after the question; "no" changes nothing; an answer outside the options asks again', async () => {
      store.remember(A, 'شغلي الجديد في البنك.');
      store.remember(A, 'مديري في الشغل صعب.');
      const before = () => JSON.stringify(store.memories.map((m) => m.status));
      const statuses = before();

      await say('امسح موضوع الشغل.');
      expect((await say('5')).reply).toContain('أيّ هذه المعلومات هي المقصودة؟');
      expect((await say('لا')).reply).toBe('حسنًا، لم أغيّر شيئًا.');
      expect(before()).toBe(statuses);
      // The clarification was answered, so a later "1" is ordinary conversation (and reaches the provider path).
      await expect(say('1')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(touched.length).toBeGreaterThan(0);
      expect(before()).toBe(statuses);
    });
  });

  describe('MEM-AR-01A wording fidelity on the explicit paths (F-1)', () => {
    it('«افتكر إني ساكنة في مدينة نصر» is remembered as said, never as a masculine template', async () => {
      const { reply } = await say('افتكر إني ساكنة في مدينة نصر');
      expect(reply).toBe('حسنًا، سأتذكّر هذا: «أنا ساكنة في مدينة نصر.»');
      expect(store.memories).toEqual([expect.objectContaining({ user_id: A, content: 'أنا ساكنة في مدينة نصر.', type: 'PERSONAL_FACT', status: 'ACTIVE', version: 1 })]);
    });

    it('a legacy template row of the same statement is already remembered, and is left exactly as it was', async () => {
      // MEM-AR-01C: the legacy row is the user's own (a proven first-person capture, SELF), so it is the same Memory.
      const legacy = { ...store.remember(A, 'أنا ساكن في مدينة نصر.', 'PERSONAL_FACT', 'ACTIVE', 'SELF') };
      const { reply } = await say('افتكر إني ساكنة في مدينة نصر');
      expect(reply).toBe('أتذكّر هذا بالفعل: «أنا ساكن في مدينة نصر.»');
      expect(store.memories).toEqual([legacy]);
      expect(store.commands[0]).toEqual(expect.objectContaining({ kind: 'REMEMBER', outcome: 'ALREADY_REMEMBERED' }));
    });

    it('MEM-AR-01C: the same legacy row with no established subject is RECONFIRMED, with lineage, in the user\'s words', async () => {
      const legacy = { ...store.remember(A, 'أنا ساكن في مدينة نصر.') };
      const { reply } = await say('افتكر إني ساكنة في مدينة نصر');
      expect(reply).toBe('حسنًا، سأتذكّر هذا: «أنا ساكنة في مدينة نصر.»');
      expect(memoryOf(legacy.id)).toEqual({ ...legacy, status: 'SUPERSEDED', updated_at: expect.any(String) });
      const successor = store.memories.find((m) => m.supersedes_memory_id === legacy.id)!;
      expect(successor).toEqual(expect.objectContaining({ content: 'أنا ساكنة في مدينة نصر.', version: 2, status: 'ACTIVE' }));
      expect(store.attributions.get(successor.id)).toEqual(expect.objectContaining({ subject: 'SELF', basis: 'EXPLICIT_STATEMENT' }));
      expect(store.commands[0]).toEqual(expect.objectContaining({ kind: 'REMEMBER', outcome: 'RECONFIRMED', target_memory_id: legacy.id, result_memory_id: successor.id }));
    });

    it('a correction keeps the replacement in the user\'s words', async () => {
      const october = store.remember(A, 'أنا ساكن في أكتوبر.');
      const { reply } = await say('أنا مش ساكنة في أكتوبر دلوقتي، أنا ساكنة في طنطا.');
      expect(reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا ساكنة في طنطا.» بدلًا من «أنا ساكن في أكتوبر.».');
      expect(store.memories.find((m) => m.supersedes_memory_id === october.id)).toEqual(expect.objectContaining({ content: 'أنا ساكنة في طنطا.', version: 2, status: 'ACTIVE' }));
      expect(memoryOf(october.id).content).toBe('أنا ساكن في أكتوبر.');
    });
  });

  describe('MEM-AR-01B natural reversal through the existing v1 CORRECT (R-2)', () => {
    const commandShapes = () => store.commands.map((c) => [c.kind, c.outcome]);

    it('«غيرت رأيي، بقيت ساكن في طنطا» supersedes the one remembered residence through the v1 command', async () => {
      const october = { ...store.remember(A, 'أنا ساكن في أكتوبر.') };
      const friend = store.remember(A, 'صاحبي ساكن في الزمالك.');
      const othersOctober = store.remember(B, 'أنا ساكن في أكتوبر.');

      const { reply } = await say('غيرت رأيي، بقيت ساكن في طنطا');

      expect(reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا ساكن في طنطا.» بدلًا من «أنا ساكن في أكتوبر.».');
      expectCleanReply(reply);
      expect(memoryOf(october.id)).toEqual({ ...october, status: 'SUPERSEDED', updated_at: expect.any(String) });
      const successors = store.memories.filter((m) => m.supersedes_memory_id === october.id);
      expect(successors).toEqual([expect.objectContaining({ user_id: A, content: 'أنا ساكن في طنطا.', type: 'PERSONAL_FACT', version: 2, status: 'ACTIVE' })]);
      expect([memoryOf(friend.id).status, memoryOf(othersOctober.id).status]).toEqual(['ACTIVE', 'ACTIVE']);
      expect(store.commands).toEqual([expect.objectContaining({ kind: 'CORRECT', outcome: 'CORRECTED', target_memory_id: october.id, result_memory_id: successors[0].id })]);
      expect(store.serviceCalls.filter((name) => name.startsWith('server_'))).toEqual(['server_finalize_memory_control_turn_v2']);
    });

    it('«أنا مبقتش بحب القهوة» is a correction, not a forget: the successor keeps the words, the type is inherited', async () => {
      const coffee = { ...store.remember(A, 'أنا بحب القهوة.', 'STABLE_PREFERENCE') };
      const tea = store.remember(A, 'أنا بحب الشاي.', 'STABLE_PREFERENCE');

      const { reply } = await say('أنا مبقتش بحب القهوة');

      expect(reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا مبقتش بحب القهوة.» بدلًا من «أنا بحب القهوة.».');
      expectCleanReply(reply);
      expect(memoryOf(coffee.id)).toEqual({ ...coffee, status: 'SUPERSEDED', updated_at: expect.any(String) });
      expect(store.memories.filter((m) => m.supersedes_memory_id === coffee.id)).toEqual([
        expect.objectContaining({ content: 'أنا مبقتش بحب القهوة.', type: 'STABLE_PREFERENCE', version: 2, status: 'ACTIVE', importance: 0.75 }),
      ]);
      expect(memoryOf(tea.id).status).toBe('ACTIVE');
      expect(commandShapes()).toEqual([['CORRECT', 'CORRECTED']]);
    });

    it('«أنا بطلت أشرب قهوة» corrects the remembered habit «بشرب قهوة» it names', async () => {
      const habit = { ...store.remember(A, 'أنا بشرب قهوة كل يوم.') };
      const { reply } = await say('أنا بطلت أشرب قهوة');
      expect(reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا بطلت أشرب قهوة.» بدلًا من «أنا بشرب قهوة كل يوم.».');
      expect(memoryOf(habit.id).status).toBe('SUPERSEDED');
      expect(store.memories.filter((m) => m.supersedes_memory_id === habit.id)).toEqual([expect.objectContaining({ content: 'أنا بطلت أشرب قهوة.', type: 'PERSONAL_FACT', version: 2 })]);
    });

    it('two remembered residences: QANDEEL asks, changes nothing, then corrects only the chosen one', async () => {
      const october = store.remember(A, 'أنا ساكن في أكتوبر.');
      const maadi = store.remember(A, 'أنا عايش في المعادي.');
      const before = JSON.stringify(store.memories);

      const ask = await say('غيرت رأيي، بقيت ساكن في طنطا');
      expect(ask.reply).toBe('أيّ هذه المعلومات هي المقصودة؟\n1. «أنا عايش في المعادي.»\n2. «أنا ساكن في أكتوبر.»\nرقمها يكفي.');
      expectCleanReply(ask.reply);
      expect(JSON.stringify(store.memories)).toBe(before);

      expect((await say('2')).reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا ساكن في طنطا.» بدلًا من «أنا ساكن في أكتوبر.».');
      expect([memoryOf(october.id).status, memoryOf(maadi.id).status]).toEqual(['SUPERSEDED', 'ACTIVE']);
      expect(commandShapes()).toEqual([['CORRECT', 'CLARIFICATION_REQUIRED'], ['CORRECT', 'CORRECTED']]);
      expect(store.commands[1].answers_command_id).toBe(store.commands[0].id);
    });

    it('an answered negation keeps the inherited type', async () => {
      const morning = store.remember(A, 'أنا بحب القهوة الصبح.', 'STABLE_PREFERENCE');
      const night = store.remember(A, 'أنا بحب القهوة بالليل.', 'STABLE_PREFERENCE');
      expect((await say('أنا مبقتش بحب القهوة')).reply).toContain('أيّ هذه المعلومات هي المقصودة؟');
      expect((await say('التانية')).reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا مبقتش بحب القهوة.» بدلًا من «أنا بحب القهوة الصبح.».');
      expect([memoryOf(night.id).status, memoryOf(morning.id).status]).toEqual(['ACTIVE', 'SUPERSEDED']);
      expect(store.memories.find((m) => m.supersedes_memory_id === morning.id)).toEqual(expect.objectContaining({ type: 'STABLE_PREFERENCE', content: 'أنا مبقتش بحب القهوة.' }));
    });

    it('ordinary conversation: no target, a multi-valued frame, no cue, a question, or reported words change nothing and commit no command', async () => {
      const coffee = store.remember(A, 'أنا بحب القهوة.', 'STABLE_PREFERENCE');
      const ful = store.remember(A, 'أنا بحب الفول.', 'STABLE_PREFERENCE');
      const before = JSON.stringify(store.memories);
      for (const content of [
        'بقيت بحب الشاي', // a new preference never cancels another
        'أنا بحب الكشري', // no cue
        'أنا بطلت أشرب قهوة', // «بشرب» is not remembered: no unique fact to reverse
        'غيرت رأيي، بقيت ساكن في طنطا', // no remembered residence
        'قالي: أنا مبقتش بحب القهوة', // reported speech
        'أنا مبقتش بحب القهوة؟', // a question
      ]) {
        touched.length = 0;
        await expect(say(content)).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(touched).toContain('FOREGROUND_GATHER');
      }
      expect(JSON.stringify(store.memories)).toBe(before);
      expect([memoryOf(coffee.id).status, memoryOf(ful.id).status]).toEqual(['ACTIVE', 'ACTIVE']);
      expect(store.commands).toHaveLength(0);
    });

    it('ordinary conversation after a committed reversal: repeating it finds nothing left to reverse', async () => {
      store.remember(A, 'أنا بحب القهوة.', 'STABLE_PREFERENCE');
      await say('أنا مبقتش بحب القهوة');
      const after = JSON.stringify(store.memories);
      touched.length = 0;
      await expect(say('أنا مبقتش بحب القهوة')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(touched).toContain('FOREGROUND_GATHER');
      expect(JSON.stringify(store.memories)).toBe(after);
      expect(commandShapes()).toEqual([['CORRECT', 'CORRECTED']]);
    });
  });

  describe('MEM-AR-01C subject identity, equivalence and copy (S-1, S-3, D-1, G-1)', () => {
    const shapes = () => store.commands.map((c) => [c.kind, c.outcome]);

    it('S-3: decisive subjects are kept with them; an undecided one asks the locked question and keeps nothing', async () => {
      for (const [request, subject] of [
        ['افتكر إن أختي بتحب الكشري', 'OTHER'], ['افتكر إن أمي عايزاني أتجوز قريب', 'OTHER'],
        ['افتكر إني بتخانق مع أختي', 'SELF'], ['افتكر إني بحب الطريقة اللي أخويا بيتعامل بيها', 'SELF'],
        ['Remember that my sister hates kids', 'OTHER'],
      ] as const) {
        const before = store.memories.length;
        await say(request);
        expect(store.memories).toHaveLength(before + 1);
        expect(store.attributions.get(store.memories[before].id)?.subject).toBe(subject);
      }
      for (const request of ['افتكر إن ساكنة في طنطا', 'افتكر إن أحمد بيحب الكورة', 'افتكر إني عارف إن أختي بتحب الكشري']) {
        const before = store.memories.length;
        expect((await say(request)).reply).toBe('أهذه المعلومة عنك أنت، أم عن شخص آخر؟');
        expect(store.memories).toHaveLength(before);
      }
      expect((await say('Remember that Sam loves football')).reply).toBe('Is this about you or someone else?');
    });

    it('S-1: «عني» keeps the question turn\'s words as the user\'s; «لا» keeps nothing; anything else lets the question lapse', async () => {
      await say('افتكر إن ساكنة في طنطا');
      expect((await say('عني')).reply).toBe('حسنًا، سأتذكّر هذا: «ساكنة في طنطا.»');
      const kept = store.memories.at(-1)!;
      expect(store.attributions.get(kept.id)).toEqual(expect.objectContaining({ subject: 'SELF', basis: 'USER_CLARIFIED' }));
      expect(store.commands[1]).toEqual(expect.objectContaining({ kind: 'REMEMBER', outcome: 'REMEMBERED', answers_command_id: store.commands[0].id }));

      await say('افتكر إن أحمد بيحب الكورة');
      expect((await say('لا')).reply).toBe('حسنًا، لم أغيّر شيئًا.');
      expect(store.memories).toHaveLength(1);

      await say('افتكر إن منى عندها شغل بكرة');
      touched.length = 0;
      await expect(say('ماشي يا عم')).rejects.toBeInstanceOf(ServiceUnavailableException); // not an answer: ordinary
      touched.length = 0;
      await expect(say('عن حد تاني')).rejects.toBeInstanceOf(ServiceUnavailableException); // the question lapsed
      expect(store.memories).toHaveLength(1);
      expect(shapes()).toEqual([
        ['REMEMBER', 'SUBJECT_CLARIFICATION_REQUIRED'], ['REMEMBER', 'REMEMBERED'],
        ['REMEMBER', 'SUBJECT_CLARIFICATION_REQUIRED'], ['REMEMBER', 'CLARIFICATION_DECLINED'],
        ['REMEMBER', 'SUBJECT_CLARIFICATION_REQUIRED'],
      ]);
      touched.length = 0;
    });

    it('S-1: a sensitive request is declined before any question is asked', async () => {
      expect((await say('افتكر إن الباسورد بتاع أحمد 123456')).reply).toContain('حساسة');
      expect(shapes()).toEqual([['REMEMBER', 'DECLINED_SENSITIVE']]);
      expect(store.memories).toHaveLength(0);
    });

    it('G-1: what the user said about other people has its own section, in the locked words', async () => {
      store.remember(A, 'أنا ساكن في أكتوبر.', 'PERSONAL_FACT', 'ACTIVE', 'SELF');
      store.remember(A, 'أختي بتحب الكشري.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER');
      expect((await say('إنت فاكر عني إيه؟')).reply)
        .toBe('هذا ما أتذكّره من محادثاتنا:\n• «أنا ساكن في أكتوبر.»\nوهناك أيضًا أشياء أخبرتني بها عن أشخاص آخرين:\n• «أختي بتحب الكشري.»');
      const sessionB = store.session(B);
      store.remember(B, 'My sister hates kids.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER');
      expect((await say('What do you remember about me?', sessionB, B)).reply)
        .toBe("Here are some things you've told me about other people:\n• “My sister hates kids.”");
      store.remember(B, 'I live in Tanta.', 'PERSONAL_FACT', 'ACTIVE', 'SELF');
      expect((await say('What do you remember about me?', sessionB, B)).reply)
        .toBe("Here's what I remember from our conversations:\n• “I live in Tanta.”\nAnd here are some things you've told me about other people:\n• “My sister hates kids.”");
    });

    it('D-1: a correction into a value already remembered keeps that Memory - CORRECTED_TO_EXISTING, one ACTIVE copy', async () => {
      const october = { ...store.remember(A, 'أنا ساكن في أكتوبر.', 'PERSONAL_FACT', 'ACTIVE', 'SELF') };
      const tanta = { ...store.remember(A, 'أنا ساكن في طنطا.', 'PERSONAL_FACT', 'ACTIVE', 'SELF') };
      const { reply } = await say('أنا مش ساكن في أكتوبر دلوقتي، أنا ساكن في طنطا.');
      expect(reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا ساكن في طنطا.» بدلًا من «أنا ساكن في أكتوبر.».');
      expect(memoryOf(october.id)).toEqual({ ...october, status: 'SUPERSEDED', updated_at: expect.any(String) });
      expect(memoryOf(tanta.id)).toEqual(tanta);
      expect(store.memories).toHaveLength(2);
      expect(store.commands).toEqual([expect.objectContaining({ kind: 'CORRECT', outcome: 'CORRECTED_TO_EXISTING', target_memory_id: october.id, result_memory_id: tanta.id })]);
    });

    it('D-1: forgetting a fact kept twice forgets every copy, each with its disposition', async () => {
      const first = store.remember(A, 'أنا بحب القهوة.', 'STABLE_PREFERENCE', 'ACTIVE', 'SELF');
      const copy = store.remember(A, 'أنا بحب القهوة', 'STABLE_PREFERENCE');
      const ask = await say('انسى إني بحب القهوة');
      expect(ask.reply).toMatch(/^حسنًا، نسيت «أنا بحب القهوة\.?»/u);
      expect([memoryOf(first.id).status, memoryOf(copy.id).status]).toEqual(['DELETED', 'DELETED']);
      expect(store.dispositions).toEqual([expect.objectContaining({ disposition: 'FORGOTTEN', command_id: store.commands[0].id })]);
    });

    // RC-C2: the same words about the user and about someone else are two facts. A command about one never changes the
    // other because the words match, and QANDEEL never picks one of them by read order: it asks.
    it('RC-C2: FORGET asks between the user\'s fact and someone else\'s with the same words, and forgets only the chosen one', async () => {
      const mine = store.remember(A, 'عيد الميلاد يوم ٥ مارس.', 'PERSONAL_FACT', 'ACTIVE', 'SELF');
      const theirs = store.remember(A, 'عيد الميلاد يوم ٥ مارس.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER');
      const strangers = store.remember(B, 'عيد الميلاد يوم ٥ مارس.', 'PERSONAL_FACT', 'ACTIVE', 'SELF');
      const before = JSON.stringify(store.memories);
      const ask = await say('انسى إن عيد الميلاد يوم ٥ مارس');
      expect(ask.reply).toContain('أيّ هذه المعلومات هي المقصودة؟');
      expect(JSON.stringify(store.memories)).toBe(before);
      const [first, second] = store.commands[0].candidate_memory_ids;
      expect([first, second].sort()).toEqual([mine.id, theirs.id].sort());
      await say('1');
      expect(memoryOf(first).status).toBe('DELETED');
      expect(memoryOf(second).status).toBe('ACTIVE');
      expect(memoryOf(strangers.id).status).toBe('ACTIVE');
      expect(store.dispositions).toEqual([]);
      expect(store.commands[1]).toEqual(expect.objectContaining({ kind: 'FORGET', outcome: 'FORGOTTEN', target_memory_id: first, answers_command_id: store.commands[0].id }));
    });

    it('RC-C2: DISABLE asks the same way and leaves the other person\'s fact relied on', async () => {
      const mine = store.remember(A, 'بيحب الكورة.', 'STABLE_PREFERENCE', 'ACTIVE', 'SELF');
      const theirs = store.remember(A, 'بيحب الكورة.', 'STABLE_PREFERENCE', 'ACTIVE', 'OTHER');
      expect((await say('متعتمدش على إن بيحب الكورة')).reply).toContain('أيّ هذه المعلومات هي المقصودة؟');
      const [, second] = store.commands[0].candidate_memory_ids;
      await say('2');
      expect(memoryOf(second).status).toBe('DISABLED');
      expect(memoryOf(second === mine.id ? theirs.id : mine.id).status).toBe('ACTIVE');
      expect(store.dispositions).toEqual([]);
    });

    it('RC-C2: an UNATTRIBUTED copy goes with the chosen fact; the other person\'s copy stays, and each change has its provenance', async () => {
      const mine = store.remember(A, 'بيحب الكورة.', 'STABLE_PREFERENCE', 'ACTIVE', 'SELF');
      const theirs = store.remember(A, 'بيحب الكورة.', 'STABLE_PREFERENCE', 'ACTIVE', 'OTHER');
      const legacy = store.remember(A, 'بيحب الكورة', 'STABLE_PREFERENCE');
      await say('انسى إن بيحب الكورة');
      // The unattributed copy is not offered as a third option in place of a fact whose subject is known.
      expect([...store.commands[0].candidate_memory_ids].sort()).toEqual([mine.id, theirs.id].sort());
      await say(String(store.commands[0].candidate_memory_ids.indexOf(mine.id) + 1));
      expect([memoryOf(mine.id).status, memoryOf(legacy.id).status, memoryOf(theirs.id).status]).toEqual(['DELETED', 'DELETED', 'ACTIVE']);
      expect(store.dispositions).toEqual([{ memory_id: legacy.id, command_id: store.commands[1].id, primary_memory_id: mine.id, disposition: 'FORGOTTEN' }]);
    });

    it('RC-C2: a correction asks between the two facts, corrects only the chosen one, and never ends in the other person\'s', async () => {
      const mine = store.remember(A, 'ساكن في أكتوبر.', 'PERSONAL_FACT', 'ACTIVE', 'SELF');
      const theirs = store.remember(A, 'ساكن في أكتوبر.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER');
      expect((await say('لا، مش ساكن في أكتوبر، ساكن في إسكندرية')).reply).toContain('أيّ هذه المعلومات هي المقصودة؟');
      await say(String(store.commands[0].candidate_memory_ids.indexOf(theirs.id) + 1));
      const successor = store.memories.find((m) => m.supersedes_memory_id === theirs.id)!;
      expect(store.attributions.get(successor.id)).toEqual(expect.objectContaining({ subject: 'OTHER', basis: 'CORRECTION_INHERITED' }));
      expect(memoryOf(mine.id).status).toBe('ACTIVE');
      expect(store.dispositions).toEqual([]);
    });

    it('RC-C2: CORRECTED_TO_EXISTING keeps only a Memory with the successor\'s subject, never someone else\'s', async () => {
      // Someone else's «أنا ساكن في طنطا.» is not the user's new residence: the user's correction is a new attributed
      // successor, and the other fact is untouched.
      const october = store.remember(A, 'أنا ساكن في أكتوبر.', 'PERSONAL_FACT', 'ACTIVE', 'SELF');
      const otherTanta = { ...store.remember(A, 'أنا ساكن في طنطا.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER') };
      await say('أنا مش ساكن في أكتوبر دلوقتي، أنا ساكن في طنطا.');
      const corrected = store.memories.find((m) => m.supersedes_memory_id === october.id)!;
      expect(store.commands.at(-1)).toEqual(expect.objectContaining({ kind: 'CORRECT', outcome: 'CORRECTED', target_memory_id: october.id, result_memory_id: corrected.id }));
      expect(store.attributions.get(corrected.id)?.subject).toBe('SELF');
      expect(memoryOf(otherTanta.id)).toEqual(otherTanta);
    });

    it('a correction says whose fact it is only when its words decide it; otherwise it keeps its target\'s', async () => {
      const mine = store.remember(A, 'أنا ساكن في أكتوبر.', 'PERSONAL_FACT', 'ACTIVE', 'SELF');
      await say('لا، مش ساكن في أكتوبر، ساكن في إسكندرية');
      const successor = store.memories.find((m) => m.supersedes_memory_id === mine.id)!;
      expect(store.attributions.get(successor.id)).toEqual(expect.objectContaining({ subject: 'SELF', basis: 'CORRECTION_INHERITED' }));
      const legacy = store.remember(A, 'أنا شغال في البنك.');
      await say('لا، مش شغال في البنك، شغال في الشركة');
      const unattributed = store.memories.find((m) => m.supersedes_memory_id === legacy.id)!;
      expect(store.attributions.has(unattributed.id)).toBe(false);
      // Said with «أنا», the same correction is the user's own statement.
      const job = store.remember(A, 'أنا شغال في المصنع.');
      await say('لا، أنا مش شغال في المصنع، شغال في المكتب');
      expect(store.attributions.get(store.memories.find((m) => m.supersedes_memory_id === job.id)!.id)).toEqual(expect.objectContaining({ subject: 'SELF', basis: 'EXPLICIT_STATEMENT' }));
    });
  });

  // L-10 / L-11 (Product Owner decisions, 2026-10-12).
  describe('MEM-AR-01C G-C2 decisions: subject labels (L-10) and no cross-subject correction by inference (L-11)', () => {
    const shapes = () => store.commands.map((c) => [c.kind, c.outcome]);
    const labelOf = (id: string) => (store.subjectOf(id) === 'SELF' ? 'عنك أنت' : 'عن شخص آخر');

    it('L-10: identical options with different subjects say whom each is about; the numbers still name the same Memories', async () => {
      const mine = store.remember(A, 'عيد الميلاد يوم ٥ مارس.', 'PERSONAL_FACT', 'ACTIVE', 'SELF');
      const theirs = store.remember(A, 'عيد الميلاد يوم ٥ مارس.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER');
      const ask = await say('انسى إن عيد الميلاد يوم ٥ مارس');
      const [first, second] = store.commands[0].candidate_memory_ids;
      expect([first, second].sort()).toEqual([mine.id, theirs.id].sort());
      expect(ask.reply).toBe(`أيّ هذه المعلومات هي المقصودة؟\n1. «عيد الميلاد يوم ٥ مارس.» — ${labelOf(first)}\n2. «عيد الميلاد يوم ٥ مارس.» — ${labelOf(second)}\nرقمها يكفي.`);
      expectCleanReply(ask.reply);
      expect(ask.reply).not.toMatch(/SELF|OTHER|UNATTRIBUTED/u);
      // Asked again (an answer outside the options), the same labels follow the same Memories.
      expect((await say('5')).reply).toBe(ask.reply);
      expect(store.commands[1].candidate_memory_ids).toEqual([first, second]);
      await say('2');
      expect([memoryOf(second).status, memoryOf(first).status]).toEqual(['DELETED', 'ACTIVE']);
      expect(store.commands[2]).toEqual(expect.objectContaining({ kind: 'FORGET', outcome: 'FORGOTTEN', target_memory_id: second }));
    });

    it('L-10: in English, the approved labels', async () => {
      const sessionB = store.session(B);
      store.remember(B, 'Birthday is on March 5.', 'PERSONAL_FACT', 'ACTIVE', 'SELF');
      store.remember(B, 'Birthday is on March 5.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER');
      const ask = await say('Forget that birthday is on March 5', sessionB, B);
      const labels = store.commands[0].candidate_memory_ids.map((id) => (store.subjectOf(id) === 'SELF' ? 'about you' : 'about someone else'));
      expect(ask.reply).toBe(`Which one do you mean?\n1. “Birthday is on March 5.” — ${labels[0]}\n2. “Birthday is on March 5.” — ${labels[1]}\nThe number is enough.`);
    });

    it('L-10: labels only where the words alone cannot tell the options apart, and never on an UNATTRIBUTED Memory', async () => {
      // Different words: the existing wording, unchanged, whatever the subjects.
      store.remember(A, 'شغلي الجديد في البنك.', 'PERSONAL_FACT', 'ACTIVE', 'SELF');
      store.remember(A, 'مديري في الشغل صعب.', 'RELATIONSHIP_CONTEXT', 'ACTIVE', 'OTHER');
      expect((await say('امسح موضوع الشغل.')).reply).toBe('أيّ هذه المعلومات هي المقصودة؟\n1. «مديري في الشغل صعب.»\n2. «شغلي الجديد في البنك.»\nرقمها يكفي.');
      await say('لا');
      // The same words with no established subject (two kinds of fact): no label is invented.
      store.remember(A, 'بيحب الكورة.', 'STABLE_PREFERENCE');
      store.remember(A, 'بيحب الكورة.', 'PERSONAL_FACT');
      expect((await say('انسى إن بيحب الكورة')).reply).toBe('أيّ هذه المعلومات هي المقصودة؟\n1. «بيحب الكورة.»\n2. «بيحب الكورة.»\nرقمها يكفي.');
      // The copy rule itself: SELF and OTHER are labelled, the UNATTRIBUTED copy of the same words is not.
      expect(clarificationReply('ar', ['س', 'س', 'س'], false, ['SELF', 'OTHER', null]))
        .toBe('أيّ هذه المعلومات هي المقصودة؟\n1. «س» — عنك أنت\n2. «س» — عن شخص آخر\n3. «س»\nرقمها يكفي.');
      expect(clarificationReply('en', ['x', 'x'], false, ['SELF', null])).toBe('Which one do you mean?\n1. “x”\n2. “x”\nThe number is enough.');
      expect(clarificationReply('en', ['x', 'x'], false, ['OTHER', 'OTHER'])).toBe('Which one do you mean?\n1. “x”\n2. “x”\nThe number is enough.');
    });

    it('L-11: an UNATTRIBUTED fact whose new value is the user\'s own asks first, changes nothing, then «عني» keeps the user\'s Memory', async () => {
      const legacy = { ...store.remember(A, 'شغال في البنك.') };
      const mine = { ...store.remember(A, 'أنا شغال في الشركة.', 'PERSONAL_FACT', 'ACTIVE', 'SELF') };
      const before = JSON.stringify(store.memories);
      const ask = await say('لا، مش شغال في البنك، شغال في الشركة');
      expect(ask.reply).toBe('أهذه المعلومة عنك أنت، أم عن شخص آخر؟');
      expect(JSON.stringify(store.memories)).toBe(before);
      expect(store.commands[0]).toEqual(expect.objectContaining({ kind: 'CORRECT', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', target_memory_id: legacy.id, result_memory_id: null, candidate_memory_ids: [] }));
      expect(store.attributions.has(legacy.id)).toBe(false);

      const answer = await say('عني');
      expect(answer.reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا شغال في الشركة.» بدلًا من «شغال في البنك.».');
      expect(memoryOf(legacy.id)).toEqual({ ...legacy, status: 'SUPERSEDED', updated_at: expect.any(String) });
      expect(memoryOf(mine.id)).toEqual(mine);
      expect(store.commands[1]).toEqual(expect.objectContaining({
        kind: 'CORRECT', outcome: 'CORRECTED_TO_EXISTING', target_memory_id: legacy.id, result_memory_id: mine.id, answers_command_id: store.commands[0].id,
      }));
      expect(store.attributions.has(legacy.id)).toBe(false);
    });

    it('L-11: answered «عن حد تاني», the correction is someone else\'s new fact; the user\'s Memory is never merged or touched', async () => {
      const legacy = store.remember(A, 'شغال في البنك.');
      const mine = { ...store.remember(A, 'أنا شغال في الشركة.', 'PERSONAL_FACT', 'ACTIVE', 'SELF') };
      await say('لا، مش شغال في البنك، شغال في الشركة');
      expect((await say('عن حد تاني')).reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا شغال في الشركة.» بدلًا من «شغال في البنك.».');
      const successor = store.memories.find((m) => m.supersedes_memory_id === legacy.id)!;
      expect(successor).toEqual(expect.objectContaining({ content: 'أنا شغال في الشركة.', status: 'ACTIVE', version: 2 }));
      expect(store.attributions.get(successor.id)).toEqual(expect.objectContaining({ subject: 'OTHER', basis: 'USER_CLARIFIED', command_id: store.commands[1].id }));
      expect(memoryOf(mine.id)).toEqual(mine);
      expect(store.dispositions).toEqual([]);
    });

    it('L-11: someone else\'s existing value and the answer «عني» give the user a new fact; theirs stays exactly as it was', async () => {
      const legacy = store.remember(A, 'ساكن في أكتوبر.');
      const theirs = { ...store.remember(A, 'أنا ساكن في طنطا.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER') };
      expect((await say('لا، مش ساكن في أكتوبر، ساكن في طنطا')).reply).toBe('أهذه المعلومة عنك أنت، أم عن شخص آخر؟');
      await say('عني');
      const successor = store.memories.find((m) => m.supersedes_memory_id === legacy.id)!;
      expect(store.attributions.get(successor.id)).toEqual(expect.objectContaining({ subject: 'SELF', basis: 'USER_CLARIFIED' }));
      expect(memoryOf(theirs.id)).toEqual(theirs);
      expect(shapes()).toEqual([['CORRECT', 'SUBJECT_CLARIFICATION_REQUIRED'], ['CORRECT', 'CORRECTED']]);
    });

    it('L-11: «لا», an unrelated reply, a late answer and a repeated answer change nothing', async () => {
      const legacy = store.remember(A, 'شغال في البنك.');
      store.remember(A, 'أنا شغال في الشركة.', 'PERSONAL_FACT', 'ACTIVE', 'SELF');
      const before = JSON.stringify(store.memories);
      await say('لا، مش شغال في البنك، شغال في الشركة');
      expect((await say('لا')).reply).toBe('حسنًا، لم أغيّر شيئًا.');
      expect(JSON.stringify(store.memories)).toBe(before);
      expect(store.commands[1]).toEqual(expect.objectContaining({ kind: 'CORRECT', outcome: 'CLARIFICATION_DECLINED', answers_command_id: store.commands[0].id, target_memory_id: null }));
      // Answered once, the question is no longer pending: a repeated answer is ordinary conversation.
      touched.length = 0;
      await expect(say('عني')).rejects.toBeInstanceOf(ServiceUnavailableException);
      // Unanswered: an unrelated reply lets it lapse, and a later answer is ordinary conversation too.
      await say('لا، مش شغال في البنك، شغال في الشركة');
      touched.length = 0;
      await expect(say('ماشي يا عم')).rejects.toBeInstanceOf(ServiceUnavailableException);
      touched.length = 0;
      await expect(say('عن حد تاني')).rejects.toBeInstanceOf(ServiceUnavailableException);
      touched.length = 0;
      expect(JSON.stringify(store.memories)).toBe(before);
      expect(store.attributions.has(legacy.id)).toBe(false);
      expect(shapes()).toEqual([
        ['CORRECT', 'SUBJECT_CLARIFICATION_REQUIRED'], ['CORRECT', 'CLARIFICATION_DECLINED'], ['CORRECT', 'SUBJECT_CLARIFICATION_REQUIRED'],
      ]);
    });

    it('L-11: chosen by "which one?", the correction asks the subject question and its answer keeps the original request', async () => {
      const fact = store.remember(A, 'ساكن في أكتوبر.', 'PERSONAL_FACT');
      const preference = store.remember(A, 'ساكن في أكتوبر.', 'STABLE_PREFERENCE');
      expect((await say('لا، مش ساكن في أكتوبر، ساكن في إسكندرية')).reply).toBe('أيّ هذه المعلومات هي المقصودة؟\n1. «ساكن في أكتوبر.»\n2. «ساكن في أكتوبر.»\nرقمها يكفي.');
      // Between the two turns, the new value is remembered about someone else.
      const theirs = { ...store.remember(A, 'أنا ساكن في إسكندرية.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER') };
      const chosen = store.commands[0].candidate_memory_ids.indexOf(fact.id) + 1;
      expect((await say(String(chosen))).reply).toBe('أهذه المعلومة عنك أنت، أم عن شخص آخر؟');
      expect(store.commands[1]).toEqual(expect.objectContaining({ kind: 'CORRECT', outcome: 'SUBJECT_CLARIFICATION_REQUIRED', target_memory_id: fact.id, answers_command_id: store.commands[0].id }));
      expect((await say('عني')).reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا ساكن في إسكندرية.» بدلًا من «ساكن في أكتوبر.».');
      const successor = store.memories.find((m) => m.supersedes_memory_id === fact.id)!;
      expect(store.attributions.get(successor.id)).toEqual(expect.objectContaining({ subject: 'SELF', basis: 'USER_CLARIFIED' }));
      expect([memoryOf(preference.id).status, memoryOf(theirs.id)]).toEqual(['ACTIVE', theirs]);
    });

    it('L-11: a value of an established subject that appears after the read is never merged into - nothing changes', async () => {
      const legacy = { ...store.remember(A, 'شغال في البنك.') };
      let theirs: MemoryRecord | undefined;
      store.beforeMemoryControlCommand = () => { theirs = { ...store.remember(A, 'أنا شغال في الشركة.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER') }; };
      expect((await say('لا، مش شغال في البنك، شغال في الشركة')).reply).toBe('تغيّرت هذه المعلومة قبل أن أعدّلها، لذلك لم أغيّر شيئًا.');
      expect(memoryOf(legacy.id)).toEqual(legacy);
      expect(memoryOf(theirs!.id)).toEqual(theirs);
      expect(store.memories).toHaveLength(2);
      expect(shapes()).toEqual([['CORRECT', 'TARGET_CHANGED']]);
    });

    it('L-11: an UNATTRIBUTED correction with no remembered value of an established subject is unchanged - no question, no attribution', async () => {
      const legacy = store.remember(A, 'شغال في البنك.');
      const unattributedCopy = store.remember(A, 'أنا شغال في الشركة.');
      await say('لا، مش شغال في البنك، شغال في الشركة');
      expect(store.commands).toEqual([expect.objectContaining({ kind: 'CORRECT', outcome: 'CORRECTED_TO_EXISTING', target_memory_id: legacy.id, result_memory_id: unattributedCopy.id })]);
      expect(store.attributions.size).toBe(0);
    });
  });

  // G-C2 final corrections (Product Owner, 2026-10-12): A (no cross-subject old-fact retirement) and B / L-12 (no
  // misleading ALREADY_CORRECT).
  describe('MEM-AR-01C G-C2 final corrections: established facts never change by matching words (A), no false "already" (L-12)', () => {
    const shapes = () => store.commands.map((c) => [c.kind, c.outcome]);
    const options = (...ids: string[]) => ids.map((id) => store.commands.at(-1)!.candidate_memory_ids.indexOf(id) + 1);

    it.each([[['SELF']], [['OTHER']], [['SELF', 'OTHER']]] as MemorySubject[][][])(
      'A: a %j copy of an UNATTRIBUTED fact\'s words that appears after the read is never retired - nothing changes',
      async (subjects) => {
        const legacy = { ...store.remember(A, 'شغال في البنك.') };
        let copies: MemoryRecord[] = [];
        store.beforeMemoryControlCommand = () => {
          copies = subjects.map((subject) => ({ ...store.remember(A, 'شغال في البنك.', 'PERSONAL_FACT', 'ACTIVE', subject) }));
        };
        expect((await say('لا، مش شغال في البنك، شغال في الشركة')).reply).toBe('تغيّرت هذه المعلومة قبل أن أعدّلها، لذلك لم أغيّر شيئًا.');
        expect(memoryOf(legacy.id)).toEqual(legacy);
        for (const copy of copies) expect(memoryOf(copy.id)).toEqual(copy);
        expect(store.memories).toHaveLength(1 + subjects.length);
        expect(store.dispositions).toEqual([]);
        expect(store.commands).toEqual([expect.objectContaining({ kind: 'CORRECT', outcome: 'TARGET_CHANGED', target_memory_id: legacy.id, result_memory_id: null })]);
      },
    );

    it('A: an UNATTRIBUTED fact still takes its own UNATTRIBUTED legacy copies with it', async () => {
      const pair = [store.remember(A, 'شغال في البنك.').id, store.remember(A, 'شغال في البنك.').id];
      expect((await say('لا، مش شغال في البنك، شغال في الشركة')).reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا شغال في الشركة.» بدلًا من «شغال في البنك.».');
      const target = store.commands[0].target_memory_id!;
      const [copy] = pair.filter((id) => id !== target);
      const successor = store.memories.find((m) => m.supersedes_memory_id === target)!;
      expect([memoryOf(target).status, memoryOf(copy).status, successor.status]).toEqual(['SUPERSEDED', 'SUPERSEDED', 'ACTIVE']);
      expect(store.dispositions).toEqual([{ memory_id: copy, command_id: store.commands[0].id, primary_memory_id: target, disposition: 'CORRECTED' }]);
      expect(store.attributions.size).toBe(0);
    });

    it('L-12: the old fact is ambiguous and the new value is remembered only about someone else - QANDEEL asks which one, never "already"', async () => {
      const fact = store.remember(A, 'أنا ساكن في أكتوبر.', 'PERSONAL_FACT');
      const preference = store.remember(A, 'أنا ساكن في أكتوبر.', 'STABLE_PREFERENCE');
      const theirs = { ...store.remember(A, 'أنا ساكن في طنطا.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER') };
      const before = JSON.stringify(store.memories);
      const ask = await say('أنا مش ساكن في أكتوبر، أنا ساكن في طنطا');
      expect(ask.reply).toBe('أيّ هذه المعلومات هي المقصودة؟\n1. «أنا ساكن في أكتوبر.»\n2. «أنا ساكن في أكتوبر.»\nرقمها يكفي.');
      expect(ask.reply).not.toContain('فاكرها كده أصلًا');
      expect(JSON.stringify(store.memories)).toBe(before);
      const [chosen] = options(fact.id);
      expect((await say(String(chosen))).reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا ساكن في طنطا.» بدلًا من «أنا ساكن في أكتوبر.».');
      const successor = store.memories.find((m) => m.supersedes_memory_id === fact.id)!;
      expect(store.attributions.get(successor.id)).toEqual(expect.objectContaining({ subject: 'SELF', basis: 'EXPLICIT_STATEMENT' }));
      expect([memoryOf(theirs.id), memoryOf(preference.id).status]).toEqual([theirs, 'ACTIVE']);
      expect(shapes()).toEqual([['CORRECT', 'CLARIFICATION_REQUIRED'], ['CORRECT', 'CORRECTED']]);
    });

    it('L-12: the old fact is ambiguous and the new value is the user\'s own - the chosen fact is corrected into it, no second copy', async () => {
      const fact = store.remember(A, 'أنا ساكن في أكتوبر.', 'PERSONAL_FACT');
      const preference = store.remember(A, 'أنا ساكن في أكتوبر.', 'STABLE_PREFERENCE');
      const mine = { ...store.remember(A, 'أنا ساكن في طنطا.', 'PERSONAL_FACT', 'ACTIVE', 'SELF') };
      expect((await say('أنا مش ساكن في أكتوبر، أنا ساكن في طنطا')).reply).toContain('أيّ هذه المعلومات هي المقصودة؟');
      const [chosen] = options(fact.id);
      expect((await say(String(chosen))).reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا ساكن في طنطا.» بدلًا من «أنا ساكن في أكتوبر.».');
      expect([memoryOf(fact.id).status, memoryOf(preference.id).status, memoryOf(mine.id)]).toEqual(['SUPERSEDED', 'ACTIVE', mine]);
      expect(store.commands[1]).toEqual(expect.objectContaining({ outcome: 'CORRECTED_TO_EXISTING', target_memory_id: fact.id, result_memory_id: mine.id }));
      expect(store.memories).toHaveLength(3);
    });

    it('L-12: ambiguous, with the new value remembered about both - which one, then whom (L-11), then exactly that person\'s fact', async () => {
      const fact = store.remember(A, 'ساكن في أكتوبر.', 'PERSONAL_FACT');
      store.remember(A, 'ساكن في أكتوبر.', 'STABLE_PREFERENCE');
      const mine = { ...store.remember(A, 'أنا ساكن في طنطا.', 'PERSONAL_FACT', 'ACTIVE', 'SELF') };
      const theirs = { ...store.remember(A, 'أنا ساكن في طنطا.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER') };
      expect((await say('لا، مش ساكن في أكتوبر، ساكن في طنطا')).reply).toBe('أيّ هذه المعلومات هي المقصودة؟\n1. «ساكن في أكتوبر.»\n2. «ساكن في أكتوبر.»\nرقمها يكفي.');
      const [chosen] = options(fact.id);
      expect((await say(String(chosen))).reply).toBe('أهذه المعلومة عنك أنت، أم عن شخص آخر؟');
      expect((await say('عن حد تاني')).reply).toBe('حسنًا، صحّحتها. أصبحت أتذكّر «أنا ساكن في طنطا.» بدلًا من «ساكن في أكتوبر.».');
      expect(store.commands[2]).toEqual(expect.objectContaining({ outcome: 'CORRECTED_TO_EXISTING', target_memory_id: fact.id, result_memory_id: theirs.id }));
      expect([memoryOf(mine.id), memoryOf(theirs.id)]).toEqual([mine, theirs]);
      expect(store.attributions.has(fact.id)).toBe(false);
      expect(shapes()).toEqual([['CORRECT', 'CLARIFICATION_REQUIRED'], ['CORRECT', 'SUBJECT_CLARIFICATION_REQUIRED'], ['CORRECT', 'CORRECTED_TO_EXISTING']]);
    });

    it('L-12: with nothing left to correct, someone else\'s fact or an UNATTRIBUTED one never proves "already" - ordinary conversation', async () => {
      // Someone else's fact (A), a fact whose subject was never established (B), and the user's own fact when the words
      // say nobody (B): none of them is claimed.
      store.remember(A, 'أنا ساكن في طنطا.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER');
      store.remember(A, 'I live in Tanta.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER');
      const sessionB = store.session(B);
      store.remember(B, 'أنا ساكن في طنطا.');
      store.remember(B, 'I live in Tanta.');
      store.remember(B, 'أنا ساكن في إسكندرية.', 'PERSONAL_FACT', 'ACTIVE', 'SELF');
      const before = JSON.stringify(store.memories);
      await expect(say('أنا مش ساكن في أكتوبر، أنا ساكن في طنطا')).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(say("I don't live in October anymore, I live in Tanta.")).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(say('أنا مش ساكن في أكتوبر، أنا ساكن في طنطا', sessionB, B)).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(say("I don't live in October anymore, I live in Tanta.", sessionB, B)).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(say('لا، مش ساكن في أكتوبر، ساكن في إسكندرية', sessionB, B)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(touched).toContain('FOREGROUND_GATHER');
      expect(JSON.stringify(store.memories)).toBe(before);
      expect(store.commands).toEqual([]);
      expect(store.turns.filter((t) => t.role === 'ASSISTANT' && /فاكرها كده أصلًا|already have it/u.test(t.content))).toEqual([]);
    });

    it('L-12: the justified "already" stays - the new value is remembered about the same person the words name', async () => {
      const mine = { ...store.remember(A, 'أنا ساكن في طنطا.', 'PERSONAL_FACT', 'ACTIVE', 'SELF') };
      expect((await say('أنا مش ساكن في أكتوبر، أنا ساكن في طنطا')).reply).toBe('أتذكّرها بهذا الشكل بالفعل: «أنا ساكن في طنطا.»');
      const sessionB = store.session(B);
      store.remember(B, 'I live in Tanta.', 'PERSONAL_FACT', 'ACTIVE', 'SELF');
      expect((await say("I don't live in October anymore, I live in Tanta.", sessionB, B)).reply).toBe('I already have it that way: “I live in Tanta.”');
      expect(memoryOf(mine.id)).toEqual(mine);
      expect(store.memories).toHaveLength(2);
      expect(shapes()).toEqual([['CORRECT', 'ALREADY_CORRECT'], ['CORRECT', 'ALREADY_CORRECT']]);
    });

    it('L-12: in English, an ambiguous old fact with the new value only about someone else asks which one', async () => {
      const sessionB = store.session(B);
      const fact = store.remember(B, 'I live in October.', 'PERSONAL_FACT');
      store.remember(B, 'I live in October.', 'STABLE_PREFERENCE');
      const theirs = { ...store.remember(B, 'I live in Tanta.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER') };
      const ask = await say("I don't live in October anymore, I live in Tanta.", sessionB, B);
      expect(ask.reply).toBe('Which one do you mean?\n1. “I live in October.”\n2. “I live in October.”\nThe number is enough.');
      const [chosen] = options(fact.id);
      expect((await say(String(chosen), sessionB, B)).reply).toBe("Got it, I've corrected it. I now remember “I live in Tanta.” instead of “I live in October.”.");
      expect(memoryOf(theirs.id)).toEqual(theirs);
      expect(store.attributions.get(store.memories.find((m) => m.supersedes_memory_id === fact.id)!.id)).toEqual(expect.objectContaining({ subject: 'SELF' }));
    });

    it('L-12: a declined, re-asked, lapsed or late answer to the "which one?" changes nothing and never says "already"', async () => {
      store.remember(A, 'ساكن في أكتوبر.', 'PERSONAL_FACT');
      store.remember(A, 'ساكن في أكتوبر.', 'STABLE_PREFERENCE');
      store.remember(A, 'أنا ساكن في طنطا.', 'PERSONAL_FACT', 'ACTIVE', 'OTHER');
      const before = JSON.stringify(store.memories);
      const ask = await say('لا، مش ساكن في أكتوبر، ساكن في طنطا');
      expect((await say('5')).reply).toBe(ask.reply);
      expect((await say('لا')).reply).toBe('حسنًا، لم أغيّر شيئًا.');
      await say('لا، مش ساكن في أكتوبر، ساكن في طنطا');
      touched.length = 0;
      await expect(say('ماشي يا عم')).rejects.toBeInstanceOf(ServiceUnavailableException);
      touched.length = 0;
      await expect(say('1')).rejects.toBeInstanceOf(ServiceUnavailableException);
      touched.length = 0;
      expect(JSON.stringify(store.memories)).toBe(before);
      expect(shapes()).toEqual([
        ['CORRECT', 'CLARIFICATION_REQUIRED'], ['CORRECT', 'CLARIFICATION_REQUIRED'], ['CORRECT', 'CLARIFICATION_DECLINED'], ['CORRECT', 'CLARIFICATION_REQUIRED'],
      ]);
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
      // MEM-AR-01C: a fact whose subject the words decide (another person), so it is kept at once.
      await expect(say('افتكر إن أختي عندها امتحان الخميس.', sessionA, A, key)).rejects.toBeInstanceOf(ServiceUnavailableException);
      // The Memory and the reply that reports it committed together.
      expect(store.memories).toHaveLength(1);
      expect(store.turns.filter((t) => t.role === 'ASSISTANT')).toHaveLength(1);

      const retry = await say('افتكر إن أختي عندها امتحان الخميس.', sessionA, A, key);
      expect(retry.reply).toBe('حسنًا، سأتذكّر هذا: «أختي عندها امتحان الخميس.»');
      expect(store.memories).toHaveLength(1);
      expect(store.commands).toHaveLength(1);
      expect(store.turns.filter((t) => t.role === 'ASSISTANT')).toHaveLength(1);
      expect(store.serviceCalls.filter((name) => name === 'server_finalize_memory_control_turn_v2')).toHaveLength(1);
    });

    it('a lost correction answer never produces a second successor', async () => {
      const october = store.remember(A, 'أنا ساكن في أكتوبر.');
      store.loseMemoryControlAnswer = true;
      await expect(say('أنا مش ساكن في أكتوبر دلوقتي، أنا ساكن في طنطا.', sessionA, A, 'k-correct')).rejects.toBeInstanceOf(ServiceUnavailableException);
      await say('أنا مش ساكن في أكتوبر دلوقتي، أنا ساكن في طنطا.', sessionA, A, 'k-correct');
      // The reader re-sends it as a NEW message: QANDEEL already has it that way.
      expect((await say('أنا مش ساكن في أكتوبر دلوقتي، أنا ساكن في طنطا.')).reply).toBe('أتذكّرها بهذا الشكل بالفعل: «أنا ساكن في طنطا.»');
      expect(store.memories.filter((m) => m.supersedes_memory_id === october.id)).toHaveLength(1);
      expect(store.memories).toHaveLength(2);
    });

    it('one reader can never reach another reader\'s Memory', async () => {
      const mine = store.remember(A, 'أنا بحب كافيه النيل.');
      const sessionB = store.session(B);
      expect((await say('انسى إني بحب كافيه النيل.', sessionB, B)).reply).toBe('لا أجد شيئًا كهذا فيما أتذكّره.');
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
      expect((await say('امسح موضوع البنك')).reply).toBe('هل المقصود «شغلي الجديد في البنك.»؟');
      expect(memoryOf(bank.id).status).toBe('ACTIVE');
      expect((await say('أيوه')).reply).toBe('حسنًا، نسيت «شغلي الجديد في البنك.» ولن أعود إليه مرة أخرى.');
      expect(memoryOf(bank.id).status).toBe('DELETED');
    });
    it('«انسى إني بحب المكان ده» never forgets a different preference that merely shares «بحب»', async () => {
      const kushari = store.remember(A, 'أنا بحب الكشري.', 'STABLE_PREFERENCE');
      expect((await say('انسى إني بحب المكان ده.')).reply).toBe('لا أجد شيئًا كهذا فيما أتذكّره.');
      expect(memoryOf(kushari.id).status).toBe('ACTIVE');
    });

    it('pointing («هي دي») with several options asks again; «انسى التانية» answers', async () => {
      const bank = store.remember(A, 'شغلي الجديد في البنك.');
      const boss = store.remember(A, 'مديري في الشغل صعب.');
      await say('امسح موضوع الشغل.');
      expect((await say('هي دي')).reply).toContain('1. «مديري في الشغل صعب.»');
      expect(store.memories.map((m) => m.status)).toEqual(['ACTIVE', 'ACTIVE']);
      expect((await say('انسى التانية')).reply).toBe('حسنًا، نسيت «شغلي الجديد في البنك.» ولن أعود إليه مرة أخرى.');
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
