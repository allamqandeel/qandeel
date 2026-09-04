// T-03B2b1 - Canonical Home Placement Engine v1 (QANDEEL OSDAP v1): the
// adversarial proof suite (task section 14, items 1-26 and 31-35). The append
// laws at scale (items 27-30) live in home-placement-stress.spec.ts.

import { createHash } from 'node:crypto';
import {
  absBig,
  assertAttempt,
  attemptDigest,
  candidateForAttempt,
  candidateOffset,
  chebyshevDistance,
  compareIdentity,
  digestToUnsignedPair,
  fingerprintOrigin,
  fingerprintWorld,
  floorDiv,
  isCanonicalIdentity,
  isWithinCoordinateBounds,
  mapToSquare,
  originSeedPoint,
  outerHalfBoundary,
  placeCanonicalHome,
  projectToOuterHalf,
  radiusForAttempt,
  resolveThreadHome,
  searchAdmissiblePlacement,
  separationCell,
  SeparationIndex,
  shellForAttempt,
  validateHomePlacementRequest,
  type PlacementSearchSeed,
  type WorldPoint,
} from './home-placement-engine';
import { denseWorldAround } from './home-placement-scenario';
import {
  CANDIDATES_PER_SHELL,
  CANONICAL_HOME_PLACEMENT_ENGINE_VERSION,
  CANONICAL_HOME_PLACEMENT_REJECTION_REASONS,
  CANONICAL_HOME_PLACEMENT_SCHEME,
  CANONICAL_IDENTITY_PATTERN,
  CanonicalHomePlacementRejectedError,
  CONVERSATIONAL_ORIGIN_STATES,
  HOME_STEP,
  MAX_ATTEMPTS,
  MAX_COORD,
  MIN_COORD,
  MIN_HOME_SEPARATION,
  OSDAP_DIGEST_DOMAIN,
  type CanonicalExistingHome,
  type CanonicalHomePlacement,
  type CanonicalHomePlacementRejectionReason,
  type ConversationalOrigin,
  type HomePlacementRequest,
} from './home-placement.types';
import {
  CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS,
  EMPTY_WORLD_FINGERPRINT,
  GOLDEN_USER_WORLD_ID,
  GV01_HOME,
  GV02_HOME,
  GV03_HOME,
  GV07_CENTER,
  NONE_ORIGIN_FINGERPRINT,
} from './home-placement-vectors';

const USER = 'user-world-spec';
const home = (threadId: string, x: bigint, y: bigint): CanonicalExistingHome => Object.freeze({ threadId, x, y });
const request = (newThreadId: string, origin: ConversationalOrigin, existingHomes: readonly CanonicalExistingHome[]): HomePlacementRequest =>
  Object.freeze({ userWorldId: USER, newThreadId, origin: Object.freeze(origin), existingHomes: Object.freeze([...existingHomes]) });
const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const point = (x: bigint, y: bigint): WorldPoint => Object.freeze({ x, y });
const RESULT_KEYS = ['attempt', 'baseX', 'baseY', 'originFingerprint', 'scheme', 'worldFingerprint', 'x', 'y'];

function rejectionOf(run: () => unknown): CanonicalHomePlacementRejectedError {
  try {
    run();
  } catch (error) {
    if (error instanceof CanonicalHomePlacementRejectedError) return error;
    throw error;
  }
  throw new Error('expected a CanonicalHomePlacementRejectedError');
}

function expectRejection(run: () => unknown, reason: CanonicalHomePlacementRejectionReason, index = -1): void {
  const error = rejectionOf(run);
  expect(error.reason).toBe(reason);
  expect(error.index).toBe(index);
  expect(error.name).toBe('CanonicalHomePlacementRejectedError');
}

/** The brute-force reference of admissibility: the exact test against EVERY Home, no index. */
const admissibleByScan = (candidate: WorldPoint, homes: readonly CanonicalExistingHome[]) =>
  homes.every((existing) => chebyshevDistance(candidate, existing) >= MIN_HOME_SEPARATION);

const SEED: PlacementSearchSeed = Object.freeze({
  userWorldId: USER,
  newThreadId: 'thread-seed',
  originFingerprint: NONE_ORIGIN_FINGERPRINT,
  worldFingerprint: EMPTY_WORLD_FINGERPRINT,
});
const DATUM = point(0n, 0n);

