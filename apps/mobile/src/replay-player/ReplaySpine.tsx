/**
 * S7-04 — the Replay's Temporal Spine: P2's frozen Temporal Spine + Aperture C "Parting", composed over the moments of
 * ONE Replay version (Product Owner decision, 2026-10-20, «Replay Temporal Spine»).
 *
 * It is a limited presentation composition, not a second Timeline:
 *
 *   drawn by     VPORT-02's own production drawings, unchanged — `SpineLayer` (the hairline and the notches), `Aperture`
 *                (the committed parting with its mark, the lighter preview parting with none) and `spinePresentation`
 *                (where they fall) — at T-05's invariant 48-point step, inside P2's 44-point band;
 *   moved by     T-06's own motion binding, `useTemporalMotion`: the finger followed 1:1, a release that retargets and
 *                settles once, a lossless cancel, and Reduced Motion's cut — the M04 / M05 language, read from the ONE
 *                live Reduce Motion setting. Nothing here eases, fades or scales on its own;
 *   about        the version's moments and nothing else: one notch per moment, in ordinal order, and the spatial step
 *                is the ordinal step. No original timing is drawn or implied (none is kept). The notches are the
 *                version's moments, not the conversation's messages: what a version left out is said in words, by the
 *                S7-03 composite's own historical disclosure beside the moment, and never drawn here. P2's
 *                discontinuity points keep their one approved meaning (the window continues toward the live edge),
 *                which has no place on a Replay, so the Spine never draws them (Product Owner review, 2026-10-20);
 *   not about    the live conversation. There is no Live Head, no Live terminal, no Return Live and no T-06 store: this
 *                file holds no canonical store, no preview controller and no temporal authority. A touch makes an
 *                ephemeral preview here; a completed touch hands ONE ordinal to the player (`onCommit`), and the
 *                composite commits that moment's TC through T-06 on its own isolated viewpoint. The live Timeline, its
 *                store and its preview are never reached.
 *
 * Its accessible route is one adjustable element whose value is the moment's approved position sentence; increment and
 * decrement are the next and previous moment. The drawings themselves stay decorative, exactly as VPORT-02 left them.
 */
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAnalysisInk } from '../analysis-visual';
import { Aperture, P2_SPINE, SpineLayer, spinePresentation } from '../iconography';
import { presentationX, useTemporalMotion } from '../temporal-navigation';
import { TIMELINE_STEP } from '../timeline';

export const REPLAY_SPINE_TEST_ID = 'qandeel-replay-spine';
export const REPLAY_SPINE_GESTURE_TEST_ID = 'qandeel-replay-spine-gesture';
export const REPLAY_SPINE_TAP_TEST_ID = 'qandeel-replay-spine-tap';

/** P2's band: the 44-point interaction rail the hairline runs through. */
const BAND = P2_SPINE.bandPoints;
/** T-06's own marker frame inside the band (`TemporalTargetLayer`): inset so the commit settle stays inside the clip. */
const MARKER_INSET = 2;
const NO_STEP = -1;
/** A touch is recognised as a drag or as a tap. */
const RECOGNISERS = 2;

export interface ReplaySpineMoment {
  readonly ordinal: number;
}

export interface ReplaySpineProps {
  /** The version's moments, in ordinal order. */
  readonly moments: readonly ReplaySpineMoment[];
  /** The moment shown now. */
  readonly ordinal: number;
  readonly direction: 'rtl' | 'ltr';
  /** While a command is in flight the moments are not navigated. */
  readonly disabled: boolean;
  /** The adjustable element's name and its value (the approved position sentence of a moment). */
  readonly label: string;
  readonly valueOf: (ordinal: number) => string;
  /** A completed touch on a moment, or an accessible increment / decrement. */
  readonly onCommit: (ordinal: number) => void;
}

/**
 * The window over the moments. It jumps (never glides), and only when the committed moment would leave it — T-05's
 * rule: a whole window of moments at a time, from the first.
 */
export function replaySpineOffset(position: number, count: number, viewport: number): number {
  const fits = Math.floor(viewport / TIMELINE_STEP);
  if (viewport <= 0 || fits < 1 || count * TIMELINE_STEP <= viewport) return 0;
  const page = Math.floor((position - 1) / fits);
  return Math.min(page * fits * TIMELINE_STEP, count * TIMELINE_STEP - viewport);
}

interface SpineTouchBinding {
  readonly moments: readonly ReplaySpineMoment[];
  readonly onCommit: (ordinal: number) => void;
  readonly setPreview: (position: number | null) => void;
  readonly acknowledgeCommit: () => void;
  readonly acknowledgeCancel: () => void;
}

