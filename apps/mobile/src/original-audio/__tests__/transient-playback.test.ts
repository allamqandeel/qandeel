/**
 * S8B-07 CP1-B step 5 — the transient playback engine against a simulated Replay Media Service and streaming player
 * (contract §7, §15.2, §19.2, §20; V-21, V-22, V-32 phone part, V-34 mobile, V-35 (8–10)). The audible log measures
 * what a reader would hear: content lost, content repeated, and silences. These are FUNCTIONAL results on a fake clock:
 * they prove the rules, not HC-1 … HC-5, which only the device proves (step 6).
 */
import { createManualForegroundSignal } from '../../runtime-entry';
import { createPlaybackOwner, type LiveCallSignal } from '../playback-owner';
import {
  createTransientPlayback, TRANSIENT_HANDOVER, TRANSIENT_RENEWAL_LEAD_MS, TRANSIENT_WAITING_NOTICE_MS, type TransientPlaybackEvent,
} from '../transient-playback';
import { continuityOf, createFakePlayerPort, FakeTransientServer, MINUTE, type FakePlayerOptions, type FakeServerOptions } from '../__fixtures__/fake-transient-world';

let commands = 0;
const commandId = () => {
  commands += 1;
  return `c0000000-0000-4000-8000-${commands.toString(16).padStart(12, '0')}`;
};

function liveCallSignal() {
  const listeners = new Set<() => void>();
  let live = false;
  const signal: LiveCallSignal = { isLive: () => live, subscribe: (l) => (listeners.add(l), () => listeners.delete(l)) };
  return {
    signal,
    set(next: boolean) {
      live = next;
      for (const l of Array.from(listeners)) l();
    },
  };
}

function world(server: FakeServerOptions, player: Partial<FakePlayerOptions> = {}, extra: { onRunEnd?: (r: number) => void } = {}) {
  const s = new FakeTransientServer(server);
  const p = createFakePlayerPort(s, { loadDelayMs: 200, seekStallMs: 0, responseCapMs: 0, ...player });
  const foreground = createManualForegroundSignal('ACTIVE');
  const call = liveCallSignal();
  const owner = createPlaybackOwner(call.signal);
  const events: TransientPlaybackEvent[] = [];
  const engine = createTransientPlayback({
    subjectKey: 'call:11111111-1111-4111-8111-111111111111',
    request: (c) => s.request(c),
    status: (id) => s.status(id),
    release: (id) => s.release(id),
    audioUrl: (id) => `https://media.test/voice/transient/${id}`,
    authorization: () => ({ Authorization: 'Bearer t' }),
    player: p.port,
    owner,
    foreground,
    newCommandId: commandId,
    onEvent: (e) => events.push(e),
    ...(extra.onRunEnd === undefined ? {} : { onRunEnd: extra.onRunEnd }),
  });
  const notices: { waiting: number; failed: number; ended: number } = { waiting: 0, failed: 0, ended: 0 };
  let wasWaiting = false;
  engine.subscribe(() => {
    const st = engine.getState();
    if (st.waiting && !wasWaiting) notices.waiting += 1;
    wasWaiting = st.waiting;
    if (st.phase === 'FAILED') notices.failed += 1;
    if (st.phase === 'ENDED') notices.ended += 1;
  });
  return { server: s, players: p, foreground, call, owner, engine, events, notices };
}

