// P2-A — the review boards. Each board answers ONE review question (task §21); its phones are Product captures from
// tools/p2capture.mjs (data/SHOTS.json), every diagnostic sits outside the phones, and the glyph sheets are drawn from
// the same source the prototype is built from (src/sig.mjs, src/utility.mjs, src/machines.mjs).
//   node tools/p2boards.mjs [B01,B02,…]   → boards/*.png, data/BOARDS.json, data/NAV_MATERIAL.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { renderSheet, closeSheetBrowser } from './lib/sheet.mjs';
import { WORK, PKG } from './lib/session.mjs';
import { decode } from './lib/png.mjs';
import { SIG, sigSvg, NUANCES, STROKE } from '../src/sig.mjs';
import { UTIL, utilSvg, UTILITY_DEFAULT } from '../src/utility.mjs';
import { RAIL_VARIANTS, SPINE_VARIANTS, RAIL_RECOMMENDED, SPINE_RECOMMENDED, railArt } from '../src/machines.mjs';
import { FUNC_GLYPHS, svg as oldSvg } from '../src/glyphs.mjs';
import { palette } from '../src/tokens.mjs';

const only = process.argv[2] ? process.argv[2].split(',') : null;
const SHOTS = JSON.parse(readFileSync(join(PKG, 'data', 'SHOTS.json'), 'utf8'));
const shot = (id) => { if (!SHOTS[id]) throw new Error('missing shot ' + id); return pathToFileURL(join(WORK, 'shots', id + '.png')).href; };
const sha = (b) => createHash('sha256').update(b).digest('hex');
const DK = palette('dark').colors, LT = palette('light').colors;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = pathToFileURL(join(PKG, 'source', 'vendor', 'fonts', 'Estedad-wght-v8.5.woff2')).href;
const STATUS = 'QANDEEL · P2-A Final Iconography — integrated visual proof / decision gate · RECOMMENDED FOR PRODUCT OWNER REVIEW — NOT FROZEN · P2 is not closed · phones are Product captures at 2× (no harness); every diagnostic is outside them';

const CSS = `@font-face{font-family:Estedad;src:url(${FONT}) format('woff2');font-weight:100 900}
*{box-sizing:border-box}body{margin:0;background:#0c0c0c;color:#d8d5ca;font:14px/1.5 Estedad,system-ui;padding:44px 52px 36px}
.k{font:600 11px/1 ui-monospace,Consolas,monospace;letter-spacing:.08em;color:#8b8982;margin:0 0 10px}
h1{font:600 26px/1.3 Estedad;margin:0 0 8px;color:#ecebe4}.q{color:#afaca3;max-width:1500px;margin:0 0 6px;font-size:15px}
.row{display:flex;gap:26px;align-items:flex-start;flex-wrap:wrap;margin-top:22px}
.ph{border-radius:30px;overflow:hidden;box-shadow:0 0 0 1px #2a2a2a;background:#000;flex:none}
figure{margin:0}figcaption{margin-top:9px;font-size:13px;color:#d8d5ca;max-width:420px}figcaption small{display:block;color:#8b8982;font:11px/1.5 ui-monospace,Consolas,monospace;margin-top:2px}
.crop{background-repeat:no-repeat;border-radius:14px;box-shadow:0 0 0 1px #2a2a2a;flex:none}
.note{color:#8b8982;font-size:12.5px;max-width:1500px}.foot{margin-top:30px;color:#6f6d67;font:11px/1.5 ui-monospace,Consolas,monospace}
table{border-collapse:collapse;font-size:12.5px}td,th{border-bottom:1px solid #262626;padding:6px 12px 6px 0;text-align:start;vertical-align:top}th{color:#8b8982;font-weight:500}
.pass{color:#9fd3a8}.tag{display:inline-block;font:600 10.5px/1 ui-monospace,Consolas,monospace;padding:4px 7px;border-radius:4px;background:#d8d5ca;color:#101010;margin-inline-start:8px;vertical-align:2px}
.cell{display:grid;place-items:center}.lab{font:11px/1.3 ui-monospace,Consolas,monospace;color:#8b8982;text-align:center;margin-top:6px}`;
const page = (n, title, q, body, note = '') => `<!doctype html><html lang="en"><meta charset="utf-8"><style>${CSS}</style><body>
<p class="k">BOARD ${n}</p><h1>${title}</h1><p class="q">${q}</p>${body}${note ? `<p class="note" style="margin-top:18px">${note}</p>` : ''}<p class="foot">${STATUS}</p></body></html>`;
/** A phone (whole Product capture) at display width `dw`. */
function phone(id, cap, sub = '', dw = 300) {
  const s = SHOTS[id], hh = Math.round(dw * s.h / s.w);
  return `<figure><div class="ph" style="width:${dw}px;height:${hh}px"><img src="${shot(id)}" style="width:${dw}px;height:${hh}px;display:block"></div><figcaption>${cap}<small>${sub || `${s.w}×${s.h} · ${s.lang === 'ar' ? 'Arabic' : 'English'} device · system ${s.scheme === 'light' ? 'Light' : 'Dark'}${s.rm ? ' · Reduced Motion' : ''} · ${id}`}</small></figcaption></figure>`;
}
/** A crop of a capture: CSS-px rectangle (x, y, w, h) at zoom z. */
function crop(id, x, y, w, h, z, cap, sub = '') {
  const s = SHOTS[id];
  return `<figure><div class="crop" style="width:${w * z}px;height:${h * z}px;background-image:url(${shot(id)});background-size:${s.w * z}px auto;background-position:${-x * z}px ${-y * z}px"></div>${cap ? `<figcaption>${cap}<small>${sub || id}</small></figcaption>` : ''}</figure>`;
}
/** The timeline region of a capture (from the temporal line to the chrome), measured from the page. */
function tlCrop(id, z = 1.6, cap = '', sub = '') {
  const s = SHOTS[id], b = s.measured.boxes, tl = b.timeline;
  const y = Math.max(0, tl.y - 34), h = Math.min(s.h - y, tl.h + 34 + 56);
  return crop(id, 0, y, s.w, h, z, cap, sub);
}
function railCrop(id, z = 1.6, cap = '', sub = '') { const s = SHOTS[id], c = s.measured.boxes.composer; return crop(id, 0, c.y, s.w, c.h + 60, z, cap, sub); }

