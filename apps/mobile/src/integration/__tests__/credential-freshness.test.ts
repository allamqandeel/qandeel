/**
 * AC-01 — request-time credential freshness, end to end, across every authenticated request path.
 *
 * > **A refresh must change the credential on the wire and nothing else.**
 *
 * The two halves of that sentence are separately provable and were separately unproven. P19 already
 * showed the second half — a `TOKEN_REFRESHED` creates no second QANDEEL Session — but it says
 * nothing about what bearer the NEXT request carries, and the two frozen T-03 transports take their
 * token as an immutable config field. A client constructed at bootstrap therefore presented the
 * bootstrap token for as long as it lived, and because `authGeneration` is deliberately stable
 * across a refresh, nothing retired, nothing re-bootstrapped and nothing failed.
 *
 * Every assertion below reads the `Authorization` header the HTTP double actually received. Nothing
 * is inferred from a constructor argument, because the defect was precisely that a constructor
 * argument and the wire had stopped agreeing.
 *
 * The five authenticated request paths, and how each reaches freshness:
 *
 *   conversation Session create   seam          (`createAuthorizedFetch`, AC-01)
 *   bootstrap temporal snapshot   seam          (`createAuthorizedFetch`, AC-01)
 *   bootstrap projection          seam          (`createAuthorizedFetch`, AC-01)
 *   live driver catch-up          per-request   (T-12P `clientForRequest`, R1-02 — unchanged)
 *   projection coordinator        per-request   (T-12 `createProjectionClient` — unchanged)
 *
 * The last two already had the property and were NOT modified. They are proven here anyway: an
 * inherited property that nothing exercises is a property that can be lost silently.
 */
import { sessionPosition } from '../../state';
import {
  TEST_CONFIG,
  SESSION_A,
  authPortDouble,
  committedEvent,
  httpDouble,
  liveFocusEvent,
  servePagedStream,
  settle,
  snapshot,
  worldDisclosure,
  gate,
  type HttpDouble,
} from '../../runtime-entry/__fixtures__/runtime-entry';
import { createManualForegroundSignal } from '../../runtime-entry';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';

const READER = { userId: 'reader-1', accessToken: 'token-A' };
const READER_REFRESHED = { userId: 'reader-1', accessToken: 'token-B' };

const BEARER_A = 'Bearer token-A';
const BEARER_B = 'Bearer token-B';

/** Every request the double received, oldest first, as `METHOD <path> :: <authorization>`. */
const wire = (http: HttpDouble) =>
  http.calls.map((call) => `${call.method} ${new URL(call.url).pathname} :: ${call.authorization ?? '<none>'}`);

function build(http: HttpDouble, session: typeof READER, state: 'ACTIVE' | 'INACTIVE') {
  const auth = authPortDouble(session);
  const foreground = createManualForegroundSignal(state);
  const built = createIntegrationRuntime({ config: TEST_CONFIG, authPort: auth, foreground, httpFetch: http.fetch });
  if (!built.ok) throw new Error(`the test config must build a runtime: ${built.phase.detail}`);
  return { auth, foreground, runtime: built.runtime };
}

const ready = (runtime: IntegrationRuntime) => {
  const phase = runtime.getPhase();
  if (phase.kind !== 'READY') throw new Error(`expected READY, reached ${phase.kind}`);
  return phase.runtime;
};

