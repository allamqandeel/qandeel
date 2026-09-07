/**
 * T-10 — the presentation camera binding: the residual, on the UI runtime, and the four things
 * that are ever allowed to move it.
 *
 * What is canonical stays canonical. `MC` is written only by the T-04 executors, and nothing here
 * can reach a store, a dispatch, an executor or a projection. This hook owns the RESIDUAL between
 * that camera and the pixels, it writes it per frame on the UI runtime without a single React
 * render, and it has no completion callback that reaches Product truth — not one.
 *
 * The four movers, and nothing else:
 *
 *   `grab` / `dragBy`   a finger. It owns the frame completely: the running settle is cancelled,
 *                       and from then until release the plane is attached to the hand, 1:1, with
 *                       no easing and no spring arguing with it;
 *   `applyCanonicalChange`  an already-authorized canonical camera. The residual is rebased so the
 *                       frame on the glass is preserved exactly, and then resolved toward truth;
 *   `resolveToRest`     a completed input that produced NO canonical change — a cancelled drag, a
 *                       refusal, a movement too small to be an act. The presentation returns to
 *                       the camera the reader is actually at, because nothing moved;
 *   `reset`             an unmount or a surface that has no camera at all.
 *
 * Interruption is structural rather than managed. There is no queue, no pending list and no
 * "settling" state: every mover writes the same three shared values, so whatever arrives last is
 * simply what is true, starting from wherever the plane happens to be at that instant.
 */
import { useCallback, useMemo } from 'react';
import {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MOTION_DURATIONS_MS, QANDEEL_EASE_OUT, resolveFromOpacity } from '../tokens';
import type { DerivedValue, SharedValue } from '../runtime/bridge';
import {
  RESIDUAL_AT_REST,
  counterScale,
  planeTransformTriple,
  rebasedResidual,
  screenToResidual,
  type PresentationPoint,
  type PresentationResidual,
} from './residual';
import { presentationTravelPlan, type PresentationMotionCause, type PresentationTravelPlan } from './travel-plan';

const EASE_OUT = Easing.bezier(QANDEEL_EASE_OUT[0], QANDEEL_EASE_OUT[1], QANDEEL_EASE_OUT[2], QANDEEL_EASE_OUT[3]);

/**
 * The plane's transform, in the shape the graphics layer consumes.
 *
 * Declared here so no consumer has to name either the graphics package or the animation package:
 * the Map receives an already-typed value through a relative import and its own dependency surface
 * is unchanged. Mutable by necessity — the renderer's prop type requires it — and never mutated.
 */
export type PlaneTransform = [{ translateX: number }, { translateY: number }, { scale: number }];

/**
 * ONE object-sized counter-scale, shared by every object on the plane.
 *
 * The same array serves all of them because it says nothing about any one of them — only how much
 * the plane's residual zoom has to be undone. Each object supplies its own `origin`, so each scales
 * about itself while there is exactly one derived value in the whole surface.
 */
export type ObjectTransform = [{ scale: number }];

/**
 * An already-authorized canonical camera change, reduced to the two presentation quantities that
 * relate the two projections of the same world.
 *
 * `k` is points-per-world-unit, new over old. `destination` is where the NEW anchor was drawn on
 * the OLD screen, relative to the viewport centre — or `null` when it was not finitely
 * representable from the previous camera, which is a technical fact about the projection and never
 * a semantic claim about the world.
 */
export interface CanonicalCameraChange {
  readonly k: number;
  readonly destination: PresentationPoint | null;
  readonly depthChanged: boolean;
}

export interface PresentationCameraOptions {
  /** The viewport centre, in points. The residual's scale is about this point. */
  readonly center: PresentationPoint;
  /** The viewport diagonal, in points, so a travel is measured against the screen it crosses. */
  readonly diagonalPoints: number;
  /** Reads and clears the cause of the change being shown. Absent means: never a composite beat. */
  readonly cause?: { readonly take: () => PresentationMotionCause | null };
}

