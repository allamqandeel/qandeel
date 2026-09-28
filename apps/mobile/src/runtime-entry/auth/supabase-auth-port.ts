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
  /**
   * W1B-01 adds `EMAIL_NOT_CONFIRMED`: the identity provider validated the password FIRST and only
   * then reported that the Email is not yet verified, so it reveals nothing to someone who does not
   * already hold the credential. The Product entry takes the reader to Email verification.
   */
  readonly kind: 'INVALID_CREDENTIALS' | 'EMAIL_NOT_CONFIRMED' | 'NETWORK' | 'UNEXPECTED';
  /** A technical description. Never contains a token or a password. */
  readonly detail: string;
};

export type AuthPortResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: AuthPortFailure };

/**
 * W1B-01 — the two account-identity values sign-up carries (P1 §4). They travel as bounded, namespaced
 * sign-up metadata and become canonical only in the database, which validates them (migration 0123).
 */
export interface SignUpIdentity {
  readonly name: string;
  readonly loginId: string;
}

/** Why an account could not be created. The provider's own words are only ever a `detail`. */
export type SignUpFailure = {
  readonly kind: 'INVALID_EMAIL' | 'WEAK_PASSWORD' | 'REFUSED' | 'NETWORK';
  readonly detail: string;
};

/**
 * Why a 6-digit Email code did not verify. `CODE_REJECTED` is the provider's single answer for BOTH a
 * wrong and an expired code (Supabase Auth returns `otp_expired` for either); telling them apart is the
 * Product entry's job, from when the code was sent.
 */
export type EmailCodeFailure = {
  readonly kind: 'CODE_REJECTED' | 'NETWORK' | 'UNEXPECTED';
  readonly detail: string;
};

export type ResendFailure = {
  readonly kind: 'NETWORK' | 'REFUSED';
  readonly detail: string;
};

export type SignUpResult = { readonly ok: true } | { readonly ok: false; readonly failure: SignUpFailure };
export type EmailCodeResult = { readonly ok: true; readonly value: AuthSessionSnapshot } | { readonly ok: false; readonly failure: EmailCodeFailure };
export type ResendResult = { readonly ok: true } | { readonly ok: false; readonly failure: ResendFailure };

/**
 * R1-01, corrected by R2-01 — the KIND of a session change, preserved across this boundary.
 *
 * Token equality is not provenance. A token-refresh callback can already be in flight when a
 * sign-out runs and then deliver the same user with a DIFFERENT refreshed token, so suppressing an
 * exact `{userId, accessToken}` pair misses precisely the callback that would resurrect a
 * signed-out identity. The kind is therefore carried across this port rather than discarded.
 *
 * But EVENT KIND IS NOT OPERATION PROVENANCE, and this port must not be read as claiming it is.
 * `GoTrueClient.signInWithPassword` notifies its subscribers of `SIGNED_IN` and awaits them BEFORE
 * its own promise resolves, so a sign-in that raced a sign-out delivers a perfectly genuine
 * `SIGNED_IN` to a reader that is already signed out. The kind is kept for reconciliation and
 * diagnosis; it is not an authorization. An observed `SIGNED_IN` alone can never cross a retired
 * auth barrier — only the completion of a CURRENT explicit sign-in operation may establish or
 * re-establish authentication there. See `mobile-auth-authority.ts` for where that split is made.
 */
export type AuthChangeKind =
  /** The subscription's first emission for whatever session was already restored. */
  | 'INITIAL'
  /** An explicit new authentication as the SDK saw it — not, by itself, authority to cross a retirement. */
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
  /**
   * W1B-01 — create an account whose Email must be verified before it can be used. It NEVER yields an
   * authenticated session: a project that would hand one back (Email confirmation switched off) is
   * refused and the session is discarded locally, because verification is mandatory before QANDEEL.
   */
  signUp(email: string, password: string, identity: SignUpIdentity): Promise<SignUpResult>;
  /** W1B-01 — verify the account's Email with the 6-digit code sent to it. The session it yields is the first. */
  verifyEmailCode(email: string, code: string): Promise<EmailCodeResult>;
  /** W1B-01 — send a new sign-up verification code, replacing the previous one. */
  resendEmailCode(email: string): Promise<ResendResult>;
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

type ProviderError = { message?: unknown; status?: unknown; code?: unknown } | null;

const detailOf = (error: ProviderError, fallback: string): string =>
  typeof error?.message === 'string' && error.message !== '' ? error.message : fallback;
