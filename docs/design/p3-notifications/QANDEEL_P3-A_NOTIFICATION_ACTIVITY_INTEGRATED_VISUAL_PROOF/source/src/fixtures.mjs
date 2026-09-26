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
export const EV = {
  proactive: { id: 'E-pro', category: 'qandeel', kind: 'proactive', cls: 3, context: 'personal', thread: 'thu-presentation', safeMax: 'L3',
    text: F('F2'), bounded: t2('بخصوص عرض الخميس', 'About Thursday\'s presentation'), preview: t2('عرض الخميس الساعة 10:30. تحب نراجع الأرقام؟', 'Thursday\'s presentation is at 10:30. Want to go over the numbers?') },
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
  introProposal: { id: 'E-intro', category: 'intro', kind: 'proposal', cls: 3, context: 'intro', safeMax: 'L1',
    text: F('F5'), bounded: t2('فيه تعارف جديد في انتظارك', 'A new introduction is waiting for you'), preview: t2('فيه تعارف جديد في انتظارك', 'A new introduction is waiting for you') },
  introAccept: { id: 'E-accept', category: 'intro', kind: 'acceptance', cls: 2, context: 'intro', safeMax: 'L1',
    text: F('F11'), bounded: t2('قَبِل الطرفان التعارف', 'You both accepted the introduction'), preview: t2('قَبِل الطرفان التعارف', 'You both accepted the introduction') },
  security: { id: 'E-sec', category: 'system', kind: 'security', cls: 1, critical: true, context: 'account', safeMax: 'L2',
    text: F('F3'), bounded: t2('تسجيل دخول جديد على حسابك', 'A new sign-in to your account'), preview: t2('تسجيل دخول جديد من جهاز Pixel 8 في القاهرة', 'New sign-in from a Pixel 8 in Cairo') },
  reminder: { id: 'E-rem', category: 'qandeel', kind: 'reminder', cls: 2, context: 'personal', safeMax: 'L3',
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
];
export function scenarioCtx(sc, now = at(3, '14:00')) {
  const s = defaultSettings(); s.os = sc.os ?? 'granted'; s.intro.entered = sc.introEntered ?? true;
  if (sc.muted) s.shared.muted = sc.muted; if (sc.proactive) s.proactive = sc.proactive;
  return { settings: s, hist: [], app: sc.app, here: sc.here ?? null, liveCall: !!sc.liveCall, now };
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
