/**
 * T-12P §5 / §12 — the one coordinator that assembles the runtime entry, and the only place the
 * private pieces (the Supabase client, the auth session store, the scheduler) are constructed.
 *
 * It exists so that "one QANDEEL conversation Session per authenticated runtime generation" is a
 * property of the code rather than a rule a caller has to remember. A rerender, a remount or a
 * second call cannot produce a second Session: `bootstrap()` memoises its in-flight promise per
 * auth generation, and a token refresh does not change the auth generation, so it does not reach
 * the create call at all.
 *
 * Identity replacement and sign-out retire the runtime generation. Everything bound to it — the
 * store, the projection cache, the live driver — is then stale by construction, and every late
 * async completion is dropped rather than applied.
 *
 * AC-01 — CREDENTIAL FRESHNESS IS A PROPERTY OF THE SEAM, NOT OF EACH CLIENT. A refresh keeps the
 * auth generation, which is precisely why it must not create a second Session — and precisely why
 * it cannot be allowed to leave a captured token behind either. The bootstrap clients used to be
 * built from the access token as it stood at bootstrap and would have gone on presenting it for
 * the life of the attempt. They are now built on `createAuthorizedFetch`, which decides the bearer
 * at the moment of each request. The live driver and T-12's projection coordinator reach the same
 * property the other way, by building a transport immediately before each request; neither is
 * changed here, and `credential-freshness.test.ts` proves all of them together.
 *
 * Nothing here mounts anything. T-12 composes the bundle this produces into the Product shell;
 * T-12P deliberately leaves `FoundationShell` as the route output.
 */
import { HistoricalProjectionApiClient } from '../projection';
import { TemporalApiClient } from '../temporal';
import { createAuthSessionStorage, type AuthSessionStorage } from './auth/auth-session-storage';
import { createMobileAuthAuthority, type MobileAuthAuthority } from './auth/mobile-auth-authority';
import { createAuthorizedFetch, NO_CAPTURED_CREDENTIAL } from './auth/request-credential';
import { createSupabaseAuthPort, type SupabaseAuthPort } from './auth/supabase-auth-port';
import { bootstrapCanonicalRuntime } from './bootstrap/canonical-runtime-bootstrap';
import type { BootstrapResult, CanonicalRuntimeBundle, InitialViewpoint } from './bootstrap/bootstrap-types';
import { ConversationSessionApiClient, type RuntimeHttpFetch } from './conversation/conversation-session-api';
import {
  createAppStateForegroundSignal,
  type ForegroundSignal,
} from './lifecycle/foreground-signal';
import {
  createForegroundLiveDriver,
  type ForegroundLiveDriver,
} from './live/foreground-live-driver';
import { createCatchUpSchedule, type CatchUpScheduleOptions } from './live/live-driver-scheduler';
import {
  describeConfigFailure,
  readMobilePublicConfig,
  type MobilePublicConfig,
  type MobilePublicConfigFailure,
} from './config/mobile-public-config';
import type { StoreDependencies } from '../state';

export interface MobileRuntimeEntryOptions {
  /**
   * Explicit public config. Production omits it and the validated Expo `extra` is read instead;
   * the tests supply one so config rules are provable without a build.
   */
  readonly config?: MobilePublicConfig;
  /** Substituted by the tests. Production builds the real Supabase-backed port. */
  readonly authPort?: SupabaseAuthPort;
  readonly authStorage?: AuthSessionStorage;
  readonly foreground?: ForegroundSignal;
  /** The HTTP implementation for every request this layer makes. Defaults to the platform `fetch`. */
  readonly httpFetch?: RuntimeHttpFetch;
  readonly schedule?: CatchUpScheduleOptions;
}

export interface BootstrapOverrides {
  /** Wired by T-12 when it composes the Product surfaces. T-12P passes none. */
  readonly storeDependencies?: StoreDependencies;
  /**
   * An already-authorized Session id for a test or integration seam. Skips creation entirely.
   * T-13 passes the Session locator of the identity's validated Product recovery record here.
   */
  readonly existingSessionId?: string;
  /** T-13 — the validated durable viewpoint the store is constructed from, judged against the fresh snapshot. */
  readonly initialViewpoint?: InitialViewpoint;
}

