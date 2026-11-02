import { ForbiddenException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TelemetryService } from '../../observability/telemetry.service';
import {
  MAX_SEGMENTS, SPEECH_HINT_POLICY, SPEECH_STYLE_SENTENCES, toStoredHints, validateSpeechHints,
  type SpeechExpression, type SpeechHintCandidate,
} from '../../speech-rendering';
import { SpeechAdmissionRefused } from '../speech-admission.guard';
import { SpeechSynthesisFailure, type SpeechSynthesisUsage } from '../speech-synthesis.adapter';
import { LISTEN_SYNTHESIS_ROUTE, type ListenSynthesisRoute } from '../listen/listen-synthesis.route';
import { REPLY_SPEECH_LEASE_SECONDS, REPLY_SPEECH_MAX_AUDIO_BYTES, speechSegments } from '../listen/reply-listen.service';
import { WAV_HEADER_BYTES } from '../listen/wav';
import { LIVE_REPLY_STORE, type LiveReplyState, type LiveReplyStore, type LiveSegmentAttemptOutcome } from './live-reply.store';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** The route's PCM: signed 16-bit little-endian mono at 24 kHz (Gemini Flash TTS), 48 bytes per millisecond. */
export const LIVE_REPLY_SAMPLE_RATE = 24000;
const BYTES_PER_MS = (LIVE_REPLY_SAMPLE_RATE * 2) / 1000;
/** Two attempts at most per segment (§9.3), each its own ledger row; never a retry after audio started or after UNKNOWN. */
const MAX_ATTEMPTS = 2;
/** At most two segments synthesize at once per reply (0187 policy: two synthesizing per human). */
const SEGMENT_CONCURRENCY = 2;
/** Nothing paid starts for a phone that is not there: no audio connection within this long after the reply opened... */
export const LIVE_REPLY_FIRST_CONNECT_GRACE_MS = 6000;
/** ...or none for this long after the last one closed (a reconnect inside it is the same listener). */
export const LIVE_REPLY_RECONNECT_GRACE_MS = 3000;
/** A BUSY admission (the human's two slots are taken) is asked again for this long, then the audio stops there. */
const BUSY_RETRY_MS = 4000;
/** The in-memory reply is kept this long after it finished, for a late status or a reconnecting stream (the store stays). */
const KEEP_FINISHED_MS = 60_000;

export interface ReleasedSpeech {
  readonly expression: SpeechExpression;
  /** Hint candidates with offsets in the released piece. */
  readonly hints: readonly SpeechHintCandidate[];
}

/** What the orchestrator tells the reply when the model is done. */
export type LiveReplyEnd =
  | { readonly kind: 'COMPLETE'; readonly assistantTurnId: string }
  | { readonly kind: 'WITHHELD_TAIL'; readonly assistantTurnId: string }
  | { readonly kind: 'FAILED' };

/** The sink the orchestrator writes a VOICE_NOTE reply into while it is generated. */
export interface LiveReplySink {
  readonly replyId: string;
  /** Aborted when nothing more should be produced for this reply (cancelled). Text generation is not stopped by it. */
  readonly signal: AbortSignal;
  /** One released piece of visible text (a whole sentence or more), in order; it may be spoken. */
  release(piece: string, speech: ReleasedSpeech): void;
  end(end: LiveReplyEnd): void;
}

export interface LiveReplyStatus {
  readonly state: LiveReplyState;
  /** Final once known: how much audio the reply has, so the phone stops itself there. */
  readonly audio: { readonly final: true; readonly durationMs: number } | { readonly final: false };
  readonly assistantTurnId: string | null;
  /** The visible text released so far (only while this instance holds the reply); the stored turn is the record. */
  readonly text?: string;
  /** The finished turn's answer, exactly as the voice-note turn route answers it, once the turn is done. */
  readonly exchange?: unknown;
}

/** What the phone already has, so a long-poll answers only with something new. */
export interface LiveReplyKnown {
  readonly textLength: number;
  readonly final: boolean;
  readonly exchange: boolean;
}
const WAIT_FOR_FINAL: LiveReplyKnown = Object.freeze({ textLength: Number.POSITIVE_INFINITY, final: false, exchange: true });

type Production = {
  readonly index: number;
  readonly chunks: Buffer[];
  bytes: number;
  settled: 'READY' | 'FAILED' | null;
  readonly listeners: Set<() => void>;
};

type Op = 'open' | 'synthesis' | 'stream' | 'status' | 'cancel';

