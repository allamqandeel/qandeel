/* G3.2 — G3.1's integrated Product runtime with the two Product Owner decisions under proof (build.mjs D-A, D-B):
 *   D-A  applyAppearance(): the Analysis shell (status region, rail, call line, Replay action and entry, home
 *        indicator, the phone's ground) is dark while the Analysis is shown, under system Light as under Dark; the
 *        tone change is F2's 200 ms appearance cross-fade, a cut under Reduced Motion. No shell fixture remains.
 *   D-B  ctxContent() / renderCtx(): the concise temporal orientation line lives in the Timeline cluster, directly
 *        above the Track, only while temporal context exists (PINNED, or a preview); OrientationChrome keeps the
 *        inspection line and every Return act. bandRoom() pays for the line before the world's floor is touched.
 * Everything else is G3.1's, unchanged.
 *
 * G3.1 — the integrated Product runtime. Plain script, inlined by build.mjs. No framework, no dependency, no voice
 * runtime, no network.
 *
 * ONE state machine for the whole Product proof. Its parts come from sealed sources and keep their laws:
 *   - the Analysis (world, camera, Timeline, T-08 offered set, compact Return, Matching, Shared World birth / arrival,
 *     the D5 dark world) is the G2.3 runtime (app.js e2b507f5…), carried over function by function;
 *   - Writing, the Voice Note and the Live Call (call identity, connecting → live, the scripted speech, spoken-turn
 *     commits, the one assistive live-status channel, no persistent normal-state call prose) are ported from the
 *     FINAL R1-corrected G1.2 runtime (runtime.js 467f5b76…).
 *
 * What G3.1 joins, and nothing else (see build.mjs C1–C5):
 *   - every committed turn — written, a voice note, or a spoken turn of the call — is ONE Moment: the Timeline's live
 *     head advances and the Analysis changes only there (G1.2: "the Analysis changes only at spoken-turn commits");
 *   - the call survives Conversation ↔ Analysis with the same call id and the same Conversation id;
 *   - the chrome column is World → Timeline → OrientationChrome (T-11 §3, T-12 §5);
 *   - focus follows every place change; «طرق العودة» opened from the keyboard opens without animation.
 */
