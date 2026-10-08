import { LOCK_SCREEN_COPY } from '../push/push-projection';

/**
 * S5-04 — the bounded sentences the Public source domain hands Activity (A3-01 `ActivityCandidate.body`). Event sentences
 * belong to their source domain (P3 §17), so they live here, beside the Public producer, and nowhere in Activity. None
 * carries discussion content, a QANDEEL response, an Experience's words, a Public display, a count or anything the
 * recipient could not already know, and none names who acted: a notification never needs a Public identity, and D15's
 * L2 is the ceiling.
 *
 * Every row carries its authority:
 *   - REUSED — already approved words, byte-exact: `ambient` is p3.generic.public, the A3-02 L1 Public line
 *     («نشاط جديد في العالم العام»), imported, not copied — for the ambient (Class 4) top-level post on the reader's own
 *     Experience, exactly as S4-04 reuses p3.generic.shared for an ambient Shared message;
 *   - APPROVED — the S5-04 PRODUCT COPY GATE, CLOSED (ONE bounded gate; implementation record §14): the three facts no
 *     earlier surface states — a direct reply to the reader's own post, a relation request waiting on the reader, and the
 *     acceptance of the reader's own request. Approved by the Product Owner (2026-10-08); `relationRequest`'s Arabic as
 *     revised by the Owner.
 */
export interface Bilingual { readonly ar: string; readonly en: string }

export const PUBLIC_ACTIVITY_COPY_GATE = {
  status: 'S5-04 PRODUCT COPY GATE — CLOSED — 3 rows APPROVED (Product Owner, 2026-10-08; with the 9 discussion rows: 12 / 12)',
  reused: ['ambient'],
  approved: ['replyToOwnPost', 'relationRequest', 'relationAccepted'],
  proposed: [],
} as const;

export const PUBLIC_ACTIVITY_COPY = Object.freeze({
  /** REUSED — p3.generic.public (A3-02 Lock Screen L1 Public line). */
  ambient: LOCK_SCREEN_COPY.generic.PUBLIC as Bilingual,
  /** APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08). A direct human reply to the reader's own post (Class 3). */
  replyToOwnPost: { ar: 'ردّ أحدهم على مشاركتك في النقاش.', en: 'Someone replied to your post in the discussion.' },
  /** APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08; Arabic as revised by the Owner). A relation request waiting on the reader's acceptance (Class 3, actionable). */
  relationRequest: { ar: 'هناك طلب علاقة جديد لإحدى تجاربك في العالم العام.', en: 'A new relation request for one of your Experiences in the Public World.' },
  /** APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08). The reader's own relation request was accepted (Class 3). */
  relationAccepted: { ar: 'قُبل طلب العلاقة الذي أرسلته.', en: 'Your relation request was accepted.' },
});
