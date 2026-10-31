/**
 * S8B-03 (CP2) — every word a Voice Note shows, from the Product Copy Gate of contract v1.2 §7. Rows C-12 … C-53 were
 * APPROVED verbatim, Arabic and English, by the Product Owner (C-12 on 2026-10-31 with CP1; C-13 … C-53 on 2026-10-31
 * for CP2). The consent rows C-01 … C-11 are the server's version `VOICE_RECORDING_V1` (installed by migration 0186 and
 * served by `GET /voice/consent`); they are held here only to refuse a consent text that is not exactly the approved one.
 *
 * The record's Copy Gate tables and `tests/s8b-03-personal-voice-notes-contract.test.mjs` pin every row character for
 * character. Changing one is a Copy Gate change, never an edit.
 */
import type { ChromeLanguage } from '../orientation-chrome/types';

export interface VoiceNoteCopyRow {
  readonly id: string;
  readonly ar: string;
  readonly en: string;
}

export const VOICE_CONSENT_VERSION = 'VOICE_RECORDING_V1';

/** C-01 … C-11, version VOICE_RECORDING_V1, exactly as the server installs them (0186). */
export const VOICE_CONSENT_COPY_ROWS: readonly VoiceNoteCopyRow[] = [
  { id: 'C-01', ar: 'التسجيل الصوتي في قنديل', en: 'Voice recording in Qandeel' },
  { id: 'C-02', ar: 'تُحفظ كل رسالة صوتية تُرسل إلى قنديل تسجيلًا صوتيًا.', en: 'Each voice message sent to Qandeel is kept as an audio recording.' },
  {
    id: 'C-03',
    ar: 'تُحفظ التسجيلات 30 يومًا من وصولها إلى قنديل، ثم تُحذف تلقائيًا. ويمكن حذف أي تسجيل قبل ذلك.',
    en: 'Recordings are kept for 30 days after they reach Qandeel, then deleted automatically. Any recording can be deleted sooner.',
  },
  {
    id: 'C-04',
    ar: 'يُحوَّل التسجيل إلى نص يفهمه قنديل ويرد عليه، ويمكن الاستماع إليه طوال مدة حفظه.',
    en: 'The recording is converted to text that Qandeel understands and replies to, and it can be listened to while it\'s kept.',
  },
  {
    id: 'C-05',
    ar: 'يبقى النص المستخرج في المحادثة بعد حذف التسجيل أو انتهاء مدته، ويبقى ما تذكّره قنديل منه حتى يُصحَّح أو يُطلب نسيانه.',
    en: 'The transcribed text stays in the conversation after the recording is deleted or expires, and what Qandeel remembers from it stays until it\'s corrected or forgotten on request.',
  },
  {
    id: 'C-06',
    ar: 'يحوّل مزوّد خدمة خارجي الكلام إلى نص، ويطلب قنديل منه حذف التسجيل بعد التحويل مباشرة.',
    en: 'An external service provider converts speech to text, and Qandeel asks it to delete the recording right after conversion.',
  },
  { id: 'C-07', ar: 'قد يلتقط التسجيل أصواتًا قريبة.', en: 'A recording may capture nearby voices.' },
  { id: 'C-08', ar: 'النسخة التي تُنزَّل أو تُشارَك تخرج من قنديل ولا يمكن استرجاعها.', en: 'A downloaded or shared copy leaves Qandeel and cannot be recalled.' },
  {
    id: 'C-09',
    ar: 'يمكن سحب الموافقة في أي وقت من الإعدادات. سحبها يوقف الرسائل الصوتية الجديدة ولا يحذف التسجيلات الحالية.',
    en: 'Consent can be withdrawn at any time in Settings. Withdrawing it stops new voice messages and doesn\'t delete existing recordings.',
  },
  { id: 'C-10', ar: 'أوافق وأتابع', en: 'Agree and continue' },
  { id: 'C-11', ar: 'ليس الآن', en: 'Not now' },
];

