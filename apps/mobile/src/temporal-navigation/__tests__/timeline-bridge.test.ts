/**
 * T-06 — TN06-06, TN06-07.
 *
 * T-05 stays presentation-only. It identifies disclosed targets and moves a window; it never gains
 * a store, a dispatch, a selected Moment, a Live commit or a Map dependency. The bridge runs one
 * way, and only an EXPLICIT activation crosses it.
 */
import { createPresentationController } from '../../timeline';
import { createTemporalPreviewController } from '../preview';
import { temporalTargeting } from '../targeting';
import { disclosedTargetAt, presentationX, temporalTargetFromDisclosed } from '../timeline-integration';
import { createScrubHandlers } from '../timeline-integration/scrub';
import { fullyDisclosedTargeting, temporalTestStore, trackOf } from '../__fixtures__/temporal';

describe('TN06-06 — presentation separation', () => {
  it('never alters temporal canonical state through window, position, refine or widen', () => {
    const store = temporalTestStore({ liveHead: 40 });
    const controller = createPresentationController(trackOf('session-1', 40), 240);
    const before = store.getState();

    controller.move({ type: 'PRESENTATION_WINDOW_MOVE', offset: 480 });
    controller.move({ type: 'PRESENTATION_POSITION_MOVE', position: 0.75 });
    controller.move({ type: 'PRESENTATION_POSITION_REFINE' });
    controller.move({ type: 'PRESENTATION_POSITION_WIDEN' });
    controller.page(1);
    controller.page(-1);
    controller.adjust(1);
    controller.setViewport(120);
    controller.replaceDisclosed(trackOf('session-1', 60));

    // The window really did move — this is not a vacuous assertion about a controller that did nothing.
    expect(controller.getSnapshot().track.targets).toHaveLength(60);
    expect(store.getState()).toBe(before);
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().history).toHaveLength(0);
  });

  it('gives the presentation controller no route to canonical state at all', () => {
    const controller = createPresentationController(trackOf('session-1', 8), 240);
    for (const forbidden of ['dispatch', 'dispatchMap', 'dispatchTemporal', 'ingest', 'getState', 'commit']) {
      expect(controller).not.toHaveProperty(forbidden);
    }
  });
});

describe('TN06-07 — an explicitly activated disclosed target enters T-06 targeting', () => {
  const store = temporalTestStore({ liveHead: 12 });
  const track = trackOf('session-1', 12);

  it('converts a disclosed target into a temporal target through the one addressability gate', () => {
    const resolved = temporalTargetFromDisclosed(fullyDisclosedTargeting(store), track, track.targets[4]);
    expect(resolved).toEqual({ ok: true, sp: 5 });
  });

  it('refuses a Track built for another Session rather than merging it', () => {
    const foreign = trackOf('session-2', 12);
    expect(temporalTargetFromDisclosed(fullyDisclosedTargeting(store), foreign, foreign.targets[0])).toEqual({
      ok: false,
      code: 'SESSION_MISMATCH',
      detail: expect.any(String),
    });
    // Nor may a foreign Track become the authority itself.
    const foreignAuthority = temporalTargeting(store.getState(), foreign);
    expect(temporalTargetFromDisclosed(foreignAuthority, foreign, foreign.targets[0])).toMatchObject({ code: 'SESSION_MISMATCH' });
  });

  it('refuses a disclosed target beyond the Live Head, even though the presentation shows it', () => {
    const short = temporalTestStore({ liveHead: 3 });
    expect(temporalTargetFromDisclosed(fullyDisclosedTargeting(short), track, track.targets[9])).toEqual({
      ok: false,
      code: 'BEYOND_LIVE_HEAD',
      detail: expect.any(String),
    });
  });

  it('identifies a target from a presentation coordinate and then discards the coordinate', () => {
    const controller = createPresentationController(track, 240);
    controller.move({ type: 'PRESENTATION_WINDOW_MOVE', offset: 96 });
    const snapshot = controller.getSnapshot();

    // Step width is 48: offset 96 puts SP(3) at the window's own origin.
    expect(disclosedTargetAt(snapshot, 0, false)).toEqual({ sessionPosition: 3 });
    expect(disclosedTargetAt(snapshot, 47, false)).toEqual({ sessionPosition: 3 });
    expect(disclosedTargetAt(snapshot, 48, false)).toEqual({ sessionPosition: 4 });
    expect(disclosedTargetAt(snapshot, -1, false)).toBeNull();
    expect(disclosedTargetAt(snapshot, snapshot.viewport, false)).toBeNull();
  });

  it('mirrors right-to-left without letting the mirrored extreme fall past the window', () => {
    expect(presentationX(0, 240, false)).toBe(0);
    expect(presentationX(239, 240, false)).toBe(239);
    // The mirror of the right edge stays inside the half-open window, so it targets the last step
    // rather than one past it.
    const mirrored = presentationX(0, 240, true);
    expect(mirrored).not.toBeNull();
    expect(mirrored).toBeLessThan(240);
    expect(mirrored).toBeGreaterThan(239);
    expect(presentationX(240, 240, true)).toBeNull();
    expect(presentationX(120, 240, true)).toBe(120);
  });

  it('previews an activated target without giving T-05 any store authority', () => {
    const scrubStore = temporalTestStore({ liveHead: 12 });
    const controller = createPresentationController(track, 240);
    const preview = createTemporalPreviewController();
    const handlers = createScrubHandlers({ store: scrubStore, preview, snapshot: controller.getSnapshot });
    const before = scrubStore.getState();

    expect(handlers.targetIndex(1, 6).outcome).toBe('PREVIEWING');
    expect(preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 7 });
    // Activation previews; it does not commit, and the presentation controller learned nothing.
    expect(scrubStore.getState()).toBe(before);
    expect(controller.getSnapshot().offset).toBe(0);
  });

  it('produces no target from an index that is not a disclosed step', () => {
    const scrubStore = temporalTestStore({ liveHead: 12 });
    const controller = createPresentationController(track, 240);
    const preview = createTemporalPreviewController();
    const handlers = createScrubHandlers({ store: scrubStore, preview, snapshot: controller.getSnapshot });

    for (const index of [-1, 12, 999, 1.5, Number.NaN]) {
      expect(handlers.targetIndex(1, index)).toMatchObject({ outcome: 'REJECTED', code: 'NOT_DISCLOSED' });
    }
    expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
  });

  it('R1-01 — the pointer route asks the same disclosed rule and gains no second one', () => {
    // The presentation is showing a Track of 12 rows while the mirror knows only 3 Moments. The
    // pointer route must refuse row 10 for the same reason every other route would.
    const shortStore = temporalTestStore({ liveHead: 3 });
    const controller = createPresentationController(track, 240);
    const preview = createTemporalPreviewController();
    const handlers = createScrubHandlers({ store: shortStore, preview, snapshot: controller.getSnapshot });

    expect(handlers.targetIndex(1, 9)).toMatchObject({ outcome: 'REJECTED', code: 'BEYOND_LIVE_HEAD' });
    expect(handlers.targetIndex(1, 2).outcome).toBe('PREVIEWING');
    expect(preview.getSnapshot()).toMatchObject({ ptc: 3 });
  });
});
