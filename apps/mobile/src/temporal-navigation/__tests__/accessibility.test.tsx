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
  TEMPORAL_SUMMARY_TEST_ID,
  TemporalNavigator,
  parseExactMomentEntry,
  temporalAccessibilityModel,
  temporalAnnouncement,
} from '../accessibility';
import { createTemporalPreviewController } from '../preview';
import { commitMoment, temporalTargeting } from '../targeting';
import { fullyDisclosedTargeting, temporalTestStore, trackOf } from '../__fixtures__/temporal';

const fireAction = async (node: unknown, actionName: string) => {
  await act(async () => {
    fireEvent(node as never, 'accessibilityAction', { nativeEvent: { actionName } });
  });
};

describe('the accessible temporal model', () => {
  it('never announces a preview as committed truth', () => {
    const store = temporalTestStore({ liveHead: 8, temporal: { kind: 'PINNED', at: sessionPosition(2) } });
    const preview = createTemporalPreviewController();
    const bounds = fullyDisclosedTargeting(store);
    preview.preview(bounds, 6, 'EXACT_ENTRY');

    const model = temporalAccessibilityModel(bounds, preview.getSnapshot());
    expect(model.stanceLabel).toBe('Pinned to Moment 2');
    expect(model.previewLabel).toBe('Previewing Moment 6. Not committed.');
    expect(temporalAnnouncement(model)).toContain('Not committed');
    // Committed truth keeps its own sentence and is never overwritten by the preview.
    expect(temporalAnnouncement(model)).toContain('Pinned to Moment 2');
  });

  it('keeps PINNED(LH) and FOLLOW_LIVE distinguishable at the same Session Position', () => {
    const following = temporalAccessibilityModel(fullyDisclosedTargeting(temporalTestStore({ liveHead: 4 })), { status: 'IDLE' });
    const pinnedStore = temporalTestStore({ liveHead: 4 });
    commitMoment(pinnedStore, 4);
    const pinned = temporalAccessibilityModel(fullyDisclosedTargeting(pinnedStore), { status: 'IDLE' });

    expect(following.stance).toBe('FOLLOWING_LIVE');
    expect(pinned.stance).toBe('PINNED_TO_MOMENT');
    expect(following.stanceLabel).not.toBe(pinned.stanceLabel);
  });

  it('states no projection truth and no presentation quantity', () => {
    const store = temporalTestStore({ liveHead: 8 });
    const preview = createTemporalPreviewController();
    preview.preview(fullyDisclosedTargeting(store), 3, 'DISCLOSED_TARGET');
    const model = temporalAccessibilityModel(fullyDisclosedTargeting(store), preview.getSnapshot());
    const spoken = [model.surfaceLabel, model.stanceLabel, model.previewLabel ?? '', ...model.actions.map((action) => action.label)].join(' ');

    for (const forbidden of ['%', 'percent', 'window', 'scroll', 'presentation', 'depth', 'Thread', 'Reading', 'disclosed']) {
      expect(spoken).not.toContain(forbidden);
    }
  });

  it('offers no forward step at the Live Head, and no commit or cancel without a preview', () => {
    const store = temporalTestStore({ liveHead: 4 });
    const idle = temporalAccessibilityModel(fullyDisclosedTargeting(store), { status: 'IDLE' });
    expect(idle.forwardAvailable).toBe(false);
    expect(idle.commitAvailable).toBe(false);
    expect(idle.cancelAvailable).toBe(false);
    expect(idle.liveAvailable).toBe(true);
    expect(idle.actions.map((action) => action.name)).toEqual(['commit-live-edge']);

    const pinned = temporalTestStore({ liveHead: 4, temporal: { kind: 'PINNED', at: sessionPosition(1) } });
    const earlier = temporalAccessibilityModel(fullyDisclosedTargeting(pinned), { status: 'IDLE' });
    expect(earlier.forwardAvailable).toBe(true);
  });

  it('R1-01 — bounds the exact route by the disclosure horizon, not by the Live Head', () => {
    const store = temporalTestStore({ liveHead: 100, temporal: { kind: 'PINNED', at: sessionPosition(10) } });
    const partial = temporalAccessibilityModel(temporalTargeting(store.getState(), trackOf('session-1', 80)), { status: 'IDLE' });
    expect(partial.exactTargetMaximum).toBe(80);
    expect(partial.forwardAvailable).toBe(true);

    // Standing on the horizon, there is no forward step to offer even though `LH` is 100.
    const atHorizon = temporalAccessibilityModel(temporalTargeting(store.getState(), trackOf('session-1', 80)), {
      status: 'PREVIEWING',
      ptc: sessionPosition(80),
      source: 'EXACT_ENTRY',
      origin: { sessionId: 'session-1', mode: 'PINNED', tc: sessionPosition(10) },
      generation: 1,
    });
    expect(atHorizon.forwardAvailable).toBe(false);
    expect(atHorizon.actions.map((action) => action.name)).not.toContain('preview-later-moment');

    // Nothing disclosed at all: no exact maximum to offer.
    expect(temporalAccessibilityModel(temporalTargeting(store.getState(), trackOf('session-1', 0)), { status: 'IDLE' }).exactTargetMaximum).toBeNull();
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
    const view = await render(<TemporalNavigator store={store} preview={preview} track={trackOf('session-1', store.getState().live.LH ?? 0)} />);

    // Exact targeting: typed as a Session Position, never as a coordinate or a percentage.
    await act(async () => {
      fireEvent.changeText(view.getByTestId(TEMPORAL_EXACT_ENTRY_TEST_ID), '5');
    });
    await act(async () => {
      fireEvent(view.getByTestId(TEMPORAL_EXACT_ENTRY_TEST_ID), 'submitEditing');
    });
    expect(preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 5 });
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 2 });

    // Relative forward continuation, one deliberate step, still ephemeral. The named actions live
    // on the summary element (FCR-02), never on the container that owns the controls.
    await fireAction(view.getByTestId(TEMPORAL_SUMMARY_TEST_ID), 'preview-later-moment');
    expect(preview.getSnapshot()).toMatchObject({ ptc: 6 });
    expect(store.getState().history).toHaveLength(0);

    // Cancel: lossless and non-transactional.
    await fireAction(view.getByTestId(TEMPORAL_SUMMARY_TEST_ID), 'cancel-preview');
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
    const view = await render(<TemporalNavigator store={store} preview={preview} track={trackOf('session-1', store.getState().live.LH ?? 0)} />);
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
    const view = await render(<TemporalNavigator store={store} preview={preview} track={trackOf('session-1', store.getState().live.LH ?? 0)} />);

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

describe('FCR-02 — native accessibility structure', () => {
  type HostNode = { readonly type: string; readonly props: Record<string, unknown>; readonly parent: HostNode | null; queryAll(predicate: (node: HostNode) => boolean): HostNode[] };
  /** A host node the reader can operate: a text input, a button, or a responder. */
  const isInteractive = (node: HostNode) =>
    node.type === 'TextInput' || node.props.accessibilityRole === 'button' || typeof node.props.onStartShouldSetResponder === 'function';
  const isAccessibilityElement = (node: HostNode) => node.props.accessible === true;

  it('the container that owns the interactive descendants is not an accessibility element and carries no actions', async () => {
    const store = temporalTestStore({ liveHead: 8, temporal: { kind: 'PINNED', at: sessionPosition(2) } });
    const preview = createTemporalPreviewController();
    const view = await render(<TemporalNavigator store={store} preview={preview} track={trackOf('session-1', 8)} />);
    const container = view.getByTestId(TEMPORAL_NAVIGATOR_TEST_ID) as unknown as HostNode;

    expect(container.props.accessible).not.toBe(true);
    for (const forbidden of ['accessibilityActions', 'onAccessibilityAction', 'accessibilityLabel', 'accessibilityRole', 'accessibilityValue', 'accessibilityState']) {
      expect(container.props[forbidden]).toBeUndefined();
    }
    // It does own them: the exact-entry input and the four controls are its descendants.
    const interactive = container.queryAll(isInteractive);
    expect(interactive.filter((node) => node.type === 'TextInput')).toHaveLength(1);
    expect(interactive.filter((node) => node.props.accessibilityRole === 'button')).toHaveLength(4);
    // And nothing on the path from the container down to any of them is an accessibility element,
    // so no ancestor can group or suppress them for VoiceOver or TalkBack.
    for (const control of interactive) {
      let parent = control.parent;
      while (parent !== null && parent !== container) {
        expect(isAccessibilityElement(parent)).toBe(false);
        parent = parent.parent;
      }
    }
    // Every one of them is itself a native accessibility element (implicitly for the input).
    for (const control of interactive) {
      expect(control.props.accessible === true || control.type === 'TextInput').toBe(true);
    }

    await act(async () => {
      view.unmount();
    });
  });

  it('the summary is its own accessibility element, states stance and preview, carries the actions, and contains nothing interactive', async () => {
    const store = temporalTestStore({ liveHead: 8, temporal: { kind: 'PINNED', at: sessionPosition(2) } });
    const preview = createTemporalPreviewController();
    preview.preview(fullyDisclosedTargeting(store), 6, 'EXACT_ENTRY');
    const view = await render(<TemporalNavigator store={store} preview={preview} track={trackOf('session-1', 8)} />);
    const summary = view.getByTestId(TEMPORAL_SUMMARY_TEST_ID) as unknown as HostNode;

    expect(summary.props.accessible).toBe(true);
    expect(summary.props.accessibilityLabel).toBe('Temporal navigation');
    // Preview vs commit wording, and the committed sentence unchanged beside it.
    expect((summary.props.accessibilityValue as { text: string }).text).toBe('Previewing Moment 6. Not committed. Pinned to Moment 2.');
    expect((summary.props.accessibilityActions as { name: string }[]).map((action) => action.name)).toEqual([
      'preview-later-moment',
      'commit-previewed-moment',
      'cancel-preview',
      'commit-live-edge',
    ]);
    // A leaf: there is nothing beneath it for `accessible` to group.
    expect(summary.queryAll(isInteractive)).toHaveLength(0);
    expect(summary.queryAll((node) => node !== summary && isAccessibilityElement(node))).toHaveLength(0);

    // The actions on the summary and the sibling controls converge on the same Product authority.
    await fireAction(view.getByTestId(TEMPORAL_SUMMARY_TEST_ID), 'commit-previewed-moment');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 6 });
    expect(store.getState().history).toHaveLength(1);

    await act(async () => {
      view.unmount();
    });
  });

  it('keeps PINNED(LH) and FOLLOW_LIVE distinguishable on the summary at the same Session Position', async () => {
    const following = temporalTestStore({ liveHead: 4 });
    const pinned = temporalTestStore({ liveHead: 4 });
    commitMoment(pinned, 4);
    const preview = createTemporalPreviewController();
    const a = await render(<TemporalNavigator store={following} preview={preview} track={trackOf('session-1', 4)} />);
    const b = await render(<TemporalNavigator store={pinned} preview={createTemporalPreviewController()} track={trackOf('session-1', 4)} />);
    const spokenA = a.getByTestId(TEMPORAL_SUMMARY_TEST_ID).props.accessibilityValue.text;
    const spokenB = b.getByTestId(TEMPORAL_SUMMARY_TEST_ID).props.accessibilityValue.text;
    expect(spokenA).toBe('Following the live edge, currently Moment 4');
    expect(spokenB).toBe('Pinned to Moment 4');
    expect(spokenA).not.toBe(spokenB);
    await act(async () => {
      a.unmount();
      b.unmount();
    });
  });

  it('exact entry and every control are individually accessible with truthful labels and states', async () => {
    const store = temporalTestStore({ liveHead: 8, temporal: { kind: 'PINNED', at: sessionPosition(2) } });
    const preview = createTemporalPreviewController();
    const view = await render(<TemporalNavigator store={store} preview={preview} track={trackOf('session-1', 8)} />);

    // The exact-entry input is reachable by its own label, and editable.
    const entry = view.getByLabelText('Exact Moment number');
    expect(entry).toBe(view.getByTestId(TEMPORAL_EXACT_ENTRY_TEST_ID));
    expect(entry.props.accessible).not.toBe(false);
    expect(entry.props.editable).not.toBe(false);
    expect(entry.props.accessibilityHint).toBe('Enter a Moment number from 1 to 8. This previews the Moment; it does not go to it.');

    // Each control is a button of its own, with a state that tells the truth about availability.
    expect(view.getByRole('button', { name: 'Preview the next later Moment', disabled: false })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Go to the live edge', disabled: false })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Go to the previewed Moment', disabled: true })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Cancel the preview', disabled: true })).toBeTruthy();

    // Pointer and non-pointer convergence: the exact entry previews, the sibling control commits.
    await act(async () => {
      fireEvent.changeText(entry, '5');
    });
    await act(async () => {
      fireEvent(entry, 'submitEditing');
    });
    expect(view.getByRole('button', { name: 'Go to the previewed Moment', disabled: false })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Cancel the preview', disabled: false })).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Go to the previewed Moment' }));
    });
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 5 });
    expect(store.getState().history).toHaveLength(1);

    await act(async () => {
      view.unmount();
    });
  });
});
