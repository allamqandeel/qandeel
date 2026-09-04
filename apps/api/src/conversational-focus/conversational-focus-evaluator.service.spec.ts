import {
  ConversationalFocusEvaluatorService,
  orderFinalizedExchange,
  PREPARED_ID_PREFIX,
} from './conversational-focus-evaluator.service';
import {
  FOCUS_EVALUATOR_VERSION,
  FOCUS_POLICY_VERSION,
  FocusEvaluationRejectedError,
  type ConversationalFocusEvaluationInput,
  type CurrentCuInput,
  type PriorContext,
} from './conversational-focus.types';
import { FakeFocusResolutionProvider } from './fake-focus-resolution.provider';
import { FOCUS_RESOLUTION_PROMPT_VERSION } from './focus-resolution-provider.config';
import { FOCUS_RESOLUTION_SCHEMA_VERSION, type FocusResolutionProposal } from './focus-resolution-provider.types';

const H_MANAGER = 'h-manager';
const H_AHMED_TEAM = 'h-ahmed-team';
const H_KHALED = 'h-khaled';
const F_MANAGER = 'f-manager';
const F_AHMED = 'f-ahmed';

const HISTORY: PriorContext = {
  priorCus: [
    { cuId: 'cu-h1', sourceTurnId: 'turn-0', sourceRole: 'USER', committedText: 'المدير بقى بيتعامل معايا بشكل غريب من أول الشهر.', ordinalWithinTurn: 1, functions: ['INFORM_REPORT'], sequencePosition: 'INITIATING', targetCuId: null },
    { cuId: 'cu-h2', sourceTurnId: 'turn-0', sourceRole: 'USER', committedText: 'وأحمد اللي في الفريق قالّي إن الموضوع ده عادي.', ordinalWithinTurn: 2, functions: ['INFORM_REPORT'], sequencePosition: 'FOLLOW_UP', targetCuId: 'cu-h1' },
    { cuId: 'cu-h3', sourceTurnId: 'turn-1', sourceRole: 'ASSISTANT', committedText: 'تقصد إن المدير اتغير معاك فجأة؟', ordinalWithinTurn: 1, functions: ['ASK'], sequencePosition: 'RESPONSIVE', targetCuId: 'cu-h1' },
    { cuId: 'cu-h4', sourceTurnId: 'turn-2', sourceRole: 'USER', committedText: 'خالد كمان لاحظ نفس الحاجة.', ordinalWithinTurn: 1, functions: null, sequencePosition: null, targetCuId: null },
  ],
  referenceHandles: [
    { handleId: H_MANAGER, grounding: [{ cuId: 'cu-h1', exactSurface: 'المدير' }] },
    { handleId: H_AHMED_TEAM, grounding: [{ cuId: 'cu-h2', exactSurface: 'أحمد' }] },
    { handleId: H_KHALED, grounding: [{ cuId: 'cu-h4', exactSurface: 'خالد' }] },
  ],
  focusCandidates: [
    { focusCandidateId: F_MANAGER, groundingHandleIds: [H_MANAGER], priorGroundingCuIds: ['cu-h1', 'cu-h3'] },
    { focusCandidateId: F_AHMED, groundingHandleIds: [H_AHMED_TEAM], priorGroundingCuIds: ['cu-h2'] },
  ],
  currentFocusCandidateId: F_MANAGER,
};

const cu = (cuId: string, committedText: string, sourceTurnId = 'turn-3', ordinalWithinTurn = 1, sourceRole: 'USER' | 'ASSISTANT' = 'USER'): CurrentCuInput => ({
  cuId,
  sourceTurnId,
  sourceRole,
  committedText,
  ordinalWithinTurn,
});
const input = (currentCu: CurrentCuInput, priorContext: PriorContext = HISTORY): ConversationalFocusEvaluationInput => ({
  sessionId: 'session-1',
  currentCu,
  priorContext,
});

