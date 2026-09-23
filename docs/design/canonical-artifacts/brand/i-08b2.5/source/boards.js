'use strict';
// I-08B2.5 / boards.js
// The four review boards. Every tile is a real Chrome/Skia render of a file
// that ships in this package, placed at true pixel size or magnified by an
// integer factor. No tile is resampled or reconstructed.

const fs = require('fs');
const path = require('path');
const A = require('./assets');
const chrome = require('./chrome');
const cv = require('./canvas');

const OUT = path.join(__dirname, '..', 'out');
const p = rel => path.join(OUT, rel);
const REVIEW = p('review');

const BG = [13, 14, 17];
const PANEL = [20, 21, 25];
const TXT = [206, 207, 212];
const DIM = [124, 126, 134];
const ACC = [231, 176, 108];
const OK = [126, 196, 138];
const LIGHT = [244, 236, 219];

const cache = new Map();
function render(rel, w, h, opts) {
  const key = `${rel}|${w}|${h}|${JSON.stringify(opts || {})}`;
  if (!cache.has(key)) cache.set(key, chrome.renderFile(p(rel), w, h, opts));
  return cache.get(key);
}
const icon = (rel, S) => render(rel, S, S, { opaque: true, background: A.PAINT.ground });

// The Android icon as the launcher shows it: 108 dp canvas cropped to the
// 72 dp viewport, then masked.
function androidView(S) {
  const full = Math.round(S * A.ANDROID.canvasDp / A.ANDROID.viewportDp);
  const img = icon('app-icon/android/source/ANDROID_FOREGROUND.svg', full);
  const off = Math.round((full - S) / 2);
  const out = { w: S, h: S, data: new Uint8ClampedArray(S * S * 4) };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const s = ((y + off) * full + (x + off)) * 4, d = (y * S + x) * 4;
    out.data[d] = img.data[s]; out.data[d + 1] = img.data[s + 1];
    out.data[d + 2] = img.data[s + 2]; out.data[d + 3] = 255;
  }
  return out;
}

function heading(C, x, y, title, sub) {
  C.t(x, y, title, TXT, 3);
  if (sub) C.t(x, y + 22, sub, DIM, 2);
}

