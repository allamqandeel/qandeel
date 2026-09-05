// T-03B2b3 - the strict combined B1+B2 runtime mappers.
//
// PostgREST JSON is never cast blindly. The authoritative combined context is
// validated field by field and mapped to the exact T-03B1a `PriorContext`, the
// exact canonical B1 semantic bundles, the exact T-03B2a attention history and
// the already-canonical Thread bindings; the integrated batch snapshot is
// validated to its declared shape.
//
// An invalid snapshot or context is REJECTED, never filtered or cleaned: a
// missing B1 bundle on a prior committed CU, a missing attention item, a
// grounding that is not closed over the returned prior CUs / handles /
// focuses, a Thread binding that does not close to canonical prior focus
// truth, a non-ascending SP, a future SP, or any timestamp-shaped field in the
// semantic context is an integrity failure that stops the request before any
// provider is called. A prior committed history gap is integrity failure, not
// "unknown".

import type { CommittedConversationUnit, CommittedConversationUnitEventRow } from '../conversation-unit/conversation-unit.types';
import {
  ATTENTION_KINDS,
  ATTENTION_REASONS_BY_KIND,
  CLAIM_FRAMES,
  CONVERSATIONAL_FUNCTIONS,
  REFERENCE_RESOLUTION_STATES,
  SEQUENCE_POSITIONS,
  type AttentionKind,
  type AttentionReason,
  type ClaimFrame,
  type ConversationalFunction,
  type FocusCandidate,
  type PriorCuContext,
  type ReferenceHandleCandidate,
  type ReferenceResolutionState,
  type SequencePosition,
} from '../conversational-focus/conversational-focus.types';
import {
  DURABLE_CLAIMANT_KINDS,
  type CanonicalClaimAttribution,
  type CanonicalCuFocusSemanticPayload,
  type CanonicalReferenceResolution,
  type DurableClaimantKind,
} from '../conversational-focus/durable-focus-payload.types';
import {
  ConversationThreadIntegrityError,
  THREAD_CAPTURE_STATES,
  type ConversationThreadRuntimeContext,
  type EstablishedThreadBinding,
  type IntegratedFocusThreadBatchSnapshot,
  type ThreadCaptureState,
  type ThreadContextToken,
} from './conversation-thread-runtime.types';
import type { FocusAttentionHistoryEntry } from './thread-establishment.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isSp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isOrdinal = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isMember = <T extends string>(vocabulary: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (vocabulary as readonly string[]).includes(value);
const invalid = (): never => { throw new ConversationThreadIntegrityError('INVALID_THREAD_RUNTIME_CONTEXT'); };
const unclosed = (): never => { throw new ConversationThreadIntegrityError('CONTEXT_GROUNDING_NOT_CLOSED'); };
const incomplete = (): never => { throw new ConversationThreadIntegrityError('INCOMPLETE_PRIOR_THREAD_HISTORY'); };

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const present = Object.keys(record);
  return present.length === keys.length && keys.every((key) => key in record);
}

/** A same-SP sequence arrives from PostgREST as a JSON number or, for bigint, a string. */
function sequenceOf(value: unknown): number {
  const numeric = typeof value === 'string' && /^[0-9]{1,15}$/u.test(value) ? Number(value) : value;
  if (typeof numeric !== 'number' || !Number.isSafeInteger(numeric) || numeric < 0) return invalid();
  return numeric;
}

const CONTEXT_KEYS = [
  'base_current_sp', 'base_same_sp_event_sequence', 'prior_cus', 'reference_handles', 'focus_candidates',
  'current_focus_candidate_id', 'prior_focus_semantics', 'focus_attention_history', 'established_thread_bindings',
] as const;

/**
 * Strictly maps the authoritative combined B1+B2 runtime-context row to the
 * T-03B1a input, the canonical B1 bundles, the T-03B2a attention history and
 * the canonical Thread bindings, plus the exact clock token.
 */