/**
 * The touches of one Spine. One touch is one interaction, numbered on the UI runtime: a callback from an older touch,
 * or from one already settled, is ignored, so a late preview can never reopen a settled touch and an old release can
 * never commit for a newer one (the guarantee T-06's scrub gives its own strip). It holds a preview position and calls
 * `onCommit` with one ordinal; it reaches nothing else.
 */
export function createSpineTouches() {
  // The newest touch heard of, and the newest touch already settled: a touch settles once, whichever of its two
  // recognisers (the drag or the tap) reports first.
  let latest = 0;
  let closed = 0;
  let bound: SpineTouchBinding | null = null;
  return {
    bind(binding: SpineTouchBinding) {
      bound = binding;
    },
    target(at: number, index: number) {
      if (bound === null || at < latest || at <= closed) return;
      latest = at;
      bound.setPreview(index + 1);
    },
    settle(at: number, completed: boolean, index: number) {
      if (bound === null || at < latest || at <= closed) return;
      latest = at;
      closed = at;
      bound.setPreview(null);
      const moment = completed && index !== NO_STEP ? bound.moments[index] : undefined;
      if (moment === undefined) {
        bound.acknowledgeCancel();
        return;
      }
      bound.onCommit(moment.ordinal);
      bound.acknowledgeCommit();
    },
  };
}