/** C-12 … C-53, APPROVED verbatim. */
export const VOICE_NOTE_COPY_ROWS: readonly VoiceNoteCopyRow[] = [
  {
    id: 'C-12',
    ar: 'يستخدم قنديل الميكروفون عند تسجيل الرسائل الصوتية وأثناء المكالمات، ولا يستخدمه لتشغيل التسجيلات.',
    en: 'Qandeel uses the microphone when recording voice messages and during calls. It isn\'t used to play recordings.',
  },
  { id: 'C-13', ar: 'رسالة صوتية', en: 'Voice message' },
  { id: 'C-14', ar: 'جارٍ التسجيل', en: 'Recording' },
  { id: 'C-15', ar: 'إلغاء التسجيل', en: 'Cancel recording' },
  { id: 'C-16', ar: 'إرسال الرسالة الصوتية', en: 'Send voice message' },
  {
    id: 'C-17',
    ar: 'توقّف التسجيل عند مغادرة شاشة المحادثة، وحُفظ مسودةً على هذا الجهاز.',
    en: 'Recording stopped when the conversation screen was left. It\'s saved as a draft on this device.',
  },
  {
    id: 'C-18',
    ar: 'توقّف التسجيل بسبب مقاطعة صوتية، وحُفظ مسودةً على هذا الجهاز.',
    en: 'Recording stopped because of an audio interruption. It\'s saved as a draft on this device.',
  },
  { id: 'C-19', ar: 'بلغ التسجيل الحد الأقصى للمدة، وحُفظ مسودةً.', en: 'The recording reached its maximum length and was saved as a draft.' },
  { id: 'C-20', ar: 'حذف المسودة', en: 'Delete draft' },
  { id: 'C-21', ar: 'الميكروفون غير متاح لقنديل. الكتابة متاحة.', en: 'The microphone isn\'t available to Qandeel. Writing is available.' },
  { id: 'C-22', ar: 'فتح الإعدادات', en: 'Open Settings' },
  { id: 'C-23', ar: 'تعذّرت استعادة المسودة.', en: 'The draft couldn\'t be restored.' },
  { id: 'C-24', ar: 'جارٍ إرسال الرسالة الصوتية', en: 'Sending voice message' },
  { id: 'C-25', ar: 'لم تُرسَل الرسالة الصوتية. ما زالت محفوظة على هذا الجهاز.', en: 'The voice message wasn\'t sent. It\'s still saved on this device.' },
  { id: 'C-26', ar: 'إعادة المحاولة', en: 'Try again' },
  { id: 'C-27', ar: 'جارٍ تحويل الرسالة إلى نص', en: 'Converting the message to text' },
  { id: 'C-28', ar: 'تعذّر تحويل الرسالة إلى نص الآن. التسجيل محفوظ.', en: 'The message couldn\'t be converted to text right now. The recording is saved.' },
  {
    id: 'C-29',
    ar: 'تعذّر تحويل هذه الرسالة إلى نص. يمكن الاستماع إليها أو حذفها، والكتابة متاحة.',
    en: 'This message couldn\'t be converted to text. It can be listened to or deleted, and writing is available.',
  },
  { id: 'C-30', ar: 'لم يُتعرَّف على كلام في هذه الرسالة.', en: 'No speech was recognized in this message.' },
  { id: 'C-31', ar: 'الرسائل الصوتية غير متاحة الآن. الكتابة متاحة.', en: 'Voice messages aren\'t available right now. Writing is available.' },
  { id: 'C-32', ar: 'تحتاج الرسائل الصوتية إلى الموافقة على التسجيل.', en: 'Voice messages need consent to recording.' },
  {
    id: 'C-33',
    ar: 'لم تُعالَج هذه الرسالة لأن الموافقة على التسجيل مسحوبة. التسجيل محفوظ.',
    en: 'This message wasn\'t processed because recording consent was withdrawn. The recording is saved.',
  },
  { id: 'C-34', ar: 'تشغيل الرسالة الصوتية / إيقاف الرسالة الصوتية مؤقتًا', en: 'Play voice message / Pause voice message' },
  { id: 'C-35', ar: 'اعرض النص / أخفِ النص', en: 'Show text / Hide text' },
  { id: 'C-36', ar: 'نص مستخرج آليًا، وقد يحتوي على أخطاء', en: 'Automatically transcribed text; it may contain errors' },
  { id: 'C-37', ar: 'انتهت مدة الاحتفاظ بالتسجيل', en: 'The recording\'s retention period has ended' },
  { id: 'C-38', ar: 'حُذف التسجيل', en: 'The recording was deleted' },
  { id: 'C-39', ar: 'تعذّر تشغيل الرسالة الآن', en: 'The message can\'t be played right now' },
  { id: 'C-40', ar: 'متاحة حتى {date}', en: 'Available until {date}' },
  { id: 'C-41', ar: 'حذف التسجيل', en: 'Delete recording' },
  {
    id: 'C-42',
    ar: 'سيُحذف التسجيل الصوتي نهائيًا. يبقى النص المستخرج في المحادثة، ويبقى ما تذكّره قنديل منه حتى يُصحَّح أو يُطلب نسيانه.',
    en: 'The voice recording will be deleted permanently. The transcribed text stays in the conversation, and what Qandeel remembers from it stays until it\'s corrected or forgotten on request.',
  },
  { id: 'C-43', ar: 'حذف / إلغاء', en: 'Delete / Cancel' },
  { id: 'C-44', ar: 'الرسائل الصوتية', en: 'Voice messages' },
  { id: 'C-45', ar: 'تُحفظ التسجيلات الصوتية 30 يومًا من وصولها إلى قنديل، ثم تُحذف تلقائيًا.', en: 'Voice recordings are kept for 30 days after they reach Qandeel, then deleted automatically.' },
  { id: 'C-46', ar: 'سحب الموافقة على التسجيل', en: 'Withdraw recording consent' },
  {
    id: 'C-47',
    ar: 'لن تُرسل رسائل صوتية جديدة، ولن تُعالَج الرسائل التي لم يكتمل تحويلها إلى نص. تبقى التسجيلات الحالية متاحة للاستماع والحذف والحفظ حتى انتهاء مدتها.',
    en: 'New voice messages can\'t be sent, and messages not yet converted to text won\'t be processed. Existing recordings stay available to listen to, delete and save until their period ends.',
  },
  { id: 'C-48', ar: 'الموافقة على التسجيل مسحوبة', en: 'Recording consent withdrawn' },
  { id: 'C-49', ar: 'حفظ التسجيلات الصوتية', en: 'Save voice recordings' },
  { id: 'C-50', ar: 'حُفظت التسجيلات الصوتية', en: 'Voice recordings saved' },
  { id: 'C-51', ar: 'تعذّر حفظ التسجيلات الصوتية، وحُذفت الملفات التي بدأ حفظها.', en: 'Voice recordings couldn\'t be saved, and the files that had started saving were removed.' },
  { id: 'C-52', ar: 'بعض التسجيلات لم تعد متاحة.', en: 'Some recordings are no longer available.' },
  {
    id: 'C-53',
    ar: 'تعذّر حفظ التسجيلات الصوتية. قد تبقى بعض الملفات في المجلد المختار، ويمكن حذفها منه.',
    en: 'Voice recordings couldn\'t be saved. Some files may remain in the chosen folder and can be deleted from there.',
  },
];

const BY_ID = new Map(VOICE_NOTE_COPY_ROWS.map((row) => [row.id, row]));

/** One approved row in one language. An id that is not a row is a programming error, never a fallback. */
export function voiceNoteText(id: string, language: ChromeLanguage): string {
  const row = BY_ID.get(id);
  if (row === undefined) throw new RangeError(`no approved Voice Note row ${id}`);
  return row[language];
}

/** The two halves of a paired row (C-34 Play / Pause, C-35 Show / Hide, C-43 Delete / Cancel), split at " / ". */
export function voiceNotePair(id: string, language: ChromeLanguage): readonly [string, string] {
  const [first, second] = voiceNoteText(id, language).split(' / ');
  if (first === undefined || second === undefined) throw new RangeError(`row ${id} is not a pair`);
  return [first, second];
}

/** C-40 with its date: the one placeholder an approved row carries. */
export function availableUntilText(language: ChromeLanguage, date: string): string {
  return voiceNoteText('C-40', language).replace('{date}', date);
}

/** The consent text of one language, the eleven rows in order, one per line: what 0186 installs and pins. */
export function voiceConsentText(language: ChromeLanguage): string {
  return VOICE_CONSENT_COPY_ROWS.map((row) => row[language]).join('\n');
}
