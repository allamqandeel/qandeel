/**
 * S8B-07 CP2-A.1 (R-2, R-3, R-5 in-app) — one continuous presentation over the Replay's ONE presentation clock, on the
 * CP1-B mixed world (1 text · 2, 3 (+4) audio in run 0 · 5 text · the cross-recording pause · 6 audio in run 1):
 *
 *   - the timeline's length and position are `replayPresentationClock`'s (the stage's and the video's clock), and a seek
 *     to any instant lands there exactly — inside long speech, in a text moment, or before a run;
 *   - playing through, the position never goes back and never jumps: one continuous piece across message boundaries;
 *   - paused, a seek places the clock there, so the stage's time (`replayStageTime`) is that instant's, not the moment's
 *     start; playing again continues from it;
 *   - the reading pace keeps its elapsed part across a pause, and a seek inside a text moment runs only what is left.
 *
 * FUNCTIONAL results on a fake clock; the device's are the consolidated HONOR pass.
 */
import { replayPresentationClock, replayStageTime, replayTimelinePosition, replayTimelineTarget, REPLAY_STAGE_AUDIO_LAG_MS } from '../../replay-cosmos/presentation-clock';
import { replayMomentPaceMs } from '../../replay-player';
import { planFor } from '../replay-audio-clock';
import { CROSS, MOMENTS, RUN0, RUN1, pace, run, until, world } from '../__fixtures__/replay-audio-world';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

const SHAPES = [{ durationMs: 9_000, spans: RUN0 }, { durationMs: 5_000, spans: RUN1 }];
const PLAN = planFor(MOMENTS, SHAPES, [CROSS])!;
/** The presentation clock exactly as the stage lays it out (the same map, moments and pace function). */
const P = replayPresentationClock(PLAN, MOMENTS, replayMomentPaceMs)!;

/** 1 text (3.5 s) · run 0 (9 s: moment 2 from 3.5 s, moment 3 from 7.5 s) · 5 text (3.5 s) · the 1.5 s pause · run 1 (5 s). */
const TEXT1 = pace('first');
const RUN0_AT = TEXT1;
const TEXT5_AT = RUN0_AT + 9_000;
const PAUSE_AT = TEXT5_AT + pace('fifth');
const RUN1_AT = PAUSE_AT + 1_500;

type W = ReturnType<typeof world>;
function position(w: W): number {
  const clock = w.clock()!;
  const state = clock.getState();
  const paced = w.player.pacedElapsed();
  return replayTimelinePosition(P, w.ordinal()!, { phase: state.phase, ordinal: state.ordinal, place: clock.place() },
    paced !== null && paced.ordinal === w.ordinal() ? paced.elapsedMs : null, clock.detail().pending);
}
const lastHeard = (w: W) => w.heard().at(-1)!;

