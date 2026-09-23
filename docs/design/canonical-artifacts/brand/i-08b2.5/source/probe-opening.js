'use strict';
// I-08B2.5 / probe-opening.js
// Diagnostic. Real renders show the Q's ring opening closing up at the smallest
// icon sizes. The brief allows a tiny-size adjustment to rendering / halo /
// export treatment but NOT to geometry, so the question that decides what to do
// is: does the stroke bloom close the opening, or does resolution alone close it?
//
// This renders the canonical icon at each shipped size with the approved bloom
// and with the bloom removed, and reads the opening both ways. If the no-bloom
// column closes too, no export treatment can reopen it and the finding is a
// resolution limit to be reported, not a defect to be tuned away.

const fs = require('fs');
const path = require('path');
const A = require('./assets');
const chrome = require('./chrome');
const { RING_GAP } = require('./validate');

const OUT = path.join(__dirname, '..', 'out');
const SRC = fs.readFileSync(path.join(OUT, 'app-icon/APP_ICON_B_DARK_LUMINOUS.svg'), 'utf8');

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const gL = luma(...hex(A.PAINT.ground));
const iL = luma(...hex(A.PAINT.ink));

// variants of the canonical file that differ ONLY in bloom slope
function withSlope(slope) {
  if (slope === null) return SRC.replace(' filter="url(#stroke-bloom)"', '');
  return SRC.replace(/slope="[\d.]+"/, `slope="${slope.toFixed(2)}"`);
}

// Same measure as validate.js: sample bilinearly right across the channel
// between the two radial edges and take its most open point. A single
// nearest-pixel probe of a one-pixel feature reports sub-pixel phase instead.
function openingAt(svgText, S) {
  const img = chrome.renderText(svgText, S, S, { opaque: true, background: A.PAINT.ground });
  const k = S / A.CANVAS;
  const m = (x, y) => [(x * A.CANONICAL.scale + A.CANONICAL.tx) * k, (y * A.CANONICAL.scale + A.CANONICAL.ty) * k];
  const inkAt = (x, y) => {
    const fx = Math.min(S - 1.0001, Math.max(0, x - 0.5));
    const fy = Math.min(S - 1.0001, Math.max(0, y - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const v = (xx, yy) => {
      const i = Math.min(S - 1, yy) * S + Math.min(S - 1, xx);
      const L = luma(img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]);
      return Math.max(0, Math.min(1, (L - gL) / (iL - gL)));
    };
    return v(x0, y0) * (1 - tx) * (1 - ty) + v(x0 + 1, y0) * tx * (1 - ty)
      + v(x0, y0 + 1) * (1 - tx) * ty + v(x0 + 1, y0 + 1) * tx * ty;
  };
  const a = m(RING_GAP.a[0], RING_GAP.a[1]), b = m(RING_GAP.b[0], RING_GAP.b[1]);
  let best = 0;
  for (let i = 0; i < 65; i++) {
    const u = i / 64;
    best = Math.max(best, 1 - inkAt(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u));
  }
  return best;
}

const SIZES = [20, 29, 32, 40, 48, 58, 64, 80, 120, 128];
const CASES = [
  ['no bloom', withSlope(null)],
  ['slope 0.15', withSlope(0.15)],
  ['slope 0.35 (approved)', withSlope(0.35)],
];

console.log('ring opening openness (1.000 = fully open, 0.000 = filled in)');
console.log('gap width in the approved geometry:', RING_GAP.width.toFixed(2), 'mark units');
console.log('');
console.log('  size   gap px   ' + CASES.map(c => c[0].padStart(22)).join(''));
for (const S of SIZES) {
  const gapPx = RING_GAP.width * A.CANONICAL.scale * (S / A.CANVAS);
  const row = CASES.map(([, svg]) => openingAt(svg, S).toFixed(3).padStart(22));
  console.log('  ' + String(S).padStart(4) + gapPx.toFixed(2).padStart(9) + '   ' + row.join(''));
}
