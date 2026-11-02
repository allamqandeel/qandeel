import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TelemetryService } from '../../observability/telemetry.service';
import { AUDIO_PACKET_MS } from '../call/live-call.protocol';
import {
  NULL_LIVE_CALL_SPEECH_SINK, type LiveCallSpeechSink, type LiveCallSpeechStream, type LiveCallTurnChannel, type PlayoutVerdict,
} from '../call/live-call-speech.port';
import type { ListenSynthesisRoute } from '../listen/listen-synthesis.route';
import { LIVE_VOICE_NOTE_MODEL } from '../live-note/live-voice-note.repository';
import type { FinalizableRecognitionSession, RecognizedSpeech, SpeechRecognitionUsage } from '../speech-recognition.adapter';
import { LIVE_NOTE_BYTES_PER_MS, type RealtimeRecognition } from '../live-note/live-voice-note.service';
import { CallEndpointer, CALL_ENDPOINTING, type EndpointerEvent } from './call-endpointer';
import { CallReply, callRetrievalTerms, type CallReplyEvent } from './call-reply';
import { CALL_TURN_STORE, type CallTurnStore, type DeliveryState } from './call-turn.store';
import { LiveCallConversationBinding, type LiveCallReplyOutcome } from './live-call-conversation.port';

/**
 * S8B-05 CP2 (§3) — the call's realtime recognizer, bound by VoiceModule when the Speechmatics server key is set, INDEPENDENT of
 * VOICE_NOTE_LIVE_TRANSCRIPT (which stays OFF and governs Voice Notes only). Absent, a call records but no turn is taken.
 */
export const LIVE_CALL_RECOGNITION = Symbol('LIVE_CALL_RECOGNITION');
/**
 * The call's reply synthesis: the Listen route's model, voice (Achird), limits and admission, over the call's own keep-alive
 * transport (L1). Null without a configured project: a committed turn is then not answered.
 */
export const LIVE_CALL_SYNTHESIS_ROUTE = Symbol('LIVE_CALL_SYNTHESIS_ROUTE');

/** Uplink waiting for the recognizer to open (or for its send to accept), at most this much; beyond it the turn path stops. */
const MAX_PENDING_RECOGNITION_MS = 10_000;
/**
 * A new turn waits at most this long for the previous exchange's Safety to be stored by its generation; then S3 recomputes
 * it (N1 never closes an exchange without it).
 */
const SAFETY_WAIT_MS = 5_000;
/** A turn held because the previous exchange's Safety could not be recovered yet is retried after 250 ms, doubling to 4 s. */
const HELD_RETRY_FIRST_MS = 250;
const HELD_RETRY_MAX_MS = 4_000;
const BAND_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;

/** What a proof or a test may observe of a call's turns: instants and counts only, never a word. */
export type CallTurnObservation =
  | CallReplyEvent
  | { readonly kind: 'ENDPOINT'; readonly event: EndpointerEvent['kind']; readonly atCaptureMs: number; readonly at: number }
  | { readonly kind: 'FINAL_ACCEPTED'; readonly answered: boolean; readonly at: number }
  | { readonly kind: 'COMMITTED'; readonly callTurnIndex: number; readonly at: number; readonly closed: DeliveryState | null }
  | { readonly kind: 'COMMIT_REFUSED'; readonly outcome: string; readonly at: number }
  | { readonly kind: 'COMMIT_HELD'; readonly attempt: number; readonly finals: number; readonly at: number }
  | { readonly kind: 'REPLY_OUTCOME'; readonly callTurnIndex: number; readonly outcome: LiveCallReplyOutcome; readonly at: number };

/** A finished utterance not yet committed: its FINAL words in order and its place on the call clock. */
interface SpokenTurn {
  readonly words: readonly RecognizedSpeech[];
  readonly turnStart: number;
  readonly speechEnd: number;
}

const floor20 = (ms: number) => Math.floor(ms / AUDIO_PACKET_MS) * AUDIO_PACKET_MS;
const ceil20 = (ms: number) => Math.ceil(ms / AUDIO_PACKET_MS) * AUDIO_PACKET_MS;

