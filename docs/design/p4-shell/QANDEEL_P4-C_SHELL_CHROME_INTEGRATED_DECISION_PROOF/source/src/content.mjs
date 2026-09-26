// P4-C — every user-facing string the proof can show, in both Product languages, with its STATUS and its source.
// P4-C writes NO new Product copy. Where a slot has no canonical English word, the proof uses a clearly marked
// PROOF COPY — NOT CANONICAL string and hands the final wording to P4-DQ-09.
//
//   CANON      frozen by an earlier canonical record (named in `src`) — reproduced verbatim
//   APPROVED   the Product Owner's exact accepted wording in an earlier closure (named in `src`)
//   PROOF      written for an earlier proof or for this one; reviewable, not canonical
//   PROOF COPY — NOT CANONICAL   an English stand-in for a slot VI-01 keeps OPEN; never to be read as a decision
//   OPEN       a slot canon leaves open; the proof shows the existing proof wording
//   FIXTURE    synthetic data standing in for runtime content
//
// Register: fixed Product chrome is Neutral Contemporary Arabic / Natural Contemporary English (I-08A4 §11). QANDEEL's
// conversational lines keep the directional register the earlier proofs used (I-08A4 §11: locale-dependent).
// Digits stay Western under the one locale authority, as P2-A, P3-A and G3.2 render them (T-12 §9).
const s = (text, status, src = '') => ({ text, status, src });
const C = 'CANON', A = 'APPROVED', P = 'PROOF', O = 'OPEN', F = 'FIXTURE', N = 'PROOF COPY — NOT CANONICAL';

