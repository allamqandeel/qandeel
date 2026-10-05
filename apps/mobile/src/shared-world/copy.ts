/**
 * S4-01 — the «العالم المشترك» / Shared World copy, and the Global Switcher's two destination words.
 *
 * Every string carries its source, as the other surfaces' copy modules do:
 *
 *   - CANON: frozen Product names — «قنديل» / QANDEEL (I-08A4 §8–§9, the Personal destination) and «العالم المشترك» /
 *     Shared World (G1.2 §3, singular regardless of count);
 *   - APPROVED: the S4-01 Task Contract's Product Owner-approved meanings — the invitation (§1.3) with the inviter's
 *     real Name, and the first-entry welcome (§1.6);
 *   - APPROVED — S4-01 Product Copy Gate: everything else, drawn in the frozen register (I-08A4 §11) and approved by the
 *     Product Owner when the gate closed (2026-10-05), three rows with the Product Owner's amendments (the declined
 *     notice, the malformed-ID notice, the switcher's accessible name). Each states only what the runtime truthfully
 *     does (the invitation confirmation, for example, never says a person was found). No row is PROPOSED.
 */
import type { ChromeLanguage } from '../orientation-chrome';

export const SHARED_COPY_GATE = {
  status: 'S4-01 PRODUCT COPY GATE — CLOSED (2026-10-05: every row CANON or APPROVED; none PROPOSED)',
  approved: ['invitation', 'welcome'],
  amended: ['declined', 'invalidSharedId', 'switcherLabel'],
  proposed: [],
  canon: ['personalWorld', 'sharedWorld'],
} as const;

export interface SharedCopy {
  readonly personalWorld: string;
  readonly sharedWorld: string;
  readonly switcherLabel: string;
  readonly invitation: string;
  readonly someone: string;
  readonly welcome: string;
  readonly back: string;
  readonly createWorld: string;
  readonly inviteFieldLabel: string;
  readonly inviteHint: string;
  readonly sendInvitation: string;
  readonly cancel: string;
  readonly invitationSent: string;
  readonly invalidSharedId: string;
  readonly notOpen: string;
  readonly actionUnavailable: string;
  readonly retry: string;
  readonly invitationsHeading: string;
  readonly worldsHeading: string;
  readonly noWorlds: string;
  readonly accept: string;
  readonly decline: string;
  readonly declined: string;
  readonly opening: string;
  readonly worldUnavailable: string;
  readonly membersHeading: string;
  readonly you: string;
  readonly and: string;
  readonly yourSharedId: string;
  readonly sharedIdPrivacy: string;
  readonly copy: string;
  readonly copied: string;
  readonly regenerate: string;
  readonly regenerateWarning: string;
  readonly regenerateConfirm: string;
  readonly sharedIdNotOpen: string;
}

const AR: SharedCopy = {
  personalWorld: 'قنديل', // CANON — I-08A4 §8
  sharedWorld: 'العالم المشترك', // CANON — G1.2 §3
  switcherLabel: 'التنقل بين قنديل والعالم المشترك', // APPROVED — S4-01 Product Copy Gate (Product Owner amendment) — accessible name only
  invitation: '{0} يدعوك لإنشاء عالم مشترك بينكما ومع قنديل.', // APPROVED — S4-01 §1.3
  someone: 'شخص ما', // APPROVED — S4-01 Product Copy Gate
  welcome: 'أهلًا بكما. هذا عالمكما المشترك معي.', // APPROVED — S4-01 §1.6
  back: 'رجوع', // APPROVED — S4-01 Product Copy Gate
  createWorld: 'إنشاء عالم مشترك', // APPROVED — S4-01 Product Copy Gate
  inviteFieldLabel: 'المعرّف المشترك للشخص الآخر', // APPROVED — S4-01 Product Copy Gate
  inviteHint: 'XXXX-XXXX-XXXX', // the W3-PDG-01 §4 pattern
  sendInvitation: 'إرسال الدعوة', // APPROVED — S4-01 Product Copy Gate
  cancel: 'إلغاء', // APPROVED — S4-01 Product Copy Gate
  invitationSent: 'إذا كان هذا المعرّف صحيحًا، ستصل الدعوة إلى صاحبه.', // APPROVED — S4-01 Product Copy Gate — names nobody
  invalidSharedId: 'تأكد من المعرّف المشترك وحاول مرة أخرى.', // APPROVED — S4-01 Product Copy Gate (Product Owner amendment)
  notOpen: 'العالم المشترك غير متاح بعد.', // APPROVED — S4-01 Product Copy Gate
  actionUnavailable: 'تعذّر ذلك الآن.', // APPROVED — S4-01 Product Copy Gate
  retry: 'إعادة المحاولة', // APPROVED — S4-01 Product Copy Gate
  invitationsHeading: 'الدعوات', // APPROVED — S4-01 Product Copy Gate
  worldsHeading: 'العوالم', // APPROVED — S4-01 Product Copy Gate
  noWorlds: 'لا توجد عوالم مشتركة بعد.', // APPROVED — S4-01 Product Copy Gate
  accept: 'قبول', // APPROVED — S4-01 Product Copy Gate
  decline: 'رفض', // APPROVED — S4-01 Product Copy Gate
  declined: 'تم رفض الدعوة.', // APPROVED — S4-01 Product Copy Gate (Product Owner amendment)
  opening: 'جارٍ الفتح', // APPROVED — S4-01 Product Copy Gate — the pre-authority shell's accessible name only
  worldUnavailable: 'هذا غير متاح الآن.', // APPROVED — S4-01 Product Copy Gate — neutral; reveals nothing
  membersHeading: 'في هذا العالم', // APPROVED — S4-01 Product Copy Gate
  you: 'أنت', // APPROVED — S4-01 Product Copy Gate
  and: ' و', // APPROVED — S4-01 Product Copy Gate — joins two Names
  yourSharedId: 'المعرّف المشترك', // APPROVED — S4-01 Product Copy Gate
  sharedIdPrivacy: 'معرّفك المشترك خاص. شاركه فقط مع من تريد أن يستطيع دعوتك إلى عالم مشترك.', // APPROVED — S4-01 Product Copy Gate
  copy: 'نسخ', // APPROVED — S4-01 Product Copy Gate
  copied: 'تم النسخ', // APPROVED — S4-01 Product Copy Gate
  regenerate: 'إنشاء معرّف جديد', // APPROVED — S4-01 Product Copy Gate
  regenerateWarning: 'سيتوقف معرّفك الحالي عن العمل، ولن تصل إليك الدعوات المرسلة إليه التي لم تقبلها بعد. عوالمك المشتركة الحالية لن تتأثر.', // APPROVED — S4-01 Product Copy Gate
  regenerateConfirm: 'إنشاء معرّف جديد', // APPROVED — S4-01 Product Copy Gate
  sharedIdNotOpen: 'سيظهر معرّفك المشترك عندما يصبح العالم المشترك متاحًا.', // APPROVED — S4-01 Product Copy Gate
};