describe('the one timeline: the presentation clock, read and sought (R-3)', () => {
  it('is the whole part, laid out on the stage\'s own clock', () => {
    expect(P.durationMs).toBe(RUN1_AT + 5_000);
    expect(P.blocks.map((b) => [b.kind, b.startMs, b.endMs])).toEqual([
      ['TEXT', 0, TEXT1], ['RUN', RUN0_AT, TEXT5_AT], ['TEXT', TEXT5_AT, PAUSE_AT], ['PAUSE', PAUSE_AT, RUN1_AT], ['RUN', RUN1_AT, RUN1_AT + 5_000],
    ]);
  });

  it('any instant is a moment and an offset that place the clock exactly there', () => {
    expect(replayTimelineTarget(P, 1_000)).toEqual({ ordinal: 1, offsetMs: 1_000 });
    // Inside moment 2's speech, before moment 3's window starts.
    expect(replayTimelineTarget(P, RUN0_AT + 2_000)).toEqual({ ordinal: 2, offsetMs: 2_000 });
    // Both windows have started (the MIX): the latest-started one, as the clock reports it (D-05.5).
    expect(replayTimelineTarget(P, RUN0_AT + 5_000)).toEqual({ ordinal: 3, offsetMs: 1_000 });
    expect(replayTimelineTarget(P, TEXT5_AT + 500)).toEqual({ ordinal: 5, offsetMs: 500 });
    // The pause before a run: that run's first window, from its start.
    expect(replayTimelineTarget(P, PAUSE_AT + 700)).toEqual({ ordinal: 6, offsetMs: 0 });
    expect(replayTimelineTarget(P, RUN1_AT + 1_500)).toEqual({ ordinal: 6, offsetMs: 1_500 });
    expect(replayTimelineTarget(P, 10 * P.durationMs)).toEqual({ ordinal: 6, offsetMs: 4_999 });
    // Round trip inside a run: the window's file start plus the offset is the instant, to the millisecond.
    for (const t of [RUN0_AT, RUN0_AT + 1, RUN0_AT + 4_321, TEXT5_AT - 1, RUN1_AT + 2_222]) {
      const target = replayTimelineTarget(P, t)!;
      const { runIndex, window } = PLAN.windowOf.get(target.ordinal)!;
      expect(P.runStartMs(runIndex) + window.fromMs + target.offsetMs).toBe(t);
    }
  });

  it('the position is the clock\'s place, the reading pace\'s elapsed part, or the moment\'s start — never a stale place', () => {
    const running = (ordinal: number | null, place: Parameters<typeof P.at>[0]) => ({ phase: 'RUNNING' as const, ordinal, place });
    expect(replayTimelinePosition(P, 1, { phase: 'IDLE', ordinal: null, place: null }, 1_200)).toBe(1_200);
    expect(replayTimelinePosition(P, 1, { phase: 'IDLE', ordinal: null, place: null }, 99_999)).toBe(TEXT1);
    expect(replayTimelinePosition(P, 2, running(2, { kind: 'RUN', runIndex: 0, positionMs: 2_000 }), null)).toBe(RUN0_AT + 2_000);
    // Paced elsewhere and moved on the Spine: the place is not this moment's.
    expect(replayTimelinePosition(P, 2, { phase: 'HELD', ordinal: 6, place: { kind: 'RUN', runIndex: 1, positionMs: 900 } }, null)).toBe(RUN0_AT);
    // Moment 5 read in full, the clock holding the pause after it: the pause's own place.
    expect(replayTimelinePosition(P, 5, running(null, { kind: 'BOUNDARY', runIndex: 1, elapsedMs: 600 }), pace('fifth'))).toBe(PAUSE_AT + 600);
    expect(replayTimelinePosition(P, 6, { phase: 'DONE', ordinal: 6, place: null }, null)).toBe(P.durationMs);
  });
});

describe('one continuous piece across message boundaries (R-2)', () => {
  it('played through, the position only moves forward, in small steps, from 0 to the end', async () => {
    const w = world();
    await w.open();
    w.player.play();
    const samples: number[] = [];
    while (w.playing()) {
      samples.push(position(w));
      await run(100);
      if (samples.length > 600) throw new Error('never ended');
    }
    samples.push(position(w));
    expect(samples[0]).toBe(0);
    expect(samples.at(-1)).toBe(P.durationMs);
    const steps = samples.slice(1).map((v, i) => v - samples[i]!);
    // Never backwards, and never a jump: at most a sample's time plus the clock's own report interval.
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...steps)).toBeLessThanOrEqual(400);
    // It plays once, without stopping at a message: every moment in order, one set, both files heard in full.
    expect(w.server.sets).toHaveLength(1);
  });

  it('in the last moment, Play goes on from a held step or a pause part-way — it starts again from the first only after the end', async () => {
    const w = world();
    await w.open();
    w.player.play();
    await until(() => w.ordinal() === 6 && w.clock()!.getState().phase === 'RUNNING');
    await run(1_000);
    w.player.pause();
    await run(0);
    const paused = position(w);
    expect(paused).toBeGreaterThan(RUN1_AT);
    w.player.play();
    await run(0);
    expect(w.ordinal()).toBe(6);
    expect(position(w)).toBeGreaterThanOrEqual(paused);
    w.player.pause();
    await run(0);
    // A held step into the last moment: Play goes on from it.
    w.player.seekTo(6, 3_000);
    await run(0);
    expect(position(w)).toBe(RUN1_AT + 3_000);
    w.player.play();
    await run(500);
    expect(w.ordinal()).toBe(6);
    expect(position(w)).toBeGreaterThanOrEqual(RUN1_AT + 3_000);
    // Played to its end, Play starts the part again from its first moment, as before.
    await until(() => !w.playing());
    expect(position(w)).toBe(P.durationMs);
    w.player.play();
    await run(0);
    expect(w.ordinal()).toBe(1);
  });
});

