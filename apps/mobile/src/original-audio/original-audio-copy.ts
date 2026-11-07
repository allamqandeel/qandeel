/**
 * S8B-07 CP1-B — the Copy Gate R1.1 rows of retained call listening (Sheet A, `CL-*`) and of the original-audio Replay
 * player (Sheet B, `RA-*`): 11 + 17 = 28 rows, each APPROVED in Arabic and English by the Product Owner on 2026-11-07
 * (`CP1-B_COPY_GATE_R1.1_FINAL.md`; CL-11 without its final full stop in both languages). The text is generated from that
 * file, never retyped; `tests/s8b-07-cp1b-mobile-playback-contract.test.mjs` pins every row against the S8B-07 record.
 *
 * Display rules carried here, not decided here:
 *   - CL-06 / CL-07 / RA-09 / RA-10 appear only for a cause the SERVER proves (`reason`); otherwise CL-11 / RA-17. The
 *     phone never infers a cause (V-30).
 *   - `NOT_SPEAKING` has no text. D-05.7 is option (b): no cue and no sound asset.
 *   - Every row stays behind `PERSONAL_LIVE_CALL` (Sheet A) or `PERSONAL_REPLAY` (Sheet B); both gates stay closed.
 */
import type { ChromeLanguage } from '../orientation-chrome/types';

export type OriginalAudioCopyId =
  | 'CL-01' | 'CL-02' | 'CL-03' | 'CL-04' | 'CL-05' | 'CL-06' | 'CL-07' | 'CL-08' | 'CL-09' | 'CL-10' | 'CL-11'
  | 'RA-01' | 'RA-02' | 'RA-03' | 'RA-04' | 'RA-05' | 'RA-06' | 'RA-07' | 'RA-08' | 'RA-09' | 'RA-10' | 'RA-11' | 'RA-12'
  | 'RA-13' | 'RA-14' | 'RA-15' | 'RA-16' | 'RA-17';

export interface OriginalAudioCopyRow {
  readonly id: OriginalAudioCopyId;
  readonly status: 'APPROVED';
  readonly ar: string;
  readonly en: string;
}

export const ORIGINAL_AUDIO_COPY_GATE = Object.freeze({
  status: 'COPY GATE R1.1 — APPROVED',
  decidedOn: '2026-11-07',
  rows: 28,
});

