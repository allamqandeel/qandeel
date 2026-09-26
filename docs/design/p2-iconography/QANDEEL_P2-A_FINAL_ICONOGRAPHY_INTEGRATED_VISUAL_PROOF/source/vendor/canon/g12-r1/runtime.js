/* G1.2 prototype runtime — plain script, inlined by build.mjs. No framework, no dependency, no voice runtime.
 *
 * It extends the G1.1 R3 runtime (frozen shell behaviour kept verbatim in spirit: a MODE is not a PLACE; the
 * call survives every depth change) with the life-cycle G1.2 must prove:
 *
 *   CALL      none → connecting → live ⇄ reconnecting → none. One call id per call; nothing but the reader's
 *             End, a failed reconnection or the platform ends it.
 *   START     Analysis-first: the call opens the Analysis (G1.1 closure §1).
 *   RETURN    the last truthful in-call surface (G1.2 §5). Backgrounding and returning NEVER write S.depth.
 *   ENDED     a call the reader did not end returns the reader to the Conversation with Writing reachable and
 *             says so (VI-01 §14.5); no call control survives a call that no longer exists (G1.2 §23).
 *   PERMISSION the microphone is asked for at the moment of intent, never at launch; denial leaves Writing.
 *   NOTE      Voice Note is Conversation-first; leaving QANDEEL mid-capture STOPS the capture and keeps it as
 *             an unsent draft (recommendation R-VN — no background microphone for a voice note).
 *
 * The operating system is SIMULATED by acts (bg, bgapp, fg, drop, recover, fail, awaydrop, relaunch) and drawn
 * only as labelled schematics: QANDEEL does not own those surfaces.
 *
 * MOTION is a pure function of a clock (capture mode: a number the capture tool sets). State is committed before
 * motion explains it. Every OS-owned change (a prompt, the lock screen) is instant: the OS draws it, not us.
 */