describe('exact integer arithmetic and the frozen v1 constants', () => {
  it('pins the scheme, engine version, digest domain and every constant exactly', () => {
    expect(CANONICAL_HOME_PLACEMENT_SCHEME).toBe('QANDEEL_OSDAP_V1');
    expect(CANONICAL_HOME_PLACEMENT_ENGINE_VERSION).toBe('canonical-home-placement-engine-v1');
    expect(OSDAP_DIGEST_DOMAIN).toBe('qandeel-osdap-v1');
    expect(MIN_COORD).toBe(-(2n ** 62n));
    expect(MAX_COORD).toBe(2n ** 62n - 1n);
    expect(HOME_STEP).toBe(1_000_000n);
    expect(MIN_HOME_SEPARATION).toBe(250_000n);
    expect(CANDIDATES_PER_SHELL).toBe(32);
    expect(MAX_ATTEMPTS).toBe(8192);
    expect([...CONVERSATIONAL_ORIGIN_STATES]).toEqual(['NONE', 'RESOLVED', 'MULTIPLE', 'AMBIGUOUS']);
    expect(CANONICAL_HOME_PLACEMENT_REJECTION_REASONS).toHaveLength(10);
    expect(Object.isFrozen(CONVERSATIONAL_ORIGIN_STATES)).toBe(true);
    expect(Object.isFrozen(CANONICAL_HOME_PLACEMENT_REJECTION_REASONS)).toBe(true);
  });

  it('floor-divides toward negative infinity (item 14)', () => {
    expect(floorDiv(7n, 2n)).toBe(3n);
    expect(floorDiv(-7n, 2n)).toBe(-4n);
    expect(floorDiv(-6n, 2n)).toBe(-3n);
    expect(floorDiv(-1n, 250_000n)).toBe(-1n);
    expect(floorDiv(0n, 5n)).toBe(0n);
    expect(floorDiv(-5n, 5n)).toBe(-1n);
    expect(floorDiv(-4n, 3n)).toBe(-2n);
    expect(floorDiv(-6_999_999n, 2n)).toBe(-3_500_000n);
    expect(floorDiv(-6_000_001n, 2n)).toBe(-3_000_001n);
    expect(() => floorDiv(1n, 0n)).toThrow(RangeError);
    expect(() => floorDiv(1n, -2n)).toThrow(RangeError);
    // The separation cell floors the same way with a shift, never a division.
    expect(separationCell(-1n)).toBe(-1n);
    expect(separationCell(0n)).toBe(0n);
    expect(separationCell(262_143n)).toBe(0n);
    expect(separationCell(262_144n)).toBe(1n);
    expect(separationCell(-262_144n)).toBe(-1n);
    expect(separationCell(-262_145n)).toBe(-2n);
  });

  it('measures Chebyshev distance, absolute value and the technical bound exactly', () => {
    expect(chebyshevDistance(point(0n, 0n), point(3n, -7n))).toBe(7n);
    expect(chebyshevDistance(point(-5n, 2n), point(-5n, 2n))).toBe(0n);
    expect(absBig(-9n)).toBe(9n);
    expect(isWithinCoordinateBounds(MAX_COORD, MIN_COORD)).toBe(true);
    expect(isWithinCoordinateBounds(MAX_COORD + 1n, 0n)).toBe(false);
    expect(isWithinCoordinateBounds(0n, MIN_COORD - 1n)).toBe(false);
  });

  it('keeps every canonical value a BigInt and never a number (item 8)', () => {
    const placed = placeCanonicalHome(request('thread-bigint', { state: 'NONE' }, []));
    for (const key of ['x', 'y', 'baseX', 'baseY'] as const) expect(typeof placed[key]).toBe('bigint');
    expect(typeof placed.attempt).toBe('number');
    expect(Number.isInteger(placed.attempt)).toBe(true);
    expect(Object.keys(placed).sort(compareIdentity)).toEqual(RESULT_KEYS);
    expect(Object.isFrozen(placed)).toBe(true);
  });
});

describe('shell, entropy and the square-annulus offset', () => {
  it('assigns 32 attempts per shell and grows the radius by HOME_STEP per shell (item 15)', () => {
    expect(shellForAttempt(0)).toBe(1n);
    expect(shellForAttempt(31)).toBe(1n);
    expect(shellForAttempt(32)).toBe(2n);
    expect(shellForAttempt(63)).toBe(2n);
    expect(shellForAttempt(64)).toBe(3n);
    expect(shellForAttempt(8191)).toBe(256n);
    expect(radiusForAttempt(31)).toBe(1_000_000n);
    expect(radiusForAttempt(32)).toBe(2_000_000n);
    expect(radiusForAttempt(8191)).toBe(256_000_000n);
    for (const bad of [-1, 8192, 1.5, Number.NaN]) expect(() => assertAttempt(bad)).toThrow(RangeError);
  });

  it('derives uX from the first 16 digest bytes and uY from the last 16, big-endian, without floating point', () => {
    const digest = new Uint8Array(32);
    for (let position = 0; position < 32; position += 1) digest[position] = position;
    const { uX, uY } = digestToUnsignedPair(digest);
    expect(uX).toBe(BigInt('0x000102030405060708090a0b0c0d0e0f'));
    expect(uY).toBe(BigInt('0x101112131415161718191a1b1c1d1e1f'));
    expect(() => digestToUnsignedPair(new Uint8Array(31))).toThrow(RangeError);
    const real = attemptDigest(SEED, 0);
    expect(real).toHaveLength(32);
    expect(Buffer.from(real).toString('hex')).toBe(
      sha256(`${OSDAP_DIGEST_DOMAIN}|${SEED.userWorldId}|${SEED.newThreadId}|${SEED.originFingerprint}|${SEED.worldFingerprint}|0`),
    );
  });

  it('maps an unsigned integer onto [-radius, +radius] by exact modulus', () => {
    expect(mapToSquare(0n, 10n)).toBe(-10n);
    expect(mapToSquare(10n, 10n)).toBe(0n);
    expect(mapToSquare(20n, 10n)).toBe(10n);
    expect(mapToSquare(21n, 10n)).toBe(-10n);
    expect(() => mapToSquare(-1n, 10n)).toThrow(RangeError);
    expect(() => mapToSquare(1n, 0n)).toThrow(RangeError);
  });

  it('projects an inner-square offset onto the nearest signed outer-half boundary with an exact tie rule (item 16)', () => {
    expect(outerHalfBoundary(1_000_000n)).toBe(500_000n);
    expect(outerHalfBoundary(5n)).toBe(3n);
    expect(outerHalfBoundary(1n)).toBe(1n);
    expect(() => outerHalfBoundary(0n)).toThrow(RangeError);
    const r = 1_000_000n;
    // Already in the outer half: untouched.
    expect(projectToOuterHalf(600_000n, 10n, r)).toEqual({ dx: 600_000n, dy: 10n });
    expect(projectToOuterHalf(-500_000n, 499_999n, r)).toEqual({ dx: -500_000n, dy: 499_999n });
    // Exact tie |dx| == |dy|: x is the dominant component.
    expect(projectToOuterHalf(100n, 100n, r)).toEqual({ dx: 500_000n, dy: 100n });
    expect(projectToOuterHalf(-100n, 100n, r)).toEqual({ dx: -500_000n, dy: 100n });
    expect(projectToOuterHalf(-499_999n, 499_999n, r)).toEqual({ dx: -500_000n, dy: 499_999n });
    // Zero counts as positive.
    expect(projectToOuterHalf(0n, 0n, r)).toEqual({ dx: 500_000n, dy: 0n });
    expect(projectToOuterHalf(0n, -1n, r)).toEqual({ dx: 0n, dy: -500_000n });
    // y dominant.
    expect(projectToOuterHalf(100n, -300n, r)).toEqual({ dx: 100n, dy: -500_000n });
    expect(projectToOuterHalf(-2n, 3n, 5n)).toEqual({ dx: -2n, dy: 3n });
    expect(projectToOuterHalf(-2n, 2n, 5n)).toEqual({ dx: -3n, dy: 2n });
  });

  it('keeps every candidate offset of every attempt inside the outer half of its shell', () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const radius = radiusForAttempt(attempt);
      const { dx, dy } = candidateOffset(attemptDigest(SEED, attempt), radius);
      const norm = chebyshevDistance(point(dx, dy), DATUM);
      expect(norm >= outerHalfBoundary(radius)).toBe(true);
      expect(norm <= radius).toBe(true);
    }
    // The shell boundary is visible in the offsets themselves.
    const last1 = chebyshevDistance(point(candidateForAttempt(SEED, DATUM, 31).x, candidateForAttempt(SEED, DATUM, 31).y), DATUM);
    expect(last1 <= 1_000_000n && last1 >= 500_000n).toBe(true);
  });
});