export function mapConversationThreadRuntimeContext(
  row: unknown,
  request: { readonly sessionId: string; readonly userId: string },
): ConversationThreadRuntimeContext {
  if (!isRecord(row) || !isUuid(request.sessionId) || !isUuid(request.userId)) return invalid();
  if (!hasExactKeys(row, CONTEXT_KEYS)) return invalid();

  const sameSpEventSequence = sequenceOf(row.base_same_sp_event_sequence);
  let currentSp: number | null;
  if (row.base_current_sp === null) {
    // Before the first SP the only legal token is (null, 0).
    if (sameSpEventSequence !== 0) return invalid();
    currentSp = null;
  } else if (isSp(row.base_current_sp)) {
    currentSp = row.base_current_sp;
  } else {
    return invalid();
  }
  const token: ThreadContextToken = { currentSp, sameSpEventSequence };

  if (!Array.isArray(row.prior_cus) || !Array.isArray(row.reference_handles) || !Array.isArray(row.focus_candidates)
    || !Array.isArray(row.prior_focus_semantics) || !Array.isArray(row.focus_attention_history)
    || !Array.isArray(row.established_thread_bindings)) {
    return invalid();
  }

  const priorCus: PriorCuContext[] = [];
  const priorCuIds = new Set<string>();
  /** One source turn carries exactly one source role, and its ordinals ascend with SP. */
  const turnBoundaries = new Map<string, { role: 'USER' | 'ASSISTANT'; lastOrdinal: number }>();
  let lastSp = 0;
  for (const entry of row.prior_cus) {
    if (!isRecord(entry) || !hasExactKeys(entry, ['cu_id', 'source_turn_id', 'source_role', 'committed_text', 'ordinal_within_turn', 'session_position', 'functions', 'sequence_position', 'target_cu_id'])) {
      return invalid();
    }
    if (!isUuid(entry.cu_id) || priorCuIds.has(entry.cu_id) || !isUuid(entry.source_turn_id)) return invalid();
    if (entry.source_role !== 'USER' && entry.source_role !== 'ASSISTANT') return invalid();
    if (typeof entry.committed_text !== 'string' || entry.committed_text.length === 0) return invalid();
    if (!isOrdinal(entry.ordinal_within_turn) || !isSp(entry.session_position) || entry.session_position <= lastSp) return invalid();
    const boundary = turnBoundaries.get(entry.source_turn_id);
    if (boundary === undefined) {
      turnBoundaries.set(entry.source_turn_id, { role: entry.source_role, lastOrdinal: entry.ordinal_within_turn });
    } else {
      // One source turn, one role; its CUs ascend in ordinal exactly as they ascend in SP.
      if (boundary.role !== entry.source_role || entry.ordinal_within_turn <= boundary.lastOrdinal) return invalid();
      boundary.lastOrdinal = entry.ordinal_within_turn;
    }
    // A prior committed CU without its B1 bundle is incomplete technical
    // history: it is never mapped as "unknown semantics" and never cleaned.
    if (!Array.isArray(entry.functions) || entry.functions.length === 0) return incomplete();
    const functions: ConversationalFunction[] = [];
    for (const fn of entry.functions) {
      if (!isMember(CONVERSATIONAL_FUNCTIONS, fn) || functions.includes(fn)) return invalid();
      functions.push(fn);
    }
    if (!isMember(SEQUENCE_POSITIONS, entry.sequence_position)) return invalid();
    const sequencePosition: SequencePosition = entry.sequence_position;
    if (entry.target_cu_id !== null && !isUuid(entry.target_cu_id)) return invalid();
    if (entry.target_cu_id !== null && !priorCuIds.has(entry.target_cu_id)) return unclosed();
    lastSp = entry.session_position;
    priorCuIds.add(entry.cu_id);
    priorCus.push({
      cuId: entry.cu_id,
      sourceTurnId: entry.source_turn_id,
      sourceRole: entry.source_role,
      committedText: entry.committed_text,
      ordinalWithinTurn: entry.ordinal_within_turn,
      functions,
      sequencePosition,
      targetCuId: entry.target_cu_id,
    });
  }
  // The token and the prior CUs describe the same Session time.
  if (currentSp === null ? priorCus.length !== 0 : lastSp !== currentSp) return invalid();

  const referenceHandles: ReferenceHandleCandidate[] = [];
  const handleIds = new Set<string>();
  for (const entry of row.reference_handles) {
    if (!isRecord(entry) || !hasExactKeys(entry, ['handle_id', 'grounding']) || !isUuid(entry.handle_id) || handleIds.has(entry.handle_id)) return invalid();
    if (!Array.isArray(entry.grounding) || entry.grounding.length === 0) return invalid();
    const grounding = entry.grounding.map((g) => {
      if (!isRecord(g) || !hasExactKeys(g, ['cu_id', 'exact_surface']) || !isUuid(g.cu_id)) return invalid();
      if (typeof g.exact_surface !== 'string' || g.exact_surface.length === 0) return invalid();
      if (!priorCuIds.has(g.cu_id)) return unclosed();
      return { cuId: g.cu_id, exactSurface: g.exact_surface };
    });
    handleIds.add(entry.handle_id);
    referenceHandles.push({ handleId: entry.handle_id, grounding });
  }

  const focusCandidates: FocusCandidate[] = [];
  const focusIds = new Set<string>();
  for (const entry of row.focus_candidates) {
    if (!isRecord(entry) || !hasExactKeys(entry, ['focus_candidate_id', 'grounding_handle_ids', 'prior_grounding_cu_ids'])) return invalid();
    if (!isUuid(entry.focus_candidate_id) || focusIds.has(entry.focus_candidate_id)) return invalid();
    if (!Array.isArray(entry.grounding_handle_ids) || entry.grounding_handle_ids.length === 0
      || !Array.isArray(entry.prior_grounding_cu_ids) || entry.prior_grounding_cu_ids.length === 0) {
      return invalid();
    }
    const groundingHandleIds = entry.grounding_handle_ids.map((id) => {
      if (!isUuid(id)) return invalid();
      if (!handleIds.has(id)) return unclosed();
      return id;
    });
    const priorGroundingCuIds = entry.prior_grounding_cu_ids.map((id) => {
      if (!isUuid(id)) return invalid();
      if (!priorCuIds.has(id)) return unclosed();
      return id;
    });
    focusIds.add(entry.focus_candidate_id);
    focusCandidates.push({ focusCandidateId: entry.focus_candidate_id, groundingHandleIds, priorGroundingCuIds });
  }

  const current = row.current_focus_candidate_id;
  if (current !== null) {
    if (!isUuid(current)) return invalid();
    if (!focusIds.has(current)) return unclosed();
  }

  // Exactly ONE complete canonical B1 bundle per prior committed CU, in the
  // same SP order, with an exact `unit_id` match. No missing bundle is ever
  // silently filtered, and no extra bundle is ever accepted.
  if (row.prior_focus_semantics.length !== priorCus.length) return incomplete();
  const priorFocusSemantics: CanonicalCuFocusSemanticPayload[] = [];
  for (const [index, entry] of row.prior_focus_semantics.entries()) {
    const bundle = mapCanonicalFocusBundle(entry, { handleIds, focusIds, priorCuIds });
    if (bundle.unit_id !== priorCus[index].cuId) return incomplete();
    if (bundle.sequence_position !== priorCus[index].sequencePosition
      || bundle.target_cu_id !== priorCus[index].targetCuId
      || bundle.functions.length !== priorCus[index].functions?.length
      || bundle.functions.some((fn, at) => fn !== priorCus[index].functions?.[at])) {
      return invalid();
    }
    priorFocusSemantics.push(bundle);
  }

  // One attention item per prior committed CU, in the same order.
  if (row.focus_attention_history.length !== priorCus.length) return incomplete();
  const focusAttentionHistory: FocusAttentionHistoryEntry[] = [];
  for (const [index, entry] of row.focus_attention_history.entries()) {
    if (!isRecord(entry) || !hasExactKeys(entry, ['cu_id', 'attention_kind', 'attention_reason', 'emerging_focus_id'])) return invalid();
    if (entry.cu_id !== priorCus[index].cuId) return incomplete();
    if (!isMember(ATTENTION_KINDS, entry.attention_kind)) return invalid();
    const attentionKind: AttentionKind = entry.attention_kind;
    if (!isMember(ATTENTION_REASONS_BY_KIND[attentionKind], entry.attention_reason)) return invalid();
    const attentionReason: AttentionReason = entry.attention_reason;
    if (entry.emerging_focus_id === null) {
      if (attentionKind !== 'NO_INDEPENDENT_FOCUS') return invalid();
    } else {
      if (attentionKind === 'NO_INDEPENDENT_FOCUS' || !isUuid(entry.emerging_focus_id)) return invalid();
      if (!focusIds.has(entry.emerging_focus_id)) return unclosed();
    }
    // The attention item and the CU's own canonical bundle are one truth.
    const bundle = priorFocusSemantics[index].attention;
    if (bundle.kind !== attentionKind || bundle.reason !== attentionReason || bundle.emerging_focus_id !== entry.emerging_focus_id) return invalid();
    focusAttentionHistory.push({
      cuId: entry.cu_id,
      attentionKind,
      attentionReason,
      emergingFocusId: entry.emerging_focus_id,
    });
  }

  // Canonical Thread truth: unique Thread ids, unique grounding focuses, prior
  // same-Session SPs only, and every binding closed over canonical prior focus
  // truth. Nothing here is a lifecycle, a reopening or a cross-session claim.
  const establishedThreadBindings: EstablishedThreadBinding[] = [];
  const threadIds = new Set<string>();
  const boundFocusIds = new Set<string>();
  const attentionByCuId = new Map(focusAttentionHistory.map((entry) => [entry.cuId, entry]));
  for (const entry of row.established_thread_bindings) {
    if (!isRecord(entry) || !hasExactKeys(entry, ['thread_id', 'emerging_focus_id', 'established_cu_id', 'established_sp'])) return invalid();
    if (!isUuid(entry.thread_id) || threadIds.has(entry.thread_id)) return invalid();
    if (!isUuid(entry.emerging_focus_id) || boundFocusIds.has(entry.emerging_focus_id)) return invalid();
    if (!isUuid(entry.established_cu_id) || !isSp(entry.established_sp)) return invalid();
    // No future Thread: the establishing SP is inside the token's own history.
    if (currentSp === null || entry.established_sp > currentSp) return invalid();
    if (!priorCuIds.has(entry.established_cu_id)) return unclosed();
    if (!focusIds.has(entry.emerging_focus_id)) return unclosed();
    const attention = attentionByCuId.get(entry.established_cu_id);
    if (attention === undefined || attention.emergingFocusId !== entry.emerging_focus_id
      || attention.attentionKind === 'NO_INDEPENDENT_FOCUS') {
      return unclosed();
    }
    threadIds.add(entry.thread_id);
    boundFocusIds.add(entry.emerging_focus_id);
    establishedThreadBindings.push({
      threadId: entry.thread_id,
      emergingFocusId: entry.emerging_focus_id,
      establishedCuId: entry.established_cu_id,
      establishedSp: entry.established_sp,
    });
  }

  return {
    sessionId: request.sessionId,
    token,
    priorContext: { priorCus, referenceHandles, focusCandidates, currentFocusCandidateId: current },
    priorFocusSemantics,
    focusAttentionHistory,
    establishedThreadBindings,
  };
}

