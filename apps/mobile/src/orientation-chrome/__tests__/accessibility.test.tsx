/**
 * T-08 — J: the accessibility claims match what React Native actually provides.
 *
 * R1 corrected an overclaim here. The grouping `View`s were deliberately non-accessible so they
 * could not swallow the independent Pressables — and they also carried `accessibilityActions`, which
 * were then documented and tested as a second, non-pointer route. A container that is not an
 * accessibility element is not focusable, so a screen reader never reaches its custom actions: the
 * route was asserted but not real.
 *
 * The trustworthy route is the one that was always there. Each offered control is its own native
 * button with its own label and hint, reachable by touch exploration and by swipe traversal, and
 * pointer and screen-reader activation converge on the same executor. The redundant group actions
 * are gone rather than re-documented, so nothing here claims behaviour the platform does not give.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { CONTEXT_CHOICE_TEST_ID, INSPECTION_ORIENTATION_TEST_ID } from '../InspectionOrientation';
import { ORIENTATION_CHROME_TEST_ID, OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { orientationModel } from '../model';
import { contextChoiceLabel } from '../product-copy';
import { chromeStore, chromeSurface, contextAt, fetched, flattenStyle, historicalStore, inspect, known, offeredIds, projectionFor, TWO_CONTEXT_WORLD, withInspection } from '../__fixtures__/chrome';

const reader = (): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });

const renderChrome = (store: CanonicalStore) =>
  render(<OrientationChrome language="en" surface={chromeSurface(store)} projection={projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known())))} />);

describe('OC08-J — structure', () => {
  it('J88, J89 — every offered control is its own native button, and no grouping parent swallows them', async () => {
    const store = reader();
    const model = orientationModel(store, projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known()))));
    const view = await renderChrome(store);

    // The grouping containers are explicitly NOT accessibility elements — and they carry no
    // accessible NAME either. React Native maps an `accessibilityLabel` onto the Android
    // ViewGroup's `contentDescription`, and TalkBack then focuses the container and stops
    // traversing into it: the independent buttons would collapse into one unreadable node. A
    // container that cannot be focused also cannot speak, so a name on it is either inert or
    // harmful, and never a route.
    //
    // The inspection region is queried rather than required: with nothing inspected it is absent
    // entirely, because an empty region is not a surface.
    for (const testID of [ORIENTATION_CHROME_TEST_ID, RETURN_CONTROLS_TEST_ID, INSPECTION_ORIENTATION_TEST_ID]) {
      const container = view.queryByTestId(testID);
      if (container === null) continue;
      expect(container.props.accessible).not.toBe(true);
      expect(container.props.accessibilityRole).toBe('none');
      expect(container.props.accessibilityLabel).toBeUndefined();
      expect(container.props.accessibilityHint).toBeUndefined();
    }
    // Each offered act is an independent, individually reachable button.
    for (const id of offeredIds(model)) {
      const control = view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:${id}`);
      expect(control.props.accessible).toBe(true);
      expect(control.props.accessibilityRole).toBe('button');
      expect(typeof control.props.accessibilityLabel).toBe('string');
      expect(control.props.accessibilityLabel.length).toBeGreaterThan(0);
      expect(typeof control.props.accessibilityHint).toBe('string');
    }

    await act(async () => {
      view.unmount();
    });
  });

  it('R1-05, R1-10 — no non-focusable container claims custom actions as a route', async () => {
    const store = historicalStore({ liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' }, liveFocusAtSp: 5 });
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-a' } });
    const view = await render(
      <OrientationChrome language="en" surface={chromeSurface(store)} projection={projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known())))} />,
    );

    // A container that is not an accessibility element cannot be focused, so its custom actions
    // would never be discoverable. None is published anywhere in the surface.
    expect(JSON.stringify(view.toJSON())).not.toContain('accessibilityActions');
    for (const testID of [ORIENTATION_CHROME_TEST_ID, RETURN_CONTROLS_TEST_ID, INSPECTION_ORIENTATION_TEST_ID, CONTEXT_CHOICE_TEST_ID]) {
      expect(view.getByTestId(testID).props.accessibilityActions).toBeUndefined();
    }
    // The contextual chooser's options remain individually reachable buttons, which is the route.
    expect(view.getByTestId(`${CONTEXT_CHOICE_TEST_ID}:option:1`).props.accessibilityRole).toBe('button');

    await act(async () => {
      view.unmount();
    });
  });

  it('J94, J95 — targets are practical, and nothing is reachable only by dragging', async () => {
    const store = reader();
    const model = orientationModel(store, projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known()))));
    const view = await renderChrome(store);
    for (const id of offeredIds(model)) {
      const control = view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:${id}`);
      const style = flattenStyle(control.props.style);
      expect(style.minHeight as number).toBeGreaterThanOrEqual(44);
      // Slop widens the reading axis only. Stacked controls with vertical slop would share hit
      // area, turning a near-miss into the wrong Product act.
      expect(control.props.hitSlop).toEqual({ left: 8, right: 8 });
      // A press, never a gesture: the whole surface publishes no pan, pinch or swipe responder.
      expect(typeof control.props.onClick === 'function' || typeof control.props.onStartShouldSetResponder === 'function').toBe(true);
    }
    expect(JSON.stringify(view.toJSON())).not.toContain('onGestureEvent');
    // And adjacent targets are kept apart by the group's own gap, so no two hit areas overlap.
    expect(flattenStyle(view.getByTestId(RETURN_CONTROLS_TEST_ID).props.style).rowGap as number).toBeGreaterThanOrEqual(8);

    await act(async () => {
      view.unmount();
    });
  });
});

describe('OC08-J — the offered set is the whole route', () => {
  it('J87, J91, J93 — exactly the meaningful acts are rendered, and nothing unavailable is reachable', async () => {
    const store = reader();
    const model = orientationModel(store, projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known()))));
    const view = await renderChrome(store);

    const offered = offeredIds(model);
    expect(offered.length).toBeGreaterThan(0);
    for (const id of ['BACK_ONE_STEP', 'EXACT_RETURN', 'RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'RETURN_WORLD', 'GO_LIVE_AND_LOCATE'] as const) {
      expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:${id}`) !== null).toBe(offered.includes(id));
    }
    // Nothing is rendered as a permanently disabled affordance any more.
    expect(JSON.stringify(view.toJSON())).not.toContain('"disabled":true');

    await act(async () => {
      view.unmount();
    });
  });

  it('J90 — the pointer route reaches the executor the control names, and only that one', async () => {
    const store = reader();
    const view = await renderChrome(store);
    const before = store.getState();

    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_LIVE_FOCUS`));
    });

    // Spatial only: the camera moved and the temporal stance did not.
    expect(store.getState().camera).not.toBe(before.camera);
    expect(store.getState().temporal).toBe(before.temporal);
    expect(store.getState().history).toHaveLength(1);

    await act(async () => {
      view.unmount();
    });
  });

  it('J87b — the contextual chooser offers one independent button per disclosed appearance', async () => {
    const store = historicalStore();
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-a' } });
    const projection = projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known())));
    const model = orientationModel(store, projection);
    const view = await render(<OrientationChrome language="en" surface={chromeSurface(store)} projection={projection} />);

    expect(model.context.appearances).toHaveLength(2);
    for (const option of model.context.appearances) {
      const control = view.getByTestId(`${CONTEXT_CHOICE_TEST_ID}:option:${option.ordinal}`);
      expect(control.props.accessible).toBe(true);
      expect(control.props.accessibilityRole).toBe('button');
      expect(control.props.accessibilityLabel).toBe(contextChoiceLabel('en', option.current, option.boundAtMoment));
      expect(control.props.accessibilityState.selected).toBe(option.current);
    }

    await act(async () => {
      view.unmount();
    });
  });
});
