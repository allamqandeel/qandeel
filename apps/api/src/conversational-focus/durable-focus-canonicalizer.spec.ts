import { ConversationalFocusEvaluatorService, PREPARED_ID_PREFIX } from './conversational-focus-evaluator.service';
import type { CurrentCuInput, PreparedConversationalFocusResult, PriorContext } from './conversational-focus.types';
import {
  canonicalizePreparedFocusSequence,
  durableEmergingFocusId,
  durableReferenceHandleId,
  EMERGING_FOCUS_NAMESPACE,
  REFERENCE_HANDLE_NAMESPACE,
} from './durable-focus-canonicalizer';
import { DURABLE_CLAIMANT_KINDS, FocusCanonicalizationError } from './durable-focus-payload.types';
import { FakeFocusResolutionProvider } from './fake-focus-resolution.provider';
import type { FocusResolutionProposal } from './focus-resolution-provider.types';

// Canonical UUIDs only: the writer's frozen payload validation admits nothing else.
const SESSION = '11111111-1111-4111-8111-111111111111';
const OTHER_SESSION = '22222222-2222-4222-8222-222222222222';
const CU1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CU2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CU3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PRIOR_CU = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const H_MANAGER = '55555555-5555-4555-8555-555555555555';
const F_MANAGER = '44444444-4444-4444-8444-444444444444';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const HISTORY: PriorContext = {
  priorCus: [{ cuId: PRIOR_CU, sourceTurnId: 'turn-0', sourceRole: 'USER', committedText: 'المدير بقى بيتعامل معايا بشكل غريب.', ordinalWithinTurn: 0, functions: ['INFORM_REPORT'], sequencePosition: 'INITIATING', targetCuId: null }],
  referenceHandles: [{ handleId: H_MANAGER, grounding: [{ cuId: PRIOR_CU, exactSurface: 'المدير' }] }],
  focusCandidates: [{ focusCandidateId: F_MANAGER, groundingHandleIds: [H_MANAGER], priorGroundingCuIds: [PRIOR_CU] }],
  currentFocusCandidateId: F_MANAGER,
};
const cu = (cuId: string, committedText: string, ordinalWithinTurn: number, sourceRole: 'USER' | 'ASSISTANT' = 'USER', sourceTurnId = 'turn-1'): CurrentCuInput =>
  ({ cuId, sourceTurnId, sourceRole, committedText, ordinalWithinTurn });

const BASE: FocusResolutionProposal = {
  functions: ['INFORM_REPORT'],
  sequencePosition: 'UNMARKED',
  targetCuId: null,
  references: [],
  claimAttributions: [],
  attention: { kind: 'NO_INDEPENDENT_FOCUS', existingFocusCandidateId: null, groundingAnchor: null, reason: 'INCIDENTAL_OR_SUBORDINATE' },
};
const proposal = (overrides: Partial<FocusResolutionProposal>): FocusResolutionProposal => ({ ...BASE, ...overrides });
const newRef = (text: string, occurrence = 1) => ({ anchor: { text, occurrence }, state: 'RESOLVED' as const, resolvedHandleId: null, candidateHandleIds: [], newReference: true });
const resolvedTo = (text: string, handleId: string) => ({ anchor: { text, occurrence: 1 }, state: 'RESOLVED' as const, resolvedHandleId: handleId, candidateHandleIds: [], newReference: false });

