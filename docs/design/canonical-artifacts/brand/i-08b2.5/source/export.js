'use strict';
// I-08B2.5 / export.js
// Rasterises every production PNG through the real engine (Chrome / Blink /
// Skia). Nothing here is drawn by a numerical model.
//
// iOS icons are written WITHOUT an alpha channel (PNG colour type 2): an app
// icon carrying transparency is rejected at submission.

const fs = require('fs');
const path = require('path');
const A = require('./assets');
const chrome = require('./chrome');
const png = require('./png');

const OUT = path.join(__dirname, '..', 'out');
const p = rel => path.join(OUT, rel);
const manifestRows = [];

function record(rel, w, h, bytes, note) {
  manifestRows.push({ file: rel.replace(/\\/g, '/'), w, h, bytes, note });
}

// A malformed SVG does not fail loudly: Chrome draws its broken-image glyph and
// the export "succeeds" as a near-empty PNG. Every render is therefore checked
// for real content before it is allowed into the package.
function sanity(rel, img, opaque) {
  const n = img.w * img.h;
  let ink = 0, maxL = 0;
  for (let i = 0; i < n; i++) {
    const a = img.data[i * 4 + 3];
    const L = 0.2126 * img.data[i * 4] + 0.7152 * img.data[i * 4 + 1] + 0.0722 * img.data[i * 4 + 2];
    if (L > maxL) maxL = L;
    if (opaque ? L >= 60 : a >= 128) ink++;
  }
  const frac = ink / n;
  if (frac < 0.01) {
    throw new Error(`${rel}: render carries no mark (${(frac * 100).toFixed(3)}% content, peak luma ${maxL.toFixed(0)}). `
      + 'The source SVG almost certainly failed to parse.');
  }
  return { contentFraction: +frac.toFixed(4), peakLuma: +maxL.toFixed(1) };
}

function shoot(svgRel, w, h, destRel, opts = {}) {
  const r = chrome.exportPNG(p(svgRel), w, h, p(destRel), opts);
  sanity(destRel, r.img, opts.alpha === false);
  record(destRel, r.w, r.h, r.bytes, opts.note || '');
  return r;
}

// ---------------------------------------------------------------------------
// 0. the approved masters, copied across unchanged
// ---------------------------------------------------------------------------
function copyMasters() {
  for (const [k, src] of Object.entries(A.G.files)) {
    const dest = p(path.join('masters', path.basename(src)));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    record(path.join('masters', path.basename(src)), null, null,
      fs.statSync(dest).size, 'approved I-08B2.3 master, byte-for-byte copy');
  }
}

// ---------------------------------------------------------------------------
// 1. iOS
// ---------------------------------------------------------------------------
function iosIcons() {
  const src = 'app-icon/APP_ICON_B_DARK_LUMINOUS.svg';
  for (const px of A.IOS_SIZES) {
    shoot(src, px, px, `app-icon/ios/AppIcon.appiconset/AppIcon-${px}.png`,
      { alpha: false, background: A.PAINT.ground, note: 'no alpha channel' });
  }
}

// ---------------------------------------------------------------------------
// 2. Android
// ---------------------------------------------------------------------------
// The foreground is the full Variant B composite at Android framing, opaque and
// full bleed, because the approved appearance cannot survive a layer split:
// the halo is a screen blend, and screening over the mark's own ink gives a
// near-white core while screening over the ground gives amber. Baking the
// composite keeps the approved result exactly. The background layer is the
// identical flat colour, so an opaque foreground costs nothing under parallax.
function androidIcons() {
  const fg = 'app-icon/android/source/ANDROID_FOREGROUND.svg';
  const legacy = 'app-icon/APP_ICON_B_DARK_LUMINOUS.svg';

  for (const d of A.ANDROID_DENSITIES) {
    const px = Math.round(A.ANDROID.canvasDp * d.f);
    shoot(fg, px, px, `app-icon/android/res/mipmap-${d.name}/ic_launcher_foreground.png`,
      { alpha: false, background: A.PAINT.ground, note: `adaptive foreground, 108dp @ ${d.f}x` });
  }
  // Legacy launcher icons (pre-API 26) show the whole square, so they use the
  // canonical square framing, not the adaptive one.
  for (const d of A.ANDROID_DENSITIES) {
    const px = Math.round(48 * d.f);
    shoot(legacy, px, px, `app-icon/android/res/mipmap-${d.name}/ic_launcher.png`,
      { alpha: false, background: A.PAINT.ground, note: `legacy launcher, 48dp @ ${d.f}x` });
  }
  // Legacy round: the platform itself requires a circular asset here, so the
  // circle is a delivery requirement, not a shape baked into the design.
  for (const d of A.ANDROID_DENSITIES) {
    const px = Math.round(48 * d.f);
    const img = chrome.renderFile(p(legacy), px, px, { opaque: true, background: A.PAINT.ground });
    sanity(`ic_launcher_round@${px}`, img, true);
    circleMask(img);
    const dest = p(`app-icon/android/res/mipmap-${d.name}/ic_launcher_round.png`);
    const buf = png.encodeRGBA(img.w, img.h, img.data);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    record(`app-icon/android/res/mipmap-${d.name}/ic_launcher_round.png`, px, px, buf.length,
      `legacy round launcher, 48dp @ ${d.f}x, circular delivery mask`);
  }
  shoot(legacy, A.PLAY_STORE_PX, A.PLAY_STORE_PX, 'app-icon/android/PLAY_STORE_ICON_512.png',
    { alpha: false, background: A.PAINT.ground, note: 'Play Store listing icon' });
}

