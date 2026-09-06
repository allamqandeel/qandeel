/**
 * T-04 — canonical world model: exact OSDAP v1 addresses and the encodings that sit behind
 * T-02's opaque camera and locus references. Nothing here reads a device dimension, and nothing
 * here can move a Home: a canonical address is decoded, compared and re-encoded, never derived.
 */
export type { CanonicalWorldAddress, OsdapDecode, OsdapRejectionReason, OsdapScheme } from './osdap';
export {
  OSDAP_MAX_COORD,
  OSDAP_MIN_COORD,
  OSDAP_V1_SCHEME,
  canonicalCoordinateText,
  canonicalWorldAddress,
  decodeCanonicalWorldAddress,
  decodeDisclosedHome,
  isCanonicalCoordinate,
  isCanonicalCoordinateText,
  parseCanonicalCoordinate,
  worldAddressEquals,
  worldAddressKey,
} from './osdap';

export { absBigInt, clampBigInt, gcdBigInt, ratioToFinite, roundDiv } from './exact-math';

export type {
  MapDestination,
  MapLocusKind,
  MapOrientation,
  MapOrientationUpAxis,
  MapScale,
  WorldRefDecode,
  WorldRefRejectionReason,
} from './world-refs';
export {
  CANONICAL_MAP_ORIENTATION,
  MAP_LOCUS_KINDS,
  MAP_LOCUS_SCHEME,
  MAP_ORIENTATION_SCHEME,
  MAP_ORIENTATION_UP_AXES,
  MAP_SCALE_SCHEME,
  MAX_WORLD_UNITS_PER_POINT_DENOMINATOR,
  MAX_WORLD_UNITS_PER_POINT_NUMERATOR,
  MIN_WORLD_UNITS_PER_POINT_DENOMINATOR,
  MIN_WORLD_UNITS_PER_POINT_NUMERATOR,
  clampedMapScale,
  decodeScaleIntentRef,
  decodeSpatialDestinationRef,
  decodeWorldAnchorRef,
  decodeWorldOrientationRef,
  mapDestination,
  mapOrientationEquals,
  mapScale,
  mapScaleEquals,
  scaleBy,
  scaleIntentRef,
  spatialDestinationRef,
  worldAnchorRef,
  worldOrientationRef,
} from './world-refs';
