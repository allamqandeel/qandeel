/**
 * S8B-07 CP1-B step 5 — the Replay Media Service client and the presentation map decoder: the five routes, the bounded
 * refusal words, and a map that is used whole or not at all (contract §5.3, §5.4, §6; V-23 C-B2; V-30).
 */
import { BOUNDARY_SHORTENED_MS, boundaryPauseMs, decodePresentationMap, firstWindowOf, momentAt, windowAt } from '../presentation-map';
import { decodeListeningAnswer, decodeReplayAnswer, TransientMediaApiClient, type TransientMediaFetch } from '../transient-media-api';

const CALL = '11111111-1111-4111-8111-111111111111';
const REPLAY = '22222222-2222-4222-8222-222222222222';
const VERSION = '33333333-3333-4333-8333-333333333333';
const COMMAND = '44444444-4444-4444-8444-444444444444';
const A1 = 'a1111111-1111-4111-8111-111111111111';
const A2 = 'a2222222-2222-4222-8222-222222222222';

function client(status: number, body: unknown, offline = false) {
  const seen: { url: string; method?: string; headers?: Record<string, string> }[] = [];
  const fetch: TransientMediaFetch = async (url, init) => {
    seen.push({ url, method: init?.method, headers: init?.headers });
    if (offline) throw new Error('offline');
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { api: new TransientMediaApiClient({ baseUrl: 'https://media.test', fetch }), seen };
}

const RUN = (artifactId?: string) => ({
  ...(artifactId === undefined ? {} : { artifactId }),
  durationMs: 12_000,
  // In file order, as the server sorts them (fromMs, then WINDOW · MIX · GAP · HELD).
  spans: [
    { kind: 'WINDOW', fromMs: 0, toMs: 6_000, track: 'USER', momentOrdinal: 1 },
    { kind: 'GAP', fromMs: 1_000, toMs: 2_000, track: 'USER', gapKind: 'RECONNECTION' },
    { kind: 'WINDOW', fromMs: 4_000, toMs: 9_000, track: 'QANDEEL', momentOrdinal: 2 },
    { kind: 'MIX', fromMs: 4_000, toMs: 6_000 },
    { kind: 'HELD', fromMs: 9_000, toMs: 9_000 + BOUNDARY_SHORTENED_MS, elapsedMs: 4_200, shortened: true },
    { kind: 'WINDOW', fromMs: 10_500, toMs: 12_000, track: 'USER', momentOrdinal: 4 },
  ],
});

describe('the five routes', () => {
  it('asks for a listening set by call and command, through the seam, with no identity of its own', async () => {
    const c = client(200, { artifactId: A1.toUpperCase(), state: 'READY', durationMs: 252_000, readableForMs: 3_480_000, reason: null });
    const result = await c.api.requestListening(CALL, COMMAND);
    expect(c.seen[0]).toMatchObject({ url: `https://media.test/voice/listening/${CALL}/${COMMAND}`, method: 'POST' });
    expect(Object.keys(c.seen[0]!.headers ?? {})).toEqual(['Accept']);
    expect(result).toEqual({
      kind: 'SET',
      set: { state: 'READY', reason: null, readableForMs: 3_480_000, boundaries: [], runs: [{ artifactId: A1, durationMs: 252_000, spans: [] }] },
    });
  });

  it('asks for a Replay set by its version and command; the map rides with it', async () => {
    const body = { state: 'READY', runs: [RUN(A1), RUN(A2)], boundaries: [{ kind: 'CROSS_RECORDING' }], readableForMs: 1_000, reason: null };
    const c = client(200, body);
    const result = await c.api.requestReplay(REPLAY, VERSION, COMMAND);
    expect(c.seen[0]!.url).toBe(`https://media.test/replay/${REPLAY}/versions/${VERSION}/playback/${COMMAND}`);
    expect(result.kind).toBe('SET');
  });

  it('reads the status, names the audio by its id only (the bearer is the seam\'s header), and releases by DELETE', async () => {
    const c = client(200, { state: 'READY', failure: null, readableForMs: 5, reason: null });
    expect(await c.api.status(A1)).toEqual({ kind: 'STATUS', status: { state: 'READY', readableForMs: 5, reason: null } });
    expect(c.api.audioUrl(A1)).toBe(`https://media.test/voice/transient/${A1}`);
    await c.api.release(A1);
    expect(c.seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      `GET https://media.test/voice/transient/${A1}/status`, `DELETE https://media.test/voice/transient/${A1}`,
    ]);
  });
});

