// P3-A — the fixed SYNTHETIC fixture set (task §22). No real user or private data; no Product Owner history. Names,
// Worlds and handles are invented for the proof. Times are device-local minutes from the fixture epoch (model.at()).
//
// Event fields: id · category · kind · cls (I-08N D10 Interruption Class 1–4) · context (the ONE originating context)
// · at · text{ar,en} (the Activity sentence, already inside the authenticated Product) · bounded{ar,en} (the L2 words:
// context, not content) · preview{ar,en} (the L3 words: part of the content) · attention (unseen | seen | opened) ·
// actionable · resolved · targetGone · expiresAt · thread · newContext · critical.
import { at, defaultSettings } from './model.mjs';

export const CONTEXTS = {
  personal: { ar: 'قنديل', en: 'Qandeel', glyph: 'navMine' },
  'w-summer': { ar: 'رحلة الصيف', en: 'Summer trip', glyph: 'navShared' },
  'w-work': { ar: 'فريق العمل', en: 'Work team', glyph: 'navShared' },
  public: { ar: 'العالم العام', en: 'Public World', glyph: 'navPublic' },
  intro: { ar: 'التعارف', en: 'Introductions', glyph: 'introMark' },
  account: { ar: 'الحساب', en: 'Account', glyph: 'settings' },
};
/** The glyph that names an item's SOURCE (P2 family, neutral ink — never Brass, which is the navigation machinery's). */
export const SOURCE_GLYPH = { qandeel: 'navMine', shared: 'navShared', public: 'navPublic', intro: 'introMark', system: 'settings' };

const t2 = (ar, en) => ({ ar, en });
export const NOW = at(3, '09:40');   // the moment every Activity capture is taken

// ------------------------------------------------------------------------------------------ the Activity feed
// All five categories, every attention state, one coalesced item, one actionable item, one stale item, one muted World.
export const FEED = [
  { id: 'F1', category: 'shared', kind: 'message', cls: 3, context: 'w-summer', at: at(3, '09:32'), attention: 'unseen', coalesced: 3,
    members: ['F1a', 'F1b', 'F1c'], text: t2('3 رسائل جديدة من سارة وكريم', '3 new messages from Sara and Karim') },
  { id: 'F2', category: 'qandeel', kind: 'proactive', cls: 3, context: 'personal', at: at(3, '08:05'), attention: 'unseen', thread: 'thu-presentation',
    text: t2('عرض الخميس الساعة 10:30. تحب نراجع الأرقام اللي كانت ناقصة قبلها؟', 'Your Thursday presentation is at 10:30. Want to go over the missing numbers before then?') },
  { id: 'F3', category: 'system', kind: 'security', cls: 1, critical: true, context: 'account', at: at(3, '06:40'), attention: 'unseen', actionable: true,
    text: t2('تسجيل دخول جديد من جهاز Pixel 8', 'New sign-in from a Pixel 8'),
    second: t2('إن لم يكن هذا أنت، فراجِع الأجهزة المتصلة.', 'If this wasn\'t you, review your signed-in devices.'), action: t2('مراجعة', 'Review') },
  { id: 'F4', category: 'public', kind: 'reply', cls: 3, context: 'public', at: at(2, '22:10'), attention: 'unseen',
    text: t2('ردّ جديد من @saharreads على منشورك', 'A new reply from @saharreads on your post') },
  { id: 'F5', category: 'intro', kind: 'proposal', cls: 3, context: 'intro', at: at(2, '19:30'), attention: 'seen', actionable: true,
    text: t2('فيه تعارف جديد في انتظارك', 'A new introduction is waiting for you') },
  { id: 'F6', category: 'public', kind: 'reaction', cls: 4, context: 'public', at: at(2, '18:00'), attention: 'seen', coalesced: 2,
    text: t2('تفاعلان جديدان على منشورك', '2 new reactions to your post') },
  { id: 'F7', category: 'shared', kind: 'governance', cls: 3, context: 'w-summer', at: at(2, '16:12'), attention: 'opened',
    text: t2('كريم غيّر مين يقدر يضيف أعضاء', 'Karim changed who can add members') },
  { id: 'F8', category: 'shared', kind: 'message', cls: 3, context: 'w-work', at: at(2, '11:00'), attention: 'seen', muted: true, coalesced: 4,
    text: t2('4 رسائل جديدة من مها', '4 new messages from Maha') },
  { id: 'F9', category: 'shared', kind: 'message', cls: 3, context: 'w-work', at: at(1, '17:45'), attention: 'seen', targetGone: true,
    text: t2('كريم شارك ملفًا', 'Karim shared a file') },
  { id: 'F10', category: 'qandeel', kind: 'reminder', cls: 2, context: 'personal', at: at(1, '16:00'), attention: 'opened',
    text: t2('زي ما طلبت: كلّم العيادة الساعة 4:00', 'As you asked: call the clinic at 4:00') },
  { id: 'F11', category: 'intro', kind: 'acceptance', cls: 2, context: 'intro', at: at(1, '12:20'), attention: 'opened', resolved: true,
    text: t2('قَبِل الطرفان التعارف', 'You both accepted the introduction') },
];
export const FEED_SETTINGS = (() => { const s = defaultSettings(); s.os = 'granted'; s.intro.entered = true; s.shared.muted = ['w-work']; return s; })();