describe('the timeline before the first Play (PO direction, CP2-A.1 final validation)', () => {
  it("is drawn from the version's map read alone: the same clock and length, with no set asked for and no audio", async () => {
    const w = world();
    await w.open();
    await run(0);
    expect(w.mapCalls).toHaveLength(1);
    expect(w.server.calls).toHaveLength(0);
    const detail = w.clock()!.detail();
    // The audio's map is still unknown (nothing is played from a preview); only the timeline reads it.
    expect(detail.plan).toBeNull();
    expect(detail.timelinePlan).not.toBeNull();
    expect(replayPresentationClock(detail.timelinePlan!, MOMENTS, replayMomentPaceMs)!.durationMs).toBe(P.durationMs);
    expect(position(w)).toBe(0);
    expect(w.playing()).toBe(false);
  });

  it('a step before Play shows that place, asks for nothing, and Play starts the audio exactly there', async () => {
    const w = world();
    await w.open();
    await run(0);
    const target = replayTimelineTarget(P, RUN0_AT + 6_500)!;
    expect(target).toEqual({ ordinal: 3, offsetMs: 2_500 });
    w.player.seekTo(target.ordinal, target.offsetMs);
    await run(0);
    expect(w.ordinal()).toBe(3);
    expect(w.playing()).toBe(false);
    expect(w.server.calls).toHaveLength(0);
    expect(position(w)).toBe(RUN0_AT + 6_500);
    w.player.play();
    await until(() => w.heard().length > 0);
    expect(lastHeard(w).run).toBe(0);
    expect(lastHeard(w).from).toBeGreaterThanOrEqual(6_500);
    expect(lastHeard(w).from).toBeLessThanOrEqual(6_600);
  });

  it("a step backward before Play, into the first recording's start, plays from there", async () => {
    const w = world();
    await w.open();
    await run(0);
    const late = replayTimelineTarget(P, RUN1_AT + 2_000)!;
    w.player.seekTo(late.ordinal, late.offsetMs);
    await run(0);
    expect(position(w)).toBe(RUN1_AT + 2_000);
    const early = replayTimelineTarget(P, RUN0_AT + 1_000)!;
    expect(early).toEqual({ ordinal: 2, offsetMs: 1_000 });
    w.player.seekTo(early.ordinal, early.offsetMs);
    await run(0);
    expect(w.ordinal()).toBe(2);
    expect(position(w)).toBe(RUN0_AT + 1_000);
    w.player.play();
    await until(() => w.heard().length > 0);
    expect(lastHeard(w).run).toBe(0);
    expect(lastHeard(w).from).toBeGreaterThanOrEqual(1_000);
    expect(lastHeard(w).from).toBeLessThanOrEqual(1_100);
  });

  it('while the first Play prepares after a step, the place stays the chosen one — never the recording\'s start', async () => {
    const w = world();
    await w.open();
    await run(0);
    w.player.seekTo(3, 3_750);
    await run(0);
    w.player.play();
    const seen: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      await run(100);
      seen.push(position(w));
    }
    expect(w.clock()!.getState().phase).toBe('RUNNING');
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(RUN0_AT + 7_750);
  });

  it("no map answer: no line until the set's own map is held — nothing is invented", async () => {
    const w = world({ map: () => Promise.resolve({ kind: 'UNAVAILABLE' }) });
    await w.open();
    await run(0);
    expect(w.clock()!.detail().timelinePlan).toBeNull();
    w.player.play();
    await until(() => w.clock()!.getState().phase === 'RUNNING');
    expect(w.clock()!.detail().timelinePlan).toBe(w.clock()!.detail().plan);
  });

  it("a map that does not describe these moments is ignored, and the set's own map governs once held", async () => {
    const stray = world({ map: () => Promise.resolve({ kind: 'MAP', map: { runs: [{ artifactId: null, durationMs: 5_000, spans: RUN1 }], boundaries: [] } }) });
    await stray.open();
    await run(0);
    expect(stray.clock()!.detail().timelinePlan).toBeNull();
    // A preview that differs from the set's map: the set's wins for the timeline too, the moment it is held.
    const longer = world({ map: () => Promise.resolve({ kind: 'MAP', map: { runs: [{ artifactId: null, durationMs: 9_000, spans: RUN0 }, { artifactId: null, durationMs: 6_000, spans: RUN1 }], boundaries: [CROSS] } }) });
    await longer.open();
    await run(0);
    expect(replayPresentationClock(longer.clock()!.detail().timelinePlan!, MOMENTS, replayMomentPaceMs)!.durationMs).toBe(P.durationMs + 1_000);
    longer.player.play();
    await until(() => longer.clock()!.getState().phase === 'RUNNING');
    expect(longer.clock()!.detail().timelinePlan).toBe(longer.clock()!.detail().plan);
    expect(replayPresentationClock(longer.clock()!.detail().timelinePlan!, MOMENTS, replayMomentPaceMs)!.durationMs).toBe(P.durationMs);
  });
});

