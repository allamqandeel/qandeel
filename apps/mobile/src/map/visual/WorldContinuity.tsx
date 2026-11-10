/**
 * MAP-CLOSE-01 V-3 — C1 / C2 / C3: the Personal Map's S3-R2 world, CONTINUOUS across distance.
 *
 * Product Owner, 2026-11-10 ("V-3: Final Visual Integration — PO APPROVED", on the approved derived continuity
 * reference): FAR, MID, NEAR and ANALYTICAL are one world approached, never three designs and never one picture
 * enlarged. This module is the Personal Map's own visual override of the I-08B1 distance response, separated from it:
 * the generated schedule and `useWorldResponse` are read, never edited, and only the Personal owner opts in (through
 * `WorldCanvas`'s `continuity`). Shared and Public worlds never reach it.
 *
 *   C1 — the S3-R2 material, phone-sized: the neutral DEEP SPACE (S3-R2 `amb` + `fill`: soft cool clouds, faint
 *        ridges, quiet wisps) and the FINE THREADS of each place (S3-R2 `fine` / `farweb`) in the place's chroma. Both
 *        are recorded once per process into raster tiles, painted in the S8B-06 bands (`rasterTile`).
 *   C2 — continuity: the deep space and the coloured clouds no longer drain away after FAR, and the place's threads are
 *        drawn at four world sizes that hand over to one another as the presented distance changes, so the glass
 *        always holds the material at about the size it has at FAR (the reference's rule: closer reveals more of the
 *        same world at a finer scale). Every weight is read on the plane's own frames: no animation of its own.
 *   C3 — ANALYTICAL: past NEAR a place's mass keeps its NEAR size on the glass instead of growing into a fog. The
 *        camera, the placement and hit testing do not move: the cap is a paint scale about the place's own point.
 *
 * Truth (unchanged): nothing here is an object, a relation, a group or a membership. The deep space is the same
 * everywhere. A place's threads are the same material at every place, in the colour the world has at its ADDRESS
 * (`./world-chroma`), anchored to the world (not to the screen) so they travel with it. Nothing here is read by
 * membership, placement, hit testing, accessibility or an act.
 */
import { useEffect, useState } from 'react';
import { BlendMode, FilterMode, Group, PaintStyle, Picture, Skia, StrokeCap, TileMode, createPicture, vec, type SkCanvas, type SkPicture } from '@shopify/react-native-skia';

import { usePresentationReading, useReadingOf, type DerivedValue, type PresentationCameraBinding } from '../../motion';
import { DEFAULT_MAP_SCALE } from '../camera';
import type { CanonicalWorldAddress } from '../world';
import type { ChromaFamily } from './world-chroma';
import { PLACE_ATMOSPHERE_WORLD_UNITS, hsla, placeAtmosphereRadius, unitsPerPoint } from './world-resolver';
import { WORLD_VISUAL, worldSchedule } from './world-visual.generated';
import { FadedLayer, FadedPicture, Stratum, WorldAtmosphere, ladderHue, rasterTile } from './WorldStrata';
import type { WorldResponse } from './useWorldResponse';

// ------------------------------------------------------------------------------------- the shares

/** C2: how much of the I-08B1 fade of the deep clouds is applied (1 = all of it), and how much FAR colour stays. */
const COSMOS_FADE = 0.35;
const FAR_HOLD = 0.3;

/** The place's world radius at FAR, in points: the yardstick of the presented distance below. */
const FAR_RADIUS = placeAtmosphereRadius(DEFAULT_MAP_SCALE);
const DEFAULT_UPP = unitsPerPoint(DEFAULT_MAP_SCALE);
const LOG8 = Math.log(8);

