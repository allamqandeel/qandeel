'use strict';
// I-08B2.5 / validate.js
// Small-size validation, measured on real Chrome/Skia renders.
//
// Checks required by the brief, at 256 / 128 / 64 / 32 px:
//   tail survival, ring opening, light-point continuity, halo behaviour,
//   perceived centring, clipping, contrast.
//
// Two measurement traps from I-08B2.4 are avoided here deliberately:
//   * stroke luma is taken from the brightest 5% of inked pixels, not from a
//     fixed coverage threshold. At 32 px no pixel reaches full coverage, so a
//     threshold-based reading collapses to zero and inverts the result.
//   * the light point is integrated over its whole neighbourhood rather than
//     point-sampled, because at 32 px the halo spans about three pixels and a
//     single centre sample is a function of sub-pixel placement.

const fs = require('fs');
const path = require('path');
const A = require('./assets');
const chrome = require('./chrome');

const OUT = path.join(__dirname, '..', 'out');
const p = rel => path.join(OUT, rel);

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const lumaOf = c => luma(c[0], c[1], c[2]);

// WCAG relative luminance / contrast ratio
function relLum(c) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
const contrastRatio = (a, b) => {
  const la = relLum(a), lb = relLum(b);
  return +(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05))).toFixed(2);
};

const G = A.G;
const RING = G.q.pathBBox.ring;
const TAIL = G.q.pathBBox.tail;

// The ring's opening: the annulus is cut once, between the radial edge that
// starts the path and the radial edge that ends the outer sweep. Both edges are
// read straight out of the approved path data.
const RING_GAP = (() => {
  const d = G.q.ds.ring;
  const startEdge = [[1059.19, 968.2], [989.68, 902.93]];
  const endEdge = [[1137.11, 862.92], [1048.83, 821.62]];
  for (const pt of [...startEdge, ...endEdge]) {
    if (!d.includes(`${pt[0]} ${pt[1]}`)) throw new Error('ring opening endpoint not found in approved path data: ' + pt);
  }
  const mid = e => [(e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2];
  const a = mid(startEdge), b = mid(endEdge);
  return { a, b, centre: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], width: Math.hypot(b[0] - a[0], b[1] - a[1]) };
})();

// ---------------------------------------------------------------------------
// targets
// ---------------------------------------------------------------------------
// Each target knows how to render itself at a size and how to map a point in
// approved mark coordinates into the rendered raster.
function squareIconTarget(id, svgRel, framing, label) {
  return {
    id, label, kind: 'icon',
    ground: hex(A.PAINT.ground), ink: hex(A.PAINT.ink),
    render: S => chrome.renderFile(p(svgRel), S, S, { opaque: true, background: A.PAINT.ground }),
    map: (S) => (x, y) => {
      const k = S / A.CANVAS;
      return [(x * framing.scale + framing.tx) * k, (y * framing.scale + framing.ty) * k];
    },
    size: S => [S, S],
  };
}

// The Android adaptive icon as the user actually sees it: the 108 dp canvas
// cropped to the 72 dp viewport.
function androidMaskedTarget() {
  const f = A.ANDROID_FRAMING;
  const ratio = A.ANDROID.canvasDp / A.ANDROID.viewportDp;   // 1.5
  return {
    id: 'app-icon-android-masked', label: 'App icon, Android masked view', kind: 'icon',
    ground: hex(A.PAINT.ground), ink: hex(A.PAINT.ink),
    render: S => {
      const full = Math.round(S * ratio);
      const img = chrome.renderFile(p('app-icon/android/source/ANDROID_FOREGROUND.svg'), full, full,
        { opaque: true, background: A.PAINT.ground });
      const off = Math.round((full - S) / 2);
      const out = { w: S, h: S, data: new Uint8ClampedArray(S * S * 4) };
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const s = ((y + off) * full + (x + off)) * 4, d = (y * S + x) * 4;
        out.data[d] = img.data[s]; out.data[d + 1] = img.data[s + 1];
        out.data[d + 2] = img.data[s + 2]; out.data[d + 3] = img.data[s + 3];
      }
      return out;
    },
    map: (S) => (x, y) => {
      const full = Math.round(S * ratio), off = Math.round((full - S) / 2), k = full / A.CANVAS;
      return [(x * f.scale + f.tx) * k - off, (y * f.scale + f.ty) * k - off];
    },
    size: S => [S, S],
  };
}

