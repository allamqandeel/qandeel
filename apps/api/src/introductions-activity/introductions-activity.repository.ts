import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Every event migration 0167's lister names, and nothing else. */
export const INTRODUCTIONS_ACTIVITY_EVENTS = ['WORLD_BORN', 'HUMAN_TEXT', 'DISCLOSURE', 'ENDED', 'SUCCESS_REQUESTED'] as const;
export type IntroductionsActivityEvent = typeof INTRODUCTIONS_ACTIVITY_EVENTS[number];

/** One Introductions event a legitimate recipient has not been told yet (0167). Identities only; no content, no name. */
export interface PendingIntroductionsEvent {
  readonly event: IntroductionsActivityEvent;
  readonly recipientUserId: string;
  readonly worldId: string;
  readonly sourceId: string;
  readonly candidateKey: string;
  readonly occurredAt: string;
}

/** One proposal delivery, re-read at publish time (0167): still its proposal's current state and before its deadline. */
export interface ProposalDeliverySource {
  readonly recipientUserId: string;
  readonly proposalId: string;
  readonly deliveredAt: string;
  readonly expiresAt: string;
}

/** The database's answer had a shape no migration produces. Carries no answer content. */
export class IntroductionsActivitySourceError extends Error {
  constructor() {
    super('Introductions Activity source answer was malformed.');
    this.name = 'IntroductionsActivitySourceError';
  }
}

const instant = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const keyOf = (event: IntroductionsActivityEvent, row: Record<string, unknown>): string => {
  switch (event) {
    case 'WORLD_BORN': return `introductions:world-born:${String(row.world_id)}`;
    case 'HUMAN_TEXT': return `introductions:human-text:${String(row.source_id)}`;
    case 'DISCLOSURE': return `introductions:disclosure:${String(row.source_id)}`;
    case 'ENDED': return `introductions:ended:${String(row.world_id)}`;
    case 'SUCCESS_REQUESTED': return `introductions:success-requested:${String(row.source_id)}:${String(row.recipient_user_id)}`;
  }
};

/**
 * S6-07 (CP3) — the Introductions Activity sources of migration 0167, on the SERVER channel only (no client token ever
 * reaches them): the lister of events not yet told, and the one delivery re-read. Strictly decoded; a doubtful answer
 * is refused, never repaired.
 */
@Injectable()
export class IntroductionsActivityRepository {
  constructor(private readonly serviceApi: SupabaseServiceRoleApiService) {}

  async pending(limit: number): Promise<PendingIntroductionsEvent[]> {
    const rows = await this.serviceApi.rpc<unknown>('server_list_introductions_activity_v1', { p_limit: limit });
    if (!Array.isArray(rows) || rows.length > limit) throw new IntroductionsActivitySourceError();
    return rows.map((row: unknown) => {
      if (typeof row !== 'object' || row === null) throw new IntroductionsActivitySourceError();
      const r = row as Record<string, unknown>;
      const event = (INTRODUCTIONS_ACTIVITY_EVENTS as readonly unknown[]).includes(r.event) ? r.event as IntroductionsActivityEvent : null;
      if (event === null || [r.recipient_user_id, r.world_id, r.source_id].some((id) => typeof id !== 'string' || !UUID.test(id))
          || r.candidate_key !== keyOf(event, r) || !instant(r.occurred_at)) {
        throw new IntroductionsActivitySourceError();
      }
      return {
        event, recipientUserId: r.recipient_user_id as string, worldId: r.world_id as string, sourceId: r.source_id as string,
        candidateKey: r.candidate_key as string, occurredAt: r.occurred_at as string,
      };
    });
  }

  async delivery(deliveryTransitionId: string): Promise<ProposalDeliverySource | null> {
    const rows = await this.serviceApi.rpc<unknown>('server_read_introductions_proposal_delivery_v1', { p_delivery_transition_id: deliveryTransitionId });
    if (!Array.isArray(rows) || rows.length > 1) throw new IntroductionsActivitySourceError();
    if (rows.length === 0) return null;
    const r = rows[0] as Record<string, unknown> | null;
    if (r === null || typeof r !== 'object' || [r.recipient_user_id, r.proposal_id].some((id) => typeof id !== 'string' || !UUID.test(id))
        || !instant(r.delivered_at) || !instant(r.expires_at)) {
      throw new IntroductionsActivitySourceError();
    }
    return { recipientUserId: r.recipient_user_id as string, proposalId: r.proposal_id as string, deliveredAt: r.delivered_at as string, expiresAt: r.expires_at as string };
  }
}
