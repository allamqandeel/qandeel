/**
 * T-08 — the six frozen return acts, as six Product opportunities.
 *
 * This module decides only WHICH of the six is meaningful right now and WHAT each one is allowed to
 * promise. It executes nothing, mints nothing and authorizes nothing: every act runs through T-07's
 * own executor, behind T-07's own runtime authority, and this layer never gains a way to reach the
 * canonical return seam.
 *
 * ## Why there is no seventh, and no merged one
 *
 * The six differ in read-set, write-set, history rule and target-binding rule, and every one of
 * those differences is frozen Product truth. A generic `Home`, `Reset`, `Navigate`, `Go Live`,
 * `BackOrHome` or `Return` would make the differences unstatable — a reader who pressed it could not
 * know whether they had moved in time, in space, in both, or backwards through their own history. So
 * the vocabulary here is the frozen one, the order is fixed and logical, and each opportunity states
 * its own effect rather than borrowing another's.
 *
 * ## Two promises that are frequently confused, and are opposites
 *
 *   Return to Live Head is TEMPORAL ONLY. It follows the live conversation again and moves no
 *   camera, so it must never be presented as taking the reader anywhere.
 *
 *   Return to Live Focus is SPATIAL ONLY. It moves the camera to where live attention is and does
 *   not move the reader in time at all, so it must never be presented as going Live.
 *
 * Go Live + Locate is the ONE composite that does both, as a single Product transaction, and it says
 * so — never disguised as either half.
 *
 * ## Why the Live Focus opportunity is not derived from `LF`
 *
 * `LF != NONE` is live truth, and from a historical position live truth is future-relative. A
 * control whose existence, enabled state, label, hint or accessibility state moved with it would
 * leak the presence of a future object through the chrome — and would also overstate the capability,
 * because a live Thread with no place at `K(TC)` is not a landing. So the only input here is the
 * projection-bound answer, and the label and hint are CONSTANTS that do not move with it either.
 */
import type { ReturnAvailability } from '../return-navigation';
import type { LiveChrome, ReturnOpportunity, ReturnOpportunityId, ReturnChrome, TemporalChrome } from './types';
import { RETURN_OPPORTUNITY_IDS } from './types';

/**
 * Everything the six opportunities may be derived from.
 *
 * There is deliberately no `CanonicalState` here and no `LiveFocus`: the only Live input is
 * `focusReturn`, which was already answered against a proven projection, so no shortcut back to raw
 * live truth exists in this module even by accident.
 */
export interface ReturnCapabilityInputs {
  readonly availability: ReturnAvailability;
  readonly temporal: TemporalChrome;
  readonly focusReturn: LiveChrome['focusReturn'];
  /**
   * A legitimate opaque checkpoint target has been bound from a real explicit inspection journey and
   * its justification has not been invalidated. T-08 never mints one, never guesses one, and never
   * assumes the oldest recorded checkpoint is the original inspection.
   */
  readonly exactReturnBound: boolean;
  /**
   * This mounted surface can actually attempt the composite's spatial half.
   *
   * Go Live + Locate resolves the LIVE viewpoint's disclosure through a provider the surface supplies.
   * Without one there is nothing to attempt with, so offering the act would advertise a capability
   * this surface does not have — and quietly substituting a permanent "not fetched" provider to keep
   * the control on screen would make that permanent.
   *
   * It is a fact about the CLIENT, not about the world: whether a provider exists is decided before
   * anything is known about Live, it cannot move with `LF`, and it therefore discloses nothing. It
   * does not promise a landing either — a real provider that never resolves a disclosure still leaves
   * the temporal half correct, which is a valid outcome of the one act.
   */
  readonly liveContextAvailable: boolean;
}

