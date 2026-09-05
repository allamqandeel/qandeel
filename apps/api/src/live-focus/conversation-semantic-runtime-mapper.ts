// T-03D - the strict FINAL-chain runtime mappers.
//
// PostgREST JSON is never cast blindly. The T-03B3 mappers remain the
// authority for the commitment / B1 / B2 / B3 halves of both reads (they are
// REUSED on the exact projection they own, never restated); this module adds
// the strict validation of the LF additions:
//
//   snapshot  the full-chain capture state, re-derived from the same row's
//             counts wherever it can be (PARTIAL is accepted as given, never
//             upgraded), this batch's LF transitions in strictly ascending SP
//             order, and the Session's current LF
//   context   the current effective LF: inside the closed domain, a UUID
//             reference exactly when not NONE, never at an SP beyond the
//             base token, and NONE before the first SP
//
// An invalid row is REJECTED, never filtered or cleaned.

import { mapConversationThreadLifecycleRuntimeContext, mapIntegratedThreadLifecycleBatchSnapshot } from '../thread-lifecycle/conversation-thread-lifecycle-runtime-mapper';
import { THREAD_CAPTURE_STATES, type ThreadCaptureState } from '../thread-establishment/conversation-thread-runtime.types';
import {
  ConversationSemanticIntegrityError,
  type ConversationSemanticRuntimeContext,
  type FinalizedExchangeWithFullSemanticChainResult,
  type IntegratedFullSemanticBatchSnapshot,
  type StoredLiveFocusTransition,
} from './conversation-semantic-runtime.types';
import { LIVE_FOCUS_KINDS, liveFocusFromParts, type EffectiveLiveFocus, type LiveFocusKind } from './live-focus.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isSp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isOrdinal = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isMember = <T extends string>(vocabulary: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (vocabulary as readonly string[]).includes(value);

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const present = Object.keys(record);
  return present.length === keys.length && keys.every((key) => key in record);
}

/** Strictly maps one `(kind, ref)` pair into the closed LF domain, or rejects with the caller's error. */
export function mapLiveFocusValue(kind: unknown, ref: unknown, reject: () => never): EffectiveLiveFocus {
  if (!isMember(LIVE_FOCUS_KINDS, kind)) return reject();
  const liveFocusKind: LiveFocusKind = kind;
  if (liveFocusKind === 'NONE') {
    if (ref !== null) return reject();
    return liveFocusFromParts('NONE', null);
  }
  if (!isUuid(ref)) return reject();
  return liveFocusFromParts(liveFocusKind, ref);
}

/** Strictly maps a delivered transition list: exact keys, closed domain, strictly ascending SP. */
export function mapStoredLiveFocusTransitions(rows: unknown, reject: () => never): readonly StoredLiveFocusTransition[] {
  if (!Array.isArray(rows)) return reject();
  const out: StoredLiveFocusTransition[] = [];
  let lastSp = 0;
  for (const row of rows) {
    if (!isRecord(row) || !hasExactKeys(row, ['session_position', 'to_kind', 'to_ref']) || !isSp(row.session_position)) return reject();
    if (row.session_position <= lastSp) return reject();
    lastSp = row.session_position;
    out.push({ sessionPosition: row.session_position, to: mapLiveFocusValue(row.to_kind, row.to_ref, reject) });
  }
  return out;
}

const BASE_SNAPSHOT_KEYS = [
  'batch_exists', 'committed_unit_count', 'units', 'commit_event', 'source_frontier', 'live_head',
  'focus_batch_exists', 'focus_semantic_count', 'focus_attention_count', 'focus_complete',
  'thread_capture_state', 'thread_batch_exists', 'thread_unit_count', 'thread_establishment_count',
  'thread_semantic_capture_state', 'thread_semantic_batch_exists', 'thread_semantic_unit_count', 'continuity_binding_count', 'lifecycle_transition_count',
] as const;
const SNAPSHOT_KEYS = [...BASE_SNAPSHOT_KEYS, 'full_semantic_capture_state', 'live_focus_batch_exists', 'live_focus_unit_count',
  'live_focus_transition_count', 'live_focus_transitions', 'session_live_focus_kind', 'session_live_focus_ref', 'session_live_focus_sp'] as const;

/**
 * Strictly validates the integrated batch snapshot row. The FINAL capture
 * state decides replay, so every claim provable from the same row is
 * re-derived; PARTIAL is accepted as given and never upgraded.
 */
