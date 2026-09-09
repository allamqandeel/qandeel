/** T-12P adversarial matrix — Config / auth, P05…P12. */
import { createMobileAuthAuthority, type MobileAuthState } from '../auth/mobile-auth-authority';
import { createManualForegroundSignal } from '../lifecycle/foreground-signal';
import { authPortDouble, gate, settle } from '../__fixtures__/runtime-entry';

const ALICE = { userId: 'alice', accessToken: 'token-alice-1' };
const ALICE_REFRESHED = { userId: 'alice', accessToken: 'token-alice-2' };
const BOB = { userId: 'bob', accessToken: 'token-bob-1' };

function build(initial: { userId: string; accessToken: string } | null = null) {
  const port = authPortDouble(initial);
  const foreground = createManualForegroundSignal('ACTIVE');
  const authority = createMobileAuthAuthority({ port, foreground });
  const seen: MobileAuthState[] = [];
  authority.subscribe((state) => seen.push(state));
  return { port, foreground, authority, seen };
}

test('P06 — RESTORING resolves to SIGNED_OUT when nothing is persisted', async () => {
  const { authority } = build(null);
  expect(authority.getState()).toEqual({ kind: 'RESTORING' });
  await authority.start();
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
});

test('P07 — RESTORING resolves to AUTHENTICATED when a session is persisted', async () => {
  const { authority } = build(ALICE);
  await authority.start();
  expect(authority.getState()).toEqual({ kind: 'AUTHENTICATED', ...ALICE, authGeneration: 1 });
});

test('a restore failure is a typed ERROR, never a silent sign-out', async () => {
  const { port, authority } = build(null);
  port.restoreWith({ ok: false, failure: { kind: 'NETWORK', detail: 'offline' } });
  await authority.start();
  expect(authority.getState()).toEqual({ kind: 'ERROR', failure: { kind: 'NETWORK', detail: 'offline' } });
});

test('P08 — a token refresh updates the credential and keeps the SAME auth generation', async () => {
  const { port, authority } = build(ALICE);
  await authority.start();
  const before = authority.getState();
  port.emit(ALICE_REFRESHED);
  const after = authority.getState();
  if (before.kind !== 'AUTHENTICATED' || after.kind !== 'AUTHENTICATED') throw new Error('unreachable');
  expect(after.accessToken).toBe('token-alice-2');
  // The generation is what decides whether a second conversation Session is created. It must not move.
  expect(after.authGeneration).toBe(before.authGeneration);
});

test('a redundant emit of the identical credential publishes nothing', async () => {
  const { port, authority, seen } = build(ALICE);
  await authority.start();
  const count = seen.length;
  port.emit(ALICE);
  expect(seen.length).toBe(count);
});

test('P10 — a different user retires the old generation and starts a new one', async () => {
  const { port, authority } = build(ALICE);
  await authority.start();
  port.emit(BOB);
  const state = authority.getState();
  if (state.kind !== 'AUTHENTICATED') throw new Error('unreachable');
  expect(state.userId).toBe('bob');
  expect(state.authGeneration).toBe(2);
});

test('P09 — sign-out invalidates the identity and a stale callback cannot resurrect it', async () => {
  const { port, authority } = build(ALICE);
  await authority.start();
  await authority.signOut();
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });

  // A callback that was already in flight when the sign-out ran delivers the retired credential.
  port.emit(ALICE);
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
});

test('R1-01 — the retired epoch does not survive a later authentication', async () => {
  // Signing out must not permanently poison the authority: once a genuine SIGNED_IN is accepted,
  // ordinary refresh callbacks work again.
  const { port, authority } = build(ALICE);
  await authority.start();
  await authority.signOut();
  port.emit(ALICE, 'SIGNED_IN');
  port.emit(ALICE_REFRESHED, 'TOKEN_REFRESHED');
  const state = authority.getState();
  if (state.kind !== 'AUTHENTICATED') throw new Error('unreachable');
  expect(state.accessToken).toBe('token-alice-2');
  // A refresh is not a new identity.
  expect(state.authGeneration).toBe(2);
});

