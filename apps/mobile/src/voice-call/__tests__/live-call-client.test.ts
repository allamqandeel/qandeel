import { isAllowedLiveCallUrl, LiveCallClient, type LiveCallClientEvent } from '../live-call-client';
import { LIVE_CALL_PROTOCOL } from '../live-call-protocol';
import { CALL_ID, CLIENT_ID, ManualTimers, packet, reply, SESSION_ID, socketRecorder, state } from '../__fixtures__/live-call-test-kit';

const URL_WSS = 'wss://api.example.test/voice/calls/connect';

function setup(over: { url?: string; insecure?: boolean } = {}) {
  const { factory, sockets } = socketRecorder();
  const timers = new ManualTimers();
  const events: LiveCallClientEvent[] = [];
  let token = 'tok-1';
  const client = new LiveCallClient({
    url: over.url ?? URL_WSS, accessToken: () => token, callId: CALL_ID, sessionId: SESSION_ID, clientInstanceId: CLIENT_ID,
    onEvent: (e) => events.push(e), socketFactory: factory, timers, insecureLoopbackForProof: over.insecure,
  });
  return { client, sockets, timers, events, setToken: (t: string) => { token = t; } };
}

/** Connects, opens, and has the server begin the call (STATE CONNECTING, epoch 1). */
function begun() {
  const kit = setup();
  kit.client.connect();
  kit.sockets[0]!.open();
  kit.sockets[0]!.server(state({ state: 'CONNECTING', epoch: 1 }));
  return kit;
}