export function mapIntegratedFullSemanticBatchSnapshot(row: unknown): IntegratedFullSemanticBatchSnapshot {
  const reject = (): never => { throw new ConversationSemanticIntegrityError('INVALID_INTEGRATED_SNAPSHOT'); };
  // Exact keys: the 0071 read returns exactly these columns, so a label, a
  // same-SP sequence or any other extra field is malformed transport.
  if (!isRecord(row) || !hasExactKeys(row, SNAPSHOT_KEYS)) return reject();
  const base = mapIntegratedThreadLifecycleBatchSnapshot(Object.fromEntries(BASE_SNAPSHOT_KEYS.map((key) => [key, row[key]])));
  if (!isMember(THREAD_CAPTURE_STATES, row.full_semantic_capture_state)) return reject();
  const state: ThreadCaptureState = row.full_semantic_capture_state;
  if (typeof row.live_focus_batch_exists !== 'boolean') return reject();
  if (!isOrdinal(row.live_focus_unit_count) || !isOrdinal(row.live_focus_transition_count)) return reject();
  if (!row.live_focus_batch_exists && (row.live_focus_unit_count !== 0 || row.live_focus_transition_count !== 0)) return reject();
  if (row.live_focus_transition_count > row.live_focus_unit_count) return reject();
  const transitions = mapStoredLiveFocusTransitions(row.live_focus_transitions, reject);
  if (transitions.length !== row.live_focus_transition_count) return reject();
  // ABSENT means every layer is absent; COMPLETE means every layer is whole.
  if (state === 'ABSENT' && (base.thread_semantic_capture_state !== 'ABSENT' || row.live_focus_batch_exists)) return reject();
  if (state === 'COMPLETE' && !(base.thread_semantic_capture_state === 'COMPLETE' && row.live_focus_batch_exists
    && row.live_focus_unit_count === base.committed_unit_count)) return reject();
  if (base.thread_semantic_capture_state === 'ABSENT' && row.live_focus_batch_exists && state !== 'PARTIAL') return reject();
  if (base.thread_semantic_capture_state !== 'ABSENT' && !row.live_focus_batch_exists && state !== 'PARTIAL') return reject();
  const sessionLiveFocus = mapLiveFocusValue(row.session_live_focus_kind, row.session_live_focus_ref, reject);
  if (row.session_live_focus_sp !== null && !isSp(row.session_live_focus_sp)) return reject();
  const sessionLiveFocusSp = row.session_live_focus_sp;
  // No LF before the first SP: a Session without a Live Head carries NONE and no transition.
  if (base.live_head === null && (sessionLiveFocus.kind !== 'NONE' || sessionLiveFocusSp !== null || transitions.length > 0)) return reject();
  if (sessionLiveFocusSp !== null && base.live_head !== null && sessionLiveFocusSp > base.live_head) return reject();
  for (const transition of transitions) {
    if (base.live_head !== null && transition.sessionPosition > base.live_head) return reject();
  }
  return {
    ...base,
    full_semantic_capture_state: state,
    live_focus_batch_exists: row.live_focus_batch_exists,
    live_focus_unit_count: row.live_focus_unit_count,
    live_focus_transition_count: row.live_focus_transition_count,
    live_focus_transitions: transitions,
    session_live_focus: sessionLiveFocus,
    session_live_focus_sp: sessionLiveFocusSp,
  };
}

const BASE_CONTEXT_KEYS = [
  'base_current_sp', 'base_same_sp_event_sequence', 'prior_cus', 'reference_handles', 'focus_candidates',
  'current_focus_candidate_id', 'prior_focus_semantics', 'focus_attention_history', 'established_thread_bindings',
  'world_thread_identity_version', 'session_focus_thread_bindings', 'session_thread_lifecycle_history',
] as const;
const CONTEXT_KEYS = [...BASE_CONTEXT_KEYS, 'current_live_focus_kind', 'current_live_focus_ref', 'current_live_focus_sp'] as const;

