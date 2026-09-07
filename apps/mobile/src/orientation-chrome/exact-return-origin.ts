/**
 * T-08 — binding an Exact Return opportunity to the surface lifecycle that legitimately created it.
 *
 * ## The defect this closes
 *
 * A checkpoint handle minted by ANOTHER store is a real handle: `isReturnCheckpointTarget` says so,
 * and its ordinal may well be within this store's reversible depth. T-07 refuses it correctly at
 * execution — but only at execution. Until then the Product had offered a capability that could
 * never work, and a control that lies about what it can do is a Product defect even when the
 * canonical state is never at risk.
 *
 * So the presentation is bound too: an opportunity exists only while the store it was bound against
 * is still the store the surface is acting on.
 *
 * ## What this is NOT
 *
 * It reads no checkpoint internals — not the captured position, not the inspection, not the camera,
 * not the provenance T-07 keeps private. It serializes nothing and persists nothing. It enumerates
 * nothing, so it is not a reversible-history browser, and it cannot become one: it holds exactly the
 * one handle a caller bound, never a list.
 *
 * It also grants nothing. The record is presentational: `exactReturnTargetFor` hands back the very
 * handle it was given, and T-07 re-proves provenance AND presence independently before writing
 * anything. Widening T-07's private authority was not necessary and was not done, and no persistent
 * checkpoint identity was introduced.
 *
 * ## Why a WeakMap keyed by the handle
 *
 * The association has to die when the surface does. Keying a module-private `WeakMap` on the opaque
 * handle means the record lives exactly as long as the caller holds the handle, and the handle
 * itself discloses only an ordinal — the same thing T-07's own target already exposes.
 */
import { isReturnCheckpointTarget, returnAvailability, type ReturnCheckpointTarget } from '../return-navigation';
import type { CanonicalStore } from '../state';

/**
 * An opportunity to return to a specific inspection origin, as a Product capability.
 *
 * It exposes its ordinal position and nothing else — no position in the conversation, no inspection,
 * no camera and no label. The ordinal is evidence for a caller; it is never authority.
 */
export interface ExactReturnOrigin {
  readonly ordinal: number;
}

interface BoundOrigin {
  readonly store: CanonicalStore;
  readonly target: ReturnCheckpointTarget;
  readonly ordinal: number;
}

const bound = new WeakMap<ExactReturnOrigin, BoundOrigin>();

/**
 * Binds a legitimate checkpoint target to the store it was minted against.
 *
 * The caller does this at the moment their inspection journey begins, with the store they are
 * actually reading. A value that is not a real target, or one whose ordinal is already beyond this
 * store's reversible depth, yields no opportunity at all rather than a broken one.
 */
export function bindExactReturnOrigin(store: CanonicalStore, target: unknown): ExactReturnOrigin | null {
  if (!isReturnCheckpointTarget(target)) return null;
  if (target.index < 0 || target.index >= returnAvailability(store.getState()).checkpointCount) return null;
  const origin: ExactReturnOrigin = Object.freeze({ ordinal: target.index });
  bound.set(origin, { store, target, ordinal: target.index });
  return origin;
}

/** True only for an opportunity this module produced. A structural look-alike is not one. */
export function isExactReturnOrigin(value: unknown): value is ExactReturnOrigin {
  return typeof value === 'object' && value !== null && bound.has(value as ExactReturnOrigin);
}

/**
 * The target this opportunity stands for, or `null` when the opportunity no longer holds.
 *
 * Three things must all still be true, and each is checked before the control is ever offered:
 *
 *   - the handle is one this module bound (a forged or copied object is not);
 *   - it was bound against THIS store, so a replaced store retires it immediately and a handle from
 *     a different store is never offered in the first place;
 *   - its ordinal is still within the store's reversible depth, so a consumed or unwound-past origin
 *     retires itself — including immediately after a successful Exact Return.
 */
export function exactReturnTargetFor(store: CanonicalStore, origin: unknown): ReturnCheckpointTarget | null {
  if (typeof origin !== 'object' || origin === null) return null;
  const record = bound.get(origin as ExactReturnOrigin);
  if (record === undefined) return null;
  if (record.store !== store) return null;
  if (record.ordinal >= returnAvailability(store.getState()).checkpointCount) return null;
  return record.target;
}
