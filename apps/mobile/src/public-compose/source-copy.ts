/**
 * S8A-05 CP2 — the ONE place the words of «انشر من قنديل» / Publish from QANDEEL are written: the entry from the
 * conversation and from a «فهم قنديل» card, choosing the messages, the topic's material in the draft, the paged preview
 * with its speakers, emphasis and gaps, the one acknowledgement, a source's own refusals, and a reader's view of a topic
 * made from a conversation.
 *
 * Fixed Arabic is simplified Modern Standard Arabic and gender-considerate (LANG-01): where a second-person verb would
 * mark gender, the row uses a noun or a passive form instead. Two rows are the Product Owner's own words from the CP2
 * order, verbatim: `understandingLabel` and `acknowledgement`.
 *
 * Each row carries two statuses, and nothing here is promoted by being shipped. `status` is the Arabic row's; `enStatus`
 * is the English row's:
 *
 *   APPROVED  — every row new in CP2, in both languages, approved verbatim by the Product Owner at the S8A-05 CP2
 *               Product Copy Gate on 2026-10-27 (`docs/e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md`
 *               §11.9), and the two earlier approvals reused verbatim, each source named on its row;
 *   PROPOSED  — not approved (no row is, since the gate closed).
 *
 * Deliberately absent: any word saying the topic IS published (production publishing stays closed), any QANDEEL-written
 * summary of the conversation, any score, evidence, assumption or memory word, a count of readers, and any engineering
 * term.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import type { PublicTopicReadiness, PublicTopicSourceRefusal } from '../runtime-entry';

export type PublicSourceCopyStatus = 'APPROVED' | 'PROPOSED';

interface Row {
  readonly ar: string;
  readonly en: string;
  readonly status: PublicSourceCopyStatus;
  readonly enStatus: PublicSourceCopyStatus;
  readonly source: string;
}

const CP2 = 'S8A-05 CP2 Product Copy Gate — APPROVED verbatim, Arabic and English (Product Owner, 2026-10-27)';
const OWNER = 'S8A-05 CP2 order — the Product Owner\'s own Arabic, verbatim; S8A-05 CP2 Product Copy Gate — APPROVED verbatim, Arabic and English (Product Owner, 2026-10-27)';
const approved = (ar: string, en: string, source = CP2): Row => ({ ar, en, status: 'APPROVED', enStatus: 'APPROVED', source });
const reused = (ar: string, en: string, source: string): Row => ({ ar, en, status: 'APPROVED', enStatus: 'APPROVED', source });

export const PUBLIC_SOURCE_COPY_ROWS = Object.freeze({
  // The entry, from the conversation and from a «فهم قنديل» card.
  shareEntry: approved('شارك في العالم العام', 'Share in Public World', OWNER),
  shareTitle: approved('اختيار الرسائل التي يصير منها الموضوع', 'Choose the messages the topic is made from'),
  shareHint: approved('يُختار ما يُنشر رسالةً رسالة، كلامك وردود قنديل.', 'Choose what is shared message by message: your words and QANDEEL\'s replies.'),
  shareWhole: reused('المحادثة كاملة', 'The whole conversation', 'G1.1 closure; G1.2 §L (Arabic). English APPROVED by the Product Owner, 2026-10-20 (S7-05 D2)'),
  shareContinue: approved('متابعة', 'Continue'),
  shareCancel: reused('إلغاء', 'Cancel', 'S4-01 Product Copy Gate'),
  shareNothing: approved('لم تُختر أي رسالة بعد.', 'No message is chosen yet.'),
  shareUnprovable: approved('تعذّر التأكد من رسائل هذه المحادثة الآن.', 'The messages of this conversation couldn\'t be confirmed right now.'),
  understandingChanged: approved('تغيّر هذا الفهم منذ عرضه. يُرجى فتحه من جديد.', 'This understanding changed since it was shown. Please open it again.'),
  // The topic's material inside the draft.
  sourceHeading: approved('مادة الموضوع', 'The topic\'s material'),
  sourceConversation: approved('من المحادثة مع قنديل', 'From the conversation with QANDEEL'),
  sourceUnderstanding: approved('من «فهم قنديل»', 'From «QANDEEL Understanding»'),
  textOptional: approved('النص اختياري حين تكون للموضوع مادة.', 'The text is optional when the topic has material.'),
  clearSource: approved('إزالة المادة', 'Remove the material'),
  clearSourceNote: approved('تبقى المسودة وما كُتب فيها.', 'The draft and what was written in it stay.'),
  // The paged preview.
  understandingLabel: approved('فهم قنديل — استنتاج غير مؤكد، ليس حقيقة', 'QANDEEL Understanding — an unconfirmed inference, not a fact', OWNER),
  speakerQandeel: approved('قنديل', 'QANDEEL'),
  // The author is named by their public name; this row stands in only when the topic shows none.
  speakerAuthor: approved('صاحب الموضوع', 'The topic\'s author'),
  writtenLabel: approved('النص المكتوب', 'Written text'),
  gap: approved('رسائل غير مضمّنة', 'Messages not included'),
  emphasized: approved('مُبرَز', 'Emphasized'),
  emphasize: approved('إبراز', 'Emphasize'),
  unemphasize: approved('إلغاء الإبراز', 'Remove emphasis'),
  page: approved('صفحة {0} من {1}', 'Page {0} of {1}'),
  next: approved('التالي', 'Next'),
  previous: approved('السابق', 'Previous'),
  // The one acknowledgement QANDEEL material needs (CA-S8A05-A3 6).
  mentionWarning: approved('قد يذكر هذا الكلام أشخاصًا آخرين أو يصفهم.', 'These words may mention or describe other people.'),
  acknowledgement: approved('كلام قنديل قد يصف أشخاصًا آخرين؛ نشره قرارك', 'QANDEEL\'s words may describe other people; publishing them is your decision', OWNER),
  acknowledge: approved('أُقرّ بذلك', 'I acknowledge this'),
  acknowledged: approved('تمّ الإقرار.', 'Acknowledged.'),
  // A source's own refusals and the acknowledgement it needs (CA-S8A05-A3 9).
  sourceUnavailable: approved('لم تعد مادة الموضوع متاحة.', 'The topic\'s material is no longer available.'),
  notWholeMessages: approved('يجب أن يبدأ الاختيار وينتهي برسالة كاملة.', 'The selection must start and end with a whole message.'),
  selectionInvalid: approved('تغيّر شيء في الاختيار؛ يُرجى الاختيار من جديد.', 'Something in the selection changed; please choose again.'),
  nothingSelected: approved('لم تُختر أي رسالة.', 'No message is chosen.'),
  tooLarge: approved('الاختيار أكبر من المسموح (10,000 جزء أو 8 ميغابايت). يُرجى اختيار جزء أصغر من المحادثة.',
    'The selection is larger than allowed (10,000 parts or 8 MB). Please choose a smaller part of the conversation.'),
  understandingChangedReady: approved('تغيّر هذا الفهم منذ اختياره.', 'This understanding changed since it was chosen.'),
  understandingUnderReview: approved('هذا الفهم قيد المراجعة الآن.', 'This understanding is under review now.'),
  understandingWithheld: approved('هذا الفهم غير معروض الآن.', 'This understanding isn\'t shown now.'),
  acknowledgementRequired: approved('يلزم الإقرار قبل التجهيز للنشر.', 'The acknowledgement is needed before preparing.'),
} satisfies Record<string, Row>);

const keysWhere = (test: (row: Row) => boolean) => Object.entries(PUBLIC_SOURCE_COPY_ROWS).filter(([, row]) => test(row)).map(([key]) => key);
export const PUBLIC_SOURCE_COPY_GATE = Object.freeze({
  status: 'S8A-05 CP2 PRODUCT COPY GATE — CLOSED / APPROVED by the Product Owner on 2026-10-27: the 37 new rows verbatim in Arabic and English, the two reused rows as approved before; nothing approved by being shipped',
  approved: keysWhere((row) => row.source.startsWith('S8A-05 CP2')),
  proposed: keysWhere((row) => row.status === 'PROPOSED'),
  englishProposed: keysWhere((row) => row.enStatus === 'PROPOSED'),
  reused: keysWhere((row) => !row.source.startsWith('S8A-05 CP2')),
  ownerArabic: ['shareEntry', 'understandingLabel', 'acknowledgement'],
});

export type PublicSourceReadiness = Exclude<PublicTopicReadiness, 'READY' | 'TITLE_TOO_SHORT' | 'TEXT_REQUIRED' | 'SECTION_REQUIRED'>;
const READINESS_ROWS: Readonly<Record<PublicSourceReadiness, keyof typeof PUBLIC_SOURCE_COPY_ROWS>> = {
  SOURCE_UNAVAILABLE: 'sourceUnavailable', NOT_WHOLE_MESSAGES: 'notWholeMessages', SELECTION_INVALID: 'selectionInvalid',
  NOTHING_SELECTED: 'nothingSelected', TOO_LARGE: 'tooLarge', UNDERSTANDING_CHANGED: 'understandingChangedReady',
  UNDERSTANDING_UNDER_REVIEW: 'understandingUnderReview', UNDERSTANDING_WITHHELD: 'understandingWithheld',
  ACKNOWLEDGEMENT_REQUIRED: 'acknowledgementRequired',
};
export const isSourceReadiness = (value: PublicTopicReadiness | PublicTopicSourceRefusal): value is PublicSourceReadiness => value in READINESS_ROWS;

export type PublicSourceCopy = { readonly [K in keyof typeof PUBLIC_SOURCE_COPY_ROWS]: string } & {
  readonly readiness: (readiness: PublicSourceReadiness) => string;
  readonly pageOf: (page: number, pageCount: number) => string;
};

const build = (language: ChromeLanguage): PublicSourceCopy => {
  const rows = Object.fromEntries(Object.entries(PUBLIC_SOURCE_COPY_ROWS).map(([key, row]) => [key, language === 'ar' ? row.ar : row.en])) as {
    [K in keyof typeof PUBLIC_SOURCE_COPY_ROWS]: string };
  return Object.freeze({
    ...rows,
    readiness: (readiness: PublicSourceReadiness) => rows[READINESS_ROWS[readiness]],
    pageOf: (page: number, pageCount: number) => rows.page.replace('{0}', String(page)).replace('{1}', String(pageCount)),
  });
};
const AR = build('ar');
const EN = build('en');
export const publicSourceCopy = (language: ChromeLanguage): PublicSourceCopy => (language === 'ar' ? AR : EN);
