// T-03B1b1 - the deterministic prepared -> canonical focus canonicalizer.
//
//   PreparedConversationalFocusResult (T-03B1a, transient `prepared:` ids)
//   + stable canonical identities (RFC 4122 v5, derived here)
//   -> CanonicalCuFocusSemanticPayload (exactly what migration 0066 accepts)
//
// Pure and framework-agnostic: no I/O, no clock, no provider. The same
// prepared bundle canonicalized in any process, on any retry, yields the same
// identities and the same payload, so the database's DB-derived semantic
// fingerprint recognises a retry as an exact replay.
//
// Identity derivation (technical idempotency, never a Product temporal
// coordinate):
//
//   new reference handle  = uuidV5(REFERENCE_HANDLE_NAMESPACE, `${sessionId}:${cuId}:${referenceIndex}`)
//   new Emerging Focus    = uuidV5(EMERGING_FOCUS_NAMESPACE,   `${sessionId}:${startedCuId}`)
//
// The provider never authors a canonical identity: prepared ids are mapped
// through the sequence's own creation order, an already-durable id passes
// through only when it is a canonical UUID, and any surviving `prepared:`
// string fails closed before the boundary.

import {
  type FocusCandidate,
  type PreparedConversationalFocusResult,
  type PreparedReferenceResolution,
} from './conversational-focus.types';
import { PREPARED_ID_PREFIX } from './conversational-focus-evaluator.service';
import {
  FocusCanonicalizationError,
  type CanonicalAttention,
  type CanonicalClaimAttribution,
  type CanonicalCuFocusSemanticPayload,
  type CanonicalFocusSequence,
  type CanonicalReferenceResolution,
  type DurableClaimantKind,
} from './durable-focus-payload.types';
import { CANONICAL_UUID_PATTERN, RFC4122_URL_NAMESPACE, uuidV5 } from '../runtime-identity/uuid-v5';

/**
 * The fixed domain/version namespaces, derived from their documented URIs so
 * the derivation is reproducible from the URIs alone. Changing either URI
 * changes every derived identity, which is why the version is part of it.
 */
export const REFERENCE_HANDLE_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/reference-handle/v1');
export const EMERGING_FOCUS_NAMESPACE = uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/emerging-focus/v1');

/** The stable handle identity of a reference FIRST grounded by `cuId` at `referenceIndex` in `sessionId`. */
export function durableReferenceHandleId(sessionId: string, cuId: string, referenceIndex: number): string {
  assertCanonicalUuid(sessionId, 'INVALID_DURABLE_IDENTITY', null);
  assertCanonicalUuid(cuId, 'INVALID_CANONICAL_UNIT_ID', cuId);
  if (!Number.isSafeInteger(referenceIndex) || referenceIndex < 0) {
    throw new FocusCanonicalizationError('INVALID_DURABLE_IDENTITY', cuId);
  }
  return uuidV5(REFERENCE_HANDLE_NAMESPACE, `${sessionId}:${cuId}:${referenceIndex}`);
}

/** The stable emerging_focus_id of a focus STARTED by `startedCuId` in `sessionId`. */
export function durableEmergingFocusId(sessionId: string, startedCuId: string): string {
  assertCanonicalUuid(sessionId, 'INVALID_DURABLE_IDENTITY', null);
  assertCanonicalUuid(startedCuId, 'INVALID_CANONICAL_UNIT_ID', startedCuId);
  return uuidV5(EMERGING_FOCUS_NAMESPACE, `${sessionId}:${startedCuId}`);
}

export interface CanonicalizationContext {
  readonly sessionId: string;
  /**
   * The durable focus candidates the sequence was evaluated against (from the
   * authoritative context snapshot). Needed to name the RESOLVED reference that
   * grounds an ATTEND of an already-durable focus.
   */
  readonly priorFocusCandidates: readonly FocusCandidate[];
}

/**
 * Canonicalizes one ordered prepared sequence into the exact payload of one
 * integrated writer call. `results` must be in the evaluation order the
 * sequential helper produced, because a later CU may select a prepared
 * identity an earlier CU created.
 */
