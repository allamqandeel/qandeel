// COSMOS-INT-01 Slice E iOS World gate (first written for the baseline audit): find a COSMOS node core on a simulator screenshot, so the
// runner can tap the map as a reader would. The HONOR finder (QANDEEL_REPORTS/COSMOS-V5/integration/scripts/nodes.mjs),
// with the stage band given as a fraction of the screenshot height instead of HONOR pixels.
// A node core is a compact WHITE blob; its identity is the hue of its halo ring.
// usage: node nodes.mjs --hue <h> <png> [widthPoints]  -> "x,y" (integer screen points) of the largest core whose halo hue
//                                                           is within 25° of h, or "none"
//        node nodes.mjs --any <png> [widthPoints]       -> the largest core of any hue, or "none"
//        node nodes.mjs --in x,y,w,h <png> widthPoints -> the largest core inside that rectangle (screen points), or "none"
// Maestro accepts only INTEGER percentages or points (R3: "80.4%,54.3%" made every node tap fail), so the result is in
// points: pixels x widthPoints / screenshot width. Without widthPoints it falls back to integer percentages.
// A core is first a WHITE blob (min channel >= 228); if none is found, a BRIGHT one (min channel >= 170, thinner erosion: a 2x small iPhone draws smaller cores), for Worlds whose
// cores render tinted.
//        node nodes.mjs <png>             -> every core: "hue@x,y,size"
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/package.json`);
const { PNG } = require('pngjs');

const load = (f) => PNG.sync.read(fs.readFileSync(f));
const px = (p, x, y) => { const i = (y * p.width + x) * 4; return [p.data[i], p.data[i + 1], p.data[i + 2]]; };
let MIN = 228, SPREAD = 26, ER = 2;
const white = (p, x, y) => { const [r, g, b] = px(p, x, y); return Math.min(r, g, b) >= MIN && Math.max(r, g, b) - Math.min(r, g, b) <= SPREAD; };
const hueOf = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return null; const d = mx - mn; if (d / mx < 0.25) return null; let h; if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; return ((h * 60) + 360) % 360; };
const hueDiff = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

function halo(p, cx, cy, rad) {
  const r0 = rad + 3, r1 = rad + 18; let sx = 0, sy = 0, n = 0;
  for (let y = Math.floor(cy - r1); y <= Math.ceil(cy + r1); y += 1) for (let x = Math.floor(cx - r1); x <= Math.ceil(cx + r1); x += 1) {
    if (x < 0 || y < 0 || x >= p.width || y >= p.height) continue;
    const d = Math.hypot(x - cx, y - cy); if (d < r0 || d > r1) continue;
    const h = hueOf(...px(p, x, y)); if (h === null) continue;
    sx += Math.cos((h * Math.PI) / 180); sy += Math.sin((h * Math.PI) / 180); n += 1;
  }
  return n < 12 ? null : ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
}

function cores(p) {
  // The stage band: below the top band, above the timeline / sheet region.
  const x0 = 0, x1 = p.width - 1, y0 = Math.round(p.height * 0.14), y1 = Math.round(p.height * 0.80);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const raw = new Uint8Array(w * h); const on = new Uint8Array(w * h);
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) if (white(p, x, y)) raw[(y - y0) * w + (x - x0)] = 1;
  const E = ER;
  for (let y = E; y < h - E; y += 1) for (let x = E; x < w - E; x += 1) {
    let all = 1;
    for (let dy = -E; dy <= E && all; dy += 1) for (let dx = -E; dx <= E; dx += 1) if (!raw[(y + dy) * w + x + dx]) { all = 0; break; }
    on[y * w + x] = all;
  }
  const seen = new Uint8Array(w * h); const out = [];
  for (let i = 0; i < w * h; i += 1) {
    if (!on[i] || seen[i]) continue;
    const st = [i]; seen[i] = 1; let n = 0, sx = 0, sy = 0, bx0 = w, bx1 = -1, by0 = h, by1 = -1;
    while (st.length) {
      const k = st.pop(); const kx = k % w, ky = (k - kx) / w; n += 1; sx += kx; sy += ky;
      bx0 = Math.min(bx0, kx); bx1 = Math.max(bx1, kx); by0 = Math.min(by0, ky); by1 = Math.max(by1, ky);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = kx + dx, ny = ky + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; if (on[j] && !seen[j]) { seen[j] = 1; st.push(j); }
      }
    }
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
    if (n < 6 || n > 20000 || bw / bh < 0.5 || bw / bh > 2 || n / (bw * bh) < 0.4) continue;
    const X = x0 + sx / n, Y = y0 + sy / n;
    const hue = halo(p, X, Y, Math.max(bw, bh) / 2);
    if (hue === null) continue;
    out.push({ x: X, y: Y, n, hue });
  }
  return out;
}

const [mode, a, b, c3] = process.argv.slice(2);
const WPT = Number(mode === '--hue' || mode === '--in' ? c3 : b) || 0;
const pct = (p, c) => (WPT ? `${Math.round((c.x * WPT) / p.width)},${Math.round((c.y * WPT) / p.width)}`
  : `${Math.round((c.x / p.width) * 100)}%,${Math.round((c.y / p.height) * 100)}%`);
const found = (p) => { let r = cores(p); if (!r.length) { MIN = 170; SPREAD = 90; ER = 1; r = cores(p); MIN = 228; SPREAD = 26; ER = 2; } return r; };
if (mode === '--hue') {
  const p = load(b); const m = found(p).filter((c) => hueDiff(c.hue, Number(a)) <= 25).sort((x, y) => y.n - x.n)[0];
  console.log(m ? pct(p, m) : 'none');
} else if (mode === '--in') {
  // --in x,y,w,h <png> <widthPoints>: the largest core whose centre lies inside that rectangle of screen points.
  const [rx, ry, rw, rh] = a.split(',').map(Number); const p = load(b); const k = WPT / p.width;
  const m = found(p).filter((c) => c.x * k >= rx && c.x * k <= rx + rw && c.y * k >= ry && c.y * k <= ry + rh).sort((x, y) => y.n - x.n)[0];
  console.log(m ? pct(p, m) : 'none');
} else if (mode === '--any') {
  const p = load(a); const m = found(p).sort((x, y) => y.n - x.n)[0];
  console.log(m ? pct(p, m) : 'none');
} else {
  const p = load(mode);
  console.log(cores(p).map((c) => `${c.hue.toFixed(0)}@${pct(p, c)},${c.n}`).join('  ') || 'none');
}