/**
 * S8B-04 (CP2, D-S3 + the single-stream decision of 2026-11-01) — the automatic voice reply.
 *
 *   - Each released piece is rendered for speech exactly as Listen renders a reply (the same renderer, the same hint
 *     policy, the same SPOKEN-ALIGN check) and cut into segments. Each segment is synthesized ONCE, server-started, in
 *     order, at most two at a time: per segment the database admits one attempt (one ledger row); a known failure before
 *     any audio may be retried once (its own row); an UNKNOWN outcome or a failure after audio is never retried.
 *   - Nothing paid starts unless the phone is listening: an audio connection opened within the first-connect grace, or
 *     one that closed less than the reconnect grace ago. A cancel stops new synthesis at once. An attempt already running
 *     finishes and is kept (it may already be billed); its audio stays replayable from the store.
 *   - The phone reads ONE stream: every segment's audio in order, back to back, while it is produced. A segment that
 *     fails ends the audio there (nothing after it is spoken, so speech never skips a sentence). When the reply is
 *     finished and every segment settled, the final length is known and announced by `status`; a replay of a complete
 *     reply is the stored audio with a known length, with no provider work.
 *
 * The text is never logged; telemetry names classes only. The store is the authority for every paid state.
 */
@Injectable()
export class LiveReplyService {
  private readonly replies = new Map<string, LiveReply>();

  constructor(
    @Inject(LIVE_REPLY_STORE) private readonly store: LiveReplyStore,
    @Optional() @Inject(LISTEN_SYNTHESIS_ROUTE) private readonly route?: ListenSynthesisRoute,
    @Optional() private readonly telemetry?: TelemetryService,
  ) {}

  /** Whether automatic voice replies can be produced on this instance at all (a synthesis route is configured). */
  get available(): boolean {
    return this.route != null;
  }

  /** Opens the reply for a committed voice-note turn; undefined when it cannot be spoken (the text path is unaffected). */
  async open(userId: string, sessionId: string, sourceTurnId: string): Promise<LiveReplySink | undefined> {
    const route = this.route;
    if (!route) return undefined;
    const replyId = randomUUID();
    let opened: 'OPENED' | 'REFUSED';
    try {
      opened = await this.store.open({ userId, replyId, sessionId, sourceTurnId });
    } catch {
      this.signal('open', 'transport_failure');
      return undefined;
    }
    if (opened !== 'OPENED') {
      this.signal('open', 'refused_expected');
      return undefined;
    }
    const reply = new LiveReply(replyId, userId, this.store, route, (op, outcome) => this.signal(op, outcome), () => {
      setTimeout(() => this.replies.delete(replyId), KEEP_FINISHED_MS).unref?.();
    });
    this.replies.set(replyId, reply);
    this.signal('open', 'success');
    return reply;
  }

  /**
   * The reply's status; with `waitMs`, waits (bounded) until something the phone does not have yet (`known`): more text,
   * the final audio length, or the turn's answer. Without `known` it waits for the final audio length only.
   */
  async status(userId: string, replyId: string, waitMs = 0, known: LiveReplyKnown = WAIT_FOR_FINAL): Promise<LiveReplyStatus> {
    if (!UUID.test(replyId)) throw new NotFoundException({ outcome: 'NOT_FOUND' });
    const local = this.replies.get(replyId);
    if (local) {
      if (local.userId !== userId) throw new NotFoundException({ outcome: 'NOT_FOUND' });
      if (waitMs > 0) await local.waitChange(Math.min(waitMs, 25_000), known);
      return local.status();
    }
    const stored = await this.guarded('status', () => this.store.read(userId, replyId));
    if (!stored) throw new NotFoundException({ outcome: 'NOT_FOUND' });
    const final = stored.state !== 'STREAMING' && stored.audioMs !== null;
    return { state: stored.state, audio: final ? { final: true, durationMs: stored.audioMs! } : { final: false }, assistantTurnId: stored.assistantTurnId };
  }

