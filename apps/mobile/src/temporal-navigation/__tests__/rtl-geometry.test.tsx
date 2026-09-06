/**
 * T-06 — FCR-03: the temporal strip and its markers are physically aligned with T-05 in both
 * writing directions.
 *
 * T-05 stays presentation-only and byte-identical. T-06 uses its viewport and its logical window
 * offset, and ONE shared logical↔physical geometry, so that under right-to-left the rested markers
 * sit where T-05 draws the same Moments, direct tracking stays 1:1 with the physical finger,
 * releasing a finger never snaps the marker across the screen, presentation scrolling still moves
 * the markers instantly, and the outboard Live region is never Moment-targeting space.
 */
import { act, render } from '@testing-library/react-native';
import { I18nManager } from 'react-native';

import { sessionPosition } from '../../state';
import { createPresentationController, hitTest, OUTBOARD_LIVE_EXTENT, TIMELINE_STEP } from '../../timeline';
import { cursorOffsetFor, trackOffsetFor } from '../motion';
import { createTemporalPreviewController } from '../preview';
import {
  markerTranslateX,
  MIRROR_EPSILON,
  physicalPresentationX,
  presentationX,
  restingMarkerX,
  TEMPORAL_COMMITTED_MARKER_TEST_ID,
  TEMPORAL_PREVIEW_MARKER_TEST_ID,
  TEMPORAL_TARGET_STRIP_TEST_ID,
  TemporalTargetLayer,
} from '../timeline-integration';
import { commitMoment } from '../targeting';
import { fullyDisclosedTargeting, temporalTestStore, trackOf } from '../__fixtures__/temporal';

jest.setTimeout(60_000);

const VIEWPORT = 240;
const OFFSET = 96;

const flatten = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter((entry) => entry !== null && typeof entry === 'object'));

const translateX = (style: unknown): number | undefined => {
  const transform = flatten(style).transform as readonly Record<string, number>[] | undefined;
  return transform?.find((entry) => 'translateX' in entry)?.translateX;
};

/** Runs a block with the platform direction mirrored, restoring it whatever happens. */
async function inRtl(block: () => Promise<void>): Promise<void> {
  const original = I18nManager.isRTL;
  I18nManager.isRTL = true;
  try {
    await block();
  } finally {
    I18nManager.isRTL = original;
  }
}

afterEach(() => {
  delete (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__;
});

describe('FCR-03 — LTR parity', () => {
  it('leaves every left-to-right coordinate exactly as it was', () => {
    for (const x of [0, 1, 47, 48, 120, 239]) {
      expect(presentationX(x, VIEWPORT, false)).toBe(x);
      expect(physicalPresentationX(x, VIEWPORT, false)).toBe(x);
      expect(markerTranslateX(x, VIEWPORT, false)).toBe(x);
      expect(restingMarkerX(x, VIEWPORT, false)).toBe(x);
    }
    expect(presentationX(-1, VIEWPORT, false)).toBeNull();
    expect(presentationX(VIEWPORT, VIEWPORT, false)).toBeNull();
    // The rested marker is still the within-window cursor offset, untouched.
    expect(restingMarkerX(cursorOffsetFor(3, { stepWidth: TIMELINE_STEP, windowOffset: OFFSET }) ?? Number.NaN, VIEWPORT, false)).toBe(
      2 * TIMELINE_STEP - OFFSET + TIMELINE_STEP / 2,
    );
  });

  it('draws the LTR markers where they always were', async () => {
    const store = temporalTestStore({ liveHead: 8 });
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 8), VIEWPORT);
    presentation.move({ type: 'PRESENTATION_WINDOW_MOVE', offset: OFFSET });
    const view = await render(<TemporalTargetLayer store={store} preview={preview} presentation={presentation} />);
    expect(translateX(view.getByTestId(TEMPORAL_COMMITTED_MARKER_TEST_ID).props.style)).toBe((trackOffsetFor(8, TIMELINE_STEP) ?? 0) - OFFSET);
    await act(async () => {
      view.unmount();
    });
  });
});

