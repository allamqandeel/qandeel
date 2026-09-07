/**
 * T-08 — B: the six returns stay six experientially distinct Product acts.
 *
 * Distinctness is proven by EFFECT, not by watching which function was called: each control is
 * pressed on the same starting viewpoint and the resulting canonical state is compared. A control
 * that had been wired to the wrong executor, or two that had collapsed into one, would produce the
 * wrong effect or the same effect — and both are visible here.
 *
 * Every press is also counted at the canonical return seam, so "one Product act is one transaction"
 * is measured rather than asserted.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { cameraIntentEquals, sessionPosition, type CanonicalState, type CanonicalStore } from '../../state';
import { initialCameraIntent } from '../../map';
import { latestReturnCheckpoint, returnMapContext, type ReturnCheckpointTarget } from '../../return-navigation';
import type { MapProjectionRequest } from '../../map';
import { OrientationChrome } from '../OrientationChrome';
import { bindExactReturnOrigin } from '../exact-return-origin';
import { returnMeaning } from '../return-orientation';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { RETURN_OPPORTUNITY_IDS, type ReturnOpportunityId } from '../types';
import { countingStore } from '../../return-navigation/__fixtures__/return';
import { chromeStore, chromeSurface, fetched, projectionFor, TWO_CONTEXT_WORLD } from '../__fixtures__/chrome';

/** A historical reader whose live focus IS disclosed here, so all six are reachable in one fixture. */
const reader = (): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });

const viewpoint = (state: CanonicalState) => ({ temporal: state.temporal, inspection: state.inspection, camera: state.camera });

/**
 * The disclosed projection of the LIVE viewpoint (TC = LH = 6), so the composite act's spatial half
 * has somewhere real to land. Without a provider the composite is legitimately temporal-only, which
 * is proven separately.
 */
const liveProvider = (request: MapProjectionRequest) => returnMapContext(fetched(TWO_CONTEXT_WORLD({ tc: 6, liveHead: 6 })), request);

