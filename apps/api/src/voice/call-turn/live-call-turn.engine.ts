import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TelemetryService } from '../../observability/telemetry.service';
import { AUDIO_PACKET_MS } from '../call/live-call.protocol';
import type { RefusalReason } from '../call/live-call.protocol';
import {
  NULL_LIVE_CALL_SPEECH_SINK, type LiveCallSpeechSink, type LiveCallSpeechStream, type LiveCallTurnChannel, type PlayoutVerdict,
  type TextTurnVerdict,
} from '../call/live-call-speech.port';
import type { ListenSynthesisRoute } from '../listen/listen-synthesis.route';
import { LIVE_VOICE_NOTE_MODEL } from '../live-note/live-voice-note.repository';
import type { FinalizableRecognitionSession, RecognizedSpeech, SpeechRecognitionUsage } from '../speech-recognition.adapter';
import { LIVE_NOTE_BYTES_PER_MS, type RealtimeRecognition } from '../live-note/live-voice-note.service';
import { CallEndpointer, CALL_ENDPOINTING, type EndpointerEvent } from './call-endpointer';
import { CallReply, callRetrievalTerms, type CallReplyEvent } from './call-reply';
import { LIVE_CALL_FAILURE_LINE, failureLineFor, type CallFailureLine } from './call-failure-line';
import { CALL_TURN_STORE, type CallTurnStore, type CommitResult, type DeliveryState, type TextReplyState } from './call-turn.store';
import { LiveCallAnalysisSignal } from './live-call-analysis.signal';
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
/**
 * S8B-05 CP4: how long a connection that is going may take to commit what the person said (the utterance in progress, the
 * turns waiting) and store the open exchange's Safety, before its tracks close. Within the 30 s grace, well before it.
 */
const DRAIN_MS = 3_000;
const BAND_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;

/** What a proof or a test may observe of a call's turns: instants and counts only, never a word. */
export type CallTurnObservation =
  | CallReplyEvent
  | { readonly kind: 'ENDPOINT'; readonly event: EndpointerEvent['kind']; readonly atCaptureMs: number; readonly at: number }
  | { readonly kind: 'FINAL_ACCEPTED'; readonly answered: boolean; readonly at: number }
  | { readonly kind: 'COMMITTED'; readonly callTurnIndex: number; readonly at: number; readonly closed: DeliveryState | null }
  | { readonly kind: 'COMMIT_REFUSED'; readonly outcome: string; readonly at: number }
  | { readonly kind: 'COMMIT_HELD'; readonly attempt: number; readonly finals: number; readonly at: number }
  | { readonly kind: 'REPLY_OUTCOME'; readonly callTurnIndex: number; readonly outcome: LiveCallReplyOutcome; readonly at: number }
  // S8B-05 CP4
  | { readonly kind: 'BARGE_IN'; readonly callTurnIndex: number; readonly outcome: string; readonly at: number }
  | { readonly kind: 'ECHO_EXCLUDED'; readonly words: number; readonly at: number }
  | { readonly kind: 'DRAINED'; readonly outcome: 'DRAINED' | 'TIMEOUT'; readonly waiting: number; readonly at: number };

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
 * S8B-05 CP4 adds the rest of the call's turns (P4 / P5, D-05-07, §5.2):
 *   - BARGE_IN stops QANDEEL's voice at once and records its onset; the person's words are kept from it, and the reply's
 *     residual echo before it is never taken as theirs (§5.2 step 5); the next commit closes the reply INTERRUPTED (N1);
 *   - TEXT_TURN, a message typed during the call, is a turn in the same order (one backlog with speech), committed once by
 *     its clientTurnId and answered in text through the same conversation;
 *   - a connection that is going drains first: the utterance in progress and every waiting turn are committed, and the open
 *     exchange's Safety stored, so the next connection (on any instance) closes it by N1 and loses no word;
 *   - a reply that produced nothing plays the fixed line F-01 when its files are installed, then closes FAILED.
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
    // S8B-05 CP3: the call analysis worker's kick (in memory; no database call on the voice path).
    @Optional() private readonly analysis?: LiveCallAnalysisSignal,
    // S8B-05 CP4: F-01's reply packets, null while its files are NOT_INSTALLED (D-05-02).
    @Optional() @Inject(LIVE_CALL_FAILURE_LINE) private readonly failureLine?: CallFailureLine | null,
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
      signal: (op, outcome) => this.signal(op, outcome), observe: (o) => {
        this.observer?.(o);
        this.kickAnalysis(channel.sessionId, o);
      },
      failureLine: this.failureLine ?? null,
    });
  }

  /**
   * S8B-05 CP3: the instants at which the session's analysis order can move - a committed turn (its USER half is queued,
   * and an N1 close queued the previous reply's), the reply's first audio (L2's critical window ends) and the reply's
   * close (its half is queued) - kick the worker. Synchronous and in memory; never awaited, never a failure of the call.
   */
  private kickAnalysis(sessionId: string, observation: CallTurnObservation): void {
    if (observation.kind === 'COMMITTED') this.analysis?.kick(sessionId, 'TURN_COMMITTED');
    else if (observation.kind === 'FIRST_AUDIO') this.analysis?.kick(sessionId, 'FIRST_AUDIO');
    else if (observation.kind === 'REPLY_END') this.analysis?.kick(sessionId, 'EXCHANGE_CLOSED');
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
  readonly failureLine: CallFailureLine | null;
}

