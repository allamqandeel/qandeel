/**
 * T-12 — the reader's own way to change semantic depth on the Map.
 *
 * The canonical act, its rung lineage and its geometric reinforcement have existed and been tested
 * since T-04. What did not exist was a way for a reader holding the phone to ask for one: the Map
 * carried a single `Gesture.Pan`, and the only production caller of `zoomSemanticStep` was the
 * accessibility layer's viewport action. So Semantic Zoom worked for TalkBack and VoiceOver and did
 * nothing at all under two fingers, which is exactly what physical testing on the Honor reported.
 *
 * ## Semantic, never optical
 *
 * A pinch here is a REQUEST for one step along the frozen depth lineage. It is not magnification, and
 * the scale the fingers produced is not truth: it is read once, at the end, only to decide which
 * direction was asked for. The resulting depth comes from the canonical action alone, and at the
 * World floor or the Provenance ceiling the act is legitimately absent rather than faked — a boundary
 * is not a no-op, it is the absence of an act.
 *
 * ## One gesture, at most one act
 *
 * Everything canonical happens on END, once, and only when the recogniser reports success. Nothing is
 * written per frame, nothing is written from an animation callback, and a cancelled, interrupted or
 * insufficient pinch writes nothing at all. That is the same single-crossing discipline the pan
 * already keeps, for the same reason: reversible history must record acts the reader performed, not
 * frames their fingers passed through.
 *
 * ## Why the threshold is this number
 *
 * `SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR` is already the proportion by which a depth step
 * reinforces the camera's scale — an eighth. Requiring the fingers to travel at least that same
 * proportion before a step is committed reuses a frozen quantity instead of inventing a feel
 * constant: the gesture must be at least as large as the change it asks for. Below it the pinch is
 * finger noise on a drag and is refused, which is what keeps an ordinary Pan from ever becoming a
 * depth change.
 */
import { useCallback, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import { handoffToProduct, type AuthorityGeneration } from '../../motion';
import type { CanonicalStore } from '../../state';
import type { MapActionOutcome } from '../outcome';
import { zoomSemanticStep } from './map-camera-actions';
import { SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR, SEMANTIC_ZOOM_REINFORCEMENT_NUMERATOR } from './zoom';

/**
 * The neutral band around scale 1, derived from the frozen reinforcement rather than chosen.
 *
 * A pinch must open or close by at least the proportion one depth step is worth before it counts as
 * having asked for one.
 */
export const SEMANTIC_ZOOM_GESTURE_THRESHOLD =
  1 + Number(SEMANTIC_ZOOM_REINFORCEMENT_NUMERATOR) / Number(SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR);

export interface MapSemanticZoomGestureOptions {
  /** False while the surface cannot be composed, exactly as the pan is disabled. */
  readonly enabled: boolean;
  /** The same generation stamp the pan uses, so a replaced authority cannot be written by a stale end. */
  readonly authority: AuthorityGeneration;
  readonly onSettled?: (outcome: MapActionOutcome) => void;
}

export interface MapSemanticZoomGestureBinding {
  readonly gesture: ReturnType<typeof Gesture.Pinch>;
}

/** Which step a finished pinch asked for, or `null` when it stayed inside the neutral band. */
export function semanticZoomDirectionFor(scale: number): 'IN' | 'OUT' | null {
  if (!Number.isFinite(scale) || scale <= 0) return null;
  if (scale >= SEMANTIC_ZOOM_GESTURE_THRESHOLD) return 'IN';
  if (scale <= 1 / SEMANTIC_ZOOM_GESTURE_THRESHOLD) return 'OUT';
  return null;
}

export function useMapSemanticZoomGesture(store: CanonicalStore, options: MapSemanticZoomGestureOptions): MapSemanticZoomGestureBinding {
  const { enabled, authority, onSettled } = options;

  // The ONE crossing into Product truth, on the JS runtime, from a finished gesture.
  const commit = useCallback(
    (scale: number, generation: number) => {
      // The authority this pinch began under. A depth act must not land on a store that replaced the
      // one the reader was looking at, which is the same rule the pan keeps for a translation.
      if (generation !== authority.current()) return;
      const direction = semanticZoomDirectionFor(scale);
      if (direction === null) return;
      onSettled?.(zoomSemanticStep(store, direction));
    },
    [authority, onSettled, store],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(enabled)
        .onBegin(() => {
          authority.capture();
        })
        // Deliberately no `onChange`/`onUpdate`. The plane does not magnify under the fingers,
        // because Semantic Zoom is a change of what is disclosed rather than of how large it is
        // drawn, and a per-frame canonical write is exactly what this layer must never do.
        .onEnd((event, success) => {
          if (!success) return;
          handoffToProduct(commit, event.scale, authority.captured.get());
        }),
    [authority, commit, enabled],
  );

  return { gesture };
}
