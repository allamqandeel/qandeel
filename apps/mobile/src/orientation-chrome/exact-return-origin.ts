/**
 * T-08 — binding an Exact Return opportunity to the inspection journey that legitimately created it.
 *
 * ## The defect this closes, and why the first attempt did not close it
 *
 * A checkpoint handle minted by ANOTHER store is a real handle. `isReturnCheckpointTarget` says so,
 * because it proves only that some store minted it. T-07 refuses it correctly at execution — but only
 * at execution, so until then the Product offered a capability that could never work.
 *
 * R1 tried to close that by recording which store the caller SAID the target belonged to, and by
 * comparing the handle's ordinal against the store's reversible depth. Neither is provenance:
 *
 *   - a caller could hand `bindExactReturnOrigin` a foreign target and this store, and nothing here
 *     could tell. The binding recorded the claim rather than checking it;
 *   - an ordinal is re-occupied. Consume a checkpoint and the opportunity correctly disappears — but
 *     record enough unrelated new transactions and the history grows past that ordinal again, and a
 *     dead target would be offered a second time. A consumed origin must stay dead forever.
 *
 * The only place that knows the truth is T-07, whose provenance lives in a module-private map. So
 * T-07 now answers the question directly, as a boolean, through
 * `isCurrentReturnCheckpointTargetForStore`: minted by T-07, belonging to THIS store, and its exact
 * entry still recorded. That is asked when the opportunity is created and again every time the
 * chrome asks whether it still holds.
 *
 * ## What this is NOT
 *
 * It reads no checkpoint internals — not the captured position, not the inspection, not the camera,
 * not the provenance object. It serializes nothing and persists nothing. It enumerates nothing, so
 * it is not a reversible-history browser and cannot become one: it holds exactly the one handle a
 * caller bound, never a list. It never calls T-07's resolver.
 *
 * It also grants nothing. `exactReturnTargetFor` hands back the very handle it was given, and T-07
 * re-proves provenance AND presence independently before writing anything — so a target that is
 * consumed between the last render and the press is still refused there, with no mutation.
 *
 * ## Why the handle carries no data at all
 *
 * `ExactReturnOrigin` is opaque and empty. Once provenance is asked of T-07 there is nothing an
 * ordinal could add except a second, weaker notion of validity that could disagree with the first.
 */
import { isCurrentReturnCheckpointTargetForStore, type ReturnCheckpointTarget } from '../return-navigation';
import type { CanonicalStore } from '../state';

/**
 * An opportunity to return to a specific inspection origin, as a Product capability.
 *
 * It exposes nothing whatsoever — no ordinal, no position, no inspection, no camera and no label.
 * Whether it still stands is not a property of the handle; it is a question only T-07 can answer,
 * and it is asked again on every render.
 */
export interface ExactReturnOrigin {
  readonly [ORIGIN]: true;
}

declare const ORIGIN: unique symbol;

interface BoundOrigin {
  readonly store: CanonicalStore;
  readonly target: ReturnCheckpointTarget;
}

const bound = new WeakMap<ExactReturnOrigin, BoundOrigin>();

/**
 * Binds a checkpoint target that THIS store minted and still records.
 *
 * The caller does this at the moment their inspection journey begins, with the store they are
 * actually reading. A value that is not a real target, one minted by a different store, and one
 * whose checkpoint has already been consumed all yield no opportunity at all rather than a broken
 * one — the claim is checked, never recorded.
 */
export function bindExactReturnOrigin(store: CanonicalStore, target: unknown): ExactReturnOrigin | null {
  if (!isCurrentReturnCheckpointTargetForStore(store, target)) return null;
  const origin = Object.freeze({}) as ExactReturnOrigin;
  bound.set(origin, { store, target });
  return origin;
}

/** True only for an opportunity this module produced. A structural look-alike is not one. */
export function isExactReturnOrigin(value: unknown): value is ExactReturnOrigin {
  return typeof value === 'object' && value !== null && bound.has(value as ExactReturnOrigin);
}

/**
 * The target this opportunity stands for, or `null` when the opportunity no longer holds.
 *
 * Provenance is re-asked of T-07 every time, against the store the chrome is actually acting on. So
 * a replaced store retires the opportunity immediately, a handle bound elsewhere is never offered,
 * and a consumed checkpoint stays retired **forever** — history regrowing past its old position
 * cannot bring it back, because presence is asked about the entry itself and never about a count.
 */
export function exactReturnTargetFor(store: CanonicalStore, origin: unknown): ReturnCheckpointTarget | null {
  if (typeof origin !== 'object' || origin === null) return null;
  const record = bound.get(origin as ExactReturnOrigin);
  if (record === undefined) return null;
  if (record.store !== store) return null;
  return isCurrentReturnCheckpointTargetForStore(store, record.target) ? record.target : null;
}
