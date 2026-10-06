/**
 * S5-01 — the «العالم العام» / Public World Product surfaces: the entry controller, the Public World root, the strict
 * singleton root link and the copy.
 */
export type { PublicCopy } from './copy';
export { PUBLIC_COPY_GATE, publicCopy } from './copy';
export type { PublicAreaState, PublicWorldController, PublicWorldControllerOptions, PublicWorldTransport } from './public-world-controller';
export { createPublicWorldController } from './public-world-controller';
export type { PublicWorldAreaProps } from './PublicWorldArea';
export { PUBLIC_AREA_TEST_ID, PublicWorldArea } from './PublicWorldArea';
export type { PublicLinkInbox } from './public-link';
export { createPublicLinkInbox, isPublicWorldLink } from './public-link';
