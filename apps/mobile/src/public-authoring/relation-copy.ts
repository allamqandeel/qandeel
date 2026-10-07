/**
 * S5-03C — the explicit Public relation copy: managing relations inside the Public authoring workspace, and the accessible
 * name of a relation line in the Public field.
 *
 * Every string carries its source, as the other surfaces' copy modules do:
 *
 *   - REUSED: words other surfaces already froze for the same fact, read from their own modules: «رجوع» / Back,
 *     «إعادة المحاولة» / Try again, «تعذّر ذلك الآن.» / the neutral action refusal and «إلغاء» / Cancel (S4-01 Product Copy
 *     Gate); the search field's label and its no-match line (S5-03B Product Copy Gate) — a relation is asked for an
 *     Experience found by the SAME Public search;
 *   - APPROVED — S5-03C PRODUCT COPY GATE, CLOSED — 13 rows APPROVED (Product Owner, 2026-10-07): every genuinely new
 *     string below, approved exactly as proposed. No frozen record named an explicit Public relation, its request or its
 *     acts in either language, so none was invented as canon. They are drawn in the frozen register (I-08A4 §11: calm,
 *     plain, no exclamation, no persuasion).
 *
 * No string says that QANDEEL found, suggested or measured a relation, names a strength, a type, a count or a score, or
 * calls nearness a relation: a relation is an explicit act of two humans (S5-03C, the Product Owner's R+ decision). The
 * accessible name of a line names the OTHER Experience, which the field only ever draws when it is served to this reader.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import { publicFieldCopy } from '../public-world/field/field-copy';
import { fill, sharedCopy } from '../shared-world/copy';

export const PUBLIC_RELATION_COPY_GATE = {
  status: 'S5-03C PRODUCT COPY GATE — CLOSED — 13 rows APPROVED (Product Owner, 2026-10-07)',
  reused: ['back', 'retry', 'actionUnavailable', 'cancel', 'searchLabel', 'noResults'],
  approved: [
    'relationsHeading', 'relationsTitle', 'receivedHeading', 'withYours', 'activeHeading', 'sentHeading', 'requestHeading',
    'requestHint', 'requestAction', 'accept', 'decline', 'remove', 'relationWith',
  ],
  proposed: [],
} as const;

export interface PublicRelationCopy {
  /** The workspace section listing the reader's own Experiences that are in Public World now (each opens its relations). */
  readonly relationsHeading: string;
  /** The title of one Experience's relations. */
  readonly relationsTitle: string;
  /** Requests from others that wait on the reader's acceptance. */
  readonly receivedHeading: string;
  /** "With your experience: {0}" — which of the reader's own Experiences a received request names. */
  readonly withYours: string;
  /** Accepted relations. */
  readonly activeHeading: string;
  /** The reader's own requests that wait on the other side. */
  readonly sentHeading: string;
  readonly requestHeading: string;
  /** A relation exists only once the other side accepts it, and either side can remove it. */
  readonly requestHint: string;
  readonly requestAction: string;
  readonly accept: string;
  readonly decline: string;
  readonly remove: string;
  /** "Relation with {0}" — the accessible name of one relation line; {0} is the OTHER Experience, served to this reader. */
  readonly relationWith: string;
  readonly back: string;
  readonly retry: string;
  readonly actionUnavailable: string;
  /** Cancels the reader's own waiting request. */
  readonly cancel: string;
  readonly searchLabel: string;
  readonly noResults: string;
}

const AR = {
  relationsHeading: 'تجاربك في العالم العام', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  relationsTitle: 'العلاقات', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  receivedHeading: 'طلبات علاقة', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  withYours: 'مع تجربتك: {0}', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  activeHeading: 'علاقات قائمة', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  sentHeading: 'بانتظار القبول', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  requestHeading: 'ربطها بتجربة أخرى', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  requestHint: 'لا تظهر العلاقة إلا بعد أن يقبلها صاحب التجربة الأخرى، ويمكن لأي منكما إزالتها.', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  requestAction: 'طلب علاقة', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  accept: 'قبول', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  decline: 'رفض', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  remove: 'إزالة العلاقة', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  relationWith: 'علاقة مع {0}', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
} as const;

const EN = {
  relationsHeading: 'Your experiences in Public World', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  relationsTitle: 'Relations', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  receivedHeading: 'Relation requests', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  withYours: 'With your experience: {0}', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  activeHeading: 'Current relations', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  sentHeading: 'Waiting for acceptance', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  requestHeading: 'Relate it to another experience', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  requestHint: "A relation appears only once the other experience's owner accepts it, and either of you can remove it.", // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  requestAction: 'Request a relation', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  accept: 'Accept', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  decline: 'Decline', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  remove: 'Remove relation', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
  relationWith: 'Relation with {0}', // APPROVED — S5-03C Product Copy Gate (Product Owner, 2026-10-07)
} as const;

export function publicRelationCopy(language: ChromeLanguage): PublicRelationCopy {
  const shared = sharedCopy(language);
  const field = publicFieldCopy(language);
  const own = language === 'ar' ? AR : EN;
  return Object.freeze({
    ...own,
    back: shared.back, // REUSED — S4-01 Product Copy Gate
    retry: shared.retry, // REUSED — S4-01 Product Copy Gate
    actionUnavailable: shared.actionUnavailable, // REUSED — S4-01 Product Copy Gate
    cancel: shared.cancel, // REUSED — S4-01 Product Copy Gate
    searchLabel: field.searchLabel, // REUSED — S5-03B Product Copy Gate
    noResults: field.noResults, // REUSED — S5-03B Product Copy Gate
  });
}

export { fill };
