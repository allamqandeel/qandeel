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
  SharedAreaState, SharedNotice, SharedPlace, SharedThreadNotice, SharedThreadState, SharedWorldController, SharedWorldControllerOptions,
  SharedWorldTransport,
} from './shared-world-controller';
export { SHARED_MESSAGE_MAX_LENGTH, createSharedWorldController, mintSharedCommandId } from './shared-world-controller';
export type { SharedConversationCopy } from './conversation-copy';
export type { SharedLifecycleCopy } from './lifecycle-copy';
export { SHARED_LIFECYCLE_COPY_GATE, sharedLifecycleCopy } from './lifecycle-copy';
export { labelOfWorld } from './SharedWorldArea';
export type { SharedClosedState, SharedManageNotice, SharedManageState, SharedSettingsInput } from './shared-world-controller';
export { SHARED_CONVERSATION_COPY_GATE, sharedConversationCopy } from './conversation-copy';
export type { SharedIdController, SharedIdState, SharedIdTransport } from './shared-id-controller';
export { createSharedIdController } from './shared-id-controller';
export type { SharedAlertsController, SharedAlertsState, SharedAlertsTransport } from './shared-alerts-controller';
export { createSharedAlertsController } from './shared-alerts-controller';
export type { SharedLinkInbox, SharedLinkSource } from './shared-link';
export { NO_SHARED_LINKS, createSharedLinkInbox, sharedWorldOfLink } from './shared-link';
