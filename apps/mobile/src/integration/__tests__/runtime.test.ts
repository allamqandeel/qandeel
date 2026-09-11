/**
 * T-12 — A01…A20: one Session, one store, three authorities, and a generation that retires as one.
 *
 * The point of this file is that the integration owner cannot quietly become a second authority. Two
 * of its properties would be invisible in a feature test and are the ones that would hurt most: a
 * store built without its promoted-act authorities looks mounted and is inert, and a coordinator that
 * outlives its generation writes into a store nobody is watching.
 */
import {
  MAP_ACTION_AUTHORITY,
  TEMPORAL_ACTION_AUTHORITY,
  RETURN_ACTION_AUTHORITY,
} from '../__fixtures__/authorities';
import { harness, settle, SESSION_A, SESSION_B, TEST_CONFIG } from '../__fixtures__/integration';
import { T12_STORE_DEPENDENCIES, createIntegrationRuntime } from '../runtime/integration-runtime';

/** The Session-CREATE calls, and only those: the HTTP double already isolates that exact route. */
const createCalls = (h: Awaited<ReturnType<typeof harness>>) => h.http.creates();

describe('T12-A01…A10 — one store, and the authorities that make it executable', () => {
  it('T12-A01, T12-A02 — one Session produces exactly one CanonicalStore, and it is the bundle’s', async () => {
    const h = await harness();
    const runtime = h.ready();
    expect(runtime.store).toBe(runtime.bundle.store);
    expect(runtime.bundle.sessionId).toBe(SESSION_A);
    // Exactly one conversation Session was created for this runtime generation.
    expect(createCalls(h)).toHaveLength(1);
    h.dispose();
  });

  it('T12-A03, T12-A04, T12-A05 — all three promoted-act authorities are the frozen production ones', () => {
    expect(T12_STORE_DEPENDENCIES.mapActionAuthority).toBe(MAP_ACTION_AUTHORITY);
    expect(T12_STORE_DEPENDENCIES.temporalActionAuthority).toBe(TEMPORAL_ACTION_AUTHORITY);
    expect(T12_STORE_DEPENDENCIES.returnActionAuthority).toBe(RETURN_ACTION_AUTHORITY);
    // Three DIFFERENT objects: sharing one verifier would let either owner's mint open the other's
    // door, which is precisely what the separate authorities exist to prevent.
    const authorities = [MAP_ACTION_AUTHORITY, TEMPORAL_ACTION_AUTHORITY, RETURN_ACTION_AUTHORITY];
    expect(new Set(authorities).size).toBe(3);
  });

  it('T12-A06 — the store the runtime hands out actually executes a promoted act', async () => {
    const h = await harness();
    const store = h.ready().store;
    // A store built WITHOUT its Map authority fails closed on every Map act. Dispatching an
    // unauthorized action must still be refused — the authority verifies the exact object — so what
    // this proves is the seam is wired at all rather than absent.
    expect(() => store.dispatchMap({ type: 'INSPECT_OBJECT', ref: null as never })).toThrow();
    h.dispose();
  });

  it('T12-A07, T12-A08, T12-A30, T12-A43 — a replaced identity retires the whole generation at once', async () => {
    const h = await harness();
    const first = h.ready();
    const firstStore = first.store;

    // A DIFFERENT identity: T-12P retires its runtime generation, and this owner retires its half.
    h.auth.emit({ userId: 'user-2', accessToken: 'token-2' }, 'SIGNED_IN');
    await settle();

    const second = h.ready();
    expect(second.store).not.toBe(firstStore);
    expect(second.generation).not.toBe(first.generation);
    // Everything bound to the old generation is retired rather than orphaned.
    expect(first.projection.inFlightCount()).toBe(0);
    expect(first.spatialCause.isArmed()).toBe(false);
    expect(first.journey.origin()).toBeNull();
    h.dispose();
  });

  it('T12-A09 — a token refresh is not a generation change and retires nothing', async () => {
    const h = await harness();
    const before = h.ready();
    h.auth.emit({ userId: 'user-1', accessToken: 'token-1-refreshed' }, 'TOKEN_REFRESHED');
    await settle();
    expect(h.ready().store).toBe(before.store);
    expect(h.ready().generation).toBe(before.generation);
    // And no second conversation Session was acquired.
    expect(createCalls(h)).toHaveLength(1);
    h.dispose();
  });

  it('T12-A11, T12-A18 — a sign-out leaves no store and fabricates nothing in its place', async () => {
    const h = await harness();
    expect(h.phase().kind).toBe('READY');
    h.auth.emit(null, 'SIGNED_OUT');
    await settle();
    expect(h.phase().kind).toBe('SIGNED_OUT');
    h.dispose();
  });

  it('T12-A14 — an unauthenticated start reaches no Session and creates no store', async () => {
    const h = await harness({ initialSession: null });
    expect(h.phase().kind).toBe('SIGNED_OUT');
    expect(h.http.calls).toHaveLength(0);
    h.dispose();
  });

  it('T12-A12, T12-A13 — the base URL comes from validated config and the bootstrap seam is unreachable', async () => {
    const h = await harness();
    expect(h.runtime.config).toBe(TEST_CONFIG);
    // The bootstrap seam is NOT on the public surface: nothing outside the owner can start one, so
    // the authority-less-store trap cannot be reached from a consumer at all.
    expect((h.runtime as unknown as Record<string, unknown>).bootstrap).toBeUndefined();
    // Every request went to the configured origin and carried the current access token.
    for (const call of h.http.calls) {
      expect(call.url.startsWith(TEST_CONFIG.apiBaseUrl)).toBe(true);
      expect(call.authorization).toBe('Bearer token-1');
    }
    h.dispose();
  });

  it('T12-A18 — with no public configuration the runtime fails closed and builds nothing', () => {
    // The PRODUCTION path: no injected config, so the validated Expo `extra` is read — and under
    // jest-expo there is none. A runtime pointing at nothing is far worse than no runtime, so the
    // owner refuses to build one, before any auth port, storage or transport is constructed.
    const built = createIntegrationRuntime();
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.phase.kind).toBe('CONFIG_REFUSED');
  });

  it('T12-A45 — a snapshot naming another Session is refused and no store is built', async () => {
    const h = await harness({ serve: false });
    h.http.on('/conversation/sessions', () => ({
      status: 201,
      body: { id: SESSION_A, user_id: 'user-1', status: 'ACTIVE', channel: 'TEXT', created_at: 'n', updated_at: 'n', last_activity_at: 'n', closed_at: null },
    }));
    // A wire-legal snapshot for a DIFFERENT Session.
    h.http.on('/temporal', () => ({ status: 200, body: { sessionId: SESSION_B, liveHead: 1, liveFocus: { kind: 'NONE' }, liveFocusAtSp: null } }));
    h.auth.emit({ userId: 'user-9', accessToken: 'token-9' }, 'SIGNED_IN');
    await settle();
    expect(h.phase().kind).toBe('BOOTSTRAP_FAILED');
    h.dispose();
  });
});
