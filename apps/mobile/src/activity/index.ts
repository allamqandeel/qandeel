/**
 * A3-01 — «النشاط» / Activity & in-app attention (I-08N-01 + P3): the production Activity module.
 *
 * Controllers (one per runtime generation, built and retired by the integration owner): the feed, the attention mark +
 * Attention Strip, and the Notifications & Activity preferences. Surfaces: the global entry handed to the non-Analysis
 * upper chrome, the Activity page, the ordinary strip, and the call-safe strip (built, NOT mounted: no call authority).
 */
export type { ActivityAttentionController, AttentionState, AttentionTransport, ShownStrip } from './attention-controller';
export { ATTENTION_POLL_MS, createActivityAttentionController } from './attention-controller';
export type { ActivityFeedController, FeedState, FeedTransport } from './feed-controller';
export { ACTIVITY_PAGE_LIMIT, createActivityFeedController } from './feed-controller';
export type { ActivityPreferencesController, PreferencesState, PreferencesTransport } from './preferences-controller';
export { createActivityPreferencesController } from './preferences-controller';
export { ACTIVITY_CATEGORIES, DISCLOSURE_LEVELS, LOCK_SUBJECTS } from './vocabulary';
export type { CallTruth } from './call-truth';
export { PRODUCTION_CALL_TRUTH } from './call-truth';
export type { PresentationContext, PresentationDecision, ProductSurface } from './presentation';
export { decidePresentation, isInPlace } from './presentation';
export type { ActivityCopy, NotificationsCopy } from './copy';
export { ACTIVITY_COPY_GATE, activityCopy, notificationsCopy } from './copy';
export type { ActivityEntryProps } from './ActivityEntry';
export { ACTIVITY_ENTRY_TEST_ID, ActivityEntry, AttentionMark } from './ActivityEntry';
export type { ActivitySurfaceProps } from './ActivitySurface';
export { ACTIVITY_SURFACE_TEST_ID, ActivitySurface } from './ActivitySurface';
export type { AttentionStripProps } from './AttentionStrip';
export { ATTENTION_STRIP_TEST_ID, AttentionStrip, STRIP_TIMING } from './AttentionStrip';
export type { CallSafeStripProps } from './CallSafeStrip';
export { CALL_SAFE_STRIP_TEST_ID, CallSafeStrip } from './CallSafeStrip';
