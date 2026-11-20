/**
 * COSMOS E-2 corrections, Slice C (the Product Owner's D-5, Option U, 2026-11-20) — the CURRENT Personal World's client
 * and controller, headless. The client reads `GET /conversation/personal-world` on the identity-bound seam and refuses a
 * malformed world (a hole in it would be a quiet lie); it derives nothing, reorders nothing and carries no Session
 * Position. The controller holds the last served world for presentation only, reads single-flight, keeps a READY world
 * shown until the next lands, says UNAVAILABLE honestly, and answers nothing once retired or superseded.
 */
import { CurrentPersonalWorldApiClient, type RuntimeHttpFetch } from '../../runtime-entry';
import { createCurrentPersonalWorldController } from '../current-personal-world-controller';

const BASE = 'https://api.test';
const SESSION = '11111111-1111-4111-8111-111111111111';
const good = (over: Record<string, unknown> = {}) => ({ id: 'thread-1', home: { x: '300000', y: '-600000' }, name: { text: 'مديري', source: 'GROUNDING_WORDING' }, origin: { sessionId: SESSION, sp: 2 }, ...over });
const world = (threads: unknown[] = [good()], over: Record<string, unknown> = {}) => ({ asOf: '2026-11-20T10:00:00.000Z', threads, ...over });

function fetchOf(status: number, body: unknown, calls: { url: string; method: string; headers: Record<string, string> }[] = []): RuntimeHttpFetch {
  return async (url, init) => {
    calls.push({ url, method: init?.method ?? 'GET', headers: (init?.headers ?? {}) as Record<string, string> });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
}
const read = (status: number, body: unknown) => new CurrentPersonalWorldApiClient({ baseUrl: BASE, fetch: fetchOf(status, body) }).read();

describe('CurrentPersonalWorldApiClient', () => {
  it('GETs the person\'s own current world on the seam it was given and hands it over exactly as served', async () => {
    const calls: { url: string; method: string; headers: Record<string, string> }[] = [];
    const client = new CurrentPersonalWorldApiClient({ baseUrl: BASE, fetch: fetchOf(200, world([good(), good({ id: 'thread-2', name: { text: null, source: 'NONE' } })]), calls) });
    const outcome = await client.read();
    expect(calls).toEqual([{ url: `${BASE}/conversation/personal-world`, method: 'GET', headers: { Accept: 'application/json' } }]);
    expect(outcome).toEqual({
      kind: 'READ',
      world: {
        asOf: '2026-11-20T10:00:00.000Z',
        threads: [
          { id: 'thread-1', home: { x: '300000', y: '-600000' }, name: { text: 'مديري', source: 'GROUNDING_WORDING' }, origin: { sessionId: SESSION, sp: 2 } },
          { id: 'thread-2', home: { x: '300000', y: '-600000' }, name: { text: null, source: 'NONE' }, origin: { sessionId: SESSION, sp: 2 } },
        ],
      },
    });
  });

  it('an empty world is a truthful READ; 401 / 403 are UNAUTHENTICATED; any other failure is UNAVAILABLE with its detail', async () => {
    expect(await read(200, world([]))).toEqual({ kind: 'READ', world: { asOf: '2026-11-20T10:00:00.000Z', threads: [] } });
    expect(await read(401, {})).toEqual({ kind: 'UNAUTHENTICATED' });
    expect(await read(403, {})).toEqual({ kind: 'UNAUTHENTICATED' });
    expect(await read(503, {})).toEqual({ kind: 'UNAVAILABLE', detail: 'server responded 503' });
    const thrown = new CurrentPersonalWorldApiClient({ baseUrl: BASE, fetch: async () => { throw new Error('offline'); } });
    expect(await thrown.read()).toEqual({ kind: 'UNAVAILABLE', detail: 'offline' });
    const unreadable = new CurrentPersonalWorldApiClient({ baseUrl: BASE, fetch: async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }) });
    expect(await unreadable.read()).toEqual({ kind: 'UNAVAILABLE', detail: 'the response body could not be read' });
  });

  it.each([
    ['an extra world key', world([good()], { liveHead: 6 })],
    ['a missing asOf', { threads: [good()] }],
    ['an asOf that is not an instant', world([good()], { asOf: 'now' })],
    ['threads that are not a list', world([good()], { threads: {} })],
  ])('refuses a malformed world (%s): nothing is held of it', async (_label, body) => {
    expect(await read(200, body)).toEqual({ kind: 'UNAVAILABLE', detail: 'the current world is malformed' });
  });

  it.each([
    ['an extra Thread key (a Session Position smuggled in)', good({ establishedSp: 2 })],
    ['a missing key', (() => { const { origin: _o, ...rest } = good(); return rest; })()],
    ['an empty id', good({ id: '' })],
    ['a Home that is not exact integer text', good({ home: { x: '1.5', y: '0' } })],
    ['a Home with a sign-only text', good({ home: { x: '-', y: '0' } })],
    ['a Home with an extra key', good({ home: { x: '0', y: '0', z: '0' } })],
    ['a name source outside the law', good({ name: { text: 'x', source: 'LLM_LABEL' } })],
    ['text without a source', good({ name: { text: 'x', source: 'NONE' } })],
    ['a source without text', good({ name: { text: null, source: 'USER_ALIAS' } })],
    ['an empty name text', good({ name: { text: '', source: 'USER_ALIAS' } })],
    ['an origin at Session Position 0', good({ origin: { sessionId: SESSION, sp: 0 } })],
    ['an origin without a Session', good({ origin: { sessionId: '', sp: 1 } })],
  ])('refuses a malformed Thread row (%s): the whole world is refused, not a hole left in it', async (_label, row) => {
    expect(await read(200, world([good({ id: 'thread-0' }), row]))).toEqual({ kind: 'UNAVAILABLE', detail: 'a current-world row is malformed' });
  });

  it('refuses a duplicated Thread id', async () => {
    expect(await read(200, world([good(), good()]))).toEqual({ kind: 'UNAVAILABLE', detail: 'a current-world row is malformed' });
  });
});

