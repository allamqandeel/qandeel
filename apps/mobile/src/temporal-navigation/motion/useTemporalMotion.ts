/**
 * T-06 — the Reanimated binding for the temporal motion contract.
 *
 * Everything with Product meaning was already decided in `temporal-motion.ts`, in plain arithmetic.
 * This file only turns that plan into shared values and animated styles. It holds no store, no
 * dispatch, no preview controller and no commit path, so an animation cannot reach canonical state
 * from here — not from a callback, not from a completion, not from a worklet.
 *
 * Threading: the finger position lives in a shared value written by the gesture on the UI runtime,
 * so the cursor tracks the finger without a single React render. Nothing on the JS runtime is
 * scheduled per frame. The committed and preview positions are plain numbers captured from render —
 * they change only when a Product fact changes, which is at most once per disclosed step.
 *
 * Interruption: every animation is a `withTiming`/`withSpring` on a shared value, so a new target
 * RETARGETS the running animation from wherever it is rather than restarting it. A commit, a
 * cancellation or a new preview arriving mid-flight is therefore visually continuous — and, more
 * importantly, is already true in canonical state before this file hears about it at all.
 *
 * Geometry (FCR-03): positions animate in the TRACK's own logical space, and become physical only
 * inside the style, through the ONE presentation geometry the pointer side also uses. Under
 * right-to-left the same logical rest position is drawn at its mirrored physical place, the finger
 * is still followed 1:1 in the strip's own physical space, and the window offset, the viewport and
 * the direction are all held in never-animated shared values — so scrolling, resizing and mirroring
 * move the markers instantly and only a change of Moment ever eases.
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  markerTranslateX,
  presentationX,
  restingMarkerX,
  type PresentationStripGeometry,
} from '../timeline-integration/presentation-geometry';
import {
  CANCEL_DAMPING_RATIO,
  COMMIT_SETTLE_SCALE,
  EASE_OUT_BEZIER,
  temporalMotionPlan,
  trackOffsetFor,
  type TemporalMotionGeometry,
  type TemporalMotionInput,
  type TemporalMotionPlan,
} from './temporal-motion';

const EASE_OUT = Easing.bezier(EASE_OUT_BEZIER[0], EASE_OUT_BEZIER[1], EASE_OUT_BEZIER[2], EASE_OUT_BEZIER[3]);

/** Presentation opacity of a preview marker. A preview is never drawn at committed weight. */
export const PREVIEW_MARKER_OPACITY = 0.72;

/** Everything the binding needs to place a marker: ordinal geometry plus the strip's own viewport. */
export type TemporalMarkerGeometry = TemporalMotionGeometry & PresentationStripGeometry;

export interface TemporalMotionBinding {
  /** The plan this binding is presenting. Exposed so a surface can label itself from one source. */
  readonly plan: TemporalMotionPlan;
  /** Written by the scrub gesture on the UI runtime. Presentation progress; never Product truth. */
  readonly fingerX: SharedValue<number>;
  /** `1` while a finger is down. Chooses direct tracking over easing; decides nothing else. */
  readonly tracking: SharedValue<number>;
  readonly cursorStyle: ReturnType<typeof useAnimatedStyle>;
  /** Carries both the committed marker's position and its commit acknowledgement. */
  readonly committedStyle: ReturnType<typeof useAnimatedStyle>;
  /**
   * Acknowledges a commit the store has ALREADY applied, on the committed marker itself — the one
   * element whose meaning actually changed. It is called with the outcome in hand, it returns
   * nothing, and no Product act waits for it. Skipped entirely under reduced motion.
   */
  readonly acknowledgeCommit: () => void;
  /** Returns the cursor to committed truth after a cancellation. Critically damped: no overshoot. */
  readonly acknowledgeCancel: () => void;
}

