import { MAX_TEMPORAL_EVENT_PAGE, TemporalApiClient, TemporalTransportError, type FetchLike } from '../temporal-api';

const event = (overrides: Record<string, unknown> = {}) => ({
  type: 'CONVERSATIONAL_UNITS_COMMITTED',
  version: 1,
  sessionId: 'session-1',
  batchId: 'batch-1',
  sourceTurnId: 'turn-1',
  firstSp: 1,
  lastSp: 2,
  unitCount: 2,
  ...overrides,
});

interface Call {
  url: string;
  headers: Record<string, string>;
}

function client(body: unknown, options: { ok?: boolean; status?: number; throws?: boolean; malformed?: boolean } = {}) {
  const calls: Call[] = [];
  const fetchSeam: FetchLike = async (url, init) => {
    calls.push({ url, headers: init?.headers ?? {} });
    if (options.throws) throw new Error('offline');
    return {
      ok: options.ok ?? true,
      status: options.status ?? 200,
      json: async () => {
        if (options.malformed) throw new Error('not json');
        return body;
      },
    };
  };
  return {
    calls,
    api: new TemporalApiClient({ baseUrl: 'https://api.example/v1', accessToken: 'token-abc', fetch: fetchSeam }),
  };
}

describe('temporal snapshot transport', () => {
  it('requests the owner-scoped route with the injected token and decodes the snapshot', async () => {
    const { api, calls } = client({ sessionId: 'session-1', liveHead: 12 });
    await expect(api.fetchSessionTemporalState('session-1')).resolves.toEqual({ sessionId: 'session-1', liveHead: 12 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.example/v1/conversation/sessions/session-1/temporal');
    expect(calls[0]?.headers.Authorization).toBe('Bearer token-abc');
  });

  it('accepts liveHead null and rejects a zero sentinel', async () => {
    await expect(client({ sessionId: 'session-1', liveHead: null }).api.fetchSessionTemporalState('session-1'))
      .resolves.toEqual({ sessionId: 'session-1', liveHead: null });
    await expect(client({ sessionId: 'session-1', liveHead: 0 }).api.fetchSessionTemporalState('session-1'))
      .rejects.toBeInstanceOf(TemporalTransportError);
  });

  it('fails closed on an HTTP error, a network failure and an unreadable body', async () => {
    for (const [options, kind] of [
      [{ ok: false, status: 403 }, 'HTTP'],
      [{ throws: true }, 'NETWORK'],
      [{ malformed: true }, 'MALFORMED_BODY'],
    ] as const) {
      const { api } = client({ sessionId: 'session-1', liveHead: 1 }, options);
      const failure = await api.fetchSessionTemporalState('session-1').catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(TemporalTransportError);
      expect((failure as TemporalTransportError).failure.kind).toBe(kind);
    }
  });
});

describe('committed-CU catch-up transport', () => {
  it('returns the delivered page in ascending Session Position order', async () => {
    const { api } = client({
      sessionId: 'session-1',
      events: [event({ batchId: 'a', firstSp: 1, lastSp: 2, unitCount: 2 }), event({ batchId: 'b', firstSp: 3, lastSp: 3, unitCount: 1 })],
    });
    const events = await api.fetchCommittedEvents('session-1');
    expect(events.map((entry) => entry.firstSp)).toEqual([1, 3]);
    expect(events[0]?.type).toBe('CONVERSATIONAL_UNITS_COMMITTED');
  });

  it('sends afterSp and limit only when supplied', async () => {
    const first = client({ sessionId: 'session-1', events: [] });
    await first.api.fetchCommittedEvents('session-1');
    expect(first.calls[0]?.url).toBe('https://api.example/v1/conversation/sessions/session-1/temporal/events');

    const paged = client({ sessionId: 'session-1', events: [] });
    await paged.api.fetchCommittedEvents('session-1', { afterSp: 7, limit: 32 });
    expect(paged.calls[0]?.url).toContain('?afterSp=7&limit=32');
  });

  it('refuses SP(0) as a cursor and an out-of-range page size before any request', async () => {
    const { api, calls } = client({ sessionId: 'session-1', events: [] });
    await expect(api.fetchCommittedEvents('session-1', { afterSp: 0 })).rejects.toBeInstanceOf(RangeError);
    await expect(api.fetchCommittedEvents('session-1', { afterSp: -1 })).rejects.toBeInstanceOf(RangeError);
    await expect(api.fetchCommittedEvents('session-1', { limit: 0 })).rejects.toBeInstanceOf(RangeError);
    await expect(api.fetchCommittedEvents('session-1', { limit: MAX_TEMPORAL_EVENT_PAGE + 1 })).rejects.toBeInstanceOf(RangeError);
    expect(calls).toHaveLength(0);
  });

  it('fails closed on an out-of-order page and on a foreign-Session envelope', async () => {
    const outOfOrder = client({
      sessionId: 'session-1',
      events: [event({ batchId: 'b', firstSp: 3, lastSp: 3, unitCount: 1 }), event({ batchId: 'a', firstSp: 1, lastSp: 2, unitCount: 2 })],
    });
    await expect(outOfOrder.api.fetchCommittedEvents('session-1')).rejects.toBeInstanceOf(TemporalTransportError);

    const foreign = client({ sessionId: 'session-2', events: [event()] });
    await expect(foreign.api.fetchCommittedEvents('session-1')).rejects.toBeInstanceOf(TemporalTransportError);
  });

  it('fails closed on an HTTP error', async () => {
    const { api } = client({ sessionId: 'session-1', events: [] }, { ok: false, status: 500 });
    const failure = await api.fetchCommittedEvents('session-1').catch((error: unknown) => error);
    expect((failure as TemporalTransportError).failure).toEqual({ kind: 'HTTP', status: 500 });
  });
});

// FIX-T03A2-02: the requested Session is part of the trust boundary. A
// well-shaped response that names a DIFFERENT Session than the request URL must
// never be returned as a successful result, and the transport - not the later
// canonical-store guard - is what refuses it.
describe('requested-Session binding at the transport boundary', () => {
  const rejection = async (call: Promise<unknown>) => {
    const failure = await call.catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TemporalTransportError);
    return (failure as TemporalTransportError).failure;
  };

  it('rejects a snapshot that names another Session', async () => {
    const { api } = client({ sessionId: 'session-2', liveHead: 12 });
    expect(await rejection(api.fetchSessionTemporalState('session-1')))
      .toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_IDENTITY' });
  });

  it('rejects an EMPTY catch-up page whose envelope names another Session', async () => {
    // There is no event here whose Session could disagree with the envelope, so
    // this is exactly the payload that used to decode cleanly.
    const { api } = client({ sessionId: 'session-2', events: [] });
    expect(await rejection(api.fetchCommittedEvents('session-1')))
      .toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_IDENTITY' });
  });

  it('rejects a foreign envelope even when its events agree with it', async () => {
    const { api } = client({ sessionId: 'session-2', events: [event({ sessionId: 'session-2' })] });
    expect(await rejection(api.fetchCommittedEvents('session-1')))
      .toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_IDENTITY' });
  });

  it('keeps rejecting an own-Session envelope carrying a foreign event', async () => {
    const { api } = client({ sessionId: 'session-1', events: [event({ sessionId: 'session-2' })] });
    expect(await rejection(api.fetchCommittedEvents('session-1')))
      .toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_IDENTITY' });
  });

  it('accepts a same-Session snapshot and a same-Session page, empty or not', async () => {
    await expect(client({ sessionId: 'session-1', liveHead: 4 }).api.fetchSessionTemporalState('session-1'))
      .resolves.toEqual({ sessionId: 'session-1', liveHead: 4 });
    await expect(client({ sessionId: 'session-1', events: [] }).api.fetchCommittedEvents('session-1'))
      .resolves.toEqual([]);
    const page = await client({ sessionId: 'session-1', events: [event()] }).api.fetchCommittedEvents('session-1');
    expect(page.map((entry) => entry.sessionId)).toEqual(['session-1']);
  });
});