/**
 * The frozen shape of each identity: what it is FOR, and what it may therefore promise per dimension.
 *
 * These are constants of the identity, so no state — and in particular no live state — can change
 * what an opportunity claims.
 *
 * R3-03. The promises used to be two booleans, and four of the six acts fit neither value. Back and
 * Exact Return restore a CAPTURED tuple, so any individual field may legitimately come back unchanged;
 * Return to Live Focus attempts the camera once and an authorization race may make that a no-op; and
 * the composite's spatial half happens only if the referent it bound at the post-live boundary turns
 * out to be locatable at `K(LH)`. A boolean forced a choice between two lies, so each dimension now
 * carries its own typed promise and the copy is written from it.
 *
 * The WORDS are not written here. Every reader-facing sentence in this layer lives in
 * `product-copy.ts`, in both Product languages, so there is exactly one file a Product writer edits
 * and exactly one place the "no engineering vocabulary reaches the reader" rule has to hold. What
 * this module owns is the structural half of each identity — and nothing here is ever an input to
 * WHICH executor runs, so this metadata cannot become a second execution authority.
 */
const SHAPES: Readonly<Record<ReturnOpportunityId, ReturnOpportunity>> = Object.freeze({
  BACK_ONE_STEP: Object.freeze({
    id: 'BACK_ONE_STEP' as const,
    effect: 'HISTORY' as const,
    intent: 'RESTORE_LATEST_CAPTURED_VIEWPOINT' as const,
    // A captured tuple is restored in all three dimensions. Whether any of them physically differs
    // depends on how the capture compares with now, which is not knowable here and is not promised.
    effects: Object.freeze({
      temporal: 'RESTORED_IF_DIFFERENT' as const,
      spatial: 'RESTORED_IF_DIFFERENT' as const,
      inspection: 'RESTORED_IF_DIFFERENT' as const,
    }),
  }),
  EXACT_RETURN: Object.freeze({
    id: 'EXACT_RETURN' as const,
    effect: 'HISTORY' as const,
    intent: 'RESTORE_BOUND_INSPECTION_EXACTLY' as const,
    effects: Object.freeze({
      temporal: 'RESTORED_IF_DIFFERENT' as const,
      spatial: 'RESTORED_IF_DIFFERENT' as const,
      inspection: 'RESTORED_IF_DIFFERENT' as const,
    }),
  }),
  RETURN_LIVE_HEAD: Object.freeze({
    id: 'RETURN_LIVE_HEAD' as const,
    effect: 'TEMPORAL' as const,
    intent: 'ESTABLISH_FOLLOW_LIVE' as const,
    // Frozen: this act writes the temporal mode and nothing else. Promising camera movement here
    // would be a promise the act cannot keep.
    effects: Object.freeze({ temporal: 'DIRECT' as const, spatial: 'PRESERVED' as const, inspection: 'PRESERVED' as const }),
  }),
  RETURN_LIVE_FOCUS: Object.freeze({
    id: 'RETURN_LIVE_FOCUS' as const,
    effect: 'SPATIAL' as const,
    intent: 'LOCATE_LIVE_FOCUS_ONCE' as const,
    // Frozen: this act writes the camera and never the temporal mode. It is not a way to go Live,
    // and its one attempt is entitlement- and race-bounded rather than guaranteed.
    effects: Object.freeze({ temporal: 'PRESERVED' as const, spatial: 'ONE_SHOT_BOUNDED' as const, inspection: 'PRESERVED' as const }),
  }),
  RETURN_WORLD: Object.freeze({
    id: 'RETURN_WORLD' as const,
    effect: 'SPATIAL' as const,
    intent: 'RETURN_TO_WORLD_VIEWPOINT' as const,
    effects: Object.freeze({ temporal: 'PRESERVED' as const, spatial: 'DIRECT' as const, inspection: 'PRESERVED' as const }),
  }),
  GO_LIVE_AND_LOCATE: Object.freeze({
    id: 'GO_LIVE_AND_LOCATE' as const,
    effect: 'TEMPORAL_AND_SPATIAL' as const,
    intent: 'GO_LIVE_THEN_LOCATE_ONCE' as const,
    // The ONE asymmetric act: its temporal half is owned, its spatial half is conditional on a
    // landing nobody can know about at activation. This is the pair a boolean could not express.
    effects: Object.freeze({
      temporal: 'DIRECT' as const,
      spatial: 'CONDITIONAL_POST_LIVE_LOCATE' as const,
      inspection: 'PRESERVED' as const,
    }),
  }),
});

