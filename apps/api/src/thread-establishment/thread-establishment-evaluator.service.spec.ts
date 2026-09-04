import type { AttentionKind, AttentionReason, ClaimFrame, CurrentCuInput, PriorCuContext } from '../conversational-focus/conversational-focus.types';
import type { CanonicalAttention, CanonicalClaimAttribution, CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import { FakeThreadEstablishmentProvider } from './fake-thread-establishment.provider';
import { ThreadEstablishmentEvaluatorService, type SequencedCuFocusSemantics } from './thread-establishment-evaluator.service';
import { THREAD_ESTABLISHMENT_PROMPT_VERSION } from './thread-establishment-provider.config';
import { THREAD_ESTABLISHMENT_SCHEMA_VERSION, type ThreadEstablishmentProposal } from './thread-establishment-provider.types';
import {
  THREAD_ESTABLISHMENT_EVALUATOR_VERSION,
  THREAD_ESTABLISHMENT_POLICY_VERSION,
  ThreadEstablishmentRejectedError,
  type FocusAttentionHistoryEntry,
  type ThreadEstablishmentEvaluationInput,
  type ThreadEstablishmentPriorContext,
} from './thread-establishment.types';

// Stable Emerging Focus identities as T-03B1b1 canonicalizes them (RFC 4122 v5 shape).
const F_AHMED = '3f2a9c1e-7b4d-5a6e-8c9f-0a1b2c3d4e5f';
const F_MANAGER = '9b8c7d6e-5f4a-5b3c-9d2e-1f0a9b8c7d6e';
const F_RELATION = '0c1d2e3f-4a5b-5c6d-ae7f-8091a2b3c4d5';
const H_KHALED = '7a6b5c4d-3e2f-5a1b-9c8d-7e6f5a4b3c2d';

/** Code-point span of the n-th occurrence of `excerpt` in `text` (test aid; the production mapper is the T-03A1 one). */
function spanOf(text: string, excerpt: string, occurrence = 1): { start: number; end: number } {
  const hay = Array.from(text);
  const needle = Array.from(excerpt);
  let found = 0;
  for (let start = 0; start + needle.length <= hay.length; start += 1) {
    if (needle.every((cp, offset) => hay[start + offset] === cp)) {
      found += 1;
      if (found === occurrence) return { start, end: start + needle.length };
    }
  }
  throw new Error(`excerpt not found: ${excerpt}`);
}

const cu = (cuId: string, committedText: string, sourceTurnId = 'turn-9', ordinalWithinTurn = 1, sourceRole: 'USER' | 'ASSISTANT' = 'USER'): CurrentCuInput => ({
  cuId,
  sourceTurnId,
  sourceRole,
  committedText,
  ordinalWithinTurn,
});
const prior = (
  cuId: string,
  sourceTurnId: string,
  sourceRole: 'USER' | 'ASSISTANT',
  committedText: string,
  ordinalWithinTurn: number,
  functions: PriorCuContext['functions'] = null,
  sequencePosition: PriorCuContext['sequencePosition'] = null,
  targetCuId: string | null = null,
): PriorCuContext => ({ cuId, sourceTurnId, sourceRole, committedText, ordinalWithinTurn, functions, sequencePosition, targetCuId });
const attended = (cuId: string, attentionKind: AttentionKind, attentionReason: AttentionReason, emergingFocusId: string | null): FocusAttentionHistoryEntry => ({
  cuId,
  attentionKind,
  attentionReason,
  emergingFocusId,
});

const START = (id: string, reason: AttentionReason = 'DIRECT_SUBJECT'): Partial<CanonicalAttention> => ({
  kind: 'START_NEW_FOCUS',
  reason,
  emerging_focus_id: id,
  creates_focus: true,
  grounding_reference_index: 0,
});
const ATTEND = (id: string, reason: AttentionReason = 'SUBSTANTIVE_ELABORATION'): Partial<CanonicalAttention> => ({
  kind: 'ATTEND_EXISTING_FOCUS',
  reason,
  emerging_focus_id: id,
  creates_focus: false,
  grounding_reference_index: null,
});
const NONE = (reason: AttentionReason = 'INCIDENTAL_OR_SUBORDINATE'): Partial<CanonicalAttention> => ({
  kind: 'NO_INDEPENDENT_FOCUS',
  reason,
  emerging_focus_id: null,
  creates_focus: false,
  grounding_reference_index: null,
});
const semantics = (
  cuId: string,
  attention: Partial<CanonicalAttention> = {},
  claim_attributions: readonly CanonicalClaimAttribution[] = [],
): CanonicalCuFocusSemanticPayload => ({
  unit_id: cuId,
  functions: ['INFORM_REPORT'],
  sequence_position: 'UNMARKED',
  target_cu_id: null,
  references: [],
  claim_attributions,
  attention: { kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null, ...attention },
});
const claim = (text: string, excerpt: string, claim_frame: ClaimFrame, attribution_index = 0): CanonicalClaimAttribution => {
  const span = spanOf(text, excerpt);
  return {
    attribution_index,
    anchor_text: excerpt,
    anchor_occurrence: 1,
    span_start: span.start,
    span_end: span.end,
    claimant_kind: 'REFERENCE_HANDLE',
    claimant_handle_id: H_KHALED,
    claim_frame,
  };
};

/** The shared prior world: a Manager focus exists; Ahmed is a resolved Mention only (THR-01). */
const HISTORY: ThreadEstablishmentPriorContext = {
  priorCus: [
    prior('cu-h1', 'turn-0', 'USER', 'المدير بقى بيتعامل معايا بشكل غريب من أول الشهر.', 1, ['INFORM_REPORT'], 'INITIATING', null),
    prior('cu-h2', 'turn-0', 'USER', 'وأحمد اللي في الفريق قالّي إن الموضوع ده عادي.', 2, ['INFORM_REPORT'], 'FOLLOW_UP', 'cu-h1'),
    prior('cu-h3', 'turn-1', 'ASSISTANT', 'تقصد إن المدير اتغير معاك فجأة؟', 1, ['ASK'], 'RESPONSIVE', 'cu-h1'),
    prior('cu-h4', 'turn-2', 'USER', 'خالد كمان لاحظ نفس الحاجة.', 1),
  ],
  focusAttentionHistory: [
    attended('cu-h1', 'START_NEW_FOCUS', 'DIRECT_SUBJECT', F_MANAGER),
    attended('cu-h2', 'NO_INDEPENDENT_FOCUS', 'INCIDENTAL_OR_SUBORDINATE', null),
    attended('cu-h3', 'ATTEND_EXISTING_FOCUS', 'DIRECT_REQUEST_OR_QUESTION', F_MANAGER),
    attended('cu-h4', 'NO_INDEPENDENT_FOCUS', 'INCIDENTAL_OR_SUBORDINATE', null),
  ],
  establishedFocusIds: [],
};
const extend = (base: ThreadEstablishmentPriorContext, cus: readonly [PriorCuContext, FocusAttentionHistoryEntry][], establishedFocusIds = base.establishedFocusIds): ThreadEstablishmentPriorContext => ({
  priorCus: [...base.priorCus, ...cus.map(([c]) => c)],
  focusAttentionHistory: [...base.focusAttentionHistory, ...cus.map(([, h]) => h)],
  establishedFocusIds,
});

/** QANDEEL asked about Ahmed, the user answered substantively, and the answer continues (fixture 8). */
const ENGAGED = extend(HISTORY, [
  [prior('cu-e1', 'turn-3', 'ASSISTANT', 'وأحمد؟ حاسس إن الموضوع معاه مختلف؟', 1, ['ASK'], 'INITIATING', null), attended('cu-e1', 'START_NEW_FOCUS', 'DIRECT_REQUEST_OR_QUESTION', F_AHMED)],
  [prior('cu-e2', 'turn-4', 'USER', 'أحمد فعلاً مختلف، بقى بيتجنبني من ساعة الاجتماع اللي فات.', 1, ['INFORM_REPORT'], 'RESPONSIVE', 'cu-e1'), attended('cu-e2', 'ATTEND_EXISTING_FOCUS', 'SUBSTANTIVE_ELABORATION', F_AHMED)],
]);
/** Ahmed attended, then the conversation demonstrably moved to the Manager (fixtures 13/14). */
const RECURRENCE = extend(HISTORY, [
  [prior('cu-r1', 'turn-3', 'USER', 'أحمد بقى بيتجنبني في الشغل.', 1), attended('cu-r1', 'START_NEW_FOCUS', 'DIRECT_SUBJECT', F_AHMED)],
  [prior('cu-r2', 'turn-4', 'ASSISTANT', 'ده بيأثر على شغلك؟', 1), attended('cu-r2', 'ATTEND_EXISTING_FOCUS', 'DIRECT_REQUEST_OR_QUESTION', F_AHMED)],
  [prior('cu-r3', 'turn-5', 'USER', 'المهم، المدير طلب مني أقدم التقرير بكرة.', 1), attended('cu-r3', 'ATTEND_EXISTING_FOCUS', 'EXPLICIT_FOCUS_SHIFT', F_MANAGER)],
  [prior('cu-r4', 'turn-6', 'ASSISTANT', 'التقرير ده مرتبط بالتغيير اللي حصل مع المدير؟', 1), attended('cu-r4', 'ATTEND_EXISTING_FOCUS', 'DIRECT_REQUEST_OR_QUESTION', F_MANAGER)],
]);
/** Ahmed attended, QANDEEL asked a brief local clarification (fixture 16). */
const LOCAL = extend(HISTORY, [
  [prior('cu-l1', 'turn-3', 'USER', 'أحمد بقى بيتجنبني في الشغل.', 1), attended('cu-l1', 'START_NEW_FOCUS', 'DIRECT_SUBJECT', F_AHMED)],
  [prior('cu-l2', 'turn-4', 'ASSISTANT', 'ده حصل إمتى؟', 1), attended('cu-l2', 'NO_INDEPENDENT_FOCUS', 'LOCAL_CLARIFICATION_OR_CORRECTION', null)],
]);
/** Ahmed is already an established Thread (prior canonical truth), known here by focus-id membership only. */
const ESTABLISHED = extend(HISTORY, [
  [prior('cu-s1', 'turn-3', 'USER', 'عايز نتكلم عن أحمد تحديدًا.', 1), attended('cu-s1', 'START_NEW_FOCUS', 'EXPLICIT_FOCUS_SHIFT', F_AHMED)],
], [F_AHMED]);

const NO: ThreadEstablishmentProposal = { decision: 'NO_ESTABLISHMENT', path: null, evidenceCuIds: [], explicitSelectionAnchor: null };
const te01 = (cuId: string, text: string, occurrence = 1): ThreadEstablishmentProposal => ({ decision: 'ESTABLISH_THREAD', path: 'TE-01', evidenceCuIds: [cuId], explicitSelectionAnchor: { text, occurrence } });
const te02 = (evidenceCuIds: readonly string[]): ThreadEstablishmentProposal => ({ decision: 'ESTABLISH_THREAD', path: 'TE-02', evidenceCuIds, explicitSelectionAnchor: null });
const te03 = (evidenceCuIds: readonly string[]): ThreadEstablishmentProposal => ({ decision: 'ESTABLISH_THREAD', path: 'TE-03', evidenceCuIds, explicitSelectionAnchor: null });

const input = (currentCu: CurrentCuInput, currentFocusSemantics: CanonicalCuFocusSemanticPayload, priorContext: ThreadEstablishmentPriorContext = HISTORY): ThreadEstablishmentEvaluationInput => ({
  sessionId: 'session-1',
  currentCu,
  currentFocusSemantics,
  priorContext,
});
const service = (provider: FakeThreadEstablishmentProvider) => new ThreadEstablishmentEvaluatorService(provider, 'FAKE', 'fake-model');
const rejection = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ThreadEstablishmentRejectedError) return error.reason;
    throw error;
  }
  throw new Error('expected a rejection');
};
const step = (c: CurrentCuInput, focusSemantics: CanonicalCuFocusSemanticPayload): SequencedCuFocusSemantics => ({ cu: c, focusSemantics });

