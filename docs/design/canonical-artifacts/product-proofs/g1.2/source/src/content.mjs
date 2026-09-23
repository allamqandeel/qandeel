// G1.2 — every word the proof shows, in both Product languages.
//
// Status travels WITH each string (G1.2 brief §32). Three authority classes, never mixed:
//   LOCKED   fixed by G1.1 (docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md §1–2)
//            — reproduced verbatim, never paraphrased
//   PROOF    written for this proof — editable craft, not canonical
//   OPEN     voice / call wording VI-01 §14 holds PROVISIONAL / PHASE VII: "No V01–V07 string in this package
//            is a freeze candidate." Shown so the Product Owner can judge the moment, not to freeze it.
//   FIXTURE  stands in for runtime data the proof does not have
//
// Register law (VI-01 §3.1): T1 chrome = neutral contemporary Arabic; T2 QANDEEL's voice = restrained
// Egyptian; T4 system events = impersonal (VI-01 §14.4 "A dropped call is a system event, so it is impersonal
// T4"). Fixed Arabic copy is gender-neutral toward the reader (§3.6): masdar control labels, no second-person
// verb. No exclamation marks, no emoji (§15.8).

/** G1.1 LOCKED — the new-conversation opener. Byte-for-byte; `{display_name}` is the ONLY substitution. */
export const OPENER = {
  ar: 'اهلا يا {display_name} ... انا في انتظارك ... يلا نبدأ',
  en: 'Hi {display_name} ... I\'m here waiting for you ... let\'s get started',
};
/** FIXTURE: no canonical display name exists yet (G1.1 closure §5 carries it to identity / registration). */
export const DISPLAY_NAME = { ar: 'نور', en: 'Nour', latinInArabic: 'Nour' };
export const openerText = (lang, name = DISPLAY_NAME[lang]) => OPENER[lang].split('{display_name}').join(name);