/** C1: the fine threads of a place — one tile of the material, its four world sizes, and how it is worn. */
const WEB = Object.freeze({
  /** The tile, in points on the glass at its own distance, painted with a wrapped margin at this raster share. */
  tile: 384,
  margin: 12,
  raster: 1.5,
  /** Threads: how many, how many tries to place them, steps and step length (tile points). */
  count: 900,
  tries: 9000,
  steps: [18, 66],
  step: 1.4,
  /** A share of the threads are a little wider and brighter: the filaments the eye follows. */
  bright: 0.06,
  brightWidth: 0.7,
  /** Thread weight [min, span] before the density, and the density field's thresholds. */
  weight: [0.16, 0.6],
  density: [0.34, 0.68],
  /** How far around a place its threads reach (radii), and the stops of their falloff. */
  reach: 1.15,
  falloff: [1, 0.72, 0],
  /** How the place's chroma is worn by a thread: saturation share and lightness lift. */
  saturation: 0.82,
  lift: 16,
  /** The four world sizes: FAR, MID, NEAR and ANALYTICAL, one rung (×8) apart, and their meaning-free tile offsets. */
  levels: [0, 1, 2, 3],
  offsets: [
    [0, 0],
    [0.37, 0.61],
    [0.73, 0.19],
    [0.11, 0.83],
  ],
  /** The whole web's weight on the glass. */
  alpha: 0.8,
});

/** C1: the deep space — one tile, at the nebula's own depth plane. */
const DEEP = Object.freeze({
  tile: 512,
  margin: 16,
  raster: 0.6,
  /** Two soft cloud passes (noise cycles across the tile, seed, ladder rung, lightness, alpha → gain and floor). */
  clouds: [
    { cycles: 3, seed: 31, rung: 0.85, light: 14, gain: 1.9, floor: 0.75, alpha: 0.4 },
    { cycles: 5, seed: 37, rung: 1, light: 12, gain: 2.2, floor: 1.05, alpha: 0.32 },
  ],
  saturation: 1.7,
  /** Faint far ridges, only where the clouds are. */
  ridges: { cycles: 7, seed: 41, rung: 0.5, light: 42, sharp: 14, alpha: 0.1 },
  /** Quiet wisps (S3-R2 `fill`): count, steps, weight, rung and lightness. */
  wisps: { count: 150, steps: [50, 160], step: 2.2, weight: [0.05, 0.12], rung: 0.6, light: 72 },
  weight: 1,
});

// ------------------------------------------------------------------------------------- C2: the clouds kept

/**
 * The world-anchored atmosphere of the Personal Map: the S3-R2 deep space beneath, then the canonical strata with the
 * I-08B1 fade of their clouds held back, so depth and colour stay when the reader comes closer.
 */
export function ContinuityAtmosphere(props: Parameters<typeof WorldAtmosphere>[0]) {
  const { response, motion, envelope, drift } = props;
  const S = useReadingOf(response.approach, (A) => {
    'worklet';
    return worldSchedule(A);
  });
  const nebA = WORLD_VISUAL.material.neb.a;
  const nebulaBase = useReadingOf(S, (s) => {
    'worklet';
    return nebA * (1 - (1 - s.cosmos) * COSMOS_FADE);
  });
  const nebulaFar = useReadingOf(S, (s) => {
    'worklet';
    return Math.min(1, nebA * (1 - (1 - s.cosmos) * COSMOS_FADE) * (s.far + (1 - s.far) * FAR_HOLD) * 2.75);
  });
  const nebulaMap = useReadingOf(S, (s) => {
    'worklet';
    return Math.min(1, nebA * (1 - (1 - s.cosmos) * COSMOS_FADE) * s.mapA * 2.8);
  });
  const tiles = useContinuityTiles();
  const kept: WorldResponse = { ...response, nebulaBase, nebulaFar, nebulaMap };
  return (
    <>
      {/* At the clouds' depth plane: their drift is taken modulo their own tile (2048), a whole multiple of this one. */}
      <Stratum motion={motion} drift={drift.nebula} tile={DEEP.tile} envelope={envelope} opacity={1}>
        {() => <FadedPicture picture={tiles.deep} opacity={DEEP.weight} x={0} y={0} width={DEEP.tile} height={DEEP.tile} />}
      </Stratum>
      <WorldAtmosphere {...props} response={kept} />
    </>
  );
}

