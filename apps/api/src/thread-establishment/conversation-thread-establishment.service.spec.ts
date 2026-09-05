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
import { openAiFocusResolutionBinding, type FocusResolutionBinding } from '../conversational-focus/focus-resolution-binding';
import { FocusResolutionProviderError, type FocusResolutionProposal, type FocusResolutionProvider, type FocusResolutionRequest } from '../conversational-focus/focus-resolution-provider.types';
import { assertThreadProvenanceAgreement, buildPreparedThreadCuInputs, ConversationThreadEstablishmentService } from './conversation-thread-establishment.service';
import { ConversationThreadRuntimeRepository, type ConversationThreadRuntimeBoundary } from './conversation-thread-runtime.repository';
import {
  ConversationThreadEstablishmentUnavailableError,
  ConversationThreadIntegrityError,
  type CommitFinalizedExchangeWithFocusAndThreadRequest,
  type ConversationThreadRuntimeContext,
  type FinalizedExchangeWithFocusAndThreadResult,
  type IntegratedFocusThreadBatchSnapshot,
} from './conversation-thread-runtime.types';
import { durableThreadId } from './durable-thread-canonicalizer';
import { openAiThreadEstablishmentBinding, type ThreadEstablishmentBinding } from './thread-establishment-binding';
import { ThreadEstablishmentProviderError, type ThreadEstablishmentProposal, type ThreadEstablishmentProvider, type ThreadEstablishmentRequest } from './thread-establishment-provider.types';

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
  private inFlight = 0;
  maxInFlight = 0;
  constructor(private readonly answer: (request: FocusResolutionRequest) => FocusResolutionProposal | FocusResolutionProviderError) {}
  async propose(request: FocusResolutionRequest): Promise<FocusResolutionProposal> {
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    this.requests.push(JSON.parse(JSON.stringify(request)) as FocusResolutionRequest);
    await new Promise((resolve) => setTimeout(resolve, 1));
    try {
      const answer = this.answer(request);
      if (answer instanceof FocusResolutionProviderError) throw answer;
      return answer;
    } finally {
      this.inFlight -= 1;
    }
  }
}
class RecordingThreadProvider implements ThreadEstablishmentProvider {
  readonly requests: ThreadEstablishmentRequest[] = [];
  private inFlight = 0;
  maxInFlight = 0;
  constructor(private readonly answer: (request: ThreadEstablishmentRequest) => ThreadEstablishmentProposal | ThreadEstablishmentProviderError) {}
  async propose(request: ThreadEstablishmentRequest): Promise<ThreadEstablishmentProposal> {
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    this.requests.push(JSON.parse(JSON.stringify(request)) as ThreadEstablishmentRequest);
    await new Promise((resolve) => setTimeout(resolve, 1));
    try {
      const answer = this.answer(request);
      if (answer instanceof ThreadEstablishmentProviderError) throw answer;
      return answer;
    } finally {
      this.inFlight -= 1;
    }
  }
}

