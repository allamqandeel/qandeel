// T-03B2b2 - the deterministic prepared -> canonical Thread canonicalizer.
//
//   PreparedThreadEstablishmentResult (T-03B2a)
//   + the owner user id
//   + a closed PreparedConversationalOrigin
//   -> CanonicalThreadEstablishmentPayload (exactly what migration 0068 accepts)
//
// Pure and framework-agnostic: no I/O, no clock, no provider, no randomness.
// The same prepared decision canonicalized in any process, on any retry,
// yields the same three identities and the same payload, so the database's
// DB-derived capture fingerprint recognises a retry as an exact replay.
//
// Identity derivation (technical idempotency, never a Product coordinate and
// never a temporal one):
//
//   thread_id                   = uuidV5(THREAD_NAMESPACE,       `${userId}:${emergingFocusId}`)
//   home_anchor_id              = uuidV5(HOME_ANCHOR_NAMESPACE,  threadId)
//   thread_established_event_id = uuidV5(THREAD_EVENT_NAMESPACE, threadId)
//
// The Thread namespace is keyed on the OWNER, not the Session: a canonical
// Thread belongs to the user's persistent Conversation World, while the
// establishing Emerging Focus stays Session-scoped. The promotion therefore
// creates an immutable lineage rather than renaming Session history.
//
// The provider never authors an identity, and this boundary carries NO
// permanent placement of any kind: the database computes the Home under a
// per-user-world lock, against the world as it actually stands there.

import { CANONICAL_UUID_PATTERN, RFC4122_URL_NAMESPACE, uuidV5 } from '../runtime-identity/uuid-v5';
import {
  PREPARED_ORIGIN_STATES,
  ThreadCanonicalizationError,
  type CanonicalThreadEstablishmentPayload,
  type CanonicalThreadEvidence,
  type CanonicalThreadSequence,
  type PreparedConversationalOrigin,
  type PreparedOriginState,
  type ThreadCanonicalizationFailure,
} from './durable-thread-payload.types';
import { THREAD_ESTABLISHMENT_PATHS, type PreparedThreadEstablishmentResult } from './thread-establishment.types';

/**
 * The fixed domain/version namespaces, derived from their documented URIs so
 * the derivation is reproducible from the URIs alone. Changing any URI changes
 * every derived identity, which is exactly why the version is part of it.
 */
export const THREAD_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/world/thread/v1');
export const HOME_ANCHOR_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/world/home-anchor/v1');
export const THREAD_EVENT_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/thread-established/v1');

/** The canonical Thread identity of the promotion of `emergingFocusId` in `userId`'s world. */
export function durableThreadId(userId: string, emergingFocusId: string): string {
  assertUuid(userId, 'INVALID_DURABLE_IDENTITY', null);
  assertUuid(emergingFocusId, 'INVALID_DURABLE_IDENTITY', null);
  return uuidV5(THREAD_NAMESPACE, `${userId}:${emergingFocusId}`);
}

/** The permanent Home Anchor identity of `threadId`. One Thread, one Home, forever. */
export function durableHomeAnchorId(threadId: string): string {
  assertUuid(threadId, 'INVALID_DURABLE_IDENTITY', null);
  return uuidV5(HOME_ANCHOR_NAMESPACE, threadId);
}

/** The identity of the ONE explicit `ThreadEstablished` domain event of `threadId`. */
export function durableThreadEstablishedEventId(threadId: string): string {
  assertUuid(threadId, 'INVALID_DURABLE_IDENTITY', null);
  return uuidV5(THREAD_EVENT_NAMESPACE, threadId);
}

export interface ThreadCanonicalizationContext {
  /** The owner of the persistent Conversation World the Thread will belong to. */
  readonly userId: string;
  /**
   * The closed Conversational Origin of each establishing CU, keyed on CU id.
   * A CU absent from the map has origin NONE. B2b2 never derives origin from
   * conversation text; B2b3 owns that semantic mapping.
   */
  readonly originsByCuId?: ReadonlyMap<string, PreparedConversationalOrigin>;
}

