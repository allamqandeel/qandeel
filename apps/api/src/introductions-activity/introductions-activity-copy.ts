import { LOCK_SCREEN_COPY } from '../push/push-projection';

/**
 * S6-07 (CP3) — the bounded sentence the Introductions source domain hands Activity (A3-01 `ActivityCandidate.body`).
 * Event sentences belong to their source domain (P3 §17), so it lives here, beside the Introductions producer.
 *
 * ONE sentence, for every Introductions event, and it is REUSED: `update` is p3.generic.intro, the A3-02 Lock Screen L1
 * Introductions line («تحديث في التعارف» / "An Introductions update"), imported, not copied — the same words the Shared
 * producer's ambient line reuses from p3.generic.shared. It names no person, no message, no shared detail, no reason
 * and no outcome, so it is safe in the feed and at every disclosure level. Every item is published at L0, the
 * Introductions Lock Screen default (D15): outside the Product a notification only ever says «إشعار جديد».
 *
 * Per-event sentences (a new proposal, a new message, something shared, an ending, a World that began) are Product copy
 * the Product Owner has not approved: they are proposed in the S6-07 CP3 Copy Gate package and NOT shipped here.
 */
export interface Bilingual { readonly ar: string; readonly en: string }

export const INTRODUCTIONS_ACTIVITY_COPY_GATE = {
  status: 'S6-07 CP3 PRODUCT COPY GATE — OPEN — no new row shipped; one row REUSED',
  reused: ['update'],
  approved: [],
  proposed: [],
} as const;

export const INTRODUCTIONS_ACTIVITY_COPY = Object.freeze({
  /** REUSED — p3.generic.intro (A3-02 Lock Screen L1 Introductions line). */
  update: LOCK_SCREEN_COPY.generic.INTRODUCTIONS as Bilingual,
});
