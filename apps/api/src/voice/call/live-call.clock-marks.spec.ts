import { LiveCallClockMarks, slotOf, type ClockEchoRecord, type ClockSlotStore, type ClockTimer } from './live-call.clock-marks';
import { LiveCallConnection, LiveCallRegistry, type CallTransport } from './live-call.connection';
import { NULL_LIVE_CALL_SPEECH_SINK } from './live-call-speech.port';
import { encodeAudioFrame, parseClientMessage } from './live-call.protocol';
import {
  CLIENT_MESSAGES_V2, CLOCK_MARK_POLICY, LIVE_CALL_PROTOCOL_V2, parseClientMessageV2, SERVER_MESSAGES_V2,
} from './live-call.protocol-v2';
import { InMemoryCallAuthority, ManualClock } from './testing/in-memory-call-authority';
import { syntheticUplinkPackets } from './testing/synthetic-voice';

// S8B-07 RB-2 / M-2 (CP3 / CP4) — protocol v2, the instance's clock-mark slots and the connection's use of them. The
// database half (0203: snapshot, write-on-change, compaction) is proven by database/verify-migration-0203.mjs.

const CALL_A = '00000000-0000-4000-8000-0000000000c1';
const CALL_B = '00000000-0000-4000-8000-0000000000c2';

class ManualTimer implements ClockTimer {
  at = 5_000_000;
  handles = 0;
  fn: (() => void) | null = null;
  now(): number { return this.at; }
  every(fn: () => void): unknown { this.handles += 1; this.fn = fn; return this.handles; }
  stop(): void { this.fn = null; }
}

class FakeSlots implements ClockSlotStore {
  readonly batches: Array<{ echoes: ClockEchoRecord[]; compact: string[] }> = [];
  next = 1;
  fail = 0;
  gate: Promise<void> | null = null;
  async clockSlot(input: { instanceId: string; echoes: ReadonlyArray<ClockEchoRecord>; compact: readonly string[] }) {
    this.batches.push({ echoes: [...input.echoes], compact: [...input.compact] });
    if (this.gate) await this.gate;
    if (this.fail > 0) { this.fail -= 1; throw new Error('down'); }
    return { snapshotId: this.next++ };
  }
}

function slots() {
  const timer = new ManualTimer();
  const store = new FakeSlots();
  const signals: string[] = [];
  const marks = new LiveCallClockMarks(store, timer, (op, outcome) => void signals.push(`${op}:${outcome}`));
  const sent: Array<[string, number]> = [];
  let floor = 0;
  const port = (call: string) => ({ send: (seq: number) => void sent.push([call, seq]), latestCaptureMs: () => floor });
  /** Runs slots until the call's own slot has run once (one period at most). */
  const period = async () => { for (let i = 0; i < CLOCK_MARK_POLICY.slots; i += 1) await marks.slot(); };
  return { timer, store, signals, marks, sent, port, setFloor: (v: number) => { floor = v; }, period };
}

describe('RB-2 / M-2 protocol v2', () => {
  it('adds exactly CLOCK_MARK and MARK_ECHO to v1; v1 itself is unchanged', () => {
    expect(LIVE_CALL_PROTOCOL_V2).toBe('qandeel.live-call.v2');
    expect(CLIENT_MESSAGES_V2.at(-1)).toBe('MARK_ECHO');
    expect(SERVER_MESSAGES_V2.at(-1)).toBe('CLOCK_MARK');
    expect(parseClientMessage(JSON.stringify({ type: 'MARK_ECHO', seq: 1, captureMs: 20 }))).toBeNull();
    expect(CLOCK_MARK_POLICY).toMatchObject({ periodMs: 1000, slots: 10, slotMs: 100, androidMarginMs: 100 });
  });

  it('parses MARK_ECHO exactly; HELLO must say v: 2; every other v1 message parses as in v1', () => {
    expect(parseClientMessageV2(JSON.stringify({ type: 'MARK_ECHO', seq: 3, captureMs: 1240 }))).toEqual({ type: 'MARK_ECHO', seq: 3, captureMs: 1240 });
    expect(parseClientMessageV2(JSON.stringify({ type: 'MARK_ECHO', seq: 3, captureMs: null }))).toEqual({ type: 'MARK_ECHO', seq: 3, captureMs: null });
    for (const bad of [{ type: 'MARK_ECHO', seq: 0, captureMs: 20 }, { type: 'MARK_ECHO', seq: 1, captureMs: 30 }, { type: 'MARK_ECHO', seq: 1 },
      { type: 'MARK_ECHO', seq: 1, captureMs: -20 }, { type: 'MARK_ECHO', seq: 1, captureMs: 20, x: 1 }]) {
      expect(parseClientMessageV2(JSON.stringify(bad))).toBeNull();
    }
    const hello = { type: 'HELLO', callId: CALL_A, sessionId: CALL_B, clientInstanceId: CALL_A, resume: false };
    expect(parseClientMessageV2(JSON.stringify({ ...hello, v: 2 }))).toEqual({ ...hello, v: 2 });
    expect(parseClientMessageV2(JSON.stringify({ ...hello, v: 1 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...hello, v: 2 }))).toBeNull();
    expect(parseClientMessageV2(JSON.stringify({ type: 'HEARTBEAT', n: 4 }))).toEqual({ type: 'HEARTBEAT', n: 4 });
  });
});

