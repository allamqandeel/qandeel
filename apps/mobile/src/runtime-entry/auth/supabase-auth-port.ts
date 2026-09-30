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
 *
 * W2-01 — two narrow additions, still behind this one boundary and still with one client:
 *   - a Login ID sign-in, which the QANDEEL API resolves on the server and answers with the provider's
 *     verdict; the tokens of a proved password are adopted into THIS client with `setSession`;
 *   - password recovery. Its temporary authority (`RecoveryGrant`) is the one exception to "the refresh
 *     token never crosses": it crosses to the auth authority's memory, and nowhere else — never the
 *     SDK's session, its storage or its subscribers — and is retired as soon as the password is set.
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
   *
   * W2-01 adds `SESSION_ENDED`, produced only by a restore: the provider PROVED the persisted session
   * is over (it refused the refresh token, and the SDK removed the session). It is distinct from
   * `NETWORK` / `UNEXPECTED`, where nothing was proved and the session is still held — Unknown is not
   * Signed Out.
   */
  readonly kind: 'INVALID_CREDENTIALS' | 'EMAIL_NOT_CONFIRMED' | 'NETWORK' | 'UNEXPECTED' | 'SESSION_ENDED';
  /**
   * A technical description. Never contains a token or a password — and never an Email: W2-01 R1, a
   * Login ID's Email never reaches the device, not even after the password was proved (P1 §3).
   */
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
 * wrong and an expired code (Supabase Auth returns `otp_expired` for either), so nothing downstream may
 * claim which of the two it was.
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
 * W2-01 — the TEMPORARY authority a verified recovery code yields: enough to set one new password and
 * then be retired, and nothing else. It is held in memory by the auth authority alone. It is never
 * handed to the SDK, never written to auth storage, never announced to a session subscriber and never
 * becomes `AUTHENTICATED` — so no bootstrap, no Conversation Session and no Personal state can start
 * from it. It is a pair of values rather than a session snapshot on purpose: nothing that consumes a
 * snapshot can accept it.
 */