const boards = [];
function board(id, file, fn) { boards.push({ id, file, fn }); }

// ---------------------------------------------------------------------------------------------------------- B01
const GLYPH_ORDER = ['navMine', 'navShared', 'navPublic', 'depth', 'replay', 'mic', 'muted', 'route', 'routeOn', 'endCall', 'call', 'send', 'play', 'pause', 'stop'];
const GLYPH_NAME = { navMine: 'قنديل · Personal', navShared: 'العالم المشترك · Shared', navPublic: 'العالم العام · Public', depth: 'تحليل المحادثة', replay: 'Replay', mic: 'Mic', muted: 'Muted', route: 'Route · earpiece', routeOn: 'Route · speaker', endCall: 'End Call', call: 'Call', send: 'Send', play: 'Play', pause: 'Pause', stop: 'Stop' };
const isNav = (g) => g.startsWith('nav');
function glyphRow(nuance, size, bg, ink, brass, pad = 20) {
  return `<div style="display:flex;background:${bg};border-radius:12px;padding:${pad}px 10px">` + GLYPH_ORDER.map((g) =>
    `<div class="cell" style="width:${Math.max(96, size + 30)}px;color:${isNav(g) ? brass : ink}">${sigSvg(g, { size, nuance, id: `${nuance}${size}${bg.slice(1)}` })}</div>`).join('') + '</div>';
}
function construction(g, nuance = 'open') {
  const Z = 9, sw = STROKE[24];
  const grid = Array.from({ length: 25 }, (_, i) => `<path d="M${i} 0V24M0 ${i}H24" stroke="#2a2a2a" stroke-width="${1 / Z}"/>`).join('');
  return `<svg width="${24 * Z}" height="${24 * Z}" viewBox="0 0 24 24" style="background:#111;border-radius:8px">${grid}
<rect x="2" y="2" width="20" height="20" fill="none" stroke="#4a4131" stroke-width="${1.2 / Z}" stroke-dasharray=".4 .3"/>
<circle cx="12" cy="12" r="8" fill="none" stroke="#35505a" stroke-width="${1.2 / Z}"/>
<path d="M12 12L${12 + 11 * Math.cos(Math.PI / 4)} ${12 + 11 * Math.sin(Math.PI / 4)}" stroke="#35505a" stroke-width="${1 / Z}" stroke-dasharray=".3 .3"/>
<g color="#d8d5ca">${SIG[g](NUANCES[nuance], 24, 'cx' + g)}</g></svg><div class="lab">${esc(GLYPH_NAME[g])} · 24 u grid · live area 20 u (dashed) · ⌀16 keyline · cut at 45°</div>`;
}
board('B01', '01-signature-family.png', () => page('01', 'The QANDEEL signature family — one drawing language, small on purpose',
  'Is there ONE owned family (open geometry, one cut, optical weight, solid anchors only where they carry meaning), and is it immediately recognisable? Fifteen glyphs, recommended nuance N1 “Open”, shown large for craft and at 24 px for use; navigation in Living Brass, every functional glyph neutral.',
  `<div class="row" style="gap:18px">${['navMine', 'navPublic', 'muted', 'routeOn', 'replay'].map((g) => `<figure>${construction(g)}</figure>`).join('')}</div>
<p class="k" style="margin-top:26px">N1 “OPEN” — RECOMMENDED · 48 px · dark World #101010 · Brass ${DK.brass} / neutral ${DK.primary}</p>${glyphRow('open', 48, DK.world, DK.primary, DK.brass)}
<div style="display:flex;margin-top:4px">${GLYPH_ORDER.map((g) => `<div class="lab" style="width:96px">${esc(GLYPH_NAME[g])}</div>`).join('')}</div>
<p class="k" style="margin-top:18px">N1 · 24 px on the dark World · on the dark Surface ${DK.surface} in rest ink ${DK.restInk} · on the light World ${LT.world} (Brass ${LT.brass})</p>
${glyphRow('open', 24, DK.world, DK.primary, DK.brass, 14)}<div style="height:6px"></div>${glyphRow('open', 24, DK.surface, DK.restInk, DK.brass, 14)}<div style="height:6px"></div>${glyphRow('open', 24, LT.world, LT.primary, LT.brass, 14)}
<p class="k" style="margin-top:22px">N2 “ARCHITECTURAL” — THE ONE ALTERNATIVE NUANCE (flat terminals at the cut, 34° cut, +8 % stroke, tighter radii) · 48 px and 24 px</p>
${glyphRow('arch', 48, DK.world, DK.primary, DK.brass)}<div style="height:6px"></div>${glyphRow('arch', 24, DK.world, DK.primary, DK.brass, 14)}
<p class="k" style="margin-top:22px">EVIDENCE ONLY — THE G1.2 / G3.2 PROOF GLYPHS THIS FAMILY REPLACES (never cleaned up in place; G1.2 §6: “PROOF ONLY — NOT A VISUAL FREEZE”)</p>
<div style="display:flex;background:${DK.world};border-radius:12px;padding:16px 10px;color:${DK.primary}">${Object.keys(FUNC_GLYPHS).map((k) => `<div class="cell" style="width:96px">${oldSvg(FUNC_GLYPHS[k], { size: 36 })}<div class="lab">${k}</div></div>`).join('')}</div>`,
  'Rules visible here (docs/P2_ICON_GEOMETRY_SPEC.md): one opening per ring, centred at 45° where the canonical Q opens, its visible gap ≥ 2 u; round caps; optical stroke 1.60 u @24 · 1.75 u @20 · 1.95 u @16; solid only for a world\'s point of light, media transport, a toggle\'s ON body and the terminal act. The Shared and Public glyphs were redrawn after the first render read as faces (points on a horizontal inside a ring).'));

