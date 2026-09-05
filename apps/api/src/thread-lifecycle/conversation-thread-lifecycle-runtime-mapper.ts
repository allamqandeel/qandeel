// T-03B3 - the strict B3 runtime mappers.
//
// PostgREST JSON is never cast blindly. The T-03B2b3 mappers remain the
// authority for the commitment / B1 / B2 halves of both reads (they are
// REUSED on the exact projection they own, never restated); this module adds
// the strict validation of the B3 additions:
//
//   context   the user/world identity version, every Session focus -> Thread
//             binding (closed over canonical prior focus truth, unique focus,
//             unique Thread per Session, derived binding identity, the
//             ESTABLISHMENT bindings exactly the 0069 establishment truth),
//             and the Session-local lifecycle history (legal state machine
//             from a derived ACTIVE baseline, strictly increasing SP per
//             Thread, contiguous ordinals per CU in canonical Thread order,
//             derived event identity, no future SP)
//   snapshot  the FINAL Thread-layer capture state, re-derived from the same
//             row's counts wherever it can be (PARTIAL is accepted as given)
//   dossiers  unique Threads in exact textual order, source-grounded items only
//
// An invalid row is REJECTED, never filtered or cleaned.

import { mapConversationThreadRuntimeContext, mapIntegratedFocusThreadBatchSnapshot } from '../thread-establishment/conversation-thread-runtime-mapper';
import { THREAD_CAPTURE_STATES, type ThreadCaptureState } from '../thread-establishment/conversation-thread-runtime.types';
import { durableThreadFocusBindingId, durableThreadLifecycleEventId } from './durable-thread-lifecycle-canonicalizer';
import {
  ConversationThreadLifecycleIntegrityError,
  type ConversationThreadLifecycleRuntimeContext,
  type IntegratedThreadLifecycleBatchSnapshot,
  type ThreadIdentityDossierPage,
  type ThreadIdentityDossierPageRequest,
} from './conversation-thread-lifecycle-runtime.types';
import { compareThreadIdText, type ThreadIdentityDossier, type ThreadIdentityEvidenceItem } from './thread-continuity.types';
import {
  isLegalThreadLifecycleTransition,
  THREAD_FOCUS_BINDING_KINDS,
  THREAD_LIFECYCLE_REASONS_BY_STATE,
  THREAD_LIFECYCLE_STATES,
  type SessionThreadFocusBinding,
  type SessionThreadLifecycleEvent,
  type ThreadFocusBindingKind,
  type ThreadLifecycleReasonCode,
  type ThreadLifecycleState,
} from './thread-lifecycle.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isSp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isOrdinal = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isMember = <T extends string>(vocabulary: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (vocabulary as readonly string[]).includes(value);
const invalid = (): never => { throw new ConversationThreadLifecycleIntegrityError('INVALID_THREAD_LIFECYCLE_CONTEXT'); };
const unclosed = (): never => { throw new ConversationThreadLifecycleIntegrityError('LIFECYCLE_CONTEXT_NOT_CLOSED'); };
const chain = (): never => { throw new ConversationThreadLifecycleIntegrityError('INVALID_LIFECYCLE_CHAIN'); };

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const present = Object.keys(record);
  return present.length === keys.length && keys.every((key) => key in record);
}

/** A version or sequence arrives from PostgREST as a JSON number or, for bigint, a string. */
function versionOf(value: unknown): number {
  const numeric = typeof value === 'string' && /^[0-9]{1,15}$/u.test(value) ? Number(value) : value;
  if (typeof numeric !== 'number' || !Number.isSafeInteger(numeric) || numeric < 0) return invalid();
  return numeric;
}

const BASE_CONTEXT_KEYS = [
  'base_current_sp', 'base_same_sp_event_sequence', 'prior_cus', 'reference_handles', 'focus_candidates',
  'current_focus_candidate_id', 'prior_focus_semantics', 'focus_attention_history', 'established_thread_bindings',
] as const;
const CONTEXT_KEYS = [...BASE_CONTEXT_KEYS, 'world_thread_identity_version', 'session_focus_thread_bindings', 'session_thread_lifecycle_history'] as const;

