// NASIJ (experimental, isolated) — the presentation camera.
//
// The canonical camera (anchor, rung) stays where it lives today: in the store or the field controller. THIS camera is
// presentation only (the product's Class D): it follows the fingers continuously, and when they lift it eases to the
// canonical camera the authority answered with. It decides no rung and discloses nothing.
//
// EXPERIMENTAL DEPARTURE, FLAGGED FOR THE PRODUCT OWNER: production applies nothing while a pinch is in progress ("no
// optical magnification"). Here the cloth magnifies under the fingers during the pinch, showing only data the current
// and already-held rungs disclose. The canonical step is still one act at the end of the gesture.

export interface NasijCamera {
  /** The FAR-point world position drawn at the focus point of the view. */
  readonly cx: number;
  readonly cy: number;
  /** Points per FAR point: 1 at the first rung, 8^r at rung r. */
  readonly scale: number;
}

export interface NasijView { readonly width: number; readonly height: number; /** Where the camera's (cx, cy) is drawn. */ readonly focusX: number; readonly focusY: number }

export const LOG8 = Math.log(8);
/** Continuous depth: 0 at the first rung, 1 at the second, … */
export const depthOf = (scale: number): number => Math.log(scale) / LOG8;

/** The pinch ratio past which lifting the fingers is one canonical step (the product's own 1 + 1/8). */
export const STEP_THRESHOLD = 1.125;

export function stepFor(pinchRatio: number): 'IN' | 'OUT' | null {
  if (pinchRatio >= STEP_THRESHOLD) return 'IN';
  if (pinchRatio <= 1 / STEP_THRESHOLD) return 'OUT';
  return null;
}

/** How far a pinch may stretch past the rungs on either side while the fingers are down (rubber band). */
export function clampScale(scale: number, rungs: number): number {
  const min = Math.pow(8, -0.35); const max = Math.pow(8, rungs - 1 + 0.35);
  return Math.min(max, Math.max(min, scale));
}

/**
 * The opacity of each rung's layer at a continuous depth. At an integer depth exactly one layer is 1 and the rest are 0,
 * so a resting frame and a panning frame draw one layer and need no offscreen surface. `held` says which rungs the host
 * has data for: an unheld rung never fades in, and its neighbour stays instead (a container, never guessed content).
 */
export function layerOpacities(depth: number, rungs: number, held: readonly boolean[] | null = null): number[] {
  let d = Math.min(rungs - 1, Math.max(0, depth));
  if (held !== null) {
    const lower = Math.floor(d); const upper = Math.ceil(d);
    if (held[upper] === false && held[lower] !== false) d = lower;
    else if (held[lower] === false && held[upper] !== false) d = upper;
  }
  const out: number[] = [];
  const lower = Math.floor(d); const f = d - lower;
  // The cross-fade occupies the middle of the interval; near either rung one layer is fully opaque.
  const t = Math.min(1, Math.max(0, (f - 0.3) / 0.4));
  const eased = t * t * (3 - 2 * t);
  for (let r = 0; r < rungs; r += 1) out.push(r === lower ? 1 - eased : r === lower + 1 ? eased : 0);
  return out;
}

/** World → screen. */
export function project(camera: NasijCamera, view: NasijView, x: number, y: number): { x: number; y: number } {
  return { x: (x - camera.cx) * camera.scale + view.focusX, y: (y - camera.cy) * camera.scale + view.focusY };
}

export function unproject(camera: NasijCamera, view: NasijView, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - view.focusX) / camera.scale + camera.cx, y: (sy - view.focusY) / camera.scale + camera.cy };
}

/** Pinch about a screen point: the world point under the fingers stays under them. */
export function zoomAbout(camera: NasijCamera, view: NasijView, sx: number, sy: number, scale: number): NasijCamera {
  const w = unproject(camera, view, sx, sy);
  return { scale, cx: w.x - (sx - view.focusX) / scale, cy: w.y - (sy - view.focusY) / scale };
}

/**
 * A critically damped approach in LOG scale: a zoom that covers equal ratios in equal times reads as constant speed,
 * where a linear-scale spring looks like a snap at one end. `dt` in seconds; returns the next camera and whether it is
 * at rest. Frame-rate independent.
 */
export function approach(camera: NasijCamera, target: NasijCamera, dt: number, halfLifeMs = 90): { camera: NasijCamera; atRest: boolean } {
  const k = 1 - Math.pow(0.5, (dt * 1000) / halfLifeMs);
  const ls = Math.log(camera.scale) + (Math.log(target.scale) - Math.log(camera.scale)) * k;
  const scale = Math.exp(ls);
  // Move the centre in SCREEN terms of the current scale so pan and zoom arrive together.
  const cx = camera.cx + (target.cx - camera.cx) * k;
  const cy = camera.cy + (target.cy - camera.cy) * k;
  const atRest = Math.abs(Math.log(target.scale) - ls) < 0.002 && Math.abs(target.cx - cx) * scale < 0.25 && Math.abs(target.cy - cy) * scale < 0.25;
  return atRest ? { camera: target, atRest } : { camera: { cx, cy, scale }, atRest };
}

/** The affine matrix [a, b, c, d, e, f] (x' = a·x + c·y + e) that draws a FAR-point layer for this camera. */
export function matrixOf(camera: NasijCamera, view: NasijView): [number, number, number, number, number, number] {
  return [camera.scale, 0, 0, camera.scale, view.focusX - camera.cx * camera.scale, view.focusY - camera.cy * camera.scale];
}

/**
 * The woven ground: octaves of weave whose spacing is x8 apart, exactly one octave per rung. Returns the octaves that
 * are legible at this scale with their opacity, so zooming always shows cloth of a readable gauge.
 */
export function weaveOctaves(scale: number): { spacing: number; alpha: number }[] {
  const base = 26; // points between weft lines at the first rung
  const d = depthOf(scale);
  const lower = Math.floor(d); const f = d - lower;
  // Octave `lower` has on-screen spacing base·8^f (26 → 208); octave lower+1 has base·8^(f-1) (3.25 → 26).
  return [
    { spacing: base / Math.pow(8, lower), alpha: 1 - f * 0.75 },
    { spacing: base / Math.pow(8, lower + 1), alpha: Math.max(0, (f - 0.25) / 0.75) },
  ].filter((o) => o.alpha > 0.02);
}
