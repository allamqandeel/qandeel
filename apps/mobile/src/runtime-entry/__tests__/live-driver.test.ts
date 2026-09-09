/** T-12P adversarial matrix — Live driver, P35…P54, and the cadence owner. */
import { createForegroundLiveDriver, type LiveDriverCredential } from '../live/foreground-live-driver';
import {
  FOREGROUND_CATCH_UP_INTERVAL_MS,
  MAX_CATCH_UP_BACKOFF_MS,
  createCatchUpSchedule,
} from '../live/live-driver-scheduler';
import { TemporalApiClient } from '../../temporal';
import { createManualForegroundSignal, type ManualForegroundSignal } from '../lifecycle/foreground-signal';
import { createMobileRuntimeEntry } from '../mobile-runtime-entry';
import type { CanonicalRuntimeBundle } from '../bootstrap/bootstrap-types';
import {
  SESSION_A,
  SESSION_B,
  TEST_CONFIG,
  authPortDouble,
  committedEvent,
  gate,
  httpDouble,
  liveFocusEvent,
  serveHappyPath,
  settle,
  snapshot,
  timerDouble,
  type HttpDouble,
} from '../__fixtures__/runtime-entry';

const ALICE = { userId: 'alice', accessToken: 'token-alice-1' };
const BASE = TEST_CONFIG.apiBaseUrl;

interface Harness {
  http: HttpDouble;
  bundle: CanonicalRuntimeBundle;
  foreground: ManualForegroundSignal;
  timers: ReturnType<typeof timerDouble>;
  driver: ReturnType<typeof createForegroundLiveDriver>;
  credential: { value: LiveDriverCredential | null };
  current: { value: boolean };
}

/** Bootstrap a real runtime, then attach a driver with every seam under test control. */
async function harness(
  options: { liveHead?: number | null; liveFocusAtSp?: number | null; http?: HttpDouble } = {},
): Promise<Harness> {
  const http = options.http ?? httpDouble();
  const liveHead = options.liveHead === undefined ? 4 : options.liveHead;
  const liveFocusAtSp = options.liveFocusAtSp === undefined ? liveHead : options.liveFocusAtSp;
  serveHappyPath(http, { snapshot: snapshot({ liveHead, liveFocusAtSp }) });
  const built = createMobileRuntimeEntry({
    config: TEST_CONFIG,
    authPort: authPortDouble(ALICE),
    foreground: createManualForegroundSignal('ACTIVE'),
    httpFetch: http.fetch,
  });
  if (!built.ok) throw new Error('the test config must build');
  await built.runtime.start();
  const result = await built.runtime.bootstrap();
  if (result.kind !== 'READY') throw new Error(`bootstrap failed: ${JSON.stringify(result)}`);

  const foreground = createManualForegroundSignal('ACTIVE');
  const timers = timerDouble();
  const credential = { value: { accessToken: 'token-alice-1', authGeneration: 1 } as LiveDriverCredential | null };
  const current = { value: true };
  const driver = createForegroundLiveDriver({
    bundle: result.bundle,
    credential: () => credential.value,
    createTemporalClient: (accessToken) => new TemporalApiClient({ baseUrl: BASE, accessToken, fetch: http.fetch }),
    foreground,
    isCurrent: () => current.value,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    pageLimit: 2,
  });
  return { http, bundle: result.bundle, foreground, timers, driver, credential, current };
}

const eventCalls = (http: HttpDouble) => http.matching('/temporal/events');
const snapshotCalls = (http: HttpDouble) =>
  http.calls.filter((call) => call.url.endsWith('/temporal') && call.method === 'GET');

test('P35/P47 — starting reconciles the authoritative snapshot before any event page', async () => {
  const { http, driver } = await harness();
  const before = http.calls.length;
  driver.start();
  await settle();
  const issued = http.calls.slice(before);
  expect(issued.length).toBeGreaterThan(0);
  expect(issued[0].url.endsWith('/temporal')).toBe(true);
  driver.dispose();
});

test('a quiet Session costs one snapshot request and no event pages', async () => {
  // The snapshot is the target the catch-up aims at, so when the cursor already matches it there is
  // nothing to page for. This is what keeps a five-second cadence cheap.
  const { http, driver } = await harness({ liveHead: 4 });
  driver.start();
  await settle();
  expect(eventCalls(http)).toHaveLength(0);
  expect(http.matching('/temporal/live-focus-events')).toHaveLength(0);
  driver.dispose();
});

