/**
 * T-04 — the presentation envelope and the camera-relative projection.
 *
 * The envelope (width, height, aspect ratio, safe-area insets, and the visible footprint derived
 * from them) is Class D. It never enters `MC`, never enters `Φ_eff`, never appends RH and never
 * moves a canonical object. A rotation or a resize therefore recomputes what is *visible* and
 * nothing else: no recentring, no zoom-to-fit, no compaction, no redistribution, no rescue of a
 * camera that legitimately looks at empty world.
 *
 * The projection is deliberately LOCAL. A canonical address is never converted to a float:
 * the exact `bigint` delta from the camera anchor is divided by the exact scale ratio, and only
 * that camera-relative quantity becomes a finite `number`. An address far enough away that even
 * the delta is not finitely representable is reported as such rather than clamped to an edge,
 * so a wrong pixel can never be mistaken for a real position.
 */
import { clampBigInt, ratioToFinite, roundDiv, type CanonicalWorldAddress } from '../world';
import { OSDAP_MAX_COORD, OSDAP_MIN_COORD, canonicalWorldAddress } from '../world';
import type { MapCamera } from './camera';

/**
 * Sub-point resolution of the presentation transform. A gesture translation or a viewport
 * dimension is a float; it is captured exactly at 1/1024 of a point before it ever multiplies a
 * canonical quantity, so the world arithmetic stays integral.
 */
export const POINT_SUBDIVISION = 1024n;

/**
 * The finite presentation range, in points, around the camera anchor. Beyond it a projected
 * position is not representable; it is reported, never clamped.
 */
export const FINITE_PROJECTION_LIMIT_POINTS = 2n ** 40n;

export interface ViewportEnvelope {
  readonly width: number;
  readonly height: number;
  readonly insetTop: number;
  readonly insetRight: number;
  readonly insetBottom: number;
  readonly insetLeft: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** The exact world rectangle the viewport currently covers. Derived, Class D, never stored. */
export interface WorldFootprint {
  readonly minX: bigint;
  readonly minY: bigint;
  readonly maxX: bigint;
  readonly maxY: bigint;
}

export interface ViewportInsets {
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
  readonly left?: number;
}

const isFiniteNonNegative = (value: number): boolean => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Builds an envelope, refusing a non-finite or negative dimension rather than guessing one. */
export function viewportEnvelope(width: number, height: number, insets: ViewportInsets = {}): ViewportEnvelope | null {
  const top = insets.top ?? 0;
  const right = insets.right ?? 0;
  const bottom = insets.bottom ?? 0;
  const left = insets.left ?? 0;
  if (![width, height, top, right, bottom, left].every(isFiniteNonNegative)) return null;
  if (width <= 0 || height <= 0) return null;
  if (left + right >= width || top + bottom >= height) return null;
  return Object.freeze({ width, height, insetTop: top, insetRight: right, insetBottom: bottom, insetLeft: left });
}

export function safeAreaWidth(envelope: ViewportEnvelope): number {
  return envelope.width - envelope.insetLeft - envelope.insetRight;
}

export function safeAreaHeight(envelope: ViewportEnvelope): number {
  return envelope.height - envelope.insetTop - envelope.insetBottom;
}

export function envelopeAspectRatio(envelope: ViewportEnvelope): number {
  return safeAreaWidth(envelope) / safeAreaHeight(envelope);
}

/** The screen point the camera anchor is drawn at: the centre of the safe area. */
export function envelopeCenter(envelope: ViewportEnvelope): ScreenPoint {
  return {
    x: envelope.insetLeft + safeAreaWidth(envelope) / 2,
    y: envelope.insetTop + safeAreaHeight(envelope) / 2,
  };
}

/** Captures a float quantity of points exactly, at the sub-point resolution. */
export function exactPoints(points: number): bigint {
  return BigInt(Math.round(points * Number(POINT_SUBDIVISION)));
}

/** Exact world distance covered by `points` presentation points at this scale. */
export function worldDeltaForPoints(camera: MapCamera, points: number): bigint {
  return roundDiv(exactPoints(points) * camera.scale.numerator, POINT_SUBDIVISION * camera.scale.denominator);
}

/** Finite presentation distance covered by an exact world delta, or `null` when unrepresentable. */
export function pointsForWorldDelta(camera: MapCamera, delta: bigint): number | null {
  return ratioToFinite(delta * camera.scale.denominator, camera.scale.numerator, FINITE_PROJECTION_LIMIT_POINTS);
}

/**
 * Projects one canonical address into the viewport. Exact until the last step: the `bigint`
 * delta from the anchor is divided by the exact scale, and only then becomes a `number`.
 * `null` means "not finitely representable from this camera", never "at the edge".
 */
export function projectAddress(camera: MapCamera, envelope: ViewportEnvelope, address: CanonicalWorldAddress): ScreenPoint | null {
  const dx = pointsForWorldDelta(camera, address.x - camera.anchor.x);
  const dy = pointsForWorldDelta(camera, address.y - camera.anchor.y);
  if (dx === null || dy === null) return null;
  const center = envelopeCenter(envelope);
  // The canonical orientation is world `+y` up, so screen `y` runs against it.
  return { x: center.x + dx, y: center.y - dy };
}

/**
 * The inverse transform. Fails closed outside the canonical coordinate bound: a screen point
 * that would name a non-canonical coordinate is not an address, and is never clamped into one.
 */
export function unprojectPoint(camera: MapCamera, envelope: ViewportEnvelope, point: ScreenPoint): CanonicalWorldAddress | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const center = envelopeCenter(envelope);
  const x = camera.anchor.x + worldDeltaForPoints(camera, point.x - center.x);
  const y = camera.anchor.y - worldDeltaForPoints(camera, point.y - center.y);
  const address = canonicalWorldAddress(x, y);
  return address.ok ? address.address : null;
}

/**
 * The exact world rectangle currently covered by the safe area. It is a derived cull rectangle:
 * it is clamped to the canonical coordinate bound so that it stays representable, and clamping
 * it changes nothing canonical — no Home, no anchor, no scale, no depth, no RH.
 */
export function visibleFootprint(camera: MapCamera, envelope: ViewportEnvelope): WorldFootprint {
  const halfWidth = worldDeltaForPoints(camera, safeAreaWidth(envelope) / 2);
  const halfHeight = worldDeltaForPoints(camera, safeAreaHeight(envelope) / 2);
  return Object.freeze({
    minX: clampBigInt(camera.anchor.x - halfWidth, OSDAP_MIN_COORD, OSDAP_MAX_COORD),
    maxX: clampBigInt(camera.anchor.x + halfWidth, OSDAP_MIN_COORD, OSDAP_MAX_COORD),
    minY: clampBigInt(camera.anchor.y - halfHeight, OSDAP_MIN_COORD, OSDAP_MAX_COORD),
    maxY: clampBigInt(camera.anchor.y + halfHeight, OSDAP_MIN_COORD, OSDAP_MAX_COORD),
  });
}

export function isWithinFootprint(footprint: WorldFootprint, address: CanonicalWorldAddress): boolean {
  return address.x >= footprint.minX && address.x <= footprint.maxX && address.y >= footprint.minY && address.y <= footprint.maxY;
}

export function footprintEquals(a: WorldFootprint, b: WorldFootprint): boolean {
  return a.minX === b.minX && a.maxX === b.maxX && a.minY === b.minY && a.maxY === b.maxY;
}
