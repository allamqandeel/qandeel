// SHARED-VIS-01 — the provider-neutral Shared Spatial Placer: where ONE Shared meaning sits in its OWN World's geography.
//
// The Shared counterpart of the S5-03B Public placer, with the same answer shape and the same exact-integer decoding
// (`../public-world/public-spatial-placer`): one point as decimal integer text within [-(2^62), 2^62 - 1] and the layout
// version that produced it — no neighbour, rank, distance or vector. Meaning determines geography: the input is the place's
// meaning, themes and semantic region, inside one exact Shared World — never a message, an author, a turn order, a time,
// a count or another World's truth.
//
// Each Shared World is its own coordinate space (`QANDEEL_SHARED_FIELD_V1`, CW2-07 §21, §47): a placement answers for one
// World only, and nothing aligns the geography of two Worlds. A committed place is never moved.
//
// No production provider is bound. Choosing it is Stage 8A. Until then the factory returns a placer that REFUSES — never a
// hash, a random point, a chronological spiral or any other fake geography. Nothing here logs anything.

import { createHash } from 'node:crypto';
import { decodePublicSpatialPlacement, type PublicSpatialPlacement } from '../public-world/public-spatial-placer';

export const SHARED_SPATIAL_PLACEMENT_CONTRACT = 'SHARED_SPATIAL_PLACEMENT_V1' as const;
export const SHARED_FIELD_COORDINATE_SCHEME = 'QANDEEL_SHARED_FIELD_V1' as const;

/** The placer's ENTIRE input: one meaning, inside one exact World. */
export interface SharedSpatialPlacementInput {
  readonly contract: typeof SHARED_SPATIAL_PLACEMENT_CONTRACT;
  /** The World whose geography this is (its own coordinate space). */
  readonly worldId: string;
  readonly meaning: string;
  readonly primaryThemes: ReadonlyArray<string>;
  readonly secondaryThemes: ReadonlyArray<string>;
  readonly semanticRegion: string;
}

export type SharedSpatialPlacement = PublicSpatialPlacement;

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

/** A placer's answer, or null: exactly `{ x, y, layoutVersion }` within the canonical bound (the S5-03B decoder). */
export const decodeSharedSpatialPlacement = (value: unknown): SharedSpatialPlacement | null => decodePublicSpatialPlacement(value);

/**
 * The deterministic test placer (NODE_ENV=test only). A pure function of the meaning and its World: meanings read under the
 * same region of the same World share a region centre, and their themes and meaning settle them within it. The World is in
 * every seed, so two Worlds never share a centre. It is never a production fallback.
 */
export class FakeSharedSpatialPlacer implements SharedSpatialPlacer {
  static readonly LAYOUT_VERSION = 'test.deterministic.v1';
  private static readonly REGION_SPAN = 2n ** 40n;
  private static readonly LOCAL_SPAN = 2n ** 30n;

  async place(input: SharedSpatialPlacementInput): Promise<unknown> {
    const point = (seed: string, span: bigint): [bigint, bigint] => {
      const digest = createHash('sha256').update(seed, 'utf8').digest();
      const value = (offset: number) => (digest.readBigUInt64BE(offset) % (2n * span)) - span;
      return [value(0), value(8)];
    };
    const world = input.worldId.toLowerCase();
    const [rx, ry] = point(`world\n${world}\nregion\n${input.semanticRegion}`, FakeSharedSpatialPlacer.REGION_SPAN);
    const themes = [...input.primaryThemes, ...input.secondaryThemes].map((theme) => theme.toLowerCase()).sort().join('\n');
    const [lx, ly] = point(`world\n${world}\nmeaning\n${themes}\n${input.meaning}`, FakeSharedSpatialPlacer.LOCAL_SPAN);
    return { x: (rx + lx).toString(), y: (ry + ly).toString(), layoutVersion: FakeSharedSpatialPlacer.LAYOUT_VERSION };
  }
}

/** Until Stage 8A binds a production provider: refuse. Never fake geography, never a fallback. */
export class UnconfiguredSharedSpatialPlacer implements SharedSpatialPlacer {
  async place(): Promise<unknown> {
    throw new SharedSpatialPlacerUnavailableError();
  }
}

export function createConfiguredSharedSpatialPlacer(environment: NodeJS.ProcessEnv = process.env): SharedSpatialPlacer {
  if (environment.NODE_ENV === 'test') return new FakeSharedSpatialPlacer();
  // Stage 8A owns the production provider. No provider is selected here, and no other placer stands in for one.
  return new UnconfiguredSharedSpatialPlacer();
}