/**
 * Strictly maps ONE canonical B1 semantic bundle. Every vocabulary is the
 * frozen T-03B1 one, every anchor keeps its exact code-point coordinates, and
 * every identity must close over the handles / focuses / prior CUs of the SAME
 * authoritative context row. No timestamp field is representable.
 */
function mapCanonicalFocusBundle(
  value: unknown,
  closure: { handleIds: ReadonlySet<string>; focusIds: ReadonlySet<string>; priorCuIds: ReadonlySet<string> },
): CanonicalCuFocusSemanticPayload {
  if (!isRecord(value) || !hasExactKeys(value, ['unit_id', 'functions', 'sequence_position', 'target_cu_id', 'references', 'claim_attributions', 'attention'])) {
    return invalid();
  }
  if (!isUuid(value.unit_id)) return invalid();
  if (!Array.isArray(value.functions) || value.functions.length === 0) return incomplete();
  const functions: ConversationalFunction[] = [];
  for (const fn of value.functions) {
    if (!isMember(CONVERSATIONAL_FUNCTIONS, fn) || functions.includes(fn)) return invalid();
    functions.push(fn);
  }
  if (functions.includes('FUNCTION_UNRESOLVED') && functions.length !== 1) return invalid();
  if (!isMember(SEQUENCE_POSITIONS, value.sequence_position)) return invalid();
  const sequencePosition: SequencePosition = value.sequence_position;
  if (value.target_cu_id !== null) {
    if (!isUuid(value.target_cu_id)) return invalid();
    if (value.target_cu_id === value.unit_id) return invalid();
    if (!closure.priorCuIds.has(value.target_cu_id)) return unclosed();
  }
  if (!Array.isArray(value.references) || !Array.isArray(value.claim_attributions)) return invalid();

  const references: CanonicalReferenceResolution[] = [];
  for (const [index, entry] of value.references.entries()) {
    if (!isRecord(entry) || !hasExactKeys(entry, ['reference_index', 'anchor_text', 'anchor_occurrence', 'span_start', 'span_end', 'state', 'resolved_handle_id', 'creates_handle', 'candidate_handle_ids'])) {
      return invalid();
    }
    if (entry.reference_index !== index) return invalid();
    const anchor = mapAnchor(entry);
    if (!isMember(REFERENCE_RESOLUTION_STATES, entry.state)) return invalid();
    const state: ReferenceResolutionState = entry.state;
    if (typeof entry.creates_handle !== 'boolean') return invalid();
    if (!Array.isArray(entry.candidate_handle_ids)) return invalid();
    if (state === 'RESOLVED') {
      if (!isUuid(entry.resolved_handle_id)) return invalid();
      if (!closure.handleIds.has(entry.resolved_handle_id)) return unclosed();
      if (entry.candidate_handle_ids.length !== 0) return invalid();
    } else {
      if (entry.resolved_handle_id !== null || entry.creates_handle) return invalid();
      if (state === 'AMBIGUOUS' ? entry.candidate_handle_ids.length < 2 : entry.candidate_handle_ids.length !== 0) return invalid();
    }
    const candidateHandleIds: string[] = [];
    for (const candidate of entry.candidate_handle_ids) {
      if (!isUuid(candidate) || candidateHandleIds.includes(candidate)) return invalid();
      if (!closure.handleIds.has(candidate)) return unclosed();
      candidateHandleIds.push(candidate);
    }
    references.push({
      reference_index: index,
      ...anchor,
      state,
      resolved_handle_id: state === 'RESOLVED' ? (entry.resolved_handle_id as string) : null,
      creates_handle: entry.creates_handle,
      candidate_handle_ids: candidateHandleIds,
    });
  }

  const claimAttributions: CanonicalClaimAttribution[] = [];
  for (const [index, entry] of value.claim_attributions.entries()) {
    if (!isRecord(entry) || !hasExactKeys(entry, ['attribution_index', 'anchor_text', 'anchor_occurrence', 'span_start', 'span_end', 'claimant_kind', 'claimant_handle_id', 'claim_frame'])) {
      return invalid();
    }
    if (entry.attribution_index !== index) return invalid();
    const anchor = mapAnchor(entry);
    if (!isMember(DURABLE_CLAIMANT_KINDS, entry.claimant_kind)) return invalid();
    const claimantKind: DurableClaimantKind = entry.claimant_kind;
    if (claimantKind === 'REFERENCE_HANDLE') {
      if (!isUuid(entry.claimant_handle_id)) return invalid();
      if (!closure.handleIds.has(entry.claimant_handle_id)) return unclosed();
    } else if (entry.claimant_handle_id !== null) {
      return invalid();
    }
    if (!isMember(CLAIM_FRAMES, entry.claim_frame)) return invalid();
    const claimFrame: ClaimFrame = entry.claim_frame;
    claimAttributions.push({
      attribution_index: index,
      ...anchor,
      claimant_kind: claimantKind,
      claimant_handle_id: claimantKind === 'REFERENCE_HANDLE' ? (entry.claimant_handle_id as string) : null,
      claim_frame: claimFrame,
    });
  }

  const attentionRow = value.attention;
  if (!isRecord(attentionRow) || !hasExactKeys(attentionRow, ['kind', 'reason', 'emerging_focus_id', 'creates_focus', 'grounding_reference_index'])) return invalid();
  if (!isMember(ATTENTION_KINDS, attentionRow.kind)) return invalid();
  const attentionKind: AttentionKind = attentionRow.kind;
  if (!isMember(ATTENTION_REASONS_BY_KIND[attentionKind], attentionRow.reason)) return invalid();
  const attentionReason: AttentionReason = attentionRow.reason;
  if (typeof attentionRow.creates_focus !== 'boolean') return invalid();
  if (attentionKind === 'NO_INDEPENDENT_FOCUS') {
    if (attentionRow.emerging_focus_id !== null || attentionRow.creates_focus || attentionRow.grounding_reference_index !== null) return invalid();
  } else {
    if (!isUuid(attentionRow.emerging_focus_id)) return invalid();
    if (!closure.focusIds.has(attentionRow.emerging_focus_id)) return unclosed();
    if (attentionRow.creates_focus !== (attentionKind === 'START_NEW_FOCUS')) return invalid();
    if (attentionKind === 'START_NEW_FOCUS' && attentionRow.grounding_reference_index === null) return invalid();
  }
  let groundingReferenceIndex: number | null = null;
  if (attentionRow.grounding_reference_index !== null) {
    if (!isOrdinal(attentionRow.grounding_reference_index)) return invalid();
    groundingReferenceIndex = attentionRow.grounding_reference_index;
    if (groundingReferenceIndex >= references.length) return invalid();
    if (references[groundingReferenceIndex].state !== 'RESOLVED') return invalid();
  }

  return {
    unit_id: value.unit_id,
    functions,
    sequence_position: sequencePosition,
    target_cu_id: value.target_cu_id === null ? null : (value.target_cu_id as string),
    references,
    claim_attributions: claimAttributions,
    attention: {
      kind: attentionKind,
      reason: attentionReason,
      emerging_focus_id: attentionRow.emerging_focus_id === null ? null : (attentionRow.emerging_focus_id as string),
      creates_focus: attentionRow.creates_focus,
      grounding_reference_index: groundingReferenceIndex,
    },
  };
}

