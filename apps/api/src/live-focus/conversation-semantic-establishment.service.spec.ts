import { ServiceUnavailableException } from '@nestjs/common';
import type { ConversationLiveDelivery } from '@qandeel/runtime';
import type { ConversationTurn, OrchestratedTurnResult } from '../conversation/conversation.types';
import { DataApiError } from '../conversation/supabase-data-api.service';
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
import { type ThreadEstablishmentProposal, type ThreadEstablishmentProvider, type ThreadEstablishmentRequest } from '../thread-establishment/thread-establishment-provider.types';
import { StaleThreadIdentityContextError, type ThreadIdentityDossierPageRequest } from '../thread-lifecycle/conversation-thread-lifecycle-runtime.types';
import { durableThreadFocusBindingId } from '../thread-lifecycle/durable-thread-lifecycle-canonicalizer';
import { FakeThreadContinuityProvider } from '../thread-lifecycle/fake-thread-continuity.provider';
import type { ThreadContinuityBinding } from '../thread-lifecycle/thread-continuity-binding';
import type { ThreadContinuityProvider, ThreadContinuityResolutionProposal } from '../thread-lifecycle/thread-continuity-provider.types';
import type { ThreadIdentityDossier } from '../thread-lifecycle/thread-continuity.types';
import { ConversationSemanticEstablishmentService } from './conversation-semantic-establishment.service';
import type { ConversationSemanticRuntimeBoundary } from './conversation-semantic-runtime.repository';
import {
  ConversationSemanticIntegrityError,
  ConversationSemanticUnavailableError,
  type CommitFinalizedExchangeWithFullSemanticChainRequest,
  type ConversationSemanticRuntimeContext,
  type FinalizedExchangeWithFullSemanticChainResult,
  type IntegratedFullSemanticBatchSnapshot,
  type StoredLiveFocusTransition,
} from './conversation-semantic-runtime.types';
import { durableLiveFocusTransitionId } from './durable-live-focus-canonicalizer';
import { LIVE_FOCUS_REDUCER_VERSION, type EffectiveLiveFocus } from './live-focus.types';

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
const F_AHMED = durableEmergingFocusId(SESSION, U1_ID);
const T_AHMED = durableThreadId(USER, F_AHMED);
const F_MANAGER = durableEmergingFocusId(SESSION, U2_ID);
const T_MANAGER = durableThreadId(USER, F_MANAGER);
const H_AHMED = durableReferenceHandleId(SESSION, U1_ID, 0);
const OLD_SESSION = '55555555-5555-4555-8555-555555555555';
const OLD_CU = '66666666-6666-4666-8666-666666666666';
const T_OLD_AHMED = '77777777-7777-5777-8777-777777777777';
const T_OLD_BROTHER = '88888888-8888-5888-8888-888888888888';
const dossierOf = (threadId: string, surface = 'أحمد'): ThreadIdentityDossier => ({
  threadId, identityEvidence: [{ sessionId: OLD_SESSION, cuId: OLD_CU, exactSurface: surface, committedCuText: `${surface} نفسه بدأ يقلقني.`, sourceRole: 'USER' }],
});
const NONE: EffectiveLiveFocus = { kind: 'NONE' };
const emerging = (id: string): EffectiveLiveFocus => ({ kind: 'EMERGING', emergingFocusId: id });
const thread = (id: string): EffectiveLiveFocus => ({ kind: 'THREAD', threadId: id });

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
  constructor(private readonly answer: (request: ThreadEstablishmentRequest) => ThreadEstablishmentProposal) {}
  async propose(request: ThreadEstablishmentRequest): Promise<ThreadEstablishmentProposal> {
    this.requests.push(JSON.parse(JSON.stringify(request)) as ThreadEstablishmentRequest);
    await new Promise((resolve) => setTimeout(resolve, 1));
    return this.answer(request);
  }
}