/**
 * S8B-05 CP2 — the call turn engine: the live call's speech sink (`voice/call/live-call-speech.port.ts`). One session per
 * connection, from the decoded uplink to QANDEEL's reply heard on the phone:
 *
 *   - the uplink streams, without a break, to the call's realtime recognizer (Speechmatics Enhanced ar_en, PCM 16 kHz); its
 *     one ledger row per session is settled with the gateway-measured audio (AI-COST-01);
 *   - the endpointer (D-A1) asks ForceEndOfUtterance after 500 ms of silence and allows the commit after 800 ms, once the
 *     final is accepted (its last FINAL, or the 1000 ms timeout). Speech that resumes before the commit is the SAME turn;
 *   - partials never leave the recognizer: only FINAL words make a turn, and nothing reaches DeepSeek before the commit;
 *   - the commit (0190) writes the USER turn with its anchor inside the USER track (written first), and closes the open
 *     exchange in the same transaction (N1); the phone gets TURN_COMMITTED, and REPLY_END for the exchange it closed;
 *   - the conversation generates the reply (the orchestrator's REALTIME path, bound through LiveCallConversationBinding);
 *     the reply plays and is recorded as the phone confirms it (CallReply).
 *
 * Nothing is logged: no audio, no transcript, no identifier.
 */
@Injectable()
export class LiveCallTurnEngine implements LiveCallSpeechSink {
  private observer: ((observation: CallTurnObservation) => void) | null = null;

  constructor(
    @Inject(CALL_TURN_STORE) private readonly store: CallTurnStore,
    private readonly binding: LiveCallConversationBinding,
    @Optional() @Inject(LIVE_CALL_RECOGNITION) private readonly recognizer?: RealtimeRecognition | null,
    @Optional() @Inject(LIVE_CALL_SYNTHESIS_ROUTE) private readonly route?: ListenSynthesisRoute | null,
    @Optional() private readonly telemetry?: TelemetryService,
  ) {}

  /** A proof's or a test's observer of instants and counts (no words); one at a time. */
  observe(observer: ((observation: CallTurnObservation) => void) | null): void {
    this.observer = observer;
  }

  open(channel: LiveCallTurnChannel): LiveCallSpeechStream {
    const conversation = this.binding.conversation;
    if (!this.recognizer || !this.route || !conversation) {
      this.signal('open', 'not_configured');
      return NULL_LIVE_CALL_SPEECH_SINK.open(channel);
    }
    return new CallTurnSession(channel, {
      store: this.store, recognizer: this.recognizer, route: this.route, conversation: () => this.binding.conversation,
      signal: (op, outcome) => this.signal(op, outcome), observe: (o) => this.observer?.(o),
    });
  }

  private signal(op: string, outcome: string): void {
    try {
      this.telemetry?.recordOperationalOutcome('VOICE_LIVE_CALL_TURN', op, outcome);
    } catch {
      // Observability is best-effort.
    }
  }
}

interface SessionDeps {
  readonly store: CallTurnStore;
  readonly recognizer: RealtimeRecognition;
  readonly route: ListenSynthesisRoute;
  readonly conversation: () => ReturnType<() => LiveCallConversationBinding['conversation']>;
  readonly signal: (op: string, outcome: string) => void;
  readonly observe: (observation: CallTurnObservation) => void;
}

class CallTurnSession implements LiveCallSpeechStream {
  private readonly endpointer = new CallEndpointer();
  private readonly recognitionAbort = new AbortController();
  private recognition: FinalizableRecognitionSession | null = null;
  private recognitionFailed = false;
  private providerCallId: string | null = null;
  /** Uplink received before the recognizer opened, sent to it in order once it does. */
  private pending: Buffer[] = [];
  private sending: Promise<void> = Promise.resolve();
  private sentBytes = 0;
  /** FINAL words not yet in a committed turn, in order. */
  private finals: RecognizedSpeech[] = [];
  private finalAccepted: Promise<void> = Promise.resolve();
  private turnChain: Promise<void> = Promise.resolve();
  private reply: CallReply | null = null;
  private readonly replies = new Map<number, CallReply>();
  /** S3: a finished turn held, uncommitted and unannounced, until the previous exchange's Safety is recovered. */
  private held: SpokenTurn | null = null;
  private heldRetry: ReturnType<typeof setTimeout> | null = null;
  private heldAttempts = 0;
  private closed = false;

  constructor(private readonly channel: LiveCallTurnChannel, private readonly deps: SessionDeps) {
    void this.openRecognition();
  }