describe('RB-2 / M-2 clock-mark slots', () => {
  it('staggers calls over ten slots; one statement per slot; the mark only after the statement resolved, bound to its snapshot', async () => {
    const s = slots();
    expect(slotOf(CALL_A)).not.toBe(slotOf(CALL_B));
    s.marks.register(CALL_A, 1, s.port(CALL_A));
    s.marks.register(CALL_B, 1, s.port(CALL_B));
    expect(s.timer.fn).not.toBeNull();
    await s.period();
    expect(s.sent.sort()).toEqual([[CALL_A, 1], [CALL_B, 1]]);
    expect(s.store.batches).toHaveLength(2);            // only the two due slots made a statement
    expect(s.store.batches.every((b) => b.echoes.length === 0 && b.compact.length === 0)).toBe(true);
  });

  it('a failed statement sends no mark and keeps its echoes for the next slot; a busy slot is skipped, never caught up', async () => {
    const s = slots();
    const reg = s.marks.register(CALL_A, 1, s.port(CALL_A));
    await s.period();
    s.timer.at += 300;
    reg.echo(1, 2000);
    s.store.fail = CLOCK_MARK_POLICY.slots;               // every statement of this period fails
    await s.period();
    expect(s.sent).toEqual([[CALL_A, 1]]);              // the failed slot sent nothing
    expect(s.marks.pending.echoes).toBe(1);
    expect(s.signals).toContain('clock_slot:transport_failure');
    await s.period();
    expect(s.store.batches.filter((b) => b.echoes.length > 0).map((b) => b.echoes)).toEqual(Array(CLOCK_MARK_POLICY.slots + 1).fill(
      [{ callId: CALL_A, epoch: 1, markSeq: 1, snapshotId: 1, captureMs: 2000 }]));   // retried every slot until it landed once
    expect(s.sent).toEqual([[CALL_A, 1], [CALL_A, 2]]);
    let open: () => void = () => undefined;
    s.store.gate = new Promise((resolve) => { open = resolve; });
    const first = s.period();
    await new Promise((resolve) => setImmediate(resolve));
    await s.marks.slot();
    expect(s.signals).toContain('clock_slot:skipped_busy');
    open();
    await first;
  });

  it('keeps only a first, timely, clocked echo past the floor that rises; drops the rest', async () => {
    const s = slots();
    const reg = s.marks.register(CALL_A, 1, s.port(CALL_A));
    s.setFloor(1000);
    await s.period();                                    // mark 1, floor 1000
    reg.echo(1, 1000);                                   // not past the floor
    reg.echo(1, 1200);                                   // duplicate (already answered)
    reg.echo(9, 1200);                                   // unknown
    await s.period();                                    // mark 2
    reg.echo(2, null);                                   // NOCLOCK
    await s.period();                                    // mark 3
    s.timer.at += CLOCK_MARK_POLICY.echoLifetimeMs + 1;
    reg.echo(3, 5000);                                   // expired
    await s.period();                                    // mark 4
    reg.echo(4, 6000);                                   // kept
    await s.period();                                    // mark 5
    reg.echo(5, 6000);                                   // does not rise
    expect(s.signals.filter((x) => x.startsWith('clock_echo:')).sort()).toEqual([
      'clock_echo:dropped_expired', 'clock_echo:dropped_order', 'clock_echo:dropped_order', 'clock_echo:dropped_unknown',
      'clock_echo:dropped_unknown', 'clock_echo:noclock']);
    await s.period();
    const kept = s.store.batches.flatMap((b) => b.echoes);
    expect(kept).toEqual([{ callId: CALL_A, epoch: 1, markSeq: 4, snapshotId: 4, captureMs: 6000 }]);
  });

  it('an ended call is compacted; a released one is not; the timer stops when nothing is carried', async () => {
    const s = slots();
    const a = s.marks.register(CALL_A, 1, s.port(CALL_A));
    const b = s.marks.register(CALL_B, 1, s.port(CALL_B));
    a.release(true);
    b.release(false);
    await s.marks.slot();
    expect(s.store.batches.at(-1)!.compact).toEqual([CALL_A]);
    await s.marks.slot();
    expect(s.timer.fn).toBeNull();
    expect(s.marks.carried).toBe(0);
  });

  it('a newer epoch replaces the older registration; the older one releasing does not remove it', async () => {
    const s = slots();
    const old = s.marks.register(CALL_A, 1, s.port(CALL_A));
    s.marks.register(CALL_A, 2, s.port(CALL_A));
    old.release(false);
    expect(s.marks.carried).toBe(1);
    await s.period();
    expect(s.sent).toEqual([[CALL_A, 1]]);
  });
});

