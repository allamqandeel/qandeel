/**
 * T-07 — the single outcome vocabulary of every return act, and the ONE place a canonical return
 * dispatch is turned into it.
 *
 * The canonical store is the only authority: it throws typed `CanonicalStateError`s for a
 * precondition, an authority violation, a shape violation or an absent checkpoint. A return surface
 * should not have to catch exceptions to stay truthful, so every act in this layer returns a total,
 * typed outcome instead — while the store keeps throwing, unchanged.
 *
 * `NO_OP` and `APPLIED` are the store's own answers, not a local approximation. `consumed` is read
 * back from the store's own history length, so a claim that history was unwound is measured rather
 * than asserted, and every appending act reports zero.
 *
 * ## What an outcome may not say
 *
 * A return outcome is a STATUS, never a place. It carries no Thread identity, no Emerging Focus
 * identity, no label, no coordinate, no direction, no distance and no count of loci, because a
 * reader standing at a historical position may not learn where Live went from the act they used to
 * ask about it. `locate` says only what happened to the spatial part of the act — landed, already
 * there, or one of the truthful reasons nothing moved.
 */
import {
  CanonicalStateError,
  type CanonicalStateErrorCode,
  type CanonicalStore,
  type DispatchResult,
  type RhEntry,
} from '../state';

export type ReturnRejectionCode =
  | CanonicalStateErrorCode
  /** No authoritative committed Session Position has been mirrored; there is nothing to return to. */
  | 'NO_ADDRESSABLE_POSITION'
  /** The supplied projection is not the projection of the viewpoint this act arrives at. */
  | 'STALE_PROJECTION'
  /**
   * The client holds no usable disclosure for the viewpoint this act needs (not fetched, refused by
   * the server, or incoherent). A TECHNICAL answer: it is deliberately never reported as a semantic
   * "there is nowhere to go", because those are different facts about the world.
   */
  | 'PROJECTION_NOT_AVAILABLE'
  /** The named checkpoint is no longer present in the reversible history. */
  | 'STALE_TARGET'
  | 'INVALID_INPUT';

/** Why an act legitimately changed nothing. A no-op is an answer, never a failure. */
export type ReturnNoOpReason =
  | 'EMPTY_HISTORY'
  | 'ALREADY_FOLLOWING_LIVE'
  | 'ALREADY_AT_WORLD_CAMERA'
  | 'NO_LEGITIMATE_LANDING'
  | 'NO_EFFECTIVE_CHANGE';

/**
 * What happened to the SPATIAL part of an act. Every value is about the act, never about the world:
 * none of them names a target, a place, a direction or a number of places.
 */
export type ReturnLocateStatus =
  /** This identity carries no locate at all (Return to Live Head, Back, Exact Return). */
  | 'NOT_ATTEMPTED'
  | 'LANDED'
  | 'ALREADY_THERE'
  /** There was no Live Focus to return to at the moment the act bound one. */
  | 'NO_FOCUS'
  /** The bound referent is not disclosed at this viewpoint. Nothing is invented in its place. */
  | 'NOT_ENTITLED'
  /** The bound referent is disclosed here and legitimately has no place on the Map. */
  | 'NOT_LOCATABLE'
  /** The bound referent has several legitimate places here; nothing is elected. */
  | 'AMBIGUOUS_LOCUS'
  /** A technical projection answer, never a semantic one. */
  | 'PROJECTION_NOT_AVAILABLE'
  | 'STALE_PROJECTION';

export type ReturnOutcome =
  | {
      readonly outcome: 'APPLIED';
      /** The one appended checkpoint, or `null` for the two acts that consume instead of appending. */
      readonly entry: RhEntry | null;
      /** How many recorded checkpoints this act consumed. Zero for every appending act. */
      readonly consumed: number;
      readonly locate: ReturnLocateStatus;
    }
  | { readonly outcome: 'NO_OP'; readonly reason: ReturnNoOpReason; readonly locate: ReturnLocateStatus }
  | { readonly outcome: 'REJECTED'; readonly code: ReturnRejectionCode; readonly detail: string };

export const returnRejected = (code: ReturnRejectionCode, detail: string): ReturnOutcome => ({ outcome: 'REJECTED', code, detail });

export const returnNoOp = (reason: ReturnNoOpReason, locate: ReturnLocateStatus): ReturnOutcome => ({ outcome: 'NO_OP', reason, locate });

/** Restates an outcome with the spatial status its act actually reached. A refusal is unchanged. */
export function withLocate(outcome: ReturnOutcome, locate: ReturnLocateStatus): ReturnOutcome {
  switch (outcome.outcome) {
    case 'APPLIED':
      return { outcome: 'APPLIED', entry: outcome.entry, consumed: outcome.consumed, locate };
    case 'NO_OP':
      return { outcome: 'NO_OP', reason: outcome.reason, locate };
    default:
      return outcome;
  }
}

/** Restates a no-op with the reason its act actually reached. Anything else is unchanged. */
export function withNoOpReason(outcome: ReturnOutcome, reason: ReturnNoOpReason): ReturnOutcome {
  return outcome.outcome === 'NO_OP' ? { outcome: 'NO_OP', reason, locate: outcome.locate } : outcome;
}

/**
 * Turns ONE canonical dispatch attempt into this layer's vocabulary. It performs no dispatch of its
 * own and holds no action: the caller supplies the thunk, so this module cannot reach the canonical
 * return seam at all and cannot become a second route to it. `consumed` is measured from the store's
 * own history length rather than asserted, so a claim that history was unwound is a reading.
 */
export function reportReturnDispatch(store: CanonicalStore, run: () => DispatchResult): ReturnOutcome {
  const before = store.getState().history.length;
  try {
    const result = run();
    if (result.outcome === 'NO_OP') return returnNoOp('NO_EFFECTIVE_CHANGE', 'NOT_ATTEMPTED');
    const consumed = Math.max(0, before - store.getState().history.length);
    return { outcome: 'APPLIED', entry: result.entry, consumed, locate: 'NOT_ATTEMPTED' };
  } catch (error) {
    if (error instanceof CanonicalStateError) return returnRejected(error.code, error.message);
    throw error;
  }
}
