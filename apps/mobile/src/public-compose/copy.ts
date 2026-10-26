/**
 * S8A-05 CP1 — the ONE place the words of «اكتب موضوعك» / Write your topic are written: the private topic draft, its
 * editor and its saving, the preview with its privacy notes, preparing for publication, returning to the draft, the names
 * of the twelve sections and «حكايات مفتوحة», and the reader's view of one section in the Public field.
 *
 * Fixed Arabic is simplified Modern Standard Arabic and gender-considerate (LANG-01): where a second-person verb would
 * mark gender, the row uses a noun or a passive form instead. The four rows the Product Owner revised are the Owner's own
 * words, verbatim.
 *
 * Each row carries two statuses, and nothing here is promoted by being shipped. `status` is the Arabic row's; `enStatus`
 * is the English row's:
 *
 *   APPROVED  — the S8A-05 CP1 Product Copy Gate (Product Owner, 2026-10-26): every Arabic and English row the gate
 *               presented and the 13 section names, four with the Owner's own Arabic (`privateNote`, `previewHeading`,
 *               `publicWarning`, and `notOpen` + `draftKept`, the Owner's one text in its two sentences, so that «مسودتك
 *               محفوظة.» is shown only after the account confirmed the save, as the Owner required) and their English
 *               adjusted to match, as the Owner asked; the nine rows CP1's review corrections (R2) added after that
 *               decision — saving the draft automatically and the reader's view of one section — APPROVED by the Product
 *               Owner unchanged in both languages (2026-10-26); or an earlier approval reused verbatim (its source named on
 *               the row);
 *   PROPOSED  — not approved; no row is PROPOSED now
 *               (`docs/e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md` §6).
 *
 * Deliberately absent: any word saying the topic IS published (production publishing is closed until Stage 9 and the
 * honest line says so), any QANDEEL-suggested title or section, a count of readers, a rank or popularity, and any
 * engineering term.
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

const GATE = 'S8A-05 CP1 Product Copy Gate — APPROVED (Product Owner, 2026-10-26)';
const REVISED = 'S8A-05 CP1 Product Copy Gate — APPROVED with the Product Owner\'s own Arabic (2026-10-26); English adjusted to match, as the Owner asked';
const SECTION = 'S8A-05 WP1 §2.2 section name — S8A-05 CP1 Product Copy Gate, APPROVED (Product Owner, 2026-10-26)';
const R2 = 'S8A-05 CP1 R2 (review corrections) — APPROVED unchanged in Arabic and English (Product Owner, 2026-10-26)';
const approved = (ar: string, en: string, source = GATE): Row => ({ ar, en, status: 'APPROVED', enStatus: 'APPROVED', source });

export const PUBLIC_COMPOSE_COPY_ROWS = Object.freeze({
  entry: approved('موضوع جديد', 'New topic'),
  draftsHeading: approved('مسوداتي', 'My drafts'),
  noDrafts: approved('لا توجد مسودات بعد.', 'No drafts yet.'),
  newDraft: approved('كتابة موضوع جديد', 'Write a new topic'),
  untitled: approved('بلا عنوان', 'Untitled'),
  privateNote: approved('مسوداتك خاصة بيك، ومش ظاهرة لأي حد تاني.', 'Your drafts are private. No one else can see them.', REVISED),
  titleLabel: approved('العنوان', 'Title'),
  titleHint: approved('من 8 إلى 100 حرف', '8 to 100 characters'),
  textLabel: approved('النص', 'Text'),
  textCount: approved('{0} من 5000', '{0} of 5,000'),
  sectionLabel: approved('القسم', 'Section'),
  save: { ar: 'حفظ', en: 'Save', status: 'APPROVED', enStatus: 'APPROVED', source: 'S7-02 Product Copy Gate (Arabic 2026-10-19; English 2026-10-20, S7-05 D2)' },
  /** Shown only while the account holds exactly the words shown (`isDraftSaved`). */
  saved: approved('حُفظت المسودة.', 'The draft was saved.'),
  saving: approved('جارٍ حفظ المسودة…', 'Saving the draft…', R2),
  saveFailed: approved('تعذّر حفظ المسودة الآن، وما كُتب ما زال هنا.', "The draft couldn't be saved right now. What was written is still here.", R2),
  stale: approved('تغيّرت هذه المسودة من مكان آخر، فأُعيد تحميلها.', 'This draft changed somewhere else, so it was reloaded.'),
  limitReached: approved('بلغت المسودات الحد الأقصى (50).', 'The draft limit (50) has been reached.'),
  deletionPending: approved('الحساب قيد الحذف.', 'The account is being deleted.'),
  invalid: approved('تعذّر حفظ هذا النص كما هو.', "This text couldn't be saved as it is."),
  preview: approved('معاينة', 'Preview'),
  previewHeading: approved('معاينة الموضوع قبل النشر', 'Preview the topic before publishing', REVISED),
  publicWarning: approved('عند نشر الموضوع، هيقدر الآخرون يقرؤوا عنوانه ونصه.', 'Once the topic is published, others will be able to read its title and text.', REVISED),
  privacyHeading: approved('قبل النشر', 'Before publishing'),
  noteContactNumber: approved('يبدو أن النص يحتوي على رقم هاتف.', 'The text seems to contain a phone number.'),
  noteEmailAddress: approved('يبدو أن النص يحتوي على بريد إلكتروني.', 'The text seems to contain an email address.'),
  noteLink: approved('النص يحتوي على رابط.', 'The text contains a link.'),
  noteOwnName: approved('يبدو أن النص يحتوي على اسم صاحب الحساب.', "The text seems to contain the account holder's name."),
  noteRealName: approved('سيظهر الموضوع بالاسم الحقيقي.', 'The topic would appear under the real name.'),
  titleTooShort: approved('يحتاج العنوان إلى 8 أحرف على الأقل.', 'The title needs at least 8 characters.'),
  textRequired: approved('نص الموضوع مطلوب.', 'The topic needs its text.'),
  sectionRequired: approved('اختيار القسم مطلوب.', 'A section needs to be chosen.'),
  prepare: approved('تجهيز للنشر', 'Prepare for publishing'),
  /** The Owner's text, first sentence: always true when preparing answers that publishing is not open. */
  notOpen: approved('النشر في العالم العام مش متاح حاليًا.', "Publishing in Public World isn't available right now.", REVISED),
  /** The Owner's text, second sentence: ONLY when the account confirmed the draft shown (`isDraftSaved`). */
  draftKept: approved('مسودتك محفوظة.', 'Your draft is saved.', REVISED),
  preparedState: approved('مُجهّز للنشر، ولم يُنشر بعد', 'Prepared for publishing, not published yet'),
  backToDraft: approved('العودة إلى المسودة', 'Back to the draft'),
  backToDraftNote: approved('تُمحى النسخة المجهّزة، وتبقى المسودة.', 'The prepared copy is erased; the draft stays.'),
  delete: approved('حذف المسودة', 'Delete draft'),
  deleteConfirm: approved('حذف نهائي', 'Delete permanently'),
  deleteNote: approved('يُمحى العنوان والنص نهائيًا.', 'The title and text are erased permanently.'),
  deleted: approved('حُذفت المسودة.', 'The draft was deleted.'),
  // The reader's view of ONE section of the Public field (WP1 §2.5). No word ranks, counts or calls it a lens.
  allSections: approved('كل الأقسام', 'All sections', R2),
  sectionsHeading: approved('الأقسام', 'Sections', R2),
  sectionShown: approved('القسم المعروض: {0}', 'Section shown: {0}', R2),
  inSection: approved('في: {0}', 'In: {0}', R2),
  showAllSections: approved('إظهار كل الأقسام', 'Show all sections', R2),
  sectionNear: approved('من هذا القسم، قريبًا من هنا', 'From this section, near here', R2),
  sectionNoneHere: approved('لا توجد مواضيع من هذا القسم هنا.', 'No topics from this section here.', R2),
  back: { ar: 'رجوع', en: 'Back', status: 'APPROVED', enStatus: 'APPROVED', source: 'S4-01 Product Copy Gate (reused by S5-02)' },
  retry: { ar: 'إعادة المحاولة', en: 'Try again', status: 'APPROVED', enStatus: 'APPROVED', source: 'S4-01 Product Copy Gate (reused by S5-02)' },
  actionUnavailable: { ar: 'تعذّر ذلك الآن.', en: "That didn't work right now.", status: 'APPROVED', enStatus: 'APPROVED', source: 'S4-01 Product Copy Gate' },
} satisfies Record<string, Row>);

