import { isUplinkPacket, OpusPacketDecoder } from './codec/opus-codec';
import {
  decodeAudioFrame, encodeReplyAudioFrame, encodeServerMessage, LIVE_CALL_CLOSE, LIVE_CALL_LIMITS, NOT_YET_SUPPORTED, parseClientMessage, type CallEndReason,
  type CallState, type ClientMessage, type RefusalReason, type ServerMessage,
} from './live-call.protocol';
import type { LiveCallSpeechSink, LiveCallSpeechStream, LiveCallTurnChannel, ReplyAudioPacket } from './live-call-speech.port';
import type { LiveCallStore, TrackState } from './live-call.store';
import { UserTrackWriter, type CallSegmentMedia, type WriterFailure } from './recording/user-track-writer';

/** What a connection needs from its socket (the RFC 6455 gateway, or a test double). */
export interface CallTransport {
  sendText(text: string): void;
  /** S8B-05 CP2: one binary frame towards the phone (REPLY_AUDIO). */
  sendBinary(frame: Buffer): void;
  close(code: number, reason: string): void;
  /** Bytes queued towards the phone and not yet written. */
  readonly bufferedBytes: number;
}

export interface CallClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const REAL_CLOCK: CallClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const t = setTimeout(fn, ms);
    t.unref?.();
    return t;
  },
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export interface CallConnectionDeps {
  readonly store: LiveCallStore;
  readonly media: CallSegmentMedia;
  readonly speech: LiveCallSpeechSink;
  /** Re-validates a refreshed access token (the same Supabase check as the upgrade). */
  readonly authenticate: (authorization: string) => Promise<{ userId: string }>;
  readonly registry: LiveCallRegistry;
  readonly clock: CallClock;
  readonly signal: (operation: string, outcome: string) => void;
}

/** The connections this instance holds, by call: a resume here takes over from the older one (it is fenced). */
export class LiveCallRegistry {
  private readonly byCall = new Map<string, LiveCallConnection>();

  holder(callId: string): LiveCallConnection | undefined {
    return this.byCall.get(callId);
  }

  hold(callId: string, connection: LiveCallConnection): void {
    this.byCall.set(callId, connection);
  }

  release(callId: string, connection: LiveCallConnection): void {
    if (this.byCall.get(callId) === connection) this.byCall.delete(callId);
  }

  get size(): number {
    return this.byCall.size;
  }

  all(): LiveCallConnection[] {
    return [...this.byCall.values()];
  }
}

type Phase = 'AWAIT_HELLO' | 'CONNECTING' | 'ACTIVE' | 'CLOSING' | 'CLOSED';

const REFUSAL_OF: Readonly<Record<string, RefusalReason>> = {
  COMMAND_CONFLICT: 'COMMAND_CONFLICT', NOT_FOUND: 'NOT_FOUND', SESSION_NOT_ACTIVE: 'SESSION_NOT_ACTIVE', NOT_AVAILABLE_NOW: 'NOT_AVAILABLE_NOW',
  CONSENT_REQUIRED: 'CONSENT_REQUIRED', ALREADY_IN_CALL: 'ALREADY_IN_CALL', CAPACITY_FULL: 'CAPACITY_FULL', OTHER_DEVICE: 'OTHER_DEVICE',
  FENCED: 'FENCED',
};

/** The token's own expiry (`exp`, read for scheduling only: its validity is the Supabase check), else a short fallback. */
export function tokenDeadline(accessToken: string, now: number): number {
  const fallback = now + LIVE_CALL_LIMITS.tokenFallbackLifetimeMs;
  const payload = accessToken.split('.')[1];
  if (!payload) return fallback;
  try {
    const exp = (JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown }).exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? Math.min(exp * 1000, now + 24 * 3600_000) : fallback;
  } catch {
    return fallback;
  }
}

/** A token bucket: `rate` per second, at most `burst` at once. */
class Bucket {
  private tokens: number;
  private at: number;

  constructor(private readonly rate: number, private readonly burst: number, now: number) {
    this.tokens = burst;
    this.at = now;
  }

