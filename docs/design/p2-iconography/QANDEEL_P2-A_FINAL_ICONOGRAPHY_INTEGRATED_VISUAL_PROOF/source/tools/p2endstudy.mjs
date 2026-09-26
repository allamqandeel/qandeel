// P2-A refinement — the End Call glyph-presence study, MEASURED from the Product captures (tools/p2capture.mjs shots
// end<px>-*), never from the drawing's nominal size.
//   node tools/p2endstudy.mjs   → data/END_CALL_STUDY.json
//
// The accepted Call Rail A is not redesigned: only the End glyph's render size varies (24 = the reviewed proof; 26 /
// 27 / 28 = the Product Owner's study sizes). The criteria below were written BEFORE the numbers were read, and the
// selection rule is the task's: 27 px unless measured evidence gives a clear reason for 26 or 28.
//
// Per capture and per control (End, Mic, Route), inside the control's page-measured 44 × 44 target:
//   window   = the target inset by 6 pt (the plate's corner hairlines cross the target's outer corners; see measure());
//   ground   = the median colour of a 2 × 8 pt sample just inside the target's START side at mid-height (inside the
//              press wash when pressed; the glyphs never reach it);
//   ΔL       = |luma(pixel) − luma(ground)| (Rec. 709 luma on the sRGB bytes);
//   weight   = Σ ΔL / 255 per pixel, in pt² — the glyph's CONTRAST-WEIGHTED ink (what the eye weighs: area × contrast);
//   ink box  = the bounding box of the pixels whose ΔL ≥ 50 % of the control's own full-ink ΔL (99th percentile).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { WORK, PKG } from './lib/session.mjs';
import { decode } from './lib/png.mjs';
import { END_GLYPH_STUDY, END_GLYPH_PX } from '../src/machines.mjs';

const SHOTS = JSON.parse(readFileSync(join(PKG, 'data', 'SHOTS.json'), 'utf8'));
const KINDS = { 'live-ar': 'Analysis, in a call, Arabic (End at the left END edge)', 'live-en': 'Analysis, in a call, English (End at the right END edge)', 's320-ar': '320 × 568, in a call, PINNED', 'focus-ar': 'keyboard FOCUS on End Call', 'press-ar': 'PRESSED End Call (the E1R ground wash)', 'light-ar': 'Conversation, same call, system Light' };
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const r2 = (v) => +v.toFixed(2);

function measure(id, ctl) {
  const s = SHOTS[id], b = s.measured.boxes[ctl], img = decode(readFileSync(join(WORK, 'shots', id + '.png'))), k = img.width / s.w;
  const px = (x, y) => { const i = (Math.round(y) * img.width + Math.round(x)) * 4; return [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]]; };
  // the ground: just inside the START side (physical left in English, right in Arabic), mid-height
  const startLeft = s.lang === 'en';
  const gx0 = startLeft ? b.x + 1 : b.x + b.w - 3, samples = [];
  for (let y = (b.y + 18) * k; y < (b.y + 26) * k; y++) for (let x = gx0 * k; x < (gx0 + 2) * k; x++) samples.push(luma(...px(x, y)));
  samples.sort((a, c) => a - c);
  const L0 = samples[samples.length >> 1];
  // the ink window: the target inset by 6 pt. The rail art's hairlines (the plate's rounded corners, the seam) cross
  // the target's outer corners and are NOT the glyph; they never enter this window, and every study glyph fits in it.
  const IN = 6, wx0 = Math.round((b.x + IN) * k), wx1 = Math.round((b.x + b.w - IN) * k), wy0 = Math.round((b.y + IN) * k), wy1 = Math.round((b.y + b.h - IN) * k);
  const d = [];
  for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) d.push([x, y, Math.abs(luma(...px(x, y)) - L0)]);
  const sorted = d.map((p) => p[2]).sort((a, c) => a - c), full = sorted[Math.floor(sorted.length * 0.99)];
  let W = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (const [x, y, v] of d) { W += v / 255; if (v >= full * 0.5) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
  const ink = { x: r2(x0 / k), y: r2(y0 / k), w: r2((x1 + 1 - x0) / k), h: r2((y1 + 1 - y0) / k) };
  const margin = r2(Math.min(ink.x - b.x, ink.y - b.y, b.x + b.w - (ink.x + ink.w), b.y + b.h - (ink.y + ink.h)));
  // the raw bytes of the target, for the AR ↔ EN identity test
  const bytes = []; for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) bytes.push(...px(x, y));
  const inkWindowFree = ink.w < b.w - 2 * IN - 1 && ink.h < b.h - 2 * IN - 1;   // the glyph did not run into the window's edge
  return { weight: r2(W / (k * k)), fullInkDeltaL: r2(full), groundLuma: r2(L0), ink, marginToTarget: margin, inkWindowFree, target: b, sha256: createHash('sha256').update(Buffer.from(bytes)).digest('hex').slice(0, 16) };
}