test('P37/P42 — committed pages are applied in order and the cursor advances to the last accepted', async () => {
  const http = httpDouble();
  const h = await harness({ liveHead: 4, http });
  // The Session has moved on: the snapshot now reports 8, so the driver must page 5..8.
  http.on('/temporal', () => ({ status: 200, body: snapshot({ liveHead: 8, liveFocusAtSp: 4 }) }));
  const pages = [[committedEvent(5, 6), committedEvent(7, 7)], [committedEvent(8, 8)]];
  let page = 0;
  http.on('/temporal/events', () => {
    const body = { sessionId: SESSION_A, events: pages[page] ?? [] };
    page += 1;
    return { status: 200, body };
  });

  h.driver.start();
  await settle();
  expect(h.bundle.store.getState().live.LH).toBe(8);
  expect(h.driver.getStatus().cursors.committedAfterSp).toBe(8);
  h.driver.dispose();
});

test('P38 — Live Focus pages advance their own cursor independently of the head', async () => {
  const http = httpDouble();
  // The head is already current at 6; only the Live Focus is behind. An LF anchored beyond the
  // Live Head is refused by the frozen snapshot decoder, so the fixture must respect that.
  const h = await harness({ liveHead: 6, http, liveFocusAtSp: 4 });
  http.on('/temporal', () => ({ status: 200, body: snapshot({ liveHead: 6, liveFocusAtSp: 6 }) }));
  http.on('/temporal/live-focus-events', () => ({
    status: 200,
    body: { sessionId: SESSION_A, events: [liveFocusEvent(5, { kind: 'EMERGING', emergingFocusId: 'e-1' }), liveFocusEvent(6, { kind: 'THREAD', threadId: 't-1' })] },
  }));

  h.driver.start();
  await settle();
  expect(h.bundle.store.getState().live.LF).toEqual({ value: { kind: 'ESTABLISHED_THREAD', threadId: 't-1' }, atSp: 6 });
  expect(h.driver.getStatus().cursors.liveFocusAfterSp).toBe(6);
  // The head cursor was already current, so no committed page was requested.
  expect(eventCalls(http)).toHaveLength(0);
  h.driver.dispose();
});

test('P39 — a redelivered event is idempotent and never retracts the mirror', async () => {
  const http = httpDouble();
  const h = await harness({ liveHead: 4, http });
  http.on('/temporal', () => ({ status: 200, body: snapshot({ liveHead: 6, liveFocusAtSp: 4 }) }));
  http.on('/temporal/events', () => ({ status: 200, body: { sessionId: SESSION_A, events: [committedEvent(5, 6)] } }));

  h.driver.start();
  await settle();
  expect(h.bundle.store.getState().live.LH).toBe(6);

  // The same page again: idempotent, and the head does not move backwards.
  h.timers.flush();
  await settle();
  expect(h.bundle.store.getState().live.LH).toBe(6);
  expect(h.driver.getStatus().cursors.committedAfterSp).toBe(6);
  h.driver.dispose();
});

test('P42 — a stale (lower) delivery leaves the mirror untouched and never rewinds the cursor', async () => {
  const http = httpDouble();
  const h = await harness({ liveHead: 4, http });
  http.on('/temporal', () => ({ status: 200, body: snapshot({ liveHead: 9, liveFocusAtSp: 4 }) }));
  http.on('/temporal/events', () => ({
    status: 200,
    // A late low delivery followed by a legitimate one: the seam classifies the first STALE and
    // still applies the second, so the cursor must end at 9 rather than stopping at the stale one.
    body: { sessionId: SESSION_A, events: [committedEvent(2, 2), committedEvent(9, 9)] },
  }));

  h.driver.start();
  await settle();
  expect(h.bundle.store.getState().live.LH).toBe(9);
  expect(h.driver.getStatus().cursors.committedAfterSp).toBe(9);
  h.driver.dispose();
});

test('P41 — a page naming a different Session is refused and writes nothing', async () => {
  const http = httpDouble();
  const h = await harness({ liveHead: 4, http });
  http.on('/temporal', () => ({ status: 200, body: snapshot({ liveHead: 7, liveFocusAtSp: 4 }) }));
  http.on('/temporal/events', () => ({ status: 200, body: { sessionId: SESSION_B, events: [committedEvent(5, 7, SESSION_B)] } }));

  h.driver.start();
  await settle();
  expect(h.bundle.store.getState().live.LH).toBe(4);
  expect(h.driver.getStatus().cursors.committedAfterSp).toBe(4);
  expect(h.driver.getStatus().consecutiveFailures).toBe(1);
  h.driver.dispose();
});