const BASE: FocusResolutionProposal = {
  functions: ['INFORM_REPORT'],
  sequencePosition: 'UNMARKED',
  targetCuId: null,
  references: [],
  claimAttributions: [],
  attention: { kind: 'NO_INDEPENDENT_FOCUS', existingFocusCandidateId: null, groundingAnchor: null, reason: 'INCIDENTAL_OR_SUBORDINATE' },
};
const proposal = (overrides: Partial<FocusResolutionProposal>): FocusResolutionProposal => ({ ...BASE, ...overrides });
const resolvedTo = (text: string, handleId: string, occurrence = 1) => ({ anchor: { text, occurrence }, state: 'RESOLVED' as const, resolvedHandleId: handleId, candidateHandleIds: [], newReference: false });
const newRef = (text: string, occurrence = 1) => ({ anchor: { text, occurrence }, state: 'RESOLVED' as const, resolvedHandleId: null, candidateHandleIds: [], newReference: true });
const ambiguous = (text: string, candidates: string[]) => ({ anchor: { text, occurrence: 1 }, state: 'AMBIGUOUS' as const, resolvedHandleId: null, candidateHandleIds: candidates, newReference: false });
const unresolved = (text: string) => ({ anchor: { text, occurrence: 1 }, state: 'UNRESOLVED' as const, resolvedHandleId: null, candidateHandleIds: [], newReference: false });
const attend = (id: string, reason: FocusResolutionProposal['attention']['reason'] = 'SUBSTANTIVE_ELABORATION') => ({ kind: 'ATTEND_EXISTING_FOCUS' as const, existingFocusCandidateId: id, groundingAnchor: null, reason });
const startNew = (text: string, reason: FocusResolutionProposal['attention']['reason'] = 'DIRECT_SUBJECT') => ({ kind: 'START_NEW_FOCUS' as const, existingFocusCandidateId: null, groundingAnchor: { text, occurrence: 1 }, reason });

const service = (provider: FakeFocusResolutionProvider) => new ConversationalFocusEvaluatorService(provider, 'FAKE', 'fake-model');
const rejection = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof FocusEvaluationRejectedError) return error.reason;
    throw error;
  }
  throw new Error('expected a rejection');
};

