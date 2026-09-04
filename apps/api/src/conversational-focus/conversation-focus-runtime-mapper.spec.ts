import { mapConversationFocusRuntimeContext, mapIntegratedBatchSnapshot } from './conversation-focus-runtime-mapper';
import { ConversationFocusIntegrityError } from './conversation-focus-runtime.types';

const SESSION = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const TURN = '11111111-1111-4111-8111-111111111111';
const CU1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CU2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const H1 = '55555555-5555-4555-8555-555555555555';
const F1 = '66666666-6666-4666-8666-666666666666';

const cu = (cu_id: string, session_position: number, overrides: Record<string, unknown> = {}) => ({
  cu_id, source_turn_id: TURN, source_role: 'USER', committed_text: 'أحمد بقى بيقلقني.', ordinal_within_turn: session_position - 1, session_position,
  functions: ['INFORM_REPORT'], sequence_position: 'INITIATING', target_cu_id: null, ...overrides,
});
const row = (overrides: Record<string, unknown> = {}) => ({
  base_current_sp: 2, base_same_sp_event_sequence: '1',
  prior_cus: [cu(CU1, 1), cu(CU2, 2, { sequence_position: 'FOLLOW_UP', target_cu_id: CU1, functions: ['INFORM_REPORT', 'FOCUS_SHIFT'] })],
  reference_handles: [{ handle_id: H1, grounding: [{ cu_id: CU1, exact_surface: 'أحمد' }, { cu_id: CU2, exact_surface: 'أحمد' }] }],
  focus_candidates: [{ focus_candidate_id: F1, grounding_handle_ids: [H1], prior_grounding_cu_ids: [CU2] }],
  current_focus_candidate_id: F1,
  ...overrides,
});
const reason = (value: unknown) => {
  try {
    mapConversationFocusRuntimeContext(value, { sessionId: SESSION, userId: USER });
  } catch (error) {
    if (error instanceof ConversationFocusIntegrityError) return error.reason;
    throw error;
  }
  return 'MAPPED';
};

describe('the strict runtime-context mapper', () => {
  it('maps a valid snapshot to the exact T-03B1a PriorContext plus the token', () => {
    const mapped = mapConversationFocusRuntimeContext(row(), { sessionId: SESSION, userId: USER });
    expect(mapped).toEqual({
      sessionId: SESSION,
      token: { currentSp: 2, sameSpEventSequence: 1 },
      priorContext: {
        priorCus: [
          { cuId: CU1, sourceTurnId: TURN, sourceRole: 'USER', committedText: 'أحمد بقى بيقلقني.', ordinalWithinTurn: 0, functions: ['INFORM_REPORT'], sequencePosition: 'INITIATING', targetCuId: null },
          { cuId: CU2, sourceTurnId: TURN, sourceRole: 'USER', committedText: 'أحمد بقى بيقلقني.', ordinalWithinTurn: 1, functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], sequencePosition: 'FOLLOW_UP', targetCuId: CU1 },
        ],
        referenceHandles: [{ handleId: H1, grounding: [{ cuId: CU1, exactSurface: 'أحمد' }, { cuId: CU2, exactSurface: 'أحمد' }] }],
        focusCandidates: [{ focusCandidateId: F1, groundingHandleIds: [H1], priorGroundingCuIds: [CU2] }],
        currentFocusCandidateId: F1,
      },
    });
    // No timestamp and no same-SP sequence enters the mapped context.
    expect(JSON.stringify(mapped.priorContext)).not.toMatch(/created_at|createdAt|session_position|sessionPosition|same_sp/u);
  });

  it('accepts (null, 0) before the first SP and a bigint sequence encoded as a string', () => {
    const empty = row({ base_current_sp: null, base_same_sp_event_sequence: '0', prior_cus: [], reference_handles: [], focus_candidates: [], current_focus_candidate_id: null });
    expect(mapConversationFocusRuntimeContext(empty, { sessionId: SESSION, userId: USER }).token).toEqual({ currentSp: null, sameSpEventSequence: 0 });
    expect(mapConversationFocusRuntimeContext(row({ base_same_sp_event_sequence: 1 }), { sessionId: SESSION, userId: USER }).token).toEqual({ currentSp: 2, sameSpEventSequence: 1 });
  });

  it('rejects, never cleans, every structural violation', () => {
    for (const [label, value] of Object.entries({
      'not an object': null,
      'a widened row': row({ created_at: 'now' }),
      'a narrowed row': (() => { const r = row(); delete (r as Partial<typeof r>).focus_candidates; return r; })(),
      'null SP with a nonzero sequence': row({ base_current_sp: null, base_same_sp_event_sequence: '3', prior_cus: [], reference_handles: [], focus_candidates: [], current_focus_candidate_id: null }),
      'a zero SP': row({ base_current_sp: 0 }),
      'a token that disagrees with the prior CUs': row({ base_current_sp: 3 }),
      'a negative sequence': row({ base_same_sp_event_sequence: -1 }),
      'non-ascending prior CUs': row({ prior_cus: [cu(CU1, 2), cu(CU2, 1)] }),
      'a duplicate CU id': row({ prior_cus: [cu(CU1, 1), cu(CU1, 2)] }),
      'a SYSTEM role': row({ prior_cus: [cu(CU1, 1, { source_role: 'SYSTEM' }), cu(CU2, 2)] }),
      'a non-frozen function': row({ prior_cus: [cu(CU1, 1, { functions: ['GREET'] }), cu(CU2, 2)] }),
      'a duplicated function': row({ prior_cus: [cu(CU1, 1, { functions: ['ASK', 'ASK'] }), cu(CU2, 2)] }),
      'a non-frozen sequence position': row({ prior_cus: [cu(CU1, 1, { sequence_position: 'OPENING' }), cu(CU2, 2)] }),
      'missing B1 semantics on a prior CU': row({ prior_cus: [cu(CU1, 1, { functions: null, sequence_position: null }), cu(CU2, 2)] }),
      'empty functions on a prior CU': row({ prior_cus: [cu(CU1, 1, { functions: [] }), cu(CU2, 2)] }),
      'a timestamp-shaped CU field': row({ prior_cus: [{ ...cu(CU1, 1), created_at: 'now' }, cu(CU2, 2)] }),
      'a non-UUID handle': row({ reference_handles: [{ handle_id: 'h-ahmed', grounding: [{ cu_id: CU1, exact_surface: 'أحمد' }] }] }),
      'a handle with no grounding': row({ reference_handles: [{ handle_id: H1, grounding: [] }] }),
      'a focus with no grounding handle': row({ focus_candidates: [{ focus_candidate_id: F1, grounding_handle_ids: [], prior_grounding_cu_ids: [CU2] }] }),
      'a prepared focus id': row({ focus_candidates: [{ focus_candidate_id: 'prepared:focus:x', grounding_handle_ids: [H1], prior_grounding_cu_ids: [CU2] }], current_focus_candidate_id: null }),
      'a non-UUID current focus': row({ current_focus_candidate_id: 'f-1' }),
    })) {
      expect([label, reason(value)]).toEqual([label, 'INVALID_RUNTIME_CONTEXT']);
    }
  });

  it('rejects any grounding that is not closed over the returned prior CUs or handles', () => {
    for (const [label, value] of Object.entries({
      'handle grounded by an absent CU': row({ reference_handles: [{ handle_id: H1, grounding: [{ cu_id: '99999999-9999-4999-8999-999999999999', exact_surface: 'أحمد' }] }] }),
      'focus grounded on an absent handle': row({ focus_candidates: [{ focus_candidate_id: F1, grounding_handle_ids: ['77777777-7777-4777-8777-777777777777'], prior_grounding_cu_ids: [CU2] }] }),
      'focus history naming an absent CU': row({ focus_candidates: [{ focus_candidate_id: F1, grounding_handle_ids: [H1], prior_grounding_cu_ids: ['99999999-9999-4999-8999-999999999999'] }] }),
      'a current focus that is not a returned candidate': row({ current_focus_candidate_id: '88888888-8888-4888-8888-888888888888' }),
      'a target that precedes nothing': row({ prior_cus: [cu(CU1, 1, { sequence_position: 'RESPONSIVE', target_cu_id: CU2 }), cu(CU2, 2)] }),
    })) {
      expect([label, reason(value)]).toEqual([label, 'CONTEXT_GROUNDING_NOT_CLOSED']);
    }
  });

  it('rejects a request identity that is not canonical', () => {
    expect(() => mapConversationFocusRuntimeContext(row(), { sessionId: 'session-1', userId: USER })).toThrow(ConversationFocusIntegrityError);
  });
});

