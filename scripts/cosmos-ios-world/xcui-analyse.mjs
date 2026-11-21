// COSMOS-INT-01 Slice E (PO, 2026-11-18; BG-10): turn the native XCUITest run into PASS / FAIL / NOT TESTED rows of the
// World gate's results.tsv.
//   - one row per test in CosmosWorldGestureUITests (`X:<test>`), from the xcodebuild log; a test that did not run is
//     NOT TESTED, never PASS;
//   - X-ANCHOR: the double tap / pinch round trip (testPersonalDoubleTapAndPinchStepAboutTheirFingers). If both steps
//     keep the world point under the fingers, every first-depth node moves by (7/8)(c - f); measured on node cores
//     matched by halo hue on `trip-p-before` / `trip-p-after`;
//   - X-PAN-AFTER-PINCH: the drag after the pinch round trip moves the world by the drag (`pan-p-before` / `pan-p-after`);
//   - X-PAN-ZOOMED: the drag while the stage is zoomed in (one step IN) moves the world by the drag (`pan-z-before` /
//     `pan-z-after`). A step IN magnifies eight times, so ONE mark is in view by construction: one matched core suffices
//     there, but its identity is checked on the cores found BEFORE the one-per-hue reduction (which would hide a rival):
//     in each frame it must be the only in-band core within 20° of its hue (the reduction's own satellite radius), it
//     must be a node core of at least 12 pixels (twice the detector's 6-pixel floor: recorded static specks and stars
//     are 6 px, node cores 15-140 px, the zoomed mark core 20 px), and its size must agree between the frames (0.5x-2x).
//     No core inside a fixed overlay counts: the test records the overlays' frames next to each screenshot
//     (`pan-z-overlays-before` / `-after`), and without them the case is NOT TESTED. Same tolerance as X-PAN.
//     PO decision 2026-11-21 (option 1): when no unambiguous core exists (one mark whose beads share a hue, iPhone SE), a
//     constellation of at least three node cores that move by ONE rigid shift, found without the expected drag and
//     unique, is measured instead (`constellation` below). Otherwise NOT TESTED.
//   - D-3 (PO 2026-11-18, contract §24): the values the D-3 tests measure (`sefu1-timing`, `sefu2-card`,
//     `layout-gate`) are appended to their test's row as recorded evidence; they are not judged here.
//   - D-3 CP4 (PO review 2026-11-19, contract §26), two demonstrated harness faults:
//       * the screen width (points) comes from the World gate's Maestro step. In gate 44430083077 the Maestro driver
//         never became ready, so the width was 0 and the three shift cases were NOT TESTED although their screenshots
//         existed. Without a width argument, the width that the layout test recorded (`layout-gate`: "screen WxH") is used.
//       * the shift cases match node cores by hue, and a pan or anchor step moves the world rigidly. In gate 44430083077
//         X-PAN-AFTER-PINCH paired a red core leaving the frame with a different red core entering it (+224,-162 against
//         -106,0 for the three other pairs). In the hue-only cases, with three or more pairs, a pair whose shift is more
//         than three tolerances from the median of the OTHER pairs is a hue mismatch. It is reported and excluded, and
//         at least the case's minimum of consistent pairs must remain. The tolerances and the verdict are unchanged. A
//         world that does not move rigidly cannot pass this way: the median of the remaining pairs is still judged.
// usage: node xcui-analyse.mjs <xcodebuild.log> <exported attachments dir[,dir…]> <widthPoints> <results.tsv>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [logFile, dir, wptArg, resultsFile] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
const rows = [];
const result = (c, r, d) => rows.push(`${c}\t${r}\t${d.replace(/[\t\n]+/g, ' ')}`);

