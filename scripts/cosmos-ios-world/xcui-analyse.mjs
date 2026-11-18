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
//     are 6 px, node cores 15-140 px, the zoomed mark core 20 px), and its size must agree between the frames (0.5x-2x);
//     otherwise NOT TESTED. Same tolerance as X-PAN.
// usage: node xcui-analyse.mjs <xcodebuild.log> <exported attachments dir> <widthPoints> <results.tsv>
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
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  for (const test of manifest) {
    for (const a of test.attachments ?? []) {
      // `suggestedHumanReadableName` is "<name>_<n>_<UUID>.<ext>"; the name given in the test is what is kept.
      const name = String(a.suggestedHumanReadableName ?? '').replace(/_\d+_[0-9A-F-]{36}\.\w+$/i, '').replace(/\.\w+$/, '');
      files.set(name, path.join(dir, a.exportedFileName));
    }
  }
} catch { /* no attachments: the cases below are NOT TESTED */ }
const text = (name) => (files.has(name) ? fs.readFileSync(files.get(name), 'utf8').trim() : null);
const WPT = Number(wptArg) || 0;
// Node cores inside the Personal stage only: below its control row and above its timeline rail (iPhone 17 points).
const STAGE_TOP = 165, STAGE_BOTTOM = 730;
// Every in-band core, before the one-per-hue reduction in `cores`.
const rawCores = (name) => {
  if (!files.has(name) || !WPT) return null;
  const out = execFileSync(process.execPath, [path.join(here, 'nodes.mjs'), '--all', files.get(name), String(WPT)], { encoding: 'utf8' }).trim();
  if (out === 'none') return [];
  return out.split(/\s+/).map((s) => { const [h, rest] = s.split('@'); const [x, y, n] = rest.split(',').map(Number); return { h: Number(h), x, y, n }; })
    .filter((c) => c.y >= STAGE_TOP && c.y <= STAGE_BOTTOM).sort((a, b) => b.n - a.n);
};
const cores = (name) => {
  const all = rawCores(name);
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
const shiftCase = (id, before, after, expected, tolerance, { minPairs = 2, unambiguous = false } = {}) => {
  const A = cores(before), B = cores(after);
  if (A === null || B === null) return result(id, 'NOT TESTED', `no ${A === null ? before : after} screenshot`);
  // `unambiguous`: judged on the cores BEFORE the one-per-hue reduction. A pair counts only if each of its cores is the
  // only core within 20° of its hue in its own frame, both are node cores (at least 12 pixels, not a 6-pixel speck), and
  // the two cores' sizes agree (0.5x-2x pixels).
  const RA = unambiguous ? rawCores(before) : null, RB = unambiguous ? rawCores(after) : null;
  const alone = (S, c) => S.filter((o) => hueDiff(o.h, c.h) <= 20).length === 1;
  const node = (p) => p.a.n >= 12 && p.b.n >= 12;
  const sameSize = (p) => p.b.n >= 0.5 * p.a.n && p.b.n <= 2 * p.a.n;
  const P = pairs(A, B).filter((p) => !unambiguous || (alone(RA, p.a) && alone(RB, p.b) && node(p) && sameSize(p)));
  const seen = P.map((p) => `${p.a.h}@${p.a.x},${p.a.y}->${p.b.x},${p.b.y}`).join(' ');
  if (P.length < minPairs) return result(id, 'NOT TESTED', `fewer than ${minPairs === 1 ? 'one' : 'two'} ${unambiguous ? 'unambiguous ' : ''}node cores matched by hue (${P.length}: ${seen || 'none'})`);
  const m = { dx: median(P.map((p) => p.dx)), dy: median(P.map((p) => p.dy)) };
  const off = (p) => Math.hypot(p.dx - expected.dx, p.dy - expected.dy);
  const worst = Math.max(...P.map(off));
  const detail = `expected shift ${expected.dx.toFixed(0)},${expected.dy.toFixed(0)}; measured median ${m.dx.toFixed(0)},${m.dy.toFixed(0)}; worst pair off by ${worst.toFixed(0)} pt; ${P.length} pairs: ${seen}`;
  result(id, off(m) <= tolerance && worst <= tolerance * 1.5 ? 'PASS' : 'FAIL', detail);
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
  shiftCase('X-PAN-ZOOMED', 'pan-z-before', 'pan-z-after', { dx, dy }, Math.max(20, 0.25 * Math.hypot(dx, dy)), { minPairs: 1, unambiguous: true });
}

fs.appendFileSync(resultsFile, `${rows.join('\n')}\n`);
console.log(rows.join('\n'));