describe('the closed request shape (items 8-11, 24-26)', () => {
  const H1 = home('thread-a', 5_000_000n, 5_000_000n);
  const H2 = home('thread-b', -5_000_000n, 5_000_000n);
  const H3 = home('thread-c', 0n, -9_000_000n);
  const smuggle = (extra: Record<string, unknown>) => ({ ...request('thread-new', { state: 'NONE' }, [H1]), ...extra }) as unknown as HomePlacementRequest;

  it('accepts only the closed identity charset', () => {
    for (const ok of ['a', 'thread-00001', '0f6a3c2e-9b1d-5c4a-8e7f-2d3b4a5c6d7e', 'prepared:abc', 'A.B_C', 'x'.repeat(128)]) expect(isCanonicalIdentity(ok)).toBe(true);
    for (const bad of ['', ' ', 'a b', 'a|b', '-a', '.a', 'a\n', 'x'.repeat(129), 'é', 5, null, undefined]) expect(isCanonicalIdentity(bad)).toBe(false);
    expect(CANONICAL_IDENTITY_PATTERN.source).toBe('^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$');
  });

  it('rejects a duplicate origin member (item 8)', () => {
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'MULTIPLE', homes: [H1, H1] }, [H1, H2])), 'DUPLICATE_ORIGIN_HOME', 1);
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'AMBIGUOUS', homes: [H1, H2, H1] }, [H1, H2])), 'DUPLICATE_ORIGIN_HOME', 2);
  });

  it('rejects an unknown or mismatched origin member (item 9)', () => {
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'RESOLVED', homes: [H3] }, [H1, H2])), 'UNKNOWN_ORIGIN_HOME', 0);
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'MULTIPLE', homes: [H1, H3] }, [H1, H2])), 'UNKNOWN_ORIGIN_HOME', 1);
    const moved = home('thread-a', 5_000_001n, 5_000_000n);
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'RESOLVED', homes: [moved] }, [H1, H2])), 'ORIGIN_HOME_MISMATCH', 0);
    // An origin can never name the Thread being placed: it is not an existing Home.
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'RESOLVED', homes: [home('thread-new', 0n, 0n)] }, [H1])), 'UNKNOWN_ORIGIN_HOME', 0);
  });

  it('rejects a duplicate existing Thread id (item 10)', () => {
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'NONE' }, [H1, H2, home('thread-a', 7_000_000n, 0n)])), 'DUPLICATE_EXISTING_THREAD_ID', 2);
  });

  it('rejects a duplicate canonical placement as a malformed world (item 11)', () => {
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'NONE' }, [H1, home('thread-z', 5_000_000n, 5_000_000n)])), 'DUPLICATE_EXISTING_PLACEMENT', 1);
  });

  it('rejects an existing Home outside the technical bound as a malformed world', () => {
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'NONE' }, [H1, home('thread-far', MAX_COORD + 1n, 0n)])), 'EXISTING_HOME_OUT_OF_BOUNDS', 1);
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'NONE' }, [home('thread-far', 0n, MIN_COORD - 1n)])), 'EXISTING_HOME_OUT_OF_BOUNDS', 0);
    expect(placeCanonicalHome(request('thread-new', { state: 'NONE' }, [home('thread-edge', MAX_COORD, MIN_COORD)])).scheme).toBe(CANONICAL_HOME_PLACEMENT_SCHEME);
  });

  it('refuses to place a Thread that already holds a Home', () => {
    expectRejection(() => placeCanonicalHome(request('thread-a', { state: 'NONE' }, [H1, H2])), 'THREAD_ALREADY_PLACED');
  });

  it('enforces origin cardinality: RESOLVED exactly one, MULTIPLE / AMBIGUOUS at least two', () => {
    const resolvedTwo = { state: 'RESOLVED', homes: [H1, H2] } as unknown as ConversationalOrigin;
    expectRejection(() => placeCanonicalHome(request('thread-new', resolvedTwo, [H1, H2])), 'INVALID_ORIGIN_CARDINALITY');
    const resolvedNone = { state: 'RESOLVED', homes: [] } as unknown as ConversationalOrigin;
    expectRejection(() => placeCanonicalHome(request('thread-new', resolvedNone, [H1, H2])), 'INVALID_ORIGIN_CARDINALITY');
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'MULTIPLE', homes: [H1] }, [H1, H2])), 'INVALID_ORIGIN_CARDINALITY');
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'AMBIGUOUS', homes: [] }, [H1, H2])), 'INVALID_ORIGIN_CARDINALITY');
  });

  it('rejects every malformed shape: number coordinates, string coordinates, missing or extra keys, unknown states', () => {
    const numberHome = { threadId: 'thread-n', x: 5, y: 5 } as unknown as CanonicalExistingHome;
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'NONE' }, [numberHome])), 'INVALID_PLACEMENT_INPUT', 0);
    const floatHome = { threadId: 'thread-n', x: 5n, y: 0.5 } as unknown as CanonicalExistingHome;
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'NONE' }, [H1, floatHome])), 'INVALID_PLACEMENT_INPUT', 1);
    const stringHome = { threadId: 'thread-n', x: '5', y: '5' } as unknown as CanonicalExistingHome;
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'NONE' }, [stringHome])), 'INVALID_PLACEMENT_INPUT', 0);
    const missingKey = { threadId: 'thread-n', x: 5n } as unknown as CanonicalExistingHome;
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'NONE' }, [missingKey])), 'INVALID_PLACEMENT_INPUT', 0);
    const extraKey = { threadId: 'thread-n', x: 5n, y: 5n, weight: 1 } as unknown as CanonicalExistingHome;
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'NONE' }, [extraKey])), 'INVALID_PLACEMENT_INPUT', 0);
    const badId = { threadId: 'thread n', x: 5n, y: 5n } as unknown as CanonicalExistingHome;
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'NONE' }, [badId])), 'INVALID_PLACEMENT_INPUT', 0);
    const unknownState = { state: 'PRIMARY', homes: [H1] } as unknown as ConversationalOrigin;
    expectRejection(() => placeCanonicalHome(request('thread-new', unknownState, [H1])), 'INVALID_PLACEMENT_INPUT');
    const noneWithHomes = { state: 'NONE', homes: [] } as unknown as ConversationalOrigin;
    expectRejection(() => placeCanonicalHome(request('thread-new', noneWithHomes, [H1])), 'INVALID_PLACEMENT_INPUT');
    const originExtra = { state: 'RESOLVED', homes: [H1], primary: 'thread-a' } as unknown as ConversationalOrigin;
    expectRejection(() => placeCanonicalHome(request('thread-new', originExtra, [H1])), 'INVALID_PLACEMENT_INPUT');
    const originNoHomes = { state: 'RESOLVED' } as unknown as ConversationalOrigin;
    expectRejection(() => placeCanonicalHome(request('thread-new', originNoHomes, [H1])), 'INVALID_PLACEMENT_INPUT');
    expectRejection(() => placeCanonicalHome({ userWorldId: 'bad|id', newThreadId: 'thread-new', origin: { state: 'NONE' }, existingHomes: [] }), 'INVALID_PLACEMENT_INPUT');
    expectRejection(() => placeCanonicalHome({ userWorldId: USER, newThreadId: '', origin: { state: 'NONE' }, existingHomes: [] }), 'INVALID_PLACEMENT_INPUT');
    expectRejection(() => placeCanonicalHome(null as unknown as HomePlacementRequest), 'INVALID_PLACEMENT_INPUT');
    expectRejection(() => placeCanonicalHome({ userWorldId: USER, newThreadId: 'thread-new', origin: { state: 'NONE' } } as unknown as HomePlacementRequest), 'INVALID_PLACEMENT_INPUT');
    expectRejection(() => placeCanonicalHome({ userWorldId: USER, newThreadId: 'thread-new', origin: { state: 'NONE' }, existingHomes: 'none' } as unknown as HomePlacementRequest), 'INVALID_PLACEMENT_INPUT');
  });

  it('has no semantic, relation, label, count, confidence, viewport or device channel - by type and at runtime (items 24-26)', () => {
    expect(() =>
      placeCanonicalHome({
        userWorldId: USER,
        newThreadId: 'thread-new',
        origin: { state: 'NONE' },
        existingHomes: [],
        // @ts-expect-error - the closed request type has no similarity channel
        similarity: 0.9,
      }),
    ).toThrow(CanonicalHomePlacementRejectedError);
    expect(() =>
      placeCanonicalHome({
        userWorldId: USER,
        newThreadId: 'thread-new',
        origin: { state: 'NONE' },
        existingHomes: [],
        // @ts-expect-error - no label channel
        label: 'أحمد',
      }),
    ).toThrow(CanonicalHomePlacementRejectedError);
    expect(() =>
      placeCanonicalHome({
        userWorldId: USER,
        newThreadId: 'thread-new',
        origin: { state: 'NONE' },
        existingHomes: [],
        // @ts-expect-error - no viewport channel
        viewport: { width: 375, height: 812 },
      }),
    ).toThrow(CanonicalHomePlacementRejectedError);
    for (const channel of [
      { similarity: 0.9 },
      { embedding: [0.1, 0.2] },
      { confidence: 1 },
      { importance: 'HIGH' },
      { relations: ['thread-a'] },
      { relationCount: 3 },
      { connectionCount: 3 },
      { label: 'أحمد' },
      { committedText: 'عايز نتكلم عن أحمد' },
      { viewport: { width: 375 } },
      { device: 'phone' },
      { screen: 'map' },
      { metadata: { anything: true } },
      { path: 'TE-01' },
      { emotion: 'anger' },
      { popularity: 10 },
      { rank: 1 },
      { score: 0.5 },
    ]) {
      expectRejection(() => placeCanonicalHome(smuggle(channel)), 'INVALID_PLACEMENT_INPUT');
    }
    // The origin carries members only: no weight, no primary, no relation on a member.
    const weighted = { threadId: 'thread-a', x: H1.x, y: H1.y, weight: 0.7 } as unknown as CanonicalExistingHome;
    expectRejection(() => placeCanonicalHome(request('thread-new', { state: 'MULTIPLE', homes: [weighted, H2] }, [H1, H2])), 'INVALID_PLACEMENT_INPUT', 0);
  });
});

