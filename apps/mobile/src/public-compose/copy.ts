/**
 * S8A-05 CP1 — the ONE place the words of «اكتب موضوعك» / Write your topic are written: the private topic draft, its
 * editor, the preview with its privacy notes, preparing for publication, returning to the draft, and the names of the
 * twelve sections and «حكايات مفتوحة».
 *
 * Fixed Arabic is simplified Modern Standard Arabic and gender-considerate (LANG-01): where a second-person verb would
 * mark gender, the row uses a noun or a passive form instead.
 *
 * Each row carries two statuses, and nothing here is promoted by being shipped. `status` is the Arabic row's; `enStatus`
 * is the English row's:
 *
 *   APPROVED  — an existing Product Owner approval, reused verbatim (its source named on the row);
 *   PROPOSED  — not approved. Every row new in S8A-05 CP1 is PROPOSED until the S8A-05 CP1 Product Copy Gate decides it
 *               (`docs/e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md` §6, Copy Gate).
 *               The section names are the WP1 §2.2 proposal, which named them "final through the Copy Gate".
 *
 * Deliberately absent: any word saying the topic IS published (production publishing is closed until Stage 9 and the
 * honest line says so), any QANDEEL-suggested title or section, a count of readers, and any engineering term.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import type { PublicTopicPrivacyNote, PublicTopicReadiness, PublicTopicSection } from '../runtime-entry';

export type PublicComposeCopyStatus = 'APPROVED' | 'PROPOSED';

interface Row {
  readonly ar: string;
  readonly en: string;
  readonly status: PublicComposeCopyStatus;
  readonly enStatus: PublicComposeCopyStatus;
  readonly source: string;
}

const NEW = 'S8A-05 CP1 (new); PROPOSED — awaiting the S8A-05 CP1 Product Copy Gate';
const proposed = (ar: string, en: string, source = NEW): Row => ({ ar, en, status: 'PROPOSED', enStatus: 'PROPOSED', source });
const SECTION = 'S8A-05 WP1 §2.2 section name; PROPOSED — awaiting the S8A-05 CP1 Product Copy Gate';

export const PUBLIC_COMPOSE_COPY_ROWS = Object.freeze({
  entry: proposed('موضوع جديد', 'New topic'),
  draftsHeading: proposed('مسوداتي', 'My drafts'),
  noDrafts: proposed('لا توجد مسودات بعد.', 'No drafts yet.'),
  newDraft: proposed('كتابة موضوع جديد', 'Write a new topic'),
  untitled: proposed('بلا عنوان', 'Untitled'),
  privateNote: proposed('المسودة محفوظة في الحساب، ولا يراها غير صاحبها.', 'The draft is saved to the account, and only its author can see it.'),
  titleLabel: proposed('العنوان', 'Title'),
  titleHint: proposed('من 8 إلى 100 حرف', '8 to 100 characters'),
  textLabel: proposed('النص', 'Text'),
  textCount: proposed('{0} من 5000', '{0} of 5,000'),
  sectionLabel: proposed('القسم', 'Section'),
  save: { ar: 'حفظ', en: 'Save', status: 'APPROVED', enStatus: 'APPROVED', source: 'S7-02 Product Copy Gate (Arabic 2026-10-19; English 2026-10-20, S7-05 D2)' },
  saved: proposed('حُفظت المسودة.', 'The draft was saved.'),
  stale: proposed('تغيّرت هذه المسودة من مكان آخر، فأُعيد تحميلها.', 'This draft changed somewhere else, so it was reloaded.'),
  limitReached: proposed('بلغت المسودات الحد الأقصى (50).', 'The draft limit (50) has been reached.'),
  deletionPending: proposed('الحساب قيد الحذف.', 'The account is being deleted.'),
  invalid: proposed('تعذّر حفظ هذا النص كما هو.', "This text couldn't be saved as it is."),
  preview: proposed('معاينة', 'Preview'),
  previewHeading: proposed('هكذا سيظهر الموضوع في العالم العام', 'This is how the topic would appear in Public World'),
  publicWarning: proposed('كل ما في العنوان والنص سيصبح عامًا يقرؤه الناس.', 'Everything in the title and text would become public for people to read.'),
  privacyHeading: proposed('قبل النشر', 'Before publishing'),
  noteContactNumber: proposed('يبدو أن النص يحتوي على رقم هاتف.', 'The text seems to contain a phone number.'),
  noteEmailAddress: proposed('يبدو أن النص يحتوي على بريد إلكتروني.', 'The text seems to contain an email address.'),
  noteLink: proposed('النص يحتوي على رابط.', 'The text contains a link.'),
  noteOwnName: proposed('يبدو أن النص يحتوي على اسم صاحب الحساب.', "The text seems to contain the account holder's name."),
  noteRealName: proposed('سيظهر الموضوع بالاسم الحقيقي.', 'The topic would appear under the real name.'),
  titleTooShort: proposed('يحتاج العنوان إلى 8 أحرف على الأقل.', 'The title needs at least 8 characters.'),
  textRequired: proposed('نص الموضوع مطلوب.', 'The topic needs its text.'),
  sectionRequired: proposed('اختيار القسم مطلوب.', 'A section needs to be chosen.'),
  prepare: proposed('تجهيز للنشر', 'Prepare for publishing'),
  notOpen: proposed('النشر في العالم العام لم يُفتح بعد. المسودة محفوظة كما هي.', "Publishing in Public World isn't open yet. The draft is kept as it is."),
  preparedState: proposed('مُجهّز للنشر، ولم يُنشر بعد', 'Prepared for publishing, not published yet'),
  backToDraft: proposed('العودة إلى المسودة', 'Back to the draft'),
  backToDraftNote: proposed('تُمحى النسخة المجهّزة، وتبقى المسودة.', 'The prepared copy is erased; the draft stays.'),
  delete: proposed('حذف المسودة', 'Delete draft'),
  deleteConfirm: proposed('حذف نهائي', 'Delete permanently'),
  deleteNote: proposed('يُمحى العنوان والنص نهائيًا.', 'The title and text are erased permanently.'),
  deleted: proposed('حُذفت المسودة.', 'The draft was deleted.'),
  back: { ar: 'رجوع', en: 'Back', status: 'APPROVED', enStatus: 'APPROVED', source: 'S4-01 Product Copy Gate (reused by S5-02)' },
  retry: { ar: 'إعادة المحاولة', en: 'Try again', status: 'APPROVED', enStatus: 'APPROVED', source: 'S4-01 Product Copy Gate (reused by S5-02)' },
  actionUnavailable: { ar: 'تعذّر ذلك الآن.', en: "That didn't work right now.", status: 'APPROVED', enStatus: 'APPROVED', source: 'S4-01 Product Copy Gate' },
} satisfies Record<string, Row>);

/** The twelve sections and «حكايات مفتوحة», in the server's display order. */
export const PUBLIC_SECTION_COPY_ROWS = Object.freeze({
  love: proposed('الحب والارتباط', 'Love and relationships', SECTION),
  marriage: proposed('الزواج والطلاق', 'Marriage and divorce', SECTION),
  family: proposed('الأهل والعائلة', 'Parents and family', SECTION),
  parenting: proposed('الأبناء والتربية', 'Children and parenting', SECTION),
  people: proposed('الأصدقاء والناس', 'Friends and people', SECTION),
  work_money: proposed('العمل والمال', 'Work and money', SECTION),
  study_future: proposed('الدراسة والمستقبل', 'Study and the future', SECTION),
  inner_self: proposed('النفس والمشاعر', 'The self and feelings', SECTION),
  health_body: proposed('الصحة والجسد', 'Health and the body', SECTION),
  loss_crisis: proposed('الفقد والأزمات', 'Loss and crises', SECTION),
  faith_meaning: proposed('الإيمان والمعنى', 'Faith and meaning', SECTION),
  life_changes: proposed('الغربة والتحولات', 'Living abroad and big changes', SECTION),
  open: proposed('حكايات مفتوحة', 'Open stories', SECTION),
} satisfies Record<PublicTopicSection, Row>);

