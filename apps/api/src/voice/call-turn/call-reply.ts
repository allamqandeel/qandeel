import { randomUUID } from 'node:crypto';
import { memoryRetrievalTerms } from '../../memory/memory-retrieval-terms';
import { SPEECH_HINT_POLICY, SPEECH_STYLE_SENTENCES, toStoredHints, validateSpeechHints } from '../../speech-rendering';
import { DOWNLINK_OPUS, OpusPacketEncoder } from '../call/codec/opus-codec';
import { AUDIO_PACKET_MS } from '../call/live-call.protocol';
import type { LiveCallTurnChannel, PlayoutVerdict } from '../call/live-call-speech.port';
import type { ListenSynthesisRoute } from '../listen/listen-synthesis.route';
import { REPLY_SPEECH_MAX_AUDIO_BYTES, speechSegments } from '../listen/reply-listen.service';
import { WAV_HEADER_BYTES } from '../listen/wav';
import { SpeechAdmissionRefused } from '../speech-admission.guard';
import { SpeechSynthesisFailure, type SpeechSynthesisUsage } from '../speech-synthesis.adapter';
import type { CallTurnStore, CloseReason, DeliveryState, GenerationEnd, ProviderSettleOutcome } from './call-turn.store';
import type { LiveCallReleasedSpeech } from './live-call-conversation.port';

/** The route's PCM: signed 16-bit little-endian mono at 24 kHz, one 20 ms Opus frame = 480 samples = 960 bytes. */
const REPLY_SAMPLE_RATE = DOWNLINK_OPUS.rate;
const FRAME_BYTES = (REPLY_SAMPLE_RATE * AUDIO_PACKET_MS * 2) / 1000;
/** Two attempts at most per segment, each its own ledger row; never a retry after audio started or after UNKNOWN. */
const MAX_ATTEMPTS = 2;
/** At most two segments synthesize at once (the next one is prepared while the current one plays). */
const SEGMENT_CONCURRENCY = 2;
/** The bounds of what one call reply keeps for the QANDEEL track (64 registered pieces, 0190's policy). */
const MAX_PIECES = 64;
const MAX_TERMS = 64;
const MAX_TERM_LENGTH = 48;

/** The call's retrieval terms of a text (0190 `call_terms_valid_v1`: lower-case, 2 – 48 characters, at most 64). */
export function callRetrievalTerms(text: string): string[] {
  return [...new Set(memoryRetrievalTerms(text).map((t) => t.toLowerCase()))]
    .filter((t) => t.length >= 2 && t.length <= MAX_TERM_LENGTH)
    .slice(0, MAX_TERMS);
}

export type CallReplyEvent =
  | { readonly kind: 'FIRST_AUDIO'; readonly callTurnIndex: number; readonly at: number }
  | { readonly kind: 'REPLY_END'; readonly callTurnIndex: number; readonly at: number; readonly deliveryState: DeliveryState; readonly chunks: number }
  | { readonly kind: 'LATE'; readonly callTurnIndex: number; readonly what: 'CHUNK' | 'PLAYOUT' | 'BARGE_IN' }
  | { readonly kind: 'FAILURE_LINE'; readonly callTurnIndex: number; readonly chunks: number; readonly at: number };

export interface CallReplyDeps {
  readonly store: CallTurnStore;
  readonly route: ListenSynthesisRoute;
  readonly channel: LiveCallTurnChannel;
  readonly signal: (op: string, outcome: string) => void;
  readonly observe: (event: CallReplyEvent) => void;
  readonly now: () => number;
  /**
   * S3: recompute and store the turn's Safety (the same gate over the same context reader) when the generation never
   * stored it. Rejects when it cannot be done now. Absent, an exchange without a stored Safety is never closed.
   */
  readonly ensureSafety?: () => Promise<void>;
  /**
   * S8B-05 CP4 (voice-runtime §4.5, CA-05-02): the fixed spoken failure line F-01 as reply packets (Opus 24 kHz, 20 ms) in
   * the language of this exchange, played when nothing of the reply could be produced; null when its files are not
   * installed (D-05-02): then nothing is played. Never synthesized, never reply speech.
   */
  readonly failureLine?: () => readonly Buffer[] | null;
}

