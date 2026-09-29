/**
 * T-14 — a deterministic stand-in for the frozen auth authority. TEST-ONLY.
 *
 * The gateway's whole job is to call ONE existing capability and to map its typed answer onto frozen
 * Product copy, so what a component test needs is exactly that capability under control: what it was
 * handed, when it answers, and with which typed result. Everything else on `MobileAuthAuthority` is
 * implemented as the inert minimum, because the gateway must never touch it — and a double that
 * offered more would invite it to.
 *
 * Nothing here reimplements behaviour under test. The generation rule, the sign-out race and the
 * stale-completion barrier stay inside the real authority, which T-12P already proves on its own; a
 * second copy of them here would be a second authority that could silently disagree with the first.
 */

import type { AuthPortResult, AuthSessionSnapshot, MobileAuthAuthority, MobileAuthState } from '../../runtime-entry';

/**
 * Exactly what the gateway handed the capability, in order. W2-01: the capability is the final sign-in,
 * `signInWithIdentifier`, and what it is handed is ONE identifier — a Login ID or an Email.
 */
export interface RecordedSignIn {
  readonly identifier: string;
  readonly password: string;
}

export interface AuthAuthorityDouble extends MobileAuthAuthority {
  readonly calls: RecordedSignIn[];
  /** Answer every subsequent sign-in immediately with this result. */
  answerWith(result: AuthPortResult<AuthSessionSnapshot>): void;
  /** Answer the sign-in that is currently in flight, and let the continuation run. */
  settle(result: AuthPortResult<AuthSessionSnapshot>): Promise<void>;
  /** Whether a sign-in is still waiting for `settle`. */
  pending(): boolean;
}

export function authAuthorityDouble(initial: MobileAuthState = { kind: 'SIGNED_OUT' }): AuthAuthorityDouble {
  const calls: RecordedSignIn[] = [];
  const state: MobileAuthState = initial;
  const listeners = new Set<(next: MobileAuthState) => void>();
  let waiting: ((result: AuthPortResult<AuthSessionSnapshot>) => void) | null = null;
  let immediate: AuthPortResult<AuthSessionSnapshot> | null = null;

  return {
    calls,
    answerWith(result) {
      immediate = result;
    },
    async settle(result) {
      const resolve = waiting;
      waiting = null;
      resolve?.(result);
      // Two turns: one for the awaited promise itself, one for the continuation that reads it.
      await Promise.resolve();
      await Promise.resolve();
    },
    pending: () => waiting !== null,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async start() {
      return state;
    },
    signInWithIdentifier(identifier, password) {
      calls.push({ identifier, password });
      if (immediate !== null) return Promise.resolve(immediate);
      return new Promise<AuthPortResult<AuthSessionSnapshot>>((resolve) => {
        waiting = resolve;
      });
    },
    // The Email-only T-14 capability is the auth owner's internal route now; the gateway never calls it.
    async signInWithPassword() {
      return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'the gateway must call signInWithIdentifier' } };
    },
    async retrySessionVerification() {
      return state;
    },
    async requestPasswordRecovery() {
      return { ok: true };
    },
    async verifyRecoveryCode() {
      return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'the T-14 gateway double recovers nothing' } };
    },
    async completePasswordRecovery() {
      return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'the T-14 gateway double recovers nothing' } };
    },
    abandonPasswordRecovery() {
      return undefined;
    },
    async signUp() {
      return { ok: false, failure: { kind: 'REFUSED', detail: 'the T-14 gateway double creates no account' } };
    },
    async verifyEmailCode() {
      return { ok: false, failure: { kind: 'UNEXPECTED', detail: 'the T-14 gateway double verifies nothing' } };
    },
    async resendEmailCode() {
      return { ok: false, failure: { kind: 'REFUSED', detail: 'the T-14 gateway double sends nothing' } };
    },
    async signOut() {
      return { ok: true, value: null };
    },
    dispose() {
      listeners.clear();
    },
  };
}

/** A typed failure of one kind. The detail is deliberately recognisable: no Product surface may show it. */
export function authFailure(
  kind: 'INVALID_CREDENTIALS' | 'EMAIL_NOT_CONFIRMED' | 'NETWORK' | 'UNEXPECTED',
  confirmationEmail?: string,
): AuthPortResult<AuthSessionSnapshot> {
  return { ok: false, failure: { kind, detail: 'PROVIDER-DETAIL-MUST-NOT-BE-RENDERED', ...(confirmationEmail === undefined ? {} : { confirmationEmail }) } };
}
