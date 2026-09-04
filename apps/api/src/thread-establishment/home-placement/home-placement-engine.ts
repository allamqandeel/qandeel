// T-03B2b1 - Canonical Home Placement Engine v1: QANDEEL OSDAP v1
// (Origin-Seeded Deterministic Append Placement). Engineering decision
// ED-B2B1-01. Pure, production-inert, framework-agnostic.
//
// The engine is called ONLY for the establishment of a NEW Thread. It reads the
// then-existing committed world (every permanent Home), the Conversational
// Origin of the new Thread (placement input, never hierarchy) and the two
// canonical identities, and returns the ONE canonical placement of the new
// Home. It never moves, recalculates, swaps or re-lays out an existing Home:
// there is no relocation API, no second pass, no global optimization.
//
// Canonical arithmetic is exact signed-integer BigInt throughout. No
// floating-point value ever touches a coordinate, a fingerprint or a candidate.
// There is no random source, no runtime clock and no locale-sensitive
// serialization, so the same request reproduces the same placement byte for
// byte across calls, processes, operating systems, retries and CI.
//
// Algorithm (task sections 5-8):
//   1. validate the closed request shape; fail closed on any malformed world,
//      duplicate, unknown origin member or already-placed Thread;
//   2. seed point: NONE -> world datum (0,0) (a search datum, NOT a semantic
//      center and NOT an automatic first placement); RESOLVED -> the one origin
//      Home; MULTIPLE / AMBIGUOUS -> the permutation-invariant exact integer
//      barycenter (floor division toward negative infinity) over ALL members;
//   3. fingerprints: sha256 over the canonical serialization of the existing
//      world (sorted by Thread id) and of the origin (state + sorted members);
//   4. for zero-based attempt i < MAX_ATTEMPTS: shell = 1 + floor(i / 32),
//      radius = HOME_STEP * shell; digest = sha256(domain|user|thread|
//      originFp|worldFp|i); the two 128-bit halves map into the square
//      [-radius, +radius]^2; an offset in the inner half is projected onto the
//      outer half; candidate = base + offset; skip if outside the technical
//      coordinate bound; skip unless Chebyshev distance to EVERY existing Home
//      is >= MIN_HOME_SEPARATION; the first admissible candidate wins;
//   5. otherwise fail closed with CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED.
//
// "Shell" is a search mechanism only. It is never a Thread level, importance,
// generation, hierarchy or Timeline, and it is not part of the result.
//
// Every exported helper below is a PROOF SEAM: a pure step of the one
// algorithm, exported so the suites and the static contract can pin each step
// exactly. None of them is an alternative authority, and `index.ts` exposes
// only `placeCanonicalHome` and `resolveThreadHome`.

import {
  CANDIDATES_PER_SHELL,
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
  type ConversationalOriginState,
  type HomePlacementRequest,
  type ThreadHomeResolution,
  type WorldCoord,
} from './home-placement.types';
import { sha256Bytes, sha256Hex } from './sha256-canonical';

// ---------------------------------------------------------------------------
// Exact integer arithmetic
// ---------------------------------------------------------------------------

/**
 * Mathematical floor division: the quotient rounded toward negative infinity.
 * `divisor` must be positive. Examples: floorDiv(7, 2) = 3, floorDiv(-7, 2) = -4,
 * floorDiv(-6, 2) = -3, floorDiv(-1, 250000) = -1.
 */
export function floorDiv(dividend: bigint, divisor: bigint): bigint {
  if (divisor <= 0n) throw new RangeError('floorDiv requires a positive divisor.');
  const quotient = dividend / divisor;
  return dividend % divisor < 0n ? quotient - 1n : quotient;
}

