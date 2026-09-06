/**
 * T-06 — TN06-20.
 *
 * Every essential temporal capability has a route that needs neither a drag nor a precision
 * pointer, and each one reaches Product truth through the same gate, controller and commit boundary
 * as the pointer route. The labels keep preview and commitment apart, keep presentation movement and
 * temporal traversal apart, and state no projection truth at all.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { sessionPosition } from '../../state';
import {
  TEMPORAL_ACCESSIBILITY_ACTIONS,
  TEMPORAL_COMMIT_TEST_ID,
  TEMPORAL_EXACT_ENTRY_TEST_ID,
  TEMPORAL_LIVE_TEST_ID,
  TEMPORAL_NAVIGATOR_TEST_ID,
  TemporalNavigator,
  parseExactMomentEntry,
  temporalAccessibilityModel,
  temporalAnnouncement,
} from '../accessibility';
import { createTemporalPreviewController } from '../preview';
import { commitMoment, temporalBounds } from '../targeting';
import { temporalTestStore } from '../__fixtures__/temporal';

const fireAction = async (node: unknown, actionName: string) => {
  await act(async () => {
    fireEvent(node as never, 'accessibilityAction', { nativeEvent: { actionName } });
  });
};

describe('the accessible temporal model', () => {
  it('never announces a preview as committed truth', () => {
    const store = temporalTestStore({ liveHead: 8, temporal: { kind: 'PINNED', at: sessionPosition(2) } });
    const preview = createTemporalPreviewController();
    const bounds = temporalBounds(store.getState());
    preview.preview(bounds, 6, 'EXACT_ENTRY');

    const model = temporalAccessibilityModel(bounds, preview.getSnapshot());
    expect(model.stanceLabel).toBe('Pinned to Moment 2');
    expect(model.previewLabel).toBe('Previewing Moment 6. Not committed.');
    expect(temporalAnnouncement(model)).toContain('Not committed');
    // Committed truth keeps its own sentence and is never overwritten by the preview.
    expect(temporalAnnouncement(model)).toContain('Pinned to Moment 2');
  });

  it('keeps PINNED(LH) and FOLLOW_LIVE distinguishable at the same Session Position', () => {
    const following = temporalAccessibilityModel(temporalBounds(temporalTestStore({ liveHead: 4 }).getState()), { status: 'IDLE' });
    const pinnedStore = temporalTestStore({ liveHead: 4 });
    commitMoment(pinnedStore, 4);
    const pinned = temporalAccessibilityModel(temporalBounds(pinnedStore.getState()), { status: 'IDLE' });

    expect(following.stance).toBe('FOLLOWING_LIVE');
    expect(pinned.stance).toBe('PINNED_TO_MOMENT');
    expect(following.stanceLabel).not.toBe(pinned.stanceLabel);
  });

  it('states no projection truth and no presentation quantity', () => {
    const store = temporalTestStore({ liveHead: 8 });
    const preview = createTemporalPreviewController();
    preview.preview(temporalBounds(store.getState()), 3, 'DISCLOSED_TARGET');
    const model = temporalAccessibilityModel(temporalBounds(store.getState()), preview.getSnapshot());
    const spoken = [model.surfaceLabel, model.stanceLabel, model.previewLabel ?? '', ...model.actions.map((action) => action.label)].join(' ');

    for (const forbidden of ['%', 'percent', 'window', 'scroll', 'presentation', 'depth', 'Thread', 'Reading', 'disclosed']) {
      expect(spoken).not.toContain(forbidden);
    }
  });

  it('offers no forward step at the Live Head, and no commit or cancel without a preview', () => {
    const store = temporalTestStore({ liveHead: 4 });
    const idle = temporalAccessibilityModel(temporalBounds(store.getState()), { status: 'IDLE' });
    expect(idle.forwardAvailable).toBe(false);
    expect(idle.commitAvailable).toBe(false);
    expect(idle.cancelAvailable).toBe(false);
    expect(idle.liveAvailable).toBe(true);
    expect(idle.actions.map((action) => action.name)).toEqual(['commit-live-edge']);

    const pinned = temporalTestStore({ liveHead: 4, temporal: { kind: 'PINNED', at: sessionPosition(1) } });
    const earlier = temporalAccessibilityModel(temporalBounds(pinned.getState()), { status: 'IDLE' });
    expect(earlier.forwardAvailable).toBe(true);
  });

  it('accepts an exact Moment number and refuses presentation commands', () => {
    expect(parseExactMomentEntry(' 42 ')).toBe(42);
    for (const rejected of ['50%', 'first', 'last', 'next', '+', '', '3.5', '-2', 'abc']) {
      expect(parseExactMomentEntry(rejected)).toBeNull();
    }
  });

  it('registers exactly the four frozen non-drag action identities', () => {
    expect([...TEMPORAL_ACCESSIBILITY_ACTIONS]).toEqual([
      'preview-later-moment',
      'commit-previewed-moment',
      'cancel-preview',
      'commit-live-edge',
    ]);
  });
});

describe('TN06-20 — accessibility parity', () => {
  it('reaches exact targeting, preview, commit, cancel, forward continuation and Live without a drag', async () => {
    const store = temporalTestStore({ liveHead: 8, temporal: { kind: 'PINNED', at: sessionPosition(2) } });
    const preview = createTemporalPreviewController();
    const view = await render(<TemporalNavigator store={store} preview={preview} />);

    // Exact targeting: typed as a Session Position, never as a coordinate or a percentage.
    await act(async () => {
      fireEvent.changeText(view.getByTestId(TEMPORAL_EXACT_ENTRY_TEST_ID), '5');
    });
    await act(async () => {
      fireEvent(view.getByTestId(TEMPORAL_EXACT_ENTRY_TEST_ID), 'submitEditing');
    });
    expect(preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 5 });
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 2 });

    // Relative forward continuation, one deliberate step, still ephemeral.
    await fireAction(view.getByTestId(TEMPORAL_NAVIGATOR_TEST_ID), 'preview-later-moment');
    expect(preview.getSnapshot()).toMatchObject({ ptc: 6 });
    expect(store.getState().history).toHaveLength(0);

    // Cancel: lossless and non-transactional.
    await fireAction(view.getByTestId(TEMPORAL_NAVIGATOR_TEST_ID), 'cancel-preview');
    expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(store.getState().history).toHaveLength(0);

    // Preview and commit.
    await act(async () => {
      fireEvent.changeText(view.getByTestId(TEMPORAL_EXACT_ENTRY_TEST_ID), '7');
    });
    await act(async () => {
      fireEvent(view.getByTestId(TEMPORAL_EXACT_ENTRY_TEST_ID), 'submitEditing');
    });
    await act(async () => {
      fireEvent.press(view.getByTestId(TEMPORAL_COMMIT_TEST_ID));
    });
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 7 });
    expect(store.getState().history).toHaveLength(1);

    // The Live target is its own control and is the only route to FOLLOW_LIVE.
    await act(async () => {
      fireEvent.press(view.getByTestId(TEMPORAL_LIVE_TEST_ID));
    });
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().history).toHaveLength(2);

    await act(async () => {
      view.unmount();
    });
  });

  it('refuses an exact entry beyond the Live Head and says so without committing anything', async () => {
    const store = temporalTestStore({ liveHead: 3 });
    const preview = createTemporalPreviewController();
    const view = await render(<TemporalNavigator store={store} preview={preview} />);
    const before = store.getState();

    await act(async () => {
      fireEvent.changeText(view.getByTestId(TEMPORAL_EXACT_ENTRY_TEST_ID), '9');
    });
    await act(async () => {
      fireEvent(view.getByTestId(TEMPORAL_EXACT_ENTRY_TEST_ID), 'submitEditing');
    });

    expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(store.getState()).toBe(before);
    expect(view.getByText('That Moment is not addressable.')).toBeTruthy();

    await act(async () => {
      view.unmount();
    });
  });

  it('states the committed stance and the preview as two separate sentences on the surface', async () => {
    const store = temporalTestStore({ liveHead: 8, temporal: { kind: 'PINNED', at: sessionPosition(2) } });
    const preview = createTemporalPreviewController();
    const view = await render(<TemporalNavigator store={store} preview={preview} />);

    expect(view.getByTestId(`${TEMPORAL_NAVIGATOR_TEST_ID}:stance`).props.children).toBe('Pinned to Moment 2');
    expect(view.queryByTestId(`${TEMPORAL_NAVIGATOR_TEST_ID}:preview`)).toBeNull();

    await act(async () => {
      fireEvent.changeText(view.getByTestId(TEMPORAL_EXACT_ENTRY_TEST_ID), '6');
    });
    await act(async () => {
      fireEvent(view.getByTestId(TEMPORAL_EXACT_ENTRY_TEST_ID), 'submitEditing');
    });

    expect(view.getByTestId(`${TEMPORAL_NAVIGATOR_TEST_ID}:stance`).props.children).toBe('Pinned to Moment 2');
    expect(view.getByTestId(`${TEMPORAL_NAVIGATOR_TEST_ID}:preview`).props.children).toBe('Previewing Moment 6. Not committed.');

    await act(async () => {
      view.unmount();
    });
  });
});
