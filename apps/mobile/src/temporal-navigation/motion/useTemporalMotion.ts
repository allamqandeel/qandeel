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
 */
import { useCallback } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  CANCEL_DAMPING_RATIO,
  COMMIT_SETTLE_SCALE,
  EASE_OUT_BEZIER,
  cursorOffsetFor,
  temporalMotionPlan,
  type TemporalMotionGeometry,
  type TemporalMotionInput,
  type TemporalMotionPlan,
} from './temporal-motion';

const EASE_OUT = Easing.bezier(EASE_OUT_BEZIER[0], EASE_OUT_BEZIER[1], EASE_OUT_BEZIER[2], EASE_OUT_BEZIER[3]);

/** Presentation opacity of a preview marker. A preview is never drawn at committed weight. */
export const PREVIEW_MARKER_OPACITY = 0.72;

export interface TemporalMotionBinding {
  /** The plan this binding is presenting. Exposed so a surface can label itself from one source. */
  readonly plan: TemporalMotionPlan;
  /** Written by the scrub gesture on the UI runtime. Presentation progress; never Product truth. */
  readonly fingerX: SharedValue<number>;
  /** `1` while a finger is down. Chooses direct tracking over easing; decides nothing else. */
  readonly tracking: SharedValue<number>;
  readonly cursorStyle: ReturnType<typeof useAnimatedStyle>;
  readonly committedStyle: ReturnType<typeof useAnimatedStyle>;
  readonly settleStyle: ReturnType<typeof useAnimatedStyle>;
  /**
   * Acknowledges a commit the store has ALREADY applied. It is called with the outcome in hand, it
   * returns nothing, and no Product act waits for it. Skipped entirely under reduced motion.
   */
  readonly acknowledgeCommit: () => void;
  /** Returns the cursor to committed truth after a cancellation. Critically damped: no overshoot. */
  readonly acknowledgeCancel: () => void;
}

export function useTemporalMotion(
  input: Omit<TemporalMotionInput, 'reducedMotion'>,
  geometry: TemporalMotionGeometry,
): TemporalMotionBinding {
  const reducedMotion = useReducedMotion();
  const plan = temporalMotionPlan({ ...input, reducedMotion });

  const fingerX = useSharedValue(0);
  const tracking = useSharedValue(0);
  const settle = useSharedValue(0);

  const cursorX = cursorOffsetFor(plan.cursorSp, geometry) ?? 0;
  const committedX = cursorOffsetFor(plan.committedSp, geometry) ?? 0;
  const cursorMs = plan.cursorMs;
  const presenceMs = plan.presenceMs;
  const cancelMs = plan.cancelMs;
  const previewPresent = plan.previewPresent;

  const cursorStyle = useAnimatedStyle(() => {
    // Two destinations, two characters, and which one applies is derived from Product truth alone:
    // moving TO a preview target is a retargetable timing (M1), and returning to committed truth
    // because the preview is gone is a critically damped spring (M3) — it cannot overshoot past
    // committed truth and momentarily draw the cursor at a position nobody is at.
    const settled = previewPresent
      ? withTiming(cursorX, { duration: cursorMs, easing: EASE_OUT })
      : withSpring(committedX, { duration: cancelMs, dampingRatio: CANCEL_DAMPING_RATIO });
    return {
      opacity: withTiming(previewPresent ? PREVIEW_MARKER_OPACITY : 0, { duration: presenceMs, easing: EASE_OUT }),
      // A finger on the surface wins over every animation: 1:1, no easing, no lag, no argument with
      // the hand. `get`/`set` throughout: the React Compiler cannot see through direct `.value`.
      transform: [{ translateX: tracking.get() === 1 ? fingerX.get() : settled }],
    };
  });

  const committedStyle = useAnimatedStyle(() => ({
    // Committed truth never follows a preview. It moves only when a commit has already been applied.
    transform: [{ translateX: withTiming(committedX, { duration: cursorMs, easing: EASE_OUT }) }],
  }));

  const settleStyle = useAnimatedStyle(() => ({
    opacity: settle.get(),
    // Never a scale from zero: the acknowledgement grows from the marker's own size.
    transform: [{ scale: 1 + settle.get() * COMMIT_SETTLE_SCALE }],
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

  return { plan, fingerX, tracking, cursorStyle, committedStyle, settleStyle, acknowledgeCommit, acknowledgeCancel };
}