describe('the bounded refusal words (A-1, RT-1, INFRA-07 NONE)', () => {
  it.each([
    [404, { outcome: 'NOT_FOUND', reason: 'EXPIRED' }, { kind: 'NOT_FOUND', reason: 'EXPIRED' }],
    [404, { outcome: 'NOT_FOUND', reason: 'DELETED' }, { kind: 'NOT_FOUND', reason: 'DELETED' }],
    [404, { outcome: 'NOT_FOUND', reason: null }, { kind: 'NOT_FOUND', reason: null }],
    // Any other word in the reason claims nothing (V-30).
    [404, { outcome: 'NOT_FOUND', reason: 'ACCOUNT_ERASED' }, { kind: 'NOT_FOUND', reason: null }],
    [409, { outcome: 'COMMAND_REUSED' }, { kind: 'COMMAND_REUSED' }],
    [409, { outcome: 'LIVE_CALL_ACTIVE' }, { kind: 'LIVE_CALL_ACTIVE' }],
    [503, { outcome: 'BUSY' }, { kind: 'BUSY' }],
    [400, { outcome: 'INVALID_REQUEST' }, { kind: 'REFUSED' }],
    [500, {}, { kind: 'UNKNOWN' }],
  ])('%i %j → %j', async (status, body, expected) => {
    expect(await client(status, body).api.requestListening(CALL, COMMAND)).toEqual(expected);
  });

  it('no readable answer is UNKNOWN (the set MAY exist; the same command is asked again)', async () => {
    expect(await client(200, {}, true).api.requestListening(CALL, COMMAND)).toEqual({ kind: 'UNKNOWN' });
    expect(await client(200, {}, true).api.status(A1)).toEqual({ kind: 'UNKNOWN' });
  });
});

