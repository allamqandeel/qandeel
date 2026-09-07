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
}

/**
 * The frozen shape of each identity: what it does, and what it is therefore allowed to promise.
 *
 * `movesTime` and `movesCamera` describe the act, not the reader's hope. They are constants of the
 * identity, so no state — and in particular no live state — can change what an opportunity claims.
 * The copy is a structural placeholder; final wording, tone and localization belong to a later task.
 */
const SHAPES: Readonly<Record<ReturnOpportunityId, Omit<ReturnOpportunity, 'available'>>> = Object.freeze({
  BACK_ONE_STEP: Object.freeze({
    id: 'BACK_ONE_STEP' as const,
    effect: 'HISTORY' as const,
    movesTime: true,
    movesCamera: true,
    label: 'Back one step',
    hint: 'Reverses your most recent step. It does not return you to the live conversation.',
  }),
  EXACT_RETURN: Object.freeze({
    id: 'EXACT_RETURN' as const,
    effect: 'HISTORY' as const,
    movesTime: true,
    movesCamera: true,
    label: 'Return to the original inspection',
    hint: 'Restores exactly the viewpoint this inspection started from.',
  }),
  RETURN_LIVE_HEAD: Object.freeze({
    id: 'RETURN_LIVE_HEAD' as const,
    effect: 'TEMPORAL' as const,
    movesTime: true,
    // Frozen: this act writes the temporal mode and nothing else. Promising a camera movement here
    // would be a promise the act cannot keep.
    movesCamera: false,
    label: 'Follow the live conversation',
    hint: 'Follows the conversation as it continues. The view does not move.',
  }),
  RETURN_LIVE_FOCUS: Object.freeze({
    id: 'RETURN_LIVE_FOCUS' as const,
    effect: 'SPATIAL' as const,
    // Frozen: this act writes the camera and never the temporal mode. It is not a way to go Live.
    movesTime: false,
    movesCamera: true,
    label: 'Move to where attention is now',
    hint: 'Moves the view to where live attention is. The moment you are reading does not change.',
  }),
  RETURN_WORLD: Object.freeze({
    id: 'RETURN_WORLD' as const,
    effect: 'SPATIAL' as const,
    movesTime: false,
    movesCamera: true,
    label: 'Return to the whole world',
    hint: 'Returns to the world viewpoint at the same moment you are reading.',
  }),
  GO_LIVE_AND_LOCATE: Object.freeze({
    id: 'GO_LIVE_AND_LOCATE' as const,
    effect: 'TEMPORAL_AND_SPATIAL' as const,
    movesTime: true,
    movesCamera: true,
    label: 'Follow the conversation and move there',
    hint: 'Returns to the live conversation and moves the view there, as one step.',
  }),
});

function availabilityOf(id: ReturnOpportunityId, inputs: ReturnCapabilityInputs): boolean {
  const { availability, temporal, focusReturn, exactReturnBound } = inputs;
  switch (id) {
    case 'BACK_ONE_STEP':
      return availability.backAvailable;
    case 'EXACT_RETURN':
      // Bound, never discovered. A recorded checkpoint the reader did not explicitly start an
      // inspection journey from is not an "original inspection", and there is no history to browse.
      return exactReturnBound;
    case 'RETURN_LIVE_HEAD':
      // Meaningful whenever the committed stance is not already following Live. Pinned AT the Live
      // Head still counts: the mode is the effect, and the two modes are different Product states.
      return availability.liveReturnAvailable && temporal.mode === 'PINNED';
    case 'RETURN_LIVE_FOCUS':
      // The ONLY input is the projection-bound answer. `UNPROVEN` is not a quieter `AVAILABLE`.
      return focusReturn === 'AVAILABLE';
    case 'RETURN_WORLD':
      return availability.worldReturnAvailable;
    case 'GO_LIVE_AND_LOCATE':
      // The composite needs an authoritative Live Head to return to. Its spatial half may or may not
      // find somewhere to land, and that is the act's own truthful answer, not a precondition here.
      return availability.liveReturnAvailable;
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

/**
 * The six, always all six, in the frozen logical order.
 *
 * They are never filtered down to "the useful ones": a reader who can see that an act exists and is
 * currently unavailable learns something true about their own position, whereas an act that appears
 * and disappears turns availability itself into a moving signal. What must never move with future
 * truth is the SHAPE — and it cannot, because the shape is a constant.
 */
export function returnOrientation(inputs: ReturnCapabilityInputs): ReturnChrome {
  return Object.freeze({
    opportunities: Object.freeze(
      RETURN_OPPORTUNITY_IDS.map((id) => Object.freeze({ ...SHAPES[id], available: availabilityOf(id, inputs) })),
    ),
    // A count of the reader's own reversible transactions. It is orientation, not a destination
    // list: nothing here can be turned into a named history entry, because nothing names one.
    checkpointCount: inputs.availability.checkpointCount,
  });
}

/** The opportunity with this identity. Every identity is always present, so this never fails. */
export function opportunity(orientation: ReturnChrome, id: ReturnOpportunityId): ReturnOpportunity {
  const found = orientation.opportunities.find((candidate) => candidate.id === id);
  if (found === undefined) throw new RangeError(`the return orientation is missing the frozen identity ${id}`);
  return found;
}
