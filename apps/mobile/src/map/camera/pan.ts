/**
 * T-04 — gesture and non-drag interpretation for the frozen `PAN` act.
 *
 * T-02 owns the state transition; this module owns the mapping from an input to an authorized
 * world-anchor intent, and it is the only place that mapping exists. What it must never do is
 * exactly what it does not do:
 *
 *   - it emits no temporal action and there is no Live Focus action to emit;
 *   - it produces ONE canonical camera intent per completed input, never one per animation or
 *     gesture frame, so a drag can never fill RH with frames;
 *   - a cancelled or interrupted input yields nothing at all — no intent, no transaction, no
 *     checkpoint, no invented semantics;
 *   - a movement that rounds to no world displacement yields nothing, so a tap-sized jitter is
 *     not a Product act;
 *   - a movement that would leave the canonical coordinate bound is refused, never clamped into
 *     a fake position.
 *
 * The in-progress translation of a live drag is Class C / D presentation progress. It belongs to
 * the renderer's transform, never to the canonical store, and it is discarded on cancellation.
 */
import type { PanIntent } from '../../state';
import { canonicalWorldAddress, worldAnchorRef, type CanonicalWorldAddress } from '../world';
import type { MapCamera } from './camera';
import { safeAreaHeight, safeAreaWidth, worldDeltaForPoints, type ViewportEnvelope } from './viewport';

/** The four non-drag viewport exploration directions. They move the camera, nothing else. */
export const VIEWPORT_EXPLORATION_DIRECTIONS = Object.freeze(['LEFT', 'RIGHT', 'UP', 'DOWN'] as const);
export type ViewportExplorationDirection = (typeof VIEWPORT_EXPLORATION_DIRECTIONS)[number];

/** One exploration step moves the camera by a third of the safe area: a legible, reversible step. */
export const EXPLORATION_STEP_NUMERATOR = 1;
export const EXPLORATION_STEP_DENOMINATOR = 3;

export type PanResolution =
  | { readonly outcome: 'INTENT'; readonly intent: PanIntent; readonly anchor: CanonicalWorldAddress }
  | { readonly outcome: 'NO_MOVEMENT' }
  | { readonly outcome: 'BEYOND_CANONICAL_BOUND' }
  | { readonly outcome: 'INVALID_INPUT' };

function resolve(camera: MapCamera, deltaX: bigint, deltaY: bigint): PanResolution {
  if (deltaX === 0n && deltaY === 0n) return { outcome: 'NO_MOVEMENT' };
  const moved = canonicalWorldAddress(camera.anchor.x + deltaX, camera.anchor.y + deltaY);
  if (!moved.ok) return { outcome: 'BEYOND_CANONICAL_BOUND' };
  // `PAN` writes `MC.anchor` and, when one is supplied, `MC.destination`. A pan is exploration,
  // not a landing, so it never supplies a destination.
  return { outcome: 'INTENT', intent: { anchor: worldAnchorRef(moved.address) }, anchor: moved.address };
}

/**
 * Interprets a completed drag. `translationX` / `translationY` are the total displacement of the
 * *content* in presentation points, as the gesture reports it; the camera moves against it.
 */
export function panFromTranslation(camera: MapCamera, translationX: number, translationY: number): PanResolution {
  if (!Number.isFinite(translationX) || !Number.isFinite(translationY)) return { outcome: 'INVALID_INPUT' };
  const deltaX = -worldDeltaForPoints(camera, translationX);
  // The canonical orientation is world `+y` up: content dragged down moves the camera up.
  const deltaY = worldDeltaForPoints(camera, translationY);
  return resolve(camera, deltaX, deltaY);
}

/**
 * The non-drag route: one authorized `PAN` per activation, so essential Map movement never
 * depends on a drag. Identical in every respect to the drag route except for where the points
 * came from — the same act, the same authority, the same single RH checkpoint.
 */
export function panFromExplorationStep(
  camera: MapCamera,
  envelope: ViewportEnvelope,
  direction: ViewportExplorationDirection,
  fractionNumerator: number = EXPLORATION_STEP_NUMERATOR,
  fractionDenominator: number = EXPLORATION_STEP_DENOMINATOR,
): PanResolution {
  if (!Number.isFinite(fractionNumerator) || !Number.isFinite(fractionDenominator) || fractionDenominator === 0) {
    return { outcome: 'INVALID_INPUT' };
  }
  const horizontal = direction === 'LEFT' || direction === 'RIGHT';
  const span = horizontal ? safeAreaWidth(envelope) : safeAreaHeight(envelope);
  const step = worldDeltaForPoints(camera, (span * fractionNumerator) / fractionDenominator);
  switch (direction) {
    case 'LEFT':
      return resolve(camera, -step, 0n);
    case 'RIGHT':
      return resolve(camera, step, 0n);
    case 'UP':
      return resolve(camera, 0n, step);
    case 'DOWN':
      return resolve(camera, 0n, -step);
    default: {
      const exhaustive: never = direction;
      return exhaustive;
    }
  }
}
