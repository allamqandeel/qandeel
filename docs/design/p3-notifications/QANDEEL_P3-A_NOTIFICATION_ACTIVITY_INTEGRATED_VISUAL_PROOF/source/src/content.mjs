// P3-A — every user-facing string of the proof, in both languages, with its STATUS (task §18: "flag exact approved
// Product names, proof copy, and copy that remains open craft").
//
//   APPROVED   the Product Owner's exact accepted name / wording (task §5–§12; P3-A refinement §6)
//   CANON      frozen by an earlier canonical record (named in `src`)
//   DIRECTION  the Product Owner's DIRECTIONAL proof copy (task §9, §10, §12): used as given, not automatically final
//   PROOF      written for this proof; reviewable, not canonical
//   OPEN       wording this proof could not settle and flags as open craft
//
// Register (writing-eloquent-arabic): QANDEEL-voice lines follow the directional Egyptian register the Product Owner
// wrote (I-08N D18A: the real product follows the user's own dialect profile; the proof fixes one). Product / System
// voice is neutral. Account and security lines are Modern Standard Arabic. Digits stay Western under the one locale
// authority (T-12 §9, as P2-A and G3.2 render them).
const s = (text, status, src = '') => ({ text, status, src });
const A = 'APPROVED', C = 'CANON', D = 'DIRECTION', P = 'PROOF', O = 'OPEN';

