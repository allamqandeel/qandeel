import type { ConversationalFocusEvaluationInput, PriorContext } from './conversational-focus.types';
import type { FocusResolutionProposal } from './focus-resolution-provider.types';
import { validateFocusResolutionProposal } from './focus-resolution-validator';

// Opaque server-supplied identities. Two handles share the lexical name أحمد
// (CU-11): only prior grounding tells them apart.
const H_MANAGER = 'h-manager';
const H_AHMED_TEAM = 'h-ahmed-team';
const H_AHMED_COUSIN = 'h-ahmed-cousin';
const H_KHALED = 'h-khaled';
const F_MANAGER = 'f-manager';
const F_AHMED = 'f-ahmed';

const HISTORY: PriorContext = {
  priorCus: [
    { cuId: 'cu-h1', sourceTurnId: 'turn-0', sourceRole: 'USER', committedText: 'المدير بقى بيتعامل معايا بشكل غريب من أول الشهر.', ordinalWithinTurn: 1, functions: ['INFORM_REPORT'], sequencePosition: 'INITIATING', targetCuId: null },
    { cuId: 'cu-h2', sourceTurnId: 'turn-0', sourceRole: 'USER', committedText: 'وأحمد اللي في الفريق قالّي إن الموضوع ده عادي.', ordinalWithinTurn: 2, functions: ['INFORM_REPORT'], sequencePosition: 'FOLLOW_UP', targetCuId: 'cu-h1' },
    { cuId: 'cu-h3', sourceTurnId: 'turn-1', sourceRole: 'ASSISTANT', committedText: 'تقصد إن المدير اتغير معاك فجأة؟', ordinalWithinTurn: 1, functions: ['ASK'], sequencePosition: 'RESPONSIVE', targetCuId: 'cu-h1' },
    { cuId: 'cu-h4', sourceTurnId: 'turn-2', sourceRole: 'USER', committedText: 'خالد كمان لاحظ نفس الحاجة.', ordinalWithinTurn: 1, functions: null, sequencePosition: null, targetCuId: null },
    { cuId: 'cu-h5', sourceTurnId: 'turn-2', sourceRole: 'USER', committedText: 'أحمد ابن عمي زارنا الخميس.', ordinalWithinTurn: 2, functions: null, sequencePosition: null, targetCuId: null },
  ],
  referenceHandles: [
    { handleId: H_MANAGER, grounding: [{ cuId: 'cu-h1', exactSurface: 'المدير' }] },
    { handleId: H_AHMED_TEAM, grounding: [{ cuId: 'cu-h2', exactSurface: 'أحمد' }] },
    { handleId: H_KHALED, grounding: [{ cuId: 'cu-h4', exactSurface: 'خالد' }] },
    { handleId: H_AHMED_COUSIN, grounding: [{ cuId: 'cu-h5', exactSurface: 'أحمد' }] },
  ],
  // Ahmed exists here as a Mention/reference handle ONLY: no focus candidate
  // represents him yet (THR-01), so a direct Ahmed CU may START a focus.
  focusCandidates: [
    { focusCandidateId: F_MANAGER, groundingHandleIds: [H_MANAGER], priorGroundingCuIds: ['cu-h1', 'cu-h3'] },
  ],
  currentFocusCandidateId: F_MANAGER,
};
/** The same history once an Ahmed focus candidate already represents H_AHMED_TEAM. */
const AHMED_FOCUSED: PriorContext = {
  ...HISTORY,
  focusCandidates: [...HISTORY.focusCandidates, { focusCandidateId: F_AHMED, groundingHandleIds: [H_AHMED_TEAM], priorGroundingCuIds: ['cu-h2'] }],
};

