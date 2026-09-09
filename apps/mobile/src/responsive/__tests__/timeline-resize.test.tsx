/**
 * T-11 — conversational time under a changing window, and the one place a resize could have lied.
 *
 * A temporal scrub maps a PHYSICAL finger position through the strip's measured viewport and the
 * reading direction. Both are presentation quantities that a rotation, a split-view drag, a
 * safe-area change or a font-scale reflow can replace while a finger is still down — and when they
 * are replaced, the same untouched physical point resolves to a different disclosed Moment. In
 * right-to-left it resolves to a Moment on the other side of the strip, because the mirror is taken
 * about a width that no longer exists.
 *
 * The interaction epoch cannot see it: the gesture never ended, so its epoch is current and open.
 * These tests prove the geometry generation that can, and prove it through the OUTCOMES that matter
 * — no stale commit, no wrong retarget, no adoption by the mapping that replaced it — rather than
 * through the mechanism that produces them.
 */
import { act, render } from '@testing-library/react-native';
import { useLayoutEffect } from 'react';
import { I18nManager, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { sessionPosition, type CanonicalStore } from '../../state';
import { createPresentationController, OUTBOARD_LIVE_EXTENT, type PresentationController } from '../../timeline';
import { createTemporalPreviewController, type TemporalPreviewController } from '../../temporal-navigation/preview';
import {
  TEMPORAL_LIVE_EDGE_TEST_ID,
  TEMPORAL_TARGET_STRIP_TEST_ID,
  useTemporalScrub,
  type TemporalScrubBinding,
  type TemporalScrubGeometry,
  type TemporalScrubOptions,
} from '../../temporal-navigation/timeline-integration';
import { temporalTestStore, trackOf } from '../../temporal-navigation/__fixtures__/temporal';
import { contextAt, TWO_CONTEXT_WORLD } from '../../orientation-chrome/__fixtures__/chrome';
import { chromeStore } from '../../orientation-chrome/__fixtures__/chrome';
import { ResponsiveWorld, resize } from '../__fixtures__/composition';

jest.setTimeout(60_000);

// ---------------------------------------------------------------------------------------------
// The scrub harness: the REAL hook, with the geometry it maps through under the test's control.
// ---------------------------------------------------------------------------------------------

interface SurfaceProps {
  readonly options: Omit<TemporalScrubOptions, 'fingerX' | 'tracking' | 'geometry'>;
  readonly geometry: TemporalScrubGeometry;
  readonly expose: (binding: TemporalScrubBinding) => void;
}

function Surface({ options, geometry, expose }: SurfaceProps) {
  const fingerX = useSharedValue(0);
  const tracking = useSharedValue(0);
  const binding = useTemporalScrub({ ...options, geometry, fingerX, tracking });
  useLayoutEffect(() => {
    expose(binding);
  });
  return (
    <GestureDetector gesture={binding.gesture}>
      <View testID="strip" />
    </GestureDetector>
  );
}

type PanGesture = TemporalScrubBinding['gesture'];
type GestureEvent = Parameters<NonNullable<PanGesture['handlers']['onBegin']>>[0];

/**
 * The gesture's own callbacks, one phase at a time, exactly as the UI runtime would issue them.
 *
 * The phases have to be apart here: the whole subject is what happens BETWEEN a finger arriving and
 * that same finger leaving. Driving them directly is also what puts the real interaction epoch on
 * the shared value, so the retirement below is reached the way production reaches it rather than
 * through a number a test invented.
 */
const ui = {
  begin: (gesture: PanGesture, x: number) => gesture.handlers.onBegin?.({ x, y: 0 } as GestureEvent),
  update: (gesture: PanGesture, x: number) => gesture.handlers.onUpdate?.({ x, y: 0 } as never),
  end: (gesture: PanGesture, success: boolean) => gesture.handlers.onEnd?.({ x: 0, y: 0 } as GestureEvent, success),
};

function scrubHarness(liveHead = 12) {
  const store = temporalTestStore({ liveHead });
  const preview = createTemporalPreviewController();
  const presentation = createPresentationController(trackOf('session-1', liveHead), 240);
  const outcomes: string[] = [];
  const options = {
    store,
    preview,
    snapshot: () => presentation.getSnapshot(),
    onOutcome: (outcome: { readonly outcome: string }) => outcomes.push(`outcome:${outcome.outcome}`),
    onCommitted: () => outcomes.push('committed'),
    onCancelled: () => outcomes.push('cancelled'),
  };
  let latest: TemporalScrubBinding | null = null;
  const expose: SurfaceProps['expose'] = (binding) => {
    latest = binding;
  };
  const binding = () => {
    if (latest === null) throw new Error('the surface has not rendered');
    return latest;
  };
  return { store, preview, presentation, outcomes, options, expose, binding };
}

const GEOMETRY = (viewport: number, rtl = false, windowOffset = 0): TemporalScrubGeometry => ({ viewport, windowOffset, rtl });

describe('T11 — a geometry change under a live finger retires the interaction it invalidated', () => {
  it('T11-A35, T11-A36, T11-A37 — no stale commit, no stale retarget, no adoption by the new mapping', async () => {
    const h = scrubHarness();
    const view = await render(<Surface options={h.options} geometry={GEOMETRY(240)} expose={h.expose} />);
    const handlers = h.binding().handlers;

    // A finger arrives and previews the Moment under it. The reaction that would schedule the
    // crossing is a no-op in a test renderer, so the crossing it WOULD schedule is delivered
    // directly — with the epoch the gesture actually minted.
    ui.begin(h.binding().gesture, 150);
    ui.update(h.binding().gesture, 150);
    expect(handlers.targetIndex(1, 3).outcome).toBe('PREVIEWING');
    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 4 });
    const before = h.store.getState();

    // The window changes underneath it. The finger has not moved.
    await act(async () => {
      view.rerender(<Surface options={h.options} geometry={GEOMETRY(480)} expose={h.expose} />);
    });

    // The Preview it established is discarded, through the ordinary interruption route.
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(handlers.liveInteraction()).toMatchObject({ epoch: 1, open: false, retired: false });
    expect(h.outcomes).toEqual(['cancelled']);

    // A coordinate taken under the old mapping cannot retarget anything now.
    expect(handlers.targetIndex(1, 9)).toMatchObject({ outcome: 'REJECTED', code: 'INTERACTION_CLOSED' });
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });

    // And the gesture's own eventual release — a SUCCESSFUL one — commits nothing.
    ui.end(h.binding().gesture, true);
    expect(h.store.getState()).toBe(before);
    expect(h.store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(h.store.getState().history).toHaveLength(0);

    // The next gesture works normally, under the mapping that replaced the old one.
    ui.begin(h.binding().gesture, 200);
    expect(handlers.targetIndex(2, 5).outcome).toBe('PREVIEWING');
    ui.end(h.binding().gesture, true);
    expect(h.store.getState().temporal).toEqual({ kind: 'PINNED', at: 6 });

    await act(async () => {
      view.unmount();
    });
  });

  it('T11-A39 — a direction change mid-scrub is a mapping change, and is treated as one', async () => {
    const h = scrubHarness();
    const view = await render(<Surface options={h.options} geometry={GEOMETRY(240, false)} expose={h.expose} />);
    const handlers = h.binding().handlers;
    ui.begin(h.binding().gesture, 30);
    expect(handlers.targetIndex(1, 0).outcome).toBe('PREVIEWING');
    // The physical point 30 means the FIRST disclosed Moment in a left-to-right strip and the LAST
    // one in a right-to-left strip. Mirroring while the finger is down must not silently move it.
    await act(async () => {
      view.rerender(<Surface options={h.options} geometry={GEOMETRY(240, true)} expose={h.expose} />);
    });
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
    ui.end(h.binding().gesture, true);
    expect(h.store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(h.store.getState().history).toHaveLength(0);
    await act(async () => {
      view.unmount();
    });
  });

  it('scrolling the Track during a scrub is NOT a mapping change, and keeps working', async () => {
    const h = scrubHarness();
    const view = await render(<Surface options={h.options} geometry={GEOMETRY(240, false, 0)} expose={h.expose} />);
    const handlers = h.binding().handlers;
    ui.begin(h.binding().gesture, 150);
    expect(handlers.targetIndex(1, 3).outcome).toBe('PREVIEWING');
    // The window offset moves with the content the finger is over: T-05 and T-06 already support
    // this, the offset is read live, and the finger keeps pointing where it is pointing.
    await act(async () => {
      view.rerender(<Surface options={h.options} geometry={GEOMETRY(240, false, 96)} expose={h.expose} />);
    });
    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 4 });
    expect(handlers.liveInteraction()).toMatchObject({ epoch: 1, open: true });
    // and the interaction still commits normally.
    ui.end(h.binding().gesture, true);
    expect(h.store.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });
    await act(async () => {
      view.unmount();
    });
  });

  it('a geometry change with NO finger down retires nothing and closes nothing', async () => {
    const h = scrubHarness();
    const view = await render(<Surface options={h.options} geometry={GEOMETRY(240)} expose={h.expose} />);
    const handlers = h.binding().handlers;
    // A completed interaction: the finger has already left, so nothing is open for a later
    // geometry change to retire.
    ui.begin(h.binding().gesture, 150);
    expect(handlers.targetIndex(1, 3).outcome).toBe('PREVIEWING');
    ui.end(h.binding().gesture, true);
    expect(h.store.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });
    const committed = h.store.getState();
    for (const width of [320, 568, 844, 1366, 240]) {
      await act(async () => {
        view.rerender(<Surface options={h.options} geometry={GEOMETRY(width)} expose={h.expose} />);
      });
      expect(h.store.getState()).toBe(committed);
    }
    expect(h.outcomes.filter((entry) => entry === 'cancelled')).toHaveLength(0);
    await act(async () => {
      view.unmount();
    });
  });

  it('T11-A38 — an unmount during a geometry change leaves no late commit behind', async () => {
    const h = scrubHarness();
    const view = await render(<Surface options={h.options} geometry={GEOMETRY(240)} expose={h.expose} />);
    const handlers = h.binding().handlers;
    ui.begin(h.binding().gesture, 150);
    expect(handlers.targetIndex(1, 3).outcome).toBe('PREVIEWING');
    const before = h.store.getState();
    await act(async () => {
      view.unmount();
    });
    // Every callback of a retired surface is inert, whatever order it arrives in.
    expect(handlers.targetIndex(1, 6)).toMatchObject({ code: 'INTERACTION_CLOSED' });
    handlers.settle(1, true);
    expect(h.store.getState()).toBe(before);
    expect(h.preview.getSnapshot()).toEqual({ status: 'IDLE' });
  });
});

