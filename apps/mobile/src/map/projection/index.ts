/**
 * T-04 — the entitlement boundary of the Map: `V` in, `MapScene` out, nothing else in between.
 */
export type {
  MapObjectFamily,
  MapProjectionRequest,
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
  deriveMapScene,
  deriveMapSceneFromDisclosure,
  mapProjectionRequest,
  mapSceneContains,
  mapSceneObject,
  mapSceneObjectKey,
} from './map-scene';