  take(now: number): boolean {
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.at) / 1000) * this.rate);
    this.at = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/**
 * S8B-05 CP1 — one phone's connection to its live call (protocol v1, `live-call.protocol.ts`). It holds no truth of its
 * own: the call authority (migration 0189) decides begin, activation, epoch, resume and end; this object only carries
 * them out for one socket.
 *
 *   - one message at a time, in arrival order (a promise chain), with every queue and rate bounded;
 *   - CONNECTING until the call's first audio arrives, then ACTIVE: started_at and the recording open together;
 *   - the USER track gets the packets as received, with honest MUTED / RECONNECTION gaps (UserTrackWriter);
 *   - the decoded 16 kHz PCM goes to the speech sink (CP1: none);
 *   - a lost connection never ends a call and never becomes a new one: it suspends the call (RECONNECTING for the
 *     grace) after flushing what it received; a fenced connection (a newer epoch exists) changes nothing at all;
 *   - CP2 / CP4 messages are answered REFUSED NOT_SUPPORTED_YET (never ACKed);
 *   - no audio, transcript, token or identifier is logged.
 *
 * S8B-05 CP2: the speech sink is the call turn engine when one is composed. It receives the decoded uplink and the
 * phone's PLAYOUT confirmations, and reaches this connection only through its channel: TURN_COMMITTED, REPLY_AUDIO and
 * REPLY_END go out on this socket, and the QANDEEL track (the reply audio confirmed playing) is written beside the USER
 * track on the same clock, under the same epoch. A PLAYOUT is applied, or ignored when older, repeated or late (P1 / P3),
 * and ACKed either way; BARGE_IN and TEXT_TURN are still refused NOT_SUPPORTED_YET.
 */
export class LiveCallConnection {
  private phase: Phase = 'AWAIT_HELLO';
  private inbox: Promise<void> = Promise.resolve();
  private queued = 0;
  private callId: string | null = null;
  private clientInstanceId: string | null = null;
  private epoch: number | null = null;
  private startedAt: string | null = null;
  private recordingId: string | null = null;
  private endsAt: number | null = null;
  private writer: UserTrackWriter | null = null;
  /** S8B-05 CP2: the QANDEEL track writer (the reply audio the phone confirmed playing). */
  private qandeel: UserTrackWriter | null = null;
  private sessionId: string | null = null;
  /** The capture instant of the latest uplink packet taken (the call's clock), for the reply's clock start. */
  private latestCaptureMs = 0;
  private decoder: OpusPacketDecoder | null = null;
  private speech: LiveCallSpeechStream | null = null;
  private lastSeq: number | null = null;
  private lastMsgId = 0;
  private muted = false;
  private muteSeen = false;
  private resumedGap = false;
  /** A newer connection of the same phone is taking the call on this instance: what was received is being written. */
  private handingOver = false;
  private fenced = false;
  private ended = false;
  /** A violation or overload was seen: nothing more is processed; the loss is already queued. */
  private doomed = false;
  private lastInboundAt: number;
  private readonly frames: Bucket;
  private readonly controls: Bucket;
  private readonly timers = new Map<string, unknown>();
  private readonly endingNotices = new Set<number>();

  constructor(
    private readonly transport: CallTransport,
    private readonly userId: string,
    tokenExpiresAt: number,
    private readonly deps: CallConnectionDeps,
    /** The person's current access token (the upgrade's, then each TOKEN_REFRESH): owner reads of the call turn engine. */
    private accessToken = '',
  ) {
    const now = deps.clock.now();
    this.lastInboundAt = now;
    this.frames = new Bucket(LIVE_CALL_LIMITS.framesPerSecond, LIVE_CALL_LIMITS.frameBurst, now);
    this.controls = new Bucket(LIVE_CALL_LIMITS.controlPerSecond, LIVE_CALL_LIMITS.controlPerSecond, now);
    this.arm('silence', LIVE_CALL_LIMITS.silenceTimeoutMs, () => this.checkSilence());
    this.armToken(tokenExpiresAt);
  }

  get state(): Phase {
    return this.phase;
  }

  // ------------------------------------------------------------------ inbound
  onText(text: string): void {
    if (!this.admit(true)) return;
    const message = parseClientMessage(text);
    if (!message) {
      this.violation();
      return;
    }
    this.enqueue(() => this.handle(message));
  }

  onBinary(frame: Buffer): void {
    if (!this.admit(false)) return;
    this.enqueue(() => this.handleAudio(frame));
  }

