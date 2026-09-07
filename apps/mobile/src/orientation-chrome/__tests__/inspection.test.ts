/**
 * T-08 — D: `IF_ref` stays exact; `IF_render` obeys the disclosure.
 *
 * The ten render states are ten different facts, and the tests below are written so that collapsing
 * any two of them fails: an unknown identity must leak nothing at all, a withheld rung must not read
 * as absence, an unavailable context must not be substituted, a noncurrent version must keep its
 * lineage intent, and the five technical states must never become statements about the world.
 */
import { inspectionStatement } from '../InspectionOrientation';
import { contextLineage, inspectionRender } from '../inspection-orientation';
import { orientationModel } from '../model';
import { contextAt, fetched, historicalStore, inspect, known, projectionFor, TWO_CONTEXT_WORLD, unknownAtTc, withInspection } from '../__fixtures__/chrome';

/** A real `IF_ref`, minted by the real inspection act against the real disclosure. */
function readerInspecting(over: Parameters<typeof known>[0] | null = {}) {
  const store = historicalStore();
  const ref = inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1' });
  const disclosure = withInspection(TWO_CONTEXT_WORLD(), over === null ? unknownAtTc() : known(over));
  return { store, ref, model: orientationModel(store, projectionFor(store, fetched(disclosure))) };
}

describe('OC08-D — knowledge', () => {
  it('D31 — an identity unknown at TC leaks no family, no id, no version and no lineage', () => {
    const { model } = readerInspecting(null);
    expect(model.inspection.requested).toBe(true);
    // The member has no fields at all: there is nothing on it that could name the target.
    expect(model.inspection.render).toEqual({ kind: 'IDENTITY_UNKNOWN_AT_TC' });
    expect(Object.keys(model.inspection.render)).toEqual(['kind']);
    const statement = inspectionStatement(model.inspection.render);
    expect(statement).not.toContain('reading-1');
    expect(statement).not.toContain('READING');
    // No place is held for it either: no lineage and no contextual chooser.
    expect(model.context.lineage).toEqual([]);
    expect(model.context.appearances).toEqual([]);
    expect(model.context.choiceAvailable).toBe(false);
  });

  it('D32 — an unknown identity keeps every safe generic recovery route', () => {
    const { model } = readerInspecting(null);
    const available = model.returns.opportunities.filter((candidate) => candidate.available).map((candidate) => candidate.id);
    expect(available).toContain('RETURN_LIVE_HEAD');
    expect(available).toContain('RETURN_WORLD');
    expect(available).toContain('GO_LIVE_AND_LOCATE');
  });

  it('D33 — a known, renderable identity may be named, with the exact requested lineage', () => {
    const { model } = readerInspecting({});
    expect(model.inspection.render).toMatchObject({ kind: 'RENDERABLE', family: 'READING', id: 'reading-1', versionIntent: null, noncurrent: null });
    expect(inspectionStatement(model.inspection.render)).toContain('reading-1');
  });

  it('D34, D35 — a noncurrent version keeps its lineage intent and is never called wrong or deleted', () => {
    for (const [noncurrent, expected] of [
      ['SUPERSEDED', 'It had already been replaced by this moment.'],
      ['PREVALID', 'It was not yet the current one at this moment.'],
    ] as const) {
      const { model } = readerInspecting({ knowledge: 'KNOWN_NONCURRENT_AT_TC', noncurrent });
      expect(model.inspection.render).toMatchObject({ kind: 'RENDERABLE', noncurrent });
      const statement = inspectionStatement(model.inspection.render);
      expect(statement).toContain(expected);
      for (const forbidden of ['wrong', 'deleted', 'never valid', 'invalid', 'does not exist']) {
        expect(statement.toLowerCase()).not.toContain(forbidden);
      }
    }
  });
});

describe('OC08-D — context and depth', () => {
  it('D36, D37 — an unavailable context withholds its name and substitutes nothing', () => {
    const { model } = readerInspecting({ context: 'CONTEXT_UNAVAILABLE_AT_TC' });
    expect(model.inspection.render).toMatchObject({ kind: 'CONTEXT_UNAVAILABLE_AT_TC', family: 'READING', id: 'reading-1' });
    const statement = inspectionStatement(model.inspection.render);
    // The identity is part of K(TC) and may be named; the context may not be, and no other
    // disclosed appearance is put in its place.
    expect(statement).toContain('reading-1');
    expect(statement).not.toContain('binding-a');
    expect(statement).not.toContain('binding-b');
    expect(model.context.appearances).toEqual([]);
    expect(model.context.lineage).toEqual([]);
  });

  it('D38, D39 — depth-withheld is not absence, names the rung, and exposes no withheld content', () => {
    const { model } = readerInspecting({ disclosure: 'AVAILABLE_BUT_DEPTH_WITHHELD', requiredDepth: 'SOURCE_PROVENANCE' });
    expect(model.inspection.render).toEqual({
      kind: 'DEPTH_WITHHELD',
      family: 'READING',
      id: 'reading-1',
      requiredDepth: 'SOURCE_PROVENANCE',
    });
    const statement = inspectionStatement(model.inspection.render);
    expect(statement).toContain('SOURCE_PROVENANCE');
    for (const forbidden of ['not known', 'does not know', 'unknown', 'not there', 'no longer']) {
      expect(statement.toLowerCase()).not.toContain(forbidden);
    }
    // Withheld content is withheld: the deeper rung's route is not published either.
    expect(model.context.lineage).toEqual([]);
    expect(inspectionStatement({ kind: 'IDENTITY_UNKNOWN_AT_TC' })).not.toEqual(statement);
  });
});

