/**
 * T-08 — M: mixed chains.
 *
 * Single acts are proven elsewhere; these are the sequences where an orientation surface usually
 * goes wrong — a restored viewpoint that the chrome keeps describing with pre-restoration truth, a
 * passive live event that grows a fake history, a projection handoff that shows a stale semantic
 * frame for one render.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { latestReturnCheckpoint, returnWorld } from '../../return-navigation';
import { decodeInspectionRef } from '../../map';
import { CONTEXT_CHOICE_TEST_ID, INSPECTION_ORIENTATION_TEST_ID } from '../InspectionOrientation';
import { ORIENTATION_CHROME_TEST_ID, OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { bindExactReturnOrigin } from '../exact-return-origin';
import { orientationModel } from '../model';
import { beginInspectionJourney, chromeStore, chromeSurface, contextAt, fetched, historicalStore, inspect, known, projectionFor, TWO_CONTEXT_WORLD, withInspection } from '../__fixtures__/chrome';

const DISCLOSED = () => withInspection(TWO_CONTEXT_WORLD(), known());

const reader = (): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });

const statementOf = (view: Awaited<ReturnType<typeof render>>): string =>
  view.getByTestId(`${INSPECTION_ORIENTATION_TEST_ID}:statement`).props.children as string;

describe('OC08-M — inspection chains', () => {
  it('M111, M117 — a context switch then Back restores the prior context, and the chrome follows', async () => {
    const store = historicalStore();
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-a' } });
    const projection = projectionFor(store, fetched(DISCLOSED()));
    const surface = chromeSurface(store);
    const view = await render(<OrientationChrome language="en" surface={surface} projection={projection} />);

    const model = orientationModel(store, projection);
    const other = model.context.appearances.find((option) => option.bindingId === 'binding-b')!;
    await act(async () => {
      fireEvent.press(view.getByTestId(`${CONTEXT_CHOICE_TEST_ID}:option:${other.ordinal}`));
    });
    expect(decodeInspectionRef(store.getState().inspection)?.appearance?.bindingId).toBe('binding-b');
    const selectedAfterSwitch = view.getByTestId(`${CONTEXT_CHOICE_TEST_ID}:option:${other.ordinal}`).props.accessibilityState.selected;
    expect(selectedAfterSwitch).toBe(true);

    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:BACK_ONE_STEP`));
    });

    // The chrome describes the RESTORED truth, not the truth it was showing a moment ago.
    expect(decodeInspectionRef(store.getState().inspection)?.appearance?.bindingId).toBe('binding-a');
    expect(view.getByTestId(`${CONTEXT_CHOICE_TEST_ID}:option:${other.ordinal}`).props.accessibilityState.selected).toBe(false);
    expect(statementOf(view)).toContain('You are inspecting a reading.');

    await act(async () => {
      view.unmount();
    });
  });

  it('M111b — Exact Return updates the chrome from the restored viewpoint', async () => {
    const store = reader();
    const surface = chromeSurface(store);
    // T-12 §14 — the origin is the checkpoint the inspection journey STARTED from, so the journey
    // begins first and its own checkpoint is what is bound. The Live Focus return below then adds a
    // newer one, which is what makes "consumes it and everything newer" observable here.
    const target = beginInspectionJourney(store, DISCLOSED());
    const projection = projectionFor(store, fetched(DISCLOSED()));
    const view = await render(<OrientationChrome language="en" surface={surface} projection={projection} />);

    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_LIVE_FOCUS`));
    });
    const origin = bindExactReturnOrigin(store, target);
    const movedCamera = store.getState().camera;

    await act(async () => {
      view.rerender(<OrientationChrome language="en" surface={surface} projection={projection} exactReturnOrigin={origin} />);
    });
    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`));
    });

    expect(store.getState().camera).not.toEqual(movedCamera);
    expect(store.getState().history).toHaveLength(0);
    // The opportunity retires itself the moment its checkpoint is consumed: it is no longer offered.
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`)).toBeNull();

    await act(async () => {
      view.unmount();
    });
  });
});

describe('OC08-M — Live chains', () => {
  it('M112, M118 — Live advancing while pinned changes the generic meta and grows no fake history', async () => {
    const store = reader();
    const projection = projectionFor(store, fetched(DISCLOSED()));
    const view = await render(<OrientationChrome language="en" surface={chromeSurface(store)} projection={projection} />);
    expect(view.getByTestId(`${ORIENTATION_CHROME_TEST_ID}:live`)).toBeTruthy();

    await act(async () => {
      store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: sessionPosition(9) });
      store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-future' }, atSp: sessionPosition(9) });
    });

    // Still only the generic statement, and still no name for where Live went.
    expect(view.getByTestId(`${ORIENTATION_CHROME_TEST_ID}:live`).props.children).toBe('The conversation has continued since this moment.');
    expect(JSON.stringify(view.toJSON())).not.toContain('thread-future');
    // M118 — passive authoritative events are not the reader's own transactions.
    expect(store.getState().history).toEqual([]);
    // The Live Focus act is no longer meaningful, so it is simply gone — and its disappearance says
    // nothing about why, because a future Live Focus and no Live Focus retire it identically.
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_LIVE_FOCUS`)).toBeNull();

    await act(async () => {
      view.unmount();
    });
  });

  it('M113 — returning to the live focus moves the camera and leaves the reader pinned', async () => {
    const store = reader();
    const view = await render(<OrientationChrome language="en" surface={chromeSurface(store)} projection={projectionFor(store, fetched(DISCLOSED()))} />);
    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_LIVE_FOCUS`));
    });
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });
    expect(view.getByTestId(`${ORIENTATION_CHROME_TEST_ID}:temporal`).props.children).toBe('Reading at moment 4.');

    await act(async () => {
      view.unmount();
    });
  });

  it('M114, M115 — Live Head moves nothing spatial, and Back restores the exact prior orientation', async () => {
    const store = reader();
    const surface = chromeSurface(store);
    const projection = projectionFor(store, fetched(DISCLOSED()));
    const view = await render(<OrientationChrome language="en" surface={surface} projection={projection} />);
    const before = store.getState();
    const temporalLine = view.getByTestId(`${ORIENTATION_CHROME_TEST_ID}:temporal`).props.children;
    const spatialLine = view.getByTestId(`${ORIENTATION_CHROME_TEST_ID}:spatial`).props.children;

    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_LIVE_HEAD`));
    });
    // M114 — the camera and the inspection did not magically move.
    expect(store.getState().camera).toBe(before.camera);
    expect(store.getState().inspection).toBe(before.inspection);
    expect(view.getByTestId(`${ORIENTATION_CHROME_TEST_ID}:temporal`).props.children).toBe('Following the conversation as it continues.');
    expect(view.getByTestId(`${ORIENTATION_CHROME_TEST_ID}:spatial`).props.children).toBe(spatialLine);

    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:BACK_ONE_STEP`));
    });
    // M115 — the exact prior historical orientation, restated by the chrome.
    expect(view.getByTestId(`${ORIENTATION_CHROME_TEST_ID}:temporal`).props.children).toBe(temporalLine);
    expect(store.getState().history).toEqual([]);

    await act(async () => {
      view.unmount();
    });
  });

  it('M116 — Return to World then Back restores the prior depth, and the chrome restates it', async () => {
    const store = reader();
    const surface = chromeSurface(store);
    const view = await render(<OrientationChrome language="en" surface={surface} projection={projectionFor(store, fetched(DISCLOSED()))} />);
    expect(view.getByTestId(`${ORIENTATION_CHROME_TEST_ID}:spatial`).props.children).toBe('Showing readings and findings.');

    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_WORLD`));
    });
    expect(view.getByTestId(`${ORIENTATION_CHROME_TEST_ID}:spatial`).props.children).toBe('Looking at the whole world.');

    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:BACK_ONE_STEP`));
    });
    expect(view.getByTestId(`${ORIENTATION_CHROME_TEST_ID}:spatial`).props.children).toBe('Showing readings and findings.');
    expect(store.getState().camera.depth).toBe('ANALYTICAL_OBJECT');

    await act(async () => {
      view.unmount();
    });
  });
});

describe('OC08-M — projection handoff', () => {
  it('M119 — a stale-to-fresh handoff never shows a stale semantic frame', async () => {
    const store = historicalStore();
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-a' } });
    const surface = chromeSurface(store);

    // Start with a projection for a position the reader is not at.
    const view = await render(
      <OrientationChrome language="en" surface={surface} projection={{ held: true, context: contextAt(withInspection(TWO_CONTEXT_WORLD({ tc: 3 }), known())) }} />,
    );
    expect(statementOf(view)).toBe('Catching up with where you are.');
    expect(view.queryByTestId(CONTEXT_CHOICE_TEST_ID)).toBeNull();

    // The matching disclosure arrives.
    await act(async () => {
      view.rerender(<OrientationChrome language="en" surface={surface} projection={projectionFor(store, fetched(DISCLOSED()))} />);
    });
    expect(statementOf(view)).toContain('You are inspecting a reading.');
    expect(view.queryByTestId(CONTEXT_CHOICE_TEST_ID)).not.toBeNull();

    // And back again: the semantic frame is retired, not kept warm.
    await act(async () => {
      view.rerender(
        <OrientationChrome language="en" surface={surface} projection={{ held: true, context: contextAt(withInspection(TWO_CONTEXT_WORLD({ tc: 3 }), known())) }} />,
      );
    });
    expect(statementOf(view)).toBe('Catching up with where you are.');
    expect(JSON.stringify(view.toJSON())).not.toContain('binding-a');

    await act(async () => {
      view.unmount();
    });
  });

  it('M119b — a returning World act mid-chain leaves no stale inspection claim behind', async () => {
    const store = historicalStore();
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1' });
    const surface = chromeSurface(store);
    const view = await render(<OrientationChrome language="en" surface={surface} projection={projectionFor(store, fetched(DISCLOSED()))} />);
    expect(statementOf(view)).toContain('You are inspecting a reading.');

    await act(async () => {
      returnWorld(surface);
    });
    // The rung changed, so the held disclosure is no longer this Map: technical, never an absence.
    expect(statementOf(view)).toBe('Catching up with where you are.');
    // The exact requested inspection is untouched by any of it.
    expect(decodeInspectionRef(store.getState().inspection)?.id).toBe('reading-1');

    await act(async () => {
      view.unmount();
    });
  });
});
