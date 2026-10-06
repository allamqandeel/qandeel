/**
 * S5-03B — the copy of the «العالم العام» / Public World semantic field (the field, its search and its contextual panel)
 * and of preparing an Experience's stable place in it, drawn inside the S5-02 / S5-03A authoring review.
 *
 * Every string carries its source, as the other surfaces' copy modules do:
 *
 *   - REUSED, read from their own modules: «رجوع» / Back, «إلغاء» / Cancel, «إعادة المحاولة» / Try again (S4-01 Product
 *     Copy Gate, through the Shared copy module); «تحليل قنديل» / QANDEEL analysis (S5-02); «المعاني الأساسية» / Main
 *     meanings and «معانٍ أخرى» / Other meanings (S5-03A);
 *   - PROPOSED — S5-03B PRODUCT COPY GATE, OPEN: every genuinely new string below. No frozen record names the Public
 *     field's search, its empty state, its zoom controls, its nearby context or the preparation of a place in Arabic, so
 *     none is invented as canon. They are drawn in the frozen register (I-08A4 §11: calm, plain, no exclamation, no
 *     persuasion) and wait for the Product Owner's decision. Nothing here is self-approved.
 *
 * No string names a coordinate, a model, a lens, a rank, a view count, popularity or a relation, says an Experience can
 * be moved by hand, or says the reader's own Experience is published.
 */
import type { ChromeLanguage } from '../../orientation-chrome';
import { publicAuthoringCopy } from '../../public-authoring/copy';
import { publicSemanticCopy } from '../../public-authoring/semantic-copy';
import { sharedCopy } from '../../shared-world/copy';

export const PUBLIC_FIELD_COPY_GATE = {
  status: 'S5-03B PRODUCT COPY GATE — OPEN — 16 rows PROPOSED',
  reused: ['back', 'cancel', 'retry', 'analysisItem', 'primaryHeading', 'secondaryHeading'],
  approved: [],
  proposed: [
    'fieldLabel', 'empty', 'fieldUnavailable', 'searchLabel', 'noResults', 'closer', 'farther', 'wholeWorld', 'nearHeading',
    'sharedBy', 'placeHeading', 'placeExplain', 'placeAsk', 'placeReady', 'placeUnavailable', 'experienceUnavailable',
  ],
  /** R1: rows whose TEXT the Product Owner revised in review. Still PROPOSED: the gate closes only by the Owner's approval. */
  revisedByProductOwner: ['searchLabel', 'placeReady'],
} as const;

export interface PublicFieldCopy {
  /** The accessible name of the field itself. */
  readonly fieldLabel: string;
  /** Nothing is public yet: the field is empty by truth, and nothing stands in for it. */
  readonly empty: string;
  readonly fieldUnavailable: string;
  /** The search field's label and placeholder. */
  readonly searchLabel: string;
  readonly noResults: string;
  /** Semantic Zoom: disclose more of the same place. */
  readonly closer: string;
  /** Semantic Zoom: disclose less of the same place. */
  readonly farther: string;
  /** Back to the World as a whole. */
  readonly wholeWorld: string;
  /** The panel's very small nearby context: proximity in the field is similarity of meaning. */
  readonly nearHeading: string;
  /** "Shared by {0}" — the publisher's CURRENT public display only. */
  readonly sharedBy: string;
  /** The Experience the panel was opened for is no longer in the field. */
  readonly experienceUnavailable: string;
  readonly placeHeading: string;
  /** The place comes from meaning alone; it is never chosen by hand. */
  readonly placeExplain: string;
  readonly placeAsk: string;
  readonly placeReady: string;
  readonly placeUnavailable: string;
  readonly back: string;
  readonly cancel: string;
  readonly retry: string;
  readonly analysisItem: string;
  readonly primaryHeading: string;
  readonly secondaryHeading: string;
}