/** Strictly maps the authoritative FINAL runtime-context row. */
export function mapConversationSemanticRuntimeContext(
  row: unknown,
  request: { readonly sessionId: string; readonly userId: string },
): ConversationSemanticRuntimeContext {
  const invalid = (): never => { throw new ConversationSemanticIntegrityError('INVALID_SEMANTIC_RUNTIME_CONTEXT'); };
  if (!isRecord(row) || !hasExactKeys(row, CONTEXT_KEYS)) return invalid();
  // The T-03B3 mapper is the authority for the twelve fields it owns.
  const base = mapConversationThreadLifecycleRuntimeContext(Object.fromEntries(BASE_CONTEXT_KEYS.map((key) => [key, row[key]])), request);
  const currentLiveFocus = mapLiveFocusValue(row.current_live_focus_kind, row.current_live_focus_ref, invalid);
  if (row.current_live_focus_sp !== null && !isSp(row.current_live_focus_sp)) return invalid();
  const currentLiveFocusSp = row.current_live_focus_sp;
  const currentSp = base.token.currentSp;
  if (currentSp === null && (currentLiveFocus.kind !== 'NONE' || currentLiveFocusSp !== null)) return invalid();
  if (currentLiveFocusSp !== null && currentSp !== null && currentLiveFocusSp > currentSp) return invalid();
  if (currentLiveFocus.kind !== 'NONE' && currentLiveFocusSp === null) return invalid();
  // A THREAD LF must be a Thread bound in this Session; an EMERGING LF must be a known focus.
  if (currentLiveFocus.kind === 'THREAD' && !base.sessionFocusThreadBindings.some((binding) => binding.threadId === currentLiveFocus.threadId)) return invalid();
  if (currentLiveFocus.kind === 'EMERGING' && !base.priorContext.focusCandidates.some((candidate) => candidate.focusCandidateId === currentLiveFocus.emergingFocusId)) return invalid();
  return { ...base, currentLiveFocus, currentLiveFocusSp };
}

const RESULT_KEYS = ['live_head', 'same_sp_event_sequence', 'world_thread_identity_version', 'live_focus_kind', 'live_focus_ref', 'live_focus_sp',
  'user_units', 'assistant_units', 'user_event', 'assistant_event', 'live_focus_transitions'] as const;

/** Strictly maps the single coordinator row: the LF facts are validated; the T-03A2 delivery facts pass through to the existing verifier. */
export function mapFinalizedExchangeWithFullSemanticChainResult(row: unknown): FinalizedExchangeWithFullSemanticChainResult {
  const reject = (): never => { throw new ConversationSemanticIntegrityError('LIVE_FOCUS_DELIVERY_MISMATCH'); };
  if (!isRecord(row)) return reject();
  for (const key of RESULT_KEYS) if (!(key in row)) return reject();
  const liveFocus = mapLiveFocusValue(row.live_focus_kind, row.live_focus_ref, reject);
  if (row.live_focus_sp !== null && !isSp(row.live_focus_sp)) return reject();
  const transitions = mapStoredLiveFocusTransitions(row.live_focus_transitions, reject);
  if (row.live_head !== null && !isSp(row.live_head)) return reject();
  const liveHead = row.live_head as number | null;
  if (liveHead === null && (liveFocus.kind !== 'NONE' || row.live_focus_sp !== null || transitions.length > 0)) return reject();
  if (liveHead !== null && ((row.live_focus_sp !== null && (row.live_focus_sp as number) > liveHead) || transitions.some((t) => t.sessionPosition > liveHead))) return reject();
  const version = typeof row.world_thread_identity_version === 'string' && /^[0-9]{1,15}$/u.test(row.world_thread_identity_version)
    ? Number(row.world_thread_identity_version) : row.world_thread_identity_version;
  const sequence = typeof row.same_sp_event_sequence === 'string' && /^[0-9]{1,15}$/u.test(row.same_sp_event_sequence)
    ? Number(row.same_sp_event_sequence) : row.same_sp_event_sequence;
  if (!isOrdinal(version) || !isOrdinal(sequence)) return reject();
  return {
    live_head: liveHead,
    same_sp_event_sequence: sequence,
    world_thread_identity_version: version,
    user_units: row.user_units as FinalizedExchangeWithFullSemanticChainResult['user_units'],
    assistant_units: row.assistant_units as FinalizedExchangeWithFullSemanticChainResult['assistant_units'],
    user_event: row.user_event as FinalizedExchangeWithFullSemanticChainResult['user_event'],
    assistant_event: row.assistant_event as FinalizedExchangeWithFullSemanticChainResult['assistant_event'],
    live_focus: liveFocus,
    live_focus_sp: row.live_focus_sp as number | null,
    live_focus_transitions: transitions,
  };
}
