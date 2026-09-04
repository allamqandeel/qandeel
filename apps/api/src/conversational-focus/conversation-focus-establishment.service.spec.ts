import type { ConversationTurn, OrchestratedTurnResult } from '../conversation/conversation.types';
import { DataApiError } from '../conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import type { CuSegmentationBinding } from '../conversation-unit/conversation-temporal-establishment.service';
import type { CommittedConversationUnit } from '../conversation-unit/conversation-unit.types';
import type { SourceAnchor } from '../conversation-unit/cu-anchor-mapper';
import { CuSegmentationProviderError, type CuSegmentationProvider, type CuSegmentationRequest } from '../conversation-unit/cu-segmentation-provider.types';
import { automaticCommitBatchId, automaticCommitUnitId } from '../conversation-unit/deterministic-runtime-id';
import { buildPreparedFocusInputs, ConversationFocusEstablishmentService } from './conversation-focus-establishment.service';
import { mapConversationFocusRuntimeContext } from './conversation-focus-runtime-mapper';
import { ConversationFocusRuntimeRepository, type ConversationFocusRuntimeBoundary } from './conversation-focus-runtime.repository';
import {
  ConversationFocusEstablishmentUnavailableError,
  ConversationFocusIntegrityError,
  StaleConversationalFocusContextError,
  type CommitFinalizedExchangeWithFocusRequest,
  type ConversationFocusRuntimeContext,
  type FinalizedExchangeWithFocusResult,
  type IntegratedBatchSnapshot,
} from './conversation-focus-runtime.types';
import { PREPARED_ID_PREFIX } from './conversational-focus-evaluator.service';
import { durableEmergingFocusId, durableReferenceHandleId } from './durable-focus-canonicalizer';
import { openAiFocusResolutionBinding, type FocusResolutionBinding } from './focus-resolution-binding';
import { FocusResolutionProviderError, type FocusResolutionProposal, type FocusResolutionProvider, type FocusResolutionRequest } from './focus-resolution-provider.types';

const SESSION = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const USER_TURN = '11111111-1111-4111-8111-111111111111';
const ASSISTANT_TURN = '22222222-2222-4222-8222-222222222222';
const USER_CONTENT = 'أحمد بقى بيقلقني. المدير كمان.';
const ASSISTANT_CONTENT = 'تقصد إن أحمد اتغير؟ وإمتى؟';
const U1 = 'أحمد بقى بيقلقني.';
const U2 = 'المدير كمان.';
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
const U1_ID = automaticCommitUnitId(USER_BATCH, { index: 0, spanStart: spanOf(USER_CONTENT, U1).start, spanEnd: spanOf(USER_CONTENT, U1).end });
const U2_ID = automaticCommitUnitId(USER_BATCH, { index: 1, spanStart: spanOf(USER_CONTENT, U2).start, spanEnd: spanOf(USER_CONTENT, U2).end });
const A1_ID = automaticCommitUnitId(ASSISTANT_BATCH, { index: 0, spanStart: spanOf(ASSISTANT_CONTENT, A1).start, spanEnd: spanOf(ASSISTANT_CONTENT, A1).end });

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

