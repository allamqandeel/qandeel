import { collectSpeechPcm, SpeechSynthesisFailure } from '../speech-synthesis.adapter';
import { VertexSpeechAdapter } from './vertex-speech.adapter';
import {
  loadVertexSpeechConfig, segmentTimeoutMs, VERTEX_SPEECH_LIMITS, VERTEX_SPEECH_MODEL, VERTEX_SPEECH_VOICE, vertexSpeechEndpoint,
} from './vertex-speech.config';
import { SpeechAdmissionGuard, SpeechAdmissionRefused } from '../speech-admission.guard';
import { jsonPaths, VERTEX_SPEECH_REQUEST_PATHS, vertexSpeechRequestBody } from './vertex-speech.request';
import { FakeVertexSpeechServer } from './testing/fake-vertex-speech.server';

/** S8B-04 CP1, contract v1.2 §9.1 / §9.3, AC-09 / AC-10 / AC-11 — against the fake Vertex server only (no paid call). */

const TOKEN = { accessToken: jest.fn().mockResolvedValue('fake-adc-access-token-for-tests-only-0000') };
const STYLE = 'warm, friendly and natural, like a close friend talking casually; relaxed pace';

describe('S8B-04 Vertex speech adapter', () => {
  let server: FakeVertexSpeechServer;
  let adapter: VertexSpeechAdapter;

  beforeEach(async () => {
    server = new FakeVertexSpeechServer();
    const baseUrl = await server.start();
    adapter = new VertexSpeechAdapter({ projectId: 'qandeel-test-01', baseUrl }, TOKEN, { firstByteTimeoutMs: 300, maxAudioBytes: 64 * 1024 });
  });
  afterEach(() => server.stop());

  const run = (text = 'أهلا، سمعتك.', timeoutMs = 3000, signal = new AbortController().signal) =>
    collectSpeechPcm(adapter.synthesize({ text, voiceId: VERTEX_SPEECH_VOICE, hint: STYLE, signal, timeoutMs }), 64 * 1024);
  const failure = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(SpeechSynthesisFailure);
      return error as SpeechSynthesisFailure;
    }
    throw new Error('expected a failure');
  };

  it('streams the PCM in order and reports the provider usage exactly (COMPLETE)', async () => {
    server.next({ kind: 'ok', chunks: 3, chunkBytes: 960 });
    const { pcm, result } = await run();
    expect(pcm.length).toBe(2880);
    expect(result).toEqual({ operation: 'GEMINI_SPEECH_GENERATION', voiceId: 'Achird', hintApplied: true, pcmSampleRate: 24000,
      usage: { completeness: 'COMPLETE', inputTokens: 41, audioOutputTokens: 75, source: 'PROVIDER_REPORTED' } });
    expect(server.calls).toBe(1);
  });

  it('missing usage is ABSENT, never zero', async () => {
    server.next({ kind: 'ok', usage: 'absent' });
    expect((await run()).result.usage).toEqual({ completeness: 'ABSENT' });
  });

  it('sends exactly the closed allowlist to the one endpoint, with a bearer token and nothing else', async () => {
    await run('النص المنطوق فقط.');
    const [request] = server.requests;
    expect(request.path).toBe(`/v1/projects/qandeel-test-01/locations/global/publishers/google/models/${VERTEX_SPEECH_MODEL}:streamGenerateContent?alt=sse`);
    expect(request.bearer).toBe(true);
    expect(request.body).toEqual(vertexSpeechRequestBody('النص المنطوق فقط.', STYLE));
    expect(jsonPaths(request.body).sort()).toEqual([...VERTEX_SPEECH_REQUEST_PATHS].sort());
    const text = (request.body as { contents: [{ parts: [{ text: string }] }] }).contents[0].parts[0].text;
    expect(text).toBe('النص المنطوق فقط.');
    expect(text).not.toContain(STYLE);
  });

  it.each([
    [429, 'OVERLOADED', true], [503, 'UNAVAILABLE', true], [500, 'UNAVAILABLE', true], [408, 'UNAVAILABLE', true],
    [401, 'UNAUTHORIZED', false], [403, 'UNAUTHORIZED', false], [400, 'REJECTED', false],
  ])('status %i before audio → %s (retryable: %s); the adapter itself never retries', async (status, kind, retryable) => {
    server.next({ kind: 'status', status });
    const f = await failure(run());
    expect([f.kind, f.audioStarted, f.providerReached, f.retryable]).toEqual([kind, false, true, retryable]);
    expect(server.calls).toBe(1);
  });

  it('a connection broken after audio started is INTERRUPTED and never retryable', async () => {
    server.next({ kind: 'dropAfterAudio' });
    const f = await failure(run());
    expect([f.kind, f.audioStarted, f.retryable]).toEqual(['INTERRUPTED', true, false]);
  });

  it('an error event after audio is INTERRUPTED; an empty stream is EMPTY; an unreadable one MALFORMED', async () => {
    server.next({ kind: 'errorAfterAudio' }, { kind: 'empty' }, { kind: 'malformed' });
    expect((await failure(run())).kind).toBe('INTERRUPTED');
    expect((await failure(run())).kind).toBe('EMPTY');
    expect((await failure(run())).kind).toBe('MALFORMED');
  });

  it('no first audio byte within the bound → FIRST_BYTE_TIMEOUT (not retried: the provider may still be working)', async () => {
    server.next({ kind: 'firstByteAfter', ms: 1500 });
    const f = await failure(run());
    expect([f.kind, f.audioStarted, f.retryable, f.capacityOrSystem]).toEqual(['FIRST_BYTE_TIMEOUT', false, false, true]);
  });

  it('the whole bound → TIMEOUT after audio has started', async () => {
    server.next({ kind: 'ok', chunks: 20, delayMs: 50 });
    const f = await failure(run('أهلا.', 400));
    expect([f.kind, f.audioStarted]).toEqual(['TIMEOUT', true]);
  });

  it('the caller cancels: CANCELLED, the connection is torn down', async () => {
    server.next({ kind: 'hang' });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    const f = await failure(run('أهلا.', 3000, controller.signal));
    expect([f.kind, f.audioStarted]).toEqual(['CANCELLED', false]);
  });

  it('no credentials: CREDENTIALS, the provider is never reached', async () => {
    const broke = new VertexSpeechAdapter({ projectId: 'qandeel-test-01', baseUrl: 'http://127.0.0.1:9' }, { accessToken: () => Promise.reject(new Error('x')) });
    const f = await failure(collectSpeechPcm(broke.synthesize({ text: 'أهلا', voiceId: 'Achird', hint: STYLE, signal: new AbortController().signal }), 1024));
    expect([f.kind, f.providerReached]).toEqual(['CREDENTIALS', false]);
    expect(server.calls).toBe(0);
  });

  it('more audio than the bound: TOO_LARGE', async () => {
    server.next({ kind: 'ok', chunks: 3, chunkBytes: 30 * 1024 });
    expect((await failure(run())).kind).toBe('TOO_LARGE');
  });

  it('refuses another voice or a missing style before anything is sent', () => {
    expect(() => adapter.synthesize({ text: 'x', voiceId: 'Kore', hint: STYLE, signal: new AbortController().signal })).toThrow('VERTEX_SPEECH_REQUEST_INVALID');
    expect(() => adapter.synthesize({ text: 'x', voiceId: 'Achird', hint: null, signal: new AbortController().signal })).toThrow('VERTEX_SPEECH_REQUEST_INVALID');
  });

  it('a failure carries its class only: never the text, the token or a body', async () => {
    server.next({ kind: 'status', status: 503 });
    const f = await failure(run('نص خاص جدًا'));
    expect(`${f.message} ${JSON.stringify(f)}`).not.toMatch(/نص خاص|fake-adc-access-token|FAKE/u);
  });
});

