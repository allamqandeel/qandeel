import { Injectable } from '@nestjs/common';
import { ActivityPublisher, type ActivityCandidate } from '../activity/activity-publisher.service';
import type { InterruptionClass } from '../activity/activity.types';
import { PUBLIC_ACTIVITY_COPY, type Bilingual } from './public-activity-copy';
import { PublicActivityRepository, type PublicActivitySourceKind, type PublicActivitySourceRow } from './public-activity.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** The exact Public Direct Entry refs (A3-01 `entry_ref`, 1–200): one Experience's discussion, or one relation. */
export const publicDiscussionEntry = (experienceId: string): string => `discussion:${experienceId.toLowerCase()}`;
export const publicRelationEntry = (relationId: string): string => `relations:${relationId.toLowerCase()}`;

/** What ONE Public fact becomes for ONE recipient (Product Owner D5). Every value is a frozen Product fact; none is a score. */
interface Projection {
  readonly key: string;
  readonly interruptionClass: InterruptionClass;
  readonly actionable: boolean;
  readonly body: Bilingual;
  readonly entryRef: string;
}

const relation = (row: PublicActivitySourceRow): string | null =>
  (typeof row.relation_id === 'string' && UUID.test(row.relation_id) ? row.relation_id : null);

const PROJECTIONS: Readonly<Record<string, (row: PublicActivitySourceRow) => Projection | null>> = Object.freeze({
  // A direct human reply to the reader's own post — D25 "direct reply": Class 3, Push-eligible.
  REPLY_TO_OWN_POST: (row: PublicActivitySourceRow): Projection => ({
    key: 'reply', interruptionClass: 3, actionable: false, body: PUBLIC_ACTIVITY_COPY.replyToOwnPost, entryRef: publicDiscussionEntry(row.experience_id),
  }),
  // A new top-level post on the reader's own Experience — ordinary engagement (D25 "usually Activity"): Class 4, ambient,
  // never a Push (Product Owner D5).
  POST_ON_OWN_EXPERIENCE: (row: PublicActivitySourceRow): Projection => ({
    key: 'post', interruptionClass: 4, actionable: false, body: PUBLIC_ACTIVITY_COPY.ambient, entryRef: publicDiscussionEntry(row.experience_id),
  }),
  // A relation request waiting on the reader: Class 3, actionable — it waits until opened. It accepts nothing.
  RELATION_REQUEST: (row: PublicActivitySourceRow): Projection | null => {
    const id = relation(row);
    return id === null ? null
      : { key: 'relation-request', interruptionClass: 3, actionable: true, body: PUBLIC_ACTIVITY_COPY.relationRequest, entryRef: publicRelationEntry(id) };
  },
  // The reader's own request was accepted: Class 3, not actionable.
  RELATION_ACCEPTED: (row: PublicActivitySourceRow): Projection | null => {
    const id = relation(row);
    return id === null ? null
      : { key: 'relation-accepted', interruptionClass: 3, actionable: false, body: PUBLIC_ACTIVITY_COPY.relationAccepted, entryRef: publicRelationEntry(id) };
  },
});

/**
 * S5-04 — the ONE Public Activity producer (I-08N-01 D25; A3-01 G-16; S5-03C G03). The Public domain is the source of
 * truth; Activity is only its projection, reached through the ONE boundary, `ActivityPublisher` (the S4-04 precedent).
 *
 * It is called after a Public command has COMMITTED its durable fact, with that fact's identity only. The 0147 server
 * pass then says, from canonical Public truth, who may legitimately be told now — never the actor, only admitted humans,
 * nothing for anything not served. This producer renders one bounded sentence per recipient and publishes it under a
 * stable candidate key and source reference, so a retried command is a DUPLICATE and never a second notification.
 *
 * It creates NOTHING for a relation declined, cancelled or removed (the pending request item is withdrawn instead), for a
 * completed @qandeel response (it appears in the discussion where it was asked) or for Public discovery (no canonical
 * discovery source exists). Disclosure is bounded at L2 (D15 Public default). A failure is absorbed: the fact is durable
 * and the Public command's own answer is already decided. Nothing is logged.
 */
@Injectable()
export class PublicActivityProducer {
  constructor(private readonly sources: PublicActivityRepository, private readonly publisher: ActivityPublisher) {}

  /** A committed human post or reply (S5-04 discussion). */
  discussionPost(postId: string): Promise<void> {
    return this.produce('DISCUSSION_POST', postId);
  }

  /** A relation request committed by this command (S5-03C request). */
  relationRequested(relationId: string): Promise<void> {
    return this.produce('RELATION_REQUEST', relationId);
  }

  /** The relation was accepted: the requester is told; the request item no longer stands. */
  async relationAccepted(relationId: string): Promise<void> {
    await this.withdrawRequest(relationId);
    await this.produce('RELATION_ACCEPTED', relationId);
  }

  /** Declined, cancelled or removed: no new item; the pending request item is withdrawn wherever it still stands. */
  relationEnded(relationId: string): Promise<void> {
    return this.withdrawRequest(relationId);
  }

  private async withdrawRequest(relationId: string): Promise<void> {
    if (!UUID.test(relationId)) return;
    const id = relationId.toLowerCase();
    let rows: PublicActivitySourceRow[];
    try {
      rows = await this.sources.source('RELATION_ENDED', id);
    } catch {
      return;
    }
    for (const row of rows) {
      if (!UUID.test(row.recipient_user_id)) continue;
      await this.publisher.withdraw(row.recipient_user_id, `public:relation-request:${id}`).catch(() => undefined);
    }
  }

  private async produce(kind: PublicActivitySourceKind, sourceId: string): Promise<void> {
    if (!UUID.test(sourceId)) return;
    const id = sourceId.toLowerCase();
    let rows: PublicActivitySourceRow[];
    try {
      rows = await this.sources.source(kind, id);
    } catch {
      return;
    }
    for (const row of rows) {
      if (!UUID.test(row.recipient_user_id) || !UUID.test(row.experience_id) || !Number.isFinite(Date.parse(row.occurred_at))) continue;
      const projection = PROJECTIONS[row.event_kind]?.(row) ?? null;
      if (projection === null) continue;
      const candidate: ActivityCandidate = {
        recipientUserId: row.recipient_user_id,
        candidateKey: `s5-04:${projection.key}:${id}`,
        sourceRef: `public:${projection.key}:${id}`,
        kind: 'PUBLIC_INTERACTION',
        interruptionClass: projection.interruptionClass,
        contextRef: row.experience_id.toLowerCase(),
        contextLabel: null,
        entry: { destination: 'PUBLIC_WORLD', ref: projection.entryRef },
        speaker: 'PRODUCT',
        body: projection.body,
        secondary: null,
        actionable: projection.actionable,
        disclosureMax: 'L2',
        occurredAt: new Date(Date.parse(row.occurred_at)).toISOString(),
      };
      await this.publisher.publish(candidate).catch(() => undefined);
    }
  }
}
