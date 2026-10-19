/**
 * S7-02 — the ONE place the Replay entry's and selection's words are written.
 *
 * Fixed Arabic is simplified Modern Standard Arabic and gender-considerate (LANG-01; the Product Owner's language rule):
 * where a second-person verb would mark gender, the row uses a noun or a passive form instead.
 *
 * Each row carries two statuses, and nothing here is promoted by being shipped. `status` is the Arabic row's; `enStatus`
 * is the English row's, which an Arabic approval does not carry with it:
 *
 *   APPROVED  — a Product Owner approval: an existing one reused verbatim, or the S7-02 Product Copy Gate's
 *               (2026-10-19, every Arabic row word for word; its source named on the row);
 *   LOCKED    — Arabic locked by the G1.1 closure (G1.2 report §L reproduces it verbatim);
 *   PROPOSED  — not approved. After the S7-02 Copy Gate only English rows are PROPOSED: the English of every row new in
 *               S7-02 or taken from G1.1-R3 proof copy (`docs/e2e/QANDEEL_S7_02_IMPLEMENTATION_RECORD_v1.md` §6).
 *
 * Deliberately absent: a loading sentence, a "preview" or "play" word (no player exists in S7-02), any audio word, and
 * any server word, status value or engineering term. A state with no row here says nothing.
 */
import type { ChromeLanguage } from '../orientation-chrome';

export type ReplayCopyStatus = 'APPROVED' | 'LOCKED' | 'PROPOSED';

interface Row {
  readonly ar: string;
  readonly en: string;
  /** The Arabic row's status. */
  readonly status: ReplayCopyStatus;
  /** The English row's status (never promoted by the Arabic approval). */
  readonly enStatus: ReplayCopyStatus;
  readonly source: string;
}

export const REPLAY_ENTRY_COPY_ROWS = Object.freeze({
  replayName: { ar: 'إعادة عرض المحادثة', en: 'Replay this conversation', status: 'APPROVED', enStatus: 'PROPOSED', source: 'G1.1-R3 proof copy (R3-J6); Arabic APPROVED by the Product Owner, 2026-10-19' },
  whole: { ar: 'المحادثة كاملة', en: 'The whole conversation', status: 'LOCKED', enStatus: 'PROPOSED', source: 'G1.1 closure; G1.2 §L (Arabic). English: G1.1-R3 proof' },
  part: { ar: 'جزء من المحادثة', en: 'Part of the conversation', status: 'LOCKED', enStatus: 'PROPOSED', source: 'G1.1 closure; G1.2 §L (Arabic). English: G1.1-R3 proof' },
  savedDraft: { ar: 'المسودة المحفوظة', en: 'The saved draft', status: 'APPROVED', enStatus: 'PROPOSED', source: 'S7-02; Arabic APPROVED by the Product Owner, 2026-10-19' },
  pickHint: { ar: 'أول رسالة وآخر رسالة في الجزء', en: 'The first and last message of the part', status: 'APPROVED', enStatus: 'PROPOSED', source: 'G1.1-R3 proof copy; Arabic APPROVED by the Product Owner, 2026-10-19' },
  save: { ar: 'حفظ', en: 'Save', status: 'APPROVED', enStatus: 'PROPOSED', source: 'S7-02; Arabic APPROVED by the Product Owner, 2026-10-19' },
  cancel: { ar: 'إلغاء', en: 'Cancel', status: 'APPROVED', enStatus: 'APPROVED', source: 'S4-01 Product Copy Gate' },
  openHead: {
    ar: 'إعادة العرض التي تشمل آخر رسالة لا يمكن عرضها إلا بعد أن تستمر المحادثة.',
    en: 'A Replay that includes the newest message can be shown only after the conversation continues.',
    status: 'APPROVED', enStatus: 'PROPOSED', source: 'S7-02 (S7-01 record §8.1, MOMENT_NOT_SEALED); Arabic APPROVED by the Product Owner, 2026-10-19',
  },
  savedWhole: { ar: 'حُفظت المحادثة كاملة لإعادة العرض.', en: 'The whole conversation was saved for a Replay.', status: 'APPROVED', enStatus: 'PROPOSED', source: 'S7-02; Arabic APPROVED by the Product Owner, 2026-10-19' },
  savedPart: { ar: 'حُفظ الجزء المختار لإعادة العرض.', en: 'The chosen part was saved for a Replay.', status: 'APPROVED', enStatus: 'PROPOSED', source: 'S7-02; Arabic APPROVED by the Product Owner, 2026-10-19' },
  changed: { ar: 'تغيّر شيء منذ التحديد. يُرجى التحديد من جديد.', en: 'Something changed since this was chosen. Please choose again.', status: 'APPROVED', enStatus: 'PROPOSED', source: 'S7-02 (CHANGED, SOURCE_CHANGED); Arabic APPROVED by the Product Owner, 2026-10-19' },
  notProvable: { ar: 'لا يمكن حفظ هذا الاختيار كجزء واحد متصل.', en: "This selection can't be saved as one continuous part.", status: 'APPROVED', enStatus: 'PROPOSED', source: 'S7-02; Arabic APPROVED by the Product Owner, 2026-10-19' },
  unconfirmed: { ar: 'تعذّر التأكد من الحفظ.', en: "It couldn't be confirmed that this was saved.", status: 'APPROVED', enStatus: 'PROPOSED', source: 'S7-02 (after the approved W1A-01 sendUnconfirmed); Arabic APPROVED by the Product Owner, 2026-10-19' },
  tryAgain: { ar: 'إعادة المحاولة', en: 'Try again', status: 'APPROVED', enStatus: 'APPROVED', source: 'VI-01 T03 (W1A-01 tryAgain)' },
  notAvailable: { ar: 'هذا غير متاح الآن.', en: "This isn't available right now.", status: 'APPROVED', enStatus: 'APPROVED', source: 'S4-01 Product Copy Gate' },
  failed: { ar: 'تعذّر ذلك الآن.', en: "That didn't work right now.", status: 'APPROVED', enStatus: 'APPROVED', source: 'S4-01 Product Copy Gate' },
} satisfies Record<string, Row>);

/** The message count of a selection, by Arabic number grammar (MSA) and English plural. S7-02; Arabic APPROVED by the Product Owner, 2026-10-19. */
const COUNT = Object.freeze({
  status: 'APPROVED' as ReplayCopyStatus,
  enStatus: 'PROPOSED' as ReplayCopyStatus,
  ar: (n: number) => (n === 1 ? 'رسالة واحدة' : n === 2 ? 'رسالتان' : n >= 3 && n <= 10 ? `${n} رسائل` : `${n} رسالة`),
  en: (n: number) => (n === 1 ? '1 message' : `${n} messages`),
});

export const REPLAY_ENTRY_COPY_GATE = Object.freeze({
  status: 'S7-02 PRODUCT COPY GATE — CLOSED — 11 Arabic rows APPROVED word for word by the Product Owner on 2026-10-19 (the message count included); no English row approved by it',
  approved: [...Object.entries(REPLAY_ENTRY_COPY_ROWS).filter(([, row]) => row.status === 'APPROVED').map(([key]) => key), 'count'],
  locked: Object.entries(REPLAY_ENTRY_COPY_ROWS).filter(([, row]) => row.status === 'LOCKED').map(([key]) => key),
  englishProposed: [...Object.entries(REPLAY_ENTRY_COPY_ROWS).filter(([, row]) => row.enStatus === 'PROPOSED').map(([key]) => key), 'count'],
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
