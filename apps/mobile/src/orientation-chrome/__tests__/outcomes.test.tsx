/**
 * T-08 — H: Preview precedence, no-ops and outcomes.
 *
 * T-08 duplicates none of this. It calls the public executors and observes what they answer: the
 * Preview is cancelled by T-07's own entry gate, a no-op stays a no-op, and a technical refusal is
 * never converted into a statement about the world. There is no raw store dispatch anywhere.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { returnWorld, type ReturnOutcome } from '../../return-navigation';
import { OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { countingStore, openPreview } from '../../return-navigation/__fixtures__/return';
import { createTemporalPreviewController } from '../../temporal-navigation';
import { chromeStore, chromeSurface, fetched, projectionFor, TWO_CONTEXT_WORLD } from '../__fixtures__/chrome';
import type { ReturnOpportunityId } from '../types';

const reader = (): CanonicalStore =>
  chromeStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(4) }, depth: 'ANALYTICAL_OBJECT' });

describe('OC08-H — Preview precedence is T-07\'s, and is not duplicated', () => {
  it.each<[string, ReturnOpportunityId]>([
    ['H71 — Back', 'BACK_ONE_STEP'],
    ['H72 — Return to Live Head', 'RETURN_LIVE_HEAD'],
    ['H73 — Return to World', 'RETURN_WORLD'],
  ])('%s cancels the open Preview through ONE public executor and records nothing for it', async (_name, id) => {
    const counting = countingStore(reader());
    const preview = createTemporalPreviewController();
    const surface = chromeSurface(counting.store, preview);
    // Give Back something to reverse, before the preview is opened. Return to World also leaves the
    // camera at the WORLD rung, so the held disclosure is re-derived for that viewpoint below.
    if (id === 'BACK_ONE_STEP') returnWorld(surface);
    openPreview(counting.store, preview, 3);
    expect(preview.getSnapshot().status).toBe('PREVIEWING');
    const historyBefore = counting.store.getState().history.length;
    const dispatchesBefore = counting.counts.returns;

    const depth = counting.store.getState().camera.depth;
    const view = await render(
      <OrientationChrome language="en" surface={surface} projection={projectionFor(counting.store, fetched(TWO_CONTEXT_WORLD({ depth })))} />,
    );
    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:${id}`));
    });

    // The ephemeral intent is gone, and discarding it recorded nothing of its own.
    expect(preview.getSnapshot().status).toBe('IDLE');
    // Exactly one canonical return transaction, or none when the act was legitimately unavailable.
    expect(counting.counts.returns - dispatchesBefore).toBeLessThanOrEqual(1);
    expect(counting.store.getState().history.length - historyBefore).toBeLessThanOrEqual(1);

    await act(async () => {
      view.unmount();
    });
  });
});

describe('OC08-H — no-ops and refusals', () => {
  it('H74 — a no-op creates no fake canonical state and no fake reversible step', async () => {
    // A reader already at the World viewpoint: Return to World is a true no-op.
    const store = chromeStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(4) }, depth: 'WORLD' });
    const before = store.getState();
    const outcomes: ReturnOutcome[] = [];
    const view = await render(
      <OrientationChrome language="en"
        surface={chromeSurface(store)}
        projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD({ depth: 'WORLD' })))}
        onReturnOutcome={(_id, outcome) => outcomes.push(outcome)}
      />,
    );
    // The act is not even offered, because the camera is already exactly there — so there is no
    // control to press and no route to the executor at all.
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_WORLD`)).toBeNull();
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toEqual([]);
    // No selected state, no acknowledgement state, no canonical-looking residue.
    expect(outcomes).toEqual([]);

    await act(async () => {
      view.unmount();
    });
  });

  it('H74b — a genuine no-op from the executor still changes no canonical state', async () => {
    const store = reader();
    const outcomes: ReturnOutcome[] = [];
    const view = await render(
      <OrientationChrome language="en"
        surface={chromeSurface(store)}
        projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD()))}
        onReturnOutcome={(_id, outcome) => outcomes.push(outcome)}
      />,
    );
    // Back is offered only when something is reversible; nothing is, so it is absent.
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:BACK_ONE_STEP`)).toBeNull();
    expect(store.getState().history).toEqual([]);

    await act(async () => {
      view.unmount();
    });
  });

  it('H75 — a stale projection stays technical and never becomes a semantic absence', async () => {
    const store = reader();
    const view = await render(
      <OrientationChrome language="en" surface={chromeSurface(store)} projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD({ tc: 3 })))} />,
    );
    // The disclosure does not describe this viewpoint, so the Live Focus act is not offered — and
    // the reason is technical, never "there is nowhere to go".
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_LIVE_FOCUS`)).toBeNull();
    expect(JSON.stringify(view.toJSON())).not.toContain('nowhere');

    await act(async () => {
      view.unmount();
    });
  });
});

describe('OC08-H — the observer is an observer', () => {
  it('H77 — an absent outcome observer never suppresses the act itself', async () => {
    const store = reader();
    const view = await render(<OrientationChrome language="en" surface={chromeSurface(store)} projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD()))} />);
    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_WORLD`));
    });
    // No observer was attached, and the act still happened.
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().camera.depth).toBe('WORLD');

    await act(async () => {
      view.unmount();
    });
  });

  it('H78 — the observer is notified AFTER execution, with the executor\'s own typed answer', async () => {
    const store = reader();
    const seen: { id: ReturnOpportunityId; outcome: ReturnOutcome; historyAtCall: number }[] = [];
    const view = await render(
      <OrientationChrome language="en"
        surface={chromeSurface(store)}
        projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD()))}
        onReturnOutcome={(id, outcome) => seen.push({ id, outcome, historyAtCall: store.getState().history.length })}
      />,
    );
    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_WORLD`));
    });

    expect(seen).toHaveLength(1);
    expect(seen[0].id).toBe('RETURN_WORLD');
    expect(seen[0].outcome.outcome).toBe('APPLIED');
    // The act had already been applied when the observer ran.
    expect(seen[0].historyAtCall).toBe(1);

    await act(async () => {
      view.unmount();
    });
  });
});
