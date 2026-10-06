/**
 * S5-03B — the Public semantic field's own camera.
 *
 * It reuses the Map's exact WORLD primitives as presentation math — the exact integer address type, the exact `MapScale`
 * ratio (world units per point, clamped to the Map's representable band) and the frozen Semantic Zoom reinforcement (one
 * step is exactly eight times) — over the Public field's OWN coordinate space (`QANDEEL_PUBLIC_FIELD_V1`, the same exact
 * integer bound; never the Personal World's Home scheme), and nothing of the Personal Map's semantics: no `MC`, no store, no Session, no Thread, no
 * `SemanticDepth` rung, no Temporal Context, no RH. A Public camera is created, moved and discarded by the Public field
 * alone, so it can neither inherit nor overwrite a Personal or Shared camera, focus or time.
 *
 * Depth is DISCLOSURE, in the Public field's own three-rung vocabulary (frozen for S5-03B):
 *
 *   FAR   the World as a semantic field: placement as mass; individual Experiences are not the reading;
 *   MID   individual Experiences become legible spatial objects; the field stays primary;
 *   NEAR  one Experience has focus and the contextual panel may disclose it.
 *
 * A depth step carries its geometric reinforcement, but the depth is the authority: no reader derives a rung from a
 * magnitude. Coordinates are exact `bigint` until the last, camera-relative step; a screen point is presentation and is
 * never written back. Nothing here animates, so reduced motion and full motion are the same camera.
 */
import { SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR, SEMANTIC_ZOOM_REINFORCEMENT_NUMERATOR } from '../../map/camera/zoom';
import {
  absBigInt, canonicalWorldAddress, clampBigInt, clampedMapScale, ratioToFinite, roundDiv, scaleBy,
  worldAddressEquals, type CanonicalWorldAddress, type MapScale,
} from '../../map/world';

export const PUBLIC_FIELD_DEPTHS = Object.freeze(['FAR', 'MID', 'NEAR'] as const);
export type PublicFieldDepth = (typeof PUBLIC_FIELD_DEPTHS)[number];

export interface PublicFieldCamera {
  readonly anchor: CanonicalWorldAddress;
  readonly scale: MapScale;
  readonly depth: PublicFieldDepth;
}

/** The presentation size of the field, in points. Class D: never stored, never sent. */
export interface PublicFieldSize { readonly width: number; readonly height: number }
export interface PublicFieldPoint { readonly x: number; readonly y: number }

/**
 * The Public field's own coordinate space (`QANDEEL_PUBLIC_FIELD_V1`, exactly the server's): exact signed integers within
 * the same bound the Map's exact world math handles, so its address type and projection apply unchanged.
 */
export const PUBLIC_FIELD_MIN_COORD: bigint = -(2n ** 62n);
export const PUBLIC_FIELD_MAX_COORD: bigint = 2n ** 62n - 1n;

/** Sub-point capture, exactly the Map's: a float quantity of points becomes exact before it touches the world. */
const POINT_SUBDIVISION = 1024n;
const FINITE_LIMIT_POINTS = 2n ** 40n;
/** The smallest span a fitted World frames, so one Experience is a place in a field, not a full-screen object. */
export const PUBLIC_FIELD_MIN_SPAN = 2n ** 24n;

const exactPoints = (points: number): bigint => BigInt(Math.round(points * Number(POINT_SUBDIVISION)));
const worldDelta = (scale: MapScale, points: number): bigint =>
  roundDiv(exactPoints(points) * scale.numerator, POINT_SUBDIVISION * scale.denominator);

export function isFieldSize(size: PublicFieldSize | null): size is PublicFieldSize {
  return size !== null && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;
}

