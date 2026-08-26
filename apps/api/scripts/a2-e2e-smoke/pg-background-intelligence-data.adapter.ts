// Smoke-only PostgreSQL transport substitute for
// BackgroundIntelligenceDataApiService. The production service reaches the
// SAME canonical tables and SECURITY DEFINER commands (migrations 0021/0026/
// 0028/0032) through PostgREST with the service_role transport; CI provides
// PostgreSQL without PostgREST, so this adapter issues the identical reads and
// RPCs directly through the shared pg client as service_role. Field lists,
// filters, ordering and limits mirror the production PostgREST queries
// verbatim, and the production context-authority guards are reused unchanged.
// It contains NO business logic: Memory creation shape, Hypothesis mutation,
// Evidence eligibility and Confidence construction all live in the canonical
// database commands and in the real application services above this transport.
import {
  isBackgroundIntelligenceExecutionContext,
  type BackgroundIntelligenceExecutionContext,
} from '../../src/background-intelligence/background-intelligence-authority.service';
import {
  isBackgroundIntelligenceEventContext,
  type BackgroundIntelligenceEventContext,
} from '../../src/background-intelligence/background-intelligence-context.factory';
import type {
  BackgroundCanonicalSourceTurn,
  BackgroundConversationSessionState,
  BackgroundConversationTurnState,
  BackgroundHypothesisCreateInput,
  BackgroundMemoryCreateInput,
} from '../../src/background-intelligence/background-intelligence-data-api.service';
import type { ConfidenceEvaluationRecord } from '../../src/hypothesis/confidence.types';
import type { EvidenceRole, HypothesisRecord } from '../../src/hypothesis/hypothesis.types';
import type { HypothesisMutationResult, HypothesisUpdateRequest } from '../../src/hypothesis/hypothesis-update.types';
import type { MemoryRecord } from '../../src/memory/memory.types';
import type { SmokeDbSession } from './smoke-db';

const SESSION_FIELDS = 'id, status, channel';
const TURN_FIELDS = 'id, session_id, role, status, source_turn_id';
const SOURCE_TURN_FIELDS = `${TURN_FIELDS}, content, processing_path, routing_reason`;
const MEMORY_FIELDS =
  'id, user_id, scope, type, content, source, confidence, importance, status, version, created_at, updated_at, expires_at, supersedes_memory_id';
const HYPOTHESIS_FIELDS =
  'id, user_id, statement, type, domain, scope, origin, status, version, supporting_evidence_ids, contradicting_evidence_ids, competing_hypothesis_ids, assumptions, disconfirming_conditions, created_at, updated_at';

export class PgBackgroundIntelligenceDataApiAdapter {
  constructor(private readonly db: SmokeDbSession) {}

