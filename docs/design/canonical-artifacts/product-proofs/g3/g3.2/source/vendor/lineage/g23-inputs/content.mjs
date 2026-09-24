// G2.1 — every word the proof can show, in both Product languages, with its authority attached.
// G2.3 — the two Product-Owner-approved Matching messages (D1, D2) replace the G2.2 cue and the G2.2 three-reason
//        proposal; every other Matching word stays PROOF COPY — OPEN (brief §6). Nothing else changes.
//
// Status classes (never mixed, and checked):
//   LOCKED-G1   fixed by the G1.1 / G1.2 closures on main — reproduced verbatim
//   FROZEN-T08  apps/mobile/src/orientation-chrome/product-copy.ts on main (blob 17280234a4df) — verbatim
//   OPEN-VI01   voice / call wording VI-01 holds PROVISIONAL (reused from G1.2 R1 unchanged)
//   PO-APPROVED (G2.3)  the Product Owner's approved Matching messages for this proof — verbatim, never edited
//   PROOF COPY — OPEN   Matching words written for the proof — not final, not frozen (brief §6, §15)
//   PROOF       other words written for this proof — editable craft, not canonical
//   FIXTURE     stands in for runtime data the proof does not have
//
// Register (VI-01 §3.1): T1 chrome = neutral contemporary Arabic; T2 QANDEEL's own voice = restrained
// Egyptian. Fixed copy is gender-neutral toward the reader: masdar control labels, perfect verbs and -ك
// possessives (identical for both addressees in unvowelled script). No exclamation marks, no emoji.
// Numerals: Western in chrome in both languages (T-12 §9, `-u-nu-latn`); the world's own names keep the
// Eastern digits the frozen world copy carries (seam S-09).

const L = 'LOCKED-G1', T8 = 'FROZEN-T08', V = 'OPEN-VI01', P = 'PROOF', F = 'FIXTURE';
const PO = 'PO-APPROVED (G2.3)', OPEN = 'PROOF COPY — OPEN';
const s = (text, status, note) => (note ? { text, status, note } : { text, status });