export function canonicalizePreparedFocusSequence(
  results: readonly PreparedConversationalFocusResult[],
  context: CanonicalizationContext,
): CanonicalFocusSequence {
  assertCanonicalUuid(context.sessionId, 'INVALID_DURABLE_IDENTITY', null);
  const referenceHandleIds = new Map<string, string>();
  const emergingFocusIds = new Map<string, string>();
  /** Every focus id known to this canonicalization -> its grounding handle ids. */
  const focusGrounding = new Map<string, readonly string[]>();
  for (const focus of context.priorFocusCandidates) {
    assertCanonicalUuid(focus.focusCandidateId, 'INVALID_DURABLE_IDENTITY', null);
    for (const handleId of focus.groundingHandleIds) assertCanonicalUuid(handleId, 'INVALID_DURABLE_IDENTITY', null);
    focusGrounding.set(focus.focusCandidateId, focus.groundingHandleIds);
  }

  const units: CanonicalCuFocusSemanticPayload[] = [];
  for (const result of results) {
    if (result.sessionId !== context.sessionId) throw new FocusCanonicalizationError('INVALID_DURABLE_IDENTITY', result.cuId);
    assertCanonicalUuid(result.cuId, 'INVALID_CANONICAL_UNIT_ID', result.cuId);
    if (result.targetCuId !== null) assertCanonicalUuid(result.targetCuId, 'INVALID_CANONICAL_UNIT_ID', result.cuId);

    // References first: a claim or the attention of the same CU may point at
    // a handle this CU creates.
    const resolvedHandleByIndex = new Map<number, string>();
    const references: CanonicalReferenceResolution[] = result.references.map((reference, index) => {
      const canonical = canonicalReference(reference, index, result.cuId, context.sessionId, referenceHandleIds);
      if (canonical.resolved_handle_id !== null) resolvedHandleByIndex.set(index, canonical.resolved_handle_id);
      return canonical;
    });

    const claim_attributions: CanonicalClaimAttribution[] = result.claimAttributions.map((claim, index) => {
      let kind: DurableClaimantKind;
      let handleId: string | null = null;
      switch (claim.claimant.kind) {
        case 'CURRENT_CONVERSATIONAL_SPEAKER':
        case 'UNRESOLVED':
          kind = claim.claimant.kind;
          break;
        case 'REFERENCE_HANDLE':
          kind = 'REFERENCE_HANDLE';
          handleId = durableHandle(claim.claimant.handleId, referenceHandleIds, result.cuId);
          break;
        case 'NEW_CURRENT_CU_REFERENCE': {
          // The prepared technical pointer canonicalizes to the stable handle
          // created for that reference of this same CU - never a fourth
          // durable claimant kind.
          const pointer = claim.claimant.referenceIndex;
          const created = pointer === null ? undefined : references[pointer];
          if (!created || !created.creates_handle || created.resolved_handle_id === null) {
            throw new FocusCanonicalizationError('INVALID_CLAIMANT_POINTER', result.cuId);
          }
          kind = 'REFERENCE_HANDLE';
          handleId = created.resolved_handle_id;
          break;
        }
        default:
          throw new FocusCanonicalizationError('INVALID_CLAIMANT_POINTER', result.cuId);
      }
      return {
        attribution_index: index,
        anchor_text: claim.anchor.text,
        anchor_occurrence: claim.anchor.occurrence,
        span_start: claim.span.start,
        span_end: claim.span.end,
        claimant_kind: kind,
        claimant_handle_id: handleId,
        claim_frame: claim.frame,
      };
    });

    const attention = canonicalAttention(result, references, resolvedHandleByIndex, context.sessionId, emergingFocusIds, focusGrounding);

    units.push({
      unit_id: result.cuId,
      functions: [...result.functions],
      sequence_position: result.sequencePosition,
      target_cu_id: result.targetCuId,
      references,
      claim_attributions,
      attention,
    });
  }

  // The final sweep: no prepared identity survives into the boundary payload.
  if (JSON.stringify(units).includes(PREPARED_ID_PREFIX)) {
    throw new FocusCanonicalizationError('PREPARED_IDENTITY_LEAKED');
  }
  return { units, referenceHandleIds, emergingFocusIds };
}

function canonicalReference(
  reference: PreparedReferenceResolution,
  index: number,
  cuId: string,
  sessionId: string,
  referenceHandleIds: Map<string, string>,
): CanonicalReferenceResolution {
  let resolvedHandleId: string | null = null;
  let createsHandle = false;
  if (reference.state === 'RESOLVED') {
    if (reference.newReference) {
      resolvedHandleId = durableReferenceHandleId(sessionId, cuId, index);
      createsHandle = true;
      referenceHandleIds.set(`${PREPARED_ID_PREFIX}reference:${cuId}:${index}`, resolvedHandleId);
    } else {
      resolvedHandleId = durableHandle(reference.resolvedHandleId, referenceHandleIds, cuId);
    }
  }
  const candidates = reference.candidateHandleIds.map((candidate) => durableHandle(candidate, referenceHandleIds, cuId));
  return {
    reference_index: index,
    anchor_text: reference.anchor.text,
    anchor_occurrence: reference.anchor.occurrence,
    span_start: reference.span.start,
    span_end: reference.span.end,
    state: reference.state,
    resolved_handle_id: resolvedHandleId,
    creates_handle: createsHandle,
    candidate_handle_ids: candidates,
  };
}

