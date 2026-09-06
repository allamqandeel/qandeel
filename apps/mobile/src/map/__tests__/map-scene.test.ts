import { decodeHistoricalDisclosure } from '../../projection';
import { disclosureFixture } from '../__fixtures__/disclosure';
import { fetchedEntry, sceneOf, testStore } from '../__fixtures__/store';
import { deriveMapScene, mapProjectionRequest, mapSceneContains } from '../projection';
import { canonicalCoordinateText } from '../world';

const HOME_A = { id: 'thread-a', x: '0', y: '0' };
const HOME_B = { id: 'thread-b', x: '1000000', y: '0' };
const HOME_C = { id: 'thread-c', x: '-2000000', y: '3000000' };

const homeOf = (scene: ReturnType<typeof sceneOf>, threadId: string): string => {
  const object = scene.objects.find((candidate) => candidate.family === 'THREAD' && candidate.id === threadId);
  const locus = object?.loci[0];
  if (locus === undefined || locus.kind !== 'THREAD_HOME') throw new Error(`no Home for ${threadId}`);
  return `${canonicalCoordinateText(locus.address.x)},${canonicalCoordinateText(locus.address.y)}`;
};

describe('MapScene derivation from the disclosed projection', () => {
  it('the fixtures are wire-legal: the real T-03C validator accepts them', () => {
    const raw = JSON.parse(
      JSON.stringify(
        disclosureFixture({
          depth: 'SOURCE_PROVENANCE',
          threads: [HOME_A, HOME_B],
          appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
          focuses: [{ id: 'focus-1', startedSp: 1 }],
          readings: [{ id: 'reading-1' }],
          materials: [{ id: 'material-1' }],
        }),
      ),
    ) as unknown;
    const decoded = decodeHistoricalDisclosure(raw);
    expect(decoded.ok).toBe(true);
  });

  it('M04-02 — historical filtering removes objects and never relocates the survivors', () => {
    const store = testStore();
    const current = sceneOf(store, disclosureFixture({ depth: 'WORLD', threads: [HOME_A, HOME_B, HOME_C] }));
    const historical = sceneOf(store, disclosureFixture({ depth: 'WORLD', threads: [HOME_A, HOME_C] }));

    expect(current.homes.map((home) => home.id).sort()).toEqual(['thread-a', 'thread-b', 'thread-c']);
    expect(historical.homes.map((home) => home.id).sort()).toEqual(['thread-a', 'thread-c']);
    expect(homeOf(historical, 'thread-a')).toBe(homeOf(current, 'thread-a'));
    expect(homeOf(historical, 'thread-c')).toBe(homeOf(current, 'thread-c'));
    expect(mapSceneContains(historical, 'THREAD', 'thread-b')).toBe(false);
  });

  it('an empty world is a correct, sparse scene, not an error and not a missing fetch', () => {
    const store = testStore();
    const scene = sceneOf(store, disclosureFixture({ depth: 'WORLD', threads: [] }));
    expect(scene.objects).toEqual([]);
    expect(scene.homes).toEqual([]);
    expect(scene.ungeographic).toEqual([]);
  });

  it('NOT_FETCHED, UNAVAILABLE and disclosed-and-empty stay three different answers', () => {
    const store = testStore();
    const request = mapProjectionRequest(store.getState());
    if (request === null) throw new Error('expected a request');
    expect(deriveMapScene({ status: 'NOT_FETCHED' }, request)).toEqual({ status: 'PROJECTION_NOT_FETCHED' });
    expect(deriveMapScene({ status: 'UNAVAILABLE', code: 'HISTORICAL_COVERAGE_UNAVAILABLE' }, request)).toEqual({
      status: 'PROJECTION_UNAVAILABLE',
      code: 'HISTORICAL_COVERAGE_UNAVAILABLE',
    });
    const empty = deriveMapScene(fetchedEntry(disclosureFixture({ depth: 'WORLD', threads: [] })), request);
    expect(empty.status).toBe('SCENE');
  });

  it('M04-04 — depth changes the entitled structure, never a canonical identity or a Home', () => {
    const fixtureAt = (depth: 'WORLD' | 'THREAD' | 'SESSION' | 'ANALYTICAL_OBJECT') =>
      disclosureFixture({
        depth,
        threads: [HOME_A, HOME_B],
        appearances: [
          { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
          { bindingId: 'binding-2', threadId: 'thread-b', readingId: 'reading-1', boundSp: 3 },
        ],
        focuses: [{ id: 'focus-1', startedSp: 1 }],
        readings: [{ id: 'reading-1' }, { id: 'reading-2' }],
      });

    const world = sceneOf(testStore({ depth: 'WORLD' }), fixtureAt('WORLD'));
    const thread = sceneOf(testStore({ depth: 'THREAD' }), fixtureAt('THREAD'));
    const session = sceneOf(testStore({ depth: 'SESSION' }), fixtureAt('SESSION'));
    const analytical = sceneOf(testStore({ depth: 'ANALYTICAL_OBJECT' }), fixtureAt('ANALYTICAL_OBJECT'));

    expect(world.objects.map((object) => object.key)).toEqual(['THREAD:thread-a', 'THREAD:thread-b']);
    expect(thread.objects.map((object) => object.key)).toEqual(['THREAD:thread-a', 'THREAD:thread-b', 'READING:reading-1']);
    expect(session.objects.map((object) => object.key)).toContain('EMERGING_FOCUS:focus-1');
    expect(analytical.objects.map((object) => object.key)).toContain('READING:reading-2');

    // The canonical identity and the Home survive every depth unchanged.
    for (const scene of [world, thread, session, analytical]) {
      expect(homeOf(scene, 'thread-a')).toBe('0,0');
      expect(homeOf(scene, 'thread-b')).toBe('1000000,0');
    }
    // Deeper disclosure reveals grounding without changing the ontology: the Reading keeps its
    // identity and its two contextual appearances, and gains no canonical coordinate of its own.
    const reading = analytical.objects.find((object) => object.key === 'READING:reading-1');
    expect(reading?.loci).toHaveLength(2);
    expect(reading?.loci.every((locus) => locus.kind === 'CONTEXTUAL_APPEARANCE')).toBe(true);
  });

  it('M04-05 — an off-depth identity is absent from the scene, not hidden inside it', () => {
    const store = testStore({ depth: 'WORLD' });
    const scene = sceneOf(
      store,
      disclosureFixture({
        depth: 'WORLD',
        threads: [HOME_A],
        appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
        readings: [{ id: 'reading-1' }],
        focuses: [{ id: 'focus-1', startedSp: 1 }],
      }),
    );
    expect(scene.keys.has('READING:reading-1')).toBe(false);
    expect(scene.keys.has('EMERGING_FOCUS:focus-1')).toBe(false);
    expect(scene.rungs).toEqual({ thread: false, session: false, analyticalObject: false, sourceProvenance: false });
  });

  it('an ungrounded Reading is entitled and explicitly ungeographic, never dropped and never placed', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const scene = sceneOf(
      store,
      disclosureFixture({ depth: 'ANALYTICAL_OBJECT', threads: [HOME_A], readings: [{ id: 'reading-orphan' }] }),
    );
    const orphan = scene.objects.find((object) => object.key === 'READING:reading-orphan');
    expect(orphan?.loci).toEqual([]);
    expect(scene.ungeographic.map((object) => object.key)).toEqual(['READING:reading-orphan']);
  });

  it('a contextual ordinal is per host Home, so a Thread elsewhere never renumbers another Thread', () => {
    const store = testStore({ depth: 'THREAD' });
    const withoutB = sceneOf(
      store,
      disclosureFixture({
        depth: 'THREAD',
        threads: [HOME_A],
        appearances: [
          { bindingId: 'binding-2', threadId: 'thread-a', readingId: 'reading-2', boundSp: 3 },
          { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
        ],
      }),
    );
    const withB = sceneOf(
      store,
      disclosureFixture({
        depth: 'THREAD',
        threads: [HOME_A, HOME_B],
        appearances: [
          { bindingId: 'binding-3', threadId: 'thread-b', readingId: 'reading-3', boundSp: 1 },
          { bindingId: 'binding-2', threadId: 'thread-a', readingId: 'reading-2', boundSp: 3 },
          { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
        ],
      }),
    );
    const ordinalOf = (scene: ReturnType<typeof sceneOf>, readingId: string): number => {
      const locus = scene.objects.find((object) => object.key === `READING:${readingId}`)?.loci[0];
      if (locus === undefined || locus.kind !== 'CONTEXTUAL_APPEARANCE') throw new Error('expected an appearance');
      return locus.ordinal;
    };
    expect(ordinalOf(withoutB, 'reading-1')).toBe(0);
    expect(ordinalOf(withoutB, 'reading-2')).toBe(1);
    expect(ordinalOf(withB, 'reading-1')).toBe(0);
    expect(ordinalOf(withB, 'reading-2')).toBe(1);
  });

  it('a malformed world fails closed for the whole scene rather than dropping the offending row', () => {
    const store = testStore();
    const request = mapProjectionRequest(store.getState());
    if (request === null) throw new Error('expected a request');

    const duplicatePlacement = deriveMapScene(
      fetchedEntry(disclosureFixture({ depth: 'WORLD', threads: [HOME_A, { id: 'thread-z', x: '0', y: '0' }] })),
      request,
    );
    expect(duplicatePlacement).toEqual({ status: 'REJECTED', reason: 'MALFORMED_WORLD', detail: expect.any(String) });

    const orphanAppearance = deriveMapScene(
      fetchedEntry(
        disclosureFixture({
          depth: 'THREAD',
          threads: [HOME_A],
          appearances: [{ bindingId: 'binding-9', threadId: 'thread-missing', readingId: 'reading-1', boundSp: 2 }],
        }),
      ),
      { ...request, depth: 'THREAD' },
    );
    expect(orphanAppearance).toEqual({ status: 'REJECTED', reason: 'MALFORMED_WORLD', detail: expect.any(String) });
  });

  it('a disclosure for another Session, TC or depth is refused rather than rendered as this Map', () => {
    const store = testStore();
    const request = mapProjectionRequest(store.getState());
    if (request === null) throw new Error('expected a request');
    const entry = fetchedEntry(disclosureFixture({ depth: 'WORLD', threads: [HOME_A] }));
    expect(deriveMapScene(entry, { ...request, sessionId: 'other-session' })).toMatchObject({ reason: 'PROJECTION_SESSION_MISMATCH' });
    expect(deriveMapScene(entry, { ...request, depth: 'THREAD' })).toMatchObject({ reason: 'PROJECTION_DEPTH_MISMATCH' });
  });
});
