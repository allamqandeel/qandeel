/**
 * W1B-01 — account creation, Email-code verification and resend, through the ONE auth authority.
 *
 * The rule under test is T-12P's own, extended: sign-up never authenticates anybody, and only a
 * CURRENT explicit completion — now a sign-in OR an Email verification — may establish an identity.
 * A stale verification must lose to the reader's later instruction exactly as a stale sign-in does.
 */
import { createMobileAuthAuthority, type MobileAuthState } from '../auth/mobile-auth-authority';
import { createManualForegroundSignal } from '../lifecycle/foreground-signal';
import { authPortDouble } from '../__fixtures__/runtime-entry';

const ALICE = { userId: 'alice', accessToken: 'token-alice-1' };
const BOB = { userId: 'bob', accessToken: 'token-bob-1' };
const IDENTITY = { name: 'أليس', loginId: 'alice.q' };

function build() {
  const port = authPortDouble(null);
  const authority = createMobileAuthAuthority({ port, foreground: createManualForegroundSignal('ACTIVE') });
  const seen: MobileAuthState[] = [];
  authority.subscribe((state) => seen.push(state));
  return { port, authority, seen };
}

test('sign-up hands the port the four approved fields and authenticates nobody', async () => {
  const { port, authority, seen } = build();
  await authority.start();
  const result = await authority.signUp('alice@example.test', 'pw-exact ', IDENTITY);
  expect(result).toEqual({ ok: true });
  expect(port.signUps).toEqual([{ email: 'alice@example.test', password: 'pw-exact ', identity: IDENTITY }]);
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
  expect(seen.some((state) => state.kind === 'AUTHENTICATED')).toBe(false);
});

test('a refused sign-up is reported by kind and changes no state', async () => {
  const { port, authority } = build();
  await authority.start();
  port.signUpWith({ ok: false, failure: { kind: 'REFUSED', detail: 'provider words' } });
  expect(await authority.signUp('alice@example.test', 'pw', IDENTITY)).toEqual({ ok: false, failure: { kind: 'REFUSED', detail: 'provider words' } });
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
});

test('a verified Email code is the explicit completion that establishes the first identity', async () => {
  const { port, authority } = build();
  await authority.start();
  port.verifyWith({ ok: true, value: ALICE });
  const result = await authority.verifyEmailCode('alice@example.test', '123456');
  expect(result.ok).toBe(true);
  expect(authority.getState()).toEqual({ kind: 'AUTHENTICATED', ...ALICE, authGeneration: 1 });
});

test('a rejected code leaves the reader signed out', async () => {
  const { port, authority } = build();
  await authority.start();
  port.verifyWith({ ok: false, failure: { kind: 'CODE_REJECTED', detail: 'Token has expired or is invalid' } });
  const result = await authority.verifyEmailCode('alice@example.test', '000000');
  expect(result).toEqual({ ok: false, failure: { kind: 'CODE_REJECTED', detail: 'Token has expired or is invalid' } });
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
});

test('RACE — a verification still in flight when the reader signs out does not authenticate them', async () => {
  // The SDK emits SIGNED_IN to the subscriber before verifyOtp resolves; both the observed event and
  // the late explicit completion must lose to the later sign-out.
  const { port, authority, seen } = build();
  await authority.start();
  const opened = port.blockVerify(ALICE);
  const verifying = authority.verifyEmailCode('alice@example.test', '123456');
  await authority.signOut();
  opened.open();
  await verifying;
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
  expect(seen.some((state) => state.kind === 'AUTHENTICATED')).toBe(false);
});

test('RACE — a later sign-up supersedes a verification still in flight', async () => {
  const { port, authority } = build();
  await authority.start();
  const opened = port.blockVerify(ALICE);
  const verifying = authority.verifyEmailCode('alice@example.test', '123456');
  await authority.signUp('bob@example.test', 'pw', { name: 'Bob', loginId: 'bob.q' });
  opened.open();
  await verifying;
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
});