/** Where one canonical address is drawn, or null when it is not finitely representable from this camera. */
export function projectToField(camera: PublicFieldCamera, size: PublicFieldSize, address: CanonicalWorldAddress): PublicFieldPoint | null {
  const dx = ratioToFinite((address.x - camera.anchor.x) * camera.scale.denominator, camera.scale.numerator, FINITE_LIMIT_POINTS);
  const dy = ratioToFinite((address.y - camera.anchor.y) * camera.scale.denominator, camera.scale.numerator, FINITE_LIMIT_POINTS);
  if (dx === null || dy === null) return null;
  // World +y is up; screen y runs against it — the Map's canonical orientation.
  return { x: size.width / 2 + dx, y: size.height / 2 - dy };
}

/** The canonical address under a screen point, or null outside the canonical bound (never clamped into one). */
export function unprojectFromField(camera: PublicFieldCamera, size: PublicFieldSize, point: PublicFieldPoint): CanonicalWorldAddress | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const address = canonicalWorldAddress(camera.anchor.x + worldDelta(camera.scale, point.x - size.width / 2),
    camera.anchor.y - worldDelta(camera.scale, point.y - size.height / 2));
  return address.ok ? address.address : null;
}

/** The world rectangle the field currently shows — a derived cull / request rectangle, clamped to the canonical bound. */
export function fieldFootprint(camera: PublicFieldCamera, size: PublicFieldSize): { minX: bigint; minY: bigint; maxX: bigint; maxY: bigint } {
  const halfWidth = worldDelta(camera.scale, size.width / 2);
  const halfHeight = worldDelta(camera.scale, size.height / 2);
  return {
    minX: clampBigInt(camera.anchor.x - halfWidth, PUBLIC_FIELD_MIN_COORD, PUBLIC_FIELD_MAX_COORD),
    maxX: clampBigInt(camera.anchor.x + halfWidth, PUBLIC_FIELD_MIN_COORD, PUBLIC_FIELD_MAX_COORD),
    minY: clampBigInt(camera.anchor.y - halfHeight, PUBLIC_FIELD_MIN_COORD, PUBLIC_FIELD_MAX_COORD),
    maxY: clampBigInt(camera.anchor.y + halfHeight, PUBLIC_FIELD_MIN_COORD, PUBLIC_FIELD_MAX_COORD),
  };
}

/**
 * The World as a whole, at FAR: centred on the places it holds and framing all of them. Derived from the places alone,
 * never from activity or time. An empty World is framed at its origin.
 */
export function fittedCamera(addresses: ReadonlyArray<CanonicalWorldAddress>, size: PublicFieldSize): PublicFieldCamera {
  const origin = canonicalWorldAddress(0n, 0n);
  if (!origin.ok) throw new RangeError('the world origin must be canonical');
  if (addresses.length === 0) {
    return Object.freeze({ anchor: origin.address, scale: clampedMapScale(PUBLIC_FIELD_MIN_SPAN, BigInt(Math.max(1, Math.round(Math.min(size.width, size.height))))), depth: 'FAR' as const });
  }
  let minX = addresses[0].x; let maxX = minX; let minY = addresses[0].y; let maxY = minY;
  for (const a of addresses) {
    if (a.x < minX) minX = a.x; if (a.x > maxX) maxX = a.x;
    if (a.y < minY) minY = a.y; if (a.y > maxY) maxY = a.y;
  }
  const center = canonicalWorldAddress(roundDiv(minX + maxX, 2n), roundDiv(minY + maxY, 2n));
  if (!center.ok) throw new RangeError('a centre of canonical addresses is canonical');
  const spanX = maxX - minX; const spanY = maxY - minY;
  const span = [spanX, spanY, PUBLIC_FIELD_MIN_SPAN].reduce((a, b) => (b > a ? b : a));
  // A quarter of margin so no place sits on the glass edge.
  const points = BigInt(Math.max(1, Math.round(Math.min(size.width, size.height))));
  return Object.freeze({ anchor: center.address, scale: clampedMapScale(span * 5n, points * 4n), depth: 'FAR' as const });
}

export type PublicFieldMove =
  | { readonly outcome: 'MOVED'; readonly camera: PublicFieldCamera }
  | { readonly outcome: 'NO_MOVEMENT' | 'AT_BOUNDARY' | 'BEYOND_CANONICAL_BOUND' | 'INVALID_INPUT' };

