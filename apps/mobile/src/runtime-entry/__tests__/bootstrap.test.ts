/** T-12P adversarial matrix — Bootstrap, P16…P34. */
import { effectiveTC } from '../../state';
import { initialCameraIntent } from '../../map';
import { createMobileRuntimeEntry } from '../mobile-runtime-entry';
import {
  SESSION_A,
  SESSION_B,
  TEST_CONFIG,
  authPortDouble,
  committedEvent,
  gate,
  httpDouble,
  serveHappyPath,
  settle,
  snapshot,
  worldDisclosure,
} from '../__fixtures__/runtime-entry';
import { createManualForegroundSignal } from '../lifecycle/foreground-signal';

const ALICE = { userId: 'alice', accessToken: 'token-alice-1' };
const ALICE_REFRESHED = { userId: 'alice', accessToken: 'token-alice-2' };
const BOB = { userId: 'bob', accessToken: 'token-bob-1' };

async function runtimeFor(options: { http?: ReturnType<typeof httpDouble>; session?: typeof ALICE | null } = {}) {
  const http = options.http ?? httpDouble();
  const port = authPortDouble(options.session === undefined ? ALICE : options.session);
  const built = createMobileRuntimeEntry({
    config: TEST_CONFIG,
    authPort: port,
    foreground: createManualForegroundSignal('ACTIVE'),
    httpFetch: http.fetch,
  });
  if (!built.ok) throw new Error('the test config must build');
  await built.runtime.start();
  return { http, port, runtime: built.runtime };
}

test('P21/P30 — a happy bootstrap creates exactly one store and reaches READY', async () => {
  const http = httpDouble();
  serveHappyPath(http, { snapshot: snapshot({ liveHead: 7, liveFocusAtSp: 7, liveFocus: { kind: 'THREAD', threadId: 't-1' } }) });
  const { runtime } = await runtimeFor({ http });

  const result = await runtime.bootstrap();
  expect(result.kind).toBe('READY');
  if (result.kind !== 'READY') throw new Error('unreachable');
  expect(result.bundle.sessionId).toBe(SESSION_A);
  expect(result.bundle.userId).toBe('alice');
  expect(http.creates()).toHaveLength(1);
});

test('P31/P32/P33 — the initial canonical state comes from frozen laws only', async () => {
  const http = httpDouble();
  serveHappyPath(http, { snapshot: snapshot({ liveHead: 7, liveFocusAtSp: 7 }) });
  const { runtime } = await runtimeFor({ http });
  const result = await runtime.bootstrap();
  if (result.kind !== 'READY') throw new Error('unreachable');

  const state = result.bundle.store.getState();
  // P31: the only mode the kernel accepts at construction without a pinned position.
  expect(state.temporal).toEqual({ kind: 'FOLLOW_LIVE' });
  // P33: the canonical "inspecting nothing".
  expect(state.inspection).toBeNull();
  // P32: the canonical World/Z0 camera, not a default chosen here. Constructing any other anchor,
  // scale or depth would silently change what "Return to World" is a no-op against.
  expect(state.camera).toEqual(initialCameraIntent());
  // The mirror is the server's, not ours.
  expect(state.live.LH).toBe(7);
  expect(state.history).toEqual([]);
});

test('P25 — a brand-new Session invents no SP, no V and no projection request', async () => {
  const http = httpDouble();
  serveHappyPath(http, { snapshot: snapshot({ liveHead: null }) });
  const { runtime } = await runtimeFor({ http });
  const result = await runtime.bootstrap();
  if (result.kind !== 'READY') throw new Error('unreachable');

  const state = result.bundle.store.getState();
  // `null` is the frozen technical absence sentinel: not SP(0), not a Moment, never addressable.
  expect(state.live.LH).toBeNull();
  expect(effectiveTC(state)).toBeNull();
  expect(result.bundle.initialDisclosure).toBe('NOT_APPLICABLE');
  expect(result.bundle.cursors).toEqual({ committedAfterSp: null, liveFocusAfterSp: null });
  // P27: with no addressable Live Head there is no legal `tc`, so no request is made at all.
  expect(http.matching('/historical-projection')).toHaveLength(0);
});

test('P26 — an addressable Live Head requests the WORLD disclosure exactly once', async () => {
  const http = httpDouble();
  serveHappyPath(http, { snapshot: snapshot({ liveHead: 12, liveFocusAtSp: 12 }) });
  const { runtime } = await runtimeFor({ http });
  const result = await runtime.bootstrap();
  if (result.kind !== 'READY') throw new Error('unreachable');

  const requests = http.matching('/historical-projection');
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toContain('tc=12');
  expect(result.bundle.initialDisclosure).toBe('FETCHED');
  expect(result.bundle.projection.lookup(SESSION_A, 12, 'WORLD').status).toBe('FETCHED');
});

