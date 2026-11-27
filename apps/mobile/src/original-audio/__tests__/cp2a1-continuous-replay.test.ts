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
    paced !== null && paced.ordinal === w.ordinal() ? paced.elapsedMs : null);
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
    expect(w.server.calls.filter((c) => c.startsWith('POST'))).toHaveLength(0);
    await run(20);
    // Read in full: moment 2's audio is asked for, and the text stays at its end until moment 2 speaks.
    expect(w.server.calls.filter((c) => c.startsWith('POST'))).toHaveLength(1);
    expect(w.player.pacedElapsed()).toEqual({ ordinal: 1, elapsedMs: TEXT1 });
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