const NO_FOCUS: FocusResolutionProposal = {
  functions: ['INFORM_REPORT'], sequencePosition: 'UNMARKED', targetCuId: null, references: [], claimAttributions: [],
  attention: { kind: 'NO_INDEPENDENT_FOCUS', existingFocusCandidateId: null, groundingAnchor: null, reason: 'INCIDENTAL_OR_SUBORDINATE' },
};
/**
 * USER CU1 first grounds Ahmed and starts his focus; USER CU2 grounds the
 * manager as a NEW reference, starts the manager's focus, and ALSO resolves
 * Ahmed through the handle CU1 created; the ASSISTANT attends Ahmed's focus.
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
      ...NO_FOCUS,
      references: [
        { anchor: { text: 'المدير', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: null, candidateHandleIds: [], newReference: true },
        { anchor: { text: 'أحمد', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: `${PREPARED_ID_PREFIX}reference:${U1_ID}:0`, candidateHandleIds: [], newReference: false },
      ],
      attention: { kind: 'START_NEW_FOCUS', existingFocusCandidateId: null, groundingAnchor: { text: 'المدير', occurrence: 1 }, reason: 'DIRECT_SUBJECT' },
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

const segmentationBinding = (provider: CuSegmentationProvider): CuSegmentationBinding => ({ provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' });
const focusBinding = (provider: FocusResolutionProvider): FocusResolutionBinding => ({ provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' });
const threadBinding = (provider: ThreadEstablishmentProvider): ThreadEstablishmentBinding => ({ provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' });

const EMPTY_CONTEXT: ConversationThreadRuntimeContext = {
  sessionId: SESSION, token: { currentSp: null, sameSpEventSequence: 0 },
  priorContext: { priorCus: [], referenceHandles: [], focusCandidates: [], currentFocusCandidateId: null },
  priorFocusSemantics: [], focusAttentionHistory: [], establishedThreadBindings: [],
};
const absent = (overrides: Partial<IntegratedFocusThreadBatchSnapshot> = {}): IntegratedFocusThreadBatchSnapshot => ({
  batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null,
  focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false,
  thread_capture_state: 'ABSENT', thread_batch_exists: false, thread_unit_count: 0, thread_establishment_count: 0, ...overrides,
});
function unit(batchId: string, index: number, sp: number, role: 'USER' | 'ASSISTANT', spanStart = index * 10, spanEnd = index * 10 + 5): CommittedConversationUnit {
  return {
    id: automaticCommitUnitId(batchId, { index, spanStart, spanEnd }), user_id: USER, session_id: SESSION,
    source_turn_id: role === 'USER' ? USER_TURN : ASSISTANT_TURN, commit_batch_id: batchId, source_role: role, speaker_state: 'RESOLVED',
    source_modality: 'TEXT', ordinal_within_turn: index, source_span_start: spanStart, source_span_end: spanEnd,
    committed_text: 'x'.repeat(spanEnd - spanStart), source_content_sha256: 'deadbeef', session_position: sp, created_at: 'now',
  };
}
function complete(batchId: string, role: 'USER' | 'ASSISTANT', firstSp: number, count: number, liveHead: number | null, overrides: Partial<IntegratedFocusThreadBatchSnapshot> = {}): IntegratedFocusThreadBatchSnapshot {
  const units = Array.from({ length: count }, (_v, index) => unit(batchId, index, firstSp + index, role));
  return {
    batch_exists: true, committed_unit_count: count, units,
    commit_event: count === 0 ? null : { commit_batch_id: batchId, user_id: USER, session_id: SESSION, source_turn_id: role === 'USER' ? USER_TURN : ASSISTANT_TURN, first_sp: firstSp, last_sp: firstSp + count - 1, unit_count: count, created_at: 'now' },
    source_frontier: count * 10, live_head: liveHead,
    focus_batch_exists: true, focus_semantic_count: count, focus_attention_count: count, focus_complete: true,
    thread_capture_state: 'COMPLETE', thread_batch_exists: true, thread_unit_count: count, thread_establishment_count: 0, ...overrides,
  };
}

interface Harness {
  snapshots: (batchId: string, call: number) => IntegratedFocusThreadBatchSnapshot;
  contexts: (call: number) => ConversationThreadRuntimeContext;
  commit: (request: CommitFinalizedExchangeWithFocusAndThreadRequest, call: number) => Promise<FinalizedExchangeWithFocusAndThreadResult>;
}
function defaultCommit(request: CommitFinalizedExchangeWithFocusAndThreadRequest): FinalizedExchangeWithFocusAndThreadResult {
  const u = request.userUnits.length;
  const a = request.assistantUnits.length;
  return {
    live_head: u + a === 0 ? null : u + a,
    same_sp_event_sequence: u + a === 0 ? 0 : 2,
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
  let commitCalls = 0;
  const commitRequests: CommitFinalizedExchangeWithFocusAndThreadRequest[] = [];
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
  const commitFinalizedExchangeWithFocusAndThread = jest.fn(async (request: CommitFinalizedExchangeWithFocusAndThreadRequest) => {
    calls.push('commit');
    commitCalls += 1;
    commitRequests.push(request);
    return (overrides.commit ?? (async (r) => defaultCommit(r)))(request, commitCalls);
  });
  const boundary: ConversationThreadRuntimeBoundary = { readIntegratedBatchSnapshot, readRuntimeContext, commitFinalizedExchangeWithFocusAndThread };
  return { boundary, calls, commitRequests, readIntegratedBatchSnapshot, readRuntimeContext, commitFinalizedExchangeWithFocusAndThread };
}
function build(
  h = harness(),
  segmentation = new RoleScriptedSegmentation(SEGMENTS),
  focus = new RecordingFocusProvider(FOCUS_SCENARIO),
  thread = new RecordingThreadProvider(THREAD_SCENARIO),
) {
  const segmentationFactory = jest.fn(() => segmentationBinding(segmentation));
  const focusFactory = jest.fn(() => focusBinding(focus));
  const threadFactory = jest.fn(() => threadBinding(thread));
  const service = new ConversationThreadEstablishmentService(h.boundary, segmentationFactory, focusFactory, threadFactory);
  return { service, h, segmentation, focus, thread, segmentationFactory, focusFactory, threadFactory };
}
const rejection = async (promise: Promise<unknown>) => {
  try { await promise; } catch (error) { return error; }
  throw new Error('expected a rejection');
};
const integrity = async (promise: Promise<unknown>) => {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(ConversationThreadIntegrityError);
  return (error as ConversationThreadIntegrityError).reason;
};
const unavailable = async (promise: Promise<unknown>) => {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(ConversationThreadEstablishmentUnavailableError);
  return (error as ConversationThreadEstablishmentUnavailableError).reason;
};

describe('relation gate, replay and capture-state gate (cases 46-50)', () => {
  it('46. an invalid finalized relation costs zero providers, zero reads and zero writes', async () => {
    for (const bad of [
      turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', source_turn_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
      turn({ id: ASSISTANT_TURN, role: 'USER', source_turn_id: USER_TURN }),
      turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', session_id: '55555555-5555-4555-8555-555555555555', source_turn_id: USER_TURN }),
    ]) {
      const { service, h, segmentation, focus, thread, segmentationFactory, focusFactory, threadFactory } = build();
      expect(await integrity(service.establish(USER, { userTurn, assistantTurn: bad }))).toBe('INVALID_FINALIZED_EXCHANGE_RELATION');
      expect(h.calls).toEqual([]);
      expect([segmentation.requests, focus.requests, thread.requests].map((r) => r.length)).toEqual([0, 0, 0]);
      expect([segmentationFactory, focusFactory, threadFactory].every((f) => f.mock.calls.length === 0)).toBe(true);
      // Both durable turns stay COMPLETED: nothing regenerates or fails them.
      expect([userTurn.status, bad.status]).toEqual(['COMPLETED', 'COMPLETED']);
    }
    const { service } = build();
    const pending = { userTurn, assistantTurn: turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', status: 'GENERATING' as never, source_turn_id: USER_TURN }) };
    expect(await service.establish(USER, pending)).toBe(pending);
  });

  // FIX-T03B2B3-01. `establishExchange(...)` is a separately exposed direct
  // runtime boundary, so it may not lean on the `establish(...)` wrapper's
  // pending check: a GENERATING or FAILED turn handed straight to it must be
  // refused by the ONE relation gate, before any read, any binding and any
  // mutation - and as an INTEGRITY failure, never as unavailability.
  it('74. a direct establishExchange call with any non-COMPLETED turn is refused before every read, provider and write', async () => {
    const NON_COMPLETED: ConversationTurn['status'][] = ['GENERATING', 'FAILED'];
    const pairs: [ConversationTurn['status'], ConversationTurn['status']][] = [
      ['GENERATING', 'COMPLETED'],
      ['COMPLETED', 'GENERATING'],
      ['FAILED', 'COMPLETED'],
      ['COMPLETED', 'FAILED'],
      ['GENERATING', 'FAILED'],
      ['FAILED', 'GENERATING'],
    ];
    for (const [userStatus, assistantStatus] of pairs) {
      const { service, h, segmentation, focus, thread, segmentationFactory, focusFactory, threadFactory } = build();
      const badUser = turn({ status: userStatus });
      const badAssistant = turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', content: ASSISTANT_CONTENT, source_turn_id: USER_TURN, status: assistantStatus });
      const before = JSON.stringify([badUser, badAssistant]);
      expect(await integrity(service.establishExchange(USER, badUser, badAssistant))).toBe('INVALID_FINALIZED_EXCHANGE_RELATION');
      // Zero reads, zero bindings, zero provider requests, zero coordinator calls.
      expect(h.calls).toEqual([]);
      expect(h.readIntegratedBatchSnapshot).not.toHaveBeenCalled();
      expect(h.readRuntimeContext).not.toHaveBeenCalled();
      expect(h.commitFinalizedExchangeWithFocusAndThread).not.toHaveBeenCalled();
      expect([segmentationFactory, focusFactory, threadFactory].map((f) => f.mock.calls.length)).toEqual([0, 0, 0]);
      expect([segmentation.requests, focus.requests, thread.requests].map((r) => r.length)).toEqual([0, 0, 0]);
      // No turn-state mutation, no failTurn, no regeneration: the inputs are
      // returned to the caller exactly as they were handed in.
      expect(JSON.stringify([badUser, badAssistant])).toBe(before);
      expect([badUser.status, badAssistant.status]).toEqual([userStatus, assistantStatus]);
      // And it is an INTEGRITY failure, never provider / transport unavailability.
      const error = await rejection(service.establishExchange(USER, badUser, badAssistant));
      expect(error).not.toBeInstanceOf(ConversationThreadEstablishmentUnavailableError);
    }
    // The status gate is independent of the role / Session / source relation:
    // a structurally perfect pair is still refused while either turn is pending.
    for (const status of NON_COMPLETED) {
      const { service } = build();
      expect(await integrity(service.establishExchange(USER, turn({ status }), assistantTurn))).toBe('INVALID_FINALIZED_EXCHANGE_RELATION');
    }
    // A valid COMPLETED pair still proceeds through the whole chain, and the
    // wrapper still returns a not-yet-complete pair UNCHANGED rather than
    // raising - that behaviour is deliberately not changed by this fix.
    const valid = build();
    expect((await valid.service.establishExchange(USER, userTurn, assistantTurn)).committedEvents).toHaveLength(2);
    expect(valid.h.commitFinalizedExchangeWithFocusAndThread).toHaveBeenCalledTimes(1);
    for (const status of NON_COMPLETED) {
      const wrapper = build();
      const pending = { userTurn: turn({ status }), assistantTurn };
      expect(await wrapper.service.establish(USER, pending)).toBe(pending);
      expect(wrapper.h.calls).toEqual([]);
      const pendingAssistant = { userTurn, assistantTurn: turn({ id: ASSISTANT_TURN, role: 'ASSISTANT' as const, content: ASSISTANT_CONTENT, source_turn_id: USER_TURN, status }) };
      expect(await wrapper.service.establish(USER, pendingAssistant)).toBe(pendingAssistant);
      expect(wrapper.h.calls).toEqual([]);
    }
  });

  it('47. COMPLETE + COMPLETE is canonical replay: stored delivery, zero segmentation, zero focus, zero Thread', async () => {
    const { service, h, segmentation, focus, thread, segmentationFactory, focusFactory, threadFactory } = build(harness({
      snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4, { thread_establishment_count: 1 }) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4),
    }));
    const result = await service.establish(USER, exchange);
    expect(result.temporal).toEqual({ liveHead: 4, committedEvents: [
      expect.objectContaining({ type: 'CONVERSATIONAL_UNITS_COMMITTED', version: 1, firstSp: 1, lastSp: 2, unitCount: 2, sourceTurnId: USER_TURN }),
      expect.objectContaining({ firstSp: 3, lastSp: 4, unitCount: 2, sourceTurnId: ASSISTANT_TURN }),
    ] });
    expect([segmentation.requests, focus.requests, thread.requests].map((r) => r.length)).toEqual([0, 0, 0]);
    expect(h.commitFinalizedExchangeWithFocusAndThread).not.toHaveBeenCalled();
    expect(h.readRuntimeContext).not.toHaveBeenCalled();
    expect([segmentationFactory, focusFactory, threadFactory].every((f) => f.mock.calls.length === 0)).toBe(true);
  });

  it('48. a committed zero-CU pair that is B2-complete replays with zero providers', async () => {
    const { service, focus, segmentation, thread, threadFactory } = build(harness({
      snapshots: (batchId) => complete(batchId, batchId === USER_BATCH ? 'USER' : 'ASSISTANT', 1, 0, null),
    }));
    expect((await service.establish(USER, exchange)).temporal).toEqual({ liveHead: null, committedEvents: [] });
    expect([segmentation.requests, focus.requests, thread.requests].map((r) => r.length)).toEqual([0, 0, 0]);
    expect(threadFactory).not.toHaveBeenCalled();
  });

  it('49. one canonical half and one absent half fails closed before any provider', async () => {
    const { service, h, focus, thread, segmentation } = build(harness({
      snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 2) : absent(),
    }));
    expect(await integrity(service.establish(USER, exchange))).toBe('PARTIAL_INTEGRATED_EXCHANGE');
    expect([segmentation.requests, focus.requests, thread.requests].map((r) => r.length)).toEqual([0, 0, 0]);
    expect(h.readRuntimeContext).not.toHaveBeenCalled();
  });

  it('50. every PARTIAL shape - legacy T-03A2-only, B1-only, missing or corrupt B2 - fails closed before providers', async () => {
    for (const partial of [
      // legacy T-03A2-only: commitment without B1 or B2 capture
      { thread_capture_state: 'PARTIAL' as const, focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false, thread_batch_exists: false, thread_unit_count: 0 },
      // B1-only: B1 whole, B2 never ran
      { thread_capture_state: 'PARTIAL' as const, thread_batch_exists: false, thread_unit_count: 0 },
      // B2 capture present but structurally partial by the 0068 authority
      { thread_capture_state: 'PARTIAL' as const },
    ]) {
      const { service, h, focus, thread, segmentation, threadFactory } = build(harness({
        snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4, partial) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4),
      }));
      expect(await integrity(service.establish(USER, exchange))).toBe('INCOMPLETE_THREAD_CAPTURE');
      expect([segmentation.requests, focus.requests, thread.requests].map((r) => r.length)).toEqual([0, 0, 0]);
      expect(h.commitFinalizedExchangeWithFocusAndThread).not.toHaveBeenCalled();
      expect(threadFactory).not.toHaveBeenCalled();
    }
  });
});

describe('the finalized-exchange semantic chain (cases 51-62)', () => {
  it('51. the whole chain runs in exactly one order, with exactly one coordinator call', async () => {
    const { service, h } = build();
    await service.establish(USER, exchange);
    expect(h.calls).toEqual(['snapshot:USER', 'snapshot:ASSISTANT', 'context', 'commit']);
    expect(h.commitFinalizedExchangeWithFocusAndThread).toHaveBeenCalledTimes(1);
    expect(h.readRuntimeContext).toHaveBeenCalledTimes(1);
  });

  it('52. prepared CurrentCu inputs use exact Unicode code-point slicing and authoritative ordinals', async () => {
    const { service, focus } = build();
    await service.establish(USER, exchange);
    expect(focus.requests.map((request) => request.currentCu.committedText)).toEqual([U1, U2, A1, A2]);
    expect(focus.requests.map((request) => request.currentCu.ordinalWithinTurn)).toEqual([0, 1, 0, 1]);
    // The ordinal continues the authoritative prior CUs of the SAME source turn.
    const prior = { priorCus: [{ cuId: U1_ID, sourceTurnId: USER_TURN, sourceRole: 'USER' as const, committedText: U1, ordinalWithinTurn: 4, functions: null, sequencePosition: null, targetCuId: null }], referenceHandles: [], focusCandidates: [], currentFocusCandidateId: null };
    expect(buildPreparedThreadCuInputs(userTurn, [{ unitId: U2_ID, spanStart: spanOf(USER_CONTENT, U2).start, spanEnd: spanOf(USER_CONTENT, U2).end }], prior)[0])
      .toEqual({ cuId: U2_ID, sourceTurnId: USER_TURN, sourceRole: 'USER', committedText: U2, ordinalWithinTurn: 5 });
    // Code points, never UTF-16 offsets: the Arabic slice is exact.
    expect(points(U2)).toHaveLength(spanOf(USER_CONTENT, U2).end - spanOf(USER_CONTENT, U2).start);
  });

  it('53. B1 focus evaluation is strictly sequential USER -> ASSISTANT with no hindsight', async () => {
    const { service, focus } = build();
    await service.establish(USER, exchange);
    expect(focus.requests.map((request) => request.currentCu.cuId)).toEqual([U1_ID, U2_ID, A1_ID, A2_ID]);
    expect(focus.maxInFlight).toBe(1);
    // No request ever carries a CU that comes later in the sequence.
    focus.requests.forEach((request, index) => {
      const seen = JSON.stringify(request);
      for (const id of [U1_ID, U2_ID, A1_ID, A2_ID].slice(index + 1)) expect(seen.includes(id)).toBe(false);
    });
  });

  it('54. the whole exchange is canonicalized ONCE and split by the exact USER / ASSISTANT counts', async () => {
    const { service, h } = build();
    await service.establish(USER, exchange);
    const [request] = h.commitRequests;
    expect(request.userFocusUnits.map((u) => u.unit_id)).toEqual([U1_ID, U2_ID]);
    expect(request.assistantFocusUnits.map((u) => u.unit_id)).toEqual([A1_ID, A2_ID]);
    expect(request.userThreadUnits.map((u) => u.unit_id)).toEqual([U1_ID, U2_ID]);
    expect(request.assistantThreadUnits.map((u) => u.unit_id)).toEqual([A1_ID, A2_ID]);
    // The prepared identities are gone: every id is a stable durable one.
    expect(JSON.stringify([request.userFocusUnits, request.assistantFocusUnits, request.userThreadUnits, request.assistantThreadUnits])).not.toContain(PREPARED_ID_PREFIX);
    expect(request.userFocusUnits[0].attention.emerging_focus_id).toBe(F_AHMED);
    expect(request.userFocusUnits[0].references[0].resolved_handle_id).toBe(H_AHMED);
  });

  it('55. every B2 request carries the EXACT canonical B1 bundle of its own CU', async () => {
    const { service, thread } = build();
    await service.establish(USER, exchange);
    for (const request of thread.requests) {
      expect(request.currentFocusSemantics.unit_id).toBe(request.currentCu.cuId);
    }
    expect(thread.requests[0].currentFocusSemantics.attention.emerging_focus_id).toBe(F_AHMED);
    expect(thread.requests[1].currentFocusSemantics.attention.emerging_focus_id).toBe(F_MANAGER);
  });

  it('56. B2 evaluation is strictly sequential with no hindsight, and reaches the provider only where B2a says so', async () => {
    const { service, thread } = build();
    await service.establish(USER, exchange);
    // A1 is deterministically ALREADY_ESTABLISHED and A2 has no independent
    // focus: neither costs a provider call.
    expect(thread.requests.map((request) => request.currentCu.cuId)).toEqual([U1_ID, U2_ID]);
    expect(thread.maxInFlight).toBe(1);
    for (const id of [A1_ID, A2_ID]) {
      expect(JSON.stringify(thread.requests).includes(id)).toBe(false);
    }
  });

  it('57. a later same-focus CU sees the EARLIER prepared establishment as ALREADY_ESTABLISHED', async () => {
    const { service, h } = build();
    await service.establish(USER, exchange);
    const [request] = h.commitRequests;
    expect(request.assistantThreadUnits[0]).toMatchObject({
      unit_id: A1_ID, decision: 'NO_ESTABLISHMENT', no_establishment_reason: 'ALREADY_ESTABLISHED',
      emerging_focus_id: F_AHMED, thread_id: null, home_anchor_id: null, origin_state: 'NONE', origin_thread_ids: [],
    });
    expect(request.assistantThreadUnits[1]).toMatchObject({
      unit_id: A2_ID, decision: 'NO_ESTABLISHMENT', no_establishment_reason: 'NO_INDEPENDENT_FOCUS', emerging_focus_id: null,
    });
  });

  it('58. the first Thread of the world gets Origin NONE, and no primary is ever invented', async () => {
    const { service, h } = build();
    await service.establish(USER, exchange);
    expect(h.commitRequests[0].userThreadUnits[0]).toMatchObject({
      unit_id: U1_ID, decision: 'ESTABLISH_THREAD', path: 'TE-01', thread_id: T_AHMED, origin_state: 'NONE', origin_thread_ids: [],
    });
  });

  it('59. a Thread established EARLIER in the same exchange becomes the later CU\'s grounded Origin', async () => {
    const { service, h } = build();
    await service.establish(USER, exchange);
    expect(h.commitRequests[0].userThreadUnits[1]).toMatchObject({
      unit_id: U2_ID, decision: 'ESTABLISH_THREAD', path: 'TE-01', thread_id: T_MANAGER,
      origin_state: 'RESOLVED', origin_thread_ids: [T_AHMED],
    });
    // And only AFTER its own CU: CU1's own origin never sees CU2's Thread.
    expect(h.commitRequests[0].userThreadUnits[0].origin_thread_ids).toEqual([]);
    expect(JSON.stringify(h.commitRequests[0].userThreadUnits[0])).not.toContain(T_MANAGER);
  });

  it('60. no Home coordinate, no prepared identity and no Thread / Origin payload reaches the wire', async () => {
    const { service, h } = build();
    const result = await service.establish(USER, exchange);
    const body = JSON.stringify(h.commitRequests[0]);
    for (const forbidden of ['placement_x', 'placement_y', 'placement_attempt', 'world_fingerprint', 'origin_fingerprint', 'address_scheme', 'session_position', 'same_sp_event_sequence', PREPARED_ID_PREFIX]) {
      expect(body.includes(forbidden)).toBe(false);
    }
    // The external delivery is exactly the T-03A2 shape.
    expect(Object.keys(result.temporal ?? {})).toEqual(['liveHead', 'committedEvents']);
    const wire = JSON.stringify(result.temporal);
    for (const forbidden of [T_AHMED, T_MANAGER, F_AHMED, F_MANAGER, 'origin', 'thread', 'home']) {
      expect(wire.includes(forbidden)).toBe(false);
    }
  });

  it('61. the commit carries the exact token the context returned, and the frozen provenance triple', async () => {
    const { service, h } = build(harness({
      contexts: () => ({ ...EMPTY_CONTEXT, token: { currentSp: 7, sameSpEventSequence: 2 } }),
    }));
    await service.establish(USER, exchange);
    const [request] = h.commitRequests;
    expect([request.expectedCurrentSp, request.expectedSameSpEventSequence]).toEqual([7, 2]);
    expect(request.threadEvaluatorVersion).toBe('thread-establishment-evaluator-v1');
    expect(request.threadPolicyVersion).toBe('stage-1.3-thread-establishment-v1');
    expect([request.threadProvider, request.threadModel, request.threadPromptVersion, request.threadSchemaVersion])
      .toEqual(['OPENAI', 'gpt-5-mini', 'thread-establishment-evidence-path-v1', 1]);
  });

  it('62. a zero / zero exchange proposes no focus and no Thread, yet still commits its technical capture once', async () => {
    const { service, h, focus, thread } = build(harness(), new RoleScriptedSegmentation(NO_SEGMENTS));
    const result = await service.establish(USER, exchange);
    expect([focus.requests, thread.requests].map((r) => r.length)).toEqual([0, 0]);
    expect(h.commitFinalizedExchangeWithFocusAndThread).toHaveBeenCalledTimes(1);
    const [request] = h.commitRequests;
    expect([request.userFocusUnits, request.assistantFocusUnits, request.userThreadUnits, request.assistantThreadUnits]).toEqual([[], [], [], []]);
    expect(request.threadEvaluatorVersion).toBe('thread-establishment-evaluator-v1');
    expect(result.temporal).toEqual({ liveHead: null, committedEvents: [] });
  });
});

describe('bounded recovery and phase separation (cases 63-73)', () => {
  const stale = () => new StaleConversationalFocusContextError();

  it('63. on a commit failure the DATABASE winner is checked first, with no second semantic pass', async () => {
    let commits = 0;
    const { service, h, focus, thread } = build(harness({
      snapshots: (batchId, call) => call === 1
        ? absent()
        : (batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4)),
      commit: async () => { commits += 1; throw stale(); },
    }));
    expect((await service.establish(USER, exchange)).temporal).toEqual({ liveHead: 4, committedEvents: [
      expect.objectContaining({ firstSp: 1, lastSp: 2 }), expect.objectContaining({ firstSp: 3, lastSp: 4 }),
    ] });
    expect(commits).toBe(1);
    expect(focus.requests).toHaveLength(4);
    expect(thread.requests).toHaveLength(2);
    expect(h.readRuntimeContext).toHaveBeenCalledTimes(1);
  });

  it('64. exactly ONE stale semantic retry, segmentation reused, and a second stale is retryable unavailability', async () => {
    const once = build(harness({ commit: async (_request, call) => { if (call === 1) throw stale(); return defaultCommit(_request); } }));
    await once.service.establish(USER, exchange);
    expect(once.h.calls).toEqual(['snapshot:USER', 'snapshot:ASSISTANT', 'context', 'commit', 'snapshot:USER', 'snapshot:ASSISTANT', 'context', 'commit']);
    expect(once.segmentation.requests).toHaveLength(2);
    expect(once.focus.requests).toHaveLength(8);
    expect(once.thread.requests).toHaveLength(4);

    const twice = build(harness({ commit: async () => { throw stale(); } }));
    expect(await unavailable(twice.service.establish(USER, exchange))).toBe('STALE_CONTEXT_RETRY_EXHAUSTED');
    expect(twice.segmentation.requests).toHaveLength(2);
    expect(twice.h.commitFinalizedExchangeWithFocusAndThread).toHaveBeenCalledTimes(2);
  });

  it('65. a non-stale commit failure never earns the semantic retry', async () => {
    const generic = new DataApiError(500, { databaseCode: '40001', databaseMessage: 'could not serialize access due to concurrent update' });
    const { service, h, focus } = build(harness({ commit: async () => { throw generic; } }));
    expect(await unavailable(service.establish(USER, exchange))).toBe('TRANSPORT_UNAVAILABLE');
    expect(h.commitFinalizedExchangeWithFocusAndThread).toHaveBeenCalledTimes(1);
    expect(focus.requests).toHaveLength(4);
  });

  it('66. a moved source frontier refuses segmentation reuse', async () => {
    const { service, segmentation } = build(harness({
      snapshots: (_batchId, call) => call === 1 ? absent() : absent({ source_frontier: 99 }),
      commit: async () => { throw stale(); },
    }));
    expect(await integrity(service.establish(USER, exchange))).toBe('SEGMENTATION_FRONTIER_MOVED');
    expect(segmentation.requests).toHaveLength(2);
  });

  it('67. a partial state discovered during recovery is integrity, never a stale retry', async () => {
    const { service, h } = build(harness({
      snapshots: (batchId, call) => call === 1 ? absent() : complete(batchId, batchId === USER_BATCH ? 'USER' : 'ASSISTANT', 1, 2, 4, { thread_capture_state: 'PARTIAL' }),
      commit: async () => { throw stale(); },
    }));
    expect(await integrity(service.establish(USER, exchange))).toBe('INCOMPLETE_THREAD_CAPTURE');
    expect(h.commitFinalizedExchangeWithFocusAndThread).toHaveBeenCalledTimes(1);
  });

  it('68. a Thread provider outage is a technical failure, never NO_ESTABLISHMENT, and never fails the turns', async () => {
    const { service, h } = build(harness(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO),
      new RecordingThreadProvider(() => new ThreadEstablishmentProviderError('UNAVAILABLE')));
    expect(await unavailable(service.establish(USER, exchange))).toBe('PROVIDER_UNAVAILABLE');
    expect(h.commitFinalizedExchangeWithFocusAndThread).not.toHaveBeenCalled();
    expect([userTurn.status, assistantTurn.status]).toEqual(['COMPLETED', 'COMPLETED']);
  });

  it('69. segmentation, focus and transport failures keep their own truthful classes', async () => {
    const segmentationOutage = build(harness(), new RoleScriptedSegmentation({ USER: new CuSegmentationProviderError('UNAVAILABLE'), ASSISTANT: [] }));
    expect(await unavailable(segmentationOutage.service.establish(USER, exchange))).toBe('PROVIDER_UNAVAILABLE');
    const focusOutage = build(harness(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(() => new FocusResolutionProviderError('TIMEOUT')));
    expect(await unavailable(focusOutage.service.establish(USER, exchange))).toBe('PROVIDER_UNAVAILABLE');
    const transport = build(harness({ commit: async () => { throw new Error('socket hang up'); } }));
    expect(await unavailable(transport.service.establish(USER, exchange))).toBe('TRANSPORT_UNAVAILABLE');
  });

  it('70. both semantic bindings are lazy: never at construction, never on replay, never on partial history', async () => {
    const explode = jest.fn(() => { throw new Error('binding must not be created'); });
    const replay = harness({ snapshots: (batchId) => complete(batchId, batchId === USER_BATCH ? 'USER' : 'ASSISTANT', 1, 2, 4) });
    const service = new ConversationThreadEstablishmentService(replay.boundary, explode, explode, explode);
    expect(explode).not.toHaveBeenCalled();
    await service.establish(USER, exchange);
    expect(explode).not.toHaveBeenCalled();
    const partial = harness({ snapshots: (batchId) => complete(batchId, batchId === USER_BATCH ? 'USER' : 'ASSISTANT', 1, 2, 4, { thread_capture_state: 'PARTIAL' }) });
    await rejection(new ConversationThreadEstablishmentService(partial.boundary, explode, explode, explode).establish(USER, exchange));
    expect(explode).not.toHaveBeenCalled();
    // And the production factories read the environment only when CALLED.
    const environment = {} as NodeJS.ProcessEnv;
    expect(() => openAiThreadEstablishmentBinding(environment)).not.toThrow();
    expect(() => openAiFocusResolutionBinding(environment)).not.toThrow();
    expect(() => openAiThreadEstablishmentBinding(environment)()).toThrow(/OPENAI_API_KEY/u);
  });

  it('71. every Thread decision of one exchange must carry the SAME provenance, or the capture is refused', async () => {
    const { service, h } = build();
    await service.establish(USER, exchange);
    const [request] = h.commitRequests;
    // One binding and one evaluator make agreement structural in the happy path.
    expect(request.threadProvider).toBe('OPENAI');
    const provenance = {
      threadEvaluatorVersion: 'thread-establishment-evaluator-v1', threadPolicyVersion: 'stage-1.3-thread-establishment-v1',
      threadProvider: 'OPENAI', threadModel: 'gpt-5-mini', threadPromptVersion: 'thread-establishment-evidence-path-v1', threadSchemaVersion: 1,
    };
    const agreeing = {
      sessionId: SESSION, cuId: U1_ID, sourceTurnId: USER_TURN, sourceRole: 'USER' as const, emergingFocusId: null,
      decision: 'NO_ESTABLISHMENT' as const, path: null, noEstablishmentReason: 'NO_INDEPENDENT_FOCUS' as const,
      evidenceCuIds: [], explicitSelectionGrounding: null,
      provenance: { evaluatorVersion: 'thread-establishment-evaluator-v1', policyVersion: 'stage-1.3-thread-establishment-v1', provider: 'OPENAI', model: 'gpt-5-mini', promptVersion: 'thread-establishment-evidence-path-v1', schemaVersion: 1 },
    };
    expect(() => assertThreadProvenanceAgreement([agreeing], provenance)).not.toThrow();
    for (const drift of [{ model: 'another-model' }, { provider: 'ANOTHER' }, { promptVersion: 'v9' }, { schemaVersion: 2 }, { evaluatorVersion: 'v9' }, { policyVersion: 'v9' }]) {
      const error = () => assertThreadProvenanceAgreement([{ ...agreeing, provenance: { ...agreeing.provenance, ...drift } }], provenance);
      expect(error).toThrow(ConversationThreadIntegrityError);
      try { error(); } catch (caught) { expect((caught as ConversationThreadIntegrityError).reason).toBe('THREAD_PROVENANCE_DISAGREEMENT'); }
    }
  });

  it('72. a canonical replay whose stored delivery is incoherent fails closed rather than being served', async () => {
    const cases: [Partial<IntegratedFocusThreadBatchSnapshot>, boolean, string][] = [
      // A live head behind the highest delivered SP is never served as truth.
      [{ live_head: 1 }, true, 'LIVE_HEAD_NOT_ESTABLISHED'],
      [{ commit_event: null }, false, 'COMMITTED_WITHOUT_DELIVERY_EVENT'],
      [{ commit_event: { commit_batch_id: USER_BATCH, user_id: USER, session_id: SESSION, source_turn_id: USER_TURN, first_sp: 1, last_sp: 9, unit_count: 2, created_at: 'now' } }, false, 'DELIVERY_RANGE_MISMATCH'],
    ];
    for (const [override, bothHalves, reason] of cases) {
      const { service } = build(harness({
        snapshots: (batchId) => batchId === USER_BATCH
          ? complete(USER_BATCH, 'USER', 1, 2, 4, override)
          : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4, bothHalves ? override : {}),
      }));
      expect(await integrity(service.establish(USER, exchange))).toBe(reason);
    }
  });

  it('73. no live provider request is ever made: every provider in this suite is an injected fake', async () => {
    const rpc = jest.fn().mockResolvedValue([absent()]);
    const repository = new ConversationThreadRuntimeRepository({ rpc } as unknown as SupabaseServiceRoleApiService);
    const explode = jest.fn(() => { throw new Error('binding must not be created'); });
    const service = new ConversationThreadEstablishmentService(repository, explode, explode, explode);
    // A real repository plus exploding factories still reaches the context read
    // before any provider could exist, so nothing network-bound is constructed.
    await rejection(service.establish(USER, exchange));
    expect(explode).not.toHaveBeenCalled();
    // Every database round trip went through the injected RPC seam, and no
    // provider adapter - and therefore no network client - was ever built.
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      'get_conversation_focus_thread_integrated_batch_snapshot_v1',
      'get_conversation_focus_thread_integrated_batch_snapshot_v1',
      'get_conversation_focus_thread_runtime_context_v1',
    ]);
  });
});
