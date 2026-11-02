import { LiveCallSession, type LiveCallSessionEvent } from '../live-call-session';
import type { EngineDescription, EngineEvent, EngineStartOptions, ReplyAdmission, VoiceCallEngine } from '../voice-call-engine';
import { CALL_ID, CLIENT_ID, ManualTimers, packet, reply, SESSION_ID, socketRecorder, state } from '../__fixtures__/live-call-test-kit';

class FakeEngine implements VoiceCallEngine {
  listener: ((event: EngineEvent) => void) | null = null;
  started: EngineStartOptions[] = [];
  stops = 0;
  muted: boolean[] = [];
  enqueued: [number, number, number][] = [];
  failStart: { code: string } | null = null;

  async start(options: EngineStartOptions): Promise<EngineDescription> {
    this.started.push(options);
    if (this.failStart) throw this.failStart;
    return {};
  }

  async stop(): Promise<void> {
    this.stops += 1;
  }

  setMuted(muted: boolean): void {
    this.muted.push(muted);
  }

  enqueueReply(callTurnIndex: number, chunkSeq: number, offsetMs: number): ReplyAdmission {
    this.enqueued.push([callTurnIndex, chunkSeq, offsetMs]);
    return 'ACCEPT';
  }

  describe(): EngineDescription | null {
    return null;
  }

