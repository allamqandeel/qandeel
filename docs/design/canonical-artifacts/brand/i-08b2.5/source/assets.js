'use strict';
// I-08B2.5 / assets.js
// THE single declared parameter table for this task. The SVG writer, the PNG
// exporter, the validator and the boards all read it, so artwork and review
// material cannot drift apart.
//
// Nothing here is a QANDEEL Brand colour token. Every colour is inherited
// unchanged from the frozen I-08B2.4 Variant B / the I-08B2.3 masters.

const fs = require('fs');
const path = require('path');
const geom = require('./geom');

const G = geom.load();

// ---------------------------------------------------------------------------
// the frozen I-08B2.4 canonical direction
// ---------------------------------------------------------------------------
const B24_DIR = process.env.QANDEEL_B24_DIR
  || 'E:\\QANDEEL\\QANDEEL PROJECT\\I-08B2.4-APP-ICON-PRESENTATION-SYSTEM';
const B24_B = path.join(B24_DIR, 'variants', 'B_DARK_LUMINOUS.svg');
const B24_B_TEXT = fs.readFileSync(B24_B, 'utf8');

// ---------------------------------------------------------------------------
// platform geometry, from the platforms' own specifications
// ---------------------------------------------------------------------------
const CANVAS = 1024;                       // square authoring canvas, both platforms

// Android adaptive icon (developer.android.com):
//   108 x 108 dp canvas; outer 18 dp per side reserved for masking and effects,
//   so 72 x 72 dp is the visible viewport; the inner 66 x 66 dp is the safe zone
//   that no OEM mask clips; the logo must be at least 48 dp and at most 66 dp.
const ANDROID = {
  canvasDp: 108,
  reservedDp: 18,
  viewportDp: 72,
  safeDp: 66,
  logoMinDp: 48,
  logoMaxDp: 66,
};

const r6 = v => +v.toFixed(6);

// The mark's anchor and the radius of the smallest circle about it that holds
// all the ink. Both inherited unmodified from I-08B2.4: bbox centring, which
// keeps the approved mark optically un-rebalanced.
const ANCHOR = { x: (G.q.bbox.x0 + G.q.bbox.x1) / 2, y: (G.q.bbox.y0 + G.q.bbox.y1) / 2 };
const ENCLOSE_R = G.q.enclosingR(ANCHOR.x, ANCHOR.y);

// Build a placement matrix that sets the mark's enclosing circle to `dp`
// diameter on the 108 dp canvas, concentric with the canvas.
function framingForLogoDp(dp) {
  const targetR = (CANVAS / 2) * (dp / ANDROID.canvasDp);
  const scale = r6(targetR / ENCLOSE_R);
  return {
    logoDp: dp,
    targetR: +targetR.toFixed(4),
    scale,
    tx: r6(CANVAS / 2 - ANCHOR.x * scale),
    ty: r6(CANVAS / 2 - ANCHOR.y * scale),
  };
}

// --- iOS / canonical -------------------------------------------------------
// iOS shows the whole square (corner-masked only), so the approved I-08B2.4
// square composition IS what iOS displays. Its framing is therefore carried
// over byte-for-byte, not recomputed: the numbers below are parsed back out of
// the frozen Variant B file and asserted against the 66 dp construction.
const B24_MATRIX = B24_B_TEXT.match(
  /<g id="q-placement" transform="matrix\(([-\d.]+) 0 0 ([-\d.]+) ([-\d.]+) ([-\d.]+)\)"/);
if (!B24_MATRIX) throw new Error('could not read the frozen Variant B placement matrix');
const CANONICAL = {
  logoDp: ANDROID.safeDp,
  scale: +B24_MATRIX[1],
  tx: +B24_MATRIX[3],
  ty: +B24_MATRIX[4],
};
{
  const rebuilt = framingForLogoDp(ANDROID.safeDp);
  const drift = Math.max(
    Math.abs(rebuilt.scale - CANONICAL.scale),
    Math.abs(rebuilt.tx - CANONICAL.tx),
    Math.abs(rebuilt.ty - CANONICAL.ty));
  if (drift > 1e-6) throw new Error('frozen Variant B framing does not reproduce: drift ' + drift);
  CANONICAL.targetR = rebuilt.targetR;
}

// --- Android ---------------------------------------------------------------
// Android crops to the 72 dp viewport, so the approved square, used as-is,
// would render the mark at 66/72 = 91.7% of the visible icon against 61.1% on
// iOS: the same artwork would look half again as large on Android. Framing is
// adjusted (and only framing) to bring the two platforms to comparable
// perceived scale. Exact parity would need 44.0 dp, below Android's documented
// 48 dp logo floor, so 48 dp -- the closest permitted value -- is used.
const ANDROID_FRAMING = framingForLogoDp(ANDROID.logoMinDp);

const PERCEIVED = {
  ios: +(CANONICAL.targetR * 2 / CANVAS).toFixed(4),
  androidIfUnchanged: +(ANDROID.safeDp / ANDROID.viewportDp).toFixed(4),
  android: +(ANDROID.logoMinDp / ANDROID.viewportDp).toFixed(4),
  exactParityDp: +(ANDROID.viewportDp * (CANONICAL.targetR * 2 / CANVAS)).toFixed(2),
};

