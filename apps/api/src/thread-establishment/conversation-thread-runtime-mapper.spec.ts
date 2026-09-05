import { ConversationThreadIntegrityError } from './conversation-thread-runtime.types';
import { mapConversationThreadRuntimeContext, mapIntegratedFocusThreadBatchSnapshot } from './conversation-thread-runtime-mapper';

const SESSION = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const TURN_1 = '11111111-1111-4111-8111-111111111111';
const TURN_2 = '22222222-2222-4222-8222-222222222222';
const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const P2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const H1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const F1 = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const THREAD = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const ANCHOR = 'أحمد';

const request = { sessionId: SESSION, userId: USER };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const priorCu = (cuId: string, turnId: string, role: 'USER' | 'ASSISTANT', sp: number, ordinal = 0) => ({
  cu_id: cuId, source_turn_id: turnId, source_role: role, committed_text: 'نص', ordinal_within_turn: ordinal,
  session_position: sp, functions: ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null,
});
const resolvedReference = (createsHandle: boolean) => ({
  reference_index: 0, anchor_text: ANCHOR, anchor_occurrence: 1, span_start: 0, span_end: Array.from(ANCHOR).length,
  state: 'RESOLVED', resolved_handle_id: H1, creates_handle: createsHandle, candidate_handle_ids: [],
});
const semanticBundle = (unitId: string, attention: unknown, references: unknown[] = []) => ({
  unit_id: unitId, functions: ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null,
  references, claim_attributions: [], attention,
});
const START = { kind: 'START_NEW_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: F1, creates_focus: true, grounding_reference_index: 0 };
const ATTEND = { kind: 'ATTEND_EXISTING_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: F1, creates_focus: false, grounding_reference_index: null };

function contextRow(overrides: Record<string, unknown> = {}) {
  return {
    base_current_sp: 2,
    base_same_sp_event_sequence: 1,
    prior_cus: [priorCu(P1, TURN_1, 'USER', 1), priorCu(P2, TURN_2, 'ASSISTANT', 2)],
    reference_handles: [{ handle_id: H1, grounding: [{ cu_id: P1, exact_surface: ANCHOR }] }],
    focus_candidates: [{ focus_candidate_id: F1, grounding_handle_ids: [H1], prior_grounding_cu_ids: [P1, P2] }],
    current_focus_candidate_id: F1,
    prior_focus_semantics: [semanticBundle(P1, START, [resolvedReference(true)]), semanticBundle(P2, ATTEND)],
    focus_attention_history: [
      { cu_id: P1, attention_kind: 'START_NEW_FOCUS', attention_reason: 'DIRECT_SUBJECT', emerging_focus_id: F1 },
      { cu_id: P2, attention_kind: 'ATTEND_EXISTING_FOCUS', attention_reason: 'DIRECT_SUBJECT', emerging_focus_id: F1 },
    ],
    established_thread_bindings: [{ thread_id: THREAD, emerging_focus_id: F1, established_cu_id: P1, established_sp: 1 }],
    ...overrides,
  };
}

const reasonOf = (run: () => unknown): string => {
  try { run(); } catch (error) {
    expect(error).toBeInstanceOf(ConversationThreadIntegrityError);
    return (error as ConversationThreadIntegrityError).reason;
  }
  throw new Error('expected a fail-closed rejection');
};
const mapContext = (row: unknown) => mapConversationThreadRuntimeContext(row, request);
const mutate = (change: (row: ReturnType<typeof contextRow>) => void) => {
  const row = clone(contextRow());
  change(row);
  return row;
};

describe('combined runtime context (cases 23-33)', () => {
  it('23. a complete combined context maps to the exact B1 input, B1 bundles, attention history and Thread bindings', () => {
    const context = mapContext(contextRow());
    expect(context.sessionId).toBe(SESSION);
    expect(context.token).toEqual({ currentSp: 2, sameSpEventSequence: 1 });
    expect(context.priorContext.priorCus.map((cu) => cu.cuId)).toEqual([P1, P2]);
    expect(context.priorContext.currentFocusCandidateId).toBe(F1);
    expect(context.priorFocusSemantics.map((bundle) => bundle.unit_id)).toEqual([P1, P2]);
    expect(context.priorFocusSemantics[0].references[0]).toEqual({
      reference_index: 0, anchor_text: ANCHOR, anchor_occurrence: 1, span_start: 0, span_end: 4,
      state: 'RESOLVED', resolved_handle_id: H1, creates_handle: true, candidate_handle_ids: [],
    });
    expect(context.focusAttentionHistory).toEqual([
      { cuId: P1, attentionKind: 'START_NEW_FOCUS', attentionReason: 'DIRECT_SUBJECT', emergingFocusId: F1 },
      { cuId: P2, attentionKind: 'ATTEND_EXISTING_FOCUS', attentionReason: 'DIRECT_SUBJECT', emergingFocusId: F1 },
    ]);
    expect(context.establishedThreadBindings).toEqual([{ threadId: THREAD, emergingFocusId: F1, establishedCuId: P1, establishedSp: 1 }]);
  });

  it('24. the token is strict: (null, 0) before the first SP, and nothing else', () => {
    const empty = mapContext({
      ...contextRow(), base_current_sp: null, base_same_sp_event_sequence: 0, prior_cus: [], reference_handles: [],
      focus_candidates: [], current_focus_candidate_id: null, prior_focus_semantics: [], focus_attention_history: [],
      established_thread_bindings: [],
    });
    expect(empty.token).toEqual({ currentSp: null, sameSpEventSequence: 0 });
    // A bigint sequence arrives as a numeric string and is accepted as a number.
    expect(mapContext(contextRow({ base_same_sp_event_sequence: '2' })).token.sameSpEventSequence).toBe(2);
    for (const bad of [{ base_current_sp: null }, { base_current_sp: 0 }, { base_current_sp: 1.5 }, { base_current_sp: '2' },
      { base_same_sp_event_sequence: -1 }, { base_same_sp_event_sequence: 1.5 }, { base_same_sp_event_sequence: null }]) {
      expect(reasonOf(() => mapContext(contextRow(bad)))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    }
    // The token and the prior CUs must describe the same Session time.
    expect(reasonOf(() => mapContext(contextRow({ base_current_sp: 3 })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
  });

  it('25. prior CUs are strictly ascending, unique, and one source turn keeps one role and ascending ordinals', () => {
    expect(reasonOf(() => mapContext(mutate((row) => { row.prior_cus[1].session_position = 1; })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    expect(reasonOf(() => mapContext(mutate((row) => { row.prior_cus[1].cu_id = P1; })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    expect(reasonOf(() => mapContext(mutate((row) => { row.prior_cus[1].source_turn_id = TURN_1; })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    expect(reasonOf(() => mapContext(mutate((row) => {
      row.prior_cus[1].source_turn_id = TURN_1;
      row.prior_cus[1].source_role = 'USER';
    })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    expect(reasonOf(() => mapContext(mutate((row) => { row.prior_cus[0].source_role = 'QANDEEL' as never; })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
  });

  it('26. B1 vocabularies are frozen and an unknown value is refused, never coerced', () => {
    expect(reasonOf(() => mapContext(mutate((row) => { row.prior_cus[0].functions = ['SUMMARISE'] as never; })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    expect(reasonOf(() => mapContext(mutate((row) => { row.prior_cus[0].sequence_position = 'LATER' as never; })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    expect(reasonOf(() => mapContext(mutate((row) => { row.focus_attention_history[0].attention_kind = 'MAYBE' as never; })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    // A reason outside the kind's frozen set is not a legal pairing.
    expect(reasonOf(() => mapContext(mutate((row) => {
      row.focus_attention_history[0].attention_reason = 'UNRESOLVED_ATTENTION';
      (row.prior_focus_semantics[0].attention as { reason: string }).reason = 'UNRESOLVED_ATTENTION';
    })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
  });

  it('27. grounding must close over the SAME context row: handles, focuses, targets and the current focus', () => {
    const unknown = '99999999-9999-4999-8999-999999999999';
    expect(reasonOf(() => mapContext(mutate((row) => { row.prior_cus[1].target_cu_id = unknown as never; })))).toBe('CONTEXT_GROUNDING_NOT_CLOSED');
    expect(reasonOf(() => mapContext(mutate((row) => { row.reference_handles[0].grounding[0].cu_id = unknown; })))).toBe('CONTEXT_GROUNDING_NOT_CLOSED');
    expect(reasonOf(() => mapContext(mutate((row) => { row.focus_candidates[0].grounding_handle_ids = [unknown]; })))).toBe('CONTEXT_GROUNDING_NOT_CLOSED');
    expect(reasonOf(() => mapContext(mutate((row) => { row.focus_candidates[0].prior_grounding_cu_ids = [unknown]; })))).toBe('CONTEXT_GROUNDING_NOT_CLOSED');
    expect(reasonOf(() => mapContext(contextRow({ current_focus_candidate_id: unknown })))).toBe('CONTEXT_GROUNDING_NOT_CLOSED');
    expect(reasonOf(() => mapContext(mutate((row) => { (row.prior_focus_semantics[0].references[0] as { resolved_handle_id: string }).resolved_handle_id = unknown; }))))
      .toBe('CONTEXT_GROUNDING_NOT_CLOSED');
  });

  it('28. exactly ONE complete canonical B1 bundle per prior CU, matched by exact unit_id', () => {
    expect(reasonOf(() => mapContext(mutate((row) => { row.prior_focus_semantics.pop(); })))).toBe('INCOMPLETE_PRIOR_THREAD_HISTORY');
    expect(reasonOf(() => mapContext(mutate((row) => { row.prior_focus_semantics.push(semanticBundle(P2, ATTEND)); })))).toBe('INCOMPLETE_PRIOR_THREAD_HISTORY');
    expect(reasonOf(() => mapContext(mutate((row) => { row.prior_focus_semantics.reverse(); })))).toBe('INCOMPLETE_PRIOR_THREAD_HISTORY');
    // A prior CU whose B1 functions never arrived is incomplete history, not "unknown semantics".
    expect(reasonOf(() => mapContext(mutate((row) => { row.prior_cus[0].functions = [] as never; })))).toBe('INCOMPLETE_PRIOR_THREAD_HISTORY');
    // The bundle and the prior-CU projection are ONE truth.
    expect(reasonOf(() => mapContext(mutate((row) => { row.prior_focus_semantics[0].sequence_position = 'FOLLOW_UP'; })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    expect(reasonOf(() => mapContext(mutate((row) => { row.prior_focus_semantics[0].functions = ['ASK']; })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
  });

  it('29. exactly ONE attention item per prior CU, agreeing with that CU\'s own bundle', () => {
    expect(reasonOf(() => mapContext(mutate((row) => { row.focus_attention_history.pop(); })))).toBe('INCOMPLETE_PRIOR_THREAD_HISTORY');
    expect(reasonOf(() => mapContext(mutate((row) => { row.focus_attention_history[1].cu_id = P1; })))).toBe('INCOMPLETE_PRIOR_THREAD_HISTORY');
    expect(reasonOf(() => mapContext(mutate((row) => { row.focus_attention_history[1].emerging_focus_id = null as never; })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    expect(reasonOf(() => mapContext(mutate((row) => { row.focus_attention_history[1].attention_kind = 'START_NEW_FOCUS'; })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
  });

  it('30. no timestamp-derived or unknown field survives: every object is exact-keyed', () => {
    for (const row of [
      mutate((r) => { (r.prior_cus[0] as Record<string, unknown>).created_at = 'now'; }),
      mutate((r) => { (r.prior_focus_semantics[0] as Record<string, unknown>).created_at = 'now'; }),
      mutate((r) => { (r.focus_attention_history[0] as Record<string, unknown>).created_at = 'now'; }),
      mutate((r) => { (r.established_thread_bindings[0] as Record<string, unknown>).created_at = 'now'; }),
      mutate((r) => { (r.prior_focus_semantics[0].attention as Record<string, unknown>).score = 1; }),
      { ...contextRow(), extra: true },
    ]) {
      expect(reasonOf(() => mapContext(row))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    }
  });

  it('31. Thread bindings are unique in Thread id and in grounding Emerging Focus id', () => {
    expect(reasonOf(() => mapContext(mutate((row) => {
      row.established_thread_bindings.push({ thread_id: THREAD, emerging_focus_id: F1, established_cu_id: P2, established_sp: 2 });
    })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    expect(reasonOf(() => mapContext(mutate((row) => {
      row.established_thread_bindings.push({ thread_id: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f', emerging_focus_id: F1, established_cu_id: P2, established_sp: 2 });
    })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
  });

  it('32. a Thread binding is refused unless it closes to canonical prior focus truth at a prior SP', () => {
    // A future SP is structurally impossible against the same token.
    expect(reasonOf(() => mapContext(mutate((row) => { row.established_thread_bindings[0].established_sp = 3; })))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    // The establishing CU must be one of this Session's prior CUs.
    expect(reasonOf(() => mapContext(mutate((row) => { row.established_thread_bindings[0].established_cu_id = '99999999-9999-4999-8999-999999999999'; }))))
      .toBe('CONTEXT_GROUNDING_NOT_CLOSED');
    // The grounding focus must be a canonical focus of this Session...
    expect(reasonOf(() => mapContext(mutate((row) => { row.established_thread_bindings[0].emerging_focus_id = '99999999-9999-4999-8999-999999999999'; }))))
      .toBe('CONTEXT_GROUNDING_NOT_CLOSED');
    // ...and that CU's own canonical attention must actually be bound to it.
    expect(reasonOf(() => mapContext(mutate((row) => { row.established_thread_bindings[0].established_cu_id = P2; row.established_thread_bindings[0].established_sp = 2;
      row.focus_attention_history[1].attention_kind = 'NO_INDEPENDENT_FOCUS';
      row.focus_attention_history[1].attention_reason = 'INCIDENTAL_OR_SUBORDINATE';
      row.focus_attention_history[1].emerging_focus_id = null as never;
      row.prior_focus_semantics[1].attention = { kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null };
    }))))
      .toBe('CONTEXT_GROUNDING_NOT_CLOSED');
  });

  it('33. no cross-session or cross-user context is representable, and a non-object row is refused', () => {
    expect(reasonOf(() => mapConversationThreadRuntimeContext(contextRow(), { sessionId: 'not-a-uuid', userId: USER }))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    expect(reasonOf(() => mapConversationThreadRuntimeContext(contextRow(), { sessionId: SESSION, userId: 'not-a-uuid' }))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    for (const bad of [undefined, null, [], 'row', 42]) expect(reasonOf(() => mapContext(bad))).toBe('INVALID_THREAD_RUNTIME_CONTEXT');
    // The mapped Session identity is the REQUEST's, never a transported one.
    expect(mapContext(contextRow()).sessionId).toBe(SESSION);
  });
});

describe('integrated B1+B2 batch snapshot (cases 34-40)', () => {
  const absent = {
    batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null,
    focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false,
    thread_capture_state: 'ABSENT', thread_batch_exists: false, thread_unit_count: 0, thread_establishment_count: 0,
  };
  const complete = {
    batch_exists: true, committed_unit_count: 2,
    units: [{ id: P1, session_position: 1 }, { id: P2, session_position: 2 }],
    commit_event: { commit_batch_id: TURN_1, first_sp: 1, last_sp: 2, unit_count: 2 },
    source_frontier: 20, live_head: 2,
    focus_batch_exists: true, focus_semantic_count: 2, focus_attention_count: 2, focus_complete: true,
    thread_capture_state: 'COMPLETE', thread_batch_exists: true, thread_unit_count: 2, thread_establishment_count: 1,
  };

  it('34. an absent exchange and a fully integrated one map exactly as the database reports them', () => {
    expect(mapIntegratedFocusThreadBatchSnapshot(absent)).toEqual(absent);
    expect(mapIntegratedFocusThreadBatchSnapshot(complete)).toEqual(complete);
    // A committed zero-CU batch is legitimately COMPLETE.
    expect(mapIntegratedFocusThreadBatchSnapshot({
      ...complete, committed_unit_count: 0, units: [], commit_event: null, live_head: null,
      focus_semantic_count: 0, focus_attention_count: 0, thread_unit_count: 0, thread_establishment_count: 0,
    }).thread_capture_state).toBe('COMPLETE');
  });

  it('35. an honest PARTIAL is preserved and never upgraded, whatever the counts look like', () => {
    const legacy = { ...absent, batch_exists: true, committed_unit_count: 1, units: [{ id: P1, session_position: 1 }],
      commit_event: { commit_batch_id: TURN_1, first_sp: 1, last_sp: 1, unit_count: 1 }, live_head: 1, thread_capture_state: 'PARTIAL' };
    expect(mapIntegratedFocusThreadBatchSnapshot(legacy).thread_capture_state).toBe('PARTIAL');
    const b1Only = { ...complete, thread_capture_state: 'PARTIAL', thread_batch_exists: false, thread_unit_count: 0, thread_establishment_count: 0 };
    expect(mapIntegratedFocusThreadBatchSnapshot(b1Only).thread_capture_state).toBe('PARTIAL');
    // Even a row whose counters LOOK whole stays PARTIAL: the 0068 authority decides.
    expect(mapIntegratedFocusThreadBatchSnapshot({ ...complete, thread_capture_state: 'PARTIAL' }).thread_capture_state).toBe('PARTIAL');
  });

  it('36. a claimed COMPLETE the row\'s own counts do not support is malformed transport', () => {
    for (const bad of [
      { ...complete, focus_semantic_count: 0, focus_complete: false },
      { ...complete, focus_attention_count: 1, focus_complete: false },
      { ...complete, thread_batch_exists: false, thread_unit_count: 0 },
      { ...complete, thread_unit_count: 1 },
      { ...complete, focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false },
      { ...complete, batch_exists: false },
    ]) {
      expect(reasonOf(() => mapIntegratedFocusThreadBatchSnapshot(bad))).toBe('INVALID_INTEGRATED_SNAPSHOT');
    }
  });

  it('37. a claimed ABSENT with any surviving layer is malformed transport', () => {
    for (const bad of [
      { ...absent, batch_exists: true },
      { ...absent, focus_batch_exists: true },
      { ...absent, thread_batch_exists: true },
    ]) {
      expect(reasonOf(() => mapIntegratedFocusThreadBatchSnapshot(bad))).toBe('INVALID_INTEGRATED_SNAPSHOT');
    }
  });

  it('38. an absent commitment batch may carry no coordinate, no unit, no event and no B1 / B2 counter', () => {
    for (const bad of [
      { ...absent, committed_unit_count: 1 },
      { ...absent, commit_event: { first_sp: 1 } },
      { ...absent, focus_semantic_count: 1 },
      { ...absent, thread_unit_count: 1 },
      { ...absent, thread_establishment_count: 1 },
    ]) {
      expect(reasonOf(() => mapIntegratedFocusThreadBatchSnapshot(bad))).toBe('INVALID_INTEGRATED_SNAPSHOT');
    }
  });

  it('39. counters above their own ceiling, and a state outside the closed vocabulary, are refused', () => {
    for (const bad of [
      { ...complete, focus_semantic_count: 3 },
      { ...complete, focus_attention_count: 3 },
      { ...complete, thread_establishment_count: 3 },
      { ...complete, thread_capture_state: 'READY' },
      { ...complete, thread_capture_state: null },
      { ...complete, units: [{ id: P1, session_position: 1 }] },
      { ...complete, live_head: 0 },
    ]) {
      expect(reasonOf(() => mapIntegratedFocusThreadBatchSnapshot(bad))).toBe('INVALID_INTEGRATED_SNAPSHOT');
    }
  });

  it('40. a missing field or a non-object row is refused, and the mapper never rewrites a state or a count', () => {
    for (const key of Object.keys(complete)) {
      const bad: Record<string, unknown> = { ...complete };
      delete bad[key];
      expect(reasonOf(() => mapIntegratedFocusThreadBatchSnapshot(bad))).toBe('INVALID_INTEGRATED_SNAPSHOT');
    }
    for (const bad of [undefined, null, [], 'row', 7]) expect(reasonOf(() => mapIntegratedFocusThreadBatchSnapshot(bad))).toBe('INVALID_INTEGRATED_SNAPSHOT');
  });
});
