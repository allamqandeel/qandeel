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
  EmailCodeResult,
  PasswordUpdateResult,
  RecoveryCodeResult,
  RecoveryGrant,
  RecoveryRequestResult,
  ResendResult,
  SignUpIdentity,
  SignUpResult,
  SupabaseAuthPort,
} from './supabase-auth-port';

/**
 * W2-01 — the ONE classification rule for the final sign-in's identifier: an Email always contains `@`,
 * and the Login ID grammar never does. Exported so the entry routes an unconfirmed reader by the same rule
 * the credential was routed by, rather than by a second copy of it.
 */
export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes('@');
}

/**
 * W2-01 R1 — whose Email a Verify Email step verifies. `EMAIL`: an address the reader typed (Create
 * account, or an Email sign-in), which the step may show. `LOGIN_ID`: the Login ID the reader typed, whose
 * Email stays on the server — the device never learns it (P1 §3), so the step names no address at all.
 */
export type EmailVerificationTarget = { readonly via: 'EMAIL'; readonly email: string } | { readonly via: 'LOGIN_ID'; readonly loginId: string };

export type MobileAuthState =
  /** The persisted session is being restored. The first state, and never returned to. */
  | { readonly kind: 'RESTORING' }
  /**
   * Nobody is authenticated. This is a correct resting state, not a failure.
   *
   * W2-01: `sessionEnded` is present ONLY when reliable evidence shows an existing authenticated session
   * ended without the reader asking — the provider refused the persisted session at restore, or removed
   * a live identity's session. Never on a first launch with no session, and never after an explicit
   * sign-out, which the reader asked for.
   */
  | { readonly kind: 'SIGNED_OUT'; readonly sessionEnded?: true }
  | {
      readonly kind: 'AUTHENTICATED';
      readonly userId: string;
      readonly accessToken: string;
      /** Stable across a token refresh for the same user; new for a different identity. */
      readonly authGeneration: number;
    }
  /**
   * A technical failure that is not "signed out": restore failed, the port misbehaved.
   *
   * W2-01: this is the UNKNOWN state — the session could not be verified and nothing proved it ended.
   * The persisted session is left exactly where it is, nothing bootstraps, and only an explicit
   * `retrySessionVerification` asks again.
   */
  | { readonly kind: 'ERROR'; readonly failure: AuthPortFailure };

