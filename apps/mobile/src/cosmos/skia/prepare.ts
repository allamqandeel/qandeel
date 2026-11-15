// COSMOS (experimental, isolated) — a Stage prepared for Skia, once.
//
// Everything a frame needs is built here ONCE per stage and only transformed afterwards: per rung, the atlas instances
// (source rect, RSXform and tint colour per sprite) and one SkPath per hairline set; for Shared, the horizon's paths.
// Nothing here runs per frame, and nothing here is cached at module level: the caller owns what `prepareStage` returns
// and gives it back to `disposePrepared`.
//
// THE ATLAS. `light-atlas.png` is WHITE with the light's intensity in alpha. A sprite is drawn as
//   texel (white, premultiplied by its alpha)  MODULATE  instance colour (tint, instance alpha)
// which is the tint at (texture alpha × instance alpha), and the whole atlas is then composited with PLUS (additive).
// MODULATE is symmetric, so the result does not depend on which of the two Skia treats as source.
//
// The browser gate whitens the hot centre of CORE and SPARK in its per-tint bake. The device has one white atlas, so a
// second, smaller WHITE instance is laid over each CORE and SPARK instead (45 % of its size, alpha 0.9).

import { FilterMode, MipmapMode, Skia, type SkColor, type SkPath, type SkPathBuilder, type SkRSXform, type SkRect } from '@shopify/react-native-skia';

import { ATLAS_RECTS } from '../assets/atlas';
import { TINTS } from '../core/atmosphere';
import { SPRITE, SPRITE_STRIDE, TINT, rungScale, type Stage } from '../core/stage';

export interface PreparedAtlas { readonly sprites: SkRect[]; readonly transforms: SkRSXform[]; readonly colors: SkColor[] }
export interface PreparedLines { readonly key: string; readonly path: SkPath; readonly color: string; readonly alpha: number; /** World units: points at the rung / 8^rung. */ readonly width: number }
export interface PreparedHorizon { readonly ring: SkPath; readonly outer: SkPath; readonly ticks: SkPath }
export interface PreparedRung {
  readonly rung: number;
  /** Every instance of the rung: ONE atlas draw (the default, FULL). */
  readonly full: PreparedAtlas;
  /** Everything but the nebula bodies (the three FIBRE plates and PUFF): what the NO_BODIES measurement mode draws. */
  readonly lights: PreparedAtlas;
  readonly lines: readonly PreparedLines[];
  /** Shared only: the membership horizon as this rung draws it (its tick lengths are points AT this rung). */
  readonly horizon: PreparedHorizon | null;
}
export interface PreparedStage {
  readonly digest: string;
  readonly rungs: readonly PreparedRung[];
  readonly instanceCount: number;
  /** Every Skia object this preparation made, for `disposePrepared`. */
  readonly owned: readonly { dispose?: () => void }[];
}

const WHITE_HOT = { size: 0.45, alpha: 0.9 } as const;
const isBody = (sprite: number): boolean => sprite === SPRITE.PUFF || sprite === SPRITE.FIBRE_A || sprite === SPRITE.FIBRE_B || sprite === SPRITE.FIBRE_C;

export const rgbOf = (tint: number): string => { const c = TINTS[tint] ?? TINTS[TINT.PALE]; return `rgb(${c[0]}, ${c[1]}, ${c[2]})`; };
/** The label colour of a tinted entity: its tint lightened by 42 % toward white (the gate's `cssLight`). */
export const lightRgbOf = (tint: number): string => { const c = TINTS[tint] ?? TINTS[TINT.PALE]; return `rgb(${c.map((v) => Math.round(v + (255 - v) * 0.42)).join(', ')})`; };

/** An SkColor ([r, g, b, a] in 0–1, unpremultiplied) without a native call. */
const colorOf = (rgb: readonly [number, number, number] | null, alpha: number): SkColor =>
  Float32Array.of(rgb === null ? 1 : rgb[0] / 255, rgb === null ? 1 : rgb[1] / 255, rgb === null ? 1 : rgb[2] / 255, Math.min(1, Math.max(0, alpha)));

/** The Shared horizon's screen-space measures (the gate's): a second ring 7 pt out, 180 ticks of three lengths. */
const HORIZON = { outer: 7, ticks: 180, long: 14, mid: 10, short: 7.5, segments: 720 } as const;

/** Build a path through the (non-deprecated) builder, and give the builder back. */
function pathOf(draw: (builder: SkPathBuilder) => void): SkPath {
  const builder = Skia.PathBuilder.Make();
  draw(builder);
  const path = builder.build();
  builder.dispose?.();
  return path;
}