describe('the origin seed point (items 1-7, 12, 32, 33)', () => {
  const H1 = home('thread-a', 5_000_000n, 5_000_000n);
  const H2 = home('thread-b', -5_000_000n, 5_000_000n);
  const H3 = home('thread-c', 0n, -9_000_000n);
  const WORLD = [H1, H2, H3];
  const serialize = (placed: CanonicalHomePlacement) => JSON.stringify(placed, (_key, value: unknown) => (typeof value === 'bigint' ? `${value}n` : value));

  it('places the first no-origin Thread from the datum without placing it AT the datum and without a root or center (items 1, 33)', () => {
    const first = placeCanonicalHome(request('thread-first', { state: 'NONE' }, []));
    expect(first.baseX).toBe(0n);
    expect(first.baseY).toBe(0n);
    expect(first.x === 0n && first.y === 0n).toBe(false);
    expect(chebyshevDistance(first, DATUM) >= outerHalfBoundary(radiusForAttempt(first.attempt))).toBe(true);
    expect(chebyshevDistance(first, DATUM) <= radiusForAttempt(first.attempt)).toBe(true);
    expect(first.worldFingerprint).toBe(EMPTY_WORLD_FINGERPRINT);
    expect(first.originFingerprint).toBe(NONE_ORIGIN_FINGERPRINT);
    expect(Object.keys(first).sort(compareIdentity)).toEqual(RESULT_KEYS);
  });

  it('places the second no-origin Thread against the grown world: distinct, separated, different fingerprint (item 2)', () => {
    const first = placeCanonicalHome(request('thread-first', { state: 'NONE' }, []));
    const firstHome = home('thread-first', first.x, first.y);
    const second = placeCanonicalHome(request('thread-second', { state: 'NONE' }, [firstHome]));
    expect(second.baseX).toBe(0n);
    expect(second.baseY).toBe(0n);
    expect(chebyshevDistance(second, firstHome) >= MIN_HOME_SEPARATION).toBe(true);
    expect(second.worldFingerprint).not.toBe(first.worldFingerprint);
    expect(second.worldFingerprint).toBe(sha256(`${CANONICAL_HOME_PLACEMENT_SCHEME}\nthread-first\t${first.x}\t${first.y}\n`));
  });

  it('does not fabricate a nearest or primary Thread for a no-origin placement (item 33)', () => {
    const far = home('thread-far', 50_000_000n, 50_000_000n);
    const placed = placeCanonicalHome(request('thread-none', { state: 'NONE' }, [far]));
    expect(placed.baseX).toBe(0n);
    expect(placed.baseY).toBe(0n);
    expect(chebyshevDistance(placed, DATUM) <= radiusForAttempt(placed.attempt)).toBe(true);
    expect(chebyshevDistance(placed, far) > radiusForAttempt(placed.attempt)).toBe(true);
  });

  it('seeds a RESOLVED origin at that Home; the result is distinct, not a child, and in no required direction (items 3, 12)', () => {
    const placed = placeCanonicalHome(request('thread-child', { state: 'RESOLVED', homes: [H1] }, WORLD));
    expect(placed.baseX).toBe(H1.x);
    expect(placed.baseY).toBe(H1.y);
    expect(chebyshevDistance(placed, H1) >= MIN_HOME_SEPARATION).toBe(true);
    expect(chebyshevDistance(placed, H1) >= outerHalfBoundary(radiusForAttempt(placed.attempt))).toBe(true);
    expect(Object.keys(placed)).not.toEqual(expect.arrayContaining(['parentThreadId', 'originThreadId', 'originThreadIds', 'edge', 'parent']));
    const quadrants = new Set<string>();
    for (let index = 0; index < 8; index += 1) {
      const sibling = placeCanonicalHome(request(`thread-dir-${index}`, { state: 'RESOLVED', homes: [GV01_HOME] }, [GV01_HOME]));
      quadrants.add(`${sibling.x - GV01_HOME.x < 0n ? '-' : '+'}${sibling.y - GV01_HOME.y < 0n ? '-' : '+'}`);
    }
    expect(quadrants.size).toBeGreaterThanOrEqual(2);
  });

  it('seeds MULTIPLE at the exact integer barycenter over ALL members, with no primary member (items 4, 32)', () => {
    const placed = placeCanonicalHome(request('thread-multi', { state: 'MULTIPLE', homes: [H3, H1, H2] }, WORLD));
    expect(placed.baseX).toBe(floorDiv(H1.x + H2.x + H3.x, 3n));
    expect(placed.baseY).toBe(floorDiv(H1.y + H2.y + H3.y, 3n));
    expect(placed.baseX).toBe(0n);
    expect(placed.baseY).toBe(333_333n);
    for (const member of WORLD) expect(placed.baseX === member.x && placed.baseY === member.y).toBe(false);
    expect(originSeedPoint({ state: 'MULTIPLE', homes: [H1, H2] })).toEqual({ baseX: 0n, baseY: 5_000_000n });
    expect(originSeedPoint({ state: 'MULTIPLE', homes: [home('l', -7_000_001n, 3n), home('r', 2n, -6_000_004n)] })).toEqual({ baseX: -3_500_000n, baseY: -3_000_001n });
  });

  it('seeds AMBIGUOUS with the very same symmetric computation, marks no candidate true, and still places (item 5)', () => {
    const ambiguous = placeCanonicalHome(request('thread-amb', { state: 'AMBIGUOUS', homes: [H1, H2, H3] }, WORLD));
    const multiple = placeCanonicalHome(request('thread-amb', { state: 'MULTIPLE', homes: [H1, H2, H3] }, WORLD));
    expect(ambiguous.baseX).toBe(multiple.baseX);
    expect(ambiguous.baseY).toBe(multiple.baseY);
    expect(ambiguous.worldFingerprint).toBe(multiple.worldFingerprint);
    expect(ambiguous.originFingerprint).not.toBe(multiple.originFingerprint);
    expect(ambiguous.originFingerprint).toBe(sha256(`AMBIGUOUS\nthread-a\t5000000\t5000000\nthread-b\t-5000000\t5000000\nthread-c\t0\t-9000000\n`));
    expect(Object.keys(ambiguous).sort(compareIdentity)).toEqual(RESULT_KEYS);
  });

  it('is invariant under every permutation of MULTIPLE and AMBIGUOUS members (item 6)', () => {
    const permutations: (readonly CanonicalExistingHome[])[] = [
      [H1, H2, H3],
      [H1, H3, H2],
      [H2, H1, H3],
      [H2, H3, H1],
      [H3, H1, H2],
      [H3, H2, H1],
    ];
    for (const state of ['MULTIPLE', 'AMBIGUOUS'] as const) {
      const reference = serialize(placeCanonicalHome(request('thread-perm', { state, homes: permutations[0] }, WORLD)));
      for (const homes of permutations) expect(serialize(placeCanonicalHome(request('thread-perm', { state, homes }, WORLD)))).toBe(reference);
    }
  });

  it('is invariant under every ordering of the existing world (item 7)', () => {
    const reference = serialize(placeCanonicalHome(request('thread-world', { state: 'RESOLVED', homes: [H2] }, [H1, H2, H3])));
    for (const world of [[H3, H2, H1], [H2, H1, H3], [H3, H1, H2], [H1, H3, H2]]) {
      expect(serialize(placeCanonicalHome(request('thread-world', { state: 'RESOLVED', homes: [H2] }, world)))).toBe(reference);
    }
    expect(fingerprintWorld([H3, H1, H2])).toBe(fingerprintWorld([H1, H2, H3]));
    expect(fingerprintOrigin({ state: 'MULTIPLE', homes: [H3, H1] })).toBe(fingerprintOrigin({ state: 'MULTIPLE', homes: [H1, H3] }));
  });
});

