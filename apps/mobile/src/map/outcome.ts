/**
 * T-04 — the single outcome vocabulary of every Map act, and the one place a canonical dispatch
 * is turned into it.
 *
 * The canonical store is the only authority: it throws typed `CanonicalStateError`s for a
 * precondition, an authority violation, a shape violation or a later-owner identity. A Map
 * surface should not have to catch exceptions to stay truthful, so every act in this layer
 * returns a total, typed outcome instead — while the store keeps throwing, unchanged.
 *
 * `NO_OP` and `APPLIED` are the store's own answers, not a local approximation: a true no-op
 * writes no state and appends no RH, and an effective act appends exactly one checkpoint.
 * `REJECTED` carries the store's own error code, so nothing is flattened into a generic failure.
 */
import { CanonicalStateError, type CanonicalStateErrorCode, type CanonicalStore, type DispatchResult, type KernelAction, type RhEntry } from '../state';

export type MapActionRejectionCode =
  | CanonicalStateErrorCode
  | 'NOT_AUTHORIZED'
  /** The supplied projection is no longer the store's current one (R2-01). */
  | 'STALE_PROJECTION'
  | 'CAMERA_NOT_DECODABLE'
  | 'PROJECTION_NOT_AVAILABLE'
  | 'NOT_ENTITLED'
  | 'NOT_LOCATABLE'
  | 'INVALID_INPUT'
  | 'BEYOND_CANONICAL_BOUND'
  | 'AT_RUNG_BOUNDARY';

export type MapActionOutcome =
  | { readonly outcome: 'APPLIED'; readonly entry: RhEntry | null }
  | { readonly outcome: 'NO_OP' }
  | { readonly outcome: 'REJECTED'; readonly code: MapActionRejectionCode; readonly detail: string };

export const rejected = (code: MapActionRejectionCode, detail: string): MapActionOutcome => ({ outcome: 'REJECTED', code, detail });

function report(run: () => DispatchResult): MapActionOutcome {
  try {
    const result = run();
    return result.outcome === 'NO_OP' ? { outcome: 'NO_OP' } : { outcome: 'APPLIED', entry: result.entry };
  } catch (error) {
    if (error instanceof CanonicalStateError) return rejected(error.code, error.message);
    throw error;
  }
}

/** Runs one canonical kernel dispatch and reports its own answer; nothing here decides authority. */
export function dispatchKernelAction(store: CanonicalStore, action: KernelAction): MapActionOutcome {
  return report(() => store.dispatch(action));
}

/**
 * Runs one authorized Map act. The action must already carry a runtime authorization from the
 * store's Map authority — minted in `inspection/map-actions.ts` and nowhere else — so this
 * function cannot be used to smuggle an unauthorized act: the store refuses it.
 */
export function dispatchAuthorizedMapAction(store: CanonicalStore, action: Parameters<CanonicalStore['dispatchMap']>[0]): MapActionOutcome {
  return report(() => store.dispatchMap(action));
}
