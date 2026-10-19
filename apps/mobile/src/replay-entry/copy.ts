/**
 * S7-02 — the ONE place the Replay entry's and selection's words are written.
 *
 * Fixed Arabic is simplified Modern Standard Arabic and gender-considerate (LANG-01; the Product Owner's language rule):
 * where a second-person verb would mark gender, the row uses a noun or a passive form instead.
 *
 * Each row carries its status, and nothing here is promoted by being shipped:
 *
 *   APPROVED  — an existing Product Owner approval, reused verbatim (its source named on the row);
 *   LOCKED    — Arabic locked by the G1.1 closure (G1.2 report §L reproduces it verbatim); its English is still PROPOSED;
 *   PROPOSED  — new in S7-02, or G1.1-R3 PROOF copy (R3-J6: «إعادة عرض المحادثة» is proof copy). A PROPOSED row is
 *               shown only behind the closed Personal Replay gate and awaits the S7-02 Product Copy Gate
 *               (`docs/e2e/QANDEEL_S7_02_IMPLEMENTATION_RECORD_v1.md` §6).
 *
 * Deliberately absent: a loading sentence, a "preview" or "play" word (no player exists in S7-02), any audio word, and
 * any server word, status value or engineering term. A state with no row here says nothing.
 */
import type { ChromeLanguage } from '../orientation-chrome';

export type ReplayCopyStatus = 'APPROVED' | 'LOCKED' | 'PROPOSED';

interface Row {
  readonly ar: string;
  readonly en: string;
  readonly status: ReplayCopyStatus;
  readonly source: string;
}

export const REPLAY_ENTRY_COPY_ROWS = Object.freeze({
  replayName: { ar: 'إعادة عرض المحادثة', en: 'Replay this conversation', status: 'PROPOSED', source: 'G1.1-R3 proof copy (R3-J6)' },
  whole: { ar: 'المحادثة كاملة', en: 'The whole conversation', status: 'LOCKED', source: 'G1.1 closure; G1.2 §L (Arabic). English: G1.1-R3 proof' },
  part: { ar: 'جزء من المحادثة', en: 'Part of the conversation', status: 'LOCKED', source: 'G1.1 closure; G1.2 §L (Arabic). English: G1.1-R3 proof' },
  savedDraft: { ar: 'المسودة المحفوظة', en: 'The saved draft', status: 'PROPOSED', source: 'S7-02' },
  pickHint: { ar: 'أول رسالة وآخر رسالة في الجزء', en: 'The first and last message of the part', status: 'PROPOSED', source: 'G1.1-R3 proof copy' },
  save: { ar: 'حفظ', en: 'Save', status: 'PROPOSED', source: 'S7-02' },
  cancel: { ar: 'إلغاء', en: 'Cancel', status: 'APPROVED', source: 'S4-01 Product Copy Gate' },
  openHead: {
    ar: 'إعادة العرض التي تشمل آخر رسالة لا يمكن عرضها إلا بعد أن تستمر المحادثة.',
    en: 'A Replay that includes the newest message can be shown only after the conversation continues.',
    status: 'PROPOSED', source: 'S7-02 (S7-01 record §8.1, MOMENT_NOT_SEALED)',
  },
  savedWhole: { ar: 'حُفظت المحادثة كاملة لإعادة العرض.', en: 'The whole conversation was saved for a Replay.', status: 'PROPOSED', source: 'S7-02' },
  savedPart: { ar: 'حُفظ الجزء المختار لإعادة العرض.', en: 'The chosen part was saved for a Replay.', status: 'PROPOSED', source: 'S7-02' },
  changed: { ar: 'تغيّر شيء منذ التحديد. يُرجى التحديد من جديد.', en: 'Something changed since this was chosen. Please choose again.', status: 'PROPOSED', source: 'S7-02 (CHANGED, SOURCE_CHANGED)' },
  notProvable: { ar: 'لا يمكن حفظ هذا الاختيار كجزء واحد متصل.', en: "This selection can't be saved as one continuous part.", status: 'PROPOSED', source: 'S7-02' },
  unconfirmed: { ar: 'تعذّر التأكد من الحفظ.', en: "It couldn't be confirmed that this was saved.", status: 'PROPOSED', source: 'S7-02 (after the approved W1A-01 sendUnconfirmed)' },
  tryAgain: { ar: 'إعادة المحاولة', en: 'Try again', status: 'APPROVED', source: 'VI-01 T03 (W1A-01 tryAgain)' },
  notAvailable: { ar: 'هذا غير متاح الآن.', en: "This isn't available right now.", status: 'APPROVED', source: 'S4-01 Product Copy Gate' },
  failed: { ar: 'تعذّر ذلك الآن.', en: "That didn't work right now.", status: 'APPROVED', source: 'S4-01 Product Copy Gate' },
} satisfies Record<string, Row>);

/** The message count of a selection, by Arabic number grammar (MSA) and English plural. PROPOSED (S7-02). */
const COUNT = Object.freeze({
  status: 'PROPOSED' as ReplayCopyStatus,
  ar: (n: number) => (n === 1 ? 'رسالة واحدة' : n === 2 ? 'رسالتان' : n >= 3 && n <= 10 ? `${n} رسائل` : `${n} رسالة`),
  en: (n: number) => (n === 1 ? '1 message' : `${n} messages`),
});

export const REPLAY_ENTRY_COPY_GATE = Object.freeze({
  status: 'S7-02 PRODUCT COPY GATE — OPEN — PROPOSED rows await the Product Owner',
  proposed: [...Object.entries(REPLAY_ENTRY_COPY_ROWS).filter(([, row]) => row.status === 'PROPOSED').map(([key]) => key), 'count'],
  locked: Object.entries(REPLAY_ENTRY_COPY_ROWS).filter(([, row]) => row.status === 'LOCKED').map(([key]) => key),
  approved: Object.entries(REPLAY_ENTRY_COPY_ROWS).filter(([, row]) => row.status === 'APPROVED').map(([key]) => key),
});

export type ReplayEntryCopy = { readonly [K in keyof typeof REPLAY_ENTRY_COPY_ROWS]: string } & { readonly count: (n: number) => string };

const build = (language: ChromeLanguage): ReplayEntryCopy => Object.freeze({
  ...(Object.fromEntries(Object.entries(REPLAY_ENTRY_COPY_ROWS).map(([key, row]) => [key, row[language]])) as { [K in keyof typeof REPLAY_ENTRY_COPY_ROWS]: string }),
  count: COUNT[language],
});
const AR = build('ar');
const EN = build('en');

/** The copy for one Product language. There is no default language. */
export function replayEntryCopy(language: ChromeLanguage): ReplayEntryCopy {
  return language === 'ar' ? AR : EN;
}