const input = (committedText: string, priorContext: PriorContext = HISTORY): ConversationalFocusEvaluationInput => ({
  sessionId: 'session-1',
  currentCu: { cuId: 'cu-current', sourceTurnId: 'turn-3', sourceRole: 'USER', committedText, ordinalWithinTurn: 1 },
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
const resolvedTo = (text: string, handleId: string, occurrence = 1) => ({
  anchor: { text, occurrence },
  state: 'RESOLVED' as const,
  resolvedHandleId: handleId,
  candidateHandleIds: [],
  newReference: false,
});
const newRef = (text: string, occurrence = 1) => ({
  anchor: { text, occurrence },
  state: 'RESOLVED' as const,
  resolvedHandleId: null,
  candidateHandleIds: [],
  newReference: true,
});
const ambiguous = (text: string, candidates: string[], occurrence = 1) => ({
  anchor: { text, occurrence },
  state: 'AMBIGUOUS' as const,
  resolvedHandleId: null,
  candidateHandleIds: candidates,
  newReference: false,
});
const unresolved = (text: string, occurrence = 1) => ({
  anchor: { text, occurrence },
  state: 'UNRESOLVED' as const,
  resolvedHandleId: null,
  candidateHandleIds: [],
  newReference: false,
});
const attend = (id: string, reason: FocusResolutionProposal['attention']['reason'] = 'SUBSTANTIVE_ELABORATION') => ({
  kind: 'ATTEND_EXISTING_FOCUS' as const,
  existingFocusCandidateId: id,
  groundingAnchor: null,
  reason,
});
const startNew = (text: string, reason: FocusResolutionProposal['attention']['reason'] = 'DIRECT_SUBJECT', occurrence = 1) => ({
  kind: 'START_NEW_FOCUS' as const,
  existingFocusCandidateId: null,
  groundingAnchor: { text, occurrence },
  reason,
});

const valid = (text: string, p: FocusResolutionProposal, ctx: PriorContext = HISTORY) => {
  const result = validateFocusResolutionProposal(p, input(text, ctx));
  if (result.outcome !== 'VALID') throw new Error(`expected VALID, got ${result.reason}@${result.index}`);
  return result.resolution;
};
const rejection = (text: string, p: FocusResolutionProposal, ctx: PriorContext = HISTORY) => {
  const result = validateFocusResolutionProposal(p, input(text, ctx));
  if (result.outcome !== 'REJECTED') throw new Error('expected REJECTED');
  return `${result.reason}@${result.index}`;
};

describe('conversational functions and sequence position (fixtures 12-15, 17)', () => {
  it('12. one CU carries INFORM_REPORT + FOCUS_SHIFT without duplicating source', () => {
    const text = 'بس الحقيقة اللي شاغلني دلوقتي أحمد مش المدير.';
    const resolution = valid(text, proposal({
      functions: ['INFORM_REPORT', 'FOCUS_SHIFT'],
      references: [resolvedTo('أحمد', H_AHMED_TEAM), resolvedTo('المدير', H_MANAGER)],
      attention: startNew('أحمد', 'EXPLICIT_FOCUS_SHIFT'),
    }));
    expect(resolution.functions).toEqual(['INFORM_REPORT', 'FOCUS_SHIFT']);
    expect(resolution.references).toHaveLength(2);
  });

  it('13. CLARIFY + DISAGREE_CHALLENGE is one list; a duplicated function is refused', () => {
    const text = 'لا، أنا مش قصدي إنه بيتجنبني، قصدي إنه اتغير.';
    const ok = valid(text, proposal({ functions: ['CLARIFY', 'DISAGREE_CHALLENGE'], sequencePosition: 'RESPONSIVE', targetCuId: 'cu-h3', attention: attend(F_MANAGER, 'LOCAL_CLARIFICATION_OR_CORRECTION') }));
    expect(ok.functions).toEqual(['CLARIFY', 'DISAGREE_CHALLENGE']);
    expect(ok.targetCuId).toBe('cu-h3');
    expect(rejection(text, proposal({ functions: ['CLARIFY', 'CLARIFY'] }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
  });

  it('14. FUNCTION_UNRESOLVED is legitimate, and stands alone', () => {
    expect(valid('همم.', proposal({ functions: ['FUNCTION_UNRESOLVED'] })).functions).toEqual(['FUNCTION_UNRESOLVED']);
    expect(rejection('همم.', proposal({ functions: ['FUNCTION_UNRESOLVED', 'ACKNOWLEDGE'] }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
  });

  it('15. a function outside the frozen vocabulary is refused, as is an empty list', () => {
    expect(rejection('أهلاً.', proposal({ functions: ['GREET' as never] }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
    expect(rejection('أهلاً.', proposal({ functions: ['inform_report' as never] }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
    expect(rejection('أهلاً.', proposal({ functions: [] }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
    expect(rejection('أهلاً.', proposal({ sequencePosition: 'OPENING' as never }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
  });

  it('17. a target CU must be a prior, allowlisted CU - never the current CU, a future CU or an unknown CU', () => {
    const text = 'أيوه، من أول الشهر.';
    expect(valid(text, proposal({ sequencePosition: 'RESPONSIVE', targetCuId: 'cu-h3', attention: attend(F_MANAGER, 'LOCAL_CLARIFICATION_OR_CORRECTION') })).targetCuId).toBe('cu-h3');
    expect(rejection(text, proposal({ sequencePosition: 'RESPONSIVE', targetCuId: 'cu-current' }))).toBe('UNKNOWN_TARGET_CU@-1');
    expect(rejection(text, proposal({ sequencePosition: 'RESPONSIVE', targetCuId: 'cu-future' }))).toBe('UNKNOWN_TARGET_CU@-1');
    expect(rejection(text, proposal({ sequencePosition: 'RESPONSIVE', targetCuId: 'other-session-cu' }))).toBe('UNKNOWN_TARGET_CU@-1');
    // An initiating or unmarked contribution binds to no target.
    expect(rejection(text, proposal({ sequencePosition: 'INITIATING', targetCuId: 'cu-h3' }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
    // Local target binding is not a Thread relation: nothing Thread-shaped exists in the result.
    const resolution = valid(text, proposal({ sequencePosition: 'FOLLOW_UP', targetCuId: 'cu-h1', attention: attend(F_MANAGER, 'LOCAL_CLARIFICATION_OR_CORRECTION') }));
    expect(Object.keys(resolution).sort()).toEqual(['attention', 'claimAttributions', 'functions', 'references', 'sequencePosition', 'targetCuId']);
  });
});

describe('three-state reference resolution (fixtures 4-6, 18)', () => {
  it('a RESOLVED reference asserts exactly one identity: a prior handle or a NEW current-CU reference', () => {
    const text = 'أحمد نفسه بدأ يقلقني أكتر من المدير.';
    const ok = valid(text, proposal({ references: [resolvedTo('أحمد', H_AHMED_TEAM), newRef('يقلقني')] }));
    expect(ok.references[0]).toMatchObject({ state: 'RESOLVED', resolvedHandleId: H_AHMED_TEAM, newReference: false, span: { start: 0, end: 4 } });
    expect(ok.references[1]).toMatchObject({ state: 'RESOLVED', resolvedHandleId: null, newReference: true });
    // Both at once, or neither, is not one identity.
    expect(rejection(text, proposal({ references: [{ ...resolvedTo('أحمد', H_AHMED_TEAM), newReference: true }] }))).toBe('INVALID_REFERENCE_CARDINALITY@0');
    expect(rejection(text, proposal({ references: [{ ...newRef('أحمد'), newReference: false }] }))).toBe('INVALID_REFERENCE_CARDINALITY@0');
    expect(rejection(text, proposal({ references: [{ ...resolvedTo('أحمد', H_AHMED_TEAM), candidateHandleIds: [H_KHALED] }] }))).toBe('INVALID_REFERENCE_CARDINALITY@0');
  });

  it('4. an AMBIGUOUS pronoun carries two distinct allowlisted candidates and no identity', () => {
    const text = 'هو بقاله أسبوع بيتجنبني.';
    const ok = valid(text, proposal({ references: [ambiguous('هو', [H_AHMED_TEAM, H_KHALED])], attention: { ...BASE.attention, reason: 'UNRESOLVED_ATTENTION' } }));
    expect(ok.references[0]).toMatchObject({ state: 'AMBIGUOUS', resolvedHandleId: null, candidateHandleIds: [H_AHMED_TEAM, H_KHALED] });
    expect(rejection(text, proposal({ references: [ambiguous('هو', [H_AHMED_TEAM])] }))).toBe('INVALID_REFERENCE_CARDINALITY@0');
    expect(rejection(text, proposal({ references: [ambiguous('هو', [H_AHMED_TEAM, H_AHMED_TEAM])] }))).toBe('INVALID_REFERENCE_CARDINALITY@0');
    expect(rejection(text, proposal({ references: [{ ...ambiguous('هو', [H_AHMED_TEAM, H_KHALED]), resolvedHandleId: H_AHMED_TEAM }] }))).toBe('INVALID_REFERENCE_CARDINALITY@0');
  });

  it('5. an UNRESOLVED pronoun asserts nothing: no handle, no candidates, no new reference', () => {
    const text = 'هي قالت إنها هتيجي.';
    expect(valid(text, proposal({ references: [unresolved('هي')] })).references[0]).toMatchObject({ state: 'UNRESOLVED', resolvedHandleId: null, candidateHandleIds: [], newReference: false });
    expect(rejection(text, proposal({ references: [{ ...unresolved('هي'), resolvedHandleId: H_KHALED }] }))).toBe('INVALID_REFERENCE_CARDINALITY@0');
    expect(rejection(text, proposal({ references: [{ ...unresolved('هي'), candidateHandleIds: [H_KHALED] }] }))).toBe('INVALID_REFERENCE_CARDINALITY@0');
    expect(rejection(text, proposal({ references: [{ ...unresolved('هي'), newReference: true }] }))).toBe('INVALID_REFERENCE_CARDINALITY@0');
  });

  it('6. two handles named أحمد: the name alone cannot choose, and no candidate is ever "picked"', () => {
    const text = 'أحمد اتصل بيا امبارح.';
    // The allowlist really does carry the same surface twice.
    const surfaces = HISTORY.referenceHandles.filter((h) => h.grounding[0].exactSurface === 'أحمد').map((h) => h.handleId);
    expect(surfaces).toEqual([H_AHMED_TEAM, H_AHMED_COUSIN]);
    const ok = valid(text, proposal({ references: [ambiguous('أحمد', [H_AHMED_TEAM, H_AHMED_COUSIN])] }));
    expect(ok.references[0].resolvedHandleId).toBeNull();
    expect(ok.references[0].candidateHandleIds).toEqual([H_AHMED_TEAM, H_AHMED_COUSIN]);
    // Either handle is selectable when grounded - the validator never prefers one.
    expect(valid(text, proposal({ references: [resolvedTo('أحمد', H_AHMED_COUSIN)] })).references[0].resolvedHandleId).toBe(H_AHMED_COUSIN);
    expect(valid(text, proposal({ references: [resolvedTo('أحمد', H_AHMED_TEAM)] })).references[0].resolvedHandleId).toBe(H_AHMED_TEAM);
  });

  it('18. a provider-invented reference id is refused everywhere it could appear', () => {
    const text = 'أحمد قال إنه مش جاي.';
    expect(rejection(text, proposal({ references: [resolvedTo('أحمد', 'h-invented')] }))).toBe('UNKNOWN_REFERENCE_HANDLE@0');
    expect(rejection(text, proposal({ references: [ambiguous('أحمد', [H_AHMED_TEAM, 'h-invented'])] }))).toBe('UNKNOWN_REFERENCE_HANDLE@0');
    expect(rejection(text, proposal({
      references: [resolvedTo('أحمد', H_AHMED_TEAM)],
      claimAttributions: [{ anchor: { text: 'إنه مش جاي', occurrence: 1 }, claimant: { kind: 'REFERENCE_HANDLE', handleId: 'h-invented', referenceIndex: null }, frame: 'REPORTED_SPEECH' }],
    }))).toBe('UNKNOWN_REFERENCE_HANDLE@0');
    // Reported per element, so the second reference is the one named.
    expect(rejection(text, proposal({ references: [resolvedTo('أحمد', H_AHMED_TEAM), resolvedTo('جاي', 'h-invented')] }))).toBe('UNKNOWN_REFERENCE_HANDLE@1');
  });

  it('20. a non-extractive or out-of-range anchor fails at that element', () => {
    const text = 'أحمد قال إنه مش جاي.';
    expect(rejection(text, proposal({ references: [resolvedTo('احمد', H_AHMED_TEAM)] }))).toBe('NON_EXTRACTIVE_REFERENCE@0');
    expect(rejection(text, proposal({ references: [resolvedTo('أحمد', H_AHMED_TEAM, 2)] }))).toBe('OCCURRENCE_OUT_OF_RANGE@0');
    expect(rejection(text, proposal({ references: [{ ...resolvedTo('أحمد', H_AHMED_TEAM), anchor: { text: '', occurrence: 1 } }] }))).toBe('INVALID_PROVIDER_PAYLOAD@0');
  });
});

describe('claim attribution (fixtures 7-9)', () => {
  const REPORTED = 'أحمد قال إنه مش جاي.';
  const QUOTED = 'أحمد قالّي: أنا مش رايح.';

  it('7. indirect reported speech attributes the claim to Ahmed, never to the conversational speaker', () => {
    const ok = valid(REPORTED, proposal({
      references: [resolvedTo('أحمد', H_AHMED_TEAM)],
      claimAttributions: [{ anchor: { text: 'إنه مش جاي', occurrence: 1 }, claimant: { kind: 'REFERENCE_HANDLE', handleId: H_AHMED_TEAM, referenceIndex: null }, frame: 'REPORTED_SPEECH' }],
    }));
    expect(ok.claimAttributions[0]).toMatchObject({ claimant: { kind: 'REFERENCE_HANDLE', handleId: H_AHMED_TEAM }, frame: 'REPORTED_SPEECH', span: { start: 9, end: 19 } });
    // The claimant may also be a reference first grounded in this very CU.
    const fresh = valid('سامي قال إنه مش جاي.', proposal({
      references: [newRef('سامي')],
      claimAttributions: [{ anchor: { text: 'إنه مش جاي', occurrence: 1 }, claimant: { kind: 'NEW_CURRENT_CU_REFERENCE', handleId: null, referenceIndex: 0 }, frame: 'REPORTED_SPEECH' }],
    }));
    expect(fresh.claimAttributions[0].claimant).toEqual({ kind: 'NEW_CURRENT_CU_REFERENCE', handleId: null, referenceIndex: 0 });
  });

  it('8. a grounded direct quotation shifts the local أنا to the quoted Ahmed', () => {
    const ok = valid(QUOTED, proposal({
      references: [resolvedTo('أحمد', H_AHMED_TEAM), resolvedTo('أنا', H_AHMED_TEAM)],
      claimAttributions: [{ anchor: { text: 'أنا مش رايح', occurrence: 1 }, claimant: { kind: 'REFERENCE_HANDLE', handleId: H_AHMED_TEAM, referenceIndex: null }, frame: 'DIRECT_QUOTATION' }],
    }));
    expect(ok.references[1]).toMatchObject({ anchor: { text: 'أنا', occurrence: 1 }, resolvedHandleId: H_AHMED_TEAM });
    expect(ok.claimAttributions[0].frame).toBe('DIRECT_QUOTATION');
  });

  it('9. an ambiguous quotation source stays UNRESOLVED, and a half-asserted claimant is refused', () => {
    const text = 'قالّي: أنا مش رايح.';
    const ok = valid(text, proposal({
      references: [unresolved('أنا')],
      claimAttributions: [{ anchor: { text: 'أنا مش رايح', occurrence: 1 }, claimant: { kind: 'UNRESOLVED', handleId: null, referenceIndex: null }, frame: 'DIRECT_QUOTATION' }],
    }));
    expect(ok.claimAttributions[0].claimant).toEqual({ kind: 'UNRESOLVED', handleId: null, referenceIndex: null });
    const claim = (
      claimant: FocusResolutionProposal['claimAttributions'][number]['claimant'],
      references: FocusResolutionProposal['references'] = [unresolved('أنا')],
    ) =>
      rejection(text, proposal({ references, claimAttributions: [{ anchor: { text: 'أنا مش رايح', occurrence: 1 }, claimant, frame: 'DIRECT_QUOTATION' }] }));
    expect(claim({ kind: 'REFERENCE_HANDLE', handleId: null, referenceIndex: null })).toBe('INVALID_CLAIM_ATTRIBUTION@0');
    expect(claim({ kind: 'UNRESOLVED', handleId: H_AHMED_TEAM, referenceIndex: null })).toBe('INVALID_CLAIM_ATTRIBUTION@0');
    expect(claim({ kind: 'CURRENT_CONVERSATIONAL_SPEAKER', handleId: null, referenceIndex: 0 })).toBe('INVALID_CLAIM_ATTRIBUTION@0');
    // A NEW-reference claimant must point at a RESOLVED new reference of this CU.
    expect(claim({ kind: 'NEW_CURRENT_CU_REFERENCE', handleId: null, referenceIndex: 0 })).toBe('INVALID_CLAIM_ATTRIBUTION@0');
    expect(claim({ kind: 'NEW_CURRENT_CU_REFERENCE', handleId: null, referenceIndex: 7 })).toBe('INVALID_CLAIM_ATTRIBUTION@0');
    expect(claim({ kind: 'NEW_CURRENT_CU_REFERENCE', handleId: null, referenceIndex: 0 }, [resolvedTo('أنا', H_AHMED_TEAM)])).toBe('INVALID_CLAIM_ATTRIBUTION@0');
    expect(rejection(text, proposal({ claimAttributions: [{ anchor: { text: 'أنا مش رايح', occurrence: 1 }, claimant: { kind: 'UNRESOLVED', handleId: null, referenceIndex: null }, frame: 'HEARSAY' as never }] }))).toBe('INVALID_CLAIM_ATTRIBUTION@0');
    expect(rejection(text, proposal({ claimAttributions: [{ anchor: { text: 'أنا مش رايحة', occurrence: 1 }, claimant: { kind: 'UNRESOLVED', handleId: null, referenceIndex: null }, frame: 'DIRECT_QUOTATION' }] }))).toBe('NON_EXTRACTIVE_REFERENCE@0');
  });
});

describe('independent attention (fixtures 1-4, 10, 16, 19, 28, 29)', () => {
  it('1. an incidental resolved mention carries no independent focus (THR-01)', () => {
    const ok = valid('المدير زعّق لأحمد قدام الكل.', proposal({
      references: [resolvedTo('المدير', H_MANAGER), resolvedTo('أحمد', H_AHMED_TEAM)],
      attention: attend(F_MANAGER),
    }));
    expect(ok.references[1].resolvedHandleId).toBe(H_AHMED_TEAM);
    expect(ok.attention).toEqual({ kind: 'ATTEND_EXISTING_FOCUS', existingFocusCandidateId: F_MANAGER, grounding: null, reason: 'SUBSTANTIVE_ELABORATION' });
    // NO_INDEPENDENT_FOCUS carries neither a focus id nor grounding.
    expect(rejection('المدير زعّق لأحمد قدام الكل.', proposal({ attention: { ...BASE.attention, existingFocusCandidateId: F_MANAGER } }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
    expect(rejection('المدير زعّق لأحمد قدام الكل.', proposal({ attention: { ...BASE.attention, groundingAnchor: { text: 'أحمد', occurrence: 1 } } }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
  });

  it('2. a direct Ahmed concern may START a new focus grounded on the RESOLVED reference', () => {
    const ok = valid('أحمد نفسه بدأ يقلقني أكتر من المدير.', proposal({
      references: [resolvedTo('أحمد', H_AHMED_TEAM), resolvedTo('المدير', H_MANAGER)],
      attention: startNew('أحمد'),
    }));
    expect(ok.attention).toEqual({ kind: 'START_NEW_FOCUS', existingFocusCandidateId: null, grounding: { anchor: { text: 'أحمد', occurrence: 1 }, span: { start: 0, end: 4 } }, reason: 'DIRECT_SUBJECT' });
  });

  it('3. a RESOLVED pronoun continues the Ahmed focus; an ambiguous one cannot (4)', () => {
    const text = 'هو بقاله أسبوع بيتجنبني.';
    const ctx: PriorContext = { ...AHMED_FOCUSED, currentFocusCandidateId: F_AHMED };
    expect(valid(text, proposal({ references: [resolvedTo('هو', H_AHMED_TEAM)], attention: attend(F_AHMED) }), ctx).attention.existingFocusCandidateId).toBe(F_AHMED);
    // Identity-specific continuity through a resolved pronoun works even when
    // the Ahmed focus is NOT the current one.
    expect(valid(text, proposal({ references: [resolvedTo('هو', H_AHMED_TEAM)], attention: attend(F_AHMED) }), AHMED_FOCUSED).attention.existingFocusCandidateId).toBe(F_AHMED);
    // 4. AMBIGUOUS {Ahmed, Khaled}: neither Ahmed-specific nor Khaled-specific
    //    continuity, whether or not that focus is current.
    const amb = [ambiguous('هو', [H_AHMED_TEAM, H_KHALED])];
    expect(rejection(text, proposal({ references: amb, attention: attend(F_AHMED) }), ctx)).toBe('UNGROUNDED_FOCUS_CONTINUITY@-1');
    expect(rejection(text, proposal({ references: amb, attention: attend(F_AHMED) }), AHMED_FOCUSED)).toBe('UNGROUNDED_FOCUS_CONTINUITY@-1');
    expect(rejection(text, proposal({ references: amb, attention: attend(F_MANAGER) }))).toBe('UNGROUNDED_FOCUS_CONTINUITY@-1');
    // 5. UNRESOLVED cannot be promoted by convenience either.
    expect(rejection(text, proposal({ references: [unresolved('هو')], attention: attend(F_AHMED) }), ctx)).toBe('UNGROUNDED_FOCUS_CONTINUITY@-1');
    // What IS legitimate: the truthful "no identity-specific continuity".
    expect(valid(text, proposal({ references: amb, attention: { ...BASE.attention, reason: 'UNRESOLVED_ATTENTION' } }), ctx).attention.kind).toBe('NO_INDEPENDENT_FOCUS');
  });

  it('10. repeated Ahmed inside Khaled\'s quotation stays incidental: frequency is not attention', () => {
    const text = 'خالد قالّي: أحمد زعلان، وأحمد مش عايز يتكلم، وأحمد هيسيب الفريق.';
    const ok = valid(text, proposal({
      references: [resolvedTo('خالد', H_KHALED), resolvedTo('أحمد', H_AHMED_TEAM, 1), resolvedTo('أحمد', H_AHMED_TEAM, 2), resolvedTo('أحمد', H_AHMED_TEAM, 3)],
      claimAttributions: [{ anchor: { text: 'أحمد زعلان، وأحمد مش عايز يتكلم، وأحمد هيسيب الفريق', occurrence: 1 }, claimant: { kind: 'REFERENCE_HANDLE', handleId: H_KHALED, referenceIndex: null }, frame: 'DIRECT_QUOTATION' }],
    }));
    expect(ok.references.filter((r) => r.resolvedHandleId === H_AHMED_TEAM)).toHaveLength(3);
    expect(ok.attention.kind).toBe('NO_INDEPENDENT_FOCUS');
    const starts = ok.references.slice(1).map((r) => r.span.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(new Set(starts).size).toBe(3);
  });

  it('16. a local temporal clarification stays anchored to the current focus and starts no Time focus', () => {
    const ctx: PriorContext = {
      ...HISTORY,
      priorCus: [...HISTORY.priorCus, { cuId: 'cu-h6', sourceTurnId: 'turn-2b', sourceRole: 'ASSISTANT', committedText: 'ده حصل إمتى؟', ordinalWithinTurn: 1, functions: ['ASK'], sequencePosition: 'RESPONSIVE', targetCuId: 'cu-h4' }],
    };
    const ok = valid('الثلاث اللي فات.', proposal({
      functions: ['CLARIFY'],
      sequencePosition: 'RESPONSIVE',
      targetCuId: 'cu-h6',
      references: [newRef('الثلاث اللي فات')],
      attention: attend(F_MANAGER, 'LOCAL_CLARIFICATION_OR_CORRECTION'),
    }), ctx);
    expect(ok.attention.existingFocusCandidateId).toBe(F_MANAGER);
    // A RESOLVED new reference is not promoted to a focus by the validator: the
    // attention value is exactly what was proposed and grounded (THR-01).
    expect(ok.attention.kind).toBe('ATTEND_EXISTING_FOCUS');
    expect(valid('الثلاث اللي فات.', proposal({ references: [newRef('الثلاث اللي فات')] }), ctx).attention.kind).toBe('NO_INDEPENDENT_FOCUS');
  });

  it('19. a provider-invented focus id is refused; START_NEW_FOCUS authors no id', () => {
    const text = 'أحمد نفسه بدأ يقلقني أكتر من المدير.';
    const refs = [resolvedTo('أحمد', H_AHMED_TEAM)];
    expect(rejection(text, proposal({ references: refs, attention: attend('f-invented') }))).toBe('UNKNOWN_FOCUS_CANDIDATE@-1');
    expect(rejection(text, proposal({ references: refs, attention: { ...attend(F_MANAGER), existingFocusCandidateId: null } }))).toBe('UNKNOWN_FOCUS_CANDIDATE@-1');
    expect(rejection(text, proposal({ references: refs, attention: { ...startNew('أحمد'), existingFocusCandidateId: 'f-new-ahmed' } }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
    expect(rejection(text, proposal({ references: refs, attention: { ...startNew('أحمد'), reason: 'INCIDENTAL_OR_SUBORDINATE' } }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
    expect(rejection(text, proposal({ references: refs, attention: { ...attend(F_MANAGER), reason: 'UNRESOLVED_ATTENTION' } }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
  });

  it('28. relationship reframing is a NEW focus grounded on a new current-CU reference, not forced reuse of the person focus', () => {
    const text = 'علاقتي بأحمد بقت مرهقة.';
    const ok = valid(text, proposal({
      references: [resolvedTo('أحمد', H_AHMED_TEAM), newRef('علاقتي بأحمد')],
      attention: startNew('علاقتي بأحمد'),
    }));
    expect(ok.attention.kind).toBe('START_NEW_FOCUS');
    expect(ok.attention.grounding).toEqual({ anchor: { text: 'علاقتي بأحمد', occurrence: 1 }, span: { start: 0, end: 12 } });
    // The person reference inside it still resolves to the existing handle.
    expect(ok.references[0].resolvedHandleId).toBe(H_AHMED_TEAM);
  });

  it('29. an analytical object alone cannot ground a new focus (THR-02)', () => {
    const text = 'أحمد نفسه بدأ يقلقني أكتر من المدير.';
    // No grounding at all.
    expect(rejection(text, proposal({ references: [resolvedTo('أحمد', H_AHMED_TEAM)], attention: { ...startNew('أحمد'), groundingAnchor: null } }))).toBe('FOCUS_GROUNDING_REQUIRED@-1');
    // Grounding that is extractive but is not a reference this CU resolved.
    expect(rejection(text, proposal({ references: [], attention: startNew('أحمد') }))).toBe('FOCUS_GROUNDING_REQUIRED@-1');
    expect(rejection(text, proposal({ references: [resolvedTo('المدير', H_MANAGER)], attention: startNew('يقلقني') }))).toBe('FOCUS_GROUNDING_REQUIRED@-1');
    // Grounding on an AMBIGUOUS or UNRESOLVED mention (CU-16).
    expect(rejection(text, proposal({ references: [ambiguous('أحمد', [H_AHMED_TEAM, H_AHMED_COUSIN])], attention: startNew('أحمد') }))).toBe('FOCUS_GROUNDING_REQUIRED@-1');
    expect(rejection(text, proposal({ references: [unresolved('أحمد')], attention: startNew('أحمد') }))).toBe('FOCUS_GROUNDING_REQUIRED@-1');
    // An analytical label is not in the source at all.
    expect(rejection(text, proposal({ references: [resolvedTo('أحمد', H_AHMED_TEAM)], attention: startNew('Ahmed avoidance pattern') }))).toBe('NON_EXTRACTIVE_REFERENCE@-1');
    // A different occurrence of the same surface is a different region.
    expect(rejection('أحمد قال إن أحمد التاني هيجي.', proposal({ references: [resolvedTo('أحمد', H_AHMED_TEAM, 1)], attention: startNew('أحمد', 'DIRECT_SUBJECT', 2) }))).toBe('FOCUS_GROUNDING_REQUIRED@-1');
  });

  it('identity-free local continuation needs a reference-clean CU and the CURRENT focus', () => {
    const text = 'أيوه، بالظبط كده.';
    expect(valid(text, proposal({ functions: ['AGREE'], attention: attend(F_MANAGER, 'LOCAL_CLARIFICATION_OR_CORRECTION') })).attention.existingFocusCandidateId).toBe(F_MANAGER);
    // Not the current focus and no resolved link: ungrounded.
    expect(rejection(text, proposal({ functions: ['AGREE'], attention: attend(F_AHMED) }), AHMED_FOCUSED)).toBe('UNGROUNDED_FOCUS_CONTINUITY@-1');
    // No current focus at all: nothing to continue locally.
    expect(rejection(text, proposal({ functions: ['AGREE'], attention: attend(F_MANAGER) }), { ...HISTORY, currentFocusCandidateId: null })).toBe('UNGROUNDED_FOCUS_CONTINUITY@-1');
  });

  it('FIX-T03B1A-02: an identity already represented by a focus candidate is attended, never minted twice', () => {
    const text = 'أحمد نفسه بدأ يقلقني أكتر من المدير.';
    const refs = [resolvedTo('أحمد', H_AHMED_TEAM), resolvedTo('المدير', H_MANAGER)];
    // 1. H_AHMED_TEAM + F_AHMED + direct Ahmed CU + START_NEW_FOCUS -> reject.
    expect(rejection(text, proposal({ references: refs, attention: startNew('أحمد') }), AHMED_FOCUSED)).toBe('EXISTING_FOCUS_CONTINUITY_REQUIRED@-1');
    expect(rejection(text, proposal({ references: refs, attention: startNew('أحمد', 'EXPLICIT_FOCUS_SHIFT') }), { ...AHMED_FOCUSED, currentFocusCandidateId: null })).toBe('EXISTING_FOCUS_CONTINUITY_REQUIRED@-1');
    // 2. The same CU attending F_AHMED -> accept (the resolved link grounds it).
    expect(valid(text, proposal({ references: refs, attention: attend(F_AHMED, 'DIRECT_SUBJECT') }), AHMED_FOCUSED).attention.existingFocusCandidateId).toBe(F_AHMED);
    // 3. H_AHMED_TEAM exists only as a Mention (no focus candidate) -> START_NEW_FOCUS accepts.
    expect(valid(text, proposal({ references: refs, attention: startNew('أحمد') })).attention.kind).toBe('START_NEW_FOCUS');
    // The manager, already represented by F_MANAGER, cannot be re-minted either.
    expect(rejection(text, proposal({ references: refs, attention: startNew('المدير') }))).toBe('EXISTING_FOCUS_CONTINUITY_REQUIRED@-1');
    // 4. A NEW current-CU reference (the relationship) is independently
    //    addressable and may still start its own focus beside F_AHMED.
    const reframed = valid('علاقتي بأحمد بقت مرهقة.', proposal({
      references: [resolvedTo('أحمد', H_AHMED_TEAM), newRef('علاقتي بأحمد')],
      attention: startNew('علاقتي بأحمد'),
    }), AHMED_FOCUSED);
    expect(reframed.attention.kind).toBe('START_NEW_FOCUS');
    // Not every reference handle is a focus: the rule looks at focus grounding, not at handle existence.
    expect(valid('خالد كمان بقى يقلقني.', proposal({ references: [resolvedTo('خالد', H_KHALED)], attention: startNew('خالد') }), AHMED_FOCUSED).attention.kind).toBe('START_NEW_FOCUS');
  });

  it('FIX-T03B1A-03: an omitted subject is anchored by the exact surface that carries it (CU-12)', () => {
    // Egyptian Arabic drops the subject: the inflected verb بيتجنبني carries
    // the recoverable third-person reference. No word is synthesized.
    const text = 'بيتجنبني من ساعة الاجتماع.';
    const ok = valid(text, proposal({ references: [resolvedTo('بيتجنبني', H_AHMED_TEAM)], attention: attend(F_AHMED) }), AHMED_FOCUSED);
    expect(ok.references[0]).toMatchObject({ anchor: { text: 'بيتجنبني', occurrence: 1 }, span: { start: 0, end: 8 }, resolvedHandleId: H_AHMED_TEAM });
    for (const reference of ok.references) expect(text.includes(reference.anchor.text)).toBe(true);
    // A synthesized subject (هو / أحمد) is not in the committed CU: it has no location.
    expect(rejection(text, proposal({ references: [resolvedTo('هو', H_AHMED_TEAM)] }), AHMED_FOCUSED)).toBe('NON_EXTRACTIVE_REFERENCE@0');
    expect(rejection(text, proposal({ references: [resolvedTo('أحمد', H_AHMED_TEAM)] }), AHMED_FOCUSED)).toBe('NON_EXTRACTIVE_REFERENCE@0');
    expect(rejection(text, proposal({ references: [resolvedTo('هو بيتجنبني', H_AHMED_TEAM)] }), AHMED_FOCUSED)).toBe('NON_EXTRACTIVE_REFERENCE@0');
    // Non-recoverable: the same surface AMBIGUOUS between Ahmed and Khaled asserts no continuity.
    expect(rejection(text, proposal({ references: [ambiguous('بيتجنبني', [H_AHMED_TEAM, H_KHALED])], attention: attend(F_AHMED) }), AHMED_FOCUSED)).toBe('UNGROUNDED_FOCUS_CONTINUITY@-1');
    expect(valid(text, proposal({ references: [ambiguous('بيتجنبني', [H_AHMED_TEAM, H_KHALED])], attention: { ...BASE.attention, reason: 'UNRESOLVED_ATTENTION' } }), AHMED_FOCUSED).attention.kind).toBe('NO_INDEPENDENT_FOCUS');
  });

  it('the proposal shape itself is checked, not trusted', () => {
    expect(rejection('أهلاً.', null as never)).toBe('INVALID_PROVIDER_PAYLOAD@-1');
    expect(rejection('أهلاً.', proposal({ references: 'none' as never }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
    expect(rejection('أهلاً.', proposal({ references: [null as never] }))).toBe('INVALID_PROVIDER_PAYLOAD@0');
    expect(rejection('أهلاً.', proposal({ attention: { ...BASE.attention, kind: 'MAYBE_FOCUS' as never } }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
    expect(rejection('أهلاً.', proposal({ attention: { ...BASE.attention, reason: 'SCORE_0_9' as never } }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
    expect(rejection('أهلاً.', proposal({ targetCuId: 42 as never }))).toBe('INVALID_PROVIDER_PAYLOAD@-1');
  });
});
