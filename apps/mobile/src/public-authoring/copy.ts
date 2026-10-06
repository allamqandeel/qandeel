/**
 * S5-02 — the Public authoring copy: the controlled publication workspace inside «العالم العام» / Public World.
 *
 * Every string carries its source, as the other surfaces' copy modules do:
 *
 *   - CANON: the destination words «قنديل» / QANDEEL (I-08A4 §8–§9) and «العالم المشترك» / Shared World (G1.2 §3),
 *     read from the Shared copy module rather than retyped; QANDEEL is also the author of QANDEEL-produced Shared text;
 *   - REUSED: words other surfaces already froze for the same fact, read from their own modules: «رجوع» / Back,
 *     «إعادة المحاولة» / Try again, «تعذّر ذلك الآن.» / the neutral action refusal, «أنت» / You (S4-01 Product Copy
 *     Gate), and «الظهور في العالم العام» / Shown in Public World as (S5-01 Product Copy Gate);
 *   - APPROVED — S5-02 PRODUCT COPY GATE, CLOSED — 27 rows APPROVED (Product Owner, 2026-10-06): every genuinely new
 *     string below. No frozen record named a Public Experience, a Draft, a content approval or the review state in Arabic, so none was invented as canon.
 *     They are drawn in the frozen register (I-08A4 §11: calm, plain, no exclamation, no persuasion), including the R1
 *     corrections, and the Product Owner approved all 27 exactly as they appear here.
 *
 * No string says "published" as an achieved state: S5-02 ends at READY_FOR_REVIEW, which is not public. No string says
 * "no one else can see it": a required approver inspects their bounded approval content, so that would be false.
 * An approval is authority over the exact content shown to that human, which may be QANDEEL-produced output rather than
 * their own words; it is never an endorsement of the rest of the Experience (S5-02 R1, G17).
 */
import type { ChromeLanguage } from '../orientation-chrome';
import { fill, sharedCopy } from '../shared-world/copy';
import { publicCopy } from '../public-world/copy';

export const PUBLIC_AUTHORING_COPY_GATE = {
  status: 'S5-02 PRODUCT COPY GATE — CLOSED — 27 rows APPROVED (Product Owner, 2026-10-06)',
  canon: ['qandeel', 'sharedWorld'],
  reused: ['back', 'retry', 'actionUnavailable', 'you', 'shownAs'],
  approved: [
    'entry', 'workspaceTitle', 'draftsHeading', 'noDrafts', 'startDraft', 'draftState', 'readyState', 'chooseHeading',
    'chooseHint', 'noSources', 'review', 'reviewHeading', 'analysisItem', 'approvals', 'waiting', 'approveShown',
    'approvalScope', 'approved', 'withdraw', 'withdrawn', 'markReady', 'approvalsIncomplete', 'notPublishable',
    'noLongerAvailable', 'requestsHeading', 'requestFrom', 'approvalContent',
  ],
  proposed: [],
} as const;

export interface PublicAuthoringCopy {
  /** The Public World root's way into the workspace. */
  readonly entry: string;
  readonly workspaceTitle: string;
  readonly draftsHeading: string;
  readonly noDrafts: string;
  readonly startDraft: string;
  /** A Draft's state line: not public. */
  readonly draftState: string;
  /** READY_FOR_REVIEW's state line: not public, never "published". */
  readonly readyState: string;
  readonly chooseHeading: string;
  readonly chooseHint: string;
  readonly noSources: string;
  readonly review: string;
  readonly reviewHeading: string;
  /** The label of an item that is QANDEEL's analysis rather than a human's words. */
  readonly analysisItem: string;
  /** "{0} of {1}" approvals. */
  readonly approvals: string;
  readonly waiting: string;
  /** Approval of exactly the content shown to this human — not "my words": it may be QANDEEL-produced output. */
  readonly approveShown: string;
  /** The approval's scope: the content shown only, never the rest of the Experience. */
  readonly approvalScope: string;
  readonly approved: string;
  readonly withdraw: string;
  readonly withdrawn: string;
  readonly markReady: string;
  readonly approvalsIncomplete: string;
  readonly notPublishable: string;
  /** A package that is no longer whole: one explicit stale state, never a partial package. */
  readonly noLongerAvailable: string;
  readonly requestsHeading: string;
  /** "Requested by {0}" — the publisher's PUBLIC display only. */
  readonly requestFrom: string;
  /** The exact included content requiring this human's approval. */
  readonly approvalContent: string;
  readonly qandeel: string;
  readonly sharedWorld: string;
  readonly back: string;
  readonly retry: string;
  readonly actionUnavailable: string;
  readonly you: string;
  readonly shownAs: string;
}