/** The three-CU scenario: Ahmed first grounded by CU1 with a reported claim; CU2 starts the Ahmed focus; CU3 attends it. */
async function preparedScenario() {
  const provider = FakeFocusResolutionProvider.scripted([
    proposal({
      references: [newRef('أحمد')],
      claimAttributions: [{ anchor: { text: 'إن الموضوع ده عادي', occurrence: 1 }, claimant: { kind: 'NEW_CURRENT_CU_REFERENCE', handleId: null, referenceIndex: 0 }, frame: 'REPORTED_SPEECH' }],
    }),
    proposal({
      references: [resolvedTo('أحمد', `${PREPARED_ID_PREFIX}reference:${CU1}:0`)],
      attention: { kind: 'START_NEW_FOCUS', existingFocusCandidateId: null, groundingAnchor: { text: 'أحمد', occurrence: 1 }, reason: 'DIRECT_SUBJECT' },
    }),
    proposal({
      functions: ['ASK'],
      sequencePosition: 'RESPONSIVE',
      targetCuId: CU2,
      references: [resolvedTo('أحمد', `${PREPARED_ID_PREFIX}reference:${CU1}:0`), resolvedTo('المدير', H_MANAGER)],
      attention: { kind: 'ATTEND_EXISTING_FOCUS', existingFocusCandidateId: `${PREPARED_ID_PREFIX}focus:${CU2}`, groundingAnchor: null, reason: 'DIRECT_REQUEST_OR_QUESTION' },
    }),
  ]);
  const service = new ConversationalFocusEvaluatorService(provider, 'FAKE', 'fake-model');
  const evaluation = await service.evaluateSequence(SESSION, [
    cu(CU1, 'أحمد اللي في الفريق قالّي إن الموضوع ده عادي.', 0),
    cu(CU2, 'أحمد نفسه بدأ يقلقني.', 1),
    cu(CU3, 'تقصد إن أحمد بيتجنبك بسبب المدير؟', 0, 'ASSISTANT', 'turn-2'),
  ], HISTORY);
  return evaluation.results;
}

describe('deterministic canonical identities', () => {
  it('derives the two frozen namespaces from their documented URIs', () => {
    expect(REFERENCE_HANDLE_NAMESPACE).toBe('095fa725-c218-5130-aead-f5f1472fab74');
    expect(EMERGING_FOCUS_NAMESPACE).toBe('4ef8538d-ddda-5e11-b7d9-052be85de59a');
  });

  it('pins the reference-handle and Emerging Focus vectors: same input -> same id, changed session/CU/index -> distinct', () => {
    expect(durableReferenceHandleId(SESSION, CU1, 0)).toBe('289fda39-4349-537e-b578-f952a04389df');
    expect(durableReferenceHandleId(SESSION, CU1, 1)).toBe('1d7d5d88-c3d8-5885-9929-1270359508b8');
    expect(durableReferenceHandleId(SESSION, CU2, 0)).toBe('0f8d1081-4b64-58af-b509-a1a0764a78be');
    expect(durableReferenceHandleId(OTHER_SESSION, CU1, 0)).toBe('257afca6-b83f-57ec-9a1b-f0a06b32f702');
    expect(durableEmergingFocusId(SESSION, CU1)).toBe('9fdeac8c-47a8-5b85-b717-c493c347298d');
    expect(durableEmergingFocusId(SESSION, CU2)).toBe('a38188b8-637c-5a69-a413-bca435ceae52');
    expect(durableEmergingFocusId(OTHER_SESSION, CU1)).toBe('c3a31748-4214-5ccc-8103-37b5319472a2');
    expect(durableReferenceHandleId(SESSION, CU1, 0)).toBe(durableReferenceHandleId(SESSION, CU1, 0));
    for (const id of [durableReferenceHandleId(SESSION, CU1, 0), durableEmergingFocusId(SESSION, CU1)]) expect(id).toMatch(UUID);
    expect(() => durableReferenceHandleId(SESSION, 'prepared:reference:x:0', 0)).toThrow(FocusCanonicalizationError);
    expect(() => durableReferenceHandleId('session-1', CU1, 0)).toThrow(FocusCanonicalizationError);
    expect(() => durableReferenceHandleId(SESSION, CU1, -1)).toThrow(FocusCanonicalizationError);
    expect(() => durableEmergingFocusId(SESSION, 'cu-1')).toThrow(FocusCanonicalizationError);
  });
});