export const ORIGINAL_AUDIO_COPY_ROWS: readonly OriginalAudioCopyRow[] = Object.freeze([
  { id: 'CL-01', status: 'APPROVED', ar: 'تشغيل تسجيل المكالمة', en: 'Play call recording' },
  { id: 'CL-02', status: 'APPROVED', ar: 'إيقاف تسجيل المكالمة مؤقتًا', en: 'Pause call recording' },
  { id: 'CL-03', status: 'APPROVED', ar: 'تسجيل المكالمة', en: 'Call recording' },
  { id: 'CL-04', status: 'APPROVED', ar: 'جارٍ تحضير التشغيل…', en: 'Getting playback ready…' },
  { id: 'CL-05', status: 'APPROVED', ar: 'تعذّر تشغيل تسجيل المكالمة الآن', en: 'The call recording can\'t be played right now' },
  { id: 'CL-06', status: 'APPROVED', ar: 'انتهت مدة الاحتفاظ بتسجيل المكالمة', en: 'The call recording\'s retention period has ended' },
  { id: 'CL-07', status: 'APPROVED', ar: 'حُذف تسجيل المكالمة', en: 'The call recording was deleted' },
  { id: 'CL-08', status: 'APPROVED', ar: 'يُحتفظ بالتسجيل حتى {date} كحدٍّ أقصى', en: 'The recording is kept until {date} at the latest' },
  { id: 'CL-09', status: 'APPROVED', ar: 'إعادة عرض من هذه المكالمة', en: 'Replay from this call' },
  { id: 'CL-10', status: 'APPROVED', ar: 'جارٍ تجهيز التسجيل', en: 'The recording is being prepared' },
  { id: 'CL-11', status: 'APPROVED', ar: 'تسجيل هذه المكالمة غير متاح', en: 'This call\'s recording isn\'t available' },
  { id: 'RA-01', status: 'APPROVED', ar: 'يُسمع الصوت داخل المقاطع المختارة بتوقيته الأصلي، وقد تُختصر الفواصل بينها مع الإشارة إلى ذلك.', en: 'Audio in the selected passages keeps its original timing; pauses between them may be shortened, and are marked when they are.' },
  { id: 'RA-02', status: 'APPROVED', ar: 'يُسمع الصوت داخل المقاطع المختارة بتوقيته الأصلي، وقد تُختصر الفواصل بينها مع الإشارة إلى ذلك. وتُعرض الرسائل المكتوبة بإيقاع مناسب للقراءة.', en: 'Audio in the selected passages keeps its original timing; pauses between them may be shortened, and are marked when they are. Written messages are shown at a reading pace.' },
  { id: 'RA-03', status: 'APPROVED', ar: 'نص مستخرج آليًا من الصوت، وليس الصوت الأصلي', en: 'Text transcribed from the audio, not the original audio' },
  { id: 'RA-04', status: 'APPROVED', ar: 'مضى هنا {d} في التسجيل، واختُصر هذا الفاصل عند الاستماع.', en: '{d} passed here in the recording; this interval is shortened for listening.' },
  { id: 'RA-05', status: 'APPROVED', ar: 'من تسجيل آخر.', en: 'From another recording.' },
  { id: 'RA-06', status: 'APPROVED', ar: 'انقطع الاتصال هنا {d}.', en: 'The connection dropped here for {d}.' },
  { id: 'RA-07', status: 'APPROVED', ar: 'كان الميكروفون مكتومًا هنا {d}.', en: 'The microphone was muted here for {d}.' },
  { id: 'RA-08', status: 'APPROVED', ar: 'فُقد هنا جزء من التسجيل مدته {d}.', en: 'A {d} part of the recording was lost here.' },
  { id: 'RA-09', status: 'APPROVED', ar: 'انتهت مدة الاحتفاظ بالتسجيل الأصلي، فلم يعد تشغيل إعادة العرض هذه ممكنًا.', en: 'The original recording\'s retention period has ended, so this Replay can no longer play.' },
  { id: 'RA-10', status: 'APPROVED', ar: 'حُذف التسجيل الأصلي، فلم يعد تشغيل إعادة العرض هذه ممكنًا.', en: 'The original recording was deleted, so this Replay can no longer play.' },
  { id: 'RA-11', status: 'APPROVED', ar: 'يُجهَّز الصوت…', en: 'Preparing the audio…' },
  { id: 'RA-12', status: 'APPROVED', ar: 'تعذّر تشغيل الصوت الآن.', en: 'The audio can\'t be played right now.' },
  { id: 'RA-13', status: 'APPROVED', ar: 'مقطع صوتي كامل · {d}', en: 'A whole voice passage · {d}' },
  { id: 'RA-14', status: 'APPROVED', ar: 'صوت هذه اللحظة', en: 'This moment\'s audio' },
  { id: 'RA-15', status: 'APPROVED', ar: 'يُسمع صوتان معًا هنا.', en: 'Two voices are heard together here.' },
  { id: 'RA-16', status: 'APPROVED', ar: 'يُختار هذا المقطع الصوتي كاملًا', en: 'This voice passage is selected as a whole' },
  { id: 'RA-17', status: 'APPROVED', ar: 'لم يعد تشغيل إعادة العرض هذه ممكنًا.', en: 'This Replay can no longer play.' },
]);

const BY_ID: ReadonlyMap<string, OriginalAudioCopyRow> = new Map(ORIGINAL_AUDIO_COPY_ROWS.map((row) => [row.id, row]));

/** One approved row in the reader's language; an unknown id is a defect, never a fallback. */
export function originalAudioText(id: OriginalAudioCopyId, language: ChromeLanguage): string {
  const row = BY_ID.get(id);
  if (row === undefined) throw new RangeError(`no approved original-audio row ${id}`);
  return language === 'ar' ? row.ar : row.en;
}

/** `{d}`: a length in m:ss with Western digits, as the shipped player shows it (the caller sets the LTR island). */
export function lengthText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

/** A row with its `{d}` filled (RA-04, RA-06 … RA-08, RA-13). */
export function originalAudioLengthText(id: 'RA-04' | 'RA-06' | 'RA-07' | 'RA-08' | 'RA-13', language: ChromeLanguage, ms: number): string {
  return originalAudioText(id, language).replace('{d}', lengthText(ms));
}
