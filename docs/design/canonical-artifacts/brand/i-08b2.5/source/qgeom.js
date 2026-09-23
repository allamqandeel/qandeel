'use strict';
// I-08B2.4 / qgeom.js
// Reads the APPROVED I-08B2.3 Q base master and extracts, without modification:
//   * the three path `d` strings, verbatim (byte-for-byte substrings of the file);
//   * the <g id="q-mark"> defs block, verbatim;
//   * the light-point core circle (centre + radius) implied by q-light-core;
//   * the tight ink bounding box and the minimum enclosing circle of the ink.
//
// Nothing here alters the Q. The `d` strings are carried as opaque text so that
// the variants provably contain the approved geometry (see verify-q.js).

const fs = require('fs');
const path = require('path');

const B23 = process.env.QANDEEL_Q_MASTER_DIR
  || 'E:\\QANDEEL\\QANDEEL PROJECT\\I-08B2.3-Q-WORDMARK-PRODUCTION-RECONSTRUCTION\\masters';
const BASE_MASTER = path.join(B23, 'QANDEEL_Q_BASE_MASTER.svg');
const LUM_MASTER = path.join(B23, 'QANDEEL_Q_LUMINOUS.svg');

function readMasters() {
  const base = fs.readFileSync(BASE_MASTER, 'utf8');
  const lum = fs.readFileSync(LUM_MASTER, 'utf8');
  return { base, lum };
}

// verbatim extraction ---------------------------------------------------------
function extractPathD(svg, id) {
  const re = new RegExp('<path id="' + id + '" d="([^"]*)"\\s*/>');
  const m = svg.match(re);
  if (!m) throw new Error('path not found: ' + id);
  return m[1];
}
function extractQMarkBlock(svg) {
  const s = svg.indexOf('<g id="q-mark">');
  if (s < 0) throw new Error('q-mark block not found');
  const e = svg.indexOf('</g>', s);
  return svg.slice(s, e + 4);
}
function extractHaloStops(svg) {
  const s = svg.indexOf('<radialGradient id="halo-q"');
  const e = svg.indexOf('</radialGradient>', s);
  const block = svg.slice(s, e);
  const R = +block.match(/\sr="([\d.]+)"/)[1];
  const cx = +block.match(/\scx="([\d.]+)"/)[1];
  const cy = +block.match(/\scy="([\d.]+)"/)[1];
  const stops = [];
  const re = /<stop offset="([\d.]+)" stop-color="(#[0-9A-Fa-f]{6})" stop-opacity="([\d.]+)"\/>/g;
  let m; while ((m = re.exec(block))) stops.push([+m[1], m[2], +m[3]]);
  return { cx, cy, R, stops };
}
function extractBloom(svg) {
  const s = svg.indexOf('<filter id="stroke-bloom"');
  const e = svg.indexOf('</filter>', s);
  const block = svg.slice(s, e);
  return {
    stdDeviation: +block.match(/stdDeviation="([\d.]+)"/)[1],
    slope: +block.match(/slope="([\d.]+)"/)[1],
  };
}

