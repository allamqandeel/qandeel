/**
 * S8B-06 CP3 — the call owner: server truth, the start's order, the notices, J3 / J7, and D-05-07 T1 (a message typed
 * during the call goes on its channel, is committed once, and is written normally only when the call proved it did not).
 * The call itself is CP2's controller on CP1's fakes (socket, engine, platform); nothing here is a second call model.
 */
import type { ConversationExchangeView, ConversationHistoryOutcome, CallTruthRead } from '../../runtime-entry';
import type { ConversationTransport } from '../../conversation/conversation-controller';
import { FakeCallEngine, FakeCallPlatform } from '../../voice-call/__fixtures__/live-call-fakes';
import { CALL_ID, CLIENT_ID, ManualTimers, SESSION_ID, socketRecorder, state } from '../../voice-call/__fixtures__/live-call-test-kit';
import { LIVE_CALL_CLOSE } from '../../voice-call/live-call-protocol';
import { createCallOwner, liveCallKey, noticeOf, type CallOwnerOptions } from '../call-owner';
import { createCallAwareConversationTransport } from '../call-text-transport';

const TURN_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TURN_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const flush = async () => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

function exchange(key: string, id = 'turn-1'): ConversationExchangeView {
  return { userTurn: { id, content: 'w', idempotencyKey: key, createdAt: '2026-11-04T00:00:00.000Z' }, replyState: 'PENDING', reply: null };
}

function setup(given: Partial<Omit<CallOwnerOptions, 'truth'>> & { truth?: CallTruthRead[]; history?: ConversationExchangeView[] } = {}) {
  const { truth: scripted, history: initial, ...over } = given;
  const engine = new FakeCallEngine();
  const platform = new FakeCallPlatform();
  const timers = new ManualTimers();
  const { factory, sockets } = socketRecorder();
  const ids = [CALL_ID, CLIENT_ID, TURN_A, TURN_B];
  const truths = [...(scripted ?? [])];
  let history = initial ?? [];
  const calls = { consent: 0, mic: 0, turns: 0, ended: 0, truth: 0 };
  const owner = createCallOwner({
    sessionId: SESSION_ID,
    isCurrent: () => true,
    platform,
    engine,
    socketFactory: factory,
    connectUrl: 'wss://api.example.test/voice/calls/connect',
    authorization: () => ({ Authorization: 'Bearer token-1' }),
    truth: async () => {
      calls.truth += 1;
      return truths.shift() ?? { kind: 'NO_CALL_KNOWN' };
    },
    readHistory: async (): Promise<ConversationHistoryOutcome> => ({ kind: 'PAGE', page: { exchanges: history, hasOlder: false } }),
    consent: async () => {
      calls.consent += 1;
      return 'READY';
    },
    requestMicrophone: async () => {
      calls.mic += 1;
      return false;
    },
    language: () => 'ar',
    onCallTurn: () => {
      calls.turns += 1;
    },
    onCallEnded: () => {
      calls.ended += 1;
    },
    newId: () => ids.shift() ?? 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    timers,
    settleIntervalMs: 10,
    ...over,
  });
  return {
    owner, engine, platform, timers, sockets, calls,
    setHistory: (next: ConversationExchangeView[]) => {
      history = next;
    },
  };
}

async function active(over: Parameters<typeof setup>[0] = {}) {
  const kit = setup(over);
  await kit.owner.start();
  await flush();
  const socket = kit.sockets[0]!;
  socket.open();
  socket.server(state({ state: 'CONNECTING', epoch: 1 }));
  await flush();
  expect(kit.owner.getState().stage).toBe('CONNECTING');
  socket.server(state({ state: 'ACTIVE', epoch: 1, startedAt: new Date(0).toISOString() }));
  return { ...kit, socket };
}

