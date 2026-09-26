// P3-A — the deterministic PRODUCT-BEHAVIOUR MODEL of the proof.
//
// This is not a runtime and not a state machine for production. It is the proof's single statement of what the frozen
// I-08N-01 contract and the Product Owner's accepted P3 direction (task §5–§15) require, written as pure functions over
// synthetic fixtures, so the prototype, the boards and the checks all read ONE answer and none of them can drift.
//
// Frozen authority it encodes (never redefines): I-08N-01 D06 (Quiet Hours + its two exceptions), D07/D08 (ceiling, not
// quota; one global budget + category sub-budgets), D09 (coalescing never across Worlds / authorities), D10 (classes),
// D12 (surfaces), D14–D17 (disclosure levels, default matrix, ceiling), D26 (Introductions need entered capability),
// D31/D40/D47 (seen ≠ resolved), D34 (per-World mute), D35 (Proactive off ≠ understanding off), D36 (critical ≠ OS
// bypass), D38/D39 (tap revalidates; no guessed destination), D50 (OS permission is a hard Push boundary), D51
// (foreground suppression), D59 (no delivery past semantic expiry); G3 §D (Matching never interrupts an active Live
// Call), the P3-A refinement §8 (ordinary attention waits during a call; only critical security and a requested
// exact-time reminder may show a call-safe strip), and the final micro-refinement §5–§7 (no ordinary attention is ever
// presented transiently inside the Analysis; it is re-evaluated when the user leaves, and at most one strip follows).
//
// Product Owner numbers it encodes (task §13–§14, "v1 safety ceilings — ceilings, never quotas"): ordinary Push
// 4 / rolling 24 h and 12 / rolling 7 d; Proactive QANDEEL 1 / 24 h and 3 / 7 d; same proactive thread ≥ 48 h after no
// engagement; a third same-subject interruption needs new meaningful context; Public Discovery 1 / 7 d, opt-in; Quiet
// Hours 23:00 → 08:00 device-local, ON by default.
//
// Everything else here is PROOF INTERPRETATION and is marked so where it is decided (search "PROOF INTERPRETATION").

