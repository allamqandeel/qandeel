// G1.1-R3 — every word the proof shows, in both Product languages.
//
// Status travels WITH each string, because nothing here may be presented as a Product freeze (R3 §0):
//   R3 LOCKED  fixed by the R3 consolidated brief — reproduced verbatim, never paraphrased
//   VI-01      docs/design/phase-vi/vi-01-bilingual-product-language/ (Terminology Matrix, Foundation)
//   T-08       apps/mobile/src/orientation-chrome/product-copy.ts (shipped runtime copy)
//   PROOF      written for this proof — editable craft, not canonical
//   FIXTURE    stands in for runtime data the proof does not have
//
// Register law (VI-01 §3.1): T1 chrome = neutral contemporary Arabic; T2 QANDEEL's voice = restrained
// Egyptian, first person, gender-neutral toward the reader (§3.6). The READER's own turns are the reader's
// words. No exclamation marks, no emoji (§15.8).

/** R3 §2 — the new-conversation opener. Byte-for-byte; `{display_name}` is the ONLY substitution. */
export const OPENER = {
  ar: 'اهلا يا {display_name} ... انا في انتظارك ... يلا نبدأ',
  en: 'Hi {display_name} ... I\'m here waiting for you ... let\'s get started',
};
/**
 * The display name. FIXTURE: this repository has no canonical product account name
 * (database/migrations/0001: users = id, auth_subject, created_at, updated_at; 0111 returns
 * UNRESOLVED_NO_CANONICAL_SOURCE). «نور» is used because it is a name used for any reader, so the
 * fixture implies nothing about the reader. The Latin form proves the bidi isolation of the substitution.
 */
export const DISPLAY_NAME = { ar: 'نور', en: 'Nour', latinInArabic: 'Nour' };
export const openerText = (lang, name = DISPLAY_NAME[lang]) => OPENER[lang].split('{display_name}').join(name);