/** The twelve sections and «حكايات مفتوحة», in the server's display order. */
export const PUBLIC_SECTION_COPY_ROWS = Object.freeze({
  love: approved('الحب والارتباط', 'Love and relationships', SECTION),
  marriage: approved('الزواج والطلاق', 'Marriage and divorce', SECTION),
  family: approved('الأهل والعائلة', 'Parents and family', SECTION),
  parenting: approved('الأبناء والتربية', 'Children and parenting', SECTION),
  people: approved('الأصدقاء والناس', 'Friends and people', SECTION),
  work_money: approved('العمل والمال', 'Work and money', SECTION),
  study_future: approved('الدراسة والمستقبل', 'Study and the future', SECTION),
  inner_self: approved('النفس والمشاعر', 'The self and feelings', SECTION),
  health_body: approved('الصحة والجسد', 'Health and the body', SECTION),
  loss_crisis: approved('الفقد والأزمات', 'Loss and crises', SECTION),
  faith_meaning: approved('الإيمان والمعنى', 'Faith and meaning', SECTION),
  life_changes: approved('الغربة والتحولات', 'Living abroad and big changes', SECTION),
  open: approved('حكايات مفتوحة', 'Open stories', SECTION),
} satisfies Record<PublicTopicSection, Row>);

const ALL: Readonly<Record<string, Row>> = { ...PUBLIC_COMPOSE_COPY_ROWS, ...PUBLIC_SECTION_COPY_ROWS };
const keysWhere = (test: (row: Row) => boolean) => Object.entries(ALL).filter(([, row]) => test(row)).map(([key]) => key);
export const PUBLIC_COMPOSE_COPY_GATE = Object.freeze({
  status: 'S8A-05 CP1 PRODUCT COPY GATE — CLOSED: APPROVED by the Product Owner on 2026-10-26 (4 rows with the Owner\'s own Arabic; '
    + 'the nine R2 rows approved unchanged); nothing approved by being shipped',
  approved: keysWhere((row) => row.status === 'APPROVED'),
  revisedByProductOwner: ['privateNote', 'previewHeading', 'publicWarning', 'notOpen', 'draftKept'],
  proposed: keysWhere((row) => row.status === 'PROPOSED'),
  englishProposed: keysWhere((row) => row.enStatus === 'PROPOSED'),
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