/** The exact extractive anchor coordinates, in Unicode code points. Never UTF-16 offsets. */
function mapAnchor(entry: Record<string, unknown>): { anchor_text: string; anchor_occurrence: number; span_start: number; span_end: number } {
  if (typeof entry.anchor_text !== 'string' || entry.anchor_text.length === 0) return invalid();
  if (typeof entry.anchor_occurrence !== 'number' || !Number.isSafeInteger(entry.anchor_occurrence) || entry.anchor_occurrence < 1) return invalid();
  if (!isOrdinal(entry.span_start) || !isOrdinal(entry.span_end) || entry.span_end <= entry.span_start) return invalid();
  if (Array.from(entry.anchor_text).length !== entry.span_end - entry.span_start) return invalid();
  return {
    anchor_text: entry.anchor_text,
    anchor_occurrence: entry.anchor_occurrence,
    span_start: entry.span_start,
    span_end: entry.span_end,
  };
}

const SNAPSHOT_KEYS = [
  'batch_exists', 'committed_unit_count', 'units', 'commit_event', 'source_frontier', 'live_head',
  'focus_batch_exists', 'focus_semantic_count', 'focus_attention_count', 'focus_complete',
  'thread_capture_state', 'thread_batch_exists', 'thread_unit_count', 'thread_establishment_count',
] as const;