export function ReplaySpine({ moments, ordinal, direction, disabled, label, valueOf, onCommit }: ReplaySpineProps) {
  const ink = useAnalysisInk();
  const rtl = direction === 'rtl';
  const count = moments.length;
  // A position on the spine is the moment's place in the version (1 … count), never its TC.
  const committed = Math.max(1, moments.findIndex((moment) => moment.ordinal === ordinal) + 1);
  const [viewport, setViewport] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const offset = replaySpineOffset(committed, count, viewport);

  const geometry = useMemo(() => ({ stepWidth: TIMELINE_STEP, windowOffset: offset, viewport, rtl }), [offset, viewport, rtl]);
  // T-06's own motion, told a pinned moment (there is no Live here) and the preview, if any.
  const motion = useTemporalMotion({ committedSp: committed, previewSp: preview, mode: 'PINNED', dragging: false }, geometry);
  const spine = useMemo(
    () => spinePresentation({ disclosed: count, offset, viewport, committedSp: committed, targetSp: preview }),
    [count, offset, viewport, committed, preview],
  );

  // The mapping the UI runtime reads at touch time: never animated, only set.
  const viewportShared = useSharedValue(viewport);
  const offsetShared = useSharedValue(offset);
  const rtlShared = useSharedValue(rtl ? 1 : 0);
  const countShared = useSharedValue(count);
  const epoch = useSharedValue(0);
  const failures = useSharedValue(0);
  useLayoutEffect(() => {
    viewportShared.set(viewport);
    offsetShared.set(offset);
    rtlShared.set(rtl ? 1 : 0);
    countShared.set(count);
  }, [viewport, offset, rtl, count, viewportShared, offsetShared, rtlShared, countShared]);

  // One touch session per Spine, bound to what it must reach at call time (never during render).
  const [session] = useState(createSpineTouches);
  useLayoutEffect(() => {
    session.bind({ moments, onCommit, setPreview, acknowledgeCommit: motion.acknowledgeCommit, acknowledgeCancel: motion.acknowledgeCancel });
  }, [session, moments, onCommit, motion.acknowledgeCommit, motion.acknowledgeCancel]);
  const { target, settle } = session;

  const { fingerX, tracking } = motion;
  useAnimatedReaction(
    () => {
      if (tracking.get() !== 1) return NO_STEP;
      const logical = presentationX(fingerX.get(), viewportShared.get(), rtlShared.get() === 1);
      if (logical === null) return NO_STEP;
      const index = Math.floor((offsetShared.get() + logical) / TIMELINE_STEP);
      return index >= 0 && index < countShared.get() ? index : NO_STEP;
    },
    (index, previous) => {
      if (index !== previous && index !== NO_STEP) scheduleOnRN(target, epoch.get(), index);
    },
  );

  const gesture = useMemo(() => {
    const enabled = !disabled && count > 0;
    // Where the finger LIFTED, read on the UI runtime: a completed touch commits the moment it ended on, and a
    // release outside the moments commits nothing.
    const indexAt = (x: number) => {
      'worklet';
      const logical = presentationX(x, viewportShared.get(), rtlShared.get() === 1);
      const index = logical === null ? NO_STEP : Math.floor((offsetShared.get() + logical) / TIMELINE_STEP);
      return index >= 0 && index < countShared.get() ? index : NO_STEP;
    };
    // One touch has two recognisers racing (a drag, and a tap that never moves far enough to become one). The one that
    // completes commits; the touch is cancelled only once BOTH have failed, so the loser's cancellation can never close
    // a touch the winner is about to commit.
    const failed = () => {
      'worklet';
      failures.set(failures.get() + 1);
      if (failures.get() >= RECOGNISERS) {
        tracking.set(0);
        scheduleOnRN(settle, epoch.get(), false, NO_STEP);
      }
    };
    // A drag: the preview follows the finger (T-06's tracking) and the release commits.
    const drag = Gesture.Pan()
      .minDistance(0)
      .withTestId(REPLAY_SPINE_GESTURE_TEST_ID)
      .enabled(enabled)
      .onBegin((event) => {
        epoch.set(epoch.get() + 1);
        failures.set(0);
        fingerX.set(event.x);
        tracking.set(1);
      })
      .onUpdate((event) => {
        fingerX.set(event.x);
      })
      .onEnd((event, success) => {
        if (success !== true) return;
        tracking.set(0);
        scheduleOnRN(settle, epoch.get(), true, indexAt(event.x));
      })
      .onFinalize((_event, success) => {
        if (success !== true) failed();
      });
    // A tap on a notch: the same touch (the drag began it and shows its preview), committed where the finger lifted.
    const tap = Gesture.Tap()
      .withTestId(REPLAY_SPINE_TAP_TEST_ID)
      .enabled(enabled)
      .onEnd((event, success) => {
        if (success !== true) return;
        tracking.set(0);
        scheduleOnRN(settle, epoch.get(), true, indexAt(event.x));
      })
      .onFinalize((_event, success) => {
        if (success !== true) failed();
      });
    return Gesture.Race(drag, tap);
  }, [disabled, count, epoch, failures, fingerX, tracking, viewportShared, offsetShared, rtlShared, countShared, settle]);

  const onAction = useCallback((event: AccessibilityActionEvent) => {
    const index = committed - 1 + (event.nativeEvent.actionName === 'increment' ? 1 : event.nativeEvent.actionName === 'decrement' ? -1 : 0);
    const moment = moments[index];
    if (!disabled && moment !== undefined && index !== committed - 1) onCommit(moment.ordinal);
  }, [committed, disabled, moments, onCommit]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        testID={REPLAY_SPINE_TEST_ID}
        onLayout={(event: LayoutChangeEvent) => setViewport(Math.floor(event.nativeEvent.layout.width))}
        style={{ direction, flex: 1, height: BAND, overflow: 'hidden' }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 1, max: count, now: committed, text: valueOf(ordinal) }}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
      >
        <SpineLayer spine={spine} ink={ink.tertiary} targetInk={ink.primary} layer="SPINE" testID={`${REPLAY_SPINE_TEST_ID}-line`} />
        {/* T-06's two markers, its anchor geometry and its motion, each carrying P2's Parting drawing. */}
        <Animated.View testID={`${REPLAY_SPINE_TEST_ID}-committed`} pointerEvents="none"
          style={[{ position: 'absolute', top: MARKER_INSET, start: 0, width: 0, height: BAND - 2 * MARKER_INSET }, motion.committedStyle]}>
          <Aperture kind="COMMITTED" testID={`${REPLAY_SPINE_TEST_ID}-committed-aperture`} ink={ink.primary} ground={ink.world} style={{ position: 'absolute', top: -MARKER_INSET, start: -P2_SPINE.aperture.halfWidth }} />
        </Animated.View>
        <Animated.View testID={`${REPLAY_SPINE_TEST_ID}-preview`} pointerEvents="none"
          style={[{ position: 'absolute', top: MARKER_INSET, start: 0, width: 0, height: BAND - 2 * MARKER_INSET }, motion.cursorStyle]}>
          <Aperture kind="PREVIEW" testID={`${REPLAY_SPINE_TEST_ID}-preview-aperture`} ink={ink.primary} ground={ink.world} style={{ position: 'absolute', top: -MARKER_INSET, start: -P2_SPINE.aperture.halfWidth }} />
        </Animated.View>
        <SpineLayer spine={spine} ink={ink.tertiary} targetInk={ink.primary} layer="TARGET" testID={`${REPLAY_SPINE_TEST_ID}-target`} />
      </View>
    </GestureDetector>
  );
}
