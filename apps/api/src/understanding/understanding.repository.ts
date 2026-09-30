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

  /**
   * U2 — the reader's explicit "talk to QANDEEL about this" act (migration 0126), on the caller's own token. The
   * database derives the owner from auth.uid(), locks the item, rechecks the exact version and answers a bounded word.
   */
  openDiscussion(token: string, hypothesisId: string, expectedVersion: number): Promise<unknown> {
    return this.dataApi.request<unknown>(token, 'rpc/open_understanding_discussion_v1', {
      method: 'POST', body: JSON.stringify({ p_hypothesis_id: hypothesisId, p_expected_version: expectedVersion }),
    });
  }

  closeDiscussion(token: string, hypothesisId: string): Promise<unknown> {
    return this.dataApi.request<unknown>(token, 'rpc/close_understanding_discussion_v1', {
      method: 'POST', body: JSON.stringify({ p_hypothesis_id: hypothesisId }),
    });
  }

  listLifecycleTransitions(token: string, userId: string, hypothesisId: string): Promise<UnderstandingLifecycleTransitionRow[]> {
    const query = new URLSearchParams({
      select: 'before_status,after_status,source,created_at', user_id: `eq.${userId}`, hypothesis_id: `eq.${hypothesisId}`,
      order: 'created_at.desc,id.asc', limit: String(MAX_DETAIL_EVOLUTION),
    });
    return this.dataApi.request<UnderstandingLifecycleTransitionRow[]>(token, `hypothesis_lifecycle_transitions?${query}`);
  }
}
