/**
 * LA-VIS-01 — the MATERIAL of a place's mass: an irregular, volumetric body of light with its own internal structure.
 *
 * A mass is painted once, imperatively, into a small raster (inside `createPicture`, so it runs where a picture is
 * recorded and nowhere else) and replayed as one textured quad under the place, scaled with the plane. What it carries:
 *
 *   an asymmetric body of overlapping, elongated lobes   — never one radial disc;
 *   a broken, feathered perimeter and dark pockets        — carved by a fractal noise, kept whole near the heart;
 *   fine luminous filaments and wisps                     — the creases of a turbulence, lit only INSIDE the body;
 *   small particulate concentrations and micro-lights     — clustered, denser toward the heart.
 *
 * All of it is MATERIAL, never graph truth. It is drawn in the mass's own frame, around ONE place: no strand starts or
 * ends on another place, nothing is a relation, nothing is placed, hit or read, and nothing reaches accessibility.
 *
 * What may vary between masses is only what cannot mean anything: the SHAPE variant is chosen by the place's scene key
 * (like its rotation), and the COLOUR is the world-position chroma field at its address (`./world-chroma`). Every count,
 * size and weight is the same for every place.
 */
import { BlendMode, BlurStyle, FilterMode, MipmapMode, PaintStyle, Skia, StrokeCap, TileMode, createPicture, vec, type SkCanvas, type SkPicture } from '@shopify/react-native-skia';

import type { ChromaFamily } from './world-chroma';
import { hsla, presentationRotation } from './world-resolver';

/** The mass's frame: one unit of radius is this many picture points, and the picture reaches EXTENT radii out. */
export const MASS_UNIT = 100;
export const MASS_EXTENT = 2.1;

/** Sizes, counts and weights of the material. The same for every place. */
const M = Object.freeze({
  /** Raster pixels across the whole sprite. */
  pixels: 448,
  variants: 8,
  lobes: 11,
  /** The body's elongation (minor/major) and how far its lobes wander along the long axis, in radii. */
  squash: [0.38, 0.8],
  wander: 0.95,
  /** Lightness lifts (percent) of the body, the heart and the light inside it. */
  bodyLift: -6,
  heartLift: 22,
  hotLift: 40,
  /** Carving: noise cycles per radius, and noise → alpha (alpha = gain·n − floor); the heart is spared out to `spare`. */
  carve: [1.5, 3.4],
  carveGain: 4.4,
  carveFloor: 1.6,
  spare: 0.24,
  pockets: 8,
  pocketAlpha: 0.9,
  /** Filaments: turbulence cycles per radius, how thin a crease must be to light, its weight. */
  veins: [2.6, 6.5],
  veinSharp: 7,
  veinAlpha: [1, 0.8],
  wisps: 14,
  wispAlpha: 0.2,
  /** Particulates: clusters, grains per cluster, scattered grains, micro-lights. */
  clusters: 6,
  grains: 26,
  scatter: 90,
  sparks: 9,
  glowAlpha: 0.12,
  /** Tendrils: faint material arms trailing OUT of the body into open space, and the drift grains along them. */
  tendrils: 7,
  tendrilAlpha: 0.1,
  hazeAlpha: 0.08,
  drift: 7,
});

/** A stable, meaning-free number in [0, 1) from a variant and a stream position. */
const rnd = (variant: number, stream: string, index: number): number => presentationRotation(`${index}:${stream}:${variant}`) / (Math.PI * 2);

const sprites = new Map<string, SkPicture>();
const CACHE = 48;

