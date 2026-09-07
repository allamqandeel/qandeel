/**
 * T-10.0 MOTION LAB — turning a settle specification into a Reanimated animation, on the UI runtime.
 *
 * Reduced motion is decided by the profile (an alternate choreography, P9), so every animation
 * built here runs with `ReduceMotion.Never`: a reduced profile reaches this with cuts and short
 * fades, and those must actually play rather than being collapsed a second time by the system.
 */
import { Easing, ReduceMotion, withSpring, withTiming } from 'react-native-reanimated';

import type { SettleSpec } from './profiles';

/** Strong ease-out, the same curve T-06 froze for its own retargets. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** Strong ease-in-out, for something that moves on screen without entering or leaving. */
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

export type SettleCallback = (finished?: boolean) => void;

/**
 * An animation toward `target` under `spec`, carrying `velocity` when the spec allows it. A `cut`
 * returns the target itself, so assigning the result to a shared value sets it immediately.
 */
export function settleTo(target: number, spec: SettleSpec, velocity: number, callback?: SettleCallback): number {
  'worklet';
  if (spec.kind === 'cut') {
    if (callback !== undefined) callback(true);
    return target;
  }
  if (spec.kind === 'timing') {
    return withTiming(target, { duration: spec.durationMs, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }, callback);
  }
  return withSpring(
    target,
    { duration: spec.durationMs, dampingRatio: spec.dampingRatio, velocity: spec.carriesVelocity ? velocity : 0, reduceMotion: ReduceMotion.Never },
    callback,
  );
}

/** A plain ease-out fade or resolve over `durationMs`; zero means an immediate set. */
export function fadeTo(target: number, durationMs: number, callback?: SettleCallback): number {
  'worklet';
  if (durationMs <= 0) {
    if (callback !== undefined) callback(true);
    return target;
  }
  return withTiming(target, { duration: durationMs, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }, callback);
}