describe('createCurrentPersonalWorldController', () => {
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const flush = async () => { for (let n = 0; n < 4; n += 1) await tick(); };
  const served = (threads: unknown[] = [good()]) => ({ kind: 'READ' as const, world: { asOf: '2026-11-20T10:00:00.000Z', threads: threads as never } });

  it('is IDLE and empty until asked; LOADING while the first read is on its way; READY with the served world; a second refresh keeps the READY world shown', async () => {
    let release: (value: Awaited<ReturnType<CurrentPersonalWorldApiClient['read']>>) => void = () => undefined;
    const transport = { read: jest.fn(() => new Promise<Awaited<ReturnType<CurrentPersonalWorldApiClient['read']>>>((resolve) => { release = resolve; })) };
    const world = createCurrentPersonalWorldController({ transport, isCurrent: () => true });
    const seen: string[] = [];
    world.subscribe(() => seen.push(world.getState().status));
    expect(world.getState()).toEqual({ status: 'IDLE', threads: [], asOf: null });
    world.refresh();
    expect(world.getState().status).toBe('LOADING');
    // Single-flight: a refresh while one is on its way issues nothing.
    world.refresh();
    expect(transport.read).toHaveBeenCalledTimes(1);
    release(served());
    await flush();
    expect(world.getState()).toMatchObject({ status: 'READY', asOf: '2026-11-20T10:00:00.000Z' });
    expect(world.getState().threads.map((t) => t.id)).toEqual(['thread-1']);
    expect(world.thread('thread-1')?.name.text).toBe('مديري');
    expect(world.thread('nope')).toBeNull();
    world.refresh();
    expect(world.getState().status).toBe('READY');
    release(served([good({ id: 'thread-9' })]));
    await flush();
    expect(world.getState().threads.map((t) => t.id)).toEqual(['thread-9']);
    expect(seen).toEqual(['LOADING', 'READY', 'READY', 'READY']);
  });

  it('says UNAVAILABLE for a failed or unauthenticated read and for a transport that throws; the next refresh reads again', async () => {
    const answers: Awaited<ReturnType<CurrentPersonalWorldApiClient['read']>>[] = [{ kind: 'UNAVAILABLE', detail: 'down' }, { kind: 'UNAUTHENTICATED' }, served()];
    const transport = { read: jest.fn(async () => { const next = answers.shift(); if (next === undefined) throw new Error('offline'); return next; }) };
    const world = createCurrentPersonalWorldController({ transport, isCurrent: () => true });
    world.refresh(); await flush();
    expect(world.getState().status).toBe('UNAVAILABLE');
    world.refresh(); await flush();
    expect(world.getState().status).toBe('UNAVAILABLE');
    world.refresh(); await flush();
    expect(world.getState().status).toBe('READY');
    world.refresh(); await flush();
    expect(world.getState().status).toBe('UNAVAILABLE');
    expect(transport.read).toHaveBeenCalledTimes(4);
  });

  it('answers nothing once retired or once the generation moved on: no state change, no listener', async () => {
    let current = true;
    const transport = { read: jest.fn(async () => served()) };
    const world = createCurrentPersonalWorldController({ transport, isCurrent: () => current });
    const listener = jest.fn();
    world.subscribe(listener);
    world.refresh();
    current = false;
    await flush();
    expect(world.getState().status).toBe('LOADING');
    current = true;
    world.retire();
    world.refresh();
    await flush();
    expect(transport.read).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
