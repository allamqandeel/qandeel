/**
 * T-12 — A31…A45: the projection request gate.
 *
 * The frozen cache is a passive holder: `hold` writes unconditionally, so two open-head fetches of
 * the SAME key that resolve out of order leave the OLDER disclosure held with nothing anywhere able
 * to tell. Deciding which response is still wanted is a composition fact, and this is where it is
 * decided. There is still exactly ONE cache — the bundle's — and nothing here keeps a copy of it.
 */
import { HistoricalDisclosureCache } from '../../projection';
import { HistoricalProjectionApiClient } from '../../projection';
import type { MapProjectionRequest } from '../../map';
import { sessionPosition } from '../../state';
import { SESSION_A, SESSION_B, httpDouble, worldDisclosure } from '../__fixtures__/integration';
import { createProjectionCoordinator, type ProjectionCoordinator } from '../projection/projection-coordinator';

const WORLD_AT_1: MapProjectionRequest = { sessionId: SESSION_A, tc: sessionPosition(1), depth: 'WORLD' };

function coordinator(over: { authGeneration?: number; current?: () => boolean; token?: () => string | null } = {}) {
  const http = httpDouble();
  const cache = new HistoricalDisclosureCache();
  const tokens: string[] = [];
  const built: ProjectionCoordinator = createProjectionCoordinator({
    sessionId: SESSION_A,
    cache,
    authGeneration: over.authGeneration ?? 1,
    credential: () => {
      const token = over.token ? over.token() : 'token-1';
      return token === null ? null : { accessToken: token, authGeneration: 1 };
    },
    createProjectionClient: (accessToken) => {
      tokens.push(accessToken);
      return new HistoricalProjectionApiClient({ baseUrl: 'https://api.example.test/v1', accessToken, fetch: http.fetch });
    },
    isCurrent: over.current ?? (() => true),
  });
  return { http, cache, projection: built, tokens };
}