  /** The socket closed or failed underneath (not by this object). */
  onTransportClosed(): void {
    if (this.phase === 'CLOSED' || this.phase === 'CLOSING') return;
    this.enqueue(() => this.lose(null, ''));
  }

  private admit(control: boolean): boolean {
    if (this.phase === 'CLOSING' || this.phase === 'CLOSED') return false;
    const now = this.deps.clock.now();
    this.lastInboundAt = now;
    if (!this.frames.take(now) || (control && !this.controls.take(now))) {
      this.overloaded();
      return false;
    }
    // At most three seconds of audio may wait behind one database answer (an activation, a takeover).
    if (this.queued >= LIVE_CALL_LIMITS.frameBurst) {
      this.overloaded();
      return false;
    }
    return true;
  }

  private enqueue(work: () => Promise<void>): void {
    this.queued += 1;
    this.inbox = this.inbox.then(async () => {
      this.queued -= 1;
      if (this.phase === 'CLOSED') return;
      try {
        await work();
      } catch {
        this.deps.signal('connection', 'integrity_failure');
        await this.lose(LIVE_CALL_CLOSE.PROTOCOL_VIOLATION, 'INTERNAL');
      }
    });
  }

  // ------------------------------------------------------------------ control messages
  private async handle(message: ClientMessage): Promise<void> {
    if (this.doomed || this.phase === 'CLOSING' || this.phase === 'CLOSED') return;
    if (message.type === 'HELLO') {
      if (this.phase !== 'AWAIT_HELLO') return this.violation();
      return this.hello(message);
    }
    if (this.phase === 'AWAIT_HELLO') return this.violation();
    switch (message.type) {
      case 'HEARTBEAT':
        return;
      case 'TOKEN_REFRESH':
        return this.refreshToken(message.msgId, message.accessToken);
      case 'MUTE':
      case 'UNMUTE':
        if (this.phase !== 'ACTIVE') return this.violation();
        if (this.repeated(message.msgId)) return;
        this.muted = message.type === 'MUTE';
        if (this.muted) this.muteSeen = true;
        return this.ack(message.msgId);
      case 'END':
        if (this.repeated(message.msgId)) return;
        return this.endByPerson(message.msgId);
      case 'PLAYOUT': {
        if (this.phase !== 'ACTIVE') return this.violation();
        if (this.repeated(message.msgId)) return;
        const verdict = this.speech
          ? await this.speech.playout({ callTurnIndex: message.callTurnIndex, chunkSeq: message.chunkSeq, playedMs: message.playedMs }).catch(() => 'IGNORED')
          : 'IGNORED';
        if (verdict === 'VIOLATION') return this.violation();
        return this.ack(message.msgId);
      }
      default:
        if (NOT_YET_SUPPORTED.has(message.type)) {
          this.send({ type: 'REFUSED', reason: 'NOT_SUPPORTED_YET', msgId: 'msgId' in message ? message.msgId : null });
          return;
        }
        return this.violation();
    }
  }

  /** A msgId at or below the last applied one is a resend: re-ACKed, never applied twice (P5). */
  private repeated(msgId: number): boolean {
    if (msgId > this.lastMsgId) return false;
    this.ack(msgId, false);
    return true;
  }

  private ack(msgId: number, advance = true): void {
    if (advance) this.lastMsgId = Math.max(this.lastMsgId, msgId);
    this.send({ type: 'ACK', msgId });
  }

