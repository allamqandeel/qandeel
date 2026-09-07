/**
 * T-08 — J: the T-09 accessibility and modality closure, proven on real native semantics.
 *
 * Every essential act reaches the same executor without a drag and without a precision pointer; the
 * controls stay independent native elements rather than being swallowed by a grouping parent; and
 * the non-pointer route offers exactly what the pointer route can do — no more, and nothing that is
 * currently impossible.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { CONTEXT_CHOICE_TEST_ID, INSPECTION_ORIENTATION_TEST_ID } from '../InspectionOrientation';
import { ORIENTATION_CHROME_TEST_ID, OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { orientationModel } from '../model';
import { RETURN_OPPORTUNITY_IDS } from '../types';
import { chromeStore, chromeSurface, contextAt, fetched, flattenStyle, historicalStore, inspect, known, projectionFor, TWO_CONTEXT_WORLD, withInspection } from '../__fixtures__/chrome';

const reader = (): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });

const renderChrome = (store: CanonicalStore) =>
  render(<OrientationChrome surface={chromeSurface(store)} projection={projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known())))} />);

describe('OC08-J — structure', () => {
  it('J88, J89 — every control is its own native element, and no grouping parent swallows them', async () => {
    const store = reader();
    const view = await renderChrome(store);

    // The three grouping containers are explicitly NOT accessible elements.
    for (const testID of [ORIENTATION_CHROME_TEST_ID, RETURN_CONTROLS_TEST_ID, INSPECTION_ORIENTATION_TEST_ID]) {
      const container = view.getByTestId(testID);
      expect(container.props.accessible).not.toBe(true);
      expect(container.props.accessibilityRole).toBe('none');
    }
    // Each of the six is an independent, individually reachable button.
    for (const id of RETURN_OPPORTUNITY_IDS) {
      const control = view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:${id}`);
      expect(control.props.accessible).toBe(true);
      expect(control.props.accessibilityRole).toBe('button');
      expect(typeof control.props.accessibilityLabel).toBe('string');
      expect(control.props.accessibilityLabel.length).toBeGreaterThan(0);
    }

    await act(async () => {
      view.unmount();
    });
  });

  it('J94, J95 — targets are practical, and nothing is reachable only by dragging', async () => {
    const store = reader();
    const view = await renderChrome(store);
    for (const id of RETURN_OPPORTUNITY_IDS) {
      const control = view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:${id}`);
      const style = flattenStyle(control.props.style);
      expect(style.minHeight as number).toBeGreaterThanOrEqual(44);
      expect(control.props.hitSlop).toBeGreaterThan(0);
      // A press, never a gesture: the whole surface publishes no pan, pinch or swipe responder.
      expect(typeof control.props.onClick === 'function' || typeof control.props.onStartShouldSetResponder === 'function').toBe(true);
    }
    expect(JSON.stringify(view.toJSON())).not.toContain('onGestureEvent');

    await act(async () => {
      view.unmount();
    });
  });
});

describe('OC08-J — the non-pointer route', () => {
  it('J87, J93 — the accessibility actions are exactly the acts that are currently possible', async () => {
    const store = reader();
    const model = orientationModel(store, projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known()))));
    const view = await renderChrome(store);

    const published = (view.getByTestId(RETURN_CONTROLS_TEST_ID).props.accessibilityActions as { name: string }[]).map((action) => action.name);
    const available = model.returns.opportunities.filter((candidate) => candidate.available).map((candidate) => candidate.id);

    expect(published.sort()).toEqual([...available].sort());
    // Nothing unavailable is offered to assistive technology, and nothing is offered there that the
    // pointer route cannot also reach.
    for (const candidate of model.returns.opportunities) {
      expect(published.includes(candidate.id)).toBe(candidate.available);
      expect(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:${candidate.id}`).props.accessibilityState.disabled).toBe(!candidate.available);
    }

    await act(async () => {
      view.unmount();
    });
  });

  it('J90 — the pointer route and the accessibility route reach the same executor', async () => {
    const byPointer = reader();
    const pointerView = await renderChrome(byPointer);
    await act(async () => {
      fireEvent.press(pointerView.getByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_LIVE_FOCUS`));
    });
    const pointerResult = byPointer.getState();
    await act(async () => {
      pointerView.unmount();
    });

    const byAction = reader();
    const actionView = await renderChrome(byAction);
    await act(async () => {
      fireEvent(actionView.getByTestId(RETURN_CONTROLS_TEST_ID), 'accessibilityAction', {
        nativeEvent: { actionName: 'RETURN_LIVE_FOCUS' },
      });
    });
    const actionResult = byAction.getState();
    await act(async () => {
      actionView.unmount();
    });

    // Same canonical effect, same reversible step: one act, two routes.
    expect(actionResult.camera).toEqual(pointerResult.camera);
    expect(actionResult.temporal).toEqual(pointerResult.temporal);
    expect(actionResult.history).toHaveLength(pointerResult.history.length);
    expect(actionResult.history).toHaveLength(1);
  });

  it('J90b — an accessibility action naming an unavailable act does nothing at all', async () => {
    const store = reader();
    const before = store.getState();
    const view = await renderChrome(store);
    await act(async () => {
      fireEvent(view.getByTestId(RETURN_CONTROLS_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: 'BACK_ONE_STEP' } });
      fireEvent(view.getByTestId(RETURN_CONTROLS_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: 'NOT_AN_ACT' } });
    });
    expect(store.getState()).toBe(before);

    await act(async () => {
      view.unmount();
    });
  });

  it('J87b — the contextual chooser has a non-pointer route to every disclosed appearance', async () => {
    const store = historicalStore();
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-a' } });
    const projection = projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known())));
    const model = orientationModel(store, projection);
    const view = await render(<OrientationChrome surface={chromeSurface(store)} projection={projection} />);

    const chooser = view.getByTestId(CONTEXT_CHOICE_TEST_ID);
    expect(chooser.props.accessible).not.toBe(true);
    const names = (chooser.props.accessibilityActions as { name: string }[]).map((action) => action.name);
    expect(names.sort()).toEqual(model.context.appearances.map((option) => option.key).sort());
    // The ordering note reaches assistive technology as the group's hint, not as a hidden caption.
    expect(chooser.props.accessibilityHint).toBe(model.context.ordering);

    await act(async () => {
      view.unmount();
    });
  });
});