(function () {
  'use strict';
  var D = window.__G32DATA, LANG = window.__G32BOOT.lang;
  var L = D.langs[LANG].copy, TYP = D.langs[LANG].typing, SCRIPT = D.script;
  (function hydrate(o) {
    Object.keys(o).forEach(function (k) {
      var v = o[k];
      if (v && typeof v === 'object') {
        if (typeof v.tpl === 'string') o[k] = (function (t) { return function () { var a = arguments; return t.replace(/\{(\d)\}/g, function (_, i) { return a[+i]; }); }; })(v.tpl);
        else hydrate(v);
      }
    });
  })(L);
  var params = new URLSearchParams(location.search);
  var CAPTURE = params.get('capture') === '1';
  var RM = params.get('rm') === '1' || (!CAPTURE && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var root = document.getElementById('phone');
  var RTL = root.getAttribute('dir') === 'rtl';
  var HAS_MATCHING = !!L.matchCue;           // English: no Matching copy exists in canon → no Matching moment
  var $ = function (id) { return document.getElementById(id); };
  var WORLD_VP = { cx: 1300, cy: 730, field: 3600 };
  var FIELD_MIN = 640, FIELD_MAX = 3600;
  var PROVIDER = true;

  /* -------------------------------------------------------------------- clock and curve ---- */
  var vclock = 0;
  function now() { return CAPTURE ? vclock : performance.now(); }
  function bezier(p1x, p1y, p2x, p2y) {
    function a(a1, a2) { return 1 - 3 * a2 + 3 * a1; } function b(a1, a2) { return 3 * a2 - 6 * a1; } function c(a1) { return 3 * a1; }
    function calc(t, a1, a2) { return ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t; }
    function slope(t, a1, a2) { return 3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1); }
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1; var t = x;
      for (var i = 0; i < 8; i++) { var s = slope(t, p1x, p2x); if (Math.abs(s) < 1e-6) break; t -= (calc(t, p1x, p2x) - x) / s; }
      var lo = 0, hi = 1; for (var j = 0; j < 20 && Math.abs(calc(t, p1x, p2x) - x) > 1e-6; j++) { if (calc(t, p1x, p2x) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return calc(t, p1y, p2y);
    };
  }
  /* T-10's one curve. Durations are T-10 / G1.1 / G2.x values; G3.1 adds none. */
  var EASE = bezier(0.23, 1, 0.32, 1);
  var DUR = { resolve: 140, dock: 220, band: 220, bandOut: 140, depthOut: 200, depthIn: 320, depthInDelay: 100,
    markerLead: 200, markerTrail: 280, temporal: 160, menu: 180, cue: 280, beat: 110, stagger: 80, voice: 220,
    appearance: 200 };   // G3.2 D-A: F2's qandeel.appearance.switch.crossfade (200 ms; removed under Reduced Motion)

  var vals = {}, anims = {};
  function get(k) {
    var a = anims[k]; if (!a) return vals[k] == null ? 0 : vals[k];
    var p = (now() - a.start - (a.delay || 0)) / a.dur;
    if (p <= 0) return a.from; if (p >= 1) { vals[k] = a.to; delete anims[k]; return a.to; }
    return a.from + (a.to - a.from) * EASE(p);
  }
  function set(k, v) { delete anims[k]; vals[k] = v; }
  function to(k, v, dur, delay) { var cur = get(k); if (!dur || cur === v) { set(k, v); return; } anims[k] = { from: cur, to: v, start: now(), dur: dur, delay: delay || 0 }; vals[k] = v; kick(); }
  /* Reduced motion (T-10 / F1): travel and growth become a 140 ms resolve from (almost) nothing; a disappearance is a
     cut. The same state changes happen at the same instants — only their animation is simplified. */
  function go(k, v, dur, delay) { if (RM) { if (v > get(k)) { set(k, Math.max(get(k), 0.001)); to(k, v, DUR.resolve); } else set(k, v); } else to(k, v, dur, delay); }
  /* A colour blend is not motion: under reduced motion it is a cut (F2: no appearance cross-fade). */
  function blend(k, v, dur, delay) { if (RM) set(k, v); else to(k, v, dur, delay); }
  /* A pure displacement (the Timeline riding on the chrome): travel under standard motion, a cut under reduced. */
  function glide(k, v, dur) { if (RM) set(k, v); else to(k, v, dur); }
  function busy() { for (var k in anims) return true; return camAnim != null; }

  /* --------------------------------------------------------------------------- state ------- */
  var FIX = D.fixture;
  var S = {
    place: 'conversation',      // conversation | analysis | proposal | shared
    world: 'mine',              // the rail selection
    LH: FIX.builtAt, mode: 'FOLLOW_LIVE', tc: FIX.builtAt, ptc: null,
    cam: copyCam(WORLD_VP), IF: null, RH: [], journey: null, rhN: 0,
    call: 'none', callId: null, callSeq: 0, callStart: 0, liveAt: 0, muted: false, route: true, callStarts: 0, spoken: 0,
    convId: FIX.convId, composer: 'idle', noteStart: 0, sentN: 0, playing: null, playStart: 0,
    matching: 'none', who: 'A', whoPref: 'A', sharedHow: null, sharedExists: false,
    moreOpen: false, replayMenu: false, replayChosen: null, commits: [],
  };
  function copyCam(c) { return { cx: c.cx, cy: c.cy, field: c.field }; }
  function camEq(a, b) { return Math.abs(a.cx - b.cx) < 0.5 && Math.abs(a.cy - b.cy) < 0.5 && Math.abs(a.field - b.field) < 0.5; }
  function atWorld() { return camEq(S.cam, WORLD_VP); }
  function snapshot() { return { mode: S.mode, tc: S.tc, cam: copyCam(S.cam), IF: S.IF ? JSON.parse(JSON.stringify(S.IF)) : null }; }
  function append(act, pre) { S.RH.push({ id: ++S.rhN, act: act, captured: pre }); return S.RH[S.RH.length - 1]; }
  function journeyAlive() { return !!S.journey && S.RH.some(function (e) { return e.id === S.journey.originId; }); }

  /* The offered set: T-08 §6's table over this fixture, in the frozen order (orientation-chrome/types.ts). */
  var ORDER = ['BACK_ONE_STEP', 'EXACT_RETURN', 'RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'RETURN_WORLD', 'GO_LIVE_AND_LOCATE'];
  function offeredWhy() {
    return {
      BACK_ONE_STEP: S.RH.length > 0 ? 'the reader\'s own history holds ' + S.RH.length + ' reversible step(s)' : null,
      EXACT_RETURN: journeyAlive() ? 'an inspection journey origin was supplied and is still recorded' : null,
      RETURN_LIVE_HEAD: S.mode === 'PINNED' ? 'the committed stance is PINNED(' + S.tc + ')' : null,
      RETURN_LIVE_FOCUS: null, // G2.1 S-07: the fixture's Live Focus is an Emerging Focus; T-04 gives it no locus
      RETURN_WORLD: !atWorld() ? 'the camera is not at the World viewpoint' : null,
      GO_LIVE_AND_LOCATE: (S.mode === 'PINNED' && PROVIDER) ? 'PINNED and a live-context provider exists' : null,
    };
  }
  function offered() { var w = offeredWhy(); return ORDER.filter(function (id) { return !!w[id]; }); }

  /* ------------------------------------------------------------------------ the world ------ */
  var frame = $('world-frame'), stage = $('stage'), G = null, worldReady = false;
  var stageW = 0, stageH = 0, phoneW = 0, phoneH = 0;
  function b64bytes(b64) { var s = atob(b64), n = s.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = s.charCodeAt(i); return u; }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  /* G2 closure §C.5: one constant world scale; a larger phone shows MORE of the same world, never the same world larger. */
  var REF_H = 844;
  function layoutStage() {
    phoneW = root.clientWidth; phoneH = root.clientHeight;
    stageH = phoneH; stageW = Math.ceil(REF_H * 2100 / 1181);
    stage.style.width = stageW + 'px'; stage.style.height = stageH + 'px';
    stage.style.transform = 'translateX(' + ((phoneW - stageW) / 2).toFixed(2) + 'px)';
    frame.style.width = stageW + 'px'; frame.style.height = stageH + 'px';
  }
  function loadWorld() {
    layoutStage();
    var bytes = b64bytes(D.world.b64);
    return crypto.subtle.digest('SHA-256', bytes).then(function (h) {
      var got = hex(h).toUpperCase();
      D.world.verified = got === D.world.sha256; D.world.got = got;
      var shaEl = $('sha-state'); if (shaEl) shaEl.textContent = D.world.verified ? 'I-08B1 SHA-256 ' + got.slice(0, 16) + '… verified against the pin' : 'MISMATCH ' + got;
      if (!D.world.verified) throw new Error('canonical world bytes do not match the pinned SHA-256');
      return new Promise(function (res) { frame.addEventListener('load', res, { once: true }); frame.srcdoc = new TextDecoder('utf-8').decode(bytes); });
    }).then(function () {
      var w = frame.contentWindow, doc = frame.contentDocument;
      var faces = D.worldFonts.map(function (f) { return new w.FontFace('IBM Plex Sans Arabic', b64bytes(f.b64).buffer, { weight: String(f.weight), unicodeRange: f.unicodeRange, display: 'block' }); });
      faces.forEach(function (ff) { doc.fonts.add(ff); });
      return Promise.all(faces.map(function (ff) { return ff.load().catch(function () { return null; }); })).then(function () { return doc.fonts.ready; });
    }).then(function () {
      var doc = frame.contentDocument, sc = doc.createElement('script');
      sc.textContent = D.bridge; doc.body.appendChild(sc);
      G = frame.contentWindow.__g21;
      G.clean();
      if (RM) G.setReducedMotion(true);
      var sw = params.get('sweep');
      if (CAPTURE && sw !== '0') D.sweptSteps = G.sweep(+sw || 10);
      else if (!CAPTURE) idleSweep(+sw || 10);
      if (CAPTURE) frame.contentWindow.eval('invalidate=function(){loopOn=false};cancelAnimationFrame(raf);clearTimeout(tmo);raf=0;tmo=0;');
      worldReady = true;
      applyHistory(null);
      pushCamera(false);
    });
  }
  function idleSweep(n) {
    var i = 0, ric = window.requestIdleCallback || function (f) { return setTimeout(function () { f({ timeRemaining: function () { return 50; } }); }, 60); };
    (function step() { ric(function () { if (!G.sweepStep(i, n)) { D.sweptSteps = i + 1; return; } i++; step(); }); })();
  }
  var lastWorldKey = '';
  function pushCamera(moving) {
    if (!worldReady) return;
    var c = currentCam();
    if (CAPTURE) { var key = [c.cx.toFixed(3), c.cy.toFixed(3), c.field.toFixed(3), worldClockKey()].join(','); if (key !== lastWorldKey) { lastWorldKey = key; G.render(c, vclock); } }
    else G.setCamera(c, moving);
  }
  var worldAnimUntil = 0, histKey = '';
  function worldClockKey() { return vclock < worldAnimUntil ? vclock.toFixed(1) : 'settled@' + histKey; }
  function effectiveTC() { return S.ptc != null ? S.ptc : S.tc; }
  /* The historical firewall: the world is replayed only up to the effective TC. Nothing later is ever drawn. */
  function applyHistory(animateSps) {
    if (!worldReady) return;
    var k = effectiveTC(), animate = {};
    (animateSps || []).forEach(function (sp) { animate[sp] = now(); });
    var key = k + '|' + JSON.stringify(animateSps || []) + '|' + (animateSps && animateSps.length ? now() : '');
    if (key === histKey) return;
    histKey = key;
    S.fired = G.replay(FIX.history, k, { animate: animate });
    if (animateSps && animateSps.length) worldAnimUntil = now() + 1600;
    lastWorldKey = '';
    pushCamera(false);
  }

  /* ------------------------------------------------------------------------ the camera ----- */
  var camAnim = null;
  function camBounds(field) {
    var halfW = field * (phoneW / stageW) / 2, halfH = field * (phoneH / stageW) / 2;
    var gx = Math.max(0, 1800 - halfW), gy = Math.max(0, (3600 * 1181 / 2100) / 2 - halfH);
    return { x0: WORLD_VP.cx - gx, x1: WORLD_VP.cx + gx, y0: WORLD_VP.cy - gy, y1: WORLD_VP.cy + gy };
  }
  function clampCam(c) {
    var f = Math.min(FIELD_MAX, Math.max(FIELD_MIN, c.field)), b = camBounds(f);
    return { cx: Math.min(b.x1, Math.max(b.x0, c.cx)), cy: Math.min(b.y1, Math.max(b.y0, c.cy)), field: f };
  }
  function currentCam() {
    if (!camAnim) return S.cam;
    var p = (now() - camAnim.t0) / camAnim.dur;
    if (p >= 1) { camAnim = null; return S.cam; }
    var e = EASE(Math.max(0, p)), a = camAnim.from, b = camAnim.to;
    return { cx: a.cx + (b.cx - a.cx) * e, cy: a.cy + (b.cy - a.cy) * e, field: Math.exp(Math.log(a.field) + (Math.log(b.field) - Math.log(a.field)) * e) };
  }
  /* Semantic zoom is distance: one camera travelling through one world (T-10: nothing teleports). */
  function travelTo(dest) {
    var from = currentCam(), to2 = clampCam(dest);
    S.cam = to2;
    if (camEq(from, to2)) { camAnim = null; return 0; }
    if (RM) { camAnim = null; set('world-resolve', 0.001); to('world-resolve', 1, DUR.resolve); pushCamera(false); return DUR.resolve; }
    var d = Math.abs(Math.log(to2.field / from.field)) + Math.hypot(to2.cx - from.cx, to2.cy - from.cy) / (from.field * phoneW / stageW);
    var dur = Math.round(Math.min(540, Math.max(260, 260 + 150 * d)));
    camAnim = { from: from, to: to2, t0: now(), dur: dur };
    kick();
    return dur;
  }

  /* ------------------------------------------------------------------------ Return acts ---- */
  function actCameraGesture(pre) { if (!camEq(pre.cam, S.cam)) append('MAP_CAMERA', pre); render(); }
  function actInspect(hit) {
    var pre = snapshot();
    S.IF = { index: hit.index, family: hit.focus ? FIX.focusFamily : FIX.kindFamily[hit.kind], label: hit.label, focus: hit.focus };
    var e = append('INSPECT_OBJECT', pre);
    if (!pre.IF) S.journey = { originId: e.id };
    render();
  }
  function restore(c) {
    S.mode = 'PINNED'; S.tc = c.tc; S.ptc = null;
    S.IF = c.IF; if (!S.IF) S.journey = null;
    travelTo(c.cam); applyHistory(null);
  }
  var ACTS = {
    BACK_ONE_STEP: function () { var e = S.RH.pop(); if (e) restore(e.captured); },
    EXACT_RETURN: function () {
      var i = S.RH.findIndex(function (e) { return S.journey && e.id === S.journey.originId; }); if (i < 0) return;
      var e = S.RH[i]; S.RH.length = i; restore(e.captured);
    },
    RETURN_LIVE_HEAD: function () {
      if (S.mode === 'FOLLOW_LIVE') return;
      var pre = snapshot(), from = S.tc; S.mode = 'FOLLOW_LIVE'; S.tc = S.LH; S.ptc = null; append('RETURN_LIVE_HEAD', pre);
      applyHistory(arrivalsBetween(from, S.LH));
    },
    RETURN_LIVE_FOCUS: function () { /* never offered in this fixture (S-07) */ },
    RETURN_WORLD: function () { if (atWorld()) return; var pre = snapshot(); travelTo(WORLD_VP); append('RETURN_WORLD', pre); },
    GO_LIVE_AND_LOCATE: function () {
      var pre = snapshot(), from = S.tc; S.mode = 'FOLLOW_LIVE'; S.tc = S.LH; S.ptc = null;
      append('GO_LIVE_AND_LOCATE', pre);
      applyHistory(arrivalsBetween(from, S.LH));
    },
  };
  function arrivalsBetween(from, toSp) { return FIX.history.filter(function (e) { return e.sp > from && e.sp <= toSp; }).map(function (e) { return e.sp; }); }
  function doReturn(id) {
    if (offered().indexOf(id) < 0) return;
    var a = document.activeElement, fromChrome = !!(a && a.closest && (a.closest('#band') || a.id === 'tl-live'));
    S.moreOpen = false; ACTS[id](); render(); log('act ' + id);
    if (fromChrome && !CAPTURE) refocusChrome(id);
  }
  /* The chrome re-renders after an act; a keyboard or screen-reader reader must not be dropped onto the page. Focus
     goes to the same act if it is still offered, else «طرق العودة», else the chrome's first act, else the world. */
  function refocusChrome(id) {
    var a = document.activeElement;
    if (a && a !== document.body && document.contains(a) && a.offsetParent) return;
    var t = document.querySelector('#band [data-act="' + id + '"]') || $('more-t') || document.querySelector('#band [data-act]') || $('gesture');
    if (t) t.focus();
  }
  /* Every committed turn is ONE Moment. The Analysis changes only here, by at most one canonical event (FIXTURE). */
  function commitTurn(source) {
    S.LH += 1; S.commits.push({ sp: S.LH, source: source, callId: source === 'spoken' ? S.callId : null });
    if (S.mode === 'FOLLOW_LIVE') { S.tc = S.LH; applyHistory(arrivalsBetween(S.LH - 1, S.LH)); }
    log('committed ' + source + ' turn → LH ' + S.LH + (S.mode === 'PINNED' ? ' (PINNED: the view does not move)' : ''));
  }
  function previewAt(sp) { var lo = FIX.builtAt, hi = disclosedCount(); sp = Math.max(lo, Math.min(hi, sp)); if (S.ptc === sp) return; S.ptc = sp; applyHistory(null); render(); }
  function commitPreview() { if (S.ptc == null) return; var pre = snapshot(), sp = S.ptc; S.ptc = null; S.mode = 'PINNED'; S.tc = sp; append('TEMPORAL_COMMIT', pre); applyHistory(null); set('tl-active', 0); render(); log('pinned at ' + sp); }
  function cancelPreview() { if (S.ptc == null) return; S.ptc = null; applyHistory(null); go('tl-active', 0, DUR.temporal); render(); }
  /* «طرق العودة». Opening adds rows to OrientationChrome; it never changes the offered set. From the keyboard it opens
     at once — a keyboard act is not animated (emil-design-eng) — from a pointer the disclosed acts fade in. */
  function toggleMore(instant) {
    if (S.place !== 'analysis') return;
    S.moreOpen = !S.moreOpen;
    if (S.moreOpen) { if (instant) set('more', 1); else { set('more', 0); go('more', 1, DUR.band); } }
    render(); log('«' + L.revealReturns.text + '» ' + (S.moreOpen ? 'opened' : 'closed'));
    revealDisclosed();
  }
  /* When OrientationChrome scrolls in its own room (T-11 §3), opening «طرق العودة» brings its row to the top of that
     room so the disclosed acts are in view beside their trigger; closing returns to the start. */
  function revealDisclosed() {
    var b = $('band'), t = $('more-t'); if (!b || !t) return;
    if (!S.moreOpen) { b.scrollTop = 0; bandScrollState(); return; }
    if (b.scrollHeight > b.clientHeight + 1) { var r = t.getBoundingClientRect(), br = b.getBoundingClientRect(); b.scrollTop += r.top - br.top - 2; }
    bandScrollState();
  }

  /* ---------------------------------------------------------------------- places ----------- */
  function wantDock() { return (S.place === 'conversation' || S.call !== 'none' || S.composer !== 'idle') ? 0 : 1; }
  /* Focus follows a place change. The destination fades in over T-10's delay, and a control is not focusable while it is
     still visibility:hidden — so focus is placed the moment the destination becomes focusable (found by the G3.1 live
     check: moved at once, the focus stayed on the doorway that had just been hidden). */
  function focusable(e) { if (!e || e.offsetParent === null) return false; for (var p = e; p && p !== root; p = p.parentElement) { if (getComputedStyle(p).visibility === 'hidden') return false; } return true; }
  function focusLater(id) {
    if (CAPTURE) return;
    var t0 = performance.now();
    (function tryFocus() { var e = typeof id === 'string' ? $(id) : id; paint(); if (focusable(e)) { e.focus(); return; } if (performance.now() - t0 < 900) setTimeout(tryFocus, 30); })();
  }
  function enterAnalysis() {
    if (S.place !== 'conversation') return; closeMenu(true);
    var hadDoor = document.activeElement === $('door');
    S.place = 'analysis';
    if (RM) { set('depth-out', 1); set('depth-in', 0.001); to('depth-in', 1, DUR.resolve); }
    else { to('depth-out', 1, DUR.depthOut); to('depth-in', 1, DUR.depthIn, DUR.depthInDelay); }
    blend('bgd', 1, DUR.appearance);                                 // G3.2 D-A: the Analysis shell is dark
    go('dock', wantDock(), DUR.dock);
    render(); log('Conversation → Analysis' + (S.call !== 'none' ? ' (same call ' + S.callId + ')' : ''));
    if (hadDoor) focusLater('back');
  }
  function leaveAnalysis() {
    if (S.place !== 'analysis') return; closeMenu(true);
    var hadBack = document.activeElement === $('back');
    S.place = 'conversation'; S.moreOpen = false;
    if (RM) { set('depth-in', 0); set('depth-out', 0.999); to('depth-out', 0, DUR.resolve); }
    else { to('depth-in', 0, DUR.depthOut); to('depth-out', 0, DUR.depthIn, DUR.depthInDelay); }
    blend('bgd', 0, DUR.appearance);                                 // G3.2 D-A: the Conversation follows the system
    go('dock', wantDock(), DUR.dock, RM ? 0 : 60);
    render(); log('Analysis → Conversation' + (S.call !== 'none' ? ' (the call continues: ' + S.callId + ')' : ''));
    if (hadBack) focusLater('door');
  }

  /* ---------------------------------------------------------------- Writing (G1.2 R1) ------- */
  var input = $('input');
  function syncSend() { $('composer').classList.toggle('has-text', input.value.trim().length > 0); }
  function thread() { return document.querySelector('#conv .new'); }
  function scrollEnd() { var sc = $('scroll'); if (sc) sc.scrollTop = sc.scrollHeight; }
  function send() {
    var v = input.value.trim(); if (!v || S.place !== 'conversation' || S.composer !== 'idle') return;
    var t = document.createElement('div'), sr = document.createElement('span'), p = document.createElement('p');
    t.className = 't me'; t.setAttribute('data-who', 'me'); t.setAttribute('data-kind', 'text');
    sr.className = 'sr'; sr.textContent = L.speakerMe.text + ': ';
    p.className = 'tx r-body'; p.setAttribute('dir', paragraphDir(v, root.getAttribute('dir'))); p.textContent = v;
    t.appendChild(sr); t.appendChild(p); thread().appendChild(t);
    input.value = ''; syncSend(); scrollEnd();
    commitTurn('written'); render();
  }

  /* ---------------------------------------------------- Voice Note: Conversation-first ------ */
  function startNote() {
    if (S.composer !== 'idle' || S.call !== 'none' || S.place !== 'conversation') return;
    stopPlay(); S.composer = 'note'; S.noteStart = now();
    go('voice', 1, DUR.voice); render(); announce(L.recording.text); log('voice note: capturing (the reader stays in the Conversation)');
    focusLater('note-send');
  }
  function endNote() { S.composer = 'idle'; go('voice', 0, DUR.voice); go('dock', wantDock(), DUR.dock); }
  function noteMs() { return S.composer === 'note' ? now() - S.noteStart : 0; }
  function sendNote() {
    if (S.composer !== 'note') return;
    var ms = Math.max(1000, Math.round(noteMs() / 1000) * 1000);
    endNote();
    var t = document.createElement('div'); t.className = 't me voice'; t.setAttribute('data-who', 'me'); t.setAttribute('data-kind', 'voice');
    t.setAttribute('data-dur', String(ms)); t.setAttribute('data-vn', 's' + (++S.sentN));
    t.innerHTML = '<span class="sr"></span>' + D.voiceRow + '<p class="vk r-meta"></p>';
    t.querySelector('.sr').textContent = L.speakerMe.text + ': ';
    t.querySelector('.play').setAttribute('aria-label', L.play.text + (RTL ? '، ' : ', ') + mmss(ms));
    t.querySelector('.dur').textContent = mmss(ms);
    t.querySelector('.vk').textContent = L.voiceNote.text;
    thread().appendChild(t); scrollEnd();
    commitTurn('voice-note'); render(); announce('');
    focusLater('mic');
  }
  function cancelNote() { if (S.composer !== 'note') return; endNote(); render(); announce(''); focusLater('mic'); log('voice note discarded — nothing added'); }
  function togglePlay(t) {
    var v = t.getAttribute('data-vn'); if (S.playing === v) { stopPlay(); render(); return; }
    stopPlay(); if (S.call !== 'none' || S.composer !== 'idle') return;
    S.playing = v; S.playStart = now(); render();
  }
  function stopPlay() { if (S.playing === null) return; var t = turnByVn(S.playing); S.playing = null; if (t) { var f = t.querySelector('.fill'); if (f) f.style.width = '0'; } }
  function turnByVn(v) { return document.querySelector('#conv .t[data-vn="' + v + '"]'); }

  /* ------------------------------------ Live Call: Analysis-first; ONE call across surfaces ---- */
  function startCall() {
    if (S.call !== 'none' || S.composer !== 'idle') return;
    closeMenu(true); stopPlay();
    S.callSeq++; S.callStarts++; S.callId = 'call-' + (0x3f9a00 + S.callSeq * 0x1b7).toString(16);
    S.call = 'connecting'; S.muted = false; S.route = true; S.callStart = now(); S.liveAt = 0; S.spoken = 0;
    callMarker();
    go('voice', 1, DUR.voice);
    if (S.place === 'conversation') enterAnalysis(); else go('dock', wantDock(), DUR.dock);
    render(); log('call ' + S.callId + ': connecting — Analysis-first');
    focusLater('mute');                                          // the same slot the call button occupied
  }
  function endCall() {
    if (S.call === 'none') return;
    var ms = S.liveAt ? now() - S.liveAt : 0, id = S.callId;
    S.call = 'none'; S.muted = false;
    var m = $('call-marker'); if (m) { m.textContent = L.callRecord.text + ' · ' + mmss(ms); m.removeAttribute('id'); m.setAttribute('data-call', id); }
    go('voice', 0, DUR.voice); go('dock', wantDock(), DUR.dock, RM ? 0 : 120);
    render(); log('call ' + id + ' ended by the reader after ' + mmss(ms));
    focusLater(S.place === 'conversation' ? 'call' : 'back');
  }
  function callMarker() {
    var p = document.createElement('p'); p.className = 'day r-meta callm'; p.id = 'call-marker';
    p.textContent = L.callStarted.text + ' 9:41';
    thread().appendChild(p); scrollEnd();
  }
  function callT() { return S.call === 'live' ? now() - S.liveAt : 0; }
  function speakingAt(ct) {
    if (S.muted) return 'none';
    var pos = ct % SCRIPT.cycleMs, segs = SCRIPT.segments;
    for (var k = 0; k < segs.length; k++) if (pos >= segs[k].from && pos < segs[k].to) return segs[k].who;
    return 'none';
  }
  function speaking() { return S.call === 'live' ? speakingAt(callT()) : 'none'; }
  function commitsNow() {
    if (S.call !== 'live') return S.spoken;
    var ct = callT(), cyc = Math.floor(ct / SCRIPT.cycleMs), pos = ct % SCRIPT.cycleMs, n = cyc * SCRIPT.commits.length;
    for (var i = 0; i < SCRIPT.commits.length; i++) if (pos >= SCRIPT.commits[i]) n++;
    return n;
  }
  /* Visible words only where a state needs explaining (G1.2 closure §4): capture, connecting. Never "mic on". */
  function lineLabel() { return S.composer === 'note' ? L.recording.text : S.call === 'connecting' ? L.connecting.text : ''; }
  /* The ONE assistive live-status channel for call state (G1.2 closure §4, R1). */
  function callA11yLabel() {
    if (S.call === 'connecting') return L.connecting.text;
    if (S.call === 'live') return S.muted ? L.muted.text : speaking() === 'q' ? L.qSpeaking.text : L.micOn.text;
    return '';
  }

  /* -------------------------------------------------------------- Matching (G2.2 / G2.3) ---- */
  function cueKind() { return S.matching === 'available' ? 'awaiting' : S.matching === 'arrived' ? 'arrival' : S.matching === 'ended' ? 'ended' : null; }
  function arrive() { set('cue', 0); go('cue', 1, DUR.cue); }
  /* M1 — QANDEEL surfaces a bounded proposal (AWAITING_YOU): one quiet line outside the world. It is not offered in
     English (no copy exists), and not during a Live Call (the choreography of that moment is undesigned — G3 finding). */
  function showCue() {
    if (!HAS_MATCHING) { log('no Matching moment in English: no English Matching copy exists (OPEN COPY)'); return; }
    if (S.call !== 'none') { log('proof boundary: Matching attention during a Live Call is not designed (G3.1 finding F-05)'); return; }
    if (S.matching !== 'none') return; S.matching = 'available'; arrive(); render(); log('matching: AWAITING_YOU — the cue');
  }
  function openProposal() {
    if (S.matching !== 'available' && S.matching !== 'unavailable') return; closeMenu(true);
    if (S.matching === 'available') S.matching = 'reviewing';
    S.place = 'proposal'; S.moreOpen = false; $('prop-scroll').scrollTop = 0;
    if (RM) { set('prop-out', 1); set('prop-in', 0.001); to('prop-in', 1, DUR.resolve); }
    else { to('prop-out', 1, DUR.depthOut); to('prop-in', 1, DUR.depthIn, DUR.depthInDelay); }
    blend('bgd', 0, DUR.depthIn, DUR.depthInDelay);
    render(); log('matching: the private proposal (' + (S.who === 'A' ? 'first accepter' : 'second accepter') + ')');
    focusLater('prop-back');
  }
  function closeProposal() {
    if (S.place !== 'proposal') return;
    S.place = 'analysis';
    if (S.matching === 'reviewing') S.matching = 'available';
    else if (S.matching === 'unavailable') S.matching = 'none';
    if (RM) { set('prop-in', 0); set('prop-out', 0.999); to('prop-out', 0, DUR.resolve); }
    else { to('prop-in', 0, DUR.depthOut); to('prop-out', 0, DUR.depthIn, DUR.depthInDelay); }
    blend('bgd', 1, DUR.depthOut);
    render(); log('matching: back to the Analysis (' + S.matching + ')');
    var cueBack = $('cue'); focusLater(cueBack && !cueBack.hidden ? 'cue' : 'gesture');
  }
  function proceed() {
    if (S.matching !== 'reviewing') return;
    if (S.who === 'A') { S.matching = 'forwarded'; set('ack', 0); go('ack', 1, DUR.band); render(); log('matching: first accepter — received; nothing about the other side is shown'); focusLater('prop-back'); return; }
    mutualMatchNow();
  }
  function notNow() { if (S.matching !== 'reviewing') return; S.matching = 'none'; closeProposal(); S.matching = 'none'; render(); log('matching: CLOSED_BY_YOU'); }
  function becomeUnavailable() {
    if (S.matching === 'reviewing' || (S.matching === 'available' && S.place === 'proposal')) { S.matching = 'unavailable'; render(); log('matching: NO_LONGER_AVAILABLE (in the proposal)'); return; }
    if (S.matching === 'available') { S.matching = 'none'; set('cue', 0); render(); log('matching: NO_LONGER_AVAILABLE before it was opened — the cue leaves'); return; }
    if (S.matching === 'forwarded') { S.matching = 'ended'; if (S.place === 'analysis') arrive(); render(); log('matching: NO_LONGER_AVAILABLE — the first accepter is told, in the same words'); }
  }
  function dismissEnded() { if (S.matching !== 'ended') return; S.matching = 'none'; set('cue', 0); render(); log('matching: ended notice dismissed'); }
  /* M5 — the SECOND accepter's «أكمّل» IS the Mutual Match: one atomic commit creates exactly one SHARED_WORLD /
     INTRODUCTION (I-07C). The proposal dissolves; a beat; the rail marker travels; the World RISES; the welcome after. */
  function mutualMatchNow() {
    S.matching = 'born'; S.world = 'shared'; S.place = 'shared'; S.sharedHow = 'born'; S.sharedExists = true;
    var bx = railBox('shared');
    set('welcome', 0); set('birth', 0);
    if (RM) { set('priv-out', 1); set('birth', 0.001); to('birth', 1, DUR.resolve); set('welcome', 0.001); to('welcome', 1, DUR.resolve); set('mx1', bx.x1); set('mx2', bx.x2); }
    else {
      to('priv-out', 1, DUR.depthOut);
      var goingEnd = bx.x1 < get('mx1');
      to('mx1', bx.x1, goingEnd ? DUR.markerLead : DUR.markerTrail, DUR.depthOut);
      to('mx2', bx.x2, goingEnd ? DUR.markerTrail : DUR.markerLead, DUR.depthOut);
      to('birth', 1, DUR.depthIn, DUR.depthOut + DUR.beat);
      to('welcome', 1, DUR.cue, DUR.depthOut + DUR.beat + DUR.stagger);
    }
    render(); log('MUTUAL MATCH (second accepter) → SHARED_WORLD / INTRODUCTION born now');
    focusLater('s-title');
  }
  /* M6 — the FIRST accepter, later: the Match was committed by the other side; a new truth, not a replay. */
  function matchArrives() {
    if (!HAS_MATCHING) { log('no Matching moment in English (OPEN COPY)'); return; }
    if (S.matching !== 'forwarded' && S.matching !== 'none') return;
    S.matching = 'arrived'; S.sharedExists = true; if (S.place === 'analysis') arrive();
    render(); log('MATCH_CONCLUDED (first accepter) — the Shared World already exists');
  }
  /* Entering a World that already exists is ordinary navigation: no rise, no stagger, no birth. */
  function enterShared() {
    if (S.matching !== 'arrived') return; closeMenu(true);
    S.matching = 'entered'; S.sharedHow = 'entered';
    goShared();
    log('first accepter enters the existing Shared World');
  }
  function goShared() {
    var from = S.place;
    S.world = 'shared'; S.place = 'shared'; if (!S.sharedHow) S.sharedHow = 'entered'; S.moreOpen = false; S.lastMine = from;
    var bx = railBox('shared');
    set('welcome', 1); set('birth', 0); set('priv-out', 0);
    if (RM) { set(from === 'analysis' ? 'ana-out' : 'conv-out', 1); set('shared-in', 0.001); to('shared-in', 1, DUR.resolve); set('mx1', bx.x1); set('mx2', bx.x2); }
    else {
      to(from === 'analysis' ? 'ana-out' : 'conv-out', 1, DUR.depthOut);
      var goingEnd = bx.x1 < get('mx1');
      to('mx1', bx.x1, goingEnd ? DUR.markerLead : DUR.markerTrail);
      to('mx2', bx.x2, goingEnd ? DUR.markerTrail : DUR.markerLead);
      to('shared-in', 1, DUR.depthIn, DUR.depthInDelay);
    }
    blend('bgd', 0, DUR.depthIn, DUR.depthInDelay);
    go('dock', wantDock(), DUR.dock);
    render(); focusLater('s-title');
  }
  /* Back to MY_WORLD through the rail: to the surface the reader left (Personal worlds are untouched by the Match). */
  function goMine() {
    if (S.place !== 'shared') return;
    var back = S.lastMine === 'conversation' ? 'conversation' : 'analysis';
    S.world = 'mine'; S.place = back;
    var bx = railBox('mine');
    if (RM) { set('shared-in', 0); set('birth', 0); set('ana-out', 0); set('conv-out', 0); set('prop-in', 0); set('prop-out', 0); set('priv-out', 0); set('mx1', bx.x1); set('mx2', bx.x2); }
    else {
      set('birth', 0); set('prop-in', 0); set('prop-out', 0); set('priv-out', 0);
      if (S.sharedHow === 'born') set('shared-in', 1);
      S.sharedHow = 'entered';
      to('shared-in', 0, DUR.depthOut); to('ana-out', 0, DUR.depthIn, DUR.depthInDelay); to('conv-out', 0, DUR.depthIn, DUR.depthInDelay);
      var goingEnd = bx.x1 < get('mx1');
      to('mx1', bx.x1, goingEnd ? DUR.markerLead : DUR.markerTrail); to('mx2', bx.x2, goingEnd ? DUR.markerTrail : DUR.markerLead);
    }
    S.sharedHow = 'entered';
    if (back === 'analysis') { set('depth-in', 1); set('depth-out', 1); blend('bgd', 1, DUR.depthOut); }
    else { set('depth-in', 0); set('depth-out', 0); }
    go('dock', wantDock(), DUR.dock);
    render(); log('rail → «' + L.nav.items[0].text + '» (' + back + ')');
    focusLater(back === 'analysis' ? 'back' : 'door');
  }

  /* -------------------------------------------- Replay: an action on this context (G1.1) ---- */
  function replayEligible() { return S.place === 'conversation' || S.place === 'analysis'; }
  function menuItems() { return Array.prototype.slice.call(document.querySelectorAll('#rmenu .mi')); }
  function openMenu() {
    if (!replayEligible() || S.replayMenu) return;
    S.replayMenu = true; set('menu', 0); go('menu', 1, DUR.menu); render(); log('Replay entry opened (' + S.place + (S.call !== 'none' ? ', during ' + S.callId : '') + ')');
    if (!CAPTURE) setTimeout(function () { var f = menuItems()[0]; if (f) f.focus(); }, 0);
  }
  function closeMenu(silent) { if (!S.replayMenu) return; S.replayMenu = false; set('menu', 0); render(); if (!silent && !CAPTURE) $('replay').focus(); }
  /* The entry is the boundary: the Replay player is not built (QAN-BL-NAV-02) and Personal call audio is not a source
     (QAN-BL-VOICE-01). Choosing records the derived request and returns the reader to where they were. */
  function chooseReplay(scope) {
    S.replayChosen = { scope: scope, place: S.place, TM: S.mode, TC: S.tc, LH: S.LH, conversation: S.convId, callExcluded: S.call !== 'none' || S.callStarts > 0 };
    closeMenu(false); render();
    log('PROOF BOUNDARY — Replay requested (' + scope + ') for ' + S.convId + '; the Replay player is not part of this proof');
  }

  /* -------------------------------------------------------------------------- rendering ----- */
  var raf = 0;
  function kick() { if (CAPTURE || raf) return; raf = requestAnimationFrame(function () { raf = 0; tick(); paint(); if (busy() || S.call !== 'none' || S.composer === 'note' || S.playing !== null) kick(); }); }
  function tick() {
    if (S.call === 'connecting' && now() - S.callStart >= SCRIPT.connectMs) { S.call = 'live'; S.liveAt = S.callStart + SCRIPT.connectMs; render(); log('call ' + S.callId + ': live'); }
    if (S.call === 'live') { var n = commitsNow(); var changed = false; while (S.spoken < n) { S.spoken++; commitTurn('spoken'); changed = true; } if (changed) render(); }
    if (S.playing !== null) { var t = turnByVn(S.playing), dur = t ? +t.getAttribute('data-dur') : 0; if (!t || now() - S.playStart >= dur) { stopPlay(); render(); } }
    var a = callA11yLabel(), ce = $('call-a11y'); if (ce.textContent !== a) ce.textContent = a;
  }
  function railBox(key) {
    var btn = document.querySelector('#rail .it[data-world="' + key + '"] .lb'), r = btn.getBoundingClientRect(), rr = $('rail').getBoundingClientRect();
    return { x1: r.left - rr.left, x2: r.right - rr.left };
  }
  function mmss(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  var liveAnn = null;
  function announce(t) { if (!liveAnn) { liveAnn = document.createElement('p'); liveAnn.className = 'sr'; liveAnn.setAttribute('aria-live', 'polite'); root.appendChild(liveAnn); } liveAnn.textContent = ''; var x = t; setTimeout(function () { liveAnn.textContent = x; }, 30); }

  function render() {
    root.setAttribute('data-place', S.place);
    root.setAttribute('data-call', S.call);
    root.setAttribute('data-composer', S.composer);
    root.setAttribute('data-mode', S.mode);
    root.setAttribute('data-preview', S.ptc != null ? '1' : '0');
    root.setAttribute('data-matching', S.matching);
    $('back').setAttribute('aria-label', S.call !== 'none' ? L.backNameCall.text : L.backName.text);
    if (S.call !== 'none') $('door').setAttribute('aria-label', L.doorNameCall.text); else $('door').removeAttribute('aria-label');
    $('replay').hidden = !replayEligible();
    $('replay').setAttribute('aria-expanded', S.replayMenu ? 'true' : 'false');
    $('rmenu').hidden = !S.replayMenu;
    $('rmenu-note').hidden = S.call === 'none';                     // G1.2 R1: said while a call is ongoing
    renderBand();
    renderTimeline();
    tick();
    var lb = lineLabel(); if ($('vlabel').textContent !== lb) $('vlabel').textContent = lb;
    /* P2-A Calm State Morphing: the slash and its negative-space cut are drawn together (180 ms, T-10's curve); the route
       fills its body and draws its outer wave together. Drawing a line is not travel, so it is kept under Reduced Motion
       (F1: keep level, ink and draw; drop travel, contraction, scale and blur). */
    if ((S.muted ? 1 : 0) !== vals['mute-p']) to('mute-p', S.muted ? 1 : 0, 180);
    if ((S.route ? 1 : 0) !== vals['route-p']) to('route-p', S.route ? 1 : 0, 180);
    $('mute').setAttribute('aria-pressed', S.muted ? 'true' : 'false');
    $('mute').setAttribute('aria-label', S.muted ? L.unmute.text : L.mute.text);
    $('route').setAttribute('aria-pressed', S.route ? 'true' : 'false');
    Array.prototype.forEach.call(document.querySelectorAll('#rail .it'), function (b) {
      var sel = b.getAttribute('data-world') === S.world; b.classList.toggle('sel', sel); if (sel) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    Array.prototype.forEach.call(document.querySelectorAll('#conv .t[data-vn]'), function (t) {
      var b = t.querySelector('.play'), on = S.playing === t.getAttribute('data-vn'), dur = +t.getAttribute('data-dur');
      b.setAttribute('data-playing', on ? '1' : '0'); b.setAttribute('aria-label', (on ? L.pause.text : L.play.text) + (RTL ? '، ' : ', ') + mmss(dur));
    });
    var cue = $('cue');
    if (cue) {
      var k = cueKind();
      cue.hidden = !(k && S.place === 'analysis');
      if (k) {
        var line = k === 'awaiting' ? L.matchCue.text : k === 'arrival' ? L.arrivalLine.text : L.unavailable.text;
        var act = k === 'awaiting' ? L.matchCueAct.text : k === 'arrival' ? L.arrivalAct.text : L.endedAct.text;
        var cl = $('cue-line');
        if (cl.getAttribute('data-k') !== k) {
          cl.setAttribute('data-k', k);
          /* The approved opening message is two sentences; each starts its own line and together they read exactly. */
          var cut = k === 'awaiting' ? line.indexOf('. ') : -1;
          if (cut > 0) cl.innerHTML = '<span class="cue-s1">' + esc(line.slice(0, cut + 1)) + '</span> <span class="cue-s2">' + esc(line.slice(cut + 2)) + '</span>';
          else cl.textContent = line;
        }
        if ($('cue-act').textContent !== act) $('cue-act').textContent = act;
        cue.setAttribute('aria-label', line + ' ' + act);
        cue.setAttribute('data-kind', k);
        if (!cue.hidden) root.style.setProperty('--cue-h', cue.offsetHeight + 'px');
      }
    }
    if ($('proposal')) {
      var gone = S.matching === 'unavailable';
      $('prop-view').hidden = gone; $('prop-gone').hidden = !gone; $('prop-foot').hidden = gone;
      var decided = S.matching === 'forwarded' || S.matching === 'born';
      var next = S.who === 'A' ? L.propNextA.text : L.propNextB.text;
      if ($('prop-next').textContent !== next) $('prop-next').textContent = next;
      $('prop-next').hidden = decided; $('prop-actions').hidden = decided;
      $('prop-ack').hidden = S.matching !== 'forwarded';
      var day = L.sharedToday(S.sharedHow === 'born' ? '9:41' : '9:18');
      if ($('s-day').textContent !== day) $('s-day').textContent = day;
      scrollEdge();
    }
    var t = $('truth-view'); if (t) t.textContent = JSON.stringify(truth(), null, 1);
    paint(); kick();
  }
  function scrollEdge() { var ps = $('prop-scroll'); if (!ps) return; ps.classList.toggle('more', ps.scrollHeight - ps.clientHeight - ps.scrollTop > 1); }

  /* The approved compact Return presentation (G2.3 closure §4; T-11 amendment §2). A pure function of T-08's offered
     set in T-08's frozen order; it never reads a width, a device or a count. RETURN_LIVE_HEAD, when offered, is the
     dominant act and lives in its one home — the Timeline's Live edge (T-11 §6); otherwise BACK_ONE_STEP, directly
     in OrientationChrome. The other offered acts go under «طرق العودة»; no dominant act → every act shown directly. */
  var DOMINANCE = ['RETURN_LIVE_HEAD', 'BACK_ONE_STEP'];
  function presentReturns(ids) {
    var band = ids.filter(function (id) { return id !== 'RETURN_LIVE_HEAD'; });
    var dominant = null;
    for (var i = 0; i < DOMINANCE.length && !dominant; i++) if (ids.indexOf(DOMINANCE[i]) >= 0) dominant = DOMINANCE[i];
    if (!dominant) return { dominant: null, direct: band, grouped: [], trigger: false };
    var direct = band.filter(function (id) { return id === dominant; });
    var grouped = band.filter(function (id) { return id !== dominant; });
    return { dominant: dominant, direct: direct, grouped: grouped, trigger: grouped.length > 0 };
  }
  /* G3.2 D-B — the temporal orientation context: where in time the reader is, and whether the conversation continued
     after it (PINNED), or which Moment is being looked at (a preview). It exists only while that context does; it is
     said ONCE, directly above the Track, and never again in OrientationChrome. The same T-08 words as G3.1. */
  function ctxContent() {
    if (S.place !== 'analysis') return [];
    if (S.ptc != null) return [{ cls: 'o-temporal', text: L.previewLine(String(S.ptc)) }];
    if (S.mode === 'PINNED') {
      var l = [{ cls: 'o-temporal', text: L.temporalPinned(String(S.tc)) }];
      if (S.LH > S.tc) l.push({ cls: 'o-live', text: L.liveContinued.text });
      return l;
    }
    return [];
  }
  /* OrientationChrome keeps what is not temporal: the inspection line and the Return acts (or, while previewing, the
     preview's own two acts). */
  function bandContent() {
    var lines = [], ids = offered();
    if (S.place !== 'analysis') return { lines: lines, acts: [], more: [], compact: false, dominant: null };
    if (S.IF && S.ptc == null) lines.push({ cls: 'o-inspect', text: L.inspectRenderable(L.family[S.IF.family]) });
    if (S.ptc != null) return { lines: lines, acts: [], more: [], compact: false, dominant: null };
    var p = presentReturns(ids);
    return { lines: lines, acts: p.direct, more: p.grouped, compact: true, dominant: p.dominant };
  }
  var bandKey = '';
  function retBtn(id, cls) {
    return '<button type="button" class="ret' + (cls ? ' ' + cls : '') + '" data-act="' + id + '" aria-describedby="hint-' + id + '"><span class="lb">' + esc(L.returns[id].label.text) + '</span></button>' +
      '<span class="sr" id="hint-' + id + '">' + esc(L.returns[id].hint.text) + '</span>';
  }
  /* G3.2 D-B — the line enters and leaves with its context: an opacity resolve in place (220 ms in, 140 ms out, T-10's
     curve; a 140 ms resolve in / a cut out under Reduced Motion). It never translates on its own — its only movement is
     the Timeline's. A change of words (preview → PINNED, a spoken commit while PINNED) is the temporal event itself,
     so the words change at that instant, in place. While it resolves out it keeps its last words but is aria-hidden. */
  var CTX_TUCK = 28;   // the Timeline row's free top: above the Live label and the preview number (see #tl-ctx)
  function renderCtx() {
    var lines = ctxContent(), el = $('tl-ctx'), k = lines.map(function (l) { return l.text; }).join('|');
    if (lines.length) {
      if (el.getAttribute('data-k') !== k) { el.setAttribute('data-k', k); el.innerHTML = lines.map(function (l) { return '<span class="' + l.cls + '">' + esc(l.text) + '</span>'; }).join(' '); }
      el.hidden = false; el.removeAttribute('aria-hidden');
      if (get('ctx') < 0.5 && !anims.ctx) go('ctx', 1, DUR.band);
    } else if (!el.hidden && el.getAttribute('data-k')) {
      el.setAttribute('data-k', ''); el.setAttribute('aria-hidden', 'true');
      if (RM) set('ctx', 0); else to('ctx', 0, DUR.bandOut);
    }
    if (lines.length) ctxShownExtra = ctxExtra();                  // kept while the line resolves out (paint)
  }
  var ctxShownExtra = 0;
  /* How far the line stands above the Timeline's own 88-pt room (0 when it fits in the row's free top). */
  function ctxExtra() { return ctxContent().length ? Math.max(0, Math.ceil($('tl-ctx').offsetHeight - CTX_TUCK)) : 0; }
  function renderBand() {
    renderCtx();
    var c = bandContent(), key = JSON.stringify(c) + S.ptc + '|' + S.moreOpen + '|' + S.call + '|' + root.clientHeight + '|' + ctxExtra();
    var show = c.lines.length > 0 || c.acts.length > 0 || c.more.length > 0 || S.ptc != null;
    if (key !== bandKey) {
      bandKey = key;
      var h = '';
      if (c.compact) {
        if (c.lines.length) h += '<p class="o-status r-support">' + c.lines.map(function (l, i) { return '<span class="' + (i ? 'o-live' : l.cls) + '">' + esc(l.text) + '</span>'; }).join(' ') + '</p>';
        if (c.acts.length || c.more.length) {
          h += '<div class="acts" role="group" aria-label="' + esc(L.returnControlsLabel.text) + '">' + c.acts.map(function (id) { return retBtn(id); }).join('');
          if (c.more.length) h += '<button type="button" class="ret more-t" id="more-t" aria-expanded="' + (S.moreOpen ? 'true' : 'false') + '" aria-controls="more-acts"><span class="lb">' + esc(L.revealReturns.text) + '</span></button>';
          h += '<span id="more-acts" style="display:contents">' + (S.moreOpen ? c.more.map(function (id) { return retBtn(id, 'x'); }).join('') : '') + '</span>';
          h += '</div>';
        }
      } else {
        h = c.lines.map(function (l) { return '<p class="' + l.cls + ' r-support">' + esc(l.text) + '</p>'; }).join('');
        if (S.ptc != null) h += '<div class="acts"><button type="button" class="ret" data-pv="cancel"><span class="lb">' + esc(L.previewCancel.text) + '</span></button>' +
          '<button type="button" class="ret" data-pv="commit"><span class="lb">' + esc(L.previewCommit(String(S.ptc))) + '</span></button></div>';
      }
      var hadFocus = document.activeElement && document.activeElement.id === 'more-t';
      root.style.setProperty('--band-max', bandRoom() + 'px');
      $('band-in').innerHTML = h;
      if (hadFocus && $('more-t')) $('more-t').focus();
      bandScrollState();
      /* C1: the Timeline rides on the chrome — it rises by exactly the chrome's height, on T-10's curve. */
      var newH = show ? $('band').offsetHeight : 0;
      if (Math.abs(get('band-h') - newH) > 0.5) glide('band-h', newH, get('band-h') < 0.5 || newH < 0.5 ? DUR.band : DUR.temporal);
    }
    if (show && get('band') < 0.5 && !anims.band) go('band', 1, DUR.band);
    if (!show && get('band') > 0) { if (RM) set('band', 0); else to('band', 0, DUR.bandOut); }
  }
  /* T-11 §3: the world is sized first, at max(MAP_MIN_HEIGHT_POINTS = 160, usable / 2); the Timeline row and the chrome
     share what is left, and the chrome — the region that yields — gets the remainder after the Timeline. `usable` is the
     room between the upper chrome and the lower shell (rail, home indicator, and the call line while a call runs). */
  /* G3.2 D-B: the temporal line is part of the support, so it is paid for from the support's share (ctxExtra) before
     OrientationChrome gets its room — never from the world's floor. OrientationChrome is the region that yields: it
     scrolls inside whatever room is left (T-11 §3: "every support region clips to what it was given and keeps the
     remainder reachable inside itself"). G3.1 gave it a 54-pt minimum, which is safe only while the room is never
     smaller; with the line above the Timeline it can be (found by K14), so the minimum is gone and the world's floor
     wins. The primary temporal meaning (the line, the Live-edge act) never scrolls: it is not in OrientationChrome. */
  function worldFloor() { var usable = root.clientHeight - 95 - 90 - (S.call !== 'none' ? 64 : 0); return { usable: usable, floor: Math.max(160, usable / 2) }; }
  function bandRoom() { var f = worldFloor(); return Math.max(0, Math.floor(f.usable - f.floor - 88 - ctxExtra())); }
  /* G3.2: the soft edge says "more below" only when a line or an act is actually cut — not when only the room's own
     bottom padding is (G3.1 measured the scroll height, which faded a fully visible act at the tightest room). */
  function bandScrollState() {
    var b = $('band'), last = $('band-in').lastElementChild, scrollable = b.scrollHeight > b.clientHeight + 1;
    var cut = !!last && last.getBoundingClientRect().bottom > b.getBoundingClientRect().bottom + 1;
    b.classList.toggle('scroll', scrollable); b.classList.toggle('at-end', scrollable && !cut);
  }
  /* ======================================================================== P2-A — THE TEMPORAL SPINE + APERTURE ====
     A visual machine over T-05 / T-06's geometry. Nothing here changes a temporal semantic:
       - TM is still FOLLOW_LIVE or PINNED(t); a preview is still a separate, lossless PTC (T-06).
       - the Track is SP1-anchored: SP i sits at (i - 1) × 48 + 24 pt from the START edge, minus the window offset S.off
         (T-05 item i has offset i × 48 and length 48). The offset is never animated (T-06). Following Live it shows
         the newest Moment; PINNED it stays still while new Moments arrive, and only jumps (never glides) to keep a
         committed or previewed target in view.
       - the Live edge is T-05's outboard slot (#tl-live), outside the Track. It is drawn as a TERMINAL and never in a
         Moment's form; Moment(LH) is a notch on the spine like every other Moment.
     Visual vocabulary (docs/P2_TEMPORAL_SPINE_APERTURE_PROOF.md):
       spine    1-pt hairline, tertiary ink            notch   a disclosed Moment: 1 × 6 pt, tertiary
       aperture the spine OPENS at the committed Moment (primary ink; variant form A / B / C)
       preview  the same opening, lighter: 1-pt line at 0.72 (T-06 M4), never at committed weight, no core
       terminal the Live edge's own form: ENGAGED (solid) while following Live, AVAILABLE (open) while PINNED
     Motion (T-06 / T-10 values, unchanged): the preview aperture is under the finger 1:1 with no easing; on release
     the committed aperture retargets from the finger to its Moment's centre in 140 ms (M1) and settles once (+9 %
     scaleY, 80 ms up / 120 ms down, M2); a cancel returns the preview to the committed place in 240 ms (M3) and
     fades; Return Live closes the aperture IN PLACE (140 ms) while the terminal engages (160 ms). No travel between
     historical Moments, no trail, no pulse, no loop. Reduced Motion: every movement is 0 ms; presence changes keep
     their 140 ms opacity resolve; the settle is skipped. */
  var tlKey = '', tlN = 0, prevT = null, settleAt = -1e9;
  var STEP = 48, HALF = 24;
  function disclosedCount() { return S.LH; }          // P2-A: the Track always holds SP1…SP(LH) (T-05, T-06); see F-P2-01
  function trackW() { return $('tl-track').clientWidth; }
  function maxOff() { return Math.max(0, S.LH * STEP - trackW()); }
  function fromStart(sp) { return (sp - 1) * STEP + HALF - S.off; }
  function physX(sp) { var s = fromStart(sp); return RTL ? trackW() - s : s; }
  /** Keeps `sp` inside the visible window; a jump, never a glide (T-06: the window offset is never animated). */
  function reveal(sp) {
    var s = fromStart(sp), W = trackW();
    if (s < HALF) S.off = Math.max(0, (sp - 1) * STEP - STEP);
    else if (s > W - HALF) S.off = Math.min(maxOff(), (sp - 1) * STEP + STEP + HALF - W + HALF);
  }
  function renderTimeline() {
    var n = disclosedCount(), cur = S.ptc != null ? S.ptc : S.tc;
    var key = [n, cur, S.mode, S.ptc, S.LH, S.tc, trackW()].join('|');
    if (key === tlKey) return; tlKey = key;
    var p = prevT || { mode: 'FOLLOW_LIVE', tc: S.LH, ptc: null, n: n };
    // the window: following Live shows the newest Moment; otherwise it holds, and jumps only to keep a target in view
    if (S.off == null) S.off = maxOff();                                     // a fresh view opens on the newest Moment
    if (S.mode === 'FOLLOW_LIVE' && S.ptc == null) S.off = maxOff();
    else if (!fingerDown) reveal(cur);
    if (n > tlN && tlN) { set('nw', 0); go('nw', 1, DUR.resolve); }         // a new notch resolves in (no travel)
    tlN = n;
    // ---- transitions of the committed / preview marks (from the previous temporal state to this one)
    var committedWas = p.mode === 'PINNED' ? p.tc : null, committedNow = S.mode === 'PINNED' ? S.tc : null;
    if (p.ptc != null && S.ptc == null && committedNow === p.ptc && (committedWas !== committedNow || p.mode !== S.mode)) {
      // COMMIT: the preview becomes the committed aperture where it stands, then retargets to its Moment (M1) and settles (M2)
      var fx = fingerDown || lastFingerX != null ? lastFingerX : physX(p.ptc) + get('pv-dx');
      S.apSp = committedNow; set('ap-o', 1); set('ap-dx', fx - physX(committedNow)); if (RM) set('ap-dx', 0); else to('ap-dx', 0, 140);
      set('pv-o', 0); set('pv-dx', 0);
      if (!RM) { settleAt = now(); set('settle-clock', 0); to('settle-clock', 1, 200); }
    } else if (p.ptc != null && S.ptc == null) {
      // CANCEL: the preview returns to the committed place (M3, 240 ms) and fades; under Reduced Motion it is simply gone
      var home = committedNow != null ? physX(committedNow) : (RTL ? -20 : trackW() + 20);
      if (RM) { set('pv-o', 0); set('pv-dx', 0); } else { to('pv-dx', home - physX(p.ptc), 240); to('pv-o', 0, 240); }
      S.pvSp = p.ptc;
    } else if (S.ptc != null) {
      // PREVIEW: under the finger 1:1 (drawn from lastFingerX); from the keyboard, the mark retargets in 140 ms (M1)
      var was = p.ptc != null ? physX(p.ptc) + get('pv-dx') : (committedWas != null ? physX(committedWas) : null);
      S.pvSp = S.ptc; set('pv-o', 1);
      if (!fingerDown) { if (was == null || RM) set('pv-dx', 0); else { set('pv-dx', was - physX(S.ptc)); to('pv-dx', 0, 140); } }
    }
    if (committedNow != null && !(p.ptc != null && S.ptc == null && committedNow === p.ptc)) {
      if (committedWas == null) { S.apSp = committedNow; set('ap-dx', 0); go('ap-o', 1, DUR.resolve); }   // pinned by another act
      else if (committedWas !== committedNow) { S.apSp = committedNow; set('ap-dx', 0); set('ap-o', 1); } // a Return restored a stance: cut
    }
    if (committedNow == null && committedWas != null) { if (RM) set('ap-o', 0); else to('ap-o', 0, 140); }  // Return Live: close in place
    // the terminal: ENGAGED while following Live
    var eng = S.mode === 'FOLLOW_LIVE' ? 1 : 0;
    if (get('term') !== eng && !anims.term) { if (eng) go('term', 1, DUR.temporal); else { if (RM) set('term', 0); else to('term', 0, DUR.resolve); } }
    prevT = { mode: S.mode, tc: S.tc, ptc: S.ptc, n: n };
    // ---- the number and the accessible value (unchanged T-05 / T-08 words)
    $('tl-num').textContent = S.ptc != null ? String(S.ptc) : (S.mode === 'PINNED' ? String(S.tc) : '');
    var tr = $('tl-track');
    tr.setAttribute('aria-valuemin', String(FIX.firstMoment)); tr.setAttribute('aria-valuemax', String(n)); tr.setAttribute('aria-valuenow', String(cur));
    tr.setAttribute('aria-valuetext', S.ptc != null ? L.previewLine(String(S.ptc)) : S.mode === 'PINNED' ? L.temporalPinned(String(S.tc)) : L.temporalLive.text);
    var slot = $('tl-live');
    if (S.mode === 'PINNED') {
      slot.classList.add('ret'); slot.setAttribute('data-act', 'RETURN_LIVE_HEAD');
      slot.innerHTML = '<span class="lb">' + esc(L.returns.RETURN_LIVE_HEAD.label.text) + '</span>' + TERM_SVG + '<span class="hit" aria-hidden="true"></span>';
      slot.setAttribute('aria-label', L.returns.RETURN_LIVE_HEAD.label.text); slot.setAttribute('aria-describedby', 'hint-live'); slot.removeAttribute('aria-disabled');
    } else {
      slot.classList.remove('ret'); slot.removeAttribute('data-act');
      slot.innerHTML = TERM_SVG;
      slot.setAttribute('aria-label', L.liveSlotFollowing.text); slot.removeAttribute('aria-describedby'); slot.setAttribute('aria-disabled', 'true');
    }
  }
  var TERM_SVG = '<svg class="term" viewBox="0 0 44 44" aria-hidden="true" focusable="false"></svg>';
  function spineVariant() { return root.getAttribute('data-spine') || 'C'; }
  function f2(v) { return (+v).toFixed(2); }
  /** One aperture at physical x. w = 1 committed, 0 preview. Returns [svg markup, half-width of the spine's opening]. */
  function aperture(v, x, w, sy) {
    var cy = 22, sw = w ? 1.5 : 1, a = w ? 1 : 0.72, g = '<g opacity="' + a + '" transform="translate(' + f2(x) + ' ' + cy + ') scale(1 ' + f2(sy) + ') translate(' + f2(-x) + ' ' + (-cy) + ')">';
    var S0 = ' fill="none" stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"';
    if (v === 'A') return [g + '<path d="M' + f2(x - 10) + ' 22Q' + f2(x) + ' 6 ' + f2(x + 10) + ' 22Q' + f2(x) + ' 38 ' + f2(x - 10) + ' 22Z"' + S0 + '/>' +
      (w ? '<circle cx="' + f2(x) + '" cy="22" r="2.3" fill="currentColor"/>' : '') + '</g>', 13];
    if (v === 'B') return [g + '<path d="M' + f2(x - 6.5) + ' 13V31M' + f2(x + 6.5) + ' 13V31"' + S0.replace('stroke-width="' + sw, 'stroke-width="' + (w ? 1.75 : 1)) + '/>' +
      (w ? '<circle cx="' + f2(x) + '" cy="22" r="2.1" fill="currentColor"/>' : '') + '</g>', 6.5];
    return [g + '<path d="M' + f2(x - 17) + ' 22C' + f2(x - 9.5) + ' 22 ' + f2(x - 9) + ' 14 ' + f2(x) + ' 14C' + f2(x + 9) + ' 14 ' + f2(x + 9.5) + ' 22 ' + f2(x + 17) + ' 22' +
      'M' + f2(x - 17) + ' 22C' + f2(x - 9.5) + ' 22 ' + f2(x - 9) + ' 30 ' + f2(x) + ' 30C' + f2(x + 9) + ' 30 ' + f2(x + 9.5) + ' 22 ' + f2(x + 17) + ' 22"' + S0 + '/>' +
      (w ? '<rect x="' + f2(x - 1) + '" y="18" width="2" height="8" rx="1" fill="currentColor"/>' : '') + '</g>', 17];
  }
  /** Draws the spine, its notches, the apertures and the terminal from the animated values (called from paint). */
  function morphs() {
    var mp = get('mute-p'), rp = get('route-p'), m = $('mute'), r = $('route');
    Array.prototype.forEach.call(m.querySelectorAll('.slash,.cutband'), function (p) { p.style.strokeDashoffset = (1 - mp).toFixed(4); p.style.visibility = mp < 0.002 ? 'hidden' : 'visible'; });
    var rf = r.querySelector('.rf'), rw = r.querySelector('.rw'); if (rf) rf.style.fillOpacity = rp.toFixed(4); if (rw) { rw.style.strokeDashoffset = (1 - rp).toFixed(4); rw.style.visibility = rp < 0.002 ? 'hidden' : 'visible'; }
  }
  var lastSpine = null;
  function drawSpine() {
    var svgEl = $('spine'); if (!svgEl) return;
    var W = trackW(), n = disclosedCount(), v = spineVariant(), act = get('tl-active');
    var marks = '', gaps = [];
    var apO = get('ap-o'), pvO = get('pv-o');
    var settle = 0; if (!RM) { var st = now() - settleAt; settle = st < 0 ? 0 : st < 80 ? st / 80 : st < 200 ? 1 - (st - 80) / 120 : 0; }
    var apX = S.apSp != null ? physX(S.apSp) + get('ap-dx') : null;
    var pvX = S.pvSp != null ? (fingerDown && lastFingerX != null ? lastFingerX : physX(S.pvSp) + get('pv-dx')) : null;
    if (apO > 0.001 && apX != null) { var A = aperture(v, apX, 1, (0.4 + 0.6 * Math.min(1, apO)) * (1 + 0.09 * settle)); marks += '<g opacity="' + f2(apO) + '">' + A[0] + '</g>'; gaps.push([apX - A[1], apX + A[1]]); }
    if (pvO > 0.001 && pvX != null) { var B = aperture(v, pvX, 0, 1); marks += '<g opacity="' + f2(pvO) + '">' + B[0] + '</g>'; if (v !== 'A') gaps.push([pvX - B[1], pvX + B[1]]); }
    // the spine: from the start edge to the newest Moment's far side, broken where an aperture opens it
    var x0 = RTL ? W : 0, xEnd = physX(n) + (RTL ? -HALF : HALF);
    var lo = Math.min(x0, xEnd), hi = Math.max(x0, xEnd);
    gaps.sort(function (a, b) { return a[0] - b[0]; });
    var segs = [], cx = lo;
    gaps.forEach(function (g) { if (g[0] > cx) segs.push([cx, Math.min(g[0], hi)]); cx = Math.max(cx, g[1]); });
    if (cx < hi) segs.push([cx, hi]);
    var spine = segs.map(function (s) { return 'M' + f2(s[0]) + ' 22H' + f2(s[1]); }).join('');
    // notches: every disclosed Moment in view; the previewed target is marked in primary ink (it is WHICH Moment)
    var notches = '', target = S.ptc;
    for (var i = 1; i <= n; i++) {
      var x = physX(i); if (x < -STEP || x > W + STEP) continue;
      if (S.apSp === i && apO > 0.5 && S.mode === 'PINNED') continue;
      var tgt = target === i, h = tgt ? 12 : 6 + 4 * act, o = i === n ? get('nw') : 1;
      notches += '<path d="M' + f2(x) + ' ' + f2(22 - h / 2) + 'v' + f2(h) + '" stroke="currentColor" stroke-width="' + (tgt ? 1.5 : 1) + '" stroke-linecap="round" opacity="' + f2((tgt ? 1 : 0.85) * o) + '" class="' + (tgt ? 'tgt' : 'nt') + '"/>';
    }
    // T-05's discontinuity: the disclosed Track continues beyond the END edge when the newest Moment is out of view
    var cont = '';
    if (S.off < maxOff() - 0.5) { var ex = RTL ? 6 : W - 6; for (var k = 0; k < 3; k++) cont += '<circle cx="' + f2(ex + (RTL ? 1 : -1) * k * 4) + '" cy="22" r="1" fill="currentColor" opacity=".7"/>'; }
    lastSpine = { apX: apX == null ? null : +apX.toFixed(3), pvX: pvX == null ? null : +pvX.toFixed(3), apO: +apO.toFixed(4), pvO: +pvO.toFixed(4), settle: +settle.toFixed(4), off: S.off, trackW: W, variant: v,
      apSp: S.apSp, pvSp: S.pvSp, notchesInView: (notches.match(/<path/g) || []).length, fingerDown: fingerDown };
    svgEl.setAttribute('viewBox', '0 0 ' + W + ' 44');
    svgEl.innerHTML = '<g class="spn" style="color:var(--tertiary)"><path d="' + spine + '" fill="none" stroke="currentColor" stroke-width="1" opacity="' + f2(0.55 + 0.25 * act) + '"/>' +
      notches.replace(/class="nt"/g, '') + cont + '</g>' + '<g style="color:var(--primary)">' + marks + '</g>';
    // the targeted notch in primary ink: move those paths into the primary group
    var tg = svgEl.querySelector('.tgt'); if (tg) { tg.removeAttribute('class'); svgEl.lastChild.appendChild(tg); }
    // the number rides above the current mark (committed or preview)
    var num = $('tl-num'), mx = pvO > 0.5 && pvX != null ? pvX : apX;
    if (mx != null) { var tb = $('tl-track').getBoundingClientRect(), rb = $('timeline').getBoundingClientRect(); num.style.left = f2(tb.left - rb.left + mx) + 'px'; }
    drawTerminal(v);
  }
  /** The Live TERMINAL, in the outboard slot. Local frame: x grows toward the END edge; mirrored under RTL by CSS. */
  function drawTerminal(v) {
    var t = document.querySelector('#tl-live .term'); if (!t) return;
    var e = get('term'), ink = 'currentColor', out = '';
    var sw = ' fill="none" stroke="' + ink + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
    if (v === 'A') out = '<path d="M9 15V29"' + sw + '/><circle cx="23" cy="22" r="4.6"' + sw + '/><circle cx="23" cy="22" r="4.6" fill="' + ink + '" opacity="' + f2(e) + '"/>';
    else if (v === 'B') out = '<path d="M9 13V31"' + sw + '/><rect x="18.5" y="17.5" width="9" height="9" rx="2.2"' + sw + '/><rect x="18.5" y="17.5" width="9" height="9" rx="2.2" fill="' + ink + '" opacity="' + f2(e) + '"/>';
    // C — the HORIZON: a stop bar where disclosed time ends, and beyond it the present as a short line of its own:
    // a heavy line while following Live (engaged), a hairline while PINNED (available). No curve, no core: it can never
    // be read as the Parting aperture of a Moment.
    else out = '<path d="M8 13V31"' + sw + '/><path d="M14.5 22H29"' + sw.replace('1.5', f2(1.25 + 1.75 * e)) + '/>';
    t.style.color = e > 0.5 ? 'var(--primary)' : 'var(--rest)';
    t.innerHTML = out;
  }

  /* Appearance. F2: the Product follows the system. G2 §F: the Living Analysis World is the same dark world either way.
     G3.2 D-A (the Product Owner's decision under proof, replacing G3.1's Q-LIGHT-SHELL fixture): while the Analysis is
     shown, the shell around the world belongs to it — under system Light the status region, rail, call line, Replay
     action and entry, home indicator and the phone's ground take the dark scope, blended by 'bgd' (1 = Analysis). The
     Conversation, the private proposal and the Shared World keep following the system. Nothing here touches the world. */
  var MIXV =[['--world', 'world'], ['--surface', 'surface'], ['--utterance', 'functional'], ['--primary', 'primary'], ['--secondary', 'secondary'], ['--tertiary', 'tertiary'],
    ['--brass', 'brass'], ['--mark', 'mark'], ['--rest', 'restInk'], ['--sel-ink', 'selectedInk'], ['--marker', 'selectedMarker'], ['--focus', 'focusIndicator'], ['--focus-c', 'focusCompanion'],
    ['--error', 'error'], ['--disabled', 'disabled']];
  var ANALYSIS_SHELL = ['rail', 'composer', 'replay', 'rmenu', 'status', 'homebar'];
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mixRgb(a, b, t) { var A = hexRgb(a), B = hexRgb(b); return [0, 1, 2].map(function (i) { return Math.round(A[i] + (B[i] - A[i]) * t); }); }
  var lastMix = null;
  function appearance() { return root.getAttribute('data-appearance') === 'light' ? 'light' : 'dark'; }
  function applyAppearance() {
    var ap = appearance(), t = get('bgd'), key = ap + '|' + (ap === 'light' ? t.toFixed(4) : '');
    if (key === lastMix) return; lastMix = key;
    var P = D.palettes;
    ANALYSIS_SHELL.forEach(function (id) {
      var el = $(id); if (!el) return;
      if (ap !== 'light') { MIXV.forEach(function (v) { el.style.removeProperty(v[0]); }); el.style.removeProperty('--world-rgb'); el.style.removeProperty('--press'); return; }
      MIXV.forEach(function (v) { el.style.setProperty(v[0], 'rgb(' + mixRgb(P.light[v[1]], P.dark[v[1]], t).join(',') + ')'); });
      el.style.setProperty('--world-rgb', mixRgb(P.light.world, P.dark.world, t).join(','));
      el.style.setProperty('--press', 'rgba(' + mixRgb(P.light.pressedInk, P.dark.pressedInk, t).join(',') + ',' + P.dark.pressedPresence + ')');
    });
    root.style.background = ap === 'light' ? 'rgb(' + mixRgb(P.light.world, P.dark.world, t).join(',') + ')' : '';
  }

  function paint() {
    applyAppearance();
    var dOut = get('depth-out'), dIn = get('depth-in');
    var conv = $('conv'), wl = $('world-layer');
    var pOut = get('prop-out'), pIn = get('prop-in'), birth = get('birth'), privOut = get('priv-out'), aOut = get('ana-out'), cOut = get('conv-out'), shIn = get('shared-in');
    var convOp = (1 - dOut) * (1 - cOut);
    conv.style.opacity = convOp.toFixed(4);
    conv.style.transform = RM ? 'none' : 'translateY(' + (-22 * Math.max(dOut, cOut)).toFixed(2) + 'px)';
    conv.style.visibility = convOp <= 0.001 ? 'hidden' : 'visible';
    var inAnalysis = dIn * (1 - pOut) * (1 - aOut);
    var worldOpacity = inAnalysis * get('world-resolve');
    wl.style.opacity = worldOpacity.toFixed(4);
    wl.style.transform = RM ? 'none' : 'translateY(' + (18 * (1 - dIn) - 22 * Math.max(pOut, aOut)).toFixed(2) + 'px) scale(' + (0.985 + 0.015 * dIn).toFixed(4) + ')';
    wl.style.visibility = worldOpacity <= 0.001 ? 'hidden' : 'visible';
    var hc = (1 - dIn) * (1 - cOut);
    $('hdr-conv').style.opacity = hc.toFixed(4); $('hdr-conv').style.visibility = hc <= 0.001 ? 'hidden' : 'visible';
    $('hdr-world').style.opacity = inAnalysis.toFixed(4); $('hdr-world').style.visibility = inAnalysis <= 0.001 ? 'hidden' : 'visible';
    var rOp = replayEligible() ? 1 - Math.max(pOut, birth, aOut, cOut, shIn) : 0;
    $('replay').style.opacity = rOp.toFixed(4);
    var dock = get('dock'), comp = $('composer');
    comp.style.transform = 'translateY(' + (dock * 64).toFixed(2) + 'px)';
    comp.style.visibility = dock >= 0.999 ? 'hidden' : 'visible';
    comp.style.setProperty('--v', get('voice').toFixed(4));
    var band = get('band'), bandEl = $('band'), bandH = get('band-h');
    root.style.setProperty('--band-h', bandH.toFixed(2) + 'px');
    bandEl.style.transform = RM ? 'none' : 'translateY(' + (6 * (1 - band)).toFixed(2) + 'px)';
    bandEl.style.visibility = band <= 0.001 ? 'hidden' : 'visible';
    bandEl.style.opacity = (band * inAnalysis).toFixed(4);
    var mo = get('more'); Array.prototype.forEach.call(bandEl.querySelectorAll('.ret.x'), function (b) { b.style.opacity = mo.toFixed(4); });
    var cx = get('ctx'), cxEl = $('tl-ctx');                         // G3.2 D-B: rides inside the Timeline
    cxEl.style.opacity = cx.toFixed(4); root.style.setProperty('--ctx-on', cx.toFixed(4)); root.style.setProperty('--ctx-h', (ctxShownExtra * cx).toFixed(2) + 'px');
    if (cx <= 0.001 && !cxEl.hidden && !cxEl.getAttribute('data-k')) { cxEl.hidden = true; cxEl.innerHTML = ''; }
    var tla = get('tl-active'), tl = $('timeline');
    tl.style.setProperty('--act', tla.toFixed(4));
    tl.style.transform = 'translateY(' + (-bandH).toFixed(2) + 'px)';
    drawSpine(); morphs();
    tl.style.opacity = inAnalysis.toFixed(4); tl.style.visibility = inAnalysis <= 0.001 ? 'hidden' : 'visible';
    var cueOn = cueKind() && S.place === 'analysis' ? get('cue') : 0;
    $('falloff-cue').style.opacity = (cueOn * inAnalysis).toFixed(4);
    $('falloff-bottom').style.opacity = inAnalysis.toFixed(4); $('falloff-top').style.opacity = inAnalysis.toFixed(4);
    $('elapsed').textContent = S.composer === 'note' ? mmss(noteMs()) : S.call === 'live' ? mmss(callT()) : '0:00';
    drawTrace();
    if (S.playing !== null) { var pt = turnByVn(S.playing); if (pt) { var f = pt.querySelector('.fill'); f.style.width = (Math.min(1, (now() - S.playStart) / +pt.getAttribute('data-dur')) * 100).toFixed(2) + '%'; } }
    var cueEl = $('cue');
    if (cueEl) { cueEl.style.opacity = (cueOn * inAnalysis).toFixed(4); cueEl.style.transform = RM ? 'none' : 'translateY(' + (-6 * (1 - cueOn)).toFixed(2) + 'px)'; }
    var prop = $('proposal');
    if (prop) {
      prop.style.opacity = (pIn * (1 - privOut)).toFixed(4);
      prop.style.transform = RM || privOut > 0 ? 'none' : 'translateY(' + (18 * (1 - pIn)).toFixed(2) + 'px) scale(' + (0.985 + 0.015 * pIn).toFixed(4) + ')';
      prop.style.visibility = pIn * (1 - privOut) <= 0.001 ? 'hidden' : 'visible';
      $('prop-ack').style.opacity = get('ack').toFixed(4);
      var sh = $('shared'), born = S.sharedHow === 'born' && S.place === 'shared', shP = born ? birth : shIn;
      sh.style.opacity = shP.toFixed(4);
      sh.style.transform = RM || !born ? 'none' : 'translateY(' + (18 * (1 - birth)).toFixed(2) + 'px) scale(' + (0.985 + 0.015 * birth).toFixed(4) + ')';
      sh.style.visibility = shP <= 0.001 ? 'hidden' : 'visible';
      var wel = $('s-welcome'), wv = born ? get('welcome') : 1;
      wel.style.opacity = wv.toFixed(4);
      wel.style.transform = RM || !born ? 'none' : 'translateY(' + (8 * (1 - wv)).toFixed(2) + 'px)';
    }
    var mk = $('marker'); mk.style.transform = 'translateX(' + get('mx1').toFixed(2) + 'px)'; mk.style.width = Math.max(2, get('mx2') - get('mx1')).toFixed(2) + 'px';
    var m = get('menu'), rm = $('rmenu'); rm.style.opacity = m.toFixed(4); rm.style.transform = RM ? 'none' : 'scale(' + (0.97 + 0.03 * m).toFixed(4) + ')';
    if (worldReady) pushCamera(!!camAnim);
  }
  /* P2-A: the G1.2 / G3.2 proof drew a SIMULATED microphone level here (a seeded hash). A drawn level with no real signal
     behind it is fake data in a semantic shape, so the Call Rail carries none: the line stays flat and hidden during a call.
     A future level expression needs a truthful audio signal (QAN-BL-VOICE-01) and its own Product decision. */
  function drawTrace() { var p = $('trace-path'); if (p) p.setAttribute('d', 'M0 10 H10'); }

  /* -------------------------------------------------------------------------- gestures ------ */
  var gl = $('gesture'), pts = {}, g0 = null;
  function toStage(e) { var r = root.getBoundingClientRect(); var x = e.clientX - r.left, y = e.clientY - r.top; return { x: x + (stageW - phoneW) / 2, y: y }; }
  function worldAt(p, c) { var z = stageW / c.field; return { x: c.cx + (p.x - stageW / 2) / z, y: c.cy + (p.y - stageH / 2) / z }; }
  gl.addEventListener('pointerdown', function (e) {
    if (S.place !== 'analysis') return;
    gl.setPointerCapture(e.pointerId); pts[e.pointerId] = toStage(e);
    if (!g0) g0 = { pre: snapshot(), cam: copyCam(S.cam), moved: false, start: toStage(e) };
    else { g0.cam = copyCam(S.cam); g0.pinch = pinchState(); }
    camAnim = null;
  });
  function pinchState() { var k = Object.keys(pts); if (k.length < 2) return null; var a = pts[k[0]], b = pts[k[1]]; return { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; }
  gl.addEventListener('pointermove', function (e) {
    if (!g0 || !pts[e.pointerId]) return;
    var prev = pts[e.pointerId], p = toStage(e); pts[e.pointerId] = p;
    if (Math.hypot(p.x - g0.start.x, p.y - g0.start.y) > 6) g0.moved = true;
    var ps = pinchState();
    if (ps && g0.pinch) {
      var k = g0.pinch.d / Math.max(1, ps.d), f = g0.cam.field * k;
      var anchor = worldAt(g0.pinch.m, g0.cam), z = stageW / Math.min(FIELD_MAX, Math.max(FIELD_MIN, f));
      S.cam = clampCam({ field: f, cx: anchor.x - (ps.m.x - stageW / 2) / z, cy: anchor.y - (ps.m.y - stageH / 2) / z });
    } else if (!ps) {
      var zz = stageW / S.cam.field;
      S.cam = clampCam({ field: S.cam.field, cx: S.cam.cx - (p.x - prev.x) / zz, cy: S.cam.cy - (p.y - prev.y) / zz });
    }
    pushCamera(true); paint();
  });
  function endPointer(e) {
    if (!pts[e.pointerId]) return; delete pts[e.pointerId];
    if (Object.keys(pts).length) { g0.cam = copyCam(S.cam); g0.pinch = pinchState(); return; }
    var g = g0; g0 = null;
    if (!g.moved && e.type === 'pointerup') {
      var hit = G && G.hit(g.start.x, g.start.y, 22);
      if (hit && hit.A >= 0.3) { actInspect(hit); log('INSPECT_OBJECT ' + (hit.label || hit.kind)); }
      return;
    }
    actCameraGesture(g.pre);
  }
  gl.addEventListener('pointerup', endPointer); gl.addEventListener('pointercancel', endPointer);
  var wheelPre = null, wheelT = 0;
  gl.addEventListener('wheel', function (e) {
    if (S.place !== 'analysis') return; e.preventDefault(); camAnim = null;
    if (!wheelPre) wheelPre = snapshot();
    var p = toStage(e), anchor = worldAt(p, S.cam), f = S.cam.field / Math.exp(-e.deltaY * 0.0014);
    var ff = Math.min(FIELD_MAX, Math.max(FIELD_MIN, f)), z = stageW / ff;
    S.cam = clampCam({ field: ff, cx: anchor.x - (p.x - stageW / 2) / z, cy: anchor.y - (p.y - stageH / 2) / z });
    pushCamera(true); paint();
    clearTimeout(wheelT); wheelT = setTimeout(function () { var pre = wheelPre; wheelPre = null; actCameraGesture(pre); }, 260);
  }, { passive: false });
  /* Keyboard route to the same world (G2.1): arrows pan by a third of the window, + / − come closer / step back, and
     Enter inspects the Live Focus when it is in view — the same act a tap on it performs. */
  gl.addEventListener('keydown', function (e) {
    var c = S.cam, win = c.field * phoneW / stageW / 3, pre = snapshot(), dest = null;
    var fwd = RTL ? -1 : 1;
    if (e.key === 'ArrowLeft') dest = { cx: c.cx - win, cy: c.cy, field: c.field };
    else if (e.key === 'ArrowRight') dest = { cx: c.cx + win, cy: c.cy, field: c.field };
    else if (e.key === 'ArrowUp') dest = { cx: c.cx, cy: c.cy - win, field: c.field };
    else if (e.key === 'ArrowDown') dest = { cx: c.cx, cy: c.cy + win, field: c.field };
    else if (e.key === '+' || e.key === '=') dest = { cx: c.cx, cy: c.cy, field: c.field / 2.37 };
    else if (e.key === '-') dest = { cx: c.cx, cy: c.cy, field: c.field * 2.37 };
    else if (e.key === 'Enter') { e.preventDefault(); var i = G.focusIndex(), s = screenOf(i); if (s && s.x > 0 && s.x < phoneW && s.y > 0 && s.y < phoneH && S.cam.field < 2600) { actInspect(hit(i)); log('INSPECT_OBJECT (keyboard)'); } return; }
    void fwd;
    if (!dest) return; e.preventDefault(); travelTo(dest); actCameraGesture(pre);
  });

  /* P2-A: the finger. While it is down the preview aperture is drawn AT the finger's x (1:1, no easing, T-06 / T-10
     M0); the previewed Moment is the nearest 48-pt step. The window does not move while the finger is down. */
  var track = $('tl-track'), tdown = false, fingerDown = false, lastFingerX = null;
  function fingerX(e) { var r = track.getBoundingClientRect(); return Math.max(0, Math.min(r.width, e.clientX - r.left)); }
  function spAt(e) { var x = fingerX(e), s = RTL ? track.clientWidth - x : x; return Math.round((s + S.off - HALF) / STEP) + 1; }
  track.addEventListener('pointerdown', function (e) { if (S.place !== 'analysis') return; tdown = true; fingerDown = true; track.setPointerCapture(e.pointerId); lastFingerX = fingerX(e); go('tl-active', 1, DUR.temporal); previewAt(spAt(e)); paint(); });
  track.addEventListener('pointermove', function (e) { if (!tdown) return; lastFingerX = fingerX(e); previewAt(spAt(e)); paint(); });
  track.addEventListener('pointerup', function () { if (!tdown) return; tdown = false; commitPreview(); fingerDown = false; lastFingerX = null; });
  track.addEventListener('pointercancel', function () { tdown = false; fingerDown = false; cancelPreview(); lastFingerX = null; });
  track.addEventListener('keydown', function (e) {
    var cur = S.ptc != null ? S.ptc : S.tc;
    var step = (e.key === 'ArrowLeft') === RTL ? 1 : -1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); go('tl-active', 1, DUR.temporal); previewAt(cur + step); }
    else if (e.key === 'Enter') { e.preventDefault(); commitPreview(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelPreview(); }
  });  $('tl-live').addEventListener('click', function () { if (S.mode === 'PINNED') doReturn('RETURN_LIVE_HEAD'); });

  /* ---------------------------------------------------------------- wiring the controls ---- */
  function on(id, fn) { var el = $(id); if (el) el.addEventListener('click', fn); }
  on('back', leaveAnalysis); on('door', enterAnalysis);
  on('replay', function () { if (S.replayMenu) closeMenu(); else openMenu(); });
  on('call', startCall); on('end-call', endCall); on('mic', startNote); on('send', send); on('note-send', sendNote); on('note-cancel', cancelNote);
  on('mute', function () { if (S.call === 'none') return; S.muted = !S.muted; render(); }); on('route', function () { S.route = !S.route; render(); });
  on('cue', function () { var k = cueKind(); if (k === 'awaiting') openProposal(); else if (k === 'arrival') enterShared(); else if (k === 'ended') dismissEnded(); });
  on('prop-back', closeProposal); on('proceed', proceed); on('not-now', notNow);
  if ($('prop-scroll')) $('prop-scroll').addEventListener('scroll', scrollEdge, { passive: true });
  input.addEventListener('input', syncSend);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  $('conv').addEventListener('click', function (e) { var pb = e.target.closest('.play'); if (pb) togglePlay(pb.closest('.t')); });
  $('band').addEventListener('scroll', bandScrollState, { passive: true });
  $('band').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'more-t') toggleMore(e.detail === 0);                // detail 0 = activated from the keyboard
    else if (b.getAttribute('data-act')) doReturn(b.getAttribute('data-act'));
    else if (b.getAttribute('data-pv') === 'cancel') cancelPreview(); else if (b.getAttribute('data-pv') === 'commit') commitPreview();
  });
  Array.prototype.forEach.call(document.querySelectorAll('#rail .it'), function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-world');
      if (k === 'mine' && S.place === 'shared') goMine();
      else if (k === 'shared' && S.sharedExists && S.place !== 'shared' && S.place !== 'proposal') { if (S.matching === 'arrived') { enterShared(); return; } goShared(); log('rail → «' + L.nav.items[1].text + '»'); }
      else log('rail: ' + k + ' — that area is outside this proof');
    });
  });
  menuItems().forEach(function (b) { b.addEventListener('click', function () { chooseReplay(b.getAttribute('data-scope')); }); });
  $('rmenu').addEventListener('keydown', function (e) {
    var it = menuItems(), i = it.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); it[(i + 1) % it.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); it[(i - 1 + it.length) % it.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); it[0].focus(); } else if (e.key === 'End') { e.preventDefault(); it[it.length - 1].focus(); }
    else if (e.key === 'Tab') closeMenu(true);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (S.replayMenu) closeMenu();
    else if (S.moreOpen) { toggleMore(true); var t = $('more-t'); if (t) t.focus(); }
    else if (S.place === 'proposal') closeProposal();
    else if (S.composer === 'note') cancelNote();
  });
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('button'); if (b) b.classList.add('down');
    if (S.replayMenu && !$('rmenu').contains(e.target) && !$('replay').contains(e.target)) closeMenu(true);
  });
  document.addEventListener('pointerup', function () { Array.prototype.forEach.call(document.querySelectorAll('button.down'), function (b) { b.classList.remove('down'); }); });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
    if (root.getAttribute('data-appearance-source') !== 'system') return;
    root.setAttribute('data-appearance', e.matches ? 'light' : 'dark'); lastMix = null; render();
  });

  /* -------------------------------------------------------- deterministic state entry --------- */
  function reset() {
    anims = {}; vals = {}; camAnim = null;
    S.place = 'conversation'; S.world = 'mine'; S.LH = FIX.builtAt; S.mode = 'FOLLOW_LIVE'; S.tc = FIX.builtAt; S.ptc = null;
    S.cam = copyCam(WORLD_VP); S.IF = null; S.RH = []; S.journey = null; S.rhN = 0;
    S.call = 'none'; S.callId = null; S.muted = false; S.route = true; S.spoken = 0; S.callStarts = 0; S.composer = 'idle'; S.playing = null;
    S.matching = 'none'; S.who = S.whoPref; S.sharedHow = null; S.sharedExists = false; S.lastMine = null;
    S.moreOpen = false; S.replayMenu = false; S.replayChosen = null; S.commits = [];
    Array.prototype.forEach.call(document.querySelectorAll('#conv .new > *'), function (n) { n.remove(); });
    input.value = ''; syncSend();
    if ($('prop-scroll')) $('prop-scroll').scrollTop = 0;
    set('depth-in', 0); set('depth-out', 0); set('dock', 0); set('band', 0); set('band-h', 0); set('tl-active', 0); set('world-resolve', 1); set('bgd', 0);
    set('prop-in', 0); set('prop-out', 0); set('birth', 0); set('priv-out', 0); set('cue', 0); set('ack', 0); set('menu', 0); set('more', 0); set('voice', 0);
    set('ana-out', 0); set('conv-out', 0); set('shared-in', 0); set('welcome', 0);
    set('ctx', 0); $('tl-ctx').hidden = true; $('tl-ctx').innerHTML = ''; $('tl-ctx').setAttribute('data-k', ''); ctxShownExtra = 0;
    var bx = railBox('mine'); set('mx1', bx.x1); set('mx2', bx.x2);
    histKey = ''; tlKey = ''; tlN = 0; bandKey = ''; lastMix = null;
    prevT = null; S.off = null; S.apSp = null; S.pvSp = null; settleAt = -1e9; fingerDown = false; lastFingerX = null;
    set('ap-o', 0); set('ap-dx', 0); set('pv-o', 0); set('pv-dx', 0); set('term', 1); set('nw', 1); set('mute-p', 0); set('route-p', 1);
  }
  function settleAll() { Object.keys(anims).forEach(function (k) { set(k, anims[k].to); }); camAnim = null; }
  function hit(i) { var o = G.objectXY(i); return { index: i, label: null, kind: 'OPEN', focus: G.focusIndex() === i, x: o.x, y: o.y }; }
  function screenOf(i) { var o = G.objectXY(i), c = currentCam(), z = stageW / c.field; return o ? { x: (o.x - c.cx) * z + phoneW / 2, y: (o.y - c.cy) * z + stageH / 2 } : null; }
  function inAnalysisNow() { S.place = 'analysis'; set('depth-in', 1); set('depth-out', 1); set('dock', 1); set('bgd', 1); }
  function establishedCall(ms, place) {
    S.callSeq++; S.callStarts++; S.callId = 'call-' + (0x3f9a00 + S.callSeq * 0x1b7).toString(16);
    S.call = 'live'; S.callStart = now() - ms; S.liveAt = S.callStart + SCRIPT.connectMs; S.spoken = 0;
    callMarker(); set('voice', 1); set('dock', 0);
    var n = commitsNow(); while (S.spoken < n) { S.spoken++; commitTurn('spoken'); }
    if (place === 'analysis') { S.place = 'analysis'; set('depth-in', 1); set('depth-out', 1); set('bgd', 1); }
  }
  function inProposal() { inAnalysisNow(); S.place = 'proposal'; set('prop-in', 1); set('prop-out', 1); set('bgd', 0); }
  function inShared(how) { inAnalysisNow(); S.world = 'shared'; S.place = 'shared'; S.sharedHow = how; S.sharedExists = true; S.lastMine = 'analysis'; set('bgd', 0); set('welcome', 1); var bx = railBox('shared'); set('mx1', bx.x1); set('mx2', bx.x2);
    if (how === 'born') { set('prop-in', 1); set('prop-out', 1); set('priv-out', 1); set('birth', 1); } else { set('ana-out', 1); set('shared-in', 1); } }
  var STATES = {
    CONV: function () { },
    CONV_TYPED: function () { input.value = TYP.same; syncSend(); },
    CONV_NOTE: function () { S.composer = 'note'; S.noteStart = now() - 6400; set('voice', 1); },
    P1: function () { inAnalysisNow(); },
    P2: function () { inAnalysisNow(); var pre = snapshot(); S.cam = copyCam(G.pathCamera(0.5)); append('MAP_CAMERA', pre); },
    P2_INSPECT: function () { STATES.P2(); actInspect(hit(G.focusIndex())); },
    P3: function () { STATES.P2(); actInspect(hit(G.focusIndex())); var pre = snapshot(); S.cam = copyCam(G.pathCamera(1)); append('MAP_CAMERA', pre); },
    P3_OPEN: function () { STATES.P3(); S.moreOpen = true; set('more', 1); },
    P4: function () { inAnalysisNow(); S.LH = 17; S.tc = 17; var pre0 = snapshot(); S.cam = copyCam(G.pathCamera(0.5)); append('MAP_CAMERA', pre0); var pre = snapshot(); S.mode = 'PINNED'; S.tc = 14; append('TEMPORAL_COMMIT', pre); },
    P4_OPEN: function () { STATES.P4(); S.moreOpen = true; set('more', 1); },
    CALL_ANALYSIS: function () { establishedCall(16400, 'analysis'); },
    CALL_CONV: function () { establishedCall(16400, 'conversation'); },
    /* G3.2: following Live at 17 (three turns committed since the build) with the camera at MID — P4's own world and
       Timeline before its stance is pinned; the start of the FOLLOW_LIVE → PINNED → Return Live journey. */
    P2_LIVE17: function () { inAnalysisNow(); S.LH = 17; S.tc = 17; var pre = snapshot(); S.cam = copyCam(G.pathCamera(0.5)); append('MAP_CAMERA', pre); },
    /* G3.2: the densest temporal state — a live call (its line takes 64 pt of the column) while PINNED(14). */
    CALL_PINNED: function () { establishedCall(16400, 'analysis'); var pre0 = snapshot(); S.cam = copyCam(G.pathCamera(0.5)); append('MAP_CAMERA', pre0); var pre = snapshot(); S.mode = 'PINNED'; S.tc = 14; append('TEMPORAL_COMMIT', pre); },
    CALL_PINNED_OPEN: function () { STATES.CALL_PINNED(); S.moreOpen = true; set('more', 1); },
    REPLAY: function () { inAnalysisNow(); S.replayMenu = true; set('menu', 1); },
    REPLAY_CALL: function () { establishedCall(16400, 'analysis'); S.replayMenu = true; set('menu', 1); },
    M1_CUE: function () { inAnalysisNow(); if (HAS_MATCHING) { S.matching = 'available'; set('cue', 1); } },
    M2_PROPOSAL_A: function () { S.who = 'A'; S.matching = 'reviewing'; inProposal(); },
    M2_PROPOSAL_B: function () { S.who = 'B'; S.matching = 'reviewing'; inProposal(); },
    M3_ACK: function () { STATES.M2_PROPOSAL_A(); S.matching = 'forwarded'; set('ack', 1); },
    M4_UNAVAILABLE: function () { S.who = 'B'; S.matching = 'unavailable'; inProposal(); },
    M4_ENDED_A: function () { inAnalysisNow(); S.who = 'A'; S.matching = 'ended'; set('cue', 1); },
    M5_BORN: function () { S.who = 'B'; S.matching = 'born'; inShared('born'); },
    M6_ARRIVAL: function () { inAnalysisNow(); S.who = 'A'; S.matching = 'arrived'; S.sharedExists = true; set('cue', 1); },
    M6_ENTERED: function () { S.who = 'A'; S.matching = 'entered'; inShared('entered'); },
  };
  function enter(name) {
    if (!STATES[name]) throw new Error('unknown state ' + name);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    reset(); STATES[name](); settleAll();
    histKey = ''; applyHistory(null); lastWorldKey = ''; render(); settleAll(); paint();
    scrollEnd(); revealDisclosed();
    S.state = name; log('entered ' + name);
    return truth();
  }
  function visibleControls() {
    var vis = function (e) { if (!e.getClientRects().length) return false; for (var p = e; p && p !== root; p = p.parentElement) { if (p.hidden) return false; var c = getComputedStyle(p); if (c.visibility === 'hidden' || c.display === 'none' || +c.opacity < 0.5) return false; } return true; };
    return Array.prototype.filter.call(root.querySelectorAll('button, input, [tabindex="0"], [role="slider"]'), vis).map(function (b) { return b.id || b.getAttribute('data-act') || b.getAttribute('data-world') || b.getAttribute('data-scope') || b.className; });
  }
  function truth() {
    var w = offeredWhy(), c = bandContent();
    var turns = Array.prototype.map.call(document.querySelectorAll('#conv .t'), function (t) { return t.getAttribute('data-who') + ':' + (t.getAttribute('data-kind') || 'text'); });
    return { state: S.state || null, lang: LANG, place: S.place, rail: S.world, TM: S.mode, TC: S.tc, PTC: S.ptc, LH: S.LH, disclosedMoments: disclosedCount(),
      camera: { cx: +S.cam.cx.toFixed(2), cy: +S.cam.cy.toFixed(2), field: +S.cam.field.toFixed(2), atWorldViewpoint: atWorld() },
      IF: S.IF ? { family: S.IF.family, familyWord: L.family[S.IF.family], focusSingleton: !!S.IF.focus } : null,
      RH: S.RH.map(function (e) { return e.act; }), journeyOrigin: journeyAlive(),
      offered: offered(), offeredWhy: w, dominant: c.dominant, direct: c.acts, grouped: c.more, moreOpen: S.moreOpen,
      rendered: Array.prototype.map.call(document.querySelectorAll('#band [data-act], #tl-live[data-act]'), function (b) { return (b.id === 'tl-live' ? 'LIVE_EDGE:' : '') + b.getAttribute('data-act'); }),
      bandLines: c.lines.map(function (l) { return l.text; }), ctxLines: ctxContent().map(function (l) { return l.text; }),
      call: S.call, callId: S.callId, conversation: S.convId, callStarts: S.callStarts, spokenCommits: S.spoken, muted: S.muted, callA11y: callA11yLabel(), lineLabel: lineLabel(),
      composer: S.composer, turns: turns, commits: S.commits.slice(),
      matching: S.matching, who: S.who, cue: S.place === 'analysis' ? cueKind() : null, sharedHow: S.sharedHow, sharedExists: S.sharedExists, hasMatching: HAS_MATCHING,
      appearance: appearance(), analysisShellDark: +get('bgd').toFixed(3), reducedMotion: RM,
      room: (function () { var f = worldFloor(); return { usable: f.usable, worldFloor: f.floor, ctxExtra: ctxExtra(), bandRoom: bandRoom() }; })(),
      replayVisible: replayEligible(), replayMenu: S.replayMenu, replayChosen: S.replayChosen, controls: visibleControls(),
      world: G ? G.state() : null, fired: S.fired || null, window: windowFacts() };
  }
  /* The phone as a window onto the world (G2 §C.5): world units per point, the visible extent, and where the Live Focus
     sits relative to the window's centre. The same scale on every phone; a larger phone sees a larger extent. */
  function windowFacts() {
    if (!G || !stageW) return null;
    var s = screenOf(G.focusIndex()), c = S.cam;
    return { phoneW: phoneW, phoneH: phoneH, stageW: stageW, unitsPerPt: +(c.field / stageW).toFixed(5), visibleW: +(c.field * phoneW / stageW).toFixed(1), visibleH: +(c.field * phoneH / stageW).toFixed(1),
      focusFromCentre: s ? { dx: +(s.x - phoneW / 2).toFixed(2), dy: +(s.y - phoneH / 2).toFixed(2) } : null };
  }
  var logEl = null, logLines = [];
  function log(s) { logLines.push(s); if (logLines.length > 9) logLines.shift(); if (!logEl) logEl = $('act-log'); if (logEl) logEl.textContent = logLines.join('\n'); }

  window.__G32 = {
    ready: null, enter: enter, truth: truth, render: render, paint: paint, rule: presentReturns, dominance: DOMINANCE.slice(),
    clock: function (t) { vclock = t; tick(); paint(); return true; },
    act: function (name, arg) {
      var fns = { enterAnalysis: enterAnalysis, leaveAnalysis: leaveAnalysis, startCall: startCall, endCall: endCall,
        type: function (v) { input.value = v === 'cross' ? TYP.cross : v === 'same' ? TYP.same : v; syncSend(); }, send: send,
        startNote: startNote, sendNote: sendNote, cancelNote: cancelNote, mute: function () { S.muted = !S.muted; }, route: function () { S.route = !S.route; },
        previewAt: previewAt, commitPreview: commitPreview, cancelPreview: cancelPreview, toggleMore: toggleMore,
        showCue: showCue, openProposal: openProposal, closeProposal: closeProposal, proceed: proceed, notNow: notNow,
        becomeUnavailable: becomeUnavailable, dismissEnded: dismissEnded, matchArrives: matchArrives, enterShared: enterShared, goMine: goMine,
        openMenu: openMenu, closeMenu: closeMenu, chooseReplay: chooseReplay, travelTo: travelTo,
        inspectFocus: function () { actInspect(hit(G.focusIndex())); },
        cameraTo: function (a) { var pre = snapshot(); travelTo(typeof a === 'number' ? G.pathCamera(a) : a); actCameraGesture(pre); },
        setWho: function (v) { S.whoPref = v; S.who = v; } };
      if (ACTS[name]) { doReturn(name); return truth(); }
      if (!fns[name]) throw new Error('unknown act ' + name);
      fns[name](arg); render(); return truth();
    },
    busy: busy, bridge: function () { return G; }, geometry: function () { return { phoneW: phoneW, phoneH: phoneH, stageW: stageW, stageH: stageH }; },
    reducedMotion: RM, capture: CAPTURE, lang: LANG, states: Object.keys(STATES),
    screenOf: screenOf, focusIndex: function () { return G.focusIndex(); }, pathCamera: function (A) { return G.pathCamera(A); },
    press: function (sel, on2) { var el = document.querySelector(sel); if (el) el.classList.toggle('down', !!on2); return !!el; },
    setAppearance: function (v) { root.setAttribute('data-appearance', v); root.setAttribute('data-appearance-source', 'harness'); lastMix = null; render(); return appearance(); },
  };

  /* P2-A probes (harness / checks only): the physical x of a Session Position on the Track, and the drawn marks. */
  window.__P2 = { spX: function (sp) { return physX(sp); }, probe: function () { return Object.assign({ term: +get('term').toFixed(4), muteP: +get('mute-p').toFixed(4), routeP: +get('route-p').toFixed(4) }, lastSpine || {}); } };

  /* -------------------------------------------------------------------------- harness ------ */
  function syncToggles() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-toggle]'), function (b) {
      var g = b.getAttribute('data-toggle'), v = b.getAttribute('data-v');
      var cur = g === 'who' ? S.whoPref : (root.getAttribute('data-appearance-source') === 'system' ? 'system' : appearance());
      b.setAttribute('aria-pressed', String(cur === v));
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-state]'), function (b) { b.addEventListener('click', function () { enter(b.getAttribute('data-state')); syncToggles(); }); });
  var SIMS = { showCue: showCue, becomeUnavailable: becomeUnavailable, matchArrives: matchArrives,
    typeSame: function () { input.value = TYP.same; syncSend(); input.focus(); }, typeCross: function () { input.value = TYP.cross; syncSend(); input.focus(); } };
  Array.prototype.forEach.call(document.querySelectorAll('[data-sim]'), function (b) { b.addEventListener('click', function () { SIMS[b.getAttribute('data-sim')](); render(); }); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-toggle]'), function (b) {
    b.addEventListener('click', function () {
      var g = b.getAttribute('data-toggle'), v = b.getAttribute('data-v');
      if (g === 'who') { S.whoPref = v; S.who = v; render(); }
      else if (v === 'system') { root.setAttribute('data-appearance-source', 'system'); root.setAttribute('data-appearance', matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); lastMix = null; render(); }
      else window.__G32.setAppearance(v);
      syncToggles();
    });
  });

  reset(); render();
  window.__G32.ready = document.fonts.load('400 17px Estedad').then(function () { return document.fonts.load('500 14px Estedad'); })
    .then(function () { return document.fonts.load('600 26px Estedad'); }).then(function () { return document.fonts.ready; })
    .then(loadWorld).then(function () {
      var st = params.get('state'); enter(st && STATES[st] ? st : 'CONV');
      syncToggles();
      root.setAttribute('data-ready', '1');
      return true;
    }).catch(function (err) { window.__err = String(err && (err.stack || err.message) || err); root.setAttribute('data-ready', 'error'); log('ERROR ' + (err && err.message)); throw err; });
})();
