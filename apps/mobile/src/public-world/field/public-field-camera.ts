/**
 * S5-03B — the Public semantic field's camera POLICY.
 *
 * Phase 2: the Public field is the Living Analysis World itself, so its camera is a world camera and every piece of its
 * math is the Map's own — the exact integer address type, the projection, the footprint and the pan (`../../map/camera`),
 * and the frozen Semantic Zoom reinforcement (one step is exactly eight times, `reinforcedScale`). What remains here is
 * only what is Public: its three rungs, where the World as a whole is seen from, how focus lands and which place is the
 * nearest. It holds nothing of the Personal Map's semantics: no `MC`, no store, no Personal rung, no Temporal Context.
 * A Public camera is created, moved and discarded by the Public field alone, so it can neither inherit nor overwrite a
 * Personal or Shared camera, focus or time.
 *
 * Depth is DISCLOSURE, in the Public field's own three-rung vocabulary (frozen for S5-03B):
 *
 *   FAR   the World as a semantic field: placement as mass; individual Experiences are not the reading;
 *   MID   individual Experiences become legible spatial objects; the field stays primary;
 *   NEAR  one Experience has focus and the contextual panel may disclose it.
 *
 * The metric is the World's, not the content's (D1): FAR is the Map's default presentation scale (`DEFAULT_MAP_SCALE`),
 * and MID / NEAR are one and two ×8 reinforcements in, so the material reads FAR / MID / NEAR exactly as the Personal
 * Map's does. No camera is fitted to how many Experiences there are: the World has the same physics with none, five or
 * five thousand. World units are a presentation spacing convention only; semantic nearness is the placer's alone.
 */
import { DEFAULT_MAP_SCALE, WORLD_ORIGIN, panFromTranslation, reinforcedScale } from '../../map/camera';
import { absBigInt, type CanonicalWorldAddress, type MapScale } from '../../map/world';

export const PUBLIC_FIELD_DEPTHS = Object.freeze(['FAR', 'MID', 'NEAR'] as const);
export type PublicFieldDepth = (typeof PUBLIC_FIELD_DEPTHS)[number];

export interface PublicFieldCamera {
  readonly anchor: CanonicalWorldAddress;
  readonly scale: MapScale;
  readonly depth: PublicFieldDepth;
}

/**
 * The Public field's own coordinate space (`QANDEEL_PUBLIC_FIELD_V1`, exactly the server's): exact signed integers within
 * the same bound the Map's exact world math handles, so its address type and projection apply unchanged.
 */
export const PUBLIC_FIELD_MIN_COORD: bigint = -(2n ** 62n);
export const PUBLIC_FIELD_MAX_COORD: bigint = 2n ** 62n - 1n;

/** Each rung's scale: the Map's default at FAR, one frozen ×8 reinforcement per rung in. */
const MID_SCALE = reinforcedScale(DEFAULT_MAP_SCALE, 'IN');
export const PUBLIC_FIELD_RUNG_SCALE: Readonly<Record<PublicFieldDepth, MapScale>> = Object.freeze({
  FAR: DEFAULT_MAP_SCALE,
  MID: MID_SCALE,
  NEAR: reinforcedScale(MID_SCALE, 'IN'),
});

/** The World as a whole: FAR, from the World's origin — the same viewpoint whatever the World holds. */
export function wholeWorldCamera(): PublicFieldCamera {
  return Object.freeze({ anchor: WORLD_ORIGIN, scale: PUBLIC_FIELD_RUNG_SCALE.FAR, depth: 'FAR' as const });
}

export type PublicFieldMove =
  | { readonly outcome: 'MOVED'; readonly camera: PublicFieldCamera }
  | { readonly outcome: 'NO_MOVEMENT' | 'AT_BOUNDARY' | 'BEYOND_CANONICAL_BOUND' | 'INVALID_INPUT' };

/** One completed drag, by the Map's own pan: the camera moves against the content's translation. Depth is untouched. */
export function panField(camera: PublicFieldCamera, translationX: number, translationY: number): PublicFieldMove {
  const pan = panFromTranslation(camera, translationX, translationY);
  if (pan.outcome !== 'INTENT') return { outcome: pan.outcome };
  return { outcome: 'MOVED', camera: Object.freeze({ ...camera, anchor: pan.anchor }) };
}

/**
 * One Semantic Zoom step. IN discloses more about the same place; OUT, less. NEAR is focus, so the step into it lands on
 * the given Experience (the caller passes the place it chose); without one there is no act. OUT of NEAR releases focus.
 */
export function zoomField(camera: PublicFieldCamera, direction: 'IN' | 'OUT', focus: CanonicalWorldAddress | null = null): PublicFieldMove {
  const at = (anchor: CanonicalWorldAddress, depth: PublicFieldDepth): PublicFieldMove =>
    ({ outcome: 'MOVED', camera: Object.freeze({ anchor, scale: PUBLIC_FIELD_RUNG_SCALE[depth], depth }) });
  if (direction === 'IN') {
    if (camera.depth === 'FAR') return at(camera.anchor, 'MID');
    if (camera.depth === 'MID' && focus !== null) return at(focus, 'NEAR');
    return { outcome: 'AT_BOUNDARY' };
  }
  if (camera.depth === 'NEAR') return at(camera.anchor, 'MID');
  if (camera.depth === 'MID') return at(camera.anchor, 'FAR');
  return { outcome: 'AT_BOUNDARY' };
}

/** Focus one Experience: the camera lands on its place at NEAR, from whatever depth the reader was at. */
export function focusField(place: CanonicalWorldAddress): PublicFieldCamera {
  return Object.freeze({ anchor: place, scale: PUBLIC_FIELD_RUNG_SCALE.NEAR, depth: 'NEAR' as const });
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