  private async hello(hello: Extract<ClientMessage, { type: 'HELLO' }>): Promise<void> {
    this.callId = hello.callId;
    this.clientInstanceId = hello.clientInstanceId;
    this.sessionId = hello.sessionId;
    if (!hello.resume) {
      const begun = await this.deps.store.begin({ userId: this.userId, sessionId: hello.sessionId, callId: hello.callId, clientInstanceId: hello.clientInstanceId })
        .catch(() => null);
      if (!begun) return this.refuseAndClose('UNAVAILABLE', 'begin');
      if (begun.outcome !== 'BEGUN' || begun.epoch === null) return this.refuseAndClose(REFUSAL_OF[begun.outcome] ?? 'UNAVAILABLE', 'begin');
      await this.takeOver();
      this.epoch = begun.epoch;
      this.phase = 'CONNECTING';
      this.deps.signal('begin', 'success');
      this.sendState('CONNECTING');
      this.armLease();
      return;
    }
    // The same phone's connection that holds the call on this instance writes what it received while its epoch still
    // holds: 0189 fences every write of an older epoch, so the epoch moves on only after that audio is admitted.
    const previous = this.handingOverFrom(hello.callId, hello.clientInstanceId);
    if (previous) await previous.handOver();
    const resumed = await this.deps.store.resume({ userId: this.userId, callId: hello.callId, clientInstanceId: hello.clientInstanceId }).catch(() => null);
    if (previous && resumed?.outcome !== 'RESUMED') previous.handingOver = false;
    if (!resumed) return this.refuseAndClose('UNAVAILABLE', 'resume');
    if (resumed.outcome === 'ENDED') {
      this.deps.signal('resume', 'refused_expected');
      this.ended = true;
      this.send(this.state_('ENDED', (resumed.callState as CallEndReason | null) ?? null));
      return this.shut(LIVE_CALL_CLOSE.NORMAL, 'ENDED');
    }
    if (resumed.outcome !== 'RESUMED' || resumed.epoch === null) return this.refuseAndClose(REFUSAL_OF[resumed.outcome] ?? 'UNAVAILABLE', 'resume');
    // The older connection on this instance (if any) is fenced and hands over what it received before the tracks are read.
    await this.takeOver();
    this.epoch = resumed.epoch;
    this.startedAt = resumed.startedAt;
    this.deps.signal('resume', 'success');
    if (resumed.callState === 'CONNECTING') {
      this.phase = 'CONNECTING';
      this.sendState('CONNECTING');
      this.armLease();
      return;
    }
    const tracks = await this.deps.store.readTracks({ userId: this.userId, callId: hello.callId }).catch(() => null);
    if (!tracks || tracks.recordingState !== 'RECORDING') return this.failCall('UNAVAILABLE');
    this.recordingId = tracks.recordingId;
    this.openMedia(tracks.recordingId, tracks);
    this.phase = 'ACTIVE';
    this.resumedGap = true;
    this.sendState('ACTIVE');
    this.armLease();
    await this.renewLease();
  }

  /** The connection of the same person and phone that holds this call on this instance, if any. */
  private handingOverFrom(callId: string, clientInstanceId: string): LiveCallConnection | null {
    const previous = this.deps.registry.holder(callId);
    return previous && previous !== this && previous.userId === this.userId && previous.clientInstanceId === clientInstanceId ? previous : null;
  }

  /**
   * Before a resume of the same phone on this instance: audio stops being taken (the phone resends it on the new
   * connection, from the durable end it is told) and what was taken is written under this connection's epoch, in order
   * behind whatever this connection is doing. Then the resume moves the epoch on and `yieldTo` fences this connection.
   */
  async handOver(): Promise<void> {
    if (this.phase === 'CLOSED') return;
    this.enqueue(async () => {
      this.handingOver = true;
      await this.flushTracks();
    });
    await this.inbox;
  }

  /** Same-instance takeover: the connection that held this call is fenced and flushes what it received. */
  private async takeOver(): Promise<void> {
    const callId = this.callId!;
    const previous = this.deps.registry.holder(callId);
    if (previous && previous !== this) {
      this.lastMsgId = Math.max(this.lastMsgId, previous.lastMsgId);
      await previous.yieldTo();
    }
    this.deps.registry.hold(callId, this);
  }

  /** Called on the older connection when a newer one takes the call on this instance. */
  async yieldTo(): Promise<void> {
    if (this.phase === 'CLOSED') return;
    this.fenced = true;
    this.phase = 'CLOSING';
    this.send({ type: 'REFUSED', reason: 'FENCED', msgId: null });
    await this.closeTracks();
    this.cleanup();
    this.transport.close(LIVE_CALL_CLOSE.FENCED, 'FENCED');
    this.deps.signal('connection', 'fenced');
  }

  private async refreshToken(msgId: number, accessToken: string): Promise<void> {
    const who = await this.deps.authenticate(`Bearer ${accessToken}`).catch(() => null);
    if (!who || who.userId !== this.userId) {
      this.send({ type: 'REFUSED', reason: 'TOKEN_INVALID', msgId });
      return this.lose(LIVE_CALL_CLOSE.TOKEN, 'TOKEN_INVALID');
    }
    this.accessToken = accessToken;
    this.armToken(tokenDeadline(accessToken, this.deps.clock.now()));
    this.ack(msgId);
  }

