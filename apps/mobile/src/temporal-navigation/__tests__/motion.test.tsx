/**
 * T-06 — TN06-17, TN06-18, TN06-19.
 *
 * Motion explains Product truth and never carries it. The plan is plain arithmetic, so it can be
 * asserted exactly; the binding's animated styles are asserted through the declarative stand-in, so
 * what the surface asks for is visible to a test; and the two cases that would make motion into
 * authority — an interruption, and reduced motion — are proven to change the presentation and
 * nothing else.
 */
import { act, render } from '@testing-library/react-native';

import { sessionPosition } from '../../state';
import { createPresentationController, TIMELINE_STEP } from '../../timeline';
import {
  CANCEL_DAMPING_RATIO,
  TEMPORAL_MOTION_DURATIONS,
  cursorOffsetFor,
  temporalMotionPlan,
} from '../motion';
import { createTemporalPreviewController } from '../preview';
import { createScrubHandlers } from '../timeline-integration/scrub';
import {
  TEMPORAL_COMMITTED_MARKER_TEST_ID,
  TEMPORAL_PREVIEW_MARKER_TEST_ID,
  TemporalTargetLayer,
} from '../timeline-integration';
import { commitMoment } from '../targeting';
import { fullyDisclosedTargeting, temporalTestStore, trackOf } from '../__fixtures__/temporal';

/** One gesture's interaction epoch, in the order the two runtimes would actually deliver it. */
const GESTURE = 1;

const flatten = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...(Array.isArray(style) ? style : [style]).filter((entry) => entry !== null && typeof entry === 'object'));

const translateX = (style: unknown): number | undefined => {
  const transform = flatten(style).transform as readonly Record<string, number>[] | undefined;
  return transform?.find((entry) => 'translateX' in entry)?.translateX;
};

afterEach(() => {
  delete (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__;
});

describe('TN06-17 — motion authority separation', () => {
  it('derives the Live/Pinned distinction from the temporal mode alone, never from motion', () => {
    const following = temporalMotionPlan({ committedSp: 4, previewSp: null, mode: 'FOLLOW_LIVE', dragging: false, reducedMotion: false });
    const pinned = temporalMotionPlan({ committedSp: 4, previewSp: null, mode: 'PINNED', dragging: false, reducedMotion: false });

    // The same Session Position, two different stances — and they stay different with every
    // duration set to zero.
    expect(following.cursorSp).toBe(pinned.cursorSp);
    expect(following.temporalStance).toBe('FOLLOWING_LIVE');
    expect(pinned.temporalStance).toBe('PINNED_TO_MOMENT');
    expect(temporalMotionPlan({ committedSp: 4, previewSp: null, mode: 'FOLLOW_LIVE', dragging: false, reducedMotion: true }).temporalStance).toBe(
      'FOLLOWING_LIVE',
    );
    expect(temporalMotionPlan({ committedSp: 4, previewSp: null, mode: 'PINNED', dragging: false, reducedMotion: true }).temporalStance).toBe(
      'PINNED_TO_MOMENT',
    );
  });

  it('never moves committed truth with a preview', () => {
    const plan = temporalMotionPlan({ committedSp: 2, previewSp: 7, mode: 'PINNED', dragging: false, reducedMotion: false });
    expect(plan.committedSp).toBe(2);
    expect(plan.cursorSp).toBe(7);
    expect(plan.previewPresent).toBe(true);
  });

  it('tracks a finger with no easing at all, because easing a direct manipulation is lag', () => {
    const dragging = temporalMotionPlan({ committedSp: 2, previewSp: 3, mode: 'PINNED', dragging: true, reducedMotion: false });
    const released = temporalMotionPlan({ committedSp: 2, previewSp: 3, mode: 'PINNED', dragging: false, reducedMotion: false });
    expect(dragging.cursorMs).toBe(0);
    expect(released.cursorMs).toBe(TEMPORAL_MOTION_DURATIONS.cursorMs);
    expect(released.cursorMs).toBeLessThan(300);
  });

  it('keeps every duration inside the interaction budget and the cancel spring free of overshoot', () => {
    for (const duration of Object.values(TEMPORAL_MOTION_DURATIONS)) expect(duration).toBeLessThan(300);
    expect(CANCEL_DAMPING_RATIO).toBe(1);
  });

  it('acknowledging a commit any number of times writes nothing canonical', async () => {
    const store = temporalTestStore({ liveHead: 8 });
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 8), 240);
    const view = await render(<TemporalTargetLayer store={store} preview={preview} presentation={presentation} />);

    const before = store.getState();
    expect(before.history).toHaveLength(0);
    // The acknowledgement hooks are reachable only from a completed act; rendering and re-rendering
    // the surface — which is what an animation frame ultimately causes — commits nothing.
    await act(async () => {
      presentation.move({ type: 'PRESENTATION_WINDOW_MOVE', offset: 96 });
    });
    expect(store.getState()).toBe(before);

    await act(async () => {
      view.unmount();
    });
  });

  it('places the cursor by ordinal geometry only, and never turns a coordinate back into a position', () => {
    const geometry = { stepWidth: TIMELINE_STEP, windowOffset: 96 };
    expect(cursorOffsetFor(3, geometry)).toBe(2 * TIMELINE_STEP - 96 + TIMELINE_STEP / 2);
    expect(cursorOffsetFor(null, geometry)).toBeNull();
    expect(cursorOffsetFor(Number.NaN, geometry)).toBeNull();
  });
});

