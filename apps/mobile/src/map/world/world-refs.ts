/**
 * T-04 — the concrete encodings behind T-02's opaque camera and locus references.
 *
 * T-02 froze `WorldAnchorRef`, `WorldOrientationRef`, `ScaleIntentRef` and
 * `SpatialDestinationRef` as opaque `{ kind, value }` wrappers and said the owning task defines
 * the encoding. This module is that definition, and it is the only place that reads or writes
 * one. Three rules hold for every encoding here:
 *
 *   1. every canonical quantity crosses as exact integer text, never as a float;
 *   2. every scheme is validated exactly, so a value minted under a different encoding is
 *      refused rather than reinterpreted;
 *   3. nothing device-shaped — width, height, aspect, insets, pixel ratio, a footprint — can be
 *      expressed here, because the presentation envelope is Class D and never enters `MC`.
 *
 * Scale is a ratio of exact integers (`world units per point`), not a float multiplier, so a
 * semantic-depth reinforcement, a direct-jump landing and a restored checkpoint compare and
 * reproduce exactly. Scale is a presentation reinforcement of a depth change; it is never the
 * semantic authority, and no reader of this module may treat a magnitude as disclosure.
 */
import {
  opaqueRef,
  type ScaleIntentRef,
  type SpatialDestinationRef,
  type WorldAnchorRef,
  type WorldOrientationRef,
} from '../../state';
import { gcdBigInt } from './exact-math';
import {
  canonicalCoordinateText,
  canonicalWorldAddress,
  decodeCanonicalWorldAddress,
  parseCanonicalCoordinate,
  type CanonicalWorldAddress,
  type OsdapDecode,
} from './osdap';

export type WorldRefRejectionReason =
  | 'MALFORMED_REFERENCE'
  | 'UNKNOWN_SCHEME'
  | 'MALFORMED_VALUE'
  | 'OUT_OF_BOUNDS';

export type WorldRefDecode<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: WorldRefRejectionReason; readonly detail: string };

function record(raw: unknown, path: string, keys: readonly string[]): WorldRefDecode<Record<string, unknown>> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'MALFORMED_REFERENCE', detail: `${path}: must be a plain record` };
  }
  const value = raw as Record<string, unknown>;
  const present = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (present.length !== expected.length || present.some((key, index) => key !== expected[index])) {
    return { ok: false, reason: 'MALFORMED_REFERENCE', detail: `${path}: exactly { ${expected.join(', ')} }, got { ${present.join(', ')} }` };
  }
  return { ok: true, value };
}

// ------------------------------------------------------------------------------------------
// WORLD_ANCHOR — one exact canonical world address
// ------------------------------------------------------------------------------------------

export function worldAnchorRef(address: CanonicalWorldAddress): WorldAnchorRef {
  return opaqueRef('WORLD_ANCHOR', {
    scheme: address.scheme,
    x: canonicalCoordinateText(address.x),
    y: canonicalCoordinateText(address.y),
  });
}

export function decodeWorldAnchorRef(ref: WorldAnchorRef): OsdapDecode {
  if (typeof ref?.value === 'string') {
    return { ok: false, reason: 'MALFORMED_ADDRESS', detail: 'WORLD_ANCHOR: a canonical anchor is a { scheme, x, y } record, not a string' };
  }
  return decodeCanonicalWorldAddress(ref?.value);
}

// ------------------------------------------------------------------------------------------
// WORLD_ORIENTATION — the single canonical upright orientation of v1
// ------------------------------------------------------------------------------------------

export const MAP_ORIENTATION_SCHEME = 'QANDEEL_MAP_ORIENTATION_V1' as const;

/**
 * v1 has exactly one legitimate orientation: world `+y` points up the screen. It exists as a
 * declared value rather than an assumption so that a later orientation (if any frozen authority
 * ever grants one) is a new member of a closed vocabulary, not a silent reinterpretation of
 * every stored camera.
 */
export const MAP_ORIENTATION_UP_AXES = Object.freeze(['WORLD_Y_UP'] as const);
export type MapOrientationUpAxis = (typeof MAP_ORIENTATION_UP_AXES)[number];

