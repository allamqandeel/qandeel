import { classifyVoiceNote, type AsrBandThresholds } from '../asr-confidence/asr-confidence';
import type { RecognizedWord } from '../batch-transcription-jobs.port';
import type {
  FinalizableRecognitionSession,
  RecognizedSpeech,
  SpeechRecognitionAdapter,
  SpeechRecognitionUsage,
  StreamingRecognitionEvent,
  StreamingRecognitionSession,
} from '../speech-recognition.adapter';
import {
  SPEECHMATICS_REALTIME_BYTES_PER_MS,
  SPEECHMATICS_REALTIME_LIMITS,
  SPEECHMATICS_REALTIME_RECOGNITION,
  type SpeechmaticsRealtimeConfig,
  type SpeechmaticsRealtimeLimits,
} from './speechmatics-realtime.config';

/**
 * S8B-04 (CP2, the fast voice path) — the Speechmatics REALTIME recognition adapter: the ONE owner of the realtime
 * WebSocket protocol, its authentication and its message parsing. The phone streams 16 kHz mono PCM s16le while it records;
 * this adapter relays it; on Send the caller asks `finalize()` and collects the remaining FINAL events.
 *
 * The protocol is the one S8B-01 measured (scripts/s8b-01/asr-sm.mjs `smSession`, asr-sm-proof-plan.json):
 *   - auth: `Authorization: Bearer <key>` on the WebSocket upgrade (asr-sm.mjs:118; Node 24's global WebSocket, undici,
 *     accepts `{ headers }` as its second argument). No temporary key is minted;
 *   - StartRecognition on open; audio only after RecognitionStarted; one binary frame per AddAudio, counted for
 *     `EndOfStream.last_seq_no`;
 *   - finalize = `ForceEndOfUtterance` (no timestamp: everything heard so far). With Speechmatics' own trigger off, every
 *     EndOfUtterance answers a force; the server answers with AddTranscript then EndOfUtterance (evidence record §9.18).
 *
 * What it never does: log anything; put the key, a transcript or any provider text in an error; commit an interim result
 * (INTERIM is provisional, FINAL alone is final). Usage is GATEWAY_MEASURED from the bytes actually written: the realtime
 * protocol the probe observed reports no audio duration, so PROVIDER_REPORTED is never claimed. A failed session reports
 * ABSENT, never zero.
 */

/** The port's finalizable session (voice/speech-recognition.adapter.ts), re-exported for this folder's callers. */
export type { FinalizableRecognitionSession };

export type RealtimeRecognitionFailureReason =
  | 'AUTH'
  | 'QUOTA'
  | 'TIME_LIMIT'
  | 'REJECTED_CONFIG'
  | 'PROVIDER_ERROR'
  | 'MALFORMED'
  | 'CONNECTION'
  | 'START_TIMEOUT'
  | 'BACKPRESSURE'
  | 'SESSION_CLOSED';

/** A closed reason only: never the key, a transcript or the provider's own text. */
export class RealtimeRecognitionFailedError extends Error {
  constructor(readonly reason: RealtimeRecognitionFailureReason) {
    super(`realtime recognition failed: ${reason}`);
    this.name = 'RealtimeRecognitionFailedError';
  }
}

/** The part of a WebSocket this adapter uses: Node 24's global WebSocket satisfies it; tests inject an in-memory one. */
export interface RealtimeSocket {
  binaryType: string;
  readonly bufferedAmount: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: { readonly code?: number }) => void) | null;
  send(data: string | Uint8Array): void;
  close(code?: number, reason?: string): void;
}

export type RealtimeSocketFactory = (url: string, init: { readonly headers: Readonly<Record<string, string>> }) => RealtimeSocket;

/** Node 24's global WebSocket (undici): its non-standard second argument `{ headers }` carries the Authorization header. */
type HeaderedWebSocket = new (url: string, init: { headers: Record<string, string> }) => RealtimeSocket;
export const nodeWebSocketFactory: RealtimeSocketFactory = (url, init) =>
  new (WebSocket as unknown as HeaderedWebSocket)(url, { headers: { ...init.headers } });

