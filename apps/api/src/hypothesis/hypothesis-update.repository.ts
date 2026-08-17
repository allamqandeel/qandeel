import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { HypothesisMutationResult, HypothesisUpdateRequest } from './hypothesis-update.types';

@Injectable()
export class HypothesisUpdateRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}

  async apply(token: string, updateId: string, request: HypothesisUpdateRequest): Promise<HypothesisMutationResult | undefined> {
    const rows = await this.dataApi.request<HypothesisMutationResult[]>(token, 'rpc/apply_hypothesis_evidence_update', {
      method: 'POST',
      body: JSON.stringify({
        p_update_id: updateId,
        p_hypothesis_id: request.hypothesisId,
        p_expected_version: request.expectedVersion,
        p_evidence_id: request.evidenceId,
        p_evidence_role: request.evidenceRole,
      }),
    });
    return rows[0];
  }
}
