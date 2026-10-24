// S8A-04 CP2 — the Shared field geometry (Controlled Amendment §4.2): where a new meaning sits, derived by the server from
// the anchors the placer named. A PURE function of the World's existing points, the new meanings and their anchors.
//
// Nothing else enters it: no time, no order index, no random generator, no hash and no floating point. The angles are
// fixed integer tables (cos / sin scaled by 2^20, rounded once and written here), every coordinate is a BigInt, and the
// input order of the new meanings never matters: they are placed in topological order of their new-to-new anchors, ties
// broken by the ascending Unicode order of their meaning text. A place, once written, never moves (the 0148 trigger), so
// a place depends on the places that existed when it was placed and nothing is ever laid out again. Nothing is logged.

export const SHARED_FIELD_LAYOUT_VERSION = 'shared_field_anchor_v1' as const;

/** The unit, the minimum spacing and the radius by closeness (1 the same matter, 2 related, 3 the same broad area). */
export const FIELD_UNIT = 2n ** 20n;
export const FIELD_SPACING = 4n * FIELD_UNIT;
export const FIELD_RADIUS: Readonly<Record<1 | 2 | 3, bigint>> = Object.freeze({ 1: 4n * FIELD_UNIT, 2: 12n * FIELD_UNIT, 3: 24n * FIELD_UNIT });
/** The region rings: radius 64U, 128U, …, sixteen fixed angles each. */
export const FIELD_REGION_RING = 64n * FIELD_UNIT;
const ANCHOR_WEIGHT: Readonly<Record<1 | 2 | 3, bigint>> = Object.freeze({ 1: 3n, 2: 2n, 3: 1n });
const COORDINATE_BOUND = 2n ** 62n;
/** How far a spiral or the rings are searched before the placement is refused (never reached in a real World). */
const SEARCH_STEPS = 4096;

const SCALE = 1_048_576n;
/** cos / sin of k · 30°, k = 0…11, scaled by 2^20. */
const SPIRAL_ANGLES: ReadonlyArray<readonly [bigint, bigint]> = Object.freeze([
  [1048576n, 0n], [908093n, 524288n], [524288n, 908093n], [0n, 1048576n], [-524288n, 908093n], [-908093n, 524288n],
  [-1048576n, 0n], [-908093n, -524288n], [-524288n, -908093n], [0n, -1048576n], [524288n, -908093n], [908093n, -524288n],
] as const);
/** cos / sin of k · 22.5°, k = 0…15, scaled by 2^20. */
const RING_ANGLES: ReadonlyArray<readonly [bigint, bigint]> = Object.freeze([
  [1048576n, 0n], [968758n, 401273n], [741455n, 741455n], [401273n, 968758n], [0n, 1048576n], [-401273n, 968758n],
  [-741455n, 741455n], [-968758n, 401273n], [-1048576n, 0n], [-968758n, -401273n], [-741455n, -741455n], [-401273n, -968758n],
  [0n, -1048576n], [401273n, -968758n], [741455n, -741455n], [968758n, -401273n],
] as const);

export interface FieldPoint { readonly x: bigint; readonly y: bigint }
/** An existing place of the World: its point and its region, and its commit order (to find each region's first place). */
export interface ExistingFieldPlace { readonly ref: string; readonly point: FieldPoint; readonly region: string; readonly order: number }
/** One new meaning of this pass. */
export interface NewFieldMeaning { readonly ref: string; readonly meaning: string; readonly region: string }
/** An anchor: an existing place (`P…`), another new meaning (`N…`) or a region (`R:<region>`), with its closeness. */
export interface FieldAnchor { readonly to: string; readonly closeness: 1 | 2 | 3 }

/** Compares two strings by Unicode code point (not UTF-16 code unit). */
export function compareCodePoints(left: string, right: string): number {
  const l = [...left];
  const r = [...right];
  for (let index = 0; index < Math.min(l.length, r.length); index += 1) {
    const difference = (l[index].codePointAt(0) as number) - (r[index].codePointAt(0) as number);
    if (difference !== 0) return difference;
  }
  return l.length - r.length;
}

/** The new meanings in ascending Unicode order of their meaning (their N refs are assigned in this order, §10 M4). */
export function inMeaningOrder<T extends { readonly meaning: string; readonly region: string }>(meanings: ReadonlyArray<T>): T[] {
  return [...meanings].sort((l, r) => compareCodePoints(l.meaning, r.meaning) || compareCodePoints(l.region, r.region));
}

const square = (value: bigint) => value * value;
const farEnough = (point: FieldPoint, taken: ReadonlyArray<FieldPoint>) =>
  taken.every((other) => square(point.x - other.x) + square(point.y - other.y) >= square(FIELD_SPACING));
