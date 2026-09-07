/**
 * T-10 — the ONE crossing between the UI runtime and the Product runtime, and the animation value
 * types the surfaces it serves are allowed to see.
 *
 * Every animation package this app uses is imported HERE and in this owner's own modules — never
 * in the Map, the Timeline or the chrome. That is not tidiness: T-04's static contract pins the
 * exact set of packages the Map layer may name, and keeping motion behind a relative import is
 * what lets the Map gain a presentation camera without its dependency surface changing at all.
 *
 * The crossing itself is deliberately one function with one shape, and per-frame work never uses it.
 * It has exactly two callers, and the difference between them is the whole safety argument:
 *
 *   a gesture ENDING hands a Product act the numbers the finger already earned. One crossing, at
 *   the end of a completed interaction — never from `onUpdate`, never from a frame callback;
 *
 *   the presentation reaching REST retires the travel culling corridor. It carries no translation,
 *   no target and no act; it tells a Class-D presentation owner that the widened paint candidate set
 *   is no longer needed. It is a THRESHOLD reaction rather than an animation completion — there is
 *   still no completion callback anywhere in this owner — and it is epoch-guarded, so one that
 *   arrives after a new motion has started is discarded rather than applied.
 *
 * Neither can reach a store, an executor or a dispatch: motion explains a Product act, never
 * authorizes one.
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