/** Strictly maps the authoritative B3 runtime-context row. */
export function mapConversationThreadLifecycleRuntimeContext(
  row: unknown,
  request: { readonly sessionId: string; readonly userId: string },
): ConversationThreadLifecycleRuntimeContext {
  if (!isRecord(row) || !hasExactKeys(row, CONTEXT_KEYS)) return invalid();
  // The T-03B2b3 mapper is the authority for the nine fields it owns.
  const base = mapConversationThreadRuntimeContext(Object.fromEntries(BASE_CONTEXT_KEYS.map((key) => [key, row[key]])), request);
  const worldThreadIdentityVersion = versionOf(row.world_thread_identity_version);
  if (!Array.isArray(row.session_focus_thread_bindings) || !Array.isArray(row.session_thread_lifecycle_history)) return invalid();

  const priorCuIds = new Set(base.priorContext.priorCus.map((cu) => cu.cuId));
  const focusIds = new Set(base.priorContext.focusCandidates.map((candidate) => candidate.focusCandidateId));
  const attentionByCuId = new Map(base.focusAttentionHistory.map((entry) => [entry.cuId, entry]));
  const currentSp = base.token.currentSp;

  // Bindings: unique focus, unique Thread, bound CU in prior history with a
  // focus-bearing attention on exactly the bound focus, derived identity.
  const bindings: SessionThreadFocusBinding[] = [];
  const boundFocusIds = new Set<string>();
  const boundThreadIds = new Set<string>();
  const bindingByThread = new Map<string, SessionThreadFocusBinding>();
  let lastBoundSp = 0;
  for (const entry of row.session_focus_thread_bindings) {
    if (!isRecord(entry) || !hasExactKeys(entry, ['binding_id', 'thread_id', 'emerging_focus_id', 'bound_cu_id', 'bound_sp', 'binding_kind'])) return invalid();
    if (!isUuid(entry.binding_id) || !isUuid(entry.thread_id) || !isUuid(entry.emerging_focus_id) || !isUuid(entry.bound_cu_id) || !isSp(entry.bound_sp)) return invalid();
    if (!isMember(THREAD_FOCUS_BINDING_KINDS, entry.binding_kind)) return invalid();
    const bindingKind: ThreadFocusBindingKind = entry.binding_kind;
    if (boundFocusIds.has(entry.emerging_focus_id) || boundThreadIds.has(entry.thread_id)) return invalid();
    if (currentSp === null || entry.bound_sp > currentSp) return invalid();
    if (entry.bound_sp < lastBoundSp) return invalid();
    if (!priorCuIds.has(entry.bound_cu_id) || !focusIds.has(entry.emerging_focus_id)) return unclosed();
    const attention = attentionByCuId.get(entry.bound_cu_id);
    if (attention === undefined || attention.attentionKind === 'NO_INDEPENDENT_FOCUS' || attention.emergingFocusId !== entry.emerging_focus_id) return unclosed();
    if (entry.binding_id !== durableThreadFocusBindingId(request.sessionId, entry.emerging_focus_id, entry.thread_id)) return invalid();
    lastBoundSp = entry.bound_sp;
    boundFocusIds.add(entry.emerging_focus_id);
    boundThreadIds.add(entry.thread_id);
    const binding: SessionThreadFocusBinding = {
      bindingId: entry.binding_id,
      threadId: entry.thread_id,
      emergingFocusId: entry.emerging_focus_id,
      boundCuId: entry.bound_cu_id,
      boundSp: entry.bound_sp,
      bindingKind,
    };
    bindings.push(binding);
    bindingByThread.set(binding.threadId, binding);
  }
  // The ESTABLISHMENT bindings are exactly the 0069 establishment truth of this Session.
  const establishment = bindings.filter((binding) => binding.bindingKind === 'ESTABLISHMENT');
  if (establishment.length !== base.establishedThreadBindings.length) return unclosed();
  for (const established of base.establishedThreadBindings) {
    const binding = bindingByThread.get(established.threadId);
    if (binding === undefined || binding.bindingKind !== 'ESTABLISHMENT' || binding.emergingFocusId !== established.emergingFocusId
      || binding.boundCuId !== established.establishedCuId || binding.boundSp !== established.establishedSp) return unclosed();
  }

  // Lifecycle history: (SP, ordinal) order, contiguous ordinals per CU in
  // canonical Thread order, bound Thread, legal transition from the derived
  // then-valid state, derived event identity, no future SP.
  const history: SessionThreadLifecycleEvent[] = [];
  const stateByThread = new Map<string, ThreadLifecycleState>();
  let lastSp = 0;
  let lastOrdinal = -1;
  let lastThread: string | null = null;
  const seenEventIds = new Set<string>();
  const cuByThreadSp = new Set<string>();
  for (const entry of row.session_thread_lifecycle_history) {
    if (!isRecord(entry) || !hasExactKeys(entry, ['event_id', 'thread_id', 'cu_id', 'session_position', 'transition_ordinal', 'from_state', 'to_state', 'reason_code'])) return invalid();
    if (!isUuid(entry.event_id) || !isUuid(entry.thread_id) || !isUuid(entry.cu_id) || !isSp(entry.session_position) || !isOrdinal(entry.transition_ordinal)) return invalid();
    if (!isMember(THREAD_LIFECYCLE_STATES, entry.from_state) || !isMember(THREAD_LIFECYCLE_STATES, entry.to_state)) return invalid();
    const fromState: ThreadLifecycleState = entry.from_state;
    const toState: ThreadLifecycleState = entry.to_state;
    if (!isMember(THREAD_LIFECYCLE_REASONS_BY_STATE[toState], entry.reason_code)) return invalid();
    const reasonCode: ThreadLifecycleReasonCode = entry.reason_code;
    if (seenEventIds.has(entry.event_id)) return invalid();
    if (currentSp === null || entry.session_position > currentSp) return invalid();
    if (!priorCuIds.has(entry.cu_id)) return unclosed();
    const binding = bindingByThread.get(entry.thread_id);
    if (binding === undefined) return unclosed();
    if (entry.session_position <= binding.boundSp) return chain();
    if (entry.session_position < lastSp) return invalid();
    if (entry.session_position === lastSp) {
      if (entry.transition_ordinal !== lastOrdinal + 1 || lastThread === null || compareThreadIdText(entry.thread_id, lastThread) <= 0) return invalid();
    } else if (entry.transition_ordinal !== 0) {
      return invalid();
    }
    const key = `${entry.thread_id}:${entry.session_position}`;
    if (cuByThreadSp.has(key)) return chain();
    const current = stateByThread.get(entry.thread_id) ?? 'ACTIVE';
    if (current !== fromState || !isLegalThreadLifecycleTransition(fromState, toState)) return chain();
    if (entry.event_id !== durableThreadLifecycleEventId(request.sessionId, entry.cu_id, entry.thread_id, toState)) return invalid();
    seenEventIds.add(entry.event_id);
    cuByThreadSp.add(key);
    stateByThread.set(entry.thread_id, toState);
    lastSp = entry.session_position;
    lastOrdinal = entry.transition_ordinal;
    lastThread = entry.thread_id;
    history.push({
      eventId: entry.event_id,
      threadId: entry.thread_id,
      cuId: entry.cu_id,
      sessionPosition: entry.session_position,
      transitionOrdinal: entry.transition_ordinal,
      fromState,
      toState,
      reasonCode,
    });
  }

  return {
    ...base,
    worldThreadIdentityVersion,
    sessionFocusThreadBindings: bindings,
    sessionThreadLifecycleHistory: history,
  };
}