export interface MobileRuntimeEntry {
  readonly config: MobilePublicConfig;
  readonly auth: MobileAuthAuthority;
  /** Restore the persisted session and begin observing auth. Idempotent. */
  start(): Promise<void>;
  /**
   * Bootstrap the canonical runtime for the currently authenticated identity.
   *
   * Called twice for the same identity it returns the SAME attempt, so a rerender cannot create a
   * second conversation Session. After a sign-out or a user replacement the generation is retired
   * and the next call is a genuinely new attempt.
   */
  bootstrap(overrides?: BootstrapOverrides): Promise<BootstrapResult>;
  /**
   * The live driver for a bundle this coordinator produced.
   *
   * There is at most ONE driver per runtime generation: asking twice returns the same one. Two
   * drivers on one generation would poll the same streams concurrently, which is precisely the
   * overlap the contract forbids, so it is prevented here rather than left to a caller's discipline.
   */
  liveDriverFor(bundle: CanonicalRuntimeBundle): ForegroundLiveDriver;
  /** The runtime generation currently in force. */
  currentRuntimeGeneration(): number;
  dispose(): void;
}

export type MobileRuntimeEntryResult =
  | { readonly ok: true; readonly runtime: MobileRuntimeEntry }
  | { readonly ok: false; readonly failure: MobilePublicConfigFailure; readonly detail: string };

/**
 * Build the runtime entry, or fail closed.
 *
 * A malformed or absent public config is a hard stop here: it is far better to refuse to build a
 * runtime than to build one pointing at nothing, or at the wrong backend.
 */
