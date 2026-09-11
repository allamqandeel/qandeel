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
 *   **the settled band follows the USABLE width, whatever moved it.** The hysteresis needs to know
 *   which band is already on screen, and the band's own input — the usable width — has three
 *   independent authorities: the measured container width, the left inset and the right inset. Only
 *   the first of them arrives as an event.
 *
 * ## R1 — why the settlement is not in the layout handler (T11-R1-01)
 *
 * It used to be. The band was settled inside `onLayout` from `width - left - right` and stored with
 * the measurement, which is correct for exactly one of the three authorities. When an inset prop
 * changed without a new container layout, the surface and the plan recomposed against the NEW
 * usable width while the stored band still described the OLD one — so the hysteresis was handed a
 * predecessor from a width that no longer existed.
 *
 * The consequence is not cosmetic. Hysteresis is path-dependent by construction: inside the dead
 * zone the band is decided by history rather than by the width, so a wrong predecessor is a wrong
 * band. An inset-only step down through the boundary would settle COMPACT on screen while the
 * stored band stayed EXPANSIVE, and the next inset-only step could then flip back up using the
 * stale EXPANSIVE down-threshold instead of the COMPACT up-threshold it should have been held to.
 * One presentation composition would have been decided by a band no composition ever settled.
 *
 * So the settlement moved to where the usable width actually resolves — the render — and is
 * adjusted there against the band the immediately preceding composition settled. This is React's
 * own pattern for state derived from previous state: the update is issued during render of this
 * same component, so React discards the in-progress output and re-runs immediately, before any
 * commit. There is no effect, no cascading commit, no extra paint, no timer, no ref read during
 * render and no remount, and the guard makes it self-terminating — the second pass finds the
 * settlement already keyed to this usable width and issues nothing.
 *
 * `onLayout` is now free of the insets entirely, so its identity never changes for the life of the
 * hook and the measured container never re-attaches its handler.
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
  /**
   * The envelope this container is composed inside, in points.
   *
   * The same kind of seam again, and for the same reason: no container can be asked whether the
   * thing it sits in has changed shape. It is an INVALIDATION input — it says a measurement taken
   * before it no longer describes anything — and never a substitute for what the container reports.
   */
  readonly envelope?: { readonly width: number; readonly height: number } | null;
}

export interface MeasuredSurfaceBinding {
  /** Attach to the container whose geometry is the responsive authority. */
  readonly onLayout: (event: LayoutChangeEvent) => void;
  /** `null` until the container has a real rect. No plan is better than a plausible wrong one. */
  readonly plan: RecompositionPlan | null;
  /** The normalized measurement behind the plan, for a consumer that needs the rect itself. */
  readonly surface: PresentationSurface | null;
}

/** What the container reported. The band is deliberately NOT here: see R1 above. */
interface Measured {
  readonly width: number;
  readonly height: number;
}

/**
 * The band the last composition settled, and the usable width it settled it AT.
 *
 * Both halves are load-bearing. The band is the hysteresis predecessor; the width is what says
 * whether that predecessor still belongs to the composition being derived, so a settlement can
 * never be reused across a usable width it was not taken at.
 */
interface Settled {
  readonly usable: number;
  readonly band: PresentationBand;
}

export function useResponsiveSurface(options: ResponsiveSurfaceOptions = {}): MeasuredSurfaceBinding {
  const { insets, fontScale, envelope } = options;
  const top = quantizePoints(insets?.top ?? 0);
  const right = quantizePoints(insets?.right ?? 0);
  const bottom = quantizePoints(insets?.bottom ?? 0);
  const left = quantizePoints(insets?.left ?? 0);
  const scale = quantizeFontScale(fontScale ?? 1);
  const envelopeWidth = quantizePoints(envelope?.width ?? 0);
  const envelopeHeight = quantizePoints(envelope?.height ?? 0);

  const [measured, setMeasured] = useState<Measured | null>(null);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [composedIn, setComposedIn] = useState<Measured | null>(null);

  // R2 — retire a measurement the moment the envelope it was taken inside stops existing.
  //
  // The container is still the geometry authority and still reports through `onLayout`. What this
  // adds is the ONE thing a container cannot tell us: that the envelope it is composed inside has
  // changed, so a measurement taken in the previous one no longer describes anything. Without it a
  // portrait measurement survived into landscape and every region was allocated against a surface
  // that was no longer there — measured on a device, the world kept a 388-point portrait share
  // inside a 369-point landscape window and pushed the whole support band off the bottom.
  //
  // The envelope arrives as an explicit presentation seam, exactly as the insets and the font scale
  // do, so this layer still reads no display of its own. It is used to INVALIDATE, and only as the
  // opening value for the new composition until the container reports again — never as a standing
  // authority over what the container says.
  //
  // Issued during render, which is React's own pattern for state derived from previous state, and
  // self-terminating for the same reason the band settlement below is: the second pass finds the
  // envelope already recorded and issues nothing.
  let current = measured;
  const envelopeChanged =
    envelopeWidth > 0 &&
    envelopeHeight > 0 &&
    (composedIn === null || composedIn.width !== envelopeWidth || composedIn.height !== envelopeHeight);
  if (envelopeChanged) {
    current = { width: envelopeWidth, height: envelopeHeight };
    setComposedIn({ width: envelopeWidth, height: envelopeHeight });
    setMeasured(current);
  }

  // Quantized before it is state, so a container that has not moved cannot re-render anything by
  // reporting a different float for the same rect. It reports the rect and nothing else — the band
  // is not its business, because two of the band's three inputs never reach it.
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const width = quantizePoints(event.nativeEvent.layout.width);
    const height = quantizePoints(event.nativeEvent.layout.height);
    setMeasured((current) => (current !== null && current.width === width && current.height === height ? current : { width, height }));
  }, []);

  const surface = useMemo(
    () =>
      current === null
        ? null
        : presentationSurface({
            width: current.width,
            height: current.height,
            insetTop: top,
            insetRight: right,
            insetBottom: bottom,
            insetLeft: left,
            fontScale: scale,
          }),
    [bottom, left, current, right, scale, top],
  );

  // The usable width, from all three of its authorities at once. This is the quantity the band is a
  // function of, and the only quantity a settlement may be keyed to.
  const usable = current === null ? null : current.width - left - right;

  // Settle the band for THIS usable width, against the band the immediately preceding composition
  // settled — never against one remembered from a width that has since changed.
  //
  // The update is issued during render, which is React's own pattern for state derived from
  // previous state and is not the effect the compiler refuses: React discards this pass and re-runs
  // the component immediately, before anything is committed. The guard is what makes it terminate —
  // the second pass finds the settlement already keyed to this usable width and issues nothing — and
  // it is also why an unchanged measurement costs no extra pass at all.
  let band: PresentationBand | null = settled === null ? null : settled.band;
  if (usable !== null && (settled === null || settled.usable !== usable)) {
    band = bandFor(usable, settled === null ? null : settled.band);
    setSettled({ usable, band });
  }

  // Memoized on the surface and the settled band, both of which are stable when the numbers are, so
  // the plan object is stable exactly when the composition is.
  const plan = useMemo(() => (surface === null ? null : recompositionPlan(surface, { band })), [band, surface]);

  return useMemo(() => ({ onLayout, plan, surface }), [onLayout, plan, surface]);
}
