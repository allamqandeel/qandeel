/**
 * T-10 / Q1 — the frozen `PAN` mechanic, proven against the UI-runtime drag route.
 *
 * The whole point of this file is that T-04's Product semantics are UNCHANGED by the move onto the
 * UI runtime. One completed drag is one canonical `PAN`, at the actual end of the gesture, from the
 * finger's own reported total translation. Every other ending — cancelled, failed, never activated,
 * unmounted before the crossing arrives — dispatches nothing at all.
 *
 * The gesture's own callbacks are driven directly, which is what Gesture Handler's test utilities
 * do underneath: these are the exact worklets the recognizer calls on a device.
 */
import { act, render } from '@testing-library/react-native';

import { envelope, testStore } from '../../map/__fixtures__/store';
import { currentCamera, envelopeCenter, panFromTranslation, useMapPanGesture, type MapPanGestureBinding } from '../../map';
import type { MapActionOutcome } from '../../map';
import type { CanonicalStore } from '../../state';
import { stubPresentationCamera, type StubPresentationCamera } from '../__fixtures__/presentation-camera';

interface Driver {
  readonly begin: () => Promise<void>;
  readonly change: (dx: number, dy: number) => Promise<void>;
  readonly end: (translationX: number, translationY: number, success?: boolean, velocity?: number) => Promise<void>;
  readonly finalize: (success: boolean) => Promise<void>;
}

interface Harness {
  readonly camera: StubPresentationCamera;
  readonly outcomes: MapActionOutcome[];
  readonly renders: () => number;
  readonly gestures: () => number;
  readonly drive: () => Driver;
  readonly rerender: (props: { store?: CanonicalStore; onSettled?: (outcome: MapActionOutcome) => void }) => Promise<void>;
  readonly unmount: () => Promise<void>;
}

async function mount(initialStore: CanonicalStore, options: { enabled?: boolean } = {}): Promise<Harness> {
  const camera = stubPresentationCamera({ center: envelopeCenter(envelope()) });
  const outcomes: MapActionOutcome[] = [];
  let renders = 0;
  const seen = new Set<unknown>();
  const held: { current: MapPanGestureBinding | null } = { current: null };

  function Probe({ store, onSettled }: { store: CanonicalStore; onSettled: (outcome: MapActionOutcome) => void }) {
    renders += 1;
    const binding = useMapPanGesture(store, { enabled: options.enabled ?? true, camera, onSettled });
    held.current = binding;
    seen.add(binding.gesture);
    return null;
  }

  const record = (outcome: MapActionOutcome) => {
    outcomes.push(outcome);
  };
  const view = await render(<Probe store={initialStore} onSettled={record} />);

  // Gesture Handler exposes its callbacks on the gesture object; these are the exact worklets the
  // recognizer calls on a device, which is what its own test utilities drive underneath.
  interface GestureCallbacks {
    onBegin?: (event: unknown) => void;
    onChange?: (event: unknown) => void;
    onEnd?: (event: unknown, success: boolean) => void;
    onFinalize?: (event: unknown, success: boolean) => void;
  }
  const handlers = (): GestureCallbacks => (held.current as unknown as { gesture: { handlers: GestureCallbacks } }).gesture.handlers;
  const drive = (): Driver => ({
    begin: async () => {
      await act(async () => {
        handlers().onBegin?.({});
      });
    },
    change: async (dx: number, dy: number) => {
      await act(async () => {
        handlers().onChange?.({ changeX: dx, changeY: dy, translationX: dx, translationY: dy });
      });
    },
    end: async (translationX: number, translationY: number, success = true, velocity = 0) => {
      await act(async () => {
        handlers().onEnd?.({ translationX, translationY, velocityX: velocity, velocityY: velocity }, success);
      });
    },
    finalize: async (success: boolean) => {
      await act(async () => {
        handlers().onFinalize?.({}, success);
      });
    },
  });

  return {
    camera,
    outcomes,
    renders: () => renders,
    gestures: () => seen.size,
    drive,
    rerender: async (props) => {
      await act(async () => {
        view.rerender(<Probe store={props.store ?? initialStore} onSettled={props.onSettled ?? record} />);
      });
    },
    unmount: async () => {
      await act(async () => {
        view.unmount();
      });
    },
  };
}

const acts = (store: CanonicalStore) => store.getState().history.map((entry) => entry.act);

