import { DataApiError } from '../conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { StaleConversationalFocusContextError } from '../conversational-focus/conversation-focus-runtime.types';
import { ConversationThreadLifecycleRuntimeRepository, isStaleThreadIdentityContext } from './conversation-thread-lifecycle-runtime.repository';
import {
  ConversationThreadLifecycleIntegrityError,
  StaleThreadIdentityContextError,
  type CommitFinalizedExchangeWithThreadLifecycleRequest,
} from './conversation-thread-lifecycle-runtime.types';

const SESSION = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const TURN = '11111111-1111-4111-8111-111111111111';
const BATCH = '22222222-2222-4222-8222-222222222222';

const api = (rpc: jest.Mock) => ({ rpc } as unknown as SupabaseServiceRoleApiService);

const REQUEST: CommitFinalizedExchangeWithThreadLifecycleRequest = {
  sessionId: SESSION, userId: USER, userSourceTurnId: TURN, userBatchId: BATCH,
  userUnits: [{ unitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', spanStart: 0, spanEnd: 5 }], userFocusUnits: [], userThreadUnits: [], userLifecycleUnits: [],
  assistantSourceTurnId: '55555555-5555-4555-8555-555555555555', assistantBatchId: '66666666-6666-4666-8666-666666666666',
  assistantUnits: [], assistantFocusUnits: [], assistantThreadUnits: [], assistantLifecycleUnits: [],
  evaluatorVersion: 'cu-anchor-mapper-v1', policyVersion: 'stage-1.2-cu-commitment-v1', segmentationProvider: 'OPENAI',
  segmentationModel: 'gpt-5-mini', segmentationPromptVersion: 'cu-segmentation-anchored-v1',
  focusEvaluatorVersion: 'conversational-focus-evaluator-v1', focusPolicyVersion: 'stage-1.2-1.3-reference-attention-v1',
  focusProvider: 'OPENAI', focusModel: 'gpt-5-mini', focusPromptVersion: 'focus-resolution-anchored-v2', focusSchemaVersion: 1,
  threadEvaluatorVersion: 'thread-establishment-evaluator-v1', threadPolicyVersion: 'stage-1.3-thread-establishment-v1',
  threadProvider: 'OPENAI', threadModel: 'gpt-5-mini', threadPromptVersion: 'thread-establishment-evidence-path-v1', threadSchemaVersion: 1,
  continuityEvaluatorVersion: 'thread-continuity-evaluator-v1', continuityPolicyVersion: 'stage-1.3-thread-lifecycle-v1',
  continuityProvider: 'OPENAI', continuityModel: 'gpt-5-mini', continuityPromptVersion: 'thread-continuity-identity-v1', continuitySchemaVersion: 1,
  lifecycleReducerVersion: 'thread-lifecycle-reducer-v1',
  expectedCurrentSp: null, expectedSameSpEventSequence: 0, expectedWorldThreadIdentityVersion: 0,
};
const ABSENT = {
  batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null,
  focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false,
  thread_capture_state: 'ABSENT', thread_batch_exists: false, thread_unit_count: 0, thread_establishment_count: 0,
  thread_semantic_capture_state: 'ABSENT', thread_semantic_batch_exists: false, thread_semantic_unit_count: 0, continuity_binding_count: 0, lifecycle_transition_count: 0,
};
const EMPTY_CONTEXT = {
  base_current_sp: null, base_same_sp_event_sequence: '0', prior_cus: [], reference_handles: [], focus_candidates: [],
  current_focus_candidate_id: null, prior_focus_semantics: [], focus_attention_history: [], established_thread_bindings: [],
  world_thread_identity_version: '0', session_focus_thread_bindings: [], session_thread_lifecycle_history: [],
};

describe('ConversationThreadLifecycleRuntimeRepository (cases 59-63)', () => {
  it('59. calls exactly the three 0070 reads and the ONE 0070 coordinator, with no other mutation RPC', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce([ABSENT])
      .mockResolvedValueOnce([EMPTY_CONTEXT])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ live_head: 1, same_sp_event_sequence: '1', world_thread_identity_version: '0', user_units: [], assistant_units: [], user_event: null, assistant_event: null }]);
    const repository = new ConversationThreadLifecycleRuntimeRepository(api(rpc));
    await repository.readIntegratedBatchSnapshot({ sessionId: SESSION, userId: USER, sourceTurnId: TURN, batchId: BATCH });
    await repository.readRuntimeContext({ sessionId: SESSION, userId: USER });
    await repository.readIdentityDossierPage({ userId: USER, expectedWorldThreadIdentityVersion: 0, afterThreadId: null, limit: 32 });
    await repository.commitFinalizedExchangeWithThreadLifecycle(REQUEST);
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      'get_conversation_thread_lifecycle_integrated_batch_snapshot_v1',
      'get_conversation_thread_lifecycle_runtime_context_v1',
      'get_conversation_thread_identity_dossier_page_v1',
      'commit_finalized_exchange_with_focus_thread_lifecycle_v1',
    ]);
    expect(rpc.mock.calls[2][1]).toEqual({ p_user_id: USER, p_expected_world_thread_identity_version: 0, p_after_thread_id: null, p_limit: 32 });
  });

  it('60. the commit body carries identity, coordinates, the four canonical payloads, provenance and BOTH tokens - and nothing else', async () => {
    const rpc = jest.fn().mockResolvedValue([{ live_head: null, same_sp_event_sequence: '0', world_thread_identity_version: '0', user_units: [], assistant_units: [], user_event: null, assistant_event: null }]);
    await new ConversationThreadLifecycleRuntimeRepository(api(rpc)).commitFinalizedExchangeWithThreadLifecycle(REQUEST);
    const body = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'p_assistant_batch_id', 'p_assistant_focus_units', 'p_assistant_lifecycle_units', 'p_assistant_source_turn_id', 'p_assistant_thread_units', 'p_assistant_units',
      'p_continuity_evaluator_version', 'p_continuity_model', 'p_continuity_policy_version', 'p_continuity_prompt_version', 'p_continuity_provider', 'p_continuity_schema_version',
      'p_evaluator_version', 'p_expected_current_sp', 'p_expected_same_sp_event_sequence', 'p_expected_world_thread_identity_version',
      'p_focus_evaluator_version', 'p_focus_model', 'p_focus_policy_version', 'p_focus_prompt_version', 'p_focus_provider', 'p_focus_schema_version',
      'p_lifecycle_reducer_version', 'p_policy_version', 'p_segmentation_model', 'p_segmentation_prompt_version', 'p_segmentation_provider', 'p_session_id',
      'p_thread_evaluator_version', 'p_thread_model', 'p_thread_policy_version', 'p_thread_prompt_version', 'p_thread_provider', 'p_thread_schema_version',
      'p_user_batch_id', 'p_user_focus_units', 'p_user_id', 'p_user_lifecycle_units', 'p_user_source_turn_id', 'p_user_thread_units', 'p_user_units',
    ]);
    expect([body.p_expected_current_sp, body.p_expected_same_sp_event_sequence, body.p_expected_world_thread_identity_version]).toEqual([null, 0, 0]);
    const wire = JSON.stringify(body);
    for (const forbidden of ['p_sp', 'p_session_position', 'p_same_sp_event_sequence', 'p_live_head', 'placement', 'home_x', 'home_y', 'base_x', 'attempt', 'fingerprint', 'address_scheme', 'from_state', 'lifecycle_state']) {
      expect(forbidden in body).toBe(false);
      expect(wire.includes(forbidden)).toBe(false);
    }
  });

  it('61. ONLY the two exact 40001 tokens become the two typed domain errors; everything else stays what it is', async () => {
    const focusStale = new DataApiError(500, { databaseCode: '40001', databaseMessage: 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' });
    await expect(new ConversationThreadLifecycleRuntimeRepository(api(jest.fn().mockRejectedValue(focusStale))).commitFinalizedExchangeWithThreadLifecycle(REQUEST))
      .rejects.toBeInstanceOf(StaleConversationalFocusContextError);
    const identityStale = new DataApiError(500, { databaseCode: '40001', databaseMessage: 'STALE_THREAD_IDENTITY_CONTEXT' });
    await expect(new ConversationThreadLifecycleRuntimeRepository(api(jest.fn().mockRejectedValue(identityStale))).commitFinalizedExchangeWithThreadLifecycle(REQUEST))
      .rejects.toBeInstanceOf(StaleThreadIdentityContextError);
    await expect(new ConversationThreadLifecycleRuntimeRepository(api(jest.fn().mockRejectedValue(identityStale))).readIdentityDossierPage({ userId: USER, expectedWorldThreadIdentityVersion: 0, afterThreadId: null, limit: 32 }))
      .rejects.toBeInstanceOf(StaleThreadIdentityContextError);
    expect(isStaleThreadIdentityContext(identityStale)).toBe(true);
    for (const notStale of [
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'could not serialize access due to concurrent update' }),
      new DataApiError(500, { databaseCode: '40001' }),
      new DataApiError(500, { databaseCode: '55000', databaseMessage: 'THREAD_SEMANTIC_BATCH_INTEGRITY' }),
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'NOT_STALE_THREAD_IDENTITY_CONTEXT' }),
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'STALE_THREAD_IDENTITY_CONTEXT_OTHER' }),
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'wrapped: STALE_THREAD_IDENTITY_CONTEXT' }),
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'stale_thread_identity_context' }),
      new DataApiError(500, { databaseCode: '22023', databaseMessage: 'STALE_THREAD_IDENTITY_CONTEXT' }),
      new Error('STALE_THREAD_IDENTITY_CONTEXT 40001'),
    ]) {
      expect(isStaleThreadIdentityContext(notStale)).toBe(false);
      await expect(new ConversationThreadLifecycleRuntimeRepository(api(jest.fn().mockRejectedValue(notStale))).commitFinalizedExchangeWithThreadLifecycle(REQUEST)).rejects.toBe(notStale);
    }
  });

  it('62. PostgREST JSON is never cast blindly: a malformed row fails closed as an integrity error', async () => {
    const badSnapshot = new ConversationThreadLifecycleRuntimeRepository(api(jest.fn().mockResolvedValue([{ batch_exists: 'yes' }])));
    await expect(badSnapshot.readIntegratedBatchSnapshot({ sessionId: SESSION, userId: USER, sourceTurnId: TURN, batchId: BATCH })).rejects.toBeInstanceOf(ConversationThreadLifecycleIntegrityError);
    const empty = new ConversationThreadLifecycleRuntimeRepository(api(jest.fn().mockResolvedValue([])));
    await expect(empty.readRuntimeContext({ sessionId: SESSION, userId: USER })).rejects.toBeInstanceOf(ConversationThreadLifecycleIntegrityError);
    const badPage = new ConversationThreadLifecycleRuntimeRepository(api(jest.fn().mockResolvedValue([{ thread_id: 'x' }])));
    await expect(badPage.readIdentityDossierPage({ userId: USER, expectedWorldThreadIdentityVersion: 0, afterThreadId: null, limit: 32 })).rejects.toBeInstanceOf(ConversationThreadLifecycleIntegrityError);
    const partial = new ConversationThreadLifecycleRuntimeRepository(api(jest.fn().mockResolvedValue([{ ...ABSENT, batch_exists: true, thread_capture_state: 'PARTIAL', thread_semantic_capture_state: 'PARTIAL' }])));
    expect((await partial.readIntegratedBatchSnapshot({ sessionId: SESSION, userId: USER, sourceTurnId: TURN, batchId: BATCH })).thread_semantic_capture_state).toBe('PARTIAL');
  });

  it('63. the repository is a plain class over the service-role channel, with no Nest lifecycle of its own', () => {
    const repository = new ConversationThreadLifecycleRuntimeRepository(api(jest.fn()));
    expect(Object.getPrototypeOf(repository).constructor.name).toBe('ConversationThreadLifecycleRuntimeRepository');
    expect((Reflect as { getOwnMetadataKeys?: (target: unknown) => unknown[] }).getOwnMetadataKeys?.(ConversationThreadLifecycleRuntimeRepository) ?? []).toEqual([]);
    for (const method of ['readIntegratedBatchSnapshot', 'readRuntimeContext', 'readIdentityDossierPage', 'commitFinalizedExchangeWithThreadLifecycle'] as const) {
      expect(typeof repository[method]).toBe('function');
    }
  });
});
