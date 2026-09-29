/**
 * W2-01 — the final account access lifecycle on the REAL auth authority over the T-12P port double.
 *
 *   - the final sign-in: ONE identifier, routed to the Email or the Login ID path, converging failures,
 *     and a superseded Login ID sign-in that can never establish an identity;
 *   - password recovery: its temporary authority is held by the authority alone, never becomes a state,
 *     is retired on use, supersession, abandonment, authentication and disposal, and ends signed out;
 *   - session end versus unknown: a PROVED ended session is `SIGNED_OUT` with `sessionEnded`; a cold
 *     start and an explicit sign-out never are; an unverifiable session is `ERROR`, never signed out, and
 *     only an explicit retry re-asks the authoritative restore.
 */
import { createManualForegroundSignal, createMobileAuthAuthority, type MobileAuthState } from '..';
import { authPortDouble, gate, settle, type AuthPortDouble } from '../__fixtures__/runtime-entry';

const ALICE = { userId: 'alice', accessToken: 'token-a' };

function build(initial: { userId: string; accessToken: string } | null = null, configure?: (port: AuthPortDouble) => void) {
  const port = authPortDouble(initial);
  configure?.(port);
  const authority = createMobileAuthAuthority({ port, foreground: createManualForegroundSignal('ACTIVE') });
  const seen: MobileAuthState[] = [];
  authority.subscribe((state) => seen.push(state));
  return { port, authority, seen };
}

describe('the final sign-in — one identifier, two routes, one set of answers', () => {
  it('an identifier with @ is an Email and goes to the provider directly; anything else is a Login ID', async () => {
    const { port, authority } = build();
    await authority.start();
    await authority.signInWithIdentifier('Mohamed.Allam87', 'pw');
    expect(port.loginIdSignIns).toEqual([{ loginId: 'Mohamed.Allam87', password: 'pw' }]);
    expect(authority.getState()).toMatchObject({ kind: 'AUTHENTICATED', userId: 'user-for-mohamed.allam87', authGeneration: 1 });

    const second = build();
    await second.authority.start();
    await second.authority.signInWithIdentifier('reader@example.test', 'pw');
    expect(second.port.loginIdSignIns).toEqual([]);
    expect(second.authority.getState()).toMatchObject({ kind: 'AUTHENTICATED', userId: 'user-for-reader@example.test' });
  });

  it('a refused Login ID and a refused Email are the SAME answer, and both leave the reader signed out', async () => {
    const byLoginId = build(null, (port) => port.loginIdSignInWith({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: 'x' } }));
    await byLoginId.authority.start();
    const loginIdAnswer = await byLoginId.authority.signInWithIdentifier('nobody.here', 'wrong');
    const byEmail = build(null, (port) => port.signInWith({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: 'y' } }));
    await byEmail.authority.start();
    const emailAnswer = await byEmail.authority.signInWithIdentifier('nobody@example.test', 'wrong');
    expect(!loginIdAnswer.ok && loginIdAnswer.failure.kind).toBe('INVALID_CREDENTIALS');
    expect(!emailAnswer.ok && emailAnswer.failure.kind).toBe('INVALID_CREDENTIALS');
    expect(byLoginId.authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
    expect(byEmail.authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
  });

  it('W2-01 R1 — an unconfirmed Email reached by Login ID is the bare kind: no Email in the answer or in any state', async () => {
    const { authority, seen } = build(null, (port) => port.loginIdSignInWith({ ok: false, failure: { kind: 'EMAIL_NOT_CONFIRMED', detail: 'email not confirmed' } }));
    await authority.start();
    const answer = await authority.signInWithIdentifier('mona.ali', 'correct');
    expect(answer).toStrictEqual({ ok: false, failure: { kind: 'EMAIL_NOT_CONFIRMED', detail: 'email not confirmed' } });
    expect(authority.getState().kind).toBe('SIGNED_OUT');
    expect(JSON.stringify([answer, authority.getState(), ...seen])).not.toContain('@');
  });

  it('a Login ID sign-in superseded while in flight never establishes the identity, and its adopted session is discarded', async () => {
    const { port, authority } = build();
    await authority.start();
    const opened = port.blockLoginIdSignIn({ userId: 'mallory', accessToken: 'token-m' });
    const inFlight = authority.signInWithIdentifier('mallory.id', 'pw');
    // The reader's later explicit instruction: a sign-in by Email that is refused.
    port.signInWith({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: 'x' } });
    await authority.signInWithIdentifier('someone@example.test', 'wrong');
    opened.open();
    await inFlight;
    await settle();
    expect(authority.getState().kind).toBe('SIGNED_OUT');
    // The SDK had already saved the session it adopted; while nobody is authenticated it is discarded.
    expect(port.signOutCount()).toBe(1);
  });
});

