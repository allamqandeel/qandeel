// T-03B1b2 - the strict runtime mappers.
//
// PostgREST JSON is never cast blindly. The authoritative B1 context snapshot
// is validated field by field and mapped to the exact T-03B1a `PriorContext`
// shape; the integrated batch snapshot is validated to its declared shape.
// An invalid snapshot is REJECTED, never filtered or cleaned: a missing B1
// bundle on a prior committed CU, a grounding that is not closed over the
// returned prior CUs, a non-ascending SP, or any timestamp-shaped field in the
// semantic context is an integrity failure that stops the request before any
// provider is called.

import type { CommittedConversationUnit, CommittedConversationUnitEventRow } from '../conversation-unit/conversation-unit.types';
import {
  CONVERSATIONAL_FUNCTIONS,
  SEQUENCE_POSITIONS,
  type ConversationalFunction,
  type FocusCandidate,
  type PriorCuContext,
  type ReferenceHandleCandidate,
  type SequencePosition,
} from './conversational-focus.types';
import {
  ConversationFocusIntegrityError,
  type ConversationFocusRuntimeContext,
  type FocusContextToken,
  type IntegratedBatchSnapshot,
} from './conversation-focus-runtime.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isSp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isOrdinal = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isMember = <T extends string>(vocabulary: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (vocabulary as readonly string[]).includes(value);
const invalid = (): never => { throw new ConversationFocusIntegrityError('INVALID_RUNTIME_CONTEXT'); };
const unclosed = (): never => { throw new ConversationFocusIntegrityError('CONTEXT_GROUNDING_NOT_CLOSED'); };

/** A same-SP sequence arrives from PostgREST as a JSON number or, for bigint, a string. */
function sequenceOf(value: unknown): number {
  const numeric = typeof value === 'string' && /^[0-9]{1,15}$/u.test(value) ? Number(value) : value;
  if (typeof numeric !== 'number' || !Number.isSafeInteger(numeric) || numeric < 0) return invalid();
  return numeric;
}

/** Strictly maps the authoritative B1 runtime-context row to the T-03B1a input plus the token. */
export function mapConversationFocusRuntimeContext(
  row: unknown,
  request: { readonly sessionId: string; readonly userId: string },
): ConversationFocusRuntimeContext {
  if (!isRecord(row) || !isUuid(request.sessionId) || !isUuid(request.userId)) return invalid();
  if (!hasExactKeys(row, ['base_current_sp', 'base_same_sp_event_sequence', 'prior_cus', 'reference_handles', 'focus_candidates', 'current_focus_candidate_id'])) {
    return invalid();
  }
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
  const token: FocusContextToken = { currentSp, sameSpEventSequence };

  if (!Array.isArray(row.prior_cus) || !Array.isArray(row.reference_handles) || !Array.isArray(row.focus_candidates)) return invalid();

  const priorCus: PriorCuContext[] = [];
  const priorCuIds = new Set<string>();
  let lastSp = 0;
  for (const entry of row.prior_cus) {
    if (!isRecord(entry) || !hasExactKeys(entry, ['cu_id', 'source_turn_id', 'source_role', 'committed_text', 'ordinal_within_turn', 'session_position', 'functions', 'sequence_position', 'target_cu_id'])) {
      return invalid();
    }
    if (!isUuid(entry.cu_id) || priorCuIds.has(entry.cu_id) || !isUuid(entry.source_turn_id)) return invalid();
    if (entry.source_role !== 'USER' && entry.source_role !== 'ASSISTANT') return invalid();
    if (typeof entry.committed_text !== 'string' || entry.committed_text.length === 0) return invalid();
    if (!isOrdinal(entry.ordinal_within_turn) || !isSp(entry.session_position) || entry.session_position <= lastSp) return invalid();
    // A prior committed CU without its B1 bundle is incomplete technical
    // history: it is never mapped as "unknown semantics" and never cleaned.
    if (!Array.isArray(entry.functions) || entry.functions.length === 0) return invalid();
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
    if (!Array.isArray(entry.grounding_handle_ids) || entry.grounding_handle_ids.length === 0 || !Array.isArray(entry.prior_grounding_cu_ids) || entry.prior_grounding_cu_ids.length === 0) {
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

  return {
    sessionId: request.sessionId,
    token,
    priorContext: { priorCus, referenceHandles, focusCandidates, currentFocusCandidateId: current },
  };
}

/** Strictly validates the integrated batch snapshot row. */
export function mapIntegratedBatchSnapshot(row: unknown): IntegratedBatchSnapshot {
  const reject = (): never => { throw new ConversationFocusIntegrityError('INVALID_INTEGRATED_SNAPSHOT'); };
  if (!isRecord(row)) return reject();
  const required = ['batch_exists', 'committed_unit_count', 'units', 'commit_event', 'source_frontier', 'live_head',
    'focus_batch_exists', 'focus_semantic_count', 'focus_attention_count', 'focus_complete'];
  for (const key of required) if (!(key in row)) return reject();
  if (typeof row.batch_exists !== 'boolean' || typeof row.focus_batch_exists !== 'boolean' || typeof row.focus_complete !== 'boolean') return reject();
  if (!isOrdinal(row.committed_unit_count) || !isOrdinal(row.focus_semantic_count) || !isOrdinal(row.focus_attention_count) || !isOrdinal(row.source_frontier)) return reject();
  if (row.live_head !== null && !isSp(row.live_head)) return reject();
  if (!Array.isArray(row.units) || row.units.length !== row.committed_unit_count) return reject();
  if (row.commit_event !== null && !isRecord(row.commit_event)) return reject();
  if (!row.batch_exists && (row.committed_unit_count !== 0 || row.focus_batch_exists || row.focus_complete || row.commit_event !== null)) return reject();
  if (row.focus_complete && !row.focus_batch_exists) return reject();
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
  };
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const present = Object.keys(record);
  return present.length === keys.length && keys.every((key) => key in record);
}