test('a typed projection refusal is held as UNAVAILABLE and still reaches READY', async () => {
  const http = httpDouble();
  serveHappyPath(http, { snapshot: snapshot({ liveHead: 5, liveFocusAtSp: 5 }) });
  http.on('/historical-projection', () => ({ status: 409, body: { code: 'LIVE_HEAD_NOT_ESTABLISHED' } }));
  const { runtime } = await runtimeFor({ http });
  const result = await runtime.bootstrap();
  if (result.kind !== 'READY') throw new Error('unreachable');

  // UNAVAILABLE is knowledge and stays distinct from "not fetched". Neither is an empty world, and
  // neither blocks the runtime: the reader sees the technical state, which is the truthful one.
  expect(result.bundle.initialDisclosure).toBe('UNAVAILABLE');
  expect(result.bundle.projection.lookup(SESSION_A, 5, 'WORLD').status).toBe('UNAVAILABLE');
});

test('a projection transport failure leaves NOT_FETCHED and still reaches READY', async () => {
  const http = httpDouble();
  serveHappyPath(http, { snapshot: snapshot({ liveHead: 5, liveFocusAtSp: 5 }) });
  http.on('/historical-projection', () => ({ status: 500, body: {} }));
  const { runtime } = await runtimeFor({ http });
  const result = await runtime.bootstrap();
  if (result.kind !== 'READY') throw new Error('unreachable');
  expect(result.bundle.initialDisclosure).toBe('NOT_FETCHED');
  expect(result.bundle.projection.lookup(SESSION_A, 5, 'WORLD').status).toBe('NOT_FETCHED');
});

test('P22 — a snapshot failure creates no store at all', async () => {
  const http = httpDouble();
  serveHappyPath(http);
  http.on('/temporal', () => ({ status: 500, body: {} }));
  const { runtime } = await runtimeFor({ http });
  const result = await runtime.bootstrap();
  expect(result.kind).toBe('FAILED');
  if (result.kind !== 'FAILED') throw new Error('unreachable');
  expect(result.failure.kind).toBe('SNAPSHOT');
});

test('P23 — a malformed snapshot creates no store at all', async () => {
  const http = httpDouble();
  serveHappyPath(http);
  http.on('/temporal', () => ({ status: 200, body: { sessionId: SESSION_A, liveHead: 0 } }));
  const { runtime } = await runtimeFor({ http });
  const result = await runtime.bootstrap();
  expect(result.kind).toBe('FAILED');
  if (result.kind !== 'FAILED') throw new Error('unreachable');
  // `liveHead: 0` is rejected by the wire decoder: SP(0) is not addressable.
  expect(result.failure.kind).toBe('SNAPSHOT');
});

test('P24 — a snapshot naming a different Session is refused', async () => {
  const http = httpDouble();
  serveHappyPath(http);
  http.on('/temporal', () => ({ status: 200, body: snapshot({ sessionId: SESSION_B, liveHead: 3 }) }));
  const { runtime } = await runtimeFor({ http });
  const result = await runtime.bootstrap();
  expect(result.kind).toBe('FAILED');
  if (result.kind !== 'FAILED') throw new Error('unreachable');
  expect(result.failure.kind).toBe('SNAPSHOT');
});

test('P28 — a disclosure for the wrong position is refused, not held', async () => {
  const http = httpDouble();
  serveHappyPath(http, { snapshot: snapshot({ liveHead: 9, liveFocusAtSp: 9 }) });
  // A well-shaped disclosure for the WRONG position.
  http.on('/historical-projection', () => ({ status: 200, body: worldDisclosure(SESSION_A, 4, 9) }));
  const { runtime } = await runtimeFor({ http });
  const result = await runtime.bootstrap();
  if (result.kind !== 'READY') throw new Error('unreachable');
  // The transport binds requested Session/TC/depth to the response, so the mismatch is a transport
  // failure and nothing is held under the requested key.
  expect(result.bundle.initialDisclosure).toBe('NOT_FETCHED');
  expect(result.bundle.projection.lookup(SESSION_A, 9, 'WORLD').status).toBe('NOT_FETCHED');
});

test('a failed Session acquisition creates no store and reports the exact outcome', async () => {
  const http = httpDouble();
  serveHappyPath(http);
  http.on('/conversation/sessions', () => ({ status: 503, body: {} }));
  const { runtime } = await runtimeFor({ http });
  const result = await runtime.bootstrap();
  expect(result.kind).toBe('FAILED');
  if (result.kind !== 'FAILED') throw new Error('unreachable');
  expect(result.failure.kind).toBe('SESSION_ACQUISITION');
  if (result.failure.kind !== 'SESSION_ACQUISITION') throw new Error('unreachable');
  expect(result.failure.outcome.kind).toBe('OUTCOME_UNKNOWN');
  // Nothing after the ambiguous create was attempted: no snapshot, no projection.
  expect(http.matching('/temporal')).toHaveLength(0);
});

test('bootstrapping while signed out is a typed refusal, not a crash', async () => {
  const { runtime } = await runtimeFor({ session: null });
  const result = await runtime.bootstrap();
  expect(result).toEqual({ kind: 'FAILED', failure: { kind: 'NOT_AUTHENTICATED' } });
});

