import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { ConfidenceEvaluationRecord, CreateConfidenceEvaluation } from './confidence.types';
import { MAX_ACTIVE_HYPOTHESES } from './hypothesis.types';

const FIELDS = 'id,user_id,target_id,target_type,target_version,version,lifecycle_state,numeric_score,confidence_band,calibration_state,stability,supporting_evidence_ids,contradicting_evidence_ids,assumptions,alternative_hypothesis_ids,missing_information_codes,policy_version,provenance,created_at,updated_at';
export const MAX_BULK_CONFIDENCE_ROWS = MAX_ACTIVE_HYPOTHESES * 32;

@Injectable()
export class ConfidenceRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}

  async create(token: string, value: CreateConfidenceEvaluation): Promise<ConfidenceEvaluationRecord> {
    const rows = await this.dataApi.request<ConfidenceEvaluationRecord[]>(token, 'rpc/create_confidence_evaluation', {
      method: 'POST', body: JSON.stringify({ p_evaluation: value }),
    });
    return rows[0];
  }

  listForTarget(token: string, userId: string, targetId: string): Promise<ConfidenceEvaluationRecord[]> {
    const query = new URLSearchParams({
      select: FIELDS, user_id: `eq.${userId}`, target_id: `eq.${targetId}`,
      order: 'created_at.desc,id.asc', limit: '32',
    });
    return this.dataApi.request<ConfidenceEvaluationRecord[]>(token, `confidence_evaluations?${query}`);
  }
  listExactVersionsForTargets(
    token: string, userId: string, targets: ReadonlyArray<{ id: string; version: number }>,
  ): Promise<ConfidenceEvaluationRecord[]> {
    if (targets.length === 0) return Promise.resolve([]);
    if (targets.length > MAX_ACTIVE_HYPOTHESES) throw new Error('CONFIDENCE_BULK_TARGET_BOUND_EXCEEDED');
    const exactPairs = targets.map(({ id, version }) => `and(target_id.eq.${id},target_version.eq.${version})`).join(',');
    const query = new URLSearchParams({
      select: FIELDS, user_id: `eq.${userId}`, target_type: 'eq.HYPOTHESIS',
      provenance: 'eq.QANDEEL_CONFIDENCE_RUNTIME', or: `(${exactPairs})`,
      order: 'created_at.desc,id.asc', limit: String(MAX_BULK_CONFIDENCE_ROWS),
    });
    return this.dataApi.request<ConfidenceEvaluationRecord[]>(token, `confidence_evaluations?${query}`);
  }
  async find(token: string, userId: string, id: string): Promise<ConfidenceEvaluationRecord | undefined> {
    const query = new URLSearchParams({ select: FIELDS, id: `eq.${id}`, user_id: `eq.${userId}`, limit: '1' });
    return (await this.dataApi.request<ConfidenceEvaluationRecord[]>(token, `confidence_evaluations?${query}`))[0];
  }
}