test('R1-01 — a refresh callback from the retired epoch cannot resurrect a signed-out identity', async () => {
  // THE DISCRIMINATING CASE. Candidate 050f19c suppressed only the exact {userId, accessToken} pair
  // that was signed out. A token refresh already in flight when the sign-out ran completes with the
  // SAME user and a DIFFERENT token, so the pair never matched and the identity came back.
  // Provenance, not token equality, is what tells the two apart.
  const { port, authority } = build(ALICE);
  await authority.start();
  const beforeSignOut = authority.getState();
  if (beforeSignOut.kind !== 'AUTHENTICATED') throw new Error('unreachable');

  await authority.signOut();
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });

  // The refresh that was in flight lands AFTER the sign-out, carrying a fresh token.
  port.emit(ALICE_REFRESHED, 'TOKEN_REFRESHED');

  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
});

test('R1-01 — no non-SIGNED_IN provenance can re-authenticate a retired epoch', async () => {
  for (const kind of ['TOKEN_REFRESHED', 'INITIAL', 'USER_UPDATED', 'OTHER'] as const) {
    const { port, authority } = build(ALICE);
    await authority.start();
    await authority.signOut();
    port.emit(ALICE_REFRESHED, kind);
    expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
  }
});

test('R1-01 — the retired epoch is closed before the sign-out round trip completes', async () => {
  // A callback landing WHILE the sign-out request is in flight already belongs to the epoch the
  // reader asked to end, so the epoch is retired before the await rather than after it.
  const port = authPortDouble(ALICE);
  const gateOpen = gate();
  const slow = {
    ...port,
    signOut: async () => {
      await gateOpen.wait();
      return { ok: true as const, value: null };
    },
  };
  const authority = createMobileAuthAuthority({ port: slow, foreground: createManualForegroundSignal('ACTIVE') });
  await authority.start();

  const signingOut = authority.signOut();
  port.emit(ALICE_REFRESHED, 'TOKEN_REFRESHED');
  gateOpen.open();
  await signingOut;

  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
});

test('P09/R1-01 — a genuinely new SIGNED_IN after a sign-out is accepted and increments the generation', async () => {
  const { port, authority } = build(ALICE);
  await authority.start();
  await authority.signOut();
  port.emit(ALICE_REFRESHED, 'SIGNED_IN');
  const state = authority.getState();
  if (state.kind !== 'AUTHENTICATED') throw new Error('unreachable');
  expect(state.accessToken).toBe('token-alice-2');
  expect(state.authGeneration).toBe(2);
});

test('R1-01 — a sign-in still in flight when the reader signs out does not re-authenticate them', async () => {
  // The sign-in result legitimately carries SIGNED_IN provenance, so the epoch rule alone would
  // accept it. The reader's later explicit instruction has to win, which is what the operation
  // epoch is for.
  const port = authPortDouble(null);
  const signInGate = gate();
  const slow = {
    ...port,
    signInWithPassword: async () => {
      await signInGate.wait();
      return { ok: true as const, value: ALICE };
    },
  };
  const authority = createMobileAuthAuthority({ port: slow, foreground: createManualForegroundSignal('ACTIVE') });
  await authority.start();

  const signingIn = authority.signInWithPassword('alice@example.test', 'pw');
  await authority.signOut();
  signInGate.open();
  await signingIn;

  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
});

test('R1-01 — an explicit signInWithPassword after a sign-out is accepted', async () => {
  const { port, authority } = build(ALICE);
  await authority.start();
  await authority.signOut();
  port.signInWith({ ok: true, value: ALICE_REFRESHED });
  const result = await authority.signInWithPassword('alice@example.test', 'pw');
  expect(result.ok).toBe(true);
  const state = authority.getState();
  if (state.kind !== 'AUTHENTICATED') throw new Error('unreachable');
  expect(state.authGeneration).toBe(2);
});

