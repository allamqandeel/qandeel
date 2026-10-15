/**
 * S6-04 — the words of a human's private Introduction proposals («مقترحات التعارف»): the quiet arrival, the space, the
 * neutral card, the review, the decisions and their confirmations, and every neutral state.
 *
 * Fixed Arabic is simplified Modern Standard Arabic and gender-considerate (the Product Owner's language rule, WP0 record
 * §14.1; GATE-28; D12): where a second-person verb would mark gender, the row uses a noun or a form spelled alike for
 * both. No Arabic row carries a Latin letter, so no English word can be reordered inside Arabic text. English is a
 * separate version, reviewed separately.
 *
 * The Product Owner closed the S6-04 Product Copy Gate on 2026-10-15 (CG-1, CG-3 to CG-7 approved as proposed). M-03 (the
 * LANG-01 / G2.3 controlled amendment) is used verbatim. M-01 is kept exactly as approved but is NOT displayed in S6-04
 * (CG-2): a stored permitted conclusion alone does not prove QANDEEL's genuine understanding of both people, so its future
 * use is conditional on real Stage 8A evidence, and nothing replaces it with an unproven compatibility claim. M-02
 * («نقاط اتفاق كثيرة») is not used: no genuine permitted conclusion is presented before Mutual Match (CW2-06B-07 / -08).
 */
import type { ChromeLanguage } from '../orientation-chrome';

/** LANG-01 / G2.3 controlled amendment §2.1 (M-01) and §2.3 (M-03), exact, approved by the Product Owner. M-01 is kept, not displayed (CG-2). */
export const PROPOSALS_LANG01_APPROVED = Object.freeze({
  M01: 'يرى قنديل، بناءً على فهمه لكلٍّ منكما، أن هناك شخصًا يستحق التعرّف إليه، وأن بينكما مساحة تستحق الاستكشاف معًا.',
  M03: 'خصوصيتك محفوظة. لن تُعرض بياناتك وتحليلاتك الخاصة على الطرف الآخر، ولن يُشارَك منها شيء إلا باختيارك. وسيكون قنديل معك خطوة بخطوة، حرصًا على راحتك وطمأنينتك.',
});

export const PROPOSALS_COPY_GATE = {
  status: 'S6-04 PRODUCT COPY GATE — CLOSED — every displayed row APPROVED by the Product Owner on 2026-10-15; M-01 kept, not displayed (CG-2)',
  /** LANG-01 approved Arabic used verbatim, in the context the Product Owner approved (CG-3). */
  lang01Verbatim: [['M-03', 'privacy']],
  /** LANG-01 approved, kept exactly, NOT displayed in S6-04: its use waits for real Stage 8A evidence (CG-2). */
  retainedNotDisplayed: ['M-01'],
  /** LANG-01 approved wording deliberately not used (CW2-06B-08). */
  notUsed: ['M-02'],
  /** The Task Contract's approved Arabic directions used as written. */
  contractDirections: ['arrival', 'forwardNotYet', 'declineAction', 'withdrawAction', 'confirmAllow', 'inProgressBody', 'unavailableBody', 'empty'],
  /** The contract's colloquial review line «راجع المقترح وخد قرارك براحتك», replaced by a simplified-MSA proposal. */
  editorialReplacement: [['راجع المقترح وخد قرارك براحتك', 'reviewLead']],
} as const;