type Segment = { readonly text: string; readonly style: string; readonly piece: number; readonly first: boolean; readonly last: boolean };

type Production = {
  readonly index: number;
  readonly chunks: Buffer[];
  bytes: number;
  settled: 'READY' | 'FAILED' | null;
  readonly listeners: Set<() => void>;
};

const floor20 = (ms: number) => Math.floor(ms / AUDIO_PACKET_MS) * AUDIO_PACKET_MS;

/**
 * S8B-05 CP2 (contract §6 – §8) — QANDEEL's spoken reply of ONE call exchange, from the released text to the recording.
 *
 *   - Each released piece is rendered for speech as Listen renders a reply and cut into segments; each segment is
 *     synthesized (Gemini TTS, the Achird voice of the one route), at most two at a time, in order. Every attempt is one
 *     ledger row on the exchange's USER turn (AI-COST-01, 0190 `server_begin_call_reply_speech_v1`); a known failure before
 *     any audio may be retried once; an UNKNOWN outcome or a failure after audio never is.
 *   - The PCM 24 kHz becomes Opus 24 kHz, 20 ms packets, sent as REPLY_AUDIO in order (chunkSeq = packet index, offsetMs =
 *     chunkSeq × 20). A failed segment ends the audio there: speech never skips a sentence.
 *   - A piece is registered once its whole audio was produced, with its VISIBLE text and its range in the reply
 *     (0190 `server_register_call_reply_segment_v1`), so the stored reply is never more than what was spoken.
 *   - PLAYOUT (P1 – P3): only a higher mark advances; the first one fixes the reply's clock start on the call's clock. The
 *     packets confirmed played go to the QANDEEL track at their clock instants, after a NOT_SPEAKING gap; nothing that was
 *     not confirmed is ever written.
 *   - The exchange closes once: PLAYED_OUT when the mark reaches the produced audio after the generation finished,
 *     GENERATION_FAILED when nothing was produced, or by the next committed turn (N1, in the database). REPLY_END carries
 *     the close's delivery state. After the close, every chunk and confirmation is late: dropped and counted.
 *   - The one AbortController stops the generation and every synthesis attempt at once.
 *
 * Nothing is logged: no text, no audio, no identifier; telemetry names classes only.
 */
export class CallReply {
  private readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  private readonly segments: Segment[] = [];
  private readonly productions: Production[] = [];
  private readonly pieceTexts: string[] = [];
  private readonly waiters = new Set<() => void>();
  private readonly emitted: Buffer[] = [];
  private running = 0;
  private next = 0;
  private stopAt = Number.POSITIVE_INFINITY;
  private segmentFailed = false;
  private generation: 'COMPLETE' | 'WITHHELD_TAIL' | 'FAILED' | null = null;
  private emitEnded = false;
  private finishing = false;
  private finished: { readonly state: GenerationEnd; readonly producedMs: number } | null = null;
  private registrations: Promise<void> = Promise.resolve();
  private registrationFailed = false;
  private markMs = 0;
  private clockStartMs: number | null = null;
  private written = 0;
  private closing = false;
  private closedState: DeliveryState | null = null;
  /**
   * S8B-05 CP4: stopped by the person (BARGE_IN) or by the connection going: the generation is never finished, so the
   * exchange stays open until the next turn (N1), the call's end or the sweep closes it with what was heard (INTERRUPTED).
   */
  private interrupted = false;
  private onsetMs: number | null = null;
  /** F-01 packets sent after a reply that produced nothing (chunkSeq from 0: the reply sent none). */
  private readonly failurePackets: Buffer[] = [];
  private failureClockStartMs: number | null = null;
  private failureWritten = 0;
  private resolveSafety!: () => void;
  private safetyKnown = false;
  private safetyRecovery: Promise<boolean> | null = null;
  /** Resolves once the turn's Safety is stored, or once the generation settled without storing it. */
  readonly safetySettled = new Promise<void>((resolve) => {
    this.resolveSafety = resolve;
  });

  constructor(private readonly deps: CallReplyDeps, readonly callTurnIndex: number) {
    void this.emit();
  }

  get closed(): boolean {
    return this.closedState !== null;
  }

  get producedMs(): number {
    return this.emitted.length * AUDIO_PACKET_MS;
  }

