/**
 * INTEL-LIVE-01 CP2 — protocol v3 on the phone (B1 / B3 / B4): the offer, the parse, the layer (seq-ordered SET, WITHDRAW,
 * CONFIRMED, EXPIRED; the snapshot that replaces it; no duplicate, no stale entry) and the call owner that holds it for one
 * call only. Every frame here travels the production path: socket → client → session → controller → owner.
 */
import type { ConversationHistoryOutcome } from '../../runtime-entry';
import { FakeCallEngine, FakeCallPlatform } from '../../voice-call/__fixtures__/live-call-fakes';
import { CALL_ID, CLIENT_ID, ManualTimers, SESSION_ID, socketRecorder, state } from '../../voice-call/__fixtures__/live-call-test-kit';
import { LiveCallClient } from '../../voice-call/live-call-client';
import { LIVE_CALL_CLOSE, LIVE_CALL_PROTOCOL } from '../../voice-call/live-call-protocol';
import { LIVE_CALL_PROTOCOL_V2 } from '../../voice-call/live-call-protocol-v2';
import {
  LIVE_CALL_PROTOCOL_V3, parseServerMessageV3, type AttentionMessage, type AttentionStateMessage, type AttentionSubject,
} from '../../voice-call/live-call-protocol-v3';
import { createCallOwner } from '../call-owner';
import { ProvisionalAttention } from '../provisional-attention';

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
};
const subject = (subjectKey: string, track: AttentionSubject['track'] = 'USER', threadRef: string | null = null): AttentionSubject =>
  ({ track, subjectKey, label: `label ${subjectKey}`, kind: 'TOPIC', confidence: 'HIGH', threadRef });
const ev = (seq: number, op: AttentionMessage['op'], s: AttentionSubject, producedClockMs: number | null = seq * 100): AttentionMessage =>
  ({ type: 'ATTENTION', seq, op, ...s, producedClockMs });
const snap = (seq: number, entries: (AttentionSubject & { seq: number })[], part = 0, parts = 1): AttentionStateMessage =>
  ({ type: 'ATTENTION_STATE', seq, part, parts, entries });

