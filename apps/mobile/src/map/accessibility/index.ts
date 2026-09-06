/**
 * T-04 — the nonvisual Map: one semantic projection of the same `MapScene` the canvas paints.
 */
export type {
  MapAccessibilityAction,
  MapAccessibilityFocus,
  MapAccessibilityNode,
  MapAccessibilityTree,
  MapNodeActionName,
  MapNodePlacement,
  MapViewportActionName,
} from './map-accessibility';
export {
  MAP_CONTAINER_NEUTRAL_LABEL,
  MAP_NODE_ACTIONS,
  MAP_VIEWPORT_ACTIONS,
  buildMapAccessibilityTree,
  mapAccessibilityWithoutProjection,
} from './map-accessibility';

export type { MapAccessibilityLayerProps } from './MapAccessibilityLayer';
export { MAP_ACCESSIBILITY_TEST_ID, MapAccessibilityLayer } from './MapAccessibilityLayer';