const NO_FOCUS: FocusResolutionProposal = {
  functions: ['INFORM_REPORT'], sequencePosition: 'UNMARKED', targetCuId: null, references: [], claimAttributions: [],
  attention: { kind: 'NO_INDEPENDENT_FOCUS', existingFocusCandidateId: null, groundingAnchor: null, reason: 'INCIDENTAL_OR_SUBORDINATE' },
};
const AHMED_REF = { anchor: { text: 'أحمد', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: `${PREPARED_ID_PREFIX}reference:${U1_ID}:0`, candidateHandleIds: [], newReference: false } as const;
/**
 * USER CU1 starts Ahmed's focus; USER CU2 explicitly shifts to the manager;
 * ASSISTANT CU1 attends Ahmed (a return); ASSISTANT CU2 has no independent
 * focus. The T-03B3 scenario, unchanged.
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
      references: [{ anchor: { text: 'المدير', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: null, candidateHandleIds: [], newReference: true }, AHMED_REF],
      attention: { kind: 'START_NEW_FOCUS', existingFocusCandidateId: null, groundingAnchor: { text: 'المدير', occurrence: 1 }, reason: 'EXPLICIT_FOCUS_SHIFT' },
    };
  }
  if (request.currentCu.cuId === A1_ID) {
    return {
      ...NO_FOCUS, functions: ['ASK'], sequencePosition: 'RESPONSIVE', targetCuId: U1_ID,
      references: [AHMED_REF],
      attention: { kind: 'ATTEND_EXISTING_FOCUS', existingFocusCandidateId: `${PREPARED_ID_PREFIX}focus:${U1_ID}`, groundingAnchor: null, reason: 'DIRECT_REQUEST_OR_QUESTION' },
    };
  }
  return NO_FOCUS;
};
/** The same scenario, but the assistant's LAST CU is a committed FOCUS_SHIFT with no replacement and no anchoring target. */
const DEPARTURE_SCENARIO = (request: FocusResolutionRequest): FocusResolutionProposal => {
  if (request.currentCu.cuId === A2_ID) {
    return { ...NO_FOCUS, functions: ['ASK', 'FOCUS_SHIFT'], attention: NO_FOCUS.attention };
  }
  return FOCUS_SCENARIO(request);
};
/** The departure CU points at U1 (Ahmed's own focus), so it anchors to the prior LF and LF stays. */
const ANCHORED_DEPARTURE_SCENARIO = (request: FocusResolutionRequest): FocusResolutionProposal => {
  if (request.currentCu.cuId === A2_ID) {
    return { ...NO_FOCUS, functions: ['ASK', 'FOCUS_SHIFT'], sequencePosition: 'RESPONSIVE', targetCuId: U1_ID, attention: NO_FOCUS.attention };
  }
  return FOCUS_SCENARIO(request);
};
/** A local clarification with a FOCUS_SHIFT function never clears LF. */
const CLARIFICATION_SCENARIO = (request: FocusResolutionRequest): FocusResolutionProposal => {
  if (request.currentCu.cuId === A2_ID) {
    return { ...NO_FOCUS, functions: ['ASK', 'FOCUS_SHIFT'], attention: { ...NO_FOCUS.attention, reason: 'LOCAL_CLARIFICATION_OR_CORRECTION' } };
  }
  return FOCUS_SCENARIO(request);
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
const NO_THREAD = (): ThreadEstablishmentProposal => ({ decision: 'NO_ESTABLISHMENT', path: null, evidenceCuIds: [], explicitSelectionAnchor: null });
const DISTINCT: ThreadContinuityResolutionProposal = { decision: 'DISTINCT_NEW', threadId: null, candidateThreadIds: [], currentEvidenceReferenceIndexes: [], priorEvidenceRefs: [] };
const bindOld = (threadId: string): ThreadContinuityResolutionProposal => ({ decision: 'BIND_EXISTING', threadId, candidateThreadIds: [], currentEvidenceReferenceIndexes: [0], priorEvidenceRefs: [{ cuId: OLD_CU, exactSurface: 'أحمد' }] });

const segmentationBinding = (provider: CuSegmentationProvider): CuSegmentationBinding => ({ provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' });
const focusBinding = (provider: FocusResolutionProvider): FocusResolutionBinding => ({ provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' });
const threadBinding = (provider: ThreadEstablishmentProvider): ThreadEstablishmentBinding => ({ provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' });
const continuityBinding = (provider: ThreadContinuityProvider): ThreadContinuityBinding => ({ provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' });

const EMPTY_CONTEXT: ConversationSemanticRuntimeContext = {
  sessionId: SESSION, token: { currentSp: null, sameSpEventSequence: 0 },
  priorContext: { priorCus: [], referenceHandles: [], focusCandidates: [], currentFocusCandidateId: null },
  priorFocusSemantics: [], focusAttentionHistory: [], establishedThreadBindings: [],
  worldThreadIdentityVersion: 0, sessionFocusThreadBindings: [], sessionThreadLifecycleHistory: [],
  currentLiveFocus: NONE, currentLiveFocusSp: null,
};
const absent = (overrides: Partial<IntegratedFullSemanticBatchSnapshot> = {}): IntegratedFullSemanticBatchSnapshot => ({
  batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null,
  focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false,
  thread_capture_state: 'ABSENT', thread_batch_exists: false, thread_unit_count: 0, thread_establishment_count: 0,
  thread_semantic_capture_state: 'ABSENT', thread_semantic_batch_exists: false, thread_semantic_unit_count: 0, continuity_binding_count: 0, lifecycle_transition_count: 0,
  full_semantic_capture_state: 'ABSENT', live_focus_batch_exists: false, live_focus_unit_count: 0, live_focus_transition_count: 0,
  live_focus_transitions: [], session_live_focus: NONE, session_live_focus_sp: null,
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
function complete(batchId: string, role: 'USER' | 'ASSISTANT', firstSp: number, count: number, liveHead: number | null, overrides: Partial<IntegratedFullSemanticBatchSnapshot> = {}): IntegratedFullSemanticBatchSnapshot {
  const units = Array.from({ length: count }, (_v, index) => unit(batchId, index, firstSp + index, role));
  return {
    batch_exists: true, committed_unit_count: count, units,
    commit_event: count === 0 ? null : { commit_batch_id: batchId, user_id: USER, session_id: SESSION, source_turn_id: role === 'USER' ? USER_TURN : ASSISTANT_TURN, first_sp: firstSp, last_sp: firstSp + count - 1, unit_count: count, created_at: 'now' },
    source_frontier: count * 10, live_head: liveHead,
    focus_batch_exists: true, focus_semantic_count: count, focus_attention_count: count, focus_complete: true,
    thread_capture_state: 'COMPLETE', thread_batch_exists: true, thread_unit_count: count, thread_establishment_count: 0,
    thread_semantic_capture_state: 'COMPLETE', thread_semantic_batch_exists: true, thread_semantic_unit_count: count, continuity_binding_count: 0, lifecycle_transition_count: 0,
    full_semantic_capture_state: 'COMPLETE', live_focus_batch_exists: true, live_focus_unit_count: count, live_focus_transition_count: 0,
    live_focus_transitions: [], session_live_focus: NONE, session_live_focus_sp: null,
    ...overrides,
  };
}

interface Harness {
  snapshots: (batchId: string, call: number) => IntegratedFullSemanticBatchSnapshot;
  contexts: (call: number) => ConversationSemanticRuntimeContext;
  dossiers: (request: ThreadIdentityDossierPageRequest, call: number) => readonly ThreadIdentityDossier[];
  commit: (request: CommitFinalizedExchangeWithFullSemanticChainRequest, call: number) => Promise<FinalizedExchangeWithFullSemanticChainResult>;
}
/** The default fake coordinator: it derives the delivery facts from the request exactly as the 0071 coordinator would. */
function defaultCommit(request: CommitFinalizedExchangeWithFullSemanticChainRequest): FinalizedExchangeWithFullSemanticChainResult {
  const u = request.userUnits.length;
  const a = request.assistantUnits.length;
  const lfUnits = [...request.userLiveFocusUnits, ...request.assistantLiveFocusUnits];
  const transitions: StoredLiveFocusTransition[] = [];
  let liveFocus: EffectiveLiveFocus = NONE;
  let liveFocusSp: number | null = null;
  lfUnits.forEach((payload, index) => {
    if (!payload.transition) return;
    liveFocus = payload.effective_kind === 'NONE' ? NONE : payload.effective_kind === 'EMERGING' ? emerging(payload.effective_ref as string) : thread(payload.effective_ref as string);
    liveFocusSp = index + 1;
    transitions.push({ sessionPosition: index + 1, to: liveFocus });
  });
  return {
    live_head: u + a === 0 ? null : u + a,
    same_sp_event_sequence: u + a === 0 ? 0 : transitions.length > 0 ? 3 : 2,
    world_thread_identity_version: request.expectedWorldThreadIdentityVersion,
    live_focus: liveFocus, live_focus_sp: liveFocusSp, live_focus_transitions: transitions,
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
  const commitRequests: CommitFinalizedExchangeWithFullSemanticChainRequest[] = [];
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
  const commitFinalizedExchangeWithFullSemanticChain = jest.fn(async (request: CommitFinalizedExchangeWithFullSemanticChainRequest) => {
    calls.push('commit');
    commitCalls += 1;
    commitRequests.push(request);
    return (overrides.commit ?? (async (r) => defaultCommit(r)))(request, commitCalls);
  });
  const boundary: ConversationSemanticRuntimeBoundary = { readIntegratedBatchSnapshot, readRuntimeContext, readIdentityDossierPage, commitFinalizedExchangeWithFullSemanticChain };
  return { boundary, calls, commitRequests, dossierRequests, readIntegratedBatchSnapshot, readRuntimeContext, readIdentityDossierPage, commitFinalizedExchangeWithFullSemanticChain };
}
function build(
  h = harness(),
  segmentation = new RoleScriptedSegmentation(SEGMENTS),
  focus = new RecordingFocusProvider(FOCUS_SCENARIO),
  threadProvider = new RecordingThreadProvider(THREAD_SCENARIO),
  continuity = FakeThreadContinuityProvider.nominatingAll(DISTINCT),
) {
  const segmentationFactory = jest.fn(() => segmentationBinding(segmentation));
  const focusFactory = jest.fn(() => focusBinding(focus));
  const threadFactory = jest.fn(() => threadBinding(threadProvider));
  const continuityFactory = jest.fn(() => continuityBinding(continuity));
  const service = new ConversationSemanticEstablishmentService(h.boundary, segmentationFactory, focusFactory, threadFactory, continuityFactory);
  return { service, h, segmentation, focus, thread: threadProvider, continuity, segmentationFactory, focusFactory, threadFactory, continuityFactory };
}
const rejection = async (promise: Promise<unknown>) => {
  try { await promise; } catch (error) { return error; }
  throw new Error('expected a rejection');
};
const integrity = async (promise: Promise<unknown>) => {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(ConversationSemanticIntegrityError);
  return (error as ConversationSemanticIntegrityError).reason;
};
const unavailable = async (promise: Promise<unknown>) => {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(ConversationSemanticUnavailableError);
  return (error as ConversationSemanticUnavailableError).reason;
};
const providerCounts = (b: ReturnType<typeof build>) => [b.segmentation.requests.length, b.focus.requests.length, b.thread.requests.length, b.continuity.screeningRequests.length, b.continuity.resolutionRequests.length];
const lfOf = (request: CommitFinalizedExchangeWithFullSemanticChainRequest) =>
  [...request.userLiveFocusUnits, ...request.assistantLiveFocusUnits].map((u) => [u.unit_id, u.effective_kind, u.effective_ref, u.transition, u.reason_code]);
const worldWithOldAhmed = (extra: readonly ThreadIdentityDossier[] = []) => harness({
  contexts: () => ({ ...EMPTY_CONTEXT, worldThreadIdentityVersion: 3 }),
  dossiers: () => [dossierOf(T_OLD_AHMED), ...extra].sort((a, b) => (a.threadId < b.threadId ? -1 : 1)),
});
const focusStale = () => new StaleConversationalFocusContextError();
const identityStale = () => new StaleThreadIdentityContextError();
const live = (result: OrchestratedTurnResult) => result.temporal as ConversationLiveDelivery;

describe('relation gate, replay and FINAL capture-state gate (cases 52-58)', () => {
  it('52. an invalid finalized relation costs zero providers, zero reads and zero writes; the direct boundary refuses it first and outside the try', async () => {
    for (const bad of [
      turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', source_turn_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
      turn({ id: ASSISTANT_TURN, role: 'USER', source_turn_id: USER_TURN }),
      turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', session_id: OLD_SESSION, source_turn_id: USER_TURN }),
      turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', source_turn_id: USER_TURN, status: 'GENERATING' as never }),
    ]) {
      const b = build();
      expect(await integrity(b.service.establishExchange(USER, userTurn, bad))).toBe('INVALID_FINALIZED_EXCHANGE_RELATION');
      expect(b.h.calls).toEqual([]);
      expect(providerCounts(b)).toEqual([0, 0, 0, 0, 0]);
      expect([b.segmentationFactory, b.focusFactory, b.threadFactory, b.continuityFactory].every((f) => f.mock.calls.length === 0)).toBe(true);
      const error = await rejection(b.service.establishExchange(USER, userTurn, bad));
      expect(error).not.toBeInstanceOf(ConversationSemanticUnavailableError);
    }
    const { service } = build();
    const pending = { userTurn, assistantTurn: turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', status: 'GENERATING' as never, source_turn_id: USER_TURN }) };
    expect(await service.establish(USER, pending)).toBe(pending);
    expect(await service.establish(USER, { userTurn })).toEqual({ userTurn });
  });

  it('53. COMPLETE + COMPLETE at the FINAL layer is canonical replay: stored LH, LF and transitions, zero providers, zero context, zero dossiers', async () => {
    const b = build(harness({
      snapshots: (batchId) => batchId === USER_BATCH
        ? complete(USER_BATCH, 'USER', 1, 2, 4, { live_focus_transition_count: 2, live_focus_transitions: [{ sessionPosition: 1, to: thread(T_AHMED) }, { sessionPosition: 2, to: thread(T_MANAGER) }], session_live_focus: thread(T_AHMED), session_live_focus_sp: 3 })
        : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4, { live_focus_transition_count: 1, live_focus_transitions: [{ sessionPosition: 3, to: thread(T_AHMED) }], session_live_focus: thread(T_AHMED), session_live_focus_sp: 3 }),
    }));
    const result = await b.service.establish(USER, exchange);
    expect(result.temporal).toEqual({
      liveHead: 4,
      liveFocus: { kind: 'THREAD', threadId: T_AHMED },
      committedEvents: [
        expect.objectContaining({ type: 'CONVERSATIONAL_UNITS_COMMITTED', version: 1, firstSp: 1, lastSp: 2, unitCount: 2, sourceTurnId: USER_TURN }),
        expect.objectContaining({ firstSp: 3, lastSp: 4, unitCount: 2, sourceTurnId: ASSISTANT_TURN }),
      ],
      liveFocusTransitions: [
        { type: 'LIVE_FOCUS_TRANSITION', version: 1, sessionId: SESSION, atSp: 1, value: { kind: 'THREAD', threadId: T_AHMED } },
        { type: 'LIVE_FOCUS_TRANSITION', version: 1, sessionId: SESSION, atSp: 2, value: { kind: 'THREAD', threadId: T_MANAGER } },
        { type: 'LIVE_FOCUS_TRANSITION', version: 1, sessionId: SESSION, atSp: 3, value: { kind: 'THREAD', threadId: T_AHMED } },
      ],
    });
    expect(providerCounts(b)).toEqual([0, 0, 0, 0, 0]);
    expect(b.h.calls).toEqual(['snapshot:USER', 'snapshot:ASSISTANT']);
    expect([b.segmentationFactory, b.focusFactory, b.threadFactory, b.continuityFactory].every((f) => f.mock.calls.length === 0)).toBe(true);
  });

  it('54. a committed zero-CU pair that is FINAL-complete replays with zero providers and LF NONE', async () => {
    const b = build(harness({ snapshots: (batchId) => complete(batchId, batchId === USER_BATCH ? 'USER' : 'ASSISTANT', 1, 0, null) }));
    expect((await b.service.establish(USER, exchange)).temporal).toEqual({ liveHead: null, liveFocus: { kind: 'NONE' }, committedEvents: [], liveFocusTransitions: [] });
    expect(providerCounts(b)).toEqual([0, 0, 0, 0, 0]);
  });

  it('55. one canonical half and one absent half fails closed before any provider', async () => {
    const b = build(harness({ snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 2) : absent() }));
    expect(await integrity(b.service.establishExchange(USER, userTurn, assistantTurn))).toBe('PARTIAL_INTEGRATED_EXCHANGE');
    expect(providerCounts(b)).toEqual([0, 0, 0, 0, 0]);
    expect(b.h.readRuntimeContext).not.toHaveBeenCalled();
  });

  it('56. every PARTIAL shape - legacy T-03A2-only, B1-only, B2-only, B3-only (0070 COMPLETE without 0071), corrupt LF - fails closed before providers and is never upgraded', async () => {
    for (const partial of [
      { full_semantic_capture_state: 'PARTIAL' as const, thread_semantic_capture_state: 'PARTIAL' as const, thread_capture_state: 'PARTIAL' as const, focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false, thread_batch_exists: false, thread_unit_count: 0, thread_semantic_batch_exists: false, thread_semantic_unit_count: 0, live_focus_batch_exists: false, live_focus_unit_count: 0 },
      { full_semantic_capture_state: 'PARTIAL' as const, thread_semantic_capture_state: 'PARTIAL' as const, thread_capture_state: 'PARTIAL' as const, thread_batch_exists: false, thread_unit_count: 0, thread_semantic_batch_exists: false, thread_semantic_unit_count: 0, live_focus_batch_exists: false, live_focus_unit_count: 0 },
      { full_semantic_capture_state: 'PARTIAL' as const, thread_semantic_capture_state: 'PARTIAL' as const, thread_semantic_batch_exists: false, thread_semantic_unit_count: 0, live_focus_batch_exists: false, live_focus_unit_count: 0 },
      { full_semantic_capture_state: 'PARTIAL' as const, live_focus_batch_exists: false, live_focus_unit_count: 0 },
      { full_semantic_capture_state: 'PARTIAL' as const },
    ]) {
      const b = build(harness({ snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4, partial) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4) }));
      expect(await integrity(b.service.establishExchange(USER, userTurn, assistantTurn))).toBe('INCOMPLETE_FULL_SEMANTIC_CAPTURE');
      expect(providerCounts(b)).toEqual([0, 0, 0, 0, 0]);
      expect(b.h.commitFinalizedExchangeWithFullSemanticChain).not.toHaveBeenCalled();
    }
  });

  it('57. a canonical replay whose stored delivery is incoherent fails closed rather than being served', async () => {
    for (const [override, bothHalves, reason] of [
      [{ live_head: 1 }, true, 'LIVE_HEAD_NOT_ESTABLISHED'],
      [{ commit_event: null }, false, 'COMMITTED_WITHOUT_DELIVERY_EVENT'],
      [{ commit_event: { commit_batch_id: USER_BATCH, user_id: USER, session_id: SESSION, source_turn_id: USER_TURN, first_sp: 1, last_sp: 9, unit_count: 2, created_at: 'now' } }, false, 'DELIVERY_RANGE_MISMATCH'],
      [{ live_focus_transition_count: 1, live_focus_transitions: [{ sessionPosition: 9, to: thread(T_AHMED) }], session_live_focus: thread(T_AHMED), session_live_focus_sp: 9 }, false, 'LIVE_FOCUS_DELIVERY_MISMATCH'],
      [{ live_focus_transition_count: 1, live_focus_transitions: [{ sessionPosition: 2, to: thread(T_AHMED) }], session_live_focus: thread(T_AHMED), session_live_focus_sp: 1 }, false, 'LIVE_FOCUS_DELIVERY_MISMATCH'],
    ] as const) {
      const b = build(harness({
        snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4, override) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4, bothHalves ? override : {}),
      }));
      expect(await integrity(b.service.establishExchange(USER, userTurn, assistantTurn))).toBe(reason);
    }
  });

  it('58. establish() wraps every failure as a retryable service-unavailable response, naming integrity separately, and never touches the turns', async () => {
    const partial = build(harness({ snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 2) : absent() }));
    const error = await rejection(partial.service.establish(USER, exchange));
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).message).toContain('integrity');
    const outage = build(harness(), new RoleScriptedSegmentation({ USER: new CuSegmentationProviderError('PROVIDER_ERROR'), ASSISTANT: SEGMENTS.ASSISTANT }));
    const outageError = await rejection(outage.service.establish(USER, exchange));
    expect(outageError).toBeInstanceOf(ServiceUnavailableException);
    expect((outageError as ServiceUnavailableException).message).toContain('unavailable');
    expect(JSON.stringify(exchange)).toBe(JSON.stringify({ userTurn, assistantTurn }));
  });
});

describe('the finalized-exchange FINAL chain with effective LF (cases 59-71)', () => {
  it('59. the whole chain runs in exactly one order with exactly one coordinator call, and LF costs no provider and no read', async () => {
    const b = build();
    await b.service.establish(USER, exchange);
    expect(b.h.calls).toEqual(['snapshot:USER', 'snapshot:ASSISTANT', 'context', 'dossiers', 'commit']);
    expect(b.h.commitFinalizedExchangeWithFullSemanticChain).toHaveBeenCalledTimes(1);
    expect(b.h.readRuntimeContext).toHaveBeenCalledTimes(1);
    expect(providerCounts(b)).toEqual([2, 4, 2, 0, 0]);
  });

  it('60. LF-01 / LF-03 / LF-02: a same-Moment promotion makes LF the new Thread, an explicit shift replaces it, a return restores it, and an unfocused CU leaves it unchanged', async () => {
    const b = build();
    const result = await b.service.establish(USER, exchange);
    const [request] = b.h.commitRequests;
    expect(lfOf(request)).toEqual([
      [U1_ID, 'THREAD', T_AHMED, true, 'NEW_INDEPENDENT_FOCUS'],
      [U2_ID, 'THREAD', T_MANAGER, true, 'FOCUS_REPLACEMENT'],
      [A1_ID, 'THREAD', T_AHMED, true, 'RETURN_TO_THREAD'],
      [A2_ID, 'THREAD', T_AHMED, false, null],
    ]);
    expect(request.userLiveFocusUnits[0].transition_event_id).toBe(durableLiveFocusTransitionId(SESSION, U1_ID, thread(T_AHMED)));
    expect(request.assistantLiveFocusUnits[1].transition_event_id).toBeNull();
    expect(request.lfReducerVersion).toBe(LIVE_FOCUS_REDUCER_VERSION);
    expect(result.temporal).toEqual({
      liveHead: 4,
      liveFocus: { kind: 'THREAD', threadId: T_AHMED },
      committedEvents: [expect.objectContaining({ firstSp: 1, lastSp: 2 }), expect.objectContaining({ firstSp: 3, lastSp: 4 })],
      liveFocusTransitions: [
        expect.objectContaining({ atSp: 1, value: { kind: 'THREAD', threadId: T_AHMED } }),
        expect.objectContaining({ atSp: 2, value: { kind: 'THREAD', threadId: T_MANAGER } }),
        expect.objectContaining({ atSp: 3, value: { kind: 'THREAD', threadId: T_AHMED } }),
      ],
    });
  });

  it('61. without a Thread layer the effective LF is the Emerging Focus itself; each explicit start replaces it', async () => {
    const b = build(harness(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(NO_THREAD));
    await b.service.establish(USER, exchange);
    expect(lfOf(b.h.commitRequests[0])).toEqual([
      [U1_ID, 'EMERGING', F_AHMED, true, 'NEW_INDEPENDENT_FOCUS'],
      [U2_ID, 'EMERGING', F_MANAGER, true, 'FOCUS_REPLACEMENT'],
      [A1_ID, 'EMERGING', F_AHMED, true, 'FOCUS_REPLACEMENT'],
      [A2_ID, 'EMERGING', F_AHMED, false, null],
    ]);
  });

  it('62. cross-Session continuity binds the reused Thread as LF at the same Moment; same-name ambiguity keeps LF at the Emerging Focus', async () => {
    const binding = new FakeThreadContinuityProvider(
      (request) => ({ possibleSameThreadIds: request.candidates.map((c) => c.threadId) }),
      (request) => request.currentCu.cuId === U1_ID ? bindOld(T_OLD_AHMED) : DISTINCT,
    );
    const bound = build(worldWithOldAhmed(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(THREAD_SCENARIO), binding);
    await bound.service.establish(USER, exchange);
    expect(lfOf(bound.h.commitRequests[0])[0]).toEqual([U1_ID, 'THREAD', T_OLD_AHMED, true, 'NEW_INDEPENDENT_FOCUS']);
    expect(lfOf(bound.h.commitRequests[0])[2]).toEqual([A1_ID, 'THREAD', T_OLD_AHMED, true, 'RETURN_TO_THREAD']);
    const ambiguous = new FakeThreadContinuityProvider(
      (request) => ({ possibleSameThreadIds: request.candidates.map((c) => c.threadId) }),
      (request) => request.currentCu.cuId === U1_ID
        ? { decision: 'AMBIGUOUS_EXISTING', threadId: null, candidateThreadIds: [T_OLD_BROTHER, T_OLD_AHMED], currentEvidenceReferenceIndexes: [], priorEvidenceRefs: [] }
        : DISTINCT,
    );
    const b = build(worldWithOldAhmed([dossierOf(T_OLD_BROTHER)]), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(THREAD_SCENARIO), ambiguous);
    await b.service.establish(USER, exchange);
    expect(lfOf(b.h.commitRequests[0])[0]).toEqual([U1_ID, 'EMERGING', F_AHMED, true, 'NEW_INDEPENDENT_FOCUS']);
  });

  it('63. LF-04 + R1-01: a committed FOCUS_SHIFT with no replacement clears an Emerging LF; it never departs a Thread the frozen B3 lifecycle leaves ACTIVE at that same Moment', async () => {
    // Emerging prior (no Thread layer): the departure lands at A2 and nowhere earlier.
    const emerging = build(harness(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(DEPARTURE_SCENARIO), new RecordingThreadProvider(NO_THREAD));
    const departed = await emerging.service.establish(USER, exchange);
    expect(lfOf(emerging.h.commitRequests[0])[3]).toEqual([A2_ID, 'NONE', null, true, 'STABLE_DEPARTURE_NO_REPLACEMENT']);
    expect(lfOf(emerging.h.commitRequests[0]).slice(0, 3).map((u) => u[1])).toEqual(['EMERGING', 'EMERGING', 'EMERGING']);
    expect(live(departed).liveFocus).toEqual({ kind: 'NONE' });
    expect(live(departed).liveFocusTransitions.at(-1)).toEqual(expect.objectContaining({ atSp: 4, value: { kind: 'NONE' } }));
    // Thread prior: the same CU is not "away" for the frozen B3 reducer (no lifecycle transition, Ahmed stays ACTIVE),
    // so the canonical chain keeps LF = THREAD(ahmed). The contradictory pair is never authored.
    const b = build(harness(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(DEPARTURE_SCENARIO));
    const result = await b.service.establish(USER, exchange);
    const [request] = b.h.commitRequests;
    expect(request.assistantLifecycleUnits[1]).toMatchObject({ unit_id: A2_ID, outcome: 'NO_THREAD_ACTION', lifecycle_transitions: [] });
    expect(lfOf(request)[3]).toEqual([A2_ID, 'THREAD', T_AHMED, false, null]);
    expect(live(result).liveFocus).toEqual({ kind: 'THREAD', threadId: T_AHMED });
    expect(live(result).liveFocusTransitions).toHaveLength(3);
    expect(JSON.stringify(request.assistantLiveFocusUnits).includes('STABLE_DEPARTURE_NO_REPLACEMENT')).toBe(false);
  });

  it('64. LF-04 is conservative: a shift anchored to the prior LF, or a local clarification, never clears LF', async () => {
    for (const scenario of [ANCHORED_DEPARTURE_SCENARIO, CLARIFICATION_SCENARIO]) {
      const b = build(harness(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(scenario));
      const result = await b.service.establish(USER, exchange);
      expect(lfOf(b.h.commitRequests[0])[3]).toEqual([A2_ID, 'THREAD', T_AHMED, false, null]);
      expect(live(result).liveFocus).toEqual({ kind: 'THREAD', threadId: T_AHMED });
      expect(live(result).liveFocusTransitions).toHaveLength(3);
    }
  });

  it('65. the prior LF of the first CU is the context\'s current LF, and an earlier same-exchange LF is the prior LF of every later CU', async () => {
    const PRIOR_F = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
    const PRIOR_T = durableThreadId(USER, PRIOR_F);
    const PRIOR_CU = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    const PRIOR_H = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
    const context: ConversationSemanticRuntimeContext = {
      ...EMPTY_CONTEXT, token: { currentSp: 1, sameSpEventSequence: 3 }, worldThreadIdentityVersion: 1,
      priorContext: {
        priorCus: [{ cuId: PRIOR_CU, sourceTurnId: '99999999-9999-4999-8999-999999999991', sourceRole: 'USER', committedText: 'الشغل بقى ضاغط.', ordinalWithinTurn: 0, functions: ['INFORM_REPORT'], sequencePosition: 'UNMARKED', targetCuId: null }],
        referenceHandles: [{ handleId: PRIOR_H, grounding: [{ cuId: PRIOR_CU, exactSurface: 'الشغل' }] }],
        focusCandidates: [{ focusCandidateId: PRIOR_F, groundingHandleIds: [PRIOR_H], priorGroundingCuIds: [PRIOR_CU] }],
        currentFocusCandidateId: PRIOR_F,
      },
      priorFocusSemantics: [{ unit_id: PRIOR_CU, functions: ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null, claim_attributions: [],
        references: [{ reference_index: 0, anchor_text: 'الشغل', anchor_occurrence: 1, span_start: 0, span_end: 5, state: 'RESOLVED', resolved_handle_id: PRIOR_H, creates_handle: true, candidate_handle_ids: [] }],
        attention: { kind: 'START_NEW_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: PRIOR_F, creates_focus: true, grounding_reference_index: 0 } }],
      focusAttentionHistory: [{ cuId: PRIOR_CU, attentionKind: 'START_NEW_FOCUS', attentionReason: 'DIRECT_SUBJECT', emergingFocusId: PRIOR_F }],
      establishedThreadBindings: [{ threadId: PRIOR_T, emergingFocusId: PRIOR_F, establishedCuId: PRIOR_CU, establishedSp: 1 }],
      sessionFocusThreadBindings: [{ bindingId: durableThreadFocusBindingId(SESSION, PRIOR_F, PRIOR_T), threadId: PRIOR_T, emergingFocusId: PRIOR_F, boundCuId: PRIOR_CU, boundSp: 1, bindingKind: 'ESTABLISHMENT' }],
      currentLiveFocus: thread(PRIOR_T), currentLiveFocusSp: 1,
    };
    const b = build(harness({ contexts: () => context }));
    await b.service.establish(USER, exchange);
    const [request] = b.h.commitRequests;
    // U1 replaces the prior Work Thread (not a fresh NEW_INDEPENDENT_FOCUS), and A1 returns to Ahmed set earlier in this exchange.
    expect(lfOf(request)).toEqual([
      [U1_ID, 'THREAD', T_AHMED, true, 'FOCUS_REPLACEMENT'],
      [U2_ID, 'THREAD', T_MANAGER, true, 'FOCUS_REPLACEMENT'],
      [A1_ID, 'THREAD', T_AHMED, true, 'RETURN_TO_THREAD'],
      [A2_ID, 'THREAD', T_AHMED, false, null],
    ]);
    expect([request.expectedCurrentSp, request.expectedSameSpEventSequence, request.expectedWorldThreadIdentityVersion]).toEqual([1, 3, 1]);
  });

  it('66. a later CU never alters an earlier LF: the reduction is sequential and the payloads are fixed before the commit', async () => {
    const b = build(harness(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(DEPARTURE_SCENARIO), new RecordingThreadProvider(NO_THREAD));
    await b.service.establish(USER, exchange);
    const [request] = b.h.commitRequests;
    const b2 = build(harness(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(NO_THREAD));
    await b2.service.establish(USER, exchange);
    // The first three LF payloads are identical whether or not the fourth CU departs.
    expect(lfOf(request).slice(0, 3)).toEqual(lfOf(b2.h.commitRequests[0]).slice(0, 3));
    expect(lfOf(request)[3][1]).toBe('NONE');
  });

  it('67. the whole exchange is canonicalized ONCE per layer and split by the exact USER / ASSISTANT counts; no prepared id, Home, label or sequence reaches the commit or the wire', async () => {
    const b = build();
    const result = await b.service.establish(USER, exchange);
    const [request] = b.h.commitRequests;
    expect(request.userLiveFocusUnits.map((u) => u.unit_id)).toEqual([U1_ID, U2_ID]);
    expect(request.assistantLiveFocusUnits.map((u) => u.unit_id)).toEqual([A1_ID, A2_ID]);
    expect(request.userLifecycleUnits.map((u) => u.unit_id)).toEqual([U1_ID, U2_ID]);
    expect(request.assistantFocusUnits.map((u) => u.unit_id)).toEqual([A1_ID, A2_ID]);
    const body = JSON.stringify(request);
    for (const forbidden of ['placement_x', 'home_x', 'address_scheme', 'session_position', 'same_sp_event_sequence', 'label', 'confidence', PREPARED_ID_PREFIX]) {
      expect(body.includes(forbidden)).toBe(false);
    }
    expect(Object.keys(result.temporal ?? {})).toEqual(['liveHead', 'liveFocus', 'committedEvents', 'liveFocusTransitions']);
    const wire = JSON.stringify(result.temporal);
    for (const forbidden of [F_AHMED, F_MANAGER, H_AHMED, 'home', 'lifecycle', 'DORMANT', 'binding', 'reason', 'label', 'sequence']) {
      expect(wire.includes(forbidden)).toBe(false);
    }
    // Only the reference identity of the current LF and of each transition crosses.
    expect(wire.includes(T_AHMED)).toBe(true);
  });

  it('68. a zero / zero exchange proposes nothing, reduces nothing, and commits its technical capture once with LF unchanged', async () => {
    const b = build(harness(), new RoleScriptedSegmentation(NO_SEGMENTS));
    const result = await b.service.establish(USER, exchange);
    expect(providerCounts(b)).toEqual([2, 0, 0, 0, 0]);
    expect(b.h.commitFinalizedExchangeWithFullSemanticChain).toHaveBeenCalledTimes(1);
    const [request] = b.h.commitRequests;
    expect([request.userLiveFocusUnits, request.assistantLiveFocusUnits, request.userLifecycleUnits, request.assistantFocusUnits]).toEqual([[], [], [], []]);
    expect(result.temporal).toEqual({ liveHead: null, liveFocus: { kind: 'NONE' }, committedEvents: [], liveFocusTransitions: [] });
  });

  it('69. every binding is created lazily on first need, never at construction, and never during replay', async () => {
    const replay = build(harness({ snapshots: (batchId) => complete(batchId, batchId === USER_BATCH ? 'USER' : 'ASSISTANT', 1, 0, null) }));
    await replay.service.establish(USER, exchange);
    expect([replay.segmentationFactory, replay.focusFactory, replay.threadFactory, replay.continuityFactory].map((f) => f.mock.calls.length)).toEqual([0, 0, 0, 0]);
    const b = build();
    expect([b.segmentationFactory, b.focusFactory, b.threadFactory, b.continuityFactory].map((f) => f.mock.calls.length)).toEqual([0, 0, 0, 0]);
    await b.service.establish(USER, exchange);
    await b.service.establish(USER, exchange);
    expect([b.segmentationFactory, b.focusFactory, b.threadFactory, b.continuityFactory].map((f) => f.mock.calls.length)).toEqual([1, 1, 1, 1]);
  });

  it('70. a provider outage or rejected proposal is retryable unavailability, never NONE and never a lifecycle failure', async () => {
    const focusOutage = build(harness(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(() => new FocusResolutionProviderError('PROVIDER_ERROR')));
    expect(await unavailable(focusOutage.service.establishExchange(USER, userTurn, assistantTurn))).toBe('PROVIDER_UNAVAILABLE');
    expect(focusOutage.h.commitFinalizedExchangeWithFullSemanticChain).not.toHaveBeenCalled();
    const continuityOutage = build(worldWithOldAhmed(), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(FOCUS_SCENARIO), new RecordingThreadProvider(THREAD_SCENARIO), FakeThreadContinuityProvider.failing('PROVIDER_ERROR'));
    expect(await unavailable(continuityOutage.service.establishExchange(USER, userTurn, assistantTurn))).toBe('PROVIDER_UNAVAILABLE');
  });

  it('71. an incoherent coordinator result never becomes delivery', async () => {
    for (const [mutate, reason] of [
      [(r: FinalizedExchangeWithFullSemanticChainResult) => ({ ...r, live_head: null }), 'LIVE_HEAD_NOT_ESTABLISHED'],
      [(r: FinalizedExchangeWithFullSemanticChainResult) => ({ ...r, live_focus_transitions: [{ sessionPosition: 9, to: thread(T_AHMED) }] }), 'LIVE_FOCUS_DELIVERY_MISMATCH'],
      [(r: FinalizedExchangeWithFullSemanticChainResult) => ({ ...r, live_focus_transitions: [{ sessionPosition: 2, to: thread(T_AHMED) }, { sessionPosition: 2, to: NONE }] }), 'LIVE_FOCUS_DELIVERY_MISMATCH'],
      [(r: FinalizedExchangeWithFullSemanticChainResult) => ({ ...r, live_focus_sp: 1 }), 'LIVE_FOCUS_DELIVERY_MISMATCH'],
    ] as const) {
      const b = build(harness({ commit: async (request) => mutate(defaultCommit(request)) }));
      expect(await integrity(b.service.establishExchange(USER, userTurn, assistantTurn))).toBe(reason);
    }
  });
});

describe('bounded recovery with BOTH stale authorities and no third one (cases 72-79)', () => {
  it('72. a stale Session Semantic Clock token earns exactly one shared re-evaluation against a re-read context; segmentation is never repeated', async () => {
    const b = build(harness({
      contexts: (call) => ({ ...EMPTY_CONTEXT, token: call === 1 ? { currentSp: null, sameSpEventSequence: 0 } : { currentSp: 2, sameSpEventSequence: 1 } }),
      commit: async (request, call) => { if (call === 1) throw focusStale(); return defaultCommit(request); },
    }));
    const result = await b.service.establish(USER, exchange);
    expect(b.h.calls).toEqual(['snapshot:USER', 'snapshot:ASSISTANT', 'context', 'dossiers', 'commit', 'snapshot:USER', 'snapshot:ASSISTANT', 'context', 'dossiers', 'commit']);
    expect(providerCounts(b)).toEqual([2, 8, 4, 0, 0]);
    expect(b.h.commitRequests.map((r) => [r.expectedCurrentSp, r.expectedSameSpEventSequence])).toEqual([[null, 0], [2, 1]]);
    expect(result.temporal?.liveHead).toBe(4);
  });

  it('73. a stale user/world Thread identity version earns the SAME single retry with re-read dossiers', async () => {
    const b = build(harness({
      contexts: (call) => ({ ...EMPTY_CONTEXT, worldThreadIdentityVersion: call === 1 ? 3 : 4 }),
      commit: async (request, call) => { if (call === 1) throw identityStale(); return defaultCommit(request); },
    }));
    await b.service.establish(USER, exchange);
    expect(b.h.commitRequests.map((r) => r.expectedWorldThreadIdentityVersion)).toEqual([3, 4]);
    expect(b.h.readRuntimeContext).toHaveBeenCalledTimes(2);
    expect(b.h.readIdentityDossierPage).toHaveBeenCalledTimes(2);
    expect(b.segmentation.requests).toHaveLength(2);
  });

  it('74. the retry budget is shared: focus-stale then identity-stale exhausts it; LF adds no third stale authority', async () => {
    const b = build(harness({ commit: async (_r, call) => { throw call === 1 ? focusStale() : identityStale(); } }));
    expect(await unavailable(b.service.establishExchange(USER, userTurn, assistantTurn))).toBe('STALE_CONTEXT_RETRY_EXHAUSTED');
    expect(b.h.commitFinalizedExchangeWithFullSemanticChain).toHaveBeenCalledTimes(2);
    expect(b.h.readRuntimeContext).toHaveBeenCalledTimes(2);
    expect(b.segmentation.requests).toHaveLength(2);
  });

  it('75. a generic 40001 never qualifies: no retry, no re-read context, transport unavailability', async () => {
    const b = build(harness({ commit: async () => { throw new DataApiError(500, { databaseCode: '40001', databaseMessage: 'could not serialize access due to concurrent update' }); } }));
    expect(await unavailable(b.service.establishExchange(USER, userTurn, assistantTurn))).toBe('TRANSPORT_UNAVAILABLE');
    expect(b.h.commitFinalizedExchangeWithFullSemanticChain).toHaveBeenCalledTimes(1);
    expect(b.h.readRuntimeContext).toHaveBeenCalledTimes(1);
  });

  it('76. winner-first: after any commit failure the re-read snapshots are authoritative, and a FINAL-complete winner is returned with no retry', async () => {
    const b = build(harness({
      snapshots: (batchId, call) => call === 1 ? absent() : batchId === USER_BATCH
        ? complete(USER_BATCH, 'USER', 1, 2, 4, { live_focus_transition_count: 1, live_focus_transitions: [{ sessionPosition: 1, to: thread(T_AHMED) }], session_live_focus: thread(T_AHMED), session_live_focus_sp: 1 })
        : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4, { session_live_focus: thread(T_AHMED), session_live_focus_sp: 1 }),
      commit: async () => { throw focusStale(); },
    }));
    const result = await b.service.establish(USER, exchange);
    expect(live(result).liveFocus).toEqual({ kind: 'THREAD', threadId: T_AHMED });
    expect(live(result).liveFocusTransitions.map((t) => t.atSp)).toEqual([1]);
    expect(b.h.commitFinalizedExchangeWithFullSemanticChain).toHaveBeenCalledTimes(1);
    expect(b.h.readRuntimeContext).toHaveBeenCalledTimes(1);
  });

  it('77. a partial winner (a B3-complete but LF-less concurrent commit) fails closed after the failure, never repaired', async () => {
    const b = build(harness({
      snapshots: (batchId, call) => call === 1 ? absent() : complete(batchId, batchId === USER_BATCH ? 'USER' : 'ASSISTANT', batchId === USER_BATCH ? 1 : 3, 2, 4, { full_semantic_capture_state: 'PARTIAL', live_focus_batch_exists: false, live_focus_unit_count: 0 }),
      commit: async () => { throw focusStale(); },
    }));
    expect(await integrity(b.service.establishExchange(USER, userTurn, assistantTurn))).toBe('INCOMPLETE_FULL_SEMANTIC_CAPTURE');
    expect(b.h.commitFinalizedExchangeWithFullSemanticChain).toHaveBeenCalledTimes(1);
  });

  it('78. a moved source frontier between the attempt and the retry is an integrity failure, never a resegmentation', async () => {
    const b = build(harness({
      snapshots: (_batchId, call) => absent({ source_frontier: call === 1 ? 0 : 7 }),
      commit: async () => { throw focusStale(); },
    }));
    expect(await integrity(b.service.establishExchange(USER, userTurn, assistantTurn))).toBe('SEGMENTATION_FRONTIER_MOVED');
    expect(b.segmentation.requests).toHaveLength(2);
    expect(b.h.readRuntimeContext).toHaveBeenCalledTimes(1);
  });

  it('79. the retry re-reduces LF against the re-read context\'s current LF, so a concurrently changed LF is honoured', async () => {
    const OTHER_T = '99999999-9999-5999-8999-999999999999';
    const OTHER_F = '99999999-9999-4999-8999-999999999990';
    const OTHER_CU = '99999999-9999-4999-8999-999999999991';
    const OTHER_H = '99999999-9999-4999-8999-999999999992';
    const b = build(harness({
      contexts: (call) => call === 1 ? EMPTY_CONTEXT : {
        ...EMPTY_CONTEXT, token: { currentSp: 1, sameSpEventSequence: 3 }, worldThreadIdentityVersion: 1,
        priorContext: {
          priorCus: [{ cuId: OTHER_CU, sourceTurnId: '99999999-9999-4999-8999-999999999993', sourceRole: 'USER', committedText: 'الشغل بقى ضاغط.', ordinalWithinTurn: 0, functions: ['INFORM_REPORT'], sequencePosition: 'UNMARKED', targetCuId: null }],
          referenceHandles: [{ handleId: OTHER_H, grounding: [{ cuId: OTHER_CU, exactSurface: 'الشغل' }] }],
          focusCandidates: [{ focusCandidateId: OTHER_F, groundingHandleIds: [OTHER_H], priorGroundingCuIds: [OTHER_CU] }],
          currentFocusCandidateId: OTHER_F,
        },
        priorFocusSemantics: [{ unit_id: OTHER_CU, functions: ['INFORM_REPORT'], sequence_position: 'UNMARKED', target_cu_id: null, claim_attributions: [],
          references: [{ reference_index: 0, anchor_text: 'الشغل', anchor_occurrence: 1, span_start: 0, span_end: 5, state: 'RESOLVED', resolved_handle_id: OTHER_H, creates_handle: true, candidate_handle_ids: [] }],
          attention: { kind: 'START_NEW_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: OTHER_F, creates_focus: true, grounding_reference_index: 0 } }],
        focusAttentionHistory: [{ cuId: OTHER_CU, attentionKind: 'START_NEW_FOCUS', attentionReason: 'DIRECT_SUBJECT', emergingFocusId: OTHER_F }],
        establishedThreadBindings: [{ threadId: OTHER_T, emergingFocusId: OTHER_F, establishedCuId: OTHER_CU, establishedSp: 1 }],
        sessionFocusThreadBindings: [{ bindingId: durableThreadFocusBindingId(SESSION, OTHER_F, OTHER_T), threadId: OTHER_T, emergingFocusId: OTHER_F, boundCuId: OTHER_CU, boundSp: 1, bindingKind: 'ESTABLISHMENT' }],
        currentLiveFocus: thread(OTHER_T), currentLiveFocusSp: 1,
      },
      commit: async (request, call) => { if (call === 1) throw focusStale(); return defaultCommit(request); },
    }));
    await b.service.establish(USER, exchange);
    expect(lfOf(b.h.commitRequests[0])[0]).toEqual([U1_ID, 'THREAD', T_AHMED, true, 'NEW_INDEPENDENT_FOCUS']);
    expect(lfOf(b.h.commitRequests[1])[0]).toEqual([U1_ID, 'THREAD', T_AHMED, true, 'FOCUS_REPLACEMENT']);
  });
});