describe('INTEL-LIVE-01 CP2 — protocol v3 on the phone', () => {
  it('parses ATTENTION and ATTENTION_STATE exactly; anything malformed is a fault; v2 messages are unchanged', () => {
    const a = ev(3, 'SET', subject('trip'));
    expect(parseServerMessageV3(JSON.stringify(a))).toEqual(a);
    expect(parseServerMessageV3(JSON.stringify(snap(5, [{ ...subject('trip'), seq: 3 }])))).toEqual(snap(5, [{ ...subject('trip'), seq: 3 }]));
    expect(parseServerMessageV3(JSON.stringify({ type: 'CLOCK_MARK', seq: 2 }))).toEqual({ type: 'CLOCK_MARK', seq: 2 });
    expect(parseServerMessageV3(JSON.stringify({ type: 'ACK', msgId: 4 }))).toEqual({ type: 'ACK', msgId: 4 });
    for (const bad of [
      { ...a, seq: 0 }, { ...a, op: 'MAYBE' }, { ...a, track: 'BOTH' }, { ...a, extra: 1 }, { ...a, label: '' }, { ...a, producedClockMs: -1 },
      snap(2, [{ ...subject('x'), seq: 3 }]), // an entry newer than its snapshot
      snap(2, [], 1, 1), snap(2, Array.from({ length: 13 }, (_, i) => ({ ...subject(`k${i}`), seq: 1 }))),
    ]) expect(parseServerMessageV3(JSON.stringify(bad))).toBeNull();
  });

  it('offers v3 first: v3, v2, v1 with clock marks (Android); v3, v1 without (iOS); unchanged when not asked', () => {
    const offered = (offerAttention: boolean, offerClockMarks: boolean) => {
      const { factory, sockets } = socketRecorder();
      new LiveCallClient({
        url: 'wss://api.example.test/voice/calls/connect', accessToken: () => 't', callId: CALL_ID, sessionId: SESSION_ID, clientInstanceId: CLIENT_ID,
        onEvent: () => undefined, socketFactory: factory, timers: new ManualTimers(), offerAttention, offerClockMarks,
      }).connect();
      return sockets[0]!.offered;
    };
    expect(offered(true, true)).toEqual([LIVE_CALL_PROTOCOL_V3, LIVE_CALL_PROTOCOL_V2, LIVE_CALL_PROTOCOL]);
    expect(offered(true, false)).toEqual([LIVE_CALL_PROTOCOL_V3, LIVE_CALL_PROTOCOL]);
    expect(offered(false, true)).toEqual([LIVE_CALL_PROTOCOL_V2, LIVE_CALL_PROTOCOL]);
    expect(offered(false, false)).toEqual([LIVE_CALL_PROTOCOL]);
  });

  it('under v3 HELLO says v: 3, attention frames become events, and a clock mark is answered (NOCLOCK without a clock)', () => {
    const { factory, sockets } = socketRecorder();
    const events: string[] = [];
    const client = new LiveCallClient({
      url: 'wss://api.example.test/voice/calls/connect', accessToken: () => 't', callId: CALL_ID, sessionId: SESSION_ID, clientInstanceId: CLIENT_ID,
      onEvent: (e) => { events.push(e.type); if (e.type === 'clockMark') client.sendMarkEcho(e.seq, null); }, socketFactory: factory, timers: new ManualTimers(), offerAttention: true,
    });
    client.connect();
    const socket = sockets[0]!;
    socket.protocol = LIVE_CALL_PROTOCOL_V3;
    socket.open();
    expect(socket.controls()[0]).toMatchObject({ type: 'HELLO', v: 3 });
    socket.server(state({ state: 'ACTIVE', epoch: 1, resumeFromCaptureMs: 0 }));
    socket.serverText(JSON.stringify(snap(0, [])));
    socket.serverText(JSON.stringify(ev(1, 'SET', subject('a'))));
    socket.serverText(JSON.stringify({ type: 'CLOCK_MARK', seq: 1 }));
    expect(events).toEqual(['connection', 'connection', 'state', 'attentionState', 'attention', 'clockMark']);
    expect(socket.controls().filter((m) => m.type === 'MARK_ECHO')).toEqual([{ type: 'MARK_ECHO', seq: 1, captureMs: null }]);
  });

  it('a v2 or v1 server never sends v3: an ATTENTION frame there is a fault, as any unknown frame is', () => {
    for (const selected of [LIVE_CALL_PROTOCOL_V2, LIVE_CALL_PROTOCOL]) {
      const { factory, sockets } = socketRecorder();
      const events: string[] = [];
      new LiveCallClient({
        url: 'wss://api.example.test/voice/calls/connect', accessToken: () => 't', callId: CALL_ID, sessionId: SESSION_ID, clientInstanceId: CLIENT_ID,
        onEvent: (e) => events.push(e.type), socketFactory: factory, timers: new ManualTimers(), offerAttention: true, offerClockMarks: true,
      }).connect();
      const socket = sockets[0]!;
      socket.protocol = selected;
      socket.open();
      expect(socket.controls()[0]).toMatchObject({ type: 'HELLO', v: selected === LIVE_CALL_PROTOCOL ? 1 : 2 });
      socket.server(state({ state: 'ACTIVE', epoch: 1, resumeFromCaptureMs: 0 }));
      socket.serverText(JSON.stringify(ev(1, 'SET', subject('a'))));
      expect(events).toContain('serverFault');
      expect(events).not.toContain('attention');
      expect(socket.closedWith).toBe(LIVE_CALL_CLOSE.PROTOCOL_ERROR);
    }
  });
});