export const COPY = {
  ar: {
    dir: 'rtl', lang: 'ar-EG',
    product: s('قنديل', 'VI-01 S01'),
    // ---- the shell (G1.1 / G1.2)
    back: s('المحادثة', L, 'G1.1 closure §1 — Analysis → Conversation'),
    backName: s('المحادثة — رجوع', P, 'accessible name; contains the visible label'),
    backNameCall: s('المحادثة — المكالمة مستمرة', P, 'G1.2 proof: opening Conversation does not end the call'),
    door: s('تحليل المحادثة', L, 'G1.1 closure §1 — Conversation → Analysis'),
    doorNameCall: s('تحليل المحادثة — المكالمة مستمرة', P),
    analysisRegion: s('تحليل المحادثة', L, 'accessible name of the Analysis region (R3 §C5)'),
    worldRegionHint: s('اسحب للتنقل في العالم، وقرّب أو بعّد بإصبعين أو بعجلة الفأرة.', P, 'accessible description of the world region'),
    nav: { label: s('العوالم', P, 'G1.1 R3 landmark name'),
      items: [{ key: 'mine', ...s('قنديل', 'G1.1 R3 proof label — MY_WORLD') }, { key: 'shared', ...s('العالم المشترك', L, 'G1.2 closure §3') }, { key: 'public', ...s('العالم العام', 'G1.1 R3 proof label — PUBLIC_WORLD') }] },
    // ---- Replay (G1.1 placement is LOCKED; the noun is proof)
    replay: s('إعادة عرض المحادثة', P, 'no canonical Arabic Replay noun (G1.1 closure §5)'),
    replayFull: s('المحادثة كاملة', P, 'G1.1 R3 proof entry'),
    replayPart: s('جزء من المحادثة', P, 'G1.1 R3 proof entry'),
    replayCallNote: s('المكالمة الصوتية غير مشمولة.', P, 'true of every Personal call, ongoing or finished (replay-runtime-v1 §7 L223)'),
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
    depth: { WORLD: 'العالم كله', THREAD: 'الخيوط', SESSION: 'المحادثة', ANALYTICAL_OBJECT: 'القراءات والنتائج', SOURCE_PROVENANCE: 'المصادر', status: T8 },
    inspectRenderable: (fam) => `قيد المعاينة: ${fam}.`,
    inspectWithheld: (fam, depth) => `قيد المعاينة: ${fam}. يبدأ الكشف من ${depth}.`,
    temporalLive: s('أنت عند آخر المحادثة.', T8),
    temporalPinned: (n) => `أنت عند اللحظة ${n}.`,
    previewLine: (n) => `نظرة مؤقتة على اللحظة ${n}، ولم يتغير موضعك.`,
    liveContinued: s('استمرت المحادثة بعد هذه اللحظة.', T8),
    // ---- the Timeline (T-06 has no Arabic; these are proof)
    timelineLabel: s('خط المحادثة', P, 'accessible name of the temporal instrument; T-06 ships only English placeholders'),
    timelineHint: s('اسحب أو استخدم الأسهم لنظرة مؤقتة على لحظة، ثم اترك أو اضغط Enter للذهاب إليها.', P),
    liveSlotFollowing: s('أنت عند آخر المحادثة', P, 'accessible name of the live end while following — the T-08 temporal sentence'),
    previewCancel: s('إلغاء النظرة', P, 'T-06 "Cancel preview" — no Arabic in canon'),
    previewCommit: (n) => `الذهاب إلى اللحظة ${n}`,
    fixtureBoundary: s('ما قبل اللحظة 14 خارج بيانات هذا البرهان.', P, 'review-only note, never inside the phone'),
    // ---- Live Call (G1.2 R1)
    call: s('مكالمة صوتية', V, 'V02'),
    connecting: s('جاري الاتصال', V),
    micOn: s('الميكروفون شغّال', V, 'ACCESSIBILITY-ONLY — never persistently visible (G1.2 closure §4)'),
    muted: s('الميكروفون مكتوم', V, 'ACCESSIBILITY-ONLY'),
    qSpeaking: s('قنديل بيتكلم', V, 'ACCESSIBILITY-ONLY'),
    mute: s('كتم الميكروفون', P), unmute: s('تشغيل الميكروفون', P), endCall: s('إنهاء المكالمة', P),
    route: s('السماعة الخارجية', P, 'G1.2 G12-J4 candidate'),
    voiceNote: s('رسالة صوتية', V), send: s('إرسال', 'masdar'),
    composerLabel: s('رسالتك لقنديل', 'VI-01 A10 PROPOSED'), composerPlaceholder: s('كلامك هنا', 'VI-01 A10 PROPOSED'),
    // ---- Matching. G2.3: the opening message (D1) and QANDEEL's view + privacy message (D2) are the Product Owner's
    //      approved copy, verbatim. Everything else Matching is PROOF COPY — OPEN (no Matching copy exists in canon).
    matchCue: s('قنديل شايف إن في شخص يستحق إنك تتعرف عليه. بناءً على فهمه لكل منكما، شايف إن بينكم مساحة تستحق إنكم تكتشفوها سوا.', PO, 'D1 — the opening message, verbatim; AWAITING_YOU'),
    matchCueAct: s('ليه؟', OPEN, 'the cue\'s ONE action label (G2.2 candidate, not frozen — brief §15)'),
    matchCueName: s('قنديل شايف إن في شخص يستحق إنك تتعرف عليه. بناءً على فهمه لكل منكما، شايف إن بينكم مساحة تستحق إنكم تكتشفوها سوا. ليه؟', P, 'accessible name = the approved message, then the act'),
    proposalRegion: s('اقتراح التعارف', OPEN, 'accessible name of the private proposal place'),
    propView: s('قنديل شايف إن بينكم نقاط اتفاق كثيرة، وفي نفس الوقت في اختلافات تستحق إنكم تفهموها بهدوء. لو قررتوا تبدأوا التعارف، قنديل هيكون معاكم يساعدكم تفهموا بعض، ويتكلم معاكم عن نقاط الاتفاق والاختلاف في الوقت المناسب.', PO, 'D2 — QANDEEL\'s view, verbatim. Replaces the G2.2 three-reason list; no trait, similarity or difference is named before the Introduction'),
    propPrivacy: s('خصوصيتك محفوظة. بياناتك وتحليلاتك الخاصة لن تُعرض على الطرف الآخر، ولن يُشارك منها شيء إلا ما تختار أنت مشاركته. وقنديل هيكون معك خطوة بخطوة لحد ما تكون مرتاح ومطمئن.', PO, 'D2 — the privacy message, verbatim'),
    propNextA: s('لو كمّلت، هيتعرض التعارف على الطرف التاني.', OPEN, 'FIRST_RECIPIENT: continuing approves forwarding (runtime §14, §21). G2.3 drops G2.2\'s second clause («ومش هيشوف عنك غير اللي سمحت بيه»): the approved privacy message now says it, and saying it twice reads as small print'),
    propNextB: s('لو كمّلت، هيتفتح لكم عالم مشترك للتعارف على طول.', OPEN, 'CANDIDATE: continuing IS the Mutual Match commit (I-07C §27) — the reader must know before pressing'),
    proceed: s('أكمّل', OPEN, 'interested in proceeding; first person, gender-neutral'),
    notNow: s('لأ، شكراً', OPEN, 'not interested; CLOSED_BY_YOU'),
    ack: s('وصل ردّك لقنديل، ولو جدّ جديد هيقولك.', OPEN, 'IN_PROGRESS, as the reader may see it: received; the rest stays private until a new truth exists'),
    unavailable: s('التعارف ده مبقاش متاح.', OPEN, 'NO_LONGER_AVAILABLE — one answer for every hidden cause (runtime §21, §31)'),
    endedAct: s('تمام', OPEN, 'dismisses the ended notice (first accepter only)'),
    arrivalLine: s('الطرفين وافقوا على التعارف', OPEN, 'MATCH_CONCLUDED for the first accepter: the new truth, not a replay of their own press'),
    arrivalAct: s('عالمكم المشترك', OPEN, 'names the place that already exists'),
    arrivalName: s('الطرفين وافقوا على التعارف. عالمكم المشترك', P),
    endedName: s('التعارف ده مبقاش متاح. تمام', P),
    // ---- Return / Orientation (approved compact direction): the affordance is named with T-08's own group name
    revealReturns: s('طرق العودة', T8, 'T-08 returnControlsLabel, verbatim; the Product Owner named it as the ONE affordance for secondary Return acts (G2.3 §4)'),
    proposalBack: s('تحليل المحادثة', P, 'the proposal is left the way it was entered'),
    // G2.2: no candidate name anywhere (runtime §22: the canonical first name is UNRESOLVED_NO_CANONICAL_SOURCE).
    // The born World is named by its kind, exactly as the rail names it.
    sharedTitle: s('العالم المشترك', L, 'G1.2 closure §3 — the rail label, reused as the destination\'s name'),
    phaseIntroduction: s('تعارف', OPEN, 'the INTRODUCTION phase, named plainly'),
    sharedToday: (t) => `اليوم ${t}`,
    welcome: s('أهلاً بيكم. أنا هنا معاكم في البداية، وكل واحد فيكم يقرر يشارك إيه وإمتى.', OPEN, 'QANDEEL may welcome the pair (L1280–1284); disclosure is each human\'s own grant'),
    birthRegion: s('العالم المشترك الجديد', P),
    // ---- people
    displayName: s('نور', F),
    speakerMe: s('كلامك', P), speakerQ: s('قنديل', P),
  },
  en: {
    dir: 'ltr', lang: 'en',
    product: s('Qandeel', 'VI-01 S01'),
    back: s('Conversation', L), backName: s('Conversation — back', P), backNameCall: s('Conversation — the call continues', P),
    door: s('Conversation analysis', 'G1.1 closure §2: English depth label open to the English copy pass'),
    doorNameCall: s('Conversation analysis — the call continues', P),
    analysisRegion: s('Conversation analysis', P),
    worldRegionHint: s('Drag to move through the world; pinch or use the wheel to come closer or step back.', P),
    nav: { label: s('Worlds', P), items: [{ key: 'mine', ...s('Qandeel', P) }, { key: 'shared', ...s('Shared World', L) }, { key: 'public', ...s('Public world', P) }] },
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
    depth: { WORLD: 'the whole world', THREAD: 'threads', SESSION: 'the conversation', ANALYTICAL_OBJECT: 'readings and findings', SOURCE_PROVENANCE: 'sources', status: T8 },
    inspectRenderable: (fam) => `You are inspecting ${fam}.`,
    inspectWithheld: (fam, depth) => `You are inspecting ${fam}. Go deeper to see it: it is disclosed with ${depth}.`,
    temporalLive: s('Following the conversation as it continues.', T8),
    temporalPinned: (n) => `Reading at moment ${n}.`,
    previewLine: (n) => `A temporary look at moment ${n}. Your position has not changed.`,
    liveContinued: s('The conversation has continued since this moment.', T8),
    timelineLabel: s('Conversation timeline', P), timelineHint: s('Drag or use the arrow keys for a temporary look at a moment; release or press Enter to go to it.', P),
    liveSlotFollowing: s('Following the conversation as it continues', P),
    previewCancel: s('Cancel the look', P), previewCommit: (n) => `Go to moment ${n}`,
    fixtureBoundary: s('Moments before 14 are outside this proof’s data.', P),
    call: s('Voice call', V), connecting: s('Connecting', V), micOn: s('Microphone on', V), muted: s('Microphone muted', V), qSpeaking: s('Qandeel is speaking', V),
    mute: s('Mute microphone', P), unmute: s('Turn microphone on', P), endCall: s('End call', P), route: s('Speaker', P),
    voiceNote: s('Voice message', V), send: s('Send', P), composerLabel: s('Your message to Qandeel', P), composerPlaceholder: s('Write here', P),
    // G2.3: the proof builds the Arabic page only, and its Matching copy exists only in Arabic. English Matching
    // glosses for the review boards are in GLOSS; the stale G2.1 English Matching strings (a fixture name among them)
    // are removed rather than left unused.
    proposalBack: s('Conversation analysis', P), phaseIntroduction: s('Introduction', P),
    welcome: s('Welcome, both of you. I’m here with you at the start, and each of you decides what to share and when.', P),
    birthRegion: s('The new Shared World', P),
    displayName: s('Nour', F), speakerMe: s('You', P), speakerQ: s('Qandeel', P),
  },
};

