/**
 * S8B-07 CP2-A.1 (R-1 / O-3) — the words of saving a Replay and opening what was saved, from the Product Owner's
 * "CP2-A.1 COPY GATE APPROVED" (2026-11-27), rows RS-01 … RS-05, Arabic and English.
 *
 * Reconciled with the existing registries, nothing duplicated and no approved row changed:
 *
 *   RS-01  «حُفظ الجزء المختار لإعادة العرض» is the S7-02 row `savedPart`, already shown after a part is saved: it stays
 *          that row, verbatim (its final full stop and its approved English included), and is only referenced here
 *   RS-02  new: the saved line's one action, which opens the exact Replay just saved (it replaces the S7-04 «معاينة»
 *          there; the player's own «معاينة» is unchanged)
 *   RS-03  new: said while a save is in flight (the S7-02 registry has no loading sentence, and keeps none)
 *   RS-04  new: said when a save was not done (nothing was saved), with RS-05
 *   RS-05  «إعادة المحاولة» is the existing `tryAgain` (VI-01 T03), verbatim, and is only referenced here
 *
 * The S7-02 and S7-04 Copy Gates stay CLOSED and their rows are untouched.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import { replayEntryCopy } from './copy';

export type ReplaySaveCopyStatus = 'APPROVED';

interface Row {
  readonly id: 'RS-02' | 'RS-03' | 'RS-04';
  readonly ar: string;
  readonly en: string;
  readonly status: ReplaySaveCopyStatus;
  readonly enStatus: ReplaySaveCopyStatus;
}

const SOURCE = 'S8B-07 CP2-A.1 Copy Gate; Arabic and English APPROVED by the Product Owner, 2026-11-27';

export const REPLAY_SAVE_COPY_ROWS = Object.freeze({
  openReplay: { id: 'RS-02', ar: 'فتح إعادة العرض', en: 'Open Replay', status: 'APPROVED', enStatus: 'APPROVED' },
  saving: { id: 'RS-03', ar: 'جارٍ حفظ إعادة العرض…', en: 'Saving Replay…', status: 'APPROVED', enStatus: 'APPROVED' },
  saveFailed: { id: 'RS-04', ar: 'تعذّر حفظ إعادة العرض', en: "Replay couldn't be saved", status: 'APPROVED', enStatus: 'APPROVED' },
} satisfies Record<string, Row>);

/** RS-01 and RS-05: the existing approved rows they are, by key. */
export const REPLAY_SAVE_REUSED_ROWS = Object.freeze({ 'RS-01': 'savedPart', 'RS-05': 'tryAgain' } as const);

export const REPLAY_SAVE_COPY_GATE = Object.freeze({
  status: 'S8B-07 CP2-A.1 COPY GATE — CLOSED — 2026-11-27, Product Owner decision: RS-01 … RS-05 APPROVED in Arabic and English; RS-01 and RS-05 are existing approved rows, reused verbatim',
  source: SOURCE,
  decidedOn: '2026-11-27',
});

export interface ReplaySaveCopy {
  /** RS-01 (`savedPart`). */
  readonly savedPart: string;
  readonly openReplay: string;
  readonly saving: string;
  readonly saveFailed: string;
  /** RS-05 (`tryAgain`). */
  readonly tryAgain: string;
}

const build = (language: ChromeLanguage): ReplaySaveCopy => {
  const entry = replayEntryCopy(language);
  return Object.freeze({
    savedPart: entry.savedPart,
    openReplay: REPLAY_SAVE_COPY_ROWS.openReplay[language],
    saving: REPLAY_SAVE_COPY_ROWS.saving[language],
    saveFailed: REPLAY_SAVE_COPY_ROWS.saveFailed[language],
    tryAgain: entry.tryAgain,
  });
};
const AR = build('ar');
const EN = build('en');

/** The copy for one Product language. There is no default language. */
export function replaySaveCopy(language: ChromeLanguage): ReplaySaveCopy {
  return language === 'ar' ? AR : EN;
}
