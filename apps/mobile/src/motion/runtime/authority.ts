/**
 * T-10 R1 — which authority a presentation is bound to, readable from both runtimes.
 *
 * An interaction begins under one owner. If that owner is replaced before the interaction's
 * crossing back to the Product runtime arrives, the interaction is STALE: it was performed against
 * a world nobody is looking at any more, and replaying its numbers into the replacement would be a
 * write to an authority that never saw the gesture.
 *
 * So a generation is stamped on the owner and captured at the start of each interaction. Both
 * runtimes can read it — the UI runtime through the shared value, the Product runtime through the
 * plain number — and they are written together, in one layout effect, so they cannot disagree.
 *
 * This holds no identity and compares no identity: it counts changes. It cannot name the owner, so
 * it cannot become a second route to one.
 */
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { createBox } from './box';
import type { SharedValue } from './bridge';

export interface AuthorityGeneration {
  /** The generation this surface is bound to right now. Readable from a worklet. */
  readonly generation: SharedValue<number>;
  /** What the interaction in progress captured when it began. Written on the UI runtime. */
  readonly captured: SharedValue<number>;
  /** UI runtime: stamp the interaction that is starting with the current generation. */
  readonly capture: () => void;
  /** Product runtime: the generation bound right now, for comparing an arriving crossing. */
  readonly current: () => number;
}

/**
 * Binds a presentation to an owner's identity.
 *
 * The generation advances on the first commit and on every commit where the owner's identity
 * changed. Between the render that sees a new owner and the layout effect that stamps it, the
 * generation still reads as the previous one — an interaction beginning in that window is stamped
 * old and will be dropped, which is the conservative direction and the safe one.
 */
export function useAuthorityGeneration(owner: unknown): AuthorityGeneration {
  const generation = useSharedValue(0);
  const captured = useSharedValue(0);
  const [count] = useState(() => createBox(0));

  useLayoutEffect(() => {
    const next = count.get() + 1;
    count.set(next);
    generation.set(next);
  }, [count, generation, owner]);

  const capture = useCallback(() => {
    'worklet';
    captured.set(generation.get());
  }, [captured, generation]);

  const current = useCallback(() => count.get(), [count]);

  return useMemo(() => ({ generation, captured, capture, current }), [capture, captured, current, generation]);
}
