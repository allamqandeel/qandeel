/**
 * S8A-04 CP3-C — the words of the owner's permissions for their own knowledge in a Shared World: the private request
 * (CG-1), its two answers and their confirmations (CG-2), the reconfirmation when the audience grows (CG-3), «ما سمحت به
 * هنا» / "What you've allowed here" with withdrawal and allowing later (CG-4), and the ended state (CG-5), in ONE place,
 * under ONE Product Copy Gate — verbatim from the CP3 Controlled Amendment §7, APPROVED 6/6 by the Product Owner on
 * 2026-10-25 (CG-6, the model-facing texts, live in the API).
 *
 * Every row carries its source:
 *   - APPROVED — the S8A-04 CP3 Copy Gate (Product Owner, 2026-10-25), word for word;
 *   - REUSED: an already approved S4-01 row, imported rather than copied ("That didn't work right now", Try again).
 *
 * Rendering only, never meaning: each inserted value — the World's name, the item's exact words, each member's own Name —
 * is a bidi-isolated run (FSI … PDI), so a Latin Name or a number inside an Arabic sentence (or the reverse) keeps its own
 * order and never reorders the sentence around it. The member list is joined as the gate defines `{members}`: «، » /
 * ", " with «و» / "and" before the last.
 */
import type { ChromeLanguage } from '../../orientation-chrome';
import type { SharedPermissionEnding } from '../../runtime-entry';
import { sharedCopy } from '../copy';

export const SHARED_PERMISSIONS_COPY_GATE = {
  status: 'S8A-04 CP3 COPY GATE — APPROVED 6/6 — Product Owner, 2026-10-25',
  reused: ['actionUnavailable', 'retry'],
  approved: ['request', 'allow', 'decline', 'allowedDone', 'declinedDone', 'reconfirm', 'allowEveryone', 'stopUsing', 'title', 'allowedHeading',
    'declinedHeading', 'withdraw', 'withdrawExplain', 'withdrawConfirm', 'cancel', 'allowNow', 'allowNowExplain', 'allowNowConfirm', 'ended',
    'endedLeft', 'endedCorrected', 'endedForgotten', 'endedTurnedOff', 'endedNoLongerCurrent', 'membersSeparator', 'membersLast'],
} as const;

export interface SharedPermissionsCopy {
  // REUSED
  readonly actionUnavailable: string;
  readonly retry: string;
  // APPROVED — CG-1
  readonly request: string;
  // APPROVED — CG-2
  readonly allow: string;
  readonly decline: string;
  readonly allowedDone: string;
  readonly declinedDone: string;
  // APPROVED — CG-3
  readonly reconfirm: string;
  readonly allowEveryone: string;
  readonly stopUsing: string;
  // APPROVED — CG-4
  readonly title: string;
  readonly allowedHeading: string;
  readonly declinedHeading: string;
  readonly withdraw: string;
  readonly withdrawExplain: string;
  readonly withdrawConfirm: string;
  readonly cancel: string;
  readonly allowNow: string;
  readonly allowNowExplain: string;
  readonly allowNowConfirm: string;
  // APPROVED — CG-5
  readonly ended: string;
  readonly endedLeft: string;
  readonly endedCorrected: string;
  readonly endedForgotten: string;
  readonly endedTurnedOff: string;
  readonly endedNoLongerCurrent: string;
  // APPROVED — the `{members}` joining the gate defines
  readonly membersSeparator: string;
  readonly membersLast: string;
}

type OwnCopy = Omit<SharedPermissionsCopy, 'actionUnavailable' | 'retry'>;

