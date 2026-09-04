// T-03B1a - strict deterministic validation of a provider proposal.
//
// The provider is trusted to PROPOSE; nothing it says becomes prepared truth
// until every element has passed the rules below against the allowlists and
// the current CU. The rules are the frozen Stage 1.2 / 1.3 clauses made
// mechanical:
//
//   CU-10  a reference is exactly one of RESOLVED / AMBIGUOUS / UNRESOLVED,
//          and the cardinality of asserted identity matches the state;
//   CU-11  identity is a handle, never a name - the same lexical name may map
//          to distinct allowlisted handles, and no candidate is ever "picked";
//   CU-13  the conversational speaker is never in the proposal at all; the
//          claimant is a separate, independently validated fact;
//   CU-16  an ambiguous or unresolved identity cannot ground a focus;
//   THR-01 a resolved reference never becomes a focus on its own;
//   THR-11 identity-specific continuity needs a RESOLVED link to that focus.
//
// There is no score, no threshold, no frequency count and no fallback: every
// violation rejects the whole CU evaluation with a typed reason, and a
// rejection is never turned into NO_INDEPENDENT_FOCUS.

import {
  ATTENTION_KINDS,
  ATTENTION_REASONS_BY_KIND,
  CLAIM_FRAMES,
  CLAIMANT_KINDS,
  CONVERSATIONAL_FUNCTIONS,
  MAX_CLAIM_ATTRIBUTIONS_PER_CU,
  MAX_FUNCTIONS_PER_CU,
  MAX_REFERENCES_PER_CU,
  REFERENCE_RESOLUTION_STATES,
  SEQUENCE_POSITIONS,
  type AttentionKind,
  type AttentionReason,
  type ClaimFrame,
  type ClaimantKind,
  type ConversationalFocusEvaluationInput,
  type ConversationalFunction,
  type ExtractiveAnchor,
  type FocusEvaluationRejectionReason,
  type MappedAnchor,
  type PreparedAttention,
  type PreparedClaimAttribution,
  type PreparedReferenceResolution,
  type ReferenceResolutionState,
  type SequencePosition,
} from './conversational-focus.types';
import { mapFocusAnchor, sameAnchor } from './focus-anchor-mapper';
import type { FocusResolutionProposal } from './focus-resolution-provider.types';

/** The validated, coordinate-bearing core of a prepared result. */
export interface ValidatedFocusResolution {
  readonly functions: readonly ConversationalFunction[];
  readonly sequencePosition: SequencePosition;
  readonly targetCuId: string | null;
  readonly references: readonly PreparedReferenceResolution[];
  readonly claimAttributions: readonly PreparedClaimAttribution[];
  readonly attention: PreparedAttention;
}

export type FocusResolutionValidationResult =
  | { readonly outcome: 'VALID'; readonly resolution: ValidatedFocusResolution }
  | { readonly outcome: 'REJECTED'; readonly reason: FocusEvaluationRejectionReason; readonly index: number };

