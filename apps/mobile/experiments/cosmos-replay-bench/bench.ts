// COSMOS Replay picture-track bench (experimental, measurement only). Rasterises the COSMOS stage headlessly on the CPU
// (Skia via @napi-rs/canvas; no GPU, no browser) from the SAME baked assets the app ships, at 720x1280 @ 30 fps.
// Picture only: no audio, no captions, no source text, no A/V sync, synthetic fixture. NOT the Replay renderer, not CP2-A.
// Modes:  node bench.cjs time <frames> <entities:fixture|400>     → render-only timing, in process
//         node bench.cjs pipe <count> <from> <entities>           → raw RGBA frames to stdout (for an encoder)
import { fixtureField } from '../../src/integration/__validation__/s503b-visual-field';
import { publicScene } from '../../src/cosmos/core/adapters';
import { depthOf, layerOpacities, matrixOf, type NasijCamera, type NasijView } from '../../src/cosmos/core/camera';
import { TINTS } from '../../src/cosmos/core/atmosphere';
import { ATLAS_RECTS } from '../../src/cosmos/assets/atlas';
import { compileStage, rungScale, SPRITE_STRIDE, type Hairlines, type Stage } from '../../src/cosmos/core/stage';
declare const require: (m: string) => any; declare const process: any; declare const __dirname: string;
const { createCanvas, loadImage, Path2D } = require('@napi-rs/canvas'); const fs = require('node:fs');
const ASSETS = process.env.COSMOS_ASSETS; const W = 720, H = 1280, FPS = 30, S = W / 360;