test('P16/P17 — two bootstrap calls for one identity create exactly one Session', async () => {
  const http = httpDouble();
  serveHappyPath(http);
  const { runtime } = await runtimeFor({ http });
  const [first, second] = await Promise.all([runtime.bootstrap(), runtime.bootstrap()]);
  expect(first).toBe(second);
  expect(http.creates()).toHaveLength(1);
  const third = await runtime.bootstrap();
  expect(third).toBe(first);
  expect(http.creates()).toHaveLength(1);
});

test('P19 — a token refresh alone does not create a second Session', async () => {
  const http = httpDouble();
  serveHappyPath(http);
  const { port, runtime } = await runtimeFor({ http });
  await runtime.bootstrap();
  const generationBefore = runtime.currentRuntimeGeneration();

  port.emit(ALICE_REFRESHED);
  await settle();
  await runtime.bootstrap();

  expect(http.creates()).toHaveLength(1);
  expect(runtime.currentRuntimeGeneration()).toBe(generationBefore);
});

test('P20 — a replacement user retires the generation and cannot reuse the old Session', async () => {
  const http = httpDouble();
  serveHappyPath(http);
  const { port, runtime } = await runtimeFor({ http });
  const first = await runtime.bootstrap();
  if (first.kind !== 'READY') throw new Error('unreachable');
  const generationBefore = runtime.currentRuntimeGeneration();

  port.emit(BOB);
  await settle();
  expect(runtime.currentRuntimeGeneration()).toBeGreaterThan(generationBefore);

  const second = await runtime.bootstrap();
  if (second.kind !== 'READY') throw new Error('unreachable');
  expect(second.bundle.userId).toBe('bob');
  expect(second.bundle.runtimeGeneration).not.toBe(first.bundle.runtimeGeneration);
  expect(second.bundle.store).not.toBe(first.bundle.store);
  expect(http.creates()).toHaveLength(2);
});

test('a sign-out retires the generation', async () => {
  const http = httpDouble();
  serveHappyPath(http);
  const { runtime } = await runtimeFor({ http });
  await runtime.bootstrap();
  const before = runtime.currentRuntimeGeneration();
  await runtime.auth.signOut();
  await settle();
  expect(runtime.currentRuntimeGeneration()).toBeGreaterThan(before);
});

test('P29 — a superseded attempt creates nothing and reports RETIRED', async () => {
  const http = httpDouble();
  serveHappyPath(http);
  const snapshotGate = gate();
  http.on('/temporal', async () => {
    await snapshotGate.wait();
    return { status: 200, body: snapshot({ liveHead: 3, liveFocusAtSp: 3 }) };
  });

  const { port, runtime } = await runtimeFor({ http });
  const attempt = runtime.bootstrap();
  await settle();

  // The identity is replaced while the snapshot is still in flight.
  port.emit(BOB);
  await settle();
  snapshotGate.open();

  const result = await attempt;
  expect(result).toEqual({ kind: 'FAILED', failure: { kind: 'RETIRED' } });
});

test('P34 — an existing authorized Session id skips creation entirely', async () => {
  const http = httpDouble();
  serveHappyPath(http, { sessionId: SESSION_B, snapshot: snapshot({ sessionId: SESSION_B, liveHead: 2, liveFocusAtSp: 2 }) });
  const { runtime } = await runtimeFor({ http });
  const result = await runtime.bootstrap({ existingSessionId: SESSION_B });
  if (result.kind !== 'READY') throw new Error('unreachable');
  expect(result.bundle.sessionId).toBe(SESSION_B);
  expect(http.creates()).toHaveLength(0);
});

test('the cursors start strictly after what the snapshot already established', async () => {
  const http = httpDouble();
  serveHappyPath(http, {
    snapshot: snapshot({ liveHead: 42, liveFocusAtSp: 40, liveFocus: { kind: 'EMERGING', emergingFocusId: 'e-1' } }),
    committed: [committedEvent(43, 43)],
  });
  const { runtime } = await runtimeFor({ http });
  const result = await runtime.bootstrap();
  if (result.kind !== 'READY') throw new Error('unreachable');
  expect(result.bundle.cursors).toEqual({ committedAfterSp: 42, liveFocusAfterSp: 40 });
});

test('P59 — the bootstrap writes nothing to any persistent store', async () => {
  // The only thing this layer persists is authentication material, through the Supabase mechanism.
  // A bootstrap driven entirely by an injected auth port touches no storage at all.
  const http = httpDouble();
  serveHappyPath(http);
  const writes: string[] = [];
  const built = createMobileRuntimeEntry({
    config: TEST_CONFIG,
    authPort: authPortDouble(ALICE),
    foreground: createManualForegroundSignal('ACTIVE'),
    httpFetch: http.fetch,
    authStorage: {
      getItem: async () => null,
      setItem: async (key) => {
        writes.push(key);
      },
      removeItem: async (key) => {
        writes.push(key);
      },
    },
  });
  if (!built.ok) throw new Error('unreachable');
  await built.runtime.start();
  await built.runtime.bootstrap();
  expect(writes).toEqual([]);
  built.runtime.dispose();
});