/** Locale-independent UTF-16 code-unit ordering. Never `localeCompare`. */
export function compareThreadIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Canonicalizes ONE prepared decision. `NO_ESTABLISHMENT` is preserved as a
 * typed no-op payload rather than dropped: the database must be able to tell
 * an evaluated non-establishment from a batch B2 never saw.
 */
export function canonicalizePreparedThreadEstablishment(
  result: PreparedThreadEstablishmentResult,
  context: ThreadCanonicalizationContext,
): CanonicalThreadEstablishmentPayload {
  assertUuid(context.userId, 'INVALID_DURABLE_IDENTITY', null);
  assertUuid(result.cuId, 'INVALID_CANONICAL_UNIT_ID', result.cuId);
  const origin = context.originsByCuId?.get(result.cuId) ?? { state: 'NONE' as const };

  if (result.decision === 'NO_ESTABLISHMENT') {
    if (result.path !== null) throw fail('INVALID_PROMOTION_PATH', result.cuId);
    if (result.evidenceCuIds.length !== 0) throw fail('INVALID_EVIDENCE_SHAPE', result.cuId);
    if (origin.state !== 'NONE') throw fail('ORIGIN_FORBIDDEN_WITHOUT_ESTABLISHMENT', result.cuId);
    if (result.emergingFocusId !== null) assertUuid(result.emergingFocusId, 'INVALID_DURABLE_IDENTITY', result.cuId);
    return freezePayload({
      unit_id: result.cuId,
      decision: 'NO_ESTABLISHMENT',
      no_establishment_reason: result.noEstablishmentReason,
      emerging_focus_id: result.emergingFocusId,
      path: null,
      thread_id: null,
      home_anchor_id: null,
      thread_established_event_id: null,
      evidence: [],
      explicit_selection_grounding: null,
      origin_state: 'NONE',
      origin_thread_ids: [],
    });
  }

  if (result.emergingFocusId === null) throw fail('ESTABLISHMENT_WITHOUT_FOCUS', result.cuId);
  assertUuid(result.emergingFocusId, 'INVALID_DURABLE_IDENTITY', result.cuId);
  if (result.path === null || !THREAD_ESTABLISHMENT_PATHS.includes(result.path)) throw fail('INVALID_PROMOTION_PATH', result.cuId);
  if (result.noEstablishmentReason !== null) throw fail('INVALID_PROMOTION_PATH', result.cuId);

  const threadId = durableThreadId(context.userId, result.emergingFocusId);
  return freezePayload({
    unit_id: result.cuId,
    decision: 'ESTABLISH_THREAD',
    no_establishment_reason: null,
    emerging_focus_id: result.emergingFocusId,
    path: result.path,
    thread_id: threadId,
    home_anchor_id: durableHomeAnchorId(threadId),
    thread_established_event_id: durableThreadEstablishedEventId(threadId),
    evidence: canonicalEvidence(result),
    explicit_selection_grounding:
      result.explicitSelectionGrounding === null
        ? null
        : {
            anchor_text: result.explicitSelectionGrounding.anchor.text,
            anchor_occurrence: result.explicitSelectionGrounding.anchor.occurrence,
            span_start: result.explicitSelectionGrounding.span.start,
            span_end: result.explicitSelectionGrounding.span.end,
          },
    origin_state: origin.state,
    origin_thread_ids: canonicalOriginMembers(origin, result.cuId),
  });
}

/**
 * Canonicalizes one ordered prepared sequence into the exact B2 payload of one
 * integrated writer call. The order is the evaluation order of the committed
 * CUs; every CU keeps a decision, establishing or not.
 */
