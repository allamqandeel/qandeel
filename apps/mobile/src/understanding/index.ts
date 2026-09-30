/**
 * W3-MEGA-U — the «فهم قنديل» / QANDEEL Understanding owner layer: its ONE public surface.
 *
 * A depth of Personal QANDEEL (P1 §11): the U-A entry on the Personal row, the Understanding surface (first view and
 * detail) and the bounded "talk to QANDEEL about this" context the Conversation carries. It owns no canonical state,
 * no Session, no credential and no persistence: the integration owner builds one controller per runtime generation
 * over the T-12P transport and retires it with that generation.
 */
export type {
  UnderstandingController,
  UnderstandingControllerOptions,
  UnderstandingDetailState,
  UnderstandingDiscussion,
  UnderstandingReadStatus,
  UnderstandingState,
  UnderstandingTalkResult,
  UnderstandingTransport,
} from './understanding-controller';
export { createUnderstandingController } from './understanding-controller';
export type { UnderstandingCopy } from './copy';
export { understandingCopy } from './copy';
export type { UnderstandingEntryProps } from './UnderstandingEntry';
export { UnderstandingEntry } from './UnderstandingEntry';
export type { UnderstandingDiscussionStripProps } from './UnderstandingDiscussionStrip';
export { UnderstandingDiscussionStrip } from './UnderstandingDiscussionStrip';
export type { UnderstandingSurfaceProps } from './UnderstandingSurface';
export { UNDERSTANDING_SURFACE_TEST_ID, UnderstandingSurface } from './UnderstandingSurface';
