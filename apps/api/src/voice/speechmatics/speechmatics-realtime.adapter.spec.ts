import { DEFAULT_ASR_BAND_THRESHOLDS } from '../asr-confidence/asr-confidence';
import type { StreamingRecognitionEvent } from '../speech-recognition.adapter';
import { FakeRealtimeRecognitionAdapter } from './fake-realtime-recognition';
import {
  RealtimeRecognitionFailedError,
  SpeechmaticsRealtimeAdapter,
  type FinalizableRecognitionSession,
  type RealtimeSocket,
} from './speechmatics-realtime.adapter';
import { DEFAULT_SPEECHMATICS_REALTIME_URL, loadSpeechmaticsRealtimeConfig } from './speechmatics-realtime.config';

const KEY = 'sm-test-key-0123456789-never-in-an-error';

/** An in-memory WebSocket: records what the adapter writes; the test plays the provider. No network. */
class FakeSocket implements RealtimeSocket {
  binaryType = 'blob';
  bufferedAmount = 0;
  onopen: RealtimeSocket['onopen'] = null;
  onmessage: RealtimeSocket['onmessage'] = null;
  onerror: RealtimeSocket['onerror'] = null;
  onclose: RealtimeSocket['onclose'] = null;
  readonly sent: Array<string | Uint8Array> = [];
  closed: number | null = null;

  constructor(readonly url: string, readonly headers: Readonly<Record<string, string>>) {}

  send(data: string | Uint8Array): void {
    if (this.closed !== null) throw new Error('socket closed');
    this.sent.push(data);
  }

  close(code?: number): void {
    this.closed = code ?? 1000;
  }

  open(): void { this.onopen?.({}); }
  reply(message: object): void { this.onmessage?.({ data: JSON.stringify(message) }); }
  json(): Array<Record<string, unknown>> {
    return this.sent.filter((d): d is string => typeof d === 'string').map((d) => JSON.parse(d));
  }
  frames(): Uint8Array[] { return this.sent.filter((d): d is Uint8Array => typeof d !== 'string'); }
}

const word = (content: string, start: number, end: number, confidence: number) =>
  ({ type: 'word', start_time: start, end_time: end, alternatives: [{ content, confidence }] });
const transcript = (kind: 'AddTranscript' | 'AddPartialTranscript', text: string, results: object[], start: number, end: number) =>
  ({ message: kind, metadata: { transcript: text, start_time: start, end_time: end }, results });

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function setup(limits: Record<string, number> = {}) {
  const sockets: FakeSocket[] = [];
  const adapter = new SpeechmaticsRealtimeAdapter(
    { apiKey: KEY, url: DEFAULT_SPEECHMATICS_REALTIME_URL, thresholds: DEFAULT_ASR_BAND_THRESHOLDS },
    { socketFactory: (url, init) => { const s = new FakeSocket(url, init.headers); sockets.push(s); return s; }, limits },
  );
  const open = adapter.openStream.bind(adapter);
  adapter.openStream = async (request) => { const s = await open(request); opened.push(s); return s; };
  return { adapter, sockets };
}

/** Every session a test leaves open is aborted, so no session timer outlives its test. */
const opened: FinalizableRecognitionSession[] = [];
afterEach(() => { for (const session of opened.splice(0)) session.abort(); });

async function started(limits: Record<string, number> = {}) {
  const { adapter, sockets } = setup(limits);
  const controller = new AbortController();
  const session = await adapter.openStream({ language: 'ar_en', signal: controller.signal });
  const socket = sockets[0];
  socket.open();
  socket.reply({ message: 'RecognitionStarted', id: 'x' });
  return { session, socket, controller };
}

async function collect(session: FinalizableRecognitionSession): Promise<StreamingRecognitionEvent[]> {
  const out: StreamingRecognitionEvent[] = [];
  for await (const event of session.events) out.push(event);
  return out;
}

const pcm = (ms: number) => Buffer.alloc(ms * 32);