export function useTemporalMotion(
  input: Omit<TemporalMotionInput, 'reducedMotion'>,
  geometry: TemporalMarkerGeometry,
): TemporalMotionBinding {
  const reducedMotion = useReducedMotion();
  const plan = temporalMotionPlan({ ...input, reducedMotion });

  const { stepWidth } = geometry;
  const cursorTarget = trackOffsetFor(plan.cursorSp, stepWidth);
  const committedTarget = trackOffsetFor(plan.committedSp, stepWidth);

  const fingerX = useSharedValue(0);
  const tracking = useSharedValue(0);
  const settle = useSharedValue(0);
  // Positions live in the TRACK's own space and are the only things that animate. The window offset
  // is held separately and never animated, so scrolling the presentation moves the markers with the
  // content instead of dragging 140 ms of easing behind it (R1-MOTION-01). The viewport and the
  // direction are held the same way: presentation geometry, never a temporal quantity, never eased.
  const cursorTrack = useSharedValue(cursorTarget ?? 0);
  const committedTrack = useSharedValue(committedTarget ?? 0);
  // Where the cursor should REST right now, in Track space, as a plain number the UI runtime can
  // read at the instant a finger lifts (FCR-MOTION-01). Never animated; only ever set.
  const restTrack = useSharedValue(cursorTarget ?? committedTarget ?? 0);
  const windowOffset = useSharedValue(geometry.windowOffset);
  const viewport = useSharedValue(geometry.viewport);
  const rtl = useSharedValue(geometry.rtl ? 1 : 0);

  const cursorMs = plan.cursorMs;
  const presenceMs = plan.presenceMs;
  const cancelMs = plan.cancelMs;
  const previewPresent = plan.previewPresent;

  // A layout effect, not a passive one: the presentation has already moved by the time this commit
  // paints, and T-05 places its own list in a layout effect. The never-animated geometry must not
  // land a frame later than the content it follows (FCR-MOTION-03).
  useLayoutEffect(() => {
    windowOffset.set(geometry.windowOffset);
    viewport.set(geometry.viewport);
    rtl.set(geometry.rtl ? 1 : 0);
  }, [geometry.windowOffset, geometry.viewport, geometry.rtl, windowOffset, viewport, rtl]);

  // Nothing animates into place from nowhere (R1-MOTION-02). The first real position is SET, not
  // animated to, so the markers appear where they belong instead of sliding in from the Track's
  // origin on mount — or on the first mirrored Moment, when there was nothing to be at before.
  const placed = useRef(false);
  useEffect(() => {
    if (committedTarget === null) return;
    const cursorTo = cursorTarget ?? committedTarget;
    restTrack.set(cursorTo);
    if (!placed.current) {
      placed.current = true;
      committedTrack.set(committedTarget);
      cursorTrack.set(cursorTo);
      return;
    }
    committedTrack.set(withTiming(committedTarget, { duration: cursorMs, easing: EASE_OUT }));
    // Two destinations, two characters, and which one applies is derived from Product truth alone:
    // moving TO a preview target is a retargetable timing (M1), and returning to committed truth
    // because the preview is gone is a critically damped spring (M3) — it cannot overshoot past
    // committed truth and momentarily draw the cursor at a position nobody is at. At zero duration
    // a timing is used instead, so reduced motion never depends on a spring's zero-duration case.
    if (previewPresent) {
      cursorTrack.set(withTiming(cursorTo, { duration: cursorMs, easing: EASE_OUT }));
    } else if (cancelMs === 0) {
      cursorTrack.set(withTiming(committedTarget, { duration: 0 }));
    } else {
      cursorTrack.set(withSpring(committedTarget, { duration: cancelMs, dampingRatio: CANCEL_DAMPING_RATIO }));
    }
  }, [committedTarget, cursorTarget, previewPresent, cursorMs, cancelMs, committedTrack, cursorTrack, restTrack]);

  // The release handoff (FCR-MOTION-01). While a finger is down the cursor is drawn under it; the
  // moment it lifts, the cursor must CONTINUE from there to its rest position, not teleport to a
  // step centre up to half a step away. So at the tracking edge the animated Track position is
  // seeded from the finger's own logical place — the exact value the finger branch was drawing,
  // through the same geometry in both writing directions — and then retargeted with M1. Entirely on
  // the UI runtime, nothing scheduled, no Product decision: where the cursor rests was decided by
  // the preview controller already; this only decides where the travel starts from.
  useAnimatedReaction(
    () => tracking.get(),
    (now, before) => {
      if (before !== 1 || now !== 0) return;
      const logical = presentationX(fingerX.get(), viewport.get(), rtl.get() === 1);
      if (logical === null) return;
      cursorTrack.set(logical + windowOffset.get());
      cursorTrack.set(withTiming(restTrack.get(), { duration: cursorMs, easing: EASE_OUT }));
    },
  );

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: withTiming(previewPresent ? PREVIEW_MARKER_OPACITY : 0, { duration: presenceMs, easing: EASE_OUT }),
    // A finger on the surface wins over every animation: 1:1, no easing, no lag, no argument with
    // the hand. A finger position is already physical, in the strip's own space, so it needs no
    // window offset and no mirror — only the marker's own anchor convention. The rest position is
    // logical Track space minus the never-animated window offset, mirrored by the ONE shared rule.
    // `get`/`set` throughout: the React Compiler cannot see through direct `.value`.
    transform: [
      {
        translateX:
          tracking.get() === 1
            ? markerTranslateX(fingerX.get(), viewport.get(), rtl.get() === 1)
            : restingMarkerX(cursorTrack.get() - windowOffset.get(), viewport.get(), rtl.get() === 1),
      },
    ],
  }));

  const committedStyle = useAnimatedStyle(() => ({
    // Committed truth never follows a preview. It moves only when a commit has already been applied,
    // and it follows the scroll instantly because the offset it subtracts is not animated.
    transform: [
      { translateX: restingMarkerX(committedTrack.get() - windowOffset.get(), viewport.get(), rtl.get() === 1) },
      // The commit acknowledgement, on the element whose meaning actually changed. Never a scale
      // from zero: it grows from the marker's own size and returns to it.
      { scaleY: 1 + settle.get() * COMMIT_SETTLE_SCALE },
    ],
  }));

  const commitSettleMs = plan.commitSettleMs;
  const acknowledgeCommit = useCallback(() => {
    if (commitSettleMs === 0) {
      // Reduced motion: skipped outright rather than compressed into a flash. The commit is legible
      // from the committed marker's own position and from the accessible announcement.
      settle.set(0);
      return;
    }
    settle.set(withSequence(
      withTiming(1, { duration: Math.round(commitSettleMs * 0.4), easing: EASE_OUT }),
      withTiming(0, { duration: Math.round(commitSettleMs * 0.6), easing: EASE_OUT }),
    ));
  }, [settle, commitSettleMs]);

  // Cancellation needs no animation of its own: the cursor's own destination changes the instant the
  // ephemeral target is gone, and the spring above carries it home. This only clears an
  // acknowledgement that a commit may have left running.
  const acknowledgeCancel = useCallback(() => {
    settle.set(0);
  }, [settle]);

  return { plan, fingerX, tracking, cursorStyle, committedStyle, acknowledgeCommit, acknowledgeCancel };
}