export interface PresentationCameraBinding {
  /** The plane transform for a Skia `Group` whose `origin` is the viewport centre. */
  readonly planeTransform: DerivedValue<PlaneTransform>;
  /**
   * Undoes the plane's residual zoom for ONE object, about that object's own centre.
   *
   * A node's radius and a tether's stroke are screen quantities, so preserving the previous frame
   * means preserving their SIZE as well as their position. At rest this is the identity.
   */
  readonly objectTransform: DerivedValue<ObjectTransform>;
  /** The same factor as a scalar, for a stroke width that must stay one point on the glass. */
  readonly objectScale: DerivedValue<number>;
  /** The plane's own opacity. `1` except during a cut-and-resolve, which is not movement. */
  readonly planeOpacity: SharedValue<number>;
  /** `1` while a finger owns the plane. Chooses direct tracking over easing; decides nothing else. */
  readonly dragging: SharedValue<number>;
  /** Whether this device asked for reduced motion. Read once at start, exactly as the platform reports it. */
  readonly reducedMotion: boolean;
  /** UI runtime: a finger arrives. Cancels the running settle and takes the frame. */
  readonly grab: () => void;
  /** UI runtime: the finger moved. 1:1 with the hand, in the plane's own space. */
  readonly dragBy: (changeX: number, changeY: number) => void;
  /** UI runtime: the finger left. Ownership ends; the residual is left for the rebase to resolve. */
  readonly release: () => void;
  /** Rebases the visible frame onto an already-authorized camera, then resolves toward it. */
  readonly applyCanonicalChange: (change: CanonicalCameraChange) => PresentationTravelPlan;
  /** Returns the plane to the canonical camera when a completed input changed nothing. */
  readonly resolveToRest: () => void;
  /** Drops the residual outright. For an unmount, or a surface with no decodable camera. */
  readonly reset: () => void;
  /**
   * The residual as the last painted frame carries it, for converting a touch into the canonical
   * placement space. A bounded read at a pointer event, never per frame.
   */
  readonly canonicalPointAt: (point: PresentationPoint) => PresentationPoint;
}

