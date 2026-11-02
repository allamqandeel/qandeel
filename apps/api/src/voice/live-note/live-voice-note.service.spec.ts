import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DEFAULT_ASR_BAND_THRESHOLDS } from '../asr-confidence/asr-confidence';
import type { RecognizedWord } from '../batch-transcription-jobs.port';
import type { FinalizableRecognitionSession, RecognizedSpeech, StreamingRecognitionEvent } from '../speech-recognition.adapter';
import {
  LIVE_NOTE_BYTES_PER_MS,
  LiveVoiceNoteService,
  type LiveVoiceNoteOpenOutcome,
  type LiveVoiceNoteStore,
} from './live-voice-note.service';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const SESSION = '33333333-3333-4333-8333-333333333333';
const LIVE = '44444444-4444-4444-8444-444444444444';
const LIVE_2 = '55555555-5555-4555-8555-555555555555';

/**
 * A scripted realtime recognizer behind the PORT (the boundary keeps the Speechmatics adapter and its fake inside their
 * folder): interims and finals while audio arrives, the remaining finals on finalize, an unanswered finalize, a failure.
 */
interface Script {
  readonly duringAudio?: ReadonlyArray<{ readonly afterChunk: number; readonly event: StreamingRecognitionEvent }>;
  readonly onFinalize?: readonly RecognizedSpeech[];
  readonly finalizeUnanswered?: boolean;
  readonly failAtFinalize?: boolean;
}
class ScriptedSession implements FinalizableRecognitionSession {
  finalizeCalls = 0;
  private chunks = 0;
  private state: 'OPEN' | 'CLOSED' | 'FAILED' = 'OPEN';
  private readonly queue: StreamingRecognitionEvent[] = [];
  private waiter: ((r: IteratorResult<StreamingRecognitionEvent>) => void) | null = null;
  private failWaiter: ((e: Error) => void) | null = null;
  constructor(private readonly script: Script) {}
  readonly events: AsyncIterable<StreamingRecognitionEvent> = {
    [Symbol.asyncIterator]: () => ({
      next: () => {
        const item = this.queue.shift();
        if (item) return Promise.resolve({ value: item, done: false });
        if (this.state === 'FAILED') return Promise.reject(new Error('failed'));
        if (this.state === 'CLOSED') return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve, reject) => { this.waiter = resolve; this.failWaiter = reject; });
      },
    }),
  };
  private push(event: StreamingRecognitionEvent) {
    if (this.waiter) { const w = this.waiter; this.waiter = null; w({ value: event, done: false }); } else this.queue.push(event);
  }
  private close(state: 'CLOSED' | 'FAILED') {
    if (this.state !== 'OPEN') return;
    this.state = state;
    if (state === 'FAILED' && this.failWaiter) this.failWaiter(new Error('failed'));
    else this.waiter?.({ value: undefined, done: true });
    this.waiter = null;
  }
  async send(): Promise<void> {
    if (this.state !== 'OPEN') throw new Error('closed');
    this.chunks += 1;
    for (const item of this.script.duringAudio ?? []) if (item.afterChunk === this.chunks) this.push(item.event);
  }
  async finalize(): Promise<'ANSWERED' | 'TIMED_OUT'> {
    if (this.state !== 'OPEN') throw new Error('closed');
    this.finalizeCalls += 1;
    if (this.script.failAtFinalize) { this.close('FAILED'); throw new Error('failed'); }
    await new Promise((resolve) => setTimeout(resolve, this.script.finalizeUnanswered ? 5 : 0));
    if (this.script.finalizeUnanswered) return 'TIMED_OUT';
    for (const speech of this.script.onFinalize ?? []) this.push({ kind: 'FINAL', speech });
    return 'ANSWERED';
  }
  async end() {
    this.close('CLOSED');
    return { operation: 'SPEECHMATICS_REALTIME_TRANSCRIPTION' as const, usage: { completeness: 'ABSENT' as const } };
  }
  abort(): void { this.close('CLOSED'); }
}
class ScriptedRecognizer {
  readonly sessions: ScriptedSession[] = [];
  constructor(private readonly script: Script) {}
  async openStream(): Promise<FinalizableRecognitionSession> {
    const session = new ScriptedSession(this.script);
    this.sessions.push(session);
    return session;
  }
}

class FakeStore implements LiveVoiceNoteStore {
  outcome: LiveVoiceNoteOpenOutcome = 'OPENED';
  readonly opened: string[] = [];
  readonly closed: { liveId: string; state: string; audioMs: number | null }[] = [];
  async open(input: { userId: string; sessionId: string; liveId: string; callId: string }) {
    this.opened.push(input.liveId);
    return this.outcome;
  }
  async close(input: { userId: string; liveId: string; state: 'FINISHED' | 'CANCELLED' | 'FAILED'; audioMs: number | null }) {
    this.closed.push({ liveId: input.liveId, state: input.state, audioMs: input.audioMs });
  }
}