// ---------------------------------------------------------------------------------------------------------- B02
const LIBS = Object.keys(UTIL.libraries);
const ROLES = UTIL.roles;
function utilRow(lib, size, bg, ink, normalise) {
  return `<div style="display:flex;align-items:center;background:${bg};border-radius:10px;padding:12px 8px;color:${ink}">` +
    ROLES.map((r) => `<div class="cell" style="width:46px">${utilSvg(r, { lib, size, normalise })}</div>`).join('') +
    `<div style="width:8px;align-self:stretch;border-inline-start:1px solid ${bg === DK.world ? '#2a2a2a' : '#cfcdc6'}"></div>` + ['mic', 'send', 'replay'].map((g) => `<div class="cell" style="width:42px">${sigSvg(g, { size })}</div>`).join('') + '</div>';
}
board('B02', '02-utility-library-comparison.png', () => page('02', 'Utility family — the same eight meanings in five libraries, beside the QANDEEL signature glyphs',
  'Which open-source family can sit beside the signature family without looking like a different product — at the same perceived size, on both appearances? Left: as published. Right: normalised to QANDEEL\'s optical stroke (the only change; no path edited). The last three glyphs of every row are QANDEEL\'s own (mic · send · replay) as the optical reference.',
  `<table style="margin-top:18px"><tr><th>library · version · licence</th><th>as published · 24 px · dark</th><th>normalised · 24 px · dark</th><th>normalised · 20 px · light</th></tr>` +
  LIBS.map((l) => { const L = UTIL.libraries[l]; return `<tr><td style="width:210px"><b style="color:#ecebe4">${esc(L.title)}</b>${l === UTILITY_DEFAULT ? '<span class="tag">RECOMMENDED</span>' : ''}<br><span style="color:#8b8982;font:11px ui-monospace,Consolas,monospace">${L.pkg}@${L.version}<br>${L.license}${l === 'phosphor' ? ' · RN wrapper is community-owned' : ''}</span></td>
<td>${utilRow(l, 24, DK.world, DK.primary, false)}</td><td>${utilRow(l, 24, DK.world, DK.primary, true)}</td><td>${utilRow(l, 20, LT.world, LT.primary, true)}</td></tr>`; }).join('') +
  `</table><div style="display:flex;margin:6px 0 0 ${210 + 12 + 8}px">${ROLES.map((r) => `<div class="lab" style="width:46px">${r}</div>`).join('')}<div class="lab" style="width:134px">QANDEEL: mic · send · replay</div></div>`,
  'Reading the rows: Lucide and Tabler normalise cleanly but their geometric, even detail is the recognisable “generic app” look; Iconoir\'s drawings are the airiest and lose presence at 20 px; Phosphor\'s regular weight is designed on a 16 px grid, sits heavier and its React Native package is a community wrapper; Hugeicons Free (Stroke Rounded) shares QANDEEL\'s round-terminal, medium-weight character and moves least under normalisation. Evidence and scoring: docs/P2_UTILITY_LIBRARY_COMPARISON.md. No package was added to apps/mobile.'));