export function absBig(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function maxBig(left: bigint, right: bigint): bigint {
  return left >= right ? left : right;
}

/** Sign used by the inner-square projection: zero counts as positive. */
export function signBig(value: bigint): bigint {
  return value < 0n ? -1n : 1n;
}

export interface WorldPoint {
  readonly x: WorldCoord;
  readonly y: WorldCoord;
}

/** Chebyshev (L-infinity) distance: a technical collision / legibility metric with ZERO semantic meaning. */
export function chebyshevDistance(left: WorldPoint, right: WorldPoint): bigint {
  return maxBig(absBig(left.x - right.x), absBig(left.y - right.y));
}

export function isWithinCoordinateBounds(x: bigint, y: bigint): boolean {
  return x >= MIN_COORD && x <= MAX_COORD && y >= MIN_COORD && y <= MAX_COORD;
}

// ---------------------------------------------------------------------------
// Closed input validation
// ---------------------------------------------------------------------------

const REQUEST_KEYS = Object.freeze(['existingHomes', 'newThreadId', 'origin', 'userWorldId'] as const);
const HOME_KEYS = Object.freeze(['threadId', 'x', 'y'] as const);
const ORIGIN_NONE_KEYS = Object.freeze(['state'] as const);
const ORIGIN_MEMBER_KEYS = Object.freeze(['homes', 'state'] as const);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Exact-shape allowlist: the enumerable own keys must be exactly `keys`, no more, no fewer. */
function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(record);
  if (actual.length !== keys.length) return false;
  for (const key of actual) {
    if (!keys.includes(key)) return false;
  }
  return true;
}

function isMember<T extends string>(vocabulary: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (vocabulary as readonly string[]).includes(value);
}

export function isCanonicalIdentity(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_IDENTITY_PATTERN.test(value);
}

