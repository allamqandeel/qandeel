/**
 * S5-03A — the semantic review copy: QANDEEL's proposed understanding of a READY_FOR_REVIEW Experience, and the
 * publisher's acceptance or correction of it, drawn inside the S5-02 authoring workspace.
 *
 * Every string carries its source, as the other surfaces' copy modules do:
 *
 *   - REUSED: words other surfaces already froze for the same fact, read from their own modules: «إلغاء» / Cancel
 *     (S4-01 Product Copy Gate, through the Shared copy module) and the neutral refusal «تعذّر ذلك الآن.» (S4-01, through
 *     the S5-02 copy module);
 *   - PROPOSED — S5-03A PRODUCT COPY GATE, OPEN: every genuinely new string below. No frozen record names QANDEEL's
 *     understanding of a Public Experience, its themes or the publisher's correction in Arabic, so none is invented as
 *     canon. They are drawn in the frozen register (I-08A4 §11: calm, plain, no exclamation, no persuasion) and wait for
 *     the Product Owner's decision. Nothing here is APPROVED by being written.
 *
 * No string says "published" as an achieved state, names a map position, a coordinate, a model, a lens, a vector or a
 * prompt, or suggests the publisher can move the Experience: a correction is about meaning only (CW2-04 §13 / D15).
 */
import type { ChromeLanguage } from '../orientation-chrome';
import { sharedCopy } from '../shared-world/copy';
import { publicAuthoringCopy } from './copy';

export const PUBLIC_SEMANTIC_COPY_GATE = {
  status: 'S5-03A PRODUCT COPY GATE — OPEN — 22 rows PROPOSED',
  reused: ['actionUnavailable', 'cancel'],
  approved: [],
  proposed: [
    'heading', 'explain', 'ask', 'meaningHeading', 'primaryHeading', 'secondaryHeading', 'whyHeading', 'accept', 'correct',
    'correctionScope', 'meaningLabel', 'primaryLabel', 'secondaryLabel', 'submitCorrection', 'acceptedState',
    'correctedState', 'interpretationUnavailable', 'notSupported', 'quotesContent', 'unchanged', 'correctionInvalid', 'limited',
  ],
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
  readonly quotesContent: string;
  readonly unchanged: string;
  readonly correctionInvalid: string;
  readonly limited: string;
  readonly actionUnavailable: string;
}

const AR = {
  heading: 'كيف فهم قنديل هذه التجربة', // PROPOSED — S5-03A Product Copy Gate (not «فهم قنديل»: that is P1's Personal surface name)
  explain: 'قبل أي نشر، يقترح قنديل المعنى الذي يفهمه من هذه التجربة. يمكنك قبوله أو تصحيحه.', // PROPOSED — S5-03A Product Copy Gate
  ask: 'اطلب فهم قنديل لهذه التجربة', // PROPOSED — S5-03A Product Copy Gate
  meaningHeading: 'المعنى', // PROPOSED — S5-03A Product Copy Gate
  primaryHeading: 'المعاني الأساسية', // PROPOSED — S5-03A Product Copy Gate
  secondaryHeading: 'معانٍ أخرى', // PROPOSED — S5-03A Product Copy Gate
  whyHeading: 'لماذا فهمها قنديل هكذا', // PROPOSED — S5-03A Product Copy Gate
  accept: 'أوافق على هذا الفهم', // PROPOSED — S5-03A Product Copy Gate
  correct: 'تصحيح الفهم', // PROPOSED — S5-03A Product Copy Gate
  correctionScope: 'التصحيح يخص المعنى فقط، ولا ينقل التجربة إلى مكان تختاره.', // PROPOSED — S5-03A Product Copy Gate
  meaningLabel: 'المعنى بكلماتك', // PROPOSED — S5-03A Product Copy Gate
  primaryLabel: 'المعاني الأساسية، مفصولة بفاصلة', // PROPOSED — S5-03A Product Copy Gate
  secondaryLabel: 'معانٍ أخرى، اختياري', // PROPOSED — S5-03A Product Copy Gate
  submitCorrection: 'إرسال التصحيح', // PROPOSED — S5-03A Product Copy Gate
  acceptedState: 'وافقت على فهم قنديل.', // PROPOSED — S5-03A Product Copy Gate
  correctedState: 'هذا هو الفهم بعد تصحيحك.', // PROPOSED — S5-03A Product Copy Gate
  interpretationUnavailable: 'تعذّر على قنديل اقتراح فهم الآن.', // PROPOSED — S5-03A Product Copy Gate
  notSupported: 'محتوى التجربة لا يدعم هذا التصحيح. يمكنك صياغته بشكل آخر.', // PROPOSED — S5-03A Product Copy Gate
  quotesContent: 'اكتب المعنى بكلماتك بدل نسخ النص.', // PROPOSED — S5-03A Product Copy Gate
  unchanged: 'هذا التصحيح مطابق للفهم الحالي.', // PROPOSED — S5-03A Product Copy Gate
  correctionInvalid: 'المعنى سطر واحد حتى 120 حرفًا، ومن معنى أساسي إلى ثلاثة، كلٌّ منها حتى 40 حرفًا.', // PROPOSED — S5-03A Product Copy Gate
  limited: 'وصلت هذه التجربة إلى الحد المسموح اليوم. حاول لاحقًا.', // PROPOSED — S5-03A Product Copy Gate
} as const;

