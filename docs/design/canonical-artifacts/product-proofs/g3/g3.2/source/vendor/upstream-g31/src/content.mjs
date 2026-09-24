// G3.1 — every word the integrated proof can show, in both Product languages, with its authority attached.
//
// Built from two sealed sources and nothing else:
//   - the G2.3 build input content.mjs (sha256 ae06f380…, identical to the hash in the preserved G2.3 MANIFEST), which
//     already carries the G1.2 R1 call wording and the exact G2.3 Matching copy;
//   - the G1.2 R1 source content.mjs on main (docs/design/canonical-artifacts/product-proofs/g1.2/source/src/content.mjs),
//     for the Voice Note and call-history words the G2 line did not carry.
// G3.1 writes no new Product copy. Where a word is missing it is recorded as OPEN COPY, never invented.
//
// Status classes (never mixed, and checked):
//   LOCKED-G1          fixed by the G1.1 / G1.2 closures on main — reproduced verbatim
//   FROZEN-T08         apps/mobile/src/orientation-chrome/product-copy.ts on main — verbatim (vendored, checked)
//   PO-APPROVED (G2.3) the exact Matching opening + QANDEEL-view / privacy copy (G2.3 closure §1–§2) — verbatim
//   OPEN-VI01          voice / call wording VI-01 holds provisional (G1.2 R1, unchanged)
//   PROOF COPY — OPEN  Matching words written for the G2 proofs — not final (G2 closure §G items 1–6)
//   PROOF              other proof words (G1.1 / G1.2 / G2.x), editable craft, not canonical
//   OPEN COPY          a slot canon leaves open in this language (G3 handoff §7)
//   FIXTURE            stands in for runtime data the proof does not have

const L = 'LOCKED-G1', T8 = 'FROZEN-T08', V = 'OPEN-VI01', P = 'PROOF', F = 'FIXTURE';
const PO = 'PO-APPROVED (G2.3)', OPEN = 'PROOF COPY — OPEN', OC = 'OPEN COPY';
const s = (text, status, note) => (note ? { text, status, note } : { text, status });

