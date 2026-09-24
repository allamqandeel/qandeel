/* G2.3 prototype runtime — plain script, inlined by build.mjs. No framework, no dependency.
 *
 * A narrow delta on the G2.2 runtime (I-08B3.1-G2.2), whose header follows. Changed in G2.3, and nothing else:
 *   D1  the cue carries the Product Owner's approved opening message (two sentences, one quiet act);
 *   D2  the proposal carries QANDEEL's approved view + privacy message — no reasons, no traits, no list;
 *   §4  the compact Return / Orientation presentation is the approved direction, not a candidate beside G2.1: the G2.1
 *       comparison is gone, and the dominant act is a closed rule (presentReturns) that can also find NONE.
 * The Matching process, both Mutual-Match moments, the world, the bridge and the D5 appearance code are G2.2's, untouched.
 *
 * — G2.2 header —
 * A delta on the G2.1 runtime (I-08B3.1-G2.1). Unchanged from G2.1: the canonical world in an isolated frame, driven
 * only through the bridge; the fixture state (TM/TC, LH, PTC, MC, IF, RH); T-08's offered set in its frozen order with
 * its frozen words; the Timeline; gestures; the Live Call; one curve, cubic-bezier(0.23, 1, 0.32, 1), and the T-10 /
 * G1.1 durations. Changed in G2.2, and nothing else:
 *   D2  a compact Return / Orientation candidate: one status paragraph, one return visible, the rest disclosed on
 *       request under T-08's own group name — the offered SET, the labels and the order are untouched;
 *   D3  the Matching cue is the completed QANDEEL Q and the Product Owner's approved line, with one quiet act;
 *   D4  the Matching process for the FIRST accepter (A, FIRST_RECIPIENT) and the SECOND accepter (B, CANDIDATE):
 *       cue → private proposal → A: acknowledgement | B: the Mutual Match commit and the Shared World's birth;
 *       NO_LONGER_AVAILABLE as one neutral outcome; A's later arrival into a Shared World that already exists;
 *   D5  the Analysis is the same dark immersive surface under system Dark and system Light. Only the shell outside it
 *       follows the system; the rail, the status bar, the call line and Replay blend to dark while the Analysis is shown.
 */