describe('OC08-D — technical states are never absences', () => {
  it('D40, D41 — NOT_FETCHED and UNAVAILABLE stay technical and stay different from each other', () => {
    const store = historicalStore();
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1' });

    const notFetched = orientationModel(store, projectionFor(store, { status: 'NOT_FETCHED' }));
    const unavailable = orientationModel(store, projectionFor(store, { status: 'UNAVAILABLE', code: 'HISTORICAL_COVERAGE_UNAVAILABLE' }));

    expect(notFetched.inspection.render).toEqual({ kind: 'PROJECTION_NOT_FETCHED' });
    expect(unavailable.inspection.render).toEqual({ kind: 'PROJECTION_UNAVAILABLE', code: 'HISTORICAL_COVERAGE_UNAVAILABLE' });
    expect(notFetched.inspection.render).not.toEqual(unavailable.inspection.render);

    for (const model of [notFetched, unavailable]) {
      const statement = inspectionStatement(model.inspection.render).toLowerCase();
      // Neither may be recast as knowledge about the world.
      for (const forbidden of ['does not know', 'unknown', 'never existed', 'was not there', 'no context']) {
        expect(statement).not.toContain(forbidden);
      }
      expect(model.inspection.render.kind).not.toBe('IDENTITY_UNKNOWN_AT_TC');
      // And the reader is not shown a shape or a count where the target would have been.
      expect(model.context.appearances).toEqual([]);
    }
  });

  it('D42 — a malformed or disagreeing resolution fails closed', () => {
    const store = historicalStore();
    const context = contextAt(TWO_CONTEXT_WORLD());
    const ref = inspect(store, context, { family: 'READING', id: 'reading-1' });

    // A resolution whose knowledge is not one of the frozen answers.
    const malformed = contextAt(withInspection(TWO_CONTEXT_WORLD(), { knowledge: 'MAYBE' } as never));
    expect(inspectionRender(ref, malformed)).toEqual({ kind: 'RESOLUTION_MALFORMED' });

    // A disclosure that answers about an inspection while canonical state holds none.
    expect(inspectionRender(null, contextAt(withInspection(TWO_CONTEXT_WORLD(), known())))).toEqual({ kind: 'RESOLUTION_MALFORMED' });

    // A disclosure that was never asked about this inspection is a technical gap, not an absence.
    expect(inspectionRender(ref, contextAt(TWO_CONTEXT_WORLD()))).toEqual({ kind: 'INSPECTION_NOT_RESOLVED' });
    expect(inspectionStatement({ kind: 'INSPECTION_NOT_RESOLVED' }).toLowerCase()).not.toContain('unknown');
  });
});

describe('OC08-D — IF_ref itself', () => {
  it('a projection change rewrites nothing: `IF_ref` is object-identical while `IF_render` changes', () => {
    const store = historicalStore();
    const ref = inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1' });

    const renderable = orientationModel(store, projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known()))));
    const unknown = orientationModel(store, projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), unknownAtTc()))));
    const gone = orientationModel(store, projectionFor(store, { status: 'NOT_FETCHED' }));

    expect(renderable.inspection.render.kind).toBe('RENDERABLE');
    expect(unknown.inspection.render.kind).toBe('IDENTITY_UNKNOWN_AT_TC');
    expect(gone.inspection.render.kind).toBe('PROJECTION_NOT_FETCHED');
    // The exact requested reference never moved.
    expect(store.getState().inspection).toBe(ref);
  });

  it('the version intent is retained exactly: absent is not the same request as a number', () => {
    const store = historicalStore();
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1' });
    const withoutVersion = orientationModel(store, projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known()))));
    expect(withoutVersion.inspection.render).toMatchObject({ versionIntent: null });
    expect(inspectionStatement(withoutVersion.inspection.render)).toContain('The version current at this moment.');

    const versioned = historicalStore();
    inspect(versioned, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1', version: 1 });
    const model = orientationModel(versioned, projectionFor(versioned, fetched(withInspection(TWO_CONTEXT_WORLD(), known()))));
    expect(model.inspection.render).toMatchObject({ versionIntent: 1 });
    expect(inspectionStatement(model.inspection.render)).toContain('Version 1, exactly as you asked for it.');
  });
});

describe('OC08-D — the disclosed route parses or yields nothing', () => {
  it('a legitimate route becomes steps; an unparsable one becomes no path at all', () => {
    expect(contextLineage('WORLD/THREAD:thread-a/THREAD_READING:binding-a/READING:reading-1')).toEqual([
      { kind: 'WORLD', token: 'WORLD', id: null },
      { kind: 'THREAD', token: 'THREAD', id: 'thread-a' },
      { kind: 'THREAD_READING', token: 'THREAD_READING', id: 'binding-a' },
      { kind: 'OBJECT', token: 'READING', id: 'reading-1' },
    ]);
    expect(contextLineage('WORLD/ANALYTICAL_OBJECT/READING:reading-1')).toEqual([
      { kind: 'WORLD', token: 'WORLD', id: null },
      { kind: 'RUNG', token: 'ANALYTICAL_OBJECT', id: null },
      { kind: 'OBJECT', token: 'READING', id: 'reading-1' },
    ]);
    // Nothing is invented for a route the Product cannot explain.
    for (const broken of ['', 'WORLD/MYSTERY:x/READING:r', 'WORLD/THREAD:/READING:r', 'READING:r/WORLD']) {
      expect(contextLineage(broken)).toEqual([]);
    }
  });
});
