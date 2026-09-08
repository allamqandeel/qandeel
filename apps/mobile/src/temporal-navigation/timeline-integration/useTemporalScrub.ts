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
 *
 * ## An interaction also belongs to the GEOMETRY it began under (T-11)
 *
 * The epoch above answers "which gesture is speaking". It cannot answer "does this coordinate still
 * mean what it meant", and that is a different question with the same shape.
 *
 * A finger position is physical. It becomes a disclosed step through `presentationX(x, viewport,
 * rtl)` and the window offset, and the viewport is a MEASURED presentation quantity: a rotation, a
 * split-view drag, a safe-area change or a font-scale reflow can change it while a finger is still
 * down. When it does, the very same untouched physical point resolves to a different step — and in
 * right-to-left it resolves to a step on the other side of the strip, because the mirror is taken
 * about a width that no longer exists. The open interaction would then retarget its Preview to a
 * Moment the reader never pointed at, and its release would COMMIT that Moment. Nothing in the
 * epoch machine can see it: the gesture never ended, so its epoch is still current and still open.
 *
 * So an interaction carries the presentation geometry generation it began under, exactly as it
 * carries its epoch. The generation advances only when the two quantities the MAPPING is taken
 * through change — the viewport and the direction. The window offset is deliberately not one of
 * them: scrolling the Track during a scrub is a presentation move T-05 and T-06 already support,
 * the offset is read live on the UI runtime, and the finger keeps pointing at the physical place it
 * is pointing at.
 *
 * When the generation advances under a live finger the interaction is RETIRED through T-06's own
 * interruption route — `settle(epoch, false)`, the same path a cancellation, a failure and a
 * competing recognizer take. That closes the interaction, discards the Preview it established, and
 * writes nothing canonical. Everything that follows falls out of the epoch machine rather than out
 * of a new rule: the reaction stops scheduling because its captured generation is stale, and the
 * gesture's own eventual end arrives with an epoch that is current but CLOSED, so it is ignored. A
 * stale coordinate therefore cannot commit a Moment, cannot retarget a Preview and cannot be
 * adopted by the geometry that replaced it — and no timer decides any of it.
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

/**
 * The mapping every surface starts with. Declared here rather than imported from the responsive
 * owner: this guard is T-06's own interaction ownership, it must hold for every caller — including
 * one that composes the strip itself — and a temporal layer that needed a presentation layer to be
 * mounted before it could refuse a stale coordinate would be exactly the wrong dependency.
 */
const FIRST_GEOMETRY_GENERATION = 1;

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
  // How many times the MAPPING has been replaced, and which replacement the open gesture belongs to.
  // Presentation only, and never a Product count: it names no target, no Moment and no act.
  const geometryGeneration = useSharedValue(FIRST_GEOMETRY_GENERATION);
  const gestureGeometry = useSharedValue(FIRST_GEOMETRY_GENERATION);
  const mapping = useRef<{ readonly viewport: number; readonly rtl: boolean } | null>(null);
  useLayoutEffect(() => {
    viewport.set(geometry.viewport);
    windowOffset.set(geometry.windowOffset);
    rtl.set(geometry.rtl ? 1 : 0);
    const previous = mapping.current;
    mapping.current = { viewport: geometry.viewport, rtl: geometry.rtl };
    // The first mapping replaces nothing; there is no interaction that could predate it.
    if (previous === null || (previous.viewport === geometry.viewport && previous.rtl === geometry.rtl)) return;
    geometryGeneration.set(geometryGeneration.get() + 1);
    // A bounded read at a commit boundary — never during render, never per frame. A finger that is
    // down right now is pointing through a mapping that no longer exists, so its interaction is
    // interrupted through the route every other interruption takes.
    if (tracking.get() === 1) handlers.settle(epoch.get(), false);
  }, [geometry.viewport, geometry.windowOffset, geometry.rtl, viewport, windowOffset, rtl, geometryGeneration, tracking, handlers, epoch]);

  useAnimatedReaction(
    () => {
      if (tracking.get() !== 1) return NO_STEP;
      // A coordinate taken under a replaced mapping is not a coordinate in this one. It is dropped
      // rather than converted: converting it would be inventing a place the finger never touched.
      if (geometryGeneration.get() !== gestureGeometry.get()) return NO_STEP;
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
          // And the mapping it is being performed through, stamped before the first point.
          gestureGeometry.set(geometryGeneration.get());
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
    [enabled, fingerX, tracking, epoch, gestureGeometry, geometryGeneration, handlers],
  );

  return { gesture, handlers };
}