export const COPY = {
  ar: {
    dir: 'rtl', lang: 'ar-EG',
    // ---------------------------------------------------------------- the Global Switcher (I-08A4 §3; G1.2 §3)
    nav: { label: s('العوالم', P, 'G1.1 R3 landmark name'), items: [
      { key: 'mine', ...s('قنديل', C, 'I-08A4 §8 Personal QANDEEL') },
      { key: 'shared', ...s('العالم المشترك', C, 'G1.2 §3 — singular Product-area name') },
      { key: 'public', ...s('العالم العام', C, 'I-08A4 §8') }] },
    // ---------------------------------------------------------------- the shell's frozen actions
    door: s('تحليل المحادثة', C, 'G1.1 §1 — Conversation → Analysis'),
    back: s('المحادثة', C, 'G1.1 §1 — Analysis → Conversation (G3.2 draws it)'),
    replay: s('إعادة عرض المحادثة', O, 'G1.1 §5 / G3 §G: the Arabic Replay noun stays open copy (kept from P2-A / P3-A)'),
    composer: s('كلامك هنا', C, 'VI-01 A10 (as P3-A)'),
    voiceCall: s('مكالمة صوتية', C, 'VI-01 V02 (G1.2 R1)'), voiceNote: s('رسالة صوتية', C, 'VI-01 (G1.2 R1)'),
    // ---------------------------------------------------------------- the global and secondary entries under study
    activity: s('النشاط', A, 'P3 §3 / §17'), activityNew: s('فيه جديد', P, 'P3-A accessible state only'),
    settings: s('الإعدادات', C, 'I-08A4 §8 Settings; P1 §8 one General Settings destination'),
    understanding: s('فهم قنديل', C, 'P1 §10 — the Personal Understanding surface'),
    liveContext: s('سياق الكلام', C, 'VI-01 Terminology Matrix S03 / A01 — Arabic APPROVED'),
    // ---------------------------------------------------------------- pushed pages
    backPage: s('رجوع', P, 'P3-A'),
    groups: [s('الحساب والهوية', P, 'P1 §8.1 group'), s('الأمان وتسجيل الدخول', P, 'P1 §8.1 group'), s('قنديل والمحادثة', P, 'P1 §8.1 group'),
      s('الإشعارات والنشاط', A, 'P3 §12 / §17'), s('المظهر وإمكانية الوصول', P, 'P1 §8.1 group'), s('الخصوصية والبيانات', P, 'P1 §8.1 group'),
      s('التعارف', P, 'P1 §8.1 group'), s('الدعم والتطبيق', P, 'P1 §8.1 group')],
    activitySettings: s('إعدادات الإشعارات والنشاط', P, 'P3-A'),
    filters: [s('الكل', A, 'P3 §17'), s('من قنديل', C, 'I-08N-01 D30'), s('العالم المشترك', C, 'G1.2 §3'), s('العالم العام', C, 'I-08A4'), s('التعارف', C, 'I-08A4'), s('النظام', P, 'P3-A')],
    today: s('اليوم', P, 'P3-A'),
    understandingNote: s('سطح «فهم قنديل» نفسه لم يُصمَّم بعد. يحدّد P4-C مكان المدخل فقط، ويبقى السطح لقرار P4-DQ-07.', P, 'P4-C harness stand-in (P1 §11; DQ-07)'),
    // ---------------------------------------------------------------- fixtures
    worldName: s('رحلة الصيف', F, 'P3-A CONTEXTS w-summer'),
    displayName: s('نور', F, 'G3.2 fixture'),
    who: { sara: s('سارة', F), karim: s('كريم', F) },
  },
  en: {
    dir: 'ltr', lang: 'en',
    nav: { label: s('Worlds', P, 'G1.1 R3 landmark name'), items: [
      { key: 'mine', ...s('QANDEEL', C, 'I-08A4 §9 — canonical English casing (P2-A / P3-A used proof casing "Qandeel")') },
      { key: 'shared', ...s('Shared World', C, 'G1.2 §3') },
      { key: 'public', ...s('Public World', C, 'I-08A4 §9') }] },
    door: s('Conversation analysis', O, 'G1.1 §2: the English Conversation → Analysis label is open (proof wording kept)'),
    back: s('Conversation', C, 'G1.1 §2'),
    replay: s('Replay this conversation', P, 'P2-A / P3-A'),
    composer: s('Write here', P, 'P3-A'),
    voiceCall: s('Voice call', C, 'VI-01 V02 (G1.2 R1)'), voiceNote: s('Voice message', C, 'VI-01 (G1.2 R1)'),
    activity: s('Activity', A, 'P3 §3 / §17'), activityNew: s('new items', P, 'P3-A accessible state only'),
    settings: s('Settings', C, 'I-08A4 §9'),
    understanding: s('QANDEEL Understanding', C, 'P1 §10'),
    liveContext: s('In play now', N, 'VI-01 §7.2 / S03: English Live Context wording OPEN; "In play now" is VI-01\'s own candidate. Final English → P4-DQ-09'),
    backPage: s('Back', P, 'P3-A'),
    groups: [s('Account & Identity', P, 'P1 §8.1 group'), s('Security & Login', P, 'P1 §8.1 group'), s('QANDEEL & Conversation', P, 'P1 §8.1 group'),
      s('Notifications & Activity', A, 'P3 §12 / §17'), s('Appearance & Accessibility', P, 'P1 §8.1 group'), s('Privacy & Data', P, 'P1 §8.1 group'),
      s('Introductions', P, 'P1 §8.1 group'), s('Support & App', P, 'P1 §8.1 group')],
    activitySettings: s('Notifications & Activity settings', P, 'P3-A'),
    filters: [s('All', A, 'P3 §17'), s('From QANDEEL', C, 'I-08N-01 D30'), s('Shared', P, 'P3-A'), s('Public', P, 'P3-A'), s('Introductions', C, 'I-08A4'), s('System', P, 'P3-A')],
    today: s('Today', P, 'P3-A'),
    understandingNote: s('The QANDEEL Understanding surface itself is not designed yet. P4-C places only its entry; the surface stays with P4-DQ-07.', P, 'P4-C harness stand-in (P1 §11; DQ-07)'),
    worldName: s('Summer trip', F, 'P3-A CONTEXTS w-summer'),
    displayName: s('Nour', F, 'G3.2 fixture'),
    who: { sara: s('Sara', F), karim: s('Karim', F) },
  },
};