// ── the tests ─────────────────────────────────────────────────────────────────────────────────────────────────────
const swift = fs.readFileSync(path.join(here, 'xcuitest', 'CosmosWorldGestureUITests.swift'), 'utf8');
const tests = [...swift.matchAll(/func (test\w+)\(\)/g)].map((m) => m[1]);
const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
// A targeted run (XCUI_SELECTED = space-separated test names) says which tests it left out on purpose.
const selected = process.env.XCUI_SELECTED ? new Set(process.env.XCUI_SELECTED.split(/\s+/).filter(Boolean)) : null;
for (const t of tests) {
  // both the classic `Test Case '-[Module.Class test]'` and the newer `Test case 'Class.test()'` log forms
  const outcome = new RegExp(`Test [Cc]ase '(?:-\\[\\S+ ${t}\\]|\\S*\\.${t}\\(\\))' (passed|failed|skipped)`).exec(log)?.[1];
  const why = new RegExp(`error: -\\[\\S+ ${t}\\] : ([^\\n]+)`).exec(log)?.[1] ?? '';
  const skip = new RegExp(`-\\[\\S+ ${t}\\] : Test skipped[^\\n]*?- ([^\\n]+)`).exec(log)?.[1] ?? '';
  if (outcome === 'passed') result(`X:${t}`, 'PASS', 'native XCUITest passed');
  else if (outcome === 'failed') result(`X:${t}`, 'FAIL', why || 'native XCUITest failed');
  else if (outcome === 'skipped') result(`X:${t}`, 'NOT TESTED', `skipped: ${skip || 'see the log'}`);
  else if (selected && !selected.has(t)) result(`X:${t}`, 'NOT TESTED', 'not selected in this targeted run');
  else result(`X:${t}`, 'NOT TESTED', 'the test did not run');
}

