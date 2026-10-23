import { Injectable } from '@nestjs/common';
import type { SessionStatus, TurnStatus } from '../conversation/conversation.types';
import type { HimSnapshotSourceRow } from '../human-model/him-intelligence-snapshot.types';
import type { HimBrainContextSourceRow } from '../human-model/him-brain-context.types';
import type { MemoryRecord, MemorySource, MemoryStatus, MemoryType } from '../memory/memory.types';
import { MEMORY_SUBJECT_EMBED, withMemorySubject } from '../memory/memory-subject';
import { MEMORY_TYPES } from '../memory/memory.types';
import type { HypothesisRecord, HypothesisType, HypothesisDomain, EvidenceRole } from '../hypothesis/hypothesis.types';
import type { HypothesisMutationResult, HypothesisUpdateRequest } from '../hypothesis/hypothesis-update.types';
import type { ConfidenceEvaluationRecord } from '../hypothesis/confidence.types';
import type { HypothesisEvidenceRelianceRow } from '../hypothesis/hypothesis-evidence-reliance';
import {
  type BackgroundIntelligenceEventContext,
  isBackgroundIntelligenceEventContext,
} from './background-intelligence-context.factory';
import { type BackgroundIntelligenceExecutionContext, isBackgroundIntelligenceExecutionContext } from './background-intelligence-authority.service';

const SESSION_FIELDS = 'id,status,channel';
const TURN_FIELDS = 'id,session_id,role,status,source_turn_id';
const SOURCE_TURN_FIELDS = `${TURN_FIELDS},content,processing_path,routing_reason`;
const MEMORY_FIELDS = `id,user_id,scope,type,content,source,confidence,importance,status,version,created_at,updated_at,expires_at,supersedes_memory_id,${MEMORY_SUBJECT_EMBED}`;
const HYPOTHESIS_FIELDS = 'id,user_id,statement,type,domain,scope,origin,status,version,supporting_evidence_ids,contradicting_evidence_ids,competing_hypothesis_ids,assumptions,disconfirming_conditions,created_at,updated_at';
// The canonical UUID shape, used only to fail closed on a malformed execution
// identity before it can reach the service-role transport.
const BACKGROUND_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface BackgroundConversationSessionState { readonly id: string; readonly status: SessionStatus; readonly channel: 'TEXT'; }
export interface BackgroundConversationTurnState { readonly id: string; readonly session_id: string; readonly role: 'USER' | 'ASSISTANT'; readonly status: TurnStatus; readonly source_turn_id: string | null; }
export interface BackgroundCanonicalSourceTurn extends BackgroundConversationTurnState { readonly content: string; readonly processing_path: 'FAST'|'DEEP'|null; readonly routing_reason: string|null; }

export interface BackgroundMemoryCreateInput {
  readonly id: string;
  readonly type: MemoryType;
  readonly content: string;
  readonly source: MemorySource;
  readonly confidence: number;
  readonly importance: number;
  readonly status: MemoryStatus;
  readonly expiresAt?: string;
}
/** MEM-AR-01C: what background_record_memory_v1 committed for one capture. */
export type BackgroundMemoryRecordResult =
  | { readonly outcome: 'CREATED' | 'ALREADY_RECORDED'; readonly memoryId: string }
  | { readonly outcome: 'SKIPPED_COMMAND_TURN' | 'EQUIVALENT_EXISTS' | 'SUPERSEDED_BY_LATER_COMMAND' };
export interface BackgroundHypothesisCreateInput { readonly id:string; readonly statement:string; readonly type:HypothesisType; readonly domain:HypothesisDomain; readonly scope:string; readonly assumptions:readonly string[]; readonly disconfirmingConditions:readonly string[]; }

@Injectable()
export class BackgroundIntelligenceDataApiService {
  async findSession(context: BackgroundIntelligenceEventContext): Promise<BackgroundConversationSessionState | undefined> {
    this.assertOwnershipContext(context);
    const query = new URLSearchParams({ select: SESSION_FIELDS, id: `eq.${context.sessionId}`, user_id: `eq.${context.userId}`, limit: '1' });
    return (await this.request<BackgroundConversationSessionState[]>(`conversation_sessions?${query}`))[0];
  }

