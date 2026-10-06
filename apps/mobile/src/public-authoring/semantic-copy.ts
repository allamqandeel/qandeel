/**
 * S5-03A — the semantic review copy: QANDEEL's proposed understanding of a READY_FOR_REVIEW Experience, and the
 * publisher's acceptance or correction of it, drawn inside the S5-02 authoring workspace.
 *
 * Every string carries its source, as the other surfaces' copy modules do:
 *
 *   - REUSED: words other surfaces already froze for the same fact, read from their own modules: «إلغاء» / Cancel
 *     (S4-01 Product Copy Gate, through the Shared copy module) and the neutral refusal «تعذّر ذلك الآن.» (S4-01, through
 *     the S5-02 copy module);
 *   - APPROVED — S5-03A PRODUCT COPY GATE, CLOSED: every genuinely new string below. No frozen record names QANDEEL's
 *     understanding of a Public Experience, its themes or the publisher's correction in Arabic, so none is invented as
 *     canon. They are drawn in the frozen register (I-08A4 §11: calm, plain, no exclamation, no persuasion) and were
 *     approved by the Product Owner exactly as written on 2026-10-06.
 *
 * No string says "published" as an achieved state, names a map position, a coordinate, a model, a lens, a vector or a
 * prompt, or suggests the publisher can move the Experience: a correction is about meaning only (CW2-04 §13 / D15).
 */
import type { ChromeLanguage } from '../orientation-chrome';
import { sharedCopy } from '../shared-world/copy';
import { publicAuthoringCopy } from './copy';

export const PUBLIC_SEMANTIC_COPY_GATE = {
  status: 'S5-03A PRODUCT COPY GATE — CLOSED — 21 rows APPROVED (Product Owner, 2026-10-06)',
  reused: ['actionUnavailable', 'cancel'],
  approved: [
    'heading', 'explain', 'ask', 'meaningHeading', 'primaryHeading', 'secondaryHeading', 'whyHeading', 'accept', 'correct',
    'correctionScope', 'meaningLabel', 'primaryLabel', 'secondaryLabel', 'submitCorrection', 'acceptedState',
    'correctedState', 'interpretationUnavailable', 'notSupported', 'unchanged', 'correctionInvalid', 'limited',
  ],
  proposed: [],
} as const;

export interface PublicSemanticCopy {
  /** The section heading: QANDEEL's understanding. */
  readonly heading: string;
  /** What this stage is, before anything is published. */
  readonly explain: string;
  /** Ask QANDEEL to propose its understanding. */
  readonly ask: string;
  readonly meaningHeading: string;
  /** The main meanings (primary themes). */
  readonly primaryHeading: string;
  /** Other meanings (secondary themes). */
  readonly secondaryHeading: string;
  /** Why QANDEEL understands it so (its explanation to the publisher). */
  readonly whyHeading: string;
  readonly accept: string;
  readonly correct: string;
  /** A correction is about meaning; it does not move the Experience. */
  readonly correctionScope: string;
  readonly meaningLabel: string;
  readonly primaryLabel: string;
  readonly secondaryLabel: string;
  readonly submitCorrection: string;
  readonly cancel: string;
  readonly acceptedState: string;
  readonly correctedState: string;
  readonly interpretationUnavailable: string;
  readonly notSupported: string;
  readonly unchanged: string;
  readonly correctionInvalid: string;
  readonly limited: string;
  readonly actionUnavailable: string;
}

const AR = {
  heading: 'كيف فهم قنديل هذه التجربة', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06) (not «فهم قنديل»: that is P1's Personal surface name)
  explain: 'قبل أي نشر، يقترح قنديل المعنى الذي يفهمه من هذه التجربة. يمكنك قبوله أو تصحيحه.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  ask: 'اطلب فهم قنديل لهذه التجربة', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  meaningHeading: 'المعنى', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  primaryHeading: 'المعاني الأساسية', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  secondaryHeading: 'معانٍ أخرى', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  whyHeading: 'لماذا فهمها قنديل هكذا', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  accept: 'أوافق على هذا الفهم', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  correct: 'تصحيح الفهم', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  correctionScope: 'التصحيح يخص المعنى فقط، ولا ينقل التجربة إلى مكان تختاره.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  meaningLabel: 'المعنى بكلماتك', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  primaryLabel: 'المعاني الأساسية، مفصولة بفاصلة', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  secondaryLabel: 'معانٍ أخرى، اختياري', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  submitCorrection: 'إرسال التصحيح', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  acceptedState: 'وافقت على فهم قنديل.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  correctedState: 'هذا هو الفهم بعد تصحيحك.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  interpretationUnavailable: 'تعذّر على قنديل اقتراح فهم الآن.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  notSupported: 'محتوى التجربة لا يدعم هذا التصحيح. يمكنك صياغته بشكل آخر.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  unchanged: 'هذا التصحيح مطابق للفهم الحالي.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  correctionInvalid: 'المعنى سطر واحد حتى 120 حرفًا، ومن معنى أساسي إلى ثلاثة، كلٌّ منها حتى 40 حرفًا.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  limited: 'وصلت هذه التجربة إلى الحد المسموح اليوم. حاول لاحقًا.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
} as const;

const EN = {
  heading: 'How QANDEEL understood this experience', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06) (not "QANDEEL Understanding": P1's Personal surface)
  explain: 'Before anything is published, QANDEEL proposes the meaning it understands in this experience. You can accept it or correct it.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  ask: "Ask for QANDEEL's understanding of this experience", // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  meaningHeading: 'Meaning', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  primaryHeading: 'Main meanings', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  secondaryHeading: 'Other meanings', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  whyHeading: 'Why QANDEEL understands it this way', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  accept: 'I accept this understanding', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  correct: 'Correct the understanding', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  correctionScope: "A correction is about the meaning only; it doesn't move the experience to a place you choose.", // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  meaningLabel: 'The meaning, in your words', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  primaryLabel: 'Main meanings, separated by commas', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  secondaryLabel: 'Other meanings, optional', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  submitCorrection: 'Send correction', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  acceptedState: "You accepted QANDEEL's understanding.", // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  correctedState: 'This is the understanding after your correction.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  interpretationUnavailable: "QANDEEL couldn't propose an understanding right now.", // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  notSupported: "The experience's content doesn't support this correction. You can phrase it differently.", // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  unchanged: 'This correction matches the current understanding.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  correctionInvalid: 'The meaning is one line of up to 120 characters, with one to three main meanings of up to 40 characters each.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
  limited: 'This experience has reached today\'s limit. Try again later.', // APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06)
} as const;

/** How a list of meanings is joined for reading: the Arabic or Latin comma (typography, not a copy row). */
export const semanticListSeparator = (language: ChromeLanguage): string => (language === 'ar' ? '، ' : ', ');

export function publicSemanticCopy(language: ChromeLanguage): PublicSemanticCopy {
  const own = language === 'ar' ? AR : EN;
  return Object.freeze({
    ...own,
    actionUnavailable: publicAuthoringCopy(language).actionUnavailable, // REUSED — S4-01 Product Copy Gate, through S5-02
    cancel: sharedCopy(language).cancel, // REUSED — S4-01 Product Copy Gate
  });
}