const SELECTION = 'عايز نتكلم عن أحمد تحديدًا';
const SELECTION_CU = cu('cu-sel', `${SELECTION}.`);

describe('core promotion (fixtures 1-16)', () => {
  it('1. a resolved incidental Ahmed mention establishes nothing, deterministically and without a provider', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(te01('cu-1', 'أحمد'));
    const result = await service(provider).evaluateOne(input(cu('cu-1', 'المدير زعّق لأحمد قدام الكل.'), semantics('cu-1', NONE())));
    expect(result).toMatchObject({ decision: 'NO_ESTABLISHMENT', path: null, noEstablishmentReason: 'NO_INDEPENDENT_FOCUS', emergingFocusId: null, evidenceCuIds: [], explicitSelectionGrounding: null });
    expect(provider.requests).toHaveLength(0);
  });

  it('2. one genuine independent-attention CU with no explicit selection and no sustained evidence yet: the provider truthfully says NO', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(NO);
    const result = await service(provider).evaluateOne(input(cu('cu-2', 'أحمد نفسه بدأ يقلقني أكتر من المدير.'), semantics('cu-2', START(F_AHMED))));
    expect(result).toMatchObject({ decision: 'NO_ESTABLISHMENT', noEstablishmentReason: 'NO_PROMOTION_PATH_PROVEN', emergingFocusId: F_AHMED, evidenceCuIds: [] });
    expect(provider.requests).toHaveLength(1);
  });

  it('3./4. USER «عايز نتكلم عن أحمد تحديدًا» with a stable focus establishes by TE-01, with zero prior repetition', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(te01('cu-sel', SELECTION));
    const result = await service(provider).evaluateOne(input(SELECTION_CU, semantics('cu-sel', START(F_AHMED, 'EXPLICIT_FOCUS_SHIFT'))));
    expect(result).toMatchObject({
      decision: 'ESTABLISH_THREAD',
      path: 'TE-01',
      noEstablishmentReason: null,
      emergingFocusId: F_AHMED,
      evidenceCuIds: ['cu-sel'],
      explicitSelectionGrounding: { anchor: { text: SELECTION, occurrence: 1 }, span: spanOf(SELECTION_CU.committedText, SELECTION) },
    });
    // No prior CU ever attended Ahmed: THR-08 needs no artificial repetition.
    expect(HISTORY.focusAttentionHistory.filter((entry) => entry.emergingFocusId === F_AHMED)).toEqual([]);
  });

  it('5. the same wording with the focus identity unavailable from B1 cannot establish, and a fabricated identity is refused', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(te01('cu-sel', SELECTION));
    // B1 could not defend attention (two Ahmeds): deterministic NO, zero provider.
    const result = await service(provider).evaluateOne(input(SELECTION_CU, semantics('cu-sel', NONE('UNRESOLVED_ATTENTION'))));
    expect(result).toMatchObject({ decision: 'NO_ESTABLISHMENT', noEstablishmentReason: 'NO_INDEPENDENT_FOCUS', emergingFocusId: null });
    expect(provider.requests).toHaveLength(0);
    // A focus-bearing attention without a stable identity is malformed input, never a decision.
    expect(await rejection(service(provider).evaluateOne(input(SELECTION_CU, semantics('cu-sel', { ...START(F_AHMED), emerging_focus_id: null }))))).toBe('INVALID_EVALUATION_INPUT');
    expect(await rejection(service(provider).evaluateOne(input(SELECTION_CU, semantics('cu-sel', { ...START(F_AHMED), emerging_focus_id: 'prepared:focus:cu-sel' }))))).toBe('INVALID_EVALUATION_INPUT');
    expect(provider.requests).toHaveLength(0);
  });

  it('6. the explicit-selection wording inside quoted or reported speech cannot satisfy TE-01 (THR-12)', async () => {
    const quoted = cu('cu-q', `خالد قالّي: ${SELECTION}.`);
    const quotedSemantics = semantics('cu-q', ATTEND(F_AHMED, 'DIRECT_SUBJECT'), [claim(quoted.committedText, SELECTION, 'DIRECT_QUOTATION')]);
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te01('cu-q', SELECTION))).evaluateOne(input(quoted, quotedSemantics)))).toBe('ATTRIBUTED_SELECTION_FORBIDDEN');
    const reported = cu('cu-rep', `خالد قال إنه ${SELECTION}.`);
    const reportedSemantics = semantics('cu-rep', ATTEND(F_AHMED, 'DIRECT_SUBJECT'), [claim(reported.committedText, `إنه ${SELECTION}`, 'REPORTED_SPEECH')]);
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te01('cu-rep', SELECTION))).evaluateOne(input(reported, reportedSemantics)))).toBe('ATTRIBUTED_SELECTION_FORBIDDEN');
  });

  it('7. ASSISTANT «خلينا نتكلم عن أحمد» cannot TE-01: QANDEEL never selects on the user\'s behalf', async () => {
    const assistant = cu('cu-as', 'خلينا نتكلم عن أحمد.', 'turn-9', 1, 'ASSISTANT');
    const provider = FakeThreadEstablishmentProvider.returning(te01('cu-as', 'خلينا نتكلم عن أحمد'));
    expect(await rejection(service(provider).evaluateOne(input(assistant, semantics('cu-as', START(F_AHMED, 'EXPLICIT_FOCUS_SHIFT')))))).toBe('EXPLICIT_SELECTION_ROLE_FORBIDDEN');
  });

  it('8. QANDEEL asks about Ahmed, the user answers substantively and continues substantively: TE-02 may establish', async () => {
    const current = cu('cu-e3', 'وكل ما أحاول أفتح معاه الموضوع يقولي مشغول.', 'turn-4', 2);
    const provider = FakeThreadEstablishmentProvider.returning(te02(['cu-e3', 'cu-e1', 'cu-e2']));
    const result = await service(provider).evaluateOne(input(current, semantics('cu-e3', ATTEND(F_AHMED)), ENGAGED));
    expect(result).toMatchObject({ decision: 'ESTABLISH_THREAD', path: 'TE-02', emergingFocusId: F_AHMED, explicitSelectionGrounding: null });
    // Canonical evidence order: prior same-focus CUs in committed order, then the current CU.
    expect(result.evidenceCuIds).toEqual(['cu-e1', 'cu-e2', 'cu-e3']);
  });

  it('9. repeated QANDEEL questions with user non-engagement establish nothing, and QANDEEL-only evidence is refused (THR-06/13)', async () => {
    const ctx = extend(HISTORY, [
      [prior('cu-q1', 'turn-3', 'ASSISTANT', 'وأحمد؟ بينك وبينه حاجة؟', 1), attended('cu-q1', 'START_NEW_FOCUS', 'DIRECT_REQUEST_OR_QUESTION', F_AHMED)],
      [prior('cu-q2', 'turn-4', 'USER', 'مش عارف.', 1), attended('cu-q2', 'NO_INDEPENDENT_FOCUS', 'INCIDENTAL_OR_SUBORDINATE', null)],
      [prior('cu-q3', 'turn-5', 'ASSISTANT', 'تحب نتكلم عن أحمد؟', 1), attended('cu-q3', 'ATTEND_EXISTING_FOCUS', 'DIRECT_REQUEST_OR_QUESTION', F_AHMED)],
      [prior('cu-q4', 'turn-6', 'USER', 'لا مش دلوقتي.', 1), attended('cu-q4', 'NO_INDEPENDENT_FOCUS', 'INCIDENTAL_OR_SUBORDINATE', null)],
    ]);
    const current = cu('cu-q5', 'طيب، لو حبيت نرجع لأحمد قولّي.', 'turn-7', 1, 'ASSISTANT');
    const truthful = await service(FakeThreadEstablishmentProvider.returning(NO)).evaluateOne(input(current, semantics('cu-q5', ATTEND(F_AHMED, 'DIRECT_REQUEST_OR_QUESTION')), ctx));
    expect(truthful.noEstablishmentReason).toBe('NO_PROMOTION_PATH_PROVEN');
    const adversarial = FakeThreadEstablishmentProvider.returning(te02(['cu-q1', 'cu-q3', 'cu-q5']));
    expect(await rejection(service(adversarial).evaluateOne(input(current, semantics('cu-q5', ATTEND(F_AHMED, 'DIRECT_REQUEST_OR_QUESTION')), ctx)))).toBe('USER_EVIDENCE_REQUIRED');
    // The user's non-engaging replies are not Ahmed evidence either.
    const padded = FakeThreadEstablishmentProvider.returning(te02(['cu-q1', 'cu-q2', 'cu-q5']));
    expect(await rejection(service(padded).evaluateOne(input(current, semantics('cu-q5', ATTEND(F_AHMED, 'DIRECT_REQUEST_OR_QUESTION')), ctx)))).toBe('EVIDENCE_NOT_FOCUS_BOUND');
  });

  it('10. multiple substantive same-focus USER CUs establish by TE-02', async () => {
    const ctx = extend(HISTORY, [
      [prior('cu-m1', 'turn-3', 'USER', 'أحمد بقى بيتجنبني في الشغل.', 1), attended('cu-m1', 'START_NEW_FOCUS', 'DIRECT_SUBJECT', F_AHMED)],
      [prior('cu-m2', 'turn-3', 'USER', 'وامبارح سابني في الاجتماع من غير كلمة.', 2), attended('cu-m2', 'ATTEND_EXISTING_FOCUS', 'SUBSTANTIVE_ELABORATION', F_AHMED)],
    ]);
    const current = cu('cu-m3', 'حاسس إنه بيتعامل معايا كأني مش موجود.', 'turn-3', 3);
    const result = await service(FakeThreadEstablishmentProvider.returning(te02(['cu-m1', 'cu-m2', 'cu-m3']))).evaluateOne(input(current, semantics('cu-m3', ATTEND(F_AHMED)), ctx));
    expect(result).toMatchObject({ decision: 'ESTABLISH_THREAD', path: 'TE-02', evidenceCuIds: ['cu-m1', 'cu-m2', 'cu-m3'] });
  });

  it('11./23. repeated incidental mentions across many CUs never establish: count is not a channel', async () => {
    const mentions: [PriorCuContext, FocusAttentionHistoryEntry][] = Array.from({ length: 12 }, (_, i) => [
      prior(`cu-i${i}`, `turn-i${i}`, 'USER', `المدير قال لأحمد يخلص الشغل بسرعة (${i}).`, 1),
      attended(`cu-i${i}`, 'NO_INDEPENDENT_FOCUS', 'INCIDENTAL_OR_SUBORDINATE', null),
    ]);
    const ctx = extend(HISTORY, mentions);
    const provider = FakeThreadEstablishmentProvider.returning(te02([...mentions.map(([c]) => c.cuId), 'cu-i99']));
    // B1 still finds the current mention incidental: deterministic NO, zero provider, however many times the name appeared.
    const result = await service(provider).evaluateOne(input(cu('cu-i99', 'وأحمد طلع الأول.'), semantics('cu-i99', NONE()), ctx));
    expect(result.noEstablishmentReason).toBe('NO_INDEPENDENT_FOCUS');
    expect(provider.requests).toHaveLength(0);
    // Even with a focus-bearing current CU, incidental prior mentions are not focus evidence.
    expect(await rejection(service(provider).evaluateOne(input(cu('cu-i99', 'أحمد نفسه بقى الموضوع.'), semantics('cu-i99', START(F_AHMED)), ctx)))).toBe('EVIDENCE_NOT_FOCUS_BOUND');
  });

  it('12. duration alone changes nothing: no clock exists in the input, the request or the result', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(NO);
    const evaluation = input(cu('cu-d', 'أحمد نفسه بدأ يقلقني.'), semantics('cu-d', START(F_AHMED)));
    const first = await service(provider).evaluateOne(evaluation);
    const second = await service(provider).evaluateOne(evaluation);
    expect(second).toEqual(first);
    for (const payload of [JSON.stringify(provider.requests[0]), JSON.stringify(first)]) {
      expect(payload).not.toMatch(/timestamp|createdAt|elapsed|duration|\d{4}-\d{2}-\d{2}T|sessionPosition|session_position/u);
    }
    expect(Object.keys(provider.requests[0]).sort()).toEqual(['currentCu', 'currentFocusSemantics', 'focusAttentionHistory', 'priorCus', 'schemaVersion']);
  });

  it('13. old focus evidence + intervening committed material + independent return establishes by TE-03', async () => {
    const current = cu('cu-r5', 'وبالنسبة لأحمد، أنا قررت أواجهه.', 'turn-7', 1);
    const result = await service(FakeThreadEstablishmentProvider.returning(te03(['cu-r1', 'cu-r2', 'cu-r5']))).evaluateOne(input(current, semantics('cu-r5', ATTEND(F_AHMED, 'DIRECT_SUBJECT')), RECURRENCE));
    expect(result).toMatchObject({ decision: 'ESTABLISH_THREAD', path: 'TE-03', emergingFocusId: F_AHMED, evidenceCuIds: ['cu-r1', 'cu-r2', 'cu-r5'], explicitSelectionGrounding: null });
    // FIX-T03B2A-02: the LATEST prior Ahmed CU (QANDEEL's question cu-r2) is the
    // return boundary and must be cited; omitting it hides where attention last lay.
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-r1', 'cu-r5']))).evaluateOne(input(current, semantics('cu-r5', ATTEND(F_AHMED, 'DIRECT_SUBJECT')), RECURRENCE)))).toBe('RECURRENCE_NOT_PROVEN');
  });

  it('14. recurrence through a resolved pronoun with no repeated name (THR-10)', async () => {
    const current = cu('cu-r6', 'هو رجع يتجنبني تاني من الصبح.', 'turn-7', 1);
    expect(current.committedText).not.toContain('أحمد');
    const result = await service(FakeThreadEstablishmentProvider.returning(te03(['cu-r2', 'cu-r6']))).evaluateOne(input(current, semantics('cu-r6', ATTEND(F_AHMED, 'DIRECT_SUBJECT')), RECURRENCE));
    expect(result).toMatchObject({ decision: 'ESTABLISH_THREAD', path: 'TE-03', evidenceCuIds: ['cu-r2', 'cu-r6'] });
  });

  it('15. ambiguous or unresolved identity is never upgraded by lexical convenience (THR-11)', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(te03(['cu-r1', 'cu-r7']));
    const current = cu('cu-r7', 'أحمد رجع يتجنبني.', 'turn-7', 1);
    // The name is present, but B1 could not resolve which Ahmed: no target, zero provider.
    const result = await service(provider).evaluateOne(input(current, semantics('cu-r7', NONE('UNRESOLVED_ATTENTION')), RECURRENCE));
    expect(result).toMatchObject({ decision: 'NO_ESTABLISHMENT', noEstablishmentReason: 'NO_INDEPENDENT_FOCUS', emergingFocusId: null });
    expect(provider.requests).toHaveLength(0);
  });

  it('16. a brief local clarification does not become recurrence', async () => {
    const answer = cu('cu-l3', 'من الأسبوع اللي فات.', 'turn-5', 1);
    // The current CU is itself a local clarification of the pending question.
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-l1', 'cu-l3']))).evaluateOne(input(answer, semantics('cu-l3', ATTEND(F_AHMED, 'LOCAL_CLARIFICATION_OR_CORRECTION')), LOCAL)))).toBe('RECURRENCE_NOT_PROVEN');
    // The only "intervening" CU is QANDEEL's local clarification: attention never left Ahmed.
    const elaboration = cu('cu-l4', 'من الأسبوع اللي فات، وأحمد كمان بطل يرد على رسايلي.', 'turn-5', 1);
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-l1', 'cu-l4']))).evaluateOne(input(elaboration, semantics('cu-l4', ATTEND(F_AHMED)), LOCAL)))).toBe('RECURRENCE_NOT_PROVEN');
    // Nor does a same-focus QANDEEL question count as departure.
    const continuity = extend(HISTORY, [
      [prior('cu-c1', 'turn-3', 'USER', 'أحمد بقى بيتجنبني في الشغل.', 1), attended('cu-c1', 'START_NEW_FOCUS', 'DIRECT_SUBJECT', F_AHMED)],
      [prior('cu-c2', 'turn-4', 'ASSISTANT', 'ده بيأثر على شغلك؟', 1), attended('cu-c2', 'ATTEND_EXISTING_FOCUS', 'DIRECT_REQUEST_OR_QUESTION', F_AHMED)],
    ]);
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-c1', 'cu-c3']))).evaluateOne(input(cu('cu-c3', 'أيوه، بيأثر جامد.', 'turn-5', 1), semantics('cu-c3', ATTEND(F_AHMED)), continuity)))).toBe('RECURRENCE_NOT_PROVEN');
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-c1', 'cu-c2', 'cu-c3']))).evaluateOne(input(cu('cu-c3', 'أيوه، بيأثر جامد.', 'turn-5', 1), semantics('cu-c3', ATTEND(F_AHMED)), continuity)))).toBe('RECURRENCE_NOT_PROVEN');
  });
});