export interface RecoveryGrant {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/**
 * Asking for a recovery code is deliberately non-enumerating: every answer the provider gives — sent,
 * no such account, rate-limited, a server error — is the SAME result, because any of them could differ
 * between an Email that has an account and one that does not. Only a request that never produced an
 * HTTP answer is reported, and it says nothing about any account.
 */
export type RecoveryRequestResult = { readonly ok: true } | { readonly ok: false; readonly failure: { readonly kind: 'NETWORK'; readonly detail: string } };

/** As with the Email code: the provider answers a wrong and an expired recovery code alike. */
export type RecoveryCodeFailure = {
  readonly kind: 'CODE_REJECTED' | 'NETWORK' | 'UNEXPECTED';
  readonly detail: string;
};
export type RecoveryCodePortResult = { readonly ok: true; readonly value: RecoveryGrant } | { readonly ok: false; readonly failure: RecoveryCodeFailure };
/** What the authority tells the entry: whether the code verified. The grant itself never leaves the authority. */
export type RecoveryCodeResult = { readonly ok: true } | { readonly ok: false; readonly failure: RecoveryCodeFailure };

export type PasswordUpdateFailure = {
  /** The provider's own password rules refused it (its weak- or same-password answer). */
  readonly kind: 'WEAK_PASSWORD' | 'NETWORK' | 'UNEXPECTED';
  readonly detail: string;
};
export type PasswordUpdateResult = { readonly ok: true } | { readonly ok: false; readonly failure: PasswordUpdateFailure };

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
  /**
   * W2-01 R1 — verify the Email of the account a Login ID names, WITHOUT the device learning that Email:
   * the QANDEEL API resolves the Login ID and asks the provider to verify the code. The session it yields
   * is adopted into the ONE client (`setSession`), exactly as a Login ID sign-in's is.
   */
  verifyLoginIdEmailCode(loginId: string, code: string): Promise<EmailCodeResult>;
  /** W2-01 R1 — ask, through the QANDEEL API, for a new code for that Email. One result for every Login ID. */
  resendLoginIdEmailCode(loginId: string): Promise<ResendResult>;
  /**
   * W2-01 — sign in with a Login ID. The QANDEEL API resolves it on the server and spends the
   * provider's own password grant; the device never learns which Email it belongs to. The session it
   * yields is adopted into the ONE client (`setSession`), exactly as any other sign-in's is.
   */
  signInWithLoginId(loginId: string, password: string): Promise<AuthPortResult<AuthSessionSnapshot>>;
  /** W2-01 — ask for a password recovery code for an Email. Non-enumerating by construction. */
  requestPasswordRecovery(email: string): Promise<RecoveryRequestResult>;
  /**
   * W2-01 — verify a recovery code, with recovery semantics. Its temporary authority comes back as a
   * `RecoveryGrant` and goes NOWHERE else: not to the SDK's session, its storage or its subscribers.
   */
  verifyRecoveryCode(email: string, code: string): Promise<RecoveryCodePortResult>;
  /** W2-01 — set the new password with that grant, then retire the grant. It establishes nothing. */
  updateRecoveredPassword(grant: RecoveryGrant, password: string): Promise<PasswordUpdateResult>;
  /** W2-01 — end a recovery grant that will not be used (superseded, abandoned). Best effort; never throws. */
  retireRecoveryGrant(grant: RecoveryGrant): Promise<void>;
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

/**
 * W3-01 — the key the SDK persists the session under: exactly its own default for this project URL
 * (`sb-<first host label>-auth-token`, supabase-js `SupabaseClient`), passed explicitly so it is known here.
 */
export function supabaseSessionStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

/** The session entry and the two companion entries the SDK's own session removal clears beside it. */
export function supabaseSessionStorageKeys(sessionKey: string): readonly string[] {
  return [sessionKey, `${sessionKey}-user`, `${sessionKey}-code-verifier`];
}

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

function recoveryCodeFailureOf(status: number, code: string | null): RecoveryCodeFailure {
  if (status === 0) return { kind: 'NETWORK', detail: 'recovery verification transport failed' };
  if (code === 'otp_expired' || code === 'validation_failed') return { kind: 'CODE_REJECTED', detail: code };
  return { kind: 'UNEXPECTED', detail: `recovery verification answered ${status}` };
}

/**
 * W2-01 — a restore failure the provider PROVED final: the server answered, with a 4xx, that the
 * persisted refresh token is no longer valid (the SDK removes the session on that answer). A transport
 * failure, a 5xx, a timeout or an unrecognised shape proves nothing, and stays unknown.
 */
function restoreProvedEnded(error: ProviderError & { name?: unknown }): boolean {
  if (error?.name === 'AuthRetryableFetchError') return false;
  const status = typeof error?.status === 'number' ? error.status : null;
  return status !== null && status >= 400 && status < 500;
}

/** The HTTP answer the port needs from a REST call: a status (0 when none came back) and a JSON body. */
interface RestAnswer {
  readonly status: number;
  readonly body: Record<string, unknown> | null;
}

/** The minimum `fetch` shape the port uses outside the SDK. Production passes the platform `fetch`. */
export type AuthRestFetch = (
  input: string,
  init: { readonly method: string; readonly headers: Record<string, string>; readonly body?: string },
) => Promise<{ readonly status: number; json(): Promise<unknown> }>;

/** The API version whose Auth errors carry a typed `error_code`, exactly as the installed auth client pins it. */
export const SUPABASE_AUTH_API_VERSION = '2024-01-01';

export interface SupabaseAuthPortOptions {
  readonly config: MobilePublicConfig;
  readonly storage: AuthSessionStorage;
  /** W2-01 — for the Login ID exchange and the in-memory recovery calls. Defaults to the platform `fetch`. */
  readonly fetch?: AuthRestFetch;
}

/**
 * Construct the production port. This is the only `createClient` call in the repository.
 *
 * Auto-refresh is NOT started here. Off-browser, supabase-js cannot tell whether the app is in the
 * foreground, so its refresh loop would run forever in the background; the official guidance is to
 * drive `startAutoRefresh` / `stopAutoRefresh` from app state, which the auth authority does
 * through the one shared foreground signal.
 */
export function createSupabaseAuthPort({ config, storage, fetch: restFetch }: SupabaseAuthPortOptions): SupabaseAuthPort {
  // W3-01: the session's storage key, named rather than left implicit, so this port can retire its own
  // session material (see `signOut`). It is exactly the SDK's own default, so every session already
  // persisted under it is read as before.
  const sessionKey = supabaseSessionStorageKey(config.supabaseUrl);
  const client: SupabaseClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { storage, storageKey: sessionKey, ...SUPABASE_AUTH_OPTIONS },
  });

  /**
   * W2-01 — evidence that the PROVIDER ended a persisted session. The SDK recovers the stored session
   * while the client initialises, and when the provider refuses its refresh token it removes the
   * session and emits `SIGNED_OUT` — possibly before anything else has subscribed. This subscription is
   * registered synchronously at construction, before the SDK's first await, so it cannot miss that.
   * A sign-out the port itself performs is not evidence of anything and is excluded.
   */
  let providerEndedSession = false;
  let ownSignOuts = 0;
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && ownSignOuts === 0) providerEndedSession = true;
  });
  const signOutOwn = async (scope?: 'local') => {
    ownSignOuts += 1;
    try {
      return scope === undefined ? await client.auth.signOut() : await client.auth.signOut({ scope });
    } finally {
      ownSignOuts -= 1;
    }
  };

  const httpFetch: AuthRestFetch = restFetch ?? ((input, init) => fetch(input, init as RequestInit) as unknown as ReturnType<AuthRestFetch>);
  const authUrl = config.supabaseUrl.replace(/\/$/u, '');

  /** One REST call outside the SDK. It never throws: no HTTP answer is status 0. Nothing is logged. */
  async function rest(url: string, method: string, headers: Record<string, string>, body?: unknown): Promise<RestAnswer> {
    let response: Awaited<ReturnType<AuthRestFetch>>;
    try {
      response = await httpFetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      return { status: 0, body: null };
    }
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    return { status: response.status, body: parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null };
  }

  /**
   * The Auth REST endpoints, called exactly as the installed SDK calls them (`POST /verify`,
   * `PUT /user`, `POST /logout?scope=`), with the publishable key and — for a grant — its bearer. Used
   * ONLY for password recovery, so its temporary authority never touches the SDK's session.
   */
  const authRest = (path: string, method: string, bearer: string | null, body?: unknown) =>
    rest(`${authUrl}/auth/v1${path}`, method, {
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${bearer ?? config.supabasePublishableKey}`,
      'X-Supabase-Api-Version': SUPABASE_AUTH_API_VERSION,
    }, body);
  const errorCodeOf = (body: Record<string, unknown> | null): string | null =>
    typeof body?.error_code === 'string' ? body.error_code : typeof body?.code === 'string' ? body.code : null;
  const retireGrant = async (grant: RecoveryGrant): Promise<void> => {
    await authRest('/logout?scope=local', 'POST', grant.accessToken);
  };

  /**
   * W3-01 — remove THIS device's persisted session material from the auth store: the session itself and
   * the two companion entries the SDK keeps beside it. A storage that refuses one removal still has the
   * others attempted; nothing is logged.
   */
  async function retireLocalSession(): Promise<void> {
    for (const key of supabaseSessionStorageKeys(sessionKey)) {
      try {
        await storage.removeItem(key);
      } catch {
        // Nothing further can be done from here; the runtime is retired regardless.
      }
    }
  }

  /**
   * The provider's session, relayed by the QANDEEL API for a Login ID (a sign-in, or W2-01 R1's
   * verification), adopted into the ONE client — which persists it and notifies its subscribers of
   * SIGNED_IN before resolving, exactly as a password sign-in does, so the authority's barrier treats it
   * the same. A 200 without both tokens is not a session.
   */
  async function adoptApiSession(answer: RestAnswer, what: string): Promise<AuthPortResult<AuthSessionSnapshot>> {
    const accessToken = answer.body?.accessToken;
    const refreshToken = answer.body?.refreshToken;
    if (typeof accessToken !== 'string' || accessToken === '' || typeof refreshToken !== 'string' || refreshToken === '') {
      return { ok: false, failure: { kind: 'UNEXPECTED', detail: `${what} answered no usable tokens` } };
    }
    try {
      const { data, error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) return { ok: false, failure: { kind: isTransportFailure(error) ? 'NETWORK' : 'UNEXPECTED', detail: detailOf(error, 'session adoption failed') } };
      const session = snapshotOf(data.session);
      if (session === null) return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'session adoption returned no usable session' } };
      return { ok: true, value: session };
    } catch (cause) {
      return { ok: false, failure: { kind: 'NETWORK', detail: describe(cause, 'session adoption threw') } };
    }
  }

  return {
    async restoreSession() {
      try {
        const { data, error } = await client.auth.getSession();
        const ended = providerEndedSession;
        providerEndedSession = false;
        if (error) {
          // W2-01: only a refusal the provider PROVED is an ended session; anything else stays unknown.
          if (restoreProvedEnded(error)) return { ok: false, failure: { kind: 'SESSION_ENDED', detail: detailOf(error, 'session ended') } };
          return { ok: false, failure: failureOf(error, 'session restore failed') };
        }
        const session = snapshotOf(data.session);
        // The SDK found a stored session while initialising, the provider refused it, and the SDK removed
        // it — so the read below it is empty. That emptiness is an ended session, not a first launch.
        if (session === null && ended) return { ok: false, failure: { kind: 'SESSION_ENDED', detail: 'the provider ended the persisted session' } };
        return { ok: true, value: session };
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
    async signInWithLoginId(loginId, password) {
      // The Login ID and the password travel in a body to the QANDEEL API, never a URL. The API answers
      // the provider's verdict: tokens for the reader who proved the password, and otherwise a bare
      // outcome — never which Email a Login ID belongs to (P1 §3).
      const answer = await rest(`${config.apiBaseUrl}/account/login-id-sign-in`, 'POST', { Accept: 'application/json' }, { loginId, password });
      if (answer.status === 0) return { ok: false, failure: { kind: 'NETWORK', detail: 'login-id sign-in transport failed' } };
      if (answer.status === 401) return { ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: 'login-id sign-in refused' } };
      // The provider checked the password first, and the account's Email is unverified. W2-01 R1: that is
      // ALL the reader learns — the answer carries no Email, and nothing in it is read as one.
      if (answer.status === 409 && answer.body?.outcome === 'EMAIL_NOT_CONFIRMED') return { ok: false, failure: { kind: 'EMAIL_NOT_CONFIRMED', detail: 'email not confirmed' } };
      if (answer.status !== 200) return { ok: false, failure: { kind: 'UNEXPECTED', detail: `login-id sign-in answered ${answer.status}` } };
      return adoptApiSession(answer, 'login-id sign-in');
    },
    async verifyLoginIdEmailCode(loginId, code) {
      // The Login ID the reader typed and the code travel in a body; the API answers tokens or a bare outcome.
      const answer = await rest(`${config.apiBaseUrl}/account/login-id-verify-email`, 'POST', { Accept: 'application/json' }, { loginId, code });
      if (answer.status === 0) return { ok: false, failure: { kind: 'NETWORK', detail: 'login-id verification transport failed' } };
      // Wrong, expired, or no such Login ID — one bounded rejection, exactly as the provider's own.
      if (answer.status === 401) return { ok: false, failure: { kind: 'CODE_REJECTED', detail: 'login-id verification refused' } };
      if (answer.status !== 200) return { ok: false, failure: { kind: 'UNEXPECTED', detail: `login-id verification answered ${answer.status}` } };
      const adopted = await adoptApiSession(answer, 'login-id verification');
      return adopted.ok ? adopted : { ok: false, failure: { kind: adopted.failure.kind === 'NETWORK' ? 'NETWORK' : 'UNEXPECTED', detail: adopted.failure.detail } };
    },
    async resendLoginIdEmailCode(loginId) {
      const answer = await rest(`${config.apiBaseUrl}/account/login-id-resend-verification`, 'POST', { Accept: 'application/json' }, { loginId });
      if (answer.status === 0) return { ok: false, failure: { kind: 'NETWORK', detail: 'login-id resend transport failed' } };
      if (answer.status === 200 && answer.body?.outcome === 'ACCEPTED') return { ok: true };
      return { ok: false, failure: { kind: 'REFUSED', detail: `login-id resend answered ${answer.status}` } };
    },
    async requestPasswordRecovery(email) {
      try {
        const { error } = await client.auth.resetPasswordForEmail(email);
        // Non-enumerating: ONLY a request that produced no HTTP answer is reported. A rate limit, a 5xx
        // or a refusal can each differ between an Email with an account and one without, so every
        // answered request is the same result.
        if (error && isTransportFailure(error)) return { ok: false, failure: { kind: 'NETWORK', detail: detailOf(error, 'recovery request failed') } };
        return { ok: true };
      } catch (cause) {
        return { ok: false, failure: { kind: 'NETWORK', detail: describe(cause, 'recovery request threw') } };
      }
    },
    async verifyRecoveryCode(email, code) {
      // Recovery semantics (`type: 'recovery'`), and deliberately NOT `client.auth.verifyOtp`: the SDK
      // would persist the recovery session to auth storage and announce it to subscribers — so a kill
      // before the new password was set would restore it at the next launch as an ordinary sign-in. Here
      // the grant exists only in this return value.
      const answer = await authRest('/verify', 'POST', null, { type: 'recovery', email, token: code });
      if (answer.status !== 200) return { ok: false, failure: recoveryCodeFailureOf(answer.status, errorCodeOf(answer.body)) };
      const accessToken = answer.body?.access_token;
      const refreshToken = answer.body?.refresh_token;
      if (typeof accessToken !== 'string' || accessToken === '' || typeof refreshToken !== 'string' || refreshToken === '') {
        return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'recovery verification returned no grant' } };
      }
      return { ok: true, value: { accessToken, refreshToken } };
    },
    async updateRecoveredPassword(grant, password) {
      const answer = await authRest('/user', 'PUT', grant.accessToken, { password });
      if (answer.status === 0) return { ok: false, failure: { kind: 'NETWORK', detail: 'password update transport failed' } };
      if (answer.status !== 200) {
        const code = errorCodeOf(answer.body);
        // The provider's own password rules. Nothing here is a second password policy.
        if (code === 'weak_password' || code === 'same_password') return { ok: false, failure: { kind: 'WEAK_PASSWORD', detail: code } };
        return { ok: false, failure: { kind: 'UNEXPECTED', detail: `password update answered ${answer.status}` } };
      }
      // W3-MEGA-A (W3-PDG-01 §3) — recovering the password ends ALL the account's other sessions. The provider
      // already ends every session but the recovery one as the password changes (`UpdatePassword` →
      // `LogoutAllExceptMe`); this makes it explicit and ends the recovery session with them. The reader still ends
      // signed out, exactly as W2-01 froze it.
      await authRest('/logout?scope=global', 'POST', grant.accessToken);
      // The password is changed. The recovery authority has done its one job and is retired now; a failed
      // retirement changes nothing the reader sees — the grant was never persisted and is dropped here.
      await retireGrant(grant);
      return { ok: true };
    },
    async retireRecoveryGrant(grant) {
      await retireGrant(grant);
    },
    async signOut() {
      let result: AuthPortResult<null>;
      try {
        // W3-01 R1 — THIS session on THIS device only. An omitted scope is the SDK's `global`, which also
        // revokes the reader's other signed-in devices; the final Sign out never asks for that.
        const { error } = await signOutOwn('local');
        result = error ? { ok: false, failure: failureOf(error, 'sign-out failed') } : { ok: true, value: null };
      } catch (cause) {
        result = { ok: false, failure: { kind: 'NETWORK', detail: describe(cause, 'sign-out threw') } };
      }
      // W3-01 (E2E-D-07) — "leave this device signed out" holds whatever the provider answered. The SDK
      // removes its session on most failures, but not all: when loading the session fails first (an expired
      // access token whose refresh cannot reach the network), or when the call throws, it returns WITHOUT
      // removing anything, and the next launch would restore the identity the reader asked to leave. So this
      // device's session material is retired here, unconditionally and locally. This is not a sign-out of
      // other devices, and it revokes nothing remotely; the provider's own answer is still returned.
      await retireLocalSession();
      return result;
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
