// T-03B3 - Thread Lifecycle + Cross-Session Continuity: the frozen lifecycle
// vocabulary and the Session-local lifecycle types.
//
// This directory is canonical Product task T-03B3, one Architecture-sized
// task. It is PRODUCTION-INERT: nothing here is a Nest provider, nothing is
// registered in ConversationModule or called by ConversationService, and every
// database function it uses (migration 0070) is executable by no application
// role. T-03D owns the final cutover.
//
// Binding frozen meaning. An Established Thread is a persistent user/world
// object; once established it never returns to Mention or Emerging.
//
//   ACTIVE    the Thread is currently receiving conversational attention, or
//             the ongoing conversational sequence remains meaningfully
//             anchored to it
//   DORMANT   conversational attention has stably moved away, while identity,
//             history and permanent geography remain intact
//   REOPENED  within the current Session, a previously Dormant Thread receives
//             a genuine committed conversational return to the SAME
//             sufficiently resolved Thread identity
//
// Architecture Decision B3-01: lifecycle state is SESSION-LOCAL; Thread
// identity, Home and identity evidence are USER/WORLD-GLOBAL. SP values of
// different Sessions are not comparable, so no global lifecycle state, no
// global Session order and no timestamp ordering exists anywhere in this
// slice. A Thread's first appearance in a new Session starts that Session's
// footprint at ACTIVE; it is never a cross-Session "reopening".
//
// Reopened does NOT create a Thread, a Home or a relation, does not re-run
// establishment, does not move geography, reclaims no capacity and implies no
// importance or confidence. A timer never makes a Thread Dormant; background /
// analytical activity never makes a Thread Active or Reopened.

export const THREAD_LIFECYCLE_STATES = Object.freeze(['ACTIVE', 'DORMANT', 'REOPENED'] as const);
export type ThreadLifecycleState = (typeof THREAD_LIFECYCLE_STATES)[number];

/** The ONLY transitions of v1. ACTIVE -> REOPENED, DORMANT -> ACTIVE and every self-transition are unrepresentable. */
export const THREAD_LIFECYCLE_TRANSITIONS = Object.freeze([
  Object.freeze({ from: 'ACTIVE', to: 'DORMANT' } as const),
  Object.freeze({ from: 'REOPENED', to: 'DORMANT' } as const),
  Object.freeze({ from: 'DORMANT', to: 'REOPENED' } as const),
  Object.freeze({ from: 'REOPENED', to: 'ACTIVE' } as const),
] as const);

/** The closed, deterministic reasons of the reducer. No model, no timer, no importance. */
export const THREAD_LIFECYCLE_REASON_CODES = Object.freeze([
  'EXPLICIT_FOCUS_SHIFT',
  'SUSTAINED_DEPARTURE',
  'GENUINE_RETURN',
  'CONTINUED_ANCHORING',
] as const);
export type ThreadLifecycleReasonCode = (typeof THREAD_LIFECYCLE_REASON_CODES)[number];

/** The reason each target state may carry. */
export const THREAD_LIFECYCLE_REASONS_BY_STATE: Readonly<Record<ThreadLifecycleState, readonly ThreadLifecycleReasonCode[]>> = Object.freeze({
  DORMANT: Object.freeze<ThreadLifecycleReasonCode[]>(['EXPLICIT_FOCUS_SHIFT', 'SUSTAINED_DEPARTURE']),
  REOPENED: Object.freeze<ThreadLifecycleReasonCode[]>(['GENUINE_RETURN']),
  ACTIVE: Object.freeze<ThreadLifecycleReasonCode[]>(['CONTINUED_ANCHORING']),
});

export function isLegalThreadLifecycleTransition(from: ThreadLifecycleState, to: ThreadLifecycleState): boolean {
  return THREAD_LIFECYCLE_TRANSITIONS.some((transition) => transition.from === from && transition.to === to);
}

/** The two binding kinds of a Session Emerging Focus -> canonical Thread binding. */
export const THREAD_FOCUS_BINDING_KINDS = Object.freeze(['ESTABLISHMENT', 'SESSION_CONTINUITY'] as const);
export type ThreadFocusBindingKind = (typeof THREAD_FOCUS_BINDING_KINDS)[number];

/** The two identity-evidence source kinds of a user/world Thread dossier. */
export const THREAD_IDENTITY_EVIDENCE_SOURCE_KINDS = Object.freeze(['ESTABLISHMENT', 'SESSION_BINDING'] as const);
export type ThreadIdentityEvidenceSourceKind = (typeof THREAD_IDENTITY_EVIDENCE_SOURCE_KINDS)[number];

/** The reducer identity recorded on every final Thread-layer capture batch. */
export const THREAD_LIFECYCLE_REDUCER_VERSION = 'thread-lifecycle-reducer-v1';
export const THREAD_LIFECYCLE_POLICY_VERSION = 'stage-1.3-thread-lifecycle-v1';

/**
 * One Session focus -> Thread binding already canonical BEFORE the current
 * evaluation, exactly as migration 0070 stores it: membership and lineage
 * only. No Home coordinate, no lifecycle, no label, no LF.
 */
export interface SessionThreadFocusBinding {
  readonly bindingId: string;
  readonly threadId: string;
  readonly emergingFocusId: string;
  readonly boundCuId: string;
  readonly boundSp: number;
  readonly bindingKind: ThreadFocusBindingKind;
}

/** One Session-local lifecycle transition already durable BEFORE the current evaluation. */
export interface SessionThreadLifecycleEvent {
  readonly eventId: string;
  readonly threadId: string;
  readonly cuId: string;
  readonly sessionPosition: number;
  readonly transitionOrdinal: number;
  readonly fromState: ThreadLifecycleState;
  readonly toState: ThreadLifecycleState;
  readonly reasonCode: ThreadLifecycleReasonCode;
}

/** One prepared (in-memory) transition of ONE Thread at ONE CU. `fromState` is derived, never authored by a provider. */
export interface PreparedThreadLifecycleTransition {
  readonly threadId: string;
  readonly fromState: ThreadLifecycleState;
  readonly toState: ThreadLifecycleState;
  readonly reasonCode: ThreadLifecycleReasonCode;
}

/**
 * Every reason the reducer can refuse an input. All FAIL-CLOSED: a malformed
 * lifecycle context is never treated as "no transition".
 */
export type ThreadLifecycleRejectionReason =
  | 'INVALID_LIFECYCLE_INPUT'
  /** A Thread with a lifecycle state but no focus binding, or a binding whose Thread has no state. */
  | 'LIFECYCLE_CONTEXT_NOT_CLOSED'
  /** A then-current state outside the frozen vocabulary. */
  | 'INVALID_LIFECYCLE_STATE';

export class ThreadLifecycleRejectedError extends Error {
  constructor(readonly reason: ThreadLifecycleRejectionReason) {
    super(`Thread lifecycle reduction was rejected: ${reason}.`);
    this.name = 'ThreadLifecycleRejectedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