export const COPY = {
  ar: {
    dir: 'rtl', lang: 'ar-EG',
    product: s('قنديل', 'VI-01 S01'),
    // ---- the shell (G1.1 / G1.2)
    back: s('المحادثة', L, 'G1.1 closure §1 — Analysis → Conversation'),
    backName: s('المحادثة — رجوع', P, 'accessible name; contains the visible label'),
    backNameCall: s('المحادثة — المكالمة مستمرة', P, 'G1.2: opening Conversation does not end the call'),
    door: s('تحليل المحادثة', L, 'G1.1 closure §1 — Conversation → Analysis'),
    doorNameCall: s('تحليل المحادثة — المكالمة مستمرة', P),
    analysisRegion: s('تحليل المحادثة', L, 'accessible name of the Analysis region'),
    convRegion: s('المحادثة', L),
    worldRegionHint: s('اسحب للتنقل في العالم، وقرّب أو بعّد بإصبعين أو بعجلة الفأرة.', P, 'G2.1 accessible description of the world region'),
    nav: { label: s('العوالم', P, 'G1.1 R3 landmark name'),
      items: [{ key: 'mine', ...s('قنديل', 'G1.1 R3 proof label — MY_WORLD') }, { key: 'shared', ...s('العالم المشترك', L, 'G1.2 closure §3') }, { key: 'public', ...s('العالم العام', 'G1.1 R3 proof label — PUBLIC_WORLD') }] },
    // ---- Replay (G1.1 placement is LOCKED; the noun is proof)
    replay: s('إعادة عرض المحادثة', P, 'no canonical Arabic Replay noun (G1.1 closure §5) — OPEN COPY per G3 handoff §7'),
    replayFull: s('المحادثة كاملة', P, 'G1.1 R3 proof entry'),
    replayPart: s('جزء من المحادثة', P, 'G1.1 R3 proof entry'),
    replayCallNote: s('المكالمة الصوتية غير مشمولة.', P, 'true of every Personal call (replay-runtime-v1 §7; QAN-BL-VOICE-01)'),
    // ---- T-08, verbatim
    returns: {
      BACK_ONE_STEP: { label: s('الرجوع خطوة واحدة', T8), hint: s('يستعيد موضعك قبل خطوتك الأخيرة. لا يعيدك إلى المحادثة الجارية.', T8) },
      EXACT_RETURN: { label: s('العودة إلى المعاينة الأصلية', T8), hint: s('يستعيد بالضبط الموضع الذي بدأت منه هذه المعاينة.', T8) },
      RETURN_LIVE_HEAD: { label: s('العودة إلى المحادثة الجارية', T8), hint: s('يتابع المحادثة وهي تستمر. لا يتحرك العرض.', T8) },
      RETURN_LIVE_FOCUS: { label: s('الانتقال إلى موضع الاهتمام الآن', T8), hint: s('ينتقل مرة واحدة إلى موضع الاهتمام الآن. لا تتغير لحظتك.', T8) },
      RETURN_WORLD: { label: s('العودة إلى العالم كله', T8), hint: s('يعود إلى العالم كله عند اللحظة نفسها.', T8) },
      GO_LIVE_AND_LOCATE: { label: s('العودة إلى المحادثة والانتقال إلى موضعها', T8), hint: s('يعود إلى المحادثة الجارية، وإذا أمكن تحديد موضع الاهتمام هناك، ينقل العرض إليه في الخطوة نفسها.', T8) },
    },
    chromeLabel: s('موضعك', T8), inspectionLabel: s('قيد المعاينة', T8), returnControlsLabel: s('طرق العودة', T8),
    family: { THREAD: 'خيط', EMERGING_FOCUS: 'تركيز ناشئ', MOMENT: 'لحظة', READING: 'قراءة', MATERIAL: 'شيء من كلامك', GAP: 'فجوة', QUESTION: 'سؤال', CONFIDENCE: 'ثقة', status: T8 },
    inspectRenderable: (fam) => `قيد المعاينة: ${fam}.`,
    temporalLive: s('أنت عند آخر المحادثة.', T8),
    temporalPinned: (n) => `أنت عند اللحظة ${n}.`,
    previewLine: (n) => `نظرة مؤقتة على اللحظة ${n}، ولم يتغير موضعك.`,
    liveContinued: s('استمرت المحادثة بعد هذه اللحظة.', T8),
    // ---- the Timeline (T-06 ships no Arabic; these are proof — OPEN COPY per G3 handoff §7)
    timelineLabel: s('خط المحادثة', P, 'accessible name of the temporal instrument'),
    timelineHint: s('اسحب أو استخدم الأسهم لنظرة مؤقتة على لحظة، ثم اترك أو اضغط Enter للذهاب إليها.', P),
    liveSlotFollowing: s('أنت عند آخر المحادثة', P, 'accessible name of the live end while following — the T-08 temporal sentence'),
    previewCancel: s('إلغاء النظرة', P), previewCommit: (n) => `الذهاب إلى اللحظة ${n}`,
    // ---- Writing / Voice Note / Live Call (G1.2 R1)
    composerLabel: s('رسالتك لقنديل', 'VI-01 A10 PROPOSED'), composerPlaceholder: s('كلامك هنا', 'VI-01 A10 PROPOSED'),
    send: s('إرسال', 'masdar'),
    voiceNote: s('رسالة صوتية', V),
    recording: s('بسجّل', V, 'V04 — visible because a voice note IS being captured (G1.2 R1 keeps capture wording visible)'),
    voiceSend: s('إرسال الرسالة الصوتية', P), voiceCancel: s('إلغاء التسجيل', P),
    play: s('تشغيل الرسالة الصوتية', P), pause: s('إيقاف الرسالة الصوتية مؤقتًا', P),
    call: s('مكالمة صوتية', V, 'V02'),
    connecting: s('جاري الاتصال', V, 'a transitional state: visible (G1.2 closure §4)'),
    micOn: s('الميكروفون شغّال', V, 'ACCESSIBILITY-ONLY — never persistently visible (G1.2 closure §4)'),
    muted: s('الميكروفون مكتوم', V, 'ACCESSIBILITY-ONLY'),
    qSpeaking: s('قنديل بيتكلم', V, 'ACCESSIBILITY-ONLY'),
    mute: s('كتم الميكروفون', P), unmute: s('تشغيل الميكروفون', P), endCall: s('إنهاء المكالمة', P),
    route: s('السماعة الخارجية', P, 'G1.2 G12-J4 candidate'),
    callStarted: s('مكالمة صوتية بدأت', P, 'G1.1 R3 / G1.2 — live marker in the history while the call runs'),
    callRecord: s('مكالمة صوتية', P, 'G1.2 — what an ended call leaves in the history; runtime dependency (QAN-BL-VOICE-01)'),
    // ---- Matching (G2.3 closure §1–§2 verbatim; everything else PROOF COPY — OPEN)
    matchCue: s('قنديل شايف إن في شخص يستحق إنك تتعرف عليه. بناءً على فهمه لكل منكما، شايف إن بينكم مساحة تستحق إنكم تكتشفوها سوا.', PO, 'G2.3 closure §1 — the opening message, verbatim'),
    matchCueAct: s('ليه؟', OPEN, 'G2 closure §G item 1 — the cue action label'),
    proposalRegion: s('اقتراح التعارف', OPEN, 'accessible name of the private proposal place'),
    propView: s('قنديل شايف إن بينكم نقاط اتفاق كثيرة، وفي نفس الوقت في اختلافات تستحق إنكم تفهموها بهدوء. لو قررتوا تبدأوا التعارف، قنديل هيكون معاكم يساعدكم تفهموا بعض، ويتكلم معاكم عن نقاط الاتفاق والاختلاف في الوقت المناسب.', PO, 'G2.3 closure §2 — QANDEEL\'s view, verbatim'),
    propPrivacy: s('خصوصيتك محفوظة. بياناتك وتحليلاتك الخاصة لن تُعرض على الطرف الآخر، ولن يُشارك منها شيء إلا ما تختار أنت مشاركته. وقنديل هيكون معك خطوة بخطوة لحد ما تكون مرتاح ومطمئن.', PO, 'G2.3 closure §2 — the privacy message, verbatim'),
    propNextA: s('لو كمّلت، هيتعرض التعارف على الطرف التاني.', OPEN, 'FIRST_RECIPIENT: continuing approves forwarding'),
    propNextB: s('لو كمّلت، هيتفتح لكم عالم مشترك للتعارف على طول.', OPEN, 'G2 closure §G item 4 — second-accepter explanatory copy'),
    proceed: s('أكمّل', OPEN), notNow: s('لأ، شكراً', OPEN),
    ack: s('وصل ردّك لقنديل، ولو جدّ جديد هيقولك.', OPEN, 'G2 closure §G item 2 — first-accepter acknowledgement'),
    unavailable: s('التعارف ده مبقاش متاح.', OPEN, 'G2 closure §G item 3 — neutral unavailable'),
    endedAct: s('تمام', OPEN),
    arrivalLine: s('الطرفين وافقوا على التعارف', OPEN, 'G2 closure §G item 5 — later arrival'),
    arrivalAct: s('عالمكم المشترك', OPEN),
    revealReturns: s('طرق العودة', T8, 'T-08 returnControlsLabel verbatim; the ONE affordance for secondary Return acts (T-11 amendment §2)'),
    proposalBack: s('تحليل المحادثة', P, 'the proposal is left the way it was entered'),
    sharedTitle: s('العالم المشترك', L, 'G1.2 closure §3 — the Product-area name, reused as the destination\'s name'),
    phaseIntroduction: s('تعارف', OPEN, 'the INTRODUCTION phase, named plainly'),
    sharedToday: (t) => `اليوم ${t}`,
    welcome: s('أهلاً بيكم. أنا هنا معاكم في البداية، وكل واحد فيكم يقرر يشارك إيه وإمتى.', OPEN, 'G2 closure §G item 6 — Shared World welcome'),
    // ---- people
    displayName: s('نور', F),
    speakerMe: s('كلامك', P), speakerQ: s('قنديل', P),
  },
  en: {
    dir: 'ltr', lang: 'en',
    product: s('Qandeel', 'VI-01 S01'),
    back: s('Conversation', L, 'G1.1 closure §2 — English Conversation surface'),
    backName: s('Conversation — back', P), backNameCall: s('Conversation — the call continues', P),
    door: s('Conversation analysis', OC, 'G1.1 closure §2: the exact English Conversation → Analysis label is open to the English copy pass (G2.1/G1.x proof wording kept)'),
    doorNameCall: s('Conversation analysis — the call continues', P),
    analysisRegion: s('Conversation analysis', OC), convRegion: s('Conversation', L),
    worldRegionHint: s('Drag to move through the world; pinch or use the wheel to come closer or step back.', P),
    nav: { label: s('Worlds', P), items: [{ key: 'mine', ...s('Qandeel', P) }, { key: 'shared', ...s('Shared World', L, 'G1.2 closure §3') }, { key: 'public', ...s('Public world', P) }] },
    replay: s('Replay this conversation', P), replayFull: s('The whole conversation', P), replayPart: s('Part of the conversation', P),
    replayCallNote: s('Voice calls aren’t included.', P),
    returns: {
      BACK_ONE_STEP: { label: s('Back one step', T8), hint: s('Restores the viewpoint your most recent step came from. It does not rejoin the conversation.', T8) },
      EXACT_RETURN: { label: s('Return to the original inspection', T8), hint: s('Restores exactly the viewpoint this inspection started from.', T8) },
      RETURN_LIVE_HEAD: { label: s('Rejoin the conversation', T8), hint: s('Follows the conversation as it continues. The view does not move.', T8) },
      RETURN_LIVE_FOCUS: { label: s('Move to where attention is now', T8), hint: s('Goes once to where attention is now. The moment you are reading does not change.', T8) },
      RETURN_WORLD: { label: s('Return to the whole world', T8), hint: s('Returns to the world viewpoint at the same moment you are reading.', T8) },
      GO_LIVE_AND_LOCATE: { label: s('Rejoin the conversation and move there', T8), hint: s('Rejoins the conversation and, if its current attention can be located there, moves the view to it in the same step.', T8) },
    },
    chromeLabel: s('Where you are', T8), inspectionLabel: s('What you are inspecting', T8), returnControlsLabel: s('Ways back', T8),
    family: { THREAD: 'a thread', EMERGING_FOCUS: 'an emerging focus', MOMENT: 'a moment', READING: 'a reading', MATERIAL: 'something you said', GAP: 'a gap', QUESTION: 'a question', CONFIDENCE: 'a confidence', status: T8 },
    inspectRenderable: (fam) => `You are inspecting ${fam}.`,
    temporalLive: s('Following the conversation as it continues.', T8),
    temporalPinned: (n) => `Reading at moment ${n}.`,
    previewLine: (n) => `A temporary look at moment ${n}. Your position has not changed.`,
    liveContinued: s('The conversation has continued since this moment.', T8),
    timelineLabel: s('Conversation timeline', P), timelineHint: s('Drag or use the arrow keys for a temporary look at a moment; release or press Enter to go to it.', P),
    liveSlotFollowing: s('Following the conversation as it continues', P),
    previewCancel: s('Cancel the look', P), previewCommit: (n) => `Go to moment ${n}`,
    composerLabel: s('Your message to Qandeel', P), composerPlaceholder: s('Write here', P),
    send: s('Send', P), voiceNote: s('Voice message', V), recording: s('Recording', V),
    voiceSend: s('Send voice message', P), voiceCancel: s('Cancel recording', P),
    play: s('Play voice message', P), pause: s('Pause voice message', P),
    call: s('Voice call', V), connecting: s('Connecting', V), micOn: s('Microphone on', V, 'ACCESSIBILITY-ONLY'), muted: s('Microphone muted', V, 'ACCESSIBILITY-ONLY'), qSpeaking: s('Qandeel is speaking', V, 'ACCESSIBILITY-ONLY'),
    mute: s('Mute microphone', P), unmute: s('Turn microphone on', P), endCall: s('End call', P), route: s('Speaker', P),
    callStarted: s('Voice call started', P), callRecord: s('Voice call', P),
    // No English Matching copy exists in canon (G2.3 closure §1–§2 are Arabic; brief: do not translate). The English
    // shell therefore offers no Matching moment in this proof — recorded as OPEN COPY, never invented.
    revealReturns: s('Ways back', T8, 'T-08 returnControlsLabel verbatim'),
    sharedTitle: s('Shared World', L, 'G1.2 closure §3'),
    displayName: s('Nour', F), speakerMe: s('You', P), speakerQ: s('Qandeel', P),
  },
};

