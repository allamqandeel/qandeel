/**
 * S6-01 — the words of «التعارف مع قنديل» / Introductions with QANDEEL (the owner's pre-enrollment preparation).
 *
 * Fixed Arabic is simplified Modern Standard Arabic and gender-considerate (the Product Owner's language rule, WP0 record
 * §14.1; GATE-28). Where a second-person verb would mark gender, the row uses a noun or a form spelled alike for both.
 * S6 owns this new Matching copy (D6 rule 4); no existing language file is touched.
 *
 * The seven pairs the Product Owner approved on 2026-10-09 (Task Contract §6) are kept VERBATIM below as history.
 * Their approval is not erased: C01 is used unchanged; C02, C04, C05 and C06 keep their approved English and receive a
 * controlled Arabic replacement (dialect and gender, WP0 §14.1 / §14.8); C03 is split into two purpose-exact rows
 * because one sentence carried two purposes (GATE-11, GATE-17, CW2-06A §3); C07 is DEFERRED and never displayed
 * (GATE-24a, CA-08: no field is disclosed before a Mutual Match).
 *
 * Every other row is PROPOSED until the Product Owner closes the S6-01 Product Copy Gate.
 */
import type { ChromeLanguage } from '../orientation-chrome';

/** The Product Owner's approved 2026-10-09 pairs, kept exactly as approved (history; not all are displayed). */
export const INTRODUCTIONS_HISTORICAL_COPY = Object.freeze({
  C01: { ar: 'التعارف مع قنديل', en: 'Introductions with QANDEEL' },
  C02: { ar: 'خليني أساعدك تكتشف فرصة تعارف مناسبة بهدف الزواج، بطريقتك وبالحدود اللي تختارها.', en: 'Let me help you explore a meaningful introduction for marriage, on your terms.' },
  C03: { ar: 'تحب أستفيد من فهمي السابق ليك علشان أخصص حوارنا وأساعدك في التوفيق؟', en: "May I use what I've learned about you to personalize our conversation and help with matching?" },
  C04: { ar: 'عندي فهم سابق لبعض أولوياتك. هسألك أسئلة مخصوصة ليك علشان نتأكد من فهمي ونكمل الصورة مع بعض.', en: "I already have some understanding of your priorities. I'll ask questions tailored to you so we can check my understanding together." },
  C05: { ar: 'لسه بنتعرف على بعض، وده طبيعي. خليني أسألك شوية أسئلة تساعدني أفهم إيه المهم ليك فعلًا.', en: "We're still getting to know each other. I'll ask a few questions to understand what truly matters to you." },
  C06: { ar: 'دي الصورة اللي وصلنا لها مع بعض. راجعها وعدّل أي حاجة مش بتعبّر عنك.', en: "Here's the introduction profile we've put together. Review it and change anything that doesn't feel right." },
  C07: { ar: 'اختار المعلومات اللي تسمح لقنديل يعرضها عند اقتراح تعارف. بياناتك وتحليلاتك الخاصة مش جزء من البطاقة.', en: 'Choose what QANDEEL may show in an introduction proposal. Your private data and analysis are not part of this profile.' },
});

export const INTRODUCTIONS_COPY_GATE = {
  status: 'S6-01 PRODUCT COPY GATE — OPEN — new and replacement rows PROPOSED, awaiting the Product Owner',
  /** C01, used exactly as approved on 2026-10-09. */
  approvedUnchanged: ['name'],
  /** Controlled replacements of the approved pairs: [historical id, row]. English kept as approved where it conforms. */
  controlledReplacements: [['C02', 'opening'], ['C03', 'assistanceOfferTitle'], ['C03', 'matchingContextGrantLabel'], ['C04', 'pathKnown'],
    ['C05', 'pathNew'], ['C06', 'reviewLead']],
  /** Approved English kept verbatim with its controlled Arabic replacement. */
  englishKeptAsApproved: ['opening', 'pathKnown', 'pathNew', 'reviewLead'],
  /** Never displayed in S6-01. */
  deferred: ['C07'],
  /** Recorded for the enrollment path only (CW2-06 §7 grant); not displayed in S6-01. */
  notDisplayed: ['matchingContextGrantLabel'],
} as const;