  /**
   * Writes the reply's audio as ONE WAV stream: a header (length unknown while produced, known for a replay of a finished
   * reply), then every segment's PCM in order. `write` returns false when the reader is gone; `closed` aborts on disconnect.
   */
  async stream(userId: string, replyId: string, sink: AudioStreamSink): Promise<void> {
    if (!UUID.test(replyId)) throw new NotFoundException({ outcome: 'NOT_FOUND' });
    const local = this.replies.get(replyId);
    if (local) {
      if (local.userId !== userId) throw new NotFoundException({ outcome: 'NOT_FOUND' });
      return local.stream(sink);
    }
    // Another instance produced it, or it finished earlier: only a finished reply's stored audio is served from here.
    const stored = await this.guarded('stream', () => this.store.read(userId, replyId));
    if (!stored) throw new NotFoundException({ outcome: 'NOT_FOUND' });
    if (stored.state === 'STREAMING' || stored.segmentCount === null) throw new ServiceUnavailableException({ outcome: 'NOT_AVAILABLE_HERE' });
    const parts: Buffer[] = [];
    for (let index = 0; index < stored.segmentCount; index += 1) {
      const pcm = await this.guarded('stream', () => this.store.readSegmentPcm(userId, replyId, index));
      if (!pcm) throw new NotFoundException({ outcome: 'EXPIRED' });
      parts.push(pcm);
    }
    const pcm = Buffer.concat(parts);
    sink.header(wavHeader(pcm.length));
    sink.write(pcm);
    sink.end();
    this.signal('stream', 'replayed');
  }

  /** The phone stopped listening: nothing new is synthesized for this reply. Its text is unaffected. */
  /** The finished turn's answer (or null when the turn failed), for the phone's next status read on this instance. */
  attachExchange(userId: string, replyId: string, exchange: unknown): void {
    const local = this.replies.get(replyId);
    if (local && local.userId === userId) local.attachExchange(exchange);
  }

  async cancel(userId: string, replyId: string): Promise<void> {
    if (!UUID.test(replyId)) throw new NotFoundException({ outcome: 'NOT_FOUND' });
    const local = this.replies.get(replyId);
    if (local && local.userId !== userId) throw new NotFoundException({ outcome: 'NOT_FOUND' });
    if (local) local.cancel();
    else {
      const stored = await this.guarded('cancel', () => this.store.read(userId, replyId));
      if (!stored) throw new NotFoundException({ outcome: 'NOT_FOUND' });
    }
    this.signal('cancel', 'success');
  }

  private async guarded<T>(op: Op, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.signal(op, 'transport_failure');
      throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
    }
  }

  private signal(op: Op, outcome: string): void {
    try {
      this.telemetry?.recordOperationalOutcome('VOICE_LIVE_REPLY', op, outcome);
    } catch {
      // Observability is best-effort.
    }
  }
}

/** Where a stream writes. `write` returns false once the reader is gone. */
export interface AudioStreamSink {
  header(bytes: Buffer): void;
  write(bytes: Buffer): boolean;
  end(): void;
  /** Resolves when the reader disconnects. */
  readonly closed: Promise<void>;
}

