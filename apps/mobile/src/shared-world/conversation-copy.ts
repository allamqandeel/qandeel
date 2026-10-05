/**
 * S4-02 — the Shared conversation's words, in ONE place, under ONE Product Copy Gate.
 *
 * Every row carries its source:
 *
 *   - CANON: a frozen Product name — «قنديل» / QANDEEL (I-08A4 §8–§9);
 *   - REUSED: an already approved row of another surface, imported rather than copied, so it can never drift — the W1A-01
 *     Conversation rows (composer, Send, the read-aloud forms, waiting / unconfirmed / refused / reply-failed / history
 *     unavailable) and the S4-01 Shared rows (Cancel, Try again, the neutral "that didn't work", "Someone");
 *   - APPROVED — S4-02 Product Copy Gate (CLOSED by the Product Owner, 2026-10-05): the rows S4-02 genuinely needs and
 *     no approved surface had, in the Product Owner's final Arabic and English.
 *
 * The surfaces write no word of their own; a Name is the person's own, never copy.
 */
import { conversationCopy } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { sharedCopy } from './copy';

export const SHARED_CONVERSATION_COPY_GATE = {
  status: 'S4-02 PRODUCT COPY GATE — CLOSED (every row APPROVED by the Product Owner, 2026-10-05)',
  canon: ['qandeel'],
  reused: ['composerPlaceholder', 'send', 'selfTurnName', 'qandeelTurnName', 'waitingForReply', 'sendUnconfirmed', 'sendRefused',
    'replyFailed', 'loadFailed', 'retry', 'cancel', 'deleteFailed', 'someone'],
  approved: ['composerName', 'delete', 'deleteExplanation', 'deleteConfirm', 'deleted', 'refresh', 'conversationNotOpen', 'olderMessages'],
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
  readonly olderMessages: string;
  readonly someone: string;
}

const AR_APPROVED = {
  composerName: 'رسالتك في هذا العالم المشترك', // APPROVED — S4-02 Product Copy Gate — the input's accessible name
  delete: 'حذف', // APPROVED — S4-02 Product Copy Gate — the action on the reader's own words
  deleteExplanation: 'سيختفي هذا الكلام من هذا العالم المشترك عند الجميع، ولن يستخدمه قنديل بعد ذلك.', // APPROVED — S4-02 Product Copy Gate — what deletion truthfully does (CW2-03 §37)
  deleteConfirm: 'حذف عند الجميع', // APPROVED — S4-02 Product Copy Gate
  deleted: 'تم الحذف.', // APPROVED — S4-02 Product Copy Gate
  refresh: 'تحديث', // APPROVED — S4-02 Product Copy Gate — the explicit re-read of the World's conversation
  conversationNotOpen: 'المحادثة غير متاحة الآن في هذا العالم المشترك.', // APPROVED — S4-02 Product Copy Gate — while the conversation capability is closed
  olderMessages: 'عرض رسائل أقدم', // APPROVED — S4-02 Product Copy Gate — read one bounded page of older history
} as const;

const EN_APPROVED = {
  composerName: 'Your message in this Shared World', // APPROVED — S4-02 Product Copy Gate — the input's accessible name
  delete: 'Delete', // APPROVED — S4-02 Product Copy Gate — the action on the reader's own words
  deleteExplanation: "This message will disappear from this Shared World for everyone, and QANDEEL won't use it again.", // APPROVED — S4-02 Product Copy Gate — what deletion truthfully does (CW2-03 §37)
  deleteConfirm: 'Delete for everyone', // APPROVED — S4-02 Product Copy Gate
  deleted: 'Deleted.', // APPROVED — S4-02 Product Copy Gate
  refresh: 'Refresh', // APPROVED — S4-02 Product Copy Gate — the explicit re-read of the World's conversation
  conversationNotOpen: "Conversation isn't available in this Shared World right now.", // APPROVED — S4-02 Product Copy Gate — while the conversation capability is closed
  olderMessages: 'Show older messages', // APPROVED — S4-02 Product Copy Gate — read one bounded page of older history
} as const;

function build(language: ChromeLanguage): SharedConversationCopy {
  const conversation = conversationCopy(language); // REUSED — W1A-01 (approved in the W1A-01 gate)
  const shared = sharedCopy(language); // REUSED — S4-01 (approved in the S4-01 gate)
  const approved = language === 'ar' ? AR_APPROVED : EN_APPROVED;
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
    ...approved,
  });
}

const AR = build('ar');
const EN = build('en');

export function sharedConversationCopy(language: ChromeLanguage): SharedConversationCopy {
  return language === 'ar' ? AR : EN;
}
