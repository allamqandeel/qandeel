/**
 * T-11 — measuring a container, and turning that measurement into a stable plan.
 *
 * Two properties matter more than anything this hook computes, and both are structural:
 *
 *   **the plan's IDENTITY is its value.** Every input the plan is derived from is a number, the
 *   derivation is pure, and it is memoized on those numbers — so a container that reports the same
 *   rect twice produces the same plan OBJECT, every memo downstream holds, and neither the Map's
 *   placement, its Skia tree, its hit map nor its accessible tree is rebuilt. That is what keeps a
 *   60-frame split-view drag from re-deriving the world sixty times;
 *
 *   **the settled band is decided where the measurement arrives, not in an effect.** The hysteresis
 *   needs to know which band is already on screen. Writing that from an effect would set state
 *   synchronously inside one — a cascading render, and a rule the React Compiler correctly refuses
 *   — and reading it from a ref during render would make this hook impure. So it is decided inside
 *   the `onLayout` handler, from the band the previous measurement settled on, and stored WITH the
 *   measurement it belongs to. One state, written by an event, read during render.
 *
 * Nothing here reads a platform dimension, a device, a screen or a window. The container is asked
 * how big it is, and the insets and the font scale arrive as explicit presentation seams.
 */
import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { bandFor, recompositionPlan, type PresentationBand, type RecompositionPlan } from './plan';
import { presentationSurface, quantizeFontScale, quantizePoints, type PresentationSurface } from './surface';

export interface ResponsiveInsets {
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
  readonly left?: number;
}

export interface ResponsiveSurfaceOptions {
  /**
   * Safe-area insets, in points.
   *
   * A SEAM, not an ownership claim: the provider that knows them lives at the app root, and the app
   * root belongs to the integration task. Supplying them changes usable layout and padding and
   * nothing else — no camera act, no canonical movement, no temporal change, no hidden control.
   */
  readonly insets?: ResponsiveInsets;
  /**
   * The reader's text-size multiplier. The same kind of seam, for the same reason: Dynamic Type is
   * a device accessibility setting and no container can be asked for it.
   */
  readonly fontScale?: number;
}

export interface MeasuredSurfaceBinding {
  /** Attach to the container whose geometry is the responsive authority. */
  readonly onLayout: (event: LayoutChangeEvent) => void;
  /** `null` until the container has a real rect. No plan is better than a plausible wrong one. */
  readonly plan: RecompositionPlan | null;
  /** The normalized measurement behind the plan, for a consumer that needs the rect itself. */
  readonly surface: PresentationSurface | null;
}

/** One measurement, and the band it settled on. They belong together and are stored together. */
interface Measured {
  readonly width: number;
  readonly height: number;
  readonly band: PresentationBand;
}

export function useResponsiveSurface(options: ResponsiveSurfaceOptions = {}): MeasuredSurfaceBinding {
  const { insets, fontScale } = options;
  const top = quantizePoints(insets?.top ?? 0);
  const right = quantizePoints(insets?.right ?? 0);
  const bottom = quantizePoints(insets?.bottom ?? 0);
  const left = quantizePoints(insets?.left ?? 0);
  const scale = quantizeFontScale(fontScale ?? 1);

  const [measured, setMeasured] = useState<Measured | null>(null);

  // Quantized before it is state, so a container that has not moved cannot re-render anything by
  // reporting a different float for the same rect — and the band is settled here, against the band
  // the previous measurement settled on, so the hysteresis needs no effect and no ref.
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = quantizePoints(event.nativeEvent.layout.width);
      const height = quantizePoints(event.nativeEvent.layout.height);
      setMeasured((current) => {
        const band = bandFor(width - left - right, current?.band ?? null);
        if (current !== null && current.width === width && current.height === height && current.band === band) return current;
        return { width, height, band };
      });
    },
    [left, right],
  );

  const surface = useMemo(
    () =>
      measured === null
        ? null
        : presentationSurface({
            width: measured.width,
            height: measured.height,
            insetTop: top,
            insetRight: right,
            insetBottom: bottom,
            insetLeft: left,
            fontScale: scale,
          }),
    [bottom, left, measured, right, scale, top],
  );

  // Memoized on the surface and the settled band, both of which are stable when the numbers are, so
  // the plan object is stable exactly when the composition is.
  const band = measured?.band ?? null;
  const plan = useMemo(() => (surface === null ? null : recompositionPlan(surface, { band })), [band, surface]);

  return useMemo(() => ({ onLayout, plan, surface }), [onLayout, plan, surface]);
}