export function wavHeader(dataBytes: number | null): Buffer {
  const h = Buffer.alloc(WAV_HEADER_BYTES);
  h.write('RIFF', 0);
  // An unknown length is written as the largest value: the phone stops itself at the length `status` announces.
  h.writeUInt32LE(dataBytes === null ? 0xffffffff : 36 + dataBytes, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(LIVE_REPLY_SAMPLE_RATE, 24);
  h.writeUInt32LE(LIVE_REPLY_SAMPLE_RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(dataBytes === null ? 0xffffffff : dataBytes, 40);
  return h;
}

class LiveReply implements LiveReplySink {
  readonly signal: AbortSignal;
  private readonly controller = new AbortController();
  /** Spoken segments in order: their text and style. */
  private readonly queue: { text: string; style: string }[] = [];
  private readonly productions: Production[] = [];
  private running = 0;
  private next = 0;
  /** No segment at or after this index is ever spoken (a failure, a misalignment, the cap). */
  private stopAt = Number.POSITIVE_INFINITY;
  private ended: LiveReplyEnd | null = null;
  private finalized: { state: Exclude<LiveReplyState, 'STREAMING'>; segmentCount: number; audioMs: number; assistantTurnId: string | null } | null = null;
  private readonly finalWaiters = new Set<() => void>();
  private connections = 0;
  private readonly openedAt = Date.now();
  private lastDisconnectAt: number | null = null;
  private cancelled = false;
  private text = '';
  private exchange: { readonly value: unknown } | null = null;

  constructor(
    readonly replyId: string,
    readonly userId: string,
    private readonly store: LiveReplyStore,
    private readonly route: ListenSynthesisRoute,
    private readonly signalOutcome: (op: Op, outcome: string) => void,
    private readonly onFinalized: () => void,
  ) {
    this.signal = this.controller.signal;
  }

  release(piece: string, speech: ReleasedSpeech): void {
    if (this.ended || piece.trim() === '') return;
    // The text is shown even when the voice was cancelled: it is the reply.
    this.text += piece;
    this.wake();
    if (this.cancelled) return;
    const candidates = speech.hints.map((hint) => ({ word: hint.word, at: hint.at }));
    const hints = toStoredHints(validateSpeechHints(piece.trim(), candidates, SPEECH_HINT_POLICY === 'OFF' ? 'OFF' : 'B_ALL').hints);
    const segments = speechSegments(piece.trim(), hints);
    if (segments === 'NOTHING_TO_SPEAK') return;
    if (typeof segments === 'string') {
      // A piece that cannot be spoken faithfully ends the audio here: speech never skips a sentence.
      this.stopAt = Math.min(this.stopAt, this.queue.length);
      this.signalOutcome('synthesis', 'refused_expected');
      return;
    }
    const style = SPEECH_STYLE_SENTENCES[speech.expression].style;
    for (const text of segments) {
      if (this.queue.length >= MAX_SEGMENTS) {
        this.stopAt = Math.min(this.stopAt, MAX_SEGMENTS);
        break;
      }
      this.queue.push({ text, style });
    }
    this.pump();
  }

  end(end: LiveReplyEnd): void {
    if (this.ended) return;
    this.ended = end;
    this.pump();
    this.maybeFinalize();
  }

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    this.controller.abort();
    this.stopAt = Math.min(this.stopAt, this.next);
    this.maybeFinalize();
  }

  /** The finished turn's answer, attached by the runner after the turn completed (or failed: then `null`). */
  attachExchange(value: unknown): void {
    if (this.exchange) return;
    this.exchange = { value };
    this.wake();
  }

  status(): LiveReplyStatus {
    const extra = { text: this.text, ...(this.exchange ? { exchange: this.exchange.value } : {}) };
    if (this.finalized) {
      return { state: this.finalized.state, audio: { final: true, durationMs: this.finalized.audioMs }, assistantTurnId: this.finalized.assistantTurnId, ...extra };
    }
    return { state: 'STREAMING', audio: { final: false }, assistantTurnId: null, ...extra };
  }

  waitFinal(ms: number): Promise<void> {
    return this.waitUntil(ms, () => this.finalized !== null);
  }

  waitChange(ms: number, known: LiveReplyKnown): Promise<void> {
    return this.waitUntil(ms, () => this.text.length > known.textLength || (this.finalized !== null && !known.final)
      || (this.exchange !== null && !known.exchange));
  }

  private wake(): void {
    for (const waiter of [...this.finalWaiters]) waiter();
  }

  private async waitUntil(ms: number, ready: () => boolean): Promise<void> {
    const deadline = Date.now() + ms;
    while (!ready()) {
      const left = deadline - Date.now();
      if (left <= 0) return;
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          this.finalWaiters.delete(done);
          resolve();
        };
        const timer = setTimeout(done, left);
        this.finalWaiters.add(done);
      });
    }
  }

  async stream(sink: AudioStreamSink): Promise<void> {
    this.connections += 1;
    let gone = false;
    void sink.closed.then(() => {
      gone = true;
      for (const production of this.productions) for (const listener of [...(production?.listeners ?? [])]) listener();
      this.notifyProgress();
    });
    try {
      if (this.finalized) {
        // A replay: the stored audio with a known length, no provider work.
        const parts = this.productions.slice(0, this.finalized.segmentCount).map((p) => Buffer.concat(p.chunks));
        const pcm = Buffer.concat(parts);
        sink.header(wavHeader(pcm.length));
        sink.write(pcm);
        sink.end();
        this.signalOutcome('stream', 'replayed');
        return;
      }
      sink.header(wavHeader(null));
      this.pump();
      for (let index = 0; !gone; index += 1) {
        const production = await this.productionAt(index, () => gone);
        if (!production) break;
        let offset = 0;
        for (;;) {
          while (offset < production.chunks.length) {
            if (!sink.write(production.chunks[offset]!)) gone = true;
            offset += 1;
          }
          if (gone || production.settled !== null) break;
          await waitFor(production.listeners, () => gone);
        }
        if (production.settled !== 'READY') break;
      }
      sink.end();
      this.signalOutcome('stream', gone ? 'aborted' : 'success');
    } finally {
      this.connections -= 1;
      if (this.connections === 0) this.lastDisconnectAt = Date.now();
    }
  }

  /** The production of segment `index` once it exists; null when that segment will never be spoken. */
  private async productionAt(index: number, gone: () => boolean): Promise<Production | null> {
    for (;;) {
      if (index >= this.stopAt) return null;
      const production = this.productions[index];
      if (production) return production;
      if (this.finalized || (this.ended && index >= this.queue.length)) return null;
      if (gone()) return null;
      await new Promise<void>((resolve) => {
        const done = () => {
          this.finalWaiters.delete(done);
          this.progressWaiters.delete(done);
          resolve();
        };
        this.progressWaiters.add(done);
        this.finalWaiters.add(done);
      });
    }
  }

  private readonly progressWaiters = new Set<() => void>();

  private notifyProgress(): void {
    for (const waiter of [...this.progressWaiters]) waiter();
  }

  /** Whether a phone is listening (or may still connect): nothing paid starts otherwise. */
  private present(): boolean {
    if (this.cancelled) return false;
    if (this.connections > 0) return true;
    if (this.lastDisconnectAt === null) return Date.now() - this.openedAt <= LIVE_REPLY_FIRST_CONNECT_GRACE_MS;
    return Date.now() - this.lastDisconnectAt <= LIVE_REPLY_RECONNECT_GRACE_MS;
  }

  private pump(): void {
    while (this.running < SEGMENT_CONCURRENCY && this.next < this.queue.length && this.next < this.stopAt) {
      if (!this.present()) {
        // The phone is gone: nothing more is started; the audio ends at what was already produced.
        this.stopAt = Math.min(this.stopAt, this.next);
        this.signalOutcome('synthesis', 'listener_gone');
        break;
      }
      const index = this.next;
      this.next += 1;
      const production: Production = { index, chunks: [], bytes: 0, settled: null, listeners: new Set() };
      this.productions[index] = production;
      this.running += 1;
      this.notifyProgress();
      void this.produce(production, this.queue[index]!).finally(() => {
        this.running -= 1;
        for (const listener of [...production.listeners]) listener();
        this.notifyProgress();
        this.pump();
        this.maybeFinalize();
      });
    }
    this.maybeFinalize();
  }

  private async produce(production: Production, segment: { text: string; style: string }): Promise<void> {
    const fail = () => {
      production.settled = 'FAILED';
      this.stopAt = Math.min(this.stopAt, production.index);
    };
    let release: () => void;
    try {
      release = await this.route.admission.enter();
    } catch (error) {
      if (error instanceof SpeechAdmissionRefused) this.signalOutcome('synthesis', 'overloaded');
      return fail();
    }
    try {
      let callId = randomUUID();
      const admitted = await this.admit(production.index, callId, segment.text.length);
      if (admitted !== 'ADMITTED') return fail();
      for (let attempt = 1; ; attempt += 1) {
        const outcome = await this.attempt(production, segment);
        if (outcome.kind === 'PRODUCED') {
          const done = await this.store.completeSegment({ userId: this.userId, callId, pcm: Buffer.concat(production.chunks), usage: outcome.usage }).catch(() => 'GONE' as const);
          if (done === 'READY') {
            production.settled = 'READY';
            this.signalOutcome('synthesis', 'success');
            return;
          }
          return fail();
        }
        const retry = outcome.retryable && attempt < MAX_ATTEMPTS && !this.cancelled;
        const failed = await this.store.failSegment({ userId: this.userId, callId, outcome: outcome.ledger, final: !retry }).catch(() => 'FAILED' as const);
        if (retry && failed === 'RETRYABLE') {
          await new Promise((resolve) => setTimeout(resolve, this.route.retryDelayMs()));
          const nextCall = randomUUID();
          const begun = await this.store.retrySegment({
            userId: this.userId, replyId: this.replyId, index: production.index, previousCallId: callId, callId: nextCall,
            model: this.route.model, leaseSeconds: REPLY_SPEECH_LEASE_SECONDS,
          }).catch(() => 'GONE' as const);
          if (begun === 'RETRY_BEGUN') {
            callId = nextCall;
            continue;
          }
        }
        this.signalOutcome('synthesis', 'provider_failure');
        return fail();
      }
    } finally {
      release();
    }
  }

  private async admit(index: number, callId: string, spokenChars: number): Promise<'ADMITTED' | 'BUSY' | 'GONE'> {
    const deadline = Date.now() + BUSY_RETRY_MS;
    for (;;) {
      const admitted = await this.store.admitSegment({
        userId: this.userId, replyId: this.replyId, index, callId, model: this.route.model, spokenChars, leaseSeconds: REPLY_SPEECH_LEASE_SECONDS,
      }).catch(() => 'GONE' as const);
      if (admitted !== 'BUSY' || Date.now() >= deadline || this.cancelled) return admitted;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  /** One provider attempt; chunks reach the listeners as they arrive. */
  private async attempt(production: Production, segment: { text: string; style: string }): Promise<
    | { kind: 'PRODUCED'; usage: SpeechSynthesisUsage }
    | { kind: 'FAILED'; retryable: boolean; ledger: LiveSegmentAttemptOutcome }> {
    const controller = new AbortController();
    try {
      const session = this.route.adapter.synthesize({
        text: segment.text, voiceId: this.route.voiceId, hint: segment.style, signal: controller.signal, timeoutMs: this.route.segmentTimeoutMs(segment.text),
      });
      let started = false;
      try {
        for await (const chunk of session.chunks) {
          if (chunk.contentType !== 'audio/pcm') throw new SpeechSynthesisFailure('MALFORMED', started, true);
          if (chunk.audio.length === 0) continue;
          started = true;
          production.bytes += chunk.audio.length;
          if (production.bytes > REPLY_SPEECH_MAX_AUDIO_BYTES - WAV_HEADER_BYTES) throw new SpeechSynthesisFailure('TOO_LARGE', true, true);
          production.chunks.push(chunk.audio);
          for (const listener of [...production.listeners]) listener();
        }
        const result = await session.result;
        if (!started) throw new SpeechSynthesisFailure('EMPTY', false, true);
        if ((result.pcmSampleRate ?? LIVE_REPLY_SAMPLE_RATE) !== LIVE_REPLY_SAMPLE_RATE) throw new SpeechSynthesisFailure('MALFORMED', true, true);
        return { kind: 'PRODUCED', usage: result.usage };
      } catch (error) {
        void session.result.catch(() => undefined);
        throw error;
      }
    } catch (error) {
      const failure = error instanceof SpeechSynthesisFailure ? error : new SpeechSynthesisFailure('MALFORMED', true, true);
      this.route.admission.recordFailure(failure);
      // Audio already reached the phone cannot be taken back: that segment ends the audio (no retry after audio).
      return {
        kind: 'FAILED',
        retryable: failure.retryable && production.bytes === 0,
        ledger: !failure.providerReached ? 'CANCELLED_BEFORE_PROVIDER' : failure.audioStarted || production.bytes > 0 ? 'UNKNOWN' : 'FAILED',
      };
    } finally {
      controller.abort();
    }
  }

  private maybeFinalize(): void {
    if (this.finalized || this.running > 0) return;
    const nothingMore = this.cancelled || this.next >= Math.min(this.queue.length, this.stopAt) || !this.present();
    if (!this.ended && !this.cancelled) return;
    if (!nothingMore) return;
    let segmentCount = 0;
    while (segmentCount < this.productions.length && this.productions[segmentCount]?.settled === 'READY' && segmentCount < this.stopAt) segmentCount += 1;
    const audioBytes = this.productions.slice(0, segmentCount).reduce((sum, p) => sum + p.bytes, 0);
    const end = this.ended;
    // A cancel describes the AUDIO (the phone stopped listening); the text's own outcome is the conversation's.
    const state: Exclude<LiveReplyState, 'STREAMING'> = this.cancelled ? 'CANCELLED' : end?.kind === 'COMPLETE' ? 'COMPLETE'
      : end?.kind === 'WITHHELD_TAIL' ? 'WITHHELD_TAIL' : end?.kind === 'FAILED' ? 'FAILED' : 'CANCELLED';
    const assistantTurnId = end && end.kind !== 'FAILED' ? end.assistantTurnId : null;
    this.finalized = { state, segmentCount, audioMs: Math.round(audioBytes / BYTES_PER_MS), assistantTurnId };
    void this.store.finish({ userId: this.userId, replyId: this.replyId, ...this.finalized }).catch(() => this.signalOutcome('synthesis', 'transport_failure'));
    for (const waiter of [...this.finalWaiters]) waiter();
    this.onFinalized();
  }
}

function waitFor(listeners: Set<() => void>, gone: () => boolean): Promise<void> {
  if (gone()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      listeners.delete(done);
      resolve();
    };
    listeners.add(done);
  });
}
