// Smoke-only PostgreSQL transport substitute for
// PostResponseIntelligenceRepository. The production repository reaches the
// SAME canonical effect-ledger SQL commands (migrations 0022/0024/0029/0031/
// 0033/0034/0035) through PostgREST with the service_role transport; CI
// provides PostgreSQL without PostgREST, so this adapter issues the identical
// RPCs directly through the shared pg client as service_role. It contains NO
// business logic: acquisition, claim rules, typed durable results, the managed
// A2.3c batch, atomic generation persistence and the managed QAN-AUD-06
// Confidence batch all live in the canonical SECURITY DEFINER functions.
import type { HypothesisGenerationIntentExtractionResult } from '../../src/hypothesis/hypothesis-generation-intent-extraction.types';
import type { MemoryWriteResult } from '../../src/memory/memory-write.service';
import type { DurableAssociationResult } from '../../src/post-response-intelligence/durable-association-result';
import type { DurableCandidateProviderResult } from '../../src/post-response-intelligence/durable-generation-result';
import { parseInformationGapSyncResult } from '../../src/post-response-intelligence/information-gap-sync-result';
import type { InformationGapSyncResult } from '../../src/post-response-intelligence/information-gap-sync-result';
import { CONFIDENCE_BATCH_COMMAND_STATUSES } from '../../src/post-response-intelligence/post-response-intelligence.types';
import type {
  ClaimableIntelligenceEffect,
  ConfidenceBatchCommandStatus,
  IntelligenceEffectState,
  IntelligenceExecution,
} from '../../src/post-response-intelligence/post-response-intelligence.types';
import type { SmokeDbSession } from './smoke-db';

export class PgPostResponseIntelligenceRepositoryAdapter {
  /** Transport-only observability: how many times the canonical migration-0038 sync command was invoked. */
  informationGapSyncCount = 0;

  constructor(private readonly db: SmokeDbSession) {}

  async acquire(input: {
    id: string;
    eventId: string;
    userId: string;
    sessionId: string;
    sourceTurnId: string;
    eventVersion: '1.0' | '2.0';
    processingPath: 'FAST' | 'DEEP' | null;
    safetyDisposition: 'ALLOW' | 'GUIDED' | 'BLOCK' | null;
  }): Promise<IntelligenceExecution> {
    const rows = await this.db.asRole<IntelligenceExecution>(
      'service_role',
      'SELECT * FROM public.acquire_post_response_intelligence_execution_v1($1, $2, $3, $4, $5, $6, $7, $8)',
      [input.id, input.eventId, input.userId, input.sessionId, input.sourceTurnId, input.eventVersion, input.processingPath, input.safetyDisposition],
    );
    return rows[0];
  }

  async effects(id: string): Promise<readonly IntelligenceEffectState[]> {
    return this.db.asRole<IntelligenceEffectState>(
      'service_role',
      'SELECT * FROM public.list_post_response_intelligence_effects_v1($1)',
      [id],
    );
  }

  async claim(id: string, effect: ClaimableIntelligenceEffect): Promise<boolean> {
    return this.booleanRpc('SELECT public.claim_post_response_intelligence_effect_v1($1, $2) AS value', [id, effect]);
  }

  async completeMemory(id: string, result: MemoryWriteResult): Promise<boolean> {
    return result.decision === 'SKIP'
      ? this.booleanRpc('SELECT public.complete_post_response_memory_write_effect_v1($1, $2, $3) AS value', [id, 'NO_FRESH_EVIDENCE', null])
      : this.booleanRpc('SELECT public.complete_post_response_memory_write_effect_v1($1, $2, $3) AS value', [id, 'FRESH_EVIDENCE_CREATED', result.evidenceId]);
  }