/** Locale-independent UTF-16 code-unit ordering. Never `localeCompare`. */
export function compareIdentity(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareHomes(left: CanonicalExistingHome, right: CanonicalExistingHome): number {
  return compareIdentity(left.threadId, right.threadId);
}

const reject = (reason: CanonicalHomePlacementRejectionReason, index = -1) => new CanonicalHomePlacementRejectedError(reason, index);

/** Shape, identity and coordinate TYPE of one Home. Bounds are the world validator's concern. */
function validateHomeShape(value: unknown, index: number): CanonicalExistingHome {
  if (!isRecord(value) || !hasExactKeys(value, HOME_KEYS)) throw reject('INVALID_PLACEMENT_INPUT', index);
  const { threadId, x, y } = value;
  if (!isCanonicalIdentity(threadId)) throw reject('INVALID_PLACEMENT_INPUT', index);
  if (typeof x !== 'bigint' || typeof y !== 'bigint') throw reject('INVALID_PLACEMENT_INPUT', index);
  return Object.freeze({ threadId, x, y });
}

export interface ValidatedOrigin {
  readonly state: ConversationalOriginState;
  /** The grounded members, sorted by Thread id; empty for NONE. Copies of the EXISTING Homes, never the caller's objects. */
  readonly homes: readonly CanonicalExistingHome[];
}

export interface ValidatedPlacementRequest {
  readonly userWorldId: string;
  readonly newThreadId: string;
  readonly origin: ValidatedOrigin;
  /** Frozen copies of the existing Homes, sorted by Thread id. */
  readonly existingHomes: readonly CanonicalExistingHome[];
  /** The same Homes, bucketed for the exact separation test. */
  readonly index: SeparationIndex;
}

function validateOrigin(value: unknown, byId: ReadonlyMap<string, CanonicalExistingHome>): ValidatedOrigin {
  if (!isRecord(value)) throw reject('INVALID_PLACEMENT_INPUT');
  const { state } = value;
  if (!isMember(CONVERSATIONAL_ORIGIN_STATES, state)) throw reject('INVALID_PLACEMENT_INPUT');
  if (state === 'NONE') {
    if (!hasExactKeys(value, ORIGIN_NONE_KEYS)) throw reject('INVALID_PLACEMENT_INPUT');
    return Object.freeze({ state, homes: Object.freeze([]) });
  }
  if (!hasExactKeys(value, ORIGIN_MEMBER_KEYS)) throw reject('INVALID_PLACEMENT_INPUT');
  const rawHomes: unknown = value.homes;
  if (!Array.isArray(rawHomes)) throw reject('INVALID_PLACEMENT_INPUT');
  const members: unknown[] = [...rawHomes];
  if (state === 'RESOLVED' ? members.length !== 1 : members.length < 2) throw reject('INVALID_ORIGIN_CARDINALITY');
  const seen = new Set<string>();
  const grounded: CanonicalExistingHome[] = [];
  members.forEach((member, index) => {
    const candidate = validateHomeShape(member, index);
    if (seen.has(candidate.threadId)) throw reject('DUPLICATE_ORIGIN_HOME', index);
    const known = byId.get(candidate.threadId);
    if (known === undefined) throw reject('UNKNOWN_ORIGIN_HOME', index);
    if (known.x !== candidate.x || known.y !== candidate.y) throw reject('ORIGIN_HOME_MISMATCH', index);
    seen.add(candidate.threadId);
    grounded.push(known);
  });
  return Object.freeze({ state, homes: Object.freeze(grounded.sort(compareHomes)) });
}

/**
 * Validates the closed request shape and normalizes the world. Fails closed on
 * any extra key, wrong type, malformed identity, out-of-bound coordinate,
 * duplicate Thread id, duplicate placement, unknown / duplicate / mismatched
 * origin member, wrong origin cardinality, or a new Thread that already holds a
 * Home. The caller's objects are never mutated and never retained.
 */
export function validateHomePlacementRequest(request: HomePlacementRequest): ValidatedPlacementRequest {
  const raw: unknown = request;
  if (!isRecord(raw) || !hasExactKeys(raw, REQUEST_KEYS)) throw reject('INVALID_PLACEMENT_INPUT');
  const { userWorldId, newThreadId, origin, existingHomes } = raw;
  if (!isCanonicalIdentity(userWorldId) || !isCanonicalIdentity(newThreadId)) throw reject('INVALID_PLACEMENT_INPUT');
  if (!Array.isArray(existingHomes)) throw reject('INVALID_PLACEMENT_INPUT');
  const entries: unknown[] = [...existingHomes];
  const byId = new Map<string, CanonicalExistingHome>();
  const index = new SeparationIndex();
  entries.forEach((entry, position) => {
    const home = validateHomeShape(entry, position);
    if (!isWithinCoordinateBounds(home.x, home.y)) throw reject('EXISTING_HOME_OUT_OF_BOUNDS', position);
    if (byId.has(home.threadId)) throw reject('DUPLICATE_EXISTING_THREAD_ID', position);
    if (!index.insertUnique(home)) throw reject('DUPLICATE_EXISTING_PLACEMENT', position);
    byId.set(home.threadId, home);
  });
  if (byId.has(newThreadId)) throw reject('THREAD_ALREADY_PLACED');
  return Object.freeze({
    userWorldId,
    newThreadId,
    origin: validateOrigin(origin, byId),
    existingHomes: Object.freeze([...byId.values()].sort(compareHomes)),
    index,
  });
}

// ---------------------------------------------------------------------------
// Origin seed point (task section 5)
// ---------------------------------------------------------------------------

export interface SeedPoint {
  readonly baseX: WorldCoord;
  readonly baseY: WorldCoord;
}

/**
 * NONE -> the world datum (0,0), a search datum only. RESOLVED -> the one origin
 * Home. MULTIPLE / AMBIGUOUS -> the exact integer barycenter over ALL members,
 * floor-divided toward negative infinity. The same symmetric computation serves
 * both multi-member states: no member is primary, no candidate is marked true.
 */
export function originSeedPoint(origin: ValidatedOrigin): SeedPoint {
  if (origin.homes.length === 0) return Object.freeze({ baseX: 0n, baseY: 0n });
  let sumX = 0n;
  let sumY = 0n;
  for (const home of origin.homes) {
    sumX += home.x;
    sumY += home.y;
  }
  const count = BigInt(origin.homes.length);
  return Object.freeze({ baseX: floorDiv(sumX, count), baseY: floorDiv(sumY, count) });
}

// ---------------------------------------------------------------------------
// Fingerprints (task section 6)
// ---------------------------------------------------------------------------

function serializeHome(home: CanonicalExistingHome): string {
  return `${home.threadId}\t${home.x}\t${home.y}\n`;
}

/** sha256 hex of `scheme + ordered (threadId, x, y)`; the input order is irrelevant. */
export function fingerprintWorld(existingHomes: readonly CanonicalExistingHome[]): string {
  const ordered = [...existingHomes].sort(compareHomes);
  return sha256Hex(`${CANONICAL_HOME_PLACEMENT_SCHEME}\n${ordered.map(serializeHome).join('')}`);
}

/** sha256 hex of `origin.state + ordered origin (threadId, x, y)`; the member order is irrelevant. */
export function fingerprintOrigin(origin: ValidatedOrigin): string {
  const ordered = [...origin.homes].sort(compareHomes);
  return sha256Hex(`${origin.state}\n${ordered.map(serializeHome).join('')}`);
}

// ---------------------------------------------------------------------------
// Candidate search (task section 7)
// ---------------------------------------------------------------------------

/** Everything the per-attempt entropy is bound to. */
export interface PlacementSearchSeed {
  readonly userWorldId: string;
  readonly newThreadId: string;
  readonly originFingerprint: string;
  readonly worldFingerprint: string;
}

export function assertAttempt(attempt: number): void {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt >= MAX_ATTEMPTS) {
    throw new RangeError(`attempt must be an integer in [0, ${MAX_ATTEMPTS}).`);
  }
}

