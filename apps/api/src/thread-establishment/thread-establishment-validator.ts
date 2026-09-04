// T-03B2a - strict deterministic validation of a provider proposal.
//
// The provider is trusted to PROPOSE; nothing it says becomes a prepared
// decision until every element has passed the rules below against the frozen
// evidence paths, the current CU's canonical B1 semantics and the supplied
// prior context. The rules are the frozen Stage 1.3 / Stage 6 clauses made
// mechanical:
//
//   THR-04/11  identity-specific establishment needs the stable Emerging Focus
//              identity B1 already established; ambiguity is never upgraded;
//   THR-06/13  QANDEEL material may strengthen but never establish alone;
//   THR-07     promotion is by evidence path, never by score;
//   THR-08     one explicit USER selection may be enough - no repetition;
//   THR-09     otherwise substance must exceed incidental mention;
//   THR-10     continuity follows the resolved focus identity, not wording;
//   THR-12     a selection inside someone else's reported/quoted speech is
//              not the user's selection;
//   THR-14     an already-established focus is never established twice.
//
// There is no score, no threshold above the semantic minimum "multiple", no
// frequency count, no timer and no fallback: every violation rejects the whole
// CU evaluation with a typed reason, and a rejection is never turned into
// NO_ESTABLISHMENT.