describe('FCR-03 — RTL first/last visible positions', () => {
  const track = trackOf('session-1', 12);
  // Offset 96 puts SP(3) at the window's logical origin; 240 / 48 = 5 visible steps, SP(3)..SP(7).
  const visible = [3, 4, 5, 6, 7];

  it('maps every visible Moment to its mirrored physical centre, and back to the same disclosed SP', () => {
    for (const sp of visible) {
      const logicalCentre = (trackOffsetFor(sp, TIMELINE_STEP) ?? Number.NaN) - OFFSET;
      const physicalCentre = physicalPresentationX(logicalCentre, VIEWPORT, true);
      // Mirrored: later Moments sit further to the physical LEFT.
      expect(physicalCentre).toBe(VIEWPORT - logicalCentre);
      // A touch at that physical centre resolves back to exactly this Moment through T-05's hit test.
      const logical = presentationX(physicalCentre, VIEWPORT, true);
      expect(logical).toBe(logicalCentre);
      expect(hitTest(track, OFFSET, VIEWPORT, logical ?? Number.NaN)).toEqual({ sessionPosition: sp });
      // And the rested marker's leading (right) edge rests on that same physical centre.
      expect(VIEWPORT + restingMarkerX(logicalCentre, VIEWPORT, true)).toBe(physicalCentre);
    }
    // First visible is at the physical right, last visible at the physical left.
    const first = physicalPresentationX((trackOffsetFor(3, TIMELINE_STEP) ?? 0) - OFFSET, VIEWPORT, true);
    const last = physicalPresentationX((trackOffsetFor(7, TIMELINE_STEP) ?? 0) - OFFSET, VIEWPORT, true);
    expect(first).toBeGreaterThan(last);
    expect(first).toBe(VIEWPORT - TIMELINE_STEP / 2);
    expect(last).toBe(TIMELINE_STEP / 2);
  });

  it('keeps the mirrored physical extreme inside the window, one step never past its end', () => {
    const mirrored = presentationX(0, VIEWPORT, true);
    expect(mirrored).toBe(VIEWPORT - MIRROR_EPSILON);
    expect(hitTest(track, OFFSET, VIEWPORT, mirrored ?? Number.NaN)).toEqual({ sessionPosition: 7 });
    expect(presentationX(VIEWPORT, VIEWPORT, true)).toBeNull();
  });
});

describe('FCR-03 — release continuity in RTL', () => {
  it('the rested marker of the target under the finger is where the finger was, within half a step', () => {
    const track = trackOf('session-1', 12);
    for (let finger = 0; finger < VIEWPORT; finger += 7) {
      // While the finger is down the marker's leading edge is exactly under it, 1:1.
      const direct = markerTranslateX(finger, VIEWPORT, true);
      expect(VIEWPORT + direct).toBe(finger);
      // The disclosed target under that finger, through the ONE pointer rule.
      const logical = presentationX(finger, VIEWPORT, true);
      const target = hitTest(track, OFFSET, VIEWPORT, logical ?? Number.NaN);
      expect(target).not.toBeNull();
      // After release the same target's rested marker sits at its centre — never on the other side.
      const rested = restingMarkerX((trackOffsetFor(target?.sessionPosition ?? null, TIMELINE_STEP) ?? Number.NaN) - OFFSET, VIEWPORT, true);
      expect(Math.abs(rested - direct)).toBeLessThanOrEqual(TIMELINE_STEP / 2);
      // Both are negative in RTL: the marker is always translated back from its right anchor,
      // so no finger position and no rest position ever lands on the LTR side of the strip.
      expect(direct).toBeLessThanOrEqual(0);
      expect(rested).toBeLessThan(0);
    }
    // At a step's exact centre the two agree exactly.
    const centre = physicalPresentationX((trackOffsetFor(5, TIMELINE_STEP) ?? 0) - OFFSET, VIEWPORT, true);
    expect(markerTranslateX(centre, VIEWPORT, true)).toBe(restingMarkerX((trackOffsetFor(5, TIMELINE_STEP) ?? 0) - OFFSET, VIEWPORT, true));
  });

  it('FCR-MOTION-01 — seeding the rest position from the finger reproduces the finger branch exactly, in both directions', () => {
    // On release the binding sets the animated Track position to `presentationX(finger) + offset`
    // and eases from there. That seed must draw the marker where the finger branch just drew it,
    // or the handoff itself would be the jump it exists to remove.
    for (const rtl of [false, true]) {
      for (let finger = 0; finger < VIEWPORT; finger += 1) {
        const logical = presentationX(finger, VIEWPORT, rtl);
        expect(logical).not.toBeNull();
        const seeded = restingMarkerX((logical ?? Number.NaN) + OFFSET - OFFSET, VIEWPORT, rtl);
        expect(seeded).toBeCloseTo(markerTranslateX(finger, VIEWPORT, rtl), 2);
      }
    }
  });
});

