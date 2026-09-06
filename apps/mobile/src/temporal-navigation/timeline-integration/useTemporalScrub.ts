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
 *   - every Product decision lives in `createScrubCoordinator`, on the RN runtime, where it is
 *     ordinary testable code. Nothing in a worklet decides what is addressable, what is previewed,
 *     what is committed or what is cancelled;
 *   - every scheduled callback carries the EPOCH of the gesture that produced it (R1-02). The epoch
 *     is a monotonic counter incremented once per gesture on the UI runtime, and the RN-runtime
 *     coordinator owns the state machine over it, so a callback that arrives after its gesture has
 *     settled, cancelled, failed or been superseded changes nothing — whatever order the two
 *     runtimes deliver in. Correctness does not depend on scheduling luck.
 *
 * ## Interaction ownership survives React (FCR-01)
 *
 * A queued `scheduleOnRN` keeps the function it was scheduled with. If the coordinator were rebuilt
 * whenever an observer callback changed identity, a callback queued before a rerender would run
 * against an old coordinator that knows nothing of the newer interaction. So:
 *
 *   - ONE coordinator lives for as long as this surface is mounted over the same store and preview
 *     controller. It is created in a layout effect keyed on exactly those two, attached to a
 *     forwarder that lives as long as the hook, and retired in that effect's cleanup — on unmount,
 *     or when the store or the preview controller is replaced;
 *   - the observers and the presentation snapshot are read through a ref at CALL time, so their
 *     identity is free to change on every render without touching interaction ownership, and no
 *     caller has to memoize anything;
 *   - what the gesture and the reaction schedule is the forwarder's stable handler set, never the
 *     coordinator itself. Every callback incarnation — however old — reaches whichever coordinator
 *     is attached at delivery, and a callback delivered after unmount reaches nothing at all;
 *   - a successor coordinator starts AFTER every epoch the retired surface already minted, so a
 *     gesture that began before a replacement can never act on the surface that replaced it.
 *
 * The gesture activates at zero distance, so a tap and a drag are one interaction: a tap previews
 * its target and commits it on release, a drag previews each step it crosses and commits the last
 * one on release, and either can be abandoned. `enabled` is honoured for gestures that have not
 * started yet; an in-flight gesture is not cancelled by it, which is Gesture Handler's own
 * behaviour and is safe here because ending an in-flight gesture always goes through `settle`.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useAnimatedReaction, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { TIMELINE_STEP } from '../../timeline';
import { presentationX } from './presentation-geometry';
import { createScrubCoordinator, createScrubForwarder, type ScrubDependencies, type ScrubHandlers, type ScrubObservers } from './scrub';

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
  /** The forwarder's stable handler set. Inert once the surface is retired. */
  readonly handlers: ScrubHandlers;
}

export function useTemporalScrub(options: TemporalScrubOptions): TemporalScrubBinding {
  const { geometry, enabled = true, fingerX, tracking } = options;
  const { store, preview, snapshot, onCommitted, onCancelled, onOutcome, onPreview } = options;

  // The observers are read at CALL time, through a ref that every commit refreshes. Their identity
  // is therefore irrelevant to interaction ownership, and nothing below depends on it.
  const latest = useRef<ScrubObservers>({ snapshot, onCommitted, onCancelled, onOutcome, onPreview });
  useLayoutEffect(() => {
    latest.current = { snapshot, onCommitted, onCancelled, onOutcome, onPreview };
  });

  // The interaction epoch. Incremented once per gesture on the UI runtime and carried by every
  // callback this hook schedules, so the RN-runtime coordinator can tell which gesture is speaking.
  const epoch = useSharedValue(0);

  // The forwarder: created once per hook, and the only thing the gesture and the reaction ever
  // schedule. ONE coordinator per mounted surface over one store and one preview controller is
  // attached to it in a layout effect — so it exists before any gesture can — and retired in the
  // cleanup, so a callback that outlives the surface, or the store or preview controller it was
  // bound to, reaches nothing. The successor starts after every epoch this surface has minted.
  const [forwarder] = useState(createScrubForwarder);
  const handlers = forwarder.handlers;
  useLayoutEffect(() => {
    const coordinator = createScrubCoordinator({ store, preview }, () => latest.current, { after: epoch.get() });
    forwarder.attach(coordinator);
    return () => {
      coordinator.retire();
      forwarder.detach();
    };
  }, [store, preview, epoch, forwarder]);

  // Presentation geometry lives in shared values so the reaction can read it on the UI runtime
  // without being rebuilt — and without a stale window offset silently targeting the wrong step.
  const viewport = useSharedValue(geometry.viewport);
  const windowOffset = useSharedValue(geometry.windowOffset);
  const rtl = useSharedValue(geometry.rtl ? 1 : 0);
  useLayoutEffect(() => {
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
      if (index !== previous && index !== NO_STEP) scheduleOnRN(handlers.targetIndex, epoch.get(), index);
    },
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .enabled(enabled)
        .onBegin((event) => {
          // One increment per gesture, before anything can be scheduled for it. Every later
          // callback of this gesture carries this number, and no other gesture can reuse it.
          epoch.set(epoch.get() + 1);
          fingerX.set(event.x);
          tracking.set(1);
        })
        .onUpdate((event) => {
          fingerX.set(event.x);
        })
        .onEnd((_event, success) => {
          tracking.set(0);
          scheduleOnRN(handlers.settle, epoch.get(), success === true);
        })
        // Cancellation, failure and interruption all arrive here without ever having committed. A
        // successful end has already settled above, so this only closes the unsuccessful endings —
        // and if the end already closed this epoch, the coordinator ignores this one.
        .onFinalize((_event, success) => {
          tracking.set(0);
          if (success !== true) scheduleOnRN(handlers.settle, epoch.get(), false);
        }),
    [enabled, fingerX, tracking, epoch, handlers],
  );

  return { gesture, handlers };
}