// ---------------------------------------------------------------------------------------------------------- B03
function navMaterial() {
  // Brass invariance, measured: the three navigation glyphs' pixels in every interaction state.
  const ids = ['nav-mine-ar', 'nav-shared-ar', 'nav-focus-ar', 'nav-press-ar'], BR = [0xa5, 0x8e, 0x6f];
  const out = { method: 'For each capture, the three rail glyph boxes (page-measured, 24 × 24 pt at 2×) are decoded. "brassBodyPx" = pixels painted with the Living Brass body itself (#a58e6f, each channel ±3): the fully covered pixels of the glyph, which no ground can change. "chromatic" = channel spread > 12 (body + its anti-aliased edge, which blends with whatever ground is under it). Exact equality compares every RGB byte of the glyph box against REST (nav-mine-ar, only «قنديل» selected).', states: {} };
  const ref = {};
  for (const id of ids) {
    const img = decode(readFileSync(join(WORK, 'shots', id + '.png'))), boxes = SHOTS[id].measured.boxes.rail_icons, st = [];
    boxes.forEach((b, k) => {
      let chroma = 0, body = 0, bytes = [];
      for (let y = Math.round(b.y * 2); y < Math.round((b.y + b.h) * 2); y++) for (let x = Math.round(b.x * 2); x < Math.round((b.x + b.w) * 2); x++) {
        const i = (y * img.width + x) * 4, r = img.rgba[i], g = img.rgba[i + 1], bl = img.rgba[i + 2];
        if (Math.max(r, g, bl) - Math.min(r, g, bl) > 12) chroma++; bytes.push(r, g, bl);
        if (Math.abs(r - BR[0]) <= 3 && Math.abs(g - BR[1]) <= 3 && Math.abs(bl - BR[2]) <= 3) body++;
      }
      const h = sha(Buffer.from(bytes));
      if (id === ids[0]) ref[k] = h;
      st.push({ item: ['mine', 'shared', 'public'][k], brassBodyPx: body, chromaticPx: chroma, sha256: h.slice(0, 16), identicalToRest: h === ref[k] });
    });
    out.states[id] = { what: { 'nav-mine-ar': 'REST · «قنديل» selected', 'nav-shared-ar': 'selection moved to «العالم المشترك»', 'nav-focus-ar': 'keyboard FOCUS on «العالم المشترك»', 'nav-press-ar': 'PRESSED «العالم العام»' }[id], glyphs: st };
  }
  writeFileSync(join(PKG, 'data', 'NAV_MATERIAL.json'), JSON.stringify(out, null, 1));
  return out;
}
board('B03', '03-navigation-material-state.png', () => {
  const m = navMaterial();
  const rows = Object.entries(m.states).map(([id, s]) => `<tr><td>${esc(s.what)}</td>${s.glyphs.map((g) => `<td>${g.brassBodyPx} Brass-body px · <span class="${g.identicalToRest ? 'pass' : ''}">${g.identicalToRest ? 'byte-identical to REST' : 'edge pixels blend with the pressed ground'}</span></td>`).join('')}</tr>`).join('');
  const r = (id, cap) => { const c = SHOTS[id].measured.boxes.rail; return crop(id, 0, c.y - 4, SHOTS[id].w, c.h + 4, 1.4, cap, id); };
  return page('03', 'Navigation family — one Living Brass material, identical in every state',
    'Does the persistent navigation family carry Living Brass as ONE family, with state expressed only by E1R\'s neutral channels (marker, weight, ground, perimeter) and never by the material? (C3 §2A, §6; E1R.)',
    `<div class="row" style="gap:16px">${r('nav-mine-ar', 'REST — «قنديل» selected: 2 pt marker at the top edge (E1R) + weight 600 on the word')}${r('nav-shared-ar', 'Selection moved to «العالم المشترك»')}${r('nav-focus-ar', 'FOCUS — detached perimeter outside the item')}${r('nav-press-ar', 'PRESSED — the ground takes the wash; the glyph does not change')}</div>
<div class="row" style="gap:16px">${r('nav-mine-conv-light', 'Conversation under system Light — Brass light body ' + LT.brass)}${r('nav-mine-analysis-light', 'Analysis under system Light — the rail is in the dark Analysis shell, Brass ' + DK.brass)}</div>
<h1 style="font-size:17px;margin-top:26px">Measured (data/NAV_MATERIAL.json)</h1><table><tr><th>state</th><th>قنديل</th><th>العالم المشترك</th><th>العالم العام</th></tr>${rows}</table>`,
    'The glyph boxes are byte-identical to REST when selection moves and under focus: the Brass footprint does not move with state, as C3 measured for its proof. Under PRESS the glyph\'s own pixels keep the same chromatic count while the E1R ground wash changes the pixels around it. Disabled is not shown: E1R supplies no unavailable expression for a Brass-bearing object and no destination is ever unavailable in this Product.');
});

// ---------------------------------------------------------------------------------------------------------- B04
board('B04', '04-call-rail-variants.png', () => page('04', 'Call Rail — three variants inside the approved direction',
  'Which rail best makes Mic + audio route ONE group and End Call a related but separated terminal — without circles, a full pill, red, Brass or a literal Q? Same call, same moment, three machines. Neutral hairline only; End\'s rank = separation + terminal form + its solid glyph in primary ink.',
  ['A', 'B', 'C'].map((v) => `<div class="row" style="gap:22px;align-items:flex-end"><div style="width:250px"><h1 style="font-size:19px">${v} · ${RAIL_VARIANTS[v].name}${v === RAIL_RECOMMENDED ? '<span class="tag">RECOMMENDED</span>' : ''}</h1><p class="note">${esc(RAIL_VARIANTS[v].note)}</p></div>${railCrop(`rail${v}-call-live-ar`, 1.35, 'Analysis · FOLLOW_LIVE · Arabic')}${railCrop(`rail${v}-conv-call-ar`, 1.35, 'Conversation · same call')}</div>`).join('') +
  `<div class="row">${['A', 'B', 'C'].map((v) => phone(`rail${v}-call-pinned-ar`, `${v} · ${RAIL_VARIANTS[v].name} — in a call, PINNED(14)`, '', 250)).join('')}</div>`,
  'A keys the two pieces into one broken plate (the seam is the cut); B holds them in open trays whose terminal rises only on its outer side (the most restrained, but the trays read as brackets); C removes enclosure entirely (lowest profile, but the group becomes a line of icons again and End loses its terminal). None uses the G3.2 ring or any colour cue.'));

