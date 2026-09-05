import type { ConversationTurn, OrchestratedTurnResult } from '../conversation/conversation.types';
import { DataApiError } from '../conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import type { CuSegmentationBinding } from '../conversation-unit/conversation-temporal-establishment.service';
import type { CommittedConversationUnit } from '../conversation-unit/conversation-unit.types';
import type { SourceAnchor } from '../conversation-unit/cu-anchor-mapper';
import { CuSegmentationProviderError, type CuSegmentationProvider, type CuSegmentationRequest } from '../conversation-unit/cu-segmentation-provider.types';
import { automaticCommitBatchId, automaticCommitUnitId } from '../conversation-unit/deterministic-runtime-id';
import { StaleConversationalFocusContextError } from '../conversational-focus/conversation-focus-runtime.types';
import { PREPARED_ID_PREFIX } from '../conversational-focus/conversational-focus-evaluator.service';
import { durableEmergingFocusId, durableReferenceHandleId } from '../conversational-focus/durable-focus-canonicalizer';
import type { FocusResolutionBinding } from '../conversational-focus/focus-resolution-binding';
import { FocusResolutionProviderError, type FocusResolutionProposal, type FocusResolutionProvider, type FocusResolutionRequest } from '../conversational-focus/focus-resolution-provider.types';
import { durableThreadId } from '../thread-establishment/durable-thread-canonicalizer';
import type { ThreadEstablishmentBinding } from '../thread-establishment/thread-establishment-binding';
import { ThreadEstablishmentProviderError, type ThreadEstablishmentProposal, type ThreadEstablishmentProvider, type ThreadEstablishmentRequest } from '../thread-establishment/thread-establishment-provider.types';
import { assertContinuityProvenanceAgreement, ConversationThreadLifecycleEstablishmentService } from './conversation-thread-lifecycle-establishment.service';
import { ConversationThreadLifecycleRuntimeRepository, type ConversationThreadLifecycleRuntimeBoundary } from './conversation-thread-lifecycle-runtime.repository';
import {
  ConversationThreadLifecycleIntegrityError,
  ConversationThreadLifecycleUnavailableError,
  StaleThreadIdentityContextError,
  type CommitFinalizedExchangeWithThreadLifecycleRequest,
  type ConversationThreadLifecycleRuntimeContext,
  type FinalizedExchangeWithThreadLifecycleResult,
  type IntegratedThreadLifecycleBatchSnapshot,
  type ThreadIdentityDossierPageRequest,
} from './conversation-thread-lifecycle-runtime.types';
import { durableThreadFocusBindingId, durableThreadLifecycleEventId } from './durable-thread-lifecycle-canonicalizer';
import { FakeThreadContinuityProvider } from './fake-thread-continuity.provider';
import { openAiThreadContinuityBinding, type ThreadContinuityBinding } from './thread-continuity-binding';
import { ThreadContinuityProviderError, type ThreadContinuityProvider, type ThreadContinuityResolutionProposal } from './thread-continuity-provider.types';
import type { ThreadIdentityDossier } from './thread-continuity.types';

const SESSION = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const USER_TURN = '11111111-1111-4111-8111-111111111111';
const ASSISTANT_TURN = '22222222-2222-4222-8222-222222222222';
const USER_CONTENT = 'أحمد بقى بيقلقني. المدير بتاع أحمد كمان بقى غريب.';
const ASSISTANT_CONTENT = 'تقصد إن أحمد اتغير؟ وإمتى؟';
const U1 = 'أحمد بقى بيقلقني.';
const U2 = 'المدير بتاع أحمد كمان بقى غريب.';
const A1 = 'تقصد إن أحمد اتغير؟';
const A2 = 'وإمتى؟';
const USER_BATCH = automaticCommitBatchId(USER_TURN);
const ASSISTANT_BATCH = automaticCommitBatchId(ASSISTANT_TURN);

const points = (value: string) => Array.from(value);
const spanOf = (content: string, excerpt: string) => {
  const source = points(content);
  const needle = points(excerpt);
  for (let start = 0; start + needle.length <= source.length; start += 1) {
    if (needle.every((ch, offset) => source[start + offset] === ch)) return { start, end: start + needle.length };
  }
  throw new Error(`fixture excerpt not found: ${excerpt}`);
};
const unitId = (batch: string, index: number, content: string, excerpt: string) =>
  automaticCommitUnitId(batch, { index, spanStart: spanOf(content, excerpt).start, spanEnd: spanOf(content, excerpt).end });
const U1_ID = unitId(USER_BATCH, 0, USER_CONTENT, U1);
const U2_ID = unitId(USER_BATCH, 1, USER_CONTENT, U2);
const A1_ID = unitId(ASSISTANT_BATCH, 0, ASSISTANT_CONTENT, A1);
const A2_ID = unitId(ASSISTANT_BATCH, 1, ASSISTANT_CONTENT, A2);

/** The durable identities the canonicalizers derive for this exact scenario. */
const H_AHMED = durableReferenceHandleId(SESSION, U1_ID, 0);
const F_AHMED = durableEmergingFocusId(SESSION, U1_ID);
const T_AHMED = durableThreadId(USER, F_AHMED);
const F_MANAGER = durableEmergingFocusId(SESSION, U2_ID);
const T_MANAGER = durableThreadId(USER, F_MANAGER);
/** An existing user/world Thread of an EARLIER Session (Ahmed the colleague) and its dossier. */
const OLD_SESSION = '55555555-5555-4555-8555-555555555555';
const OLD_CU = '66666666-6666-4666-8666-666666666666';
const T_OLD_AHMED = '77777777-7777-5777-8777-777777777777';
const T_OLD_BROTHER = '88888888-8888-5888-8888-888888888888';
const dossierOf = (threadId: string, surface = 'أحمد'): ThreadIdentityDossier => ({
  threadId, identityEvidence: [{ sessionId: OLD_SESSION, cuId: OLD_CU, exactSurface: surface, committedCuText: `${surface} نفسه بدأ يقلقني.`, sourceRole: 'USER' }],
});

function turn(overrides: Partial<ConversationTurn> = {}): ConversationTurn {
  return {
    id: USER_TURN, session_id: SESSION, role: 'USER', status: 'COMPLETED', content: USER_CONTENT,
    processing_path: 'FAST', routing_reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT', source_turn_id: null,
    idempotency_key: null, created_at: 'now', updated_at: 'now', completed_at: 'now',
    ...overrides,
  };
}
const userTurn = turn();
const assistantTurn = turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', content: ASSISTANT_CONTENT, source_turn_id: USER_TURN });
const exchange: OrchestratedTurnResult = { userTurn, assistantTurn };

class RoleScriptedSegmentation implements CuSegmentationProvider {
  readonly requests: CuSegmentationRequest[] = [];
  constructor(private readonly script: { USER: readonly SourceAnchor[] | CuSegmentationProviderError; ASSISTANT: readonly SourceAnchor[] | CuSegmentationProviderError }) {}
  async propose(request: CuSegmentationRequest): Promise<{ units: readonly SourceAnchor[] }> {
    this.requests.push(request);
    const answer = this.script[request.sourceRole];
    if (answer instanceof CuSegmentationProviderError) throw answer;
    return { units: answer };
  }
}
const SEGMENTS = {
  USER: [{ text: U1, occurrence: 1 }, { text: U2, occurrence: 1 }],
  ASSISTANT: [{ text: A1, occurrence: 1 }, { text: A2, occurrence: 1 }],
} as const;
const NO_SEGMENTS = { USER: [], ASSISTANT: [] } as const;

class RecordingFocusProvider implements FocusResolutionProvider {
  readonly requests: FocusResolutionRequest[] = [];
  constructor(private readonly answer: (request: FocusResolutionRequest) => FocusResolutionProposal | FocusResolutionProviderError) {}
  async propose(request: FocusResolutionRequest): Promise<FocusResolutionProposal> {
    this.requests.push(JSON.parse(JSON.stringify(request)) as FocusResolutionRequest);
    await new Promise((resolve) => setTimeout(resolve, 1));
    const answer = this.answer(request);
    if (answer instanceof FocusResolutionProviderError) throw answer;
    return answer;
  }
}
class RecordingThreadProvider implements ThreadEstablishmentProvider {
  readonly requests: ThreadEstablishmentRequest[] = [];
  constructor(private readonly answer: (request: ThreadEstablishmentRequest) => ThreadEstablishmentProposal | ThreadEstablishmentProviderError) {}
  async propose(request: ThreadEstablishmentRequest): Promise<ThreadEstablishmentProposal> {
    this.requests.push(JSON.parse(JSON.stringify(request)) as ThreadEstablishmentRequest);
    await new Promise((resolve) => setTimeout(resolve, 1));
    const answer = this.answer(request);
    if (answer instanceof ThreadEstablishmentProviderError) throw answer;
    return answer;
  }
}

const NO_FOCUS: FocusResolutionProposal = {
  functions: ['INFORM_REPORT'], sequencePosition: 'UNMARKED', targetCuId: null, references: [], claimAttributions: [],
  attention: { kind: 'NO_INDEPENDENT_FOCUS', existingFocusCandidateId: null, groundingAnchor: null, reason: 'INCIDENTAL_OR_SUBORDINATE' },
};
/**
 * USER CU1 first grounds Ahmed and starts his focus; USER CU2 grounds the
 * manager as a NEW reference and starts the manager's focus (an explicit
 * shift away from Ahmed), and ALSO resolves Ahmed through the handle CU1
 * created; ASSISTANT CU1 attends Ahmed's focus (a return); ASSISTANT CU2 has
 * no independent focus.
 */