  private async endByPerson(msgId: number): Promise<void> {
    const reason = 'USER_ENDED';
    await this.flushTracks();
    const ended = await this.deps.store.end({ userId: this.userId, callId: this.callId!, epoch: this.epoch!, reason }).catch(() => null);
    if (!ended) {
      // Not known to be ended: the connection is lost instead (the call is recovered, never left ACTIVE for ever).
      return this.lose(LIVE_CALL_CLOSE.REFUSED, 'UNAVAILABLE');
    }
    if (ended.outcome === 'FENCED') return this.beFenced();
    this.ack(msgId);
    this.ended = true;
    this.deps.signal('end', 'success');
    this.send(this.state_('ENDED', (ended.endReason as CallEndReason | null) ?? reason));
    await this.shut(LIVE_CALL_CLOSE.NORMAL, 'ENDED');
  }

  // ------------------------------------------------------------------ audio
  private async handleAudio(raw: Buffer): Promise<void> {
    if (this.doomed || this.handingOver || this.phase === 'CLOSING' || this.phase === 'CLOSED') return;
    if (this.phase === 'AWAIT_HELLO') return this.violation();
    const frame = decodeAudioFrame(raw);
    if (!frame || frame.epoch !== this.epoch || !isUplinkPacket(frame.packet)) return this.violation();
    if (this.phase === 'CONNECTING') {
      if (frame.captureMs !== 0) return this.violation();
      const activated = await this.deps.store.activate({ userId: this.userId, callId: this.callId!, epoch: this.epoch }).catch(() => null);
      if (!activated) return this.lose(LIVE_CALL_CLOSE.REFUSED, 'UNAVAILABLE');
      if (activated.outcome === 'FENCED') return this.beFenced();
      if (activated.outcome === 'ENDED') return this.endedElsewhere(null);
      if (activated.outcome !== 'ACTIVE' || !activated.recordingId) return this.failCall(REFUSAL_OF[activated.outcome] ?? 'UNAVAILABLE');
      this.startedAt = activated.startedAt;
      this.recordingId = activated.recordingId;
      this.openMedia(activated.recordingId, { userTrackEndMs: 0, userNextSegment: 0, qandeelTrackEndMs: 0, qandeelNextSegment: 0 });
      this.phase = 'ACTIVE';
      this.deps.signal('activate', 'success');
      this.sendState('ACTIVE');
      await this.renewLease();
      if (this.phase !== 'ACTIVE') return;
    }
    const writer = this.writer!;
    // Order within the connection: seq rises by one; a lower seq is a resend (dropped), a jump is a violation.
    if (this.lastSeq !== null) {
      if (frame.seq <= this.lastSeq) return;
      if (frame.seq !== this.lastSeq + 1) return this.violation();
    }
    if (this.muted) return this.violation();
    const expected = writer.expectedCaptureMs;
    if (frame.captureMs < expected) {
      this.lastSeq = frame.seq;
      return; // a resend of audio the track already holds
    }
    if (frame.captureMs > expected) {
      if (this.resumedGap) writer.gap('RECONNECTION', frame.captureMs);
      else if (this.muteSeen) writer.gap('MUTED', frame.captureMs);
      else return this.violation();
    }
    this.lastSeq = frame.seq;
    this.resumedGap = false;
    this.muteSeen = false;
    let pcm: Buffer;
    try {
      pcm = this.decoder!.decode(frame.packet);
    } catch {
      return this.violation();
    }
    this.latestCaptureMs = frame.captureMs;
    this.speech?.push(pcm, frame.captureMs);
    writer.append(frame.packet, frame.captureMs);
    if (writer.pendingBytes > LIVE_CALL_LIMITS.maxPendingAudioBytes) return this.overloaded();
    if (writer.failure) return this.writerFailed();
  }

  private openMedia(recordingId: string, durable: Pick<TrackState, 'userTrackEndMs' | 'userNextSegment' | 'qandeelTrackEndMs' | 'qandeelNextSegment'>): void {
    const deps = { media: this.deps.media, store: this.deps.store, userId: this.userId, callId: this.callId!, epoch: this.epoch! };
    this.writer = new UserTrackWriter(deps, recordingId, durable);
    this.qandeel = UserTrackWriter.forTrack('QANDEEL', deps, recordingId, { endMs: durable.qandeelTrackEndMs, nextSegment: durable.qandeelNextSegment });
    this.decoder = new OpusPacketDecoder(16_000);
    this.latestCaptureMs = Math.max(0, durable.userTrackEndMs - 20);
    this.speech = this.deps.speech.open(this.channel());
    this.lastSeq = null;
  }