describe('a seek inside long speech lands where it was asked (R-3, O-5)', () => {
  it('playing: the file continues from that place, and the moment shown is the one speaking there', async () => {
    const w = world();
    await w.open();
    w.player.play();
    await until(() => w.ordinal() === 2 && w.clock()!.getState().phase === 'RUNNING');
    const target = replayTimelineTarget(P, RUN0_AT + 8_000)!;
    expect(target).toEqual({ ordinal: 3, offsetMs: 4_000 });
    w.player.seekTo(target.ordinal, target.offsetMs);
    expect(w.ordinal()).toBe(3);
    await until(() => w.clock()!.getState().phase === 'RUNNING');
    // The engine plays run 0 from the file place asked (moment 3's window starts at 4 s; 4 s into it is 8 s).
    expect(w.clock()!.detail().runIndex).toBe(0);
    expect(w.clock()!.detail().positionMs).toBeGreaterThanOrEqual(8_000);
    expect(w.clock()!.detail().positionMs).toBeLessThanOrEqual(8_300);
    expect(w.ordinal()).toBe(3);
    expect(w.playing()).toBe(true);
    expect(Math.abs(position(w) - (RUN0_AT + 8_000))).toBeLessThanOrEqual(300);
  });

  it('paused: the clock is placed there and held — the stage draws that instant — and Play continues from it', async () => {
    const w = world();
    await w.open();
    w.player.play();
    await until(() => w.ordinal() === 2 && w.clock()!.getState().phase === 'RUNNING');
    await run(1_000);
    w.player.pause();
    await run(0);
    expect(w.clock()!.getState().phase).toBe('HELD');
    // Another place in moment 2, then one inside moment 3 (a different moment, still paused).
    w.player.seekTo(2, 2_000);
    await run(0);
    expect(w.clock()!.getState()).toMatchObject({ phase: 'HELD', ordinal: 2 });
    expect(w.clock()!.place()).toEqual({ kind: 'RUN', runIndex: 0, positionMs: 2_000 });
    expect(position(w)).toBe(RUN0_AT + 2_000);
    const at = replayTimelineTarget(P, RUN0_AT + 6_500)!;
    w.player.seekTo(at.ordinal, at.offsetMs);
    await run(0);
    expect(w.ordinal()).toBe(3);
    expect(w.playing()).toBe(false);
    expect(w.clock()!.getState()).toMatchObject({ phase: 'HELD', ordinal: 3 });
    expect(position(w)).toBe(RUN0_AT + 6_500);
    // The stage (R-5): the moment's place, behind it by the stated allowance — not the moment's start.
    const state = w.clock()!.getState();
    expect(replayStageTime(P, 3, { phase: state.phase, ordinal: state.ordinal, place: w.clock()!.place() }))
      .toEqual({ kind: 'AUDIO', t: RUN0_AT + 6_500 - REPLAY_STAGE_AUDIO_LAG_MS });
    const heardBefore = w.heard().length;
    w.player.play();
    await until(() => w.heard().length > heardBefore);
    expect(lastHeard(w).run).toBe(0);
    expect(lastHeard(w).from).toBeGreaterThanOrEqual(6_500);
    expect(lastHeard(w).from).toBeLessThanOrEqual(6_600);
  });
});

