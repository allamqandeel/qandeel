/**
 * S8B-07 CP2-A.1 — the iOS Replay gate's readout, on jest's clock over the same fixture world the proof build plays in
 * real time: what the gate expects to read is what the readout says for a continuous part, steps backward and forward
 * while playing, steps backward and forward while held, and a step before the first Play — each step's landing place
 * included — and a break in the place is reported, never smoothed over.
 */
import type { ReplayDraftHandoff } from '../../replay-entry';
import { replayPresentationClock, replayTimelineTarget } from '../../replay-cosmos/presentation-clock';
import { replayMomentPaceMs } from '../../replay-player';
import { planFor } from '../../original-audio/replay-audio-clock';
import { CROSS, MOMENTS, REPLAY, RUN0, RUN1, SESSION, run, until, world } from '../../original-audio/__fixtures__/replay-audio-world';
import { createCp2a1ProofMonitor, formatCp2a1Reading } from '../__validation__/cp2a1-proof-monitor';

jest.setTimeout(60000);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/** The part's presentation clock, as the timeline lays it out (22.5 s). */
const P = replayPresentationClock(planFor(MOMENTS, [{ durationMs: 9_000, spans: RUN0 }, { durationMs: 5_000, spans: RUN1 }], [CROSS])!, MOMENTS, replayMomentPaceMs)!;

async function opened() {
  const w = world();
  const monitor = createCp2a1ProofMonitor(w.player, w.clock);
  const stop = monitor.start();
  w.player.openSaved({ sessionId: SESSION, replayId: REPLAY, draftRevision: 1, coverage: 'SELECTED_EXCERPT', selectedMomentCount: 6 } as unknown as ReplayDraftHandoff);
  await run(0);
  await run(0);
  return { w, monitor, stop };
}
type Monitor = Awaited<ReturnType<typeof opened>>['monitor'];
/** A step on the line at that fraction of the part, as the gate's tap makes it. */
function step(monitor: Monitor, fraction: number): number {
  const t = Math.round(fraction * P.durationMs);
  const target = replayTimelineTarget(P, t)!;
  monitor.controller.seekTo(target.ordinal, target.offsetMs);
  return t;
}
const reachedOrdinal = (monitor: Monitor, ordinal: number) => () => monitor.reading().ordinal === ordinal && monitor.reading().playing;

