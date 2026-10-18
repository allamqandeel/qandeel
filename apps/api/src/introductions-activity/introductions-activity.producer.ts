import { Injectable } from '@nestjs/common';
import { ActivityPublisher, type ActivityCandidate } from '../activity/activity-publisher.service';
import { INTRODUCTIONS_ACTIVITY_COPY } from './introductions-activity-copy';
import { IntroductionsActivityRepository, type PendingIntroductionsEvent } from './introductions-activity.repository';
import type { UnpublishedDelivery } from '../introductions-dispatch/introductions-forward-dispatch.repository';
import type { IntroductionsDeliveryNotifier } from '../introductions-dispatch/introductions-forward-dispatcher.worker';

/**
 * S6-07 (CP3) — the Introductions Activity producer (A3-01 G-17; I-08N-01 D26, D38–D43; the approved CP0 Event Matrix
 * with Q6 and Q10). The Introductions domain is the source of truth; Activity is only its projection, reached through
 * the ONE boundary, `ActivityPublisher.publish(candidate)`.
 *
 * It is bound as the forward dispatcher's notifier and runs inside that server pass, after the cycle's forwards, never
 * inside a forward transaction. Every candidate comes from a durable row the domain already committed, through
 * migration 0167, for a recipient that durable truth already authorizes NOW; nothing is taken from a client:
 *   - a delivered proposal (the 0166 lister finds it; 0167 re-reads it): its recipient, `proposal:<id>`, until the
 *     proposal's own deadline;
 *   - every other event (0167's lister): WORLD_BORN (both humans, Q6), HUMAN_TEXT (the other human), DISCLOSURE (the
 *     counterpart), ENDED (the human who did not end it, or the retained-view holder) and SUCCESS_REQUESTED (an approver
 *     who has not approved) — `world:<id>`, in the context of that one World, so its mute applies.
 *
 * The candidate key is the event's own identity: a retry, a restart or a second worker is a DUPLICATE in Activity, never
 * a second item, and an event whose publication failed stays listed until it succeeds (recovery by construction).
 *
 * Interruption value (D10) is the fact's own: a human message is ordinary conversation — Class 4, ambient, in Activity
 * only, never a push (Q10, the S4-04 precedent). Everything else here is a meaningful Introductions state change —
 * Class 3. Disclosure is bounded at L0 (D15, the Introductions Lock Screen default): outside the Product only «إشعار
 * جديد», on the neutral channel. The one in-app sentence is the approved generic Introductions line; no item carries a
 * name, a message, a shared detail, a reason, an outcome or a label. Nothing is logged.
 */
@Injectable()
export class IntroductionsActivityProducer implements IntroductionsDeliveryNotifier {
  constructor(private readonly sources: IntroductionsActivityRepository, private readonly publisher: ActivityPublisher) {}

  /** One committed delivery: published only while 0167 still answers it for exactly this recipient. */
  async publishDelivered(delivery: UnpublishedDelivery): Promise<void> {
    const source = await this.sources.delivery(delivery.deliveryTransitionId);
    if (source === null || source.recipientUserId !== delivery.recipientUserId || source.proposalId !== delivery.proposalId) return;
    const proposal = source.proposalId.toLowerCase();
    await this.publisher.publish({
      ...this.base(source.recipientUserId, delivery.candidateKey, 3, source.deliveredAt),
      sourceRef: `introductions:proposal:${proposal}`,
      contextRef: null,
      entry: { destination: 'INTRODUCTIONS', ref: `proposal:${proposal}` },
      expiresAt: new Date(Date.parse(source.expiresAt)).toISOString(),
    });
  }

  /** Every other event not told yet, at most `limit`: counts only. A failure leaves the event listed for the next pass. */
  async publishPendingEvents(limit: number): Promise<{ readonly published: number; readonly failed: number }> {
    const pending = await this.sources.pending(limit);
    let published = 0;
    let failed = 0;
    for (const event of pending) {
      try {
        await this.publisher.publish(this.candidateOf(event));
        published += 1;
      } catch {
        failed += 1;
      }
    }
    return { published, failed };
  }

  private candidateOf(event: PendingIntroductionsEvent): ActivityCandidate {
    const world = event.worldId.toLowerCase();
    return {
      ...this.base(event.recipientUserId, event.candidateKey, event.event === 'HUMAN_TEXT' ? 4 : 3, event.occurredAt),
      sourceRef: event.candidateKey,
      contextRef: world,
      entry: { destination: 'INTRODUCTIONS', ref: `world:${world}` },
    };
  }

  private base(recipientUserId: string, candidateKey: string, interruptionClass: 3 | 4, occurredAt: string) {
    return {
      recipientUserId,
      candidateKey,
      kind: 'INTRODUCTION' as const,
      interruptionClass,
      contextLabel: null,
      speaker: 'PRODUCT' as const,
      body: INTRODUCTIONS_ACTIVITY_COPY.update,
      secondary: null,
      disclosureMax: 'L0' as const,
      occurredAt: new Date(Date.parse(occurredAt)).toISOString(),
    };
  }
}