describe('strict decoding: used whole or not at all', () => {
  it('refuses a listening answer with an extra or a missing field, an unknown state, or no file', () => {
    const good = { artifactId: A1, state: 'RUNNING', durationMs: 1_000, readableForMs: 0, reason: null };
    expect(decodeListeningAnswer(good)).not.toBeNull();
    expect(decodeListeningAnswer({ ...good, url: 'x' })).toBeNull();
    expect(decodeListeningAnswer({ ...good, state: 'DONE' })).toBeNull();
    expect(decodeListeningAnswer({ ...good, artifactId: 'nope' })).toBeNull();
    const { reason: _r, ...missing } = good;
    expect(decodeListeningAnswer(missing)).toBeNull();
  });

  it('refuses a READY Replay set whose run has no file, and a terminal set that carries runs', () => {
    expect(decodeReplayAnswer({ state: 'READY', runs: [RUN()], boundaries: [], readableForMs: 1, reason: null })).toBeNull();
    expect(decodeReplayAnswer({ state: 'RUNNING', runs: [RUN()], boundaries: [], readableForMs: 1, reason: null })).not.toBeNull();
    expect(decodeReplayAnswer({ state: 'EXPIRED', runs: [RUN(A1)], boundaries: [], readableForMs: 0, reason: 'EXPIRED' })).toBeNull();
    expect(decodeReplayAnswer({ state: 'EXPIRED', runs: [], boundaries: [], readableForMs: 0, reason: 'EXPIRED' }))
      .toEqual({ state: 'EXPIRED', runs: [], boundaries: [], readableForMs: 0, reason: 'EXPIRED' });
  });

  it('refuses a map that is not exactly well formed (never repaired)', () => {
    const ok = [RUN(A1)];
    expect(decodePresentationMap(ok, [])).not.toBeNull();
    // boundaries.length = runs − 1
    expect(decodePresentationMap([RUN(A1), RUN(A2)], [])).toBeNull();
    // CROSS_RECORDING never has a length (L-3)
    expect(decodePresentationMap([RUN(A1), RUN(A2)], [{ kind: 'CROSS_RECORDING', elapsedMs: 5_000 }])).toBeNull();
    // SAME_RECORDING's shortened word must follow D-05.1
    expect(decodePresentationMap([RUN(A1), RUN(A2)], [{ kind: 'SAME_RECORDING', elapsedMs: 2_000, shortened: true }])).toBeNull();
    expect(decodePresentationMap([RUN(A1), RUN(A2)], [{ kind: 'SAME_RECORDING', elapsedMs: 2_000, shortened: false }])).not.toBeNull();
    // A HELD span that is not the D-05.1 translation
    const badHeld = { ...RUN(A1), spans: [...RUN(A1).spans, { kind: 'HELD', fromMs: 0, toMs: 4_000, elapsedMs: 4_000, shortened: false }] };
    expect(decodePresentationMap([badHeld], [])).toBeNull();
    // A span past the file, a span with a text field, a run with no window, spans out of order
    expect(decodePresentationMap([{ ...RUN(A1), spans: [{ kind: 'WINDOW', fromMs: 0, toMs: 20_000, track: 'USER', momentOrdinal: 1 }] }], [])).toBeNull();
    expect(decodePresentationMap([{ ...RUN(A1), spans: [{ kind: 'WINDOW', fromMs: 0, toMs: 5, track: 'USER', momentOrdinal: 1, text: 'x' }] }], [])).toBeNull();
    expect(decodePresentationMap([{ ...RUN(A1), spans: [{ kind: 'MIX', fromMs: 0, toMs: 5 }] }], [])).toBeNull();
    expect(decodePresentationMap([{ ...RUN(A1), spans: [...RUN(A1).spans].reverse() }], [])).toBeNull();
  });
});

describe('the map as the phone reads it', () => {
  const map = decodePresentationMap([RUN(A1)], [])!;
  const run = map.runs[0]!;

  it('V-23 / D-05.5: the moment changes only at a window start, never inside one, never in a held space', () => {
    expect(momentAt(run, 0)).toBe(1);
    expect(momentAt(run, 3_999)).toBe(1);
    expect(momentAt(run, 4_000)).toBe(2); // the latest-started window is current during the overlap
    expect(momentAt(run, 6_500)).toBe(2); // moment 1's window ends: no switch back
    expect(momentAt(run, 9_500)).toBe(2); // a held space keeps the last moment
    expect(windowAt(run, 9_500)).toBeNull();
    expect(momentAt(run, 10_500)).toBe(4);
    expect(firstWindowOf(run, 2)?.fromMs).toBe(4_000);
  });

  it('a multi-unit voice turn is one window, presented once as its first unit\'s moment (C-B1)', () => {
    const multi = decodePresentationMap([{ durationMs: 8_000, spans: [{ kind: 'WINDOW', fromMs: 0, toMs: 8_000, track: 'USER', momentOrdinal: 3 }] }], [])!;
    const seen = new Set<number | null>();
    for (let t = 0; t < 8_000; t += 250) seen.add(momentAt(multi.runs[0]!, t));
    expect([...seen]).toEqual([3]);
  });

  it('§5.4: a boundary pause is real up to 3 s, else 1.5 s; across recordings always 1.5 s, with no length', () => {
    expect(boundaryPauseMs({ kind: 'SAME_RECORDING', elapsedMs: 2_400, shortened: false })).toBe(2_400);
    expect(boundaryPauseMs({ kind: 'SAME_RECORDING', elapsedMs: 9_000, shortened: true })).toBe(1_500);
    expect(boundaryPauseMs({ kind: 'CROSS_RECORDING' })).toBe(1_500);
  });
});