export interface MobileAuthAuthority {
  getState(): MobileAuthState;
  /** Observe every state change. Returns an idempotent unsubscribe. */
  subscribe(listener: (state: MobileAuthState) => void): () => void;
  /** Restore the persisted session and begin observing. Safe to call once; later calls are no-ops. */
  start(): Promise<MobileAuthState>;
  signInWithPassword(email: string, password: string): Promise<AuthPortResult<AuthSessionSnapshot>>;
  /**
   * W1B-01 — create an account. It never authenticates anyone: the Email must be verified first. It
   * is an explicit command, so any sign-in or verification still in flight is superseded by it.
   */
  signUp(email: string, password: string, identity: SignUpIdentity): Promise<SignUpResult>;
  /**
   * W1B-01 — verify an Email with its 6-digit code. Exactly like a sign-in, only a CURRENT completion
   * may establish authentication: a later explicit command abandons this one's result.
   */
  verifyEmailCode(email: string, code: string): Promise<EmailCodeResult>;
  /** W1B-01 — send a new verification code. It establishes nothing and supersedes nothing. */
  resendEmailCode(email: string): Promise<ResendResult>;
  /**
   * W2-01 R1 — verify the Email of the account a Login ID names, without the device ever learning that
   * Email. The same explicit command as `verifyEmailCode`, under the same epoch rules.
   */
  verifyLoginIdEmailCode(loginId: string, code: string): Promise<EmailCodeResult>;
  /** W2-01 R1 — a new code for that Email. It establishes nothing and supersedes nothing. */
  resendLoginIdEmailCode(loginId: string): Promise<ResendResult>;
  /**
   * W2-01 — the final sign-in: ONE identifier that is a Login ID or an Email, plus the password. An
   * identifier containing `@` is an Email and goes to the provider exactly as `signInWithPassword`;
   * anything else is a Login ID, resolved on the server. Both are the same explicit command: only a
   * CURRENT completion may establish the identity, and both converge on the same failure kinds.
   */
  signInWithIdentifier(identifier: string, password: string): Promise<AuthPortResult<AuthSessionSnapshot>>;
  /**
   * W2-01 — ask the authoritative restore again, from the unknown state (`ERROR`) only. A restored
   * session authenticates exactly as the first restore would have; a proved ended session is
   * `SIGNED_OUT` with `sessionEnded`; another technical failure stays unknown. Never `RESTORING`.
   */
  retrySessionVerification(): Promise<MobileAuthState>;
  /** W2-01 — ask for a recovery code for an Email. Non-enumerating; establishes and supersedes nothing. */
  requestPasswordRecovery(email: string): Promise<RecoveryRequestResult>;
  /**
   * W2-01 — verify a recovery code. An explicit command: it supersedes whatever was in flight. Its
   * temporary recovery authority is held HERE, in memory, bound to this command's epoch, and is never
   * an identity: nothing is published, nothing authenticates, nothing bootstraps.
   */
  verifyRecoveryCode(email: string, code: string): Promise<RecoveryCodeResult>;
  /**
   * W2-01 — set the new password with the held recovery authority, which is then retired. The reader
   * stays signed out and signs in explicitly. Refused if a later explicit command superseded the code.
   */
  completePasswordRecovery(newPassword: string): Promise<PasswordUpdateResult>;
  /** W2-01 — the reader left recovery: retire any held recovery authority now. Establishes nothing. */
  abandonPasswordRecovery(): void;
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
  /**
   * W2-01 — the ONE place a recovery grant lives: memory, bound to the explicit command that verified
   * it. Usable only while that command is still the reader's latest (`epoch === operationEpoch`), and
   * dropped — and retired at the provider — the moment it is used, superseded, or an identity is
   * established. It is never passed to `authenticate`, so it can never become the signed-in state.
   */
  let recoveryHold: { readonly epoch: number; readonly grant: RecoveryGrant } | null = null;
  /** W2-01 — one authoritative re-verification at a time. */
  let retrying: Promise<MobileAuthState> | null = null;

  function discardRecoveryHold(): void {
    if (recoveryHold === null) return;
    const { grant } = recoveryHold;
    recoveryHold = null;
    void port.retireRecoveryGrant(grant);
  }

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
    // W2-01: a recovery authority never coexists with an established identity.
    discardRecoveryHold();
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
      // W2-01: a live identity whose session vanished while its epoch was NOT retired — no sign-out was
      // asked for — was ended by the provider (its refresh token refused). An explicit sign-out retires
      // the epoch before it awaits, so its own SIGNED_OUT can never be read as an ending.
      const ended = state.kind === 'AUTHENTICATED' && !epochRetired;
      epochRetired = true;
      if (ended) publish({ kind: 'SIGNED_OUT', sessionEnded: true });
      else if (state.kind !== 'SIGNED_OUT') publish({ kind: 'SIGNED_OUT' });
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

  /**
   * The answer of an authoritative restore — the first one, or a W2-01 retry from the unknown state.
   *
   *   restored or empty  -> the observed path, exactly as before (an empty restore leaves RESTORING)
   *   SESSION_ENDED      -> proved over: signed out, WITH the ended-session evidence
   *   anything else      -> unknown: ERROR, and the persisted session is left untouched
   */
  function settleRestore(restored: AuthPortResult<AuthSessionSnapshot | null>): void {
    if (!restored.ok) {
      if (restored.failure.kind === 'SESSION_ENDED') {
        epochRetired = true;
        publish({ kind: 'SIGNED_OUT', sessionEnded: true });
        return;
      }
      publish({ kind: 'ERROR', failure: restored.failure });
      return;
    }
    acceptObservedAuthChange({ kind: 'INITIAL', session: restored.value });
    // A restore that legitimately found nothing still has to leave RESTORING (or ERROR, on a retry).
    if (state.kind === 'RESTORING' || state.kind === 'ERROR') publish({ kind: 'SIGNED_OUT' });
  }