describe('one-CU evaluation with PRIOR context only', () => {
  it('1. an incidental Ahmed mention resolves the reference and asserts no Ahmed focus', async () => {
    const provider = FakeFocusResolutionProvider.returning(proposal({
      references: [resolvedTo('المدير', H_MANAGER), resolvedTo('أحمد', H_AHMED_TEAM)],
      attention: attend(F_MANAGER),
    }));
    const result = await service(provider).evaluateOne(input(cu('cu-a', 'المدير زعّق لأحمد قدام الكل.')));
    expect(result.references[1]).toMatchObject({ resolvedHandleId: H_AHMED_TEAM, span: { start: 13, end: 17 } });
    expect(result.attention).toMatchObject({ kind: 'ATTEND_EXISTING_FOCUS', existingFocusCandidateId: F_MANAGER });
    expect(result.attention.kind).not.toBe('START_NEW_FOCUS');
  });

  it('2. a direct Ahmed concern is a NEW grounded focus (THR-02), with no id authored anywhere', async () => {
    const provider = FakeFocusResolutionProvider.returning(proposal({
      references: [resolvedTo('أحمد', H_AHMED_TEAM), resolvedTo('المدير', H_MANAGER)],
      attention: startNew('أحمد'),
    }));
    const result = await service(provider).evaluateOne(input(cu('cu-b', 'أحمد نفسه بدأ يقلقني أكتر من المدير.')));
    expect(result.attention).toEqual({ kind: 'START_NEW_FOCUS', existingFocusCandidateId: null, grounding: { anchor: { text: 'أحمد', occurrence: 1 }, span: { start: 0, end: 4 } }, reason: 'DIRECT_SUBJECT' });
    expect(JSON.stringify(result)).not.toMatch(/emergingFocusId|emerging_focus_id|threadId|prepared:/u);
  });

  it('3. a RESOLVED pronoun continues the existing Ahmed focus', async () => {
    const provider = FakeFocusResolutionProvider.returning(proposal({ references: [resolvedTo('هو', H_AHMED_TEAM)], attention: attend(F_AHMED) }));
    const result = await service(provider).evaluateOne(input(cu('cu-c', 'هو بقاله أسبوع بيتجنبني.'), { ...HISTORY, currentFocusCandidateId: F_AHMED }));
    expect(result.attention.existingFocusCandidateId).toBe(F_AHMED);
    expect(result.references[0]).toMatchObject({ anchor: { text: 'هو', occurrence: 1 }, resolvedHandleId: H_AHMED_TEAM, span: { start: 0, end: 2 } });
  });

  it('4. an AMBIGUOUS Ahmed/Khaled pronoun yields no identity-specific continuity', async () => {
    const ctx = { ...HISTORY, currentFocusCandidateId: F_AHMED };
    const text = cu('cu-d', 'هو بقاله أسبوع بيتجنبني.');
    const forced = FakeFocusResolutionProvider.returning(proposal({ references: [ambiguous('هو', [H_AHMED_TEAM, H_KHALED])], attention: attend(F_AHMED) }));
    expect(await rejection(service(forced).evaluateOne(input(text, ctx)))).toBe('UNGROUNDED_FOCUS_CONTINUITY');
    const truthful = FakeFocusResolutionProvider.returning(proposal({ references: [ambiguous('هو', [H_AHMED_TEAM, H_KHALED])], attention: { ...BASE.attention, reason: 'UNRESOLVED_ATTENTION' } }));
    const result = await service(truthful).evaluateOne(input(text, ctx));
    expect(result.references[0]).toMatchObject({ state: 'AMBIGUOUS', resolvedHandleId: null, candidateHandleIds: [H_AHMED_TEAM, H_KHALED] });
    expect(result.attention).toEqual({ kind: 'NO_INDEPENDENT_FOCUS', existingFocusCandidateId: null, grounding: null, reason: 'UNRESOLVED_ATTENTION' });
  });

  it('5. an UNRESOLVED pronoun never becomes a guessed handle, and the sequence mints nothing for it', async () => {
    const provider = FakeFocusResolutionProvider.returning(proposal({ references: [unresolved('هي')] }));
    const evaluation = await service(provider).evaluateSequence('session-1', [cu('cu-e', 'هي قالت إنها هتيجي.')], HISTORY);
    expect(evaluation.results[0].references[0]).toMatchObject({ state: 'UNRESOLVED', resolvedHandleId: null, candidateHandleIds: [] });
    expect(evaluation.preparedReferenceHandles).toEqual([]);
    expect(evaluation.preparedContext.referenceHandles).toEqual(HISTORY.referenceHandles);
  });

  it('6. two handles named أحمد: the lexical name alone cannot choose', async () => {
    const H_AHMED_COUSIN = 'h-ahmed-cousin';
    const ctx: PriorContext = {
      ...HISTORY,
      priorCus: [...HISTORY.priorCus, { cuId: 'cu-h5', sourceTurnId: 'turn-2', sourceRole: 'USER', committedText: 'أحمد ابن عمي زارنا الخميس.', ordinalWithinTurn: 2, functions: null, sequencePosition: null, targetCuId: null }],
      referenceHandles: [...HISTORY.referenceHandles, { handleId: H_AHMED_COUSIN, grounding: [{ cuId: 'cu-h5', exactSurface: 'أحمد' }] }],
    };
    const provider = FakeFocusResolutionProvider.returning(proposal({ references: [ambiguous('أحمد', [H_AHMED_TEAM, H_AHMED_COUSIN])] }));
    const result = await service(provider).evaluateOne(input(cu('cu-f', 'أحمد اتصل بيا امبارح.'), ctx));
    expect(result.references[0].resolvedHandleId).toBeNull();
    expect(result.references[0].candidateHandleIds).toEqual([H_AHMED_TEAM, H_AHMED_COUSIN]);
    // The request carried BOTH same-name handles with their distinct grounding.
    expect(provider.requests[0].referenceHandles.filter((h) => h.grounding[0].exactSurface === 'أحمد').map((h) => h.grounding[0].cuId)).toEqual(['cu-h2', 'cu-h5']);
  });

  it('7. reported speech: USER stays the conversational speaker, Ahmed is the claimant (CU-13)', async () => {
    const provider = FakeFocusResolutionProvider.returning({
      ...proposal({
        references: [resolvedTo('أحمد', H_AHMED_TEAM)],
        claimAttributions: [{ anchor: { text: 'إنه مش جاي', occurrence: 1 }, claimant: { kind: 'REFERENCE_HANDLE', handleId: H_AHMED_TEAM, referenceIndex: null }, frame: 'REPORTED_SPEECH' }],
      }),
      // A smuggled speaker field has no channel into the result.
      ...({ sourceRole: 'ASSISTANT', speaker: 'ASSISTANT' } as object),
    });
    const result = await service(provider).evaluateOne(input(cu('cu-g', 'أحمد قال إنه مش جاي.')));
    expect(result.sourceRole).toBe('USER');
    expect(result.claimAttributions[0]).toMatchObject({ claimant: { kind: 'REFERENCE_HANDLE', handleId: H_AHMED_TEAM }, frame: 'REPORTED_SPEECH' });
    expect(Object.keys(result)).not.toContain('speaker');
  });

  it('8. a grounded direct quotation shifts أنا to the quoted Ahmed (CU-14)', async () => {
    const provider = FakeFocusResolutionProvider.returning(proposal({
      references: [resolvedTo('أحمد', H_AHMED_TEAM), resolvedTo('أنا', H_AHMED_TEAM)],
      claimAttributions: [{ anchor: { text: 'أنا مش رايح', occurrence: 1 }, claimant: { kind: 'REFERENCE_HANDLE', handleId: H_AHMED_TEAM, referenceIndex: null }, frame: 'DIRECT_QUOTATION' }],
    }));
    const result = await service(provider).evaluateOne(input(cu('cu-i', 'أحمد قالّي: أنا مش رايح.')));
    expect(result.references[1]).toMatchObject({ anchor: { text: 'أنا', occurrence: 1 }, resolvedHandleId: H_AHMED_TEAM });
    expect(result.claimAttributions[0].frame).toBe('DIRECT_QUOTATION');
    expect(result.sourceRole).toBe('USER');
  });

  it('9. an ambiguous quotation source keeps the claimant UNRESOLVED', async () => {
    const provider = FakeFocusResolutionProvider.returning(proposal({
      references: [unresolved('أنا')],
      claimAttributions: [{ anchor: { text: 'أنا مش رايح', occurrence: 1 }, claimant: { kind: 'UNRESOLVED', handleId: null, referenceIndex: null }, frame: 'DIRECT_QUOTATION' }],
    }));
    const result = await service(provider).evaluateOne(input(cu('cu-j', 'قالّي: أنا مش رايح.')));
    expect(result.claimAttributions[0].claimant).toEqual({ kind: 'UNRESOLVED', handleId: null, referenceIndex: null });
    expect(result.references[0].resolvedHandleId).toBeNull();
  });

  it('10. three resolved Ahmed mentions inside Khaled\'s quotation do not become a USER Ahmed focus', async () => {
    const text = 'خالد قالّي: أحمد زعلان، وأحمد مش عايز يتكلم، وأحمد هيسيب الفريق.';
    const provider = FakeFocusResolutionProvider.returning(proposal({
      references: [resolvedTo('خالد', H_KHALED), resolvedTo('أحمد', H_AHMED_TEAM, 1), resolvedTo('أحمد', H_AHMED_TEAM, 2), resolvedTo('أحمد', H_AHMED_TEAM, 3)],
      claimAttributions: [{ anchor: { text: 'أحمد زعلان، وأحمد مش عايز يتكلم، وأحمد هيسيب الفريق', occurrence: 1 }, claimant: { kind: 'REFERENCE_HANDLE', handleId: H_KHALED, referenceIndex: null }, frame: 'DIRECT_QUOTATION' }],
    }));
    const evaluation = await service(provider).evaluateSequence('session-1', [cu('cu-k', text)], HISTORY);
    const [result] = evaluation.results;
    expect(result.references.filter((r) => r.resolvedHandleId === H_AHMED_TEAM)).toHaveLength(3);
    expect(result.attention.kind).toBe('NO_INDEPENDENT_FOCUS');
    expect(evaluation.preparedFocusCandidates).toEqual([]);
    expect(evaluation.preparedContext.currentFocusCandidateId).toBe(F_MANAGER);
  });

  it('11. code-switching neither breaks grounded continuity nor creates identity or focus (CU-15)', async () => {
    const provider = FakeFocusResolutionProvider.returning(proposal({ references: [resolvedTo('Ahmed', H_AHMED_TEAM)] }));
    const evaluation = await service(provider).evaluateSequence('session-1', [cu('cu-l', 'Ahmed literally told me مش هيكمل.')], HISTORY);
    const [result] = evaluation.results;
    // The English surface resolves to the handle grounded by an Arabic surface.
    expect(result.references[0]).toMatchObject({ anchor: { text: 'Ahmed', occurrence: 1 }, resolvedHandleId: H_AHMED_TEAM, span: { start: 0, end: 5 } });
    expect(HISTORY.referenceHandles.find((h) => h.handleId === H_AHMED_TEAM)?.grounding[0].exactSurface).toBe('أحمد');
    expect(result.attention.kind).toBe('NO_INDEPENDENT_FOCUS');
    expect(evaluation.preparedReferenceHandles).toEqual([]);
    expect(evaluation.preparedFocusCandidates).toEqual([]);
  });

  it('16. a local temporal clarification keeps the current focus and starts no Time focus', async () => {
    const ctx: PriorContext = {
      ...HISTORY,
      priorCus: [...HISTORY.priorCus, { cuId: 'cu-h6', sourceTurnId: 'turn-2b', sourceRole: 'ASSISTANT', committedText: 'ده حصل إمتى؟', ordinalWithinTurn: 1, functions: ['ASK'], sequencePosition: 'RESPONSIVE', targetCuId: 'cu-h4' }],
    };
    const provider = FakeFocusResolutionProvider.returning(proposal({
      functions: ['CLARIFY'],
      sequencePosition: 'RESPONSIVE',
      targetCuId: 'cu-h6',
      references: [newRef('الثلاث اللي فات')],
      attention: attend(F_MANAGER, 'LOCAL_CLARIFICATION_OR_CORRECTION'),
    }));
    const evaluation = await service(provider).evaluateSequence('session-1', [cu('cu-m', 'الثلاث اللي فات.')], ctx);
    expect(evaluation.results[0].targetCuId).toBe('cu-h6');
    expect(evaluation.preparedContext.currentFocusCandidateId).toBe(F_MANAGER);
    expect(evaluation.preparedFocusCandidates).toEqual([]);
    // The time expression became a selectable reference for LATER CUs, but not a focus.
    expect(evaluation.preparedReferenceHandles).toEqual([{ preparedHandleId: `${PREPARED_ID_PREFIX}reference:cu-m:0`, cuId: 'cu-m', referenceIndex: 0, exactSurface: 'الثلاث اللي فات' }]);
  });

  it('23. provider failure fails closed and is never reported as an attention value', async () => {
    for (const code of ['UNAVAILABLE', 'TIMEOUT', 'PROVIDER_ERROR'] as const) {
      const provider = FakeFocusResolutionProvider.failing(code);
      expect(await rejection(service(provider).evaluateOne(input(cu('cu-n', 'أحمد زعلان.'))))).toBe('FOCUS_PROVIDER_UNAVAILABLE');
    }
  });

  it('24. malformed structured output fails closed as INVALID_PROVIDER_PAYLOAD', async () => {
    expect(await rejection(service(FakeFocusResolutionProvider.failing('INVALID_STRUCTURED_OUTPUT')).evaluateOne(input(cu('cu-o', 'أحمد زعلان.'))))).toBe('INVALID_PROVIDER_PAYLOAD');
    const widened = FakeFocusResolutionProvider.returning(proposal({ functions: ['INFORM_REPORT', 'PRAISE' as never] }));
    expect(await rejection(service(widened).evaluateOne(input(cu('cu-o', 'أحمد زعلان.'))))).toBe('INVALID_PROVIDER_PAYLOAD');
  });

  it('25. the one-CU input cannot contain the current CU or any later CU of its turn, and the provider is never called', async () => {
    const provider = FakeFocusResolutionProvider.returning(BASE);
    const current = cu('cu-2', 'وبعدين أحمد سكت.', 'turn-3', 2);
    const later = (cuId: string, ordinal: number) => ({ cuId, sourceTurnId: 'turn-3', sourceRole: 'USER' as const, committedText: 'وبعدين خالد اتكلم.', ordinalWithinTurn: ordinal, functions: null, sequencePosition: null, targetCuId: null });
    const earlier = later('cu-1', 1);
    // Earlier CU of the same turn: legitimate prior context.
    await service(provider).evaluateOne(input(current, { ...HISTORY, priorCus: [...HISTORY.priorCus, earlier] }));
    expect(provider.requests).toHaveLength(1);
    // The current CU itself, a later CU of the same turn, or grounding that
    // points at the current CU: hindsight, refused before any provider call.
    expect(await rejection(service(provider).evaluateOne(input(current, { ...HISTORY, priorCus: [...HISTORY.priorCus, later('cu-2', 2)] })))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(await rejection(service(provider).evaluateOne(input(current, { ...HISTORY, priorCus: [...HISTORY.priorCus, later('cu-3', 3)] })))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(await rejection(service(provider).evaluateOne(input(current, { ...HISTORY, referenceHandles: [...HISTORY.referenceHandles, { handleId: 'h-x', grounding: [{ cuId: 'cu-2', exactSurface: 'أحمد' }] }] })))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(await rejection(service(provider).evaluateOne(input(current, { ...HISTORY, focusCandidates: [...HISTORY.focusCandidates, { focusCandidateId: 'f-x', groundingHandleIds: [H_KHALED], priorGroundingCuIds: ['cu-2'] }] })))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(provider.requests).toHaveLength(1);
  });

  it('carries stable technical provenance and no wall-clock or SP value', async () => {
    const provider = FakeFocusResolutionProvider.returning(BASE);
    const result = await service(provider).evaluateOne(input(cu('cu-p', 'تمام.')));
    expect(result.provenance).toEqual({
      evaluatorVersion: FOCUS_EVALUATOR_VERSION,
      policyVersion: FOCUS_POLICY_VERSION,
      provider: 'FAKE',
      model: 'fake-model',
      promptVersion: FOCUS_RESOLUTION_PROMPT_VERSION,
      schemaVersion: FOCUS_RESOLUTION_SCHEMA_VERSION,
    });
    expect(Object.keys(result).sort()).toEqual(['attention', 'claimAttributions', 'cuId', 'functions', 'provenance', 'references', 'sequencePosition', 'sessionId', 'sourceRole', 'sourceTurnId', 'targetCuId']);
    expect(JSON.stringify(result)).not.toMatch(/sessionPosition|session_position|createdAt|timestamp|\d{4}-\d{2}-\d{2}T/u);
    // The provider request carries the schema version and the one CU, nothing else.
    expect(Object.keys(provider.requests[0]).sort()).toEqual(['currentCu', 'currentFocusCandidateId', 'focusCandidates', 'priorCus', 'referenceHandles', 'schemaVersion']);
  });

  it('rejects a structurally invalid input before any provider call', async () => {
    const provider = FakeFocusResolutionProvider.returning(BASE);
    expect(await rejection(service(provider).evaluateOne(input(cu('cu-q', ''))))).toBe('INVALID_EVALUATION_INPUT');
    expect(await rejection(service(provider).evaluateOne(input(cu('cu-q', 'x'), { ...HISTORY, currentFocusCandidateId: 'f-unknown' })))).toBe('INVALID_EVALUATION_INPUT');
    expect(await rejection(service(provider).evaluateOne(input(cu('cu-q', 'x'), { ...HISTORY, focusCandidates: [{ focusCandidateId: 'f-z', groundingHandleIds: ['h-unknown'], priorGroundingCuIds: [] }] })))).toBe('INVALID_EVALUATION_INPUT');
    expect(await rejection(service(provider).evaluateOne({ ...input(cu('cu-q', 'x')), sessionId: '' }))).toBe('INVALID_EVALUATION_INPUT');
    expect(provider.requests).toHaveLength(0);
  });
});

describe('sequential evaluation with a PREPARED transient context (§16/§17)', () => {
  const U1 = cu('cu-u1', 'أحمد نفسه بدأ يقلقني أكتر من المدير.', 'turn-3', 1);
  const U2 = cu('cu-u2', 'هو بقاله أسبوع بيتجنبني.', 'turn-3', 2);
  const A1 = cu('cu-a1', 'تقصد إن أحمد بيتجنبك من بعد الموضوع مع المدير؟', 'turn-4', 1, 'ASSISTANT');

  const scripted = () =>
    FakeFocusResolutionProvider.scripted([
      proposal({ references: [resolvedTo('أحمد', H_AHMED_TEAM), resolvedTo('المدير', H_MANAGER)], attention: startNew('أحمد', 'EXPLICIT_FOCUS_SHIFT'), functions: ['INFORM_REPORT', 'FOCUS_SHIFT'] }),
      proposal({ references: [resolvedTo('هو', H_AHMED_TEAM)], attention: attend(`${PREPARED_ID_PREFIX}focus:cu-u1`), sequencePosition: 'FOLLOW_UP', targetCuId: 'cu-u1' }),
      proposal({ functions: ['ASK'], sequencePosition: 'RESPONSIVE', targetCuId: 'cu-u2', references: [resolvedTo('أحمد', H_AHMED_TEAM), resolvedTo('المدير', H_MANAGER)], attention: attend(`${PREPARED_ID_PREFIX}focus:cu-u1`, 'DIRECT_REQUEST_OR_QUESTION') }),
    ]);

  it('26. evaluates USER CU1 -> USER CU2 -> ASSISTANT CU1 in exact order, each seeing only what precedes it', async () => {
    const provider = scripted();
    const evaluation = await service(provider).evaluateSequence('session-1', orderFinalizedExchange([U2, U1], [A1]), HISTORY);

    expect(provider.requests.map((r) => r.currentCu.cuId)).toEqual(['cu-u1', 'cu-u2', 'cu-a1']);
    expect(evaluation.results.map((r) => r.cuId)).toEqual(['cu-u1', 'cu-u2', 'cu-a1']);

    // CU-2 saw history + CU-1's PREPARED result (functions, position, target)
    // and the focus CU-1 started; the assistant CU saw both USER CUs.
    const second = provider.requests[1];
    expect(second.priorCus.map((c) => c.cuId)).toEqual([...HISTORY.priorCus.map((c) => c.cuId), 'cu-u1']);
    expect(second.priorCus.at(-1)).toMatchObject({ functions: ['INFORM_REPORT', 'FOCUS_SHIFT'], sequencePosition: 'UNMARKED', targetCuId: null });
    expect(second.focusCandidates.map((f) => f.focusCandidateId)).toEqual([F_MANAGER, F_AHMED, `${PREPARED_ID_PREFIX}focus:cu-u1`]);
    expect(second.currentFocusCandidateId).toBe(`${PREPARED_ID_PREFIX}focus:cu-u1`);
    const third = provider.requests[2];
    expect(third.priorCus.map((c) => c.cuId)).toEqual([...HISTORY.priorCus.map((c) => c.cuId), 'cu-u1', 'cu-u2']);
    expect(third.priorCus.at(-1)).toMatchObject({ sourceRole: 'USER', targetCuId: 'cu-u1' });

    // The prepared focus is grounded on the existing Ahmed handle, and both
    // later CUs extended its grounding CUs.
    expect(evaluation.preparedFocusCandidates).toEqual([{ focusCandidateId: `${PREPARED_ID_PREFIX}focus:cu-u1`, groundingHandleIds: [H_AHMED_TEAM], priorGroundingCuIds: ['cu-u1'], startedByCuId: 'cu-u1' }]);
    expect(evaluation.preparedContext.focusCandidates.at(-1)?.priorGroundingCuIds).toEqual(['cu-u1', 'cu-u2', 'cu-a1']);
    expect(evaluation.preparedContext.currentFocusCandidateId).toBe(`${PREPARED_ID_PREFIX}focus:cu-u1`);
    expect(evaluation.preparedContext.priorCus).toHaveLength(HISTORY.priorCus.length + 3);
  });

  it('27. the FIRST provider request contains no later CU: not its id, not its wording, not its turn', async () => {
    const provider = scripted();
    await service(provider).evaluateSequence('session-1', orderFinalizedExchange([U1, U2], [A1]), HISTORY);
    const first = JSON.stringify(provider.requests[0]);
    for (const later of [U2, A1]) {
      expect(first).not.toContain(later.cuId);
      expect(first).not.toContain(later.committedText);
    }
    expect(first).not.toContain('turn-4');
    expect(provider.requests[0].priorCus.map((c) => c.cuId)).toEqual(HISTORY.priorCus.map((c) => c.cuId));
    expect(provider.requests[0].currentFocusCandidateId).toBe(F_MANAGER);
    // And the USER CUs never saw assistant material: the assistant request is last.
    expect(JSON.stringify(provider.requests[1])).not.toContain(A1.committedText);
  });

  it('28. relationship reframing mints a prepared handle and a focus grounded on IT, not on the person', async () => {
    const provider = FakeFocusResolutionProvider.scripted([
      proposal({ references: [resolvedTo('أحمد', H_AHMED_TEAM), newRef('علاقتي بأحمد')], attention: startNew('علاقتي بأحمد') }),
      proposal({ references: [resolvedTo('العلاقة دي', `${PREPARED_ID_PREFIX}reference:cu-r1:1`)], attention: attend(`${PREPARED_ID_PREFIX}focus:cu-r1`) }),
    ]);
    const evaluation = await service(provider).evaluateSequence('session-1', [cu('cu-r1', 'علاقتي بأحمد بقت مرهقة.', 'turn-5', 1), cu('cu-r2', 'العلاقة دي بتاكل مني.', 'turn-5', 2)], HISTORY);
    expect(evaluation.preparedReferenceHandles).toEqual([{ preparedHandleId: `${PREPARED_ID_PREFIX}reference:cu-r1:1`, cuId: 'cu-r1', referenceIndex: 1, exactSurface: 'علاقتي بأحمد' }]);
    expect(evaluation.preparedFocusCandidates[0]).toMatchObject({ groundingHandleIds: [`${PREPARED_ID_PREFIX}reference:cu-r1:1`], startedByCuId: 'cu-r1' });
    expect(evaluation.preparedFocusCandidates[0].groundingHandleIds).not.toContain(H_AHMED_TEAM);
    // The second CU selected the prepared handle from its allowlist with exact grounding.
    expect(provider.requests[1].referenceHandles.at(-1)).toEqual({ handleId: `${PREPARED_ID_PREFIX}reference:cu-r1:1`, grounding: [{ cuId: 'cu-r1', exactSurface: 'علاقتي بأحمد' }] });
    expect(evaluation.results[1].references[0].resolvedHandleId).toBe(`${PREPARED_ID_PREFIX}reference:cu-r1:1`);
  });

  it('a prepared id is never selectable before the CU that grounds it', async () => {
    const provider = FakeFocusResolutionProvider.scripted([
      proposal({ references: [resolvedTo('أحمد', `${PREPARED_ID_PREFIX}reference:cu-r1:0`)] }),
    ]);
    expect(await rejection(service(provider).evaluateSequence('session-1', [cu('cu-r1', 'أحمد زعلان.', 'turn-5', 1)], HISTORY))).toBe('UNKNOWN_REFERENCE_HANDLE');
  });

  it('NO_INDEPENDENT_FOCUS leaves the transient focus state untouched', async () => {
    const provider = FakeFocusResolutionProvider.returning(proposal({ references: [resolvedTo('أحمد', H_AHMED_TEAM)] }));
    const evaluation = await service(provider).evaluateSequence('session-1', [cu('cu-s1', 'أحمد كان موجود.', 'turn-6', 1), cu('cu-s2', 'أحمد سكت.', 'turn-6', 2)], HISTORY);
    expect(evaluation.preparedContext.focusCandidates).toEqual(HISTORY.focusCandidates);
    expect(evaluation.preparedContext.currentFocusCandidateId).toBe(F_MANAGER);
    expect(evaluation.results).toHaveLength(2);
  });

  it('a failure in the middle of a sequence aborts the whole prepared batch', async () => {
    const provider = new FakeFocusResolutionProvider([
      { kind: 'PROPOSAL', proposal: BASE },
      { kind: 'FAILURE', code: 'TIMEOUT' },
      { kind: 'PROPOSAL', proposal: BASE },
    ]);
    expect(await rejection(service(provider).evaluateSequence('session-1', [U1, U2], HISTORY))).toBe('FOCUS_PROVIDER_UNAVAILABLE');
    expect(provider.requests).toHaveLength(2);
  });

  it('refuses a non-canonical sequence and a history that already contains the sequence', async () => {
    const provider = FakeFocusResolutionProvider.returning(BASE);
    const evaluator = service(provider);
    // Interleaved turns, descending ordinals, duplicate CU.
    expect(await rejection(evaluator.evaluateSequence('session-1', [U1, A1, U2], HISTORY))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(await rejection(evaluator.evaluateSequence('session-1', [U2, U1], HISTORY))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(await rejection(evaluator.evaluateSequence('session-1', [U1, U1], HISTORY))).toBe('INVALID_EVALUATION_INPUT');
    // The history may not already know the sequence's CUs or turns.
    const leakedCu: PriorContext = { ...HISTORY, priorCus: [...HISTORY.priorCus, { ...U2, functions: null, sequencePosition: null, targetCuId: null }] };
    expect(await rejection(evaluator.evaluateSequence('session-1', [U1, U2], leakedCu))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    const leakedTurn: PriorContext = { ...HISTORY, priorCus: [...HISTORY.priorCus, { ...cu('cu-u9', 'كلام تاني.', 'turn-3', 9), functions: null, sequencePosition: null, targetCuId: null }] };
    expect(await rejection(evaluator.evaluateSequence('session-1', [U1, U2], leakedTurn))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(provider.requests).toHaveLength(0);
    // orderFinalizedExchange refuses a role mismatch.
    expect(() => orderFinalizedExchange([A1], [U1])).toThrow(FocusEvaluationRejectedError);
    expect(orderFinalizedExchange([U2, U1], [A1]).map((c) => c.cuId)).toEqual(['cu-u1', 'cu-u2', 'cu-a1']);
  });
});