describe('INTEL-LIVE-01 CP2 — the layer', () => {
  let t = 0;
  const layer = () => new ProvisionalAttention(() => t);

  it('applies seq-ordered SET, WITHDRAW, CONFIRMED and EXPIRED; a duplicate or stale event changes nothing', () => {
    const l = layer();
    expect(l.state(snap(0, []))).toBe(false);
    t = 10;
    expect(l.event(ev(1, 'SET', subject('a')))).toBe(true);
    t = 20;
    expect(l.event(ev(2, 'SET', subject('b')))).toBe(true);
    expect(l.event(ev(2, 'SET', subject('b')))).toBe(false); // duplicate
    expect(l.event(ev(1, 'WITHDRAW', subject('a')))).toBe(false); // stale
    expect(l.current.marks.map((m) => [m.subjectKey, m.seq, m.appliedAt, m.producedClockMs])).toEqual([['a', 1, 10, 100], ['b', 2, 20, 200]]);
    expect(l.event(ev(3, 'WITHDRAW', subject('a')))).toBe(true);
    expect(l.event(ev(4, 'CONFIRMED', subject('b')))).toBe(true);
    expect(l.current).toMatchObject({ seq: 4, marks: [] });
    l.event(ev(5, 'SET', subject('c')));
    l.event(ev(6, 'EXPIRED', subject('c')));
    expect(l.current.marks).toEqual([]);
  });

  it('keeps the person\'s and QANDEEL\'s subjects apart even under the same key', () => {
    const l = layer();
    l.event(ev(1, 'SET', subject('k', 'USER')));
    l.event(ev(2, 'SET', subject('k', 'QANDEEL')));
    l.event(ev(3, 'WITHDRAW', subject('k', 'USER')));
    expect(l.current.marks.map((m) => `${m.track}:${m.subjectKey}`)).toEqual(['QANDEEL:k']);
  });

  it('a snapshot replaces the layer (no stale entry survives); an older snapshot is ignored; a restored mark keeps its instants', () => {
    const l = layer();
    t = 5;
    l.event(ev(1, 'SET', subject('a')));
    l.event(ev(2, 'SET', subject('b')));
    t = 50;
    expect(l.state(snap(3, [{ ...subject('a'), seq: 1 }, { ...subject('z'), seq: 3 }]))).toBe(true);
    expect(l.current.marks.map((m) => [m.subjectKey, m.appliedAt, m.producedClockMs])).toEqual([['a', 5, 100], ['z', 50, null]]);
    expect(l.state(snap(2, [{ ...subject('b'), seq: 2 }]))).toBe(false); // older than the layer
    expect(l.current.marks.map((m) => m.subjectKey)).toEqual(['a', 'z']);
    expect(l.event(ev(3, 'WITHDRAW', subject('a')))).toBe(false); // already reflected by the snapshot
    expect(l.event(ev(4, 'WITHDRAW', subject('a')))).toBe(true);
  });

  it('a snapshot in parts applies only once whole and in order; an event between parts lands after it', () => {
    const l = layer();
    const entries = Array.from({ length: 14 }, (_, i) => ({ ...subject(`s${i}`), seq: i + 1 }));
    expect(l.state(snap(14, entries.slice(0, 12), 0, 2))).toBe(false);
    expect(l.event(ev(15, 'WITHDRAW', subject('s0')))).toBe(false);
    expect(l.state(snap(14, entries.slice(12), 1, 2))).toBe(true);
    expect(l.current.seq).toBe(15);
    expect(l.current.marks).toHaveLength(13);
    expect(l.current.marks.some((m) => m.subjectKey === 's0')).toBe(false);
    // Out of order: nothing is applied.
    const m = layer();
    m.state(snap(3, entries.slice(0, 2), 0, 2));
    expect(m.state(snap(4, entries.slice(2, 3), 1, 2))).toBe(false);
    expect(m.current.marks).toEqual([]);
  });

  it('the race: an event newer than a snapshot still in flight is never undone by it', () => {
    const l = layer();
    l.event(ev(7, 'SET', subject('new')));
    expect(l.state(snap(6, []))).toBe(false); // read before event 7 was committed: ignored
    expect(l.current.marks.map((m) => m.subjectKey)).toEqual(['new']);
  });
});