(function () {
  'use strict';
  var D = window.__G21DATA;
  var L = D.copy;
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
  var EASE = bezier(0.23, 1, 0.32, 1);
  /* Durations: T-10 and G1.1, nothing invented. `stagger` is the 80 ms the animate skill allows between two arrivals. */
  var DUR = { resolve: 140, dock: 220, band: 220, bandOut: 140, depthOut: 200, depthIn: 320, depthInDelay: 100,
    markerLead: 200, markerTrail: 280, temporal: 160, menu: 180, cue: 280, beat: 110, stagger: 80 };

  var vals = {}, anims = {};
  function get(k) {
    var a = anims[k]; if (!a) return vals[k] == null ? 0 : vals[k];
    var p = (now() - a.start - (a.delay || 0)) / a.dur;
    if (p <= 0) return a.from; if (p >= 1) { vals[k] = a.to; delete anims[k]; return a.to; }
    return a.from + (a.to - a.from) * EASE(p);
  }
  function set(k, v) { delete anims[k]; vals[k] = v; }
  function to(k, v, dur, delay) { var cur = get(k); if (!dur || cur === v) { set(k, v); return; } anims[k] = { from: cur, to: v, start: now(), dur: dur, delay: delay || 0 }; vals[k] = v; kick(); }
  /* Reduced motion: travel and growth become a 140 ms resolve from (almost) nothing; a disappearance is a cut. */
  function go(k, v, dur, delay) { if (RM) { if (v > get(k)) { set(k, Math.max(get(k), 0.001)); to(k, v, DUR.resolve); } else set(k, v); } else to(k, v, dur, delay); }
  /* A colour blend (D5) is not motion: under reduced motion it is a cut. */
  function blend(k, v, dur, delay) { if (RM) set(k, v); else to(k, v, dur, delay); }
  function busy() { for (var k in anims) return true; return camAnim != null; }

  /* --------------------------------------------------------------------------- state ------- */
  var S = {
    place: 'analysis',          // conversation | analysis | proposal | shared
    world: 'mine',              // rail selection
    LH: D.fixture.builtAt, mode: 'FOLLOW_LIVE', tc: D.fixture.builtAt, ptc: null,
    cam: copyCam(WORLD_VP),
    IF: null, RH: [], journey: null, rhN: 0,
    call: 'none', callStart: 0, muted: false, route: true,
    /* Matching, as the reader holds it (runtime §21 outcome words in brackets):
       none · available [AWAITING_YOU] · reviewing · forwarded [IN_PROGRESS, first accepter] · unavailable
       [NO_LONGER_AVAILABLE, seen in the proposal] · ended [NO_LONGER_AVAILABLE, first accepter told] · born [MATCH_CONCLUDED,
       second accepter, the commit is theirs] · arrived [MATCH_CONCLUDED, first accepter, news] · entered            */
    matching: 'none',
    who: 'A', whoPref: 'A',     // A = the first accepter (FIRST_RECIPIENT) · B = the second accepter (CANDIDATE)
    sharedHow: null,            // born (B: the World is made now) | entered (A: the World already exists)
    moreOpen: false,            // «طرق العودة» disclosed (Class-D presentation state, never a Product fact)
    replayMenu: false,
  };
  function copyCam(c) { return { cx: c.cx, cy: c.cy, field: c.field }; }
  function camEq(a, b) { return Math.abs(a.cx - b.cx) < 0.5 && Math.abs(a.cy - b.cy) < 0.5 && Math.abs(a.field - b.field) < 0.5; }
  function atWorld() { return camEq(S.cam, WORLD_VP); }
  function snapshot() { return { mode: S.mode, tc: S.tc, cam: copyCam(S.cam), IF: S.IF ? JSON.parse(JSON.stringify(S.IF)) : null }; }
  function append(act, pre) { S.RH.push({ id: ++S.rhN, act: act, captured: pre }); return S.RH[S.RH.length - 1]; }
  function journeyAlive() { return !!S.journey && S.RH.some(function (e) { return e.id === S.journey.originId; }); }

  /* The offered set: T-08 §6's table over this fixture, in the frozen order (types.ts). Unchanged by G2.2. */
  var ORDER = ['BACK_ONE_STEP', 'EXACT_RETURN', 'RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'RETURN_WORLD', 'GO_LIVE_AND_LOCATE'];
  function offeredWhy() {
    return {
      BACK_ONE_STEP: S.RH.length > 0 ? 'the reader\'s own history holds ' + S.RH.length + ' reversible step(s)' : null,
      EXACT_RETURN: journeyAlive() ? 'an inspection journey origin was supplied and is still recorded' : null,
      RETURN_LIVE_HEAD: S.mode === 'PINNED' ? 'the committed stance is PINNED(' + S.tc + ')' : null,
      RETURN_LIVE_FOCUS: null, // S-07: the fixture's Live Focus is an Emerging Focus; T-04 gives it no locus
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
  /* S-01 (accepted by the Product Owner, D1): one constant world scale; a larger phone shows MORE of the same world. */
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
      var shaEl = $('sha-state'); if (shaEl) shaEl.textContent = D.world.verified ? 'SHA-256 ' + got.slice(0, 16) + '… verified against the pin' : 'MISMATCH ' + got;
      if (!D.world.verified) throw new Error('canonical world bytes do not match the pinned SHA-256');
      return new Promise(function (res) {
        frame.addEventListener('load', res, { once: true });
        frame.srcdoc = new TextDecoder('utf-8').decode(bytes);
      });
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
  var worldAnimUntil = 0;
  function worldClockKey() { return vclock < worldAnimUntil ? vclock.toFixed(1) : 'settled@' + histKey; }
  var histKey = '';
  function effectiveTC() { return S.ptc != null ? S.ptc : S.tc; }
  function applyHistory(animateSps) {
    if (!worldReady) return;
    var k = effectiveTC(), animate = {};
    (animateSps || []).forEach(function (sp) { animate[sp] = now(); });
    var key = k + '|' + JSON.stringify(animateSps || []) + '|' + (animateSps && animateSps.length ? now() : '');
    if (key === histKey) return;
    histKey = key;
    S.fired = G.replay(D.fixture.history, k, { animate: animate });
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

  /* ------------------------------------------------------------------------ the acts -------- */
  function actCameraGesture(pre) { if (!camEq(pre.cam, S.cam)) append('MAP_CAMERA', pre); render(); }
  function actInspect(hit) {
    var pre = snapshot();
    S.IF = { index: hit.index, family: hit.focus ? D.fixture.focusFamily : D.fixture.kindFamily[hit.kind], label: hit.label, focus: hit.focus };
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
  function arrivalsBetween(from, toSp) { return D.fixture.history.filter(function (e) { return e.sp > from && e.sp <= toSp; }).map(function (e) { return e.sp; }); }
  function doReturn(id) {
    if (offered().indexOf(id) < 0) return;
    var fromBand = !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('#band'));
    S.moreOpen = false; ACTS[id](); render(); log('act ' + id);
    if (fromBand && !CAPTURE) refocusBand(id);
  }
  /* G2.3: the band re-renders after an act, so a keyboard or screen-reader reader would be dropped onto the page. Focus
     goes back to the same act if it is still offered, else to «طرق العودة», else to the band's first act, else the world. */
  function refocusBand(id) {
    var a = document.activeElement;
    if (a && a !== document.body && document.contains(a)) return;
    var t = document.querySelector('#band [data-act="' + id + '"]') || $('more-t') || document.querySelector('#band [data-act]') || $('gesture');
    if (t) t.focus();
  }
  function commitTurn() {
    S.LH += 1;
    if (S.mode === 'FOLLOW_LIVE') { S.tc = S.LH; applyHistory(arrivalsBetween(S.LH - 1, S.LH)); }
    render(); log('committed turn → LH ' + S.LH);
  }
  function previewAt(sp) { var lo = D.fixture.builtAt, hi = disclosedCount(); sp = Math.max(lo, Math.min(hi, sp)); if (S.ptc === sp) return; S.ptc = sp; applyHistory(null); render(); }
  function commitPreview() { if (S.ptc == null) return; var pre = snapshot(), sp = S.ptc; S.ptc = null; S.mode = 'PINNED'; S.tc = sp; append('TEMPORAL_COMMIT', pre); applyHistory(null); set('tl-active', 0); render(); log('pinned at ' + sp); }
  function cancelPreview() { if (S.ptc == null) return; S.ptc = null; applyHistory(null); go('tl-active', 0, DUR.temporal); render(); }
  function disclosedCount() { return S.mode === 'FOLLOW_LIVE' ? S.LH : S.tc; }
  /* D2: the quiet disclosure. Opening it adds rows to the band (the lines above slide, M2); it never changes the set. */
  function toggleMore() {
    if (S.place !== 'analysis') return;
    S.moreOpen = !S.moreOpen;
    if (S.moreOpen) { set('more', 0); go('more', 1, DUR.band); }
    render(); log('returns disclosure ' + (S.moreOpen ? 'opened' : 'closed'));
  }

  /* ---------------------------------------------------------------------- places ----------- */
  function enterAnalysis() {
    if (S.place !== 'conversation') return; closeMenu();
    S.place = 'analysis';
    if (RM) { set('depth-out', 1); set('depth-in', 0.001); to('depth-in', 1, DUR.resolve); }
    else { to('depth-out', 1, DUR.depthOut); to('depth-in', 1, DUR.depthIn, DUR.depthInDelay); }
    blend('bgd', 1, DUR.depthOut);                                  // D5: the shell darkens as the Conversation lifts away
    go('dock', S.call === 'none' ? 1 : 0, DUR.dock);
    render(); log('Conversation → Analysis');
  }
  function leaveAnalysis() {
    if (S.place !== 'analysis') return; closeMenu();
    S.place = 'conversation'; S.moreOpen = false;
    if (RM) { set('depth-in', 0); set('depth-out', 0.999); to('depth-out', 0, DUR.resolve); }
    else { to('depth-in', 0, DUR.depthOut); to('depth-out', 0, DUR.depthIn, DUR.depthInDelay); }
    blend('bgd', 0, DUR.depthIn, DUR.depthInDelay);                 // and returns to the system appearance with it
    go('dock', 0, DUR.dock, RM ? 0 : 60);
    render(); log('Analysis → Conversation');
  }
  function startCall() {
    if (S.call !== 'none') return;
    S.call = 'connecting'; S.callStart = now(); S.connectAt = now() + 1200;
    if (S.place === 'conversation') enterAnalysis(); else go('dock', 0, DUR.dock);
    render(); log('call: connecting');
  }
  function endCall() { if (S.call === 'none') return; S.call = 'none'; go('dock', S.place === 'analysis' ? 1 : 0, DUR.dock); render(); log('call ended by the reader'); }
  function callSeconds() { return S.call === 'live' ? Math.max(0, Math.floor((now() - S.liveAt) / 1000)) : 0; }

  /* -------------------------------------------------------------- Matching (D3, D4, M1–M7) ---- */
  function cueKind() { return S.matching === 'available' ? 'awaiting' : S.matching === 'arrived' ? 'arrival' : S.matching === 'ended' ? 'ended' : null; }
  function arrive() { set('cue', 0); go('cue', 1, DUR.cue); }
  /* M1 — a bounded proposal awaits this reader (AWAITING_YOU). One quiet line outside the world. */
  function showCue() { if (S.matching !== 'none') return; S.matching = 'available'; arrive(); render(); log('matching: AWAITING_YOU — the cue'); }
  /* M2 — the private proposal is its own place, entered with the depth vocabulary (G2.1, unchanged). */
  function openProposal() {
    if (S.matching !== 'available' && S.matching !== 'unavailable') return; closeMenu();
    if (S.matching === 'available') S.matching = 'reviewing';
    S.place = 'proposal'; S.moreOpen = false; $('prop-scroll').scrollTop = 0;
    if (RM) { set('prop-out', 1); set('prop-in', 0.001); to('prop-in', 1, DUR.resolve); }
    else { to('prop-out', 1, DUR.depthOut); to('prop-in', 1, DUR.depthIn, DUR.depthInDelay); }
    blend('bgd', 0, DUR.depthIn, DUR.depthInDelay);
    render(); log('matching: the proposal (' + (S.who === 'A' ? 'first recipient' : 'candidate') + ' view)');
    setTimeout(function () { var b = $('prop-back'); if (b && !CAPTURE) b.focus(); }, 0);
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
    setTimeout(function () { if (CAPTURE) return; var c = $('cue'); if (c && !c.hidden) c.focus(); else $('gesture').focus(); }, 0);
  }
  /* «أكمّل». The same words for both humans; what it does depends on where the reader stands in time. */
  function proceed() {
    if (S.matching !== 'reviewing') return;
    if (S.who === 'A') {                                             // M3 — FIRST_FORWARD_APPROVED → IN_PROGRESS
      S.matching = 'forwarded'; set('ack', 0); go('ack', 1, DUR.band);
      render(); log('matching: first accepter — received; nothing about the other side is shown');
      return;
    }
    mutualMatchNow();                                                 // M5 — the candidate's acceptance IS the commit
  }
  function notNow() { if (S.matching !== 'reviewing') return; S.matching = 'none'; closeProposal(); S.matching = 'none'; render(); log('matching: CLOSED_BY_YOU'); }
  /* M4 — NO_LONGER_AVAILABLE. One answer for every hidden cause (runtime §21, §31): the reader cannot tell a decline
     from an expiry, a private invalidation or a competing match, and nothing here tries to. */
  function becomeUnavailable() {
    if (S.matching === 'reviewing' || (S.matching === 'available' && S.place === 'proposal')) { S.matching = 'unavailable'; render(); log('matching: NO_LONGER_AVAILABLE (in the proposal)'); return; }
    if (S.matching === 'available') { S.matching = 'none'; set('cue', 0); render(); log('matching: NO_LONGER_AVAILABLE before it was opened — the cue leaves'); return; }
    if (S.matching === 'forwarded') { S.matching = 'ended'; if (S.place === 'analysis') arrive(); render(); log('matching: NO_LONGER_AVAILABLE — the first accepter is told, in the same words'); }
  }
  function dismissEnded() { if (S.matching !== 'ended') return; S.matching = 'none'; set('cue', 0); render(); log('matching: ended notice dismissed'); }
  /* M5 — the SECOND accepter causes the Match now: ONE atomic commit creates exactly one SHARED_WORLD / INTRODUCTION
     (I-07C). The private proposal dissolves where it is; a beat; the rail marker travels to where the new World lives;
     the World RISES — it is being made — and QANDEEL's welcome, the first words ever said there, arrives after it. */
  function mutualMatchNow() {
    S.matching = 'born'; S.world = 'shared'; S.place = 'shared'; S.sharedHow = 'born';
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
  }
  /* M6 — the FIRST accepter, hours later: the Match was committed by the other side. QANDEEL surfaces a new truth in
     the same quiet place; nothing replays the reader's own decision. */
  function matchArrives() {
    if (S.matching !== 'forwarded' && S.matching !== 'none') return;
    S.matching = 'arrived'; if (S.place === 'analysis') arrive();
    render(); log('MATCH_CONCLUDED (first accepter) — the Shared World already exists');
  }
  /* M6 → M7 — entering a World that already exists is ordinary navigation between worlds: the Analysis steps back,
     the marker travels, the World is simply there, fully formed. No rise, no stagger, no birth. */
  function enterShared() {
    if (S.matching !== 'arrived') return; closeMenu();
    S.matching = 'entered'; S.world = 'shared'; S.place = 'shared'; S.sharedHow = 'entered'; S.moreOpen = false;
    var bx = railBox('shared');
    set('welcome', 1);
    if (RM) { set('ana-out', 1); set('shared-in', 0.001); to('shared-in', 1, DUR.resolve); set('mx1', bx.x1); set('mx2', bx.x2); }
    else {
      to('ana-out', 1, DUR.depthOut);
      var goingEnd = bx.x1 < get('mx1');
      to('mx1', bx.x1, goingEnd ? DUR.markerLead : DUR.markerTrail);
      to('mx2', bx.x2, goingEnd ? DUR.markerTrail : DUR.markerLead);
      to('shared-in', 1, DUR.depthIn, DUR.depthInDelay);
    }
    blend('bgd', 0, DUR.depthIn, DUR.depthInDelay);
    render(); log('first accepter enters the existing Shared World');
  }
  function openMenu() { if (!replayEligible()) return; S.replayMenu = true; set('menu', 0); go('menu', 1, DUR.menu); render(); }
  function closeMenu() { if (!S.replayMenu) return; S.replayMenu = false; set('menu', 0); render(); }
  function replayEligible() { return S.place !== 'shared' && S.place !== 'proposal'; }

  /* -------------------------------------------------------------------------- rendering ----- */
  var raf = 0;
  function kick() { if (CAPTURE || raf) return; raf = requestAnimationFrame(function () { raf = 0; tick(); if (busy() || S.call !== 'none') kick(); }); }
  function tick() {
    if (S.call === 'connecting' && now() >= S.connectAt) { S.call = 'live'; S.liveAt = S.connectAt; render(); log('call: live'); }
    paint();
  }
  function railBox(key) {
    var btn = document.querySelector('#rail .it[data-world="' + key + '"] .lb'), r = btn.getBoundingClientRect(), rr = $('rail').getBoundingClientRect();
    return { x1: r.left - rr.left, x2: r.right - rr.left };
  }
  function fmt(n) { return String(n); }
  function mmss(s) { return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  function render() {
    root.setAttribute('data-place', S.place);
    root.setAttribute('data-call', S.call);
    root.setAttribute('data-mode', S.mode);
    root.setAttribute('data-preview', S.ptc != null ? '1' : '0');
    root.setAttribute('data-matching', S.matching);
    root.setAttribute('data-who', S.who);
    $('back').setAttribute('aria-label', S.call !== 'none' ? L.backNameCall.text : L.backName.text);
    $('door').setAttribute('aria-label', S.call !== 'none' ? L.doorNameCall.text : L.door.text);
    $('replay').hidden = !replayEligible();
    $('replay').setAttribute('aria-expanded', S.replayMenu ? 'true' : 'false');
    $('rmenu').hidden = !S.replayMenu;
    $('rmenu-note').hidden = S.call === 'none';
    renderBand();
    renderTimeline();
    var a11y = S.call === 'connecting' ? L.connecting.text : S.call === 'live' ? (S.muted ? L.muted.text : L.micOn.text) : '';
    if ($('call-a11y').textContent !== a11y) $('call-a11y').textContent = a11y;
    $('call-state').textContent = S.call === 'connecting' ? L.connecting.text : '';
    $('mute').setAttribute('aria-pressed', S.muted ? 'true' : 'false');
    $('mute').setAttribute('aria-label', S.muted ? L.unmute.text : L.mute.text);
    $('route').setAttribute('aria-pressed', S.route ? 'true' : 'false');
    Array.prototype.forEach.call(document.querySelectorAll('#rail .it'), function (b) {
      var sel = b.getAttribute('data-world') === S.world; b.classList.toggle('sel', sel); if (sel) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    // the cue: one place, three truths
    var k = cueKind(), cue = $('cue');
    cue.hidden = !(k && S.place === 'analysis');
    if (k) {
      var line = k === 'awaiting' ? L.matchCue.text : k === 'arrival' ? L.arrivalLine.text : L.unavailable.text;
      var act = k === 'awaiting' ? L.matchCueAct.text : k === 'arrival' ? L.arrivalAct.text : L.endedAct.text;
      var cl = $('cue-line');
      if (cl.getAttribute('data-k') !== k) {
        cl.setAttribute('data-k', k);
        /* G2.3 D1: the approved opening message is two sentences. Each starts its own line — the first (the news) in
           primary ink, the second (its basis and invitation) in secondary — and together they read exactly as approved. */
        var cut = k === 'awaiting' ? line.indexOf('. ') : -1;
        if (cut > 0) cl.innerHTML = '<span class="cue-s1">' + esc(line.slice(0, cut + 1)) + '</span> <span class="cue-s2">' + esc(line.slice(cut + 2)) + '</span>';
        else cl.textContent = line;
      }
      if ($('cue-act').textContent !== act) $('cue-act').textContent = act;
      cue.setAttribute('aria-label', k === 'awaiting' ? L.matchCueName.text : k === 'arrival' ? L.arrivalName.text : L.endedName.text);
      cue.setAttribute('data-kind', k);
      if (!cue.hidden) root.style.setProperty('--cue-h', cue.offsetHeight + 'px');
    }
    // the proposal: the reader's own view, or the one neutral outcome
    var gone = S.matching === 'unavailable';
    $('prop-view').hidden = gone; $('prop-gone').hidden = !gone; $('prop-foot').hidden = gone;
    var decided = S.matching === 'forwarded' || S.matching === 'born';
    var next = S.who === 'A' ? L.propNextA.text : L.propNextB.text;
    if ($('prop-next').textContent !== next) $('prop-next').textContent = next;
    $('prop-next').hidden = decided; $('prop-actions').hidden = decided;
    $('prop-ack').hidden = S.matching !== 'forwarded';
    // the Shared World: born now (second accepter) or already there (first accepter)
    var day = L.sharedToday(S.sharedHow === 'entered' ? '9:18' : '9:41');
    if ($('s-day').textContent !== day) $('s-day').textContent = day;
    var t = $('truth-view'); if (t) t.textContent = JSON.stringify(truth(), null, 1);
    scrollEdge();
    paint(); kick();
  }
  /* G2.3: on a short window the proposal scrolls as one reading — view, privacy, decision; a soft edge says there is
     more, and never hides a word (it fades the last 28 pt only while more lies below). */
  function scrollEdge() {
    var ps = $('prop-scroll'); if (!ps) return;
    ps.classList.toggle('more', ps.scrollHeight - ps.clientHeight - ps.scrollTop > 1);
  }

  /* G2.3 — the approved compact Return presentation (G2.3_T11_RETURN_PRESENTATION_AMENDMENT_CANDIDATE.md, §4 of the
     brief). A pure function of T-08's offered set, in T-08's frozen order; it never reads a width, a device or a count.
       · the dominant act is the FIRST OFFERED of exactly two, and nothing else can be dominant:
           RETURN_LIVE_HEAD — the one act that ends the historical stance; directly visible in its one home, the
                              Timeline's live edge (T-05 / T-06 slot, G2.1 S-05), never in the band;
           BACK_ONE_STEP    — the one act defined by the reader's own last step; directly visible in the band;
       · a dominant act → the other offered acts, in T-08's order, go under «طرق العودة» (Return acts only);
       · no dominant act → every offered act is shown directly, exactly as frozen T-11 has it (the exception is off);
       · one act → no «طرق العودة»; no act → no group at all (T-08 §6: an empty set renders no group).
     G2.2 made "the first offered act" dominant whenever the Live Head was not; in every state this fixture can reach the
     two rules agree (the G2.3 rule table proves where they would not). Nothing is merged, renamed or reordered. */
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
  function bandContent() {
    var lines = [], ids = offered();
    if (S.place !== 'analysis') return { lines: lines, acts: [], more: [], compact: false, dominant: null };
    if (S.ptc != null) lines.push({ cls: 'o-temporal', text: L.previewLine(fmt(S.ptc)) });
    else if (S.mode === 'PINNED') {
      lines.push({ cls: 'o-temporal', text: L.temporalPinned(fmt(S.tc)) });
      if (S.LH > S.tc) lines.push({ cls: 'o-live', text: L.liveContinued.text });
    }
    if (S.IF && S.ptc == null) lines.unshift({ cls: 'o-inspect', text: L.inspectRenderable(L.family[S.IF.family]) });
    if (S.ptc != null) return { lines: lines, acts: [], more: [], compact: false, dominant: null };   // a preview offers T-06's own two acts
    var p = presentReturns(ids);
    return { lines: lines, acts: p.direct, more: p.grouped, compact: true, dominant: p.dominant };
  }
  var bandKey = '';
  function retBtn(id, cls) {
    return '<button type="button" class="ret' + (cls ? ' ' + cls : '') + '" data-act="' + id + '" aria-describedby="hint-' + id + '"><span class="lb">' + esc(L.returns[id].label.text) + '</span></button>' +
      '<span class="sr" id="hint-' + id + '">' + esc(L.returns[id].hint.text) + '</span>';
  }
  function renderBand() {
    var c = bandContent(), key = JSON.stringify(c) + S.ptc + '|' + S.moreOpen;
    var show = c.lines.length > 0 || c.acts.length > 0 || c.more.length > 0 || S.ptc != null;
    if (key !== bandKey) {
      bandKey = key;
      var oldH = get('band') > 0.5 ? $('band').offsetHeight : 0, h = '';
      if (c.compact) {
        if (c.lines.length) h += '<p class="o-status r-support">' + c.lines.map(function (l, i) { return '<span class="' + (i ? 'o-live' : l.cls) + '">' + esc(l.text) + '</span>'; }).join(' ') + '</p>';
        if (c.acts.length || c.more.length) {
          h += '<div class="acts" role="group" aria-label="' + esc(L.returnControlsLabel.text) + '">' + c.acts.map(function (id) { return retBtn(id); }).join('');
          if (c.more.length) h += '<button type="button" class="ret more-t" id="more-t" aria-expanded="' + (S.moreOpen ? 'true' : 'false') + '" aria-controls="band-in"><span class="lb">' + esc(L.revealReturns.text) + '</span></button>';
          if (S.moreOpen) h += c.more.map(function (id) { return retBtn(id, 'x'); }).join('');
          h += '</div>';
        }
      } else {
        h = c.lines.map(function (l) { return '<p class="' + l.cls + ' r-support">' + esc(l.text) + '</p>'; }).join('');
        if (S.ptc != null) {
          h += '<div class="acts"><button type="button" class="ret" data-pv="cancel"><span class="lb">' + esc(L.previewCancel.text) + '</span></button>' +
            '<button type="button" class="ret" data-pv="commit"><span class="lb">' + esc(L.previewCommit(fmt(S.ptc))) + '</span></button></div>';
        } else if (c.acts.length) {
          h += '<div class="acts" role="group" aria-label="' + esc(L.returnControlsLabel.text) + '">' + c.acts.map(function (id) { return retBtn(id); }).join('') + '</div>';
        }
      }
      var hadFocus = document.activeElement && document.activeElement.id === 'more-t';
      $('band-in').innerHTML = h;
      if (hadFocus && $('more-t')) $('more-t').focus();
      var newH = show ? $('band').offsetHeight : 0;
      root.style.setProperty('--band-on-h', newH + 'px');
      if (oldH && newH && oldH !== newH && !RM) { set('band-dy', newH - oldH); to('band-dy', 0, DUR.temporal); }
    }
    if (show && get('band') < 0.5 && !anims.band) go('band', 1, DUR.band);
    if (!show && get('band') > 0) { if (RM) set('band', 0); else to('band', 0, DUR.bandOut); }
  }
  var tlKey = '', tlN = 0;
  function renderTimeline() {
    var n = disclosedCount(), cur = S.ptc != null ? S.ptc : S.tc;
    var key = [n, cur, S.mode, S.ptc, S.LH].join('|');
    if (key === tlKey) return; tlKey = key;
    if (tlN && n !== tlN) { if (RM) set('tl-shift', 0); else { set('tl-shift', 16 * (n - tlN)); to('tl-shift', 0, DUR.temporal); } }
    tlN = n;
    $('tl-base').style.width = ((n - 1) * 16 + 12) + 'px';
    var ticks = '';
    for (var i = 1; i <= n; i++) {
      var cls = 'tk' + (i === S.tc && S.ptc == null ? (S.mode === 'PINNED' ? ' pin' : ' cur') : '') + (i === S.ptc ? ' pv' : '');
      ticks += '<span class="' + cls + '" data-sp="' + i + '" style="--i:' + (n - i) + '"></span>';
    }
    $('tl-ticks').innerHTML = ticks;
    $('tl-num').textContent = S.ptc != null ? fmt(S.ptc) : (S.mode === 'PINNED' ? fmt(S.tc) : '');
    $('tl-num').style.setProperty('--i', String(n - cur));
    $('tl-track').setAttribute('aria-valuemin', String(D.fixture.firstMoment)); $('tl-track').setAttribute('aria-valuemax', String(n)); $('tl-track').setAttribute('aria-valuenow', String(cur));
    $('tl-track').setAttribute('aria-valuetext', S.ptc != null ? L.previewLine(fmt(S.ptc)) : S.mode === 'PINNED' ? L.temporalPinned(fmt(S.tc)) : L.temporalLive.text);
    var slot = $('tl-live');
    if (S.mode === 'PINNED') {
      slot.classList.add('ret'); slot.classList.remove('following');
      slot.innerHTML = '<span class="lb">' + esc(L.returns.RETURN_LIVE_HEAD.label.text) + '</span>';
      slot.setAttribute('aria-label', L.returns.RETURN_LIVE_HEAD.label.text); slot.setAttribute('aria-describedby', 'hint-live'); slot.removeAttribute('aria-disabled');
    } else {
      slot.classList.remove('ret'); slot.classList.add('following');
      slot.innerHTML = '<span class="dot" aria-hidden="true"></span>';
      slot.setAttribute('aria-label', L.liveSlotFollowing.text); slot.removeAttribute('aria-describedby'); slot.setAttribute('aria-disabled', 'true');
    }
  }

  /* D5 — the shell's blended chrome. Under system Light, the rail, the status bar, the home indicator, the Replay control,
     the call line and the Replay menu follow `bgd` (1 while the Analysis is the shown place, 0 elsewhere) from the Light
     literals to the dark ones, so the whole Analysis frame is the same frame in either appearance. Under system Dark
     both ends are the same literal and nothing is written. */
  var MIXV = [['--world', 'world'], ['--surface', 'surface'], ['--utterance', 'functional'], ['--primary', 'primary'], ['--secondary', 'secondary'], ['--tertiary', 'tertiary'],
    ['--brass', 'brass'], ['--mark', 'mark'], ['--rest', 'restInk'], ['--sel-ink', 'selectedInk'], ['--marker', 'selectedMarker'], ['--focus', 'focusIndicator'], ['--focus-c', 'focusCompanion'],
    ['--error', 'error'], ['--disabled', 'disabled']];
  var MIX_EL = ['rail', 'composer', 'replay', 'rmenu', 'status', 'homebar'];
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mixRgb(a, b, t) { var A = hexRgb(a), B = hexRgb(b); return [0, 1, 2].map(function (i) { return Math.round(A[i] + (B[i] - A[i]) * t); }); }
  var lastMix = null;
  function appearance() { return root.getAttribute('data-appearance') === 'light' ? 'light' : 'dark'; }
  function applyAppearance() {
    var ap = appearance(), t = get('bgd'), key = ap + '|' + (ap === 'light' ? t.toFixed(4) : '');
    if (key === lastMix) return; lastMix = key;
    var P = D.palettes;
    MIX_EL.forEach(function (id) {
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
    conv.style.opacity = (1 - dOut).toFixed(4);
    conv.style.transform = RM ? 'none' : 'translateY(' + (-22 * dOut).toFixed(2) + 'px)';
    conv.style.visibility = dOut >= 0.999 ? 'hidden' : 'visible';
    var pOut = get('prop-out'), pIn = get('prop-in'), birth = get('birth'), privOut = get('priv-out'), aOut = get('ana-out'), shIn = get('shared-in');
    var inAnalysis = dIn * (1 - pOut) * (1 - aOut);
    var worldOpacity = inAnalysis * get('world-resolve');
    wl.style.opacity = worldOpacity.toFixed(4);
    wl.style.transform = RM ? 'none' : 'translateY(' + (18 * (1 - dIn) - 22 * pOut).toFixed(2) + 'px) scale(' + (0.985 + 0.015 * dIn).toFixed(4) + ')';
    wl.style.visibility = worldOpacity <= 0.001 ? 'hidden' : 'visible';
    $('hdr-conv').style.opacity = (1 - dIn).toFixed(4); $('hdr-conv').style.visibility = dIn >= 0.999 ? 'hidden' : 'visible';
    $('hdr-world').style.opacity = inAnalysis.toFixed(4); $('hdr-world').style.visibility = inAnalysis <= 0.001 ? 'hidden' : 'visible';
    $('replay').style.opacity = (1 - Math.max(pOut, birth, aOut)).toFixed(4);
    var dock = get('dock'), comp = $('composer');
    comp.style.transform = 'translateY(' + (dock * 64).toFixed(2) + 'px)';
    comp.style.visibility = dock >= 0.999 ? 'hidden' : 'visible';
    var band = get('band'), bandEl = $('band');
    bandEl.style.transform = RM ? 'none' : 'translateY(' + (6 * (1 - band) + get('band-dy')).toFixed(2) + 'px)';
    bandEl.style.visibility = band <= 0.001 ? 'hidden' : 'visible';
    bandEl.style.opacity = (band * inAnalysis).toFixed(4);
    var mo = get('more'); Array.prototype.forEach.call(bandEl.querySelectorAll('.ret.x'), function (b) { b.style.opacity = mo.toFixed(4); });
    var tla = get('tl-active'), tl = $('timeline');
    tl.style.setProperty('--act', tla.toFixed(4));
    var shx = (RTL ? -1 : 1) * get('tl-shift');
    $('tl-ticks').style.transform = 'translateX(' + shx.toFixed(2) + 'px)'; $('tl-base').style.transform = 'translateX(' + shx.toFixed(2) + 'px)';
    tl.style.opacity = inAnalysis.toFixed(4); tl.style.visibility = inAnalysis <= 0.001 ? 'hidden' : 'visible';
    var cueOn = cueKind() && S.place === 'analysis' ? get('cue') : 0;
    $('falloff-band').style.opacity = (band * inAnalysis).toFixed(4);
    $('falloff-cue').style.opacity = (cueOn * inAnalysis).toFixed(4);
    $('falloff-bottom').style.opacity = inAnalysis.toFixed(4); $('falloff-top').style.opacity = inAnalysis.toFixed(4);
    $('elapsed').textContent = S.call === 'live' ? mmss(callSeconds()) : '0:00';
    drawTrace();
    var cueEl = $('cue');
    cueEl.style.opacity = (cueOn * inAnalysis).toFixed(4);
    cueEl.style.transform = RM ? 'none' : 'translateY(' + (-6 * (1 - cueOn)).toFixed(2) + 'px)';
    var prop = $('proposal');
    prop.style.opacity = (pIn * (1 - privOut)).toFixed(4);
    prop.style.transform = RM || privOut > 0 ? 'none' : 'translateY(' + (18 * (1 - pIn)).toFixed(2) + 'px) scale(' + (0.985 + 0.015 * pIn).toFixed(4) + ')';
    prop.style.visibility = pIn * (1 - privOut) <= 0.001 ? 'hidden' : 'visible';
    $('prop-ack').style.opacity = get('ack').toFixed(4);
    var sh = $('shared'), born = S.sharedHow === 'born', shP = born ? birth : shIn;
    sh.style.opacity = shP.toFixed(4);
    sh.style.transform = RM || !born ? 'none' : 'translateY(' + (18 * (1 - birth)).toFixed(2) + 'px) scale(' + (0.985 + 0.015 * birth).toFixed(4) + ')';
    sh.style.visibility = shP <= 0.001 ? 'hidden' : 'visible';
    var wel = $('s-welcome'), wv = born ? get('welcome') : 1;
    wel.style.opacity = wv.toFixed(4);
    wel.style.transform = RM || !born ? 'none' : 'translateY(' + (8 * (1 - wv)).toFixed(2) + 'px)';
    var mk = $('marker'); mk.style.transform = 'translateX(' + get('mx1').toFixed(2) + 'px)'; mk.style.width = Math.max(2, get('mx2') - get('mx1')).toFixed(2) + 'px';
    var m = get('menu'), rm = $('rmenu'); rm.style.opacity = m.toFixed(4); rm.style.transform = RM ? 'none' : 'scale(' + (0.97 + 0.03 * m).toFixed(4) + ')';
    if (worldReady) pushCamera(!!camAnim);
  }
  function drawTrace() {
    var path = $('trace-path'); if (!path) return;
    if (S.call !== 'live') { path.setAttribute('d', 'M0 10 H10'); return; }
    var t = now() - S.liveAt, n = 48, d = '';
    for (var i = 0; i < n; i++) {
      var tt = t - (n - 1 - i) * 90, lv = RM ? 0 : level(tt);
      var x = (RTL ? (n - 1 - i) : i) / (n - 1) * 10, y = 10 - lv * 8 * (i % 2 ? 1 : -1);
      d += (i ? ' L' : 'M') + x.toFixed(3) + ' ' + y.toFixed(3);
    }
    path.setAttribute('d', d);
  }
  function level(t) { if (t < 0 || S.muted) return 0; var cyc = t % 20000; var speaking = (cyc > 400 && cyc < 4000) || (cyc > 9200 && cyc < 12800) || (cyc > 5000 && cyc < 8200) || (cyc > 13800 && cyc < 17000); return speaking ? 0.35 + 0.35 * Math.abs(Math.sin(t / 97) * Math.cos(t / 163)) : 0.04; }

  /* -------------------------------------------------------------------------- gestures ------ */
  var gl = $('gesture'), pts = {}, g0 = null;
  function toStage(e) { var r = root.getBoundingClientRect(); var x = e.clientX - r.left, y = e.clientY - r.top; return { x: x + (stageW - phoneW) / 2, y: y }; }
  function worldAt(p, c) { var z = stageW / c.field; return { x: c.cx + (p.x - stageW / 2) / z, y: c.cy + (p.y - stageH / 2) / z }; }
  gl.addEventListener('pointerdown', function (e) {
    if (S.place !== 'analysis') return;
    gl.setPointerCapture(e.pointerId); pts[e.pointerId] = toStage(e);
    if (!g0) g0 = { pre: snapshot(), cam: copyCam(S.cam), moved: false, start: toStage(e), t: performance.now() };
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
  gl.addEventListener('keydown', function (e) {
    var c = S.cam, win = c.field * phoneW / stageW / 3, pre = snapshot(), dest = null;
    if (e.key === 'ArrowLeft') dest = { cx: c.cx - win, cy: c.cy, field: c.field };
    else if (e.key === 'ArrowRight') dest = { cx: c.cx + win, cy: c.cy, field: c.field };
    else if (e.key === 'ArrowUp') dest = { cx: c.cx, cy: c.cy - win, field: c.field };
    else if (e.key === 'ArrowDown') dest = { cx: c.cx, cy: c.cy + win, field: c.field };
    else if (e.key === '+' || e.key === '=') dest = { cx: c.cx, cy: c.cy, field: c.field / 2.37 };
    else if (e.key === '-') dest = { cx: c.cx, cy: c.cy, field: c.field * 2.37 };
    if (!dest) return; e.preventDefault(); travelTo(dest); actCameraGesture(pre);
  });

  var track = $('tl-track'), tdown = false;
  function spAt(e) { var r = track.getBoundingClientRect(), n = disclosedCount(), step = 16; var fromEnd = RTL ? (e.clientX - r.left) : (r.right - e.clientX); return Math.round(n - (fromEnd - 8) / step); }
  track.addEventListener('pointerdown', function (e) { if (S.place !== 'analysis') return; tdown = true; track.setPointerCapture(e.pointerId); go('tl-active', 1, DUR.temporal); previewAt(spAt(e)); });
  track.addEventListener('pointermove', function (e) { if (tdown) previewAt(spAt(e)); });
  track.addEventListener('pointerup', function () { if (!tdown) return; tdown = false; commitPreview(); });
  track.addEventListener('pointercancel', function () { tdown = false; cancelPreview(); });
  track.addEventListener('keydown', function (e) {
    var cur = S.ptc != null ? S.ptc : S.tc;
    var step = (e.key === 'ArrowLeft') === RTL ? 1 : -1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); go('tl-active', 1, DUR.temporal); previewAt(cur + step); }
    else if (e.key === 'Enter') { e.preventDefault(); commitPreview(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelPreview(); }
  });
  $('tl-live').addEventListener('click', function () { if (S.mode === 'PINNED') doReturn('RETURN_LIVE_HEAD'); });

  /* ---------------------------------------------------------------- wiring the controls ---- */
  function on(id, fn) { var el = $(id); if (el) el.addEventListener('click', fn); }
  on('back', leaveAnalysis); on('door', enterAnalysis);
  on('replay', function () { S.replayMenu ? closeMenu() : openMenu(); });
  on('call', startCall); on('end-call', endCall);
  on('mute', function () { S.muted = !S.muted; render(); }); on('route', function () { S.route = !S.route; render(); });
  on('cue', function () { var k = cueKind(); if (k === 'awaiting') openProposal(); else if (k === 'arrival') enterShared(); else if (k === 'ended') dismissEnded(); });
  on('prop-back', closeProposal); on('proceed', proceed); on('not-now', notNow);
  $('prop-scroll').addEventListener('scroll', scrollEdge, { passive: true });
  $('band').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'more-t') toggleMore();
    else if (b.getAttribute('data-act')) doReturn(b.getAttribute('data-act'));
    else if (b.getAttribute('data-pv') === 'cancel') cancelPreview(); else if (b.getAttribute('data-pv') === 'commit') commitPreview();
  });
  Array.prototype.forEach.call(document.querySelectorAll('#rail .it'), function (b) { b.addEventListener('click', function () { log('rail: ' + b.getAttribute('data-world') + ' (other areas are outside this proof)'); }); });
  Array.prototype.forEach.call(document.querySelectorAll('#rmenu .mi'), function (b) { b.addEventListener('click', function () { closeMenu(); log('replay entry chosen — the Replay player is not part of this proof'); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (S.replayMenu) closeMenu();
    else if (S.moreOpen) { toggleMore(); var t = $('more-t'); if (t) t.focus(); }
    else if (S.place === 'proposal') closeProposal();
  });
  document.addEventListener('pointerdown', function (e) { var b = e.target.closest && e.target.closest('button'); if (b) b.classList.add('down'); });
  document.addEventListener('pointerup', function () { Array.prototype.forEach.call(document.querySelectorAll('button.down'), function (b) { b.classList.remove('down'); }); });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
    if (root.getAttribute('data-appearance-source') !== 'system') return;
    root.setAttribute('data-appearance', e.matches ? 'light' : 'dark'); lastMix = null; render();
  });

  /* -------------------------------------------------------- deterministic state entry --------- */
  var FIX = D.fixture;
  function reset() {
    anims = {}; vals = {}; camAnim = null;
    S.place = 'analysis'; S.world = 'mine'; S.LH = FIX.builtAt; S.mode = 'FOLLOW_LIVE'; S.tc = FIX.builtAt; S.ptc = null;
    S.cam = copyCam(WORLD_VP); S.IF = null; S.RH = []; S.journey = null; S.rhN = 0;
    S.call = 'none'; S.muted = false; S.route = true; S.matching = 'none'; S.who = S.whoPref; S.sharedHow = null;
    S.moreOpen = false; S.replayMenu = false;
    $('prop-scroll').scrollTop = 0;                                   // G2.3: every entry starts the proposal at its top
    set('depth-in', 1); set('depth-out', 1); set('dock', 1); set('band', 0); set('tl-active', 0); set('world-resolve', 1); set('bgd', 1);
    set('prop-in', 0); set('prop-out', 0); set('birth', 0); set('priv-out', 0); set('cue', 0); set('ack', 0); set('menu', 0); set('more', 0);
    set('ana-out', 0); set('shared-in', 0); set('welcome', 0);
    var bx = railBox('mine'); set('mx1', bx.x1); set('mx2', bx.x2);
    histKey = ''; tlKey = ''; tlN = 0; bandKey = ''; lastMix = null;
  }
  function settleAll() { Object.keys(anims).forEach(function (k) { set(k, anims[k].to); }); camAnim = null; }
  function hit(i) { var o = G.objectXY(i); return { index: i, label: null, kind: 'OPEN', focus: G.focusIndex() === i, x: o.x, y: o.y }; }
  function inProposal() { S.place = 'proposal'; set('prop-in', 1); set('prop-out', 1); set('bgd', 0); }
  function inShared(how) { S.world = 'shared'; S.place = 'shared'; S.sharedHow = how; set('bgd', 0); set('welcome', 1); var bx = railBox('shared'); set('mx1', bx.x1); set('mx2', bx.x2);
    if (how === 'born') { set('prop-in', 1); set('prop-out', 1); set('priv-out', 1); set('birth', 1); } else { set('ana-out', 1); set('shared-in', 1); } }
  var STATES = {
    CONV: function () { set('depth-in', 0); set('depth-out', 0); set('dock', 0); set('bgd', 0); S.place = 'conversation'; },
    P1: function () { },
    P2: function () { var pre = snapshot(); S.cam = copyCam(G.pathCamera(0.5)); append('MAP_CAMERA', pre); },
    P3: function () {
      STATES.P2();
      actInspect(hit(G.focusIndex()));
      var pre = snapshot(); S.cam = copyCam(G.pathCamera(1)); append('MAP_CAMERA', pre);
    },
    P4: function () {
      S.LH = 17; S.tc = 17;
      var pre0 = snapshot(); S.cam = copyCam(G.pathCamera(0.5)); append('MAP_CAMERA', pre0);
      var pre = snapshot(); S.mode = 'PINNED'; S.tc = 14; append('TEMPORAL_COMMIT', pre);
    },
    P5: function () { set('dock', 0); S.call = 'live'; S.liveAt = now() - 82000; S.LH = 16; S.tc = 16; },
    // ---- the approved compact Return presentation, with «طرق العودة» disclosed (G2.2's R_P3_OPEN / R_P4_OPEN)
    P3_OPEN: function () { STATES.P3(); S.moreOpen = true; set('more', 1); },
    P4_OPEN: function () { STATES.P4(); S.moreOpen = true; set('more', 1); },
    // ---- the Matching process
    M1_CUE: function () { S.matching = 'available'; set('cue', 1); },
    M1_CUE_MID: function () { STATES.P2(); STATES.M1_CUE(); },
    M2_PROPOSAL_A: function () { S.who = 'A'; S.matching = 'reviewing'; inProposal(); },
    M2_PROPOSAL_B: function () { S.who = 'B'; S.matching = 'reviewing'; inProposal(); },
    M3_ACK: function () { STATES.M2_PROPOSAL_A(); S.matching = 'forwarded'; set('ack', 1); },
    M3_AFTER: function () { S.who = 'A'; S.matching = 'forwarded'; },
    M4_UNAVAILABLE: function () { S.who = 'B'; S.matching = 'unavailable'; inProposal(); },
    M4_ENDED_A: function () { S.who = 'A'; S.matching = 'ended'; set('cue', 1); },
    M5_BORN: function () { S.who = 'B'; S.matching = 'born'; inShared('born'); },
    M6_ARRIVAL: function () { S.who = 'A'; S.matching = 'arrived'; set('cue', 1); },
    M6_ENTERED: function () { S.who = 'A'; S.matching = 'entered'; inShared('entered'); },
  };
  function enter(name) {
    if (!STATES[name]) throw new Error('unknown state ' + name);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    reset(); STATES[name](); settleAll();
    histKey = ''; applyHistory(null); lastWorldKey = ''; render(); settleAll(); paint();
    S.state = name;
    log('entered ' + name);
    return truth();
  }
  function renderedActs() {
    var a = Array.prototype.map.call(document.querySelectorAll('#band [data-act]'), function (b) { return b.getAttribute('data-act'); });
    if (S.mode === 'PINNED' && S.place === 'analysis') a.push('RETURN_LIVE_HEAD@timeline');
    return a;
  }
  function truth() {
    var w = offeredWhy(), c = bandContent();
    return { state: S.state || null, place: S.place, rail: S.world, TM: S.mode, TC: S.tc, PTC: S.ptc, LH: S.LH, disclosedMoments: disclosedCount(),
      camera: { cx: +S.cam.cx.toFixed(2), cy: +S.cam.cy.toFixed(2), field: +S.cam.field.toFixed(2), atWorldViewpoint: atWorld() },
      IF: S.IF ? { family: S.IF.family, familyWord: L.family[S.IF.family], focusSingleton: !!S.IF.focus } : null,
      RH: S.RH.map(function (e) { return e.act; }), journeyOrigin: journeyAlive(),
      offered: offered(), offeredWhy: w, rendered: renderedActs(), dominant: c.dominant, moreOpen: S.moreOpen,
      visibleByDefault: c.acts.concat(offered().indexOf('RETURN_LIVE_HEAD') >= 0 ? ['RETURN_LIVE_HEAD@timeline'] : []), disclosed: c.more,
      bandLines: c.lines.map(function (l) { return l.text; }),
      call: S.call, matching: S.matching, who: S.who, cue: S.place === 'analysis' ? cueKind() : null, sharedHow: S.sharedHow,
      appearance: appearance(), analysisShellDark: +get('bgd').toFixed(3),
      replayVisible: replayEligible(), replayMenu: S.replayMenu, world: G ? G.state() : null };
  }
  var logEl = null, logLines = [];
  function log(s) { logLines.push(s); if (logLines.length > 7) logLines.shift(); if (!logEl) logEl = $('act-log'); if (logEl) logEl.textContent = logLines.join('\n'); }

  window.__G21 = window.__G22 = window.__G23 = {
    ready: null, enter: enter, truth: truth, render: render, paint: paint,
    rule: presentReturns, dominance: DOMINANCE.slice(),
    clock: function (t) { vclock = t; tick(); return true; },
    act: function (name, arg) {
      var fns = { enterAnalysis: enterAnalysis, leaveAnalysis: leaveAnalysis, startCall: startCall, endCall: endCall, commitTurn: commitTurn,
        previewAt: previewAt, commitPreview: commitPreview, cancelPreview: cancelPreview, toggleMore: toggleMore,
        showCue: showCue, openProposal: openProposal, closeProposal: closeProposal, proceed: proceed, notNow: notNow,
        becomeUnavailable: becomeUnavailable, dismissEnded: dismissEnded, matchArrives: matchArrives, enterShared: enterShared,
        openMenu: openMenu, closeMenu: closeMenu, travelTo: travelTo, inspectFocus: function () { actInspect(hit(G.focusIndex())); },
        cameraTo: function (a) { var pre = snapshot(); travelTo(typeof a === 'number' ? G.pathCamera(a) : a); actCameraGesture(pre); },
        setWho: function (v) { S.whoPref = v; S.who = v; } };
      if (ACTS[name]) { doReturn(name); return truth(); }
      if (!fns[name]) throw new Error('unknown act ' + name);
      fns[name](arg); render(); return truth();
    },
    busy: busy, bridge: function () { return G; }, geometry: function () { return { phoneW: phoneW, phoneH: phoneH, stageW: stageW, stageH: stageH }; },
    reducedMotion: RM, capture: CAPTURE,
    screenOf: function (i) {
      var o = G.objectXY(i), c = currentCam(), z = stageW / c.field;
      return o ? { x: (o.x - c.cx) * z + phoneW / 2, y: (o.y - c.cy) * z + stageH / 2 } : null;
    },
    focusIndex: function () { return G.focusIndex(); },
    pathCamera: function (A) { return G.pathCamera(A); },
    press: function (sel, on2) { var el = document.querySelector(sel); if (el) el.classList.toggle('down', !!on2); return !!el; },
    setAppearance: function (v) { root.setAttribute('data-appearance', v); root.setAttribute('data-appearance-source', 'review'); lastMix = null; render(); return appearance(); },
  };

  /* -------------------------------------------------------------------------- review ------ */
  function syncToggles() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-toggle]'), function (b) {
      var g = b.getAttribute('data-toggle'), v = b.getAttribute('data-v');
      var cur = g === 'who' ? S.whoPref : (root.getAttribute('data-appearance-source') === 'system' ? 'system' : appearance());
      b.setAttribute('aria-pressed', String(cur === v));
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-state]'), function (b) { b.addEventListener('click', function () { enter(b.getAttribute('data-state')); syncToggles(); }); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-sim]'), function (b) {
    b.addEventListener('click', function () { var a = b.getAttribute('data-sim'); try { window.__G22.act(a); } catch (err) { log(String(err.message || err)); } });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-toggle]'), function (b) {
    b.addEventListener('click', function () {
      var g = b.getAttribute('data-toggle'), v = b.getAttribute('data-v');
      if (g === 'who') { S.whoPref = v; S.who = v; render(); }
      else if (v === 'system') { root.setAttribute('data-appearance-source', 'system'); root.setAttribute('data-appearance', matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); lastMix = null; render(); }
      else window.__G22.setAppearance(v);
      syncToggles();
    });
  });

  reset(); render();
  window.__G22.ready = document.fonts.load('400 17px Estedad').then(function () { return document.fonts.load('500 14px Estedad'); })
    .then(function () { return document.fonts.load('600 26px Estedad'); }).then(function () { return document.fonts.ready; })
    .then(loadWorld).then(function () {
      var st = params.get('state'); enter(st && STATES[st] ? st : 'P1');
      syncToggles();
      root.setAttribute('data-ready', '1');
      return true;
    }).catch(function (err) { window.__err = String(err && (err.stack || err.message) || err); root.setAttribute('data-ready', 'error'); log('ERROR ' + (err && err.message)); throw err; });
})();
