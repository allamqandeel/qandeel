// P4-C — the review boards. Each board is a self-contained HTML sheet rendered to PNG (lib/sheet.mjs). Phones are the
// Product captures (tools/shots.mjs, 2×) shown unaltered; every label, crop and measurement sits OUTSIDE the phones.
// Every comparison board states: what is frozen · what varies · what to judge · what authority rejects vs what is
// merely weaker. Output: boards/*.png, data/BOARDS.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { WORK, PKG, SOURCE } from './lib/session.mjs';
import { renderSheet, closeSheetBrowser } from './lib/sheet.mjs';
import { sigSvg } from '../src/sig.mjs';
import { qSvg } from '../src/qmark.mjs';
import { palette } from '../src/tokens.mjs';
import { DECISIONS, DIRECTIONS, LABEL_CANDIDATE, LABEL_INTEGRATED } from '../src/candidates.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const SH = Object.fromEntries(JSON.parse(readFileSync(join(PKG, 'data', 'SHOTS.json'), 'utf8')).shots.map((s) => [s.id, s]));
const CH = JSON.parse(readFileSync(join(PKG, 'data', 'CHECKS.json'), 'utf8'));
const MX = JSON.parse(readFileSync(join(PKG, 'data', 'DECISION_MATRIX.json'), 'utf8'));
const FONT = readFileSync(join(SOURCE, 'vendor', 'fonts', 'Estedad-wght-v8.5.woff2')).toString('base64');
const DARK = palette('dark').colors;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const img = (id) => pathToFileURL(join(WORK, 'shots', id + '.png')).href;
const K = 0.6;   // every phone on every board at the same scale, so 320 and 390 compare truthfully

