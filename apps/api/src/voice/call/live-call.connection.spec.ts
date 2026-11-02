import { readOggOpus } from './codec/ogg-opus';
import { LiveCallConnection, LiveCallRegistry, tokenDeadline, type CallTransport } from './live-call.connection';
import { NULL_LIVE_CALL_SPEECH_SINK, type LiveCallSpeechSink, type PlayoutVerdict } from './live-call-speech.port';
import { encodeAudioFrame, LIVE_CALL_CLOSE } from './live-call.protocol';
import { InMemoryCallAuthority, ManualClock } from './testing/in-memory-call-authority';
import { syntheticUplinkPackets } from './testing/synthetic-voice';

const USER = '00000000-0000-4000-8000-0000000000a1';
const OTHER = '00000000-0000-4000-8000-0000000000a2';
const SESSION = '00000000-0000-4000-8000-0000000000b1';
const CALL = '00000000-0000-4000-8000-0000000000c1';
const PHONE = '00000000-0000-4000-8000-0000000000d1';
const PACKETS = syntheticUplinkPackets(700);

class FakeTransport implements CallTransport {
  readonly sent: Array<Record<string, unknown>> = [];
  closed: { code: number; reason: string } | null = null;
  bufferedBytes = 0;
  readonly binary: Buffer[] = [];

  sendBinary(frame: Buffer): void {
    this.binary.push(frame);
  }

  sendText(text: string): void {
    this.sent.push(JSON.parse(text) as Record<string, unknown>);
  }

  close(code: number, reason: string): void {
    this.closed ??= { code, reason };
  }

  of(type: string): Array<Record<string, unknown>> {
    return this.sent.filter((m) => m.type === type);
  }

  last(type: string): Record<string, unknown> | undefined {
    return this.of(type).at(-1);
  }
}