describe('S8B-06 CP3 — the start: server truth, microphone, consent, one call', () => {
  it('a call the server still holds is never started twice: ALREADY_IN_CALL, nothing opened', async () => {
    const { owner, platform, sockets, calls } = setup({ truth: [{ kind: 'ACTIVE', callId: 'x', callState: 'ACTIVE', startedAt: null }] });
    await owner.start();
    expect(owner.getState()).toMatchObject({ stage: 'IDLE', notice: 'ALREADY_IN_CALL', unchosenEnds: 1 });
    expect(platform.startCalls).toHaveLength(0);
    expect(sockets).toHaveLength(0);
    expect(calls.consent).toBe(0);
  });

  it('a refused microphone asks once, then says so with Open settings; no call, no consent', async () => {
    const kit = setup();
    kit.platform.capabilityValue = { ...kit.platform.capabilityValue, microphoneGranted: false };
    await kit.owner.start();
    expect(kit.calls.mic).toBe(1);
    expect(kit.owner.getState().notice).toBe('MIC_PERMISSION');
    expect(kit.platform.startCalls).toHaveLength(0);
    expect(kit.calls.consent).toBe(0);
  });

  it('without the consent the V3 sheet is asked for and nothing starts; its agreement starts the call', async () => {
    let agreed: (() => Promise<void>) | null = null;
    const kit = setup({
      consent: async (start) => {
        agreed = start;
        return 'ASKED';
      },
    });
    await kit.owner.start();
    expect(kit.owner.getState()).toMatchObject({ stage: 'IDLE', notice: null, unchosenEnds: 0 });
    expect(kit.sockets).toHaveLength(0);
    await agreed!();
    expect(kit.platform.startCalls).toHaveLength(1);
    expect(kit.sockets).toHaveLength(1);
  });

  it('a device with no call support says NOT_AVAILABLE before anything else', async () => {
    const kit = setup({ platform: null });
    await kit.owner.start();
    expect(kit.owner.getState().notice).toBe('NOT_AVAILABLE');
    expect(kit.calls.truth).toBe(0);
  });

  it('a second press while a call is up opens nothing (one socket, one platform call)', async () => {
    const kit = await active();
    await kit.owner.start();
    expect(kit.sockets).toHaveLength(1);
    expect(kit.platform.startCalls).toHaveLength(1);
  });
});

describe('S8B-06 CP3 — what the call UI reads is the server\'s truth', () => {
  it('CONNECTING until the server says ACTIVE; the call time counts from that ACTIVE; loudspeaker first', async () => {
    const kit = await active();
    kit.timers.advance(1);
    expect(kit.owner.getState()).toMatchObject({ stage: 'ACTIVE', activeSince: 0, route: 'LOUDSPEAKER', muted: false, callId: CALL_ID });
    expect(kit.engine.started[0]).toMatchObject({ route: 'SPEAKER', audioOwner: 'PLATFORM_CALL' });
  });

  it('mute is the call\'s own (MUTE sent), the route is the platform\'s (requested, then reported)', async () => {
    const kit = await active();
    kit.owner.toggleMute();
    expect(kit.owner.getState().muted).toBe(true);
    expect(kit.socket.controls().map((m) => m.type)).toContain('MUTE');
    kit.owner.toggleRoute();
    expect(kit.platform.routes).toEqual(['EARPIECE']);
    expect(kit.owner.getState().route).toBe('LOUDSPEAKER');
    kit.platform.emit({ type: 'ENDPOINT', callId: CALL_ID, endpoint: { type: 'EARPIECE' } });
    expect(kit.owner.getState().route).toBe('EARPIECE');
    kit.platform.emit({ type: 'ENDPOINT', callId: CALL_ID, endpoint: { type: 'BLUETOOTH' } });
    expect(kit.owner.getState().route).toBeNull();
  });

  it('a lost link is RECONNECTING, never an end; the resume is the same call on a new socket', async () => {
    const kit = await active();
    kit.socket.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    expect(kit.owner.getState()).toMatchObject({ stage: 'RECONNECTING', notice: null, record: null });
    kit.timers.advance(250);
    const second = kit.sockets[1]!;
    second.open();
    second.server(state({ state: 'ACTIVE', epoch: 2 }));
    expect(kit.owner.getState().stage).toBe('ACTIVE');
    expect(kit.platform.startCalls).toHaveLength(1);
    expect(kit.calls.ended).toBe(0);
  });

  it('QAN-BL-VOICE-06 (2): a resume reads the history (no REPLY_END comes for the exchange the old link left open); the first ACTIVE does not', async () => {
    const kit = await active();
    expect(kit.calls.turns).toBe(0);
    kit.socket.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    kit.timers.advance(250);
    const second = kit.sockets[1]!;
    second.open();
    second.server(state({ state: 'ACTIVE', epoch: 2 }));
    expect(kit.calls.turns).toBe(1);
    expect(kit.owner.getState().activeSince).toBe(0);
  });

  it('HELD is the platform\'s, and is shown as held, not as an end', async () => {
    const kit = await active();
    kit.platform.emit({ type: 'HELD', callId: CALL_ID, state: 'HELD', ignoredLate: 0 });
    expect(kit.owner.getState().stage).toBe('HELD');
    kit.platform.emit({ type: 'RESUMED', callId: CALL_ID, state: 'ACTIVE', ignoredLate: 0 });
    expect(kit.owner.getState().stage).toBe('ACTIVE');
  });

  it('a committed turn and a reply\'s end ask the conversation and the Analysis to catch up', async () => {
    const kit = await active();
    kit.socket.server({ type: 'TURN_COMMITTED', callTurnIndex: 1, role: 'USER', turnId: 'd1d1d1d1-0000-4000-8000-000000000001', clientTurnId: null });
    kit.socket.server({ type: 'TURN_COMMITTED', callTurnIndex: 2, role: 'ASSISTANT', turnId: 'd1d1d1d1-0000-4000-8000-000000000002', clientTurnId: null });
    kit.socket.server({ type: 'REPLY_END', callTurnIndex: 2, chunks: 3, deliveryState: 'INTERRUPTED' });
    expect(kit.calls.turns).toBe(3);
  });
});

