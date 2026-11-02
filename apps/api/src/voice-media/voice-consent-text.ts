/**
 * S8B-03 — the voice recording consent text, version VOICE_RECORDING_V1: Copy Gate rows C-01 … C-11, APPROVED verbatim by
 * the Product Owner (2026-10-31). Migration 0186 installs exactly these rows (each on its own line, in order) and its deploy
 * guard pins their SHA-256; the voice notes contract test pins this file to that migration. Changing one character is a new
 * consent version, never an edit.
 *
 * S8B-04 (CP1): VOICE_RECORDING_V1 is HISTORY from migration 0187 on - installed, unchanged, no longer current.
 * S8B-04 (CP2): VOICE_RECORDING_V2 is HISTORY from migration 0188 on. The current version is VOICE_RECORDING_V3 below.
 */
export const VOICE_CONSENT_V1_VERSION = 'VOICE_RECORDING_V1';

export interface VoiceConsentRow { readonly id: string; readonly ar: string; readonly en: string }

export const VOICE_CONSENT_V1_ROWS: ReadonlyArray<VoiceConsentRow> = [
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

/**
 * S8B-04 (CP1) — the voice recording consent text, version VOICE_RECORDING_V2: Copy Gate rows K-01 … K-15, APPROVED
 * verbatim by the Product Owner for CP1 (2026-11-01). It adds QANDEEL's voice (Listen, and calls once available) and the
 * Google TTS facts of VA-11R (K-08, K-09). Migration 0187 installs exactly these rows (each on its own line, in order) and
 * its deploy guard pins their SHA-256. HISTORY from migration 0188 on: installed, unchanged, no longer current. Never edited.
 */
export const VOICE_CONSENT_V2_VERSION = 'VOICE_RECORDING_V2';

export const VOICE_CONSENT_V2_ROWS: ReadonlyArray<VoiceConsentRow> = [
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
    ar: 'تحوّل خدمة Speechmatics الكلام إلى نص، ويطلب قنديل منها حذف التسجيل بعد التحويل مباشرة.',
    en: 'Speechmatics converts speech to text, and Qandeel asks it to delete the recording right after conversion.',
  },
  {
    id: 'K-08',
    ar: 'عند الضغط على «استمع»، وفي المكالمات عند توفرها، يُرسل نص رد قنديل إلى Google لتحويله إلى صوت. ولا تُرسل تسجيلاتك إلى Google. وقد يتضمن نص الرد شيئًا مما قلته.',
    en: 'When you press Listen, and in calls once they\'re available, the text of Qandeel\'s reply is sent to Google to turn it into speech. Your recordings aren\'t sent to Google. The reply text may include something you said.',
  },
  {
    id: 'K-09',
    ar: 'لا تستخدم Google هذا النص لتدريب نماذجها. وقد تحتفظ بالنصوص التي ترصدها أنظمتها كإساءة استخدام محتملة مدة تصل إلى 90 يومًا، وقد يراجعها موظفون مخوّلون لديها وفق شروط خدمتها.',
    en: 'Google doesn\'t use this text to train its models. It may keep text its systems flag as possible misuse for up to 90 days, and authorized Google staff may review it under Google\'s service terms.',
  },
  {
    id: 'K-10',
    ar: 'لا يراجع أحد في قنديل تسجيلاتك أو محتواك الصوتي.',
    en: 'No one at Qandeel reviews your recordings or voice content.',
  },
  { id: 'K-11', ar: 'قد يلتقط التسجيل أصواتًا قريبة.', en: 'A recording may capture nearby voices.' },
  {
    id: 'K-12',
    ar: 'النسخة التي تُنزَّل أو تُشارَك تخرج من قنديل ولا يمكن استرجاعها.',
    en: 'A downloaded or shared copy leaves Qandeel and cannot be recalled.',
  },
  {
    id: 'K-13',
    ar: 'يمكن سحب الموافقة في أي وقت من الإعدادات. سحبها يوقف الرسائل الصوتية الجديدة والمكالمات و«استمع»، ولا يحذف التسجيلات الحالية.',
    en: 'Consent can be withdrawn at any time in Settings. Withdrawing it stops new voice messages, calls and Listen, and doesn\'t delete existing recordings.',
  },
  { id: 'K-14', ar: 'أوافق وأتابع', en: 'Agree and continue' },
  { id: 'K-15', ar: 'ليس الآن', en: 'Not now' },
];

/**
 * S8B-04 (CP2) — the CURRENT voice recording consent text, version VOICE_RECORDING_V3, APPROVED verbatim by the Product
 * Owner at the CP2 gate (2026-11-02; K-07 as corrected, v1.1). V3 is V2 with exactly three rows replaced: K-07 (the voice
 * sent to Speechmatics while recording, Realtime apart from Batch), K-08 (QANDEEL's automatic spoken reply and its 15-minute
 * audio) and K-13 (withdrawal also stops spoken replies). Migration 0188 installs exactly these rows (each on its own line,
 * in order) as the one current version, with the Fast Voice Path, and its deploy guard pins their SHA-256.
 */
export const VOICE_CONSENT_VERSION = 'VOICE_RECORDING_V3';

export const VOICE_CONSENT_V3_CHANGED_ROWS: ReadonlyArray<VoiceConsentRow> = [
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
    id: 'K-13',
    ar: 'يمكن سحب الموافقة في أي وقت من الإعدادات. سحبها يوقف الرسائل الصوتية الجديدة والردود الصوتية والمكالمات و«استمع»، ولا يحذف التسجيلات الحالية.',
    en: 'Consent can be withdrawn at any time in Settings. Withdrawing it stops new voice messages, spoken replies, calls and Listen, and doesn\'t delete existing recordings.',
  },
];

const V3_CHANGES = new Map(VOICE_CONSENT_V3_CHANGED_ROWS.map((row) => [row.id, row]));

/** K-01 … K-15 of V3: V2's rows in order, the three changed rows in their places. */
export const VOICE_CONSENT_ROWS: ReadonlyArray<VoiceConsentRow> = VOICE_CONSENT_V2_ROWS.map((row) => V3_CHANGES.get(row.id) ?? row);

/** The installed text of one language of the CURRENT version: its rows, in order, one per line. */
export function consentText(language: 'ar' | 'en'): string {
  return VOICE_CONSENT_ROWS.map((row) => row[language]).join('\n');
}