  async completeIntent(id: string, result: HypothesisGenerationIntentExtractionResult): Promise<boolean> {
    return result.status === 'AUTHORIZED'
      ? this.booleanRpc('SELECT public.complete_post_response_intent_provider_effect_v1($1, $2, $3::jsonb) AS value', [id, 'INTENT_AUTHORIZED', JSON.stringify(result.intent)])
      : this.booleanRpc('SELECT public.complete_post_response_intent_provider_effect_v1($1, $2, $3::jsonb) AS value', [id, 'INTENT_NOT_AUTHORIZED', null]);
  }

  async completeAssociation(id: string, result: DurableAssociationResult): Promise<boolean> {
    return result.code === 'NO_ASSOCIATION'
      ? this.booleanRpc('SELECT public.complete_post_response_association_provider_effect_v1($1, $2, $3::jsonb) AS value', [id, 'NO_ASSOCIATION', null])
      : this.booleanRpc('SELECT public.complete_post_response_association_provider_effect_v1($1, $2, $3::jsonb) AS value', [id, 'AUTHORIZED_COMMANDS', JSON.stringify(result.commands)]);
  }

  async completeCandidateProvider(id: string, result: DurableCandidateProviderResult): Promise<boolean> {
    return result.code === 'NO_ACCEPTED_CANDIDATES'
      ? this.booleanRpc('SELECT public.complete_post_response_candidate_provider_effect_v1($1, $2, $3::jsonb) AS value', [id, 'NO_ACCEPTED_CANDIDATES', null])
      : this.booleanRpc('SELECT public.complete_post_response_candidate_provider_effect_v1($1, $2, $3::jsonb) AS value', [id, 'VALIDATED_CANDIDATES', JSON.stringify(result.candidates)]);
  }

  async persistHypothesisGeneration(id: string): Promise<boolean> {
    return this.booleanRpc('SELECT public.persist_post_response_hypothesis_generation_v1($1) AS value', [id]);
  }

  async executeHypothesisUpdateBatch(
    id: string,
    invocationIds: ReadonlyArray<{ updateId: string; confidenceEvaluationId: string }>,
  ): Promise<boolean> {
    return this.booleanRpc(
      'SELECT public.execute_post_response_hypothesis_update_batch_v1($1, $2::jsonb) AS value',
      [id, JSON.stringify(invocationIds)],
    );
  }

  async executeConfidenceBatch(id: string): Promise<ConfidenceBatchCommandStatus> {
    const rows = await this.db.asRole<{ value: string | null }>(
      'service_role',
      'SELECT public.execute_post_response_confidence_batch_v1($1) AS value',
      [id],
    );
    const value = rows[0]?.value ?? '';
    return (CONFIDENCE_BATCH_COMMAND_STATUSES as readonly string[]).includes(value) ? (value as ConfidenceBatchCommandStatus) : 'NO_OP';
  }

  async syncInformationGaps(id: string): Promise<InformationGapSyncResult> {
    // Same canonical SQL command and same strict production parser as the
    // production repository; this adapter only substitutes the transport.
    this.informationGapSyncCount += 1;
    const rows = await this.db.asRole<{ value: unknown }>(
      'service_role',
      'SELECT public.sync_post_response_information_gaps_v1($1) AS value',
      [id],
    );
    const parsed = parseInformationGapSyncResult(rows[0]?.value);
    if (!parsed) throw new Error('POST_RESPONSE_DATABASE_UNAVAILABLE');
    return parsed;
  }

  async finish(id: string, state: 'COMPLETED' | 'SKIPPED' | 'QUARANTINED' | 'FAILED', outcome: string, stage: string): Promise<boolean> {
    return this.booleanRpc('SELECT public.finish_post_response_intelligence_execution_v1($1, $2, $3, $4) AS value', [id, state, outcome, stage]);
  }

  private async booleanRpc(text: string, values: readonly unknown[]): Promise<boolean> {
    const rows = await this.db.asRole<{ value: boolean }>('service_role', text, values);
    return rows[0]?.value === true;
  }
}
