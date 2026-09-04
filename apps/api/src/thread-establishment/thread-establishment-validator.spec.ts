import type { CurrentCuInput, PriorCuContext } from '../conversational-focus/conversational-focus.types';
import type { CanonicalAttention, CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import type { ThreadEstablishmentProposal } from './thread-establishment-provider.types';
import { establishmentTarget, validateThreadEstablishmentProposal } from './thread-establishment-validator';
import {
  ATTRIBUTED_CLAIM_FRAMES,
  FOCUS_BEARING_ATTENTION_KINDS,
  NO_ESTABLISHMENT_REASONS,
  STABLE_FOCUS_ID_PATTERN,
  THREAD_ESTABLISHMENT_DECISIONS,
  THREAD_ESTABLISHMENT_PATHS,
  type FocusAttentionHistoryEntry,
  type ThreadEstablishmentEvaluationInput,
} from './thread-establishment.types';

const F_AHMED = '3f2a9c1e-7b4d-5a6e-8c9f-0a1b2c3d4e5f';
const F_MANAGER = '9b8c7d6e-5f4a-5b3c-9d2e-1f0a9b8c7d6e';

const prior = (cuId: string, sourceTurnId: string, sourceRole: 'USER' | 'ASSISTANT', committedText: string, ordinalWithinTurn: number): PriorCuContext => ({
  cuId,
  sourceTurnId,
  sourceRole,
  committedText,
  ordinalWithinTurn,
  functions: null,
  sequencePosition: null,
  targetCuId: null,
});
const attention = (overrides: Partial<CanonicalAttention>): CanonicalAttention => ({
  kind: 'NO_INDEPENDENT_FOCUS',
  reason: 'INCIDENTAL_OR_SUBORDINATE',
  emerging_focus_id: null,
  creates_focus: false,
  grounding_reference_index: null,
  ...overrides,
});
const semantics = (cuId: string, att: Partial<CanonicalAttention>): CanonicalCuFocusSemanticPayload => ({
  unit_id: cuId,
  functions: ['INFORM_REPORT'],
  sequence_position: 'UNMARKED',
  target_cu_id: null,
  references: [],
  claim_attributions: [],
  attention: attention(att),
});
const ATTEND_AHMED = { kind: 'ATTEND_EXISTING_FOCUS', reason: 'SUBSTANTIVE_ELABORATION', emerging_focus_id: F_AHMED } as const;

const CURRENT: CurrentCuInput = { cuId: 'cu-now', sourceTurnId: 'turn-5', sourceRole: 'USER', committedText: 'وأحمد كمان بطل يرد عليا.', ordinalWithinTurn: 1 };
const HISTORY_CUS: PriorCuContext[] = [
  prior('cu-1', 'turn-1', 'USER', 'أحمد بقى بيتجنبني في الشغل.', 1),
  prior('cu-2', 'turn-2', 'ASSISTANT', 'ده بيأثر على شغلك؟', 1),
  prior('cu-3', 'turn-3', 'USER', 'المدير طلب التقرير بكرة.', 1),
  prior('cu-4', 'turn-4', 'ASSISTANT', 'التقرير مرتبط بالتغيير مع المدير؟', 1),
];
const HISTORY: FocusAttentionHistoryEntry[] = [
  { cuId: 'cu-1', attentionKind: 'START_NEW_FOCUS', attentionReason: 'DIRECT_SUBJECT', emergingFocusId: F_AHMED },
  { cuId: 'cu-2', attentionKind: 'ATTEND_EXISTING_FOCUS', attentionReason: 'DIRECT_REQUEST_OR_QUESTION', emergingFocusId: F_AHMED },
  { cuId: 'cu-3', attentionKind: 'ATTEND_EXISTING_FOCUS', attentionReason: 'EXPLICIT_FOCUS_SHIFT', emergingFocusId: F_MANAGER },
  { cuId: 'cu-4', attentionKind: 'ATTEND_EXISTING_FOCUS', attentionReason: 'DIRECT_REQUEST_OR_QUESTION', emergingFocusId: F_MANAGER },
];
const input = (att: Partial<CanonicalAttention> = ATTEND_AHMED, establishedFocusIds: string[] = []): ThreadEstablishmentEvaluationInput => ({
  sessionId: 'session-1',
  currentCu: CURRENT,
  currentFocusSemantics: semantics('cu-now', att),
  priorContext: { priorCus: HISTORY_CUS, focusAttentionHistory: HISTORY, establishedFocusIds },
});
const outcome = (proposal: ThreadEstablishmentProposal, evaluation = input()): string => {
  const result = validateThreadEstablishmentProposal(proposal, evaluation);
  return result.outcome === 'VALID' ? `VALID:${result.establishment.path ?? result.establishment.noEstablishmentReason}` : result.reason;
};
const te = (path: 'TE-01' | 'TE-02' | 'TE-03', evidenceCuIds: string[], anchor: { text: string; occurrence: number } | null = null): ThreadEstablishmentProposal => ({
  decision: 'ESTABLISH_THREAD',
  path,
  evidenceCuIds,
  explicitSelectionAnchor: anchor,
});

describe('frozen vocabularies', () => {
  it('holds exactly the three evidence paths, two decisions and three engineering reasons', () => {
    expect([...THREAD_ESTABLISHMENT_PATHS]).toEqual(['TE-01', 'TE-02', 'TE-03']);
    expect([...THREAD_ESTABLISHMENT_DECISIONS]).toEqual(['NO_ESTABLISHMENT', 'ESTABLISH_THREAD']);
    expect([...NO_ESTABLISHMENT_REASONS]).toEqual(['NO_INDEPENDENT_FOCUS', 'ALREADY_ESTABLISHED', 'NO_PROMOTION_PATH_PROVEN']);
    expect([...FOCUS_BEARING_ATTENTION_KINDS]).toEqual(['START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS']);
    expect([...ATTRIBUTED_CLAIM_FRAMES]).toEqual(['REPORTED_SPEECH', 'DIRECT_QUOTATION']);
    expect(Object.isFrozen(THREAD_ESTABLISHMENT_PATHS)).toBe(true);
  });

  it('derives the establishment target only from a focus-bearing attention with a stable identity', () => {
    expect(establishmentTarget(semantics('cu-now', ATTEND_AHMED))).toBe(F_AHMED);
    expect(establishmentTarget(semantics('cu-now', { kind: 'START_NEW_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: F_AHMED, creates_focus: true, grounding_reference_index: 0 }))).toBe(F_AHMED);
    expect(establishmentTarget(semantics('cu-now', {}))).toBeNull();
    expect(establishmentTarget(semantics('cu-now', { ...ATTEND_AHMED, emerging_focus_id: null }))).toBeNull();
    expect(establishmentTarget(semantics('cu-now', { ...ATTEND_AHMED, emerging_focus_id: 'prepared:focus:cu-1' }))).toBeNull();
    expect(establishmentTarget(semantics('cu-now', { ...ATTEND_AHMED, emerging_focus_id: F_AHMED.toUpperCase() }))).toBeNull();
    expect(STABLE_FOCUS_ID_PATTERN.test('3f2a9c1e-7b4d-8a6e-8c9f-0a1b2c3d4e5f')).toBe(false);
  });
});

describe('proposal validation', () => {
  it('NO_ESTABLISHMENT must be exactly empty', () => {
    expect(outcome({ decision: 'NO_ESTABLISHMENT', path: null, evidenceCuIds: [], explicitSelectionAnchor: null })).toBe('VALID:NO_PROMOTION_PATH_PROVEN');
    expect(outcome({ decision: 'NO_ESTABLISHMENT', path: 'TE-02', evidenceCuIds: [], explicitSelectionAnchor: null })).toBe('INVALID_PROMOTION_PATH');
    expect(outcome({ decision: 'NO_ESTABLISHMENT', path: null, evidenceCuIds: ['cu-now'], explicitSelectionAnchor: null })).toBe('INVALID_PROMOTION_PATH');
    expect(outcome({ decision: 'NO_ESTABLISHMENT', path: null, evidenceCuIds: [], explicitSelectionAnchor: { text: 'أحمد', occurrence: 1 } })).toBe('INVALID_PROMOTION_PATH');
  });

  it('ESTABLISH_THREAD needs a stable, not-yet-established focus and the current CU among distinct known evidence', () => {
    expect(outcome(te('TE-03', ['cu-1', 'cu-now']), input({}))).toBe('ESTABLISHMENT_WITHOUT_FOCUS');
    expect(outcome(te('TE-03', ['cu-1', 'cu-now']), input(ATTEND_AHMED, [F_AHMED]))).toBe('FOCUS_ALREADY_ESTABLISHED');
    expect(outcome(te('TE-03', ['cu-1']))).toBe('CURRENT_CU_EVIDENCE_REQUIRED');
    expect(outcome(te('TE-03', ['cu-1', 'cu-now', 'cu-1']))).toBe('DUPLICATE_EVIDENCE_CU');
    expect(outcome(te('TE-03', ['cu-9', 'cu-now']))).toBe('UNKNOWN_EVIDENCE_CU');
    expect(outcome(te('TE-03', ['cu-3', 'cu-now']))).toBe('EVIDENCE_NOT_FOCUS_BOUND');
    expect(outcome({ ...te('TE-03', ['cu-1', 'cu-now']), path: null })).toBe('INVALID_PROMOTION_PATH');
    expect(outcome({ ...te('TE-03', ['cu-1', 'cu-now']), decision: 'PROMOTE' as never })).toBe('INVALID_PROVIDER_PAYLOAD');
    expect(outcome(null as never)).toBe('INVALID_PROVIDER_PAYLOAD');
  });

  it('TE-01: USER only, exactly the current CU, an exact extractive anchor outside attributed speech', () => {
    expect(outcome(te('TE-01', ['cu-now'], { text: 'وأحمد كمان بطل يرد عليا', occurrence: 1 }))).toBe('VALID:TE-01');
    expect(outcome(te('TE-01', ['cu-now'], null))).toBe('EXPLICIT_SELECTION_REQUIRED');
    expect(outcome(te('TE-01', ['cu-1', 'cu-now'], { text: 'أحمد', occurrence: 1 }))).toBe('INVALID_PROMOTION_PATH');
    expect(outcome(te('TE-01', ['cu-now'], { text: 'احمد', occurrence: 1 }))).toBe('NON_EXTRACTIVE_SELECTION');
    expect(outcome(te('TE-01', ['cu-now'], { text: 'أحمد', occurrence: 2 }))).toBe('OCCURRENCE_OUT_OF_RANGE');
    expect(outcome(te('TE-01', ['cu-now'], { text: 'أحمد', occurrence: 1 }), { ...input(), currentCu: { ...CURRENT, sourceRole: 'ASSISTANT' } })).toBe('EXPLICIT_SELECTION_ROLE_FORBIDDEN');
    const reported: ThreadEstablishmentEvaluationInput = {
      ...input(),
      currentFocusSemantics: {
        ...semantics('cu-now', ATTEND_AHMED),
        claim_attributions: [{ attribution_index: 0, anchor_text: 'أحمد كمان بطل يرد عليا', anchor_occurrence: 1, span_start: 1, span_end: 23, claimant_kind: 'UNRESOLVED', claimant_handle_id: null, claim_frame: 'REPORTED_SPEECH' }],
      },
    };
    expect(outcome(te('TE-01', ['cu-now'], { text: 'أحمد', occurrence: 1 }), reported)).toBe('ATTRIBUTED_SELECTION_FORBIDDEN');
    // The whole CU is wider than the attributed clause, so it is not wholly attributed.
    expect(outcome(te('TE-01', ['cu-now'], { text: 'وأحمد كمان بطل يرد عليا', occurrence: 1 }), reported)).toBe('VALID:TE-01');
  });

  it('TE-02: multiple committed CUs (>= the semantic minimum of two), one prior, one USER, no anchor', () => {
    expect(outcome(te('TE-02', ['cu-1', 'cu-now']))).toBe('VALID:TE-02');
    expect(outcome(te('TE-02', ['cu-now', 'cu-2', 'cu-1']))).toBe('VALID:TE-02');
    expect(outcome(te('TE-02', ['cu-now']))).toBe('INSUFFICIENT_SUSTAINED_EVIDENCE');
    expect(outcome(te('TE-02', ['cu-1', 'cu-now'], { text: 'أحمد', occurrence: 1 }))).toBe('INVALID_PROMOTION_PATH');
    expect(outcome(te('TE-02', ['cu-2', 'cu-now']), { ...input(), currentCu: { ...CURRENT, sourceRole: 'ASSISTANT' } })).toBe('USER_EVIDENCE_REQUIRED');
    const validated = validateThreadEstablishmentProposal(te('TE-02', ['cu-now', 'cu-2', 'cu-1']), input());
    expect(validated.outcome === 'VALID' && validated.establishment.evidenceCuIds).toEqual(['cu-1', 'cu-2', 'cu-now']);
  });

  it('TE-03: the latest same-focus CU cited, a departure after it, and a current CU that is not a local clarification', () => {
    // FIX-T03B2A-02: the return boundary is the LATEST prior Ahmed CU (cu-2), derived from the full history.
    expect(outcome(te('TE-03', ['cu-2', 'cu-now']))).toBe('VALID:TE-03');
    expect(outcome(te('TE-03', ['cu-1', 'cu-2', 'cu-now']))).toBe('VALID:TE-03');
    expect(outcome(te('TE-03', ['cu-1', 'cu-now']))).toBe('RECURRENCE_NOT_PROVEN');
    expect(outcome(te('TE-03', ['cu-now']))).toBe('RECURRENCE_NOT_PROVEN');
    // Ahmed -> Manager -> Ahmed -> CURRENT Ahmed: citing the old Ahmed CU cannot manufacture a recurrence, and the latest one has no departure after it.
    const returned: ThreadEstablishmentEvaluationInput = {
      ...input(),
      priorContext: {
        priorCus: [HISTORY_CUS[0], HISTORY_CUS[2], prior('cu-5', 'turn-5', 'USER', 'وأحمد كمان بطل يرد.', 1)],
        focusAttentionHistory: [HISTORY[0], HISTORY[2], { cuId: 'cu-5', attentionKind: 'ATTEND_EXISTING_FOCUS', attentionReason: 'SUBSTANTIVE_ELABORATION', emergingFocusId: F_AHMED }],
        establishedFocusIds: [],
      },
    };
    expect(outcome(te('TE-03', ['cu-1', 'cu-now']), returned)).toBe('RECURRENCE_NOT_PROVEN');
    expect(outcome(te('TE-03', ['cu-5', 'cu-now']), returned)).toBe('RECURRENCE_NOT_PROVEN');
    expect(outcome(te('TE-03', ['cu-1', 'cu-5', 'cu-now']), returned)).toBe('RECURRENCE_NOT_PROVEN');
    expect(outcome(te('TE-03', ['cu-1', 'cu-now']), input({ ...ATTEND_AHMED, reason: 'LOCAL_CLARIFICATION_OR_CORRECTION' }))).toBe('RECURRENCE_NOT_PROVEN');
    expect(outcome(te('TE-03', ['cu-1', 'cu-now'], { text: 'أحمد', occurrence: 1 }))).toBe('INVALID_PROMOTION_PATH');
    // No departure after the latest Ahmed CU: the Manager CUs come before the Ahmed CUs.
    const reordered: ThreadEstablishmentEvaluationInput = {
      ...input(),
      priorContext: {
        priorCus: [HISTORY_CUS[2], HISTORY_CUS[3], HISTORY_CUS[0], HISTORY_CUS[1]],
        focusAttentionHistory: [HISTORY[2], HISTORY[3], HISTORY[0], HISTORY[1]],
        establishedFocusIds: [],
      },
    };
    expect(outcome(te('TE-03', ['cu-1', 'cu-now']), reordered)).toBe('RECURRENCE_NOT_PROVEN');
    expect(outcome(te('TE-03', ['cu-2', 'cu-now']), reordered)).toBe('RECURRENCE_NOT_PROVEN');
    expect(outcome(te('TE-03', ['cu-1', 'cu-2', 'cu-now']), reordered)).toBe('RECURRENCE_NOT_PROVEN');
    // A departure that is itself a local clarification does not count.
    const clarified: ThreadEstablishmentEvaluationInput = {
      ...input(),
      priorContext: {
        priorCus: [HISTORY_CUS[0], HISTORY_CUS[1]],
        focusAttentionHistory: [HISTORY[0], { cuId: 'cu-2', attentionKind: 'NO_INDEPENDENT_FOCUS', attentionReason: 'LOCAL_CLARIFICATION_OR_CORRECTION', emergingFocusId: null }],
        establishedFocusIds: [],
      },
    };
    expect(outcome(te('TE-03', ['cu-1', 'cu-now']), clarified)).toBe('RECURRENCE_NOT_PROVEN');
    // QANDEEL-only recurrence never establishes.
    expect(outcome(te('TE-03', ['cu-2', 'cu-now']), { ...input(), currentCu: { ...CURRENT, sourceRole: 'ASSISTANT' } })).toBe('USER_EVIDENCE_REQUIRED');
  });
});