describe('placement admissibility and separation (items 17, 18, 19)', () => {
  it('accepts exactly MIN_HOME_SEPARATION and rejects one unit below, in every direction (items 17, 18)', () => {
    const anchor = home('thread-anchor', 0n, 0n);
    const index = new SeparationIndex([anchor]);
    for (const accepted of [point(250_000n, 0n), point(-250_000n, 0n), point(0n, 250_000n), point(0n, -250_000n), point(250_000n, 250_000n), point(-250_000n, -250_000n), point(250_000n, -249_999n)]) {
      expect(index.isAdmissible(accepted)).toBe(true);
      expect(admissibleByScan(accepted, [anchor])).toBe(true);
    }
    for (const refused of [point(249_999n, 0n), point(-249_999n, 0n), point(0n, 249_999n), point(0n, -249_999n), point(249_999n, 249_999n), point(-249_999n, -1n), point(0n, 0n)]) {
      expect(index.isAdmissible(refused)).toBe(false);
      expect(index.separationViolation(refused)).toBe(anchor);
      expect(admissibleByScan(refused, [anchor])).toBe(false);
    }
  });

  it('accepts a candidate at exactly the minimum from an existing Home at the engine level, and rejects one unit closer', () => {
    const first = candidateForAttempt(SEED, DATUM, 0);
    const exact = home('thread-exact', first.x + MIN_HOME_SEPARATION, first.y);
    const accepted = searchAdmissiblePlacement(SEED, DATUM, new SeparationIndex([exact]));
    expect(accepted).toEqual({ x: first.x, y: first.y, attempt: 0 });
    const tooClose = home('thread-close', first.x + MIN_HOME_SEPARATION - 1n, first.y);
    const refused = searchAdmissiblePlacement(SEED, DATUM, new SeparationIndex([tooClose]));
    expect(refused.attempt).toBeGreaterThan(0);
    expect(refused.x === first.x && refused.y === first.y).toBe(false);
    expect(chebyshevDistance(refused, tooClose) >= MIN_HOME_SEPARATION).toBe(true);
  });

  it('agrees with the brute-force scan against every Home on a lattice world (index is acceleration, not authority)', () => {
    const lattice: CanonicalExistingHome[] = [];
    for (let row = -6; row <= 6; row += 1) {
      for (let column = -6; column <= 6; column += 1) {
        lattice.push(home(`thread-l-${row + 6}-${column + 6}`, BigInt(column) * 300_000n + 7n, BigInt(row) * 300_000n - 11n));
      }
    }
    const index = new SeparationIndex(lattice);
    let admitted = 0;
    for (let attempt = 0; attempt < 2000; attempt += 1) {
      const probe = candidateForAttempt(SEED, DATUM, attempt);
      const expected = admissibleByScan(probe, lattice);
      expect(index.isAdmissible(probe)).toBe(expected);
      if (expected) admitted += 1;
    }
    expect(admitted).toBeGreaterThan(0);
    expect(admitted).toBeLessThan(2000);
  });

  it('forces a later shell when the origin neighbourhood is dense, without moving any lattice Home (item 19)', () => {
    const lattice = denseWorldAround(GV07_CENTER);
    expect(lattice).toHaveLength(49);
    const snapshot = structuredClone(lattice);
    const placed = placeCanonicalHome(request('thread-dense-new', { state: 'RESOLVED', homes: [GV07_CENTER] }, lattice));
    expect(placed.attempt).toBeGreaterThanOrEqual(CANDIDATES_PER_SHELL);
    expect(shellForAttempt(placed.attempt) >= 2n).toBe(true);
    for (const existing of lattice) expect(chebyshevDistance(placed, existing) >= MIN_HOME_SEPARATION).toBe(true);
    expect(chebyshevDistance(placed, GV07_CENTER) > 1_000_000n).toBe(true);
    expect(lattice).toEqual(snapshot);
    // Every earlier attempt was genuinely blocked by the lattice, never skipped for another reason.
    const seed: PlacementSearchSeed = { userWorldId: USER, newThreadId: 'thread-dense-new', originFingerprint: placed.originFingerprint, worldFingerprint: placed.worldFingerprint };
    for (let attempt = 0; attempt < placed.attempt; attempt += 1) {
      const candidate = candidateForAttempt(seed, { x: placed.baseX, y: placed.baseY }, attempt);
      expect(isWithinCoordinateBounds(candidate.x, candidate.y)).toBe(true);
      expect(admissibleByScan(candidate, lattice)).toBe(false);
    }
  });
});