const word = (text: string, confidence: number, startMs: number): RecognizedWord => ({ text, confidence, startMs, endMs: startMs + 300 });
const final = (...words: RecognizedWord[]) => ({
  text: words.map((w) => w.text).join(' '), band: 'HIGH' as const, startMs: words[0]!.startMs, endMs: words[words.length - 1]!.endMs, words,
});
/** 500 ms of 16 kHz mono PCM. */
const chunk = () => Buffer.alloc(500 * LIVE_NOTE_BYTES_PER_MS);
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

function setup(script: Script = {}, mode: 'OFF' | 'ADOPT' = 'ADOPT') {
  const store = new FakeStore();
  const adapter = new ScriptedRecognizer(script);
  const service = new LiveVoiceNoteService(store, adapter, undefined, { mode, thresholds: DEFAULT_ASR_BAND_THRESHOLDS });
  return { store, adapter, service };
}

describe('LiveVoiceNoteService (S8B-04 CP2, D-S1)', () => {
  const clear = { onFinalize: [final(word('أنا', 0.97, 0), word('بخير', 0.95, 300))] };

  it('relays the audio, ignores interims, and at Send gives the whole note classified by the batch rule', async () => {
    const { store, adapter, service } = setup({
      duringAudio: [{ afterChunk: 1, event: { kind: 'INTERIM', speech: { text: 'أنا', band: 'LOW', startMs: 0, endMs: 300 } } }],
      ...clear,
    });
    await service.open(USER, SESSION, LIVE);
    expect(store.opened).toEqual([LIVE]);
    expect(await service.append(USER, LIVE, 0, chunk())).toEqual({ outcome: 'ACCEPTED' });
    expect(await service.append(USER, LIVE, 1, chunk())).toEqual({ outcome: 'ACCEPTED' });
    const answer = await service.finish(USER, LIVE, 2, Promise.resolve(1000));
    expect(answer).toMatchObject({ kind: 'TRANSCRIBED', text: 'أنا بخير', band: 'HIGH', audioMs: 1000 });
    expect(adapter.sessions[0]!.finalizeCalls).toBe(1);
    await settle();
    expect(store.closed).toEqual([{ liveId: LIVE, state: 'FINISHED', audioMs: 1000 }]);
    // Nothing is kept after Send.
    expect(await service.finish(USER, LIVE, 2, Promise.resolve(1000))).toEqual({ kind: 'UNUSABLE', reason: 'NOT_FOUND' });
  });

  it('is OFF unless the flag adopts it: nothing is admitted and no audio can reach the provider', async () => {
    const { store, adapter, service } = setup(clear, 'OFF');
    expect(service.available).toBe(false);
    await expect(service.open(USER, SESSION, LIVE)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(store.opened).toEqual([]);
    expect(adapter.sessions).toHaveLength(0);
  });

  it('opens no provider session when the database refuses (consent, gate, session)', async () => {
    const { store, adapter, service } = setup(clear);
    store.outcome = 'CONSENT_REQUIRED';
    await expect(service.open(USER, SESSION, LIVE)).rejects.toBeInstanceOf(ForbiddenException);
    expect(adapter.sessions).toHaveLength(0);
  });

  it('a lost chunk makes the transcript unusable, stops sending, and settles the ledger row', async () => {
    const { store, adapter, service } = setup(clear);
    await service.open(USER, SESSION, LIVE);
    await service.append(USER, LIVE, 0, chunk());
    expect(await service.append(USER, LIVE, 2, chunk())).toEqual({ outcome: 'UNUSABLE' });
    expect(await service.append(USER, LIVE, 1, chunk())).toEqual({ outcome: 'UNUSABLE' });
    expect(await service.finish(USER, LIVE, 3, Promise.resolve(1500))).toEqual({ kind: 'UNUSABLE', reason: 'GAP' });
    expect(adapter.sessions[0]!.finalizeCalls).toBe(0);
    await settle();
    expect(store.closed).toEqual([{ liveId: LIVE, state: 'CANCELLED', audioMs: 500 }]);
  });

  it('a repeated chunk is ignored (a retried request never doubles the audio)', async () => {
    const { service } = setup(clear);
    await service.open(USER, SESSION, LIVE);
    await service.append(USER, LIVE, 0, chunk());
    expect(await service.append(USER, LIVE, 0, chunk())).toEqual({ outcome: 'DUPLICATE' });
    expect(await service.finish(USER, LIVE, 1, Promise.resolve(500))).toMatchObject({ kind: 'TRANSCRIBED', audioMs: 500 });
  });

  it('a low-confidence negation forces LOW: the batch path transcribes the recording instead', async () => {
    const { service } = setup({ onFinalize: [final(word('أنا', 0.97, 0), word('مش', 0.6, 300), word('موافق', 0.96, 600))] });
    await service.open(USER, SESSION, LIVE);
    await service.append(USER, LIVE, 0, chunk());
    expect(await service.finish(USER, LIVE, 1, Promise.resolve(500))).toEqual({ kind: 'UNUSABLE', reason: 'LOW_BAND' });
  });

  it('a finalize the provider never answered is unusable (never a partial transcript)', async () => {
    const { store, service } = setup({ ...clear, finalizeUnanswered: true });
    await service.open(USER, SESSION, LIVE);
    await service.append(USER, LIVE, 0, chunk());
    expect(await service.finish(USER, LIVE, 1, Promise.resolve(500))).toEqual({ kind: 'UNUSABLE', reason: 'FINALIZE_TIMEOUT' });
    await settle();
    expect(store.closed[0]!.state).toBe('CANCELLED');
  });

  it('audio the recognizer heard must match the recording, and every chunk the phone sent must have arrived', async () => {
    const mismatch = setup(clear);
    await mismatch.service.open(USER, SESSION, LIVE);
    await mismatch.service.append(USER, LIVE, 0, chunk());
    expect(await mismatch.service.finish(USER, LIVE, 1, Promise.resolve(4000))).toEqual({ kind: 'UNUSABLE', reason: 'DURATION_MISMATCH' });
    const unproven = setup(clear);
    await unproven.service.open(USER, SESSION, LIVE);
    await unproven.service.append(USER, LIVE, 0, chunk());
    expect(await unproven.service.finish(USER, LIVE, 1, Promise.resolve(null))).toEqual({ kind: 'UNUSABLE', reason: 'DURATION_MISMATCH' });
    const missing = setup(clear);
    await missing.service.open(USER, SESSION, LIVE);
    await missing.service.append(USER, LIVE, 0, chunk());
    expect(await missing.service.finish(USER, LIVE, 2, Promise.resolve(1000))).toEqual({ kind: 'UNUSABLE', reason: 'MISSING_CHUNKS' });
  });

  it('a failed recognizer is unusable and its row is settled FAILED', async () => {
    const { store, service } = setup({ ...clear, failAtFinalize: true });
    await service.open(USER, SESSION, LIVE);
    await service.append(USER, LIVE, 0, chunk());
    expect(await service.finish(USER, LIVE, 1, Promise.resolve(500))).toEqual({ kind: 'UNUSABLE', reason: 'RECOGNIZER_FAILED' });
    await settle();
    expect(store.closed[0]!.state).toBe('FAILED');
  });

  it('is owned by one human: another cannot send, cancel or read it', async () => {
    const { service } = setup(clear);
    await service.open(USER, SESSION, LIVE);
    await expect(service.append(OTHER, LIVE, 0, chunk())).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.cancel(OTHER, LIVE)).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.finish(OTHER, LIVE, 0, Promise.resolve(0))).toEqual({ kind: 'UNUSABLE', reason: 'NOT_FOUND' });
    expect(await service.append(USER, LIVE, 0, chunk())).toEqual({ outcome: 'ACCEPTED' });
  });

  it('cancel discards everything; a second live note discards the first (one at a time)', async () => {
    const { store, adapter, service } = setup(clear);
    await service.open(USER, SESSION, LIVE);
    await service.append(USER, LIVE, 0, chunk());
    await service.open(USER, SESSION, LIVE_2);
    expect(store.closed).toEqual([{ liveId: LIVE, state: 'CANCELLED', audioMs: 500 }]);
    await expect(service.append(USER, LIVE, 1, chunk())).rejects.toBeInstanceOf(NotFoundException);
    await service.cancel(USER, LIVE_2);
    expect(store.closed[1]).toEqual({ liveId: LIVE_2, state: 'CANCELLED', audioMs: 0 });
    expect(adapter.sessions.map((s) => s.finalizeCalls)).toEqual([0, 0]);
  });

  it('a live note that hears nothing for the idle limit is discarded', async () => {
    jest.useFakeTimers();
    try {
      const { store, service } = setup(clear);
      await service.open(USER, SESSION, LIVE);
      await service.append(USER, LIVE, 0, chunk());
      await jest.advanceTimersByTimeAsync(20_001);
      expect(store.closed).toEqual([{ liveId: LIVE, state: 'CANCELLED', audioMs: 500 }]);
    } finally {
      jest.useRealTimers();
    }
  });
});