  // ------------------------------------------------------------------ uplink
  push(pcm16k: Buffer, captureMs: number): void {
    if (this.closed) return;
    this.feed(pcm16k);
    for (const event of this.endpointer.push(pcm16k, captureMs)) {
      this.deps.observe({ kind: 'ENDPOINT', event: event.kind, atCaptureMs: event.atMs, at: Date.now() });
      if (event.kind === 'FINALIZE') this.forceEnd();
      if (event.kind === 'COMMIT_SILENCE') this.turnChain = this.turnChain.then(() => this.commitTurn()).catch(() => this.deps.signal('commit', 'integrity_failure'));
    }
  }

  private feed(pcm: Buffer): void {
    if (this.recognitionFailed) return;
    if (!this.recognition) {
      this.pending.push(pcm);
      if (this.pending.length * AUDIO_PACKET_MS > MAX_PENDING_RECOGNITION_MS) this.failRecognition();
      return;
    }
    const session = this.recognition;
    this.sentBytes += pcm.length;
    this.sending = this.sending.then(() => session.send(pcm)).catch(() => this.failRecognition());
  }

  private async openRecognition(): Promise<void> {
    const providerCallId = randomUUID();
    const begun = await this.deps.store.beginTranscription({
      userId: this.channel.userId, callId: this.channel.callId, epoch: this.channel.epoch, providerCallId, model: LIVE_VOICE_NOTE_MODEL,
    }).catch(() => 'UNAVAILABLE');
    if (begun !== 'BEGUN' || this.closed) {
      this.recognitionFailed = true;
      this.pending = [];
      this.deps.signal('recognition', 'refused_expected');
      return;
    }
    this.providerCallId = providerCallId;
    let session: FinalizableRecognitionSession;
    try {
      session = await this.deps.recognizer.openStream({ language: 'ar_en', signal: this.recognitionAbort.signal });
    } catch {
      this.failRecognition();
      await this.settleRecognition({ completeness: 'ABSENT' }, 'FAILED');
      return;
    }
    if (this.closed) {
      session.abort();
      await this.settleRecognition({ completeness: 'ABSENT' }, 'FAILED');
      return;
    }
    this.recognition = session;
    for (const pcm of this.pending) this.feed(pcm);
    this.pending = [];
    void this.readEvents(session);
  }

  private async readEvents(session: FinalizableRecognitionSession): Promise<void> {
    try {
      // Only FINAL words are kept; an INTERIM never leaves this loop (never DeepSeek, Memory or analysis).
      for await (const event of session.events) if (event.kind === 'FINAL' && event.speech.text.trim() !== '') this.finals.push(event.speech);
    } catch {
      this.failRecognition();
    }
  }

  private failRecognition(): void {
    if (this.recognitionFailed) return;
    this.recognitionFailed = true;
    this.pending = [];
    this.recognition?.abort();
    this.deps.signal('recognition', 'provider_failure');
  }

  /** ForceEndOfUtterance (500 ms of silence); the final is accepted on its answer or its own 1000 ms timeout. */
  private forceEnd(): void {
    const session = this.recognition;
    if (!session || this.recognitionFailed) return;
    this.finalAccepted = session.finalize().then(
      (answer) => this.deps.observe({ kind: 'FINAL_ACCEPTED', answered: answer === 'ANSWERED', at: Date.now() }),
      () => this.failRecognition(),
    ).then(() => new Promise<void>((resolve) => setImmediate(resolve)));
  }

  // ------------------------------------------------------------------ the turn
  private async commitTurn(): Promise<void> {
    await this.finalAccepted;
    // The person spoke again while the final was awaited: the same turn goes on; a later silence commits it.
    if (this.closed || this.endpointer.state !== 'PENDING_COMMIT') return;
    const turnStart = this.endpointer.turnStart;
    const speechEnd = this.endpointer.speechEnd;
    const words = this.finals;
    this.finals = [];
    this.endpointer.reset();
    const content = words.map((w) => w.text.trim()).filter((t) => t !== '').join(' ');
    if (content === '' || turnStart === null) {
      // Noise, or nothing recognized: no turn.
      this.deps.signal('commit', 'no_speech');
      return;
    }
    // A held turn and the words said since are ONE turn, in order (as speech resumed before a commit is).
    const held = this.takeHeld();
    await this.commitSpoken(held ? { words: [...held.words, ...words], turnStart: held.turnStart, speechEnd } : { words, turnStart, speechEnd });
  }

