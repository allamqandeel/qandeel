import { ConversationThreadIntegrityError } from '../thread-establishment/conversation-thread-runtime.types';
import { ConversationThreadLifecycleIntegrityError } from '../thread-lifecycle/conversation-thread-lifecycle-runtime.types';
import {
  mapConversationSemanticRuntimeContext,
  mapFinalizedExchangeWithFullSemanticChainResult,
  mapIntegratedFullSemanticBatchSnapshot,
  mapLiveFocusValue,
  mapStoredLiveFocusTransitions,
} from './conversation-semantic-runtime-mapper';
import { ConversationSemanticIntegrityError } from './conversation-semantic-runtime.types';

const SESSION = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const FOCUS = '4ef8538d-ddda-5e11-b7d9-052be85de59a';
const THREAD = 'afc4fd81-fe54-5738-9545-e1053044d919';
const CU = '11111111-2222-4333-8444-555555555555';
const BINDING = '81db0320-39e5-5053-adc5-6d9c993f5ec7';

const ABSENT = {
  batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null,
  focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false,
  thread_capture_state: 'ABSENT', thread_batch_exists: false, thread_unit_count: 0, thread_establishment_count: 0,
  thread_semantic_capture_state: 'ABSENT', thread_semantic_batch_exists: false, thread_semantic_unit_count: 0, continuity_binding_count: 0, lifecycle_transition_count: 0,
  full_semantic_capture_state: 'ABSENT', live_focus_batch_exists: false, live_focus_unit_count: 0, live_focus_transition_count: 0,
  live_focus_transitions: [], session_live_focus_kind: 'NONE', session_live_focus_ref: null, session_live_focus_sp: null,
};
const unit = (sp: number) => ({
  id: CU, user_id: USER, session_id: SESSION, source_turn_id: '11111111-1111-4111-8111-111111111111', commit_batch_id: '22222222-2222-4222-8222-222222222222',
  source_role: 'USER', speaker_state: 'RESOLVED', source_modality: 'TEXT', ordinal_within_turn: 0, source_span_start: 0, source_span_end: 5,
  committed_text: 'xxxxx', source_content_sha256: 'deadbeef', session_position: sp, created_at: 'now',
});
const COMPLETE = {
  ...ABSENT, batch_exists: true, committed_unit_count: 1, units: [unit(3)],
  commit_event: { commit_batch_id: '22222222-2222-4222-8222-222222222222', user_id: USER, session_id: SESSION, source_turn_id: '11111111-1111-4111-8111-111111111111', first_sp: 3, last_sp: 3, unit_count: 1, created_at: 'now' },
  source_frontier: 5, live_head: 3,
  focus_batch_exists: true, focus_semantic_count: 1, focus_attention_count: 1, focus_complete: true,
  thread_capture_state: 'COMPLETE', thread_batch_exists: true, thread_unit_count: 1,
  thread_semantic_capture_state: 'COMPLETE', thread_semantic_batch_exists: true, thread_semantic_unit_count: 1,
  full_semantic_capture_state: 'COMPLETE', live_focus_batch_exists: true, live_focus_unit_count: 1, live_focus_transition_count: 1,
  live_focus_transitions: [{ session_position: 3, to_kind: 'EMERGING', to_ref: FOCUS }], session_live_focus_kind: 'EMERGING', session_live_focus_ref: FOCUS, session_live_focus_sp: 3,
};
const EMPTY_CONTEXT = {
  base_current_sp: null, base_same_sp_event_sequence: '0', prior_cus: [], reference_handles: [], focus_candidates: [],
  current_focus_candidate_id: null, prior_focus_semantics: [], focus_attention_history: [], established_thread_bindings: [],
  world_thread_identity_version: '0', session_focus_thread_bindings: [], session_thread_lifecycle_history: [],
  current_live_focus_kind: 'NONE', current_live_focus_ref: null, current_live_focus_sp: null,
};
const RESULT = {
  live_head: 2, same_sp_event_sequence: '2', world_thread_identity_version: '1', live_focus_kind: 'THREAD', live_focus_ref: THREAD, live_focus_sp: 2,
  user_units: [], assistant_units: [], user_event: null, assistant_event: null,
  live_focus_transitions: [{ session_position: 1, to_kind: 'EMERGING', to_ref: FOCUS }, { session_position: 2, to_kind: 'THREAD', to_ref: THREAD }],
};
const integrity = (run: () => unknown) => {
  try { run(); } catch (error) {
    expect(error).toBeInstanceOf(ConversationSemanticIntegrityError);
    return (error as ConversationSemanticIntegrityError).reason;
  }
  throw new Error('expected an integrity failure');
};
const reject = (): never => { throw new ConversationSemanticIntegrityError('INVALID_INTEGRATED_SNAPSHOT'); };

