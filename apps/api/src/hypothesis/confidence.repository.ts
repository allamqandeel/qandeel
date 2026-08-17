import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { ConfidenceEvaluationRecord, CreateConfidenceEvaluation } from './confidence.types';

const FIELDS = 'id,user_id,target_id,target_type,target_version,version,lifecycle_state,numeric_score,confidence_band,calibration_state,stability,supporting_evidence_ids,contradicting_evidence_ids,assumptions,alternative_hypothesis_ids,missing_information_codes,policy_version,provenance,created_at,updated_at';

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
}
