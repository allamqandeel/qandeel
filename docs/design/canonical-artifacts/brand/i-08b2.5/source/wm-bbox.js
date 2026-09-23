'use strict';
// I-08B2.5 / wm-bbox.js
// Diagnostic for limitation L-4: does the approved wordmark's ink actually fit
// inside the master's viewBox, or is something clipped at the frame edge?
//
// The wordmark's final L runs right up to the right edge of the frame, which
// looks like clipping on a review board. This resolves it by measuring rather
// than by eye: it flattens every path in the master, applies the two mirror
// transforms the file uses for the E glyphs, and compares the resulting ink
// bounding box with the declared viewBox. A positive overflow would mean the
// master disagrees with the approved frozen state, which is a stop condition.

const geom = require('./geom');
const qg = require('./qgeom');

const G = geom.load();
const P = G.wm.paths;

const bbox = pts => pts.reduce((a, [x, y]) => ({
  x0: Math.min(a.x0, x), y0: Math.min(a.y0, y),
  x1: Math.max(a.x1, x), y1: Math.max(a.y1, y),
}), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });

const all = [];
const show = (name, b) => console.log(
  name.padEnd(18), 'x', b.x0.toFixed(1).padStart(9), b.x1.toFixed(1).padStart(9),
  '  y', b.y0.toFixed(1).padStart(8), b.y1.toFixed(1).padStart(8));

for (const id of ['q-ring', 'q-tail', 'q-light-core', 'letter-a', 'letter-n',
  'letter-d', 'letter-l', 'centre-light-core']) {
  const pts = qg.flatten(P[id], 0.5);
  all.push(...pts);
  show(id, bbox(pts));
}

// e-glyph = e-arm, plus e-arm mirrored in y about 995.74, plus e-bar.
// It is used twice: once as authored, once mirrored in x about 15083.59.
for (const [name, f] of [['e-glyph 1', q => q], ['e-glyph 2', ([x, y]) => [15083.59 - x, y]]]) {
  const pts = [];
  for (const d of [P['e-arm'], P['e-bar']]) pts.push(...qg.flatten(d, 0.5));
  for (const [x, y] of qg.flatten(P['e-arm'], 0.5)) pts.push([x, 995.74 - y]);
  const moved = pts.map(f);
  all.push(...moved);
  show(name, bbox(moved));
}

const B = bbox(all);
const vb = G.viewBox.wm;
const over = {
  right: B.x1 - (vb[0] + vb[2]),
  left: vb[0] - B.x0,
  top: vb[1] - B.y0,
  bottom: B.y1 - (vb[1] + vb[3]),
};
console.log('\nwordmark ink bbox   x', B.x0.toFixed(2), '..', B.x1.toFixed(2),
  '  y', B.y0.toFixed(2), '..', B.y1.toFixed(2));
console.log('master viewBox      x', vb[0], '..', (vb[0] + vb[2]).toFixed(2),
  '  y', vb[1], '..', (vb[1] + vb[3]).toFixed(2));
console.log('overflow (positive means clipped):',
  Object.entries(over).map(([k, v]) => `${k} ${v.toFixed(3)}`).join('  '));
const clipped = Object.values(over).some(v => v > 0.001);
console.log(clipped
  ? 'CLIPPED - the master disagrees with the approved frozen state'
  : 'not clipped - the masters are framed tight to their own ink, with no clear space');