// flattening ------------------------------------------------------------------
function flatten(d, tol) {
  const pts = [];
  const tok = d.match(/[MLCZmlcz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0;
  while (i < tok.length) {
    const c = tok[i++];
    if (c === 'M') { cx = sx = +tok[i++]; cy = sy = +tok[i++]; pts.push([cx, cy]); }
    else if (c === 'L') { cx = +tok[i++]; cy = +tok[i++]; pts.push([cx, cy]); }
    else if (c === 'C') {
      const x1 = +tok[i++], y1 = +tok[i++], x2 = +tok[i++], y2 = +tok[i++], x = +tok[i++], y = +tok[i++];
      const n = Math.max(8, Math.ceil((Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x - x2, y - y2)) / tol));
      for (let k = 1; k <= n; k++) {
        const u = k / n, mu = 1 - u;
        pts.push([
          mu * mu * mu * cx + 3 * mu * mu * u * x1 + 3 * mu * u * u * x2 + u * u * u * x,
          mu * mu * mu * cy + 3 * mu * mu * u * y1 + 3 * mu * u * u * y2 + u * u * u * y]);
      }
      cx = x; cy = y;
    } else if (c === 'Z' || c === 'z') { pts.push([sx, sy]); cx = sx; cy = sy; }
  }
  return pts;
}

// minimum enclosing circle (Welzl, deterministic seeded permutation) -----------
function mec(points) {
  const P = points.slice();
  let seed = 20260920;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = P.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = P[i]; P[i] = P[j]; P[j] = t; }
  const EPS = 1e-9;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const inC = (c, p) => c && dist([c.x, c.y], p) <= c.r + 1e-7;
  const from2 = (a, b) => ({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, r: dist(a, b) / 2 });
  const from3 = (a, b, c) => {
    const ax = a[0], ay = a[1], bx = b[0], by = b[1], cx2 = c[0], cy2 = c[1];
    const d = 2 * (ax * (by - cy2) + bx * (cy2 - ay) + cx2 * (ay - by));
    if (Math.abs(d) < EPS) return null;
    const ux = ((ax * ax + ay * ay) * (by - cy2) + (bx * bx + by * by) * (cy2 - ay) + (cx2 * cx2 + cy2 * cy2) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx2 - bx) + (bx * bx + by * by) * (ax - cx2) + (cx2 * cx2 + cy2 * cy2) * (bx - ax)) / d;
    return { x: ux, y: uy, r: dist([ux, uy], a) };
  };
  let c = null;
  for (let i = 0; i < P.length; i++) {
    if (inC(c, P[i])) continue;
    c = { x: P[i][0], y: P[i][1], r: 0 };
    for (let j = 0; j < i; j++) {
      if (inC(c, P[j])) continue;
      c = from2(P[i], P[j]);
      for (let k = 0; k < j; k++) {
        if (inC(c, P[k])) continue;
        const cc = from3(P[i], P[j], P[k]);
        if (cc) c = cc;
      }
    }
  }
  return c;
}

function geometry() {
  const { base, lum } = readMasters();
  const ds = {
    ring: extractPathD(base, 'q-ring'),
    tail: extractPathD(base, 'q-tail'),
    core: extractPathD(base, 'q-light-core'),
  };
  const qMarkBlock = extractQMarkBlock(base);
  const halo = extractHaloStops(lum);
  const bloom = extractBloom(lum);

  const bboxOf = pts => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  };
  const all = [];
  const pathBBox = {};
  for (const k of ['ring', 'tail', 'core']) {
    const p = flatten(ds[k], 0.25);
    pathBBox[k] = bboxOf(p);
    all.push(...p);
  }
  const bbox = bboxOf(all);
  const circle = mec(all);

  // the light-point core circle, read back out of its own path
  const cpts = flatten(ds.core, 0.1);
  let cx0 = Infinity, cy0 = Infinity, cx1 = -Infinity, cy1 = -Infinity;
  for (const [x, y] of cpts) { if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; if (y < cy0) cy0 = y; if (y > cy1) cy1 = y; }
  const lightPoint = { cx: (cx0 + cx1) / 2, cy: (cy0 + cy1) / 2, r: (cx1 - cx0) / 2 };

  const viewBox = base.match(/viewBox="([^"]*)"/)[1].split(/\s+/).map(Number);

  // radius of the smallest circle about (cx, cy) that contains all the ink
  const enclosingR = (cx, cy) => {
    let m = 0;
    for (const [x, y] of all) { const d = Math.hypot(x - cx, y - cy); if (d > m) m = d; }
    return m;
  };

  return { ds, qMarkBlock, halo, bloom, bbox, pathBBox, circle, lightPoint, viewBox, enclosingR, sources: { BASE_MASTER, LUM_MASTER } };
}

module.exports = { geometry, flatten, mec, BASE_MASTER, LUM_MASTER };

if (require.main === module) {
  const g = geometry();
  const j = (o) => JSON.stringify(o, (k, v) => typeof v === 'number' ? +v.toFixed(4) : v);
  console.log('viewBox      ', g.viewBox.join(' '));
  console.log('ink bbox     ', j(g.bbox));
  console.log('ink MEC      ', j(g.circle));
  console.log('light point  ', j(g.lightPoint));
  console.log('halo         ', j({ cx: g.halo.cx, cy: g.halo.cy, R: g.halo.R, stops: g.halo.stops.length }));
  console.log('bloom        ', j(g.bloom));
  console.log('d lengths    ', j({ ring: g.ds.ring.length, tail: g.ds.tail.length, core: g.ds.core.length }));
  // how far is the MEC centre from the bbox centre?
  console.log('bbox centre  ', j({ x: (g.bbox.x0 + g.bbox.x1) / 2, y: (g.bbox.y0 + g.bbox.y1) / 2 }));
  console.log('bbox halfdiag', +(Math.hypot(g.bbox.w, g.bbox.h) / 2).toFixed(4));
}