// ---------------------------------------------------------------------------------------------------------- B05
board('B05', '05-call-rail-recommended.png', () => page('05', `Call Rail ${RAIL_RECOMMENDED} “${RAIL_VARIANTS[RAIL_RECOMMENDED].name}” in the real Product`,
  'In the real Live Call surfaces, is the mic readable, the mute state readable without colour, the audio route readable, End Call unmistakable, and does the rail stay one family without taking the world, the temporal floor or the Conversation ↔ Analysis switch?',
  `<div class="row">${phone('rec-call-live', 'Live Call — Analysis-first, FOLLOW_LIVE')}${phone('rec-call-pinned', 'Live Call — Analysis, PINNED(14)')}${phone('rec-conv-call', 'Live Call — «المحادثة» open; the call continues')}${phone('rec-muted', 'Muted + earpiece: the mic is CUT, the speaker body empties and keeps one wave')}${phone('light-conv-call-ar', 'Conversation under system Light — the same rail in the Light palette')}</div>
<div class="row">${railCrop('rec-call-live', 1.6, 'Mic open · speaker route')}${railCrop('rec-muted', 1.6, 'Mic muted · earpiece route — form changes, not colour')}</div>`,
  'Mute is carried by FORM (the slash cuts a band of negative space through the microphone), the speaker route by fill + wave count; End Call is the only solid mark and sits beyond the seam at the END edge. The call line keeps G3.2\'s 64 pt height, so the world floor and the temporal row are untouched (K14 geometry unchanged).'));

// ---------------------------------------------------------------------------------------------------------- B06
board('B06', '06-temporal-spine-variants.png', () => page('06', 'Temporal Spine + Aperture — three variants, the same four temporal states',
  'Which aperture opens time most clearly — committed vs preview distinguishable, never a generic circular thumb, and a Live terminal that can never be read as a Moment? Rows: variant. Columns: FOLLOW_LIVE · PINNED(14) · PINNED(17 = Moment(LH)) · preview of 16 under the finger (committed 14 stays).',
  ['A', 'B', 'C'].map((v) => `<div class="row" style="gap:14px;align-items:flex-start"><div style="width:190px"><h1 style="font-size:19px">${v} · ${SPINE_VARIANTS[v].name}${v === SPINE_RECOMMENDED ? '<span class="tag">RECOMMENDED</span>' : ''}</h1><p class="note">${esc(SPINE_VARIANTS[v].note)}</p></div>` +
    ['follow', 'pinned14', 'pinnedLH', 'preview'].map((s) => tlCrop(`spine${v}-${s}`, 0.98, { follow: 'FOLLOW_LIVE', pinned14: 'PINNED(14)', pinnedLH: 'PINNED(17) — Moment(LH), not Live', preview: 'preview 16 · committed 14' }[s])).join('') + '</div>').join(''),
  'A\'s lens with a core reads as the familiar “eye / visibility” icon — a semantic collision. B\'s gate is clear but reads as a text-selection bracket. C parts the spine itself around the Moment: the line OPENS, which is exactly “opening time at a moment”, and its Live terminal (a stop bar and the present as its own short line) shares no form with it.'));

// ---------------------------------------------------------------------------------------------------------- B07
board('B07', '07-temporal-spine-recommended.png', () => page('07', `Temporal Spine ${SPINE_RECOMMENDED} “${SPINE_VARIANTS[SPINE_RECOMMENDED].name}” through every temporal state`,
  'Does the recommended spine show each state of T-06 / T-07 / the G3 amendment truthfully: FOLLOW_LIVE, PINNED at an older Moment, PINNED at Moment(LH) while clearly not Live, an active scrub, the commit after release, a cancel, Return Live at its one home, and the temporal line above the Timeline?',
  `<div class="row" style="gap:16px">${[['rec-follow', '1 · FOLLOW_LIVE — the terminal is engaged (heavy present line)'], ['rec-pinned14', '2 · PINNED(14) — the spine opens at 14; the line says so above the Track'], ['rec-pinnedLH', '3 · PINNED(17) = Moment(LH) — an opened notch; the terminal stays AVAILABLE'], ['rec-scrub', '4 · Active scrub — the lighter preview opening is under the finger (16); 14 stays committed'],
    ['rec-commit', '5 · After release — committed at 16, settled'], ['rec-cancel', '6 · Cancel (Escape) — the preview returns to 14 and fades; nothing committed'], ['rec-returnlive', '7 · Return Live — the opening closed in place; the terminal engaged'], ['rec-call-pinned', '8 · In a call, PINNED — line, Timeline, OrientationChrome (the call line below: boards 05, 13)']]
    .map(([id, cap]) => tlCrop(id, 1.08, cap)).join('')}</div>`,
  'Geometry under every state: one committed Moment per 48 pt (T-05, unchanged); the interaction band is the 44-pt Track (unchanged); the visible spine is a 1-pt hairline. The Track keeps SP1…SP(LH) while PINNED (T-06) — the G3.2 proof had cut it at the pinned Moment (finding F-P2-01). No floating number (it collided with the Live label at 48-pt pitch; the T-08 line already carries it).'));