/** The provider's documented Error types, mapped to closed reasons; anything else is PROVIDER_ERROR. */
const ERROR_REASONS: Readonly<Record<string, RealtimeRecognitionFailureReason>> = Object.freeze({
  not_authorised: 'AUTH',
  not_allowed: 'AUTH',
  insufficient_funds: 'QUOTA',
  quota_exceeded: 'QUOTA',
  timelimit_exceeded: 'TIME_LIMIT',
  invalid_message: 'REJECTED_CONFIG',
  invalid_model: 'REJECTED_CONFIG',
  invalid_config: 'REJECTED_CONFIG',
  invalid_audio_type: 'REJECTED_CONFIG',
  protocol_error: 'REJECTED_CONFIG',
});

/**
 * A single-consumer queue of recognition events. Consecutive INTERIMs coalesce (a Speechmatics partial replaces the whole
 * unfinalized hypothesis), so an idle consumer holds at most one interim beside the finals.
 */
export class RecognitionEventQueue implements AsyncIterable<StreamingRecognitionEvent> {
  private readonly items: StreamingRecognitionEvent[] = [];
  private waiter: { resolve: (r: IteratorResult<StreamingRecognitionEvent>) => void; reject: (e: unknown) => void } | null = null;
  private closed = false;
  private failure: Error | null = null;

  push(event: StreamingRecognitionEvent): void {
    if (this.closed) return;
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      waiter.resolve({ value: event, done: false });
      return;
    }
    const last = this.items[this.items.length - 1];
    if (event.kind === 'INTERIM' && last?.kind === 'INTERIM') this.items[this.items.length - 1] = event;
    else this.items.push(event);
  }

  end(): void {
    if (this.closed) return;
    this.closed = true;
    this.settle();
  }

  fail(error: Error): void {
    if (this.closed) return;
    this.closed = true;
    this.failure = error;
    this.settle();
  }

  private settle(): void {
    if (!this.waiter || this.items.length > 0) return;
    const waiter = this.waiter;
    this.waiter = null;
    if (this.failure) waiter.reject(this.failure);
    else waiter.resolve({ value: undefined, done: true });
  }

  [Symbol.asyncIterator](): AsyncIterator<StreamingRecognitionEvent> {
    return {
      next: () => {
        const item = this.items.shift();
        if (item) return Promise.resolve({ value: item, done: false });
        if (this.closed) {
          if (this.failure) return Promise.reject(this.failure);
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise((resolve, reject) => { this.waiter = { resolve, reject }; });
      },
      return: () => Promise.resolve({ value: undefined, done: true }),
    };
  }
}