const AR_OWN: OwnCopy = {
  request: 'في «{world}»، قد يفيد قنديل أن يعرف هذا عنك: «{item}».\nإذا سمحت، سيستخدمه قنديل في ردوده هنا، وقد يذكره أمام أعضاء هذا العالم ({members}) على أنه يخصك.\nلن يذكر قنديل كيف عرفه، ولا أي حديث بينكما.\nلا يرى هذا الطلب أحد غيرك. ينتهي الإذن إذا غادرت هذا العالم أو صححت هذه المعلومة أو طلبت نسيانها، ويمكنك سحبه في أي وقت.', // APPROVED — CG-1 (Product Owner, 2026-10-25)
  allow: 'اسمح', // APPROVED — CG-2
  decline: 'لا', // APPROVED — CG-2
  allowedDone: 'تم. يمكن لقنديل استخدام هذه المعلومة وذكرها في «{world}».', // APPROVED — CG-2
  declinedDone: 'لن يسألك قنديل عنها مرة أخرى في هذا العالم. يمكنك السماح بها لاحقًا من «ما سمحت به هنا».', // APPROVED — CG-2
  reconfirm: 'انضم إلى «{world}» أعضاء جدد: {members}. سمحت بأن يذكر قنديل «{item}» أمام الأعضاء السابقين فقط. هل تسمح بذكرها أمام الجميع الآن؟ إلى أن تختار، لن يستخدمها قنديل في هذا العالم.', // APPROVED — CG-3
  allowEveryone: 'اسمح للجميع', // APPROVED — CG-3
  stopUsing: 'أوقف استخدامها', // APPROVED — CG-3
  title: 'ما سمحت به هنا', // APPROVED — CG-4
  allowedHeading: 'مسموح', // APPROVED — CG-4
  declinedHeading: 'رفضته', // APPROVED — CG-4
  withdraw: 'سحب الإذن', // APPROVED — CG-4 (on an allowed item)
  withdrawExplain: 'سحب الإذن؟ لن يستخدم قنديل هذه المعلومة أو يذكرها في «{world}» بعد الآن. ما قيل من قبل يبقى كما هو.', // APPROVED — CG-4
  withdrawConfirm: 'اسحب', // APPROVED — CG-4
  cancel: 'إلغاء', // APPROVED — CG-4
  allowNow: 'اسمح الآن', // APPROVED — CG-4 (on a declined item)
  allowNowExplain: 'سيستخدم قنديل هذه المعلومة وقد يذكرها أمام: {members}.', // APPROVED — CG-4 (the Allow-now confirmation)
  allowNowConfirm: 'اسمح', // APPROVED — CG-4
  ended: 'انتهى هذا الإذن لأنك {reason}.', // APPROVED — CG-5
  endedLeft: 'غادرت هذا العالم', // APPROVED — CG-5
  endedCorrected: 'صححت هذه المعلومة', // APPROVED — CG-5
  endedForgotten: 'طلبت نسيانها', // APPROVED — CG-5
  endedTurnedOff: 'أوقفت الاعتماد عليها', // APPROVED — CG-5
  endedNoLongerCurrent: 'انتهى هذا الإذن لأن هذه المعلومة لم تعد سارية.', // APPROVED — CG-5 (the ending by time)
  membersSeparator: '، ', // APPROVED — the gate's `{members}` definition
  membersLast: ' و', // APPROVED — the gate's `{members}` definition («و» before the last)
};

