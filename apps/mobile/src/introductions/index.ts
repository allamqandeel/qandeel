/**
 * S6-01 — the «التعارف مع قنديل» / Introductions with QANDEEL owner layer: its ONE public surface.
 *
 * A depth of Personal QANDEEL: the manual entry on the Personal row and the private preparation surface over the
 * Personal world. It owns no canonical state, no Session, no credential and no persistence: the integration owner
 * builds one controller per runtime generation over the T-12P transport and retires it with that generation.
 * Preparation is never enrollment (CW2-06A §2.2).
 */
export type {
  IntroductionsController,
  IntroductionsControllerOptions,
  IntroductionsNotice,
  IntroductionsState,
  IntroductionsTransport,
} from './introductions-controller';
export { createIntroductionsController, mintIntroductionsCommandId } from './introductions-controller';
export type { IntroductionsCopy } from './copy';
export { INTRODUCTIONS_COPY_GATE, INTRODUCTIONS_HISTORICAL_COPY, introductionsCopy } from './copy';
export type { IntroductionsEntryProps } from './IntroductionsEntry';
export { IntroductionsEntry } from './IntroductionsEntry';
export type { IntroductionsSurfaceProps } from './IntroductionsSurface';
export { INTRODUCTIONS_SURFACE_TEST_ID, IntroductionsSurface } from './IntroductionsSurface';