/** The Personal Conversation the shell hosts: G3.2's own thread (today), opener included. FIXTURE conversation. */
export const THREAD = {
  ar: [
    { day: 'اليوم 9:40' },
    { who: 'q', opener: true, text: 'اهلا يا {display_name} ... انا في انتظارك ... يلا نبدأ' },   // G1.1 §1 normal opener (CANON)
    { who: 'me', text: 'عندي presentation للـclient يوم الخميس الساعة 10:30، ولسه مخلّصتش.' },
    { who: 'q', text: 'آخر أربع مرات، الإعداد كان بيطوّل، والنوم بيقلّ قبل التسليم بيومين، وبعدها الطاقة بتنزل. ده اللي شايفه في عالمك، ومش متأكد من السبب.' },
    { who: 'me', text: 'الأرقام بس اللي ناقصة. الـQ3 numbers لسه ما وصلتش من finance.' },
    { who: 'q', text: 'يعني اللي ناقص دلوقتي مش في إيدك. لما الأرقام توصل، إيه أول خطوة في العرض؟' },
  ],
  en: [
    { day: 'Today 9:40' },
    { who: 'q', opener: true, text: 'Hi {display_name} ... I\'m here waiting for you ... let\'s get started' },   // G3.2 proof English opener (PROOF)
    { who: 'me', text: 'I’ve got a presentation for the client on Thursday at 10:30, and it’s still not done.' },
    { who: 'q', text: 'The last four times, the preparation ran long, sleep got shorter two days before the deadline, and then your energy dropped. That’s what I see in your world. I’m not sure why.' },
    { who: 'me', text: 'It’s just the numbers. The Q3 numbers still haven’t come in from finance.' },
    { who: 'q', text: 'So what’s missing right now isn’t in your hands. When the numbers arrive, what’s the first step in the presentation?' },
  ],
};
export const THREAD_STATUS = { ar: 'G3.2 fixture thread; opener = G1.1 §1 normal Arabic opener (CANON)', en: 'G3.2 fixture thread; English opener = G3.2 PROOF (DQ-09 cluster 034)' };

/** The Shared World the shell hosts (P3-A's proof scaffolding; multi-human attribution is not designed: G1.1 §5). */
export const SHARED_THREAD = {
  ar: [{ day: 'اليوم 9:20' }, { who: 'x', name: 'كريم', text: 'مين هيحجز التذاكر؟' }, { who: 'me', text: 'أنا ممكن، بس محتاج أعرف الميعاد الأول.' }],
  en: [{ day: 'Today 9:20' }, { who: 'x', name: 'Karim', text: 'Who’s booking the tickets?' }, { who: 'me', text: 'I can, but I need to know the date first.' }],
};

/** Three Activity rows, verbatim from P3-A's FEED fixture (F1, F2, F3). FIXTURE event text — never Product copy. */
export const FEED = [
  { cat: 'shared', src: { ar: 'رحلة الصيف', en: 'Summer trip' }, time: '9:32', mark: 'new', text: { ar: '3 رسائل جديدة من سارة وكريم', en: '3 new messages from Sara and Karim' } },
  { cat: 'qandeel', src: { ar: 'قنديل', en: 'QANDEEL' }, time: '8:05', mark: 'new', text: { ar: 'عرض الخميس الساعة 10:30. تحب نراجع الأرقام اللي كانت ناقصة قبلها؟', en: 'Your Thursday presentation is at 10:30. Want to go over the missing numbers before then?' } },
  { cat: 'system', src: { ar: 'الحساب', en: 'Account' }, time: '6:40', mark: 'waiting', text: { ar: 'تسجيل دخول جديد من جهاز Pixel 8', en: 'New sign-in from a Pixel 8' } },
];
