// COSMOS (experimental, isolated) — the prepared visual assets.
//
// Everything expensive about the look is baked ONCE into a few small images, deterministically from a seed, and then
// only transformed. This file produces raw RGBA pixels and knows no host: the browser gate, the mobile Skia host and a
// headless Replay rasteriser would all load the same bytes (in production these would ship as files baked at build
// time, never generated on a phone).
//
//  - three ATMOSPHERE plates per world, seamless tiles: DEEP (opaque), GAS (additive), VEIL (additive, passes nearer)
//  - five LIGHT sprites (white intensity in alpha), tinted by the host
//
// No plate contains anything that could be read as data: no discs, no rings, no clusters placed to suggest a place.
// Stars in a plate are fine background points only, far smaller and dimmer than any entity's light.

import type { WorldKind } from './stage';

export interface AtmospherePalette {
  /** The void's two tones, top-left to bottom-right. */
  readonly voidA: readonly [number, number, number]; readonly voidB: readonly [number, number, number];
  /** The broad gas hues. */
  readonly gasA: readonly [number, number, number]; readonly gasB: readonly [number, number, number];
  /** The fine filament light. */
  readonly filament: readonly [number, number, number];
  readonly star: readonly [number, number, number];
  readonly seed: number;
  /** How much of the plate the gas occupies (0–1). Personal is sparse and close; Public is wide and full. */
  readonly fill: number;
  /** The composition: where the great body of gas lies across the plate. */
  readonly form: 'EMBER' | 'TIDE' | 'RIVER';
}

/** One language (deep void, warm lantern light, cool counter-light), three temperaments. */
export const ATMOSPHERES: Readonly<Record<WorldKind, AtmospherePalette>> = Object.freeze({
  // Intimate: a warm ember glow close by, in a near-black indigo.
  PERSONAL: { voidA: [7, 8, 20], voidB: [16, 9, 22], gasA: [176, 92, 44], gasB: [108, 38, 72], filament: [255, 214, 150], star: [255, 236, 214], seed: 11, fill: 0.46, form: 'EMBER' },
  // Enclosed: sea-glass and jade, a held space.
  SHARED: { voidA: [5, 14, 22], voidB: [8, 20, 26], gasA: [28, 122, 118], gasB: [34, 70, 138], filament: [176, 240, 222], star: [220, 244, 240], seed: 23, fill: 0.5, form: 'TIDE' },
  // Expansive: wide blue fields breaking into rose and violet.
  PUBLIC: { voidA: [6, 9, 26], voidB: [14, 8, 30], gasA: [44, 84, 190], gasB: [168, 58, 128], filament: [196, 206, 255], star: [232, 236, 255], seed: 37, fill: 0.6, form: 'RIVER' },
});

