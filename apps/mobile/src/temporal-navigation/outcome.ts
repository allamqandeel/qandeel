/**
 * T-06 — the single outcome vocabulary of every temporal act, and the ONE place a canonical
 * dispatch is turned into it.
 *
 * The canonical store is the only authority: it throws typed `CanonicalStateError`s for a
 * precondition, an authority violation, a shape violation or a later-owner identity. A temporal
 * surface should not have to catch exceptions to stay truthful, so every act in this layer returns
 * a total, typed outcome instead — while the store keeps throwing, unchanged.
 *
 * `NO_OP` and `APPLIED` are the store's own answers, not a local approximation: a true no-op writes
 * no state and appends no RH, and an effective act appends exactly one checkpoint — including the
 * composite one, which is one act and therefore one entry. `REJECTED` carries the store's own error
 * code where the store refused, so nothing is flattened into a generic failure.
 *
 * This layer owns its own vocabulary rather than borrowing the Map's: a temporal refusal is not a
 * Map refusal, and the two unions must be able to move independently.
 */
import {
  CanonicalStateError,
  type CanonicalStateErrorCode,
  type CanonicalStore,
  type DispatchResult,
  type KernelAction,
  type RhEntry,
  type TemporalAction,
} from '../state';

export type TemporalRejectionCode =
  | CanonicalStateErrorCode
  /** No authoritative committed Session Position has been mirrored; nothing is addressable yet. */
  | 'NO_ADDRESSABLE_POSITION'
  /** The candidate is not a Session Position at all (not an integer, or below SP(1)). */
  | 'NOT_ADDRESSABLE'
  /** The candidate is later than the authoritative Live Head; nothing later than `LH` exists. */
  | 'BEYOND_LIVE_HEAD'
  /** The target was identified in a different Session than the one this store mirrors. */
  | 'SESSION_MISMATCH'
  /** A commit or cancellation was asked for while no preview target existed. */
  | 'NO_PREVIEW'
  /** The supplied projection is not the projection of the position this act commits to. */
  | 'STALE_PROJECTION'
  /** The client holds no usable disclosure for the target position (not fetched, or refused). */
  | 'PROJECTION_NOT_AVAILABLE'
  /** The target is not disclosed at the target position, at the depth the camera discloses. */
  | 'NOT_ENTITLED'
  /** The target legitimately has no locus at the target position; no geography is invented. */
  | 'NOT_LOCATABLE'
  | 'INVALID_INPUT';

export type TemporalOutcome =
  | { readonly outcome: 'APPLIED'; readonly entry: RhEntry | null }
  | { readonly outcome: 'NO_OP' }
  | { readonly outcome: 'REJECTED'; readonly code: TemporalRejectionCode; readonly detail: string };

export const temporalRejected = (code: TemporalRejectionCode, detail: string): TemporalOutcome => ({ outcome: 'REJECTED', code, detail });

function report(run: () => DispatchResult): TemporalOutcome {
  try {
    const result = run();
    return result.outcome === 'NO_OP' ? { outcome: 'NO_OP' } : { outcome: 'APPLIED', entry: result.entry };
  } catch (error) {
    if (error instanceof CanonicalStateError) return temporalRejected(error.code, error.message);
    throw error;
  }
}

/**
 * Runs ONE canonical kernel commit and reports the store's own answer. The only two identities this
 * layer ever sends here are `COMMIT_MOMENT` and `COMMIT_LIVE_EDGE`: T-06 owns the interaction and
 * the substrate around them, never a replacement for them.
 */
export function dispatchKernelCommit(store: CanonicalStore, action: KernelAction): TemporalOutcome {
  return report(() => store.dispatch(action));
}

/**
 * Runs ONE authorized temporal act. The action must already carry a runtime authorization from the
 * store's Temporal authority — minted in `targeting/temporal-actions.ts` and nowhere else — so this
 * function cannot be used to smuggle an unauthorized act: the store refuses it.
 */
export function dispatchAuthorizedTemporalAction(store: CanonicalStore, action: TemporalAction): TemporalOutcome {
  return report(() => store.dispatchTemporal(action));
}