  /**
   * S8B-05 CP4 (§5.2 step 5): where this reply was playing when the person began to speak over it, on the call clock:
   * [clock start, onset). Null without a barge-in or before any playout was confirmed.
   */
  get bargedPlayback(): { readonly startMs: number; readonly onsetMs: number } | null {
    return this.onsetMs === null || this.clockStartMs === null ? null : { startMs: this.clockStartMs, onsetMs: this.onsetMs };
  }

  safetyStored(): void {
    this.safetyKnown = true;
    this.resolveSafety();
  }

  /**
   * S3: true once the turn's Safety is stored, recovering it first when the generation ended (or stopped) before storing it;
   * false when it cannot be recovered now (the context unreadable): the exchange then stays open, and nothing closes it
   * without its stored Safety. One recovery at a time.
   */
  settleSafety(): Promise<boolean> {
    if (this.safetyKnown) return Promise.resolve(true);
    const ensure = this.deps.ensureSafety;
    if (!ensure) return Promise.resolve(false);
    this.safetyRecovery ??= ensure().then(() => {
      this.safetyKnown = true;
      return true;
    }, () => false).finally(() => {
      this.safetyRecovery = null;
    });
    return this.safetyRecovery;
  }

  // ------------------------------------------------------------------ generation side
  release(piece: string, speech: LiveCallReleasedSpeech): void {
    if (this.generation || this.signal.aborted || piece.trim() === '') return;
    const candidates = speech.hints.map((hint) => ({ word: hint.word, at: hint.at }));
    const hints = toStoredHints(validateSpeechHints(piece.trim(), candidates, SPEECH_HINT_POLICY === 'OFF' ? 'OFF' : 'B_ALL').hints);
    const segments = speechSegments(piece.trim(), hints);
    if (segments === 'NOTHING_TO_SPEAK') return;
    if (typeof segments === 'string' || this.pieceTexts.length >= MAX_PIECES || piece.length > 2000) {
      // A piece that cannot be spoken faithfully ends the audio here.
      this.stopAt = Math.min(this.stopAt, this.segments.length);
      this.deps.signal('synthesis', 'refused_expected');
      this.wake();
      return;
    }
    const pieceIndex = this.pieceTexts.length;
    this.pieceTexts.push(piece);
    const style = SPEECH_STYLE_SENTENCES[speech.expression].style;
    segments.forEach((text, i) => this.segments.push({ text, style, piece: pieceIndex, first: i === 0, last: i === segments.length - 1 }));
    this.pump();
    this.wake();
  }

  /** The conversation is done with this exchange (its generation outcome). */
  generationEnded(kind: 'COMPLETE' | 'WITHHELD_TAIL' | 'FAILED'): void {
    if (this.generation) return;
    this.generation = kind;
    this.resolveSafety();
    this.wake();
    void this.maybeFinish();
  }

  /** The exchange was closed elsewhere (N1: the next committed turn): stop everything, tell the phone. */
  closedBy(deliveryState: DeliveryState): void {
    this.interrupted = true;
    this.abort();
    this.announceEnd(deliveryState);
  }

  /**
   * S8B-05 CP4 (P4, §5.2): the person spoke over QANDEEL (`onsetMs`, the first one kept) or the connection went (null): the
   * one AbortController stops the generation and every synthesis attempt, no later chunk is sent, and the generation is
   * left unfinished, so nothing closes the exchange as FAILED: the close that follows (N1, the call's end, the sweep) keeps
   * only what was heard. The uplink is untouched.
   */
  interrupt(onsetMs: number | null): void {
    if (onsetMs !== null && this.onsetMs === null) this.onsetMs = onsetMs;
    this.interrupted = true;
    this.abort();
  }

  /** Stops the generation and every synthesis attempt (the call is going, or the exchange is closed). */
  abort(): void {
    if (this.signal.aborted) return;
    this.controller.abort();
    this.stopAt = Math.min(this.stopAt, this.next);
    this.resolveSafety();
    this.wake();
  }