// ------------------------------------------------------------------------------------- the presented distance

/** The presented distance in rungs from FAR (0 FAR, 1 MID, 2 NEAR, 3 ANALYTICAL), NOT clamped: past NEAR it goes on. */
function usePresentedRung(motion: PresentationCameraBinding, radius: number): DerivedValue<number> {
  return usePresentationReading(motion, (plane) => {
    'worklet';
    const s = plane[2].scale > 0 ? plane[2].scale : 1;
    const shown = radius * s;
    return shown > 0 ? Math.log(shown / FAR_RADIUS) / LOG8 : 0;
  });
}

// ------------------------------------------------------------------------------------- C3: the mass capped

/**
 * A place's mass past NEAR: its paint is scaled about the place's own point so the glass never shows it larger than at
 * NEAR. At or before NEAR the scale is exactly 1. A plain transform (no origin): it is paint, not an anchor.
 */
export function NearCap({ x, y, radius, motion, children }: { x: number; y: number; radius: number; motion: PresentationCameraBinding; children: React.ReactNode }) {
  const rung = usePresentedRung(motion, radius);
  const transform = useReadingOf(rung, (q) => {
    'worklet';
    const cap = q > 2 ? Math.pow(8, 2 - q) : 1;
    return [{ translateX: x }, { translateY: y }, { scale: cap }, { translateX: -x }, { translateY: -y }];
  });
  return <Group transform={transform}>{children}</Group>;
}

// ------------------------------------------------------------------------------------- C1: the threads of a place

export interface ContinuityPlace {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly address: CanonicalWorldAddress;
  readonly chroma: ChromaFamily;
}

/** The clip of a world size that is drawn (unbounded) and of one at zero weight (empty: nothing of it is drawn). */
const OPEN = Object.freeze({ x: -1e7, y: -1e7, width: 2e7, height: 2e7 });
const CLOSED = Object.freeze({ x: 0, y: 0, width: 0, height: 0 });

/**
 * The fine threads of every presented place, on the plane (they travel and scale with it). Four world sizes, each the
 * same tile: at its own distance it is WEB.tile points on the glass; the presented distance hands one size over to the
 * next, on the plane's own frames.
 */
export function PlaceThreads({ places, radius, motion }: { places: readonly ContinuityPlace[]; radius: number; motion: PresentationCameraBinding }) {
  const tiles = useContinuityTiles();
  const rung = usePresentedRung(motion, radius);
  const last = WEB.levels.length - 1;
  const alpha = WEB.alpha;
  const weights = WEB.levels.map((level) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- a fixed count of sizes, the same on every render
    useReadingOf(rung, (q) => {
      'worklet';
      const at = q < 0 ? 0 : q > last ? last : q;
      const t = 1 - Math.abs(at - level);
      const c = t < 0 ? 0 : t;
      return c * c * (3 - 2 * c) * alpha;
    }),
  );
  const clips = weights.map((weight) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- a fixed count of sizes, the same on every render
    useReadingOf(weight, (w) => {
      'worklet';
      return w > 0 ? OPEN : CLOSED;
    }),
  );
  if (!(radius > 0) || places.length === 0) return null;
  const { x, y, width, height } = reachOf(places, radius);
  return (
    <>
      {WEB.levels.map((level) => (
        <Group key={level} clip={clips[level]}>
          <FadedLayer opacity={weights[level]} x={x} y={y} width={width} height={height}>
            <Picture picture={threadsAt(tiles.web, level, radius, places)} />
          </FadedLayer>
        </Group>
      ))}
    </>
  );
}

/** The bounds the threads of every place can reach. */
function reachOf(places: readonly ContinuityPlace[], radius: number) {
  const reach = radius * WEB.reach;
  const xs = places.map((place) => place.x);
  const ys = places.map((place) => place.y);
  const x = Math.min(...xs) - reach;
  const y = Math.min(...ys) - reach;
  return { x, y, width: Math.max(...xs) + reach - x, height: Math.max(...ys) + reach - y };
}

