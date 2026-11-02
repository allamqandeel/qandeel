/**
 * S8B-06 CP1 — one live call's audio: the native engine joined to the protocol client. In memory only; nothing persists.
 *
 *   - The engine starts once the server has begun the call (the first STATE), so its capture clock's 0 is the call's first
 *     packet; it stops when the call ends or the session is disposed.
 *   - Every uplink packet goes to the client as produced (the engine never waits on the network).
 *   - REPLY_AUDIO the client accepted (current connection epoch) goes to the engine, whose gate refuses a cut, stale,
 *     repeated or reordered-late packet.
 *   - PLAYOUT is sent ONLY from the engine's heard marks (frames the platform PRESENTED), at most every
 *     `playoutIntervalMs` while a reply plays, and at once when a reply drains or is cut. Never from what was enqueued.
 *   - At a local barge-in the final heard mark goes first (PLAYOUT), then BARGE_IN with the instant the person started
 *     speaking, on the same ordered connection — the order the frozen protocol allows (contract A3.2 P4).
 *
 * The server decides what the cut means (S8B-05 CP2–CP4); the phone never claims a barge-in succeeded on the server.
 */
import type { LiveCallClientEvent, LiveCallClientOptions, LiveCallEnd } from './live-call-client';
import { LiveCallClient } from './live-call-client';
import type { EngineBargeIn, EngineEvent, EngineStartOptions, ReplyAdmission, VoiceCallEngine } from './voice-call-engine';

export type LiveCallSessionEvent =
  | { readonly source: 'client'; readonly event: LiveCallClientEvent }
  | { readonly source: 'engine'; readonly event: EngineEvent }
  | { readonly source: 'session'; readonly event: { readonly type: 'engineStartFailed'; readonly code: string } }
  | { readonly source: 'session'; readonly event: { readonly type: 'replyAdmission'; readonly callTurnIndex: number; readonly chunkSeq: number; readonly admission: ReplyAdmission } }
  | { readonly source: 'session'; readonly event: { readonly type: 'playoutSent'; readonly callTurnIndex: number; readonly chunkSeq: number; readonly playedMs: number; readonly cause: 'PERIODIC' | 'DRAINED' | 'CUT' } }
  | { readonly source: 'session'; readonly event: { readonly type: 'bargeInSent'; readonly callTurnIndex: number; readonly captureMs: number } };

export interface LiveCallSessionOptions extends Omit<LiveCallClientOptions, 'onEvent'> {
  readonly engine: VoiceCallEngine;
  readonly engineOptions: EngineStartOptions;
  readonly onEvent?: (event: LiveCallSessionEvent) => void;
  readonly playoutIntervalMs?: number;
}

interface Mark {
  readonly callTurnIndex: number;
  readonly chunkSeq: number;
  readonly playedMs: number;
}

export class LiveCallSession {
  readonly client: LiveCallClient;
  private readonly engine: VoiceCallEngine;
  private readonly playoutIntervalMs: number;
  private unsubscribe: (() => void) | null = null;
  private engineStarting = false;
  private engineRunning = false;
  private disposed = false;
  private latest: Mark | null = null;
  private sent: Mark | null = null;
  private lastCaptureMs = -20;
  ended: LiveCallEnd | null = null;

  constructor(private readonly options: LiveCallSessionOptions) {
    this.engine = options.engine;
    this.playoutIntervalMs = options.playoutIntervalMs ?? 200;
    this.client = new LiveCallClient({ ...options, onEvent: (event) => this.onClient(event) });
  }

  start(): void {
    if (this.unsubscribe || this.disposed) return;
    this.unsubscribe = this.engine.subscribe((event) => this.onEngine(event));
    this.client.connect();
  }

  setMuted(muted: boolean): boolean {
    const at = this.lastCaptureMs + 20;
    if (!this.client.setMuted(muted, at)) return false;
    this.engine.setMuted(muted);
    return true;
  }

