/**
 * S8B-06 CP2 — the words the native call layer shows outside the app (the Android CallStyle notification and its channel,
 * the CallKit display name) and the 60-minute warning's lines. Every row is a S8B-05 record §9.2 row, character for
 * character, and every one is still PROPOSED: CP2 approves no copy (the Copy Gate is the Product Owner's). Until the gate
 * decides, these rows are what the mechanism carries; replacing a row's words is a Copy Gate change, never a code change.
 *
 * S8B-06 CP3 — the call UI's words join the same ONE table: the S8B-05 record's §9.1 / §9.2 rows the call screen shows, and
 * the four rows CP3 drafts (LC-19 … LC-22, in the CP3 record's §4 gate table). The two gaps CP2 left are closed by drafted
 * rows of their own: the T-1 notification line is LC-19 (CP2 used LC-07) and the Android channel name is LC-20 (CP2 used
 * LC-11). Every row is still PROPOSED: CP3 approves no copy either.
 */
import type { ChromeLanguage } from '../orientation-chrome/types';

export interface LiveCallCopyRow {
  readonly id: string;
  readonly status: 'PROPOSED';
  readonly ar: string;
  readonly en: string;
}

export const LIVE_CALL_COPY_ROWS: readonly LiveCallCopyRow[] = [
  { id: 'LCE-01', status: 'PROPOSED', ar: 'مكالمة صوتية', en: 'Voice call' },
  { id: 'LCE-02', status: 'PROPOSED', ar: 'مكالمة صوتية', en: 'Voice call' },
  { id: 'LCE-03', status: 'PROPOSED', ar: 'مكالمة صوتية انتهت، مدتها {d}', en: 'Voice call ended, {d}' },
  { id: 'LCE-04', status: 'PROPOSED', ar: 'كتم الميكروفون', en: 'Mute microphone' },
  { id: 'LCE-05', status: 'PROPOSED', ar: 'تشغيل الميكروفون', en: 'Turn microphone on' },
  { id: 'LCE-06', status: 'PROPOSED', ar: 'إنهاء المكالمة', en: 'End call' },
  { id: 'LCE-07', status: 'PROPOSED', ar: 'السماعة الخارجية', en: 'Speaker' },
  { id: 'LCE-08', status: 'PROPOSED', ar: 'المكالمة مستمرة', en: 'the call continues' },
  { id: 'LCE-09', status: 'PROPOSED', ar: 'جاري الاتصال', en: 'Connecting' },
  { id: 'LCE-10', status: 'PROPOSED', ar: 'الميكروفون شغّال', en: 'Microphone on' },
  { id: 'LCE-11', status: 'PROPOSED', ar: 'الميكروفون مكتوم', en: 'Microphone muted' },
  { id: 'LCE-12', status: 'PROPOSED', ar: 'مدة المكالمة {d}', en: 'Call time {d}' },
  { id: 'LCE-19', status: 'PROPOSED', ar: 'الاتصال انقطع. جاري إعادة الاتصال.', en: 'The call dropped. Reconnecting.' },
  { id: 'LCE-20', status: 'PROPOSED', ar: 'المكالمة وقفت. الكتابة متاحة.', en: "The call isn't working. You can keep going in writing." },
  { id: 'LCE-21', status: 'PROPOSED', ar: 'الميكروفون غير متاح لقنديل. الكتابة متاحة.', en: "The microphone isn't available to Qandeel. Writing is available." },
  { id: 'LC-01', status: 'PROPOSED', ar: 'صوت المكالمة بيتحفظ ٣٠ يوم من بدايتها.', en: "The call's audio is kept for 30 days from its start." },
  { id: 'LC-02', status: 'PROPOSED', ar: 'المكالمات مشغولة دلوقتي. جرّب كمان شوية، والكتابة متاحة.', en: 'Calls are busy right now. Try again shortly; writing is available.' },
  { id: 'LC-03', status: 'PROPOSED', ar: 'المكالمة شغّالة على جهاز تاني.', en: 'The call is active on another device.' },
  { id: 'LC-04', status: 'PROPOSED', ar: 'بيرجع الاتصال…', en: 'Reconnecting…' },
  { id: 'LC-05', status: 'PROPOSED', ar: 'المكالمة خلصت بعد ٦٠ دقيقة. تقدر تكمّل كتابة أو تبدأ مكالمة جديدة.', en: 'The call ended after 60 minutes. You can keep going in writing or start a new call.' },
  { id: 'LC-06', status: 'PROPOSED', ar: 'فاضل خمس دقايق على نهاية المكالمة.', en: 'Five minutes left in this call.' },
  { id: 'LC-07', status: 'PROPOSED', ar: 'فاضل دقيقة على نهاية المكالمة.', en: 'One minute left in this call.' },
  { id: 'LC-08', status: 'PROPOSED', ar: 'قنديل محتاج إذن الميكروفون علشان المكالمة. الكتابة متاحة.', en: 'Qandeel needs microphone access for the call. Writing is available.' },
  { id: 'LC-09', status: 'PROPOSED', ar: 'افتح الإعدادات', en: 'Open settings' },
  { id: 'LC-10', status: 'PROPOSED', ar: 'المكالمة متوقفة مؤقتًا بسبب مكالمة تانية.', en: 'The call is paused for another call.' },
  { id: 'LC-11', status: 'PROPOSED', ar: 'مكالمة مع QANDEEL', en: 'Call with QANDEEL' },
  { id: 'LC-12', status: 'PROPOSED', ar: 'QANDEEL', en: 'QANDEEL' },
  { id: 'LC-13', status: 'PROPOSED', ar: 'تنتهي المكالمة خلال 5 دقائق', en: 'The call ends in 5 minutes' },
  { id: 'LC-15', status: 'PROPOSED', ar: 'قوطِع', en: 'Interrupted' },
  { id: 'LC-16', status: 'PROPOSED', ar: 'المكالمة محتاجة موافقتك على تسجيل الصوت.', en: 'A call needs your consent to voice recording.' },
  { id: 'LC-17', status: 'PROPOSED', ar: 'المكالمات مش متاحة دلوقتي. الكتابة متاحة.', en: "Calls aren't available right now. Writing is available." },
  { id: 'LC-18', status: 'PROPOSED', ar: 'عندك مكالمة شغّالة بالفعل.', en: 'You already have a call in progress.' },
  { id: 'LC-19', status: 'PROPOSED', ar: 'تنتهي المكالمة خلال دقيقة', en: 'The call ends in 1 minute' },
  { id: 'LC-20', status: 'PROPOSED', ar: 'المكالمات', en: 'Calls' },
  { id: 'LC-21', status: 'PROPOSED', ar: 'وقفت', en: 'stopped' },
  { id: 'LC-22', status: 'PROPOSED', ar: 'قنديل بيتكلم', en: 'QANDEEL is speaking' },
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
    channelName: t('LC-20'),
    ongoing: t('LC-11'),
    reconnecting: t('LC-04'),
    held: t('LC-10'),
    warningT5: t('LC-06'),
    warningT1: t('LC-07'),
    notificationT5: t('LC-13'),
    notificationT1: t('LC-19'),
  };
}