describe('T10-A01…A12 — one completed drag is one canonical PAN, and nothing else is', () => {
  it('A01, A02 — the finger moves the plane 1:1, with no easing between hand and world', async () => {
    const store = testStore();
    const harness = await mount(store);
    const driver = harness.drive();
    await driver.begin();
    await driver.change(12, -5);
    await driver.change(7, 3);
    await driver.change(-4, 11);
    // Every point the finger reported reached the plane, exactly, in order, with nothing added.
    expect(harness.camera.drag).toEqual({ x: 15, y: 9 });
    expect(harness.camera.counts.drag).toBe(3);
    expect(harness.camera.counts.grab).toBe(1);
  });

  it('A03 — a successful drag dispatches exactly one PAN', async () => {
    const store = testStore();
    const harness = await mount(store);
    const driver = harness.drive();
    await driver.begin();
    for (const frame of [4, 9, 16, 25, 36]) await driver.change(frame, 0);
    expect(acts(store)).toEqual([]);
    await driver.end(90, 0);
    await driver.finalize(true);
    expect(acts(store)).toEqual(['PAN']);
    expect(harness.outcomes).toHaveLength(1);
  });

  it('A04 — the PAN carries the finger translation, never a projected velocity', async () => {
    const store = testStore();
    const before = currentCamera(store);
    if (!before.ok) throw new Error(before.detail);
    const expected = panFromTranslation(before.camera, 44, -18);
    if (expected.outcome !== 'INTENT') throw new Error('fixture expectation is not an intent');

    const harness = await mount(store);
    const driver = harness.drive();
    await driver.begin();
    await driver.change(44, -18);
    // A large release velocity in both axes, which a momentum implementation would fold in.
    await driver.end(44, -18, true, 4200);
    const after = currentCamera(store);
    if (!after.ok) throw new Error(after.detail);
    expect(after.camera.anchor.x).toBe(expected.anchor.x);
    expect(after.camera.anchor.y).toBe(expected.anchor.y);
  });

  it('A05 — nothing dispatches after the gesture ends: there is no settle commit', async () => {
    const store = testStore();
    const harness = await mount(store);
    const driver = harness.drive();
    await driver.begin();
    await driver.change(60, 0);
    await driver.end(60, 0);
    await driver.finalize(true);
    expect(acts(store)).toEqual(['PAN']);
    // Whatever the presentation does from here — resolve, rebase, rest — it reaches no act.
    await act(async () => {
      harness.camera.applyCanonicalChange({ k: 1, destination: { x: -60, y: 0 }, depthChanged: false });
      harness.camera.resolveToRest();
    });
    expect(acts(store)).toEqual(['PAN']);
    expect(harness.outcomes).toHaveLength(1);
  });

  it('A06 — a cancelled drag dispatches no PAN and returns the plane to canonical truth', async () => {
    const store = testStore();
    const harness = await mount(store);
    const driver = harness.drive();
    await driver.begin();
    await driver.change(120, 40);
    await driver.end(120, 40, false);
    await driver.finalize(false);
    expect(acts(store)).toEqual([]);
    expect(store.getState().history).toHaveLength(0);
    expect(harness.camera.counts.resolveToRest).toBeGreaterThanOrEqual(1);
    expect(harness.camera.residual()).toEqual({ tx: 0, ty: 0, zoom: 1 });
  });

  it('A07 — a gesture that never activated dispatches no PAN', async () => {
    const store = testStore();
    const harness = await mount(store);
    const driver = harness.drive();
    await driver.begin();
    await driver.finalize(false);
    expect(acts(store)).toEqual([]);
  });

  it('A08 — an unmount before the crossing arrives dispatches no late PAN', async () => {
    const store = testStore();
    const harness = await mount(store);
    const driver = harness.drive();
    await driver.begin();
    await driver.change(80, 0);
    await harness.unmount();
    await driver.end(80, 0);
    expect(acts(store)).toEqual([]);
    expect(store.getState().history).toHaveLength(0);
  });

  it('A09 — a replaced store receives the act; the store the reader left does not', async () => {
    const first = testStore({ sessionId: 'session-1' });
    const second = testStore({ sessionId: 'session-2' });
    const harness = await mount(first);
    const driver = harness.drive();
    await driver.begin();
    await driver.change(70, 0);
    // The store is replaced WHILE the drag is in flight, and the same gesture object finishes it.
    await harness.rerender({ store: second });
    await driver.end(70, 0);
    expect(acts(first)).toEqual([]);
    expect(acts(second)).toEqual(['PAN']);
  });

  it('A10 — a changing observer neither rebuilds the gesture nor duplicates a completion', async () => {
    const store = testStore();
    const harness = await mount(store);
    const seenA: MapActionOutcome[] = [];
    const seenB: MapActionOutcome[] = [];
    await harness.rerender({ onSettled: (outcome) => seenA.push(outcome) });
    await harness.rerender({ onSettled: (outcome) => seenB.push(outcome) });
    const driver = harness.drive();
    await driver.begin();
    await driver.change(50, 0);
    await driver.end(50, 0);
    await driver.finalize(true);
    // ONE gesture object across every render, so the recognizer is never re-attached mid-drag.
    expect(harness.gestures()).toBe(1);
    expect(seenA).toHaveLength(0);
    expect(seenB).toHaveLength(1);
    expect(acts(store)).toEqual(['PAN']);
  });

  it('A11, A12 — a whole drag costs zero React renders and zero crossings to the Product runtime', async () => {
    const store = testStore();
    const harness = await mount(store);
    const before = harness.renders();
    const driver = harness.drive();
    await driver.begin();
    for (let frame = 0; frame < 60; frame += 1) await driver.change(2, 1);
    // Sixty gesture frames: no render, no act, no outcome, no canonical read that changed anything.
    expect(harness.renders()).toBe(before);
    expect(harness.outcomes).toHaveLength(0);
    expect(store.getState().history).toHaveLength(0);
    await driver.end(120, 60);
    expect(harness.outcomes).toHaveLength(1);
    expect(acts(store)).toEqual(['PAN']);
  });

  it('a movement too small to be an act changes nothing and still comes home', async () => {
    const store = testStore();
    const harness = await mount(store);
    const driver = harness.drive();
    await driver.begin();
    await driver.change(0, 0);
    await driver.end(0, 0);
    expect(acts(store)).toEqual([]);
    expect(harness.outcomes[0]).toEqual({ outcome: 'NO_OP' });
    // NO canonical camera moved, so the presentation must not be left displaced from truth.
    expect(harness.camera.counts.resolveToRest).toBe(1);
  });

  it('a drag on a surface with no usable projection is not offered at all', async () => {
    const store = testStore();
    const harness = await mount(store, { enabled: false });
    expect(harness.camera.counts.grab).toBe(0);
    expect(acts(store)).toEqual([]);
  });
});
