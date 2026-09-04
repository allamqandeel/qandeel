import { DataApiError } from '../conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { ConversationFocusRuntimeRepository, isStaleConversationalFocusContext } from './conversation-focus-runtime.repository';
import { ConversationFocusIntegrityError, StaleConversationalFocusContextError, type CommitFinalizedExchangeWithFocusRequest } from './conversation-focus-runtime.types';

const SESSION = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const TURN = '11111111-1111-4111-8111-111111111111';
const BATCH = '22222222-2222-4222-8222-222222222222';

const api = (rpc: jest.Mock) => ({ rpc } as unknown as SupabaseServiceRoleApiService);

const REQUEST: CommitFinalizedExchangeWithFocusRequest = {
  sessionId: SESSION, userId: USER, userSourceTurnId: TURN, userBatchId: BATCH, userUnits: [{ unitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', spanStart: 0, spanEnd: 5 }], userFocusUnits: [],
  assistantSourceTurnId: '55555555-5555-4555-8555-555555555555', assistantBatchId: '66666666-6666-4666-8666-666666666666', assistantUnits: [], assistantFocusUnits: [],
  evaluatorVersion: 'cu-anchor-mapper-v1', policyVersion: 'stage-1.2-cu-commitment-v1', segmentationProvider: 'OPENAI', segmentationModel: 'gpt-5-mini', segmentationPromptVersion: 'cu-segmentation-anchored-v1',
  focusEvaluatorVersion: 'conversational-focus-evaluator-v1', focusPolicyVersion: 'stage-1.2-1.3-reference-attention-v1', focusProvider: 'OPENAI', focusModel: 'gpt-5-mini', focusPromptVersion: 'focus-resolution-anchored-v2', focusSchemaVersion: 1,
  expectedCurrentSp: null, expectedSameSpEventSequence: 0,
};

describe('ConversationFocusRuntimeRepository', () => {
  it('calls exactly the three integrated RPCs with identity, coordinates, payload, provenance and the expected token', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce([{ batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null, focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false }])
      .mockResolvedValueOnce([{ base_current_sp: null, base_same_sp_event_sequence: '0', prior_cus: [], reference_handles: [], focus_candidates: [], current_focus_candidate_id: null }])
      .mockResolvedValueOnce([{ live_head: 1, same_sp_event_sequence: '1', user_units: [], assistant_units: [], user_event: null, assistant_event: null }]);
    const repository = new ConversationFocusRuntimeRepository(api(rpc));
    await repository.readIntegratedBatchSnapshot({ sessionId: SESSION, userId: USER, sourceTurnId: TURN, batchId: BATCH });
    await repository.readRuntimeContext({ sessionId: SESSION, userId: USER });
    await repository.commitFinalizedExchangeWithFocus(REQUEST);
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      'get_conversation_integrated_batch_snapshot_v1', 'get_conversation_focus_runtime_context_v1', 'commit_finalized_exchange_with_focus_v1',
    ]);
    expect(rpc.mock.calls[0][1]).toEqual({ p_session_id: SESSION, p_user_id: USER, p_source_turn_id: TURN, p_batch_id: BATCH });
    expect(rpc.mock.calls[1][1]).toEqual({ p_session_id: SESSION, p_user_id: USER });
    const body = rpc.mock.calls[2][1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'p_assistant_batch_id', 'p_assistant_focus_units', 'p_assistant_source_turn_id', 'p_assistant_units', 'p_evaluator_version', 'p_expected_current_sp',
      'p_expected_same_sp_event_sequence', 'p_focus_evaluator_version', 'p_focus_model', 'p_focus_policy_version', 'p_focus_prompt_version', 'p_focus_provider',
      'p_focus_schema_version', 'p_policy_version', 'p_segmentation_model', 'p_segmentation_prompt_version', 'p_segmentation_provider', 'p_session_id',
      'p_user_batch_id', 'p_user_focus_units', 'p_user_id', 'p_user_source_turn_id', 'p_user_units',
    ]);
    expect(body.p_user_units).toEqual([{ unit_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', span_start: 0, span_end: 5 }]);
    expect([body.p_expected_current_sp, body.p_expected_same_sp_event_sequence]).toEqual([null, 0]);
    // No SP, no sequence, no wording, no fingerprint is ever sent as authority.
    for (const forbidden of ['p_sp', 'p_session_position', 'p_same_sp_event_sequence', 'committed_text', 'fingerprint', 'p_live_head']) {
      expect(forbidden in body).toBe(false);
    }
  });

  it('maps ONLY SQLSTATE 40001 carrying the exact stale token to the typed domain error', async () => {
    const stale = new DataApiError(500, { databaseCode: '40001', databaseMessage: 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' });
    expect(isStaleConversationalFocusContext(stale)).toBe(true);
    await expect(new ConversationFocusRuntimeRepository(api(jest.fn().mockRejectedValue(stale))).commitFinalizedExchangeWithFocus(REQUEST))
      .rejects.toBeInstanceOf(StaleConversationalFocusContextError);
    for (const notStale of [
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'could not serialize access due to concurrent update' }),
      new DataApiError(500, { databaseCode: '40001' }),
      new DataApiError(500, { databaseCode: '55000', databaseMessage: 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' }),
      new DataApiError(500, { databaseMessage: 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' }),
      new DataApiError(500),
      new Error('STALE_CONVERSATIONAL_FOCUS_CONTEXT 40001'),
    ]) {
      expect(isStaleConversationalFocusContext(notStale)).toBe(false);
      await expect(new ConversationFocusRuntimeRepository(api(jest.fn().mockRejectedValue(notStale))).commitFinalizedExchangeWithFocus(REQUEST)).rejects.toBe(notStale);
    }
  });

  it('never casts PostgREST JSON blindly: a malformed row fails closed as an integrity error', async () => {
    const repository = new ConversationFocusRuntimeRepository(api(jest.fn().mockResolvedValue([{ batch_exists: 'yes' }])));
    await expect(repository.readIntegratedBatchSnapshot({ sessionId: SESSION, userId: USER, sourceTurnId: TURN, batchId: BATCH })).rejects.toBeInstanceOf(ConversationFocusIntegrityError);
    const empty = new ConversationFocusRuntimeRepository(api(jest.fn().mockResolvedValue([])));
    await expect(empty.readRuntimeContext({ sessionId: SESSION, userId: USER })).rejects.toBeInstanceOf(ConversationFocusIntegrityError);
  });
});