/** S8B-05 CP4: a turn waiting for its commit, in the call's order: a finished utterance, or a message typed during the call. */
type PendingTurn =
  | { readonly kind: 'SPEECH'; readonly turn: SpokenTurn }
  | { readonly kind: 'TEXT'; readonly clientTurnId: string; readonly text: string; readonly done: (verdict: TextTurnVerdict) => void };

/** What a commit needs of the exchange it may close (N1): a spoken reply or a text reply. */
interface OpenReply {
  readonly closed: boolean;
  readonly safetySettled: Promise<void>;
  settleSafety(): Promise<boolean>;
  closedBy(deliveryState: DeliveryState): void;
}

const REFUSAL_OF_COMMIT: Readonly<Partial<Record<string, RefusalReason>>> = {
  FENCED: 'FENCED', NOT_FOUND: 'NOT_FOUND', CONSENT_REQUIRED: 'CONSENT_REQUIRED', NOT_AVAILABLE_NOW: 'NOT_AVAILABLE_NOW', CALL_TURN_LIMIT: 'NOT_AVAILABLE_NOW',
};

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
  /**
   * S8B-05 CP4: where the recognizer's stream time lies on the call's clock. The stream is fed frames back to back; a
   * break is kept wherever the fed capture instants are not contiguous (a mute, a resend gap), so a word's end maps back.
   */
  private streamMs = 0;
  private readonly streamBreaks: Array<{ readonly streamMs: number; readonly captureMs: number }> = [];
  /** FINAL words not yet in a committed turn, in order. */
  private finals: RecognizedSpeech[] = [];
  private finalAccepted: Promise<void> = Promise.resolve();
  private turnChain: Promise<void> = Promise.resolve();
  private reply: OpenReply | null = null;
  private readonly replies = new Map<number, CallReply | CallTextReply>();
  /**
   * S8B-05 CP4: the turns waiting for their commit, in order (one backlog for speech and text). Normally empty between
   * commits; a turn stays at its head, uncommitted and unannounced, while the previous exchange's Safety cannot be
   * recovered (S3), and is retried (250 ms doubling to 4 s) until it is or the call goes.
   */
  private backlog: PendingTurn[] = [];
  private readonly texts = new Map<string, Promise<TextTurnVerdict>>();
  private heldRetry: ReturnType<typeof setTimeout> | null = null;
  private heldAttempts = 0;
  /** S8B-05 CP4 (P5): the open exchange an older connection left, settled once before this connection's first commit. */
  private inherited: Promise<boolean> | null = null;
  private draining = false;
  private closed = false;

  constructor(private readonly channel: LiveCallTurnChannel, private readonly deps: SessionDeps) {
    void this.openRecognition();
  }

  // ------------------------------------------------------------------ uplink
  push(pcm16k: Buffer, captureMs: number): void {
    if (this.closed || this.draining) return;
    this.feed(pcm16k, captureMs);
    for (const event of this.endpointer.push(pcm16k, captureMs)) {
      this.deps.observe({ kind: 'ENDPOINT', event: event.kind, atCaptureMs: event.atMs, at: Date.now() });
      if (event.kind === 'FINALIZE') this.forceEnd();
      if (event.kind === 'COMMIT_SILENCE') this.chain(() => this.commitTurn());
    }
  }

  private chain(work: () => Promise<void>): Promise<void> {
    this.turnChain = this.turnChain.then(work).catch(() => this.deps.signal('commit', 'integrity_failure'));
    return this.turnChain;
  }

  private feed(pcm: Buffer, captureMs: number): void {
    if (this.recognitionFailed) return;
    const last = this.streamBreaks[this.streamBreaks.length - 1];
    if (!last || last.captureMs + (this.streamMs - last.streamMs) !== captureMs) this.streamBreaks.push({ streamMs: this.streamMs, captureMs });
    this.streamMs += AUDIO_PACKET_MS;
    if (!this.recognition) {
      this.pending.push(pcm);
      if (this.pending.length * AUDIO_PACKET_MS > MAX_PENDING_RECOGNITION_MS) this.failRecognition();
      return;
    }
    this.send(pcm);
  }

  private send(pcm: Buffer): void {
    const session = this.recognition!;
    this.sentBytes += pcm.length;
    this.sending = this.sending.then(() => session.send(pcm)).catch(() => this.failRecognition());
  }

  /** A recognizer stream instant on the call's clock. */
  private captureOf(streamMs: number): number {
    let low = 0;
    let high = this.streamBreaks.length - 1;
    if (high < 0) return streamMs;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.streamBreaks[mid]!.streamMs <= streamMs) low = mid;
      else high = mid - 1;
    }
    const at = this.streamBreaks[low]!;
    return at.captureMs + (streamMs - at.streamMs);
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
    for (const pcm of this.pending) this.send(pcm);
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
    if (this.closed || this.draining || this.endpointer.state !== 'PENDING_COMMIT') return;
    this.takeUtterance();
    await this.flush();
  }

  /**
   * The utterance the endpointer holds, as a turn waiting for its commit (none for noise or nothing recognized). S8B-05
   * CP4 (§5.2 step 5): FINAL words that end before a barge-in's onset, while the reply it stopped was playing, are the
   * reply's residual echo, never the person's: they are left out, and the turn starts at the onset.
   */
  private takeUtterance(): void {
    let turnStart = this.endpointer.turnStart;
    const speechEnd = this.endpointer.speechEnd;
    const words = this.finals;
    this.finals = [];
    this.endpointer.reset();
    const windows = [...this.replies.values()].flatMap((r) => (r instanceof CallReply && r.bargedPlayback ? [r.bargedPlayback] : []));
    const kept = windows.length === 0 ? words : words.filter((word) => {
      const endMs = this.captureOf(word.endMs);
      return !windows.some((w) => endMs > w.startMs && endMs <= w.onsetMs);
    });
    if (kept.length < words.length) {
      this.deps.observe({ kind: 'ECHO_EXCLUDED', words: words.length - kept.length, at: Date.now() });
      this.deps.signal('echo', 'excluded');
    }
    for (const w of windows) if (turnStart !== null && turnStart >= w.startMs && turnStart < w.onsetMs && w.onsetMs < speechEnd) turnStart = w.onsetMs;
    const content = kept.map((w) => w.text.trim()).filter((t) => t !== '').join(' ');
    if (content === '' || turnStart === null) {
      // Noise, or nothing recognized: no turn. A turn waiting at the head of the backlog goes on alone.
      this.deps.signal('commit', 'no_speech');
      return;
    }
    // A spoken turn still waiting at the end of the backlog and the words said since are ONE turn, in order (as speech
    // resumed before a commit is, D-A1); after a typed turn they are a turn of their own.
    const last = this.backlog[this.backlog.length - 1];
    if (last?.kind === 'SPEECH') {
      this.backlog[this.backlog.length - 1] = { kind: 'SPEECH', turn: { words: [...last.turn.words, ...kept], turnStart: last.turn.turnStart, speechEnd } };
    } else {
      this.backlog.push({ kind: 'SPEECH', turn: { words: kept, turnStart, speechEnd } });
    }
  }

  /** Commits the backlog in order until it is empty or its head must wait (S3: held; or the person is speaking again). */
  private async flush(): Promise<void> {
    while (!this.closed && this.backlog.length > 0) {
      const head = this.backlog[0]!;
      // A spoken turn is not committed over the person: it stays, and joins the words said now at their commit (D-A1).
      if (head.kind === 'SPEECH' && this.endpointer.state !== 'IDLE') return;
      const outcome = head.kind === 'SPEECH' ? await this.commitSpoken(head.turn) : await this.commitText(head);
      if (outcome === 'HELD') {
        this.hold(head);
        return;
      }
      this.backlog.shift();
      this.heldAttempts = 0;
    }
  }

  /**
   * S3: the previous exchange's Safety cannot be recovered now (its context unreadable). The turn is kept whole, neither
   * committed nor announced, and retried (250 ms doubling to 4 s) until the recovery succeeds or the call goes.
   */
  private hold(head: PendingTurn): void {
    if (this.heldRetry || this.closed || this.draining) return;
    this.deps.observe({ kind: 'COMMIT_HELD', attempt: this.heldAttempts, finals: head.kind === 'SPEECH' ? head.turn.words.length : 0, at: Date.now() });
    this.deps.signal('commit', 'held_safety_unsettled');
    const delay = Math.min(HELD_RETRY_MAX_MS, HELD_RETRY_FIRST_MS * 2 ** this.heldAttempts);
    this.heldAttempts += 1;
    this.heldRetry = setTimeout(() => {
      this.heldRetry = null;
      void this.chain(() => this.flush());
    }, delay);
  }

  /**
   * N1 closes the open exchange with its stored Safety: give the previous turn's generation a bounded moment to store it,
   * then S3 recomputes it (the same gate over the same reader). Never closed without it, never a default. S8B-05 CP4 (P5):
   * before this connection's first commit, the exchange an older connection left open is settled the same way.
   */
  private async previousReady(): Promise<boolean> {
    const previous = this.reply;
    if (!previous) return this.inheritedSettled();
    if (previous.closed) return true;
    let wait: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([previous.safetySettled, new Promise((resolve) => { wait = setTimeout(resolve, SAFETY_WAIT_MS); })]);
    clearTimeout(wait);
    if (!(await previous.settleSafety())) return false;
    await this.channel.settleQandeelTrack();
    return true;
  }

  private inheritedSettled(): Promise<boolean> {
    this.inherited ??= this.settleInherited().then((settled) => {
      if (!settled) this.inherited = null;
      return settled;
    });
    return this.inherited;
  }

  private async settleInherited(): Promise<boolean> {
    const channel = this.channel;
    const open = await this.deps.store.readOpenExchange({ userId: channel.userId, callId: channel.callId, epoch: channel.epoch }).catch(() => null);
    if (!open) return false;
    if (open.outcome !== 'OPEN' || open.safety !== null || open.callTurnIndex === null || !open.userTurnId || open.content === null) return true;
    const conversation = this.deps.conversation();
    if (!conversation) return false;
    const callTurnIndex = open.callTurnIndex;
    try {
      await conversation.settleSafety({
        userId: channel.userId, sessionId: channel.sessionId, callId: channel.callId, callTurnIndex, userTurnId: open.userTurnId, content: open.content,
        accessToken: channel.accessToken(), storeSafety: (disposition) => this.storeSafety(callTurnIndex, disposition),
      });
      this.deps.signal('resume', 'inherited_safety_settled');
      return true;
    } catch {
      return false;
    }
  }

  private async storeSafety(callTurnIndex: number, disposition: 'ALLOW' | 'GUIDED' | 'BLOCK'): Promise<void> {
    const channel = this.channel;
    const stored = await this.deps.store.storeSafety({ userId: channel.userId, callId: channel.callId, callTurnIndex, disposition });
    if (stored !== 'STORED' && stored !== 'SAME') throw new Error('CALL_SAFETY_NOT_STORED');
  }

  private async commitSpoken(turn: SpokenTurn): Promise<'DONE' | 'HELD'> {
    const { words, turnStart, speechEnd } = turn;
    const content = words.map((w) => w.text.trim()).filter((t) => t !== '').join(' ');
    const band = words.reduce<RecognizedSpeech['band']>((worst, w) => (BAND_ORDER[w.band] < BAND_ORDER[worst] ? w.band : worst), 'HIGH');
    if (!(await this.previousReady())) return this.closed ? 'DONE' : 'HELD';
    if (this.closed) return 'DONE';
    const userEnd = await this.channel.settleUserTrack();
    if (userEnd === null || this.closed) return 'DONE';
    const anchorStartMs = floor20(turnStart);
    const anchorEndMs = Math.min(ceil20(speechEnd), userEnd);
    if (anchorEndMs <= anchorStartMs) {
      this.deps.signal('commit', 'integrity_failure');
      return 'DONE';
    }
    const result = await this.deps.store.commit({
      userId: this.channel.userId, callId: this.channel.callId, epoch: this.channel.epoch, turnId: randomUUID(), commitId: randomUUID(), channel: 'SPEECH',
      content, band, anchorStartMs, anchorEndMs, terms: callRetrievalTerms(content), closeAssistantTurnId: randomUUID(), closeEventId: randomUUID(),
    }).catch(() => null);
    if (!this.committed(result, null)) return 'DONE';
    if (result!.outcome !== 'COMMITTED') return 'DONE';
    // A turn the connection drains as it goes is committed, never answered (no one would hear it): its Safety is stored so
    // the next commit can close its exchange (N1), on this call's next connection.
    if (this.draining) await this.settleUnanswered(result!.callTurnIndex!, result!.turnId!, content);
    else this.answer(result!.callTurnIndex!, result!.turnId!, content);
    return 'DONE';
  }

  /** D-05-07 / P4: the message typed during the call is its next turn, committed once by its clientTurnId and answered in text. */
  private async commitText(item: Extract<PendingTurn, { kind: 'TEXT' }>): Promise<'DONE' | 'HELD'> {
    if (!(await this.previousReady())) {
      if (!this.closed) return 'HELD';
      item.done({ kind: 'REFUSED', reason: 'UNAVAILABLE' });
      return 'DONE';
    }
    const result = await this.deps.store.commit({
      userId: this.channel.userId, callId: this.channel.callId, epoch: this.channel.epoch, turnId: randomUUID(), commitId: item.clientTurnId,
      channel: 'TEXT', content: item.text, band: null, anchorStartMs: null, anchorEndMs: null, terms: callRetrievalTerms(item.text),
      closeAssistantTurnId: randomUUID(), closeEventId: randomUUID(),
    }).catch(() => null);
    if (!this.committed(result, item.clientTurnId)) {
      item.done({ kind: 'REFUSED', reason: REFUSAL_OF_COMMIT[result?.outcome ?? ''] ?? 'UNAVAILABLE' });
      return 'DONE';
    }
    item.done({ kind: 'COMMITTED' });
    // A text reply is the conversation's: it is generated and closed whatever becomes of this connection (a resend of the
    // same message answers ALREADY_COMMITTED from its commit and generates nothing twice).
    if (result!.outcome === 'COMMITTED') this.answerText(result!.callTurnIndex!, result!.turnId!, item.text);
    return 'DONE';
  }

  /** The commit's answer: on success the phone gets TURN_COMMITTED, and REPLY_END for the exchange it closed (N1). */
  private committed(result: CommitResult | null, clientTurnId: string | null): boolean {
    if (!result || (result.outcome !== 'COMMITTED' && result.outcome !== 'ALREADY_COMMITTED') || result.callTurnIndex === null || !result.turnId) {
      this.deps.observe({ kind: 'COMMIT_REFUSED', outcome: result?.outcome ?? 'UNAVAILABLE', at: Date.now() });
      this.deps.signal('commit', result ? 'refused_expected' : 'transport_failure');
      return false;
    }
    if (result.closed) this.replies.get(result.closed.callTurnIndex)?.closedBy(result.closed.deliveryState);
    this.deps.observe({ kind: 'COMMITTED', callTurnIndex: result.callTurnIndex, at: Date.now(), closed: result.closed?.deliveryState ?? null });
    this.deps.signal('commit', 'success');
    this.channel.send({ type: 'TURN_COMMITTED', callTurnIndex: result.callTurnIndex, role: 'USER', turnId: result.turnId, clientTurnId });
    return true;
  }

  private async settleUnanswered(callTurnIndex: number, userTurnId: string, content: string): Promise<void> {
    const conversation = this.deps.conversation();
    const channel = this.channel;
    await conversation?.settleSafety({
      userId: channel.userId, sessionId: channel.sessionId, callId: channel.callId, callTurnIndex, userTurnId, content, accessToken: channel.accessToken(),
      storeSafety: (disposition) => this.storeSafety(callTurnIndex, disposition),
    }).catch(() => this.deps.signal('drain', 'safety_unsettled'));
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
      failureLine: () => failureLineFor(this.deps.failureLine, content),
    }, callTurnIndex);
    const storeSafety = async (disposition: 'ALLOW' | 'GUIDED' | 'BLOCK'): Promise<void> => {
      await this.storeSafety(callTurnIndex, disposition);
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

  /** D-05-07: the reply to a message typed during the call, in text (the same Safety, context and REALTIME generation). */
  private answerText(callTurnIndex: number, userTurnId: string, content: string): void {
    const conversation = this.deps.conversation();
    const channel = this.channel;
    const reply: CallTextReply = new CallTextReply({
      store: this.deps.store, channel, signal: this.deps.signal, observe: this.deps.observe,
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
      await this.storeSafety(callTurnIndex, disposition);
      reply.safetyStored();
    };
    this.reply = reply;
    this.replies.set(callTurnIndex, reply);
    if (!conversation) {
      void reply.generationEnded('FAILED');
      return;
    }
    void conversation.reply({
      userId: channel.userId, sessionId: channel.sessionId, callId: channel.callId, callTurnIndex, userTurnId, content, channel: 'TEXT',
      accessToken: channel.accessToken(), signal: reply.signal, storeSafety, release: (piece) => reply.release(piece),
    }).then(
      (outcome) => {
        this.deps.observe({ kind: 'REPLY_OUTCOME', callTurnIndex, outcome, at: Date.now() });
        return reply.generationEnded(outcome.kind);
      },
      () => reply.generationEnded('FAILED'),
    );
  }

  // ------------------------------------------------------------------ the phone's commands
  async playout(input: { readonly callTurnIndex: number; readonly chunkSeq: number; readonly playedMs: number }): Promise<PlayoutVerdict> {
    const reply = this.replies.get(input.callTurnIndex);
    if (reply) return reply.playout(input);
    // S8B-05 CP4 (P5): a confirmation resent after a resume, for a reply an older connection sent. It is applied while the
    // exchange is open (the stored clock start; the heard mark stays bounded by the QANDEEL track at the close), else
    // rejected and counted (P3); this connection never had that audio, so nothing is written to the track.
    const channel = this.channel;
    const result = await this.deps.store.confirmPlayout({
      userId: channel.userId, callId: channel.callId, epoch: channel.epoch, callTurnIndex: input.callTurnIndex, playedMs: input.playedMs, clockStartMs: null,
    }).catch(() => null);
    return result?.outcome === 'ADVANCED' ? 'APPLIED' : 'IGNORED';
  }

  /**
   * S8B-05 CP4 (P4, §5.2): the person began to speak over QANDEEL. The reply stops at once (the one AbortController: the
   * generation, every synthesis attempt, no later chunk), never finished: the next turn's commit (N1) closes it with what
   * was heard (INTERRUPTED). The onset is recorded (the first one; a BARGE_IN for a closed exchange is late, P3).
   */
  async bargeIn(input: { readonly callTurnIndex: number; readonly captureMs: number }): Promise<'APPLIED' | 'IGNORED'> {
    const reply = this.replies.get(input.callTurnIndex);
    if (reply instanceof CallReply && !reply.closed) reply.interrupt(input.captureMs);
    const channel = this.channel;
    const result = await this.deps.store.recordBargeIn({
      userId: channel.userId, callId: channel.callId, epoch: channel.epoch, callTurnIndex: input.callTurnIndex, captureMs: input.captureMs,
    }).catch(() => null);
    this.deps.observe({ kind: 'BARGE_IN', callTurnIndex: input.callTurnIndex, outcome: result?.outcome ?? 'UNAVAILABLE', at: Date.now() });
    if (!result) {
      this.deps.signal('barge_in', 'transport_failure');
      return 'IGNORED';
    }
    if (result.outcome === 'CLOSED') this.deps.observe({ kind: 'LATE', callTurnIndex: input.callTurnIndex, what: 'BARGE_IN' });
    this.deps.signal('barge_in', result.outcome === 'RECORDED' || result.outcome === 'ALREADY_RECORDED' ? 'success' : 'refused_expected');
    return result.outcome === 'RECORDED' || result.outcome === 'ALREADY_RECORDED' ? 'APPLIED' : 'IGNORED';
  }

  /**
   * S8B-05 CP4 (D-05-07 T1, P4): a message typed during the call. QANDEEL's voice stops at once (as a barge-in without an
   * onset), the message takes its place in the call's order behind any turn still waiting, and its commit closes the open
   * exchange (N1). One commit per clientTurnId: a resend settles with the first.
   */
  textTurn(input: { readonly clientTurnId: string; readonly text: string }): Promise<TextTurnVerdict> {
    const known = this.texts.get(input.clientTurnId);
    if (known) return known;
    if (this.closed || this.draining) return Promise.resolve({ kind: 'REFUSED', reason: 'UNAVAILABLE' });
    if (this.reply instanceof CallReply && !this.reply.closed) this.reply.interrupt(null);
    const verdict = new Promise<TextTurnVerdict>((resolve) => {
      this.backlog.push({ kind: 'TEXT', clientTurnId: input.clientTurnId, text: input.text, done: resolve });
    });
    this.texts.set(input.clientTurnId, verdict);
    void this.chain(() => this.flush());
    return verdict;
  }

  /**
   * S8B-05 CP4: the connection is going while it still holds the call. QANDEEL stops; the utterance in progress is
   * finalized and committed with every turn still waiting (no word the person said is lost); the open exchange's Safety is
   * stored so the next connection's first commit can close it. Bounded: what does not finish in time is left (a typed turn
   * not ACKed is resent by the phone after the resume).
   */
  async drain(): Promise<void> {
    if (this.closed || this.draining) return;
    this.draining = true;
    if (this.heldRetry) clearTimeout(this.heldRetry);
    this.heldRetry = null;
    for (const reply of this.replies.values()) if (reply instanceof CallReply && !reply.closed) reply.interrupt(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bound = new Promise<'TIMEOUT'>((resolve) => { timer = setTimeout(() => resolve('TIMEOUT'), DRAIN_MS); });
    const drained = this.chain(async () => {
      if (this.endpointer.state === 'SPEAKING') this.forceEnd();
      if (this.endpointer.state !== 'IDLE') {
        await this.finalAccepted;
        this.takeUtterance();
      }
      await this.flush();
      if (this.reply && !this.reply.closed) await this.reply.settleSafety();
    }).then(() => 'DRAINED' as const);
    const outcome = await Promise.race([drained, bound]);
    clearTimeout(timer);
    this.deps.observe({ kind: 'DRAINED', outcome, waiting: this.backlog.length, at: Date.now() });
    this.deps.signal('drain', outcome === 'DRAINED' && this.backlog.length === 0 ? 'success' : 'incomplete');
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.heldRetry) clearTimeout(this.heldRetry);
    this.heldRetry = null;
    // What is still waiting goes with the connection: a typed turn is refused (the phone resends it after the resume), a
    // spoken one was never committed nor announced (its audio stays on the USER track).
    for (const pending of this.backlog) {
      if (pending.kind === 'TEXT') pending.done({ kind: 'REFUSED', reason: 'UNAVAILABLE' });
      else this.deps.signal('commit', 'held_at_close');
    }
    this.backlog = [];
    // QANDEEL's voice stops with the connection; a text reply is the conversation's and goes on to its close.
    for (const reply of this.replies.values()) if (reply instanceof CallReply) reply.interrupt(null);
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

interface TextReplyDeps {
  readonly store: CallTurnStore;
  readonly channel: LiveCallTurnChannel;
  readonly signal: (op: string, outcome: string) => void;
  readonly observe: (observation: CallTurnObservation) => void;
  readonly ensureSafety: () => Promise<void>;
}

/** The longest text reply a typed exchange stores (0190's turn bound). */
const MAX_TEXT_REPLY_CHARS = 4000;

/**
 * S8B-05 CP4 (D-05-07) — the text reply of ONE typed exchange of the call. Its released pieces are its text; once the
 * generation ends, it closes its exchange through the ONE close (0192 TEXT_REPLIED: COMPLETE / WITHHELD_TAIL with the text,
 * FAILED with none), never without the stored Safety (S3 recovers it first), and the phone gets TURN_COMMITTED (ASSISTANT,
 * when there is text to read) and REPLY_END (no chunks). The next committed turn may close it first (N1): its generation
 * stops and it is INTERRUPTED with no text. Not stopped by the connection going: the reply is the conversation's.
 */
class CallTextReply implements OpenReply {
  private readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  private readonly pieces: string[] = [];
  private ended = false;
  private closedState: DeliveryState | null = null;
  private resolveSafety!: () => void;
  private safetyKnown = false;
  private safetyRecovery: Promise<boolean> | null = null;
  readonly safetySettled = new Promise<void>((resolve) => {
    this.resolveSafety = resolve;
  });

  constructor(private readonly deps: TextReplyDeps, readonly callTurnIndex: number) {}

  get closed(): boolean {
    return this.closedState !== null;
  }

  safetyStored(): void {
    this.safetyKnown = true;
    this.resolveSafety();
  }

  settleSafety(): Promise<boolean> {
    if (this.safetyKnown) return Promise.resolve(true);
    this.safetyRecovery ??= this.deps.ensureSafety().then(() => {
      this.safetyKnown = true;
      return true;
    }, () => false).finally(() => {
      this.safetyRecovery = null;
    });
    return this.safetyRecovery;
  }

  release(piece: string): void {
    if (this.ended || this.signal.aborted) return;
    this.pieces.push(piece);
  }

  /** A text reply has no audio: a PLAYOUT for it names a chunk the server never sent. */
  async playout(_input: { readonly callTurnIndex: number; readonly chunkSeq: number; readonly playedMs: number }): Promise<PlayoutVerdict> {
    return 'VIOLATION';
  }

  closedBy(deliveryState: DeliveryState): void {
    this.controller.abort();
    this.resolveSafety();
    this.announce(deliveryState, null);
  }

  async generationEnded(kind: 'COMPLETE' | 'WITHHELD_TAIL' | 'FAILED'): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.resolveSafety();
    if (this.closed) return;
    let text = '';
    let state: TextReplyState = kind;
    for (const piece of this.pieces) {
      if (text.length + piece.length > MAX_TEXT_REPLY_CHARS) {
        state = 'WITHHELD_TAIL';
        break;
      }
      text += piece;
    }
    if (kind === 'FAILED' || text.trim() === '') {
      state = 'FAILED';
      text = '';
    }
    // S3: never closed without its stored Safety (recovered here when the generation failed before storing it).
    if (!(await this.settleSafety())) {
      this.deps.signal('close', 'safety_unsettled');
      return;
    }
    const channel = this.deps.channel;
    const result = await this.deps.store.closeText({
      userId: channel.userId, callId: channel.callId, callTurnIndex: this.callTurnIndex, state, text, terms: state === 'FAILED' ? [] : callRetrievalTerms(text),
      assistantTurnId: randomUUID(), eventId: randomUUID(),
    }).catch(() => null);
    if (!result || (result.outcome !== 'CLOSED' && result.outcome !== 'ALREADY_CLOSED') || !result.deliveryState) {
      this.deps.signal('close', 'transport_failure');
      return;
    }
    this.announce(result.deliveryState, result.deliveryState === 'COMPLETE' || result.deliveryState === 'WITHHELD_TAIL' ? result.assistantTurnId : null);
  }

  private announce(deliveryState: DeliveryState, assistantTurnId: string | null): void {
    if (this.closedState) return;
    this.closedState = deliveryState;
    const channel = this.deps.channel;
    if (assistantTurnId) channel.send({ type: 'TURN_COMMITTED', callTurnIndex: this.callTurnIndex, role: 'ASSISTANT', turnId: assistantTurnId, clientTurnId: null });
    channel.send({ type: 'REPLY_END', callTurnIndex: this.callTurnIndex, chunks: 0, deliveryState });
    this.deps.observe({ kind: 'REPLY_END', callTurnIndex: this.callTurnIndex, at: Date.now(), deliveryState, chunks: 0 });
  }
}

export { CALL_ENDPOINTING };