const codeOf = (error: ProviderError): string | null => (typeof error?.code === 'string' ? error.code : null);

/**
 * A genuine transport failure: the request never produced an HTTP answer. The installed auth client
 * reports that as status 0 (`AuthRetryableFetchError`); an older shape carried no status at all. A 5xx
 * is NOT a transport failure — it is the server answering, and it is never described as "connection".
 */
function isTransportFailure(error: ProviderError): boolean {
  const status = typeof error?.status === 'number' ? error.status : null;
  if (status === 0) return true;
  return status === null && /network|fetch|timeout/iu.test(detailOf(error, ''));
}

function failureOf(error: ProviderError, fallback: string): AuthPortFailure {
  const detail = detailOf(error, fallback);
  const status = typeof error?.status === 'number' ? error.status : null;
  // Supabase Auth checks the password BEFORE it reports an unconfirmed Email, so this code can only
  // reach a reader who already holds the credential.
  if (codeOf(error) === 'email_not_confirmed') return { kind: 'EMAIL_NOT_CONFIRMED', detail };
  if (status === 400 || status === 401 || status === 422) return { kind: 'INVALID_CREDENTIALS', detail };
  if (isTransportFailure(error)) return { kind: 'NETWORK', detail };
  return { kind: 'UNEXPECTED', detail };
}

/** The metadata keys migration 0123's provisioning trigger reads — and the only ones sign-up sends. */
export const SIGN_UP_METADATA_KEYS = Object.freeze({ name: 'qandeel_name', loginId: 'qandeel_login_id' } as const);

function signUpFailureOf(error: ProviderError): SignUpFailure {
  const detail = detailOf(error, 'sign-up failed');
  if (isTransportFailure(error)) return { kind: 'NETWORK', detail };
  const code = codeOf(error);
  if (code === 'weak_password') return { kind: 'WEAK_PASSWORD', detail };
  if (code === 'email_address_invalid' || (code === 'validation_failed' && /email/iu.test(detail))) return { kind: 'INVALID_EMAIL', detail };
  // Everything else — an existing account where the provider says so, a Login ID the database refused,
  // a rate limit, a disabled sign-up — is ONE refusal, so nothing here can answer "does this Email exist".
  return { kind: 'REFUSED', detail };
}

function emailCodeFailureOf(error: ProviderError): EmailCodeFailure {
  const detail = detailOf(error, 'verification failed');
  if (isTransportFailure(error)) return { kind: 'NETWORK', detail };
  const code = codeOf(error);
  if (code === 'otp_expired' || code === 'validation_failed') return { kind: 'CODE_REJECTED', detail };
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
    async signUp(email, password, identity) {
      try {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { [SIGN_UP_METADATA_KEYS.name]: identity.name, [SIGN_UP_METADATA_KEYS.loginId]: identity.loginId } },
        });
        if (error) return { ok: false, failure: signUpFailureOf(error) };
        if (data.session !== null && data.session !== undefined) {
          // The project handed back a session, so Email confirmation is not being enforced. QANDEEL
          // requires verification before entry: the session is discarded locally and never reaches the
          // authority as an explicit completion (its SIGNED_IN event already met the retired barrier).
          await client.auth.signOut({ scope: 'local' });
          return { ok: false, failure: { kind: 'REFUSED', detail: 'sign-up returned a session: Email confirmation is not enforced' } };
        }
        return { ok: true };
      } catch (cause) {
        return { ok: false, failure: { kind: 'NETWORK', detail: describe(cause, 'sign-up threw') } };
      }
    },
    async verifyEmailCode(email, code) {
      try {
        const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
        if (error) return { ok: false, failure: emailCodeFailureOf(error) };
        const session = snapshotOf(data.session);
        if (session === null) return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'verification returned no usable session' } };
        return { ok: true, value: session };
      } catch (cause) {
        return { ok: false, failure: { kind: 'NETWORK', detail: describe(cause, 'verification threw') } };
      }
    },
    async resendEmailCode(email) {
      try {
        const { error } = await client.auth.resend({ type: 'signup', email });
        if (error) return { ok: false, failure: { kind: isTransportFailure(error) ? 'NETWORK' : 'REFUSED', detail: detailOf(error, 'resend failed') } };
        return { ok: true };
      } catch (cause) {
        return { ok: false, failure: { kind: 'NETWORK', detail: describe(cause, 'resend threw') } };
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
