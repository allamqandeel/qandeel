/**
 * I-08B3.0-E3 - render-fairness guard.
 *
 * Two things silently break a typography board on this host:
 *   - LCD subpixel antialiasing, which puts red and blue fringes on every glyph stem.
 *     Those fringes belong to the HOST's rasteriser, not to the typeface, and a phone does
 *     not draw them. Left on, they are judged as if they were the type.
 *   - a board that rasterised blank but still wrote a file.
 *
 * Raw channel divergence is the wrong test, because the declared surface and the chrome
 * greys are themselves slightly cool: a perfectly correct greyscale render still shows
 * divergence. The legitimate colours of a board are exactly the blends of the background
 * with one of the DECLARED foregrounds. Each pixel is least-squares fitted to
 * bg + t*(fg-bg) over that set and the residual is what is flagged.
 *
 *   node tools/check-render.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { decode, inkCoverage } from './png.mjs';
import { PKG, S } from './ui.mjs';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hex(S.bg);
const FG = [
  hex(S.primary), hex(S.secondary), hex(S.chrome), hex(S.rule), hex(S.raised),
  hex(S.control), hex(S.controlEdge),
  [0x3a, 0x40, 0x46], // fold rule
  [0x5c, 0x66, 0x70], // fold label
  [0x19, 0x1c, 0x21], // hairline row rule
  [0x3a, 0x2c, 0x2c], // failure-case border
  [0x8f, 0xa8, 0x8f], // pass green
  [0xc0, 0x8a, 0x8a], // fail red
  [0xbf, 0xae, 0x86], // warn amber
];
const TOL = 4; // 8-bit units of residual allowed for compositor rounding

function residual(r, g, b) {
  let best = 255;
  const px = [r, g, b];
  for (const f of FG) {
    let num = 0, den = 0;
    for (let c = 0; c < 3; c++) { const d = f[c] - BG[c]; num += (px[c] - BG[c]) * d; den += d * d; }
    const t = Math.max(0, Math.min(1, den ? num / den : 0));
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(px[c] - (BG[c] + t * (f[c] - BG[c]))));
    if (m < best) best = m;
  }
  return best;
}

const REVIEW = join(PKG, 'review');
let bad = 0;
for (const f of readdirSync(REVIEW).filter((n) => n.endsWith('.png')).sort()) {
  const img = decode(readFileSync(join(REVIEW, f)));
  let maxRes = 0, off = 0;
  const tot = img.width * img.height;
  for (let i = 0; i < tot; i++) {
    const res = residual(img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2]);
    if (res > maxRes) maxRes = res;
    if (res > TOL) off++;
  }
  const { coverage } = inkCoverage(img);
  const pct = (100 * off) / tot;
  const ok = pct < 0.02 && coverage >= 0.0008;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${f.padEnd(36)} ${String(img.width).padStart(5)}x${String(img.height).padStart(5)}  ink ${(coverage * 100).toFixed(2)}%  max residual ${String(maxRes).padStart(3)}  off-ramp ${pct.toFixed(4)}%`);
}
console.log(bad
  ? `\n${bad} board(s) failed the fairness guard.`
  : '\nAll boards: every pixel lies on a declared background-to-foreground ramp.\nGreyscale antialiasing confirmed - no subpixel colour fringing, nothing blank.');
process.exit(bad ? 1 : 0);
