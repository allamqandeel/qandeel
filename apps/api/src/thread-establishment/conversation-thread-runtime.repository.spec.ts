import { DataApiError } from '../conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { StaleConversationalFocusContextError } from '../conversational-focus/conversation-focus-runtime.types';
import { ConversationThreadRuntimeRepository } from './conversation-thread-runtime.repository';
import { ConversationThreadIntegrityError, type CommitFinalizedExchangeWithFocusAndThreadRequest } from './conversation-thread-runtime.types';

const SESSION = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const TURN = '11111111-1111-4111-8111-111111111111';
const BATCH = '22222222-2222-4222-8222-222222222222';

const api = (rpc: jest.Mock) => ({ rpc } as unknown as SupabaseServiceRoleApiService);

const REQUEST: CommitFinalizedExchangeWithFocusAndThreadRequest = {
  sessionId: SESSION, userId: USER, userSourceTurnId: TURN, userBatchId: BATCH,
  userUnits: [{ unitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', spanStart: 0, spanEnd: 5 }], userFocusUnits: [], userThreadUnits: [],
  assistantSourceTurnId: '55555555-5555-4555-8555-555555555555', assistantBatchId: '66666666-6666-4666-8666-666666666666',
  assistantUnits: [], assistantFocusUnits: [], assistantThreadUnits: [],
  evaluatorVersion: 'cu-anchor-mapper-v1', policyVersion: 'stage-1.2-cu-commitment-v1', segmentationProvider: 'OPENAI',
  segmentationModel: 'gpt-5-mini', segmentationPromptVersion: 'cu-segmentation-anchored-v1',
  focusEvaluatorVersion: 'conversational-focus-evaluator-v1', focusPolicyVersion: 'stage-1.2-1.3-reference-attention-v1',
  focusProvider: 'OPENAI', focusModel: 'gpt-5-mini', focusPromptVersion: 'focus-resolution-anchored-v2', focusSchemaVersion: 1,
  threadEvaluatorVersion: 'thread-establishment-evaluator-v1', threadPolicyVersion: 'stage-1.3-thread-establishment-v1',
  threadProvider: 'OPENAI', threadModel: 'gpt-5-mini', threadPromptVersion: 'thread-establishment-evidence-path-v1', threadSchemaVersion: 1,
  expectedCurrentSp: null, expectedSameSpEventSequence: 0,
};

describe('ConversationThreadRuntimeRepository (cases 41-45)', () => {
  it('41. calls exactly the two 0069 reads and the ONE existing 0068 coordinator, with no new mutation RPC', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce([{
        batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null,
        focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false,
        thread_capture_state: 'ABSENT', thread_batch_exists: false, thread_unit_count: 0, thread_establishment_count: 0,
      }])
      .mockResolvedValueOnce([{
        base_current_sp: null, base_same_sp_event_sequence: '0', prior_cus: [], reference_handles: [], focus_candidates: [],
        current_focus_candidate_id: null, prior_focus_semantics: [], focus_attention_history: [], established_thread_bindings: [],
      }])
      .mockResolvedValueOnce([{ live_head: 1, same_sp_event_sequence: '1', user_units: [], assistant_units: [], user_event: null, assistant_event: null }]);
    const repository = new ConversationThreadRuntimeRepository(api(rpc));
    await repository.readIntegratedBatchSnapshot({ sessionId: SESSION, userId: USER, sourceTurnId: TURN, batchId: BATCH });
    await repository.readRuntimeContext({ sessionId: SESSION, userId: USER });
    await repository.commitFinalizedExchangeWithFocusAndThread(REQUEST);
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      'get_conversation_focus_thread_integrated_batch_snapshot_v1',
      'get_conversation_focus_thread_runtime_context_v1',
      'commit_finalized_exchange_with_focus_and_thread_v1',
    ]);
    expect(rpc.mock.calls[0][1]).toEqual({ p_session_id: SESSION, p_user_id: USER, p_source_turn_id: TURN, p_batch_id: BATCH });
    expect(rpc.mock.calls[1][1]).toEqual({ p_session_id: SESSION, p_user_id: USER });
  });

  it('42. the commit body carries identity, coordinates, canonical payload, provenance and the exact token - and nothing else', async () => {
    const rpc = jest.fn().mockResolvedValue([{ live_head: null, same_sp_event_sequence: '0', user_units: [], assistant_units: [], user_event: null, assistant_event: null }]);
    await new ConversationThreadRuntimeRepository(api(rpc)).commitFinalizedExchangeWithFocusAndThread(REQUEST);
    const body = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'p_assistant_batch_id', 'p_assistant_focus_units', 'p_assistant_source_turn_id', 'p_assistant_thread_units', 'p_assistant_units',
      'p_evaluator_version', 'p_expected_current_sp', 'p_expected_same_sp_event_sequence', 'p_focus_evaluator_version', 'p_focus_model',
      'p_focus_policy_version', 'p_focus_prompt_version', 'p_focus_provider', 'p_focus_schema_version', 'p_policy_version',
      'p_segmentation_model', 'p_segmentation_prompt_version', 'p_segmentation_provider', 'p_session_id', 'p_thread_evaluator_version',
      'p_thread_model', 'p_thread_policy_version', 'p_thread_prompt_version', 'p_thread_provider', 'p_thread_schema_version',
      'p_user_batch_id', 'p_user_focus_units', 'p_user_id', 'p_user_source_turn_id', 'p_user_thread_units', 'p_user_units',
    ]);
    expect(body.p_user_units).toEqual([{ unit_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', span_start: 0, span_end: 5 }]);
    expect([body.p_expected_current_sp, body.p_expected_same_sp_event_sequence]).toEqual([null, 0]);
    // No SP, no sequence, no permanent placement, no fingerprint and no origin
    // provenance of the DB's own crosses this boundary in either direction.
    const wire = JSON.stringify(body);
    for (const forbidden of ['p_sp', 'p_session_position', 'p_same_sp_event_sequence', 'p_live_head', 'placement', 'home_x', 'home_y',
      'base_x', 'base_y', 'attempt', 'fingerprint', 'address_scheme', 'world_fingerprint', 'origin_fingerprint']) {
      expect(forbidden in body).toBe(false);
      expect(wire.includes(forbidden)).toBe(false);
    }
  });

  it('43. ONLY SQLSTATE 40001 carrying the exact stale token becomes the typed domain error', async () => {
    const stale = new DataApiError(500, { databaseCode: '40001', databaseMessage: 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' });
    await expect(new ConversationThreadRuntimeRepository(api(jest.fn().mockRejectedValue(stale))).commitFinalizedExchangeWithFocusAndThread(REQUEST))
      .rejects.toBeInstanceOf(StaleConversationalFocusContextError);
    for (const notStale of [
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'could not serialize access due to concurrent update' }),
      new DataApiError(500, { databaseCode: '40001' }),
      new DataApiError(500, { databaseCode: '55000', databaseMessage: 'THREAD_CAPTURE_BATCH_INTEGRITY' }),
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'NOT_STALE_CONVERSATIONAL_FOCUS_CONTEXT' }),
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'STALE_CONVERSATIONAL_FOCUS_CONTEXT_OTHER' }),
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'wrapped: STALE_CONVERSATIONAL_FOCUS_CONTEXT' }),
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'stale_conversational_focus_context' }),
      new Error('STALE_CONVERSATIONAL_FOCUS_CONTEXT 40001'),
    ]) {
      await expect(new ConversationThreadRuntimeRepository(api(jest.fn().mockRejectedValue(notStale))).commitFinalizedExchangeWithFocusAndThread(REQUEST)).rejects.toBe(notStale);
    }
  });

  it('44. PostgREST JSON is never cast blindly: a malformed row fails closed as an integrity error', async () => {
    const badSnapshot = new ConversationThreadRuntimeRepository(api(jest.fn().mockResolvedValue([{ batch_exists: 'yes' }])));
    await expect(badSnapshot.readIntegratedBatchSnapshot({ sessionId: SESSION, userId: USER, sourceTurnId: TURN, batchId: BATCH }))
      .rejects.toBeInstanceOf(ConversationThreadIntegrityError);
    const empty = new ConversationThreadRuntimeRepository(api(jest.fn().mockResolvedValue([])));
    await expect(empty.readRuntimeContext({ sessionId: SESSION, userId: USER })).rejects.toBeInstanceOf(ConversationThreadIntegrityError);
    // A PARTIAL capture state survives the boundary exactly as reported.
    const partial = new ConversationThreadRuntimeRepository(api(jest.fn().mockResolvedValue([{
      batch_exists: true, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null,
      focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false,
      thread_capture_state: 'PARTIAL', thread_batch_exists: false, thread_unit_count: 0, thread_establishment_count: 0,
    }])));
    expect((await partial.readIntegratedBatchSnapshot({ sessionId: SESSION, userId: USER, sourceTurnId: TURN, batchId: BATCH })).thread_capture_state).toBe('PARTIAL');
  });

  it('45. the repository is a plain class over the service-role channel, with no Nest lifecycle of its own', () => {
    const repository = new ConversationThreadRuntimeRepository(api(jest.fn()));
    expect(Object.getPrototypeOf(repository).constructor.name).toBe('ConversationThreadRuntimeRepository');
    // A Nest provider carries design-time parameter metadata; this class does not.
    expect((Reflect as { getOwnMetadataKeys?: (target: unknown) => unknown[] }).getOwnMetadataKeys?.(ConversationThreadRuntimeRepository) ?? []).toEqual([]);
    expect(typeof repository.readIntegratedBatchSnapshot).toBe('function');
    expect(typeof repository.readRuntimeContext).toBe('function');
    expect(typeof repository.commitFinalizedExchangeWithFocusAndThread).toBe('function');
  });
});
