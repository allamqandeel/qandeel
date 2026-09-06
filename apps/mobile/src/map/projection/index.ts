/**
 * T-04 — the entitlement boundary of the Map: `V` in, `MapScene` out, nothing else in between.
 */
export type {
  DisclosedProjectionContext,
  DisclosedProjectionTuple,
  MapObjectFamily,
  MapProjectionFreshness,
  MapProjectionRequest,
  MapProjectionStaleReason,
  MapScene,
  MapSceneAppearanceLocus,
  MapSceneDerivation,
  MapSceneLocus,
  MapSceneObject,
  MapSceneRejectionReason,
  MapSceneRungs,
  MapSceneThreadHomeLocus,
} from './map-scene';
export {
  MAP_OBJECT_FAMILIES,
  MAP_PROJECTION_STALE_REASONS,
  deriveMapScene,
  deriveMapSceneFromDisclosure,
  mapContextFreshness,
  mapProjectionRequest,
  mapSceneContains,
  mapSceneObject,
  mapSceneObjectKey,
  projectionTupleFreshness,
  sceneProjectionTuple,
} from './map-scene';