// A standalone Q artwork, rendered at width S in its own viewBox.
function qTarget(id, svgRel, label, groundHex, inkHex) {
  const vb = G.viewBox.q;
  return {
    id, label, kind: 'q',
    // the Q masters are framed on the ink's own bounding box, so ink reaching
    // all four borders is the expected result, not clipping
    expectEdgeInk: true,
    ground: hex(groundHex), ink: hex(inkHex),
    render: S => {
      const H = Math.round(S * vb[3] / vb[2]);
      return chrome.renderFile(p(svgRel), S, H, { opaque: true, background: groundHex });
    },
    map: (S) => (x, y) => {
      const k = S / vb[2];
      return [(x - vb[0]) * k, (y - vb[1]) * k];
    },
    size: S => [S, Math.round(S * vb[3] / vb[2])],
  };
}

const TARGETS = [
  squareIconTarget('app-icon-ios', 'app-icon/APP_ICON_B_DARK_LUMINOUS.svg', A.CANONICAL,
    'App icon, square / iOS view'),
  androidMaskedTarget(),
  qTarget('q-luminous', 'masters/QANDEEL_Q_LUMINOUS.svg', 'Q luminous master', '#02040A', A.PAINT.ink),
  qTarget('q-base-on-dark', 'masters/QANDEEL_Q_BASE_MASTER.svg', 'Q base master on dark', A.PAINT.ground, A.PAINT.ink),
  qTarget('q-monochrome', 'derivatives/monochrome/QANDEEL_Q_MONOCHROME.svg', 'Q monochrome on white', '#FFFFFF', A.PAINT.monoInk),
  qTarget('q-light-bg', 'derivatives/light-background/QANDEEL_Q_LIGHT_BG.svg', 'Q light-background-safe', A.PAINT.lightBgField, A.PAINT.lightBgInk),
];

