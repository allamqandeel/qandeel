// COSMOS (experimental, isolated) — the camera and plate maths the UI thread runs.
//
// Worklet twins of the pure functions in `../core/camera`, and of the plate transform in the browser gate's `draw()`.
// They are re-implemented here (rather than marking the core with a directive) so the core stays loadable unchanged by
// the browser gate and the headless tools; `__tests__/worklet-parity.test.ts` holds the twins to the core, value for
// value. Nothing here decides a rung or discloses anything, and nothing here allocates except the plate transform.

const LOG8 = Math.log(8);

/** The settle: ease-out cubic as a cubic-bezier (the standard `easeOutCubic` control points), about 320 ms. */
export const SETTLE_BEZIER = [0.215, 0.61, 0.355, 1] as const;
export const SETTLE_MS = 320;

/** Continuous depth from ln(scale). */
export function depthOfLs(ls: number): number {
  'worklet';
  return ls / LOG8;
}

/** ln(scale) held inside the rubber band on either side of the rungs (the core's `clampScale`, in log space). */
export function clampLs(ls: number, rungs: number): number {
  'worklet';
  const min = -0.35 * LOG8;
  const max = (rungs - 1 + 0.35) * LOG8;
  return Math.min(max, Math.max(min, ls));
}

/**
 * The opacity of ONE rung's layer at a continuous depth: the core's `layerOpacities(depth, rungs, held)[rung]`, without
 * the array. `unheldMask` has bit r set when rung r is NOT held (0: every rung is held, or nothing is known).
 */
export function layerAlphaAt(depth: number, rungs: number, unheldMask: number, rung: number): number {
  'worklet';
  let d = Math.min(rungs - 1, Math.max(0, depth));
  if (unheldMask !== 0) {
    const lo = Math.floor(d);
    const hi = Math.ceil(d);
    const loUnheld = ((unheldMask >> lo) & 1) === 1;
    const hiUnheld = ((unheldMask >> hi) & 1) === 1;
    if (hiUnheld && !loUnheld) d = lo;
    else if (loUnheld && !hiUnheld) d = hi;
  }
  const lower = Math.floor(d);
  const f = d - lower;
  const t = Math.min(1, Math.max(0, (f - 0.3) / 0.4));
  const eased = t * t * (3 - 2 * t);
  if (rung === lower) return 1 - eased;
  if (rung === lower + 1) return eased;
  return 0;
}

/** The unheld mask of a `held` array (null: every rung is held). Not a worklet: it runs where the props are. */
export function unheldMaskOf(held: readonly boolean[] | null): number {
  if (held === null) return 0;
  let mask = 0;
  held.forEach((h, r) => { if (!h) mask |= 1 << r; });
  return mask;
}

/** The pinch ratio (in log space) past which lifting the fingers is one canonical step: ln(1 + 1/8). */
const LN_STEP = Math.log(1.125);

/** 1 for IN, -1 for OUT, 0 for no step: the core's `stepFor`, from the change in ln(scale). */
export function stepForLs(deltaLs: number): number {
  'worklet';
  if (deltaLs >= LN_STEP) return 1;
  if (deltaLs <= -LN_STEP) return -1;
  return 0;
}

/** A float modulo that is never negative. */
export function mod(a: number, n: number): number {
  'worklet';
  return ((a % n) + n) % n;
}

/** How one atmosphere plate moves: the gate's `plate(pattern, zExp, pan, driftX, driftY, …)` arguments. */
export interface PlateMotion { readonly zExp: number; readonly pan: number; readonly driftX: number; readonly driftY: number }

/** The gate's plates for a world of `rungs` rungs: DEEP, GAS and the VEIL that passes in front. */
export function plateMotions(rungs: number): { readonly deep: PlateMotion; readonly gas: PlateMotion; readonly veil: PlateMotion } {
  const zGas = Math.log(2.3) / Math.log(Math.pow(8, rungs - 1));
  return {
    deep: { zExp: zGas * 0.45, pan: 0.35, driftX: 0, driftY: 0 },
    gas: { zExp: zGas, pan: 0.9, driftX: 1.1, driftY: 0.45 },
    veil: { zExp: zGas * 1.7, pan: 2.4, driftX: -2.6, driftY: 1.2 },
  };
}

/**
 * One plate's placement: the offset of its tile's top-left corner on the glass and the scale of one image pixel.
 *
 * The gate's formula, exactly: a 1024-pixel tile is drawn at k = 1.05·scale^zExp·900/1024, so one repeat is
 * 1.05·scale^zExp·900 points whatever the image's own size (the 512 veil is simply drawn at twice the pixel scale); the
 * plate's centre sits at the view focus when the camera is at the origin, it slides by scale^0.55·pan per world point,
 * and it drifts with the clock. The plate repeats, so only the offset inside one repeat is kept: the shader never sees
 * a large translation, whatever the camera's position.
 */
export function plateOffsetOf(
  cx: number, cy: number, ls: number, focusX: number, focusY: number, clock: number,
  zExp: number, pan: number, driftX: number, driftY: number, imagePixels: number,
): { x: number; y: number; k: number } {
  'worklet';
  const period = 1.05 * Math.exp(ls * zExp) * 900;
  const shift = Math.exp(ls * 0.55);
  const x = focusX - period * 0.5 - cx * shift * pan + driftX * clock;
  const y = focusY - period * 0.5 - cy * shift * pan + driftY * clock;
  return { x: ((x % period) + period) % period, y: ((y % period) + period) % period, k: period / imagePixels };
}

/** Nearest-rank percentile of an ASCENDING array's first `n` values (0 for none). */
export function percentileOf(sorted: number[], n: number, p: number): number {
  'worklet';
  if (n <= 0) return 0;
  return sorted[Math.min(n - 1, Math.max(0, Math.floor(n * p)))];
}

/**
 * The UI runtime's own monotonic clock, in ms. Both ends of the "gesture event → next UI frame" measurement read THIS
 * clock, on the same runtime, so the difference is meaningful whatever epoch the frame callback's timestamp uses.
 */
export function uiNow(): number {
  'worklet';
  return performance.now();
}
