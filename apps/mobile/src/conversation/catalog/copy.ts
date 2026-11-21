/**
 * COSMOS E-2 corrections, Slice B (the Product Owner's D-2, 2026-11-20) — the words of the Personal conversation
 * catalog: the entry, the list, New Chat, the manual title and the few states the list can be in.
 *
 * Every string carries its source:
 *
 *   - APPROVED / REUSED — COSMOS E-2 PRODUCT COPY GATE (Slice B), CLOSED by the PO COPY GATE DECISION of 2026-11-21
 *     (COSMOS E-2, "Complete Wording Approval Before Consolidated CI"): all 14 rows, Arabic authoritative.
 *     back / save / cancel reuse approved wording, tryAgain is the frozen VI-01 T03 wording, and untitled reuses the
 *     approved «بلا عنوان», which the Product Owner authorized for the conversation context. The gate test holds the values.
 *
 * Nothing here names an AI: a conversation's name is the person's own title, else the person's own first words, else
 * the honest «بلا عنوان» / "Untitled". There is no invented theme, no number for a name and no
 * claim about the conversation's content.
 */
import type { ChromeLanguage } from '../../orientation-chrome';

export const CONVERSATION_CATALOG_COPY_GATE = {
  status: 'COSMOS E-2 PRODUCT COPY GATE (Slice B) — CLOSED — 14 rows APPROVED by the Product Owner, 2026-11-21 (back / save / cancel / tryAgain / untitled REUSE approved wording)',
  proposed: [],
  approved: [
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
  entryName: 'المحادثات', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  title: 'المحادثات', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  back: 'رجوع', // REUSED approved wording 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  newChat: 'محادثة جديدة', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  untitled: 'بلا عنوان', // REUSED approved «بلا عنوان», PO-authorized for the conversation context 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  current: 'الحالية', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  rename: 'تغيير الاسم', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  renameFieldName: 'اسم المحادثة', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  save: 'حفظ', // REUSED approved wording 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  cancel: 'إلغاء', // REUSED approved wording 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  loading: 'جارٍ تحميل المحادثات…', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  unavailable: 'تعذّر عرض المحادثات الآن.', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  tryAgain: 'إعادة المحاولة', // REUSED — VI-01 T03 (frozen) 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  busy: 'أكمل الإجراء الحالي أولًا.', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
});

const EN: ConversationCatalogCopy = Object.freeze({
  entryName: 'Conversations', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  title: 'Conversations', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  back: 'Back', // REUSED approved wording 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  newChat: 'New chat', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  untitled: 'Untitled', // REUSED approved wording, PO-authorized for the conversation context 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  current: 'Current', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  rename: 'Rename', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  renameFieldName: 'Conversation name', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  save: 'Save', // REUSED approved wording 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  cancel: 'Cancel', // REUSED approved wording 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  loading: 'Loading conversations…', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  unavailable: "Conversations can't be shown right now.", // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  tryAgain: 'Try again', // REUSED — VI-01 T03 (frozen) 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
  busy: 'Finish the current action first.', // APPROVED 2026-11-21 — COSMOS E-2 Product Copy Gate (Slice B)
});

export function conversationCatalogCopy(language: ChromeLanguage): ConversationCatalogCopy {
  return language === 'ar' ? AR : EN;
}