  /**
   * W2-01 — a Login ID sign-in, the same explicit command as a password sign-in. A superseded one that
   * nonetheless yielded a session has already been adopted by the SDK, so — exactly as a superseded
   * Email verification — that session is discarded while nobody is authenticated, and no later launch
   * restores what the reader abandoned.
   */
  async function signInWithLoginId(loginId: string, password: string): Promise<AuthPortResult<AuthSessionSnapshot>> {
    operationEpoch += 1;
    const epoch = operationEpoch;
    const result = await port.signInWithLoginId(loginId, password);
    if (disposed) return result;
    if (epoch !== operationEpoch) {
      if (result.ok && (state as MobileAuthState).kind !== 'AUTHENTICATED') void port.signOut();
      return result;
    }
    if (!result.ok) {
      if (result.failure.kind === 'INVALID_CREDENTIALS' && state.kind !== 'AUTHENTICATED') publish({ kind: 'SIGNED_OUT' });
      return result;
    }
    acceptExplicitSignInCompletion(result.value, epoch);
    return result;
  }

  const authority: MobileAuthAuthority = {
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
      settleRestore(restored);
      return state;
    },
    retrySessionVerification() {
      if (disposed || state.kind !== 'ERROR') return Promise.resolve(state);
      // One re-verification at a time: a second press while one is in flight joins it.
      if (retrying !== null) return retrying;
      const attempt = (async () => {
        const restored = await port.restoreSession();
        // Only an authority still in the unknown state it retried from applies the answer.
        if (!disposed && state.kind === 'ERROR') settleRestore(restored);
        return state;
      })();
      retrying = attempt;
      void attempt.finally(() => {
        if (retrying === attempt) retrying = null;
      });
      return attempt;
    },
    async signInWithIdentifier(identifier, password) {
      if (disposed) return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'auth authority is disposed' } };
      // The ONE classification rule: an Email always contains `@`, and the Login ID grammar never does.
      if (isEmailIdentifier(identifier)) return authority.signInWithPassword(identifier, password);
      return signInWithLoginId(identifier, password);
    },
    async requestPasswordRecovery(email) {
      if (disposed) return { ok: false, failure: { kind: 'NETWORK', detail: 'auth authority is disposed' } };
      return port.requestPasswordRecovery(email);
    },
    async verifyRecoveryCode(email, code) {
      if (disposed) return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'auth authority is disposed' } };
      // Recovery belongs to a signed-out reader only; it can never run beside an identity.
      if (state.kind !== 'SIGNED_OUT') return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'recovery requires the signed-out state' } };
      operationEpoch += 1;
      const epoch = operationEpoch;
      discardRecoveryHold();
      const result = await port.verifyRecoveryCode(email, code);
      if (!result.ok) return result;
      // Superseded while in flight (or retired): the grant is retired at once and never held.
      if (disposed || epoch !== operationEpoch || (state as MobileAuthState).kind !== 'SIGNED_OUT') {
        void port.retireRecoveryGrant(result.value);
        return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'recovery verification was superseded' } };
      }
      recoveryHold = { epoch, grant: result.value };
      // The grant stays here. The entry learns only that the code verified.
      return { ok: true };
    },
    async completePasswordRecovery(newPassword) {
      if (disposed) return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'auth authority is disposed' } };
      const hold = recoveryHold;
      if (hold === null || hold.epoch !== operationEpoch || state.kind !== 'SIGNED_OUT') {
        // No current recovery authority: nothing to update with, and a stale one is retired.
        discardRecoveryHold();
        return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'no current recovery authority' } };
      }
      const result = await port.updateRecoveredPassword(hold.grant, newPassword);
      // The port retired the grant on success. On a failure the same authority may try again, unless a
      // later explicit command superseded it meanwhile.
      if (result.ok) {
        if (recoveryHold === hold) recoveryHold = null;
      } else if (recoveryHold === hold && hold.epoch !== operationEpoch) {
        discardRecoveryHold();
      }
      return result;
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
    async signUp(email, password, identity) {
      if (disposed) return { ok: false, failure: { kind: 'REFUSED', detail: 'auth authority is disposed' } };
      if (state.kind === 'AUTHENTICATED') return { ok: false, failure: { kind: 'REFUSED', detail: 'an identity is already authenticated' } };
      // An explicit command: whatever sign-in or verification was still in flight is no longer the
      // reader's latest instruction. Sign-up itself authenticates nobody, so nothing is accepted here —
      // the port refuses and discards any session a misconfigured project hands back.
      operationEpoch += 1;
      return port.signUp(email, password, identity);
    },
    async verifyEmailCode(email, code) {
      if (disposed) return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'auth authority is disposed' } };
      if (state.kind === 'AUTHENTICATED') return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'an identity is already authenticated' } };
      operationEpoch += 1;
      const epoch = operationEpoch;
      // As with sign-in, the SDK notifies SIGNED_IN before this promise resolves; the observed path has
      // already refused it across the retired barrier, so only the explicit completion below may count.
      const result = await port.verifyEmailCode(email, code);
      if (disposed) return result;
      // A later explicit command superseded this verification while it was in flight: abandoned. The
      // SDK has already persisted the session it yielded, so while nobody is authenticated that
      // session is discarded too — otherwise the next launch would restore an identity the reader
      // abandoned, which is the same resurrection in slow motion.
      if (epoch !== operationEpoch) {
        // Re-read: the await above may have moved the state, which the compiler's narrowing cannot see.
        if (result.ok && (state as MobileAuthState).kind !== 'AUTHENTICATED') void port.signOut();
        return result;
      }
      if (result.ok) acceptExplicitSignInCompletion(result.value, epoch);
      return result;
    },
    async resendEmailCode(email) {
      if (disposed) return { ok: false, failure: { kind: 'REFUSED', detail: 'auth authority is disposed' } };
      return port.resendEmailCode(email);
    },
    async verifyLoginIdEmailCode(loginId, code) {
      if (disposed) return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'auth authority is disposed' } };
      if (state.kind === 'AUTHENTICATED') return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'an identity is already authenticated' } };
      // Exactly `verifyEmailCode`'s rules: an explicit command with its own epoch, whose session is adopted
      // into the ONE client (the observed SIGNED_IN meets the retired barrier), and only a CURRENT
      // completion establishes. A superseded one's adopted session is discarded while nobody is signed in.
      operationEpoch += 1;
      const epoch = operationEpoch;
      const result = await port.verifyLoginIdEmailCode(loginId, code);
      if (disposed) return result;
      if (epoch !== operationEpoch) {
        if (result.ok && (state as MobileAuthState).kind !== 'AUTHENTICATED') void port.signOut();
        return result;
      }
      if (result.ok) acceptExplicitSignInCompletion(result.value, epoch);
      return result;
    },
    async resendLoginIdEmailCode(loginId) {
      if (disposed) return { ok: false, failure: { kind: 'REFUSED', detail: 'auth authority is disposed' } };
      return port.resendLoginIdEmailCode(loginId);
    },
    abandonPasswordRecovery() {
      discardRecoveryHold();
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
      discardRecoveryHold();
      port.stopAutoRefresh();
      unsubscribePort?.();
      unsubscribeForeground?.();
      unsubscribePort = null;
      unsubscribeForeground = null;
      listeners.clear();
    },
  };
  return authority;
}