describe('AC-01 — a token refresh reaches the wire without disturbing anything else', () => {
  /**
   * THE REGRESSION. The refresh lands while the bootstrap is still in flight, so the snapshot and
   * the projection are requested AFTER it — on clients that were constructed before it.
   *
   * This is the only window in which the bootstrap transports can issue a post-refresh request, and
   * it is the window the defect lived in. Before the seam both of these carried `token-A`.
   */
  it('AC-01.1 — a refresh mid-bootstrap moves every later bootstrap request onto the new token', async () => {
    const http = httpDouble();
    const held = gate();
    // The Session create is held open. Everything after it in the bootstrap chain is therefore
    // issued strictly after whatever happens while it is held.
    http.on('/conversation/sessions', async () => {
      await held.wait();
      return {
        status: 201,
        body: {
          id: SESSION_A,
          user_id: READER.userId,
          status: 'ACTIVE',
          channel: 'TEXT',
          created_at: 'now',
          updated_at: 'now',
          last_activity_at: 'now',
          closed_at: null,
        },
      };
    });
    http.on('/temporal', () => ({ status: 200, body: snapshot({ sessionId: SESSION_A, liveHead: 1 }) }));
    http.on('/historical-projection', () => ({ status: 200, body: worldDisclosure(SESSION_A, 1, 1) }));

    const { auth, runtime } = build(http, READER, 'INACTIVE');
    const starting = runtime.start();
    await settle();

    // The create is in flight and nothing else has been issued yet.
    expect(http.creates()).toHaveLength(1);
    expect(http.creates()[0].authorization).toBe(BEARER_A);
    expect(http.matching('/temporal')).toHaveLength(0);

    auth.emit(READER_REFRESHED);
    await settle();

    held.open();
    await starting;
    await settle();

    const session = ready(runtime);

    // The two requests issued after the refresh, on clients built before it.
    const snapshots = http.matching('/temporal');
    const projections = http.matching('/historical-projection');
    expect(snapshots.length).toBeGreaterThan(0);
    expect(projections.length).toBeGreaterThan(0);
    for (const call of [...snapshots, ...projections]) {
      expect(call.authorization).toBe(BEARER_B);
    }

    // …and the refresh disturbed nothing else. One Session, one generation, one store.
    expect(http.creates()).toHaveLength(1);
    expect(session.bundle.sessionId).toBe(SESSION_A);
    expect(session.bundle.authGeneration).toBe(1);

    // Token A was used for the create — which WAS issued before the refresh — and never again.
    const afterCreate = http.calls.slice(1);
    expect(afterCreate.filter((call) => call.authorization === BEARER_A)).toEqual([]);
    expect(wire(http)).toEqual([
      `POST /v1/conversation/sessions :: ${BEARER_A}`,
      `GET /v1/conversation/sessions/${SESSION_A}/temporal :: ${BEARER_B}`,
      `GET /v1/conversation/sessions/${SESSION_A}/historical-projection :: ${BEARER_B}`,
    ]);

    runtime.dispose();
  });

  /**
   * The post-bootstrap half: the two coordinators that outlive the bootstrap. Both already built a
   * transport per request; this proves they still do, through the real composition rather than
   * through their own unit doubles.
   */
  it('AC-01.2 — after a refresh, catch-up and projection coordination both carry the new token', async () => {
    const http = httpDouble();
    let liveHead = 1;
    http.on('/conversation/sessions', () => ({
      status: 201,
      body: {
        id: SESSION_A,
        user_id: READER.userId,
        status: 'ACTIVE',
        channel: 'TEXT',
        created_at: 'now',
        updated_at: 'now',
        last_activity_at: 'now',
        closed_at: null,
      },
    }));
    http.on('/temporal', () => ({
      status: 200,
      body: snapshot({ sessionId: SESSION_A, liveHead, liveFocusAtSp: liveHead }),
    }));
    http.on('/historical-projection', () => ({ status: 200, body: worldDisclosure(SESSION_A, 1, liveHead) }));
    servePagedStream(http, '/temporal/events', [committedEvent(2, 3)]);
    servePagedStream(http, '/temporal/live-focus-events', [liveFocusEvent(3)]);

    // INACTIVE while bootstrapping so the driver issues nothing of its own and the assertion below
    // is about the requests this test drives, not about whatever a real timer happened to fire.
    const { auth, foreground, runtime } = build(http, READER, 'INACTIVE');
    await runtime.start();
    await settle();
    const session = ready(runtime);

    // Everything so far is token A, including the bootstrap snapshot and projection.
    expect(http.calls.length).toBeGreaterThanOrEqual(3);
    for (const call of http.calls) expect(call.authorization).toBe(BEARER_A);
    const beforeRefresh = http.calls.length;

    auth.emit(READER_REFRESHED);
    await settle();

    // Nothing was retired: the same session runtime, the same store, the same Session.
    expect(ready(runtime)).toBe(session);
    expect(ready(runtime).store).toBe(session.store);
    expect(http.creates()).toHaveLength(1);
    expect(http.calls).toHaveLength(beforeRefresh);

    // Path 4 — the live driver. The Session has moved on, so it pages both streams as well as
    // reconciling the snapshot. Foregrounding is what lets it issue at all: a backgrounded driver
    // makes no request, which is the T-12P rule and not something to work around.
    liveHead = 3;
    foreground.set('ACTIVE');
    session.liveDriver.requestImmediateCatchUp();
    await settle();

    // Path 5 — the T-12 projection coordinator. `refresh` always issues; `ensure` would not,
    // because the bootstrap already holds this exact key.
    const outcome = await session.projection.refresh({ sessionId: SESSION_A, tc: sessionPosition(1), depth: 'WORLD' });
    expect(outcome).toBe('FETCHED');
    await settle();

    const after = http.calls.slice(beforeRefresh);
    // All three catch-up routes and the coordinated projection actually ran.
    expect(after.filter((call) => call.url.includes('/temporal/events')).length).toBeGreaterThan(0);
    expect(after.filter((call) => call.url.includes('/temporal/live-focus-events')).length).toBeGreaterThan(0);
    expect(after.filter((call) => call.url.endsWith('/temporal')).length).toBeGreaterThan(0);
    expect(after.filter((call) => call.url.includes('/historical-projection')).length).toBeGreaterThan(0);

    // Every one of them on the refreshed credential, and token A never again.
    for (const call of after) expect(call.authorization).toBe(BEARER_B);
    expect(after.filter((call) => call.authorization === BEARER_A)).toEqual([]);

    runtime.dispose();
  });

  /**
   * The negative half of the same property: a refresh must be the ONLY auth event that behaves this
   * way. A different identity is not a refresh, and must not be able to authorize a request for the
   * reader it replaced.
   */
  it('AC-01.3 — a replaced identity is not a refresh: it retires, re-bootstraps and never reuses the old Session', async () => {
    const http = httpDouble();
    http.on('/conversation/sessions', (request) => ({
      status: 201,
      body: {
        // A second create must produce a DIFFERENT Session, or the assertion below proves nothing.
        id: request.authorization === BEARER_A ? SESSION_A : '33333333-3333-4333-8333-333333333333',
        user_id: 'whoever',
        status: 'ACTIVE',
        channel: 'TEXT',
        created_at: 'now',
        updated_at: 'now',
        last_activity_at: 'now',
        closed_at: null,
      },
    }));
    http.on('/temporal', (request) => ({
      status: 200,
      body: snapshot({ sessionId: request.url.includes(SESSION_A) ? SESSION_A : '33333333-3333-4333-8333-333333333333', liveHead: null }),
    }));

    const { auth, runtime } = build(http, READER, 'INACTIVE');
    await runtime.start();
    await settle();
    const first = ready(runtime);

    // A DIFFERENT user, carrying a token that is not the reader's.
    auth.emit({ userId: 'reader-2', accessToken: 'token-B' }, 'SIGNED_IN');
    await settle();
    const second = ready(runtime);

    expect(second.generation).not.toBe(first.generation);
    expect(second.store).not.toBe(first.store);
    expect(second.bundle.sessionId).not.toBe(first.bundle.sessionId);
    expect(http.creates()).toHaveLength(2);
    // The replacement's own create carried the replacement's token, never the retired reader's.
    expect(http.creates()[0].authorization).toBe(BEARER_A);
    expect(http.creates()[1].authorization).toBe(BEARER_B);

    runtime.dispose();
  });
});
