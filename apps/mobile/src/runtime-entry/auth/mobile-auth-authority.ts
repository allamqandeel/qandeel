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
   * Whether the current auth epoch has been retired — by a sign-out, or by a restore that found no
   * session. While it is retired NO observed SDK event may establish authentication, whatever kind
   * it carries. Only an explicit sign-in completion whose operation epoch is still current may.
   *
   * R2-01: an earlier version let a subscriber `SIGNED_IN` cross this barrier, and the maintained
   * SDK makes that fatal. `GoTrueClient.signInWithPassword` does
   * `_saveSession` -> `await _notifyAllSubscribers('SIGNED_IN', session)` -> `return`, so a sign-in
   * that raced a sign-out delivers its subscriber event BEFORE its own promise resolves — and an
   * epoch check that only runs after the await is already too late. Event kind is not operation
   * provenance, so the barrier no longer consults it.
   */
  let epochRetired = false;
  /**
   * Increments on every explicit auth command. A command captures it before awaiting and abandons
   * its own result if it has moved, so the reader's last explicit instruction wins. This is the ONLY
   * thing that may re-establish authentication after a retirement.
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

  /** Establish or update the authenticated identity. The one place `state` becomes AUTHENTICATED. */
  function authenticate(session: AuthSessionSnapshot): void {
    epochRetired = false;
    if (state.kind === 'AUTHENTICATED' && state.userId === session.userId) {
      // A token refresh: same identity, same generation, new credential. Keeping the generation is
      // exactly what stops a refresh from creating a second conversation Session.
      if (state.accessToken === session.accessToken) return;
      publish({ kind: 'AUTHENTICATED', userId: session.userId, accessToken: session.accessToken, authGeneration: generation });
      return;
    }
    generation += 1;
    publish({ kind: 'AUTHENTICATED', userId: session.userId, accessToken: session.accessToken, authGeneration: generation });
  }

  /**
   * R2-01 — an OBSERVED SDK event. Reconciliation, never establishment across a retirement.
   *
   * An observed event may retire the runtime, refresh an already-authenticated identity's
   * credential, or carry an already-authorized replacement while a runtime is live. It may NOT
   * establish authentication once the epoch is retired, because at that point the event is evidence
   * that the SDK completed something — not evidence that the reader currently wants to be signed in.
   * A sign-in racing a sign-out emits exactly such an event, and it must lose.
   */
  function acceptObservedAuthChange(change: AuthSessionChange): void {
    if (disposed) return;
    const { session } = change;
    if (session === null) {
      epochRetired = true;
      if (state.kind !== 'SIGNED_OUT') publish({ kind: 'SIGNED_OUT' });
      return;
    }
    // The barrier. Deliberately does NOT consult `change.kind`: a subscriber `SIGNED_IN` is the
    // precise event a stale sign-in delivers, and letting the kind authorize it is the R2-01 defect.
    if (epochRetired) return;
    authenticate(session);
  }

  /**
   * R2-01 — an EXPLICIT sign-in completion. The only provenance that may cross a retirement.
   *
   * `epoch` is captured before the request is issued. If it has moved, a later explicit command —
   * a sign-out, or another sign-in — superseded this one while it was in flight, and the reader's
   * later instruction stands.
   */
  function acceptExplicitSignInCompletion(session: AuthSessionSnapshot, epoch: number): void {
    if (disposed) return;
    if (epoch !== operationEpoch) return;
    authenticate(session);
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
      unsubscribePort = port.onSessionChange(acceptObservedAuthChange);
      unsubscribeForeground = foreground.subscribe(() => syncAutoRefresh());
      const restored = await port.restoreSession();
      if (disposed) return state;
      if (!restored.ok) {
        publish({ kind: 'ERROR', failure: restored.failure });
        return state;
      }
      acceptObservedAuthChange({ kind: 'INITIAL', session: restored.value });
      // A restore that legitimately found nothing still has to leave RESTORING.
      if (state.kind === 'RESTORING') publish({ kind: 'SIGNED_OUT' });
      return state;
    },
    async signInWithPassword(email, password) {
      if (disposed) return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'auth authority is disposed' } };
      operationEpoch += 1;
      const epoch = operationEpoch;
      // The SDK notifies subscribers of SIGNED_IN and awaits them BEFORE this promise resolves, so
      // by the time control returns here the observed path has already seen — and, if the epoch was
      // retired meanwhile, correctly refused — that event.
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
      acceptExplicitSignInCompletion(result.value, epoch);
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