/**
 * Strictly validates the integrated B1+B2 batch snapshot row.
 *
 * `thread_capture_state` decides whether the establishment service treats the
 * exchange as canonical replay and returns stored temporal delivery WITHOUT
 * calling a semantic provider, so this boundary re-derives every claim it can
 * from the counts in the same row. A row whose state disagrees with its own
 * counts is malformed transport and is rejected; it is never repaired, and an
 * honest ABSENT or PARTIAL stays exactly that. PARTIAL is never mapped into
 * COMPLETE - the only direction that can be unsafe.
 */
export function mapIntegratedFocusThreadBatchSnapshot(row: unknown): IntegratedFocusThreadBatchSnapshot {
  const reject = (): never => { throw new ConversationThreadIntegrityError('INVALID_INTEGRATED_SNAPSHOT'); };
  if (!isRecord(row)) return reject();
  for (const key of SNAPSHOT_KEYS) if (!(key in row)) return reject();
  if (typeof row.batch_exists !== 'boolean' || typeof row.focus_batch_exists !== 'boolean'
    || typeof row.focus_complete !== 'boolean' || typeof row.thread_batch_exists !== 'boolean') return reject();
  if (!isOrdinal(row.committed_unit_count) || !isOrdinal(row.focus_semantic_count) || !isOrdinal(row.focus_attention_count)
    || !isOrdinal(row.source_frontier) || !isOrdinal(row.thread_unit_count) || !isOrdinal(row.thread_establishment_count)) return reject();
  if (row.live_head !== null && !isSp(row.live_head)) return reject();
  if (!Array.isArray(row.units) || row.units.length !== row.committed_unit_count) return reject();
  if (row.commit_event !== null && !isRecord(row.commit_event)) return reject();
  if (!isMember(THREAD_CAPTURE_STATES, row.thread_capture_state)) return reject();
  const threadCaptureState: ThreadCaptureState = row.thread_capture_state;
  // An absent commitment batch has no coordinates, no units, no delivery
  // event and no B1 / B2 half at all: nothing about it may be non-empty.
  if (!row.batch_exists && (row.committed_unit_count !== 0 || row.commit_event !== null
    || row.focus_batch_exists || row.focus_semantic_count !== 0 || row.focus_attention_count !== 0 || row.focus_complete
    || row.thread_batch_exists || row.thread_unit_count !== 0 || row.thread_establishment_count !== 0)) return reject();
  // Without a focus batch there is no B1 row to count and nothing to complete.
  if (!row.focus_batch_exists && (row.focus_semantic_count !== 0 || row.focus_attention_count !== 0 || row.focus_complete)) return reject();
  // Without a Thread capture batch there is no B2 unit or establishment to count.
  if (!row.thread_batch_exists && (row.thread_unit_count !== 0 || row.thread_establishment_count !== 0)) return reject();
  // The RPC counts only rows that AGREE with a committed CU, so a count above
  // the committed count cannot be produced by the database: it is malformed
  // transport, not an incomplete state.
  if (row.focus_semantic_count > row.committed_unit_count || row.focus_attention_count > row.committed_unit_count) return reject();
  if (row.thread_establishment_count > row.thread_unit_count) return reject();
  // ABSENT means every layer is absent; COMPLETE means every layer is whole.
  // Both claims must be provable from the counts in the same row. PARTIAL is
  // accepted as given: refusing completeness is always safe, and an honest
  // PARTIAL can never be upgraded here.
  if (threadCaptureState === 'ABSENT' && (row.batch_exists || row.focus_batch_exists || row.thread_batch_exists)) return reject();
  if (threadCaptureState === 'COMPLETE' && !(row.batch_exists && row.focus_batch_exists && row.thread_batch_exists
    && row.focus_complete
    && row.focus_semantic_count === row.committed_unit_count
    && row.focus_attention_count === row.committed_unit_count
    && row.thread_unit_count === row.committed_unit_count)) return reject();
  if (row.focus_complete && !(row.batch_exists && row.focus_batch_exists
    && row.focus_semantic_count === row.committed_unit_count
    && row.focus_attention_count === row.committed_unit_count)) return reject();
  for (const unit of row.units) {
    if (!isRecord(unit) || !isUuid(unit.id) || !isSp(unit.session_position)) return reject();
  }
  return {
    batch_exists: row.batch_exists,
    committed_unit_count: row.committed_unit_count,
    units: row.units as readonly CommittedConversationUnit[],
    commit_event: row.commit_event as CommittedConversationUnitEventRow | null,
    source_frontier: row.source_frontier,
    live_head: row.live_head,
    focus_batch_exists: row.focus_batch_exists,
    focus_semantic_count: row.focus_semantic_count,
    focus_attention_count: row.focus_attention_count,
    focus_complete: row.focus_complete,
    thread_capture_state: threadCaptureState,
    thread_batch_exists: row.thread_batch_exists,
    thread_unit_count: row.thread_unit_count,
    thread_establishment_count: row.thread_establishment_count,
  };
}
