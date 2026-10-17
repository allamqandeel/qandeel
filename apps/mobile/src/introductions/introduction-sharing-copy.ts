/**
 * S6-06 (CP2) — the words of progressive disclosure, the three-stage photo, SUCCESS, resuming Introductions, the
 * display-name consent and the Settings page «ما شاركته في التعارف», in ONE place, under the S6-06 Copy Gate (CLOSED by the
 * Product Owner on 2026-10-17, «S6-06 — اعتماد البوابات وبدء CP2»; the repository record is
 * docs/e2e/QANDEEL_S6_06_VISUAL_COPY_GATE_v1.md). Every row below is that record's row, word for word — this file was
 * generated from its table and a test compares the two in both languages.
 *
 * Arabic is simplified MSA under LANG-01: no row addresses the reader or a named person by one gender (the sixteen
 * gender-neutral rows the Product Owner approved). English writes one introduction in lower case and the feature name
 * "Introductions" with its capital (C-7). The SUCCESS rows (PD-40 … PD-47) are approved and are drawn ONLY when the server
 * returns a real transition, which nothing produces before Stage 8A. PD-83 is the iOS Photos purpose string: it lives in
 * the native build (app.json and its locales), and a test keeps the two identical.
 *
 * Rows already approved elsewhere are reused from their own modules, never copied: Back, Cancel, Try again, «تعذّر ذلك
 * الآن.», «هذا غير متاح الآن.», «جارٍ الفتح», offline, «متابعة», the S6-05 World rows (IW-*) and «الخصوصية والبيانات».
 */
import type { ChromeLanguage } from '../orientation-chrome';

export const INTRODUCTION_SHARING_COPY_GATE = {
  status: 'S6-06 COPY GATE — CLOSED — 74 rows APPROVED word for word by the Product Owner on 2026-10-17 (G: 16 gender-neutral rows; PD-03 «مشاركاتي»; C-1 … C-8)',
  /** Approved now, drawn only with a real transition version (Stage 8A). */
  successRows: ['PD-40', 'PD-41', 'PD-42', 'PD-43', 'PD-44', 'PD-45', 'PD-46', 'PD-47'],
  /** In the native build only (NSPhotoLibraryUsageDescription). */
  nativeRows: ['PD-83'],
} as const;