describe('refinement / reframing (fixtures 17-20)', () => {
  it('17. a refined description of the same Emerging Focus is not a second establishment', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(te01('cu-ref', 'أحمد بتاع الفريق'));
    const result = await service(provider).evaluateOne(input(cu('cu-ref', 'أحمد بتاع الفريق، مش ابن عمي.'), semantics('cu-ref', ATTEND(F_AHMED, 'LOCAL_CLARIFICATION_OR_CORRECTION')), ESTABLISHED));
    expect(result).toMatchObject({ decision: 'NO_ESTABLISHMENT', noEstablishmentReason: 'ALREADY_ESTABLISHED', emergingFocusId: F_AHMED, evidenceCuIds: [] });
    expect(provider.requests).toHaveLength(0);
  });

  it('18./20. Ahmed established + a new relationship focus with genuine relational attention: a distinct establishment that rewrites nothing', async () => {
    const text = 'علاقتي بأحمد هي اللي عايز أتكلم عنها تحديدًا';
    const current = cu('cu-rel', `${text}.`);
    const provider = FakeThreadEstablishmentProvider.returning(te01('cu-rel', text));
    const result = await service(provider).evaluateOne(input(current, semantics('cu-rel', START(F_RELATION, 'EXPLICIT_FOCUS_SHIFT')), ESTABLISHED));
    expect(result).toMatchObject({ decision: 'ESTABLISH_THREAD', path: 'TE-01', emergingFocusId: F_RELATION, evidenceCuIds: ['cu-rel'] });
    expect(result.emergingFocusId).not.toBe(F_AHMED);
    // The provider saw the focus identity B1 chose, and nothing about Ahmed's Thread.
    expect(provider.requests[0].currentFocusSemantics.attention.emerging_focus_id).toBe(F_RELATION);
    expect(JSON.stringify(provider.requests[0])).not.toContain('establishedFocusIds');
    // Ahmed's identity is neither renamed nor merged: the result names one focus only.
    expect(JSON.stringify(result).match(new RegExp(F_AHMED, 'gu'))).toBeNull();
  });

  it('19. merely stating that Ahmed is a colleague creates no relational Thread', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(te01('cu-col', 'أحمد زميلي في الشغل'));
    // B1 attention: Ahmed himself (already established), no relation focus exists.
    const result = await service(provider).evaluateOne(input(cu('cu-col', 'أحمد زميلي في الشغل.'), semantics('cu-col', ATTEND(F_AHMED, 'SUBSTANTIVE_ELABORATION')), ESTABLISHED));
    expect(result).toMatchObject({ decision: 'NO_ESTABLISHMENT', noEstablishmentReason: 'ALREADY_ESTABLISHED', emergingFocusId: F_AHMED });
    expect(JSON.stringify(result)).not.toContain(F_RELATION);
    expect(provider.requests).toHaveLength(0);
  });
});