export const COPY = {
  ar: {
    dir: 'rtl', lang: 'ar-EG',
    product: { text: 'قنديل', status: 'VI-01 S01 — root accessible name' },
    nav: {
      label: { text: 'العوالم', status: 'PROOF — accessible name of the navigation landmark' },
      items: [
        { key: 'mine', text: 'قنديل', status: 'PROVISIONAL PROOF LABEL — MY_WORLD' },
        { key: 'shared', text: 'مع الآخرين', status: 'R3 §12 — count-neutral proof direction (not frozen)' },
        { key: 'public', text: 'العالم العام', status: 'PROVISIONAL PROOF LABEL — PUBLIC_WORLD' },
      ],
    },
    door: { text: 'تحليل المحادثة', status: 'R3 LOCKED §9 — from Conversation' },
    back: { text: 'المحادثة', status: 'R3 LOCKED §9 — from Analysis' },
    backName: { text: 'المحادثة — رجوع', status: 'PROOF — accessible name; contains the visible label (WCAG 2.5.3)' },
    backNameCall: { text: 'المحادثة — المكالمة مستمرة', status: 'PROOF — during a Live Call: opening Conversation does not end the call' },
    replay: { text: 'إعادة عرض المحادثة', status: 'PROOF — no canonical Arabic term for Replay exists (decision R3-J6)' },
    replayFull: { text: 'المحادثة كاملة', status: 'R3 LOCKED §10' },
    replayPart: { text: 'جزء من المحادثة', status: 'R3 LOCKED §10' },
    preview: { text: 'معاينة', status: 'PROOF — masdar control label' },
    cancel: { text: 'إلغاء', status: 'PROOF — masdar' },
    close: { text: 'قفل', status: 'VI-01 A02 — dismiss' },
    pickHint: { text: 'أول رسالة وآخر رسالة في الجزء', status: 'PROOF — no second-person verb (VI-01 §3.6)' },
    composerLabel: { text: 'رسالتك لقنديل', status: 'VI-01 A10 PROPOSED' },
    composerPlaceholder: { text: 'كلامك هنا', status: 'VI-01 A10 PROPOSED' },
    send: { text: 'إرسال', status: 'masdar control label (VI-01 §3.6.2)' },
    voiceNote: { text: 'رسالة صوتية', status: 'VI-01 V01 (Part 2, composer) — PROVISIONAL / PHASE VII' },
    recording: { text: 'بسجّل', status: 'VI-01 V04 — a voice note IS recorded, so the claim is true here' },
    voiceSend: { text: 'إرسال الرسالة الصوتية', status: 'PROOF — masdar' },
    voiceCancel: { text: 'إلغاء التسجيل', status: 'PROOF — masdar' },
    play: { text: 'تشغيل الرسالة الصوتية', status: 'PROOF — masdar' },
    qPlay: { text: 'تشغيل رد قنديل', status: 'PROOF — masdar' },
    call: { text: 'مكالمة صوتية', status: 'VI-01 V02 — PROVISIONAL / PHASE VII' },
    mute: { text: 'كتم الميكروفون', status: 'PROOF — masdar; aria-pressed carries the state' },
    endCall: { text: 'إنهاء المكالمة', status: 'PROOF — masdar' },
    callStarted: { text: 'مكالمة صوتية بدأت', status: 'PROOF — a live marker in the history while the call runs' },
    callRecord: { text: 'مكالمة صوتية', status: 'PROOF — what the call leaves in the history; runtime dependency (R3 §8, §11)' },
    today: { text: 'اليوم', status: 'PROOF' },
    yesterday: { text: 'أمس', status: 'PROOF' },
    worldEmpty: { text: 'لسه مفيش قراءة اتكوّنت.', status: 'VI-01 T05 (semantics frozen, AR PROPOSED)' },
    sharedOne: { text: 'عالم مشترك', status: 'R3 LOCKED §12 — exactly one' },
    sharedMany: { text: 'عوالم مشتركة', status: 'R3 LOCKED §12 — more than one' },
    sharedNone: { text: 'لسه مفيش عالم مشترك.', status: 'PROOF — zero: an honest empty state' },
    sharedNote: { text: 'العالم المشترك بيتكوّن لما كل الأطراف يوافقوا.', status: 'PROOF — states CW birth-by-acceptance' },
    publicNote: { text: 'العالم العام خارج نطاق هذا الإثبات.', status: 'REVIEW CHROME — not Product copy' },
    speakerMe: { text: 'كلامك', status: 'PROOF (A1) — visually hidden speaker label before each reader turn' },
    speakerQ: { text: 'قنديل', status: 'PROOF (A1) — visually hidden speaker label before each QANDEEL turn' },
  },
  en: {
    dir: 'ltr', lang: 'en',
    product: { text: 'Qandeel' },
    nav: {
      label: { text: 'Worlds' },
      items: [
        { key: 'mine', text: 'Qandeel' },
        { key: 'shared', text: 'With others' },
        { key: 'public', text: 'Public world' },
      ],
    },
    door: { text: 'Conversation analysis' },
    back: { text: 'Conversation' },
    backName: { text: 'Conversation — back' },
    backNameCall: { text: 'Conversation — the call continues' },
    replay: { text: 'Replay this conversation' },
    replayFull: { text: 'The whole conversation' },
    replayPart: { text: 'Part of the conversation' },
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
    play: { text: 'Play voice message' },
    qPlay: { text: 'Play Qandeel’s reply' },
    call: { text: 'Voice call' },
    mute: { text: 'Mute microphone' },
    endCall: { text: 'End call' },
    callStarted: { text: 'Voice call started' },
    callRecord: { text: 'Voice call' },
    today: { text: 'Today' },
    yesterday: { text: 'Yesterday' },
    worldEmpty: { text: 'No reading has formed for this yet.' },
    sharedOne: { text: 'Shared world' },
    sharedMany: { text: 'Shared worlds' },
    sharedNone: { text: 'No shared world yet.' },
    sharedNote: { text: 'A shared world forms when everyone in it accepts.' },
    publicNote: { text: 'The public world is outside this proof.' },
    speakerMe: { text: 'You' },
    speakerQ: { text: 'Qandeel' },
  },
};