export function usePresentationCamera(options: PresentationCameraOptions): PresentationCameraBinding {
  const { center, diagonalPoints, cause } = options;
  const reducedMotion = useReducedMotion();

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const zoom = useSharedValue(1);
  const planeOpacity = useSharedValue(1);
  const dragging = useSharedValue(0);

  const planeTransform = useDerivedValue<PlaneTransform>(() => {
    const [x, y, scale] = planeTransformTriple({ tx: tx.get(), ty: ty.get(), zoom: zoom.get() });
    return [{ translateX: x }, { translateY: y }, { scale }];
  });
  const objectScale = useDerivedValue(() => counterScale(zoom.get()));
  const objectTransform = useDerivedValue<ObjectTransform>(() => [{ scale: counterScale(zoom.get()) }]);

  const grab = useCallback(() => {
    'worklet';
    cancelAnimation(tx);
    cancelAnimation(ty);
    cancelAnimation(zoom);
    dragging.set(1);
  }, [dragging, tx, ty, zoom]);

  const dragBy = useCallback(
    (changeX: number, changeY: number) => {
      'worklet';
      // The plane is attached to the hand: no easing, no smoothing, no spring. The finger's points
      // are screen points, and the residual lives in the plane's own space, so a residual zoom
      // divides them — at rest that divisor is exactly 1.
      const scale = zoom.get();
      const divisor = Math.abs(scale) < 1e-9 ? 1 : scale;
      tx.set(tx.get() + changeX / divisor);
      ty.set(ty.get() + changeY / divisor);
    },
    [tx, ty, zoom],
  );

  const release = useCallback(() => {
    'worklet';
    dragging.set(0);
  }, [dragging]);

  const resolveToRest = useCallback(() => {
    const duration = reducedMotion ? 0 : MOTION_DURATIONS_MS.localResolve;
    tx.set(withTiming(0, { duration, easing: EASE_OUT }));
    ty.set(withTiming(0, { duration, easing: EASE_OUT }));
    zoom.set(withTiming(1, { duration, easing: EASE_OUT }));
  }, [reducedMotion, tx, ty, zoom]);

  const reset = useCallback(() => {
    cancelAnimation(tx);
    cancelAnimation(ty);
    cancelAnimation(zoom);
    tx.set(RESIDUAL_AT_REST.tx);
    ty.set(RESIDUAL_AT_REST.ty);
    zoom.set(RESIDUAL_AT_REST.zoom);
    planeOpacity.set(1);
    dragging.set(0);
  }, [dragging, planeOpacity, tx, ty, zoom]);

  const applyCanonicalChange = useCallback(
    (change: CanonicalCameraChange): PresentationTravelPlan => {
      const k = Number.isFinite(change.k) && change.k > 0 ? change.k : 1;
      const representable = change.destination !== null;
      const d = change.destination ?? { x: 0, y: 0 };

      // Rebased from the CURRENT residual through a functional update, so a finger writing at this
      // very instant loses nothing: the frame that is on the glass is preserved exactly.
      const before: PresentationResidual = { tx: tx.get(), ty: ty.get(), zoom: zoom.get() };
      const rebased = representable ? rebasedResidual(before, k, d) : RESIDUAL_AT_REST;
      tx.set(rebased.tx);
      ty.set(rebased.ty);
      zoom.set(rebased.zoom);

      const plan = presentationTravelPlan({
        residual: rebased,
        viewportDiagonalPoints: diagonalPoints,
        representable,
        reducedMotion,
        depthChanged: change.depthChanged,
        cause: cause?.take() ?? null,
      });

      if (plan.kind === 'AT_REST') {
        // Already showing canonical truth — the ordinary result of a completed drag, whose
        // committed translation IS the residual. The world holds its place; nothing animates.
        tx.set(RESIDUAL_AT_REST.tx);
        ty.set(RESIDUAL_AT_REST.ty);
        zoom.set(RESIDUAL_AT_REST.zoom);
        return plan;
      }

      if (plan.kind === 'CUT_AND_RESOLVE') {
        // The cut and the dip that covers it land in the SAME frame, beat or no beat.
        //
        // A cut is only acceptable because the resolve covers it. Dropping the residual now while
        // delaying the dip by the composite beat would show the world JUMP to the new viewpoint at
        // full weight and then be explained 110 ms afterwards — a teleport with a late apology, and
        // the one thing the North Star forbids outright. `TRAVEL` has no such problem: its rebase
        // PRESERVES the on-glass frame, so holding that frame for the beat reads as the world
        // waiting. Here the frame is discarded, so the hold has to be discarded with it.
        if (plan.spatialDelayMs > 0) {
          const held = (target: number) =>
            withDelay(plan.spatialDelayMs, withTiming(target, { duration: 0, reduceMotion: ReduceMotion.Never }));
          tx.set(held(RESIDUAL_AT_REST.tx));
          ty.set(held(RESIDUAL_AT_REST.ty));
          zoom.set(held(RESIDUAL_AT_REST.zoom));
        } else {
          tx.set(RESIDUAL_AT_REST.tx);
          ty.set(RESIDUAL_AT_REST.ty);
          zoom.set(RESIDUAL_AT_REST.zoom);
        }

        // Opacity is not movement, so it is what survives when movement is removed. `Never` is
        // explicit: under reduced motion a plain `withTiming` would jump to its end and the resolve
        // — the only thing left explaining that the reader went somewhere — would never play.
        //
        // It RETARGETS rather than restarts, and a resolve that is ALREADY running is continued
        // rather than re-seeded. Seeding it would mean sampling the weight NOW and applying it after
        // the beat: by then the plane has climbed past that sample, so the seed drops it backwards
        // and reads as a blink — precisely the restart-from-zero failure a sequence invites. Nothing
        // is sampled ahead of when it is used; the only seeded case is a plane at full weight, which
        // has no running resolve to contradict.
        const shownOpacity = planeOpacity.get();
        planeOpacity.set(
          withDelay(
            plan.spatialDelayMs,
            shownOpacity < 1
              ? withTiming(1, { duration: plan.resolveMs, easing: EASE_OUT, reduceMotion: ReduceMotion.Never })
              : withSequence(
                  withTiming(resolveFromOpacity(shownOpacity), { duration: 0, reduceMotion: ReduceMotion.Never }),
                  withTiming(1, { duration: plan.resolveMs, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }),
                ),
          ),
        );
        return plan;
      }

      if (plan.translationMs > 0) {
        const spring = { duration: plan.translationMs, dampingRatio: plan.dampingRatio };
        tx.set(withDelay(plan.spatialDelayMs, withSpring(0, spring)));
        ty.set(withDelay(plan.spatialDelayMs, withSpring(0, spring)));
      }
      if (plan.zoomMs > 0) {
        zoom.set(
          withDelay(plan.spatialDelayMs + plan.zoomDelayMs, withSpring(1, { duration: plan.zoomMs, dampingRatio: plan.dampingRatio })),
        );
      }
      return plan;
    },
    [cause, diagonalPoints, planeOpacity, reducedMotion, tx, ty, zoom],
  );

  const canonicalPointAt = useCallback(
    (point: PresentationPoint): PresentationPoint =>
      screenToResidual(point, { tx: tx.get(), ty: ty.get(), zoom: zoom.get() }, center),
    [center, tx, ty, zoom],
  );

  return useMemo(
    () => ({
      planeTransform,
      objectTransform,
      objectScale,
      planeOpacity,
      dragging,
      reducedMotion,
      grab,
      dragBy,
      release,
      applyCanonicalChange,
      resolveToRest,
      reset,
      canonicalPointAt,
    }),
    [
      applyCanonicalChange,
      canonicalPointAt,
      dragBy,
      dragging,
      grab,
      objectScale,
      objectTransform,
      planeOpacity,
      planeTransform,
      reducedMotion,
      release,
      reset,
      resolveToRest,
    ],
  );
}
