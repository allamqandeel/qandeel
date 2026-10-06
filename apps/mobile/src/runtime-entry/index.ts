/**
 * T-12P — Mobile Runtime Entry Preconditions v1: the ONE public surface of this layer.
 *
 * T-12 consumes exactly what is exported here and nothing deeper. Three implementations stay
 * deliberately private and are reachable only through `createMobileRuntimeEntry`:
 *
 *   - the auth session storage (`auth/auth-session-storage.ts`), so the storage mechanism can be
 *     changed in one file without any consumer noticing;
 *   - the Supabase client (`auth/supabase-auth-port.ts` -> `createSupabaseAuthPort`), so there is
 *     exactly one `createClient` call in the repository and no second client can appear;
 *   - the scheduler internals (`live/live-driver-scheduler.ts` -> `createCatchUpSchedule`), so the
 *     cadence has one owner rather than a timer per component.
 *
 * What this layer closes, and what it explicitly does not:
 *
 *   Gate 1  an authorized mobile session/credential source     — direct Supabase Auth, typed config
 *   Gate 2  an owned initial canonical entry state             — the bootstrap authority
 *   Gate 3  a frozen live delivery driver                      — foreground HTTP catch-up
 *
 * NOT here, by design: any Product surface. No Map, no Timeline, no chrome, no login screen, no
 * Product copy, no motion, no locale provider, no responsive composition. `FoundationShell` is
 * still the route output, and T-12 is the first task authorized to replace it. Restart, recovery
 * and Product persistence are T-13's, in its own `recovery/` layer: the only thing THIS layer
 * persists is authentication material, through the official Supabase mechanism. The bootstrap
 * accepts a validated durable viewpoint (`InitialViewpoint`) and an already-authorized Session id
 * from T-13's consumer, and still fetches the authoritative snapshot before any store exists.
 */

export type {
  MobilePublicConfig,
  MobilePublicConfigFailure,
  MobilePublicConfigKey,
  MobilePublicConfigResult,
} from './config/mobile-public-config';
export {
  MOBILE_PUBLIC_CONFIG_KEYS,
  describeConfigFailure,
  readMobilePublicConfig,
} from './config/mobile-public-config';

export type {
  AuthPortFailure,
  AuthPortResult,
  AuthSessionSnapshot,
  EmailCodeFailure,
  EmailCodeResult,
  PasswordUpdateFailure,
  PasswordUpdateResult,
  RecoveryCodeFailure,
  RecoveryCodeResult,
  RecoveryRequestResult,
  ResendFailure,
  ResendResult,
  SignUpFailure,
  SignUpIdentity,
  SignUpResult,
  SupabaseAuthPort,
} from './auth/supabase-auth-port';
export { SIGN_UP_METADATA_KEYS, SUPABASE_AUTH_OPTIONS } from './auth/supabase-auth-port';
export type { AuthSessionStorage } from './auth/auth-session-storage';
export { createEphemeralAuthSessionStorage } from './auth/auth-session-storage';
export type { EmailVerificationTarget, MobileAuthAuthority, MobileAuthAuthorityOptions, MobileAuthState } from './auth/mobile-auth-authority';
export { createMobileAuthAuthority, isEmailIdentifier } from './auth/mobile-auth-authority';

export type { ForegroundSignal, ForegroundState, ManualForegroundSignal } from './lifecycle/foreground-signal';
export { createAppStateForegroundSignal, createManualForegroundSignal } from './lifecycle/foreground-signal';

