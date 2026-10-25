// SHARED-VIS-01 — the provider-neutral Shared Spatial Placer: where the new meanings of ONE pass sit in their OWN World's
// geography.
//
// S8A-04 CP2 (Controlled Amendment §4, contract `SHARED_SPATIAL_PLACEMENT_V2`) amends the port, not the graphics engine:
//
//   - ONE call per pass, made only when the reading proposed at least one place;
//   - it receives the new meanings with their regions, a bounded map of the World's places (`P1`, …) and one line per
//     region with two examples — meanings only, for placing; never an author, a time, an order or a count of turns;
//   - it answers, for each new meaning, one to three ANCHORS (an existing place, another new meaning, or a region) with a
//     closeness of 1, 2 or 3. It gives NO coordinate: the server derives the point from the anchors with the pure geometry
//     of `shared-field-geometry.ts` (§4.2), so meaning decides geography and time, order and chance never do.
//
// Each Shared World is its own coordinate space (`QANDEEL_SHARED_FIELD_V1`, CW2-07 §21, §47): nothing aligns the geography
// of two Worlds, and a committed place is never moved. The answer is `unknown`, decoded strictly HERE, so no adapter can
// widen the shape or smuggle a coordinate in.
//
// No production provider is bound (§7): the factory returns a placer that REFUSES outside tests — never a hash, a random
// point, a chronological spiral or any other fake geography — until the binding conditions of §11 hold. The DeepSeek Flash
// adapter is `deepseek-shared-spatial-placer.ts`. Nothing here logs anything.

export const SHARED_SPATIAL_PLACEMENT_CONTRACT = 'SHARED_SPATIAL_PLACEMENT_V2' as const;
export const SHARED_FIELD_COORDINATE_SCHEME = 'QANDEEL_SHARED_FIELD_V1' as const;

/** The bounds of one placement request (§10 M4). */
export const SHARED_PLACEMENT_REGIONS_MAX = 40;
export const SHARED_PLACEMENT_MAP_MAX = 60;
export const SHARED_PLACEMENT_DATA_BYTES_MAX = 16 * 1024;
export const SHARED_PLACEMENT_ANCHORS_MAX = 3;

export interface SharedPlacementRegion { readonly region: string; readonly count: number; readonly examples: ReadonlyArray<string> }
export interface SharedPlacementMapPlace { readonly ref: string; readonly region: string; readonly meaning: string }
export interface SharedPlacementNewMeaning { readonly ref: string; readonly region: string; readonly meaning: string }

/** The placer's ENTIRE input: meanings of one World, addressed by request-local refs only. */
export interface SharedSpatialPlacementInput {
  readonly contract: typeof SHARED_SPATIAL_PLACEMENT_CONTRACT;
  readonly regions: ReadonlyArray<SharedPlacementRegion>;
  readonly map: ReadonlyArray<SharedPlacementMapPlace>;
  /** N1…Nn in ascending Unicode order of their meaning (§4.2). */
  readonly new: ReadonlyArray<SharedPlacementNewMeaning>;
}

export interface SharedPlacementAnchor { readonly to: string; readonly closeness: 1 | 2 | 3 }
/** The decoded answer: the anchors of every new meaning, by its N ref. */
export type SharedSpatialPlacement = ReadonlyMap<string, ReadonlyArray<SharedPlacementAnchor>>;

export interface SharedSpatialPlacer {
  place(input: SharedSpatialPlacementInput, signal: AbortSignal): Promise<unknown>;
}

export const SHARED_SPATIAL_PLACER = Symbol('SHARED_SPATIAL_PLACER');