describe('S8B-04 Vertex speech configuration', () => {
  it('is unbound without a project; the route, model, voice and location are fixed', () => {
    expect(loadVertexSpeechConfig({})).toEqual({ projectId: null, baseUrl: 'https://aiplatform.googleapis.com' });
    const config = loadVertexSpeechConfig({ QANDEEL_VERTEX_TTS_PROJECT: 'qandeel-prod-1' });
    expect(vertexSpeechEndpoint({ ...config, projectId: 'qandeel-prod-1' })).toBe(
      'https://aiplatform.googleapis.com/v1/projects/qandeel-prod-1/locations/global/publishers/google/models/gemini-3.8-flash-tts:streamGenerateContent?alt=sse');
  });

  it('only a plain-http loopback test server may override the base URL', () => {
    expect(loadVertexSpeechConfig({ QANDEEL_VERTEX_TTS_BASE_URL: 'http://127.0.0.1:4010' }).baseUrl).toBe('http://127.0.0.1:4010');
    for (const bad of ['https://generativelanguage.googleapis.com', 'http://example.com', 'https://127.0.0.1:1', 'http://127.0.0.1:1/v1', 'http://u:p@127.0.0.1:1']) {
      expect(() => loadVertexSpeechConfig({ QANDEEL_VERTEX_TTS_BASE_URL: bad })).toThrow();
    }
    expect(() => loadVertexSpeechConfig({ QANDEEL_VERTEX_TTS_PROJECT: 'Bad Project!' })).toThrow();
  });

  it('the segment bound is 0.57 × its longest audio + 2 s; the PROPOSED limits are as recorded', () => {
    expect(segmentTimeoutMs('x'.repeat(240))).toBe(Math.ceil(0.57 * 24 * 1000) + 2000);
    expect(segmentTimeoutMs('أهلا')).toBe(570 + 2000);
    expect(VERTEX_SPEECH_LIMITS).toMatchObject({ firstByteTimeoutMs: 2000, maxInFlight: 4, maxQueued: 8, maxQueueWaitMs: 1000,
      breakerErrors: 5, breakerWindowMs: 60000, breakerOpenMs: 30000, retryJitterMinMs: 200, retryJitterMaxMs: 600 });
  });
});

