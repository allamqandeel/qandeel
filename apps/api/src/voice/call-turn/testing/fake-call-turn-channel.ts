import type { LiveCallTurnChannel, ReplyAudioPacket } from '../../call/live-call-speech.port';
import type { ServerMessage } from '../../call/live-call.protocol';

/**
 * S8B-05 CP2 — the connection's side of a call turn engine, in memory, for tests only: what was sent to the phone, what
 * went to the QANDEEL track (silence gaps and packets at their clock instants, contiguity enforced as the writer does).
 */
export class FakeCallTurnChannel implements LiveCallTurnChannel {
  readonly sent: ServerMessage[] = [];
  readonly replyAudio: ReplyAudioPacket[] = [];
  readonly qandeel: Array<{ kind: 'SILENCE'; endMs: number } | { kind: 'PACKET'; clockMs: number }> = [];
  captureMs = 0;
  userEndMs: number | null = 0;
  token = 'token-a';
  private qandeelEnd = 0;

  constructor(
    readonly userId = '00000000-0000-4000-8000-0000000000a1',
    readonly callId = '00000000-0000-4000-8000-0000000000c1',
    readonly sessionId = '00000000-0000-4000-8000-0000000000b1',
    readonly epoch = 1,
  ) {}

  accessToken(): string {
    return this.token;
  }

  latestCaptureMs(): number {
    return this.captureMs;
  }

  async settleUserTrack(): Promise<number | null> {
    return this.userEndMs;
  }

  qandeelEndMs(): number {
    return this.qandeelEnd;
  }

  qandeelSilence(endMs: number): void {
    if (endMs < this.qandeelEnd) throw new Error('CALL_TRACK_NOT_CONTIGUOUS');
    if (endMs > this.qandeelEnd) this.qandeel.push({ kind: 'SILENCE', endMs });
    this.qandeelEnd = endMs;
  }

  qandeelAppend(_packet: Buffer, clockMs: number): void {
    if (clockMs !== this.qandeelEnd) throw new Error('CALL_TRACK_NOT_CONTIGUOUS');
    this.qandeel.push({ kind: 'PACKET', clockMs });
    this.qandeelEnd = clockMs + 20;
  }

  async settleQandeelTrack(): Promise<number | null> {
    return this.qandeelEnd;
  }

  send(message: ServerMessage): void {
    this.sent.push(message);
  }

  sendReplyAudio(packet: ReplyAudioPacket): void {
    this.replyAudio.push(packet);
  }

  of<T extends ServerMessage['type']>(type: T): Array<Extract<ServerMessage, { type: T }>> {
    return this.sent.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  }
}