// ---------------------------------------------------------------------------------------------------------- B08 / B09
board('B08', '08-arabic-rtl.png', () => page('08', 'Arabic RTL — logical direction, not naïve mirroring',
  'Under RTL, does every directional part follow MEANING: the Track starts at SP1 on the right and the Live edge is on the left (T-06), the rail\'s terminal sits at the END edge, the back chevron mirrors — and do the media, call and world glyphs stay unmirrored?',
  `<div class="row">${phone('rec-call-pinned', 'In a call, PINNED(14)', '', 320)}${phone('rec-scrub', 'Scrubbing 16 — SP1 is on the right, Live on the left', '', 320)}${phone('rec-conv-call', 'Conversation, same call — the reader on the RIGHT (G1.1)', '', 320)}${phone('rec-follow', 'FOLLOW_LIVE', '', 320)}</div>`,
  'Mirrored by meaning: the Track (logical 0 = right), the Live slot (left), the Call Rail\'s art and order (End at the end edge = left), the back chevron. Never mirrored: mic, speaker, handset, replay, play/pause, the world glyphs and the Q (designing-arabic-frontends §6; C3 §7.1). Digits stay Western through the one locale authority (T-12 §9).'));
board('B09', '09-english-ltr.png', () => page('09', 'English LTR — the same Product, the other direction',
  'Does the same system read correctly left-to-right with no second rule: SP1 left, Live right, End at the right end, chevron pointing left?',
  `<div class="row">${phone('en-call-pinned', 'In a call, PINNED(14)', '', 320)}${phone('en-scrub', 'Scrubbing 16', '', 320)}${phone('en-conv-call', 'Conversation, same call', '', 320)}${phone('en-follow', 'FOLLOW_LIVE', '', 320)}</div>`,
  'English Live-edge wording and the Conversation → Analysis label remain OPEN COPY (G3 §G); the proof shows the existing proof strings unchanged.'));

// ---------------------------------------------------------------------------------------------------------- B10
let rasterFiles = null;
async function rasters() {
  if (rasterFiles) return rasterFiles;
  rasterFiles = {};
  const grounds = [['dark World', DK.world, DK.primary, DK.brass], ['dark Surface · rest ink', DK.surface, DK.restInk, DK.brass], ['light World', LT.world, LT.primary, LT.brass], ['light Surface · rest ink', LT.surface, LT.restInk, LT.brass]];
  const set = [...GLYPH_ORDER, ...['close', 'back', 'chevron', 'settings', 'overflow'].map((r) => 'u:' + r)];
  for (const size of [16, 20, 24]) {
    const html = `<!doctype html><style>body{margin:0}</style><body>${grounds.map(([n, bg, ink, brass]) => `<div style="display:flex;background:${bg};height:${size + 12}px;align-items:center">` +
      set.map((g) => `<div style="width:${size + 12}px;display:grid;place-items:center;color:${g.startsWith('nav') ? brass : ink}">${g.startsWith('u:') ? utilSvg(g.slice(2), { size }) : sigSvg(g, { size, id: 'r' + size + n.replace(/\W/g, '') })}</div>`).join('') + '</div>').join('')}</body>`;
    const png = await renderSheet(`raster${size}`, html, { width: set.length * (size + 12), dpr: 1 });
    const p = join(WORK, `raster${size}.png`); writeFileSync(p, png); rasterFiles[size] = { url: pathToFileURL(p).href, w: set.length * (size + 12), h: 4 * (size + 12) };
  }
  rasterFiles.set = set; rasterFiles.grounds = grounds.map((g) => g[0]);
  return rasterFiles;
}
board('B10', '10-legibility-16-20-24.png', async () => {
  const R = await rasters();
  const blk = (size, z) => `<figure><img src="${R[size].url}" style="width:${R[size].w * z}px;height:${R[size].h * z}px;image-rendering:pixelated;display:block;border-radius:6px"><figcaption>${size} px, rendered at 1 device pixel per point, shown ×${z} (nearest-neighbour — the real pixels)<small>rows: ${R.grounds.join(' · ')}</small></figcaption></figure>`;
  return page('10', 'Legibility at 16 / 20 / 24 px — the real rasters',
    'Do the cut, the slash and the waves survive the smallest sizes at one device pixel per point, on the dark and light grounds, and does the utility family hold the same weight at the same size?',
    `<div class="row" style="flex-direction:column;gap:22px">${blk(24, 3)}${blk(20, 3)}${blk(16, 3)}</div><div style="display:flex;gap:0;margin-top:8px">${R.set.map((g) => `<div class="lab" style="width:${36 * 3}px">${g.startsWith('u:') ? g.slice(2) + ' (util)' : g}</div>`).join('')}</div>`,
    'The optical stroke rises as the size falls (1.60 u → 1.75 u → 1.95 u), so the line stays ≥ 1.3 device px at 16 px; the cut is sized so its visible gap stays ≥ 2 u between round caps. At 16 px the Public glyph\'s openings and the route\'s outer wave are at their limit — 16 px is a documented minimum for these two, and navigation uses 24 px only (C3).');
});