interface ProviderResult {
  type?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  alternatives?: unknown;
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** One AddTranscript / AddPartialTranscript as speech on the recording clock; null when it holds no word. */
/**
 * S8B-04 (CP2): a final also carries its words (text, confidence, timing), so the whole note can be classified once by the
 * SAME rule the batch path uses (classifyVoiceNote: band, high-impact words, uncertain tokens). Never logged or kept.
 */
export type RecognizedSpeechWithWords = RecognizedSpeech & { readonly words: readonly RecognizedWord[] };

export function speechOf(message: { metadata?: unknown; results?: unknown }, thresholds: AsrBandThresholds): RecognizedSpeechWithWords | null {
  if (!Array.isArray(message.results)) return null;
  const words: RecognizedWord[] = [];
  const pieces: string[] = [];
  for (const result of message.results as ProviderResult[]) {
    if (!result || typeof result !== 'object') continue;
    const first = Array.isArray(result.alternatives) ? (result.alternatives[0] as { content?: unknown; confidence?: unknown } | undefined) : undefined;
    if (!first || typeof first.content !== 'string' || !finite(result.start_time) || !finite(result.end_time)) continue;
    if (result.type === 'word') {
      const confidence = typeof first.confidence === 'number' && Number.isFinite(first.confidence) ? first.confidence : null;
      words.push({ text: first.content, confidence, startMs: Math.round(result.start_time * 1000), endMs: Math.round(result.end_time * 1000) });
      pieces.push(first.content);
    } else if (result.type === 'punctuation' && pieces.length > 0) {
      pieces[pieces.length - 1] += first.content;
    }
  }
  const classified = classifyVoiceNote(words, thresholds);
  if (classified.kind === 'NO_SPEECH') return null;
  const metadata = (message.metadata ?? {}) as { transcript?: unknown; start_time?: unknown; end_time?: unknown };
  const transcript = typeof metadata.transcript === 'string' ? metadata.transcript.trim() : '';
  const text = transcript !== '' ? transcript : pieces.join(' ').trim();
  if (text === '') return null;
  const startMs = finite(metadata.start_time) ? Math.round(metadata.start_time * 1000) : words[0].startMs;
  const endMs = finite(metadata.end_time) ? Math.round(metadata.end_time * 1000) : words[words.length - 1].endMs;
  return { text, band: classified.kind === 'TRANSCRIBED' ? classified.band : 'LOW', startMs, endMs: Math.max(startMs, endMs), words: Object.freeze(words) };
}

type State = 'OPEN' | 'ENDING' | 'ENDED' | 'ABORTED' | 'FAILED';
type EndResult = { readonly operation: 'SPEECHMATICS_REALTIME_TRANSCRIPTION'; readonly usage: SpeechRecognitionUsage };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class SpeechmaticsRealtimeSession implements FinalizableRecognitionSession {
  readonly events = new RecognitionEventQueue();
  private state: State = 'OPEN';
  private failure: RealtimeRecognitionFailedError | null = null;
  private seq = 0;
  private bytesSent = 0;
  private pendingBytes = 0;
  private chain: Promise<void> = Promise.resolve();
  private readonly started: Promise<void>;
  private startedSettle!: { resolve: () => void; reject: (e: Error) => void };
  private readonly finalizeWaiters: Array<() => void> = [];
  private endOfTranscript: (() => void) | null = null;
  private endPromise: Promise<EndResult> | null = null;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly namedTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly onSignal = () => this.abort();

  constructor(
    private readonly socket: RealtimeSocket,
    private readonly signal: AbortSignal,
    private readonly thresholds: AsrBandThresholds,
    private readonly limits: SpeechmaticsRealtimeLimits,
  ) {
    this.started = new Promise<void>((resolve, reject) => { this.startedSettle = { resolve, reject }; });
    this.started.catch(() => undefined);
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => this.writeJson(startRecognition());
    socket.onmessage = (event) => this.onMessage(event.data);
    socket.onerror = () => this.fail('CONNECTION');
    socket.onclose = () => this.fail('CONNECTION'); // a no-op once the session is terminal
    this.timer(limits.startTimeoutMs, () => this.fail('START_TIMEOUT'), 'start');
    signal.addEventListener('abort', this.onSignal, { once: true });
  }

  send(chunk: Buffer): Promise<void> {
    if (this.state !== 'OPEN') return Promise.reject(this.closedError());
    if (chunk.length === 0) return Promise.resolve();
    this.pendingBytes += chunk.length;
    if (this.pendingBytes > this.limits.maxPendingBytes) {
      this.pendingBytes -= chunk.length;
      this.fail('BACKPRESSURE');
      return Promise.reject(this.closedError());
    }
    return this.enqueue(async () => {
      try {
        await this.writable();
        try {
          this.socket.send(chunk);
        } catch {
          this.fail('CONNECTION');
          throw this.closedError();
        }
        this.seq += 1;
        this.bytesSent += chunk.length;
      } finally {
        this.pendingBytes -= chunk.length;
      }
    });
  }

  finalize(): Promise<'ANSWERED' | 'TIMED_OUT'> {
    if (this.state !== 'OPEN') return Promise.reject(this.closedError());
    return this.enqueue(async () => {
      await this.writable();
      const answered = new Promise<'ANSWERED' | 'TIMED_OUT'>((resolve) => {
        const waiter = () => { clearTimeout(timer); this.timers.delete(timer); resolve('ANSWERED'); };
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          const index = this.finalizeWaiters.indexOf(waiter);
          if (index >= 0) this.finalizeWaiters.splice(index, 1);
          resolve('TIMED_OUT'); // the finals received so far stand
        }, this.limits.finalizeTimeoutMs);
        this.timers.add(timer);
        this.finalizeWaiters.push(waiter);
      });
      this.writeJson({ message: 'ForceEndOfUtterance' });
      const outcome = await answered;
      if (this.state === 'FAILED' || this.state === 'ABORTED') throw this.closedError();
      return outcome;
    });
  }

  end(): Promise<EndResult> {
    if (this.endPromise) return this.endPromise;
    if (this.state !== 'OPEN') return (this.endPromise = Promise.resolve(this.result()));
    this.state = 'ENDING';
    this.endPromise = (async () => {
      await this.chain;
      await this.started.catch(() => undefined);
      if (this.state !== 'ENDING') return this.result();
      // Settled by EndOfTranscript, by the end timeout (the finals so far stand) or by a failure (ABSENT).
      const done = new Promise<void>((resolve) => { this.endOfTranscript = resolve; });
      this.timer(this.limits.endTimeoutMs, () => this.finish('ENDED'), 'end');
      this.writeJson({ message: 'EndOfStream', last_seq_no: this.seq });
      await done;
      return this.result();
    })();
    return this.endPromise;
  }

  abort(): void {
    if (this.state === 'ENDED' || this.state === 'ABORTED' || this.state === 'FAILED') return;
    this.finish('ABORTED');
  }

  private result(): EndResult {
    const usage: SpeechRecognitionUsage = this.state === 'FAILED'
      ? { completeness: 'ABSENT' }
      : { completeness: 'COMPLETE', audioInputMs: Math.round(this.bytesSent / SPEECHMATICS_REALTIME_BYTES_PER_MS), source: 'GATEWAY_MEASURED' };
    return { operation: 'SPEECHMATICS_REALTIME_TRANSCRIPTION', usage };
  }

  private closedError(): RealtimeRecognitionFailedError {
    return this.failure ?? new RealtimeRecognitionFailedError('SESSION_CLOSED');
  }

  /** Writes stay in call order: audio before the force that follows it, everything before EndOfStream. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.chain.then(job);
    this.chain = run.then(() => undefined, () => undefined);
    return run;
  }

  /** After RecognitionStarted, while the session is live, and once the socket holds little enough unwritten. */
  private async writable(): Promise<void> {
    await this.started;
    for (;;) {
      if (this.state !== 'OPEN' && this.state !== 'ENDING') throw this.closedError();
      if (this.socket.bufferedAmount <= this.limits.maxBufferedBytes) return;
      await sleep(5);
    }
  }

  private writeJson(message: object): void {
    try {
      this.socket.send(JSON.stringify(message));
    } catch {
      this.fail('CONNECTION');
    }
  }

  private onMessage(data: unknown): void {
    if (typeof data !== 'string' || this.state === 'ABORTED' || this.state === 'FAILED' || this.state === 'ENDED') return;
    let message: { message?: unknown; type?: unknown; metadata?: unknown; results?: unknown };
    try {
      message = JSON.parse(data);
    } catch {
      return this.fail('MALFORMED');
    }
    switch (message?.message) {
      case 'RecognitionStarted':
        this.clearTimer('start');
        this.startedSettle.resolve();
        return;
      case 'AddPartialTranscript':
      case 'AddTranscript': {
        const speech = speechOf(message, this.thresholds);
        if (speech) this.events.push({ kind: message.message === 'AddTranscript' ? 'FINAL' : 'INTERIM', speech });
        return;
      }
      case 'EndOfUtterance':
        this.finalizeWaiters.shift()?.();
        return;
      case 'EndOfTranscript':
        this.finish('ENDED'); // after EndOfStream, or the provider ended the stream by itself: what was heard stands
        return;
      case 'Error':
        return this.fail(typeof message.type === 'string' ? ERROR_REASONS[message.type] ?? 'PROVIDER_ERROR' : 'PROVIDER_ERROR');
      default:
        return; // AudioAdded, Warning, Info and anything newer carry nothing this port reports
    }
  }

  private fail(reason: RealtimeRecognitionFailureReason): void {
    if (this.state === 'ENDED' || this.state === 'ABORTED' || this.state === 'FAILED') return;
    this.failure = new RealtimeRecognitionFailedError(reason);
    this.finish('FAILED');
  }

  /** The one way out: every waiter settles, the timers stop, the socket closes and `events` ends. */
  private finish(state: 'ENDED' | 'ABORTED' | 'FAILED'): void {
    this.state = state;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.namedTimers.clear();
    this.signal.removeEventListener('abort', this.onSignal);
    this.startedSettle.reject(this.closedError());
    for (const waiter of this.finalizeWaiters.splice(0)) waiter();
    this.endOfTranscript?.();
    this.endOfTranscript = null;
    if (state === 'FAILED' && this.failure) this.events.fail(this.failure);
    else this.events.end();
    this.socket.onopen = null;
    this.socket.onmessage = null;
    this.socket.onerror = null;
    this.socket.onclose = null;
    try {
      this.socket.close(1000);
    } catch {
      // already closed
    }
  }

  private timer(ms: number, fire: () => void, name: string): void {
    const timer = setTimeout(() => { this.timers.delete(timer); this.namedTimers.delete(name); fire(); }, ms);
    this.timers.add(timer);
    this.namedTimers.set(name, timer);
  }

  private clearTimer(name: string): void {
    const timer = this.namedTimers.get(name);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.timers.delete(timer);
    this.namedTimers.delete(name);
  }
}

