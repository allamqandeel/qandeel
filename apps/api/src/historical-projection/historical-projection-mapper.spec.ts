import { mapHistoricalProjectionRow } from './historical-projection-mapper';
import { HistoricalProjectionIntegrityError } from './historical-projection.types';
import { GAP, MATERIAL, READING, SESSION, THREAD, FOCUS, projectionRow } from './historical-projection.fixture.spec';

const rejects = (row: unknown, code: HistoricalProjectionIntegrityError['code'], detail: RegExp) => {
  let caught: unknown;
  try { mapHistoricalProjectionRow(row); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(HistoricalProjectionIntegrityError);
  expect((caught as HistoricalProjectionIntegrityError).code).toBe(code);
  expect((caught as HistoricalProjectionIntegrityError).detail).toMatch(detail);
};

describe('the Layer-A row becomes typed knowledge (cases 1-9)', () => {
  it('1. maps every family by name, renames the canonical Hypothesis to Reading and the Memory to Material, and drops the internal same-SP sequence', () => {
    const knowledge = mapHistoricalProjectionRow(projectionRow());
    expect([knowledge.sessionId, knowledge.liveHead, knowledge.tc, knowledge.sealed]).toEqual([SESSION, 3, 2, true]);
    expect(knowledge.revision).toEqual({ liveHead: 3, worldVersion: 12, pendingExpiries: 1 });
    expect(JSON.stringify(knowledge)).not.toContain('sameSpEventSequence');
    expect(JSON.stringify(knowledge)).not.toContain('reasonCode');
    expect(knowledge.liveFocus).toEqual({ value: { kind: 'THREAD', threadId: THREAD }, atSp: 1 });
    expect(knowledge.threads[0]).toEqual({ id: THREAD, establishmentPath: 'TE-01', establishedInSession: true, establishedSp: 1, groundingEmergingFocusId: FOCUS, home: { x: '0', y: '-3' }, state: 'ESTABLISHED_ACTIVE' });
    expect(knowledge.threadReadingAppearances).toEqual([{ bindingId: 'binding-1', threadId: THREAD, readingId: READING, boundSp: 2, current: true }]);
    expect(knowledge.evidenceParticipations).toEqual([{ readingId: READING, materialId: MATERIAL, evidenceId: `memory:${MATERIAL}`, role: 'SUPPORTING' }]);
    expect(knowledge.materials[0].supersedesMaterialId).toBeNull();
    expect(knowledge.questions[0].gapId).toBe(GAP);
    expect(knowledge.questionAppearances[0]).toMatchObject({ gapId: GAP, readingId: READING, readingVersion: 3, appearedAtSp: 2 });
    expect(knowledge.confidences.map((c) => [c.id, c.resolution])).toEqual([['confidence-1', 'CURRENT'], ['confidence-0', 'SUPERSEDED']]);
    expect(knowledge.emergingFocuses[0].state).toBe('EMERGING_PREGEOGRAPHIC');
  });

  it('2. a Thread known only through the world baseline has no Session-local state here', () => {
    const knowledge = mapHistoricalProjectionRow(projectionRow({
      threads: [{ id: THREAD, establishmentPath: 'TE-02', establishedInSession: false, establishedSp: null, groundingEmergingFocusId: null, home: { x: '4', y: '4' }, sessionLifecycle: null }],
      emerging_focuses: [{ id: FOCUS, startedSp: 1, lastAttentionSp: null, promotedThreadId: null }],
    }));
    expect(knowledge.threads[0].state).toBe('ESTABLISHED_UNBOUND_IN_SESSION');
    expect(knowledge.threads[0].establishedSp).toBeNull();
  });

  it('3. an unknown key, a missing family and a non-object are malformed transport, never knowledge', () => {
    rejects({ ...projectionRow(), extra: 1 }, 'HISTORICAL_PROJECTION_ROW_MALFORMED', /unknown key extra/u);
    const { confidences: _dropped, ...withoutConfidences } = projectionRow();
    rejects(withoutConfidences, 'HISTORICAL_PROJECTION_ROW_MALFORMED', /missing confidences/u);
    rejects(null, 'HISTORICAL_PROJECTION_ROW_MALFORMED', /must be an object/u);
    rejects(projectionRow({ threads: [{ ...(projectionRow().threads as Record<string, unknown>[])[0], label: 'manager' }] }), 'HISTORICAL_PROJECTION_ROW_MALFORMED', /unknown key label/u);
  });

  it('4. a Home coordinate is exact integer text, never a float', () => {
    rejects(projectionRow({ threads: [{ ...(projectionRow().threads as Record<string, unknown>[])[0], home: { x: 0, y: '-3' } }] }), 'HISTORICAL_PROJECTION_ROW_MALFORMED', /home\.x: must be exact integer text/u);
    rejects(projectionRow({ threads: [{ ...(projectionRow().threads as Record<string, unknown>[])[0], home: { x: '1.5', y: '-3' } }] }), 'HISTORICAL_PROJECTION_ROW_MALFORMED', /home\.x/u);
  });

  it('5. the header is coherent: TC <= LH, sealed means TC < LH, the revision names the same Live Head, Moments are exactly SP(1)..SP(TC)', () => {
    rejects(projectionRow({ tc: 4 }), 'HISTORICAL_PROJECTION_INCOHERENT', /TC beyond the Live Head/u);
    rejects(projectionRow({ sealed: false }), 'HISTORICAL_PROJECTION_INCOHERENT', /sealed means TC < LH/u);
    rejects(projectionRow({ revision: { liveHead: 4, sameSpEventSequence: '4', worldVersion: 12, pendingExpiries: 1 } }), 'HISTORICAL_PROJECTION_INCOHERENT', /different Live Head/u);
    rejects(projectionRow({ moments: (projectionRow().moments as unknown[]).slice(0, 1) }), 'HISTORICAL_PROJECTION_INCOHERENT', /not exactly SP\(1\) \.\. SP\(TC\)/u);
  });

  it('6. no family may name a Session Position beyond TC or an endpoint that is not known at TC', () => {
    rejects(projectionRow({ live_focus: { kind: 'THREAD', ref: THREAD, atSp: 3, reasonCode: null } }), 'HISTORICAL_PROJECTION_INCOHERENT', /effective beyond TC/u);
    rejects(projectionRow({ thread_reading_appearances: [{ bindingId: 'b', threadId: THREAD, hypothesisId: 'unknown-reading', boundSp: 2, current: true }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /endpoint that is not known/u);
    rejects(projectionRow({ reading_relations: [{ a: READING, b: 'zzzz-unknown' }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /endpoint that is not known/u);
    rejects(projectionRow({ evidence_participations: [{ hypothesisId: READING, evidenceId: 'memory:other', memoryId: MATERIAL, role: 'SUPPORTING' }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /names another Material/u);
    rejects(projectionRow({ question_appearances: [{ ...(projectionRow().question_appearances as Record<string, unknown>[])[0], appearedAtSp: 3 }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /appeared beyond TC/u);
    rejects(projectionRow({ emerging_focuses: [{ id: FOCUS, startedSp: 1, lastAttentionSp: 2, promotedThreadId: 'unknown-thread' }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /promoted to a Thread that is not known/u);
  });

  it('7. Z66-04 is re-derived: PREVALID only beyond the then-current version, CURRENT only at it', () => {
    const base = (projectionRow().confidences as Record<string, unknown>[])[0];
    rejects(projectionRow({ confidences: [{ ...base, targetVersion: 4, resolution: 'CURRENT' }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /not PREVALID/u);
    rejects(projectionRow({ confidences: [{ ...base, targetVersion: 2, resolution: 'PREVALID' }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /PREVALID for a version already known/u);
    rejects(projectionRow({ confidences: [{ ...base, targetVersion: 2, resolution: 'CURRENT' }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /CURRENT for a version other than/u);
    expect(mapHistoricalProjectionRow(projectionRow({ confidences: [{ ...base, targetVersion: 4, resolution: 'PREVALID' }] })).confidences[0].resolution).toBe('PREVALID');
  });

  it('8. R-C5 is re-derived: exactly the SP mapping carries a Session Position, and an expiry inside SP <= TC is never ACTIVE', () => {
    const material = (projectionRow().materials as Record<string, unknown>[])[0];
    rejects(projectionRow({ materials: [{ ...material, expiry: { mapping: 'PENDING', sp: 2 } }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /exactly the SP mapping/u);
    rejects(projectionRow({ materials: [{ ...material, expiry: { mapping: 'SP', sp: 1 } }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /expired inside a Session Position <= TC yet ACTIVE/u);
    expect(mapHistoricalProjectionRow(projectionRow({ materials: [{ ...material, statusAtTc: 'EXPIRED', expiry: { mapping: 'SP', sp: 1 } }] })).materials[0].statusAtTc).toBe('EXPIRED');
    expect(mapHistoricalProjectionRow(projectionRow({ materials: [{ ...material, expiry: { mapping: 'SP', sp: 3 } }] })).materials[0].statusAtTc).toBe('ACTIVE');
  });

  it('9. a Reading carries its creation step and no lineage beyond its then-current version', () => {
    const reading = (projectionRow().readings as Record<string, unknown>[])[0];
    rejects(projectionRow({ readings: [{ ...reading, lineage: [] }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /creation step/u);
    rejects(projectionRow({ readings: [{ ...reading, versionAtTc: 2 }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /lineage beyond the then-current version/u);
    // T-03C R2: subject groundings are their own family - anchored at their own
    // SP, naming a focus known at TC, never defaulted and never duplicated.
    expect(mapHistoricalProjectionRow(projectionRow()).readings[0].subjectGroundings).toEqual([{ emergingFocusId: FOCUS, groundedAtSp: 2 }]);
    expect(mapHistoricalProjectionRow(projectionRow({ readings: [{ ...reading, subjectGroundings: [] }] })).readings[0].subjectGroundings).toEqual([]);
    rejects(projectionRow({ readings: [{ ...reading, subjectGroundings: [{ emergingFocusId: FOCUS, groundedAtSp: 3 }] }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /grounded beyond TC/u);
    rejects(projectionRow({ readings: [{ ...reading, subjectGroundings: [{ emergingFocusId: 'focus-unknown', groundedAtSp: 2 }] }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /Emerging Focus that is not known at TC/u);
    rejects(projectionRow({ readings: [{ ...reading, subjectGroundings: [{ emergingFocusId: FOCUS, groundedAtSp: 1 }, { emergingFocusId: FOCUS, groundedAtSp: 2 }] }] }), 'HISTORICAL_PROJECTION_INCOHERENT', /subject grounding appears twice/u);
    const { subjectGroundings: _dropped, ...ungrounded } = reading;
    rejects(projectionRow({ readings: [ungrounded] }), 'HISTORICAL_PROJECTION_ROW_MALFORMED', /readings\[0\]/u);
    rejects(projectionRow({ readings: [{ ...reading, subjectGroundings: [{ emergingFocusId: FOCUS, groundedAtSp: 2, threadId: 'x' }] }] }), 'HISTORICAL_PROJECTION_ROW_MALFORMED', /subjectGroundings\[0\]/u);
  });
});
