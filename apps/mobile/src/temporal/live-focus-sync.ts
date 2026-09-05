/**
 * T-03D — the ONE wiring seam from the server Live Focus event to the
 * canonical client mirror.
 *
 *   server / domain wire :  LIVE_FOCUS_TRANSITION (wire kinds NONE / EMERGING / THREAD)
 *   client canonical mirror:  LIVE_FOCUS_TRANSITION (kernel kinds NONE / EMERGING_FOCUS / ESTABLISHED_THREAD)
 *
 * The two vocabularies are intentionally different layers: the wire carries the
 * frozen T-03D reference identity, the kernel keeps the frozen T-02 mirror
 * shape, and this adapter is the only place the one becomes the other. The
 * kernel is NOT redesigned.
 *
 * THE SERVER EVENT IS THE ONLY AUTHORITY here. This module never writes `LF`
 * directly, never dispatches a Product action, never appends RH, never moves
 * the camera, never creates a persistent focus-follow, and never touches `LH`,
 * `TM`, `TC`, `IF_ref` or `MC` — it hands the mirrored value to the T-02
 * store's authoritative-event seam and lets the kernel's own guard decide. That
 * stays true while the client is historically pinned: LF keeps evolving in
 * Live state and nothing else moves. Return-to-Live-Focus and Go Live + Locate
 * are T-07's actions and do not exist here.
 */
import type { LiveFocusTransitionWireEvent, LiveFocusWireValue, SessionTemporalSnapshot } from '@qandeel/runtime';
import { OutOfOrderTransition, sessionPosition, type CanonicalStore, type LiveFocus, type LiveFocusMirror, type LiveTruth } from '../state';
import { decodeLiveFocusTransitionEvent, type WireRejectionReason } from './temporal-wire';

export type LiveFocusSyncRejection = WireRejectionReason | 'SESSION_MISMATCH';

export type LiveFocusSyncOutcome =
  /** The mirror now carries the delivered value at its SP. */
  | { readonly outcome: 'APPLIED'; readonly atSp: number }
  /** The same transition was delivered again; canonical state is unchanged. */
  | { readonly outcome: 'IDEMPOTENT'; readonly atSp: number }
  /** A late delivery below the mirrored transition, or a conflicting value at the same SP. The mirror is NOT rewritten. */
  | { readonly outcome: 'OUT_OF_ORDER'; readonly atSp: number }
  /** The payload never became client truth. */
  | { readonly outcome: 'REJECTED'; readonly reason: LiveFocusSyncRejection; readonly detail: string };

/** The wire reference identity in the frozen T-02 mirror vocabulary. Nothing is added: no label, no Home, no direction. */
export function toMirrorLiveFocus(value: LiveFocusWireValue): LiveFocus {
  switch (value.kind) {
    case 'EMERGING':
      return { kind: 'EMERGING_FOCUS', emergingFocusId: value.emergingFocusId };
    case 'THREAD':
      return { kind: 'ESTABLISHED_THREAD', threadId: value.threadId };
    default:
      return { kind: 'NONE' };
  }
}

/**
 * The authoritative snapshot as the kernel's initial live truth, so a client
 * knows the current LF at startup without replaying every transition. Catch-up
 * transitions then apply in order against `atSp`.
 */
export function liveTruthFromSnapshot(snapshot: SessionTemporalSnapshot): LiveTruth {
  const LF: LiveFocusMirror = {
    value: toMirrorLiveFocus(snapshot.liveFocus),
    atSp: snapshot.liveFocusAtSp === null ? null : sessionPosition(snapshot.liveFocusAtSp),
  };
  return { LH: snapshot.liveHead === null ? null : sessionPosition(snapshot.liveHead), LF };
}

/**
 * Applies one delivered LF transition to the canonical store.
 *
 * `raw` is untrusted transport input and is decoded before it can reach the
 * kernel. An event for a different Session is refused outright: a mirror is
 * Session-scoped, and cross-Session delivery is a defect, never a merge.
 */
export function applyLiveFocusTransitionEvent(store: CanonicalStore, raw: unknown): LiveFocusSyncOutcome {
  const decoded = decodeLiveFocusTransitionEvent(raw);
  if (!decoded.ok) return { outcome: 'REJECTED', reason: decoded.reason, detail: decoded.detail };
  return applyDecodedLiveFocusTransitionEvent(store, decoded.value);
}

/** The same seam for an event that a caller has already decoded. */
export function applyDecodedLiveFocusTransitionEvent(store: CanonicalStore, event: LiveFocusTransitionWireEvent): LiveFocusSyncOutcome {
  const state = store.getState();
  if (event.sessionId !== state.session.id) {
    return {
      outcome: 'REJECTED',
      reason: 'SESSION_MISMATCH',
      detail: `the transition at SP ${event.atSp} targets Session ${event.sessionId}, mirrored Session is ${state.session.id}`,
    };
  }
  const atSp = event.atSp;
  try {
    const result = store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: toMirrorLiveFocus(event.value), atSp: sessionPosition(atSp) });
    return result.outcome === 'APPLIED' ? { outcome: 'APPLIED', atSp } : { outcome: 'IDEMPOTENT', atSp };
  } catch (error) {
    // A lower or conflicting Session Position is CLASSIFIED here, never
    // applied, and never converted into a backward or overwriting mirror write.
    if (error instanceof OutOfOrderTransition) return { outcome: 'OUT_OF_ORDER', atSp };
    throw error;
  }
}

/**
 * Applies an ordered catch-up page. Delivery stops at the first payload that
 * never becomes client truth, so a defective page can never be partially
 * trusted past its first defect.
 */
export function applyLiveFocusEventsPage(store: CanonicalStore, events: readonly LiveFocusTransitionWireEvent[]): readonly LiveFocusSyncOutcome[] {
  const outcomes: LiveFocusSyncOutcome[] = [];
  for (const event of events) {
    const outcome = applyDecodedLiveFocusTransitionEvent(store, event);
    outcomes.push(outcome);
    if (outcome.outcome === 'REJECTED') break;
  }
  return outcomes;
}