test('sign-out retires the local runtime even when the network call fails', async () => {
  const port = authPortDouble(ALICE);
  const authority = createMobileAuthAuthority({ port, foreground: createManualForegroundSignal('ACTIVE') });
  await authority.start();
  const failing = { ...port, signOut: async () => ({ ok: false as const, failure: { kind: 'NETWORK' as const, detail: 'offline' } }) };
  const local = createMobileAuthAuthority({ port: failing, foreground: createManualForegroundSignal('ACTIVE') });
  await local.start();
  const result = await local.signOut();
  expect(result.ok).toBe(false);
  // Continuing to treat a reader as authenticated after they asked not to be is the worse failure.
  expect(local.getState()).toEqual({ kind: 'SIGNED_OUT' });
});

test('P11 — start() is idempotent: a second call adds no second port listener', async () => {
  const { port, authority } = build(ALICE);
  await authority.start();
  await authority.start();
  await authority.start();
  expect(port.listenerCount()).toBe(1);
});

test('P12 — dispose unsubscribes and no later callback can change state', async () => {
  const { port, authority } = build(ALICE);
  await authority.start();
  authority.dispose();
  expect(port.listenerCount()).toBe(0);
  const frozen = authority.getState();
  port.emit(BOB);
  expect(authority.getState()).toEqual(frozen);
});

test('dispose is idempotent and refuses further commands', async () => {
  const { authority } = build(ALICE);
  await authority.start();
  authority.dispose();
  authority.dispose();
  const signedIn = await authority.signInWithPassword('a@example.test', 'pw');
  expect(signedIn.ok).toBe(false);
  const signedOut = await authority.signOut();
  expect(signedOut.ok).toBe(false);
});

test('auto-refresh runs only while an authenticated identity is foregrounded', async () => {
  const { port, authority, foreground } = build(ALICE);
  await authority.start();
  // Authenticated and foregrounded: refresh is on.
  expect(port.autoRefresh.started).toBeGreaterThan(0);

  const stoppedBefore = port.autoRefresh.stopped;
  foreground.set('INACTIVE');
  // Backgrounded: supabase-js cannot detect foreground off-browser, so its loop must be stopped.
  expect(port.autoRefresh.stopped).toBeGreaterThan(stoppedBefore);

  const startedBefore = port.autoRefresh.started;
  foreground.set('ACTIVE');
  expect(port.autoRefresh.started).toBeGreaterThan(startedBefore);
});

test('auto-refresh is not started for a signed-out reader', async () => {
  const { port, authority } = build(null);
  await authority.start();
  expect(port.autoRefresh.started).toBe(0);
});

test('P05 — no state, error or subscriber payload ever carries a credential the reader did not supply', async () => {
  const { port, authority, seen } = build(null);
  port.restoreWith({ ok: false, failure: { kind: 'UNEXPECTED', detail: 'restore failed' } });
  await authority.start();
  const serialised = JSON.stringify(seen);
  // The only token-shaped value anywhere in the emitted states is the one an AUTHENTICATED state
  // legitimately carries — and there is no authenticated state here at all.
  expect(serialised).not.toContain('token-');
  expect(serialised).not.toContain('refresh');
});

test('P05 — an AUTHENTICATED state carries the access token and never a refresh token', async () => {
  const { authority } = build(ALICE);
  await authority.start();
  const state = authority.getState();
  if (state.kind !== 'AUTHENTICATED') throw new Error('unreachable');
  // The access token is the whole point: it is forwarded to the API. The refresh token is not on
  // the port at all, so it cannot reach state, a log or a snapshot by any route.
  expect(Object.keys(state).sort()).toEqual(['accessToken', 'authGeneration', 'kind', 'userId']);
});

test('a rejected credential leaves the reader signed out rather than erroring', async () => {
  const { port, authority } = build(null);
  await authority.start();
  port.signInWith({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: 'bad password' } });
  const result = await authority.signInWithPassword('a@example.test', 'wrong');
  expect(result.ok).toBe(false);
  expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
});

test('a successful sign-in authenticates through the same acceptance path as a restore', async () => {
  const { authority } = build(null);
  await authority.start();
  const result = await authority.signInWithPassword('alice@example.test', 'pw');
  expect(result.ok).toBe(true);
  await settle();
  const state = authority.getState();
  if (state.kind !== 'AUTHENTICATED') throw new Error('unreachable');
  expect(state.userId).toBe('user-for-alice@example.test');
  expect(state.authGeneration).toBe(1);
});