/** The StartRecognition message: the measured S8B-01 configuration, 16 kHz mono PCM s16le, partials on. */
export function startRecognition(): object {
  const r = SPEECHMATICS_REALTIME_RECOGNITION;
  return {
    message: 'StartRecognition',
    audio_format: { type: 'raw', encoding: r.encoding, sample_rate: r.sampleRate },
    transcription_config: {
      language: r.language,
      operating_point: r.operatingPoint,
      enable_partials: true,
      max_delay: r.maxDelayS,
      max_delay_mode: r.maxDelayMode,
      conversation_config: { end_of_utterance_silence_trigger: r.endOfUtteranceSilenceTriggerS },
    },
  };
}

export class SpeechmaticsRealtimeAdapter implements Pick<SpeechRecognitionAdapter, 'provider'> {
  readonly provider = 'SPEECHMATICS' as const;
  private readonly limits: SpeechmaticsRealtimeLimits;

  constructor(
    private readonly config: Omit<SpeechmaticsRealtimeConfig, 'apiKey' | 'liveTranscript'> & { readonly apiKey: string },
    private readonly options: { readonly socketFactory?: RealtimeSocketFactory; readonly limits?: Partial<SpeechmaticsRealtimeLimits> } = {},
  ) {
    this.limits = Object.freeze({ ...SPEECHMATICS_REALTIME_LIMITS, ...options.limits });
  }

  async openStream(request: { readonly language: 'ar_en'; readonly signal: AbortSignal }): Promise<FinalizableRecognitionSession> {
    if (request.language !== 'ar_en') throw new RealtimeRecognitionFailedError('REJECTED_CONFIG');
    if (request.signal.aborted) throw new RealtimeRecognitionFailedError('SESSION_CLOSED');
    let socket: RealtimeSocket;
    try {
      socket = (this.options.socketFactory ?? nodeWebSocketFactory)(this.config.url, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
    } catch {
      throw new RealtimeRecognitionFailedError('CONNECTION');
    }
    return new SpeechmaticsRealtimeSession(socket, request.signal, this.config.thresholds, this.limits);
  }
}
