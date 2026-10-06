import { LOCK_SCREEN_COPY } from '../push/push-projection';

/**
 * S4-04 — the bounded sentences the Shared source domain hands Activity (A3-01 `ActivityCandidate.body` /
 * `.secondary`). Event sentences belong to their source domain (P3 §17), so they live here, beside the Shared producer,
 * and nowhere in Activity. None carries message content, a hidden member, a count or anything the recipient cannot
 * already know; a Name is the person's own, never copy.
 *
 * Every row carries its authority:
 *   - REUSED — already approved words, byte-exact (the S4-04 contract pins each against its source):
 *       `ambient`: p3.generic.shared, the A3-02 L1 Shared line («نشاط جديد في العالم المشترك»), imported, not copied;
 *       `someone`: the S4-01 Product Copy Gate row (`shared-world/copy.ts`);
 *       the proposal rows, `proposedBy` and the two membership-request rows: the S4-03 Product Copy Gate
 *       (`shared-world/lifecycle-copy.ts`), the exact words Manage World and the Shared root already show for the
 *       same fact;
 *   - PROPOSED — the S4-04 Product Copy Gate (ONE bounded gate; implementation record §11): `joined`, the one fact no
 *     approved surface states (a person joined the World the reader is in).
 */
export interface Bilingual { readonly ar: string; readonly en: string }

export const SHARED_ACTIVITY_COPY_GATE = {
  status: 'S4-04 PRODUCT COPY GATE — OPEN — 1 row PROPOSED',
  reused: ['ambient', 'someone', 'proposalSettings', 'proposalRemoval', 'proposalEnd', 'proposalAdd', 'proposalRejoin', 'proposedBy',
    'memberRequestAdd', 'memberRequestRejoin'],
  proposed: ['joined'],
} as const;

export const SHARED_ACTIVITY_COPY = Object.freeze({
  /** REUSED — p3.generic.shared (A3-02 Lock Screen L1 Shared line). */
  ambient: LOCK_SCREEN_COPY.generic.SHARED as Bilingual,
  /** REUSED — S4-01 Product Copy Gate. */
  someone: { ar: 'شخص ما', en: 'Someone' },
  /** REUSED — S4-03 Product Copy Gate. */
  proposalSettings: { ar: 'تغيير إعدادات العالم', en: 'Change the World Settings' },
  /** REUSED — S4-03 Product Copy Gate. {0}: the member's own Name. */
  proposalRemoval: { ar: 'إزالة {0} من هذا العالم', en: 'Remove {0} from this world' },
  /** REUSED — S4-03 Product Copy Gate. */
  proposalEnd: { ar: 'إنهاء هذا العالم', en: 'End this world' },
  /** REUSED — S4-03 Product Copy Gate. The target is never named before acceptance. */
  proposalAdd: { ar: 'انضمام شخص جديد إلى هذا العالم', en: 'A new person joining this world' },
  /** REUSED — S4-03 Product Copy Gate. The target is never named before acceptance. */
  proposalRejoin: { ar: 'عودة عضو سابق إلى هذا العالم', en: 'A former member returning to this world' },
  /** REUSED — S4-03 Product Copy Gate. {0}: the proposer's own Name. */
  proposedBy: { ar: 'اقتراح من {0}', en: 'Proposed by {0}' },
  /** REUSED — S4-03 Product Copy Gate. {0}: the proposer's own Name; nothing of the World before acceptance. */
  memberRequestAdd: { ar: '{0} يقترح انضمامك إلى عالم مشترك، وقد وافق عليه كل أعضائه.', en: '{0} proposed that you join a Shared World, and all its members approved.' },
  /** REUSED — S4-03 Product Copy Gate. */
  memberRequestRejoin: { ar: '{0} يقترح عودتك إلى عالم مشترك كنت فيه، وقد وافق عليها كل أعضائه.', en: '{0} proposed that you return to a Shared World you were in, and all its members approved.' },
  /** PROPOSED — S4-04 Product Copy Gate. {0}: the person's own Name. */
  joined: { ar: 'انضم {0} إلى هذا العالم.', en: '{0} joined this world.' },
});

/** One Name into one `{0}` slot (every occurrence); an absent Name is the approved «شخص ما» / Someone. */
export function withName(sentence: Bilingual, name: string | null): Bilingual {
  const ar = name ?? SHARED_ACTIVITY_COPY.someone.ar;
  const en = name ?? SHARED_ACTIVITY_COPY.someone.en;
  return { ar: sentence.ar.split('{0}').join(ar), en: sentence.en.split('{0}').join(en) };
}