(function () {
  'use strict';
  var Q = window.__G12;
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

  /* durations (ms), inherited from T-10 / G1.1 — G1.2 adds no new duration and no new curve */
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
  function go(k, v, dur, delay) { if (RM) { if (v > get(k)) { set(k, Math.max(get(k), 0.001)); to(k, v, DUR.resolve); } else set(k, v); } else to(k, v, dur, delay); }
  function busy() { for (var k in anims) return true; return false; }

  /* ------------------------------------------------------------------- the state --------- */
  var S = {
    world: 'mine', depth: 'conversation',
    composer: 'idle',        // 'idle' (writing) | 'note' (capturing) | 'draft' (capture stopped by leaving QANDEEL)
    call: 'none',            // 'none' | 'connecting' | 'live' | 'reconnecting'
    muted: false, route: 'speaker',
    menu: false, pick: false, range: null, preview: false,
    noteStart: 0, noteMs: 0,
    callStart: 0, callId: null, convId: 'conv-7c21', callStarts: 0, liveAt: 0, barge: -1,
    perm: params.get('perm') || (CAPTURE ? 'granted' : 'unknown'), ask: null,
    app: 'foreground', os: 'lock', awayAt: 0, awaySurface: null, awayMs: 0,
    notice: null, pendingReturn: null, boots: 1,
    playing: null, playStart: 0,
    lctxN: -1, ends: [],
  };

  var el = function (id) { return document.getElementById(id); };
  var railBtns = Array.prototype.slice.call(document.querySelectorAll('#rail .it'));
  var dests = { mine: el('dest-mine'), shared: el('dest-shared'), public: el('dest-public') };
  var conv = el('conv'), world = el('world'), composer = el('composer'), marker = el('marker');
  var hdrConv = el('hdr-conv'), hdrWorld = el('hdr-world'), hdrPick = el('hdr-pick'), replayBtn = el('replay');
  var trace = el('trace'), tracePath = el('trace-path'), traceOld = el('trace-old');
  var elapsed = el('elapsed'), vlabel = el('vlabel'), back = el('back'), door = el('door');
  var rmenu = el('rmenu'), rprev = el('rprev'), picks = el('picks'), pickCount = el('pick-count'), pickGo = el('pick-go');
  var notice = el('notice'), noticeT = el('notice-t'), noticeAct = el('notice-act');
  var osPerm = el('os-perm'), osBg = el('os-bg'), lctxV = el('lctx-v'), input = el('input');
  var cstate = el('cstate'), cstateT = el('cstate-t'), callA11y = el('call-a11y');
  var lastCallA11y = '';

  function labelBox(btn) {
    var lab = btn.querySelector('.lb');
    var r = lab.getBoundingClientRect(), rr = el('rail').getBoundingClientRect();
    return { x1: r.left - rr.left, x2: r.right - rr.left };
  }
  function idx(k) { return ['mine', 'shared', 'public'].indexOf(k); }
  function turns() { return Array.prototype.slice.call(document.querySelectorAll('.thread .t')); }
  function mmss(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  var SEP = root.getAttribute('dir') === 'rtl' ? '، ' : ', ';

  function eligible() { return !!document.querySelector('.thread .t.me'); }
  function inCall() { return S.call !== 'none'; }
  function wantDock() { return (inCall() || S.composer !== 'idle' || (S.world === 'mine' && S.depth === 'conversation' && !S.pick)) ? 0 : 1; }
  function wantVoice() { return (inCall() || S.composer !== 'idle') ? 1 : 0; }

  function initVals() {
    Object.keys(dests).forEach(function (k) { set('op-' + k, k === S.world ? 1 : 0); });
    var bx = labelBox(railBtns[idx(S.world)]);
    set('mx1', bx.x1); set('mx2', bx.x2);
    set('dock', wantDock());
    set('depth-out', S.depth === 'world' ? 1 : 0);
    set('depth-in', S.depth === 'world' ? 1 : 0);
    set('voice', wantVoice());
  }

  /* ------------------------------------------------------ the simulated call timeline ---- */
  // Time since the call was established (the connecting phase is not call time).
  function callT() { return S.call === 'none' || S.call === 'connecting' ? 0 : now() - S.liveAt; }
  function cycleOf(ct) { var c = Q.script.cycleMs; return { i: Math.floor(ct / c), pos: ct % c }; }
  /** Who has audio right now: 'me' (the reader's microphone carries speech), 'q' (QANDEEL audio plays), 'none'. */
  function speaking() {
    if (S.call !== 'live') return 'none';
    var cy = cycleOf(callT()), segs = Q.script.segments;
    for (var i = 0; i < segs.length; i++) {
      var sg = segs[i];
      if (cy.pos >= sg.from && cy.pos < sg.to) {
        if (sg.who === 'q' && S.barge === cy.i * 10 + i) return 'me';
        if (sg.who === 'me' && S.muted) return 'none';
        return sg.who;
      }
    }
    return 'none';
  }
  /** How many spoken turns have COMMITTED since the call was established. */
  function commitsNow() {
    if (!S.liveAt || S.call === 'none' || S.call === 'connecting') return 0;
    var cy = cycleOf(callT()), cs = Q.script.commits, n = cy.i * cs.length;
    for (var i = 0; i < cs.length; i++) if (cy.pos >= cs[i]) n++;
    return n;
  }
  var lctxBase = 0, lctxCommits = 0;
  function tick() {
    // connecting → live is decided by the clock alone (so standard and Reduced Motion agree exactly)
    if (S.call === 'connecting' && now() - S.callStart >= Q.script.connectMs) { S.call = 'live'; S.liveAt = S.callStart + Q.script.connectMs; syncCallDom(); }
    if (S.call === 'live' || S.call === 'reconnecting') {
      var n = commitsNow();
      if (S.call === 'live' && n !== lctxCommits) { lctxCommits = n; lctxV.textContent = Q.liveContext[(lctxBase + n) % Q.liveContext.length]; }
    }
    if (S.playing !== null) {
      var t = turnByVn(S.playing); var dur = t ? +t.getAttribute('data-dur') : 0;
      if (!t || now() - S.playStart >= dur) stopPlay();
    }
  }

  /* ---------------------------------------------------------------------- acts ----------- */
  function selectWorld(k) {
    if (k === S.world) return;
    closeMenu(true); if (S.pick) exitPick(true);
    var from = S.world; S.world = k;
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
  function leaveWorld(instant) {
    if (S.depth !== 'world') return;
    closeMenu(true);
    S.depth = 'conversation';
    if (instant) { set('depth-in', 0); set('depth-out', 0); set('dock', wantDock()); commit(); return; }
    if (RM) { set('depth-in', 0); set('depth-out', 0.999); to('depth-out', 0, DUR.resolve); }
    else { to('depth-in', 0, DUR.depthOut); to('depth-out', 0, DUR.depthIn, DUR.depthInDelay); }
    go('dock', wantDock(), DUR.dock, RM ? 0 : 60);
    commit();
  }

  /* ---- the microphone permission: asked at the moment of intent, through the OS */
  function needMic(intent) {
    if (S.perm === 'granted') return true;
    if (S.perm === 'denied') { showNotice('denied'); return false; }
    S.ask = intent; commit();       // the OS prompt appears; QANDEEL waits
    return false;
  }
  function osAllow() { if (!S.ask) return; var i = S.ask; S.ask = null; S.perm = 'granted'; commit(); if (i === 'note') beginNote(); else beginCall(); }
  function osDeny() { if (!S.ask) return; S.ask = null; S.perm = 'denied'; showNotice('denied'); focusWriting(); }
  function focusWriting() { if (input && !CAPTURE) input.focus(); }

  /* ---- the notice: a T4 line naming what happened and the alternative */
  function showNotice(kind) { S.notice = kind; commit(); announce(kind === 'denied' ? Q.copy.micDenied.text : Q.copy.callFailed.text); }
  function clearNotice() { if (!S.notice) return; S.notice = null; commit(); }

  /* ---- Voice Note: Conversation-first. Recording never moves the reader to another depth. */
  function startNote() { if (S.composer !== 'idle' || inCall() || S.ask) return; if (needMic('note')) beginNote(); }
  function beginNote() {
    clearNotice(); stopPlay();
    S.composer = 'note'; S.noteStart = now(); resetSamples();
    go('voice', 1, DUR.voice);
    liveLevel.start(); commit(); announce(Q.copy.recording.text);
  }
  function endNote() { S.composer = 'idle'; go('voice', wantVoice(), DUR.voice); liveLevel.stop(); go('dock', wantDock(), DUR.dock); commit(); }
  function noteMs() { return S.composer === 'note' ? now() - S.noteStart : S.noteMs; }
  function sendNote() {
    if (S.composer === 'idle') return;
    var ms = Math.max(1000, Math.round(noteMs() / 1000) * 1000);
    endNote();
    // The committed note is the reader's UTTERANCE: media row + «رسالة صوتية». No transcript is shown, because no
    // speech runtime produced one; no waveform, because a drawn waveform would be invented data.
    var t = document.createElement('div'); t.className = 't me voice'; t.setAttribute('data-who', 'me'); t.setAttribute('data-kind', 'voice');
    t.setAttribute('data-dur', String(ms)); t.setAttribute('data-vn', 's' + (++sentN));
    t.innerHTML = '<span class="sr"></span>' + Q.voiceRow + '<p class="vk r-meta"></p>';
    t.querySelector('.sr').textContent = Q.copy.speakerMe.text + ': ';
    t.querySelector('.play').setAttribute('aria-label', Q.copy.play.text + SEP + mmss(ms));
    t.querySelector('.dur').textContent = mmss(ms);
    t.querySelector('.vk').textContent = Q.copy.voiceNote.text;
    document.querySelector('.thread .new').appendChild(t);
    afterAppend();
  }
  var sentN = 0;
  function cancelNote() { if (S.composer === 'idle') return; endNote(); announce(''); }

  /* ---- voice message playback */
  function turnByVn(v) { return document.querySelector('.thread .t[data-vn="' + v + '"]'); }
  function togglePlay(t) {
    var v = t.getAttribute('data-vn');
    if (S.playing === v) { stopPlay(); return; }
    stopPlay(); if (inCall() || S.composer !== 'idle') return;
    S.playing = v; S.playStart = now(); commit();
  }
  function stopPlay() {
    if (S.playing === null) return;
    var t = turnByVn(S.playing); S.playing = null;
    if (t) { var f = t.querySelector('.fill'); if (f) f.style.width = '0'; }
    commit();
  }

  /* ---- Live Call: Analysis-first at START; the last truthful surface at RETURN. */
  var callSeq = 0;
  function startCall() { if (inCall() || S.ask) return; if (needMic('call')) beginCall(); }
  function beginCall() {
    closeMenu(true); if (S.pick) exitPick(true);
    if (S.composer !== 'idle') endNote();
    clearNotice(); stopPlay();
    callSeq++; S.callStarts++;
    S.callId = 'call-' + (0x3f9a00 + callSeq * 0x1b7).toString(16);
    S.call = 'connecting'; S.muted = false; S.route = 'speaker'; S.callStart = now(); S.liveAt = 0; S.barge = -1; resetSamples();
    el('mute').setAttribute('aria-pressed', 'false');
    lctxBase = (lctxBase + lctxCommits) % Q.liveContext.length; lctxCommits = 0;
    go('voice', 1, DUR.voice);
    liveLevel.start();
    callMarker();
    if (S.world === 'mine' && S.depth !== 'world') enterWorld(); else { go('dock', wantDock(), DUR.dock); commit(); }
  }
  /** reason: 'user' (the reader pressed End) · 'failed' (reconnection failed) · 'dropped' (ended while away). */
  function endCall(reason) {
    if (!inCall()) return;
    reason = reason || 'user';
    var ms = S.liveAt ? now() - S.liveAt : 0;
    var away = S.app === 'background';
    S.ends.push({ callId: S.callId, reason: reason, away: away, ms: Math.round(ms) });
    S.call = 'none'; S.muted = false; liveLevel.stop();
    go('voice', 0, DUR.voice);
    // What the call leaves in the history is a RUNTIME dependency (audio dependency note §2): the proof records
    // only that a call happened, how long it ran, and — if the reader did not end it — that it stopped.
    var m = el('call-marker');
    if (m) { m.textContent = Q.copy.callRecord.text + ' · ' + mmss(ms) + (reason === 'user' ? '' : ' · ' + Q.copy.callRecordStopped.text); m.id = ''; m.setAttribute('data-reason', reason); }
    if (reason === 'user') {
      go('dock', wantDock(), DUR.dock, RM ? 0 : 120);
      commit(); announce('');
      var d = el('mic'); if (d && document.activeElement === el('end-call')) d.focus();
      return;
    }
    // A call the reader did not end: back to the Conversation, Writing reachable, the event named.
    if (away) { S.pendingReturn = 'ended'; commit(); return; }
    S.notice = 'failed';
    if (S.depth === 'world') leaveWorld(); else { go('dock', wantDock(), DUR.dock); commit(); }
    announce(Q.copy.callFailed.text); focusWriting();
  }
  function toggleMute() { if (!inCall()) return; S.muted = !S.muted; el('mute').setAttribute('aria-pressed', S.muted ? 'true' : 'false'); commit(); }
  function toggleRoute() { if (S.call !== 'live') return; S.route = S.route === 'speaker' ? 'earpiece' : 'speaker'; commit(); }
  function drop() { if (S.call !== 'live') return; S.call = 'reconnecting'; commit(); }
  function recover() {
    if (S.call !== 'reconnecting') return;
    // Nothing was spoken while the line was down, so nothing committed: the script's commit instants that passed
    // during the gap are absorbed, never shown as an Analysis change the reader did not cause.
    S.call = 'live'; lctxCommits = commitsNow(); commit();
  }
  function fail() { if (S.call !== 'reconnecting' && S.call !== 'live') return; endCall('failed'); }
  function barge() {
    // CANDIDATE (G1.2 §21): the Foundation Freeze makes interruption "a first-class realtime event" and QANDEEL
    // "yields immediately to interruption"; the Voice runtime that would detect it does not exist. The proof
    // shows only the visible consequence: QANDEEL's audio stops and the microphone carries the reader.
    if (speaking() !== 'q') return;
    var cy = cycleOf(callT()), segs = Q.script.segments;
    for (var i = 0; i < segs.length; i++) if (cy.pos >= segs[i].from && cy.pos < segs[i].to) S.barge = cy.i * 10 + i;
    commit();
  }
  function callMarker() {
    if (el('call-marker')) return;
    var sc = el('scroll'), pinned = sc && sc.scrollHeight - sc.scrollTop - sc.clientHeight < 4;
    var p = document.createElement('p'); p.className = 'day r-meta callm'; p.id = 'call-marker';
    p.textContent = Q.copy.callStarted.text + ' 9:52';
    document.querySelector('.thread .new').appendChild(p);
    if (pinned) sc.scrollTop = sc.scrollHeight;
  }

  /* ---- the operating system (simulated): background, foreground, force-quit */
  function toBackground(os) {
    if (S.app === 'background') return;
    closeMenu(true);
    if (S.composer === 'note') { S.noteMs = now() - S.noteStart; S.composer = 'draft'; liveLevel.stop(); }  // R-VN
    stopPlay();                                                                                            // no background media
    S.app = 'background'; S.os = os || 'lock'; S.awayAt = now(); S.awaySurface = S.depth;
    commit();
  }
  function toForeground() {
    if (S.app !== 'background') return;
    S.awayMs = now() - S.awayAt;
    S.app = 'foreground';
    if (S.pendingReturn === 'ended') {
      // The call ended while QANDEEL was away. There is no in-call surface to restore: the reader arrives in the
      // Conversation (instantly — they were not watching a transition), with the event named and Writing reachable.
      S.pendingReturn = null; S.notice = 'failed';
      if (S.depth === 'world') leaveWorld(true); else commit();
      announce(Q.copy.callFailed.text);
      return;
    }
    // A call that is still genuinely active: NOTHING about the surface is written. Depth, call id, Conversation id,
    // mute, route and scroll are exactly as they were left.
    commit();
  }
  function awayDrop() { if (S.app !== 'background' || !inCall()) return; endCall('dropped'); }
  function relaunch() {
    // Force-quit / process death: the in-process call is gone with the process (G1.2 §4: no survival is promised).
    // A cold start restores the durable viewpoint (T-13) and nothing live: no call, no call controls, no notice —
    // the app cannot know more than the runtime tells it, and no such runtime exists yet.
    if (inCall()) { S.ends.push({ callId: S.callId, reason: 'process-ended', away: S.app === 'background', ms: S.liveAt ? Math.round(now() - S.liveAt) : 0 }); }
    liveLevel.stop();
    S.call = 'none'; S.muted = false; S.composer = 'idle'; S.notice = null; S.pendingReturn = null; S.ask = null;
    S.app = 'foreground'; S.depth = 'conversation'; S.menu = false; S.pick = false; S.preview = false; S.playing = null; S.boots++;
    Array.prototype.forEach.call(document.querySelectorAll('.thread .callm'), function (m) { m.parentNode.removeChild(m); });
    initVals(); commit();
    var sc = el('scroll'); if (sc) sc.scrollTop = sc.scrollHeight;
  }

  /* ---- Writing */
  function send() {
    var v = input.value.trim(); if (!v) return;
    var box = document.querySelector('.thread .new'), t = document.createElement('div'), sr = document.createElement('span'), p = document.createElement('p');
    t.className = 't me'; t.setAttribute('data-who', 'me');
    sr.className = 'sr'; sr.textContent = Q.copy.speakerMe.text + ': ';
    p.className = 'tx r-body'; p.setAttribute('dir', paragraphDir(v, root.getAttribute('dir'))); p.textContent = v;
    t.appendChild(sr); t.appendChild(p); box.appendChild(t);
    input.value = ''; syncSend(); clearNotice();
    afterAppend();
  }
  function afterAppend() { var sc = el('scroll'); if (sc) sc.scrollTop = sc.scrollHeight; commit(); }

  /* ---- Replay: an action on the current conversation (G1.1), unchanged; during a call it says plainly that
     the ongoing call is not part of it (open Live Head cannot be frozen; no Personal call audio exists). */
  function openMenu() { if (!eligible() || S.menu) return; S.menu = true; commit(); var first = rmenu.querySelector('.mi'); if (first && !CAPTURE) first.focus(); }
  function closeMenu(silent) { if (!S.menu) return; S.menu = false; commit(); if (!silent) replayBtn.focus(); }
  function choose(scope) { closeMenu(true); if (scope === 'full') { S.range = null; openPreview(); return; } enterPick(); }
  function enterPick() { if (S.depth === 'world') leaveWorld(); S.pick = true; S.range = null; go('dock', wantDock(), 0); commit(); var ts = turns(); if (ts.length && !CAPTURE) ts[ts.length - 1].focus(); }
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
  /** Visible words are reserved for capture drafts and call transitions/errors. Ordinary live/mic/output states
      are carried visually, while their semantic state remains available to assistive technology. */
  function lineLabel() {
    if (S.composer === 'note') return Q.copy.recording.text;
    if (S.composer === 'draft') return Q.copy.noteStopped.text;
    if (S.call === 'connecting') return Q.copy.connecting.text;
    if (S.call === 'reconnecting') return Q.copy.reconnecting.text;
    return '';
  }
  function callA11yLabel() {
    if (S.call === 'connecting') return Q.copy.connecting.text;
    if (S.call === 'reconnecting') return Q.copy.reconnecting.text;
    if (S.call === 'live') return S.muted ? Q.copy.muted.text : speaking() === 'q' ? Q.copy.qSpeaking.text : Q.copy.micOn.text;
    return '';
  }
  function syncCallDom() {
    root.setAttribute('data-call', S.call);
    el('route').setAttribute('aria-pressed', S.route === 'speaker' ? 'true' : 'false');
    el('mute').setAttribute('aria-label', S.muted ? Q.copy.unmute.text : Q.copy.mute.text);
    var a = callA11yLabel();
    if (callA11y && a !== lastCallA11y) { callA11y.textContent = a; lastCallA11y = a; }
  }
  var lastAppVisible = true;
  function commit() {
    tick();
    syncRail();
    var bg = S.app === 'background', osModal = !!S.ask;
    Object.keys(dests).forEach(function (k) {
      var on = k === S.world;
      dests[k].toggleAttribute('inert', !on || S.preview || bg || osModal);
      dests[k].setAttribute('aria-hidden', on && !bg ? 'false' : 'true');
    });
    var inWorld = S.depth === 'world', mine = S.world === 'mine';
    conv.toggleAttribute('inert', inWorld); world.toggleAttribute('inert', !inWorld);
    hdrConv.toggleAttribute('inert', inWorld || !mine || S.pick);
    hdrWorld.toggleAttribute('inert', !inWorld || !mine);
    hdrPick.hidden = !S.pick;
    root.setAttribute('data-replay', eligible() && mine && !S.pick ? '1' : '0');
    replayBtn.setAttribute('aria-expanded', S.menu ? 'true' : 'false');
    el('rmenu-note').hidden = !inCall();
    root.classList.toggle('rmenu-open', S.menu);
    root.classList.toggle('rprev-open', S.preview);
    root.setAttribute('data-pick', S.pick ? '1' : '0');
    composer.toggleAttribute('inert', wantDock() === 1 || S.pick || S.preview || bg || osModal);
    el('pickbar').toggleAttribute('inert', !S.pick || S.preview || bg);
    el('rail').toggleAttribute('inert', S.preview || bg || osModal);
    el('hdr').toggleAttribute('inert', S.preview || bg || osModal);
    // the notice
    notice.hidden = !S.notice || bg;
    notice.toggleAttribute('inert', bg || osModal);
    noticeT.textContent = S.notice === 'denied' ? Q.copy.micDenied.text : S.notice === 'failed' ? Q.copy.callFailed.text : '';
    noticeAct.hidden = S.notice !== 'denied';
    // the OS stand-ins
    osPerm.hidden = !osModal; osPerm.setAttribute('aria-hidden', osModal ? 'false' : 'true');
    osBg.hidden = !bg; osBg.setAttribute('aria-hidden', bg ? 'false' : 'true');
    el('os-bg-h').textContent = S.os === 'app' ? 'Another app is in front' : 'The screen is locked';
    el('os-bg-call').hidden = !inCall();
    back.setAttribute('aria-label', inCall() ? Q.copy.backNameCall.text : Q.copy.backName.text);
    if (inCall()) door.setAttribute('aria-label', Q.copy.doorNameCall.text); else door.removeAttribute('aria-label');
    syncCallDom();
    root.setAttribute('data-world', S.world);
    root.setAttribute('data-depth', S.depth);
    root.setAttribute('data-composer', S.composer);
    root.setAttribute('data-app', S.app);
    root.setAttribute('data-notice', S.notice || '');
    syncPicks();
    syncPlayButtons();
    var tv = el('truth-view'); if (tv) tv.textContent = JSON.stringify({ callId: S.callId, conversation: S.convId, call: S.call, surface: S.depth, app: S.app, callStarts: S.callStarts, perm: S.perm }, null, 1);
    render();
  }
  function syncPlayButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('.thread .t[data-vn]'), function (t) {
      var b = t.querySelector('.play'), on = S.playing === t.getAttribute('data-vn'), dur = +t.getAttribute('data-dur');
      b.setAttribute('data-playing', on ? '1' : '0');
      var base = t.getAttribute('data-kind') === 'spoken' ? Q.copy.qPlay.text : on ? Q.copy.pause.text : Q.copy.play.text;
      b.setAttribute('aria-label', base + SEP + mmss(dur));
    });
  }
  var live = el('live');
  function announce(t) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); } }

  /* ------------------------------------------------------------- voice input level ------- */
  var samples = [], sampleN = 0;
  var SAMPLE_MS = 1000 / 60;
  function resetSamples() { samples.length = 0; sampleN = 0; }
  var liveLevel = (function () {
    // The ONLY place the browser microphone is ever requested — from an act of intent (a voice note begun, a call
    // begun), never at load. In capture mode it is never requested at all.
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
    tick();
    syncCallDom();
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
    var om = get('op-mine');
    var hc = om * (1 - dOut), hw = om * dIn;
    hdrConv.style.opacity = S.pick ? '0' : hc.toFixed(4); hdrWorld.style.opacity = hw.toFixed(4);
    hdrConv.style.visibility = hc <= 0.001 || S.pick ? 'hidden' : 'visible';
    hdrWorld.style.visibility = hw <= 0.001 ? 'hidden' : 'visible';
    replayBtn.style.opacity = om.toFixed(4); replayBtn.style.visibility = om <= 0.001 ? 'hidden' : 'visible';
    var v = get('voice');
    composer.style.setProperty('--v', v.toFixed(4));
    var lb = lineLabel(); if (vlabel.textContent !== lb) vlabel.textContent = lb;
    // Words that the line cannot hold in full move, in full, to the strip above it (never an ellipsis).
    vlabel.style.visibility = '';
    var over = !!lb && S.app !== 'background' && vlabel.scrollWidth > vlabel.clientWidth + 1;
    cstate.hidden = !over;
    if (over) { if (cstateT.textContent !== lb) cstateT.textContent = lb; vlabel.style.visibility = 'hidden'; }
    var lift = (notice.hidden ? 0 : notice.offsetHeight) + (cstate.hidden ? 0 : cstate.offsetHeight);
    conv.style.bottom = lift ? 'calc(var(--comp) + ' + lift + 'px)' : '';
    drawTrace(v);
    // playback progress: the real elapsed time of the playing message
    if (S.playing !== null) {
      var t = turnByVn(S.playing);
      if (t) { var dur = +t.getAttribute('data-dur'), f = t.querySelector('.fill'); if (f) f.style.width = (Math.min(1, (now() - S.playStart) / dur) * 100).toFixed(2) + '%'; }
    }
    if (S.app === 'background') {
      el('os-away').textContent = mmss(now() - S.awayAt);
      el('os-call').textContent = inCall() ? S.callId + ' · ' + S.call + ' · ' + mmss(callT()) : 'none';
    }
    if ((busy() || inCall() || S.composer === 'note' || S.playing !== null || S.app === 'background') && !CAPTURE) kick();
  }

  var TW = 0;
  function drawTrace(v) {
    if (!trace) return;
    if (!TW) { TW = trace.getBoundingClientRect().width || 220; trace.setAttribute('viewBox', '0 0 ' + TW.toFixed(2) + ' 20'); }
    var W = TW, base = 10, px = 1.25;
    var capturing = S.composer === 'note', calling = S.call === 'live';
    if (elapsed) elapsed.textContent = S.composer !== 'idle' ? mmss(noteMs()) : inCall() ? mmss(callT()) : '0:00';
    if (!capturing && !calling) { tracePath.setAttribute('d', v > 0.001 ? 'M0 ' + base + 'H' + W : ''); traceOld.setAttribute('d', ''); return; }
    // The line IS the microphone: it draws the reader's level while the microphone carries speech, and lies flat
    // while QANDEEL speaks or the microphone is muted. QANDEEL's own audio is never drawn as a meter.
    var t0 = capturing ? S.noteStart : S.liveAt, t = now() - t0;
    var need = Math.floor(t / SAMPLE_MS);
    while (sampleN <= need) {
      var st = sampleN * SAMPLE_MS, lv;
      if (capturing) lv = CAPTURE ? simLevel(st) : liveLevel.read(st);
      else lv = speakingAt(st) === 'me' ? (CAPTURE ? simLevel(st % 3600) : liveLevel.read(st)) : 0;
      samples.push(lv); sampleN++; if (samples.length > 400) samples.shift();
    }
    if (RM) { tracePath.setAttribute('d', 'M0 ' + base + 'H' + W); traceOld.setAttribute('d', ''); return; }
    var n = Math.min(samples.length, Math.floor(W / px));
    var ptsNew = [], ptsOld = [], split = Math.floor(n * 0.45);
    for (var i = 0; i < n; i++) {
      var s = samples[samples.length - 1 - i];
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
  /** speaking() at an arbitrary call time (for the level history), same rules as speaking(). */
  function speakingAt(ct) {
    if (S.muted) return 'none';
    var c = Q.script.cycleMs, i = Math.floor(ct / c), pos = ct % c, segs = Q.script.segments;
    for (var k = 0; k < segs.length; k++) if (pos >= segs[k].from && pos < segs[k].to) return segs[k].who === 'q' && S.barge === i * 10 + k ? 'me' : segs[k].who;
    return 'none';
  }

  var raf = 0;
  function kick() { if (CAPTURE || raf) return; raf = requestAnimationFrame(function () { raf = 0; render(); }); }

  /* ------------------------------------------------------------------- wiring ------------ */
  function press(elm) {
    elm.addEventListener('pointerdown', function () { elm.classList.add('prs'); });
    ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(function (e) { elm.addEventListener(e, function () { elm.classList.remove('prs'); }); });
  }
  railBtns.forEach(function (b) { press(b); b.addEventListener('click', function () { selectWorld(b.getAttribute('data-world')); }); });
  var on = function (id, fn) { var e = el(id); if (e) { press(e); e.addEventListener('click', fn); } };
  on('door', enterWorld); on('back', function () { leaveWorld(); });
  on('mic', startNote); on('send', send); on('call', startCall);
  on('note-send', sendNote); on('note-cancel', cancelNote);
  on('mute', toggleMute); on('end-call', function () { endCall('user'); }); on('route', toggleRoute);
  on('replay', function (e) { e.stopPropagation(); if (S.menu) closeMenu(); else openMenu(); });
  on('pick-cancel', function () { exitPick(); });
  on('pick-go', function () { if (S.range) openPreview(); });
  on('rprev-x', closePreview);
  on('notice-x', clearNotice); on('notice-act', function () { /* production: Linking.openSettings() */ });
  on('os-allow', osAllow); on('os-deny', osDeny);
  Array.prototype.forEach.call(rmenu.querySelectorAll('.mi'), function (m) { m.addEventListener('click', function () { choose(m.getAttribute('data-scope')); }); });
  document.querySelector('.thread').addEventListener('click', function (e) {
    var pb = e.target.closest('.play'); if (pb && !S.pick) { togglePlay(pb.closest('.t')); return; }
    var t = e.target.closest('.t'); if (t) tapTurn(turns().indexOf(t));
  });
  document.querySelector('.thread').addEventListener('keydown', function (e) { var t = e.target.closest('.t'); if (t && S.pick && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); tapTurn(turns().indexOf(t)); } });
  document.addEventListener('pointerdown', function (e) { if (S.menu && !rmenu.contains(e.target) && !replayBtn.contains(e.target)) closeMenu(true); });
  if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  function syncSend() { if (!input) return; composer.classList.toggle('has-text', input.value.trim().length > 0); }
  if (input) input.addEventListener('input', syncSend);
  // Escape unwinds the innermost layer — and never ends a call.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (S.ask) osDeny(); else if (S.preview) closePreview(); else if (S.menu) closeMenu(); else if (S.pick) exitPick(); else if (S.depth === 'world') leaveWorld();
  });
  window.addEventListener('resize', function () { TW = 0; var bx = labelBox(railBtns[idx(S.world)]); set('mx1', bx.x1); set('mx2', bx.x2); commit(); });
  var ACTS = {
    shared: function () { selectWorld('shared'); }, mine: function () { selectWorld('mine'); },
    enter: enterWorld, leave: function () { leaveWorld(); }, note: startNote, notesend: sendNote, notecancel: cancelNote,
    call: startCall, endcall: function () { endCall('user'); }, mute: toggleMute, route: toggleRoute, menu: openMenu,
    full: function () { choose('full'); }, part: function () { choose('part'); }, closepreview: closePreview, exitpick: function () { exitPick(true); },
    allow: osAllow, deny: osDeny, dismiss: clearNotice,
    bg: function () { toBackground('lock'); }, bgapp: function () { toBackground('app'); }, fg: toForeground,
    drop: drop, recover: recover, fail: fail, awaydrop: awayDrop, relaunch: relaunch, barge: barge,
    play: function () { var t = document.querySelector('.thread .t[data-vn]:not([data-kind="spoken"])'); if (t) togglePlay(t); },
    playlast: function () { var ts = document.querySelectorAll('.thread .t.me[data-vn]'); if (ts.length) togglePlay(ts[ts.length - 1]); },
    type: function () { input.value = Q.typingSample; syncSend(); commit(); },
    sendtext: send,
  };
  Array.prototype.forEach.call(document.querySelectorAll('[data-sim]'), function (b) { b.addEventListener('click', function () { var f = ACTS[b.getAttribute('data-sim')]; if (f) f(); }); });

  /* ------------------------------------------------ deterministic capture interface ------ */
  function establishedCall(ms, depth) {
    // a call that began `ms` ago (clock 0 = now); established after connectMs
    callSeq++; S.callStarts++; S.callId = 'call-' + (0x3f9a00 + callSeq * 0x1b7).toString(16);
    S.callStart = -ms; S.call = ms >= Q.script.connectMs ? 'live' : 'connecting'; S.liveAt = S.call === 'live' ? -ms + Q.script.connectMs : 0;
    S.depth = depth;
    callMarker();
  }
  function applyPreset(p) {
    var vm = +params.get('voiceMs') || 0;
    if (p === 'shared' || p === 'public') S.world = p;
    if (p === 'world') S.depth = 'world';
    if (p === 'typing' && input) { input.value = Q.typingSample; syncSend(); }
    if (p === 'note') { S.composer = 'note'; S.noteStart = -(vm || 6400); }
    if (p === 'draft') { S.composer = 'draft'; S.noteMs = vm || 6400; }
    if (p === 'ask-note') { S.perm = 'unknown'; S.ask = 'note'; }
    if (p === 'ask-call') { S.perm = 'unknown'; S.ask = 'call'; }
    if (p === 'denied') { S.perm = 'denied'; S.notice = 'denied'; }
    if (/^call|^bg|^ret|^reconnect|^barge/.test(p)) establishedCall(vm || 84000, /conv/.test(p) ? 'conversation' : 'world');
    if (p === 'call-muted') { S.muted = true; el('mute').setAttribute('aria-pressed', 'true'); }
    if (p === 'call-earpiece') S.route = 'earpiece';
    if (p === 'call-replay-menu') S.menu = true;
    if (p === 'reconnect') S.call = 'reconnecting';
    if (p === 'bg' || p === 'bg-conv') { S.app = 'background'; S.os = p === 'bg' ? 'lock' : 'app'; S.awayAt = -(+params.get('awayMs') || 48000); S.awaySurface = S.depth; }
    if (p === 'barge') { S.barge = Math.floor(((vm || 84000) - Q.script.connectMs) / Q.script.cycleMs) * 10 + 1; }
    if (p === 'failed' || p === 'ended' || p === 'awayended') {
      callSeq++; S.callStarts++; S.callId = 'call-' + (0x3f9a00 + callSeq * 0x1b7).toString(16);
      S.ends.push({ callId: S.callId, reason: p === 'ended' ? 'user' : p === 'failed' ? 'failed' : 'dropped', away: p === 'awayended', ms: 192000 });
      S.callId = null;
      var m = document.createElement('p'); m.className = 'day r-meta callm'; m.setAttribute('data-reason', p === 'ended' ? 'user' : 'failed');
      m.textContent = Q.copy.callRecord.text + ' · 3:12' + (p === 'ended' ? '' : ' · ' + Q.copy.callRecordStopped.text);
      document.querySelector('.thread .new').appendChild(m);
      if (p !== 'ended') S.notice = 'failed';
    }
    if (p === 'relaunch') S.boots = 2;
    if (p === 'playing') { var t = document.querySelector('.thread .t.me[data-vn]'); if (t) { S.playing = t.getAttribute('data-vn'); S.playStart = -(+params.get('playMs') || 5200); } }
    if (p === 'replay-menu') S.menu = true;
    if (p === 'replay-part') { S.pick = true; var r = (params.get('pick') || '').split(',').map(Number); if (r.length === 2 && !isNaN(r[0])) S.range = [r[0], r[1]]; }
    if (p === 'replay-preview') S.preview = true;
  }
  window.__G12rt = {
    state: S,
    at: function (ms) { clockT = ms; render(); return { t: ms, busy: busy() }; },
    act: function (name) { acted = true; ACTS[name](); return true; },
    tap: function (i) { tapTurn(i); return S.range; },
    press: function (sel, on) { var e = document.querySelector(sel); if (e) e.classList.toggle('prs', !!on); return !!e; },
    scroll: function () { var s = el('scroll'); return s ? s.scrollTop : null; },
    speaking: speaking,
    /* The state a reader can USE — compared between standard and Reduced Motion, and asserted by the checks. */
    truth: function () {
      tick();
      var vis = function (e) { if (!e || !e.getClientRects().length) return false; var p = e; while (p && p !== root) { if (p.hasAttribute('inert') || p.hidden) return false; var c = getComputedStyle(p); if (c.visibility === 'hidden' || c.display === 'none' || +c.opacity < 0.5) return false; p = p.parentElement; } return true; };
      var ctl = Array.prototype.slice.call(root.querySelectorAll('#phone > :not(.os) button, #phone > :not(.os) input, [role="checkbox"]')).filter(vis).map(function (b) { return b.id || b.getAttribute('data-world') || b.getAttribute('data-scope') || (b.classList.contains('play') ? 'play' : b.className); }).sort();
      var recs = Array.prototype.slice.call(document.querySelectorAll('.thread .callm')).map(function (m) { return m.textContent; });
      return { world: S.world, depth: S.depth, call: S.call, composer: S.composer, app: S.app, perm: S.perm, ask: S.ask, notice: S.notice,
        callId: S.callId, conversation: S.convId, callStarts: S.callStarts, ends: S.ends.slice(), speaking: speaking(), muted: S.muted, route: S.route,
        label: lineLabel(), lctx: lctxV.textContent, lctxCommits: lctxCommits, replay: root.getAttribute('data-replay'), menu: S.menu, pick: S.pick,
        worldVisible: vis(world), convVisible: vis(conv), noticeVisible: vis(notice), osBg: !osBg.hidden, osPerm: !osPerm.hidden,
        controls: S.app === 'background' ? [] : ctl, turns: turns().length, voiceTurns: document.querySelectorAll('.thread .t.me.voice').length, callRecords: recs,
        playing: S.playing, boots: S.boots };
    },
    measure: function () {
      var r = root.getBoundingClientRect();
      var sb = el('scroll').getBoundingClientRect(), cb = composer.getBoundingClientRect();
      var ts = turns().map(function (t) {
        var b = t.getBoundingClientRect();
        return { who: t.getAttribute('data-who'), kind: t.getAttribute('data-kind') || 'text', x0: b.left - r.left, y0: b.top - r.top, x1: b.right - r.left, y1: b.bottom - r.top };
      }).filter(function (b) { return b.x1 > b.x0 && b.y0 >= sb.top - r.top + 28 && b.y1 <= cb.top - r.top; });
      var box = function (id) { var e = el(id); if (!e || !e.getClientRects().length) return null; var b = e.getBoundingClientRect(); return [b.left - r.left, b.top - r.top, b.width, b.height]; };
      return { w: r.width, h: r.height, vw: innerWidth, dir: root.getAttribute('dir'), fonts: document.fonts.status, turns: ts,
        boxes: { replay: box('replay'), mic: box('mic'), call: box('call'), mute: box('mute'), endCall: box('end-call'), route: box('route'), vlabel: box('vlabel'), notice: box('notice'), composer: box('composer') },
        // The call's words are readable in full SOMEWHERE: on the line, or in the strip above it.
        lineWords: (function () { var lb = lineLabel(); if (!lb) return { text: '', where: 'none', clipped: false };
          if (!cstate.hidden) { var sr = cstateT.getBoundingClientRect(); return { text: cstateT.textContent, where: 'strip', clipped: !cstate.getClientRects().length || sr.height < 8 || getComputedStyle(cstate).visibility === 'hidden' || cstateT.scrollWidth > cstateT.clientWidth + 1 || cstateT.textContent !== lb }; }
          return { text: vlabel.textContent, where: 'line', clipped: vlabel.scrollWidth > vlabel.clientWidth + 1 || getComputedStyle(vlabel).visibility === 'hidden' }; })(),
        strip: box('cstate') };
    },
  };

  var preset = params.get('state') || 'active';
  applyPreset(preset);
  initVals();
  if (params.get('send') && input) { input.value = params.get('send'); send(); }
  commit();
  var atTop = params.get('top') === '1';
  var scroller = el('scroll'); if (scroller) scroller.scrollTop = atTop ? 0 : scroller.scrollHeight;
  var acted = false;
  function remeasure() { TW = 0; var bx = labelBox(railBtns[idx(S.world)]); set('mx1', bx.x1); set('mx2', bx.x2);
    if (!acted && scroller) scroller.scrollTop = atTop ? 0 : scroller.scrollHeight; commit(); }
  window.__G12rt.remeasure = remeasure;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { requestAnimationFrame(remeasure); });
  document.documentElement.setAttribute('data-rt', '1');
})();
