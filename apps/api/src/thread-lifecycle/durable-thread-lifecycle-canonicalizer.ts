// T-03B3 - the deterministic prepared -> canonical Thread-layer canonicalizer.
//
//   PreparedThreadLayerDecision (orchestration, per CU)
//   -> CanonicalThreadLifecyclePayload (exactly what migration 0070 accepts)
//
// Pure and framework-agnostic: no I/O, no clock, no provider, no randomness.
// The same prepared decision canonicalized on any retry yields the same
// identities and the same payload, so the database's DB-derived capture
// fingerprint recognises a retry as an exact replay.
//
// Identity derivation (technical idempotency, never a Product coordinate and
// never a temporal one), byte for byte the derivation migration 0070 uses:
//
//   focus_binding_id   = uuidV5(BINDING_NAMESPACE,   `${sessionId}:${emergingFocusId}:${threadId}`)
//   lifecycle_event_id = uuidV5(LIFECYCLE_NAMESPACE, `${sessionId}:${cuId}:${threadId}:${toState}`)
//
// The provider never authors an identity, the payload never carries a
// `from_state` (the database derives it), and nothing spatial exists here.

import { CANONICAL_UUID_PATTERN, RFC4122_URL_NAMESPACE, uuidV5 } from '../runtime-identity/uuid-v5';
import {
  THREAD_LAYER_OUTCOMES,
  ThreadLifecycleCanonicalizationError,
  type CanonicalLifecycleTransition,
  type CanonicalThreadLifecyclePayload,
  type CanonicalThreadLifecycleSequence,
  type ThreadLayerOutcome,
  type ThreadLifecycleCanonicalizationFailure,
} from './durable-thread-lifecycle-payload.types';
import { compareThreadIdText, type PriorIdentityEvidenceRef } from './thread-continuity.types';
import {
  isLegalThreadLifecycleTransition,
  THREAD_LIFECYCLE_REASONS_BY_STATE,
  type PreparedThreadLifecycleTransition,
} from './thread-lifecycle.types';

/** The fixed domain/version namespaces, derived from their documented URIs. */
export const THREAD_FOCUS_BINDING_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-focus-binding/v1');
export const THREAD_LIFECYCLE_EVENT_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-lifecycle-event/v1');

export function durableThreadFocusBindingId(sessionId: string, emergingFocusId: string, threadId: string): string {
  assertUuid(sessionId, null);
  assertUuid(emergingFocusId, null);
  assertUuid(threadId, null);
  return uuidV5(THREAD_FOCUS_BINDING_NAMESPACE, `${sessionId}:${emergingFocusId}:${threadId}`);
}

export function durableThreadLifecycleEventId(sessionId: string, cuId: string, threadId: string, toState: string): string {
  assertUuid(sessionId, null);
  assertUuid(cuId, null);
  assertUuid(threadId, null);
  return uuidV5(THREAD_LIFECYCLE_EVENT_NAMESPACE, `${sessionId}:${cuId}:${threadId}:${toState}`);
}

/** One current-CU identity evidence reference, as the orchestration prepares it. */
export interface PreparedIdentityEvidenceRef {
  readonly cuId: string;
  readonly referenceIndex: number;
}

/**
 * The prepared final Thread-layer decision of ONE committed CU. Transient and
 * in-memory; `transitions` come from the deterministic reducer and carry their
 * derived fromState, which is dropped at the boundary (the database derives it).
 */
export interface PreparedThreadLayerDecision {
  readonly cuId: string;
  readonly outcome: ThreadLayerOutcome;
  readonly emergingFocusId: string | null;
  readonly threadId: string | null;
  readonly identityEvidence: readonly PreparedIdentityEvidenceRef[];
  readonly priorIdentityEvidence: readonly PriorIdentityEvidenceRef[];
  readonly candidateThreadIds: readonly string[];
  readonly transitions: readonly PreparedThreadLifecycleTransition[];
}

export interface ThreadLifecycleCanonicalizationContext {
  readonly sessionId: string;
}