/** A focus provider that records every request, its order, and proves strict sequencing. */
class RecordingFocusProvider implements FocusResolutionProvider {
  readonly requests: FocusResolutionRequest[] = [];
  private inFlight = 0;
  maxInFlight = 0;
  constructor(private readonly answer: (request: FocusResolutionRequest, index: number) => FocusResolutionProposal | FocusResolutionProviderError) {}
  async propose(request: FocusResolutionRequest): Promise<FocusResolutionProposal> {
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    this.requests.push(JSON.parse(JSON.stringify(request)) as FocusResolutionRequest);
    await new Promise((resolve) => setTimeout(resolve, 1));
    try {
      const answer = this.answer(request, this.requests.length - 1);
      if (answer instanceof FocusResolutionProviderError) throw answer;
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
/** The scenario: USER CU1 first grounds Ahmed and starts a focus; the ASSISTANT attends it through the prepared identities. */
const SCENARIO = (request: FocusResolutionRequest): FocusResolutionProposal => {
  if (request.currentCu.cuId === U1_ID) {
    return { ...NO_FOCUS, references: [{ anchor: { text: 'أحمد', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: null, candidateHandleIds: [], newReference: true }],
      attention: { kind: 'START_NEW_FOCUS', existingFocusCandidateId: null, groundingAnchor: { text: 'أحمد', occurrence: 1 }, reason: 'DIRECT_SUBJECT' } };
  }
  if (request.currentCu.cuId === A1_ID) {
    return { ...NO_FOCUS, functions: ['ASK'], sequencePosition: 'RESPONSIVE', targetCuId: U1_ID,
      references: [{ anchor: { text: 'أحمد', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: `${PREPARED_ID_PREFIX}reference:${U1_ID}:0`, candidateHandleIds: [], newReference: false }],
      attention: { kind: 'ATTEND_EXISTING_FOCUS', existingFocusCandidateId: `${PREPARED_ID_PREFIX}focus:${U1_ID}`, groundingAnchor: null, reason: 'DIRECT_REQUEST_OR_QUESTION' } };
  }
  return NO_FOCUS;
};

const segmentationBinding = (provider: CuSegmentationProvider): CuSegmentationBinding => ({ provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' });
const focusBinding = (provider: FocusResolutionProvider): FocusResolutionBinding => ({ provider, providerName: 'OPENAI', providerModel: 'gpt-5-mini' });

const EMPTY_CONTEXT: ConversationFocusRuntimeContext = {
  sessionId: SESSION, token: { currentSp: null, sameSpEventSequence: 0 },
  priorContext: { priorCus: [], referenceHandles: [], focusCandidates: [], currentFocusCandidateId: null },
};
const absent = (overrides: Partial<IntegratedBatchSnapshot> = {}): IntegratedBatchSnapshot => ({
  batch_exists: false, committed_unit_count: 0, units: [], commit_event: null, source_frontier: 0, live_head: null,
  focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false, ...overrides,
});
function unit(batchId: string, index: number, sp: number, role: 'USER' | 'ASSISTANT', spanStart = index * 10, spanEnd = index * 10 + 5): CommittedConversationUnit {
  return {
    id: automaticCommitUnitId(batchId, { index, spanStart, spanEnd }), user_id: USER, session_id: SESSION,
    source_turn_id: role === 'USER' ? USER_TURN : ASSISTANT_TURN, commit_batch_id: batchId, source_role: role, speaker_state: 'RESOLVED',
    source_modality: 'TEXT', ordinal_within_turn: index, source_span_start: spanStart, source_span_end: spanEnd,
    committed_text: 'x'.repeat(spanEnd - spanStart), source_content_sha256: 'deadbeef', session_position: sp, created_at: 'now',
  };
}
function complete(batchId: string, role: 'USER' | 'ASSISTANT', firstSp: number, count: number, liveHead: number, overrides: Partial<IntegratedBatchSnapshot> = {}): IntegratedBatchSnapshot {
  const units = Array.from({ length: count }, (_v, index) => unit(batchId, index, firstSp + index, role));
  return {
    batch_exists: true, committed_unit_count: count, units,
    commit_event: count === 0 ? null : { commit_batch_id: batchId, user_id: USER, session_id: SESSION, source_turn_id: role === 'USER' ? USER_TURN : ASSISTANT_TURN, first_sp: firstSp, last_sp: firstSp + count - 1, unit_count: count, created_at: 'now' },
    source_frontier: count * 10, live_head: liveHead, focus_batch_exists: true, focus_semantic_count: count, focus_attention_count: count, focus_complete: true, ...overrides,
  };
}

interface Harness {
  snapshots: (batchId: string, call: number) => IntegratedBatchSnapshot;
  contexts: (call: number) => ConversationFocusRuntimeContext;
  commit: (request: CommitFinalizedExchangeWithFocusRequest, call: number) => Promise<FinalizedExchangeWithFocusResult>;
}
function defaultCommit(request: CommitFinalizedExchangeWithFocusRequest): FinalizedExchangeWithFocusResult {
  const u = request.userUnits.length;
  const a = request.assistantUnits.length;
  return {
    live_head: u + a === 0 ? null : u + a,
    same_sp_event_sequence: u + a === 0 ? 0 : 1,
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
  const commitFinalizedExchangeWithFocus = jest.fn(async (request: CommitFinalizedExchangeWithFocusRequest) => {
    calls.push('commit');
    commitCalls += 1;
    return (overrides.commit ?? (async (r) => defaultCommit(r)))(request, commitCalls);
  });
  const boundary: ConversationFocusRuntimeBoundary = { readIntegratedBatchSnapshot, readRuntimeContext, commitFinalizedExchangeWithFocus };
  return { boundary, calls, readIntegratedBatchSnapshot, readRuntimeContext, commitFinalizedExchangeWithFocus };
}
function build(h = harness(), segmentation = new RoleScriptedSegmentation(SEGMENTS), focus = new RecordingFocusProvider(SCENARIO)) {
  const segmentationFactory = jest.fn(() => segmentationBinding(segmentation));
  const focusFactory = jest.fn(() => focusBinding(focus));
  const service = new ConversationFocusEstablishmentService(h.boundary, segmentationFactory, focusFactory);
  return { service, h, segmentation, focus, segmentationFactory, focusFactory };
}
const rejection = async (promise: Promise<unknown>) => {
  try { await promise; } catch (error) { return error; }
  throw new Error('expected a rejection');
};
const integrity = async (promise: Promise<unknown>) => {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(ConversationFocusIntegrityError);
  return (error as ConversationFocusIntegrityError).reason;
};

describe('relation gate and replay (cases 1-6, 29, 34)', () => {
  it('1. an invalid finalized relation costs zero providers, zero reads and zero writes', async () => {
    for (const bad of [
      turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', source_turn_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
      turn({ id: ASSISTANT_TURN, role: 'USER', source_turn_id: USER_TURN }),
      turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', session_id: '55555555-5555-4555-8555-555555555555', source_turn_id: USER_TURN }),
    ]) {
      const { service, h, segmentation, focus, segmentationFactory, focusFactory } = build();
      expect(await integrity(service.establish(USER, { userTurn, assistantTurn: bad }))).toBe('INVALID_FINALIZED_EXCHANGE_RELATION');
      expect(h.calls).toEqual([]);
      expect(segmentation.requests).toHaveLength(0);
      expect(focus.requests).toHaveLength(0);
      expect(segmentationFactory).not.toHaveBeenCalled();
      expect(focusFactory).not.toHaveBeenCalled();
      // 34. Both durable turns stay COMPLETED; nothing regenerates or fails them.
      expect([userTurn.status, bad.status]).toEqual(['COMPLETED', 'COMPLETED']);
    }
    // A not-yet-complete pair is returned untouched, exactly as T-03A2 does.
    const { service } = build();
    const pending = { userTurn, assistantTurn: turn({ id: ASSISTANT_TURN, role: 'ASSISTANT', status: 'GENERATING' as never, source_turn_id: USER_TURN }) };
    expect(await service.establish(USER, pending)).toBe(pending);
  });

  it('2. both integrated batches complete -> zero providers, stored delivery returned', async () => {
    const { service, h, segmentation, focus, focusFactory, segmentationFactory } = build(harness({
      snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4),
    }));
    const result = await service.establish(USER, exchange);
    expect(result.temporal).toEqual({ liveHead: 4, committedEvents: [
      expect.objectContaining({ type: 'CONVERSATIONAL_UNITS_COMMITTED', version: 1, firstSp: 1, lastSp: 2, unitCount: 2, sourceTurnId: USER_TURN }),
      expect.objectContaining({ firstSp: 3, lastSp: 4, unitCount: 2, sourceTurnId: ASSISTANT_TURN }),
    ] });
    expect(segmentation.requests).toHaveLength(0);
    expect(focus.requests).toHaveLength(0);
    expect(h.commitFinalizedExchangeWithFocus).not.toHaveBeenCalled();
    expect(h.readRuntimeContext).not.toHaveBeenCalled();
    // 29. The bindings stay lazy on a replay.
    expect(focusFactory).not.toHaveBeenCalled();
    expect(segmentationFactory).not.toHaveBeenCalled();
  });

  it('3. a committed zero-CU pair with its zero-unit B1 batches replays with zero providers', async () => {
    const { service, focus, segmentation, focusFactory } = build(harness({ snapshots: (batchId) => complete(batchId, batchId === USER_BATCH ? 'USER' : 'ASSISTANT', 1, 0, 0, { live_head: null }) }));
    const result = await service.establish(USER, exchange);
    expect(result.temporal).toEqual({ liveHead: null, committedEvents: [] });
    expect(focus.requests).toHaveLength(0);
    expect(segmentation.requests).toHaveLength(0);
    expect(focusFactory).not.toHaveBeenCalled();
  });

  it('4. one exchange half committed -> fail closed before any provider', async () => {
    const { service, h, focus, segmentation, focusFactory } = build(harness({ snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 2) : absent() }));
    expect(await integrity(service.establish(USER, exchange))).toBe('PARTIAL_INTEGRATED_EXCHANGE');
    expect(focus.requests).toHaveLength(0);
    expect(segmentation.requests).toHaveLength(0);
    expect(h.readRuntimeContext).not.toHaveBeenCalled();
    expect(focusFactory).not.toHaveBeenCalled();
  });

  it('5/6. a legacy CU batch without its focus batch, or a structurally incomplete one, fails closed before providers', async () => {
    for (const legacy of [
      { focus_batch_exists: false, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: false },
      { focus_batch_exists: true, focus_semantic_count: 1, focus_attention_count: 2, focus_complete: false },
      { focus_batch_exists: true, focus_semantic_count: 2, focus_attention_count: 1, focus_complete: false },
    ]) {
      const { service, h, focus, segmentation, focusFactory } = build(harness({
        snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4, legacy) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4),
      }));
      expect(await integrity(service.establish(USER, exchange))).toBe('INCOMPLETE_FOCUS_SEMANTICS');
      expect(focus.requests).toHaveLength(0);
      expect(segmentation.requests).toHaveLength(0);
      expect(h.commitFinalizedExchangeWithFocus).not.toHaveBeenCalled();
      expect(focusFactory).not.toHaveBeenCalled();
    }
  });

  // FIX-T03B1B2-02, through the REAL repository and mapper rather than a fake
  // boundary: transport that claims completeness its own counts do not support
  // must never reach the replay path. Were the mapper to pass the row through,
  // the service would return stored temporal delivery as canonical replay and
  // silently skip both semantic providers for an exchange that has no B1 truth.
  it('36. an incoherent claimed-complete row is rejected at the boundary: no replay, no delivery, no provider', async () => {
    const claimedComplete = {
      batch_exists: true, committed_unit_count: 2,
      units: [{ id: U1_ID, session_position: 1 }, { id: U2_ID, session_position: 2 }],
      commit_event: { commit_batch_id: USER_BATCH, first_sp: 1, last_sp: 2, unit_count: 2 },
      source_frontier: 20, live_head: 4,
      focus_batch_exists: true, focus_semantic_count: 0, focus_attention_count: 0, focus_complete: true,
    };
    const rpc = jest.fn().mockResolvedValue([claimedComplete]);
    const repository = new ConversationFocusRuntimeRepository({ rpc } as unknown as SupabaseServiceRoleApiService);
    const focusFactory = jest.fn(() => { throw new Error('focus binding must not be created'); });
    const segmentationFactory = jest.fn(() => { throw new Error('segmentation binding must not be created'); });
    const service = new ConversationFocusEstablishmentService(repository, segmentationFactory, focusFactory);
    const failure = await service.establish(USER, exchange).then(() => 'RETURNED', (error: unknown) => error);
    expect(failure).toBeInstanceOf(ConversationFocusIntegrityError);
    expect((failure as ConversationFocusIntegrityError).reason).toBe('INVALID_INTEGRATED_SNAPSHOT');
    // Both halves are read concurrently, so two snapshot calls fire; neither
    // the context read nor the writer is ever reached.
    expect(new Set(rpc.mock.calls.map((call) => call[0]))).toEqual(new Set(['get_conversation_integrated_batch_snapshot_v1']));
    expect(focusFactory).not.toHaveBeenCalled();
    expect(segmentationFactory).not.toHaveBeenCalled();
  });
});

describe('fresh exchange orchestration (cases 7-17, 27, 28, 35)', () => {
  it('7/8/11/12. reads the context before focus evaluation, segments the halves separately, and evaluates USER CUs then ASSISTANT CUs strictly one at a time', async () => {
    const { service, h, segmentation, focus } = build();
    await service.establish(USER, exchange);
    expect(h.calls).toEqual(['snapshot:USER', 'snapshot:ASSISTANT', 'context', 'commit']);
    expect(segmentation.requests.map((r) => r.sourceRole).sort()).toEqual(['ASSISTANT', 'USER']);
    expect(focus.requests.map((r) => r.currentCu.cuId)).toEqual([U1_ID, U2_ID, A1_ID, automaticCommitUnitId(ASSISTANT_BATCH, { index: 1, ...{ spanStart: spanOf(ASSISTANT_CONTENT, A2).start, spanEnd: spanOf(ASSISTANT_CONTENT, A2).end } })]);
    expect(focus.requests.map((r) => r.currentCu.sourceRole)).toEqual(['USER', 'USER', 'ASSISTANT', 'ASSISTANT']);
    expect(focus.maxInFlight).toBe(1);
    // The context was read before the first focus proposal, and exactly once.
    expect(h.readRuntimeContext).toHaveBeenCalledTimes(1);
  });

  it('9/10. builds exact code-point wording from the proposed spans and the global ordinal from the authoritative prior context', async () => {
    const emojiUser = turn({ content: '😂😂 أحمد بقى بيقلقني. المدير كمان.' });
    const priorOfEarlierTurn = {
      cuId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', sourceTurnId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', sourceRole: 'USER' as const, committedText: 'كلام قديم.', ordinalWithinTurn: 3,
      functions: ['ACKNOWLEDGE' as const], sequencePosition: 'UNMARKED' as const, targetCuId: null,
    };
    const context: ConversationFocusRuntimeContext = {
      sessionId: SESSION, token: { currentSp: 1, sameSpEventSequence: 1 },
      priorContext: { priorCus: [priorOfEarlierTurn], referenceHandles: [], focusCandidates: [], currentFocusCandidateId: null },
    };
    const { service, focus } = build(harness({ contexts: () => context }), new RoleScriptedSegmentation(SEGMENTS), new RecordingFocusProvider(() => NO_FOCUS));
    await service.establish(USER, { userTurn: emojiUser, assistantTurn });
    // The wording is the code-point slice, never a UTF-16 slice (the emoji
    // prefix shifts every UTF-16 offset by two code units).
    expect(focus.requests[0].currentCu.committedText).toBe(U1);
    expect(focus.requests[1].currentCu.committedText).toBe(U2);
    expect(focus.requests[2].currentCu.committedText).toBe(A1);
    // Global ordinal: a prior CU of ANOTHER turn does not shift this turn's ordinals.
    expect(focus.requests.map((r) => r.currentCu.ordinalWithinTurn)).toEqual([0, 1, 0, 1]);
    expect(focus.requests[0].priorCus.map((cu) => cu.cuId)).toEqual([priorOfEarlierTurn.cuId]);
    // The derivation itself continues after the authoritative prior CUs of the SAME turn,
    // exactly as the producer allocates `COALESCE(MAX(ordinal_within_turn) + 1, 0)`.
    const sameTurn = { ...priorOfEarlierTurn, sourceTurnId: USER_TURN };
    const inputs = buildPreparedFocusInputs(emojiUser, [
      { unitId: U1_ID, spanStart: spanOf(emojiUser.content, U1).start, spanEnd: spanOf(emojiUser.content, U1).end },
      { unitId: U2_ID, spanStart: spanOf(emojiUser.content, U2).start, spanEnd: spanOf(emojiUser.content, U2).end },
    ], { priorCus: [sameTurn, priorOfEarlierTurn], referenceHandles: [], focusCandidates: [], currentFocusCandidateId: null });
    expect(inputs.map((cu) => [cu.ordinalWithinTurn, cu.committedText])).toEqual([[4, U1], [5, U2]]);
    expect(emojiUser.content.indexOf(U1)).not.toBe(spanOf(emojiUser.content, U1).start);
  });

  it('13/14/15. no hindsight for USER CU1; the ASSISTANT consumes prepared USER truth; one canonicalization resolves cross-half prepared identities', async () => {
    const { service, h, focus } = build();
    await service.establish(USER, exchange);
    const first = focus.requests[0];
    expect(first.priorCus).toEqual([]);
    expect(JSON.stringify(first)).not.toContain(A1);
    expect(JSON.stringify(first)).not.toContain(U2);
    expect(JSON.stringify(first)).not.toContain(ASSISTANT_TURN);
    const assistantFirst = focus.requests[2];
    expect(assistantFirst.referenceHandles.map((handle) => handle.handleId)).toEqual([`${PREPARED_ID_PREFIX}reference:${U1_ID}:0`]);
    expect(assistantFirst.focusCandidates.map((focusCandidate) => focusCandidate.focusCandidateId)).toEqual([`${PREPARED_ID_PREFIX}focus:${U1_ID}`]);
    expect(assistantFirst.priorCus.map((cu) => cu.cuId)).toEqual([U1_ID, U2_ID]);
    const request = h.commitFinalizedExchangeWithFocus.mock.calls[0][0] as CommitFinalizedExchangeWithFocusRequest;
    const handle = durableReferenceHandleId(SESSION, U1_ID, 0);
    const focusId = durableEmergingFocusId(SESSION, U1_ID);
    expect(request.userFocusUnits[0].references[0]).toMatchObject({ resolved_handle_id: handle, creates_handle: true });
    expect(request.userFocusUnits[0].attention).toMatchObject({ kind: 'START_NEW_FOCUS', emerging_focus_id: focusId, creates_focus: true, grounding_reference_index: 0 });
    expect(request.assistantFocusUnits[0].references[0]).toMatchObject({ resolved_handle_id: handle, creates_handle: false });
    expect(request.assistantFocusUnits[0].attention).toMatchObject({ kind: 'ATTEND_EXISTING_FOCUS', emerging_focus_id: focusId, creates_focus: false, grounding_reference_index: 0 });
    expect(request.assistantFocusUnits[0].target_cu_id).toBe(U1_ID);
    expect(JSON.stringify(request)).not.toContain(PREPARED_ID_PREFIX);
    expect(request.userFocusUnits.map((u) => u.unit_id)).toEqual(request.userUnits.map((u) => u.unitId));
    expect(request.assistantFocusUnits.map((u) => u.unit_id)).toEqual(request.assistantUnits.map((u) => u.unitId));
  });

  it('16/27/28. the coordinator receives the exact context token: (null, 0) before the first SP and (5, 1) after an integrated write', async () => {
    const fresh = build();
    await fresh.service.establish(USER, exchange);
    expect(fresh.h.commitFinalizedExchangeWithFocus.mock.calls[0][0]).toMatchObject({ expectedCurrentSp: null, expectedSameSpEventSequence: 0 });
    const later = build(harness({ contexts: () => ({ ...EMPTY_CONTEXT, token: { currentSp: 5, sameSpEventSequence: 1 } }) }));
    await later.service.establish(USER, exchange);
    expect(later.h.commitFinalizedExchangeWithFocus.mock.calls[0][0]).toMatchObject({ expectedCurrentSp: 5, expectedSameSpEventSequence: 1 });
    const request = later.h.commitFinalizedExchangeWithFocus.mock.calls[0][0] as CommitFinalizedExchangeWithFocusRequest;
    expect(request).toMatchObject({
      sessionId: SESSION, userId: USER, userSourceTurnId: USER_TURN, userBatchId: USER_BATCH, assistantSourceTurnId: ASSISTANT_TURN, assistantBatchId: ASSISTANT_BATCH,
      evaluatorVersion: 'cu-anchor-mapper-v1', segmentationProvider: 'OPENAI', segmentationModel: 'gpt-5-mini',
      focusEvaluatorVersion: 'conversational-focus-evaluator-v1', focusPolicyVersion: 'stage-1.2-1.3-reference-attention-v1',
      focusProvider: 'OPENAI', focusModel: 'gpt-5-mini', focusPromptVersion: 'focus-resolution-anchored-v2', focusSchemaVersion: 1,
    });
  });

  it('17/35. returns the existing T-03A2 temporal delivery shape and no focus payload of any kind', async () => {
    const { service } = build();
    const result = await service.establish(USER, exchange);
    expect(result.userTurn).toBe(userTurn);
    expect(result.assistantTurn).toBe(assistantTurn);
    expect(result.temporal).toEqual({ liveHead: 4, committedEvents: [
      { type: 'CONVERSATIONAL_UNITS_COMMITTED', version: 1, sessionId: SESSION, batchId: USER_BATCH, sourceTurnId: USER_TURN, firstSp: 1, lastSp: 2, unitCount: 2 },
      { type: 'CONVERSATIONAL_UNITS_COMMITTED', version: 1, sessionId: SESSION, batchId: ASSISTANT_BATCH, sourceTurnId: ASSISTANT_TURN, firstSp: 3, lastSp: 4, unitCount: 2 },
    ] });
    expect(Object.keys(result).sort()).toEqual(['assistantTurn', 'temporal', 'userTurn']);
    expect(JSON.stringify(result.temporal)).not.toMatch(/focus|reference|handle|claim|attention|committed_text|same_sp|thread|liveFocus/iu);
  });
});

describe('bounded stale-context recovery and race recovery (cases 18-22)', () => {
  it('18/19. one stale failure with no winner -> context re-read, focus-only re-evaluation, segmentation NOT repeated, commit succeeds', async () => {
    const { service, h, segmentation, focus } = build(harness({
      contexts: (call) => (call === 1 ? EMPTY_CONTEXT : { ...EMPTY_CONTEXT, token: { currentSp: 7, sameSpEventSequence: 1 } }),
      commit: async (request, call) => { if (call === 1) throw new StaleConversationalFocusContextError(); return defaultCommit(request); },
    }));
    const result = await service.establish(USER, exchange);
    expect(result.temporal?.liveHead).toBe(4);
    expect(h.calls).toEqual(['snapshot:USER', 'snapshot:ASSISTANT', 'context', 'commit', 'snapshot:USER', 'snapshot:ASSISTANT', 'snapshot:USER', 'snapshot:ASSISTANT', 'context', 'commit']);
    expect(segmentation.requests).toHaveLength(2);
    expect(focus.requests).toHaveLength(8);
    expect(h.commitFinalizedExchangeWithFocus.mock.calls[1][0]).toMatchObject({ expectedCurrentSp: 7, expectedSameSpEventSequence: 1 });
    // The second commit reused the identical segmentation.
    const [first, second] = h.commitFinalizedExchangeWithFocus.mock.calls.map((call) => call[0] as CommitFinalizedExchangeWithFocusRequest);
    expect(second.userUnits).toEqual(first.userUnits);
    expect(second.assistantUnits).toEqual(first.assistantUnits);
  });

  it('20. a second stale failure is bounded retryable unavailability: exactly two commits, two contexts, one segmentation pair', async () => {
    const { service, h, segmentation, focus } = build(harness({ commit: async () => { throw new StaleConversationalFocusContextError(); } }));
    const error = await rejection(service.establish(USER, exchange));
    expect(error).toBeInstanceOf(ConversationFocusEstablishmentUnavailableError);
    expect((error as ConversationFocusEstablishmentUnavailableError).reason).toBe('STALE_CONTEXT_RETRY_EXHAUSTED');
    expect(h.commitFinalizedExchangeWithFocus).toHaveBeenCalledTimes(2);
    expect(h.readRuntimeContext).toHaveBeenCalledTimes(2);
    expect(segmentation.requests).toHaveLength(2);
    expect(focus.requests).toHaveLength(8);
    expect([userTurn.status, assistantTurn.status]).toEqual(['COMPLETED', 'COMPLETED']);
  });

  it('a stale failure after the source frontier moved cannot reuse the segmentation and fails closed', async () => {
    let committed = false;
    const { service, h } = build(harness({
      snapshots: (batchId) => absent({ source_frontier: committed && batchId === USER_BATCH ? 99 : 0 }),
      commit: async () => { committed = true; throw new StaleConversationalFocusContextError(); },
    }));
    expect(await integrity(service.establish(USER, exchange))).toBe('SEGMENTATION_FRONTIER_MOVED');
    expect(h.commitFinalizedExchangeWithFocus).toHaveBeenCalledTimes(1);
  });

  it('21. an identical-request race loser returns the winner with no second focus evaluation and no second commit', async () => {
    let committed = false;
    const { service, h, focus, segmentation } = build(harness({
      snapshots: (batchId) => (committed
        ? (batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4))
        : absent()),
      commit: async () => { committed = true; throw new DataApiError(409, { databaseCode: '23505', databaseMessage: 'duplicate key' }); },
    }));
    const result = await service.establish(USER, exchange);
    expect(result.temporal?.liveHead).toBe(4);
    expect(h.commitFinalizedExchangeWithFocus).toHaveBeenCalledTimes(1);
    expect(h.readRuntimeContext).toHaveBeenCalledTimes(1);
    expect(focus.requests).toHaveLength(4);
    expect(segmentation.requests).toHaveLength(2);
    // A stale loser whose winner is complete returns the winner too, with no retry.
    committed = false;
    const stale = build(harness({
      snapshots: (batchId) => (committed ? (batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4)) : absent()),
      commit: async () => { committed = true; throw new StaleConversationalFocusContextError(); },
    }));
    expect((await stale.service.establish(USER, exchange)).temporal?.liveHead).toBe(4);
    expect(stale.h.readRuntimeContext).toHaveBeenCalledTimes(1);
    expect(stale.h.commitFinalizedExchangeWithFocus).toHaveBeenCalledTimes(1);
  });

  it('22. a non-stale database error never enters the stale branch, even when a later context read would differ', async () => {
    const { service, h, focus } = build(harness({
      contexts: (call) => (call === 1 ? EMPTY_CONTEXT : { ...EMPTY_CONTEXT, token: { currentSp: 9, sameSpEventSequence: 1 } }),
      commit: async () => { throw new DataApiError(500, { databaseCode: '40001', databaseMessage: 'could not serialize access due to concurrent update' }); },
    }));
    const error = await rejection(service.establish(USER, exchange));
    expect(error).toBeInstanceOf(ConversationFocusEstablishmentUnavailableError);
    expect((error as ConversationFocusEstablishmentUnavailableError).reason).toBe('TRANSPORT_UNAVAILABLE');
    expect(h.readRuntimeContext).toHaveBeenCalledTimes(1);
    expect(h.commitFinalizedExchangeWithFocus).toHaveBeenCalledTimes(1);
    expect(focus.requests).toHaveLength(4);
    // A partial winner after a failed commit is an integrity failure, not a retry.
    let committed = false;
    const partial = build(harness({
      snapshots: (batchId) => (committed && batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 2) : absent()),
      commit: async () => { committed = true; throw new StaleConversationalFocusContextError(); },
    }));
    expect(await integrity(partial.service.establish(USER, exchange))).toBe('PARTIAL_INTEGRATED_EXCHANGE');
  });
});

describe('provider failure, context validation and lazy binding (cases 23-26, 29, 30)', () => {
  it('23. a segmentation outage fails closed with zero focus proposals and zero commits', async () => {
    const { service, h, focus, focusFactory } = build(harness(), new RoleScriptedSegmentation({ USER: new CuSegmentationProviderError('UNAVAILABLE'), ASSISTANT: SEGMENTS.ASSISTANT }));
    const error = await rejection(service.establish(USER, exchange));
    expect(error).toBeInstanceOf(ConversationFocusEstablishmentUnavailableError);
    expect((error as ConversationFocusEstablishmentUnavailableError).reason).toBe('PROVIDER_UNAVAILABLE');
    expect(focus.requests).toHaveLength(0);
    expect(focusFactory).not.toHaveBeenCalled();
    expect(h.commitFinalizedExchangeWithFocus).not.toHaveBeenCalled();
  });

  it('24. a focus provider outage or rejected proposal fails closed with zero commits', async () => {
    for (const failing of [
      new RecordingFocusProvider(() => new FocusResolutionProviderError('TIMEOUT')),
      new RecordingFocusProvider(() => ({ ...NO_FOCUS, functions: ['GREET' as never] })),
    ]) {
      const { service, h } = build(harness(), new RoleScriptedSegmentation(SEGMENTS), failing);
      const error = await rejection(service.establish(USER, exchange));
      expect(error).toBeInstanceOf(ConversationFocusEstablishmentUnavailableError);
      expect((error as ConversationFocusEstablishmentUnavailableError).reason).toBe('PROVIDER_UNAVAILABLE');
      expect(h.commitFinalizedExchangeWithFocus).not.toHaveBeenCalled();
    }
  });

  it('25/26. a malformed or unclosed context snapshot fails closed before any focus proposal', async () => {
    const raw = (overrides: Record<string, unknown>) => ({
      base_current_sp: null, base_same_sp_event_sequence: '0', prior_cus: [], reference_handles: [], focus_candidates: [], current_focus_candidate_id: null, ...overrides,
    });
    const cases: [Record<string, unknown>, string][] = [
      [raw({ base_same_sp_event_sequence: '1' }), 'INVALID_RUNTIME_CONTEXT'],
      [raw({ prior_cus: [{ cu_id: U1_ID, source_turn_id: USER_TURN, source_role: 'USER', committed_text: U1, ordinal_within_turn: 0, session_position: 1, functions: null, sequence_position: null, target_cu_id: null }], base_current_sp: 1, base_same_sp_event_sequence: '1' }), 'INVALID_RUNTIME_CONTEXT'],
      [raw({ reference_handles: [{ handle_id: durableReferenceHandleId(SESSION, U1_ID, 0), grounding: [{ cu_id: U1_ID, exact_surface: 'أحمد' }] }] }), 'CONTEXT_GROUNDING_NOT_CLOSED'],
    ];
    for (const [row, reason] of cases) {
      const boundaryContext = async (request: { sessionId: string; userId: string }) => mapConversationFocusRuntimeContext(row, request);
      const h = harness();
      const focus = new RecordingFocusProvider(SCENARIO);
      const service = new ConversationFocusEstablishmentService(
        { ...h.boundary, readRuntimeContext: boundaryContext },
        () => segmentationBinding(new RoleScriptedSegmentation(SEGMENTS)),
        () => focusBinding(focus),
      );
      expect(await integrity(service.establish(USER, exchange))).toBe(reason);
      expect(focus.requests).toHaveLength(0);
      expect(h.commitFinalizedExchangeWithFocus).not.toHaveBeenCalled();
    }
  });

  it('29/30. the focus binding is created only on first actual need, and construction needs no provider key', async () => {
    const factory = openAiFocusResolutionBinding({});
    const h = harness();
    // Creating the factory and the service reads no environment.
    const service = new ConversationFocusEstablishmentService(h.boundary, () => segmentationBinding(new RoleScriptedSegmentation(SEGMENTS)), factory);
    expect(service).toBeDefined();
    // A replay never calls it either.
    const replay = new ConversationFocusEstablishmentService(
      harness({ snapshots: (batchId) => batchId === USER_BATCH ? complete(USER_BATCH, 'USER', 1, 2, 4) : complete(ASSISTANT_BATCH, 'ASSISTANT', 3, 2, 4) }).boundary,
      () => { throw new Error('segmentation binding must not be created on replay'); },
      () => { throw new Error('focus binding must not be created on replay'); },
    );
    expect((await replay.establish(USER, exchange)).temporal?.liveHead).toBe(4);
    // Only a fresh exchange reaches the factory, and with no key it fails closed as unavailability.
    const error = await rejection(service.establish(USER, exchange));
    expect(error).toBeInstanceOf(ConversationFocusEstablishmentUnavailableError);
    expect(String((error as Error).cause)).toMatch(/OPENAI_API_KEY/u);
    // With a key, the factory yields the OpenAI binding without any network call.
    const bound = openAiFocusResolutionBinding({ OPENAI_API_KEY: 'k', FOCUS_RESOLUTION_MODEL: 'gpt-5' })();
    expect([bound.providerName, bound.providerModel]).toEqual(['OPENAI', 'gpt-5']);
  });
});

describe('zero-CU behaviour (cases 31-33)', () => {
  it('31. zero/zero -> zero focus proposals, [] semantic payloads, LH null, no events', async () => {
    const focus = new RecordingFocusProvider(SCENARIO);
    const { service, h, focusFactory } = build(harness(), new RoleScriptedSegmentation({ USER: [], ASSISTANT: [] }), focus);
    const result = await service.establish(USER, exchange);
    expect(focus.requests).toHaveLength(0);
    const request = h.commitFinalizedExchangeWithFocus.mock.calls[0][0] as CommitFinalizedExchangeWithFocusRequest;
    expect([request.userUnits, request.userFocusUnits, request.assistantUnits, request.assistantFocusUnits]).toEqual([[], [], [], []]);
    expect(request.focusProvider).toBe('OPENAI');
    expect(focusFactory).toHaveBeenCalledTimes(1);
    expect(result.temporal).toEqual({ liveHead: null, committedEvents: [] });
  });

  it('32. USER N / ASSISTANT 0 -> exact USER mapping, no phantom ASSISTANT CU or proposal', async () => {
    const focus = new RecordingFocusProvider(SCENARIO);
    const { service, h } = build(harness(), new RoleScriptedSegmentation({ USER: SEGMENTS.USER, ASSISTANT: [] }), focus);
    const result = await service.establish(USER, exchange);
    expect(focus.requests.map((r) => r.currentCu.sourceRole)).toEqual(['USER', 'USER']);
    const request = h.commitFinalizedExchangeWithFocus.mock.calls[0][0] as CommitFinalizedExchangeWithFocusRequest;
    expect(request.userFocusUnits.map((u) => u.unit_id)).toEqual([U1_ID, U2_ID]);
    expect([request.assistantUnits, request.assistantFocusUnits]).toEqual([[], []]);
    expect(result.temporal?.committedEvents.map((e) => e.sourceTurnId)).toEqual([USER_TURN]);
    expect(result.temporal?.liveHead).toBe(2);
  });

  it('33. USER 0 / ASSISTANT N -> exact ASSISTANT mapping from a clean context', async () => {
    const focus = new RecordingFocusProvider(() => NO_FOCUS);
    const { service, h } = build(harness(), new RoleScriptedSegmentation({ USER: [], ASSISTANT: SEGMENTS.ASSISTANT }), focus);
    const result = await service.establish(USER, exchange);
    expect(focus.requests.map((r) => r.currentCu.sourceRole)).toEqual(['ASSISTANT', 'ASSISTANT']);
    expect(focus.requests[0].priorCus).toEqual([]);
    const request = h.commitFinalizedExchangeWithFocus.mock.calls[0][0] as CommitFinalizedExchangeWithFocusRequest;
    expect([request.userUnits, request.userFocusUnits]).toEqual([[], []]);
    expect(request.assistantFocusUnits).toHaveLength(2);
    expect(result.temporal?.committedEvents.map((e) => [e.sourceTurnId, e.firstSp, e.lastSp])).toEqual([[ASSISTANT_TURN, 1, 2]]);
  });
});