// ---------------------------------------------------------------------------------------------------------- B11
function stateCell(label, inner, { bg = DK.surface, ring = false, wash = false, ink = DK.restInk } = {}) {
  return `<div style="width:118px"><div style="position:relative;width:118px;height:84px;background:${bg};border-radius:12px;display:grid;place-items:center">
<div style="position:relative;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:${ink};${wash ? `background:rgba(216,213,202,.1);` : ''}${ring ? `box-shadow:0 0 0 2px ${DK.world},0 0 0 4px ${DK.primary},0 0 0 5px ${DK.world};` : ''}">${inner}</div></div><div class="lab">${label}</div></div>`;
}
board('B11', '11-state-board.png', () => page('11', 'States — each carried by a channel E1R owns, never by colour alone and never by Brass',
  'For each control of the two machines: REST (absence), PRESSED (the ground), FOCUS (a detached perimeter), the toggle states (a change of FORM), DISABLED (one availability ink), and the timeline marks — is every state distinguishable without colour?',
  `<p class="k" style="margin-top:18px">CALL RAIL CONTROLS · dark Surface ${DK.surface}</p><div class="row" style="gap:12px;margin-top:6px">
${stateCell('mic · REST', sigSvg('mic'))}${stateCell('mic · PRESSED', sigSvg('mic'), { wash: true })}${stateCell('mic · FOCUS', sigSvg('mic'), { ring: true })}${stateCell('muted (aria-pressed)', sigSvg('muted', { id: 'st1' }))}${stateCell('mic · DISABLED*', sigSvg('mic'), { ink: '#696762' })}
${stateCell('speaker (pressed=true)', sigSvg('routeOn'))}${stateCell('earpiece (false)', sigSvg('route'))}${stateCell('End · REST', sigSvg('endCall'), { ink: DK.primary })}${stateCell('End · PRESSED', sigSvg('endCall'), { ink: DK.primary, wash: true })}${stateCell('End · FOCUS', sigSvg('endCall'), { ink: DK.primary, ring: true })}</div>
<p class="k" style="margin-top:22px">IN THE PRODUCT</p><div class="row" style="gap:14px;margin-top:6px">${railCrop('focus-mute-ar', 1.3, 'FOCUS on Mute (keyboard)')}${railCrop('press-mute-ar', 1.3, 'PRESSED Mute')}${railCrop('press-end-ar', 1.3, 'PRESSED End Call')}${railCrop('focus-end-ar', 1.3, 'FOCUS on End Call')}</div>
<p class="k" style="margin-top:22px">TIMELINE MARKS</p><div class="row" style="gap:14px;margin-top:6px">${tlCrop('focus-track-ar', 1.0, 'FOCUS on the Track (the slider): perimeter around the 44-pt band')}${tlCrop('focus-live-ar', 1.0, 'FOCUS on Return Live — its box starts at its label row; the line is never covered (G3 amendment §4)')}${tlCrop('rec-scrub', 1.0, 'preview (hairline, 0.72) vs committed (1.5 pt + the Moment\'s mark)')}</div>`,
  '* DISABLED is shown only as E1R\'s availability ink on a neutral control; no call control is disabled in the Product (route is ABSENT while connecting, G1.2). Toggle state is FORM: the slash + cut; the body fill + wave count. The accessible state is aria-pressed with the action name (G1.2 R1: “Mute microphone” / “Unmute microphone”).'));

// ---------------------------------------------------------------------------------------------------------- B12
board('B12', '12-dark-light.png', () => page('12', 'Appearance — Analysis always dark; every other surface follows the resolved appearance',
  'Under the resolved appearance (P1: Dark / Light / System; the proof stands in with the system value), does the family hold on the light Conversation and stay in the dark Analysis shell without a new colour?',
  `<div class="row">${phone('light-conv-call-ar', 'Conversation, Light, in a call')}${phone('light-analysis-call-ar', 'Analysis under Light — the one dark place (G3 amendment)')}${phone('light-conv-ar', 'Conversation, Light, idle — call · mic · Brass rail')}${phone('dark-conv-ar', 'Conversation, Dark, idle')}${phone('light-conv-call-en', 'English, Light, in a call')}</div>`,
  'Light uses F2\'s own tokens: Brass ' + LT.brass + ', ink ' + LT.primary + ' / rest ' + LT.restInk + ', Surface ' + LT.surface + '. No Light repaint of the Analysis and no appearance setting is added by P2 (the preference itself is P1\'s).'));

// ---------------------------------------------------------------------------------------------------------- B13 / B14
board('B13', '13-stress-320x568.png', () => {
  const rm = (id) => SHOTS[id].measured.truth.room;
  return page('13', '320 × 568 — the tightest reviewed case',
    'At the G3 stress size, with a call running and PINNED, do the machines fit without squeezing the world below its 160-pt floor, and do the targets stay 44 pt?',
    `<div class="row">${phone('s320-call-pinned-ar', 'In a call, PINNED(14)', `world floor ${rm('s320-call-pinned-ar').worldFloor} pt · usable ${rm('s320-call-pinned-ar').usable} pt`, 280)}${phone('s320-call-pinned-open-ar', '«طرق العودة» open', '', 280)}${phone('s320-scrub-ar', 'Scrubbing in a call', '', 280)}${phone('s320-call-pinned-en', 'English', '', 280)}${phone('s320-conv-call-ar', 'Conversation, same call', '', 280)}</div>`,
    'At 320 pt the Track shows fewer Moments (the 48-pt pitch is kept; the window holds the rest); the Call Rail keeps its 44-pt targets and 170-pt footprint, leaving the elapsed time on the start side. The heights the G3.2 K14 evidence measured (call line 64 pt, Timeline row 88 pt) are unchanged by P2.');
});
board('B14', '14-sizes-390-430.png', () => page('14', '390 × 844 and 430 × 932 — the same machines, more world',
  'On a mainstream and a large phone, do the rail and the spine keep their size (a larger phone shows MORE of the Track, never a bigger control)?',
  `<div class="row">${phone('rec-call-pinned', '390 × 844 — in a call, PINNED(14)', '', 330)}${phone('s430-call-pinned-ar', '430 × 932 — in a call, PINNED(14)', '', 364)}${phone('s430-follow-en', '430 × 932 — English, FOLLOW_LIVE', '', 364)}</div>`));

