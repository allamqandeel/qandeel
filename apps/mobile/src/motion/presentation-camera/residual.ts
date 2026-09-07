/**
 * T-10 — the presentation camera, as exact similarity arithmetic over presentation points.
 *
 * The canonical camera (`MC`: anchor, orientation, scale, depth, destination) is decided by the
 * T-02 kernel through the T-04 executors, and nothing in this file can reach it. What lives here
 * is the RESIDUAL between that camera and what is on the glass right now:
 *
 *     screen(p) = c + zoom · (p + t − c)
 *
 * `p` is a node's position under the CANONICAL camera — T-04's own `placeScene`, projected from
 * exact `bigint` addresses — `c` is the viewport centre, `t` the residual translation of the world
 * plane in points and `zoom` the residual scale about the centre. At rest `t = (0, 0)` and
 * `zoom = 1`, and the glass shows the canonical camera exactly.
 *
 * The residual is PRESENTATION ONLY. It never becomes authority, never dispatches, never decides
 * what exists, and it is discarded rather than committed when a gesture is cancelled. It is also
 * never a place: no canonical coordinate enters here as a float, because T-04's exact projection
 * has already turned the only two things this module relates — two projections of one world — into
 * points.
 *
 * Everything is a worklet: the whole file runs on the UI runtime, per frame, with no crossing.
 */

export interface PresentationResidual {
  readonly tx: number;
  readonly ty: number;
  readonly zoom: number;
}

export interface PresentationPoint {
  readonly x: number;
  readonly y: number;
}

export const RESIDUAL_AT_REST: PresentationResidual = Object.freeze({ tx: 0, ty: 0, zoom: 1 });

/** Where a canonical-camera point is actually drawn under the residual. */
export function residualToScreen(point: PresentationPoint, residual: PresentationResidual, center: PresentationPoint): PresentationPoint {
  'worklet';
  return {
    x: center.x + residual.zoom * (point.x + residual.tx - center.x),
    y: center.y + residual.zoom * (point.y + residual.ty - center.y),
  };
}

/**
 * The canonical-camera point under a screen point: the exact inverse.
 *
 * This is what keeps paint, hit testing and the accessible tree from disagreeing while the plane
 * is between two viewpoints. A tap is converted through the SAME residual the frame was painted
 * with, so a touch always selects the object the reader is looking at rather than the object that
 * would be there if the travel had already finished.
 */
export function screenToResidual(point: PresentationPoint, residual: PresentationResidual, center: PresentationPoint): PresentationPoint {
  'worklet';
  const zoom = Math.abs(residual.zoom) < 1e-9 ? 1 : residual.zoom;
  return {
    x: center.x + (point.x - center.x) / zoom - residual.tx,
    y: center.y + (point.y - center.y) / zoom - residual.ty,
  };
}

/**
 * The residual that keeps the CURRENT frame exactly where it is after the canonical camera moved.
 *
 * `k` is points-per-world-unit, new over old — a Semantic Zoom one rung deeper gives `k = 8`. `d`
 * is where the NEW anchor was drawn on the OLD screen, relative to the centre.
 *
 *     zoom' = zoom / k        t' = k · (t + d)
 *
 * Two consequences the whole system rests on. A completed drag commits the finger's own
 * translation, so `d ≈ −t` and the rebased residual is ~zero: the world HOLDS ITS PLACE at release
 * rather than sliding on or snapping back. And a canonical change arriving mid-travel rebases the
 * residual that is on screen at that instant, so the new travel starts from where the plane
 * actually is — retargeting, never restarting, with no queue anywhere.
 */
export function rebasedResidual(residual: PresentationResidual, k: number, d: PresentationPoint): PresentationResidual {
  'worklet';
  return {
    zoom: residual.zoom / k,
    tx: k * (residual.tx + d.x),
    ty: k * (residual.ty + d.y),
  };
}

/** How far the plane still has to travel to rest, on the glass, in points. */
export function residualTravelPoints(residual: PresentationResidual): number {
  'worklet';
  return Math.hypot(residual.tx * residual.zoom, residual.ty * residual.zoom);
}

/** How far the plane still has to resolve in depth. Zero when the rung is already shown exactly. */
export function residualZoomDistance(residual: PresentationResidual): number {
  'worklet';
  return Math.abs(residual.zoom - 1);
}

/**
 * The factor that keeps an object's own size constant on the glass while the plane carries a
 * residual zoom.
 *
 * A node's radius is a SCREEN quantity — T-04 places every object at a fixed number of points, at
 * every rung — so a plane scaled by the residual would draw it at the wrong size until the residual
 * resolved. Preserving the previous frame means preserving what was on it: the positions AND the
 * sizes. Without this, a depth step shrinks every object to an eighth and grows it back, which
 * reads as an optical zoom — precisely what Semantic Zoom must never look like.
 */
export function counterScale(zoom: number): number {
  'worklet';
  return Math.abs(zoom) > 1e-9 ? 1 / zoom : 1;
}

/**
 * The Skia `Group` transform for a plane whose `origin` is the viewport centre.
 *
 * `[translate(zoom·t), scale(zoom)]` about `c` draws `p` at `c + zoom·(p + t − c)`, which is the
 * definition at the top of this file. The origin is supplied by the caller because Skia's default
 * transform origin is the top-left corner, not the centre.
 */
export function planeTransformTriple(residual: PresentationResidual): readonly [number, number, number] {
  'worklet';
  return [residual.zoom * residual.tx, residual.zoom * residual.ty, residual.zoom];
}