type Pair = { readonly ar: string; readonly en: string };
const ROWS = {
  name: { ar: 'التعارف مع قنديل', en: 'Introductions with QANDEEL' }, // APPROVED — C01 (Product Owner, 2026-10-09), unchanged
  opening: { ar: 'سأساعدك على استكشاف فرصة تعارف مناسبة بهدف الزواج، بطريقتك وضمن حدود من اختيارك.', en: 'Let me help you explore a meaningful introduction for marriage, on your terms.' }, // PROPOSED — controlled replacement of C02 (Arabic); English as approved
  privateNote: { ar: 'هذا تحضير خاص بك وحدك، ولا يراه أحد غيرك.', en: 'This is a private preparation, for you only. No one else sees it.' }, // PROPOSED
  enrollmentUnavailable: { ar: 'التسجيل في التعارف غير متاح حاليًا. يمكنك التحضير الآن ومراجعة ما أعددته في أي وقت.', en: "Enrolling in Introductions isn't available yet. You can prepare now and review what you've prepared at any time." }, // PROPOSED
  start: { ar: 'بدء التحضير', en: 'Start preparing' }, // PROPOSED
  continue: { ar: 'متابعة التحضير', en: 'Continue preparing' }, // PROPOSED
  pathNew: { ar: 'ما زلنا في بداية التعارف، وهذا طبيعي. سأطرح عليك بعض الأسئلة لأفهم ما يهمك فعلًا.', en: "We're still getting to know each other. I'll ask a few questions to understand what truly matters to you." }, // PROPOSED — controlled replacement of C05 (Arabic); English as approved
  pathKnown: { ar: 'لديّ فهم سابق لبعض أولوياتك. سأطرح عليك أسئلة خاصة بك لنتأكد من فهمي ونكمل الصورة معًا.', en: "I already have some understanding of your priorities. I'll ask questions tailored to you so we can check my understanding together." }, // PROPOSED — controlled replacement of C04 (Arabic); English as approved
  pathMixed: { ar: 'بعض ما أعرفه عنك ربما تغيّر. سأسألك عنه أولًا قبل أن أعتمد عليه.', en: "Some of what I know about you may have changed. I'll ask you about it first before relying on it." }, // PROPOSED
  assistanceOfferTitle: { ar: 'الاستفادة مما يعرفه قنديل عنك في التحضير', en: 'Using what QANDEEL knows about you to prepare' }, // PROPOSED — C03 split (a): the onboarding-assistance permission
  matchingContextGrantLabel: { ar: 'السماح باستخدام فهم قنديل لك في التوفيق', en: "Allow QANDEEL's understanding of you to be used for matching" }, // PROPOSED — C03 split (b): the Matching Context Grant; NOT DISPLAYED in S6-01
  allowAssistance: { ar: 'السماح', en: 'Allow' }, // PROPOSED
  continueWithout: { ar: 'المتابعة دون ذلك', en: 'Continue without it' }, // PROPOSED
  assistanceOn: { ar: 'يستفيد قنديل مما يعرفه عنك في التحضير.', en: 'QANDEEL uses what it knows about you to help you prepare.' }, // PROPOSED
  assistanceOff: { ar: 'لا يستفيد قنديل مما يعرفه عنك في التحضير.', en: "QANDEEL doesn't use what it knows about you to help you prepare." }, // PROPOSED
  stopAssistance: { ar: 'إيقاف هذا الإذن', en: 'Withdraw this permission' }, // PROPOSED
  priorLead: { ar: 'مما شاركته معي سابقًا:', en: "Something you've shared with me:" }, // PROPOSED
  priorConfirmQuestion: { ar: 'هل ما زال هذا صحيحًا ومهمًا لك في التعارف؟', en: 'Is this still true, and does it matter to you for Introductions?' }, // PROPOSED
  priorClarifyLead: { ar: 'شاركت هذا معي منذ مدة، وربما تغيّر:', en: 'You shared this with me a while ago, and it may have changed:' }, // PROPOSED
  priorClarifyQuestion: { ar: 'هل ما زال يعبّر عنك؟', en: 'Does it still describe you?' }, // PROPOSED
  priorYes: { ar: 'نعم، صحيح', en: "Yes, that's right" }, // PROPOSED
  priorEdit: { ar: 'تصحيح الصياغة', en: 'Correct the wording' }, // PROPOSED
  priorNoLonger: { ar: 'لم يعد صحيحًا', en: 'No longer true' }, // PROPOSED
  priorDecline: { ar: 'عدم استخدامه', en: "Don't use it" }, // PROPOSED
  priorCorrectionLabel: { ar: 'الصياغة الصحيحة بكلماتك', en: 'The right wording, in your words' }, // PROPOSED
  priorMemoryNote: { ar: 'لن يغيّر ذلك ما يتذكره قنديل في محادثاتك.', en: "This won't change what QANDEEL remembers in your conversations." }, // PROPOSED
  priorStop: { ar: 'التوقف عن عرض ما أعرفه', en: 'Stop showing what I know' }, // PROPOSED
  firstNameTitle: { ar: 'الاسم الأول للتعارف', en: 'First name for Introductions' }, // PROPOSED
  firstNameHint: { ar: 'الاسم الذي يُستخدم في التعارف، وقد يختلف عن اسم حسابك.', en: 'The name used in Introductions. It can differ from your account name.' }, // PROPOSED
  sexTitle: { ar: 'الجنس', en: 'Sex' }, // PROPOSED
  sexHint: { ar: 'يكون التعارف بين رجل وامرأة فقط. لا يستنتج قنديل هذه المعلومة من أي شيء آخر.', en: "Introductions are only between a man and a woman. QANDEEL never infers this from anything else." }, // PROPOSED
  male: { ar: 'ذكر', en: 'Male' }, // PROPOSED
  female: { ar: 'أنثى', en: 'Female' }, // PROPOSED
  sexConfirmQuestion: { ar: 'هل هذه المعلومة صحيحة؟ تأكيدها خطوة مستقلة عن إدخالها.', en: 'Is this correct? Confirming it is a separate step from entering it.' }, // PROPOSED
  birthTitle: { ar: 'شهر الميلاد وسنته', en: 'Month and year of birth' }, // PROPOSED
  birthHint: { ar: 'لا نطلب يوم الميلاد، وتبقى هذه المعلومة خاصة.', en: "We don't ask for the day, and this stays private." }, // PROPOSED
  birthYear: { ar: 'السنة', en: 'Year' }, // PROPOSED
  birthMonth: { ar: 'الشهر', en: 'Month' }, // PROPOSED
  areaTitle: { ar: 'المنطقة', en: 'Area' }, // PROPOSED
  areaHint: { ar: 'منطقة عامة فقط، دون عنوان.', en: 'A broad area only, no address.' }, // PROPOSED
  country: { ar: 'الدولة', en: 'Country' }, // PROPOSED
  region: { ar: 'المنطقة داخل الدولة', en: 'Region' }, // PROPOSED
  maritalTitle: { ar: 'الحالة الاجتماعية', en: 'Marital status' }, // PROPOSED
  NEVER_MARRIED: { ar: 'لم يسبق الزواج', en: 'Never married' }, // PROPOSED
  DIVORCED: { ar: 'مطلّق أو مطلّقة', en: 'Divorced' }, // PROPOSED
  WIDOWED: { ar: 'أرمل أو أرملة', en: 'Widowed' }, // PROPOSED
  CURRENTLY_MARRIED: { ar: 'متزوج أو متزوجة حاليًا', en: 'Currently married' }, // PROPOSED
  factConfirmQuestion: { ar: 'هل هذه المعلومة صحيحة؟', en: 'Is this correct?' }, // PROPOSED
  factReconfirm: { ar: 'غُيّرت هذه المعلومة بعد تأكيدها. هل القيمة الجديدة صحيحة؟', en: 'This changed after it was confirmed. Is the new value correct?' }, // PROPOSED
  yesCorrect: { ar: 'نعم، صحيحة', en: "Yes, it's correct" }, // PROPOSED
  edit: { ar: 'تعديل', en: 'Edit' }, // PROPOSED
  save: { ar: 'حفظ', en: 'Save' }, // PROPOSED
  cancel: { ar: 'إلغاء', en: 'Cancel' }, // PROPOSED
  hardTitle: { ar: 'الشروط الأساسية', en: 'Dealbreakers' }, // PROPOSED
  hardBody: { ar: 'ما لا يمكن قبوله في شريك الحياة.', en: "What you can't accept in a life partner." }, // PROPOSED
  hardNone: { ar: 'لا توجد شروط أساسية إضافية', en: 'No additional dealbreakers' }, // PROPOSED
  hardSet: { ar: 'تحديد شروط أساسية', en: 'Set dealbreakers' }, // PROPOSED
  systemRulesNote: { ar: 'يطبّق قنديل قواعد التعارف العامة، مثل السن القانونية، دون أن تُكتب شرطًا لك.', en: 'QANDEEL applies the general rules, such as legal age, without writing them as your dealbreaker.' }, // PROPOSED
  softTitle: { ar: 'التفضيلات', en: 'Preferences' }, // PROPOSED
  softBody: { ar: 'ما يُفضَّل لديك دون أن يكون شرطًا.', en: 'What you prefer, without it being a dealbreaker.' }, // PROPOSED
  softNone: { ar: 'لا توجد تفضيلات', en: 'No preferences' }, // PROPOSED
  softSet: { ar: 'تحديد تفضيلات', en: 'Set preferences' }, // PROPOSED
  AGE_RANGE: { ar: 'العمر', en: 'Age' }, // PROPOSED
  MARITAL_STATUS: { ar: 'الحالة الاجتماعية', en: 'Marital status' }, // PROPOSED
  AREA: { ar: 'المنطقة', en: 'Area' }, // PROPOSED
  ageFrom: { ar: 'من', en: 'From' }, // PROPOSED
  ageTo: { ar: 'إلى', en: 'To' }, // PROPOSED
  discrepancyTitle: { ar: 'تعارض يحتاج إلى قرارك', en: 'A conflict that needs your decision' }, // PROPOSED
  discrepancyBody: { ar: 'أحد تفضيلاتك يقع خارج شرط أساسي في البند نفسه:', en: 'One of your preferences falls outside a dealbreaker on the same point:' }, // PROPOSED
  editHard: { ar: 'تعديل الشرط', en: 'Edit the dealbreaker' }, // PROPOSED
  editSoft: { ar: 'تعديل التفضيل', en: 'Edit the preference' }, // PROPOSED
  prioritiesTitle: { ar: 'ما الذي يهمك في شريك الحياة؟', en: 'What matters to you in a life partner?' }, // PROPOSED
  prioritiesHint: { ar: 'بكلماتك. لا يراه أحد غيرك.', en: 'In your own words. No one else sees it.' }, // PROPOSED
  shortIntroTitle: { ar: 'نبذة قصيرة عنك (اختيارية)', en: 'A short introduction (optional)' }, // PROPOSED
  shortIntroHint: { ar: 'من 20 إلى 280 حرفًا. لا تُعرض على أحد قبل التوافق المتبادل.', en: '20 to 280 characters. Not shown to anyone before a mutual match.' }, // PROPOSED
  workFieldTitle: { ar: 'مجال العمل (اختياري)', en: 'Work field (optional)' }, // PROPOSED
  skip: { ar: 'تخطي هذه الخطوة', en: 'Skip this step' }, // PROPOSED
  reviewLead: { ar: 'هذه الصورة التي وصلنا إليها معًا. يمكنك مراجعتها وتعديل أي شيء لا يعبّر عنك.', en: "Here's the introduction profile we've put together. Review it and change anything that doesn't feel right." }, // PROPOSED — controlled replacement of C06 (Arabic); English as approved
  reviewConfirm: { ar: 'تأكيد المراجعة', en: 'Confirm review' }, // PROPOSED
  reviewed: { ar: 'اكتمل تحضيرك. التسجيل في التعارف غير متاح بعد، ويبقى ما أعددته محفوظًا لك وحدك.', en: "Your preparation is complete. Enrolling in Introductions isn't available yet, and what you've prepared stays saved, for you only." }, // PROPOSED
  notesHeading: { ar: 'ما يهمك', en: 'What matters to you' }, // PROPOSED
  notSet: { ar: 'لم يُحدَّد بعد', en: 'Not set yet' }, // PROPOSED
  discard: { ar: 'حذف التحضير', en: 'Delete preparation' }, // PROPOSED
  discardConfirm: { ar: 'سيُحذف كل ما أعددته هنا نهائيًا.', en: "Everything you've prepared here will be deleted permanently." }, // PROPOSED
  discardYes: { ar: 'حذف', en: 'Delete' }, // PROPOSED
  unavailable: { ar: 'التحضير للتعارف غير متاح الآن.', en: "Preparing for Introductions isn't available right now." }, // PROPOSED
  deletionPending: { ar: 'لا يمكن تعديل التحضير أثناء طلب حذف الحساب.', en: "Your preparation can't be changed while your account deletion is pending." }, // PROPOSED
  changedElsewhere: { ar: 'تغيّر التحضير من جهاز آخر، وهذه أحدث نسخة منه.', en: 'Your preparation changed on another device. This is the latest version.' }, // PROPOSED
  noteLimit: { ar: 'وصلت إلى الحد الأقصى من الملاحظات.', en: "You've reached the most notes you can add." }, // PROPOSED
  failed: { ar: 'تعذّر الحفظ. يمكن المحاولة مرة أخرى.', en: "Couldn't save. Please try again." }, // PROPOSED
  invalid: { ar: 'هذه القيمة غير مقبولة.', en: "This value isn't accepted." }, // PROPOSED
  tryAgain: { ar: 'إعادة المحاولة', en: 'Try again' }, // REUSED meaning — PROPOSED wording
  back: { ar: 'رجوع', en: 'Back' }, // PROPOSED
} as const satisfies Record<string, Pair>;

