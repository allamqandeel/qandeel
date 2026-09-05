import type { CurrentCuInput } from '../conversational-focus/conversational-focus.types';
import type { CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import { FakeThreadContinuityProvider } from './fake-thread-continuity.provider';
import { parseThreadContinuityResolutionOutput, parseThreadContinuityScreeningOutput } from './openai-thread-continuity.provider';
import { openAiThreadContinuityBinding } from './thread-continuity-binding';
import { loadThreadContinuityOpenAIConfig, loadThreadContinuityProviderIdentity } from './thread-continuity-provider.config';
import { THREAD_CONTINUITY_SCHEMA_VERSION, ThreadContinuityProviderError, type ThreadContinuityResolutionProposal, type ThreadContinuityResolutionRequest } from './thread-continuity-provider.types';
import { chunkDossiers, ThreadContinuityEvaluatorService } from './thread-continuity-evaluator.service';
import { validateThreadContinuityResolution, validateThreadContinuityScreening } from './thread-continuity-validator';
import { THREAD_CONTINUITY_SCREEN_CHUNK_SIZE, ThreadContinuityRejectedError, type ThreadContinuityEvaluationInput, type ThreadIdentityDossier } from './thread-continuity.types';

const SESSION = '33333333-3333-4333-8333-333333333333';
const CU = '11111111-2222-4333-8444-555555555555';
const PRIOR_CU = '11111111-2222-4333-8444-666666666666';
const FOCUS = '4ef8538d-ddda-5e11-b7d9-052be85de59a';
const HANDLE = '5ef8538d-ddda-5e11-b7d9-052be85de59a';
const OTHER_HANDLE = '6ef8538d-ddda-5e11-b7d9-052be85de59a';
const TEXT = 'عايز أرجع لأحمد بتاع الشغل.';
const threadId = (n: number) => `${n.toString(16).padStart(8, '0')}-0000-5000-8000-000000000000`;

const currentCu: CurrentCuInput = { cuId: CU, sourceTurnId: '77777777-7777-4777-8777-777777777777', sourceRole: 'USER', committedText: TEXT, ordinalWithinTurn: 0 };
const bundle = (references: CanonicalCuFocusSemanticPayload['references'] = [
  { reference_index: 0, anchor_text: 'أحمد', anchor_occurrence: 1, span_start: 11, span_end: 15, state: 'RESOLVED', resolved_handle_id: HANDLE, creates_handle: true, candidate_handle_ids: [] },
]): CanonicalCuFocusSemanticPayload => ({
  unit_id: CU, functions: ['REQUEST'], sequence_position: 'INITIATING', target_cu_id: null, references, claim_attributions: [],
  attention: { kind: 'START_NEW_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: FOCUS, creates_focus: true, grounding_reference_index: 0 },
});
const dossier = (id: string, surface = 'أحمد'): ThreadIdentityDossier => ({
  threadId: id,
  identityEvidence: [{ sessionId: '88888888-8888-4888-8888-888888888888', cuId: PRIOR_CU, exactSurface: surface, committedCuText: `${surface} نفسه بدأ يقلقني.`, sourceRole: 'USER' }],
});
const dossiers = (count: number) => Array.from({ length: count }, (_v, index) => dossier(threadId(index + 1)));
const input = (overrides: Partial<ThreadContinuityEvaluationInput> = {}): ThreadContinuityEvaluationInput => ({
  sessionId: SESSION, currentCu, currentFocusSemantics: bundle(),
  currentFocusGrounding: { emergingFocusId: FOCUS, groundingSurfaces: [{ cuId: CU, exactSurface: 'أحمد', committedCuText: TEXT }] },
  dossiers: dossiers(3), ...overrides,
});
const handles = { groundingHandleIds: [HANDLE] };
const bind = (id: string): ThreadContinuityResolutionProposal => ({ decision: 'BIND_EXISTING', threadId: id, candidateThreadIds: [], currentEvidenceReferenceIndexes: [0], priorEvidenceRefs: [{ cuId: PRIOR_CU, exactSurface: 'أحمد' }] });
const ambiguous = (ids: string[]): ThreadContinuityResolutionProposal => ({ decision: 'AMBIGUOUS_EXISTING', threadId: null, candidateThreadIds: ids, currentEvidenceReferenceIndexes: [], priorEvidenceRefs: [] });
const distinct: ThreadContinuityResolutionProposal = { decision: 'DISTINCT_NEW', threadId: null, candidateThreadIds: [], currentEvidenceReferenceIndexes: [], priorEvidenceRefs: [] };
const service = (provider: FakeThreadContinuityProvider) => new ThreadContinuityEvaluatorService(provider, 'OPENAI', 'gpt-5-mini');
const rejection = async (promise: Promise<unknown>) => {
  try { await promise; } catch (error) { return error; }
  throw new Error('expected a rejection');
};
const rejectedWith = async (promise: Promise<unknown>, reason: string) => {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(ThreadContinuityRejectedError);
  expect((error as ThreadContinuityRejectedError).reason).toBe(reason);
};

describe('exhaustive deterministic screening (cases 33-40)', () => {
  it('33. every dossier is screened, in exact textual order, in fixed chunks of 32, strictly sequentially', async () => {
    const provider = FakeThreadContinuityProvider.nominatingNone();
    const result = await service(provider).resolveOne(input({ dossiers: dossiers(70) }), handles);
    expect(provider.screeningRequests).toHaveLength(3);
    expect(provider.screeningRequests.map((request) => request.candidates.length)).toEqual([32, 32, 6]);
    const screened = provider.screeningRequests.flatMap((request) => request.candidates.map((candidate) => candidate.threadId));
    expect(screened).toEqual(dossiers(70).map((dossier) => dossier.threadId));
    expect(result.screenedThreadIds).toEqual(screened);
    expect(provider.maxInFlight).toBe(1);
    expect(THREAD_CONTINUITY_SCREEN_CHUNK_SIZE).toBe(32);
    expect(chunkDossiers(dossiers(70)).map((chunk) => chunk.length)).toEqual([32, 32, 6]);
  });

  it('34. nothing nominated anywhere is a deterministic DISTINCT_NEW with zero resolution calls', async () => {
    const provider = FakeThreadContinuityProvider.nominatingNone();
    const result = await service(provider).resolveOne(input(), handles);
    expect(result).toMatchObject({ decision: 'DISTINCT_NEW', threadId: null, candidateThreadIds: [], currentEvidenceReferenceIndexes: [], priorEvidenceRefs: [] });
    expect(provider.resolutionRequests).toHaveLength(0);
  });

  it('35. zero dossiers is a deterministic DISTINCT_NEW with zero provider calls of any kind', async () => {
    const provider = FakeThreadContinuityProvider.failing('PROVIDER_ERROR');
    const result = await service(provider).resolveOne(input({ dossiers: [] }), handles);
    expect(result.decision).toBe('DISTINCT_NEW');
    expect([provider.screeningRequests, provider.resolutionRequests].map((r) => r.length)).toEqual([0, 0]);
  });

  it('36. the union of every chunk\'s nominations reaches ONE final resolution', async () => {
    const all = dossiers(70);
    const provider = new FakeThreadContinuityProvider(
      (request) => ({ possibleSameThreadIds: request.candidates.filter((c) => [threadId(2), threadId(40), threadId(70)].includes(c.threadId)).map((c) => c.threadId) }),
      () => bind(threadId(40)),
    );
    const result = await service(provider).resolveOne(input({ dossiers: all }), handles);
    expect(provider.resolutionRequests).toHaveLength(1);
    expect(provider.resolutionRequests[0].candidates.map((c) => c.threadId)).toEqual([threadId(2), threadId(40), threadId(70)]);
    expect(result).toMatchObject({ decision: 'BIND_EXISTING', threadId: threadId(40) });
  });

  it('37. a screening nomination outside the supplied chunk, or a duplicate, is refused before any resolution', async () => {
    const foreign = new FakeThreadContinuityProvider(() => ({ possibleSameThreadIds: [threadId(99)] }), () => distinct);
    await rejectedWith(service(foreign).resolveOne(input(), handles), 'UNKNOWN_CANDIDATE_THREAD');
    expect(foreign.resolutionRequests).toHaveLength(0);
    const duplicate = new FakeThreadContinuityProvider(() => ({ possibleSameThreadIds: [threadId(1), threadId(1)] }), () => distinct);
    await rejectedWith(service(duplicate).resolveOne(input(), handles), 'DUPLICATE_CANDIDATE_THREAD');
    // A nomination of a Thread from ANOTHER chunk is out-of-chunk too.
    const crossChunk = new FakeThreadContinuityProvider(() => ({ possibleSameThreadIds: [threadId(70)] }), () => distinct);
    await rejectedWith(service(crossChunk).resolveOne(input({ dossiers: dossiers(70) }), handles), 'UNKNOWN_CANDIDATE_THREAD');
  });

  it('38. the provider sees only the firewall fields: no Home, geography, relation, confidence or later material', async () => {
    const provider = FakeThreadContinuityProvider.nominatingAll(distinct);
    await service(provider).resolveOne(input(), handles);
    for (const request of [...provider.screeningRequests, ...provider.resolutionRequests]) {
      expect(Object.keys(request).sort()).toEqual(['candidates', 'currentCu', 'currentFocusGrounding', 'currentFocusSemantics', 'schemaVersion']);
      const wire = JSON.stringify(request).toLowerCase();
      for (const forbidden of ['placement', 'home', 'coordinate', 'relation', 'reading', 'hypothesis', 'confidence', 'importance', 'rank', 'score', 'viewport', 'live_focus', 'lifecycle', 'created_at']) {
        expect(wire.includes(forbidden)).toBe(false);
      }
      for (const candidate of request.candidates) expect(Object.keys(candidate).sort()).toEqual(['identityEvidence', 'threadId']);
    }
  });

  it('39. a technical provider failure is never DISTINCT_NEW', async () => {
    await rejectedWith(service(FakeThreadContinuityProvider.failing('UNAVAILABLE')).resolveOne(input(), handles), 'CONTINUITY_PROVIDER_UNAVAILABLE');
    await rejectedWith(service(FakeThreadContinuityProvider.failing('TIMEOUT')).resolveOne(input(), handles), 'CONTINUITY_PROVIDER_UNAVAILABLE');
    await rejectedWith(service(FakeThreadContinuityProvider.failing('INVALID_STRUCTURED_OUTPUT')).resolveOne(input(), handles), 'INVALID_PROVIDER_PAYLOAD');
    const lateFailure = new FakeThreadContinuityProvider((request) => ({ possibleSameThreadIds: [request.candidates[0].threadId] }), () => new ThreadContinuityProviderError('UNAVAILABLE'));
    await rejectedWith(service(lateFailure).resolveOne(input(), handles), 'CONTINUITY_PROVIDER_UNAVAILABLE');
  });

  it('40. the input boundary refuses a no-focus CU, a mismatched bundle, unordered or ungrounded dossiers', async () => {
    const provider = FakeThreadContinuityProvider.nominatingAll(distinct);
    const noFocus = { ...bundle(), attention: { kind: 'NO_INDEPENDENT_FOCUS' as const, reason: 'INCIDENTAL_OR_SUBORDINATE' as const, emerging_focus_id: null, creates_focus: false, grounding_reference_index: null } };
    await rejectedWith(service(provider).resolveOne(input({ currentFocusSemantics: noFocus }), handles), 'NO_INDEPENDENT_FOCUS');
    await rejectedWith(service(provider).resolveOne(input({ currentFocusSemantics: { ...bundle(), unit_id: PRIOR_CU } }), handles), 'FOCUS_SEMANTICS_MISMATCH');
    await rejectedWith(service(provider).resolveOne(input({ dossiers: [dossier(threadId(2)), dossier(threadId(1))] }), handles), 'INVALID_DOSSIER');
    await rejectedWith(service(provider).resolveOne(input({ dossiers: [dossier(threadId(1)), dossier(threadId(1))] }), handles), 'INVALID_DOSSIER');
    await rejectedWith(service(provider).resolveOne(input({ dossiers: [{ threadId: threadId(1), identityEvidence: [] }] }), handles), 'INVALID_DOSSIER');
    const alias: ThreadIdentityDossier = { threadId: threadId(1), identityEvidence: [{ sessionId: SESSION, cuId: PRIOR_CU, exactSurface: 'Ahmed (colleague)', committedCuText: 'أحمد نفسه بدأ يقلقني.', sourceRole: 'USER' }] };
    await rejectedWith(service(provider).resolveOne(input({ dossiers: [alias] }), handles), 'INVALID_DOSSIER');
    await rejectedWith(service(provider).resolveOne(input(), { groundingHandleIds: [] }), 'INVALID_EVALUATION_INPUT');
    expect([provider.screeningRequests, provider.resolutionRequests].map((r) => r.length)).toEqual([0, 0]);
  });
});

describe('final resolution validation (cases 41-48)', () => {
  it('41. same name alone never binds: BIND_EXISTING needs a current RESOLVED reference to the focus\'s OWN grounding handle', async () => {
    // The current CU resolves "أحمد" to a handle that does NOT ground the current focus.
    const foreignHandle = bundle([{ reference_index: 0, anchor_text: 'أحمد', anchor_occurrence: 1, span_start: 11, span_end: 15, state: 'RESOLVED', resolved_handle_id: OTHER_HANDLE, creates_handle: true, candidate_handle_ids: [] }]);
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll(bind(threadId(1)))).resolveOne(input({ currentFocusSemantics: foreignHandle }), handles), 'CURRENT_EVIDENCE_NOT_GROUNDED');
    // An AMBIGUOUS current reference is not grounding either.
    const ambiguousRef = bundle([{ reference_index: 0, anchor_text: 'أحمد', anchor_occurrence: 1, span_start: 11, span_end: 15, state: 'AMBIGUOUS', resolved_handle_id: null, creates_handle: false, candidate_handle_ids: [HANDLE, OTHER_HANDLE] }]);
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll(bind(threadId(1)))).resolveOne(input({ currentFocusSemantics: ambiguousRef }), handles), 'CURRENT_EVIDENCE_NOT_GROUNDED');
    // No current evidence at all is never a bind.
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll({ ...bind(threadId(1)), currentEvidenceReferenceIndexes: [] })).resolveOne(input(), handles), 'CURRENT_EVIDENCE_REQUIRED');
  });

  it('42. the same Thread with strong grounding binds, with exact current and prior evidence', async () => {
    const result = await service(FakeThreadContinuityProvider.nominatingAll(bind(threadId(2)))).resolveOne(input(), handles);
    expect(result).toMatchObject({ decision: 'BIND_EXISTING', threadId: threadId(2), candidateThreadIds: [], currentEvidenceReferenceIndexes: [0], priorEvidenceRefs: [{ cuId: PRIOR_CU, exactSurface: 'أحمد' }] });
    expect(result.provenance).toEqual({ evaluatorVersion: 'thread-continuity-evaluator-v1', policyVersion: 'stage-1.3-thread-lifecycle-v1', provider: 'OPENAI', model: 'gpt-5-mini', promptVersion: 'thread-continuity-identity-v1', schemaVersion: 1 });
  });

  it('43. prior evidence must be an EXACT existing dossier item of the bound Thread: no alias, no normalization, no other Thread', async () => {
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll({ ...bind(threadId(1)), priorEvidenceRefs: [] })).resolveOne(input(), handles), 'PRIOR_EVIDENCE_REQUIRED');
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll({ ...bind(threadId(1)), priorEvidenceRefs: [{ cuId: PRIOR_CU, exactSurface: 'احمد' }] })).resolveOne(input(), handles), 'PRIOR_EVIDENCE_NOT_IN_DOSSIER');
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll({ ...bind(threadId(1)), priorEvidenceRefs: [{ cuId: CU, exactSurface: 'أحمد' }] })).resolveOne(input(), handles), 'PRIOR_EVIDENCE_NOT_IN_DOSSIER');
    const two = [dossier(threadId(1), 'أحمد'), dossier(threadId(2), 'المدير')];
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll({ ...bind(threadId(1)), priorEvidenceRefs: [{ cuId: PRIOR_CU, exactSurface: 'المدير' }] })).resolveOne(input({ dossiers: two }), handles), 'PRIOR_EVIDENCE_NOT_IN_DOSSIER');
  });

  it('44. the provider cannot mint or substitute a Thread id, in any decision', async () => {
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll(bind(threadId(9)))).resolveOne(input(), handles), 'UNKNOWN_CANDIDATE_THREAD');
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll(ambiguous([threadId(1), threadId(9)]))).resolveOne(input(), handles), 'UNKNOWN_CANDIDATE_THREAD');
    // A Thread that exists but was NOT nominated by any chunk is outside the resolution set.
    const partial = new FakeThreadContinuityProvider((request) => ({ possibleSameThreadIds: request.candidates.filter((c) => c.threadId !== threadId(3)).map((c) => c.threadId) }), () => bind(threadId(3)));
    await rejectedWith(service(partial).resolveOne(input(), handles), 'UNKNOWN_CANDIDATE_THREAD');
  });

  it('45. ambiguity stays ambiguity: at least two distinct nominated Threads, in canonical order, nothing picked', async () => {
    const result = await service(FakeThreadContinuityProvider.nominatingAll(ambiguous([threadId(3), threadId(1)]))).resolveOne(input(), handles);
    expect(result).toMatchObject({ decision: 'AMBIGUOUS_EXISTING', threadId: null, candidateThreadIds: [threadId(1), threadId(3)] });
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll(ambiguous([threadId(1)]))).resolveOne(input(), handles), 'INSUFFICIENT_AMBIGUITY_CANDIDATES');
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll(ambiguous([threadId(1), threadId(1)]))).resolveOne(input(), handles), 'DUPLICATE_CANDIDATE_THREAD');
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll({ ...ambiguous([threadId(1), threadId(2)]), threadId: threadId(1) })).resolveOne(input(), handles), 'INVALID_DECISION_SHAPE');
  });

  it('46. a relational reframing resolved DISTINCT_NEW stays distinct, carrying nothing', async () => {
    const result = await service(FakeThreadContinuityProvider.nominatingAll(distinct)).resolveOne(input(), handles);
    expect(result).toMatchObject({ decision: 'DISTINCT_NEW', threadId: null, candidateThreadIds: [], currentEvidenceReferenceIndexes: [], priorEvidenceRefs: [] });
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll({ ...distinct, threadId: threadId(1) })).resolveOne(input(), handles), 'INVALID_DECISION_SHAPE');
    await rejectedWith(service(FakeThreadContinuityProvider.nominatingAll({ ...distinct, candidateThreadIds: [threadId(1), threadId(2)] })).resolveOne(input(), handles), 'INVALID_DECISION_SHAPE');
  });

  it('47. no score, rank, confidence or rationale exists in any proposal or result', () => {
    const screening = validateThreadContinuityScreening({ possibleSameThreadIds: [threadId(2), threadId(1)] }, dossiers(3));
    expect(screening).toEqual({ outcome: 'ACCEPTED', nominated: [threadId(1), threadId(2)] });
    const resolution = validateThreadContinuityResolution(bind(threadId(1)), { currentFocusSemantics: bundle(), currentFocusGrounding: input().currentFocusGrounding, groundingHandleIds: [HANDLE], candidates: dossiers(1) });
    expect(resolution.outcome).toBe('ACCEPTED');
    expect(Object.keys(resolution).sort()).toEqual(['candidateThreadIds', 'currentEvidenceReferenceIndexes', 'decision', 'outcome', 'priorEvidenceRefs', 'threadId']);
    expect(JSON.stringify(resolution).toLowerCase()).not.toMatch(/score|rank|confidence|rationale|similarity/u);
  });

  it('48. the parsers enforce shape only, fail closed, and are tested apart from any API invocation', () => {
    const request: ThreadContinuityResolutionRequest = { schemaVersion: THREAD_CONTINUITY_SCHEMA_VERSION, currentCu, currentFocusSemantics: bundle(), currentFocusGrounding: input().currentFocusGrounding, candidates: dossiers(2) };
    expect(parseThreadContinuityScreeningOutput(JSON.stringify({ possibleSameThreadIds: [threadId(1)] }), request)).toEqual({ possibleSameThreadIds: [threadId(1)] });
    expect(parseThreadContinuityResolutionOutput(JSON.stringify(bind(threadId(1))), request)).toEqual(bind(threadId(1)));
    for (const bad of ['', 'not json', '[]', JSON.stringify({}), JSON.stringify({ possibleSameThreadIds: 'x' }), JSON.stringify({ possibleSameThreadIds: [1] }),
      JSON.stringify({ possibleSameThreadIds: [threadId(1), threadId(2), threadId(3)] }), JSON.stringify({ possibleSameThreadIds: [], score: 0.9 })]) {
      expect(() => parseThreadContinuityScreeningOutput(bad, request)).toThrow(ThreadContinuityProviderError);
    }
    for (const bad of [JSON.stringify({ ...bind(threadId(1)), confidence: 0.9 }), JSON.stringify({ ...bind(threadId(1)), decision: 'MAYBE' }),
      JSON.stringify({ ...bind(threadId(1)), currentEvidenceReferenceIndexes: [5] }), JSON.stringify({ ...bind(threadId(1)), currentEvidenceReferenceIndexes: [-1] }),
      JSON.stringify({ ...bind(threadId(1)), priorEvidenceRefs: [{ cuId: PRIOR_CU }] }), JSON.stringify({ ...bind(threadId(1)), priorEvidenceRefs: [{ cuId: PRIOR_CU, exactSurface: '' }] }),
      JSON.stringify({ ...bind(threadId(1)), threadId: 7 }), 'x'.repeat(100_001)]) {
      expect(() => parseThreadContinuityResolutionOutput(bad, request)).toThrow(ThreadContinuityProviderError);
    }
    // The production binding reads only the provider identity; the credential is read on the first real call.
    const environment = {} as NodeJS.ProcessEnv;
    expect(() => openAiThreadContinuityBinding(environment)).not.toThrow();
    const binding = openAiThreadContinuityBinding(environment)();
    expect([binding.providerName, binding.providerModel]).toEqual(['OPENAI', 'gpt-5-mini']);
    expect(loadThreadContinuityProviderIdentity(environment)).toEqual({ provider: 'OPENAI', model: 'gpt-5-mini' });
    expect(() => loadThreadContinuityOpenAIConfig(environment)).toThrow(/OPENAI_API_KEY/u);
    expect(() => loadThreadContinuityProviderIdentity({ THREAD_CONTINUITY_PROVIDER: 'ANTHROPIC' } as NodeJS.ProcessEnv)).toThrow(/OPENAI/u);
    expect(() => loadThreadContinuityOpenAIConfig({ OPENAI_API_KEY: 'k', THREAD_CONTINUITY_TIMEOUT_MS: '5' } as NodeJS.ProcessEnv)).toThrow(/TIMEOUT/u);
  });
});