export class SharedSpatialPlacerUnavailableError extends Error {
  constructor() {
    super('Shared spatial placement is unavailable.');
    this.name = 'SharedSpatialPlacerUnavailableError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));

/** Every target an anchor may name in this request: the P refs, the N refs, and `R:<region>` for every region given. */
export function sharedPlacementTargets(input: SharedSpatialPlacementInput): string[] {
  const regions = [...new Set([...input.regions.map((region) => region.region), ...input.new.map((meaning) => meaning.region)])];
  return [...input.map.map((place) => place.ref), ...input.new.map((meaning) => meaning.ref), ...regions.map((region) => `R:${region}`)];
}

/**
 * A placer's answer for exactly `input`, or null: `{ placements }`, every N ref exactly once, each with one to three
 * anchors to the given targets, closeness 1–3, no anchor to itself, no anchor repeated, and no cycle between new
 * meanings. Anything more — a coordinate, a score, a text — is malformed. A null refuses the pass's places.
 */
export function decodeSharedSpatialPlacement(value: unknown, input: SharedSpatialPlacementInput): SharedSpatialPlacement | null {
  if (!isRecord(value) || !exactKeys(value, ['placements']) || !Array.isArray(value.placements) || value.placements.length !== input.new.length) return null;
  const targets = new Set(sharedPlacementTargets(input));
  const news = new Set(input.new.map((meaning) => meaning.ref));
  const anchors = new Map<string, SharedPlacementAnchor[]>();
  for (const entry of value.placements) {
    if (!isRecord(entry) || !exactKeys(entry, ['new', 'anchors']) || typeof entry.new !== 'string' || !news.has(entry.new) || anchors.has(entry.new)
      || !Array.isArray(entry.anchors) || entry.anchors.length < 1 || entry.anchors.length > SHARED_PLACEMENT_ANCHORS_MAX) return null;
    const own: SharedPlacementAnchor[] = [];
    for (const anchor of entry.anchors) {
      if (!isRecord(anchor) || !exactKeys(anchor, ['to', 'closeness']) || typeof anchor.to !== 'string' || !targets.has(anchor.to)
        || anchor.to === entry.new || own.some((other) => other.to === anchor.to)
        || !(anchor.closeness === 1 || anchor.closeness === 2 || anchor.closeness === 3)) return null;
      own.push(Object.freeze({ to: anchor.to, closeness: anchor.closeness }));
    }
    anchors.set(entry.new, own);
  }
  // No cycle between new meanings: each must be placeable after the new meanings it is anchored to.
  const placed = new Set<string>();
  while (placed.size < news.size) {
    const next = [...news].find((ref) => !placed.has(ref) && (anchors.get(ref) ?? []).every((anchor) => !news.has(anchor.to) || placed.has(anchor.to)));
    if (next === undefined) return null;
    placed.add(next);
  }
  return new Map([...anchors].map(([ref, own]) => [ref, Object.freeze(own)]));
}

/**
 * The deterministic test placer (NODE_ENV=test only). It anchors each new meaning to the first map place of its own
 * region (closeness 1), or else to its own region (closeness 2). A pure function of its input; never a production fallback.
 */
export class FakeSharedSpatialPlacer implements SharedSpatialPlacer {
  async place(input: SharedSpatialPlacementInput): Promise<unknown> {
    return {
      placements: input.new.map((meaning) => {
        const near = input.map.find((place) => place.region === meaning.region);
        return { new: meaning.ref, anchors: [near ? { to: near.ref, closeness: 1 } : { to: `R:${meaning.region}`, closeness: 2 }] };
      }),
    };
  }
}

/** Until the binding conditions of S8A-04 CP2 §11 hold: refuse. Never fake geography, never a fallback. */
export class UnconfiguredSharedSpatialPlacer implements SharedSpatialPlacer {
  async place(): Promise<unknown> {
    throw new SharedSpatialPlacerUnavailableError();
  }
}

export function createConfiguredSharedSpatialPlacer(environment: NodeJS.ProcessEnv = process.env): SharedSpatialPlacer {
  if (environment.NODE_ENV === 'test') return new FakeSharedSpatialPlacer();
  // S8A-04 CP2 §7: the DeepSeek placer is bound only after the §11 conditions hold; binding it is CP2's last change.
  return new UnconfiguredSharedSpatialPlacer();
}
