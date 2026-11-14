// NASIJ Replay feasibility bench (experimental). Rasterises the SAME draw list headlessly on the CPU (Skia via
// @napi-rs/canvas, no GPU, no browser) at the Replay target of 720x1280 @ 30 fps and reports the measured cost per frame.
// It renders pictures only: no audio, no captions, no encode. It is a measurement, not the Replay renderer.
import { compileNasij, rungScale, type Batch, type NasijDrawList } from '../../src/nasij/core/scene';
import { layerOpacities, depthOf, matrixOf, weaveOctaves, type NasijCamera, type NasijView } from '../../src/nasij/core/camera';
import { DAY_CLOTH } from '../../src/nasij/core/palette';
declare const require: (m: string) => any; declare const process: any;
const { createCanvas, Path2D } = require('@napi-rs/canvas');
const fs = require('node:fs');

const W = 720, H = 1280, FPS = 30, S = W / 360; // 360pt-wide layout at 2x
function field(n: number) {
  let seed = 20261114; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: n }, (_u, i) => { const c = i % 16; return { id: `e${i}`, kind: 'EXPERIENCE' as const, x: ((c % 4) - 1.5) * 180 + (rnd() - 0.5) * 110, y: (Math.floor(c / 4) - 1.5) * 180 + (rnd() - 0.5) * 110, dye: (c % 6) as 0, label: `Entry ${i}`, fromRung: 0, region: `c${c}` }; });
}
const paths = new Map<Batch, any>();
const pathOf = (b: Batch) => { let p = paths.get(b); if (!p) { p = new Path2D(); const d = b.data; for (let i = 0; i < d.length;) { const n = d[i]; p.moveTo(d[i + 1], d[i + 2]); for (let j = 1; j < n; j += 1) p.lineTo(d[i + 1 + j * 2], d[i + 2 + j * 2]); if (b.t === 'fill') p.closePath(); i += 1 + n * 2; } paths.set(b, p); } return p; };

function frame(ctx: any, list: NasijDrawList, cam: NasijCamera, tile: any): void {
  const p = DAY_CLOTH; const v: NasijView = { width: W / S, height: H / S, focusX: W / S / 2, focusY: H / S / 2 };
  ctx.setTransform(S, 0, 0, S, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = p.colors.ground; ctx.fillRect(0, 0, v.width, v.height);
  for (const o of weaveOctaves(cam.scale)) { // weave as lines: the cheapest portable form
    const sp = o.spacing * cam.scale; if (sp < 3) continue;
    const ox = ((v.focusX - cam.cx * cam.scale) % sp + sp) % sp; const oy = ((v.focusY - cam.cy * cam.scale) % sp + sp) % sp;
    ctx.beginPath(); for (let x = ox; x < v.width; x += sp) { ctx.moveTo(x, 0); ctx.lineTo(x, v.height); } for (let y = oy; y < v.height; y += sp) { ctx.moveTo(0, y); ctx.lineTo(v.width, y); }
    ctx.globalAlpha = 0.3 * o.alpha; ctx.strokeStyle = p.weave; ctx.lineWidth = 1; ctx.stroke();
  }
  const g = ctx.createRadialGradient(v.focusX, v.focusY, 0, v.focusX, v.focusY, 700); g.addColorStop(0, p.lanternWarm); g.addColorStop(0.4, 'rgba(0,0,0,0)'); g.addColorStop(1, p.lanternShade);
  ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, v.width, v.height);
  const m = matrixOf(cam, v); ctx.setTransform(m[0] * S, 0, 0, m[3] * S, m[4] * S, m[5] * S);
  const alphas = layerOpacities(depthOf(cam.scale), list.layers.length);
  list.layers.forEach((layer, r) => { if (alphas[r] <= 0.01) return; for (const b of layer.batches) { ctx.globalAlpha = alphas[r] * b.alpha; if (b.t === 'fill') { ctx.fillStyle = p.colors[b.color]; ctx.fill(pathOf(b)); } else { ctx.strokeStyle = p.colors[b.color]; ctx.lineWidth = b.width; ctx.stroke(pathOf(b)); } } });
  ctx.setTransform(S, 0, 0, S, 0, 0); ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.fillStyle = p.text;
  list.layers.forEach((layer, r) => { if (alphas[r] <= 0.05) return; ctx.globalAlpha = alphas[r]; let n = 0; for (const l of layer.labels) { const x = (l.x - cam.cx) * cam.scale + v.focusX; const y = (l.y - cam.cy) * cam.scale + v.focusY; if (x < 0 || x > v.width || y < 0 || y > v.height) continue; ctx.fillText(l.text, x, y + 12); if (++n > 40) break; } });
}

/** A five-minute camera script: slow drift, one rung change every 20 s (in, in, out, out …), eased over 1 s. */
function cameraAt(t: number): NasijCamera {
  const seg = Math.floor(t / 20); const cycle = [0, 1, 2, 1]; const from = cycle[seg % 4]; const to = cycle[(seg + 1) % 4];
  const u = Math.min(1, Math.max(0, (t - seg * 20 - 19))); const e = u * u * (3 - 2 * u); const depth = from + (to - from) * e;
  return { cx: Math.sin(t / 37) * 120, cy: Math.cos(t / 53) * 150, scale: Math.pow(8, depth) };
}

const out: Record<string, unknown> = { target: `${W}x${H}@${FPS}`, raster: '@napi-rs/canvas (Skia CPU), single thread', node: process.version };
for (const n of [29, 400]) {
  const compileStart = performance.now(); const list = compileNasij({ world: 'PUBLIC', rungs: 3, entities: field(n), focusId: null, rtl: false }); const compileMs = performance.now() - compileStart;
  const canvas = createCanvas(W, H); const ctx = canvas.getContext('2d'); paths.clear();
  const frames = Number(process.argv[2] ?? 9000); const times: number[] = [];
  const start = performance.now();
  for (let f = 0; f < frames; f += 1) { const t0 = performance.now(); frame(ctx, list, cameraAt(f / FPS), null); ctx.getImageData(0, 0, 1, 1); times.push(performance.now() - t0); }
  const total = performance.now() - start; times.sort((a, b) => a - b);
  if (n === 400) { for (const t of [5, 19.5, 45]) { frame(ctx, list, cameraAt(t), null); fs.writeFileSync(`${process.argv[3]}/replay-frame-${t}.png`, canvas.toBuffer('image/png')); } }
  out[`entities_${n}`] = { frames, compileMs: +compileMs.toFixed(2), digest: list.digest, totalSeconds: +(total / 1000).toFixed(2), msPerFrameMean: +(total / frames).toFixed(3), p50: +times[Math.floor(frames / 2)].toFixed(3), p95: +times[Math.floor(frames * 0.95)].toFixed(3), max: +times[frames - 1].toFixed(2), framesPerCoreSecond: +(frames / (total / 1000)).toFixed(1), realtimeFactor: +((total / 1000) / (frames / FPS)).toFixed(3) };
}
console.log(JSON.stringify(out, null, 2));
