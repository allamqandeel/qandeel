// P4-C3 — the proof's page runtime. ONE state object (S), rendered top → bottom (focus order = visual order). Every word
// comes from the one copy registry (window.C3DATA.rows); every rendered word carries its registry key (data-k, or
// data-ka for an accessible name), so a check that reads the page reads exactly the copy the table records.
//
// Parameters (harness stand-ins; see P4C3_READ_FIRST.md):
//   state   conv · opener · record · sent · call-analysis · call-conv · call-analysis-2 · call-muted · call-ended ·
//           analysis · analysis-pinned · analysis-replay · settings · notif · publicid · understanding ·
//           launch-ios · handoff-ios · launch-android · handoff-android
//   vn=rest|paused|playing (the Voice Note's stored playback state) · sec=proactive|quiet|lock (notif) · os=ios|android
//   lang=en · appearance=light · contrast=more · w=&h= · ts=large · rm=1 (Reduced Motion stand-in) · defect=<planted>
(function () {
  'use strict';
  const D = window.C3DATA, G = D.glyphs;
  const Q = new URLSearchParams(location.search);
  const mm = (q) => { try { return matchMedia(q).matches; } catch { return false; } };
  const P = {
    lang: Q.get('lang') === 'en' ? 'en' : 'ar',
    appearance: (() => { const a = Q.get('appearance') || 'dark'; return a === 'system' ? (mm('(prefers-color-scheme: light)') ? 'light' : 'dark') : a; })(),
    contrast: Q.get('contrast') === 'more' || mm('(prefers-contrast: more)') ? 'more' : 'standard',
    rm: Q.get('rm') === '1' || mm('(prefers-reduced-motion: reduce)'),
    w: +Q.get('w') || 390, h: +Q.get('h') || 844,
    capture: Q.get('capture') === '1',
    state: Q.get('state') || 'conv',
    defect: Q.get('defect') || '',
    ts: Q.get('ts') === 'large' ? 'large' : 'standard',
    vn: Q.get('vn') || 'rest',
    sec: Q.get('sec') || '',
  };
  const lang = P.lang, rtl = lang === 'ar';
  const ROW = Object.fromEntries(D.rows.map((r) => [r.k, r]));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  /** One registered string. */
  const t = (k, vars) => { const r = ROW[k]; if (!r) throw new Error('unregistered copy ' + k); let s = lang === 'ar' ? r.ar : r.en; if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(b); return s; };
  /** A visible registered string, tagged with its key. */
  const tx = (k, cls = '', vars, tag = 'span', extra = '') => `<${tag} class="${cls}" data-k="${k}"${extra}>${esc(t(k, vars))}</${tag}>`;
  /** An accessible name, tagged with its key(s). */
  const an = (keys, text) => ` aria-label="${esc(text)}" data-ka="${[].concat(keys).join(' ')}"`;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const num = (s, cls = '') => `<span class="num ltr ${cls}" dir="ltr">${esc(s)}</span>`;
  /** A spoken length. Arabic counted nouns: 1 · 2 · 3–10 plural · 11+ singular (designing-arabic-frontends §7). */
  function spoken(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    if (lang === 'en') return [m ? `${m} minute${m === 1 ? '' : 's'}` : '', s ? `${s} second${s === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ');
    const w = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`);
    const a = m ? w(m, 'دقيقة واحدة', 'دقيقتان', 'دقائق', 'دقيقة') : '', b = s ? w(s, 'ثانية واحدة', 'ثانيتان', 'ثوانٍ', 'ثانية') : '';
    return a && b ? `${a} و${b}` : a || b;
  }

  // ------------------------------------------------------------------------------------------------ state
  const CALL_ID = 'call-7c21-01';
  const S = { place: 'conv', stack: [], composer: 'idle', recSecs: 7, call: null, extraTurns: [], vn: P.vn, vnPos: 17, notifSec: P.sec, sheet: null, focusAfter: null, launch: null };

  // ------------------------------------------------------------------------------------------------ pieces
  const statusBar = () => `<div class="status" aria-hidden="true"><span class="clock">9:41</span><span class="sys">` +
    `<svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5" width="3" height="6" rx="1" fill="currentColor"/><rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="11" rx="1" fill="currentColor"/></svg>` +
    `<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="8" rx="1.6" fill="currentColor"/><rect x="23.6" y="4" width="1.8" height="4" rx=".9" fill="currentColor" opacity=".45"/></svg></span></div>`;

  const actEntry = () => `<button id="act-entry" class="ibtn pz" type="button"${an(['p3.activityOpen', 'activityNew'], t('p3.activityOpen') + (rtl ? '، ' : ', ') + t('activityNew'))} data-entry="activity">${G.ledger22}<span class="amark" aria-hidden="true"></span></button>`;
  const inCall = () => !!(S.call && !S.call.ended);
  const doorName = () => t('doorName') + (inCall() ? ' — ' + t('cContinues') : '');

  function railHTML(sel, id = 'rail') {
    const items = [{ key: 'mine', k: 'mine', g: G.navMine }, { key: 'shared', k: 'shared', g: G.navShared }, { key: 'public', k: 'public', g: G.navPublic }];
    const it = (n) => { const on = n.key === sel;
      return `<button class="it pz${on ? ' sel' : ''}" type="button" data-nav="${n.key}"${on ? ' aria-current="page"' : ''}><span class="ic" aria-hidden="true">${n.g}</span>${tx(n.k, 'lb')}</button>`; };
    return `<nav id="${id}" class="rail" aria-label="${esc(t('navLabel'))}" data-ka="navLabel"><div class="items">${items.map(it).join('')}</div></nav>`;
  }

  /** THE VOICE NOTE TURN — an UTTERANCE carrying one stored recording and its one control. */
  function voiceTurn(v, id) {
    const st = v.play || 'rest', pos = st === 'rest' ? 0 : v.pos, frac = st === 'rest' ? 0 : Math.max(0, Math.min(1, pos / v.total));
    const playing = st === 'playing';
    const ctl = `<button class="vplay pz" type="button" id="${id}-play"${an(playing ? 'vPause' : 'vPlay', t(playing ? 'vPause' : 'vPlay'))}>${playing ? G.pause24 : G.play24}</button>`;
    const pct = (frac * 100).toFixed(2) + '%';
    const track = `<span class="vtrack" aria-hidden="true"><span class="rest"></span><span class="done" style="inline-size:${pct}"></span><span class="pos" style="inset-inline-start:${pct}"></span></span>`;
    const time = st === 'rest' ? mmss(v.total) : mmss(pos);
    const valueName = st === 'rest' ? '' : ` aria-description="${esc(t('vProgress', { a: spoken(pos), b: spoken(v.total) }))}" data-kd="vProgress"`;
    return `<div class="t me vn" id="${id}" data-kind="voice" data-play="${st}" role="group"${an('vNoteName', t('vNoteName', { d: spoken(v.total) }))}${valueName}>` +
      `${ctl}${track}<span class="vtime r-meta num ltr" dir="ltr" aria-hidden="true">${time}</span></div>`;
  }
  /** THE FINISHED-CALL RECORD — a mark in the history's plane; never a control, never a player. */
  function callRecord(c, id) {
    return `<div class="crec" id="${id}" data-kind="call-record" role="group"${an('cRecordName', t('cRecordName', { d: spoken(c.secs) }))}>` +
      `<span class="rl" aria-hidden="true"></span><span class="cg" aria-hidden="true">${G.call16}</span>${tx('cRecord', 'cw r-meta', null, 'span', ' aria-hidden="true"')}` +
      // Call Rail A's seam: 8 across for 48 up (machines.mjs), leaning toward the END edge; it follows layout direction
      `<span class="seam" aria-hidden="true"><svg class="mirror" width="3" height="12" viewBox="0 0 3 12"><path d="M.5 11.5 2.5 .5" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg></span><span class="cd r-meta num ltr" dir="ltr" aria-hidden="true">${mmss(c.secs)}</span><span class="rl" aria-hidden="true"></span></div>`;
  }
  let vnSeq = 0;
  function turn(x) {
    if (x.day) return `<p class="day r-meta">${esc(x.day)}${x.time ? ' ' + num(x.time) : ''}</p>`;
    if (x.call) return callRecord(x.call, 'crec-' + (vnSeq++));
    if (x.voice) return voiceTurn({ ...x.voice, play: x.voice.play || S.vn, pos: x.voice.pos ?? S.vnPos }, 'vn-' + (vnSeq++));
    const who = x.who === 'me' ? (rtl ? 'كلامك' : 'You') : t('product');
    const sr = `<span class="sr">${esc(who)}: </span>`;
    if (x.opener) {
      // THE NORMAL OPENER — an identity moment (P4-C1 Q-A): the canonical Q stands beside it. Arabic frozen, exact.
      const words = t('opener', { display_name: D.displayName[lang] });
      return `<div class="t q opener"><span class="qm" aria-hidden="true">${G.q18}</span>${sr}<p class="r-body" dir="auto" data-k="opener">${esc(words)}</p></div>`;
    }
    return `<div class="t ${x.who === 'me' ? 'me' : 'q'}">${sr}<p class="r-body" dir="auto" data-fixture="1">${esc(x.text)}</p></div>`;
  }

  function composerHTML() {
    if (inCall()) return callLineHTML('composer');
    if (S.composer === 'rec') {
      return `<div class="composer" id="composer" data-mode="rec"><div class="recline"><span class="rg" aria-hidden="true">${G.micRec20}</span>${tx('vRecording', 'rw r-action')}` +
        `<span class="re r-action num ltr" dir="ltr"${an('cElapsedName', spoken(S.recSecs))}>${mmss(S.recSecs)}</span></div>` +
        `<button id="rec-cancel" class="cbtn pz slot-i" type="button"${an('vCancel', t('vCancel'))}>${G.close24}</button>` +
        `<button id="rec-send" class="cbtn pz slot-o send" type="button"${an('vSend', t('vSend'))}>${G.send24}</button></div>`;
    }
    return `<div class="composer" id="composer" data-mode="idle"><div class="write"><span class="ph r-body" data-k="composer">${esc(t('composer'))}</span><div class="line"></div></div>` +
      `<button id="call-entry" class="cbtn pz slot-i" type="button"${an('cCall', t('cCall'))}>${G.call24}</button>` +
      `<button id="mic-entry" class="cbtn pz slot-o" type="button"${an('vRecord', t('vRecord'))}>${G.mic24}</button></div>`;
  }
  /** THE CALL LINE — P2 Call Rail A, exactly as P2-A draws it; elapsed at START; one assistive status channel. */
  function callLineHTML(where) {
    const c = S.call, el = S.now - c.start;
    const status = c.muted ? t('cA11yMuted') : t('cA11yOn');
    // designing-arabic-frontends §4: the positioned box keeps the page direction (so inset-inline-start is the START
    // edge in both scripts); only the digits inside it are an LTR island.
    return `<div class="composer callline" id="${where === 'composer' ? 'composer' : 'callline'}" data-mode="call" data-call-id="${c.id}" data-muted="${c.muted ? 1 : 0}" data-route="${c.route ? 1 : 0}">` +
      `${G.railArt}<span class="celapsed r-meta"${an('cElapsedName', t('cElapsedName', { d: spoken(el) }))} role="timer"><span class="num" dir="ltr">${mmss(el)}</span></span>` +
      `<button id="c-route" class="cbtn pz" type="button" aria-pressed="${c.route}"${an('cRoute', t('cRoute'))}>${G.routeOn}${G.routeOff}</button>` +
      `<button id="c-mute" class="cbtn pz" type="button" aria-pressed="${c.muted}"${an(c.muted ? 'cUnmute' : 'cMute', t(c.muted ? 'cUnmute' : 'cMute'))}>${G.callMic}${G.callMuted}</button>` +
      `<button id="c-end" class="cbtn pz" type="button"${an('cEnd', t('cEnd'))}>${G.endCall}</button>` +
      `<p id="call-status" class="sr" role="status" aria-live="polite" data-ka="${c.muted ? 'cA11yMuted' : 'cA11yOn'}">${esc(status)}</p></div>`;
  }

  function convHTML() {
    const hdr = `<div class="hdr" id="hdr"><div class="grp" id="grp-start">${actEntry()}</div>` +
      `<div class="grp push-end" id="grp-end"><button id="door" class="hbtn pz" type="button" data-entry="analysis"${an(['doorName'].concat(inCall() ? ['cContinues'] : []), doorName())}>${G.depth22}${tx('door', 'lb')}</button>` +
      `<button id="replay" class="ibtn pz" type="button"${an('replayEntry', t('replayEntry'))}>${G.replay22}</button></div></div>`;
    const row = `<div class="prow" id="prow"><button id="u-entry" class="hbtn uentry pz" type="button" data-entry="understanding">${tx('understanding', 'lb')}<span class="chev" aria-hidden="true">${G.chev16}</span></button>` +
      `<span class="push-end"></span><button id="set-entry" class="ibtn pz" type="button" data-entry="settings"${an('settings', t('settings'))}>${G.settings22}</button></div>`;
    vnSeq = 0;
    const turns = D.thread[lang].concat(S.extraTurns).map(turn).join('');
    return statusBar() + hdr + row + `<section class="conv" aria-label="${esc(t('conv'))}" data-ka="conv"><div class="thread">${turns}</div></section>` + composerHTML() + railHTML('mine');
  }

  // ------------------------------------------------------------------------------------------------ pages
  const pageHdr = (titleKey, id = 'pg-title') => `${statusBar()}<div class="hdr"><button class="ibtn pz" type="button" data-back${an('p3.back', t('p3.back'))}>${G.back22}</button>` +
    `<h1 class="r-head" id="${id}" tabindex="-1" data-k="${titleKey}">${esc(t(titleKey))}</h1></div>`;
  const GROUPS = ['gAccount', 'gSecurity', 'gQandeel', 'gNotif', 'gAppearance', 'gPrivacy', 'gIntro', 'gPlan', 'gSupport'];
  function settingsHTML() {
    const rows = GROUPS.map((k) => `<button class="srow pz" type="button" data-group="${k}"${k === 'gNotif' ? ' data-entry="notif"' : ''}>${tx(k, 'lb r-support')}<span class="chev" aria-hidden="true">${G.chev16}</span></button>`).join('');
    return `<section class="page set" aria-labelledby="pg-title">${pageHdr('settings')}<div class="body">${rows}` +
      `<div class="handoff r-meta" role="note"><span class="tag">P4-C3 · COPY IN CONTEXT — GROUP ORDER / SCREEN DESIGN NOT FROZEN (P1 §8.1; P4-DQ-07 → AUDIT)</span></div></div></section>`;
  }
  const opt = (k, help, on) => `<button class="opt pz" type="button" role="radio" aria-checked="${on}"><span class="dot" aria-hidden="true"></span>${tx(k, 'ol r-support')}${tx(help, 'oh r-meta')}</button>`;
  const srow = (k, v, vk) => `<div class="srow">${tx(k, 'lb r-support')}${v ? `<span class="val r-meta" data-k="${vk || ''}">${esc(v)}</span>` : ''}</div>`;
  function notifHTML() {
    const lv = (s, l) => srow(s, t('p3.levels.' + l), 'p3.levels.' + l);
    const body =
      `<div id="n-proactive">${tx('p3.proactive', 'sec r-meta', null, 'h2')}${tx('p3.proactiveHelp', 'help r-meta', null, 'p')}` +
      `<div role="radiogroup" aria-labelledby="x">${opt('p3.proactiveOpts.allow', 'p3.proactiveOptHelp.allow', true)}${opt('p3.proactiveOpts.reduce', 'p3.proactiveOptHelp.reduce', false)}${opt('p3.proactiveOpts.off', 'p3.proactiveOptHelp.off', false)}</div></div>` +
      `<div id="n-quiet">${tx('p3.quiet', 'sec r-meta', null, 'h2')}${srow('p3.quietOn', t('p3.on'), 'p3.on')}` +
      `<div class="srow"><span class="lb r-support" data-k="p3.quietRange">${esc(t('p3.quietRange')).replace('{0}', num('23:00')).replace('{1}', num('08:00'))}</span></div>${tx('p3.quietHelp', 'help r-meta', null, 'p')}` +
      `${tx('p3.snooze', 'sec r-meta', null, 'h2')}<div class="chips" role="radiogroup">${['1h', '8h', '24h', 'custom'].map((d) => `<button class="chip pz r-action" type="button" role="radio" aria-checked="false" data-k="p3.snoozeOpts.${d}">${esc(t('p3.snoozeOpts.' + d))}</button>`).join('')}</div></div>` +
      `<div id="n-lock">${tx('p3.lockSec', 'sec r-meta', null, 'h2')}${tx('p3.lockHelp', 'help r-meta', null, 'p')}` +
      `${lv('mine', 'L1')}${lv('shared', 'L1')}${lv('intro', 'L0')}${lv('p3.lockSubjects.reminder', 'L2')}${lv('p3.lockSubjects.security', 'L1')}` +
      `${tx('p3.levelHelp.L0', 'help r-meta', null, 'p')}` +
      `${tx('shared', 'sec r-meta', null, 'h2')}${srow('p3.sharedAll', t('p3.on'), 'p3.on')}` +
      `${tx('public', 'sec r-meta', null, 'h2')}${srow('p3.publicInter', t('p3.on'), 'p3.on')}${srow('p3.publicDisc', t('p3.off'), 'p3.off')}${tx('p3.publicDiscHelp', 'help r-meta', null, 'p')}` +
      `${tx('intro', 'sec r-meta', null, 'h2')}${srow('p3.introOn', t('p3.on'), 'p3.on')}${tx('p3.introHelp', 'help r-meta', null, 'p')}` +
      `${tx('p3.systemSec', 'sec r-meta', null, 'h2')}${tx('p3.securityAlways', 'help r-meta', null, 'p')}${srow('p3.systemOther', t('p3.on'), 'p3.on')}` +
      `<button class="srow pz" type="button">${tx('p3.device', 'lb r-support')}<span class="chev" aria-hidden="true">${G.chev16}</span></button>${tx('p3.deviceHelp', 'help r-meta', null, 'p')}</div>`;
    return `<section class="page" aria-labelledby="pg-title">${pageHdr('gNotif')}<div class="body" id="nbody">${body}</div></section>`;
  }
  function publicIdHTML() {
    return settingsHTML().replace('<section class="page set"', '<section class="page set" inert aria-hidden="true"') +
      `<div class="scrim" aria-hidden="true"></div><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="pid-t" aria-describedby="pid-b">` +
      `<h2 class="r-head" id="pid-t" tabindex="-1" data-k="pidTitle">${esc(t('pidTitle'))}</h2>${tx('pidBody', 'body2 r-support', null, 'p', ' id="pid-b"')}` +
      `<dl class="ids">${tx('pidCurrent', 'r-meta', null, 'dt')}<dd class="r-support"><bdi dir="ltr" data-k="pidFixtureOld">${esc(t('pidFixtureOld'))}</bdi></dd>` +
      `${tx('pidNew', 'r-meta', null, 'dt')}<dd class="r-support"><bdi dir="ltr" data-k="pidFixtureNew">${esc(t('pidFixtureNew'))}</bdi></dd></dl>` +
      `<div class="acts"><button class="act pz r-action" type="button" id="pid-keep">${tx('pidKeep')}</button><button class="act commit pz r-action" type="button" id="pid-confirm">${tx('pidConfirm')}</button></div></section>`;
  }
  function understandingHTML() {
    const spec = [['uFix1', 'confClear'], ['uFix2', 'confForming'], ['uFix3', 'confMixed'], ['uFix4', 'confMore']].map(([f, c]) =>
      `<div class="spec"><p class="r-support" data-k="${f}" data-fixture="1">${esc(t(f))}</p><p class="st r-meta"${an(['confName', c], t('confName', { state: t(c) }))}><span class="k" data-k="${c}" aria-hidden="true">${esc(t(c))}</span></p></div>`).join('');
    return `<section class="page" aria-labelledby="pg-title">${pageHdr('understanding')}<div class="body"><div class="handoff r-meta" role="note"><span class="tag">P4-C3 · COPY SPECIMEN — NOT A SCREEN DESIGN (P1 §11; P4-DQ-07 → END-TO-END AUDIT)</span></div>${spec}</div></section>`;
  }
  /** SYSTEM LAUNCH — platform-owned surfaces, then the first app-owned frame. No Product chrome, no words, no lantern. */
  function launchHTML(kind) {
    if (kind === 'launch-android') return `<div class="launch" data-owner="system" data-surface="android-splash">${statusBar()}<div class="asplash" id="asplash"><div class="mask"><img alt="" src="${G.iconFg}"></div></div></div>`;
    if (kind === 'launch-ios') return `<div class="launch" data-owner="system" data-surface="ios-launch-screen">${statusBar()}</div>`;
    return `<div class="launch" data-owner="app" data-surface="${kind}" id="boundary">${statusBar()}</div>`;
  }

  // ------------------------------------------------------------------------------------ the Analysis (G3.2, frozen)
  const G3STATE = { analysis: 'P1', 'analysis-pinned': 'P4', 'analysis-replay': 'REPLAY', 'call-analysis': 'CALL_ANALYSIS', 'call-muted': 'CALL_ANALYSIS', 'call-analysis-2': 'CALL_ANALYSIS' };
  let G32 = null, g32Ready = null;
  function g32Frame(st) {
    if (G32) return g32Ready;
    const q = new URLSearchParams({ capture: '1', state: 'CONV', lang, w: String(P.w), h: String(P.h), appearance: P.appearance });
    G32 = Object.assign(document.createElement('iframe'), { id: 'g32', title: t('door') });
    G32.src = 'g3.2/index.html?' + q.toString();
    document.getElementById('g32host').appendChild(G32);
    g32Ready = new Promise((res) => G32.addEventListener('load', () => {
      const d = G32.contentDocument, w = G32.contentWindow;
      // «المحادثة» leaves the Analysis for this proof's Conversation — the same call continues (G1.2 §1)
      d.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#back')) { e.preventDefault(); e.stopPropagation(); toConversation(); } }, true);
      Promise.resolve(w.__G32 && w.__G32.ready).then(() => { substituteCopy(); w.__G32.clock(0); w.__G32.enter(st); substituteStatic(); })
        .then(() => new Promise((r) => w.requestAnimationFrame(() => w.requestAnimationFrame(() => setTimeout(r, 250))))).then(res);
    }, { once: true }));
    return g32Ready;
  }
  /** Runtime-only copy substitution: G3.2's copy object is changed in memory, never its bytes. */
  function substituteCopy() {
    const w = G32.contentWindow, L = w.__G32DATA.langs[lang].copy;
    const set = (o, k) => { if (o) o.text = t(k); };
    set(L.liveSlotFollowing, 'liveFollowing'); set(L.replay, 'replayEntry'); set(L.replayFull, 'replayFull'); set(L.replayPart, 'replayPart');
    set(L.timelineLabel, 'timelineName'); set(L.timelineHint, 'timelineHint'); set(L.previewCancel, 'previewCancel'); set(L.backName, 'backName');
    set(L.replayCallNote, 'replayCallNote');
    if (P.defect === 'livecopy') L.liveSlotFollowing.text = lang === 'en' ? 'Live' : 'مباشر';
  }
  function substituteStatic() {
    const d = G32.contentDocument, $ = (id) => d.getElementById(id);
    const mark = (e, k) => { if (e) e.setAttribute('data-ka', k); };
    if ($('replay')) { $('replay').setAttribute('aria-label', t('replayEntry')); mark($('replay'), 'replayEntry'); }
    if ($('rmenu')) { $('rmenu').setAttribute('aria-label', t('replayNoun')); mark($('rmenu'), 'replayNoun'); }
    d.querySelectorAll('#rmenu .mi').forEach((m) => { const k = m.dataset.scope === 'full' ? 'replayFull' : 'replayPart'; m.querySelector('.lb').textContent = t(k); m.querySelector('.lb').setAttribute('data-k', k); });
    if ($('rmenu-note')) { $('rmenu-note').textContent = t('replayCallNote'); $('rmenu-note').setAttribute('data-k', 'replayCallNote'); }
    if ($('tl-track')) { $('tl-track').setAttribute('aria-label', t('timelineName')); mark($('tl-track'), 'timelineName'); }
    if ($('tl-hint')) { $('tl-hint').textContent = t('timelineHint'); $('tl-hint').setAttribute('data-k', 'timelineHint'); }
    if ($('back')) { $('back').setAttribute('aria-label', t('backName')); mark($('back'), 'backName'); }
    // P4-C2 §5: English casing is QANDEEL — G3.2's own names still carry the older "Qandeel" (runtime only)
    d.querySelectorAll('[aria-label]').forEach((e) => { const v = e.getAttribute('aria-label'); if (/\bQandeel\b/.test(v)) e.setAttribute('aria-label', v.replace(/\bQandeel\b/g, t('product'))); });
    // G3.2's pre-P2 call line (circular End Call, simulated level trace) and its second live channel are superseded
    // (P2 §6, §11.1; G1.2 §4): hidden and inert at runtime; P2 Call Rail A stands in the same box instead.
    let st = d.getElementById('c3-rt'); if (!st) { st = d.createElement('style'); st.id = 'c3-rt'; d.head.appendChild(st); }
    st.textContent = P.defect === 'fakelevel' ? '' : '#composer{visibility:hidden !important}';
    for (const id of ['composer', 'rail', 'marker', 'call-a11y']) { const e = $(id); if (e) { e.setAttribute('inert', ''); e.setAttribute('aria-hidden', 'true'); } }
  }
  const g32Rect = (id) => { const d = G32 && G32.contentDocument, e = d && d.getElementById(id); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); if (!r.width || !r.height) return null; return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const g32Truth = () => { const w = G32 && G32.contentWindow; return w && w.__G32 ? w.__G32.truth() : null; };
  function analysisOverlay() {
    const host = document.getElementById('aover'); if (!host) return;
    let html = '';
    let rb = g32Rect('rail'); const mk = g32Rect('marker');
    if (rb && mk) { const y = Math.min(rb.y, mk.y) - 1, b = Math.max(rb.b, mk.b); rb = { ...rb, y, b, h: b - y }; }
    if (rb) html += `<div id="arail" style="left:${rb.x}px;top:${rb.y}px;width:${rb.w}px;height:${rb.h}px">${railHTML('mine', 'rail-a')}<div class="homebar" aria-hidden="true"></div></div>`;
    // the P2 call line in G3.2's own composer box, while a call is active (Analysis-first, G1.2 §1)
    const cb = inCall() ? (g32Rect('composer') || S.lastCallBox) : null;
    if (inCall() && cb) { S.lastCallBox = cb; html += `<div id="acall" style="left:${cb.x}px;top:${cb.y}px;width:${cb.w}px;height:${cb.h}px">${callLineHTML('analysis')}</div>`; }
    host.innerHTML = html;
    S.overlayKey = boxKey();
  }
  /** The overlay follows G3.2's OWN layout: re-placed whenever the frame's rail or call-line box moves. */
  const boxKey = () => JSON.stringify([g32Rect('rail'), g32Rect('marker'), inCall() ? g32Rect('composer') : null]);
  (function follow() { if (S.place === 'analysis' && G32 && G32.contentWindow && G32.contentWindow.__G32 && boxKey() !== S.overlayKey) analysisOverlay(); requestAnimationFrame(follow); })();

  // ------------------------------------------------------------------------------------------------ navigation
  function go(place, extra = {}) { if (place !== S.place) S.stack.push({ place: S.place }); S.place = place; Object.assign(S, extra); S.focusAfter = ['settings', 'notif', 'understanding'].includes(place) ? 'h1' : null; render(); }
  function back() { const p = S.stack.pop() || { place: 'conv' }; S.place = p.place; render(); }
  function toConversation() { S.place = 'conv'; S.stack = []; render(); }
  function toAnalysis(st) { S.place = 'analysis'; g32Frame(st || (inCall() ? 'CALL_ANALYSIS' : 'P1')).then(render); render(); }
  function startCall() { S.call = { id: CALL_ID, start: S.now, muted: false, route: true, ended: false }; toAnalysis('CALL_ANALYSIS'); }
  function endCall() {
    const secs = S.now - S.call.start; S.call.ended = true;
    // the frame's own (hidden) call ends with ours: one call, one truth
    try { const w = G32 && G32.contentWindow; if (w && w.__G32 && w.__G32.truth().call !== 'none') w.__G32.act('endCall'); } catch (e) { /* the frame may not be loaded */ } S.extraTurns.push({ call: { secs } }); S.place = 'conv'; S.stack = []; render(); }

  function render() {
    const inA = S.place === 'analysis';
    let view = '';
    if (S.launch) view = launchHTML(S.launch);
    else if (S.place === 'settings') view = settingsHTML();
    else if (S.place === 'notif') view = notifHTML();
    else if (S.place === 'publicid') view = publicIdHTML();
    else if (S.place === 'understanding') view = understandingHTML();
    else if (!inA) view = convHTML();
    const phone = document.getElementById('phone'), ui = document.getElementById('ui');
    document.getElementById('g32host').hidden = !inA;
    document.getElementById('aover').hidden = !inA;
    ui.innerHTML = `<span class="fprobe" aria-hidden="true"><span style="font-weight:400">ا</span><span style="font-weight:500">ا</span><span style="font-weight:600">ا</span></span>` +
      `<div id="view">${view}</div>${inA ? '' : '<div class="homebar" aria-hidden="true"></div>'}`;
    phone.dataset.place = S.launch ? 'launch' : S.place;
    phone.dataset.call = inCall() ? 'live' : (S.call && S.call.ended ? 'ended' : 'none');
    // G3 §C.1 / P1 §12: the Analysis is one dark place under every appearance; everything else follows the appearance
    phone.dataset.appearance = inA ? 'dark' : P.appearance;
    if (inA && G32 && G32.contentWindow && G32.contentWindow.__G32) analysisOverlay();
    else if (!inA) { document.getElementById('aover').innerHTML = ''; S.overlayKey = null; }
    // harness: `show=<selector>` scrolls the thread (as a reader would) so that turn stands in the upper third of the view
    const show = Q.get('show'), th = phone.querySelector('.conv .thread'), tg = show && phone.querySelector(show);
    if (th && tg) { const ch = phone.querySelector('.conv').clientHeight, H = th.offsetHeight; th.style.bottom = 'auto'; th.style.top = Math.max(ch - H, Math.min(0, Math.round(ch * 0.3 - tg.offsetTop))) + 'px'; }
    if (S.place === 'notif' && S.notifSec) { const b = document.getElementById('nbody'), s = document.getElementById('n-' + S.notifSec); if (b && s) b.scrollTop = s.offsetTop - 4; }
    if (S.focusAfter) { const f = phone.querySelector(S.focusAfter); if (f) f.focus({ preventScroll: true }); S.focusAfter = null; }
    harness();
  }

  // ------------------------------------------------------------------------------------------------ input
  function onClick(e) {
    const b = e.target.closest('button'); if (!b || !document.getElementById('phone').contains(b)) return;
    if (b.matches('[data-back]')) return back();
    if (b.dataset.nav) { if (b.dataset.nav === 'mine') return toConversation(); return; }
    if (b.id === 'door') return toAnalysis();
    if (b.id === 'call-entry') return startCall();
    if (b.id === 'c-end') return endCall();
    if (b.id === 'c-mute') { S.call.muted = !S.call.muted; return render(); }
    if (b.id === 'c-route') { S.call.route = !S.call.route; return render(); }
    if (b.id === 'mic-entry') { S.composer = 'rec'; S.recStart = S.now; S.recSecs = 0; return render(); }
    if (b.id === 'rec-cancel') { S.composer = 'idle'; return render(); }
    if (b.id === 'rec-send') { S.extraTurns.push({ who: 'me', voice: { total: Math.max(1, S.recSecs), play: 'rest' } }); S.composer = 'idle'; return render(); }
    if (b.classList.contains('vplay')) { S.vn = S.vn === 'playing' ? 'paused' : 'playing'; return render(); }
    if (b.id === 'pid-keep' || b.id === 'pid-confirm') { S.place = 'settings'; return render(); }
    const en = b.dataset.entry;
    if (en === 'settings') return go('settings');
    if (en === 'notif') return go('notif');
    if (en === 'understanding') return go('understanding');
  }
  const down = (e) => { const b = e.target.closest('.pz'); if (b) { b.classList.add('down'); S.held = b; } };
  const up = () => { if (S.held) { S.held.classList.remove('down'); S.held = null; } };

  // ------------------------------------------------------------------------------------------------ harness
  function harness() {
    const h = document.getElementById('harness'); if (!h) return;
    const link = (patch, label, on) => { const q = new URLSearchParams(location.search); for (const [k, v] of Object.entries(patch)) { if (v === null) q.delete(k); else q.set(k, v); } q.delete('capture'); return `<a href="?${q}" class="${on ? 'on' : ''}">${label}</a>`; };
    const states = ['conv', 'opener', 'record', 'sent', 'call-analysis', 'call-conv', 'call-analysis-2', 'call-muted', 'call-ended', 'analysis', 'analysis-pinned', 'analysis-replay', 'settings', 'notif', 'publicid', 'understanding', 'launch-ios', 'handoff-ios', 'launch-android', 'handoff-android'];
    const own = S.launch ? (S.launch.startsWith('launch') ? 'SYSTEM LAUNCH — platform-owned surface' : 'APP OWNED — the first app-owned frame. STANDALONE LANTERN TASK BEGINS AFTER THIS BOUNDARY (QANDEEL — Lantern Gateway Identity Moment v1). Nothing is designed here.') : '';
    h.innerHTML = `<span class="flag">PROOF HARNESS — NOT PRODUCT UI</span><h1>P4-C3 residual visual + copy proof</h1>` +
      `<p>P4 ACTIVE — NOT CLOSED. Every new string is PROPOSED_FOR_PO_REVIEW; Voice / call words are RUNTIME_GATED (PROOF ONLY / NOT COPY FREEZE).</p>${own ? `<p><b>${own}</b></p>` : ''}` +
      `<h2>States</h2>${states.map((s) => link({ state: s }, s, P.state === s)).join('')}` +
      `<h2>Voice Note playback (stored state)</h2>${['rest', 'paused', 'playing'].map((v) => link({ vn: v }, v, P.vn === v)).join('')}` +
      `<h2>Device stand-ins</h2>${link({ lang: lang === 'en' ? null : 'en' }, 'English', lang === 'en')}${link({ appearance: P.appearance === 'light' ? null : 'light' }, 'Light', P.appearance === 'light')}` +
      `${link({ contrast: P.contrast === 'more' ? null : 'more' }, 'Increased contrast', P.contrast === 'more')}${link({ rm: P.rm ? null : '1' }, 'Reduced Motion', P.rm)}${link({ w: P.w === 320 ? null : '320', h: P.w === 320 ? null : '568' }, '320 × 568', P.w === 320)}${link({ w: P.w === 430 ? null : '430', h: P.w === 430 ? null : '932' }, '430 × 932', P.w === 430)}${link({ ts: P.ts === 'large' ? null : 'large' }, 'Large text (browser stand-in)', P.ts === 'large')}`;
  }

  // ------------------------------------------------------------------------------------------------ boot
  function boot() {
    const mount = document.getElementById('mount');
    const os = (P.state.includes('android') || Q.get('os') === 'android') ? 'android' : 'ios';
    mount.innerHTML = `<div id="phone" dir="${P.defect === 'wrongdir' ? (rtl ? 'ltr' : 'rtl') : (rtl ? 'rtl' : 'ltr')}" lang="${rtl ? 'ar-EG' : 'en'}" data-appearance="${P.appearance}" data-contrast="${P.contrast}" data-lang="${lang}" data-textsize="${P.ts}" data-rm="${P.rm ? 1 : 0}" data-os="${os}"` +
      ` data-defect="${esc(P.defect)}" data-scroll="${P.state === 'opener' ? 'top' : ''}" style="--W:${P.w}px;--H:${P.h}px">` +
      `<div id="g32host" hidden></div><div id="aover" hidden></div><div id="ui"></div></div>` + (P.capture ? '' : '<aside id="harness" class="harness"></aside>');
    if (!P.capture) document.body.classList.add('live');
    document.documentElement.lang = rtl ? 'ar-EG' : 'en';
    const phone = document.getElementById('phone');
    phone.addEventListener('click', onClick); phone.addEventListener('pointerdown', down); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    const st = P.state;
    // the one virtual clock (seconds). Deterministic in capture; in the live page it advances with real time.
    const T0 = { 'call-analysis': 16, 'call-muted': 16, 'call-conv': 102, 'call-analysis-2': 118, 'call-ended': 131 };
    S.now = +(Q.get('t') || T0[st] || 0);
    if (st.startsWith('launch-') || st.startsWith('handoff-')) S.launch = st;
    else if (st === 'record') { S.composer = 'rec'; S.recSecs = 7; }
    else if (st === 'sent') { S.extraTurns.push({ who: 'me', voice: { total: 7, play: 'rest' } }); }
    else if (st.startsWith('call-')) {
      S.call = { id: CALL_ID, start: 0, muted: st === 'call-muted', route: st !== 'call-muted', ended: false };
      if (st === 'call-ended') endCall();
      else if (st === 'call-conv') { S.place = 'conv'; g32Frame('CALL_ANALYSIS'); }
      else { S.place = 'analysis'; g32Frame('CALL_ANALYSIS'); }
    } else if (G3STATE[st]) { S.place = 'analysis'; g32Frame(G3STATE[st]); }
    else if (['settings', 'notif', 'publicid', 'understanding'].includes(st)) { S.stack = [{ place: 'conv' }]; S.place = st; }
    if (P.defect === 'waveform') S.vn = 'playing';
    render();
    const pr = Q.get('press'); if (pr) { const e = document.querySelector(pr); if (e) e.classList.add('down'); }
    // ready = fonts applied, the frame settled, and G3.2's measured boxes unchanged for 6 consecutive frames
    const stable = () => new Promise((res) => { let last = '', same = 0, n = 0; (function f() { const k = G32 ? boxKey() : ''; same = k === last ? same + 1 : 0; last = k; if (same >= 6 || ++n > 240) res(); else requestAnimationFrame(f); })(); });
    Promise.all([document.fonts.ready, S.place === 'analysis' || st === 'call-conv' ? g32Ready : null]).then(stable).then(() => {
      render();
      plantDefects();
      if (pr) { const e = document.querySelector(pr); if (e) e.classList.add('down'); }
      phone.setAttribute('data-ready', '1');
      if (!P.capture) setInterval(() => { S.now += 1; if (S.composer === 'rec') S.recSecs += 1; if (inCall() || S.composer === 'rec') render(); }, 1000);
    });
  }

  /** Validator-only planted defects: each must be rejected by its named check (data/CHECKS.json). Never in a board. */
  function plantDefects() {
    const d = P.defect, $ = (s) => document.querySelector(s); if (!d) return;
    if (d === 'waveform') { const tr = $('.vtrack'); if (tr) tr.insertAdjacentHTML('beforeend', '<svg class="wave" width="120" height="24"><path d="M0 12 L10 4 L20 20 L30 8 L40 16" stroke="currentColor" fill="none"/></svg>'); }
    if (d === 'callplay') { const c = $('.crec'); if (c) c.insertAdjacentHTML('beforeend', `<button class="vplay" type="button" aria-label="${esc(t('vPlay'))}">${G.play24}</button>`); }
    if (d === 'calltranscript') { const c = $('.crec'); if (c) c.insertAdjacentHTML('afterend', '<p class="r-meta" data-transcript="1">…</p>'); }
    if (d === 'speakingprose') { const c = $('.callline'); if (c) c.insertAdjacentHTML('beforeend', `<span class="r-meta" style="position:absolute;top:0;inset-inline-start:80px">${esc(t('cA11yOn'))}</span>`); }
    if (d === 'openerdrift') { const o = $('[data-k="opener"]'); if (o) o.textContent = o.textContent.replace('اهلا', 'أهلًا'); }
    if (d === 'casing') { const e = document.querySelector('[data-k="mine"]'); if (e) e.textContent = 'Qandeel'; }
    if (d === 'noname') { const e = $('#c-mute'); if (e) e.removeAttribute('aria-label'); }
    if (d === 'colouronly') { const e = $('.vn'); if (e) e.setAttribute('data-colouronly', '1'); const p = $('.vn .pos'); if (p) p.remove(); const dn = $('.vn .done'); if (dn) { dn.style.height = '1px'; dn.style.marginTop = '-.5px'; } }
    if (d === 'lightanalysis') { document.getElementById('phone').dataset.appearance = 'light'; }
    if (d === 'splashtext') { const l = $('.launch'); if (l) l.insertAdjacentHTML('beforeend', `<p class="r-title" style="position:absolute;top:60%;width:100%;text-align:center">${esc(t('product'))}</p>`); }
    if (d === 'lanterncontent') { const l = $('#boundary'); if (l) l.insertAdjacentHTML('beforeend', '<div data-lantern="1" style="position:absolute;left:50%;top:40%;width:60px;height:90px;margin-left:-30px;border-radius:30px 30px 12px 12px;box-shadow:0 0 40px var(--mark)"></div>'); }
    if (d === 'fakedelay') { const l = $('.launch'); if (l) l.setAttribute('data-min-duration-ms', '2500'); }
    if (d === 'smalltarget') { const e = $('.vplay'); if (e) { e.style.width = '30px'; e.style.height = '30px'; } }
    if (d === 'ungated') { const e = $('[data-k="vRecording"]'); if (e) e.setAttribute('data-k', 'confClear'); }
    if (d === 'contextword') { const e = $('[data-k="confMore"]'); if (e) e.textContent = 'Needs more context'; }
    if (d === 'callchange') { const c = $('.callline'); if (c) c.setAttribute('data-call-id', 'call-other-02'); }
  }

  // ------------------------------------------------------------------------------------------------ measurement API
  const rectOf = (e) => { const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), r: +r.right.toFixed(2), b: +r.bottom.toFixed(2) }; };
  const visible = (e) => { if (!e.getClientRects().length) return false; for (let p = e; p && p.id !== 'phone'; p = p.parentElement) { if (p.hidden) return false; const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden') return false; } return true; };
  const nameOf = (e) => (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') ? (document.getElementById(e.getAttribute('aria-labelledby')) || {}).textContent : '') || e.textContent || '').trim();
  window.C3 = {
    P, S, render, toConversation, toAnalysis, startCall, endCall, go, back,
    advance: (s) => { S.now += s; if (S.composer === 'rec') S.recSecs += s; render(); return S.now; },
    g32: () => { const tr = g32Truth(); return tr ? { state: tr.state, place: tr.place, call: tr.call, callId: tr.callId, conversation: tr.conversation, TM: tr.TM, replayMenu: tr.replayMenu, appearance: tr.appearance, shellDark: tr.analysisShellDark } : null; },
    g32Rect,
    frameDoc: () => (G32 && G32.contentDocument) || null,
    controls: () => [...document.querySelectorAll('#phone button, #phone [role="slider"]')].filter(visible).filter((e) => !e.closest('[inert]'))
      .map((e) => ({ id: e.id || e.dataset.nav || e.dataset.group || '', cls: e.className, name: nameOf(e), aria: e.getAttribute('aria-label'), iconOnly: !!e.querySelector('svg') && !e.textContent.trim(), ...rectOf(e) })),
    texts: () => [...document.querySelectorAll('#phone [data-k]')].filter(visible).map((e) => ({ k: e.dataset.k, text: e.textContent.trim(), ...rectOf(e), scrollW: e.scrollWidth, clientW: e.clientWidth, scrollH: e.scrollHeight, clientH: e.clientHeight })),
    names: () => [...document.querySelectorAll('#phone [data-ka]')].map((e) => ({ k: e.dataset.ka, name: e.getAttribute('aria-label') || e.textContent.trim() })),
    rectOf, visible,
  };
  boot();
})();