const ALL: Readonly<Record<string, Row>> = { ...PUBLIC_COMPOSE_COPY_ROWS, ...PUBLIC_SECTION_COPY_ROWS };
export const PUBLIC_COMPOSE_COPY_GATE = Object.freeze({
  status: 'S8A-05 CP1 PRODUCT COPY GATE — OPEN — every new Arabic and English row PROPOSED; nothing approved by being shipped',
  approved: Object.entries(ALL).filter(([, row]) => row.status === 'APPROVED').map(([key]) => key),
  proposed: Object.entries(ALL).filter(([, row]) => row.status === 'PROPOSED').map(([key]) => key),
  englishProposed: Object.entries(ALL).filter(([, row]) => row.enStatus === 'PROPOSED').map(([key]) => key),
});

export type PublicComposeCopy = { readonly [K in keyof typeof PUBLIC_COMPOSE_COPY_ROWS]: string } & {
  readonly section: (key: PublicTopicSection) => string;
  readonly note: (note: PublicTopicPrivacyNote) => string;
  readonly readiness: (readiness: Exclude<PublicTopicReadiness, 'READY'>) => string;
};

const NOTE_ROWS: Readonly<Record<PublicTopicPrivacyNote, keyof typeof PUBLIC_COMPOSE_COPY_ROWS>> = {
  CONTACT_NUMBER: 'noteContactNumber', EMAIL_ADDRESS: 'noteEmailAddress', LINK: 'noteLink', OWN_NAME: 'noteOwnName', SHOWN_UNDER_REAL_NAME: 'noteRealName',
};
const READINESS_ROWS: Readonly<Record<Exclude<PublicTopicReadiness, 'READY'>, keyof typeof PUBLIC_COMPOSE_COPY_ROWS>> = {
  TITLE_TOO_SHORT: 'titleTooShort', TEXT_REQUIRED: 'textRequired', SECTION_REQUIRED: 'sectionRequired',
};

const build = (language: ChromeLanguage): PublicComposeCopy => {
  const text = (row: Row) => (language === 'ar' ? row.ar : row.en);
  const rows = Object.fromEntries(Object.entries(PUBLIC_COMPOSE_COPY_ROWS).map(([key, row]) => [key, text(row)])) as { [K in keyof typeof PUBLIC_COMPOSE_COPY_ROWS]: string };
  return Object.freeze({
    ...rows,
    section: (key: PublicTopicSection) => text(PUBLIC_SECTION_COPY_ROWS[key]),
    note: (note: PublicTopicPrivacyNote) => rows[NOTE_ROWS[note]],
    readiness: (readiness: Exclude<PublicTopicReadiness, 'READY'>) => rows[READINESS_ROWS[readiness]],
  });
};
const AR = build('ar');
const EN = build('en');
export const publicComposeCopy = (language: ChromeLanguage): PublicComposeCopy => (language === 'ar' ? AR : EN);
/** `{0}` in a template, as the other Public copy modules fill it. */
export const fillCompose = (template: string, value: string): string => template.replace('{0}', value);
