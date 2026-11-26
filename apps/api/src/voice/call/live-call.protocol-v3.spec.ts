import { LiveCallClockMarks, type ClockSlotStore, type ClockTimer } from './live-call.clock-marks';
import { LiveCallConnection, LiveCallRegistry, type CallTransport } from './live-call.connection';
import type { LiveCallSpeechSink, LiveCallTurnChannel } from './live-call-speech.port';
import { NULL_LIVE_CALL_SPEECH_SINK } from './live-call-speech.port';
import { encodeAudioFrame, MAX_TEXT_FRAME_BYTES, parseClientMessage, SERVER_MESSAGES } from './live-call.protocol';
import { LIVE_CALL_PROTOCOL_V2, parseClientMessageV2, SERVER_MESSAGES_V2 } from './live-call.protocol-v2';
import {
  ATTENTION_OUTBOUND_LIMIT_BYTES, ATTENTION_STATE_ENTRIES_PER_PART, attentionStateFrames, CLIENT_MESSAGES_V3, encodeServerMessageV3,
  LIVE_CALL_PROTOCOL_V3, parseClientMessageV3, SERVER_MESSAGES_V3, type AttentionStateEntry,
} from './live-call.protocol-v3';
import { InMemoryCallAuthority, ManualClock } from './testing/in-memory-call-authority';
import { syntheticUplinkPackets } from './testing/synthetic-voice';

// INTEL-LIVE-01 CP2 (D-3) — protocol v3: v2 plus ATTENTION / ATTENTION_STATE, server → phone only; v1 and v2 unchanged.

const CALL = '00000000-0000-4000-8000-0000000000c1';
const USER = '00000000-0000-4000-8000-0000000000a1';
const SESSION = '00000000-0000-4000-8000-0000000000b1';
const PHONE = '00000000-0000-4000-8000-0000000000d1';
const PACKETS = syntheticUplinkPackets(4);
const subject = { track: 'USER' as const, subjectKey: 'travel_plan', label: 'خطة السفر إلى الإسكندرية', kind: 'PLAN' as const, confidence: 'HIGH' as const, threadRef: null };

describe('INTEL-LIVE-01 CP2 protocol v3', () => {
  it('adds exactly ATTENTION and ATTENTION_STATE to v2 server messages; nothing new from the phone', () => {
    expect(LIVE_CALL_PROTOCOL_V3).toBe('qandeel.live-call.v3');
    expect(SERVER_MESSAGES_V3).toEqual([...SERVER_MESSAGES_V2, 'ATTENTION', 'ATTENTION_STATE']);
    expect(SERVER_MESSAGES).not.toContain('ATTENTION');
    expect(SERVER_MESSAGES_V2).not.toContain('ATTENTION');
    expect(CLIENT_MESSAGES_V3).toEqual(expect.arrayContaining(['HELLO', 'MARK_ECHO']));
  });

  it('HELLO must say v: 3; every other v2 message parses as in v2; v1 / v2 parsers refuse v: 3', () => {
    const hello = { type: 'HELLO', callId: CALL, sessionId: SESSION, clientInstanceId: PHONE, resume: true };
    expect(parseClientMessageV3(JSON.stringify({ ...hello, v: 3 }))).toEqual({ ...hello, v: 3 });
    expect(parseClientMessageV3(JSON.stringify({ ...hello, v: 2 }))).toBeNull();
    expect(parseClientMessageV3(JSON.stringify({ ...hello, v: 1 }))).toBeNull();
    expect(parseClientMessageV3(JSON.stringify({ ...hello, v: 3, extra: 1 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...hello, v: 3 }))).toBeNull();
    expect(parseClientMessageV2(JSON.stringify({ ...hello, v: 3 }))).toBeNull();
    expect(parseClientMessageV3(JSON.stringify({ type: 'MARK_ECHO', seq: 2, captureMs: null }))).toEqual({ type: 'MARK_ECHO', seq: 2, captureMs: null });
    expect(parseClientMessageV3(JSON.stringify({ type: 'HEARTBEAT', n: 1 }))).toEqual({ type: 'HEARTBEAT', n: 1 });
    expect(parseClientMessageV3(JSON.stringify({ type: 'ATTENTION', seq: 1 }))).toBeNull(); // server → phone only
  });

  it('a snapshot is split into parts of at most 12 entries, all with its seq; an empty snapshot is one empty part', () => {
    expect(attentionStateFrames(0, [])).toEqual([{ type: 'ATTENTION_STATE', seq: 0, part: 0, parts: 1, entries: [] }]);
    const entries: AttentionStateEntry[] = Array.from({ length: 25 }, (_, i) => ({ ...subject, subjectKey: `s${i}`, seq: i + 1 }));
    const frames = attentionStateFrames(40, entries);
    expect(frames.map((f) => [f.part, f.parts, f.entries.length, f.seq])).toEqual([[0, 3, 12, 40], [1, 3, 12, 40], [2, 3, 1, 40]]);
    expect(frames.flatMap((f) => f.entries)).toEqual(entries);
    expect(ATTENTION_STATE_ENTRIES_PER_PART).toBe(12);
  });

  it('every v3 frame at its bounds stays within the v1 text frame bound', () => {
    const long = { ...subject, subjectKey: 'k'.repeat(64), label: 'ل'.repeat(40), threadRef: '00000000-0000-4000-8000-000000000001' };
    const entries = Array.from({ length: 12 }, (_, i) => ({ ...long, seq: 2 ** 40 + i }));
    for (const frame of attentionStateFrames(2 ** 41, entries)) {
      expect(Buffer.byteLength(encodeServerMessageV3(frame), 'utf8')).toBeLessThanOrEqual(MAX_TEXT_FRAME_BYTES);
    }
  });
});

