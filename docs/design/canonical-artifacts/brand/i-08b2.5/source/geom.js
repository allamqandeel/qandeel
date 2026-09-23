'use strict';
// I-08B2.5 / geom.js
// Reads the four APPROVED I-08B2.3 masters and extracts, without modification:
//   * every path `d` string, verbatim (byte-for-byte substrings of the masters);
//   * the whole <defs> block of each master, verbatim, so derivatives can carry
//     the approved geometry by copy rather than by redraw;
//   * the light-point cores, the halo stop tables and the bloom parameters.
// Nothing here alters any geometry. Q measurement (bbox / minimum enclosing
// circle) is inherited unchanged from the I-08B2.4 tool.

const fs = require('fs');
const path = require('path');
const qgeom = require('./qgeom');

const B23 = process.env.QANDEEL_Q_MASTER_DIR
  || 'E:\\QANDEEL\\QANDEEL PROJECT\\I-08B2.3-Q-WORDMARK-PRODUCTION-RECONSTRUCTION\\masters';

const MASTERS = {
  qBase: path.join(B23, 'QANDEEL_Q_BASE_MASTER.svg'),
  qLum: path.join(B23, 'QANDEEL_Q_LUMINOUS.svg'),
  wmBase: path.join(B23, 'QANDEEL_WORDMARK_BASE_MASTER.svg'),
  wmLum: path.join(B23, 'QANDEEL_WORDMARK_LUMINOUS.svg'),
};

const read = k => fs.readFileSync(MASTERS[k], 'utf8');

// Strip XML comments before locating anything. A header comment that mentions a
// tag name will otherwise be found by indexOf instead of the real element —
// that trap cost a false failure in I-08B2.4's verifier.
const stripComments = s => s.replace(/<!--[\s\S]*?-->/g, '');

function defsBlock(svgText) {
  const s = stripComments(svgText);
  const a = s.indexOf('<defs>');
  const b = s.indexOf('</defs>');
  if (a < 0 || b < 0) throw new Error('no <defs> block');
  return s.slice(a + 6, b).replace(/^\n/, '').replace(/\s+$/, '');
}

function viewBoxOf(svgText) {
  return svgText.match(/viewBox="([^"]*)"/)[1].trim().split(/\s+/).map(Number);
}

// every <path id="..." d="..."/> in the file, verbatim
function allPaths(svgText) {
  const out = {};
  const re = /<path id="([^"]+)" d="([^"]*)"\s*\/>/g;
  let m; while ((m = re.exec(stripComments(svgText)))) out[m[1]] = m[2];
  return out;
}

function circleFromCorePath(d) {
  const pts = qgeom.flatten(d, 0.05);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r: (x1 - x0) / 2 };
}

function load() {
  const src = {
    qBase: read('qBase'), qLum: read('qLum'),
    wmBase: read('wmBase'), wmLum: read('wmLum'),
  };
  const q = qgeom.geometry();               // Q bbox / MEC / enclosingR, unchanged
  const wmPaths = allPaths(src.wmBase);

  return {
    src,
    files: MASTERS,
    q,                                       // { ds, qMarkBlock, bbox, circle, lightPoint, enclosingR, ... }
    defs: {
      qBase: defsBlock(src.qBase),
      wmBase: defsBlock(src.wmBase),
    },
    viewBox: {
      q: viewBoxOf(src.qBase),
      wm: viewBoxOf(src.wmBase),
    },
    wm: {
      paths: wmPaths,
      lightPoints: {
        q: circleFromCorePath(wmPaths['q-light-core']),
        centre: circleFromCorePath(wmPaths['centre-light-core']),
      },
    },
  };
}

module.exports = { load, defsBlock, viewBoxOf, allPaths, stripComments, MASTERS };

if (require.main === module) {
  const g = load();
  const f = n => +n.toFixed(4);
  console.log('Q viewBox    ', g.viewBox.q.join(' '));
  console.log('WM viewBox   ', g.viewBox.wm.join(' '));
  console.log('Q ink bbox   ', JSON.stringify(g.q.bbox, (k, v) => typeof v === 'number' ? f(v) : v));
  console.log('Q ink MEC    ', JSON.stringify(g.q.circle, (k, v) => typeof v === 'number' ? f(v) : v));
  console.log('Q light pt   ', JSON.stringify(g.q.lightPoint, (k, v) => typeof v === 'number' ? f(v) : v));
  console.log('WM light pts ', JSON.stringify(g.wm.lightPoints, (k, v) => typeof v === 'number' ? f(v) : v));
  console.log('WM path ids  ', Object.keys(g.wm.paths).join(', '));
  const bc = { x: (g.q.bbox.x0 + g.q.bbox.x1) / 2, y: (g.q.bbox.y0 + g.q.bbox.y1) / 2 };
  console.log('Q bbox centre', JSON.stringify(bc, (k, v) => typeof v === 'number' ? f(v) : v));
  console.log('Q enclose R  ', f(g.q.enclosingR(bc.x, bc.y)));
}