test('P41 — a snapshot naming a different Session is refused', async () => {
  const http = httpDouble();
  const h = await harness({ liveHead: 4, http });
  http.on('/temporal', () => ({ status: 200, body: snapshot({ sessionId: SESSION_B, liveHead: 9 }) }));
  h.driver.start();
  await settle();
  expect(h.bundle.store.getState().live.LH).toBe(4);
  expect(h.driver.getStatus().consecutiveFailures).toBe(1);
  h.driver.dispose();
});

test('P43 — a network failure preserves current truth and stays retryable', async () => {
  const http = httpDouble();
  const h = await harness({ liveHead: 4, http });
  http.failEverything('offline');
  h.driver.start();
  await settle();
  expect(h.bundle.store.getState().live.LH).toBe(4);
  expect(h.driver.getStatus().consecutiveFailures).toBe(1);
  expect(h.driver.getStatus().cursors.committedAfterSp).toBe(4);

  // Recovery needs no reset: the next cycle simply asks again from the last accepted position.
  http.restore();
  http.on('/temporal', () => ({ status: 200, body: snapshot({ liveHead: 6, liveFocusAtSp: 4 }) }));
  http.on('/temporal/events', () => ({ status: 200, body: { sessionId: SESSION_A, events: [committedEvent(5, 6)] } }));
  h.timers.flush();
  await settle();
  expect(h.bundle.store.getState().live.LH).toBe(6);
  expect(h.driver.getStatus().consecutiveFailures).toBe(0);
  h.driver.dispose();
});

test('P44 — a malformed payload preserves current truth', async () => {
  const http = httpDouble();
  const h = await harness({ liveHead: 4, http });
  http.on('/temporal', () => ({ status: 200, body: { sessionId: SESSION_A, liveHead: 'not a number' } }));
  h.driver.start();
  await settle();
  expect(h.bundle.store.getState().live.LH).toBe(4);
  expect(h.driver.getStatus().consecutiveFailures).toBe(1);
  h.driver.dispose();
});

test('P45 — repeated failure backs off, bounded, and never below the cadence', async () => {
  const schedule = createCatchUpSchedule({ random: () => 0 });
  expect(schedule.nextDelayMs(0)).toBe(FOREGROUND_CATCH_UP_INTERVAL_MS);
  // With the jitter floor at 50%, one failure yields exactly the interval; later ones grow.
  expect(schedule.nextDelayMs(1)).toBe(FOREGROUND_CATCH_UP_INTERVAL_MS);
  expect(schedule.nextDelayMs(2)).toBe(FOREGROUND_CATCH_UP_INTERVAL_MS);
  expect(schedule.nextDelayMs(4)).toBeGreaterThan(FOREGROUND_CATCH_UP_INTERVAL_MS);
  for (const failures of [1, 2, 5, 10, 50, 1000]) {
    const delay = schedule.nextDelayMs(failures);
    expect(delay).toBeGreaterThanOrEqual(FOREGROUND_CATCH_UP_INTERVAL_MS);
    expect(delay).toBeLessThanOrEqual(MAX_CATCH_UP_BACKOFF_MS);
  }
});

test('P45 — jitter spreads retries without breaching the ceiling', async () => {
  const high = createCatchUpSchedule({ random: () => 0.999 });
  const low = createCatchUpSchedule({ random: () => 0 });
  expect(high.nextDelayMs(6)).toBeGreaterThan(low.nextDelayMs(6));
  expect(high.nextDelayMs(100)).toBeLessThanOrEqual(MAX_CATCH_UP_BACKOFF_MS);
});

test('the cadence owner refuses an impossible configuration', () => {
  expect(() => createCatchUpSchedule({ intervalMs: 0 })).toThrow(RangeError);
  expect(() => createCatchUpSchedule({ intervalMs: 5000, maxBackoffMs: 1000 })).toThrow(RangeError);
});

test('P36 — a cycle already in flight is never overlapped by another', async () => {
  const http = httpDouble();
  const snapshotGate = gate();
  const h = await harness({ liveHead: 4, http });
  http.on('/temporal', async () => {
    await snapshotGate.wait();
    return { status: 200, body: snapshot({ liveHead: 4, liveFocusAtSp: 4 }) };
  });

  const before = snapshotCalls(http).length;
  h.driver.start();
  await settle();
  // A tick and two explicit requests while the first cycle is still blocked.
  h.timers.flush();
  h.driver.requestImmediateCatchUp();
  h.driver.requestImmediateCatchUp();
  await settle();
  expect(snapshotCalls(http).length - before).toBe(1);

  snapshotGate.open();
  await settle();
  h.driver.dispose();
});

