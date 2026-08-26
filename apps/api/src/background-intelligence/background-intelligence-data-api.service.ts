import { Injectable } from '@nestjs/common';
import type { SessionStatus, TurnStatus } from '../conversation/conversation.types';
import type { MemoryRecord, MemorySource, MemoryStatus, MemoryType } from '../memory/memory.types';
import type { HypothesisRecord, HypothesisType, HypothesisDomain, EvidenceRole } from '../hypothesis/hypothesis.types';
import type { HypothesisMutationResult, HypothesisUpdateRequest } from '../hypothesis/hypothesis-update.types';
import type { ConfidenceEvaluationRecord } from '../hypothesis/confidence.types';
import {
  type BackgroundIntelligenceEventContext,
  isBackgroundIntelligenceEventContext,
} from './background-intelligence-context.factory';
import { type BackgroundIntelligenceExecutionContext, isBackgroundIntelligenceExecutionContext } from './background-intelligence-authority.service';

const SESSION_FIELDS = 'id,status,channel';
const TURN_FIELDS = 'id,session_id,role,status,source_turn_id';
const SOURCE_TURN_FIELDS = `${TURN_FIELDS},content,processing_path,routing_reason`;
const MEMORY_FIELDS = 'id,user_id,scope,type,content,source,confidence,importance,status,version,created_at,updated_at,expires_at,supersedes_memory_id';
const HYPOTHESIS_FIELDS = 'id,user_id,statement,type,domain,scope,origin,status,version,supporting_evidence_ids,contradicting_evidence_ids,competing_hypothesis_ids,assumptions,disconfirming_conditions,created_at,updated_at';

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

  // Canonical background Memory creation. It is a narrow server-only database
  // command (migration 0026), not a broad table write: the owner is taken from
  // the authority-issued execution context and never from the input, and scope,
  // version, lineage and both timestamps are derived in the database. The
  // supplied Memory UUID is returned unchanged so the `memory:<uuid>` Evidence
  // identity formed by the caller stays exact.
  async createMemory(context: BackgroundIntelligenceExecutionContext, input: BackgroundMemoryCreateInput): Promise<MemoryRecord> {
    this.assertExecutionContext(context);
    const rows = await this.request<MemoryRecord[]>('rpc/server_create_memory_v1', {
      method: 'POST',
      body: JSON.stringify({
        p_user_id: context.userId,
        p_memory_id: input.id,
        p_type: input.type,
        p_content: input.content,
        p_source: input.source,
        p_confidence: input.confidence,
        p_importance: input.importance,
        p_status: input.status,
        p_expires_at: input.expiresAt ?? null,
      }),
    });
    return rows[0];
  }

  async readCanonicalSourceTurn(context: BackgroundIntelligenceExecutionContext): Promise<BackgroundCanonicalSourceTurn | undefined> {
    this.assertExecutionContext(context);
    const query=new URLSearchParams({select:SOURCE_TURN_FIELDS,id:`eq.${context.sourceTurnId}`,session_id:`eq.${context.sessionId}`,user_id:`eq.${context.userId}`,role:'eq.USER',status:'eq.COMPLETED',limit:'1'});
    return (await this.request<BackgroundCanonicalSourceTurn[]>(`conversation_turns?${query}`))[0];
  }

  async listActiveMemories(context: BackgroundIntelligenceExecutionContext, limit:number, now=new Date()):Promise<MemoryRecord[]> {
    this.assertExecutionContext(context);
    const query=new URLSearchParams({select:MEMORY_FIELDS,user_id:`eq.${context.userId}`,status:'eq.ACTIVE',or:`(expires_at.is.null,expires_at.gt.${now.toISOString()})`,order:'updated_at.desc,id.desc',limit:String(limit)});
    return this.request<MemoryRecord[]>(`memories?${query}`);
  }

  async listActiveHypotheses(context: BackgroundIntelligenceExecutionContext, limit:number):Promise<HypothesisRecord[]> {
    this.assertExecutionContext(context);
    const query=new URLSearchParams({select:HYPOTHESIS_FIELDS,user_id:`eq.${context.userId}`,status:'in.(CANDIDATE,ACTIVE,SUPPORTED,MIXED,WEAK,REOPENED)',order:'updated_at.desc,id.asc',limit:String(limit)});
    return this.request<HypothesisRecord[]>(`hypotheses?${query}`);
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
