/**
 * COSMOS E-2 corrections, Slice B (the Product Owner's D-2, 2026-11-20) — the words of the Personal conversation
 * catalog: the entry, the list, New Chat, the manual title and the few states the list can be in.
 *
 * Every string carries its source:
 *
 *   - PROPOSED — COSMOS E-2 PRODUCT COPY GATE (Slice B), awaiting the Product Owner. No row below is approved yet; the
 *     gate test holds the count, and the strings ship in the synthetic acceptance build only as PROPOSED words.
 *
 * Nothing here names an AI: a conversation's name is the person's own title, else the person's own first words, else
 * the honest «محادثة بلا عنوان» / "Untitled conversation". There is no invented theme, no number for a name and no
 * claim about the conversation's content.
 */
import type { ChromeLanguage } from '../../orientation-chrome';

export const CONVERSATION_CATALOG_COPY_GATE = {
  status: 'COSMOS E-2 PRODUCT COPY GATE (Slice B) — OPEN — 14 rows PROPOSED, awaiting the Product Owner',
  approved: [],
  proposed: [
    'entryName', 'title', 'back', 'newChat', 'untitled', 'current', 'rename', 'renameFieldName', 'save', 'cancel',
    'loading', 'unavailable', 'tryAgain', 'busy',
  ],
} as const;

export interface ConversationCatalogCopy {
  /** The accessible name of the chrome entry that opens the list. */
  readonly entryName: string;
  /** The list's heading. */
  readonly title: string;
  readonly back: string;
  /** The approved fresh-start action: a new, empty conversation beside the existing ones (never replacing one). */
  readonly newChat: string;
  /** A conversation with no manual title and no first message yet. */
  readonly untitled: string;
  /** The row marker of the conversation that is open now. */
  readonly current: string;
  readonly rename: string;
  readonly renameFieldName: string;
  readonly save: string;
  readonly cancel: string;
  readonly loading: string;
  /** The list could not be read from the server. No local list stands in for it. */
  readonly unavailable: string;
  readonly tryAgain: string;
  /** A switch was declined because a message is still being sent or a call is up. */
  readonly busy: string;
}

const AR: ConversationCatalogCopy = Object.freeze({
  entryName: 'المحادثات', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  title: 'المحادثات', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  back: 'رجوع', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  newChat: 'محادثة جديدة', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  untitled: 'محادثة بلا عنوان', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  current: 'الحالية', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  rename: 'إعادة التسمية', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  renameFieldName: 'اسم المحادثة', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  save: 'حفظ', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  cancel: 'إلغاء', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  loading: 'جارٍ القراءة…', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  unavailable: 'تعذّر عرض المحادثات الآن.', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  tryAgain: 'حاول مجددًا', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  busy: 'أكمل ما يجري أولًا.', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
});

const EN: ConversationCatalogCopy = Object.freeze({
  entryName: 'Conversations', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  title: 'Conversations', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  back: 'Back', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  newChat: 'New chat', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  untitled: 'Untitled conversation', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  current: 'Current', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  rename: 'Rename', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  renameFieldName: 'Conversation name', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  save: 'Save', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  cancel: 'Cancel', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  loading: 'Reading…', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  unavailable: 'Conversations can’t be shown right now.', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  tryAgain: 'Try again', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
  busy: 'Finish what’s in progress first.', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice B)
});

export function conversationCatalogCopy(language: ChromeLanguage): ConversationCatalogCopy {
  return language === 'ar' ? AR : EN;
}
