// T-03B2b1 - Canonical Home Placement Engine v1: the pinned golden vectors.
//
// These values are the permanent contract of QANDEEL_OSDAP_V1 under the frozen
// v1 constants. They are verified by the Jest suites in-process and by
// `tests/canonical-home-placement-engine-contract.test.mjs` in a SEPARATE Node
// process (Windows and Linux CI), which is the byte-for-byte replay law of
// task section 10. A different scheme, digest domain, constant, serialization,
// projection or tie rule changes them and therefore cannot be substituted
// silently.
//
// Nothing here is a Product value: ids, coordinates and the growth scenario
// are engineering fixtures.

import { denseWorldAround } from './home-placement-scenario';
import {
  CANONICAL_HOME_PLACEMENT_SCHEME,
  type CanonicalExistingHome,
  type CanonicalHomePlacement,
  type HomePlacementRequest,
} from './home-placement.types';

export interface CanonicalHomePlacementGoldenVector {
  readonly id: string;
  readonly description: string;
  readonly request: HomePlacementRequest;
  readonly expected: CanonicalHomePlacement;
}

export const GOLDEN_USER_WORLD_ID = '0f6a3c2e-9b1d-5c4a-8e7f-2d3b4a5c6d7e';

const home = (threadId: string, x: bigint, y: bigint): CanonicalExistingHome => Object.freeze({ threadId, x, y });
const placement = (
  x: bigint,
  y: bigint,
  attempt: number,
  baseX: bigint,
  baseY: bigint,
  worldFingerprint: string,
  originFingerprint: string,
): CanonicalHomePlacement => Object.freeze({ scheme: CANONICAL_HOME_PLACEMENT_SCHEME, x, y, attempt, baseX, baseY, worldFingerprint, originFingerprint });

/** sha256 of `NONE\n`: the origin fingerprint of every no-origin request. */
export const NONE_ORIGIN_FINGERPRINT = '51cfd463b6af8a57b3380487f986abf10f137073e9be453e44a7e9a5b4c0e72b';
/** sha256 of `QANDEEL_OSDAP_V1\n`: the world fingerprint of an empty world. */
export const EMPTY_WORLD_FINGERPRINT = 'd4fc7423a008557724175d0b3847085affc44eeb1fafa5c14fb78d888ec7784a';

/** GV-01: the first Thread of a world, no origin - placed from the datum, NOT at the datum. */
export const GV01_HOME = home('thread-gv01', 534_265n, 944_722n);
/** GV-02: the second no-origin Thread adapts to GV-01; its dy is exactly the projected inner boundary. */
export const GV02_HOME = home('thread-gv02', -17_692n, 500_000n);
/** GV-03: RESOLVED origin = GV-01. */
export const GV03_HOME = home('thread-gv03', 971_542n, -36_077n);
/** GV-04: MULTIPLE origin = { GV-01, GV-02 }. */
export const GV04_HOME = home('thread-gv04', 1_003_065n, 546_434n);
/** GV-06: two negative-quadrant Homes whose barycenter exercises floor division toward negative infinity. */
export const GV06_LEFT = home('thread-gv06-left', -7_000_001n, 3n);
export const GV06_RIGHT = home('thread-gv06-right', 2n, -6_000_004n);
/** GV-07: the middle Home of a dense 7x7 lattice; every shell-1 candidate around it is blocked. */
export const GV07_CENTER = home('thread-dense', 10_000_000n, 10_000_000n);