// ------------------------------------------------------------------------- one event per required family
// (task §22) — each is used by a scenario below, a board, and at least one check.
//
// `reduceEligible` (Proactive only) is NOT a score: it is the fixture's explicit statement of what the already-run
// Proactive Gate found — whether this candidate is strong enough (value or timing) to keep interrupting under «أقل» /
// Reduce. `requested` (reminders) states that the user explicitly asked for this exact time.
export const EV = {
  proactive: { id: 'E-pro', category: 'qandeel', kind: 'proactive', cls: 3, context: 'personal', thread: 'thu-presentation', safeMax: 'L3', reduceEligible: false,
    text: F('F2'), bounded: t2('بخصوص عرض الخميس', 'About Thursday\'s presentation'), preview: t2('عرض الخميس الساعة 10:30. تحب نراجع الأرقام؟', 'Thursday\'s presentation is at 10:30. Want to go over the numbers?') },
  proTimely: { id: 'E-pro-t', category: 'qandeel', kind: 'proactive', cls: 2, context: 'personal', thread: 'thu-leave', safeMax: 'L3', reduceEligible: true,
    text: t2('عرضك بعد ساعة، والطريق زحمة. لو هتتحرك، ده وقت كويس.', 'Your presentation is in an hour and traffic is heavy. If you\'re heading out, now is a good time.'),
    bounded: t2('بخصوص عرض النهارده', 'About today\'s presentation'), preview: t2('عرضك بعد ساعة، والطريق زحمة.', 'Your presentation is in an hour and traffic is heavy.') },
  proTimelyWeak: { id: 'E-pro-w', category: 'qandeel', kind: 'proactive', cls: 2, context: 'personal', thread: 'cafe', safeMax: 'L3', reduceEligible: false,
    text: t2('القهوة اللي كنت بتدور عليها رجعت في المحل اللي جنبك.', 'The coffee you were looking for is back at the shop near you.'),
    bounded: t2('حاجة كنت بتدور عليها', 'Something you were looking for'), preview: t2('القهوة رجعت في المحل اللي جنبك.', 'The coffee is back at the shop near you.') },
  proHighValue: { id: 'E-pro-h', category: 'qandeel', kind: 'proactive', cls: 3, context: 'personal', thread: 'results', safeMax: 'L2', reduceEligible: true,
    text: t2('قلت لي إن نتيجة التحليل هتطلع النهارده. لو حابب نتكلم فيها، أنا هنا.', 'You told me the test results come out today. If you\'d like to talk them through, I\'m here.'),
    bounded: t2('بخصوص حاجة قلتها لي', 'About something you told me'), preview: t2('نتيجة التحليل هتطلع النهارده.', 'The test results come out today.') },
  proAmbient: { id: 'E-pro-a', category: 'qandeel', kind: 'proactive', cls: 4, context: 'personal', thread: 'reading', safeMax: 'L3', reduceEligible: true,
    text: t2('لقيت مقال عن القراءة البطيئة ممكن يعجبك.', 'I found an article about slow reading you might like.'),
    bounded: t2('حاجة ممكن تعجبك', 'Something you might like'), preview: t2('مقال عن القراءة البطيئة', 'An article about slow reading') },
  sharedReply: { id: 'E-reply', category: 'shared', kind: 'reply', cls: 3, context: 'w-summer', ctx: true, safeMax: 'L3',
    text: t2('سارة ردّت عليك', 'Sara replied to you'), bounded: t2('سارة ردّت عليك', 'Sara replied to you'), preview: t2('سارة: تمام، هحجز التذاكر النهارده', 'Sara: Great, I\'ll book the tickets today') },
  sharedGov: { id: 'E-gov', category: 'shared', kind: 'governance', cls: 3, context: 'w-summer', ctx: true, safeMax: 'L2',
    text: F('F7'), bounded: t2('تغيير في صلاحيات الأعضاء', 'A change to member permissions'), preview: t2('كريم غيّر مين يقدر يضيف أعضاء', 'Karim changed who can add members') },
  publicReply: { id: 'E-preply', category: 'public', kind: 'reply', cls: 3, context: 'public', safeMax: 'L3',
    text: F('F4'), bounded: t2('ردّ جديد على منشورك', 'A new reply on your post'), preview: t2('@saharreads: فكرة جميلة، جربتها امبارح', '@saharreads: Lovely idea, I tried it yesterday') },
  publicReaction: { id: 'E-react', category: 'public', kind: 'reaction', cls: 4, context: 'public',
    text: t2('تفاعل جديد على منشورك', 'A new reaction to your post'), bounded: t2('تفاعل جديد على منشورك', 'A new reaction to your post'), preview: t2('تفاعل جديد على منشورك', 'A new reaction to your post') },
  discovery: { id: 'E-disc', category: 'public', kind: 'discovery', cls: 4, context: 'public', safeMax: 'L2',
    text: t2('نقاش جديد عن القراءة البطيئة قد يهمك', 'A new discussion about slow reading you might like'), bounded: t2('نقاش جديد قد يهمك', 'A new discussion you might like'), preview: t2('نقاش عن القراءة البطيئة', 'A discussion about slow reading') },
  // Introductions: default L0 (D15) and NO category cap. `safeMax` below is EVENT-specific: a pending proposal carries
  // no content beyond its bounded context — nothing about the other person may be shown before both accept (G2.3) — so
  // its own safe projection stops at L2. The acceptance has a bounded L3 preview (still no names).
  introProposal: { id: 'E-intro', category: 'intro', kind: 'proposal', cls: 3, context: 'intro', safeMax: 'L2',
    text: F('F5'), bounded: t2('فيه تعارف جديد في انتظارك', 'A new introduction is waiting for you'), preview: t2('فيه تعارف جديد في انتظارك', 'A new introduction is waiting for you') },
  introAccept: { id: 'E-accept', category: 'intro', kind: 'acceptance', cls: 2, context: 'intro',
    text: F('F11'), bounded: t2('قَبِل الطرفان التعارف', 'You both accepted the introduction'), preview: t2('قَبِل الطرفان التعارف. افتح التعارف لتكمل.', 'You both accepted the introduction. Open Introductions to continue.') },
  security: { id: 'E-sec', category: 'system', kind: 'security', cls: 1, critical: true, context: 'account', safeMax: 'L2',
    short: t2('تسجيل دخول جديد', 'New sign-in'),
    text: F('F3'), bounded: t2('تسجيل دخول جديد على حسابك', 'A new sign-in to your account'), preview: t2('تسجيل دخول جديد من جهاز Pixel 8 في القاهرة', 'New sign-in from a Pixel 8 in Cairo') },
  reminder: { id: 'E-rem', category: 'qandeel', kind: 'reminder', cls: 2, context: 'personal', safeMax: 'L3', requested: true,
    short: t2('كلّم العيادة، 4:00', 'Call the clinic, 4:00'),
    text: F('F10'), bounded: t2('تذكير طلبته للساعة 4:00', 'A reminder you set for 4:00'), preview: t2('كلّم العيادة الساعة 4:00', 'Call the clinic at 4:00') },
  staleShared: { id: 'E-stale', category: 'shared', kind: 'message', cls: 3, context: 'w-work', targetGone: true,
    text: F('F9'), bounded: t2('ملف جديد', 'A new file'), preview: t2('كريم شارك ملفًا', 'Karim shared a file') },
  mutedShared: { id: 'E-muted', category: 'shared', kind: 'message', cls: 3, context: 'w-work',
    text: t2('مها كتبت رسالة جديدة', 'Maha wrote a new message'), bounded: t2('رسالة جديدة', 'A new message'), preview: t2('مها: الاجتماع اتأجل', 'Maha: The meeting moved') },
};
function F(id) { return { ...FEED.find((x) => x.id === id).text }; }
for (const e of Object.values(EV)) { e.ctxName = CONTEXTS[e.context] && (e.category === 'shared' || e.category === 'public') ? { ar: CONTEXTS[e.context].ar, en: CONTEXTS[e.context].en } : null; }