// ── the screenshots ───────────────────────────────────────────────────────────────────────────────────────────────
const files = new Map();
for (const d of String(dir).split(',').filter(Boolean)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8'));
    for (const test of manifest) {
      for (const a of test.attachments ?? []) {
        // `suggestedHumanReadableName` is "<name>_<n>_<UUID>.<ext>"; the name given in the test is what is kept.
        const name = String(a.suggestedHumanReadableName ?? '').replace(/_\d+_[0-9A-F-]{36}\.\w+$/i, '').replace(/\.\w+$/, '');
        files.set(name, path.join(d, a.exportedFileName));
      }
    }
  } catch { /* no attachments there: the cases below that need them are NOT TESTED */ }
}
const text = (name) => (files.has(name) ? fs.readFileSync(files.get(name), 'utf8').trim() : null);
// D-3 (and COSMOS-FINAL-01 O-1, O-2): the measured values, appended to their test's row.
for (const [t, name] of [['testFreshInstallFirstVisibleDoorTapOpensTheAnalysis', 'sefu1-timing'],
  ['testPersonalDeeperBeadsTheRailLineAndTheCardPassTheirTouchToTheStage', 'sefu2-card'], ['testLayoutAtTheReadersTextSize', 'layout-gate'],
  ['testPublicSearchExecutedWhileTheSectionListIsOpenShowsItsAnswer', 'o1'],
  ['testPublicPendingEntryShowsALoadingIndicationAndKeepsTheWorldNavigation', 'o2']]) {
  const i = rows.findIndex((r) => r.startsWith(`X:${t}\t`));
  const v = text(name);
  if (i >= 0 && v !== null) rows[i] += `; ${v.replace(/[\t\n]+/g, ' ')}`;
}
const WPT = Number(wptArg) || Number(/^screen (\d+)x\d+/m.exec(text('layout-gate') ?? '')?.[1]) || 0;
// Node cores inside the Personal stage only: below its control row and above its timeline rail (iPhone 17 points).
const STAGE_TOP = 165, STAGE_BOTTOM = 730;
// Fixed overlays recorded by the test ("id=x,y,w,h;…", points); a core within 6 pt of one (its halo) is not the world's.
const overlaysOf = (name) => {
  const t = text(name);
  if (t === null) return null;
  return t.split(';').filter(Boolean).map((s) => s.split('=').pop().split(',').map(Number)).filter((r) => r.length === 4 && r.every(Number.isFinite));
};
const outside = (rects) => (c) => !rects.some(([x, y, w, h]) => c.x >= x - 6 && c.x <= x + w + 6 && c.y >= y - 6 && c.y <= y + h + 6);
// Every in-band core outside the given overlays, before the one-per-hue reduction in `cores`.
const rawCores = (name, rects = []) => {
  if (!files.has(name) || !WPT) return null;
  const out = execFileSync(process.execPath, [path.join(here, 'nodes.mjs'), '--all', files.get(name), String(WPT)], { encoding: 'utf8' }).trim();
  if (out === 'none') return [];
  return out.split(/\s+/).map((s) => { const [h, rest] = s.split('@'); const [x, y, n] = rest.split(',').map(Number); return { h: Number(h), x, y, n }; })
    .filter((c) => c.y >= STAGE_TOP && c.y <= STAGE_BOTTOM).filter(outside(rects)).sort((a, b) => b.n - a.n);
};
const cores = (name, rects = []) => {
  const all = rawCores(name, rects);
  if (all === null) return null;
  // One core per hue: the largest; a smaller core within 20° of a kept one is its satellite, never a second identity.
  const kept = [];
  for (const c of all) if (!kept.some((k) => hueDiff(k.h, c.h) <= 20)) kept.push(c);
  return kept;
};
const hueDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
// Mutual best hue matches within 15°.
const pairs = (A, B) => A.flatMap((a) => {
  const b = [...B].sort((p, q) => hueDiff(a.h, p.h) - hueDiff(a.h, q.h))[0];
  if (!b || hueDiff(a.h, b.h) > 15) return [];
  const back = [...A].sort((p, q) => hueDiff(b.h, p.h) - hueDiff(b.h, q.h))[0];
  return back === a ? [{ a, b, dx: b.x - a.x, dy: b.y - a.y }] : [];
});
const median = (v) => { const s = [...v].sort((p, q) => p - q); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
// X-PAN-ZOOMED's second identity (PO decision 2026-11-21, option 1), used only when no unambiguous core exists — a mark
// whose beads share one hue (iPhone SE: one Thread, five green beads). A CONSTELLATION of at least three distinct node
// cores that move together by ONE rigid shift. The shift is found from the frames alone; the expected drag never chooses
// a core or a shift: every pair of hue-compatible (≤15°), same-size (0.5x-2x), node (≥12 px) cores proposes a shift, each
// proposal is supported by the cores that land within EPS points of it one-to-one, and the best-supported proposal must be
// unique (no rival shift more than 2·EPS away is supported by three cores, or by as many as the best). Fewer than three cores, or a tie: NOT TESTED. Only then
// is the measured shift judged against the drag, with the case's own tolerance (unchanged).
const EPS = 6;
const constellation = (A, B) => {
  const fits = (a, b) => hueDiff(a.h, b.h) <= 15 && a.n >= 12 && b.n >= 12 && b.n >= 0.5 * a.n && b.n <= 2 * a.n;
  const support = (s) => {
    const used = new Set(), P = [];
    for (const a of A) {
      const b = B.filter((c) => !used.has(c) && fits(a, c) && Math.hypot(c.x - a.x - s.dx, c.y - a.y - s.dy) <= EPS)
        .sort((p, q) => Math.hypot(p.x - a.x - s.dx, p.y - a.y - s.dy) - Math.hypot(q.x - a.x - s.dx, q.y - a.y - s.dy))[0];
      if (b) { used.add(b); P.push({ a, b, dx: b.x - a.x, dy: b.y - a.y }); }
    }
    return P;
  };
  const proposals = A.flatMap((a) => B.filter((b) => fits(a, b)).map((b) => ({ dx: b.x - a.x, dy: b.y - a.y })));
  const scored = proposals.map((s) => {
    const first = support(s);
    const refined = first.length ? { dx: median(first.map((p) => p.dx)), dy: median(first.map((p) => p.dy)) } : s;
    return { s: refined, P: support(refined) };
  }).sort((p, q) => q.P.length - p.P.length);
  const best = scored[0];
  if (!best) return { P: [], why: 'no hue-compatible node cores in both frames' };
  const rival = scored.find((r) => Math.hypot(r.s.dx - best.s.dx, r.s.dy - best.s.dy) > 2 * EPS && r.P.length >= Math.min(3, best.P.length));
  if (rival) return { P: [], why: `a second rigid shift is also supported (${best.P.length} cores at ${best.s.dx.toFixed(0)},${best.s.dy.toFixed(0)} and at ${rival.s.dx.toFixed(0)},${rival.s.dy.toFixed(0)})` };
  return { P: best.P, why: '' };
};

const shiftCase = (id, before, after, expected, tolerance, { minPairs = 2, unambiguous = false, overlays = null, constellationFallback = false } = {}) => {
  const OA = overlays?.before ?? [], OB = overlays?.after ?? [];
  const A = cores(before, OA), B = cores(after, OB);
  if (A === null || B === null) return result(id, 'NOT TESTED', `no ${A === null ? before : after} screenshot`);
  // `unambiguous`: judged on the cores BEFORE the one-per-hue reduction. A pair counts only if each of its cores is the
  // only core within 20° of its hue in its own frame, both are node cores (at least 12 pixels, not a 6-pixel speck), and
  // the two cores' sizes agree (0.5x-2x pixels).
  const RA = unambiguous ? rawCores(before, OA) : null, RB = unambiguous ? rawCores(after, OB) : null;
  const alone = (S, c) => S.filter((o) => hueDiff(o.h, c.h) <= 20).length === 1;
  const node = (p) => p.a.n >= 12 && p.b.n >= 12;
  const sameSize = (p) => p.b.n >= 0.5 * p.a.n && p.b.n <= 2 * p.a.n;
  const all = pairs(A, B).filter((p) => !unambiguous || (alone(RA, p.a) && alone(RB, p.b) && node(p) && sameSize(p)));
  // Hue mismatches (hue-only cases): a pair far from the rigid shift of the others is not one world point.
  const others = (p) => ({ dx: median(all.filter((o) => o !== p).map((o) => o.dx)), dy: median(all.filter((o) => o !== p).map((o) => o.dy)) });
  const mismatch = (p) => !unambiguous && all.length >= 3 && Math.hypot(p.dx - others(p).dx, p.dy - others(p).dy) > 3 * tolerance;
  const P = all.filter((p) => !mismatch(p));
  const dropped = all.filter(mismatch).map((p) => `${p.a.h}@${p.a.x},${p.a.y}->${p.b.x},${p.b.y}`).join(' ');
  const seen = P.map((p) => `${p.a.h}@${p.a.x},${p.a.y}->${p.b.x},${p.b.y}`).join(' ') + (dropped ? `; excluded as hue mismatches: ${dropped}` : '');
  const judge = (Q, how, list) => {
    const m = { dx: median(Q.map((p) => p.dx)), dy: median(Q.map((p) => p.dy)) };
    const off = (p) => Math.hypot(p.dx - expected.dx, p.dy - expected.dy);
    const worst = Math.max(...Q.map(off));
    const detail = `expected shift ${expected.dx.toFixed(0)},${expected.dy.toFixed(0)}; measured median ${m.dx.toFixed(0)},${m.dy.toFixed(0)}; worst pair off by ${worst.toFixed(0)} pt; ${how}${Q.length} pairs: ${list}`;
    result(id, off(m) <= tolerance && worst <= tolerance * 1.5 ? 'PASS' : 'FAIL', detail);
  };
  if (P.length >= minPairs) return judge(P, '', seen);
  const short = `fewer than ${minPairs === 1 ? 'one' : 'two'} ${unambiguous ? 'unambiguous ' : ''}node cores matched by hue (${P.length}: ${seen || 'none'})`;
  if (!constellationFallback) return result(id, 'NOT TESTED', short);
  const C = constellation(RA ?? rawCores(before, OA), RB ?? rawCores(after, OB));
  const list = C.P.map((p) => `${p.a.h}@${p.a.x},${p.a.y}->${p.b.x},${p.b.y}`).join(' ');
  if (C.P.length < 3) return result(id, 'NOT TESTED', `${short}; no constellation of three node cores moving by one rigid shift (${C.why || `${C.P.length}: ${list || 'none'}`})`);
  judge(C.P, 'a constellation of ', list);
};

const trip = text('trip-p-spec');
if (trip === null) result('X-ANCHOR', 'NOT TESTED', 'the round trip did not record its spec');
else {
  const [fx, fy, cx, cy] = trip.split(',').map(Number);
  shiftCase('X-ANCHOR', 'trip-p-before', 'trip-p-after', { dx: (7 / 8) * (cx - fx), dy: (7 / 8) * (cy - fy) }, 20);
}
const pan = text('pan-p-spec');
if (pan === null) result('X-PAN-AFTER-PINCH', 'NOT TESTED', 'the pan did not record its spec');
else {
  const [dx, dy] = pan.split(',').map(Number);
  shiftCase('X-PAN-AFTER-PINCH', 'pan-p-before', 'pan-p-after', { dx, dy }, Math.max(20, 0.25 * Math.hypot(dx, dy)));
}
const zoomed = text('pan-z-spec');
if (zoomed === null) result('X-PAN-ZOOMED', 'NOT TESTED', 'the zoomed pan did not record its spec');
else {
  const [dx, dy] = zoomed.split(',').map(Number);
  const ob = overlaysOf('pan-z-overlays-before'), oa = overlaysOf('pan-z-overlays-after');
  if (ob === null || oa === null) result('X-PAN-ZOOMED', 'NOT TESTED', "the fixed overlays' frames were not recorded, so no feature can be trusted as the world's");
  else shiftCase('X-PAN-ZOOMED', 'pan-z-before', 'pan-z-after', { dx, dy }, Math.max(20, 0.25 * Math.hypot(dx, dy)), { minPairs: 1, unambiguous: true, overlays: { before: ob, after: oa }, constellationFallback: true });
}

fs.appendFileSync(resultsFile, `${rows.join('\n')}\n`);
console.log(rows.join('\n'));
