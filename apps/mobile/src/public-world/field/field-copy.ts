/**
 * S5-03B — the copy of the «العالم العام» / Public World semantic field (the field, its search and its contextual panel)
 * and of preparing an Experience's stable place in it, drawn inside the S5-02 / S5-03A authoring review.
 *
 * Every string carries its source, as the other surfaces' copy modules do:
 *
 *   - REUSED, read from their own modules: «رجوع» / Back, «إلغاء» / Cancel, «إعادة المحاولة» / Try again (S4-01 Product
 *     Copy Gate, through the Shared copy module); «تحليل قنديل» / QANDEEL analysis (S5-02); «المعاني الأساسية» / Main
 *     meanings and «معانٍ أخرى» / Other meanings (S5-03A); «إظهار تفاصيل أكثر» / Show more detail and «إظهار تفاصيل أقل» /
 *     Show less detail (the Living Analysis's own accessible semantic step, W1A-01) — S5-03B R2: the Public field is
 *     stepped through the same Living Analysis surface, so it says the step in the surface's words;
 *   - APPROVED — S5-03B PRODUCT COPY GATE, CLOSED: every genuinely new string below. No frozen record names the Public
 *     field's search, its empty state, its nearby context or the preparation of a place in Arabic, so none was invented
 *     as canon. They are drawn in the frozen register (I-08A4 §11: calm, plain, no exclamation, no persuasion) and were
 *     approved by the Product Owner on 2026-10-07: 13 / 13, eleven exactly as proposed and two (`fieldLabel`, `empty`)
 *     with the Owner's own Arabic wording; their English is unchanged.
 *
 *   - RETIRED — S5-03B R2 (Product Owner decision D3, 2026-10-07): `closer`, `farther`, `wholeWorld`. The visible
 *     + / − / ○ controls they named are removed; the semantic step is the shared surface's (pinch, or the accessible
 *     actions above). Retired rows are not approved, not proposed and not drawn: they leave the gate.
 *
 * No string names a coordinate, a model, a lens, a rank, a view count, popularity or a relation, says an Experience can
 * be moved by hand, or says the reader's own Experience is published.
 */
import type { ChromeLanguage } from '../../orientation-chrome';
import { publicAuthoringCopy } from '../../public-authoring/copy';
import { analysisCopy } from '../../analysis-language';
import { publicSemanticCopy } from '../../public-authoring/semantic-copy';
import { sharedCopy } from '../../shared-world/copy';

export const PUBLIC_FIELD_COPY_GATE = {
  status: 'S5-03B PRODUCT COPY GATE — CLOSED — 13 rows APPROVED (Product Owner, 2026-10-07; 3 rows RETIRED)',
  reused: ['back', 'cancel', 'retry', 'analysisItem', 'primaryHeading', 'secondaryHeading', 'moreDetail', 'lessDetail'],
  approved: [
    'fieldLabel', 'empty', 'fieldUnavailable', 'searchLabel', 'noResults', 'nearHeading',
    'sharedBy', 'placeHeading', 'placeExplain', 'placeAsk', 'placeReady', 'placeUnavailable', 'experienceUnavailable',
  ],
  proposed: [],
  /** R2 (Product Owner decision D3): rows whose controls were removed. Never drawn; not part of the decision any more. */
  retired: ['closer', 'farther', 'wholeWorld'],
  /** Rows whose TEXT the Product Owner revised: R1 in review, and the Arabic of two rows at the gate's closure (2026-10-07). */
  revisedByProductOwner: ['searchLabel', 'placeReady', 'fieldLabel', 'empty'],
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
  /** The accessible semantic step: disclose more of the same place. */
  readonly moreDetail: string;
  /** The accessible semantic step: disclose less of the same place. */
  readonly lessDetail: string;
}

const AR = {
  fieldLabel: 'خريطة المعاني في العالم العام', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07; Arabic as revised by the Owner)
  empty: 'لا يوجد شيء في العالم العام بعد.', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07; Arabic as revised by the Owner)
  fieldUnavailable: 'تعذّر عرض العالم العام الآن.', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  searchLabel: 'ابحث عن تجربة أو شعور أو معنى', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07; text as revised by the Owner, R1)
  noResults: 'لا شيء في العالم العام يطابق هذا البحث.', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  nearHeading: 'قريب في المعنى', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  sharedBy: 'شاركها {0}', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  experienceUnavailable: 'لم تعد هذه التجربة في العالم العام.', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  placeHeading: 'مكان التجربة في العالم العام', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  placeExplain: 'يحدد قنديل مكانها من معناها وحده، ولا يمكن اختيار المكان يدويًا.', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  placeAsk: 'اطلب من قنديل تحديد مكانها', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  placeReady: 'تم تحديد مكانها.', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07; text as revised by the Owner, R1)
  placeUnavailable: 'تعذّر على قنديل تحديد مكانها الآن.', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
} as const;

const EN = {
  fieldLabel: "Public World's field of meaning", // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  empty: 'Nothing is in Public World yet.', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  fieldUnavailable: "Public World can't be shown right now.", // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  searchLabel: 'Search for an experience, feeling, or meaning', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07; text as revised by the Owner, R1)
  noResults: 'Nothing in Public World matches this search.', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  nearHeading: 'Near in meaning', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  sharedBy: 'Shared by {0}', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  experienceUnavailable: 'This experience is no longer in Public World.', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  placeHeading: "The experience's place in Public World", // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  placeExplain: "QANDEEL places it by its meaning alone; the place can't be chosen by hand.", // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  placeAsk: 'Ask QANDEEL to find its place', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
  placeReady: 'Its place has been set.', // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07; text as revised by the Owner, R1)
  placeUnavailable: "QANDEEL couldn't find its place right now.", // APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07)
} as const;

export function publicFieldCopy(language: ChromeLanguage): PublicFieldCopy {
  const shared = sharedCopy(language);
  const authoring = publicAuthoringCopy(language);
  const semantic = publicSemanticCopy(language);
  const analysis = analysisCopy(language);
  const own = language === 'ar' ? AR : EN;
  return Object.freeze({
    ...own,
    back: shared.back, // REUSED — S4-01 Product Copy Gate
    cancel: shared.cancel, // REUSED — S4-01 Product Copy Gate
    retry: shared.retry, // REUSED — S4-01 Product Copy Gate
    analysisItem: authoring.analysisItem, // REUSED — S5-02 Product Copy Gate
    primaryHeading: semantic.primaryHeading, // REUSED — S5-03A Product Copy Gate
    secondaryHeading: semantic.secondaryHeading, // REUSED — S5-03A Product Copy Gate
    moreDetail: analysis.moreDetail, // REUSED — the Living Analysis accessible step (W1A-01)
    lessDetail: analysis.lessDetail, // REUSED — the Living Analysis accessible step (W1A-01)
  });
}

/** "{0}" substitution, the same convention the S5-02 copy uses. */
export const fillPublicFieldCopy = (template: string, value: string): string => template.replace('{0}', value);
