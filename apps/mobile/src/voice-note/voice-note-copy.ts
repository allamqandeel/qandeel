/**
 * S8B-03 (CP2) — every word a Voice Note shows, from the Product Copy Gate of contract v1.2 §7. Rows C-12 … C-53 were
 * APPROVED verbatim, Arabic and English, by the Product Owner (C-12 on 2026-10-31 with CP1; C-13 … C-53 on 2026-10-31
 * for CP2). The consent rows are the server's current version (`GET /voice/consent`): `VOICE_RECORDING_V1` (C-01 … C-11,
 * migration 0186) until S8B-04 CP2, which carries `VOICE_RECORDING_V3` (K-01 … K-15, migration 0188; S8B-04 contract test).
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

export const VOICE_CONSENT_VERSION = 'VOICE_RECORDING_V3';

/**
 * K-01 … K-15, version VOICE_RECORDING_V3, exactly as the server installs them (0188) and serves them: V2 with K-07, K-08
 * and K-13 replaced, APPROVED verbatim by the Product Owner at the S8B-04 CP2 gate (2026-11-02). K-14 is the agree button
 * and K-15 the decline, the last two rows. Held here only to refuse a consent text that is not exactly the approved one.
 */
export const VOICE_CONSENT_COPY_ROWS: readonly VoiceNoteCopyRow[] = [
  { id: 'K-01', ar: 'التسجيل الصوتي وصوت قنديل', en: 'Voice recording and Qandeel\'s voice' },
  {
    id: 'K-02',
    ar: 'تُحفظ كل رسالة صوتية تُرسل إلى قنديل تسجيلًا صوتيًا. وإذا استخدمت المكالمات مع قنديل عند توفرها، تُحفظ كل مكالمة تسجيلًا صوتيًا يشمل صوت قنديل كما سُمع فيها.',
    en: 'Each voice message sent to Qandeel is kept as an audio recording. If you use calls with Qandeel once they\'re available, each call is kept as an audio recording that includes Qandeel\'s voice as heard in it.',
  },
  {
    id: 'K-03',
    ar: 'تُحفظ الرسالة الصوتية 30 يومًا من وصولها إلى قنديل، وتُحفظ المكالمة 30 يومًا من بدايتها، ثم يُحذف التسجيل تلقائيًا. ويمكن حذف أي تسجيل قبل ذلك.',
    en: 'A voice message is kept for 30 days after it reaches Qandeel, and a call for 30 days from its start; then the recording is deleted automatically. Any recording can be deleted sooner.',
  },
  {
    id: 'K-04',
    ar: 'يُحوَّل الكلام إلى نص يفهمه قنديل ويرد عليه، ويمكن الاستماع إلى التسجيل طوال مدة حفظه.',
    en: 'Speech is converted to text that Qandeel understands and replies to, and the recording can be listened to while it\'s kept.',
  },
  {
    id: 'K-05',
    ar: 'عندما يصبح الصوت متاحًا في إعادة عرض المحادثة، يمكن استخدام التسجيل فيها خلال مدة حفظه، وبطلب منك فقط.',
    en: 'When audio becomes available in Conversation replay, a recording can be used in it while it\'s kept, and only when you ask.',
  },
  {
    id: 'K-06',
    ar: 'يبقى النص المستخرج في المحادثة بعد حذف التسجيل أو انتهاء مدته، ويبقى ما تذكّره قنديل منه حتى يُصحَّح أو يُطلب نسيانه.',
    en: 'The transcribed text stays in the conversation after the recording is deleted or expires, and what Qandeel remembers from it stays until it\'s corrected or forgotten on request.',
  },
  {
    id: 'K-07',
    ar: 'تحوّل خدمة Speechmatics الكلام إلى نص. أثناء تسجيل رسالة صوتية يُرسل صوتك إليها مباشرةً لتحويله لحظيًا، قبل الضغط على «إرسال»، ليصل الرد أسرع؛ ووفق شروطها تعالج هذا الصوت اللحظي في الذاكرة دون حفظه. وبعد الإرسال قد يُرسل إليها التسجيل المحفوظ أيضًا لتحويله، ويطلب قنديل منها حذفه بعد التحويل مباشرة. ولم يأذن لها قنديل باستخدام صوتك في تدريب نماذجها. وإذا ألغيت الرسالة قبل إرسالها، لا يُنشئ قنديل منها رسالة ولا يتذكر منها شيئًا، أما ما وصل إلى الخدمة قبل الإلغاء فيكون قد عولج بالفعل.',
    en: 'Speechmatics converts speech to text. While you record a voice message, your voice is streamed to it for live conversion, before you press Send, so the reply comes faster; under its terms, it processes this live audio in memory without storing it. After you send, the saved recording may also be sent to it for conversion, and Qandeel asks it to delete that recording right after conversion. Qandeel hasn\'t allowed it to use your audio to train its models. If you cancel a message before sending it, Qandeel creates no message and remembers nothing from it, but whatever already reached the service before you cancelled has already been processed.',
  },
  {
    id: 'K-08',
    ar: 'عندما ترسل رسالة صوتية، يرد قنديل بصوته تلقائيًا: يُرسل نص الرد إلى Google لتحويله إلى صوت أثناء كتابته. ويحدث ذلك أيضًا عند الضغط على «استمع»، وفي المكالمات عند توفرها. ولا تُرسل تسجيلاتك إلى Google. وقد يتضمن نص الرد شيئًا مما قلته. ويُحفظ صوت الرد التلقائي 15 دقيقة لإعادة الاستماع، ثم يُحذف.',
    en: 'When you send a voice message, Qandeel replies in its voice automatically: the text of its reply is sent to Google to turn it into speech as it\'s written. This also happens when you press Listen, and in calls once they\'re available. Your recordings aren\'t sent to Google. The reply text may include something you said. The audio of an automatic reply is kept for 15 minutes so you can play it again, then deleted.',
  },
  {
    id: 'K-09',
    ar: 'لا تستخدم Google هذا النص لتدريب نماذجها. وقد تحتفظ بالنصوص التي ترصدها أنظمتها كإساءة استخدام محتملة مدة تصل إلى 90 يومًا، وقد يراجعها موظفون مخوّلون لديها وفق شروط خدمتها.',
    en: 'Google doesn\'t use this text to train its models. It may keep text its systems flag as possible misuse for up to 90 days, and authorized Google staff may review it under Google\'s service terms.',
  },
  { id: 'K-10', ar: 'لا يراجع أحد في قنديل تسجيلاتك أو محتواك الصوتي.', en: 'No one at Qandeel reviews your recordings or voice content.' },
  { id: 'K-11', ar: 'قد يلتقط التسجيل أصواتًا قريبة.', en: 'A recording may capture nearby voices.' },
  {
    id: 'K-12',
    ar: 'النسخة التي تُنزَّل أو تُشارَك تخرج من قنديل ولا يمكن استرجاعها.',
    en: 'A downloaded or shared copy leaves Qandeel and cannot be recalled.',
  },
  {
    id: 'K-13',
    ar: 'يمكن سحب الموافقة في أي وقت من الإعدادات. سحبها يوقف الرسائل الصوتية الجديدة والردود الصوتية والمكالمات و«استمع»، ولا يحذف التسجيلات الحالية.',
    en: 'Consent can be withdrawn at any time in Settings. Withdrawing it stops new voice messages, spoken replies, calls and Listen, and doesn\'t delete existing recordings.',
  },
  { id: 'K-14', ar: 'أوافق وأتابع', en: 'Agree and continue' },
  { id: 'K-15', ar: 'ليس الآن', en: 'Not now' },
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

/**
 * S8B-04 (CP2) — QANDEEL's spoken reply to a Voice Note: the rows that REPLACE the contract's T-01 … T-05 (the manual
 * «استمع» of CP1, which no screen shows). APPROVED verbatim, Arabic and English, by the Product Owner at the CP2 gate
 * (2026-11-02, D2). No provider name, retention period or technical detail appears in the bubble.
 *
 *   T2-01  the control while the voice plays (P2 pause)        T2-02  while it is paused (P2 play)
 *   T2-03  after the end: hear it again (P2 replay)            T2-04  the control's accessibility name
 *   T2-05  accessibility only, while the voice is fetched      T2-06  the voice could not play now (the text stays)
 *   T2-07  the stored voice is no longer available (the text stays)
 */
export const VOICE_REPLY_COPY_ROWS: readonly VoiceNoteCopyRow[] = [
  { id: 'T2-01', ar: 'إيقاف مؤقت', en: 'Pause' },
  { id: 'T2-02', ar: 'متابعة', en: 'Resume' },
  { id: 'T2-03', ar: 'إعادة الاستماع', en: 'Play again' },
  { id: 'T2-04', ar: 'رد قنديل الصوتي', en: 'Qandeel\'s spoken reply' },
  { id: 'T2-05', ar: 'جارٍ تجهيز الصوت', en: 'Preparing audio' },
  { id: 'T2-06', ar: 'تعذّر تشغيل الصوت الآن. الرد مكتوب أعلاه.', en: 'Audio couldn\'t play right now. The reply is written above.' },
  { id: 'T2-07', ar: 'لم يعد صوت هذا الرد متاحًا. الرد مكتوب أعلاه.', en: 'This reply\'s audio is no longer available. The reply is written above.' },
];

/**
 * S8B-04 (CP2, D3 / D4) — R-01, shown above the consent text only to a reader who agreed to an earlier version. It is not
 * part of the consent text (not in any version's fingerprint). Kept by the Product Owner at the CP2 gate (2026-11-02).
 */
export const VOICE_CONSENT_RENEWAL_ROW: VoiceNoteCopyRow = {
  id: 'R-01',
  ar: 'تغيّرت شروط التسجيل الصوتي. راجعها ووافق عليها لمتابعة الرسائل الصوتية.',
  en: 'The voice recording terms have changed. Review and agree to them to keep using voice messages.',
};

const BY_ID = new Map([...VOICE_NOTE_COPY_ROWS, ...VOICE_REPLY_COPY_ROWS, VOICE_CONSENT_RENEWAL_ROW].map((row) => [row.id, row]));

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

/** The consent text of one language, the fifteen rows in order, one per line: what 0188 installs and pins. */
export function voiceConsentText(language: ChromeLanguage): string {
  return VOICE_CONSENT_COPY_ROWS.map((row) => row[language]).join('\n');
}
