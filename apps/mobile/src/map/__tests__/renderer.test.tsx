import { act, fireEvent, render } from '@testing-library/react-native';

import { disclosureFixture } from '../__fixtures__/disclosure';
import { contextOf, envelope, testStore } from '../__fixtures__/store';
import { MAP_ACCESSIBILITY_TEST_ID } from '../accessibility';
import { decodeCameraIntent } from '../camera';
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

    const view = await render(<MapCanvas scene={context.scene} camera={camera} envelope={envelope()} placed={placed} />);
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

    const view = await render(<MapSurface store={store} context={context} camera={camera} envelope={envelope()} />);
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
    const view = await render(<MapSurface store={store} context={context} camera={cameraOf(store)} envelope={envelope()} />);
    for (const key of context.scene.keys) {
      expect(view.getByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:${key}`)).toBeTruthy();
    }
    expect(view.queryByTestId(`${MAP_ACCESSIBILITY_TEST_ID}:READING:reading-absent`)).toBeNull();
  });

  it('an accessibility action reaches the same canonical act as its pointer equivalent', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    const view = await render(<MapSurface store={store} context={context} camera={cameraOf(store)} envelope={envelope()} />);

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
});
