/**
 * VPORT-01 — a READ of the presented plane, for paint that has to agree with it.
 *
 * The world's material (its FAR / MID / NEAR response, and the drift of its world-anchored atmosphere)
 * must follow the SAME residual the plane is drawn with, on the same frames, or a semantic travel would
 * show the old world's geometry wearing the new world's light. This owner is the one place the
 * animation runtime is named, so the reading is offered here rather than by importing that runtime
 * into the Map.
 *
 * It is a reading and nothing else. It starts no animation, owns no clock, chooses no curve, holds no
 * state, can be told no cause, and writes nothing: a derived value is recomputed when what it reads
 * changes, and the only thing it reads is the binding's own plane transform (or another reading). It
 * cannot move the camera, change what exists, or decide anything a Product act decides.
 */
import { useDerivedValue, type DerivedValue } from 'react-native-reanimated';

import type { PlaneTransform, PresentationCameraBinding } from './usePresentationCamera';

/**
 * A value derived from the plane transform the glass is painted with. `read` must be a worklet: it
 * runs on the UI runtime, once per change of the plane.
 */
export function usePresentationReading<T>(motion: PresentationCameraBinding, read: (plane: PlaneTransform) => T): DerivedValue<T> {
  // Only the plane's own derived value crosses into the worklet, never the whole binding.
  const plane = motion.planeTransform;
  return useDerivedValue(() => read(plane.value));
}

/** A value derived from another reading. `read` must be a worklet. */
export function useReadingOf<S, T>(source: DerivedValue<S>, read: (value: S) => T): DerivedValue<T> {
  return useDerivedValue(() => read(source.value));
}
