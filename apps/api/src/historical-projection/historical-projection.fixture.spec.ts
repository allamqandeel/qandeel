import { mapHistoricalProjectionRow } from './historical-projection-mapper';

export const SESSION = '33333333-3333-4333-8333-333333333333';
export const THREAD = 'afc4fd81-fe54-5738-9545-e1053044d919';
export const FOCUS = '4ef8538d-ddda-5e11-b7d9-052be85de59a';
export const READING = '11111111-2222-4333-8444-555555555555';
export const MATERIAL = '66666666-6666-4666-8666-666666666666';
export const GAP = '77777777-7777-4777-8777-777777777777';
export const TURN = '88888888-8888-4888-8888-888888888888';

/** A coherent Layer-A row exactly as `get_session_historical_projection_v1` returns it at TC = 2 of a 3-Moment Session. */
export function projectionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session_id: SESSION, live_head: 3, tc: 2, sealed: true,
    revision: { liveHead: 3, sameSpEventSequence: '4', worldVersion: 12, pendingExpiries: 1 },
    moments: [
      { id: 'cu-1', sp: 1, sourceRole: 'USER', sourceTurnId: TURN, ordinalWithinTurn: 0, committedText: 'المدير بقى بيتعامل معايا بشكل غريب.', spanStart: 0, spanEnd: 34 },
      { id: 'cu-2', sp: 2, sourceRole: 'USER', sourceTurnId: TURN, ordinalWithinTurn: 1, committedText: 'أحمد نفسه بدأ يقلقني.', spanStart: 35, spanEnd: 56 },
    ],
    emerging_focuses: [{ id: FOCUS, startedSp: 1, lastAttentionSp: 2, promotedThreadId: THREAD }],
    live_focus: { kind: 'THREAD', ref: THREAD, atSp: 1, reasonCode: 'NEW_INDEPENDENT_FOCUS' },
    threads: [{ id: THREAD, establishmentPath: 'TE-01', establishedInSession: true, establishedSp: 1, groundingEmergingFocusId: FOCUS, home: { x: '0', y: '-3' }, sessionLifecycle: 'ACTIVE' }],
    thread_reading_appearances: [{ bindingId: 'binding-1', threadId: THREAD, hypothesisId: READING, boundSp: 2, current: true }],
    readings: [{ id: READING, statement: 'the manager avoids direct feedback', type: 'CAUSAL', domain: 'GENERAL', scope: `CONVERSATION_SESSION:${SESSION}`, origin: 'SYSTEM_GENERATED',
      assumptions: [], disconfirmingConditions: ['direct feedback observed'], statusAtTc: 'ACTIVE', versionAtTc: 3,
      lineage: [{ kind: 'CREATED', fromStatus: null, toStatus: 'CANDIDATE', fromVersion: null, toVersion: 1 }, { kind: 'VERSION_ADVANCED', fromStatus: 'CANDIDATE', toStatus: 'CANDIDATE', fromVersion: 1, toVersion: 2 },
        { kind: 'STATUS_TRANSITION', fromStatus: 'CANDIDATE', toStatus: 'ACTIVE', fromVersion: 2, toVersion: 3 }],
      subjectGroundings: [{ emergingFocusId: FOCUS, groundedAtSp: 2 }] }],
    reading_relations: [],
    evidence_participations: [{ hypothesisId: READING, evidenceId: `memory:${MATERIAL}`, memoryId: MATERIAL, role: 'SUPPORTING' }],
    materials: [{ id: MATERIAL, type: 'GOAL', content: 'wants a calmer team', source: 'USER_STATED', confidence: 1, importance: 0.8, version: 1, supersedesMemoryId: null, supersededByMemoryId: null,
      statusAtTc: 'ACTIVE', expiry: { mapping: 'PENDING', sp: null } }],
    gaps: [{ id: GAP, informationNeeded: 'the timeframe', whyItMatters: null, userAnswerability: 'USER_CAN_ANSWER', preferredQuestionType: 'FACT_FINDING', readingIds: [READING], statusAtTc: 'OPEN', openEpochAtTc: 1, closureReasonAtTc: null }],
    questions: [{ id: 'question-1', informationGapId: GAP, questionText: 'When did it start?', questionType: 'FACT_FINDING', answerFormat: 'FREE_TEXT', informationNeeded: 'the timeframe', targetReadingIds: [READING] }],
    question_appearances: [{ bindingId: 'qbinding-1', informationGapId: GAP, gapOpenEpoch: 1, hypothesisId: READING, hypothesisVersion: 3, questionType: 'FACT_FINDING', sourceTurnId: TURN, assistantTurnId: null, appearedAtSp: 2 }],
    confidences: [{ id: 'confidence-1', targetReadingId: READING, targetVersion: 3, missingInformationCodes: ['UNVERIFIED_ASSUMPTIONS'], supportingEvidenceIds: [`memory:${MATERIAL}`], contradictingEvidenceIds: [], assumptions: [], alternativeReadingIds: [], resolution: 'CURRENT' },
      { id: 'confidence-0', targetReadingId: READING, targetVersion: 2, missingInformationCodes: [], supportingEvidenceIds: [], contradictingEvidenceIds: [], assumptions: [], alternativeReadingIds: [], resolution: 'SUPERSEDED' }],
    ...overrides,
  };
}

describe('the shared projection fixture', () => {
  it('is a coherent Layer-A row', () => {
    expect(mapHistoricalProjectionRow(projectionRow()).tc).toBe(2);
  });
});
