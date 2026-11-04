import { LiveCallController, LiveCallStartError, type LiveCallControllerEvent } from '../live-call-controller';
import { liveCallSurfaceCopy } from '../live-call-copy';
import { LIVE_CALL_CLOSE } from '../live-call-protocol';
import type { CallEndSource } from '../voice-call-engine';
import { FakeCallEngine, FakeCallPlatform } from '../__fixtures__/live-call-fakes';
import { CALL_ID, CLIENT_ID, ManualTimers, packet, SESSION_ID, socketRecorder, state } from '../__fixtures__/live-call-test-kit';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const copy = liveCallSurfaceCopy('ar');

function setup(over: { serverEndWaitMs?: number } = {}) {
  const engine = new FakeCallEngine();
  const platform = new FakeCallPlatform();
  const timers = new ManualTimers();
  const { factory, sockets } = socketRecorder();
  const events: LiveCallControllerEvent[] = [];
  const controller = new LiveCallController({
    platform, engine, timers, copy, onEvent: (e) => events.push(e), ...over,
    session: {
      url: 'wss://api.example.test/voice/calls/connect', accessToken: () => 't', callId: CALL_ID, sessionId: SESSION_ID,
      clientInstanceId: CLIENT_ID, socketFactory: factory,
    },
    engineOptions: { route: 'EARPIECE', capture: 'VOICE_COMMUNICATION', aec: true, bargeIn: 'STOP' },
  });
  return { engine, platform, timers, sockets, events, controller };
}

/** Starts a call through to an ACTIVE server call with a running engine. */
async function active(over: { serverEndWaitMs?: number; endsAt?: string | null } = {}) {
  const kit = setup(over);
  await kit.controller.start();
  const socket = kit.sockets[0]!;
  socket.open();
  socket.server(state({ state: 'CONNECTING', epoch: 1 }));
  await flush();
  socket.server(state({ state: 'ACTIVE', epoch: 1, startedAt: new Date(0).toISOString(), endsAt: over.endsAt ?? null }));
  return { ...kit, socket };
}

const ended = (source: CallEndSource) => ({ type: 'ENDED' as const, callId: CALL_ID, state: 'ENDING', ignoredLate: 0, source, detail: null });