  private takeHeld(): SpokenTurn | null {
    const held = this.held;
    this.held = null;
    if (this.heldRetry) clearTimeout(this.heldRetry);
    this.heldRetry = null;
    return held;
  }

  /**
   * S3: the previous exchange's Safety cannot be recovered now (its context unreadable). The turn is kept whole, neither
   * committed nor announced, and retried (250 ms doubling to 4 s) until the recovery succeeds or the call goes.
   */
  private hold(turn: SpokenTurn): void {
    this.held = turn;
    this.deps.observe({ kind: 'COMMIT_HELD', attempt: this.heldAttempts, finals: turn.words.length, at: Date.now() });
    this.deps.signal('commit', 'held_safety_unsettled');
    const delay = Math.min(HELD_RETRY_MAX_MS, HELD_RETRY_FIRST_MS * 2 ** this.heldAttempts);
    this.heldAttempts += 1;
    this.heldRetry = setTimeout(() => {
      this.heldRetry = null;
      this.turnChain = this.turnChain.then(() => this.retryHeld()).catch(() => this.deps.signal('commit', 'integrity_failure'));
    }, delay);
  }

  private async retryHeld(): Promise<void> {
    if (this.closed) return;
    const held = this.takeHeld();
    if (held) await this.commitSpoken(held);
  }

  private async commitSpoken(turn: SpokenTurn): Promise<void> {
    const { words, turnStart, speechEnd } = turn;
    const content = words.map((w) => w.text.trim()).filter((t) => t !== '').join(' ');
    const band = words.reduce<RecognizedSpeech['band']>((worst, w) => (BAND_ORDER[w.band] < BAND_ORDER[worst] ? w.band : worst), 'HIGH');
    const previous = this.reply;
    if (previous && !previous.closed) {
      // N1 closes the open exchange with its stored Safety: give the previous turn's generation a bounded moment to store
      // it, then S3 recomputes it (the same gate over the same reader). Never closed without it, never a default.
      let wait: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([previous.safetySettled, new Promise((resolve) => { wait = setTimeout(resolve, SAFETY_WAIT_MS); })]);
      clearTimeout(wait);
      if (this.closed) return;
      if (!(await previous.settleSafety())) {
        if (!this.closed) this.hold(turn);
        return;
      }
      await this.channel.settleQandeelTrack();
    }
    this.heldAttempts = 0;
    const userEnd = await this.channel.settleUserTrack();
    if (userEnd === null || this.closed) return;
    const anchorStartMs = floor20(turnStart);
    const anchorEndMs = Math.min(ceil20(speechEnd), userEnd);
    if (anchorEndMs <= anchorStartMs) {
      this.deps.signal('commit', 'integrity_failure');
      return;
    }
    const result = await this.deps.store.commit({
      userId: this.channel.userId, callId: this.channel.callId, epoch: this.channel.epoch, turnId: randomUUID(), commitId: randomUUID(), content,
      band, anchorStartMs, anchorEndMs, terms: callRetrievalTerms(content), closeAssistantTurnId: randomUUID(), closeEventId: randomUUID(),
    }).catch(() => null);
    if (!result || (result.outcome !== 'COMMITTED' && result.outcome !== 'ALREADY_COMMITTED') || result.callTurnIndex === null || !result.turnId) {
      this.deps.observe({ kind: 'COMMIT_REFUSED', outcome: result?.outcome ?? 'UNAVAILABLE', at: Date.now() });
      this.deps.signal('commit', result ? 'refused_expected' : 'transport_failure');
      return;
    }
    if (result.closed) this.replies.get(result.closed.callTurnIndex)?.closedBy(result.closed.deliveryState);
    this.deps.observe({ kind: 'COMMITTED', callTurnIndex: result.callTurnIndex, at: Date.now(), closed: result.closed?.deliveryState ?? null });
    this.deps.signal('commit', 'success');
    this.channel.send({ type: 'TURN_COMMITTED', callTurnIndex: result.callTurnIndex, role: 'USER', turnId: result.turnId, clientTurnId: null });
    if (result.outcome === 'COMMITTED') this.answer(result.callTurnIndex, result.turnId, content);
  }

