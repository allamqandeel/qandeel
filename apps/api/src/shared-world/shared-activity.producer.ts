import { Injectable } from '@nestjs/common';
import { ActivityPublisher, type ActivityCandidate } from '../activity/activity-publisher.service';
import type { InterruptionClass } from '../activity/activity.types';
import { SHARED_ACTIVITY_COPY, withName, type Bilingual } from './shared-activity-copy';
import { SharedActivityRepository, type SharedActivitySourceKind, type SharedActivitySourceRow } from './shared-activity.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** A Name is the person's own; bounded so a sentence always fits the A3-01 280-character body. */
const NAME_MAX = 80;
const nameOf = (value: string | null): string | null => (typeof value === 'string' && value.length > 0 ? value.slice(0, NAME_MAX) : null);

const PROPOSAL_SENTENCE: Readonly<Record<string, (row: SharedActivitySourceRow) => Bilingual>> = Object.freeze({
  REMOVE_MEMBER: (row) => withName(SHARED_ACTIVITY_COPY.proposalRemoval, nameOf(row.subject_name)),
  WORLD_SETTINGS_CHANGE: () => SHARED_ACTIVITY_COPY.proposalSettings,
  END_WORLD: () => SHARED_ACTIVITY_COPY.proposalEnd,
  ADD_MEMBER: () => SHARED_ACTIVITY_COPY.proposalAdd,
  REJOIN_MEMBER: () => SHARED_ACTIVITY_COPY.proposalRejoin,
});

/** What ONE Shared fact becomes for ONE recipient. Every value is a frozen Product fact; none is a score. */
interface Projection {
  readonly interruptionClass: InterruptionClass;
  readonly body: Bilingual;
  readonly secondary?: Bilingual;
  /** The World label — never for a reader who is not yet in the World. */
  readonly label: boolean;
  /** SHARED_WORLD: enter the exact World (revalidated at open); NONE: the reader cannot enter it (yet). */
  readonly enter: boolean;
}

/**
 * S4-04 — the Shared Activity producer (I-08N-01 D24; A3-01 G-15; S4-01 G-16). The Shared domain is the source of truth;
 * Activity is only its projection, reached through the ONE boundary, `ActivityPublisher.publish(candidate)`.
 *
 * It is called after a Shared command has COMMITTED its durable fact, with that fact's identity only. The 0141 server
 * pass then says, from durable Shared truth, who may legitimately be told now; this producer renders one bounded,
 * already-approved sentence per recipient and publishes it, recipient-scoped, under a stable candidate key and source
 * reference, so a retried command (the same command id, the same material, the same World) is a DUPLICATE in Activity
 * and never a second notification (D57).
 *
 * Interruption value (D10) is the fact's own, never "activity occurred" (D24):
 *   - a human message is ordinary conversation — Class 4, ambient: it lands in Activity, carries no mark, never strips
 *     and never pushes. No message text, preview, mention or inferred meaning is ever used;
 *   - a proposal waiting on the reader, an add / rejoin request waiting on its target, a person joining the World — a
 *     governance / membership change (D24) — Class 3, meaningful;
 *   - a voluntary leave — a membership change with nothing for the reader to do — Class 4, ambient.
 * Class 1 is never Shared (D10); Class 2 needs a genuine timing window, and no Shared fact here has one.
 *
 * Disclosure is bounded at L2 (the Shared default, D15): a context title and the bounded sentence; never content.
 *
 * Publication never changes a Shared answer: a failure here is absorbed (the fact is durable; the Shared command's
 * own answer is already decided), and nothing is logged — no content, no Name, no identity.
 */
@Injectable()
export class SharedActivityProducer {
  constructor(private readonly sources: SharedActivityRepository, private readonly publisher: ActivityPublisher) {}

  /** A committed human message (S4-02 send). */
  humanText(materialId: string): Promise<void> {
    return this.produce('HUMAN_TEXT', materialId, 'human-text', () => ({ interruptionClass: 4, body: SHARED_ACTIVITY_COPY.ambient, label: true, enter: true }));
  }