describe('S8B-06 CP2 — one call, one end latch, server authority', () => {
  it('starts the platform call first, then the socket, then the engine inside it (PLATFORM_CALL)', async () => {
    const { controller, platform, sockets, engine } = setup();
    await controller.start();
    expect(platform.startCalls).toEqual([{
      callId: CALL_ID, displayName: 'QANDEEL', notificationTitle: 'QANDEEL', notificationText: 'مكالمة مع QANDEEL', channelName: 'مكالمة مع QANDEEL', route: 'EARPIECE',
    }]);
    expect(sockets).toHaveLength(1);
    sockets[0]!.open();
    sockets[0]!.server(state({ state: 'CONNECTING', epoch: 1 }));
    await flush();
    expect(engine.started.map((o) => o.audioOwner)).toEqual(['PLATFORM_CALL']);
    expect(controller.phase).toBe('ACTIVE');
  });

  it('runs one call only: a second start, or a device already in a call, opens nothing', async () => {
    const { controller } = await active();
    await expect(controller.start()).rejects.toEqual(new LiveCallStartError('ALREADY_STARTED'));

    const other = setup();
    other.platform.capabilityValue = { ...other.platform.capabilityValue, inCall: true };
    await expect(other.controller.start()).rejects.toMatchObject({ code: 'ALREADY_IN_CALL' });
    expect(other.platform.startCalls).toHaveLength(0);
    expect(other.sockets).toHaveLength(0);
    expect(other.controller.outcome).toEqual({ origin: 'START_FAILED', platformSource: null, reason: 'ALREADY_IN_CALL', serverConfirmed: false });
  });

  it.each([
    ['an unsupported device (API below 26)', { supported: false, reason: 'API_BELOW_26' }, 'API_BELOW_26'],
    ['an unsupported device (no Telecom)', { supported: false, reason: 'NO_TELECOM' }, 'NO_TELECOM'],
    ['a refused microphone', { microphoneGranted: false }, 'MIC_PERMISSION_DENIED'],
  ])('refuses %s explicitly, before any platform call or socket', async (_name, capability, code) => {
    const { controller, platform, sockets, engine } = setup();
    platform.capabilityValue = { ...platform.capabilityValue, ...capability };
    await expect(controller.start()).rejects.toMatchObject({ code });
    expect(platform.startCalls).toHaveLength(0);
    expect(sockets).toHaveLength(0);
    expect(engine.started).toHaveLength(0);
  });

  it.each(['TELECOM_TIMEOUT', 'SERVICE_START_NOT_ALLOWED', 'MIC_PERMISSION_DENIED', 'CALLKIT_START_FAILED'])(
    'a platform start refused with %s opens no socket and no engine',
    async (code) => {
      const { controller, platform, sockets, engine } = setup();
      platform.autoActivate = false;
      const started = controller.start();
      platform.refuse(code);
      await expect(started).rejects.toMatchObject({ code });
      expect(sockets).toHaveLength(0);
      expect(engine.started).toHaveLength(0);
      expect(platform.subscribed).toBe(false);
    },
  );

  it('an End while the platform is still starting ends the platform call the moment it is active, and opens nothing', async () => {
    const { controller, platform, sockets } = setup();
    platform.autoActivate = false;
    const started = controller.start();
    controller.end();
    controller.end();
    platform.activate();
    await started;
    expect(platform.endCalls).toEqual(['ENDED_DURING_START']);
    expect(sockets).toHaveLength(0);
    expect(controller.outcome).toMatchObject({ origin: 'PERSON', reason: 'ENDED_DURING_START', serverConfirmed: false });
  });

  it('the person\'s End: microphone off at once (the platform end), END to the server, the server\'s reason is the outcome', async () => {
    const { controller, platform, socket } = await active();
    controller.end();
    expect(platform.endCalls).toEqual(['PERSON']);
    expect(socket.controls().filter((m) => m.type === 'END')).toHaveLength(1);
    expect(controller.phase).toBe('ENDING');
    socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'USER_ENDED' }));
    expect(controller.outcome).toEqual({ origin: 'PERSON', platformSource: null, reason: 'USER_ENDED', serverConfirmed: true });
    controller.end();
    expect(controller.ignoredLate).toBe(1);
    expect(platform.endCalls).toEqual(['PERSON']);
  });

  it.each(['NOTIFICATION', 'SYSTEM', 'MICROPHONE', 'ENGINE', 'SERVICE', 'TASK_REMOVED', 'APP_GONE'] as const)(
    'an end from the platform (%s) closes the same latch once: END sent once, no second platform end',
    async (source) => {
      const { controller, platform, socket } = await active();
      platform.emit(ended(source));
      platform.emit(ended('SYSTEM'));
      controller.end();
      expect(socket.controls().filter((m) => m.type === 'END')).toHaveLength(1);
      expect(platform.endCalls).toEqual([]);
      socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'USER_ENDED' }));
      expect(controller.outcome).toEqual({ origin: 'PLATFORM', platformSource: source, reason: 'USER_ENDED', serverConfirmed: true });
      expect(controller.ignoredLate).toBe(2);
    },
  );

  it('the server\'s end (the 60-minute maximum) ends the platform call, synchronised', async () => {
    const { controller, platform, socket, engine } = await active();
    socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'SERVER_ENDED' }));
    expect(platform.endCalls).toEqual(['SERVER_SERVER_ENDED']);
    expect(controller.outcome).toEqual({ origin: 'SERVER', platformSource: null, reason: 'SERVER_ENDED', serverConfirmed: true });
    await flush();
    expect(engine.stops).toBeGreaterThan(0);
    platform.emit(ended('APP'));
    expect(controller.phase).toBe('ENDED');
  });

  it('a local end the server never confirms closes after the wait, and says so (never "completed")', async () => {
    const { controller, timers, socket } = await active({ serverEndWaitMs: 5000 });
    socket.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    controller.end();
    timers.advance(4999);
    expect(controller.phase).toBe('ENDING');
    timers.advance(1);
    expect(controller.outcome).toEqual({ origin: 'PERSON', platformSource: null, reason: 'NO_SERVER_VERDICT', serverConfirmed: false });
  });

  it('a link loss is not an end: reconnecting, then back within the grace; past the grace it is LOST, not completed', async () => {
    const { controller, platform, timers, sockets, socket } = await active();
    socket.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    expect(controller.phase).toBe('ACTIVE');
    expect(platform.notifications.at(-1)).toBe('بيرجع الاتصال…');
    timers.advance(250);
    const second = sockets[1]!;
    second.open();
    second.server(state({ state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 0, lastMsgId: 0 }));
    expect(platform.notifications.at(-1)).toBe('مكالمة مع QANDEEL');

    second.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    for (let i = 0; i < 40 && controller.phase !== 'ENDED'; i += 1) {
      timers.advance(2000);
      sockets.at(-1)!.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    }
    expect(controller.outcome).toEqual({ origin: 'SERVER', platformSource: null, reason: 'LOST', serverConfirmed: false });
    expect(platform.endCalls).toEqual(['SERVER_LOST']);
  });

  it('with JS timers paused (Android background), a held call keeps its heartbeat from the native tick', async () => {
    const { engine, timers, socket } = await active();
    engine.emit({ type: 'hold', captureMs: 0, cause: 'TELECOM_INACTIVE' });
    const before = socket.texts().filter((m) => m.type === 'HEARTBEAT').length;
    for (let i = 0; i < 12; i += 1) {
      timers.skip(250);
      engine.emit({ type: 'tick', nowMs: i * 250 });
    }
    // 3 s held, no audio: one heartbeat a second, so the server's 3 s silence close never comes.
    expect(socket.texts().filter((m) => m.type === 'HEARTBEAT').length - before).toBe(3);
  });

  it('with JS timers paused, a lost link still reconnects within the grace, paced by the native tick', async () => {
    const { controller, engine, timers, sockets, socket } = await active();
    socket.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    expect(sockets).toHaveLength(1);
    timers.skip(300);
    engine.emit({ type: 'tick', nowMs: 300 });
    expect(sockets).toHaveLength(2);
    const second = sockets[1]!;
    second.open();
    second.server(state({ state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 0, lastMsgId: 0 }));
    expect(controller.phase).toBe('ACTIVE');
  });

  it('an engine start failure inside the call ends it, latched as the engine\'s', async () => {
    const kit = setup();
    kit.engine.failStart = { code: 'MIC_START_FAILED' };
    await kit.controller.start();
    const socket = kit.sockets[0]!;
    socket.open();
    socket.server(state({ state: 'CONNECTING', epoch: 1 }));
    await flush();
    expect(socket.controls().filter((m) => m.type === 'END')).toHaveLength(1);
    kit.platform.emit(ended('ENGINE'));
    socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'USER_ENDED' }));
    expect(kit.controller.outcome).toMatchObject({ origin: 'PLATFORM', platformSource: 'ENGINE', serverConfirmed: true });
    expect(socket.controls().filter((m) => m.type === 'END')).toHaveLength(1);
  });

  it('a hold is a MUTED gap, never an end: MUTE at the first frame not produced, UNMUTE where the clock continues', async () => {
    const { controller, engine, platform, socket } = await active();
    engine.emit({ type: 'uplink', captureMs: 0, packet: packet(0) });
    engine.emit({ type: 'uplink', captureMs: 20, packet: packet(1) });
    platform.emit({ type: 'HELD', callId: CALL_ID, state: 'HELD', ignoredLate: 0 });
    engine.emit({ type: 'hold', captureMs: 40, cause: 'TELECOM_INACTIVE' });
    expect(platform.notifications.at(-1)).toBe('المكالمة متوقفة مؤقتًا بسبب مكالمة تانية.');
    expect(controller.phase).toBe('ACTIVE');
    engine.emit({ type: 'resume', captureMs: 6040 });
    platform.emit({ type: 'RESUMED', callId: CALL_ID, state: 'ACTIVE', ignoredLate: 0 });
    engine.emit({ type: 'uplink', captureMs: 6040, packet: packet(2) });
    expect(socket.order()).toEqual(['HELLO', 'A0@0', 'A1@20', 'MUTE#1', 'UNMUTE#2', 'A2@6040']);
    expect(socket.controls().filter((m) => m.type === 'MUTE' || m.type === 'UNMUTE').map((m) => m.captureMs)).toEqual([40, 6040]);
    expect(platform.notifications.at(-1)).toBe('مكالمة مع QANDEEL');
  });

  it('a resume never unmutes a person who muted during the hold', async () => {
    const { controller, engine, socket } = await active();
    engine.emit({ type: 'uplink', captureMs: 0, packet: packet(0) });
    engine.emit({ type: 'hold', captureMs: 20, cause: 'TELECOM_INACTIVE' });
    expect(controller.setMuted(true)).toBe(true);
    engine.emit({ type: 'resume', captureMs: 4000 });
    engine.emit({ type: 'uplink', captureMs: 4000, packet: packet(1) });
    expect(socket.controls().filter((m) => m.type === 'MUTE' || m.type === 'UNMUTE').map((m) => m.type)).toEqual(['MUTE']);
    expect(socket.audio().map((f) => f.captureMs)).toEqual([0]);
    expect(engine.muted).toEqual([true]);
  });

  it("the system's mute (CallKit, a headset, Telecom) is the person's mute, with the same MUTE / UNMUTE", async () => {
    const { engine, platform, socket } = await active();
    engine.emit({ type: 'uplink', captureMs: 0, packet: packet(0) });
    platform.emit({ type: 'SYSTEM_MUTE', callId: CALL_ID, muted: false });
    platform.emit({ type: 'SYSTEM_MUTE', callId: CALL_ID, muted: true });
    platform.emit({ type: 'SYSTEM_MUTE', callId: CALL_ID, muted: true });
    platform.emit({ type: 'SYSTEM_MUTE', callId: CALL_ID, muted: false });
    platform.emit({ type: 'SYSTEM_MUTE', callId: 'another-call', muted: true });
    expect(socket.controls().filter((m) => m.type === 'MUTE' || m.type === 'UNMUTE').map((m) => m.type)).toEqual(['MUTE', 'UNMUTE']);
    expect(engine.muted).toEqual([true, false]);
  });

  it('a hold before the server activated the call ends it honestly (no clock jump the server would refuse)', async () => {
    const kit = setup();
    await kit.controller.start();
    const socket = kit.sockets[0]!;
    socket.open();
    socket.server(state({ state: 'CONNECTING', epoch: 1 }));
    await flush();
    kit.engine.emit({ type: 'hold', captureMs: 0, cause: 'TELECOM_INACTIVE' });
    expect(socket.controls().map((m) => m.type)).toEqual(['HELLO', 'END']);
    expect(kit.controller.phase).toBe('ENDING');
  });
});