const EN_OWN: OwnCopy = {
  request: 'In "{world}", it may help QANDEEL to know this about you: "{item}".\nIf you allow it, QANDEEL will use it in its replies here and may mention it as yours in front of this World\'s members ({members}).\nQANDEEL won\'t say how it knows it, or anything you\'ve talked about together.\nNo one else sees this request. The permission ends if you leave this World, correct this, or ask QANDEEL to forget it, and you can withdraw it at any time.', // APPROVED — CG-1 (Product Owner, 2026-10-25)
  allow: 'Allow', // APPROVED — CG-2
  decline: 'No', // APPROVED — CG-2
  allowedDone: 'Done. QANDEEL can use and mention this in "{world}".', // APPROVED — CG-2
  declinedDone: 'QANDEEL won\'t ask about this again in this World. You can still allow it later from "What you\'ve allowed here".', // APPROVED — CG-2
  reconfirm: 'New members joined "{world}": {members}. You allowed QANDEEL to mention "{item}" only in front of the earlier members. Allow it in front of everyone now? Until you choose, QANDEEL won\'t use it in this World.', // APPROVED — CG-3
  allowEveryone: 'Allow for everyone', // APPROVED — CG-3
  stopUsing: 'Stop using it', // APPROVED — CG-3
  title: 'What you\'ve allowed here', // APPROVED — CG-4
  allowedHeading: 'Allowed', // APPROVED — CG-4
  declinedHeading: 'Declined', // APPROVED — CG-4
  withdraw: 'Withdraw', // APPROVED — CG-4 (on an allowed item)
  withdrawExplain: 'Withdraw permission? QANDEEL will no longer use or mention this in "{world}". What was already said stays as it is.', // APPROVED — CG-4
  withdrawConfirm: 'Withdraw', // APPROVED — CG-4
  cancel: 'Cancel', // APPROVED — CG-4
  allowNow: 'Allow now', // APPROVED — CG-4 (on a declined item)
  allowNowExplain: 'QANDEEL will use this and may mention it in front of: {members}.', // APPROVED — CG-4 (the Allow-now confirmation)
  allowNowConfirm: 'Allow', // APPROVED — CG-4
  ended: 'This permission ended because you {reason}.', // APPROVED — CG-5
  endedLeft: 'left this World', // APPROVED — CG-5
  endedCorrected: 'corrected this', // APPROVED — CG-5
  endedForgotten: 'asked QANDEEL to forget it', // APPROVED — CG-5
  endedTurnedOff: 'turned it off', // APPROVED — CG-5
  endedNoLongerCurrent: 'This permission ended because this is no longer current.', // APPROVED — CG-5 (the ending by time)
  membersSeparator: ', ', // APPROVED — the gate's `{members}` definition
  membersLast: ' and ', // APPROVED — the gate's `{members}` definition ("and" before the last)
};

function build(language: ChromeLanguage): SharedPermissionsCopy {
  const shared = sharedCopy(language); // REUSED — S4-01 (approved in the S4-01 gate)
  return Object.freeze({ actionUnavailable: shared.actionUnavailable, retry: shared.retry, ...(language === 'ar' ? AR_OWN : EN_OWN) });
}
const AR = build('ar');
const EN = build('en');

export function sharedPermissionsCopy(language: ChromeLanguage): SharedPermissionsCopy {
  return language === 'ar' ? AR : EN;
}

/** FIRST STRONG ISOLATE … POP DIRECTIONAL ISOLATE: one inserted value keeps its own direction inside any sentence. */
const FSI = String.fromCodePoint(0x2068);
const PDI = String.fromCodePoint(0x2069);
export const isolate = (value: string): string => `${FSI}${value}${PDI}`;

/** `{members}`: each Name isolated, joined «، » / ", " with «و» / "and" before the last. */
export function joinMembers(copy: SharedPermissionsCopy, names: readonly string[]): string {
  const runs = names.map(isolate);
  if (runs.length <= 1) return runs.join('');
  return `${runs.slice(0, -1).join(copy.membersSeparator)}${copy.membersLast}${runs[runs.length - 1]}`;
}

/** One approved template with its named placeholders filled (each value isolated; `{members}` already joined). */
export function fillPermission(template: string, values: { readonly world?: string; readonly item?: string; readonly members?: string; readonly reason?: string }): string {
  return template
    .replace('{world}', values.world === undefined ? '{world}' : isolate(values.world))
    .replace('{item}', values.item === undefined ? '{item}' : isolate(values.item))
    .replace('{members}', values.members ?? '{members}')
    .replace('{reason}', values.reason ?? '{reason}');
}

/** CG-5: the ending's own sentence. */
export function endedText(copy: SharedPermissionsCopy, reason: SharedPermissionEnding): string {
  switch (reason) {
    case 'LEFT': return fillPermission(copy.ended, { reason: copy.endedLeft });
    case 'CORRECTED': return fillPermission(copy.ended, { reason: copy.endedCorrected });
    case 'FORGOTTEN': return fillPermission(copy.ended, { reason: copy.endedForgotten });
    case 'TURNED_OFF': return fillPermission(copy.ended, { reason: copy.endedTurnedOff });
    default: return copy.endedNoLongerCurrent;
  }
}
