import {
  SpeechSynthesisFailure, type SpeechSynthesisAdapter, type SpeechSynthesisFailureKind, type SpeechSynthesisRequest,
  type SpeechSynthesisResult, type SpeechSynthesisSession, type SpeechSynthesisUsage, type SynthesizedChunk,
} from '../speech-synthesis.adapter';
import type { AccessTokenSource } from './vertex-speech.auth';
import { VERTEX_SPEECH_LIMITS, VERTEX_SPEECH_VOICE, vertexSpeechEndpoint, type VertexSpeechConfig } from './vertex-speech.config';
import { vertexSpeechRequestBody } from './vertex-speech.request';

/**
 * S8B-04 (CP1, contract v1.2 §9.1 / §9.3, AC-09) — the Google Cloud TTS adapter: ONE attempt of `streamGenerateContent`
 * (SSE) per `synthesize`, streaming raw PCM (24 kHz, 16-bit, mono) as it arrives.
 *
 *   - The first audio byte must arrive within 2,000 ms, and the whole attempt within the caller's bound; otherwise the
 *     attempt is aborted (the connection is torn down) and fails FIRST_BYTE_TIMEOUT / TIMEOUT.
 *   - The caller's signal cancels at any point (CANCELLED).
 *   - A failure is classified (SpeechSynthesisFailure): status classes, NETWORK before audio, INTERRUPTED after audio,
 *     EMPTY, MALFORMED, TOO_LARGE, CREDENTIALS. The adapter itself NEVER retries: whether a second attempt is allowed
 *     (only before audio, only once) is the caller's decision, because every attempt is its own ledger row.
 *   - Usage is read from the stream's `usageMetadata` exactly; if either count is missing the usage is ABSENT, never zero.
 *   - Nothing is logged; the text, the audio, the token and any error body never leave this function.
 */
export class VertexSpeechAdapter implements SpeechSynthesisAdapter {
  readonly provider = 'GEMINI' as const;
  /** The style sentence rides in `speechMetadata.style`. */
  readonly supportsHints = true;
  private readonly endpoint: string;

  constructor(
    config: VertexSpeechConfig & { readonly projectId: string },
    private readonly tokens: AccessTokenSource,
    private readonly limits: { readonly firstByteTimeoutMs: number; readonly maxAudioBytes: number } = { firstByteTimeoutMs: VERTEX_SPEECH_LIMITS.firstByteTimeoutMs, maxAudioBytes: 3_145_728 },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.endpoint = vertexSpeechEndpoint(config);
  }

  synthesize(request: SpeechSynthesisRequest): SpeechSynthesisSession {
    const hint = request.hint;
    if (request.voiceId !== VERTEX_SPEECH_VOICE || hint === null) throw new Error('VERTEX_SPEECH_REQUEST_INVALID');
    const queue = new ChunkQueue();
    const result = this.attempt({ ...request, hint }, (audio) => queue.push(audio)).then(
      (done) => { queue.end(); return done; },
      (error: unknown) => { queue.fail(error); throw error; },
    );
    result.catch(() => undefined);
    return { chunks: queue, result };
  }

  private async attempt(request: SpeechSynthesisRequest & { readonly hint: string }, emit: (audio: Buffer) => void): Promise<SpeechSynthesisResult> {
    if (request.signal.aborted) throw new SpeechSynthesisFailure('CANCELLED', false, false);
    const body = JSON.stringify(vertexSpeechRequestBody(request.text, request.hint));
    let token: string;
    try {
      token = await this.tokens.accessToken();
    } catch {
      throw new SpeechSynthesisFailure('CREDENTIALS', false, false);
    }
    const controller = new AbortController();
    let reason: 'FIRST_BYTE_TIMEOUT' | 'TIMEOUT' | 'CANCELLED' | null = null;
    const abort = (why: 'FIRST_BYTE_TIMEOUT' | 'TIMEOUT' | 'CANCELLED'): void => {
      if (reason === null) {
        reason = why;
        controller.abort();
      }
    };
    let audioStarted = false;
    const fail = (kind: SpeechSynthesisFailureKind) => new SpeechSynthesisFailure(reason ?? kind, audioStarted, true);
    const onCallerAbort = (): void => abort('CANCELLED');
    request.signal.addEventListener('abort', onCallerAbort, { once: true });
    const firstByte = setTimeout(() => { if (!audioStarted) abort('FIRST_BYTE_TIMEOUT'); }, this.limits.firstByteTimeoutMs);
    const whole = setTimeout(() => abort('TIMEOUT'), request.timeoutMs ?? this.limits.firstByteTimeoutMs * 30);
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8', Accept: 'text/event-stream' },
          body,
          signal: controller.signal,
          redirect: 'error',
        });
      } catch {
        throw fail('NETWORK');
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw fail(statusKind(response.status));
      }
      if (!response.body) throw fail('MALFORMED');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let buffer = '';
      let usage: SpeechSynthesisUsage = { completeness: 'ABSENT' };
      let sampleRate: number | null = null;
      let bytes = 0;
      const handle = (block: string): void => {
        const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
        if (data === '') return;
        let event: VertexStreamEvent;
        try {
          event = JSON.parse(data) as VertexStreamEvent;
        } catch {
          throw fail('MALFORMED');
        }
        if (event.error) throw fail(audioStarted ? 'INTERRUPTED' : statusKind(Number(event.error.code)));
        const candidate = event.candidates?.[0];
        for (const part of candidate?.content?.parts ?? []) {
          const inline = part.inlineData;
          if (!inline?.data) continue;
          const rate = /^audio\/(?:L16|pcm)(?:;|$)/iu.test(inline.mimeType ?? '') ? Number(/rate=(\d+)/u.exec(inline.mimeType ?? '')?.[1] ?? 24000) : NaN;
          if (!Number.isInteger(rate) || rate < 8000 || rate > 48000 || (sampleRate !== null && rate !== sampleRate)) throw fail('MALFORMED');
          sampleRate = rate;
          const audio = Buffer.from(inline.data, 'base64');
          if (audio.length === 0) continue;
          bytes += audio.length;
          if (bytes > this.limits.maxAudioBytes) throw fail('TOO_LARGE');
          audioStarted = true;
          clearTimeout(firstByte);
          emit(audio);
        }
        if (event.usageMetadata) usage = readUsage(event.usageMetadata);
        const finish = candidate?.finishReason;
        if (finish !== undefined && finish !== 'STOP' && finish !== 'FINISH_REASON_UNSPECIFIED') throw fail(audioStarted ? 'INTERRUPTED' : 'REJECTED');
      };
      try {
        for (;;) {
          let next: ReadableStreamReadResult<Uint8Array>;
          try {
            next = await reader.read();
          } catch {
            throw fail(audioStarted ? 'INTERRUPTED' : 'NETWORK');
          }
          if (next.done) break;
          try {
            buffer += decoder.decode(next.value, { stream: true }).replace(/\r\n?/gu, '\n');
          } catch {
            throw fail('MALFORMED');
          }
          for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
            handle(buffer.slice(0, end));
            buffer = buffer.slice(end + 2);
          }
          if (buffer.length > 8 * 1024 * 1024) throw fail('MALFORMED');
        }
        if (buffer.trim() !== '') handle(buffer);
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      if (reason !== null) throw fail(reason);
      if (!audioStarted) throw fail('EMPTY');
      return { operation: 'GEMINI_SPEECH_GENERATION', voiceId: VERTEX_SPEECH_VOICE, hintApplied: true, usage, pcmSampleRate: sampleRate ?? 24000 };
    } finally {
      clearTimeout(firstByte);
      clearTimeout(whole);
      request.signal.removeEventListener('abort', onCallerAbort);
      controller.abort();
    }
  }
}

