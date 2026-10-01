/**
 * VPORT-01 — the Living Analysis World's visual resolver: EXPRESSION ONLY.
 *
 * Everything here maps a fact the Map already has to the canonical I-08B1 material that expresses it.
 * It decides nothing about the world. It never reads `V`, a Home coordinate or an act; it never
 * changes what exists, where it is, what a tap hits or what the accessible tree says. Its inputs are
 * the placed node (family, placement, key), the presentation camera's distance, and the two reader
 * facts the surface already holds — the current inspection and the platform's contrast setting.
 *
 * ## What the world may express, and the one rule behind it
 *
 *   a Thread's Home        a THREAD morphology on a cleared local ground, with the medium's light
 *                          around it (I-08B1 §14 major tier) — a place;
 *   a contextual Reading   a READING morphology at the minor tier, joined to the Home that hosts it
 *                          by the canonical connection grammar (the hosting relation is a real fact);
 *   an ungeographic entry  its own morphology in screen space with NO ground and NO light: it has no
 *                          place for the world to make room for, and drawing one would invent it;
 *   the inspected object   E1R's attached marker and ink, from the frozen state tokens.
 *
 * Every per-object quantity is CONSTANT PER TIER (I-08B1 truth rule 2): no light, size, colour or
 * alpha varies with rank, confidence, importance, recency, ordinal or anything else about an object.
 * The tier is the object's placement, which is a disclosed fact; the morphology is its family, which
 * is a disclosed fact. The rotation of a mark is presentation only: a stable hash of the scene key,
 * exactly as I-08B1 gives every object an arbitrary `rot` that asserts nothing.
 *
 * ## Distance
 *
 * I-08B1 is one world seen at an approach `A` in [0, 1]: FAR, MID and NEAR are three values of it.
 * Production has no `A`; it has a camera DISTANCE, the world units per point, which Semantic Zoom
 * reinforces by exactly 8 per rung. `approachOf` reads that distance on the same logarithmic footing
 * the canonical camera uses (`fieldAt` is exponential in `A`): the default viewpoint is FAR, and two
 * reinforcement steps in is NEAR. It is OPTICAL distance and nothing else — it never names a rung,
 * never decides what is disclosed, and is never read by placement, hit testing or accessibility.
 * During a travel the presented approach follows the T-10 residual on the UI runtime, so the world
 * resolves continuously instead of switching material when the canonical camera lands.
 */
import { DEFAULT_MAP_SCALE } from '../camera';
import type { MapObjectFamily, MapSceneLocus } from '../projection';
import type { CanonicalWorldAddress, MapScale } from '../world';
import { WORLD_VISUAL, worldSchedule, type WorldSchedule } from './world-visual.generated';

/** Two reinforcement steps of Semantic Zoom span FAR → NEAR: `ln(8 · 8)`. */
const APPROACH_SPAN = Math.log(64);
const DEFAULT_UNITS_PER_POINT = Number(DEFAULT_MAP_SCALE.numerator) / Number(DEFAULT_MAP_SCALE.denominator);

const clampUnit = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/** World units per point, as a float. Used only for optical quantities, never for placement. */
export function unitsPerPoint(scale: MapScale): number {
  return Number(scale.numerator) / Number(scale.denominator);
}

/** The canonical camera's approach: 0 at the default viewpoint (FAR), 1 two reinforcement steps in (NEAR). */
export function approachOf(scale: MapScale): number {
  return clampUnit(Math.log(DEFAULT_UNITS_PER_POINT / unitsPerPoint(scale)) / APPROACH_SPAN);
}

/**
 * The approach the glass is SHOWING: the canonical approach moved by the plane's residual zoom. At the
 * start of a semantic travel the residual still shows the previous viewpoint, so this is the previous
 * approach; at rest it is the canonical one.
 */
export function presentedApproach(canonical: number, residualZoom: number): number {
  'worklet';
  const shown = canonical + Math.log(residualZoom > 0 ? residualZoom : 1) / APPROACH_SPAN;
  return shown < 0 ? 0 : shown > 1 ? 1 : shown;
}

export { worldSchedule, type WorldSchedule };

// ------------------------------------------------------------------------------------- colour

/** `hsl` → `rgba(…)`, because Skia's colour parser is the CSS rgba/hex one. */
export function hsla(hue: number, saturation: number, lightness: number, alpha: number): string {
  const s = Math.min(100, Math.max(0, saturation)) / 100;
  const l = Math.min(100, Math.max(0, lightness)) / 100;
  const h = ((hue % 360) + 360) % 360;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const byte = (n: number) => Math.round(255 * f(n));
  return `rgba(${byte(0)},${byte(8)},${byte(4)},${Math.round(clampUnit(alpha) * 1000) / 1000})`;
}

