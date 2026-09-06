import { disclose, FAMILY_DEPTH, HISTORICAL_SEMANTIC_DEPTHS, resolveInspection } from './historical-disclosure';
import { mapHistoricalProjectionRow } from './historical-projection-mapper';
import { projectionRow } from './historical-projection.fixture.spec';

const knowledge = mapHistoricalProjectionRow(projectionRow());
const THREAD = knowledge.threads[0].id;
const READING = knowledge.readings[0].id;
const GAP = knowledge.gaps[0].id;

describe('Layer B: V = Disclose(K(TC), depth, inspection) (cases 10-16)', () => {
  it('10. depth is monotonic over the five frozen rungs; a rung the depth did not earn is DEPTH_WITHHELD, never empty', () => {
    const world = disclose(knowledge, 'WORLD');
    expect(world.world.threads).toEqual(knowledge.threads);
    expect(world.world.liveFocus).toEqual(knowledge.liveFocus);
    expect([world.thread, world.session, world.analyticalObject, world.sourceProvenance]).toEqual(Array(4).fill({ status: 'DEPTH_WITHHELD' }));
    const thread = disclose(knowledge, 'THREAD');
    expect(thread.thread).toEqual({ status: 'DISCLOSED', value: { threadReadingAppearances: knowledge.threadReadingAppearances } });
    expect(thread.session.status).toBe('DEPTH_WITHHELD');
    const session = disclose(knowledge, 'SESSION');
    expect(session.session).toEqual({ status: 'DISCLOSED', value: { moments: knowledge.moments, emergingFocuses: knowledge.emergingFocuses, questionAppearances: knowledge.questionAppearances } });
    expect(session.analyticalObject.status).toBe('DEPTH_WITHHELD');
    const analytical = disclose(knowledge, 'ANALYTICAL_OBJECT');
    expect(analytical.analyticalObject).toEqual({ status: 'DISCLOSED', value: { readings: knowledge.readings, readingRelations: knowledge.readingRelations, materials: knowledge.materials, gaps: knowledge.gaps, questions: knowledge.questions, confidences: knowledge.confidences } });
    expect(analytical.sourceProvenance.status).toBe('DEPTH_WITHHELD');
    const provenance = disclose(knowledge, 'SOURCE_PROVENANCE');
    expect(provenance.sourceProvenance).toEqual({ status: 'DISCLOSED', value: { evidenceParticipations: knowledge.evidenceParticipations } });
    for (let index = 1; index < HISTORICAL_SEMANTIC_DEPTHS.length; index += 1) {
      const shallow = disclose(knowledge, HISTORICAL_SEMANTIC_DEPTHS[index - 1]);
      const deep = disclose(knowledge, HISTORICAL_SEMANTIC_DEPTHS[index]);
      for (const key of ['thread', 'session', 'analyticalObject', 'sourceProvenance'] as const) {
        if (shallow[key].status === 'DISCLOSED') expect(deep[key]).toEqual(shallow[key]);
      }
    }
  });

  it('11. the header, the revision and the WORLD floor are always present; nothing is added to K(TC)', () => {
    const v = disclose(knowledge, 'SOURCE_PROVENANCE');
    expect([v.sessionId, v.liveHead, v.tc, v.sealed, v.depth, v.revision]).toEqual([knowledge.sessionId, 3, 2, true, 'SOURCE_PROVENANCE', knowledge.revision]);
    expect(Object.keys(v).sort()).toEqual(['analyticalObject', 'depth', 'inspection', 'liveHead', 'revision', 'sealed', 'session', 'sessionId', 'sourceProvenance', 'tc', 'thread', 'world']);
    expect(v.inspection).toBeNull();
    const wire = JSON.stringify(v);
    for (const forbidden of ['score', 'rank', 'centrality', 'label', 'camera', 'viewport', 'sameSp', 'reasonCode', 'created_at', 'hypothesis', 'memory_id']) {
      expect(wire.includes(forbidden)).toBe(false);
    }
  });

  it('12. an identity absent from K(TC) is UNKNOWN_AT_TC regardless of depth', () => {
    for (const depth of HISTORICAL_SEMANTIC_DEPTHS) {
      expect(resolveInspection(knowledge, depth, { family: 'READING', id: 'not-known' })).toEqual({ knowledge: 'UNKNOWN_AT_TC' });
      expect(resolveInspection(knowledge, depth, { family: 'THREAD', id: 'not-known' })).toEqual({ knowledge: 'UNKNOWN_AT_TC' });
    }
  });

  it('13. a known identity at its then-current version is KNOWN_AND_CURRENT; the requested depth decides renderable vs withheld', () => {
    expect(resolveInspection(knowledge, 'WORLD', { family: 'READING', id: READING })).toEqual({
      knowledge: 'KNOWN_AND_CURRENT_AT_TC', noncurrent: null, context: 'NOT_REQUESTED', disclosure: 'AVAILABLE_BUT_DEPTH_WITHHELD', requiredDepth: 'ANALYTICAL_OBJECT',
    });
    expect(resolveInspection(knowledge, 'ANALYTICAL_OBJECT', { family: 'READING', id: READING, version: 3 })).toEqual({
      knowledge: 'KNOWN_AND_CURRENT_AT_TC', noncurrent: null, context: 'NOT_REQUESTED', disclosure: 'AVAILABLE_AND_RENDERABLE', requiredDepth: 'ANALYTICAL_OBJECT',
    });
    expect(resolveInspection(knowledge, 'WORLD', { family: 'THREAD', id: THREAD }).knowledge).toBe('KNOWN_AND_CURRENT_AT_TC');
    expect((resolveInspection(knowledge, 'WORLD', { family: 'THREAD', id: THREAD }) as { disclosure: string }).disclosure).toBe('AVAILABLE_AND_RENDERABLE');
    expect(FAMILY_DEPTH.THREAD).toBe('WORLD');
    expect(FAMILY_DEPTH.MOMENT).toBe('SESSION');
  });

  it('14. a known identity at another version is KNOWN_NONCURRENT: PREVALID beyond the then-current version, SUPERSEDED before it', () => {
    expect(resolveInspection(knowledge, 'ANALYTICAL_OBJECT', { family: 'READING', id: READING, version: 5 })).toMatchObject({ knowledge: 'KNOWN_NONCURRENT_AT_TC', noncurrent: 'PREVALID' });
    expect(resolveInspection(knowledge, 'ANALYTICAL_OBJECT', { family: 'READING', id: READING, version: 1 })).toMatchObject({ knowledge: 'KNOWN_NONCURRENT_AT_TC', noncurrent: 'SUPERSEDED' });
    expect(resolveInspection(knowledge, 'ANALYTICAL_OBJECT', { family: 'GAP', id: GAP, version: 2 })).toMatchObject({ knowledge: 'KNOWN_NONCURRENT_AT_TC', noncurrent: 'PREVALID' });
    // A version request on an unversioned family is not a version claim.
    expect(resolveInspection(knowledge, 'WORLD', { family: 'THREAD', id: THREAD, version: 7 })).toMatchObject({ knowledge: 'KNOWN_AND_CURRENT_AT_TC', noncurrent: null });
  });

  it('15. a requested contextual appearance is answered independently of identity knowledge and raises the required depth', () => {
    const available = resolveInspection(knowledge, 'THREAD', { family: 'READING', id: READING, appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } });
    expect(available).toEqual({ knowledge: 'KNOWN_AND_CURRENT_AT_TC', noncurrent: null, context: 'CONTEXT_AVAILABLE_AT_TC', disclosure: 'AVAILABLE_BUT_DEPTH_WITHHELD', requiredDepth: 'ANALYTICAL_OBJECT' });
    const unavailable = resolveInspection(knowledge, 'SOURCE_PROVENANCE', { family: 'READING', id: READING, appearance: { kind: 'THREAD_READING', bindingId: 'binding-later' } });
    expect(unavailable).toMatchObject({ knowledge: 'KNOWN_AND_CURRENT_AT_TC', context: 'CONTEXT_UNAVAILABLE_AT_TC', disclosure: 'AVAILABLE_AND_RENDERABLE' });
    const thread = resolveInspection(knowledge, 'WORLD', { family: 'THREAD', id: THREAD, appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } });
    expect(thread).toMatchObject({ context: 'CONTEXT_AVAILABLE_AT_TC', requiredDepth: 'THREAD', disclosure: 'AVAILABLE_BUT_DEPTH_WITHHELD' });
    const question = resolveInspection(knowledge, 'SESSION', { family: 'GAP', id: GAP, appearance: { kind: 'QUESTION_TURN', bindingId: 'qbinding-1' } });
    expect(question).toMatchObject({ context: 'CONTEXT_AVAILABLE_AT_TC', requiredDepth: 'ANALYTICAL_OBJECT' });
    // An appearance whose kind does not fit the family is never available.
    expect(resolveInspection(knowledge, 'SESSION', { family: 'MATERIAL', id: knowledge.materials[0].id, appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } })).toMatchObject({ context: 'CONTEXT_UNAVAILABLE_AT_TC' });
  });

  it('16. disclosure is pure: the same K(TC) and depth always give the same V, and K(TC) is not mutated', () => {
    const frozen = JSON.stringify(knowledge);
    expect(disclose(knowledge, 'SESSION', { family: 'MOMENT', id: 'cu-1' })).toEqual(disclose(knowledge, 'SESSION', { family: 'MOMENT', id: 'cu-1' }));
    expect(JSON.stringify(knowledge)).toBe(frozen);
  });
});
