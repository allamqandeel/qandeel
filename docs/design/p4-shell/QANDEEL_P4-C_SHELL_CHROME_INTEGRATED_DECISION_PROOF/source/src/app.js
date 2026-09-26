// P4-C — the proof's page runtime. ONE state object (S), rendered top → bottom (focus order = visual order). Every
// candidate comes from the one registry (window.P4DATA.decisions); the page draws only what the selected parameters
// ask for, so a check that reads the page reads exactly the candidate the board shows.
//
// Parameters (harness stand-ins; see P4C_READ_FIRST.md):
//   state   conv · shared · activity · settings · understanding · analysis · analysis-pinned · analysis-call ·
//           analysis-callpinned · analysis-cue
//   s=A|B   u=A|B   q=A|B|C   sw=plate|ground|seam   x=end|centre|top|none   dir=I|II (an integrated direction)
//   lang=en · appearance=light|system · contrast=more · w=&h= · ts=large · defect=<planted defect, validator only>
(function () {
  'use strict';
  const D = window.P4DATA, G = D.glyphs;
  const Q = new URLSearchParams(location.search);
  const mm = (q) => { try { return matchMedia(q).matches; } catch { return false; } };
  const dirKey = Q.get('dir');
  const direction = dirKey && D.directions[dirKey] ? D.directions[dirKey] : null;
  const pick = (k) => { const v = Q.get(k) || (direction ? direction[k] : null) || D.defaults[k]; return v; };
  const P = {
    lang: Q.get('lang') === 'en' ? 'en' : 'ar',
    appearance: (() => { const a = Q.get('appearance') || 'dark'; return a === 'system' ? (mm('(prefers-color-scheme: light)') ? 'light' : 'dark') : a; })(),
    contrast: Q.get('contrast') === 'more' || mm('(prefers-contrast: more)') ? 'more' : 'standard',
    w: +Q.get('w') || 390, h: +Q.get('h') || 844,
    capture: Q.get('capture') === '1',
    state: Q.get('state') || 'conv',
    defect: Q.get('defect') || '',
    ts: Q.get('ts') === 'large' ? 'large' : 'standard',
    s: pick('s'), u: pick('u'), q: pick('q'), sw: pick('sw'), x: pick('x'),
    dir: direction ? dirKey : null,
  };
  const L = D.copy[P.lang];
  const tx = (k) => L[k].text;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  // designing-arabic-frontends §4: Latin fragments inside an Arabic sentence are isolated only where they carry their own
  // direction marks; plain Latin words resolve correctly inside the paragraph (dir="auto" on the paragraph).
  const fmt = (s) => esc(s);

  // ------------------------------------------------------------------------------------------------ state
  const S = { place: 'conv', stack: [], focusAfter: null };
  const surfaceOf = () => (S.place === 'shared' ? 'shared' : S.place === 'conv' ? 'personal' : S.place);
  const personalRow = () => S.place === 'conv' && ((P.u === 'A' && P.defect !== 'understandinginsettings') || P.s === 'B');

  // ------------------------------------------------------------------------------------------------ pieces
  const statusBar = () => `<div class="status" aria-hidden="true"><span class="clock">9:41</span><span class="sys">` +
    `<svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5" width="3" height="6" rx="1" fill="currentColor"/><rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="11" rx="1" fill="currentColor"/></svg>` +
    `<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="8" rx="1.6" fill="currentColor"/><rect x="23.6" y="4" width="1.8" height="4" rx=".9" fill="currentColor" opacity=".45"/></svg></span></div>`;

  function actEntry() {
    // P3 §3 / §6: independent, icon-only, START edge, neutral, the attention mark = presence (never a count)
    const name = tx('activity') + (P.lang === 'ar' ? '، ' : ', ') + tx('activityNew');
    return `<button id="act-entry" class="ibtn pz" type="button" aria-label="${esc(name)}" data-entry="activity"${P.defect === 'focusorder' ? ' style="order:2"' : ''}>${G.ledger22}<span class="amark" aria-hidden="true"></span></button>`;
  }
  function setEntry(id = 'set-entry') {
    const small = P.defect === 'smalltarget' ? ' style="width:32px;height:32px"' : '';
    const name = P.defect === 'settingsname' ? '' : ` aria-label="${esc(tx('settings'))}"`;
    return `<button id="${id}" class="ibtn set-entry pz" type="button"${name}${small} data-entry="${P.defect === 'settingsroute' ? 'activity' : 'settings'}"${P.defect === 'focusorder' ? ' style="order:1"' : ''}>${G.settings22}</button>`;
  }
  function hiddenSettings() {
    // planted defect D-hiddensettings: the only way to Settings is behind a generic overflow whose menu is closed
    return `<button id="more-entry" class="ibtn pz" type="button" aria-label="${P.lang === 'ar' ? 'المزيد' : 'More'}" aria-haspopup="menu" aria-expanded="false">${G.more22}</button>` +
      `<div role="menu" hidden><button role="menuitem" type="button" data-entry="settings">${esc(tx('settings'))}</button></div>`;
  }
  const uEntryRow = () => `<button id="u-entry" class="hbtn uentry pz" type="button" data-entry="understanding"><span class="lb">${esc(tx('understanding'))}</span><span class="chev" aria-hidden="true">${G.chev16}</span></button>`;
  const uEntryChrome = () => `<button id="u-entry" class="hbtn ub pz" type="button" data-entry="understanding"><span class="lb">${esc(tx('understanding'))}</span></button>`;
  function chromeQ(surface) {
    const policy = D.qPolicy[P.q] || D.qPolicy.A;
    let show = !!policy[surface];
    if (P.defect === 'wrongq' && surface === 'personal') show = true;
    if (!show) return '';
    const g = P.defect === 'redrawnq' ? G.qEye20 : G.q20;
    return `<span class="qslot" id="chrome-q" data-q="${P.q}" aria-hidden="true">${g}</span>`;
  }

  function railHTML(sel, id = 'rail') {
    const items = L.nav.items.map((n) => ({ key: n.key, text: n.text, glyph: { mine: G.navMine, shared: G.navShared, public: G.navPublic }[n.key] }));
    if (P.defect === 'fourthtab') items.push({ key: 'settings', text: tx('settings'), glyph: G.settings22.replace('width="22" height="22"', 'width="24" height="24"') });
    const it = (n) => {
      const on = n.key === sel;
      let ic = `style="color:var(--brass)"`, lb = '';
      if (P.defect === 'brasssel') { ic = `style="color:${on ? 'var(--brass)' : 'var(--rest)'}"`; lb = ` style="color:${on ? 'var(--brass)' : 'var(--rest)'}"`; }
      if (P.defect === 'nosel') { lb = ` style="font-weight:var(--w-rest);color:${on ? 'var(--primary)' : 'var(--brass)'}"`; }
      const flip = P.defect === 'glyphbelow' ? ' style="flex-direction:column-reverse"' : '';
      const q = P.defect === 'qstatus' && on ? `<span class="qslot" id="rail-q" aria-hidden="true" style="top:auto;bottom:-4px;transform:translateX(-50%)">${G.q8}</span>` : '';
      if (P.defect === 'mirrornav') ic = ic.replace('style="', 'style="transform:scaleX(-1);');
      return `<button class="it pz${on && P.defect !== 'nosel' ? ' sel' : ''}" type="button" data-nav="${n.key}"${on ? ' aria-current="page"' : ''}${flip}>` +
        `<span class="ic"${P.defect === 'navname' ? '' : ' aria-hidden="true"'} ${ic}>${n.glyph}</span><span class="lb"${lb}>${esc(n.text)}</span>${q}</button>`;
    };
    return `<nav id="${id}" class="rail" data-form="${P.sw}" aria-label="${esc(L.nav.label.text)}"><div class="items">${items.map(it).join('')}</div></nav>`;
  }

  const turn = (t) => {
    if (t.day) return `<p class="day r-meta">${esc(t.day)}</p>`;
    const text = t.text.split('{display_name}').join(tx('displayName'));
    const sr = `<span class="sr">${t.who === 'me' ? (P.lang === 'ar' ? 'كلامك' : 'You') : t.who === 'q' ? (P.lang === 'ar' ? 'قنديل' : 'QANDEEL') : esc(t.name)}: </span>`;
    // G3.2 draws the canonical Q beside QANDEEL's opening turn (its own composition, not a P4-C variable)
    const q = t.opener ? `<span class="qm" aria-hidden="true">${P.defect === 'redrawnq' ? G.qEye20 : G.q18}</span>` : '';
    return `<div class="t ${t.who === 'me' ? 'me' : 'q'}${t.opener ? ' opener' : ''}">${q}${t.name ? `<span class="who r-meta" aria-hidden="true">${esc(t.name)}</span>` : ''}${sr}<p class="r-body" dir="auto">${fmt(text)}</p></div>`;
  };
  const composer = () => `<div class="composer"><div class="write"><span class="ph r-body">${esc(tx('composer'))}</span><div class="line"></div></div>` +
    `<button class="cbtn pz slot-i" type="button" aria-label="${esc(tx('voiceCall'))}">${G.call24}</button><button class="cbtn pz slot-o" type="button" aria-label="${esc(tx('voiceNote'))}">${G.mic24}</button></div>`;

  function hostHTML() {
    const personal = S.place === 'conv';
    // ---- the upper chrome: START utility group, (Q), END contextual group
    let start = P.defect === 'activityend' ? '' : actEntry();
    if (P.defect === 'hiddensettings') start += hiddenSettings();
    else if (P.s === 'A' || (P.defect === 'dupsettings' && personal)) start += setEntry();
    let end = '';
    if (personal) {
      end = (P.u === 'B' && P.defect !== 'understandinginsettings' ? uEntryChrome() : '') +
        `<button id="door" class="hbtn pz" type="button" data-entry="analysis">${G.depth22}<span class="lb">${esc(P.defect === 'doorcopy' ? (P.lang === 'ar' ? 'تحليل الكلام' : 'Analyse this') : tx('door'))}</span></button>` +
        `<button id="replay" class="ibtn pz" type="button" aria-label="${esc(tx('replay'))}">${G.replay22}</button>`;
    }
    const hdr = `<div class="hdr" id="hdr"><div class="grp" id="grp-start" style="display:flex;gap:2px">${start}</div>` +
      `<div class="grp push-end" id="grp-end" style="display:flex;gap:2px">${end}${P.defect === 'activityend' ? actEntry() : ''}</div>${chromeQ(personal ? 'personal' : 'shared')}</div>`;
    // ---- the Personal row (U-A and / or S-B) on Personal QANDEEL only
    let row = '';
    if (personal && personalRow()) {
      const u = P.u === 'A' && P.defect !== 'understandinginsettings' ? uEntryRow() : '';
      const sb = P.s === 'B' && P.defect !== 'hiddensettings' ? `<span class="push-end"></span>${setEntry(P.defect === 'dupsettings' ? 'set-entry-2' : 'set-entry')}` : '';
      row = `<div class="prow" id="prow">${u}${sb}</div>`;
    }
    const phone = document.getElementById('phone');
    phone.style.setProperty('--prow', row ? '44px' : '0px');
    let content;
    if (personal) content = `<section class="conv" aria-label="${P.lang === 'ar' ? 'المحادثة' : 'Conversation'}"><div class="thread">${D.thread[P.lang].map(turn).join('')}</div></section>`;
    else content = `<div class="world-name"><h1 class="r-title" tabindex="-1">${esc(tx('worldName'))}</h1></div>` +
      `<section class="conv" style="top:calc(var(--top) + var(--hdr) + 52px)" aria-label="${esc(tx('worldName'))}"><div class="thread">${D.sharedThread[P.lang].map(turn).join('')}</div></section>`;
    return statusBar() + hdr + row + content + composer() + railHTML(personal ? 'mine' : 'shared');
  }

  const pageHdr = (title, extra = '') => `${statusBar()}<div class="hdr"><button class="ibtn pz" type="button" data-back aria-label="${esc(tx('backPage'))}">${G.back22}</button>` +
    `<h1 class="r-head" tabindex="-1">${esc(title)}</h1>${extra}</div>`;
  function activityHTML() {
    const chips = L.filters.map((f, i) => `<button class="fchip pz${i === 0 ? ' on' : ''}" type="button" aria-pressed="${i === 0}"><span class="lb">${esc(f.text)}</span></button>`).join('');
    const glyphFor = (c) => ({ shared: G.navShared20, qandeel: G.navMine20, system: G.settings20 }[c]);
    const rows = D.feed.map((r) => `<li class="row"><span class="gl" aria-hidden="true">${glyphFor(r.cat)}<span class="amark${r.mark === 'waiting' ? ' ring' : ''}"></span></span>` +
      `<span class="ln1 r-meta"><span>${esc(r.src[P.lang])}</span><span class="tm num">${r.time}</span></span><span class="say r-support" dir="auto">${esc(r.text[P.lang])}</span></li>`).join('');
    return `<section class="page act" aria-labelledby="pg-title">${pageHdr(tx('activity'), `<button class="ibtn pz push-end" type="button" data-entry="settings" data-section="notif" aria-label="${esc(tx('activitySettings'))}">${G.settings22}</button>`).replace('<h1 ', '<h1 id="pg-title" ')}` +
      `<div class="body"><div class="filters" role="group">${chips}</div><h2 class="sec r-meta">${esc(tx('today'))}</h2><ul class="feed">${rows}</ul></div></section>`;
  }
  function settingsHTML() {
    const groups = L.groups.map((g, i) => `<button class="srow pz${S.section === 'notif' && i === 3 ? ' here' : ''}" type="button"><span class="lb r-support">${esc(g.text)}</span><span class="chev" aria-hidden="true">${G.chev16}</span></button>`);
    // planted defect D-understandinginsettings: Understanding demoted to a Settings group
    if (P.defect === 'understandinginsettings') groups.splice(3, 0, `<button id="u-entry" class="srow pz" type="button" data-entry="understanding"><span class="lb r-support">${esc(tx('understanding'))}</span><span class="chev" aria-hidden="true">${G.chev16}</span></button>`);
    return `<section class="page set" aria-labelledby="pg-title">${pageHdr(tx('settings')).replace('<h1 ', '<h1 id="pg-title" ')}<div class="body">${groups.join('')}</div></section>`;
  }
  function understandingHTML() {
    return `<section class="page" aria-labelledby="pg-title">${pageHdr(tx('understanding')).replace('<h1 ', '<h1 id="pg-title" ')}` +
      `<div class="body"><div class="handoff r-support" role="note"><span class="tag">P4-C HARNESS · SURFACE NOT DESIGNED · P4-DQ-07</span>${esc(tx('understandingNote'))}</div></div></section>`;
  }

  // ------------------------------------------------------------------------------------ the Analysis (G3.2, frozen)
  // Never redrawn: G3.2's own reviewed prototype runs in a frame the size of the phone. P4-C adds NOTHING to its chrome
  // except the candidate under study: the switcher form in the rail's own measured box, and «سياق الكلام». No Activity,
  // Settings, Understanding or Q entry is laid over the Analysis (P3 §3; G3 composition).
  const G3STATE = { analysis: 'P1', 'analysis-pinned': 'P4', 'analysis-call': 'CALL_ANALYSIS', 'analysis-callpinned': 'CALL_PINNED', 'analysis-cue': 'M1_CUE' };
  let G32 = null, g32Ready = null;
  function g32Frame() {
    if (G32) return g32Ready;
    const st = G3STATE[S.aState] || 'P1';
    const q = new URLSearchParams({ capture: '1', state: st, lang: P.lang, w: String(P.w), h: String(P.h), appearance: P.appearance });
    G32 = Object.assign(document.createElement('iframe'), { id: 'g32', title: tx('door') + ' — G3.2' });
    G32.dataset.state = st;
    G32.src = 'g3.2/index.html?' + q.toString();
    document.getElementById('g32host').appendChild(G32);
    g32Ready = new Promise((res) => G32.addEventListener('load', () => {
      const d = G32.contentDocument;
      // «المحادثة» leaves the Analysis for P4-C's Conversation: one step, exactly as G3.2 means it
      if (d) d.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#back')) { e.preventDefault(); e.stopPropagation(); back(); } }, true);
      const w = G32.contentWindow, api = w && w.__G32;
      Promise.resolve(api && api.ready).then(() => { if (api) { api.clock(0); api.enter(st); } })
        .then(() => new Promise((r) => w.requestAnimationFrame(() => w.requestAnimationFrame(() => setTimeout(r, 250))))).then(res);
    }, { once: true }));
    return g32Ready;
  }
  const g32Rect = (id) => { const d = G32 && G32.contentDocument, e = d && d.getElementById(id); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); if (!r.width || !r.height) return null; return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const g32Truth = () => { const w = G32 && G32.contentWindow; return w && w.__G32 ? w.__G32.truth() : null; };

  /** Where «سياق الكلام» stands, per candidate — measured from G3.2's own elements, never assumed. */
  function ctxBox(which, width) {
    const back = g32Rect('back'), rep = g32Rect('replay');
    if (!back) return null;
    const rtl = P.lang === 'ar', h = 44, y = Math.round(back.y + (back.h - h) / 2);
    if (which === 'overlap' && rep) return { x: Math.round(rep.x), y: Math.round(rep.y), w: width, h };
    if (which === 'end' && rep) return rtl ? { x: Math.round(rep.r + 2), y, w: width, h } : { x: Math.round(rep.x - 2 - width), y, w: width, h };
    // X-B gets its best case: centred in the FREE span between «المحادثة» and Replay (the physical centre can collide
    // with «المحادثة» at 320 pt in English); if the span is too narrow, the collision is measured, never hidden
    if (which === 'centre' && rep) { const a = rtl ? rep.r : back.r, b = rtl ? back.x : rep.x; return { x: Math.round((a + b - width) / 2), y, w: width, h }; }
    if (which === 'centre') return { x: Math.round((P.w - width) / 2), y, w: width, h };
    if (which === 'top') { const y2 = Math.round(back.b + 4); return rtl ? { x: Math.round(P.w - 10 - width), y: y2, w: width, h } : { x: 10, y: y2, w: width, h }; }
    return null;
  }
  function analysisOverlay() {
    const host = document.getElementById('aover'); if (!host) return;
    let html = '';
    // the switcher candidate, in G3.2's own rail box, dark scope
    // G3.2's rail box, united with its own selected marker (G3.2 draws the marker as a sibling that can stand at the box's
    // edge): the candidate replaces the whole switcher, so no pre-P2 marker may show through.
    let rb = g32Rect('rail'); const mk = g32Rect('marker');
    if (rb && mk) { const y = Math.min(rb.y, mk.y) - 1, b = Math.max(rb.b, mk.b); rb = { ...rb, y, b, h: b - y }; }
    // sw=g32 leaves G3.2's own (pre-P2) rail untouched: the authority baseline only
    if (rb && P.sw !== 'g32') html += `<div id="arail" style="left:${rb.x}px;top:${rb.y}px;width:${rb.w}px;height:${rb.h}px">${railHTML('mine', 'rail-a')}<div class="homebar" aria-hidden="true"></div></div>`;
    // planted defect D-activityinanalysis: the Activity entry pushed into the Analysis chrome
    if (P.defect === 'activityinanalysis') { const b = g32Rect('back'); if (b) html += `<div style="position:absolute;left:${Math.round(P.w / 2 - 22)}px;top:${Math.round(b.y + (b.h - 44) / 2)}px">${actEntry()}</div>`; }
    host.innerHTML = html;
    // the candidate replaces G3.2's (pre-P2) switcher in its own box: G3.2's rail must not stay reachable underneath as a second,
    // invisible navigation landmark. Runtime inert only — no G3.2 byte is changed.
    { const d = G32 && G32.contentDocument; if (d) for (const id of ['rail', 'marker']) { const e = d.getElementById(id); if (e) { if (P.sw !== 'g32') e.setAttribute('inert', ''); else e.removeAttribute('inert'); } } }
    const place = (which, id) => {
      const el = document.createElement('button');
      el.className = 'ctx pz'; el.type = 'button'; el.id = id; el.dataset.x = which;
      el.innerHTML = `<span class="lb">${esc(tx('liveContext'))}</span>`;
      el.style.visibility = 'hidden'; host.appendChild(el);
      const w = Math.ceil(el.getBoundingClientRect().width);
      const b = ctxBox(which, w); if (!b) { el.remove(); return; }
      Object.assign(el.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px', visibility: '' });
    };
    if (P.defect === 'ctxoverlap') place('overlap', 'ctx');
    else if (P.x !== 'none') place(P.x, 'ctx');
    if (P.defect === 'ctxdup') place(P.x === 'centre' ? 'end' : 'centre', 'ctx-2');
  }

  // ------------------------------------------------------------------------------------------------ navigation
  function go(place, extra = {}) {
    if (place !== S.place) S.stack.push({ place: S.place });
    S.place = place; Object.assign(S, extra);
    S.focusAfter = ['activity', 'settings', 'understanding'].includes(place) ? 'h1' : null;
    render();
  }
  function switchTo(place) { S.place = place; S.stack = []; render(); }   // switching ≠ pushing (I-08A4 §4)
  function back() { const p = S.stack.pop() || { place: 'conv' }; S.place = p.place; render(); }

  function render() {
    const inA = S.place === 'analysis';
    const view = S.place === 'activity' ? activityHTML() : S.place === 'settings' ? settingsHTML() : S.place === 'understanding' ? understandingHTML() : inA ? '' : hostHTML();
    const phone = document.getElementById('phone'), ui = document.getElementById('ui');
    document.getElementById('g32host').hidden = !inA;
    document.getElementById('aover').hidden = !inA;
    ui.innerHTML = `<span class="fprobe" aria-hidden="true"><span style="font-weight:400">ا</span><span style="font-weight:500">ا</span><span style="font-weight:600">ا</span></span>` +
      `<div id="view">${view}</div>${inA ? '' : '<div class="homebar" aria-hidden="true"></div>'}`;
    phone.dataset.place = S.place; phone.dataset.surface = surfaceOf();
    // G3 §C.1 / P1 §12: the Analysis is one dark place under every preference; everything else follows the preference
    phone.dataset.appearance = inA && P.defect !== 'lightanalysis' ? 'dark' : P.appearance;
    if (inA && G32 && G32.contentDocument && G32.contentWindow.__G32) analysisOverlay();
    placeChromeQ();
    if (Q.get('scroll') === 'top') { const t = phone.querySelector('.conv .thread'); if (t) { t.style.bottom = 'auto'; t.style.top = '0'; } }
    if (S.focusAfter) { const f = phone.querySelector(S.focusAfter); if (f) f.focus({ preventScroll: true }); S.focusAfter = null; }
    harness();
  }
  /** Q-B / Q-C get their best case: the Q stands at the centre of the FREE span between the START and END groups (not the
   *  physical centre, which the door group can occupy). If the span is narrower than the Q plus 8 pt a side, the Q
   *  still stands there and the collision is measured and reported, never hidden. */
  function placeChromeQ() {
    const q = document.getElementById('chrome-q'), hdr = document.getElementById('hdr'); if (!q || !hdr) return;
    const h = hdr.getBoundingClientRect(), s = document.getElementById('grp-start').getBoundingClientRect(), e = document.getElementById('grp-end');
    const er = e && e.children.length ? e.getBoundingClientRect() : null;
    const rtl = P.lang === 'ar';
    const a = rtl ? (er ? er.right : h.left + 10) : s.right, b = rtl ? s.left : (er ? er.left : h.right - 10);
    q.style.left = ((a + b) / 2 - h.left) + 'px';
  }

  // ------------------------------------------------------------------------------------------------ input
  function onClick(e) {
    const b = e.target.closest('button'); if (!b || !document.getElementById('phone').contains(b)) return;
    if (b.matches('[data-back]')) return back();
    if (b.dataset.nav) { if (b.dataset.nav === 'mine') return switchTo('conv'); if (b.dataset.nav === 'shared') return switchTo('shared'); return; }
    const en = b.dataset.entry;
    if (en === 'analysis') { S.aState = 'analysis'; go('analysis'); g32Frame().then(render); return; }
    if (en === 'activity') return go('activity');
    if (en === 'settings') return go('settings', { section: b.dataset.section || null });
    if (en === 'understanding') return go('understanding');
  }
  const down = (e) => { const b = e.target.closest('.pz'); if (b) { b.classList.add('down'); S.held = b; } };
  const up = () => { if (S.held) { S.held.classList.remove('down'); S.held = null; } };

  // ------------------------------------------------------------------------------------------------ harness
  function harness() {
    const h = document.getElementById('harness'); if (!h) return;
    const link = (patch, label, on) => { const q = new URLSearchParams(location.search); for (const [k, v] of Object.entries(patch)) { if (v === null) q.delete(k); else q.set(k, v); } q.delete('capture'); return `<a href="?${q}" class="${on ? 'on' : ''}">${label}</a>`; };
    const states = ['conv', 'shared', 'activity', 'settings', 'understanding', 'analysis', 'analysis-pinned', 'analysis-call', 'analysis-callpinned', 'analysis-cue'];
    const dec = (k, key) => Object.entries(D.decisions[k].options).map(([o, v]) => link({ [key]: o, dir: null }, `${v.short} ${v.name}`, P[key] === o)).join('');
    h.innerHTML = `<span class="flag">PROOF HARNESS — NOT PRODUCT UI</span><h1>P4-C shell / small-chrome decision proof</h1>` +
      `<p>Every option is a ${D.labels.candidate}. P4-DQ-01 … P4-DQ-04 remain OPEN.</p>` +
      `<h2>States</h2>${states.map((s) => link({ state: s }, s, P.state === s)).join('')}` +
      `<h2>Integrated directions (${D.labels.integrated})</h2>${Object.entries(D.directions).map(([k, v]) => link({ dir: k, s: null, u: null, q: null, sw: null, x: null }, v.name, P.dir === k)).join('')}` +
      `<h2>DQ-01 Settings</h2>${dec('settings', 's')}<h2>DQ-02 Understanding</h2>${dec('understanding', 'u')}<h2>DQ-03 Q</h2>${dec('q', 'q')}` +
      `<h2>DQ-04A Switcher</h2>${dec('switcher', 'sw')}<h2>DQ-04B «سياق الكلام»</h2>${dec('context', 'x')}` +
      `<h2>Device stand-ins</h2>${link({ lang: P.lang === 'en' ? null : 'en' }, 'English', P.lang === 'en')}${link({ appearance: P.appearance === 'light' ? null : 'light' }, 'Light', P.appearance === 'light')}` +
      `${link({ contrast: P.contrast === 'more' ? null : 'more' }, 'Increased contrast', P.contrast === 'more')}${link({ w: P.w === 320 ? null : '320', h: P.w === 320 ? null : '568' }, '320 × 568', P.w === 320)}${link({ w: P.w === 430 ? null : '430', h: P.w === 430 ? null : '932' }, '430 × 932', P.w === 430)}${link({ ts: P.ts === 'large' ? null : 'large' }, 'Large text (browser stand-in)', P.ts === 'large')}`;
  }

  // ------------------------------------------------------------------------------------------------ boot
  function boot() {
    const mount = document.getElementById('mount');
    mount.innerHTML = `<div id="phone" dir="${P.defect === 'wrongdir' ? (L.dir === 'rtl' ? 'ltr' : 'rtl') : L.dir}" lang="${L.lang}" data-appearance="${P.appearance}" data-contrast="${P.contrast}" data-lang="${P.lang}" data-textsize="${P.ts}"` +
      ` data-s="${P.s}" data-u="${P.u}" data-q="${P.q}" data-sw="${P.sw}" data-x="${P.x}" data-dir="${P.dir || ''}" data-defect="${esc(P.defect)}" style="--W:${P.w}px;--H:${P.h}px">` +
      `<div id="g32host" hidden></div><div id="aover" hidden></div><div id="ui"></div></div>` + (P.capture ? '' : '<aside id="harness" class="harness"></aside>');
    if (!P.capture) document.body.classList.add('live');
    document.documentElement.lang = L.lang;
    const phone = document.getElementById('phone');
    phone.addEventListener('click', onClick); phone.addEventListener('pointerdown', down); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    const st = P.state;
    if (st === 'shared') S.place = 'shared';
    else if (['activity', 'settings', 'understanding'].includes(st)) { S.stack = [{ place: 'conv' }]; S.place = st; if (st === 'settings' && Q.get('section')) S.section = Q.get('section'); }
    else if (G3STATE[st]) { S.place = 'analysis'; S.aState = st; S.stack = [{ place: 'conv' }]; g32Frame(); }
    render();
    const pr = Q.get('press'); if (pr) { const e = document.querySelector(pr); if (e) e.classList.add('down'); }
    Promise.all([document.fonts.ready, S.place === 'analysis' ? g32Ready : null]).then(() => {
      render();
      if (pr) { const e = document.querySelector(pr); if (e) e.classList.add('down'); }
      phone.setAttribute('data-ready', '1');
    });
  }

  // ------------------------------------------------------------------------------------------------ measurement API
  const rectOf = (e) => { const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), r: +r.right.toFixed(2), b: +r.bottom.toFixed(2) }; };
  const visible = (e) => { if (!e.getClientRects().length) return false; for (let p = e; p && p.id !== 'phone'; p = p.parentElement) { if (p.hidden) return false; const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden') return false; } return true; };
  const nameOf = (e) => (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') ? (document.getElementById(e.getAttribute('aria-labelledby')) || {}).textContent : '') || e.textContent || '').trim();
  window.P4 = {
    P, S, render, go, back, switchTo,
    controls: () => [...document.querySelectorAll('#phone button, #phone [tabindex]:not([tabindex="-1"])')].filter(visible).map((e) => ({
      id: e.id, entry: e.dataset.entry || '', nav: e.dataset.nav || '', name: nameOf(e), aria: e.getAttribute('aria-label'), iconOnly: !![...e.querySelectorAll('svg')].length && !e.querySelector('.lb') && !e.textContent.trim(),
      ...rectOf(e), inRail: !!e.closest('.rail'), inAnalysis: !!e.closest('#aover'), inHdr: !!e.closest('.hdr'), inRow: !!e.closest('#prow') })),
    rail: (sel = '#phone .rail') => { const n = document.querySelector(sel); if (!n) return null; const cs = (e, p) => (e ? getComputedStyle(e, p) : null);
      return { form: n.dataset.form, box: rectOf(n), bg: getComputedStyle(n).backgroundColor, items: [...n.querySelectorAll('.it')].map((it) => {
        const ic = it.querySelector('.ic'), lb = it.querySelector('.lb'), svg = ic && ic.querySelector('svg');
        const after = cs(it, '::after'), lbAfter = cs(lb, '::after');
        const marker = [after, lbAfter].find((s) => s && s.content !== 'none' && parseFloat(s.height) > 0);
        return { key: it.dataset.nav, text: lb ? lb.textContent : '', selected: it.getAttribute('aria-current') === 'page', glyphColor: svg ? getComputedStyle(svg).color : null, glyphHidden: ic ? ic.getAttribute('aria-hidden') === 'true' : false,
          labelColor: lb ? getComputedStyle(lb).color : null, weight: lb ? +getComputedStyle(lb).fontWeight : null, glyph: svg ? rectOf(svg) : null, label: lb ? rectOf(lb) : null, box: rectOf(it),
          marker: marker ? { h: parseFloat(marker.height), color: marker.backgroundColor } : null, name: nameOf(it), qInside: !!it.querySelector('.qslot, .qmark, .qm') };
      }) }; },
    qs: () => [...document.querySelectorAll('#phone svg.qmark, #phone svg.qm')].filter(visible).map((s) => ({ where: s.closest('#chrome-q') ? 'chrome' : s.closest('.opener') ? 'opener' : s.closest('.rail') ? 'rail' : 'other',
      paths: [...s.querySelectorAll('path')].map((p) => p.getAttribute('d')), viewBox: s.getAttribute('viewBox'), color: getComputedStyle(s).color, inButton: !!s.closest('button'), hidden: !!s.closest('[aria-hidden="true"]'), mirrored: getComputedStyle(s).transform !== 'none', ...rectOf(s) })),
    hdr: () => { const h = document.querySelector('#phone .hdr'); if (!h) return null; const kids = [...h.querySelectorAll('button')].filter(visible).map((e) => ({ id: e.id || e.dataset.entry || '', ...rectOf(e) }));
      const s = document.getElementById('grp-start'), en = document.getElementById('grp-end'); const rs = s && s.children.length ? rectOf(s) : null, re = en && en.children.length ? rectOf(en) : null; const q = document.getElementById('chrome-q');
      return { box: rectOf(h), kids, start: rs, end: re, q: q ? rectOf(q) : null, scrollW: h.scrollWidth, clientW: h.clientWidth }; },
    prow: () => { const r = document.getElementById('prow'); return r ? rectOf(r) : null; },
    conv: () => { const c = document.querySelector('#phone .conv'); return c ? rectOf(c) : null; },
    vars: () => { const cs = getComputedStyle(document.getElementById('phone')); return Object.fromEntries(['--brass', '--mark', '--rest', '--marker', '--primary', '--world', '--surface', '--tertiary'].map((k) => [k, cs.getPropertyValue(k).trim()])); },
    ctx: () => [...document.querySelectorAll('#aover .ctx')].filter(visible).map((e) => ({ id: e.id, place: e.dataset.x, text: e.textContent.trim(), name: nameOf(e), ...rectOf(e) })),
    g32: () => {
      if (!G32) return null; const t = g32Truth() || {};
      const ids = ['back', 'replay', 'tl-ctx', 'tl-track', 'tl-live', 'band', 'composer', 'rail', 'cue', 'hdr'];
      const rects = Object.fromEntries(ids.map((i) => [i, g32Rect(i)]));
      return { state: G32.dataset.state, place: t.place, call: t.call, TM: t.TM, room: t.room, appearance: t.appearance, shellDark: t.analysisShellDark, rects, controls: t.controls,
        text: G32.contentDocument ? G32.contentDocument.body.innerText : '' };
    },
    analysisEntries: () => [...document.querySelectorAll('#aover [data-entry]')].filter(visible).map((e) => e.dataset.entry),
    order: () => [...document.querySelectorAll('#phone button')].filter(visible).map((e) => ({ id: e.id || e.dataset.entry || e.dataset.nav || e.className, ...rectOf(e) })),
  };
  boot();
})();