// --------------------------------------------------------------------------- foreground / background scenarios
// Each names where the user is, what arrives, and what the Product must do (the expected surface is asserted by checks).
export const SCENARIOS = [
  { id: 'S1', name: 'same-context foreground', app: 'foreground', here: 'w-summer', ev: 'sharedReply', expect: 'in-place' },
  { id: 'S2', name: 'different-context foreground (Shared)', app: 'foreground', here: 'personal', ev: 'sharedReply', expect: 'strip' },
  { id: 'S3', name: 'different-context foreground (QANDEEL)', app: 'foreground', here: 'w-summer', ev: 'proactive', expect: 'strip' },
  { id: 'S4', name: 'different-context foreground (System)', app: 'foreground', here: 'personal', ev: 'security', expect: 'strip' },
  { id: 'S5', name: 'background, permission granted', app: 'background', ev: 'sharedReply', expect: 'push' },
  { id: 'S6', name: 'background, OS permission denied', app: 'background', ev: 'sharedReply', os: 'denied', expect: 'activity' },
  { id: 'S7', name: 'active Live Call (Shared reply)', app: 'foreground', here: 'personal', liveCall: true, ev: 'sharedReply', expect: 'deferred' },
  { id: 'S8', name: 'active Live Call (Introduction proposal)', app: 'foreground', here: 'personal', liveCall: true, ev: 'introProposal', expect: 'deferred' },
  { id: 'S9', name: 'muted Shared World', app: 'foreground', here: 'personal', ev: 'mutedShared', muted: ['w-work'], expect: 'activity' },
  { id: 'S10', name: 'ambient Public reaction', app: 'background', ev: 'publicReaction', expect: 'activity' },
  { id: 'S11', name: 'Introductions not entered', app: 'background', ev: 'introProposal', introEntered: false, expect: 'suppressed' },
  { id: 'S12', name: 'Public Discovery not opted in', app: 'background', ev: 'discovery', expect: 'suppressed' },
  { id: 'S13', name: 'stale Shared target', app: 'background', ev: 'staleShared', expect: 'stale' },
  { id: 'S14', name: 'Proactive QANDEEL off', app: 'background', ev: 'proactive', proactive: 'off', expect: 'next-conversation' },
  { id: 'S15', name: 'critical security, OS denied', app: 'background', ev: 'security', os: 'denied', expect: 'activity' },
  // ---- refinement §8: active Live Call — ordinary attention waits; only the two call-safe cases show a call-safe strip
  { id: 'S16', name: 'active Live Call (normal Proactive QANDEEL)', app: 'foreground', here: 'personal', liveCall: true, ev: 'proactive', expect: 'deferred' },
  { id: 'S17', name: 'active Live Call (critical security)', app: 'foreground', here: 'personal', liveCall: true, ev: 'security', expect: 'call-strip' },
  { id: 'S18', name: 'active Live Call (requested exact-time reminder)', app: 'foreground', here: 'personal', liveCall: true, ev: 'reminder', expect: 'call-strip' },
  { id: 'S19', name: 'Live Call continuing in the background (Shared reply)', app: 'background', liveCall: true, ev: 'sharedReply', expect: 'deferred' },
  { id: 'S20', name: 'Live Call continuing in the background (critical security)', app: 'background', liveCall: true, ev: 'security', expect: 'push', expectLevel: 'L2' },
  // ---- refinement §7: «أقل» / Reduce tightens the Proactive Gate; it is not a class rule
  { id: 'S21', name: 'Reduce — Class 2, Gate: strong enough', app: 'background', proactive: 'reduce', ev: 'proTimely', expect: 'push' },
  { id: 'S22', name: 'Reduce — Class 2, Gate: not strong enough', app: 'background', proactive: 'reduce', ev: 'proTimelyWeak', expect: 'next-conversation' },
  { id: 'S23', name: 'Reduce — ordinary Class 3', app: 'background', proactive: 'reduce', ev: 'proactive', expect: 'next-conversation' },
  { id: 'S24', name: 'Reduce — high-value Class 3, Gate: strong enough', app: 'background', proactive: 'reduce', ev: 'proHighValue', expect: 'push', expectLevel: 'L1' },
  { id: 'S25', name: 'Reduce — Class 4 (ambient)', app: 'background', proactive: 'reduce', ev: 'proAmbient', expect: 'activity' },
  { id: 'S26', name: 'Reduce — strong enough, but inside Quiet Hours', app: 'background', proactive: 'reduce', ev: 'proHighValue', now: at(3, '02:00'), expect: 'deferred' },
  { id: 'S27', name: 'Reduce — strong enough, but the Proactive 1 / 24 h ceiling is used', app: 'background', proactive: 'reduce', ev: 'proHighValue', hist: [{ at: at(3, '10:00'), kind: 'proactive', thread: 'thu-leave', engaged: false }], expect: 'next-conversation' },
  // ---- refinement §5: Introductions — default L0, the user may raise the ceiling, the event's own projection may render less
  { id: 'S28', name: 'Introductions — default ceiling (proposal)', app: 'background', ev: 'introProposal', expect: 'push', expectLevel: 'L0' },
  { id: 'S29', name: 'Introductions — ceiling raised to «إظهار المعاينة» (proposal: its own projection stops at L2)', app: 'background', ev: 'introProposal', lock: { intro: 'L3' }, expect: 'push', expectLevel: 'L2' },
  { id: 'S30', name: 'Introductions — ceiling raised to «إظهار المعاينة» (acceptance: renders L3)', app: 'background', ev: 'introAccept', lock: { intro: 'L3' }, expect: 'push', expectLevel: 'L3' },
  { id: 'S31', name: 'Introductions — ceiling raised to «إظهار النوع»', app: 'background', ev: 'introAccept', lock: { intro: 'L1' }, expect: 'push', expectLevel: 'L1' },
  // ---- final micro-refinement §5–§6: the Analysis is not an attention surface. The user is inside the Analysis of the
  // Personal conversation (its originating context is 'personal'); `view` is proof context, not a production schema.
  { id: 'S32', name: 'Analysis, no call — ordinary Shared reply', app: 'foreground', view: 'analysis', here: 'personal', ev: 'sharedReply', expect: 'deferred' },
  { id: 'S33', name: 'Analysis, no call — ordinary Public reply', app: 'foreground', view: 'analysis', here: 'personal', ev: 'publicReply', expect: 'deferred' },
  { id: 'S34', name: 'Analysis, no call — Introduction proposal', app: 'foreground', view: 'analysis', here: 'personal', ev: 'introProposal', expect: 'deferred' },
  { id: 'S35', name: 'Analysis, no call — Proactive QANDEEL', app: 'foreground', view: 'analysis', here: 'personal', ev: 'proactive', expect: 'deferred' },
  { id: 'S36', name: 'Analysis, no call — critical security (no new exception outside a call)', app: 'foreground', view: 'analysis', here: 'personal', ev: 'security', expect: 'deferred' },
  { id: 'S37', name: 'Analysis, active Live Call — critical security', app: 'foreground', view: 'analysis', here: 'personal', liveCall: true, ev: 'security', expect: 'call-strip' },
  { id: 'S38', name: 'Analysis, active Live Call — requested exact-time reminder', app: 'foreground', view: 'analysis', here: 'personal', liveCall: true, ev: 'reminder', expect: 'call-strip' },
  { id: 'S39', name: 'Analysis, active Live Call — ordinary Shared reply', app: 'foreground', view: 'analysis', here: 'personal', liveCall: true, ev: 'sharedReply', expect: 'deferred' },
];
export function scenarioCtx(sc, now = at(3, '14:00')) {
  const s = defaultSettings(); s.os = sc.os ?? 'granted'; s.intro.entered = sc.introEntered ?? true;
  if (sc.muted) s.shared.muted = sc.muted; if (sc.proactive) s.proactive = sc.proactive;
  if (sc.lock) Object.assign(s.lock, sc.lock);
  return { settings: s, hist: sc.hist ? sc.hist.map((h) => ({ ...h })) : [], app: sc.app, here: sc.here ?? null, liveCall: !!sc.liveCall, view: sc.view ?? null, now: sc.now ?? now };
}