// ------------------------------------------------------------------ the connection
class Transport implements CallTransport {
  readonly sent: Array<Record<string, unknown>> = [];
  bufferedBytes = 0;
  constructor(readonly subprotocol?: string) {}
  sendBinary(): void {}
  sendText(text: string): void { this.sent.push(JSON.parse(text) as Record<string, unknown>); }
  close(): void {}
}
const settle = async () => { for (let i = 0; i < 30; i += 1) await new Promise((resolve) => setImmediate(resolve)); };

async function call(subprotocol: string | undefined, v: number) {
  const authority = new InMemoryCallAuthority();
  const clock = new ManualClock();
  const timer: ClockTimer = { now: () => 0, every: () => 1, stop: () => undefined };
  const store: ClockSlotStore = { clockSlot: async () => ({ snapshotId: 1 }) };
  const transport = new Transport(subprotocol);
  let channel: LiveCallTurnChannel | null = null;
  const speech: LiveCallSpeechSink = { open: (c) => { channel = c; return NULL_LIVE_CALL_SPEECH_SINK.open(c); } };
  const connection = new LiveCallConnection(transport, USER, clock.now() + 3_600_000, {
    store: authority, media: authority, speech, authenticate: async () => ({ userId: USER }),
    registry: new LiveCallRegistry(), clock, signal: () => undefined, clockMarks: new LiveCallClockMarks(store, timer, () => undefined),
  });
  connection.onText(JSON.stringify({ type: 'HELLO', v, callId: CALL, sessionId: SESSION, clientInstanceId: PHONE, resume: false }));
  await settle();
  const beforeActive = channel as LiveCallTurnChannel | null;
  const toldBeforeActive = beforeActive?.discloseAttention?.({ kind: 'STATE', seq: 0, entries: [] }) ?? null;
  connection.onBinary(encodeAudioFrame({ epoch: 1, seq: 0, captureMs: 0, packet: PACKETS[0]! }));
  await settle();
  return { connection, transport, channel: channel as LiveCallTurnChannel | null, toldBeforeActive };
}

describe('INTEL-LIVE-01 CP2 the connection under v3, v2 and v1', () => {
  it('v3: nothing before ACTIVE; once ACTIVE an EVENT is one ATTENTION frame and a STATE its parts, after STATE ACTIVE', async () => {
    const { transport, channel, toldBeforeActive } = await call(LIVE_CALL_PROTOCOL_V3, 3);
    expect(toldBeforeActive).toBeNull(); // the lane's channel exists only from the activation on
    expect(channel!.discloseAttention!({ kind: 'STATE', seq: 0, entries: [] })).toBe('SENT');
    expect(channel!.discloseAttention!({ kind: 'EVENT', seq: 7, op: 'SET', subject, producedClockMs: 1_240 })).toBe('SENT');
    const active = transport.sent.findIndex((m) => m.type === 'STATE' && m.state === 'ACTIVE');
    const firstAttention = transport.sent.findIndex((m) => m.type === 'ATTENTION_STATE');
    expect(active).toBeGreaterThanOrEqual(0);
    expect(firstAttention).toBeGreaterThan(active);
    expect(transport.sent.slice(firstAttention)).toEqual([
      { type: 'ATTENTION_STATE', seq: 0, part: 0, parts: 1, entries: [] },
      { type: 'ATTENTION', seq: 7, op: 'SET', ...subject, producedClockMs: 1_240 },
    ]);
  });

  it('v3: audio first — past the outbound bound an attention frame is DROPPED, never queued', async () => {
    const { transport, channel } = await call(LIVE_CALL_PROTOCOL_V3, 3);
    const before = transport.sent.length;
    transport.bufferedBytes = ATTENTION_OUTBOUND_LIMIT_BYTES + 1;
    expect(channel!.discloseAttention!({ kind: 'EVENT', seq: 1, op: 'SET', subject, producedClockMs: 0 })).toBe('DROPPED');
    expect(transport.sent).toHaveLength(before);
  });

  it('v2 and v1: never a v3 frame (NOT_LISTENING), byte for byte as before', async () => {
    for (const [protocol, v] of [[LIVE_CALL_PROTOCOL_V2, 2], [undefined, 1]] as const) {
      const { transport, channel } = await call(protocol, v);
      expect(transport.sent.find((m) => m.type === 'STATE' && m.state === 'ACTIVE')).toBeDefined();
      expect(channel!.discloseAttention!({ kind: 'EVENT', seq: 1, op: 'SET', subject, producedClockMs: 0 })).toBe('NOT_LISTENING');
      expect(channel!.discloseAttention!({ kind: 'STATE', seq: 1, entries: [] })).toBe('NOT_LISTENING');
      expect(transport.sent.some((m) => m.type === 'ATTENTION' || m.type === 'ATTENTION_STATE')).toBe(false);
    }
  });

  it('v3 with a v2 HELLO is a violation', async () => {
    const { transport } = await call(LIVE_CALL_PROTOCOL_V3, 2);
    expect(transport.sent[0]).toEqual({ type: 'REFUSED', reason: 'PROTOCOL_VIOLATION', msgId: null });
  });
});