describe('the CP2-A.1 proof readout', () => {
  it('reads the whole part before the first Play: its length, at its start, nothing played', async () => {
    const { monitor, stop } = await opened();
    await run(200);
    const r = monitor.reading();
    expect(r.durationMs).toBe(22_500);
    expect(r.tMs).toBe(0);
    expect(r.playing).toBe(false);
    expect(formatCp2a1Reading(r)).toMatch(/^ord=1 t=0\.0 dur=22\.5 play=0 seeks=0 lands=- visited=- cont=OK max=0\.0 end=0$/);
    stop();
  });

  it('a part played from Play alone passes every moment, in order, with no break, to its end', async () => {
    const { w, monitor, stop } = await opened();
    w.player.play();
    await until(() => monitor.reading().ended, 60_000);
    const r = monitor.reading();
    expect(r.visited).toEqual([1, 2, 3, 5, 6]);
    expect(r.continuity).toBe('OK');
    expect(r.seeks).toBe(0);
    expect(r.durationMs).toBe(22_500);
    expect(r.tMs).toBe(22_500);
    expect(r.maxStepMs).toBeLessThanOrEqual(400);
    expect(formatCp2a1Reading(r)).toMatch(/^ord=6 t=22\.5 dur=22\.5 play=0 seeks=0 lands=- visited=1-2-3-5-6 cont=OK max=0\.\d end=1$/);
    stop();
  });

  it('C-SEEK-PLAYING: playing, a step back (25%) and then forward (90%) land there, and the part goes on to its end unbroken', async () => {
    const { w, monitor, stop } = await opened();
    w.player.play();
    await until(reachedOrdinal(monitor, 3));
    await run(1_500);
    const back = step(monitor, 0.25);
    await until(() => monitor.reading().landsMs.length === 1);
    expect(monitor.reading().ordinal).toBe(2);
    expect(monitor.reading().landsMs[0]! - back).toBeGreaterThanOrEqual(-250);
    expect(monitor.reading().landsMs[0]! - back).toBeLessThanOrEqual(900);
    await run(1_500);
    const forward = step(monitor, 0.9);
    await until(() => monitor.reading().landsMs.length === 2);
    expect(monitor.reading().ordinal).toBe(6);
    expect(monitor.reading().landsMs[1]! - forward).toBeGreaterThanOrEqual(-250);
    expect(monitor.reading().landsMs[1]! - forward).toBeLessThanOrEqual(900);
    await until(() => monitor.reading().ended, 60_000);
    const r = monitor.reading();
    expect(r.continuity).toBe('OK');
    expect(r.seeks).toBe(2);
    expect(r.visited.slice(-1)).toEqual([6]);
    expect(formatCp2a1Reading(r)).toMatch(/ seeks=2 lands=\d+\.\d,\d+\.\d visited=/);
    stop();
  });

  it('C-SEEK-HELD: held in a text moment, a step back (50%) and then forward (80%) are drawn and held there; Play goes on from the last', async () => {
    const { w, monitor, stop } = await opened();
    w.player.play();
    await until(reachedOrdinal(monitor, 5));
    w.player.pause();
    await until(() => !monitor.reading().playing);
    const back = step(monitor, 0.5);
    await until(() => monitor.reading().landsMs.length === 1);
    expect(monitor.reading().ordinal).toBe(3);
    expect(Math.abs(monitor.reading().landsMs[0]! - back)).toBeLessThanOrEqual(250);
    const forward = step(monitor, 0.8);
    await until(() => monitor.reading().landsMs.length === 2);
    const held = monitor.reading();
    expect(held.ordinal).toBe(6);
    expect(held.playing).toBe(false);
    expect(Math.abs(held.landsMs[1]! - forward)).toBeLessThanOrEqual(250);
    await run(2_000);
    expect(monitor.reading().tMs).toBe(held.tMs);
    w.player.play();
    await run(3_000);
    expect(monitor.reading().tMs!).toBeGreaterThan(held.tMs! + 1_000);
    await until(() => monitor.reading().ended, 60_000);
    expect(monitor.reading().continuity).toBe('OK');
    stop();
  });

  it('C-SEEK-BEFORE-PLAY: a step before any Play (50%) is drawn there with nothing playing; Play goes on from it to the end', async () => {
    const { w, monitor, stop } = await opened();
    await run(200);
    const at = step(monitor, 0.5);
    await until(() => monitor.reading().landsMs.length === 1);
    const placed = monitor.reading();
    expect(placed.ordinal).toBe(3);
    expect(placed.playing).toBe(false);
    expect(Math.abs(placed.landsMs[0]! - at)).toBeLessThanOrEqual(250);
    w.player.play();
    await run(4_000);
    expect(monitor.reading().tMs!).toBeGreaterThan(placed.tMs! + 1_000);
    await until(() => monitor.reading().ended, 60_000);
    expect(monitor.reading().continuity).toBe('OK');
    expect(monitor.reading().visited).toEqual([3, 5, 6]);
    stop();
  });

  it('a jump nobody asked for is reported as a break', async () => {
    const { w, monitor, stop } = await opened();
    w.player.play();
    await until(() => (monitor.reading().ordinal ?? 0) >= 2 && monitor.reading().durationMs !== null);
    await run(1_000);
    w.player.seekTo(6, 0); // the uncounted controller: no step on the line was taken
    await run(500);
    expect(monitor.reading().continuity).toBe('BROKEN');
    stop();
  });
});