type Pair = { readonly ar: string; readonly en: string };
const ROWS = {
  // The space and its entry
  spaceTitle: { ar: 'مقترحات التعارف', en: 'Introduction proposals' }, // APPROVED (Product Owner, 2026-10-15)
  arrival: { ar: 'لديك مقترح تعارف خاص يمكنك مراجعته.', en: 'You have a private introduction proposal to review.' }, // APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written)
  openSpace: { ar: 'عرض المقترحات', en: 'View proposals' }, // APPROVED (Product Owner, 2026-10-15)
  spaceIntro: { ar: 'هذه مقترحات التعارف الخاصة التي قدّمها لك قنديل. لا يراها أحد غيرك.', en: 'These are the private introduction proposals QANDEEL has made to you. No one else sees them.' }, // APPROVED (Product Owner, 2026-10-15)
  empty: { ar: 'لا توجد مقترحات لمراجعتها حاليًا.', en: 'There are no proposals to review right now.' }, // APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written)
  loading: { ar: 'جارٍ عرض المقترحات…', en: 'Loading proposals…' }, // APPROVED (Product Owner, 2026-10-15)
  unavailable: { ar: 'تعذّر عرض المقترحات الآن.', en: "Proposals can't be shown right now." }, // APPROVED (Product Owner, 2026-10-15)
  offline: { ar: 'لا يوجد اتصال الآن. يمكنك المحاولة مرة أخرى عند عودة الاتصال.', en: "You're offline. You can try again once you're back online." }, // APPROVED (Product Owner, 2026-10-15)
  tryAgain: { ar: 'إعادة المحاولة', en: 'Try again' }, // APPROVED (Product Owner, 2026-10-15)
  more: { ar: 'عرض المزيد', en: 'Show more' }, // APPROVED (Product Owner, 2026-10-15)
  back: { ar: 'رجوع', en: 'Back' }, // APPROVED (Product Owner, 2026-10-15)
  // The neutral card: the existence of a private opportunity and its permitted status, nothing about the other person
  cardTitle: { ar: 'مقترح تعارف خاص', en: 'Private introduction proposal' }, // APPROVED (Product Owner, 2026-10-15)
  AWAITING_YOU: { ar: 'بانتظار قرارك', en: 'Waiting for your decision' }, // APPROVED (Product Owner, 2026-10-15)
  IN_PROGRESS: { ar: 'قيد المتابعة', en: 'In progress' }, // APPROVED (Product Owner, 2026-10-15)
  CLOSED_BY_YOU: { ar: 'انتهى بقرارك', en: 'Ended by your decision' }, // APPROVED (Product Owner, 2026-10-15)
  NO_LONGER_AVAILABLE: { ar: 'لم يعد متاحًا', en: 'No longer available' }, // APPROVED (Product Owner, 2026-10-15)
  MATCH_CONCLUDED: { ar: 'انتقل إلى مرحلة التعارف', en: 'Moved on to an introduction' }, // APPROVED (Product Owner, 2026-10-15)
  // The review
  reviewLead: { ar: 'يمكنك مراجعة المقترح واتخاذ قرارك على مهل.', en: 'Review the proposal and take your time to decide.' }, // APPROVED (Product Owner, 2026-10-15) — MSA replacement of the contract's colloquial line
  qandeelRole: { ar: 'يقترح قنديل ولا يقرر عنك؛ القرار لك في كل خطوة.', en: 'QANDEEL suggests; it never decides for you. Every step is your choice.' }, // APPROVED (Product Owner, 2026-10-15)
  privacy: { ar: PROPOSALS_LANG01_APPROVED.M03, en: "Your privacy is protected. Your private data and analysis won't be shown to the other person, and nothing is shared unless you choose. QANDEEL will be with you step by step, for your comfort and peace of mind." }, // APPROVED — LANG-01 M-03 (Arabic, verbatim); context and English approved (CG-3, CG-6)
  // Forward approval (D5): permission for one independent private proposal to the other person, never a Mutual Match
  forwardTitle: { ar: 'ماذا يعني السماح؟', en: 'What does allowing mean?' }, // APPROVED (Product Owner, 2026-10-15)
  forwardMeaning: { ar: 'إذا سمحت بذلك، يقدّم قنديل للطرف الآخر مقترحًا خاصًا ومستقلًا.', en: 'If you allow it, QANDEEL makes the other person a separate, private proposal.' }, // APPROVED (Product Owner, 2026-10-15)
  forwardNotYet: { ar: 'هذه الخطوة لا تبدأ التعارف الآن.', en: "This step doesn't start an introduction yet." }, // APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written)
  forwardMutual: { ar: 'لا يبدأ التعارف إلا إذا وافق الطرفان.', en: 'An introduction begins only if you both agree.' }, // APPROVED (Product Owner, 2026-10-15)
  forwardWithdrawNote: { ar: 'يمكنك سحب موافقتك لاحقًا ما دام التعارف لم يبدأ.', en: "You can withdraw your approval later, as long as the introduction hasn't begun." }, // APPROVED (Product Owner, 2026-10-15)
  allowAction: { ar: 'السماح بتقديم المقترح', en: 'Allow the proposal' }, // APPROVED (Product Owner, 2026-10-15)
  confirmTitle: { ar: 'قبل التأكيد', en: 'Before you confirm' }, // APPROVED (Product Owner, 2026-10-15)
  confirmAllow: { ar: 'أسمح لقنديل بتقديم مقترح خاص ومستقل للطرف الآخر', en: 'I allow QANDEEL to make the other person a separate, private proposal' }, // APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written)
  // Decline (D6): no reason, no pressure
  declineAction: { ar: 'لا أرغب في متابعة هذا المقترح', en: "I don't want to continue with this proposal" }, // APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written)
  confirmDeclineBody: { ar: 'سينتهي هذا المقترح، ولن يُطلب منك ذكر أي سبب.', en: "This proposal will end. You won't be asked for a reason." }, // APPROVED (Product Owner, 2026-10-15)
  confirm: { ar: 'تأكيد', en: 'Confirm' }, // APPROVED (Product Owner, 2026-10-15)
  // The second recipient (D8): decline only; acceptance is S6-05
  acceptNotYet: { ar: 'خيار بدء التعارف من هذا المقترح غير متاح بعد.', en: "Starting an introduction from this proposal isn't available yet." }, // APPROVED (Product Owner, 2026-10-15)
  decisionsPaused: { ar: 'لا يمكن اتخاذ قرار في هذا المقترح الآن.', en: "Decisions on this proposal aren't available right now." }, // APPROVED (Product Owner, 2026-10-15)
  // In progress, and withdrawal (D7)
  inProgressBody: { ar: 'تم تسجيل قرارك. المقترح قيد المتابعة.', en: 'Your decision is recorded. The proposal is in progress.' }, // APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written)
  withdrawAction: { ar: 'أريد سحب موافقتي على متابعة المقترح', en: 'I want to withdraw my approval of this proposal' }, // APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written)
  confirmWithdrawBody: { ar: 'إذا سحبت موافقتك، ينتهي هذا المقترح ولن يُتابَع، ولا يمكن التراجع عن ذلك.', en: "If you withdraw your approval, this proposal ends and won't continue. This can't be undone." }, // APPROVED (Product Owner, 2026-10-15)
  // Endings, said neutrally (D9)
  closedBody: { ar: 'انتهى هذا المقترح بقرارك.', en: 'This proposal ended by your decision.' }, // APPROVED (Product Owner, 2026-10-15)
  unavailableBody: { ar: 'لم يعد هذا المقترح متاحًا.', en: 'This proposal is no longer available.' }, // APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written)
  concludedBody: { ar: 'انتقل هذا المقترح إلى مرحلة التعارف.', en: 'This proposal has moved on to an introduction.' }, // APPROVED (Product Owner, 2026-10-15)
  // After a decision (D10)
  recordedDecline: { ar: 'تم تسجيل قرارك. لن يُتابَع هذا المقترح.', en: "Your decision is recorded. This proposal won't continue." }, // APPROVED (Product Owner, 2026-10-15)
  recordedWithdraw: { ar: 'تم سحب موافقتك. لن يُتابَع هذا المقترح.', en: "Your approval is withdrawn. This proposal won't continue." }, // APPROVED (Product Owner, 2026-10-15)
  changed: { ar: 'تغيّر هذا المقترح أثناء مراجعتك. يمكنك مراجعته مرة أخرى.', en: 'This proposal changed while you were reviewing it. You can review it again.' }, // APPROVED (Product Owner, 2026-10-15)
  notNow: { ar: 'لا يمكن اتخاذ هذا القرار الآن. يمكنك المحاولة لاحقًا.', en: "This decision can't be made right now. You can try again later." }, // APPROVED (Product Owner, 2026-10-15)
  failed: { ar: 'تعذّر إرسال قرارك. يمكنك المحاولة مرة أخرى.', en: "Your decision couldn't be sent. You can try again." }, // APPROVED (Product Owner, 2026-10-15)
  invalid: { ar: 'تعذّر تنفيذ هذا الطلب.', en: "This request couldn't be completed." }, // APPROVED (Product Owner, 2026-10-15)
} satisfies Record<string, Pair>;

export type ProposalsCopyKey = keyof typeof ROWS;
export type ProposalsCopy = { readonly [K in ProposalsCopyKey]: string };

/** Every row in both languages, exactly as rendered (the Copy Gate package is generated from this). */
export const PROPOSALS_COPY_ROWS: Readonly<Record<ProposalsCopyKey, Pair>> = Object.freeze(ROWS);

const byLanguage = (language: ChromeLanguage): ProposalsCopy =>
  Object.freeze(Object.fromEntries(Object.entries(ROWS).map(([key, pair]) => [key, pair[language]])) as ProposalsCopy);
const AR = byLanguage('ar');
const EN = byLanguage('en');

export function proposalsCopy(language: ChromeLanguage): ProposalsCopy {
  return language === 'ar' ? AR : EN;
}