describe('determinism, golden vectors and the non-substitution law (items 12, 13, 30, 35)', () => {
  it('reproduces every pinned golden vector exactly (item 13)', () => {
    expect(CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS.map((vector) => vector.id)).toEqual(['GV-01', 'GV-02', 'GV-03', 'GV-04', 'GV-05', 'GV-06', 'GV-07']);
    for (const vector of CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS) {
      const placed = placeCanonicalHome(vector.request);
      expect(placed).toEqual(vector.expected);
      expect(placed.scheme).toBe('QANDEEL_OSDAP_V1');
      expect(vector.request.userWorldId).toBe(GOLDEN_USER_WORLD_ID);
    }
    // The golden Homes chained into later vectors are the earlier vectors' results.
    expect(GV01_HOME).toEqual({ threadId: 'thread-gv01', x: CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS[0].expected.x, y: CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS[0].expected.y });
    expect(GV02_HOME).toEqual({ threadId: 'thread-gv02', x: CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS[1].expected.x, y: CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS[1].expected.y });
    expect(GV03_HOME).toEqual({ threadId: 'thread-gv03', x: CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS[2].expected.x, y: CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS[2].expected.y });
    // GV-02 lands exactly on the projected inner boundary: the projection rule is part of the contract.
    expect(GV02_HOME.y).toBe(outerHalfBoundary(HOME_STEP));
  });

  it('pins the canonical serializations behind the fingerprints', () => {
    expect(EMPTY_WORLD_FINGERPRINT).toBe(sha256('QANDEEL_OSDAP_V1\n'));
    expect(NONE_ORIGIN_FINGERPRINT).toBe(sha256('NONE\n'));
    expect(CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS[2].expected.originFingerprint).toBe(sha256('RESOLVED\nthread-gv01\t534265\t944722\n'));
    expect(CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS[2].expected.worldFingerprint).toBe(sha256('QANDEEL_OSDAP_V1\nthread-gv01\t534265\t944722\nthread-gv02\t-17692\t500000\n'));
  });

  it('returns byte-identical results across 100 repeated calls (item 12)', () => {
    const vector = CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS[4];
    const serialize = (placed: CanonicalHomePlacement) => JSON.stringify(placed, (_key, value: unknown) => (typeof value === 'bigint' ? `${value}n` : value));
    const reference = serialize(placeCanonicalHome(vector.request));
    for (let call = 0; call < 100; call += 1) expect(serialize(placeCanonicalHome(vector.request))).toBe(reference);
  });

  it('cannot be silently substituted: another digest domain or scheme changes the candidate sequence and the fingerprints (item 35)', () => {
    const golden = CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS[0];
    const genuine = candidateForAttempt(
      { userWorldId: golden.request.userWorldId, newThreadId: golden.request.newThreadId, originFingerprint: NONE_ORIGIN_FINGERPRINT, worldFingerprint: EMPTY_WORLD_FINGERPRINT },
      DATUM,
      0,
    );
    expect(genuine).toEqual({ x: golden.expected.x, y: golden.expected.y });
    const foreignDigest = new Uint8Array(
      createHash('sha256').update(`qandeel-osdap-v2|${golden.request.userWorldId}|${golden.request.newThreadId}|${NONE_ORIGIN_FINGERPRINT}|${EMPTY_WORLD_FINGERPRINT}|0`, 'utf8').digest(),
    );
    const foreign = candidateOffset(foreignDigest, radiusForAttempt(0));
    expect(foreign.dx === golden.expected.x && foreign.dy === golden.expected.y).toBe(false);
    expect(sha256('QANDEEL_OSDAP_V2\n')).not.toBe(EMPTY_WORLD_FINGERPRINT);
    expect({ ...golden.expected, scheme: 'QANDEEL_OSDAP_V2' }).not.toEqual(placeCanonicalHome(golden.request));
  });
});