  // ------------------------------------------------------------------ playout side
  async playout(input: { readonly chunkSeq: number; readonly playedMs: number }): Promise<PlayoutVerdict> {
    const { chunkSeq, playedMs } = input;
    // The phone confirms only what it was sent, inside the chunk it names.
    if (chunkSeq >= this.emitted.length + this.failurePackets.length || playedMs < chunkSeq * AUDIO_PACKET_MS
      || playedMs > (chunkSeq + 1) * AUDIO_PACKET_MS) return 'VIOLATION';
    if (this.emitted.length === 0 && this.failurePackets.length > 0) return this.failurePlayout(playedMs);
    if (!this.closed && this.clockStartMs !== null && playedMs <= this.markMs) return 'IGNORED';
    const channel = this.deps.channel;
    const clockStartMs = this.clockStartMs
      ?? Math.max(channel.qandeelEndMs(), floor20(Math.max(0, channel.latestCaptureMs() + AUDIO_PACKET_MS - playedMs)));
    const result = await this.deps.store.confirmPlayout({
      userId: channel.userId, callId: channel.callId, epoch: channel.epoch, callTurnIndex: this.callTurnIndex, playedMs, clockStartMs,
    }).catch(() => null);
    if (!result) return 'IGNORED';
    if (result.outcome === 'CLOSED') {
      this.deps.observe({ kind: 'LATE', callTurnIndex: this.callTurnIndex, what: 'PLAYOUT' });
      return 'IGNORED';
    }
    if (result.outcome !== 'ADVANCED' || result.markMs === null || result.clockStartMs === null) return 'IGNORED';
    this.markMs = result.markMs;
    this.clockStartMs = result.clockStartMs;
    this.writeHeard();
    void this.maybeClosePlayedOut();
    return 'APPLIED';
  }

  /** The packets confirmed played, on the QANDEEL track at their clock instants (whole 20 ms packets only). */
  private writeHeard(): void {
    if (this.clockStartMs === null) return;
    const heard = Math.min(Math.floor(this.markMs / AUDIO_PACKET_MS), this.emitted.length);
    const channel = this.deps.channel;
    try {
      if (this.written === 0 && heard > 0) channel.qandeelSilence(this.clockStartMs);
      for (; this.written < heard; this.written += 1) {
        channel.qandeelAppend(this.emitted[this.written]!, this.clockStartMs + this.written * AUDIO_PACKET_MS);
      }
    } catch {
      // The QANDEEL track moved past this reply's clock: nothing more is written for it (the heard mark stays bounded by
      // what the track holds, in the database).
      this.written = Number.POSITIVE_INFINITY;
      this.deps.signal('qandeel_track', 'integrity_failure');
    }
  }

  /**
   * S8B-05 CP4: F-01 heard on the phone goes to the QANDEEL track (what the person heard is recorded), never to the
   * exchange: it is not the reply's speech (CA-05-02: FAILED, heard mark 0, no anchor), so no mark is confirmed for it.
   */
  private failurePlayout(playedMs: number): PlayoutVerdict {
    const channel = this.deps.channel;
    this.failureClockStartMs ??= Math.max(channel.qandeelEndMs(), floor20(Math.max(0, channel.latestCaptureMs() + AUDIO_PACKET_MS - playedMs)));
    const heard = Math.min(Math.floor(playedMs / AUDIO_PACKET_MS), this.failurePackets.length);
    if (heard <= this.failureWritten) return 'IGNORED';
    try {
      if (this.failureWritten === 0) channel.qandeelSilence(this.failureClockStartMs);
      for (; this.failureWritten < heard; this.failureWritten += 1) {
        channel.qandeelAppend(this.failurePackets[this.failureWritten]!, this.failureClockStartMs + this.failureWritten * AUDIO_PACKET_MS);
      }
    } catch {
      this.failureWritten = Number.POSITIVE_INFINITY;
      this.deps.signal('qandeel_track', 'integrity_failure');
    }
    return 'APPLIED';
  }

  // ------------------------------------------------------------------ synthesis
  private wake(): void {
    for (const waiter of [...this.waiters]) waiter();
  }