test('P54 — an immediate catch-up requested mid-cycle coalesces into exactly one follow-up', async () => {
  const http = httpDouble();
  const snapshotGate = gate();
  const h = await harness({ liveHead: 4, http });
  // Only the FIRST call blocks: once opened the gate stays open, so the coalesced follow-up runs
  // straight through and the count below distinguishes one follow-up from three.
  http.on('/temporal', async () => {
    await snapshotGate.wait();
    return { status: 200, body: snapshot({ liveHead: 4, liveFocusAtSp: 4 }) };
  });

  const before = snapshotCalls(http).length;
  h.driver.start();
  await settle();
  h.driver.requestImmediateCatchUp();
  h.driver.requestImmediateCatchUp();
  h.driver.requestImmediateCatchUp();
  snapshotGate.open();
  await settle();
  // The blocked cycle, then ONE coalesced follow-up — not three.
  expect(snapshotCalls(http).length - before).toBe(2);
  h.driver.dispose();
});

test('P46/P53 — backgrounding stops the driver and schedules no further poll', async () => {
  const h = await harness({ liveHead: 4 });
  h.driver.start();
  await settle();
  const before = h.http.calls.length;

  h.foreground.set('INACTIVE');
  expect(h.timers.pending()).toBe(0);
  h.timers.flush();
  await settle();
  h.driver.requestImmediateCatchUp();
  await settle();
  expect(h.http.calls.length).toBe(before);
  expect(h.driver.getStatus().foreground).toBe('INACTIVE');
  h.driver.dispose();
});

test('P47 — returning to the foreground reconciles immediately rather than waiting for a tick', async () => {
  const h = await harness({ liveHead: 4 });
  h.driver.start();
  await settle();
  h.foreground.set('INACTIVE');
  const before = snapshotCalls(h.http).length;

  h.foreground.set('ACTIVE');
  await settle();
  expect(snapshotCalls(h.http).length).toBe(before + 1);
  h.driver.dispose();
});

test('P48 — a refreshed token is used by every subsequent request', async () => {
  const h = await harness({ liveHead: 4 });
  h.driver.start();
  await settle();
  expect(snapshotCalls(h.http).at(-1)?.authorization).toBe('Bearer token-alice-1');

  h.credential.value = { accessToken: 'token-alice-2', authGeneration: 1 };
  h.timers.flush();
  await settle();
  expect(snapshotCalls(h.http).at(-1)?.authorization).toBe('Bearer token-alice-2');
  h.driver.dispose();
});

test('P49 — after sign-out the driver issues no request and applies nothing', async () => {
  const http = httpDouble();
  const h = await harness({ liveHead: 4, http });
  http.on('/temporal', () => ({ status: 200, body: snapshot({ liveHead: 9, liveFocusAtSp: 4 }) }));
  http.on('/temporal/events', () => ({ status: 200, body: { sessionId: SESSION_A, events: [committedEvent(5, 9)] } }));

  h.driver.start();
  await settle();
  expect(h.bundle.store.getState().live.LH).toBe(9);

  h.credential.value = null;
  const before = http.calls.length;
  h.timers.flush();
  h.driver.requestImmediateCatchUp();
  await settle();
  expect(http.calls.length).toBe(before);
  h.driver.dispose();
});

test('P50 — a response that arrives after a user replacement is dropped, not applied', async () => {
  const http = httpDouble();
  const snapshotGate = gate();
  const h = await harness({ liveHead: 4, http });
  http.on('/temporal', async () => {
    await snapshotGate.wait();
    return { status: 200, body: snapshot({ liveHead: 9, liveFocusAtSp: 4 }) };
  });
  http.on('/temporal/events', () => ({ status: 200, body: { sessionId: SESSION_A, events: [committedEvent(5, 9)] } }));

  h.driver.start();
  await settle();
  // The identity is replaced while the snapshot is still in flight.
  h.credential.value = { accessToken: 'token-bob-1', authGeneration: 2 };
  snapshotGate.open();
  await settle();

  // Zero old-identity writes: the mirror is exactly where the bootstrap left it.
  expect(h.bundle.store.getState().live.LH).toBe(4);
  expect(eventCalls(http)).toHaveLength(0);
  h.driver.dispose();
});

