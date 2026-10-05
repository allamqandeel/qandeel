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
 *   - PROPOSED — S4-03 Product Copy Gate: the rows S4-03 genuinely needs and no approved surface has. They are drawn in
 *     the frozen register (I-08A4 §11) and state only what the runtime truthfully does; none may ship while PROPOSED.
 *
 * The surfaces write no word of their own; a Name is the person's own, never copy.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import { sharedConversationCopy } from './conversation-copy';
import { sharedCopy } from './copy';

export const SHARED_LIFECYCLE_COPY_GATE = {
  status: 'S4-03 PRODUCT COPY GATE — OPEN (PROPOSED rows await the Product Owner; no remote push while any row is PROPOSED)',
  canon: ['manageWorld', 'worldSettings', 'endedHeading'],
  reused: ['back', 'cancel', 'retry', 'actionUnavailable', 'someone', 'you', 'membersHeading', 'inviteFieldLabel', 'inviteHint',
    'invalidSharedId', 'invitationsHeading', 'accept', 'delete', 'deleteExplanation', 'deleteConfirm', 'deleted', 'olderMessages'],
  proposed: ['nameLabel', 'descriptionLabel', 'topicLabel', 'notSet', 'proposeChange', 'proposeSettingsExplain', 'sendProposal',
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
  // PROPOSED
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
  nameLabel: 'الاسم', // PROPOSED — S4-03 Product Copy Gate — the World's name field
  descriptionLabel: 'الوصف', // PROPOSED — S4-03 Product Copy Gate
  topicLabel: 'الموضوع', // PROPOSED — S4-03 Product Copy Gate
  notSet: 'لم يُحدَّد بعد', // PROPOSED — S4-03 Product Copy Gate — a setting nobody has committed
  proposeChange: 'اقتراح تغيير', // PROPOSED — S4-03 Product Copy Gate
  proposeSettingsExplain: 'لن يتغيّر شيء إلا إذا وافق كل الأعضاء الحاليين.', // PROPOSED — S4-03 Product Copy Gate — unanimity (CW2-03 §30)
  sendProposal: 'إرسال الاقتراح', // PROPOSED — S4-03 Product Copy Gate
  proposalSent: 'تم إرسال الاقتراح. يحتاج موافقة كل الأعضاء، وأنت منهم.', // PROPOSED — S4-03 Product Copy Gate — a proposal is no approval
  unchanged: 'هذه هي الإعدادات الحالية بالفعل.', // PROPOSED — S4-03 Product Copy Gate
  governanceNotOpen: 'إدارة العالم غير متاحة بعد.', // PROPOSED — S4-03 Product Copy Gate — the governance scope is closed
  proposalsHeading: 'اقتراحات تنتظر موافقتك', // PROPOSED — S4-03 Product Copy Gate
  proposalSettings: 'تغيير إعدادات العالم', // PROPOSED — S4-03 Product Copy Gate
  proposalRemoval: 'إخراج {0} من هذا العالم', // PROPOSED — S4-03 Product Copy Gate — {0}: the member's own Name
  proposalEnd: 'إنهاء هذا العالم', // PROPOSED — S4-03 Product Copy Gate
  proposalAdd: 'انضمام شخص جديد إلى هذا العالم', // PROPOSED — S4-03 Product Copy Gate — the target is never named before acceptance
  proposalRejoin: 'عودة عضو سابق إلى هذا العالم', // PROPOSED — S4-03 Product Copy Gate — the target is never named before acceptance
  proposedBy: 'اقتراح من {0}', // PROPOSED — S4-03 Product Copy Gate — {0}: the proposer's own Name (no authority comes with it)
  proposedBySelf: 'اقتراح منك', // PROPOSED — S4-03 Product Copy Gate
  progress: 'وافق {0} من {1}', // PROPOSED — S4-03 Product Copy Gate — neutral progress, never who (Arabic word order keeps the digits unambiguous in RTL)
  approve: 'موافقة', // PROPOSED — S4-03 Product Copy Gate
  approvedWaiting: 'وافقت. ينتظر الاقتراح باقي الأعضاء.', // PROPOSED — S4-03 Product Copy Gate — never who
  committed: 'تم تطبيق التغيير.', // PROPOSED — S4-03 Product Copy Gate
  invited: 'وافق الجميع. ينتظر الطلب الآن قبول الشخص.', // PROPOSED — S4-03 Product Copy Gate — nobody is forced into a World (CW2-03 §16, §28)
  stale: 'لم يعد هذا الاقتراح قائمًا.', // PROPOSED — S4-03 Product Copy Gate — stale topology or a rotated Shared ID, said the same way (CW2-02 §34; P1 §5.3)
  addMember: 'إضافة عضو', // PROPOSED — S4-03 Product Copy Gate
  addMemberExplain: 'يحتاج انضمام أي شخص موافقة كل الأعضاء الحاليين ثم قبوله هو. لن يرى أحد من هو قبل أن يقبل.', // PROPOSED — S4-03 Product Copy Gate — P1 §5.2; Product Owner decision 2026-10-05
  sendRequest: 'إرسال الطلب', // PROPOSED — S4-03 Product Copy Gate
  memberRequestSent: 'إذا كان هذا المعرّف صحيحًا، سيُطلب من الأعضاء الموافقة.', // PROPOSED — S4-03 Product Copy Gate — names nobody (the S4-01 invitationSent pattern)
  memberRequestAdd: '{0} يقترح انضمامك إلى عالم مشترك، وقد وافق عليه كل أعضائه.', // PROPOSED — S4-03 Product Copy Gate — {0}: the proposer's own Name; nothing of the World before acceptance
  memberRequestRejoin: '{0} يقترح عودتك إلى عالم مشترك كنت فيه، وقد وافق عليها كل أعضائه.', // PROPOSED — S4-03 Product Copy Gate
  proposeRemoval: 'اقتراح إخراج', // PROPOSED — S4-03 Product Copy Gate
  removeExplain: 'يحتاج الإخراج موافقة كل الأعضاء الآخرين. لا يُسأل {0}، ويبقى كلامه السابق باسمه.', // PROPOSED — S4-03 Product Copy Gate — CW2-03 §25
  confirmRemoval: 'اقتراح الإخراج', // PROPOSED — S4-03 Product Copy Gate
  shareExplain: 'يرى كل عضو ما قيل منذ انضمامه فقط. يمكنك اقتراح مشاركة رسائل سابقة مع أحدهم، وتحتاج كل رسالة موافقة صاحبها.', // PROPOSED — S4-03 Product Copy Gate — CW2-03 §17–§21
  shareWith: 'مشاركة مع {0}', // PROPOSED — S4-03 Product Copy Gate
  noCandidates: 'لا توجد رسائل سابقة يمكن مشاركتها مع {0}.', // PROPOSED — S4-03 Product Copy Gate
  previewHeading: 'سيرى {0} هذه الرسائل فقط:', // PROPOSED — S4-03 Product Copy Gate — the exact preview (CW2-03 §21)
  proposeShare: 'اقتراح المشاركة', // PROPOSED — S4-03 Product Copy Gate
  shareRequestsHeading: 'طلبات لمشاركة كلامك', // PROPOSED — S4-03 Product Copy Gate
  shareRequest: 'اقتراح بأن يرى {0} كلامك السابق هذا:', // PROPOSED — S4-03 Product Copy Gate — only the reader's own words are shown
  formerShareRequest: 'اقتراح بأن يرى عضو في عالم غادرته كلامك السابق هذا. موافقتك لا تعيدك إلى العالم:', // PROPOSED — S4-03 Product Copy Gate — material authority survives membership (CW2-03 §24); no grantee, no World state
  granted: 'تمت المشاركة.', // PROPOSED — S4-03 Product Copy Gate
  historyNotOpen: 'مشاركة الرسائل السابقة غير متاحة بعد.', // PROPOSED — S4-03 Product Copy Gate — the history scope is closed
  leave: 'مغادرة هذا العالم', // PROPOSED — S4-03 Product Copy Gate
  leaveExplain: 'ستغادر فورًا، ولن ترى هذا العالم ولا ما يُقال فيه بعد ذلك. يبقى كلامك السابق فيه، ويمكنك حذفه لاحقًا من الإعدادات ← الخصوصية والبيانات.', // PROPOSED — S4-03 Product Copy Gate — the consequence before the act (CW2-03 §23–§24)
  leaveConfirm: 'مغادرة', // PROPOSED — S4-03 Product Copy Gate
  left: 'غادرت العالم.', // PROPOSED — S4-03 Product Copy Gate
  endWorld: 'إنهاء هذا العالم', // PROPOSED — S4-03 Product Copy Gate
  endExplain: 'ينتهي العالم فقط إذا وافق كل الأعضاء الحاليين. بعدها لا يُضاف إليه شيء جديد، ويبقى تاريخه للقراءة فقط.', // PROPOSED — S4-03 Product Copy Gate — archival closure (CW2-03 §31–§33)
  endConfirm: 'اقتراح الإنهاء', // PROPOSED — S4-03 Product Copy Gate
  endedNotice: 'انتهى هذا العالم. يمكنك قراءة ما كان متاحًا لك فقط.', // PROPOSED — S4-03 Product Copy Gate — read-only, entitlement only
  formerRow: 'كلامك في عوالم مشتركة غادرتها', // PROPOSED — S4-03 Product Copy Gate — Privacy & Data row (E2E-G-18)
  formerExplain: 'هذا كلامك أنت فقط. لا يظهر هنا شيء آخر من تلك العوالم.', // PROPOSED — S4-03 Product Copy Gate — no World browsing (CW2-03 §24)
  formerEmpty: 'لا يوجد كلام لك في عوالم غادرتها.', // PROPOSED — S4-03 Product Copy Gate
} as const;

const EN_OWN = {
  manageWorld: 'Manage World', // CANON — I-08A4 §9 (World management)
  worldSettings: 'World Settings', // CANON — I-08A4 §9 (World settings)
  endedHeading: 'Ended Worlds', // CANON — S4-03 Product Owner decision 2026-10-05 (the closed state's name; READ_ONLY_CLOSED, not deletion)
  nameLabel: 'Name', // PROPOSED — S4-03 Product Copy Gate — the World's name field
  descriptionLabel: 'Description', // PROPOSED — S4-03 Product Copy Gate
  topicLabel: 'Topic', // PROPOSED — S4-03 Product Copy Gate
  notSet: 'Not set yet', // PROPOSED — S4-03 Product Copy Gate — a setting nobody has committed
  proposeChange: 'Propose a change', // PROPOSED — S4-03 Product Copy Gate
  proposeSettingsExplain: 'Nothing changes unless every current member approves.', // PROPOSED — S4-03 Product Copy Gate — unanimity (CW2-03 §30)
  sendProposal: 'Send proposal', // PROPOSED — S4-03 Product Copy Gate
  proposalSent: "Proposal sent. It needs every member's approval, including yours.", // PROPOSED — S4-03 Product Copy Gate — a proposal is no approval
  unchanged: 'These are already the current settings.', // PROPOSED — S4-03 Product Copy Gate
  governanceNotOpen: "Managing this world isn't available yet.", // PROPOSED — S4-03 Product Copy Gate — the governance scope is closed
  proposalsHeading: 'Proposals waiting for your approval', // PROPOSED — S4-03 Product Copy Gate
  proposalSettings: 'Change the World Settings', // PROPOSED — S4-03 Product Copy Gate
  proposalRemoval: 'Remove {0} from this world', // PROPOSED — S4-03 Product Copy Gate — {0}: the member's own Name
  proposalEnd: 'End this world', // PROPOSED — S4-03 Product Copy Gate
  proposalAdd: 'A new person joining this world', // PROPOSED — S4-03 Product Copy Gate — the target is never named before acceptance
  proposalRejoin: 'A former member returning to this world', // PROPOSED — S4-03 Product Copy Gate — the target is never named before acceptance
  proposedBy: 'Proposed by {0}', // PROPOSED — S4-03 Product Copy Gate — {0}: the proposer's own Name (no authority comes with it)
  proposedBySelf: 'Proposed by you', // PROPOSED — S4-03 Product Copy Gate
  progress: '{0} / {1} approved', // PROPOSED — S4-03 Product Copy Gate — neutral progress, never who (the Product Owner's own example)
  approve: 'Approve', // PROPOSED — S4-03 Product Copy Gate
  approvedWaiting: 'You approved. The proposal is waiting for the other members.', // PROPOSED — S4-03 Product Copy Gate — never who
  committed: 'The change has been applied.', // PROPOSED — S4-03 Product Copy Gate
  invited: 'Everyone approved. The request now waits for the person to accept.', // PROPOSED — S4-03 Product Copy Gate — nobody is forced into a World (CW2-03 §16, §28)
  stale: 'This proposal no longer stands.', // PROPOSED — S4-03 Product Copy Gate — stale topology or a rotated Shared ID, said the same way (CW2-02 §34; P1 §5.3)
  addMember: 'Add a member', // PROPOSED — S4-03 Product Copy Gate
  addMemberExplain: "Anyone joining needs every current member's approval, and then their own acceptance. Nobody sees who they are until they accept.", // PROPOSED — S4-03 Product Copy Gate — P1 §5.2; Product Owner decision 2026-10-05
  sendRequest: 'Send request', // PROPOSED — S4-03 Product Copy Gate
  memberRequestSent: 'If this Shared ID is right, the members will be asked to approve.', // PROPOSED — S4-03 Product Copy Gate — names nobody (the S4-01 invitationSent pattern)
  memberRequestAdd: '{0} proposed that you join a Shared World, and all its members approved.', // PROPOSED — S4-03 Product Copy Gate — {0}: the proposer's own Name; nothing of the World before acceptance
  memberRequestRejoin: '{0} proposed that you return to a Shared World you were in, and all its members approved.', // PROPOSED — S4-03 Product Copy Gate
  proposeRemoval: 'Propose removing', // PROPOSED — S4-03 Product Copy Gate
  removeExplain: "Removal needs every other member's approval. {0} isn't asked, and their earlier words stay under their name.", // PROPOSED — S4-03 Product Copy Gate — CW2-03 §25
  confirmRemoval: 'Propose removal', // PROPOSED — S4-03 Product Copy Gate
  shareExplain: "Each member sees only what was said since they joined. You can propose sharing earlier messages with one of them; each message needs its author's approval.", // PROPOSED — S4-03 Product Copy Gate — CW2-03 §17–§21
  shareWith: 'Share with {0}', // PROPOSED — S4-03 Product Copy Gate
  noCandidates: 'There are no earlier messages to share with {0}.', // PROPOSED — S4-03 Product Copy Gate
  previewHeading: '{0} will see only these messages:', // PROPOSED — S4-03 Product Copy Gate — the exact preview (CW2-03 §21)
  proposeShare: 'Propose sharing', // PROPOSED — S4-03 Product Copy Gate
  shareRequestsHeading: 'Requests to share your words', // PROPOSED — S4-03 Product Copy Gate
  shareRequest: 'A proposal for {0} to see these earlier words of yours:', // PROPOSED — S4-03 Product Copy Gate — only the reader's own words are shown
  formerShareRequest: "A proposal for a member of a world you've left to see these earlier words of yours. Approving doesn't bring you back:", // PROPOSED — S4-03 Product Copy Gate — material authority survives membership (CW2-03 §24); no grantee, no World state
  granted: 'Shared.', // PROPOSED — S4-03 Product Copy Gate
  historyNotOpen: "Sharing earlier messages isn't available yet.", // PROPOSED — S4-03 Product Copy Gate — the history scope is closed
  leave: 'Leave this world', // PROPOSED — S4-03 Product Copy Gate
  leaveExplain: "You'll leave right away and won't see this world or anything said in it after that. Your earlier words stay, and you can delete them later from Settings → Privacy & Data.", // PROPOSED — S4-03 Product Copy Gate — the consequence before the act (CW2-03 §23–§24)
  leaveConfirm: 'Leave', // PROPOSED — S4-03 Product Copy Gate
  left: 'You left the world.', // PROPOSED — S4-03 Product Copy Gate
  endWorld: 'End this world', // PROPOSED — S4-03 Product Copy Gate
  endExplain: 'The world ends only if every current member approves. After that nothing new is added, and its history stays read-only.', // PROPOSED — S4-03 Product Copy Gate — archival closure (CW2-03 §31–§33)
  endConfirm: 'Propose ending', // PROPOSED — S4-03 Product Copy Gate
  endedNotice: 'This world has ended. You can only read what was available to you.', // PROPOSED — S4-03 Product Copy Gate — read-only, entitlement only
  formerRow: "Your words in Shared Worlds you've left", // PROPOSED — S4-03 Product Copy Gate — Privacy & Data row (E2E-G-18)
  formerExplain: 'These are only your own words. Nothing else from those worlds appears here.', // PROPOSED — S4-03 Product Copy Gate — no World browsing (CW2-03 §24)
  formerEmpty: "You have no words in worlds you've left.", // PROPOSED — S4-03 Product Copy Gate
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
