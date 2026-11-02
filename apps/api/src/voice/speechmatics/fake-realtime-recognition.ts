import type { RecognizedSpeech, SpeechRecognitionUsage, StreamingRecognitionEvent } from '../speech-recognition.adapter';
import { SPEECHMATICS_REALTIME_BYTES_PER_MS } from './speechmatics-realtime.config';
import {
  RealtimeRecognitionFailedError,
  RecognitionEventQueue,
  type FinalizableRecognitionSession,
  type RealtimeRecognitionFailureReason,
} from './speechmatics-realtime.adapter';

/**
 * S8B-04 (CP2) — a DETERMINISTIC realtime recognition fake, for other components' tests only (never composed by a
 * module). No network, no provider: the same script and the same audio always give the same events, timings and usage.
 * Its contract matches SpeechmaticsRealtimeAdapter: sends rejected after end / abort, INTERIM never final, finalize
 * releases the remaining FINALs, a failure ends `events` with RealtimeRecognitionFailedError and reports ABSENT usage.
 */
export interface FakeRealtimeScript {
  /** Events released while audio arrives, each once the given number of chunks (1-based) has been sent. */
  readonly duringAudio?: ReadonlyArray<{ readonly afterChunk: number; readonly event: StreamingRecognitionEvent }>;
  /** The FINALs released by `finalize()` (after `finalizeLatencyMs`), or by `end()` when finalize was never called. */
  readonly onFinalize?: readonly RecognizedSpeech[];
  /** How long the provider takes to answer `finalize()`; 0 (default) answers on the next microtask. */
  readonly finalizeLatencyMs?: number;
  /** The provider never answers `finalize()`: it resolves after `finalizeTimeoutMs` (default 1,000) with no FINAL. */
  readonly finalizeUnanswered?: boolean;
  readonly finalizeTimeoutMs?: number;
  /** Fail the session with a closed reason: at open, after a chunk, at finalize, or at end. */
  readonly failure?: {
    readonly at: 'OPEN' | 'CHUNK' | 'FINALIZE' | 'END';
    readonly reason: RealtimeRecognitionFailureReason;
    /** For `CHUNK`: the session fails once this many chunks (1-based) were sent. */
    readonly afterChunk?: number;
  };
}

type EndResult = { readonly operation: 'SPEECHMATICS_REALTIME_TRANSCRIPTION'; readonly usage: SpeechRecognitionUsage };

export class FakeRealtimeRecognitionSession implements FinalizableRecognitionSession {
  readonly events = new RecognitionEventQueue();
  chunks = 0;
  bytes = 0;
  finalizeCalls = 0;
  state: 'OPEN' | 'ENDED' | 'ABORTED' | 'FAILED' = 'OPEN';
  private failure: RealtimeRecognitionFailedError | null = null;
  private finalized = false;
  private readonly onSignal = () => this.abort();

  constructor(private readonly script: FakeRealtimeScript, private readonly signal: AbortSignal) {
    signal.addEventListener('abort', this.onSignal, { once: true });
  }

  async send(chunk: Buffer): Promise<void> {
    if (this.state !== 'OPEN') throw this.closedError();
    if (chunk.length === 0) return;
    this.chunks += 1;
    this.bytes += chunk.length;
    for (const item of this.script.duringAudio ?? []) if (item.afterChunk === this.chunks) this.events.push(item.event);
    const failure = this.script.failure;
    if (failure?.at === 'CHUNK' && (failure.afterChunk ?? 1) === this.chunks) this.fail(failure.reason);
  }

  async finalize(): Promise<'ANSWERED' | 'TIMED_OUT'> {
    if (this.state !== 'OPEN') throw this.closedError();
    this.finalizeCalls += 1;
    if (this.script.failure?.at === 'FINALIZE') {
      this.fail(this.script.failure.reason);
      throw this.closedError();
    }
    if (this.script.finalizeUnanswered) {
      await wait(this.script.finalizeTimeoutMs ?? 1_000);
      if (this.broken()) throw this.closedError();
      return 'TIMED_OUT'; // the finals so far stand
    }
    await wait(this.script.finalizeLatencyMs ?? 0);
    if (this.broken()) throw this.closedError();
    this.releaseFinals();
    return 'ANSWERED';
  }

  async end(): Promise<EndResult> {
    if (this.state === 'OPEN') {
      if (this.script.failure?.at === 'END') this.fail(this.script.failure.reason);
      else {
        if (!this.script.finalizeUnanswered) this.releaseFinals();
        this.finish('ENDED');
      }
    }
    const usage: SpeechRecognitionUsage = this.state === 'FAILED'
      ? { completeness: 'ABSENT' }
      : { completeness: 'COMPLETE', audioInputMs: Math.round(this.bytes / SPEECHMATICS_REALTIME_BYTES_PER_MS), source: 'GATEWAY_MEASURED' };
    return { operation: 'SPEECHMATICS_REALTIME_TRANSCRIPTION', usage };
  }

  abort(): void {
    if (this.state === 'OPEN') this.finish('ABORTED');
  }

  /** Read through a method so the compiler does not narrow `state` across an await. */
  private broken(): boolean {
    return this.state === 'FAILED' || this.state === 'ABORTED';
  }

  private releaseFinals(): void {
    if (this.finalized) return;
    this.finalized = true;
    for (const speech of this.script.onFinalize ?? []) this.events.push({ kind: 'FINAL', speech });
  }

  private fail(reason: RealtimeRecognitionFailureReason): void {
    this.failure = new RealtimeRecognitionFailedError(reason);
    this.finish('FAILED');
  }

  private finish(state: 'ENDED' | 'ABORTED' | 'FAILED'): void {
    this.state = state;
    this.signal.removeEventListener('abort', this.onSignal);
    if (state === 'FAILED' && this.failure) this.events.fail(this.failure);
    else this.events.end();
  }

  private closedError(): RealtimeRecognitionFailedError {
    return this.failure ?? new RealtimeRecognitionFailedError('SESSION_CLOSED');
  }
}

export class FakeRealtimeRecognitionAdapter {
  readonly provider = 'SPEECHMATICS' as const;
  readonly sessions: FakeRealtimeRecognitionSession[] = [];

  constructor(private readonly script: FakeRealtimeScript = {}) {}

  async openStream(request: { readonly language: 'ar_en'; readonly signal: AbortSignal }): Promise<FinalizableRecognitionSession> {
    if (request.signal.aborted) throw new RealtimeRecognitionFailedError('SESSION_CLOSED');
    if (this.script.failure?.at === 'OPEN') throw new RealtimeRecognitionFailedError(this.script.failure.reason);
    const session = new FakeRealtimeRecognitionSession(this.script, request.signal);
    this.sessions.push(session);
    return session;
  }
}

const wait = (ms: number) => (ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve());
