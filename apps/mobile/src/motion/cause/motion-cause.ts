/**
 * T-10 — the presentation cause channel: a one-shot note that an ALREADY-EXECUTED act was the
 * composite one AND that it actually produced a spatial phase to explain.
 *
 * Five of the six frozen return acts need no cause at all. Their choreography is read from what
 * actually changed in canonical state — the camera, the rung, or neither — which is a reading of
 * truth rather than a claim about intent, and it is why Return to Live Head moves no camera without
 * anything having to tell it not to.
 *
 * Go Live + Locate is the exception, and only because it is ONE Product transaction carrying TWO
 * truths: the reader is following Live again, and, conditionally, this is where the referent is.
 * Shown together they read as a single jump; shown with a short beat between them the second reads
 * as a consequence of the first. That beat is the entire reason this channel exists.
 *
 * ## R1: the composite is APPLIED far more often than it lands
 *
 * The first version armed on `applied && id === composite`. But the composite is APPLIED whenever
 * its TEMPORAL half succeeded — including when the referent was `NO_FOCUS`, `NOT_ENTITLED`,
 * `NOT_LOCATABLE`, `AMBIGUOUS_LOCUS`, unavailable, stale, or already exactly where the camera is.
 * In every one of those the camera never moves, so nothing consumes the cause, and it sat pending
 * until some later, unrelated landing took it and wore the composite's 110 ms beat.
 *
 * The channel therefore reads the spatial half of the outcome T-07 has ALREADY returned. Only
 * `LANDED` arms it — the one status that means a camera actually moved because of this act — so the
 * pending cause and the transition that consumes it are the same event by construction. It does not
 * decide whether the landing happened; it reads the answer.
 *
 * What the channel is NOT: it is not authority — it cannot cause an act, cancel one, delay one or
 * change one; it is not state — it holds at most one cause and `take` clears it; and it is not a
 * return surface — it never names a target, a place, a direction or a count, and it cannot be read
 * back.
 */
import type { PresentationMotionCause } from '../presentation-camera/travel-plan';

/**
 * The already-returned outcome, in the shape T-07 produces and T-08 reports.
 *
 * Structural rather than imported: this owner may not depend on the return layer's types, and it
 * needs exactly two fields — what happened, and what happened to the SPATIAL half.
 */
export interface ExecutedReturnOutcome {
  readonly outcome: string;
  readonly locate?: string;
}

export interface MotionCauseChannel {
  /**
   * Notes an outcome T-07 has already produced, exactly as T-08's `onReturnOutcome` reports it.
   *
   * Any outcome clears whatever was pending, so a later act can never inherit an older cause — and
   * only a composite that actually landed arms a new one.
   */
  readonly noteReturnOutcome: (id: string, outcome: ExecutedReturnOutcome) => void;
  /** Reads and clears the pending cause. */
  readonly take: () => PresentationMotionCause | null;
}

/** The one composite identity, matched by value so this owner needs no type from T-08. */
const COMPOSITE_RETURN_ID = 'GO_LIVE_AND_LOCATE';
/** The ONE spatial status that means a camera moved because of this act. */
const LANDED = 'LANDED';

export function createMotionCauseChannel(): MotionCauseChannel {
  let pending: PresentationMotionCause | null = null;
  return Object.freeze({
    noteReturnOutcome: (id: string, outcome: ExecutedReturnOutcome) => {
      const landed = id === COMPOSITE_RETURN_ID && outcome.outcome === 'APPLIED' && outcome.locate === LANDED;
      pending = landed ? COMPOSITE_RETURN_ID : null;
    },
    take: () => {
      const cause = pending;
      pending = null;
      return cause;
    },
  });
}
