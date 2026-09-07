/**
 * T-10 R1 — the one place an arriving object's progress can be read from BOTH runtimes.
 *
 * §14 requires paint, pointer and accessibility to agree at every interactive moment. The plane's
 * residual already satisfied that for the camera; an object under its own arrival transform did
 * not, so a tap during a from-host unfold could miss the object where it is drawn and hit it where
 * it is going. The independent review caught exactly that.
 *
 * The fix is an identity rather than an approximation: the arriving component registers the very
 * shared value its paint is driven by, and the pointer route reads that same value through the same
 * pure `arrivalPresentation`. There is no second clock, no mirrored easing and no re-derived
 * progress to drift from — and no interaction is gated on an animation finishing, because the
 * pointer route asks where the object IS, not whether it has arrived.
 *
 * The registry is plain JavaScript. It holds no truth, decides no membership, is never persisted,
 * and an entry lives exactly as long as the component that registered it.
 */
import { ARRIVAL_AT_REST, arrivalPresentation, type ArrivalPresentation, type DisclosureArrivalPlan } from './arrival';
import type { SharedValue } from '../runtime/bridge';

export interface ArrivalRegistry {
  /** Registers one arriving locus. Returns the unbind, for the component's own cleanup. */
  readonly bind: (key: string, plan: DisclosureArrivalPlan, progress: SharedValue<number>) => () => void;
  /**
   * How that locus is presented right now, or `null` when it is not arriving.
   *
   * A bounded read at a pointer event — never per frame — of the same value the paint is driven by.
   */
  readonly presentationOf: (key: string) => ArrivalPresentation | null;
}

interface Entry {
  readonly plan: DisclosureArrivalPlan;
  readonly progress: SharedValue<number>;
}

export function createArrivalRegistry(): ArrivalRegistry {
  const entries = new Map<string, Entry>();
  return Object.freeze({
    bind: (key: string, plan: DisclosureArrivalPlan, progress: SharedValue<number>) => {
      const entry: Entry = { plan, progress };
      entries.set(key, entry);
      return () => {
        // Identity-checked: a remount that registered a newer entry under the same key must not be
        // unbound by the older component's cleanup.
        if (entries.get(key) === entry) entries.delete(key);
      };
    },
    presentationOf: (key: string) => {
      const entry = entries.get(key);
      if (entry === undefined) return null;
      const presentation = arrivalPresentation(entry.plan, entry.progress.get());
      return presentation === ARRIVAL_AT_REST ? null : presentation;
    },
  });
}