describe('W2-01 R1 — Login-ID-origin Email verification, under the same epoch rules as Email verification', () => {
  it('a verified code establishes the identity through the ONE authority: one generation, the Login ID sent, never an Email', async () => {
    const { port, authority, seen } = build();
    await authority.start();
    expect(await authority.verifyLoginIdEmailCode('Mona.Ali', '123456')).toEqual({ ok: true, value: { userId: 'user-for-mona.ali', accessToken: 'token-for-mona.ali' } });
    expect(port.loginIdVerifications).toEqual([{ loginId: 'Mona.Ali', code: '123456' }]);
    expect(authority.getState()).toEqual({ kind: 'AUTHENTICATED', userId: 'user-for-mona.ali', accessToken: 'token-for-mona.ali', authGeneration: 1 });
    expect(seen.filter((state) => state.kind === 'AUTHENTICATED')).toHaveLength(1);
    // The observed SIGNED_IN met the retired barrier; only the explicit completion established.
    expect(JSON.stringify(seen)).not.toContain('@');
  });

  it('a rejected code leaves the reader signed out, and nothing is published', async () => {
    const { port, authority, seen } = build();
    await authority.start();
    const before = seen.length;
    port.verifyWith({ ok: false, failure: { kind: 'CODE_REJECTED', detail: 'refused' } });
    expect(await authority.verifyLoginIdEmailCode('mona.ali', '000000')).toEqual({ ok: false, failure: { kind: 'CODE_REJECTED', detail: 'refused' } });
    expect(seen.length).toBe(before);
    expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
  });

  it('a verification superseded while in flight never establishes, and its adopted session is discarded', async () => {
    const { port, authority } = build();
    await authority.start();
    const opened = port.blockVerify({ userId: 'mona', accessToken: 'token-mona' });
    const inFlight = authority.verifyLoginIdEmailCode('mona.ali', '123456');
    // The reader's later explicit instruction: a refused sign-in by Email.
    port.signInWith({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: 'x' } });
    await authority.signInWithIdentifier('someone@example.test', 'wrong');
    opened.open();
    await inFlight;
    await settle();
    expect(authority.getState().kind).toBe('SIGNED_OUT');
    expect(port.signOutCount()).toBe(1);
  });

  it('refused beside an identity and after disposal; resend asks with the Login ID only and establishes nothing', async () => {
    const signedIn = build(ALICE);
    await signedIn.authority.start();
    expect(await signedIn.authority.verifyLoginIdEmailCode('mona.ali', '123456')).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'UNEXPECTED' }) });
    expect(signedIn.port.loginIdVerifications).toEqual([]);

    const { port, authority, seen } = build();
    await authority.start();
    const before = seen.length;
    expect(await authority.resendLoginIdEmailCode('mona.ali')).toEqual({ ok: true });
    expect(port.loginIdResends).toEqual(['mona.ali']);
    expect(seen.length).toBe(before);
    authority.dispose();
    expect((await authority.verifyLoginIdEmailCode('mona.ali', '123456')).ok).toBe(false);
    expect((await authority.resendLoginIdEmailCode('mona.ali')).ok).toBe(false);
    expect(port.loginIdVerifications).toEqual([]);
    expect(port.loginIdResends).toEqual(['mona.ali']);
  });
});
describe('password recovery — a temporary authority that never becomes an identity', () => {
  it('request → code → new password ends signed out: nothing is ever published, and the grant is retired', async () => {
    const { port, authority, seen } = build();
    await authority.start();
    const before = seen.length;
    expect(await authority.requestPasswordRecovery('reader@example.test')).toEqual({ ok: true });
    expect(await authority.verifyRecoveryCode('reader@example.test', '123456')).toEqual({ ok: true });
    // The entry learns only that the code verified. No state change at all — not AUTHENTICATED, not anything.
    expect(seen.length).toBe(before);
    expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
    expect(await authority.completePasswordRecovery('new secret')).toEqual({ ok: true });
    expect(port.recovery.updates).toEqual([{ grant: { accessToken: 'recovery-access', refreshToken: 'recovery-refresh' }, password: 'new secret' }]);
    expect(port.recovery.retired).toHaveLength(1);
    expect(seen.length).toBe(before);
    expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
    // Used once: a second update has no authority behind it.
    expect(await authority.completePasswordRecovery('again')).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'UNEXPECTED' }) });
    expect(port.recovery.updates).toHaveLength(1);
  });

  it('there is no recovery authority without a verified code', async () => {
    const { port, authority } = build();
    await authority.start();
    expect((await authority.completePasswordRecovery('new')).ok).toBe(false);
    port.recoveryCodeWith({ ok: false, failure: { kind: 'CODE_REJECTED', detail: 'otp_expired' } });
    expect(await authority.verifyRecoveryCode('reader@example.test', '000000')).toEqual({ ok: false, failure: { kind: 'CODE_REJECTED', detail: 'otp_expired' } });
    expect((await authority.completePasswordRecovery('new')).ok).toBe(false);
    expect(port.recovery.updates).toEqual([]);
  });

  it('a later explicit command supersedes a verified code: the authority is refused and retired', async () => {
    const { port, authority } = build();
    await authority.start();
    await authority.verifyRecoveryCode('reader@example.test', '123456');
    port.signInWith({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: 'x' } });
    await authority.signInWithIdentifier('reader@example.test', 'wrong');
    expect(await authority.completePasswordRecovery('new')).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'UNEXPECTED' }) });
    expect(port.recovery.updates).toEqual([]);
    expect(port.recovery.retired).toHaveLength(1);
  });

  it('a recovery code verified AFTER a later explicit command is retired at once and never held', async () => {
    const { port, authority } = build();
    await authority.start();
    const opened = port.blockRecoveryCode();
    const pending = authority.verifyRecoveryCode('reader@example.test', '123456');
    port.signInWith({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: 'x' } });
    await authority.signInWithIdentifier('reader@example.test', 'wrong');
    opened.open();
    expect(await pending).toEqual({ ok: false, failure: expect.objectContaining({ kind: 'UNEXPECTED' }) });
    expect(port.recovery.retired).toHaveLength(1);
    expect((await authority.completePasswordRecovery('new')).ok).toBe(false);
    expect(port.recovery.updates).toEqual([]);
  });

  it('establishing an identity retires a held recovery authority; so do abandonment and disposal', async () => {
    const signedIn = build();
    await signedIn.authority.start();
    await signedIn.authority.verifyRecoveryCode('reader@example.test', '123456');
    await signedIn.authority.signInWithIdentifier('reader@example.test', 'old password still valid');
    expect(signedIn.authority.getState().kind).toBe('AUTHENTICATED');
    expect(signedIn.port.recovery.retired).toHaveLength(1);

    const abandoned = build();
    await abandoned.authority.start();
    await abandoned.authority.verifyRecoveryCode('reader@example.test', '123456');
    abandoned.authority.abandonPasswordRecovery();
    expect(abandoned.port.recovery.retired).toHaveLength(1);
    expect((await abandoned.authority.completePasswordRecovery('new')).ok).toBe(false);

    const disposed = build();
    await disposed.authority.start();
    await disposed.authority.verifyRecoveryCode('reader@example.test', '123456');
    disposed.authority.dispose();
    expect(disposed.port.recovery.retired).toHaveLength(1);
  });

  it('recovery is refused beside an authenticated identity', async () => {
    const { port, authority } = build(ALICE);
    await authority.start();
    expect(authority.getState().kind).toBe('AUTHENTICATED');
    expect((await authority.verifyRecoveryCode('alice@example.test', '123456')).ok).toBe(false);
    expect(port.recovery.verifications).toEqual([]);
  });

  it('a password the provider refuses keeps the SAME authority for another try, until it is superseded', async () => {
    const { port, authority } = build();
    await authority.start();
    await authority.verifyRecoveryCode('reader@example.test', '123456');
    port.passwordUpdateWith({ ok: false, failure: { kind: 'WEAK_PASSWORD', detail: 'weak_password' } });
    expect(await authority.completePasswordRecovery('123')).toEqual({ ok: false, failure: { kind: 'WEAK_PASSWORD', detail: 'weak_password' } });
    port.passwordUpdateWith({ ok: true });
    expect(await authority.completePasswordRecovery('a much better one')).toEqual({ ok: true });
    expect(port.recovery.updates.map((update) => update.password)).toEqual(['123', 'a much better one']);
  });
});

