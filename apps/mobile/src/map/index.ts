/**
 * T-04 — Living Analysis Map: canonical world projection, camera mechanics, inspection and
 * context navigation.
 *
 * ONE persistent world. Historical, live, inspected, focused, mobile and zoomed states are views
 * of it, never alternative layouts of it. Everything visible here is derived from the disclosed
 * projection `V`; everything canonical is written through the T-02 store, whose per-field
 * authority, `Φ_eff` no-op rule and RH boundary are unchanged.
 *
 * Layer order, and the reason each boundary exists:
 *
 *   `world`          exact OSDAP v1 addresses and the encodings behind T-02's opaque refs, so a
 *                    canonical coordinate is never a float and a scheme is never assumed;
 *   `projection`     `V` → `MapScene`, so the visual Map, hit testing and the accessible tree
 *                    cannot disagree about what exists;
 *   `camera`         the concrete camera behind `MC`, the Class-D presentation envelope, and the
 *                    interpreters that turn one completed input into one canonical act;
 *   `inspection`     entitlement, locatability and the three promoted Map acts;
 *   `accessibility`  the same scene as native semantics, with a non-drag route to every intent;
 *   `renderer`       neutral structural paint over the same placement hit testing uses.
 *
 * Nothing here writes `LF`, moves `TM` or `TC`, implements a Timeline, a Preview, a temporal
 * locate, a return act, final chrome, a motion language or responsive Product recomposition.
 */
export * from './world';
export * from './projection';
export * from './camera';
export * from './inspection';
export * from './accessibility';
export * from './renderer';
export type { MapActionOutcome, MapActionRejectionCode } from './outcome';
export { dispatchMapAction } from './outcome';