async function press(store: CanonicalStore, id: ReturnOpportunityId, target?: ReturnCheckpointTarget | null) {
  // The opportunity is bound against the store the journey happened in, exactly as a caller would.
  const origin = target === undefined || target === null ? null : bindExactReturnOrigin(store, target);
  const view = await render(
    <OrientationChrome
      surface={chromeSurface(store)}
      projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD()))}
      exactReturnOrigin={origin}
      liveContext={liveProvider}
    />,
  );
  await act(async () => {
    fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:${id}`));
  });
  await act(async () => {
    view.unmount();
  });
}

describe('OC08-B — each control reaches exactly one frozen act', () => {
  it('B11, B18 — Return to Live Head moves time only, and moves neither camera nor inspection', async () => {
    const store = reader();
    const before = store.getState();
    await press(store, 'RETURN_LIVE_HEAD');
    const after = store.getState();
    expect(after.temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    // Object identity: the act did not merely leave them equal, it did not touch them.
    expect(after.camera).toBe(before.camera);
    expect(after.inspection).toBe(before.inspection);
    expect(after.history).toHaveLength(1);
  });

  it('B12, B19 — Return to Live Focus moves the camera only, and never the temporal position', async () => {
    const store = reader();
    const before = store.getState();
    await press(store, 'RETURN_LIVE_FOCUS');
    const after = store.getState();
    expect(after.temporal).toBe(before.temporal);
    expect(after.temporal).toEqual({ kind: 'PINNED', at: 4 });
    expect(after.camera).not.toBe(before.camera);
    // Spatial only: the rung the reader discloses at is not changed by going somewhere.
    expect(after.camera.depth).toBe(before.camera.depth);
  });

  it('B13, B17 — Return to World is the canonical World camera at the same moment, and is not Back', async () => {
    const store = reader();
    const before = store.getState();
    await press(store, 'RETURN_WORLD');
    const after = store.getState();
    expect(cameraIntentEquals(after.camera, initialCameraIntent())).toBe(true);
    expect(after.temporal).toBe(before.temporal);
    // Back would have restored a recorded checkpoint; World appends one instead.
    expect(after.history).toHaveLength(1);
  });

  it('B14, B20 — the composite is ONE transaction that moves time AND camera together', async () => {
    const counting = countingStore(reader());
    const before = counting.store.getState();
    await press(counting.store, 'GO_LIVE_AND_LOCATE');
    const after = counting.store.getState();
    expect(counting.counts.returns).toBe(1);
    expect(after.temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(after.camera).not.toBe(before.camera);
    // One act, therefore exactly one reversible step.
    expect(after.history).toHaveLength(1);
  });

  it('B9, B16 — Back reverses the latest step and never means Live', async () => {
    const store = reader();
    const start = viewpoint(store.getState());
    await press(store, 'RETURN_WORLD');
    expect(store.getState().history).toHaveLength(1);

    await press(store, 'BACK_ONE_STEP');
    const after = store.getState();
    expect(after.history).toHaveLength(0);
    expect(viewpoint(after)).toEqual(start);
    // Back restored a PINNED viewpoint; it did not attach the reader to Live.
    expect(after.temporal).toEqual({ kind: 'PINNED', at: 4 });
  });

  it('B10 — Exact Return restores the named checkpoint and consumes it and everything newer', async () => {
    const store = reader();
    const start = viewpoint(store.getState());
    // The spatial act first, while the held projection is still this viewpoint's: Return to World
    // moves the camera to the WORLD rung, after which an ANALYTICAL_OBJECT disclosure is correctly
    // no longer this Map, and the reader's own journey is what binds the target.
    await press(store, 'RETURN_LIVE_FOCUS');
    const target = latestReturnCheckpoint(store);
    expect(target).not.toBeNull();
    await press(store, 'RETURN_WORLD');
    expect(store.getState().history).toHaveLength(2);

    await press(store, 'EXACT_RETURN', target);
    const after = store.getState();
    expect(viewpoint(after)).toEqual(start);
    // The named checkpoint AND the newer one are gone; the restored viewpoint is not a Back step.
    expect(after.history).toHaveLength(0);
  });
});

describe('OC08-B — no act aliases another', () => {
  it('B15 — the six produce six different canonical outcomes from one starting viewpoint', async () => {
    const results = new Map<ReturnOpportunityId, string>();
    for (const id of RETURN_OPPORTUNITY_IDS) {
      const store = reader();
      // Give the two history acts something to reverse, so all six are genuinely exercised.
      let target: ReturnCheckpointTarget | null = null;
      if (id === 'BACK_ONE_STEP' || id === 'EXACT_RETURN') {
        await press(store, 'RETURN_LIVE_FOCUS');
        target = latestReturnCheckpoint(store);
      }
      await press(store, id, target);
      results.set(id, JSON.stringify(viewpoint(store.getState())));
    }
    // Live Head and the composite both establish FOLLOW_LIVE; they differ in the camera, and the
    // composite is the only one that moves both. Back and Exact both return to the start here, and
    // are told apart by what they consume, which B9/B10 prove separately.
    expect(results.get('RETURN_LIVE_HEAD')).not.toEqual(results.get('GO_LIVE_AND_LOCATE'));
    expect(results.get('RETURN_LIVE_FOCUS')).not.toEqual(results.get('RETURN_WORLD'));
    expect(results.get('RETURN_LIVE_HEAD')).not.toEqual(results.get('RETURN_LIVE_FOCUS'));
    expect(results.get('RETURN_WORLD')).not.toEqual(results.get('BACK_ONE_STEP'));
  });

  it('B16…B20 — every identity states its own effect and its own promises, and no two agree', () => {
    // The MEANINGS are the frozen six whether or not each is offered right now: context-sensitive
    // rendering changed which controls appear, never what any of them claims.
    const shapes = RETURN_OPPORTUNITY_IDS.map((id) => returnMeaning(id));

    expect(shapes.map((shape) => shape.id)).toEqual([...RETURN_OPPORTUNITY_IDS]);
    expect(new Set(shapes.map((shape) => shape.label)).size).toBe(6);
    expect(new Set(shapes.map((shape) => shape.hint)).size).toBe(6);

    const by = (id: ReturnOpportunityId) => returnMeaning(id);
    // Live Head promises time and NOT a location; Live Focus promises a location and NOT time.
    expect({ time: by('RETURN_LIVE_HEAD').movesTime, camera: by('RETURN_LIVE_HEAD').movesCamera }).toEqual({ time: true, camera: false });
    expect({ time: by('RETURN_LIVE_FOCUS').movesTime, camera: by('RETURN_LIVE_FOCUS').movesCamera }).toEqual({ time: false, camera: true });
    // The composite is communicated as neither half.
    expect(by('GO_LIVE_AND_LOCATE').effect).toBe('TEMPORAL_AND_SPATIAL');
    expect(by('RETURN_LIVE_HEAD').effect).toBe('TEMPORAL');
    // World is spatial; Back is history. They are never the same statement.
    expect(by('RETURN_WORLD').effect).toBe('SPATIAL');
    expect(by('BACK_ONE_STEP').effect).toBe('HISTORY');
    expect(by('RETURN_WORLD').label).not.toEqual(by('BACK_ONE_STEP').label);

    // No generic Product identity exists to stand in for any of them.
    for (const shape of shapes) {
      expect(/^(home|reset|navigate|go ?live|back or home|return)$/iu.test(shape.label.trim())).toBe(false);
    }
  });
});
