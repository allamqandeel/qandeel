/**
 * T-12P §2.1 / §6 — the narrow port the auth authority speaks, and its production Supabase binding.
 *
 * The authority must be provable without a network, without a device and without the SDK, so it
 * never touches `@supabase/supabase-js` directly: it consumes this port. The production binding
 * below is the ONLY place in the repository that constructs a Supabase client.
 *
 * The port carries the two facts the rest of the runtime is allowed to know — who is authenticated
 * and the access token to forward to the QANDEEL API — and nothing else. The refresh token is never
 * surfaced across this boundary; it stays inside the SDK and its storage. No value crossing this
 * port is ever logged.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { MobilePublicConfig } from '../config/mobile-public-config';
import type { AuthSessionStorage } from './auth-session-storage';

/** Exactly what the runtime is allowed to learn about an authenticated session. */
export interface AuthSessionSnapshot {
  readonly userId: string;
  /** The Supabase access token, forwarded to the QANDEEL API as `Authorization: Bearer`. */
  readonly accessToken: string;
}

export type AuthPortFailure = {
  readonly kind: 'INVALID_CREDENTIALS' | 'NETWORK' | 'UNEXPECTED';
  /** A technical description. Never contains a token or a password. */
  readonly detail: string;
};

export type AuthPortResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: AuthPortFailure };

/**
 * R1-01 — the PROVENANCE of a session change, preserved across this boundary.
 *
 * Token equality is not provenance. A token-refresh callback can already be in flight when a
 * sign-out runs and then deliver the same user with a DIFFERENT refreshed token, so suppressing an
 * exact `{userId, accessToken}` pair misses precisely the callback that would resurrect a
 * signed-out identity. What distinguishes "a genuinely new authentication" from "a late callback
 * belonging to the retired auth epoch" is the KIND of event, which the SDK already knows and which
 * this port therefore carries rather than discards.
 */
export type AuthChangeKind =
  /** The subscription's first emission for whatever session was already restored. */
  | 'INITIAL'
  /** An explicit new authentication. The ONLY kind that may start an identity after a sign-out. */
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  /** Anything else the SDK may emit. Treated as non-authenticating, like a refresh. */
  | 'OTHER';

export interface AuthSessionChange {
  readonly kind: AuthChangeKind;
  readonly session: AuthSessionSnapshot | null;
}

export interface SupabaseAuthPort {
  /** The persisted session, if the SDK could restore one. `null` means signed out, not an error. */
  restoreSession(): Promise<AuthPortResult<AuthSessionSnapshot | null>>;
  /**
   * The narrow v1 technical credential-acquisition route (§2.2). This is a runtime capability, not
   * a Product login experience — no screen, no copy and no provider buttons belong to T-12P.
   */
  signInWithPassword(email: string, password: string): Promise<AuthPortResult<AuthSessionSnapshot>>;
  signOut(): Promise<AuthPortResult<null>>;
  /**
   * Every subsequent session change, WITH its provenance: a token refresh, a sign-in, a sign-out,
   * a user replacement. Returns an idempotent unsubscribe.
   */
  onSessionChange(listener: (change: AuthSessionChange) => void): () => void;
  /** Bound to the foreground signal — see `createSupabaseAuthPort`. */
  startAutoRefresh(): void;
  stopAutoRefresh(): void;
}

/**
 * The exact client options the official Supabase React Native / Expo guidance specifies.
 *
 * `detectSessionInUrl` is false because there is no browser URL to read a session out of; leaving
 * it on is the documented cause of spurious work in a native app. `persistSession` and
 * `autoRefreshToken` are on so a returning reader is not asked to sign in again and a long
 * foreground session does not expire mid-use — the refresh is what `startAutoRefresh` drives.
 */
export const SUPABASE_AUTH_OPTIONS = Object.freeze({
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
} as const);

