import { act, fireEvent, render } from '@testing-library/react-native';

import { disclosureFixture } from '../__fixtures__/disclosure';
import { contextOf, envelope, testStore } from '../__fixtures__/store';
import { MAP_ACCESSIBILITY_TEST_ID } from '../accessibility';
import { canvasProps } from '../../motion/__fixtures__/canvas';
import { stubPresentationCamera } from '../../motion/__fixtures__/presentation-camera';
import { inspectObject } from '../inspection';
import { decodeCameraIntent, envelopeCenter } from '../camera';
import {
  MAP_CANVAS_TEST_ID,
  MAP_SURFACE_PLANE_TEST_ID,
  MAP_SURFACE_TEST_ID,
  MapCanvas,
  MapSurface,
  hitTest,
  placeScene,
} from '../renderer';

const DISCLOSURE = () =>
  disclosureFixture({
    depth: 'ANALYTICAL_OBJECT',
    threads: [
      { id: 'thread-a', x: '0', y: '0' },
      { id: 'thread-b', x: '400000', y: '0' },
    ],
    appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
    focuses: [{ id: 'focus-1', startedSp: 1 }],
    readings: [{ id: 'reading-1' }, { id: 'reading-orphan' }],
  });

const cameraOf = (store: ReturnType<typeof testStore>) => {
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

describe('the structural Skia renderer', () => {
  it('renders the disclosed scene and nothing else', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    const camera = cameraOf(store);
    const placed = placeScene(context.scene, camera, envelope());

    const motion = stubPresentationCamera({ center: envelopeCenter(envelope()) });
    const view = await render(<MapCanvas {...canvasProps({ placed: placed, motion: motion, envelope: envelope() })} />);
    expect(view.getByTestId(MAP_CANVAS_TEST_ID)).toBeTruthy();

    // Two Homes, one contextual appearance, two ungeographic entries: every entitled locus and
    // no other. `thread-b` sits 48 points away at the default scale, so both Homes are on screen.
    expect(placed.nodes.filter((node) => node.locus?.kind === 'THREAD_HOME')).toHaveLength(2);
    expect(placed.nodes.filter((node) => node.locus?.kind === 'CONTEXTUAL_APPEARANCE')).toHaveLength(1);
    expect(placed.nodes.filter((node) => node.region === 'UNGEOGRAPHIC_REGISTER').map((node) => node.objectKey)).toEqual([
      'READING:reading-orphan',
      'EMERGING_FOCUS:focus-1',
    ]);
  });

  it('hit testing reaches exactly the disclosed, visible targets', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    const placed = placeScene(context.scene, cameraOf(store), envelope());
    const home = placed.nodes.find((node) => node.id === 'thread-a' && node.locus?.kind === 'THREAD_HOME');
    if (home === undefined) throw new Error('expected a placed Home');

    expect(hitTest(placed, { x: home.x, y: home.y })?.objectKey).toBe('THREAD:thread-a');
    expect(hitTest(placed, { x: home.x + home.radius + 40, y: home.y + home.radius + 40 })).toBeNull();
    expect(hitTest(placed, { x: -500, y: -500 })).toBeNull();
  });

  it('a tap on a disclosed Home inspects it through the canonical store, once', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    const camera = cameraOf(store);
    const placed = placeScene(context.scene, camera, envelope());
    const home = placed.nodes.find((node) => node.id === 'thread-b' && node.locus?.kind === 'THREAD_HOME');
    if (home === undefined) throw new Error('expected a placed Home');

    const view = await render(<MapSurface store={store} context={context} envelope={envelope()} />);
    expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(MAP_ACCESSIBILITY_TEST_ID)).toBeTruthy();

    // React 19's `act` is asynchronous, so every event is awaited: an unsettled act would leak
    // into the next test and unmount its tree.
    await act(async () => {
      fireEvent(view.getByTestId(MAP_SURFACE_PLANE_TEST_ID), 'responderRelease', {
        nativeEvent: { locationX: home.x, locationY: home.y },
      });
    });
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['INSPECT_OBJECT']);

    // A tap on empty world is not an act: nothing is inspected and nothing is recorded.
    await act(async () => {
      fireEvent(view.getByTestId(MAP_SURFACE_PLANE_TEST_ID), 'responderRelease', { nativeEvent: { locationX: -400, locationY: -400 } });
    });
    expect(store.getState().history).toHaveLength(1);
  });

  it('the accessible layer exposes one node per entitled identity and no more', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    const view = await render(<MapSurface store={store} context={context} envelope={envelope()} />);
    for (const key of context.scene.keys) {
      expect(view.getByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:${key}`)).toBeTruthy();
    }
    expect(view.queryByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:READING:reading-absent`)).toBeNull();
  });

  it('an accessibility action reaches the same canonical act as its pointer equivalent', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    const view = await render(<MapSurface store={store} context={context} envelope={envelope()} />);

    const activate = async (testID: string, actionName: string) => {
      await act(async () => {
        fireEvent(view.getByTestId(testID), 'accessibilityAction', { nativeEvent: { actionName } });
      });
    };

    await activate(`${MAP_ACCESSIBILITY_TEST_ID}:THREAD:thread-a`, 'inspect');
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['INSPECT_OBJECT']);

    await activate(MAP_ACCESSIBILITY_TEST_ID, 'explore-right');
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['INSPECT_OBJECT', 'PAN']);

    await activate(MAP_ACCESSIBILITY_TEST_ID, 'zoom-out');
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['INSPECT_OBJECT', 'PAN', 'ZOOM_SEMANTIC']);

    // An action the tree does not offer changes nothing.
    await activate(MAP_ACCESSIBILITY_TEST_ID, 'return-live-head');
    expect(store.getState().history).toHaveLength(3);
  });

  it('the surface reads the camera from canonical state, so a pan it dispatched moves what it paints', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    const view = await render(<MapSurface store={store} context={context} envelope={envelope()} />);

    const homeX = () => {
      const found = JSON.stringify(view.toJSON()).match(/"cx":(-?[0-9.]+),"cy":434,"r":13/u);
      if (found === null) throw new Error('expected a painted Home');
      return Number(found[1]);
    };
    const before = homeX();

    await act(async () => {
      fireEvent(view.getByTestId(MAP_ACCESSIBILITY_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: 'explore-right' } });
    });

    expect(store.getState().history.map((entry) => entry.act)).toEqual(['PAN']);
    // Exploring right moves the camera right, so the same canonical Home paints further left.
    expect(homeX()).toBeLessThan(before);
    expect(homeX()).toBe(before - 130);
  });

  it('the accessible actions follow IF_ref, not a snapshot taken at mount', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(
      store,
      disclosureFixture({
        depth: 'ANALYTICAL_OBJECT',
        threads: [
          { id: 'thread-a', x: '0', y: '0' },
          { id: 'thread-b', x: '400000', y: '0' },
        ],
        appearances: [
          { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
          { bindingId: 'binding-2', threadId: 'thread-b', readingId: 'reading-1', boundSp: 3 },
        ],
        readings: [{ id: 'reading-1' }],
      }),
    );
    const view = await render(<MapSurface store={store} context={context} envelope={envelope()} />);
    const actionsOf = (key: string): string[] => {
      const node = view.getByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:${key}`);
      return ((node.props.accessibilityActions ?? []) as { name: string }[]).map((action) => action.name);
    };

    expect(actionsOf('READING:reading-1')).toEqual(['inspect']);

    await act(async () => {
      inspectObject(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } });
    });

    // A context switch becomes available only now, because the object is inspected through a
    // named context and a second disclosed appearance exists.
    expect(actionsOf('READING:reading-1')).toEqual(['inspect', 'switch-context']);
  });
});