  async findSourceTurn(context: BackgroundIntelligenceEventContext): Promise<BackgroundConversationTurnState | undefined> {
    this.assertOwnershipContext(context);
    const query = new URLSearchParams({ select: TURN_FIELDS, id: `eq.${context.sourceTurnId}`, session_id: `eq.${context.sessionId}`, user_id: `eq.${context.userId}`, limit: '1' });
    return (await this.request<BackgroundConversationTurnState[]>(`conversation_turns?${query}`))[0];
  }

  async findCompletedAssistant(context: BackgroundIntelligenceEventContext): Promise<BackgroundConversationTurnState | undefined> {
    this.assertOwnershipContext(context);
    const query = new URLSearchParams({ select: TURN_FIELDS, source_turn_id: `eq.${context.sourceTurnId}`, session_id: `eq.${context.sessionId}`, user_id: `eq.${context.userId}`, role: 'eq.ASSISTANT', status: 'eq.COMPLETED', limit: '1' });
    return (await this.request<BackgroundConversationTurnState[]>(`conversation_turns?${query}`))[0];
  }

  // MEM-AR-01C (migration 0152): the ONE background Memory writer, background_record_memory_v1. The source turn - never
  // the owner - names the durable RUNNING execution with MEMORY_WRITE claimed, so the owner, the Session association and
  // the history boundary are the database's. Under the owner's equivalence lock it writes nothing for a turn a Memory
  // command already answered (SKIPPED_COMMAND_TURN), for a fact a later command forgot or corrected
  // (SUPERSEDED_BY_LATER_COMMAND) or one already remembered (EQUIVALENT_EXISTS); a replay of this execution answers the
  // Memory it already wrote (ALREADY_RECORDED). A new Memory is created with its SELF / FIRST_PERSON_CAPTURE subject in
  // the same transaction. The supplied Memory UUID is returned unchanged on CREATED, so `memory:<uuid>` stays exact.
  async recordMemory(context: BackgroundIntelligenceExecutionContext, input: BackgroundMemoryCreateInput): Promise<BackgroundMemoryRecordResult> {
    this.assertExecutionContext(context);
    const rows = await this.request<Array<{ outcome: unknown; memory_id: unknown }>>('rpc/background_record_memory_v1', {
      method: 'POST',
      body: JSON.stringify({
        p_source_turn_id: context.sourceTurnId,
        p_memory_id: input.id,
        p_type: input.type,
        p_content: input.content,
        p_confidence: input.confidence,
        p_importance: input.importance,
        p_expires_at: input.expiresAt ?? null,
      }),
    });
    const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : undefined;
    const outcome = row?.outcome;
    if (outcome === 'CREATED' || outcome === 'ALREADY_RECORDED') {
      if (typeof row?.memory_id !== 'string' || !BACKGROUND_UUID.test(row.memory_id) || (outcome === 'CREATED' && row.memory_id !== input.id)) {
        throw new Error('BACKGROUND_MEMORY_RECORD_INTEGRITY');
      }
      return { outcome, memoryId: row.memory_id };
    }
    if ((outcome === 'SKIPPED_COMMAND_TURN' || outcome === 'EQUIVALENT_EXISTS' || outcome === 'SUPERSEDED_BY_LATER_COMMAND') && row?.memory_id === null) {
      return { outcome };
    }
    throw new Error('BACKGROUND_MEMORY_RECORD_INTEGRITY');
  }

  async readCanonicalSourceTurn(context: BackgroundIntelligenceExecutionContext): Promise<BackgroundCanonicalSourceTurn | undefined> {
    this.assertExecutionContext(context);
    const query=new URLSearchParams({select:SOURCE_TURN_FIELDS,id:`eq.${context.sourceTurnId}`,session_id:`eq.${context.sessionId}`,user_id:`eq.${context.userId}`,role:'eq.USER',status:'eq.COMPLETED',limit:'1'});
    return (await this.request<BackgroundCanonicalSourceTurn[]>(`conversation_turns?${query}`))[0];
  }

