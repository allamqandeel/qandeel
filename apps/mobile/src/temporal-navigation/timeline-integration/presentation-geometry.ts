/**
 * T-06 — the ONE logical↔physical presentation geometry the temporal strip shares with T-05 (FCR-03).
 *
 * T-05 lays its Timeline out in a LOGICAL left-to-right space: logical `0` is the presentation
 * window's origin, and a logical coordinate grows towards later disclosed Moments. Its item layout,
 * its hit test and its window offset all live in that space, in both writing directions. Only the
 * PHYSICAL placement mirrors under right-to-left: logical `0` sits at the viewport's physical right
 * edge, and a later Moment sits further to the physical left.
 *
 * The temporal strip is a separate surface below the Track, sized to the same viewport and aligned
 * to the same start edge, so its own local physical space is exactly the viewport's: `[0, viewport)`
 * measured from the strip's physical left. Both directions of the mapping live here, as pure
 * arithmetic, so the pointer side (physical touch → logical target) and the motion side (logical
 * rest position → physical marker) cannot drift into two RTL formulas:
 *
 *   physical x  ──presentationX──▶  logical x   (touch → target; the only backwards direction,
 *                                                and it ends at T-05's own hit test)
 *   logical x   ──physicalPresentationX──▶  physical x   (rest position → where to draw)
 *   physical x  ──markerTranslateX──▶  translateX   (where to draw → the transform of a marker
 *                                                    anchored at the strip's START edge)
 *
 * A marker is anchored at the strip's logical start (`start: 0`): its LEADING edge is its left edge
 * in LTR and its right edge in RTL. So a translateX of `0` rests the leading edge on logical `0` in
 * both directions, and `restingMarkerX` is the exact mirror of the LTR value — LTR geometry is
 * untouched, and RTL is its reflection rather than a second convention.
 *
 * None of this is Product truth. A coordinate identifies WHICH disclosed target a reader touched, or
 * WHERE to draw a marker for a Session Position that is already true; it never decides what may be
 * targeted, previewed or committed. Every function is a worklet so the UI runtime can evaluate the
 * same rule the RN runtime and the tests do, rather than a copy of it.
 */

/**
 * Sub-point correction for the right-to-left mirror. A logical coordinate is a half-open `[0, w)`
 * interval, and mirroring a half-open interval produces `(0, w]`; this keeps the mirrored extreme
 * inside the presentation's own convention instead of falling one step past its end.
 */
export const MIRROR_EPSILON = 1 / 1024;

export interface PresentationStripGeometry {
  /** T-05's own Timeline viewport width, in layout points. The strip is sized to exactly this. */
  readonly viewport: number;
  /** The layout direction the strip is laid out under. Passed in, never read from the platform here. */
  readonly rtl: boolean;
}

/**
 * The logical presentation coordinate of a physical strip coordinate, in the same left-to-right
 * space T-05's own hit testing and item layout use — or `null` when the touch is outside the
 * viewport. Right-to-left is mirrored here and nowhere else on the pointer side.
 */
export function presentationX(x: number, viewport: number, rtl: boolean): number | null {
  'worklet';
  if (!Number.isFinite(x) || !Number.isFinite(viewport) || viewport <= 0) return null;
  if (x < 0 || x >= viewport) return null;
  if (!rtl) return x;
  return Math.min(viewport - x, viewport - MIRROR_EPSILON);
}

/**
 * The physical strip coordinate of a logical presentation coordinate: the inverse of
 * `presentationX` for every coordinate inside the viewport. Unbounded on purpose — a Moment outside
 * the presentation window has a physical place outside the strip, and the strip clips it.
 */
export function physicalPresentationX(logicalX: number, viewport: number, rtl: boolean): number {
  'worklet';
  return rtl ? viewport - logicalX : logicalX;
}

/**
 * The `translateX` that puts the LEADING edge of a start-anchored marker at physical `x`. In LTR
 * the marker's leading edge is its left edge and rests at `0`; in RTL it is its right edge and rests
 * at `viewport`, so the same physical place is reached by translating back from there.
 */
export function markerTranslateX(x: number, viewport: number, rtl: boolean): number {
  'worklet';
  return rtl ? x - viewport : x;
}

/**
 * The `translateX` that rests a start-anchored marker's leading edge on logical `x`. Exactly `x` in
 * LTR and exactly `-x` in RTL: the reflection of the same rule, not a second one.
 */
export function restingMarkerX(logicalX: number, viewport: number, rtl: boolean): number {
  'worklet';
  return markerTranslateX(physicalPresentationX(logicalX, viewport, rtl), viewport, rtl);
}
