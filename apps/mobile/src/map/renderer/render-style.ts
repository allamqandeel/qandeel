/**
 * T-04 — the OPEN-17 presentation-only seam.
 *
 * Exactly two tunable values survive, and both are pure paint:
 *
 *   `ambient`     the intensity of the ambient background wash;
 *   `emptySpace`  the intensity of the empty-space texture painted behind the world plane.
 *
 * Neither is an input to anything that could carry meaning. They do not reach canonical state,
 * `K(TC)`, `V`, a Home coordinate, the camera, the visible footprint, `MapScene` membership,
 * node placement, hit geometry, the accessible semantic tree or the availability of any act:
 * the placement and accessibility layers do not take a `RenderStyle` at all, which is why the
 * separation is structural rather than a promise. Two different values therefore differ in
 * nonsemantic pixels and in nothing else.
 *
 * No third channel may be added here. A tuning value with a semantic consequence is not a
 * tuning value.
 */
export interface RenderStyle {
  /** Ambient background wash intensity, `0`…`1`. */
  readonly ambient: number;
  /** Empty-space texture intensity, `0`…`1`. */
  readonly emptySpace: number;
}

export const RENDER_STYLE_CHANNELS = Object.freeze(['ambient', 'emptySpace'] as const);
export type RenderStyleChannel = (typeof RENDER_STYLE_CHANNELS)[number];

const clampUnit = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export function renderStyle(ambient: number, emptySpace: number): RenderStyle {
  return Object.freeze({ ambient: clampUnit(ambient), emptySpace: clampUnit(emptySpace) });
}

export const DEFAULT_RENDER_STYLE: RenderStyle = renderStyle(0.5, 0.5);