import { mapAnchorsToSpans } from '../conversation-unit/cu-anchor-mapper';
import type { AnchorSpan, ExtractiveAnchor, MappedAnchor } from '../conversational-focus/conversational-focus.types';
import type { CanonicalClaimAttribution, CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import {
  ATTRIBUTED_CLAIM_FRAMES,
  FOCUS_BEARING_ATTENTION_KINDS,
  STABLE_FOCUS_ID_PATTERN,
  THREAD_ESTABLISHMENT_DECISIONS,
  THREAD_ESTABLISHMENT_PATHS,
  type FocusAttentionHistoryEntry,
  type NoEstablishmentReason,
  type ThreadEstablishmentDecision,
  type ThreadEstablishmentEvaluationInput,
  type ThreadEstablishmentPath,
  type ThreadEstablishmentRejectionReason,
} from './thread-establishment.types';
import type { ThreadEstablishmentProposal } from './thread-establishment-provider.types';

/** The validated core of a prepared result. */
export interface ValidatedThreadEstablishment {
  readonly decision: ThreadEstablishmentDecision;
  readonly path: ThreadEstablishmentPath | null;
  readonly noEstablishmentReason: NoEstablishmentReason | null;
  readonly evidenceCuIds: readonly string[];
  readonly explicitSelectionGrounding: MappedAnchor | null;
}

export type ThreadEstablishmentValidationResult =
  | { readonly outcome: 'VALID'; readonly establishment: ValidatedThreadEstablishment }
  | { readonly outcome: 'REJECTED'; readonly reason: ThreadEstablishmentRejectionReason; readonly index: number };

const reject = (reason: ThreadEstablishmentRejectionReason, index = -1): ThreadEstablishmentValidationResult => ({
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
 * The ONLY possible Thread-establishment target of a CU: the stable Emerging
 * Focus identity its canonical B1 attention carries. NO_INDEPENDENT_FOCUS, a
 * missing id or a non-stable (`prepared:`) id yields no target at all - the
 * evaluator may not manufacture identity that B1 did not establish.
 */
export function establishmentTarget(semantics: CanonicalCuFocusSemanticPayload): string | null {
  const { attention } = semantics;
  if (!isMember(FOCUS_BEARING_ATTENTION_KINDS, attention.kind)) return null;
  const id = attention.emerging_focus_id;
  return typeof id === 'string' && STABLE_FOCUS_ID_PATTERN.test(id) ? id : null;
}

/**
 * Validates one proposal against one evaluation input and returns the
 * prepared core, or the first typed violation. Pure: no I/O, no clock.
 */
export function validateThreadEstablishmentProposal(
  proposal: ThreadEstablishmentProposal,
  input: ThreadEstablishmentEvaluationInput,
): ThreadEstablishmentValidationResult {
  // 1. Shape. Only the four known fields are ever read; anything else the
  //    provider smuggled has no channel into the prepared result.
  if (!isRecord(proposal)) return reject('INVALID_PROVIDER_PAYLOAD');
  if (!isMember(THREAD_ESTABLISHMENT_DECISIONS, proposal.decision)) return reject('INVALID_PROVIDER_PAYLOAD');
  if (proposal.path !== null && !isMember(THREAD_ESTABLISHMENT_PATHS, proposal.path)) return reject('INVALID_PROVIDER_PAYLOAD');
  if (!Array.isArray(proposal.evidenceCuIds)) return reject('INVALID_PROVIDER_PAYLOAD');
  const evidence: string[] = [];
  for (let index = 0; index < proposal.evidenceCuIds.length; index += 1) {
    const id = proposal.evidenceCuIds[index];
    if (!isString(id)) return reject('INVALID_PROVIDER_PAYLOAD', index);
    evidence.push(id);
  }
  if (proposal.explicitSelectionAnchor !== null && !isAnchor(proposal.explicitSelectionAnchor)) return reject('INVALID_PROVIDER_PAYLOAD');
  const anchor: ExtractiveAnchor | null =
    proposal.explicitSelectionAnchor === null
      ? null
      : { text: proposal.explicitSelectionAnchor.text, occurrence: proposal.explicitSelectionAnchor.occurrence };
  const decision: ThreadEstablishmentDecision = proposal.decision;
  const path: ThreadEstablishmentPath | null = proposal.path;

  // 2. NO_ESTABLISHMENT is exactly empty (task §11.1).
  if (decision === 'NO_ESTABLISHMENT') {
    if (path !== null || evidence.length !== 0 || anchor !== null) return reject('INVALID_PROMOTION_PATH');
    return {
      outcome: 'VALID',
      establishment: { decision, path: null, noEstablishmentReason: 'NO_PROMOTION_PATH_PROVEN', evidenceCuIds: [], explicitSelectionGrounding: null },
    };
  }

  // 3. Common ESTABLISH_THREAD requirements (task §11.2).
  if (path === null) return reject('INVALID_PROMOTION_PATH');
  const target = establishmentTarget(input.currentFocusSemantics);
  if (target === null) return reject('ESTABLISHMENT_WITHOUT_FOCUS');
  if (input.priorContext.establishedFocusIds.includes(target)) return reject('FOCUS_ALREADY_ESTABLISHED');
  const currentCuId = input.currentCu.cuId;
  if (!evidence.includes(currentCuId)) return reject('CURRENT_CU_EVIDENCE_REQUIRED');

  const priorPosition = new Map<string, number>(input.priorContext.priorCus.map((cu, position) => [cu.cuId, position]));
  const historyByCu = new Map<string, FocusAttentionHistoryEntry>(input.priorContext.focusAttentionHistory.map((entry) => [entry.cuId, entry]));
  const seen = new Set<string>();
  const priorEvidence: string[] = [];
  for (let index = 0; index < evidence.length; index += 1) {
    const id = evidence[index];
    if (seen.has(id)) return reject('DUPLICATE_EVIDENCE_CU', index);
    seen.add(id);
    if (id === currentCuId) continue;
    // A future CU is not in priorCus, so it is unknown here by construction.
    if (!priorPosition.has(id)) return reject('UNKNOWN_EVIDENCE_CU', index);
    // THR-10/THR-11: focus-specific evidence follows the resolved focus
    // identity. A prior CU counts only when its canonical B1 attention is
    // START/ATTEND of the SAME target focus - never an incidental mention,
    // never another focus, never repeated wording.
    const entry = historyByCu.get(id);
    if (entry === undefined || !isMember(FOCUS_BEARING_ATTENTION_KINDS, entry.attentionKind) || entry.emergingFocusId !== target) {
      return reject('EVIDENCE_NOT_FOCUS_BOUND', index);
    }
    priorEvidence.push(id);
  }
  // Canonical evidence order: prior evidence in committed order, then the current CU.
  const orderedEvidence = [...priorEvidence.sort((left, right) => (priorPosition.get(left) ?? 0) - (priorPosition.get(right) ?? 0)), currentCuId];

  switch (path) {
    case 'TE-01':
      return validateExplicitSelection(input, evidence, anchor);
    case 'TE-02':
      return validateSustainedEngagement(input, orderedEvidence, priorEvidence, anchor);
    case 'TE-03':
      return validateRecurrentAttention(input, orderedEvidence, priorEvidence, anchor, priorPosition, historyByCu, target);
    default:
      return reject('INVALID_PROMOTION_PATH');
  }
}

/**
 * TE-01 (task §11.3, THR-08): one committed USER CU that explicitly selects
 * the focus. Evidence is exactly the current CU; the selection is an exact
 * extractive excerpt of the current committed wording; and it may not lie
 * wholly inside somebody else's reported or quoted speech (THR-12). No prior
 * repetition is required.
 */
function validateExplicitSelection(
  input: ThreadEstablishmentEvaluationInput,
  evidence: readonly string[],
  anchor: ExtractiveAnchor | null,
): ThreadEstablishmentValidationResult {
  if (input.currentCu.sourceRole !== 'USER') return reject('EXPLICIT_SELECTION_ROLE_FORBIDDEN');
  if (evidence.length !== 1) return reject('INVALID_PROMOTION_PATH');
  if (anchor === null) return reject('EXPLICIT_SELECTION_REQUIRED');
  const mapped = mapSelectionAnchor(input.currentCu.committedText, anchor);
  if (mapped.outcome === 'REJECTED') return reject(mapped.reason);
  if (isWhollyAttributed(mapped.mapped.span, input.currentFocusSemantics.claim_attributions)) return reject('ATTRIBUTED_SELECTION_FORBIDDEN');
  return {
    outcome: 'VALID',
    establishment: {
      decision: 'ESTABLISH_THREAD',
      path: 'TE-01',
      noEstablishmentReason: null,
      evidenceCuIds: [input.currentCu.cuId],
      explicitSelectionGrounding: mapped.mapped,
    },
  };
}

/**
 * TE-02 (task §11.4, THR-09): multiple committed CUs sustain substantive
 * attention to the same focus. The structural minimum is the semantic minimum
 * "multiple" - at least two distinct committed CUs including the current one
 * and at least one prior same-focus CU - and nothing above it: no fixed count,
 * no elapsed time, no frequency. At least one USER CU must carry the evidence
 * (THR-06/THR-13). Whether the sequence is substantively sustained is the
 * provider's semantic proposal within these bounds.
 */
function validateSustainedEngagement(
  input: ThreadEstablishmentEvaluationInput,
  orderedEvidence: readonly string[],
  priorEvidence: readonly string[],
  anchor: ExtractiveAnchor | null,
): ThreadEstablishmentValidationResult {
  if (anchor !== null) return reject('INVALID_PROMOTION_PATH');
  if (orderedEvidence.length < 2 || priorEvidence.length < 1) return reject('INSUFFICIENT_SUSTAINED_EVIDENCE');
  if (!hasUserEvidence(input, orderedEvidence)) return reject('USER_EVIDENCE_REQUIRED');
  return {
    outcome: 'VALID',
    establishment: { decision: 'ESTABLISH_THREAD', path: 'TE-02', noEstablishmentReason: null, evidenceCuIds: orderedEvidence, explicitSelectionGrounding: null },
  };
}

/**
 * TE-03 (task §11.5): the focus returns independently. Structurally: at least
 * one earlier same-focus evidence CU, committed material between it and the
 * current CU whose canonical attention demonstrably lay elsewhere, and a
 * current CU that is an independent return rather than a brief local
 * clarification. At least one USER CU must carry the evidence (THR-06/THR-13).
 * No timer and no minimum elapsed duration exist.
 */
function validateRecurrentAttention(
  input: ThreadEstablishmentEvaluationInput,
  orderedEvidence: readonly string[],
  priorEvidence: readonly string[],
  anchor: ExtractiveAnchor | null,
  priorPosition: ReadonlyMap<string, number>,
  historyByCu: ReadonlyMap<string, FocusAttentionHistoryEntry>,
  target: string,
): ThreadEstablishmentValidationResult {
  if (anchor !== null) return reject('INVALID_PROMOTION_PATH');
  if (priorEvidence.length < 1) return reject('RECURRENCE_NOT_PROVEN');
  if (!hasUserEvidence(input, orderedEvidence)) return reject('USER_EVIDENCE_REQUIRED');
  // A brief local clarification anchored to the current subject continues the
  // focus (frozen B1 reason vocabulary); it is not an independent return.
  if (input.currentFocusSemantics.attention.reason === 'LOCAL_CLARIFICATION_OR_CORRECTION') return reject('RECURRENCE_NOT_PROVEN');
  if (!hasInterveningCommittedMaterial(priorEvidence, priorPosition, historyByCu, target)) return reject('RECURRENCE_NOT_PROVEN');
  return {
    outcome: 'VALID',
    establishment: { decision: 'ESTABLISH_THREAD', path: 'TE-03', noEstablishmentReason: null, evidenceCuIds: orderedEvidence, explicitSelectionGrounding: null },
  };
}

/** THR-06/THR-13: QANDEEL-generated CUs alone never establish. */
function hasUserEvidence(input: ThreadEstablishmentEvaluationInput, evidence: readonly string[]): boolean {
  const roleByCu = new Map<string, 'USER' | 'ASSISTANT'>(input.priorContext.priorCus.map((cu) => [cu.cuId, cu.sourceRole]));
  roleByCu.set(input.currentCu.cuId, input.currentCu.sourceRole);
  return evidence.some((id) => roleByCu.get(id) === 'USER');
}

/**
 * Recurrence needs a departure. After the earliest cited same-focus evidence
 * CU there must be at least one committed prior CU whose canonical B1
 * attention is KNOWN and NOT tied to the target focus - another focus, or no
 * independent focus - and which is not itself a local clarification of the
 * current subject. A CU without B1 semantics proves nothing about where
 * attention lay and is never counted by convenience.
 */
function hasInterveningCommittedMaterial(
  priorEvidence: readonly string[],
  priorPosition: ReadonlyMap<string, number>,
  historyByCu: ReadonlyMap<string, FocusAttentionHistoryEntry>,
  target: string,
): boolean {
  const earliest = Math.min(...priorEvidence.map((id) => priorPosition.get(id) ?? Number.MAX_SAFE_INTEGER));
  for (const [cuId, position] of priorPosition) {
    if (position <= earliest) continue;
    const entry = historyByCu.get(cuId);
    if (entry === undefined || entry.emergingFocusId === target) continue;
    if (entry.attentionReason === 'LOCAL_CLARIFICATION_OR_CORRECTION') continue;
    return true;
  }
  return false;
}

/**
 * THR-12 / CU-14: a selection wholly inside a REPORTED_SPEECH or
 * DIRECT_QUOTATION attribution of the current CU is that claimant's wording,
 * not the user's conversational selection. Spans are the canonical B1
 * code-point spans of the same CU, so containment is exact.
 */
function isWhollyAttributed(span: AnchorSpan, claims: readonly CanonicalClaimAttribution[]): boolean {
  return claims.some(
    (claim) => isMember(ATTRIBUTED_CLAIM_FRAMES, claim.claim_frame) && claim.span_start <= span.start && span.end <= claim.span_end,
  );
}

type SelectionMappingResult =
  | { readonly outcome: 'MAPPED'; readonly mapped: MappedAnchor }
  | {
      readonly outcome: 'REJECTED';
      readonly reason: Extract<ThreadEstablishmentRejectionReason, 'INVALID_PROVIDER_PAYLOAD' | 'NON_EXTRACTIVE_SELECTION' | 'OCCURRENCE_OUT_OF_RANGE'>;
    };

/**
 * Maps the ONE selection anchor onto the current CU's committed text through
 * the T-03A1 exact code-point mapper (frontier 0, one anchor alone), exactly as
 * the B1 anchor mapper does. No normalization, no fuzzy match, no paraphrase:
 * an excerpt that is not an exact code-point substring has no location, and a
 * named repetition that does not exist is never substituted.
 */
function mapSelectionAnchor(committedText: string, anchor: ExtractiveAnchor): SelectionMappingResult {
  const text = committedText;
  const result = mapAnchorsToSpans(text, [anchor], 0);
  if (result.outcome === 'MAPPED') {
    const span: AnchorSpan = { start: result.spans[0].start, end: result.spans[0].end };
    return { outcome: 'MAPPED', mapped: { anchor: { text: anchor.text, occurrence: anchor.occurrence }, span } };
  }
  switch (result.reason) {
    case 'NON_EXTRACTIVE_ANCHOR':
      return { outcome: 'REJECTED', reason: 'NON_EXTRACTIVE_SELECTION' };
    case 'AMBIGUOUS_ANCHOR':
    case 'OCCURRENCE_OUT_OF_RANGE':
      return { outcome: 'REJECTED', reason: 'OCCURRENCE_OUT_OF_RANGE' };
    default:
      return { outcome: 'REJECTED', reason: 'INVALID_PROVIDER_PAYLOAD' };
  }
}