describe('SpeechmaticsRealtimeAdapter', () => {
  it('opens the pinned EU endpoint with a Bearer header and sends the measured StartRecognition on open', async () => {
    const { adapter, sockets } = setup();
    await adapter.openStream({ language: 'ar_en', signal: new AbortController().signal });
    const socket = sockets[0];
    expect(socket.url).toBe('wss://eu.rt.speechmatics.com/v2');
    expect(socket.headers).toEqual({ Authorization: `Bearer ${KEY}` });
    expect(socket.sent).toHaveLength(0);
    socket.open();
    expect(socket.json()).toEqual([{
      message: 'StartRecognition',
      audio_format: { type: 'raw', encoding: 'pcm_s16le', sample_rate: 16000 },
      transcription_config: {
        language: 'ar_en', operating_point: 'enhanced', enable_partials: true, max_delay: 0.7, max_delay_mode: 'flexible',
        conversation_config: { end_of_utterance_silence_trigger: 0 },
      },
    }]);
    expect(socket.binaryType).toBe('arraybuffer');
  });

  it('holds audio until RecognitionStarted, then sends one binary frame per chunk in order', async () => {
    const { adapter, sockets } = setup();
    const session = await adapter.openStream({ language: 'ar_en', signal: new AbortController().signal });
    const socket = sockets[0];
    socket.open();
    const first = session.send(Buffer.from([1, 2]));
    const second = session.send(Buffer.from([3, 4]));
    await flush();
    expect(socket.frames()).toHaveLength(0);
    socket.reply({ message: 'RecognitionStarted' });
    await Promise.all([first, second]);
    expect(socket.frames().map((f) => Array.from(f))).toEqual([[1, 2], [3, 4]]);
  });

  it('maps partials to INTERIM and finals to FINAL with the shared band, on the recording clock; skips empty finals', async () => {
    const { session, socket } = await started();
    const events = collect(session);
    socket.reply(transcript('AddPartialTranscript', 'مرحبا', [word('مرحبا', 0.12, 0.5, 0.6)], 0.12, 0.5));
    socket.reply(transcript('AddTranscript', '', [], 0.5, 0.6));
    socket.reply(transcript('AddTranscript', 'مرحبا يا صديقي.', [
      word('مرحبا', 0.12, 0.5, 0.97), word('يا', 0.5, 0.6, 0.95), word('صديقي', 0.6, 1.1, 0.92),
      { type: 'punctuation', start_time: 1.1, end_time: 1.1, alternatives: [{ content: '.', confidence: 1 }] },
    ], 0.12, 1.1));
    socket.reply(transcript('AddTranscript', 'تمام', [word('تمام', 1.3, 1.6, 0.7)], 1.3, 1.6));
    socket.reply(transcript('AddTranscript', 'ok', [{ type: 'word', start_time: 2, end_time: 2.2, alternatives: [{ content: 'ok' }] }], 2, 2.2));
    socket.reply({ message: 'AudioAdded', seq_no: 1 });
    socket.reply({ message: 'Warning', type: 'duration_limit_exceeded', reason: 'x' });
    socket.reply({ message: 'EndOfTranscript' });
    expect(await events).toMatchObject([
      { kind: 'INTERIM', speech: { text: 'مرحبا', band: 'LOW', startMs: 120, endMs: 500 } },
      { kind: 'FINAL', speech: { text: 'مرحبا يا صديقي.', band: 'HIGH', startMs: 120, endMs: 1100 } },
      { kind: 'FINAL', speech: { text: 'تمام', band: 'MEDIUM', startMs: 1300, endMs: 1600 } },
      { kind: 'FINAL', speech: { text: 'ok', band: 'LOW', startMs: 2000, endMs: 2200 } },
    ]);
  });

  it('finalize sends ForceEndOfUtterance after the audio before it, and resolves on the forced EndOfUtterance', async () => {
    const { session, socket } = await started();
    await session.send(pcm(20));
    const finalizing = session.finalize();
    let done = false;
    void finalizing.then(() => { done = true; });
    await flush();
    expect(socket.sent[socket.sent.length - 1]).toBe(JSON.stringify({ message: 'ForceEndOfUtterance' }));
    expect(done).toBe(false);
    socket.reply(transcript('AddTranscript', 'خلاص', [word('خلاص', 0, 0.3, 0.99)], 0, 0.3));
    socket.reply({ message: 'EndOfUtterance', metadata: { start_time: 0.3, end_time: 0.3 } });
    await expect(finalizing).resolves.toBe('ANSWERED');
    const iterator = session.events[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toEqual({ kind: 'FINAL', speech: { text: 'خلاص', band: 'HIGH', startMs: 0, endMs: 300, words: [{ text: 'خلاص', confidence: 0.99, startMs: 0, endMs: 300 }] } });
  });

  it('finalize resolves after the governed timeout when the provider never answers', async () => {
    const { session } = await started({ finalizeTimeoutMs: 20 });
    await expect(session.finalize()).resolves.toBe('TIMED_OUT');
  });

  it('end sends EndOfStream with last_seq_no, waits for EndOfTranscript, closes and reports GATEWAY_MEASURED usage', async () => {
    const { session, socket } = await started();
    await session.send(pcm(100));
    await session.send(pcm(100));
    await session.send(pcm(50));
    await session.send(Buffer.alloc(0)); // not a frame
    const ending = session.end();
    await flush();
    expect(socket.json().pop()).toEqual({ message: 'EndOfStream', last_seq_no: 3 });
    expect(socket.closed).toBeNull();
    socket.reply({ message: 'EndOfTranscript' });
    await expect(ending).resolves.toEqual({
      operation: 'SPEECHMATICS_REALTIME_TRANSCRIPTION',
      usage: { completeness: 'COMPLETE', audioInputMs: 250, source: 'GATEWAY_MEASURED' },
    });
    expect(socket.closed).toBe(1000);
    await expect(collect(session)).resolves.toEqual([]);
    await expect(session.send(pcm(10))).rejects.toMatchObject({ reason: 'SESSION_CLOSED' });
    await expect(session.finalize()).rejects.toBeInstanceOf(RealtimeRecognitionFailedError);
  });

  it('a provider Error ends events with a typed failure, no provider text, and usage ABSENT', async () => {
    const { session, socket } = await started();
    await session.send(pcm(20));
    const events = collect(session);
    socket.reply({ message: 'Error', type: 'not_authorised', reason: `secret provider text ${KEY}` });
    const error = await events.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RealtimeRecognitionFailedError);
    expect(error).toMatchObject({ reason: 'AUTH' });
    expect((error as Error).message).not.toContain('secret');
    expect(socket.closed).toBe(1000);
    await expect(session.send(pcm(10))).rejects.toMatchObject({ reason: 'AUTH' });
    await expect(session.end()).resolves.toMatchObject({ usage: { completeness: 'ABSENT' } });
  });

  it('a socket that closes before EndOfTranscript is a CONNECTION failure; unknown Error types are PROVIDER_ERROR', async () => {
    const a = await started();
    const ending = a.session.end();
    a.socket.onclose?.({ code: 1006 });
    await expect(ending).resolves.toMatchObject({ usage: { completeness: 'ABSENT' } });
    await expect(collect(a.session)).rejects.toMatchObject({ reason: 'CONNECTION' });

    const b = await started();
    b.socket.reply({ message: 'Error', type: 'something_new' });
    await expect(collect(b.session)).rejects.toMatchObject({ reason: 'PROVIDER_ERROR' });
  });

  it('fails with START_TIMEOUT when RecognitionStarted never arrives', async () => {
    const { adapter, sockets } = setup({ startTimeoutMs: 20 });
    const session = await adapter.openStream({ language: 'ar_en', signal: new AbortController().signal });
    sockets[0].open();
    const send = session.send(pcm(20));
    await expect(send).rejects.toMatchObject({ reason: 'START_TIMEOUT' });
    expect(sockets[0].frames()).toHaveLength(0);
  });

  it('fails with BACKPRESSURE beyond the bytes allowed in flight', async () => {
    const { adapter } = setup({ maxPendingBytes: 100 });
    const session = await adapter.openStream({ language: 'ar_en', signal: new AbortController().signal });
    const first = session.send(Buffer.alloc(80));
    await expect(session.send(Buffer.alloc(40))).rejects.toMatchObject({ reason: 'BACKPRESSURE' });
    await expect(first).rejects.toMatchObject({ reason: 'BACKPRESSURE' });
  });

  it('abort closes at once, ends events, refuses further sends; end then reports what was measured', async () => {
    const { session, socket } = await started();
    await session.send(pcm(64));
    const events = collect(session);
    session.abort();
    expect(socket.closed).toBe(1000);
    await expect(events).resolves.toEqual([]);
    socket.reply(transcript('AddTranscript', 'late', [word('late', 0, 1, 1)], 0, 1)); // ignored
    await expect(session.send(pcm(10))).rejects.toMatchObject({ reason: 'SESSION_CLOSED' });
    await expect(session.end()).resolves.toMatchObject({ usage: { completeness: 'COMPLETE', audioInputMs: 64 } });
    expect(socket.json().some((m) => m.message === 'EndOfStream')).toBe(false);
  });

  it("the caller's AbortSignal aborts the session; an already aborted signal opens nothing", async () => {
    const { session, socket, controller } = await started();
    const events = collect(session);
    controller.abort();
    expect(socket.closed).toBe(1000);
    await expect(events).resolves.toEqual([]);

    const { adapter, sockets } = setup();
    await expect(adapter.openStream({ language: 'ar_en', signal: AbortSignal.abort() })).rejects.toMatchObject({ reason: 'SESSION_CLOSED' });
    expect(sockets).toHaveLength(0);
  });

  it('never puts the key in a thrown message', async () => {
    const thrown: unknown[] = [];
    const adapter = new SpeechmaticsRealtimeAdapter(
      { apiKey: KEY, url: DEFAULT_SPEECHMATICS_REALTIME_URL, thresholds: DEFAULT_ASR_BAND_THRESHOLDS },
      { socketFactory: () => { throw new Error(`boom ${KEY}`); } },
    );
    await adapter.openStream({ language: 'ar_en', signal: new AbortController().signal }).catch((e) => thrown.push(e));
    for (const env of [
      { SPEECHMATICS_API_KEY: KEY, SPEECHMATICS_REALTIME_URL: 'ws://eu.rt.speechmatics.com/v2' },
      { SPEECHMATICS_API_KEY: KEY, SPEECHMATICS_REALTIME_URL: `wss://u:${KEY}@eu.rt.speechmatics.com/v2` },
      { SPEECHMATICS_API_KEY: KEY, SPEECHMATICS_REALTIME_URL: `not a url ${KEY}` },
    ]) {
      try { loadSpeechmaticsRealtimeConfig(env); } catch (error) { thrown.push(error); }
    }
    expect(thrown).toHaveLength(4);
    expect(thrown[0]).toMatchObject({ reason: 'CONNECTION' });
    for (const error of thrown) expect(String((error as Error).message)).not.toContain(KEY);
  });
});