/**
 * Whether this act is meaningful for the reader RIGHT NOW.
 *
 * Every input is knowledge-safe: the reader's own reversible history, their own camera, their own
 * committed temporal stance, an origin they themselves bound, and — for Live Focus alone — the
 * projection-bound answer. Nothing here can move with a fact the reader's own `K(TC)` does not
 * disclose, which is why a context-sensitive set is still a no-hindsight set.
 */
function isMeaningful(id: ReturnOpportunityId, inputs: ReturnCapabilityInputs): boolean {
  const { availability, temporal, focusReturn, exactReturnBound, liveContextAvailable } = inputs;
  switch (id) {
    case 'BACK_ONE_STEP':
      return availability.backAvailable;
    case 'EXACT_RETURN':
      // Bound, never discovered. A recorded checkpoint the reader did not explicitly start an
      // inspection journey from is not an "original inspection", and there is no history to browse.
      return exactReturnBound;
    case 'RETURN_LIVE_HEAD':
      // Meaningful only while the committed stance is not already following Live. Pinned AT the Live
      // Head still counts: the mode is the effect, and the two modes are different Product states.
      return availability.liveReturnAvailable && temporal.mode === 'PINNED';
    case 'RETURN_LIVE_FOCUS':
      // The ONLY input is the projection-bound answer. `UNPROVEN` is not a quieter `AVAILABLE`.
      return focusReturn === 'AVAILABLE';
    case 'RETURN_WORLD':
      return availability.worldReturnAvailable;
    case 'GO_LIVE_AND_LOCATE':
      // The composite is offered only where it is MATERIALLY distinct from its own halves. While the
      // reader already follows Live its temporal half does nothing, so it would collapse into
      // "Return to Live Focus" and become a second button for one act. While the reader is
      // historical it is genuinely a third thing: go back to Live AND move there, as one step.
      //
      // And only where this surface can actually attempt the spatial half at all. Provider presence
      // is a client capability, decided before anything about Live is known, so requiring it adds no
      // future-relative input to the offered set.
      return availability.liveReturnAvailable && temporal.mode === 'PINNED' && liveContextAvailable;
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

/**
 * The acts that are meaningful right now, in the frozen logical order.
 *
 * Deliberately NOT all six. A permanent six-control matrix is a toolbar, and a toolbar is the
 * dashboard drift the Product contract forbids: it presents the whole vocabulary of the system as
 * though every part of it were a live choice. What a reader needs is the minimum set that is true
 * here.
 *
 * The six MEANINGS are untouched by that. Each keeps its own identity, effect, promises and wording;
 * none is merged into a generic act; and the decision to offer one is never a decision about what it
 * means. `RETURN_OPPORTUNITY_IDS` remains the frozen vocabulary whether or not an act is offered.
 */
export function returnOrientation(inputs: ReturnCapabilityInputs): ReturnChrome {
  return Object.freeze({
    offered: Object.freeze(RETURN_OPPORTUNITY_IDS.filter((id) => isMeaningful(id, inputs)).map((id) => SHAPES[id])),
    // A count of the reader's own reversible transactions. It is orientation, not a destination
    // list: nothing here can be turned into a named history entry, because nothing names one.
    checkpointCount: inputs.availability.checkpointCount,
  });
}

/** The offered opportunity with this identity, or `null` when it is not meaningful right now. */
export function opportunity(orientation: ReturnChrome, id: ReturnOpportunityId): ReturnOpportunity | null {
  return orientation.offered.find((candidate) => candidate.id === id) ?? null;
}

/** The frozen meaning of one identity, offered or not. It is a constant: no state can move it. */
export function returnMeaning(id: ReturnOpportunityId): ReturnOpportunity {
  return SHAPES[id];
}
