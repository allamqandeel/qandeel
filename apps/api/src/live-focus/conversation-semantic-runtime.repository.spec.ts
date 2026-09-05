import { DataApiError } from '../conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { StaleConversationalFocusContextError } from '../conversational-focus/conversation-focus-runtime.types';
import { ConversationThreadIntegrityError } from '../thread-establishment/conversation-thread-runtime.types';
import { ConversationThreadLifecycleIntegrityError, StaleThreadIdentityContextError } from '../thread-lifecycle/conversation-thread-lifecycle-runtime.types';
import { ConversationSemanticRuntimeRepository } from './conversation-semantic-runtime.repository';
import { ConversationSemanticIntegrityError, type CommitFinalizedExchangeWithFullSemanticChainRequest } from './conversation-semantic-runtime.types';

const SESSION = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const TURN = '11111111-1111-4111-8111-111111111111';
const BATCH = '22222222-2222-4222-8222-222222222222';
const api = (rpc: jest.Mock) => ({ rpc } as unknown as SupabaseServiceRoleApiService);

const REQUEST: CommitFinalizedExchangeWithFullSemanticChainRequest = {
  sessionId: SESSION, userId: USER, userSourceTurnId: TURN, userBatchId: BATCH,
  userUnits: [{ unitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', spanStart: 0, spanEnd: 5 }], userFocusUnits: [], userThreadUnits: [], userLifecycleUnits: [], userLiveFocusUnits: [],
  assistantSourceTurnId: '55555555-5555-4555-8555-555555555555', assistantBatchId: '66666666-6666-4666-8666-666666666666',
  assistantUnits: [], assistantFocusUnits: [], assistantThreadUnits: [], assistantLifecycleUnits: [], assistantLiveFocusUnits: [],
  evaluatorVersion: 'cu-anchor-mapper-v1', policyVersion: 'stage-1.2-cu-commitment-v1', segmentationProvider: 'OPENAI',
  segmentationModel: 'gpt-5-mini', segmentationPromptVersion: 'cu-segmentation-anchored-v1',
  focusEvaluatorVersion: 'conversational-focus-evaluator-v1', focusPolicyVersion: 'stage-1.2-1.3-reference-attention-v1',
  focusProvider: 'OPENAI', focusModel: 'gpt-5-mini', focusPromptVersion: 'focus-resolution-anchored-v2', focusSchemaVersion: 1,
  threadEvaluatorVersion: 'thread-establishment-evaluator-v1', threadPolicyVersion: 'stage-1.3-thread-establishment-v1',
  threadProvider: 'OPENAI', threadModel: 'gpt-5-mini', threadPromptVersion: 'thread-establishment-evidence-path-v1', threadSchemaVersion: 1,
  continuityEvaluatorVersion: 'thread-continuity-evaluator-v1', continuityPolicyVersion: 'stage-1.3-thread-lifecycle-v1',
  continuityProvider: 'OPENAI', continuityModel: 'gpt-5-mini', continuityPromptVersion: 'thread-continuity-identity-v1', continuitySchemaVersion: 1,
  lifecycleReducerVersion: 'thread-lifecycle-reducer-v1', lfReducerVersion: 'live-focus-reducer-v1',
  expectedCurrentSp: null, expectedSameSpEventSequence: 0, expectedWorldThreadIdentityVersion: 0,
};
const ABSENT = {
  batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null,
  focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false,
  thread_capture_state: 'ABSENT', thread_batch_exists: false, thread_unit_count: 0, thread_establishment_count: 0,
  thread_semantic_capture_state: 'ABSENT', thread_semantic_batch_exists: false, thread_semantic_unit_count: 0, continuity_binding_count: 0, lifecycle_transition_count: 0,
  full_semantic_capture_state: 'ABSENT', live_focus_batch_exists: false, live_focus_unit_count: 0, live_focus_transition_count: 0,
  live_focus_transitions: [], session_live_focus_kind: 'NONE', session_live_focus_ref: null, session_live_focus_sp: null,
};
const EMPTY_CONTEXT = {
  base_current_sp: null, base_same_sp_event_sequence: '0', prior_cus: [], reference_handles: [], focus_candidates: [],
  current_focus_candidate_id: null, prior_focus_semantics: [], focus_attention_history: [], established_thread_bindings: [],
  world_thread_identity_version: '0', session_focus_thread_bindings: [], session_thread_lifecycle_history: [],
  current_live_focus_kind: 'NONE', current_live_focus_ref: null, current_live_focus_sp: null,
};
const COMMITTED = { live_head: 1, same_sp_event_sequence: '1', world_thread_identity_version: '0', live_focus_kind: 'NONE', live_focus_ref: null, live_focus_sp: null,
  user_units: [], assistant_units: [], user_event: null, assistant_event: null, live_focus_transitions: [] };

describe('ConversationSemanticRuntimeRepository (cases 45-49)', () => {
  it('45. calls exactly the two 0071 reads, the 0070 dossier page and the ONE 0071 coordinator, with no other mutation RPC', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce([ABSENT])
      .mockResolvedValueOnce([EMPTY_CONTEXT])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([COMMITTED]);
    const repository = new ConversationSemanticRuntimeRepository(api(rpc));
    await repository.readIntegratedBatchSnapshot({ sessionId: SESSION, userId: USER, sourceTurnId: TURN, batchId: BATCH });
    await repository.readRuntimeContext({ sessionId: SESSION, userId: USER });
    await repository.readIdentityDossierPage({ userId: USER, expectedWorldThreadIdentityVersion: 0, afterThreadId: null, limit: 32 });
    await repository.commitFinalizedExchangeWithFullSemanticChain(REQUEST);
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      'get_conversation_full_semantic_integrated_batch_snapshot_v1',
      'get_conversation_full_semantic_runtime_context_v1',
      'get_conversation_thread_identity_dossier_page_v1',
      'commit_finalized_exchange_with_full_semantic_chain_v1',
    ]);
  });

  it('46. the commit body carries identity, coordinates, the five canonical payloads, provenance and BOTH tokens - no SP, sequence, from value, label or Home', async () => {
    const rpc = jest.fn().mockResolvedValue([COMMITTED]);
    await new ConversationSemanticRuntimeRepository(api(rpc)).commitFinalizedExchangeWithFullSemanticChain(REQUEST);
    const body = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'p_assistant_batch_id', 'p_assistant_focus_units', 'p_assistant_lifecycle_units', 'p_assistant_live_focus_units', 'p_assistant_source_turn_id', 'p_assistant_thread_units', 'p_assistant_units',
      'p_continuity_evaluator_version', 'p_continuity_model', 'p_continuity_policy_version', 'p_continuity_prompt_version', 'p_continuity_provider', 'p_continuity_schema_version',
      'p_evaluator_version', 'p_expected_current_sp', 'p_expected_same_sp_event_sequence', 'p_expected_world_thread_identity_version',
      'p_focus_evaluator_version', 'p_focus_model', 'p_focus_policy_version', 'p_focus_prompt_version', 'p_focus_provider', 'p_focus_schema_version',
      'p_lf_reducer_version', 'p_lifecycle_reducer_version', 'p_policy_version', 'p_segmentation_model', 'p_segmentation_prompt_version', 'p_segmentation_provider', 'p_session_id',
      'p_thread_evaluator_version', 'p_thread_model', 'p_thread_policy_version', 'p_thread_prompt_version', 'p_thread_provider', 'p_thread_schema_version',
      'p_user_batch_id', 'p_user_focus_units', 'p_user_id', 'p_user_lifecycle_units', 'p_user_live_focus_units', 'p_user_source_turn_id', 'p_user_thread_units', 'p_user_units',
    ]);
    expect(body.p_lf_reducer_version).toBe('live-focus-reducer-v1');
    const wire = JSON.stringify(body);
    for (const forbidden of ['p_sp', 'p_session_position', 'p_same_sp_event_sequence', 'p_live_head', 'p_live_focus_kind', 'from_kind', 'placement', 'home_', 'label', 'expected_live_focus']) {
      expect(forbidden in body).toBe(false);
      expect(wire.includes(forbidden)).toBe(false);
    }
  });

  it('47. ONLY the two exact 40001 tokens become the two typed domain errors; LF adds no third stale authority', async () => {
    const focusStale = new DataApiError(500, { databaseCode: '40001', databaseMessage: 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' });
    await expect(new ConversationSemanticRuntimeRepository(api(jest.fn().mockRejectedValue(focusStale))).commitFinalizedExchangeWithFullSemanticChain(REQUEST))
      .rejects.toBeInstanceOf(StaleConversationalFocusContextError);
    const identityStale = new DataApiError(500, { databaseCode: '40001', databaseMessage: 'STALE_THREAD_IDENTITY_CONTEXT' });
    await expect(new ConversationSemanticRuntimeRepository(api(jest.fn().mockRejectedValue(identityStale))).commitFinalizedExchangeWithFullSemanticChain(REQUEST))
      .rejects.toBeInstanceOf(StaleThreadIdentityContextError);
    await expect(new ConversationSemanticRuntimeRepository(api(jest.fn().mockRejectedValue(identityStale))).readIdentityDossierPage({ userId: USER, expectedWorldThreadIdentityVersion: 0, afterThreadId: null, limit: 32 }))
      .rejects.toBeInstanceOf(StaleThreadIdentityContextError);
    for (const notStale of [
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'could not serialize access due to concurrent update' }),
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'STALE_LIVE_FOCUS_CONTEXT' }),
      new DataApiError(500, { databaseCode: '55000', databaseMessage: 'FULL_SEMANTIC_BATCH_INTEGRITY' }),
      new DataApiError(500, { databaseCode: '22023', databaseMessage: 'LIVE_FOCUS_NOT_CANONICAL' }),
      new DataApiError(500, { databaseCode: '40001', databaseMessage: 'wrapped: STALE_THREAD_IDENTITY_CONTEXT' }),
      new Error('STALE_CONVERSATIONAL_FOCUS_CONTEXT 40001'),
    ]) {
      await expect(new ConversationSemanticRuntimeRepository(api(jest.fn().mockRejectedValue(notStale))).commitFinalizedExchangeWithFullSemanticChain(REQUEST)).rejects.toBe(notStale);
    }
  });

  it('48. PostgREST JSON is never cast blindly: a malformed row fails closed as an integrity error', async () => {
    const badSnapshot = new ConversationSemanticRuntimeRepository(api(jest.fn().mockResolvedValue([{ ...ABSENT, session_live_focus_kind: 'READING' }])));
    await expect(badSnapshot.readIntegratedBatchSnapshot({ sessionId: SESSION, userId: USER, sourceTurnId: TURN, batchId: BATCH })).rejects.toBeInstanceOf(ConversationSemanticIntegrityError);
    const baseBad = new ConversationSemanticRuntimeRepository(api(jest.fn().mockResolvedValue([{ ...ABSENT, batch_exists: 'yes' }])));
    await expect(baseBad.readIntegratedBatchSnapshot({ sessionId: SESSION, userId: USER, sourceTurnId: TURN, batchId: BATCH })).rejects.toBeInstanceOf(ConversationThreadIntegrityError);
    const lifecycleBad = new ConversationSemanticRuntimeRepository(api(jest.fn().mockResolvedValue([{ ...ABSENT, thread_semantic_batch_exists: 'yes' }])));
    await expect(lifecycleBad.readIntegratedBatchSnapshot({ sessionId: SESSION, userId: USER, sourceTurnId: TURN, batchId: BATCH })).rejects.toBeInstanceOf(ConversationThreadLifecycleIntegrityError);
    const empty = new ConversationSemanticRuntimeRepository(api(jest.fn().mockResolvedValue([])));
    await expect(empty.readRuntimeContext({ sessionId: SESSION, userId: USER })).rejects.toBeInstanceOf(ConversationSemanticIntegrityError);
    const badCommit = new ConversationSemanticRuntimeRepository(api(jest.fn().mockResolvedValue([{ ...COMMITTED, live_focus_kind: 'THREAD' }])));
    await expect(badCommit.commitFinalizedExchangeWithFullSemanticChain(REQUEST)).rejects.toBeInstanceOf(ConversationSemanticIntegrityError);
    const partial = new ConversationSemanticRuntimeRepository(api(jest.fn().mockResolvedValue([{ ...ABSENT, batch_exists: true, thread_capture_state: 'PARTIAL', thread_semantic_capture_state: 'PARTIAL', full_semantic_capture_state: 'PARTIAL' }])));
    expect((await partial.readIntegratedBatchSnapshot({ sessionId: SESSION, userId: USER, sourceTurnId: TURN, batchId: BATCH })).full_semantic_capture_state).toBe('PARTIAL');
  });

  it('49. the repository is a plain class over the service-role channel, with no Nest lifecycle and no authenticated token', () => {
    const repository = new ConversationSemanticRuntimeRepository(api(jest.fn()));
    expect(Object.getPrototypeOf(repository).constructor.name).toBe('ConversationSemanticRuntimeRepository');
    expect((Reflect as { getOwnMetadataKeys?: (target: unknown) => unknown[] }).getOwnMetadataKeys?.(ConversationSemanticRuntimeRepository) ?? []).toEqual([]);
    for (const method of ['readIntegratedBatchSnapshot', 'readRuntimeContext', 'readIdentityDossierPage', 'commitFinalizedExchangeWithFullSemanticChain'] as const) {
      expect(typeof repository[method]).toBe('function');
    }
  });
});
