import { SEMANTIC_DEPTHS, effectiveTC } from '../../state';
import { disclosureFixture } from '../__fixtures__/disclosure';
import { sceneOf, testStore } from '../__fixtures__/store';
import { adjacentDepth, decodeCameraIntent, reinforcedScale, semanticZoom, zoomSemanticStep } from '../camera';
import { decodeScaleIntentRef, decodeWorldAnchorRef } from '../world';

const cameraOf = (store: ReturnType<typeof testStore>) => {
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

describe('Semantic Zoom is disclosure, never magnification (M04-04)', () => {
  it('the rung lineage is the frozen five and steps only to an adjacent rung', () => {
    expect([...SEMANTIC_DEPTHS]).toEqual(['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE']);
    expect(adjacentDepth('WORLD', 'IN')).toBe('THREAD');
    expect(adjacentDepth('SOURCE_PROVENANCE', 'IN')).toBeNull();
    expect(adjacentDepth('WORLD', 'OUT')).toBeNull();
    expect(adjacentDepth('ANALYTICAL_OBJECT', 'OUT')).toBe('SESSION');
  });

  it('an effective zoom writes the depth and its reinforcement, and no temporal or LF field', () => {
    const store = testStore({ depth: 'WORLD' });
    const before = store.getState();
    expect(zoomSemanticStep(store, 'IN').outcome).toBe('APPLIED');
    const after = store.getState();

    expect(after.camera.depth).toBe('THREAD');
    expect(after.temporal).toEqual(before.temporal);
    expect(effectiveTC(after)).toBe(effectiveTC(before));
    expect(after.live).toBe(before.live);
    expect(after.inspection).toBe(before.inspection);
    expect(after.history.map((entry) => entry.act)).toEqual(['ZOOM_SEMANTIC']);
    // The camera stays where the reader put it: a depth change discloses more about the same place.
    expect(after.camera.anchor).toEqual(before.camera.anchor);
  });

  it('the geometric reinforcement is exact and never the semantic authority', () => {
    const store = testStore({ depth: 'WORLD' });
    const start = cameraOf(store);
    const reinforced = reinforcedScale(start.scale, 'IN');
    expect(reinforced.numerator).toBe(1024n);
    expect(reinforced.denominator).toBe(1n);
    expect(reinforcedScale(reinforced, 'OUT')).toEqual(start.scale);

    zoomSemanticStep(store, 'IN');
    const scale = decodeScaleIntentRef(store.getState().camera.scale);
    expect(scale.ok && scale.value.numerator).toBe(1024n);
    // The rung is the authority: it is a name, not a magnitude derived from the scale.
    expect(store.getState().camera.depth).toBe('THREAD');
  });

  it('a rung boundary dispatches nothing at all: it is the absence of an act, not a no-op act', () => {
    const store = testStore({ depth: 'WORLD' });
    const before = store.getState();
    expect(zoomSemanticStep(store, 'OUT')).toEqual({ outcome: 'REJECTED', code: 'AT_RUNG_BOUNDARY', detail: expect.any(String) });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
    expect(semanticZoom(cameraOf(store), 'OUT')).toEqual({ outcome: 'AT_RUNG_BOUNDARY' });
  });

  it('depth changes what is entitled, never a canonical identity, a Home or the temporal state', () => {
    const fixture = (depth: 'WORLD' | 'THREAD') =>
      disclosureFixture({
        depth,
        threads: [{ id: 'thread-a', x: '4000000', y: '-4000000' }],
        appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
      });

    const store = testStore({ depth: 'WORLD' });
    const atWorld = sceneOf(store, fixture('WORLD'));
    zoomSemanticStep(store, 'IN');
    const atThread = sceneOf(store, fixture('THREAD'));

    const homeOf = (scene: typeof atWorld) => {
      const locus = scene.objects.find((object) => object.key === 'THREAD:thread-a')?.loci[0];
      if (locus?.kind !== 'THREAD_HOME') throw new Error('expected a Home');
      return locus.address;
    };
    expect(homeOf(atThread)).toEqual(homeOf(atWorld));
    expect(atWorld.keys.has('READING:reading-1')).toBe(false);
    expect(atThread.keys.has('READING:reading-1')).toBe(true);
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
  });

  it('depth is not a route stack: nothing here pushes a screen or reads router history', () => {
    const store = testStore({ depth: 'WORLD' });
    zoomSemanticStep(store, 'IN');
    zoomSemanticStep(store, 'IN');
    zoomSemanticStep(store, 'OUT');
    // Three effective acts, three checkpoints, one camera. There is no stack of screens and the
    // depth is simply where the camera now is.
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['ZOOM_SEMANTIC', 'ZOOM_SEMANTIC', 'ZOOM_SEMANTIC']);
    expect(store.getState().camera.depth).toBe('THREAD');
    expect(decodeWorldAnchorRef(store.getState().camera.anchor).ok).toBe(true);
  });
});
