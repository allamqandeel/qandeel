import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

/** The dispatcher's one-word answers (migration 0166 `server_forward_approved_matching_proposals_v1`). */
export const FORWARD_OUTCOMES = [
  'FORWARDED', 'SKIPPED_MOVED', 'SKIPPED_DELETION_PENDING', 'SKIPPED_NO_CONCLUSION', 'SKIPPED_NOT_CLEARED',
  'SKIPPED_NOT_READY', 'SKIPPED_STALE', 'HELD_INTEGRITY', 'BUSY', 'NONE_DUE',
] as const;
export type ForwardOutcome = (typeof FORWARD_OUTCOMES)[number];

/**
 * One committed proposal delivery whose recipient has no Activity member yet (migration 0166
 * `server_list_proposal_delivery_activity_reconciliation_v1`). Every value is the database's own; nothing here came from a
 * client.
 */
export interface UnpublishedDelivery {
  readonly deliveryTransitionId: string;
  readonly proposalId: string;
  readonly recipientUserId: string;
  readonly candidateKey: string;
  readonly deliveredAt: string;
}

/** The database's answer had a shape no migration produces. Carries no answer content. */
export class IntroductionsForwardAnswerError extends Error {
  constructor() {
    super('Introductions forward answer was malformed.');
    this.name = 'IntroductionsForwardAnswerError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/**
 * One dispatcher call waits at most its own 2 s lock_timeout for the pair lock, the same again inside the frozen core and
 * 100 ms for the ledger; this bound sits above that. An implementation detail, not Product authority.
 */
export const FORWARD_CALL_TIMEOUT_MS = 10_000;

/**
 * S6-07 (CP2, CA-SYS-02) — the forward dispatcher's two calls, on the server channel only: the database grants them to
 * the service role and to no client. No client token and no client-supplied id ever reaches them: the dispatcher takes
 * only `p_max = 1`, and the lister answers ids the database itself holds.
 */
@Injectable()
export class IntroductionsForwardDispatchRepository {
  constructor(private readonly serviceApi: SupabaseServiceRoleApiService) {}

  /** One single-proposal attempt, in its own transaction. Answers one word and no identity. */
  async forwardOne(): Promise<ForwardOutcome> {
    const answer = await this.serviceApi.rpc<unknown>('server_forward_approved_matching_proposals_v1', { p_max: 1 },
      { timeoutMs: FORWARD_CALL_TIMEOUT_MS });
    if (!Array.isArray(answer) || answer.length !== 1 || typeof answer[0] !== 'object' || answer[0] === null) {
      throw new IntroductionsForwardAnswerError();
    }
    const row = answer[0] as Record<string, unknown>;
    if (Object.keys(row).length !== 1 || !FORWARD_OUTCOMES.includes(row.outcome as ForwardOutcome)) {
      throw new IntroductionsForwardAnswerError();
    }
    return row.outcome as ForwardOutcome;
  }

  /** The committed deliveries still waiting for their Activity member, oldest first. */
  async listUnpublishedDeliveries(limit: number): Promise<UnpublishedDelivery[]> {
    const rows = await this.serviceApi.rpc<unknown>('server_list_proposal_delivery_activity_reconciliation_v1', { p_limit: limit });
    if (!Array.isArray(rows) || rows.length > limit) throw new IntroductionsForwardAnswerError();
    return rows.map((row: unknown) => {
      if (typeof row !== 'object' || row === null) throw new IntroductionsForwardAnswerError();
      const r = row as Record<string, unknown>;
      const ids = [r.delivery_transition_id, r.proposal_id, r.recipient_user_id];
      if (ids.some((id) => typeof id !== 'string' || !UUID.test(id)) || r.action !== 'PUBLISH'
          || r.candidate_key !== `introductions:proposal-delivered:${String(r.delivery_transition_id)}`
          || typeof r.delivered_at !== 'string' || Number.isNaN(Date.parse(r.delivered_at))) {
        throw new IntroductionsForwardAnswerError();
      }
      return {
        deliveryTransitionId: r.delivery_transition_id as string, proposalId: r.proposal_id as string,
        recipientUserId: r.recipient_user_id as string, candidateKey: r.candidate_key as string, deliveredAt: r.delivered_at,
      };
    });
  }
}