// ── seamless value noise ───────────────────────────────────────────────────────────────────────────────────────────
function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Value noise that repeats every `period` cells, so a plate tiles without a seam. */
function noise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x); const yi = Math.floor(y); const xf = x - xi; const yf = y - yi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10); const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const w = (n: number) => ((n % period) + period) % period;
  const a = hash(w(xi), w(yi), seed); const b = hash(w(xi + 1), w(yi), seed); const c = hash(w(xi), w(yi + 1), seed); const d = hash(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, period: number, seed: number, octaves: number): number {
  let sum = 0; let amp = 0.5; let f = 1; let norm = 0;
  for (let o = 0; o < octaves; o += 1) { sum += amp * noise(x * f, y * f, period * f, seed + o * 17); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}
/** Ridged noise: thin bright creases where the field folds. This is where the delicate filaments come from. */
function ridged(x: number, y: number, period: number, seed: number, octaves: number): number {
  let sum = 0; let amp = 0.5; let f = 1; let norm = 0; let prev = 1;
  for (let o = 0; o < octaves; o += 1) {
    let n = 1 - Math.abs(2 * noise(x * f, y * f, period * f, seed + o * 31) - 1); n *= n;
    sum += n * amp * prev; norm += amp; prev = n; amp *= 0.55; f *= 2;
  }
  return sum / norm;
}
const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export type PlateKind = 'DEEP' | 'GAS' | 'VEIL';

/** Bake one seamless atmosphere plate, `size` × `size` RGBA. DEEP is opaque; GAS and VEIL are light over black. */
export function bakePlate(world: WorldKind, kind: PlateKind, size: number): Uint8ClampedArray {
  const p = ATMOSPHERES[world]; const out = new Uint8ClampedArray(size * size * 4); const TAU = Math.PI * 2;
  // The composition mask (periodic, so the plate still tiles): one great form per plate, with real darkness around it.
  const form = (u: number, v: number, wob: number): number => {
    if (p.form === 'RIVER') return Math.pow(0.5 + 0.5 * Math.cos(TAU * (u + v - 1 + wob * 0.22)), 2.2);      // a diagonal river of light
    if (p.form === 'TIDE') return Math.pow(0.5 + 0.5 * Math.cos(TAU * (v - 0.5 + Math.sin(TAU * u) * 0.11 + wob * 0.18)), 1.8); // a level, held band
    return Math.pow((0.5 + 0.5 * Math.cos(TAU * (u - 0.5 + wob * 0.16))) * (0.5 + 0.5 * Math.cos(TAU * (v - 0.44 + wob * 0.12))), 1.25); // one close ember
  };
  const P = 4; // noise cells across the plate at the base octave
  for (let j = 0; j < size; j += 1) for (let i = 0; i < size; i += 1) {
    const x = (i / size) * P; const y = (j / size) * P; const o = (j * size + i) * 4;
    // Domain warp: the gas is pushed along a slow second field, which is what makes it billow instead of blotch.
    const wx = fbm(x + 1.7, y + 9.2, P, p.seed + 101, 3) - 0.5; const wy = fbm(x + 8.3, y + 2.8, P, p.seed + 202, 3) - 0.5;
    let r = 0; let g = 0; let b = 0;
    if (kind === 'DEEP') {
      const t = 0.5 - 0.5 * Math.cos(TAU * i / size) * Math.cos(TAU * j / size);
      r = p.voidA[0] + (p.voidB[0] - p.voidA[0]) * t; g = p.voidA[1] + (p.voidB[1] - p.voidA[1]) * t; b = p.voidA[2] + (p.voidB[2] - p.voidA[2]) * t;
      const body = fbm(x + wx * 2.2, y + wy * 2.2, P, p.seed, 5);
      const shape = form(i / size, j / size, wx * 2);
      const density = smooth(1 - p.fill, 1 - p.fill + 0.42, body + 0.18) * (0.1 + 0.9 * shape);
      const hue = smooth(0.43, 0.57, fbm(x * 0.5 + wy, y * 0.5 - wx, P / 2, p.seed + 7, 3));
      const dust = smooth(0.5, 0.72, fbm(x * 1.5 - wx * 3, y * 1.5 + wy * 3, P * 1.5, p.seed + 55, 4)); // dark lanes
      const light = density * (1 - dust * 0.85) * 0.3;
      r += (p.gasA[0] + (p.gasB[0] - p.gasA[0]) * hue) * light; g += (p.gasA[1] + (p.gasB[1] - p.gasA[1]) * hue) * light; b += (p.gasA[2] + (p.gasB[2] - p.gasA[2]) * hue) * light;
      out[o + 3] = 255;
    } else if (kind === 'GAS') {
      const body = fbm(x * 1.25 + wx * 3 + 4.1, y * 1.25 + wy * 3 + 1.3, P * 1.25, p.seed + 300, 4);
      const shape = form(i / size, j / size, wx * 2);
      const mask = smooth(0.4, 0.76, body) * (0.06 + 0.94 * shape);
      const crease = Math.pow(ridged(x * 1.5 + wx * 2.6, y * 1.5 + wy * 2.6, P * 1.5, p.seed + 400, 6), 3.1);
      const fine = Math.pow(ridged(x * 3 - wy * 4, y * 3 + wx * 4, P * 3, p.seed + 450, 4), 4);
      const hue = smooth(0.43, 0.57, fbm(x * 0.75 - wy, y * 0.75 + wx, P * 0.75, p.seed + 9, 3));
      const cloud = mask * 0.09; const fil = (crease * 0.95 + fine * 0.4) * mask;
      r = (p.gasB[0] + (p.gasA[0] - p.gasB[0]) * hue) * cloud + p.filament[0] * fil;
      g = (p.gasB[1] + (p.gasA[1] - p.gasB[1]) * hue) * cloud + p.filament[1] * fil;
      b = (p.gasB[2] + (p.gasA[2] - p.gasB[2]) * hue) * cloud + p.filament[2] * fil;
      out[o + 3] = 255;
    } else {
      const haze = smooth(0.5, 0.9, fbm(x * 0.5 + wx, y * 0.5 + wy, P * 0.5, p.seed + 500, 3)) * 0.1;
      r = p.filament[0] * haze; g = p.filament[1] * haze; b = p.filament[2] * haze; out[o + 3] = 255;
    }
    out[o] = r; out[o + 1] = g; out[o + 2] = b;
  }
  return out;
}

/**
 * The background stars of a plate, as positions in 0–1 with a radius (in plate pixels at 1024) and a peak (0–1). A host
 * stamps them crisply at its own resolution, wrapping at the edges. Fine points only: far smaller and dimmer than any
 * entity's light, and never arranged.
 */
export function plateStars(world: WorldKind, kind: PlateKind): Array<{ x: number; y: number; r: number; a: number; warm: number }> {
  const p = ATMOSPHERES[world]; const count = kind === 'DEEP' ? 1500 : kind === 'GAS' ? 150 : 0;
  let s = p.seed * 7919 + (kind === 'DEEP' ? 1 : 2);
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const out = [];
  for (let n = 0; n < count; n += 1) {
    const x = rnd(); const y = rnd(); const mag = Math.pow(rnd(), kind === 'DEEP' ? 6 : 2.6); const warm = rnd();
    out.push({ x, y, r: kind === 'DEEP' ? 0.45 + mag * 1.0 : 0.8 + mag * 1.5, a: kind === 'DEEP' ? 0.16 + mag * 0.84 : 0.4 + mag * 0.6, warm });
  }
  return out;
}

/** Bake one light sprite as white with intensity in alpha (`size` × `size` RGBA). Ids follow `SPRITE` in stage.ts. */
export function bakeSprite(id: number, size: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4); const c = (size - 1) / 2;
  for (let j = 0; j < size; j += 1) for (let i = 0; i < size; i += 1) {
    const dx = (i - c) / c; const dy = (j - c) / c; const d = Math.hypot(dx, dy); const edge = smooth(1, 0.82, d);
    let a = 0;
    if (id === 0) a = Math.exp(-d * d * 4.2) * 0.9;                                   // PUFF: a broad, even breath of light
    else if (id === 1) a = Math.exp(-d * d * 9) * 0.75 + Math.exp(-d * d * 2.2) * 0.2;  // HALO: a body's glow
    else if (id === 2) {                                                                // CORE: a hot point with four fine rays
      const ray = Math.exp(-Math.min(Math.abs(dx), Math.abs(dy)) * 46) * Math.exp(-d * 3.4) * 0.8;
      a = Math.min(1, smooth(0.5, 0.2, d) + Math.exp(-d * d * 14) * 0.55 + ray);
    } else if (id === 3) {                                                              // SPARK: a distant light
      const ray = Math.exp(-Math.min(Math.abs(dx), Math.abs(dy)) * 30) * Math.exp(-d * 4.2) * 0.75;
      a = Math.min(1, Math.exp(-d * d * 30) + Math.exp(-d * d * 5) * 0.28 + ray);
    } else a = Math.min(1, smooth(0.42, 0.24, d) + Math.exp(-d * d * 7) * 0.4);          // MOTE: a small counted light
    const o = (j * size + i) * 4; out[o] = 255; out[o + 1] = 255; out[o + 2] = 255; out[o + 3] = Math.min(255, a * edge * 255);
  }
  return out;
}

