/**
 * T-03A2 — the ONE wiring seam from the server domain event to the canonical
 * client mirror.
 *
 *   server / domain wire :  CONVERSATIONAL_UNITS_COMMITTED
 *   client canonical mirror:  LIVE_HEAD_ADVANCED
 *
 * The two names are intentionally different layers. Neither is renamed into the
 * other, and no generic `WORLD_TRUTH_UPDATED` exists.
 *
 * A delivery event may cover a block of several committed CUs
 * (`firstSp=20, lastSp=23, unitCount=4`). The client mirror ingests `toSp=23`
 * once: the individual Moments stay addressable by their own Session Positions
 * in the durable server rows, so the block needs no four separate LH packets.
 *
 * The SERVER EVENT IS THE ONLY AUTHORITY here. This module never writes `LH`
 * directly, never dispatches a Product action, never appends RH, and never
 * touches `TM`, `IF_ref`, `MC` or `LF` — it hands the mirrored position to the
 * T-02 store's authoritative-event seam and lets the kernel's own guard decide.
 */
import type { ConversationalUnitsCommittedWireEvent } from '@qandeel/runtime';
import { RetractionRejected, sessionPosition, type CanonicalStore } from '../state';
import { decodeCommittedUnitsEvent, type WireRejectionReason } from './temporal-wire';

export type LiveHeadSyncRejection = WireRejectionReason | 'SESSION_MISMATCH';

export type LiveHeadSyncOutcome =
  /** The mirror advanced to `toSp`. */
  | { readonly outcome: 'APPLIED'; readonly toSp: number }
  /** The same head was delivered again; canonical state is unchanged. */
  | { readonly outcome: 'IDEMPOTENT'; readonly toSp: number }
  /** A late or duplicated delivery below the mirrored head. LH is NOT retracted. */
  | { readonly outcome: 'STALE'; readonly toSp: number }
  /** The payload never became client truth. */
  | { readonly outcome: 'REJECTED'; readonly reason: LiveHeadSyncRejection; readonly detail: string };

/**
 * Applies one delivered committed-CU event to the canonical store.
 *
 * `raw` is untrusted transport input and is decoded before it can reach the
 * kernel. An event for a different Session is refused outright: a mirror is
 * Session-scoped, and cross-Session delivery is a defect, never a merge.
 */
export function applyCommittedUnitsEvent(store: CanonicalStore, raw: unknown): LiveHeadSyncOutcome {
  const decoded = decodeCommittedUnitsEvent(raw);
  if (!decoded.ok) return { outcome: 'REJECTED', reason: decoded.reason, detail: decoded.detail };
  return applyDecodedCommittedUnitsEvent(store, decoded.value);
}

/** The same seam for an event that a caller has already decoded. */
export function applyDecodedCommittedUnitsEvent(
  store: CanonicalStore,
  event: ConversationalUnitsCommittedWireEvent,
): LiveHeadSyncOutcome {
  const state = store.getState();
  if (event.sessionId !== state.session.id) {
    return {
      outcome: 'REJECTED',
      reason: 'SESSION_MISMATCH',
      detail: `event ${event.batchId} targets Session ${event.sessionId}, mirrored Session is ${state.session.id}`,
    };
  }
  const toSp = event.lastSp;
  try {
    const result = store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: sessionPosition(toSp) });
    return result.outcome === 'APPLIED' ? { outcome: 'APPLIED', toSp } : { outcome: 'IDEMPOTENT', toSp };
  } catch (error) {
    // A lower Session Position is a stale delivery, never a retraction: the
    // kernel refuses it and canonical state is left exactly as it was. It is
    // CLASSIFIED here, never applied, and never converted into a backward write.
    if (error instanceof RetractionRejected) return { outcome: 'STALE', toSp };
    throw error;
  }
}

/**
 * Applies an ordered catch-up page. Delivery stops at the first payload that
 * never becomes client truth, so a defective page can never be partially
 * trusted past its first defect.
 */
export function applyCommittedUnitsPage(
  store: CanonicalStore,
  events: readonly ConversationalUnitsCommittedWireEvent[],
): readonly LiveHeadSyncOutcome[] {
  const outcomes: LiveHeadSyncOutcome[] = [];
  for (const event of events) {
    const outcome = applyDecodedCommittedUnitsEvent(store, event);
    outcomes.push(outcome);
    if (outcome.outcome === 'REJECTED') break;
  }
  return outcomes;
}
