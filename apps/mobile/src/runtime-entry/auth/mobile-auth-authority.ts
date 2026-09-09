/**
 * T-12P §2.1 / §2.2 / §6 — the mobile auth runtime.
 *
 * This owns WHO is authenticated and WHICH access token the rest of the runtime forwards to the
 * QANDEEL API. It owns no Product UI: there is no login screen, no Product copy and no provider
 * buttons here, and §10 forbids adding them. `signInWithPassword` is the narrow v1 technical
 * acquisition capability a future auth gateway will call — not a design.
 *
 * THE GENERATION RULE IS THE WHOLE POINT. `authGeneration` identifies an authenticated IDENTITY,
 * not a token. A token refresh for the same user updates the credential and leaves the generation
 * alone, which is exactly why a refresh must not create a second QANDEEL conversation Session. A
 * different user, or a sign-out followed by a sign-in, starts a new generation and retires
 * everything bound to the old one.
 *
 * NOTHING HERE LOGS A CREDENTIAL. The access token is carried in state and handed to callers; it is
 * never written to a log, an error message or a snapshot. The refresh token never crosses the port
 * at all — it stays inside the SDK and its storage.
 */
import type { ForegroundSignal } from '../lifecycle/foreground-signal';
import type {
  AuthPortFailure,
  AuthPortResult,
  AuthSessionChange,
  AuthSessionSnapshot,
  SupabaseAuthPort,
} from './supabase-auth-port';

export type MobileAuthState =
  /** The persisted session is being restored. The first state, and never returned to. */
  | { readonly kind: 'RESTORING' }
  /** Nobody is authenticated. This is a correct resting state, not a failure. */
  | { readonly kind: 'SIGNED_OUT' }
  | {
      readonly kind: 'AUTHENTICATED';
      readonly userId: string;
      readonly accessToken: string;
      /** Stable across a token refresh for the same user; new for a different identity. */
      readonly authGeneration: number;
    }
  /** A technical failure that is not "signed out": restore failed, the port misbehaved. */
  | { readonly kind: 'ERROR'; readonly failure: AuthPortFailure };

export interface MobileAuthAuthority {
  getState(): MobileAuthState;
  /** Observe every state change. Returns an idempotent unsubscribe. */
  subscribe(listener: (state: MobileAuthState) => void): () => void;
  /** Restore the persisted session and begin observing. Safe to call once; later calls are no-ops. */
  start(): Promise<MobileAuthState>;
  signInWithPassword(email: string, password: string): Promise<AuthPortResult<AuthSessionSnapshot>>;
  signOut(): Promise<AuthPortResult<null>>;
  /** Retire the authority. After this nothing can change its state, including a late callback. */
  dispose(): void;
}

export interface MobileAuthAuthorityOptions {
  readonly port: SupabaseAuthPort;
  readonly foreground: ForegroundSignal;
}