const LOCKED = 'LOCKED — G1.1 closure';
const OPEN = 'OPEN — VI-01 §14 PROVISIONAL / PHASE VII';
export const COPY = {
  ar: {
    dir: 'rtl', lang: 'ar-EG',
    product: { text: 'قنديل', status: 'VI-01 S01 — root accessible name' },
    nav: {
      label: { text: 'العوالم', status: 'PROOF — accessible name of the navigation landmark (G1.1 R3)' },
      items: [
        { key: 'mine', text: 'قنديل', status: 'G1.1 R3 proof label — MY_WORLD' },
        { key: 'shared', text: 'مع الآخرين', status: `${LOCKED} §1 — count-neutral primary navigation` },
        { key: 'public', text: 'العالم العام', status: 'G1.1 R3 proof label — PUBLIC_WORLD' },
      ],
    },
    door: { text: 'تحليل المحادثة', status: `${LOCKED} §1 — Conversation → Analysis` },
    back: { text: 'المحادثة', status: `${LOCKED} §1 — Analysis → Conversation` },
    backName: { text: 'المحادثة — رجوع', status: 'PROOF — accessible name; contains the visible label (WCAG 2.5.3)' },
    backNameCall: { text: 'المحادثة — المكالمة مستمرة', status: 'PROOF — during a Live Call opening the Conversation does not end the call' },
    doorNameCall: { text: 'تحليل المحادثة — المكالمة مستمرة', status: 'PROOF — during a Live Call the return is to the SAME call' },
    replay: { text: 'إعادة عرض المحادثة', status: 'PROOF — no canonical Arabic Replay noun (G1.1 closure §5)' },
    replayFull: { text: 'المحادثة كاملة', status: `${LOCKED} (R3 §10)` },
    replayPart: { text: 'جزء من المحادثة', status: `${LOCKED} (R3 §10)` },
    replayCallNote: { text: 'المكالمة الجارية غير مشمولة.', status: 'PROOF — Replay never appears to commit live material (replay-runtime-v1 §7, §19)' },
    preview: { text: 'معاينة', status: 'PROOF — masdar' },
    cancel: { text: 'إلغاء', status: 'PROOF — masdar' },
    close: { text: 'قفل', status: 'VI-01 A02 — dismiss' },
    pickHint: { text: 'أول رسالة وآخر رسالة في الجزء', status: 'PROOF (G1.1 R3)' },
    composerLabel: { text: 'رسالتك لقنديل', status: 'VI-01 A10 PROPOSED' },
    composerPlaceholder: { text: 'كلامك هنا', status: 'VI-01 A10 PROPOSED' },
    send: { text: 'إرسال', status: 'masdar control label (VI-01 §3.6.2)' },
    // ---- Voice Note
    voiceNote: { text: 'رسالة صوتية', status: `${OPEN} — V01 (composer row)` },
    recording: { text: 'بسجّل', status: `${OPEN} — V04. TRUE here: a voice note IS captured until it is sent or discarded` },
    voiceSend: { text: 'إرسال الرسالة الصوتية', status: 'PROOF — masdar' },
    voiceCancel: { text: 'إلغاء التسجيل', status: 'PROOF — masdar; discards the capture, adds nothing to the history' },
    noteStopped: { text: 'توقّف التسجيل عند الخروج من قنديل', status: 'PROOF — the in-progress note when QANDEEL left the screen (recommendation R-VN, report §F)' },
    play: { text: 'تشغيل الرسالة الصوتية', status: 'PROOF — masdar' },
    pause: { text: 'إيقاف الرسالة الصوتية مؤقتًا', status: 'PROOF — masdar' },
    qPlay: { text: 'تشغيل رد قنديل', status: 'PROOF CANDIDATE — QANDEEL spoken rendering of a text reply; runtime dependency (speech rendering)' },
    // ---- permission (T4 system, impersonal)
    permPurpose: { text: 'يستخدم قنديل الميكروفون للرسائل الصوتية والمكالمات، وأثناء تشغيلها فقط.', status: 'PROOF — proposed iOS NSMicrophoneUsageDescription (shown inside the OS prompt)' },
    micDenied: { text: 'الميكروفون غير متاح لقنديل. الكتابة متاحة.', status: `${OPEN} principle §14.5 — a fallback always names the alternative` },
    openSettings: { text: 'فتح الإعدادات', status: 'PROOF — masdar; deep link to the OS app settings' },
    // ---- Live Call
    call: { text: 'مكالمة صوتية', status: `${OPEN} — V02 (call surface)` },
    connecting: { text: 'جاري الاتصال', status: `${OPEN} — connection state; mechanical, no comprehension claim` },
    micOn: { text: 'الميكروفون شغّال', status: `${OPEN} — mechanical microphone state (VI-01 §14.1: name the mechanism). Not «بسمعك», not «بسجّل»` },
    muted: { text: 'الميكروفون مكتوم', status: `${OPEN} — mechanical` },
    qSpeaking: { text: 'قنديل بيتكلم', status: `${OPEN} — V05 illustrative «بيتكلم»: QANDEEL audio is playing` },
    reconnecting: { text: 'الاتصال انقطع. جاري إعادة الاتصال.', status: `${OPEN} — V06 illustrative, verbatim` },
    callFailed: { text: 'المكالمة وقفت. الكتابة متاحة.', status: `${OPEN} — V07 illustrative, verbatim; used for every call end the reader did not choose` },
    mute: { text: 'كتم الميكروفون', status: 'PROOF — masdar; aria-pressed carries the state' },
    endCall: { text: 'إنهاء المكالمة', status: 'PROOF — masdar' },
    route: { text: 'السماعة الخارجية', status: 'PROOF CANDIDATE — speaker toggle (aria-pressed). ON by default because an Analysis-first call is watched, not held to the ear (decision G12-J4); Bluetooth / other routes are the OS route picker\'s' },
    callStarted: { text: 'مكالمة صوتية بدأت', status: 'PROOF (G1.1 R3) — live marker in the history while the call runs' },
    callRecord: { text: 'مكالمة صوتية', status: 'PROOF — what the call leaves in the history; RUNTIME DEPENDENCY (audio dependency note §2)' },
    callRecordStopped: { text: 'وقفت', status: 'PROOF — the record of a call that ended without the reader ending it' },
    liveContext: { text: 'سياق الكلام', status: 'VI-01 TIER 2 APPROVED — Live Context («سياق الكلام»)' },
    liveContextEmpty: { text: 'مفيش حاجة داخلة مع الكلام.', status: 'VI-01 T13 PROPOSED' },
    today: { text: 'اليوم', status: 'PROOF' },
    yesterday: { text: 'أمس', status: 'PROOF' },
    sharedOne: { text: 'عالم مشترك', status: `${LOCKED} §1` },
    sharedMany: { text: 'عوالم مشتركة', status: `${LOCKED} §1` },
    speakerMe: { text: 'كلامك', status: 'PROOF (G1.1 A1) — visually hidden speaker label' },
    speakerQ: { text: 'قنديل', status: 'PROOF (G1.1 A1) — visually hidden speaker label' },
  },
  en: {
    dir: 'ltr', lang: 'en',
    product: { text: 'Qandeel' },
    nav: { label: { text: 'Worlds' }, items: [{ key: 'mine', text: 'Qandeel' }, { key: 'shared', text: 'With others' }, { key: 'public', text: 'Public world' }] },
    door: { text: 'Conversation analysis', status: 'G1.1 closure §2: the exact English depth label stays open to the English copy pass' },
    back: { text: 'Conversation' },
    backName: { text: 'Conversation — back' },
    backNameCall: { text: 'Conversation — the call continues' },
    doorNameCall: { text: 'Conversation analysis — the call continues' },
    replay: { text: 'Replay this conversation' },
    replayFull: { text: 'The whole conversation' },
    replayPart: { text: 'Part of the conversation' },
    replayCallNote: { text: 'The ongoing call isn’t included.' },
    preview: { text: 'Preview' },
    cancel: { text: 'Cancel' },
    close: { text: 'Close' },
    pickHint: { text: 'The first and last message of the part' },
    composerLabel: { text: 'Your message to Qandeel' },
    composerPlaceholder: { text: 'Write here' },
    send: { text: 'Send' },
    voiceNote: { text: 'Voice message' },
    recording: { text: 'Recording' },
    voiceSend: { text: 'Send voice message' },
    voiceCancel: { text: 'Cancel recording' },
    noteStopped: { text: 'Recording stopped when you left Qandeel' },
    play: { text: 'Play voice message' },
    pause: { text: 'Pause voice message' },
    qPlay: { text: 'Play Qandeel’s reply' },
    permPurpose: { text: 'Qandeel uses the microphone for voice messages and calls, and only while they are running.' },
    micDenied: { text: 'The microphone isn’t available to Qandeel. Writing is available.' },
    openSettings: { text: 'Open Settings' },
    call: { text: 'Voice call' },
    connecting: { text: 'Connecting' },
    micOn: { text: 'Microphone on' },
    muted: { text: 'Microphone muted' },
    qSpeaking: { text: 'Qandeel is speaking' },
    reconnecting: { text: 'The call dropped. Reconnecting.' },
    callFailed: { text: 'The call isn’t working. You can keep going in writing.' },
    mute: { text: 'Mute microphone' },
    endCall: { text: 'End call' },
    route: { text: 'Speaker' },
    callStarted: { text: 'Voice call started' },
    callRecord: { text: 'Voice call' },
    callRecordStopped: { text: 'stopped' },
    liveContext: { text: 'In play', status: 'VI-01 §19.2: English Live Context wording OPEN; "In play" follows T13 EN' },
    liveContextEmpty: { text: 'Nothing is in play.' },
    today: { text: 'Today' },
    yesterday: { text: 'Yesterday' },
    sharedOne: { text: 'Shared world' },
    sharedMany: { text: 'Shared worlds' },
    speakerMe: { text: 'You' },
    speakerQ: { text: 'Qandeel' },
  },
};