/** The picture of one mass: shape variant by the place's key, colour by the world at its address. */
export function massPicture(seed: string, chroma: ChromaFamily): SkPicture {
  const variant = Math.floor((presentationRotation(seed) / (Math.PI * 2)) * M.variants);
  // The chroma is quantized only for the cache: a few degrees of a smooth field, invisible in a soft body.
  const tone: ChromaFamily = { hue: Math.round(chroma.hue / 5) * 5, saturation: Math.round(chroma.saturation / 4) * 4, lightness: Math.round(chroma.lightness / 4) * 4 };
  const key = `${variant}|${tone.hue}|${tone.saturation}|${tone.lightness}`;
  const cached = sprites.get(key);
  if (cached !== undefined) return cached;
  const picture = recordMass(variant, tone);
  if (sprites.size >= CACHE) sprites.delete(sprites.keys().next().value as string);
  sprites.set(key, picture);
  return picture;
}

function recordMass(variant: number, tone: ChromaFamily): SkPicture {
  const half = MASS_EXTENT * MASS_UNIT;
  const bounds = Skia.XYWHRect(-half, -half, half * 2, half * 2);
  return createPicture((target) => {
    const share = M.pixels / (half * 2);
    const surface = Skia.Surface.Make(M.pixels, M.pixels) ?? Skia.Surface.MakeOffscreen(M.pixels, M.pixels);
    if (surface === null) return;
    const canvas = surface.getCanvas();
    canvas.scale(share, share);
    canvas.translate(half, half);
    paintMass(canvas, variant, tone);
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    const image = snapshot.makeNonTextureImage?.() ?? snapshot;
    target.drawImageRectOptions(image, Skia.XYWHRect(0, 0, M.pixels, M.pixels), bounds, FilterMode.Linear, MipmapMode.None, Skia.Paint());
  }, bounds);
}

const colour = (hue: number, sat: number, light: number, alpha: number) => Skia.Color(hsla(hue, sat, light, alpha));

function radial(x: number, y: number, r: number, colours: readonly string[], positions: readonly number[]) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(Skia.Shader.MakeRadialGradient(vec(x, y), r, colours.map((c) => Skia.Color(c)), [...positions], TileMode.Clamp));
  return paint;
}

/** Noise → a mask: its red channel becomes alpha, with gain and floor. */
const noiseMask = (gain: number, floor: number) => Skia.ColorFilter.MakeMatrix([0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, gain, 0, 0, 0, -floor]);