interface VertexStreamEvent {
  readonly candidates?: ReadonlyArray<{
    readonly content?: { readonly parts?: ReadonlyArray<{ readonly inlineData?: { readonly mimeType?: string; readonly data?: string } }> };
    readonly finishReason?: string;
  }>;
  readonly usageMetadata?: VertexUsage;
  readonly error?: { readonly code?: number | string };
}

interface VertexUsage {
  readonly promptTokenCount?: unknown;
  readonly candidatesTokenCount?: unknown;
  readonly candidatesTokensDetails?: ReadonlyArray<{ readonly modality?: string; readonly tokenCount?: unknown }>;
}

const count = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);

/** INPUT_TOKEN = promptTokenCount; AUDIO_OUTPUT_TOKEN = the AUDIO modality's count (else candidatesTokenCount). */
function readUsage(usage: VertexUsage): SpeechSynthesisUsage {
  const input = count(usage.promptTokenCount);
  const audioDetail = usage.candidatesTokensDetails?.find((d) => d.modality === 'AUDIO');
  const audio = audioDetail ? count(audioDetail.tokenCount) : count(usage.candidatesTokenCount);
  return input === null || audio === null ? { completeness: 'ABSENT' }
    : { completeness: 'COMPLETE', inputTokens: input, audioOutputTokens: audio, source: 'PROVIDER_REPORTED' };
}

export function statusKind(status: number): SpeechSynthesisFailureKind {
  if (status === 429) return 'OVERLOADED';
  if ([408, 500, 502, 503, 504].includes(status)) return 'UNAVAILABLE';
  if (status === 401 || status === 403) return 'UNAUTHORIZED';
  return 'REJECTED';
}

/** A single-consumer chunk queue: the adapter pushes, the caller iterates. */
class ChunkQueue implements AsyncIterable<SynthesizedChunk> {
  private readonly items: SynthesizedChunk[] = [];
  private waiting: ((value: IteratorResult<SynthesizedChunk>) => void) | null = null;
  private failWaiting: ((error: unknown) => void) | null = null;
  private done = false;
  private error: unknown = null;
  private sequence = 0;

  push(audio: Buffer): void {
    const chunk: SynthesizedChunk = { sequence: this.sequence++, audio, contentType: 'audio/pcm' };
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      this.failWaiting = null;
      resolve({ value: chunk, done: false });
    } else this.items.push(chunk);
  }

  end(): void {
    this.done = true;
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      this.failWaiting = null;
      resolve({ value: undefined, done: true });
    }
  }

  fail(error: unknown): void {
    this.error = error ?? new Error('SPEECH_SYNTHESIS_FAILED');
    this.done = true;
    if (this.failWaiting) {
      const reject = this.failWaiting;
      this.waiting = null;
      this.failWaiting = null;
      reject(this.error);
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<SynthesizedChunk> {
    return {
      next: () => {
        const item = this.items.shift();
        if (item) return Promise.resolve({ value: item, done: false });
        if (this.error !== null) return Promise.reject(this.error);
        if (this.done) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve, reject) => {
          this.waiting = resolve;
          this.failWaiting = reject;
        });
      },
    };
  }
}
