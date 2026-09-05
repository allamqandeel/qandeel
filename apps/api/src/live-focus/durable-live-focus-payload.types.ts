// T-03D - the canonical durable Live Focus payload boundary.
//
// The orchestration prepares, per committed CU, ONE canonical LF decision:
// the effective LF after the FINAL Thread-layer result of that CU, whether
// it differs from the prior effective LF, the frozen reason of the change
// and the deterministic RFC 4122 version-5 identity of the transition.
// Migration 0071's integrated writer accepts exactly this shape and
// RE-DERIVES every element itself from the durable rows: the application
// can neither force another value, invent a transition, hide one, nor author
// a reason or an identity.
//
// One canonical decision object corresponds exactly to one proposed committed
// CU `unit_id`, including the CUs whose LF is unchanged: "LF evaluated and
// unchanged" and "LF never evaluated" must stay distinguishable forever, and
// the technical LF capture batch fingerprint covers every decision.
//
// What deliberately CANNOT be expressed here: a `from` value (DB-derived), an
// SP or same-SP sequence (DB-allocated), a timestamp, a label, a name, a Home
// coordinate, a direction, a relation count, a confidence, an importance,
// committed text or a K(TC) projection.

import type { LiveFocusKind, LiveFocusTransitionReason } from './live-focus.types';

/**
 * One canonical LF decision for one proposed committed CU. Exactly these six
 * keys cross the database boundary, for EVERY CU.
 */
export interface CanonicalLiveFocusPayload {
  readonly unit_id: string;
  readonly effective_kind: LiveFocusKind;
  /** The stable Emerging Focus or canonical Thread of the effective LF; null for NONE. */
  readonly effective_ref: string | null;
  /** True exactly when the effective LF differs from the prior effective LF. */
  readonly transition: boolean;
  /** The frozen reason when `transition`; null otherwise. */
  readonly reason_code: LiveFocusTransitionReason | null;
  /** Derived, never authored. Non-null exactly when `transition`. */
  readonly transition_event_id: string | null;
}

/** The technical provenance the writer records on the LF capture batch. */
export interface CanonicalLiveFocusBatchProvenance {
  readonly lfReducerVersion: string;
}

/** A canonicalized ordered sequence: the exact LF input of one integrated writer call per source turn. */
export interface CanonicalLiveFocusSequence {
  readonly units: readonly CanonicalLiveFocusPayload[];
}

export type LiveFocusCanonicalizationFailure =
  | 'INVALID_CANONICAL_UNIT_ID'
  | 'INVALID_DURABLE_IDENTITY'
  | 'INVALID_LIVE_FOCUS_SHAPE'
  | 'INVALID_TRANSITION_SHAPE'
  | 'PREPARED_IDENTITY_LEAKED';

export class LiveFocusCanonicalizationError extends Error {
  constructor(
    readonly reason: LiveFocusCanonicalizationFailure,
    readonly cuId: string | null = null,
  ) {
    super(`Durable Live Focus canonicalization failed: ${reason}.`);
    this.name = 'LiveFocusCanonicalizationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