/** The G1.2 conversation (content.mjs `THREAD`, blob 67d70f234652), reused unchanged as the Conversation the Analysis belongs to. */
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
/** English glosses of the Arabic Matching strings — review chrome only (boards, docs); the prototype is Arabic. */
export const GLOSS = {
  matchCue: 'Qandeel sees that there is someone worth your getting to know. Based on its understanding of each of you, it sees between you a space worth discovering together.',
  matchCueAct: 'Why?',
  propView: 'Qandeel sees many points of agreement between you, and at the same time differences worth understanding calmly. If you decide to begin the introduction, Qandeel will be with you, helping you understand each other, and will talk with you about the points of agreement and difference at the right time.',
  propPrivacy: 'Your privacy is protected. Your private data and analyses will not be shown to the other side, and nothing of them will be shared except what you yourself choose to share. And Qandeel will be with you step by step until you feel comfortable and reassured.',
  propNextA: 'If you continue, the introduction will be offered to the other side.',
  propNextB: 'If you continue, a shared world for your introduction opens for you both, right away.',
  proceed: 'Continue', notNow: 'No, thanks',
  ack: 'Your answer reached Qandeel, and if something new happens, he will tell you.',
  unavailable: 'This introduction is no longer available.', endedAct: 'OK',
  arrivalLine: 'Both sides agreed to the introduction', arrivalAct: 'Your shared world',
  revealReturns: 'Ways back (T-08\'s own group name)',
  sharedTitle: 'Shared World', phaseIntroduction: 'Introduction',
  welcome: 'Welcome, both of you. I\'m here with you at the start, and each of you decides what to share and when.',
};
export const OPENER = { ar:'اهلا يا {display_name} ... انا في انتظارك ... يلا نبدأ', en: 'Hi {display_name} ... I\'m here waiting for you ... let\'s get started' };
export const DAYS = { ar: { today: 'اليوم', yesterday: 'أمس' }, en: { today: 'Today', yesterday: 'Yesterday' } };