describe('the strict LF value and transition mappers (cases 33-35)', () => {
  it('33. exactly the closed domain: NONE without a reference, EMERGING / THREAD with a UUID reference', () => {
    expect(mapLiveFocusValue('NONE', null, reject)).toEqual({ kind: 'NONE' });
    expect(mapLiveFocusValue('EMERGING', FOCUS, reject)).toEqual({ kind: 'EMERGING', emergingFocusId: FOCUS });
    expect(mapLiveFocusValue('THREAD', THREAD, reject)).toEqual({ kind: 'THREAD', threadId: THREAD });
    for (const [kind, ref] of [['NONE', FOCUS], ['EMERGING', null], ['THREAD', 'thread-1'], ['READING', FOCUS], ['EMERGING_FOCUS', FOCUS], [null, null], [1, null]] as const) {
      expect(integrity(() => mapLiveFocusValue(kind, ref, reject))).toBe('INVALID_INTEGRATED_SNAPSHOT');
    }
  });

  it('34. transitions map with exact keys and strictly ascending SP; an out-of-order or malformed list is rejected, never re-sorted', () => {
    expect(mapStoredLiveFocusTransitions([{ session_position: 1, to_kind: 'NONE', to_ref: null }, { session_position: 4, to_kind: 'THREAD', to_ref: THREAD }], reject))
      .toEqual([{ sessionPosition: 1, to: { kind: 'NONE' } }, { sessionPosition: 4, to: { kind: 'THREAD', threadId: THREAD } }]);
    for (const bad of [
      [{ session_position: 4, to_kind: 'NONE', to_ref: null }, { session_position: 1, to_kind: 'NONE', to_ref: null }],
      [{ session_position: 2, to_kind: 'NONE', to_ref: null }, { session_position: 2, to_kind: 'THREAD', to_ref: THREAD }],
      [{ session_position: 0, to_kind: 'NONE', to_ref: null }],
      [{ session_position: 1, to_kind: 'NONE', to_ref: null, same_sp_event_sequence: 2 }],
      [{ session_position: 1, to_kind: 'NONE', to_ref: null, label: 'Ahmed' }],
      'not-an-array',
    ]) {
      expect(integrity(() => mapStoredLiveFocusTransitions(bad, reject))).toBe('INVALID_INTEGRATED_SNAPSHOT');
    }
  });

  it('35. the T-03B3 / T-03B2 mappers stay the authority for the base halves: their failures keep their own class', () => {
    expect(() => mapIntegratedFullSemanticBatchSnapshot({ ...ABSENT, batch_exists: 'yes' })).toThrow(ConversationThreadIntegrityError);
    expect(() => mapIntegratedFullSemanticBatchSnapshot({ ...ABSENT, thread_semantic_batch_exists: 'yes' })).toThrow(ConversationThreadLifecycleIntegrityError);
    expect(() => mapConversationSemanticRuntimeContext({ ...EMPTY_CONTEXT, prior_cus: 'x' }, { sessionId: SESSION, userId: USER })).toThrow(ConversationThreadIntegrityError);
    expect(() => mapConversationSemanticRuntimeContext({ ...EMPTY_CONTEXT, session_thread_lifecycle_history: 'x' }, { sessionId: SESSION, userId: USER })).toThrow(ConversationThreadLifecycleIntegrityError);
  });
});