describe('the strict integrated-snapshot mapper', () => {
  const snapshot = (overrides: Record<string, unknown> = {}) => ({
    batch_exists: true, committed_unit_count: 1, units: [{ id: CU1, session_position: 1 }], commit_event: { commit_batch_id: CU2, first_sp: 1, last_sp: 1, unit_count: 1 },
    source_frontier: 17, live_head: 1, focus_batch_exists: true, focus_semantic_count: 1, focus_attention_count: 1, focus_complete: true, ...overrides,
  });
  const snapshotReason = (value: unknown) => {
    try { mapIntegratedBatchSnapshot(value); } catch (error) { if (error instanceof ConversationFocusIntegrityError) return error.reason; throw error; }
    return 'MAPPED';
  };

  it('maps a complete, an absent and an explicitly incomplete snapshot', () => {
    expect(mapIntegratedBatchSnapshot(snapshot()).focus_complete).toBe(true);
    const missing = mapIntegratedBatchSnapshot(snapshot({ batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, live_head: null, focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false }));
    expect(missing).toMatchObject({ batch_exists: false, focus_complete: false, source_frontier: 17 });
    const legacy = mapIntegratedBatchSnapshot(snapshot({ focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false }));
    expect(legacy).toMatchObject({ batch_exists: true, focus_batch_exists: false, focus_complete: false });
  });

  it('rejects an incoherent snapshot', () => {
    for (const value of [
      null,
      snapshot({ focus_complete: 'yes' }),
      snapshot({ units: [] }),
      snapshot({ committed_unit_count: -1 }),
      snapshot({ live_head: 0 }),
      snapshot({ batch_exists: false }),
      snapshot({ focus_batch_exists: false }),
      snapshot({ units: [{ id: 'cu-1', session_position: 1 }] }),
      (() => { const s = snapshot(); delete (s as Partial<typeof s>).focus_attention_count; return s; })(),
    ]) {
      expect(snapshotReason(value)).toBe('INVALID_INTEGRATED_SNAPSHOT');
    }
  });
});