/** One completed drag: the camera moves against the content's translation. Depth and focus are untouched. */
export function panField(camera: PublicFieldCamera, translationX: number, translationY: number): PublicFieldMove {
  if (!Number.isFinite(translationX) || !Number.isFinite(translationY)) return { outcome: 'INVALID_INPUT' };
  const dx = -worldDelta(camera.scale, translationX);
  const dy = worldDelta(camera.scale, translationY);
  if (dx === 0n && dy === 0n) return { outcome: 'NO_MOVEMENT' };
  const moved = canonicalWorldAddress(camera.anchor.x + dx, camera.anchor.y + dy);
  if (!moved.ok) return { outcome: 'BEYOND_CANONICAL_BOUND' };
  return { outcome: 'MOVED', camera: Object.freeze({ ...camera, anchor: moved.address }) };
}

const finer = (scale: MapScale): MapScale => scaleBy(scale, SEMANTIC_ZOOM_REINFORCEMENT_NUMERATOR, SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR);
const coarser = (scale: MapScale): MapScale => scaleBy(scale, SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR, SEMANTIC_ZOOM_REINFORCEMENT_NUMERATOR);

/**
 * One Semantic Zoom step. IN discloses more about the same place; OUT, less. NEAR is focus, so the step into it lands on
 * the given Experience (the caller passes the place it chose); without one there is no act. OUT of NEAR releases focus.
 */
export function zoomField(camera: PublicFieldCamera, direction: 'IN' | 'OUT', focus: CanonicalWorldAddress | null = null): PublicFieldMove {
  if (direction === 'IN') {
    if (camera.depth === 'FAR') return { outcome: 'MOVED', camera: Object.freeze({ ...camera, scale: finer(camera.scale), depth: 'MID' as const }) };
    if (camera.depth === 'MID' && focus !== null) return { outcome: 'MOVED', camera: Object.freeze({ anchor: focus, scale: finer(camera.scale), depth: 'NEAR' as const }) };
    return { outcome: 'AT_BOUNDARY' };
  }
  if (camera.depth === 'NEAR') return { outcome: 'MOVED', camera: Object.freeze({ ...camera, scale: coarser(camera.scale), depth: 'MID' as const }) };
  if (camera.depth === 'MID') return { outcome: 'MOVED', camera: Object.freeze({ ...camera, scale: coarser(camera.scale), depth: 'FAR' as const }) };
  return { outcome: 'AT_BOUNDARY' };
}

/** Focus one Experience: the camera lands on its place at NEAR, from whatever depth the reader was at. */
export function focusField(camera: PublicFieldCamera, place: CanonicalWorldAddress): PublicFieldCamera {
  let scale = camera.scale;
  if (camera.depth === 'FAR') scale = finer(finer(scale));
  else if (camera.depth === 'MID') scale = finer(scale);
  return Object.freeze({ anchor: place, scale, depth: 'NEAR' as const });
}

/** The place nearest the camera's anchor among those given, by exact distance; null for none. */
export function nearestTo(anchor: CanonicalWorldAddress, places: ReadonlyArray<{ readonly id: string; readonly address: CanonicalWorldAddress }>): string | null {
  let best: { id: string; d: bigint } | null = null;
  for (const place of places) {
    const dx = absBigInt(place.address.x - anchor.x); const dy = absBigInt(place.address.y - anchor.y);
    const d = dx * dx + dy * dy;
    if (best === null || d < best.d || (d === best.d && place.id < best.id)) best = { id: place.id, d };
  }
  return best?.id ?? null;
}

export function sameCamera(a: PublicFieldCamera | null, b: PublicFieldCamera | null): boolean {
  if (a === null || b === null) return a === b;
  return worldAddressEquals(a.anchor, b.anchor) && a.scale.numerator === b.scale.numerator && a.scale.denominator === b.scale.denominator
    && a.depth === b.depth;
}
