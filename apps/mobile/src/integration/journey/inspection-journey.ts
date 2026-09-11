/**
 * T-12 §14 / `QAN-BL-T12-01` — establishing the Original Inspection origin at the REAL journey
 * boundary.
 *
 * ## What the Product actually promises
 *
 * The frozen bilingual copy is the specification, and it is exact in both languages:
 *
 *     "Return to the original inspection" / "العودة إلى المعاينة الأصلية"
 *     "Restores exactly the viewpoint this inspection started from."
 *     "يستعيد بالضبط الموضع الذي بدأت منه هذه المعاينة."
 *
 * *The viewpoint this inspection started FROM.* An RH entry captures the PRE-act viewpoint, so the
 * checkpoint that satisfies that sentence is the one appended by the act that BEGAN the journey —
 * not the newest checkpoint, not the oldest, not a plausible ordinal, and not the checkpoint of any
 * later act inside the same journey.
 *
 * ## When a journey begins
 *
 * When an act establishes an inspection where there was none: `before.inspection === null` and
 * `after.inspection !== null`. Two acts can do that, and the store's own transitions are what say so
 * — `INSPECT_OBJECT` writes `IF_ref` alone, `DIRECT_JUMP` writes it with its authorized landing, and
 * `SWITCH_CONTEXT` refuses outright unless an inspection already exists. An act that moves from one
 * inspection to another CONTINUES the journey and must not replace its origin; that is the whole
 * point of the capability, and rebinding on every inspection would silently turn Exact Return into a
 * second Back One Step.
 *
 * ## When it ends
 *
 * The moment `IF_ref` returns to `null` by any route — Return to World, Back One Step, an Exact
 * Return that consumed the origin itself, or any future act that clears the reference. The journey is
 * over, so the origin is dropped rather than left to attach itself to the next unrelated one. Store
 * or runtime replacement retires it too.
 *
 * Nothing here persists: T-13 owns restart and recovery, and an origin that outlived the process
 * would name a checkpoint in a reversible history that no longer exists.
 *
 * ## What this cannot do, by construction
 *
 * It cannot manufacture an origin from an arbitrary checkpoint. The handle is minted by T-08, which
 * admits only a target T-07 confirms was recorded by a journey-capable act — so even a coordinator
 * bug that offered the wrong entry could not produce a Return-to-World checkpoint labelled "the
 * original inspection". And it grants nothing: T-07 re-proves provenance and presence at execution,
 * which is why a consumed origin disappears forever and history regrowing past its old position
 * cannot resurrect it.
 */

import { bindExactReturnOrigin, type ExactReturnOrigin } from '../../orientation-chrome';
import { returnCheckpoints } from '../../return-navigation';
import type { CanonicalState, CanonicalStore, RhEntry } from '../../state';

export interface InspectionJourneyCoordinator {
  /**
   * Observe ONE completed act, with the reversible-history entry it appended.
   *
   * `before` and `after` are canonical state either side of that single dispatch, and `entry` is the
   * entry the act itself appended — by object identity, as the executors return it. A consuming act
   * appends nothing and passes `null`.
   */
  observeAct(store: CanonicalStore, before: CanonicalState, after: CanonicalState, entry: RhEntry | null): void;
  /**
   * Observe canonical state that changed without an act this coordinator saw.
   *
   * It can only ever END a journey, never begin one: beginning needs the appended entry, and an
   * entry is not recoverable from a state snapshot.
   */
  observeState(store: CanonicalStore, state: CanonicalState): void;
  /** The origin currently bound, or `null`. Never a guess. */
  origin(): ExactReturnOrigin | null;
  /** Drop the origin without consuming it: a replaced store or a retired runtime generation. */
  retire(): void;
}

interface BoundJourney {
  readonly store: CanonicalStore;
  readonly origin: ExactReturnOrigin;
}

/**
 * Resolves the checkpoint target for the exact entry this act appended.
 *
 * `returnCheckpoints` is index-aligned with the store's own history, so locating the entry OBJECT in
 * that history and taking the target at the same position names THAT checkpoint and no other. An
 * entry the store does not record — a forged one, a structural copy, one from another store, one
 * already consumed — is simply not found, and no target is produced.
 */
function targetForAppendedEntry(store: CanonicalStore, entry: RhEntry) {
  const index = store.getState().history.indexOf(entry);
  if (index < 0) return null;
  return returnCheckpoints(store)[index] ?? null;
}

export function createInspectionJourneyCoordinator(generation: number): InspectionJourneyCoordinator {
  let bound: BoundJourney | null = null;
  let boundGeneration: number | null = null;

  const clear = () => {
    bound = null;
    boundGeneration = null;
  };

  return {
    observeAct(store, before, after, entry) {
      if (bound !== null && bound.store !== store) clear();

      // The journey ended. Checked first, so an act that both clears an inspection and appends a
      // checkpoint cannot be mistaken for one that starts a journey.
      if (after.inspection === null) {
        clear();
        return;
      }
      // Already inside a journey: this act continues it and the origin is left exactly as it is.
      if (before.inspection !== null) return;
      // A journey begins only where an act actually recorded the viewpoint it began from. An
      // effective act that appended nothing has no checkpoint to return to, so no origin exists —
      // which is the correct absence rather than a nearby substitute.
      if (entry === null) return;

      const target = targetForAppendedEntry(store, entry);
      if (target === null) return;
      const origin = bindExactReturnOrigin(store, target);
      if (origin === null) return;
      bound = { store, origin };
      boundGeneration = generation;
    },

    observeState(store, state) {
      if (bound === null) return;
      if (bound.store !== store || state.inspection === null) clear();
    },

    origin() {
      return bound !== null && boundGeneration === generation ? bound.origin : null;
    },

    retire: clear,
  };
}
