/**
 * S4-02 — the Shared conversation's words, in ONE place, under ONE Product Copy Gate.
 *
 * Every row carries its source:
 *
 *   - CANON: a frozen Product name — «قنديل» / QANDEEL (I-08A4 §8–§9);
 *   - REUSED: an already approved row of another surface, imported rather than copied, so it can never drift — the W1A-01
 *     Conversation rows (composer, Send, the read-aloud forms, waiting / unconfirmed / refused / reply-failed / history
 *     unavailable) and the S4-01 Shared rows (Cancel, Try again, the neutral "that didn't work", "Someone");
 *   - PROPOSED — S4-02 Product Copy Gate: the rows S4-02 genuinely needs and no approved surface has. They wait for the
 *     Product Owner's decision before the first push.
 *
 * The surfaces write no word of their own; a Name is the person's own, never copy.
 */
import { conversationCopy } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { sharedCopy } from './copy';

export const SHARED_CONVERSATION_COPY_GATE = {
  status: 'S4-02 PRODUCT COPY GATE — OPEN (rows PROPOSED for the Product Owner)',
  canon: ['qandeel'],
  reused: ['composerPlaceholder', 'send', 'selfTurnName', 'qandeelTurnName', 'waitingForReply', 'sendUnconfirmed', 'sendRefused',
    'replyFailed', 'loadFailed', 'retry', 'cancel', 'deleteFailed', 'someone'],
  proposed: ['composerName', 'delete', 'deleteExplanation', 'deleteConfirm', 'deleted', 'refresh', 'conversationNotOpen'],
} as const;

export interface SharedConversationCopy {
  readonly qandeel: string;
  readonly composerPlaceholder: string;
  readonly composerName: string;
  readonly send: string;
  readonly selfTurnName: (text: string) => string;
  readonly qandeelTurnName: (text: string) => string;
  readonly otherTurnName: (name: string, text: string) => string;
  readonly waitingForReply: string;
  readonly sendUnconfirmed: string;
  readonly sendRefused: string;
  readonly replyFailed: string;
  readonly loadFailed: string;
  readonly retry: string;
  readonly cancel: string;
  readonly delete: string;
  readonly deleteExplanation: string;
  readonly deleteConfirm: string;
  readonly deleted: string;
  readonly deleteFailed: string;
  readonly refresh: string;
  readonly conversationNotOpen: string;
  readonly someone: string;
}

const AR_PROPOSED = {
  composerName: 'رسالتك في هذا العالم', // PROPOSED — S4-02 Product Copy Gate — the composer's accessible name
  delete: 'حذف', // PROPOSED — S4-02 Product Copy Gate — the action on the reader's own words
  deleteExplanation: 'سيختفي هذا الكلام من العالم المشترك عند الجميع، ولن يستخدمه قنديل بعد ذلك.', // PROPOSED — S4-02 Product Copy Gate — states what deletion truthfully does (CW2-03 §37)
  deleteConfirm: 'حذف عند الجميع', // PROPOSED — S4-02 Product Copy Gate
  deleted: 'تم الحذف.', // PROPOSED — S4-02 Product Copy Gate
  refresh: 'تحديث', // PROPOSED — S4-02 Product Copy Gate — the explicit re-read of the World's conversation
  conversationNotOpen: 'المحادثة في العالم المشترك غير متاحة بعد.', // PROPOSED — S4-02 Product Copy Gate — while the conversation capability is closed
} as const;

const EN_PROPOSED = {
  composerName: 'Your message in this world', // PROPOSED — S4-02 Product Copy Gate — the composer's accessible name
  delete: 'Delete', // PROPOSED — S4-02 Product Copy Gate — the action on the reader's own words
  deleteExplanation: "This will disappear from this Shared World for everyone, and QANDEEL won't use it again.", // PROPOSED — S4-02 Product Copy Gate — states what deletion truthfully does (CW2-03 §37)
  deleteConfirm: 'Delete for everyone', // PROPOSED — S4-02 Product Copy Gate
  deleted: 'Deleted.', // PROPOSED — S4-02 Product Copy Gate
  refresh: 'Refresh', // PROPOSED — S4-02 Product Copy Gate — the explicit re-read of the World's conversation
  conversationNotOpen: "Conversation in Shared World isn't available yet.", // PROPOSED — S4-02 Product Copy Gate — while the conversation capability is closed
} as const;

function build(language: ChromeLanguage): SharedConversationCopy {
  const conversation = conversationCopy(language); // REUSED — W1A-01 (approved in the W1A-01 gate)
  const shared = sharedCopy(language); // REUSED — S4-01 (approved in the S4-01 gate)
  const proposed = language === 'ar' ? AR_PROPOSED : EN_PROPOSED;
  return Object.freeze({
    qandeel: shared.personalWorld, // CANON — I-08A4 §8 / §9
    composerPlaceholder: conversation.composerPlaceholder, // REUSED — W1A-01
    send: conversation.sendName, // REUSED — W1A-01
    selfTurnName: conversation.userTurnName, // REUSED — W1A-01
    qandeelTurnName: conversation.replyTurnName, // REUSED — W1A-01
    otherTurnName: (name: string, text: string) => `${name}: ${text}`, // the person's own Name, never copy
    waitingForReply: conversation.waitingForReply, // REUSED — W1A-01
    sendUnconfirmed: conversation.sendUnconfirmed, // REUSED — W1A-01
    sendRefused: conversation.sendRefused, // REUSED — W1A-01
    replyFailed: conversation.replyFailed, // REUSED — W1A-01
    loadFailed: conversation.historyUnavailable, // REUSED — W1A-01
    retry: shared.retry, // REUSED — S4-01
    cancel: shared.cancel, // REUSED — S4-01
    deleteFailed: shared.actionUnavailable, // REUSED — S4-01
    someone: shared.someone, // REUSED — S4-01
    ...proposed,
  });
}

const AR = build('ar');
const EN = build('en');

export function sharedConversationCopy(language: ChromeLanguage): SharedConversationCopy {
  return language === 'ar' ? AR : EN;
}