describe('S8B-06 CP3 — the end: chosen or not (J3), and the record (J7)', () => {
  it('the person\'s End: no notice, no return, a record with the call\'s length', async () => {
    const kit = await active();
    kit.timers.advance(65_000);
    kit.owner.end();
    expect(kit.owner.getState().stage).toBe('ENDING');
    kit.socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'USER_ENDED' }));
    expect(kit.owner.getState()).toMatchObject({ stage: 'IDLE', notice: null, unchosenEnds: 0, record: { callId: CALL_ID, lengthMs: 65_000, stopped: false } });
    expect(kit.calls.ended).toBe(1);
  });

  it('the server\'s end at the maximum length says MAX_LENGTH and returns the reader to writing', async () => {
    const kit = await active();
    kit.timers.advance(60 * 60_000);
    kit.socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'SERVER_ENDED' }));
    // RE-ANCHORED by the Product Owner's Copy Gate decision D6 (2026-11-04; was: record { stopped: true }): the end at the
    // 60-minute maximum is a natural end, not «توقفت». The notice and the unchosen count are unchanged; the counter-test
    // below keeps an earlier SERVER_ENDED stopped.
    expect(kit.owner.getState()).toMatchObject({ notice: 'MAX_LENGTH', unchosenEnds: 1, record: { stopped: false } });
  });

  it('D6 counter-test: a SERVER_ENDED before the maximum length is STOPPED, and so is its record', async () => {
    const kit = await active();
    kit.timers.advance(5 * 60_000);
    kit.socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'SERVER_ENDED' }));
    expect(kit.owner.getState()).toMatchObject({ notice: 'STOPPED', unchosenEnds: 1, record: { stopped: true } });
  });

  it('an end during the reconnection (the grace passed) is STOPPED, never completed', async () => {
    const kit = await active();
    kit.socket.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    kit.timers.advance(31_000);
    kit.sockets.at(-1)!.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    expect(kit.owner.getState()).toMatchObject({ stage: 'IDLE', notice: 'STOPPED', unchosenEnds: 1 });
  });

  it('a refusal at connect (CAPACITY_FULL) says why and leaves no record', async () => {
    const kit = setup();
    await kit.owner.start();
    await flush();
    const socket = kit.sockets[0]!;
    socket.open();
    socket.server({ type: 'REFUSED', reason: 'CAPACITY_FULL', msgId: null });
    socket.drop(LIVE_CALL_CLOSE.REFUSED);
    expect(kit.owner.getState()).toMatchObject({ stage: 'IDLE', notice: 'CAPACITY', record: null, unchosenEnds: 1 });
  });

  it.each([
    [{ origin: 'START_FAILED', platformSource: null, reason: 'MIC_PERMISSION_DENIED', serverConfirmed: false }, null, 'MIC_PERMISSION', false],
    [{ origin: 'PLATFORM', platformSource: 'NOTIFICATION', reason: 'USER_ENDED', serverConfirmed: true }, 5000, null, true],
    [{ origin: 'PLATFORM', platformSource: 'MICROPHONE', reason: 'USER_ENDED', serverConfirmed: true }, 5000, 'MICROPHONE_LOST', false],
    [{ origin: 'PLATFORM', platformSource: 'ENGINE', reason: 'NO_SERVER_VERDICT', serverConfirmed: false }, 5000, 'STOPPED', false],
    [{ origin: 'SERVER', platformSource: null, reason: 'OTHER_DEVICE', serverConfirmed: true }, null, 'OTHER_DEVICE', false],
    [{ origin: 'SERVER', platformSource: null, reason: 'CONSENT_REQUIRED', serverConfirmed: true }, null, 'CONSENT', false],
    [{ origin: 'SERVER', platformSource: null, reason: 'NOT_AVAILABLE_NOW', serverConfirmed: true }, null, 'NOT_AVAILABLE', false],
    [{ origin: 'SERVER', platformSource: null, reason: 'LOST', serverConfirmed: false }, 5000, 'STOPPED', false],
    [{ origin: 'SERVER', platformSource: null, reason: 'FENCED', serverConfirmed: true }, 5000, 'STOPPED', false],
  ] as const)('noticeOf(%o) after %s ms → %s', (outcome, activeFor, notice, chosen) => {
    expect(noticeOf(outcome, activeFor)).toEqual({ notice, chosen });
  });

  it('S8B-06 CP3 device proof: a SERVER_ENDED at the server\'s endsAt is the length limit, however late the phone came', () => {
    const ended = { origin: 'SERVER', platformSource: null, reason: 'SERVER_ENDED', serverConfirmed: true } as const;
    // The HONOR proof: the phone had counted 5 minutes when the server's 60 minutes ended (its start was moved).
    expect(noticeOf(ended, 5 * 60_000, 2_000)).toEqual({ notice: 'MAX_LENGTH', chosen: false });
    expect(noticeOf(ended, 5 * 60_000, -3_000)).toEqual({ notice: 'MAX_LENGTH', chosen: false });
    // Counter-tests: a server end well before endsAt is not the limit; without endsAt the phone's own count decides.
    expect(noticeOf(ended, 59 * 60_000, 60_000)).toEqual({ notice: 'STOPPED', chosen: false });
    expect(noticeOf(ended, 5 * 60_000, null)).toEqual({ notice: 'STOPPED', chosen: false });
    expect(noticeOf(ended, 60 * 60_000, null)).toEqual({ notice: 'MAX_LENGTH', chosen: false });
  });

  it('S8B-06 CP3 device proof: the server\'s CALL_ENDING tells the phone when the limit is (its STATE carries no endsAt)', async () => {
    // The real server's order (HONOR, APK 2): STATE ACTIVE with endsAt null, CALL_ENDING 60 s before, then SERVER_ENDED.
    const kit = await active();
    kit.timers.advance(5 * 60_000);
    kit.socket.server({ type: 'CALL_ENDING', endsInMs: 60_000 });
    kit.timers.advance(60_000);
    kit.socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'SERVER_ENDED' }));
    expect(kit.owner.getState()).toMatchObject({ notice: 'MAX_LENGTH', unchosenEnds: 1 });
  });

  it('counter-test: a SERVER_ENDED minutes before the CALL_ENDING\'s end is not the limit', async () => {
    const kit = await active();
    kit.timers.advance(5 * 60_000);
    kit.socket.server({ type: 'CALL_ENDING', endsInMs: 5 * 60_000 });
    kit.timers.advance(60_000);
    kit.socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'SERVER_ENDED' }));
    expect(kit.owner.getState()).toMatchObject({ notice: 'STOPPED', unchosenEnds: 1 });
  });
});

