/**
 * VPORT-02 — `QAN-BL-A11Y-01`: the T-10 presentation camera and the T-06 temporal motion follow a MID-SESSION change of
 * the platform's Reduce Motion setting, with nothing remounted and nothing restarted.
 *
 * The shape the Task Contract requires (§11.5): mount with Reduce Motion OFF and observe the full-motion plan; change
 * the platform signal to ON without remounting; both hooks switch to the reduced plan; change it back and the plan is
 * truthful again; one platform listener serves every reader, and unmounting leaves no reader behind.
 *
 * A launch-time test cannot prove this, because the launch value is exactly what the old hooks already honoured.
 */
import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { reduceMotionReadersForTests, resetReduceMotionForTests, usePresentationCamera, type PresentationCameraBinding } from '..';
import { useReduceMotion as conversationReduceMotion } from '../../conversation/visual/reduce-motion';
import { TEMPORAL_MOTION_DURATIONS, useTemporalMotion, type TemporalMotionBinding } from '../../temporal-navigation';

let emit: (enabled: boolean) => void = () => undefined;
let listening = 0;
let removed = 0;

beforeEach(() => {
  resetReduceMotionForTests();
  emit = () => undefined;
  listening = 0;
  removed = 0;
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, handler: (enabled: boolean) => void) => {
    if (event === 'reduceMotionChanged') {
      emit = handler;
      listening += 1;
    }
    return { remove: () => { removed += 1; } };
  }) as never);
});

afterEach(() => {
  (globalThis as Record<string, unknown>).__QANDEEL_TEST_REDUCED_MOTION__ = undefined;
  resetReduceMotionForTests();
  jest.restoreAllMocks();
});

const latest: { camera: PresentationCameraBinding | null; temporal: TemporalMotionBinding | null; conversation: boolean | null } = {
  camera: null,
  temporal: null,
  conversation: null,
};

type Readers = typeof latest;
/** Records what this render read, so the test can look at the mounted hooks without remounting them. */
const report = (seen: Readers) => Object.assign(latest, seen);

/** One mounted reader of each kind: the Map's camera, the Timeline's temporal motion, and a W1A / W3 surface. */
function Probe() {
  const camera = usePresentationCamera({ center: { x: 180, y: 300 }, diagonalPoints: 700 });
  const temporal = useTemporalMotion(
    { committedSp: 3, previewSp: 5, mode: 'PINNED', dragging: false },
    { stepWidth: 48, windowOffset: 0, viewport: 320, rtl: false },
  );
  const conversation = conversationReduceMotion();
  report({ camera, temporal, conversation });
  return null;
}

/** A canonical change with a long representable travel: TRAVEL with motion, CUT_AND_RESOLVE without. */
const LONG_TRAVEL = { k: 1, destination: { x: 900, y: -400 }, depthChanged: false } as const;

it('the camera and the temporal motion switch to the reduced plan mid-session, and back, with no remount', async () => {
  const view = await render(<Probe />);
  const mountedCamera = latest.camera;

  // 1–2. Reduce Motion OFF: the full-motion plan.
  expect(latest.camera?.reducedMotion).toBe(false);
  expect(latest.camera?.applyCanonicalChange(LONG_TRAVEL).kind).toBe('TRAVEL');
  expect(latest.temporal?.plan.cursorMs).toBe(TEMPORAL_MOTION_DURATIONS.cursorMs);
  expect(latest.temporal?.plan.cancelMs).toBe(TEMPORAL_MOTION_DURATIONS.cancelMs);
  expect(latest.temporal?.plan.commitSettleMs).toBe(TEMPORAL_MOTION_DURATIONS.commitSettleMs);
  expect(latest.conversation).toBe(false);

  // 3–4. The platform says ON while everything stays mounted: both hooks are now reduced.
  await act(async () => emit(true));
  expect(latest.camera?.reducedMotion).toBe(true);
  expect(latest.camera?.applyCanonicalChange(LONG_TRAVEL).kind).toBe('CUT_AND_RESOLVE');
  expect(latest.temporal?.plan.cursorMs).toBe(0);
  expect(latest.temporal?.plan.cancelMs).toBe(0);
  expect(latest.temporal?.plan.commitSettleMs).toBe(0);
  expect(latest.conversation).toBe(true);
  // Reduced motion is fewer and gentler, not none: the preview's presence resolve is an opacity and survives.
  expect(latest.temporal?.plan.presenceMs).toBe(TEMPORAL_MOTION_DURATIONS.presenceMs);
  // The semantic state did not move with the setting: the same stance, the same committed and previewed Moments.
  expect(latest.temporal?.plan.temporalStance).toBe('PINNED_TO_MOMENT');
  expect(latest.temporal?.plan.committedSp).toBe(3);
  expect(latest.temporal?.plan.cursorSp).toBe(5);

  // 5. Back OFF: still truthful, still the same mounted camera.
  await act(async () => emit(false));
  expect(latest.camera?.reducedMotion).toBe(false);
  expect(latest.camera?.applyCanonicalChange(LONG_TRAVEL).kind).toBe('TRAVEL');
  expect(latest.temporal?.plan.cursorMs).toBe(TEMPORAL_MOTION_DURATIONS.cursorMs);
  expect(latest.conversation).toBe(false);
  expect(latest.camera?.planeTransform).toBe(mountedCamera?.planeTransform);

  // 6. One platform listener for every reader, and no reader left behind after unmount.
  expect(listening).toBe(1);
  expect(reduceMotionReadersForTests()).toBe(3);
  await view.unmount();
  expect(reduceMotionReadersForTests()).toBe(0);
  expect(removed).toBe(0);
});

it('a reader who launched with Reduce Motion ON and turns it OFF mid-session gets motion back', async () => {
  (globalThis as Record<string, unknown>).__QANDEEL_TEST_REDUCED_MOTION__ = true;
  const view = await render(<Probe />);
  expect(latest.camera?.reducedMotion).toBe(true);
  expect(latest.temporal?.plan.cursorMs).toBe(0);
  await act(async () => emit(false));
  expect(latest.camera?.reducedMotion).toBe(false);
  expect(latest.camera?.applyCanonicalChange(LONG_TRAVEL).kind).toBe('TRAVEL');
  expect(latest.temporal?.plan.cursorMs).toBe(TEMPORAL_MOTION_DURATIONS.cursorMs);
  await view.unmount();
});

it('a camera mounted AFTER a change starts from the change, not from the launch value', async () => {
  const first = await render(<Probe />);
  await act(async () => emit(true));
  await first.unmount();
  const later = await render(<Probe />);
  expect(latest.camera?.reducedMotion).toBe(true);
  expect(latest.temporal?.plan.cursorMs).toBe(0);
  await later.unmount();
});