test('RACE — an abandoned verification’s persisted session is discarded, so no later launch restores it', async () => {
  const { port, authority } = build();
  await authority.start();
  const signOut = jest.spyOn(port, 'signOut');
  const opened = port.blockVerify(ALICE);
  const verifying = authority.verifyEmailCode('alice@example.test', '123456');
  await authority.signUp('bob@example.test', 'pw', { name: 'Bob', loginId: 'bob.q' });
  expect(signOut).not.toHaveBeenCalled();
  opened.open();
  await verifying;
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
});

test('a current verification discards nothing', async () => {
  const { port, authority } = build();
  await authority.start();
  const signOut = jest.spyOn(port, 'signOut');
  port.verifyWith({ ok: true, value: BOB });
  await authority.verifyEmailCode('bob@example.test', '222222');
  expect(signOut).not.toHaveBeenCalled();
  expect(authority.getState()).toEqual({ kind: 'AUTHENTICATED', ...BOB, authGeneration: 1 });
});

test('RACE — a sign-in still in flight is superseded by a sign-up', async () => {
  const { port, authority } = build();
  await authority.start();
  const opened = port.blockSignIn(ALICE);
  const signingIn = authority.signInWithPassword('alice@example.test', 'pw');
  await authority.signUp('alice@example.test', 'pw', IDENTITY);
  opened.open();
  await signingIn;
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
});

test('an observed SIGNED_IN alone never crosses the retired barrier — not even one a verification caused', async () => {
  const { port, authority } = build();
  await authority.start();
  port.emit(ALICE, 'SIGNED_IN');
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
});

test('resend passes through, establishes nothing and supersedes no verification in flight', async () => {
  const { port, authority } = build();
  await authority.start();
  port.resendWith({ ok: false, failure: { kind: 'REFUSED', detail: 'For security purposes, you can only request this after 42 seconds.' } });
  const opened = port.blockVerify(ALICE);
  const verifying = authority.verifyEmailCode('alice@example.test', '123456');
  const resent = await authority.resendEmailCode('alice@example.test');
  expect(resent.ok).toBe(false);
  opened.open();
  await verifying;
  expect(authority.getState()).toEqual({ kind: 'AUTHENTICATED', ...ALICE, authGeneration: 1 });
});

test('a disposed authority creates, verifies and sends nothing', async () => {
  const { port, authority } = build();
  await authority.start();
  authority.dispose();
  expect((await authority.signUp('a@example.test', 'pw', IDENTITY)).ok).toBe(false);
  expect((await authority.verifyEmailCode('a@example.test', '123456')).ok).toBe(false);
  expect((await authority.resendEmailCode('a@example.test')).ok).toBe(false);
  expect(port.signUps).toEqual([]);
});

test('an authenticated reader cannot sign up or verify a second identity from here', async () => {
  const port = authPortDouble(ALICE);
  const authority = createMobileAuthAuthority({ port, foreground: createManualForegroundSignal('ACTIVE') });
  await authority.start();
  expect((await authority.signUp('b@example.test', 'pw', IDENTITY)).ok).toBe(false);
  expect((await authority.verifyEmailCode('b@example.test', '123456')).ok).toBe(false);
  expect(port.signUps).toEqual([]);
  expect(authority.getState()).toEqual({ kind: 'AUTHENTICATED', ...ALICE, authGeneration: 1 });
});

test('a password sign-in the provider reports as EMAIL_NOT_CONFIRMED leaves the reader signed out', async () => {
  const { port, authority } = build();
  await authority.start();
  port.signInWith({ ok: false, failure: { kind: 'EMAIL_NOT_CONFIRMED', detail: 'Email not confirmed' } });
  const result = await authority.signInWithPassword('alice@example.test', 'pw');
  expect(result).toEqual({ ok: false, failure: { kind: 'EMAIL_NOT_CONFIRMED', detail: 'Email not confirmed' } });
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
});
