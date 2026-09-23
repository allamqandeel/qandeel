/**
 * I-08B3.0-E3 - do consecutive lines actually TOUCH?
 *
 * Comparing a role's declared leading against the measured ink extent of a vocalised line
 * proves the two LINE BOXES overlap. It does not prove the INK collides: the tallest mark
 * and the deepest descender of a line are usually in different columns, so the boxes can
 * overlap while nothing visibly touches.
 *
 * The test: render the role's worst case as a real multi-line block, then for every pixel
 * column count the longest unbroken vertical run of ink. One line's ink can be at most
 * (ink extent x size) tall. Any column whose run exceeds that must contain ink from two
 * lines that has merged - a genuine collision, at a known x.
 *
 * Counting ink BANDS instead does not work: a detached diacritic forms its own band, so a
 * four-line block legitimately produces five bands. That earlier approach was discarded.
 *
 * Emits docs/MEASUREMENTS_line-collision.json.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decode } from './png.mjs';
import { render, SCALE } from './render.mjs';
import { page, SYS, S, WORK, PKG, REPORTER, esc } from './ui.mjs';

const BG = [0x0e, 0x10, 0x13];
const LIT = 24; // channel distance from the ground at which a pixel counts as ink

/**
 * Closest approach between the ink of ADJACENT LINES.
 * Within one column, two ink runs belong to different lines when their centres are more
 * than 0.6 x leading apart; closer than that and they are a mark and its own letter.
 */
function closestApproach(img, stepPx) {
  const { width: w, height: h, rgba: p } = img;
  let min = Infinity, atX = -1, atY = -1;
  for (let x = 0; x < w; x++) {
    const runs = [];
    let start = -1;
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      const d = Math.abs(p[i] - BG[0]) + Math.abs(p[i + 1] - BG[1]) + Math.abs(p[i + 2] - BG[2]);
      if (d > LIT) { if (start < 0) start = y; }
      else if (start >= 0) { runs.push([start, y - 1]); start = -1; }
    }
    if (start >= 0) runs.push([start, h - 1]);
    for (let k = 1; k < runs.length; k++) {
      const a = runs[k - 1], b = runs[k];
      const ca = (a[0] + a[1]) / 2, cb = (b[0] + b[1]) / 2;
      if (cb - ca < stepPx * 0.6) continue;      // same line: a mark above its own letter
      const gap = b[0] - a[1] - 1;
      if (gap < min) { min = gap; atX = x; atY = a[1]; }
    }
  }
  return { min: min === Infinity ? null : min, atX, atY };
}

/** For each column, the longest unbroken vertical run of ink, and where it is. */
function longestRuns(img) {
  const { width: w, height: h, rgba: p } = img;
  let best = 0, bestX = -1, bestY = -1;
  const perCol = new Int32Array(w);
  for (let x = 0; x < w; x++) {
    let run = 0, colBest = 0, runStart = 0, colBestStart = 0;
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      const d = Math.abs(p[i] - BG[0]) + Math.abs(p[i + 1] - BG[1]) + Math.abs(p[i + 2] - BG[2]);
      if (d > LIT) { if (run === 0) runStart = y; run++; if (run > colBest) { colBest = run; colBestStart = runStart; } }
      else run = 0;
    }
    perCol[x] = colBest;
    if (colBest > best) { best = colBest; bestX = x; bestY = colBestStart; }
  }
  return { max: best, atX: bestX, atY: bestY, perCol };
}

const TEXT = SYS.proofG.vocalised;
const MEAS = JSON.parse(readFileSync(join(PKG, 'docs', 'MEASUREMENTS_rendered-text.json'), 'utf8'));

const results = {};
for (const role of SYS.roles) {
  // A narrow TEXT COLUMN forces the worst case: several lines, every one fully vocalised.
  // The CANVAS stays wide, because headless Chrome clamps the window to roughly 500px and
  // a narrower canvas is then reported wider than it was asked for, tripping the overflow
  // guard for a reason that has nothing to do with the content.
  const colW = Math.max(240, Math.round(role.size * 14));
  const canvas = 640;
  const html = page('coll', `<div class="arabic" style="width:${colW}px;font-size:${role.size}px;line-height:${role.leading}px;font-weight:${role.weight};color:${S.primary};padding:0;">${esc(TEXT)}</div>`,
    { width: canvas, extraCSS: `body{background:${S.bg};}.arabic{direction:rtl;text-align:start;letter-spacing:0;}`, reporter: REPORTER });

  const r = await render(html, canvas, join(WORK, `coll-${role.key}.png`), `coll-${role.key}`);
  const img = decode(readFileSync(r.path));
  const runs = longestRuns(img);
  const near = closestApproach(img, role.leading * SCALE);

  // What one line of this text can occupy, in device pixels.
  const oneLineInk = MEAS.lineBox[role.key].vocalisedInk_em * role.size * SCALE;
  const leadingPx = role.leading * SCALE;
  const lines = Math.round(r.cssHeight / role.leading);
  // Allow 2 device px for antialiasing spill at the extremes.
  const threshold = oneLineInk + 2;
  const collidingCols = Array.from(runs.perCol).filter((v) => v > threshold).length;

  results[role.key] = {
    role: role.name,
    size: role.size, leading: role.leading, ratio: +(role.leading / role.size).toFixed(4),
    columnWidth: colW, linesRendered: lines,
    oneLineInk_devicePx: +oneLineInk.toFixed(1),
    leading_devicePx: leadingPx,
    boxesOverlapBy_px: +((MEAS.lineBox[role.key].vocalisedInk_em * role.size) - role.leading).toFixed(2),
    longestInkRun_devicePx: runs.max,
    threshold_devicePx: +threshold.toFixed(1),
    inkActuallyCollides: runs.max > threshold,
    collidingColumns: collidingCols,
    collidingColumnsPct: +((collidingCols / img.width) * 100).toFixed(2),
    worstColumnX: runs.max > threshold ? runs.atX : null,
    closestApproachBetweenLines_devicePx: near.min,
    closestApproachBetweenLines_cssPx: near.min === null ? null : +(near.min / SCALE).toFixed(2),
  };
}

const outPath = join(PKG, 'docs', 'MEASUREMENTS_line-collision.json');
writeFileSync(outPath, JSON.stringify({
  generated: new Date().toISOString(), deviceScale: SCALE, text: TEXT,
  method: 'longest unbroken vertical ink run per pixel column, against one line\'s measured vocalised ink extent',
  results,
}, null, 1), 'utf8');

console.log('\nrole            ratio   lines  boxes overlap  ink collides  closest approach between lines');
for (const [k, v] of Object.entries(results)) {
  console.log(
    k.padEnd(15) + String(v.ratio).padEnd(8) + String(v.linesRendered).padEnd(7) +
    (v.boxesOverlapBy_px > 0 ? `+${v.boxesOverlapBy_px}px` : `${v.boxesOverlapBy_px}px`).padEnd(15) +
    String(v.inkActuallyCollides).padEnd(14) +
    `${v.closestApproachBetweenLines_cssPx}px CSS (${v.closestApproachBetweenLines_devicePx} device px)`
  );
}
console.log('\nwrote', outPath);