// ---------------------------------------------------------------------------------------------
// The composed temporal surface under the responsive owner.
// ---------------------------------------------------------------------------------------------

function composed(): {
  store: CanonicalStore;
  preview: TemporalPreviewController;
  presentation: PresentationController;
  context: ReturnType<typeof contextAt>;
} {
  const store = chromeStore({ liveHead: 6, depth: 'ANALYTICAL_OBJECT', temporal: { kind: 'PINNED', at: sessionPosition(4) } });
  return {
    store,
    preview: createTemporalPreviewController(),
    presentation: createPresentationController(trackOf('session-1', 6), 0),
    context: contextAt(TWO_CONTEXT_WORLD()),
  };
}

describe('T11 — the Timeline shows a different amount of the same disclosed track', () => {
  it('T11-A26, T11-A27, T11-A28, T11-A31, T11-A32, T11-A33 — width changes no temporal truth', async () => {
    const world = composed();
    const view = await render(
      <ResponsiveWorld store={world.store} context={world.context} preview={world.preview} presentation={world.presentation} />,
    );
    await resize(view, 390, 844);
    const before = world.store.getState();
    const track = world.presentation.getSnapshot().track;

    for (const [width, height] of [
      [320, 568],
      [568, 320],
      [844, 390],
      [768, 1024],
      [1366, 1024],
      [320, 568],
    ] as const) {
      await resize(view, width, height);
      expect(world.store.getState()).toBe(before);
      // No Preview was created, retargeted or committed by a width.
      expect(world.preview.getSnapshot()).toEqual({ status: 'IDLE' });
      // The disclosed Track is the same complete prefix, by identity: no Moment appeared, none was
      // dropped, and none was renamed. A wider strip cannot leak a Moment that is not disclosed.
      expect(world.presentation.getSnapshot().track).toBe(track);
      expect(world.presentation.getSnapshot().track.targets).toHaveLength(6);
    }
    expect(before.temporal).toEqual({ kind: 'PINNED', at: 4 });
    expect(before.history).toHaveLength(0);
    await act(async () => {
      view.unmount();
    });
  });

  it('T11-A29, T11-A30 — the Live edge stays an outboard slot at the narrowest width and in RTL', async () => {
    for (const rtl of [false, true]) {
      const original = I18nManager.isRTL;
      I18nManager.isRTL = rtl;
      try {
        const world = composed();
        const view = await render(
          <ResponsiveWorld store={world.store} context={world.context} preview={world.preview} presentation={world.presentation} />,
        );
        await resize(view, 320, 568);
        const outboard = view.getByTestId('timeline-outboard-live');
        // Its own slot, BESIDE the Track — never inside the strip and never a Moment. Narrow width
        // does not take the slot away.
        //
        // The extent is a FLOOR rather than a fixed width after T-12 §17 (`QAN-BL-RSP-02`), and the
        // clip is gone: at 200 % text the fixed 64 points showed "Go" where the reader needed "Go
        // live", and every way of fixing that inside 64 points is forbidden. `flexShrink: 0` is what
        // keeps the Track from squeezing the wording back out at this narrowest width.
        expect(outboard.props.style).toMatchObject({ minWidth: OUTBOARD_LIVE_EXTENT, flexShrink: 0 });
        expect(outboard.props.style.overflow).toBeUndefined();
        expect(view.getByTestId(TEMPORAL_LIVE_EDGE_TEST_ID)).toBeTruthy();
        // The Moment-targeting strip is sized to T-05's own viewport, which the outboard slot is
        // not part of: a touch in the Live region cannot reach the strip in either direction.
        const strip = view.getByTestId(TEMPORAL_TARGET_STRIP_TEST_ID);
        expect(JSON.stringify(strip.props.style)).toContain('"alignSelf":"flex-start"');
        // No fake Moment: the disclosed steps are exactly the disclosed prefix.
        expect(view.queryAllByTestId(/^timeline-sp-/u).map((node) => node.props.testID)).toEqual([
          'timeline-sp-1',
          'timeline-sp-2',
          'timeline-sp-3',
          'timeline-sp-4',
          'timeline-sp-5',
          'timeline-sp-6',
        ]);
        await act(async () => {
          view.unmount();
        });
      } finally {
        I18nManager.isRTL = original;
      }
    }
  });

  it('T11-A34, T11-A40 — the same temporal semantics and the same accessible route at C1, C5 and C8', async () => {
    const world = composed();
    const view = await render(
      <ResponsiveWorld store={world.store} context={world.context} preview={world.preview} presentation={world.presentation} />,
    );
    const readAt = async (width: number, height: number) => {
      await resize(view, width, height);
      return {
        steps: view.queryAllByTestId(/^timeline-sp-/u).map((node) => node.props.accessibilityLabel),
        live: view.getByTestId(TEMPORAL_LIVE_EDGE_TEST_ID).props.accessibilityLabel,
        liveEnabled: view.getByTestId(TEMPORAL_LIVE_EDGE_TEST_ID).props.accessibilityState,
      };
    };
    const narrow = await readAt(320, 568);
    const short = await readAt(568, 320);
    const wide = await readAt(1024, 768);
    expect(short).toEqual(narrow);
    expect(wide).toEqual(narrow);
    expect(narrow.steps).toHaveLength(6);
    await act(async () => {
      view.unmount();
    });
  });
});