describe('non-authoritative signals (fixtures 21-25)', () => {
  const keysOf = (value: unknown, out: string[] = []): string[] => {
    if (Array.isArray(value)) value.forEach((child) => keysOf(child, out));
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value as object)) {
        out.push(key);
        keysOf(child, out);
      }
    }
    return out;
  };

  it('21. analytical interest is absent from the provider request: no key for a reading, count, rank or confidence exists or survives', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(NO);
    const smuggled = { ...HISTORY, readingCount: 7, unknownCount: 3, importance: 0.9 } as unknown as ThreadEstablishmentPriorContext;
    await service(provider).evaluateOne(input(cu('cu-an', 'أحمد نفسه بدأ يقلقني.'), semantics('cu-an', START(F_AHMED)), smuggled));
    const keys = keysOf(provider.requests[0]);
    expect(keys.filter((key) => /reading|unknown|count|rank|score|confidence|importance|similarity|embedding|thread|home|spatial|timestamp|createdAt|sessionPosition|liveFocus|established/iu.test(key))).toEqual([]);
    expect(Object.keys(provider.requests[0]).sort()).toEqual(['currentCu', 'currentFocusSemantics', 'focusAttentionHistory', 'priorCus', 'schemaVersion']);
  });

  it('24. a confidence / rank smuggled into a proposal has no channel into the prepared result', async () => {
    const provider = FakeThreadEstablishmentProvider.returning({ ...te01('cu-sel', SELECTION), ...({ confidence: 0.97, rank: 1, threadId: 't-1', homeAnchorId: 'h-1' } as object) });
    const result = await service(provider).evaluateOne(input(SELECTION_CU, semantics('cu-sel', START(F_AHMED, 'EXPLICIT_FOCUS_SHIFT'))));
    expect(Object.keys(result).sort()).toEqual(['cuId', 'decision', 'emergingFocusId', 'evidenceCuIds', 'explicitSelectionGrounding', 'noEstablishmentReason', 'path', 'provenance', 'sessionId', 'sourceRole', 'sourceTurnId']);
    expect(JSON.stringify(result)).not.toMatch(/confidence|rank|threadId|homeAnchorId/u);
  });

  it('25. repeated quoted mentions do not establish', async () => {
    const text = 'خالد قالّي: أحمد زعلان، وأحمد مش عايز يتكلم، وأحمد هيسيب الفريق.';
    const quoted = cu('cu-quo', text);
    const provider = FakeThreadEstablishmentProvider.returning(te01('cu-quo', 'أحمد هيسيب الفريق'));
    // B1 (THR-12) finds no independent USER focus: deterministic NO.
    const result = await service(provider).evaluateOne(input(quoted, semantics('cu-quo', NONE(), [claim(text, 'أحمد زعلان، وأحمد مش عايز يتكلم، وأحمد هيسيب الفريق', 'DIRECT_QUOTATION')])));
    expect(result.noEstablishmentReason).toBe('NO_INDEPENDENT_FOCUS');
    expect(provider.requests).toHaveLength(0);
    // Even if B1 attended Ahmed, a selection anchored inside the quotation is Khaled's wording.
    const attendedSemantics = semantics('cu-quo', ATTEND(F_AHMED, 'DIRECT_SUBJECT'), [claim(text, 'أحمد زعلان، وأحمد مش عايز يتكلم، وأحمد هيسيب الفريق', 'DIRECT_QUOTATION')]);
    expect(await rejection(service(provider).evaluateOne(input(quoted, attendedSemantics)))).toBe('ATTRIBUTED_SELECTION_FORBIDDEN');
  });
});

describe('attribution / grounding (fixtures 26-30)', () => {
  const selectionSemantics = semantics('cu-sel', START(F_AHMED, 'EXPLICIT_FOCUS_SHIFT'));

  it('26. the TE-01 selection anchor is the exact extractive current-CU surface with code-point coordinates', async () => {
    const result = await service(FakeThreadEstablishmentProvider.returning(te01('cu-sel', SELECTION))).evaluateOne(input(SELECTION_CU, selectionSemantics));
    const grounding = result.explicitSelectionGrounding!;
    expect(Array.from(SELECTION_CU.committedText).slice(grounding.span.start, grounding.span.end).join('')).toBe(SELECTION);
    expect(grounding.span).toEqual({ start: 0, end: Array.from(SELECTION).length });
  });

  it('27. a paraphrased or normalized selection anchor has no location', async () => {
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te01('cu-sel', 'عايز نتكلم عن احمد تحديدا'))).evaluateOne(input(SELECTION_CU, selectionSemantics)))).toBe('NON_EXTRACTIVE_SELECTION');
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te01('cu-sel', 'I want to talk about Ahmed'))).evaluateOne(input(SELECTION_CU, selectionSemantics)))).toBe('NON_EXTRACTIVE_SELECTION');
  });

  it('28. a named repetition that does not exist is never substituted', async () => {
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te01('cu-sel', 'أحمد', 2))).evaluateOne(input(SELECTION_CU, selectionSemantics)))).toBe('OCCURRENCE_OUT_OF_RANGE');
  });

  it('29./30. a selection inside REPORTED_SPEECH or DIRECT_QUOTATION is refused; one beside it is the user\'s own', async () => {
    const text = `خالد قال إن أحمد زعلان، بس أنا ${SELECTION}.`;
    const current = cu('cu-bes', text);
    const withReport = semantics('cu-bes', START(F_AHMED, 'EXPLICIT_FOCUS_SHIFT'), [claim(text, 'إن أحمد زعلان', 'REPORTED_SPEECH')]);
    // Inside the reported clause: refused.
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te01('cu-bes', 'أحمد زعلان'))).evaluateOne(input(current, withReport)))).toBe('ATTRIBUTED_SELECTION_FORBIDDEN');
    // The user's own selection beside it: established, with the exact span.
    const result = await service(FakeThreadEstablishmentProvider.returning(te01('cu-bes', SELECTION))).evaluateOne(input(current, withReport));
    expect(result).toMatchObject({ path: 'TE-01', explicitSelectionGrounding: { anchor: { text: SELECTION, occurrence: 1 }, span: spanOf(text, SELECTION) } });
    // A DIRECT_QUOTATION covering the selection: refused.
    const quotedText = `خالد قالّي: ${SELECTION}.`;
    const withQuotation = semantics('cu-quo2', ATTEND(F_AHMED, 'DIRECT_SUBJECT'), [claim(quotedText, SELECTION, 'DIRECT_QUOTATION')]);
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te01('cu-quo2', SELECTION))).evaluateOne(input(cu('cu-quo2', quotedText), withQuotation)))).toBe('ATTRIBUTED_SELECTION_FORBIDDEN');
    // A DIRECT_ASSERTION attribution is the speaker's own claim and does not block selection.
    const asserted = semantics('cu-bes', START(F_AHMED, 'EXPLICIT_FOCUS_SHIFT'), [{ ...claim(text, SELECTION, 'DIRECT_ASSERTION'), claimant_kind: 'CURRENT_CONVERSATIONAL_SPEAKER', claimant_handle_id: null }]);
    expect((await service(FakeThreadEstablishmentProvider.returning(te01('cu-bes', SELECTION))).evaluateOne(input(current, asserted))).path).toBe('TE-01');
  });
});