export function createMobileRuntimeEntry(options: MobileRuntimeEntryOptions = {}): MobileRuntimeEntryResult {
  let config = options.config;
  if (config === undefined) {
    const read = readMobilePublicConfig();
    if (!read.ok) return { ok: false, failure: read.failure, detail: describeConfigFailure(read.failure) };
    config = read.config;
  }

  const foreground = options.foreground ?? createAppStateForegroundSignal();
  const port =
    options.authPort ??
    createSupabaseAuthPort({ config, storage: options.authStorage ?? createAuthSessionStorage() });
  const auth = createMobileAuthAuthority({ port, foreground });
  const httpFetch: RuntimeHttpFetch =
    options.httpFetch ?? ((input, init) => fetch(input, init as RequestInit) as unknown as ReturnType<RuntimeHttpFetch>);
  const schedule = createCatchUpSchedule(options.schedule ?? {});

  let runtimeGeneration = 0;
  let bootstrappedAuthGeneration: number | null = null;
  let inFlight: Promise<BootstrapResult> | null = null;
  let disposed = false;
  let liveDriver: { generation: number; driver: ForegroundLiveDriver } | null = null;

  /**
   * Retire the current runtime generation. Everything bound to the old one becomes stale.
   *
   * The driver is disposed rather than merely orphaned: it holds a foreground subscription and a
   * scheduled timer, so leaving it alive would keep polling for an identity that no longer exists.
   * Its own generation gate would refuse to APPLY anything, but it would still issue requests.
   */
  function retire(): void {
    runtimeGeneration += 1;
    bootstrappedAuthGeneration = null;
    inFlight = null;
    liveDriver?.driver.dispose();
    liveDriver = null;
  }

  const unsubscribeAuth = auth.subscribe((state) => {
    if (disposed) return;
    if (state.kind === 'AUTHENTICATED') {
      // A token refresh keeps the generation, so it must NOT retire the runtime. Only a different
      // identity does — which is exactly what a changed auth generation means.
      if (bootstrappedAuthGeneration !== null && bootstrappedAuthGeneration !== state.authGeneration) retire();
      return;
    }
    if (bootstrappedAuthGeneration !== null) retire();
  });

  const credential = () => {
    const state = auth.getState();
    return state.kind === 'AUTHENTICATED'
      ? { accessToken: state.accessToken, authGeneration: state.authGeneration }
      : null;
  };

  /**
   * AC-01 — the HTTP implementation every request issued on behalf of ONE identity goes through.
   *
   * Bound to an auth generation rather than to a token, because that is what identifies the reader:
   * a refresh keeps the generation and the seam simply carries the new token, while a replacement
   * changes it and the seam refuses instead of authorizing a request for the wrong person.
   */
  const authorizedFetchFor = (authGeneration: number): RuntimeHttpFetch =>
    createAuthorizedFetch({ credential, authGeneration, fetch: httpFetch });

  const runtime: MobileRuntimeEntry = {
    config,
    auth,
    async start() {
      await auth.start();
    },
    bootstrap(overrides = {}) {
      if (disposed) return Promise.resolve({ kind: 'FAILED', failure: { kind: 'RETIRED' } } as BootstrapResult);
      const state = auth.getState();
      if (state.kind !== 'AUTHENTICATED') {
        return Promise.resolve({ kind: 'FAILED', failure: { kind: 'NOT_AUTHENTICATED' } } as BootstrapResult);
      }
      if (inFlight !== null && bootstrappedAuthGeneration === state.authGeneration) return inFlight;

      const generation = runtimeGeneration;
      bootstrappedAuthGeneration = state.authGeneration;
      // AC-01. Every client this attempt uses is built on the seam, so the bearer on each request
      // is the credential as it stands AT THAT REQUEST. The two frozen T-03 transports capture
      // `NO_CAPTURED_CREDENTIAL` rather than the live token: the seam overwrites the header before
      // every request, so a real token here would be dead weight that a later change could
      // resurrect as a stale bearer without any test noticing.
      //
      // `identity.accessToken` below is NOT what authorizes the Session create — the seam is. It
      // stays because it is a true statement about the identity this attempt is bound to, and
      // because `bootstrapCanonicalRuntime` is exported and must remain usable by a caller that
      // supplies its own plain transport.
      const authorized = authorizedFetchFor(state.authGeneration);
      const attempt = bootstrapCanonicalRuntime({
        identity: { userId: state.userId, accessToken: state.accessToken, authGeneration: state.authGeneration },
        clients: {
          conversation: new ConversationSessionApiClient({ baseUrl: config.apiBaseUrl, fetch: authorized }),
          temporal: new TemporalApiClient({ baseUrl: config.apiBaseUrl, accessToken: NO_CAPTURED_CREDENTIAL, fetch: authorized }),
          projection: new HistoricalProjectionApiClient({
            baseUrl: config.apiBaseUrl,
            accessToken: NO_CAPTURED_CREDENTIAL,
            fetch: authorized,
          }),
        },
        runtimeGeneration: generation,
        isCurrent: () => !disposed && runtimeGeneration === generation,
        storeDependencies: overrides.storeDependencies,
        existingSessionId: overrides.existingSessionId,
        initialViewpoint: overrides.initialViewpoint,
      });
      inFlight = attempt;
      return attempt;
    },
    liveDriverFor(bundle) {
      if (liveDriver !== null && liveDriver.generation === bundle.runtimeGeneration) return liveDriver.driver;
      // A bundle from a different generation gets its own driver, and the previous one is retired
      // rather than left running.
      liveDriver?.driver.dispose();
      const driver = createForegroundLiveDriver({
        bundle,
        credential,
        createTemporalClient: (accessToken) =>
          new TemporalApiClient({ baseUrl: config.apiBaseUrl, accessToken, fetch: httpFetch }),
        foreground,
        isCurrent: () => !disposed && runtimeGeneration === bundle.runtimeGeneration,
        schedule,
      });
      liveDriver = { generation: bundle.runtimeGeneration, driver };
      return driver;
    },
    currentRuntimeGeneration: () => runtimeGeneration,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribeAuth();
      liveDriver?.driver.dispose();
      liveDriver = null;
      auth.dispose();
      inFlight = null;
    },
  };

  return { ok: true, runtime };
}
