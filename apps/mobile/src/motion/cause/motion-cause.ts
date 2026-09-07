/**
 * T-10 — the presentation cause channel: a one-shot note that an ALREADY-EXECUTED act was the
 * composite one.
 *
 * Five of the six frozen return acts need no cause at all. Their choreography is read from what
 * actually changed in canonical state — the camera, the rung, or neither — which is a reading of
 * truth rather than a claim about intent, and it is why Return to Live Head moves no camera
 * without anything having to tell it not to.
 *
 * Go Live + Locate is the exception, and only because it is ONE Product transaction carrying TWO
 * truths: the reader is following Live again, and, conditionally, this is where the referent is.
 * Shown together they read as a single jump; shown with a short beat between them the second reads
 * as a consequence of the first. That beat is the entire reason this channel exists.
 *
 * What the channel is NOT:
 *
 *   - it is not authority. It is written from an outcome the T-07 executor has ALREADY returned;
 *     it cannot cause an act, cancel one, delay one or change one;
 *   - it is not state. It holds at most one pending cause, it is consumed by the first camera
 *     change that reads it, and an act that moved no camera simply leaves it to expire on the next
 *     read. A cause can therefore never accumulate, replay, or attach itself to a later act;
 *   - it is not a return surface. It never names a target, a place, a direction or a count, and it
 *     cannot be read back — `take` clears.
 */
import type { PresentationMotionCause } from '../presentation-camera/travel-plan';

export interface MotionCauseChannel {
  /**
   * Notes an outcome T-07 has already produced, exactly as T-08's `onReturnOutcome` reports it.
   *
   * `id` is the opportunity identity the chrome offered; `applied` says whether the store actually
   * changed. A refusal and a no-op arm nothing, so a Return that changed nothing cannot make the
   * next unrelated landing pause for an explanation it does not owe.
   */
  readonly noteReturnOutcome: (id: string, applied: boolean) => void;
  /** Reads and clears the pending cause. */
  readonly take: () => PresentationMotionCause | null;
}

/** The one composite identity, matched by value so this owner needs no type from T-08. */
const COMPOSITE_RETURN_ID = 'GO_LIVE_AND_LOCATE';

export function createMotionCauseChannel(): MotionCauseChannel {
  let pending: PresentationMotionCause | null = null;
  return Object.freeze({
    noteReturnOutcome: (id: string, applied: boolean) => {
      pending = applied && id === COMPOSITE_RETURN_ID ? COMPOSITE_RETURN_ID : null;
    },
    take: () => {
      const cause = pending;
      pending = null;
      return cause;
    },
  });
}