/** The then-valid Session state of every bound Thread, derived from the mapped context (baseline ACTIVE, then history). */
export function sessionThreadStates(context: ConversationThreadLifecycleRuntimeContext): Map<string, ThreadLifecycleState> {
  const states = new Map<string, ThreadLifecycleState>();
  for (const binding of context.sessionFocusThreadBindings) states.set(binding.threadId, 'ACTIVE');
  for (const event of context.sessionThreadLifecycleHistory) states.set(event.threadId, event.toState);
  return states;
}

const BASE_SNAPSHOT_KEYS = [
  'batch_exists', 'committed_unit_count', 'units', 'commit_event', 'source_frontier', 'live_head',
  'focus_batch_exists', 'focus_semantic_count', 'focus_attention_count', 'focus_complete',
  'thread_capture_state', 'thread_batch_exists', 'thread_unit_count', 'thread_establishment_count',
] as const;
const SNAPSHOT_KEYS = [...BASE_SNAPSHOT_KEYS, 'thread_semantic_capture_state', 'thread_semantic_batch_exists',
  'thread_semantic_unit_count', 'continuity_binding_count', 'lifecycle_transition_count'] as const;

/**
 * Strictly validates the integrated batch snapshot row. The FINAL capture
 * state decides replay, so every claim provable from the same row is
 * re-derived; PARTIAL is accepted as given and never upgraded.
 */