describe('the reading pace is one continuous span too (R-2, R-3)', () => {
  it('a pause keeps its elapsed part: playing again runs only what is left', async () => {
    const w = world();
    await w.open();
    w.player.play();
    await run(0);
    await run(2_000);
    expect(w.player.pacedElapsed()).toEqual({ ordinal: 1, elapsedMs: 2_000 });
    w.player.pause();
    await run(5_000);
    expect(w.player.pacedElapsed()).toEqual({ ordinal: 1, elapsedMs: 2_000 });
    expect(position(w)).toBe(2_000);
    w.player.play();
    await run(0);
    await run(TEXT1 - 2_000 - 10);
    expect(w.player.pacedElapsed()?.ordinal).toBe(1);
    await run(20);
    // Read in full: the text stays at its end until moment 2 speaks — at once, its audio made ready while the text was read
    // (CP2-A.1 correction round, F-1): one command, polled while the set was prepared.
    expect(w.player.pacedElapsed()).toEqual({ ordinal: 1, elapsedMs: TEXT1 });
    expect(new Set(w.server.calls.filter((c) => c.startsWith('POST')))).toHaveProperty('size', 1);
    expect(await until(() => w.ordinal() === 2)).toBeLessThanOrEqual(260);
  });

  it('a seek inside a text moment runs its pace from there, then the pause and the next recording, without stopping', async () => {
    const w = world();
    await w.open();
    w.player.play();
    await until(() => w.ordinal() === 2 && w.clock()!.getState().phase === 'RUNNING');
    const target = replayTimelineTarget(P, TEXT5_AT + 2_000)!;
    expect(target).toEqual({ ordinal: 5, offsetMs: 2_000 });
    w.player.seekTo(target.ordinal, target.offsetMs);
    await run(0);
    expect(w.ordinal()).toBe(5);
    // The audio stops presenting while a text moment is read.
    expect(w.clock()!.getState().phase).not.toBe('RUNNING');
    expect(position(w)).toBe(TEXT5_AT + 2_000);
    await run(pace('fifth') - 2_000 - 10);
    expect(w.ordinal()).toBe(5);
    await run(20);
    expect(w.clock()!.detail().between).toEqual(CROSS);
    await run(700);
    expect(Math.abs(position(w) - (PAUSE_AT + 700))).toBeLessThanOrEqual(20);
    await until(() => w.ordinal() === 6);
    expect(w.playing()).toBe(true);
  });

  it('refuses a seek outside this version, or to no number, and changes nothing', async () => {
    const w = world();
    await w.open();
    w.player.seekTo(99, 0);
    w.player.seekTo(2, Number.NaN);
    expect(w.ordinal()).toBe(1);
    expect(w.player.pacedElapsed()).toBeNull();
  });
});

