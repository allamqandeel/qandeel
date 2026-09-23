/* G1.1-R3 prototype runtime — plain script, inlined by build.mjs. No framework, no dependency.
 *
 * STATE is small and canonical-shaped; it is NOT a second Product state model. It is the minimum a proof
 * needs to be interactable: which World the reader is in, how deep they are inside MY_WORLD (Conversation
 * or its Analysis), which way they are talking (writing / voice note / live call), and the Replay entry.
 *
 * The R3 law this file enforces: a MODE is not a PLACE. Writing, a voice note and a live call are three
 * ways of talking inside ONE conversation; Conversation and Analysis are two depths of it. A live call
 * opens on the Analysis (R3 §8), but moving between the two depths never ends, restarts or duplicates the
 * call — S.call is untouched by enterWorld / leaveWorld.
 *
 * MOTION is a pure function of a clock. In live mode the clock is performance.now(); in capture mode it
 * is a number the capture tool sets, so every frame is a deterministic, re-renderable state. Every animated
 * scalar starts from its CURRENT presentation value, so any motion can be interrupted without a jump.
 * State is committed BEFORE motion explains it: an animation that never finishes changes nothing.
 */
(function () {
  'use strict';
  var Q = window.__G11;
  var params = new URLSearchParams(location.search);
  var CAPTURE = params.get('capture') === '1';
  var root = document.getElementById('phone');

  var clockT = 0;
  function now() { return CAPTURE ? clockT : performance.now(); }

  // T-10's single curve: cubic-bezier(0.23, 1, 0.32, 1). Never ease-in.
  function bezier(p1x, p1y, p2x, p2y) {
    function a(a1, a2) { return 1 - 3 * a2 + 3 * a1; }
    function b(a1, a2) { return 3 * a2 - 6 * a1; }
    function c(a1) { return 3 * a1; }
    function calc(t, a1, a2) { return ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t; }
    function slope(t, a1, a2) { return 3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1); }
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i++) { var s = slope(t, p1x, p2x); if (Math.abs(s) < 1e-6) break; t -= (calc(t, p1x, p2x) - x) / s; }
      var lo = 0, hi = 1; for (var j = 0; j < 20 && Math.abs(calc(t, p1x, p2x) - x) > 1e-6; j++) { if (calc(t, p1x, p2x) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return calc(t, p1y, p2y);
    };
  }
  var EASE = bezier(0.23, 1, 0.32, 1);

  /* durations (ms), from T-10 / G1.1 — R3 adds no new duration */
  var DUR = { resolve: 140, markerLead: 200, markerTrail: 280, dock: 220, depthOut: 200, depthIn: 320, depthInDelay: 100, voice: 220 };
  var RM = params.get('rm') === '1' || (!CAPTURE && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  var vals = {}, anims = {};
  function get(k) {
    var a = anims[k]; if (!a) return vals[k];
    var p = (now() - a.start - (a.delay || 0)) / a.dur;
    if (p <= 0) return a.from;
    if (p >= 1) { vals[k] = a.to; delete anims[k]; return a.to; }
    return a.from + (a.to - a.from) * EASE(p);
  }
  function set(k, v) { delete anims[k]; vals[k] = v; }
  function to(k, v, dur, delay) {
    var cur = get(k);
    if (!dur || cur === v) { set(k, v); return; }
    anims[k] = { from: cur, to: v, start: now(), dur: dur, delay: delay || 0 };
    vals[k] = v;
    kick();
  }
  // Under Reduced Motion every change is the same change, taken without travel: a short resolve for
  // things that appear, an instant set for things that leave (animate-expo §9: fewer and gentler).
  function go(k, v, dur, delay) { if (RM) { if (v > get(k)) { set(k, Math.max(get(k), 0.001)); to(k, v, DUR.resolve); } else set(k, v); } else to(k, v, dur, delay); }
  function busy() { for (var k in anims) return true; return false; }

  /* ------------------------------------------------------------------- the state --------- */
  var S = {
    world: 'mine',          // 'mine' | 'shared' | 'public' — the three canonical World types
    depth: 'conversation',  // 'conversation' | 'world' — the Conversation or its Analysis
    composer: 'idle',       // 'idle' (writing) | 'note' (recording a voice note)
    call: 'none',           // 'none' | 'live'
    muted: false,
    menu: false,            // the Replay entry (ASIDE)
    pick: false,            // choosing a part of the conversation for Replay
    range: null,            // [first, last] turn indices while picking
    preview: false,         // the Replay preview step (PASSAGE boundary)
    noteStart: 0, callStart: 0,
  };

  var el = function (id) { return document.getElementById(id); };
  var railBtns = Array.prototype.slice.call(document.querySelectorAll('#rail .it'));
  var dests = { mine: el('dest-mine'), shared: el('dest-shared'), public: el('dest-public') };
  var conv = el('conv'), world = el('world'), composer = el('composer'), marker = el('marker');
  var hdrConv = el('hdr-conv'), hdrWorld = el('hdr-world'), hdrPick = el('hdr-pick'), replayBtn = el('replay');
  var trace = el('trace'), tracePath = el('trace-path'), traceOld = el('trace-old');
  var elapsed = el('elapsed'), vlabel = el('vlabel'), back = el('back');
  var rmenu = el('rmenu'), rprev = el('rprev'), picks = el('picks'), pickCount = el('pick-count'), pickGo = el('pick-go');

  function labelBox(btn) {
    var lab = btn.querySelector('.lb');
    var r = lab.getBoundingClientRect(), rr = el('rail').getBoundingClientRect();
    return { x1: r.left - rr.left, x2: r.right - rr.left };
  }
  function idx(k) { return ['mine', 'shared', 'public'].indexOf(k); }
  function turns() { return Array.prototype.slice.call(document.querySelectorAll('.thread .t')); }

  /* Replay eligibility (R3 §10): only once the conversation holds committed material of the reader's. The
     opener alone is not material — a brand-new conversation advertises no Replay. */
  function eligible() { return !!document.querySelector('.thread .t.me'); }
  /* The composer is visible whenever talking is happening or possible here: in the Conversation, and
     during a voice note or a live call wherever the reader is (the call's controls stay reachable). */
  function wantDock() { return (S.call === 'live' || S.composer === 'note' || (S.world === 'mine' && S.depth === 'conversation' && !S.pick)) ? 0 : 1; }
  function wantVoice() { return (S.call === 'live' || S.composer === 'note') ? 1 : 0; }

  function initVals() {
    Object.keys(dests).forEach(function (k) { set('op-' + k, k === S.world ? 1 : 0); });
    var bx = labelBox(railBtns[idx(S.world)]);
    set('mx1', bx.x1); set('mx2', bx.x2);
    set('dock', wantDock());
    set('depth-out', S.depth === 'world' ? 1 : 0);
    set('depth-in', S.depth === 'world' ? 1 : 0);
    set('voice', wantVoice());
  }

  /* ---------------------------------------------------------------------- acts ----------- */
  function selectWorld(k) {
    if (k === S.world) return;
    closeMenu(true); if (S.pick) exitPick(true);
    var from = S.world; S.world = k;
    syncRail();
    set('op-' + from, 0);
    set('op-' + k, RM ? 0.001 : 0);
    to('op-' + k, 1, DUR.resolve);
    var bx = labelBox(railBtns[idx(k)]);
    var goingEnd = bx.x1 < get('mx1');
    if (RM) { set('mx1', bx.x1); set('mx2', bx.x2); }
    else { to('mx1', bx.x1, goingEnd ? DUR.markerLead : DUR.markerTrail); to('mx2', bx.x2, goingEnd ? DUR.markerTrail : DUR.markerLead); }
    go('dock', wantDock(), DUR.dock);
    commit();
  }

  function enterWorld() {
    if (S.depth === 'world' || S.world !== 'mine') return;
    closeMenu(true);
    S.depth = 'world';
    if (RM) { set('depth-out', 1); set('depth-in', 0.001); to('depth-in', 1, DUR.resolve); }
    else { to('depth-out', 1, DUR.depthOut); to('depth-in', 1, DUR.depthIn, DUR.depthInDelay); }
    go('dock', wantDock(), DUR.dock);
    commit();
  }
  function leaveWorld() {
    if (S.depth !== 'world') return;
    closeMenu(true);
    S.depth = 'conversation';
    // The exact reverse path, landing at exactly the scroll position the conversation was left at.
    if (RM) { set('depth-in', 0); set('depth-out', 0.999); to('depth-out', 0, DUR.resolve); }
    else { to('depth-in', 0, DUR.depthOut); to('depth-out', 0, DUR.depthIn, DUR.depthInDelay); }
    go('dock', wantDock(), DUR.dock, RM ? 0 : 60);
    commit();
  }

  /* ---- Voice Note: Conversation-first. Recording never moves the reader to another depth. */
  function startNote() {
    if (S.composer === 'note' || S.call === 'live') return;
    S.composer = 'note'; S.noteStart = now(); resetSamples();
    go('voice', 1, DUR.voice);
    liveLevel.start(); commit(); announce(Q.copy.recording.text);
  }
  function stopNote() { S.composer = 'idle'; go('voice', wantVoice(), DUR.voice); liveLevel.stop(); go('dock', wantDock(), DUR.dock); commit(); }
  function sendNote() {
    if (S.composer !== 'note') return;
    var ms = now() - S.noteStart, sec = Math.max(1, Math.round(ms / 1000));
    var dur = Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
    stopNote();
    // The note lands on the reader's side like any turn. The prototype has no speech runtime, so it shows
    // no transcript: nothing is invented (the fixture history shows where a committed transcript would sit).
    var t = document.createElement('div'); t.className = 't me voice'; t.setAttribute('data-who', 'me'); t.setAttribute('data-kind', 'voice');
    t.innerHTML = '<span class="sr"></span><div class="vn"><button class="play" type="button"></button>' + Q.wave + '<span class="dur r-meta num"></span></div>';
    t.querySelector('.sr').textContent = Q.copy.speakerMe.text + ': ';
    var pb = t.querySelector('.play'); pb.setAttribute('aria-label', Q.copy.play.text + (root.getAttribute('dir') === 'rtl' ? '، ' : ', ') + dur);
    pb.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.6 6.2v11.6l9.2-5.8z" fill="currentColor"/></svg>';
    t.querySelector('.dur').textContent = dur;
    document.querySelector('.thread .new').appendChild(t);
    afterAppend();
  }
  function cancelNote() { if (S.composer !== 'note') return; stopNote(); announce(''); }

  /* ---- Live Call: Analysis-first (R3 §8). One call, whichever depth is on screen. */
  function startCall() {
    if (S.call === 'live') return;
    closeMenu(true); if (S.pick) exitPick(true);
    if (S.composer === 'note') stopNote();
    S.call = 'live'; S.muted = false; S.callStart = now(); resetSamples();
    go('voice', 1, DUR.voice);
    liveLevel.start();
    if (S.world === 'mine' && S.depth !== 'world') enterWorld(); else { go('dock', wantDock(), DUR.dock); commit(); }
    announce(Q.copy.call.text);
  }
  function endCall() {
    if (S.call !== 'live') return;
    var sec = Math.max(1, Math.round((now() - S.callStart) / 1000));
    S.call = 'none'; liveLevel.stop();
    go('voice', 0, DUR.voice);
    go('dock', wantDock(), DUR.dock, RM ? 0 : 120);
    // What the call leaves behind in the history is a RUNTIME dependency (R3 §8, §11): canonical Personal
    // conversation units are TEXT, and no reviewed Personal call source exists. The proof records only that
    // a call happened and how long it ran — no transcript, no audio.
    var m = el('call-marker'); if (m) m.textContent = Q.copy.callRecord.text + ' · ' + Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
    if (m) m.id = '';
    commit(); announce('');
    var d = el('mic'); if (d && document.activeElement === el('end-call')) d.focus();
  }
  function toggleMute() { S.muted = !S.muted; el('mute').setAttribute('aria-pressed', S.muted ? 'true' : 'false'); }
  function callMarker() {
    if (el('call-marker')) return;
    var sc = el('scroll'), pinned = sc && sc.scrollHeight - sc.scrollTop - sc.clientHeight < 4;
    var p = document.createElement('p'); p.className = 'day r-meta'; p.id = 'call-marker';
    p.textContent = Q.copy.callStarted.text + ' 9:52';
    document.querySelector('.thread .new').appendChild(p);
    // A reader who was at the latest line stays at the latest line; one who had scrolled back is not moved.
    if (pinned) sc.scrollTop = sc.scrollHeight;
  }

  /* ---- Writing */
  function send() {
    var input = el('input'), v = input.value.trim(); if (!v) return;
    var box = document.querySelector('.thread .new'), t = document.createElement('div'), sr = document.createElement('span'), p = document.createElement('p');
    t.className = 't me'; t.setAttribute('data-who', 'me');
    sr.className = 'sr'; sr.textContent = Q.copy.speakerMe.text + ': ';
    p.className = 'tx r-body'; p.setAttribute('dir', paragraphDir(v, root.getAttribute('dir'))); p.textContent = v;
    t.appendChild(sr); t.appendChild(p); box.appendChild(t);
    input.value = ''; syncSend();
    afterAppend();
  }
  function afterAppend() { var sc = el('scroll'); if (sc) sc.scrollTop = sc.scrollHeight; commit(); }

  /* ---- Replay: an action on the current conversation, never a place (R3 §10). */
  function openMenu() {
    if (!eligible() || S.menu) return;
    S.menu = true; commit();
    var first = rmenu.querySelector('.mi'); if (first && !CAPTURE) first.focus();
  }
  function closeMenu(silent) { if (!S.menu) return; S.menu = false; commit(); if (!silent) replayBtn.focus(); }
  function choose(scope) {
    closeMenu(true);
    if (scope === 'full') { S.range = null; openPreview(); return; }
    enterPick();
  }
  function enterPick() {
    if (S.depth === 'world') leaveWorld();
    S.pick = true; S.range = null; go('dock', wantDock(), 0); commit();
    var ts = turns(); if (ts.length && !CAPTURE) ts[ts.length - 1].focus();
  }
  function exitPick(silent) { S.pick = false; S.range = null; go('dock', wantDock(), 0); commit(); if (!silent) replayBtn.focus(); }
  function tapTurn(i) {
    if (!S.pick) return;
    if (!S.range || S.range[0] !== S.range[1]) S.range = [i, i];
    else S.range = [Math.min(S.range[0], i), Math.max(S.range[0], i)];
    commit();
  }
  function openPreview() { S.preview = true; commit(); if (!CAPTURE) el('rprev-x').focus(); }
  function closePreview() { S.preview = false; commit(); (S.pick ? pickGo : replayBtn).focus(); }

  /* ------------------------------------------------ accessibility state follows state ---- */
  function syncRail() {
    railBtns.forEach(function (b) {
      var on = b.getAttribute('data-world') === S.world;
      b.classList.toggle('sel', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  function syncPicks() {
    var ts = turns();
    ts.forEach(function (t, i) {
      if (S.pick) { t.setAttribute('role', 'checkbox'); t.setAttribute('tabindex', '0'); t.setAttribute('aria-checked', S.range && i >= S.range[0] && i <= S.range[1] ? 'true' : 'false'); }
      else { t.removeAttribute('role'); t.removeAttribute('tabindex'); t.removeAttribute('aria-checked'); }
    });
    picks.innerHTML = '';
    if (!S.pick) return;
    var host = picks.parentElement.getBoundingClientRect(), dotsY = [];
    ts.forEach(function (t, i) {
      var r = t.getBoundingClientRect(), d = document.createElement('span');
      var on = S.range && i >= S.range[0] && i <= S.range[1];
      d.className = 'pk' + (on ? ' on' : ''); var y = r.top - host.top + 12; d.style.top = y + 'px'; picks.appendChild(d); dotsY.push(y);
    });
    if (S.range && S.range[1] > S.range[0]) { var ln = document.createElement('span'); ln.className = 'rng'; ln.style.top = (dotsY[S.range[0]] + 7) + 'px'; ln.style.height = (dotsY[S.range[1]] - dotsY[S.range[0]]) + 'px'; picks.insertBefore(ln, picks.firstChild); }
    var n = S.range ? S.range[1] - S.range[0] + 1 : 0;
    pickCount.textContent = n ? Q.counts[n] || String(n) : Q.copy.pickHint.text;
    pickGo.setAttribute('aria-disabled', n ? 'false' : 'true');
  }
  function commit() {
    syncRail();
    Object.keys(dests).forEach(function (k) {
      var on = k === S.world;
      dests[k].toggleAttribute('inert', !on || S.preview);
      dests[k].setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    var inWorld = S.depth === 'world', mine = S.world === 'mine';
    conv.toggleAttribute('inert', inWorld); world.toggleAttribute('inert', !inWorld);
    hdrConv.toggleAttribute('inert', inWorld || !mine || S.pick);
    hdrWorld.toggleAttribute('inert', !inWorld || !mine);
    hdrPick.hidden = !S.pick;
    var elig = eligible();
    root.setAttribute('data-replay', elig && mine && !S.pick ? '1' : '0');
    replayBtn.setAttribute('aria-expanded', S.menu ? 'true' : 'false');
    root.classList.toggle('rmenu-open', S.menu);
    root.classList.toggle('rprev-open', S.preview);
    root.setAttribute('data-pick', S.pick ? '1' : '0');
    composer.toggleAttribute('inert', wantDock() === 1 || S.pick || S.preview);
    el('pickbar').toggleAttribute('inert', !S.pick || S.preview);
    el('rail').toggleAttribute('inert', S.preview);
    el('hdr').toggleAttribute('inert', S.preview);
    back.setAttribute('aria-label', S.call === 'live' ? Q.copy.backNameCall.text : Q.copy.backName.text);
    vlabel.textContent = S.call === 'live' ? Q.copy.call.text : Q.copy.recording.text;
    if (S.call === 'live') callMarker();
    root.setAttribute('data-world', S.world);
    root.setAttribute('data-depth', S.depth);
    root.setAttribute('data-composer', S.composer);
    root.setAttribute('data-call', S.call);
    syncShared();
    syncPicks();
    render();
  }
  var live = el('live');
  function announce(t) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); } }

  /* ---- Shared area (R3 §12): the heading is derived from the number of rows actually shown — the words
     cannot disagree with the count, and the rail label never depends on it. */
  var sharedN = params.get('shared') === null ? 2 : Math.max(0, Math.min(3, +params.get('shared')));
  function syncShared() {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#dest-shared .row'));
    rows.forEach(function (r, i) { r.hidden = i >= sharedN; });
    var n = rows.filter(function (r) { return !r.hidden; }).length;
    var h = el('st'), none = document.querySelector('#dest-shared .none');
    // zero → the area keeps its count-neutral name and says, plainly, that there is none yet
    h.textContent = n === 0 ? railBtns[1].textContent : n === 1 ? Q.copy.sharedOne.text : Q.copy.sharedMany.text;
    none.hidden = n !== 0;
    root.setAttribute('data-shared-count', String(n));
  }

  /* ------------------------------------------------------------- voice input level ------- */
  var samples = [], sampleN = 0;
  var SAMPLE_MS = 1000 / 60;
  function resetSamples() { samples.length = 0; sampleN = 0; }
  var liveLevel = (function () {
    var ctx = null, an = null, buf = null, stream = null, useMic = false;
    return {
      start: function () {
        if (CAPTURE || !navigator.mediaDevices || params.get('mic') === '0') return;
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
          stream = s; ctx = new (window.AudioContext || window.webkitAudioContext)();
          var src = ctx.createMediaStreamSource(s); an = ctx.createAnalyser(); an.fftSize = 1024;
          buf = new Float32Array(an.fftSize); src.connect(an); useMic = true;
          var src2 = el('level-src'); if (src2) src2.textContent = 'Voice level: microphone (not recorded, stored or sent)';
        }).catch(function () { useMic = false; });
      },
      stop: function () {
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        if (ctx) ctx.close(); ctx = an = buf = stream = null; useMic = false;
      },
      read: function (t) {
        if (useMic && an) { an.getFloatTimeDomainData(buf); var s = 0; for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.min(1, Math.sqrt(s / buf.length) * 7); }
        return simLevel(t);
      },
    };
  })();
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function simLevel(t) {
    if (t < 280) return 0;
    var u = t - 280, syl = 205, i = Math.floor(u / syl), f = (u % syl) / syl;
    var phrase = Math.floor(i / 7); if (i % 7 === 6) return 0.02;
    var amp = 0.35 + 0.6 * hash(i + phrase * 13);
    var env = Math.sin(Math.PI * Math.min(1, f * 1.15)); env = env * env;
    return amp * env;
  }

  /* ------------------------------------------------------------------- render ------------ */
  var RTL = root.getAttribute('dir') === 'rtl';
  function render() {
    Object.keys(dests).forEach(function (k) {
      var o = get('op-' + k); dests[k].style.opacity = o; dests[k].style.visibility = o > 0 ? 'visible' : 'hidden';
    });
    var x1 = get('mx1'), x2 = get('mx2');
    marker.style.transform = 'translateX(' + x1.toFixed(2) + 'px)';
    marker.style.width = Math.max(2, x2 - x1).toFixed(2) + 'px';
    var d = get('dock');
    composer.style.transform = 'translateY(' + (d * (composer.offsetHeight || 64)).toFixed(2) + 'px)';
    composer.style.visibility = d >= 0.999 || S.pick ? 'hidden' : 'visible';
    var dOut = get('depth-out'), dIn = get('depth-in');
    conv.style.opacity = (1 - dOut).toFixed(4);
    conv.style.transform = RM ? 'none' : 'translateY(' + (-22 * dOut).toFixed(2) + 'px)';
    conv.style.visibility = dOut >= 0.999 ? 'hidden' : 'visible';
    world.style.opacity = dIn.toFixed(4);
    world.style.transform = RM ? 'none' : 'translateY(' + (18 * (1 - dIn)).toFixed(2) + 'px) scale(' + (0.985 + 0.015 * dIn).toFixed(4) + ')';
    world.style.visibility = dIn <= 0.001 ? 'hidden' : 'visible';
    // The depth route belongs to its depth; Replay belongs to MY_WORLD and stands still across depths.
    var om = get('op-mine');
    var hc = om * (1 - dOut), hw = om * dIn;
    hdrConv.style.opacity = S.pick ? '0' : hc.toFixed(4); hdrWorld.style.opacity = hw.toFixed(4);
    hdrConv.style.visibility = hc <= 0.001 || S.pick ? 'hidden' : 'visible';
    hdrWorld.style.visibility = hw <= 0.001 ? 'hidden' : 'visible';
    replayBtn.style.opacity = om.toFixed(4); replayBtn.style.visibility = om <= 0.001 ? 'hidden' : 'visible';
    var v = get('voice');
    composer.style.setProperty('--v', v.toFixed(4));
    drawTrace(v);
    if (busy() && !CAPTURE) kick();
  }

  var TW = 0;
  function drawTrace(v) {
    if (!trace) return;
    if (!TW) { TW = trace.getBoundingClientRect().width || 220; trace.setAttribute('viewBox', '0 0 ' + TW.toFixed(2) + ' 20'); }
    var W = TW, base = 10, px = 1.25;
    var active = S.call === 'live' || S.composer === 'note';
    if (!active && v <= 0.001) { tracePath.setAttribute('d', ''); traceOld.setAttribute('d', ''); return; }
    var t0 = S.call === 'live' ? S.callStart : S.noteStart, t = now() - t0;
    var need = Math.floor(t / SAMPLE_MS);
    // sampleN counts every sample ever taken, so a long call keeps its true timeline after the window slides
    while (sampleN <= need) { var st = sampleN * SAMPLE_MS; samples.push(CAPTURE ? simLevel(st) : liveLevel.read(st)); sampleN++; if (samples.length > 400) samples.shift(); }
    if (elapsed) { var sec0 = Math.max(0, Math.floor(t / 1000)); elapsed.textContent = Math.floor(sec0 / 60) + ':' + ('0' + (sec0 % 60)).slice(-2); }
    var gain = S.call === 'live' && S.muted ? 0 : 1;
    if (RM || !active) { tracePath.setAttribute('d', 'M0 ' + base + 'H' + W); traceOld.setAttribute('d', ''); return; }
    // The pen sits at the END of the line — where writing goes in this script — and history runs back.
    var n = Math.min(samples.length, Math.floor(W / px));
    var ptsNew = [], ptsOld = [], split = Math.floor(n * 0.45);
    for (var i = 0; i < n; i++) {
      var s = samples[samples.length - 1 - i] * gain;
      var ph = (sampleN - 1 - i) * 0.72;
      var y = base - s * 8.5 * Math.sin(ph) * v;
      var xPen = RTL ? i * px : W - i * px;
      (i <= split ? ptsNew : ptsOld).push(xPen.toFixed(2) + ' ' + y.toFixed(2));
      if (i === split) ptsOld.push(xPen.toFixed(2) + ' ' + y.toFixed(2));
    }
    var restX = RTL ? n * px : W - n * px;
    tracePath.setAttribute('d', ptsNew.length ? 'M' + ptsNew.join(' L') : '');
    traceOld.setAttribute('d', ptsOld.length ? 'M' + ptsOld.join(' L') + ' L' + restX.toFixed(2) + ' ' + base + (RTL ? ' H' + W : ' H0') : 'M' + (RTL ? 0 : W) + ' ' + base + ' H' + (RTL ? W : 0));
  }

  var raf = 0;
  function kick() { if (CAPTURE || raf) return; raf = requestAnimationFrame(function () { raf = 0; render(); if (busy() || S.call === 'live' || S.composer === 'note') kick(); }); }

  /* ------------------------------------------------------------------- wiring ------------ */
  function press(elm) {
    elm.addEventListener('pointerdown', function () { elm.classList.add('prs'); });
    ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(function (e) { elm.addEventListener(e, function () { elm.classList.remove('prs'); }); });
  }
  railBtns.forEach(function (b) { press(b); b.addEventListener('click', function () { selectWorld(b.getAttribute('data-world')); }); });
  var input = el('input');
  var on = function (id, fn) { var e = el(id); if (e) { press(e); e.addEventListener('click', fn); } };
  on('door', enterWorld); on('back', leaveWorld);
  on('mic', startNote); on('send', send); on('call', startCall);
  on('note-send', sendNote); on('note-cancel', cancelNote);
  on('mute', toggleMute); on('end-call', endCall);
  on('replay', function (e) { e.stopPropagation(); if (S.menu) closeMenu(); else openMenu(); });
  on('pick-cancel', function () { exitPick(); });
  on('pick-go', function () { if (S.range) openPreview(); });
  on('rprev-x', closePreview);
  Array.prototype.forEach.call(rmenu.querySelectorAll('.mi'), function (m) { m.addEventListener('click', function () { choose(m.getAttribute('data-scope')); }); });
  document.querySelector('.thread').addEventListener('click', function (e) { var t = e.target.closest('.t'); if (t) tapTurn(turns().indexOf(t)); });
  document.querySelector('.thread').addEventListener('keydown', function (e) { var t = e.target.closest('.t'); if (t && S.pick && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); tapTurn(turns().indexOf(t)); } });
  // An ASIDE is light-dismiss: any press outside it, and outside its trigger, is a complete outcome.
  document.addEventListener('pointerdown', function (e) { if (S.menu && !rmenu.contains(e.target) && !replayBtn.contains(e.target)) closeMenu(true); });
  if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  function syncSend() { if (!input) return; composer.classList.toggle('has-text', input.value.trim().length > 0); }
  if (input) input.addEventListener('input', syncSend);
  // Escape unwinds the innermost layer — and never ends a call.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (S.preview) closePreview(); else if (S.menu) closeMenu(); else if (S.pick) exitPick(); else if (S.depth === 'world') leaveWorld();
  });
  window.addEventListener('resize', function () { TW = 0; var bx = labelBox(railBtns[idx(S.world)]); set('mx1', bx.x1); set('mx2', bx.x2); commit(); });

  /* ------------------------------------------------ deterministic capture interface ------ */
  function applyPreset(p) {
    if (p === 'shared' || p === 'public') S.world = p;
    if (p === 'world') S.depth = 'world';
    if (p === 'note') { S.composer = 'note'; }
    if (p === 'call') { S.call = 'live'; S.depth = 'world'; }
    if (p === 'call-conv') { S.call = 'live'; }
    if (p === 'call-muted') { S.call = 'live'; S.depth = 'world'; S.muted = true; el('mute').setAttribute('aria-pressed', 'true'); }
    if (p === 'typing' && input) { input.value = Q.typingSample; syncSend(); }
    if (p === 'replay-menu') S.menu = true;
    if (p === 'replay-part') { S.pick = true; var r = (params.get('pick') || '').split(',').map(Number); if (r.length === 2 && !isNaN(r[0])) S.range = [r[0], r[1]]; }
    if (p === 'replay-preview') S.preview = true;
  }
  window.__G11rt = {
    state: S,
    at: function (ms) { clockT = ms; render(); return { t: ms, busy: busy() }; },
    act: function (name) {
      acted = true;
      ({ shared: function () { selectWorld('shared'); }, mine: function () { selectWorld('mine'); }, public: function () { selectWorld('public'); },
         enter: enterWorld, leave: leaveWorld, note: startNote, notesend: sendNote, notecancel: cancelNote,
         call: startCall, endcall: endCall, mute: toggleMute, menu: openMenu, full: function () { choose('full'); }, part: function () { choose('part'); },
         tap: function () {}, closepreview: closePreview, exitpick: function () { exitPick(true); } })[name]();
      return true;
    },
    tap: function (i) { tapTurn(i); return S.range; },
    press: function (sel, on) { var e = document.querySelector(sel); if (e) e.classList.toggle('prs', !!on); return !!e; },
    center: function (sel) { var e = document.querySelector(sel), r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
    scroll: function () { var s = el('scroll'); return s ? s.scrollTop : null; },
    /* The state a reader can USE — compared between standard and Reduced Motion (R3 §17). */
    truth: function () {
      var vis = function (e) { if (!e || !e.getClientRects().length) return false; var p = e; while (p && p !== root) { if (p.hasAttribute('inert') || p.hidden) return false; var c = getComputedStyle(p); if (c.visibility === 'hidden' || c.display === 'none' || +c.opacity < 0.5) return false; p = p.parentElement; } return true; };
      var ctl = Array.prototype.slice.call(root.querySelectorAll('button,input,[role="checkbox"]')).filter(vis).map(function (b) { return b.id || b.getAttribute('data-world') || b.getAttribute('data-scope') || b.className; }).sort();
      return { world: S.world, depth: S.depth, call: S.call, composer: S.composer, replay: root.getAttribute('data-replay'), menu: S.menu, pick: S.pick,
        worldVisible: vis(world), convVisible: vis(conv), controls: ctl, turns: turns().length };
    },
    measure: function () {
      var r = root.getBoundingClientRect();
      var sb = el('scroll').getBoundingClientRect(), cb = composer.getBoundingClientRect();
      var ts = turns().map(function (t) {
        var b = t.getBoundingClientRect();
        return { who: t.getAttribute('data-who'), x0: b.left - r.left, y0: b.top - r.top, x1: b.right - r.left, y1: b.bottom - r.top };
      }).filter(function (b) { return b.x1 > b.x0 && b.y0 >= sb.top - r.top + 28 && b.y1 <= cb.top - r.top; });
      return { w: r.width, h: r.height, vw: innerWidth, dir: root.getAttribute('dir'), marker: [get('mx1'), get('mx2')], fonts: document.fonts.status, turns: ts };
    },
  };

  var preset = params.get('state') || 'active';
  applyPreset(preset);
  initVals();
  // ?send=… : the reader's first words, sent through the real send path (capture only).
  if (params.get('send') && input) { input.value = params.get('send'); send(); }
  if (S.composer === 'note') S.noteStart = CAPTURE ? -(+params.get('voiceMs') || 3100) : now();
  if (S.call === 'live') { S.callStart = CAPTURE ? -(+params.get('voiceMs') || 84000) : now(); if (!CAPTURE) liveLevel.start(); }
  commit();
  // ?top=1 (capture only): the history scrolled to its first line instead of its latest.
  var atTop = params.get('top') === '1';
  var scroller = el('scroll'); if (scroller) scroller.scrollTop = atTop ? 0 : scroller.scrollHeight;
  var acted = false;
  function remeasure() { TW = 0; var bx = labelBox(railBtns[idx(S.world)]); set('mx1', bx.x1); set('mx2', bx.x2);
    if (!acted && scroller) scroller.scrollTop = atTop ? 0 : scroller.scrollHeight; commit(); }
  window.__G11rt.remeasure = remeasure;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { requestAnimationFrame(remeasure); });
  document.documentElement.setAttribute('data-rt', '1');
})();