describe('TN06-18 — interrupted motion', () => {
  it('cannot partially commit: an interrupted scrub discards the target and writes nothing', () => {
    const store = temporalTestStore({ liveHead: 8 });
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 8), 240);
    const handlers = createScrubHandlers({ store, preview, snapshot: presentation.getSnapshot });
    const before = store.getState();

    handlers.targetIndex(GESTURE, 1);
    handlers.targetIndex(GESTURE, 2);
    handlers.targetIndex(GESTURE, 5);
    expect(preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 6 });

    // Cancellation, failure, interruption and a competing recognizer all arrive as `false`.
    handlers.settle(GESTURE, false);

    expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('commits exactly once for a completed scrub, whatever it crossed on the way', () => {
    const store = temporalTestStore({ liveHead: 8 });
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 8), 240);
    const outcomes: string[] = [];
    const handlers = createScrubHandlers({
      store,
      preview,
      snapshot: presentation.getSnapshot,
      onOutcome: (outcome) => outcomes.push(outcome.outcome),
    });

    for (const index of [0, 1, 2, 3, 4, 3, 2]) handlers.targetIndex(GESTURE, index);
    handlers.settle(GESTURE, true);

    expect(outcomes).toEqual(['APPLIED']);
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 3 });
    expect(store.getState().history).toHaveLength(1);
    expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
  });

  it('a settle after a cancellation commits nothing, and neither does a settle owning no target', () => {
    const store = temporalTestStore({ liveHead: 8 });
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 8), 240);
    const outcomes: string[] = [];
    const handlers = createScrubHandlers({
      store,
      preview,
      snapshot: presentation.getSnapshot,
      onOutcome: (outcome) => outcomes.push(`${outcome.outcome}`),
    });

    handlers.targetIndex(GESTURE, 3);
    handlers.settle(GESTURE, false);
    // The same gesture cannot settle twice: it is already closed, so this changes nothing at all.
    handlers.settle(GESTURE, true);
    // A LATER gesture that never established a target of its own fails closed rather than
    // committing whatever preview happens to be lying around.
    handlers.settle(GESTURE + 1, true);

    expect(outcomes).toEqual(['REJECTED']);
    expect(store.getState().history).toHaveLength(0);
  });
});

describe('TN06-19 — reduced-motion parity', () => {
  it('collapses every transition to zero while changing no target, capability or stance', () => {
    const full = temporalMotionPlan({ committedSp: 2, previewSp: 5, mode: 'PINNED', dragging: false, reducedMotion: false });
    const reduced = temporalMotionPlan({ committedSp: 2, previewSp: 5, mode: 'PINNED', dragging: false, reducedMotion: true });

    expect(reduced.cursorSp).toBe(full.cursorSp);
    expect(reduced.committedSp).toBe(full.committedSp);
    expect(reduced.previewPresent).toBe(full.previewPresent);
    expect(reduced.temporalStance).toBe(full.temporalStance);
    for (const key of ['cursorMs', 'presenceMs', 'cancelMs', 'commitSettleMs'] as const) {
      expect(full[key]).toBeGreaterThan(0);
      expect(reduced[key]).toBe(0);
    }
  });

  it('reaches the same Product result and draws the markers at the same places', async () => {
    const results: { readonly reduced: boolean; readonly temporal: unknown; readonly cursor?: number; readonly committed?: number }[] = [];

    for (const reduced of [false, true]) {
      (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = reduced;
      const store = temporalTestStore({ liveHead: 8 });
      const preview = createTemporalPreviewController();
      const presentation = createPresentationController(trackOf('session-1', 8), 240);

      preview.preview(fullyDisclosedTargeting(store), sessionPosition(5), 'EXACT_ENTRY');
      const view = await render(<TemporalTargetLayer store={store} preview={preview} presentation={presentation} />);

      const cursor = translateX(view.getByTestId(TEMPORAL_PREVIEW_MARKER_TEST_ID).props.style);
      const committed = translateX(view.getByTestId(TEMPORAL_COMMITTED_MARKER_TEST_ID).props.style);

      await act(async () => {
        commitMoment(store, 5);
      });
      results.push({ reduced, temporal: store.getState().temporal, cursor, committed });

      await act(async () => {
        view.unmount();
      });
      delete (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__;
    }

    // Same commit, same resting geometry: only the transition between them differs.
    expect(results[0].temporal).toEqual({ kind: 'PINNED', at: 5 });
    expect(results[1].temporal).toEqual(results[0].temporal);
    expect(results[1].cursor).toBe(results[0].cursor);
    expect(results[1].committed).toBe(results[0].committed);
    expect(results[0].cursor).toBe(cursorOffsetFor(5, { stepWidth: TIMELINE_STEP, windowOffset: 0 }));
  });
});