function paintMass(canvas: SkCanvas, variant: number, { hue, saturation, lightness }: ChromaFamily) {
  const U = MASS_UNIT;
  const axis = rnd(variant, 'axis', 0) * Math.PI * 2;
  const ax = Math.cos(axis);
  const ay = Math.sin(axis);
  const full = Skia.XYWHRect(-MASS_EXTENT * U, -MASS_EXTENT * U, MASS_EXTENT * 2 * U, MASS_EXTENT * 2 * U);

  // 1. The wide glow the mass casts: faint, its hue leaning a little cooler, stretched along the body's axis.
  canvas.save();
  canvas.rotate((axis * 180) / Math.PI, 0, 0);
  canvas.scale(1, 0.72);
  canvas.drawCircle(0, 0, 1.95 * U, radial(0, 0, 1.95 * U, [hsla(hue + 10, saturation * 0.8, lightness - 10, M.glowAlpha), hsla(hue + 14, saturation * 0.7, lightness - 16, M.glowAlpha * 0.35), hsla(hue + 16, saturation * 0.6, lightness - 20, 0)], [0, 0.5, 1]));
  canvas.restore();

  // 2. The body, in its own layer so it can be carved: elongated lobes wandering along the axis, lit unevenly.
  canvas.saveLayer();
  for (let index = 0; index < M.lobes; index += 1) {
    const along = (rnd(variant, 'along', index) * 2 - 1) * M.wander;
    const across = (rnd(variant, 'across', index) * 2 - 1) * 0.42;
    const x = (ax * along - ay * across) * U;
    const y = (ay * along + ax * across) * U;
    const r = (0.32 + 0.38 * rnd(variant, 'r', index)) * U * (1 - 0.35 * Math.abs(along));
    const squash = M.squash[0] + (M.squash[1] - M.squash[0]) * rnd(variant, 'sq', index);
    const tilt = axis + (rnd(variant, 'tilt', index) - 0.5) * 1.1;
    const lean = (rnd(variant, 'hue', index) - 0.5) * 30;
    const weight = 0.45 + 0.55 * rnd(variant, 'w', index);
    canvas.save();
    canvas.translate(x, y);
    canvas.rotate((tilt * 180) / Math.PI, 0, 0);
    canvas.scale(1, squash);
    const paint = radial(0, 0, r, [hsla(hue + lean, saturation, lightness + M.bodyLift + 10, 0.6 * weight), hsla(hue + lean, saturation, lightness + M.bodyLift, 0.26 * weight), hsla(hue + lean, saturation, lightness + M.bodyLift - 8, 0)], [0, 0.5, 1]);
    paint.setBlendMode(BlendMode.Plus);
    canvas.drawCircle(0, 0, r, paint);
    canvas.restore();
  }
  // The heart: the place itself is the brightest, densest region of its mass.
  const heart = radial(0, 0, 0.62 * U, [hsla(hue, saturation * 0.75, lightness + M.heartLift, 0.95), hsla(hue, saturation * 0.85, lightness + M.heartLift * 0.4, 0.45), hsla(hue, saturation, lightness, 0)], [0, 0.42, 1]);
  heart.setBlendMode(BlendMode.Plus);
  canvas.drawCircle(0, 0, 0.62 * U, heart);

  // 3. Carving: a broken perimeter and dark lanes. The mask is the noise, with the heart spared so the core stays whole.
  const carve = Skia.Paint();
  carve.setBlendMode(BlendMode.DstIn);
  canvas.saveLayer(carve);
  for (const [index, cycles] of M.carve.entries()) {
    const noise = Skia.Paint();
    noise.setShader(Skia.Shader.MakeFractalNoise(cycles / U, cycles / U, 4, variant * 7 + index, 0, 0));
    noise.setColorFilter(noiseMask(M.carveGain, M.carveFloor - 0.15 * index));
    if (index > 0) noise.setBlendMode(BlendMode.DstIn);
    canvas.drawRect(full, noise);
  }
  const spare = radial(0, 0, M.spare * 2 * U, ['rgba(255,255,255,1)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)'], [0, 0.5, 1]);
  spare.setBlendMode(BlendMode.Lighten);
  canvas.drawCircle(0, 0, M.spare * 2 * U, spare);
  canvas.restore();

  // Dark pockets: soft holes inside the body, never on the heart.
  for (let index = 0; index < M.pockets; index += 1) {
    const angle = rnd(variant, 'pa', index) * Math.PI * 2;
    const distance = (0.35 + 0.6 * rnd(variant, 'pd', index)) * U;
    const r = (0.1 + 0.16 * rnd(variant, 'pr', index)) * U;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const pocket = radial(x, y, r, ['rgba(0,0,0,1)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'], [0, 0.5, 1]);
    pocket.setBlendMode(BlendMode.DstOut);
    pocket.setAlphaf(M.pocketAlpha);
    canvas.drawCircle(x, y, r, pocket);
  }

  // 4. Filaments: the creases of a turbulence, lit only where the body is (SrcATop), at two scales.
  for (const [index, cycles] of M.veins.entries()) {
    const [vr, vg, vb] = colour(hue + 8 * index, saturation * 0.55, Math.min(92, lightness + M.hotLift - 6 * index), 1);
    const veins = Skia.Paint();
    veins.setShader(Skia.Shader.MakeTurbulence(cycles / U, cycles / U, 3, variant * 13 + index, 0, 0));
    veins.setColorFilter(Skia.ColorFilter.MakeMatrix([0, 0, 0, 0, vr, 0, 0, 0, 0, vg, 0, 0, 0, 0, vb, -M.veinSharp, 0, 0, 0, M.veinAlpha[index]]));
    veins.setBlendMode(BlendMode.SrcATop);
    canvas.drawRect(full, veins);
  }
  canvas.restore();

  // Wisps: a few thin curved strands trailing off the body — open arcs in the mass's frame, never reaching its heart.
  const wisp = Skia.Paint();
  wisp.setAntiAlias(true);
  wisp.setStyle(PaintStyle.Stroke);
  wisp.setStrokeCap(StrokeCap.Round);
  wisp.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 0.5, true));
  for (let index = 0; index < M.wisps; index += 1) {
    // A short arc AROUND the heart (tangential), at its own distance: it curls through the body and leads nowhere.
    const start = rnd(variant, 'wa', index) * Math.PI * 2;
    const span = (0.25 + 0.45 * rnd(variant, 'wl', index)) * (index % 2 === 0 ? 1 : -1);
    const d0 = (0.25 + 0.55 * rnd(variant, 'wf', index)) * U;
    const d1 = d0 * (0.8 + 0.45 * rnd(variant, 'wb', index));
    const p = (t: number) => {
      const angle = start + span * t;
      const d = d0 + (d1 - d0) * t;
      return [Math.cos(angle) * d * 1.15, Math.sin(angle) * d * 0.85] as const;
    };
    const [x0, y0] = p(0);
    const [x1, y1] = p(0.5);
    const [x2, y2] = p(1);
    const path = Skia.Path.MakeFromSVGString(`M ${x0} ${y0} Q ${2 * x1 - (x0 + x2) / 2} ${2 * y1 - (y0 + y2) / 2} ${x2} ${y2}`);
    if (path === null) continue;
    wisp.setStrokeWidth(0.35 + 0.6 * rnd(variant, 'ww', index));
    wisp.setShader(Skia.Shader.MakeLinearGradient(vec(x0, y0), vec(x2, y2), [colour(hue, saturation * 0.5, lightness + 34, 0), colour(hue, saturation * 0.5, lightness + 34, M.wispAlpha), colour(hue + 10, saturation * 0.7, lightness + 20, 0)], [0, 0.45, 1], TileMode.Clamp));
    canvas.drawPath(path, wisp);
  }

  // Tendrils: faint arms of the mass's own material reaching out into open space, so neighbouring masses read as one
  // living field. Each starts inside the body (never at the heart), curls outward and fades out in empty space before
  // the sprite's edge: it ends nowhere, joins nothing, and says nothing about any other place.
  const arm = Skia.Paint();
  arm.setAntiAlias(true);
  arm.setStyle(PaintStyle.Stroke);
  arm.setStrokeCap(StrokeCap.Round);
  for (let index = 0; index < M.tendrils; index += 1) {
    const start = rnd(variant, 'ta', index) * Math.PI * 2;
    const bend = (rnd(variant, 'tb', index) - 0.5) * 0.7;
    const d0 = (0.55 + 0.3 * rnd(variant, 'td', index)) * U;
    const d1 = (1.55 + 0.4 * rnd(variant, 'te', index)) * U;
    const p = (t: number) => {
      const angle = start + bend * t * t;
      const d = d0 + (d1 - d0) * t;
      return [Math.cos(angle) * d, Math.sin(angle) * d] as const;
    };
    const [x0, y0] = p(0);
    const [x1, y1] = p(0.5);
    const [x2, y2] = p(1);
    const path = Skia.Path.MakeFromSVGString(`M ${x0} ${y0} Q ${2 * x1 - (x0 + x2) / 2} ${2 * y1 - (y0 + y2) / 2} ${x2} ${y2}`);
    if (path === null) continue;
    const lean = hue + (rnd(variant, 'th', index) - 0.5) * 24;
    // A broad diffuse haze along the arm, then a finer strand inside it.
    for (const [width, blur, alpha, lift] of [[26, 12, M.hazeAlpha, 0], [1.1 + 1.2 * rnd(variant, 'tw', index), 1.2, M.tendrilAlpha, 22]] as const) {
      arm.setStrokeWidth(width);
      arm.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, blur, true));
      arm.setShader(Skia.Shader.MakeLinearGradient(vec(x0, y0), vec(x2, y2), [colour(lean, saturation * 0.8, lightness + lift, 0), colour(lean, saturation * 0.8, lightness + lift, alpha), colour(lean + 10, saturation * 0.7, lightness + lift - 8, 0)], [0, 0.3, 1], TileMode.Clamp));
      canvas.drawPath(path, arm);
    }
    // Sparse drift: a few grains along the arm, thinning as it fades.
    const drift = Skia.Paint();
    drift.setAntiAlias(true);
    drift.setBlendMode(BlendMode.Plus);
    for (let grainIndex = 0; grainIndex < M.drift; grainIndex += 1) {
      const t = 0.15 + 0.8 * rnd(variant, `t${index}g`, grainIndex);
      const [gx, gy] = p(t);
      const jitter = (rnd(variant, `t${index}j`, grainIndex) - 0.5) * 10;
      drift.setColor(colour(lean, saturation * 0.45, lightness + 30, 0.55 * (1 - t)));
      canvas.drawCircle(gx + jitter, gy - jitter, 0.35 + 0.4 * rnd(variant, `t${index}s`, grainIndex), drift);
    }
  }

  // 5. Particulates: clustered grains, scattered grains thinning outward, and a few micro-lights with their own bloom.
  const grain = Skia.Paint();
  grain.setAntiAlias(true);
  grain.setBlendMode(BlendMode.Plus);
  const dot = (x: number, y: number, r: number, light: number, alpha: number, sat = saturation * 0.45) => {
    grain.setColor(colour(hue, sat, light, alpha));
    canvas.drawCircle(x, y, r, grain);
  };
  for (let cluster = 0; cluster < M.clusters; cluster += 1) {
    const along = (rnd(variant, 'ca', cluster) * 2 - 1) * 0.85;
    const across = (rnd(variant, 'cc', cluster) * 2 - 1) * 0.4;
    const cx = (ax * along - ay * across) * U;
    const cy = (ay * along + ax * across) * U;
    const spread = (0.08 + 0.12 * rnd(variant, 'cs', cluster)) * U;
    for (let index = 0; index < M.grains; index += 1) {
      const a = rnd(variant, `g${cluster}a`, index) * Math.PI * 2;
      const d = spread * Math.sqrt(-2 * Math.log(1 - 0.98 * rnd(variant, `g${cluster}d`, index)));
      const big = rnd(variant, `g${cluster}s`, index);
      dot(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.25 + 0.55 * big * big, lightness + 34, 0.35 + 0.5 * big);
    }
  }
  for (let index = 0; index < M.scatter; index += 1) {
    const a = rnd(variant, 'sa', index) * Math.PI * 2;
    const s = rnd(variant, 'sd', index);
    const d = 1.25 * s * s * U;
    dot(Math.cos(a) * d * 1.2, Math.sin(a) * d * 0.85, 0.22 + 0.3 * rnd(variant, 'ss', index), lightness + 28, 0.5 * (1 - s));
  }
  const spark = Skia.Paint();
  spark.setAntiAlias(true);
  spark.setBlendMode(BlendMode.Plus);
  spark.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 2.4, true));
  for (let index = 0; index < M.sparks; index += 1) {
    const a = rnd(variant, 'ka', index) * Math.PI * 2;
    const d = (0.25 + 0.75 * rnd(variant, 'kd', index)) * U;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    spark.setColor(colour(hue, saturation * 0.8, lightness + 18, 0.5));
    canvas.drawCircle(x, y, 3.2, spark);
    dot(x, y, 0.9, 96, 0.95, 20);
  }
}
