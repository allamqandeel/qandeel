/**
 * SHARED-VIS-01 — the Shared World field's camera: the ONE semantic-field camera policy of the Living Analysis World,
 * reused — not re-implemented.
 *
 * S5-03B defined it for the first non-Personal World (`../../public-world/field/public-field-camera`): a world camera
 * whose math is the Map's own (the exact integer address, projection, footprint, pan and the frozen ×8 Semantic Zoom
 * reinforcement) with the FAR / MID / NEAR disclosure ladder at the Map's own scales, the World as a whole seen from the
 * World's origin, focus landing at NEAR and the nearest place by exact distance. Nothing in it is Public: it holds no
 * Experience, no Personal `MC`, store, rung or Temporal Context. A Shared World uses exactly the same physics so that it
 * reads as the same Living Analysis world family (C1 of the SHARED-VIS-01 contract).
 *
 * What makes it the Shared World's is OWNERSHIP, not code: a Shared camera is created, held, saved and discarded by the
 * Shared field controller (`./shared-field-controller`) for ONE exact World, in that World's own coordinate space
 * (`QANDEEL_SHARED_FIELD_V1`), so it can neither inherit nor overwrite a Personal, Public or other Shared camera.
 */
export {
  focusField, nearestTo, panField, wholeWorldCamera, zoomField,
  PUBLIC_FIELD_DEPTHS as SHARED_FIELD_DEPTHS,
  type PublicFieldCamera as SharedFieldCamera,
  type PublicFieldDepth as SharedFieldDepth,
  type PublicFieldMove as SharedFieldMove,
} from '../../public-world/field/public-field-camera';
