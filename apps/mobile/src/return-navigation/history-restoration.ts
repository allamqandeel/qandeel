/**
 * T-07 — reversible-history restoration: `BACK_ONE_STEP` (P8) and `EXACT_RETURN` (P7).
 *
 * These are the only two acts in the system that REDUCE `RH`, and they append nothing. Both restore
 * a recorded checkpoint exactly — the captured Session Position as `PINNED`, the exact inspection
 * reference with its contextual, version and lineage references, the exact camera anchor,
 * orientation, scale and destination presence or absence, and the exact semantic depth — and then
 * the store consumes history through the checkpoint they restored from.
 *
 *   Back            reverses the LATEST effective user-visible transaction: restore it, remove it.
 *   Exact Return    restores a NAMED earlier checkpoint and consumes it together with every newer
 *                   entry, so the restored viewpoint does not linger as a redundant Back step.
 *
 * Neither ever appends, so a Back chain walks strictly backwards and can never oscillate forward.
 * Neither calls router back: Product history is `RH`, and a route stack is not Product truth.
 * Neither recomputes an equivalent object, repairs an unavailable one, recentres a sparse camera or
 * fetches anything: restoration is canonical intent, and renderability is projection's answer.
 *
 * ## Targeting a checkpoint without trusting a checkpoint
 *
 * Exact Return names a checkpoint, and a payload a caller can build is not a name. The public handle
 * here is opaque and provenance-bound: it can be minted only from an entry that is present in a
 * specific store's history at the moment of minting, and the entry it stands for is held in a module
 * private `WeakMap` rather than on the handle, so the handle discloses nothing and carries no
 * authority of its own.
 *
 * At execution the provenance is re-proven against CURRENT history, before anything is written:
 *
 *   - a structurally identical object nobody minted is not in the map;
 *   - a copied or JSON round-tripped handle is a different object and is not in the map;
 *   - a handle minted from another store, or another session's store, names a different store;
 *   - a handle whose entry has already been consumed is no longer present in history;
 *   - a replay after success fails for exactly that reason.
 *
 * The store then re-proves the same thing independently, by locating the entry OBJECT in its own
 * current history, so a refusal never depends on this module having asked first.
 */
import type { CanonicalStore, RhEntry } from '../state';
import { committedReturn, type ReturnSurface } from './surface';
import { runReturnPlan } from './authority';
import { returnNoOp, returnRejected, type ReturnOutcome, type ReturnRejectionCode } from './outcomes';

/**
 * An opaque, runtime-only handle for one checkpoint in one store's current reversible history.
 *
 * It exposes its ordinal position and nothing else: no Session Position, no inspection reference, no
 * camera, no label. `index` is evidence for a caller, never authority — the authority is provenance,
 * re-proven at execution.
 */
export interface ReturnCheckpointTarget {
  readonly index: number;
}

interface TargetProvenance {
  readonly store: CanonicalStore;
  readonly entry: RhEntry;
}

const minted = new WeakMap<ReturnCheckpointTarget, TargetProvenance>();

/** True only for a handle this module produced. A structural look-alike is not a target. */
export function isReturnCheckpointTarget(value: unknown): value is ReturnCheckpointTarget {
  return typeof value === 'object' && value !== null && minted.has(value as ReturnCheckpointTarget);
}

function mint(store: CanonicalStore, entry: RhEntry, index: number): ReturnCheckpointTarget {
  const handle: ReturnCheckpointTarget = Object.freeze({ index });
  minted.set(handle, { store, entry });
  return handle;
}

/** Every checkpoint currently recorded in this store's reversible history, oldest first. */
export function returnCheckpoints(store: CanonicalStore): readonly ReturnCheckpointTarget[] {
  return Object.freeze(store.getState().history.map((entry, index) => mint(store, entry, index)));
}

/** The latest recorded checkpoint, or `null` when nothing is reversible. */
export function latestReturnCheckpoint(store: CanonicalStore): ReturnCheckpointTarget | null {
  const history = store.getState().history;
  if (history.length === 0) return null;
  return mint(store, history[history.length - 1], history.length - 1);
}

type ResolvedTarget = { readonly ok: true; readonly entry: RhEntry } | { readonly ok: false; readonly code: ReturnRejectionCode; readonly detail: string };

/** Provenance first, presence second — and both before any state is touched. */
function resolveTarget(store: CanonicalStore, target: unknown): ResolvedTarget {
  if (!isReturnCheckpointTarget(target)) {
    return { ok: false, code: 'INVALID_INPUT', detail: 'the target was not derived from a recorded checkpoint' };
  }
  const provenance = minted.get(target);
  if (provenance === undefined || provenance.store !== store) {
    return { ok: false, code: 'INVALID_INPUT', detail: 'the target was derived from a different store' };
  }
  if (!store.getState().history.includes(provenance.entry)) {
    return { ok: false, code: 'STALE_TARGET', detail: 'the target checkpoint is no longer present in the reversible history' };
  }
  return { ok: true, entry: provenance.entry };
}

/**
 * `BACK_ONE_STEP` (P8). With an empty history nothing at all happens — no state mutation, no
 * refusal dressed up as an act — and with a non-empty one the latest checkpoint is restored and
 * removed. The target is taken from the store's own current history here, so Back needs no handle
 * from a caller and no caller-supplied payload can influence which step it reverses.
 */
export function backOneStep(surface: ReturnSurface): ReturnOutcome {
  return committedReturn(surface, (store) => {
    const history = store.getState().history;
    if (history.length === 0) return returnNoOp('EMPTY_HISTORY', 'NOT_ATTEMPTED');
    return runReturnPlan(store, { act: 'BACK_ONE_STEP', target: history[history.length - 1] });
  });
}

/**
 * `EXACT_RETURN` (P7). Restores the named checkpoint and consumes it together with every newer
 * entry. A target that is absent, stale, forged, copied or already consumed is refused with the
 * state and the history left object-equivalent.
 */
export function exactReturn(surface: ReturnSurface, target: ReturnCheckpointTarget): ReturnOutcome {
  return committedReturn(surface, (store) => {
    const resolved = resolveTarget(store, target);
    if (!resolved.ok) return returnRejected(resolved.code, resolved.detail);
    return runReturnPlan(store, { act: 'EXACT_RETURN', target: resolved.entry });
  });
}
