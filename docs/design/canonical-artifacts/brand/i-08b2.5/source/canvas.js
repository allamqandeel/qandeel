'use strict';
// I-08B2.5 / canvas.js
// A small RGBA compositor for the review boards. Board tiles are real renders
// blitted in at their true pixel size or magnified by an integer factor with
// nearest-neighbour, so nothing on a board is a resampled approximation of the
// asset it claims to show.

const png = require('./png');
const font = require('./font');

function create(w, h, bg) {
  const data = new Uint8ClampedArray(w * h * 4);
  const [r, g, b] = bg || [8, 9, 11];
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  const C = {
    w, h, data,
    fill(x0, y0, x1, y1, r2, g2, b2) {
      const xa = Math.max(0, Math.round(x0)), xb = Math.min(w - 1, Math.round(x1));
      const ya = Math.max(0, Math.round(y0)), yb = Math.min(h - 1, Math.round(y1));
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        const i = (y * w + x) * 4;
        data[i] = r2; data[i + 1] = g2; data[i + 2] = b2; data[i + 3] = 255;
      }
    },
    // one pixel, alpha-composited
    px(x, y, r2, g2, b2, a) {
      if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return;
      const i = (y * w + x) * 4;
      data[i] = data[i] * (1 - a) + r2 * a;
      data[i + 1] = data[i + 1] * (1 - a) + g2 * a;
      data[i + 2] = data[i + 2] * (1 - a) + b2 * a;
      data[i + 3] = 255;
    },
    rect(x0, y0, x1, y1, col) { C.fill(x0, y0, x1, y1, col[0], col[1], col[2]); },
    frame(x0, y0, x1, y1, col) {
      C.fill(x0, y0, x1, y0, col[0], col[1], col[2]);
      C.fill(x0, y1, x1, y1, col[0], col[1], col[2]);
      C.fill(x0, y0, x0, y1, col[0], col[1], col[2]);
      C.fill(x1, y0, x1, y1, col[0], col[1], col[2]);
    },
    t(x, y, str, col, sc) { return font.text(C, x, y, str, col[0], col[1], col[2], sc || 2); },
    tw(str, sc) { return font.widthOf(str, sc || 2); },
    // blit a decoded image, magnified by an integer factor, through an optional
    // alpha mask function mask(u, v) -> [0,1] in destination-tile coordinates
    blit(img, dx, dy, factor, mask) {
      const f = factor || 1;
      for (let y = 0; y < img.h * f; y++) for (let x = 0; x < img.w * f; x++) {
        const sx = (x / f) | 0, sy = (y / f) | 0;
        const s = (sy * img.w + sx) * 4;
        let a = img.data[s + 3] / 255;
        if (mask) a *= mask(x / (img.w * f), y / (img.h * f));
        C.px(dx + x, dy + y, img.data[s], img.data[s + 1], img.data[s + 2], a);
      }
    },
    toBuffer() { return png.encodeRGBA(w, h, data); },
  };
  return C;
}

// ---------------------------------------------------------------------------
// platform mask shapes, evaluated in unit tile coordinates with 4x4 coverage
// ---------------------------------------------------------------------------
function shapeMask(kind, px) {
  // px is the tile's pixel size, used only to soften the boundary
  const inside = (u, v) => {
    const x = (u - 0.5) * 2, y = (v - 0.5) * 2;   // -1..1
    switch (kind) {
      case 'square': return 1;
      // iOS continuous corner: superellipse |x|^n + |y|^n <= 1, n = 5
      case 'ios': return Math.pow(Math.abs(x), 5) + Math.pow(Math.abs(y), 5) <= 1 ? 1 : 0;
      case 'circle': return x * x + y * y <= 1 ? 1 : 0;
      case 'squircle': return Math.pow(Math.abs(x), 3) + Math.pow(Math.abs(y), 3) <= 1 ? 1 : 0;
      case 'rounded': {
        const r = 0.36, ax = Math.abs(x), ay = Math.abs(y);
        if (ax <= 1 - r || ay <= 1 - r) return ax <= 1 && ay <= 1 ? 1 : 0;
        const dx = ax - (1 - r), dy = ay - (1 - r);
        return dx * dx + dy * dy <= r * r ? 1 : 0;
      }
      default: return 1;
    }
  };
  const SS = 4;
  return (u, v) => {
    let n = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      n += inside(u + ((sx + 0.5) / SS - 0.5) / px, v + ((sy + 0.5) / SS - 0.5) / px);
    }
    return n / (SS * SS);
  };
}

module.exports = { create, shapeMask };