// ---------------------------------------------------------------------------------------------------------- B15
board('B15', '15-accessibility-reduced-motion.png', () => {
  const id = 'rec-call-pinned', s = SHOTS[id], b = s.measured.boxes, Z = 1.25;
  const box = (r, c, t) => r ? `<div style="position:absolute;left:${r.x * Z}px;top:${r.y * Z}px;width:${r.w * Z}px;height:${r.h * Z}px;outline:1.5px solid ${c};outline-offset:-1px">${t ? `<span style="position:absolute;top:-15px;left:0;font:10px ui-monospace,Consolas,monospace;color:${c};white-space:nowrap">${t}</span>` : ''}</div>` : '';
  const tr = b['tl-track'], steps = [];
  // one dashed cell per committed Moment in view: centred on the page-measured position of each Session Position, 48 pt wide
  for (const p of b.sps || []) steps.push(`<div style="position:absolute;left:${(p.x - 24) * Z}px;top:${tr.y * Z}px;width:${48 * Z}px;height:${tr.h * Z}px;border:1px dashed #6fb6c8;border-radius:3px;opacity:.75"><span style="position:absolute;bottom:-14px;left:0;width:100%;text-align:center;font:9px ui-monospace,Consolas,monospace;color:#6fb6c8">SP${p.sp}</span></div>`);
  const order = s.measured.focusOrder.map((f, i) => f.box ? `<div style="position:absolute;left:${(f.box.x + f.box.w / 2) * Z - 9}px;top:${(f.box.y + f.box.h / 2) * Z - 9}px;width:18px;height:18px;border-radius:9px;background:#e0b650;color:#101010;font:700 10px/18px ui-monospace,Consolas,monospace;text-align:center">${i + 1}</div>` : '').join('');
  const overlay = `<figure><div class="ph" style="position:relative;width:${s.w * Z}px;height:${s.h * Z}px;overflow:visible"><img src="${shot(id)}" style="width:${s.w * Z}px;display:block;border-radius:30px">
${steps.join('')}${box(tr, '#6fb6c8', 'Track · 44 pt band · 48 pt per Moment')}${['mute', 'route', 'end-call', 'tl-live', 'back', 'replay'].map((k) => box(b[k], '#e0b650', `${k} ${Math.round(b[k]?.w)}×${Math.round(b[k]?.h)}`)).join('')}${order}</div>
<figcaption>Targets (amber), the 44-pt band and 48-pt steps (cyan), focus order (numbers) = visual order<small>${id} · measured from the page</small></figcaption></figure>`;
  const list = s.measured.focusOrder.map((f, i) => `<tr><td>${i + 1}</td><td>${esc(f.id)}</td><td dir="auto">${esc(f.name || '')}</td><td>${f.box ? `${Math.round(f.box.w)}×${Math.round(f.box.h)}` : ''}</td></tr>`).join('');
  return page('15', 'Accessibility and Reduced Motion — evidence',
    'Are the targets ≥ 44 pt, the focus order equal to the visual order, every icon-only control named by its control (the glyph decorative), and does Reduced Motion keep the same truth with the movement removed?',
    `<div class="row" style="gap:30px">${overlay}<div><table><tr><th>#</th><th>control</th><th>accessible name</th><th>box pt</th></tr>${list}</table></div></div>
<div class="row">${phone('rm-call-pinned-ar', 'Reduced Motion — same state, same marks', '', 300)}${phone('rm-scrub-ar', 'Reduced Motion — scrub: still 1:1 under the finger', '', 300)}${tlCrop('focus-track-ar', 1.1, 'Keyboard route: focus the Track, ← → preview, Enter commits, Escape cancels (no drag needed, T-06)')}</div>`,
    'Every glyph is aria-hidden; each control carries the name (fixing-accessibility §1). The Track is role="slider" with T-08\'s words as its value text. Motion evidence: motion/*.mp4 with frame truth in data/motion/ — the preview aperture sits within 0.04 pt of the finger in every held frame of M04 / M04r.');
});

// ---------------------------------------------------------------------------------------------------------- run
mkdirSync(join(PKG, 'boards'), { recursive: true });
const record = (() => { try { return JSON.parse(readFileSync(join(PKG, 'data', 'BOARDS.json'), 'utf8')); } catch { return {}; } })();
for (const b of boards) {
  if (only && !only.includes(b.id)) continue;
  const html = await b.fn();
  const png = await renderSheet(b.id, html, { width: 1900, dpr: 1 });
  writeFileSync(join(PKG, 'boards', b.file), png);
  record[b.id] = { file: `boards/${b.file}`, bytes: png.length, sha256: sha(png), question: (html.match(/<p class="q">([\s\S]*?)<\/p>/) || [])[1]?.replace(/<[^>]+>/g, '') };
  console.log('board', b.id, png.length);
}
writeFileSync(join(PKG, 'data', 'BOARDS.json'), JSON.stringify(record, null, 1));
await closeSheetBrowser();