/**
 * THE FIXTURE CONVERSATION'S HISTORY (seam S-18).
 *
 * The canonical built world is the analysis as known at Session Position 14 (K(SP14)). The three
 * Moments after it are committed spoken turns of the Live Call, and after each QANDEEL's analysis changes
 * by ONE canonical event, replayed through the world's own event channel with its own seed. The camera
 * each event fires at decides WHERE the canonical event lands (`emerge` picks the session nearest the
 * camera, `focus` the nearest unfocused session, `relation` a pair in view) — so it is part of the fixture.
 *   SP15  emerge    — new material in the current session (جلسة ١٢, the one the world marks «الآن»)
 *   SP16  focus     — the runtime-true focus singleton (Live Focus) moves to جلسة ١١
 *   SP17  relation  — QANDEEL connects two objects in view
 * `notice` is deliberately absent: a pass that leaves nothing is activity, and activity has no light.
 */
export const FIXTURE = {
  builtAt: 14, firstMoment: 1,
  history: [
    { sp: 15, kind: 'emerge', cam: { cx: 1165, cy: 712, field: 1518 } },
    { sp: 16, kind: 'focus', cam: { cx: 1370, cy: 590, field: 1518 } },
    { sp: 17, kind: 'relation', cam: { cx: 1250, cy: 690, field: 1100 } },
  ],
  // The families the proof may name (S-07, S-08): the focus singleton is the fixture's Live Focus, an
  // Emerging Focus («تركيز ناشئ»), which T-04 gives no locus — so RETURN_LIVE_FOCUS is never offered.
  focusFamily: 'EMERGING_FOCUS',
  kindFamily: { MOMENT: 'MOMENT', THREAD: 'THREAD', READING: 'READING', MEMO: 'MATERIAL', OPEN: 'QUESTION' },
};