export interface MapOrientation {
  readonly scheme: typeof MAP_ORIENTATION_SCHEME;
  readonly up: MapOrientationUpAxis;
}

export const CANONICAL_MAP_ORIENTATION: MapOrientation = Object.freeze({ scheme: MAP_ORIENTATION_SCHEME, up: 'WORLD_Y_UP' as const });

export function mapOrientationEquals(a: MapOrientation, b: MapOrientation): boolean {
  return a.scheme === b.scheme && a.up === b.up;
}

export function worldOrientationRef(orientation: MapOrientation = CANONICAL_MAP_ORIENTATION): WorldOrientationRef {
  return opaqueRef('WORLD_ORIENTATION', { scheme: orientation.scheme, up: orientation.up });
}

export function decodeWorldOrientationRef(ref: WorldOrientationRef): WorldRefDecode<MapOrientation> {
  const decoded = record(ref?.value, 'WORLD_ORIENTATION', ['scheme', 'up']);
  if (!decoded.ok) return decoded;
  if (decoded.value.scheme !== MAP_ORIENTATION_SCHEME) {
    return { ok: false, reason: 'UNKNOWN_SCHEME', detail: `WORLD_ORIENTATION.scheme: expected ${MAP_ORIENTATION_SCHEME}, got ${String(decoded.value.scheme)}` };
  }
  const up = decoded.value.up;
  if (typeof up !== 'string' || !(MAP_ORIENTATION_UP_AXES as readonly string[]).includes(up)) {
    return { ok: false, reason: 'MALFORMED_VALUE', detail: `WORLD_ORIENTATION.up: must be one of ${MAP_ORIENTATION_UP_AXES.join(', ')}` };
  }
  return { ok: true, value: Object.freeze({ scheme: MAP_ORIENTATION_SCHEME, up: up as MapOrientationUpAxis }) };
}

// ------------------------------------------------------------------------------------------
// SCALE_INTENT — exact world units per presentation point
// ------------------------------------------------------------------------------------------

export const MAP_SCALE_SCHEME = 'QANDEEL_MAP_SCALE_V1' as const;

/** `worldUnitsPerPoint = numerator / denominator`, both strictly positive and fully reduced. */
export interface MapScale {
  readonly scheme: typeof MAP_SCALE_SCHEME;
  readonly numerator: bigint;
  readonly denominator: bigint;
}

/**
 * Engineering bounds of the presentation scale, not a Product statement about how far anyone may
 * zoom: the world itself is unbounded within the OSDAP coordinate bound. They exist so that a
 * scale can never reach zero, negative or an unrepresentable magnitude.
 */
export const MIN_WORLD_UNITS_PER_POINT_NUMERATOR = 1n;
export const MIN_WORLD_UNITS_PER_POINT_DENOMINATOR = 1024n;
export const MAX_WORLD_UNITS_PER_POINT_NUMERATOR = 2n ** 40n;
export const MAX_WORLD_UNITS_PER_POINT_DENOMINATOR = 1n;

