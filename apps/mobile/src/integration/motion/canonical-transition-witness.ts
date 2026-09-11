/**
 * T-12 — the canonical state either side of the MOST RECENT canonical change.
 *
 * Two of this task's obligations need the same thing and cannot get it from an outcome: `QAN-BL-MOT-02`
 * has to know whether a `GO_LIVE_AND_LOCATE` actually moved the camera, and `QAN-BL-T12-01` has to
 * know whether the act that just ran began an inspection journey or continued one. Both are questions
 * about the STEP, and an outcome describes only where the step ended.
 *
 * The surfaces that run these acts — T-08's return controls, T-04's Map surface — own their dispatch
 * and hand back a result afterwards, so there is no pre-act hook to read `before` from. This closes
 * that without changing either owner: the store's own subscription fires synchronously inside
 * `publish`, before the executor returns, so a listener that keeps the value it saw LAST is holding
 * exactly the state the act started from by the time the outcome callback runs.
 *
 * ## Why this is not a second copy of canonical state
 *
 * It stores two references to states the store itself published, reads nothing out of them, derives
 * nothing from them, and answers no question about the world. Nothing subscribes to it, nothing
 * renders from it, and it is never written back anywhere. It is a two-element window over the store's
 * own notification stream, and it exists for exactly as long as the store it watches.
 *
 * A `Φ_eff` no-op publishes nothing at all, so the window does not move — which is what makes
 * "nothing changed" and "something changed back to an equal value" distinguishable rather than
 * conflated.
 */

import type { CanonicalState, CanonicalStore } from '../../state';

export interface CanonicalTransitionWitness {
  /** The state the most recent canonical change started from. */
  before(): CanonicalState;
  /** The state it ended at, which is also the store's current state. */
  after(): CanonicalState;
  dispose(): void;
}

export function createCanonicalTransitionWitness(store: CanonicalStore): CanonicalTransitionWitness {
  let previous = store.getState();
  let current = previous;

  const unsubscribe = store.subscribe(() => {
    previous = current;
    current = store.getState();
  });

  return {
    before: () => previous,
    after: () => current,
    dispose: unsubscribe,
  };
}