export function canonicalizePreparedThreadSequence(
  results: readonly PreparedThreadEstablishmentResult[],
  context: ThreadCanonicalizationContext,
): CanonicalThreadSequence {
  const units: CanonicalThreadEstablishmentPayload[] = [];
  const threadIds = new Map<string, string>();
  for (const result of results) {
    const unit = canonicalizePreparedThreadEstablishment(result, context);
    if (unit.thread_id !== null && unit.emerging_focus_id !== null) threadIds.set(unit.emerging_focus_id, unit.thread_id);
    units.push(unit);
  }
  // The final sweep: no transient identity survives into the boundary payload.
  if (JSON.stringify(units).includes('prepared:')) throw fail('PREPARED_IDENTITY_LEAKED', null);
  return Object.freeze({ units: Object.freeze(units), threadIds });
}

/**
 * The evidence provenance of one promotion: every cited prior CU in the order
 * T-03B2a validated, then the establishing CU last. The current CU appears
 * exactly once and always in final position, because the establishing CU is
 * by construction the latest committed material of the decision.
 */
function canonicalEvidence(result: PreparedThreadEstablishmentResult): readonly CanonicalThreadEvidence[] {
  const ids = [...result.evidenceCuIds];
  if (ids.length === 0) throw fail('INVALID_EVIDENCE_SHAPE', result.cuId);
  if (ids[ids.length - 1] !== result.cuId) throw fail('INVALID_EVIDENCE_SHAPE', result.cuId);
  if (new Set(ids).size !== ids.length) throw fail('INVALID_EVIDENCE_SHAPE', result.cuId);
  if (ids.slice(0, -1).includes(result.cuId)) throw fail('INVALID_EVIDENCE_SHAPE', result.cuId);
  return Object.freeze(
    ids.map((cuId, index) => {
      assertUuid(cuId, 'INVALID_CANONICAL_UNIT_ID', result.cuId);
      return Object.freeze({
        evidence_ordinal: index,
        cu_id: cuId,
        evidence_role: index === ids.length - 1 ? ('ESTABLISHING_CU' as const) : ('PRIOR_EVIDENCE' as const),
      });
    }),
  );
}

/**
 * The origin members in canonical (textual) order, with the frozen
 * cardinalities enforced. No member becomes a parent, a primary or a
 * preferred candidate by being first: the order is a storage order.
 */
function canonicalOriginMembers(origin: PreparedConversationalOrigin, cuId: string): readonly string[] {
  const state: PreparedOriginState = origin.state;
  if (!PREPARED_ORIGIN_STATES.includes(state)) throw fail('INVALID_ORIGIN_CARDINALITY', cuId);
  if (origin.state === 'NONE') return Object.freeze([]);
  const members: readonly string[] = [...origin.originThreadIds];
  if (state === 'RESOLVED' ? members.length !== 1 : members.length < 2) throw fail('INVALID_ORIGIN_CARDINALITY', cuId);
  const seen = new Set<string>();
  for (const member of members) {
    assertUuid(member, 'INVALID_DURABLE_IDENTITY', cuId);
    if (seen.has(member)) throw fail('DUPLICATE_ORIGIN_THREAD', cuId);
    seen.add(member);
  }
  return Object.freeze([...members].sort(compareThreadIds));
}

function freezePayload(payload: CanonicalThreadEstablishmentPayload): CanonicalThreadEstablishmentPayload {
  return Object.freeze({ ...payload, evidence: Object.freeze([...payload.evidence]), origin_thread_ids: Object.freeze([...payload.origin_thread_ids]) });
}

function fail(reason: ThreadCanonicalizationFailure, cuId: string | null): ThreadCanonicalizationError {
  return new ThreadCanonicalizationError(reason, cuId);
}

function assertUuid(value: string, reason: ThreadCanonicalizationFailure, cuId: string | null): void {
  if (typeof value !== 'string' || !CANONICAL_UUID_PATTERN.test(value)) throw fail(reason, cuId);
}