describe('loadSpeechmaticsRealtimeConfig', () => {
  it('defaults to the pinned EU endpoint, reads the shared key and band thresholds', () => {
    expect(loadSpeechmaticsRealtimeConfig({})).toEqual({ apiKey: null, url: 'wss://eu.rt.speechmatics.com/v2', thresholds: DEFAULT_ASR_BAND_THRESHOLDS, liveTranscript: 'OFF' });
    const config = loadSpeechmaticsRealtimeConfig({
      SPEECHMATICS_API_KEY: ` ${KEY} `, SPEECHMATICS_REALTIME_URL: 'wss://example.test/v2/', VOICE_ASR_BAND_HIGH: '0.9', VOICE_ASR_BAND_MEDIUM: '0.5',
    });
    expect(config).toEqual({ apiKey: KEY, url: 'wss://example.test/v2', thresholds: { high: 0.9, medium: 0.5 }, liveTranscript: 'OFF' });
    // S8B-04 (CP2): only the exact word ADOPT turns the live transcript on; anything else is OFF.
    expect(loadSpeechmaticsRealtimeConfig({ VOICE_NOTE_LIVE_TRANSCRIPT: ' ADOPT ' }).liveTranscript).toBe('ADOPT');
    expect(loadSpeechmaticsRealtimeConfig({ VOICE_NOTE_LIVE_TRANSCRIPT: 'adopt' }).liveTranscript).toBe('OFF');
    expect(loadSpeechmaticsRealtimeConfig({ VOICE_NOTE_LIVE_TRANSCRIPT: 'true' }).liveTranscript).toBe('OFF');
    expect(() => loadSpeechmaticsRealtimeConfig({ SPEECHMATICS_REALTIME_URL: 'wss://example.test/v2?x=1' })).toThrow('no credentials, query');
  });
});

