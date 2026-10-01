import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { EvidenceRole, HypothesisStatus } from '../hypothesis/hypothesis.types';
import { MAX_ACTIVE_HYPOTHESES } from '../hypothesis/hypothesis.types';
import { MAX_DETAIL_EVOLUTION } from './understanding.types';

export interface UnderstandingEvidenceUpdateRow {
  readonly evidence_role: EvidenceRole;
  readonly created_at: string;
}

export interface UnderstandingLifecycleTransitionRow {
  readonly before_status: HypothesisStatus;
  readonly after_status: HypothesisStatus;
  readonly after_version: number;
  readonly source: string;
  readonly created_at: string;
}

/** U3 — one of the reader's contests under review (migration 0127). No text, no reasoning. */
export interface UnderstandingContestRow {
  readonly hypothesis_id: string;
  readonly reevaluation_after_version: number;
  readonly created_at: string;
}

/**
 * W3-CORR-U — one of the reader's contests on ONE item, for that item's evolution: under review or resolved (migration
 * 0134). The resolution reason stays on the server; only whether the reader themself agreed reaches the projection.
 */
export interface UnderstandingContestHistoryRow {
  readonly lifecycle: 'UNDER_REVIEW' | 'RESOLVED';
  readonly reevaluation_before_status: HypothesisStatus;
  readonly reevaluation_after_version: number;
  readonly created_at: string;
  readonly resolved_at: string | null;
  readonly resolution_reason: 'USER_CONFIRMED_CURRENT_INTERPRETATION' | 'INTERPRETATION_WITHDRAWN' | null;
}

/** W3-CORR-U — the resolution command's one bounded answer. */
export interface UnderstandingResolutionRow {
  readonly outcome: string;
  readonly resolved_version: number | null;
}

/** U3 — the disagreement command's one bounded answer. */
export interface UnderstandingDisagreementRow {
  readonly outcome: string;
  readonly contested_version: number | null;
  readonly reevaluated_version: number | null;
  /** R2 — the contest's ONE durable Confidence evaluation identity (RECORDED / ALREADY_UNDER_REVIEW). Server-only. */
  readonly confidence_evaluation_id: string | null;
}

/**
 * The Understanding reads and commands. Every table read is owner-SELECT-only under RLS (migrations 0008, 0036, 0126,
 * 0127), is read with the CALLER'S token, and is additionally filtered by the caller's user id. Only the columns the
 * Product projection needs are selected: no audit id and no Evidence identifier. Versions are read only to bind and to
 * de-duplicate internally; none leaves the server.
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

  /**
   * U3 — the reader's contests under review ON THESE items. Contests never lapse, so an unfiltered, capped read could
   * silently drop an old contest on a still-current item; the read is therefore bound to the exact current item ids
   * (at most the active cap), and one contest under review per item bounds the answer to the same number.
   */
  listContestsUnderReview(token: string, userId: string, hypothesisIds: readonly string[]): Promise<UnderstandingContestRow[]> {
    if (hypothesisIds.length === 0) return Promise.resolve([]);
    if (hypothesisIds.length > MAX_ACTIVE_HYPOTHESES) throw new Error('UNDERSTANDING_CONTEST_READ_BOUND_EXCEEDED');
    const query = new URLSearchParams({
      select: 'hypothesis_id,reevaluation_after_version,created_at', user_id: `eq.${userId}`, lifecycle: 'eq.UNDER_REVIEW',
      hypothesis_id: `in.(${hypothesisIds.join(',')})`, order: 'created_at.desc,id.asc', limit: String(hypothesisIds.length),
    });
    return this.dataApi.request<UnderstandingContestRow[]>(token, `understanding_contests?${query}`);
  }

  /**
   * U3 — the reader's explicit disagreement (migration 0127), on the caller's own token. The database derives the
   * owner, locks the item, binds the contest to the exact version, performs the lifecycle re-evaluation step and
   * answers one bounded row. The request carries no text.
   */
  recordDisagreement(token: string, commandId: string, hypothesisId: string, expectedVersion: number): Promise<UnderstandingDisagreementRow[]> {
    return this.dataApi.request<UnderstandingDisagreementRow[]>(token, 'rpc/record_understanding_disagreement_v1', {
      method: 'POST', body: JSON.stringify({ p_command_id: commandId, p_hypothesis_id: hypothesisId, p_expected_version: expectedVersion }),
    });
  }

  /**
   * W3-CORR-U — the reader's explicit resolution (migration 0134), on the caller's own token: "I agree with this now"
   * at the exact version they see. The database derives the owner, locks the item, owns the reason and answers one
   * bounded row. The request carries no text and no reason.
   */
  resolveDisagreement(token: string, commandId: string, hypothesisId: string, expectedVersion: number): Promise<UnderstandingResolutionRow[]> {
    return this.dataApi.request<UnderstandingResolutionRow[]>(token, 'rpc/resolve_understanding_disagreement_v1', {
      method: 'POST', body: JSON.stringify({ p_command_id: commandId, p_hypothesis_id: hypothesisId, p_expected_version: expectedVersion }),
    });
  }

  /**
   * W3-CORR-U — every contest the reader made on ONE item, newest first and bounded like the rest of the evolution. A
   * resolved contest is history that is never erased, so its disagreement is still told.
   */
  listContestHistory(token: string, userId: string, hypothesisId: string): Promise<UnderstandingContestHistoryRow[]> {
    const query = new URLSearchParams({
      select: 'lifecycle,reevaluation_before_status,reevaluation_after_version,created_at,resolved_at,resolution_reason',
      user_id: `eq.${userId}`, hypothesis_id: `eq.${hypothesisId}`, order: 'created_at.desc,id.asc', limit: String(MAX_DETAIL_EVOLUTION),
    });
    return this.dataApi.request<UnderstandingContestHistoryRow[]>(token, `understanding_contests?${query}`);
  }

  listLifecycleTransitions(token: string, userId: string, hypothesisId: string): Promise<UnderstandingLifecycleTransitionRow[]> {
    const query = new URLSearchParams({
      select: 'before_status,after_status,after_version,source,created_at', user_id: `eq.${userId}`, hypothesis_id: `eq.${hypothesisId}`,
      order: 'created_at.desc,id.asc', limit: String(MAX_DETAIL_EVOLUTION),
    });
    return this.dataApi.request<UnderstandingLifecycleTransitionRow[]>(token, `hypothesis_lifecycle_transitions?${query}`);
  }
}