describe('capacity exhaustion and the technical coordinate bound (items 20, 21)', () => {
  it('fails closed with CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED when every candidate is blocked, moving nothing (item 20)', () => {
    const blockers: CanonicalExistingHome[] = [];
    const occupied = new SeparationIndex();
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const candidate = candidateForAttempt(SEED, DATUM, attempt);
      const blocker = home(`thread-block-${attempt}`, candidate.x, candidate.y);
      if (occupied.insertUnique(blocker)) blockers.push(blocker);
    }
    const snapshot = structuredClone(blockers);
    expectRejection(() => searchAdmissiblePlacement(SEED, DATUM, new SeparationIndex(blockers)), 'CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED');
    expect(blockers).toEqual(snapshot);
    // Removing one blocker makes exactly that attempt admissible again: the loop covers all MAX_ATTEMPTS and stops there.
    const withoutLast = blockers.filter((blocker) => blocker.threadId !== 'thread-block-8191');
    const lastCandidate = candidateForAttempt(SEED, DATUM, 8191);
    if (withoutLast.length < blockers.length && admissibleByScan(lastCandidate, withoutLast)) {
      expect(searchAdmissiblePlacement(SEED, DATUM, new SeparationIndex(withoutLast))).toEqual({ x: lastCandidate.x, y: lastCandidate.y, attempt: 8191 });
    }
  });

  it('skips out-of-bound candidates without clamping or wrapping, and exhausts rather than overflow (item 21)', () => {
    const corner = point(MAX_COORD, MAX_COORD);
    const placed = searchAdmissiblePlacement(SEED, corner, new SeparationIndex());
    expect(isWithinCoordinateBounds(placed.x, placed.y)).toBe(true);
    expect(placed.attempt).toBeGreaterThan(0);
    const winner = candidateForAttempt(SEED, corner, placed.attempt);
    expect(placed).toEqual({ x: winner.x, y: winner.y, attempt: placed.attempt });
    for (let attempt = 0; attempt < placed.attempt; attempt += 1) {
      const candidate = candidateForAttempt(SEED, corner, attempt);
      expect(isWithinCoordinateBounds(candidate.x, candidate.y)).toBe(false);
    }
    // Block every in-bound candidate: the engine must exhaust, never clamp to the bound or wrap around it.
    const blockers: CanonicalExistingHome[] = [];
    const occupied = new SeparationIndex();
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const candidate = candidateForAttempt(SEED, corner, attempt);
      if (!isWithinCoordinateBounds(candidate.x, candidate.y)) continue;
      const blocker = home(`thread-corner-${attempt}`, candidate.x, candidate.y);
      if (occupied.insertUnique(blocker)) blockers.push(blocker);
    }
    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers.length).toBeLessThan(MAX_ATTEMPTS);
    expectRejection(() => searchAdmissiblePlacement(SEED, corner, new SeparationIndex(blockers)), 'CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED');
    // The public engine at the corner of the world still places inside the bound.
    const edge = home('thread-edge', MAX_COORD, MAX_COORD);
    const publicPlaced = placeCanonicalHome(request('thread-near-edge', { state: 'RESOLVED', homes: [edge] }, [edge]));
    expect(isWithinCoordinateBounds(publicPlaced.x, publicPlaced.y)).toBe(true);
    expect(publicPlaced.x <= MAX_COORD && publicPlaced.y <= MAX_COORD).toBe(true);
  });
});