export function mapScale(numerator: bigint, denominator: bigint): WorldRefDecode<MapScale> {
  if (numerator <= 0n || denominator <= 0n) {
    return { ok: false, reason: 'MALFORMED_VALUE', detail: 'SCALE_INTENT: world units per point must be a strictly positive ratio' };
  }
  const divisor = gcdBigInt(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  if (n * MIN_WORLD_UNITS_PER_POINT_DENOMINATOR < MIN_WORLD_UNITS_PER_POINT_NUMERATOR * d) {
    return { ok: false, reason: 'OUT_OF_BOUNDS', detail: 'SCALE_INTENT: below the finest representable presentation scale' };
  }
  if (n * MAX_WORLD_UNITS_PER_POINT_DENOMINATOR > MAX_WORLD_UNITS_PER_POINT_NUMERATOR * d) {
    return { ok: false, reason: 'OUT_OF_BOUNDS', detail: 'SCALE_INTENT: above the coarsest representable presentation scale' };
  }
  return { ok: true, value: Object.freeze({ scheme: MAP_SCALE_SCHEME, numerator: n, denominator: d }) };
}

/** Clamps a ratio into the representable band instead of failing; used only by zoom reinforcement. */
export function clampedMapScale(numerator: bigint, denominator: bigint): MapScale {
  const positiveNumerator = numerator <= 0n ? 1n : numerator;
  const positiveDenominator = denominator <= 0n ? 1n : denominator;
  const direct = mapScale(positiveNumerator, positiveDenominator);
  if (direct.ok) return direct.value;
  const tooSmall = positiveNumerator * MIN_WORLD_UNITS_PER_POINT_DENOMINATOR < MIN_WORLD_UNITS_PER_POINT_NUMERATOR * positiveDenominator;
  const bound = tooSmall
    ? mapScale(MIN_WORLD_UNITS_PER_POINT_NUMERATOR, MIN_WORLD_UNITS_PER_POINT_DENOMINATOR)
    : mapScale(MAX_WORLD_UNITS_PER_POINT_NUMERATOR, MAX_WORLD_UNITS_PER_POINT_DENOMINATOR);
  // Both bounds are representable by construction; the assertion keeps the function total.
  if (!bound.ok) throw new RangeError('clampedMapScale: the representable scale band is empty');
  return bound.value;
}

export function scaleIntentRef(scale: MapScale): ScaleIntentRef {
  return opaqueRef('SCALE_INTENT', {
    scheme: scale.scheme,
    worldUnitsPerPointNumerator: canonicalCoordinateText(scale.numerator),
    worldUnitsPerPointDenominator: canonicalCoordinateText(scale.denominator),
  });
}

export function decodeScaleIntentRef(ref: ScaleIntentRef): WorldRefDecode<MapScale> {
  const decoded = record(ref?.value, 'SCALE_INTENT', ['scheme', 'worldUnitsPerPointNumerator', 'worldUnitsPerPointDenominator']);
  if (!decoded.ok) return decoded;
  if (decoded.value.scheme !== MAP_SCALE_SCHEME) {
    return { ok: false, reason: 'UNKNOWN_SCHEME', detail: `SCALE_INTENT.scheme: expected ${MAP_SCALE_SCHEME}, got ${String(decoded.value.scheme)}` };
  }
  const numerator = parseCanonicalCoordinate(decoded.value.worldUnitsPerPointNumerator, 'SCALE_INTENT.worldUnitsPerPointNumerator');
  if (!numerator.ok) return { ok: false, reason: 'MALFORMED_VALUE', detail: numerator.detail };
  const denominator = parseCanonicalCoordinate(decoded.value.worldUnitsPerPointDenominator, 'SCALE_INTENT.worldUnitsPerPointDenominator');
  if (!denominator.ok) return { ok: false, reason: 'MALFORMED_VALUE', detail: denominator.detail };
  return mapScale(numerator.value, denominator.value);
}

export function mapScaleEquals(a: MapScale, b: MapScale): boolean {
  return a.scheme === b.scheme && a.numerator === b.numerator && a.denominator === b.denominator;
}

/** Multiplies a scale by an exact ratio, clamped into the representable band. */
export function scaleBy(scale: MapScale, numerator: bigint, denominator: bigint): MapScale {
  return clampedMapScale(scale.numerator * numerator, scale.denominator * denominator);
}

// ------------------------------------------------------------------------------------------
// SPATIAL_DESTINATION — one authorized contextual locus
// ------------------------------------------------------------------------------------------

export const MAP_LOCUS_SCHEME = 'QANDEEL_MAP_LOCUS_V1' as const;

/**
 * The two legitimate loci of the v1 Map. A Thread's own permanent Home, and a contextual
 * appearance hosted by that Home. A contextual appearance has NO independent canonical
 * coordinate — it carries its host Thread's Home — because no frozen authority gives a
 * non-Thread object a canonical Home of its own.
 */
export const MAP_LOCUS_KINDS = Object.freeze(['THREAD_HOME', 'CONTEXTUAL_APPEARANCE'] as const);
export type MapLocusKind = (typeof MAP_LOCUS_KINDS)[number];

export interface MapDestination {
  readonly scheme: typeof MAP_LOCUS_SCHEME;
  readonly locus: MapLocusKind;
  readonly threadId: string;
  /** The contextual appearance's own binding identity, or `null` for a Thread's own Home. */
  readonly bindingId: string | null;
  readonly address: CanonicalWorldAddress;
}

export function mapDestination(
  locus: MapLocusKind,
  threadId: string,
  bindingId: string | null,
  address: CanonicalWorldAddress,
): WorldRefDecode<MapDestination> {
  if (typeof threadId !== 'string' || threadId.length === 0) {
    return { ok: false, reason: 'MALFORMED_VALUE', detail: 'SPATIAL_DESTINATION.threadId: must be a non-empty identity' };
  }
  if ((locus === 'CONTEXTUAL_APPEARANCE') !== (typeof bindingId === 'string' && bindingId.length > 0)) {
    return { ok: false, reason: 'MALFORMED_VALUE', detail: 'SPATIAL_DESTINATION: exactly a contextual appearance carries a binding identity' };
  }
  return { ok: true, value: Object.freeze({ scheme: MAP_LOCUS_SCHEME, locus, threadId, bindingId, address }) };
}

export function spatialDestinationRef(destination: MapDestination): SpatialDestinationRef {
  return opaqueRef('SPATIAL_DESTINATION', {
    scheme: destination.scheme,
    locus: destination.locus,
    threadId: destination.threadId,
    bindingId: destination.bindingId,
    x: canonicalCoordinateText(destination.address.x),
    y: canonicalCoordinateText(destination.address.y),
  });
}

export function decodeSpatialDestinationRef(ref: SpatialDestinationRef): WorldRefDecode<MapDestination> {
  const decoded = record(ref?.value, 'SPATIAL_DESTINATION', ['scheme', 'locus', 'threadId', 'bindingId', 'x', 'y']);
  if (!decoded.ok) return decoded;
  const value = decoded.value;
  if (value.scheme !== MAP_LOCUS_SCHEME) {
    return { ok: false, reason: 'UNKNOWN_SCHEME', detail: `SPATIAL_DESTINATION.scheme: expected ${MAP_LOCUS_SCHEME}, got ${String(value.scheme)}` };
  }
  if (typeof value.locus !== 'string' || !(MAP_LOCUS_KINDS as readonly string[]).includes(value.locus)) {
    return { ok: false, reason: 'MALFORMED_VALUE', detail: `SPATIAL_DESTINATION.locus: must be one of ${MAP_LOCUS_KINDS.join(', ')}` };
  }
  const x = parseCanonicalCoordinate(value.x, 'SPATIAL_DESTINATION.x');
  if (!x.ok) return { ok: false, reason: x.reason === 'COORDINATE_OUT_OF_BOUNDS' ? 'OUT_OF_BOUNDS' : 'MALFORMED_VALUE', detail: x.detail };
  const y = parseCanonicalCoordinate(value.y, 'SPATIAL_DESTINATION.y');
  if (!y.ok) return { ok: false, reason: y.reason === 'COORDINATE_OUT_OF_BOUNDS' ? 'OUT_OF_BOUNDS' : 'MALFORMED_VALUE', detail: y.detail };
  if (value.bindingId !== null && typeof value.bindingId !== 'string') {
    return { ok: false, reason: 'MALFORMED_VALUE', detail: 'SPATIAL_DESTINATION.bindingId: must be an identity or null' };
  }
  if (typeof value.threadId !== 'string') {
    return { ok: false, reason: 'MALFORMED_VALUE', detail: 'SPATIAL_DESTINATION.threadId: must be a non-empty identity' };
  }
  const address = canonicalWorldAddress(x.value, y.value);
  if (!address.ok) return { ok: false, reason: 'OUT_OF_BOUNDS', detail: address.detail };
  return mapDestination(value.locus as MapLocusKind, value.threadId, value.bindingId, address.address);
}
