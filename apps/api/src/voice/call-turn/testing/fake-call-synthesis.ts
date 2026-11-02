import { SpeechAdmissionGuard } from '../../speech-admission.guard';
import {
  SpeechSynthesisFailure, type SpeechSynthesisAdapter, type SpeechSynthesisRequest, type SpeechSynthesisResult, type SpeechSynthesisSession,
  type SynthesizedChunk,
} from '../../speech-synthesis.adapter';
import type { ListenSynthesisRoute } from '../../listen/listen-synthesis.route';

/** The admission the route uses in production (the Vertex limits' values; a test fake imports no provider module). */
const FAKE_ADMISSION_LIMITS = { maxInFlight: 4, maxQueued: 8, maxQueueWaitMs: 1_000, breakerErrors: 5, breakerWindowMs: 60_000, breakerOpenMs: 30_000 };

/** 40 ms of PCM s16le mono at 24 kHz per chunk. */
export const FAKE_CALL_TTS_CHUNK_BYTES = 1_920;

export interface FakeCallSynthesisOptions {
  /** Before the first chunk of every attempt (the provider's first byte); a function draws it per attempt (the synthetic proof). */
  readonly firstByteMs?: number | (() => number);
  /** Between chunks. */
  readonly chunkMs?: number;
  /** Characters of text per 40 ms chunk. */
  readonly charsPerChunk?: number;
  /** The first N attempts fail before any audio (a retryable provider failure). */
  readonly failFirst?: number;
}

/**
 * S8B-05 CP2 — a DETERMINISTIC call reply synthesis fake, for tests and the synthetic proof only (never composed by a
 * module): PCM 24 kHz in 40 ms chunks, as many as the text needs, after the delays it is given. No network code. An
 * aborted attempt stops between chunks and reports ABSENT usage (never zero).
 */
export class FakeCallSynthesis implements SpeechSynthesisAdapter {
  readonly provider = 'GEMINI' as const;
  readonly supportsHints = true;
  readonly requests: Array<{ text: string; hint: string | null }> = [];
  private attempts = 0;

  constructor(private readonly options: FakeCallSynthesisOptions = {}) {}

  synthesize(request: SpeechSynthesisRequest): SpeechSynthesisSession {
    this.requests.push({ text: request.text, hint: request.hint });
    this.attempts += 1;
    const fail = this.attempts <= (this.options.failFirst ?? 0);
    const count = Math.max(1, Math.ceil(request.text.length / (this.options.charsPerChunk ?? 6)));
    const sleep = (ms: number) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());
    let settle!: (result: SpeechSynthesisResult) => void;
    let reject!: (error: unknown) => void;
    const result = new Promise<SpeechSynthesisResult>((resolve, no) => { settle = resolve; reject = no; });
    result.catch(() => undefined);
    const options = this.options;
    return {
      result,
      chunks: {
        async *[Symbol.asyncIterator]() {
          await sleep(typeof options.firstByteMs === 'function' ? options.firstByteMs() : (options.firstByteMs ?? 0));
          if (fail) {
            const failure = new SpeechSynthesisFailure('UNAVAILABLE', false, true);
            reject(failure);
            throw failure;
          }
          let produced = 0;
          for (let i = 0; i < count; i += 1) {
            if (request.signal.aborted) {
              settle({ operation: 'GEMINI_SPEECH_GENERATION', voiceId: request.voiceId, hintApplied: true, usage: { completeness: 'ABSENT' } });
              return;
            }
            if (i > 0) await sleep(options.chunkMs ?? 0);
            produced += 1;
            const chunk: SynthesizedChunk = { sequence: i, audio: Buffer.alloc(FAKE_CALL_TTS_CHUNK_BYTES, (i * 7) % 251), contentType: 'audio/pcm' };
            yield chunk;
          }
          settle({
            operation: 'GEMINI_SPEECH_GENERATION', voiceId: request.voiceId, hintApplied: true, pcmSampleRate: 24_000,
            usage: { completeness: 'COMPLETE', source: 'PROVIDER_REPORTED', inputTokens: Math.ceil(request.text.length / 4), audioOutputTokens: produced * 25 },
          } as SpeechSynthesisResult);
        },
      },
    };
  }
}

export function fakeCallSynthesisRoute(adapter: SpeechSynthesisAdapter = new FakeCallSynthesis()): ListenSynthesisRoute {
  return {
    adapter,
    admission: new SpeechAdmissionGuard(FAKE_ADMISSION_LIMITS),
    model: 'gemini-tts-fake',
    voiceId: 'Achird',
    segmentTimeoutMs: () => 10_000,
    retryDelayMs: () => 0,
  };
}