function circle(cx: number, cy: number, r: number): SkPath {
  // A fine polygon, not a conic: at NEAR the horizon is tens of thousands of points across, and a polyline's cost is flat.
  return pathOf((b) => {
    for (let i = 0; i < HORIZON.segments; i += 1) {
      const a = (i / HORIZON.segments) * Math.PI * 2;
      if (i === 0) b.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else b.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    b.close();
  });
}

function horizonAt(horizon: NonNullable<Stage['horizon']>, rung: number): PreparedHorizon {
  const k = 1 / rungScale(rung);
  const ticks = pathOf((b) => {
    for (let i = 0; i < HORIZON.ticks; i += 1) {
      const a = (i / HORIZON.ticks) * Math.PI * 2;
      const r1 = horizon.r + (i % 15 === 0 ? HORIZON.long : i % 5 === 0 ? HORIZON.mid : HORIZON.short) * k;
      b.moveTo(horizon.cx + Math.cos(a) * horizon.r, horizon.cy + Math.sin(a) * horizon.r);
      b.lineTo(horizon.cx + Math.cos(a) * r1, horizon.cy + Math.sin(a) * r1);
    }
  });
  return { ring: circle(horizon.cx, horizon.cy, horizon.r), outer: circle(horizon.cx, horizon.cy, horizon.r + HORIZON.outer * k), ticks };
}

export function prepareStage(stage: Stage): PreparedStage {
  const owned: { dispose?: () => void }[] = [];
  const keep = <T extends { dispose?: () => void }>(made: T): T => { owned.push(made); return made; };
  // One source rect per sprite id, shared by every instance of it.
  const rects = ATLAS_RECTS.map((r) => keep(Skia.XYWHRect(r[0], r[1], r[2], r[3])));
  let instanceCount = 0;

  const rungs = stage.layers.map((layer): PreparedRung => {
    const bodies: PreparedAtlas = { sprites: [], transforms: [], colors: [] };
    const lights: PreparedAtlas = { sprites: [], transforms: [], colors: [] };
    const put = (into: PreparedAtlas, sprite: number, x: number, y: number, diameter: number, rotation: number, color: SkColor) => {
      const rect = ATLAS_RECTS[sprite];
      // RSXform: p' = [scos -ssin; ssin scos]·p + t, with p in the sprite's own pixels from its top-left corner. The
      // sprite's centre must land on (x, y), at `diameter` across.
      const scale = diameter / rect[2];
      const scos = Math.cos(rotation) * scale;
      const ssin = Math.sin(rotation) * scale;
      const hw = rect[2] / 2; const hh = rect[3] / 2;
      into.sprites.push(rects[sprite]);
      into.transforms.push(keep(Skia.RSXform(scos, ssin, x - scos * hw + ssin * hh, y - ssin * hw - scos * hh)));
      into.colors.push(color);
      instanceCount += 1;
    };
    const sp = layer.sprites;
    for (let i = 0; i + SPRITE_STRIDE <= sp.length; i += SPRITE_STRIDE) {
      const x = sp[i]; const y = sp[i + 1]; const d = sp[i + 2]; const sprite = sp[i + 3]; const tint = sp[i + 4]; const alpha = sp[i + 5]; const rotation = sp[i + 6];
      if (ATLAS_RECTS[sprite] === undefined || !(d > 0)) continue;
      put(isBody(sprite) ? bodies : lights, sprite, x, y, d, rotation, colorOf(TINTS[tint] ?? TINTS[TINT.PALE], alpha));
      if (sprite === SPRITE.CORE || sprite === SPRITE.SPARK) put(lights, sprite, x, y, d * WHITE_HOT.size, rotation, colorOf(null, alpha * WHITE_HOT.alpha));
    }
    const lines = layer.lines.map((set, index): PreparedLines => {
      const data = set.data;
      const path = keep(pathOf((b) => {
        for (let i = 0; i < data.length;) {
          const n = data[i];
          if (!(n >= 1)) break;
          b.moveTo(data[i + 1], data[i + 2]);
          for (let j = 1; j < n; j += 1) b.lineTo(data[i + 1 + j * 2], data[i + 2 + j * 2]);
          i += 1 + n * 2;
        }
      }));
      return { key: `${layer.rung}:${index}:${set.tint}:${set.alpha}:${set.width}`, path, color: rgbOf(set.tint), alpha: set.alpha, width: set.width / rungScale(layer.rung) };
    });
    let horizon: PreparedHorizon | null = null;
    if (stage.horizon !== null) {
      horizon = horizonAt(stage.horizon, layer.rung);
      keep(horizon.ring); keep(horizon.outer); keep(horizon.ticks);
    }
    return {
      rung: layer.rung,
      // Bodies first, lights after: with an additive blend the order changes nothing, and the split costs no second
      // set of native objects (the arrays share the same rects and transforms).
      full: { sprites: [...bodies.sprites, ...lights.sprites], transforms: [...bodies.transforms, ...lights.transforms], colors: [...bodies.colors, ...lights.colors] },
      lights, lines, horizon,
    };
  });
  return { digest: stage.digest, rungs, instanceCount, owned };
}

export function disposePrepared(prepared: PreparedStage): void {
  for (const made of prepared.owned) { try { made.dispose?.(); } catch { /* already released with its runtime */ } }
}

export const ATLAS_SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear } as const;
// The plates are only ever magnified on a phone (a 1024-pixel tile spans about 900 points or more), so they need no
// mip levels; the atlas is minified (a 128-pixel core is drawn a few points wide) and is sampled through its mips.
export const PLATE_SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.None } as const;
