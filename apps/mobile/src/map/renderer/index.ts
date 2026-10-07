/**
 * T-04 — the structural renderer: placement, hit testing, the neutral Skia canvas and the
 * composed surface. Final graphic language, typography, colour, material, iconography, motion
 * and inspection chrome are deliberately absent.
 */
export type { RenderStyle, RenderStyleChannel } from './render-style';
export { DEFAULT_RENDER_STYLE, RENDER_STYLE_CHANNELS, renderStyle } from './render-style';

export type { MapNodeRegion, PlacedNode, PlacedScene } from './map-geometry';
export {
  APPEARANCE_RADIUS_POINTS,
  APPEARANCE_RING_RADIUS_POINTS,
  APPEARANCE_RING_SLOTS,
  APPEARANCE_RING_STEP_POINTS,
  CULL_MARGIN_POINTS,
  HOME_RADIUS_POINTS,
  REGISTER_INSET_POINTS,
  REGISTER_RADIUS_POINTS,
  REGISTER_SLOT_POINTS,
  hitTest,
  isHomeWithinFootprint,
  placeScene,
} from './map-geometry';

export type { CanonicalCameraCommit, MapCanvasProps } from './MapCanvas';
export { MAP_CANVAS_TEST_ID, MapCanvas } from './MapCanvas';

export type { MapSurfaceProps } from './MapSurface';
export { MAP_SURFACE_PLANE_TEST_ID, MAP_SURFACE_TEST_ID, MapSurface } from './MapSurface';

// S5-03B Phase 1 — the generic Living Analysis World seam: the canvas composition and the surface mechanics,
// extracted from MapCanvas / MapSurface without changing what the Personal Map paints or does.
export type { WorldCanvasNode, WorldCanvasPresentation, WorldCanvasProps, WorldNodeRegion, WorldPaintFrame } from './WorldCanvas';
export { WorldCanvas } from './WorldCanvas';
export type { WorldFrame, WorldFrameInput, WorldMotion, WorldSurfaceNode } from './useWorldSurface';
export { useWorldFrame, useWorldMotion } from './useWorldSurface';
// S5-03B R1 — the world view of the one Living Analysis surface: the mechanics (`useWorldView`) and the composed view.
export type { WorldView, WorldViewInput, WorldViewInspection, WorldViewSurfaceProps } from './WorldViewSurface';
export { WorldViewSurface, useWorldView } from './WorldViewSurface';
