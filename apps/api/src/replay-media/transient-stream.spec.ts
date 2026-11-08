import { createServer, get, type IncomingMessage, type Server } from 'node:http';
import { connect, type AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { boundedRecheck, streamTimingFrom, streamTransient, type StreamReport, type TransientStreamTiming } from './transient-stream';

// S8B-07 CP1-B (contract §15, §19.1) — one bounded response and its termination, over a real loopback HTTP connection
// (the database and the store are faked: the real-PostgreSQL and rclone proof is database/prove-0196-media-service.mjs).
const CHUNK = 1024;
/** A body that yields one KiB every `everyMs`: a slow store, so a termination lands mid-body. */
function slowBody(chunks: number, everyMs: number): Readable {
  let sent = 0;
  return new Readable({
    read() {
      if (sent >= chunks) {
        this.push(null);
        return;
      }
      sent += 1;
      setTimeout(() => this.push(Buffer.alloc(CHUNK, sent % 251)), everyMs);
    },
  });
}

/** A body read from memory in 16 KiB pieces (a fast store, as the step 6 proof pool's): it is read whole at once. */
function memoryBody(size: number): Readable {
  let at = 0;
  return new Readable({
    read() {
      if (at >= size) {
        this.push(null);
        return;
      }
      const next = Math.min(16 * CHUNK, size - at);
      at += next;
      this.push(Buffer.alloc(next, 7));
    },
  });
}

const FAST: TransientStreamTiming = { lifetimeMs: 60_000, recheckEveryMs: 60, recheckTimeoutMs: 40, idleMs: 30_000 };

interface Fetched { status: number; headers: IncomingMessage['headers']; bytes: number; error: boolean; endedAt: number }

async function serve(body: () => Readable, size: number, serveForMs: number, timing: TransientStreamTiming,
  recheck: () => Promise<boolean>): Promise<{ fetched: Fetched; report: StreamReport }> {
  let report!: Promise<StreamReport>;
  const server: Server = createServer((_request, response) => {
    response.setHeader('Cache-Control', 'no-store, private');
    report = streamTransient(response, { status: 200, contentLength: size, contentRange: null, body: body(), serveForMs }, timing, recheck);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const fetched = await new Promise<Fetched>((resolve) => {
    get({ host: '127.0.0.1', port, path: '/' }, (response) => {
      let bytes = 0;
      let error = false;
      response.on('data', (chunk: Buffer) => { bytes += chunk.length; });
      response.on('error', () => { error = true; });
      response.on('close', () => resolve({
        status: response.statusCode ?? 0, headers: response.headers, bytes, error: error || !response.complete, endedAt: Date.now(),
      }));
    }).on('error', () => resolve({ status: 0, headers: {}, bytes: 0, error: true, endedAt: Date.now() }));
  });
  const done = await report;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return { fetched, report: done };
}

describe('a transient response (contract §15, §19.1)', () => {
  it('h (control): an unaffected read completes with every byte; private, never a download', async () => {
    const { fetched, report } = await serve(() => slowBody(20, 1), 20 * CHUNK, 60_000, FAST, async () => true);
    expect([fetched.status, fetched.bytes, fetched.error]).toEqual([200, 20 * CHUNK, false]);
    expect(fetched.headers['cache-control']).toBe('no-store, private');
    expect(fetched.headers['content-type']).toBe('audio/mp4');
    expect(fetched.headers['accept-ranges']).toBe('bytes');
    expect(fetched.headers['content-disposition']).toBeUndefined();
    expect([report.outcome, report.bytesSent, report.bytesRefusedAfterTermination]).toEqual(['COMPLETE', 20 * CHUNK, 0]);
  });

  it('a: a refused re-check destroys the response mid-body (an error, never a clean end); nothing is sent after it', async () => {
    let refuse = false;
    setTimeout(() => { refuse = true; }, 150);
    const { fetched, report } = await serve(() => slowBody(200, 10), 200 * CHUNK, 60_000, FAST, async () => !refuse);
    expect(report.outcome).toBe('RECHECK');
    expect(fetched.error).toBe(true);
    expect(fetched.bytes).toBeLessThan(200 * CHUNK);
    expect(fetched.bytes).toBeLessThanOrEqual(report.bytesSent);
    expect(report.bytesRefusedAfterTermination).toBe(0);
    // Within one re-check period of the refusal.
    expect(report.endedAt).toBeLessThan(Date.now());
  });

  it('b: a known end: destroyed at serve_until', async () => {
    const started = Date.now();
    const { fetched, report } = await serve(() => slowBody(200, 10), 200 * CHUNK, 250, { ...FAST, recheckEveryMs: 10_000 }, async () => true);
    expect(report.outcome).toBe('SOURCE_END');
    expect(fetched.error).toBe(true);
    expect(Math.abs(report.endedAt - started - 250)).toBeLessThan(200);
  });

  it('f: a re-check that does not answer within its budget, or fails, is a refusal (fail-closed)', async () => {
    const hang = await serve(() => slowBody(200, 10), 200 * CHUNK, 60_000, FAST, () => new Promise<boolean>(() => undefined));
    expect(hang.report.outcome).toBe('RECHECK');
    const failing = await serve(() => slowBody(200, 10), 200 * CHUNK, 60_000, FAST, () => Promise.reject(new Error('lost')));
    expect(failing.report.outcome).toBe('RECHECK');
    expect([hang.fetched.error, failing.fetched.error]).toEqual([true, true]);
  });

  it('V-35 (5): the response lifetime cap ends a response that would otherwise run on, so the phone resumes with Range', async () => {
    const { fetched, report } = await serve(() => slowBody(200, 10), 200 * CHUNK, 60_000, { ...FAST, lifetimeMs: 200, recheckEveryMs: 10_000 }, async () => true);
    expect(report.outcome).toBe('LIFETIME');
    expect([fetched.error, fetched.bytes < 200 * CHUNK]).toEqual([true, true]);
  });

  // S8B-07 CP1-B step 6 (HONOR, r10): a whole body handed to the socket before the client has read it (a fast store, a
  // slow or gone phone) is a response that has ended but not finished; a termination then must still settle the report,
  // or the pool never records the outcome and keeps the request open for ever.
  it.each([
    ['IDLE', { ...FAST, idleMs: 200, recheckEveryMs: 10_000 }, false],
    ['LIFETIME', { ...FAST, lifetimeMs: 200, recheckEveryMs: 10_000 }, false],
    ['CLIENT_GONE', { ...FAST, recheckEveryMs: 10_000 }, true],
  ] as const)('a termination after the body is handed to an unread socket settles: %s', async (outcome, timing, leave) => {
    const size = 200 * CHUNK;
    let report: Promise<StreamReport> | undefined;
    const server: Server = createServer((_request, response) => {
      report = streamTransient(response, { status: 200, contentLength: size, contentRange: null,
        body: memoryBody(size), serveForMs: 60_000 }, timing, async () => true);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const socket = connect((server.address() as AddressInfo).port, '127.0.0.1');
    socket.on('error', () => undefined);
    socket.pause(); // never read: the body waits in the socket buffers
    socket.write('GET / HTTP/1.1\r\nHost: x\r\n\r\n');
    if (leave) setTimeout(() => socket.destroy(), 200);
    const outcomeOf = async () => {
      while (report === undefined) await new Promise((resolve) => setTimeout(resolve, 10));
      return (await report).outcome;
    };
    let timer: NodeJS.Timeout | undefined;
    const settled = await Promise.race([outcomeOf(), new Promise<string>((resolve) => { timer = setTimeout(() => resolve('NOT SETTLED'), 3_000); })]);
    clearTimeout(timer);
    socket.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    // Settled, never left open; COMPLETE when the kernel took the whole body before the termination (a loaded runner).
    expect([outcome, 'COMPLETE']).toContain(settled);
  });

  it('the first re-check runs one period after the response starts, never before the first byte', async () => {
    const calls: number[] = [];
    const started = Date.now();
    await serve(() => slowBody(30, 10), 30 * CHUNK, 60_000, { ...FAST, recheckEveryMs: 120 }, async () => {
      calls.push(Date.now() - started);
      return true;
    });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toBeGreaterThanOrEqual(110);
  });

  it('the timing: 10 min / 5 s / 2 s by default; the cap only lowers; out-of-bound values refuse', () => {
    expect(streamTimingFrom({})).toEqual({ lifetimeMs: 600_000, recheckEveryMs: 5_000, recheckTimeoutMs: 2_000, idleMs: 30_000 });
    expect(streamTimingFrom({ REPLAY_RESPONSE_LIFETIME_MS: '60000' }).lifetimeMs).toBe(60_000);
    expect(() => streamTimingFrom({ REPLAY_RESPONSE_LIFETIME_MS: '600001' })).toThrow(/REPLAY_RESPONSE_LIFETIME_MS/u);
    expect(() => streamTimingFrom({ REPLAY_STREAM_RECHECK_MS: '20000' })).toThrow(/REPLAY_STREAM_RECHECK_MS/u);
    expect(() => streamTimingFrom({ REPLAY_STREAM_RECHECK_TIMEOUT_MS: 'x' })).toThrow(/REPLAY_STREAM_RECHECK_TIMEOUT_MS/u);
  });

  it('boundedRecheck: true only for a true answer in time', async () => {
    expect(await boundedRecheck(async () => true, 50)).toBe(true);
    expect(await boundedRecheck(async () => false, 50)).toBe(false);
    expect(await boundedRecheck(() => Promise.reject(new Error('x')), 50)).toBe(false);
    expect(await boundedRecheck(() => new Promise<boolean>(() => undefined), 30)).toBe(false);
  });
});