describe('FCR-03 — scroll and the rendered RTL surface', () => {
  /**
   * The committed marker's translateX at a given window offset, on a fresh surface — the same shape
   * as R1-MOTION-01's LTR proof. (The declarative Reanimated stand-in evaluates a style once per
   * render, so a shared value written by an effect is only visible on the next render; on the UI
   * runtime the style re-evaluates the instant the never-animated offset changes.)
   */
  const rtlMarkerX = async (offset: number) => {
    const store = temporalTestStore({ liveHead: 8 });
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 8), VIEWPORT);
    presentation.move({ type: 'PRESENTATION_WINDOW_MOVE', offset });
    const view = await render(<TemporalTargetLayer store={store} preview={preview} presentation={presentation} />);
    const committed = translateX(view.getByTestId(TEMPORAL_COMMITTED_MARKER_TEST_ID).props.style);
    const cursor = translateX(view.getByTestId(TEMPORAL_PREVIEW_MARKER_TEST_ID).props.style);
    await act(async () => {
      view.unmount();
    });
    return { committed, cursor };
  };

  it('changing only the window offset moves RTL markers by exactly the corresponding physical amount', async () => {
    await inRtl(async () => {
      const atOrigin = await rtlMarkerX(0);
      const scrolled = await rtlMarkerX(OFFSET);
      expect(atOrigin.committed).toBe(-(trackOffsetFor(8, TIMELINE_STEP) ?? 0));
      // Mirrored: as the window moves forward, the content — and the marker with it — moves to the
      // physical RIGHT by exactly the offset, with no duration involved anywhere: the offset is
      // subtracted outside the animated value on both sides of the mirror.
      expect(scrolled.committed).toBe((atOrigin.committed ?? 0) + OFFSET);
      expect(scrolled.committed).toBe(restingMarkerX((trackOffsetFor(8, TIMELINE_STEP) ?? 0) - OFFSET, VIEWPORT, true));
      expect(scrolled.cursor).toBe(scrolled.committed);
    });
  });

  it('sizes the strip to T-05\'s viewport at the start edge, and anchors the markers at the logical start', async () => {
    await inRtl(async () => {
      const store = temporalTestStore({ liveHead: 8 });
      const preview = createTemporalPreviewController();
      const presentation = createPresentationController(trackOf('session-1', 8), VIEWPORT);
      const view = await render(<TemporalTargetLayer store={store} preview={preview} presentation={presentation} />);

      const strip = flatten(view.getByTestId(TEMPORAL_TARGET_STRIP_TEST_ID).props.style);
      expect(strip.width).toBe(VIEWPORT);
      expect(strip.alignSelf).toBe('flex-start');
      expect(strip.overflow).toBe('hidden');
      for (const marker of [TEMPORAL_COMMITTED_MARKER_TEST_ID, TEMPORAL_PREVIEW_MARKER_TEST_ID]) {
        const style = flatten(view.getByTestId(marker).props.style);
        expect(style.start).toBe(0);
        expect(style.left).toBeUndefined();
        expect(style.right).toBeUndefined();
      }

      // A viewport change re-sizes the strip: it follows T-05, never the row.
      await act(async () => {
        presentation.setViewport(192);
      });
      expect(flatten(view.getByTestId(TEMPORAL_TARGET_STRIP_TEST_ID).props.style).width).toBe(192);

      await act(async () => {
        view.unmount();
      });
    });
  });

  it('the rested preview marker aligns with its T-05 Moment in RTL, and reduced motion changes no target', async () => {
    const results: { readonly reduced: boolean; readonly cursor?: number; readonly committed?: number; readonly temporal: unknown }[] = [];
    await inRtl(async () => {
      for (const reduced of [false, true]) {
        (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = reduced;
        const store = temporalTestStore({ liveHead: 8 });
        const preview = createTemporalPreviewController();
        const presentation = createPresentationController(trackOf('session-1', 8), VIEWPORT);
        presentation.move({ type: 'PRESENTATION_WINDOW_MOVE', offset: OFFSET });
        preview.preview(fullyDisclosedTargeting(store), sessionPosition(5), 'EXACT_ENTRY');
        const view = await render(<TemporalTargetLayer store={store} preview={preview} presentation={presentation} />);

        const cursor = translateX(view.getByTestId(TEMPORAL_PREVIEW_MARKER_TEST_ID).props.style);
        const committed = translateX(view.getByTestId(TEMPORAL_COMMITTED_MARKER_TEST_ID).props.style);
        await act(async () => {
          commitMoment(store, 5);
        });
        results.push({ reduced, cursor, committed, temporal: store.getState().temporal });
        await act(async () => {
          view.unmount();
        });
        delete (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__;
      }
    });
    // The preview marker's leading edge rests on SP(5)'s mirrored centre; the committed one on SP(8)'s.
    expect(results[0].cursor).toBe(restingMarkerX((trackOffsetFor(5, TIMELINE_STEP) ?? 0) - OFFSET, VIEWPORT, true));
    expect(results[0].committed).toBe(restingMarkerX((trackOffsetFor(8, TIMELINE_STEP) ?? 0) - OFFSET, VIEWPORT, true));
    expect(VIEWPORT + (results[0].cursor ?? Number.NaN)).toBe(physicalPresentationX((trackOffsetFor(5, TIMELINE_STEP) ?? 0) - OFFSET, VIEWPORT, true));
    // Reduced motion: same places, same commit; only the transition differs.
    expect(results[1].cursor).toBe(results[0].cursor);
    expect(results[1].committed).toBe(results[0].committed);
    expect(results[1].temporal).toEqual({ kind: 'PINNED', at: 5 });
    expect(results[0].temporal).toEqual(results[1].temporal);
  });
});

