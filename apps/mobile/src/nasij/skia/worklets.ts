// NASIJ (experimental, isolated) — the camera math the UI thread runs.
//
// These are worklet twins of the pure functions in `../core/camera`. They are re-implemented here (rather than marking
// the core with a directive) so the core stays loadable by the browser preview and the headless rasteriser unchanged;
// `__tests__/worklet-parity.test.ts` holds the twins to the core, value for value. Nothing here allocates per call
// except the two-octave weave answer, and nothing here decides a rung or discloses anything.

const LOG8 = Math.log(8);

/** The ease-out cubic the settle uses, as a cubic-bezier (the standard `easeOutCubic` control points). */
export const SETTLE_BEZIER = [0.215, 0.61, 0.355, 1] as const;
export const SETTLE_MS = 300;

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
 * the array. `unheldMask` has bit r set when rung r is NOT held (0 means every rung is held, or nothing is known).
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

/** The unheld mask of a `held` array (null: every rung is held). */
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

const WEAVE_BASE = 26;

/** One octave of the weave (0: the coarser, 1: the finer): its spacing in FAR points and its opacity. */
export function weaveOctaveAt(ls: number, which: number): { spacing: number; alpha: number } {
  'worklet';
  let d = ls / LOG8;
  // At a rung (within float noise of an integer depth) the coarser octave is EXACTLY opaque and the finer exactly
  // absent, so a resting frame draws one weave pass and no ground under it.
  const nearest = Math.round(d);
  if (Math.abs(d - nearest) < 1e-6) d = nearest;
  const lower = Math.floor(d);
  const f = d - lower;
  if (which === 0) return { spacing: WEAVE_BASE / Math.pow(8, lower), alpha: 1 - f * 0.75 };
  const alpha = Math.max(0, (f - 0.25) / 0.75);
  return { spacing: WEAVE_BASE / Math.pow(8, lower + 1), alpha: alpha > 0.02 ? alpha : 0 };
}

/** A float modulo that is never negative. */
export function mod(a: number, n: number): number {
  'worklet';
  return ((a % n) + n) % n;
}

/** 1 while the ground must be drawn under the weave (a rung transition: the coarser octave is not opaque), else 0. */
export function groundAlphaAt(ls: number): number {
  'worklet';
  return weaveOctaveAt(ls, 0).alpha < 1 ? 1 : 0;
}