const AR = {
  fieldLabel: 'حقل المعاني في العالم العام', // PROPOSED — S5-03B Product Copy Gate
  empty: 'لا يوجد في العالم العام شيء بعد.', // PROPOSED — S5-03B Product Copy Gate
  fieldUnavailable: 'تعذّر عرض العالم العام الآن.', // PROPOSED — S5-03B Product Copy Gate
  searchLabel: 'ابحث عن تجربة أو شعور أو معنى', // PROPOSED — S5-03B Product Copy Gate (text as revised by the Product Owner, R1)
  noResults: 'لا شيء في العالم العام يطابق هذا البحث.', // PROPOSED — S5-03B Product Copy Gate
  closer: 'اقترب', // PROPOSED — S5-03B Product Copy Gate
  farther: 'ابتعد', // PROPOSED — S5-03B Product Copy Gate
  wholeWorld: 'العالم كله', // PROPOSED — S5-03B Product Copy Gate
  nearHeading: 'قريب في المعنى', // PROPOSED — S5-03B Product Copy Gate
  sharedBy: 'شاركها {0}', // PROPOSED — S5-03B Product Copy Gate
  experienceUnavailable: 'لم تعد هذه التجربة في العالم العام.', // PROPOSED — S5-03B Product Copy Gate
  placeHeading: 'مكان التجربة في العالم العام', // PROPOSED — S5-03B Product Copy Gate
  placeExplain: 'يحدد قنديل مكانها من معناها وحده، ولا يمكن اختيار المكان يدويًا.', // PROPOSED — S5-03B Product Copy Gate
  placeAsk: 'اطلب من قنديل تحديد مكانها', // PROPOSED — S5-03B Product Copy Gate
  placeReady: 'تم تحديد مكانها.', // PROPOSED — S5-03B Product Copy Gate (text as revised by the Product Owner, R1)
  placeUnavailable: 'تعذّر على قنديل تحديد مكانها الآن.', // PROPOSED — S5-03B Product Copy Gate
} as const;

const EN = {
  fieldLabel: "Public World's field of meaning", // PROPOSED — S5-03B Product Copy Gate
  empty: 'Nothing is in Public World yet.', // PROPOSED — S5-03B Product Copy Gate
  fieldUnavailable: "Public World can't be shown right now.", // PROPOSED — S5-03B Product Copy Gate
  searchLabel: 'Search for an experience, feeling, or meaning', // PROPOSED — S5-03B Product Copy Gate (text as revised by the Product Owner, R1)
  noResults: 'Nothing in Public World matches this search.', // PROPOSED — S5-03B Product Copy Gate
  closer: 'Closer', // PROPOSED — S5-03B Product Copy Gate
  farther: 'Farther', // PROPOSED — S5-03B Product Copy Gate
  wholeWorld: 'The whole World', // PROPOSED — S5-03B Product Copy Gate
  nearHeading: 'Near in meaning', // PROPOSED — S5-03B Product Copy Gate
  sharedBy: 'Shared by {0}', // PROPOSED — S5-03B Product Copy Gate
  experienceUnavailable: 'This experience is no longer in Public World.', // PROPOSED — S5-03B Product Copy Gate
  placeHeading: "The experience's place in Public World", // PROPOSED — S5-03B Product Copy Gate
  placeExplain: "QANDEEL places it by its meaning alone; the place can't be chosen by hand.", // PROPOSED — S5-03B Product Copy Gate
  placeAsk: 'Ask QANDEEL to find its place', // PROPOSED — S5-03B Product Copy Gate
  placeReady: 'Its place has been set.', // PROPOSED — S5-03B Product Copy Gate (text as revised by the Product Owner, R1)
  placeUnavailable: "QANDEEL couldn't find its place right now.", // PROPOSED — S5-03B Product Copy Gate
} as const;

export function publicFieldCopy(language: ChromeLanguage): PublicFieldCopy {
  const shared = sharedCopy(language);
  const authoring = publicAuthoringCopy(language);
  const semantic = publicSemanticCopy(language);
  const own = language === 'ar' ? AR : EN;
  return Object.freeze({
    ...own,
    back: shared.back, // REUSED — S4-01 Product Copy Gate
    cancel: shared.cancel, // REUSED — S4-01 Product Copy Gate
    retry: shared.retry, // REUSED — S4-01 Product Copy Gate
    analysisItem: authoring.analysisItem, // REUSED — S5-02 Product Copy Gate
    primaryHeading: semantic.primaryHeading, // REUSED — S5-03A Product Copy Gate
    secondaryHeading: semantic.secondaryHeading, // REUSED — S5-03A Product Copy Gate
  });
}

/** "{0}" substitution, the same convention the S5-02 copy uses. */
export const fillPublicFieldCopy = (template: string, value: string): string => template.replace('{0}', value);