// ------------------------------------------------------------------ leaving the Analysis: re-evaluate, never replay
// (final micro-refinement §7) What was deferred while the user was inside the Analysis, and where the user goes next.
// Each case states its expected outcome independently of the model; `exitTo` is the context the user is in after leaving.
const ax = (base, hm, extra = {}) => ({ ...EV[base], at: at(3, hm), ...extra });
export const ANALYSIS_EXIT = [
  { id: 'X1', name: 'one Shared reply deferred in the Analysis → exit to the Conversation: re-evaluated, one strip',
    pending: [ax('sharedReply', '09:41')], exitTo: { view: 'conversation', here: 'personal' }, expect: { strip: 'E-reply', surfaces: { 'E-reply': 'strip' } } },
  { id: 'X2', name: 'four deferred (Shared, Public, Introductions, Proactive) → exit: ONE strip (the longest-waiting of the equal-class candidates), never a dump; the rest stay in Activity, and the Proactive note lands in its own Conversation',
    pending: [ax('sharedReply', '09:41'), ax('publicReply', '09:42'), ax('introProposal', '09:43'), ax('proactive', '09:44')], exitTo: { view: 'conversation', here: 'personal' },
    expect: { strip: 'E-reply', surfaces: { 'E-reply': 'strip', 'E-preply': 'activity', 'E-intro': 'activity', 'E-pro': 'in-place' } } },
  { id: 'X3', name: 'deferred, then the World is muted, the target disappears, and the Proactive note belongs to the Conversation the user returns to → exit: NO strip',
    pending: [ax('sharedReply', '09:41'), ax('staleShared', '09:42'), ax('proactive', '09:43')], exitTo: { view: 'conversation', here: 'personal' }, muted: ['w-summer'],
    expect: { strip: null, surfaces: { 'E-reply': 'activity', 'E-stale': 'stale', 'E-pro': 'in-place' } } },
  { id: 'X4', name: 'the user leaves the Analysis for the Conversation while the Live Call continues → ordinary attention still waits (no strip)',
    pending: [ax('sharedReply', '09:41')], exitTo: { view: 'conversation', here: 'personal', liveCall: true }, expect: { strip: null, surfaces: { 'E-reply': 'deferred' } } },
];
export function exitCtx(x, now = at(3, '09:50')) {
  const s = defaultSettings(); s.os = 'granted'; s.intro.entered = true; if (x.muted) s.shared.muted = x.muted;
  return { settings: s, hist: [], app: 'foreground', here: x.exitTo.here, view: x.exitTo.view, liveCall: !!x.exitTo.liveCall, now };
}