export function rgbaOf(rgb: readonly number[], alpha: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.round(clampUnit(alpha) * 1000) / 1000})`;
}

export function hexRgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgbaOf([(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha);
}

/** A canonical sprite falloff as Skia gradient colours and positions, in one hue. */
export function falloff(
  profile: keyof typeof WORLD_VISUAL.profiles,
  hue: number,
  saturation: number,
  lightness: number,
): { readonly colors: string[]; readonly positions: number[] } {
  const stops = WORLD_VISUAL.profiles[profile];
  return { colors: stops.map(([, a]) => hsla(hue, saturation, lightness, a)), positions: stops.map(([o]) => o) };
}

/** The canonical subtractive local ground (`shadeSprite`). */
export const SHADE_GRADIENT = Object.freeze({
  colors: WORLD_VISUAL.shade.map((stop) => rgbaOf(stop.rgb, stop.alpha)),
  positions: WORLD_VISUAL.shade.map((stop) => stop.offset),
});

// ------------------------------------------------------------------------------------- strata drift

/**
 * Where a world-anchored stratum's tile grid sits, so atmosphere is part of the world rather than
 * wallpaper over it, and how fast it follows the plane's residual translation.
 *
 * Standard motion: a stratum is a depth plane and tracks the hand at its D2R parallax rate, and
 * because its offset is measured against the DEFAULT distance it does not jump when Semantic Zoom
 * changes the scale about a fixed anchor. Reduced motion: D2R `parallax-differential = 0` — every
 * plane moves with the world itself, so the offset is taken at the current distance; the strata then
 * travel inside the plane's own cut-and-resolve and never move relative to the objects.
 */
export interface StratumDrift {
  readonly offsetX: number;
  readonly offsetY: number;
  /** Multiplies the plane's residual translation. */
  readonly follow: number;
}

/** `value mod period`, in [0, period), from an exact integer numerator over a positive denominator. */
function wrapBig(numerator: bigint, period: bigint): bigint {
  const r = numerator % period;
  return r < 0n ? r + period : r;
}

export function stratumDrift(
  anchor: CanonicalWorldAddress,
  scale: MapScale,
  tile: number,
  rate: number,
  reducedMotion: boolean,
): StratumDrift {
  const tileUnits = BigInt(Math.round(tile));
  if (reducedMotion) {
    // anchor / upp = anchor · den / num, taken modulo the tile in exact integers.
    const period = tileUnits * scale.numerator;
    const x = Number(wrapBig(anchor.x * scale.denominator, period)) / Number(scale.numerator);
    const y = Number(wrapBig(anchor.y * scale.denominator, period)) / Number(scale.numerator);
    return { offsetX: -x, offsetY: y, follow: 1 };
  }
  // anchor / DEFAULT · rate, modulo the tile. The rates are D2R's 0.72 and 0.48 — 18/25 and 12/25 — so
  // a modulus of tile · DEFAULT · 25 is an exact multiple of every stratum's period.
  const defaultUnits = BigInt(Math.round(DEFAULT_UNITS_PER_POINT));
  const modulus = tileUnits * defaultUnits * 25n;
  const toPoints = (value: bigint) => ((Number(wrapBig(value, modulus)) / DEFAULT_UNITS_PER_POINT) * rate) % tile;
  return {
    offsetX: -toPoints(anchor.x),
    offsetY: toPoints(anchor.y),
    follow: (unitsPerPoint(scale) / DEFAULT_UNITS_PER_POINT) * rate,
  };
}

// ------------------------------------------------------------------------------------- objects

export type WorldTier = 'major' | 'minor';
export type WorldPlacement = 'THREAD_HOME' | 'CONTEXTUAL_APPEARANCE' | 'UNGEOGRAPHIC';

export function placementOf(locus: MapSceneLocus | null): WorldPlacement {
  return locus === null ? 'UNGEOGRAPHIC' : locus.kind;
}

/** A place is the major tier; everything hosted by a place, or with none, is minor. Constant per tier. */
export function tierOf(placement: WorldPlacement): WorldTier {
  return placement === 'THREAD_HOME' ? 'major' : 'minor';
}

/**
 * The mark radius, in points, per placement. A Home is a place and carries the major mark; an
 * appearance and an ungeographic entry carry the minor one. Each sits inside the T-04 hit radius of
 * the same placement (13 / 6 / 6), so nothing painted ever reaches beyond what a tap can select.
 */
export const MARK_RADIUS_POINTS: Readonly<Record<WorldPlacement, number>> = Object.freeze({
  THREAD_HOME: 6,
  CONTEXTUAL_APPEARANCE: 3.2,
  UNGEOGRAPHIC: 3.2,
});

/**
 * How far the world's colour reaches around one disclosed place, in WORLD units: three quarters of the
 * canonical Home step (1,000,000 world units, the step the Map already uses to size its default view), so neighbouring places'
 * atmospheres meet and the world reads as one luminous body at FAR, and at MID / NEAR the reader is inside
 * the colour of the place they are looking at. A world-space quantity: it scales with the camera, exactly
 * as the canonical territory atmospheres do. A VPORT-01 presentation calibration, not a Product quantity.
 */
export const PLACE_ATMOSPHERE_WORLD_UNITS = 750_000;

/** The place atmosphere's radius in points at the current distance. */
export function placeAtmosphereRadius(scale: MapScale): number {
  return PLACE_ATMOSPHERE_WORLD_UNITS / unitsPerPoint(scale);
}

/** A stable, meaning-free rotation from the scene key (FNV-1a), in radians. */
export function presentationRotation(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) / 0x100000000) * Math.PI * 2;
}

const fmt = (value: number): string => (Math.round(value * 1000) / 1000).toString();

/**
 * The canonical morphology of one family, as an SVG path string at radius `r`, rotated by the slot's
 * own rotation factor times `rotation`, centred on (`x`, `y`). Built from the canonical `nodePath`
 * output (`WORLD_VISUAL.shapes`), never from a shape of its own.
 */
export function morphologyPath(family: MapObjectFamily, x: number, y: number, r: number, rotation: number): string {
  const shape = WORLD_VISUAL.shapes[family];
  const turn = shape.rotation * rotation;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const at = (u: number, v: number): string => `${fmt(x + (u * cos - v * sin) * r)} ${fmt(y + (u * sin + v * cos) * r)}`;
  const parts: string[] = [];
  for (const op of shape.ops as readonly (readonly (string | number)[])[]) {
    const [kind, ...n] = op as [string, ...number[]];
    switch (kind) {
      case 'M':
        parts.push(`M ${at(n[0], n[1])}`);
        break;
      case 'L':
        parts.push(`L ${at(n[0], n[1])}`);
        break;
      case 'Q':
        parts.push(`Q ${at(n[0], n[1])} ${at(n[2], n[3])}`);
        break;
      case 'close':
        parts.push('Z');
        break;
      case 'ellipse': {
        // Two half arcs about the centre, along the rotated axes.
        const [cx, cy, rx, ry] = n;
        const start = at(cx + rx, cy);
        const end = at(cx - rx, cy);
        const sweepDeg = (turn * 180) / Math.PI;
        parts.push(`M ${start} A ${fmt(rx * r)} ${fmt(ry * r)} ${fmt(sweepDeg)} 1 1 ${end} A ${fmt(rx * r)} ${fmt(ry * r)} ${fmt(sweepDeg)} 1 1 ${start} Z`);
        break;
      }
      case 'arc': {
        // The open slot: an arc from a0 to a1 (radians), rotated with the mark.
        const [cx, cy, radius, a0, a1] = n;
        const p0 = at(cx + radius * Math.cos(a0), cy + radius * Math.sin(a0));
        const p1 = at(cx + radius * Math.cos(a1), cy + radius * Math.sin(a1));
        const large = a1 - a0 > Math.PI ? 1 : 0;
        parts.push(`M ${p0} A ${fmt(radius * r)} ${fmt(radius * r)} 0 ${large} 1 ${p1}`);
        break;
      }
      default:
        throw new Error(`unknown canonical morphology op ${kind}`);
    }
  }
  return parts.join(' ');
}

/** The world's colour, joined to the medium on approach (`t.hue + 16·S.lod`). */
export function mediumHue(lod: number): number {
  return WORLD_VISUAL.worldHue + WORLD_VISUAL.mediumShift * lod;
}

/**
 * The mark material of one tier at one distance (I-08B1 §14): fill, rim, and the canonical alpha.
 * Read at the CANONICAL distance, so a mark's own ink settles with the camera; the light AROUND it is
 * what follows the presented distance (see the strata in `WorldAtmosphere`).
 */
export function markMaterial(tier: WorldTier, S: WorldSchedule, increased: boolean) {
  const m = WORLD_VISUAL.mark[tier];
  const light = m.light + S.map * WORLD_VISUAL.mark.mapLight;
  const saturation = m.sat * (1 - S.map * WORLD_VISUAL.mark.mapDesaturate);
  const visible = tier === 'major' ? S.objMaj : S.objMin;
  // F1: the increased-contrast sentinel draws every analytical stroke at full opacity.
  const alpha = increased ? 1 : Math.min(1, m.alpha * visible);
  return {
    fill: hsla(WORLD_VISUAL.worldHue, saturation, light, alpha),
    rim: hsla(WORLD_VISUAL.worldHue, saturation, light + 8, alpha),
    alpha,
    light,
    saturation,
  };
}

/** The canonical schedule at the canonical distance, for the quantities read once per render. */
export function scheduleAt(approach: number): WorldSchedule {
  return worldSchedule(approach);
}

export type WorldContrast = 'standard' | 'increased';

export function worldPalette(contrast: WorldContrast) {
  return WORLD_VISUAL.palettes[contrast];
}
