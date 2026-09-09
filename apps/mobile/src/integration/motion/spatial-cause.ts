/**
 * T-12 §15 / `QAN-BL-MOT-02` — binding ONE executed Return outcome to the EXACT canonical camera
 * transition it caused.
 *
 * ## Why T-10 could not do this, and why a mailbox is not the answer
 *
 * T-10 owns the choreography: `presentationTravelPlan` already knows `GO_LIVE_AND_LOCATE` and
 * already holds the composite beat for it. What it could not own is *which* canonical change an
 * already-returned outcome belongs to — a composition fact. Its own contract records the shape of
 * the wrong answer precisely: a channel that remembers "a composite happened recently" and hands it
 * to whoever asks next is a MAILBOX, and a mailbox lets an unrelated camera action wear a beat that
 * belongs to an act a later action has already superseded. No narrowing fixes that, because the
 * defect is the shape.
 *
 * ## The shape that is not a mailbox
 *
 * A binding NAMES ITS TARGET. This one is armed with the exact `CameraIntent` OBJECT that the
 * `GO_LIVE_AND_LOCATE` dispatch published, together with the store that published it and the runtime
 * generation both belong to. It is then offered to exactly one question:
 *
 *     is the destination you are about to travel to the destination I was armed with?
 *
 * Every required property falls out of that question rather than being enforced on top of it:
 *
 *   **one exact transition** — the destination is an object identity, not a description. Two acts
 *   that happen to produce equal camera values are still two different objects;
 *
 *   **one owner generation** — the store and the runtime generation are part of the key, so a
 *   bundle replacement can never satisfy it;
 *
 *   **one shot** — `take` clears the binding whatever it answers;
 *
 *   **invalidated by an intervening act** — this is the property a mailbox cannot have, and here it
 *   needs no mechanism at all. An intervening act publishes a DIFFERENT camera object, so the next
 *   `take` asks about that object, misses, and clears. The binding cannot survive to be borrowed,
 *   because the first question asked of it always consumes it;
 *
 *   **no timeout, no timestamp, no "next camera change wins"** — nothing here reads a clock, counts,
 *   or orders anything. There is one question with one correct answer.
 *
 * ## What arms it, and what deliberately does not
 *
 * Only a `GO_LIVE_AND_LOCATE` execution whose CAMERA actually moved. `locate: 'LANDED'` is NOT that
 * evidence and must not be used as it: the act is a composite, `Φ_eff` covers `TM` as well as `MC`,
 * so a P5 that only went Live — the referent already exactly where the reader is looking — is
 * `APPLIED` and `LANDED` with the camera untouched. Arming on `LANDED` would give a beat to a
 * transition that never happens, and on the next unrelated travel the binding would be there to be
 * mis-asked. So the predicate is the honest one, read from canonical state either side of the one
 * dispatch: did `MC` change, by T-02's own equality.
 *
 * That also settles the two boundary cases the contract names by hand. *No legitimate landing* leaves
 * the temporal half standing alone, which moves no camera, so nothing is armed. *Already there* is
 * either a whole-act `NO_OP` or an effective act whose camera half changed nothing — the same test
 * refuses both, so no travel is invented.
 *
 * ## Class D throughout
 *
 * Nothing here dispatches, writes a canonical field, appends or consumes reversible history, reads a
 * projection, or decides what is true. The cause changes exactly one thing downstream: whether
 * T-10's already-frozen plan holds the preserved frame for one beat before showing the spatial half.
 * Under reduced motion the plan keeps that beat over a representable destination and drops the
 * travel, which is T-10's rule and not this module's — the same act, the same destination, the same
 * canonical truth, with or without a cause.
 */

import type { PresentationMotionCause } from '../../motion';
import { cameraIntentEquals, type CameraIntent, type CanonicalState, type CanonicalStore } from '../../state';

/** What was armed, and everything it is bound to. Never exported; never observable. */
interface ArmedSpatialCause {
  readonly store: CanonicalStore;
  readonly generation: number;
  /** The exact camera object the arming dispatch published. Identity, never a description. */
  readonly destination: CameraIntent;
}

export interface SpatialCauseBinding {
  /**
   * Arm the composite cause for the transition this dispatch caused, if it caused one.
   *
   * `before` is the canonical state read immediately before the single `GO_LIVE_AND_LOCATE`
   * dispatch and `after` the state immediately following it, so "did the camera move" is answered
   * from canonical truth rather than from an outcome's spatial status.
   *
   * Returns whether a cause was armed, so a caller can prove the negative cases.
   */
  arm(store: CanonicalStore, before: CanonicalState, after: CanonicalState): boolean;
  /**
   * Ask the ONE question, and consume the binding whatever the answer.
   *
   * Called by the surface at the moment it applies a canonical camera transition, with the exact
   * destination it is travelling to.
   */
  take(store: CanonicalStore, destination: CameraIntent): PresentationMotionCause | null;
  /** Retire without consuming: a replaced store or a retired runtime generation. */
  retire(): void;
  /** Whether a cause is currently armed. For proofs and for nothing else. */
  isArmed(): boolean;
}

/**
 * One binding per runtime generation.
 *
 * The generation is captured at construction rather than read per call, so a binding built for a
 * retired bundle can never answer for the current one even if a stale closure still holds it.
 */
export function createSpatialCauseBinding(generation: number): SpatialCauseBinding {
  let armed: ArmedSpatialCause | null = null;

  return {
    arm(store, before, after) {
      // The whole predicate. A composite act that only went Live moved no camera and earns no
      // spatial beat, whatever its `locate` status said.
      if (cameraIntentEquals(before.camera, after.camera)) return false;
      armed = { store, generation, destination: after.camera };
      return true;
    },

    take(store, destination) {
      const held = armed;
      // Consumed by the question, not by the answer. This single line is what makes an intervening
      // act retire the binding instead of leaving it to be borrowed by the act after that.
      armed = null;
      if (held === null) return null;
      if (held.store !== store || held.generation !== generation) return null;
      return held.destination === destination ? 'GO_LIVE_AND_LOCATE' : null;
    },

    retire() {
      armed = null;
    },

    isArmed() {
      return armed !== null;
    },
  };
}