// ------------------------------------------------------------------------------ the Quiet Hours overnight cluster
// Five candidates arrive between 23:00 and 08:00 (night of day 2 → 3). Morning must NOT produce five Pushes.
export const OVERNIGHT = [
  { ...EV.sharedReply, id: 'Q1', at: at(2, '23:40') },
  { ...EV.publicReaction, id: 'Q2', at: at(3, '00:55') },
  { id: 'Q3', category: 'shared', kind: 'poll', cls: 2, context: 'w-summer', at: at(3, '02:10'), expiresAt: at(3, '07:00'), safeMax: 'L2',
    ctxName: { ...CONTEXTS['w-summer'] }, text: t2('التصويت على ميعاد السفر بيقفل الساعة 7:00', 'The vote on the travel date closes at 7:00'),
    bounded: t2('تصويت يقفل الساعة 7:00', 'A vote closing at 7:00'), preview: t2('التصويت على ميعاد السفر بيقفل الساعة 7:00', 'The vote on the travel date closes at 7:00') },
  { ...EV.proactive, id: 'Q4', at: at(3, '03:30'), usefulAtEnd: true },     // the Gate says: still useful at 08:00 (the presentation is at 10:30)
  { ...EV.security, id: 'Q5', at: at(3, '06:40') },
];
export const OVERNIGHT_SETTINGS = (() => { const s = defaultSettings(); s.os = 'granted'; s.intro.entered = true; return s; })();