const css = `@font-face{font-family:Estedad;src:url(data:font/woff2;base64,${FONT}) format('woff2');font-weight:100 900}
*{box-sizing:border-box;margin:0;padding:0}html{background:#0d0d0d}
body{font-family:Estedad,system-ui,sans-serif;color:#d8d5ca;padding:44px 50px 36px;letter-spacing:0}
.board{width:1800px}
h1{font-size:30px;line-height:1.35;font-weight:600;color:#eeebe2}h1 .n{color:#8b8982;font-weight:500}
.q{font-size:17px;line-height:1.6;color:#afaca3;max-width:1500px;margin-top:8px}
.frame{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:22px 0 26px}
.frame div{background:#151515;border-radius:12px;padding:12px 14px;font-size:13.5px;line-height:1.55;color:#c6c3b9}
.frame b{display:block;font-size:11px;letter-spacing:.06em;color:#8b8982;margin-bottom:5px;font-weight:600}
.row{display:flex;gap:18px;align-items:flex-start;margin:0 0 22px}
.rlab{width:190px;flex:none;font-size:14px;line-height:1.5;color:#d8d5ca;padding-top:4px}
.rlab .sub{display:block;font-size:12.5px;color:#8b8982;margin-top:4px}
figure{flex:none}
figure img{display:block;border-radius:22px;box-shadow:0 0 0 1px #2a2a2a}
figcaption{font-size:12px;line-height:1.45;color:#afaca3;margin-top:7px;max-width:240px}
figcaption code,.mono{font:11px/1.4 ui-monospace,Consolas,monospace;color:#77756f}
.chip{display:inline-block;font:700 10px/1 system-ui,sans-serif;letter-spacing:.05em;border-radius:4px;padding:4px 6px;margin:0 0 6px}
.chip.c{background:#2a2720;color:#e0cfa8}.chip.r{background:#3a1f1c;color:#f0a597}.chip.f{background:#1e2a22;color:#a6d4b3}.chip.i{background:#e0b650;color:#141414}.chip.p{background:#20242c;color:#a9bbd8}
.panel{background:#151515;border-radius:14px;padding:16px 18px;font-size:13.5px;line-height:1.6;color:#c6c3b9}
.panel h3{font-size:14.5px;color:#eeebe2;margin-bottom:6px;font-weight:600}
.panel ul{padding-inline-start:18px}.panel li{margin:3px 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.crop{overflow:hidden;border-radius:10px;box-shadow:0 0 0 1px #2a2a2a;position:relative}
.crop img{position:absolute;display:block;border-radius:0;box-shadow:none}
.m{display:inline-block;background:#1b1b1b;border-radius:6px;padding:2px 7px;margin:2px 4px 2px 0;font-size:12px;color:#d8d5ca}
.m.bad{background:#3a1f1c;color:#f5b3a6}.m.ok{background:#1e2a22;color:#b3dcbf}
.foot{margin-top:28px;font:11px/1.5 ui-monospace,Consolas,monospace;color:#6f6d66}
.sec{font-size:13px;letter-spacing:.04em;color:#8b8982;margin:6px 0 12px;font-weight:600}
.card{background:#151515;border-radius:16px;padding:18px 20px}
.card h2{font-size:19px;color:#eeebe2;margin-bottom:4px}
.rec{background:#1a1813;border-radius:10px;padding:10px 12px;margin-top:10px;font-size:13.5px;line-height:1.55}
.ask{border-inline-start:3px solid #e0b650;padding:6px 0 6px 12px;margin-top:10px;font-size:14px;line-height:1.55;color:#eeebe2}
.tri{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.tag{font-size:11.5px;border-radius:5px;padding:2px 6px;background:#1e1e1e}
.tag.S{color:#b3dcbf}.tag.A{color:#d8d5ca}.tag.C{color:#f0cf8a}.tag.F{color:#f5a597;background:#2e1916}
`;
const chip = (k) => ({ c: `<span class="chip c">${LABEL_CANDIDATE}</span>`, r: '<span class="chip r">REJECTED BY AUTHORITY</span>', f: '<span class="chip f">FROZEN UPSTREAM — BASELINE</span>', i: `<span class="chip i">${LABEL_INTEGRATED}</span>`, p: '<span class="chip p">PROOF COPY — NOT CANONICAL</span>', d: '<span class="chip r">PLANTED DEFECT — VALIDATOR ONLY</span>' }[k] || '');
function phone(id, cap, { k = K, tag = 'c' } = {}) {
  const s = SH[id]; if (!s) throw new Error('board wants unknown shot ' + id);
  return `<figure style="width:${Math.max(Math.round(s.w * k), 150)}px">${tag ? chip(tag) : ''}<img src="${img(id)}" style="width:${Math.round(s.w * k)}px;height:${Math.round(s.h * k)}px" alt=""><figcaption>${cap}<br><code>${id} · ${s.w}×${s.h} · ${s.lang.toUpperCase()} · ${s.state.startsWith('analysis') ? 'Analysis (dark)' : s.appearance}${s.contrast ? ' · Increased Contrast' : ''}</code></figcaption></figure>`;
}
/** A zoomed region of a capture, in phone points (the capture is 2×). */
function crop(id, { x = 0, y = 0, w, h, z = 1.5, cap = '' }) {
  const s = SH[id];
  return `<figure><div class="crop" style="width:${Math.round(w * z)}px;height:${Math.round(h * z)}px"><img src="${img(id)}" style="width:${Math.round(s.w * z)}px;height:${Math.round(s.h * z)}px;left:${-Math.round(x * z)}px;top:${-Math.round(y * z)}px" alt=""></div><figcaption>${cap}<br><code>${id}</code></figcaption></figure>`;
}
const frame = (fz, va, ju, rj) => `<div class="frame"><div><b>FROZEN — NOT UNDER STUDY</b>${fz}</div><div><b>WHAT VARIES</b>${va}</div><div><b>WHAT TO JUDGE</b>${ju}</div><div><b>REJECTED BY AUTHORITY vs MERELY WEAKER</b>${rj}</div></div>`;
const row = (label, sub, items) => `<div class="row"><div class="rlab">${label}${sub ? `<span class="sub">${sub}</span>` : ''}</div>${items.join('')}</div>`;
const page = (n, title, q, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="board">` +
  `<h1><span class="n">Board ${n} — </span>${title}</h1><p class="q">${q}</p>${body}` +
  `<p class="foot">QANDEEL · P4-C shell / placement / small-chrome integrated visual decision proof · P4-DQ-01 … P4-DQ-04 remain OPEN · no candidate selected or frozen · P4 ACTIVE, NOT CLOSED · phones are Product captures at 2× (no harness); every diagnostic is outside them · checks ${CH.summary.normal} · ${CH.summary.planted}</p></div></body></html>`;
const M = (label, v, bad = false, ok = false) => `<span class="m${bad ? ' bad' : ok ? ' ok' : ''}">${label}: ${v}</span>`;
const cand = (dq, id) => MX.decisions.find((d) => d.dq === dq).candidates.find((c) => c.id === id);
const ratings = (c) => `<div class="tri">${Object.entries(c.dimensions).map(([k, v]) => `<span class="tag ${v === 'STRONG' ? 'S' : v === 'ACCEPTABLE' ? 'A' : v === 'CONCERN' ? 'C' : 'F'}">${esc(k)} · ${v}</span>`).join('')}</div>`;
const H = (id) => SH[id].measured.hdr;
const gapOf = (id) => { const m = SH[id].measured, h = m.hdr, rtl = m.phone.dir === 'rtl'; if (h.scrollW > h.clientW + 0.5) return -Math.round(h.scrollW - h.clientW); const edge = rtl ? (h.end ? h.end.r : 10) : (h.end ? h.end.x : SH[id].w - 10); return Math.round((rtl ? h.start.x - edge : edge - h.start.r) * 10) / 10; };

const ovf = (id) => { const h = H(id), d = h.scrollW - h.clientW; return d > 0.5 ? `+${Math.round(d)} pt` : 'none'; };
const B = {};
// ---------------------------------------------------------------------------------------------------------- 01
{
  const navFam = ['navMine', 'navShared', 'navPublic'].map((n) => `<span style="color:${DARK.brass};display:inline-block;margin-inline-end:18px">${sigSvg(n, { size: 48 })}</span>`).join('');
  const laws = [
    ['I-08A4 §3, §4, §7, §19', 'Personal-centred shell; three World destinations; switching ≠ pushing; Back is local-only; Settings = a secondary Global Shell utility, never a primary Area'],
    ['G1.2 §3', 'the stable Product-area name «العالم المشترك» / Shared World, singular'],
    ['P1 §7, §8, §10, §11, §12', 'no Profile page; exactly one General Settings destination; «فهم قنديل» / QANDEEL Understanding is a Personal depth with a stable, discoverable entry from Personal QANDEEL — not Settings, not a Profile, not a tab; non-Analysis surfaces follow Dark / Light / System, default Dark'],
    ['P2 §5, §8, §10', 'the N1 nav family, glyph above the word, Living Brass identical at every state, SELECTED by E1R marker + weight; Hugeicons Free utility sourcing; 44 pt; direction by meaning'],
    ['P3 §3, §6, §8', 'Activity: one independent icon-only entry at the START edge of the non-Analysis upper chrome; never in the Analysis; a neutral presence mark'],
    ['C3 §2A, §6, §8', 'the Q is made of qandeel.identity.mark if it appears; its presence on every screen is open; Brass never encodes state'],
    ['G3 §C, §G; T-11 / T-12 amendment', 'the Analysis is one dark place; world → temporal line → Timeline → OrientationChrome; the 160 pt world floor; «سياق الكلام» placement not decided'],
  ].map(([a, t]) => `<li><b style="color:#eeebe2">${a}</b> — ${t}</li>`).join('');
  B['01-authority-baseline'] = page('01', 'Authority baseline — the accepted shell P4-C starts from, untouched',
    'What already binds before any candidate is drawn: the P3-A non-Analysis shell (Activity at START; the three Worlds with P2 glyphs above their words) and G3.2\'s own Analysis, loaded byte-exact. Nothing on this board is a candidate.',
    row('The incumbent', 'no Settings, Understanding or Q entry yet — exactly what P4 must place', [phone('b-conv-ad', 'Personal Conversation: Activity at the START edge; «تحليل المحادثة» and Replay at the END (G1.1 / P3)', { tag: 'f' }), phone('b-shared-ad', 'Shared World: Activity only; the World\'s own name row', { tag: 'f' }),
      phone('b-analysis-ad', 'G3.2\'s Analysis, byte-exact (sha 10611f35…), its own pre-P2 word-only rail; no global entry', { tag: 'f' }), phone('b-analysis-el', 'G3.2 PINNED under system Light: still the one dark place (G3 §C.1)', { tag: 'f' }),
      `<div class="panel" style="width:520px"><h3>The frozen material every candidate must reuse</h3><p>The P2 navigation family (N1 "Open", Living Brass ${DARK.brass}), drawn by P2-A's own <span class="mono">sig.mjs</span>:</p><p style="margin:12px 0">${navFam}</p>` +
      `<p>The canonical Q, read verbatim from the I-08B2.5 master (never redrawn), in <span class="mono">qandeel.identity.mark</span>:</p><p style="margin:12px 0;color:${DARK.mark}">${qSvg({ height: 64, cls: 'q' })}</p><p class="mono">docs/design/canonical-artifacts/brand/i-08b2.5/masters/QANDEEL_Q_BASE_MASTER.svg — P4-C does not ratify the package (DQ-05)</p></div>`]) +
    `<div class="grid2"><div class="panel"><h3>Binding law (quoted by section, unchanged by P4-C)</h3><ul>${laws}</ul></div>` +
    `<div class="panel"><h3>The four open questions (Decision Queue, all OPEN)</h3><ul>${MX.decisions.map((d) => `<li><b style="color:#eeebe2">${d.dq}</b> — ${esc(d.question)}</li>`).join('')}</ul>` +
    `<p style="margin-top:10px">«سياق الكلام» copy authority: ${esc(MX.decisions[4].copyAuthority.arabic)}. English: ${esc(MX.decisions[4].copyAuthority.english)}.</p></div></div>`);
}
// ---------------------------------------------------------------------------------------------------------- 02
{
  const cA = cand('P4-DQ-01', 'S-A'), cB = cand('P4-DQ-01', 'S-B');
  const set = (s) => [phone(`s-${s}-conv-ad`, s === 'A' ? 'Personal: gear beside Activity (START utility pair)' : 'Personal: gear at the END of the Personal row'), phone(`s-${s}-shared-ad`, s === 'A' ? 'Shared World: the same pair, same place' : 'Shared World: no Settings entry (reach it through QANDEEL)'),
    phone(`s-${s}-conv-el`, 'English, Light'), phone(`s-${s}-conv-a320`, '320 × 568 Arabic'), phone(`s-${s}-conv-e320`, s === 'A' ? '320 × 568 English: the chrome OVERFLOWS (proof English door label, DQ-09)' : '320 × 568 English: fits', { tag: s === 'A' ? 'c' : 'c' }), phone(`s-${s}-shared-e320`, '320 × 568 English, Light')];
  const crops = ['s-A-conv-ad', 's-B-conv-ad', 's-A-conv-a320', 's-B-conv-a320'].map((id) => crop(id, { y: 44, w: SH[id].w, h: 100, z: 1.25, cap: `${id.includes('-A-') ? 'S-A' : 'S-B'} · free chrome span ${gapOf(id)} pt · ${H(id).kids.length} chrome controls` }));
  B['02-dq01-settings-placement'] = page('02', 'P4-DQ-01 — where the one General Settings destination is entered',
    'S-A puts an icon-only Settings entry beside Activity in the upper chrome of every non-Analysis surface. S-B puts a stable entry on Personal QANDEEL\'s own row only. Same content, device and language in each pair; U-A and Q-A held constant.',
    frame('P3 Activity at the START edge (never replaced, never in the Analysis); one Settings destination (P1 §8); the Hugeicons-Free <span class="mono">settings</span> glyph in rest ink; 44 pt; no Settings in the Analysis; the switcher\'s three Worlds',
      'the Settings entry\'s place: the global START utility group (S-A) vs the Personal row\'s END (S-B)',
      'global discoverability vs chrome crowding vs Personal-centredness; whether a gear on the Personal row reads as the app\'s settings or as "QANDEEL\'s" settings',
      '<b style="color:#f0a597;display:inline">Rejected:</b> a fourth switcher tab (I-08A4 §19); an overflow menu (hidden settings); inside Activity (P3 §3). <b style="color:#e0cfa8;display:inline">Weaker, not rejected:</b> S-B\'s absence from Shared World') +
    row('S-A · Upper-chrome utility', DECISIONS.settings.options.A.what, set('A')) + row('S-B · Personal surface entry', DECISIONS.settings.options.B.what, set('B')) +
    row('Return context', 'Activity\'s own header keeps P3\'s shortcut into the same one destination (Notifications & Activity section); Back returns where the user was', [phone('s-activity-ad', 'Activity (P3, unchanged): its gear is a deep link into the one Settings, not a second destination', { tag: 'f' }), phone('s-settings-ad', 'the one General Settings destination — P1 §8.1 groups (proof words), no switcher: it is not a World', { tag: '' }), phone('s-settings-notif-el', 'entered from Activity: the same destination, Notifications & Activity in focus', { tag: '' }),
      `<div class="panel" style="width:560px"><h3>Measured chrome (upper chrome only)</h3><div>${crops.join('')}</div></div>`]) +
    `<div class="grid2"><div class="panel"><h3>S-A · evidence</h3><ul>${cA.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>${ratings(cA)}</div><div class="panel"><h3>S-B · evidence</h3><ul>${cB.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>${ratings(cB)}</div></div>`);
}
// ---------------------------------------------------------------------------------------------------------- 03
{
  const cA = cand('P4-DQ-02', 'U-A'), cB = cand('P4-DQ-02', 'U-B');
  const set = (u) => [phone(`u-${u}-ad`, 'rest'), phone(`u-${u}-press-ad`, 'pressed (E1R ground wash)'), phone(`u-${u}-focus-ad`, 'keyboard focus (E1R perimeter)'), phone(`u-${u}-el`, 'English, Light'), phone(`u-${u}-a320`, '320 × 568 Arabic'), phone(`u-${u}-e320`, '320 × 568 English')];
  B['03-dq02-understanding-placement'] = page('03', 'P4-DQ-02 — the stable entry to «فهم قنديل» / QANDEEL Understanding',
    'U-A: words and a depth chevron on a quiet Personal row under the upper chrome. U-B: the same words as a chrome action beside «تحليل المحادثة». Settings (S-B) and Q (Q-A) held constant. A General Settings row is shown only as the rejection it is.',
    frame('the canonical names «فهم قنديل» / QANDEEL Understanding (P1 §10); Personal-only; never Settings, a Profile or a tab; «القراءات» stays the in-Analysis vocabulary (P1 §10); the door «تحليل المحادثة» and Replay keep their G1.1 places; no new glyph',
      'the entry\'s place and control form: its own Personal row (U-A) vs the conversation chrome (U-B)',
      'discoverability; hierarchy against «تحليل المحادثة»; how strongly each risks reading as Settings, Profile or a tab; 320 pt',
      '<b style="color:#f0a597;display:inline">Rejected:</b> a General Settings row (P1 §11); U-B at 320 pt as drawn (it pushes the frozen door / Replay off-screen). <b style="color:#e0cfa8;display:inline">Weaker:</b> U-B\'s confusion with the door at 390') +
    row('U-A · Personal row control', cA.name, set('A')) + row('U-B · Conversation-context sibling', cB.name, set('B')) +
    row('The limits', '', [phone('u-B-sA-a320', 'U-B with S-A at 320 AR: the chrome overflows; the door and Replay leave the screen', { tag: 'r' }), phone('u-S-rejected-ad', 'Understanding as a General Settings row — FAILS P1 §11 (shown via the validator defect)', { tag: 'r' }), phone('u-page-ad', 'where the entry leads: the surface itself is not designed here (P4-DQ-07)', { tag: '' }),
      `<div class="panel" style="width:640px"><h3>U-A · evidence</h3><ul>${cA.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>${ratings(cA)}<h3 style="margin-top:12px">U-B · evidence</h3><ul>${cB.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>${ratings(cB)}</div>`]));
}
// ---------------------------------------------------------------------------------------------------------- 04
{
  const set = (q) => [phone(`q-${q}-conv-ad`, q === 'A' ? 'no chrome Q; the Q beside QANDEEL\'s opening turn (G3.2 composition)' : 'the Q centred in the free chrome span'), phone(`q-${q}-shared-ad`, q === 'B' ? 'Shared World: the Q again' : 'Shared World: no chrome Q'), phone(`q-${q}-conv-el`, 'English, Light (identity.mark light)'), phone(`q-${q}-conv-a320`, '320 × 568')];
  const cq = ['Q-A', 'Q-B', 'Q-C'].map((id) => cand('P4-DQ-03', id));
  B['04-dq03-q-placement'] = page('04', 'P4-DQ-03 — does the canonical Q appear persistently, and where?',
    'The real Q geometry (brand master, verbatim) in qandeel.identity.mark, decorative, never a control, never a state. Q-B and Q-C are each given their best case: the centre of the free chrome span, not the physical centre.',
    frame('the Q\'s geometry and material (I-08B2.5 master; C3 §2A); G2.3\'s frozen Matching cue Q; no Q animation; the Q never carries selected / active / status; launch / gateway = DQ-06',
      'the Q\'s presence: identity moments only (Q-A) · every non-Analysis shell surface (Q-B) · Personal only (Q-C)',
      'whether the Q adds context or repeats the app\'s identity; its cost in the busiest chrome; what Q-C implies about Shared and Public',
      '<b style="color:#f0a597;display:inline">Rejected:</b> the Q as a button glyph or as the selected marker (planted defects). <b style="color:#e0cfa8;display:inline">Weaker:</b> Q-B / Q-C cannot reach the Analysis without further authority') +
    ['A', 'B', 'C'].map((q) => row(`${DECISIONS.q.options[q].short} · ${DECISIONS.q.options[q].name}`, DECISIONS.q.options[q].what, set(q))).join('') +
    row('Where the Q costs', '', [phone('q-B-sA-conv-ad', 'Q-B with S-A at 390: the free span narrows'), phone('q-B-sA-conv-a320', 'Q-B with S-A at 320: the Q strikes the chrome', { tag: 'c' }), phone('q-moment-cue-ad', 'the frozen identity moment: the Matching cue\'s Q (G2.3 §1, drawn by G3.2)', { tag: 'f' }),
      `<div class="panel" style="width:700px"><h3>Platform reference (evidence, not authority)</h3><p>Apple HIG Branding: "Ensure branding always defers to content." and "Resist the temptation to display your logo throughout your app or game unless it's essential for providing context." — the second is the sentence C3 §8 already cites.</p>` +
      cq.map((c) => `<h3 style="margin-top:10px">${c.id}</h3><ul>${c.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`).join('') + '</div>']));
}
// ---------------------------------------------------------------------------------------------------------- 05
{
  const forms = ['plate', 'ground', 'seam'];
  const rail = (id, y0) => crop(id, { y: y0, w: SH[id].w, h: SH[id].h - y0, z: 1.3, cap: '' });
  const set = (sw) => [phone(`w-${sw}-conv-ad`, 'Arabic, Dark'), phone(`w-${sw}-conv-el`, 'English, Light'), phone(`w-${sw}-shared-ad`, 'Shared World selected'), phone(`w-${sw}-analysis-ad`, 'in the Analysis (dark scope, G3.2\'s rail box)'), phone(`w-${sw}-conv-a320`, '320 × 568'),
    `<div>${crop(`w-${sw}-press-ad`, { y: 690, w: 390, h: 154, z: 0.72, cap: 'PRESSED «العالم المشترك»: the ground wash; Brass unchanged' })}${crop(`w-${sw}-focus-el`, { y: 690, w: 390, h: 154, z: 0.72, cap: 'FOCUS: the E1R detached perimeter' })}${crop(`w-${sw}-hc-ad`, { y: 690, w: 390, h: 154, z: 0.72, cap: 'Increased Contrast' })}</div>`];
  B['05-dq04-switcher-form'] = page('05', 'P4-DQ-04A — the Global Switcher\'s physical form',
    'Three forms for the container, its depth (tab depth), its relationship to the page ground and the SELECTED geometry: two plate variants that differ in edge and marker geometry (SW-1, SW-3) and one plate-less form (SW-2). Every frozen semantic is identical across them. Settings S-B, Understanding U-A, Q-A held constant.',
    frame('exactly QANDEEL · Shared World · Public World; P2 N1 glyphs ABOVE the word; Living Brass identical at every state (C-NAV-4); SELECTED = E1R marker + word weight (C-NAV-5); PRESSED on the ground; FOCUS = the detached perimeter; 44 pt; nothing else in the switcher',
      'container (plate / none) · depth (continuous with the composer / seamed) · SELECTED marker geometry (crown rule / under-word rule / full-cell seam segment)',
      'which form states "this is the Worlds machine" most clearly without a pill, a glow or selected-only colour; legibility of SELECTED at 320 pt, in Light and under Increased Contrast',
      '<b style="color:#f0a597;display:inline">Rejected (planted defects):</b> a fourth tab; selected-only Brass; colour-only SELECTED; the glyph below the word. <b style="color:#e0cfa8;display:inline">Craft, not Product:</b> marker length, hairline weight, plate height') +
    forms.map((f) => row(`${DECISIONS.switcher.options[f].short} · ${DECISIONS.switcher.options[f].name}`, DECISIONS.switcher.options[f].what, set(f))).join('') +
    `<div class="grid3">${['SW-1', 'SW-2', 'SW-3'].map((id) => { const c = cand('P4-DQ-04A', id); return `<div class="panel"><h3>${id}</h3><ul>${c.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>${ratings(c)}</div>`; }).join('')}</div>` +
    `<div class="panel" style="margin-top:16px"><h3>Product decision vs craft</h3><p><b>Product:</b> ${MX.decisions[3].productDecisionVsCraft.product.join(' · ')}.</p><p><b>Craft / implementation tuning:</b> ${MX.decisions[3].productDecisionVsCraft.craft.join(' · ')}.</p><p>No destination is ever disabled in canon, so no DISABLED switcher state is drawn; if one is ever needed it takes E1R's one availability ink, never a Brass change (C3 §6).</p></div>`);
}
// ---------------------------------------------------------------------------------------------------------- 06
{
  const xs = ['end', 'centre', 'top'];
  const set = (x) => [phone(`x-${x}-p1-ad`, 'ordinary Analysis, Arabic'), phone(`x-${x}-pinned-el`, 'PINNED, English under system Light (still dark)'), phone(`x-${x}-call-ad`, 'Live Call Analysis, Arabic'), phone(`x-${x}-cp320-ad`, '320 × 568, Live Call + PINNED (the densest state)'), phone(`x-${x}-cp320-el`, 'the same, English'),
    crop(`x-${x}-cp320-ad`, { y: 44, w: 320, h: x === 'top' ? 110 : 56, z: 0.8, cap: 'the chrome row, zoomed' })];
  const wc = MX.measured.worldCost;
  B['06-dq04-context-placement'] = page('06', 'P4-DQ-04B — where «سياق الكلام» sits inside G3.2\'s Analysis',
    'Placement only, inside the existing G3.2 composition (loaded byte-exact). The words: Arabic «سياق الكلام» (VI-01 S03 / A01, APPROVED); English OPEN — rendered as "In play now", VI-01\'s own candidate, PROOF COPY — NOT CANONICAL, final wording → P4-DQ-09. No panel, no value, no context state is invented.',
    frame('the Living Analysis World; the temporal line → Timeline → OrientationChrome order; Replay; «المحادثة»; Return Live; «طرق العودة»; the call line; the 160 pt world floor; the dark scope under Light',
      'the placement of one text action «سياق الكلام»: chrome beside Replay (X-A) · chrome centre (X-B) · the world\'s upper edge (X-C)',
      'semantic grouping; whether it reads as a title; clearance from «المحادثة» and Replay at 320 pt; any world cost',
      '<b style="color:#f0a597;display:inline">Rejected:</b> X-C, measured below the world floor in the densest state; any overlap / duplicate (planted defects). <b style="color:#e0cfa8;display:inline">Weaker:</b> X-B reads as the place\'s title') +
    xs.map((x) => row(`${DECISIONS.context.options[x].short} · ${DECISIONS.context.options[x].name}`, DECISIONS.context.options[x].what, set(x).map((p) => (x === 'top' ? p.replace(chip('c'), chip('r')) : p)))).join('') +
    `<div class="grid3">${['X-A', 'X-B', 'X-C'].map((id) => { const c = cand('P4-DQ-04B', id); return `<div class="panel"><h3>${id}</h3><ul>${c.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>${ratings(c)}</div>`; }).join('')}</div>` +
    `<div class="panel" style="margin-top:16px"><h3>World cost, measured from G3.2's own rects (C-X-3, C-X-4)</h3>${wc.map((w) => M(`${w.page} · ${w.placement}`, `world ${w.world} pt − ${w.overlayCost} pt = ${w.unobstructed} pt vs floor ${w.floor}`, w.belowFloor, !w.belowFloor)).join('')}<p style="margin-top:6px">X-A and X-B never enter the world (C-X-3). No placement overlaps a frozen control (C-X-2).</p></div>`);
}
// ---------------------------------------------------------------------------------------------------------- 07 – 10 integrated
const dirRow = (d, items) => row(`${DIRECTIONS[d].name}`, `${Object.entries({ Settings: DIRECTIONS[d].s, Understanding: DIRECTIONS[d].u, Q: DIRECTIONS[d].q, Switcher: DIRECTIONS[d].sw, 'سياق الكلام': DIRECTIONS[d].x }).map(([k, v]) => `${k} ${v}`).join(' · ')}<br>${esc(DIRECTIONS[d].why)}`, items);
const dirs = ['I', 'II'];
B['07-integrated-ar-dark'] = page('07', 'Integrated — Arabic RTL, Dark: the whole shell with each direction',
  'At most two combination directions, each an INTEGRATED CANDIDATE — NOT SELECTED. The point of this board is collisions: every candidate at once, on the real surfaces, in Arabic.',
  dirs.map((d) => dirRow(d, [phone(`i${d}-conv-ad`, 'Personal Conversation, 390 × 844', { tag: 'i' }), phone(`i${d}-shared-ad`, 'Shared World', { tag: 'i' }), phone(`i${d}-analysis-ad`, 'Analysis: the switcher form + «سياق الكلام»; nothing global added', { tag: 'i' }), phone(`i${d}-call-ad`, 'Analysis during an active Live Call', { tag: 'i' }),
    `<div class="panel" style="width:520px"><h3>Measured</h3>${M('Personal chrome free span', gapOf(`i${d}-conv-ad`) + ' pt')}${M('chrome controls', H(`i${d}-conv-ad`).kids.length)}${M('Shared chrome free span', gapOf(`i${d}-shared-ad`) + ' pt')}${M('conversation height', Math.round(SH[`i${d}-conv-ad`].measured.conv.h) + ' pt')}${M('overflow', H(`i${d}-conv-ad`).scrollW > H(`i${d}-conv-ad`).clientW ? 'yes' : 'none', H(`i${d}-conv-ad`).scrollW > H(`i${d}-conv-ad`).clientW, true)}</div>`])).join(''));
B['08-integrated-en-light'] = page('08', 'Integrated — English LTR, Light: a real LTR composition, not a mirror',
  'The non-Analysis surfaces are a real English LTR composition laid out by meaning (START is the left edge), and Light follows the P1 preference there. The Analysis stays the one dark place under system Light; its world content (Arabic labels, Arabic-Indic digits) is G3.2\'s own I-08B1 fixture, shown unchanged.',
  dirs.map((d) => dirRow(d, [phone(`i${d}-conv-el`, 'Personal Conversation, Light', { tag: 'i' }), phone(`i${d}-shared-el`, 'Shared World, Light', { tag: 'i' }), phone(`i${d}-pinned-el`, 'Analysis PINNED under system Light — dark (G3 §C.1); "In play now" is PROOF COPY', { tag: 'i' }), phone(`i${d}-settings-el`, 'the one General Settings destination, Light', { tag: 'i' })])).join(''));
B['09-compact-320-stress'] = page('09', 'Compact stress — 320 × 568, large text, and 430 × 932',
  'The narrowest reviewed phone in both languages, the densest Analysis state (Live Call + PINNED), a browser large-text stand-in (not Dynamic Type — a device gate), and the larger phone.',
  dirs.map((d) => dirRow(d, [phone(`i${d}-conv-a320`, '320 × 568 Arabic', { tag: 'i' }), phone(`i${d}-conv-e320`, '320 × 568 English, Light', { tag: 'i' }), phone(`i${d}-cp320-ad`, '320 × 568 Live Call + PINNED', { tag: 'i' }), phone(`i${d}-large-ad`, 'large text (browser stand-in, 118 %)', { tag: 'i' }), phone(`i${d}-conv-a430`, '430 × 932', { tag: 'i' }),
    `<div class="panel" style="width:300px"><h3>Measured at 320</h3>${M('overflow', ovf(`i${d}-conv-a320`) + ' AR / ' + ovf(`i${d}-conv-e320`) + ' EN', ovf(`i${d}-conv-e320`) !== 'none' || ovf(`i${d}-conv-a320`) !== 'none', ovf(`i${d}-conv-e320`) === 'none')}${M('AR free span', gapOf(`i${d}-conv-a320`) + ' pt', gapOf(`i${d}-conv-a320`) < 16)}${M('EN free span', gapOf(`i${d}-conv-e320`) + ' pt', gapOf(`i${d}-conv-e320`) < 16)}${M('AR conversation', Math.round(SH[`i${d}-conv-a320`].measured.conv.h) + ' pt')}${M('world (densest)', (CH.worldCost.find((w) => w.page === 'an-end-cp320-ad') || { world: '—' }).world + ' pt vs 160')}</div>`])).join(''));
{
  const order = (id) => SH[id].measured.controls.filter((c) => c.y < 150 || c.nav).map((c, i) => `${i + 1}. ${esc(c.name || c.id)}`).join(' → ');
  B['10-accessibility-rtl-focus'] = page('10', 'Accessibility, RTL and focus — Increased Contrast, focus order, targets and names',
    'Each direction under the F1 / F2 Increased Contrast transforms. The focus captures use keyboard modality and programmatic focus; the order itself is proved by a real Tab walk (C-FOCUS-2) and a DOM-order check (C-FOCUS-1). Browser evidence only: VoiceOver / TalkBack and device settings are device gates.',
    dirs.map((d) => dirRow(d, [phone(`i${d}-hc-ad`, 'Increased Contrast, Arabic Dark', { tag: 'i' }), phone(`i${d}-hc-el`, 'Increased Contrast, English Light', { tag: 'i' }), phone(`i${d}-focus1-ad`, `focus 1: ${esc(SH[`i${d}-focus1-ad`].measured.focused.name)}`, { tag: 'i' }), phone(`i${d}-focus2-ad`, `focus 2: ${esc(SH[`i${d}-focus2-ad`].measured.focused.name)}`, { tag: 'i' }), phone(`i${d}-focus3-ad`, `focus 3: ${esc(SH[`i${d}-focus3-ad`].measured.focused.name)}`, { tag: 'i' }),
      `<div class="panel" style="width:330px"><h3>Reading = focus order (C-FOCUS-1, C-FOCUS-2)</h3><ol dir="rtl" lang="ar" style="font-size:13px;padding-inline-start:20px">${SH[`i${d}-conv-ad`].measured.controls.filter((c) => c.y < 150 || c.nav).map((c) => `<li>${esc(c.name || c.id)}</li>`).join('')}</ol></div>`])).join('') +
    `<div class="row"><div class="rlab">Increased Contrast, zoomed<span class="sub">standard vs increased, the same chrome</span></div>${['iI-conv-ad', 'iI-hc-ad', 'iII-conv-el', 'iII-hc-el'].map((id) => crop(id, { y: 44, w: 390, h: 100, z: 0.95, cap: SH[id].contrast ? 'Increased Contrast' : 'standard' })).join('')}</div>` +
    `<div class="grid4"><div class="panel"><h3>Targets</h3>Every studied control ≥ 44 × 44 pt (C-TGT-1); a glyph never grows to meet its target.</div><div class="panel"><h3>Names</h3>Icon-only entries carry their Product word as the accessible name: «النشاط، فيه جديد», «الإعدادات»; nav glyphs are hidden, the word names the World (C-NAME-1, C-NAV-6).</div>` +
    `<div class="panel"><h3>Direction by meaning</h3>Arabic RTL / English LTR roots with <span class="mono">lang</span>; START / END placement; the depth chevron mirrors in Arabic; nav glyphs, Open Ledger and the Q never mirror (C-DIR-1, C-DIR-2).</div><div class="panel"><h3>State without colour</h3>SELECTED = marker + weight; PRESSED = ground; FOCUS = perimeter; Brass identical at every state (C-NAV-4, C-NAV-5).</div></div>`);
}
// ---------------------------------------------------------------------------------------------------------- 11
{
  const card = (dqs, thumbs) => { const ds = dqs.map((q) => MX.decisions.find((d) => d.dq === q));
    return `<div class="card"><h2>${ds.map((d) => d.dq).join(' + ')} — ${ds.map((d) => esc(d.title)).join(' · ')}</h2><div class="row" style="margin:12px 0 6px;flex-wrap:wrap">${thumbs.map(([id, cap, t]) => phone(id, cap, { k: 0.42, tag: t })).join('')}</div>` +
      ds.map((d) => `<p style="font-size:13px;margin-top:8px">${d.candidates.map((c) => `<b>${c.id}</b> ${esc(c.name)} <span class="mono">(${c.status})</span>`).join(' · ')}</p><div class="rec"><b>Advisory recommendation: ${esc(d.recommendation.direction)}</b> (${d.recommendation.strength}) — ${esc(d.recommendation.why)}</div><div class="ask">${esc(d.question)}</div>`).join('') + '</div>'; };
  B['11-decision-summary'] = page('11', 'Decision summary — four questions for the Product Owner, all still OPEN',
    `Recommendations are advisory and reversible. ${esc(MX.integratedAdvice.why)} Checks: ${CH.summary.normal} pass · ${CH.summary.planted}.`,
    `<div class="grid2">${card(['P4-DQ-01'], [['s-A-conv-ad', 'S-A', 'c'], ['s-B-conv-ad', 'S-B', 'c'], ['s-A-shared-ad', 'S-A · Shared', 'c'], ['s-B-shared-ad', 'S-B · Shared', 'c']])}${card(['P4-DQ-02'], [['u-A-ad', 'U-A', 'c'], ['u-B-ad', 'U-B', 'c'], ['u-B-e320', 'U-B · 320 EN', 'r'], ['u-S-rejected-ad', 'Settings row', 'r']])}` +
    `${card(['P4-DQ-03'], [['q-A-conv-ad', 'Q-A', 'c'], ['q-B-conv-ad', 'Q-B', 'c'], ['q-C-conv-ad', 'Q-C', 'c'], ['q-moment-cue-ad', 'identity moment', 'f']])}${card(['P4-DQ-04A', 'P4-DQ-04B'], [['w-plate-conv-el', 'SW-1', 'c'], ['w-ground-conv-el', 'SW-2', 'c'], ['w-seam-conv-el', 'SW-3', 'c'], ['x-end-call-ad', 'X-A', 'c'], ['x-centre-call-ad', 'X-B', 'c'], ['x-top-cp320-ad', 'X-C', 'r']])}</div>` +
    `<div class="grid2" style="margin-top:16px">${dirs.map((d) => `<div class="card">${chip('i')}<h2>${esc(DIRECTIONS[d].name)}</h2><p style="font-size:13.5px;margin:6px 0 10px">${esc(DIRECTIONS[d].why)}</p><div class="row" style="flex-wrap:wrap">${[`i${d}-conv-ad`, `i${d}-shared-el`, `i${d}-call-ad`, `i${d}-conv-a320`].map((id) => phone(id, '', { k: 0.42, tag: '' })).join('')}</div></div>`).join('')}</div>`);
}

// ---------------------------------------------------------------------------------------------------------- render
mkdirSync(join(PKG, 'boards'), { recursive: true });
const index = [];
for (const [name, html] of Object.entries(B)) {
  const png = await renderSheet(name, html);
  writeFileSync(join(PKG, 'boards', name + '.png'), png);
  const shots = [...html.matchAll(/shots\/([a-zA-Z0-9-]+)\.png/g)].map((m) => m[1]);
  index.push({ board: name, png: `boards/${name}.png`, bytes: png.length, sha256: sha(png), captures: [...new Set(shots)] });
  process.stdout.write(`${name} `);
}
await closeSheetBrowser();
writeFileSync(join(PKG, 'data', 'BOARDS.json'), JSON.stringify({ note: 'Each board and the Product captures it shows (ids in data/SHOTS.json).', boards: index }, null, 1) + '\n');
console.log(`\nrendered ${index.length} boards`);