function snapshotOf(session: { user?: { id?: unknown } | null; access_token?: unknown } | null): AuthSessionSnapshot | null {
  if (session === null || session === undefined) return null;
  const userId = session.user?.id;
  const accessToken = session.access_token;
  if (typeof userId !== 'string' || userId === '' || typeof accessToken !== 'string' || accessToken === '') return null;
  return { userId, accessToken };
}

function failureOf(error: { message?: unknown; status?: unknown } | null, fallback: string): AuthPortFailure {
  const detail = typeof error?.message === 'string' && error.message !== '' ? error.message : fallback;
  const status = typeof error?.status === 'number' ? error.status : null;
  if (status === 400 || status === 401 || status === 422) return { kind: 'INVALID_CREDENTIALS', detail };
  // supabase-js surfaces a transport failure as an error with no HTTP status.
  if (status === null && /network|fetch|timeout/iu.test(detail)) return { kind: 'NETWORK', detail };
  return { kind: 'UNEXPECTED', detail };
}

export interface SupabaseAuthPortOptions {
  readonly config: MobilePublicConfig;
  readonly storage: AuthSessionStorage;
}

/**
 * Construct the production port. This is the only `createClient` call in the repository.
 *
 * Auto-refresh is NOT started here. Off-browser, supabase-js cannot tell whether the app is in the
 * foreground, so its refresh loop would run forever in the background; the official guidance is to
 * drive `startAutoRefresh` / `stopAutoRefresh` from app state, which the auth authority does
 * through the one shared foreground signal.
 */
export function createSupabaseAuthPort({ config, storage }: SupabaseAuthPortOptions): SupabaseAuthPort {
  const client: SupabaseClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { storage, ...SUPABASE_AUTH_OPTIONS },
  });

  return {
    async restoreSession() {
      try {
        const { data, error } = await client.auth.getSession();
        if (error) return { ok: false, failure: failureOf(error, 'session restore failed') };
        return { ok: true, value: snapshotOf(data.session) };
      } catch (cause) {
        return { ok: false, failure: { kind: 'NETWORK', detail: describe(cause, 'session restore threw') } };
      }
    },
    async signInWithPassword(email, password) {
      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, failure: failureOf(error, 'sign-in failed') };
        const session = snapshotOf(data.session);
        if (session === null) {
          return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'sign-in returned no usable session' } };
        }
        return { ok: true, value: session };
      } catch (cause) {
        return { ok: false, failure: { kind: 'NETWORK', detail: describe(cause, 'sign-in threw') } };
      }
    },
    async signOut() {
      try {
        const { error } = await client.auth.signOut();
        if (error) return { ok: false, failure: failureOf(error, 'sign-out failed') };
        return { ok: true, value: null };
      } catch (cause) {
        return { ok: false, failure: { kind: 'NETWORK', detail: describe(cause, 'sign-out threw') } };
      }
    },
    onSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        listener({ kind: toChangeKind(event), session: snapshotOf(session) });
      });
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        data.subscription.unsubscribe();
      };
    },
    startAutoRefresh() {
      void client.auth.startAutoRefresh();
    },
    stopAutoRefresh() {
      void client.auth.stopAutoRefresh();
    },
  };
}

/**
 * Map the SDK's event vocabulary onto this layer's. Anything unrecognised becomes `OTHER`, which is
 * treated as non-authenticating — the safe default, since a kind nobody anticipated must not be
 * able to start an identity after a sign-out.
 */
function toChangeKind(event: string): AuthChangeKind {
  switch (event) {
    case 'SIGNED_IN':
      return 'SIGNED_IN';
    case 'SIGNED_OUT':
      return 'SIGNED_OUT';
    case 'TOKEN_REFRESHED':
      return 'TOKEN_REFRESHED';
    case 'INITIAL_SESSION':
      return 'INITIAL';
    case 'USER_UPDATED':
      return 'USER_UPDATED';
    default:
      return 'OTHER';
  }
}

/** Describe a thrown value without ever interpolating a credential-bearing object. */
function describe(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message !== '' ? cause.message : fallback;
}