/** One world size of the threads around every place, recorded for this render (the tile itself is painted once). */
function threadsAt(tile: SkPicture, level: number, radius: number, places: readonly ContinuityPlace[]): SkPicture {
  const reach = radius * WEB.reach;
  const area = reachOf(places, radius);
  return createPicture((canvas) => {
    // The tile's size in plane points at this distance, and in world units (exact, the same at every distance).
    const local = (WEB.tile * Math.pow(8, level) * FAR_RADIUS) / radius;
    const worldTile = BigInt(WEB.tile * Math.pow(8, level)) * BigInt(Math.round(DEFAULT_UPP));
    const upp = PLACE_ATMOSPHERE_WORLD_UNITS / radius;
    // World-anchored: the tile's origin is where the world's own origin falls, read from the first place's address, so
    // every place shares one continuous web and it travels with the world (world y grows upward, the glass downward).
    const anchor = places[0];
    const [ox, oy] = WEB.offsets[level];
    const originX = anchor.x - Number(wrap(anchor.address.x, worldTile)) / upp + ox * local;
    const originY = anchor.y + Number(wrap(anchor.address.y, worldTile)) / upp + oy * local;
    const matrix = Skia.Matrix();
    matrix.translate(originX, originY);
    matrix.scale(local / WEB.tile, local / WEB.tile);
    const threads = tile.makeShader(TileMode.Repeat, TileMode.Repeat, FilterMode.Linear, matrix);
    for (const place of places) {
      const { hue, saturation, lightness } = place.chroma;
      const fall = Skia.Shader.MakeRadialGradient(
        vec(place.x, place.y),
        reach,
        WEB.falloff.map((alpha) => Skia.Color(hsla(hue, saturation, lightness, alpha))),
        [0, 0.55, 1],
        TileMode.Clamp,
      );
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setShader(Skia.Shader.MakeBlend(BlendMode.DstIn, threads, fall));
      paint.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color(hsla(hue, saturation * WEB.saturation, lightness + WEB.lift, 1)), BlendMode.SrcIn));
      paint.setBlendMode(BlendMode.Plus);
      canvas.drawCircle(place.x, place.y, reach, paint);
    }
  }, Skia.XYWHRect(area.x, area.y, area.width, area.height));
}

function wrap(value: bigint, period: bigint): bigint {
  const r = value % period;
  return r < 0n ? r + period : r;
}

// ------------------------------------------------------------------------------------- the tiles

interface ContinuityTiles {
  readonly web: SkPicture;
  readonly deep: SkPicture;
}

let painted: ContinuityTiles | null = null;
let painting: Promise<ContinuityTiles> | null = null;
let unpaintedTiles: ContinuityTiles | null = null;

/** Both tiles, painted on first use in the S8B-06 bands and kept for the life of the process. */
function continuityTiles(): Promise<ContinuityTiles> {
  if (painting !== null) return painting;
  painting = (async () => {
    const web = await rasterTile(WEB.tile, WEB.margin, WEB.raster, drawWeb);
    const deep = await rasterTile(DEEP.tile, DEEP.margin, DEEP.raster, drawDeep);
    painted = { web, deep };
    return painted;
  })().catch((error: unknown) => {
    painting = null;
    throw error;
  });
  return painting;
}

function unpainted(): ContinuityTiles {
  if (unpaintedTiles === null) {
    unpaintedTiles = {
      web: createPicture(() => undefined, Skia.XYWHRect(0, 0, WEB.tile, WEB.tile)),
      deep: createPicture(() => undefined, Skia.XYWHRect(0, 0, DEEP.tile, DEEP.tile)),
    };
  }
  return unpaintedTiles;
}

