/**
 * S4-03 — the Shared lifecycle's words (Manage World, leave, governed removal / settings / World end, sharing earlier
 * messages, the ended World, the former-member own-material page), in ONE place, under ONE Product Copy Gate.
 *
 * Every row carries its source:
 *
 *   - CANON: a frozen Product name — «إدارة العالم» / Manage World and «إعدادات العالم» / World Settings (I-08A4 §8–§9,
 *     "World management", "World settings") — or a Product Owner decision: «عوالم منتهية» / Ended Worlds, the closed
 *     state's name (S4-03 Product Owner decision, 2026-10-05; closure stays READ_ONLY_CLOSED, never deletion);
 *   - REUSED: an already approved row of another surface, imported rather than copied, so it can never drift — the S4-01
 *     Shared rows (Back, Cancel, Try again, "That didn't work right now", "Someone", "You", "In this world", the Shared ID
 *     field, its hint and its correction, Invitations, Accept) and the S4-02 conversation rows (Delete, the deletion
 *     explanation, Delete for everyone, Deleted, Show older messages);
 *   - APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05): the rows S4-03 genuinely needs and no approved surface
 *     has, drawn in the frozen register (I-08A4 §11), stating only what the runtime truthfully does — ten of them in the
 *     Product Owner's own final wording (removal, approval status, add-member, history sharing and World end).
 *
 * The surfaces write no word of their own; a Name is the person's own, never copy.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import { sharedConversationCopy } from './conversation-copy';
import { sharedCopy } from './copy';

export const SHARED_LIFECYCLE_COPY_GATE = {
  status: 'S4-03 PRODUCT COPY GATE — CLOSED — Product Owner, 2026-10-05',
  canon: ['manageWorld', 'worldSettings', 'endedHeading'],
  reused: ['back', 'cancel', 'retry', 'actionUnavailable', 'someone', 'you', 'membersHeading', 'inviteFieldLabel', 'inviteHint',
    'invalidSharedId', 'invitationsHeading', 'accept', 'delete', 'deleteExplanation', 'deleteConfirm', 'deleted', 'olderMessages'],
  approved: ['nameLabel', 'descriptionLabel', 'topicLabel', 'notSet', 'proposeChange', 'proposeSettingsExplain', 'sendProposal',
    'proposalSent', 'unchanged', 'governanceNotOpen', 'proposalsHeading', 'proposalSettings', 'proposalRemoval', 'proposalEnd',
    'proposalAdd', 'proposalRejoin', 'proposedBy', 'proposedBySelf', 'progress', 'approve', 'approvedWaiting', 'committed', 'invited',
    'stale', 'addMember', 'addMemberExplain', 'sendRequest', 'memberRequestSent', 'memberRequestAdd', 'memberRequestRejoin',
    'proposeRemoval', 'removeExplain', 'confirmRemoval', 'shareExplain', 'shareWith', 'noCandidates', 'previewHeading', 'proposeShare',
    'shareRequestsHeading', 'shareRequest', 'formerShareRequest', 'granted', 'historyNotOpen', 'leave', 'leaveExplain', 'leaveConfirm',
    'left', 'endWorld', 'endExplain', 'endConfirm', 'endedNotice', 'formerRow', 'formerExplain', 'formerEmpty'],
} as const;

export interface SharedLifecycleCopy {
  // CANON
  readonly manageWorld: string;
  readonly worldSettings: string;
  // REUSED
  readonly back: string;
  readonly cancel: string;
  readonly retry: string;
  readonly actionUnavailable: string;
  readonly someone: string;
  readonly you: string;
  readonly membersHeading: string;
  readonly inviteFieldLabel: string;
  readonly inviteHint: string;
  readonly invalidSharedId: string;
  readonly invitationsHeading: string;
  readonly accept: string;
  readonly delete: string;
  readonly deleteExplanation: string;
  readonly deleteConfirm: string;
  readonly deleted: string;
  readonly olderMessages: string;
  // APPROVED
  readonly nameLabel: string;
  readonly descriptionLabel: string;
  readonly topicLabel: string;
  readonly notSet: string;
  readonly proposeChange: string;
  readonly proposeSettingsExplain: string;
  readonly sendProposal: string;
  readonly proposalSent: string;
  readonly unchanged: string;
  readonly governanceNotOpen: string;
  readonly proposalsHeading: string;
  readonly proposalSettings: string;
  readonly proposalRemoval: string;
  readonly proposalEnd: string;
  readonly proposalAdd: string;
  readonly proposalRejoin: string;
  readonly proposedBy: string;
  readonly proposedBySelf: string;
  readonly progress: string;
  readonly approve: string;
  readonly approvedWaiting: string;
  readonly committed: string;
  readonly invited: string;
  readonly stale: string;
  readonly addMember: string;
  readonly addMemberExplain: string;
  readonly sendRequest: string;
  readonly memberRequestSent: string;
  readonly memberRequestAdd: string;
  readonly memberRequestRejoin: string;
  readonly proposeRemoval: string;
  readonly removeExplain: string;
  readonly confirmRemoval: string;
  readonly shareExplain: string;
  readonly shareWith: string;
  readonly noCandidates: string;
  readonly previewHeading: string;
  readonly proposeShare: string;
  readonly shareRequestsHeading: string;
  readonly shareRequest: string;
  readonly formerShareRequest: string;
  readonly granted: string;
  readonly historyNotOpen: string;
  readonly leave: string;
  readonly leaveExplain: string;
  readonly leaveConfirm: string;
  readonly left: string;
  readonly endWorld: string;
  readonly endExplain: string;
  readonly endConfirm: string;
  readonly endedHeading: string;
  readonly endedNotice: string;
  readonly formerRow: string;
  readonly formerExplain: string;
  readonly formerEmpty: string;
}

const AR_OWN = {
  manageWorld: 'إدارة العالم', // CANON — I-08A4 §8 (World management)
  worldSettings: 'إعدادات العالم', // CANON — I-08A4 §8 (World settings)
  endedHeading: 'عوالم منتهية', // CANON — S4-03 Product Owner decision 2026-10-05 (the closed state's name; READ_ONLY_CLOSED, not deletion)
  nameLabel: 'الاسم', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the World's name field
  descriptionLabel: 'الوصف', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  topicLabel: 'الموضوع', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  notSet: 'لم يُحدَّد بعد', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — a setting nobody has committed
  proposeChange: 'اقتراح تغيير', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  proposeSettingsExplain: 'لن يتغيّر شيء إلا إذا وافق كل الأعضاء الحاليين.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — unanimity (CW2-03 §30)
  sendProposal: 'إرسال الاقتراح', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  proposalSent: 'تم إرسال الاقتراح. يحتاج موافقة كل الأعضاء، وأنت منهم.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — a proposal is no approval
  unchanged: 'هذه هي الإعدادات الحالية بالفعل.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  governanceNotOpen: 'إدارة العالم غير متاحة بعد.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the governance scope is closed
  proposalsHeading: 'اقتراحات تنتظر موافقتك', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  proposalSettings: 'تغيير إعدادات العالم', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  proposalRemoval: 'إزالة {0} من هذا العالم', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — {0}: the member's own Name
  proposalEnd: 'إنهاء هذا العالم', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  proposalAdd: 'انضمام شخص جديد إلى هذا العالم', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the target is never named before acceptance
  proposalRejoin: 'عودة عضو سابق إلى هذا العالم', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the target is never named before acceptance
  proposedBy: 'اقتراح من {0}', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — {0}: the proposer's own Name (no authority comes with it)
  proposedBySelf: 'اقتراح منك', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  progress: 'وافق {0} من {1}', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — neutral progress, never who (Arabic word order keeps the digits unambiguous in RTL)
  approve: 'موافقة', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  approvedWaiting: 'تمت موافقتك. ما زال الطلب ينتظر باقي الموافقات المطلوبة.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — never who
  committed: 'تم تطبيق التغيير.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  invited: 'وافق الجميع. ينتظر الطلب الآن قبول الشخص.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — nobody is forced into a World (CW2-03 §16, §28)
  stale: 'لم يعد هذا الاقتراح قائمًا.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — stale topology or a rotated Shared ID, said the same way (CW2-02 §34; P1 §5.3)
  addMember: 'إضافة عضو', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  addMemberExplain: 'تحتاج إضافة عضو جديد موافقة جميع الأعضاء الحاليين، ثم قبول الشخص نفسه. لن تظهر هويته لباقي الأعضاء قبل أن يقبل.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — P1 §5.2; Product Owner decision 2026-10-05
  sendRequest: 'إرسال الطلب', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  memberRequestSent: 'إذا كان هذا المعرّف صحيحًا، سيُطلب من الأعضاء الموافقة.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — names nobody (the S4-01 invitationSent pattern)
  memberRequestAdd: '{0} يقترح انضمامك إلى عالم مشترك، وقد وافق عليه كل أعضائه.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — {0}: the proposer's own Name; nothing of the World before acceptance
  memberRequestRejoin: '{0} يقترح عودتك إلى عالم مشترك كنت فيه، وقد وافق عليها كل أعضائه.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  proposeRemoval: 'اقتراح إزالة عضو', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  removeExplain: 'تحتاج إزالة {0} موافقة جميع الأعضاء الآخرين. لا يحتاج {0} إلى الموافقة، ويبقى كلامه السابق باسمه.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — CW2-03 §25
  confirmRemoval: 'اقتراح إزالة العضو', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  shareExplain: 'لا يرى العضو التاريخ السابق على عضويته تلقائيًا. يمكنك اقتراح مشاركة رسائل سابقة معه، ولا تتم مشاركة أي رسالة إلا بعد اكتمال الموافقات المطلوبة عليها.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — CW2-03 §17–§21
  shareWith: 'مشاركة مع {0}', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  noCandidates: 'لا توجد رسائل سابقة يمكن مشاركتها مع {0}.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  previewHeading: 'سيرى {0} هذه الرسائل فقط:', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the exact preview (CW2-03 §21)
  proposeShare: 'اقتراح المشاركة', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  shareRequestsHeading: 'طلبات مشاركة تحتاج موافقتك', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  shareRequest: 'اقتراح بأن يرى {0} الرسائل السابقة التالية، ويحتاج ذلك إلى موافقتك:', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — only the reader's own words are shown
  formerShareRequest: 'اقتراح بأن يرى عضو في عالم غادرته كلامك السابق هذا. موافقتك لا تعيدك إلى العالم:', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — material authority survives membership (CW2-03 §24); no grantee, no World state
  granted: 'تمت المشاركة.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  historyNotOpen: 'مشاركة الرسائل السابقة غير متاحة بعد.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the history scope is closed
  leave: 'مغادرة هذا العالم', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  leaveExplain: 'ستغادر فورًا، ولن ترى هذا العالم ولا ما يُقال فيه بعد ذلك. يبقى كلامك السابق فيه، ويمكنك حذفه لاحقًا من الإعدادات ← الخصوصية والبيانات.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the consequence before the act (CW2-03 §23–§24)
  leaveConfirm: 'مغادرة', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  left: 'غادرت العالم.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  endWorld: 'إنهاء هذا العالم', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  endExplain: 'ينتهي العالم فقط إذا وافق جميع الأعضاء الحاليين. بعدها يصبح للقراءة فقط، ويظل كل شخص يرى فقط ما كان متاحًا له.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — archival closure (CW2-03 §31–§33)
  endConfirm: 'اقتراح الإنهاء', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  endedNotice: 'انتهى هذا العالم. يمكنك قراءة ما كان متاحًا لك فقط.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — read-only, entitlement only
  formerRow: 'كلامك في عوالم مشتركة غادرتها', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — Privacy & Data row (E2E-G-18)
  formerExplain: 'هذا كلامك أنت فقط. لا يظهر هنا شيء آخر من تلك العوالم.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — no World browsing (CW2-03 §24)
  formerEmpty: 'لا يوجد كلام لك في عوالم غادرتها.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
} as const;

const EN_OWN = {
  manageWorld: 'Manage World', // CANON — I-08A4 §9 (World management)
  worldSettings: 'World Settings', // CANON — I-08A4 §9 (World settings)
  endedHeading: 'Ended Worlds', // CANON — S4-03 Product Owner decision 2026-10-05 (the closed state's name; READ_ONLY_CLOSED, not deletion)
  nameLabel: 'Name', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the World's name field
  descriptionLabel: 'Description', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  topicLabel: 'Topic', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  notSet: 'Not set yet', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — a setting nobody has committed
  proposeChange: 'Propose a change', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  proposeSettingsExplain: 'Nothing changes unless every current member approves.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — unanimity (CW2-03 §30)
  sendProposal: 'Send proposal', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  proposalSent: "Proposal sent. It needs every member's approval, including yours.", // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — a proposal is no approval
  unchanged: 'These are already the current settings.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  governanceNotOpen: "Managing this world isn't available yet.", // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the governance scope is closed
  proposalsHeading: 'Proposals waiting for your approval', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  proposalSettings: 'Change the World Settings', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  proposalRemoval: 'Remove {0} from this world', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — {0}: the member's own Name
  proposalEnd: 'End this world', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  proposalAdd: 'A new person joining this world', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the target is never named before acceptance
  proposalRejoin: 'A former member returning to this world', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the target is never named before acceptance
  proposedBy: 'Proposed by {0}', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — {0}: the proposer's own Name (no authority comes with it)
  proposedBySelf: 'Proposed by you', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  progress: '{0} / {1} approved', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — neutral progress, never who (the Product Owner's own example)
  approve: 'Approve', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  approvedWaiting: 'Your approval is recorded. The request is still waiting for the remaining required approvals.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — never who
  committed: 'The change has been applied.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  invited: 'Everyone approved. The request now waits for the person to accept.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — nobody is forced into a World (CW2-03 §16, §28)
  stale: 'This proposal no longer stands.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — stale topology or a rotated Shared ID, said the same way (CW2-02 §34; P1 §5.3)
  addMember: 'Add a member', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  addMemberExplain: "Adding a new member requires every current member's approval, then the person's own acceptance. Their identity won't be shown to the other members before they accept.", // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — P1 §5.2; Product Owner decision 2026-10-05
  sendRequest: 'Send request', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  memberRequestSent: 'If this Shared ID is right, the members will be asked to approve.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — names nobody (the S4-01 invitationSent pattern)
  memberRequestAdd: '{0} proposed that you join a Shared World, and all its members approved.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — {0}: the proposer's own Name; nothing of the World before acceptance
  memberRequestRejoin: '{0} proposed that you return to a Shared World you were in, and all its members approved.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  proposeRemoval: 'Propose removing a member', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  removeExplain: "Removing {0} requires every other member's approval. {0} doesn't approve the removal, and their earlier words remain under their name.", // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — CW2-03 §25
  confirmRemoval: 'Propose removal', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  shareExplain: "A member doesn't automatically see history from before their membership. You can propose sharing earlier messages with them, and a message is shared only after all required approvals are complete.", // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — CW2-03 §17–§21
  shareWith: 'Share with {0}', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  noCandidates: 'There are no earlier messages to share with {0}.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  previewHeading: '{0} will see only these messages:', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the exact preview (CW2-03 §21)
  proposeShare: 'Propose sharing', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  shareRequestsHeading: 'Sharing requests needing your approval', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  shareRequest: 'A proposal for {0} to see the following earlier messages; your approval is required:', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — only the reader's own words are shown
  formerShareRequest: "A proposal for a member of a world you've left to see these earlier words of yours. Approving doesn't bring you back:", // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — material authority survives membership (CW2-03 §24); no grantee, no World state
  granted: 'Shared.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  historyNotOpen: "Sharing earlier messages isn't available yet.", // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the history scope is closed
  leave: 'Leave this world', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  leaveExplain: "You'll leave right away and won't see this world or anything said in it after that. Your earlier words stay, and you can delete them later from Settings → Privacy & Data.", // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — the consequence before the act (CW2-03 §23–§24)
  leaveConfirm: 'Leave', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  left: 'You left the world.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  endWorld: 'End this world', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  endExplain: 'The world ends only if every current member approves. After that it becomes read-only, and each person can see only what was available to them.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — archival closure (CW2-03 §31–§33)
  endConfirm: 'Propose ending', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
  endedNotice: 'This world has ended. You can only read what was available to you.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — read-only, entitlement only
  formerRow: "Your words in Shared Worlds you've left", // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — Privacy & Data row (E2E-G-18)
  formerExplain: 'These are only your own words. Nothing else from those worlds appears here.', // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — no World browsing (CW2-03 §24)
  formerEmpty: "You have no words in worlds you've left.", // APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
} as const;

function build(language: ChromeLanguage): SharedLifecycleCopy {
  const shared = sharedCopy(language); // REUSED — S4-01 (approved in the S4-01 gate)
  const conversation = sharedConversationCopy(language); // REUSED — S4-02 (approved in the S4-02 gate)
  return Object.freeze({
    back: shared.back, // REUSED — S4-01
    cancel: shared.cancel, // REUSED — S4-01
    retry: shared.retry, // REUSED — S4-01
    actionUnavailable: shared.actionUnavailable, // REUSED — S4-01
    someone: shared.someone, // REUSED — S4-01
    you: shared.you, // REUSED — S4-01
    membersHeading: shared.membersHeading, // REUSED — S4-01
    inviteFieldLabel: shared.inviteFieldLabel, // REUSED — S4-01 (the Shared ID field)
    inviteHint: shared.inviteHint, // REUSED — S4-01 (the W3-PDG-01 §4 pattern)
    invalidSharedId: shared.invalidSharedId, // REUSED — S4-01
    invitationsHeading: shared.invitationsHeading, // REUSED — S4-01
    accept: shared.accept, // REUSED — S4-01
    delete: conversation.delete, // REUSED — S4-02
    deleteExplanation: conversation.deleteExplanation, // REUSED — S4-02
    deleteConfirm: conversation.deleteConfirm, // REUSED — S4-02
    deleted: conversation.deleted, // REUSED — S4-02
    olderMessages: conversation.olderMessages, // REUSED — S4-02
    ...(language === 'ar' ? AR_OWN : EN_OWN),
  });
}

const AR = build('ar');
const EN = build('en');

export function sharedLifecycleCopy(language: ChromeLanguage): SharedLifecycleCopy {
  return language === 'ar' ? AR : EN;
}