describe('FCR-03 — outboard separation', () => {
  it('never treats the outboard Live/discontinuity region as Moment-targeting space, in either direction', async () => {
    // Physically, the strip is exactly the viewport wide: a touch in the outboard region cannot
    // reach it at all. Arithmetically, a strip coordinate at or beyond the viewport targets nothing.
    for (const rtl of [false, true]) {
      for (const outboard of [VIEWPORT, VIEWPORT + 1, VIEWPORT + OUTBOARD_LIVE_EXTENT / 2, VIEWPORT + OUTBOARD_LIVE_EXTENT + 16]) {
        expect(presentationX(outboard, VIEWPORT, rtl)).toBeNull();
      }
      expect(presentationX(-1, VIEWPORT, rtl)).toBeNull();
    }
    const store = temporalTestStore({ liveHead: 8 });
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 8), VIEWPORT);
    const view = await render(<TemporalTargetLayer store={store} preview={preview} presentation={presentation} />);
    const width = flatten(view.getByTestId(TEMPORAL_TARGET_STRIP_TEST_ID).props.style).width;
    expect(width).toBe(VIEWPORT);
    expect(width).toBeLessThan(VIEWPORT + OUTBOARD_LIVE_EXTENT);
    // T-05's outboard slot is still rendered, beside the strip and not beneath it.
    expect(view.getByTestId('timeline-outboard-live').props.style.width).toBe(OUTBOARD_LIVE_EXTENT);
    await act(async () => {
      view.unmount();
    });
  });
});