describe('temporal / sequential restraint (fixtures 31-39)', () => {
  const U1 = cu('cu-u1', `${SELECTION}.`, 'turn-3', 1);
  const U2 = cu('cu-u2', 'هو بقاله أسبوع بيتجنبني.', 'turn-3', 2);
  const A1 = cu('cu-a1', 'تقصد إن أحمد بيتجنبك من بعد الموضوع مع المدير؟', 'turn-4', 1, 'ASSISTANT');
  const S = (c: CurrentCuInput, attention: Partial<CanonicalAttention>) => step(c, semantics(c.cuId, attention));

  it('31. an unknown prior evidence CU is rejected before the provider, and an unknown cited CU is rejected after it', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(NO);
    const ghost = { ...HISTORY, focusAttentionHistory: [...HISTORY.focusAttentionHistory, attended('cu-ghost', 'ATTEND_EXISTING_FOCUS', 'DIRECT_SUBJECT', F_AHMED)] };
    expect(await rejection(service(provider).evaluateOne(input(cu('cu-31', 'أحمد نفسه بدأ يقلقني.'), semantics('cu-31', START(F_AHMED)), ghost)))).toBe('PRIOR_EVIDENCE_NOT_AVAILABLE');
    expect(provider.requests).toHaveLength(0);
    const citing = FakeThreadEstablishmentProvider.returning(te02(['cu-ghost', 'cu-31']));
    expect(await rejection(service(citing).evaluateOne(input(cu('cu-31', 'أحمد نفسه بدأ يقلقني.'), semantics('cu-31', START(F_AHMED)))))).toBe('UNKNOWN_EVIDENCE_CU');
  });

  it('32./33. the current CU or a later CU of its turn in "prior" context is hindsight, refused with zero provider', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(NO);
    const current = cu('cu-2', 'وبعدين أحمد سكت.', 'turn-3', 2);
    const later = (cuId: string, ordinal: number) => prior(cuId, 'turn-3', 'USER', 'وبعدين خالد اتكلم.', ordinal);
    await service(provider).evaluateOne(input(current, semantics('cu-2', START(F_AHMED)), { ...HISTORY, priorCus: [...HISTORY.priorCus, later('cu-1', 1)] }));
    expect(provider.requests).toHaveLength(1);
    expect(await rejection(service(provider).evaluateOne(input(current, semantics('cu-2', START(F_AHMED)), { ...HISTORY, priorCus: [...HISTORY.priorCus, later('cu-2', 2)] })))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(await rejection(service(provider).evaluateOne(input(current, semantics('cu-2', START(F_AHMED)), { ...HISTORY, priorCus: [...HISTORY.priorCus, later('cu-3', 3)] })))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(await rejection(service(provider).evaluateOne(input(current, semantics('cu-2', START(F_AHMED)), { ...HISTORY, focusAttentionHistory: [...HISTORY.focusAttentionHistory, attended('cu-2', 'START_NEW_FOCUS', 'DIRECT_SUBJECT', F_AHMED)] })))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(provider.requests).toHaveLength(1);
  });

  it('34./36. USER CU1 establishes by TE-01; its request holds no later material; later same-focus CUs short-circuit with zero provider', async () => {
    const provider = FakeThreadEstablishmentProvider.scripted([te01('cu-u1', SELECTION)]);
    const evaluation = await service(provider).evaluateSequence('session-1', [S(U1, START(F_AHMED, 'EXPLICIT_FOCUS_SHIFT')), S(U2, ATTEND(F_AHMED)), S(A1, ATTEND(F_AHMED, 'DIRECT_REQUEST_OR_QUESTION'))], HISTORY);
    expect(evaluation.results.map((r) => [r.cuId, r.decision, r.path, r.noEstablishmentReason])).toEqual([
      ['cu-u1', 'ESTABLISH_THREAD', 'TE-01', null],
      ['cu-u2', 'NO_ESTABLISHMENT', null, 'ALREADY_ESTABLISHED'],
      ['cu-a1', 'NO_ESTABLISHMENT', null, 'ALREADY_ESTABLISHED'],
    ]);
    expect(provider.requests).toHaveLength(1);
    const first = JSON.stringify(provider.requests[0]);
    for (const later of [U2, A1]) {
      expect(first).not.toContain(later.cuId);
      expect(first).not.toContain(later.committedText);
    }
    expect(first).not.toContain('turn-4');
    expect(provider.requests[0].priorCus.map((c) => c.cuId)).toEqual(HISTORY.priorCus.map((c) => c.cuId));
    expect(evaluation.establishedInSequence).toEqual([F_AHMED]);
    expect(evaluation.preparedContext.establishedFocusIds).toEqual([F_AHMED]);
    expect(evaluation.preparedContext.priorCus.map((c) => c.cuId)).toEqual([...HISTORY.priorCus.map((c) => c.cuId), 'cu-u1', 'cu-u2', 'cu-a1']);
    expect(evaluation.preparedContext.focusAttentionHistory.slice(-3)).toEqual([
      attended('cu-u1', 'START_NEW_FOCUS', 'EXPLICIT_FOCUS_SHIFT', F_AHMED),
      attended('cu-u2', 'ATTEND_EXISTING_FOCUS', 'SUBSTANTIVE_ELABORATION', F_AHMED),
      attended('cu-a1', 'ATTEND_EXISTING_FOCUS', 'DIRECT_REQUEST_OR_QUESTION', F_AHMED),
    ]);
  });

  it('35. an ASSISTANT CU may rest on earlier USER focus evidence, but never the reverse', async () => {
    const U = cu('cu-u1', 'أحمد نفسه بدأ يقلقني أكتر من المدير.', 'turn-3', 1);
    const provider = FakeThreadEstablishmentProvider.scripted([NO, te02(['cu-u1', 'cu-a1'])]);
    const evaluation = await service(provider).evaluateSequence('session-1', [S(U, START(F_AHMED)), S(A1, ATTEND(F_AHMED, 'DIRECT_REQUEST_OR_QUESTION'))], HISTORY);
    expect(evaluation.results.map((r) => [r.decision, r.path])).toEqual([['NO_ESTABLISHMENT', null], ['ESTABLISH_THREAD', 'TE-02']]);
    expect(evaluation.results[1].evidenceCuIds).toEqual(['cu-u1', 'cu-a1']);
    // The USER request saw no assistant material; the assistant request saw the USER CU as prior context.
    expect(JSON.stringify(provider.requests[0])).not.toContain(A1.committedText);
    expect(provider.requests[1].priorCus.at(-1)).toMatchObject({ cuId: 'cu-u1', sourceRole: 'USER', functions: ['INFORM_REPORT'] });
    expect(provider.requests[1].focusAttentionHistory.at(-1)).toEqual(attended('cu-u1', 'START_NEW_FOCUS', 'DIRECT_SUBJECT', F_AHMED));
    // Assistant CUs before USER CUs are not the frozen exchange order.
    expect(await rejection(service(provider).evaluateSequence('session-1', [S(A1, ATTEND(F_AHMED)), S(U, START(F_AHMED))], HISTORY))).toBe('FUTURE_CONTEXT_FORBIDDEN');
  });

  it('37./44. TE-03 needs an earlier same-focus CU plus intervening committed material', async () => {
    const current = cu('cu-r5', 'وبالنسبة لأحمد، أنا قررت أواجهه.', 'turn-7', 1);
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-r5']))).evaluateOne(input(current, semantics('cu-r5', ATTEND(F_AHMED, 'DIRECT_SUBJECT')), RECURRENCE)))).toBe('RECURRENCE_NOT_PROVEN');
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-h2', 'cu-r5']))).evaluateOne(input(current, semantics('cu-r5', ATTEND(F_AHMED, 'DIRECT_SUBJECT')), RECURRENCE)))).toBe('EVIDENCE_NOT_FOCUS_BOUND');
    // The departure must come AFTER the cited same-focus CU: a Manager CU before it proves no return.
    const before = extend(HISTORY, [
      [prior('cu-b1', 'turn-3', 'USER', 'المدير طلب التقرير بكرة.', 1), attended('cu-b1', 'ATTEND_EXISTING_FOCUS', 'SUBSTANTIVE_ELABORATION', F_MANAGER)],
      [prior('cu-b2', 'turn-4', 'USER', 'أحمد بقى بيتجنبني في الشغل.', 1), attended('cu-b2', 'START_NEW_FOCUS', 'DIRECT_SUBJECT', F_AHMED)],
    ]);
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-b2', 'cu-b3']))).evaluateOne(input(cu('cu-b3', 'وأحمد كمان بطل يرد.', 'turn-5', 1), semantics('cu-b3', ATTEND(F_AHMED)), before)))).toBe('RECURRENCE_NOT_PROVEN');
    // A prior CU with NO B1 semantics proves nothing about where attention lay.
    const unknownAttention: ThreadEstablishmentPriorContext = {
      ...extend(HISTORY, [[prior('cu-k1', 'turn-3', 'USER', 'أحمد بقى بيتجنبني في الشغل.', 1), attended('cu-k1', 'START_NEW_FOCUS', 'DIRECT_SUBJECT', F_AHMED)]]),
    };
    const legacy = { ...unknownAttention, priorCus: [...unknownAttention.priorCus, prior('cu-k2', 'turn-4', 'USER', 'حاجة تانية خالص.', 1)] };
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-k1', 'cu-k3']))).evaluateOne(input(cu('cu-k3', 'وأحمد كمان بطل يرد.', 'turn-5', 1), semantics('cu-k3', ATTEND(F_AHMED)), legacy)))).toBe('RECURRENCE_NOT_PROVEN');
  });

  it('38. a provider that cites a future CU id is rejected: the id is unknown to that request', async () => {
    const provider = FakeThreadEstablishmentProvider.scripted([te02(['cu-u1', 'cu-u2'])]);
    expect(await rejection(service(provider).evaluateSequence('session-1', [S(U1, START(F_AHMED)), S(U2, ATTEND(F_AHMED))], HISTORY))).toBe('UNKNOWN_EVIDENCE_CU');
    expect(provider.requests).toHaveLength(1);
    expect(JSON.stringify(provider.requests[0])).not.toContain('cu-u2');
  });

  it('39. duplicate evidence ids are rejected', async () => {
    const current = cu('cu-e3', 'وكل ما أحاول أفتح معاه الموضوع يقولي مشغول.', 'turn-4', 2);
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te02(['cu-e2', 'cu-e2', 'cu-e3']))).evaluateOne(input(current, semantics('cu-e3', ATTEND(F_AHMED)), ENGAGED)))).toBe('DUPLICATE_EVIDENCE_CU');
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te02(['cu-e3', 'cu-e2', 'cu-e3']))).evaluateOne(input(current, semantics('cu-e3', ATTEND(F_AHMED)), ENGAGED)))).toBe('DUPLICATE_EVIDENCE_CU');
  });

  it('the sequence refuses history that already contains a sequence CU or overlapping same-turn material, and semantics of another CU', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(NO);
    const leaked = extend(HISTORY, [[prior('cu-u2', 'turn-3', 'USER', U2.committedText, 2), attended('cu-u2', 'ATTEND_EXISTING_FOCUS', 'SUBSTANTIVE_ELABORATION', F_AHMED)]]);
    expect(await rejection(service(provider).evaluateSequence('session-1', [S(U2, ATTEND(F_AHMED))], leaked))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    const overlapping = extend(HISTORY, [[prior('cu-z3', 'turn-3', 'USER', 'وامبارح سابني في الاجتماع.', 3), attended('cu-z3', 'NO_INDEPENDENT_FOCUS', 'INCIDENTAL_OR_SUBORDINATE', null)]]);
    expect(await rejection(service(provider).evaluateSequence('session-1', [S(U2, ATTEND(F_AHMED))], overlapping))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(await rejection(service(provider).evaluateSequence('session-1', [step(U1, semantics('cu-other', START(F_AHMED)))], HISTORY))).toBe('FOCUS_SEMANTICS_MISMATCH');
    expect(await rejection(service(provider).evaluateOne(input(U1, semantics('cu-other', START(F_AHMED)))))).toBe('FOCUS_SEMANTICS_MISMATCH');
    expect(provider.requests).toHaveLength(0);
  });
});

