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
  useAnimatedReaction,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MOTION_DURATIONS_MS, QANDEEL_EASE_OUT, REDUCED_RESOLVE_FROM_OPACITY } from '../tokens';
import { handoffToProduct, type DerivedValue, type SharedValue } from '../runtime/bridge';
import {
  RESIDUAL_AT_REST,
  counterScale,
  planeTransformTriple,
  rebasedResidual,
  screenToResidual,
  type PresentationPoint,
  type PresentationResidual,
} from './residual';
import { presentationAdvance } from './culling';
import { presentationTravelPlan, residualIsAtRest, type PresentationMotionCause, type PresentationTravelPlan } from './travel-plan';

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
  /**
   * Called once when the presentation actually reaches rest, with the epoch current at that moment.
   *
   * PRESENTATION ONLY, and the narrowest possible signal: it says the plane has stopped, so a widened
   * travel culling corridor is no longer needed. It carries no position, no target and no act, and
   * the receiver may not dispatch — a corridor that outlived its travel is a paint cost, never a
   * Product fact. It is a threshold reaction on the residual, not an animation completion, and the
   * epoch it carries lets a notification that lost a race to a new motion be discarded (R3-02a).
   *
   * Must be referentially stable; it is captured by a worklet reaction.
   */
  readonly onTravelCorridorRetired?: (epoch: number) => void;
  /**
   * Called when the plane has moved further than `advancePoints` since the last time it said so.
   *
   * The retirement above is one half of a pair and was, for a while, the only half. A TRAVEL declares
   * its whole path when it is authorized, so the renderer can open a corridor that already contains
   * every frame of it. A DRAG declares nothing: the plane is attached to a hand, the destination does
   * not exist yet, and no canonical camera changes until the finger lifts — so the corridor stayed
   * degenerate for the whole gesture and the renderer went on culling against the RESTING viewport.
   *
   * Measured on a device, that is a reader-visible defect rather than a subtlety: during a one-finger
   * pan the leading edge of the glass was blank, and every object the drag had brought on screen
   * appeared at once at the moment of release. This is the missing half — the plane saying where it
   * has got to, often enough that the renderer can paint ahead of the hand.
   *
   * It is a THRESHOLD reaction, not a frame callback: one crossing per `advancePoints` of screen
   * travel, so a whole drag costs a handful and an idle world costs none. It carries presentation
   * numbers only — a residual and a margin — dispatches nothing, and names no target. `padPlaneUnits`
   * is how far beyond that residual the renderer should paint, and it already includes the distance
   * covered while this notification was in flight, so a fast flick widens the band by itself.
   *
   * Must be referentially stable; it is captured by a worklet reaction.
   */
  readonly onPresentationAdvanced?: (tx: number, ty: number, zoom: number, padPlaneUnits: number, epoch: number) => void;
  /**
   * The screen distance the plane may travel before it must report again, in points.
   *
   * The caller's own cull margin is the honest value and the default is deliberately absent: the
   * renderer already paints this far beyond the glass, so a plane that reports every margin can never
   * let an unpainted region reach the reader, and no second constant has to be kept in step with it.
   */
  readonly advancePoints?: number;
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
  /**
   * How many times the presentation has been re-aimed. Presentation only, and never a Product count.
   *
   * It exists so a rest notification can be recognised as belonging to a motion that has since been
   * replaced. Read at a bounded boundary — a notification, never a frame.
   */
  readonly epoch: SharedValue<number>;
  /** Whether this device asked for reduced motion. Read once at start, exactly as the platform reports it. */
  readonly reducedMotion: boolean;
  /** UI runtime: a finger arrives. Cancels the running settle and takes the frame. */
  readonly grab: () => void;
  /** UI runtime: the finger moved. 1:1 with the hand, in the plane's own space. */
  readonly dragBy: (changeX: number, changeY: number) => void;
  /** UI runtime: the finger left. Ownership ends; the residual is left for the rebase to resolve. */
  readonly release: () => void;
  /**
   * Rebases the visible frame onto an already-authorized camera, then resolves toward it.
   *
   * `cause` is the composite spatial cause for THIS transition, or nothing. It is an ARGUMENT to the
   * call that applies the transition rather than a channel this hook holds, and that is the whole of
   * why it cannot become the pending mailbox R3-04 refused: there is nothing to hold, nothing to
   * queue, nothing to expire and nothing for a later unrelated camera act to find. A cause exists
   * only for the duration of the one call it was passed to.
   *
   * It changes exactly one thing, and only in the plan T-10 already froze: whether the preserved
   * frame is held for the composite beat before the spatial half is shown. It is never required for
   * correctness — absent one, the plan is simply the plain one — and it can neither move the camera,
   * choose a destination, nor make any claim about the world.
   */
  readonly applyCanonicalChange: (change: CanonicalCameraChange, cause?: PresentationMotionCause | null) => PresentationTravelPlan;
  /** Returns the plane to the canonical camera when a completed input changed nothing. */
  readonly resolveToRest: () => void;
  /** Drops the residual outright. For an unmount, or a surface with no decodable camera. */
  readonly reset: () => void;
  /**
   * The residual as the last painted frame carries it, for converting a touch into the canonical
   * placement space. A bounded read at a pointer event, never per frame.
   */
  readonly canonicalPointAt: (point: PresentationPoint) => PresentationPoint;
  /**
   * The residual right now, for a presentation owner that has to agree with the plane about where it
   * is.
   *
   * A BOUNDED read at a commit or event boundary — never during render, never per frame, and never
   * to drive anything visual: the plane is drawn from the shared values themselves on the UI runtime.
   * Its one caller reads it once per canonical change, so the culling corridor is the corridor of the
   * motion actually running rather than one inherited from a travel that already finished (R3-02).
   */
  readonly readResidual: () => PresentationResidual;
}