describe('S8B-06 CP3 — D-05-07 T1: typed during the call', () => {
  const submission = { content: 'مرحبا', idempotencyKey: 'w1a-k1' };

  it('send stops QANDEEL here (the local cut), the heard mark goes first, then TEXT_TURN — no BARGE_IN', async () => {
    const kit = await active();
    kit.engine.emit({ type: 'playout', callTurnIndex: 2, chunkSeq: 3, playedMs: 240, presentedFrame: 0, source: 'TIMESTAMP' });
    expect(kit.owner.getState().audible).toBe(true);
    const outcome = kit.owner.carryText(submission)!;
    expect(kit.engine.cuts).toBe(1);
    // The engine reports the cut it was asked for as a forced barge-in: not the person speaking.
    kit.engine.emit({ type: 'bargeIn', action: 'STOP', callTurnIndex: 2, onsetCaptureMs: 400, detectCaptureMs: 400, detectedAtNs: 1, forced: true, finalChunkSeq: 3, finalPlayedMs: 260 });
    const order = kit.socket.controls().map((m) => m.type);
    expect(order.slice(-2)).toEqual(['PLAYOUT', 'TEXT_TURN']);
    expect(order).not.toContain('BARGE_IN');
    const text = kit.socket.controls().find((m) => m.type === 'TEXT_TURN')!;
    expect(text).toMatchObject({ clientTurnId: TURN_A, text: 'مرحبا' });
    kit.socket.server({ type: 'TURN_COMMITTED', callTurnIndex: 3, role: 'USER', turnId: 'd1d1d1d1-0000-4000-8000-000000000013', clientTurnId: TURN_A });
    await expect(outcome).resolves.toMatchObject({ kind: 'ANSWERED', exchange: { userTurn: { id: 'd1d1d1d1-0000-4000-8000-000000000013', idempotencyKey: liveCallKey(CALL_ID, TURN_A) }, replyState: 'PENDING' } });
  });

  it('typing is not sending: while nothing is sent QANDEEL is never cut', async () => {
    const kit = await active();
    kit.engine.emit({ type: 'playout', callTurnIndex: 2, chunkSeq: 0, playedMs: 20, presentedFrame: 0, source: 'TIMESTAMP' });
    expect(kit.engine.cuts).toBe(0);
    expect(kit.socket.controls().map((m) => m.type)).not.toContain('TEXT_TURN');
  });

  it('no call up: the owner does not take it (the ordinary route writes it)', () => {
    const { owner } = setup();
    expect(owner.carryText(submission)).toBeNull();
  });

  it('typed while CONNECTING: it waits for the server\'s ACTIVE (TEXT_TURN exists only there)', async () => {
    const kit = setup();
    await kit.owner.start();
    await flush();
    const socket = kit.sockets[0]!;
    socket.open();
    socket.server(state({ state: 'CONNECTING', epoch: 1 }));
    await flush();
    const outcome = kit.owner.carryText(submission)!;
    expect(socket.controls().map((m) => m.type)).not.toContain('TEXT_TURN');
    socket.server(state({ state: 'ACTIVE', epoch: 1 }));
    await flush();
    expect(socket.controls().filter((m) => m.type === 'TEXT_TURN')).toHaveLength(1);
    socket.server({ type: 'TURN_COMMITTED', callTurnIndex: 1, role: 'USER', turnId: 'd1d1d1d1-0000-4000-8000-000000000011', clientTurnId: TURN_A });
    await expect(outcome).resolves.toMatchObject({ kind: 'ANSWERED' });
  });

  it('the link drops before its ACK: resent after the resume under the same clientTurnId, committed once', async () => {
    const kit = await active();
    const outcome = kit.owner.carryText(submission)!;
    kit.socket.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    kit.timers.advance(250);
    const second = kit.sockets[1]!;
    second.open();
    // The server applied a later control (lastMsgId beyond the text's msgId): the text is still resent (its ACK does not move it).
    second.server(state({ state: 'ACTIVE', epoch: 2, lastMsgId: 9 }));
    const resent = second.controls().filter((m) => m.type === 'TEXT_TURN');
    expect(resent).toHaveLength(1);
    expect(resent[0]).toMatchObject({ clientTurnId: TURN_A });
    second.server({ type: 'TURN_COMMITTED', callTurnIndex: 4, role: 'USER', turnId: 'd1d1d1d1-0000-4000-8000-000000000014', clientTurnId: TURN_A });
    second.server({ type: 'TURN_COMMITTED', callTurnIndex: 4, role: 'USER', turnId: 'd1d1d1d1-0000-4000-8000-000000000014', clientTurnId: TURN_A });
    await expect(outcome).resolves.toMatchObject({ kind: 'ANSWERED', exchange: { userTurn: { id: 'd1d1d1d1-0000-4000-8000-000000000014' } } });
  });

  it('refused UNAVAILABLE by a connection that went: sent again after the resume', async () => {
    const kit = await active();
    const outcome = kit.owner.carryText(submission)!;
    const first = kit.socket.controls().find((m) => m.type === 'TEXT_TURN')! as { msgId: number };
    kit.socket.server({ type: 'REFUSED', reason: 'UNAVAILABLE', msgId: first.msgId });
    kit.socket.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    kit.timers.advance(250);
    const second = kit.sockets[1]!;
    second.open();
    second.server(state({ state: 'ACTIVE', epoch: 2, lastMsgId: first.msgId }));
    await flush();
    const again = second.controls().filter((m) => m.type === 'TEXT_TURN');
    expect(again).toHaveLength(1);
    expect(again[0]).toMatchObject({ clientTurnId: TURN_A });
    second.server({ type: 'TURN_COMMITTED', callTurnIndex: 5, role: 'USER', turnId: 'd1d1d1d1-0000-4000-8000-000000000015', clientTurnId: TURN_A });
    await expect(outcome).resolves.toMatchObject({ kind: 'ANSWERED' });
  });

  it('any other refusal is the server\'s no: REFUSED, nothing committed, the words go back', async () => {
    const kit = await active();
    const outcome = kit.owner.carryText(submission)!;
    const sent = kit.socket.controls().find((m) => m.type === 'TEXT_TURN')! as { msgId: number };
    kit.socket.server({ type: 'REFUSED', reason: 'COMMAND_CONFLICT', msgId: sent.msgId });
    await expect(outcome).resolves.toEqual({ kind: 'REFUSED', status: 409 });
  });

  it('the call ended before it committed it, and the history proves it did not: written normally, once', async () => {
    // The start's own read, then the call still held by the server (its end not yet final), then no call.
    const kit = await active({ truth: [{ kind: 'NO_CALL_KNOWN' }, { kind: 'ACTIVE', callId: CALL_ID, callState: 'ACTIVE', startedAt: null }, { kind: 'NO_CALL_KNOWN' }] });
    const base: ConversationTransport = { submitTurn: jest.fn(async () => ({ kind: 'ANSWERED' as const, exchange: exchange('w1a-k1', 'rest') })), readHistory: jest.fn(async () => ({ kind: 'PAGE' as const, page: { exchanges: [], hasOlder: false } })) };
    const transport = createCallAwareConversationTransport(base, kit.owner);
    const pending = transport.submitTurn(SESSION_ID, submission);
    kit.socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'FAILED' }));
    await flush();
    kit.timers.advance(10);
    await flush();
    await expect(pending).resolves.toMatchObject({ kind: 'ANSWERED', exchange: { userTurn: { id: 'rest' } } });
    expect(base.submitTurn).toHaveBeenCalledTimes(1);
    expect(base.submitTurn).toHaveBeenCalledWith(SESSION_ID, submission);
  });

  it('the call ended after it committed it (its TURN_COMMITTED lost): the history\'s call turn, never a second write', async () => {
    const kit = await active();
    const base: ConversationTransport = { submitTurn: jest.fn(), readHistory: jest.fn() };
    const transport = createCallAwareConversationTransport(base, kit.owner);
    const pending = transport.submitTurn(SESSION_ID, submission);
    kit.setHistory([exchange(liveCallKey(CALL_ID, TURN_A), 'u9')]);
    kit.socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'FAILED' }));
    await flush();
    await expect(pending).resolves.toMatchObject({ kind: 'ANSWERED', exchange: { userTurn: { id: 'u9' } } });
    expect(base.submitTurn).not.toHaveBeenCalled();
  });

  it('the server\'s truth cannot be read: honestly unknown (the composer\'s not-confirmed), nothing written', async () => {
    const kit = await active({ truth: [{ kind: 'NO_CALL_KNOWN' }, ...Array.from({ length: 20 }, () => ({ kind: 'UNAVAILABLE' as const }))], settleAttempts: 2 });
    const outcome = kit.owner.carryText(submission)!;
    kit.socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'FAILED' }));
    for (let i = 0; i < 4; i += 1) {
      await flush();
      kit.timers.advance(10);
    }
    await expect(outcome).resolves.toEqual({ kind: 'OUTCOME_UNKNOWN', reason: 'NETWORK' });
  });

  it('the controller\'s re-check of a call turn (its live-call key) is answered from the history, never issued', async () => {
    const base: ConversationTransport = {
      submitTurn: jest.fn(),
      readHistory: jest.fn(async () => ({ kind: 'PAGE' as const, page: { exchanges: [exchange(liveCallKey(CALL_ID, TURN_A), 'u1')], hasOlder: false } })),
    };
    const transport = createCallAwareConversationTransport(base, { carryText: () => null });
    await expect(transport.submitTurn(SESSION_ID, { content: 'w', idempotencyKey: liveCallKey(CALL_ID, TURN_A) })).resolves.toMatchObject({ kind: 'ANSWERED' });
    await expect(transport.submitTurn(SESSION_ID, { content: 'w', idempotencyKey: liveCallKey(CALL_ID, TURN_B) })).resolves.toEqual({ kind: 'NOT_ISSUED' });
    expect(base.submitTurn).not.toHaveBeenCalled();
  });

  it('retiring the generation ends its call', async () => {
    const kit = await active();
    kit.owner.retire();
    expect(kit.socket.controls().map((m) => m.type)).toContain('END');
  });
});