// ---------------------------------------------------------------------------
// measurement
// ---------------------------------------------------------------------------
function measure(t, S) {
  const img = t.render(S);
  const { w, h, data } = img;
  const m = t.map(S);
  const gL = lumaOf(t.ground), iL = lumaOf(t.ink);
  const dark = iL > gL;                       // is the ink lighter than the field?
  const L = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = luma(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);

  // "inkness" in [0,1]: how far a pixel has travelled from field toward ink.
  // Works in both directions, so a dark mark on a light field reads the same.
  const inkness = i => Math.max(0, Math.min(1, (L[i] - gL) / (iL - gL)));
  const at = (x, y) => {
    const xi = Math.min(w - 1, Math.max(0, Math.round(x - 0.5)));
    const yi = Math.min(h - 1, Math.max(0, Math.round(y - 0.5)));
    return yi * w + xi;
  };
  // Bilinear inkness. A single nearest-pixel probe of a feature about one pixel
  // wide is a function of sub-pixel phase, not of the artwork: it made the ring
  // opening read 0.889 at 29 px and 0.405 at 32 px on the same geometry.
  const inknessAt = (x, y) => {
    const fx = Math.min(w - 1.0001, Math.max(0, x - 0.5));
    const fy = Math.min(h - 1.0001, Math.max(0, y - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const v = (xx, yy) => inkness(Math.min(h - 1, yy) * w + Math.min(w - 1, xx));
    return v(x0, y0) * (1 - tx) * (1 - ty) + v(x0 + 1, y0) * tx * (1 - ty)
      + v(x0, y0 + 1) * (1 - tx) * ty + v(x0 + 1, y0 + 1) * tx * ty;
  };

  // --- contrast ------------------------------------------------------------
  // stroke luma from the brightest (or darkest) 5% of inked pixels
  const inked = [];
  for (let i = 0; i < w * h; i++) if (inkness(i) > 0.02) inked.push(i);
  inked.sort((a, b) => inkness(b) - inkness(a));
  const top = inked.slice(0, Math.max(1, Math.round(inked.length * 0.05)));
  let ss = 0; for (const i of top) ss += L[i];
  const strokeL = top.length ? ss / top.length : gL;
  const strokeRGB = (() => {
    let r = 0, g = 0, b = 0;
    for (const i of top) { r += data[i * 4]; g += data[i * 4 + 1]; b += data[i * 4 + 2]; }
    const n = Math.max(1, top.length);
    return [r / n, g / n, b / n];
  })();

  // --- tail survival -------------------------------------------------------
  // Columns of the tail that lie clear of the ring must each still carry ink.
  const x0 = RING.x1, x1 = TAIL.x1;
  let cols = 0, colsWithInk = 0, weakest = 1;
  const NCOL = 64;
  for (let c = 0; c < NCOL; c++) {
    const mx = x0 + (x1 - x0) * (c + 0.5) / NCOL;
    const yTop = m(mx, TAIL.y0)[1], yBot = m(mx, TAIL.y1)[1];
    const px = m(mx, TAIL.y0)[0];
    let best = 0;
    for (let y = Math.floor(Math.min(yTop, yBot)) - 1; y <= Math.ceil(Math.max(yTop, yBot)) + 1; y++) {
      if (y < 0 || y >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = Math.round(px - 0.5) + dx;
        if (xx < 0 || xx >= w) continue;
        best = Math.max(best, inkness(y * w + xx));
      }
    }
    cols++;
    if (best >= 0.25) colsWithInk++;
    weakest = Math.min(weakest, best);
  }
  // the very tip of the tail
  const tip = m(TAIL.x1 - 8, 1068.82);
  let tipInk = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 1; dx++) {
    const xx = Math.round(tip[0] - 0.5) + dx, yy = Math.round(tip[1] - 0.5) + dy;
    if (xx >= 0 && xx < w && yy >= 0 && yy < h) tipInk = Math.max(tipInk, inkness(yy * w + xx));
  }

  // --- ring opening --------------------------------------------------------
  // The annulus is cut once. Sample right across the channel between the two
  // radial edges and take its most open point: the opening reads as an opening
  // if any part of the channel still breaks the ring.
  const ea = m(RING_GAP.a[0], RING_GAP.a[1]);
  const eb = m(RING_GAP.b[0], RING_GAP.b[1]);
  let gapOpen = 0, gapMean = 0, NG = 65;
  for (let i = 0; i < NG; i++) {
    const u = i / (NG - 1);
    const v = 1 - inknessAt(ea[0] + (eb[0] - ea[0]) * u, ea[1] + (eb[1] - ea[1]) * u);
    if (v > gapOpen) gapOpen = v;
    gapMean += v;
  }
  gapMean /= NG;
  const gapWidthPx = Math.hypot(eb[0] - ea[0], eb[1] - ea[1]);

  // --- ring counter --------------------------------------------------------
  const cx = (RING.x0 + RING.x1) / 2, cy = (RING.y0 + RING.y1) / 2;
  const cp = m(cx, cy);
  const counterOpen = 1 - inkness(at(cp[0], cp[1]));

  // --- light point ---------------------------------------------------------
  const lp = G.q.lightPoint;
  const c0 = m(lp.cx, lp.cy);
  const coreRpx = Math.abs(m(lp.cx + lp.r, lp.cy)[0] - c0[0]);
  let wholePx = 0, peak = 0, energy = 0, peakInk = 0;
  const RAD = Math.max(3, Math.ceil(coreRpx * 6));
  for (let dy = -RAD; dy <= RAD; dy++) for (let dx = -RAD; dx <= RAD; dx++) {
    const xx = Math.round(c0[0] - 0.5) + dx, yy = Math.round(c0[1] - 0.5) + dy;
    if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
    const i = yy * w + xx;
    const d = Math.hypot(xx + 0.5 - c0[0], yy + 0.5 - c0[1]);
    if (d <= coreRpx && inkness(i) > 0.98) wholePx++;
    if (L[i] > peak) peak = L[i];
    // direction-agnostic: how far the neighbourhood departs from the field
    energy += Math.abs(L[i] - gL);
  }
  // Structural presence of the light point, measured as departure from the
  // field at its centre. This reads the same for a luminous core on dark and
  // for a flat ink core on light, which is what the monochrome rule needs.
  const NP = 9;
  for (let dy = 0; dy < NP; dy++) for (let dx = 0; dx < NP; dx++) {
    const v = inknessAt(c0[0] + (dx / (NP - 1) - 0.5) * 2 * coreRpx,
      c0[1] + (dy / (NP - 1) - 0.5) * 2 * coreRpx);
    if (v > peakInk) peakInk = v;
  }
  const coreAreaPx = Math.PI * coreRpx * coreRpx;

  // --- halo ----------------------------------------------------------------
  // Amber carried in the annulus around the core, beyond the chroma the mark's
  // own ink and the field already have. Without this subtraction a warm ink on
  // a warm field reports a halo that is not there.
  const chromaOf = c => c[0] - c[2];
  const baseChroma = Math.max(chromaOf(t.ink), chromaOf(t.ground));
  let annulusChroma = -999;
  const hr = Math.max(3, Math.ceil(coreRpx * 9));
  for (let dy = -hr; dy <= hr; dy++) for (let dx = -hr; dx <= hr; dx++) {
    const xx = Math.round(c0[0] - 0.5) + dx, yy = Math.round(c0[1] - 0.5) + dy;
    if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
    const d = Math.hypot(xx + 0.5 - c0[0], yy + 0.5 - c0[1]);
    if (d <= coreRpx * 1.5) continue;              // skip the core itself
    const i = yy * w + xx;
    annulusChroma = Math.max(annulusChroma, data[i * 4] - data[i * 4 + 2]);
  }
  const chromaExcess = Math.max(0, annulusChroma - baseChroma);

  // --- centring ------------------------------------------------------------
  let sx = 0, sy = 0, sw = 0, bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = inkness(y * w + x);
    if (v <= 0.02) continue;
    sx += (x + 0.5) * v; sy += (y + 0.5) * v; sw += v;
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
    if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  const inkBBoxCentre = [(bx0 + bx1 + 1) / 2, (by0 + by1 + 1) / 2];
  const offsetX = inkBBoxCentre[0] - w / 2, offsetY = inkBBoxCentre[1] - h / 2;

  // --- clipping ------------------------------------------------------------
  // The Q masters' viewBox is the ink's own bounding box, so their ink meets all
  // four borders by construction and an edge-pixel count there is not a defect.
  // The icons must show nothing at their borders at all.
  let edge = 0;
  const sides = [0, 0, 0, 0];
  for (let x = 0; x < w; x++) {
    if (inkness(x) > 0.05) { edge++; sides[0] = 1; }
    if (inkness((h - 1) * w + x) > 0.05) { edge++; sides[2] = 1; }
  }
  for (let y = 0; y < h; y++) {
    if (inkness(y * w) > 0.05) { edge++; sides[3] = 1; }
    if (inkness(y * w + w - 1) > 0.05) { edge++; sides[1] = 1; }
  }
  const bordersTouched = sides.reduce((a, b) => a + b, 0);
  const clipOK = t.expectEdgeInk ? bordersTouched === 4 : edge === 0;

  return {
    size: S, raster: `${w}x${h}`,
    contrast: {
      strokeLuma: +strokeL.toFixed(1),
      fieldLuma: +gL.toFixed(1),
      ratio: contrastRatio(strokeRGB, t.ground),
      inkVsField: contrastRatio(t.ink, t.ground),
    },
    tail: {
      columnsTested: cols, columnsWithInk: colsWithInk,
      survival: +(colsWithInk / cols).toFixed(3),
      weakestColumn: +weakest.toFixed(3),
      tipInkness: +tipInk.toFixed(3),
    },
    ringOpening: {
      openness: +gapOpen.toFixed(3), meanOpenness: +gapMean.toFixed(3),
      channelLengthPx: +gapWidthPx.toFixed(2),
    },
    ringCounter: { openness: +counterOpen.toFixed(3) },
    lightPoint: {
      coreRadiusPx: +coreRpx.toFixed(3),
      coreAreaPx2: +coreAreaPx.toFixed(2),
      wholePixelsAtFullInk: wholePx,
      structuralPresence: +peakInk.toFixed(3),
      peakLuma: +peak.toFixed(1),
      energyVsField: Math.round(energy),
    },
    halo: { chromaExcess: Math.round(chromaExcess), baseChroma: Math.round(baseChroma) },
    centring: {
      inkBBoxOffsetPx: [+offsetX.toFixed(2), +offsetY.toFixed(2)],
      inkBBoxOffsetFrac: [+(offsetX / w).toFixed(4), +(offsetY / h).toFixed(4)],
    },
    clipping: { edgePixelsWithInk: edge, bordersTouched, expectEdgeInk: !!t.expectEdgeInk, pass: clipOK },
  };
}

// The brief requires 256 / 128 / 64 / 32. The icons are also read at the
// smallest sizes iOS actually ships (40, 29, 20), which are below the required
// floor and are where the mark is genuinely under pressure.
const ICON_SIZES = [256, 128, 64, 40, 32, 29, 20];

function main() {
  const results = {};
  for (const t of TARGETS) {
    const sizes = t.kind === 'icon' ? ICON_SIZES : A.SMALL_SIZES;
    results[t.id] = { label: t.label, kind: t.kind, sizesTested: sizes, sizes: {} };
    for (const S of sizes) {
      results[t.id].sizes[S] = measure(t, S);
    }
  }
  const doc = {
    engine: chrome.engineVersion(),
    generated: new Date().toISOString(),
    ringOpening: {
      edgeA: RING_GAP.a, edgeB: RING_GAP.b,
      centre: RING_GAP.centre, widthMarkUnits: +RING_GAP.width.toFixed(2),
      note: 'Both radial edges are read out of the approved ring path data and asserted present before use.',
    },
    framing: { canonical: A.CANONICAL, android: A.ANDROID_FRAMING, perceived: A.PERCEIVED },
    results,
  };
  fs.mkdirSync(p('review'), { recursive: true });
  fs.writeFileSync(p('review/small-size-validation.json'), JSON.stringify(doc, null, 2));

  for (const [id, r] of Object.entries(results)) {
    console.log('\n' + r.label);
    console.log('  size  tailSurv  weakCol  tipInk  ringOpen  counter  corePx2  wholePx  lightPt  chroma  offset(px)   clip  contrast');
    for (const S of r.sizesTested) {
      const m = r.sizes[S];
      console.log('  ' + String(S).padStart(4)
        + String(m.tail.survival.toFixed(3)).padStart(10)
        + String(m.tail.weakestColumn.toFixed(3)).padStart(9)
        + String(m.tail.tipInkness.toFixed(3)).padStart(8)
        + String(m.ringOpening.openness.toFixed(3)).padStart(10)
        + String(m.ringCounter.openness.toFixed(3)).padStart(9)
        + String(m.lightPoint.coreAreaPx2.toFixed(2)).padStart(9)
        + String(m.lightPoint.wholePixelsAtFullInk).padStart(9)
        + String(m.lightPoint.structuralPresence.toFixed(3)).padStart(9)
        + String(m.halo.chromaExcess).padStart(8)
        + `  ${m.centring.inkBBoxOffsetPx[0]},${m.centring.inkBBoxOffsetPx[1]}`.padEnd(13)
        + (m.clipping.pass ? '  ok' : ' FAIL').padStart(6)
        + String(m.contrast.ratio).padStart(10));
    }
  }
  console.log('\nwrote review/small-size-validation.json');
}

if (require.main === module) main();
module.exports = { measure, TARGETS, RING_GAP };