type Row = { readonly id: string; readonly ar: string; readonly en: string };
const ROWS = {
  sharingAction: { id: 'PD-00', ar: "المشاركة", en: "Sharing" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Header action in the live Introduction World (D-12)
  panelTitle: { id: 'PD-01', ar: "مشاركاتك في التعارف", en: "What you share" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Sharing panel title
  panelLead: { id: 'PD-02', ar: "المشاركة باختيارك: ماذا ومتى. ولا تُلزم الطرف الآخر بشيء.", en: "You choose what to share and when. Sharing asks nothing of the other person." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Sharing panel lead
  mineHeading: { id: 'PD-03', ar: "مشاركاتي", en: "What I shared" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Section: mine
  theirsHeading: { id: 'PD-04', ar: "مشاركات {الاسم}", en: "What {name} shared" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Section: theirs
  emptySection: { id: 'PD-05', ar: "لا توجد مشاركات بعد.", en: "Nothing shared yet." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Empty section
  shareSomething: { id: 'PD-06', ar: "مشاركة معلومة", en: "Share something" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Primary action / type sheet title
  typeFullName: { id: 'PD-07', ar: "الاسم الكامل", en: "Full name" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Type
  typeContact: { id: 'PD-08', ar: "وسيلة تواصل", en: "A way to reach you" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Type
  typePersonal: { id: 'PD-09', ar: "معلومة شخصية", en: "Something personal" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Type
  typePhoto: { id: 'PD-10', ar: "صورة", en: "Photo" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Type
  previewHeading: { id: 'PD-11', ar: "هكذا ستظهر لـ{الاسم}", en: "This is what {name} will see" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Preview heading
  shareNow: { id: 'PD-12', ar: "مشاركة الآن", en: "Share now" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Confirm button
  confirmNote: { id: 'PD-13', ar: "يمكنك حذفها لاحقًا، لكن لا يمكن التحكم فيما رآه الطرف الآخر أو احتفظ به.", en: "You can delete it later, but not what the other person has already seen or kept." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Confirm note
  notNow: { id: 'PD-14', ar: "ليس الآن", en: "Not now" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Dismiss
  sharingUnavailable: { id: 'PD-15', ar: "المشاركة غير متاحة الآن.", en: "Sharing isn't available right now." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Gate closed (NOT_AVAILABLE_NOW)
  contactHint: { id: 'PD-16', ar: "رقم أو بريد أو أي وسيلة من اختيارك.", en: "A number, an email, or any way you choose." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Contact method hint
  contactRefused: { id: 'PD-17', ar: "وسيلة التواصل تُشارَك من خيار «وسيلة تواصل».", en: "To share a way to reach you, use \"A way to reach you\"." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Contact refused in name / personal field (D-10)
  hometownHint: { id: 'PD-18', ar: "المدينة فقط، دون عنوان.", en: "City only, no address." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Home town hint (D-11)
  keyWorkField: { id: 'PD-19a', ar: "مجال العمل", en: "Field of work" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Personal field key work_field
  keyEducation: { id: 'PD-19b', ar: "الدراسة", en: "Education" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Personal field key education
  keyHometown: { id: 'PD-19c', ar: "المدينة التي نشأت فيها", en: "Home town" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Personal field key hometown_city
  keyAboutMe: { id: 'PD-19d', ar: "عني", en: "About me" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Personal field key about_me
  choosePhoto: { id: 'PD-20', ar: "اختيار صورة", en: "Choose a photo" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Photo action
  photoExplain: { id: 'PD-21', ar: "تظهر صورتك على ثلاث مراحل: تشويش قوي، ثم متوسط، ثم واضحة. كل مرحلة بموافقة جديدة منك.", en: "Your photo is shown in three steps: strongly blurred, then less blurred, then clear. Each step needs your new approval." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Photo explanation
  blurLimit: { id: 'PD-21b', ar: "التشويش يخفي التفاصيل، لكنه قد لا يمنع من يعرفك من التعرّف عليك.", en: "Blur hides detail, but someone who knows you may still recognise you." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Blur limit (always shown with PD-21)
  stageStrong: { id: 'PD-22a', ar: "تشويش قوي", en: "Strong blur" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Stage name
  stageMedium: { id: 'PD-22b', ar: "تشويش متوسط", en: "Medium blur" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Stage name
  stageClear: { id: 'PD-22c', ar: "صورة واضحة", en: "Clear photo" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Stage name
  shareStage: { id: 'PD-23', ar: "مشاركة: {المرحلة}", en: "Share: {stage}" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Stage share button
  nextLocked: { id: 'PD-24', ar: "تُتاح المرحلة التالية بعد مشاركة هذه.", en: "The next step opens after you share this one." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Locked next stage
  changePhoto: { id: 'PD-25', ar: "تغيير الصورة", en: "Change photo" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Before stage 1 only
  removePhoto: { id: 'PD-26', ar: "إزالة الصورة", en: "Remove photo" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Remove action
  removeConfirm: { id: 'PD-26b', ar: "إزالة الصورة؟ ستُحذف كل مراحلها التي شاركتها من هذا التعارف، ولن يكون بإمكان {الاسم} فتحها بعد الآن. لا يشمل ذلك ما سبق أن رآه الطرف الآخر أو احتفظ به.", en: "Remove this photo? Every step you shared will be deleted from this introduction, and {name} won't be able to open it anymore. This doesn't cover what they already saw or kept." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Remove confirmation (rev.1 correction)
  photoRefused: { id: 'PD-27', ar: "تعذّر استخدام هذه الصورة. يمكن اختيار صورة أخرى (JPEG أو PNG أو WebP، حتى 10 ميجابايت).", en: "This photo can't be used. Choose another (JPEG, PNG or WebP, up to 10 MB)." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Photo refused
  preparingPhoto: { id: 'PD-28', ar: "جارٍ تجهيز الصورة…", en: "Preparing your photo…" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Photo processing
  newPhoto: { id: 'PD-29', ar: "يمكنك مشاركة صورة جديدة. تبدأ من التشويش القوي، وكل مرحلة بموافقة جديدة.", en: "You can share a new photo. It starts strongly blurred, and each step needs your new approval." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — A new photo after a removed one
  retiredPhoto: { id: 'PD-29b', ar: "لا يمكن متابعة هذه الصورة بعد حذف إحدى مراحلها.", en: "This photo can't continue after one of its steps was deleted." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Retired series
  deleteShare: { id: 'PD-30', ar: "حذف", en: "Delete" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Delete action
  deleteConfirm: { id: 'PD-31', ar: "حذف هذه المشاركة؟ ستُحذف من هذا التعارف ولن تظهر لـ{الاسم} بعد الآن. لا يشمل ذلك ما سبق أن رآه الطرف الآخر أو احتفظ به.", en: "Delete this? It will be deleted from this introduction and {name} won't see it anymore. This doesn't cover what they already saw or kept." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Delete confirmation (rev.1 correction)
  deletedShare: { id: 'PD-32', ar: "حُذفت هذه المشاركة. ويمكن مشاركتها من جديد في مشاركة جديدة.", en: "This was deleted. To share again, start a new share." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Retry of a deleted share (DELETED)
  successTitle: { id: 'PD-40', ar: "الاستمرار في عالم مشترك", en: "Continue as a Shared World" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — SUCCESS card title (never shown before Stage 8A)
  successBody: { id: 'PD-41', ar: "اقترح قنديل أن يستمر هذا التعارف عالمًا مشتركًا. لا يحدث ذلك إلا بموافقتكما معًا، ويمكنك سحب موافقتك قبل اكتماله.", en: "QANDEEL suggested continuing this introduction as a Shared World. It happens only if you both agree, and you can withdraw before it's complete." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — SUCCESS card body
  successApprove: { id: 'PD-42', ar: "أوافق على الاستمرار", en: "I agree to continue" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Approve
  successApproved: { id: 'PD-43', ar: "وافقت. يمكنك سحب موافقتك ما لم يكتمل الانتقال.", en: "You agreed. You can withdraw until it's complete." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Approved state
  successWithdraw: { id: 'PD-44', ar: "سحب موافقتي", en: "Withdraw my agreement" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Withdraw
  successCompleted: { id: 'PD-45', ar: "أصبح هذا عالمًا مشتركًا.", en: "This is now a Shared World." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Completed
  successOpen: { id: 'PD-46', ar: "فتح العالم المشترك", en: "Open the Shared World" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Hand-off to the Standard World
  changed: { id: 'PD-47', ar: "تغيّر شيء. يمكنك المحاولة مرة أخرى.", en: "Something changed. Try again." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — CHANGED
  statusTitle: { id: 'PD-50', ar: "حالة التعارف", en: "Introductions status" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Status line title (Introductions surface)
  pausedActive: { id: 'PD-51', ar: "التعارف متوقف أثناء تعارفك الحالي.", en: "Introductions are paused during your current introduction." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — ACTIVE_INTRODUCTION
  pausedPostIntroduction: { id: 'PD-52', ar: "التعارف متوقف منذ انتهاء تعارفك الأخير.", en: "Introductions are paused since your last introduction ended." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — POST_INTRODUCTION
  pausedPostSuccess: { id: 'PD-53', ar: "التعارف متوقف منذ أن استمر تعارفك عالمًا مشتركًا.", en: "Introductions are paused since your introduction continued as a Shared World." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — POST_SUCCESS
  pausedOff: { id: 'PD-54', ar: "التعارف متوقف باختيارك.", en: "Introductions are off, by your choice." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — OFF
  resume: { id: 'PD-55', ar: "استئناف التعارف", en: "Resume Introductions" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Resume (RESUME)
  turnOn: { id: 'PD-56', ar: "تشغيل التعارف", en: "Turn on Introductions" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Turn on (ACTIVATE)
  resumeNote: { id: 'PD-57', ar: "لن يعود أي اقتراح سابق، وسيتحقق قنديل من إعدادك الحالي أولًا.", en: "No earlier suggestion comes back, and QANDEEL checks your current setup first." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Resume note
  notEligible: { id: 'PD-58', ar: "يحتاج إعدادك إلى مراجعة قبل الاستئناف.", en: "Your setup needs a review before resuming." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — NOT_ELIGIBLE
  resumeUnavailable: { id: 'PD-59', ar: "الاستئناف غير متاح الآن.", en: "Resuming isn't available right now." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Gate closed
  resumed: { id: 'PD-60', ar: "استُؤنف التعارف.", en: "Introductions resumed." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Resumed
  displayName: { id: 'PD-70', ar: "اسم العرض", en: "Display name" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Display name row
  displayExplain: { id: 'PD-71', ar: "يظهر اسمك الأول لـ{الاسم}. ويمكنك اختيار إظهار اسمك الكامل الذي شاركته بدلًا منه، في هذا العالم فقط.", en: "{name} sees your first name. You can choose to show the full name you shared instead, in this World only." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Display name explanation
  displayGrant: { id: 'PD-72', ar: "إظهار اسمي الكامل", en: "Show my full name" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Grant
  displayConfirm: { id: 'PD-73', ar: "سيظهر «{الاسم الكامل}» بدل اسمك الأول في هذا العالم. يمكنك الرجوع عن ذلك في أي وقت، لكن لا يمكن التحكم فيما رآه الطرف الآخر.", en: "\"{full name}\" will appear instead of your first name in this World. You can undo this anytime, but not what the other person has already seen." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Grant confirmation
  displayNeedsName: { id: 'PD-74', ar: "إظهار اسمك الكامل يحتاج إلى مشاركته أولًا.", en: "Share your full name first to be able to show it." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — No FULL_NAME shared yet
  displayGranted: { id: 'PD-75', ar: "يظهر اسمك الكامل في هذا العالم.", en: "Your full name is shown in this World." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Granted state
  displayRevoke: { id: 'PD-76', ar: "الرجوع إلى اسمي الأول", en: "Go back to my first name" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Revoke
  displayRevoked: { id: 'PD-77', ar: "يظهر اسمك الأول من جديد.", en: "Your first name is shown again." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Revoked
  displayNewVersion: { id: 'PD-78', ar: "شاركت اسمًا كاملًا جديدًا. ولإظهاره بدل اسمك الأول يلزم اختيار ذلك من جديد.", en: "You shared a new full name. To show it instead of your first name, choose that again." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — A new FULL_NAME version
  settingsRow: { id: 'PD-79', ar: "ما شاركته في التعارف", en: "What I shared in Introductions" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Settings → Privacy & Data row + page title (NEW)
  settingsLead: { id: 'PD-80', ar: "هنا ما شاركته في كل تعارف، حتى بعد انتهائه أو استمراره عالمًا مشتركًا. يمكنك حذف أي مشاركة، والرجوع إلى اسمك الأول في أي وقت.", en: "Here is what you shared in each introduction, even after it ended or continued as a Shared World. You can delete anything you shared, and go back to your first name at any time." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Settings page lead (NEW)
  settingsEmpty: { id: 'PD-81', ar: "لا توجد مشاركات لك في أي تعارف.", en: "You haven't shared anything in any introduction." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Settings page empty (NEW)
  settingsWith: { id: 'PD-82', ar: "مع {الاسم}", en: "With {name}" }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — Settings page group heading per World (NEW)
  photosPurpose: { id: 'PD-83', ar: "يستخدم قنديل الصورة المختارة فقط، لمشاركتها في تعارفك.", en: "QANDEEL uses only the photo you choose, to share it in your introduction." }, // APPROVED — S6-06 Copy Gate (Product Owner, 2026-10-17) — iOS Photos purpose string (NSPhotoLibraryUsageDescription)
} satisfies Record<string, Row>;

export type IntroductionSharingCopyKey = keyof typeof ROWS;
export type IntroductionSharingCopy = { readonly [K in IntroductionSharingCopyKey]: string };

/** Every row in both languages with its gate ID, exactly as approved. */
export const INTRODUCTION_SHARING_COPY_ROWS: Readonly<Record<IntroductionSharingCopyKey, Row>> = Object.freeze(ROWS);

const byLanguage = (language: ChromeLanguage): IntroductionSharingCopy =>
  Object.freeze(Object.fromEntries(Object.entries(ROWS).map(([key, row]) => [key, row[language]])) as IntroductionSharingCopy);
const AR = byLanguage('ar');
const EN = byLanguage('en');

export function introductionSharingCopy(language: ChromeLanguage): IntroductionSharingCopy {
  return language === 'ar' ? AR : EN;
}

/**
 * A row with its placeholders filled: the other person's name ({الاسم} / {name}), the reader's shared full name
 * ({الاسم الكامل} / {full name}) and a stage ({المرحلة} / {stage}). Values are inserted literally, never as patterns.
 */
export function fillSharing(template: string, values: { readonly name?: string; readonly fullName?: string; readonly stage?: string }): string {
  let text = template;
  if (values.fullName !== undefined) text = text.split('{الاسم الكامل}').join(values.fullName).split('{full name}').join(values.fullName);
  if (values.name !== undefined) text = text.split('{الاسم}').join(values.name).split('{name}').join(values.name);
  if (values.stage !== undefined) text = text.split('{المرحلة}').join(values.stage).split('{stage}').join(values.stage);
  return text;
}
