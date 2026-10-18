/**
 * S6-07 (CP3) — the words of the enrollment step and the consent controls in «التعارف مع قنديل».
 *
 * Every row is APPROVED word for word by the Product Owner on 2026-10-18 («S6-07 — CP3 Copy Gate APPROVED / Resume
 * Implementation»): groups A (EN-01 … EN-21, EN-03 amended) and C (RV-01 … RV-12, RV-06 and RV-08 amended), recorded in
 * the S6-07 record §11.5. Simplified Modern Standard Arabic, gender-neutral.
 *
 * The consent texts themselves (group B: CT-P, CT-C, CT-D) are NOT here: the reader is shown exactly the current text the
 * server returns for each consent, with its version, and an act names that version. They are installed by the operator
 * (`database/matching-consent-texts-v1.mjs`), never shipped in the app.
 *
 * Group D (AC-01 … AC-06) is NOT APPROVED FOR USE: every Introductions Activity item keeps the approved generic sentence.
 * Cancel reuses the approved S4-01 «إلغاء» (`sharedCopy().cancel`).
 */
import type { ChromeLanguage } from '../orientation-chrome';

export const ENROLLMENT_COPY_GATE = Object.freeze({
  status: 'S6-07 CP3 PRODUCT COPY GATE — CLOSED — groups A, B and C APPROVED by the Product Owner on 2026-10-18 (EN-03, CT-P, CT-D, RV-06, RV-08 amended); group D NOT APPROVED FOR USE',
  approved: Object.freeze([
    'EN-01', 'EN-02', 'EN-03', 'EN-04', 'EN-05', 'EN-06', 'EN-07', 'EN-08', 'EN-09', 'EN-10', 'EN-11', 'EN-12', 'EN-13', 'EN-14', 'EN-15',
    'EN-16', 'EN-17', 'EN-18', 'EN-19', 'EN-20', 'EN-21',
    'RV-01', 'RV-02', 'RV-03', 'RV-04', 'RV-05', 'RV-06', 'RV-07', 'RV-08', 'RV-09', 'RV-10', 'RV-11', 'RV-12',
  ]),
  amendedByProductOwner: Object.freeze(['EN-03', 'RV-06', 'RV-08']),
  notApprovedForUse: Object.freeze(['AC-01', 'AC-02', 'AC-03', 'AC-04', 'AC-05', 'AC-06']),
});