describe('the integrated FINAL snapshot mapper (cases 36-39)', () => {
  it('36. accepts an absent snapshot, a complete non-zero snapshot and a complete ZERO-CU snapshot', () => {
    expect(mapIntegratedFullSemanticBatchSnapshot(ABSENT).full_semantic_capture_state).toBe('ABSENT');
    const complete = mapIntegratedFullSemanticBatchSnapshot(COMPLETE);
    expect(complete.full_semantic_capture_state).toBe('COMPLETE');
    expect(complete.live_focus_transitions).toEqual([{ sessionPosition: 3, to: { kind: 'EMERGING', emergingFocusId: FOCUS } }]);
    expect(complete.session_live_focus).toEqual({ kind: 'EMERGING', emergingFocusId: FOCUS });
    expect(complete.session_live_focus_sp).toBe(3);
    const zero = mapIntegratedFullSemanticBatchSnapshot({ ...COMPLETE, committed_unit_count: 0, units: [], commit_event: null, focus_semantic_count: 0, focus_attention_count: 0,
      thread_unit_count: 0, thread_semantic_unit_count: 0, live_focus_unit_count: 0, live_focus_transition_count: 0, live_focus_transitions: [] });
    expect([zero.full_semantic_capture_state, zero.live_focus_transitions]).toEqual(['COMPLETE', []]);
  });

  it('37. rejects every claimed state the counts in the same row do not support; PARTIAL is accepted as given, never upgraded', () => {
    for (const bad of [
      { full_semantic_capture_state: 'COMPLETE', live_focus_batch_exists: false, live_focus_unit_count: 0, live_focus_transition_count: 0, live_focus_transitions: [] },
      { full_semantic_capture_state: 'COMPLETE', live_focus_unit_count: 0 },
      { full_semantic_capture_state: 'ABSENT' },
      { full_semantic_capture_state: 'COMPLETE', thread_semantic_capture_state: 'PARTIAL' },
      { live_focus_transition_count: 2 },
      { live_focus_transition_count: 0 },
      { live_focus_batch_exists: false },
      { full_semantic_capture_state: 'FINAL' },
    ]) {
      expect(integrity(() => mapIntegratedFullSemanticBatchSnapshot({ ...COMPLETE, ...bad }))).toBe('INVALID_INTEGRATED_SNAPSHOT');
    }
    expect(integrity(() => mapIntegratedFullSemanticBatchSnapshot({ ...ABSENT, live_focus_batch_exists: true, full_semantic_capture_state: 'ABSENT' }))).toBe('INVALID_INTEGRATED_SNAPSHOT');
    const partial = mapIntegratedFullSemanticBatchSnapshot({ ...COMPLETE, full_semantic_capture_state: 'PARTIAL', live_focus_batch_exists: false, live_focus_unit_count: 0, live_focus_transition_count: 0, live_focus_transitions: [] });
    expect(partial.full_semantic_capture_state).toBe('PARTIAL');
  });

  it('38. no LF before the first SP, and nothing beyond the Live Head', () => {
    expect(integrity(() => mapIntegratedFullSemanticBatchSnapshot({ ...ABSENT, session_live_focus_kind: 'EMERGING', session_live_focus_ref: FOCUS, session_live_focus_sp: 1 }))).toBe('INVALID_INTEGRATED_SNAPSHOT');
    expect(integrity(() => mapIntegratedFullSemanticBatchSnapshot({ ...ABSENT, session_live_focus_sp: 1 }))).toBe('INVALID_INTEGRATED_SNAPSHOT');
    expect(integrity(() => mapIntegratedFullSemanticBatchSnapshot({ ...COMPLETE, session_live_focus_sp: 9 }))).toBe('INVALID_INTEGRATED_SNAPSHOT');
    expect(integrity(() => mapIntegratedFullSemanticBatchSnapshot({ ...COMPLETE, live_focus_transitions: [{ session_position: 9, to_kind: 'EMERGING', to_ref: FOCUS }] }))).toBe('INVALID_INTEGRATED_SNAPSHOT');
  });

  it('39. a missing LF key, a label or a sequence in the row fails closed', () => {
    const { session_live_focus_sp: _sp, ...missing } = COMPLETE;
    expect(integrity(() => mapIntegratedFullSemanticBatchSnapshot(missing))).toBe('INVALID_INTEGRATED_SNAPSHOT');
    expect(integrity(() => mapIntegratedFullSemanticBatchSnapshot({ ...COMPLETE, session_live_focus_kind: 'THREAD', session_live_focus_ref: FOCUS, session_live_focus_label: 'Ahmed' } as never))).toBe('INVALID_INTEGRATED_SNAPSHOT');
  });
});

