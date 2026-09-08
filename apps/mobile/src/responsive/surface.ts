/**
 * T-11 — the measured presentation surface: the only facts responsive recomposition is allowed to
 * consume.
 *
 * **The window changes. The world does not.**
 *
 * Everything in this module is Class D. It is derived from what the surface was MEASURED to be —
 * never from a device name, a platform, a brand, a screen, a display or a global window — and it
 * never enters `MC`, `Φ_eff`, `TM`, `TC`, `PTC`, `V`, RH or any Product answer. A resize recomputes
 * these numbers and nothing else.
 *
 * ## Why measured container geometry, and not the window
 *
 * A reusable Product surface does not own the display. It is composed inside something: a split
 * view, a sheet, a proof harness, a future shell with chrome around it. `Dimensions.get('window')`
 * answers a question nobody asked — how big is the display — and answering the wrong question
 * confidently is worse than not answering it, because the layout looks decided. So the surface is
 * told its own rect by whoever laid it out, and this module reads no platform API at all.
 *
 * The same rule covers the two facts that are NOT container geometry:
 *
 *   - **safe-area insets.** They come from a provider that lives at the app root, and the app root
 *     is T-12's. T-11 defines the SEAM and consumes explicit numbers, exactly as T-08 already does
 *     with `bottomInset`. Nothing here imports a safe-area package or mounts a provider.
 *   - **font scale.** Dynamic Type is a device accessibility setting, not a property of a
 *     container, so no container can be asked for it. It is an explicit input with a neutral
 *     default, and binding it to the platform belongs with the same root composition.
 *
 * ## Quantization, and why it is not cosmetic
 *
 * `onLayout` reports layout points as floats: on Android they are device pixels divided by a
 * density that is rarely an integer, so a container that has not moved can report
 * `359.99998474121094` and then `360.0000152587891`. Composition must not depend on that
 * difference. Every measurement is therefore captured at whole points before anything reads it,
 * which makes the plan a function of a stable quantity rather than of measurement noise. It is not
 * a rounding convenience: it is what makes "repeated identical measurements produce identical
 * composition" true of the real input rather than only of the pure function.
 *
 * Quantization alone cannot settle a threshold that the container is sitting exactly on — that is
 * what the band hysteresis in `plan.ts` is for.
 */

/** One presentation point. Every measured quantity is captured at this resolution. */
export const POINT_QUANTUM = 1;

/**
 * The measured rect of the surface, plus the presentation facts that change how much of it is
 * usable. Frozen, normalized, and comparable by value.
 */
export interface PresentationSurface {
  /** Measured container width, in whole points. */
  readonly width: number;
  /** Measured container height, in whole points. */
  readonly height: number;
  readonly insetTop: number;
  readonly insetRight: number;
  readonly insetBottom: number;
  readonly insetLeft: number;
  /**
   * The reader's text-size preference as a multiplier, quantized to hundredths.
   *
   * Presentation pressure, never a reason to remove truth: it may grow the chrome and let the Map
   * show less, and it may never shorten a word, shrink a control or hide an act.
   */
  readonly fontScale: number;
}

/** What a caller supplies. Insets and font scale are seams with neutral defaults. */
export interface PresentationSurfaceInput {
  readonly width: number;
  readonly height: number;
  readonly insetTop?: number;
  readonly insetRight?: number;
  readonly insetBottom?: number;
  readonly insetLeft?: number;
  readonly fontScale?: number;
}

/** A rect with the exact shape T-04's `viewportEnvelope` accepts. Structural on purpose. */
export interface PresentationRect {
  readonly width: number;
  readonly height: number;
  readonly insetTop: number;
  readonly insetRight: number;
  readonly insetBottom: number;
  readonly insetLeft: number;
}

/** The largest font scale the presentation is proven against. Beyond it the plan still holds. */
export const MAX_TRACKED_FONT_SCALE = 4;

const isMeasurable = (value: number): boolean => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Captures a measured float at whole points. Never widens a rect, so a cull can never shrink. */
export const quantizePoints = (points: number): number => Math.round(points / POINT_QUANTUM) * POINT_QUANTUM;

/** Captures a font scale at hundredths, so a platform's own float noise cannot recompose a surface. */
export const quantizeFontScale = (scale: number): number => Math.round(scale * 100) / 100;

/**
 * Normalizes one measurement into a presentation surface, or refuses it.
 *
 * `null` means "this is not a surface", never "here is a guess". A zero-width container during the
 * first layout pass, a NaN from a detached view, insets that consume the whole rect — each of them
 * is a real thing that happens, and each of them produces no plan rather than a plausible wrong
 * one. The consequence is a surface that renders nothing yet, which is honest, instead of a Map
 * drawn against invented geometry.
 */
export function presentationSurface(input: PresentationSurfaceInput): PresentationSurface | null {
  const width = quantizePoints(input.width);
  const height = quantizePoints(input.height);
  const insetTop = quantizePoints(input.insetTop ?? 0);
  const insetRight = quantizePoints(input.insetRight ?? 0);
  const insetBottom = quantizePoints(input.insetBottom ?? 0);
  const insetLeft = quantizePoints(input.insetLeft ?? 0);
  const rawScale = input.fontScale ?? 1;
  if (![input.width, input.height, input.insetTop ?? 0, input.insetRight ?? 0, input.insetBottom ?? 0, input.insetLeft ?? 0].every(isMeasurable)) {
    return null;
  }
  if (!Number.isFinite(rawScale) || rawScale <= 0) return null;
  if (width <= 0 || height <= 0) return null;
  // The same refusal T-04's envelope makes, for the same reason: a safe area that has been consumed
  // entirely is not a smaller surface, it is no surface.
  if (insetLeft + insetRight >= width || insetTop + insetBottom >= height) return null;
  return Object.freeze({
    width,
    height,
    insetTop,
    insetRight,
    insetBottom,
    insetLeft,
    fontScale: quantizeFontScale(Math.min(rawScale, MAX_TRACKED_FONT_SCALE)),
  });
}

export const usableWidth = (surface: PresentationSurface): number => surface.width - surface.insetLeft - surface.insetRight;

export const usableHeight = (surface: PresentationSurface): number => surface.height - surface.insetTop - surface.insetBottom;

/** Component-wise: two surfaces with the same seven numbers are the same surface. */
export function surfaceEquals(a: PresentationSurface, b: PresentationSurface): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.insetTop === b.insetTop &&
    a.insetRight === b.insetRight &&
    a.insetBottom === b.insetBottom &&
    a.insetLeft === b.insetLeft &&
    a.fontScale === b.fontScale
  );
}
