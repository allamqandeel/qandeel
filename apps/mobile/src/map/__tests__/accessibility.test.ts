import { disclosureFixture } from '../__fixtures__/disclosure';
import { contextOf, envelope, sceneOf, testStore } from '../__fixtures__/store';
import { MAP_VIEWPORT_ACTIONS, buildMapAccessibilityTree } from '../accessibility';
import { decodeCameraIntent } from '../camera';
import { inspectObject } from '../inspection';
import { placeScene } from '../renderer';

const WORLD = [
  { id: 'thread-a', x: '0', y: '0' },
  { id: 'thread-b', x: '4000000', y: '0' },
];

const cameraOf = (store: ReturnType<typeof testStore>) => {
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

const fullDisclosure = () =>
  disclosureFixture({
    depth: 'SOURCE_PROVENANCE',
    threads: WORLD,
    appearances: [
      { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
      { bindingId: 'binding-2', threadId: 'thread-b', readingId: 'reading-1', boundSp: 3 },
    ],
    focuses: [{ id: 'focus-1', startedSp: 1 }],
    readings: [{ id: 'reading-1' }, { id: 'reading-orphan' }],
    materials: [{ id: 'material-1' }],
  });

describe('accessible Map parity (M04-13, M04-05)', () => {
  it('the accessible object set is exactly the entitled disclosed object set', () => {
    const store = testStore({ depth: 'SOURCE_PROVENANCE' });
    const scene = sceneOf(store, fullDisclosure());
    const tree = buildMapAccessibilityTree(scene, cameraOf(store), envelope());
    expect([...tree.keys].sort()).toEqual([...scene.keys].sort());
    // No accessibility-only identity and no accessibility-only geography.
    expect(tree.nodes.every((node) => scene.keys.has(node.key))).toBe(true);
    expect(tree.nodes.filter((node) => node.placement === 'UNGEOGRAPHIC').map((node) => node.key)).toEqual([
      'READING:reading-orphan',
      'EMERGING_FOCUS:focus-1',
    ]);
  });

  it('M04-05 — a future, off-depth or unavailable identity is in neither the scene nor the tree', () => {
    const store = testStore({ depth: 'WORLD' });
    const scene = sceneOf(
      store,
      disclosureFixture({
        depth: 'WORLD',
        threads: WORLD,
        appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
        readings: [{ id: 'reading-1' }],
        focuses: [{ id: 'focus-1', startedSp: 1 }],
      }),
    );
    const camera = cameraOf(store);
    const tree = buildMapAccessibilityTree(scene, camera, envelope());
    const placed = placeScene(scene, camera, envelope());

    for (const hidden of ['READING:reading-1', 'EMERGING_FOCUS:focus-1']) {
      expect(scene.keys.has(hidden)).toBe(false);
      expect(tree.keys.has(hidden)).toBe(false);
      expect(placed.nodes.some((node) => node.objectKey === hidden)).toBe(false);
    }
  });

  it('M04-13 — every essential Map intent has a non-drag route and no extra entitlement', () => {
    const store = testStore({ depth: 'SOURCE_PROVENANCE' });
    const scene = sceneOf(store, fullDisclosure());
    const tree = buildMapAccessibilityTree(scene, cameraOf(store), envelope());

    expect(tree.viewportActions.map((action) => action.name).sort()).toEqual([...MAP_VIEWPORT_ACTIONS].sort());
    // Inspecting is always available on an entitled node; a direct jump only where a unique
    // locus already exists, so no route has to guess.
    for (const node of tree.nodes) expect(node.actions.some((action) => action.name === 'inspect')).toBe(true);
    const thread = tree.nodes.find((node) => node.key === 'THREAD:thread-a');
    expect(thread?.actions.map((action) => action.name)).toEqual(['inspect', 'direct-jump']);
    const reading = tree.nodes.find((node) => node.key === 'READING:reading-1');
    expect(reading?.actions.map((action) => action.name)).toEqual(['inspect']);
    const orphan = tree.nodes.find((node) => node.key === 'READING:reading-orphan');
    expect(orphan?.actions.map((action) => action.name)).toEqual(['inspect']);
  });

  it('context switching appears only once a named context is being inspected', () => {
    const store = testStore({ depth: 'SOURCE_PROVENANCE' });
    const context = contextOf(store, fullDisclosure());
    const camera = cameraOf(store);

    const before = buildMapAccessibilityTree(context.scene, camera, envelope(), null);
    expect(before.nodes.find((node) => node.key === 'READING:reading-1')?.actions.map((action) => action.name)).toEqual(['inspect']);

    inspectObject(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } });
    const after = buildMapAccessibilityTree(context.scene, camera, envelope(), { family: 'READING', id: 'reading-1', bindingId: 'binding-1' });
    expect(after.nodes.find((node) => node.key === 'READING:reading-1')?.actions.map((action) => action.name)).toEqual(['inspect', 'switch-context']);
  });

  it('no role publishes a set size while a rung is withheld, and no node publishes a value range', () => {
    const store = testStore({ depth: 'THREAD' });
    const partial = sceneOf(store, disclosureFixture({ depth: 'THREAD', threads: WORLD }));
    expect(buildMapAccessibilityTree(partial, cameraOf(store), envelope()).containerRole).toBe('none');

    const complete = sceneOf(testStore({ depth: 'SOURCE_PROVENANCE' }), fullDisclosure());
    const full = buildMapAccessibilityTree(complete, cameraOf(testStore({ depth: 'SOURCE_PROVENANCE' })), envelope());
    expect(full.containerRole).toBe('list');
    for (const node of full.nodes) {
      expect(node.role).toBe('button');
      expect(Object.prototype.hasOwnProperty.call(node, 'accessibilityValue')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(node, 'setSize')).toBe(false);
    }
  });

  it('an object outside the viewport stays entitled and reachable, with its visibility stated', () => {
    const store = testStore({ depth: 'WORLD' });
    const scene = sceneOf(store, disclosureFixture({ depth: 'WORLD', threads: WORLD }));
    const tree = buildMapAccessibilityTree(scene, cameraOf(store), envelope());
    const near = tree.nodes.find((node) => node.key === 'THREAD:thread-a');
    const far = tree.nodes.find((node) => node.key === 'THREAD:thread-b');
    expect(near?.withinVisibleFootprint).toBe(true);
    expect(far?.withinVisibleFootprint).toBe(false);
    expect(far?.actions.some((action) => action.name === 'inspect')).toBe(true);
  });

  it('no T-07 return act is offered merely because a final architecture will want it', () => {
    const store = testStore({ depth: 'SOURCE_PROVENANCE' });
    const tree = buildMapAccessibilityTree(sceneOf(store, fullDisclosure()), cameraOf(store), envelope());
    const names = [...tree.viewportActions, ...tree.nodes.flatMap((node) => node.actions)].map((action) => action.name);
    for (const forbidden of ['return', 'back', 'go-live', 'exact-return', 'locate', 'choose-locus']) {
      expect(names.some((name) => name.includes(forbidden))).toBe(false);
    }
  });
});
