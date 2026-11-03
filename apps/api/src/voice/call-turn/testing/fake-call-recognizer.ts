import type { RealtimeRecognition } from '../../live-note/live-voice-note.service';
import type {
  AsrConfidenceBand, FinalizableRecognitionSession, SpeechRecognitionUsage, StreamingRecognitionEvent,
} from '../../speech-recognition.adapter';

/**
 * One scripted FINAL. S8B-05 CP4: `startMs` / `endMs` place it on the recognizer's stream (0 when not given), and a list
 * answers one finalize() with several FINALs in order (a word of residual echo and the person's words, say).
 */
export interface FakeCallFinal {
  readonly text: string;
  readonly band?: AsrConfidenceBand;
  readonly startMs?: number;
  readonly endMs?: number;
}
export type FakeCallLine = FakeCallFinal | readonly FakeCallFinal[];

/** An INTERIM the fake emits while audio arrives: a test proves it never leaves the engine. */
export const FAKE_CALL_INTERIM = 'INTERIM-NEVER-COMMITTED';

/**
 * S8B-05 CP2 — a scripted realtime recognizer, for tests and the synthetic proof only (never composed by a module). Each
 * `finalize()` (ForceEndOfUtterance) answers with the next scripted FINAL after `finalDelayMs`; audio sent in between
 * produces INTERIMs only. No network code. Its usage is ABSENT unless `reportUsage`, so the gateway's measured bytes
 * settle the ledger row.
 */
export class FakeCallRecognizer implements RealtimeRecognition {
  readonly sessions: FakeCallRecognitionSession[] = [];

  constructor(private readonly script: readonly FakeCallLine[], private readonly options: { finalDelayMs?: number; openDelayMs?: number; neverAnswer?: boolean } = {}) {}

  async openStream(request: { readonly language: 'ar_en'; readonly signal: AbortSignal }): Promise<FinalizableRecognitionSession> {
    if (this.options.openDelayMs) await new Promise((resolve) => setTimeout(resolve, this.options.openDelayMs));
    const session = new FakeCallRecognitionSession(this.script, this.options, request.signal);
    this.sessions.push(session);
    return session;
  }
}

export class FakeCallRecognitionSession implements FinalizableRecognitionSession {
  bytes = 0;
  finalizes = 0;
  ended = false;
  private readonly queue: StreamingRecognitionEvent[] = [];
  private wake: (() => void) | null = null;
  private done = false;
  private next = 0;

  constructor(
    private readonly script: readonly FakeCallLine[],
    private readonly options: { finalDelayMs?: number; neverAnswer?: boolean },
    signal: AbortSignal,
  ) {
    signal.addEventListener('abort', () => this.abort(), { once: true });
  }

  private emit(event: StreamingRecognitionEvent): void {
    this.queue.push(event);
    this.wake?.();
  }

  async send(chunk: Buffer): Promise<void> {
    if (this.done) throw new Error('SESSION_ENDED');
    this.bytes += chunk.length;
    if (this.bytes % (640 * 10) === 0) this.emit({ kind: 'INTERIM', speech: { text: FAKE_CALL_INTERIM, band: 'LOW', startMs: 0, endMs: 0 } });
  }

  readonly events: AsyncIterable<StreamingRecognitionEvent> = {
    [Symbol.asyncIterator]: () => ({
      next: async (): Promise<IteratorResult<StreamingRecognitionEvent>> => {
        for (;;) {
          const event = this.queue.shift();
          if (event) return { value: event, done: false };
          if (this.done) return { value: undefined, done: true };
          await new Promise<void>((resolve) => { this.wake = resolve; });
          this.wake = null;
        }
      },
    }),
  };

  async finalize(): Promise<'ANSWERED' | 'TIMED_OUT'> {
    this.finalizes += 1;
    if (this.options.neverAnswer) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      return 'TIMED_OUT';
    }
    await new Promise((resolve) => setTimeout(resolve, this.options.finalDelayMs ?? 0));
    const line = this.script[this.next];
    this.next += 1;
    const finals: readonly FakeCallFinal[] = line === undefined ? [] : Array.isArray(line) ? line : [line as FakeCallFinal];
    for (const f of finals) this.emit({ kind: 'FINAL', speech: { text: f.text, band: f.band ?? 'HIGH', startMs: f.startMs ?? 0, endMs: f.endMs ?? 0 } });
    return 'ANSWERED';
  }

  async end(): Promise<{ readonly operation: 'SPEECHMATICS_REALTIME_TRANSCRIPTION'; readonly usage: SpeechRecognitionUsage }> {
    this.ended = true;
    this.done = true;
    this.wake?.();
    return { operation: 'SPEECHMATICS_REALTIME_TRANSCRIPTION', usage: { completeness: 'ABSENT' } };
  }

  abort(): void {
    this.done = true;
    this.wake?.();
  }
}
