/**
 * S7-04 — the ONE place the Replay player's own words are written.
 *
 * Most of what the player says is already approved, and is reused VERBATIM from its owner rather than rewritten here:
 * the title and the Analysis entry's name «إعادة عرض المحادثة», «المسودة المحفوظة», the open-head limit, «تغيّر شيء منذ
 * التحديد. يُرجى التحديد من جديد.», «تعذّر التأكد من الحفظ.», «إعادة المحاولة», «هذا غير متاح الآن.» and «تعذّر ذلك الآن.»
 * (S7-02 Product Copy Gate, CLOSED); the no-analysis preview limit and every moment sentence (S7-03 Product Copy Gate,
 * CLOSED); the two ways back «المحادثة» and «تحليل المحادثة» (W1A-01, frozen). Neither closed gate is reopened.
 *
 * The rows below are the words S7-04 needs that no earlier gate approved. Every one is PROPOSED — the Arabic AND the
 * English — until the Product Owner decides; shipping a row promotes nothing, and an Arabic approval never carries the
 * English with it (`docs/e2e/QANDEEL_S7_04_IMPLEMENTATION_RECORD_v1.md` §7).
 *
 * Fixed Arabic is simplified Modern Standard Arabic and gender-considerate (LANG-01): nouns and passive forms, no
 * second-person verb that marks gender. No row names a server word, a status value, an id or an engineering term, and
 * no row claims sound, video or the conversation's original timing: the player shows text, at a declared reading pace.
 */
import type { ChromeLanguage } from '../orientation-chrome';

export type ReplayPlayerCopyStatus = 'APPROVED' | 'LOCKED' | 'PROPOSED';

interface Row {
  readonly ar: string;
  readonly en: string;
  readonly status: ReplayPlayerCopyStatus;
  readonly enStatus: ReplayPlayerCopyStatus;
  readonly source: string;
}

/** Not approved: proposed in S7-04, Arabic and English alike. */
const proposed = (ar: string, en: string, source: string): Row => ({ ar, en, status: 'PROPOSED', enStatus: 'PROPOSED', source });

export const REPLAY_PLAYER_COPY_ROWS = Object.freeze({
  // The transport: the player's own controls, and the one sentence that says what the pace is and is not.
  play: proposed('تشغيل', 'Play', 'S7-04 (transport)'),
  pause: proposed('إيقاف مؤقت', 'Pause', 'S7-04 (transport)'),
  restart: proposed('التشغيل من البداية', 'Play from the start', 'S7-04 (transport, at the last moment)'),
  moments: proposed('لحظات إعادة العرض', "The Replay's moments", "S7-04 (the Replay's Temporal Spine, for assistive technology; its value is the APPROVED S7-03 position)"),
  pacing: proposed('تُعرض الرسائل نصًّا بإيقاع مناسب للقراءة، لا بتوقيتها الأصلي.', 'Messages are shown as text at a reading pace, not at their original timing.',
    'S7-04 (the declared presentation pace: no audio, no original timing)'),
  // The private lifecycle.
  preview: proposed('معاينة', 'Preview', 'S7-04 (POST /replay/:id/preview)'),
  finalize: proposed('حفظ نسخة خاصة', 'Save a private copy', 'S7-04 (POST /replay/:id/finalize)'),
  finalized: proposed('نسخة خاصة محفوظة', 'A saved private copy', 'S7-04 (lifecycle FINALIZED, said beside the title)'),
  finalizedNotice: proposed('حُفظت نسخة خاصة من إعادة العرض، ولا تُشارك مع أحد.', "A private copy of the Replay was saved. It isn't shared with anyone.",
    'S7-04 (FINALIZED answered)'),
  reopen: proposed('تعديل إعادة العرض', 'Edit the Replay', 'S7-04 (POST /replay/:id/reopen)'),
  reopenedNotice: proposed('أصبحت إعادة العرض مسودة يمكن تعديلها.', 'The Replay is a draft again and can be edited.', 'S7-04 (reopen answered)'),
  analysisChanged: proposed('تغيّر التحليل منذ المعاينة، فلا يمكن حفظ هذه النسخة.', "The analysis changed since the preview, so this version can't be saved.",
    'S7-04 (finalize ANALYSIS_CHANGED; the way on is «تعديل إعادة العرض», then a new preview)'),
  commandUnconfirmed: proposed('تعذّر التأكد من إتمام ذلك.', "It couldn't be confirmed that this was done.",
    'S7-04 (preview / reopen OUTCOME_UNKNOWN; finalize reuses the APPROVED S7-02 `unconfirmed`)'),
} satisfies Record<string, Row>);

export const REPLAY_PLAYER_COPY_GATE = Object.freeze({
  status: 'S7-04 PRODUCT COPY GATE — OPEN — 13 Arabic rows PROPOSED and 13 English rows PROPOSED; awaiting the Product Owner',
  arabicProposed: Object.keys(REPLAY_PLAYER_COPY_ROWS),
  englishProposed: Object.keys(REPLAY_PLAYER_COPY_ROWS),
});

export type ReplayPlayerCopy = { readonly [K in keyof typeof REPLAY_PLAYER_COPY_ROWS]: string };

const build = (language: ChromeLanguage): ReplayPlayerCopy =>
  Object.freeze(Object.fromEntries(Object.entries(REPLAY_PLAYER_COPY_ROWS).map(([key, row]) => [key, row[language]])) as ReplayPlayerCopy);
const AR = build('ar');
const EN = build('en');

/** The copy for one Product language. There is no default language. */
export function replayPlayerCopy(language: ChromeLanguage): ReplayPlayerCopy {
  return language === 'ar' ? AR : EN;
}
