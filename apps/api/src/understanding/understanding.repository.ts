import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { EvidenceRole, HypothesisStatus } from '../hypothesis/hypothesis.types';
import { MAX_DETAIL_EVOLUTION } from './understanding.types';

export interface UnderstandingEvidenceUpdateRow {
  readonly evidence_role: EvidenceRole;
  readonly created_at: string;
}

export interface UnderstandingLifecycleTransitionRow {
  readonly before_status: HypothesisStatus;
  readonly after_status: HypothesisStatus;
  readonly source: string;
  readonly created_at: string;
}

/**
 * The evolution reads of one owned Hypothesis. Both tables are owner-SELECT-only under RLS (migrations 0008 and
 * 0036), are read with the CALLER'S token, and are additionally filtered by the caller's user id. Only the columns the
 * Product evolution needs are selected: no audit id, no version, no Evidence identifier.
 */
@Injectable()
export class UnderstandingRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}

  listEvidenceUpdates(token: string, userId: string, hypothesisId: string): Promise<UnderstandingEvidenceUpdateRow[]> {
    const query = new URLSearchParams({
      select: 'evidence_role,created_at', user_id: `eq.${userId}`, hypothesis_id: `eq.${hypothesisId}`,
      order: 'created_at.desc,id.asc', limit: String(MAX_DETAIL_EVOLUTION),
    });
    return this.dataApi.request<UnderstandingEvidenceUpdateRow[]>(token, `hypothesis_updates?${query}`);
  }

  listLifecycleTransitions(token: string, userId: string, hypothesisId: string): Promise<UnderstandingLifecycleTransitionRow[]> {
    const query = new URLSearchParams({
      select: 'before_status,after_status,source,created_at', user_id: `eq.${userId}`, hypothesis_id: `eq.${hypothesisId}`,
      order: 'created_at.desc,id.asc', limit: String(MAX_DETAIL_EVOLUTION),
    });
    return this.dataApi.request<UnderstandingLifecycleTransitionRow[]>(token, `hypothesis_lifecycle_transitions?${query}`);
  }
}
