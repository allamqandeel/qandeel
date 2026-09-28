/**
 * W1A-01 — the ONE place the Conversation surface's words are written.
 *
 * Every string below is exactly as the Product Owner approved it for W1A-01
 * (`docs/e2e/QANDEEL_W1A01_IMPLEMENTATION_RECORD_v1.md` §2 records the approval verbatim). Nothing
 * here is paraphrased, shortened, re-punctuated or translated on the fly, and no other module in
 * this layer contains a Product word. A state that would need a word not in this table is not
 * rendered with an invented one: it stays silent and is reported to the Product Owner instead.
 *
 * Deliberately NOT here, because the approval says they stay silent: an empty-Conversation opener
 * or fallback name, a loading sentence, a success sentence, an "offline" / connection claim, day
 * markers, and any server message, status value, test id or engineering term.
 */
import type { ChromeLanguage } from '../orientation-chrome';

export interface ConversationCopy {
  /** The Conversation surface's own name. Frozen (G1.1 closure §1). */
  readonly conversation: string;
  /** Analysis → Conversation, visible label. Frozen (P4-C4 `backName`). */
  readonly backLabel: string;
  /** Analysis → Conversation, accessible name. Frozen (P4-C4 `backName`). */
  readonly backName: string;
  /** Conversation → Analysis, visible label. Frozen (P4-C4 `door`). */
  readonly doorLabel: string;
  /** Conversation → Analysis, accessible name. Frozen (P4-C4 `doorName`). */
  readonly doorName: string;
  /** The retry act. Frozen (VI-01 T03). */
  readonly tryAgain: string;
  /** The Product's name. Frozen (CANON). */
  readonly product: string;
  /** Composer placeholder. PO-approved in the W1A-01 gate. */
  readonly composerPlaceholder: string;
  /** Composer accessible name. PO-approved in the W1A-01 gate. */
  readonly composerName: string;
  /** Send, accessible name (the control is icon-only). PO-approved in the W1A-01 gate. */
  readonly sendName: string;
  /** The reader's committed turn, read aloud. PO-approved in the W1A-01 gate. */
  readonly userTurnName: (text: string) => string;
  /** QANDEEL's turn, read aloud. PO-approved in the W1A-01 gate. */
  readonly replyTurnName: (text: string) => string;
  /** While QANDEEL's reply is outstanding. PO-approved in the W1A-01 gate. */
  readonly waitingForReply: string;
  /** The client cannot confirm whether the submission was admitted. PO-approved (replacement wording). */
  readonly sendUnconfirmed: string;
  /** A committed turn whose reply terminated without one. PO-approved in the W1A-01 gate. */
  readonly replyFailed: string;
  /** The conversation-so-far could not be read. PO-approved in the W1A-01 gate. */
  readonly historyUnavailable: string;
}

const AR: ConversationCopy = Object.freeze({
  conversation: 'المحادثة',
  backLabel: 'المحادثة',
  backName: 'المحادثة',
  doorLabel: 'تحليل المحادثة',
  doorName: 'تحليل المحادثة',
  tryAgain: 'إعادة المحاولة',
  product: 'قنديل',
  composerPlaceholder: 'كلامك هنا',
  composerName: 'رسالتك لقنديل',
  sendName: 'إرسال',
  userTurnName: (text: string) => `كلامك: ${text}`,
  replyTurnName: (text: string) => `قنديل: ${text}`,
  waitingForReply: 'في انتظار رد قنديل',
  sendUnconfirmed: 'تعذّر التأكد من إرسال الرسالة.',
  replyFailed: 'تعذّر إكمال رد قنديل.',
  historyUnavailable: 'تعذّر تحميل المحادثة.',
});

const EN: ConversationCopy = Object.freeze({
  conversation: 'Conversation',
  backLabel: 'Conversation',
  backName: 'Conversation',
  doorLabel: 'Analysis',
  doorName: 'Analysis of this conversation',
  tryAgain: 'Try again',
  product: 'QANDEEL',
  composerPlaceholder: 'Write here',
  composerName: 'Your message to QANDEEL',
  sendName: 'Send',
  userTurnName: (text: string) => `You: ${text}`,
  replyTurnName: (text: string) => `QANDEEL: ${text}`,
  waitingForReply: "Waiting for QANDEEL's reply",
  sendUnconfirmed: "It couldn't be confirmed that the message was sent.",
  replyFailed: "QANDEEL's reply couldn't be completed.",
  historyUnavailable: "The conversation didn't load.",
});

/** The copy for one Product language. There is no default language, exactly as T-08 refuses one. */
export function conversationCopy(language: ChromeLanguage): ConversationCopy {
  return language === 'ar' ? AR : EN;
}
