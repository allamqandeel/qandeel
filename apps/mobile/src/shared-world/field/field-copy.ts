/**
 * SHARED-VIS-01 — the words of the Shared World's Living Analysis field.
 *
 * Every row that already exists is REUSED from its approved owner, exactly. The genuinely new rows are PROPOSED and wait
 * on the SHARED-VIS-01 Product Copy Gate: they are not final user-facing copy until the Product Owner approves them.
 */
import { analysisCopy } from '../../analysis-language';
import type { ChromeLanguage } from '../../orientation-chrome';
import { publicSemanticCopy } from '../../public-authoring/semantic-copy';
import { sharedCopy } from '../copy';
import { sharedLifecycleCopy } from '../lifecycle-copy';

export const SHARED_FIELD_COPY_GATE = {
  status: 'SHARED-VIS-01 PRODUCT COPY GATE — OPEN — 6 rows PROPOSED, awaiting the Product Owner',
  canon: ['manageWorld', 'qandeel'],
  reused: ['back', 'retry', 'you', 'someone', 'primaryHeading', 'secondaryHeading', 'moreDetail', 'lessDetail'],
  approved: [],
  proposed: ['fieldLabel', 'empty', 'fieldUnavailable', 'conversation', 'placeUnavailable', 'sourcesHeading'],
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
  fieldLabel: 'خريطة المعاني في هذا العالم المشترك', // PROPOSED — SHARED-VIS-01 Product Copy Gate (mirrors the approved S5-03B Public row)
  empty: 'لم يتكوّن شيء في خريطة هذا العالم بعد.', // PROPOSED — SHARED-VIS-01 Product Copy Gate
  fieldUnavailable: 'تعذّر عرض هذا العالم المشترك الآن.', // PROPOSED — SHARED-VIS-01 Product Copy Gate
  conversation: 'المحادثة', // PROPOSED — SHARED-VIS-01 Product Copy Gate — the entry into the World's conversation
  placeUnavailable: 'لم يعد هذا المكان في هذا العالم المشترك.', // PROPOSED — SHARED-VIS-01 Product Copy Gate
  sourcesHeading: 'قرأه قنديل من', // PROPOSED — SHARED-VIS-01 Product Copy Gate — the place's exact sources
} as const;

const EN = {
  fieldLabel: "This Shared World's field of meaning", // PROPOSED — SHARED-VIS-01 Product Copy Gate (mirrors the approved S5-03B Public row)
  empty: "Nothing has formed on this World's map yet.", // PROPOSED — SHARED-VIS-01 Product Copy Gate
  fieldUnavailable: "This Shared World can't be shown right now.", // PROPOSED — SHARED-VIS-01 Product Copy Gate
  conversation: 'Conversation', // PROPOSED — SHARED-VIS-01 Product Copy Gate — the entry into the World's conversation
  placeUnavailable: 'This place is no longer in this Shared World.', // PROPOSED — SHARED-VIS-01 Product Copy Gate
  sourcesHeading: 'QANDEEL read it from', // PROPOSED — SHARED-VIS-01 Product Copy Gate — the place's exact sources
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