describe('INTEL-LIVE-01 CP2 — the call owner holds the layer for one call', () => {
  function kit() {
    const engine = new FakeCallEngine();
    const platform = new FakeCallPlatform();
    const timers = new ManualTimers();
    const { factory, sockets } = socketRecorder();
    let n = 0;
    const owner = createCallOwner({
      sessionId: SESSION_ID, isCurrent: () => true, platform, engine, socketFactory: factory,
      connectUrl: 'wss://api.example.test/voice/calls/connect', authorization: () => ({ Authorization: 'Bearer token-1' }),
      truth: async () => ({ kind: 'NO_CALL_KNOWN' }), readHistory: async (): Promise<ConversationHistoryOutcome> => ({ kind: 'PAGE', page: { exchanges: [], hasOlder: false } }),
      consent: async () => 'READY', requestMicrophone: async () => true, language: () => 'ar', onCallTurn: () => undefined, onCallEnded: () => undefined,
      newId: () => `cccccccc-cccc-4ccc-8ccc-${String(++n).padStart(12, '0')}`, timers,
    });
    let changes = 0;
    owner.subscribeAttention(() => { changes += 1; });
    return { owner, timers, sockets, changes: () => changes };
  }
  async function activeOn(k: ReturnType<typeof kit>, index: number, epoch = 1) {
    const socket = k.sockets[index]!;
    socket.protocol = LIVE_CALL_PROTOCOL_V3;
    socket.open();
    socket.server(state({ state: 'ACTIVE', epoch, resumeFromCaptureMs: 0 }));
    await flush();
    return socket;
  }

  it('offers v3, shows each development while the call continues, removes withdrawn and settled ones', async () => {
    const k = kit();
    await k.owner.start();
    await flush();
    const socket = await activeOn(k, 0);
    expect(socket.offered[0]).toBe(LIVE_CALL_PROTOCOL_V3);
    socket.serverText(JSON.stringify(snap(0, [])));
    socket.serverText(JSON.stringify(ev(1, 'SET', subject('a'))));
    socket.serverText(JSON.stringify(ev(2, 'SET', subject('b', 'QANDEEL'))));
    expect(k.owner.getAttention().marks.map((m) => m.subjectKey)).toEqual(['a', 'b']);
    socket.serverText(JSON.stringify(ev(3, 'WITHDRAW', subject('a'))));
    socket.serverText(JSON.stringify(snap(4, [])));       // the settlement, as the database's state
    expect(k.owner.getAttention().marks).toEqual([]);
    expect(k.changes()).toBe(4);
  });

  it('a reconnection restores from the snapshot (it replaces the layer), then only newer events apply', async () => {
    const k = kit();
    await k.owner.start();
    await flush();
    const first = await activeOn(k, 0);
    first.serverText(JSON.stringify(snap(0, [])));
    first.serverText(JSON.stringify(ev(1, 'SET', subject('a'))));
    first.serverText(JSON.stringify(ev(2, 'SET', subject('b'))));
    first.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    k.timers.advance(250);
    expect(k.owner.getAttention().marks).toHaveLength(2); // shown while reconnecting
    const second = await activeOn(k, 1, 2);
    // While the phone was away: b withdrawn (3), c set (4) — the snapshot carries the database's state.
    second.serverText(JSON.stringify(snap(4, [{ ...subject('a'), seq: 1 }, { ...subject('c'), seq: 4 }])));
    second.serverText(JSON.stringify(ev(4, 'SET', subject('c')))); // a duplicate of what the snapshot holds
    second.serverText(JSON.stringify(ev(5, 'SET', subject('d'))));
    expect(k.owner.getAttention().marks.map((m) => [m.subjectKey, m.seq])).toEqual([['a', 1], ['c', 4], ['d', 5]]);
  });

  it('the call\'s end drops the layer; the next call starts empty (no cross-call leakage)', async () => {
    const k = kit();
    await k.owner.start();
    await flush();
    const socket = await activeOn(k, 0);
    socket.serverText(JSON.stringify(ev(1, 'SET', subject('a'))));
    expect(k.owner.getAttention().marks).toHaveLength(1);
    k.owner.end();
    socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'USER_ENDED' }));
    await flush();
    expect(k.owner.getState().stage).toBe('IDLE');
    expect(k.owner.getAttention().marks).toEqual([]);
    await k.owner.start();
    await flush();
    const next = await activeOn(k, 1);
    expect(k.owner.getAttention().marks).toEqual([]);
    next.serverText(JSON.stringify(snap(0, [])));
    expect(k.owner.getAttention().marks).toEqual([]);
  });
});