/** Counted-noun grammar for the Replay part summary. Arabic: 1 واحدة, 2 dual, 3–10 plural, 11+ singular. */
export function messagesCount(lang, n) {
  if (lang === 'en') return n === 1 ? '1 message' : `${n} messages`;
  if (n === 1) return 'رسالة واحدة';
  if (n === 2) return 'رسالتين';
  if (n >= 3 && n <= 10) return `${n} رسائل`;
  return `${n} رسالة`;
}

/**
 * The returning-reader conversation. `who`: 'me' = the reader, 'q' = QANDEEL. Today's conversation OPENS
 * with the R3 opener (kind 'opener') — every new conversation does — and yesterday's conversation above it
 * is the same one QANDEEL history (R3 §5: one relationship, one history). The content agrees with the
 * canonical F2 fixture world the Analysis lands in (topics «الرغبة في الإتقان» «قلّة النوم» «تراجع الطاقة»).
 */
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

/** A brand-new conversation: the opener and nothing else. No committed reader material, so no Replay. */
export const NEW_THREAD = { ar: [{ day: 'today', time: '9:40' }, { who: 'q', kind: 'opener' }], en: [{ day: 'today', time: '9:40' }, { who: 'q', kind: 'opener' }] };

/**
 * Voice Note fixture — appended to THREAD for the voice-note-in-history state. The reader's note carries its
 * transcript as the committed text (canonical Personal conversation units are TEXT only); QANDEEL's spoken
 * reply carries its text. Durations are fixture values.
 */
export const VOICE_TURNS = {
  ar: [
    { who: 'me', kind: 'voice', dur: '0:14', text: 'الأرقام لسه ما وصلتش. لو ما جتش النهارده، هقدّم من غيرها.' },
    { who: 'q', kind: 'voice', dur: '0:09', text: 'تمام. العرض من غير الأرقام، أوله هيبقى إيه؟' },
  ],
  en: [
    { who: 'me', kind: 'voice', dur: '0:14', text: 'The numbers still aren’t here. If they don’t come today, I’ll present without them.' },
    { who: 'q', kind: 'voice', dur: '0:09', text: 'All right. Without the numbers, what does the presentation open with?' },
  ],
};

/**
 * Mixed-script stress set (the bilingual proof). A1's two traps are kept: an Arabic sentence that OPENS with
 * an English word, and a pasted all-English line inside the Arabic conversation.
 */
export const STRESS = {
  ar: [
    { who: 'q', kind: 'opener', name: DISPLAY_NAME.latinInArabic, case: 'Latin display name inside the Arabic opener' },
    { who: 'me', text: 'بعتّ الـdeck لـmariam.k@studio.co الساعة 11:05 — نسخة v2.3، والـQ3 review يوم 30/9.' },
    { who: 'q', text: 'في رسالتك تاريخين: الخميس 24/9 و30/9. أيّهم ميعاد العرض؟' },
    { who: 'me', text: 'الخميس هو العرض، و30/9 آخر ميعاد للـfinal numbers (من finance).' },
    { who: 'me', text: 'Q3 numbers لسه ما وصلتش، هبعتهالك أول ما توصل.', case: 'latin-first Arabic sentence' },
    { who: 'q', text: 'تمام. لما توصل، إيه اللي هيتغيّر في العرض؟' },
    { who: 'me', text: 'Subject: "Q3 review — final numbers (v2.3)"', case: 'pasted all-English line' },
  ],
};

/** Shared worlds (participant sets only — no invented world names). The runtime shows the first `?shared=` n. */
export const SHARED_WORLDS = {
  ar: [
    { people: 'مع كريم', last: 'أمس' },
    { people: 'مع سلمى وياسر', last: 'الأحد' },
    { people: 'مع مها', last: 'الاتنين' },
  ],
  en: [
    { people: 'With Karim', last: 'Yesterday' },
    { people: 'With Salma and Yasser', last: 'Sunday' },
    { people: 'With Maha', last: 'Monday' },
  ],
};