/** The G1.2 conversation (reused unchanged by G2.3) — the Conversation the Analysis belongs to. */
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
export const OPENER = { ar: 'اهلا يا {display_name} ... انا في انتظارك ... يلا نبدأ', en: 'Hi {display_name} ... I\'m here waiting for you ... let\'s get started' };
export const DAYS = { ar: { today: 'اليوم', yesterday: 'أمس' }, en: { today: 'Today', yesterday: 'Yesterday' } };
/** What the journeys type (FIXTURE). The same-script sample is G1.2's `typingSample`; the cross-script sample is the
 *  other language's G1.2 sample, so paragraph direction is proved independent of the speaker side (G1.1 §1). */
export const TYPING = {
  ar: { same: 'الأرقام هتوصل بكرة الصبح', cross: 'The numbers land tomorrow morning' },
  en: { same: 'The numbers land tomorrow morning', cross: 'الأرقام هتوصل بكرة الصبح' },
};

/** G1.2's simulated call (content.mjs CALL_SCRIPT, unchanged): who has audio, and when a spoken turn COMMITS. ms after
 *  the call is established; one 20 s cycle, repeated. There is no voice runtime. */
export const CALL_SCRIPT = {
  connectMs: 1200,
  cycleMs: 20000,
  segments: [
    { who: 'me', from: 400, to: 4000 }, { who: 'q', from: 5000, to: 8200 },
    { who: 'me', from: 9200, to: 12800 }, { who: 'q', from: 13800, to: 17000 },
  ],
  commits: [4200, 13000],
};

