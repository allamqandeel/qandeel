/**
 * W2-01 — the visual-proof world reaches exactly the phases the device proof photographs, through the
 * production integration runtime. VALIDATION TOOLING ONLY — no Product module imports the proof world.
 */
import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { createIntegrationRuntime } from '../runtime/integration-runtime';
import { createW2ProofWorld, type W2ProofScenario } from '../__validation__/w2-proof-world';

jest.setTimeout(20000);

async function start(scenario: W2ProofScenario) {
  const world = createW2ProofWorld('en', scenario);
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
  });
  if (!built.ok) throw new Error('the proof runtime could not be built');
  await built.runtime.start();
  return built.runtime;
}

const until = async (predicate: () => boolean) => {
  for (let tries = 0; tries < 200 && !predicate(); tries += 1) await new Promise((resolve) => setTimeout(resolve, 25));
  expect(predicate()).toBe(true);
};

it('SIGNED_OUT: a first launch, and every sign-in credential is refused with the generic kind', async () => {
  const runtime = await start('SIGNED_OUT');
  expect(runtime.getPhase()).toEqual({ kind: 'SIGNED_OUT' });
  expect(runtime.auth.getState()).toEqual({ kind: 'SIGNED_OUT' });
  const answer = await runtime.auth.signInWithIdentifier('mona.ali', 'x');
  expect(!answer.ok && answer.failure.kind).toBe('INVALID_CREDENTIALS');
  // Recovery ends signed out, with nothing bootstrapped.
  expect(await runtime.auth.verifyRecoveryCode('mona@w2-proof.invalid', '123456')).toEqual({ ok: true });
  expect(await runtime.auth.completePasswordRecovery('whatever')).toEqual({ ok: true });
  expect(runtime.getPhase().kind).toBe('SIGNED_OUT');
  runtime.dispose();
});

it('SESSION_ENDED: Sign in, with the ended-session evidence', async () => {
  const runtime = await start('SESSION_ENDED');
  expect(runtime.auth.getState()).toEqual({ kind: 'SIGNED_OUT', sessionEnded: true });
  expect(runtime.getPhase().kind).toBe('SIGNED_OUT');
  runtime.dispose();
});

it('UNKNOWN: the unable-to-verify state, whose retry restores the session into one world', async () => {
  const runtime = await start('UNKNOWN');
  expect(runtime.getPhase().kind).toBe('AUTH_ERROR');
  await runtime.auth.retrySessionVerification();
  await until(() => runtime.getPhase().kind === 'READY');
  runtime.dispose();
});
