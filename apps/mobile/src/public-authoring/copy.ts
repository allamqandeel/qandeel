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
 *   - PROPOSED — S5-02 PRODUCT COPY GATE: every genuinely new string below. No frozen record names a Public Experience,
 *     a Draft, a content approval or the review state in Arabic, so none is invented as canon. They are drawn in the
 *     frozen register (I-08A4 §11: calm, plain, no exclamation, no persuasion) and await the Product Owner. The PR is not
 *     Product-complete until they are decided.
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
  status: 'S5-02 PRODUCT COPY GATE — OPEN (rows PROPOSED for Product Owner review)',
  canon: ['qandeel', 'sharedWorld'],
  reused: ['back', 'retry', 'actionUnavailable', 'you', 'shownAs'],
  approved: [],
  proposed: [
    'entry', 'workspaceTitle', 'draftsHeading', 'noDrafts', 'startDraft', 'draftState', 'readyState', 'chooseHeading',
    'chooseHint', 'noSources', 'review', 'reviewHeading', 'analysisItem', 'approvals', 'waiting', 'approveShown',
    'approvalScope', 'approved', 'withdraw', 'withdrawn', 'markReady', 'approvalsIncomplete', 'notPublishable',
    'noLongerAvailable', 'requestsHeading', 'requestFrom', 'approvalContent',
  ],
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
  entry: 'مشاركة تجربة في العالم العام', // PROPOSED — S5-02 Product Copy Gate
  workspaceTitle: 'مسوداتك في العالم العام', // PROPOSED — S5-02 Product Copy Gate
  draftsHeading: 'المسودات', // PROPOSED — S5-02 Product Copy Gate
  noDrafts: 'لا توجد مسودات بعد.', // PROPOSED — S5-02 Product Copy Gate
  startDraft: 'بدء مسودة من محتوى موجود', // PROPOSED — S5-02 Product Copy Gate
  draftState: 'مسودة. لم تُنشر بعد.', // PROPOSED — S5-02 Product Copy Gate
  readyState: 'جاهزة للمراجعة. لم تُنشر بعد.', // PROPOSED — S5-02 Product Copy Gate
  chooseHeading: 'اختر ما سيصبح عامًا', // PROPOSED — S5-02 Product Copy Gate
  chooseHint: 'من كلامك في قنديل، ومما تراه في عوالمك المشتركة. حتى 20 عنصرًا.', // PROPOSED — S5-02 Product Copy Gate
  noSources: 'لا يوجد محتوى يمكنك مشاركته بعد.', // PROPOSED — S5-02 Product Copy Gate
  review: 'مراجعة ما سيصبح عامًا', // PROPOSED — S5-02 Product Copy Gate
  reviewHeading: 'ما سيصبح عامًا', // PROPOSED — S5-02 Product Copy Gate
  analysisItem: 'تحليل قنديل', // PROPOSED — S5-02 Product Copy Gate
  approvals: 'الموافقات: {0} من {1}', // PROPOSED — S5-02 Product Copy Gate
  waiting: 'بانتظار الموافقات المطلوبة.', // PROPOSED — S5-02 Product Copy Gate
  approveShown: 'أوافق على أن يصبح المحتوى المعروض هنا عامًا', // PROPOSED — S5-02 Product Copy Gate
  approvalScope: 'موافقتك تخص المحتوى المعروض هنا فقط، ولا تعني موافقتك على باقي محتوى التجربة.', // PROPOSED — S5-02 Product Copy Gate
  approved: 'موافقتك مسجّلة.', // PROPOSED — S5-02 Product Copy Gate
  withdraw: 'سحب موافقتي', // PROPOSED — S5-02 Product Copy Gate
  withdrawn: 'سُحبت موافقتك.', // PROPOSED — S5-02 Product Copy Gate
  markReady: 'تجهيز للمراجعة', // PROPOSED — S5-02 Product Copy Gate
  approvalsIncomplete: 'لا تزال موافقات مطلوبة.', // PROPOSED — S5-02 Product Copy Gate
  notPublishable: 'لا يمكن مشاركة هذا في العالم العام.', // PROPOSED — S5-02 Product Copy Gate
  noLongerAvailable: 'لم تعد هذه المسودة متاحة كما أُعدّت.', // PROPOSED — S5-02 Product Copy Gate
  requestsHeading: 'طلبات تحتاج موافقتك', // PROPOSED — S5-02 Product Copy Gate
  requestFrom: 'طلب من {0}', // PROPOSED — S5-02 Product Copy Gate
  approvalContent: 'المحتوى الذي يحتاج موافقتك', // PROPOSED — S5-02 Product Copy Gate
} as const;

const EN = {
  entry: 'Share an experience in Public World', // PROPOSED — S5-02 Product Copy Gate
  workspaceTitle: 'Your Public World drafts', // PROPOSED — S5-02 Product Copy Gate
  draftsHeading: 'Drafts', // PROPOSED — S5-02 Product Copy Gate
  noDrafts: 'No drafts yet.', // PROPOSED — S5-02 Product Copy Gate
  startDraft: 'Start a draft from existing content', // PROPOSED — S5-02 Product Copy Gate
  draftState: 'Draft. Not published yet.', // PROPOSED — S5-02 Product Copy Gate
  readyState: 'Ready for review. Not published yet.', // PROPOSED — S5-02 Product Copy Gate
  chooseHeading: 'Choose what would become public', // PROPOSED — S5-02 Product Copy Gate
  chooseHint: 'From your words in QANDEEL and what you can see in your Shared Worlds. Up to 20 items.', // PROPOSED — S5-02 Product Copy Gate
  noSources: 'There is no content you can share yet.', // PROPOSED — S5-02 Product Copy Gate
  review: 'Review what would become public', // PROPOSED — S5-02 Product Copy Gate
  reviewHeading: 'What would become public', // PROPOSED — S5-02 Product Copy Gate
  analysisItem: 'QANDEEL analysis', // PROPOSED — S5-02 Product Copy Gate
  approvals: 'Approvals: {0} of {1}', // PROPOSED — S5-02 Product Copy Gate
  waiting: 'Waiting for the required approvals.', // PROPOSED — S5-02 Product Copy Gate
  approveShown: 'I approve making the content shown here public', // PROPOSED — S5-02 Product Copy Gate
  approvalScope: 'Your approval applies only to the content shown here; it does not approve the rest of the experience.', // PROPOSED — S5-02 Product Copy Gate
  approved: 'Your agreement is recorded.', // PROPOSED — S5-02 Product Copy Gate
  withdraw: 'Withdraw my agreement', // PROPOSED — S5-02 Product Copy Gate
  withdrawn: 'Your agreement was withdrawn.', // PROPOSED — S5-02 Product Copy Gate
  markReady: 'Mark ready for review', // PROPOSED — S5-02 Product Copy Gate
  approvalsIncomplete: 'Approvals are still needed.', // PROPOSED — S5-02 Product Copy Gate
  notPublishable: "This can't be shared in Public World.", // PROPOSED — S5-02 Product Copy Gate
  noLongerAvailable: 'This draft is no longer available as it was prepared.', // PROPOSED — S5-02 Product Copy Gate
  requestsHeading: 'Requests needing your approval', // PROPOSED — S5-02 Product Copy Gate
  requestFrom: 'Requested by {0}', // PROPOSED — S5-02 Product Copy Gate
  approvalContent: 'Content requiring your approval', // PROPOSED — S5-02 Product Copy Gate
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
