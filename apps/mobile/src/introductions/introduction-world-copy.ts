/**
 * S6-05 (CP5) — the words of the Mutual Match acceptance and the Introduction World, in ONE place, under the S6-05 Copy
 * Gate (CLOSED by the Product Owner on 2026-10-15, «S6-05 — CP1 Final Approval & CP2 Authorization»; the repository
 * record is docs/e2e/QANDEEL_S6_05_VISUAL_COPY_GATE_v1.md). Every row below is that record's row, word for word — this
 * file was generated from its table and a test compares the two in both languages.
 *
 * Arabic is simplified MSA, considerate of all genders. M-12 (the LANG-01 welcome) is NOT used, and its words appear
 * nowhere in the app (R-2): they imply an active presence the Introduction does not have. The welcome (IW-22) is fixed client text, never a
 * stored or AI message (R-3). Rows already approved elsewhere are reused from their own modules, never copied: the S6-04
 * proposals copy (`proposals-copy.ts`, including `acceptNotYet`, which stays while the launch gate is closed), the Shared
 * World and conversation rows (Back, Try again, «تعذّر ذلك الآن.», «هذا غير متاح الآن.», «جارٍ الفتح», «تعذّر إرسال
 * الرسالة.», «كلامك هنا», «عوالم منتهية», Delete).
 */
import type { ChromeLanguage } from '../orientation-chrome';

export const INTRODUCTION_WORLD_COPY_GATE = {
  status: 'S6-05 COPY GATE — CLOSED — 30 rows APPROVED word for word by the Product Owner on 2026-10-15 (IW-03b rev.3); M-12 not used (R-2)',
  /** LANG-01 approved, displayed: M-11 (the opening subtitle). */
  lang01Displayed: ['M-11'],
  /** LANG-01 approved wording deliberately not used (R-2). */
  notUsed: ['M-12'],
} as const;