  subscribe(listener: (event: EngineEvent) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  emit(event: EngineEvent): void {
    this.listener?.(event);
  }
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup() {
  const engine = new FakeEngine();
  const { factory, sockets } = socketRecorder();
  const events: LiveCallSessionEvent[] = [];
  const session = new LiveCallSession({
    url: 'wss://api.example.test/voice/calls/connect', accessToken: () => 't', callId: CALL_ID, sessionId: SESSION_ID, clientInstanceId: CLIENT_ID,
    socketFactory: factory, timers: new ManualTimers(), engine,
    engineOptions: { route: 'EARPIECE', capture: 'VOICE_COMMUNICATION', aec: true, bargeIn: 'STOP' },
    onEvent: (e) => events.push(e),
  });
  session.start();
  sockets[0]!.open();
  sockets[0]!.server(state({ state: 'CONNECTING', epoch: 1 }));
  return { engine, sockets, events, session, socket: sockets[0]! };
}

const playout = (callTurnIndex: number, chunkSeq: number): EngineEvent => ({
  type: 'playout', callTurnIndex, chunkSeq, playedMs: chunkSeq * 20 + 20, presentedFrame: 0, source: 'TIMESTAMP',
});

describe('S8B-06 CP1 — one live call: engine and client joined', () => {
  it('starts the engine once the server began the call, and sends every uplink packet as produced', async () => {
    const { engine, socket } = setup();
    await flush();
    expect(engine.started).toEqual([{ route: 'EARPIECE', capture: 'VOICE_COMMUNICATION', aec: true, bargeIn: 'STOP' }]);
    engine.emit({ type: 'uplink', captureMs: 0, packet: packet(0) });
    engine.emit({ type: 'uplink', captureMs: 20, packet: packet(1) });
    expect(socket.audio().map((f) => f.captureMs)).toEqual([0, 20]);
  });

  it('hands reply audio of the current epoch to the engine, and sends no PLAYOUT for audio merely enqueued', async () => {
    const { engine, socket } = setup();
    await flush();
    for (let c = 0; c < 50; c += 1) socket.serverBinary(reply(1, 2, c));
    socket.serverBinary(reply(7, 2, 50));
    expect(engine.enqueued).toHaveLength(50);
    expect(engine.enqueued[3]).toEqual([2, 3, 60]);
    expect(socket.controls().filter((m) => m.type === 'PLAYOUT')).toHaveLength(0);
  });

  it('sends PLAYOUT only from heard marks, at most every 200 ms of reply, and the last one when the reply drains', async () => {
    const { engine, socket } = setup();
    await flush();
    for (let c = 0; c < 30; c += 1) engine.emit(playout(4, c));
    engine.emit({ type: 'replyDrained', callTurnIndex: 4, chunkSeq: 29 });
    const marks = socket.controls().filter((m) => m.type === 'PLAYOUT').map((m) => m.playedMs);
    expect(marks).toEqual([20, 220, 420, 600]);
  });

  it('at a local cut sends the final heard mark, then BARGE_IN with the instant the person started, on the same connection', async () => {
    const { engine, socket } = setup();
    await flush();
    socket.server(state({ state: 'ACTIVE', epoch: 1, resumeFromCaptureMs: 0 }));
    engine.emit(playout(3, 0));
    engine.emit(playout(3, 4));
    engine.emit({ type: 'uplink', captureMs: 1200, packet: packet(1) });
    engine.emit({
      type: 'bargeIn', action: 'STOP', callTurnIndex: 3, onsetCaptureMs: 1020, detectCaptureMs: 1200, detectedAtNs: 1, forced: false,
      finalChunkSeq: 6, finalPlayedMs: 140,
    });
    expect(socket.order().slice(1)).toEqual(['PLAYOUT#1', 'A0@1200', 'PLAYOUT#2', 'BARGE_IN#3']);
    expect(socket.controls().slice(-2)).toEqual([
      { type: 'PLAYOUT', msgId: 2, callTurnIndex: 3, chunkSeq: 6, playedMs: 140 },
      { type: 'BARGE_IN', msgId: 3, callTurnIndex: 3, captureMs: 1020 },
    ]);
  });

  it('does not act on a REPORT_ONLY candidate', async () => {
    const { engine, socket } = setup();
    await flush();
    engine.emit({ type: 'bargeIn', action: 'REPORT_ONLY', callTurnIndex: 1, onsetCaptureMs: 0, detectCaptureMs: 180, detectedAtNs: 1, forced: false });
    expect(socket.controls()).toHaveLength(1);
  });

  it('mutes the engine and the client together, at the next capture instant', async () => {
    const { engine, socket, session } = setup();
    await flush();
    socket.server(state({ state: 'ACTIVE', epoch: 1, resumeFromCaptureMs: 0 }));
    engine.emit({ type: 'uplink', captureMs: 0, packet: packet(0) });
    engine.emit({ type: 'uplink', captureMs: 20, packet: packet(1) });
    expect(session.setMuted(true)).toBe(true);
    expect(engine.muted).toEqual([true]);
    expect(socket.controls().at(-1)).toEqual({ type: 'MUTE', msgId: 1, captureMs: 40 });
  });

  it('ends the call when the engine cannot start (no silent call), and stops the engine when the call ends', async () => {
    const { engine, socket } = (() => {
      const kit = { engine: new FakeEngine() };
      kit.engine.failStart = { code: 'PERMISSION_DENIED' };
      const { factory, sockets } = socketRecorder();
      const events: LiveCallSessionEvent[] = [];
      const session = new LiveCallSession({
        url: 'wss://api.example.test/voice/calls/connect', accessToken: () => 't', callId: CALL_ID, sessionId: SESSION_ID, clientInstanceId: CLIENT_ID,
        socketFactory: factory, timers: new ManualTimers(), engine: kit.engine,
        engineOptions: { route: 'SPEAKER', capture: 'VOICE_COMMUNICATION', aec: true, bargeIn: 'STOP' }, onEvent: (e) => events.push(e),
      });
      session.start();
      sockets[0]!.open();
      sockets[0]!.server(state({ state: 'CONNECTING', epoch: 1 }));
      return { engine: kit.engine, socket: sockets[0]! };
    })();
    await flush();
    expect(socket.controls().at(-1)).toEqual({ type: 'END', msgId: 1 });
    socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'USER_ENDED' }));
    await flush();
    expect(engine.stops).toBe(1);
  });
});