const FOCUS_SCENARIO = (request: FocusResolutionRequest): FocusResolutionProposal => {
  if (request.currentCu.cuId === U1_ID) {
    return {
      ...NO_FOCUS,
      references: [{ anchor: { text: 'أحمد', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: null, candidateHandleIds: [], newReference: true }],
      attention: { kind: 'START_NEW_FOCUS', existingFocusCandidateId: null, groundingAnchor: { text: 'أحمد', occurrence: 1 }, reason: 'DIRECT_SUBJECT' },
    };
  }
  if (request.currentCu.cuId === U2_ID) {
    return {
      ...NO_FOCUS, functions: ['INFORM_REPORT', 'FOCUS_SHIFT'],
      references: [
        { anchor: { text: 'المدير', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: null, candidateHandleIds: [], newReference: true },
        { anchor: { text: 'أحمد', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: `${PREPARED_ID_PREFIX}reference:${U1_ID}:0`, candidateHandleIds: [], newReference: false },
      ],
      attention: { kind: 'START_NEW_FOCUS', existingFocusCandidateId: null, groundingAnchor: { text: 'المدير', occurrence: 1 }, reason: 'EXPLICIT_FOCUS_SHIFT' },
    };
  }
  if (request.currentCu.cuId === A1_ID) {
    return {
      ...NO_FOCUS, functions: ['ASK'], sequencePosition: 'RESPONSIVE', targetCuId: U1_ID,
      references: [{ anchor: { text: 'أحمد', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: `${PREPARED_ID_PREFIX}reference:${U1_ID}:0`, candidateHandleIds: [], newReference: false }],
      attention: { kind: 'ATTEND_EXISTING_FOCUS', existingFocusCandidateId: `${PREPARED_ID_PREFIX}focus:${U1_ID}`, groundingAnchor: null, reason: 'DIRECT_REQUEST_OR_QUESTION' },
    };
  }
  return NO_FOCUS;
};
const THREAD_SCENARIO = (request: ThreadEstablishmentRequest): ThreadEstablishmentProposal => {
  if (request.currentCu.cuId === U1_ID) {
    return { decision: 'ESTABLISH_THREAD', path: 'TE-01', evidenceCuIds: [U1_ID], explicitSelectionAnchor: { text: 'أحمد', occurrence: 1 } };
  }
  if (request.currentCu.cuId === U2_ID) {
    return { decision: 'ESTABLISH_THREAD', path: 'TE-01', evidenceCuIds: [U2_ID], explicitSelectionAnchor: { text: 'المدير', occurrence: 1 } };
  }
  return { decision: 'NO_ESTABLISHMENT', path: null, evidenceCuIds: [], explicitSelectionAnchor: null };
};
const DISTINCT: ThreadContinuityResolutionProposal = { decision: 'DISTINCT_NEW', threadId: null, candidateThreadIds: [], currentEvidenceReferenceIndexes: [], priorEvidenceRefs: [] };

const segmentationBinding = (provider: CuSegmentationProvider): CuSegmentationBinding => ({ provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' });
const focusBinding = (provider: FocusResolutionProvider): FocusResolutionBinding => ({ provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' });
const threadBinding = (provider: ThreadEstablishmentProvider): ThreadEstablishmentBinding => ({ provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' });
const continuityBinding = (provider: ThreadContinuityProvider): ThreadContinuityBinding => ({ provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' });

const EMPTY_CONTEXT: ConversationThreadLifecycleRuntimeContext = {
  sessionId: SESSION, token: { currentSp: null, sameSpEventSequence: 0 },
  priorContext: { priorCus: [], referenceHandles: [], focusCandidates: [], currentFocusCandidateId: null },
  priorFocusSemantics: [], focusAttentionHistory: [], establishedThreadBindings: [],
  worldThreadIdentityVersion: 0, sessionFocusThreadBindings: [], sessionThreadLifecycleHistory: [],
};
const absent = (overrides: Partial<IntegratedThreadLifecycleBatchSnapshot> = {}): IntegratedThreadLifecycleBatchSnapshot => ({
  batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null,
  focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false,
  thread_capture_state: 'ABSENT', thread_batch_exists: false, thread_unit_count: 0, thread_establishment_count: 0,
  thread_semantic_capture_state: 'ABSENT', thread_semantic_batch_exists: false, thread_semantic_unit_count: 0, continuity_binding_count: 0, lifecycle_transition_count: 0,
  ...overrides,
});
function unit(batchId: string, index: number, sp: number, role: 'USER' | 'ASSISTANT', spanStart = index * 10, spanEnd = index * 10 + 5): CommittedConversationUnit {
  return {
    id: automaticCommitUnitId(batchId, { index, spanStart, spanEnd }), user_id: USER, session_id: SESSION,
    source_turn_id: role === 'USER' ? USER_TURN : ASSISTANT_TURN, commit_batch_id: batchId, source_role: role, speaker_state: 'RESOLVED',
    source_modality: 'TEXT', ordinal_within_turn: index, source_span_start: spanStart, source_span_end: spanEnd,
    committed_text: 'x'.repeat(spanEnd - spanStart), source_content_sha256: 'deadbeef', session_position: sp, created_at: 'now',
  };
}
function complete(batchId: string, role: 'USER' | 'ASSISTANT', firstSp: number, count: number, liveHead: number | null, overrides: Partial<IntegratedThreadLifecycleBatchSnapshot> = {}): IntegratedThreadLifecycleBatchSnapshot {
  const units = Array.from({ length: count }, (_v, index) => unit(batchId, index, firstSp + index, role));
  return {
    batch_exists: true, committed_unit_count: count, units,
    commit_event: count === 0 ? null : { commit_batch_id: batchId, user_id: USER, session_id: SESSION, source_turn_id: role === 'USER' ? USER_TURN : ASSISTANT_TURN, first_sp: firstSp, last_sp: firstSp + count - 1, unit_count: count, created_at: 'now' },
    source_frontier: count * 10, live_head: liveHead,
    focus_batch_exists: true, focus_semantic_count: count, focus_attention_count: count, focus_complete: true,
    thread_capture_state: 'COMPLETE', thread_batch_exists: true, thread_unit_count: count, thread_establishment_count: 0,
    thread_semantic_capture_state: 'COMPLETE', thread_semantic_batch_exists: true, thread_semantic_unit_count: count, continuity_binding_count: 0, lifecycle_transition_count: 0,
    ...overrides,
  };
}

interface Harness {
  snapshots: (batchId: string, call: number) => IntegratedThreadLifecycleBatchSnapshot;
  contexts: (call: number) => ConversationThreadLifecycleRuntimeContext;
  dossiers: (request: ThreadIdentityDossierPageRequest, call: number) => readonly ThreadIdentityDossier[];
  commit: (request: CommitFinalizedExchangeWithThreadLifecycleRequest, call: number) => Promise<FinalizedExchangeWithThreadLifecycleResult>;
}
function defaultCommit(request: CommitFinalizedExchangeWithThreadLifecycleRequest): FinalizedExchangeWithThreadLifecycleResult {
  const u = request.userUnits.length;
  const a = request.assistantUnits.length;
  return {
    live_head: u + a === 0 ? null : u + a,
    same_sp_event_sequence: u + a === 0 ? 0 : 2,
    world_thread_identity_version: request.expectedWorldThreadIdentityVersion,
    user_units: request.userUnits.map((p, i) => unit(request.userBatchId, i, i + 1, 'USER', p.spanStart, p.spanEnd)),
    assistant_units: request.assistantUnits.map((p, i) => unit(request.assistantBatchId, i, u + i + 1, 'ASSISTANT', p.spanStart, p.spanEnd)),
    user_event: u === 0 ? null : { commit_batch_id: request.userBatchId, user_id: USER, session_id: SESSION, source_turn_id: USER_TURN, first_sp: 1, last_sp: u, unit_count: u, created_at: 'now' },
    assistant_event: a === 0 ? null : { commit_batch_id: request.assistantBatchId, user_id: USER, session_id: SESSION, source_turn_id: ASSISTANT_TURN, first_sp: u + 1, last_sp: u + a, unit_count: a, created_at: 'now' },
  };
}
function harness(overrides: Partial<Harness> = {}) {
  const calls: string[] = [];
  let snapshotCalls = 0;
  let contextCalls = 0;
  let dossierCalls = 0;
  let commitCalls = 0;
  const commitRequests: CommitFinalizedExchangeWithThreadLifecycleRequest[] = [];
  const dossierRequests: ThreadIdentityDossierPageRequest[] = [];
  const readIntegratedBatchSnapshot = jest.fn(async ({ batchId }: { batchId: string }) => {
    calls.push(`snapshot:${batchId === USER_BATCH ? 'USER' : 'ASSISTANT'}`);
    snapshotCalls += 1;
    return (overrides.snapshots ?? (() => absent()))(batchId, Math.ceil(snapshotCalls / 2));
  });
  const readRuntimeContext = jest.fn(async () => {
    calls.push('context');
    contextCalls += 1;
    return (overrides.contexts ?? (() => EMPTY_CONTEXT))(contextCalls);
  });
  const readIdentityDossierPage = jest.fn(async (request: ThreadIdentityDossierPageRequest) => {
    calls.push('dossiers');
    dossierCalls += 1;
    dossierRequests.push(request);
    return (overrides.dossiers ?? (() => []))(request, dossierCalls);
  });
  const commitFinalizedExchangeWithThreadLifecycle = jest.fn(async (request: CommitFinalizedExchangeWithThreadLifecycleRequest) => {
    calls.push('commit');
    commitCalls += 1;
    commitRequests.push(request);
    return (overrides.commit ?? (async (r) => defaultCommit(r)))(request, commitCalls);
  });
  const boundary: ConversationThreadLifecycleRuntimeBoundary = { readIntegratedBatchSnapshot, readRuntimeContext, readIdentityDossierPage, commitFinalizedExchangeWithThreadLifecycle };
  return { boundary, calls, commitRequests, dossierRequests, readIntegratedBatchSnapshot, readRuntimeContext, readIdentityDossierPage, commitFinalizedExchangeWithThreadLifecycle };
}
function build(
  h = harness(),
  segmentation = new RoleScriptedSegmentation(SEGMENTS),
  focus = new RecordingFocusProvider(FOCUS_SCENARIO),
  thread = new RecordingThreadProvider(THREAD_SCENARIO),
  continuity = FakeThreadContinuityProvider.nominatingAll(DISTINCT),
) {
  const segmentationFactory = jest.fn(() => segmentationBinding(segmentation));
  const focusFactory = jest.fn(() => focusBinding(focus));
  const threadFactory = jest.fn(() => threadBinding(thread));
  const continuityFactory = jest.fn(() => continuityBinding(continuity));
  const service = new ConversationThreadLifecycleEstablishmentService(h.boundary, segmentationFactory, focusFactory, threadFactory, continuityFactory);
  return { service, h, segmentation, focus, thread, continuity, segmentationFactory, focusFactory, threadFactory, continuityFactory };
}
const rejection = async (promise: Promise<unknown>) => {
  try { await promise; } catch (error) { return error; }
  throw new Error('expected a rejection');
};
const integrity = async (promise: Promise<unknown>) => {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(ConversationThreadLifecycleIntegrityError);
  return (error as ConversationThreadLifecycleIntegrityError).reason;
};
const unavailable = async (promise: Promise<unknown>) => {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(ConversationThreadLifecycleUnavailableError);
  return (error as ConversationThreadLifecycleUnavailableError).reason;
};
const providerCounts = (b: ReturnType<typeof build>) => [b.segmentation.requests.length, b.focus.requests.length, b.thread.requests.length, b.continuity.screeningRequests.length, b.continuity.resolutionRequests.length];
/** A later-Session context: an earlier Session established T_OLD_AHMED, this Session is fresh. */
const worldWithOldAhmed = (extra: readonly ThreadIdentityDossier[] = []) => harness({
  contexts: () => ({ ...EMPTY_CONTEXT, worldThreadIdentityVersion: 3 }),
  dossiers: () => [dossierOf(T_OLD_AHMED), ...extra].sort((a, b) => (a.threadId < b.threadId ? -1 : 1)),
});
const bindOld = (threadId: string): ThreadContinuityResolutionProposal => ({ decision: 'BIND_EXISTING', threadId, candidateThreadIds: [], currentEvidenceReferenceIndexes: [0], priorEvidenceRefs: [{ cuId: OLD_CU, exactSurface: 'أحمد' }] });
const NO_THREAD = new RecordingThreadProvider(() => ({ decision: 'NO_ESTABLISHMENT', path: null, evidenceCuIds: [], explicitSelectionAnchor: null }));

describe('relation gate, replay and capture-state gate (cases 64-69)', () => {
  it('64. an invalid finalized relation costs zero providers, zero reads and zero writes; the direct boundary refuses non-COMPLETED turns first and outside the try', async () => {
    for (const bad of [
      turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', source_turn_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
      turn({ id: ASSISTANT_TURN, role: 'USER', source_turn_id: USER_TURN }),
      turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', session_id: '55555555-5555-4555-8555-555555555555', source_turn_id: USER_TURN }),
    ]) {
      const b = build();
      expect(await integrity(b.service.establish(USER, { userTurn, assistantTurn: bad }))).toBe('INVALID_FINALIZED_EXCHANGE_RELATION');
      expect(b.h.calls).toEqual([]);
      expect(providerCounts(b)).toEqual([0, 0, 0, 0, 0]);
      expect([b.segmentationFactory, b.focusFactory, b.threadFactory, b.continuityFactory].every((f) => f.mock.calls.length === 0)).toBe(true);
    }
    for (const [userStatus, assistantStatus] of [['GENERATING', 'COMPLETED'], ['COMPLETED', 'GENERATING'], ['FAILED', 'COMPLETED'], ['COMPLETED', 'FAILED'], ['GENERATING', 'FAILED'], ['FAILED', 'GENERATING']] as const) {
      const b = build();
      const badUser = turn({ status: userStatus });
      const badAssistant = turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', content: ASSISTANT_CONTENT, source_turn_id: USER_TURN, status: assistantStatus });
      const before = JSON.stringify([badUser, badAssistant]);
      expect(await integrity(b.service.establishExchange(USER, badUser, badAssistant))).toBe('INVALID_FINALIZED_EXCHANGE_RELATION');
      expect(b.h.calls).toEqual([]);
      expect(JSON.stringify([badUser, badAssistant])).toBe(before);
      const error = await rejection(b.service.establishExchange(USER, badUser, badAssistant));
      expect(error).not.toBeInstanceOf(ConversationThreadLifecycleUnavailableError);
    }
    const { service } = build();
    const pending = { userTurn, assistantTurn: turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', status: 'GENERATING' as never, source_turn_id: USER_TURN }) };
    expect(await service.establish(USER, pending)).toBe(pending);
  });

  it('65. COMPLETE + COMPLETE at the FINAL Thread layer is canonical replay: stored delivery, zero providers, zero context, zero dossiers', async () => {
    const b = build(harness({
      snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4, { thread_establishment_count: 1, continuity_binding_count: 1, lifecycle_transition_count: 2 }) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4),
    }));
    const result = await b.service.establish(USER, exchange);
    expect(result.temporal).toEqual({ liveHead: 4, committedEvents: [
      expect.objectContaining({ type: 'CONVERSATIONAL_UNITS_COMMITTED', version: 1, firstSp: 1, lastSp: 2, unitCount: 2, sourceTurnId: USER_TURN }),
      expect.objectContaining({ firstSp: 3, lastSp: 4, unitCount: 2, sourceTurnId: ASSISTANT_TURN }),
    ] });
    expect(providerCounts(b)).toEqual([0, 0, 0, 0, 0]);
    expect(b.h.calls).toEqual(['snapshot:USER', 'snapshot:ASSISTANT']);
    expect([b.segmentationFactory, b.focusFactory, b.threadFactory, b.continuityFactory].every((f) => f.mock.calls.length === 0)).toBe(true);
  });

  it('66. a committed zero-CU pair that is B3-complete replays with zero providers', async () => {
    const b = build(harness({ snapshots: (batchId) => complete(batchId, batchId === USER_BATCH ? 'USER' : 'ASSISTANT', 1, 0, null) }));
    expect((await b.service.establish(USER, exchange)).temporal).toEqual({ liveHead: null, committedEvents: [] });
    expect(providerCounts(b)).toEqual([0, 0, 0, 0, 0]);
  });

  it('67. one canonical half and one absent half fails closed before any provider', async () => {
    const b = build(harness({ snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 2) : absent() }));
    expect(await integrity(b.service.establish(USER, exchange))).toBe('PARTIAL_INTEGRATED_EXCHANGE');
    expect(providerCounts(b)).toEqual([0, 0, 0, 0, 0]);
    expect(b.h.readRuntimeContext).not.toHaveBeenCalled();
  });

  it('68. every PARTIAL shape - legacy T-03A2-only, B1-only, B2-only, B2b3-only (0068 COMPLETE without 0070), corrupt B3 - fails closed before providers', async () => {
    for (const partial of [
      { thread_semantic_capture_state: 'PARTIAL' as const, thread_capture_state: 'PARTIAL' as const, focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false, thread_batch_exists: false, thread_unit_count: 0, thread_semantic_batch_exists: false, thread_semantic_unit_count: 0 },
      { thread_semantic_capture_state: 'PARTIAL' as const, thread_capture_state: 'PARTIAL' as const, thread_batch_exists: false, thread_unit_count: 0, thread_semantic_batch_exists: false, thread_semantic_unit_count: 0 },
      { thread_semantic_capture_state: 'PARTIAL' as const, thread_semantic_batch_exists: false, thread_semantic_unit_count: 0 },
      { thread_semantic_capture_state: 'PARTIAL' as const },
    ]) {
      const b = build(harness({ snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4, partial) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4) }));
      expect(await integrity(b.service.establish(USER, exchange))).toBe('INCOMPLETE_THREAD_LIFECYCLE_CAPTURE');
      expect(providerCounts(b)).toEqual([0, 0, 0, 0, 0]);
      expect(b.h.commitFinalizedExchangeWithThreadLifecycle).not.toHaveBeenCalled();
    }
  });

  it('69. a canonical replay whose stored delivery is incoherent fails closed rather than being served', async () => {
    for (const [override, bothHalves, reason] of [
      [{ live_head: 1 }, true, 'LIVE_HEAD_NOT_ESTABLISHED'],
      [{ commit_event: null }, false, 'COMMITTED_WITHOUT_DELIVERY_EVENT'],
      [{ commit_event: { commit_batch_id: USER_BATCH, user_id: USER, session_id: SESSION, source_turn_id: USER_TURN, first_sp: 1, last_sp: 9, unit_count: 2, created_at: 'now' } }, false, 'DELIVERY_RANGE_MISMATCH'],
    ] as const) {
      const b = build(harness({
        snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4, override) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4, bothHalves ? override : {}),
      }));
      expect(await integrity(b.service.establish(USER, exchange))).toBe(reason);
    }
  });
});

describe('the finalized-exchange final Thread-layer chain (cases 70-81)', () => {
  it('70. the whole chain runs in exactly one order with exactly one coordinator call; a first-Session world needs no dossier page', async () => {
    const b = build();
    await b.service.establish(USER, exchange);
    expect(b.h.calls).toEqual(['snapshot:USER', 'snapshot:ASSISTANT', 'context', 'dossiers', 'commit']);
    expect(b.h.commitFinalizedExchangeWithThreadLifecycle).toHaveBeenCalledTimes(1);
    expect(b.h.readRuntimeContext).toHaveBeenCalledTimes(1);
    // An empty world: the dossier page is read ONCE for the whole exchange, and zero continuity calls happen.
    expect(b.h.readIdentityDossierPage).toHaveBeenCalledTimes(1);
    expect(b.h.dossierRequests[0]).toEqual({ userId: USER, expectedWorldThreadIdentityVersion: 0, afterThreadId: null, limit: 32 });
    expect([b.continuity.screeningRequests.length, b.continuity.resolutionRequests.length]).toEqual([0, 0]);
  });

  it('71. B1 then the Thread layer are strictly sequential USER -> ASSISTANT with no hindsight, and every provider sees only earlier material', async () => {
    const b = build(worldWithOldAhmed(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(THREAD_SCENARIO), FakeThreadContinuityProvider.nominatingAll(DISTINCT));
    await b.service.establish(USER, exchange);
    expect(b.focus.requests.map((request) => request.currentCu.cuId)).toEqual([U1_ID, U2_ID, A1_ID, A2_ID]);
    expect(b.continuity.screeningRequests.map((request) => request.currentCu.cuId)).toEqual([U1_ID, U2_ID]);
    expect(b.thread.requests.map((request) => request.currentCu.cuId)).toEqual([U1_ID, U2_ID]);
    const all = [U1_ID, U2_ID, A1_ID, A2_ID];
    for (const [index, request] of b.continuity.screeningRequests.entries()) {
      const seen = JSON.stringify(request);
      for (const id of all.slice(all.indexOf(request.currentCu.cuId) + 1)) expect(seen.includes(id)).toBe(false);
      expect(index).toBeLessThan(2);
    }
    expect(b.continuity.maxInFlight).toBe(1);
  });

  it('72. a first-Session establishment: ESTABLISH_NEW with an ESTABLISHMENT binding, derived identity evidence, and the explicit shift makes Ahmed DORMANT at the same CU', async () => {
    const b = build();
    await b.service.establish(USER, exchange);
    const [request] = b.h.commitRequests;
    expect(request.userThreadUnits.map((u) => [u.decision, u.thread_id])).toEqual([['ESTABLISH_THREAD', T_AHMED], ['ESTABLISH_THREAD', T_MANAGER]]);
    expect(request.userLifecycleUnits[0]).toEqual({
      unit_id: U1_ID, outcome: 'ESTABLISH_NEW', emerging_focus_id: F_AHMED, thread_id: T_AHMED, binding_kind: 'ESTABLISHMENT',
      focus_binding_id: durableThreadFocusBindingId(SESSION, F_AHMED, T_AHMED), identity_evidence: [{ cu_id: U1_ID, reference_index: 0 }],
      prior_identity_evidence: [], candidate_thread_ids: [], lifecycle_transitions: [],
    });
    expect(request.userLifecycleUnits[1]).toEqual({
      unit_id: U2_ID, outcome: 'ESTABLISH_NEW', emerging_focus_id: F_MANAGER, thread_id: T_MANAGER, binding_kind: 'ESTABLISHMENT',
      focus_binding_id: durableThreadFocusBindingId(SESSION, F_MANAGER, T_MANAGER), identity_evidence: [{ cu_id: U2_ID, reference_index: 0 }],
      prior_identity_evidence: [], candidate_thread_ids: [],
      lifecycle_transitions: [{ thread_id: T_AHMED, to_state: 'DORMANT', reason_code: 'EXPLICIT_FOCUS_SHIFT', lifecycle_event_id: durableThreadLifecycleEventId(SESSION, U2_ID, T_AHMED, 'DORMANT') }],
    });
    // The assistant's return to DORMANT Ahmed reopens it; the last CU has no focus and no transition.
    expect(request.assistantLifecycleUnits[0]).toMatchObject({
      unit_id: A1_ID, outcome: 'REOPEN_EXISTING', emerging_focus_id: F_AHMED, thread_id: T_AHMED, binding_kind: null, focus_binding_id: null,
      lifecycle_transitions: [{ thread_id: T_AHMED, to_state: 'REOPENED', reason_code: 'GENUINE_RETURN', lifecycle_event_id: durableThreadLifecycleEventId(SESSION, A1_ID, T_AHMED, 'REOPENED') }],
    });
    expect(request.assistantLifecycleUnits[1]).toMatchObject({ unit_id: A2_ID, outcome: 'NO_THREAD_ACTION', emerging_focus_id: null, thread_id: null, lifecycle_transitions: [] });
    // The B2 layer of the same-exchange bound focus is the frozen ALREADY_ESTABLISHED, deterministic.
    expect(request.assistantThreadUnits[0]).toMatchObject({ decision: 'NO_ESTABLISHMENT', no_establishment_reason: 'ALREADY_ESTABLISHED', emerging_focus_id: F_AHMED });
    expect(b.thread.requests.map((r) => r.currentCu.cuId)).toEqual([U1_ID, U2_ID]);
    // The manager Thread established at U2 has the Ahmed Thread as its grounded Origin, and only after U1.
    expect(request.userThreadUnits[1]).toMatchObject({ origin_state: 'RESOLVED', origin_thread_ids: [T_AHMED] });
    expect(request.userThreadUnits[0].origin_thread_ids).toEqual([]);
  });

  it('73. a same-Session already-bound focus avoids the continuity provider, the dossier read and the B2 provider', async () => {
    const b = build(worldWithOldAhmed());
    await b.service.establish(USER, exchange);
    // U1 and U2 screen (unbound new focuses); A1 attends the bound Ahmed focus: no screening, no resolution.
    expect(b.continuity.screeningRequests.map((r) => r.currentCu.cuId)).toEqual([U1_ID, U2_ID]);
    expect(b.h.readIdentityDossierPage).toHaveBeenCalledTimes(1);
    expect(b.thread.requests.map((r) => r.currentCu.cuId)).toEqual([U1_ID, U2_ID]);
  });

  it('74. cross-Session continuity: the same canonical Thread is reused with a SESSION_CONTINUITY binding, ACTIVE baseline, no B2 call, no Home', async () => {
    const continuity = new FakeThreadContinuityProvider(
      (request) => ({ possibleSameThreadIds: request.candidates.map((c) => c.threadId) }),
      (request) => request.currentCu.cuId === U1_ID ? bindOld(T_OLD_AHMED) : DISTINCT,
    );
    const b = build(worldWithOldAhmed(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(THREAD_SCENARIO), continuity);
    await b.service.establish(USER, exchange);
    const [request] = b.h.commitRequests;
    expect(request.userLifecycleUnits[0]).toEqual({
      unit_id: U1_ID, outcome: 'ACTIVATE_EXISTING_IN_SESSION', emerging_focus_id: F_AHMED, thread_id: T_OLD_AHMED, binding_kind: 'SESSION_CONTINUITY',
      focus_binding_id: durableThreadFocusBindingId(SESSION, F_AHMED, T_OLD_AHMED), identity_evidence: [{ cu_id: U1_ID, reference_index: 0 }],
      prior_identity_evidence: [{ cu_id: OLD_CU, exact_surface: 'أحمد' }], candidate_thread_ids: [], lifecycle_transitions: [],
    });
    // No new Thread for Ahmed: the B2 layer records the frozen no-promotion, and B2a was never asked about U1.
    expect(request.userThreadUnits[0]).toMatchObject({ decision: 'NO_ESTABLISHMENT', no_establishment_reason: 'NO_PROMOTION_PATH_PROVEN', emerging_focus_id: F_AHMED, thread_id: null, home_anchor_id: null });
    expect(b.thread.requests.map((r) => r.currentCu.cuId)).toEqual([U2_ID]);
    // The manager still establishes (DISTINCT_NEW), with the reused Ahmed Thread as its grounded Origin and Ahmed going DORMANT.
    expect(request.userThreadUnits[1]).toMatchObject({ decision: 'ESTABLISH_THREAD', origin_state: 'RESOLVED', origin_thread_ids: [T_OLD_AHMED] });
    expect(request.userLifecycleUnits[1].lifecycle_transitions).toEqual([{ thread_id: T_OLD_AHMED, to_state: 'DORMANT', reason_code: 'EXPLICIT_FOCUS_SHIFT', lifecycle_event_id: durableThreadLifecycleEventId(SESSION, U2_ID, T_OLD_AHMED, 'DORMANT') }]);
    // The assistant's return reopens the SAME reused Thread; U2's screening excluded the Thread already bound in this Session.
    expect(request.assistantLifecycleUnits[0]).toMatchObject({ outcome: 'REOPEN_EXISTING', thread_id: T_OLD_AHMED });
    // U2's screening set excluded the Thread already bound in this Session: with no candidate left, no screening call happened at all.
    expect(continuity.screeningRequests.map((r) => r.currentCu.cuId)).toEqual([U1_ID]);
    expect(continuity.resolutionRequests).toHaveLength(1);
    expect(request.expectedWorldThreadIdentityVersion).toBe(3);
    expect(JSON.stringify(request)).not.toMatch(/placement|home_x|home_y|address_scheme/u);
  });

  it('75. same-name ambiguity blocks a duplicate Thread: IDENTITY_AMBIGUOUS, no binding, no B2 call, candidates in canonical order', async () => {
    const continuity = new FakeThreadContinuityProvider(
      (request) => ({ possibleSameThreadIds: request.candidates.map((c) => c.threadId) }),
      (request) => request.currentCu.cuId === U1_ID
        ? { decision: 'AMBIGUOUS_EXISTING', threadId: null, candidateThreadIds: [T_OLD_BROTHER, T_OLD_AHMED], currentEvidenceReferenceIndexes: [], priorEvidenceRefs: [] }
        : DISTINCT,
    );
    const b = build(worldWithOldAhmed([dossierOf(T_OLD_BROTHER)]), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(THREAD_SCENARIO), continuity);
    await b.service.establish(USER, exchange);
    const [request] = b.h.commitRequests;
    expect(request.userLifecycleUnits[0]).toEqual({
      unit_id: U1_ID, outcome: 'IDENTITY_AMBIGUOUS', emerging_focus_id: F_AHMED, thread_id: null, binding_kind: null, focus_binding_id: null,
      identity_evidence: [], prior_identity_evidence: [], candidate_thread_ids: [T_OLD_AHMED, T_OLD_BROTHER], lifecycle_transitions: [],
    });
    expect(request.userThreadUnits[0]).toMatchObject({ decision: 'NO_ESTABLISHMENT', no_establishment_reason: 'NO_PROMOTION_PATH_PROVEN', thread_id: null });
    // B2a is never asked about the ambiguous U1; A1's later DISTINCT_NEW resolution legitimately reaches it.
    expect(b.thread.requests.map((r) => r.currentCu.cuId)).toEqual([U2_ID, A1_ID]);
    // The assistant attending the still-unbound ambiguous focus screens again (ambiguity stays ambiguity), never binds through the earlier CU.
    expect(continuity.screeningRequests.map((r) => r.currentCu.cuId)).toEqual([U1_ID, U2_ID, A1_ID]);
    expect(request.assistantLifecycleUnits[0]).toMatchObject({ outcome: 'NO_THREAD_ACTION', emerging_focus_id: F_AHMED, thread_id: null });
  });

  it('76. a distinct relational focus stays distinct: DISTINCT_NEW lets B2a establish beside the existing Thread', async () => {
    const b = build(worldWithOldAhmed());
    await b.service.establish(USER, exchange);
    const [request] = b.h.commitRequests;
    expect(request.userLifecycleUnits[0]).toMatchObject({ outcome: 'ESTABLISH_NEW', thread_id: T_AHMED });
    expect(request.userThreadUnits[0]).toMatchObject({ decision: 'ESTABLISH_THREAD', thread_id: T_AHMED });
    expect(b.continuity.resolutionRequests[0].candidates.map((c) => c.threadId)).toEqual([T_OLD_AHMED]);
  });

  it('77. exhaustive dossier paging: every page is read in deterministic order against the exact version, and every Thread is screened across chunks', async () => {
    const many = Array.from({ length: 70 }, (_v, i) => dossierOf(`${(i + 1).toString(16).padStart(8, '0')}-0000-5000-8000-000000000000`));
    const b = build(harness({
      contexts: () => ({ ...EMPTY_CONTEXT, worldThreadIdentityVersion: 9 }),
      dossiers: (request) => {
        const start = request.afterThreadId === null ? 0 : many.findIndex((d) => d.threadId === request.afterThreadId) + 1;
        return many.slice(start, start + request.limit);
      },
    }), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(THREAD_SCENARIO), FakeThreadContinuityProvider.nominatingNone());
    await b.service.establish(USER, exchange);
    expect(b.h.dossierRequests.map((r) => [r.expectedWorldThreadIdentityVersion, r.afterThreadId, r.limit])).toEqual([[9, null, 32], [9, many[31].threadId, 32], [9, many[63].threadId, 32]]);
    // Two unbound focuses (U1, U2) each screen the full 70 in three chunks; the assistant attends a bound focus.
    expect(b.continuity.screeningRequests.map((r) => r.candidates.length)).toEqual([32, 32, 6, 32, 32, 6]);
    expect(b.continuity.screeningRequests.slice(0, 3).flatMap((r) => r.candidates.map((c) => c.threadId))).toEqual(many.map((d) => d.threadId));
    expect(b.h.commitRequests[0].expectedWorldThreadIdentityVersion).toBe(9);
  });

  it('78. a dossier page out of order or a Thread bound in this Session leaking into candidates is refused', async () => {
    const shuffled = build(harness({ dossiers: () => [dossierOf(T_OLD_BROTHER), dossierOf(T_OLD_AHMED)] }));
    expect(await integrity(shuffled.service.establish(USER, exchange))).toBe('INVALID_THREAD_IDENTITY_DOSSIER');
    // A dossier that DOES carry a Session-bound Thread is filtered out before screening: B1 already distinguished the loci.
    const b = build(harness({
      contexts: () => ({ ...EMPTY_CONTEXT, worldThreadIdentityVersion: 1 }),
      dossiers: () => [dossierOf(T_OLD_AHMED)],
    }));
    await b.service.establish(USER, exchange);
    expect(b.continuity.screeningRequests[0].candidates.map((c) => c.threadId)).toEqual([T_OLD_AHMED]);
    expect(b.continuity.screeningRequests[1].candidates.map((c) => c.threadId)).toEqual([T_OLD_AHMED]);
  });

  it('79. the whole exchange is canonicalized ONCE per layer and split by the exact USER / ASSISTANT counts; no prepared id and no Home reaches the wire', async () => {
    const b = build();
    const result = await b.service.establish(USER, exchange);
    const [request] = b.h.commitRequests;
    expect(request.userFocusUnits.map((u) => u.unit_id)).toEqual([U1_ID, U2_ID]);
    expect(request.assistantFocusUnits.map((u) => u.unit_id)).toEqual([A1_ID, A2_ID]);
    expect(request.userThreadUnits.map((u) => u.unit_id)).toEqual([U1_ID, U2_ID]);
    expect(request.assistantThreadUnits.map((u) => u.unit_id)).toEqual([A1_ID, A2_ID]);
    expect(request.userLifecycleUnits.map((u) => u.unit_id)).toEqual([U1_ID, U2_ID]);
    expect(request.assistantLifecycleUnits.map((u) => u.unit_id)).toEqual([A1_ID, A2_ID]);
    const body = JSON.stringify(request);
    for (const forbidden of ['placement_x', 'placement_y', 'placement_attempt', 'world_fingerprint', 'address_scheme', 'session_position', 'same_sp_event_sequence', 'from_state', PREPARED_ID_PREFIX]) {
      expect(body.includes(forbidden)).toBe(false);
    }
    expect(Object.keys(result.temporal ?? {})).toEqual(['liveHead', 'committedEvents']);
    const wire = JSON.stringify(result.temporal);
    for (const forbidden of [T_AHMED, T_MANAGER, F_AHMED, F_MANAGER, 'thread', 'home', 'lifecycle', 'DORMANT', 'binding']) {
      expect(wire.includes(forbidden)).toBe(false);
    }
  });

  it('80. the commit carries BOTH exact tokens the context returned and the frozen provenance quadruple', async () => {
    const b = build(harness({ contexts: () => ({ ...EMPTY_CONTEXT, token: { currentSp: 7, sameSpEventSequence: 2 }, worldThreadIdentityVersion: 5 }) }));
    await b.service.establish(USER, exchange);
    const [request] = b.h.commitRequests;
    expect([request.expectedCurrentSp, request.expectedSameSpEventSequence, request.expectedWorldThreadIdentityVersion]).toEqual([7, 2, 5]);
    expect([request.continuityEvaluatorVersion, request.continuityPolicyVersion, request.continuityProvider, request.continuityModel, request.continuityPromptVersion, request.continuitySchemaVersion, request.lifecycleReducerVersion])
      .toEqual(['thread-continuity-evaluator-v1', 'stage-1.3-thread-lifecycle-v1', 'OPENAI', 'gpt-5-mini', 'thread-continuity-identity-v1', 1, 'thread-lifecycle-reducer-v1']);
    expect(request.threadEvaluatorVersion).toBe('thread-establishment-evaluator-v1');
    expect(request.focusEvaluatorVersion).toBe('conversational-focus-evaluator-v1');
  });

  it('81. a zero / zero exchange proposes nothing, reads no dossier, yet commits its technical capture once', async () => {
    const b = build(harness(), new RoleScriptedSegmentation(NO_SEGMENTS));
    const result = await b.service.establish(USER, exchange);
    expect(providerCounts(b)).toEqual([2, 0, 0, 0, 0]);
    expect(b.h.readIdentityDossierPage).not.toHaveBeenCalled();
    expect(b.h.commitFinalizedExchangeWithThreadLifecycle).toHaveBeenCalledTimes(1);
    const [request] = b.h.commitRequests;
    expect([request.userFocusUnits, request.assistantFocusUnits, request.userThreadUnits, request.assistantThreadUnits, request.userLifecycleUnits, request.assistantLifecycleUnits]).toEqual([[], [], [], [], [], []]);
    expect(result.temporal).toEqual({ liveHead: null, committedEvents: [] });
  });
});

describe('Session-local lifecycle over prior history (cases 82-85)', () => {
  /** A prior history: SP1 established Ahmed (bound), SP2 attended Work (bound, Ahmed away once). */
  const PRIOR_CU1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  const PRIOR_CU2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  const H_PRIOR_AHMED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  const H_WORK = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  const F_PRIOR_AHMED = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  const F_WORK = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
  const T_PRIOR_AHMED = durableThreadId(USER, F_PRIOR_AHMED);
  const T_WORK = durableThreadId(USER, F_WORK);
  const priorContext = (history: ConversationThreadLifecycleRuntimeContext['sessionThreadLifecycleHistory'] = []): ConversationThreadLifecycleRuntimeContext => ({
    sessionId: SESSION, token: { currentSp: 2, sameSpEventSequence: 2 }, worldThreadIdentityVersion: 2,
    priorContext: {
      priorCus: [
        { cuId: PRIOR_CU1, sourceTurnId: '99999999-9999-4999-8999-999999999991', sourceRole: 'USER', committedText: 'أحمد بقى بيقلقني.', ordinalWithinTurn: 0, functions: ['INFORM_REPORT'], sequencePosition: 'UNMARKED', targetCuId: null },
        { cuId: PRIOR_CU2, sourceTurnId: '99999999-9999-4999-8999-999999999992', sourceRole: 'ASSISTANT', committedText: 'الشغل بقى ضاغط.', ordinalWithinTurn: 0, functions: ['INFORM_REPORT'], sequencePosition: 'UNMARKED', targetCuId: null },
      ],
      referenceHandles: [{ handleId: H_PRIOR_AHMED, grounding: [{ cuId: PRIOR_CU1, exactSurface: 'أحمد' }] }, { handleId: H_WORK, grounding: [{ cuId: PRIOR_CU2, exactSurface: 'الشغل' }] }],
      focusCandidates: [{ focusCandidateId: F_PRIOR_AHMED, groundingHandleIds: [H_PRIOR_AHMED], priorGroundingCuIds: [PRIOR_CU1] }, { focusCandidateId: F_WORK, groundingHandleIds: [H_WORK], priorGroundingCuIds: [PRIOR_CU2] }],
      currentFocusCandidateId: F_WORK,
    },
    priorFocusSemantics: [
      { unit_id: PRIOR_CU1, functions: ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null, claim_attributions: [],
        references: [{ reference_index: 0, anchor_text: 'أحمد', anchor_occurrence: 1, span_start: 0, span_end: 4, state: 'RESOLVED', resolved_handle_id: H_PRIOR_AHMED, creates_handle: true, candidate_handle_ids: [] }],
        attention: { kind: 'START_NEW_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: F_PRIOR_AHMED, creates_focus: true, grounding_reference_index: 0 } },
      { unit_id: PRIOR_CU2, functions: ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null, claim_attributions: [],
        references: [{ reference_index: 0, anchor_text: 'الشغل', anchor_occurrence: 1, span_start: 0, span_end: 5, state: 'RESOLVED', resolved_handle_id: H_WORK, creates_handle: true, candidate_handle_ids: [] }],
        attention: { kind: 'START_NEW_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: F_WORK, creates_focus: true, grounding_reference_index: 0 } },
    ],
    focusAttentionHistory: [
      { cuId: PRIOR_CU1, attentionKind: 'START_NEW_FOCUS', attentionReason: 'DIRECT_SUBJECT', emergingFocusId: F_PRIOR_AHMED },
      { cuId: PRIOR_CU2, attentionKind: 'START_NEW_FOCUS', attentionReason: 'DIRECT_SUBJECT', emergingFocusId: F_WORK },
    ],
    establishedThreadBindings: [
      { threadId: T_PRIOR_AHMED, emergingFocusId: F_PRIOR_AHMED, establishedCuId: PRIOR_CU1, establishedSp: 1 },
      { threadId: T_WORK, emergingFocusId: F_WORK, establishedCuId: PRIOR_CU2, establishedSp: 2 },
    ],
    sessionFocusThreadBindings: [
      { bindingId: durableThreadFocusBindingId(SESSION, F_PRIOR_AHMED, T_PRIOR_AHMED), threadId: T_PRIOR_AHMED, emergingFocusId: F_PRIOR_AHMED, boundCuId: PRIOR_CU1, boundSp: 1, bindingKind: 'ESTABLISHMENT' },
      { bindingId: durableThreadFocusBindingId(SESSION, F_WORK, T_WORK), threadId: T_WORK, emergingFocusId: F_WORK, boundCuId: PRIOR_CU2, boundSp: 2, bindingKind: 'ESTABLISHMENT' },
    ],
    sessionThreadLifecycleHistory: history,
  });
  /** The user keeps talking about work (second away CU), the assistant returns to Ahmed. */
  const LIFECYCLE_FOCUS = (request: FocusResolutionRequest): FocusResolutionProposal => {
    if (request.currentCu.cuId === U1_ID) {
      return { ...NO_FOCUS, references: [{ anchor: { text: 'أحمد', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: H_PRIOR_AHMED, candidateHandleIds: [], newReference: false }],
        attention: { kind: 'ATTEND_EXISTING_FOCUS', existingFocusCandidateId: F_WORK, groundingAnchor: null, reason: 'SUBSTANTIVE_ELABORATION' } };
    }
    if (request.currentCu.cuId === U2_ID) {
      return { ...NO_FOCUS, references: [{ anchor: { text: 'المدير', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: null, candidateHandleIds: [], newReference: true }],
        attention: { kind: 'ATTEND_EXISTING_FOCUS', existingFocusCandidateId: F_WORK, groundingAnchor: null, reason: 'SUBSTANTIVE_ELABORATION' } };
    }
    if (request.currentCu.cuId === A1_ID) {
      return { ...NO_FOCUS, functions: ['ASK'], references: [{ anchor: { text: 'أحمد', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: H_PRIOR_AHMED, candidateHandleIds: [], newReference: false }],
        attention: { kind: 'ATTEND_EXISTING_FOCUS', existingFocusCandidateId: F_PRIOR_AHMED, groundingAnchor: null, reason: 'DIRECT_REQUEST_OR_QUESTION' } };
    }
    return NO_FOCUS;
  };
  const lifecycleBuild = (history: ConversationThreadLifecycleRuntimeContext['sessionThreadLifecycleHistory'] = []) =>
    build(harness({ contexts: () => priorContext(history) }), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(LIFECYCLE_FOCUS), NO_THREAD, FakeThreadContinuityProvider.failing('PROVIDER_ERROR'));

  it('82. sustained departure lands at the SECOND away CU only (never backdated), the return reopens, and bound focuses never touch a provider', async () => {
    const b = lifecycleBuild();
    await b.service.establish(USER, exchange);
    const [request] = b.h.commitRequests;
    // U1 (SP3) attends Work: Ahmed was away once (SP2) -> now the second consecutive away CU -> DORMANT at U1.
    expect(request.userLifecycleUnits[0]).toMatchObject({ outcome: 'ATTEND_EXISTING', thread_id: T_WORK,
      lifecycle_transitions: [{ thread_id: T_PRIOR_AHMED, to_state: 'DORMANT', reason_code: 'SUSTAINED_DEPARTURE', lifecycle_event_id: durableThreadLifecycleEventId(SESSION, U1_ID, T_PRIOR_AHMED, 'DORMANT') }] });
    expect(request.userLifecycleUnits[1]).toMatchObject({ outcome: 'ATTEND_EXISTING', thread_id: T_WORK, lifecycle_transitions: [] });
    // A1 (SP5) returns to Ahmed -> REOPENED; Work was attended once before -> nothing yet.
    expect(request.assistantLifecycleUnits[0]).toMatchObject({ outcome: 'REOPEN_EXISTING', thread_id: T_PRIOR_AHMED,
      lifecycle_transitions: [{ thread_id: T_PRIOR_AHMED, to_state: 'REOPENED', reason_code: 'GENUINE_RETURN' }] });
    expect(request.assistantLifecycleUnits[1]).toMatchObject({ outcome: 'NO_THREAD_ACTION', lifecycle_transitions: [] });
    // Every focus of this exchange was already bound: zero continuity calls, zero dossier reads, zero B2 provider calls.
    expect(providerCounts(b)).toEqual([2, 4, 0, 0, 0]);
    expect(b.h.readIdentityDossierPage).not.toHaveBeenCalled();
    expect(request.userThreadUnits.map((u) => u.no_establishment_reason)).toEqual(['ALREADY_ESTABLISHED', 'ALREADY_ESTABLISHED']);
  });

  it('83. a Thread already DORMANT in the durable history is reopened by the return and continued to ACTIVE by the next anchored CU', async () => {
    const dormantAhmed = [{ eventId: durableThreadLifecycleEventId(SESSION, PRIOR_CU2, T_PRIOR_AHMED, 'DORMANT'), threadId: T_PRIOR_AHMED, cuId: PRIOR_CU2, sessionPosition: 2, transitionOrdinal: 0, fromState: 'ACTIVE' as const, toState: 'DORMANT' as const, reasonCode: 'EXPLICIT_FOCUS_SHIFT' as const }];
    const returning = (request: FocusResolutionRequest): FocusResolutionProposal => {
      if (request.currentCu.cuId === U1_ID || request.currentCu.cuId === U2_ID) {
        return { ...NO_FOCUS, references: [{ anchor: { text: 'أحمد', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: H_PRIOR_AHMED, candidateHandleIds: [], newReference: false }],
          attention: { kind: 'ATTEND_EXISTING_FOCUS', existingFocusCandidateId: F_PRIOR_AHMED, groundingAnchor: null, reason: 'DIRECT_SUBJECT' } };
      }
      return NO_FOCUS;
    };
    const b = build(harness({ contexts: () => priorContext(dormantAhmed) }), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(returning), NO_THREAD, FakeThreadContinuityProvider.failing('PROVIDER_ERROR'));
    await b.service.establish(USER, exchange);
    const [request] = b.h.commitRequests;
    expect(request.userLifecycleUnits[0]).toMatchObject({ outcome: 'REOPEN_EXISTING', lifecycle_transitions: [{ thread_id: T_PRIOR_AHMED, to_state: 'REOPENED', reason_code: 'GENUINE_RETURN' }] });
    expect(request.userLifecycleUnits[1]).toMatchObject({ outcome: 'ATTEND_EXISTING', lifecycle_transitions: expect.arrayContaining([expect.objectContaining({ thread_id: T_PRIOR_AHMED, to_state: 'ACTIVE', reason_code: 'CONTINUED_ANCHORING' })]) });
    // Work: attended at SP2, then away at U1 and U2 (both on Ahmed) -> DORMANT at U2, the second away CU.
    expect(request.userLifecycleUnits[1].lifecycle_transitions.map((t) => [t.thread_id, t.to_state])).toEqual(expect.arrayContaining([[T_WORK, 'DORMANT']]));
    expect(request.userLifecycleUnits[0].lifecycle_transitions.map((t) => t.thread_id)).toEqual([T_PRIOR_AHMED]);
  });

  it('84. a malformed lifecycle context is integrity, never "no transition"; an illegal durable chain is refused by the mapper before any provider', async () => {
    const illegal = [{ eventId: durableThreadLifecycleEventId(SESSION, PRIOR_CU2, T_PRIOR_AHMED, 'REOPENED'), threadId: T_PRIOR_AHMED, cuId: PRIOR_CU2, sessionPosition: 2, transitionOrdinal: 0, fromState: 'DORMANT' as const, toState: 'REOPENED' as const, reasonCode: 'GENUINE_RETURN' as const }];
    // The mapper is exercised through the real repository seam; the service consumes only mapped contexts.
    const repository = new ConversationThreadLifecycleRuntimeRepository({ rpc: jest.fn()
      .mockResolvedValueOnce([{ ...absent() }]).mockResolvedValueOnce([{ ...absent() }])
      .mockResolvedValueOnce([{ base_current_sp: 2, base_same_sp_event_sequence: '2', prior_cus: [], reference_handles: [], focus_candidates: [], current_focus_candidate_id: null,
        prior_focus_semantics: [], focus_attention_history: [], established_thread_bindings: [], world_thread_identity_version: '0',
        session_focus_thread_bindings: [], session_thread_lifecycle_history: illegal.map((e) => ({ event_id: e.eventId, thread_id: e.threadId, cu_id: e.cuId, session_position: e.sessionPosition, transition_ordinal: 0, from_state: e.fromState, to_state: e.toState, reason_code: e.reasonCode })) }]),
    } as unknown as SupabaseServiceRoleApiService);
    const explode = jest.fn(() => { throw new Error('binding must not be created'); });
    const service = new ConversationThreadLifecycleEstablishmentService(repository, explode, explode, explode, explode);
    const error = await rejection(service.establish(USER, exchange));
    expect(error).toBeInstanceOf(Error);
    expect(explode).not.toHaveBeenCalled();
  });

  it('85. every continuity decision of one exchange must carry the SAME provenance, or the capture is refused', () => {
    const provenance = { continuityEvaluatorVersion: 'thread-continuity-evaluator-v1', continuityPolicyVersion: 'stage-1.3-thread-lifecycle-v1', continuityProvider: 'OPENAI', continuityModel: 'gpt-5-mini', continuityPromptVersion: 'thread-continuity-identity-v1', continuitySchemaVersion: 1, lifecycleReducerVersion: 'thread-lifecycle-reducer-v1' };
    const agreeing = { sessionId: SESSION, cuId: U1_ID, emergingFocusId: F_AHMED, decision: 'DISTINCT_NEW' as const, threadId: null, candidateThreadIds: [], currentEvidenceReferenceIndexes: [], priorEvidenceRefs: [], screenedThreadIds: [],
      provenance: { evaluatorVersion: 'thread-continuity-evaluator-v1', policyVersion: 'stage-1.3-thread-lifecycle-v1', provider: 'OPENAI', model: 'gpt-5-mini', promptVersion: 'thread-continuity-identity-v1', schemaVersion: 1 } };
    expect(() => assertContinuityProvenanceAgreement([agreeing], provenance)).not.toThrow();
    for (const drift of [{ model: 'other' }, { provider: 'ANOTHER' }, { promptVersion: 'v9' }, { schemaVersion: 2 }, { evaluatorVersion: 'v9' }, { policyVersion: 'v9' }]) {
      const error = () => assertContinuityProvenanceAgreement([{ ...agreeing, provenance: { ...agreeing.provenance, ...drift } }], provenance);
      expect(error).toThrow(ConversationThreadLifecycleIntegrityError);
      try { error(); } catch (caught) { expect((caught as ConversationThreadLifecycleIntegrityError).reason).toBe('CONTINUITY_PROVENANCE_DISAGREEMENT'); }
    }
  });
});

describe('bounded recovery, laziness and phase separation (cases 86-95)', () => {
  const sessionStale = () => new StaleConversationalFocusContextError();
  const identityStale = () => new StaleThreadIdentityContextError();

  it('86. on a commit failure the DATABASE winner is checked first, with no second semantic pass', async () => {
    let commits = 0;
    const b = build(harness({
      snapshots: (batchId, call) => call === 1 ? absent() : (batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4)),
      commit: async () => { commits += 1; throw sessionStale(); },
    }));
    expect((await b.service.establish(USER, exchange)).temporal).toEqual({ liveHead: 4, committedEvents: [expect.objectContaining({ firstSp: 1, lastSp: 2 }), expect.objectContaining({ firstSp: 3, lastSp: 4 })] });
    expect(commits).toBe(1);
    expect(b.focus.requests).toHaveLength(4);
    expect(b.h.readRuntimeContext).toHaveBeenCalledTimes(1);
  });

  it('87. exactly ONE Session-stale semantic retry, segmentation reused, dossiers re-read, and a second stale is retryable unavailability', async () => {
    const once = build(worldWithOldAhmed(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(THREAD_SCENARIO), FakeThreadContinuityProvider.nominatingAll(DISTINCT));
    once.h.commitFinalizedExchangeWithThreadLifecycle.mockImplementationOnce(async () => { once.h.calls.push('commit'); throw sessionStale(); });
    await once.service.establish(USER, exchange);
    expect(once.h.calls).toEqual(['snapshot:USER', 'snapshot:ASSISTANT', 'context', 'dossiers', 'commit', 'snapshot:USER', 'snapshot:ASSISTANT', 'context', 'dossiers', 'commit']);
    expect(once.segmentation.requests).toHaveLength(2);
    expect(once.focus.requests).toHaveLength(8);
    expect(once.thread.requests).toHaveLength(4);
    expect(once.continuity.screeningRequests).toHaveLength(4);
    const twice = build(harness({ commit: async () => { throw sessionStale(); } }));
    expect(await unavailable(twice.service.establish(USER, exchange))).toBe('STALE_CONTEXT_RETRY_EXHAUSTED');
    expect(twice.segmentation.requests).toHaveLength(2);
    expect(twice.h.commitFinalizedExchangeWithThreadLifecycle).toHaveBeenCalledTimes(2);
  });

  it('88. the world identity version is the SECOND stale authority: one retry shared with the Session token, dossiers re-read at the new version', async () => {
    const contexts = [4, 5];
    const b = build(harness({
      contexts: (call) => ({ ...EMPTY_CONTEXT, worldThreadIdentityVersion: contexts[call - 1] }),
      dossiers: () => [dossierOf(T_OLD_AHMED)],
      commit: async (request, call) => { if (call === 1) throw identityStale(); return defaultCommit(request); },
    }));
    await b.service.establish(USER, exchange);
    expect(b.h.dossierRequests.map((r) => r.expectedWorldThreadIdentityVersion)).toEqual([4, 5]);
    expect(b.h.commitRequests.map((r) => r.expectedWorldThreadIdentityVersion)).toEqual([4, 5]);
    expect(b.segmentation.requests).toHaveLength(2);
    // A stale identity version discovered during dossier PAGING earns the same single retry.
    const paging = build(harness({
      contexts: (call) => ({ ...EMPTY_CONTEXT, worldThreadIdentityVersion: contexts[call - 1] }),
      dossiers: (_request, call) => { if (call === 1) throw identityStale(); return [dossierOf(T_OLD_AHMED)]; },
    }));
    await paging.service.establish(USER, exchange);
    expect(paging.h.calls).toEqual(['snapshot:USER', 'snapshot:ASSISTANT', 'context', 'dossiers', 'snapshot:USER', 'snapshot:ASSISTANT', 'context', 'dossiers', 'commit']);
    expect(paging.segmentation.requests).toHaveLength(2);
    // Session stale then identity stale: the budget is ONE, shared.
    const both = build(harness({ commit: async (_request, call) => { throw call === 1 ? sessionStale() : identityStale(); } }));
    expect(await unavailable(both.service.establish(USER, exchange))).toBe('STALE_CONTEXT_RETRY_EXHAUSTED');
    expect(both.h.commitFinalizedExchangeWithThreadLifecycle).toHaveBeenCalledTimes(2);
  });

  it('89. a non-stale commit failure - including a generic 40001 - never earns the semantic retry', async () => {
    const generic = new DataApiError(500, { databaseCode: '40001', databaseMessage: 'could not serialize access due to concurrent update' });
    const b = build(harness({ commit: async () => { throw generic; } }));
    expect(await unavailable(b.service.establish(USER, exchange))).toBe('TRANSPORT_UNAVAILABLE');
    expect(b.h.commitFinalizedExchangeWithThreadLifecycle).toHaveBeenCalledTimes(1);
    expect(b.focus.requests).toHaveLength(4);
  });

  it('90. a moved source frontier refuses segmentation reuse; a partial state discovered during recovery is integrity', async () => {
    const moved = build(harness({ snapshots: (_batchId, call) => call === 1 ? absent() : absent({ source_frontier: 99 }), commit: async () => { throw sessionStale(); } }));
    expect(await integrity(moved.service.establish(USER, exchange))).toBe('SEGMENTATION_FRONTIER_MOVED');
    expect(moved.segmentation.requests).toHaveLength(2);
    const partial = build(harness({
      snapshots: (batchId, call) => call === 1 ? absent() : complete(batchId, batchId === USER_BATCH ? 'USER' : 'ASSISTANT', 1, 2, 4, { thread_semantic_capture_state: 'PARTIAL' }),
      commit: async () => { throw identityStale(); },
    }));
    expect(await integrity(partial.service.establish(USER, exchange))).toBe('INCOMPLETE_THREAD_LIFECYCLE_CAPTURE');
    expect(partial.h.commitFinalizedExchangeWithThreadLifecycle).toHaveBeenCalledTimes(1);
  });

  it('91. a continuity provider outage or rejected proposal is technical failure, never DISTINCT_NEW, and never fails the turns', async () => {
    const outage = build(worldWithOldAhmed(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(THREAD_SCENARIO), FakeThreadContinuityProvider.failing('UNAVAILABLE'));
    expect(await unavailable(outage.service.establish(USER, exchange))).toBe('PROVIDER_UNAVAILABLE');
    expect(outage.h.commitFinalizedExchangeWithThreadLifecycle).not.toHaveBeenCalled();
    expect(outage.thread.requests).toHaveLength(0);
    const minted = build(worldWithOldAhmed(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(THREAD_SCENARIO), FakeThreadContinuityProvider.nominatingAll(bindOld('99999999-9999-5999-8999-999999999999')));
    expect(await unavailable(minted.service.establish(USER, exchange))).toBe('PROVIDER_UNAVAILABLE');
    expect(minted.h.commitFinalizedExchangeWithThreadLifecycle).not.toHaveBeenCalled();
    expect([userTurn.status, assistantTurn.status]).toEqual(['COMPLETED', 'COMPLETED']);
  });

  it('92. segmentation, focus, Thread and transport failures keep their own truthful classes', async () => {
    expect(await unavailable(build(harness(), new RoleScriptedSegmentation({ USER: new CuSegmentationProviderError('UNAVAILABLE'), ASSISTANT: [] })).service.establish(USER, exchange))).toBe('PROVIDER_UNAVAILABLE');
    expect(await unavailable(build(harness(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(() => new FocusResolutionProviderError('TIMEOUT'))).service.establish(USER, exchange))).toBe('PROVIDER_UNAVAILABLE');
    expect(await unavailable(build(harness(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(() => new ThreadEstablishmentProviderError('UNAVAILABLE'))).service.establish(USER, exchange))).toBe('PROVIDER_UNAVAILABLE');
    expect(await unavailable(build(harness({ commit: async () => { throw new Error('socket hang up'); } })).service.establish(USER, exchange))).toBe('TRANSPORT_UNAVAILABLE');
  });

  it('93. every binding is lazy: never at construction, never on replay, never on partial history; the continuity credential only on a real call', async () => {
    const explode = jest.fn(() => { throw new Error('binding must not be created'); });
    const replay = harness({ snapshots: (batchId) => complete(batchId, batchId === USER_BATCH ? 'USER' : 'ASSISTANT', 1, 2, 4) });
    const service = new ConversationThreadLifecycleEstablishmentService(replay.boundary, explode, explode, explode, explode);
    expect(explode).not.toHaveBeenCalled();
    await service.establish(USER, exchange);
    expect(explode).not.toHaveBeenCalled();
    const partial = harness({ snapshots: (batchId) => complete(batchId, batchId === USER_BATCH ? 'USER' : 'ASSISTANT', 1, 2, 4, { thread_semantic_capture_state: 'PARTIAL' }) });
    await rejection(new ConversationThreadLifecycleEstablishmentService(partial.boundary, explode, explode, explode, explode).establish(USER, exchange));
    expect(explode).not.toHaveBeenCalled();
    // The production continuity factory reads no key when called; a zero-CU, no-focus or already-bound exchange therefore needs none.
    const environment = {} as NodeJS.ProcessEnv;
    const binding = openAiThreadContinuityBinding(environment)();
    expect([binding.providerName, binding.providerModel]).toEqual(['OPENAI', 'gpt-5-mini']);
    await expect(binding.provider.screen({ schemaVersion: 1, currentCu: { cuId: U1_ID, sourceTurnId: USER_TURN, sourceRole: 'USER', committedText: U1, ordinalWithinTurn: 0 },
      currentFocusSemantics: { unit_id: U1_ID, functions: ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null, references: [], claim_attributions: [], attention: { kind: 'START_NEW_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: F_AHMED, creates_focus: true, grounding_reference_index: 0 } },
      currentFocusGrounding: { emergingFocusId: F_AHMED, groundingSurfaces: [] }, candidates: [] })).rejects.toThrow(/OPENAI_API_KEY/u);
    const zero = build(harness(), new RoleScriptedSegmentation(NO_SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(THREAD_SCENARIO), FakeThreadContinuityProvider.failing('PROVIDER_ERROR'));
    await zero.service.establish(USER, exchange);
    expect([zero.continuity.screeningRequests.length, zero.continuity.resolutionRequests.length]).toEqual([0, 0]);
  });

  it('94. no live provider request is ever made: every provider in this suite is an injected fake', async () => {
    const rpc = jest.fn().mockResolvedValue([absent()]);
    const repository = new ConversationThreadLifecycleRuntimeRepository({ rpc } as unknown as SupabaseServiceRoleApiService);
    const explode = jest.fn(() => { throw new Error('binding must not be created'); });
    const service = new ConversationThreadLifecycleEstablishmentService(repository, explode, explode, explode, explode);
    await rejection(service.establish(USER, exchange));
    expect(explode).not.toHaveBeenCalled();
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      'get_conversation_thread_lifecycle_integrated_batch_snapshot_v1',
      'get_conversation_thread_lifecycle_integrated_batch_snapshot_v1',
      'get_conversation_thread_lifecycle_runtime_context_v1',
    ]);
  });

  it('95. a technical failure never marks a completed turn FAILED and never regenerates: the inputs are untouched', async () => {
    const before = JSON.stringify(exchange);
    const b = build(harness({ commit: async () => { throw new Error('boom'); } }));
    await rejection(b.service.establish(USER, exchange));
    expect(JSON.stringify(exchange)).toBe(before);
    expect([userTurn.status, assistantTurn.status]).toEqual(['COMPLETED', 'COMPLETED']);
  });
});
