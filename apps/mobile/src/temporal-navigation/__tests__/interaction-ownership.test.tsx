/**
 * T-06 — FCR-01: scrub interaction ownership survives handler reconfiguration.
 *
 * R1-02 proves ordering safety INSIDE one coordinator. These tests prove the guarantee across the
 * boundaries React introduces: a callback queued before a rerender, an observer whose identity
 * changes on every render, a store or preview controller that is replaced, and a surface that is
 * unmounted with callbacks still in flight. None of them may reset, split or resurrect interaction
 * ownership, and none of them may reach the surface that replaced a retired one.
 *
 * Two levels are exercised. The coordinator level uses the same deterministic scheduler seam as
 * R1-02, and the React level renders the real hook inside a real `GestureDetector`, rerenders it
 * with fresh callback identities, replaces its authorities and unmounts it — holding on to the
 * handler objects an earlier render exposed, exactly as a queued `scheduleOnRN` would.
 */
import { act, render } from '@testing-library/react-native';
import { useLayoutEffect } from 'react';
import { View } from 'react-native';
import { GestureDetector, State } from 'react-native-gesture-handler';
import { fireGestureHandler } from 'react-native-gesture-handler/jest-utils';
import { useSharedValue } from 'react-native-reanimated';

import { createPresentationController, type PresentationController } from '../../timeline';
import { createTemporalPreviewController, type TemporalPreviewController } from '../preview';
import { createScrubCoordinator, createScrubHandlers, type ScrubHandlers, type ScrubObservers } from '../timeline-integration/scrub';
import { useTemporalScrub, type TemporalScrubBinding, type TemporalScrubOptions } from '../timeline-integration/useTemporalScrub';
import { fullyDisclosedTargeting, temporalTestStore, trackOf } from '../__fixtures__/temporal';

jest.setTimeout(60_000);

/** The RN-runtime queue, exactly as in R1-02: delivered only when a test says so, in any order. */
class DeferredRuntime {
  private readonly queue: { readonly label: string; readonly run: () => void }[] = [];

  push(label: string, run: () => void): void {
    this.queue.push({ label, run });
  }

  flush(...labels: readonly string[]): void {
    for (const label of labels) {
      const index = this.queue.findIndex((entry) => entry.label === label);
      if (index === -1) throw new Error(`nothing queued under ${label}`);
      const [entry] = this.queue.splice(index, 1);
      entry.run();
    }
  }
}

