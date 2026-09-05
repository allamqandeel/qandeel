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

const THREAD = { kind: 'THREAD', threadId: 'afc4fd81-fe54-5738-9545-e1053044d919' };
const transition = (overrides: Record<string, unknown> = {}) => ({
  type: 'LIVE_FOCUS_TRANSITION',
  version: 1,
  sessionId: 'session-1',
  atSp: 2,
  value: THREAD,
  ...overrides,
});
const snapshot = (overrides: Record<string, unknown> = {}) => ({ sessionId: 'session-1', liveHead: 12, liveFocus: { kind: 'NONE' }, liveFocusAtSp: null, ...overrides });

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
  it('requests the owner-scoped route with the injected token and decodes the LH + LF snapshot', async () => {
    const { api, calls } = client(snapshot({ liveFocus: THREAD, liveFocusAtSp: 11 }));
    await expect(api.fetchSessionTemporalState('session-1')).resolves.toEqual(snapshot({ liveFocus: THREAD, liveFocusAtSp: 11 }));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.example/v1/conversation/sessions/session-1/temporal');
    expect(calls[0]?.headers.Authorization).toBe('Bearer token-abc');
  });

  it('accepts liveHead null and rejects a zero sentinel, a missing LF and an LF beyond the Live Head', async () => {
    await expect(client(snapshot({ liveHead: null })).api.fetchSessionTemporalState('session-1'))
      .resolves.toEqual(snapshot({ liveHead: null }));
    await expect(client(snapshot({ liveHead: 0 })).api.fetchSessionTemporalState('session-1'))
      .rejects.toBeInstanceOf(TemporalTransportError);
    await expect(client({ sessionId: 'session-1', liveHead: 12 }).api.fetchSessionTemporalState('session-1'))
      .rejects.toBeInstanceOf(TemporalTransportError);
    await expect(client(snapshot({ liveFocus: THREAD, liveFocusAtSp: 13 })).api.fetchSessionTemporalState('session-1'))
      .rejects.toBeInstanceOf(TemporalTransportError);
  });

  it('fails closed on an HTTP error, a network failure and an unreadable body', async () => {
    for (const [options, kind] of [
      [{ ok: false, status: 403 }, 'HTTP'],
      [{ throws: true }, 'NETWORK'],
      [{ malformed: true }, 'MALFORMED_BODY'],
    ] as const) {
      const { api } = client(snapshot({ liveHead: 1 }), options);
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

describe('Live Focus transition catch-up transport (T-03D)', () => {
  it('requests the owner-scoped LF route with the same paging grammar and returns the ascending page', async () => {
    const { api, calls } = client({ sessionId: 'session-1', events: [transition({ atSp: 1, value: { kind: 'EMERGING', emergingFocusId: '4ef8538d-ddda-5e11-b7d9-052be85de59a' } }), transition({ atSp: 2 })] });
    const events = await api.fetchLiveFocusEvents('session-1', { afterSp: 0 + 1, limit: 8 });
    expect(events.map((entry) => [entry.atSp, entry.value.kind])).toEqual([[1, 'EMERGING'], [2, 'THREAD']]);
    expect(calls[0]?.url).toBe('https://api.example/v1/conversation/sessions/session-1/temporal/live-focus-events?afterSp=1&limit=8');
    expect(calls[0]?.headers.Authorization).toBe('Bearer token-abc');
    const plain = client({ sessionId: 'session-1', events: [] });
    await expect(plain.api.fetchLiveFocusEvents('session-1')).resolves.toEqual([]);
    expect(plain.calls[0]?.url).toBe('https://api.example/v1/conversation/sessions/session-1/temporal/live-focus-events');
  });

  it('refuses SP(0) as a cursor before any request and fails closed on a bad page, a foreign envelope and an HTTP error', async () => {
    const { api, calls } = client({ sessionId: 'session-1', events: [] });
    await expect(api.fetchLiveFocusEvents('session-1', { afterSp: 0 })).rejects.toBeInstanceOf(RangeError);
    expect(calls).toHaveLength(0);
    await expect(client({ sessionId: 'session-1', events: [transition({ atSp: 2 }), transition({ atSp: 1 })] }).api.fetchLiveFocusEvents('session-1'))
      .rejects.toBeInstanceOf(TemporalTransportError);
    await expect(client({ sessionId: 'session-1', events: [transition({ value: { ...THREAD, label: 'Ahmed' } })] }).api.fetchLiveFocusEvents('session-1'))
      .rejects.toBeInstanceOf(TemporalTransportError);
    await expect(client({ sessionId: 'session-2', events: [] }).api.fetchLiveFocusEvents('session-1'))
      .rejects.toBeInstanceOf(TemporalTransportError);
    const failure = await client({ sessionId: 'session-1', events: [] }, { ok: false, status: 401 }).api.fetchLiveFocusEvents('session-1').catch((error: unknown) => error);
    expect((failure as TemporalTransportError).failure).toEqual({ kind: 'HTTP', status: 401 });
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
    const { api } = client(snapshot({ sessionId: 'session-2' }));
    expect(await rejection(api.fetchSessionTemporalState('session-1')))
      .toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_IDENTITY' });
  });

  it('rejects an EMPTY catch-up page whose envelope names another Session, on both catch-up routes', async () => {
    // There is no event here whose Session could disagree with the envelope, so
    // this is exactly the payload that used to decode cleanly.
    const { api } = client({ sessionId: 'session-2', events: [] });
    expect(await rejection(api.fetchCommittedEvents('session-1')))
      .toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_IDENTITY' });
    expect(await rejection(api.fetchLiveFocusEvents('session-1')))
      .toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_IDENTITY' });
  });

  it('rejects a foreign envelope even when its events agree with it', async () => {
    const { api } = client({ sessionId: 'session-2', events: [event({ sessionId: 'session-2' })] });
    expect(await rejection(api.fetchCommittedEvents('session-1')))
      .toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_IDENTITY' });
    const lf = client({ sessionId: 'session-2', events: [transition({ sessionId: 'session-2' })] });
    expect(await rejection(lf.api.fetchLiveFocusEvents('session-1')))
      .toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_IDENTITY' });
  });

  it('keeps rejecting an own-Session envelope carrying a foreign event', async () => {
    const { api } = client({ sessionId: 'session-1', events: [event({ sessionId: 'session-2' })] });
    expect(await rejection(api.fetchCommittedEvents('session-1')))
      .toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_IDENTITY' });
    const lf = client({ sessionId: 'session-1', events: [transition({ sessionId: 'session-2' })] });
    expect(await rejection(lf.api.fetchLiveFocusEvents('session-1')))
      .toMatchObject({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_IDENTITY' });
  });

  it('accepts a same-Session snapshot and a same-Session page, empty or not', async () => {
    await expect(client(snapshot({ liveHead: 4 })).api.fetchSessionTemporalState('session-1'))
      .resolves.toEqual(snapshot({ liveHead: 4 }));
    await expect(client({ sessionId: 'session-1', events: [] }).api.fetchCommittedEvents('session-1'))
      .resolves.toEqual([]);
    const page = await client({ sessionId: 'session-1', events: [event()] }).api.fetchCommittedEvents('session-1');
    expect(page.map((entry) => entry.sessionId)).toEqual(['session-1']);
  });
});