export function mapIntegratedThreadLifecycleBatchSnapshot(row: unknown): IntegratedThreadLifecycleBatchSnapshot {
  const reject = (): never => { throw new ConversationThreadLifecycleIntegrityError('INVALID_INTEGRATED_SNAPSHOT'); };
  if (!isRecord(row)) return reject();
  for (const key of SNAPSHOT_KEYS) if (!(key in row)) return reject();
  const base = mapIntegratedFocusThreadBatchSnapshot(Object.fromEntries(BASE_SNAPSHOT_KEYS.map((key) => [key, row[key]])));
  if (!isMember(THREAD_CAPTURE_STATES, row.thread_semantic_capture_state)) return reject();
  const state: ThreadCaptureState = row.thread_semantic_capture_state;
  if (typeof row.thread_semantic_batch_exists !== 'boolean') return reject();
  if (!isOrdinal(row.thread_semantic_unit_count) || !isOrdinal(row.continuity_binding_count) || !isOrdinal(row.lifecycle_transition_count)) return reject();
  if (!row.thread_semantic_batch_exists && (row.thread_semantic_unit_count !== 0 || row.continuity_binding_count !== 0 || row.lifecycle_transition_count !== 0)) return reject();
  if (row.continuity_binding_count > row.thread_semantic_unit_count) return reject();
  // ABSENT means every layer is absent; COMPLETE means every layer is whole.
  if (state === 'ABSENT' && (base.thread_capture_state !== 'ABSENT' || row.thread_semantic_batch_exists)) return reject();
  if (state === 'COMPLETE' && !(base.thread_capture_state === 'COMPLETE' && row.thread_semantic_batch_exists
    && row.thread_semantic_unit_count === base.committed_unit_count)) return reject();
  if (base.thread_capture_state === 'ABSENT' && row.thread_semantic_batch_exists && state !== 'PARTIAL') return reject();
  return {
    ...base,
    thread_semantic_capture_state: state,
    thread_semantic_batch_exists: row.thread_semantic_batch_exists,
    thread_semantic_unit_count: row.thread_semantic_unit_count,
    continuity_binding_count: row.continuity_binding_count,
    lifecycle_transition_count: row.lifecycle_transition_count,
  };
}

/**
 * Strictly maps ONE dossier page: unique Threads in exact textual order
 * strictly after the cursor, at most `limit` of them, every item
 * source-grounded. No Home, lifecycle or timestamp field is representable.
 */
export function mapThreadIdentityDossierPage(rows: unknown, request: ThreadIdentityDossierPageRequest): ThreadIdentityDossierPage {
  const reject = (): never => { throw new ConversationThreadLifecycleIntegrityError('INVALID_THREAD_IDENTITY_DOSSIER'); };
  if (!Array.isArray(rows) || rows.length > request.limit) return reject();
  const dossiers: ThreadIdentityDossier[] = [];
  let last: string | null = request.afterThreadId;
  for (const row of rows) {
    if (!isRecord(row) || !hasExactKeys(row, ['thread_id', 'identity_evidence']) || !isUuid(row.thread_id)) return reject();
    if (last !== null && compareThreadIdText(row.thread_id, last) <= 0) return reject();
    if (!Array.isArray(row.identity_evidence) || row.identity_evidence.length === 0) return reject();
    const identityEvidence: ThreadIdentityEvidenceItem[] = row.identity_evidence.map((item) => {
      if (!isRecord(item) || !hasExactKeys(item, ['session_id', 'cu_id', 'exact_surface', 'committed_cu_text', 'source_role'])) return reject();
      if (!isUuid(item.session_id) || !isUuid(item.cu_id)) return reject();
      if (typeof item.exact_surface !== 'string' || item.exact_surface.length === 0 || typeof item.committed_cu_text !== 'string' || item.committed_cu_text.length === 0) return reject();
      if (!item.committed_cu_text.includes(item.exact_surface)) return reject();
      if (item.source_role !== 'USER' && item.source_role !== 'ASSISTANT') return reject();
      return { sessionId: item.session_id, cuId: item.cu_id, exactSurface: item.exact_surface, committedCuText: item.committed_cu_text, sourceRole: item.source_role };
    });
    last = row.thread_id;
    dossiers.push({ threadId: row.thread_id, identityEvidence });
  }
  return dossiers;
}