const EN = {
  heading: 'How QANDEEL understood this experience', // PROPOSED — S5-03A Product Copy Gate (not "QANDEEL Understanding": P1's Personal surface)
  explain: 'Before anything is published, QANDEEL proposes the meaning it understands in this experience. You can accept it or correct it.', // PROPOSED — S5-03A Product Copy Gate
  ask: "Ask for QANDEEL's understanding of this experience", // PROPOSED — S5-03A Product Copy Gate
  meaningHeading: 'Meaning', // PROPOSED — S5-03A Product Copy Gate
  primaryHeading: 'Main meanings', // PROPOSED — S5-03A Product Copy Gate
  secondaryHeading: 'Other meanings', // PROPOSED — S5-03A Product Copy Gate
  whyHeading: 'Why QANDEEL understands it this way', // PROPOSED — S5-03A Product Copy Gate
  accept: 'I accept this understanding', // PROPOSED — S5-03A Product Copy Gate
  correct: 'Correct the understanding', // PROPOSED — S5-03A Product Copy Gate
  correctionScope: "A correction is about the meaning only; it doesn't move the experience to a place you choose.", // PROPOSED — S5-03A Product Copy Gate
  meaningLabel: 'The meaning, in your words', // PROPOSED — S5-03A Product Copy Gate
  primaryLabel: 'Main meanings, separated by commas', // PROPOSED — S5-03A Product Copy Gate
  secondaryLabel: 'Other meanings, optional', // PROPOSED — S5-03A Product Copy Gate
  submitCorrection: 'Send correction', // PROPOSED — S5-03A Product Copy Gate
  acceptedState: "You accepted QANDEEL's understanding.", // PROPOSED — S5-03A Product Copy Gate
  correctedState: 'This is the understanding after your correction.', // PROPOSED — S5-03A Product Copy Gate
  interpretationUnavailable: "QANDEEL couldn't propose an understanding right now.", // PROPOSED — S5-03A Product Copy Gate
  notSupported: "The experience's content doesn't support this correction. You can phrase it differently.", // PROPOSED — S5-03A Product Copy Gate
  quotesContent: 'Describe the meaning in your own words rather than copying the text.', // PROPOSED — S5-03A Product Copy Gate
  unchanged: 'This correction matches the current understanding.', // PROPOSED — S5-03A Product Copy Gate
  correctionInvalid: 'The meaning is one line of up to 120 characters, with one to three main meanings of up to 40 characters each.', // PROPOSED — S5-03A Product Copy Gate
  limited: 'This experience has reached today\'s limit. Try again later.', // PROPOSED — S5-03A Product Copy Gate
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