describe('S8B-06 CP2 — the 60-minute warning through the controller', () => {
  const at = (ms: number) => new Date(ms).toISOString();

  it('schedules T-5 and T-1 on the engine clock from STATE.endsAt, with their notification lines', async () => {
    const { engine } = await active({ endsAt: at(60 * 60_000) });
    expect(engine.cues).toEqual([
      { op: 'schedule', id: 'T5', kind: 'T5', dueInMs: 55 * 60_000, text: 'تنتهي المكالمة خلال 5 دقائق', result: 'SCHEDULED' },
      { op: 'schedule', id: 'T1', kind: 'T1', dueInMs: 59 * 60_000, text: 'فاضل دقيقة على نهاية المكالمة.', result: 'SCHEDULED' },
    ]);
  });

  it('CALL_ENDING queues at once; the notification follows; HEARD only from the engine', async () => {
    const { controller, engine, platform, socket } = await active({ endsAt: at(60 * 60_000) });
    socket.server({ type: 'CALL_ENDING', endsInMs: 300_000 });
    expect(engine.cues.at(-1)).toMatchObject({ op: 'play', id: 'T5', result: 'QUEUED' });
    expect(platform.notifications.at(-1)).toBe('تنتهي المكالمة خلال 5 دقائق');
    expect(controller.warning.phase.T5).toBe('QUEUED');
    engine.emit({ type: 'cue', event: 'STARTED', id: 'T5', forced: false, source: null });
    expect(controller.warning.phase.T5).toBe('PLAYING');
    engine.emit({ type: 'cue', event: 'HEARD', id: 'T5', forced: false, source: 'TIMESTAMP' });
    expect(controller.warning.phase.T5).toBe('HEARD');
  });

  it('no duplicate across a reconnect, a late notice and the local trigger', async () => {
    const { engine, timers, sockets, socket } = await active({ endsAt: at(60 * 60_000) });
    engine.fire('T5', 'T5');
    socket.server({ type: 'CALL_ENDING', endsInMs: 300_000 });
    socket.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    timers.advance(250);
    sockets[1]!.open();
    sockets[1]!.server(state({ state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 0, endsAt: at(60 * 60_000) }));
    const t5 = engine.cues.filter((c) => c.id === 'T5');
    expect(t5.filter((c) => c.result === 'QUEUED' || c.result === 'SCHEDULED').map((c) => c.op)).toEqual(['schedule']);
    expect(t5.filter((c) => c.op === 'play').map((c) => c.result)).toEqual(['REPEATED']);
  });

  it('a notice missed during an outage is caught up from the next STATE, and a T-5 is never played after a T-1', async () => {
    const { engine, timers, sockets, socket } = await active({ endsAt: at(60 * 60_000) });
    socket.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    timers.advance(59 * 60_000 + 10_000);
    sockets.at(-1)!.open();
    sockets.at(-1)!.server(state({ state: 'ACTIVE', epoch: 2, resumeFromCaptureMs: 0, endsAt: at(60 * 60_000) }));
    const last = engine.cues.slice(-1);
    expect(last).toEqual([{ op: 'schedule', id: 'T1', kind: 'T1', dueInMs: 0, text: 'فاضل دقيقة على نهاية المكالمة.', result: 'SCHEDULED' }]);
    engine.fire('T1', 'T1');
    engine.fire('T5', 'T5');
    expect(engine.cues.filter((c) => c.id === 'T5' && c.op === 'play')).toHaveLength(0);
  });
});

