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
 *   - PROPOSED — the S5-04 PRODUCT COPY GATE (ONE bounded gate; implementation record §14): the three facts no approved
 *     surface states — a direct reply to the reader's own post, a relation request waiting on the reader, and the
 *     acceptance of the reader's own request. Nothing here is approved until the Product Owner says so.
 */
export interface Bilingual { readonly ar: string; readonly en: string }

export const PUBLIC_ACTIVITY_COPY_GATE = {
  status: 'S5-04 PRODUCT COPY GATE — OPEN — 3 rows PROPOSED',
  reused: ['ambient'],
  approved: [],
  proposed: ['replyToOwnPost', 'relationRequest', 'relationAccepted'],
} as const;

export const PUBLIC_ACTIVITY_COPY = Object.freeze({
  /** REUSED — p3.generic.public (A3-02 Lock Screen L1 Public line). */
  ambient: LOCK_SCREEN_COPY.generic.PUBLIC as Bilingual,
  /** PROPOSED — S5-04 Product Copy Gate. A direct human reply to the reader's own post (Class 3). */
  replyToOwnPost: { ar: 'ردّ أحدهم على مشاركتك في النقاش.', en: 'Someone replied to your post in the discussion.' },
  /** PROPOSED — S5-04 Product Copy Gate. A relation request waiting on the reader's acceptance (Class 3, actionable). */
  relationRequest: { ar: 'طلب علاقة جديد مع إحدى تجاربك في العالم العام.', en: 'A new relation request for one of your Experiences in the Public World.' },
  /** PROPOSED — S5-04 Product Copy Gate. The reader's own relation request was accepted (Class 3). */
  relationAccepted: { ar: 'قُبل طلب العلاقة الذي أرسلته.', en: 'Your relation request was accepted.' },
});
