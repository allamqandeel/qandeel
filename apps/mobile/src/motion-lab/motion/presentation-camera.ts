/**
 * T-10.0 MOTION LAB — the presentation camera, in plain arithmetic.
 *
 * The canonical camera (`MC`: anchor, scale, depth) is decided by the T-02 kernel through the
 * T-04 executors and nothing here can touch it. What this module owns is the RESIDUAL between
 * that canonical camera and what is on screen right now, so that a committed canonical change
 * never teleports the pixels:
 *
 *     screen(p) = c + zoom · (p + t − c)
 *
 * where `p` is a node's position under the CANONICAL camera (T-04's `placeScene`), `c` the
 * viewport centre, `t` the residual translation of the world plane in points, and `zoom` the
 * residual scale about the centre. At rest `t = 0` and `zoom = 1`, and the screen shows exactly
 * the canonical camera.
 *
 * A finger writes `t` directly (1:1, P2). Momentum after release decays `t` (P3). A canonical
 * camera change re-bases the residual so the current frame is preserved (`rebase`), and then the
 * direction's choreography animates the residual back to rest — the world resolving toward its
 * committed camera. Whatever the choreography does, the destination is the same: canonical truth.
 *
 * Everything here is pure, worklet-safe arithmetic over floats that are already presentation
 * quantities. No canonical coordinate enters as a float: T-04's exact projection produces the
 * points, and this module only relates two projections of the same place.
 */

export interface ResidualCamera {
  readonly tx: number;
  readonly ty: number;
  readonly zoom: number;
}

export const AT_REST: ResidualCamera = Object.freeze({ tx: 0, ty: 0, zoom: 1 });

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Where a canonical-camera point is drawn under the residual. */
export function toScreen(p: Point, residual: ResidualCamera, center: Point): Point {
  'worklet';
  return {
    x: center.x + residual.zoom * (p.x + residual.tx - center.x),
    y: center.y + residual.zoom * (p.y + residual.ty - center.y),
  };
}

/** The canonical-camera point under a screen point: the inverse, for hit testing a touch. */
export function toCanonical(s: Point, residual: ResidualCamera, center: Point): Point {
  'worklet';
  return {
    x: center.x + (s.x - center.x) / residual.zoom - residual.tx,
    y: center.y + (s.y - center.y) / residual.zoom - residual.ty,
  };
}

/**
 * The residual that keeps the current frame exactly where it is after the canonical camera moved.
 *
 * `k` is the ratio of points-per-world-unit, new over old (a semantic zoom IN by one rung gives
 * `k = 8`); `d` is where the NEW anchor was drawn on the OLD screen, relative to the centre (a pan
 * that committed the finger's own translation `t` lands `d ≈ −t`, so the residual returns to ~0).
 *
 *     zoom' = zoom / k          t' = k · (t + d)
 */
export function rebaseResidual(residual: ResidualCamera, k: number, d: Point): ResidualCamera {
  'worklet';
  return {
    zoom: residual.zoom / k,
    tx: k * (residual.tx + d.x),
    ty: k * (residual.ty + d.y),
  };
}

/** Distance the plane still has to travel to rest, in screen points. */
export function travelDistance(residual: ResidualCamera): number {
  'worklet';
  return Math.hypot(residual.tx * residual.zoom, residual.ty * residual.zoom);
}

/** A residual small enough to be rest: below the sub-point resolution T-04 captures a translation at. */
export const REST_EPSILON_POINTS = 1 / 1024;

export function isAtRest(residual: ResidualCamera): boolean {
  'worklet';
  return Math.abs(residual.tx) < REST_EPSILON_POINTS && Math.abs(residual.ty) < REST_EPSILON_POINTS && Math.abs(residual.zoom - 1) < 1e-6;
}

/** The size factor that keeps a node's radius constant on screen while the plane carries a residual zoom. */
export function counterScale(zoom: number): number {
  'worklet';
  return zoom > 1e-6 ? 1 / zoom : 1;
}

/**
 * The plane transform for a Skia `Group` whose `origin` is the viewport centre:
 * `[translate(zoom·t), scale(zoom)]` about `c` draws `p` at `c + zoom·(p + t − c)`.
 */
export function planeTransform(residual: ResidualCamera): readonly [number, number, number] {
  'worklet';
  return [residual.zoom * residual.tx, residual.zoom * residual.ty, residual.zoom];
}
