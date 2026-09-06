/**
 * T-04 — the canonical OSDAP v1 world coordinate adapter.
 *
 * Frozen authority: T-03B2b1 Canonical Home Placement Engine v1 (`QANDEEL_OSDAP_V1`, exact
 * signed integer coordinates in `[-(2^62), 2^62 - 1]`), T-03C's disclosure of a Thread's ONE
 * Home as exact integer text, and Stage 2 / Stage 6 permanence: an Established Thread's Home is
 * committed once and never recalculated, relaid out, compacted or migrated.
 *
 * Canonical coordinates are `bigint` here and nowhere else in this app they are anything else.
 * A presentation transform may derive finite floating-point screen coordinates from a
 * camera-relative *delta* (see `../camera/viewport.ts`); the absolute address never passes
 * through a JavaScript `number`, and no derived screen value is ever written back.
 *
 * Everything in this module is total and fail-closed: a malformed address, an unknown scheme or
 * an out-of-bound coordinate is refused with a typed reason. Nothing is clamped, wrapped,
 * rounded or guessed, and no Home is ever invented for an object that does not have one.
 */
import type { DisclosedHome } from '@qandeel/runtime';

/** The canonical scheme id. A different scheme is a different world encoding, never a substitute. */
export const OSDAP_V1_SCHEME = 'QANDEEL_OSDAP_V1' as const;
export type OsdapScheme = typeof OSDAP_V1_SCHEME;

/**
 * The technical storage bound of a canonical coordinate (T-03B2b1 `MIN_COORD` / `MAX_COORD`).
 * This is not a Product "edge of the world": a coordinate outside it is a malformed address and
 * is refused, never clamped.
 */
export const OSDAP_MIN_COORD: bigint = -(2n ** 62n);
export const OSDAP_MAX_COORD: bigint = 2n ** 62n - 1n;

/** One exact canonical world address. Immutable; `x` and `y` are always `bigint`. */
export interface CanonicalWorldAddress {
  readonly scheme: OsdapScheme;
  readonly x: bigint;
  readonly y: bigint;
}

export type OsdapRejectionReason =
  | 'MALFORMED_ADDRESS'
  | 'UNKNOWN_SCHEME'
  | 'MALFORMED_COORDINATE_TEXT'
  | 'COORDINATE_OUT_OF_BOUNDS';

export type OsdapDecode =
  | { readonly ok: true; readonly address: CanonicalWorldAddress }
  | { readonly ok: false; readonly reason: OsdapRejectionReason; readonly detail: string };

/**
 * The exact integer text the disclosure wire uses for a canonical coordinate. It is deliberately
 * the same charset the T-03C decoder already accepted, so T-04 can never refuse a Home that the
 * projection boundary admitted for a shape reason; the *bounds* below are the OSDAP rule.
 */
const COORDINATE_TEXT = /^-?[0-9]{1,20}$/u;

export function isCanonicalCoordinateText(value: unknown): value is string {
  return typeof value === 'string' && COORDINATE_TEXT.test(value);
}

export function isCanonicalCoordinate(value: bigint): boolean {
  return value >= OSDAP_MIN_COORD && value <= OSDAP_MAX_COORD;
}

/** Exact integer text of a canonical coordinate. `-0` is impossible: `BigInt` has one zero. */
export function canonicalCoordinateText(value: bigint): string {
  return value.toString(10);
}

/**
 * Parses one coordinate. Returns the exact `bigint` or a typed rejection; never a `number`,
 * never a rounded or clamped value.
 */
export function parseCanonicalCoordinate(
  value: unknown,
  path: string,
): { readonly ok: true; readonly value: bigint } | { readonly ok: false; readonly reason: OsdapRejectionReason; readonly detail: string } {
  if (!isCanonicalCoordinateText(value)) {
    return { ok: false, reason: 'MALFORMED_COORDINATE_TEXT', detail: `${path}: must be exact integer text` };
  }
  const parsed = BigInt(value);
  if (!isCanonicalCoordinate(parsed)) {
    return { ok: false, reason: 'COORDINATE_OUT_OF_BOUNDS', detail: `${path}: ${value} lies outside the canonical coordinate bound` };
  }
  return { ok: true, value: parsed };
}

/** Builds a canonical address from exact coordinates, refusing anything outside the bound. */
export function canonicalWorldAddress(x: bigint, y: bigint): OsdapDecode {
  if (!isCanonicalCoordinate(x)) return { ok: false, reason: 'COORDINATE_OUT_OF_BOUNDS', detail: `x: ${x.toString(10)} lies outside the canonical coordinate bound` };
  if (!isCanonicalCoordinate(y)) return { ok: false, reason: 'COORDINATE_OUT_OF_BOUNDS', detail: `y: ${y.toString(10)} lies outside the canonical coordinate bound` };
  return { ok: true, address: Object.freeze({ scheme: OSDAP_V1_SCHEME, x, y }) };
}

/**
 * Decodes a scheme-bearing canonical address, e.g. the value carried inside an opaque
 * `WORLD_ANCHOR` reference. The scheme is validated exactly: an unknown scheme is refused,
 * never coerced to v1.
 */
export function decodeCanonicalWorldAddress(raw: unknown): OsdapDecode {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'MALFORMED_ADDRESS', detail: 'address: must be a plain record of { scheme, x, y }' };
  }
  const record = raw as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 3 || keys[0] !== 'scheme' || keys[1] !== 'x' || keys[2] !== 'y') {
    return { ok: false, reason: 'MALFORMED_ADDRESS', detail: `address: exactly { scheme, x, y }, got { ${keys.join(', ')} }` };
  }
  if (record.scheme !== OSDAP_V1_SCHEME) {
    return { ok: false, reason: 'UNKNOWN_SCHEME', detail: `address.scheme: expected ${OSDAP_V1_SCHEME}, got ${String(record.scheme)}` };
  }
  const x = parseCanonicalCoordinate(record.x, 'address.x');
  if (!x.ok) return x;
  const y = parseCanonicalCoordinate(record.y, 'address.y');
  if (!y.ok) return y;
  return canonicalWorldAddress(x.value, y.value);
}

/**
 * Decodes the ONE permanent Home of an Established Thread as disclosed by `V`. The disclosure
 * carries no scheme field because the whole world encoding is `QANDEEL_OSDAP_V1`; the scheme is
 * therefore asserted here rather than read, and the coordinate bound is enforced fail-closed.
 */
export function decodeDisclosedHome(home: DisclosedHome, path = 'home'): OsdapDecode {
  const x = parseCanonicalCoordinate(home?.x, `${path}.x`);
  if (!x.ok) return x;
  const y = parseCanonicalCoordinate(home?.y, `${path}.y`);
  if (!y.ok) return y;
  return canonicalWorldAddress(x.value, y.value);
}

export function worldAddressEquals(a: CanonicalWorldAddress, b: CanonicalWorldAddress): boolean {
  return a.scheme === b.scheme && a.x === b.x && a.y === b.y;
}

/** A deterministic, collision-free key over the exact canonical placement (`scheme + x + y`). */
export function worldAddressKey(address: CanonicalWorldAddress): string {
  return `${address.scheme}|${canonicalCoordinateText(address.x)}|${canonicalCoordinateText(address.y)}`;
}
