import { HistoricalProjectionApiClient, HistoricalTransportError } from '../historical-projection-api';
import { disclosure } from './historical-projection-wire.test';

const SESSION = 'session-1';
const response = (status: number, body: unknown, ok = status >= 200 && status < 300) => ({ ok, status, json: async () => body });
const client = (fetch: jest.Mock) => new HistoricalProjectionApiClient({ baseUrl: 'https://api.example.test', accessToken: 'token-1', fetch });
const worldOnly = (overrides: Record<string, unknown> = {}) => disclosure({ depth: 'WORLD', thread: { status: 'DEPTH_WITHHELD' }, session: { status: 'DEPTH_WITHHELD' }, analyticalObject: { status: 'DEPTH_WITHHELD' }, sourceProvenance: { status: 'DEPTH_WITHHELD' }, ...overrides });

async function failure(promise: Promise<unknown>): Promise<HistoricalTransportError['failure']> {
  try { await promise; } catch (error) { if (error instanceof HistoricalTransportError) return error.failure; throw error; }
  throw new Error('expected a transport failure');
}

describe('the historical disclosure transport', () => {
  it('GETs the ONE route with tc, depth and the inspection, bearing the injected token', async () => {
    const fetch = jest.fn().mockResolvedValue(response(200, disclosure()));
    const value = await client(fetch).fetchDisclosure(SESSION, { tc: 2, depth: 'SOURCE_PROVENANCE', inspection: { family: 'READING', id: 'reading-1', version: 3, appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } } });
    expect(value.tc).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.example.test/conversation/sessions/session-1/historical-projection?tc=2&depth=SOURCE_PROVENANCE&inspectFamily=READING&inspectId=reading-1&inspectVersion=3&appearanceKind=THREAD_READING&appearanceBindingId=binding-1');
    expect(init).toEqual({ method: 'GET', headers: { Authorization: 'Bearer token-1', Accept: 'application/json' } });
  });

  it('omits depth means WORLD, and refuses a disclosure of another depth, another TC or another Session', async () => {
    const ok = await client(jest.fn().mockResolvedValue(response(200, worldOnly()))).fetchDisclosure(SESSION, { tc: 2 });
    expect(ok.depth).toBe('WORLD');
    expect(await failure(client(jest.fn().mockResolvedValue(response(200, disclosure()))).fetchDisclosure(SESSION, { tc: 2 }))).toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_DEPTH' });
    expect(await failure(client(jest.fn().mockResolvedValue(response(200, worldOnly()))).fetchDisclosure(SESSION, { tc: 1 }))).toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INCOHERENT_HEADER' });
    expect(await failure(client(jest.fn().mockResolvedValue(response(200, worldOnly()))).fetchDisclosure('session-other', { tc: 2 }))).toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_IDENTITY' });
  });

  it('never sends SP(0), a fractional TC, an unknown depth or an empty inspection identity', async () => {
    const fetch = jest.fn();
    await expect(client(fetch).fetchDisclosure(SESSION, { tc: 0 })).rejects.toBeInstanceOf(RangeError);
    await expect(client(fetch).fetchDisclosure(SESSION, { tc: 1.5 })).rejects.toBeInstanceOf(RangeError);
    await expect(client(fetch).fetchDisclosure(SESSION, { tc: 1, depth: 'READING' as never })).rejects.toBeInstanceOf(RangeError);
    await expect(client(fetch).fetchDisclosure(SESSION, { tc: 1, inspection: { family: 'READING', id: '' } })).rejects.toBeInstanceOf(RangeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('turns the typed refusals into UNAVAILABLE with their exact code, never into an empty disclosure', async () => {
    for (const [status, code] of [[409, 'HISTORICAL_COVERAGE_UNAVAILABLE'], [409, 'LIVE_HEAD_NOT_ESTABLISHED'], [409, 'HISTORICAL_BASELINE_MISSING'], [400, 'SESSION_POSITION_NOT_ADDRESSABLE']] as const) {
      expect(await failure(client(jest.fn().mockResolvedValue(response(status, { code }))).fetchDisclosure(SESSION, { tc: 2 }))).toEqual({ kind: 'UNAVAILABLE', code, status });
    }
    expect(await failure(client(jest.fn().mockResolvedValue(response(404, { statusCode: 404 }))).fetchDisclosure(SESSION, { tc: 2 }))).toEqual({ kind: 'UNAVAILABLE', code: 'SESSION_NOT_VISIBLE', status: 404 });
  });

  it('a non-typed failure stays a transport failure: HTTP, NETWORK, MALFORMED_BODY, INVALID_PAYLOAD', async () => {
    expect(await failure(client(jest.fn().mockResolvedValue(response(400, { message: 'tc must be ...' }))).fetchDisclosure(SESSION, { tc: 2 }))).toEqual({ kind: 'HTTP', status: 400 });
    expect(await failure(client(jest.fn().mockResolvedValue(response(500, {}))).fetchDisclosure(SESSION, { tc: 2 }))).toEqual({ kind: 'HTTP', status: 500 });
    expect(await failure(client(jest.fn().mockRejectedValue(new Error('offline'))).fetchDisclosure(SESSION, { tc: 2 }))).toEqual({ kind: 'NETWORK' });
    expect(await failure(client(jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } })).fetchDisclosure(SESSION, { tc: 2 }))).toEqual({ kind: 'MALFORMED_BODY' });
    expect(await failure(client(jest.fn().mockResolvedValue(response(200, { ...worldOnly(), extra: 1 }))).fetchDisclosure(SESSION, { tc: 2 }))).toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'MALFORMED_SHAPE' });
  });
});