const EN: SharedCopy = {
  personalWorld: 'QANDEEL', // CANON — I-08A4 §9
  sharedWorld: 'Shared World', // CANON — G1.2 §3
  switcherLabel: 'Switch between QANDEEL and Shared World', // APPROVED — S4-01 Product Copy Gate (Product Owner amendment) — accessible name only
  invitation: '{0} invites you to create a Shared World together with QANDEEL.', // APPROVED — S4-01 §1.3
  someone: 'Someone', // APPROVED — S4-01 Product Copy Gate
  welcome: 'Welcome. This is your Shared World with me.', // APPROVED — S4-01 §1.6
  back: 'Back', // APPROVED — S4-01 Product Copy Gate
  createWorld: 'Create a Shared World', // APPROVED — S4-01 Product Copy Gate
  inviteFieldLabel: "The other person's Shared ID", // APPROVED — S4-01 Product Copy Gate
  inviteHint: 'XXXX-XXXX-XXXX', // the W3-PDG-01 §4 pattern
  sendInvitation: 'Send invitation', // APPROVED — S4-01 Product Copy Gate
  cancel: 'Cancel', // APPROVED — S4-01 Product Copy Gate
  invitationSent: 'If this Shared ID is right, the invitation will reach its owner.', // APPROVED — S4-01 Product Copy Gate — names nobody
  invalidSharedId: 'Check the Shared ID and try again.', // APPROVED — S4-01 Product Copy Gate (Product Owner amendment)
  notOpen: "Shared World isn't available yet.", // APPROVED — S4-01 Product Copy Gate
  actionUnavailable: "That didn't work right now.", // APPROVED — S4-01 Product Copy Gate
  retry: 'Try again', // APPROVED — S4-01 Product Copy Gate
  invitationsHeading: 'Invitations', // APPROVED — S4-01 Product Copy Gate
  worldsHeading: 'Worlds', // APPROVED — S4-01 Product Copy Gate
  noWorlds: 'No Shared Worlds yet.', // APPROVED — S4-01 Product Copy Gate
  accept: 'Accept', // APPROVED — S4-01 Product Copy Gate
  decline: 'Decline', // APPROVED — S4-01 Product Copy Gate
  declined: 'Invitation declined.', // APPROVED — S4-01 Product Copy Gate
  opening: 'Opening', // APPROVED — S4-01 Product Copy Gate — the pre-authority shell's accessible name only
  worldUnavailable: "This isn't available right now.", // APPROVED — S4-01 Product Copy Gate — neutral; reveals nothing
  membersHeading: 'In this world', // APPROVED — S4-01 Product Copy Gate
  you: 'You', // APPROVED — S4-01 Product Copy Gate
  and: ' and ', // APPROVED — S4-01 Product Copy Gate — joins two Names
  yourSharedId: 'Shared ID', // APPROVED — S4-01 Product Copy Gate
  sharedIdPrivacy: 'Your Shared ID is private. Share it only with people you want to be able to invite you to a Shared World.', // APPROVED — S4-01 Product Copy Gate
  copy: 'Copy', // APPROVED — S4-01 Product Copy Gate
  copied: 'Copied', // APPROVED — S4-01 Product Copy Gate
  regenerate: 'Create a new Shared ID', // APPROVED — S4-01 Product Copy Gate
  regenerateWarning: "Your current Shared ID will stop working, and invitations sent to it that you haven't accepted yet won't reach you. Your existing Shared Worlds won't be affected.", // APPROVED — S4-01 Product Copy Gate
  regenerateConfirm: 'Create new ID', // APPROVED — S4-01 Product Copy Gate
  sharedIdNotOpen: 'Your Shared ID will appear when Shared World becomes available.', // APPROVED — S4-01 Product Copy Gate
};

export function sharedCopy(language: ChromeLanguage): SharedCopy {
  return language === 'ar' ? AR : EN;
}

/** Fills `{0}` with a value. */
export function fill(template: string, value: string): string {
  return template.replace('{0}', value);
}

/** The World's label in the root: the Names of the OTHER current members, in join order; the area name when alone. */
export function worldLabel(copy: SharedCopy, members: readonly { readonly name: string | null; readonly self: boolean }[]): string {
  const others = members.filter((m) => !m.self).map((m) => m.name ?? copy.someone);
  if (others.length === 0) return copy.sharedWorld;
  return others.join(copy.and);
}
