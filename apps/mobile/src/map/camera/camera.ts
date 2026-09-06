/**
 * T-04 — the concrete camera behind T-02's abstract `MC` intent.
 *
 * `MC` is canonical navigation intent: a world anchor, an orientation, a scale intent, the
 * semantic depth and an authorized spatial destination. This module is the exact, total
 * translation between that opaque intent and a usable camera — and nothing more. In
 * particular it holds no width, height, aspect ratio, safe-area inset, pixel ratio, visible
 * footprint, animation progress or gesture state: those are the presentation envelope, they are
 * Class D, and they live in `viewport.ts`, outside canonical state and outside `Φ_eff`.
 *
 * A camera that cannot be decoded is refused. It is never "repaired" with a default, because a
 * silently repaired camera is a camera that moved without a user act.
 */
import type { CameraIntent, SemanticDepth } from '../../state';
import {
  CANONICAL_MAP_ORIENTATION,
  canonicalWorldAddress,
  clampedMapScale,
  decodeScaleIntentRef,
  decodeSpatialDestinationRef,
  decodeWorldAnchorRef,
  decodeWorldOrientationRef,
  mapOrientationEquals,
  scaleIntentRef,
  spatialDestinationRef,
  worldAnchorRef,
  worldOrientationRef,
  type CanonicalWorldAddress,
  type MapDestination,
  type MapOrientation,
  type MapScale,
} from '../world';

export interface MapCamera {
  readonly anchor: CanonicalWorldAddress;
  readonly orientation: MapOrientation;
  readonly scale: MapScale;
  readonly depth: SemanticDepth;
  /** The authorized locus the camera was last landed on, or `null` when it was merely panned. */
  readonly destination: MapDestination | null;
}

export type CameraDecode =
  | { readonly ok: true; readonly camera: MapCamera }
  | { readonly ok: false; readonly detail: string };

/**
 * The v1 default presentation scale: `8192` world units per point. Chosen so that the canonical
 * Home step (`1_000_000` world units) is roughly 122 points, i.e. a handful of Established
 * Thread Homes are simultaneously visible on a phone. It is an engineering default of the
 * presentation transform; it states nothing about the world.
 */
export const DEFAULT_WORLD_UNITS_PER_POINT_NUMERATOR = 8192n;
export const DEFAULT_WORLD_UNITS_PER_POINT_DENOMINATOR = 1n;

export const DEFAULT_MAP_SCALE: MapScale = clampedMapScale(
  DEFAULT_WORLD_UNITS_PER_POINT_NUMERATOR,
  DEFAULT_WORLD_UNITS_PER_POINT_DENOMINATOR,
);

/** The world origin. A starting viewpoint, never a Home and never a Product landmark. */
export const WORLD_ORIGIN: CanonicalWorldAddress = (() => {
  const origin = canonicalWorldAddress(0n, 0n);
  if (!origin.ok) throw new RangeError('the world origin must be a canonical coordinate');
  return origin.address;
})();

export function decodeCameraIntent(intent: CameraIntent): CameraDecode {
  const anchor = decodeWorldAnchorRef(intent.anchor);
  if (!anchor.ok) return { ok: false, detail: anchor.detail };
  const scale = decodeScaleIntentRef(intent.scale);
  if (!scale.ok) return { ok: false, detail: scale.detail };
  let orientation: MapOrientation = CANONICAL_MAP_ORIENTATION;
  if (intent.orientation !== undefined) {
    const decoded = decodeWorldOrientationRef(intent.orientation);
    if (!decoded.ok) return { ok: false, detail: decoded.detail };
    orientation = decoded.value;
  }
  let destination: MapDestination | null = null;
  if (intent.destination !== undefined) {
    const decoded = decodeSpatialDestinationRef(intent.destination);
    if (!decoded.ok) return { ok: false, detail: decoded.detail };
    destination = decoded.value;
  }
  return { ok: true, camera: Object.freeze({ anchor: anchor.address, orientation, scale: scale.value, depth: intent.depth, destination }) };
}

/**
 * Encodes a camera back into `MC` intent. Orientation and destination are written only when
 * they exist, so an intent never gains an optional key it did not have.
 */
export function encodeCameraIntent(camera: MapCamera): CameraIntent {
  const base: CameraIntent = {
    anchor: worldAnchorRef(camera.anchor),
    scale: scaleIntentRef(camera.scale),
    depth: camera.depth,
  };
  // The canonical orientation is the absence of an orientation key, so that encoding and
  // decoding round-trip exactly and `Φ_eff` never sees a spurious change.
  const oriented: CameraIntent = mapOrientationEquals(camera.orientation, CANONICAL_MAP_ORIENTATION)
    ? base
    : { ...base, orientation: worldOrientationRef(camera.orientation) };
  return camera.destination === null ? oriented : { ...oriented, destination: spatialDestinationRef(camera.destination) };
}

/**
 * The initial `MC` intent of a Map that has not been navigated yet: the world origin, the
 * canonical orientation, the default presentation scale and the `WORLD` rung. It carries no
 * destination, because no locus has been authorized.
 */
export function initialCameraIntent(
  anchor: CanonicalWorldAddress = WORLD_ORIGIN,
  scale: MapScale = DEFAULT_MAP_SCALE,
  depth: SemanticDepth = 'WORLD',
): CameraIntent {
  return { anchor: worldAnchorRef(anchor), scale: scaleIntentRef(scale), depth };
}