// iOS may suspend the app (a long CallKit hold, the audio session gone): then neither JS timers NOR native events run.
// `timers.skip` is that suspension — the clock moves, nothing fires — and the first event after it is the resume.
describe('S8B-06 CP2 — a suspension (no JS, no native event for minutes), then the resume', () => {
  const held = { type: 'HELD' as const, callId: CALL_ID, state: 'HELD', ignoredLate: 0 };

  it('a link lost before a held suspension: on resume ONE reconnect, then LOST past the grace — never completed', async () => {
    const { controller, engine, platform, timers, sockets, socket } = await active();
    platform.emit(held);
    engine.emit({ type: 'hold', captureMs: 0, cause: 'CALLKIT_HOLD' });
    socket.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    timers.skip(90_000);
    expect(controller.phase).toBe('ACTIVE');
    expect(platform.notifications.at(-1)).toBe(copy.held);
    engine.emit({ type: 'tick', nowMs: 90_000 });
    expect(sockets).toHaveLength(2);
    sockets[1]!.drop(LIVE_CALL_CLOSE.GOING_AWAY);
    expect(sockets).toHaveLength(2);
    expect(controller.outcome).toEqual({ origin: 'SERVER', platformSource: null, reason: 'LOST', serverConfirmed: false });
    expect(platform.endCalls).toEqual(['SERVER_LOST']);
  });

  it('a held suspension with the link still open: one heartbeat on resume (no burst), still held; the server decides the end', async () => {
    const { controller, engine, platform, timers, sockets, socket } = await active();
    platform.emit(held);
    engine.emit({ type: 'hold', captureMs: 0, cause: 'CALLKIT_HOLD' });
    const beats = () => socket.texts().filter((m) => m.type === 'HEARTBEAT').length;
    const before = beats();
    timers.skip(600_000);
    engine.emit({ type: 'tick', nowMs: 600_000 });
    engine.emit({ type: 'tick', nowMs: 600_010 });
    expect(beats() - before).toBe(1);
    expect(controller.phase).toBe('ACTIVE');
    expect(platform.notifications.at(-1)).toBe(copy.held);
    // The server closed the silent link long ago; the phone learns it now, reconnects, and the server gives its verdict.
    socket.drop(LIVE_CALL_CLOSE.SILENCE);
    timers.advance(250);
    expect(sockets).toHaveLength(2);
    sockets[1]!.open();
    sockets[1]!.server(state({ state: 'ENDED', epoch: 2, endReason: 'PEER_LOST_AFTER_GRACE' }));
    expect(controller.outcome).toEqual({ origin: 'SERVER', platformSource: null, reason: 'PEER_LOST_AFTER_GRACE', serverConfirmed: true });
  });

  it('RESUMED after a held suspension clears the hold: UNMUTE where the capture clock continues, still ACTIVE', async () => {
    const { controller, engine, platform, timers, socket } = await active();
    platform.emit(held);
    engine.emit({ type: 'hold', captureMs: 0, cause: 'CALLKIT_HOLD' });
    timers.skip(120_000);
    platform.emit({ type: 'RESUMED', callId: CALL_ID, state: 'ACTIVE', ignoredLate: 0 });
    engine.emit({ type: 'resume', captureMs: 120_000 });
    expect(platform.notifications.at(-1)).toBe(copy.ongoing);
    expect(socket.controls().filter((m) => m.type === 'MUTE' || m.type === 'UNMUTE').map((m) => m.captureMs)).toEqual([0, 120_000]);
    expect(controller.phase).toBe('ACTIVE');
  });

  it('an End just before a suspension: the verdict wait runs out on resume — NO_SERVER_VERDICT, unconfirmed; a later ENDED changes nothing', async () => {
    const { controller, timers, socket } = await active({ serverEndWaitMs: 5000 });
    controller.end();
    expect(socket.controls().filter((m) => m.type === 'END')).toHaveLength(1);
    timers.skip(60_000);
    timers.advance(0);
    expect(controller.outcome).toEqual({ origin: 'PERSON', platformSource: null, reason: 'NO_SERVER_VERDICT', serverConfirmed: false });
    socket.server(state({ state: 'ENDED', epoch: 1, endReason: 'USER_ENDED' }));
    expect(controller.outcome).toEqual({ origin: 'PERSON', platformSource: null, reason: 'NO_SERVER_VERDICT', serverConfirmed: false });
  });
});