describe('the FINAL runtime context mapper (cases 40-42)', () => {
  const request = { sessionId: SESSION, userId: USER };
  const cu = { cu_id: CU, source_turn_id: '11111111-1111-4111-8111-111111111111', source_role: 'USER', committed_text: 'أحمد', ordinal_within_turn: 0, session_position: 1, functions: ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null };
  const bundle = { unit_id: CU, functions: ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null,
    references: [{ reference_index: 0, anchor_text: 'أحمد', anchor_occurrence: 1, span_start: 0, span_end: 4, state: 'RESOLVED', resolved_handle_id: '095fa725-c218-5130-aead-f5f1472fab74', creates_handle: true, candidate_handle_ids: [] }],
    claim_attributions: [], attention: { kind: 'START_NEW_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: FOCUS, creates_focus: true, grounding_reference_index: 0 } };
  const WITH_FOCUS = {
    ...EMPTY_CONTEXT, base_current_sp: 1, base_same_sp_event_sequence: '1', prior_cus: [cu],
    reference_handles: [{ handle_id: '095fa725-c218-5130-aead-f5f1472fab74', grounding: [{ cu_id: CU, exact_surface: 'أحمد' }] }],
    focus_candidates: [{ focus_candidate_id: FOCUS, grounding_handle_ids: ['095fa725-c218-5130-aead-f5f1472fab74'], prior_grounding_cu_ids: [CU] }],
    current_focus_candidate_id: FOCUS, prior_focus_semantics: [bundle],
    focus_attention_history: [{ cu_id: CU, attention_kind: 'START_NEW_FOCUS', attention_reason: 'DIRECT_SUBJECT', emerging_focus_id: FOCUS }],
    current_live_focus_kind: 'EMERGING', current_live_focus_ref: FOCUS, current_live_focus_sp: 1,
  };

  it('40. maps the current LF beside the T-03B3 context', () => {
    const empty = mapConversationSemanticRuntimeContext(EMPTY_CONTEXT, request);
    expect([empty.currentLiveFocus, empty.currentLiveFocusSp, empty.worldThreadIdentityVersion]).toEqual([{ kind: 'NONE' }, null, 0]);
    const focused = mapConversationSemanticRuntimeContext(WITH_FOCUS, request);
    expect([focused.currentLiveFocus, focused.currentLiveFocusSp]).toEqual([{ kind: 'EMERGING', emergingFocusId: FOCUS }, 1]);
    const bound = mapConversationSemanticRuntimeContext({ ...WITH_FOCUS, world_thread_identity_version: '1', established_thread_bindings: [{ thread_id: THREAD, emerging_focus_id: FOCUS, established_cu_id: CU, established_sp: 1 }],
      session_focus_thread_bindings: [{ binding_id: BINDING, thread_id: THREAD, emerging_focus_id: FOCUS, bound_cu_id: CU, bound_sp: 1, binding_kind: 'ESTABLISHMENT' }],
      current_live_focus_kind: 'THREAD', current_live_focus_ref: THREAD }, request);
    expect(bound.currentLiveFocus).toEqual({ kind: 'THREAD', threadId: THREAD });
  });

  it('41. no LF before the first SP, never beyond the token, never a Thread not bound here nor an unknown focus', () => {
    const invalid = (row: Record<string, unknown>) => integrity(() => mapConversationSemanticRuntimeContext(row, request));
    expect(invalid({ ...EMPTY_CONTEXT, current_live_focus_kind: 'EMERGING', current_live_focus_ref: FOCUS, current_live_focus_sp: 1 })).toBe('INVALID_SEMANTIC_RUNTIME_CONTEXT');
    expect(invalid({ ...WITH_FOCUS, current_live_focus_sp: 2 })).toBe('INVALID_SEMANTIC_RUNTIME_CONTEXT');
    expect(invalid({ ...WITH_FOCUS, current_live_focus_sp: null })).toBe('INVALID_SEMANTIC_RUNTIME_CONTEXT');
    expect(invalid({ ...WITH_FOCUS, current_live_focus_kind: 'THREAD', current_live_focus_ref: THREAD })).toBe('INVALID_SEMANTIC_RUNTIME_CONTEXT');
    expect(invalid({ ...WITH_FOCUS, current_live_focus_ref: '99999999-9999-4999-8999-999999999999' })).toBe('INVALID_SEMANTIC_RUNTIME_CONTEXT');
    expect(invalid({ ...WITH_FOCUS, current_live_focus_kind: 'ESTABLISHED_THREAD', current_live_focus_ref: THREAD })).toBe('INVALID_SEMANTIC_RUNTIME_CONTEXT');
  });

  it('42. exact keys: an extra or missing LF key is rejected, never filtered', () => {
    const { current_live_focus_sp: _sp, ...missing } = EMPTY_CONTEXT;
    expect(integrity(() => mapConversationSemanticRuntimeContext(missing, request))).toBe('INVALID_SEMANTIC_RUNTIME_CONTEXT');
    expect(integrity(() => mapConversationSemanticRuntimeContext({ ...EMPTY_CONTEXT, current_live_focus_label: 'x' }, request))).toBe('INVALID_SEMANTIC_RUNTIME_CONTEXT');
  });
});

describe('the coordinator result mapper (cases 43-44)', () => {
  it('43. maps the LF delivery facts of the ONE coordinator row', () => {
    const result = mapFinalizedExchangeWithFullSemanticChainResult(RESULT);
    expect([result.live_head, result.same_sp_event_sequence, result.world_thread_identity_version]).toEqual([2, 2, 1]);
    expect(result.live_focus).toEqual({ kind: 'THREAD', threadId: THREAD });
    expect(result.live_focus_transitions.map((t) => [t.sessionPosition, t.to.kind])).toEqual([[1, 'EMERGING'], [2, 'THREAD']]);
    const zero = mapFinalizedExchangeWithFullSemanticChainResult({ ...RESULT, live_head: null, same_sp_event_sequence: '0', live_focus_kind: 'NONE', live_focus_ref: null, live_focus_sp: null, live_focus_transitions: [] });
    expect([zero.live_head, zero.live_focus, zero.live_focus_transitions]).toEqual([null, { kind: 'NONE' }, []]);
  });

  it('44. an incoherent coordinator row never becomes delivery', () => {
    for (const bad of [
      { live_head: null },
      { live_focus_sp: 9 },
      { live_focus_transitions: [{ session_position: 9, to_kind: 'NONE', to_ref: null }] },
      { live_focus_kind: 'THREAD', live_focus_ref: null },
      { live_focus_transitions: [{ session_position: 2, to_kind: 'THREAD', to_ref: THREAD, same_sp_event_sequence: 3 }] },
      { same_sp_event_sequence: '-1' },
    ]) {
      expect(integrity(() => mapFinalizedExchangeWithFullSemanticChainResult({ ...RESULT, ...bad }))).toBe('LIVE_FOCUS_DELIVERY_MISMATCH');
    }
    expect(integrity(() => mapFinalizedExchangeWithFullSemanticChainResult(undefined))).toBe('LIVE_FOCUS_DELIVERY_MISMATCH');
  });
});