  private waitChange(): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        this.waiters.delete(done);
        resolve();
      };
      this.waiters.add(done);
    });
  }

  private pump(): void {
    while (this.running < SEGMENT_CONCURRENCY && this.next < this.segments.length && this.next < this.stopAt && !this.signal.aborted) {
      const index = this.next;
      this.next += 1;
      const production: Production = { index, chunks: [], bytes: 0, settled: null, listeners: new Set() };
      this.productions[index] = production;
      this.running += 1;
      void this.produce(production, this.segments[index]!).finally(() => {
        this.running -= 1;
        for (const listener of [...production.listeners]) listener();
        this.pump();
        this.wake();
        void this.maybeFinish();
      });
    }
  }

  private async produce(production: Production, segment: Segment): Promise<void> {
    const fail = () => {
      production.settled = 'FAILED';
      this.segmentFailed = true;
      this.stopAt = Math.min(this.stopAt, production.index);
    };
    const { route, store, channel } = this.deps;
    let release: () => void;
    try {
      release = await route.admission.enter();
    } catch (error) {
      if (error instanceof SpeechAdmissionRefused) this.deps.signal('synthesis', 'overloaded');
      return fail();
    }
    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        if (this.signal.aborted) return fail();
        const providerCallId = randomUUID();
        const begun = await store.beginSpeech({
          userId: channel.userId, callId: channel.callId, epoch: channel.epoch, callTurnIndex: this.callTurnIndex, providerCallId, model: route.model,
        }).catch(() => 'UNAVAILABLE');
        if (begun !== 'BEGUN') return fail();
        const outcome = await this.attempt(production, segment);
        const settled = outcome.kind === 'PRODUCED'
          ? this.settle(providerCallId, 'SUCCEEDED', outcome.usage)
          : this.settle(providerCallId, outcome.ledger, { completeness: 'ABSENT' });
        await settled;
        if (outcome.kind === 'PRODUCED') {
          production.settled = 'READY';
          this.deps.signal('synthesis', 'success');
          return;
        }
        if (!(outcome.retryable && attempt < MAX_ATTEMPTS && !this.signal.aborted)) break;
        await new Promise((resolve) => setTimeout(resolve, route.retryDelayMs()));
      }
      this.deps.signal('synthesis', this.signal.aborted ? 'aborted' : 'provider_failure');
      return fail();
    } finally {
      release();
    }
  }

  private async settle(providerCallId: string, outcome: ProviderSettleOutcome, usage: SpeechSynthesisUsage): Promise<void> {
    const complete = usage.completeness === 'COMPLETE';
    await this.deps.store.settle({
      userId: this.deps.channel.userId, providerCallId, outcome, completeness: complete ? 'COMPLETE' : 'ABSENT',
      usage: complete ? { INPUT_TOKEN: usage.inputTokens, AUDIO_OUTPUT_TOKEN: usage.audioOutputTokens } : {},
    }).catch(() => this.deps.signal('synthesis', 'transport_failure'));
  }

  /** One provider attempt; chunks reach the emitter as they arrive, none after the abort. */
  private async attempt(production: Production, segment: Segment): Promise<
    | { kind: 'PRODUCED'; usage: SpeechSynthesisUsage }
    | { kind: 'FAILED'; retryable: boolean; ledger: ProviderSettleOutcome }> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    this.signal.addEventListener('abort', onAbort, { once: true });
    try {
      const route = this.deps.route;
      const session = route.adapter.synthesize({
        text: segment.text, voiceId: route.voiceId, hint: segment.style, signal: controller.signal, timeoutMs: route.segmentTimeoutMs(segment.text),
      });
      let started = false;
      try {
        for await (const chunk of session.chunks) {
          if (this.signal.aborted) {
            this.deps.observe({ kind: 'LATE', callTurnIndex: this.callTurnIndex, what: 'CHUNK' });
            throw new SpeechSynthesisFailure('CANCELLED', started, true);
          }
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
        if ((result.pcmSampleRate ?? REPLY_SAMPLE_RATE) !== REPLY_SAMPLE_RATE) throw new SpeechSynthesisFailure('MALFORMED', true, true);
        return { kind: 'PRODUCED', usage: result.usage };
      } catch (error) {
        void session.result.catch(() => undefined);
        throw error;
      }
    } catch (error) {
      const failure = error instanceof SpeechSynthesisFailure ? error : new SpeechSynthesisFailure('MALFORMED', true, true);
      this.deps.route.admission.recordFailure(failure);
      return {
        kind: 'FAILED',
        retryable: failure.retryable && production.bytes === 0,
        ledger: !failure.providerReached ? 'CANCELLED_BEFORE_PROVIDER' : failure.audioStarted || production.bytes > 0 ? 'UNKNOWN' : 'FAILED',
      };
    } finally {
      this.signal.removeEventListener('abort', onAbort);
      controller.abort();
    }
  }

  // ------------------------------------------------------------------ the downlink, in order
  /** The production of segment `index` once it exists; null when that segment will never be spoken. */
  private async productionAt(index: number): Promise<Production | null> {
    for (;;) {
      if (index >= this.stopAt || this.signal.aborted) return null;
      const production = this.productions[index];
      if (production) return production;
      if (this.generation && index >= this.segments.length) return null;
      await this.waitChange();
    }
  }

  private async emit(): Promise<void> {
    let encoder: OpusPacketEncoder | null = null;
    let pieceStartMs = 0;
    try {
      for (let index = 0; ; index += 1) {
        const production = await this.productionAt(index);
        if (!production) break;
        const segment = this.segments[index]!;
        if (segment.first) pieceStartMs = this.producedMs;
        encoder ??= new OpusPacketEncoder(DOWNLINK_OPUS.rate, DOWNLINK_OPUS.bitrate);
        let consumed = 0;
        let carry: Buffer = Buffer.alloc(0);
        for (;;) {
          while (consumed < production.chunks.length) {
            carry = this.sendFrames(encoder, Buffer.concat([carry, production.chunks[consumed]!]), false);
            consumed += 1;
          }
          if (this.signal.aborted || production.settled !== null) break;
          await new Promise<void>((resolve) => {
            const done = () => {
              production.listeners.delete(done);
              this.waiters.delete(done);
              resolve();
            };
            production.listeners.add(done);
            this.waiters.add(done);
          });
        }
        if (this.signal.aborted || production.settled !== 'READY') break;
        // The segment's last partial frame is completed with silence: every packet is a whole 20 ms.
        if (carry.length > 0) this.sendFrames(encoder, carry, true);
        if (segment.last) this.register(segment.piece, pieceStartMs, this.producedMs);
      }
    } finally {
      encoder?.close();
      this.emitEnded = true;
      void this.maybeFinish();
    }
  }

  private sendFrames(encoder: OpusPacketEncoder, pcm: Buffer, pad: boolean): Buffer {
    let offset = 0;
    while (pcm.length - offset >= FRAME_BYTES) {
      this.sendPacket(encoder.encode(pcm.subarray(offset, offset + FRAME_BYTES)));
      offset += FRAME_BYTES;
    }
    const rest = pcm.subarray(offset);
    if (!pad || rest.length === 0) return Buffer.from(rest);
    const frame = Buffer.alloc(FRAME_BYTES);
    rest.copy(frame);
    this.sendPacket(encoder.encode(frame));
    return Buffer.alloc(0);
  }

  private sendPacket(packet: Buffer): void {
    if (this.signal.aborted) return;
    const chunkSeq = this.emitted.length;
    this.emitted.push(packet);
    if (chunkSeq === 0) this.deps.observe({ kind: 'FIRST_AUDIO', callTurnIndex: this.callTurnIndex, at: this.deps.now() });
    this.deps.channel.sendReplyAudio({ callTurnIndex: this.callTurnIndex, chunkSeq, offsetMs: chunkSeq * AUDIO_PACKET_MS, packet });
  }

  /** A whole piece was produced: its visible text and its range in the reply, registered in order. */
  private register(piece: number, startMs: number, endMs: number): void {
    const text = this.pieceTexts[piece]!;
    const channel = this.deps.channel;
    this.registrations = this.registrations.then(async () => {
      if (this.registrationFailed) return;
      const outcome = await this.deps.store.registerSegment({
        userId: channel.userId, callId: channel.callId, epoch: channel.epoch, callTurnIndex: this.callTurnIndex, seq: piece, text, startMs, endMs,
        terms: callRetrievalTerms(text),
      }).catch(() => 'UNAVAILABLE');
      // A piece that is not registered ends the stored text there (the audio stays the record of what was heard).
      if (outcome !== 'REGISTERED') this.registrationFailed = true;
    });
  }

  // ------------------------------------------------------------------ finish and close
  private async maybeFinish(): Promise<void> {
    // An interrupted reply is never finished (see `interrupt`): its close keeps what was heard.
    if (this.interrupted) return;
    if (this.finishing || !this.generation || !this.emitEnded || this.running > 0) return;
    this.finishing = true;
    await this.registrations;
    const producedMs = this.producedMs;
    const state: GenerationEnd = producedMs === 0 ? 'FAILED'
      : this.generation === 'COMPLETE' && !this.segmentFailed && this.stopAt === Number.POSITIVE_INFINITY && !this.signal.aborted ? 'COMPLETE'
        : 'WITHHELD_TAIL';
    const channel = this.deps.channel;
    const outcome = await this.deps.store.finishGeneration({
      userId: channel.userId, callId: channel.callId, epoch: channel.epoch, callTurnIndex: this.callTurnIndex, state, producedMs,
    }).catch(() => 'UNAVAILABLE');
    if (outcome !== 'FINISHED' && outcome !== 'ALREADY_FINISHED') return;
    this.finished = { state, producedMs };
    if (producedMs === 0) {
      // Nothing of the reply could be spoken: the fixed line F-01 tells the person, then the exchange closes FAILED.
      this.sendFailureLine();
      await this.closeWith('GENERATION_FAILED');
    }
    else await this.maybeClosePlayedOut();
  }

  private async maybeClosePlayedOut(): Promise<void> {
    if (!this.finished || this.finished.producedMs === 0 || this.markMs < this.finished.producedMs) return;
    await this.closeWith('PLAYED_OUT');
  }

  private async closeWith(reason: CloseReason): Promise<void> {
    if (this.closing || this.closed) return;
    this.closing = true;
    // S3: an exchange is never closed without its stored Safety (the authority refuses it); recovered here first when the
    // generation failed before storing it.
    if (this.deps.ensureSafety && !(await this.settleSafety())) {
      this.closing = false;
      this.deps.signal('close', 'safety_unsettled');
      return;
    }
    const channel = this.deps.channel;
    // The QANDEEL track holds what was confirmed before the close reads it (the heard mark is bounded by it).
    await channel.settleQandeelTrack();
    const result = await this.deps.store.close({
      userId: channel.userId, callId: channel.callId, epoch: channel.epoch, callTurnIndex: this.callTurnIndex, reason, assistantTurnId: randomUUID(),
      eventId: randomUUID(),
    }).catch(() => null);
    if (result && (result.outcome === 'CLOSED' || result.outcome === 'ALREADY_CLOSED') && result.deliveryState) {
      this.abort();
      this.announceEnd(result.deliveryState);
      return;
    }
    this.closing = false;
  }

  /** F-01's packets as REPLY_AUDIO of this exchange, from chunkSeq 0 (the reply produced none); nothing when not installed. */
  private sendFailureLine(): void {
    if (this.interrupted || this.failurePackets.length > 0) return;
    const packets = this.deps.failureLine?.() ?? null;
    if (!packets || packets.length === 0) {
      this.deps.signal('failure_line', 'not_installed');
      return;
    }
    for (const packet of packets) {
      const chunkSeq = this.failurePackets.length;
      this.failurePackets.push(packet);
      this.deps.channel.sendReplyAudio({ callTurnIndex: this.callTurnIndex, chunkSeq, offsetMs: chunkSeq * AUDIO_PACKET_MS, packet });
    }
    this.deps.observe({ kind: 'FAILURE_LINE', callTurnIndex: this.callTurnIndex, chunks: packets.length, at: this.deps.now() });
    this.deps.signal('failure_line', 'played');
  }

  private announceEnd(deliveryState: DeliveryState): void {
    if (this.closedState) return;
    this.closedState = deliveryState;
    const chunks = this.emitted.length + this.failurePackets.length;
    this.deps.channel.send({ type: 'REPLY_END', callTurnIndex: this.callTurnIndex, chunks, deliveryState });
    this.deps.observe({ kind: 'REPLY_END', callTurnIndex: this.callTurnIndex, at: this.deps.now(), deliveryState, chunks });
  }
}
