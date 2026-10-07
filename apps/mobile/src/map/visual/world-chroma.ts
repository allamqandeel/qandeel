/**
 * LA-VIS-01 — the world's CHROMA: a declared presentation palette and the world-space field that spreads it.
 *
 * Product Owner authorization (2026-10-07, LA-VIS-01): the Living Analysis world may carry the visual families of the
 * approved reference — cyan / teal, deep blue, emerald, violet, magenta / rose, amber / gold — as PRESENTATION ONLY. This
 * module is the one declared source of those families. It is not generated from I-08B1 (whose closed palette is
 * teal → indigo) and does not pretend to be: it supersedes only the visual palette LA-VIS-01 needs, and every I-08B1
 * spatial and semantic law stays as it was.
 *
 * A colour here MEANS NOTHING. It is a smooth, low-frequency function of a canonical world address and nothing else:
 *
 *   no camera, no screen position, no zoom      — the same address is the same colour from every viewpoint;
 *   no identity, no family, no category         — two places are alike in colour only because they are near;
 *   no importance, popularity, activity, recency, confidence, emotion, ranking, views or engagement.
 *
 * Neighbouring places therefore share a colour and the world reads as large coherent regions, with soft transitions and
 * no boundaries; the regions are where the field happens to be, not what anything is. Nothing here reaches placement,
 * hit testing, accessibility, motion, zoom or projection.
 */
import type { CanonicalWorldAddress } from '../world';

export interface ChromaFamily {
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
}

/**
 * The six authorized families, in the order the field walks them (a loop, so every family has two neighbours and
 * the walk never jumps). HSL as numbers: hue in degrees, saturation and lightness in percent.
 */
export const WORLD_CHROMA_FAMILIES: readonly ChromaFamily[] = Object.freeze([
  Object.freeze({ hue: 186, saturation: 78, lightness: 50 }), // cyan / teal
  Object.freeze({ hue: 218, saturation: 82, lightness: 52 }), // deep blue
  Object.freeze({ hue: 268, saturation: 72, lightness: 58 }), // violet
  Object.freeze({ hue: 328, saturation: 74, lightness: 56 }), // magenta / rose
  Object.freeze({ hue: 34, saturation: 92, lightness: 52 }), // amber / gold
  Object.freeze({ hue: 152, saturation: 66, lightness: 46 }), // emerald
]);

/** World units per field cycle: one colour region spans a few canonical Home steps. */
const WAVELENGTH = 6_000_000;
/** The field is evaluated on the address modulo this period (2^40 units), so it stays exact in a double. */
const PERIOD = 1n << 40n;

const wrapped = (value: bigint): number => Number(((value % PERIOD) + PERIOD) % PERIOD);

/**
 * The field's position along the family loop at one world address, in [0, families): three slow, incommensurate waves,
 * so the regions are irregular, large and smooth.
 */
export function chromaPhase(address: CanonicalWorldAddress): number {
  const u = (wrapped(address.x) / WAVELENGTH) * Math.PI * 2;
  const v = (wrapped(address.y) / WAVELENGTH) * Math.PI * 2;
  const f = 0.5 + 0.22 * Math.sin(u * 0.83 + v * 0.31 + 0.7) + 0.18 * Math.sin(v * 0.97 - u * 0.44 + 2.1) + 0.1 * Math.sin((u + v) * 0.58 + 4.4);
  const n = WORLD_CHROMA_FAMILIES.length;
  const loops = 1.15;
  return ((((f * loops) % 1) + 1) % 1) * n;
}

/** The colour of the world at one address: the two neighbouring families, blended smoothly (never a hard edge). */
export function worldChroma(address: CanonicalWorldAddress): ChromaFamily {
  const n = WORLD_CHROMA_FAMILIES.length;
  const phase = chromaPhase(address);
  const index = Math.floor(phase) % n;
  const a = WORLD_CHROMA_FAMILIES[index];
  const b = WORLD_CHROMA_FAMILIES[(index + 1) % n];
  const raw = phase - Math.floor(phase);
  const t = raw * raw * (3 - 2 * raw);
  // The shorter way round the hue circle, so magenta → amber passes through rose and gold, not through green.
  let dh = b.hue - a.hue;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return {
    hue: (((a.hue + dh * t) % 360) + 360) % 360,
    saturation: a.saturation + (b.saturation - a.saturation) * t,
    lightness: a.lightness + (b.lightness - a.lightness) * t,
  };
}