describe('fail closed (fixtures 40-46) and input gates', () => {
  const current = cu('cu-f', 'أحمد نفسه بدأ يقلقني أكتر من المدير.');
  const focused = semantics('cu-f', START(F_AHMED));

  it('40. malformed structured output is a rejection, never NO_ESTABLISHMENT', async () => {
    expect(await rejection(service(FakeThreadEstablishmentProvider.failing('INVALID_STRUCTURED_OUTPUT')).evaluateOne(input(current, focused)))).toBe('INVALID_PROVIDER_PAYLOAD');
  });

  it('41. an illegal decision or path shape is rejected', async () => {
    const shapes: [ThreadEstablishmentProposal, string][] = [
      [{ ...NO, decision: 'MAYBE' as never }, 'INVALID_PROVIDER_PAYLOAD'],
      [{ ...NO, path: 'TE-04' as never }, 'INVALID_PROVIDER_PAYLOAD'],
      [{ ...NO, path: 'TE-01' }, 'INVALID_PROMOTION_PATH'],
      [{ ...NO, evidenceCuIds: ['cu-f'] }, 'INVALID_PROMOTION_PATH'],
      [{ ...NO, explicitSelectionAnchor: { text: 'أحمد', occurrence: 1 } }, 'INVALID_PROMOTION_PATH'],
      [{ ...te01('cu-f', 'أحمد'), path: null }, 'INVALID_PROMOTION_PATH'],
      [{ ...te01('cu-f', 'أحمد'), evidenceCuIds: [7 as never] }, 'INVALID_PROVIDER_PAYLOAD'],
      [{ ...te01('cu-f', 'أحمد'), explicitSelectionAnchor: { text: 'أحمد', occurrence: 0 } }, 'INVALID_PROVIDER_PAYLOAD'],
      [{ ...te01('cu-f', 'أحمد'), evidenceCuIds: [] }, 'CURRENT_CU_EVIDENCE_REQUIRED'],
      [{ ...te02(['cu-f']), explicitSelectionAnchor: { text: 'أحمد', occurrence: 1 } }, 'INVALID_PROMOTION_PATH'],
      [{ ...te01('cu-f', 'أحمد'), explicitSelectionAnchor: null }, 'EXPLICIT_SELECTION_REQUIRED'],
    ];
    for (const [proposal, reason] of shapes) {
      expect(await rejection(service(FakeThreadEstablishmentProvider.returning(proposal)).evaluateOne(input(current, focused)))).toBe(reason);
    }
  });

  it('42./43. TE-01 with several evidence CUs, and TE-02 with one CU, are rejected', async () => {
    const e3 = cu('cu-e3', 'وكل ما أحاول أفتح معاه الموضوع يقولي مشغول.', 'turn-4', 2);
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning({ ...te01('cu-e3', 'يقولي مشغول'), evidenceCuIds: ['cu-e2', 'cu-e3'] })).evaluateOne(input(e3, semantics('cu-e3', ATTEND(F_AHMED)), ENGAGED)))).toBe('INVALID_PROMOTION_PATH');
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te02(['cu-f']))).evaluateOne(input(current, focused)))).toBe('INSUFFICIENT_SUSTAINED_EVIDENCE');
  });

  it('45. provider outage or timeout is a technical failure, never NO establishment', async () => {
    for (const code of ['UNAVAILABLE', 'TIMEOUT', 'PROVIDER_ERROR'] as const) {
      expect(await rejection(service(FakeThreadEstablishmentProvider.failing(code)).evaluateOne(input(current, focused)))).toBe('THREAD_PROVIDER_UNAVAILABLE');
    }
    const exhausted = FakeThreadEstablishmentProvider.scripted([NO, NO]);
    await service(exhausted).evaluateOne(input(current, focused));
    await service(exhausted).evaluateOne(input(current, focused));
    expect(await rejection(service(exhausted).evaluateOne(input(current, focused)))).toBe('THREAD_PROVIDER_UNAVAILABLE');
  });

  it('a malformed prior context is never truthful non-establishment', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(NO);
    const withHistory = (entry: FocusAttentionHistoryEntry) => ({ ...HISTORY, focusAttentionHistory: [...HISTORY.focusAttentionHistory, entry] });
    expect(await rejection(service(provider).evaluateOne(input(current, focused, withHistory({ ...attended('cu-h4', 'NO_INDEPENDENT_FOCUS', 'INCIDENTAL_OR_SUBORDINATE', null), attentionKind: 'MAYBE_FOCUS' as never }))))).toBe('INVALID_ATTENTION_HISTORY');
    expect(await rejection(service(provider).evaluateOne(input(current, focused, { ...HISTORY, focusAttentionHistory: [...HISTORY.focusAttentionHistory.slice(0, 3), attended('cu-h4', 'ATTEND_EXISTING_FOCUS', 'DIRECT_SUBJECT', 'prepared:focus:cu-h1')] })))).toBe('INVALID_ATTENTION_HISTORY');
    expect(await rejection(service(provider).evaluateOne(input(current, focused, { ...HISTORY, focusAttentionHistory: [...HISTORY.focusAttentionHistory.slice(0, 3), attended('cu-h4', 'START_NEW_FOCUS', 'INCIDENTAL_OR_SUBORDINATE', F_AHMED)] })))).toBe('INVALID_ATTENTION_HISTORY');
    expect(await rejection(service(provider).evaluateOne(input(current, focused, { ...HISTORY, focusAttentionHistory: [...HISTORY.focusAttentionHistory.slice(0, 3), attended('cu-h4', 'NO_INDEPENDENT_FOCUS', 'INCIDENTAL_OR_SUBORDINATE', F_AHMED)] })))).toBe('INVALID_ATTENTION_HISTORY');
    expect(await rejection(service(provider).evaluateOne(input(current, focused, { ...HISTORY, establishedFocusIds: ['prepared:focus:cu-h1'] })))).toBe('INVALID_EVALUATION_INPUT');
    expect(await rejection(service(provider).evaluateOne(input(current, focused, { ...HISTORY, establishedFocusIds: [F_MANAGER, F_MANAGER] })))).toBe('INVALID_EVALUATION_INPUT');
    // Unordered prior CUs (a turn resumed, a descending ordinal) are not a canonical cut.
    expect(await rejection(service(provider).evaluateOne(input(current, focused, { ...HISTORY, priorCus: [HISTORY.priorCus[0], HISTORY.priorCus[2], HISTORY.priorCus[1], HISTORY.priorCus[3]] })))).toBe('INVALID_EVALUATION_INPUT');
    expect(await rejection(service(provider).evaluateOne(input(current, focused, { ...HISTORY, priorCus: [HISTORY.priorCus[1], HISTORY.priorCus[0], HISTORY.priorCus[2], HISTORY.priorCus[3]] })))).toBe('INVALID_EVALUATION_INPUT');
    expect(await rejection(service(provider).evaluateOne(input(cu('cu-f', ''), focused)))).toBe('INVALID_EVALUATION_INPUT');
    expect(await rejection(service(provider).evaluateOne({ ...input(current, focused), sessionId: '' }))).toBe('INVALID_EVALUATION_INPUT');
    // Claim spans outside the committed text are not this CU's semantics.
    expect(await rejection(service(provider).evaluateOne(input(current, { ...focused, claim_attributions: [{ ...claim(current.committedText, 'أحمد', 'REPORTED_SPEECH'), span_end: 999 }] })))).toBe('INVALID_EVALUATION_INPUT');
    expect(provider.requests).toHaveLength(0);
  });

  it('carries stable technical provenance and no wall-clock, SP, Thread or Home value', async () => {
    const result = await service(FakeThreadEstablishmentProvider.returning(NO)).evaluateOne(input(current, focused));
    expect(result.provenance).toEqual({
      evaluatorVersion: THREAD_ESTABLISHMENT_EVALUATOR_VERSION,
      policyVersion: THREAD_ESTABLISHMENT_POLICY_VERSION,
      provider: 'FAKE',
      model: 'fake-model',
      promptVersion: THREAD_ESTABLISHMENT_PROMPT_VERSION,
      schemaVersion: THREAD_ESTABLISHMENT_SCHEMA_VERSION,
    });
    expect(THREAD_ESTABLISHMENT_EVALUATOR_VERSION).toBe('thread-establishment-evaluator-v1');
    expect(THREAD_ESTABLISHMENT_POLICY_VERSION).toBe('stage-1.3-thread-establishment-v1');
    expect(THREAD_ESTABLISHMENT_PROMPT_VERSION).toBe('thread-establishment-evidence-path-v1');
    expect(JSON.stringify(result)).not.toMatch(/threadId|thread_id|homeAnchor|home_anchor|spatial|sessionPosition|session_position|liveFocus|createdAt|timestamp|\d{4}-\d{2}-\d{2}T/u);
  });
});