/** shell = 1 + floor(attempt / CANDIDATES_PER_SHELL), as exact integer arithmetic. */
export function shellForAttempt(attempt: number): bigint {
  assertAttempt(attempt);
  return 1n + BigInt(attempt) / BigInt(CANDIDATES_PER_SHELL);
}

export function radiusForAttempt(attempt: number): bigint {
  return HOME_STEP * shellForAttempt(attempt);
}

/** `domain|userWorldId|newThreadId|originFingerprintHex|worldFingerprintHex|attempt`, sha256, 32 bytes. */
export function attemptDigest(seed: PlacementSearchSeed, attempt: number): Uint8Array {
  assertAttempt(attempt);
  return sha256Bytes(
    `${OSDAP_DIGEST_DOMAIN}|${seed.userWorldId}|${seed.newThreadId}|${seed.originFingerprint}|${seed.worldFingerprint}|${attempt}`,
  );
}

export interface UnsignedPair {
  readonly uX: bigint;
  readonly uY: bigint;
}

/** The first 16 digest bytes big-endian -> uX, the last 16 -> uY. No floating point. */
export function digestToUnsignedPair(digest: Uint8Array): UnsignedPair {
  if (digest.length !== 32) throw new RangeError('a sha256 digest is exactly 32 bytes.');
  let uX = 0n;
  let uY = 0n;
  for (let position = 0; position < 16; position += 1) uX = (uX << 8n) | BigInt(digest[position]);
  for (let position = 16; position < 32; position += 1) uY = (uY << 8n) | BigInt(digest[position]);
  return Object.freeze({ uX, uY });
}

/** Maps an unsigned integer onto [-radius, +radius] by exact modulus. */
export function mapToSquare(unsigned: bigint, radius: bigint): bigint {
  if (unsigned < 0n || radius <= 0n) throw new RangeError('mapToSquare requires unsigned >= 0 and radius > 0.');
  return (unsigned % (2n * radius + 1n)) - radius;
}

/** ceil(radius / 2): the inner boundary of the outer half of the square shell. */
export function outerHalfBoundary(radius: bigint): bigint {
  if (radius <= 0n) throw new RangeError('outerHalfBoundary requires radius > 0.');
  return (radius + 1n) / 2n;
}

export interface Offset {
  readonly dx: WorldCoord;
  readonly dy: WorldCoord;
}