/**
 * THE FIXTURE CONVERSATION'S HISTORY (G2.1 seam S-18, unchanged).
 * The canonical built world is the analysis as known at Session Position 14. Each later committed turn — written,
 * a voice note, or a spoken turn of the Live Call — changes QANDEEL's analysis by at most ONE canonical event,
 * replayed through the world's own event channel with its own seed:
 *   SP15  emerge    — new material in the current session
 *   SP16  focus     — the Live Focus moves
 *   SP17  relation  — QANDEEL connects two objects in view
 * A committed turn after SP17 is a Moment that changed nothing visible: activity has no light (G2.1).
 */
export const FIXTURE = {
  builtAt: 14, firstMoment: 1,
  history: [
    { sp: 15, kind: 'emerge', cam: { cx: 1165, cy: 712, field: 1518 } },
    { sp: 16, kind: 'focus', cam: { cx: 1370, cy: 590, field: 1518 } },
    { sp: 17, kind: 'relation', cam: { cx: 1250, cy: 690, field: 1100 } },
  ],
  focusFamily: 'EMERGING_FOCUS',
  kindFamily: { MOMENT: 'MOMENT', THREAD: 'THREAD', READING: 'READING', MEMO: 'MATERIAL', OPEN: 'QUESTION' },
  convId: 'conv-7c21',
};