// ------------------------------------------------------------------ the connection
class Transport implements CallTransport {
  readonly sent: Array<Record<string, unknown>> = [];
  closed: { code: number; reason: string } | null = null;
  bufferedBytes = 0;
  constructor(readonly subprotocol?: string) {}
  sendBinary(): void {}
  sendText(text: string): void { this.sent.push(JSON.parse(text) as Record<string, unknown>); }
  close(code: number, reason: string): void { this.closed ??= { code, reason }; }
}
const settle = async () => { for (let i = 0; i < 30; i += 1) await new Promise((resolve) => setImmediate(resolve)); };
const USER = '00000000-0000-4000-8000-0000000000a1';
const SESSION = '00000000-0000-4000-8000-0000000000b1';
const PHONE = '00000000-0000-4000-8000-0000000000d1';
const PACKETS = syntheticUplinkPackets(10);

async function call(subprotocol: string | undefined, v: number) {
  const authority = new InMemoryCallAuthority();
  const clock = new ManualClock();
  const s = slots();
  const transport = new Transport(subprotocol);
  const connection = new LiveCallConnection(transport, USER, clock.now() + 3_600_000, {
    store: authority, media: authority, speech: NULL_LIVE_CALL_SPEECH_SINK, authenticate: async () => ({ userId: USER }),
    registry: new LiveCallRegistry(), clock, signal: () => undefined, clockMarks: s.marks,
  });
  connection.onText(JSON.stringify({ type: 'HELLO', v, callId: CALL_A, sessionId: SESSION, clientInstanceId: PHONE, resume: false }));
  await settle();
  connection.onBinary(encodeAudioFrame({ epoch: 1, seq: 0, captureMs: 0, packet: PACKETS[0]! }));
  await settle();
  return { connection, transport, s, authority };
}

describe('RB-2 / M-2 the connection under v2 and v1', () => {
  it('v2: an ACTIVE call receives CLOCK_MARK in its slot and its echo reaches the slots; END compacts it', async () => {
    const { connection, transport, s } = await call(LIVE_CALL_PROTOCOL_V2, 2);
    expect(transport.sent.find((m) => m.type === 'STATE' && m.state === 'ACTIVE')).toBeDefined();
    await s.period();
    expect(transport.sent.filter((m) => m.type === 'CLOCK_MARK')).toEqual([{ type: 'CLOCK_MARK', seq: 1 }]);
    connection.onBinary(encodeAudioFrame({ epoch: 1, seq: 1, captureMs: 20, packet: PACKETS[1]! }));
    connection.onText(JSON.stringify({ type: 'MARK_ECHO', seq: 1, captureMs: 140 }));
    await settle();
    expect(s.marks.pending.echoes).toBe(1);
    expect(transport.sent.some((m) => m.type === 'ACK' || m.type === 'REFUSED')).toBe(false);   // an echo is never ACKed
    connection.onText(JSON.stringify({ type: 'END', msgId: 1 }));
    await settle();
    expect(s.marks.pending.compactions).toBe(1);
    expect(s.marks.carried).toBe(0);
  });

  it('v1: no mark is ever sent, MARK_ECHO is a violation, and a v2 HELLO is refused', async () => {
    const v1 = await call(undefined, 1);
    await v1.s.period();
    expect(v1.transport.sent.some((m) => m.type === 'CLOCK_MARK')).toBe(false);
    expect(v1.s.marks.carried).toBe(0);
    v1.connection.onText(JSON.stringify({ type: 'MARK_ECHO', seq: 1, captureMs: 20 }));
    await settle();
    expect(v1.transport.sent.at(-1)).toEqual({ type: 'REFUSED', reason: 'PROTOCOL_VIOLATION', msgId: null });
    const mixed = await call(undefined, 2);
    expect(mixed.transport.sent[0]).toEqual({ type: 'REFUSED', reason: 'PROTOCOL_VIOLATION', msgId: null });
    const wrong = await call(LIVE_CALL_PROTOCOL_V2, 1);
    expect(wrong.transport.sent[0]).toEqual({ type: 'REFUSED', reason: 'PROTOCOL_VIOLATION', msgId: null });
  });
});
