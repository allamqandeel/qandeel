/** S8B-06 CP1 — test doubles for the live-call client: a scripted socket and a manual clock. Test-only. */
import type { LiveCallSocket, LiveCallSocketFactory, LiveCallTimers } from '../live-call-client';
import {
  decodeAudioFrame, encodeReplyAudioFrame, type AudioFrame, type ServerMessage,
} from '../live-call-protocol';

export class FakeSocket implements LiveCallSocket {
  binaryType = 'blob';
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readonly sent: (string | ArrayBuffer)[] = [];
  closedWith: number | null = null;

  constructor(readonly url: string, readonly protocol: string, readonly headers: Readonly<Record<string, string>>) {}

  send(data: string | ArrayBuffer): void {
    this.sent.push(data);
  }

  close(code?: number): void {
    this.closedWith = code ?? 1000;
  }

  open(): void {
    this.onopen?.();
  }

  server(message: ServerMessage): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  serverText(text: string): void {
    this.onmessage?.({ data: text });
  }

  serverBinary(bytes: Uint8Array): void {
    this.onmessage?.({ data: bytes.slice().buffer });
  }

  drop(code: number): void {
    this.onclose?.({ code });
  }

  texts(): Record<string, unknown>[] {
    return this.sent.filter((d): d is string => typeof d === 'string').map((d) => JSON.parse(d) as Record<string, unknown>);
  }

  controls(): Record<string, unknown>[] {
    return this.texts().filter((m) => m.type !== 'HEARTBEAT');
  }

  audio(): AudioFrame[] {
    return this.sent.filter((d): d is ArrayBuffer => d instanceof ArrayBuffer).map((d) => decodeAudioFrame(new Uint8Array(d))!);
  }

  /** Everything sent, in order, as short labels: `HELLO`, `A0@0` (audio seq@captureMs), `PLAYOUT#3`… */
  order(): string[] {
    return this.sent.map((d) => {
      if (typeof d === 'string') {
        const m = JSON.parse(d) as { type: string; msgId?: number };
        return m.msgId === undefined ? m.type : `${m.type}#${m.msgId}`;
      }
      const f = decodeAudioFrame(new Uint8Array(d))!;
      return `A${f.seq}@${f.captureMs}`;
    }).filter((s) => s !== 'HEARTBEAT');
  }
}

export function socketRecorder(): { factory: LiveCallSocketFactory; sockets: FakeSocket[] } {
  const sockets: FakeSocket[] = [];
  return {
    sockets,
    factory: (url, protocol, headers) => {
      const socket = new FakeSocket(url, protocol, headers);
      sockets.push(socket);
      return socket;
    },
  };
}

export class ManualTimers implements LiveCallTimers {
  private t = 0;
  private id = 0;
  private readonly tasks = new Map<number, { at: number; every: number | null; fn: () => void }>();

  now(): number {
    return this.t;
  }

  setTimeout(fn: () => void, ms: number): unknown {
    this.id += 1;
    this.tasks.set(this.id, { at: this.t + ms, every: null, fn });
    return this.id;
  }

  clearTimeout(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  setInterval(fn: () => void, ms: number): unknown {
    this.id += 1;
    this.tasks.set(this.id, { at: this.t + ms, every: ms, fn });
    return this.id;
  }

  clearInterval(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  advance(ms: number): void {
    const end = this.t + ms;
    for (;;) {
      let next: [number, { at: number; every: number | null; fn: () => void }] | null = null;
      for (const entry of this.tasks) if (entry[1].at <= end && (!next || entry[1].at < next[1].at)) next = entry;
      if (!next) break;
      const [id, task] = next;
      this.t = task.at;
      if (task.every === null) this.tasks.delete(id);
      else task.at += task.every;
      task.fn();
    }
    this.t = end;
  }

  /** The clock moves but no timer fires: JS timers paused, as on Android in the background (S8B-06 CP2). */
  skip(ms: number): void {
    this.t += ms;
  }
}

export const CALL_ID = '11111111-1111-4111-8111-111111111111';
export const SESSION_ID = '22222222-2222-4222-8222-222222222222';
export const CLIENT_ID = '33333333-3333-4333-8333-333333333333';

/** A mono 20 ms SILK-WB TOC byte (config 9, code 0) and a payload: the shape the server's TOC check accepts. */
export const packet = (n: number): Uint8Array => new Uint8Array([0x48, n & 0xff, 1, 2, 3]);

export function state(over: Partial<Extract<ServerMessage, { type: 'STATE' }>>): Extract<ServerMessage, { type: 'STATE' }> {
  return {
    type: 'STATE', callId: CALL_ID, state: 'CONNECTING', epoch: 1, startedAt: null, resumeFromCaptureMs: null, lastMsgId: 0,
    endsAt: null, endReason: null, heartbeatMs: 1000, ...over,
  };
}

export const reply = (epoch: number, callTurnIndex: number, chunkSeq: number): Uint8Array =>
  encodeReplyAudioFrame({ epoch, callTurnIndex, chunkSeq, offsetMs: chunkSeq * 20, packet: packet(chunkSeq) });