// antialiased circular mask, 4x4 supersampled at the boundary
function circleMask(img) {
  const S = img.w, R = S / 2, c = S / 2, SS = 4;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
    let a;
    if (d < R - 1.5) a = 1;
    else if (d > R + 1.5) a = 0;
    else {
      let n = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++)
        if (Math.hypot(x + (sx + 0.5) / SS - c, y + (sy + 0.5) / SS - c) <= R) n++;
      a = n / (SS * SS);
    }
    img.data[(y * S + x) * 4 + 3] = Math.round(a * 255);
  }
}

// ---------------------------------------------------------------------------
// 3. derivative PNGs
// ---------------------------------------------------------------------------
const wmHeight = width => Math.round(width * A.G.viewBox.wm[3] / A.G.viewBox.wm[2]);
const qHeight = size => Math.round(size * A.G.viewBox.q[3] / A.G.viewBox.q[2]);

function derivativePNGs() {
  // items 1-4: production exports of the approved masters
  for (const s of [512, 1024]) {
    shoot('masters/QANDEEL_Q_BASE_MASTER.svg', s, qHeight(s),
      `derivatives/png/QANDEEL_Q_BASE_${s}.png`, { note: 'transparent, for dark surfaces' });
    shoot('masters/QANDEEL_Q_LUMINOUS.svg', s, qHeight(s),
      `derivatives/png/QANDEEL_Q_LUMINOUS_${s}.png`, { note: 'carries the master ground' });
  }
  shoot('masters/QANDEEL_WORDMARK_BASE_MASTER.svg', 2048, wmHeight(2048),
    'derivatives/png/QANDEEL_WORDMARK_BASE_2048.png', { note: 'transparent, for dark surfaces' });
  shoot('masters/QANDEEL_WORDMARK_LUMINOUS.svg', 2048, wmHeight(2048),
    'derivatives/png/QANDEEL_WORDMARK_LUMINOUS_2048.png', { note: 'carries the master ground' });

  // items 6-9: monochrome and light-background-safe
  for (const s of [512, 1024]) {
    shoot('derivatives/monochrome/QANDEEL_Q_MONOCHROME.svg', s, qHeight(s),
      `derivatives/monochrome/QANDEEL_Q_MONOCHROME_${s}.png`, { note: 'black ink, transparent' });
    shoot('derivatives/light-background/QANDEEL_Q_LIGHT_BG.svg', s, qHeight(s),
      `derivatives/light-background/QANDEEL_Q_LIGHT_BG_${s}.png`, { note: 'dark neutral ink, transparent' });
  }
  shoot('derivatives/monochrome/QANDEEL_WORDMARK_MONOCHROME.svg', 2048, wmHeight(2048),
    'derivatives/monochrome/QANDEEL_WORDMARK_MONOCHROME_2048.png', { note: 'black ink, transparent' });
  shoot('derivatives/light-background/QANDEEL_WORDMARK_LIGHT_BG.svg', 2048, wmHeight(2048),
    'derivatives/light-background/QANDEEL_WORDMARK_LIGHT_BG_2048.png', { note: 'dark neutral ink, transparent' });
}

function main() {
  copyMasters();
  iosIcons();
  androidIcons();
  derivativePNGs();
  fs.mkdirSync(p('review'), { recursive: true });
  fs.writeFileSync(p('review/export-index.json'), JSON.stringify({
    engine: chrome.engineVersion(),
    generated: new Date().toISOString(),
    framing: { canonical: A.CANONICAL, android: A.ANDROID_FRAMING, perceived: A.PERCEIVED },
    assets: manifestRows,
  }, null, 2));
  console.log('engine:', chrome.engineVersion());
  console.log('exported', manifestRows.length, 'files');
  for (const r of manifestRows) {
    console.log(`  ${r.w ? (r.w + 'x' + r.h).padEnd(11) : ''.padEnd(11)} ${String(r.bytes).padStart(8)}  ${r.file}`);
  }
}

if (require.main === module) main();
module.exports = { main, manifestRows };