export type IntroductionsCopy = { readonly [K in keyof typeof ROWS]: string };

const pick = (language: ChromeLanguage): IntroductionsCopy =>
  Object.freeze(Object.fromEntries(Object.entries(ROWS).map(([key, pair]) => [key, pair[language]]))) as IntroductionsCopy;
const AR = pick('ar');
const EN = pick('en');

export function introductionsCopy(language: ChromeLanguage): IntroductionsCopy {
  return language === 'ar' ? AR : EN;
}

/** Every row, both languages — for the Product Copy Gate package and its tests. */
export const INTRODUCTIONS_COPY_ROWS: Readonly<Record<keyof typeof ROWS, Pair>> = ROWS;

/** The consent text exactly as migration 0154 stores it for MATCHING_ONBOARDING_ASSISTANCE_V1 (proved equal by a test). */
export const ASSISTANCE_CONSENT_TEXT: Readonly<Record<string, Pair>> = Object.freeze({
  MATCHING_ONBOARDING_ASSISTANCE_V1: {
    ar: 'يعرض قنديل ما يعرفه عنك من محادثاتك السابقة، معلومةً تلو الأخرى، لتأكيدها أو تصحيحها أو رفضها أثناء التحضير للتعارف. لا يُستخدم ذلك لتقييم أي شخص، ولا يُعرض على أحد، ويمكن إلغاء هذا الإذن في أي وقت.',
    en: 'QANDEEL shows what it knows about you from your past conversations, one item at a time, for you to confirm, correct or reject while you prepare for Introductions. It is not used to evaluate anyone and is not shown to anyone. You can withdraw this permission at any time.',
  },
});