  /** What the call turn engine may do through this connection (S8B-05 CP2). */
  private channel(): LiveCallTurnChannel {
    const settle = async (writer: UserTrackWriter | null): Promise<number | null> => {
      if (!writer) return null;
      await writer.flush().catch(() => undefined);
      return writer.failure ? null : writer.storedEndMs;
    };
    return {
      userId: this.userId,
      callId: this.callId!,
      sessionId: this.sessionId!,
      epoch: this.epoch!,
      accessToken: () => this.accessToken,
      latestCaptureMs: () => this.latestCaptureMs,
      settleUserTrack: () => settle(this.writer),
      qandeelEndMs: () => this.qandeel?.expectedCaptureMs ?? 0,
      qandeelSilence: (endMs) => this.qandeel?.gap('NOT_SPEAKING', endMs),
      qandeelAppend: (packet, clockMs) => this.qandeel?.append(packet, clockMs),
      settleQandeelTrack: () => settle(this.qandeel),
      send: (message) => this.send(message),
      sendReplyAudio: (packet) => this.sendReplyAudio(packet),
    };
  }

  /** Both tracks write what they took (USER first: it is the person's audio). */
  private async flushTracks(): Promise<void> {
    await this.writer?.flush().catch(() => undefined);
    await this.qandeel?.flush().catch(() => undefined);
  }

  private async closeTracks(abandon = false): Promise<void> {
    await this.writer?.close(abandon).catch(() => undefined);
    await this.qandeel?.close(abandon).catch(() => undefined);
  }

  private writerFailure(): WriterFailure | null {
    return this.writer?.failure ?? this.qandeel?.failure ?? null;
  }

  // ------------------------------------------------------------------ lease, silence, token, length
  private armLease(): void {
    this.arm('lease', LIVE_CALL_LIMITS.leaseRenewalMs, () => {
      this.enqueue(async () => {
        await this.renewLease();
        if (this.phase === 'ACTIVE' || this.phase === 'CONNECTING') this.armLease();
      });
    });
  }

  private async renewLease(): Promise<void> {
    if (this.epoch === null || this.callId === null) return;
    if (this.writerFailure()) return this.writerFailed();
    const beat = await this.deps.store.heartbeat({ userId: this.userId, callId: this.callId, epoch: this.epoch }).catch(() => null);
    if (!beat) {
      this.deps.signal('lease', 'transport_failure');
      return; // the lease (20 s) outlives a missed renewal; the next one tries again
    }
    if (beat.outcome === 'FENCED' || beat.outcome === 'RECONNECTING' || beat.outcome === 'NOT_FOUND') return this.beFenced();
    if (beat.outcome === 'ENDED') return this.endedElsewhere((beat.callState as CallEndReason | null) ?? null);
    this.deps.signal('lease', 'success');
    if (beat.endsAt) this.scheduleEnd(Date.parse(beat.endsAt));
  }

  /** D-05-06: CALL_ENDING before the end, then the server's own end at the policy's maximum. */
  private scheduleEnd(endsAt: number): void {
    if (!Number.isFinite(endsAt) || this.endsAt === endsAt) return;
    this.endsAt = endsAt;
    const now = this.deps.clock.now();
    for (const notice of LIVE_CALL_LIMITS.callEndingNoticeMs) {
      const at = endsAt - notice - now;
      if (at > 0 && !this.endingNotices.has(notice)) {
        this.arm(`ending-${notice}`, at, () => {
          this.endingNotices.add(notice);
          this.send({ type: 'CALL_ENDING', endsInMs: notice });
        });
      }
    }
    this.arm('max-length', Math.max(0, endsAt - now), () => this.enqueue(() => this.endByServer()));
  }