function entries(kind: string) {
  if (kind === '400') { let seed = 20261114; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    return Array.from({ length: 400 }, (_u, i) => { const c = i % 16; return { id: `dense-${i}`, address: { x: BigInt(Math.round(((c % 4) - 1.5) * 1_500_000 + (rnd() - 0.5) * 900_000)), y: BigInt(Math.round((Math.floor(c / 4) - 1.5) * 1_500_000 + (rnd() - 0.5) * 900_000)) }, meaning: `Stress entry ${i + 1}`, region: `c${c}` }; }); }
  const whole = `minX=${-(2n ** 62n)}&minY=${-(2n ** 62n)}&maxX=${2n ** 62n - 1n}&maxY=${2n ** 62n - 1n}`;
  return (fixtureField(whole)?.experiences ?? []).map((e) => ({ id: e.id, address: { x: BigInt(e.x), y: BigInt(e.y) }, meaning: e.meaning, region: e.region }));
}
/** Five minutes: slow drift; every 20 s one depth change (FAR → MID → NEAR on the entry nearest the origin → MID → FAR). */
function cameraAt(t: number, tx: number, ty: number): NasijCamera {
  const seg = Math.floor(t / 20); const cycle = [0, 1, 2, 1]; const from = cycle[seg % 4]; const to = cycle[(seg + 1) % 4];
  const u = Math.min(1, Math.max(0, t - seg * 20 - 18.5) / 1.5); const e = u * u * (3 - 2 * u); const depth = from + (to - from) * e;
  const near = Math.min(1, depth); const drift = 1 - near * 0.92;
  return { cx: tx * near + Math.sin(t / 37) * 110 * drift, cy: ty * near + Math.cos(t / 53) * 140 * drift, scale: Math.pow(8, depth) };
}
async function main() {
  const [mode, a2, a3, a4] = process.argv.slice(2); const kind = (mode === 'time' ? a3 : a4) ?? 'fixture';
  const list = entries(kind); const tgt = list.map((e) => ({ id: e.id, x: Number(e.address.x) / 8192, y: -Number(e.address.y) / 8192 })).reduce((a, q) => (Math.hypot(q.x, q.y) < Math.hypot(a.x, a.y) ? q : a));
  // Two stages: unfocused for FAR/MID, focused for NEAR (a Replay would hold one stage per disclosed position).
  const t0 = performance.now();
  const stages: Stage[] = [null, tgt.id].map((focusId) => compileStage(publicScene({ entries: list as never, focusId, section: null, focusMotes: focusId ? 2 : undefined, rtl: true }, { x: 0n, y: 0n })));
  const compileMs = performance.now() - t0;
  const atlas = await loadImage(`${ASSETS}/light-atlas.png`);
  const plates = { deep: await loadImage(`${ASSETS}/public-deep.jpg`), gas: await loadImage(`${ASSETS}/public-gas.jpg`), veil: await loadImage(`${ASSETS}/public-veil.jpg`) };
  const tinted = TINTS.map((tint) => ATLAS_RECTS.map(([x, y, w, h]) => { const c = createCanvas(w, h); const g = c.getContext('2d'); g.drawImage(atlas, x, y, w, h, 0, 0, w, h); g.globalCompositeOperation = 'source-in'; g.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`; g.fillRect(0, 0, w, h); return c; }));
  const canvas = createCanvas(W, H); const ctx = canvas.getContext('2d');
  const pat = { deep: ctx.createPattern(plates.deep, 'repeat'), gas: ctx.createPattern(plates.gas, 'repeat'), veil: ctx.createPattern(plates.veil, 'repeat') };
  const paths = new Map<Hairlines, any>();
  const pathOf = (set: Hairlines) => { let p = paths.get(set); if (!p) { p = new Path2D(); const d = set.data; for (let i = 0; i < d.length;) { const n = d[i]; p.moveTo(d[i + 1], d[i + 2]); for (let j = 1; j < n; j += 1) p.lineTo(d[i + 1 + j * 2], d[i + 2 + j * 2]); i += 1 + n * 2; } paths.set(set, p); } return p; };
  const v: NasijView = { width: W / S, height: H / S, focusX: W / S / 2, focusY: H / S / 2 }; const zGas = Math.log(2.3) / Math.log(64);
  const frame = (t: number) => {
    const cam = cameraAt(t, tgt.x, tgt.y); const stage = stages[depthOf(cam.scale) > 1.5 ? 1 : 0];
    const plate = (p: any, size: number, zExp: number, pan: number, dx: number, dy: number, mode: string) => {
      const k = (1.05 * Math.pow(cam.scale, zExp) * 900) / size * S; const shift = Math.pow(cam.scale, 0.55) * S;
      const m = { a: k, b: 0, c: 0, d: k, e: v.focusX * S - size * k * 0.5 - cam.cx * shift * pan + dx * t * S, f: v.focusY * S - size * k * 0.5 - cam.cy * shift * pan + dy * t * S };
      p.setTransform(m); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = mode; ctx.globalAlpha = 1; ctx.fillStyle = p; ctx.fillRect(0, 0, W, H);
    };
    plate(pat.deep, 1024, zGas * 0.45, 0.35, 0, 0, 'source-over'); plate(pat.gas, 1024, zGas, 0.9, 1.1, 0.45, 'lighter');
    const m = matrixOf(cam, v); const alphas = layerOpacities(depthOf(cam.scale), 3); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const x0 = (0 - v.focusX) / cam.scale + cam.cx; const x1 = (v.width - v.focusX) / cam.scale + cam.cx; const y0 = (0 - v.focusY) / cam.scale + cam.cy; const y1 = (v.height - v.focusY) / cam.scale + cam.cy;
    stage.layers.forEach((layer, r) => {
      const la = alphas[r]; if (la <= 0.01) return; const sp = layer.sprites;
      for (let i = 0; i < sp.length; i += SPRITE_STRIDE) {
        const x = sp[i]; const y = sp[i + 1]; const d = sp[i + 2]; if (x + d < x0 || x - d > x1 || y + d < y0 || y - d > y1) continue;
        const rot = sp[i + 6]; const c = Math.cos(rot) * m[0] * S; const sn = Math.sin(rot) * m[0] * S;
        ctx.globalAlpha = Math.min(1, la * sp[i + 5]); ctx.setTransform(c, sn, -sn, c, (x * m[0] + m[4]) * S, (y * m[3] + m[5]) * S); ctx.drawImage(tinted[sp[i + 4]][sp[i + 3]], -d / 2, -d / 2, d, d);
      }
      ctx.setTransform(m[0] * S, 0, 0, m[3] * S, m[4] * S, m[5] * S);
      for (const set of layer.lines) { ctx.globalAlpha = la * set.alpha; ctx.strokeStyle = `rgb(${TINTS[set.tint].join(',')})`; ctx.lineWidth = set.width / rungScale(r); ctx.stroke(pathOf(set)); }
    });
    plate(pat.veil, 512, zGas * 1.7, 2.4, -2.6, 1.2, 'lighter');
    ctx.setTransform(S, 0, 0, S, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.font = '600 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    stage.layers.forEach((layer, r) => { if (alphas[r] <= 0.05) return; ctx.globalAlpha = alphas[r]; let n = 0; for (const l of layer.labels) { const x = (l.x - cam.cx) * cam.scale + v.focusX; const y = (l.y - cam.cy) * cam.scale + v.focusY; if (x < 24 || x > v.width - 24 || y < 60 || y > v.height - 40) continue; ctx.fillText(l.text, x, y + 14); if (++n > 24) break; } });
    ctx.globalAlpha = 1;
  };
  if (mode === 'pipe') { const n = Number(a2); const f0 = Number(a3); for (let f = f0; f < f0 + n; f += 1) { frame(f / FPS); fs.writeSync(1, canvas.data()); } return; }
  const frames = Number(a2); const times: number[] = []; const start = performance.now();
  for (let f = 0; f < frames; f += 1) { const s = performance.now(); frame(f / FPS); ctx.getImageData(0, 0, 1, 1); times.push(performance.now() - s); if (f === 150 || f === 630 || f === 1290) fs.writeFileSync(`${process.env.COSMOS_OUT}/replay-${kind}-${f}.png`, canvas.toBuffer('image/png')); }
  const total = performance.now() - start; const byDepth = [0, 1, 2].map((d) => { const xs = times.filter((_t, f) => Math.round(depthOf(cameraAt(f / FPS, 0, 0).scale)) === d); return xs.length ? +(xs.reduce((a, c) => a + c, 0) / xs.length).toFixed(2) : null; });
  times.sort((a, b) => a - b);
  console.log(JSON.stringify({ entities: list.length, frames, compileMs: +compileMs.toFixed(1), digests: stages.map((s) => s.digest), renderSeconds: +(total / 1000).toFixed(1), msPerFrame: { mean: +(total / frames).toFixed(2), p50: +times[frames >> 1].toFixed(2), p95: +times[Math.floor(frames * 0.95)].toFixed(2), max: +times[frames - 1].toFixed(1), meanAtFarMidNear: byDepth }, framesPerCoreSecond: +(frames / (total / 1000)).toFixed(1), peakRssMb: Math.round(process.memoryUsage().rss / 1048576) }));
}
main();