const BINDING_OUTCOMES: readonly ThreadLayerOutcome[] = ['ESTABLISH_NEW', 'ACTIVATE_EXISTING_IN_SESSION'];
const BOUND_OUTCOMES: readonly ThreadLayerOutcome[] = ['ESTABLISH_NEW', 'ACTIVATE_EXISTING_IN_SESSION', 'ATTEND_EXISTING', 'REOPEN_EXISTING'];

/** Canonicalizes ONE prepared decision. Every outcome keeps a payload: nothing is ever absent or inferred. */
export function canonicalizePreparedThreadLayerDecision(
  decision: PreparedThreadLayerDecision,
  context: ThreadLifecycleCanonicalizationContext,
): CanonicalThreadLifecyclePayload {
  assertUuid(context.sessionId, null);
  assertUuid(decision.cuId, decision.cuId, 'INVALID_CANONICAL_UNIT_ID');
  if (!THREAD_LAYER_OUTCOMES.includes(decision.outcome)) throw fail('INVALID_OUTCOME_SHAPE', decision.cuId);
  if (decision.emergingFocusId !== null) assertUuid(decision.emergingFocusId, decision.cuId);
  if (decision.threadId !== null) assertUuid(decision.threadId, decision.cuId);

  const bound = BOUND_OUTCOMES.includes(decision.outcome);
  if (bound && (decision.threadId === null || decision.emergingFocusId === null)) throw fail('INVALID_OUTCOME_SHAPE', decision.cuId);
  if (!bound && decision.threadId !== null) throw fail('INVALID_OUTCOME_SHAPE', decision.cuId);
  if (decision.outcome === 'IDENTITY_AMBIGUOUS' && decision.emergingFocusId === null) throw fail('INVALID_OUTCOME_SHAPE', decision.cuId);
  if (decision.outcome === 'NO_THREAD_ACTION' && decision.emergingFocusId !== null) {
    // Legitimate: an unbound focus whose continuity was DISTINCT_NEW and whose B2 decision established nothing.
  }

  const createsBinding = BINDING_OUTCOMES.includes(decision.outcome);
  if (!createsBinding && decision.identityEvidence.length !== 0) throw fail('INVALID_EVIDENCE_SHAPE', decision.cuId);
  if (decision.outcome !== 'ACTIVATE_EXISTING_IN_SESSION' && decision.priorIdentityEvidence.length !== 0) throw fail('INVALID_EVIDENCE_SHAPE', decision.cuId);
  if (createsBinding && decision.identityEvidence.length === 0) throw fail('INVALID_EVIDENCE_SHAPE', decision.cuId);
  if (decision.outcome === 'ACTIVATE_EXISTING_IN_SESSION' && decision.priorIdentityEvidence.length === 0) throw fail('INVALID_EVIDENCE_SHAPE', decision.cuId);

  const identityEvidence = decision.identityEvidence.map((ref, index) => {
    assertUuid(ref.cuId, decision.cuId);
    if (!Number.isSafeInteger(ref.referenceIndex) || ref.referenceIndex < 0) throw fail('INVALID_EVIDENCE_SHAPE', decision.cuId);
    if (index > 0) {
      const previous = decision.identityEvidence[index - 1];
      if (previous.cuId === ref.cuId && previous.referenceIndex >= ref.referenceIndex) throw fail('INVALID_EVIDENCE_SHAPE', decision.cuId);
    }
    return Object.freeze({ cu_id: ref.cuId, reference_index: ref.referenceIndex });
  });
  const priorIdentityEvidence = decision.priorIdentityEvidence.map((ref) => {
    assertUuid(ref.cuId, decision.cuId);
    if (typeof ref.exactSurface !== 'string' || ref.exactSurface.length === 0) throw fail('INVALID_EVIDENCE_SHAPE', decision.cuId);
    return Object.freeze({ cu_id: ref.cuId, exact_surface: ref.exactSurface });
  });

  if (decision.outcome === 'IDENTITY_AMBIGUOUS' ? decision.candidateThreadIds.length < 2 : decision.candidateThreadIds.length !== 0) {
    throw fail('INVALID_CANDIDATE_CARDINALITY', decision.cuId);
  }
  const seenCandidates = new Set<string>();
  for (const candidate of decision.candidateThreadIds) {
    assertUuid(candidate, decision.cuId);
    if (seenCandidates.has(candidate)) throw fail('DUPLICATE_CANDIDATE_THREAD', decision.cuId);
    seenCandidates.add(candidate);
  }

  const seenTransitions = new Set<string>();
  const transitions: CanonicalLifecycleTransition[] = decision.transitions.map((transition) => {
    assertUuid(transition.threadId, decision.cuId);
    if (!isLegalThreadLifecycleTransition(transition.fromState, transition.toState)) throw fail('INVALID_TRANSITION', decision.cuId);
    if (!THREAD_LIFECYCLE_REASONS_BY_STATE[transition.toState].includes(transition.reasonCode)) throw fail('INVALID_TRANSITION', decision.cuId);
    if (seenTransitions.has(transition.threadId)) throw fail('DUPLICATE_TRANSITION_THREAD', decision.cuId);
    seenTransitions.add(transition.threadId);
    // A Thread first bound at this CU has no transition; a reopening belongs to the own Thread only.
    if (createsBinding && transition.threadId === decision.threadId) throw fail('INVALID_TRANSITION', decision.cuId);
    if (transition.toState === 'REOPENED' && transition.threadId !== decision.threadId) throw fail('INVALID_TRANSITION', decision.cuId);
    return Object.freeze({
      thread_id: transition.threadId,
      to_state: transition.toState,
      reason_code: transition.reasonCode,
      lifecycle_event_id: durableThreadLifecycleEventId(context.sessionId, decision.cuId, transition.threadId, transition.toState),
    });
  });
  if (decision.outcome === 'REOPEN_EXISTING' && !transitions.some((t) => t.thread_id === decision.threadId && t.to_state === 'REOPENED')) {
    throw fail('INVALID_TRANSITION', decision.cuId);
  }

  return Object.freeze({
    unit_id: decision.cuId,
    outcome: decision.outcome,
    emerging_focus_id: decision.emergingFocusId,
    thread_id: decision.threadId,
    binding_kind: decision.outcome === 'ESTABLISH_NEW' ? 'ESTABLISHMENT' : decision.outcome === 'ACTIVATE_EXISTING_IN_SESSION' ? 'SESSION_CONTINUITY' : null,
    focus_binding_id: createsBinding
      ? durableThreadFocusBindingId(context.sessionId, decision.emergingFocusId as string, decision.threadId as string)
      : null,
    identity_evidence: Object.freeze(identityEvidence),
    prior_identity_evidence: Object.freeze(priorIdentityEvidence),
    candidate_thread_ids: Object.freeze([...decision.candidateThreadIds].sort(compareThreadIdText)),
    lifecycle_transitions: Object.freeze([...transitions].sort((a, b) => compareThreadIdText(a.thread_id, b.thread_id))),
  });
}

/** Canonicalizes one ordered prepared sequence into the exact B3 payload of one integrated writer call. */
export function canonicalizePreparedThreadLayerSequence(
  decisions: readonly PreparedThreadLayerDecision[],
  context: ThreadLifecycleCanonicalizationContext,
): CanonicalThreadLifecycleSequence {
  const units = decisions.map((decision) => canonicalizePreparedThreadLayerDecision(decision, context));
  // The final sweep: no transient identity survives into the boundary payload.
  if (JSON.stringify(units).includes('prepared:')) throw fail('PREPARED_IDENTITY_LEAKED', null);
  return Object.freeze({ units: Object.freeze(units) });
}

function fail(reason: ThreadLifecycleCanonicalizationFailure, cuId: string | null): ThreadLifecycleCanonicalizationError {
  return new ThreadLifecycleCanonicalizationError(reason, cuId);
}

function assertUuid(value: string, cuId: string | null, reason: ThreadLifecycleCanonicalizationFailure = 'INVALID_DURABLE_IDENTITY'): void {
  if (typeof value !== 'string' || !CANONICAL_UUID_PATTERN.test(value)) throw fail(reason, cuId);
}