describe('S8B-06 CP3 R1 — system Back during a call (the Product Owner, 2026-11-04)', () => {
  /** The owner's one Back handler, as the platform would call it when no surface took Back first. */
  function backKey() {
    const handlers: (() => boolean)[] = [];
    let removed = 0;
    return {
      register: (handler: () => boolean) => {
        handlers.push(handler);
        return () => {
          removed += 1;
        };
      },
      press: () => handlers[0]!(),
      count: () => handlers.length,
      removed: () => removed,
    };
  }

  it('registered once, with the owner; with no call Back is not taken (the platform default, as before)', () => {
    const back = backKey();
    const kit = setup({ backKey: back.register });
    const moves = jest.fn(() => true);
    kit.platform.moveToBackground = moves;
    expect(back.count()).toBe(1);
    expect(back.press()).toBe(false);
    expect(moves).not.toHaveBeenCalled();
  });

  it('during the call Back sends the app to the background and the call goes on: no END, no platform end, still ACTIVE', async () => {
    const back = backKey();
    const kit = await active({ backKey: back.register });
    const moves = jest.fn(() => true);
    kit.platform.moveToBackground = moves;
    expect(kit.owner.getState().stage).toBe('ACTIVE');
    expect(back.press()).toBe(true);
    expect(moves).toHaveBeenCalledTimes(1);
    await flush();
    expect(kit.owner.getState().stage).toBe('ACTIVE');
    expect(kit.socket.controls().map((m) => m.type)).not.toContain('END');
    expect(kit.platform.endCalls).toEqual([]);
    // The person's own End still ends it.
    kit.owner.end();
    expect(kit.socket.controls().map((m) => m.type)).toContain('END');
  });

  it('while CONNECTING and RECONNECTING too: the call is up, so Back never ends it', async () => {
    const back = backKey();
    const kit = setup({ backKey: back.register });
    kit.platform.moveToBackground = jest.fn(() => true);
    await kit.owner.start();
    await flush();
    const socket = kit.sockets[0]!;
    socket.open();
    socket.server(state({ state: 'CONNECTING', epoch: 1 }));
    await flush();
    expect(kit.owner.getState().stage).toBe('CONNECTING');
    expect(back.press()).toBe(true);
    socket.server(state({ state: 'ACTIVE', epoch: 1, startedAt: new Date(0).toISOString() }));
    socket.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    expect(kit.owner.getState().stage).toBe('RECONNECTING');
    expect(back.press()).toBe(true);
    expect(kit.platform.endCalls).toEqual([]);
  });

  it('counter-test: after the call ended Back is the platform\'s again; a move that did not happen is not claimed', async () => {
    const back = backKey();
    const kit = await active({ backKey: back.register });
    kit.platform.moveToBackground = jest.fn(() => false);
    expect(back.press()).toBe(false);
    kit.platform.moveToBackground = jest.fn(() => true);
    kit.owner.end();
    kit.socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'USER_ENDED' }));
    expect(kit.owner.getState().stage).toBe('IDLE');
    expect(back.press()).toBe(false);
    expect(kit.platform.moveToBackground).not.toHaveBeenCalled();
  });

  it('retiring the generation removes its Back handler', () => {
    const back = backKey();
    const kit = setup({ backKey: back.register });
    kit.owner.retire();
    expect(back.removed()).toBe(1);
  });
});
