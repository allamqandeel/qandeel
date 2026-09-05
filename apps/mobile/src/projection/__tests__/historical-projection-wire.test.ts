import { decodeHistoricalDisclosure, decodeUnavailableBody } from '../historical-projection-wire';

const SESSION = 'session-1';
const THREAD = 'thread-manager';
const READING = 'reading-1';
const MATERIAL = 'material-1';
const GAP = 'gap-1';

/** A coherent SOURCE_PROVENANCE disclosure at TC = 2 of a 3-Moment Session, exactly as the server emits it. */
export function disclosure(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionId: SESSION, liveHead: 3, tc: 2, sealed: true, depth: 'SOURCE_PROVENANCE',
    revision: { liveHead: 3, worldVersion: 12, pendingExpiries: 1 },
    world: {
      threads: [{ id: THREAD, establishmentPath: 'TE-01', establishedInSession: true, establishedSp: 1, groundingEmergingFocusId: 'focus-manager', home: { x: '0', y: '-3' }, state: 'ESTABLISHED_ACTIVE' }],
      liveFocus: { value: { kind: 'THREAD', threadId: THREAD }, atSp: 1 },
    },
    thread: { status: 'DISCLOSED', value: { threadReadingAppearances: [{ bindingId: 'binding-1', threadId: THREAD, readingId: READING, boundSp: 2, current: true }] } },
    session: { status: 'DISCLOSED', value: {
      moments: [
        { id: 'cu-1', sp: 1, sourceRole: 'USER', sourceTurnId: 'turn-1', ordinalWithinTurn: 0, committedText: 'المدير بقى بيتعامل معايا بشكل غريب.', spanStart: 0, spanEnd: 34 },
        { id: 'cu-2', sp: 2, sourceRole: 'USER', sourceTurnId: 'turn-1', ordinalWithinTurn: 1, committedText: 'أحمد نفسه بدأ يقلقني.', spanStart: 35, spanEnd: 56 },
      ],
      emergingFocuses: [{ id: 'focus-manager', startedSp: 1, lastAttentionSp: 2, promotedThreadId: THREAD, state: 'EMERGING_PREGEOGRAPHIC' }],
      questionAppearances: [{ bindingId: 'qbinding-1', gapId: GAP, gapOpenEpoch: 1, readingId: READING, readingVersion: 3, questionType: 'FACT_FINDING', sourceTurnId: 'turn-1', assistantTurnId: null, appearedAtSp: 2 }],
    } },
    analyticalObject: { status: 'DISCLOSED', value: {
      readings: [{ id: READING, statement: 'the manager avoids direct feedback', type: 'CAUSAL', domain: 'GENERAL', scope: `CONVERSATION_SESSION:${SESSION}`, origin: 'SYSTEM_GENERATED', assumptions: [], disconfirmingConditions: [],
        statusAtTc: 'ACTIVE', versionAtTc: 3, lineage: [{ kind: 'CREATED', fromStatus: null, toStatus: 'CANDIDATE', fromVersion: null, toVersion: 1 }, { kind: 'STATUS_TRANSITION', fromStatus: 'CANDIDATE', toStatus: 'ACTIVE', fromVersion: 2, toVersion: 3 }] }],
      readingRelations: [],
      materials: [{ id: MATERIAL, type: 'GOAL', content: 'wants a calmer team', source: 'USER_STATED', confidence: 1, importance: 0.8, version: 1, supersedesMaterialId: null, supersededByMaterialId: null, statusAtTc: 'ACTIVE', expiry: { mapping: 'PENDING', sp: null } }],
      gaps: [{ id: GAP, informationNeeded: 'the timeframe', whyItMatters: null, userAnswerability: null, preferredQuestionType: 'FACT_FINDING', readingIds: [READING], statusAtTc: 'OPEN', openEpochAtTc: 1, closureReasonAtTc: null }],
      questions: [{ id: 'question-1', gapId: GAP, questionText: 'When did it start?', questionType: 'FACT_FINDING', answerFormat: 'FREE_TEXT', informationNeeded: 'the timeframe', targetReadingIds: [READING] }],
      confidences: [{ id: 'confidence-1', readingId: READING, targetVersion: 3, resolution: 'CURRENT', missingInformationCodes: ['UNVERIFIED_ASSUMPTIONS'], supportingEvidenceIds: [`memory:${MATERIAL}`], contradictingEvidenceIds: [], assumptions: [], alternativeReadingIds: [] }],
    } },
    sourceProvenance: { status: 'DISCLOSED', value: { evidenceParticipations: [{ readingId: READING, materialId: MATERIAL, evidenceId: `memory:${MATERIAL}`, role: 'SUPPORTING' }] } },
    inspection: null,
    ...overrides,
  };
}

