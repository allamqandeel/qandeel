/**
 * S8B-06 CP1 — the phone's Live Call client over the frozen protocol `qandeel.live-call.v1` (one WebSocket).
 *
 * This is the ONE place in the app that opens a live-call socket (never `runtime-entry/`, never `integration/`). It owns
 * the transport rules of the frozen protocol and nothing of the call's meaning (the server's call authority decides
 * begin, activation, epoch, resume and end):
 *
 *   - **Upgrade:** `wss://…/voice/calls/connect`, no query, subprotocol `qandeel.live-call.v1`, `Authorization: Bearer`.
 *     A plain `ws://` URL is refused unless the caller passes `insecureLoopbackForProof` AND the host is the loopback —
 *     the device proof's local fake gateway only; there is no production fallback to cleartext.
 *   - **HELLO** first and once per connection: `resume: false` the first time, `true` on every reconnection, with the same
 *     `callId` and `clientInstanceId`. HEARTBEAT every `heartbeatIntervalMs` while the socket is open.
 *   - **AUDIO:** each packet the engine produces gets the next `seq` (per call, +1 per packet produced) and keeps its
 *     capture-clock instant; muted audio is not produced at all (no seq). Packets are sent with the connection epoch the
 *     latest STATE named.
 *   - **Replay log (P5):** the last `resendBufferMs` of produced audio and every unacknowledged state-changing control
 *     message, in the order they were produced. After a resume the STATE's `lastMsgId` settles what the server applied and
 *     `resumeFromCaptureMs` says where its USER track ends; the client then resends, in the original order, the controls
 *     not yet applied and the audio from that instant — with their ORIGINAL `seq` and `captureMs`, so nothing is invented
 *     and a hole older than the log becomes the server's honest RECONNECTION gap.
 *   - **REPLY_AUDIO:** accepted only with the current connection epoch; anything else is dropped and counted.
 *   - **Reconnect:** a lost socket is not an end. The client reconnects with backoff inside the server's 30 s grace; it
 *     stops on STATE ENDED, FENCED (4003), a refusal (4004), or when the grace has passed.
 *
 * Nothing here logs, stores or inspects audio.
 */
import {
  AUDIO_PACKET_MS, type CallEndReason, type ClientMessage, decodeReplyAudioFrame, encodeAudioFrame, encodeClientMessage, isValidClientMessage,
  LIVE_CALL_CLOSE, LIVE_CALL_LIMITS, LIVE_CALL_PATH, LIVE_CALL_PROTOCOL, parseServerMessage, type RefusalReason, type ReplyAudioFrame,
  type ServerMessage,
} from './live-call-protocol';

/** The subset of the React Native / WHATWG WebSocket the client uses (a fake implements it in tests). */
export interface LiveCallSocket {
  binaryType: string;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
}

export type LiveCallSocketFactory = (url: string, protocol: string, headers: Readonly<Record<string, string>>) => LiveCallSocket;

export interface LiveCallTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  now(): number;
}

export type LiveCallEnd = CallEndReason | RefusalReason | 'LOST' | 'FENCED' | 'REFUSED';

export type LiveCallClientEvent =
  | { readonly type: 'connection'; readonly phase: 'CONNECTING' | 'OPEN' | 'LOST'; readonly closeCode?: number; readonly attempt: number }
  | { readonly type: 'state'; readonly message: Extract<ServerMessage, { type: 'STATE' }>; readonly resumed: boolean }
  | { readonly type: 'ack'; readonly msgId: number }
  | { readonly type: 'refused'; readonly reason: RefusalReason; readonly msgId: number | null }
  | { readonly type: 'callEnding'; readonly endsInMs: number }
  | { readonly type: 'turnCommitted'; readonly message: Extract<ServerMessage, { type: 'TURN_COMMITTED' }> }
  | { readonly type: 'replyEnd'; readonly message: Extract<ServerMessage, { type: 'REPLY_END' }> }
  | { readonly type: 'replyAudio'; readonly frame: ReplyAudioFrame }
  | { readonly type: 'replyFrameDropped'; readonly reason: 'WRONG_EPOCH' | 'MALFORMED' }
  | { readonly type: 'resent'; readonly controls: number; readonly audio: number; readonly fromCaptureMs: number | null }
  | { readonly type: 'serverFault' }
  | { readonly type: 'ended'; readonly reason: LiveCallEnd };

