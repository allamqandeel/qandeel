// S5-03B — the provider-neutral Public Spatial Placer: where ONE reviewed Public meaning sits in the ONE Public semantic
// field.
//
// Meaning determines geography (CW2-04 §14, §15). The placer's whole input is the reviewed S5-03A interpretation of one
// exact Experience Version, as the database's one meaning-only reader served it: the meaning, the main and other themes,
// the semantic region (the reviewed lens key) and the exact revision identity. No package text, no Personal or Shared
// truth, no memory or human model, no Matching, no account, no Public alias, no popularity, views, discussion, vitality,
// age or publication instant: the input type has no room for any of them, and the API never holds them to give.
//
// Its answer is one point in the Public field's own canonical coordinate space (`QANDEEL_PUBLIC_FIELD_V1`: exact signed
// integers within [-(2^62), 2^62 - 1], as decimal text so no coordinate ever passes
// through a binary float) and the layout version that produced it. No relation edge, no neighbour list, no rank, no
// distance and no vector: spatial proximity itself is the only similarity the field shows, and explicit relations are
// S5-03C's. Whatever an implementation answers is decoded strictly HERE, so no adapter can widen the shape.
//
// No production provider is bound. Choosing it is Stage 8A (QANDEEL AI Brain / Production LLM Runtime). Until then the
// factory returns a placer that REFUSES — never a hash, a random point, an alphabetical slot, a publication-time spiral or
// any other fake geography, never a fallback provider — so outside tests no Experience is placed and nothing is spent.
// A later provider never moves a committed place: the database keeps the first placement of a revision forever.
// Nothing here logs anything.

import { createHash } from 'node:crypto';

export const PUBLIC_SPATIAL_PLACEMENT_CONTRACT = 'PUBLIC_SPATIAL_PLACEMENT_V1' as const;

/** The placer's ENTIRE input: one reviewed public meaning, nothing else. */
export interface PublicSpatialPlacementInput {
  readonly contract: typeof PUBLIC_SPATIAL_PLACEMENT_CONTRACT;
  /** The exact reviewed S5-03A revision this place will be bound to. */
  readonly semanticRevision: string;
  readonly meaning: string;
  readonly primaryThemes: ReadonlyArray<string>;
  readonly secondaryThemes: ReadonlyArray<string>;
  /** The reviewed lens key: the semantic region the meaning is read under. */
  readonly semanticRegion: string;
}

/** One canonical world point, as exact integer text, and the layout version that produced it. */
export interface PublicSpatialPlacement {
  readonly x: string;
  readonly y: string;
  readonly layoutVersion: string;
}

export interface PublicSpatialPlacer {
  place(input: PublicSpatialPlacementInput, signal: AbortSignal): Promise<unknown>;
}

export const PUBLIC_SPATIAL_PLACER = Symbol('PUBLIC_SPATIAL_PLACER');

export class PublicSpatialPlacerUnavailableError extends Error {
  constructor() {
    super('Public spatial placement is unavailable.');
    this.name = 'PublicSpatialPlacerUnavailableError';
  }
}

/**
 * The Public field's coordinate space and its exact bound, exactly the database's. The bound is the same exact-integer
 * bound the Map's world math uses (so the mobile field projects it exactly); the space is the Public World's own, never
 * the Personal World's Home scheme.
 */
export const PUBLIC_FIELD_COORDINATE_SCHEME = 'QANDEEL_PUBLIC_FIELD_V1' as const;
export const PUBLIC_FIELD_MIN_COORD = -(2n ** 62n);
export const PUBLIC_FIELD_MAX_COORD = 2n ** 62n - 1n;
const COORDINATE = /^-?(0|[1-9][0-9]{0,18})$/u;
const LAYOUT_VERSION = /^[a-z0-9][a-z0-9_.-]{0,63}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));

/** Exact integer text inside the canonical bound, or false. Never parsed through a float. */
export function isCanonicalCoordinateText(value: unknown): value is string {
  if (typeof value !== 'string' || !COORDINATE.test(value) || value === '-0') return false;
  const exact = BigInt(value);
  return exact >= PUBLIC_FIELD_MIN_COORD && exact <= PUBLIC_FIELD_MAX_COORD;
}

/** A placer's answer, or null. Exactly { x, y, layoutVersion }; anything more — a neighbour, a rank, an edge — is malformed. */
export function decodePublicSpatialPlacement(value: unknown): PublicSpatialPlacement | null {
  if (!isRecord(value) || !exactKeys(value, ['x', 'y', 'layoutVersion'])) return null;
  if (!isCanonicalCoordinateText(value.x) || !isCanonicalCoordinateText(value.y)
    || typeof value.layoutVersion !== 'string' || !LAYOUT_VERSION.test(value.layoutVersion)) return null;
  return Object.freeze({ x: value.x, y: value.y, layoutVersion: value.layoutVersion });
}

// ------------------------------------------------------------------------------------------------ implementations

/**
 * The deterministic test placer (NODE_ENV=test only). A pure function of the meaning it is given: Experiences read under
 * the same semantic region share a region centre, and their themes and meaning settle them within it — so the field a
 * test draws is shaped by meaning alone. It is not a semantic model, it is never a production fallback, and it never
 * places an Experience a real person sees.
 */
export class FakePublicSpatialPlacer implements PublicSpatialPlacer {
  static readonly LAYOUT_VERSION = 'test.deterministic.v1';
  private static readonly REGION_SPAN = 2n ** 40n;
  private static readonly LOCAL_SPAN = 2n ** 30n;

  async place(input: PublicSpatialPlacementInput): Promise<unknown> {
    const point = (seed: string, span: bigint): [bigint, bigint] => {
      const digest = createHash('sha256').update(seed, 'utf8').digest();
      const value = (offset: number) => (digest.readBigUInt64BE(offset) % (2n * span)) - span;
      return [value(0), value(8)];
    };
    const [rx, ry] = point(`region\n${input.semanticRegion}`, FakePublicSpatialPlacer.REGION_SPAN);
    const themes = [...input.primaryThemes, ...input.secondaryThemes].map((theme) => theme.toLowerCase()).sort().join('\n');
    const [lx, ly] = point(`meaning\n${themes}\n${input.meaning}`, FakePublicSpatialPlacer.LOCAL_SPAN);
    return { x: (rx + lx).toString(), y: (ry + ly).toString(), layoutVersion: FakePublicSpatialPlacer.LAYOUT_VERSION };
  }
}

/** Until Stage 8A binds a production provider: refuse. Never fake geography, never a fallback. */
export class UnconfiguredPublicSpatialPlacer implements PublicSpatialPlacer {
  async place(): Promise<unknown> {
    throw new PublicSpatialPlacerUnavailableError();
  }
}

export function createConfiguredPublicSpatialPlacer(environment: NodeJS.ProcessEnv = process.env): PublicSpatialPlacer {
  if (environment.NODE_ENV === 'test') return new FakePublicSpatialPlacer();
  // Stage 8A owns the production provider. No provider is selected here, and no other placer stands in for one.
  return new UnconfiguredPublicSpatialPlacer();
}