  private async endByServer(): Promise<void> {
    if (this.phase !== 'ACTIVE') return;
    await this.flushTracks();
    const ended = await this.deps.store.end({ userId: this.userId, callId: this.callId!, epoch: this.epoch!, reason: 'SERVER_ENDED' }).catch(() => null);
    if (!ended) return this.lose(LIVE_CALL_CLOSE.REFUSED, 'UNAVAILABLE');
    if (ended.outcome === 'FENCED') return this.beFenced();
    this.ended = true;
    this.deps.signal('end', 'success');
    this.send(this.state_('ENDED', (ended.endReason as CallEndReason | null) ?? 'SERVER_ENDED'));
    await this.shut(LIVE_CALL_CLOSE.NORMAL, 'ENDED');
  }

  private checkSilence(): void {
    if (this.phase === 'CLOSING' || this.phase === 'CLOSED') return;
    const idle = this.deps.clock.now() - this.lastInboundAt;
    if (idle >= LIVE_CALL_LIMITS.silenceTimeoutMs) {
      this.enqueue(() => this.lose(LIVE_CALL_CLOSE.SILENCE, 'SILENCE'));
      return;
    }
    this.arm('silence', LIVE_CALL_LIMITS.silenceTimeoutMs - idle, () => this.checkSilence());
  }

  private armToken(deadline: number): void {
    this.arm('token', Math.max(0, deadline - this.deps.clock.now()), () => {
      this.send({ type: 'REFUSED', reason: 'TOKEN_INVALID', msgId: null });
      this.enqueue(() => this.lose(LIVE_CALL_CLOSE.TOKEN, 'TOKEN_EXPIRED'));
    });
  }

  // ------------------------------------------------------------------ endings
  private violation(): void {
    if (this.doomed || this.phase === 'CLOSING' || this.phase === 'CLOSED') return;
    this.doomed = true;
    this.deps.signal('connection', 'violation');
    this.send({ type: 'REFUSED', reason: 'PROTOCOL_VIOLATION', msgId: null });
    this.enqueue(() => this.lose(LIVE_CALL_CLOSE.PROTOCOL_VIOLATION, 'PROTOCOL_VIOLATION'));
  }

  private overloaded(): void {
    if (this.doomed || this.phase === 'CLOSING' || this.phase === 'CLOSED') return;
    this.doomed = true;
    this.deps.signal('connection', 'overloaded');
    this.send({ type: 'REFUSED', reason: 'OVERLOADED', msgId: null });
    this.enqueue(() => this.lose(LIVE_CALL_CLOSE.OVERLOADED, 'OVERLOADED'));
  }

  private async writerFailed(): Promise<void> {
    const failure = this.writerFailure();
    // The recording refused this connection's epoch: a newer connection holds the call, which goes on there.
    if (failure === 'FENCED') return this.beFenced();
    return this.failCall(failure === 'CONSENT_REQUIRED' ? 'CONSENT_REQUIRED' : 'UNAVAILABLE');
  }

  /**
   * The call cannot go on (the recording refused the person's audio, or activation was refused): it is ended FAILED by
   * this connection, then the socket closes. A call that is not known to have ended is left to the authority's recovery.
   */
  private async failCall(reason: RefusalReason): Promise<void> {
    this.send({ type: 'REFUSED', reason, msgId: null });
    if (this.epoch !== null && this.callId !== null && !this.ended && !this.fenced) {
      await this.closeTracks(true);
      const ended = await this.deps.store.end({ userId: this.userId, callId: this.callId, epoch: this.epoch, reason: 'FAILED' }).catch(() => null);
      if (ended?.outcome === 'ENDED' || ended?.outcome === 'ALREADY_ENDED') {
        this.ended = true;
        this.send(this.state_('ENDED', (ended.endReason as CallEndReason | null) ?? 'FAILED'));
      }
    }
    this.deps.signal('end', 'refused_expected');
    await this.shut(LIVE_CALL_CLOSE.REFUSED, reason);
  }

  private async refuseAndClose(reason: RefusalReason, operation: string): Promise<void> {
    this.deps.signal(operation, reason === 'UNAVAILABLE' ? 'transport_failure' : 'refused_expected');
    this.send({ type: 'REFUSED', reason, msgId: null });
    await this.shut(LIVE_CALL_CLOSE.REFUSED, reason);
  }

  /** A newer connection holds the call (another epoch): this one changes nothing more and leaves. */
  private async beFenced(): Promise<void> {
    this.fenced = true;
    this.send({ type: 'REFUSED', reason: 'FENCED', msgId: null });
    await this.closeTracks();
    this.deps.signal('connection', 'fenced');
    await this.shut(LIVE_CALL_CLOSE.FENCED, 'FENCED');
  }