function canonicalAttention(
  result: PreparedConversationalFocusResult,
  references: readonly CanonicalReferenceResolution[],
  resolvedHandleByIndex: ReadonlyMap<number, string>,
  sessionId: string,
  emergingFocusIds: Map<string, string>,
  focusGrounding: Map<string, readonly string[]>,
): CanonicalAttention {
  const { attention } = result;
  const groundingIndexFor = (): number | null => {
    if (attention.grounding === null) return null;
    const { text, occurrence } = attention.grounding.anchor;
    const index = references.findIndex((reference) => reference.anchor_text === text && reference.anchor_occurrence === occurrence);
    return index >= 0 ? index : null;
  };

  switch (attention.kind) {
    case 'NO_INDEPENDENT_FOCUS':
      return { kind: attention.kind, reason: attention.reason, emerging_focus_id: null, creates_focus: false, grounding_reference_index: null };
    case 'START_NEW_FOCUS': {
      const index = groundingIndexFor();
      const groundingHandle = index === null ? undefined : resolvedHandleByIndex.get(index);
      if (index === null || groundingHandle === undefined) throw new FocusCanonicalizationError('FOCUS_GROUNDING_REQUIRED', result.cuId);
      const focusId = durableEmergingFocusId(sessionId, result.cuId);
      emergingFocusIds.set(`${PREPARED_ID_PREFIX}focus:${result.cuId}`, focusId);
      focusGrounding.set(focusId, [groundingHandle]);
      return { kind: attention.kind, reason: attention.reason, emerging_focus_id: focusId, creates_focus: true, grounding_reference_index: index };
    }
    case 'ATTEND_EXISTING_FOCUS': {
      const focusId = durableFocus(attention.existingFocusCandidateId, emergingFocusIds, result.cuId);
      const grounding = focusGrounding.get(focusId);
      if (grounding === undefined) throw new FocusCanonicalizationError('UNKNOWN_PREPARED_FOCUS', result.cuId);
      // The grounding pointer names the first same-CU RESOLVED reference whose
      // handle grounds that focus; absent, this is the accepted identity-free
      // local continuation and the pointer stays null.
      let index: number | null = null;
      for (const [referenceIndex, handleId] of resolvedHandleByIndex) {
        if (grounding.includes(handleId)) { index = referenceIndex; break; }
      }
      return { kind: attention.kind, reason: attention.reason, emerging_focus_id: focusId, creates_focus: false, grounding_reference_index: index };
    }
    default:
      throw new FocusCanonicalizationError('INVALID_DURABLE_IDENTITY', result.cuId);
  }
}

function durableHandle(id: string | null, referenceHandleIds: ReadonlyMap<string, string>, cuId: string): string {
  if (id === null) throw new FocusCanonicalizationError('INVALID_DURABLE_IDENTITY', cuId);
  if (id.startsWith(PREPARED_ID_PREFIX)) {
    const durable = referenceHandleIds.get(id);
    if (durable === undefined) throw new FocusCanonicalizationError('UNKNOWN_PREPARED_REFERENCE', cuId);
    return durable;
  }
  assertCanonicalUuid(id, 'INVALID_DURABLE_IDENTITY', cuId);
  return id;
}

function durableFocus(id: string | null, emergingFocusIds: ReadonlyMap<string, string>, cuId: string): string {
  if (id === null) throw new FocusCanonicalizationError('INVALID_DURABLE_IDENTITY', cuId);
  if (id.startsWith(PREPARED_ID_PREFIX)) {
    const durable = emergingFocusIds.get(id);
    if (durable === undefined) throw new FocusCanonicalizationError('UNKNOWN_PREPARED_FOCUS', cuId);
    return durable;
  }
  assertCanonicalUuid(id, 'INVALID_DURABLE_IDENTITY', cuId);
  return id;
}

function assertCanonicalUuid(value: string, reason: 'INVALID_DURABLE_IDENTITY' | 'INVALID_CANONICAL_UNIT_ID', cuId: string | null): void {
  if (typeof value !== 'string' || !CANONICAL_UUID_PATTERN.test(value)) throw new FocusCanonicalizationError(reason, cuId);
}