export const CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS: readonly CanonicalHomePlacementGoldenVector[] = Object.freeze([
  {
    id: 'GV-01',
    description: 'first Thread, origin NONE, empty world: search from the datum (0,0) without placing at it',
    request: { userWorldId: GOLDEN_USER_WORLD_ID, newThreadId: 'thread-gv01', origin: { state: 'NONE' }, existingHomes: [] },
    expected: placement(534_265n, 944_722n, 0, 0n, 0n, EMPTY_WORLD_FINGERPRINT, NONE_ORIGIN_FINGERPRINT),
  },
  {
    id: 'GV-02',
    description: 'second Thread, origin NONE: the world fingerprint now covers GV-01, so the candidate sequence differs',
    request: { userWorldId: GOLDEN_USER_WORLD_ID, newThreadId: 'thread-gv02', origin: { state: 'NONE' }, existingHomes: [GV01_HOME] },
    expected: placement(-17_692n, 500_000n, 0, 0n, 0n, 'b8ab1ed215d1ce8f6513a27edcecebddc17c035f4a8c763f1fb5ae12dab94ab4', NONE_ORIGIN_FINGERPRINT),
  },
  {
    id: 'GV-03',
    description: 'RESOLVED origin GV-01: the base is that Home; the result is distinct, not subordinate, in no required direction',
    request: {
      userWorldId: GOLDEN_USER_WORLD_ID,
      newThreadId: 'thread-gv03',
      origin: { state: 'RESOLVED', homes: [GV01_HOME] },
      existingHomes: [GV02_HOME, GV01_HOME],
    },
    expected: placement(
      971_542n,
      -36_077n,
      0,
      GV01_HOME.x,
      GV01_HOME.y,
      'd48be4f9dd1a713ef907842ccfdd1089dc9d90f8f1ac1386d08f56fbe52eea6e',
      '73476a608ca28fb1de88e607550191e8b00348bd704bcdbebdd43bc52234a0d0',
    ),
  },
  {
    id: 'GV-04',
    description: 'MULTIPLE origin { GV-01, GV-02 } given in reverse order: the base is the symmetric integer barycenter',
    request: {
      userWorldId: GOLDEN_USER_WORLD_ID,
      newThreadId: 'thread-gv04',
      origin: { state: 'MULTIPLE', homes: [GV02_HOME, GV01_HOME] },
      existingHomes: [GV01_HOME, GV02_HOME, GV03_HOME],
    },
    expected: placement(
      1_003_065n,
      546_434n,
      0,
      258_286n,
      722_361n,
      '85e5a1cd5ae02e8561d4bfaeb731350b86f0463e24cce79f98341069c3802d00',
      '60a8fedd57b29d2257abb441d71324504ed4134ceaf0c7222932624a867cf89e',
    ),
  },
  {
    id: 'GV-05',
    description: 'AMBIGUOUS origin { GV-01, GV-02, GV-03 }: the same symmetric barycenter, no candidate marked true',
    request: {
      userWorldId: GOLDEN_USER_WORLD_ID,
      newThreadId: 'thread-gv05',
      origin: { state: 'AMBIGUOUS', homes: [GV03_HOME, GV01_HOME, GV02_HOME] },
      existingHomes: [GV04_HOME, GV03_HOME, GV02_HOME, GV01_HOME],
    },
    expected: placement(
      122_652n,
      1_288_006n,
      0,
      496_038n,
      469_548n,
      'dfb5b7edd882aa283ea508a014bb808e4090547043d72942fd159ac4dd221c39',
      '106304a74372f8be2e457c68edfd12315069e633541f88ad8773b5950fd4ea45',
    ),
  },
  {
    id: 'GV-06',
    description: 'MULTIPLE origin with a negative-quadrant barycenter: floor division rounds toward negative infinity',
    request: {
      userWorldId: GOLDEN_USER_WORLD_ID,
      newThreadId: 'thread-gv06',
      origin: { state: 'MULTIPLE', homes: [GV06_LEFT, GV06_RIGHT] },
      existingHomes: [GV06_RIGHT, GV06_LEFT],
    },
    expected: placement(
      -2_925_237n,
      -2_344_050n,
      0,
      -3_500_000n,
      -3_000_001n,
      '84ef894a741a419e4113433f22255e4427a5f88c0aefe3387e095b7b43d4c2ef',
      'e0bad8f1b17881df07b53cedfe7468844953292b18e13cff6f4445380cb3db52',
    ),
  },
  {
    id: 'GV-07',
    description: 'RESOLVED origin inside a dense lattice: every shell-1 candidate is blocked, the Home lands in shell 2 (attempt 34), no lattice Home moves',
    request: {
      userWorldId: GOLDEN_USER_WORLD_ID,
      newThreadId: 'thread-gv07',
      origin: { state: 'RESOLVED', homes: [GV07_CENTER] },
      existingHomes: denseWorldAround(GV07_CENTER),
    },
    expected: placement(
      8_240_675n,
      9_920_020n,
      34,
      GV07_CENTER.x,
      GV07_CENTER.y,
      '80ae6e4841d5e8c9e194d381b47baa6f71619a20e45ce092d507848b999becdb',
      'fac1eda456241d3fca0da7942002d95f7822b23061592488d445003eb59fcf0d',
    ),
  },
]);

export interface StressGolden {
  readonly threads: number;
  /** `fingerprintWorld` of the final committed world of `runStressScenario(threads)`. */
  readonly worldFingerprint: string;
  readonly maxAttempt: number;
}

/** Pinned outcomes of the deterministic append-growth scenario at the three proof scales. */
export const CANONICAL_HOME_PLACEMENT_STRESS_GOLDENS: readonly StressGolden[] = Object.freeze([
  { threads: 100, worldFingerprint: '58fc72e452057ab0ba2543f17b9d1db28abde94d5ebc6109644287f370635391', maxAttempt: 42 },
  { threads: 1_000, worldFingerprint: 'dcba31edacfa933c442a91a043b55f12999a57a4c6707395c8a124aa2c0ebbce', maxAttempt: 184 },
  { threads: 10_000, worldFingerprint: '348c972c9c024d2c5cff2e5a194e42f77b3d6a4c11611ccf6ca07665ad0b8937', maxAttempt: 603 },
]);