// ---------------------------------------------------------------------------
// presentation values, all inherited from the frozen Variant B
// ---------------------------------------------------------------------------
const PAINT = {
  ground: '#0A0B0D',       // Variant B dark neutral ground
  ink: '#F4ECDB',          // Variant B mark ink
  coreTint: '#F8EFCC',     // structural light-point core tint
  bloomSlope: 0.35,        // Variant B stroke bloom
  bloomStdDev: G.q.bloom.stdDeviation,
  haloR: G.q.halo.R,
  haloOpacity: 1.0,
  // derivative inks -- no new colours are introduced: the light-background ink
  // is the approved ground colour, and monochrome defaults to plain black and
  // is authored as currentColor so it takes any single ink.
  monoInk: '#000000',
  lightBgInk: '#0A0B0D',
  lightBgField: '#F4ECDB',
};

// ---------------------------------------------------------------------------
// export size tables
// ---------------------------------------------------------------------------
// iOS AppIcon: every distinct pixel size the classic asset catalogue needs,
// plus the 1024 marketing icon. All written without an alpha channel.
const IOS_SIZES = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];

const IOS_CONTENTS = [
  { size: '20x20', idiom: 'iphone', scale: '2x', px: 40 },
  { size: '20x20', idiom: 'iphone', scale: '3x', px: 60 },
  { size: '29x29', idiom: 'iphone', scale: '2x', px: 58 },
  { size: '29x29', idiom: 'iphone', scale: '3x', px: 87 },
  { size: '40x40', idiom: 'iphone', scale: '2x', px: 80 },
  { size: '40x40', idiom: 'iphone', scale: '3x', px: 120 },
  { size: '60x60', idiom: 'iphone', scale: '2x', px: 120 },
  { size: '60x60', idiom: 'iphone', scale: '3x', px: 180 },
  { size: '20x20', idiom: 'ipad', scale: '1x', px: 20 },
  { size: '20x20', idiom: 'ipad', scale: '2x', px: 40 },
  { size: '29x29', idiom: 'ipad', scale: '1x', px: 29 },
  { size: '29x29', idiom: 'ipad', scale: '2x', px: 58 },
  { size: '40x40', idiom: 'ipad', scale: '1x', px: 40 },
  { size: '40x40', idiom: 'ipad', scale: '2x', px: 80 },
  { size: '76x76', idiom: 'ipad', scale: '2x', px: 152 },
  { size: '83.5x83.5', idiom: 'ipad', scale: '2x', px: 167 },
  { size: '1024x1024', idiom: 'ios-marketing', scale: '1x', px: 1024 },
];

// Android densities: the adaptive layers are authored at 108 dp, the legacy
// launcher icons at 48 dp.
const ANDROID_DENSITIES = [
  { name: 'mdpi', f: 1 }, { name: 'hdpi', f: 1.5 }, { name: 'xhdpi', f: 2 },
  { name: 'xxhdpi', f: 3 }, { name: 'xxxhdpi', f: 4 },
];
const PLAY_STORE_PX = 512;

// Validation sizes required by the brief.
const SMALL_SIZES = [256, 128, 64, 32];

// Production PNG widths for the wordmark and Q derivatives.
const WORDMARK_PNG_WIDTHS = [1024, 2048];
const Q_PNG_SIZES = [256, 512, 1024];

module.exports = {
  G, CANVAS, ANDROID, ANCHOR, ENCLOSE_R, framingForLogoDp,
  CANONICAL, ANDROID_FRAMING, PERCEIVED, PAINT,
  IOS_SIZES, IOS_CONTENTS, ANDROID_DENSITIES, PLAY_STORE_PX,
  SMALL_SIZES, WORDMARK_PNG_WIDTHS, Q_PNG_SIZES,
  B24_B, B24_B_TEXT, B24_DIR,
};

if (require.main === module) {
  const j = o => JSON.stringify(o, null, 2);
  console.log('anchor (bbox centre) ', j(ANCHOR));
  console.log('enclosing radius     ', ENCLOSE_R.toFixed(4));
  console.log('CANONICAL / iOS      ', j(CANONICAL));
  console.log('ANDROID framing      ', j(ANDROID_FRAMING));
  console.log('perceived scale      ', j(PERCEIVED));
  console.log('ink box at canonical ', j({
    w: +(G.q.bbox.w * CANONICAL.scale).toFixed(2),
    h: +(G.q.bbox.h * CANONICAL.scale).toFixed(2),
    dpW: +(G.q.bbox.w * CANONICAL.scale / CANVAS * 108).toFixed(2),
    dpH: +(G.q.bbox.h * CANONICAL.scale / CANVAS * 108).toFixed(2),
  }));
  console.log('ink box at android   ', j({
    w: +(G.q.bbox.w * ANDROID_FRAMING.scale).toFixed(2),
    h: +(G.q.bbox.h * ANDROID_FRAMING.scale).toFixed(2),
    dpW: +(G.q.bbox.w * ANDROID_FRAMING.scale / CANVAS * 108).toFixed(2),
    dpH: +(G.q.bbox.h * ANDROID_FRAMING.scale / CANVAS * 108).toFixed(2),
  }));
}
