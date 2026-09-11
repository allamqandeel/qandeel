/**
 * T-12 — Final Living Analysis Map Integration v1: the layer's whole public surface.
 *
 * > **One world. One truth. One composition.**
 * > **Integration connects owners. Integration does not replace owners.**
 *
 * This layer composes already-frozen owners into one Product and owns the four things composition
 * genuinely requires and nobody else could have owned:
 *
 *   the app-root lifecycle — one runtime, one store, one projection cache, one live driver, retired
 *   together;
 *   the app-root presentation facts T-11 left as seams — real safe-area insets, the real font scale;
 *   the one locale authority (`QAN-BL-T12-02`);
 *   and the two bindings that are composition facts by nature — the inspection journey origin
 *   (`QAN-BL-T12-01`) and the exact composite spatial cause (`QAN-BL-MOT-02`).
 *
 * It is NOT a second canonical store, a second Return engine, a second projection cache, a second
 * temporal cursor, a second camera, a semantic resolver, a visual-relationship inference layer, or
 * persistence. It adds no canonical field, no Product act, no temporal mode and no dependency, and it
 * writes no Product truth of its own at all.
 *
 * Restart, recovery and Product persistence remain T-13's: nothing here is stored and nothing is
 * restored. The final Graphic Language remains VI-03's: the Map's paint is still the neutral
 * structural placeholder, and nothing in this layer freezes it, names it final, or replaces it.
 *
 * This barrel is an allowlist, and the static contract pins the exact set of names below.
 */

export type {
  LayoutDirection,
  ProductLocale,
  ProductNumberingSystem,
  ProductRegion,
} from './locale/product-locale';
export {
  LAYOUT_DIRECTIONS,
  PRODUCT_LANGUAGES,
  V1_NUMBERING_SYSTEM,
  V1_REGION,
  isCodeSwitched,
  numberFormattingTag,
  productLocale,
} from './locale/product-locale';
export { deviceLayoutDirection, deviceProductLanguage, deviceProductLocale } from './locale/device-locale';

export type { InspectionJourneyCoordinator } from './journey/inspection-journey';
export { createInspectionJourneyCoordinator } from './journey/inspection-journey';

export type { SpatialCauseBinding } from './motion/spatial-cause';
export { createSpatialCauseBinding } from './motion/spatial-cause';
export type { CanonicalTransitionWitness } from './motion/canonical-transition-witness';
export { createCanonicalTransitionWitness } from './motion/canonical-transition-witness';

export type {
  ProjectionCoordinator,
  ProjectionCoordinatorOptions,
  ProjectionCredential,
  ProjectionFetchOutcome,
} from './projection/projection-coordinator';
export { createProjectionCoordinator } from './projection/projection-coordinator';

export { TIMELINE_TRACK_DEPTH, trackFromDisclosure } from './timeline/disclosed-track-source';

export type { PresentationFacts } from './presentation/presentation-facts';
export { usePresentationFacts } from './presentation/presentation-facts';

export type {
  IntegrationPhase,
  IntegrationRuntime,
  IntegrationRuntimeOptions,
  IntegrationRuntimeResult,
  IntegrationSessionRuntime,
} from './runtime/integration-runtime';
export { T12_STORE_DEPENDENCIES, createIntegrationRuntime } from './runtime/integration-runtime';

export type { LivingAnalysisMapProps } from './composition/LivingAnalysisMap';
export { LivingAnalysisMap } from './composition/LivingAnalysisMap';

export type { ProductRootProps } from './composition/ProductRoot';
export { PRODUCT_ROOT_TEST_ID, ProductRoot, RUNTIME_STATE_TEST_ID } from './composition/ProductRoot';
