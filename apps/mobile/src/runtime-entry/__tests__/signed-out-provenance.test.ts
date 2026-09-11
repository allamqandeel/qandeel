/**
 * AC-02 — where SIGNED_OUT can come from, and where it cannot.
 *
 * A physical validation session reached `SIGNED_OUT` roughly 90 minutes after sign-in. No logcat was
 * retained, so the device event itself cannot be replayed. What CAN be settled deterministically is
 * the question that decides whether it is a Product defect: does this runtime have any way to sign a
 * reader out on its own?
 *
 * It does not, and these prove it rather than assert it:
 *
 *   - the layer holds no clock and no expiry field, so elapsed time is not an input to it at all;
 *   - after `start()`, SIGNED_OUT has exactly TWO sources — an explicit `signOut()` command, and the
 *     SDK delivering a null session — and the Product build reaches neither by itself, because it
 *     ships no sign-in or sign-out surface (`t12-integration-contract` proves the validation harness
 *     is unreachable from the Product route, transitively);
 *   - a null session from the SDK IS honoured, immediately and whatever event kind carries it, so
 *     this runtime is a faithful observer and not a filter that could mask one.
 *
 * Which leaves the SDK, and above it the auth service, as the only possible origin of the observed
 * event. That is the classification, and it is a source fact rather than a hypothesis about a device.
 */
import { createMobileRuntimeEntry } from '../mobile-runtime-entry';
import { createMobileAuthAuthority, type MobileAuthState } from '../auth/mobile-auth-authority';
import { createManualForegroundSignal } from '../lifecycle/foreground-signal';
import { TEST_CONFIG, authPortDouble, httpDouble, serveHappyPath, settle } from '../__fixtures__/runtime-entry';

const ALICE = { userId: 'alice', accessToken: 'token-alice-1' };

function build(initial = ALICE) {
  const port = authPortDouble(initial);
  const foreground = createManualForegroundSignal('ACTIVE');
  const seen: MobileAuthState[] = [];
  const authority = createMobileAuthAuthority({ port, foreground });
  authority.subscribe((state) => seen.push(state));
  return { port, foreground, authority, seen };
}

test('AC-02.1 — a long foregrounded life of repeated refreshes never becomes SIGNED_OUT', async () => {
  const { port, authority, seen } = build();
  await authority.start();

  // Sixty refreshes is far more than a real hour of `AUTO_REFRESH_TICK_DURATION` ticks would produce.
  // Elapsed time is not modelled here because the runtime does not model it either — see AC-02.2.
  for (let tick = 2; tick <= 61; tick += 1) {
    port.emit({ userId: 'alice', accessToken: `token-alice-${tick}` });
  }
  await settle();

  expect(authority.getState()).toEqual({
    kind: 'AUTHENTICATED',
    userId: 'alice',
    accessToken: 'token-alice-61',
    authGeneration: 1,
  });
  // Not once, at any point, did the runtime decide the reader was signed out.
  expect(seen.filter((state) => state.kind === 'SIGNED_OUT')).toEqual([]);
  expect(seen.filter((state) => state.kind === 'ERROR')).toEqual([]);
});

test('AC-02.2 — the runtime holds no expiry clock, so elapsed time cannot sign anybody out', async () => {
  const { port, authority } = build();
  await authority.start();
  const before = authority.getState();

  // Jump the wall clock an hour past any plausible access-token lifetime. Nothing observes it.
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 3_600_000 * 4;
    await settle();
    expect(authority.getState()).toEqual(before);
    // And a refresh arriving "after" that jump is still an ordinary refresh.
    port.emit({ userId: 'alice', accessToken: 'token-alice-late' });
    await settle();
  } finally {
    Date.now = realNow;
  }

  const state = authority.getState();
  expect(state.kind).toBe('AUTHENTICATED');
  if (state.kind !== 'AUTHENTICATED') throw new Error('unreachable');
  expect(state.accessToken).toBe('token-alice-late');
  expect(state.authGeneration).toBe(1);
});

test('AC-02.3 — backgrounding stops the refresh loop and signs nobody out', async () => {
  const { port, foreground, authority, seen } = build();
  await authority.start();
  expect(port.autoRefresh.started).toBeGreaterThan(0);

  const stoppedBefore = port.autoRefresh.stopped;
  foreground.set('INACTIVE');
  expect(port.autoRefresh.stopped).toBeGreaterThan(stoppedBefore);
  // A backgrounded reader is still an authenticated reader. Stopping the loop is not a sign-out.
  expect(authority.getState().kind).toBe('AUTHENTICATED');

  const startedBefore = port.autoRefresh.started;
  foreground.set('ACTIVE');
  expect(port.autoRefresh.started).toBeGreaterThan(startedBefore);
  expect(authority.getState()).toMatchObject({ kind: 'AUTHENTICATED', userId: 'alice', authGeneration: 1 });
  expect(seen.filter((state) => state.kind === 'SIGNED_OUT')).toEqual([]);
});

test('AC-02.4 — a null session from the SDK IS honoured, whatever kind carries it', async () => {
  // The SDK removes the session and notifies when a refresh fails non-retryably — which is how an
  // auth-service-side revocation reaches a client. A runtime that filtered this would hide it.
  for (const kind of ['SIGNED_OUT', 'OTHER', 'USER_UPDATED'] as const) {
    const { port, authority } = build();
    await authority.start();
    expect(authority.getState().kind).toBe('AUTHENTICATED');

    port.emit(null, kind);
    await settle();

    expect(authority.getState()).toEqual({ kind: 'SIGNED_OUT' });
  }
});

test('AC-02.5 — an SDK sign-out retires the runtime generation exactly once and does not re-bootstrap', async () => {
  const http = httpDouble();
  serveHappyPath(http);
  const port = authPortDouble(ALICE);
  const built = createMobileRuntimeEntry({
    config: TEST_CONFIG,
    authPort: port,
    foreground: createManualForegroundSignal('ACTIVE'),
    httpFetch: http.fetch,
  });
  if (!built.ok) throw new Error('the test config must build');
  const runtime = built.runtime;
  await runtime.start();
  await runtime.bootstrap();
  const before = runtime.currentRuntimeGeneration();

  port.emit(null, 'SIGNED_OUT');
  await settle();

  expect(runtime.currentRuntimeGeneration()).toBe(before + 1);
  // A signed-out runtime bootstraps nothing: no second Session is created while nobody is signed in.
  const result = await runtime.bootstrap();
  expect(result).toEqual({ kind: 'FAILED', failure: { kind: 'NOT_AUTHENTICATED' } });
  expect(http.creates()).toHaveLength(1);
  // And it stays retired rather than oscillating.
  await settle();
  expect(runtime.currentRuntimeGeneration()).toBe(before + 1);
  runtime.dispose();
});
