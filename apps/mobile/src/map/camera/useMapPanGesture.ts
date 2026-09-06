/**
 * T-04 — the drag route: a pointer / touch gesture bound to the frozen `PAN` act.
 *
 * The in-progress translation is Class C / D presentation progress. It lives here, in React
 * state, and it is what the renderer offsets its transform by while a finger is down. It is not
 * canonical: nothing is dispatched until the gesture ends, so one drag is one canonical camera
 * intent and one RH checkpoint — never one per frame.
 *
 * A cancelled or interrupted gesture discards the progress and dispatches nothing at all. There
 * is no "partial pan" transaction, and an interrupted drag invents no semantics.
 *
 * Smooth, interruptible motion is T-10's; this binding only guarantees that the mechanics are
 * truthful.
 */
import { useCallback, useMemo, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import type { CanonicalStore } from '../../state';
import type { MapActionOutcome } from '../outcome';
import { panByTranslation } from './map-camera-actions';

export interface MapPanProgress {
  readonly active: boolean;
  readonly translationX: number;
  readonly translationY: number;
}

export const IDLE_PAN_PROGRESS: MapPanProgress = Object.freeze({ active: false, translationX: 0, translationY: 0 });

export interface MapPanGestureBinding {
  /** Compose into a `GestureDetector`. */
  readonly gesture: ReturnType<typeof Gesture.Pan>;
  /** Presentation-only progress of the live drag. Never written to canonical state. */
  readonly progress: MapPanProgress;
}

export interface MapPanGestureOptions {
  readonly enabled?: boolean;
  /** Observes the single canonical outcome of a completed drag; purely informational. */
  readonly onSettled?: (outcome: MapActionOutcome) => void;
}

export function useMapPanGesture(store: CanonicalStore, options: MapPanGestureOptions = {}): MapPanGestureBinding {
  const { enabled = true, onSettled } = options;
  const [progress, setProgress] = useState<MapPanProgress>(IDLE_PAN_PROGRESS);

  const settle = useCallback(
    (translationX: number, translationY: number) => {
      setProgress(IDLE_PAN_PROGRESS);
      const outcome = panByTranslation(store, translationX, translationY);
      onSettled?.(outcome);
    },
    [store, onSettled],
  );

  const discard = useCallback(() => {
    setProgress(IDLE_PAN_PROGRESS);
  }, []);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // The callbacks run on the JS thread: they touch the canonical store, which is plain
        // JavaScript and has no worklet representation.
        .runOnJS(true)
        .enabled(enabled)
        .onUpdate((event) => {
          setProgress({ active: true, translationX: event.translationX, translationY: event.translationY });
        })
        .onEnd((event, success) => {
          if (success) settle(event.translationX, event.translationY);
          else discard();
        })
        // Cancellation, failure and interruption all land here without ever having dispatched.
        .onFinalize((_event, success) => {
          if (!success) discard();
        }),
    [enabled, settle, discard],
  );

  return { gesture, progress };
}
