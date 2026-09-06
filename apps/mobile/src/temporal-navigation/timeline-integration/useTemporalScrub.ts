/**
 * T-06 — the pointer route: a scrub over the disclosed Track bound to preview and to the one
 * commit boundary.
 *
 * Threading is the whole of this file's job, and it adds no Product decision of its own:
 *
 *   - the gesture callbacks are worklets. They write the finger position and the tracking flag into
 *     shared values on the UI runtime, so the preview cursor follows the finger without a single
 *     React render and without a single cross-runtime hop per frame;
 *   - `scheduleOnRN` is never called per frame. A reaction watches the DERIVED disclosed step index
 *     and schedules the RN-runtime handler only when that index actually changes — at most once per
 *     48-point step of travel — and once more when the gesture ends;
 *   - every Product decision lives in `createScrubHandlers`, on the RN runtime, where it is
 *     ordinary testable code. Nothing in a worklet decides what is addressable, what is previewed,
 *     what is committed or what is cancelled.
 *
 * The gesture activates at zero distance, so a tap and a drag are one interaction: a tap previews
 * its target and commits it on release, a drag previews each step it crosses and commits the last
 * one on release, and either can be abandoned. `enabled` is honoured for gestures that have not
 * started yet; an in-flight gesture is not cancelled by it, which is Gesture Handler's own
 * behaviour and is safe here because ending an in-flight gesture always goes through `settle`.
 */
import { useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useAnimatedReaction, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { TIMELINE_STEP } from '../../timeline';
import { presentationX } from './disclosed-bridge';
import { createScrubHandlers, type ScrubDependencies, type ScrubHandlers } from './scrub';

/** No disclosed step is under the finger. Never a valid index, so it can never target anything. */
const NO_STEP = -1;

export interface TemporalScrubGeometry {
  readonly viewport: number;
  readonly windowOffset: number;
  readonly rtl: boolean;
}

export interface TemporalScrubOptions extends ScrubDependencies {
  readonly geometry: TemporalScrubGeometry;
  readonly enabled?: boolean;
  /** The motion binding's own shared values. This hook writes them; it reads no Product truth. */
  readonly fingerX: SharedValue<number>;
  readonly tracking: SharedValue<number>;
}

export interface TemporalScrubBinding {
  readonly gesture: ReturnType<typeof Gesture.Pan>;
  readonly handlers: ScrubHandlers;
}

export function useTemporalScrub(options: TemporalScrubOptions): TemporalScrubBinding {
  const { geometry, enabled = true, fingerX, tracking } = options;
  const { store, preview, snapshot, onCommitted, onCancelled, onOutcome, onPreview } = options;

  const handlers = useMemo(
    () => createScrubHandlers({ store, preview, snapshot, onCommitted, onCancelled, onOutcome, onPreview }),
    [store, preview, snapshot, onCommitted, onCancelled, onOutcome, onPreview],
  );

  // Presentation geometry lives in shared values so the reaction can read it on the UI runtime
  // without being rebuilt — and without a stale window offset silently targeting the wrong step.
  const viewport = useSharedValue(geometry.viewport);
  const windowOffset = useSharedValue(geometry.windowOffset);
  const rtl = useSharedValue(geometry.rtl ? 1 : 0);
  useEffect(() => {
    viewport.set(geometry.viewport);
    windowOffset.set(geometry.windowOffset);
    rtl.set(geometry.rtl ? 1 : 0);
  }, [geometry.viewport, geometry.windowOffset, geometry.rtl, viewport, windowOffset, rtl]);

  useAnimatedReaction(
    () => {
      if (tracking.get() !== 1) return NO_STEP;
      const logical = presentationX(fingerX.get(), viewport.get(), rtl.get() === 1);
      if (logical === null) return NO_STEP;
      return Math.floor((windowOffset.get() + logical) / TIMELINE_STEP);
    },
    (index, previous) => {
      // The threshold, not the frame: the RN runtime hears about a crossing, never about a pixel.
      if (index !== previous && index !== NO_STEP) scheduleOnRN(handlers.targetIndex, index);
    },
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .enabled(enabled)
        .onBegin((event) => {
          fingerX.set(event.x);
          tracking.set(1);
        })
        .onUpdate((event) => {
          fingerX.set(event.x);
        })
        .onEnd((_event, success) => {
          tracking.set(0);
          scheduleOnRN(handlers.settle, success === true);
        })
        // Cancellation, failure and interruption all arrive here without ever having committed. A
        // successful end has already settled above, so this only closes the unsuccessful endings.
        .onFinalize((_event, success) => {
          tracking.set(0);
          if (success !== true) scheduleOnRN(handlers.settle, false);
        }),
    [enabled, fingerX, tracking, handlers],
  );

  return { gesture, handlers };
}