  /** A proposal opened by this command (S4-03 settings / removal / end / add / rejoin). */
  proposal(commandId: string): Promise<void> {
    return this.produce('PROPOSAL', commandId, 'proposal', (row) => {
      const sentence = PROPOSAL_SENTENCE[row.operation_kind ?? ''];
      if (sentence === undefined) return null;
      return {
        interruptionClass: 3, body: sentence(row), secondary: withName(SHARED_ACTIVITY_COPY.proposedBy, nameOf(row.actor_name)), label: true, enter: true,
      };
    });
  }

  /** An add / rejoin request that, after this approval, waits on its target. The target is not in the World yet. */
  memberRequest(proposalId: string): Promise<void> {
    return this.produce('MEMBER_REQUEST', proposalId, 'member-request', (row) => {
      const sentence = row.operation_kind === 'ADD_MEMBER' ? SHARED_ACTIVITY_COPY.memberRequestAdd
        : row.operation_kind === 'REJOIN_MEMBER' ? SHARED_ACTIVITY_COPY.memberRequestRejoin : null;
      return sentence === null ? null : { interruptionClass: 3, body: withName(sentence, nameOf(row.actor_name)), label: false, enter: false };
    });
  }

  /**
   * The reader accepted an add / rejoin request (this command): the other members are told; the reader's own request
   * item is withdrawn — it no longer stands, and it never resurrects.
   */
  async joined(commandId: string, requestId: string, readerUserId: string): Promise<void> {
    await this.produce('JOINED', commandId, 'joined', (row) => ({ interruptionClass: 3, body: withName(SHARED_ACTIVITY_COPY.joined, nameOf(row.actor_name)), label: true, enter: true }));
    if (UUID.test(requestId) && UUID.test(readerUserId)) {
      await this.publisher.withdraw(readerUserId, `shared:member-request:${requestId.toLowerCase()}`).catch(() => undefined);
    }
  }

  /** A World was born by the reader's acceptance: its inviter is told. */
  birth(worldId: string): Promise<void> {
    return this.produce('BIRTH', worldId, 'birth', (row) => ({ interruptionClass: 3, body: withName(SHARED_ACTIVITY_COPY.joined, nameOf(row.actor_name)), label: true, enter: true }));
  }

  /** A voluntary leave (this command): the remaining members' Activity, ambient. */
  left(commandId: string): Promise<void> {
    return this.produce('LEFT', commandId, 'left', () => ({ interruptionClass: 4, body: SHARED_ACTIVITY_COPY.ambient, label: true, enter: true }));
  }

  private async produce(kind: SharedActivitySourceKind, sourceId: string, key: string, project: (row: SharedActivitySourceRow) => Projection | null): Promise<void> {
    if (!UUID.test(sourceId)) return;
    const id = sourceId.toLowerCase();
    let rows: SharedActivitySourceRow[];
    try {
      rows = await this.sources.source(kind, id);
    } catch {
      return;
    }
    for (const row of rows) {
      if (!UUID.test(row.recipient_user_id) || !UUID.test(row.world_id) || !Number.isFinite(Date.parse(row.occurred_at))) continue;
      const projection = project(row);
      if (projection === null) continue;
      const world = row.world_id.toLowerCase();
      const label = projection.label && typeof row.world_name === 'string' && row.world_name.length > 0 ? row.world_name.slice(0, 120) : null;
      const candidate: ActivityCandidate = {
        recipientUserId: row.recipient_user_id,
        candidateKey: `s4-04:${key}:${id}`,
        sourceRef: `shared:${key}:${id}`,
        kind: 'SHARED_ACTIVITY',
        interruptionClass: projection.interruptionClass,
        contextRef: world,
        contextLabel: label === null ? null : { ar: label, en: label },
        entry: projection.enter ? { destination: 'SHARED_WORLD', ref: world } : { destination: 'NONE' },
        speaker: 'PRODUCT',
        body: projection.body,
        secondary: projection.secondary ?? null,
        disclosureMax: 'L2',
        occurredAt: new Date(Date.parse(row.occurred_at)).toISOString(),
      };
      await this.publisher.publish(candidate).catch(() => undefined);
    }
  }
}