export const MIN = 1, HOUR = 60, DAY = 24 * 60;
/** Minutes since the fixture epoch (day 1, 00:00 device-local). `at(1,'09:30')`. */
export const at = (day, hhmm) => { const [h, m] = hhmm.split(':').map(Number); return (day - 1) * DAY + h * HOUR + m; };
export const clock = (t) => { const m = ((t % DAY) + DAY) % DAY; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const dayOf = (t) => Math.floor(t / DAY) + 1;

// ------------------------------------------------------------------------------------------------ categories
/** The five semantic categories (I-08N-01 D08, D28, D30, D33). Activity keeps each item's category; never a World. */
export const CATEGORIES = ['qandeel', 'shared', 'public', 'intro', 'system'];
/** Speaker identity (D18): only QANDEEL-initiated communication speaks as QANDEEL; everything else is Product voice. */
export const SPEAKER = { qandeel: 'QANDEEL_VOICE', shared: 'PRODUCT_VOICE', public: 'PRODUCT_VOICE', intro: 'PRODUCT_VOICE', system: 'PRODUCT_VOICE' };

/** Disclosure levels (D14). Ordered. The user-facing words live in content.mjs; the codes are never shown. */
export const LEVELS = ['L0', 'L1', 'L2', 'L3'];
const lvl = (l) => LEVELS.indexOf(l);
export const minLevel = (a, b) => (lvl(a) <= lvl(b) ? a : b);

/** D15 — the default disclosure matrix, verbatim. The key is the disclosure SUBJECT (a category, or a named case). */
export const DISCLOSURE_DEFAULTS = Object.freeze({
  qandeel: 'L1',      // Personal / Proactive QANDEEL
  shared: 'L2',       // Shared Worlds
  public: 'L2',       // Public interactions
  discovery: 'L1',    // Public discovery
  intro: 'L0',        // Introductions — and "must not even reveal that the event relates to Introductions"
  reminder: 'L2',     // user-requested reminders
  system: 'L2',       // System / account — minimum needed
  security: 'L2',     // Critical security — L2 even when Critical
});
/** Which disclosure subject an event belongs to. */
export const subjectOf = (e) => (e.kind === 'reminder' ? 'reminder' : e.kind === 'discovery' ? 'discovery' : e.kind === 'security' ? 'security' : e.category);

/** The Product Owner's v1 hard safety ceilings (task §14). Ceilings, never quotas: nothing reads them to CREATE a send. */
export const CEILINGS = Object.freeze({
  ordinary: { per24h: 4, per7d: 12 },
  proactive: { per24h: 1, per7d: 3, sameThreadHours: 48, thirdNeedsNewContext: true },
  discovery: { per7d: 1, optIn: true },
});
export const QUIET_DEFAULT = Object.freeze({ on: true, from: '23:00', to: '08:00' });
export const SNOOZE_OPTIONS = ['1h', '8h', '24h', 'custom'];
export const PROACTIVE_OPTIONS = ['allow', 'reduce', 'off'];

/** A new user's settings (task §12–§13; D15 defaults as the lock-screen ceilings; Public Discovery opt-in = off). */
export function defaultSettings() {
  return {
    os: 'not-requested',                 // 'not-requested' | 'granted' | 'denied' — the platform owns this
    proactive: 'allow',
    shared: { on: true, muted: [] },     // per-World mute list (D34)
    public: { interactions: true, discovery: false },
    intro: { entered: false, on: true }, // controls exist only after the capability is legitimately entered (D26)
    system: { other: true },             // critical security/account is not an in-app switch (D36)
    quiet: { ...QUIET_DEFAULT },
    snoozeUntil: null,
    lock: { ...DISCLOSURE_DEFAULTS },    // the user's ceiling per subject (D16/D17); starts at the D15 defaults
  };
}

// --------------------------------------------------------------------------------------------- quiet hours
const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
/** Is device-local minute `t` inside Quiet Hours? The window may cross midnight (23:00 → 08:00). */
export function inQuiet(t, quiet) {
  if (!quiet || !quiet.on) return false;
  const m = ((t % DAY) + DAY) % DAY, a = hm(quiet.from), b = hm(quiet.to);
  return a <= b ? m >= a && m < b : m >= a || m < b;
}
/** The next minute at which Quiet Hours end, from `t` (for deferral). */
export function quietEnd(t, quiet) {
  const b = hm(quiet.to), m = ((t % DAY) + DAY) % DAY, base = t - m;
  return m < b ? base + b : base + DAY + b;
}
/** The two exceptions D06 / D37 name — and nothing else. */
export const isQuietException = (e) => e.kind === 'reminder' || (e.kind === 'security' && e.critical === true);
/**
 * The ONLY two things that may be presented during an active Live Call (P3-A refinement §8), as a small non-blocking
 * call-safe strip: a genuinely critical security / account event, and an exact-time reminder the user explicitly asked
 * for (kind 'reminder' is, by the fixture contract, a user-requested exact-time reminder). Everything else waits.
 */
export const isCallSafe = (e) => (e.kind === 'security' && e.critical === true) || (e.kind === 'reminder' && e.requested === true);

// ----------------------------------------------------------------------------------------------- budgets
/** Is this event competing in the ORDINARY interrupting budget? The two exceptions sit outside it (D08). */
export const isOrdinary = (e) => !isQuietException(e);
const within = (hist, t, span, pred) => hist.filter((h) => h.at > t - span && h.at <= t && pred(h)).length;

/**
 * Proactive-thread rule (task §14 P3-O; I-08N D05 / D57): after a proactive Push on a thread with NO engagement,
 * the same thread may not re-interrupt before 48 h; a THIRD interruption on the same subject requires new meaningful
 * context (and the Gate re-run, which the fixture states as `gate`).
 */
export function proactiveThreadVerdict(e, hist) {
  const prior = hist.filter((h) => h.kind === 'proactive' && h.thread === e.thread).sort((a, b) => a.at - b.at);
  if (!prior.length) return { ok: true };
  const last = prior[prior.length - 1];
  if (!last.engaged && e.at - last.at < CEILINGS.proactive.sameThreadHours * HOUR) return { ok: false, reason: 'same-thread-48h' };
  if (prior.length >= 2 && !e.newContext) return { ok: false, reason: 'third-needs-new-context' };
  return { ok: true };
}

/** Budget verdict for a Push candidate at time e.at against the Push history (only pushes are recorded). */
export function budgetVerdict(e, hist) {
  if (!isOrdinary(e)) return { ok: true, outside: true };
  const ord = (h) => isOrdinary(h);
  if (within(hist, e.at, DAY, ord) >= CEILINGS.ordinary.per24h) return { ok: false, reason: 'ordinary-24h' };
  if (within(hist, e.at, 7 * DAY, ord) >= CEILINGS.ordinary.per7d) return { ok: false, reason: 'ordinary-7d' };
  if (e.kind === 'proactive') {
    const pro = (h) => h.kind === 'proactive';
    if (within(hist, e.at, DAY, pro) >= CEILINGS.proactive.per24h) return { ok: false, reason: 'proactive-24h' };
    if (within(hist, e.at, 7 * DAY, pro) >= CEILINGS.proactive.per7d) return { ok: false, reason: 'proactive-7d' };
    const th = proactiveThreadVerdict(e, hist);
    if (!th.ok) return th;
  }
  if (e.kind === 'discovery' && within(hist, e.at, 7 * DAY, (h) => h.kind === 'discovery') >= CEILINGS.discovery.per7d) return { ok: false, reason: 'discovery-7d' };
  return { ok: true };
}

// ------------------------------------------------------------------------------------------- the decision
/**
 * Where does one candidate go right now? Returns { surface, level, reasons[], mark }.
 *   surface ∈ 'push' | 'strip' | 'call-strip' | 'in-place' | 'activity' | 'next-conversation' | 'deferred' | 'suppressed' | 'stale'
 *   ('call-strip' = the small, non-blocking call-safe strip; only isCallSafe() events, only during an active Live Call)
 * `ctx` = { settings, hist (earlier pushes), app: 'foreground' | 'background', here: contextId | null, liveCall: bool,
 *          view: 'analysis' | 'conversation' | 'shared' | … (proof context: the Product view in front of the user) }.
 * Every non-suppressed outcome also leaves (or keeps) a truthful Activity item; `mark` says whether it is
 * attention-worthy (the Attention Mark), which is ATTENTION STATE, never event state (D31, D44).
 */
export function decide(e, ctx) {
  const s = ctx.settings, R = [];
  const out = (surface, extra = {}) => ({ surface, level: extra.level ?? null, reasons: R, mark: extra.mark ?? (surface !== 'suppressed' && surface !== 'stale' && e.cls <= 3), activity: surface !== 'suppressed' });
  // 1. authority and semantic time (D38, D39, D59): a target that is gone, or a window that has closed, is not delivered.
  if (e.expiresAt != null && ctx.now >= e.expiresAt) { R.push('semantic-expiry'); return out('stale', { mark: false }); }
  if (e.targetGone) { R.push('stale-target'); return out('stale', { mark: false }); }
  // 2. eligibility per category (D26, D03/D25, D34, D35)
  if (e.category === 'intro' && !s.intro.entered) { R.push('intro-not-entered'); return out('suppressed'); }
  if (e.kind === 'discovery' && !s.public.discovery) { R.push('discovery-not-opted-in'); return out('suppressed'); }
  const muted = (e.category === 'shared' && (!s.shared.on || s.shared.muted.includes(e.context))) ||
    (e.category === 'public' && e.kind !== 'discovery' && !s.public.interactions) ||
    (e.category === 'intro' && !s.intro.on) || (e.category === 'system' && e.kind !== 'security' && !s.system.other);
  if (muted) { R.push('muted-context'); return out('activity', { mark: false }); }
  if (e.kind === 'proactive' && s.proactive === 'off') { R.push('proactive-off'); return out('next-conversation', { mark: false }); }
  // "Reduce" (Product Owner meaning, refinement §7): Reduce TIGHTENS the Proactive Gate's interruption decision — it
  // keeps interruption for the highest-value or strongest-timing reasons. It is not a class rule: a Class 2 candidate
  // may still wait and a Class 3 Meaningful candidate may still interrupt. The proof does not score anything; the fixture
  // states, as an explicit boolean, the already-run Gate's finding (`reduceEligible`: strong enough to interrupt under
  // Reduce). No weight, score, threshold or schema is implied. Every later rule (Class 4, Quiet Hours, ceilings,
  // disclosure, authority) still applies on top.
  if (e.kind === 'proactive' && s.proactive === 'reduce' && e.reduceEligible !== true) { R.push('proactive-reduced'); return out('next-conversation', { mark: false }); }
  // 3. ambient events never interrupt (D10 Class 4, D25): Activity only, no mark pressure.
  if (e.cls >= 4 && e.kind !== 'discovery') { R.push('ambient'); return out('activity', { mark: false }); }
  // 3b. an active Live Call (G3 §D; refinement §8) — on either surface, foreground or background: ordinary Shared /
  // Public / Introductions / Proactive attention is deferred and re-evaluated after the call. Only the two call-safe
  // cases may be presented now — in the foreground as the small call-safe strip; in the background by the normal path.
  if (ctx.liveCall && !isCallSafe(e)) { R.push('live-call-deferred'); return out('deferred', { mark: true }); }
  // 4. the Product already has the user's attention (D51; task §8)
  if (ctx.app === 'foreground') {
    if (ctx.liveCall) { R.push('live-call-safe'); return out('call-strip', { mark: true }); }
    // 4a. the Analysis (final micro-refinement §5–§6): the Analysis is not an attention surface. While the user is inside
    // it, ordinary attention is NEVER presented transiently — call or no call. It is deferred: it stays truthfully in
    // Activity (with the mark where it is attention-worthy) and is re-evaluated when the user leaves (reevaluatePending).
    // The only thing ever laid over the Analysis is the call-safe strip above, during an active Live Call. There is no
    // other exception: critical security outside a call waits here too (no frozen rule names another surface).
    // `ctx.view` is PROOF CONTEXT (where the user is looking), not a production schema.
    if (ctx.view === 'analysis') { R.push('analysis-deferred'); return out('deferred'); }
    if (ctx.here && ctx.here === e.context) { R.push('same-context'); return out('in-place', { mark: false }); }
    if (e.kind === 'discovery') { R.push('discovery-no-strip'); return out('activity', { mark: false }); }
    R.push('different-context'); return out('strip');
  }
  // 5. background: OS permission is a hard boundary (D50); Snooze and Quiet Hours defer ordinary interruption (D06, D37)
  if (s.os !== 'granted') { R.push('os-permission-' + s.os); return out('activity'); }
  if (!isQuietException(e)) {
    if (s.snoozeUntil != null && ctx.now < s.snoozeUntil) { R.push('snoozed'); return out('deferred'); }
    if (inQuiet(ctx.now, s.quiet)) { R.push('quiet-hours'); return out('deferred'); }
  }
  // 6. the ceilings (task §14) — a refused Push is downgraded, never queued to spend budget later
  const b = budgetVerdict({ ...e, at: ctx.now }, ctx.hist);
  // a refused Proactive candidate waits for the next conversation (D12 surface); a refused Discovery is the first
  // candidate for suppression (D25); anything else stays a truthful Activity item.
  if (!b.ok) { R.push('ceiling:' + b.reason); return out(e.kind === 'proactive' ? 'next-conversation' : e.kind === 'discovery' ? 'suppressed' : 'activity', { mark: e.kind === 'proactive' || e.kind === 'discovery' ? false : undefined }); }
  if (b.outside) R.push('outside-ordinary-budget');
  // 7. disclosure: the user's ceiling, never more; the rendered level may be lower (D17). Importance never raises it.
  // `safeMax` is EVENT-specific (what this one event's bounded safe projection can truthfully carry); no category —
  // Introductions included — has a permanent cap of its own beyond its D15 default and the user's explicit ceiling.
  const subj = subjectOf(e);
  const level = minLevel(e.safeMax ?? 'L3', s.lock[subj] ?? DISCLOSURE_DEFAULTS[subj]);
  R.push('push'); return out('push', { level });
}

// ---------------------------------------------------------------------------------- disclosure projection
/**
 * The bounded safe projection (I-08N §10): the renderer receives only what the level allows. `p` is the event's
 * projection source (content.mjs supplies the words per language). Returns { title, body } — the ONLY strings a
 * notification of that level may carry. No projection ever combines two contexts (it is built from ONE event).
 */
export function project(e, level, words) {
  const w = words;
  if (level === 'L0') return { title: null, body: w.l0 };                                   // nothing about category or context
  if (level === 'L1') return { title: null, body: w.generic[subjectOf(e)] };               // category-generic
  if (level === 'L2') return { title: e.ctxName ?? w.ctxTitle[subjectOf(e)], body: e.bounded };   // context, not content
  return { title: e.ctxName ?? w.ctxTitle[subjectOf(e)], body: e.preview };                 // content preview (never default)
}

// ------------------------------------------------------------------------------------------- coalescing
/**
 * D09: same-context, same-kind, low-value repetition MAY be coalesced; different Worlds / authorities NEVER are. The key
 * therefore always contains the category AND the exact context; an item that is actionable or Class ≤ 2 stays alone.
 */
export const coalesceKey = (e) => (e.cls <= 2 || e.actionable ? null : `${e.category}|${e.context}|${e.kind}`);
export function coalesce(items) {
  const groups = new Map(), out = [];
  for (const e of items) {
    const k = coalesceKey(e);
    if (!k) { out.push({ ...e, members: [e.id] }); continue; }
    if (!groups.has(k)) { const g = { ...e, members: [e.id], count: 1 }; groups.set(k, g); out.push(g); }
    else { const g = groups.get(k); g.members.push(e.id); g.count++; g.at = Math.max(g.at, e.at); }
  }
  return out;
}
/** A coalesced group is valid only if every member shares category and context (the check the planted defect breaks). */
export const coalescedValid = (g, byId) => g.members.every((id) => byId[id].category === g.category && byId[id].context === g.context);

// ------------------------------------------------------------------------------ Quiet Hours end: no dump
/**
 * Task §13 P3-M: at the end of Quiet Hours every pending candidate is RE-EVALUATED as if it were new — nothing is
 * released merely because it waited. PROOF INTERPRETATION of "no dump": the boundary itself is not a reason to
 * interrupt, so a waiting candidate earns a Push at 08:00 only if its value is still TIMELY now (Class ≤ 2 now, or a
 * Proactive candidate whose Gate says "useful now" at 08:00); every other one lands in Activity (coalesced where D09
 * allows), goes stale, or is suppressed. The ordinary ceilings still apply on top.
 */
export function reevaluateAtQuietEnd(pending, ctx) {
  const t = ctx.now, hist = [...ctx.hist], results = [];
  const order = [...pending].sort((a, b) => (a.clsAtEnd ?? a.cls) - (b.clsAtEnd ?? b.cls) || a.at - b.at);
  for (const e0 of order) {
    const e = { ...e0, cls: e0.clsAtEnd ?? e0.cls };
    let r = decide(e, { ...ctx, hist, now: t });
    if (r.surface === 'push' && !(e.cls <= 2 || (e.kind === 'proactive' && e.usefulAtEnd))) {
      r = { ...r, surface: 'activity', reasons: [...r.reasons.filter((x) => x !== 'push'), 'not-timely-at-quiet-end'] };
    }
    if (r.surface === 'push') hist.push({ at: t, kind: e.kind, category: e.category, thread: e.thread, critical: !!e.critical, engaged: false, id: e.id });
    results.push({ id: e.id, ...r });
  }
  const acts = coalesce(pending.filter((e) => results.find((r) => r.id === e.id).surface === 'activity'));
  return { results, activityGroups: acts, pushes: results.filter((r) => r.surface === 'push').length };
}

// ------------------------------------------------------------- leaving a deferring state: re-evaluate, never replay
/**
 * Final micro-refinement §7 (and the same law after a Live Call, G3 §D): when a deferring condition ends — the user
 * leaves the Analysis, or the call ends — every waiting candidate is decided AGAIN against current truth, authority,
 * eligibility and context. Nothing is presented merely because it waited: a candidate that went stale, whose World was
 * muted meanwhile, or whose originating context the user is now in, gets that answer instead. AT MOST ONE strip: if
 * several are strip-eligible now, the one with the highest attention value is presented (lowest Interruption Class; on a
 * tie, the one that has waited longest — PROOF INTERPRETATION of "higher attention value", and the same order the first P3-A pass used after a call) and the others stay in Activity, marked.
 * A candidate that is still deferred now (e.g. the call continues) keeps waiting.
 * Returns { results: [{ id, surface, reasons, mark }], strip: id | null, pending: [id] }.
 */
export function reevaluatePending(pending, ctx) {
  const results = pending.map((e) => ({ id: e.id, e, ...decide(e, ctx) }));
  const strips = results.filter((r) => r.surface === 'strip').sort((a, b) => a.e.cls - b.e.cls || (a.e.at ?? 0) - (b.e.at ?? 0));
  for (const r of strips.slice(1)) { r.surface = 'activity'; r.reasons = [...r.reasons, 'one-strip-at-a-time']; }
  return {
    results: results.map(({ e, ...r }) => r),
    strip: strips.length ? strips[0].id : null,
    pending: results.filter((r) => r.surface === 'deferred').map((r) => r.id),
  };
}

/** Run a whole candidate trace (time-ordered) through decide(), recording the pushes it makes. */
export function runTrace(events, settings, { app = 'background', here = null, liveCall = false } = {}) {
  const hist = [], rows = [];
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    const r = decide(e, { settings, hist, app, here, liveCall, now: e.at });
    if (r.surface === 'push') hist.push({ at: e.at, kind: e.kind, category: e.category, thread: e.thread, critical: !!e.critical, engaged: !!e.engagedAfter, id: e.id });
    rows.push({ id: e.id, at: e.at, ...r,
      ord24: within(hist, e.at, DAY, isOrdinary), ord7: within(hist, e.at, 7 * DAY, isOrdinary),
      pro24: within(hist, e.at, DAY, (h) => h.kind === 'proactive'), pro7: within(hist, e.at, 7 * DAY, (h) => h.kind === 'proactive') });
  }
  return { rows, pushes: hist };
}

