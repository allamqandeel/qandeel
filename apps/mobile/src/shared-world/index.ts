/**
 * S4-01 — the «العالم المشترك» / Shared World Product surfaces and the first production Global Switcher.
 */
export type { SharedCopy } from './copy';
export { SHARED_COPY_GATE, fill, sharedCopy, worldLabel } from './copy';
export type { GlobalSwitcherProps, WorldArea } from './GlobalSwitcher';
export { GLOBAL_SWITCHER_HEIGHT, GLOBAL_SWITCHER_TEST_ID, GlobalSwitcher } from './GlobalSwitcher';
export type { SharedWorldAreaProps } from './SharedWorldArea';
export { SHARED_AREA_TEST_ID, SharedWorldArea, isolatedSharedId } from './SharedWorldArea';
export type {
  SharedAreaState, SharedNotice, SharedPlace, SharedWorldController, SharedWorldControllerOptions, SharedWorldTransport,
} from './shared-world-controller';
export { createSharedWorldController, mintSharedCommandId } from './shared-world-controller';
export type { SharedIdController, SharedIdState, SharedIdTransport } from './shared-id-controller';
export { createSharedIdController } from './shared-id-controller';
