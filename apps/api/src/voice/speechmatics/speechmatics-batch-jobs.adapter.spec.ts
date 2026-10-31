import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createServer as createNetServer, type AddressInfo } from 'node:net';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import type { ProviderJobId } from '../batch-transcription-jobs.port';
import { loadSpeechmaticsBatchConfig } from './speechmatics-batch.config';
import { parseJsonV2, retryAfterMs, SpeechmaticsBatchJobsAdapter } from './speechmatics-batch-jobs.adapter';

/**
 * S8B-03 (CP1, A6b / A8 / A25) — the real adapter against a fake Speechmatics HTTP server on loopback. Nothing leaves the
 * machine and no key is real.
 */
type Handler = (request: IncomingMessage, body: Buffer, response: ServerResponse) => void | Promise<void>;
/** node's own https module object (not an interop copy), so a spy sees the adapter's call. */
const httpsModule = jest.requireActual<typeof import('node:https')>('node:https');

describe('SpeechmaticsBatchJobsAdapter (loopback)', () => {
  let server: Server;
  let baseUrl: string;
  let handler: Handler;
  /** When set, the server counts the body without keeping it (the memory proof measures the adapter, not the server). */
  let countOnly = false;
  /** Bytes the server has received on the current request, live. */
  let received = 0;
  const seen: { method: string; url: string; headers: IncomingMessage['headers']; bytes: number; body: Buffer }[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      received = 0;
      request.on('data', (chunk: Buffer) => { bytes += chunk.length; received += chunk.length; if (!countOnly) chunks.push(chunk); });
      request.on('end', () => {
        const body = Buffer.concat(chunks);
        seen.push({ method: request.method!, url: request.url!, headers: request.headers, bytes, body });
        void handler(request, body, response);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => new Promise<void>((resolve) => server.close(() => resolve())));
  beforeEach(() => { seen.length = 0; countOnly = false; });

  const adapter = (overrides: Record<string, string> = {}) => {
    const config = loadSpeechmaticsBatchConfig({ SPEECHMATICS_API_KEY: 'test-only-key', SPEECHMATICS_BATCH_BASE_URL: baseUrl, ...overrides });
    return new SpeechmaticsBatchJobsAdapter({ ...config, apiKey: config.apiKey! });
  };
  const reply = (status: number, json?: unknown, headers: Record<string, string> = {}): Handler => (_r, _b, response) => {
    response.writeHead(status, { 'content-type': 'application/json', ...headers });
    response.end(json === undefined ? '' : JSON.stringify(json));
  };
  async function* audio(total: number, chunk = 16 * 1024) {
    for (let sent = 0; sent < total; sent += chunk) yield Buffer.alloc(Math.min(chunk, total - sent), 7);
  }
  const submit = (a: SpeechmaticsBatchJobsAdapter, bytes = 40_000, signal = AbortSignal.timeout(5000)) =>
    a.submit({ audio: audio(bytes), byteSize: bytes, contentType: 'audio/mp4', language: 'ar_en', reference: '3f1c7a2e-0000-4000-8000-000000000001', signal });
  const job = 'job-1' as ProviderJobId;

  it('201 → CREATED: a streamed multipart body with the config, the tracking reference and the exact bytes', async () => {
    handler = reply(201, { id: 'job-1' });
    expect(await submit(adapter())).toEqual({ kind: 'CREATED', jobId: 'job-1' });
    const [request] = seen;
    expect([request.method, request.url]).toEqual(['POST', '/v2/jobs/']);
    expect(request.headers.authorization).toBe('Bearer test-only-key');
    expect(request.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/u);
    expect(Number(request.headers['content-length'])).toBe(request.bytes);
    const text = request.body.toString('latin1');
    const config = JSON.parse(/name="config"\r\n\r\n(.*)\r\n/u.exec(text)![1]);
    expect(config).toEqual({ type: 'transcription', transcription_config: { language: 'ar_en', operating_point: 'enhanced' }, tracking: { reference: '3f1c7a2e-0000-4000-8000-000000000001' } });
    expect(text).toContain('name="data_file"; filename="note.m4a"\r\nContent-Type: audio/mp4');
    expect(request.body.filter((b) => b === 7).length).toBe(40_000);
    expect(text).not.toMatch(/url|storage|key=/iu);
  });

  it.each([
    [400, { kind: 'REJECTED', failure: 'CONFIG_REJECTED' }], [422, { kind: 'REJECTED', failure: 'CONFIG_REJECTED' }],
    [401, { kind: 'REJECTED', failure: 'AUTH' }], [403, { kind: 'REJECTED', failure: 'AUTH' }],
    [413, { kind: 'REJECTED', failure: 'TOO_LARGE' }], [415, { kind: 'REJECTED', failure: 'UNSUPPORTED_AUDIO' }],
    [429, { kind: 'NOT_SENT', failure: 'RATE_LIMITED', retryAfterMs: 2000 }], [503, { kind: 'NOT_SENT', failure: 'UNAVAILABLE', retryAfterMs: 2000 }],
    [500, { kind: 'UNKNOWN' }], [502, { kind: 'UNKNOWN' }],
  ])('submit %i is classified without content', async (status, expected) => {
    handler = reply(status, { detail: 'x' }, { 'retry-after': '2' });
    expect(await submit(adapter())).toEqual(expected);
  });

  it('a timeout after the body started is UNKNOWN, never NOT_SENT', async () => {
    handler = () => undefined; // never answers
    expect(await submit(adapter(), 40_000, AbortSignal.timeout(300))).toEqual({ kind: 'UNKNOWN' });
  });

  it('an aborted signal after the first byte is UNKNOWN', async () => {
    handler = () => undefined;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 150);
    expect(await submit(adapter(), 40_000, controller.signal)).toEqual({ kind: 'UNKNOWN' });
  });

  it('a dropped connection after the body is UNKNOWN; a refused connection before any byte is NOT_SENT', async () => {
    handler = (request) => { request.socket.destroy(); };
    expect(await submit(adapter())).toEqual({ kind: 'UNKNOWN' });
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const port = (closed.address() as AddressInfo).port;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    const config = loadSpeechmaticsBatchConfig({ SPEECHMATICS_API_KEY: 'k', SPEECHMATICS_BATCH_BASE_URL: `http://127.0.0.1:${port}` });
    const offline = new SpeechmaticsBatchJobsAdapter({ ...config, apiKey: 'k' });
    expect(await submit(offline)).toEqual({ kind: 'NOT_SENT', failure: 'NETWORK' });
  });

  it('a 201 without a readable id is UNKNOWN (a job may exist)', async () => {
    handler = reply(201, { nothing: true });
    expect(await submit(adapter())).toEqual({ kind: 'UNKNOWN' });
    // An id the database would refuse (0186: ^[A-Za-z0-9_-]{1,128}$) is not a usable answer either.
    for (const id of ['../x', 'a b', 'x'.repeat(129), '']) {
      handler = reply(201, { id });
      expect(await submit(adapter())).toEqual({ kind: 'UNKNOWN' });
    }
  });

  it('a note whose bytes differ from its declared size is never sent whole', async () => {
    handler = reply(201, { id: 'job-1' });
    const a = adapter();
    const outcome = await a.submit({ audio: audio(10_000), byteSize: 12_000, contentType: 'audio/mp4', language: 'ar_en', reference: '3f1c7a2e-0000-4000-8000-000000000002', signal: AbortSignal.timeout(5000) });
    expect(outcome).toEqual({ kind: 'UNKNOWN' });
  });

  it('a note longer than declared: not one byte beyond the declared size is written, and the outcome is UNKNOWN', async () => {
    handler = reply(201, { id: 'job-1' });
    received = 0;
    const outcome = await adapter().submit({ audio: audio(20_000, 4_000), byteSize: 12_000, contentType: 'audio/mp4', language: 'ar_en', reference: '3f1c7a2e-0000-4000-8000-000000000004', signal: AbortSignal.timeout(5000) });
    expect(outcome).toEqual({ kind: 'UNKNOWN' });
    expect(received).toBeLessThan(12_000 + 1024); // the multipart head is under 1 KiB
    expect(seen).toHaveLength(0); // the request never completed
  });

  /**
   * A19 regression (PR #370): the bytes the adapter has ALREADY SENT must not stay reachable until the request ends. Each
   * chunk is a fresh buffer, as a store stream yields them, and the live ArrayBuffer memory (after a collection) is
   * sampled throughout the send. `fetch` passed the old "ahead of the wire" check (0.6 MiB) while holding ~23 MiB; the
   * held control proves the instrument sees a note kept whole.
   */
  it('streams: a 24 MiB note of fresh chunks is neither read ahead of the wire nor held once sent (A19, 16 MiB)', async () => {
    handler = reply(201, { id: 'job-big' });
    countOnly = true;
    setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc') as () => void;
    const live = () => { gc(); gc(); return process.memoryUsage().arrayBuffers; };
    const MiB = 1024 * 1024;
    const total = 24 * MiB;
    const chunk = 64 * 1024;
    const send = async (keep: Buffer[] | null) => {
      const base = live();
      let peak = 0;
      let ahead = 0;
      async function* note() {
        for (let yielded = 0; yielded < total; yielded += chunk) {
          ahead = Math.max(ahead, yielded - received);
          if (yielded % (2 * MiB) === 0) peak = Math.max(peak, live() - base);
          const bytes = Buffer.alloc(chunk, 7);
          keep?.push(bytes);
          yield bytes;
        }
        peak = Math.max(peak, live() - base);
      }
      const outcome = await adapter().submit({ audio: note(), byteSize: total, contentType: 'audio/mp4', language: 'ar_en', reference: '3f1c7a2e-0000-4000-8000-000000000003', signal: AbortSignal.timeout(30_000) });
      return { outcome, peak, ahead };
    };
    const streamed = await send(null);
    expect(streamed.outcome).toEqual({ kind: 'CREATED', jobId: 'job-big' });
    expect(seen[0].bytes).toBeGreaterThan(total);
    expect(streamed.ahead).toBeLessThan(16 * MiB);
    expect(streamed.peak).toBeLessThan(16 * MiB);
    const held: Buffer[] = [];
    const control = await send(held);
    expect(control.outcome).toEqual({ kind: 'CREATED', jobId: 'job-big' });
    expect(control.peak).toBeGreaterThan(16 * MiB);
    held.length = 0;
  }, 60_000);

  it('an answer before the whole body (413 at once) decides; the rest of the note is never read', async () => {
    const early = createServer((_request, response) => {
      response.writeHead(413, { 'content-type': 'application/json' }).end('{}');
    });
    await new Promise<void>((resolve) => early.listen(0, '127.0.0.1', resolve));
    try {
      const config = loadSpeechmaticsBatchConfig({ SPEECHMATICS_API_KEY: 'k', SPEECHMATICS_BATCH_BASE_URL: `http://127.0.0.1:${(early.address() as AddressInfo).port}` });
      const total = 24 * 1024 * 1024;
      let yielded = 0;
      async function* note() { for (; yielded < total; yielded += 64 * 1024) yield Buffer.alloc(64 * 1024, 7); }
      const outcome = await new SpeechmaticsBatchJobsAdapter({ ...config, apiKey: 'k' }).submit({ audio: note(), byteSize: total, contentType: 'audio/mp4', language: 'ar_en', reference: '3f1c7a2e-0000-4000-8000-000000000005', signal: AbortSignal.timeout(10_000) });
      expect(outcome).toEqual({ kind: 'REJECTED', failure: 'TOO_LARGE' });
      expect(yielded).toBeLessThan(total);
    } finally {
      early.closeAllConnections();
      await new Promise<void>((resolve) => early.close(() => resolve()));
    }
  }, 30_000);

  it('https: node verifies the certificate by default, and nothing (not the key) is written before TLS is up → NOT_SENT', async () => {
    // A plain TCP listener where TLS is expected: the handshake fails, so the request never starts.
    const clear: Buffer[] = [];
    const plain = createNetServer((socket) => {
      socket.on('data', (bytes: Buffer) => { clear.push(bytes); socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); });
      socket.on('error', () => undefined);
    });
    await new Promise<void>((resolve) => plain.listen(0, '127.0.0.1', resolve));
    const spy = jest.spyOn(httpsModule, 'request');
    try {
      const port = (plain.address() as AddressInfo).port;
      expect(await submit(adapter({ SPEECHMATICS_BATCH_BASE_URL: `https://127.0.0.1:${port}` }))).toEqual({ kind: 'NOT_SENT', failure: 'NETWORK' });
      expect(spy).toHaveBeenCalledTimes(1);
      const [url, options] = spy.mock.calls[0] as unknown as [URL, Record<string, unknown>];
      expect(String(url)).toBe(`https://127.0.0.1:${port}/v2/jobs/`);
      for (const relaxed of ['rejectUnauthorized', 'ca', 'agent', 'checkServerIdentity', 'insecureHTTPParser']) expect(options).not.toHaveProperty(relaxed);
      const wire = Buffer.concat(clear).toString('latin1');
      expect(wire).not.toMatch(/test-only-key|authorization|POST|multipart/iu);
    } finally {
      spy.mockRestore();
      await new Promise<void>((resolve) => plain.close(() => resolve()));
    }
  });

  it('the local create limit holds back the third submission inside one second', async () => {
    handler = reply(201, { id: 'job-r' });
    const a = adapter();
    const started = Date.now();
    await Promise.all([submit(a, 100), submit(a, 100), submit(a, 100)]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
  });

  it('status: running / done / rejected / 404 / 410 / 429 / 5xx', async () => {
    const a = adapter();
    for (const [answer, expected] of [
      [reply(200, { job: { status: 'running' } }), { kind: 'RUNNING' }], [reply(200, { job: { status: 'done' } }), { kind: 'DONE' }],
      [reply(200, { job: { status: 'rejected' } }), { kind: 'FAILED', failure: 'UNSUPPORTED_AUDIO' }],
      [reply(404), { kind: 'ABSENT' }], [reply(410), { kind: 'ABSENT' }],
      [reply(429), { kind: 'TRANSIENT', failure: 'RATE_LIMITED' }], [reply(500), { kind: 'TRANSIENT', failure: 'UNAVAILABLE' }],
    ] as [Handler, unknown][]) {
      handler = answer;
      expect(await a.status(job, AbortSignal.timeout(5000))).toEqual(expected);
    }
    expect(seen.every((r) => r.url === '/v2/jobs/job-1' && r.method === 'GET')).toBe(true);
  });

  it('a 429 with Retry-After pauses the read lane', async () => {
    const a = adapter();
    handler = reply(429, {}, { 'retry-after': '1' });
    await a.status(job, AbortSignal.timeout(5000));
    handler = reply(200, { job: { status: 'done' } });
    const started = Date.now();
    expect(await a.status(job, AbortSignal.timeout(5000))).toEqual({ kind: 'DONE' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
  });

  it('fetchResult: json-v2 words with their first alternative; punctuation excluded; the reported duration', async () => {
    handler = reply(200, {
      job: { duration: 3.25 },
      results: [
        { type: 'word', start_time: 0.1, end_time: 0.5, alternatives: [{ content: 'أنا', confidence: 0.98 }, { content: 'انا', confidence: 0.4 }] },
        { type: 'punctuation', start_time: 0.5, end_time: 0.5, alternatives: [{ content: '.', confidence: 1 }] },
        { type: 'word', start_time: 0.6, end_time: 1.0, alternatives: [{ content: 'هنا' }] },
      ],
    });
    expect(await adapter().fetchResult(job, AbortSignal.timeout(5000))).toEqual({
      kind: 'RESULT', providerDurationMs: 3250,
      words: [{ text: 'أنا', confidence: 0.98, startMs: 100, endMs: 500 }, { text: 'هنا', confidence: null, startMs: 600, endMs: 1000 }],
    });
    expect(seen[0].url).toBe('/v2/jobs/job-1/transcript?format=json-v2');
    expect(parseJsonV2({ results: [{ type: 'word', alternatives: [] }] })).toEqual({ kind: 'MALFORMED' });
    expect(parseJsonV2({ nothing: 1 })).toEqual({ kind: 'MALFORMED' });
  });

  it('remove: DELETE without force; 200 / 404 / 410 / 423 / 429 / 5xx', async () => {
    const a = adapter();
    for (const [answer, expected] of [
      [reply(200, { job: {} }), { kind: 'REQUESTED' }], [reply(404), { kind: 'ABSENT' }], [reply(410), { kind: 'ABSENT' }],
      [reply(423), { kind: 'LOCKED' }], [reply(429), { kind: 'TRANSIENT', failure: 'RATE_LIMITED' }], [reply(503), { kind: 'TRANSIENT', failure: 'UNAVAILABLE' }],
    ] as [Handler, unknown][]) {
      handler = answer;
      expect(await a.remove(job, AbortSignal.timeout(5000))).toEqual(expected);
    }
    expect(seen.every((r) => r.method === 'DELETE' && r.url === '/v2/jobs/job-1' && !r.url.includes('force'))).toBe(true);
  });

  it('a read retries once on a network error only', async () => {
    let n = 0;
    handler = (request, _b, response) => {
      n += 1;
      if (n === 1) { request.socket.destroy(); return; }
      reply(200, { job: { status: 'done' } })(request, _b, response);
    };
    expect(await adapter().status(job, AbortSignal.timeout(5000))).toEqual({ kind: 'DONE' });
    expect(n).toBe(2);
  });

  it('findByReference is UNSUPPORTED without the switch, and reads the listing to its end with it', async () => {
    handler = reply(200, { jobs: [] });
    expect(await adapter().findByReference('r-1', AbortSignal.timeout(5000))).toEqual({ kind: 'UNSUPPORTED' });
    expect(seen).toHaveLength(0);
    const on = adapter({ SPEECHMATICS_RECONCILE_BY_REFERENCE: 'true' });
    handler = reply(200, { jobs: [{ id: 'other', tracking: { reference: 'r-0' } }, { id: 'mine', tracking: { reference: 'r-1' } }] });
    expect(await on.findByReference('r-1', AbortSignal.timeout(5000))).toEqual({ kind: 'FOUND', jobId: 'mine' });
    expect(await on.findByReference('r-2', AbortSignal.timeout(5000))).toEqual({ kind: 'NOT_FOUND_IN_COMPLETE_LISTING' });
  });

  it('config: https only (http on loopback), bounded limits, no credentials in the URL; the key is never echoed', () => {
    expect(() => loadSpeechmaticsBatchConfig({ SPEECHMATICS_BATCH_BASE_URL: 'http://example.com' })).toThrow(/https/u);
    expect(() => loadSpeechmaticsBatchConfig({ SPEECHMATICS_BATCH_BASE_URL: 'https://u:p@example.com' })).toThrow(/credentials/u);
    expect(() => loadSpeechmaticsBatchConfig({ SPEECHMATICS_BATCH_CREATES_PER_SECOND: '11' })).toThrow();
    expect(() => loadSpeechmaticsBatchConfig({ VOICE_API_INSTANCES: '6' })).toThrow(/exceed/u);
    expect(loadSpeechmaticsBatchConfig({}).apiKey).toBeNull();
    expect(loadSpeechmaticsBatchConfig({}).baseUrl).toBe('https://eu1.asr.api.speechmatics.com');
    try { loadSpeechmaticsBatchConfig({ SPEECHMATICS_API_KEY: 'secret-value', SPEECHMATICS_BATCH_BASE_URL: 'ftp://x' }); } catch (error) {
      expect(String(error)).not.toContain('secret-value');
    }
  });

  it('Retry-After: seconds, an HTTP date, bounded', () => {
    expect(retryAfterMs('3')).toBe(3000);
    expect(retryAfterMs('9999')).toBe(60_000);
    expect(retryAfterMs(new Date(Date.now() + 5000).toUTCString())).toBeGreaterThan(3000);
    expect(retryAfterMs('soon')).toBeUndefined();
    expect(retryAfterMs(null)).toBeUndefined();
  });
});