test('P40/P51 — a response arriving after disposal writes nothing', async () => {
  const http = httpDouble();
  const snapshotGate = gate();
  const h = await harness({ liveHead: 4, http });
  http.on('/temporal', async () => {
    await snapshotGate.wait();
    return { status: 200, body: snapshot({ liveHead: 9, liveFocusAtSp: 4 }) };
  });
  http.on('/temporal/events', () => ({ status: 200, body: { sessionId: SESSION_A, events: [committedEvent(5, 9)] } }));

  h.driver.start();
  await settle();
  h.driver.dispose();
  snapshotGate.open();
  await settle();

  expect(h.bundle.store.getState().live.LH).toBe(4);
  expect(eventCalls(http)).toHaveLength(0);
});

test('P40 — a retired runtime generation applies nothing even while authenticated', async () => {
  const http = httpDouble();
  const snapshotGate = gate();
  const h = await harness({ liveHead: 4, http });
  http.on('/temporal', async () => {
    await snapshotGate.wait();
    return { status: 200, body: snapshot({ liveHead: 9, liveFocusAtSp: 4 }) };
  });

  h.driver.start();
  await settle();
  h.current.value = false;
  snapshotGate.open();
  await settle();
  expect(h.bundle.store.getState().live.LH).toBe(4);
  h.driver.dispose();
});

test('stop() halts polling and start() resumes it', async () => {
  const h = await harness({ liveHead: 4 });
  h.driver.start();
  await settle();
  h.driver.stop();
  expect(h.timers.pending()).toBe(0);
  const before = h.http.calls.length;
  h.driver.requestImmediateCatchUp();
  await settle();
  expect(h.http.calls.length).toBe(before);

  h.driver.start();
  await settle();
  expect(h.http.calls.length).toBeGreaterThan(before);
  h.driver.dispose();
});

test('paging is bounded: one cycle cannot page forever against a fast-moving Session', async () => {
  const http = httpDouble();
  const h = await harness({ liveHead: 4, http });
  http.on('/temporal', () => ({ status: 200, body: snapshot({ liveHead: 10_000, liveFocusAtSp: 4 }) }));
  let sp = 4;
  http.on('/temporal/events', () => {
    // Always a full page, so the loop would never terminate on its own.
    const events = [committedEvent(sp + 1, sp + 1), committedEvent(sp + 2, sp + 2)];
    sp += 2;
    return { status: 200, body: { sessionId: SESSION_A, events } };
  });

  h.driver.start();
  await settle();
  // pageLimit 2, maxPagesPerCycle default 16.
  expect(eventCalls(http).length).toBeLessThanOrEqual(16);
  h.driver.dispose();
});

test('P36 — one runtime generation has at most ONE driver, and a retired generation disposes it', async () => {
  const http = httpDouble();
  serveHappyPath(http, { snapshot: snapshot({ liveHead: 4, liveFocusAtSp: 4 }) });
  const port = authPortDouble(ALICE);
  const built = createMobileRuntimeEntry({
    config: TEST_CONFIG,
    authPort: port,
    foreground: createManualForegroundSignal('ACTIVE'),
    httpFetch: http.fetch,
  });
  if (!built.ok) throw new Error('unreachable');
  await built.runtime.start();
  const result = await built.runtime.bootstrap();
  if (result.kind !== 'READY') throw new Error('unreachable');

  // Two drivers on one generation would poll the same streams concurrently — exactly the overlap
  // the contract forbids — so asking twice returns the same one.
  const first = built.runtime.liveDriverFor(result.bundle);
  expect(built.runtime.liveDriverFor(result.bundle)).toBe(first);

  first.start();
  await settle();
  const before = http.calls.length;

  // A replacement identity retires the generation. The driver holds a foreground subscription and a
  // scheduled timer, so leaving it alive would keep issuing requests for an identity that is gone.
  port.emit({ userId: 'bob', accessToken: 'token-bob-1' });
  await settle();
  first.requestImmediateCatchUp();
  await settle();
  expect(http.calls.length).toBe(before);
  built.runtime.dispose();
});

test('the requested page never exceeds the server cap and omits afterSp when there is no cursor', async () => {
  const http = httpDouble();
  const h = await harness({ liveHead: null, http });
  http.on('/temporal', () => ({ status: 200, body: snapshot({ liveHead: 2, liveFocusAtSp: null }) }));
  http.on('/temporal/events', () => ({ status: 200, body: { sessionId: SESSION_A, events: [committedEvent(1, 2)] } }));

  h.driver.start();
  await settle();
  const request = eventCalls(http)[0];
  // `afterSp=0` is a hard error server-side: SP(0) is not a cursor. Omission is the only way to
  // ask from the beginning.
  expect(request.url).not.toContain('afterSp');
  expect(request.url).toContain('limit=2');
  expect(h.bundle.store.getState().live.LH).toBe(2);
  h.driver.dispose();
});
