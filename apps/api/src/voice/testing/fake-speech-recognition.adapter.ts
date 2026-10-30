import type {
  AsrConfidenceBand, BatchRecognitionRequest, BatchRecognitionResult, RecognizedSpeech, SpeechRecognitionAdapter,
  SpeechRecognitionUsage, StreamingRecognitionEvent, StreamingRecognitionSession,
} from '../speech-recognition.adapter';

/** The fake's clock: 16 bytes of audio are one millisecond (128 kbit/s), so usage follows from the bytes alone. */
export const FAKE_ASR_BYTES_PER_MS = 16;

/**
 * S8B-02 (CP2) — a DETERMINISTIC speech recognition fake, for tests only (never composed by a module): the same audio and
 * script always give the same segments, bands, anchors and usage. It has no network code. `crash` makes a session end
 * with ABSENT usage, as a crashed provider session must (never zero); `source` chooses the D-2 usage source.
 */
export class FakeSpeechRecognitionAdapter implements SpeechRecognitionAdapter {
  readonly provider = 'SPEECHMATICS' as const;
  readonly calls: Array<'batch' | 'stream'> = [];

  constructor(
    private readonly script: ReadonlyArray<{ text: string; band: AsrConfidenceBand }>,
    private readonly options: { readonly source?: 'PROVIDER_REPORTED' | 'GATEWAY_MEASURED'; readonly crash?: boolean } = {},
  ) {}

  async transcribe(request: BatchRecognitionRequest): Promise<BatchRecognitionResult> {
    this.calls.push('batch');
    let bytes = 0;
    for await (const chunk of request.audio) {
      if (request.signal.aborted) throw new Error('aborted');
      bytes += chunk.length;
    }
    const totalMs = Math.floor(bytes / FAKE_ASR_BYTES_PER_MS);
    return { operation: 'SPEECHMATICS_BATCH_TRANSCRIPTION', segments: this.segments(totalMs), usage: this.usage(totalMs) };
  }

  async openStream(request: { readonly language: 'ar_en'; readonly signal: AbortSignal }): Promise<StreamingRecognitionSession> {
    this.calls.push('stream');
    const events: StreamingRecognitionEvent[] = [];
    let bytes = 0;
    let ended = false;
    const segments = (ms: number) => this.segments(ms);
    const usage = (ms: number) => this.usage(ms);
    return {
      send: async (chunk: Buffer) => {
        if (ended || request.signal.aborted) throw new Error('session ended');
        bytes += chunk.length;
        const [first] = segments(Math.floor(bytes / FAKE_ASR_BYTES_PER_MS));
        if (first) events.push({ kind: 'INTERIM', speech: first });
      },
      events: {
        async *[Symbol.asyncIterator]() {
          yield* events;
        },
      },
      end: async () => {
        ended = true;
        const totalMs = Math.floor(bytes / FAKE_ASR_BYTES_PER_MS);
        for (const speech of segments(totalMs)) events.push({ kind: 'FINAL', speech });
        return { operation: 'SPEECHMATICS_REALTIME_TRANSCRIPTION' as const, usage: usage(totalMs) };
      },
      abort: () => {
        ended = true;
      },
    };
  }

  /** The script spread evenly over the audio's clock, `[start, end)` per line. */
  private segments(totalMs: number): RecognizedSpeech[] {
    if (totalMs <= 0 || this.script.length === 0) return [];
    const step = Math.max(1, Math.floor(totalMs / this.script.length));
    return this.script.map((line, i) => ({
      text: line.text, band: line.band, startMs: i * step, endMs: i === this.script.length - 1 ? totalMs : (i + 1) * step,
    }));
  }

  private usage(totalMs: number): SpeechRecognitionUsage {
    if (this.options.crash) return { completeness: 'ABSENT' };
    return { completeness: 'COMPLETE', audioInputMs: totalMs, source: this.options.source ?? 'GATEWAY_MEASURED' };
  }
}