const bySize = {};
for (const px of END_GLYPH_STUDY) {
  const row = { px, shots: {} };
  for (const kind of Object.keys(KINDS)) {
    const id = `end${px}-${kind}`, m = SHOTS[id].measured;
    row.shots[kind] = { id, endPxInPage: +m.boxes.endPx, end: measure(id, 'end-call'), geometry: { endTarget: m.boxes['end-call'], terminalPlate: m.boxes.cr_term, groupPlate: m.boxes.cr_group, micGlyph: m.boxes.g_mute, routeGlyph: m.boxes.g_route } };
    if (kind === 'live-ar' || kind === 'live-en' || kind === 'light-ar') { row.shots[kind].mic = measure(id, 'mute'); row.shots[kind].route = measure(id, 'route'); }
  }
  bySize[px] = row;
}

// ------------------------------------------------------------------------------------------------ the criteria
const base = bySize[24];
const C = {
  H1: 'the target, the terminal plate, the group plate and the Mic / Route glyph boxes are identical to the 24-px proof in every capture (no rail redesign, no spacing change)',
  H2: 'the End ink stays inside its 44-pt target with ≥ 8 pt clear on every side, at rest, focused and pressed (the wash\'s 12-pt corners and the 2-pt focus perimeter frame the glyph, never touch it)',
  H3: 'visibly stronger than the 24-px proof: End\'s contrast-weighted ink ≥ 1.10 × its 24-px value (Arabic, Analysis)',
  H4: 'balanced in the machine: End weighs at least as much as its heaviest neighbour (Mic or Route) and no more than the two together — unmistakably the terminal, still subordinate to the whole rail (Arabic, English and Light)',
  H5: 'not a hero icon: End\'s ink width ≤ 22 pt (half its target)',
  H6: 'direction by meaning: the End target\'s pixels are byte-identical in Arabic and English (never mirrored, no direction-dependent drawing)',
  H7: 'state is the ground and the perimeter, not the glyph: the ink box under FOCUS and under PRESS equals REST\'s',
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const verdict = {};
for (const px of END_GLYPH_STUDY) {
  const r = bySize[px], S = r.shots, v = {};
  const geo = Object.keys(KINDS).every((k) => { const a = S[k].geometry, z = base.shots[k].geometry; return eq(a.endTarget, z.endTarget) && eq(a.terminalPlate, z.terminalPlate) && eq(a.groupPlate, z.groupPlate) && eq(a.micGlyph, z.micGlyph) && eq(a.routeGlyph, z.routeGlyph); });
  v.H1 = { pass: geo, detail: geo ? 'identical in all six captures' : 'geometry moved' };
  const minM = Math.min(...Object.keys(KINDS).map((k) => S[k].end.marginToTarget)), free = Object.keys(KINDS).every((k) => S[k].end.inkWindowFree);
  v.H2 = { pass: minM >= 8 && free, detail: `minimum clearance ${minM} pt${free ? '' : ' (the ink reached the measurement window: clearance is not proved)'}` };
  const ratio = r2(S['live-ar'].end.weight / base.shots['live-ar'].end.weight);
  v.H3 = { pass: ratio >= 1.10, detail: `${ratio} × the 24-px weight` };
  const bal = ['live-ar', 'live-en', 'light-ar'].map((k) => { const e = S[k].end.weight, m = S[k].mic.weight, ro = S[k].route.weight; return { k, end: e, mic: m, route: ro, lo: e >= Math.max(m, ro), hi: e <= m + ro }; });
  v.H4 = { pass: bal.every((x) => x.lo && x.hi), detail: bal.map((x) => `${x.k}: End ${x.end} · Mic ${x.mic} · Route ${x.route} pt² → ${x.lo ? '≥ heaviest' : 'LIGHTER than a neighbour'}, ${x.hi ? '≤ group' : 'HEAVIER than the group'}`).join('; ') };
  const w = S['live-ar'].end.ink.w;
  v.H5 = { pass: w <= 22, detail: `ink ${w} × ${S['live-ar'].end.ink.h} pt` };
  v.H6 = { pass: S['live-ar'].end.sha256 === S['live-en'].end.sha256, detail: `AR ${S['live-ar'].end.sha256} · EN ${S['live-en'].end.sha256}` };
  const rest = S['live-ar'].end.ink, same = (k) => eq(S[k].end.ink, rest);
  v.H7 = { pass: same('focus-ar') && same('press-ar'), detail: `rest ${JSON.stringify(rest)}; focus ${same('focus-ar') ? 'same' : JSON.stringify(S['focus-ar'].end.ink)}; press ${same('press-ar') ? 'same' : JSON.stringify(S['press-ar'].end.ink)}` };
  verdict[px] = v;
}
const passes = (px) => Object.values(verdict[px]).every((c) => c.pass);
const candidates = [26, 27, 28];
// the task's rule: 27 unless 27 fails a criterion that 26 or 28 meets
let selected = 27, reason;
if (passes(27)) reason = '27 px meets every criterion, so the task\'s default stands; no measurement gives a clear reason for 26 or 28';
else { const alt = candidates.filter((p) => p !== 27 && passes(p)); selected = alt[0] ?? 27; reason = alt.length ? `27 px fails ${Object.entries(verdict[27]).filter(([, c]) => !c.pass).map(([k]) => k).join(', ')}; ${selected} px meets every criterion` : '27 px fails and no study size meets every criterion'; }

const out = {
  generated: 'tools/p2endstudy.mjs', method: 'see the file header', criteria: C, studySizes: END_GLYPH_STUDY, productSize: END_GLYPH_PX,
  selected, selectionRule: 'task §4: choose 27 px unless measured proof shows a clear optical reason for 26 or 28', reason,
  verdict, summary: Object.fromEntries(END_GLYPH_STUDY.map((px) => [px, { allPass: passes(px), endWeightAr: bySize[px].shots['live-ar'].end.weight, micWeightAr: bySize[px].shots['live-ar'].mic.weight, routeWeightAr: bySize[px].shots['live-ar'].route.weight, inkAr: bySize[px].shots['live-ar'].end.ink, minClearance: Math.min(...Object.keys(KINDS).map((k) => bySize[px].shots[k].end.marginToTarget)) }])),
  captures: KINDS, bySize,
};
writeFileSync(join(PKG, 'data', 'END_CALL_STUDY.json'), JSON.stringify(out, null, 1));
for (const px of END_GLYPH_STUDY) console.log(px, passes(px) ? 'ALL PASS' : 'fails ' + Object.entries(verdict[px]).filter(([, c]) => !c.pass).map(([k]) => k).join(','), JSON.stringify(out.summary[px]));
for (const px of END_GLYPH_STUDY) console.log(px, 'H4', verdict[px].H4.detail);
console.log('selected', selected, '—', reason);
if (selected !== END_GLYPH_PX) { console.log(`MISMATCH: the Product size END_GLYPH_PX = ${END_GLYPH_PX} but the study selects ${selected}`); process.exitCode = 1; }