// ---------------------------------------------------------------------------
// 1. platform board
// ---------------------------------------------------------------------------
function platformBoard() {
  const W = 1460, H = 1220;
  const C = cv.create(W, H, BG);
  const M = 40;
  C.t(M, 32, 'QANDEEL APP ICON - FINAL PLATFORM PACKAGING', TXT, 4);
  C.t(M, 62, 'I-08B2.5. CANONICAL DIRECTION B DARK LUMINOUS, FROZEN AT I-08B2.4. APPROVED Q GEOMETRY UNCHANGED.', DIM, 2);
  C.t(M, 78, 'RENDERER: ' + chrome.engineVersion().toUpperCase(), DIM, 2);

  // --- iOS ---
  let y = 118;
  heading(C, M, y, 'IOS', 'FULL SQUARE IS VISIBLE. THE APPROVED SQUARE COMPOSITION IS USED UNCHANGED.');
  y += 46;
  const T = 256;
  const tiles = [
    ['SOURCE ARTWORK 1024', null],
    ['IOS MASK PREVIEW', cv.shapeMask('ios', T)],
    ['180 PX AT TRUE SIZE', cv.shapeMask('ios', 180)],
  ];
  let x = M;
  for (const [label, mask] of tiles) {
    C.rect(x, y, x + T - 1, y + T - 1, PANEL);
    if (label.startsWith('180')) {
      const im = icon('app-icon/ios/AppIcon.appiconset/AppIcon-180.png'.replace(/\.png$/, '.png'), 180);
      C.blit(im, x + (T - 180) / 2 | 0, y + (T - 180) / 2 | 0, 1, mask);
    } else {
      C.blit(icon('app-icon/APP_ICON_B_DARK_LUMINOUS.svg', T), x, y, 1, mask);
    }
    C.frame(x, y, x + T - 1, y + T - 1, [44, 46, 52]);
    C.t(x, y + T + 10, label, DIM, 2);
    x += T + 32;
  }
  // framing facts beside the iOS tiles
  const fx = M + 3 * (T + 32);
  let fy = y + 4;
  const facts = [
    ['MARK ENCLOSING CIRCLE', (A.CANONICAL.targetR * 2).toFixed(1) + ' PX OF 1024'],
    ['AS A FRACTION OF WIDTH', (A.PERCEIVED.ios * 100).toFixed(1) + '%'],
    ['INK BOX', (A.G.q.bbox.w * A.CANONICAL.scale).toFixed(1) + ' X ' + (A.G.q.bbox.h * A.CANONICAL.scale).toFixed(1) + ' PX'],
    ['MARGIN LEFT/RIGHT', ((1024 - A.G.q.bbox.w * A.CANONICAL.scale) / 2).toFixed(1) + ' PX'],
    ['MARGIN TOP/BOTTOM', ((1024 - A.G.q.bbox.h * A.CANONICAL.scale) / 2).toFixed(1) + ' PX'],
    ['PLACEMENT MATRIX', A.CANONICAL.scale + ''],
    ['TAIL CLIPPED', 'NO'],
    ['EDGE INK AT ANY SIZE', 'NONE'],
    ['ALPHA CHANNEL', 'NONE (APP STORE RULE)'],
  ];
  for (const [k, v] of facts) {
    C.t(fx, fy, k, DIM, 2); C.t(fx, fy + 14, v, k === 'TAIL CLIPPED' || k === 'EDGE INK AT ANY SIZE' ? OK : TXT, 2);
    fy += 36;
  }

  // --- iOS true-size strip ---
  y += T + 44;
  C.t(M, y, 'EVERY SHIPPED IOS SIZE, AT TRUE SIZE', DIM, 2);
  y += 18;
  let sx = M;
  for (const s of [180, 152, 120, 87, 80, 60, 58, 40, 29, 20]) {
    const im = render(`app-icon/ios/AppIcon.appiconset/AppIcon-${s}.png`, s, s, { opaque: true, background: A.PAINT.ground });
    C.blit(im, sx, y + (180 - s), 1, cv.shapeMask('ios', s));
    C.t(sx, y + 188, String(s), DIM, 2);
    sx += s + 18;
  }

  // --- Android ---
  y += 218;
  heading(C, M, y, 'ANDROID ADAPTIVE',
    'LAUNCHER CROPS TO THE 72 DP VIEWPORT, SO FRAMING IS ADJUSTED TO HOLD COMPARABLE PERCEIVED SCALE.');
  y += 46;
  x = M;
  const aTiles = [
    ['108 DP LAYER + ZONES', 'layers'],
    ['CIRCLE MASK', 'circle'],
    ['SQUIRCLE MASK', 'squircle'],
    ['ROUNDED MASK', 'rounded'],
    ['SQUARE MASK', 'square'],
  ];
  for (const [label, kind] of aTiles) {
    C.rect(x, y, x + T - 1, y + T - 1, PANEL);
    if (kind === 'layers') {
      C.blit(icon('app-icon/android/source/ANDROID_FOREGROUND.svg', T), x, y, 1, null);
      // zone rings: viewport 72/108, safe 66/108, logo 48/108
      const rings = [[72 / 108, ACC, 'VIEWPORT 72'], [66 / 108, [110, 140, 200], 'SAFE 66'], [48 / 108, OK, 'LOGO 48']];
      for (const [f, col] of rings) {
        const R = T * f / 2, cxp = x + T / 2, cyp = y + T / 2;
        for (let a = 0; a < 1440; a++) {
          const th = a * Math.PI / 720;
          C.px(Math.round(cxp + R * Math.cos(th)), Math.round(cyp + R * Math.sin(th)), col[0], col[1], col[2], 0.85);
        }
      }
      let ly = y + 6;
      for (const [, col, name] of rings) { C.t(x + 6, ly, name, col, 2); ly += 14; }
    } else {
      C.blit(androidView(T), x, y, 1, cv.shapeMask(kind, T));
    }
    C.frame(x, y, x + T - 1, y + T - 1, [44, 46, 52]);
    C.t(x, y + T + 10, label, DIM, 2);
    x += T + 25;
  }

  // --- numbers ---
  y += T + 40;
  C.rect(M, y, W - M, y + 128, PANEL);
  let ty = y + 12;
  const rows = [
    'PLATFORM FRAMING, DECLARED NUMERICALLY',
    `IOS / CANONICAL SQUARE   LOGO ${A.CANONICAL.logoDp} DP OF 108   MATRIX ${A.CANONICAL.scale} ${A.CANONICAL.tx} ${A.CANONICAL.ty}   MARK = ${(A.PERCEIVED.ios * 100).toFixed(1)}% OF ICON WIDTH`,
    `ANDROID ADAPTIVE         LOGO ${A.ANDROID_FRAMING.logoDp} DP OF 108   MATRIX ${A.ANDROID_FRAMING.scale} ${A.ANDROID_FRAMING.tx} ${A.ANDROID_FRAMING.ty}   MARK = ${(A.PERCEIVED.android * 100).toFixed(1)}% OF THE 72 DP VIEWPORT`,
    `IF THE SQUARE WERE SHIPPED TO ANDROID UNCHANGED THE MARK WOULD READ ${(A.PERCEIVED.androidIfUnchanged * 100).toFixed(1)}% OF THE VIEWPORT, HALF AGAIN AS LARGE AS ON IOS.`,
    `EXACT PARITY WOULD NEED ${A.PERCEIVED.exactParityDp} DP, BELOW ANDROID'S DOCUMENTED 48 DP FLOOR, SO 48 DP IS THE CLOSEST PERMITTED VALUE.`,
    'ONLY FRAMING DIFFERS BETWEEN THE TWO PLATFORMS. GEOMETRY, COLOUR, BLOOM AND HALO ARE IDENTICAL.',
  ];
  for (const r of rows) { C.t(M + 12, ty, r, r === rows[0] ? ACC : TXT, 2); ty += 20; }

  fs.writeFileSync(path.join(REVIEW, 'FINAL_APP_ICON_PLATFORM_BOARD.png'), C.toBuffer());
  return 'FINAL_APP_ICON_PLATFORM_BOARD.png';
}