  // S8A-03 CP2 (migration 0171): the bounded backfill read. The source turn names the RUNNING execution, and the
  // database answers at most four of its owner's eligible Memories whose semantic keys are not indexed yet.
  async listUnindexedMemories(context: BackgroundIntelligenceExecutionContext, limit: number): Promise<Array<{ memoryId: string; type: MemoryType; content: string }>> {
    this.assertExecutionContext(context);
    const rows = await this.request<Array<{ memory_id: unknown; type: unknown; content: unknown }>>('rpc/background_unindexed_memories_v1', {
      method: 'POST', body: JSON.stringify({ p_source_turn_id: context.sourceTurnId, p_limit: limit }),
    });
    if (!Array.isArray(rows) || rows.length > limit) throw new Error('BACKGROUND_UNDERSTANDING_BACKFILL_INTEGRITY');
    return rows.map((row) => {
      if (typeof row?.memory_id !== 'string' || !BACKGROUND_UUID.test(row.memory_id) || typeof row.type !== 'string' ||
          !(MEMORY_TYPES as readonly string[]).includes(row.type) || typeof row.content !== 'string') {
        throw new Error('BACKGROUND_UNDERSTANDING_BACKFILL_INTEGRITY');
      }
      return { memoryId: row.memory_id, type: row.type as MemoryType, content: row.content };
    });
  }

  // S8A-03 Living Personal Memory (migration 0172): the bounded current-state read. The source turn names the RUNNING
  // execution, and the database answers at most ten of its owner's own current-state Memories, with their index terms.
  async listCurrentStateMemories(context: BackgroundIntelligenceExecutionContext, limit: number): Promise<Array<{ memoryId: string; type: MemoryType; content: string; terms: string[] }>> {
    this.assertExecutionContext(context);
    const rows = await this.request<Array<{ memory_id: unknown; type: unknown; content: unknown; terms: unknown }>>('rpc/background_current_state_memories_v1', {
      method: 'POST', body: JSON.stringify({ p_source_turn_id: context.sourceTurnId, p_limit: limit }),
    });
    if (!Array.isArray(rows) || rows.length > limit) throw new Error('BACKGROUND_UNDERSTANDING_STATE_INTEGRITY');
    return rows.map((row) => {
      if (typeof row?.memory_id !== 'string' || !BACKGROUND_UUID.test(row.memory_id) || typeof row.type !== 'string' ||
          !(MEMORY_TYPES as readonly string[]).includes(row.type) || typeof row.content !== 'string' ||
          !Array.isArray(row.terms) || !row.terms.every((term) => typeof term === 'string')) {
        throw new Error('BACKGROUND_UNDERSTANDING_STATE_INTEGRITY');
      }
      return { memoryId: row.memory_id, type: row.type as MemoryType, content: row.content, terms: row.terms as string[] };
    });
  }

  async listActiveMemories(context: BackgroundIntelligenceExecutionContext, limit:number, now=new Date()):Promise<MemoryRecord[]> {
    this.assertExecutionContext(context);
    const query=new URLSearchParams({select:MEMORY_FIELDS,user_id:`eq.${context.userId}`,status:'eq.ACTIVE',or:`(expires_at.is.null,expires_at.gt.${now.toISOString()})`,order:'updated_at.desc,id.desc',limit:String(limit)});
    return (await this.request<MemoryRecord[]>(`memories?${query}`)).map(withMemorySubject);
  }

  async listActiveHypotheses(context: BackgroundIntelligenceExecutionContext, limit:number):Promise<HypothesisRecord[]> {
    this.assertExecutionContext(context);
    const query=new URLSearchParams({select:HYPOTHESIS_FIELDS,user_id:`eq.${context.userId}`,status:'in.(CANDIDATE,ACTIVE,SUPPORTED,MIXED,WEAK,REOPENED)',order:'updated_at.desc,id.asc',limit:String(limit)});
    return this.request<HypothesisRecord[]>(`hypotheses?${query}`);
  }