describe('session end versus unknown — Unknown is not Signed Out', () => {
  it('a cold start with no session is a plain SIGNED_OUT — no ended-session claim', async () => {
    const { authority } = build();
    await authority.start();
    expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
  });

  it('a restore the provider PROVED ended is SIGNED_OUT with the evidence', async () => {
    const { authority } = build(null, (port) => port.restoreWith({ ok: false, failure: { kind: 'SESSION_ENDED', detail: 'refresh refused' } }));
    await authority.start();
    expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT', sessionEnded: true });
  });

  it('a live identity whose session the provider removed is SIGNED_OUT with the evidence', async () => {
    const { port, authority } = build(ALICE);
    await authority.start();
    port.emit(null, 'SIGNED_OUT');
    await settle();
    expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT', sessionEnded: true });
  });

  it('an explicit sign-out never claims the session ended — even though the SDK emits the same SIGNED_OUT', async () => {
    const { port, authority, seen } = build(ALICE);
    await authority.start();
    const signingOut = authority.signOut();
    // The SDK's own SIGNED_OUT for the sign-out the reader asked for, arriving while it is in flight.
    port.emit(null, 'SIGNED_OUT');
    await signingOut;
    expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
    expect(seen.some((state) => state.kind === 'SIGNED_OUT' && state.sessionEnded === true)).toBe(false);
  });

  it('a technical restore failure is ERROR — not signed out — and the session is not cleared', async () => {
    const { port, authority } = build(null, (p) => p.restoreWith({ ok: false, failure: { kind: 'NETWORK', detail: 'offline' } }));
    await authority.start();
    expect(authority.getState()).toEqual({ kind: 'ERROR', failure: { kind: 'NETWORK', detail: 'offline' } });
    expect(port.signOutCount()).toBe(0);
  });

  it('Retry re-asks the authoritative restore: restored → authenticated ONCE, as the first restore would have', async () => {
    const { port, authority, seen } = build(null, (p) => p.restoreWith({ ok: false, failure: { kind: 'NETWORK', detail: 'offline' } }));
    await authority.start();
    port.restoreWith({ ok: true, value: ALICE });
    await authority.retrySessionVerification();
    expect(authority.getState()).toEqual({ kind: 'AUTHENTICATED', userId: 'alice', accessToken: 'token-a', authGeneration: 1 });
    expect(port.restoreCount()).toBe(2);
    // Never back through RESTORING, and never a second generation.
    expect(seen.map((state) => state.kind)).toEqual(['ERROR', 'AUTHENTICATED']);
  });

  it('Retry that proves the session ended reaches SIGNED_OUT with the evidence; one still unknown stays ERROR', async () => {
    const { port, authority } = build(null, (p) => p.restoreWith({ ok: false, failure: { kind: 'UNEXPECTED', detail: '503' } }));
    await authority.start();
    await authority.retrySessionVerification();
    expect(authority.getState().kind).toBe('ERROR');
    port.restoreWith({ ok: false, failure: { kind: 'SESSION_ENDED', detail: 'refresh refused' } });
    await authority.retrySessionVerification();
    expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT', sessionEnded: true });
  });

  it('Retry is refused outside the unknown state, and two presses are one re-verification', async () => {
    const { port, authority } = build(null, (p) => p.restoreWith({ ok: false, failure: { kind: 'NETWORK', detail: 'offline' } }));
    await authority.start();
    const [a, b] = [authority.retrySessionVerification(), authority.retrySessionVerification()];
    await Promise.all([a, b]);
    expect(port.restoreCount()).toBe(2);
    port.restoreWith({ ok: true, value: null });
    await authority.retrySessionVerification();
    expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
    const count = port.restoreCount();
    await authority.retrySessionVerification();
    expect(port.restoreCount()).toBe(count);
  });

  it('a gate held open proves nothing leaks: an unfinished retry after disposal changes nothing', async () => {
    const { port, authority } = build(null, (p) => p.restoreWith({ ok: false, failure: { kind: 'NETWORK', detail: 'offline' } }));
    await authority.start();
    const held = gate();
    const original = port.restoreSession;
    port.restoreSession = async () => {
      await held.wait();
      return original();
    };
    port.restoreWith({ ok: true, value: ALICE });
    const retry = authority.retrySessionVerification();
    authority.dispose();
    held.open();
    await retry;
    expect(authority.getState().kind).toBe('ERROR');
  });
});