  async findSession(context: BackgroundIntelligenceEventContext): Promise<BackgroundConversationSessionState | undefined> {
    this.assertOwnershipContext(context);
    const rows = await this.db.asRole<BackgroundConversationSessionState>(
      'service_role',
      `SELECT ${SESSION_FIELDS} FROM public.conversation_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [context.sessionId, context.userId],
    );
    return rows[0];
  }

  async findSourceTurn(context: BackgroundIntelligenceEventContext): Promise<BackgroundConversationTurnState | undefined> {
    this.assertOwnershipContext(context);
    const rows = await this.db.asRole<BackgroundConversationTurnState>(
      'service_role',
      `SELECT ${TURN_FIELDS} FROM public.conversation_turns WHERE id = $1 AND session_id = $2 AND user_id = $3 LIMIT 1`,
      [context.sourceTurnId, context.sessionId, context.userId],
    );
    return rows[0];
  }

  async findCompletedAssistant(context: BackgroundIntelligenceEventContext): Promise<BackgroundConversationTurnState | undefined> {
    this.assertOwnershipContext(context);
    const rows = await this.db.asRole<BackgroundConversationTurnState>(
      'service_role',
      `SELECT ${TURN_FIELDS} FROM public.conversation_turns
        WHERE source_turn_id = $1 AND session_id = $2 AND user_id = $3 AND role = 'ASSISTANT' AND status = 'COMPLETED' LIMIT 1`,
      [context.sourceTurnId, context.sessionId, context.userId],
    );
    return rows[0];
  }

  async createMemory(context: BackgroundIntelligenceExecutionContext, input: BackgroundMemoryCreateInput): Promise<MemoryRecord> {
    this.assertExecutionContext(context);
    const rows = await this.db.asRole<MemoryRecord>(
      'service_role',
      'SELECT * FROM public.server_create_memory_v1($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [context.userId, input.id, input.type, input.content, input.source, input.confidence, input.importance, input.status, input.expiresAt ?? null],
    );
    return rows[0];
  }

  async readCanonicalSourceTurn(context: BackgroundIntelligenceExecutionContext): Promise<BackgroundCanonicalSourceTurn | undefined> {
    this.assertExecutionContext(context);
    const rows = await this.db.asRole<BackgroundCanonicalSourceTurn>(
      'service_role',
      `SELECT ${SOURCE_TURN_FIELDS} FROM public.conversation_turns
        WHERE id = $1 AND session_id = $2 AND user_id = $3 AND role = 'USER' AND status = 'COMPLETED' LIMIT 1`,
      [context.sourceTurnId, context.sessionId, context.userId],
    );
    return rows[0];
  }

  async listActiveMemories(context: BackgroundIntelligenceExecutionContext, limit: number, now = new Date()): Promise<MemoryRecord[]> {
    this.assertExecutionContext(context);
    return this.db.asRole<MemoryRecord>(
      'service_role',
      `SELECT ${MEMORY_FIELDS} FROM public.memories
        WHERE user_id = $1 AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > $2)
        ORDER BY updated_at DESC, id DESC LIMIT $3`,
      [context.userId, now.toISOString(), limit],
    );
  }

  async listActiveHypotheses(context: BackgroundIntelligenceExecutionContext, limit: number): Promise<HypothesisRecord[]> {
    this.assertExecutionContext(context);
    return this.db.asRole<HypothesisRecord>(
      'service_role',
      `SELECT ${HYPOTHESIS_FIELDS} FROM public.hypotheses
        WHERE user_id = $1 AND status IN ('CANDIDATE', 'ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK', 'REOPENED')
        ORDER BY updated_at DESC, id ASC LIMIT $2`,
      [context.userId, limit],
    );
  }

  async findHypothesis(context: BackgroundIntelligenceExecutionContext, id: string): Promise<HypothesisRecord | undefined> {
    this.assertExecutionContext(context);
    const rows = await this.db.asRole<HypothesisRecord>(
      'service_role',
      `SELECT ${HYPOTHESIS_FIELDS} FROM public.hypotheses WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [id, context.userId],
    );
    return rows[0];
  }

  async createSystemHypothesis(context: BackgroundIntelligenceExecutionContext, input: BackgroundHypothesisCreateInput): Promise<HypothesisRecord> {
    this.assertExecutionContext(context);
    const rows = await this.db.asRole<HypothesisRecord>(
      'service_role',
      'SELECT * FROM public.background_create_system_hypothesis_v1($1, $2, $3, $4, $5, $6, $7, $8)',
      [context.userId, input.id, input.statement, input.type, input.domain, input.scope, [...input.assumptions], [...input.disconfirmingConditions]],
    );
    return rows[0];
  }

  async attachHypothesisEvidence(context: BackgroundIntelligenceExecutionContext, id: string, evidenceId: string, role: EvidenceRole): Promise<HypothesisRecord> {
    this.assertExecutionContext(context);
    const rows = await this.db.asRole<HypothesisRecord>(
      'service_role',
      'SELECT * FROM public.background_attach_hypothesis_evidence_v1($1, $2, $3, $4)',
      [context.userId, id, evidenceId, role],
    );
    return rows[0];
  }

  async linkCompetingHypotheses(context: BackgroundIntelligenceExecutionContext, id: string, competitorId: string): Promise<HypothesisRecord> {
    this.assertExecutionContext(context);
    const rows = await this.db.asRole<HypothesisRecord>(
      'service_role',
      'SELECT * FROM public.background_link_competing_hypotheses_v1($1, $2, $3)',
      [context.userId, id, competitorId],
    );
    return rows[0];
  }

  async applyHypothesisUpdate(
    context: BackgroundIntelligenceExecutionContext,
    updateId: string,
    request: HypothesisUpdateRequest,
  ): Promise<HypothesisMutationResult | undefined> {
    this.assertExecutionContext(context);
    const rows = await this.db.asRole<HypothesisMutationResult>(
      'service_role',
      'SELECT * FROM public.background_apply_hypothesis_evidence_update_v1($1, $2, $3, $4, $5, $6, $7)',
      [context.userId, context.sessionId, updateId, request.hypothesisId, request.expectedVersion, request.evidenceId, request.evidenceRole],
    );
    return rows[0];
  }

  async createConfidenceEvaluation(
    context: BackgroundIntelligenceExecutionContext,
    evaluationId: string,
    hypothesisId: string,
    targetVersion: number,
  ): Promise<ConfidenceEvaluationRecord> {
    this.assertExecutionContext(context);
    const rows = await this.db.asRole<ConfidenceEvaluationRecord>(
      'service_role',
      'SELECT * FROM public.background_create_confidence_evaluation_v1($1, $2, $3, $4)',
      [context.userId, evaluationId, hypothesisId, targetVersion],
    );
    return rows[0];
  }

  private assertOwnershipContext(context: BackgroundIntelligenceEventContext): void {
    if (!isBackgroundIntelligenceEventContext(context)) throw new Error('BACKGROUND_INTELLIGENCE_EVENT_CONTEXT_REQUIRED');
  }

  private assertExecutionContext(context: BackgroundIntelligenceExecutionContext): void {
    if (!isBackgroundIntelligenceExecutionContext(context)) throw new Error('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');
  }
}