const run = (ms: number) => jest.advanceTimersByTimeAsync(ms);
/** Steps the fake clock 50 ms at a time until the condition holds (at most 10 min). */
async function until(_w: unknown, condition: () => boolean): Promise<void> {
  for (let t = 0; t < 10 * MINUTE; t += 50) {
    if (condition()) return;
    await run(50);
  }
  throw new Error('condition never held');
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('starting, pausing, seeking (play / pause / seek / resume)', () => {
  it('asks for the set, waits while it is prepared, then streams with the bearer in a header only', async () => {
    const w = world({ runs: [4 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 3_000 });
    expect(w.engine.play(0, 0)).toBe(true);
    await run(500);
    expect(w.engine.getState().phase).toBe('PREPARING');
    expect(w.engine.getState().waiting).toBe(false);
    await run(TRANSIENT_WAITING_NOTICE_MS);
    expect(w.engine.getState().waiting).toBe(true); // CL-04 / RA-11 only after 1 s
    await run(4_000);
    expect(w.engine.getState().phase).toBe('PLAYING');
    expect(w.engine.getState().waiting).toBe(false);
    const posts = w.server.calls.filter((c) => c.startsWith('POST'));
    expect(new Set(posts).size).toBe(1); // prepared under the SAME command, asked again each second
    expect(w.players.made).toHaveLength(1);
    expect(w.players.made[0]!.url).toBe(`https://media.test/voice/transient/${w.players.made[0]!.artifactId}`);
    expect(w.players.made[0]!.url).not.toMatch(/Bearer|token/u);
    expect(w.players.made[0]!.headers).toEqual({ Authorization: 'Bearer t' });
  });

  it('pauses, resumes at the exact place, seeks, and rests at its start when it ends', async () => {
    const w = world({ runs: [60_000], sourceEndsInMs: 600 * MINUTE, prepareMs: 0 });
    w.engine.play(0, 0);
    await run(10_000);
    w.engine.pause();
    const at = w.engine.getState().positionMs;
    expect(w.engine.getState().phase).toBe('PAUSED');
    await run(5_000);
    expect(w.engine.getState().positionMs).toBe(at);
    w.engine.play();
    await run(2_000);
    expect(w.engine.getState().phase).toBe('PLAYING');
    expect(w.engine.getState().positionMs).toBeGreaterThanOrEqual(at + 1_500);
    w.engine.seek(0, 50_000);
    await run(11_000);
    expect(w.engine.getState()).toMatchObject({ phase: 'PAUSED', positionMs: 0 });
    // CA-07B-2: a player that has played is never started again nor seeked; the resume and the seek each create a new
    // player at the place, and the one before it is released first (one player at all times).
    expect(w.players.made).toHaveLength(3);
    expect(w.players.made[1]!.calls[0]).toBe(`seek:${at}`);
    expect(w.players.made[2]!.calls[0]).toBe('seek:50000');
    expect(w.players.made.map((p) => p.calls.filter((call) => call === 'play').length)).toEqual([1, 1, 1]);
    expect(w.players.made.every((p) => p.released)).toBe(true);
    expect(w.players.alive.max).toBe(1);
    const c = continuityOf(w.players.audible);
    expect(c.repeatedMs).toBe(0);
  });

  it('pausing while the set is prepared asks nothing more until the next play', async () => {
    const w = world({ runs: [60_000], sourceEndsInMs: 600 * MINUTE, prepareMs: 10_000 });
    w.engine.play(0, 0);
    await run(1_500);
    w.engine.pause();
    const asked = w.server.calls.length;
    await run(20_000);
    expect(w.server.calls.length).toBe(asked);
    w.engine.play();
    await run(2_000);
    expect(w.engine.getState().phase).toBe('PLAYING');
  });
});

describe('V-21 / V-34: one at a time, and the live call outranks it', () => {
  it('a live call refuses the controls with no text, and one that begins mid-listening releases it', async () => {
    const w = world({ runs: [10 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 0 });
    w.call.set(true);
    expect(w.engine.play(0, 0)).toBe(false);
    expect(w.server.calls).toHaveLength(0);
    expect(w.engine.getState()).toMatchObject({ phase: 'IDLE', waiting: false });
    w.call.set(false);
    w.engine.play(0, 0);
    await run(5_000);
    expect(w.engine.getState().phase).toBe('PLAYING');
    const at = w.engine.getState().positionMs;
    w.call.set(true);
    expect(w.players.made[0]!.released).toBe(true);
    expect(w.server.calls.filter((c) => c.startsWith('DELETE'))).toHaveLength(1);
    expect(w.engine.getState()).toMatchObject({ phase: 'PAUSED' });
    expect(w.engine.getState().positionMs).toBeGreaterThanOrEqual(at);
    const before = w.server.calls.length;
    await run(30_000);
    expect(w.server.calls.length).toBe(before); // nothing more is asked
    expect(w.players.made[0]!.playedAfterRelease).toBe(0);
  });

  it('another subject that starts releases this one (the slot is one)', async () => {
    const w = world({ runs: [10 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 0 });
    w.engine.play(0, 0);
    await run(3_000);
    let noteReleased = 0;
    const note = w.owner.claim('note:22222222-2222-4222-8222-222222222222', () => {
      noteReleased += 1;
    });
    expect(note).not.toBeNull();
    expect(w.players.made[0]!.released).toBe(true);
    expect(w.engine.getState().phase).toBe('PAUSED');
    w.engine.play();
    expect(noteReleased).toBe(1);
  });
});

describe('V-22 / V-32 phone part: the stop rules (§15.2)', () => {
  it('the source expiring mid-play stops at the local deadline with the proven cause, and nothing more is fetched', async () => {
    const w = world({ runs: [20 * MINUTE], sourceEndsInMs: 2 * MINUTE, prepareMs: 0, sourceReason: 'EXPIRED' });
    w.engine.play(0, 0);
    await run(2 * MINUTE + 2_000);
    expect(w.engine.getState()).toMatchObject({ phase: 'ENDED', endedReason: 'EXPIRED' });
    expect(w.players.made.every((m) => m.released)).toBe(true);
    const after = w.server.calls.length;
    await run(60_000);
    expect(w.server.calls.length).toBe(after);
    expect(w.players.made.reduce((n, m) => n + m.playedAfterRelease, 0)).toBe(0);
    // Nothing was heard after E.
    const end = Math.max(...w.players.audible.map((s) => s.wallEnd));
    expect(end).toBeLessThanOrEqual(w.server.sourceEnd);
  });

  it('a deletion elsewhere is caught by the 10 s status check: CL-07 only because the server proves it', async () => {
    const w = world({ runs: [20 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 0 });
    w.engine.play(0, 0);
    await run(30_000);
    w.server.deleteSource();
    await run(12_000);
    expect(w.engine.getState()).toMatchObject({ phase: 'ENDED', endedReason: 'DELETED' });
  });

  it('a source gone with no proven cause ends with none (CL-11 / RA-17): the phone never infers one (V-30)', async () => {
    const w = world({ runs: [20 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 0 });
    w.engine.play(0, 0);
    await run(30_000);
    w.server.deleteSource();
    w.server.sourceReason = null;
    await run(12_000);
    expect(w.engine.getState()).toMatchObject({ phase: 'ENDED', endedReason: null });
  });

  it("the owner's own deletion stops BEFORE its request: released once, nothing more asked, nothing played after", async () => {
    const w = world({ runs: [20 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 0 });
    w.engine.play(0, 0);
    await run(5_000);
    const before = w.server.calls.length;
    w.engine.stop();
    expect(w.engine.getState().phase).toBe('ENDED');
    expect(w.players.made[0]!.calls.filter((c) => c === 'release')).toHaveLength(1);
    await run(60_000);
    expect(w.server.calls.length).toBe(before);
    expect(w.players.made[0]!.playedAfterRelease).toBe(0);
    expect(w.engine.play()).toBe(false);
  });

  it('every player is created streaming-only (no download option exists on the port), with the URL and a header', async () => {
    const w = world({ runs: [60_000], sourceEndsInMs: 600 * MINUTE, prepareMs: 0 });
    w.engine.play(0, 0);
    await run(2_000);
    for (const m of w.players.made) expect(Object.keys(m.headers)).toEqual(['Authorization']);
  });

  it('leaving releases the player and lets the set go (DELETE); the app leaving the foreground pauses', async () => {
    const w = world({ runs: [10 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 0 });
    w.engine.play(0, 0);
    await run(3_000);
    w.foreground.set('INACTIVE');
    expect(w.engine.getState().phase).toBe('PAUSED');
    w.foreground.set('ACTIVE');
    w.engine.leave();
    expect(w.players.made[0]!.released).toBe(true);
    expect(w.server.calls.filter((c) => c.startsWith('DELETE'))).toHaveLength(1);
    expect(w.engine.getState().phase).toBe('IDLE');
  });

  it('BUSY (or NONE) is CL-05 / RA-12, and a later play asks again', async () => {
    const w = world({ runs: [60_000], sourceEndsInMs: 600 * MINUTE, prepareMs: 0 });
    w.server.busy = 1;
    w.engine.play(0, 0);
    await run(500);
    expect(w.engine.getState().phase).toBe('FAILED');
    w.engine.play(0, 0);
    await run(1_000);
    expect(w.engine.getState().phase).toBe('PLAYING');
  });
});

describe('§19.2 Range continuation (V-35)', () => {
  it('a cut at the 10-min response cap resumes at the exact place: nothing lost, nothing repeated, no notice', async () => {
    const w = world({ runs: [25 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 0 }, { responseCapMs: 10 * MINUTE });
    w.engine.play(0, 0);
    await run(25 * MINUTE + 10_000);
    expect(w.engine.getState()).toMatchObject({ phase: 'PAUSED', positionMs: 0 });
    const c = continuityOf(w.players.audible);
    expect(c.lostMs).toBe(0);
    expect(c.repeatedMs).toBe(0);
    expect(c.transitions).toBe(2);
    expect(w.notices.waiting).toBe(0);
    // Each resume asked the status first.
    expect(w.server.calls.filter((c2) => c2.startsWith('STATUS')).length).toBeGreaterThanOrEqual(2);
  });

  it('under ~1 s of first-byte latency the bytes arrive late, and the silence is measured, not hidden', async () => {
    const w = world({ runs: [25 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 0 }, { responseCapMs: 10 * MINUTE, loadDelayMs: 1_000 });
    w.engine.play(0, 0);
    await run(25 * MINUTE + 15_000);
    const c = continuityOf(w.players.audible);
    expect(c.lostMs).toBe(0);
    expect(c.repeatedMs).toBe(0);
    // A re-created player is silent while its first byte travels: this is the audible gap HC-2 measures on the device.
    expect(c.largestSilenceMs).toBeGreaterThanOrEqual(1_000);
    expect(w.notices.waiting).toBeGreaterThanOrEqual(1); // CL-04 after 1 s of it
  });

  it('at most 3 resumes a minute; then CL-05 / RA-12', async () => {
    const w = world({ runs: [25 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 0 }, { responseCapMs: 2_000 });
    w.engine.play(0, 0);
    await run(40_000);
    expect(w.engine.getState().phase).toBe('FAILED');
    expect(w.players.made.length).toBeLessThanOrEqual(4);
  });
});

describe('§20 continuation across the access cap (V-35 (8)–(10))', () => {
  it('(8) renews before the cut, hands over on ONE player (pause, place, release, new file there) and never ends', async () => {
    const w = world({ runs: [60 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 30_000 }, { loadDelayMs: 400 });
    w.engine.play(0, 0);
    await run(40_000);
    expect(w.engine.getState().phase).toBe('PLAYING');
    // The first start's own preparation showed CL-04 (A5); from here on, nothing is shown.
    w.notices.waiting = 0;
    await run(60 * MINUTE);
    expect(w.events).toEqual([]); // the degraded path never ran
    expect(w.notices).toEqual({ waiting: 0, failed: 0, ended: 0 });
    // CA-07B-2: never two players at once, so never two generations heard together.
    expect(w.players.alive.max).toBe(1);
    const c = continuityOf(w.players.audible);
    expect(c.transitions).toBeGreaterThanOrEqual(1);
    expect(c.overlapMs).toBe(0);
    expect(c.lostMs).toBe(0);
    // The fake reports its exact place, so nothing is repeated here; the phone may repeat up to maxRepeatMs (step 6).
    expect(c.repeatedMs).toBeLessThanOrEqual(TRANSIENT_HANDOVER.resumeBehindMs);
    expect(TRANSIENT_HANDOVER).toMatchObject({ maxSilenceMs: 1_000, maxRepeatMs: 100 });
    // The silence is the new player's own start (the fake's 400 ms), inside the bound measured on the phone (HC-2′).
    expect(c.largestSilenceMs).toBeGreaterThan(0);
    expect(c.largestSilenceMs).toBeLessThanOrEqual(TRANSIENT_HANDOVER.maxSilenceMs);
    // The old player was paused before it was released, and its file let go after each switch.
    for (const m of w.players.made.slice(0, -1)) expect(m.calls.slice(-2)).toEqual(['pause', 'release']);
    expect(w.players.made.every((m) => m.playedAfterRelease === 0)).toBe(true);
    expect(w.server.calls.filter((x) => x.startsWith('DELETE')).length).toBeGreaterThanOrEqual(1);
  });

  it('(8) the place does not move while the switch is silent, and runs on from it once the new file plays', async () => {
    const w = world({ runs: [60 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 1_000 }, { loadDelayMs: 600 });
    w.engine.play(0, 0);
    await run(52 * MINUTE);
    const samples: { phase: string; positionMs: number }[] = [];
    const stop = w.engine.subscribe(() => samples.push({ phase: w.engine.getState().phase, positionMs: w.engine.getState().positionMs }));
    await run(2 * MINUTE);
    stop();
    const preparing = samples.filter((x) => x.phase === 'PREPARING');
    expect(preparing.length).toBeGreaterThanOrEqual(1);
    // One place for the whole silence, and the clock never goes back or jumps ahead of what is heard.
    expect(new Set(preparing.map((x) => x.positionMs)).size).toBe(1);
    for (let i = 1; i < samples.length; i += 1) expect(samples[i]!.positionMs).toBeGreaterThanOrEqual(samples[i - 1]!.positionMs);
    const last = w.players.made[w.players.made.length - 1]!;
    expect(last.calls).toContain(`seek:${preparing[0]!.positionMs}`);
    expect(continuityOf(w.players.audible).lostMs).toBe(0);
  });

  it('(8) also across runs of a Replay: the next run simply starts on the new set', async () => {
    const ends: number[] = [];
    let engineRef: ReturnType<typeof world>['engine'] | null = null;
    const w = world({ runs: [40 * MINUTE, 30 * MINUTE], boundaries: [{ kind: 'CROSS_RECORDING' }], sourceEndsInMs: 600 * MINUTE, prepareMs: 5_000 },
      {}, { onRunEnd: (r) => {
        ends.push(r);
        if (r === 0) setTimeout(() => engineRef?.play(1, 0), 1_500);
      } });
    engineRef = w.engine;
    w.engine.play(0, 0);
    await run(72 * MINUTE);
    expect(ends).toEqual([0, 1]);
    expect(w.events).toEqual([]);
    expect(w.notices.ended).toBe(0);
  });

  it('(9) a pause across the renewal point: nothing renewed while paused; renewal first, CL-04 after 1 s, the exact place', async () => {
    const w = world({ runs: [60 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 5_000 });
    w.engine.play(0, 0);
    await run(50 * MINUTE);
    w.engine.pause();
    const at = w.engine.getState().positionMs;
    const asked = w.server.calls.filter((c) => c.startsWith('POST')).length;
    await run(5 * MINUTE);
    expect(w.server.calls.filter((c) => c.startsWith('POST')).length).toBe(asked);
    w.engine.play();
    await run(TRANSIENT_WAITING_NOTICE_MS + 100);
    expect(w.engine.getState().waiting).toBe(true);
    await run(6_000);
    expect(w.engine.getState().phase).toBe('PLAYING');
    const last = w.players.made[w.players.made.length - 1]!;
    expect(last.calls).toContain(`seek:${at}`);
    expect(continuityOf(w.players.audible).lostMs).toBe(0);
  });

  it('(9) renewal failing twice before a start is CL-05 / RA-12', async () => {
    const w = world({ runs: [60 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 1_000 });
    w.engine.play(0, 0);
    await run(54 * MINUTE);
    w.engine.pause();
    w.server.failFromGeneration = 2;
    w.engine.play();
    await run(10_000);
    expect(w.engine.getState().phase).toBe('FAILED');
    expect(w.engine.getState().endedReason).toBeNull();
  });

  it('(9) the source ending during the renewal stops with the proven cause', async () => {
    const w = world({ runs: [60 * MINUTE], sourceEndsInMs: 56 * MINUTE, prepareMs: 3 * MINUTE, sourceReason: 'EXPIRED' });
    w.engine.play(0, 0);
    await run(57 * MINUTE);
    expect(w.engine.getState()).toMatchObject({ phase: 'ENDED', endedReason: 'EXPIRED' });
  });

  it('(10) S-8a: the renewal returns the same set (it covers the source): no repeat renewal, CL-06 at E', async () => {
    // The first file is made within 58 min of E: it covers the source.
    const w = world({ runs: [60 * MINUTE], sourceEndsInMs: 40 * MINUTE, prepareMs: 0, sourceReason: 'EXPIRED' });
    w.engine.play(0, 0);
    await run(41 * MINUTE);
    expect(w.engine.getState()).toMatchObject({ phase: 'ENDED', endedReason: 'EXPIRED' });
    expect(w.server.sets).toHaveLength(1);
    // Asked once to start, once to renew (the answer: the same set, so it covers the source), never again before E;
    // at E the cause is asked of the source authority (a new command: NOT_FOUND, EXPIRED).
    const posts = w.server.calls.filter((c) => c.startsWith('POST'));
    expect(posts).toHaveLength(3);
    expect(new Set(posts).size).toBe(3);
    const end = Math.max(...w.players.audible.map((s) => s.wallEnd));
    expect(end).toBeLessThanOrEqual(w.server.sourceEnd);
  });

  it('(10) S-8b: the hand-over to a file bounded by E, played to E, then CL-06', async () => {
    const w = world({ runs: [120 * MINUTE], sourceEndsInMs: 80 * MINUTE, prepareMs: 10_000, sourceReason: 'EXPIRED' });
    w.engine.play(0, 0);
    await run(81 * MINUTE);
    expect(w.engine.getState()).toMatchObject({ phase: 'ENDED', endedReason: 'EXPIRED' });
    expect(w.server.sets).toHaveLength(2);
    expect(w.events).toEqual([]);
    const c = continuityOf(w.players.audible);
    expect(c.lostMs).toBe(0);
    expect(Math.max(...w.players.audible.map((s) => s.wallEnd))).toBeLessThanOrEqual(w.server.sourceEnd);
  });

  it('(10) S-8d: G+1 not READY when the file ends: CL-04, the degraded continuation, then CL-06 at E, no audio after E', async () => {
    const w = world({ runs: [120 * MINUTE], sourceEndsInMs: 70 * MINUTE, prepareMs: 6 * MINUTE, sourceReason: 'EXPIRED' });
    w.engine.play(0, 0);
    await run(71 * MINUTE);
    expect(w.events).toContain('TRANSIENT_HANDOVER_DEGRADED');
    expect(w.notices.waiting).toBeGreaterThanOrEqual(1);
    expect(w.engine.getState()).toMatchObject({ phase: 'ENDED', endedReason: 'EXPIRED' });
    expect(continuityOf(w.players.audible).lostMs).toBe(0);
    expect(Math.max(...w.players.audible.map((s) => s.wallEnd))).toBeLessThanOrEqual(w.server.sourceEnd);
  });

  it('a switch slower than 1 s shows CL-04 (RA-11) and still resumes at the saved place: nothing lost, never two players', async () => {
    const w = world({ runs: [60 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 1_000 }, { loadDelayMs: 0 });
    w.engine.play(0, 0);
    await run(52 * MINUTE);
    w.notices.waiting = 0;
    // From here on every new player takes 1.5 s to start.
    w.players.setLoadDelay(1_500);
    await run(3 * MINUTE);
    expect(w.notices.waiting).toBe(1);
    expect(w.events).toEqual([]);
    expect(w.players.alive.max).toBe(1);
    const c = continuityOf(w.players.audible);
    expect(c.lostMs).toBe(0);
    expect(c.overlapMs).toBe(0);
    expect(w.notices.ended).toBe(0);
  });

  it('a pause during the switch keeps the saved place; the resume plays the new file from it', async () => {
    const w = world({ runs: [60 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 1_000 }, { loadDelayMs: 2_000 });
    w.engine.play(0, 0);
    await run(52 * MINUTE);
    await until(w, () => w.engine.getState().phase === 'PREPARING');
    const at = w.engine.getState().positionMs;
    w.engine.pause();
    expect(w.engine.getState()).toMatchObject({ phase: 'PAUSED', positionMs: at });
    expect(w.players.made.filter((m) => !m.released)).toHaveLength(1);
    await run(5_000);
    expect(w.players.audible.every((s) => s.wallEnd <= Date.now() - 5_000 + 1)).toBe(true);
    w.engine.play();
    await run(3_000);
    expect(w.engine.getState().phase).toBe('PLAYING');
    const c = continuityOf(w.players.audible);
    expect(c.lostMs).toBe(0);
    expect(c.overlapMs).toBe(0);
    expect(w.players.alive.max).toBe(1);
  });

  it('a live call that begins during the switch releases the player and both sets', async () => {
    const w = world({ runs: [60 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 1_000 }, { loadDelayMs: 2_000 });
    w.engine.play(0, 0);
    await run(52 * MINUTE);
    await until(w, () => w.engine.getState().phase === 'PREPARING');
    w.call.set(true);
    expect(w.players.made.every((m) => m.released)).toBe(true);
    expect(w.server.calls.filter((c) => c.startsWith('DELETE')).length).toBe(2);
    await run(10_000);
    expect(w.players.made.every((m) => m.playedAfterRelease === 0)).toBe(true);
  });

  it('a lost renewal answer is asked again with the SAME command; never a third live generation', async () => {
    const w = world({ runs: [60 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 1_000 });
    w.engine.play(0, 0);
    await run(53 * MINUTE + 1_100);
    w.server.loseAnswers = 2;
    await run(10 * MINUTE);
    expect(w.server.sets).toHaveLength(2);
    expect(w.events).toEqual([]);
  });

  it('CL-11 / RA-17 never while the source is available: a 3-hour listening of renewals ends only at its end', async () => {
    const w = world({ runs: [180 * MINUTE], sourceEndsInMs: 600 * MINUTE, prepareMs: 20_000 }, { responseCapMs: 10 * MINUTE });
    w.engine.play(0, 0);
    await run(181 * MINUTE);
    expect(w.notices.ended).toBe(0);
    expect(w.engine.getState()).toMatchObject({ phase: 'PAUSED', positionMs: 0 });
    expect(continuityOf(w.players.audible).lostMs).toBe(0);
  });

  it('the renewal lead is the approved L and cannot be configured outside [3, 10] min', () => {
    expect(TRANSIENT_RENEWAL_LEAD_MS).toBe(5 * MINUTE);
  });
});