/** Counted-noun grammar for the Replay part summary (G1.1 R3). */
export function messagesCount(lang, n) {
  if (lang === 'en') return n === 1 ? '1 message' : `${n} messages`;
  if (n === 1) return 'رسالة واحدة';
  if (n === 2) return 'رسالتين';
  if (n >= 3 && n <= 10) return `${n} رسائل`;
  return `${n} رسالة`;
}

/** The returning-reader conversation (inherited from G1.1 R3 unchanged; the F2 fixture world's topics). */
export const THREAD = {
  ar: [
    { day: 'yesterday' },
    { who: 'me', text: 'خلّصت الشغل متأخر تاني. كان جاهز من يومين، بس فضلت أعدّل فيه.' },
    { who: 'q', text: 'التعديلات كانت في إيه؟' },
    { who: 'me', text: 'تفاصيل صغيرة. الألوان، وترتيب الـslides. محدش كان هياخد باله.' },
    { who: 'q', text: 'ده اللي فهمته: الملف كان جاهز، والوقت راح في تفاصيل محدش هيشوفها.' },
    { day: 'today', time: '9:40' },
    { who: 'q', kind: 'opener' },
    { who: 'me', text: 'عندي presentation للـclient يوم الخميس الساعة 10:30، ولسه مخلّصتش.' },
    { who: 'q', text: 'آخر أربع مرات، الإعداد كان بيطوّل، والنوم بيقلّ قبل التسليم بيومين، وبعدها الطاقة بتنزل. ده اللي شايفه في عالمك، ومش متأكد من السبب.' },
    { who: 'me', text: 'الأرقام بس اللي ناقصة. الـQ3 numbers لسه ما وصلتش من finance.' },
    { who: 'q', text: 'يعني اللي ناقص دلوقتي مش في إيدك. لما الأرقام توصل، إيه أول خطوة في العرض؟' },
  ],
  en: [
    { day: 'yesterday' },
    { who: 'me', text: 'Finished late again. It was ready two days ago, but I kept tweaking it.' },
    { who: 'q', text: 'What were the tweaks?' },
    { who: 'me', text: 'Small things. The colours, the order of the slides. Nobody would have noticed.' },
    { who: 'q', text: 'Here’s what I’m hearing: the file was ready, and the time went into details nobody would see.' },
    { day: 'today', time: '9:40' },
    { who: 'q', kind: 'opener' },
    { who: 'me', text: 'I’ve got a presentation for the client on Thursday at 10:30, and it’s still not done.' },
    { who: 'q', text: 'The last four times, the preparation ran long, sleep got shorter two days before the deadline, and then your energy dropped. That’s what I see in your world. I’m not sure why.' },
    { who: 'me', text: 'It’s just the numbers. The Q3 numbers still haven’t come in from finance.' },
    { who: 'q', text: 'So what’s missing right now isn’t in your hands. When the numbers arrive, what’s the first step in the presentation?' },
  ],
};
export const NEW_THREAD = { ar: [{ day: 'today', time: '9:40' }, { who: 'q', kind: 'opener' }], en: [{ day: 'today', time: '9:40' }, { who: 'q', kind: 'opener' }] };