/**
 * Requires max(|dx|, |dy|) >= ceil(radius / 2). An offset inside the inner
 * half is projected deterministically: the DOMINANT component (the one with
 * the larger absolute value; x on an exact tie) is replaced by
 * sign * ceil(radius / 2) - the nearest signed boundary of the outer half -
 * where a zero component counts as positive; the other component is kept.
 */
export function projectToOuterHalf(dx: bigint, dy: bigint, radius: bigint): Offset {
  const boundary = outerHalfBoundary(radius);
  const ax = absBig(dx);
  const ay = absBig(dy);
  if (maxBig(ax, ay) >= boundary) return Object.freeze({ dx, dy });
  if (ax >= ay) return Object.freeze({ dx: signBig(dx) * boundary, dy });
  return Object.freeze({ dx, dy: signBig(dy) * boundary });
}

/** The square-annulus offset of one attempt digest at one radius. */
export function candidateOffset(digest: Uint8Array, radius: bigint): Offset {
  const { uX, uY } = digestToUnsignedPair(digest);
  return projectToOuterHalf(mapToSquare(uX, radius), mapToSquare(uY, radius), radius);
}

/** The raw candidate of one attempt (before the bound and separation tests). */
export function candidateForAttempt(seed: PlacementSearchSeed, base: WorldPoint, attempt: number): WorldPoint {
  const { dx, dy } = candidateOffset(attemptDigest(seed, attempt), radiusForAttempt(attempt));
  return Object.freeze({ x: base.x + dx, y: base.y + dy });
}

// ---------------------------------------------------------------------------
// Placement admissibility (task section 8)
// ---------------------------------------------------------------------------

/**
 * Cells of the separation index are 2^18 = 262 144 wide, at least
 * MIN_HOME_SEPARATION, so any two points closer than the minimum lie in the
 * same or adjacent cells. An arithmetic shift floors toward negative infinity
 * exactly like `floorDiv` and needs no BigInt division.
 */
export const SEPARATION_CELL_SHIFT = 18n;
if (MIN_HOME_SEPARATION > 1n << SEPARATION_CELL_SHIFT) {
  throw new RangeError('SEPARATION_CELL_SHIFT must cover MIN_HOME_SEPARATION.');
}

export function separationCell(coordinate: bigint): bigint {
  return coordinate >> SEPARATION_CELL_SHIFT;
}

/**
 * The separation test against EVERY existing Home, accelerated by bucketing
 * Homes into cells no smaller than MIN_HOME_SEPARATION: any Home closer than
 * the minimum lies in the candidate's cell or one of its eight neighbours, so
 * the 3x3 neighbourhood is an exact, not approximate, search. Cell keys are
 * BigInt; the distance test itself is always the exact Chebyshev comparison.
 */
export class SeparationIndex {
  private readonly cells = new Map<bigint, Map<bigint, CanonicalExistingHome[]>>();

  constructor(existingHomes: readonly CanonicalExistingHome[] = []) {
    for (const home of existingHomes) this.insert(home);
  }

  private bucketOf(point: WorldPoint, create: boolean): CanonicalExistingHome[] | undefined {
    const cellX = separationCell(point.x);
    const cellY = separationCell(point.y);
    let row = this.cells.get(cellX);
    if (row === undefined) {
      if (!create) return undefined;
      row = new Map();
      this.cells.set(cellX, row);
    }
    let bucket = row.get(cellY);
    if (bucket === undefined && create) {
      bucket = [];
      row.set(cellY, bucket);
    }
    return bucket;
  }

  /** Records one committed Home. The Home object itself is only read. */
  insert(home: CanonicalExistingHome): void {
    this.bucketOf(home, true)?.push(home);
  }

  /**
   * Records one committed Home unless a recorded Home already occupies exactly
   * its canonical placement; returns whether it was recorded.
   */
  insertUnique(home: CanonicalExistingHome): boolean {
    const bucket = this.bucketOf(home, true);
    if (bucket === undefined) return false;
    for (const existing of bucket) {
      if (existing.x === home.x && existing.y === home.y) return false;
    }
    bucket.push(home);
    return true;
  }