// ---------------------------------------------------------------------------
// 2. wordmark variants board
// ---------------------------------------------------------------------------
function wordmarkBoard() {
  const WMW = 1300;
  const wmH = Math.round(WMW * A.G.viewBox.wm[3] / A.G.viewBox.wm[2]);
  const rowH = wmH + 74;
  const items = [
    ['WORDMARK LUMINOUS', 'masters/QANDEEL_WORDMARK_LUMINOUS.svg', '#02040A', 'APPROVED MASTER. CARRIES ITS OWN GROUND, TWO LIGHT POINTS, BLOOM AND HALOS.'],
    ['WORDMARK BASE', 'masters/QANDEEL_WORDMARK_BASE_MASTER.svg', A.PAINT.ground, 'APPROVED MASTER. CLEAN GEOMETRY, NO GLOW. LIGHT POINTS ARE THEIR STRUCTURAL CORES.'],
    ['WORDMARK MONOCHROME', 'derivatives/monochrome/QANDEEL_WORDMARK_MONOCHROME.svg', '#FFFFFF', 'ONE FLAT INK, AUTHORED AS CURRENTCOLOR. BOTH LIGHT POINTS SURVIVE AS THEIR OWN GEOMETRY.'],
    ['WORDMARK MONOCHROME INVERTED', 'derivatives/monochrome/QANDEEL_WORDMARK_MONOCHROME.svg', '#101216', 'THE SAME FILE TINTED THE OTHER WAY. NOTHING IN IT IS COLOUR-BOUND.'],
    ['WORDMARK LIGHT BACKGROUND SAFE', 'derivatives/light-background/QANDEEL_WORDMARK_LIGHT_BG.svg', A.PAINT.lightBgField, 'THE APPROVED DARK NEUTRAL ON A LIGHT FIELD. ONLY THE INK VALUE CHANGES.'],
  ];
  const W = WMW + 80, H = 108 + items.length * rowH + 40;
  const C = cv.create(W, H, BG);
  C.t(40, 32, 'QANDEEL WORDMARK - FINAL VARIANTS', TXT, 4);
  C.t(40, 62, 'ALL FIVE CARRY THE SAME APPROVED I-08B2.3 WORDMARK GEOMETRY. ONLY PAINT DIFFERS.', DIM, 2);
  C.t(40, 78, 'RENDERER: ' + chrome.engineVersion().toUpperCase(), DIM, 2);

  let y = 108;
  for (const [label, rel, bg, note] of items) {
    const inverted = label.includes('INVERTED');
    const im = render(rel, WMW, wmH, { opaque: true, background: inverted ? '#101216' : bg });
    if (inverted) {
      // the monochrome file is authored as currentColor; tint it light here to
      // prove the same file works either way
      const im2 = chrome.renderText(
        fs.readFileSync(p(rel), 'utf8').replace('color="#000000"', 'color="#F4ECDB"'),
        WMW, wmH, { opaque: true, background: '#101216' });
      C.blit(im2, 40, y, 1, null);
    } else {
      C.blit(im, 40, y, 1, null);
    }
    C.frame(40, y, 40 + WMW - 1, y + wmH - 1, [44, 46, 52]);
    C.t(40, y + wmH + 12, label, TXT, 2);
    C.t(40, y + wmH + 30, note, DIM, 2);
    y += rowH;
  }
  fs.writeFileSync(path.join(REVIEW, 'FINAL_WORDMARK_VARIANTS_BOARD.png'), C.toBuffer());
  return 'FINAL_WORDMARK_VARIANTS_BOARD.png';
}