describe('S8B-06 CP1 — the live-call client over the frozen protocol', () => {
  it('accepts wss only; ws:// only on the loopback and only for the proof', () => {
    expect(isAllowedLiveCallUrl(URL_WSS, false)).toBe(true);
    expect(isAllowedLiveCallUrl('ws://127.0.0.1:8806/voice/calls/connect', false)).toBe(false);
    expect(isAllowedLiveCallUrl('ws://127.0.0.1:8806/voice/calls/connect', true)).toBe(true);
    expect(isAllowedLiveCallUrl('ws://10.0.0.2:8806/voice/calls/connect', true)).toBe(false);
    expect(isAllowedLiveCallUrl(`${URL_WSS}?token=x`, false)).toBe(false);
    expect(isAllowedLiveCallUrl('wss://api.example.test/voice/notes', false)).toBe(false);
    expect(() => setup({ url: 'ws://127.0.0.1:8806/voice/calls/connect' })).toThrow('LIVE_CALL_URL_REFUSED');
  });

  it('opens with the subprotocol and the bearer header (never the URL), and says HELLO first', () => {
    const { client, sockets } = setup();
    client.connect();
    const s = sockets[0]!;
    expect(s.url).toBe(URL_WSS);
    expect(s.protocol).toBe(LIVE_CALL_PROTOCOL);
    expect(s.headers).toEqual({ Authorization: 'Bearer tok-1' });
    s.open();
    expect(s.texts()[0]).toEqual({ type: 'HELLO', v: 1, callId: CALL_ID, sessionId: SESSION_ID, clientInstanceId: CLIENT_ID, resume: false });
  });

  it('sends HEARTBEAT once a second while open', () => {
    const { client, sockets, timers } = setup();
    client.connect();
    sockets[0]!.open();
    timers.advance(3500);
    expect(sockets[0]!.texts().filter((m) => m.type === 'HEARTBEAT').map((m) => m.n)).toEqual([0, 1, 2]);
  });

  it('numbers produced packets by seq and keeps their capture instants, with the STATE epoch', () => {
    const { client, sockets } = begun();
    for (let i = 0; i < 5; i += 1) client.sendAudio(i * 20, packet(i));
    expect(sockets[0]!.audio().map((f) => [f.epoch, f.seq, f.captureMs])).toEqual([[1, 0, 0], [1, 1, 20], [1, 2, 40], [1, 3, 60], [1, 4, 80]]);
  });

  it('does not produce muted audio: no seq is spent, MUTE / UNMUTE travel in order, the clock jumps', () => {
    const { client, sockets } = begun();
    sockets[0]!.server(state({ state: 'ACTIVE', epoch: 1, resumeFromCaptureMs: 0 }));
    client.sendAudio(0, packet(0));
    client.sendAudio(20, packet(1));
    expect(client.setMuted(true, 40)).toBe(true);
    client.sendAudio(40, packet(2));
    client.sendAudio(60, packet(3));
    expect(client.setMuted(false, 80)).toBe(true);
    client.sendAudio(80, packet(4));
    expect(sockets[0]!.order()).toEqual(['HELLO', 'A0@0', 'A1@20', 'MUTE#1', 'UNMUTE#2', 'A2@80']);
  });

  it('accepts REPLY_AUDIO of the current connection epoch only', () => {
    const { client, sockets, events } = begun();
    sockets[0]!.serverBinary(reply(1, 3, 0));
    sockets[0]!.serverBinary(reply(9, 3, 1));
    sockets[0]!.serverBinary(new Uint8Array([2, 1, 0]));
    expect(events.filter((e) => e.type === 'replyAudio').map((e) => (e as { frame: { chunkSeq: number } }).frame.chunkSeq)).toEqual([0]);
    expect(events.filter((e) => e.type === 'replyFrameDropped').map((e) => (e as { reason: string }).reason)).toEqual(['WRONG_EPOCH', 'MALFORMED']);
    expect(client.counters.replyWrongEpoch).toBe(1);
  });

  it('resumes the same call on a new connection and resends, in the original order, what the server does not hold', () => {
    const { client, sockets, timers, events } = begun();
    const first = sockets[0]!;
    first.server(state({ state: 'ACTIVE', epoch: 1, resumeFromCaptureMs: 0 }));
    for (let i = 0; i < 10; i += 1) client.sendAudio(i * 20, packet(i)); // 0 … 180 sent live
    client.sendPlayout(1, 4, 100); // msgId 1, never acknowledged
    // S8B-06 CP3 re-anchor: the acknowledged PLAYOUT is of ANOTHER reply. A newer PLAYOUT of the SAME reply now supersedes
    // the older one in the log (only a higher mark advances, P1 – P3); that case is the VOICE-06 test below.
    client.sendPlayout(2, 9, 200); // msgId 2, acknowledged
    first.server({ type: 'ACK', msgId: 2 });
    first.drop(1006);
    for (let i = 10; i < 14; i += 1) client.sendAudio(i * 20, packet(i)); // produced while away: buffered only
    expect(first.audio()).toHaveLength(10);

    timers.advance(250);
    const second = sockets[1]!;
    expect(second.headers.Authorization).toBe('Bearer tok-1');
    second.open();
    expect(second.texts()[0]).toMatchObject({ type: 'HELLO', callId: CALL_ID, clientInstanceId: CLIENT_ID, resume: true });
    // The server holds the USER track up to 140 ms and applied nothing beyond msgId 0.
    second.server(state({ state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 140, lastMsgId: 0 }));
    expect(second.order()).toEqual(['HELLO', 'A7@140', 'A8@160', 'A9@180', 'PLAYOUT#1', 'A10@200', 'A11@220', 'A12@240', 'A13@260']);
    expect(second.audio().every((f) => f.epoch === 2)).toBe(true);
    expect(events.find((e) => e.type === 'resent')).toEqual({ type: 'resent', controls: 1, audio: 7, fromCaptureMs: 140 });
    client.sendAudio(280, packet(14));
    expect(second.audio().at(-1)).toMatchObject({ seq: 14, captureMs: 280, epoch: 2 });
  });

  it('keeps only the last 2000 ms of audio for a resend; an older hole is left to the server as a gap', () => {
    const { client, sockets, timers } = begun();
    sockets[0]!.server(state({ state: 'ACTIVE', epoch: 1, resumeFromCaptureMs: 0 }));
    client.sendAudio(0, packet(0));
    sockets[0]!.drop(1006);
    for (let ms = 20; ms <= 5000; ms += 20) client.sendAudio(ms, packet(ms / 20));
    timers.advance(250);
    sockets[1]!.open();
    sockets[1]!.server(state({ state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 20, lastMsgId: 0 }));
    const resent = sockets[1]!.audio();
    expect(resent).toHaveLength(100);
    expect(resent[0]).toMatchObject({ captureMs: 3020, seq: 151 });
    expect(resent.at(-1)).toMatchObject({ captureMs: 5000, seq: 250 });
  });

  it('settles a control on ACK, on REFUSED with its msgId, and on a resume STATE that already applied it', () => {
    const { client, sockets, timers } = begun();
    sockets[0]!.server(state({ state: 'ACTIVE', epoch: 1, resumeFromCaptureMs: 0 }));
    client.sendBargeIn(1, 400); // #1 refused (the CP1 server: NOT_SUPPORTED_YET)
    client.sendPlayout(1, 2, 60); // #2 applied per the resume STATE
    client.sendPlayout(1, 3, 80); // #3 pending
    sockets[0]!.server({ type: 'REFUSED', reason: 'NOT_SUPPORTED_YET', msgId: 1 });
    sockets[0]!.drop(1006);
    timers.advance(250);
    sockets[1]!.open();
    sockets[1]!.server(state({ state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 0, lastMsgId: 2 }));
    expect(sockets[1]!.order()).toEqual(['HELLO', 'PLAYOUT#3']);
  });

  it('QAN-BL-VOICE-06 (S8B-06 CP3 device proof): a reply played through an outage resends ONE PLAYOUT, its newest', () => {
    // On the HONOR phone an 8 s black hole during a reply left ~80 unacknowledged PLAYOUTs; the resume resent them all,
    // the server's control budget (20) refused the connection (OVERLOADED) before applying any, and every resume after it.
    const { client, sockets, timers } = begun();
    sockets[0]!.server(state({ state: 'ACTIVE', epoch: 1, resumeFromCaptureMs: 0 }));
    client.sendPlayout(2, 0, 20); // #1, applied before the outage
    sockets[0]!.server({ type: 'ACK', msgId: 1 });
    sockets[0]!.drop(1006);
    for (let j = 1; j <= 80; j += 1) client.sendPlayout(2, j, (j + 1) * 20); // #2 … #81, the reply kept playing
    client.sendBargeIn(3, 900); // #82, another kind of control: kept
    client.sendPlayout(4, 4, 100); // #83, another reply: kept
    timers.advance(250);
    sockets[1]!.open();
    sockets[1]!.server(state({ state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 0, lastMsgId: 1 }));
    expect(sockets[1]!.order()).toEqual(['HELLO', 'PLAYOUT#81', 'BARGE_IN#82', 'PLAYOUT#83']);
    expect(sockets[1]!.texts().find((m) => m.type === 'PLAYOUT' && m.msgId === 81)).toMatchObject({ callTurnIndex: 2, chunkSeq: 80, playedMs: 1620 });
  });

  it('stops on FENCED and on a refusal, without reconnecting', () => {
    const fenced = begun();
    fenced.sockets[0]!.drop(4003);
    fenced.timers.advance(60_000);
    expect(fenced.sockets).toHaveLength(1);
    expect(fenced.events.at(-1)).toEqual({ type: 'ended', reason: 'FENCED' });

    const refused = setup();
    refused.client.connect();
    refused.sockets[0]!.open();
    refused.sockets[0]!.server({ type: 'REFUSED', reason: 'CAPACITY_FULL', msgId: null });
    refused.sockets[0]!.drop(4004);
    refused.timers.advance(60_000);
    expect(refused.sockets).toHaveLength(1);
    expect(refused.events.at(-1)).toEqual({ type: 'ended', reason: 'CAPACITY_FULL' });
  });

  it('gives up after the reconnect grace and reports the call lost', () => {
    const { client, sockets, timers, events } = begun();
    sockets[0]!.drop(1006);
    for (let i = 0; i < 40; i += 1) {
      timers.advance(2000);
      sockets.at(-1)!.drop(1006);
    }
    expect(events.at(-1)).toEqual({ type: 'ended', reason: 'LOST' });
    const attempts = sockets.length;
    timers.advance(10_000);
    expect(sockets).toHaveLength(attempts);
    client.sendAudio(0, packet(0));
    expect(sockets.at(-1)!.audio()).toHaveLength(0);
  });

  it('ends on STATE ENDED with the server reason, after END is acknowledged', () => {
    const { client, sockets, events } = begun();
    sockets[0]!.server(state({ state: 'ACTIVE', epoch: 1, resumeFromCaptureMs: 0 }));
    client.end();
    expect(sockets[0]!.controls().at(-1)).toEqual({ type: 'END', msgId: 1 });
    sockets[0]!.server({ type: 'ACK', msgId: 1 });
    sockets[0]!.server(state({ state: 'ENDED', epoch: 1, endReason: 'USER_ENDED' }));
    expect(events.at(-1)).toEqual({ type: 'ended', reason: 'USER_ENDED' });
    expect(sockets[0]!.closedWith).toBe(1000);
  });

  it('treats an unreadable server message as a fault and drops the connection (a resume follows)', () => {
    const { sockets, events, timers } = begun();
    sockets[0]!.serverText(JSON.stringify({ type: 'STATE', unknown: true }));
    expect(events.some((e) => e.type === 'serverFault')).toBe(true);
    expect(sockets[0]!.closedWith).toBe(1002);
    sockets[0]!.drop(1002);
    timers.advance(250);
    expect(sockets).toHaveLength(2);
  });

  it('uses the newest token on a reconnection', () => {
    const kit = begun();
    kit.setToken('tok-2');
    kit.sockets[0]!.drop(4001);
    kit.timers.advance(250);
    expect(kit.sockets[1]!.headers).toEqual({ Authorization: 'Bearer tok-2' });
  });
});