describe('FCR-01 — one coordinator, whatever the observers do', () => {
  function surfaceHarness(liveHead = 12) {
    const store = temporalTestStore({ liveHead });
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', liveHead), 240);
    const outcomes: string[] = [];
    // The observers a hook would hand over: swapped wholesale to simulate React reconfiguring.
    let observers: ScrubObservers = { snapshot: presentation.getSnapshot, onOutcome: (outcome) => outcomes.push(`first:${outcome.outcome}`) };
    const coordinator = createScrubCoordinator({ store, preview }, () => observers);
    const runtime = new DeferredRuntime();
    const scheduleTarget = (epoch: number, index: number, label: string) => runtime.push(label, () => coordinator.handlers.targetIndex(epoch, index));
    const scheduleSettle = (epoch: number, committed: boolean, label: string) => runtime.push(label, () => coordinator.handlers.settle(epoch, committed));
    const reconfigure = () => {
      observers = { snapshot: presentation.getSnapshot, onOutcome: (outcome) => outcomes.push(`second:${outcome.outcome}`) };
    };
    return { store, preview, presentation, coordinator, runtime, outcomes, scheduleTarget, scheduleSettle, reconfigure };
  }

  it('handler incarnation change: an old queued target cannot retarget the newer interaction', () => {
    const h = surfaceHarness();
    // Interaction A queues a target, then React replaces every observer identity.
    h.scheduleTarget(1, 4, 'A:target');
    h.reconfigure();
    // Interaction B establishes a different preview through the SAME coordinator.
    h.scheduleTarget(2, 8, 'B:target');
    h.runtime.flush('B:target');
    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 9 });

    // A's queued target runs late, after the reconfiguration.
    h.runtime.flush('A:target');

    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 9 });
    expect(h.coordinator.handlers.liveInteraction()).toMatchObject({ epoch: 2, open: true });
    expect(h.store.getState().history).toHaveLength(0);
  });

  it('old settle after reconfiguration: it neither commits nor cancels the newer interaction', () => {
    const h = surfaceHarness();
    h.scheduleTarget(1, 4, 'A:target');
    h.scheduleSettle(1, true, 'A:commit');
    h.scheduleSettle(1, false, 'A:cancel');
    h.runtime.flush('A:target');
    expect(h.preview.getSnapshot()).toMatchObject({ ptc: 5 });

    h.reconfigure();
    h.scheduleTarget(2, 8, 'B:target');
    h.runtime.flush('B:target');
    expect(h.preview.getSnapshot()).toMatchObject({ ptc: 9 });

    h.runtime.flush('A:commit', 'A:cancel');

    expect(h.store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(h.store.getState().history).toHaveLength(0);
    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 9 });
    expect(h.outcomes).toEqual([]);
  });

  it('observers are read at call time: the LATEST observer hears the outcome of an older interaction', () => {
    const h = surfaceHarness();
    h.scheduleTarget(1, 3, 'A:target');
    h.scheduleSettle(1, true, 'A:commit');
    h.runtime.flush('A:target');
    h.reconfigure();
    h.runtime.flush('A:commit');

    expect(h.store.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });
    expect(h.store.getState().history).toHaveLength(1);
    // Ownership did not reset, and the observer that is CURRENT at delivery is the one told.
    expect(h.outcomes).toEqual(['second:APPLIED']);
  });

  it('retirement makes every callback inert and discards only the retired interaction\'s own preview', () => {
    const h = surfaceHarness();
    h.scheduleTarget(1, 3, 'A:target');
    h.scheduleTarget(1, 6, 'A:late');
    h.scheduleSettle(1, true, 'A:commit');
    h.runtime.flush('A:target');
    expect(h.preview.getSnapshot()).toMatchObject({ ptc: 4 });
    const before = h.store.getState();

    h.coordinator.retire();
    // The open interaction was interrupted by the teardown: its own preview is gone, nothing moved.
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(h.store.getState()).toBe(before);
    expect(h.coordinator.handlers.liveInteraction()).toEqual({ epoch: 1, open: false, generation: null, retired: true });

    // Everything still queued for the retired surface arrives, in both orders it could.
    h.runtime.flush('A:commit', 'A:late');
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(h.store.getState()).toBe(before);
    expect(h.store.getState().history).toHaveLength(0);
    expect(h.outcomes).toEqual([]);
    // A brand-new interaction is not adopted either: retirement is one-way.
    expect(h.coordinator.handlers.targetIndex(7, 2)).toMatchObject({ outcome: 'REJECTED', code: 'INTERACTION_CLOSED' });
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
    h.coordinator.retire();
    expect(h.coordinator.handlers.liveInteraction().retired).toBe(true);
  });

  it('retirement never touches a preview the retired interaction did not establish', () => {
    const h = surfaceHarness();
    // The accessible route left a preview on the shared controller; the coordinator owns nothing.
    h.preview.preview(fullyDisclosedTargeting(h.store), 7, 'EXACT_ENTRY');
    expect(h.preview.getSnapshot()).toMatchObject({ ptc: 7 });
    h.coordinator.retire();
    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 7 });

    // Nor a preview that an interaction of its own established and then lost to another route.
    const g = surfaceHarness();
    g.coordinator.handlers.targetIndex(1, 2);
    g.preview.preview(fullyDisclosedTargeting(g.store), 9, 'EXACT_ENTRY');
    g.coordinator.retire();
    expect(g.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 9 });
  });

  it('a successor coordinator never adopts an epoch minted before its surface existed', () => {
    const store = temporalTestStore({ liveHead: 12 });
    const presentation = createPresentationController(trackOf('session-1', 12), 240);
    const first = createTemporalPreviewController();
    const second = createTemporalPreviewController();
    const observers: ScrubObservers = { snapshot: presentation.getSnapshot };

    const retired = createScrubCoordinator({ store, preview: first }, () => observers);
    retired.handlers.targetIndex(3, 2);
    retired.retire();
    // The replacement starts after everything the retired surface minted — including epochs whose
    // first callback has not even arrived yet.
    const successor = createScrubCoordinator({ store, preview: second }, () => observers, { after: 4 });

    for (const stale of [1, 3, 4]) {
      expect(successor.handlers.targetIndex(stale, 5)).toMatchObject({ outcome: 'REJECTED', code: 'INTERACTION_CLOSED' });
      successor.handlers.settle(stale, true);
    }
    expect(second.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(store.getState().history).toHaveLength(0);
    expect(successor.handlers.liveInteraction()).toMatchObject({ epoch: 4, open: false, retired: false });

    // The first genuinely new interaction is adopted normally.
    expect(successor.handlers.targetIndex(5, 5).outcome).toBe('PREVIEWING');
    expect(second.getSnapshot()).toMatchObject({ ptc: 6 });
    successor.handlers.settle(5, true);
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 6 });
    // And the retired surface's controller was never written by the successor.
    expect(first.getSnapshot()).toEqual({ status: 'IDLE' });
  });

  it('R1-02 intra-coordinator behaviour is unchanged: createScrubHandlers is the same machine over fixed dependencies', () => {
    const store = temporalTestStore({ liveHead: 12 });
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 12), 240);
    const handlers: ScrubHandlers = createScrubHandlers({ store, preview, snapshot: presentation.getSnapshot });

    handlers.targetIndex(1, 2);
    handlers.settle(1, false);
    expect(handlers.targetIndex(1, 5)).toMatchObject({ code: 'INTERACTION_CLOSED' });
    expect(handlers.liveInteraction()).toEqual({ epoch: 1, open: false, generation: null, retired: false });
    handlers.targetIndex(2, 5);
    handlers.settle(2, true);
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 6 });
  });
});