describe('CP2-A.1 correction round — audio prepared ahead, and a seek that rebuilds nothing (F-1, F-3)', () => {
  /** The playback sets asked for: one POST command (its polls repeat the same command). */
  const POSTS = (w: W) => new Set(w.server.calls.filter((call) => call.startsWith('POST'))).size;
  const playersOf = (w: W, runIndex: number) => w.players.made.filter((made) => made.artifactId === w.server.sets[0]!.ids[runIndex]).length;

  it('F-1: while the text before a recording is read, that recording is prepared — no wait at the boundary, no audio for the text', async () => {
    const w = world();
    await w.open();
    w.player.seek(5);
    await run(0);
    w.player.play();
    // Moment 5 is text: nothing is heard while it is read, and run 1 is made ready meanwhile.
    await run(pace('fifth') - 100);
    expect(w.ordinal()).toBe(5);
    expect(w.heard()).toHaveLength(0);
    expect(POSTS(w)).toBe(1);
    expect(w.players.made.some((made) => made.artifactId === w.server.sets[0]!.ids[1])).toBe(true);
    // The designed pause stays (B2X: never shortened by preparation), and run 1 is heard right after it.
    const boundary = Date.now() + 100;
    await until(() => w.heard().length > 0);
    expect(w.ordinal()).toBe(6);
    expect(lastHeard(w).run).toBe(1);
    expect(lastHeard(w).at - boundary).toBeGreaterThanOrEqual(1_500 - 10);
    expect(lastHeard(w).at - boundary).toBeLessThanOrEqual(1_500 + 260);
    expect(w.clock()!.detail().engine.waiting).toBe(false);
  });

  it('F-3: playing, a seek forward and back inside the held recording moves the same player — no new player, no new set', async () => {
    const w = world();
    await w.open();
    w.player.seek(2);
    await run(0);
    w.player.play();
    await until(() => w.clock()!.getState().phase === 'RUNNING');
    await run(1_000);
    const made = w.players.made.length;
    const posts = POSTS(w);
    for (const at of [RUN0_AT + 6_500, RUN0_AT + 1_000, RUN0_AT + 8_000]) {
      const target = replayTimelineTarget(P, at)!;
      w.player.seekTo(target.ordinal, target.offsetMs);
      await until(() => w.clock()!.getState().phase === 'RUNNING');
      await run(300);
      expect(Math.abs(position(w) - (at + 300))).toBeLessThanOrEqual(300);
    }
    expect(w.players.made.length).toBe(made);
    expect(POSTS(w)).toBe(posts);
    expect(w.players.alive.max).toBe(1);
  });

  it('F-3: paused, a seek and the next Play continue on the same player, from the place chosen', async () => {
    const w = world();
    await w.open();
    w.player.seek(2);
    await run(0);
    w.player.play();
    await until(() => w.clock()!.getState().phase === 'RUNNING');
    await run(1_000);
    w.player.pause();
    await run(0);
    expect(playersOf(w, 0)).toBe(1);
    const at = replayTimelineTarget(P, RUN0_AT + 500)!;
    w.player.seekTo(at.ordinal, at.offsetMs);
    await run(0);
    expect(position(w)).toBe(RUN0_AT + 500);
    const before = w.heard().length;
    w.player.play();
    await until(() => w.heard().length > before);
    expect(lastHeard(w).from).toBeGreaterThanOrEqual(500);
    expect(lastHeard(w).from).toBeLessThanOrEqual(600);
    // Run 0 was heard on its one player to its end (the next recording's player is F-1's, made while moment 5 is read).
    expect(playersOf(w, 0)).toBe(1);
    expect(lastHeard(w).to).toBe(9_000);
  });

  it('F-3: the line never runs ahead of what is heard — while the player prepares, the place stays where it was asked', async () => {
    const w = world();
    await w.open();
    w.player.seek(2);
    await run(0);
    w.players.setLoadDelay(2_000);
    w.player.play();
    await run(1_500);
    expect(w.heard()).toHaveLength(0);
    expect(position(w)).toBe(RUN0_AT);
    // It runs once the player says it plays — from the place, never 2 s ahead of the sound.
    await until(() => w.clock()!.getState().phase === 'RUNNING');
    expect(position(w) - RUN0_AT).toBeLessThanOrEqual(300);
  });

  it('F-1 / F-3: held in a text moment after the next recording was made ready, a step into an earlier recording is that place, and Play plays it', async () => {
    // HONOR re-acceptance 2026-11-28: paused while moment 5 was read (run 1 made ready), a step into moment 3 drew run 1's start.
    const w = world();
    await w.open();
    w.player.play();
    await until(() => w.ordinal() === 5);
    await run(1_500);
    w.player.pause();
    await run(0);
    expect(playersOf(w, 1)).toBe(1);
    const text = replayTimelineTarget(P, TEXT5_AT + 400)!;
    w.player.seekTo(text.ordinal, text.offsetMs);
    await run(1_200);
    const at = replayTimelineTarget(P, RUN0_AT + 7_000)!;
    w.player.seekTo(at.ordinal, at.offsetMs);
    await run(1_200);
    expect(w.ordinal()).toBe(3);
    expect(position(w)).toBe(RUN0_AT + 7_000);
    const before = w.heard().length;
    w.player.play();
    await until(() => w.heard().length > before);
    await run(500);
    expect(w.heard()[before]!.run).toBe(0);
    expect(w.heard()[before]!.from).toBeGreaterThanOrEqual(7_000);
    expect(w.heard()[before]!.from).toBeLessThanOrEqual(7_100);
  });
});