const inBounds = (point: FieldPoint) => [point.x, point.y].every((value) => value >= -COORDINATE_BOUND && value < COORDINATE_BOUND);
const around = (centre: FieldPoint, radius: bigint, [cos, sin]: readonly [bigint, bigint]): FieldPoint =>
  ({ x: centre.x + (radius * cos) / SCALE, y: centre.y + (radius * sin) / SCALE });

/** The first free point of the spiral around `target`: angles k · 30°, radii r(closest) + j · s, in that order. */
function spiral(target: FieldPoint, closest: 1 | 2 | 3, taken: ReadonlyArray<FieldPoint>): FieldPoint | null {
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const radius = FIELD_RADIUS[closest] + BigInt(step) * FIELD_SPACING;
    for (const angle of SPIRAL_ANGLES) {
      const point = around(target, radius, angle);
      if (inBounds(point) && farEnough(point, taken)) return point;
    }
  }
  return null;
}

/** A new region's seed: the World's first place at (0, 0); otherwise the first free point of the region rings. */
function regionSeed(taken: ReadonlyArray<FieldPoint>): FieldPoint | null {
  const origin = { x: 0n, y: 0n };
  if (taken.length === 0) return origin;
  for (let ring = 1; ring <= SEARCH_STEPS; ring += 1) {
    for (const angle of RING_ANGLES) {
      const point = around(origin, FIELD_REGION_RING * BigInt(ring), angle);
      if (inBounds(point) && farEnough(point, taken)) return point;
    }
  }
  return null;
}

/**
 * The points of the new meanings, by their ref, or null when they cannot be derived (an anchor that names nothing, a cycle
 * between new meanings, a meaning without anchors, or no free point). The decoder has already refused those shapes; this
 * re-checks what it relies on rather than trusting it.
 */
export function placeNewMeanings(
  existing: ReadonlyArray<ExistingFieldPlace>, meanings: ReadonlyArray<NewFieldMeaning>, anchors: ReadonlyMap<string, ReadonlyArray<FieldAnchor>>,
): Map<string, FieldPoint> | null {
  const taken: FieldPoint[] = existing.map((place) => place.point);
  const pointOf = new Map(existing.map((place) => [place.ref, place.point]));
  // Each existing region's seed is its first place.
  const seedOf = new Map<string, FieldPoint>();
  for (const place of [...existing].sort((l, r) => l.order - r.order)) if (!seedOf.has(place.region)) seedOf.set(place.region, place.point);
  // A region new to the World gets its seed now, in Unicode order of its key, before any new meaning is placed.
  const newRegions = [...new Set(meanings.map((meaning) => meaning.region))].filter((region) => !seedOf.has(region)).sort(compareCodePoints);
  const reserved: FieldPoint[] = [];
  const freshSeeds = new Set<string>();
  for (const region of newRegions) {
    const seed = regionSeed([...taken, ...reserved]);
    if (seed === null) return null;
    seedOf.set(region, seed);
    reserved.push(seed);
    freshSeeds.add(region);
  }
  const byRef = new Map(meanings.map((meaning) => [meaning.ref, meaning]));
  if (byRef.size !== meanings.length) return null;
  const placed = new Map<string, FieldPoint>();
  const ordered = inMeaningOrder(meanings);
  while (placed.size < meanings.length) {
    const next = ordered.find((meaning) => !placed.has(meaning.ref)
      && (anchors.get(meaning.ref) ?? []).every((anchor) => !byRef.has(anchor.to) || placed.has(anchor.to)));
    if (next === undefined) return null;
    const own = anchors.get(next.ref) ?? [];
    if (own.length === 0) return null;
    let weight = 0n;
    let sumX = 0n;
    let sumY = 0n;
    let closest: 1 | 2 | 3 = 3;
    for (const anchor of own) {
      const point = anchor.to.startsWith('R:') ? seedOf.get(anchor.to.slice(2)) : placed.get(anchor.to) ?? pointOf.get(anchor.to);
      if (point === undefined || ![1, 2, 3].includes(anchor.closeness)) return null;
      weight += ANCHOR_WEIGHT[anchor.closeness];
      sumX += ANCHOR_WEIGHT[anchor.closeness] * point.x;
      sumY += ANCHOR_WEIGHT[anchor.closeness] * point.y;
      if (anchor.closeness < closest) closest = anchor.closeness;
    }
    const target = { x: sumX / weight, y: sumY / weight };
    const occupied = [...taken, ...placed.values()];
    // A meaning anchored only to a region that has no place yet founds it, at its seed.
    const founds = own.length === 1 && own[0].to.startsWith('R:') && freshSeeds.has(own[0].to.slice(2));
    const point = founds && farEnough(target, occupied) ? target : spiral(target, closest, occupied);
    if (point === null) return null;
    placed.set(next.ref, point);
    if (founds) freshSeeds.delete(own[0].to.slice(2));
  }
  return placed;
}