type Pair = { readonly ar: string; readonly en: string };
export const ENROLLMENT_COPY_ROWS = Object.freeze({
  heading: { id: 'EN-01', ar: 'تأكيد التسجيل في التعارف', en: 'Confirm your Introductions enrollment' },
  lead: { id: 'EN-02', ar: 'تُعرض أدناه ثلاث موافقات مستقلة، ويمكن سحب كلٍّ منها لاحقًا على حدة.', en: 'Three separate consents are shown below. Each can be withdrawn later on its own.' },
  participationLabel: { id: 'EN-03', ar: 'المشاركة في مقترحات التعارف', en: 'Taking part in introduction proposals' },
  contextGrantLabel: { id: 'EN-04', ar: 'الاستناد إلى عالمي الخاص في التعارف', en: 'Drawing on My World for Introductions' },
  disclosureAuthorityLabel: { id: 'EN-05', ar: 'ما يُعرض قبل التوافق المتبادل', en: "What's shown before a mutual match" },
  agree: { id: 'EN-06', ar: 'أوافق', en: 'I agree' },
  enroll: { id: 'EN-07', ar: 'تأكيد التسجيل', en: 'Confirm enrollment' },
  recording: { id: 'EN-08', ar: 'جارٍ تسجيل التأكيد…', en: 'Recording your confirmation…' },
  enrolled: { id: 'EN-09', ar: 'تمّ التسجيل في التعارف.', en: "You're enrolled in Introductions." },
  closed: { id: 'EN-10', ar: 'التسجيل في التعارف غير متاح الآن.', en: "Introductions enrollment isn't available right now." },
  deletionPending: { id: 'EN-11', ar: 'لا يمكن التسجيل أثناء وجود طلب لحذف الحساب.', en: "Enrollment isn't possible while an account deletion is pending." },
  changed: { id: 'EN-12', ar: 'تغيّر شيء منذ المراجعة الأخيرة، وتلزم المراجعة مرة أخرى قبل التأكيد.', en: 'Something changed since the last review. Please review again before confirming.' },
  consentOutdated: { id: 'EN-13', ar: 'تغيّر نص إحدى الموافقات، وتلزم قراءته مرة أخرى قبل التأكيد.', en: 'The wording of one of the consents changed. Please read it again before confirming.' },
  incomplete: { id: 'EN-14', ar: 'يلزم إكمال التجهيز قبل التسجيل.', en: 'Preparation needs to be completed before enrolling.' },
  correct: { id: 'EN-15', ar: 'تحديث التسجيل بما تمّت مراجعته', en: 'Update your enrollment with what you reviewed' },
  corrected: { id: 'EN-16', ar: 'تمّ تحديث التسجيل.', en: 'Your enrollment is updated.' },
  resume: { id: 'EN-17', ar: 'استئناف المشاركة في التعارف', en: 'Resume taking part in Introductions' },
  resumed: { id: 'EN-18', ar: 'تمّ استئناف المشاركة.', en: "You're taking part again." },
  reconfirm: { id: 'EN-19', ar: 'تأكيد الموافقات بصيغتها الجديدة', en: 'Confirm the consents in their new wording' },
  reconfirmed: { id: 'EN-20', ar: 'تمّ تأكيد الموافقات.', en: 'Your consents are confirmed.' },
  failed: { id: 'EN-21', ar: 'تعذّر إتمام الطلب الآن، ويمكن المحاولة لاحقًا.', en: "This couldn't be completed right now. You can try again later." },
  consentsHeading: { id: 'RV-01', ar: 'موافقات التعارف', en: 'Introductions consents' },
  given: { id: 'RV-02', ar: 'مُعطاة', en: 'Given' },
  notGiven: { id: 'RV-03', ar: 'غير مُعطاة', en: 'Not given' },
  withdraw: { id: 'RV-04', ar: 'سحب الموافقة', en: 'Withdraw consent' },
  withdrawTitle: { id: 'RV-05', ar: 'سحب هذه الموافقة؟', en: 'Withdraw this consent?' },
  withdrawParticipation: { id: 'RV-06', ar: 'تتوقف مشاركتك في مقترحات التعارف الجديدة، دون إنهاء أي تعارف بدأ بالفعل.', en: 'You will stop taking part in new introduction proposals. This does not end an introduction that has already begun.' },
  withdrawContextGrant: { id: 'RV-07', ar: 'يتوقف الاستناد إلى عالمك الخاص في التعارف.', en: 'QANDEEL stops drawing on your My World for Introductions.' },
  withdrawDisclosureAuthority: { id: 'RV-08', ar: 'لن يُسمح بتمرير مقترحات جديدة إلى الطرف الآخر استنادًا إلى هذه الموافقة.', en: 'This consent will no longer authorize new proposals to be forwarded to the other person.' },
  withdrawConfirm: { id: 'RV-09', ar: 'سحب', en: 'Withdraw' },
  withdrawn: { id: 'RV-10', ar: 'تمّ سحب الموافقة.', en: 'Consent withdrawn.' },
  withdrawChanged: { id: 'RV-11', ar: 'تغيّرت الحالة منذ عرضها، وقد حُدِّثت الآن.', en: "This changed since it was shown. It's up to date now." },
  nothingToWithdraw: { id: 'RV-12', ar: 'لا توجد موافقة قائمة لسحبها.', en: "There's no consent to withdraw." },
} satisfies Record<string, Pair & { readonly id: string }>);

export type EnrollmentCopyKey = keyof typeof ENROLLMENT_COPY_ROWS;
export type EnrollmentCopy = { readonly [K in EnrollmentCopyKey]: string };

export function enrollmentCopy(language: ChromeLanguage): EnrollmentCopy {
  return Object.fromEntries(Object.entries(ENROLLMENT_COPY_ROWS).map(([key, row]) => [key, row[language]])) as EnrollmentCopy;
}