  // INTEL-TM-01 (migration 0151): the reliance of these owned Hypotheses, through the service twin whose owner is the
  // authority-issued execution context's. Validation and version pinning are the caller's (projectEvidenceReliance).
  async readHypothesisEvidenceReliance(context:BackgroundIntelligenceExecutionContext,hypothesisIds:readonly string[]):Promise<HypothesisEvidenceRelianceRow[]>{
    this.assertExecutionContext(context);
    return this.request<HypothesisEvidenceRelianceRow[]>('rpc/background_hypothesis_evidence_reliance_v1',{method:'POST',body:JSON.stringify({p_user_id:context.userId,p_hypothesis_ids:hypothesisIds})});
  }

  // INTEL-TM-01 (CC-4): the bounded housekeeping. The database derives the pending work itself (links naming a Memory
  // the reader forgot or disabled), detaches them with an immutable record, one version step and the same-transaction
  // exact-version Confidence, and answers how many Hypotheses it re-evaluated. It decides no reliance.
  async reevaluateWithdrawnHypothesisEvidence(context:BackgroundIntelligenceExecutionContext,limit:number):Promise<unknown>{
    this.assertExecutionContext(context);
    return this.request<unknown>('rpc/background_reevaluate_withdrawn_hypothesis_evidence_v1',{method:'POST',body:JSON.stringify({p_user_id:context.userId,p_limit:limit})});
  }

  async findHypothesis(context:BackgroundIntelligenceExecutionContext,id:string):Promise<HypothesisRecord|undefined>{
    this.assertExecutionContext(context);const query=new URLSearchParams({select:HYPOTHESIS_FIELDS,id:`eq.${id}`,user_id:`eq.${context.userId}`,limit:'1'});return(await this.request<HypothesisRecord[]>(`hypotheses?${query}`))[0];
  }

  async createSystemHypothesis(context:BackgroundIntelligenceExecutionContext,input:BackgroundHypothesisCreateInput):Promise<HypothesisRecord>{
    this.assertExecutionContext(context);return(await this.request<HypothesisRecord[]>('rpc/background_create_system_hypothesis_v1',{method:'POST',body:JSON.stringify({p_user_id:context.userId,p_hypothesis_id:input.id,p_statement:input.statement,p_type:input.type,p_domain:input.domain,p_scope:input.scope,p_assumptions:input.assumptions,p_disconfirming_conditions:input.disconfirmingConditions})}))[0];
  }

  async attachHypothesisEvidence(context:BackgroundIntelligenceExecutionContext,id:string,evidenceId:string,role:EvidenceRole):Promise<HypothesisRecord>{
    this.assertExecutionContext(context);return(await this.request<HypothesisRecord[]>('rpc/background_attach_hypothesis_evidence_v1',{method:'POST',body:JSON.stringify({p_user_id:context.userId,p_hypothesis_id:id,p_evidence_id:evidenceId,p_role:role})}))[0];
  }

  async linkCompetingHypotheses(context:BackgroundIntelligenceExecutionContext,id:string,competitorId:string):Promise<HypothesisRecord>{
    this.assertExecutionContext(context);return(await this.request<HypothesisRecord[]>('rpc/background_link_competing_hypotheses_v1',{method:'POST',body:JSON.stringify({p_user_id:context.userId,p_hypothesis_id:id,p_competitor_id:competitorId})}))[0];
  }