describe('Targeted Fix R1: same-turn forward history (FIX-T03B2A-01), latest-focus TE-03 boundary (FIX-T03B2A-02), one role per source turn (FIX-T03B2A-03)', () => {
  const S = (c: CurrentCuInput, attention: Partial<CanonicalAttention>) => step(c, semantics(c.cuId, attention));
  /** turn-3 already holds one committed USER CU (ordinal 1) before the sequence (ordinals 2/3) arrives. */
  const FORWARD = extend(HISTORY, [[prior('cu-u1', 'turn-3', 'USER', 'أحمد نفسه بدأ يقلقني أكتر من المدير.', 1), attended('cu-u1', 'START_NEW_FOCUS', 'DIRECT_SUBJECT', F_AHMED)]]);
  const U2 = cu('cu-u2', 'هو بقاله أسبوع بيتجنبني.', 'turn-3', 2);
  const U3 = cu('cu-u3', 'وامبارح سابني في الاجتماع من غير كلمة.', 'turn-3', 3);
  type Pair = [PriorCuContext, FocusAttentionHistoryEntry];
  const ahmed = (cuId: string, turn: string, text = 'أحمد بقى بيتجنبني في الشغل.'): Pair => [prior(cuId, turn, 'USER', text, 1), attended(cuId, 'ATTEND_EXISTING_FOCUS', 'SUBSTANTIVE_ELABORATION', F_AHMED)];
  const manager = (cuId: string, turn: string): Pair => [prior(cuId, turn, 'USER', 'المهم، المدير طلب مني أقدم التقرير بكرة.', 1), attended(cuId, 'ATTEND_EXISTING_FOCUS', 'EXPLICIT_FOCUS_SHIFT', F_MANAGER)];

  it('FIX-01 (1/2/7): an earlier committed CU of the same source turn is legitimate prior context, each request sees only what precedes it, and ordinals are never renumbered', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(NO);
    const evaluation = await service(provider).evaluateSequence('session-1', [S(U2, ATTEND(F_AHMED)), S(U3, ATTEND(F_AHMED))], FORWARD);
    expect(evaluation.results.map((r) => r.cuId)).toEqual(['cu-u2', 'cu-u3']);
    expect(provider.requests).toHaveLength(2);
    const first = provider.requests[0];
    expect(first.currentCu.ordinalWithinTurn).toBe(2);
    expect(first.priorCus.filter((c) => c.sourceTurnId === 'turn-3').map((c) => [c.cuId, c.ordinalWithinTurn])).toEqual([['cu-u1', 1]]);
    expect(first.focusAttentionHistory.at(-1)).toEqual(attended('cu-u1', 'START_NEW_FOCUS', 'DIRECT_SUBJECT', F_AHMED));
    expect(JSON.stringify(first)).not.toContain('cu-u3');
    expect(JSON.stringify(first)).not.toContain(U3.committedText);
    const second = provider.requests[1];
    expect(second.currentCu.ordinalWithinTurn).toBe(3);
    expect(second.priorCus.filter((c) => c.sourceTurnId === 'turn-3').map((c) => [c.cuId, c.ordinalWithinTurn])).toEqual([['cu-u1', 1], ['cu-u2', 2]]);
    // The global ordinals supplied by B1 / T-03A survive into the prepared context.
    expect(evaluation.preparedContext.priorCus.slice(-3).map((c) => [c.cuId, c.ordinalWithinTurn])).toEqual([['cu-u1', 1], ['cu-u2', 2], ['cu-u3', 3]]);
  });

  it('FIX-01 (3/4/5): the first sequence ordinal, any later ordinal, or the sequence CU id itself in "prior" context is hindsight, refused before the provider', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(NO);
    const sameTurn = (cuId: string, ordinal: number) => extend(HISTORY, [[prior(cuId, 'turn-3', 'USER', 'وبعدين خالد اتكلم.', ordinal), attended(cuId, 'NO_INDEPENDENT_FOCUS', 'INCIDENTAL_OR_SUBORDINATE', null)]]);
    expect(await rejection(service(provider).evaluateSequence('session-1', [S(U2, ATTEND(F_AHMED)), S(U3, ATTEND(F_AHMED))], sameTurn('cu-x2', 2)))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(await rejection(service(provider).evaluateSequence('session-1', [S(U2, ATTEND(F_AHMED))], sameTurn('cu-x3', 3)))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(await rejection(service(provider).evaluateSequence('session-1', [S(U2, ATTEND(F_AHMED))], sameTurn('cu-u2', 2)))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(await rejection(service(provider).evaluateSequence('session-1', [S(U2, ATTEND(F_AHMED))], sameTurn('cu-u2', 1)))).toBe('FUTURE_CONTEXT_FORBIDDEN');
    expect(provider.requests).toHaveLength(0);
  });

  it('FIX-01 (6): a same-turn earlier CU is TE-02 / TE-03 evidence when B1 attention binds it to the target focus', async () => {
    const sustained = await service(FakeThreadEstablishmentProvider.returning(te02(['cu-u1', 'cu-u2']))).evaluateSequence('session-1', [S(U2, ATTEND(F_AHMED))], FORWARD);
    expect(sustained.results[0]).toMatchObject({ decision: 'ESTABLISH_THREAD', path: 'TE-02', evidenceCuIds: ['cu-u1', 'cu-u2'] });
    // Within one turn: Ahmed (ordinal 1) -> Manager departure (ordinal 2) -> current Ahmed return (ordinal 3).
    const withinTurn = extend(HISTORY, [
      [prior('cu-w1', 'turn-9', 'USER', 'أحمد بقى بيتجنبني في الشغل.', 1), attended('cu-w1', 'START_NEW_FOCUS', 'DIRECT_SUBJECT', F_AHMED)],
      [prior('cu-w2', 'turn-9', 'USER', 'المهم، المدير طلب مني أقدم التقرير بكرة.', 2), attended('cu-w2', 'ATTEND_EXISTING_FOCUS', 'EXPLICIT_FOCUS_SHIFT', F_MANAGER)],
    ]);
    const recurrent = await service(FakeThreadEstablishmentProvider.returning(te03(['cu-w1', 'cu-w3']))).evaluateSequence('session-1', [S(cu('cu-w3', 'وبالنسبة لأحمد، أنا قررت أواجهه.', 'turn-9', 3), ATTEND(F_AHMED, 'DIRECT_SUBJECT'))], withinTurn);
    expect(recurrent.results[0]).toMatchObject({ decision: 'ESTABLISH_THREAD', path: 'TE-03', evidenceCuIds: ['cu-w1', 'cu-w3'] });
  });

  it('FIX-02: TE-03 recurrence is measured from the LATEST prior target-focus attention over the full history, never from the earliest cited evidence', async () => {
    const current = cu('cu-now', 'وبالنسبة لأحمد، أنا قررت أواجهه.', 'turn-20', 1);
    const now = semantics('cu-now', ATTEND(F_AHMED, 'DIRECT_SUBJECT'));
    // True recurrence: Ahmed -> Manager -> CURRENT Ahmed.
    const trueReturn = extend(HISTORY, [ahmed('cu-t1', 'turn-10'), manager('cu-t2', 'turn-11')]);
    expect((await service(FakeThreadEstablishmentProvider.returning(te03(['cu-t1', 'cu-now']))).evaluateOne(input(current, now, trueReturn))).path).toBe('TE-03');
    // False recurrence: Ahmed -> Manager -> Ahmed -> CURRENT Ahmed. Citing the OLD Ahmed CU hides the return that already happened.
    const alreadyReturned = extend(HISTORY, [ahmed('cu-f1', 'turn-10'), manager('cu-f2', 'turn-11'), ahmed('cu-f3', 'turn-12', 'وأحمد كمان بطل يرد.')]);
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-f1', 'cu-now']))).evaluateOne(input(current, now, alreadyReturned)))).toBe('RECURRENCE_NOT_PROVEN');
    // Citing the latest Ahmed CU as well does not help: nothing lies between it and the current CU - a continuation, not a recurrence.
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-f1', 'cu-f3', 'cu-now']))).evaluateOne(input(current, now, alreadyReturned)))).toBe('RECURRENCE_NOT_PROVEN');
    // Ahmed1 -> Ahmed2 -> Manager -> CURRENT Ahmed: the boundary is Ahmed2.
    const twoThenAway = extend(HISTORY, [ahmed('cu-g1', 'turn-10'), ahmed('cu-g2', 'turn-11', 'وأحمد كمان بطل يرد.'), manager('cu-g3', 'turn-12')]);
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-g1', 'cu-now']))).evaluateOne(input(current, now, twoThenAway)))).toBe('RECURRENCE_NOT_PROVEN');
    expect((await service(FakeThreadEstablishmentProvider.returning(te03(['cu-g2', 'cu-now']))).evaluateOne(input(current, now, twoThenAway))).evidenceCuIds).toEqual(['cu-g2', 'cu-now']);
    expect((await service(FakeThreadEstablishmentProvider.returning(te03(['cu-g1', 'cu-g2', 'cu-now']))).evaluateOne(input(current, now, twoThenAway))).evidenceCuIds).toEqual(['cu-g1', 'cu-g2', 'cu-now']);
    // Manager -> Ahmed -> CURRENT Ahmed: no departure after the latest Ahmed CU.
    const noDeparture = extend(HISTORY, [manager('cu-n1', 'turn-10'), ahmed('cu-n2', 'turn-11')]);
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-n2', 'cu-now']))).evaluateOne(input(current, now, noDeparture)))).toBe('RECURRENCE_NOT_PROVEN');
    // Ahmed -> local clarification -> CURRENT Ahmed: a clarification is not a departure.
    const clarified = extend(HISTORY, [ahmed('cu-l1', 'turn-10'), [prior('cu-l2', 'turn-11', 'ASSISTANT', 'ده حصل إمتى؟', 1), attended('cu-l2', 'NO_INDEPENDENT_FOCUS', 'LOCAL_CLARIFICATION_OR_CORRECTION', null)]]);
    expect(await rejection(service(FakeThreadEstablishmentProvider.returning(te03(['cu-l1', 'cu-now']))).evaluateOne(input(current, now, clarified)))).toBe('RECURRENCE_NOT_PROVEN');
    // Pronoun-based recurrence stays valid: identity is the stable emergingFocusId, not the repeated name.
    const pronoun = cu('cu-now', 'هو رجع يتجنبني تاني من الصبح.', 'turn-20', 1);
    expect(pronoun.committedText).not.toContain('أحمد');
    expect((await service(FakeThreadEstablishmentProvider.returning(te03(['cu-t1', 'cu-now']))).evaluateOne(input(pronoun, now, trueReturn))).path).toBe('TE-03');
  });

  it('FIX-03: one source turn carries exactly one canonical source role - in prior context, in the sequence, and across the same-turn boundary', async () => {
    const provider = FakeThreadEstablishmentProvider.returning(NO);
    // (1) prior same-turn USER + later sequence USER: accepted.
    await service(provider).evaluateSequence('session-1', [S(U2, ATTEND(F_AHMED))], FORWARD);
    expect(provider.requests).toHaveLength(1);
    // (2) prior same-turn USER + later sequence ASSISTANT: refused before the provider, never re-labelled.
    expect(await rejection(service(provider).evaluateSequence('session-1', [S(cu('cu-a9', 'تقصد إن أحمد بيتجنبك؟', 'turn-3', 2, 'ASSISTANT'), ATTEND(F_AHMED, 'DIRECT_REQUEST_OR_QUESTION'))], FORWARD))).toBe('INVALID_EVALUATION_INPUT');
    expect(await rejection(service(provider).evaluateOne(input(cu('cu-a9', 'تقصد إن أحمد بيتجنبك؟', 'turn-3', 2, 'ASSISTANT'), semantics('cu-a9', ATTEND(F_AHMED, 'DIRECT_REQUEST_OR_QUESTION')), FORWARD)))).toBe('INVALID_EVALUATION_INPUT');
    // (3) one sequence turn with USER ordinal 1 and ASSISTANT ordinal 2: refused.
    expect(await rejection(service(provider).evaluateSequence('session-1', [S(cu('cu-s1', 'أحمد زعلان.', 'turn-7', 1, 'USER'), START(F_AHMED)), S(cu('cu-s2', 'تقصد إن أحمد زعلان منك؟', 'turn-7', 2, 'ASSISTANT'), ATTEND(F_AHMED, 'DIRECT_REQUEST_OR_QUESTION'))], HISTORY))).toBe('INVALID_EVALUATION_INPUT');
    // (4) prior context holding a mixed-role turn: refused at the one-CU boundary.
    const mixed = extend(HISTORY, [
      [prior('cu-x1', 'turn-5', 'USER', 'أحمد زعلان.', 1), attended('cu-x1', 'START_NEW_FOCUS', 'DIRECT_SUBJECT', F_AHMED)],
      [prior('cu-x2', 'turn-5', 'ASSISTANT', 'تقصد إن أحمد زعلان منك؟', 2), attended('cu-x2', 'ATTEND_EXISTING_FOCUS', 'DIRECT_REQUEST_OR_QUESTION', F_AHMED)],
    ]);
    expect(await rejection(service(provider).evaluateOne(input(cu('cu-x3', 'أيوه.', 'turn-6', 1), semantics('cu-x3', ATTEND(F_AHMED)), mixed)))).toBe('INVALID_EVALUATION_INPUT');
    expect(await rejection(service(provider).evaluateSequence('session-1', [S(cu('cu-x3', 'أيوه.', 'turn-6', 1), ATTEND(F_AHMED))], mixed))).toBe('INVALID_EVALUATION_INPUT');
    expect(provider.requests).toHaveLength(1);
    // (5) separate USER and ASSISTANT source turns in finalized-exchange order remain accepted.
    const exchange = await service(provider).evaluateSequence('session-1', [
      S(cu('cu-e1', 'أحمد زعلان.', 'turn-30', 1), START(F_AHMED)),
      S(cu('cu-e2', 'وبطل يرد.', 'turn-30', 2), ATTEND(F_AHMED)),
      S(cu('cu-e3', 'تقصد إن أحمد بيتجنبك؟', 'turn-31', 1, 'ASSISTANT'), ATTEND(F_AHMED, 'DIRECT_REQUEST_OR_QUESTION')),
    ], HISTORY);
    expect(exchange.results.map((r) => r.cuId)).toEqual(['cu-e1', 'cu-e2', 'cu-e3']);
    expect(provider.requests.slice(1).map((r) => [r.currentCu.sourceTurnId, r.currentCu.sourceRole])).toEqual([['turn-30', 'USER'], ['turn-30', 'USER'], ['turn-31', 'ASSISTANT']]);
  });
});
