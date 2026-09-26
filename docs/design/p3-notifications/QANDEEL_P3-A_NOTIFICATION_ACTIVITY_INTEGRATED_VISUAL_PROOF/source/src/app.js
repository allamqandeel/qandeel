// P3-A — the proof's page runtime. ONE state object (S), rendered top → bottom (focus order = visual order), with every
// surface decision delegated to the Product-behaviour model (window.P3MODEL = src/model.mjs, shipped into the page).
// Motion runs on ONE clock: real time when reviewed live, a virtual clock when captured (window.P3.tick), so every clip
// frame is reproducible.
(function () {
  'use strict';
  const D = window.P3DATA, M = window.P3MODEL, G = D.glyphs, FX = D.fx;
  const Q = new URLSearchParams(location.search);
  const mm = (q) => { try { return matchMedia(q).matches; } catch { return false; } };
  const P = {
    lang: Q.get('lang') === 'en' ? 'en' : 'ar',
    appearance: (() => { const a = Q.get('appearance') || 'dark'; return a === 'system' ? (mm('(prefers-color-scheme: light)') ? 'light' : 'dark') : a; })(),
    appearanceSetting: Q.get('appearance') || 'dark',
    rm: Q.get('rm') === '1' || mm('(prefers-reduced-motion: reduce)'),
    contrast: Q.get('contrast') === 'more' || mm('(prefers-contrast: more)') ? 'more' : 'standard',
    w: +Q.get('w') || 390, h: +Q.get('h') || 844,
    capture: Q.get('capture') === '1',
    state: Q.get('state') || 'conv',
    defect: Q.get('defect') || '',
    entry: Q.get('entry') || D.activityAccepted,
    // the Introductions row source mark: the ACCEPTED (final) Open Link; ?introglyph=door shows the At the Door
    // comparison (history only); planted defect D23 restores the withdrawn two-opening drawing
    introGlyph: Q.get('defect') === 'oldintro' ? 'introTwoArcs20' : ({ link: 'introLink20', door: 'introDoor20' })[Q.get('introglyph') || D.introAccepted],
  };
  const L = D.copy[P.lang];
  // planted defect D18: the withdrawn L1 label comes back
  if (P.defect === 'oldl1') L.levels.L1.text = P.lang === 'ar' ? 'تنبيه عام' : 'General';
  const tx = (k) => L[k].text;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  // designing-arabic-frontends §4: a Latin handle inside an Arabic sentence is an LTR island, or its '@' lands on the
  // wrong side. Only handles need it; digits and "Pixel 8" resolve correctly inside the paragraph.
  const fmt = (s) => esc(s).replace(/@[A-Za-z0-9_.]+/g, (h) => `<bdi dir="ltr">${h}</bdi>`);
  const fill = (tpl, ...a) => a.reduce((s, v, i) => s.split(`{${i}}`).join(v), tpl);
  const ctxName = (c) => (FX.CONTEXTS[c] ? FX.CONTEXTS[c][P.lang] : '');

  // ------------------------------------------------------------------------------------------------ the clock
  let T = 0; const anims = []; const timers = [];
  const bez = (x1, y1, x2, y2) => (t) => { // cubic-bezier solve for y at x = t
    let a = 0, b = 1, x = t; for (let i = 0; i < 30; i++) { const m = (a + b) / 2, cx = 3 * (1 - m) * (1 - m) * m * x1 + 3 * (1 - m) * m * m * x2 + m * m * m; if (cx < x) a = m; else b = m; }
    const m = (a + b) / 2; return 3 * (1 - m) * (1 - m) * m * y1 + 3 * (1 - m) * m * m * y2 + m * m * m; };
  const EASE_OUT = bez(0.23, 1, 0.32, 1), EASE_SHEET = bez(0.32, 0.72, 0, 1), EASE_IO = bez(0.77, 0, 0.175, 1);
  /** props: { opacity:[a,b], y:[a,b] (px), scale:[a,b] } — transform + opacity only (animate-expo §4). */
  function animate(sel, props, dur, ease = EASE_OUT, delay = 0, done) {
    anims.push({ sel, props, t0: T + delay, dur: Math.max(1, dur), ease, done }); apply();
  }
  function after(ms, fn) { timers.push({ at: T + ms, fn }); }
  function apply() {
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i], el = document.querySelector(a.sel);
      const p = Math.min(1, Math.max(0, (T - a.t0) / a.dur)), e = a.ease(p);
      if (el) {
        const v = (k) => a.props[k] ? Math.round((a.props[k][0] + (a.props[k][1] - a.props[k][0]) * e) * 1000) / 1000 : null;
        if (a.props.opacity) el.style.opacity = v('opacity');
        const y = v('y'), s = v('scale');
        if (a.props.y || a.props.scale) el.style.transform = `${y != null ? `translateY(${y}px)` : ''} ${s != null ? `scale(${s})` : ''}`.trim();
      }
      if (p >= 1) { anims.splice(i, 1); if (a.done) a.done(); }
    }
  }
  function tick(ms) {
    const end = T + ms;
    while (true) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > end) break;
      T = next.at; timers.shift(); apply(); next.fn();
    }
    T = end; apply();
  }
  if (!P.capture) { let last = performance.now(); const loop = (now) => { tick(Math.min(100, now - last)); last = now; requestAnimationFrame(loop); }; requestAnimationFrame(loop); }

  // ------------------------------------------------------------------------------------------------ state
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const S = {
    place: 'conv', here: 'personal', stack: [], filter: Q.get('filter') || 'all', call: false,
    settings: clone(FX.FEED_SETTINGS), feed: clone(FX.FEED), strip: null, deferred: [], inplace: null,
    sheet: null, osbox: false, notNow: false, eduDeclined: false, staleOpen: null, log: [], focusAfter: null, shown: [],
  };
  if (Q.get('os')) S.settings.os = Q.get('os');
  if (Q.get('intro') === '0') S.settings.intro.entered = false;
  if (Q.get('mark') === '0') S.feed.forEach((i) => { if (i.attention === 'unseen') i.attention = 'seen'; i.actionable = false; });
  if (Q.get('proactive')) S.settings.proactive = Q.get('proactive');
  if (Q.get('lockintro')) S.settings.lock.intro = Q.get('lockintro');   // the user raised the Introductions ceiling
  const ind = () => M.indicators(S.feed);
  // The Analysis is the Personal conversation's own analysis (G1.1): its originating context is 'personal'.
  // `view` tells the model which Product view is in front of the user (proof context): inside the Analysis no ordinary
  // attention is presented transiently (final micro-refinement §5–§6) — the model decides that, not this page.
  const ctxFor = (extra = {}) => ({ settings: S.settings, hist: [], app: 'foreground', here: S.place === 'shared' ? S.here : S.place === 'conv' || S.place === 'analysis' ? 'personal' : null, liveCall: S.call, view: S.place === 'conv' ? 'conversation' : S.place, now: FX.NOW, ...extra });

  /** An event arrives while the app is in the foreground. The MODEL decides the surface; the page only renders it. */
  function arrive(ev, { quiet = false } = {}) {
    let r = M.decide(ev, ctxFor());
    // planted defects D20 / D21 (page side): a call-safe event deferred; an ordinary Shared event shown during a call
    if (P.defect === 'calldefer' && r.surface === 'call-strip') r = { ...r, surface: 'deferred' };
    if (P.defect === 'callshared' && r.surface === 'deferred' && S.call && ev.category === 'shared') r = { ...r, surface: 'call-strip' };
    // planted defect D24 (page side): REJECTED / PLANTED DEFECT — ORDINARY STRIP INSIDE ANALYSIS
    if (P.defect === 'analysisstrip' && r.surface === 'deferred' && r.reasons.includes('analysis-deferred')) r = { ...r, surface: 'strip' };
    S.log.unshift(`${ev.id} → ${r.surface} (${r.reasons.join(', ')})`);
    if (r.surface === 'suppressed') return r;
    const wasPresent = ind().global.present;
    const item = { id: ev.id + '-' + S.feed.length, category: ev.category, kind: ev.kind, cls: ev.cls, context: ev.context, at: FX.NOW,
      attention: r.mark ? 'unseen' : 'seen', actionable: !!ev.actionable || ev.kind === 'security', text: ev.text, critical: ev.critical };
    if (r.surface !== 'in-place') S.feed.unshift(item);
    if (r.surface === 'in-place') S.inplace = ev;
    // a waiting candidate keeps its arrival order (the model's tie-break is "the one that has waited longest")
    if (r.surface === 'deferred') S.deferred.push({ ...ev, at: ev.at ?? FX.NOW + (S.arrivals = (S.arrivals || 0) + 1) / 60 });
    if (r.surface === 'strip') showStrip(ev, quiet);
    else if (r.surface === 'call-strip') showStrip(ev, quiet, true);
    else render();
    if (!wasPresent && ind().global.present) markArrives();   // only a mark that was ABSENT arrives; a present one stays still
    return r;
  }
  function markArrives() {
    // The mark becomes present: a calm fade + small settle of scale from 0.6 (never 0; no bounce). RM: fade only.
    if (!document.querySelector('#act-entry .amark')) return;
    if (P.rm) animate('#act-entry .amark', { opacity: [0, 1] }, 180, EASE_OUT);
    else animate('#act-entry .amark', { opacity: [0, 1], scale: [0.6, 1] }, 220, EASE_OUT);
  }

  // ------------------------------------------------------------------------------------ the Attention Strip
  const HOLD = 6000;   // readable hold (craft value, not frozen); paused while the strip has focus or a finger on it
  /** `callSafe`: the refinement §8 call-safe strip — only for isCallSafe() events during an active Live Call. It is
   *  small and non-blocking, carries NO Direct Entry (entering another place mid-call is not asked for; the item waits
   *  in Activity, still actionable), and leaves the call exactly as it was. */
  function showStrip(ev, quiet, callSafe = false) {
    S.strip = { ev, shownAt: T, held: false, callSafe };
    S.shown.push(ev.id);   // every strip ever presented (the checks count them: never a dump)
    render();
    const a11y = document.getElementById('a11y');
    if (a11y && !quiet) a11y.textContent = callSafe ? `${tx('callSafeRegion')}: ${sourceName(ev)} — ${ev.text[P.lang]} (${tx('callSafeOn')})` : `${tx('stripRegion')}: ${sourceName(ev)} — ${ev.text[P.lang]}`;
    const travel = S.place === 'analysis' ? 6 : 10;   // in the Analysis chrome row the strip has less room to travel
    if (P.rm) animate('.strip', { opacity: [0, 1] }, 160, EASE_OUT);
    else animate('.strip', { opacity: [0, 1], y: [-travel, 0] }, 240, EASE_OUT);
    const id = S.strip;
    after(HOLD, () => { if (S.strip === id && !S.strip.held) dismissStrip(); });
  }
  function dismissStrip(then) {
    if (!S.strip) return;
    const fin = () => { S.strip = null; render(); if (then) then(); };
    const travel = S.place === 'analysis' ? 6 : 10;
    if (P.rm) animate('.strip', { opacity: [1, 0] }, 140, EASE_OUT, 0, fin);
    else animate('.strip', { opacity: [1, 0], y: [0, -travel] }, 180, EASE_OUT, 0, fin);
  }
  const sourceName = (ev) => (ev.category === 'qandeel' ? tx('product') : ev.category === 'intro' ? L.filters.intro.text : ev.category === 'system' ? ctxName('account') : ctxName(ev.context));
  const glyphFor = (cat) => ({ qandeel: G.navMine20, shared: G.navShared20, public: G.navPublic20, intro: G[P.introGlyph], system: G.settings20 }[cat]);

  // ------------------------------------------------------------------------------------ the Analysis (G3, frozen)
  // The Analysis is not redrawn: it is G3.2's own reviewed prototype (prototype/g3.2/index.html, byte-exact) running in
  // a frame the size of the phone. P3 adds NOTHING to its chrome — no Activity entry (refinement §4.2) — and no ordinary
  // Attention Strip ever appears over it (final micro-refinement §5: the model defers ordinary attention while the user is
  // inside the Analysis). The ONE thing P3 may lay over it is the call-safe strip, during an active Live Call, for the two
  // call-safe exceptions only: in the upper chrome row (y 47–95) beside «المحادثة», temporarily and intentionally
  // occluding the Replay slot — the one bounded exception. It never enters the world (which starts at y 95 and is sized
  // at its floor, T-11 §3), the Timeline, Return Live, the band or the call line, and it never covers the Conversation ↔
  // Analysis switch. All of this is measured from G3's own elements, never assumed.
  let G32 = null, g32Ready = null;
  function g32Frame() {
    if (G32) return g32Ready;
    const st = Q.get('g32') || (S.call ? (P.w <= 320 ? 'CALL_PINNED' : 'CALL_ANALYSIS') : 'P1');
    const q = new URLSearchParams({ capture: '1', state: st, lang: P.lang, w: String(P.w), h: String(P.h), appearance: P.appearance });
    G32 = Object.assign(document.createElement('iframe'), { id: 'g32', title: tx('door') + ' — G3' });
    G32.dataset.state = st;
    G32.src = 'g3.2/index.html?' + q.toString();
    document.getElementById('g32host').appendChild(G32);
    g32Ready = new Promise((res) => G32.addEventListener('load', () => {
      const d = G32.contentDocument;
      // a covered control must never take keyboard focus unseen: if G3's Replay (under the strip) is focused, the strip
      // steps aside (WCAG 2.4.11 focus not obscured)
      if (d) d.addEventListener('focusin', (e) => { if (S.strip && S.place === 'analysis' && e.target && e.target.id === 'replay') dismissStrip(); });
      // «المحادثة» leaves the Analysis for P3's Conversation, where the Activity entry lives: one step away (§4.2)
      if (d) d.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#back')) { e.preventDefault(); e.stopPropagation(); back(); } }, true);
      // settle exactly as G3.2's own capture tool does: its ready promise, its virtual clock at 0, enter the state, then
      // two frames and 250 ms (g3.2/source/tools/capture.mjs, lib/session.mjs `settle`)
      const w = G32.contentWindow, api = w && w.__G32;
      Promise.resolve(api && api.ready).then(() => { if (api) { api.clock(0); api.enter(st); } })
        .then(() => new Promise((r) => w.requestAnimationFrame(() => w.requestAnimationFrame(() => setTimeout(r, 250))))).then(res);
    }, { once: true }));
    return g32Ready;
  }
  const g32Rect = (id) => { const d = G32 && G32.contentDocument, e = d && d.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  /** The strip's place in the Analysis: the chrome row, from the Replay slot to 8 pt before «المحادثة». */
  function chromeSlot() {
    const back = g32Rect('back'), rep = g32Rect('replay'); if (!back || !rep) return null;
    // planted defect D27: the strip "avoids" Replay by dropping below the chrome row — into the world's floor
    if (P.defect === 'badslot') return { x: 16, y: Math.round(back.b) + 6, w: P.w - 32, h: Math.round(back.h) };
    const rtl = back.x > rep.x;
    const x0 = rtl ? rep.x - 4 : back.r + 8, x1 = rtl ? back.x - 8 : rep.r + 4;
    return { x: Math.round(x0), y: Math.round(back.y), w: Math.round(x1 - x0), h: Math.round(back.h) };
  }

  // ------------------------------------------------------------------------------------ Direct Entry
  /** D38/D39: authority is revalidated at tap time (the fixture's `targetGone` is the revalidation result); a stale
   *  target is never replaced by a guessed destination; D43: entering changes where the user looks, nothing else. */
  function enter(item) {
    const it = S.feed.find((x) => x.id === item.id);
    if (it) Object.assign(it, M.markOpened(it));          // attention state only — `resolved` is never touched here
    if (item.targetGone) { S.staleOpen = item.id; render(); return; }
    if (item.category === 'shared') go('shared', item.context);
    else if (item.category === 'qandeel') go('conv', 'personal');
    else if (item.category === 'system') go('settings', 'account');
    else if (item.category === 'intro') go('handoff', 'intro');
    else go('handoff', 'public');
  }
  function go(place, here) {
    if (place !== S.place) S.stack.push({ place: S.place, here: S.here });
    S.place = place; if (here) S.here = here; S.sheet = null; S.osbox = false;
    if (place === 'analysis') g32Frame();
    S.focusAfter = place === 'activity' || place === 'settings' || place === 'notif' ? 'h1' : null;
    render();
    if (!P.rm) animate('#view', { opacity: [0, 1] }, 200, EASE_OUT); else animate('#view', { opacity: [0, 1] }, 120, EASE_OUT);
    if (place === 'activity') scheduleSeen();
  }
  function back() {
    const from = S.place, p = S.stack.pop() || { place: 'conv', here: 'personal' }; S.place = p.place; S.here = p.here; S.staleOpen = null; render();
    // leaving the Analysis: what waited there is RE-EVALUATED now (final micro-refinement §7); planted defect D25 skips it
    if (from === 'analysis' && S.place !== 'analysis' && P.defect !== 'noreeval') releaseDeferred();
  }

  // Seen = the row was on screen (≥ half) for a moment while Activity is open (D31, D47). Actionable items keep a
  // WAITING mark after they are seen; nothing here resolves an event.
  const DWELL = 1200;
  function scheduleSeen() {
    after(DWELL, () => {
      if (S.place !== 'activity') return;
      const body = document.querySelector('.page .body'); if (!body) return;
      const vb = body.getBoundingClientRect();
      for (const li of document.querySelectorAll('.row')) {
        const r = li.getBoundingClientRect(), vis = Math.max(0, Math.min(r.bottom, vb.bottom) - Math.max(r.top, vb.top));
        if (vis >= r.height / 2) { const it = S.feed.find((x) => x.id === li.dataset.id); if (it && it.attention === 'unseen') { it.attention = 'seen'; li.dataset.fading = '1'; } }
      }
      const fading = [...document.querySelectorAll('.row[data-fading="1"] .amark:not(.ring)')];
      if (!fading.length) return;
      fading.forEach((m, i) => m.id = 'fade-' + i);
      let left = fading.length;
      fading.forEach((m) => animate('#' + m.id, { opacity: [1, 0] }, P.rm ? 160 : 260, EASE_OUT, 0, () => { if (--left === 0) render(); }));
    });
  }

  // ------------------------------------------------------------------------------------ permission education
  function eduFor(trigger) {
    if (S.settings.os !== 'not-requested') return false;       // D50: permission is platform state; ask once, in context
    if (S.eduDeclined && trigger !== 'settings') return false; // D50: no repeated pressure after Not now
    S.sheet = { kind: 'edu', trigger }; render();
    if (P.rm) { animate('.scrim', { opacity: [0, 1] }, 160); animate('.sheet', { opacity: [0, 1] }, 160); }
    else { animate('.scrim', { opacity: [0, 1] }, 220); animate('.sheet', { y: [420, 0] }, 320, EASE_SHEET); }
    return true;
  }
  function eduAllow() {
    const fin = () => { S.sheet = null; S.osbox = true; render(); animate('.osbox', { opacity: [0, 1] }, P.rm ? 160 : 220); };
    if (P.rm) { animate('.sheet', { opacity: [1, 0] }, 140); animate('.scrim', { opacity: [1, 0.999] }, 140, EASE_OUT, 0, fin); }
    else { animate('.sheet', { y: [0, 420] }, 260, EASE_SHEET, 0, fin); }
  }
  function eduNotNow() {
    const fin = () => { S.sheet = null; S.eduDeclined = true; S.notNow = true; render(); after(4000, () => { S.notNow = false; render(); }); };
    if (P.rm) { animate('.sheet', { opacity: [1, 0] }, 140); animate('.scrim', { opacity: [1, 0] }, 140, EASE_OUT, 0, fin); }
    else { animate('.scrim', { opacity: [1, 0] }, 220); animate('.sheet', { y: [0, 420] }, 260, EASE_SHEET, 0, fin); }
  }

  // ------------------------------------------------------------------------------------ Live Call end
  function endCall() {
    S.call = false;
    render();
    releaseDeferred();
  }
  /** A deferring condition ended (the call ended, or the user left the Analysis). The MODEL re-evaluates every waiting
   *  candidate against the current context (G3 §D; task §8; final micro-refinement §7) — nothing is replayed. At most one
   *  strip follows; the rest stay where they already are: in Activity, with the mark. What is still deferred now (the
   *  user is still in the Analysis, or the call continues) keeps waiting. */
  function releaseDeferred() {
    const pend = S.deferred.splice(0); if (!pend.length) return;
    const r = M.reevaluatePending(pend, ctxFor());
    S.deferred = pend.filter((e) => r.pending.includes(e.id));
    for (const x of r.results) S.log.unshift(`${x.id} ⟲ ${x.surface} (${x.reasons.join(', ')})`);
    // planted defect D26: every candidate that is strip-eligible on its own is presented — a dump
    const show = P.defect === 'dump' ? pend.filter((e) => M.decide(e, ctxFor()).surface === 'strip') : pend.filter((e) => e.id === r.strip);
    show.forEach((ev, i) => after((P.rm ? 200 : 400) + i * 1500, () => showStrip(ev)));
    harness();
  }

  // ------------------------------------------------------------------------------------------------ views
  const statusBar = () => `<div class="status" aria-hidden="true"><span class="clock">9:41</span><span class="sys">` +
    `<svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5" width="3" height="6" rx="1" fill="currentColor"/><rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="11" rx="1" fill="currentColor"/></svg>` +
    `<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="8" rx="1.6" fill="currentColor"/><rect x="23.6" y="4" width="1.8" height="4" rx=".9" fill="currentColor" opacity=".45"/></svg></span></div>`;

  function entryHTML() {
    const present = ind().global.present;
    let mark = present ? '<span class="amark" aria-hidden="true"></span>' : '';
    if (P.defect === 'redbadge') mark = '<span class="amark bad" aria-hidden="true" style="width:auto;min-width:20px;height:18px;border-radius:9px;padding:0 5px;background:#e5484d;color:#fff;font:600 11px/18px Estedad;top:2px">37</span>';
    if (P.defect === 'brassdot' && present) mark = '<span class="amark" aria-hidden="true" style="background:var(--brass)"></span>';
    const name = tx('activity') + (present ? (P.lang === 'ar' ? '، ' : ', ') + tx('activityNew') : '');
    return `<button id="act-entry" class="ibtn pz" type="button" aria-label="${esc(name)}" data-present="${present ? 1 : 0}">${G['act-' + P.entry]}${mark}</button>`;
  }
  function railHTML(sel) {
    return `<nav id="rail" aria-label="${esc(L.nav.label.text)}"><div class="items">` + L.nav.items.map((n) =>
      `<button class="it pz${n.key === sel ? ' sel' : ''}" type="button" ${n.key === sel ? 'aria-current="page"' : ''}><span class="ic">${G[{ mine: 'navMine24', shared: 'navShared24', public: 'navPublic24' }[n.key]]}</span><span class="lb">${esc(n.text)}</span></button>`).join('') + '</div></nav>';
  }
  const THREAD = {
    ar: [{ day: 'اليوم 9:40' }, { who: 'me', text: 'عندي presentation للـclient يوم الخميس الساعة 10:30، ولسه مخلّصتش.' },
      { who: 'q', text: 'آخر أربع مرات، الإعداد كان بيطوّل، والنوم بيقلّ قبل التسليم بيومين، وبعدها الطاقة بتنزل. ده اللي شايفه في عالمك، ومش متأكد من السبب.' },
      { who: 'me', text: 'الأرقام بس اللي ناقصة. الـQ3 numbers لسه ما وصلتش من finance.' },
      { who: 'q', text: 'يعني اللي ناقص دلوقتي مش في إيدك. لما الأرقام توصل، إيه أول خطوة في العرض؟' }],
    en: [{ day: 'Today 9:40' }, { who: 'me', text: 'I’ve got a presentation for the client on Thursday at 10:30, and it’s still not done.' },
      { who: 'q', text: 'The last four times, the preparation ran long, sleep got shorter two days before the deadline, and then your energy dropped. That’s what I see in your world. I’m not sure why.' },
      { who: 'me', text: 'It’s just the numbers. The Q3 numbers still haven’t come in from finance.' },
      { who: 'q', text: 'So what’s missing right now isn’t in your hands. When the numbers arrive, what’s the first step in the presentation?' }],
  };
  // Proof scaffolding for the Shared World thread (G1.1 §5: multi-human attribution is not designed here).
  const SHARED_THREAD = {
    ar: [{ day: 'اليوم 9:20' }, { who: 'x', name: 'كريم', text: 'مين هيحجز التذاكر؟' }, { who: 'me', text: 'أنا ممكن، بس محتاج أعرف الميعاد الأول.' }],
    en: [{ day: 'Today 9:20' }, { who: 'x', name: 'Karim', text: 'Who’s booking the tickets?' }, { who: 'me', text: 'I can, but I need to know the date first.' }],
  };
  const turn = (t) => t.day ? `<p class="day r-meta">${esc(t.day)}</p>` :
    `<div class="t ${t.who === 'me' ? 'me' : 'q'}${t.isNew ? ' new' : ''}">${t.name ? `<span class="who r-meta">${esc(t.name)}</span>` : ''}<p class="r-body" dir="auto">${fmt(t.text)}</p></div>`;

  function composerHTML() {
    if (!S.call) return `<div class="composer"><div class="write"><span class="ph r-body">${esc(tx('composer'))}</span><div class="line"></div></div>` +
      `<button class="cbtn pz slot-i" type="button" aria-label="${P.lang === 'ar' ? 'مكالمة صوتية' : 'Voice call'}">${G.call24}</button><button class="cbtn pz slot-o" type="button" aria-label="${P.lang === 'ar' ? 'رسالة صوتية' : 'Voice message'}">${G.mic24}</button></div>`;
    return `<div class="composer call"><div class="write"><span class="elapsed r-meta num">4:12</span></div><div class="crail" aria-hidden="true">${G.railArt}</div>` +
      `<button id="route" class="cbtn pz" type="button" aria-label="${esc(tx('route'))}" aria-pressed="true">${G.route24}</button>` +
      `<button id="mute" class="cbtn pz" type="button" aria-label="${esc(tx('mute'))}" aria-pressed="false">${G.mic24}</button>` +
      `<button id="end-call" class="cbtn pz" type="button" aria-label="${esc(tx('endCall'))}">${G.end}</button></div>`;
  }
  function stripHTML() {
    if (!S.strip) return '';
    const ev = S.strip.ev, cs = S.strip.callSafe, inChrome = S.place === 'analysis';
    const name = sourceName(ev) + ': ' + ev.text[P.lang] + (cs ? (P.lang === 'ar' ? '، ' : ', ') + tx('callSafeOn') : '');
    // in the Analysis chrome row only the short line fits (the whole sentence is in the name and in Activity)
    const inner = inChrome
      ? `<span class="src">${glyphFor(ev.category)}</span><span class="tx"><span class="say r-meta">${fmt((ev.short || ev.text)[P.lang])}</span></span>`
      : `<span class="src">${glyphFor(ev.category)}</span><span class="tx"><span class="meta r-meta">${esc(sourceName(ev))} · ${esc(tx('now'))}</span><span class="say r-support">${fmt(ev.text[P.lang])}</span></span>`;
    let geo = '';
    if (inChrome) { const s = chromeSlot(); if (s) geo = ` style="left:${s.x}px;right:auto;top:${s.y}px;width:${s.w}px;height:${s.h}px"`; }
    // a call-safe strip has NO Direct Entry: its body is text (read with the region), and its one act is dismiss
    // (planted defect D28 gives it a Direct Entry button)
    const body = cs && P.defect !== 'callentry' ?`<div class="go body"><span class="vis" aria-hidden="true">${inner}</span><span class="sr">${esc(name)}</span></div>`
      : `<button class="go pz" type="button" aria-label="${esc(name)}">${inner}</button>`;
    return `<section class="strip${cs ? ' callsafe' : ''}${inChrome ? ' inchrome' : ''}" role="region" aria-label="${esc(tx(cs ? 'callSafeRegion' : 'stripRegion'))}" data-cat="${ev.category}" data-ev="${ev.id}"${geo}>` +
      body + `<button class="x pz" type="button" aria-label="${esc(tx('stripDismiss'))}">${G.close20}</button></section>`;
  }
  function hostHTML() {
    const onShared = S.place === 'shared';
    let hdr, content, rail;
    if (!onShared) {
      hdr = `<div class="hdr">${entryHTML()}<button id="door" class="hbtn pz push-end" type="button">${G.depth22}<span class="lb">${esc(tx('door'))}</span></button>` +
        `<button id="replay" class="ibtn pz" type="button" aria-label="${esc(tx('replay'))}">${G.replay22}</button></div>`;
      content = `<section class="conv" aria-label="${P.lang === 'ar' ? 'المحادثة' : 'Conversation'}"><div class="thread">${THREAD[P.lang].map(turn).join('')}</div></section>`;
      rail = railHTML('mine');
    } else {
      const thread = [...SHARED_THREAD[P.lang]];
      if (S.inplace) thread.push({ who: 'x', name: P.lang === 'ar' ? 'سارة' : 'Sara', text: S.inplace.preview[P.lang].replace(/^[^:]+:\s*/, ''), isNew: true });
      hdr = `<div class="hdr">${entryHTML()}</div>`;
      content = `<div class="world-name"><h1 class="r-title" tabindex="-1">${esc(ctxName(S.here))}</h1></div>` +
        `<section class="conv" style="top:calc(var(--top) + var(--hdr) + 52px)" aria-label="${esc(ctxName(S.here))}"><div class="thread">${thread.map(turn).join('')}</div></section>`;
      rail = railHTML('shared');
    }
    const toast = S.notNow ? `<p class="toastline r-support" role="status">${esc(tx('notNowNote'))}</p>` : '';
    return statusBar() + hdr + content + composerHTML() + stripHTML() + toast + rail;
  }

  function rowHTML(it) {
    const cat = it.category, stale = !!it.targetGone, openX = S.staleOpen === it.id;
    const att = it.attention, waiting = it.actionable && !it.resolved && att !== 'unseen';
    const mark = stale ? '' : att === 'unseen' ? '<span class="amark" aria-hidden="true"></span>' : waiting ? '<span class="amark ring" aria-hidden="true"></span>' : '';
    const stateWord = stale ? tx('stale') : att === 'unseen' ? tx('markNew') : waiting ? tx('markWaiting') : '';
    const src = cat === 'qandeel' ? tx('product') : cat === 'intro' ? L.filters.intro.text : cat === 'system' ? ctxName('account') : ctxName(it.context);
    const time = M.clock(it.at).replace(/^0(?=\d:)/, '');
    const meta = (it.muted ? `<span class="st r-meta">${esc(tx('muted'))}</span>` : '') + (stale ? `<span class="st r-meta">${esc(tx('stale'))}</span>` : '');
    const text = P.defect === 'crossworld' && it.id === 'F1' ? (P.lang === 'ar' ? '5 رسائل جديدة في رحلة الصيف وفريق العمل' : '5 new messages in Summer trip and Work team') : it.text[P.lang];
    const label = [src, text, stateWord, time].filter(Boolean).join(P.lang === 'ar' ? '، ' : ', ');
    const act = it.action && !it.resolved ? `<button class="act pz" type="button" data-act="${it.id}"><span class="lb">${esc(it.action[P.lang])}</span></button>` : '';
    const explain = openX ? `<div class="explain r-support" role="status">${esc(tx('staleExplain'))}<br><button class="act pz" type="button" data-openctx="${it.context}"><span class="lb">${esc(fill(tx('staleOpen'), ctxName(it.context)))}</span></button></div>` : '';
    return `<li class="row" data-id="${it.id}" data-cat="${cat}" data-att="${att}" data-stale="${stale ? 1 : 0}" data-coalesced="${it.coalesced || 0}" data-context="${it.context}">` +
      `<button class="go pz" type="button" aria-label="${esc(label)}" data-go="${it.id}"></button>` +
      `<span class="gl">${glyphFor(cat)}${mark}</span>` +
      `<span class="ln1 r-meta"><span class="src">${esc(src)}</span><span class="tm num">${time}</span>${meta}</span>` +
      `<span class="say r-support" dir="auto">${fmt(text)}</span>` +
      (it.second ? `<span class="sec2 r-meta">${esc(it.second[P.lang])}</span>` : '') + act + explain + '</li>';
  }
  function activityHTML() {
    const I = ind();
    const chip = (k) => {
      let extra = '';
      if (k === 'shared' && I.shared.count) extra = `<span class="cnt num" aria-hidden="true">${I.shared.count}</span>`;
      else if (k === 'system' && I.system.count) extra = `<span class="cnt num" aria-hidden="true">${I.system.count}</span>`;
      else if (k !== 'all' && I[k] && I[k].present) extra = '<span class="pres" aria-hidden="true"></span>';
      if (k === 'intro' && P.defect === 'introcount') extra = '<span class="cnt num" aria-hidden="true">12</span>';
      const cnt = extra.includes('cnt') ? extra.replace(/<[^>]+>/g, '') : '';
      const name = L.filters[k].text + (cnt ? ` (${cnt})` : extra ? (P.lang === 'ar' ? '، فيه جديد' : ', new') : '');
      return `<button class="fchip pz" type="button" data-filter="${k}" aria-pressed="${S.filter === k}" aria-label="${esc(name)}"><span class="lb">${esc(L.filters[k].text)}</span>${extra}</button>`;
    };
    const items = S.feed.filter((i) => S.filter === 'all' || i.category === S.filter);
    const nowDay = M.clock ? Math.floor(FX.NOW / 1440) : 0;
    const secOf = (i) => { const d = nowDay - Math.floor(i.at / 1440); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : 'earlier'; };
    let html = '', cur = null;
    for (const it of items) { const s = secOf(it); if (s !== cur) { if (cur) html += '</ul>'; html += `<h2 class="sec r-meta">${esc(L.day[s].text)}</h2><ul class="feed">`; cur = s; } html += rowHTML(it); }
    if (cur) html += '</ul>'; else html = `<p class="sec r-support">${esc(tx('empty'))}</p>`;
    const dark = P.defect === 'actdark' ? ' data-appearance="dark" style="background:#101010"' : '';
    return `<section class="page act" aria-labelledby="act-title"${dark}>${statusBar()}<div class="hdr"><button class="ibtn pz" type="button" data-back aria-label="${esc(tx('back'))}">${G.back22}</button>` +
      `<h1 id="act-title" class="r-head" tabindex="-1">${esc(tx('activity'))}</h1><button class="ibtn pz push-end" type="button" data-to="notif" aria-label="${esc(tx('activitySettings'))}">${G.settings22}</button></div>` +
      `<div class="body"><div class="filters" role="group" aria-label="${esc(tx('filterGroup'))}">${['all', 'qandeel', 'shared', 'public', 'intro', 'system'].map(chip).join('')}</div>${html}</div></section>`;
  }

  const sw = (id, on, label) => `<button class="srow pz" type="button" role="switch" aria-checked="${on}" data-sw="${id}"><span class="lb r-support">${esc(label)}</span><span class="sw" aria-hidden="true"></span></button>`;
  const nav = (label, val, attrs = '') => `<button class="srow pz" type="button" ${P.defect === 'gluedname' ? 'data-glued' : 'aria-label'}="${esc(val ? label + (P.lang === 'ar' ? '، ' : ', ') + val : label)}" ${attrs}><span class="lb r-support">${esc(label)}</span>${val ? `<span class="val r-meta">${esc(val)}</span>` : ''}<span class="chev" aria-hidden="true">${G.chev16}</span></button>`;
  function settingsRootHTML() {
    const hi = S.here === 'account' ? 1 : 3;
    return `<section class="page set" aria-labelledby="set-title">${statusBar()}<div class="hdr"><button class="ibtn pz" type="button" data-back aria-label="${esc(tx('back'))}">${G.back22}</button><h1 id="set-title" class="r-head" tabindex="-1">${esc(tx('settings'))}</h1></div>` +
      `<div class="body groups">${L.groups.map((g, i) => `<button class="srow pz${i === hi ? ' here' : ''}" type="button" ${i === 3 ? 'data-to="notif"' : ''}><span class="lb r-support">${esc(g.text)}</span><span class="chev" aria-hidden="true">${G.chev16}</span></button>`).join('')}</div></section>`;
  }
  function notifHTML() {
    const s = S.settings;
    const seg = `<div class="seg" role="radiogroup" aria-label="${esc(tx('proactive'))}" aria-describedby="pro-help">${['allow', 'reduce', 'off'].map((k) => `<button class="pz" type="button" role="radio" aria-checked="${s.proactive === k}" data-pro="${k}"><span class="lb">${esc(L.proactiveOpts[k].text)}</span></button>`).join('')}</div>` +
      `<p id="pro-help" class="note r-support pro-opt">${esc(L.proactiveOptHelp[s.proactive].text)}</p>`;
    const worlds = ['w-summer', 'w-work'].map((w) => nav(ctxName(w), s.shared.muted.includes(w) ? tx('mutedWorld') : tx('on'), `data-world="${w}"`)).join('');
    const lockRows = ['qandeel', 'shared', 'public', 'discovery', 'intro', 'reminder', 'security'].map((k) => nav(L.lockSubjects[k].text, L.levels[s.lock[k]].text, `data-lock="${k}"`)).join('');
    const osNote = s.os !== 'granted' ? `<div class="osoff r-support" role="note">${esc(tx('osOff'))}</div>` : '';
    return `<section class="page set" aria-labelledby="notif-title">${statusBar()}<div class="hdr"><button class="hbtn pz" type="button" data-back aria-label="${esc(tx('back'))}">${G.back22}<span class="lb">${esc(tx('settings'))}</span></button></div>` +
      `<div class="body"><h1 id="notif-title" class="r-title" tabindex="-1" style="padding:0 24px">${esc(tx('notif'))}</h1>${osNote}` +
      `<h2 class="r-action">${esc(tx('proactive'))}</h2>${seg}<p class="note r-meta">${esc(tx('proactiveHelp'))}</p>` +
      `<h2 class="r-action">${esc(tx('sharedSec'))}</h2>${sw('shared', s.shared.on, tx('sharedAll'))}${worlds}` +
      `<h2 class="r-action">${esc(tx('publicSec'))}</h2>${sw('pinter', s.public.interactions, tx('publicInter'))}${sw('pdisc', s.public.discovery, tx('publicDisc'))}<p class="note r-meta">${esc(tx('publicDiscHelp'))}</p>` +
      (s.intro.entered ? `<h2 class="r-action">${esc(tx('introSec'))}</h2>${sw('intro', s.intro.on, tx('introOn'))}<p class="note r-meta">${esc(tx('introHelp'))}</p>` : '') +
      `<h2 class="r-action">${esc(tx('systemSec'))}</h2><p class="srow stmt r-support">${esc(tx('securityAlways'))}</p>${sw('sysother', s.system.other, tx('systemOther'))}` +
      `<h2 class="r-action">${esc(tx('quiet'))}</h2>${sw('quiet', s.quiet.on, tx('quietOn'))}${nav(fill(tx('quietRange'), s.quiet.from, s.quiet.to), '', 'data-quiet="1"')}<p class="note r-meta">${esc(tx('quietHelp'))}</p>` +
      `<h2 class="r-action">${esc(tx('snooze'))}</h2><div class="optrow" role="group" aria-label="${esc(tx('snooze'))}">${['1h', '8h', '24h', 'custom'].map((k) => `<button class="pz" type="button" data-snooze="${k}"><span class="lb">${esc(L.snoozeOpts[k].text)}</span></button>`).join('')}</div>` +
      `<h2 class="r-action">${esc(tx('lockSec'))}</h2><p class="note r-meta">${esc(tx('lockHelp'))}</p>${lockRows}` +
      `<div style="height:18px"></div>${nav(tx('device'), '', 'data-device="1"')}<p class="note r-meta">${esc(tx('deviceHelp'))}</p>` +
      `</div></section>`;
  }
  function sheetHTML() {
    if (!S.sheet) return '';
    if (S.sheet.kind === 'edu') return `<div class="scrim"></div><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="edu-t" data-trigger="${esc(S.sheet.trigger)}">` +
      `<h2 id="edu-t" class="r-head" tabindex="-1">${esc(tx('eduTitle'))}</h2><p class="r-support">${esc(tx('eduBody'))}</p>` +
      `<div class="acts"><button class="pri pz r-action" type="button" data-edu="allow">${esc(tx('eduAllow'))}</button><button class="sec pz r-action" type="button" data-edu="notnow">${esc(tx('eduNotNow'))}</button></div></section>`;
    const k = S.sheet.subject, cur = S.settings.lock[k];
    return `<div class="scrim" data-close></div><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="lk-t"><h2 id="lk-t" class="r-head" tabindex="-1">${esc(L.lockSubjects[k].text)}</h2>` +
      `<p class="r-meta">${esc(tx('lockHelp'))}</p><div role="radiogroup" aria-labelledby="lk-t" style="margin-top:8px">` +
      ['L0', 'L1', 'L2', 'L3'].map((l) => `<button class="opt pz" type="button" role="radio" aria-checked="${cur === l}" data-level="${l}" aria-label="${esc(L.levels[l].text + (P.lang === 'ar' ? '. ' : '. ') + L.levelHelp[l].text)}"><span class="rad" aria-hidden="true"></span><span><span class="r-support">${esc(L.levels[l].text)}</span><span class="h">${esc(L.levelHelp[l].text)}</span></span></button>`).join('') + '</div></section>';
  }
  function osboxHTML() {
    if (!S.osbox) return '';
    return `<div class="scrim" style="background:rgba(0,0,0,.35)"></div><div class="osbox" role="note"><span class="tag">PLATFORM-OWNED · iOS / ANDROID · NOT DRAWN</span><span class="h">${esc(tx('osBoundary'))}</span><span class="r-meta">${esc(tx('osBoundaryNote'))}</span></div>`;
  }
  function handoffHTML() {
    const note = S.here === 'intro'
      ? (P.lang === 'ar' ? 'يفتح لحظة التعارف كما جمّدتها G2.3 في تحليل المحادثة. لا يرسمها P3.' : 'Opens the Introduction moment as G2.3 froze it, in the Analysis. P3 does not redraw it.')
      : (P.lang === 'ar' ? 'يفتح المنشور في العالم العام. لا توجد شاشة Product مجمّدة للعالم العام بعد.' : 'Opens the post in the Public World. No frozen Public World screen exists yet.');
    return `<section class="page" aria-label="handoff">${statusBar()}<div class="hdr"><button class="ibtn pz" type="button" data-back aria-label="${esc(tx('back'))}">${G.back22}</button></div><div class="osbox" role="note"><span class="tag">DIRECT ENTRY TARGET · FROZEN ELSEWHERE</span><span class="r-support">${esc(note)}</span></div></section>`;
  }

  /** The Analysis view: G3's frame (persistent, under everything) plus only what P3 may lay over it — the call-safe
   *  strip, during an active Live Call (an ordinary strip reaches here only through planted defect D24). */
  function analysisHTML() {
    // planted defect D22: the Activity entry pushed into the Analysis chrome
    const bad = P.defect === 'analysisentry' ? `<div class="hdr" style="pointer-events:none;justify-content:center"><span style="pointer-events:auto">${entryHTML()}</span></div>` : '';
    return bad + stripHTML();
  }
  function render() {
    const inA = S.place === 'analysis';
    const view = S.place === 'activity' ? activityHTML() : S.place === 'settings' ? settingsRootHTML() : S.place === 'notif' ? notifHTML() : S.place === 'handoff' ? handoffHTML() : inA ? analysisHTML() : hostHTML();
    const phone = document.getElementById('phone'), ui = document.getElementById('ui');
    const bodyScroll = document.querySelector('.page .body'); const keep = bodyScroll ? bodyScroll.scrollTop : 0;
    // the G3 frame is persistent (re-creating it would reload the Analysis); P3 re-renders only its own layer
    document.getElementById('g32host').hidden = !inA;
    ui.innerHTML = `<span class="fprobe" aria-hidden="true"><span style="font-weight:400">ا</span><span style="font-weight:500">ا</span><span style="font-weight:600">ا</span></span>` +
      `<div id="view">${view}</div>${sheetHTML()}${osboxHTML()}${inA ? '' : '<div class="homebar" aria-hidden="true"></div>'}`;
    phone.appendChild(A11Y);   // ONE persistent assistive channel: a re-created live region never announces
    // A modal (the education, the preview chooser, the platform boundary) makes everything behind it inert: focus and
    // the accessibility tree stay inside it (fixing-accessibility §3).
    if ((S.sheet || S.osbox) && P.defect !== 'noinert') document.getElementById('view').setAttribute('inert', '');
    phone.dataset.place = S.place; phone.dataset.call = S.call ? 'active' : 'none';
    // G3 §C.1: the Analysis is one dark place under either system appearance; what P3 lays over it takes the dark tokens
    phone.dataset.appearance = inA ? 'dark' : P.appearance;
    const b2 = document.querySelector('.page .body'); if (b2 && S.keepScroll) b2.scrollTop = keep;
    S.keepScroll = false;
    const selChip = phone.querySelector('.fchip[aria-pressed="true"]'), fl = phone.querySelector('.filters');
    if (selChip && fl) { const cr = selChip.getBoundingClientRect(), fr = fl.getBoundingClientRect(); if (cr.left < fr.left || cr.right > fr.right) fl.scrollLeft += (cr.left < fr.left ? cr.left - fr.left - 24 : cr.right - fr.right + 24); }
    if (S.focusAfter) { const f = phone.querySelector(S.focusAfter); if (f) f.focus({ preventScroll: true }); S.focusAfter = null; }
    if (S.sheet) { const h = phone.querySelector('.sheet h2'); if (h) h.focus({ preventScroll: true }); }
    harness();
  }

  // ------------------------------------------------------------------------------------------------ input
  function onClick(e) {
    const b = e.target.closest('button'); if (!b || !document.getElementById('phone').contains(b)) return;
    if (b.id === 'act-entry') return go('activity');
    if (b.id === 'door') return go('analysis');
    if (b.matches('[data-back]')) return back();
    if (b.dataset.to) return go(b.dataset.to);
    if (b.closest('.strip')) {
      if (b.classList.contains('x')) return dismissStrip();
      const ev = S.strip.ev; return dismissStrip(() => enter({ ...ev, id: S.feed.find((i) => i.id.startsWith(ev.id))?.id || ev.id }));
    }
    if (b.dataset.go) { const it = S.feed.find((i) => i.id === b.dataset.go); return enter(it); }
    if (b.dataset.openctx) return go('shared', b.dataset.openctx);
    if (b.dataset.act) { const it = S.feed.find((i) => i.id === b.dataset.act); Object.assign(it, M.markOpened(it)); return go('settings', 'account'); }
    if (b.dataset.filter) { S.filter = b.dataset.filter; S.keepScroll = true; render(); return; }
    if (b.dataset.pro) { S.settings.proactive = b.dataset.pro; S.keepScroll = true; render(); if (b.dataset.pro === 'allow') eduFor('proactive-allow'); return; }
    if (b.dataset.sw) { const k = b.dataset.sw, s = S.settings; ({ shared: () => s.shared.on = !s.shared.on, pinter: () => s.public.interactions = !s.public.interactions, pdisc: () => s.public.discovery = !s.public.discovery, intro: () => s.intro.on = !s.intro.on, sysother: () => s.system.other = !s.system.other, quiet: () => s.quiet.on = !s.quiet.on })[k](); S.keepScroll = true; render(); return; }
    if (b.dataset.world) { const w = b.dataset.world, m = S.settings.shared.muted; S.settings.shared.muted = m.includes(w) ? m.filter((x) => x !== w) : [...m, w]; S.keepScroll = true; render(); return; }
    if (b.dataset.lock) { S.sheet = { kind: 'lock', subject: b.dataset.lock }; S.keepScroll = true; render(); return; }
    if (b.dataset.level) { S.settings.lock[S.sheet.subject] = b.dataset.level; S.sheet = null; S.keepScroll = true; render(); return; }
    if (b.dataset.device) { S.osbox = true; S.keepScroll = true; render(); return; }
    if (b.dataset.edu === 'allow') return eduAllow();
    if (b.dataset.edu === 'notnow') return eduNotNow();
    if (b.id === 'end-call') return endCall();
  }
  function onKey(e) { if (e.key === 'Escape') { if (S.sheet && S.sheet.kind === 'edu') eduNotNow(); else if (S.sheet) { S.sheet = null; render(); } else if (S.osbox) { S.osbox = false; render(); } } }
  const down = (e) => { const b = e.target.closest('.pz'); if (b) { b.classList.add('down'); S.held = b; if (b.closest('.strip') && S.strip) S.strip.held = true; } };
  const up = () => {
    if (S.held) { S.held.classList.remove('down'); S.held = null; }
    if (S.strip && S.strip.held && !document.activeElement?.closest?.('.strip')) { S.strip.held = false; const id = S.strip; after(HOLD, () => { if (S.strip === id && !S.strip.held) dismissStrip(); }); }
  };
  const A11Y = Object.assign(document.createElement('p'), { id: 'a11y', className: 'sr' });
  A11Y.setAttribute('role', 'status'); A11Y.setAttribute('aria-live', 'polite');

  // ------------------------------------------------------------------------------------------------ harness
  function harness() {
    const h = document.getElementById('harness'); if (!h) return;
    const base = (st) => { const q = new URLSearchParams(location.search); q.set('state', st); q.delete('capture'); return '?' + q.toString(); };
    const states = ['conv', 'conv-strip-shared', 'shared-strip-qandeel', 'conv-strip-system', 'shared-inplace', 'conv-call', 'conv-call-security', 'conv-call-reminder', 'analysis', 'analysis-deferred', 'analysis-exit', 'analysis-call', 'analysis-call-security', 'analysis-call-reminder', 'activity', 'activity-stale', 'settings-root', 'notif', 'notif-lock', 'edu', 'edu-boundary', 'edu-notnow'];
    const tog = (k, v, label) => { const q = new URLSearchParams(location.search); if (q.get(k) === v) q.delete(k); else q.set(k, v); q.delete('capture'); return `<a href="?${q}" class="${new URLSearchParams(location.search).get(k) === v ? 'on' : ''}">${label}</a>`; };
    h.innerHTML = `<span class="flag">PROOF HARNESS — NOT PRODUCT UI</span><h1>P3-A Notification + Activity</h1>` +
      `<p>P3 is NOT CLOSED / NOT FROZEN. Every surface below is decided by the model (src/model.mjs).</p>` +
      `<h2>States</h2>${states.map((s) => `<a href="${base(s)}" class="${P.state === s ? 'on' : ''}">${s}</a>`).join('')}` +
      `<h2>Device stand-ins</h2>${tog('lang', 'en', 'English')}${tog('appearance', 'light', 'Light')}${tog('appearance', 'system', 'System')}${tog('rm', '1', 'Reduced Motion')}${tog('contrast', 'more', 'Increased contrast')}${tog('w', '320', '320 × 568')}${tog('w', '430', '430 × 932')}${tog('os', 'denied', 'OS denied')}${tog('intro', '0', 'Introductions not entered')}${tog('proactive', 'reduce', 'Proactive: Reduce')}${tog('entry', 'bell', 'Entry: Quiet Bell (history only)')}${tog('introglyph', 'door', 'Introductions mark: At the Door (comparison / history only)')}` +
      `<h2>Arrivals (foreground)</h2>${Object.keys(FX.EV).map((k) => `<button data-arrive="${k}">${k}</button>`).join('')}` +
      `<h2>Decisions</h2><pre>${esc(S.log.slice(0, 12).join('\n') || '—')}</pre>`;
  }

  // ------------------------------------------------------------------------------------------------ boot
  function boot() {
    const mount = document.getElementById('mount');
    mount.innerHTML = `<div id="phone" dir="${L.dir}" lang="${L.lang}" data-appearance="${P.appearance}" data-appearance-setting="${esc(P.appearanceSetting)}" data-contrast="${P.contrast}" data-lang="${P.lang}" data-rm="${P.rm ? 1 : 0}" style="--W:${P.w}px;--H:${P.h}px"><div id="g32host" hidden></div><div id="ui"></div></div>` + (P.capture ? '' : '<aside id="harness" class="harness"></aside>');
    if (!P.capture) document.body.classList.add('live');
    document.documentElement.lang = L.lang;
    const phone = document.getElementById('phone');
    phone.addEventListener('click', onClick); phone.addEventListener('pointerdown', down); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    addEventListener('keydown', onKey);
    phone.addEventListener('focusin', (e) => { if (S.strip && e.target.closest('.strip')) S.strip.held = true; });
    phone.addEventListener('focusout', (e) => { if (S.strip && e.target.closest('.strip') && !e.relatedTarget?.closest?.('.strip')) { S.strip.held = false; after(HOLD, () => { if (S.strip && !S.strip.held) dismissStrip(); }); } });
    document.addEventListener('click', (e) => { const a = e.target.closest('[data-arrive]'); if (a) arrive({ ...FX.EV[a.dataset.arrive] }); });
    const st = P.state;
    const setup = {
      conv: () => render(),
      'conv-strip-shared': () => { render(); arrive({ ...FX.EV.sharedReply }); },
      'shared-strip-qandeel': () => { S.place = 'shared'; S.here = 'w-summer'; render(); arrive({ ...FX.EV.proactive }); },
      'conv-strip-system': () => { render(); arrive({ ...FX.EV.security, actionable: true }); },
      'shared-inplace': () => { S.place = 'shared'; S.here = 'w-summer'; render(); arrive({ ...FX.EV.sharedReply }); },
      'conv-call': () => { S.call = true; S.feed.forEach((i) => { i.attention = 'seen'; i.actionable = false; }); render(); if (Q.get('arrive') !== '0') { arrive({ ...FX.EV.sharedReply }); arrive({ ...FX.EV.introProposal }); } },
      shared: () => { S.settings.os = 'not-requested'; S.place = 'shared'; S.here = 'w-summer'; render(); },   // first entry: permission not yet asked
      activity: () => { S.place = 'activity'; render(); scheduleSeen(); },
      'activity-stale': () => { S.place = 'activity'; S.staleOpen = 'F9'; render(); const r = document.querySelector('.row[data-id="F9"]'); const b = document.querySelector('.page .body'); if (r && b) b.scrollTop = r.offsetTop - 120; },
      'settings-root': () => { S.place = 'settings'; render(); },
      notif: () => { S.place = 'notif'; render(); },
      'notif-lock': () => { S.place = 'notif'; S.sheet = { kind: 'lock', subject: Q.get('subject') || 'intro' }; render(); },
      edu: () => { S.settings.os = 'not-requested'; S.place = 'shared'; S.here = 'w-summer'; render(); eduFor('shared-first-entry'); },
      'edu-boundary': () => { S.settings.os = 'not-requested'; S.place = 'shared'; S.here = 'w-summer'; S.osbox = true; render(); },
      'edu-notnow': () => { S.settings.os = 'not-requested'; S.place = 'shared'; S.here = 'w-summer'; S.eduDeclined = true; S.notNow = true; render(); },
      // ---- refinement §8: an active Live Call on the Conversation surface (G1.2: opening «المحادثة» does not end it)
      'conv-call-security': () => { callBase(); render(); arrive({ ...FX.EV.security }); },
      'conv-call-reminder': () => { callBase(); render(); arrive({ ...FX.EV.reminder }); },
      // ---- the Analysis (G3's own page in a frame; refinement §4.2 and §8)
      analysis: () => { S.place = 'analysis'; g32Frame(); render(); },
      'analysis-call': () => { callBase(); S.place = 'analysis'; g32Frame(); render(); },
    };
    // arrivals that need G3's measured chrome run once the frame is ready
    const later = {
      'analysis-call': () => { if (Q.get('arrive') !== '0') { arrive({ ...FX.EV.sharedReply }); arrive({ ...FX.EV.introProposal }); arrive({ ...FX.EV.proactive }); } },
      'analysis-call-security': () => arrive({ ...FX.EV.security }),
      'analysis-call-reminder': () => arrive({ ...FX.EV.reminder }),
      // final micro-refinement §5–§7: ordinary attention while the user is inside the Analysis (no call) — deferred, no
      // strip, no announcement; `analysis-exit` then leaves by «المحادثة» and the model re-evaluates (at most one strip).
      // ?arrive=reply keeps only the Shared reply; ?mute=<World> mutes that World before the user leaves.
      'analysis-deferred': () => analysisArrivals(),
      'analysis-exit': () => { analysisArrivals(); if (Q.get('mute')) S.settings.shared.muted.push(Q.get('mute')); back(); },
    };
    const analysisArrivals = () => { const ks = Q.get('arrive') === 'reply' ? ['sharedReply'] : ['sharedReply', 'publicReply', 'introProposal', 'proactive']; for (const k of ks) arrive({ ...FX.EV[k] }); };
    setup['analysis-call-security'] = setup['analysis-call-reminder'] = () => { callBase(); S.place = 'analysis'; g32Frame(); render(); };
    setup['analysis-deferred'] = setup['analysis-exit'] = () => { callBase(); S.call = false; S.place = 'analysis'; g32Frame(); render(); };
    (setup[st] || setup.conv)();
    if (P.defect === 'firstlaunch' && st === 'conv') { S.settings.os = 'not-requested'; S.sheet = { kind: 'edu', trigger: 'launch' }; render(); }
    if (P.defect === 'samectx' && st === 'shared-inplace') { S.inplace = null; showStrip({ ...FX.EV.sharedReply }, true); }
    if (Q.get('press') === 'entry') document.getElementById('act-entry')?.classList.add('down');
    if (P.capture) tick(1000); // settle entrances; the strip's hold (6 s) is still running
    Promise.all([document.fonts.ready, S.place === 'analysis' ? g32Ready : null]).then(() => {
      if (later[st]) { render(); later[st](); if (P.capture) tick(1000); }
      else if (S.place === 'analysis') render();
      phone.setAttribute('data-ready', '1');
    });
  }
  /** A Live Call already running: the older items are seen, so only what arrives now can change attention. */
  function callBase() { S.call = true; S.feed.forEach((i) => { i.attention = 'seen'; i.actionable = false; }); }

  // ------------------------------------------------------------------------------------------------ capture API
  window.P3 = {
    tick: (ms) => { tick(ms); return T; }, T: () => T, S, P, arrive: (k, o) => arrive({ ...FX.EV[k], ...(o || {}) }), endCall, eduFor, eduAllow, eduNotNow, dismissStrip, go, back, render,
    enterFirst: () => { const b = document.querySelector('.strip .go'); if (b) b.click(); },
    rects: (sel) => [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, id: e.id, cls: e.className?.baseVal ?? e.className, text: (e.textContent || '').trim().slice(0, 80) }; }),
    controls: () => [...document.querySelectorAll('#phone button, #phone [role="switch"], #phone [tabindex]:not([tabindex="-1"])')].filter((e) => (e.offsetParent !== null || e.getClientRects().length) && !e.closest('[inert]')).map((e) => {
      const r = e.getBoundingClientRect(); const lab = e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') ? document.getElementById(e.getAttribute('aria-labelledby'))?.textContent : '') || e.textContent.trim();
      const texts = [...e.querySelectorAll('span,p,b,bdi,strong')].filter((x) => [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).length;
      return { tag: e.tagName, role: e.getAttribute('role') || '', name: (lab || '').trim(), w: Math.round(r.width), h: Math.round(r.height), hidden: !!e.closest('[aria-hidden="true"]'), glued: !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && texts > 1 };
    }),
    decorative: () => [...document.querySelectorAll('#phone svg')].map((s) => ({ hidden: s.getAttribute('aria-hidden') === 'true' || !!s.closest('[aria-hidden="true"]'), labelled: !!s.getAttribute('aria-label') })),
    /** G3's own geometry, read from its own elements in the frame (never assumed), plus its own truth. */
    g32: () => {
      if (!G32) return null;
      const w = G32.contentWindow, t = w && w.__G32 ? w.__G32.truth() : {}, mic = G32.contentDocument.getElementById('mic');
      const line = mic && mic.parentElement ? (() => { const r = mic.parentElement.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom }; })() : null;
      return { state: G32.dataset.state, place: t.place, call: t.call, TM: t.TM, back: g32Rect('back'), replay: g32Rect('replay'), tl: g32Rect('tl-track'), live: g32Rect('tl-live'), band: g32Rect('band'), line, slot: chromeSlot() };
    },
  };
  boot();
})();