const reject = (reason: FocusEvaluationRejectionReason, index = -1): FocusResolutionValidationResult => ({
  outcome: 'REJECTED',
  reason,
  index,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isMember = <T extends string>(vocabulary: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (vocabulary as readonly string[]).includes(value);

function isAnchor(value: unknown): value is ExtractiveAnchor {
  return (
    isRecord(value) &&
    isString(value.text) &&
    typeof value.occurrence === 'number' &&
    Number.isSafeInteger(value.occurrence) &&
    value.occurrence >= 1
  );
}

/**
 * Validates one proposal against one evaluation input and returns the
 * prepared core, or the first typed violation. Pure: no I/O, no clock.
 */
export function validateFocusResolutionProposal(
  proposal: FocusResolutionProposal,
  input: ConversationalFocusEvaluationInput,
): FocusResolutionValidationResult {
  if (!isRecord(proposal)) return reject('INVALID_PROVIDER_PAYLOAD');
  const text = input.currentCu.committedText;
  const priorCuIds = new Set(input.priorContext.priorCus.map((cu) => cu.cuId));
  const handleIds = new Set(input.priorContext.referenceHandles.map((handle) => handle.handleId));
  const focusById = new Map(input.priorContext.focusCandidates.map((focus) => [focus.focusCandidateId, focus]));

  // 1. Conversational functions: frozen vocabulary, no duplicates, no source
  //    duplication (one CU, one list), and FUNCTION_UNRESOLVED stands alone.
  const functions = proposal.functions;
  if (!Array.isArray(functions) || functions.length === 0 || functions.length > MAX_FUNCTIONS_PER_CU) {
    return reject('INVALID_PROVIDER_PAYLOAD');
  }
  const seenFunctions = new Set<string>();
  for (const fn of functions) {
    if (!isMember(CONVERSATIONAL_FUNCTIONS, fn) || seenFunctions.has(fn)) return reject('INVALID_PROVIDER_PAYLOAD');
    seenFunctions.add(fn);
  }
  if (seenFunctions.has('FUNCTION_UNRESOLVED') && seenFunctions.size !== 1) return reject('INVALID_PROVIDER_PAYLOAD');

  // 2. Sequence position and local target binding (§14). A target is a PRIOR
  //    CU of this input: never the current CU, never an unknown CU.
  if (!isMember(SEQUENCE_POSITIONS, proposal.sequencePosition)) return reject('INVALID_PROVIDER_PAYLOAD');
  const targetCuId = proposal.targetCuId;
  if (targetCuId !== null) {
    if (!isString(targetCuId)) return reject('INVALID_PROVIDER_PAYLOAD');
    if (targetCuId === input.currentCu.cuId || !priorCuIds.has(targetCuId)) return reject('UNKNOWN_TARGET_CU');
    if (proposal.sequencePosition === 'INITIATING' || proposal.sequencePosition === 'UNMARKED') {
      return reject('INVALID_PROVIDER_PAYLOAD');
    }
  }

  // 3. References (§11).
  if (!Array.isArray(proposal.references) || proposal.references.length > MAX_REFERENCES_PER_CU) {
    return reject('INVALID_PROVIDER_PAYLOAD');
  }
  const references: PreparedReferenceResolution[] = [];
  for (let index = 0; index < proposal.references.length; index += 1) {
    const entry = proposal.references[index];
    if (!isRecord(entry) || !isAnchor(entry.anchor) || !Array.isArray(entry.candidateHandleIds)) {
      return reject('INVALID_PROVIDER_PAYLOAD', index);
    }
    if (typeof entry.newReference !== 'boolean') return reject('INVALID_PROVIDER_PAYLOAD', index);
    if (entry.resolvedHandleId !== null && !isString(entry.resolvedHandleId)) return reject('INVALID_PROVIDER_PAYLOAD', index);
    if (!isMember(REFERENCE_RESOLUTION_STATES, entry.state)) return reject('INVALID_PROVIDER_PAYLOAD', index);

    const mapped = mapFocusAnchor(text, entry.anchor);
    if (mapped.outcome === 'REJECTED') return reject(mapped.reason, index);

    // Every named candidate must be allowlisted before cardinality is judged,
    // so an invented id is reported as such rather than as a count problem.
    const candidates: string[] = [];
    for (const candidate of entry.candidateHandleIds) {
      if (!isString(candidate)) return reject('INVALID_PROVIDER_PAYLOAD', index);
      if (!handleIds.has(candidate)) return reject('UNKNOWN_REFERENCE_HANDLE', index);
      candidates.push(candidate);
    }
    if (entry.resolvedHandleId !== null && !handleIds.has(entry.resolvedHandleId)) {
      return reject('UNKNOWN_REFERENCE_HANDLE', index);
    }

    const cardinality = referenceCardinality(entry.state, entry.resolvedHandleId, candidates, entry.newReference);
    if (!cardinality) return reject('INVALID_REFERENCE_CARDINALITY', index);

    references.push({
      anchor: mapped.mapped.anchor,
      span: mapped.mapped.span,
      state: entry.state,
      resolvedHandleId: entry.resolvedHandleId,
      candidateHandleIds: candidates,
      newReference: entry.newReference,
    });
  }

  // 4. Claim attributions (§12). The conversational speaker is never proposed;
  //    the claimant is validated on its own.
  if (!Array.isArray(proposal.claimAttributions) || proposal.claimAttributions.length > MAX_CLAIM_ATTRIBUTIONS_PER_CU) {
    return reject('INVALID_PROVIDER_PAYLOAD');
  }
  const claimAttributions: PreparedClaimAttribution[] = [];
  for (let index = 0; index < proposal.claimAttributions.length; index += 1) {
    const entry = proposal.claimAttributions[index];
    if (!isRecord(entry) || !isAnchor(entry.anchor) || !isRecord(entry.claimant)) return reject('INVALID_CLAIM_ATTRIBUTION', index);
    if (!isMember(CLAIM_FRAMES, entry.frame) || !isMember(CLAIMANT_KINDS, entry.claimant.kind)) {
      return reject('INVALID_CLAIM_ATTRIBUTION', index);
    }
    const mapped = mapFocusAnchor(text, entry.anchor);
    if (mapped.outcome === 'REJECTED') return reject(mapped.reason, index);

    const { handleId, referenceIndex } = entry.claimant;
    if (handleId !== null && !isString(handleId)) return reject('INVALID_CLAIM_ATTRIBUTION', index);
    if (referenceIndex !== null && !(typeof referenceIndex === 'number' && Number.isSafeInteger(referenceIndex))) {
      return reject('INVALID_CLAIM_ATTRIBUTION', index);
    }
    const claimant = claimantShape(entry.claimant.kind, handleId, referenceIndex, references, handleIds);
    if (claimant === 'UNKNOWN_HANDLE') return reject('UNKNOWN_REFERENCE_HANDLE', index);
    if (claimant === 'INVALID') return reject('INVALID_CLAIM_ATTRIBUTION', index);

    claimAttributions.push({
      anchor: mapped.mapped.anchor,
      span: mapped.mapped.span,
      claimant: { kind: entry.claimant.kind, handleId, referenceIndex },
      frame: entry.frame as ClaimFrame,
    });
  }

  // 5. Independent attention (§15).
  const attention = proposal.attention;
  if (!isRecord(attention) || !isMember(ATTENTION_KINDS, attention.kind) || !isMember(ATTENTION_REASONS_BY_KIND[attention.kind], attention.reason)) {
    return reject('INVALID_PROVIDER_PAYLOAD');
  }
  if (attention.existingFocusCandidateId !== null && !isString(attention.existingFocusCandidateId)) {
    return reject('INVALID_PROVIDER_PAYLOAD');
  }
  if (attention.groundingAnchor !== null && !isAnchor(attention.groundingAnchor)) return reject('INVALID_PROVIDER_PAYLOAD');

  let grounding: MappedAnchor | null = null;
  if (attention.groundingAnchor !== null) {
    const mapped = mapFocusAnchor(text, attention.groundingAnchor);
    if (mapped.outcome === 'REJECTED') return reject(mapped.reason);
    grounding = mapped.mapped;
  }

  const kind: AttentionKind = attention.kind;
  const reason: AttentionReason = attention.reason;
  if (kind === 'NO_INDEPENDENT_FOCUS') {
    if (attention.existingFocusCandidateId !== null || grounding !== null) return reject('INVALID_PROVIDER_PAYLOAD');
  } else if (kind === 'ATTEND_EXISTING_FOCUS') {
    if (attention.existingFocusCandidateId === null) return reject('UNKNOWN_FOCUS_CANDIDATE');
    const focus = focusById.get(attention.existingFocusCandidateId);
    if (!focus) return reject('UNKNOWN_FOCUS_CANDIDATE');
    if (!continuityIsGrounded(focus.groundingHandleIds, focus.focusCandidateId, input.priorContext.currentFocusCandidateId, references)) {
      return reject('UNGROUNDED_FOCUS_CONTINUITY');
    }
  } else {
    // START_NEW_FOCUS: no provider-authored id, and grounding is an anchor that
    // this same CU RESOLVED as a reference - to a prior handle or to a NEW
    // current-CU reference. An analytical label, a paraphrase, or an
    // ambiguous/unresolved mention cannot be the grounding of a focus.
    if (attention.existingFocusCandidateId !== null) return reject('INVALID_PROVIDER_PAYLOAD');
    if (grounding === null) return reject('FOCUS_GROUNDING_REQUIRED');
    const anchor = grounding.anchor;
    const groundedBy = references.find((reference) => sameAnchor(reference.anchor, anchor));
    if (!groundedBy || groundedBy.state !== 'RESOLVED') return reject('FOCUS_GROUNDING_REQUIRED');
    // FIX-T03B1A-02 - focus-continuity uniqueness. Continuity follows resolved
    // identity: when the grounding handle ALREADY grounds a supplied focus
    // candidate, that locus is represented and must be attended, never minted
    // twice. A prior handle that exists only as a Mention (no focus candidate)
    // may start a focus; a NEW current-CU reference (a relationship, a
    // situation) is independently addressable and may start its own.
    if (groundedBy.resolvedHandleId !== null) {
      const represented = groundedBy.resolvedHandleId;
      if (input.priorContext.focusCandidates.some((focus) => focus.groundingHandleIds.includes(represented))) {
        return reject('EXISTING_FOCUS_CONTINUITY_REQUIRED');
      }
    }
  }

  return {
    outcome: 'VALID',
    resolution: {
      functions: [...functions] as ConversationalFunction[],
      sequencePosition: proposal.sequencePosition,
      targetCuId,
      references,
      claimAttributions,
      attention: { kind, existingFocusCandidateId: attention.existingFocusCandidateId, grounding, reason },
    },
  };
}

/**
 * CU-10 cardinality. RESOLVED asserts exactly one identity: one allowlisted
 * handle, or one NEW current-CU reference - never both, never neither.
 * AMBIGUOUS asserts at least two DISTINCT allowlisted handles and no identity.
 * UNRESOLVED asserts nothing at all.
 */
function referenceCardinality(
  state: ReferenceResolutionState,
  resolvedHandleId: string | null,
  candidates: readonly string[],
  newReference: boolean,
): boolean {
  const distinct = new Set(candidates).size;
  if (distinct !== candidates.length) return false;
  switch (state) {
    case 'RESOLVED':
      if (candidates.length !== 0) return false;
      return (resolvedHandleId !== null && !newReference) || (resolvedHandleId === null && newReference);
    case 'AMBIGUOUS':
      return resolvedHandleId === null && !newReference && distinct >= 2;
    case 'UNRESOLVED':
      return resolvedHandleId === null && !newReference && candidates.length === 0;
    default:
      return false;
  }
}

function claimantShape(
  kind: ClaimantKind,
  handleId: string | null,
  referenceIndex: number | null,
  references: readonly PreparedReferenceResolution[],
  handleIds: ReadonlySet<string>,
): 'OK' | 'INVALID' | 'UNKNOWN_HANDLE' {
  switch (kind) {
    case 'CURRENT_CONVERSATIONAL_SPEAKER':
    case 'UNRESOLVED':
      return handleId === null && referenceIndex === null ? 'OK' : 'INVALID';
    case 'REFERENCE_HANDLE':
      if (handleId === null || referenceIndex !== null) return 'INVALID';
      return handleIds.has(handleId) ? 'OK' : 'UNKNOWN_HANDLE';
    case 'NEW_CURRENT_CU_REFERENCE': {
      if (handleId !== null || referenceIndex === null) return 'INVALID';
      const reference = references[referenceIndex];
      return reference !== undefined && reference.state === 'RESOLVED' && reference.newReference ? 'OK' : 'INVALID';
    }
    default:
      return 'INVALID';
  }
}

/**
 * THR-04 / THR-10 / THR-11. Continuity of an existing focus is grounded when
 *   (a) some reference in this CU RESOLVED to one of the focus's grounding
 *       handles - identity-specific continuity through a resolved name,
 *       pronoun or description, in any language; or
 *   (b) the focus is the CURRENT focus candidate and this CU asserts no
 *       AMBIGUOUS or UNRESOLVED reference at all - identity-free local
 *       continuation (a brief clarification, an elaboration with no new
 *       mention). One unresolved or ambiguous mention removes (b): an
 *       identity that could not be resolved is never promoted by convenience.
 */
function continuityIsGrounded(
  groundingHandleIds: readonly string[],
  focusCandidateId: string,
  currentFocusCandidateId: string | null,
  references: readonly PreparedReferenceResolution[],
): boolean {
  const grounding = new Set(groundingHandleIds);
  const resolvedLink = references.some(
    (reference) => reference.state === 'RESOLVED' && reference.resolvedHandleId !== null && grounding.has(reference.resolvedHandleId),
  );
  if (resolvedLink) return true;
  const everyReferenceResolved = references.every((reference) => reference.state === 'RESOLVED');
  return focusCandidateId === currentFocusCandidateId && everyReferenceResolved;
}