const settle = async () => {
  for (let i = 0; i < 30; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

interface Harness {
  authority: InMemoryCallAuthority;
  clock: ManualClock;
  registry: LiveCallRegistry;
  signals: string[];
  pushed: number[];
  playouts: Array<{ callTurnIndex: number; chunkSeq: number; playedMs: number }>;
  verdict: { value: PlayoutVerdict };
  connect: (opts?: { userId?: string; tokenExpiresAt?: number; registry?: LiveCallRegistry }) => { connection: LiveCallConnection; transport: FakeTransport };
}

function harness(authenticate: (authorization: string) => Promise<{ userId: string }> = async () => ({ userId: USER })): Harness {
  const authority = new InMemoryCallAuthority();
  const clock = new ManualClock();
  const registry = new LiveCallRegistry();
  const signals: string[] = [];
  const pushed: number[] = [];
  const playouts: Harness['playouts'] = [];
  const verdict: Harness['verdict'] = { value: 'IGNORED' };
  const speech: LiveCallSpeechSink = {
    open: () => ({
      push: (_pcm, captureMs) => void pushed.push(captureMs),
      playout: async (input) => { playouts.push(input); return verdict.value; },
      close: () => undefined,
    }),
  };
  return {
    authority, clock, registry, signals, pushed, playouts, verdict,
    connect: (opts = {}) => {
      const transport = new FakeTransport();
      const connection = new LiveCallConnection(transport, opts.userId ?? USER, opts.tokenExpiresAt ?? clock.now() + 3_600_000, {
        store: authority, media: authority, speech, authenticate, registry: opts.registry ?? registry, clock,
        signal: (op, outcome) => void signals.push(`${op}:${outcome}`),
      });
      return { connection, transport };
    },
  };
}

const hello = (resume = false, callId = CALL) => JSON.stringify({ type: 'HELLO', v: 1, callId, sessionId: SESSION, clientInstanceId: PHONE, resume });

/** Sends audio packets `from..from+count` with seq and captureMs given, advancing the clock 20 ms per packet. */
async function audio(h: Harness, connection: LiveCallConnection, epoch: number, from: number, count: number, seq0: number, capture0: number) {
  for (let i = 0; i < count; i += 1) {
    h.clock.advance(20);
    connection.onBinary(encodeAudioFrame({ epoch, seq: seq0 + i, captureMs: capture0 + i * 20, packet: PACKETS[(from + i) % PACKETS.length]! }));
    if (i % 25 === 24) await settle();
  }
  await settle();
}

/** Lets `ms` pass with a heartbeat every second (the phone is alive but silent). */
async function idle(h: Harness, connection: LiveCallConnection, ms: number) {
  for (let t = 0; t < ms; t += 1000) {
    h.clock.advance(Math.min(1000, ms - t));
    connection.onText(JSON.stringify({ type: 'HEARTBEAT', n: t }));
    await settle();
  }
}

async function activeCall(h: Harness) {
  const { connection, transport } = h.connect();
  connection.onText(hello());
  await settle();
  await audio(h, connection, 1, 0, 1, 0, 0);
  return { connection, transport };
}

describe('S8B-05 CP1 one live call connection (protocol v1 over the call authority)', () => {
  it('begins CONNECTING, activates on the first audio, records the USER track and ends on END', async () => {
    const h = harness();
    const { connection, transport } = h.connect();
    connection.onText(hello());
    await settle();
    expect(transport.last('STATE')).toMatchObject({ state: 'CONNECTING', epoch: 1, startedAt: null, callId: CALL });
    await audio(h, connection, 1, 0, 600, 0, 0);
    const active = transport.of('STATE').find((m) => m.state === 'ACTIVE');
    expect(active).toMatchObject({ epoch: 1, resumeFromCaptureMs: 0, heartbeatMs: 1000 });
    expect(typeof active!.startedAt).toBe('string');
    expect(h.pushed.length).toBe(600); // every packet decoded to 16 kHz PCM, in capture order
    connection.onText(JSON.stringify({ type: 'END', msgId: 1 }));
    await settle();
    expect(transport.last('ACK')).toEqual({ type: 'ACK', msgId: 1 });
    expect(transport.last('STATE')).toMatchObject({ state: 'ENDED', endReason: 'USER_ENDED', epoch: null });
    expect(transport.closed).toEqual({ code: LIVE_CALL_CLOSE.NORMAL, reason: 'ENDED' });
    expect(h.authority.calls.get(CALL)).toMatchObject({ state: 'ENDED', endReason: 'USER_ENDED' });
    expect(h.authority.segments.map((s) => [s.index, s.startMs, s.endMs])).toEqual([[0, 0, 10_000], [1, 10_000, 12_000]]);
    expect(h.authority.segments.reduce((n, s) => n + readOggOpus(s.bytes).packets.length, 0)).toBe(600);
    expect(h.signals).toEqual(expect.arrayContaining(['begin:success', 'activate:success', 'end:success']));
  });

  it('records a MUTED gap for the muted span; audio while muted is a violation', async () => {
    const h = harness();
    const { connection, transport } = await activeCall(h);
    await audio(h, connection, 1, 1, 49, 1, 20);
    connection.onText(JSON.stringify({ type: 'MUTE', msgId: 1, captureMs: 1000 }));
    await idle(h, connection, 2000);
    connection.onText(JSON.stringify({ type: 'UNMUTE', msgId: 2, captureMs: 3000 }));
    await settle();
    await audio(h, connection, 1, 50, 50, 50, 3000);
    connection.onText(JSON.stringify({ type: 'END', msgId: 3 }));
    await settle();
    expect(transport.of('ACK').map((m) => m.msgId)).toEqual([1, 2, 3]);
    expect(h.authority.gaps).toEqual([{ track: 'USER', startMs: 1000, endMs: 3000, kind: 'MUTED' }]);
    expect(h.authority.segments.map((s) => [s.startMs, s.endMs])).toEqual([[0, 1000], [3000, 4000]]);

    const v = harness();
    const second = await activeCall(v);
    second.connection.onText(JSON.stringify({ type: 'MUTE', msgId: 1, captureMs: 20 }));
    await settle();
    await audio(v, second.connection, 1, 1, 1, 1, 20);
    expect(second.transport.last('REFUSED')).toMatchObject({ reason: 'PROTOCOL_VIOLATION' });
    expect(second.transport.closed?.code).toBe(LIVE_CALL_CLOSE.PROTOCOL_VIOLATION);
  });

  it('re-ACKs a repeated msgId without applying it again', async () => {
    const h = harness();
    const { connection, transport } = await activeCall(h);
    connection.onText(JSON.stringify({ type: 'MUTE', msgId: 1, captureMs: 20 }));
    connection.onText(JSON.stringify({ type: 'UNMUTE', msgId: 2, captureMs: 20 }));
    connection.onText(JSON.stringify({ type: 'MUTE', msgId: 1, captureMs: 20 })); // a resend
    await settle();
    expect(transport.of('ACK').map((m) => m.msgId)).toEqual([1, 2, 1]);
    await audio(h, connection, 1, 1, 10, 1, 20); // not muted: accepted
    expect(transport.of('REFUSED')).toEqual([]);
  });

  it('drops a resent lower seq or older capture and refuses a seq jump, an unexplained hole and a wrong epoch', async () => {
    const h = harness();
    const { connection, transport } = await activeCall(h);
    await audio(h, connection, 1, 1, 9, 1, 20);
    await audio(h, connection, 1, 5, 3, 5, 100); // resend of seq 5..7
    expect(transport.of('REFUSED')).toEqual([]);
    expect(h.pushed.length).toBe(10);

    const jump = harness();
    const a = await activeCall(jump);
    await audio(jump, a.connection, 1, 1, 1, 5, 20);
    expect(a.transport.closed?.code).toBe(LIVE_CALL_CLOSE.PROTOCOL_VIOLATION);
    // A violation loses the connection; the call is not ended (RECONNECTING for the grace).
    expect(jump.authority.calls.get(CALL)!.state).toBe('RECONNECTING');

    const hole = harness();
    const b = await activeCall(hole);
    await audio(hole, b.connection, 1, 1, 1, 1, 400);
    expect(b.transport.closed?.code).toBe(LIVE_CALL_CLOSE.PROTOCOL_VIOLATION);

    const epoch = harness();
    const c = await activeCall(epoch);
    await audio(epoch, c.connection, 2, 1, 1, 1, 20);
    expect(c.transport.closed?.code).toBe(LIVE_CALL_CLOSE.PROTOCOL_VIOLATION);
  });

  it('refuses random bytes that are not a mono 20 ms Opus packet', async () => {
    const h = harness();
    const { connection, transport } = h.connect();
    connection.onText(hello());
    await settle();
    connection.onBinary(encodeAudioFrame({ epoch: 1, seq: 0, captureMs: 0, packet: Buffer.from([0xfc, 1, 2, 3]) })); // stereo 20 ms CELT
    await settle();
    expect(transport.closed?.code).toBe(LIVE_CALL_CLOSE.PROTOCOL_VIOLATION);
    expect(h.authority.calls.get(CALL)!.startedAt).toBeNull();
  });

  it('a lost connection suspends the call and a resume continues it with a RECONNECTION gap, never a new call', async () => {
    const h = harness();
    const first = await activeCall(h);
    await audio(h, first.connection, 1, 1, 99, 1, 20);
    first.connection.onTransportClosed();
    await settle();
    expect(h.authority.calls.get(CALL)!.state).toBe('RECONNECTING');
    expect(h.authority.segments.map((s) => [s.startMs, s.endMs])).toEqual([[0, 2000]]); // flushed before suspending

    const second = h.connect();
    second.connection.onText(hello(true));
    await settle();
    expect(second.transport.last('STATE')).toMatchObject({ state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 2000 });
    await audio(h, second.connection, 2, 150, 50, 0, 3000);
    second.connection.onText(JSON.stringify({ type: 'END', msgId: 1 }));
    await settle();
    expect(h.authority.gaps).toEqual([{ track: 'USER', startMs: 2000, endMs: 3000, kind: 'RECONNECTION' }]);
    expect(h.authority.segments.map((s) => [s.startMs, s.endMs])).toEqual([[0, 2000], [3000, 4000]]);
    expect(h.authority.calls.size).toBe(1);
    expect(h.authority.calls.get(CALL)).toMatchObject({ state: 'ENDED', endReason: 'USER_ENDED', epoch: 2 });
  });

  it('a resume on the same instance fences the older connection, which hands over its audio first', async () => {
    const h = harness();
    const older = await activeCall(h);
    await audio(h, older.connection, 1, 1, 79, 1, 20);
    const newer = h.connect();
    newer.connection.onText(hello(true));
    await settle();
    expect(older.transport.last('REFUSED')).toMatchObject({ reason: 'FENCED' });
    expect(older.transport.closed?.code).toBe(LIVE_CALL_CLOSE.FENCED);
    expect(newer.transport.last('STATE')).toMatchObject({ state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 1600 });
    // Written under epoch 1 while it still held the call: the fence (0189) refuses an older epoch, and nothing was lost.
    expect(h.authority.segments.map((s) => [s.startMs, s.endMs])).toEqual([[0, 1600]]);
    // The fenced connection changes nothing more.
    older.connection.onBinary(encodeAudioFrame({ epoch: 1, seq: 80, captureMs: 1600, packet: PACKETS[80]! }));
    await settle();
    expect(h.authority.calls.get(CALL)!.state).toBe('ACTIVE');
  });

  it('another instance\'s late segment is FENCED by the recording: it writes nothing, leaves 4003, and the phone\'s resend is the one truth', async () => {
    const h = harness();
    const older = await activeCall(h);
    await audio(h, older.connection, 1, 1, 199, 1, 20); // 4 s held in the writer's buffer, not yet a segment
    const newer = h.connect({ registry: new LiveCallRegistry() });
    newer.connection.onText(hello(true));
    await settle();
    expect(newer.transport.last('STATE')).toMatchObject({ state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 0 });
    // Before its lease renewal notices, the older connection cuts a segment: the recording answers FENCED.
    for (let i = 0; i < 301; i += 25) { // the newer connection's phone stays alive meanwhile
      await audio(h, older.connection, 1, 200 + i, Math.min(25, 301 - i), 200 + i, 4000 + i * 20);
      newer.connection.onText(JSON.stringify({ type: 'HEARTBEAT', n: i }));
    }
    await settle();
    expect(older.transport.last('REFUSED')).toMatchObject({ reason: 'FENCED' });
    expect(older.transport.closed?.code).toBe(LIVE_CALL_CLOSE.FENCED);
    expect(h.authority.segments).toEqual([]);
    expect(h.authority.calls.get(CALL)).toMatchObject({ state: 'ACTIVE', epoch: 2 }); // not ended FAILED
    // The phone resends from the durable end it was told, on the connection that holds the call.
    await audio(h, newer.connection, 2, 0, 100, 0, 0);
    newer.connection.onText(JSON.stringify({ type: 'END', msgId: 1 }));
    await settle();
    expect(h.authority.segments.map((s) => [s.startMs, s.endMs])).toEqual([[0, 2000]]);
    expect(h.authority.gaps).toEqual([]);
    expect(h.authority.calls.get(CALL)).toMatchObject({ state: 'ENDED', endReason: 'USER_ENDED', epoch: 2 });
  });

  it('a connection on another instance learns it is fenced at its next lease renewal and leaves without suspending', async () => {
    const h = harness();
    const older = await activeCall(h);
    const newer = h.connect({ registry: new LiveCallRegistry() });
    newer.connection.onText(hello(true));
    await settle();
    for (let t = 0; t < 5; t += 1) {
      h.clock.advance(1000);
      for (const c of [older.connection, newer.connection]) c.onText(JSON.stringify({ type: 'HEARTBEAT', n: t }));
      await settle();
    }
    expect(older.transport.closed?.code).toBe(LIVE_CALL_CLOSE.FENCED);
    expect(newer.transport.closed).toBeNull();
    expect(h.authority.calls.get(CALL)).toMatchObject({ state: 'ACTIVE', epoch: 2 });
  });

  it('a resume of an ended call reports ENDED and starts nothing', async () => {
    const h = harness();
    const first = await activeCall(h);
    first.connection.onText(JSON.stringify({ type: 'END', msgId: 1 }));
    await settle();
    const late = h.connect();
    late.connection.onText(hello(true));
    await settle();
    expect(late.transport.last('STATE')).toMatchObject({ state: 'ENDED', endReason: 'USER_ENDED' });
    expect(late.transport.closed?.code).toBe(LIVE_CALL_CLOSE.NORMAL);
    expect(h.authority.calls.size).toBe(1);
  });

  it('answers the CP3-CP4 messages REFUSED NOT_SUPPORTED_YET, never ACK', async () => {
    const h = harness();
    const { connection, transport } = await activeCall(h);
    connection.onText(JSON.stringify({ type: 'BARGE_IN', msgId: 2, callTurnIndex: 0, captureMs: 20 }));
    connection.onText(JSON.stringify({ type: 'TEXT_TURN', msgId: 3, clientTurnId: CALL, text: 'x' }));
    await settle();
    expect(transport.of('REFUSED').map((m) => [m.reason, m.msgId])).toEqual([['NOT_SUPPORTED_YET', 2], ['NOT_SUPPORTED_YET', 3]]);
    expect(transport.of('ACK')).toEqual([]);
    expect(transport.closed).toBeNull();
  });

  it('S8B-05 CP2: PLAYOUT goes to the speech stream once per msgId and is acknowledged; a resend is re-ACKed, never applied', async () => {
    const h = harness();
    const { connection, transport } = await activeCall(h);
    connection.onText(JSON.stringify({ type: 'PLAYOUT', msgId: 1, callTurnIndex: 0, chunkSeq: 0, playedMs: 20 }));
    await settle();
    connection.onText(JSON.stringify({ type: 'PLAYOUT', msgId: 1, callTurnIndex: 0, chunkSeq: 0, playedMs: 20 }));
    await settle();
    expect(h.playouts).toEqual([{ callTurnIndex: 0, chunkSeq: 0, playedMs: 20 }]);
    expect(transport.of('ACK').map((m) => m.msgId)).toEqual([1, 1]);
    expect(transport.closed).toBeNull();
  });

  it('S8B-05 CP2: a PLAYOUT the reply never sent (VIOLATION) or before ACTIVE is a protocol violation', async () => {
    const h = harness();
    const { connection, transport } = await activeCall(h);
    h.verdict.value = 'VIOLATION';
    connection.onText(JSON.stringify({ type: 'PLAYOUT', msgId: 1, callTurnIndex: 0, chunkSeq: 9, playedMs: 200 }));
    await settle();
    expect(transport.last('REFUSED')).toMatchObject({ reason: 'PROTOCOL_VIOLATION' });
    expect(transport.closed?.code).toBe(LIVE_CALL_CLOSE.PROTOCOL_VIOLATION);

    const early = harness().connect();
    early.connection.onText(hello());
    await settle();
    early.connection.onText(JSON.stringify({ type: 'PLAYOUT', msgId: 1, callTurnIndex: 0, chunkSeq: 0, playedMs: 20 }));
    await settle();
    expect(early.transport.last('REFUSED')).toMatchObject({ reason: 'PROTOCOL_VIOLATION' });
  });

  it('refuses a refreshed token of another person, and closes when the token expires unrenewed', async () => {
    const h = harness(async () => ({ userId: OTHER }));
    const { connection, transport } = await activeCall(h);
    connection.onText(JSON.stringify({ type: 'TOKEN_REFRESH', msgId: 1, accessToken: 'x.y.z' }));
    await settle();
    expect(transport.last('REFUSED')).toMatchObject({ reason: 'TOKEN_INVALID', msgId: 1 });
    expect(transport.closed?.code).toBe(LIVE_CALL_CLOSE.TOKEN);

    const e = harness();
    const expiring = e.connect({ tokenExpiresAt: e.clock.now() + 2500 });
    expiring.connection.onText(hello());
    await settle();
    await audio(e, expiring.connection, 1, 0, 1, 0, 0);
    await idle(e, expiring.connection, 3000);
    expect(expiring.transport.closed?.code).toBe(LIVE_CALL_CLOSE.TOKEN);
    expect(e.authority.calls.get(CALL)!.state).toBe('RECONNECTING');

    const r = harness();
    const renewed = r.connect({ tokenExpiresAt: r.clock.now() + 2500 });
    renewed.connection.onText(hello());
    await settle();
    renewed.connection.onText(JSON.stringify({ type: 'TOKEN_REFRESH', msgId: 1, accessToken: 'x.y.z' }));
    await settle();
    expect(renewed.transport.last('ACK')).toEqual({ type: 'ACK', msgId: 1 });
    await audio(r, renewed.connection, 1, 0, 1, 0, 0);
    await idle(r, renewed.connection, 3000);
    expect(renewed.transport.closed).toBeNull();
  });

  it('refuses CAPACITY_FULL explicitly and starts nothing', async () => {
    const h = harness();
    h.authority.capacity = 0;
    const { connection, transport } = h.connect();
    connection.onText(hello());
    await settle();
    expect(transport.last('REFUSED')).toMatchObject({ reason: 'CAPACITY_FULL' });
    expect(transport.closed?.code).toBe(LIVE_CALL_CLOSE.REFUSED);
    expect(h.authority.calls.size).toBe(0);
  });

  it('closes a socket that never says HELLO, refuses anything before HELLO, and times out a silent phone', async () => {
    const h = harness();
    const quiet = h.connect();
    h.clock.advance(3000);
    await settle();
    expect(quiet.transport.closed?.code).toBe(LIVE_CALL_CLOSE.SILENCE);
    const early = h.connect();
    early.connection.onText(JSON.stringify({ type: 'END', msgId: 1 }));
    await settle();
    expect(early.transport.closed?.code).toBe(LIVE_CALL_CLOSE.PROTOCOL_VIOLATION);

    const s = harness();
    const silent = s.connect();
    silent.connection.onText(hello());
    await settle();
    s.clock.advance(3000);
    await settle();
    expect(silent.transport.closed?.code).toBe(LIVE_CALL_CLOSE.SILENCE);
    // A call lost while CONNECTING ends FAILED (by the authority), never ACTIVE.
    expect(s.authority.calls.get(CALL)).toMatchObject({ state: 'ENDED', endReason: 'FAILED' });
  });

  it('warns before the maximum length and ends the call SERVER_ENDED at it', async () => {
    const h = harness();
    h.authority.endsAt = new Date(h.clock.now() + 62_000).toISOString();
    const { connection, transport } = await activeCall(h);
    await idle(h, connection, 3000);
    expect(transport.of('CALL_ENDING')).toEqual([{ type: 'CALL_ENDING', endsInMs: 60_000 }]);
    await idle(h, connection, 60_000);
    expect(transport.last('STATE')).toMatchObject({ state: 'ENDED', endReason: 'SERVER_ENDED' });
    expect(h.authority.calls.get(CALL)!.endReason).toBe('SERVER_ENDED');
  });

  it('ends the call FAILED when the recording refuses the audio (consent withdrawn mid-call)', async () => {
    const h = harness();
    const { connection, transport } = await activeCall(h);
    h.authority.consent = false;
    await audio(h, connection, 1, 1, 520, 1, 20);
    expect(transport.of('REFUSED').map((m) => m.reason)).toContain('CONSENT_REQUIRED');
    expect(h.authority.calls.get(CALL)).toMatchObject({ state: 'ENDED', endReason: 'FAILED' });
    expect(transport.closed?.code).toBe(LIVE_CALL_CLOSE.REFUSED);
  });

  it('overload: a flood beyond the frame rate is refused and the connection closes 4005', async () => {
    const h = harness();
    const { connection, transport } = await activeCall(h);
    for (let i = 0; i < 200; i += 1) connection.onText(JSON.stringify({ type: 'HEARTBEAT', n: i }));
    await settle();
    expect(transport.last('REFUSED')).toMatchObject({ reason: 'OVERLOADED' });
    expect(transport.closed?.code).toBe(LIVE_CALL_CLOSE.OVERLOADED);
  });

  it('reads the token expiry only to schedule, with a bounded fallback', () => {
    const now = 1_000_000;
    const token = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
    expect(tokenDeadline(token({ exp: 2000 }), now)).toBe(2_000_000);
    expect(tokenDeadline('garbage', now)).toBe(now + 600_000);
    expect(tokenDeadline(token({ exp: 'x' }), now)).toBe(now + 600_000);
  });

  it('the null speech sink keeps nothing and ignores every PLAYOUT', async () => {
    const stream = NULL_LIVE_CALL_SPEECH_SINK.open({} as Parameters<LiveCallSpeechSink['open']>[0]);
    expect(stream.push(Buffer.alloc(640), 0)).toBeUndefined();
    expect(await stream.playout({ callTurnIndex: 0, chunkSeq: 0, playedMs: 20 })).toBe('IGNORED');
    expect(stream.close()).toBeUndefined();
  });
});
