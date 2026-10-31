/**
 * S8B-03 — the voice recording consent text, version VOICE_RECORDING_V1: Copy Gate rows C-01 … C-11, APPROVED verbatim by
 * the Product Owner (2026-10-31). Migration 0186 installs exactly `consentText('ar')` / `consentText('en')` (each row on its
 * own line, in order) and its deploy guard pins their SHA-256; the voice notes contract test pins this file to that
 * migration. Changing one character is a new consent version, never an edit.
 */
export const VOICE_CONSENT_VERSION = 'VOICE_RECORDING_V1';

export const VOICE_CONSENT_ROWS: ReadonlyArray<{ readonly id: string; readonly ar: string; readonly en: string }> = [
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

/** The installed text of one language: the eleven rows, in order, one per line. */
export function consentText(language: 'ar' | 'en'): string {
  return VOICE_CONSENT_ROWS.map((row) => row[language]).join('\n');
}