export function usePresentationCamera(options: PresentationCameraOptions): PresentationCameraBinding {
  const { center, diagonalPoints, onTravelCorridorRetired, onPresentationAdvanced, advancePoints } = options;
  const reducedMotion = useReducedMotion();

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const zoom = useSharedValue(1);
  const planeOpacity = useSharedValue(1);
  const dragging = useSharedValue(0);
  const epoch = useSharedValue(0);
  // Where the plane was the last time it told the Product runtime where it was. Not a duplicate of
  // the residual and never read as one: it exists only to measure "how far since I last said so",
  // which is what turns a per-frame value into a handful of crossings per gesture.
  const reportedTx = useSharedValue(0);
  const reportedTy = useSharedValue(0);
  const reportedZoom = useSharedValue(1);

  // Whether the plane is showing canonical truth exactly AND no finger owns it. A derived value
  // rather than a frame callback: it is recomputed on the UI runtime with the transform it already
  // recomputes, and it crosses to the Product runtime only on the edge below.
  const settled = useDerivedValue(() =>
    dragging.get() === 0 && residualIsAtRest({ tx: tx.get(), ty: ty.get(), zoom: zoom.get() }) ? 1 : 0,
  );
  useAnimatedReaction(
    () => settled.get(),
    (now, previous) => {
      'worklet';
      // ONE crossing per motion, on the rising edge only: never per frame, and never on mount —
      // `previous === null` is the first evaluation, which has no motion behind it to retire.
      if (now !== 1 || previous === null || previous === 1) return;
      // Rest is also where the reference point belongs again: the corridor the renderer is about to
      // retire describes rest, so the next motion must measure its first advance from rest too.
      reportedTx.set(0);
      reportedTy.set(0);
      reportedZoom.set(1);
      if (onTravelCorridorRetired !== undefined) handoffToProduct(onTravelCorridorRetired, epoch.get());
    },
    [epoch, onTravelCorridorRetired, reportedTx, reportedTy, reportedZoom, settled],
  );

  // The other half: the plane says where it has got to, often enough for the renderer to paint ahead
  // of the hand, and no more often than that.
  //
  // The measured quantity is SCREEN distance, because that is what the reader sees and what the cull
  // margin is expressed in: a residual translation moves the glass by `zoom · t`, and a residual zoom
  // moves it by roughly the diagonal times the scale change. Both are included so this one reaction
  // serves a drag and a travel alike.
  // The rule itself is `presentationAdvance`; this is only the glue that runs it on the UI runtime.
  useAnimatedReaction(
    () => ({ tx: tx.get(), ty: ty.get(), zoom: zoom.get() }),
    (residual) => {
      'worklet';
      if (onPresentationAdvanced === undefined || advancePoints === undefined) return;
      const advance = presentationAdvance(
        residual,
        { tx: reportedTx.get(), ty: reportedTy.get(), zoom: reportedZoom.get() },
        diagonalPoints,
        advancePoints,
      );
      if (advance === null) return;
      reportedTx.set(advance.residual.tx);
      reportedTy.set(advance.residual.ty);
      reportedZoom.set(advance.residual.zoom);
      handoffToProduct(
        onPresentationAdvanced,
        advance.residual.tx,
        advance.residual.ty,
        advance.residual.zoom,
        advance.padPlaneUnits,
        epoch.get(),
      );
    },
    [advancePoints, diagonalPoints, epoch, onPresentationAdvanced, reportedTx, reportedTy, reportedZoom, tx, ty, zoom],
  );

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
    epoch.set(epoch.get() + 1);
    dragging.set(1);
  }, [dragging, epoch, tx, ty, zoom]);

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
    epoch.set(epoch.get() + 1);
    const duration = reducedMotion ? 0 : MOTION_DURATIONS_MS.localResolve;
    tx.set(withTiming(0, { duration, easing: EASE_OUT }));
    ty.set(withTiming(0, { duration, easing: EASE_OUT }));
    zoom.set(withTiming(1, { duration, easing: EASE_OUT }));
  }, [epoch, reducedMotion, tx, ty, zoom]);

  const reset = useCallback(() => {
    cancelAnimation(tx);
    cancelAnimation(ty);
    cancelAnimation(zoom);
    epoch.set(epoch.get() + 1);
    tx.set(RESIDUAL_AT_REST.tx);
    ty.set(RESIDUAL_AT_REST.ty);
    zoom.set(RESIDUAL_AT_REST.zoom);
    // The plane is at rest by fiat rather than by arriving there, so the advance reference has to be
    // moved with it: measuring the next motion from where a discarded one happened to stop would
    // report a distance the reader never saw.
    reportedTx.set(RESIDUAL_AT_REST.tx);
    reportedTy.set(RESIDUAL_AT_REST.ty);
    reportedZoom.set(RESIDUAL_AT_REST.zoom);
    planeOpacity.set(1);
    dragging.set(0);
  }, [dragging, epoch, planeOpacity, reportedTx, reportedTy, reportedZoom, tx, ty, zoom]);

  const applyCanonicalChange = useCallback(
    (change: CanonicalCameraChange, cause: PresentationMotionCause | null = null): PresentationTravelPlan => {
      epoch.set(epoch.get() + 1);
      const k = Number.isFinite(change.k) && change.k > 0 ? change.k : 1;
      const representable = change.destination !== null;
      const d = change.destination ?? { x: 0, y: 0 };

      // Rebased from the CURRENT residual, so a finger writing at this very instant loses nothing:
      // the frame that is on the glass is preserved exactly.
      //
      // R3-03: the rebase is COMPUTED here and WRITTEN by the branch that owns it. Writing it before
      // the plan existed is what left an unrepresentable cut exposed — there `rebased` is rest, so
      // the pre-write dropped the world to the destination at full weight and the delayed dip
      // explained it afterwards. A residual is now only ever written together with whatever covers
      // it.
      const before: PresentationResidual = { tx: tx.get(), ty: ty.get(), zoom: zoom.get() };
      const rebased = representable ? rebasedResidual(before, k, d) : RESIDUAL_AT_REST;

      const plan = presentationTravelPlan({
        residual: rebased,
        viewportDiagonalPoints: diagonalPoints,
        representable,
        reducedMotion,
        depthChanged: change.depthChanged,
        // R3-04, closed by T-12 §15. The cause arrives as an argument to THIS call and is used
        // immediately; nothing about it is stored, so the mailbox R3-04 refused remains impossible
        // by construction rather than by policy. Which transition an already-returned outcome
        // belongs to is still a composition fact this owner does not have and does not compute — the
        // integration owner proves the identity and hands the answer in.
        cause,
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
        // The rebase is written first, because it is what the beat would HOLD. When the destination
        // was representable the rebased residual is a true preserved frame, and holding it says "the
        // world stayed where it looks" before the cut lands under the dip. When it was NOT
        // representable the rebase IS rest, there is no frame to hold, and R3-03 has already reduced
        // the beat to zero — so both writes happen in this frame, together with the dip that covers
        // them. Either way no cut is ever exposed at full weight and explained afterwards.
        tx.set(rebased.tx);
        ty.set(rebased.ty);
        zoom.set(rebased.zoom);
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
        // The dip has a FIXED depth, and it is issued with the same delay as the cut, so the two
        // always land in the same frame. Nothing is sampled, which is the whole correction.
        //
        // An earlier pass sampled the weight on the glass and reused it as the seed. `/review-
        // animations` caught the first half of that: with a beat, the plane climbed past the sample
        // before it was applied, so the seed dropped it backwards and read as a blink. Branching
        // around it — continuing a running resolve instead of re-seeding — fixed the blink and
        // opened a worse hole: a second cut landing late in a resolve then arrived at ~0.99 opacity,
        // which is a viewpoint change with nothing covering it. Under reduced motion every travel is
        // a cut, so that was the ordinary case rather than the rare one.
        //
        // A constant cannot be stale, whenever it is applied. Two cuts in quick succession therefore
        // read as two cuts, which is what they are.
        planeOpacity.set(
          withDelay(
            plan.spatialDelayMs,
            withSequence(
              withTiming(REDUCED_RESOLVE_FROM_OPACITY, { duration: 0, reduceMotion: ReduceMotion.Never }),
              withTiming(1, { duration: plan.resolveMs, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }),
            ),
          ),
        );
        return plan;
      }

      // TRAVEL. The rebase goes on the glass first — that IS the preserved frame — and each spring
      // then starts from it. A beat here holds a frame that is true, so the world visibly waits
      // rather than jumping.
      tx.set(rebased.tx);
      ty.set(rebased.ty);
      zoom.set(rebased.zoom);
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
    [diagonalPoints, epoch, planeOpacity, reducedMotion, tx, ty, zoom],
  );

  const canonicalPointAt = useCallback(
    (point: PresentationPoint): PresentationPoint =>
      screenToResidual(point, { tx: tx.get(), ty: ty.get(), zoom: zoom.get() }, center),
    [center, tx, ty, zoom],
  );

  const readResidual = useCallback((): PresentationResidual => ({ tx: tx.get(), ty: ty.get(), zoom: zoom.get() }), [tx, ty, zoom]);

  return useMemo(
    () => ({
      planeTransform,
      objectTransform,
      objectScale,
      planeOpacity,
      dragging,
      epoch,
      reducedMotion,
      grab,
      dragBy,
      release,
      applyCanonicalChange,
      resolveToRest,
      reset,
      canonicalPointAt,
      readResidual,
    }),
    [
      applyCanonicalChange,
      canonicalPointAt,
      dragBy,
      readResidual,
      dragging,
      epoch,
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