describe('FCR-01 — the real hook, rerendered, replaced and unmounted', () => {
  type PanGesture = TemporalScrubBinding['gesture'];
  type GestureEvent = Parameters<NonNullable<PanGesture['handlers']['onBegin']>>[0];
  /**
   * The gesture's own callbacks, invoked one phase at a time exactly as the UI runtime would — the
   * jest utility can only replay a COMPLETE gesture, and these tests need the phases apart.
   */
  const ui = {
    begin: (gesture: PanGesture, x: number) => gesture.handlers.onBegin?.({ x, y: 0 } as GestureEvent),
    update: (gesture: PanGesture, x: number) => gesture.handlers.onUpdate?.({ x, y: 0 } as never),
    end: (gesture: PanGesture, success: boolean) => gesture.handlers.onEnd?.({ x: 0, y: 0 } as GestureEvent, success),
    finalize: (gesture: PanGesture, success: boolean) => gesture.handlers.onFinalize?.({ x: 0, y: 0 } as GestureEvent, success),
  };

  interface SurfaceProps {
    readonly options: Omit<TemporalScrubOptions, 'fingerX' | 'tracking' | 'geometry'>;
    readonly expose: (binding: TemporalScrubBinding) => void;
  }

  /** The hook inside a real detector, exposing what each render produced — as a queued callback would keep it. */
  function Surface({ options, expose }: SurfaceProps) {
    const fingerX = useSharedValue(0);
    const tracking = useSharedValue(0);
    const binding = useTemporalScrub({ ...options, geometry: { viewport: 240, windowOffset: 0, rtl: false }, fingerX, tracking });
    useLayoutEffect(() => {
      expose(binding);
    });
    return (
      <GestureDetector gesture={binding.gesture}>
        <View testID="surface" />
      </GestureDetector>
    );
  }

  function mounted(liveHead = 12) {
    const store = temporalTestStore({ liveHead });
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', liveHead), 240);
    const bindings: TemporalScrubBinding[] = [];
    const outcomes: string[] = [];
    const optionsFor = (label: string, override: { readonly preview?: TemporalPreviewController; readonly presentation?: PresentationController } = {}) => ({
      store,
      preview: override.preview ?? preview,
      snapshot: () => (override.presentation ?? presentation).getSnapshot(),
      onOutcome: (outcome: { readonly outcome: string }) => outcomes.push(`${label}:${outcome.outcome}`),
      onCommitted: () => outcomes.push(`${label}:committed`),
      onCancelled: () => outcomes.push(`${label}:cancelled`),
    });
    const expose = (binding: TemporalScrubBinding) => bindings.push(binding);
    return { store, preview, presentation, bindings, outcomes, optionsFor, expose };
  }

  it('callback identity churn: fresh observer functions on every render never reset ownership', async () => {
    const h = mounted();
    const view = await render(<Surface options={h.optionsFor('r0')} expose={h.expose} />);
    const first = h.bindings[0].handlers;

    // Interaction 1 establishes a preview through the FIRST render's handler object.
    expect(first.targetIndex(1, 3).outcome).toBe('PREVIEWING');
    expect(h.preview.getSnapshot()).toMatchObject({ ptc: 4 });

    // Four rerenders, every observer a brand-new function each time.
    for (const label of ['r1', 'r2', 'r3', 'r4']) {
      await act(async () => {
        view.rerender(<Surface options={h.optionsFor(label)} expose={h.expose} />);
      });
    }
    const latest = h.bindings[h.bindings.length - 1].handlers;
    // One authority: the forwarder is stable, and the interaction it forwards to is still open.
    expect(latest).toBe(first);
    expect(latest.liveInteraction()).toMatchObject({ epoch: 1, open: true, retired: false });

    // The settle queued against the FIRST render's object commits the interaction it owns — and the
    // observer told about it is the one current at delivery, not the one current when it was queued.
    first.settle(1, true);
    expect(h.store.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });
    expect(h.store.getState().history).toHaveLength(1);
    expect(h.outcomes).toEqual(['r4:APPLIED', 'r4:committed']);

    await act(async () => {
      view.unmount();
    });
  });

  it('an old handler object cannot mutate the newer interaction after a rerender', async () => {
    const h = mounted();
    const view = await render(<Surface options={h.optionsFor('r0')} expose={h.expose} />);
    const old = h.bindings[0].handlers;
    old.targetIndex(1, 3);

    await act(async () => {
      view.rerender(<Surface options={h.optionsFor('r1')} expose={h.expose} />);
    });
    const current = h.bindings[h.bindings.length - 1].handlers;
    current.targetIndex(2, 8);
    expect(h.preview.getSnapshot()).toMatchObject({ ptc: 9 });

    // Everything interaction 1 could still deliver, through the object it was queued with.
    expect(old.targetIndex(1, 5)).toMatchObject({ code: 'INTERACTION_CLOSED' });
    old.settle(1, true);
    old.settle(1, false);

    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 9 });
    expect(h.store.getState().history).toHaveLength(0);
    expect(h.outcomes).toEqual([]);

    await act(async () => {
      view.unmount();
    });
  });

  it('unmount retires the surface: late callbacks create no preview and no transaction', async () => {
    const h = mounted();
    const view = await render(<Surface options={h.optionsFor('r0')} expose={h.expose} />);
    const handlers = h.bindings[0].handlers;
    handlers.targetIndex(1, 3);
    expect(h.preview.getSnapshot()).toMatchObject({ ptc: 4 });
    const before = h.store.getState();

    await act(async () => {
      view.unmount();
    });

    // The interrupted interaction's own preview is discarded at teardown; nothing canonical moved.
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(handlers.liveInteraction()).toEqual({ epoch: 0, open: false, generation: null, retired: true });

    // Callbacks that were still in flight — of the old interaction AND of one that never reported.
    handlers.settle(1, true);
    expect(handlers.targetIndex(1, 6)).toMatchObject({ outcome: 'REJECTED', code: 'INTERACTION_CLOSED' });
    expect(handlers.targetIndex(2, 6)).toMatchObject({ outcome: 'REJECTED', code: 'INTERACTION_CLOSED' });
    handlers.settle(2, true);

    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(h.store.getState()).toBe(before);
    expect(h.store.getState().history).toHaveLength(0);
    expect(h.outcomes).toEqual([]);
  });

  it('replacing the preview controller retires the old coordinator and floors the new one at the epochs already minted', async () => {
    const h = mounted();
    const view = await render(<Surface options={h.optionsFor('r0')} expose={h.expose} />);
    const handlers = h.bindings[0].handlers;
    const gesture = h.bindings[0].gesture;

    // Gesture 1 runs end to end through the real detector registry: it mints epoch 1 on the UI
    // runtime, crosses nothing (the mocked reaction delivers no crossing) and settles with no
    // target of its own — fail closed, through the forwarder, into the coordinator.
    await act(async () => {
      fireGestureHandler(gesture, [{ state: State.BEGAN, x: 30 }, { state: State.ACTIVE, x: 30 }, { state: State.END, x: 30 }]);
    });
    expect(h.outcomes).toEqual(['r0:REJECTED', 'r0:cancelled']);
    expect(handlers.liveInteraction()).toMatchObject({ epoch: 1, open: false });

    // Gesture 2 BEGINS (epoch 2 is minted on the UI runtime) and its first crossing is delivered;
    // then the preview controller is replaced beneath it while it is still open.
    ui.begin(gesture, 30);
    handlers.targetIndex(2, 3);
    expect(h.preview.getSnapshot()).toMatchObject({ ptc: 4 });

    const replacement = createTemporalPreviewController();
    await act(async () => {
      view.rerender(<Surface options={h.optionsFor('r1', { preview: replacement })} expose={h.expose} />);
    });

    // The retired surface's own open interaction was interrupted: its preview is gone.
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
    // The forwarder now reaches the successor, which sits at the epoch the UI runtime has minted.
    expect(h.bindings[h.bindings.length - 1].handlers).toBe(handlers);
    expect(handlers.liveInteraction()).toMatchObject({ epoch: 2, open: false, retired: false });

    // Gesture 2's late callbacks arrive. Epoch 2 belongs to the retired surface: never adopted.
    expect(handlers.targetIndex(2, 6)).toMatchObject({ outcome: 'REJECTED', code: 'INTERACTION_CLOSED' });
    handlers.settle(2, true);
    expect(replacement.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(h.store.getState().history).toHaveLength(0);

    // A gesture minted after the replacement is adopted, on the replacement only.
    expect(handlers.targetIndex(3, 6).outcome).toBe('PREVIEWING');
    expect(replacement.getSnapshot()).toMatchObject({ ptc: 7 });
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
    handlers.settle(3, true);
    expect(h.store.getState().temporal).toEqual({ kind: 'PINNED', at: 7 });
    expect(h.outcomes.slice(2)).toEqual(['r1:APPLIED', 'r1:committed']);

    await act(async () => {
      view.unmount();
    });
  });

  it('the gesture callbacks commit through the forwarder across a rerender, and a repeated ending is inert', async () => {
    const h = mounted();
    const view = await render(<Surface options={h.optionsFor('r0')} expose={h.expose} />);
    const gesture = h.bindings[0].gesture;
    const handlers = h.bindings[0].handlers;

    // A tap, phase by phase as the UI runtime would produce it: begin, the reaction's one crossing
    // (delivered by hand, as the mocked reaction cannot), a rerender in the middle, and the end.
    ui.begin(gesture, 100);
    expect(handlers.targetIndex(1, 2).outcome).toBe('PREVIEWING');
    await act(async () => {
      view.rerender(<Surface options={h.optionsFor('r1')} expose={h.expose} />);
    });
    ui.update(gesture, 101);
    ui.end(gesture, true);
    ui.finalize(gesture, true);
    expect(h.store.getState().temporal).toEqual({ kind: 'PINNED', at: 3 });
    expect(h.store.getState().history).toHaveLength(1);
    expect(h.outcomes).toEqual(['r1:APPLIED', 'r1:committed']);

    // The same gesture's ending, delivered once more (a late finalize): closed, inert.
    ui.finalize(gesture, false);
    handlers.settle(1, false);
    expect(h.store.getState().history).toHaveLength(1);
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });

    await act(async () => {
      view.unmount();
    });
  });
});