export function createMobileAuthAuthority({ port, foreground }: MobileAuthAuthorityOptions): MobileAuthAuthority {
  let state: MobileAuthState = { kind: 'RESTORING' };
  let generation = 0;
  let started = false;
  let disposed = false;
  /**
   * R1-01 — whether the current auth epoch has been retired by a sign-out.
   *
   * While this is true, ONLY an explicit `SIGNED_IN` may authenticate again. A `TOKEN_REFRESHED`,
   * `INITIAL`, `USER_UPDATED` or unrecognised callback that was already in flight when the sign-out
   * ran belongs to the retired epoch and is dropped, however fresh the token it carries.
   *
   * The earlier rule compared `{userId, accessToken}` against the retired pair, and that is exactly
   * the case it missed: a refresh completing after sign-out delivers the SAME user with a DIFFERENT
   * token, so the pair never matched and the identity came back. Provenance, not token equality.
   */
  let epochRetired = false;
  /**
   * Increments on every explicit auth command. A command captures it before awaiting and abandons
   * its own result if it has moved: a sign-in still in flight when the reader signs out must not
   * re-authenticate them, and its `SIGNED_IN` provenance would otherwise be accepted by design.
   * The reader's last explicit instruction wins.
   */
  let operationEpoch = 0;
  let unsubscribePort: (() => void) | null = null;
  let unsubscribeForeground: (() => void) | null = null;
  const listeners = new Set<(next: MobileAuthState) => void>();

  function publish(next: MobileAuthState): void {
    state = next;
    // Snapshot: a listener that unsubscribes while being notified must not reindex the iteration.
    for (const listener of Array.from(listeners)) listener(next);
    syncAutoRefresh();
  }

  /**
   * Supabase cannot detect foreground off-browser, so its refresh loop would otherwise run forever
   * in the background. Refresh runs exactly while an authenticated identity is foregrounded.
   */
  function syncAutoRefresh(): void {
    if (disposed) return;
    if (state.kind === 'AUTHENTICATED' && foreground.current() === 'ACTIVE') port.startAutoRefresh();
    else port.stopAutoRefresh();
  }

  function acceptChange(change: AuthSessionChange): void {
    if (disposed) return;
    const { kind, session } = change;
    if (session === null) {
      epochRetired = true;
      if (state.kind !== 'SIGNED_OUT') publish({ kind: 'SIGNED_OUT' });
      return;
    }
    if (epochRetired && kind !== 'SIGNED_IN') {
      // A callback belonging to the retired auth epoch. Dropped, not applied — this is R1-01.
      return;
    }
    epochRetired = false;
    const sameIdentity = state.kind === 'AUTHENTICATED' && state.userId === session.userId;
    if (sameIdentity) {
      // A token refresh. Same identity, same generation, new credential.
      if (state.kind === 'AUTHENTICATED' && state.accessToken === session.accessToken) return;
      publish({ kind: 'AUTHENTICATED', userId: session.userId, accessToken: session.accessToken, authGeneration: generation });
      return;
    }
    generation += 1;
    publish({ kind: 'AUTHENTICATED', userId: session.userId, accessToken: session.accessToken, authGeneration: generation });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        listeners.delete(listener);
      };
    },
    async start() {
      if (started || disposed) return state;
      started = true;
      unsubscribePort = port.onSessionChange(acceptChange);
      unsubscribeForeground = foreground.subscribe(() => syncAutoRefresh());
      const restored = await port.restoreSession();
      if (disposed) return state;
      if (!restored.ok) {
        publish({ kind: 'ERROR', failure: restored.failure });
        return state;
      }
      acceptChange({ kind: 'INITIAL', session: restored.value });
      // A restore that legitimately found nothing still has to leave RESTORING.
      if (state.kind === 'RESTORING') publish({ kind: 'SIGNED_OUT' });
      return state;
    },
    async signInWithPassword(email, password) {
      if (disposed) return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'auth authority is disposed' } };
      operationEpoch += 1;
      const epoch = operationEpoch;
      const result = await port.signInWithPassword(email, password);
      if (disposed) return result;
      // A sign-out (or another sign-in) happened while this was in flight. The reader's later
      // instruction stands; this result is abandoned rather than applied.
      if (epoch !== operationEpoch) return result;
      if (!result.ok) {
        // A rejected credential is not a runtime error: the reader is simply still signed out.
        if (result.failure.kind === 'INVALID_CREDENTIALS' && state.kind !== 'AUTHENTICATED') {
          publish({ kind: 'SIGNED_OUT' });
        }
        return result;
      }
      // An explicit sign-in is the one provenance that may start an identity after a sign-out.
      acceptChange({ kind: 'SIGNED_IN', session: result.value });
      return result;
    },
    async signOut() {
      if (disposed) return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'auth authority is disposed' } };
      // Retire the epoch BEFORE awaiting: a refresh callback that lands while the sign-out is in
      // flight already belongs to the epoch the reader has asked to end, and so does a sign-in
      // whose own request has not come back yet.
      operationEpoch += 1;
      epochRetired = true;
      const result = await port.signOut();
      if (disposed) return result;
      // The local runtime is retired whether or not the network round trip succeeded: continuing to
      // treat a reader as authenticated after they asked not to be is the worse failure.
      publish({ kind: 'SIGNED_OUT' });
      return result;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      port.stopAutoRefresh();
      unsubscribePort?.();
      unsubscribeForeground?.();
      unsubscribePort = null;
      unsubscribeForeground = null;
      listeners.clear();
    },
  };
}