/** S8B-06 CP3 — why a call did not start, or ended without the person choosing it, as the call screen names it. */
export type LiveCallNotice =
  | 'MIC_PERMISSION' | 'CAPACITY' | 'OTHER_DEVICE' | 'ALREADY_IN_CALL' | 'CONSENT' | 'NOT_AVAILABLE' | 'MAX_LENGTH' | 'MICROPHONE_LOST' | 'STOPPED';

/** S8B-06 CP3 — the call screen's words (the call UI over DepthComposition, the record, the notices), in one language. */
export interface LiveCallScreenCopy {
  readonly entryName: string;
  readonly recordWord: string;
  /** The record's accessible summary; `{d}` is the length, already formatted. */
  readonly recordSummary: (length: string) => string;
  readonly recordStopped: string;
  readonly mute: string;
  readonly unmute: string;
  readonly route: string;
  readonly endCall: string;
  readonly continues: string;
  /** LCE-08 as the depth controls' accessible suffix, with the script's own joining comma. */
  readonly continuesSuffix: string;
  readonly connecting: string;
  readonly microphoneOn: string;
  readonly microphoneMuted: string;
  readonly elapsedName: (length: string) => string;
  readonly reconnecting: string;
  readonly held: string;
  readonly speaking: string;
  readonly interrupted: string;
  readonly disclosure: string;
  readonly warningT5: string;
  readonly warningT1: string;
  readonly openSettings: string;
  readonly notice: Readonly<Record<LiveCallNotice, string>>;
}

export function liveCallScreenCopy(language: ChromeLanguage): LiveCallScreenCopy {
  const t = (id: string) => liveCallText(id, language);
  const fill = (id: string) => (length: string) => t(id).replace('{d}', length);
  return {
    entryName: t('LCE-01'),
    recordWord: t('LCE-02'),
    recordSummary: fill('LCE-03'),
    recordStopped: t('LC-21'),
    mute: t('LCE-04'),
    unmute: t('LCE-05'),
    route: t('LCE-07'),
    endCall: t('LCE-06'),
    continues: t('LCE-08'),
    continuesSuffix: (language === 'ar' ? '، ' : ', ') + t('LCE-08'),
    connecting: t('LCE-09'),
    microphoneOn: t('LCE-10'),
    microphoneMuted: t('LCE-11'),
    elapsedName: fill('LCE-12'),
    reconnecting: t('LCE-19'),
    held: t('LC-10'),
    speaking: t('LC-22'),
    interrupted: t('LC-15'),
    disclosure: t('LC-01'),
    warningT5: t('LC-06'),
    warningT1: t('LC-07'),
    openSettings: t('LC-09'),
    notice: {
      MIC_PERMISSION: t('LC-08'),
      CAPACITY: t('LC-02'),
      OTHER_DEVICE: t('LC-03'),
      ALREADY_IN_CALL: t('LC-18'),
      CONSENT: t('LC-16'),
      NOT_AVAILABLE: t('LC-17'),
      MAX_LENGTH: t('LC-05'),
      MICROPHONE_LOST: t('LCE-21'),
      STOPPED: t('LCE-20'),
    },
  };
}