  /** The authority ended the call (its maximum, the sweep): what was received is already as written as it can be. */
  private async endedElsewhere(reason: CallEndReason | null): Promise<void> {
    this.ended = true;
    await this.closeTracks(true);
    this.send(this.state_('ENDED', reason));
    await this.shut(LIVE_CALL_CLOSE.NORMAL, 'ENDED');
  }

  /**
   * The connection is lost (the socket went, silence, an expired token, a violation, overload). The call is not ended:
   * what was received is flushed, then the call is suspended (ACTIVE → RECONNECTING for the grace; a CONNECTING call ends
   * FAILED, by the authority). A fenced or ended call is left as it is.
   */
  private async lose(code: number | null, reason: string): Promise<void> {
    if (this.phase === 'CLOSED') return;
    const holding = (this.phase === 'ACTIVE' || this.phase === 'CONNECTING') && !this.fenced && !this.ended && this.epoch !== null;
    this.phase = 'CLOSING';
    if (holding) {
      await this.closeTracks();
      const suspended = await this.deps.store.suspend({ userId: this.userId, callId: this.callId!, epoch: this.epoch! }).catch(() => null);
      this.deps.signal('suspend', suspended ? (suspended.outcome === 'SUSPENDED' ? 'success' : 'refused_expected') : 'transport_failure');
    }
    this.cleanup();
    if (code !== null) this.transport.close(code, reason);
  }

  private async shut(code: number, reason: string): Promise<void> {
    if (this.phase === 'CLOSED') return;
    this.phase = 'CLOSING';
    this.cleanup();
    this.transport.close(code, reason);
  }

  private cleanup(): void {
    for (const handle of this.timers.values()) this.deps.clock.clearTimeout(handle);
    this.timers.clear();
    this.decoder?.close();
    this.decoder = null;
    this.speech?.close();
    this.speech = null;
    if (this.callId) this.deps.registry.release(this.callId, this);
    this.phase = 'CLOSED';
  }

  /** Server shutdown: the socket goes, the call stays recoverable (resumed elsewhere inside the grace). */
  async goingAway(): Promise<void> {
    if (this.phase === 'CLOSED') return;
    this.enqueue(() => this.lose(LIVE_CALL_CLOSE.GOING_AWAY, 'GOING_AWAY'));
    await this.inbox;
  }

  // ------------------------------------------------------------------ outbound
  private send(message: ServerMessage): void {
    if (this.phase === 'CLOSED') return;
    if (this.transport.bufferedBytes > LIVE_CALL_LIMITS.maxOutboundBufferBytes) return;
    this.transport.sendText(encodeServerMessage(message));
  }

  /** One reply packet (REPLY_AUDIO) while the call is ACTIVE; a stalled consumer gets nothing more (it is lost by its own bound). */
  private sendReplyAudio(packet: ReplyAudioPacket): void {
    if (this.phase !== 'ACTIVE' || this.epoch === null) return;
    if (this.transport.bufferedBytes > LIVE_CALL_LIMITS.maxOutboundBufferBytes) return;
    this.transport.sendBinary(encodeReplyAudioFrame({ epoch: this.epoch, ...packet }));
  }

  private sendState(state: CallState): void {
    this.send(this.state_(state, null));
  }

  private state_(state: CallState, endReason: CallEndReason | null): ServerMessage {
    return {
      type: 'STATE', callId: this.callId ?? '', state, epoch: state === 'ENDED' ? null : this.epoch, startedAt: this.startedAt,
      resumeFromCaptureMs: state === 'ACTIVE' && this.writer ? this.writer.expectedCaptureMs : null, lastMsgId: this.lastMsgId,
      endsAt: this.endsAt !== null ? new Date(this.endsAt).toISOString() : null, endReason, heartbeatMs: LIVE_CALL_LIMITS.heartbeatIntervalMs,
    };
  }

  private arm(name: string, ms: number, fn: () => void): void {
    this.disarm(name);
    this.timers.set(name, this.deps.clock.setTimeout(() => {
      this.timers.delete(name);
      fn();
    }, ms));
  }

  private disarm(name: string): void {
    const handle = this.timers.get(name);
    if (handle !== undefined) this.deps.clock.clearTimeout(handle);
    this.timers.delete(name);
  }
}