  end(): void {
    this.client.end();
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.client.dispose();
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.engineRunning || this.engineStarting) await this.engine.stop().catch(() => undefined);
    this.engineRunning = false;
  }

  private emit(event: LiveCallSessionEvent): void {
    this.options.onEvent?.(event);
  }

  private onClient(event: LiveCallClientEvent): void {
    this.emit({ source: 'client', event });
    switch (event.type) {
      case 'state':
        if (!this.engineStarting && !this.engineRunning && (event.message.state === 'CONNECTING' || event.message.state === 'ACTIVE')) this.startEngine();
        return;
      case 'replyAudio': {
        const { callTurnIndex, chunkSeq, offsetMs, packet } = event.frame;
        const admission = this.engine.enqueueReply(callTurnIndex, chunkSeq, offsetMs, packet);
        this.emit({ source: 'session', event: { type: 'replyAdmission', callTurnIndex, chunkSeq, admission } });
        return;
      }
      case 'ended':
        this.ended = event.reason;
        void this.engine.stop().catch(() => undefined).then(() => {
          this.engineRunning = false;
        });
        return;
      default:
    }
  }

  private startEngine(): void {
    this.engineStarting = true;
    this.engine.start(this.options.engineOptions).then(
      () => {
        this.engineStarting = false;
        this.engineRunning = true;
        if (this.disposed || this.ended) void this.engine.stop().catch(() => undefined);
      },
      (error: unknown) => {
        this.engineStarting = false;
        const code = (error as { code?: string })?.code ?? 'ENGINE_START_FAILED';
        this.emit({ source: 'session', event: { type: 'engineStartFailed', code } });
        // Without audio there is no call: end it honestly rather than leave a silent one open.
        this.client.end();
      },
    );
  }

  private onEngine(event: EngineEvent): void {
    this.emit({ source: 'engine', event });
    switch (event.type) {
      case 'uplink':
        this.lastCaptureMs = event.captureMs;
        this.client.sendAudio(event.captureMs, event.packet);
        return;
      case 'playout':
        this.latest = { callTurnIndex: event.callTurnIndex, chunkSeq: event.chunkSeq, playedMs: event.playedMs };
        if (!this.sent || this.sent.callTurnIndex !== event.callTurnIndex || event.playedMs - this.sent.playedMs >= this.playoutIntervalMs) {
          this.flushPlayout('PERIODIC');
        }
        return;
      case 'replyDrained':
        this.flushPlayout('DRAINED');
        return;
      case 'bargeIn':
        if (event.action === 'STOP') this.onCut(event);
        return;
      default:
    }
  }

  private onCut(event: EngineBargeIn): void {
    if (event.finalChunkSeq !== null && event.finalChunkSeq !== undefined && event.finalPlayedMs !== null && event.finalPlayedMs !== undefined) {
      const final = { callTurnIndex: event.callTurnIndex, chunkSeq: event.finalChunkSeq, playedMs: event.finalPlayedMs };
      if (!this.latest || this.latest.callTurnIndex < final.callTurnIndex || (this.latest.callTurnIndex === final.callTurnIndex && this.latest.playedMs < final.playedMs)) {
        this.latest = final;
      }
    }
    this.flushPlayout('CUT');
    this.client.sendBargeIn(event.callTurnIndex, event.onsetCaptureMs);
    this.emit({ source: 'session', event: { type: 'bargeInSent', callTurnIndex: event.callTurnIndex, captureMs: event.onsetCaptureMs } });
  }

  /** Sends the latest heard mark if it moves the last one sent forward (the server keeps the highest only, P1). */
  private flushPlayout(cause: 'PERIODIC' | 'DRAINED' | 'CUT'): void {
    const mark = this.latest;
    if (!mark) return;
    const sent = this.sent;
    if (sent && sent.callTurnIndex === mark.callTurnIndex && sent.playedMs >= mark.playedMs) return;
    if (sent && sent.callTurnIndex > mark.callTurnIndex) return;
    this.sent = mark;
    this.client.sendPlayout(mark.callTurnIndex, mark.chunkSeq, mark.playedMs);
    this.emit({ source: 'session', event: { type: 'playoutSent', ...mark, cause } });
  }
}