  /** The REALTIME reply of one committed turn: Safety stored first, then generation released into the reply's audio. */
  private answer(callTurnIndex: number, userTurnId: string, content: string): void {
    const conversation = this.deps.conversation();
    const channel = this.channel;
    const reply = new CallReply({
      store: this.deps.store, route: this.deps.route, channel, signal: this.deps.signal, observe: this.deps.observe, now: Date.now,
      // S3: the generation failed or stopped before storing the turn's Safety: the conversation recomputes and stores it.
      ensureSafety: () => {
        const bound = this.deps.conversation();
        if (!bound) return Promise.reject(new Error('LIVE_CALL_CONVERSATION_UNBOUND'));
        return bound.settleSafety({
          userId: channel.userId, sessionId: channel.sessionId, callId: channel.callId, callTurnIndex, userTurnId, content,
          accessToken: channel.accessToken(), storeSafety,
        });
      },
    }, callTurnIndex);
    const storeSafety = async (disposition: 'ALLOW' | 'GUIDED' | 'BLOCK'): Promise<void> => {
      const stored = await this.deps.store.storeSafety({ userId: channel.userId, callId: channel.callId, callTurnIndex, disposition });
      if (stored !== 'STORED' && stored !== 'SAME') throw new Error('CALL_SAFETY_NOT_STORED');
      reply.safetyStored();
    };
    this.reply = reply;
    this.replies.set(callTurnIndex, reply);
    if (!conversation) {
      reply.generationEnded('FAILED');
      return;
    }
    void conversation.reply({
      userId: channel.userId, sessionId: channel.sessionId, callId: channel.callId, callTurnIndex, userTurnId, content,
      accessToken: channel.accessToken(), signal: reply.signal, storeSafety,
      release: (piece, speech) => reply.release(piece, speech),
    }).then(
      (outcome) => {
        this.deps.observe({ kind: 'REPLY_OUTCOME', callTurnIndex, outcome, at: Date.now() });
        reply.generationEnded(outcome.kind);
      },
      () => reply.generationEnded('FAILED'),
    );
  }

  // ------------------------------------------------------------------ playout
  async playout(input: { readonly callTurnIndex: number; readonly chunkSeq: number; readonly playedMs: number }): Promise<PlayoutVerdict> {
    const reply = this.replies.get(input.callTurnIndex);
    // A reply this connection never sent (an older connection's, after a resume) has nothing here to confirm.
    if (!reply) return 'IGNORED';
    return reply.playout(input);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    // A held turn was never committed nor announced; it goes with the connection (the open exchange is the sweep's, CP3).
    if (this.takeHeld()) this.deps.signal('commit', 'held_at_close');
    for (const reply of this.replies.values()) reply.abort();
    void this.endRecognition();
  }

  private async endRecognition(): Promise<void> {
    const session = this.recognition;
    if (!session) {
      this.recognitionAbort.abort();
      return;
    }
    await this.sending.catch(() => undefined);
    let usage: SpeechRecognitionUsage = { completeness: 'ABSENT' };
    let failed = this.recognitionFailed;
    if (!failed) {
      try {
        usage = (await session.end()).usage;
      } catch {
        failed = true;
      }
    }
    if (usage.completeness === 'ABSENT' && this.sentBytes > 0) {
      // The gateway measured what it streamed even when the provider's session broke (D-2: the bytes it sent).
      usage = { completeness: 'COMPLETE', audioInputMs: Math.round(this.sentBytes / LIVE_NOTE_BYTES_PER_MS), source: 'GATEWAY_MEASURED' };
    }
    await this.settleRecognition(usage, failed ? 'FAILED' : 'SUCCEEDED');
  }

  private async settleRecognition(usage: SpeechRecognitionUsage, outcome: 'SUCCEEDED' | 'FAILED'): Promise<void> {
    if (!this.providerCallId) return;
    const providerCallId = this.providerCallId;
    this.providerCallId = null;
    const measured = usage.completeness === 'COMPLETE' && 'audioInputMs' in usage;
    await this.deps.store.settle({
      userId: this.channel.userId, providerCallId, outcome, completeness: measured ? 'COMPLETE' : 'ABSENT',
      usage: measured ? { AUDIO_INPUT_MS: usage.audioInputMs } : {},
    }).catch(() => this.deps.signal('recognition', 'transport_failure'));
  }
}

export { CALL_ENDPOINTING };