export type {
  ConversationSessionApiConfig,
  ConversationSessionHandle,
  ConversationSessionOutcome,
  RuntimeHttpFetch,
} from './conversation/conversation-session-api';
export { ConversationSessionApiClient } from './conversation/conversation-session-api';
export type {
  ConversationExchangeView,
  ConversationHistoryOutcome,
  ConversationHistoryPageView,
  ConversationReplyState,
  ConversationReplyView,
  ConversationSubmitOutcome,
  ConversationTurnApiConfig,
  ConversationTurnSubmission,
  ConversationUnknownReason,
  ConversationUserTurnView,
} from './conversation/conversation-turn-api';
export { CONVERSATION_HISTORY_PAGE_LIMIT, ConversationTurnApiClient } from './conversation/conversation-turn-api';
export type {
  AccountApiConfig,
  AccountFirstUseOutcome,
  AccountFirstUseView,
  AccountIdentityOutcome,
  AccountIdentityView,
  AccountPublicIdOutcome,
  AccountPublicIdView,
  EmailChangeConfirmOutcome,
  EmailChangeRequestOutcome,
  LoginIdAvailabilityOutcome,
  LoginIdChangeOutcome,
  NameChangeOutcome,
  PasswordChangeOutcome,
  PublicIdChangeAnswer,
  PublicIdChangeOutcome,
  SignOutOthersOutcome,
  DeletionCancelOutcome,
  ExportDownloadOutcome,
  PrivacyDeletionStatus,
  PrivacyExportStatus,
  PrivacyRequestOutcome,
  PrivacyStateOutcome,
  PrivacyStateView,
} from './account/account-api';
export { AccountApiClient, LoginIdAvailabilityClient } from './account/account-api';
export type {
  UnderstandingApiConfig,
  UnderstandingConfidence,
  UnderstandingDetailOutcome,
  UnderstandingDetailView,
  UnderstandingDisagreementOutcome,
  UnderstandingDiscussionOutcome,
  UnderstandingEvolutionKind,
  UnderstandingEvolutionView,
  UnderstandingItemView,
  UnderstandingListOutcome,
  UnderstandingResolutionOutcome,
  UnderstandingTheme,
} from './understanding-api';
export { UnderstandingApiClient } from './understanding-api';
export type {
  ActivityAttention,
  ActivityAttentionOutcome,
  ActivityAttentionSnapshot,
  ActivityCategory,
  ActivityContextKind,
  ActivityIndicators,
  ActivityItem,
  ActivityOpenOutcome,
  ActivityPage,
  ActivityPreferences,
  ActivityPreferencesInput,
  ActivityPreferencesOutcome,
  BilingualText,
  DirectEntryDestination,
  DisclosureLevel,
  InterruptionCandidate,
  LockSubject,
  ProactiveChoice,
  SettingsSection,
} from './activity-api';
export { ActivityApiClient } from './activity-api';
export type {
  SharedAcceptResult, SharedDeclineResult, SharedDeleteResult, SharedEntryResult, SharedIdentityResult, SharedInvitation, SharedInviteResult,
  SharedMaterial, SharedMaterialCursor, SharedMaterialsResult, SharedMember, SharedRoot, SharedRootResult, SharedSendResult, SharedWorldShell, SharedWorldSummary,
  SharedApproveResult, SharedClosedWorld, SharedClosedWorldResult, SharedHistoryApproveResult, SharedHistoryCandidate, SharedHistoryCandidatesResult,
  SharedHistoryRequest, SharedLeaveResult, SharedLifecycleMember, SharedManage, SharedManageResult, SharedOwnMaterial, SharedOwnMaterialResult,
  SharedProposal, SharedProposeResult, SharedSettingsValues, SharedMemberRequest, SharedProposeMemberResult, SharedJoinResult,
  SharedFormerHistoryRequest, SharedFormerHistoryResult, SharedWorldAlert, SharedAlertsResult, SharedSetAlertsResult,
} from './shared-world-api';
export { SharedWorldApiClient } from './shared-world-api';
export type { OsPermission, PushDeviceSync, PushPlatform } from './push-api';
export { PushApiClient } from './push-api';

export type {
  BootstrapFailure,
  BootstrapPhase,
  BootstrapResult,
  CanonicalRuntimeBundle,
  InitialDisclosureDisposition,
  InitialViewpoint,
  LiveDeliveryCursors,
} from './bootstrap/bootstrap-types';
export type { BootstrapClients, BootstrapIdentity, BootstrapRequest } from './bootstrap/canonical-runtime-bootstrap';
export { bootstrapCanonicalRuntime } from './bootstrap/canonical-runtime-bootstrap';

export type {
  ForegroundLiveDriver,
  ForegroundLiveDriverOptions,
  LiveDriverCredential,
  LiveDriverStatus,
  TimerHandle,
} from './live/foreground-live-driver';
export { createForegroundLiveDriver } from './live/foreground-live-driver';
export type { CatchUpSchedule, CatchUpScheduleOptions } from './live/live-driver-scheduler';
export { FOREGROUND_CATCH_UP_INTERVAL_MS, MAX_CATCH_UP_BACKOFF_MS } from './live/live-driver-scheduler';

export type { BootstrapOverrides, MobileRuntimeEntry, MobileRuntimeEntryOptions, MobileRuntimeEntryResult } from './mobile-runtime-entry';
export { createMobileRuntimeEntry } from './mobile-runtime-entry';