const withheld = { status: 'DEPTH_WITHHELD' };
const worldOnly = (overrides: Record<string, unknown> = {}) => disclosure({ depth: 'WORLD', thread: withheld, session: withheld, analyticalObject: withheld, sourceProvenance: withheld, ...overrides });

describe('historical disclosure wire validation', () => {
  it('decodes a full SOURCE_PROVENANCE disclosure exactly', () => {
    const decoded = decodeHistoricalDisclosure(disclosure());
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.sealed).toBe(true);
    expect(decoded.value.world.threads[0].state).toBe('ESTABLISHED_ACTIVE');
    expect(decoded.value.session.status).toBe('DISCLOSED');
    expect(decoded.value.inspection).toBeNull();
  });

  it('decodes a WORLD disclosure with every deeper rung DEPTH_WITHHELD - withheld is not empty and not unknown', () => {
    const decoded = decodeHistoricalDisclosure(worldOnly());
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.thread).toEqual(withheld);
    expect(decoded.value.analyticalObject).toEqual(withheld);
    expect(decoded.value.world.threads).toHaveLength(1);
  });

  it('refuses a rung that disagrees with the declared depth in either direction', () => {
    expect(decodeHistoricalDisclosure(disclosure({ depth: 'WORLD' }))).toMatchObject({ ok: false, reason: 'INVALID_RUNG' });
    expect(decodeHistoricalDisclosure(worldOnly({ depth: 'THREAD' }))).toMatchObject({ ok: false, reason: 'INVALID_RUNG' });
    expect(decodeHistoricalDisclosure(disclosure({ thread: { status: 'DISCLOSED' } }))).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
    expect(decodeHistoricalDisclosure(disclosure({ thread: { status: 'EMPTY' } }))).toMatchObject({ ok: false, reason: 'INVALID_RUNG' });
  });

  it('refuses an unknown key anywhere (allowlist, never a blacklist)', () => {
    expect(decodeHistoricalDisclosure({ ...disclosure(), label: 'x' })).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
    const world = disclosure().world as { threads: Record<string, unknown>[]; liveFocus: unknown };
    expect(decodeHistoricalDisclosure(disclosure({ world: { ...world, threads: [{ ...world.threads[0], label: 'manager' }] } }))).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
    expect(decodeHistoricalDisclosure(disclosure({ revision: { liveHead: 3, worldVersion: 12, pendingExpiries: 1, sameSpEventSequence: 4 } }))).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
  });

  it('refuses an incoherent header: TC beyond LH, sealed disagreeing with TC < LH, a foreign revision, an unknown depth', () => {
    expect(decodeHistoricalDisclosure(disclosure({ tc: 4 }))).toMatchObject({ ok: false, reason: 'INCOHERENT_FAMILY' });
    expect(decodeHistoricalDisclosure(disclosure({ sealed: false }))).toMatchObject({ ok: false, reason: 'INCOHERENT_HEADER' });
    expect(decodeHistoricalDisclosure(disclosure({ revision: { liveHead: 4, worldVersion: 12, pendingExpiries: 1 } }))).toMatchObject({ ok: false, reason: 'INCOHERENT_HEADER' });
    expect(decodeHistoricalDisclosure(disclosure({ depth: 'READING' }))).toMatchObject({ ok: false, reason: 'INVALID_DEPTH' });
    expect(decodeHistoricalDisclosure(disclosure({ liveHead: 0 }))).toMatchObject({ ok: false, reason: 'INVALID_SESSION_POSITION' });
    expect(decodeHistoricalDisclosure(disclosure({ tc: 2.5 }))).toMatchObject({ ok: false, reason: 'INVALID_SESSION_POSITION' });
  });

  it('refuses a family that names a Session Position beyond TC or an endpoint not known at TC', () => {
    const session = (disclosure().session as { value: Record<string, unknown> }).value;
    expect(decodeHistoricalDisclosure(disclosure({ session: { status: 'DISCLOSED', value: { ...session, moments: (session.moments as unknown[]).slice(0, 1) } } }))).toMatchObject({ ok: false, reason: 'INCOHERENT_FAMILY' });
    expect(decodeHistoricalDisclosure(disclosure({ session: { status: 'DISCLOSED', value: { ...session, questionAppearances: [{ ...(session.questionAppearances as Record<string, unknown>[])[0], appearedAtSp: 3 }] } } }))).toMatchObject({ ok: false, reason: 'INCOHERENT_FAMILY' });
    const analytical = (disclosure().analyticalObject as { value: Record<string, unknown> }).value;
    expect(decodeHistoricalDisclosure(disclosure({ analyticalObject: { status: 'DISCLOSED', value: { ...analytical, readingRelations: [{ a: READING, b: 'zzz-unknown' }] } } }))).toMatchObject({ ok: false, reason: 'INCOHERENT_FAMILY' });
    const confidence = (analytical.confidences as Record<string, unknown>[])[0];
    expect(decodeHistoricalDisclosure(disclosure({ analyticalObject: { status: 'DISCLOSED', value: { ...analytical, confidences: [{ ...confidence, targetVersion: 5, resolution: 'CURRENT' }] } } }))).toMatchObject({ ok: false, reason: 'INCOHERENT_FAMILY' });
    const material = (analytical.materials as Record<string, unknown>[])[0];
    expect(decodeHistoricalDisclosure(disclosure({ analyticalObject: { status: 'DISCLOSED', value: { ...analytical, materials: [{ ...material, expiry: { mapping: 'SP', sp: 1 } }] } } }))).toMatchObject({ ok: false, reason: 'INCOHERENT_FAMILY' });
    const world = disclosure().world as { threads: unknown[]; liveFocus: unknown };
    expect(decodeHistoricalDisclosure(disclosure({ world: { ...world, liveFocus: { value: { kind: 'THREAD', threadId: 'unknown-thread' }, atSp: 1 } } }))).toMatchObject({ ok: false, reason: 'INCOHERENT_FAMILY' });
  });

  it('refuses a vocabulary outside the closed sets and a Home that is not exact integer text', () => {
    const world = disclosure().world as { threads: Record<string, unknown>[]; liveFocus: unknown };
    expect(decodeHistoricalDisclosure(disclosure({ world: { ...world, threads: [{ ...world.threads[0], state: 'ACTIVE' }] } }))).toMatchObject({ ok: false, reason: 'INVALID_VOCABULARY' });
    expect(decodeHistoricalDisclosure(disclosure({ world: { ...world, threads: [{ ...world.threads[0], home: { x: 0, y: '-3' } }] } }))).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
    expect(decodeHistoricalDisclosure(disclosure({ world: { ...world, liveFocus: { value: { kind: 'MAP_FOCUS', threadId: THREAD }, atSp: 1 } } }))).toMatchObject({ ok: false, reason: 'INVALID_VOCABULARY' });
  });

  it('decodes the three inspection answers and refuses an incoherent one', () => {
    expect(decodeHistoricalDisclosure(disclosure({ inspection: { knowledge: 'UNKNOWN_AT_TC' } }))).toMatchObject({ ok: true, value: { inspection: { knowledge: 'UNKNOWN_AT_TC' } } });
    const known = { knowledge: 'KNOWN_NONCURRENT_AT_TC', noncurrent: 'PREVALID', context: 'CONTEXT_UNAVAILABLE_AT_TC', disclosure: 'AVAILABLE_BUT_DEPTH_WITHHELD', requiredDepth: 'ANALYTICAL_OBJECT' };
    expect(decodeHistoricalDisclosure(disclosure({ inspection: known }))).toMatchObject({ ok: true, value: { inspection: known } });
    expect(decodeHistoricalDisclosure(disclosure({ inspection: { ...known, knowledge: 'KNOWN_AND_CURRENT_AT_TC' } }))).toMatchObject({ ok: false, reason: 'INCOHERENT_HEADER' });
    expect(decodeHistoricalDisclosure(disclosure({ inspection: { ...known, requiredDepth: 'READING' } }))).toMatchObject({ ok: false, reason: 'INVALID_DEPTH' });
    expect(decodeHistoricalDisclosure(disclosure({ inspection: { knowledge: 'UNKNOWN_AT_TC', extra: true } }))).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
  });

  it('decodes exactly the five typed refusal codes and nothing else', () => {
    for (const code of ['HISTORICAL_COVERAGE_UNAVAILABLE', 'LIVE_HEAD_NOT_ESTABLISHED', 'HISTORICAL_BASELINE_MISSING', 'SESSION_POSITION_NOT_ADDRESSABLE', 'SESSION_NOT_VISIBLE']) {
      expect(decodeUnavailableBody({ code })).toEqual({ ok: true, value: { code } });
    }
    expect(decodeUnavailableBody({ code: 'UNKNOWN_AT_TC' })).toMatchObject({ ok: false, reason: 'INVALID_VOCABULARY' });
    expect(decodeUnavailableBody({ code: 'HISTORICAL_COVERAGE_UNAVAILABLE', message: 'x' })).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
    expect(decodeUnavailableBody('HISTORICAL_COVERAGE_UNAVAILABLE')).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
  });
});