export const COPY = {
  ar: {
    dir: 'rtl', lang: 'ar-EG',
    product: s('قنديل', C, 'VI-01 S01'),
    nav: { label: s('العوالم', C, 'G1.1 R3 landmark'), items: [
      { key: 'mine', ...s('قنديل', C, 'G1.1 R3 / P2-A') }, { key: 'shared', ...s('العالم المشترك', C, 'G1.2 §3') }, { key: 'public', ...s('العالم العام', C, 'G1.1 R3 / P2-A') }] },
    door: s('تحليل المحادثة', C, 'G1.1 §1'), replay: s('إعادة عرض المحادثة', O, 'G3 handoff §7 open copy (kept from P2-A)'),
    composer: s('كلامك هنا', C, 'VI-01 A10'),
    mute: s('كتم الميكروفون', C, 'G1.2 R1'), route: s('السماعة الخارجية', P, 'P2-A'), endCall: s('إنهاء المكالمة', C, 'G1.2 R1'),
    // ------------------------------------------------------------------ Activity
    activity: s('النشاط', A, 'P3-R'),
    activityOpen: s('فتح النشاط', P), activityNew: s('فيه جديد', P, 'accessible state only'),
    activitySettings: s('إعدادات الإشعارات والنشاط', P),
    back: s('رجوع', P),
    filterGroup: s('تصفية النشاط', P),
    filters: { all: s('الكل', A, 'P3-T'), qandeel: s('من قنديل', C, 'I-08N-01 D30'), shared: s('العالم المشترك', C, 'G1.2 §3'),
      public: s('العالم العام', C, 'G1.1 R3'), intro: s('التعارف', C, 'I-08A4'), system: s('النظام', P, 'task §6 "System"') },
    day: { today: s('اليوم', P), yesterday: s('أمس', P), earlier: s('في وقت سابق', P) },
    markNew: s('جديد', P, 'accessible state'), markWaiting: s('في انتظارك', P, 'accessible state'),
    stale: s('لم يعد متاحًا', P), staleExplain: s('ما كان هنا لم يعد متاحًا. لن نفتح مكانًا آخر بدلًا منه.', P, 'D39'),
    staleOpen: s('فتح {0}', P), muted: s('مكتوم', P),
    empty: s('مفيش حاجة هنا دلوقتي.', P),
    // ------------------------------------------------------------------ Attention Strip
    stripRegion: s('تنبيه', P), stripDismiss: s('إغلاق التنبيه', P),
    callSafeRegion: s('تنبيه أثناء المكالمة', P, 'refinement §8'), callSafeOn: s('المكالمة مستمرة', P, 'refinement §8 (accessible state only)'),
    // ------------------------------------------------------------------ permission education (task §9)
    eduTitle: s('خليني أوصلك لما يكون في حاجة تستاهل', D, 'task §9'),
    eduBody: s('مش هبعتلك علشان أرجعك للتطبيق وخلاص. هستخدم الإشعارات لما يكون في سبب له قيمة ليك، وتقدر تقللها أو توقفها في أي وقت.', D, 'task §9'),
    eduAllow: s('السماح بالإشعارات', D, 'task §9'), eduNotNow: s('مش دلوقتي', D, 'task §9'),
    osBoundary: s('يسألك النظام الآن', P), osBoundaryNote: s('نافذة الإذن يملكها iOS / Android، ولا يرسمها قنديل ولا يقلّدها.', P),
    notNowNote: s('تمام. النشاط هيفضل يظهر هنا جوه التطبيق.', P),
    // ------------------------------------------------------------------ settings (task §12)
    settings: s('الإعدادات', P, 'P1 §8 one General Settings destination'),
    groups: [s('الحساب والهوية', P, 'P1 §8.1'), s('الأمان وتسجيل الدخول', P, 'P1 §8.1'), s('قنديل والمحادثة', P, 'P1 §8.1'),
      s('الإشعارات والنشاط', A, 'P3-G'), s('المظهر وإمكانية الوصول', P, 'P1 §8.1'), s('الخصوصية والبيانات', P, 'P1 §8.1'),
      s('التعارف', P, 'P1 §8.1'), s('الدعم والتطبيق', P, 'P1 §8.1')],
    notif: s('الإشعارات والنشاط', A, 'P3-G'),
    osOff: s('إشعارات قنديل متوقفة على هذا الجهاز. سيظل النشاط يظهر داخل التطبيق.', P),
    proactive: s('قنديل يبادر معايا', D, 'task §12'),
    proactiveOpts: { allow: s('سماح', D, 'task §12'), reduce: s('أقل', D, 'task §12'), off: s('إيقاف', D, 'task §12') },
    proactiveHelp: s('ده بيتحكم في إن قنديل يبدأ معاك الكلام بس. ذاكرته وفهمه والتحليل بيفضلوا زي ما هم.', P, 'D35'),
    proactiveOptHelp: { allow: s('قنديل يقدر يبدأ معاك الكلام لما يكون عنده سبب يستاهل.', P),
      reduce: s('قنديل هيقاطعك أقل، ومش هينبّهك غير للحاجات الأهم أو اللي وقتها ميستناش.', P, 'refinement §7 meaning'),
      off: s('قنديل مش هيبدأ معاك الكلام من نفسه. تقدر تكلّمه وقت ما تحب.', P) },
    sharedSec: s('العالم المشترك', C), sharedAll: s('تنبيهات العالم المشترك', P),
    on: s('مفعّل', P), off: s('متوقف', P), mutedWorld: s('مكتوم', P),
    publicSec: s('العالم العام', C), publicInter: s('الردود والتفاعل معك', P), publicDisc: s('اكتشافات من العالم العام', P),
    publicDiscHelp: s('اختياري — مرة في الأسبوع على الأكثر', P, 'P3-P'),
    introSec: s('التعارف', C), introOn: s('تنبيهات التعارف', P),
    introHelp: s('افتراضيًا، لا تكشف شاشة القفل أن الإشعار عن التعارف.', P, 'D15 default; the ceiling is the user\'s'),
    systemSec: s('الأمان والحساب', P),
    securityAlways: s('تنبيهات الأمان المهمة تصلك دائمًا، حتى في ساعات الهدوء، ولا يمكنها تجاوز إعدادات جهازك.', P, 'D36'),
    systemOther: s('تحديثات الحساب الأخرى', P),
    quiet: s('ساعات الهدوء', P), quietOn: s('تفعيل ساعات الهدوء', P), quietRange: s('من {0} إلى {1}', P),
    quietHelp: s('خلالها لا يصلك إلا تذكير طلبته في موعد محدد أو تنبيه أمان مهم. وما ينتظر يُراجَع في الصباح، ولا يصلك دفعة واحدة.', P, 'D06; P3-M'),
    snooze: s('إيقاف مؤقت', P), snoozeOpts: { '1h': s('ساعة', P), '8h': s('8 ساعات', P), '24h': s('24 ساعة', P), custom: s('مدة أخرى', P) },
    lockSec: s('معاينات شاشة القفل', D, 'task §10'),
    lockHelp: s('هذا حدّ أقصى: قد يُظهر قنديل تفاصيل أقل.', P, 'D17'),
    levels: { L0: s('خاصة جدًا', A, 'refinement §6'), L1: s('إظهار النوع', A, 'refinement §6'), L2: s('إظهار السياق', A, 'refinement §6'), L3: s('إظهار المعاينة', A, 'refinement §6') },
    levelHelp: { L0: s('لا يظهر إلا أن هناك إشعارًا جديدًا.', P), L1: s('يظهر نوع الإشعار فقط.', P), L2: s('يظهر المكان ومن فعل ماذا، دون المحتوى.', P), L3: s('يظهر جزء من المحتوى على شاشة القفل.', P) },
    lockSubjects: { qandeel: s('قنديل', C), shared: s('العالم المشترك', C), public: s('العالم العام', C), discovery: s('اكتشافات العالم العام', P),
      intro: s('التعارف', C), reminder: s('التذكيرات', P), system: s('الحساب', P), security: s('الأمان', P) },
    device: s('إعدادات إشعارات الجهاز', D, 'task §12'), deviceHelp: s('الصوت وشكل التنبيه وشاشة القفل يتحكم فيها جهازك.', P),
    // ------------------------------------------------------------------ disclosure projection words (model.project)
    l0: s('إشعار جديد', P, 'L0 minimal'),
    generic: { qandeel: s('رسالة من قنديل', P), shared: s('نشاط جديد في العالم المشترك', P), public: s('نشاط جديد في العالم العام', P),
      discovery: s('جديد في العالم العام', P), intro: s('تحديث في التعارف', P), reminder: s('تذكير', P), system: s('تحديث في الحساب', P), security: s('تنبيه أمان', P) },
    ctxTitle: { qandeel: s('قنديل', P), reminder: s('تذكير', P), system: s('الحساب', P), security: s('الأمان', P), intro: s('التعارف', P), discovery: s('العالم العام', P), public: s('العالم العام', P), shared: s('العالم المشترك', P) },
    now: s('الآن', P),
  },
  en: {
    dir: 'ltr', lang: 'en',
    product: s('Qandeel', C, 'VI-01 S01 (proof casing, as P2-A)'),
    nav: { label: s('Worlds', P), items: [{ key: 'mine', ...s('Qandeel', P) }, { key: 'shared', ...s('Shared World', C, 'G1.2 §3') }, { key: 'public', ...s('Public world', P) }] },
    door: s('Conversation analysis', O, 'G1.1 §2 English label open'), replay: s('Replay this conversation', P),
    composer: s('Write here', P),
    mute: s('Mute microphone', P), route: s('Speaker', P), endCall: s('End call', P),
    activity: s('Activity', A, 'P3-R ("ACTIVITY"; title case in the interface)'),
    activityOpen: s('Open Activity', P), activityNew: s('new items', P, 'accessible state only'),
    activitySettings: s('Notifications & Activity settings', P),
    back: s('Back', P),
    filterGroup: s('Filter Activity', P),
    filters: { all: s('All', A, 'P3-T'), qandeel: s('From Qandeel', C, 'I-08N-01 D30'), shared: s('Shared', P, 'task §6'), public: s('Public', P, 'task §6'), intro: s('Introductions', C, 'I-08A4'), system: s('System', P, 'task §6') },
    day: { today: s('Today', P), yesterday: s('Yesterday', P), earlier: s('Earlier', P) },
    markNew: s('new', P), markWaiting: s('waiting for you', P),
    stale: s('No longer available', P), staleExplain: s('What was here is no longer available. We won\'t open somewhere else instead.', P, 'D39'),
    staleOpen: s('Open {0}', P), muted: s('Muted', P),
    empty: s('Nothing here right now.', P),
    stripRegion: s('Alert', P), stripDismiss: s('Dismiss', P),
    callSafeRegion: s('Alert during your call', P, 'refinement §8'), callSafeOn: s('your call continues', P, 'refinement §8 (accessible state only)'),
    eduTitle: s('Let me reach you when it\'s worth it', P, 'English equivalent of the task §9 direction'),
    eduBody: s('I won\'t notify you just to pull you back into the app. I\'ll use notifications when there\'s a reason that matters to you, and you can reduce or turn them off anytime.', P, 'English equivalent of the task §9 direction'),
    eduAllow: s('Allow notifications', P), eduNotNow: s('Not now', P),
    osBoundary: s('Your device asks next', P), osBoundaryNote: s('The permission prompt belongs to iOS / Android. Qandeel does not draw or imitate it.', P),
    notNowNote: s('Okay. Activity will keep showing here in the app.', P),
    settings: s('Settings', P),
    groups: [s('Account & Identity', P, 'P1 §8.1'), s('Security & Login', P, 'P1 §8.1'), s('Qandeel & Conversation', P, 'P1 §8.1'),
      s('Notifications & Activity', A, 'P3-G'), s('Appearance & Accessibility', P, 'P1 §8.1'), s('Privacy & Data', P, 'P1 §8.1'),
      s('Introductions', P, 'P1 §8.1'), s('Support & App', P, 'P1 §8.1')],
    notif: s('Notifications & Activity', A, 'P3-G'),
    osOff: s('Notifications for Qandeel are off on this device. Activity still appears here in the app.', P),
    proactive: s('Qandeel reaching out', P, 'English equivalent of «قنديل يبادر معايا»'),
    proactiveOpts: { allow: s('Allow', A, 'task §12'), reduce: s('Reduce', A, 'task §12'), off: s('Off', A, 'task §12') },
    proactiveHelp: s('This only controls when Qandeel starts a conversation with you. Memory, understanding and analysis stay the same.', P, 'D35'),
    proactiveOptHelp: { allow: s('Qandeel can reach out when there\'s a good reason.', P),
      reduce: s('Qandeel interrupts you less, and only for what matters most or can\'t wait.', P, 'refinement §7 meaning'),
      off: s('Qandeel won\'t start a conversation on its own. You can talk to it whenever you like.', P) },
    sharedSec: s('Shared World', C), sharedAll: s('Shared World alerts', P),
    on: s('On', P), off: s('Off', P), mutedWorld: s('Muted', P),
    publicSec: s('Public World', P), publicInter: s('Replies and interactions with you', P), publicDisc: s('Discoveries from the Public World', P),
    publicDiscHelp: s('Optional — at most once a week', P, 'P3-P'),
    introSec: s('Introductions', C), introOn: s('Introduction alerts', P),
    introHelp: s('By default, the Lock Screen doesn\'t show that a notification is about Introductions.', P, 'D15 default; the ceiling is the user\'s'),
    systemSec: s('Security & Account', P),
    securityAlways: s('Important security alerts always reach you, even during Quiet Hours. They can\'t override your device settings.', P, 'D36'),
    systemOther: s('Other account updates', P),
    quiet: s('Quiet Hours', P), quietOn: s('Use Quiet Hours', P), quietRange: s('{0} to {1}', P),
    quietHelp: s('Only reminders you set for an exact time and important security alerts come through. Everything else is reviewed in the morning, not sent all at once.', P, 'D06; P3-M'),
    snooze: s('Snooze', P, 'task §12'), snoozeOpts: { '1h': s('1 hour', A), '8h': s('8 hours', A), '24h': s('24 hours', A), custom: s('Custom', A) },
    lockSec: s('Lock Screen previews', P),
    lockHelp: s('This is a limit: Qandeel may show less.', P, 'D17'),
    levels: { L0: s('Very private', A, 'refinement §6'), L1: s('Show type', A, 'refinement §6'), L2: s('Show context', A, 'refinement §6'), L3: s('Show preview', A, 'refinement §6') },
    levelHelp: { L0: s('Only shows that there is a new notification.', P), L1: s('Only shows the kind of notification.', P), L2: s('Shows where and who did what, without the content.', P), L3: s('Shows part of the content on the Lock Screen.', P) },
    lockSubjects: { qandeel: s('Qandeel', C), shared: s('Shared World', C), public: s('Public World', P), discovery: s('Public World discoveries', P),
      intro: s('Introductions', C), reminder: s('Reminders', P), system: s('Account', P), security: s('Security', P) },
    device: s('Device Notification Settings', A, 'task §12'), deviceHelp: s('Sound, alert style and the Lock Screen are controlled by your device.', P),
    l0: s('New notification', P),
    generic: { qandeel: s('A message from Qandeel', P), shared: s('New activity in Shared World', P), public: s('New activity in the Public World', P),
      discovery: s('Something new in the Public World', P), intro: s('An Introductions update', P), reminder: s('Reminder', P), system: s('Account update', P), security: s('Security alert', P) },
    ctxTitle: { qandeel: s('Qandeel', P), reminder: s('Reminder', P), system: s('Account', P), security: s('Security', P), intro: s('Introductions', P), discovery: s('Public World', P), public: s('Public World', P), shared: s('Shared World', P) },
    now: s('now', P),
  },
};

/** Plain words for model.project(): { l0, generic{}, ctxTitle{} } in one language. */
export const projectionWords = (lang) => {
  const L = COPY[lang], pick = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.text]));
  return { l0: L.l0.text, generic: pick(L.generic), ctxTitle: pick(L.ctxTitle) };
};