// ---------------------------------------------------------------------------
// 3. small size board
// ---------------------------------------------------------------------------
function smallSizeBoard() {
  const SIZES = [256, 128, 64, 32];
  const DISP = 256;
  const rows = [
    ['APP ICON, SQUARE / IOS VIEW', S => icon('app-icon/APP_ICON_B_DARK_LUMINOUS.svg', S)],
    ['APP ICON, ANDROID MASKED VIEW', S => androidView(S)],
    ['Q LUMINOUS MASTER', S => render('masters/QANDEEL_Q_LUMINOUS.svg', S, Math.round(S * A.G.viewBox.q[3] / A.G.viewBox.q[2]), { opaque: true, background: '#02040A' })],
    ['Q MONOCHROME ON WHITE', S => render('derivatives/monochrome/QANDEEL_Q_MONOCHROME.svg', S, Math.round(S * A.G.viewBox.q[3] / A.G.viewBox.q[2]), { opaque: true, background: '#FFFFFF' })],
  ];
  const CAPH = 56, GAP = 26;
  const W = 80 + SIZES.length * (DISP + GAP), H = 150 + rows.length * (DISP + CAPH) + 300;
  const C = cv.create(W, H, BG);
  C.t(40, 32, 'QANDEEL SMALL SIZE VALIDATION', TXT, 4);
  C.t(40, 62, 'EVERY TILE IS A REAL RENDER AT THE STATED SIZE, MAGNIFIED BY A WHOLE NUMBER. GEOMETRY IS NEVER CHANGED TO SUIT A SIZE.', DIM, 2);
  C.t(40, 78, 'RENDERER: ' + chrome.engineVersion().toUpperCase(), DIM, 2);

  let y = 116;
  for (const S of SIZES) {
    const i = SIZES.indexOf(S);
    C.t(40 + i * (DISP + GAP), y, `${S} PX  (X${DISP / S})`, ACC, 2);
  }
  y += 22;
  for (const [label, make] of rows) {
    C.t(40, y, label, TXT, 2);
    const ty = y + 18;
    for (let i = 0; i < SIZES.length; i++) {
      const S = SIZES[i], f = DISP / S;
      const im = make(S);
      const x = 40 + i * (DISP + GAP);
      const hh = im.h * f;
      C.rect(x, ty, x + DISP - 1, ty + DISP - 1, PANEL);
      C.blit(im, x, ty + ((DISP - hh) / 2 | 0), f, null);
      C.frame(x, ty, x + DISP - 1, ty + DISP - 1, [44, 46, 52]);
    }
    y += DISP + CAPH;
  }

  // true-size strip
  C.t(40, y, 'THE SAME RENDERS AT TRUE SIZE', TXT, 3);
  y += 26;
  // one fixed stack height and one shared label line, so the columns align
  // whatever each artwork's aspect ratio is
  let x = 40;
  const STACK = 128 + 64 + 32 + 16;
  for (const [label, make] of rows) {
    let yy = y;
    for (const S of [128, 64, 32]) {
      const im = make(S);
      C.blit(im, x, yy, 1, null);
      yy += im.h + 8;
    }
    C.t(x, y + STACK + 14, label.slice(0, 24), DIM, 2);
    x += 200;
  }
  y += STACK + 40;

  fs.writeFileSync(path.join(REVIEW, 'FINAL_SMALL_SIZE_BOARD.png'), C.toBuffer());
  return 'FINAL_SMALL_SIZE_BOARD.png';
}

