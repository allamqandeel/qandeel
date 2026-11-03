/**
 * S8B-06 CP2 — the words the native call layer shows outside the app (the Android CallStyle notification and its channel,
 * the CallKit display name) and the 60-minute warning's lines. Every row is a S8B-05 record §9.2 row, character for
 * character, and every one is still PROPOSED: CP2 approves no copy (the Copy Gate is the Product Owner's). Until the gate
 * decides, these rows are what the mechanism carries; replacing a row's words is a Copy Gate change, never a code change.
 *
 * Two gaps the gate must close (no row exists yet, so CP2 uses the nearest drafted row, named here and in the record):
 *   - the T-1 notification line (T-5 has LC-13): LC-07, the T-1 visible line, stands in;
 *   - the Android notification channel's name (shown in the system's notification settings): LC-11 stands in.
 */
import type { ChromeLanguage } from '../orientation-chrome/types';

export interface LiveCallCopyRow {
  readonly id: string;
  readonly status: 'PROPOSED';
  readonly ar: string;
  readonly en: string;
}

export const LIVE_CALL_COPY_ROWS: readonly LiveCallCopyRow[] = [
  { id: 'LC-04', status: 'PROPOSED', ar: 'بيرجع الاتصال…', en: 'Reconnecting…' },
  { id: 'LC-06', status: 'PROPOSED', ar: 'فاضل خمس دقايق على نهاية المكالمة.', en: 'Five minutes left in this call.' },
  { id: 'LC-07', status: 'PROPOSED', ar: 'فاضل دقيقة على نهاية المكالمة.', en: 'One minute left in this call.' },
  { id: 'LC-10', status: 'PROPOSED', ar: 'المكالمة متوقفة مؤقتًا بسبب مكالمة تانية.', en: 'The call is paused for another call.' },
  { id: 'LC-11', status: 'PROPOSED', ar: 'مكالمة مع QANDEEL', en: 'Call with QANDEEL' },
  { id: 'LC-12', status: 'PROPOSED', ar: 'QANDEEL', en: 'QANDEEL' },
  { id: 'LC-13', status: 'PROPOSED', ar: 'تنتهي المكالمة خلال 5 دقائق', en: 'The call ends in 5 minutes' },
];

const BY_ID = new Map(LIVE_CALL_COPY_ROWS.map((row) => [row.id, row]));

export function liveCallText(id: string, language: ChromeLanguage): string {
  const row = BY_ID.get(id);
  if (row === undefined) throw new RangeError(`no Live Call row ${id}`);
  return row[language];
}

/** The native call surface's lines, in one language. */
export interface LiveCallSurfaceCopy {
  readonly displayName: string;
  readonly notificationTitle: string;
  readonly channelName: string;
  readonly ongoing: string;
  readonly reconnecting: string;
  readonly held: string;
  readonly warningT5: string;
  readonly warningT1: string;
  readonly notificationT5: string;
  readonly notificationT1: string;
}

export function liveCallSurfaceCopy(language: ChromeLanguage): LiveCallSurfaceCopy {
  const t = (id: string) => liveCallText(id, language);
  return {
    displayName: t('LC-12'),
    notificationTitle: t('LC-12'),
    channelName: t('LC-11'),
    ongoing: t('LC-11'),
    reconnecting: t('LC-04'),
    held: t('LC-10'),
    warningT5: t('LC-06'),
    warningT1: t('LC-07'),
    notificationT5: t('LC-13'),
    notificationT1: t('LC-07'),
  };
}