// ------------------------------------------------------------------------------------ the seven-day ceiling trace
// Opt-in Public Discovery; permission granted; Introductions entered. Every event is a CANDIDATE — the model decides.
const tr = (id, d, hm, base, extra = {}) => ({ ...EV[base], id, at: at(d, hm), ...extra });
export const WEEK = [
  tr('W01', 1, '09:00', 'sharedReply'),
  tr('W02', 1, '11:30', 'publicReply'),
  tr('W03', 1, '13:00', 'proactive', { thread: 'A' }),
  tr('W04', 1, '15:00', 'sharedGov'),
  tr('W05', 1, '17:30', 'sharedReply'),                                   // 5th ordinary in 24 h → refused
  tr('W06', 1, '20:00', 'reminder'),                                      // exact reminder → outside the ceiling
  tr('W07', 2, '12:00', 'sharedReply'),
  tr('W08', 2, '10:00', 'proactive', { thread: 'B' }),                    // 2nd proactive inside 24 h → refused
  tr('W09', 2, '14:30', 'proactive', { thread: 'A' }),                    // same thread, no engagement, 25.5 h → refused
  tr('W10', 3, '13:30', 'proactive', { thread: 'A' }),                    // same thread after 48.5 h → allowed (2nd on A)
  tr('W11', 4, '10:00', 'discovery'),                                     // Public Discovery, opted in → 1 / 7 d
  tr('W12', 4, '16:00', 'publicReply'),
  tr('W13', 5, '09:00', 'sharedReply'),
  tr('W14', 5, '10:00', 'discovery'),                                     // 2nd Discovery in 7 d → suppressed
  tr('W15', 5, '12:00', 'introProposal'),
  tr('W16', 5, '15:00', 'sharedGov'),
  tr('W17', 5, '16:30', 'proactive', { thread: 'A' }),                    // 3rd on A with no new context → refused
  tr('W18', 6, '09:00', 'proactive', { thread: 'A', newContext: true }),  // 3rd on A WITH new context → allowed
  tr('W19', 6, '12:00', 'publicReply'),                                   // 13th ordinary in 7 d → refused
  tr('W20', 6, '20:00', 'security'),                                      // critical security → outside the ceiling
];
export const WEEK_SETTINGS = (() => { const s = defaultSettings(); s.os = 'granted'; s.intro.entered = true; s.public.discovery = true; return s; })();
/** Expected outcomes, stated independently of the model so the checks compare two sources. */
export const WEEK_EXPECT = { W01: 'push', W02: 'push', W03: 'push', W04: 'push', W05: 'activity', W06: 'push', W07: 'push', W08: 'next-conversation',
  W09: 'next-conversation', W10: 'push', W11: 'push', W12: 'push', W13: 'push', W14: 'suppressed', W15: 'push', W16: 'push',
  W17: 'next-conversation', W18: 'push', W19: 'activity', W20: 'push' };
