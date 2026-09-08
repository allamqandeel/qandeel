/**
 * T-11 — Responsive Recomposition: the presentation layer that lets one world survive a changing
 * window.
 *
 * > **The window changes. The world does not.**
 * > **Recompose density, never meaning.**
 *
 * Everything published here is Class D. This layer owns measured container facts, the usable
 * presentation rect, safe-inset and font-scale arithmetic, the pure recomposition plan, the
 * content-stress bands and the presentation geometry generation. It owns nothing else, and it
 * cannot: it imports `react` and `react-native` and its own modules, and nothing at all besides.
 * There is no path from here to the canonical store, a Return executor, a temporal action, the
 * semantic projection authority, the API or the database — not through a barrel, not through a deep
 * import, and not through a callback.
 *
 * What that boundary buys is the whole contract in one sentence: a resize can change what is
 * visible and it cannot change what is true. No canonical camera write, no reversible-history
 * entry, no `PAN`, no semantic zoom, no Return, no `TM`/`TC`/`PTC` change, no disclosure decision,
 * no Product fetch and no word.
 *
 * This barrel is the layer's whole public surface, and it is an allowlist.
 *
 * Nothing here is mounted in the app shell. Where the world, the Timeline and the chrome finally
 * sit together, which locale is spoken, and where safe-area insets and Dynamic Type come from are
 * the integration task's decisions; T-11 builds the room and the seams they arrive through.
 */
export type {
  PresentationRect,
  PresentationSurface,
  PresentationSurfaceInput,
} from './surface';
export {
  MAX_TRACKED_FONT_SCALE,
  POINT_QUANTUM,
  presentationSurface,
  quantizeFontScale,
  quantizePoints,
  surfaceEquals,
  usableHeight,
  usableWidth,
} from './surface';

export type {
  ChromeArrangement,
  ChromeComposition,
  MapFrameComposition,
  PresentationBand,
  RecompositionOptions,
  RecompositionPlan,
} from './plan';
export {
  BAND_GAP_POINTS,
  BAND_HYSTERESIS_POINTS,
  bandFor,
  CHROME_ARRANGEMENTS,
  CHROME_FLOOR_POINTS,
  CHROME_MAX_MEASURE_POINTS,
  CHROME_OWN_HORIZONTAL_PADDING,
  EXPANSIVE_BAND_PADDING,
  EXPANSIVE_MIN_WIDTH,
  MAP_MIN_HEIGHT_POINTS,
  PAIRED_COLUMN_GAP_POINTS,
  PAIRED_MIN_CELL_POINTS,
  planEquals,
  PRESENTATION_BANDS,
  recompositionPlan,
  SHORT_BAND_GAP_POINTS,
  SHORT_HEIGHT_POINTS,
  TIMELINE_ROW_POINTS,
} from './plan';

export type { MeasuredSurfaceBinding, ResponsiveInsets, ResponsiveSurfaceOptions } from './useResponsiveSurface';
export { useResponsiveSurface } from './useResponsiveSurface';

export type { ResponsiveSurfaceProps } from './ResponsiveSurface';
export { RESPONSIVE_SURFACE_TEST_ID, ResponsiveSurface } from './ResponsiveSurface';

export type { ResponsiveMapFrameProps } from './ResponsiveMapFrame';
export { RESPONSIVE_MAP_FRAME_TEST_ID, ResponsiveMapFrame } from './ResponsiveMapFrame';

export type { ResponsiveTimelineRowProps } from './ResponsiveTimelineRow';
export { RESPONSIVE_TIMELINE_ROW_TEST_ID, ResponsiveTimelineRow, TIMELINE_ROW_SHRINK } from './ResponsiveTimelineRow';

export type { ResponsiveChromeBandProps } from './ResponsiveChromeBand';
export { RESPONSIVE_CHROME_BAND_TEST_ID, RESPONSIVE_CHROME_MEASURE_TEST_ID, ResponsiveChromeBand } from './ResponsiveChromeBand';
