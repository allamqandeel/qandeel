/**
 * T-10 — the ONE crossing between the UI runtime and the Product runtime, and the animation value
 * types the surfaces it serves are allowed to see.
 *
 * Every animation package this app uses is imported HERE and in this owner's own modules — never
 * in the Map, the Timeline or the chrome. That is not tidiness: T-04's static contract pins the
 * exact set of packages the Map layer may name, and keeping motion behind a relative import is
 * what lets the Map gain a presentation camera without its dependency surface changing at all.
 *
 * The crossing itself is deliberately one function with one shape. Per-frame work never uses it:
 * a gesture writes shared values on the UI runtime and crosses exactly once, at the END of a
 * completed interaction, to hand a Product act the numbers it already earned. An animation
 * COMPLETION never uses it either — there is no completion callback in this owner that reaches a
 * store, an executor or a dispatch, because motion explains a Product act and never authorizes one.
 */
import { scheduleOnRN } from 'react-native-worklets';

export type { DerivedValue, SharedValue } from 'react-native-reanimated';

/**
 * Hands a completed interaction back to the Product runtime, once.
 *
 * Called from a gesture ending — never from `onUpdate`, never from a frame callback, never from an
 * animation callback. `scheduleOnRN` is Reanimated 4's replacement for the removed `runOnJS`, and
 * it takes its arguments directly rather than curried.
 */
export function handoffToProduct<A extends readonly unknown[]>(fn: (...args: A) => void, ...args: A): void {
  'worklet';
  scheduleOnRN(fn, ...args);
}
