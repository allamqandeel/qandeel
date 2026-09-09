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
 * and Product persistence remain T-13's: the only thing this layer persists is authentication
 * material, through the official Supabase mechanism.
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

export type { AuthPortFailure, AuthPortResult, AuthSessionSnapshot, SupabaseAuthPort } from './auth/supabase-auth-port';
export { SUPABASE_AUTH_OPTIONS } from './auth/supabase-auth-port';
export type { AuthSessionStorage } from './auth/auth-session-storage';
export { createEphemeralAuthSessionStorage } from './auth/auth-session-storage';
export type { MobileAuthAuthority, MobileAuthAuthorityOptions, MobileAuthState } from './auth/mobile-auth-authority';
export { createMobileAuthAuthority } from './auth/mobile-auth-authority';

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
  BootstrapFailure,
  BootstrapPhase,
  BootstrapResult,
  CanonicalRuntimeBundle,
  InitialDisclosureDisposition,
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
