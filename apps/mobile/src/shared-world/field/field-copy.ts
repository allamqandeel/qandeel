/**
 * SHARED-VIS-01 — the words of the Shared World's Living Analysis field.
 *
 * Every row that already exists is REUSED from its approved owner, exactly. The six genuinely new rows were approved by the
 * Product Owner at the SHARED-VIS-01 Product Copy Gate (CLOSED — 6 / 6 APPROVED, 2026-10-08), four of them as revised.
 */
import { analysisCopy } from '../../analysis-language';
import type { ChromeLanguage } from '../../orientation-chrome';
import { publicSemanticCopy } from '../../public-authoring/semantic-copy';
import { sharedCopy } from '../copy';
import { sharedLifecycleCopy } from '../lifecycle-copy';

export const SHARED_FIELD_COPY_GATE = {
  status: 'SHARED-VIS-01 PRODUCT COPY GATE — CLOSED — 6 / 6 APPROVED (Product Owner, 2026-10-08; wording as revised by the Owner)',
  canon: ['manageWorld', 'qandeel'],
  reused: ['back', 'retry', 'you', 'someone', 'primaryHeading', 'secondaryHeading', 'moreDetail', 'lessDetail'],
  approved: ['fieldLabel', 'empty', 'fieldUnavailable', 'conversation', 'placeUnavailable', 'sourcesHeading'],
  proposed: [],
  /** Rows whose TEXT the Product Owner revised at the gate's closure (2026-10-08). */
  revisedByProductOwner: ['fieldLabel', 'empty', 'placeUnavailable', 'sourcesHeading'],
} as const;

export interface SharedFieldCopy {
  /** The accessible name of the World's field itself. */
  readonly fieldLabel: string;
  /** No place has formed yet: the field is empty by truth, and nothing stands in for it. */
  readonly empty: string;
  readonly fieldUnavailable: string;
  /** The one clear entry, in the World's chrome, into the World's existing conversation (D7). */
  readonly conversation: string;
  /** The place the panel was opened for is no longer served. */
  readonly placeUnavailable: string;
  /** The heading of the place's exact sources (its provenance). */
  readonly sourcesHeading: string;
  readonly manageWorld: string;
  readonly qandeel: string;
  readonly you: string;
  readonly someone: string;
  readonly back: string;
  readonly retry: string;
  readonly primaryHeading: string;
  readonly secondaryHeading: string;
  readonly moreDetail: string;
  readonly lessDetail: string;
}

const AR = {
  fieldLabel: 'خريطة المعاني في العالم المشترك', // APPROVED — SHARED-VIS-01 Product Copy Gate (Product Owner, 2026-10-08)
  empty: 'لم تتشكل معالم هذا العالم بعد.', // APPROVED — SHARED-VIS-01 Product Copy Gate (Product Owner, 2026-10-08)
  fieldUnavailable: 'تعذّر عرض هذا العالم المشترك الآن.', // APPROVED — SHARED-VIS-01 Product Copy Gate (Product Owner, 2026-10-08)
  conversation: 'المحادثة', // APPROVED — SHARED-VIS-01 Product Copy Gate (Product Owner, 2026-10-08) — the entry into the World's conversation
  placeUnavailable: 'لم يعد هذا المكان متاحًا في العالم المشترك.', // APPROVED — SHARED-VIS-01 Product Copy Gate (Product Owner, 2026-10-08)
  sourcesHeading: 'مصادر هذا المعنى', // APPROVED — SHARED-VIS-01 Product Copy Gate (Product Owner, 2026-10-08) — the place's exact sources
} as const;

const EN = {
  fieldLabel: 'Shared World meaning map', // APPROVED — SHARED-VIS-01 Product Copy Gate (Product Owner, 2026-10-08)
  empty: "This world's map is still taking shape.", // APPROVED — SHARED-VIS-01 Product Copy Gate (Product Owner, 2026-10-08)
  fieldUnavailable: "This Shared World can't be shown right now.", // APPROVED — SHARED-VIS-01 Product Copy Gate (Product Owner, 2026-10-08)
  conversation: 'Conversation', // APPROVED — SHARED-VIS-01 Product Copy Gate (Product Owner, 2026-10-08) — the entry into the World's conversation
  placeUnavailable: 'This place is no longer available in this Shared World.', // APPROVED — SHARED-VIS-01 Product Copy Gate (Product Owner, 2026-10-08)
  sourcesHeading: 'Sources of this meaning', // APPROVED — SHARED-VIS-01 Product Copy Gate (Product Owner, 2026-10-08) — the place's exact sources
} as const;

export function sharedFieldCopy(language: ChromeLanguage): SharedFieldCopy {
  const shared = sharedCopy(language);
  const lifecycle = sharedLifecycleCopy(language);
  const semantic = publicSemanticCopy(language);
  const analysis = analysisCopy(language);
  return Object.freeze({
    ...(language === 'ar' ? AR : EN),
    manageWorld: lifecycle.manageWorld, // CANON — I-08A4 §8
    qandeel: shared.personalWorld, // CANON — I-08A4 §8 / §9 (QANDEEL's name)
    you: shared.you, // REUSED — S4-01 Product Copy Gate
    someone: shared.someone, // REUSED — S4-01 Product Copy Gate
    back: shared.back, // REUSED — S4-01 Product Copy Gate
    retry: shared.retry, // REUSED — S4-01 Product Copy Gate
    primaryHeading: semantic.primaryHeading, // REUSED — S5-03A Product Copy Gate
    secondaryHeading: semantic.secondaryHeading, // REUSED — S5-03A Product Copy Gate
    moreDetail: analysis.moreDetail, // REUSED — the Living Analysis accessible step (W1A-01)
    lessDetail: analysis.lessDetail, // REUSED — the Living Analysis accessible step (W1A-01)
  });
}