// ------------------------------------------------------------------------------------ attention indicators
/**
 * D44/D45/D48 + task §7: the GLOBAL indicator is PRESENCE, derived from eligible attention items — never a number and
 * never a sum. Inside Activity, a category indicator is a count only where the Product Owner allowed one: Shared (a
 * useful count), System (only genuinely actionable items). Public defaults to presence; Introductions is presence ONLY.
 */
export function indicators(items) {
  const att = items.filter((i) => i.attention === 'unseen' || (i.actionable && !i.resolved));
  const cat = (c) => att.filter((i) => i.category === c);
  return {
    global: { present: att.length > 0 },                              // no count field exists, by construction
    shared: { present: cat('shared').length > 0, count: cat('shared').length || null },
    public: { present: cat('public').length > 0 },
    intro: { present: cat('intro').length > 0 },
    system: { present: cat('system').length > 0, count: cat('system').filter((i) => i.actionable && !i.resolved).length || null },
    qandeel: { present: cat('qandeel').length > 0 },
  };
}

/** Seen / opened are attention states (D31, D40, D47). They never touch the source event's truth. */
export function markSeen(item) { return { ...item, attention: item.attention === 'unseen' ? 'seen' : item.attention }; }
export function markOpened(item) { return { ...item, attention: 'opened' }; }   // `resolved` is NOT changed here, ever

/** Strip eligibility (task §8): only in the foreground, only outside the originating context, never in a Live Call
 *  (the call-safe strip is a separate surface: see isCallSafe), never while the user is inside the Analysis. */
export const stripEligible = (e, ctx) => decide(e, { ...ctx, app: 'foreground' }).surface === 'strip';