describe('FakeRealtimeRecognitionAdapter', () => {
  it('replays its script deterministically: interims during audio, finals on finalize, usage from bytes', async () => {
    const speech = { text: 'نعم', band: 'HIGH' as const, startMs: 0, endMs: 300 };
    const fake = new FakeRealtimeRecognitionAdapter({
      duringAudio: [{ afterChunk: 1, event: { kind: 'INTERIM', speech: { ...speech, band: 'LOW' } } }],
      onFinalize: [speech],
      finalizeLatencyMs: 5,
    });
    const session = await fake.openStream({ language: 'ar_en', signal: new AbortController().signal });
    await session.send(pcm(320));
    await session.finalize();
    await expect(session.end()).resolves.toEqual({
      operation: 'SPEECHMATICS_REALTIME_TRANSCRIPTION', usage: { completeness: 'COMPLETE', audioInputMs: 320, source: 'GATEWAY_MEASURED' },
    });
    await expect(collect(session)).resolves.toMatchObject([
      { kind: 'INTERIM', speech: { ...speech, band: 'LOW' } },
      { kind: 'FINAL', speech },
    ]);
  });

  it('fails as the real adapter does: typed failure in events, ABSENT usage', async () => {
    const fake = new FakeRealtimeRecognitionAdapter({ failure: { at: 'CHUNK', afterChunk: 2, reason: 'CONNECTION' } });
    const session = await fake.openStream({ language: 'ar_en', signal: new AbortController().signal });
    await session.send(pcm(10));
    await session.send(pcm(10));
    await expect(session.send(pcm(10))).rejects.toMatchObject({ reason: 'CONNECTION' });
    await expect(collect(session)).rejects.toBeInstanceOf(RealtimeRecognitionFailedError);
    await expect(session.end()).resolves.toMatchObject({ usage: { completeness: 'ABSENT' } });
  });
});