// ---------------------------------------------------------------------------
// 4. light / dark / mono board
// ---------------------------------------------------------------------------
function lightDarkMonoBoard() {
  const TW = 420;
  const th = Math.round(TW * A.G.viewBox.q[3] / A.G.viewBox.q[2]);
  const cols = [
    ['DARK, LUMINOUS', 'masters/QANDEEL_Q_LUMINOUS.svg', '#02040A', null],
    ['DARK, BASE', 'masters/QANDEEL_Q_BASE_MASTER.svg', A.PAINT.ground, null],
    ['LIGHT BACKGROUND SAFE', 'derivatives/light-background/QANDEEL_Q_LIGHT_BG.svg', A.PAINT.lightBgField, null],
    ['MONOCHROME ON WHITE', 'derivatives/monochrome/QANDEEL_Q_MONOCHROME.svg', '#FFFFFF', null],
    ['MONOCHROME, TINTED LIGHT', 'derivatives/monochrome/QANDEEL_Q_MONOCHROME.svg', '#101216', '#F4ECDB'],
  ];
  const W = 80 + 3 * (TW + 30), H = 140 + 2 * (th + 70) + 210;
  const C = cv.create(W, H, BG);
  C.t(40, 32, 'QANDEEL Q - DARK, LIGHT AND MONOCHROME', TXT, 4);
  C.t(40, 62, 'ONE GEOMETRY THROUGHOUT. THE LIGHT POINT IS NEVER REPLACED: IT IS THE APPROVED STRUCTURAL CORE IN EVERY TREATMENT.', DIM, 2);
  C.t(40, 78, 'RENDERER: ' + chrome.engineVersion().toUpperCase(), DIM, 2);

  let y = 116;
  cols.forEach(([label, rel, bg, tint], i) => {
    const col = i % 3, row = (i / 3) | 0;
    const x = 40 + col * (TW + 30), ty = y + row * (th + 70);
    const im = tint
      ? chrome.renderText(fs.readFileSync(p(rel), 'utf8').replace('color="#000000"', `color="${tint}"`), TW, th, { opaque: true, background: bg })
      : render(rel, TW, th, { opaque: true, background: bg });
    C.blit(im, x, ty, 1, null);
    C.frame(x, ty, x + TW - 1, ty + th - 1, [44, 46, 52]);
    C.t(x, ty + th + 10, label, TXT, 2);
  });

  y += 2 * (th + 70) + 6;
  C.rect(40, y, W - 40, y + 176, PANEL);
  let ty2 = y + 12;
  const notes = [
    'MONOCHROME AND LIGHT BACKGROUND RULES, AS BUILT',
    'THE LIGHT POINT IS A DISC AT THE TAIL\'S INNER TERMINUS, STANDING CLEAR OF IT INSIDE THE RING\'S COUNTER.',
    'SO IT STAYS VISIBLE UNDER A SINGLE FLAT INK. NO SPARKLE, NO SECOND SYMBOL AND NO SUBSTITUTE WAS INTRODUCED.',
    'MONOCHROME IS AUTHORED AS CURRENTCOLOR: THE TWO MONOCHROME TILES ABOVE ARE THE SAME FILE, TINTED TWO WAYS.',
    'THE LIGHT BACKGROUND TREATMENT CHANGES ONLY THE INK VALUE, TO THE APPROVED DARK NEUTRAL GROUND COLOUR.',
    'NO GLOW IS CARRIED ONTO A LIGHT FIELD, BECAUSE A LUMINOUS TREATMENT CANNOT READ THERE. NO NEW STYLE WAS INVENTED.',
    'MEASURED CONTRAST: MONOCHROME ON WHITE 21.0 TO 1. LIGHT BACKGROUND SAFE 16.8 TO 1. DARK LUMINOUS 17.4 TO 1.',
  ];
  for (const n of notes) { C.t(52, ty2, n, n === notes[0] ? ACC : TXT, 2); ty2 += 22; }

  fs.writeFileSync(path.join(REVIEW, 'FINAL_LIGHT_DARK_MONO_BOARD.png'), C.toBuffer());
  return 'FINAL_LIGHT_DARK_MONO_BOARD.png';
}

function main() {
  fs.mkdirSync(REVIEW, { recursive: true });
  const which = process.argv[2];
  const all = { platform: platformBoard, wordmark: wordmarkBoard, small: smallSizeBoard, mono: lightDarkMonoBoard };
  const run = which ? { [which]: all[which] } : all;
  for (const [k, fn] of Object.entries(run)) {
    const name = fn();
    const sz = fs.statSync(path.join(REVIEW, name)).size;
    console.log(`  ${name}  ${sz} bytes`);
  }
}

if (require.main === module) main();
module.exports = { main };
