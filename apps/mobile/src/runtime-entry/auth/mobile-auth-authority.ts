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
import type { AuthPortFailure, AuthPortResult, AuthSessionSnapshot, SupabaseAuthPort } from './supabase-auth-port';

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
   * The exact credential a sign-out retired. A session callback that was already in flight when the
   * sign-out ran will deliver this same pair; accepting it would resurrect a signed-out identity.
   * Any genuinely new authentication carries a different token, so it is unaffected.
   */
  let retired: { readonly userId: string; readonly accessToken: string } | null = null;
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

  function acceptSession(session: AuthSessionSnapshot | null): void {
    if (disposed) return;
    if (session === null) {
      retired = null;
      if (state.kind !== 'SIGNED_OUT') publish({ kind: 'SIGNED_OUT' });
      return;
    }
    if (retired !== null && retired.userId === session.userId && retired.accessToken === session.accessToken) {
      // A stale callback from before the sign-out. Ignored, not applied.
      return;
    }
    retired = null;
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
      unsubscribePort = port.onSessionChange(acceptSession);
      unsubscribeForeground = foreground.subscribe(() => syncAutoRefresh());
      const restored = await port.restoreSession();
      if (disposed) return state;
      if (!restored.ok) {
        publish({ kind: 'ERROR', failure: restored.failure });
        return state;
      }
      acceptSession(restored.value);
      // A restore that legitimately found nothing still has to leave RESTORING.
      if (state.kind === 'RESTORING') publish({ kind: 'SIGNED_OUT' });
      return state;
    },
    async signInWithPassword(email, password) {
      if (disposed) return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'auth authority is disposed' } };
      const result = await port.signInWithPassword(email, password);
      if (disposed) return result;
      if (!result.ok) {
        // A rejected credential is not a runtime error: the reader is simply still signed out.
        if (result.failure.kind === 'INVALID_CREDENTIALS' && state.kind !== 'AUTHENTICATED') {
          publish({ kind: 'SIGNED_OUT' });
        }
        return result;
      }
      acceptSession(result.value);
      return result;
    },
    async signOut() {
      if (disposed) return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'auth authority is disposed' } };
      if (state.kind === 'AUTHENTICATED') retired = { userId: state.userId, accessToken: state.accessToken };
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