export interface LiveCallClientOptions {
  readonly url: string;
  readonly accessToken: () => string;
  readonly callId: string;
  readonly sessionId: string;
  readonly clientInstanceId: string;
  readonly onEvent: (event: LiveCallClientEvent) => void;
  readonly socketFactory?: LiveCallSocketFactory;
  readonly timers?: LiveCallTimers;
  /** The device proof's local fake gateway only: allows `ws://127.0.0.1` / `ws://localhost`. */
  readonly insecureLoopbackForProof?: boolean;
  /** How long after a loss the client keeps trying (the server's reconnect grace). */
  readonly reconnectGraceMs?: number;
}

type LogItem =
  | { readonly kind: 'audio'; readonly seq: number; readonly captureMs: number; readonly packet: Uint8Array }
  | { readonly kind: 'control'; readonly msgId: number; readonly message: ClientMessage };

const BACKOFF_MS = [250, 500, 1000, 2000];
const DEFAULT_GRACE_MS = 30_000;

export function isAllowedLiveCallUrl(url: string, insecureLoopbackForProof: boolean): boolean {
  const match = /^(wss|ws):\/\/([^/?#]+)(\/[^?#]*)$/u.exec(url);
  if (!match) return false;
  const [, scheme, authority, path] = match;
  if (!path!.endsWith(LIVE_CALL_PATH)) return false;
  if (scheme === 'wss') return true;
  return insecureLoopbackForProof && /^(127\.0\.0\.1|localhost)(:\d+)?$/u.test(authority!);
}

const defaultSocketFactory: LiveCallSocketFactory = (url, protocol, headers) => {
  const Socket = WebSocket as unknown as new (url: string, protocols: string, options: { headers: Record<string, string> }) => LiveCallSocket;
  const socket = new Socket(url, protocol, { headers: { ...headers } });
  socket.binaryType = 'arraybuffer';
  return socket;
};

const defaultTimers: LiveCallTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  now: () => Date.now(),
};

export class LiveCallClient {
  private readonly factory: LiveCallSocketFactory;
  private readonly timers: LiveCallTimers;
  private readonly graceMs: number;
  private socket: LiveCallSocket | null = null;
  private heartbeat: unknown = null;
  private retry: unknown = null;
  private attempt = 0;
  private everConnected = false;
  private lostAt: number | null = null;
  private epoch: number | null = null;
  private awaitingState = false;
  private resuming = false;
  private ended = false;
  private nextSeq = 0;
  private nextMsgId = 1;
  private heartbeatN = 0;
  private muted = false;
  private lastRefusal: RefusalReason | null = null;
  private readonly log: LogItem[] = [];
  private newestCaptureMs = -AUDIO_PACKET_MS;
  /** The call's state as the server last stated it. */
  callState: 'NONE' | 'CONNECTING' | 'ACTIVE' | 'ENDED' = 'NONE';
  readonly counters = { audioSent: 0, audioBuffered: 0, audioResent: 0, controlsResent: 0, replyFrames: 0, replyWrongEpoch: 0, replyMalformed: 0, reconnects: 0 };

  constructor(private readonly options: LiveCallClientOptions) {
    if (!isAllowedLiveCallUrl(options.url, options.insecureLoopbackForProof === true)) throw new Error('LIVE_CALL_URL_REFUSED');
    this.factory = options.socketFactory ?? defaultSocketFactory;
    this.timers = options.timers ?? defaultTimers;
    this.graceMs = options.reconnectGraceMs ?? DEFAULT_GRACE_MS;
  }

  connect(): void {
    if (this.socket || this.ended) return;
    this.open();
  }

  /** One packet the engine produced at `captureMs`. Dropped (never produced) while muted. */
  sendAudio(captureMs: number, packet: Uint8Array): void {
    if (this.ended || this.muted) return;
    if (captureMs % AUDIO_PACKET_MS !== 0) return;
    const item: LogItem = { kind: 'audio', seq: this.nextSeq, captureMs, packet };
    this.nextSeq = (this.nextSeq + 1) >>> 0;
    this.newestCaptureMs = captureMs;
    this.log.push(item);
    this.trim();
    if (this.canSendLive()) this.sendItem(item);
    else this.counters.audioBuffered += 1;
  }

  /** MUTE / UNMUTE at the capture instant where the change takes effect. Only an ACTIVE call can be muted. */
  setMuted(muted: boolean, captureMs: number): boolean {
    if (this.ended || this.callState !== 'ACTIVE' || muted === this.muted) return false;
    this.muted = muted;
    this.control({ type: muted ? 'MUTE' : 'UNMUTE', msgId: this.takeMsgId(), captureMs });
    return true;
  }

  /** The heard position of reply `callTurnIndex` (from the engine's presented frames only). */
  sendPlayout(callTurnIndex: number, chunkSeq: number, playedMs: number): void {
    if (this.ended) return;
    // S8B-06 CP3 (QAN-BL-VOICE-06): only a higher mark advances a reply (P1 – P3), so this PLAYOUT supersedes every older
    // one of the same reply still in the log. Without this, a reply that kept playing through an outage left one PLAYOUT
    // per confirmation in the log (about ten a second), the resume resent them all at once, the server's control budget
    // refused the connection (OVERLOADED) before applying any, and every later resume was refused the same way.
    for (let i = this.log.length - 1; i >= 0; i -= 1) {
      const item = this.log[i]!;
      if (item.kind === 'control' && item.message.type === 'PLAYOUT' && item.message.callTurnIndex === callTurnIndex) this.log.splice(i, 1);
    }
    this.control({ type: 'PLAYOUT', msgId: this.takeMsgId(), callTurnIndex, chunkSeq, playedMs });
  }

  /** The local barge-in: the person started speaking at `captureMs` over reply `callTurnIndex`. */
  sendBargeIn(callTurnIndex: number, captureMs: number): void {
    if (this.ended) return;
    this.control({ type: 'BARGE_IN', msgId: this.takeMsgId(), callTurnIndex, captureMs });
  }

  refreshToken(accessToken: string): void {
    if (this.ended) return;
    this.control({ type: 'TOKEN_REFRESH', msgId: this.takeMsgId(), accessToken });
  }

  /**
   * S8B-06 CP3 (D-05-07 T1, contract A3.2 P4 / P5) — a message the person typed during the call, on this ordered channel.
   * It is logged like every control and sent at once when the link is up; while the link is down it waits in the log and
   * goes out after the resume's STATE. The server applies it once per `clientTurnId`, so a resend can never commit it twice.
   * Returns its `msgId` (its ACK or REFUSED carries it), or null when the call has ended (the caller writes it normally).
   */
  sendText(clientTurnId: string, text: string): number | null {
    if (this.ended) return null;
    const msgId = this.takeMsgId();
    this.control({ type: 'TEXT_TURN', msgId, clientTurnId, text });
    return msgId;
  }

  end(): void {
    if (this.ended) return;
    this.control({ type: 'END', msgId: this.takeMsgId() });
  }

  /** Drops the connection locally without ending the call (the server suspends it; a resume may follow). */
  dropConnectionForProof(): void {
    this.socket?.close(LIVE_CALL_CLOSE.GOING_AWAY, 'proof');
  }

  /** Stops everything locally (the call ended or the owner went away). */
  dispose(): void {
    this.finish(null);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get currentEpoch(): number | null {
    return this.epoch;
  }

  // ------------------------------------------------------------------ transport

  private open(): void {
    this.attempt += 1;
    this.awaitingState = true;
    this.options.onEvent({ type: 'connection', phase: 'CONNECTING', attempt: this.attempt });
    let socket: LiveCallSocket;
    try {
      socket = this.factory(this.options.url, LIVE_CALL_PROTOCOL, { Authorization: `Bearer ${this.options.accessToken()}` });
    } catch {
      this.lost(0);
      return;
    }
    this.socket = socket;
    const resume = this.everConnected;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.everConnected = true;
      this.resuming = resume;
      this.options.onEvent({ type: 'connection', phase: 'OPEN', attempt: this.attempt });
      this.write({ type: 'HELLO', v: 1, callId: this.options.callId, sessionId: this.options.sessionId, clientInstanceId: this.options.clientInstanceId, resume });
      this.heartbeat = this.timers.setInterval(() => {
        this.write({ type: 'HEARTBEAT', n: this.heartbeatN });
        this.heartbeatN = (this.heartbeatN + 1) >>> 0;
      }, LIVE_CALL_LIMITS.heartbeatIntervalMs);
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      if (typeof event.data === 'string') this.onText(event.data);
      else if (event.data instanceof ArrayBuffer) this.onBinary(new Uint8Array(event.data));
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.lost(event.code);
    };
    socket.onerror = () => {};
  }

  private onText(text: string): void {
    const message = parseServerMessage(text);
    if (!message) {
      this.options.onEvent({ type: 'serverFault' });
      this.socket?.close(LIVE_CALL_CLOSE.PROTOCOL_ERROR, 'fault');
      return;
    }
    switch (message.type) {
      case 'STATE':
        return this.onState(message);
      case 'ACK':
        this.settle(message.msgId);
        this.options.onEvent({ type: 'ack', msgId: message.msgId });
        return;
      case 'REFUSED':
        if (message.msgId !== null) this.settle(message.msgId);
        else this.lastRefusal = message.reason;
        this.options.onEvent({ type: 'refused', reason: message.reason, msgId: message.msgId });
        return;
      case 'CALL_ENDING':
        this.options.onEvent({ type: 'callEnding', endsInMs: message.endsInMs });
        return;
      case 'TURN_COMMITTED':
        this.options.onEvent({ type: 'turnCommitted', message });
        return;
      case 'REPLY_END':
        this.options.onEvent({ type: 'replyEnd', message });
        return;
    }
  }

  private onState(message: Extract<ServerMessage, { type: 'STATE' }>): void {
    if (message.state === 'ENDED') {
      this.callState = 'ENDED';
      this.options.onEvent({ type: 'state', message, resumed: this.resuming });
      this.finish(message.endReason ?? 'SERVER_ENDED');
      return;
    }
    this.epoch = message.epoch;
    const wasAwaiting = this.awaitingState;
    this.awaitingState = false;
    this.lostAt = null;
    if (message.state === 'CONNECTING' || message.state === 'ACTIVE') this.callState = message.state;
    this.options.onEvent({ type: 'state', message, resumed: this.resuming });
    if (wasAwaiting) this.replay(message.lastMsgId, message.state === 'ACTIVE' ? message.resumeFromCaptureMs : 0);
  }

  /**
   * After a STATE on a fresh connection: settle what the server applied, then resend in the original order the controls it
   * did not apply and the audio from `fromCaptureMs` (null: none is owed).
   */
  private replay(lastMsgId: number, fromCaptureMs: number | null): void {
    let controls = 0;
    let audio = 0;
    for (let i = 0; i < this.log.length; i += 1) {
      const item = this.log[i]!;
      // A TEXT_TURN's ACK does not move `lastMsgId` and its msgId is never compared with it (protocol §0 CP4): it stays in
      // the log until its own ACK or REFUSED, so a message typed before a later applied control is still resent.
      if (item.kind === 'control' && item.message.type !== 'TEXT_TURN' && item.msgId <= lastMsgId && this.resuming) {
        this.log.splice(i, 1);
        i -= 1;
      }
    }
    for (const item of this.log) {
      if (item.kind === 'control') {
        this.write(item.message);
        if (this.resuming) controls += 1;
      } else if (fromCaptureMs !== null && item.captureMs >= fromCaptureMs) {
        this.sendItem(item);
        if (this.resuming) audio += 1;
      }
    }
    this.counters.controlsResent += controls;
    this.counters.audioResent += audio;
    if (this.resuming) this.options.onEvent({ type: 'resent', controls, audio, fromCaptureMs });
  }

  private onBinary(bytes: Uint8Array): void {
    const frame = decodeReplyAudioFrame(bytes);
    if (!frame) {
      this.counters.replyMalformed += 1;
      this.options.onEvent({ type: 'replyFrameDropped', reason: 'MALFORMED' });
      return;
    }
    if (this.epoch === null || frame.epoch !== this.epoch) {
      this.counters.replyWrongEpoch += 1;
      this.options.onEvent({ type: 'replyFrameDropped', reason: 'WRONG_EPOCH' });
      return;
    }
    this.counters.replyFrames += 1;
    this.options.onEvent({ type: 'replyAudio', frame });
  }

  private lost(code: number): void {
    this.stopHeartbeat();
    this.socket = null;
    this.epoch = null;
    if (this.ended) return;
    this.options.onEvent({ type: 'connection', phase: 'LOST', closeCode: code, attempt: this.attempt });
    if (code === LIVE_CALL_CLOSE.FENCED) return this.finish('FENCED');
    if (code === LIVE_CALL_CLOSE.REFUSED) return this.finish(this.lastRefusal ?? 'REFUSED');
    const now = this.timers.now();
    this.lostAt ??= now;
    if (now - this.lostAt > this.graceMs) return this.finish('LOST');
    const delay = BACKOFF_MS[Math.min(this.counters.reconnects, BACKOFF_MS.length - 1)]!;
    this.counters.reconnects += 1;
    this.retry = this.timers.setTimeout(() => {
      this.retry = null;
      if (!this.ended) this.open();
    }, delay);
  }

  private finish(reason: LiveCallEnd | null): void {
    if (this.ended) return;
    this.ended = true;
    this.stopHeartbeat();
    if (this.retry !== null) this.timers.clearTimeout(this.retry);
    this.retry = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.onmessage = null;
      try {
        socket.close(LIVE_CALL_CLOSE.NORMAL, 'done');
      } catch {
        // already closed
      }
    }
    this.log.length = 0;
    if (reason !== null) this.options.onEvent({ type: 'ended', reason });
  }

  private stopHeartbeat(): void {
    if (this.heartbeat !== null) this.timers.clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  // ------------------------------------------------------------------ sending

  private canSendLive(): boolean {
    return this.socket !== null && !this.awaitingState && this.epoch !== null;
  }

  private takeMsgId(): number {
    const id = this.nextMsgId;
    this.nextMsgId += 1;
    return id;
  }

  private control(message: ClientMessage): void {
    if (!isValidClientMessage(message)) throw new RangeError('LIVE_CALL_MESSAGE_INVALID');
    this.log.push({ kind: 'control', msgId: (message as { msgId: number }).msgId, message });
    if (this.canSendLive()) this.write(message);
  }

  private settle(msgId: number): void {
    const index = this.log.findIndex((item) => item.kind === 'control' && item.msgId === msgId);
    if (index >= 0) this.log.splice(index, 1);
  }

  private sendItem(item: Extract<LogItem, { kind: 'audio' }>): void {
    const frame = encodeAudioFrame({ epoch: this.epoch!, seq: item.seq, captureMs: item.captureMs, packet: item.packet });
    this.socket!.send(frame.buffer as ArrayBuffer);
    this.counters.audioSent += 1;
  }

  private write(message: ClientMessage): void {
    try {
      this.socket?.send(encodeClientMessage(message));
    } catch {
      // the close event follows
    }
  }

  /** Keeps the last `resendBufferMs` of audio; controls stay until the server settles them. */
  private trim(): void {
    const oldest = this.newestCaptureMs - LIVE_CALL_LIMITS.resendBufferMs + AUDIO_PACKET_MS;
    let i = 0;
    while (i < this.log.length) {
      const item = this.log[i]!;
      if (item.kind === 'audio' && item.captureMs < oldest) this.log.splice(i, 1);
      else i += 1;
    }
  }
}