type Row = { readonly id: string; readonly ar: string; readonly en: string };
const ROWS = {
  acceptAction: { id: 'IW-01', ar: "الموافقة على بدء التعارف", en: "Agree to begin the introduction" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the accept action on the review (CANDIDATE, only when the server offers ACCEPT)
  acceptTitle: { id: 'IW-02', ar: "قبل بدء التعارف", en: "Before the introduction begins" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the confirmation heading
  acceptBegins: { id: 'IW-03a', ar: "عند الموافقة، وإذا كان المقترح ما زال متاحًا، يبدأ التعارف فورًا في عالم مشترك خاص بكما.", en: "If you agree and the proposal is still available, the introduction begins right away in a private Shared World for the two of you." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — confirmation
  acceptNameOnly: { id: 'IW-03b', ar: "عند بدء التعارف، لا يُعرض للطرف الآخر من ملفك سوى اسمك الأول للتعارف.", en: "When the introduction begins, only your introduction first name is shown to the other person from your profile." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — confirmation (rev.3, the Product Owner's final correction, verbatim)
  acceptProtected: { id: 'IW-03c', ar: "فيما عدا اسمك الأول للتعارف، تبقى بياناتك وتحليلاتك الخاصة محمية ولا تُشارَك.", en: "Apart from your first name for Introductions, your private data and analysis stay protected and aren't shared." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — confirmation (rev.2)
  acceptEitherEnds: { id: 'IW-03d', ar: "يستطيع أيٌّ منكما إنهاء التعارف في أي وقت، دون ذكر سبب.", en: "Either of you can end the introduction at any time, without giving a reason." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — confirmation
  acceptConfirm: { id: 'IW-04', ar: "أوافق على بدء التعارف", en: "I agree to begin the introduction" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the confirm button
  begunTitle: { id: 'IW-05', ar: "بدأ التعارف", en: "Your introduction has begun" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the result heading (second party)
  begunBody: { id: 'IW-05b', ar: "تمّت الموافقة، وبدأ التعارف في عالم مشترك خاص بكما.", en: "You've agreed, and your introduction has begun in a private Shared World for the two of you." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the result body
  enter: { id: 'IW-06', ar: "الدخول إلى عالم التعارف", en: "Enter the introduction" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the entry (result + MATCH_CONCLUDED card)
  accepting: { id: 'IW-07', ar: "جارٍ تسجيل موافقتك…", en: "Recording your agreement…" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — accept pending
  sectionHeading: { id: 'IW-10', ar: "التعارف", en: "Introductions" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the section heading in «العالم المشترك»
  title: { id: 'IW-11', ar: "تعارف مع {0}", en: "Introduction with {0}" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — card / World title; {0} is the first name the server presented
  titleNoName: { id: 'IW-11b', ar: "تعارف", en: "Introduction" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — title when no name is available
  endedStatus: { id: 'IW-12', ar: "انتهى التعارف", en: "Introduction ended" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the ended card status
  cardSubtitle: { id: 'IW-21', ar: "مساحة تعارف خاصة", en: "A private introduction space" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the card subtitle in «العالم المشترك» (not used in the opening, rev.2)
  bothAgreed: { id: 'M-11', ar: "وافق الطرفان على التعارف.", en: "You both agreed to the introduction." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the opening subtitle under the name, both parties (LANG-01 editorial approval + this Copy Gate)
  welcome: { id: 'IW-22', ar: "مرحبًا بكما في مساحة التعارف. يمكنكما بدء الحديث على مهل، ولكل منكما حرية الاستمرار أو إنهاء التعارف في أي وقت.", en: "Welcome to your introduction space. You can start talking at your own pace, and each of you is free to continue or to end the introduction at any time." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the fixed welcome in the opening: client text, never a stored message (R-3)
  note: { id: 'IW-23', ar: "هذه المساحة خاصة، ولا يردّ قنديل على الرسائل في هذه المرحلة.", en: "This space is private, and QANDEEL doesn't reply to messages at this stage." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the note in the opening, under the welcome (rev.2)
  composerName: { id: 'IW-24', ar: "رسالتك في هذا التعارف", en: "Your message in this introduction" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the composer's accessibility label
  endAction: { id: 'IW-26', ar: "إنهاء التعارف", en: "End introduction" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the header action
  endTitle: { id: 'IW-27', ar: "إنهاء التعارف؟", en: "End the introduction?" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the END confirmation heading
  endStops: { id: 'IW-28a', ar: "عند الإنهاء تتوقف المحادثة لكما معًا. بعدها يمكنك قراءة ما يبقى متاحًا لك من السجل، وحذف رسائلك أيضًا.", en: "Ending stops the conversation for both of you. After that, you can read what remains available to you in the record, and delete your own messages." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — END confirmation (rev.2)
  endNoReason: { id: 'IW-28b', ar: "لن يُطلب منك ذكر أي سبب، ولا يمكن التراجع عن الإنهاء.", en: "You won't be asked for a reason, and ending can't be undone." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — END confirmation
  endNoResume: { id: 'IW-28c', ar: "لن تُستأنف مقترحات التعارف تلقائيًا بعد الإنهاء.", en: "Introduction proposals won't resume automatically after ending." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — END confirmation
  endConfirm: { id: 'IW-29', ar: "إنهاء التعارف", en: "End introduction" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the END confirm button
  ending: { id: 'IW-30', ar: "جارٍ إنهاء التعارف…", en: "Ending the introduction…" }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — END running
  closedBanner: { id: 'IW-31', ar: "انتهى هذا التعارف. يمكنك قراءة ما كان متاحًا لك فقط.", en: "This introduction has ended. You can only read what was available to you." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — the closed-record banner
  alreadyEnded: { id: 'IW-32', ar: "انتهى هذا التعارف بالفعل.", en: "This introduction has already ended." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — ALREADY_SETTLED
  sendEnded: { id: 'IW-35', ar: "انتهى التعارف، ولم تُرسل الرسالة.", en: "The introduction has ended. The message wasn't sent." }, // APPROVED — S6-05 Copy Gate (Product Owner, 2026-10-15) — send refused after END: ONLY on the server-confirmed ended state of this member's own World (rev.2)
} satisfies Record<string, Row>;

export type IntroductionWorldCopyKey = keyof typeof ROWS;
export type IntroductionWorldCopy = { readonly [K in IntroductionWorldCopyKey]: string };

/** Every row in both languages with its gate ID, exactly as rendered. */
export const INTRODUCTION_WORLD_COPY_ROWS: Readonly<Record<IntroductionWorldCopyKey, Row>> = Object.freeze(ROWS);

const byLanguage = (language: ChromeLanguage): IntroductionWorldCopy =>
  Object.freeze(Object.fromEntries(Object.entries(ROWS).map(([key, row]) => [key, row[language]])) as IntroductionWorldCopy);
const AR = byLanguage('ar');
const EN = byLanguage('en');

export function introductionWorldCopy(language: ChromeLanguage): IntroductionWorldCopy {
  return language === 'ar' ? AR : EN;
}

/** IW-11 with the first name the server presented to this reader, or IW-11b when it vouches for none. */
export function introductionTitle(copy: IntroductionWorldCopy, firstName: string | null): string {
  return firstName === null ? copy.titleNoName : copy.title.replace('{0}', () => firstName);
}
