import { ConversationThreadIntegrityError } from '../thread-establishment/conversation-thread-runtime.types';
import {
  mapConversationThreadLifecycleRuntimeContext,
  mapIntegratedThreadLifecycleBatchSnapshot,
  mapThreadIdentityDossierPage,
  sessionThreadStates,
} from './conversation-thread-lifecycle-runtime-mapper';
import { ConversationThreadLifecycleIntegrityError } from './conversation-thread-lifecycle-runtime.types';
import { durableThreadFocusBindingId, durableThreadLifecycleEventId } from './durable-thread-lifecycle-canonicalizer';

const SESSION = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const TURN = '11111111-1111-4111-8111-111111111111';
const CU1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const CU2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const CU3 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const HANDLE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const FOCUS = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const FOCUS2 = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
const THREAD = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const THREAD2 = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
const request = { sessionId: SESSION, userId: USER };

const priorCu = (id: string, sp: number, ordinal: number) => ({
  cu_id: id, source_turn_id: TURN, source_role: 'USER', committed_text: `text ${sp}`, ordinal_within_turn: ordinal, session_position: sp,
  functions: ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null,
});
const bundleOf = (id: string, attention: Record<string, unknown>, references: unknown[] = []) => ({
  unit_id: id, functions: ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null, references, claim_attributions: [], attention,
});
const START = { kind: 'START_NEW_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: FOCUS, creates_focus: true, grounding_reference_index: 0 };
const ATTEND = { kind: 'ATTEND_EXISTING_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: FOCUS, creates_focus: false, grounding_reference_index: null };
const NONE = { kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null };
const reference = { reference_index: 0, anchor_text: 'text', anchor_occurrence: 1, span_start: 0, span_end: 4, state: 'RESOLVED', resolved_handle_id: HANDLE, creates_handle: true, candidate_handle_ids: [] };
const attentionRow = (id: string, attention: Record<string, unknown>) => ({ cu_id: id, attention_kind: attention.kind, attention_reason: attention.reason, emerging_focus_id: attention.emerging_focus_id });
const binding = (overrides: Record<string, unknown> = {}) => ({
  binding_id: durableThreadFocusBindingId(SESSION, FOCUS, THREAD), thread_id: THREAD, emerging_focus_id: FOCUS, bound_cu_id: CU1, bound_sp: 1, binding_kind: 'ESTABLISHMENT', ...overrides,
});
const event = (cu: string, sp: number, from: string, to: string, reason: string, ordinal = 0, thread = THREAD) => ({
  event_id: durableThreadLifecycleEventId(SESSION, cu, thread, to), thread_id: thread, cu_id: cu, session_position: sp, transition_ordinal: ordinal, from_state: from, to_state: to, reason_code: reason,
});

/** Three prior CUs: CU1 starts and (in this fixture) establishes the focus, CU2 attends it, CU3 has no focus. */
const row = (overrides: Record<string, unknown> = {}) => ({
  base_current_sp: 3, base_same_sp_event_sequence: '1',
  prior_cus: [priorCu(CU1, 1, 0), priorCu(CU2, 2, 1), priorCu(CU3, 3, 2)],
  reference_handles: [{ handle_id: HANDLE, grounding: [{ cu_id: CU1, exact_surface: 'text' }] }],
  focus_candidates: [{ focus_candidate_id: FOCUS, grounding_handle_ids: [HANDLE], prior_grounding_cu_ids: [CU1, CU2] }],
  current_focus_candidate_id: FOCUS,
  prior_focus_semantics: [bundleOf(CU1, START, [reference]), bundleOf(CU2, ATTEND), bundleOf(CU3, NONE)],
  focus_attention_history: [attentionRow(CU1, START), attentionRow(CU2, ATTEND), attentionRow(CU3, NONE)],
  established_thread_bindings: [{ thread_id: THREAD, emerging_focus_id: FOCUS, established_cu_id: CU1, established_sp: 1 }],
  world_thread_identity_version: '4',
  session_focus_thread_bindings: [binding()],
  session_thread_lifecycle_history: [],
  ...overrides,
});
const invalidContext = (overrides: Record<string, unknown>, reason: string) => {
  try {
    mapConversationThreadLifecycleRuntimeContext(row(overrides), request);
  } catch (error) {
    expect(error instanceof ConversationThreadLifecycleIntegrityError || error instanceof ConversationThreadIntegrityError).toBe(true);
    expect((error as ConversationThreadLifecycleIntegrityError).reason).toBe(reason);
    return;
  }
  throw new Error('expected the context to be rejected');
};

describe('the strict B3 runtime context mapper (cases 49-58)', () => {
  it('49. a coherent row maps to the B2b3 context plus the version, bindings and history; states derive from the binding baseline', () => {
    const context = mapConversationThreadLifecycleRuntimeContext(row({
      session_thread_lifecycle_history: [event(CU3, 3, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE')],
    }), request);
    expect(context.worldThreadIdentityVersion).toBe(4);
    expect(context.token).toEqual({ currentSp: 3, sameSpEventSequence: 1 });
    expect(context.sessionFocusThreadBindings).toEqual([{ bindingId: durableThreadFocusBindingId(SESSION, FOCUS, THREAD), threadId: THREAD, emergingFocusId: FOCUS, boundCuId: CU1, boundSp: 1, bindingKind: 'ESTABLISHMENT' }]);
    expect(context.sessionThreadLifecycleHistory).toEqual([{ eventId: durableThreadLifecycleEventId(SESSION, CU3, THREAD, 'DORMANT'), threadId: THREAD, cuId: CU3, sessionPosition: 3, transitionOrdinal: 0, fromState: 'ACTIVE', toState: 'DORMANT', reasonCode: 'SUSTAINED_DEPARTURE' }]);
    expect([...sessionThreadStates(context)]).toEqual([[THREAD, 'DORMANT']]);
    expect([...sessionThreadStates(mapConversationThreadLifecycleRuntimeContext(row(), request))]).toEqual([[THREAD, 'ACTIVE']]);
    // Nothing spatial, graded or temporal crosses.
    expect(JSON.stringify(context)).not.toMatch(/placement|home_anchor|created_at|score|confidence/u);
  });

  it('50. the version is a non-negative technical integer, bigint-as-string accepted, nothing else', () => {
    expect(mapConversationThreadLifecycleRuntimeContext(row({ world_thread_identity_version: 0 }), request).worldThreadIdentityVersion).toBe(0);
    for (const bad of [-1, '-1', 'x', null, 1.5, undefined]) invalidContext({ world_thread_identity_version: bad }, 'INVALID_THREAD_LIFECYCLE_CONTEXT');
  });

  it('51. the row must carry exactly the twelve keys; the nine B2b3 keys stay the B2b3 mapper\'s authority', () => {
    invalidContext({ extra: 1 }, 'INVALID_THREAD_LIFECYCLE_CONTEXT');
    const { session_focus_thread_bindings: _dropped, ...missing } = row();
    expect(() => mapConversationThreadLifecycleRuntimeContext(missing, request)).toThrow(ConversationThreadLifecycleIntegrityError);
    // A B2b3-level fault (a missing bundle) is reported by the reused mapper in its own vocabulary.
    invalidContext({ prior_focus_semantics: [] }, 'INCOMPLETE_PRIOR_THREAD_HISTORY');
  });

  it('52. a binding must close over canonical prior focus truth: prior CU, focus candidate, focus-bearing attention on that focus', () => {
    invalidContext({ session_focus_thread_bindings: [binding({ bound_cu_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' })] }, 'LIFECYCLE_CONTEXT_NOT_CLOSED');
    invalidContext({ session_focus_thread_bindings: [binding({ emerging_focus_id: FOCUS2, binding_id: durableThreadFocusBindingId(SESSION, FOCUS2, THREAD) })] }, 'LIFECYCLE_CONTEXT_NOT_CLOSED');
    invalidContext({ session_focus_thread_bindings: [binding({ bound_cu_id: CU3, bound_sp: 3 })] }, 'LIFECYCLE_CONTEXT_NOT_CLOSED');
  });

  it('53. binding identity is the derived one; kinds are the closed pair; no duplicate focus or Thread; no future SP', () => {
    invalidContext({ session_focus_thread_bindings: [binding({ binding_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' })] }, 'INVALID_THREAD_LIFECYCLE_CONTEXT');
    invalidContext({ session_focus_thread_bindings: [binding({ binding_kind: 'MERGE' })] }, 'INVALID_THREAD_LIFECYCLE_CONTEXT');
    invalidContext({ session_focus_thread_bindings: [binding(), binding({ thread_id: THREAD2, binding_id: durableThreadFocusBindingId(SESSION, FOCUS, THREAD2) })] }, 'INVALID_THREAD_LIFECYCLE_CONTEXT');
    invalidContext({ session_focus_thread_bindings: [binding({ bound_sp: 9 })] }, 'INVALID_THREAD_LIFECYCLE_CONTEXT');
    invalidContext({ session_focus_thread_bindings: [binding({ extra: true })] }, 'INVALID_THREAD_LIFECYCLE_CONTEXT');
  });

  it('54. the ESTABLISHMENT bindings are exactly the B2b3 establishment truth of the Session', () => {
    invalidContext({ session_focus_thread_bindings: [] }, 'LIFECYCLE_CONTEXT_NOT_CLOSED');
    invalidContext({ session_focus_thread_bindings: [binding({ binding_kind: 'SESSION_CONTINUITY' })] }, 'LIFECYCLE_CONTEXT_NOT_CLOSED');
    // A continuity binding of another Thread beside the establishment is legitimate.
    const context = mapConversationThreadLifecycleRuntimeContext(row({
      focus_candidates: [
        { focus_candidate_id: FOCUS, grounding_handle_ids: [HANDLE], prior_grounding_cu_ids: [CU1] },
        { focus_candidate_id: FOCUS2, grounding_handle_ids: [HANDLE], prior_grounding_cu_ids: [CU2] },
      ],
      prior_focus_semantics: [bundleOf(CU1, START, [reference]), bundleOf(CU2, { ...ATTEND, emerging_focus_id: FOCUS2 }), bundleOf(CU3, NONE)],
      focus_attention_history: [attentionRow(CU1, START), attentionRow(CU2, { ...ATTEND, emerging_focus_id: FOCUS2 }), attentionRow(CU3, NONE)],
      session_focus_thread_bindings: [binding(), binding({ thread_id: THREAD2, emerging_focus_id: FOCUS2, bound_cu_id: CU2, bound_sp: 2, binding_kind: 'SESSION_CONTINUITY', binding_id: durableThreadFocusBindingId(SESSION, FOCUS2, THREAD2) })],
    }), request);
    expect(context.sessionFocusThreadBindings.map((b) => [b.threadId, b.bindingKind])).toEqual([[THREAD, 'ESTABLISHMENT'], [THREAD2, 'SESSION_CONTINUITY']]);
  });

  it('55. the lifecycle chain must be legal from a derived ACTIVE baseline, per Thread, in SP order', () => {
    invalidContext({ session_thread_lifecycle_history: [event(CU2, 2, 'DORMANT', 'REOPENED', 'GENUINE_RETURN')] }, 'INVALID_LIFECYCLE_CHAIN');
    invalidContext({ session_thread_lifecycle_history: [event(CU2, 2, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE'), event(CU3, 3, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE')] }, 'INVALID_LIFECYCLE_CHAIN');
    invalidContext({ session_thread_lifecycle_history: [event(CU1, 1, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE')] }, 'INVALID_LIFECYCLE_CHAIN');
    invalidContext({ session_thread_lifecycle_history: [event(CU2, 2, 'ACTIVE', 'REOPENED', 'GENUINE_RETURN')] }, 'INVALID_LIFECYCLE_CHAIN');
    invalidContext({ session_thread_lifecycle_history: [event(CU2, 2, 'ACTIVE', 'DORMANT', 'GENUINE_RETURN')] }, 'INVALID_THREAD_LIFECYCLE_CONTEXT');
    const legal = mapConversationThreadLifecycleRuntimeContext(row({
      session_thread_lifecycle_history: [event(CU2, 2, 'ACTIVE', 'DORMANT', 'EXPLICIT_FOCUS_SHIFT'), event(CU3, 3, 'DORMANT', 'REOPENED', 'GENUINE_RETURN')],
    }), request);
    expect([...sessionThreadStates(legal)]).toEqual([[THREAD, 'REOPENED']]);
  });

  it('56. every history row closes over a bound Thread and a prior CU, with derived identity, ordered (SP, ordinal), no future SP', () => {
    invalidContext({ session_thread_lifecycle_history: [event(CU2, 2, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE', 0, THREAD2)] }, 'LIFECYCLE_CONTEXT_NOT_CLOSED');
    invalidContext({ session_thread_lifecycle_history: [{ ...event(CU2, 2, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE'), event_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }] }, 'INVALID_THREAD_LIFECYCLE_CONTEXT');
    invalidContext({ session_thread_lifecycle_history: [event(CU2, 2, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE', 1)] }, 'INVALID_THREAD_LIFECYCLE_CONTEXT');
    invalidContext({ session_thread_lifecycle_history: [event(CU3, 3, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE'), event(CU2, 2, 'DORMANT', 'REOPENED', 'GENUINE_RETURN')] }, 'INVALID_THREAD_LIFECYCLE_CONTEXT');
    invalidContext({ session_thread_lifecycle_history: [event(CU2, 9, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE')] }, 'INVALID_THREAD_LIFECYCLE_CONTEXT');
    invalidContext({ session_thread_lifecycle_history: [{ ...event(CU2, 2, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE'), cu_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }] }, 'LIFECYCLE_CONTEXT_NOT_CLOSED');
  });

  it('57. the integrated snapshot re-derives every provable claim and never upgrades PARTIAL', () => {
    const base = {
      batch_exists: true, committed_unit_count: 1, units: [{ id: CU1, session_position: 1 }], commit_event: null, source_frontier: 5, live_head: 1,
      focus_batch_exists: true, focus_semantic_count: 1, focus_attention_count: 1, focus_complete: true,
      thread_capture_state: 'COMPLETE', thread_batch_exists: true, thread_unit_count: 1, thread_establishment_count: 0,
      thread_semantic_capture_state: 'COMPLETE', thread_semantic_batch_exists: true, thread_semantic_unit_count: 1, continuity_binding_count: 0, lifecycle_transition_count: 0,
    };
    expect(mapIntegratedThreadLifecycleBatchSnapshot(base).thread_semantic_capture_state).toBe('COMPLETE');
    const reject = (overrides: Record<string, unknown>) =>
      expect(() => mapIntegratedThreadLifecycleBatchSnapshot({ ...base, ...overrides })).toThrow(ConversationThreadLifecycleIntegrityError);
    reject({ thread_semantic_capture_state: 'COMPLETE', thread_semantic_batch_exists: false, thread_semantic_unit_count: 0 });
    reject({ thread_semantic_capture_state: 'COMPLETE', thread_semantic_unit_count: 2 });
    reject({ thread_semantic_capture_state: 'COMPLETE', thread_capture_state: 'PARTIAL' });
    reject({ thread_semantic_capture_state: 'ABSENT' });
    reject({ thread_semantic_capture_state: 'DONE' });
    reject({ thread_semantic_batch_exists: false, thread_semantic_capture_state: 'PARTIAL', continuity_binding_count: 1 });
    reject({ continuity_binding_count: 2 });
    const absent = { ...base, batch_exists: false, committed_unit_count: 0, units: [], live_head: null, focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false,
      thread_capture_state: 'ABSENT', thread_batch_exists: false, thread_unit_count: 0, thread_establishment_count: 0,
      thread_semantic_capture_state: 'ABSENT', thread_semantic_batch_exists: false, thread_semantic_unit_count: 0 };
    expect(mapIntegratedThreadLifecycleBatchSnapshot(absent).thread_semantic_capture_state).toBe('ABSENT');
    // A B2b3-only batch (0068 COMPLETE, no 0070 capture) is PARTIAL as given.
    expect(mapIntegratedThreadLifecycleBatchSnapshot({ ...base, thread_semantic_capture_state: 'PARTIAL', thread_semantic_batch_exists: false, thread_semantic_unit_count: 0 }).thread_semantic_capture_state).toBe('PARTIAL');
  });

  it('58. a dossier page is unique, strictly ordered after the cursor, bounded by the limit and source-grounded', () => {
    const item = { session_id: SESSION, cu_id: CU1, exact_surface: 'أحمد', committed_cu_text: 'أحمد نفسه بدأ يقلقني.', source_role: 'USER' };
    const page = mapThreadIdentityDossierPage([{ thread_id: THREAD, identity_evidence: [item] }, { thread_id: THREAD2, identity_evidence: [item] }], { userId: USER, expectedWorldThreadIdentityVersion: 4, afterThreadId: null, limit: 32 });
    expect(page.map((d) => d.threadId)).toEqual([THREAD, THREAD2]);
    expect(page[0].identityEvidence).toEqual([{ sessionId: SESSION, cuId: CU1, exactSurface: 'أحمد', committedCuText: 'أحمد نفسه بدأ يقلقني.', sourceRole: 'USER' }]);
    const reject = (rows: unknown, after: string | null = null, limit = 32) =>
      expect(() => mapThreadIdentityDossierPage(rows, { userId: USER, expectedWorldThreadIdentityVersion: 4, afterThreadId: after, limit })).toThrow(ConversationThreadLifecycleIntegrityError);
    reject([{ thread_id: THREAD2, identity_evidence: [item] }, { thread_id: THREAD, identity_evidence: [item] }]);
    reject([{ thread_id: THREAD, identity_evidence: [item] }, { thread_id: THREAD, identity_evidence: [item] }]);
    reject([{ thread_id: THREAD, identity_evidence: [item] }], THREAD);
    reject([{ thread_id: THREAD, identity_evidence: [item] }, { thread_id: THREAD2, identity_evidence: [item] }], null, 1);
    reject([{ thread_id: THREAD, identity_evidence: [] }]);
    reject([{ thread_id: THREAD, identity_evidence: [{ ...item, exact_surface: 'Ahmed' }] }]);
    reject([{ thread_id: THREAD, identity_evidence: [{ ...item, placement_x: '1' }] }]);
    reject([{ thread_id: THREAD, identity_evidence: [item], lifecycle: 'ACTIVE' }]);
    reject('not rows');
  });
});