export const MONTHS: Readonly<Record<ChromeLanguage, readonly string[]>> = Object.freeze({
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
});

export const WORK_FIELD_NAMES: Readonly<Record<string, Pair>> = Object.freeze({
  HEALTH: { ar: 'الصحة والرعاية الطبية', en: 'Health and medical care' },
  EDUCATION: { ar: 'التعليم', en: 'Education' },
  ENGINEERING_TECHNOLOGY: { ar: 'الهندسة والتقنية', en: 'Engineering and technology' },
  BUSINESS_FINANCE: { ar: 'الأعمال والمال', en: 'Business and finance' },
  LAW_GOVERNMENT: { ar: 'القانون والعمل الحكومي', en: 'Law and public service' },
  MEDIA_ARTS: { ar: 'الإعلام والفنون', en: 'Media and the arts' },
  SCIENCE_RESEARCH: { ar: 'العلوم والبحث', en: 'Science and research' },
  CRAFTS_TRADES: { ar: 'الحِرف والمهن الفنية', en: 'Crafts and trades' },
  SERVICES_HOSPITALITY: { ar: 'الخدمات والضيافة', en: 'Services and hospitality' },
  AGRICULTURE_ENVIRONMENT: { ar: 'الزراعة والبيئة', en: 'Agriculture and environment' },
  STUDENT: { ar: 'الدراسة', en: 'Studying' },
  NOT_CURRENTLY_WORKING: { ar: 'لا عمل حاليًا', en: 'Not working at the moment' },
  OTHER: { ar: 'مجال آخر', en: 'Another field' },
});
