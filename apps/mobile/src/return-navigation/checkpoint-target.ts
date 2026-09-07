/**
 * T-07 — naming a recorded checkpoint without trusting a checkpoint.
 *
 * `EXACT_RETURN` names a checkpoint, and a payload a caller can build is not a name. The public
 * handle here is opaque and provenance-bound: it can be minted only from an entry that is present in
 * a specific store's history at the moment of minting, and the entry it stands for is held in a
 * module-private `WeakMap` rather than on the handle, so the handle discloses nothing and carries no
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
import type { ReturnRejectionCode } from './outcomes';

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

/**
 * Whether this value is a target THIS store minted whose checkpoint is STILL recorded — as a
 * boolean, and nothing else.
 *
 * A presentation surface has a real problem that `isReturnCheckpointTarget` cannot solve: that
 * predicate proves only that SOME store minted the handle. A handle minted by another store is
 * therefore indistinguishable from a local one, so a surface can offer an Exact Return that can
 * never work and only find out when the reader presses it. Provenance lives in this module's private
 * `WeakMap`, so no consumer can answer the question for itself, and answering it by comparing
 * ordinals against the history LENGTH is not an answer at all: a consumed checkpoint's ordinal is
 * re-occupied as soon as unrelated new transactions are recorded, which would resurrect a dead
 * target.
 *
 * So this predicate asks exactly the three questions the execution path asks, and returns only
 * whether all three hold:
 *
 *   1. was this handle minted here at all;
 *   2. does its provenance name THIS store;
 *   3. is the exact provenance entry OBJECT still present in this store's current history.
 *
 * It is deliberately read-only and inert. It yields no `RhEntry`, no captured position, no
 * inspection, no camera and no provenance object; it mints nothing, consumes nothing and mutates
 * nothing; and it grants no authority whatsoever. Being told "yes" is not permission to return —
 * `exactReturn` re-proves provenance AND presence itself, and the store re-proves presence
 * independently after that, both before anything is written. A target that passes here and is
 * consumed a moment later is refused there, exactly as before.
 */
export function isCurrentReturnCheckpointTargetForStore(store: CanonicalStore, target: unknown): target is ReturnCheckpointTarget {
  if (!isReturnCheckpointTarget(target)) return false;
  const provenance = minted.get(target);
  if (provenance === undefined || provenance.store !== store) return false;
  return store.getState().history.includes(provenance.entry);
}

export type ResolvedCheckpointTarget =
  | { readonly ok: true; readonly entry: RhEntry }
  | { readonly ok: false; readonly code: ReturnRejectionCode; readonly detail: string };

/**
 * Provenance first, presence second — and both before any state is touched. Resolving a target
 * grants nothing on its own: the entry it yields is inert without an authorization the return
 * executors alone can mint.
 */
export function resolveCheckpointTarget(store: CanonicalStore, target: unknown): ResolvedCheckpointTarget {
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