describe('prepared -> canonical payload', () => {
  it('newReference -> stable handle; NEW_CURRENT_CU_REFERENCE -> REFERENCE_HANDLE(new stable handle)', async () => {
    const results = await preparedScenario();
    const canonical = canonicalizePreparedFocusSequence(results, { sessionId: SESSION, priorFocusCandidates: HISTORY.focusCandidates });
    const handle = durableReferenceHandleId(SESSION, CU1, 0);
    expect(canonical.units[0].references[0]).toEqual({
      reference_index: 0, anchor_text: 'أحمد', anchor_occurrence: 1, span_start: 0, span_end: 4,
      state: 'RESOLVED', resolved_handle_id: handle, creates_handle: true, candidate_handle_ids: [],
    });
    expect(canonical.units[0].claim_attributions[0]).toEqual({
      attribution_index: 0, anchor_text: 'إن الموضوع ده عادي', anchor_occurrence: 1, span_start: 26, span_end: 44,
      claimant_kind: 'REFERENCE_HANDLE', claimant_handle_id: handle, claim_frame: 'REPORTED_SPEECH',
    });
    expect(canonical.referenceHandleIds.get(`${PREPARED_ID_PREFIX}reference:${CU1}:0`)).toBe(handle);
    // The durable claimant vocabulary has exactly three kinds; the prepared pointer is not one of them.
    expect([...DURABLE_CLAIMANT_KINDS]).toEqual(['CURRENT_CONVERSATIONAL_SPEAKER', 'REFERENCE_HANDLE', 'UNRESOLVED']);
    expect(JSON.stringify(canonical.units)).not.toContain('NEW_CURRENT_CU_REFERENCE');
  });

  it('START_NEW_FOCUS -> stable emerging_focus_id; ATTEND_EXISTING_FOCUS -> the exact supplied durable id', async () => {
    const results = await preparedScenario();
    const canonical = canonicalizePreparedFocusSequence(results, { sessionId: SESSION, priorFocusCandidates: HISTORY.focusCandidates });
    const handle = durableReferenceHandleId(SESSION, CU1, 0);
    const focus = durableEmergingFocusId(SESSION, CU2);
    // CU2 reuses the handle CU1 created (through the prepared id) and starts the focus on it.
    expect(canonical.units[1].references[0]).toMatchObject({ state: 'RESOLVED', resolved_handle_id: handle, creates_handle: false });
    expect(canonical.units[1].attention).toEqual({ kind: 'START_NEW_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: focus, creates_focus: true, grounding_reference_index: 0 });
    expect(canonical.emergingFocusIds.get(`${PREPARED_ID_PREFIX}focus:${CU2}`)).toBe(focus);
    // CU3 attends the prepared focus by its durable id, grounded by its RESOLVED Ahmed reference.
    expect(canonical.units[2].attention).toEqual({ kind: 'ATTEND_EXISTING_FOCUS', reason: 'DIRECT_REQUEST_OR_QUESTION', emerging_focus_id: focus, creates_focus: false, grounding_reference_index: 0 });
    expect(canonical.units[2]).toMatchObject({ unit_id: CU3, functions: ['ASK'], sequence_position: 'RESPONSIVE', target_cu_id: CU2 });
    expect(canonical.units[2].references[1]).toMatchObject({ resolved_handle_id: H_MANAGER, creates_handle: false });
  });

  it('attending an already-durable focus keeps its exact id; a resolved link names the grounding index, a clean local continuation leaves it null', async () => {
    const attendWithLink = FakeFocusResolutionProvider.returning(proposal({
      references: [resolvedTo('المدير', H_MANAGER)],
      attention: { kind: 'ATTEND_EXISTING_FOCUS', existingFocusCandidateId: F_MANAGER, groundingAnchor: null, reason: 'SUBSTANTIVE_ELABORATION' },
    }));
    const linked = await new ConversationalFocusEvaluatorService(attendWithLink, 'FAKE', 'fake-model')
      .evaluateSequence(SESSION, [cu(CU1, 'المدير زعّق تاني.', 0)], HISTORY);
    const withLink = canonicalizePreparedFocusSequence(linked.results, { sessionId: SESSION, priorFocusCandidates: HISTORY.focusCandidates });
    expect(withLink.units[0].attention).toEqual({ kind: 'ATTEND_EXISTING_FOCUS', reason: 'SUBSTANTIVE_ELABORATION', emerging_focus_id: F_MANAGER, creates_focus: false, grounding_reference_index: 0 });

    const local = FakeFocusResolutionProvider.returning(proposal({ functions: ['CLARIFY'], attention: { kind: 'ATTEND_EXISTING_FOCUS', existingFocusCandidateId: F_MANAGER, groundingAnchor: null, reason: 'LOCAL_CLARIFICATION_OR_CORRECTION' } }));
    const clean = await new ConversationalFocusEvaluatorService(local, 'FAKE', 'fake-model')
      .evaluateSequence(SESSION, [cu(CU1, 'من أول الشهر.', 0)], HISTORY);
    const withoutLink = canonicalizePreparedFocusSequence(clean.results, { sessionId: SESSION, priorFocusCandidates: HISTORY.focusCandidates });
    expect(withoutLink.units[0].attention).toEqual({ kind: 'ATTEND_EXISTING_FOCUS', reason: 'LOCAL_CLARIFICATION_OR_CORRECTION', emerging_focus_id: F_MANAGER, creates_focus: false, grounding_reference_index: null });
    expect(withoutLink.emergingFocusIds.size).toBe(0);
  });

  it('is deterministic across retries and processes: identical payload and identical ids', async () => {
    const first = canonicalizePreparedFocusSequence(await preparedScenario(), { sessionId: SESSION, priorFocusCandidates: HISTORY.focusCandidates });
    const second = canonicalizePreparedFocusSequence(await preparedScenario(), { sessionId: SESSION, priorFocusCandidates: HISTORY.focusCandidates });
    expect(JSON.stringify(second.units)).toBe(JSON.stringify(first.units));
    expect([...second.referenceHandleIds]).toEqual([...first.referenceHandleIds]);
    expect([...second.emergingFocusIds]).toEqual([...first.emergingFocusIds]);
  });

  it('never emits a prepared id, and refuses a prepared id the sequence did not create', async () => {
    const results = await preparedScenario();
    const canonical = canonicalizePreparedFocusSequence(results, { sessionId: SESSION, priorFocusCandidates: HISTORY.focusCandidates });
    expect(JSON.stringify(canonical.units)).not.toContain(PREPARED_ID_PREFIX);
    for (const unit of canonical.units) expect(unit.unit_id).toMatch(/^[0-9a-f-]{36}$/u);

    const reason = (mutate: (r: PreparedConversationalFocusResult[]) => PreparedConversationalFocusResult[]) => {
      try {
        canonicalizePreparedFocusSequence(mutate(results.map((r) => ({ ...r }))), { sessionId: SESSION, priorFocusCandidates: HISTORY.focusCandidates });
      } catch (error) {
        if (error instanceof FocusCanonicalizationError) return error.reason;
        throw error;
      }
      return 'ACCEPTED';
    };
    // A prepared reference id nobody created in this sequence.
    expect(reason((r) => [r[1]])).toBe('UNKNOWN_PREPARED_REFERENCE');
    // A prepared focus id nobody created in this sequence.
    expect(reason((r) => [r[0], { ...r[2], references: [] }])).toBe('UNKNOWN_PREPARED_FOCUS');
    // A non-canonical CU id, target id or session.
    expect(reason((r) => [{ ...r[0], cuId: 'cu-1' }])).toBe('INVALID_CANONICAL_UNIT_ID');
    expect(reason((r) => [{ ...r[0], targetCuId: 'cu-prior' }])).toBe('INVALID_CANONICAL_UNIT_ID');
    expect(reason((r) => [{ ...r[0], sessionId: OTHER_SESSION }])).toBe('INVALID_DURABLE_IDENTITY');
    // A handle string that is neither prepared nor a canonical UUID.
    expect(reason((r) => [{ ...r[0], references: [{ ...r[0].references[0], newReference: false, resolvedHandleId: 'h-ahmed' }], claimAttributions: [] }])).toBe('INVALID_DURABLE_IDENTITY');
    // A NEW_CURRENT_CU_REFERENCE pointer at a reference that creates no handle.
    expect(reason((r) => [{ ...r[0], references: [{ ...r[0].references[0], newReference: false, resolvedHandleId: H_MANAGER }] }])).toBe('INVALID_CLAIMANT_POINTER');
    // A START whose grounding anchor names no RESOLVED reference of the CU.
    expect(reason((r) => [r[0], { ...r[1], references: [] }])).toBe('FOCUS_GROUNDING_REQUIRED');
  });

  it('a prior focus candidate must itself be durable', () => {
    expect(() => canonicalizePreparedFocusSequence([], { sessionId: SESSION, priorFocusCandidates: [{ focusCandidateId: 'prepared:focus:x', groundingHandleIds: [H_MANAGER], priorGroundingCuIds: [] }] }))
      .toThrow(FocusCanonicalizationError);
    expect(canonicalizePreparedFocusSequence([], { sessionId: SESSION, priorFocusCandidates: [] })).toEqual({ units: [], referenceHandleIds: new Map(), emergingFocusIds: new Map() });
  });
});