  // Server-authorized Hypothesis Update invocation (migration 0032). The owner
  // and conversation session are derived from the authority-issued execution
  // context and never from the input; no access token or user JWT exists on
  // this path. The database wrapper binds the target Hypothesis to that owner
  // and session scope and re-checks every canonical mutation invariant.
  async applyHypothesisUpdate(context:BackgroundIntelligenceExecutionContext,updateId:string,request:HypothesisUpdateRequest):Promise<HypothesisMutationResult|undefined>{
    this.assertExecutionContext(context);
    return(await this.request<HypothesisMutationResult[]>('rpc/background_apply_hypothesis_evidence_update_v1',{method:'POST',body:JSON.stringify({p_user_id:context.userId,p_session_id:context.sessionId,p_update_id:updateId,p_hypothesis_id:request.hypothesisId,p_expected_version:request.expectedVersion,p_evidence_id:request.evidenceId,p_evidence_role:request.evidenceRole})}))[0];
  }

  async createConfidenceEvaluation(context:BackgroundIntelligenceExecutionContext,evaluationId:string,hypothesisId:string,targetVersion:number):Promise<ConfidenceEvaluationRecord>{
    this.assertExecutionContext(context);return(await this.request<ConfidenceEvaluationRecord[]>('rpc/background_create_confidence_evaluation_v1',{method:'POST',body:JSON.stringify({p_user_id:context.userId,p_evaluation_id:evaluationId,p_hypothesis_id:hypothesisId,p_target_version:targetVersion})}))[0];
  }

  // HIM Runtime Consumption v1: the ONE narrow background HIM read. It calls
  // only the CONVERSATION_SESSION-only service-role snapshot wrapper
  // (migration 0037) with the authority-issued context's exact user/session
  // identity - no user credential of any kind, no request claims, no direct
  // HIM table read, no generic user/context read authority, nothing persisted.
  async readHimConversationSnapshot(context:BackgroundIntelligenceExecutionContext):Promise<HimSnapshotSourceRow[]>{
    this.assertExecutionContext(context);
    return this.request<HimSnapshotSourceRow[]>('rpc/background_read_him_conversation_snapshot_v1',{method:'POST',body:JSON.stringify({p_user_id:context.userId,p_session_id:context.sessionId})});
  }

  // QHIA-012 Brain Context materialization source: the ONE narrow
  // execution-bound background HIM read. It calls only the service-role
  // migration-0061 source RPC and supplies ONLY the post-response execution ID -
  // no user, no session, no turn, no context kind, no context id, no target, no
  // metric key, no metric list, no definition version, no slot list, no
  // registry, no user credential and no request claims. The database derives
  // owner/session/source-turn authority from the execution itself, resolves only
  // exact ACTIVE QHIA-006 DECISION/SITUATION/GOAL bindings, and answers all
  // eight frozen Brain slots in ONE request: there is no per-slot network fan-out
  // and no generic cross-context HIM read authority anywhere on this path.
  async readHimBrainContextSource(context:BackgroundIntelligenceExecutionContext,executionId:string):Promise<HimBrainContextSourceRow[]>{
    this.assertExecutionContext(context);
    if(typeof executionId!=='string'||!BACKGROUND_UUID.test(executionId))throw new Error('BACKGROUND_INTELLIGENCE_EXECUTION_IDENTITY_REQUIRED');
    return this.request<HimBrainContextSourceRow[]>('rpc/background_read_him_brain_context_source_v1',{method:'POST',body:JSON.stringify({p_execution_id:executionId})});
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceRoleKey) throw new Error('BACKGROUND_INTELLIGENCE_DATABASE_DISABLED');
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/rest/v1/${path}`, {
        ...init,
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new Error('BACKGROUND_INTELLIGENCE_DATABASE_UNAVAILABLE');
    }
    if (!response.ok) throw new Error('BACKGROUND_INTELLIGENCE_DATABASE_UNAVAILABLE');
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private assertOwnershipContext(context: BackgroundIntelligenceEventContext): void {
    if (!isBackgroundIntelligenceEventContext(context)) throw new Error('BACKGROUND_INTELLIGENCE_EVENT_CONTEXT_REQUIRED');
  }

  private assertExecutionContext(context: BackgroundIntelligenceExecutionContext): void {
    if (!isBackgroundIntelligenceExecutionContext(context)) throw new Error('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');
  }
}
