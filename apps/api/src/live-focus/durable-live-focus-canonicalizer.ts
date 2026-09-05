// T-03D - the deterministic prepared -> canonical Live Focus canonicalizer.
//
//   PreparedLiveFocusDecision (orchestration, per CU)
//   -> CanonicalLiveFocusPayload (exactly what migration 0071 accepts)
//
// Pure and framework-agnostic: no I/O, no clock, no provider, no randomness.
// The same prepared decision canonicalized on any retry yields the same
// identity and the same payload, so the database's DB-derived capture
// fingerprint recognises a retry as an exact replay.
//
// Identity derivation (technical idempotency, never a Product coordinate and
// never a temporal one), byte for byte the derivation migration 0071 uses:
//
//   lf_event_id = uuidV5(LF_EVENT_NAMESPACE, `${sessionId}:${cuId}:${toKind}:${toRef ?? 'NONE'}`)
//   LF_EVENT_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/live-focus-transition/v1')
//
// The payload never carries a `from` value (the database derives it) and
// nothing spatial, graded, textual or historical exists here.

import { CANONICAL_UUID_PATTERN, RFC4122_URL_NAMESPACE, uuidV5 } from '../runtime-identity/uuid-v5';
import {
  LiveFocusCanonicalizationError,
  type CanonicalLiveFocusPayload,
  type CanonicalLiveFocusSequence,
  type LiveFocusCanonicalizationFailure,
} from './durable-live-focus-payload.types';
import {
  LIVE_FOCUS_KINDS,
  LIVE_FOCUS_TRANSITION_REASONS,
  liveFocusEquals,
  liveFocusRef,
  type EffectiveLiveFocus,
  type LiveFocusReduction,
} from './live-focus.types';

/** The fixed domain/version namespace, derived from its documented URI. */
export const LIVE_FOCUS_TRANSITION_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/live-focus-transition/v1');

export function durableLiveFocusTransitionId(sessionId: string, cuId: string, to: EffectiveLiveFocus): string {
  assertUuid(sessionId, null);
  assertUuid(cuId, null);
  const ref = liveFocusRef(to);
  if (ref !== null) assertUuid(ref, null);
  return uuidV5(LIVE_FOCUS_TRANSITION_NAMESPACE, `${sessionId}:${cuId}:${to.kind}:${ref ?? 'NONE'}`);
}

/** The prepared LF decision of ONE committed CU: the reducer output bound to its CU. */
export interface PreparedLiveFocusDecision {
  readonly cuId: string;
  readonly reduction: LiveFocusReduction;
}

export interface LiveFocusCanonicalizationContext {
  readonly sessionId: string;
}

/** Canonicalizes ONE prepared decision. Every CU keeps a payload: nothing is ever absent or inferred. */
export function canonicalizePreparedLiveFocusDecision(
  decision: PreparedLiveFocusDecision,
  context: LiveFocusCanonicalizationContext,
): CanonicalLiveFocusPayload {
  assertUuid(context.sessionId, null);
  assertUuid(decision.cuId, decision.cuId, 'INVALID_CANONICAL_UNIT_ID');
  const { effective, transition } = decision.reduction;
  assertValue(effective, decision.cuId);
  if (transition !== null) {
    assertValue(transition.from, decision.cuId);
    assertValue(transition.to, decision.cuId);
    if (!liveFocusEquals(transition.to, effective) || liveFocusEquals(transition.from, transition.to)) {
      throw fail('INVALID_TRANSITION_SHAPE', decision.cuId);
    }
    if (!(LIVE_FOCUS_TRANSITION_REASONS as readonly string[]).includes(transition.reasonCode)) throw fail('INVALID_TRANSITION_SHAPE', decision.cuId);
    if ((transition.to.kind === 'NONE') !== (transition.reasonCode === 'STABLE_DEPARTURE_NO_REPLACEMENT')) throw fail('INVALID_TRANSITION_SHAPE', decision.cuId);
    if ((transition.from.kind === 'NONE' && transition.to.kind !== 'NONE') !== (transition.reasonCode === 'NEW_INDEPENDENT_FOCUS')) throw fail('INVALID_TRANSITION_SHAPE', decision.cuId);
    if ((transition.reasonCode === 'THREAD_PROMOTION' || transition.reasonCode === 'RETURN_TO_THREAD') && transition.to.kind !== 'THREAD') throw fail('INVALID_TRANSITION_SHAPE', decision.cuId);
    if (transition.reasonCode === 'THREAD_PROMOTION' && transition.from.kind !== 'EMERGING') throw fail('INVALID_TRANSITION_SHAPE', decision.cuId);
  }
  return Object.freeze({
    unit_id: decision.cuId,
    effective_kind: effective.kind,
    effective_ref: liveFocusRef(effective),
    transition: transition !== null,
    reason_code: transition === null ? null : transition.reasonCode,
    transition_event_id: transition === null ? null : durableLiveFocusTransitionId(context.sessionId, decision.cuId, transition.to),
  });
}

/** Canonicalizes one ordered prepared sequence into the exact LF payload of one integrated writer call. */
export function canonicalizePreparedLiveFocusSequence(
  decisions: readonly PreparedLiveFocusDecision[],
  context: LiveFocusCanonicalizationContext,
): CanonicalLiveFocusSequence {
  const units = decisions.map((decision) => canonicalizePreparedLiveFocusDecision(decision, context));
  // The final sweep: no transient identity survives into the boundary payload.
  if (JSON.stringify(units).includes('prepared:')) throw fail('PREPARED_IDENTITY_LEAKED', null);
  return Object.freeze({ units: Object.freeze(units) });
}

function assertValue(value: EffectiveLiveFocus, cuId: string): void {
  if (!value || typeof value !== 'object' || !(LIVE_FOCUS_KINDS as readonly string[]).includes(value.kind)) throw fail('INVALID_LIVE_FOCUS_SHAPE', cuId);
  const ref = liveFocusRef(value);
  if ((value.kind === 'NONE') !== (ref === null)) throw fail('INVALID_LIVE_FOCUS_SHAPE', cuId);
  if (ref !== null) assertUuid(ref, cuId);
}

function fail(reason: LiveFocusCanonicalizationFailure, cuId: string | null): LiveFocusCanonicalizationError {
  return new LiveFocusCanonicalizationError(reason, cuId);
}

function assertUuid(value: string, cuId: string | null, reason: LiveFocusCanonicalizationFailure = 'INVALID_DURABLE_IDENTITY'): void {
  if (typeof value !== 'string' || !CANONICAL_UUID_PATTERN.test(value)) throw fail(reason, cuId);
}