/**
 * Bake one fibrous nebula body as white with intensity in alpha: thousands of fine strands swept along a slow swirl,
 * densest at the heart and fraying to nothing at the rim. Three variants; a host tints and turns them per use.
 */
export function bakeFibre(variant: number, size: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4); const c = (size - 1) / 2; const seed = 900 + variant * 71; const P = 6;
  for (let j = 0; j < size; j += 1) for (let i = 0; i < size; i += 1) {
    const dx = (i - c) / c; const dy = (j - c) / c; const d = Math.hypot(dx, dy);
    const o = (j * size + i) * 4; out[o] = 255; out[o + 1] = 255; out[o + 2] = 255;
    if (d >= 1) continue;
    const x = (i / size) * P; const y = (j / size) * P;
    // Two warps: a slow swirl that gives the body its gesture, and a second that combs long strands along it.
    const sx = fbm(x * 0.35 + 3.1, y * 0.35 + 7.7, P, seed, 3) - 0.5; const sy = fbm(x * 0.35 + 9.4, y * 0.35 + 1.2, P, seed + 5, 3) - 0.5;
    const qx = x + sx * 5.2; const qy = y + sy * 5.2;
    const tx = fbm(qx * 0.6 + 1.3, qy * 0.6 + 4.4, P, seed + 7, 2) - 0.5; const ty = fbm(qx * 0.6 + 6.1, qy * 0.6 + 8.8, P, seed + 9, 2) - 0.5;
    const hair = Math.pow(ridged(qx * 0.9 + ty * 7, qy * 0.9 - tx * 7, P * 2, seed + 11, 5), 3);       // long flowing strands
    const fine = Math.pow(ridged(qx * 2.4 - ty * 11, qy * 2.4 + tx * 11, P * 4, seed + 23, 4), 3.6);   // the hair between them
    const body = fbm(qx * 0.6, qy * 0.6, P * 2, seed + 31, 4);
    // Lobed and frayed: arms reach out and gaps open, so the body is never a disc.
    const ang = Math.atan2(dy, dx);
    const lobe = 0.5 + 0.5 * Math.sin(ang * (2 + variant) + sx * 9 + variant * 1.7);
    const rim = 0.34 + lobe * 0.5 + (fbm(x * 0.5 + 5, y * 0.5 + 2, P, seed + 41, 3) - 0.5) * 0.7;
    const fall = smooth(rim + 0.42, rim * 0.12, d) * smooth(1, 0.7, d);
    // A clear eye at the heart: no strand crosses the place where an entity's own light sits, so a fibre can never be
    // read as a mark on, or a line through, the entity (the 'bright streak' found at the Visual Gate).
    const eye = smooth(0.05, 0.24, d);
    const a = ((hair * 1.25 + fine * 0.55) * eye + smooth(0.4, 0.85, body) * 0.14 + Math.exp(-d * d * 9) * 0.12) * fall;
    out[o + 3] = Math.min(255, a * 255);
  }
  return out;
}

/** Tints by id: the eight dyes, then WARM, PALE, GOLD (see `TINT`). One set for all worlds: one visual language. */
export const TINTS: ReadonlyArray<readonly [number, number, number]> = Object.freeze([
  [255, 92, 196],  // 0 magenta
  [72, 232, 132],  // 1 green
  [255, 204, 84],  // 2 gold
  [255, 86, 96],   // 3 red
  [64, 226, 208],  // 4 teal
  [98, 160, 255],  // 5 blue
  [178, 112, 255], // 6 violet
  [255, 150, 74],  // 7 orange
  [255, 226, 180], // WARM
  [226, 234, 255], // PALE
  [236, 204, 138], // GOLD
]);
