/**
 * COSMOS-INT-01 Slice C — the pointer route of the accepted bottom rail, over T-06's one interaction authority.
 *
 * T-06's `useTemporalScrub` is the same route for T-05's 48-point Track: it maps the finger through the Track's step and
 * T-05's measured FlatList viewport. The rail is the Track's replacement on the Personal screen (Contract v1.3 §7, §15),
 * and its segments have their OWN pitch — the rail's width over the Moments it shows — so this hook maps the finger
 * through the rail's geometry instead. Everything with Product meaning is still T-06's, reached unchanged:
 *
 *   - `createScrubCoordinator` decides what is disclosed, what is previewed, what is committed and what is cancelled;
 *     ONE coordinator lives per mounted rail over one store and one preview controller, attached to a forwarder that
 *     outlives rerenders and retired in the layout effect's cleanup (FCR-01);
 *   - the per-gesture EPOCH is minted on the UI runtime before anything is scheduled, and every scheduled callback
 *     carries it, so a late or reordered callback changes nothing (R1-02);
 *   - the geometry GENERATION advances when the mapping is replaced — the width, the direction or the pitch — and a
 *     finger that is down at that moment is interrupted through T-06's own route, `settle(epoch, false)` (T-11). The
 *     window start is read live, like T-05's offset: paging the window under a finger retargets nothing by itself;
 *   - exactly three `scheduleOnRN` sites: the derived segment index when it CHANGES, the end, and a non-successful
 *     finalize. Nothing is scheduled per frame.
 *
 * The gesture activates at zero distance, so a tap and a drag are one interaction: a tap previews its segment and
 * commits it on release; a drag previews each segment it crosses and commits the last one on release; cancellation,
 * failure and a competing recognizer all end without a commit. This hook holds no store, no cursor and no clock.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useAnimatedReaction, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { createScrubCoordinator, createScrubForwarder, type ScrubDependencies, type ScrubHandlers, type ScrubObservers } from '../../../temporal-navigation';

/** No segment is under the finger. Never a valid index, so it can never target anything. */
const NO_STEP = -1;
const FIRST_GEOMETRY_GENERATION = 1;
/** The rail's pan, for the gesture test utilities. */
export const RAIL_SCRUB_GESTURE_TEST_ID = 'cosmos-rail-scrub';

export interface RailScrubGeometry {
  /** The rail's measured width, in points: the segments' row. */
  readonly width: number;
  /** Points per shown Moment: `width / shown`. */
  readonly pitch: number;
  /** The index (into the disclosed Track) of the first segment the rail shows. */
  readonly start: number;
  /** How many segments the rail shows. */
  readonly count: number;
  /** The rail's own layout direction (the first Moment at the right). Passed in; never read from the platform. */
  readonly rtl: boolean;
}

export interface RailScrubOptions extends ScrubDependencies {
  readonly geometry: RailScrubGeometry;
  readonly enabled?: boolean;
  /** The motion binding's own shared values. This hook writes them; it reads no Product truth. */
  readonly fingerX: SharedValue<number>;
  readonly tracking: SharedValue<number>;
}

export interface RailScrubBinding {
  readonly gesture: ReturnType<typeof Gesture.Pan>;
  readonly handlers: ScrubHandlers;
}

/** The segment under physical `x`, in the rail's own space, or `NO_STEP`. A worklet: the UI runtime evaluates the same rule the tests do. */
export function railSegmentAt(x: number, width: number, pitch: number, count: number, rtl: boolean): number {
  'worklet';
  if (!Number.isFinite(x) || !Number.isFinite(width) || width <= 0 || !Number.isFinite(pitch) || pitch <= 0) return NO_STEP;
  if (x < 0 || x >= width) return NO_STEP;
  const logical = rtl ? width - x : x;
  const index = Math.floor(logical / pitch);
  return index >= 0 && index < count ? index : NO_STEP;
}

export function useRailScrub(options: RailScrubOptions): RailScrubBinding {
  const { geometry, enabled = true, fingerX, tracking } = options;
  const { store, preview, snapshot, onCommitted, onCancelled, onOutcome, onPreview } = options;

  const latest = useRef<ScrubObservers>({ snapshot, onCommitted, onCancelled, onOutcome, onPreview });
  useLayoutEffect(() => {
    latest.current = { snapshot, onCommitted, onCancelled, onOutcome, onPreview };
  });

  const epoch = useSharedValue(0);
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

  const width = useSharedValue(geometry.width);
  const pitch = useSharedValue(geometry.pitch);
  const start = useSharedValue(geometry.start);
  const count = useSharedValue(geometry.count);
  const rtl = useSharedValue(geometry.rtl ? 1 : 0);
  const geometryGeneration = useSharedValue(FIRST_GEOMETRY_GENERATION);
  const gestureGeometry = useSharedValue(FIRST_GEOMETRY_GENERATION);
  const mapping = useRef<{ readonly width: number; readonly pitch: number; readonly rtl: boolean } | null>(null);
  useLayoutEffect(() => {
    width.set(geometry.width);
    pitch.set(geometry.pitch);
    start.set(geometry.start);
    count.set(geometry.count);
    rtl.set(geometry.rtl ? 1 : 0);
    const previous = mapping.current;
    mapping.current = { width: geometry.width, pitch: geometry.pitch, rtl: geometry.rtl };
    if (previous === null || (previous.width === geometry.width && previous.pitch === geometry.pitch && previous.rtl === geometry.rtl)) return;
    geometryGeneration.set(geometryGeneration.get() + 1);
    // A finger that is down right now points through a mapping that no longer exists: interrupted, never converted.
    if (tracking.get() === 1) handlers.settle(epoch.get(), false);
  }, [geometry.width, geometry.pitch, geometry.start, geometry.count, geometry.rtl, width, pitch, start, count, rtl, geometryGeneration, tracking, handlers, epoch]);

  useAnimatedReaction(
    () => {
      if (tracking.get() !== 1) return NO_STEP;
      if (geometryGeneration.get() !== gestureGeometry.get()) return NO_STEP;
      const segment = railSegmentAt(fingerX.get(), width.get(), pitch.get(), count.get(), rtl.get() === 1);
      return segment === NO_STEP ? NO_STEP : start.get() + segment;
    },
    (index, previous) => {
      if (index !== previous && index !== NO_STEP) scheduleOnRN(handlers.targetIndex, epoch.get(), index);
    },
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .withTestId(RAIL_SCRUB_GESTURE_TEST_ID)
        .minDistance(0)
        .enabled(enabled)
        .onBegin((event) => {
          epoch.set(epoch.get() + 1);
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
        .onFinalize((_event, success) => {
          tracking.set(0);
          if (success !== true) scheduleOnRN(handlers.settle, epoch.get(), false);
        }),
    [enabled, fingerX, tracking, epoch, gestureGeometry, geometryGeneration, handlers],
  );

  return { gesture, handlers };
}