const AR = {
  entry: 'مشاركة تجربة في العالم العام', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  workspaceTitle: 'مسوداتك في العالم العام', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  draftsHeading: 'المسودات', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  noDrafts: 'لا توجد مسودات بعد.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  startDraft: 'بدء مسودة من محتوى موجود', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  draftState: 'مسودة. لم تُنشر بعد.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  readyState: 'جاهزة للمراجعة. لم تُنشر بعد.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  chooseHeading: 'اختر ما سيصبح عامًا', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  chooseHint: 'من كلامك في قنديل، ومما تراه في عوالمك المشتركة. حتى 20 عنصرًا.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  noSources: 'لا يوجد محتوى يمكنك مشاركته بعد.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  review: 'مراجعة ما سيصبح عامًا', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  reviewHeading: 'ما سيصبح عامًا', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  analysisItem: 'تحليل قنديل', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  approvals: 'الموافقات: {0} من {1}', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  waiting: 'بانتظار الموافقات المطلوبة.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  approveShown: 'أوافق على أن يصبح المحتوى المعروض هنا عامًا', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  approvalScope: 'موافقتك تخص المحتوى المعروض هنا فقط، ولا تعني موافقتك على باقي محتوى التجربة.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  approved: 'موافقتك مسجّلة.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  withdraw: 'سحب موافقتي', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  withdrawn: 'سُحبت موافقتك.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  markReady: 'تجهيز للمراجعة', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  approvalsIncomplete: 'لا تزال موافقات مطلوبة.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  notPublishable: 'لا يمكن مشاركة هذا في العالم العام.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  noLongerAvailable: 'لم تعد هذه المسودة متاحة كما أُعدّت.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  requestsHeading: 'طلبات تحتاج موافقتك', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  requestFrom: 'طلب من {0}', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  approvalContent: 'المحتوى الذي يحتاج موافقتك', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
} as const;

const EN = {
  entry: 'Share an experience in Public World', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  workspaceTitle: 'Your Public World drafts', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  draftsHeading: 'Drafts', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  noDrafts: 'No drafts yet.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  startDraft: 'Start a draft from existing content', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  draftState: 'Draft. Not published yet.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  readyState: 'Ready for review. Not published yet.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  chooseHeading: 'Choose what would become public', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  chooseHint: 'From your words in QANDEEL and what you can see in your Shared Worlds. Up to 20 items.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  noSources: 'There is no content you can share yet.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  review: 'Review what would become public', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  reviewHeading: 'What would become public', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  analysisItem: 'QANDEEL analysis', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  approvals: 'Approvals: {0} of {1}', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  waiting: 'Waiting for the required approvals.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  approveShown: 'I approve making the content shown here public', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  approvalScope: 'Your approval applies only to the content shown here; it does not approve the rest of the experience.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  approved: 'Your agreement is recorded.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  withdraw: 'Withdraw my agreement', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  withdrawn: 'Your agreement was withdrawn.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  markReady: 'Mark ready for review', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  approvalsIncomplete: 'Approvals are still needed.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  notPublishable: "This can't be shared in Public World.", // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  noLongerAvailable: 'This draft is no longer available as it was prepared.', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  requestsHeading: 'Requests needing your approval', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  requestFrom: 'Requested by {0}', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
  approvalContent: 'Content requiring your approval', // APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06)
} as const;

export function publicAuthoringCopy(language: ChromeLanguage): PublicAuthoringCopy {
  const shared = sharedCopy(language);
  const publicWorld = publicCopy(language);
  const own = language === 'ar' ? AR : EN;
  return Object.freeze({
    ...own,
    qandeel: shared.personalWorld, // CANON — I-08A4 §8–§9, through the Shared copy module
    sharedWorld: shared.sharedWorld, // CANON — G1.2 §3
    back: shared.back, // REUSED — S4-01 Product Copy Gate
    retry: shared.retry, // REUSED — S4-01 Product Copy Gate
    actionUnavailable: shared.actionUnavailable, // REUSED — S4-01 Product Copy Gate
    you: shared.you, // REUSED — S4-01 Product Copy Gate
    shownAs: publicWorld.displayHeading, // REUSED — S5-01 Product Copy Gate
  });
}

export { fill };
