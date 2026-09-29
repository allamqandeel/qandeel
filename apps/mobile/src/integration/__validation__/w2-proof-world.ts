/**
 * W2-01 — the visual-proof world. VALIDATION ONLY, FIXTURE ONLY.
 *
 * The W2-01 proof renders the PRODUCTION phase surface over a runtime built by the production
 * `createIntegrationRuntime`. What cannot exist in a proof build is stood in for through T-12P's public
 * injection points, exactly as the W1B-01 proof world does:
 *
 *   - the identity provider: an in-memory `SupabaseAuthPort`. Its restore answers per SCENARIO — no
 *     session (a first launch), a session the provider ended, or an unverifiable session whose first
 *     retry restores it. Every sign-in credential is refused, so the approved generic failure can be
 *     seen — except the ONE fixture Login ID `W2_PROOF_UNVERIFIED_LOGIN_ID`, whose password is "proved"
 *     and whose Email is unverified (W2-01 R1): its Verify Email step never learns an Email, its resend
 *     answers, and every code is refused, so the step's own messages can be seen; recovery accepts ANY six-digit code and ANY new password, and holds and keeps nothing. No
 *     Email is sent and no credential leaves the device;
 *   - the network: the W1B-01 proof world's scripted HTTP, so a restored session reaches a real world.
 *
 * Nothing here is reachable from the Product route.
 */
import type { ChromeLanguage } from '../../orientation-chrome';
import type { AuthSessionSnapshot, MobilePublicConfig, RuntimeHttpFetch, SupabaseAuthPort } from '../../runtime-entry';
import { createW1BProofWorld } from './w1b-proof-world';

/** Which launch the proof shows. */
export type W2ProofScenario = 'SIGNED_OUT' | 'SESSION_ENDED' | 'UNKNOWN';

/** W2-01 R1 — the fixture Login ID whose account's Email is unverified. It has no Email anywhere on the device. */
export const W2_PROOF_UNVERIFIED_LOGIN_ID = 'unverified.reader';

export interface W2ProofWorld {
  readonly config: MobilePublicConfig;
  readonly auth: SupabaseAuthPort;
  readonly fetch: RuntimeHttpFetch;
}

const hold = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** Long enough that a busy control can be seen, short enough to keep the proof quick. */
const REQUEST_HOLD_MS = 600;

export function createW2ProofWorld(language: ChromeLanguage, scenario: W2ProofScenario): W2ProofWorld {
  const base = createW1BProofWorld(language);
  const reader: AuthSessionSnapshot = { userId: 'w2-proof-reader', accessToken: 'w2-proof-bearer' };
  const listeners = new Set<Parameters<SupabaseAuthPort['onSessionChange']>[0]>();
  let restores = 0;
  const refused = { ok: false as const, failure: { kind: 'INVALID_CREDENTIALS' as const, detail: 'the W2 proof refuses every credential' } };

  const auth: SupabaseAuthPort = {
    restoreSession: async () => {
      restores += 1;
      await hold(REQUEST_HOLD_MS);
      if (scenario === 'SESSION_ENDED') return { ok: false, failure: { kind: 'SESSION_ENDED', detail: 'fixture: the provider ended the session' } };
      if (scenario === 'UNKNOWN') {
        // The first restore cannot be verified; the reader's retry restores the session.
        return restores === 1 ? { ok: false, failure: { kind: 'NETWORK', detail: 'fixture: offline' } } : { ok: true, value: reader };
      }
      return { ok: true, value: null };
    },
    signInWithPassword: async () => {
      await hold(REQUEST_HOLD_MS);
      return refused;
    },
    signInWithLoginId: async (loginId) => {
      await hold(REQUEST_HOLD_MS);
      // Exactly the API's answer: the outcome, and no Email.
      if (loginId.toLowerCase() === W2_PROOF_UNVERIFIED_LOGIN_ID) return { ok: false, failure: { kind: 'EMAIL_NOT_CONFIRMED', detail: 'fixture: email not confirmed' } };
      return refused;
    },
    signUp: async () => ({ ok: false, failure: { kind: 'REFUSED', detail: 'the W2 proof creates no account' } }),
    verifyEmailCode: async () => ({ ok: false, failure: { kind: 'UNEXPECTED', detail: 'the W2 proof verifies no Email' } }),
    resendEmailCode: async () => ({ ok: false, failure: { kind: 'REFUSED', detail: 'the W2 proof sends nothing' } }),
    verifyLoginIdEmailCode: async () => {
      await hold(REQUEST_HOLD_MS);
      return { ok: false, failure: { kind: 'CODE_REJECTED', detail: 'fixture: every code is refused' } };
    },
    resendLoginIdEmailCode: async () => {
      await hold(REQUEST_HOLD_MS);
      return { ok: true };
    },
    requestPasswordRecovery: async () => {
      await hold(REQUEST_HOLD_MS);
      return { ok: true };
    },
    verifyRecoveryCode: async (_email, code) => {
      await hold(REQUEST_HOLD_MS);
      if (!/^\d{6}$/u.test(code)) return { ok: false, failure: { kind: 'CODE_REJECTED', detail: 'fixture: not six digits' } };
      // A fixture grant: it is never persisted and nothing announces it, exactly as in production.
      return { ok: true, value: { accessToken: 'w2-proof-recovery', refreshToken: 'w2-proof-recovery' } };
    },
    updateRecoveredPassword: async () => {
      await hold(REQUEST_HOLD_MS);
      return { ok: true };
    },
    retireRecoveryGrant: async () => undefined,
    signOut: async () => ({ ok: true, value: null }),
    onSessionChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    startAutoRefresh: () => undefined,
    stopAutoRefresh: () => undefined,
  };

  return { config: base.config, auth, fetch: base.fetch };
}