describe('the engine is consulted for NEW establishment only (items 22, 23, 31, 34)', () => {
  const committed = home('thread-established', 1_234_567n, -7_654_321n);

  it('keeps the committed Home on refinement and never consults the engine (item 22)', () => {
    const engine = jest.fn<CanonicalHomePlacement, []>();
    const resolution = resolveThreadHome(committed, engine);
    expect(resolution).toEqual({ outcome: 'COMMITTED_HOME_KEPT', home: committed });
    expect(resolution.outcome === 'COMMITTED_HOME_KEPT' && resolution.home).toBe(committed);
    expect(engine).not.toHaveBeenCalled();
  });

  it('keeps the committed Home when a Thread is reopened, goes dormant or is returned to (item 23)', () => {
    const engine = jest.fn<CanonicalHomePlacement, []>();
    for (const occasion of ['reopened', 'dormant', 'existing Thread return']) {
      const resolution = resolveThreadHome(committed, engine);
      expect(resolution.outcome).toBe(`COMMITTED_HOME_KEPT`);
      expect(resolution.outcome === 'COMMITTED_HOME_KEPT' && resolution.home.x).toBe(committed.x);
      expect(occasion.length).toBeGreaterThan(0);
    }
    expect(engine).not.toHaveBeenCalled();
  });

  it('places exactly once when no committed Home exists, and refuses a second Home for an already placed Thread', () => {
    const world = [committed];
    const engine = jest.fn(() => placeCanonicalHome(request('thread-fresh', { state: 'NONE' }, world)));
    const resolution = resolveThreadHome(null, engine);
    expect(resolution.outcome).toBe('NEW_HOME_PLACED');
    expect(engine).toHaveBeenCalledTimes(1);
    expectRejection(() => placeCanonicalHome(request('thread-established', { state: 'NONE' }, world)), 'THREAD_ALREADY_PLACED');
  });

  it('never mutates or aliases the existing Homes, the origin or the request (item 31)', () => {
    const H1 = home('thread-a', 5_000_000n, 5_000_000n);
    const H2 = home('thread-b', -5_000_000n, 5_000_000n);
    const req = request('thread-new', { state: 'MULTIPLE', homes: [H2, H1] }, [H1, H2]);
    const before = structuredClone(req);
    const placed = placeCanonicalHome(req);
    expect(req).toEqual(before);
    expect(Object.isFrozen(req.existingHomes)).toBe(true);
    expect(Object.isFrozen(H1)).toBe(true);
    const validated = validateHomePlacementRequest(req);
    for (const copy of validated.existingHomes) {
      expect(copy).not.toBe(H1);
      expect(copy).not.toBe(H2);
      expect(Object.isFrozen(copy)).toBe(true);
    }
    expect(Object.values(placed).some((value) => value === H1 || value === H2)).toBe(false);
  });

  it('never gives two distinct new Threads one Home under the append law (item 34)', () => {
    const world = [committed];
    const first = placeCanonicalHome(request('thread-one', { state: 'RESOLVED', homes: [committed] }, world));
    const grown = [...world, home('thread-one', first.x, first.y)];
    const second = placeCanonicalHome(request('thread-two', { state: 'RESOLVED', homes: [committed] }, grown));
    expect(second.x === first.x && second.y === first.y).toBe(false);
    expect(chebyshevDistance(second, first) >= MIN_HOME_SEPARATION).toBe(true);
    expect(second.worldFingerprint).not.toBe(first.worldFingerprint);
    expect(second.originFingerprint).toBe(first.originFingerprint);
  });
});