describe('S8B-04 admission and circuit breaker (AC-11)', () => {
  const limits = { maxInFlight: 2, maxQueued: 1, maxQueueWaitMs: 100, breakerErrors: 3, breakerWindowMs: 1000, breakerOpenMs: 500 };

  it('admits up to the bound, queues one, refuses a full queue at once and a long wait after the bound', async () => {
    const guard = new SpeechAdmissionGuard(limits);
    const a = await guard.enter();
    await guard.enter();
    const queued = guard.enter();
    await expect(guard.enter()).rejects.toEqual(new SpeechAdmissionRefused('QUEUE_FULL'));
    a();
    const c = await queued;
    c();
    const late = new SpeechAdmissionGuard({ ...limits, maxInFlight: 1 });
    await late.enter();
    await expect(late.enter()).rejects.toEqual(new SpeechAdmissionRefused('QUEUE_TIMEOUT'));
  });

  it('opens on capacity / system errors only, refuses at once while open, closes after the period', async () => {
    let now = 0;
    const guard = new SpeechAdmissionGuard(limits, () => now);
    for (let i = 0; i < 5; i += 1) guard.recordFailure(new SpeechSynthesisFailure('REJECTED', false, true));
    expect(guard.circuitOpen).toBe(false);
    for (let i = 0; i < 3; i += 1) guard.recordFailure(new SpeechSynthesisFailure('OVERLOADED', false, true));
    expect(guard.circuitOpen).toBe(true);
    await expect(guard.enter()).rejects.toEqual(new SpeechAdmissionRefused('CIRCUIT_OPEN'));
    now = 501;
    expect(guard.circuitOpen).toBe(false);
    await expect(guard.enter()).resolves.toEqual(expect.any(Function));
  });

  it('errors outside the window do not add up', () => {
    let now = 0;
    const guard = new SpeechAdmissionGuard(limits, () => now);
    guard.recordFailure(new SpeechSynthesisFailure('UNAVAILABLE', false, true));
    guard.recordFailure(new SpeechSynthesisFailure('UNAVAILABLE', false, true));
    now = 1500;
    guard.recordFailure(new SpeechSynthesisFailure('UNAVAILABLE', false, true));
    expect(guard.circuitOpen).toBe(false);
  });
});
