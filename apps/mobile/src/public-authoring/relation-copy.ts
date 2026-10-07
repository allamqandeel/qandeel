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
 *   - PROPOSED — S5-03C PRODUCT COPY GATE, OPEN: every genuinely new string below, awaiting the Product Owner. No frozen
 *     record names an explicit Public relation, its request or its acts in either language, so none was invented as canon.
 *     They are drawn in the frozen register (I-08A4 §11: calm, plain, no exclamation, no persuasion).
 *
 * No string says that QANDEEL found, suggested or measured a relation, names a strength, a type, a count or a score, or
 * calls nearness a relation: a relation is an explicit act of two humans (S5-03C, the Product Owner's R+ decision). The
 * accessible name of a line names the OTHER Experience, which the field only ever draws when it is served to this reader.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import { publicFieldCopy } from '../public-world/field/field-copy';
import { fill, sharedCopy } from '../shared-world/copy';

export const PUBLIC_RELATION_COPY_GATE = {
  status: 'S5-03C PRODUCT COPY GATE — OPEN — 13 rows PROPOSED (awaiting the Product Owner)',
  reused: ['back', 'retry', 'actionUnavailable', 'cancel', 'searchLabel', 'noResults'],
  approved: [],
  proposed: [
    'relationsHeading', 'relationsTitle', 'receivedHeading', 'withYours', 'activeHeading', 'sentHeading', 'requestHeading',
    'requestHint', 'requestAction', 'accept', 'decline', 'remove', 'relationWith',
  ],
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
  relationsHeading: 'تجاربك في العالم العام', // PROPOSED — S5-03C Product Copy Gate
  relationsTitle: 'العلاقات', // PROPOSED — S5-03C Product Copy Gate
  receivedHeading: 'طلبات علاقة', // PROPOSED — S5-03C Product Copy Gate
  withYours: 'مع تجربتك: {0}', // PROPOSED — S5-03C Product Copy Gate
  activeHeading: 'علاقات قائمة', // PROPOSED — S5-03C Product Copy Gate
  sentHeading: 'بانتظار القبول', // PROPOSED — S5-03C Product Copy Gate
  requestHeading: 'ربطها بتجربة أخرى', // PROPOSED — S5-03C Product Copy Gate
  requestHint: 'لا تظهر العلاقة إلا بعد أن يقبلها صاحب التجربة الأخرى، ويمكن لأي منكما إزالتها.', // PROPOSED — S5-03C Product Copy Gate
  requestAction: 'طلب علاقة', // PROPOSED — S5-03C Product Copy Gate
  accept: 'قبول', // PROPOSED — S5-03C Product Copy Gate
  decline: 'رفض', // PROPOSED — S5-03C Product Copy Gate
  remove: 'إزالة العلاقة', // PROPOSED — S5-03C Product Copy Gate
  relationWith: 'علاقة مع {0}', // PROPOSED — S5-03C Product Copy Gate
} as const;

const EN = {
  relationsHeading: 'Your experiences in Public World', // PROPOSED — S5-03C Product Copy Gate
  relationsTitle: 'Relations', // PROPOSED — S5-03C Product Copy Gate
  receivedHeading: 'Relation requests', // PROPOSED — S5-03C Product Copy Gate
  withYours: 'With your experience: {0}', // PROPOSED — S5-03C Product Copy Gate
  activeHeading: 'Current relations', // PROPOSED — S5-03C Product Copy Gate
  sentHeading: 'Waiting for acceptance', // PROPOSED — S5-03C Product Copy Gate
  requestHeading: 'Relate it to another experience', // PROPOSED — S5-03C Product Copy Gate
  requestHint: "A relation appears only once the other experience's owner accepts it, and either of you can remove it.", // PROPOSED — S5-03C Product Copy Gate
  requestAction: 'Request a relation', // PROPOSED — S5-03C Product Copy Gate
  accept: 'Accept', // PROPOSED — S5-03C Product Copy Gate
  decline: 'Decline', // PROPOSED — S5-03C Product Copy Gate
  remove: 'Remove relation', // PROPOSED — S5-03C Product Copy Gate
  relationWith: 'Relation with {0}', // PROPOSED — S5-03C Product Copy Gate
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