/** The tiles as they are now: painted, or empty while they are being painted. */
function useContinuityTiles(): ContinuityTiles {
  const [shown, setShown] = useState<ContinuityTiles>(() => painted ?? unpainted());
  useEffect(() => {
    if (shown === painted) return undefined;
    let live = true;
    void continuityTiles().then((tiles) => {
      // Where nothing is painted differently (no raster surface, as in Jest), nothing is drawn again.
      const same = tiles.web === shown.web && tiles.deep === shown.deep;
      if (live && !same) setShown(tiles);
    });
    return () => {
      live = false;
    };
  }, [shown]);
  return shown;
}

// ------------------------------------------------------------------------------------- the material

/** A stable, meaning-free stream of numbers in [0, 1). */
function stream(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function lattice(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

/** Value noise in [0, 1] whose lattice wraps every `period` cells: seamless across the tile. */
function noise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = (n: number) => ((n % period) + period) % period;
  const a = lattice(w(xi), w(yi), seed);
  const b = lattice(w(xi + 1), w(yi), seed);
  const c = lattice(w(xi), w(yi + 1), seed);
  const d = lattice(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal value noise over a tile of side `size`, starting at `cells` cells across it. */
function fbm(x: number, y: number, size: number, cells: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let period = cells;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += amp * noise((x / size) * period, (y / size) * period, period, seed + octave);
    norm += amp;
    amp *= 0.5;
    period *= 2;
  }
  return sum / norm;
}

/**
 * A fractal noise sampled once onto a periodic grid and read back bilinearly: a walker's step then costs a few
 * multiplications instead of an octave stack (the JS thread is a live call's audio path, S8B-06 CP3).
 */
function noiseGrid(size: number, cells: number, seed: number, octaves: number, resolution: number): (x: number, y: number) => number {
  const grid = new Float32Array(resolution * resolution);
  for (let j = 0; j < resolution; j += 1) {
    for (let i = 0; i < resolution; i += 1) grid[j * resolution + i] = fbm((i / resolution) * size, (j / resolution) * size, size, cells, seed, octaves);
  }
  return sampler(grid, size, resolution);
}

/** A periodic grid over the tile, read back bilinearly. */
function sampler(grid: Float32Array, size: number, resolution: number): (x: number, y: number) => number {
  return (x, y) => {
    const gx = (((x / size) * resolution) % resolution + resolution) % resolution;
    const gy = (((y / size) * resolution) % resolution + resolution) % resolution;
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const fx = gx - i;
    const fy = gy - j;
    const i1 = (i + 1) % resolution;
    const j1 = (j + 1) % resolution;
    const a = grid[j * resolution + i];
    const b = grid[j * resolution + i1];
    const c = grid[j1 * resolution + i];
    const d = grid[j1 * resolution + i1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

/** The same periodic grid, filled from any function over the tile. */
function noiseGridFrom(size: number, resolution: number, value: (x: number, y: number) => number): (x: number, y: number) => number {
  const grid = new Float32Array(resolution * resolution);
  for (let j = 0; j < resolution; j += 1) {
    for (let i = 0; i < resolution; i += 1) grid[j * resolution + i] = value((i / resolution) * size, (j / resolution) * size);
  }
  return sampler(grid, size, resolution);
}

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Thread {
  /** Every other step of the walk, as x, y pairs (the line between them is straight enough at this scale). */
  readonly points: readonly number[];
  readonly weight: number;
  readonly bright: boolean;
  readonly bounds: readonly [number, number, number, number];
}

/** The flow both tiles' threads walk: the unit vector of a fractal angle over ONE unit tile, built once. */
interface Flow {
  readonly cos: (x: number, y: number) => number;
  readonly sin: (x: number, y: number) => number;
}

let flow: Flow | null = null;

function flowField(): Flow {
  if (flow !== null) return flow;
  const resolution = 64;
  const angle = noiseGrid(1, 4, 909, 3, resolution);
  flow = {
    cos: noiseGridFrom(1, resolution, (x, y) => Math.cos(angle(x, y) * Math.PI * 4)),
    sin: noiseGridFrom(1, resolution, (x, y) => Math.sin(angle(x, y) * Math.PI * 4)),
  };
  return flow;
}

/** Threads that walk a flow field over a seamless tile (S3-R2's walkers): clumped by a density field, so voids stay. */
function walkThreads(size: number, count: number, tries: number, steps: readonly number[], step: number, seed: number, densityOf: (x: number, y: number) => number, weight: readonly number[], brightShare: number): Thread[] {
  const random = stream(seed);
  const { cos, sin } = flowField();
  const threads: Thread[] = [];
  for (let attempt = 0; attempt < tries && threads.length < count; attempt += 1) {
    let x = random() * size;
    let y = random() * size;
    const density = densityOf(x, y);
    if (random() > 0.06 + 0.94 * density) continue;
    const length = steps[0] + Math.floor(random() * (steps[1] - steps[0]));
    let vx = random() - 0.5;
    let vy = random() - 0.5;
    const points = [x, y];
    let minX = x;
    let minY = y;
    let maxX = x;
    let maxY = y;
    for (let index = 0; index < length; index += 1) {
      let ax = cos(x / size, y / size);
      let ay = sin(x / size, y / size);
      if (ax * vx + ay * vy < 0) {
        ax = -ax;
        ay = -ay;
      }
      // One meaning-free wobble per step, across the direction of travel.
      const wobble = (random() - 0.5) * 0.14;
      vx = vx * 0.88 + ax * 0.12 - vy * wobble;
      vy = vy * 0.88 + ay * 0.12 + vx * wobble;
      const norm = Math.sqrt(vx * vx + vy * vy) || 1;
      vx /= norm;
      vy /= norm;
      x += vx * step;
      y += vy * step;
      if (index % 2 === 1 || index === length - 1) {
        points.push(x, y);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    threads.push({
      points,
      weight: (weight[0] + weight[1] * random() ** 2) * (0.4 + 0.6 * density),
      bright: random() < brightShare,
      bounds: [minX, minY, maxX, maxY],
    });
  }
  return threads;
}

const BUCKETS = 8;
const at = (value: number) => Math.round(value * 10) / 10;

/**
 * Threads as a few paths, one per weight bucket and width: each thread in three pieces (faint, full, faint), each drawn
 * again across every tile edge it reaches, so the tile is seamless. Built once, each path from ONE string (one native
 * call, not one per point); every band draws the same paths.
 */
function threadPaths(threads: readonly Thread[], size: number, margin: number, top: number) {
  const parts = new Map<string, { svg: string[]; alpha: number; width: number }>();
  for (const thread of threads) {
    const [minX, minY, maxX, maxY] = thread.bounds;
    const pieces = 3;
    const count = thread.points.length / 2;
    const per = Math.max(1, Math.floor(count / pieces));
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        if (maxX + ox < -margin || maxY + oy < -margin || minX + ox > size + margin || minY + oy > size + margin) continue;
        for (let piece = 0; piece < pieces; piece += 1) {
          const from = piece * per;
          const to = piece === pieces - 1 ? count - 1 : Math.min(count - 1, (piece + 1) * per);
          if (to <= from) continue;
          const alpha = thread.weight * Math.sin((Math.PI * (piece + 0.5)) / pieces);
          const bucket = Math.min(BUCKETS - 1, Math.round((alpha / top) * (BUCKETS - 1)));
          const width = thread.bright ? WEB.brightWidth : 0;
          const key = `${bucket}|${width}`;
          let entry = parts.get(key);
          if (entry === undefined) {
            entry = { svg: [], alpha: (top * Math.max(0.5, bucket)) / (BUCKETS - 1), width };
            parts.set(key, entry);
          }
          let d = `M${at(thread.points[from * 2] + ox)} ${at(thread.points[from * 2 + 1] + oy)}`;
          for (let index = from + 1; index <= to; index += 1) d += `L${at(thread.points[index * 2] + ox)} ${at(thread.points[index * 2 + 1] + oy)}`;
          entry.svg.push(d);
        }
      }
    }
  }
  return [...parts.values()].flatMap(({ svg, alpha, width }) => {
    const path = Skia.Path.MakeFromSVGString(svg.join(''));
    return path === null ? [] : [{ path, alpha, width }];
  });
}

/** A thread's stroke: a hairline (width 0) or a fine line, in one colour at one weight, adding its light. */
function strokePaint(rgb: Float32Array, alpha: number, width: number) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeWidth(width);
  paint.setColor(Float32Array.of(rgb[0], rgb[1], rgb[2], alpha));
  paint.setBlendMode(BlendMode.Plus);
  return paint;
}

let webPaths: ReturnType<typeof threadPaths> | null = null;

/** The threads tile: white light on nothing (the place's chroma colours it when it is worn). */
function drawWeb(canvas: SkCanvas) {
  if (webPaths === null) {
    const T = WEB.tile;
    const density = noiseGrid(T, 3, 97, 3, 48);
    const threads = walkThreads(T, WEB.count, WEB.tries, WEB.steps, WEB.step, 808, (x, y) => sstep(WEB.density[0], WEB.density[1], density(x, y)), WEB.weight, WEB.bright);
    webPaths = threadPaths(threads, T, WEB.margin, WEB.weight[0] + WEB.weight[1]);
  }
  const white = Float32Array.of(1, 1, 1, 1);
  for (const { path, alpha, width } of webPaths) canvas.drawPath(path, strokePaint(white, alpha, width));
}

let wispPaths: ReturnType<typeof threadPaths> | null = null;

/** The deep-space tile: the world's own deepest cloud hues as soft clouds, faint ridges, quiet wisps. */
function drawDeep(canvas: SkCanvas) {
  const T = DEEP.tile;
  const M = DEEP.margin;
  const full = Skia.XYWHRect(-M, -M, T + 2 * M, T + 2 * M);
  const sat = WORLD_VISUAL.material.neb.sat * DEEP.saturation;
  canvas.saveLayer();
  for (const cloud of DEEP.clouds) {
    const [r, g, b] = Skia.Color(hsla(ladderHue(cloud.rung), sat, cloud.light, 1));
    const paint = Skia.Paint();
    paint.setShader(Skia.Shader.MakeFractalNoise(cloud.cycles / T, cloud.cycles / T, 4, cloud.seed, T, T));
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix([0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, cloud.gain * cloud.alpha, 0, 0, 0, -cloud.floor * cloud.alpha]));
    paint.setBlendMode(BlendMode.Plus);
    canvas.drawRect(full, paint);
  }
  const ridge = DEEP.ridges;
  const [rr, rg, rb] = Skia.Color(hsla(ladderHue(ridge.rung), sat, ridge.light, 1));
  const ridges = Skia.Paint();
  ridges.setShader(Skia.Shader.MakeTurbulence(ridge.cycles / T, ridge.cycles / T, 3, ridge.seed, T, T));
  ridges.setColorFilter(Skia.ColorFilter.MakeMatrix([0, 0, 0, 0, rr, 0, 0, 0, 0, rg, 0, 0, 0, 0, rb, -ridge.sharp, 0, 0, 0, ridge.alpha]));
  ridges.setBlendMode(BlendMode.SrcATop);
  canvas.drawRect(full, ridges);
  canvas.restore();
  if (wispPaths === null) {
    const w = DEEP.wisps;
    wispPaths = threadPaths(walkThreads(T, w.count, w.count * 4, w.steps, w.step, 909, () => 1, w.weight, 0), T, M, w.weight[0] + w.weight[1]);
  }
  const wisp = Skia.Color(hsla(ladderHue(DEEP.wisps.rung), sat, DEEP.wisps.light, 1));
  for (const { path, alpha } of wispPaths) canvas.drawPath(path, strokePaint(wisp, alpha, 0));
}
