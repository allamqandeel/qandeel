/**
 * S4-01 — the «العالم المشترك» / Shared World copy, and the Global Switcher's two destination words.
 *
 * Every string carries its source, as the other surfaces' copy modules do:
 *
 *   - CANON: frozen Product names — «قنديل» / QANDEEL (I-08A4 §8–§9, the Personal destination) and «العالم المشترك» /
 *     Shared World (G1.2 §3, singular regardless of count);
 *   - APPROVED: the S4-01 Task Contract's Product Owner-approved meanings — the invitation (§1.3) with the inviter's
 *     real Name, and the first-entry welcome (§1.6);
 *   - PROPOSED: everything else, drawn in the frozen register (I-08A4 §11) for the S4-01 Product Copy Gate. None of it
 *     is claimed approved, and each states only what the runtime truthfully does (the invitation confirmation, for
 *     example, never says a person was found).
 */
import type { ChromeLanguage } from '../orientation-chrome';

export const SHARED_COPY_GATE = {
  status: 'S4-01 PRODUCT COPY GATE — OPEN (CANON and APPROVED rows bound; PROPOSED rows await the Product Owner)',
  approved: ['invitation', 'welcome'],
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
  switcherLabel: 'العوالم', // PROPOSED
  invitation: '{0} يدعوك لإنشاء عالم مشترك بينكما ومع قنديل.', // APPROVED — S4-01 §1.3
  someone: 'شخص ما', // PROPOSED
  welcome: 'أهلًا بكما. هذا عالمكما المشترك معي.', // APPROVED — S4-01 §1.6
  back: 'رجوع', // PROPOSED
  createWorld: 'إنشاء عالم مشترك', // PROPOSED
  inviteFieldLabel: 'المعرّف المشترك للشخص الآخر', // PROPOSED
  inviteHint: 'XXXX-XXXX-XXXX', // the W3-PDG-01 §4 pattern
  sendInvitation: 'إرسال الدعوة', // PROPOSED
  cancel: 'إلغاء', // PROPOSED
  invitationSent: 'إذا كان هذا المعرّف صحيحًا، ستصل الدعوة إلى صاحبه.', // PROPOSED — names nobody
  invalidSharedId: 'هذا لا يبدو معرّفًا مشتركًا.', // PROPOSED
  notOpen: 'العالم المشترك غير متاح بعد.', // PROPOSED
  actionUnavailable: 'تعذّر ذلك الآن.', // PROPOSED
  retry: 'إعادة المحاولة', // PROPOSED
  invitationsHeading: 'الدعوات', // PROPOSED
  worldsHeading: 'العوالم', // PROPOSED
  noWorlds: 'لا توجد عوالم مشتركة بعد.', // PROPOSED
  accept: 'قبول', // PROPOSED
  decline: 'رفض', // PROPOSED
  declined: 'رُفضت الدعوة.', // PROPOSED
  opening: 'جارٍ الفتح', // PROPOSED — the pre-authority shell's accessible name only
  worldUnavailable: 'هذا غير متاح الآن.', // PROPOSED — neutral; reveals nothing
  membersHeading: 'في هذا العالم', // PROPOSED
  you: 'أنت', // PROPOSED
  and: ' و', // PROPOSED — joins two Names
  yourSharedId: 'المعرّف المشترك', // PROPOSED
  sharedIdPrivacy: 'معرّفك المشترك خاص. شاركه فقط مع من تريد أن يستطيع دعوتك إلى عالم مشترك.', // PROPOSED
  copy: 'نسخ', // PROPOSED
  copied: 'تم النسخ', // PROPOSED
  regenerate: 'إنشاء معرّف جديد', // PROPOSED
  regenerateWarning: 'سيتوقف معرّفك الحالي عن العمل، ولن تصل إليك الدعوات المرسلة إليه التي لم تقبلها بعد. عوالمك المشتركة الحالية لن تتأثر.', // PROPOSED
  regenerateConfirm: 'إنشاء معرّف جديد', // PROPOSED
  sharedIdNotOpen: 'سيظهر معرّفك المشترك عندما يصبح العالم المشترك متاحًا.', // PROPOSED
};

const EN: SharedCopy = {
  personalWorld: 'QANDEEL', // CANON — I-08A4 §9
  sharedWorld: 'Shared World', // CANON — G1.2 §3
  switcherLabel: 'Worlds', // PROPOSED
  invitation: '{0} invites you to create a Shared World together with QANDEEL.', // APPROVED — S4-01 §1.3
  someone: 'Someone', // PROPOSED
  welcome: 'Welcome. This is your Shared World with me.', // APPROVED — S4-01 §1.6
  back: 'Back', // PROPOSED
  createWorld: 'Create a Shared World', // PROPOSED
  inviteFieldLabel: "The other person's Shared ID", // PROPOSED
  inviteHint: 'XXXX-XXXX-XXXX', // the W3-PDG-01 §4 pattern
  sendInvitation: 'Send invitation', // PROPOSED
  cancel: 'Cancel', // PROPOSED
  invitationSent: 'If this Shared ID is right, the invitation will reach its owner.', // PROPOSED — names nobody
  invalidSharedId: "That doesn't look like a Shared ID.", // PROPOSED
  notOpen: "Shared World isn't available yet.", // PROPOSED
  actionUnavailable: "That didn't work right now.", // PROPOSED
  retry: 'Try again', // PROPOSED
  invitationsHeading: 'Invitations', // PROPOSED
  worldsHeading: 'Worlds', // PROPOSED
  noWorlds: 'No Shared Worlds yet.', // PROPOSED
  accept: 'Accept', // PROPOSED
  decline: 'Decline', // PROPOSED
  declined: 'Invitation declined.', // PROPOSED
  opening: 'Opening', // PROPOSED — the pre-authority shell's accessible name only
  worldUnavailable: "This isn't available right now.", // PROPOSED — neutral; reveals nothing
  membersHeading: 'In this world', // PROPOSED
  you: 'You', // PROPOSED
  and: ' and ', // PROPOSED — joins two Names
  yourSharedId: 'Shared ID', // PROPOSED
  sharedIdPrivacy: 'Your Shared ID is private. Share it only with people you want to be able to invite you to a Shared World.', // PROPOSED
  copy: 'Copy', // PROPOSED
  copied: 'Copied', // PROPOSED
  regenerate: 'Create a new Shared ID', // PROPOSED
  regenerateWarning: "Your current Shared ID will stop working, and invitations sent to it that you haven't accepted yet won't reach you. Your existing Shared Worlds won't be affected.", // PROPOSED
  regenerateConfirm: 'Create new ID', // PROPOSED
  sharedIdNotOpen: 'Your Shared ID will appear when Shared World becomes available.', // PROPOSED
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