describe('T12-A31…A45 — one cache, one epoch per key, and identity proven against the payload', () => {
  it('T12-A36, T12-A37 — a typed refusal is knowledge; a transport failure is not', async () => {
    const refused = coordinator();
    refused.http.on('/historical-projection', () => ({ status: 409, body: { code: 'LIVE_HEAD_NOT_ESTABLISHED' } }));
    expect(await refused.projection.ensure(WORLD_AT_1)).toBe('UNAVAILABLE');
    expect(refused.cache.lookup(SESSION_A, 1, 'WORLD').status).toBe('UNAVAILABLE');

    const broken = coordinator();
    broken.http.failEverything('network is down');
    expect(await broken.projection.ensure(WORLD_AT_1)).toBe('NOT_FETCHED');
    // Nothing is held: "we do not know" stays retryable and never becomes an empty world.
    expect(broken.cache.lookup(SESSION_A, 1, 'WORLD').status).toBe('NOT_FETCHED');
  });

  it('T12-A32 — a response that lost the race to a newer request for the same key cannot write', async () => {
    const { http, cache, projection } = coordinator();
    // Two disclosures for the SAME key, distinguishable by their revision. The first request resolves
    // LAST, which is exactly the ordering the frozen cache cannot defend itself against.
    const release: (() => void)[] = [];
    let call = 0;
    http.on('/historical-projection', async () => {
      call += 1;
      const index = call;
      if (index === 1) await new Promise<void>((resolve) => release.push(resolve));
      return { status: 200, body: worldDisclosure(SESSION_A, 1, index === 1 ? 1 : 2) };
    });

    const first = projection.ensure(WORLD_AT_1);
    const second = projection.refresh(WORLD_AT_1);
    expect(await second).toBe('FETCHED');
    release.forEach((resolve) => resolve());
    // The older response is DROPPED rather than held: it is not merged, not retried, not held under
    // another key. Nothing is decided by arrival order — the epoch is.
    expect(await first).toBe('STALE');

    const held = cache.lookup(SESSION_A, 1, 'WORLD');
    expect(held.status).toBe('FETCHED');
    if (held.status === 'FETCHED') expect(held.value.revision.liveHead).toBe(2);
  });

  it('T12-A33, T12-A34, T12-A35 — a payload that answers a different question never becomes truth', async () => {
    // The frozen T-03C transport validates the wire body against the URL it was asked for, so a
    // foreign-Session or wrong-position payload is refused there first and surfaces as a technical
    // non-write. Nothing is held, which is the property that matters.
    for (const wrong of [worldDisclosure(SESSION_B, 1, 1), worldDisclosure(SESSION_A, 2, 2)]) {
      const { cache, http, projection } = coordinator();
      http.on('/historical-projection', () => ({ status: 200, body: wrong }));
      expect(await projection.ensure(WORLD_AT_1)).toBe('NOT_FETCHED');
      expect(cache.lookup(SESSION_A, 1, 'WORLD').status).toBe('NOT_FETCHED');
    }
  });

  it('T12-A33, T12-A34, T12-A35 — and the coordinator proves identity itself, not on the transport’s word', async () => {
    // Defence in depth, exercised directly: the check above is pre-empted by the transport, so it
    // would be dead code if nothing drove it. A client that hands back a well-formed disclosure for
    // the WRONG viewpoint — a confused proxy, an upstream cache, a future transport that validates
    // less — must still not write into this key.
    for (const wrong of [worldDisclosure(SESSION_B, 1, 1), worldDisclosure(SESSION_A, 2, 2), worldDisclosure(SESSION_A, 1, 1)]) {
      const cache = new HistoricalDisclosureCache();
      const projection = createProjectionCoordinator({
        sessionId: SESSION_A,
        cache,
        authGeneration: 1,
        credential: () => ({ accessToken: 'token-1', authGeneration: 1 }),
        createProjectionClient: () => ({ fetchDisclosure: async () => wrong }) as unknown as HistoricalProjectionApiClient,
        isCurrent: () => true,
      });
      const outcome = await projection.ensure(WORLD_AT_1);
      const matches = wrong.sessionId === SESSION_A && wrong.tc === 1;
      expect(outcome).toBe(matches ? 'FETCHED' : 'IDENTITY_MISMATCH');
      expect(cache.lookup(SESSION_A, 1, 'WORLD').status).toBe(matches ? 'FETCHED' : 'NOT_FETCHED');
    }
  });

  it('T12-A31 — a request for another Session is refused before a URL exists', async () => {
    const { http, projection } = coordinator();
    expect(await projection.ensure({ ...WORLD_AT_1, sessionId: SESSION_B })).toBe('IDENTITY_MISMATCH');
    expect(http.calls).toHaveLength(0);
  });

  it('T12-A41 — one key is fetched once: a render loop cannot become a fetch loop', async () => {
    const { http, projection } = coordinator();
    http.on('/historical-projection', () => ({ status: 200, body: worldDisclosure(SESSION_A, 1, 1) }));
    expect(await projection.ensure(WORLD_AT_1)).toBe('FETCHED');
    // Already held: nothing is issued, and a typed refusal is not re-asked either.
    expect(await projection.ensure(WORLD_AT_1)).toBe('ALREADY_HELD');
    expect(await projection.ensure(WORLD_AT_1)).toBe('ALREADY_HELD');
    expect(http.matching('/historical-projection')).toHaveLength(1);
  });

  it('a second ensure while one is in flight issues nothing', async () => {
    const { http, projection } = coordinator();
    http.on('/historical-projection', () => ({ status: 200, body: worldDisclosure(SESSION_A, 1, 1) }));
    const first = projection.ensure(WORLD_AT_1);
    expect(await projection.ensure(WORLD_AT_1)).toBe('IN_FLIGHT');
    await first;
    expect(http.matching('/historical-projection')).toHaveLength(1);
  });

  it('T12-A44 — a retired generation writes nothing, in flight or not', async () => {
    let current = true;
    const { cache, http, projection } = coordinator({ current: () => current });
    const release: (() => void)[] = [];
    http.on('/historical-projection', async () => {
      await new Promise<void>((resolve) => release.push(resolve));
      return { status: 200, body: worldDisclosure(SESSION_A, 1, 1) };
    });
    const inFlight = projection.ensure(WORLD_AT_1);
    current = false;
    release.forEach((resolve) => resolve());
    expect(await inFlight).toBe('RETIRED');
    expect(cache.lookup(SESSION_A, 1, 'WORLD').status).toBe('NOT_FETCHED');

    // And retirement clears every outstanding epoch, so nothing later can write either.
    projection.retire();
    expect(projection.inFlightCount()).toBe(0);
  });

  it('T12-A13 — the credential is read fresh at every request boundary', async () => {
    let token = 'token-1';
    const { http, projection, tokens } = coordinator({ token: () => token });
    http.on('/historical-projection', () => ({ status: 200, body: worldDisclosure(SESSION_A, 1, 1) }));
    await projection.ensure(WORLD_AT_1);
    token = 'token-2-refreshed';
    await projection.refresh(WORLD_AT_1);
    // A client held across the refresh would have presented the token it was born with.
    expect(tokens).toEqual(['token-1', 'token-2-refreshed']);
    expect(http.calls.map((call) => call.authorization)).toEqual(['Bearer token-1', 'Bearer token-2-refreshed']);
  });

  it('an unauthenticated reader issues no request at all', async () => {
    const { http, projection } = coordinator({ token: () => null });
    expect(await projection.ensure(WORLD_AT_1)).toBe('NOT_AUTHENTICATED');
    expect(http.calls).toHaveLength(0);
  });

  it('T12-A42 — the coordinator holds no canonical state and no second cache', () => {
    const source = createProjectionCoordinator.toString();
    for (const forbidden of ['dispatch', 'getState', 'CanonicalState', 'setState']) {
      expect(source.includes(forbidden)).toBe(false);
    }
  });
});