/**
 * Voice Note fixture — appended to THREAD for the committed-voice-note states. G1.2 §15: do NOT imply a
 * transcript that does not exist, stored audio that does not exist, or a waveform as semantic truth. So the
 * reader's committed note carries exactly what the capture itself knows — that it is a voice message and how
 * long it is. No transcript line, no waveform. (R3 showed a transcript here; G1.2 removes it — report §F.)
 * QANDEEL's reply is its own TEXT turn (QANDEEL's words exist as text); a spoken rendering of it is a
 * CANDIDATE control only (speech rendering is a runtime dependency).
 */
export const VOICE_TURNS = {
  ar: [
    { who: 'me', kind: 'voice', durMs: 14000 },
    { who: 'q', kind: 'spoken', durMs: 9000, text: 'تمام. العرض من غير الأرقام، أوله هيبقى إيه؟' },
  ],
  en: [
    { who: 'me', kind: 'voice', durMs: 14000 },
    { who: 'q', kind: 'spoken', durMs: 9000, text: 'All right. Without the numbers, what does the presentation open with?' },
  ],
};

/**
 * Live Context values (FIXTURE). The Analysis scaffold is the sealed F2 fixture world; these are three of the
 * readings drawn IN that raster; during a call «سياق الكلام» names which of them the latest COMMITTED spoken turn brought into
 * play (canonical Live Focus is set by committed conversation — apps/mobile/README.md T-03D). No new relation is
 * invented: every value is an existing fixture reading.
 */
export const LIVE_CONTEXT = { ar: ['الرغبة في الإتقان', 'قلّة النوم', 'إرهاق آخر الأسبوع'], en: ['The wish to perfect', 'Short sleep', 'End-of-week exhaustion'] };

/**
 * The simulated call (prototype only — there is no voice runtime). One 20 s cycle, repeated: who has audio,
 * and the moments a spoken turn COMMITS. Times are ms after the call is established.
 */
export const CALL_SCRIPT = {
  connectMs: 1200,
  cycleMs: 20000,
  segments: [
    { who: 'me', from: 400, to: 4000 }, { who: 'q', from: 5000, to: 8200 },
    { who: 'me', from: 9200, to: 12800 }, { who: 'q', from: 13800, to: 17000 },
  ],
  commits: [4200, 13000],
};

/** Mixed-script stress set (inherited from G1.1 R3). */
export const STRESS = {
  ar: [
    { who: 'q', kind: 'opener', name: DISPLAY_NAME.latinInArabic, case: 'Latin display name inside the Arabic opener' },
    { who: 'me', text: 'بعتّ الـdeck لـmariam.k@studio.co الساعة 11:05 — نسخة v2.3، والـQ3 review يوم 30/9.' },
    { who: 'q', text: 'في رسالتك تاريخين: الخميس 24/9 و30/9. أيّهم ميعاد العرض؟' },
    { who: 'me', text: 'Q3 numbers لسه ما وصلتش، هبعتهالك أول ما توصل.', case: 'latin-first Arabic sentence' },
    { who: 'q', text: 'تمام. لما توصل، إيه اللي هيتغيّر في العرض؟' },
    { who: 'me', text: 'Subject: "Q3 review — final numbers (v2.3)"', case: 'pasted all-English line' },
    { who: 'me', kind: 'voice', durMs: 7000 },
  ],
};

export const SHARED_WORLDS = {
  ar: [{ people: 'مع كريم', last: 'أمس' }, { people: 'مع سلمى وياسر', last: 'الأحد' }, { people: 'مع مها', last: 'الاتنين' }],
  en: [{ people: 'With Karim', last: 'Yesterday' }, { people: 'With Salma and Yasser', last: 'Sunday' }, { people: 'With Maha', last: 'Monday' }],
};

/** m:ss from ms. Western digits, as the whole G1.1 fixture (10:30, 9:40) already uses — one numeral system per view. */
export const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
