import { LIVE_CALL_PROTOCOL } from '../live-call-protocol';
import { encodeMarkEcho, LIVE_CALL_PROTOCOL_V2, parseServerMessageV2 } from '../live-call-protocol-v2';
import { LiveCallSession } from '../live-call-session';
import type { EngineDescription, EngineEvent, ReplyAdmission, VoiceCallEngine } from '../voice-call-engine';
import { CALL_ID, CLIENT_ID, ManualTimers, SESSION_ID, socketRecorder, state } from '../__fixtures__/live-call-test-kit';

// S8B-07 RB-2 / M-2 (CP3) — the phone's side of protocol v2: offered only by an engine that resolves a certified capture
// position (Android); CLOCK_MARK goes to the engine, its markEcho goes out as MARK_ECHO; a v1 server gets exactly v1.

class Engine implements VoiceCallEngine {
  listener: ((event: EngineEvent) => void) | null = null;
  marks: number[] = [];
  answers = true;
  async start(): Promise<EngineDescription> { return {}; }
  async stop(): Promise<void> {}
  setMuted(): void {}
  enqueueReply(): ReplyAdmission { return 'ACCEPT'; }
  describe(): EngineDescription | null { return null; }
  subscribe(listener: (event: EngineEvent) => void): () => void { this.listener = listener; return () => { this.listener = null; }; }
  emit(event: EngineEvent): void { this.listener?.(event); }
}
class ClockEngine extends Engine {
  clockMark(token: number): boolean { this.marks.push(token); return this.answers; }
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup(engine: Engine, select: string | null, timers = new ManualTimers()) {
  const { factory, sockets } = socketRecorder();
  const session = new LiveCallSession({
    url: 'wss://api.example.test/voice/calls/connect', accessToken: () => 't', callId: CALL_ID, sessionId: SESSION_ID, clientInstanceId: CLIENT_ID,
    socketFactory: factory, timers, engine,
    engineOptions: { route: 'EARPIECE', capture: 'VOICE_COMMUNICATION', aec: true, bargeIn: 'STOP' },
  });
  session.start();
  const socket = sockets[0]!;
  if (select) socket.protocol = select;
  socket.open();
  socket.server(state({ state: 'ACTIVE', epoch: 1, resumeFromCaptureMs: 0 }));
  return { socket, session, sockets, timers };
}
const texts = (socket: { sent: (string | ArrayBuffer)[] }) =>
  socket.sent.filter((d): d is string => typeof d === 'string').map((d) => JSON.parse(d) as Record<string, unknown>).filter((m) => m.type !== 'HEARTBEAT');

describe('RB-2 / M-2 protocol v2 on the phone', () => {
  it('parses CLOCK_MARK exactly and encodes MARK_ECHO; v1 server messages are unchanged', () => {
    expect(parseServerMessageV2(JSON.stringify({ type: 'CLOCK_MARK', seq: 7 }))).toEqual({ type: 'CLOCK_MARK', seq: 7 });
    expect(parseServerMessageV2(JSON.stringify({ type: 'CLOCK_MARK', seq: 0 }))).toBeNull();
    expect(parseServerMessageV2(JSON.stringify({ type: 'CLOCK_MARK', seq: 1, at: 2 }))).toBeNull();
    expect(parseServerMessageV2(JSON.stringify({ type: 'ACK', msgId: 3 }))).toEqual({ type: 'ACK', msgId: 3 });
    expect(encodeMarkEcho(7, 1240)).toBe('{"type":"MARK_ECHO","seq":7,"captureMs":1240}');
    expect(encodeMarkEcho(7, null)).toBe('{"type":"MARK_ECHO","seq":7,"captureMs":null}');
    expect(() => encodeMarkEcho(7, 1250)).toThrow(RangeError);
  });

  it('an engine with clockMark offers v2 then v1; under v2 HELLO says v: 2, the mark reaches the engine and its echo goes out', async () => {
    const engine = new ClockEngine();
    const { socket } = setup(engine, LIVE_CALL_PROTOCOL_V2);
    expect(socket.offered).toEqual([LIVE_CALL_PROTOCOL_V2, LIVE_CALL_PROTOCOL]);
    expect(texts(socket)[0]).toMatchObject({ type: 'HELLO', v: 2 });
    await flush();                                       // the engine is running
    socket.serverText(JSON.stringify({ type: 'CLOCK_MARK', seq: 1 }));
    expect(engine.marks).toEqual([1]);
    socket.serverText(JSON.stringify({ type: 'CLOCK_MARK', seq: 2 }));
    expect(engine.marks).toEqual([1, 2]);                // tokens, never reused
    engine.emit({ type: 'markEcho', token: 1, captureMs: 1240 });
    engine.emit({ type: 'markEcho', token: 2, captureMs: null });
    engine.emit({ type: 'markEcho', token: 2, captureMs: 1300 }); // a second answer for a token: dropped
    engine.emit({ type: 'markEcho', token: 9, captureMs: 1400 }); // a token never asked: dropped
    expect(texts(socket).filter((m) => m.type === 'MARK_ECHO')).toEqual([
      { type: 'MARK_ECHO', seq: 1, captureMs: 1240 }, { type: 'MARK_ECHO', seq: 2, captureMs: null }]);
  });

  it('a mark the engine cannot take is answered NOCLOCK at once', async () => {
    const engine = new ClockEngine();
    engine.answers = false;
    const { socket } = setup(engine, LIVE_CALL_PROTOCOL_V2);
    await flush();
    socket.serverText(JSON.stringify({ type: 'CLOCK_MARK', seq: 3 }));
    expect(texts(socket).filter((m) => m.type === 'MARK_ECHO')).toEqual([{ type: 'MARK_ECHO', seq: 3, captureMs: null }]);
  });

  it('a v1 server: HELLO v: 1, a CLOCK_MARK is a fault, and no MARK_ECHO is ever sent', async () => {
    const engine = new ClockEngine();
    const { socket } = setup(engine, LIVE_CALL_PROTOCOL);
    expect(texts(socket)[0]).toMatchObject({ type: 'HELLO', v: 1 });
    await flush();
    engine.emit({ type: 'markEcho', token: 1, captureMs: 1240 });
    socket.serverText(JSON.stringify({ type: 'CLOCK_MARK', seq: 1 }));
    expect(socket.closedWith).toBe(1002);
    expect(engine.marks).toEqual([]);
    expect(texts(socket).some((m) => m.type === 'MARK_ECHO')).toBe(false);
  });

  it('reconnect: an answer for the previous connection never answers the new one, whose seq restarts at 1', async () => {
    const engine = new ClockEngine();
    const { socket, sockets, timers } = setup(engine, LIVE_CALL_PROTOCOL_V2);
    await flush();
    socket.serverText(JSON.stringify({ type: 'CLOCK_MARK', seq: 1 }));
    socket.drop(1006);
    timers.advance(250);
    const second = sockets[1]!;
    second.protocol = LIVE_CALL_PROTOCOL_V2;
    second.open();
    second.server(state({ state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 0, lastMsgId: 0 }));
    second.serverText(JSON.stringify({ type: 'CLOCK_MARK', seq: 1 }));
    expect(engine.marks).toEqual([1, 2]);
    engine.emit({ type: 'markEcho', token: 1, captureMs: 5000 }); // resolved late, for the lost connection
    engine.emit({ type: 'markEcho', token: 2, captureMs: 6000 });
    expect(texts(second).filter((m) => m.type === 'MARK_ECHO')).toEqual([{ type: 'MARK_ECHO', seq: 1, captureMs: 6000 }]);
    expect(texts(socket).some((m) => m.type === 'MARK_ECHO')).toBe(false);
  });

  it('an engine without clockMark (iOS) offers v1 only: fail-closed', () => {
    const { socket } = setup(new Engine(), null);
    expect(socket.offered).toEqual([LIVE_CALL_PROTOCOL]);
    expect(texts(socket)[0]).toMatchObject({ type: 'HELLO', v: 1 });
  });
});