  /** True when a recorded Home already occupies exactly this canonical placement. */
  hasExactPlacement(point: WorldPoint): boolean {
    const bucket = this.bucketOf(point, false);
    if (bucket === undefined) return false;
    for (const home of bucket) {
      if (home.x === point.x && home.y === point.y) return true;
    }
    return false;
  }

  /** The first existing Home whose Chebyshev distance to the candidate is below MIN_HOME_SEPARATION, or null. */
  separationViolation(candidate: WorldPoint): CanonicalExistingHome | null {
    const cellX = separationCell(candidate.x);
    const cellY = separationCell(candidate.y);
    for (let deltaX = -1n; deltaX <= 1n; deltaX += 1n) {
      const row = this.cells.get(cellX + deltaX);
      if (row === undefined) continue;
      for (let deltaY = -1n; deltaY <= 1n; deltaY += 1n) {
        const bucket = row.get(cellY + deltaY);
        if (bucket === undefined) continue;
        for (const home of bucket) {
          if (chebyshevDistance(candidate, home) < MIN_HOME_SEPARATION) return home;
        }
      }
    }
    return null;
  }

  isAdmissible(candidate: WorldPoint): boolean {
    return this.separationViolation(candidate) === null;
  }
}

export interface PlacementSearchResult {
  readonly x: WorldCoord;
  readonly y: WorldCoord;
  readonly attempt: number;
}

/**
 * The first admissible candidate in attempt order, or CANONICAL_PLACEMENT_
 * CAPACITY_EXHAUSTED. Out-of-bound candidates are skipped, never clamped or
 * wrapped. Existing Homes are read, never moved.
 */
export function searchAdmissiblePlacement(seed: PlacementSearchSeed, base: WorldPoint, index: SeparationIndex): PlacementSearchResult {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = candidateForAttempt(seed, base, attempt);
    if (!isWithinCoordinateBounds(candidate.x, candidate.y)) continue;
    if (!index.isAdmissible(candidate)) continue;
    return Object.freeze({ x: candidate.x, y: candidate.y, attempt });
  }
  throw reject('CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED');
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/**
 * Places the permanent Home of ONE new Thread against the then-existing
 * committed world. Deterministic, append-only, origin-seeded, semantics-blind.
 */
export function placeCanonicalHome(request: HomePlacementRequest): CanonicalHomePlacement {
  const validated = validateHomePlacementRequest(request);
  const { baseX, baseY } = originSeedPoint(validated.origin);
  const worldFingerprint = fingerprintWorld(validated.existingHomes);
  const originFingerprint = fingerprintOrigin(validated.origin);
  const found = searchAdmissiblePlacement(
    { userWorldId: validated.userWorldId, newThreadId: validated.newThreadId, originFingerprint, worldFingerprint },
    { x: baseX, y: baseY },
    validated.index,
  );
  return Object.freeze({
    scheme: CANONICAL_HOME_PLACEMENT_SCHEME,
    x: found.x,
    y: found.y,
    attempt: found.attempt,
    baseX,
    baseY,
    worldFingerprint,
    originFingerprint,
  });
}

/**
 * The consumer rule that keeps the engine off every non-establishment path: a
 * Thread that already holds a committed Home keeps it unchanged - on
 * refinement, dormancy, reopening and every later return - and `placeNew` is
 * never consulted. Only a Thread WITHOUT a committed Home is placed, once.
 */
export function resolveThreadHome(committedHome: CanonicalExistingHome | null, placeNew: () => CanonicalHomePlacement): ThreadHomeResolution {
  if (committedHome !== null) return Object.freeze({ outcome: 'COMMITTED_HOME_KEPT', home: committedHome });
  return Object.freeze({ outcome: 'NEW_HOME_PLACED', placement: placeNew() });
}
